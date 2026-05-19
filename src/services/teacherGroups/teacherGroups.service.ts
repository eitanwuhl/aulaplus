/**
 * Teacher-assigned groups (public.grupos) with students from school_students catalog.
 */

import { supabase } from '@/integrations/supabase/client';
import type { TeacherGroup } from '@/types/schoolCatalog';
import {
  mapGrupoRowsToGroups,
  type GrupoRow,
  type SchoolStudentRow,
} from './teacherGroupsMappers';

export async function fetchTeacherGroups(userId: string): Promise<{
  data?: TeacherGroup[];
  error?: string;
}> {
  const { data: grupos, error: gruposError } = await supabase
    .from('grupos')
    .select('id, name, year, section, teacher_sugerencias')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (gruposError) {
    console.error('[teacherGroups] fetch grupos', gruposError);
    return { error: 'No se pudieron cargar tus grupos.' };
  }

  const grupoRows = (grupos ?? []) as GrupoRow[];
  if (grupoRows.length === 0) {
    return { data: [] };
  }

  const groupIds = grupoRows.map((g) => g.id);

  const { data: students, error: studentsError } = await supabase
    .from('school_students')
    .select('id, display_name, perfil, school_group_id, profile_data')
    .in('school_group_id', groupIds)
    .order('display_name', { ascending: true });

  if (studentsError) {
    console.error('[teacherGroups] fetch students', studentsError);
    return { error: 'No se pudieron cargar los alumnos de tus grupos.' };
  }

  const studentsByGroupId = new Map<string, SchoolStudentRow[]>();
  for (const row of (students ?? []) as SchoolStudentRow[]) {
    const list = studentsByGroupId.get(row.school_group_id) ?? [];
    list.push(row);
    studentsByGroupId.set(row.school_group_id, list);
  }

  return {
    data: mapGrupoRowsToGroups(grupoRows, studentsByGroupId),
  };
}
