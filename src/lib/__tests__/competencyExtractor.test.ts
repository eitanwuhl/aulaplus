import { describe, expect, it } from 'vitest';
import {
  buildCompetenciasContenidosMap,
  extractCompetenciesFromUnits,
  extractContenidosFromUnits,
} from '../competencyExtractor';
import type { UnidadDidactica } from '@/types/planificacion';

const u = (partial: Partial<UnidadDidactica>): UnidadDidactica => ({
  id: partial.id ?? 'u1',
  contenido_id: partial.contenido_id ?? 'c1',
  contenido_texto: partial.contenido_texto ?? '',
  competencias_ids: partial.competencias_ids ?? [],
  clases_estimadas: 1,
  orden: 1,
  ...partial,
});

describe('competencyExtractor', () => {
  describe('extractCompetenciesFromUnits', () => {
    it('deduplicates preserving order', () => {
      const result = extractCompetenciesFromUnits([
        u({ competencias_ids: ['C1', 'C2'] }),
        u({ id: 'u2', competencias_ids: ['C2', 'C3'] }),
      ]);
      expect(result).toEqual(['C1', 'C2', 'C3']);
    });

    it('handles empty and undefined units', () => {
      expect(extractCompetenciesFromUnits([])).toEqual([]);
      expect(extractCompetenciesFromUnits(undefined as unknown as UnidadDidactica[])).toEqual([]);
    });
  });

  describe('extractContenidosFromUnits', () => {
    it('filters empty strings', () => {
      expect(
        extractContenidosFromUnits([
          u({ contenido_texto: 'Historia' }),
          u({ id: 'u2', contenido_texto: '' }),
          u({ id: 'u3', contenido_texto: 'Geografía' }),
        ])
      ).toEqual(['Historia', 'Geografía']);
    });
  });

  describe('buildCompetenciasContenidosMap', () => {
    it('maps only units with content id and competencies', () => {
      const map = buildCompetenciasContenidosMap([
        u({ contenido_id: 'c1', competencias_ids: ['K1'] }),
        u({ id: 'u2', contenido_id: '', competencias_ids: ['K2'] }),
        u({ id: 'u3', contenido_id: 'c3', competencias_ids: [] }),
      ]);
      expect(map).toEqual({ c1: ['K1'] });
    });

    it('copies competency arrays without mutation', () => {
      const ids = ['K1', 'K2'];
      const map = buildCompetenciasContenidosMap([u({ contenido_id: 'c1', competencias_ids: ids })]);
      ids.push('K3');
      expect(map.c1).toEqual(['K1', 'K2']);
    });
  });
});
