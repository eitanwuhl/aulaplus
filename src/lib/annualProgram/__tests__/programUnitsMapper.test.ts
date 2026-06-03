import { describe, expect, it } from 'vitest';
import { programUnitsToWizardUnits } from '../programUnitsMapper';
import type { CatalogItemForPlanning, ProgramaUnidad } from '@/types/annualProgram';

const unit = (overrides: Partial<ProgramaUnidad>): ProgramaUnidad => ({
  id: 'u1',
  programa_id: 'p1',
  nombre: 'Unidad A',
  descripcion: null,
  orden: 1,
  fecha_inicio: null,
  fecha_fin: null,
  duracion_semanas: null,
  clases_estimadas: 3,
  estado: 'planificada',
  catalog_item_ids: [],
  competencias_ids: ['c1'],
  metadata: {},
  created_at: '',
  updated_at: '',
  ...overrides,
});

describe('programUnitsToWizardUnits', () => {
  it('sorts by orden and reindexes', () => {
    const result = programUnitsToWizardUnits(
      [unit({ id: 'u2', orden: 2, nombre: 'B' }), unit({ id: 'u1', orden: 1, nombre: 'A' })],
      new Map()
    );
    expect(result.map((r) => r.orden)).toEqual([1, 2]);
    expect(result[0].id).toBe('u1');
  });

  it('uses descripcion when present', () => {
    const result = programUnitsToWizardUnits(
      [unit({ descripcion: '  Tema central  ' })],
      new Map()
    );
    expect(result[0].contenido_texto).toBe('Tema central');
  });

  it('builds texto from catalog names', () => {
    const catalog = new Map<string, CatalogItemForPlanning>([
      [
        'cat-1',
        {
          id: 'cat-1',
          tipo: 'contenido',
          codigo: 'X',
          nombre: 'Contenido ANEP',
          descripcion: null,
          nivel: null,
          materia: 'Historia',
        },
      ],
    ]);
    const result = programUnitsToWizardUnits(
      [unit({ catalog_item_ids: ['cat-1'], nombre: 'Unidad' })],
      catalog
    );
    expect(result[0].contenido_id).toBe('cat-1');
    expect(result[0].contenido_texto).toContain('Contenido ANEP');
  });

  it('falls back to unit id when no catalog', () => {
    const result = programUnitsToWizardUnits([unit({ id: 'only-id' })], new Map());
    expect(result[0].contenido_id).toBe('only-id');
  });

  it('joins multiple catalog labels in contenido_texto', () => {
    const catalog = new Map<string, CatalogItemForPlanning>([
      [
        'cat-1',
        { id: 'cat-1', tipo: 'contenido', codigo: 'A', nombre: 'Primero', descripcion: null, nivel: null, materia: 'H' },
      ],
      [
        'cat-2',
        { id: 'cat-2', tipo: 'contenido', codigo: 'B', nombre: 'Segundo', descripcion: null, nivel: null, materia: 'H' },
      ],
    ]);
    const result = programUnitsToWizardUnits(
      [unit({ catalog_item_ids: ['cat-1', 'cat-2'], nombre: 'Unidad X' })],
      catalog
    );
    expect(result[0].contenido_texto).toContain('Primero');
    expect(result[0].contenido_texto).toContain('Segundo');
  });

  it('preserves competencias and clases_estimadas', () => {
    const result = programUnitsToWizardUnits(
      [unit({ competencias_ids: ['c1', 'c2'], clases_estimadas: 4 })],
      new Map()
    );
    expect(result[0].competencias_ids).toEqual(['c1', 'c2']);
    expect(result[0].clases_estimadas).toBe(4);
  });

  it('returns empty array for no units', () => {
    expect(programUnitsToWizardUnits([], new Map())).toEqual([]);
  });
});
