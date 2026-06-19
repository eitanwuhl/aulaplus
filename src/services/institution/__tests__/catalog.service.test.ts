import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockEqChain = vi.fn();
const mockEq = vi.fn(() => {
  const chain = {
    maybeSingle: mockMaybeSingle,
    eq: mockEqChain,
  };
  mockEqChain.mockImplementation(() => chain);
  return chain;
});
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockInsertSingle = vi.fn();
const mockInsert = vi.fn(() => ({ select: () => ({ single: mockInsertSingle }) }));
const mockFrom = vi.fn((table: string) => {
  if (table === 'curriculum_catalogs') {
    return { select: () => ({ eq: mockEq }), update: mockUpdate, insert: mockInsert };
  }
  if (table === 'school_curriculum_frameworks') {
    return { update: mockUpdate };
  }
  if (table === 'curriculum_catalog_items') {
    return { insert: mockInsert };
  }
  return { select: () => ({ eq: mockEq }) };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { activateCatalogVersion, importCatalogItemsFromCsv } from '../catalog.service';

describe('activateCatalogVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cat-1', framework: 'cambridge', school_id: 'school-1', estado: 'borrador' },
      error: null,
    });
    mockEq.mockImplementation(() => ({
      maybeSingle: mockMaybeSingle,
      eq: mockEqChain,
    }));
    mockEqChain.mockImplementation(() => ({
      maybeSingle: mockMaybeSingle,
      eq: mockEqChain,
    }));
    mockUpdateEq.mockResolvedValue({ error: null });
    mockUpdate.mockImplementation(() => ({ eq: mockEq }));
  });

  it('rejects activation when catalog belongs to another school', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cat-1', framework: 'cambridge', school_id: 'other-school', estado: 'borrador' },
      error: null,
    });

    const result = await activateCatalogVersion('school-1', 'cat-1');
    expect(result.error).toContain('propios del liceo');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('activates own draft catalog', async () => {
    const result = await activateCatalogVersion('school-1', 'cat-1');
    expect(result.error).toBeUndefined();
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe('importCatalogItemsFromCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cat-1', estado: 'borrador', school_id: 'school-1' },
      error: null,
    });
    mockInsertSingle.mockResolvedValue({ data: { id: 'item-1' }, error: null });
  });

  it('rejects import when catalog is not borrador', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'cat-1', estado: 'activa', school_id: 'school-1' },
      error: null,
    });

    const result = await importCatalogItemsFromCsv('cat-1', [
      {
        tipo: 'contenido',
        codigo: 'U1',
        nombre: 'Unidad 1',
        descripcion: null,
        nivel: null,
        materia: 'Historia',
        parent_codigo: null,
        orden: 1,
      },
    ]);

    expect(result.imported).toBe(0);
    expect(result.error).toContain('borrador');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('imports rows into borrador catalog', async () => {
    const result = await importCatalogItemsFromCsv('cat-1', [
      {
        tipo: 'contenido',
        codigo: 'U1',
        nombre: 'Unidad 1',
        descripcion: null,
        nivel: null,
        materia: 'Historia',
        parent_codigo: null,
        orden: 1,
      },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.imported).toBe(1);
    expect(mockInsert).toHaveBeenCalled();
  });
});
