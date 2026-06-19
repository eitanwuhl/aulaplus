import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockFrom = vi.fn(() => ({ update: mockUpdate }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { savePlanificacionToLibrary } from '../savePlanificacionToLibrary';

describe('savePlanificacionToLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it('rejects empty nombre', async () => {
    const result = await savePlanificacionToLibrary({
      planificacionId: 'plan-1',
      nombre: '   ',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('nombre');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('marks planificacion as saved', async () => {
    const result = await savePlanificacionToLibrary({
      planificacionId: 'plan-1',
      nombre: 'Historia 9A',
      savedAt: '2026-06-02T12:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nombre).toBe('Historia 9A');
      expect(result.savedAt).toBe('2026-06-02T12:00:00.000Z');
    }
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_saved: true, nombre: 'Historia 9A' })
    );
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'plan-1');
  });

  it('detects missing migration columns', async () => {
    mockUpdateEq.mockResolvedValue({ error: { code: 'PGRST204', message: 'is_saved' } });
    const result = await savePlanificacionToLibrary({
      planificacionId: 'plan-1',
      nombre: 'Test',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.migrationMissing).toBe(true);
      expect(result.error).toContain('db push');
    }
  });
});
