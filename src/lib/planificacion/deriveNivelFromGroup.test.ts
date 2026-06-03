import { describe, expect, it } from 'vitest';
import { deriveNivelFromGroupYear } from './deriveNivelFromGroup';

describe('deriveNivelFromGroupYear', () => {
  it('extracts digit from CB year label', () => {
    expect(deriveNivelFromGroupYear('9º Año')).toBe('9');
    expect(deriveNivelFromGroupYear('8vo')).toBe('8');
  });

  it('falls back for empty or unknown labels', () => {
    expect(deriveNivelFromGroupYear('')).toBe('CB');
    expect(deriveNivelFromGroupYear(null)).toBe('CB');
    expect(deriveNivelFromGroupYear('Bachillerato')).toBe('EMS');
  });

  it('maps non-numeric institutional labels', () => {
    expect(deriveNivelFromGroupYear('Educación Inicial')).toBe('inicial');
    expect(deriveNivelFromGroupYear('Primaria 4°')).toBe('4');
  });
});
