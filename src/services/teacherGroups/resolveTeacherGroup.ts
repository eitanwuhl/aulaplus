import { resolveGroupInList } from '@/lib/groups/resolveGroupInList';
import type { TeacherGroup } from '@/types/schoolCatalog';
import { getTeacherGroupsCached } from './teacherGroupsCache';
import { schoolStudentToLegacyStudent, teacherGroupToLegacyGroup } from './schoolStudentToLegacyStudent';
import type { Group, Student } from '@/data/mockData';

export async function resolveTeacherGroup(
  grupoIdRaw: unknown,
  verbose = false
): Promise<TeacherGroup | undefined> {
  const groups = await getTeacherGroupsCached();
  return resolveGroupInList(groups, grupoIdRaw, verbose).group;
}

export async function resolveLegacyGroup(grupoIdRaw: unknown, verbose = false): Promise<Group | undefined> {
  const group = await resolveTeacherGroup(grupoIdRaw, verbose);
  return group ? teacherGroupToLegacyGroup(group) : undefined;
}

export async function fetchLegacyStudentsForGroup(grupoIdRaw: unknown): Promise<Student[]> {
  const group = await resolveTeacherGroup(grupoIdRaw, false);
  if (!group) return [];
  return group.students.map(schoolStudentToLegacyStudent);
}
