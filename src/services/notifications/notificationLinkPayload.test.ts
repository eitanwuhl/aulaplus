import { describe, it, expect } from 'vitest';
import { normalizeNotificationLinkPayload } from './notificationLinkTypes';

describe('normalizeNotificationLinkPayload', () => {
  it('allows none', () => {
    expect(normalizeNotificationLinkPayload({ linkTarget: 'none' })).toEqual({ ok: true });
  });

  it('rejects both student and group', () => {
    const r = normalizeNotificationLinkPayload({
      linkTarget: 'student',
      studentId: 1,
      groupId: '1',
    });
    expect(r.ok).toBe(false);
  });

  it('requires student id when link is student', () => {
    const r = normalizeNotificationLinkPayload({ linkTarget: 'student' });
    expect(r.ok).toBe(false);
  });

  it('passes through student id (existence validated by DB FK)', () => {
    const r = normalizeNotificationLinkPayload({ linkTarget: 'student', studentId: 9 });
    expect(r).toEqual({ ok: true, studentId: 9 });
  });

  it('passes through group id (existence validated by DB FK)', () => {
    const r = normalizeNotificationLinkPayload({ linkTarget: 'group', groupId: '1' });
    expect(r).toEqual({ ok: true, groupId: '1' });
  });

  it('requires group id when link is group', () => {
    const r = normalizeNotificationLinkPayload({ linkTarget: 'group', groupId: '  ' });
    expect(r.ok).toBe(false);
  });
});
