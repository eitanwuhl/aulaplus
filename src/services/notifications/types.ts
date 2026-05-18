import type { Database } from '@/integrations/supabase/types';

export type NotificationType = 'info' | 'urgent';

export type DashboardNotificationRow =
  Database['public']['Tables']['dashboard_notifications']['Row'];

export type DashboardNotificationInsert =
  Database['public']['Tables']['dashboard_notifications']['Insert'];

/** UI-facing notification (camelCase, relative time label). */
export type DashboardNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  studentId?: number;
  groupId?: string;
};

export type DashboardNotificationsSnapshot = {
  notifications: DashboardNotification[];
  readNotificationIds: string[];
};

import type { NotificationLinkTarget } from './notificationLinkTypes';

export type CreateBroadcastNotificationInput = {
  notificationType: NotificationType;
  title: string;
  message: string;
  /** How the notification links on click (at most one target). */
  linkTarget?: NotificationLinkTarget;
  studentId?: number;
  groupId?: string;
};
