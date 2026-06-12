import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInvokeEdgeFunctionAuthed, AuthRequiredError } = vi.hoisted(() => {
  class AuthRequiredError extends Error {
    code = 'AUTH_REQUIRED';
    constructor(message = 'No hay sesión válida') {
      super(message);
      this.name = 'AuthRequiredError';
    }
  }
  return {
    AuthRequiredError,
    mockInvokeEdgeFunctionAuthed: vi.fn(),
  };
});

vi.mock('@/lib/edgeFunctionAuth', () => ({
  AuthRequiredError,
  invokeEdgeFunctionAuthed: (...args: unknown[]) => mockInvokeEdgeFunctionAuthed(...args),
}));

import { invokeGeneratePlanCompleto } from '../generatePlanCompleto';

describe('invokeGeneratePlanCompleto', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInvokeEdgeFunctionAuthed.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns data on successful edge invocation', async () => {
    mockInvokeEdgeFunctionAuthed.mockResolvedValue({
      data: {
        plan_html: '<section id="plan"><h1>T</h1></section>',
        titulo: 'Clase de prueba',
        recursos: ['pizarra'],
      },
      error: null,
    });

    const result = await invokeGeneratePlanCompleto({ grupo_id: '1', materia: 'Historia' });

    expect(result.error).toBeNull();
    expect(result.data?.titulo).toBe('Clase de prueba');
    expect(mockInvokeEdgeFunctionAuthed).toHaveBeenCalledWith('generate-plan-completo', {
      body: { grupo_id: '1', materia: 'Historia' },
    });
  });

  it('returns error when edge responds with error', async () => {
    mockInvokeEdgeFunctionAuthed.mockResolvedValue({
      data: null,
      error: { message: 'OpenAI rate limit' },
    });

    const result = await invokeGeneratePlanCompleto({});

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('OpenAI rate limit');
  });

  it('returns AuthRequiredError without wrapping', async () => {
    mockInvokeEdgeFunctionAuthed.mockRejectedValue(new AuthRequiredError());

    const result = await invokeGeneratePlanCompleto({});

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(AuthRequiredError);
    expect(result.error?.message).toContain('sesión');
  });

  it('times out when invocation exceeds timeoutMs', async () => {
    mockInvokeEdgeFunctionAuthed.mockImplementation(
      () => new Promise(() => {
        /* never resolves */
      })
    );

    const promise = invokeGeneratePlanCompleto({}, { timeoutMs: 5_000 });
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await promise;

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('Timeout');
  });
});
