import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DashboardNotification, DashboardNotificationRow, NotificationType } from './types';

function toNotificationType(value: string): NotificationType {
  return value === 'urgent' ? 'urgent' : 'info';
}

export function mapRowToDashboardNotification(row: DashboardNotificationRow): DashboardNotification {
  return {
    id: row.id,
    type: toNotificationType(row.notification_type),
    title: row.title,
    message: row.message,
    time: formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: es }),
    studentId: row.student_id ?? undefined,
    groupId: row.group_id ?? undefined,
  };
}

export function mapRowsToDashboardNotifications(
  rows: DashboardNotificationRow[]
): DashboardNotification[] {
  return rows.map(mapRowToDashboardNotification);
}
