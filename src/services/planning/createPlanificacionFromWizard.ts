import { supabase } from '@/integrations/supabase/client';
import { buildPlanificacionInsertPayload } from '@/lib/planificacion/buildPlanificacionInsert';
import { buildSesionesInsertFromWizard } from '@/lib/planificacion/buildSesionesInsert';
import { deriveNivelFromGroupYear } from '@/lib/planificacion/deriveNivelFromGroup';
import { persistSessionBriefs } from '@/lib/planificacion/sessionBriefPersistence';
import { markProgramaEnUsoIfApproved } from '@/services/planning/planificacionLifecycle.service';
import type { WizardData } from '@/types/planificacion';

export type CreatePlanificacionResult =
  | {
      ok: true;
      planificacionId: string;
      materia: string;
      nivel: string;
      sesionesMode: 'backlog' | 'calendario';
      sesionesCount: number;
      briefPersist: { ok: boolean; attempted: number; failures: number };
    }
  | { ok: false; error: string };

/**
 * Creates planificacion + sesiones from validated wizard data (no AI batch).
 */
export async function createPlanificacionFromWizard(input: {
  userId: string;
  schoolId?: string;
  wizardData: WizardData;
}): Promise<CreatePlanificacionResult> {
  const { userId, schoolId, wizardData } = input;

  let nivel = 'CB';
  if (schoolId && wizardData.contexto?.grupo_id) {
    const { data: groupRow } = await supabase
      .from('school_groups')
      .select('year')
      .eq('school_id', schoolId)
      .eq('id', wizardData.contexto.grupo_id)
      .maybeSingle();
    nivel = deriveNivelFromGroupYear(groupRow?.year);
  }

  const insertPayload = buildPlanificacionInsertPayload({ userId, wizardData, nivel });

  const { data: planificacion, error: planError } = await supabase
    .from('planificaciones')
    .insert(insertPayload)
    .select()
    .maybeSingle();

  if (planError) {
    if (planError.code === 'PGRST204' || planError.message.includes('is_saved')) {
      return {
        ok: false,
        error:
          "Migración faltante: la columna 'is_saved' no existe en planificaciones. Ejecutá supabase db push.",
      };
    }
    return { ok: false, error: planError.message || 'Error al crear la planificación.' };
  }

  if (!planificacion) {
    return { ok: false, error: 'No se pudo crear la planificación.' };
  }

  if (wizardData.programa_id) {
    await markProgramaEnUsoIfApproved(wizardData.programa_id);
  }

  const { mode: sesionesMode, rows: sesionesInsert } = buildSesionesInsertFromWizard(
    planificacion.id,
    wizardData
  );

  const { error: sesionesError } = await supabase.from('sesiones_clase').insert(sesionesInsert);
  if (sesionesError) {
    return { ok: false, error: sesionesError.message || 'Error al crear las sesiones.' };
  }

  const briefPersist = await persistSessionBriefs(
    planificacion.id,
    wizardData.enfoque?.sessionBriefs
  );

  return {
    ok: true,
    planificacionId: planificacion.id,
    materia: String(insertPayload.materia ?? wizardData.contexto?.materia ?? 'Sin especificar'),
    nivel,
    sesionesMode,
    sesionesCount: sesionesInsert.length,
    briefPersist,
  };
}
