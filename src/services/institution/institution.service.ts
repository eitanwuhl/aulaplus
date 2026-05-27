/**
 * Module 1 — institutional configuration API (Supabase).
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  CurriculumFramework,
  GroupFrameworkAssignment,
  InstitutionSettings,
  InstitutionSnapshot,
  SchoolCurriculumFrameworkRow,
} from '@/types/institution';

function parseSettings(raw: unknown): InstitutionSettings {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as InstitutionSettings;
  }
  return {};
}

export async function fetchInstitutionSnapshot(
  schoolId: string
): Promise<{ data?: InstitutionSnapshot; error?: string }> {
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('id, name, institution_settings, onboarding_completed_at')
    .eq('id', schoolId)
    .maybeSingle();

  if (schoolErr) {
    console.error('[institution] fetch school', schoolErr);
    return { error: 'No se pudo cargar la institución.' };
  }
  if (!school) {
    return { error: 'Institución no encontrada.' };
  }

  const { data: frameworks, error: fwErr } = await supabase
    .from('school_curriculum_frameworks')
    .select('*')
    .eq('school_id', schoolId)
    .order('framework');

  if (fwErr) {
    console.error('[institution] fetch frameworks', fwErr);
    return { error: 'No se pudieron cargar los marcos curriculares.' };
  }

  return {
    data: {
      schoolId: school.id,
      schoolName: school.name,
      settings: parseSettings(school.institution_settings),
      onboardingCompleted: Boolean(school.onboarding_completed_at),
      activeFrameworks: (frameworks ?? []) as SchoolCurriculumFrameworkRow[],
    },
  };
}

export async function saveInstitutionSettings(
  schoolId: string,
  settings: InstitutionSettings
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('schools')
    .update({
      institution_settings: settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', schoolId);

  if (error) {
    console.error('[institution] save settings', error);
    return { error: error.message };
  }
  return {};
}

export async function setSchoolFrameworks(
  schoolId: string,
  frameworks: CurriculumFramework[]
): Promise<{ error?: string }> {
  const unique = [...new Set(frameworks)];
  if (!unique.includes('anep_ebi')) {
    return { error: 'ANEP MCN/EBI es obligatorio como marco base.' };
  }

  const { data: existing, error: listErr } = await supabase
    .from('school_curriculum_frameworks')
    .select('framework')
    .eq('school_id', schoolId);

  if (listErr) {
    return { error: listErr.message };
  }

  const existingSet = new Set((existing ?? []).map((r) => r.framework as CurriculumFramework));
  const toAdd = unique.filter((f) => !existingSet.has(f));
  const toDeactivate = [...existingSet].filter((f) => !unique.includes(f));

  for (const fw of toAdd) {
    const { error } = await supabase.from('school_curriculum_frameworks').upsert(
      {
        school_id: schoolId,
        framework: fw,
        activo: true,
        fecha_activacion: new Date().toISOString().slice(0, 10),
        configuracion: {},
        idioma_generacion: fw.startsWith('cambridge') || fw.startsWith('ib_') ? 'en' : 'es',
      },
      { onConflict: 'school_id,framework' }
    );
    if (error) return { error: error.message };
  }

  for (const fw of toDeactivate) {
    const { error } = await supabase
      .from('school_curriculum_frameworks')
      .update({ activo: false })
      .eq('school_id', schoolId)
      .eq('framework', fw);
    if (error) return { error: error.message };
  }

  for (const fw of unique) {
    const { error } = await supabase
      .from('school_curriculum_frameworks')
      .update({ activo: true })
      .eq('school_id', schoolId)
      .eq('framework', fw);
    if (error) return { error: error.message };
  }

  return {};
}

export async function completeInstitutionOnboarding(
  schoolId: string
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('schools')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', schoolId);

  if (error) {
    return { error: error.message };
  }
  return {};
}

export async function fetchGroupFrameworkAssignments(
  schoolId: string
): Promise<{ data?: GroupFrameworkAssignment[]; error?: string }> {
  const { data, error } = await supabase
    .from('school_groups')
    .select('id, name, year, section, primary_framework, secondary_framework')
    .eq('school_id', schoolId)
    .order('name');

  if (error) {
    return { error: error.message };
  }

  return {
    data: (data ?? []).map((row) => ({
      groupId: row.id,
      groupName: row.name,
      year: row.year ?? '',
      section: row.section ?? '',
      primary_framework: row.primary_framework as CurriculumFramework | null,
      secondary_framework: row.secondary_framework as CurriculumFramework | null,
    })),
  };
}

export async function updateGroupFramework(
  schoolId: string,
  groupId: string,
  primary: CurriculumFramework | null,
  secondary: CurriculumFramework | null
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('school_groups')
    .update({
      primary_framework: primary,
      secondary_framework: secondary,
    })
    .eq('school_id', schoolId)
    .eq('id', groupId);

  if (error) {
    return { error: error.message };
  }
  return {};
}

export async function fetchActiveCatalogSummary(): Promise<{
  data?: { framework: CurriculumFramework; nombre: string; itemCount: number }[];
  error?: string;
}> {
  const { data: catalogs, error } = await supabase
    .from('curriculum_catalogs')
    .select('id, framework, nombre')
    .eq('estado', 'activa')
    .is('school_id', null);

  if (error) {
    return { error: error.message };
  }

  const summary: { framework: CurriculumFramework; nombre: string; itemCount: number }[] = [];

  for (const cat of catalogs ?? []) {
    const { count } = await supabase
      .from('curriculum_catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('catalog_id', cat.id);
    summary.push({
      framework: cat.framework as CurriculumFramework,
      nombre: cat.nombre,
      itemCount: count ?? 0,
    });
  }

  return { data: summary };
}
