import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSchoolMaybeSingle = vi.fn();
const mockFrameworkListResult = {
  data: [{ framework: 'anep_ebi' }],
  error: null,
};
const mockFrameworkFullResult = {
  data: [{ framework: 'anep_ebi', school_id: 'school-1', activo: true }],
  error: null,
};
const mockUpsert = vi.fn();
const mockUpdateEqChain = vi.fn();
const mockUpdateEq = vi.fn(() => ({ eq: mockUpdateEqChain }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'schools') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mockSchoolMaybeSingle }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'school_curriculum_frameworks') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve(mockFrameworkFullResult),
              then: (
                onFulfilled: (v: typeof mockFrameworkListResult) => unknown,
                onRejected?: (e: unknown) => unknown
              ) => Promise.resolve(mockFrameworkListResult).then(onFulfilled, onRejected),
            }),
          }),
          upsert: mockUpsert,
          update: mockUpdate,
        };
      }
      return { select: () => ({ eq: () => ({}) }) };
    },
  },
}));

import {
  fetchInstitutionSnapshot,
  setSchoolFrameworks,
} from '../institution.service';

describe('fetchInstitutionSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSchoolMaybeSingle.mockResolvedValue({
      data: {
        id: 'school-1',
        name: 'Liceo Demo',
        institution_settings: { timezone: 'America/Montevideo' },
        onboarding_completed_at: '2026-01-01',
      },
      error: null,
    });
  });

  it('returns parsed institution snapshot', async () => {
    const result = await fetchInstitutionSnapshot('school-1');
    expect(result.error).toBeUndefined();
    expect(result.data?.schoolName).toBe('Liceo Demo');
    expect(result.data?.onboardingCompleted).toBe(true);
    expect(result.data?.activeFrameworks).toHaveLength(1);
  });

  it('returns error when school missing', async () => {
    mockSchoolMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await fetchInstitutionSnapshot('missing');
    expect(result.error).toContain('no encontrada');
  });
});

describe('setSchoolFrameworks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
    mockUpdateEqChain.mockResolvedValue({ error: null });
    mockUpdateEq.mockImplementation(() => ({ eq: mockUpdateEqChain }));
  });

  it('rejects frameworks without mandatory ANEP', async () => {
    const result = await setSchoolFrameworks('school-1', ['cambridge']);
    expect(result.error).toContain('ANEP');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('upserts new frameworks when valid', async () => {
    const result = await setSchoolFrameworks('school-1', ['anep_ebi', 'cambridge']);
    expect(result.error).toBeUndefined();
    expect(mockUpsert).toHaveBeenCalled();
  });
});
