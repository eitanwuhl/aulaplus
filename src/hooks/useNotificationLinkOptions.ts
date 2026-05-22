import { useQuery } from '@tanstack/react-query';
import { fetchNotificationLinkOptions } from '@/services/notifications/notificationLinkCatalog';

export const notificationLinkOptionsKey = ['notification-link-options'] as const;

export function useNotificationLinkOptions(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...notificationLinkOptionsKey, userId],
    enabled: enabled && Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const result = await fetchNotificationLinkOptions(userId!);
      if (result.error) throw new Error(result.error);
      return {
        groups: result.data?.groups ?? [],
        students: result.data?.students ?? [],
      };
    },
  });
}
