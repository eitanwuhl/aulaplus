import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
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
        
        // Create or update profile silently in background when authenticated
        if (session?.user) {
          setTimeout(() => {
            supabase.from('profiles').upsert({
              user_id: session.user.id,
              display_name: 'Profesor Demo',
              role: 'teacher'
            }).then(() => {
              console.log('Profile updated silently');
            });
          }, 0);
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

  const login = async (role: UserRole, credentials: { username: string; password: string }): Promise<boolean> => {
    // Simple validation - any non-empty credentials are accepted for demo
    if (!credentials.username.trim() || !credentials.password.trim()) {
      return false;
    }

    // Ensure Supabase is authenticated in background
    if (!session) {
      await ensureSupabaseAuth();
    }

    // Create mock user for frontend (same as before)
    let newUser: User;
    
    if (role === 'teacher') {
      // Random teacher name for demo
      const randomName = teacherNames[Math.floor(Math.random() * teacherNames.length)];
      newUser = {
        id: session?.user?.id || `teacher_${Date.now()}`,
        role: 'teacher',
        name: randomName
      };
    } else {
      newUser = {
        id: session?.user?.id || `student_${credentials.username}`,
        role: 'student', 
        name: `Estudiante ${credentials.username}`,
        username: credentials.username
      };
    }

    setUser(newUser);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    return true;
  };

  const logout = async (): Promise<void> => {
    setUser(null);
    localStorage.removeItem('auth_user');
    // Keep Supabase session active for seamless demo experience
  };

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, session }}>
      {children}
    </AuthContext.Provider>
  );
};