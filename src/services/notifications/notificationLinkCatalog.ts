/**
 * Options for linking a dashboard notification to a student or group.
 * Teachers: only assigned courses (public.grupos). Staff: full school catalog (RLS).
 */

import { supabase } from '@/integrations/supabase/client';
import {
  fetchGroupLinkOptions,
  fetchStudentLinkOptions,
} from '@/services/schoolCatalog/schoolCatalog.service';
import { fetchTeacherGroups } from '@/services/teacherGroups/teacherGroups.service';
import type { GroupLinkOption, StudentLinkOption } from './notificationLinkTypes';
import { mapTeacherGroupsToNotificationLinkOptions } from './notificationLinkCatalogMappers';
import { NOTIFICATION_STAFF_ROLES } from './notificationRoles';

export { mapTeacherGroupsToNotificationLinkOptions } from './notificationLinkCatalogMappers';

export async function fetchNotificationLinkOptions(userId: string): Promise<{
  data?: { groups: GroupLinkOption[]; students: StudentLinkOption[] };
  error?: string;
}> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('[notificationLinkCatalog] profile', profileError);
    return { error: 'No se pudo verificar tu perfil.' };
  }

  const role = profile?.role ?? 'teacher';
  const isStaff = NOTIFICATION_STAFF_ROLES.includes(
    role as (typeof NOTIFICATION_STAFF_ROLES)[number]
  );

  if (isStaff) {
    const [groupsRes, studentsRes] = await Promise.all([
      fetchGroupLinkOptions(),
      fetchStudentLinkOptions(),
    ]);
    if (groupsRes.error) return { error: groupsRes.error };
    if (studentsRes.error) return { error: studentsRes.error };
    return {
      data: {
        groups: groupsRes.data ?? [],
        students: studentsRes.data ?? [],
      },
    };
  }

  const teacherGroupsRes = await fetchTeacherGroups(userId);
  if (teacherGroupsRes.error) {
    return { error: teacherGroupsRes.error };
  }

  return {
    data: mapTeacherGroupsToNotificationLinkOptions(teacherGroupsRes.data ?? []),
  };
}
