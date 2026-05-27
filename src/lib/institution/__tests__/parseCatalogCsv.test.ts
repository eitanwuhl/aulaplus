import { describe, expect, it } from 'vitest';
import { compareCatalogVersions, parseCatalogCsv } from '../parseCatalogCsv';

describe('parseCatalogCsv', () => {
  it('parses header and rows', () => {
    const csv = `tipo,nombre,codigo,orden
learning_objective,Understand forces,LO-1,1
strand,Forces strand,ST-1,2`;

    const { rows, errors } = parseCatalogCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].nombre).toBe('Understand forces');
    expect(rows[0].tipo).toBe('learning_objective');
  });

  it('rejects missing required columns', () => {
    const { rows, errors } = parseCatalogCsv('codigo,solo\nx,1');
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/tipo/i);
  });
});

describe('compareCatalogVersions', () => {
  it('orders semantic versions', () => {
    expect(compareCatalogVersions('2026.2', '2026.1')).toBeGreaterThan(0);
    expect(compareCatalogVersions('1.0', '1.0.1')).toBeLessThan(0);
  });
});
