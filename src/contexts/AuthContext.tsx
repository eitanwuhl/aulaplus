import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';

type UserRole = 'teacher' | 'student';

interface User {
  id: string;
  role: UserRole;
  name: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  login: (role: UserRole, credentials: { username: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  session: Session | null;
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

// Demo credentials - real emails for Supabase Auth
const DEMO_TEACHER_EMAIL = 'demo.teacher@example.com';
const DEMO_TEACHER_PASSWORD = 'DemoPassword2024!';

// Mock teacher names for random rotation
const teacherNames = ['Ana García', 'Carlos Rodríguez', 'María López', 'Juan Martínez', 'Laura Fernández', 'Miguel Torres'];

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const profileUpsertInProgress = useRef<Set<string>>(new Set());
  const signOutRecoveryInProgress = useRef(false);

  // Function to ensure demo user exists and login silently in background
  const ensureSupabaseAuth = async () => {
    try {
      // First, ensure demo users exist via edge function
      const { error: ensureError } = await supabase.functions.invoke('ensure-demo-users');
      
      if (ensureError) {
        console.error('Error ensuring demo users:', ensureError);
      }

      // Then sign in with demo user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: DEMO_TEACHER_EMAIL,
        password: DEMO_TEACHER_PASSWORD
      });

      if (signInError) {
        console.error('Background auth error:', signInError);
      } else {
        console.log('Demo user authenticated successfully');
      }
    } catch (error) {
      console.error('Demo user setup error:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);

        // When session is lost (e.g. invalid refresh token cleared by edgeFunctionAuth),
        // re-establish demo session so next Edge Function call has a valid JWT.
        if (event === 'SIGNED_OUT' && !signOutRecoveryInProgress.current) {
          signOutRecoveryInProgress.current = true;
          ensureSupabaseAuth().finally(() => {
            signOutRecoveryInProgress.current = false;
          });
        }
        
        // Create or update profile silently in background when authenticated
        // Use idempotent upsert with conflict handling to avoid 409 spam
        if (session?.user) {
          const userId = session.user.id;
          
          // Prevent multiple concurrent upserts for the same user
          if (profileUpsertInProgress.current.has(userId)) {
            if (import.meta.env.DEV) {
              console.log(`[AuthContext] Profile upsert already in progress for user ${userId}, skipping`);
            }
            return;
          }
          
          profileUpsertInProgress.current.add(userId);
          
          // Use upsert with onConflict to handle existing profiles gracefully
          supabase.from('profiles').upsert({
            user_id: userId,
            display_name: 'Profesor Demo',
            role: 'teacher'
          }, {
            onConflict: 'user_id'
          }).then(({ error }) => {
            if (error) {
              // Treat 409 (Conflict) as success - profile already exists
              if (error.code === '23505' || error.code === 'PGRST116' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
                if (import.meta.env.DEV) {
                  console.log(`[AuthContext] Profile already exists for user ${userId} (this is OK)`);
                }
              } else {
                // Only log non-409 errors
                console.error(`[AuthContext] Error upserting profile for user ${userId}:`, error);
              }
            } else {
              if (import.meta.env.DEV) {
                console.log(`[AuthContext] Profile upserted successfully for user ${userId}`);
              }
            }
          }).catch((error) => {
            // Handle unexpected errors
            if (error.code === '23505' || error.code === 'PGRST116' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
              // 409-like error - treat as success
              if (import.meta.env.DEV) {
                console.log(`[AuthContext] Profile conflict (already exists) for user ${userId} (this is OK)`);
              }
            } else {
              console.error(`[AuthContext] Unexpected error upserting profile for user ${userId}:`, error);
            }
          }).finally(() => {
            // Remove from in-progress set after a short delay to prevent rapid re-execution
            setTimeout(() => {
              profileUpsertInProgress.current.delete(userId);
            }, 1000);
          });
        }

        if (!isInitialized) {
          setIsInitialized(true);
        }
      }
    );

    // Auto setup Supabase auth in background
    ensureSupabaseAuth();

    return () => subscription.unsubscribe();
  }, [isInitialized]);


  // Load user from localStorage on mount and sync with Supabase session
  useEffect(() => {
    const initializeUser = async () => {
      // First, check if there's a Supabase session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession?.user) {
        setSession(currentSession);
        // If we have a session but no user in state, restore from localStorage or create
        const savedUser = localStorage.getItem('auth_user');
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            // Only restore if it's a teacher (students don't use Supabase auth)
            if (parsedUser.role === 'teacher' && parsedUser.id === currentSession.user.id) {
              setUser(parsedUser);
            }
          } catch (e) {
            console.error('Error parsing saved user:', e);
          }
        }
      } else {
        // No Supabase session, check localStorage for student users
        const savedUser = localStorage.getItem('auth_user');
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            // Only restore student users (teachers need Supabase session)
            if (parsedUser.role === 'student') {
              setUser(parsedUser);
            }
          } catch (e) {
            console.error('Error parsing saved user:', e);
          }
        }
      }
    };

    initializeUser();
  }, []);

  // Login function - accepts ANY credentials (no validation)
  const login = async (role: UserRole, credentials: { username: string; password: string }): Promise<boolean> => {
    // NO VALIDATION - any credentials are accepted, even empty ones
    try {
      if (role === 'teacher') {
        // Ensure Supabase is authenticated with demo teacher account
        if (!session) {
          await ensureSupabaseAuth();
        }
        
        // Wait a bit for session to be set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get current session after auth
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user) {
          // Random teacher name for demo
          const randomName = teacherNames[Math.floor(Math.random() * teacherNames.length)];
          const newUser: User = {
            id: currentSession.user.id,
            role: 'teacher',
            name: randomName
          };
          setUser(newUser);
          localStorage.setItem('auth_user', JSON.stringify(newUser));
          return true;
        } else {
          // Even if Supabase auth fails, create a mock teacher user
          const randomName = teacherNames[Math.floor(Math.random() * teacherNames.length)];
          const newUser: User = {
            id: `teacher_${Date.now()}`,
            role: 'teacher',
            name: randomName
          };
          setUser(newUser);
          localStorage.setItem('auth_user', JSON.stringify(newUser));
          return true;
        }
      } else {
        // For students, create a mock user (any credentials accepted)
        const username = credentials.username || `student_${Date.now()}`;
        const newUser: User = {
          id: `student_${username}`,
          role: 'student', 
          name: `Estudiante ${username}`,
          username: username
        };
        setUser(newUser);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
        return true;
      }
    } catch (error) {
      console.error('Login error:', error);
      // Even on error, create a user to ensure login always succeeds
      if (role === 'teacher') {
        const randomName = teacherNames[Math.floor(Math.random() * teacherNames.length)];
        const newUser: User = {
          id: `teacher_${Date.now()}`,
          role: 'teacher',
          name: randomName
        };
        setUser(newUser);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
      } else {
        const username = credentials.username || `student_${Date.now()}`;
        const newUser: User = {
          id: `student_${username}`,
          role: 'student', 
          name: `Estudiante ${username}`,
          username: username
        };
        setUser(newUser);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
      }
      return true;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    setUser(null);
    localStorage.removeItem('auth_user');
    // Keep Supabase session active for seamless demo experience
  };

  // Context value - updates when state changes
  const contextValue: AuthContextType = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    session
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};