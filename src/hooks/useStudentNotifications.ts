import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationKeys } from '@/hooks/notifications/notificationKeys';
import {
  markNotificationAsRead,
  markNotificationsAsRead,
} from '@/services/notifications';
import type { DashboardNotification } from '@/services/notifications';

export function useStudentNotifications(studentId: number) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useNotifications({
    userId,
    enabled: Boolean(userId),
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const result = await markNotificationAsRead(notificationId);
      if (result.error) throw new Error(result.error);
      return notificationId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (notificationIds.length === 0) return;
      const result = await markNotificationsAsRead(notificationIds);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
    },
  });

  const notifications = useMemo((): DashboardNotification[] => {
    if (!data) return [];
    const readIds = new Set(data.readNotificationIds);
    return data.notifications.filter(
      (n) => n.studentId === studentId && !readIds.has(n.id)
    );
  }, [data, studentId]);

  const markAsRead = useCallback(
    (notificationId: string) => {
      markAsReadMutation.mutate(notificationId);
    },
    [markAsReadMutation]
  );

  const markAllAsRead = useCallback(() => {
    const ids = notifications.map((n) => n.id);
    if (ids.length > 0) {
      markAllAsReadMutation.mutate(ids);
    }
  }, [notifications, markAllAsReadMutation]);

  const isMarking = markAsReadMutation.isPending || markAllAsReadMutation.isPending;

  return {
    notifications,
    isLoading,
    isError,
    error: error instanceof Error ? error.message : undefined,
    markAsRead,
    markAllAsRead,
    isMarking,
  };
}
