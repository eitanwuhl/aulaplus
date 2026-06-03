/**
 * Module 2 — annual program (planificador macro) API.
 */

import { supabase } from '@/integrations/supabase/client';
import { frameworkLabel } from '@/lib/institution/curriculumFrameworks';
import type { CurriculumFramework } from '@/types/institution';
import type {
  CatalogItemForPlanning,
  GrupoPrograma,
  ProgramaEstado,
  ProgramaUnidad,
  ProgramaUnidadEstado,
} from '@/types/annualProgram';
import { canTransitionProgramEstado } from '@/lib/annualProgram/annualProgramWorkflow';
import { DEFAULT_ANIO_LECTIVO } from '@/lib/annualProgram/constants';

const COVERAGE_ITEM_TYPES = ['contenido', 'progresion', 'learning_objective', 'materia', 'tramo'];

export async function fetchCatalogItemsForProgram(input: {
  schoolId: string;
  framework: CurriculumFramework;
  materia?: string;
}): Promise<{ data?: CatalogItemForPlanning[]; error?: string }> {
  const { data: fwRow, error: fwErr } = await supabase
    .from('school_curriculum_frameworks')
    .select('catalog_id')
    .eq('school_id', input.schoolId)
    .eq('framework', input.framework)
    .eq('activo', true)
    .maybeSingle();

  if (fwErr) return { error: fwErr.message };

  let catalogId = fwRow?.catalog_id as string | null;

  if (!catalogId) {
    const { data: globalCat } = await supabase
      .from('curriculum_catalogs')
      .select('id')
      .eq('framework', input.framework)
      .is('school_id', null)
      .eq('estado', 'activa')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    catalogId = globalCat?.id ?? null;
  }

  if (!catalogId) {
    return { data: [] };
  }

  const { data: items, error } = await supabase
    .from('curriculum_catalog_items')
    .select('id, tipo, codigo, nombre, descripcion, nivel, materia')
    .eq('catalog_id', catalogId)
    .in('tipo', COVERAGE_ITEM_TYPES)
    .order('orden');

  if (error) return { error: error.message };

  let filtered = (items ?? []) as CatalogItemForPlanning[];
  if (input.materia?.trim()) {
    const m = input.materia.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.materia?.toLowerCase().includes(m) ||
        m.includes(item.materia?.toLowerCase() ?? '') ||
        item.nombre.toLowerCase().includes(m)
    );
  }

  return { data: filtered };
}

export async function fetchTeacherPrograms(userId: string): Promise<{
  data?: GrupoPrograma[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from('grupo_programas')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) return { error: error.message };
  return { data: (data ?? []) as GrupoPrograma[] };
}

export async function fetchSchoolPrograms(
  schoolId: string,
  options?: { estados?: ProgramaEstado[]; anioLectivo?: number }
): Promise<{ data?: GrupoPrograma[]; error?: string }> {
  let query = supabase
    .from('grupo_programas')
    .select('*')
    .eq('school_id', schoolId)
    .order('updated_at', { ascending: false });

  if (options?.estados?.length) {
    query = query.in('estado', options.estados);
  }
  if (options?.anioLectivo != null) {
    query = query.eq('anio_lectivo', options.anioLectivo);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };
  return { data: (data ?? []) as GrupoPrograma[] };
}

export async function fetchProgramById(programaId: string): Promise<{
  data?: GrupoPrograma;
  error?: string;
}> {
  const { data: program, error: pErr } = await supabase
    .from('grupo_programas')
    .select('*')
    .eq('id', programaId)
    .maybeSingle();

  if (pErr || !program) {
    return { error: pErr?.message ?? 'Programa no encontrado.' };
  }

  const { data: unidades, error: uErr } = await supabase
    .from('programa_unidades')
    .select('*')
    .eq('programa_id', programaId)
    .order('orden');

  if (uErr) return { error: uErr.message };

  return {
    data: {
      ...(program as GrupoPrograma),
      unidades: (unidades ?? []) as ProgramaUnidad[],
    },
  };
}

export async function findProgramForGroupSubject(input: {
  userId: string;
  grupoId: string;
  materia: string;
  anioLectivo?: number;
}): Promise<{ data?: GrupoPrograma | null; error?: string }> {
  const year = input.anioLectivo ?? DEFAULT_ANIO_LECTIVO;
  const { data, error } = await supabase
    .from('grupo_programas')
    .select('*')
    .eq('user_id', input.userId)
    .eq('grupo_id', input.grupoId)
    .eq('materia', input.materia)
    .eq('anio_lectivo', year)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { data: null };

  const full = await fetchProgramById(data.id as string);
  return { data: full.data ?? null, error: full.error };
}

export async function createProgram(input: {
  schoolId: string;
  grupoId: string;
  materia: string;
  userId: string;
  marcoPlanificacion: CurriculumFramework;
  nombre?: string;
}): Promise<{ data?: GrupoPrograma; error?: string }> {
  const nombre =
    input.nombre?.trim() ||
    `${input.materia} — ${frameworkLabel(input.marcoPlanificacion)}`;

  const { data, error } = await supabase
    .from('grupo_programas')
    .insert({
      school_id: input.schoolId,
      grupo_id: input.grupoId,
      materia: input.materia,
      user_id: input.userId,
      anio_lectivo: DEFAULT_ANIO_LECTIVO,
      marco_planificacion: input.marcoPlanificacion,
      nombre,
      estado: 'borrador',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        error:
          'Ya existe un programa para este grupo, materia y año lectivo. Abrí el existente desde la lista.',
      };
    }
    return { error: error.message };
  }
  return { data: { ...(data as GrupoPrograma), unidades: [] } };
}

export async function updateProgramEstado(
  programaId: string,
  estado: ProgramaEstado,
  actor?: { userId: string; isAdmin: boolean }
): Promise<{ error?: string }> {
  if (actor) {
    const { data: current, error: fetchErr } = await supabase
      .from('grupo_programas')
      .select('estado, user_id')
      .eq('id', programaId)
      .maybeSingle();

    if (fetchErr) return { error: fetchErr.message };
    if (!current) return { error: 'Programa no encontrado.' };

    const isOwner = current.user_id === actor.userId;
    if (
      !canTransitionProgramEstado(current.estado as ProgramaEstado, estado, {
        isOwner,
        isAdmin: actor.isAdmin,
      })
    ) {
      return { error: 'Transición de estado no permitida.' };
    }
  }

  const { error } = await supabase
    .from('grupo_programas')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', programaId);

  if (error) return { error: error.message };
  return {};
}

export async function upsertProgramUnit(input: {
  programaId: string;
  unit?: Partial<ProgramaUnidad> & { id?: string };
}): Promise<{ data?: ProgramaUnidad; error?: string }> {
  const payload = {
    programa_id: input.programaId,
    nombre: input.unit?.nombre?.trim() || 'Unidad sin título',
    descripcion: input.unit?.descripcion ?? null,
    orden: input.unit?.orden ?? 0,
    fecha_inicio: input.unit?.fecha_inicio ?? null,
    fecha_fin: input.unit?.fecha_fin ?? null,
    duracion_semanas: input.unit?.duracion_semanas ?? null,
    clases_estimadas: Math.max(1, input.unit?.clases_estimadas ?? 1),
    estado: (input.unit?.estado ?? 'planificada') as ProgramaUnidadEstado,
    catalog_item_ids: input.unit?.catalog_item_ids ?? [],
    competencias_ids: input.unit?.competencias_ids ?? [],
    metadata: input.unit?.metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  if (input.unit?.id) {
    const { data, error } = await supabase
      .from('programa_unidades')
      .update(payload)
      .eq('id', input.unit.id)
      .select()
      .single();
    if (error) return { error: error.message };
    return { data: data as ProgramaUnidad };
  }

  const { data, error } = await supabase
    .from('programa_unidades')
    .insert(payload)
    .select()
    .single();

  if (error) return { error: error.message };
  await supabase
    .from('grupo_programas')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.programaId);

  return { data: data as ProgramaUnidad };
}

export async function deleteProgramUnit(unitId: string, programaId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('programa_unidades').delete().eq('id', unitId);
  if (error) return { error: error.message };
  await supabase
    .from('grupo_programas')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', programaId);
  return {};
}

export async function resolveGroupFramework(
  schoolId: string,
  grupoId: string
): Promise<{ framework: CurriculumFramework; error?: string }> {
  const { data, error } = await supabase
    .from('school_groups')
    .select('primary_framework')
    .eq('school_id', schoolId)
    .eq('id', grupoId)
    .maybeSingle();

  if (error) return { framework: 'anep_ebi', error: error.message };
  return {
    framework: (data?.primary_framework as CurriculumFramework) ?? 'anep_ebi',
  };
}

export { programUnitsToWizardUnits } from '@/lib/annualProgram/programUnitsMapper';
