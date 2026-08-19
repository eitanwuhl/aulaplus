export const DURATION_MINUTES_BY_ITEM_TYPE: Record<string, number> = {
  multiple_choice: 2,
  true_false: 1,
  true_false_justify: 4,
  short_answer: 4,
  paragraph: 9,
  essay: 14,
  source_analysis: 14,
  table_completion: 5,
  matching: 5,
  ordering: 5,
};

export const DEFAULT_MINUTES_PER_ITEM = 5;
export const SECTION_OVERHEAD_MINUTES = 1;

type DurationSpecLike = {
  sections?: Array<{
    id?: string;
    title?: string;
    items?: Array<{ type?: string }>;
  }>;
};

export type DurationBreakdownSection = {
  sectionId: string;
  itemType: string;
  estimatedMinutes: number;
  description: string;
  itemCount: number;
};

export type DurationBreakdown = {
  sections: DurationBreakdownSection[];
  heuristicAssumptions: string;
  totalEstimatedMinutes?: number;
};

/**
 * Deterministic estimate of total duration (minutes) from a V2-like spec.
 * Sums per-item estimates by type plus section overhead.
 */
export function estimateDurationFromSpec(spec: DurationSpecLike): number {
  let total = 0;
  for (const section of spec.sections || []) {
    total += SECTION_OVERHEAD_MINUTES;
    for (const item of section.items || []) {
      const t = item.type as string;
      total += DURATION_MINUTES_BY_ITEM_TYPE[t] ?? DEFAULT_MINUTES_PER_ITEM;
    }
  }
  return Math.max(0, total);
}

/**
 * Build per-section duration breakdown using the same deterministic heuristic.
 */
export function buildDurationBreakdownFromSpec(spec: DurationSpecLike): DurationBreakdown {
  const sections: DurationBreakdownSection[] = [];
  let totalEstimatedMinutes = 0;

  for (const section of spec.sections || []) {
    let sectionMinutes = SECTION_OVERHEAD_MINUTES;
    let itemCount = 0;
    for (const item of section.items || []) {
      itemCount += 1;
      const t = item.type as string;
      sectionMinutes += DURATION_MINUTES_BY_ITEM_TYPE[t] ?? DEFAULT_MINUTES_PER_ITEM;
    }
    totalEstimatedMinutes += sectionMinutes;
    sections.push({
      sectionId: section.id || `section-${sections.length + 1}`,
      itemType: section.title || `Sección ${sections.length + 1}`,
      estimatedMinutes: sectionMinutes,
      description: `${itemCount} ítems + ${SECTION_OVERHEAD_MINUTES} min de sobrecarga de sección`,
      itemCount,
    });
  }

  return {
    sections,
    heuristicAssumptions:
      `Estimación heurística por tipo de ítem (MC=2, VF=1, VF+just=4, corta=4, párrafo=9, ensayo=14, fuente=14, tabla=5, relacionar=5, ordenar=5, default=${DEFAULT_MINUTES_PER_ITEM}) + ${SECTION_OVERHEAD_MINUTES} min por sección.`,
    totalEstimatedMinutes,
  };
}

/** Minutes needed to add (heuristic) to reach at least targetLow. Used for extend prompt. */
export function computeDeltaMinutesNeeded(currentEstimate: number, targetLow: number): number {
  const delta = targetLow - currentEstimate;
  return Math.max(0, Math.ceil(delta));
}

/** Human-readable heuristic table for LLM prompts (Spanish). Estimate = sum over item types + section overhead, NOT word count. */
export function formatHeuristicTableForPrompt(): string {
  const lines = [
    "multiple_choice: 2 min por ítem",
    "true_false: 1 min por ítem",
    "true_false_justify: 4 min por ítem",
    "short_answer: 4 min por ítem",
    "paragraph: 9 min por ítem",
    "essay: 14 min por ítem",
    "source_analysis: 14 min por ítem",
    "table_completion: 5 min por ítem",
    "matching: 5 min por ítem",
    "ordering: 5 min por ítem",
    `cualquier otro tipo: ${DEFAULT_MINUTES_PER_ITEM} min por ítem`,
    `sobrecarga por sección: ${SECTION_OVERHEAD_MINUTES} min por sección`,
  ];
  return lines.join("\n");
}
