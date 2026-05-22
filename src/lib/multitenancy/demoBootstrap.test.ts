import { describe, expect, it } from 'vitest';
import { demoTeacherLoginHints, isDemoTeacherEmail } from '@/lib/demoBootstrap';

describe('demoBootstrap', () => {
  it('detects demo teacher emails', () => {
    expect(isDemoTeacherEmail('demo.teacher@example.com')).toBe(true);
    expect(isDemoTeacherEmail('teacher@school.edu')).toBe(false);
  });

  it('builds teacher hints without throwing', () => {
    expect(demoTeacherLoginHints('seed failed')).toContain('DOC001');
  });
});
