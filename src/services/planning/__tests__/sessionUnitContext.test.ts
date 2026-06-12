import { describe, expect, it } from 'vitest';
import { buildUnitContextForSession } from '../sessionUnitContext';
import type { UnidadDidactica } from '@/types/planificacion';

const unit = (partial: Partial<UnidadDidactica> & Pick<UnidadDidactica, 'id'>): UnidadDidactica => ({
  contenido_id: partial.contenido_id ?? partial.id,
  contenido_texto: partial.contenido_texto ?? partial.id,
  competencias_ids: [],
  clases_estimadas: partial.clases_estimadas ?? 1,
  orden: partial.orden ?? 1,
  ...partial,
});

describe('buildUnitContextForSession', () => {
  it('returns fallback when no units', () => {
    expect(buildUnitContextForSession({ unidades: [], orden: 1, totalSlots: 3 })).toEqual({
      unidadId: '',
      contenido: '',
      claseEnUnidad: 1,
      totalClasesUnidad: 1,
    });
  });

  it('returns fallback when orden is missing or invalid', () => {
    const unidades = [unit({ id: 'u1', contenido_texto: 'A' })];
    expect(buildUnitContextForSession({ unidades, orden: 0, totalSlots: 1 }).unidadId).toBe('');
    expect(buildUnitContextForSession({ unidades, orden: undefined, totalSlots: 1 }).unidadId).toBe('');
  });

  it('maps session 1 to first class of first unit', () => {
    const unidades = [unit({ id: 'u1', contenido_texto: 'Intro', clases_estimadas: 2, orden: 1 })];
    const ctx = buildUnitContextForSession({ unidades, orden: 1, totalSlots: 2 });
    expect(ctx).toMatchObject({
      unidadId: 'u1',
      contenido: 'Intro',
      claseEnUnidad: 1,
      totalClasesUnidad: 2,
    });
  });

  it('maps session 2 to second class of same unit', () => {
    const unidades = [unit({ id: 'u1', contenido_texto: 'Intro', clases_estimadas: 2, orden: 1 })];
    const ctx = buildUnitContextForSession({ unidades, orden: 2, totalSlots: 2 });
    expect(ctx.claseEnUnidad).toBe(2);
    expect(ctx.unidadId).toBe('u1');
  });

  it('expands multiple units in order', () => {
    const unidades = [
      unit({ id: 'u1', contenido_texto: 'A', clases_estimadas: 1, orden: 1 }),
      unit({ id: 'u2', contenido_texto: 'B', clases_estimadas: 1, orden: 2 }),
    ];
    const ctx = buildUnitContextForSession({ unidades, orden: 2, totalSlots: 2 });
    expect(ctx.unidadId).toBe('u2');
    expect(ctx.contenido).toBe('B');
  });

  it('marks extra slots when sessions exceed expanded plan', () => {
    const unidades = [unit({ id: 'u1', contenido_texto: 'Solo', clases_estimadas: 1, orden: 1 })];
    const ctx = buildUnitContextForSession({ unidades, orden: 3, totalSlots: 3 });
    expect(ctx.isExtraSlot).toBe(true);
    expect(ctx.unidadId).toBe('u1');
    expect(ctx.claseEnUnidad).toBeGreaterThan(1);
  });

  it('uses clases_estimadas default 1 when invalid', () => {
    const unidades = [unit({ id: 'u1', contenido_texto: 'X', clases_estimadas: 0, orden: 1 })];
    const ctx = buildUnitContextForSession({ unidades, orden: 1, totalSlots: 1 });
    expect(ctx.totalClasesUnidad).toBe(1);
  });

  it('infers totalSlots from expanded plan when not provided', () => {
    const unidades = [
      unit({ id: 'u1', clases_estimadas: 2, orden: 1 }),
      unit({ id: 'u2', clases_estimadas: 1, orden: 2 }),
    ];
    const ctx = buildUnitContextForSession({ unidades, orden: 3, totalSlots: undefined });
    expect(ctx.unidadId).toBe('u2');
  });
});
