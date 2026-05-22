/**
 * Dashboard notifications — Supabase access layer.
 * Tables: dashboard_notifications, dashboard_notification_reads (RLS).
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  CreateBroadcastNotificationInput,
  DashboardNotificationsSnapshot,
  DashboardNotificationRow,
} from './types';
import { mapRowsToDashboardNotifications } from './notificationMappers';
import {
  mapNotificationInsertError,
  normalizeNotificationLinkPayload,
  type NotificationLinkTarget,
} from './notificationLinkTypes';

const NOTIFICATIONS_LIMIT = 50;

async function resolveAuthenticatedUserId(): Promise<{ userId: string } | { error: string }> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('[notifications] getSession', sessionError);
    return { error: sessionError.message };
  }

  const userId = session?.user?.id;
  if (!userId) {
    return { error: 'Usuario no autenticado' };
  }

  return { userId };
}

export async function fetchDashboardNotifications(): Promise<{
  data?: DashboardNotificationsSnapshot;
  error?: string;
}> {
  try {
    const auth = await resolveAuthenticatedUserId();
    if ('error' in auth) {
      return { error: auth.error };
    }

    const { userId } = auth;

    const [notificationsRes, readsRes] = await Promise.all([
      supabase
        .from('dashboard_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(NOTIFICATIONS_LIMIT),
      supabase
        .from('dashboard_notification_reads')
        .select('notification_id')
        .eq('user_id', userId),
    ]);

    if (notificationsRes.error) {
      console.error('[notifications] list', notificationsRes.error);
      return { error: 'No se pudieron cargar las notificaciones.' };
    }

    if (readsRes.error) {
      console.error('[notifications] reads', readsRes.error);
      return { error: 'No se pudo cargar el estado de lectura de las notificaciones.' };
    }

    const rows = (notificationsRes.data ?? []) as DashboardNotificationRow[];
    const readNotificationIds = (readsRes.data ?? []).map((r) => r.notification_id);

    return {
      data: {
        notifications: mapRowsToDashboardNotifications(rows),
        readNotificationIds,
      },
    };
  } catch (e) {
    console.error('[notifications] fetchDashboardNotifications', e);
    return { error: 'Error inesperado al cargar notificaciones.' };
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<{ error?: string }> {
  return markNotificationsAsRead([notificationId]);
}

export async function markNotificationsAsRead(
  notificationIds: string[]
): Promise<{ error?: string }> {
  const uniqueIds = [...new Set(notificationIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return {};
  }

  try {
    const auth = await resolveAuthenticatedUserId();
    if ('error' in auth) {
      return { error: auth.error };
    }

    const rows = uniqueIds.map((notification_id) => ({
      notification_id,
      user_id: auth.userId,
    }));

    const { error } = await supabase
      .from('dashboard_notification_reads')
      .upsert(rows, { onConflict: 'notification_id,user_id' });

    if (error) {
      console.error('[notifications] markNotificationsAsRead', error);
      return { error: error.message };
    }

    return {};
  } catch (e) {
    console.error('[notifications] markNotificationsAsRead', e);
    return { error: 'Error inesperado al marcar como leídas.' };
  }
}

export async function createBroadcastNotification(
  input: CreateBroadcastNotificationInput & { linkTarget?: NotificationLinkTarget }
): Promise<{ error?: string }> {
  try {
    const linkTarget: NotificationLinkTarget =
      input.linkTarget ??
      (input.studentId != null ? 'student' : input.groupId ? 'group' : 'none');

    const targetCheck = normalizeNotificationLinkPayload({
      linkTarget,
      studentId: input.studentId,
      groupId: input.groupId,
    });
    if (targetCheck.ok === false) {
      return { error: targetCheck.error };
    }

    const auth = await resolveAuthenticatedUserId();
    if ('error' in auth) {
      return { error: auth.error };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (profileError) {
      console.error('[notifications] profile school_id', profileError);
      return { error: 'No se pudo verificar el liceo del docente.' };
    }

    const schoolId = profile?.school_id;
    if (!schoolId) {
      return {
        error:
          'Tu perfil no tiene un liceo asignado. No se puede publicar el aviso.',
      };
    }

    const groupId = targetCheck.groupId?.trim();

    if (targetCheck.studentId != null) {
      const { data: studentRow, error: studentErr } = await supabase
        .from('school_students')
        .select('id, school_id')
        .eq('id', targetCheck.studentId)
        .eq('school_id', schoolId)
        .maybeSingle();
      if (studentErr || !studentRow) {
        return { error: 'El alumno no pertenece a tu liceo.' };
      }
    }

    if (groupId) {
      const { data: groupRow, error: groupErr } = await supabase
        .from('school_groups')
        .select('id, school_id')
        .eq('id', groupId)
        .eq('school_id', schoolId)
        .maybeSingle();
      if (groupErr || !groupRow) {
        return { error: 'El grupo no pertenece a tu liceo.' };
      }
    }

    const { error } = await supabase.from('dashboard_notifications').insert({
      notification_type: input.notificationType,
      title: input.title,
      message: input.message,
      recipient_user_id: null,
      student_id: targetCheck.studentId ?? null,
      group_id: groupId ? groupId : null,
      school_id: schoolId,
    });

    if (error) {
      console.error('[notifications] createBroadcast', error);
      return { error: mapNotificationInsertError(error.message, error.code) };
    }

    return {};
  } catch (e) {
    console.error('[notifications] createBroadcastNotification', e);
    return { error: 'Error inesperado al crear el aviso.' };
  }
}
