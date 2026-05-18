export const notificationKeys = {
  all: ['dashboard-notifications'] as const,
  list: (userId: string | undefined) => [...notificationKeys.all, 'list', userId] as const,
};
