import type { TeacherGroup } from '@/types/schoolCatalog';
import type { GroupLinkOption, StudentLinkOption } from './notificationLinkTypes';

/** Docente: solo cursos asignados en public.grupos (mismo liceo vía catálogo). */
export function mapTeacherGroupsToNotificationLinkOptions(groups: TeacherGroup[]): {
  groups: GroupLinkOption[];
  students: StudentLinkOption[];
} {
  const groupOptions: GroupLinkOption[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
  }));

  const students: StudentLinkOption[] = [];
  for (const group of groups) {
    for (const student of group.students) {
      students.push({
        id: student.id,
        name: student.name,
        groupName: group.name,
      });
    }
  }
  students.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return { groups: groupOptions, students };
}
