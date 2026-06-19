import { supabase } from '@/integrations/supabase/client';

export type PersistSessionBriefsResult = {
  ok: boolean;
  attempted: number;
  failures: number;
};

export function hasMeaningfulBriefs(arr?: (string | undefined)[]): boolean {
  return Array.isArray(arr) && arr.some((v) => (v ?? '').trim().length > 0);
}

/** Load session_brief values ordered by session `orden` (sparse-safe). */
export async function loadSessionBriefs(
  planificacionId: string
): Promise<(string | undefined)[] | undefined> {
  const { data: sesiones, error } = await supabase
    .from('sesiones_clase')
    .select('session_brief, orden')
    .eq('planificacion_id', planificacionId)
    .order('orden', { ascending: true });

  if (error || !sesiones?.length) return undefined;

  const maxOrden = Math.max(...sesiones.map((s) => s.orden ?? 0).filter((o) => o > 0));
  if (!maxOrden || maxOrden <= 0) return undefined;

  const briefs = Array<string | undefined>(maxOrden).fill(undefined);
  for (const s of sesiones) {
    if ((s.orden ?? 0) > 0) {
      briefs[(s.orden as number) - 1] = s.session_brief ?? undefined;
    }
  }

  return briefs;
}

/** Prefer wizard state when meaningful; otherwise load from DB. */
export async function resolveSessionBriefs(
  planificacionId: string,
  wizardSessionBriefs: (string | undefined)[] | undefined
): Promise<(string | undefined)[] | undefined> {
  if (hasMeaningfulBriefs(wizardSessionBriefs)) return wizardSessionBriefs;
  const dbBriefs = await loadSessionBriefs(planificacionId);
  if (hasMeaningfulBriefs(dbBriefs)) return dbBriefs;
  return undefined;
}

/** Persist sessionBriefs[i] → session with orden = i + 1. */
export async function persistSessionBriefs(
  planificacionId: string,
  sessionBriefs: (string | undefined)[] | undefined
): Promise<PersistSessionBriefsResult> {
  if (!sessionBriefs?.length) {
    return { ok: true, attempted: 0, failures: 0 };
  }

  const { data: sesiones, error } = await supabase
    .from('sesiones_clase')
    .select('id, orden')
    .eq('planificacion_id', planificacionId)
    .order('orden', { ascending: true });

  if (error) return { ok: false, attempted: 0, failures: 0 };
  if (!sesiones?.length) return { ok: true, attempted: 0, failures: 0 };

  const updates = sesiones
    .filter((s) => (s.orden ?? 0) > 0)
    .map((s) => {
      const idx = (s.orden as number) - 1;
      const brief = idx >= 0 && idx < sessionBriefs.length ? sessionBriefs[idx] : undefined;
      return { id: s.id, session_brief: brief?.trim() || null };
    });

  if (!updates.length) return { ok: true, attempted: 0, failures: 0 };

  const results = await Promise.allSettled(
    updates.map((update) =>
      supabase.from('sesiones_clase').update({ session_brief: update.session_brief }).eq('id', update.id)
    )
  );

  const failures = results.filter((r) => r.status === 'rejected').length;
  return { ok: failures === 0, attempted: updates.length, failures };
}
