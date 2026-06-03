import { describe, expect, it } from 'vitest';
import { DEFAULT_ANIO_LECTIVO } from '../constants';

describe('annual program constants', () => {
  it('default school year is 2026', () => {
    expect(DEFAULT_ANIO_LECTIVO).toBe(2026);
  });
});
