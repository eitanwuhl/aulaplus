export {
  fetchDashboardNotifications,
  markNotificationAsRead,
  markNotificationsAsRead,
  createBroadcastNotification,
} from './notifications.service';

export { mapRowToDashboardNotification, mapRowsToDashboardNotifications } from './notificationMappers';

export {
  mapNotificationInsertError,
  normalizeNotificationLinkPayload,
  type GroupLinkOption,
  type NotificationLinkTarget,
  type StudentLinkOption,
} from './notificationLinkTypes';

export {
  createNotificationFormSchema,
  type CreateNotificationFormData,
} from '@/schemas/createNotificationFormSchema';

export type {
  CreateBroadcastNotificationInput,
  DashboardNotification,
  DashboardNotificationRow,
  DashboardNotificationsSnapshot,
  NotificationType,
} from './types';
