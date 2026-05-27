import { frameworkLabel } from '@/lib/institution/curriculumFrameworks';
import type { CurriculumFramework, InstitutionContextForAI, InstitutionSettings } from '@/types/institution';

export function buildInstitutionContextForAI(input: {
  schoolName: string;
  settings: InstitutionSettings;
  activeFrameworks: CurriculumFramework[];
  groupPrimaryFramework?: CurriculumFramework | null;
  groupSecondaryFramework?: CurriculumFramework | null;
}): InstitutionContextForAI {
  return {
    schoolName: input.schoolName,
    primaryLanguage: input.settings.idioma_principal ?? 'Español',
    activeFrameworkLabels: input.activeFrameworks.map(frameworkLabel),
    groupPrimaryFramework: input.groupPrimaryFramework
      ? frameworkLabel(input.groupPrimaryFramework)
      : undefined,
    groupSecondaryFramework: input.groupSecondaryFramework
      ? frameworkLabel(input.groupSecondaryFramework)
      : undefined,
    evaluationPeriods: input.settings.periodos_evaluacion,
  };
}

export function formatInstitutionContextBlock(ctx: InstitutionContextForAI): string {
  const lines = [
    `Institución: ${ctx.schoolName}`,
    `Idioma principal: ${ctx.primaryLanguage}`,
  ];
  if (ctx.activeFrameworkLabels.length) {
    lines.push(`Marcos activos del liceo: ${ctx.activeFrameworkLabels.join(', ')}`);
  }
  if (ctx.groupPrimaryFramework) {
    lines.push(`Marco principal del curso: ${ctx.groupPrimaryFramework}`);
  }
  if (ctx.groupSecondaryFramework) {
    lines.push(`Marco secundario del curso: ${ctx.groupSecondaryFramework}`);
  }
  if (ctx.evaluationPeriods?.length) {
    lines.push(`Períodos de evaluación: ${ctx.evaluationPeriods.join(', ')}`);
  }
  return lines.join('\n');
}

/** Spread into edge-function `groupContext` payloads when Module 1 data is available. */
export function institutionGroupContextExtras(
  institutionPromptBlock?: string
): { institutionContext?: string } {
  return institutionPromptBlock ? { institutionContext: institutionPromptBlock } : {};
}

/** Append institutional block to free-text prompts (edge functions read `modification` / `additionalContext`). */
export function appendInstitutionToPromptText(
  base: string,
  institutionPromptBlock?: string
): string {
  if (!institutionPromptBlock?.trim()) return base;
  return `${base}\n\n## CONTEXTO INSTITUCIONAL\n${institutionPromptBlock.trim()}`;
}
