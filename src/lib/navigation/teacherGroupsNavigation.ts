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
