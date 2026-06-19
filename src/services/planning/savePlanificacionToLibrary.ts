import { supabase } from '@/integrations/supabase/client';

export type SavePlanificacionResult =
  | { ok: true; nombre: string; savedAt: string }
  | { ok: false; error: string; migrationMissing?: boolean };

function isMigrationMissingError(error: { code?: string; message?: string }): boolean {
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST204' ||
    msg.includes('is_saved') ||
    msg.includes('nombre') ||
    msg.includes('saved_at')
  );
}

/**
 * Explicit save: marks planificacion as is_saved so it appears in Mis Planificaciones.
 */
export async function savePlanificacionToLibrary(input: {
  planificacionId: string;
  nombre: string;
  savedAt?: string;
}): Promise<SavePlanificacionResult> {
  const nombre = input.nombre.trim();
  if (!nombre) {
    return { ok: false, error: 'Ingresá un nombre.' };
  }

  const savedAt = input.savedAt ?? new Date().toISOString();

  const { error } = await supabase
    .from('planificaciones')
    .update({
      nombre,
      is_saved: true,
      saved_at: savedAt,
    } as Record<string, unknown>)
    .eq('id', input.planificacionId);

  if (error) {
    if (isMigrationMissingError(error)) {
      return {
        ok: false,
        migrationMissing: true,
        error:
          "Migración faltante: columnas is_saved/nombre/saved_at. Ejecutá supabase db push.",
      };
    }
    return { ok: false, error: error.message || 'No se pudo guardar la planificación.' };
  }

  return { ok: true, nombre, savedAt };
}
