import { describe, expect, it } from 'vitest';
import { generateSessionDatesFromSchedule } from './sessionSchedule';

describe('generateSessionDatesFromSchedule', () => {
  it('returns empty when no matching weekdays', () => {
    const dates = generateSessionDatesFromSchedule({
      fecha_inicio: '2026-06-02',
      fecha_fin: '2026-06-04',
      configuracion: [
        { dia: 'viernes', horaInicio: '09:00', horaFin: '10:00', duracionMinutos: 60 },
      ],
    });
    expect(dates).toHaveLength(0);
  });

  it('counts monday sessions in range', () => {
    const dates = generateSessionDatesFromSchedule({
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-06-15',
      configuracion: [
        { dia: 'lunes', horaInicio: '09:00', horaFin: '10:00', duracionMinutos: 60 },
      ],
    });
    expect(dates.length).toBeGreaterThanOrEqual(2);
    for (const d of dates) {
      expect(d.getDay()).toBe(1);
    }
  });

  it('includes multiple configured weekdays', () => {
    const dates = generateSessionDatesFromSchedule({
      fecha_inicio: '2026-06-02',
      fecha_fin: '2026-06-06',
      configuracion: [
        { dia: 'martes', horaInicio: '09:00', horaFin: '10:00', duracionMinutos: 60 },
        { dia: 'jueves', horaInicio: '11:00', horaFin: '12:00', duracionMinutos: 60 },
      ],
    });
    expect(dates.length).toBe(2);
  });

  it('includes single-day range when weekday matches', () => {
    const dates = generateSessionDatesFromSchedule({
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-06-01',
      configuracion: [
        { dia: 'lunes', horaInicio: '09:00', horaFin: '10:00', duracionMinutos: 60 },
      ],
    });
    expect(dates).toHaveLength(1);
  });

  it('returns one fallback slot when expanded plan empty but slots requested', () => {
    const dates = generateSessionDatesFromSchedule({
      fecha_inicio: '2026-06-02',
      fecha_fin: '2026-06-02',
      configuracion: [],
    });
    expect(dates).toHaveLength(0);
  });
});
