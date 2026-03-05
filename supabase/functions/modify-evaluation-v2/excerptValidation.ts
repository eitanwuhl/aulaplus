/**
 * Server-side validation for text-based items (e.g. source_analysis).
 * Ensures item.source.content exists and meets minimum length.
 * Threshold: 200 characters (avoids "solo título" excerpts). Documented in 07-material-and-structure-fix.md.
 */
export const MIN_EXCERPT_LENGTH_CHARS = 200;
/** Cap excerpt length to avoid huge dumps; 1–3 paragraphs typically stay under this. */
export const MAX_EXCERPT_LENGTH_CHARS = 3500;

export const ITEM_TYPES_REQUIRING_SOURCE = ['source_analysis'];

type SpecLike = {
  sections?: Array<{
    id?: string;
    items?: Array<{ id?: string; type?: string; source?: { content?: string } }>;
  }>;
};

export function validateExcerpts(spec: SpecLike): {
  failures: Array<{ sectionId: string; itemId: string; itemType: string }>;
  valid: boolean;
} {
  const failures: Array<{ sectionId: string; itemId: string; itemType: string }> = [];
  for (const section of spec.sections || []) {
    const sectionId = section.id || '';
    for (const item of section.items || []) {
      const itemType = (item.type as string) || '';
      if (!ITEM_TYPES_REQUIRING_SOURCE.includes(itemType)) continue;
      const content = item.source?.content;
      const len = typeof content === 'string' ? content.trim().length : 0;
      if (len < MIN_EXCERPT_LENGTH_CHARS) {
        failures.push({ sectionId, itemId: item.id || '', itemType });
      }
    }
  }
  return { failures, valid: failures.length === 0 };
}
