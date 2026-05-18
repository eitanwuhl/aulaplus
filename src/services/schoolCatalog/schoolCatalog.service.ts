/**
 * School group/student catalog (Postgres). Replaces mock lists for notification links and similar flows.
 */

import { supabase } from '@/integrations/supabase/client';
import type { GroupLinkOption, StudentLinkOption } from '@/services/notifications/notificationLinkTypes';

export async function fetchGroupLinkOptions(): Promise<{
  data?: GroupLinkOption[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from('school_groups')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    console.error('[schoolCatalog] fetchGroupLinkOptions', error);
    return { error: 'No se pudieron cargar los grupos.' };
  }

  return {
    data: (data ?? []).map((row) => ({ id: row.id, name: row.name })),
  };
}

export async function fetchStudentLinkOptions(): Promise<{
  data?: StudentLinkOption[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from('school_students')
    .select('id, display_name, school_groups(name)')
    .order('display_name', { ascending: true });

  if (error) {
    console.error('[schoolCatalog] fetchStudentLinkOptions', error);
    return { error: 'No se pudieron cargar los alumnos.' };
  }

  type StudentRow = {
    id: number;
    display_name: string;
    school_groups: { name: string } | { name: string }[] | null;
  };

  return {
    data: ((data ?? []) as StudentRow[]).map((row) => {
      const group = row.school_groups;
      const groupName = Array.isArray(group) ? group[0]?.name : group?.name;
      return {
        id: row.id,
        name: row.display_name,
        groupName: groupName ?? '',
      };
    }),
  };
}
