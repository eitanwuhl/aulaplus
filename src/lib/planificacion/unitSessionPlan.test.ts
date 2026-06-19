import { describe, expect, it } from 'vitest';
import { expandUnitsToSessionPlan, mapSessionsToUnits } from './unitSessionPlan';
import type { UnidadDidactica } from '@/types/planificacion';

const unit = (overrides: Partial<UnidadDidactica>): UnidadDidactica => ({
  id: 'u1',
  contenido_id: 'c1',
  contenido_texto: 'Tema A',
  competencias_ids: ['comp-1'],
  clases_estimadas: 2,
  orden: 1,
  ...overrides,
});

describe('unitSessionPlan', () => {
  it('expands clases_estimadas into slots', () => {
    const expanded = expandUnitsToSessionPlan([unit({ clases_estimadas: 3 })]);
    expect(expanded).toHaveLength(3);
    expect(expanded[0].claseEnUnidad).toBe(1);
    expect(expanded[2].claseEnUnidad).toBe(3);
    expect(expanded[0].competencias_ids).toEqual(['comp-1']);
  });

  it('defaults invalid clases_estimadas to 1', () => {
    expect(expandUnitsToSessionPlan([unit({ clases_estimadas: 0 })])).toHaveLength(1);
  });

  it('maps extra sessions to last unit with isExtraSlot', () => {
    const expanded = expandUnitsToSessionPlan([unit({ clases_estimadas: 1 })]);
    const mapped = mapSessionsToUnits(3, expanded);
    expect(mapped).toHaveLength(3);
    expect(mapped[2].isExtraSlot).toBe(true);
    expect(mapped[2].claseEnUnidad).toBe(3);
  });

  it('uses fallback contenido when plan empty', () => {
    const mapped = mapSessionsToUnits(2, [], { fallbackContenido: 'Genérico' });
    expect(mapped[0].contenido_texto).toBe('Genérico');
  });

  it('truncates when more slots than sessions', () => {
    const expanded = expandUnitsToSessionPlan([
      unit({ id: 'a', clases_estimadas: 1 }),
      unit({ id: 'b', clases_estimadas: 1 }),
    ]);
    expect(mapSessionsToUnits(1, expanded)).toHaveLength(1);
    expect(mapSessionsToUnits(1, expanded)[0].unidadId).toBe('a');
  });
});
