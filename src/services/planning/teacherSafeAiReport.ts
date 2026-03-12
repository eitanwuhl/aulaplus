type AnyRecord = Record<string, unknown>;

/** Section headings that must NOT appear in teacher-facing narrative (planning report). */
const FORBIDDEN_NARRATIVE_HEADINGS = [
  'Propósito y foco',
  'Secuencia didáctica',
  'Competencias',
  'Evidencia esperada',
  'Materiales y fuentes',
] as const;

/**
 * Strip forbidden section headings and their content from narrative text.
 * Used as guardrail so teacher-facing narrative never shows those sections.
 */
export function stripForbiddenNarrativeSections(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const blocks = text.split(/\n\s*\n/);
  const keep: string[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const isForbidden = FORBIDDEN_NARRATIVE_HEADINGS.some(
      (h) =>
        trimmed.startsWith(`**${h}**`) ||
        trimmed.startsWith(h) ||
        new RegExp(`^\\*\\*${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*`, 'i').test(trimmed) ||
        new RegExp(`^${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s:\\-]`, 'i').test(trimmed)
    );
    if (!isForbidden) keep.push(trimmed);
  }
  return keep.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

const SAFE_REPORT_KEYS = [
  'narrative',
  'report_narrative',
  'inputsUsed',
  'decisions',
  'contentCoverage',
  'competencyDevelopment',
  'teacherRequirementsApplied',
  'standardsCoverage',
  'competenciesOperationalization',
  'sessionsGenerated',
] as const;

/**
 * Keep only teacher-facing planning report fields.
 * Drops assumptions/technical/debug/raw fields so they are never persisted in DB.
 * Applies stripForbiddenNarrativeSections to narrative/report_narrative so forbidden
 * headings never persist or display.
 */
export function sanitizePlanningAiDesignReport(input: unknown): AnyRecord | null {
  if (!input || typeof input !== 'object') return null;
  const source = input as AnyRecord;
  const safe: AnyRecord = {};

  for (const key of SAFE_REPORT_KEYS) {
    if (source[key] !== undefined) {
      safe[key] = source[key];
    }
  }

  if (typeof safe.narrative !== 'string' && typeof safe.report_narrative === 'string') {
    safe.narrative = safe.report_narrative;
  }
  if (typeof safe.report_narrative !== 'string' && typeof safe.narrative === 'string') {
    safe.report_narrative = safe.narrative;
  }

  // Guardrail: strip forbidden section headings from narrative before persist/display
  const rawNarrative = typeof safe.narrative === 'string' ? safe.narrative : (typeof safe.report_narrative === 'string' ? safe.report_narrative : '');
  if (rawNarrative) {
    const cleaned = stripForbiddenNarrativeSections(rawNarrative);
    safe.narrative = cleaned;
    safe.report_narrative = cleaned;
  }

  return Object.keys(safe).length > 0 ? safe : null;
}
