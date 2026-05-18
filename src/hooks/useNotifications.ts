/**
 * React Query hook for teacher dashboard notifications.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchDashboardNotifications } from '@/services/notifications';
import { notificationKeys } from '@/hooks/notifications/notificationKeys';

export function useNotifications(options: {
  userId: string | undefined;
  enabled?: boolean;
}) {
  const { userId, enabled = true } = options;

  return useQuery({
    queryKey: notificationKeys.list(userId),
    queryFn: async () => {
      const result = await fetchDashboardNotifications();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data ?? { notifications: [], readNotificationIds: [] };
    },
    enabled: enabled && Boolean(userId),
    staleTime: 30 * 1000,
  });
}
