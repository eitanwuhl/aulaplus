export const TEACHER_DASHBOARD_PATH = '/teacher-dashboard';

export type TeacherGroupsLocationState = {
  studentId?: number;
  groupId?: string;
  returnTo?: string;
};

export function teacherGroupsNavState(
  target: { studentId: number } | { groupId: string }
): TeacherGroupsLocationState {
  return {
    ...target,
    returnTo: TEACHER_DASHBOARD_PATH,
  };
}

export function isTeacherGroupsReturnToPanel(returnTo?: string): boolean {
  return returnTo === TEACHER_DASHBOARD_PATH;
}

export function teacherGroupsBackLabel(
  returnTo: string | undefined,
  target: 'group' | 'student'
): string {
  if (isTeacherGroupsReturnToPanel(returnTo)) {
    return 'Volver al panel';
  }
  return target === 'student' ? 'Volver al grupo' : 'Volver a grupos';
}
