/**
 * Module 1 — per-student curriculum frameworks (doble titulación).
 */

import { supabase } from '@/integrations/supabase/client';
import type { CurriculumFramework } from '@/types/institution';

export type StudentFrameworkAssignment = {
  studentId: number;
  displayName: string;
  groupId: string;
  groupName: string;
  frameworks: CurriculumFramework[];
};

function parseFrameworks(raw: unknown): CurriculumFramework[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is CurriculumFramework => typeof x === 'string' && x.length > 0
  );
}

export async function fetchStudentFrameworkAssignments(
  schoolId: string
): Promise<{ data?: StudentFrameworkAssignment[]; error?: string }> {
  const { data: students, error: stErr } = await supabase
    .from('school_students')
    .select('id, display_name, school_group_id, student_frameworks')
    .eq('school_id', schoolId)
    .order('display_name');

  if (stErr) return { error: stErr.message };

  const { data: groups, error: gErr } = await supabase
    .from('school_groups')
    .select('id, name')
    .eq('school_id', schoolId);

  if (gErr) return { error: gErr.message };

  const groupNames = new Map((groups ?? []).map((g) => [g.id, g.name]));

  return {
    data: (students ?? []).map((row) => ({
      studentId: row.id,
      displayName: row.display_name,
      groupId: row.school_group_id,
      groupName: groupNames.get(row.school_group_id) ?? row.school_group_id,
      frameworks: parseFrameworks(row.student_frameworks),
    })),
  };
}

export async function updateStudentFrameworks(
  schoolId: string,
  studentId: number,
  frameworks: CurriculumFramework[]
): Promise<{ error?: string }> {
  const unique = [...new Set(frameworks)];

  const { error } = await supabase
    .from('school_students')
    .update({ student_frameworks: unique })
    .eq('school_id', schoolId)
    .eq('id', studentId);

  if (error) return { error: error.message };
  return {};
}
