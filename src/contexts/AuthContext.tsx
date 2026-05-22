import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { resolveTeacherAuthEmail, verifyStudentLoginRemote, formatRpcError } from '@/services/auth/remoteLogin';
import { invalidateTeacherGroupsCache } from '@/services/teacherGroups';
import {
  demoStudentLoginHints,
  demoTeacherLoginHints,
  isDemoBootstrapEnabled,
  isDemoTeacherEmail,
} from '@/lib/demoBootstrap';

type UserRole = 'teacher' | 'student';

export type LoginResult =
  | { ok: true }
  | { ok: false; message: string };

interface User {
  id: string;
  role: UserRole;
  name: string;
  username?: string;
  /** Tenant (liceo). Teachers only — from profiles.school_id. */
  schoolId?: string;
  schoolName?: string;
}

interface AuthContextType {
  user: User | null;
  login: (role: UserRole, credentials: { username: string; password: string }) => Promise<LoginResult>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  session: Session | null;
  authReady: boolean;
}

function clearTeacherAuthStorage() {
  localStorage.removeItem('auth_user');
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

/** Creates auth user + profile in Supabase if missing (no client sign-in). Requires Edge Function + verify_jwt=false for anon. */
async function seedDemoAuthUsers(): Promise<{ errorMessage?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('ensure-demo-users');
    if (error) {
      const msg = error.message || formatRpcError(error);
      return {
        errorMessage: `ensure-demo-users falló (${msg}). ¿Función desplegada en este proyecto? En la nube el runtime inyecta SUPABASE_SERVICE_ROLE_KEY; si agregaste un secreto manual, puede llamarse SERVICE_ROLE_KEY. En local: otra terminal con npm run functions:local (con supabase start).`,
      };
    }
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error) {
      const err = (data as { error: unknown }).error;
      const detail = typeof err === 'string' ? err : JSON.stringify(err);
      return { errorMessage: `ensure-demo-users respondió error: ${detail}` };
    }
  } catch (e) {
    return { errorMessage: `ensure-demo-users: ${formatRpcError(e)}` };
  }
  return {};
}

async function resolveTeacherProfile(session: Session): Promise<{
  name: string;
  schoolId?: string;
  schoolName?: string;
}> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, school_id, schools ( name )')
    .eq('user_id', session.user.id)
    .maybeSingle();

  const schoolJoin = profile?.schools as { name?: string } | { name?: string }[] | null;
  const schoolName = Array.isArray(schoolJoin)
    ? schoolJoin[0]?.name
    : schoolJoin?.name;

  const name =
    profile?.display_name ??
    (typeof session.user.user_metadata?.display_name === 'string'
      ? session.user.user_metadata.display_name
      : null) ??
    session.user.email?.split('@')[0] ??
    'Docente';

  return {
    name,
    schoolId: profile?.school_id ?? undefined,
    schoolName: schoolName ?? undefined,
  };
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const profileUpsertInProgress = useRef<Set<string>>(new Set());

  const restoreTeacherFromSession = useCallback(async (nextSession: Session) => {
    const { name, schoolId, schoolName } = await resolveTeacherProfile(nextSession);

    if (!schoolId) {
      if (import.meta.env.PROD) {
        clearTeacherAuthStorage();
        setUser(null);
        await supabase.auth.signOut();
      }
      return;
    }

    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        if (parsedUser.role === 'teacher' && parsedUser.id === nextSession.user.id) {
          const teacherUser: User = {
            ...parsedUser,
            name: name || parsedUser.name,
            schoolId: schoolId !== undefined ? schoolId : parsedUser.schoolId,
            schoolName: schoolName !== undefined ? schoolName : parsedUser.schoolName,
          };
          setUser(teacherUser);
          localStorage.setItem('auth_user', JSON.stringify(teacherUser));
          return;
        }
      } catch (e) {
        console.error('Error parsing saved user:', e);
      }
    }
    const teacherUser: User = {
      id: nextSession.user.id,
      role: 'teacher',
      name,
      schoolId,
      schoolName,
    };
    setUser(teacherUser);
    localStorage.setItem('auth_user', JSON.stringify(teacherUser));
  }, []);

  const restoreStudentFromStorage = useCallback(() => {
    const savedUser = localStorage.getItem('auth_user');
    if (!savedUser) return;
    try {
      const parsedUser = JSON.parse(savedUser) as User;
      if (parsedUser.role === 'student') {
        setUser(parsedUser);
      }
    } catch (e) {
      console.error('Error parsing saved user:', e);
    }
  }, []);

  useEffect(() => {
    if (isDemoBootstrapEnabled()) {
      void seedDemoAuthUsers();
    }

    let mounted = true;

    const bootstrap = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(initialSession);

      if (initialSession?.user) {
        await restoreTeacherFromSession(initialSession);
      } else {
        restoreStudentFromStorage();
      }

      setAuthReady(true);
    };

    void bootstrap();

    const handleSessionSideEffects = async (event: AuthChangeEvent, nextSession: Session | null) => {
      if (!mounted || !nextSession?.user) return;

      await restoreTeacherFromSession(nextSession);

      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION' && event !== 'TOKEN_REFRESHED') {
        return;
      }

      const userId = nextSession.user.id;
      if (profileUpsertInProgress.current.has(userId)) return;

      profileUpsertInProgress.current.add(userId);
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('school_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingProfile) {
          const { error } = await supabase.from('profiles').upsert(
            {
              user_id: userId,
              display_name: nextSession.user.user_metadata?.display_name ?? 'Docente',
              role: 'teacher',
            },
            { onConflict: 'user_id' }
          );
          if (error && import.meta.env.DEV) {
            console.error(`[AuthContext] Error upserting profile for user ${userId}:`, error);
          }
        }
      } finally {
        setTimeout(() => profileUpsertInProgress.current.delete(userId), 1000);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);

      if (event === 'SIGNED_OUT') {
        setUser((prev) => {
          if (prev?.role === 'teacher') {
            clearTeacherAuthStorage();
            return null;
          }
          return prev;
        });
        return;
      }

      if (nextSession?.user) {
        // Never await Supabase calls inside this callback (deadlock risk with getUser/getSession elsewhere).
        queueMicrotask(() => {
          void handleSessionSideEffects(event, nextSession);
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [restoreTeacherFromSession, restoreStudentFromStorage]);

  const login = async (role: UserRole, credentials: { username: string; password: string }): Promise<LoginResult> => {
    const username = credentials.username.trim();
    const password = credentials.password;

    if (role === 'teacher') {
      if (!username || !password) {
        return { ok: false, message: 'Ingresá usuario o correo y contraseña.' };
      }

      let ensure: { errorMessage?: string } = {};
      if (isDemoBootstrapEnabled()) {
        ensure = await seedDemoAuthUsers();
        if (ensure.errorMessage) {
          console.warn('[Auth]', ensure.errorMessage);
        }
      }

      let authEmail: string | null;
      try {
        authEmail = await resolveTeacherAuthEmail(supabase, username);
      } catch (e) {
        const detail = formatRpcError(e);
        console.error('[Auth] resolve teacher email:', e);
        let msg = `No se pudo validar el usuario: ${detail}. Si administrás el entorno, comprobá la migración de login, el seed y que la app apunte al proyecto Supabase correcto.`;
        if (detail.toLowerCase().includes('invalid api key')) {
          const url = import.meta.env.VITE_SUPABASE_URL || '';
          if (url.includes('127.0.0.1') || url.includes('localhost')) {
            msg +=
              ' Con URL local, VITE_SUPABASE_ANON_KEY debe ser la anon key de `npx supabase status` (no la del proyecto en la nube). Reiniciá `npm run dev` tras editar `.env.local`.';
          } else {
            msg +=
              ' Revisá VITE_SUPABASE_ANON_KEY en `.env` / `.env.local` (Supabase Dashboard → Settings → API → anon public).';
          }
        }
        return { ok: false, message: msg };
      }

      if (!authEmail) {
        return {
          ok: false,
          message: 'Usuario o código no reconocido. Verificá los datos o pedí acceso a tu institución.',
        };
      }

      const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (signError || !signData.session?.user) {
        if (import.meta.env.DEV) {
          console.warn('[Auth] teacher signIn failed:', signError?.message);
        }
        let message = 'Correo o contraseña incorrectos.';
        if (isDemoBootstrapEnabled() && isDemoTeacherEmail(authEmail)) {
          message += ` ${demoTeacherLoginHints(ensure.errorMessage)}`;
        }
        return { ok: false, message };
      }

      const uid = signData.session.user.id;
      const { name, schoolId, schoolName } = await resolveTeacherProfile(signData.session);

      if (!schoolId) {
        return {
          ok: false,
          message:
            'Tu cuenta no tiene un liceo asignado. Pedí al administrador que configure tu perfil antes de ingresar.',
        };
      }

      const newUser: User = { id: uid, role: 'teacher', name, schoolId, schoolName };
      setSession(signData.session);
      setUser(newUser);
      localStorage.setItem('auth_user', JSON.stringify(newUser));
      return { ok: true };
    }

    if (!username || !password) {
      return { ok: false, message: 'Ingresá código y contraseña.' };
    }

    try {
      await supabase.auth.signOut();
    } catch {
      // No bloquear login de estudiante si signOut falla (red / sesión ya vacía).
    }
    setSession(null);

    try {
      const result = await verifyStudentLoginRemote(supabase, username, password);
      if (!result.ok) {
        let message = 'Código o contraseña incorrectos.';
        if (isDemoBootstrapEnabled()) {
          message += ` ${demoStudentLoginHints()}`;
        }
        return { ok: false, message };
      }
      const newUser: User = {
        id: result.studentId,
        role: 'student',
        name: result.displayName,
        username,
      };
      setUser(newUser);
      localStorage.setItem('auth_user', JSON.stringify(newUser));
      return { ok: true };
    } catch (e) {
      const detail = formatRpcError(e);
      console.error('[Auth] student login:', e);
      const suffix = isDemoBootstrapEnabled()
        ? ' Si administrás el entorno, comprobá migración y seed de estudiantes.'
        : ' Intentá de nuevo más tarde o contactá soporte.';
      return {
        ok: false,
        message: `No se pudo validar el acceso: ${detail}.${suffix}`,
      };
    }
  };

  const logout = async (): Promise<void> => {
    const wasTeacher = user?.role === 'teacher';
    setUser(null);
    clearTeacherAuthStorage();
    if (wasTeacher) {
      invalidateTeacherGroupsCache();
      await supabase.auth.signOut();
      setSession(null);
    }
  };

  const isTeacherAuthenticated = user?.role === 'teacher' && Boolean(session?.user);
  const isStudentAuthenticated = user?.role === 'student';
  const isAuthenticated = isTeacherAuthenticated || isStudentAuthenticated;

  const contextValue: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated,
    session,
    authReady,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
