export const teacherGroupKeys = {
  all: ['teacher-groups'] as const,
  list: (userId: string | undefined) => [...teacherGroupKeys.all, userId] as const,
};
