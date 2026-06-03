import { describe, expect, it } from 'vitest';
import { compareIsoDates, parseLocalDate, toIsoDateLocal, todayLocal } from './localDate';

describe('localDate', () => {
  it('parseLocalDate preserves calendar day in local timezone', () => {
    const d = parseLocalDate('2026-06-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(1);
  });

  it('round-trips through toIsoDateLocal', () => {
    const iso = '2026-06-15';
    expect(toIsoDateLocal(parseLocalDate(iso))).toBe(iso);
  });

  it('compareIsoDates orders chronologically', () => {
    expect(compareIsoDates('2026-06-01', '2026-06-02')).toBeLessThan(0);
    expect(compareIsoDates('2026-06-10', '2026-06-10')).toBe(0);
    expect(compareIsoDates('2026-07-01', '2026-06-01')).toBeGreaterThan(0);
  });

  it('todayLocal returns midnight', () => {
    const t = todayLocal();
    expect(t.getHours()).toBe(0);
    expect(t.getMinutes()).toBe(0);
  });
});
