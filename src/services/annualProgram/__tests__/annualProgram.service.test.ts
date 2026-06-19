import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockFrom = vi.fn((table: string) => {
  if (table === 'grupo_programas') {
    return { select: mockSelect, update: mockUpdate };
  }
  return { select: mockSelect };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { updateProgramEstado } from '../annualProgram.service';

describe('updateProgramEstado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: { estado: 'en_revision', user_id: 'owner-1' }, error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it('rejects invalid transition for teacher owner', async () => {
    const result = await updateProgramEstado('prog-1', 'aprobado', {
      userId: 'owner-1',
      isAdmin: false,
    });
    expect(result.error).toContain('no permitida');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('allows admin to approve from en_revision', async () => {
    const result = await updateProgramEstado('prog-1', 'aprobado', {
      userId: 'admin-1',
      isAdmin: true,
    });
    expect(result.error).toBeUndefined();
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('allows owner to submit borrador to en_revision', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { estado: 'borrador', user_id: 'owner-1' }, error: null });
    const result = await updateProgramEstado('prog-1', 'en_revision', {
      userId: 'owner-1',
      isAdmin: false,
    });
    expect(result.error).toBeUndefined();
  });
});
