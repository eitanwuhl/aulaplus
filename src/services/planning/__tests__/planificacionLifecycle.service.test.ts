import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const mockUpdateProgramEstado = vi.fn();
vi.mock('@/services/annualProgram', () => ({
  updateProgramEstado: (...args: unknown[]) => mockUpdateProgramEstado(...args),
}));

import { markProgramaEnUsoIfApproved } from '../planificacionLifecycle.service';

describe('markProgramaEnUsoIfApproved', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateProgramEstado.mockResolvedValue({});
    mockMaybeSingle.mockResolvedValue({ data: { estado: 'aprobado' }, error: null });
  });

  it('no-ops when programaId is missing', async () => {
    expect(await markProgramaEnUsoIfApproved(undefined)).toEqual({});
    expect(await markProgramaEnUsoIfApproved(null)).toEqual({});
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('marks programa en_uso when estado is aprobado', async () => {
    const result = await markProgramaEnUsoIfApproved('prog-1');

    expect(result).toEqual({});
    expect(mockFrom).toHaveBeenCalledWith('grupo_programas');
    expect(mockEq).toHaveBeenCalledWith('id', 'prog-1');
    expect(mockUpdateProgramEstado).toHaveBeenCalledWith('prog-1', 'en_uso');
  });

  it('does not update when estado is already en_uso', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { estado: 'en_uso' }, error: null });

    await markProgramaEnUsoIfApproved('prog-1');

    expect(mockUpdateProgramEstado).not.toHaveBeenCalled();
  });

  it('does not update when estado is borrador or en_revision', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { estado: 'borrador' }, error: null });
    await markProgramaEnUsoIfApproved('prog-1');
    expect(mockUpdateProgramEstado).not.toHaveBeenCalled();
  });

  it('returns error from select query', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'RLS denied' } });

    const result = await markProgramaEnUsoIfApproved('prog-1');

    expect(result.error).toBe('RLS denied');
    expect(mockUpdateProgramEstado).not.toHaveBeenCalled();
  });

  it('propagates error from updateProgramEstado', async () => {
    mockUpdateProgramEstado.mockResolvedValue({ error: 'update failed' });

    const result = await markProgramaEnUsoIfApproved('prog-1');

    expect(result.error).toBe('update failed');
  });
});
