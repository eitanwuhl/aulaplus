import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type AppSupabase = SupabaseClient<Database>;

/** PostgrestError and similar are plain objects, not Error — avoid "[object Object]" in UI. */
export function formatRpcError(e: unknown): string {
  if (e == null) return 'Error desconocido';
  if (e instanceof Error) return e.message;
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.code === 'string') parts.push(o.code);
    if (typeof o.message === 'string') parts.push(o.message);
    if (typeof o.details === 'string' && o.details) parts.push(o.details);
    if (typeof o.hint === 'string' && o.hint) parts.push(`Sugerencia: ${o.hint}`);
    if (parts.length) return parts.join(' — ');
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/**
 * Resolves the Supabase Auth email for teacher login.
 * If the input looks like an email, it is returned normalized; otherwise the DB maps login codes (e.g. DOC001).
 */
export async function resolveTeacherAuthEmail(
  supabase: AppSupabase,
  loginCodeOrEmail: string
): Promise<string | null> {
  const trimmed = loginCodeOrEmail.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  const { data, error } = await supabase.rpc('get_teacher_login_email', { p_code: trimmed });
  if (error) throw new Error(formatRpcError(error));
  if (data == null || data === '') return null;
  return String(data).trim().toLowerCase();
}

export type StudentLoginResult =
  | { ok: true; studentId: string; displayName: string }
  | { ok: false };

function parseRpcJsonPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

export async function verifyStudentLoginRemote(
  supabase: AppSupabase,
  studentCode: string,
  password: string
): Promise<StudentLoginResult> {
  const code = studentCode.trim();
  if (!code || !password) {
    return { ok: false };
  }
  const { data, error } = await supabase.rpc('verify_student_login', {
    p_student_code: code,
    p_password: password,
  });
  if (error) throw new Error(formatRpcError(error));
  const row = parseRpcJsonPayload(data);
  if (row?.ok === true && typeof row.student_id === 'string' && row.student_id.length > 0) {
    return {
      ok: true,
      studentId: row.student_id,
      displayName: typeof row.display_name === 'string' && row.display_name ? row.display_name : 'Estudiante',
    };
  }
  return { ok: false };
}
