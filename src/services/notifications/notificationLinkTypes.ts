export type NotificationLinkTarget = 'none' | 'student' | 'group';

export type StudentLinkOption = { id: number; name: string; groupName: string };
export type GroupLinkOption = { id: string; name: string };

/** UI/form shape only; existence of ids is enforced by Postgres FK on insert. */
export function normalizeNotificationLinkPayload(input: {
  linkTarget: NotificationLinkTarget;
  studentId?: number;
  groupId?: string;
}): { ok: true; studentId?: number; groupId?: string } | { ok: false; error: string } {
  const { linkTarget } = input;

  if (linkTarget === 'none') {
    if (input.studentId != null || input.groupId) {
      return { ok: false, error: 'Sin enlace no debe indicarse alumno ni grupo.' };
    }
    return { ok: true };
  }

  if (linkTarget === 'student') {
    if (input.groupId) {
      return { ok: false, error: 'Elegí solo enlace a alumno o a grupo, no ambos.' };
    }
    if (input.studentId == null) {
      return { ok: false, error: 'Seleccioná un alumno de la lista.' };
    }
    return { ok: true, studentId: input.studentId };
  }

  if (linkTarget === 'group') {
    if (input.studentId != null) {
      return { ok: false, error: 'Elegí solo enlace a alumno o a grupo, no ambos.' };
    }
    if (!input.groupId?.trim()) {
      return { ok: false, error: 'Seleccioná un grupo de la lista.' };
    }
    return { ok: true, groupId: input.groupId.trim() };
  }

  return { ok: false, error: 'Tipo de enlace inválido.' };
}

export function mapNotificationInsertError(message: string, code?: string): string {
  if (code === '42501') {
    return 'No tenés permiso para publicar este aviso. Tenés que ser docente, dirección o psicopedagogía (perfil en la base). Si es por grupo/alumno, el docente debe tener ese curso asignado en Mis grupos.';
  }
  if (code === '23503') {
    if (message.includes('dashboard_notifications_student_id_fkey')) {
      return 'El alumno seleccionado no existe en el catálogo escolar.';
    }
    if (message.includes('dashboard_notifications_group_id_fkey')) {
      return 'El grupo seleccionado no existe en el catálogo escolar.';
    }
    return 'El alumno o grupo indicado no existe en el catálogo escolar.';
  }
  return message;
}
