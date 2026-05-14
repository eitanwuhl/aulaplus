import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/** Dashboard "anon" / "Publishable" key; placeholder from .env.example is ignored. */
const IGNORED_ANON_PLACEHOLDERS = new Set(['', 'your-anon-key-here', 'replace-me']);

function resolveSupabaseAnonKey(): string {
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const publishable = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  if (anon && !IGNORED_ANON_PLACEHOLDERS.has(anon)) return anon;
  if (publishable) return publishable;
  return anon;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = resolveSupabaseAnonKey();

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

if (!SUPABASE_ANON_KEY || IGNORED_ANON_PLACEHOLDERS.has(SUPABASE_ANON_KEY.trim())) {
  throw new Error(
    'Missing Supabase anon/publishable key. Set VITE_SUPABASE_ANON_KEY (Dashboard → Settings → API) ' +
      'or VITE_SUPABASE_PUBLISHABLE_KEY with the same value. Check your .env at the project root.'
  );
}

// Validate anon key format
// New publishable keys start with "sb_publishable_" and are ~40 chars
// Legacy JWT keys start with "eyJ" and are ~200+ chars
if (import.meta.env.DEV) {
  const isPublishableKey = SUPABASE_ANON_KEY.startsWith('sb_publishable_');
  const isLegacyJWT = SUPABASE_ANON_KEY.startsWith('eyJ');
  
  if (!isPublishableKey && !isLegacyJWT) {
    console.warn(
      '[Supabase Client Warning] VITE_SUPABASE_ANON_KEY format unexpected. ' +
      'Expected format: "sb_publishable_..." (new) or "eyJ..." (legacy JWT). ' +
      'Make sure you are using the "Publishable Key" from Supabase Dashboard → Project Settings → API.'
    );
  } else if (isPublishableKey && SUPABASE_ANON_KEY.length < 30) {
    console.warn(
      '[Supabase Client Warning] VITE_SUPABASE_ANON_KEY seems too short for a publishable key. ' +
      'Expected length: ~40 characters. Verify you copied the complete key.'
    );
  } else if (isLegacyJWT && SUPABASE_ANON_KEY.length < 200) {
    console.warn(
      '[Supabase Client Warning] VITE_SUPABASE_ANON_KEY seems too short for a legacy JWT key. ' +
      'Expected length: ~200+ characters. Verify you copied the complete key.'
    );
  }
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

/** Resolved anon / publishable key (same value passed to createClient). Use for fetch() to Edge Functions. */
export const resolvedSupabaseAnonKey = SUPABASE_ANON_KEY;
