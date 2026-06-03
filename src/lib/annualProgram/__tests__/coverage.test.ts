import { describe, expect, it } from 'vitest';
import { computeProgramCoverage, filterCoverageCatalogItems } from '../coverage';
import type { CatalogItemForPlanning, ProgramaUnidad } from '@/types/annualProgram';

describe('computeProgramCoverage', () => {
  const catalog: CatalogItemForPlanning[] = [
    { id: 'a', tipo: 'contenido', codigo: 'U1', nombre: 'Uno', descripcion: null, nivel: null, materia: 'Historia' },
    { id: 'b', tipo: 'contenido', codigo: 'U2', nombre: 'Dos', descripcion: null, nivel: null, materia: 'Historia' },
    { id: 'c', tipo: 'materia', codigo: 'M', nombre: 'Mat', descripcion: null, nivel: null, materia: 'Historia' },
  ];

  const baseUnit = (ids: string[]): ProgramaUnidad => ({
    id: 'u1',
    programa_id: 'p1',
    nombre: 'U',
    descripcion: null,
    orden: 1,
    fecha_inicio: null,
    fecha_fin: null,
    duracion_semanas: null,
    clases_estimadas: 2,
    estado: 'planificada',
    catalog_item_ids: ids,
    competencias_ids: [],
    metadata: {},
    created_at: '',
    updated_at: '',
  });

  it('computes percent for contenido items only', () => {
    const cov = computeProgramCoverage(catalog, [baseUnit(['a'])], 'Historia');
    expect(cov.totalCatalogItems).toBe(2);
    expect(cov.assignedCatalogItems).toBe(1);
    expect(cov.percent).toBe(50);
  });

  it('returns 0% when catalog pool empty for materia', () => {
    const cov = computeProgramCoverage(catalog, [baseUnit(['a'])], 'Matemática');
    expect(cov.totalCatalogItems).toBe(0);
    expect(cov.percent).toBe(0);
  });

  it('lists uncovered ids', () => {
    const cov = computeProgramCoverage(catalog, [baseUnit(['a'])], 'Historia');
    expect(cov.uncoveredItemIds).toEqual(['b']);
  });

  it('filters coverage types and materia', () => {
    const filtered = filterCoverageCatalogItems(catalog, 'Historia');
    expect(filtered.map((i) => i.id)).toEqual(['a', 'b']);
    expect(filterCoverageCatalogItems(catalog).map((i) => i.id)).toEqual(['a', 'b']);
  });
});
