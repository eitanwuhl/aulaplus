import { supabase } from '@/integrations/supabase/client';
import { updateProgramEstado } from '@/services/annualProgram';

/** When a plan is created from an approved program, mark it en_uso. */
export async function markProgramaEnUsoIfApproved(
  programaId: string | undefined | null
): Promise<{ error?: string }> {
  if (!programaId) return {};

  const { data, error } = await supabase
    .from('grupo_programas')
    .select('estado')
    .eq('id', programaId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (data?.estado === 'aprobado') {
    return updateProgramEstado(programaId, 'en_uso');
  }

  return {};
}
