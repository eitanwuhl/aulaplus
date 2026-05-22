import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/useNotifications';
import { useMarkNotificationAsRead } from '@/hooks/useMarkNotificationAsRead';
import { useCreateBroadcastNotification } from '@/hooks/useCreateBroadcastNotification';
import { useNotificationLinkOptions } from '@/hooks/useNotificationLinkOptions';
import {
  createNotificationFormSchema,
  type CreateNotificationFormData,
} from '@/schemas/createNotificationFormSchema';
import type { DashboardNotification, NotificationLinkTarget, NotificationType } from '@/services/notifications';
import { NotificationCreateForm } from '@/components/dashboard/NotificationCreateForm';
import { NotificationListItem } from '@/components/dashboard/NotificationListItem';
import { notificationAudienceMessage } from '@/components/dashboard/notificationAudienceMessage';
import { teacherGroupsNavState } from '@/lib/navigation/teacherGroupsNavigation';

export function NotificationsPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();

  const userId = session?.user?.id;
  const queryEnabled = location.pathname === '/teacher-dashboard' && Boolean(userId);

  const { data, isLoading, isError, error } = useNotifications({
    userId,
    enabled: queryEnabled,
  });

  const markAsReadMutation = useMarkNotificationAsRead(userId);
  const createNotificationMutation = useCreateBroadcastNotification(userId);
  const linkOptionsQuery = useNotificationLinkOptions(userId, queryEnabled);

  const notifications = data?.notifications ?? [];
  const readIds = useMemo(
    () => new Set(data?.readNotificationIds ?? []),
    [data?.readNotificationIds]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds]
  );

  const form = useForm<CreateNotificationFormData>({
    resolver: zodResolver(createNotificationFormSchema),
    defaultValues: {
      title: '',
      message: '',
      notificationType: 'info' as NotificationType,
      linkTarget: 'none' as NotificationLinkTarget,
      studentId: undefined,
      groupId: '',
    },
  });

  const handleMarkAsRead = (id: string) => {
    if (readIds.has(id) || markAsReadMutation.isPending) return;
    markAsReadMutation.mutate(id, {
      onError: (e) => {
        console.error('[NotificationsPanel] markAsRead', e);
      },
    });
  };

  const onSubmit = (formData: CreateNotificationFormData) => {
    if (!userId) {
      toast({
        variant: 'destructive',
        title: 'No autenticado',
        description: 'Necesitás estar logueado para crear avisos.',
      });
      return;
    }

    const studentId = formData.linkTarget === 'student' ? formData.studentId : undefined;
    const groupId = formData.linkTarget === 'group' ? formData.groupId : undefined;

    createNotificationMutation.mutate(
      {
        notificationType: formData.notificationType,
        title: formData.title,
        message: formData.message,
        studentId,
        groupId,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Aviso creado',
            description: notificationAudienceMessage(formData.linkTarget),
          });
          form.reset();
        },
        onError: (e) => {
          console.error('[NotificationsPanel] create', e);
          toast({
            variant: 'destructive',
            title: 'No se pudo crear el aviso',
            description: e instanceof Error ? e.message : undefined,
          });
        },
      }
    );
  };

  const handleNavigate = (notification: DashboardNotification) => {
    if (notification.studentId != null) {
      navigate('/teacher-groups', {
        state: teacherGroupsNavState({ studentId: notification.studentId }),
      });
      return;
    }
    if (notification.groupId) {
      navigate('/teacher-groups', {
        state: teacherGroupsNavState({ groupId: notification.groupId }),
      });
    }
  };

  const loadErrorMessage = isError && error instanceof Error ? error.message : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Bell className="w-5 h-5 mr-2 text-primary" />
            Notificaciones
          </span>
          {!isLoading && unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} nuevas</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-foreground-subtle">Cargando…</p>}
        {!isLoading && loadErrorMessage && (
          <p className="text-sm text-destructive">{loadErrorMessage}</p>
        )}
        {!isLoading && !loadErrorMessage && notifications.length === 0 && (
          <p className="text-sm text-foreground-subtle">No hay notificaciones.</p>
        )}
        {!isLoading &&
          !loadErrorMessage &&
          notifications.map((notification) => (
            <NotificationListItem
              key={notification.id}
              notification={notification}
              isRead={readIds.has(notification.id)}
              onMarkAsRead={handleMarkAsRead}
              onNavigate={handleNavigate}
            />
          ))}

        <NotificationCreateForm
          form={form}
          onSubmit={onSubmit}
          studentLinkOptions={linkOptionsQuery.data?.students ?? []}
          groupLinkOptions={linkOptionsQuery.data?.groups ?? []}
          linkOptionsLoadFailed={linkOptionsQuery.isError}
          isSubmitting={createNotificationMutation.isPending}
        />
      </CardContent>
    </Card>
  );
}
