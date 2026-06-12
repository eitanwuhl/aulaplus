import { AuthRequiredError, invokeEdgeFunctionAuthed } from '@/lib/edgeFunctionAuth';

export type GeneratePlanCompletoResponse = {
  plan_html?: string;
  argumento_competencias?: string;
  recursos?: string[];
  titulo?: string;
  ai_design_report?: unknown;
  error?: string;
  error_code?: string;
  error_field?: string;
};

/**
 * Invokes generate-plan-completo with a valid JWT session and optional timeout.
 */
export async function invokeGeneratePlanCompleto(
  body: Record<string, unknown>,
  options?: { timeoutMs?: number }
): Promise<{ data: GeneratePlanCompletoResponse | null; error: Error | null }> {
  const timeoutMs = options?.timeoutMs ?? 120_000;

  try {
    const invokePromise = invokeEdgeFunctionAuthed<GeneratePlanCompletoResponse>(
      'generate-plan-completo',
      { body }
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Timeout después de ${timeoutMs / 1000} segundos`)),
        timeoutMs
      );
    });

    const result = (await Promise.race([invokePromise, timeoutPromise])) as Awaited<
      ReturnType<typeof invokeEdgeFunctionAuthed<GeneratePlanCompletoResponse>>
    >;

    if (result.error) {
      const msg = result.error.message || 'Error al invocar generate-plan-completo';
      return { data: null, error: new Error(msg) };
    }

    return { data: result.data, error: null };
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return { data: null, error: e };
    }
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}
