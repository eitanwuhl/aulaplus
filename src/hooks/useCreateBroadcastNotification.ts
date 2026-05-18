/**
 * Mutation: create a broadcast dashboard notification (recipient_user_id NULL).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createBroadcastNotification,
  type CreateBroadcastNotificationInput,
} from '@/services/notifications';
import { notificationKeys } from '@/hooks/notifications/notificationKeys';

export function useCreateBroadcastNotification(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBroadcastNotificationInput) => {
      const result = await createBroadcastNotification(input);
      if (result.error) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
    },
  });
}
