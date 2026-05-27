import { describe, expect, it } from 'vitest';
import {
  appendInstitutionToPromptText,
  buildInstitutionContextForAI,
  formatInstitutionContextBlock,
  institutionGroupContextExtras,
} from '../buildInstitutionContextForAI';

describe('buildInstitutionContextForAI', () => {
  it('builds labels and group marcos', () => {
    const ctx = buildInstitutionContextForAI({
      schoolName: 'Liceo Demo',
      settings: { idioma_principal: 'Español', periodos_evaluacion: ['trimestres'] },
      activeFrameworks: ['anep_ebi', 'cambridge_lower'],
      groupPrimaryFramework: 'anep_ebi',
      groupSecondaryFramework: 'cambridge_lower',
    });

    expect(ctx.schoolName).toBe('Liceo Demo');
    expect(ctx.activeFrameworkLabels).toContain('ANEP MCN / EBI');
    expect(ctx.groupSecondaryFramework).toBe('Cambridge Lower Secondary');
  });

  it('formats a prompt block', () => {
    const block = formatInstitutionContextBlock({
      schoolName: 'Liceo',
      primaryLanguage: 'Español',
      activeFrameworkLabels: ['ANEP EBI'],
    });
    expect(block).toContain('Institución: Liceo');
    expect(block).toContain('Idioma principal: Español');
  });

  it('extras omit empty institution block', () => {
    expect(institutionGroupContextExtras()).toEqual({});
    expect(institutionGroupContextExtras('line')).toEqual({ institutionContext: 'line' });
  });

  it('appends institution block to prompt text', () => {
    expect(appendInstitutionToPromptText('base', 'Institución: X')).toContain('CONTEXTO INSTITUCIONAL');
    expect(appendInstitutionToPromptText('base', '')).toBe('base');
  });
});
