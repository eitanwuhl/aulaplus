import type { NotificationLinkTarget } from '@/services/notifications';

export function notificationAudienceMessage(linkTarget: NotificationLinkTarget): string {
  if (linkTarget === 'group') {
    return 'Solo los docentes de tu liceo asignados a ese grupo lo verán.';
  }
  if (linkTarget === 'student') {
    return 'Solo los docentes de tu liceo del curso de ese alumno lo verán.';
  }
  return 'Lo verán todos los docentes y funcionarios de tu liceo (no otros colegios).';
}
