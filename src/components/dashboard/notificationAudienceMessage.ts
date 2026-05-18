import type { NotificationLinkTarget } from '@/services/notifications';

export function notificationAudienceMessage(linkTarget: NotificationLinkTarget): string {
  if (linkTarget === 'group') {
    return 'Los docentes asignados a ese grupo lo verán en su panel.';
  }
  if (linkTarget === 'student') {
    return 'Los docentes del grupo de ese alumno lo verán en su panel.';
  }
  return 'Lo verán todos los docentes en su panel.';
}
