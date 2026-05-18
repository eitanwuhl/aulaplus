/** Matches public.profiles.role values allowed to publish dashboard notifications (RLS). */
export const NOTIFICATION_PUBLISHER_ROLES = ['teacher', 'direccion', 'psicopedagogico'] as const;

export type NotificationPublisherRole = (typeof NOTIFICATION_PUBLISHER_ROLES)[number];

export const NOTIFICATION_STAFF_ROLES = ['direccion', 'psicopedagogico'] as const;
