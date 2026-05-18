/**
 * Mutation: mark a dashboard notification as read for the current user.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markNotificationAsRead } from '@/services/notifications';
import { notificationKeys } from '@/hooks/notifications/notificationKeys';

export function useMarkNotificationAsRead(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await markNotificationAsRead(notificationId);
      if (result.error) {
        throw new Error(result.error);
      }
      return notificationId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
    },
  });
}
