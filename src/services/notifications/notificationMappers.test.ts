import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mapRowToDashboardNotification } from './notificationMappers';
import type { DashboardNotificationRow } from './types';

describe('mapRowToDashboardNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseRow: DashboardNotificationRow = {
    id: 'a1000000-0000-4000-8000-000000000001',
    notification_type: 'info',
    title: 'Título',
    message: 'Mensaje',
    created_at: '2026-05-18T11:30:00Z',
    student_id: null,
    group_id: null,
    recipient_user_id: null,
  };

  it('maps notification_type to type', () => {
    const row: DashboardNotificationRow = { ...baseRow, notification_type: 'urgent' };
    expect(mapRowToDashboardNotification(row).type).toBe('urgent');
  });

  it('maps student and group ids to camelCase', () => {
    const row: DashboardNotificationRow = {
      ...baseRow,
      student_id: 9,
      group_id: '1',
    };
    const mapped = mapRowToDashboardNotification(row);
    expect(mapped.studentId).toBe(9);
    expect(mapped.groupId).toBe('1');
  });

  it('formats created_at as relative time in Spanish', () => {
    const mapped = mapRowToDashboardNotification(baseRow);
    expect(mapped.time).toMatch(/hace/i);
  });
});
