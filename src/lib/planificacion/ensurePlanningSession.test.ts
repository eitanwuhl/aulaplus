import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockSignIn = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
    },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

vi.mock('@/lib/demoBootstrap', () => ({
  isDemoBootstrapEnabled: vi.fn(() => false),
}));

import { isDemoBootstrapEnabled } from '@/lib/demoBootstrap';
import { ensurePlanningSession } from './ensurePlanningSession';

describe('ensurePlanningSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDemoBootstrapEnabled).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns existing user when session is valid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const result = await ensurePlanningSession();

    expect('user' in result && result.user.id).toBe('u1');
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('requires login in production (no demo bootstrap)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await ensurePlanningSession();

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('iniciar sesión');
    }
  });

  it('bootstraps demo user only when demo mode enabled', async () => {
    vi.mocked(isDemoBootstrapEnabled).mockReturnValue(true);
    mockGetUser
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: 'demo' } }, error: null });
    mockInvoke.mockResolvedValue({ error: null });
    mockSignIn.mockResolvedValue({ error: null });
    vi.useFakeTimers();

    const promise = ensurePlanningSession();
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect('user' in result && result.user.id).toBe('demo');
    expect(mockSignIn).toHaveBeenCalled();
  });
});
