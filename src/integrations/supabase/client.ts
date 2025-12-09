import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Dev-time diagnostics
if (import.meta.env.DEV) {
  console.log('[Supabase Client] URL:', SUPABASE_URL);
  console.log('[Supabase Client] ANON length:', SUPABASE_ANON_KEY?.length ?? 0);
  console.log('[Supabase Client] ANON prefix:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.substring(0, 12) + '...' : 'undefined');
}

// Validate required environment variables
if (!SUPABASE_URL) {
  throw new Error(
    'Missing VITE_SUPABASE_URL environment variable. Check your .env file at the project root.'
  );
}

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing VITE_SUPABASE_ANON_KEY environment variable. Check your .env file at the project root.'
  );
}

// Validate anon key length (should be a reasonable length for a JWT)
if (import.meta.env.DEV && SUPABASE_ANON_KEY.length < 50) {
  console.warn(
    '[Supabase Client Warning] VITE_SUPABASE_ANON_KEY seems too short. ' +
    'Make sure you are using the "anon public" key from Supabase Dashboard, not the service_role key.'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
