type AnyRecord = Record<string, unknown>;

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

  return Object.keys(safe).length > 0 ? safe : null;
}
