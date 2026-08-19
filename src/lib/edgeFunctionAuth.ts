/**
 * Edge Function auth helper.
 * Ensures a valid Supabase session before invoking edge functions that require JWT.
 * Does NOT perform login; session recovery (e.g. demo re-login) is handled by AuthContext only.
 */

import { supabase } from '@/integrations/supabase/client';
import type { FunctionsHttpError } from '@supabase/supabase-js';

/** Error thrown when no valid session is available (caller or AuthContext should handle). */
export const AUTH_REQUIRED_CODE = 'AUTH_REQUIRED';

export class AuthRequiredError extends Error {
  code = AUTH_REQUIRED_CODE;
  constructor(message = 'No hay sesión válida. Iniciá sesión o actualizá la página.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

/** Returns true if the JWT access token is expired or expires within the given margin (seconds). */
function isAccessTokenExpiredOrExpiringSoon(accessToken: string, marginSeconds = 60): boolean {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    const exp = payload.exp as number | undefined;
    if (!exp) return true;
    return exp * 1000 <= Date.now() + marginSeconds * 1000;
  } catch {
    return true;
  }
}

/**
 * Ensures the Supabase client has a valid session for edge function calls.
 * - Gets current session.
 * - If no session or no access_token, returns false (no sign-in; AuthContext is responsible for demo login).
 * - If session exists, refreshes only when the access token is expired or expiring soon (reduces unnecessary refresh).
 * - If refresh fails (e.g. invalid refresh token), signs out and returns false.
 * Does NOT call signInWithPassword; credentials stay in AuthContext only.
 */
export async function ensureValidSession(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return false;
  }

  const needsRefresh = isAccessTokenExpiredOrExpiringSoon(session.access_token);
  if (!needsRefresh) {
    return true;
  }

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (!refreshError) {
    const { data: { session: after } } = await supabase.auth.getSession();
    if (after?.access_token) return true;
  }

  await supabase.auth.signOut();
  return false;
}

export type InvokeEdgeFunctionOptions = {
  body?: object;
};

/**
 * Invokes a Supabase Edge Function with a valid session.
 * If there is no valid session after ensureValidSession (and optional refresh/signOut),
 * throws AuthRequiredError (AUTH_REQUIRED). AuthContext listens for SIGNED_OUT and can
 * re-establish demo session so the next user action succeeds.
 */
export async function invokeEdgeFunctionAuthed<T = unknown>(
  name: string,
  options?: InvokeEdgeFunctionOptions
): Promise<{ data: T | null; error: FunctionsHttpError | null }> {
  const valid = await ensureValidSession();
  if (!valid) {
    throw new AuthRequiredError();
  }
  const result = await supabase.functions.invoke(name, options);
  return {
    data: result.data as T | null,
    error: result.error,
  };
}
