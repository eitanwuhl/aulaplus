import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

import { hasMeaningfulBriefs } from './sessionBriefPersistence';

describe('sessionBriefPersistence', () => {
  it('hasMeaningfulBriefs detects non-empty trimmed strings', () => {
    expect(hasMeaningfulBriefs(['', '  ', 'Tema real'])).toBe(true);
    expect(hasMeaningfulBriefs(['', undefined])).toBe(false);
    expect(hasMeaningfulBriefs(undefined)).toBe(false);
  });
});
