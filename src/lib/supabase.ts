// Requires: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// Centralized Supabase client configuration using environment variables only.
// No hardcoded URLs or keys allowed.

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    'Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined'
  );
}

export const supabase = createClient<Database>(url, anon, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
