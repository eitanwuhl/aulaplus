import { AlertTriangle, Bell, Calendar, Check, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DashboardNotification } from '@/services/notifications';

type NotificationListItemProps = {
  notification: DashboardNotification;
  isRead: boolean;
  onMarkAsRead: (id: string) => void;
  onNavigate: (notification: DashboardNotification) => void;
};

export function NotificationListItem({
  notification,
  isRead,
  onMarkAsRead,
  onNavigate,
}: NotificationListItemProps) {
  const clickable = Boolean(
    notification.studentId != null || (notification.groupId && notification.groupId.length > 0)
  );

  const Icon =
    notification.studentId != null
      ? User
      : notification.groupId
        ? Calendar
        : notification.type === 'urgent'
          ? AlertTriangle
          : Bell;

  return (
    <div
      className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
        isRead ? 'opacity-65 bg-muted/20' : 'hover:bg-card-hover'
      } ${clickable ? 'cursor-pointer' : ''}`}
      onClick={clickable ? () => onNavigate(notification) : undefined}
    >
      <div
        className={`p-2 rounded-full ${
          notification.type === 'urgent'
            ? 'bg-warning-100 text-warning'
            : 'bg-primary-100 text-primary'
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <h4 className="text-sm font-medium">{notification.title}</h4>
          <div className="flex items-center gap-2">
            {notification.type === 'urgent' && <Badge variant="destructive">Urgente</Badge>}
            {isRead && (
              <Badge variant="secondary" className="whitespace-nowrap">
                Leida
              </Badge>
            )}
          </div>
        </div>

        <p className="text-sm text-foreground-subtle">{notification.message}</p>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-foreground-subtle">{notification.time}</p>
          <button
            type="button"
            className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onMarkAsRead(notification.id);
            }}
          >
            <Check className="w-3.5 h-3.5" />
            Marcar como leido
          </button>
        </div>
      </div>
    </div>
  );
}
