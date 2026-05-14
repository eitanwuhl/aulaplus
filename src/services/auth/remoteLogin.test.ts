import { describe, it, expect, vi } from 'vitest';
import { resolveTeacherAuthEmail, verifyStudentLoginRemote, formatRpcError } from './remoteLogin';

function mockSupabase(rpcImpl: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: null }>) {
  return {
    rpc: vi.fn((name: string, args: Record<string, string>) => rpcImpl(name, args)),
  } as any;
}

describe('formatRpcError', () => {
  it('formats Postgrest-like object', () => {
    const s = formatRpcError({
      code: 'PGRST202',
      message: 'Could not find the function',
      details: 'public.get_teacher_login_email',
    });
    expect(s).toContain('PGRST202');
    expect(s).toContain('Could not find');
  });
});

describe('resolveTeacherAuthEmail', () => {
  it('returns normalized email when input contains @', async () => {
    const sb = mockSupabase(async () => ({ data: null, error: null }));
    await expect(resolveTeacherAuthEmail(sb, '  Demo.Teacher@Example.COM ')).resolves.toBe('demo.teacher@example.com');
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it('calls RPC for login codes', async () => {
    const sb = mockSupabase(async (name, args) => {
      expect(name).toBe('get_teacher_login_email');
      expect(args.p_code).toBe('DOC001');
      return { data: 'demo.teacher@example.com', error: null };
    });
    await expect(resolveTeacherAuthEmail(sb, 'DOC001')).resolves.toBe('demo.teacher@example.com');
  });

  it('returns null when RPC returns empty', async () => {
    const sb = mockSupabase(async () => ({ data: null, error: null }));
    await expect(resolveTeacherAuthEmail(sb, 'UNKNOWN')).resolves.toBeNull();
  });
});

describe('verifyStudentLoginRemote', () => {
  it('returns ok false for empty code', async () => {
    const sb = mockSupabase(async () => ({ data: {}, error: null }));
    await expect(verifyStudentLoginRemote(sb, '', 'x')).resolves.toEqual({ ok: false });
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it('parses successful RPC payload', async () => {
    const sb = mockSupabase(async (name, args) => {
      expect(name).toBe('verify_student_login');
      expect(args.p_student_code).toBe('EST2024001');
      expect(args.p_password).toBe('secret');
      return {
        data: { ok: true, student_id: 'uuid-1', display_name: 'Ana' },
        error: null,
      };
    });
    await expect(verifyStudentLoginRemote(sb, 'EST2024001', 'secret')).resolves.toEqual({
      ok: true,
      studentId: 'uuid-1',
      displayName: 'Ana',
    });
  });

  it('returns ok false when RPC says not ok', async () => {
    const sb = mockSupabase(async () => ({ data: { ok: false }, error: null }));
    await expect(verifyStudentLoginRemote(sb, 'EST2024001', 'wrong')).resolves.toEqual({ ok: false });
  });

  it('parses JSON string payload from RPC', async () => {
    const payload = JSON.stringify({ ok: true, student_id: 'uuid-2', display_name: 'Bob' });
    const sb = mockSupabase(async () => ({ data: payload, error: null }));
    await expect(verifyStudentLoginRemote(sb, 'EST2024001', 'secret')).resolves.toEqual({
      ok: true,
      studentId: 'uuid-2',
      displayName: 'Bob',
    });
  });
});
