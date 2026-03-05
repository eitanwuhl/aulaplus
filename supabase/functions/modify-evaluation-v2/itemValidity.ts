/**
 * Deterministic validation and degradation for item type requirements.
 * Ensures ordering/matching have display lists, MC has enough options, source_analysis has non-leaking excerpt.
 * Documented in 25-item-validity-guardrails.md.
 */

export type InvalidItem = {
  sectionId: string;
  itemId: string;
  type: string;
  reason: string;
};

export type ItemValidityResult = {
  invalid: InvalidItem[];
  countsByType: Record<string, number>;
};

/** Extract display text from ordering item (string or { id, text }) */
function getOrderingTexts(item: { itemsToOrder?: string[] | Array<{ id: string; text: string }> }): string[] {
  const raw = item.itemsToOrder;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((x) => (typeof x === 'string' ? x : (x as { text?: string }).text ?? '')).filter((t) => t.trim().length > 0);
}

/** Extract display text from left column */
function getLeftColumnTexts(item: { leftColumn?: string[] | Array<{ id: string; text: string }> }): string[] {
  const raw = item.leftColumn;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((x) => (typeof x === 'string' ? x : (x as { text?: string }).text ?? '')).filter((t) => t.trim().length > 0);
}

/** Extract display text from right column */
function getRightColumnTexts(item: { rightColumn?: string[] | Array<{ id: string; text: string }> }): string[] {
  const raw = item.rightColumn;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((x) => (typeof x === 'string' ? x : (x as { text?: string }).text ?? '')).filter((t) => t.trim().length > 0);
}

/** Phrases that suggest abstract/summary/answer-leaking (excerpt gives away the answer). Spanish. */
const ANSWER_LEAK_PATTERNS = [
  /\ben este (trabajo|artículo|texto|documento)\s+(se\s+)?analiza\b/i,
  /\bse examinan?\s+(las\s+)?(características|ideas|conceptos)\b/i,
  /\bse (presentan?|describen?|resumen?)\s+(las\s+)?(ideas\s+)?principales\b/i,
  /\blas?\s+ideas?\s+principales?\s+(son|incluyen|son\s+las?)\b/i,
  /\b(incluye|consiste\s+en|trata\s+de)\s+(el\s+)?(análisis|estudio|examen)\s+de\b/i,
  /\b(en\s+)?(este\s+)?(trabajo|artículo)\s+(se\s+)?(demuestra|concluye|muestra)\b/i,
  /\b(resumen|abstract|resumen\s+ejecutivo)\s*[.:]/i,
  /\bel\s+objetivo\s+(de\s+este\s+)?(trabajo|artículo)\s+es\b/i,
  /\b(en\s+)?conclusión\s*,?\s+(se\s+)?(observa|concluye)\b/i,
  /\bse\s+analizan?\s+las?\s+consecuencias\b/i,
  /\b(las\s+)?políticas?\s+(económicas?|sociales?)\s+(del\s+)?batllismo\s+(fueron|incluyeron|consistieron)\b/i,
];

const MIN_ORDERING_ELEMENTS = 2;
const MIN_MATCHING_COLUMN_SIZE = 2;
const MIN_MC_OPTIONS = 3;
const MIN_EXCERPT_LENGTH = 200;

/**
 * Returns true if the excerpt looks like an abstract or summary that gives away the expected answer.
 */
export function isAnswerLeakingExcerpt(content: string | undefined): boolean {
  if (!content || typeof content !== 'string') return false;
  const text = content.trim();
  if (text.length < MIN_EXCERPT_LENGTH) return false;
  const lower = text.toLowerCase();
  const matchCount = ANSWER_LEAK_PATTERNS.filter((p) => p.test(lower)).length;
  return matchCount >= 1;
}

type ItemLike = {
  id?: string;
  type?: string;
  options?: Array<{ id?: string; text?: string }>;
  leftColumn?: string[] | Array<{ id: string; text: string }>;
  rightColumn?: string[] | Array<{ id: string; text: string }>;
  itemsToOrder?: string[] | Array<{ id: string; text: string }>;
  source?: { content?: string };
};

type SpecLike = {
  sections?: Array<{ id?: string; items?: ItemLike[] }>;
};

/**
 * Validate a single item by type. Returns { valid: false, reason } when invalid.
 */
export function validateItem(item: ItemLike | undefined, sectionId: string): { valid: boolean; reason?: string } {
  if (!item || typeof item !== 'object') return { valid: true };
  const type = (item.type as string) || '';
  const itemId = (item.id as string) || '';

  if (type === 'ordering') {
    const texts = getOrderingTexts(item);
    if (texts.length < MIN_ORDERING_ELEMENTS) {
      return { valid: false, reason: `ordering requires at least ${MIN_ORDERING_ELEMENTS} elements with display text; got ${texts.length}` };
    }
    return { valid: true };
  }

  if (type === 'matching') {
    const left = getLeftColumnTexts(item);
    const right = getRightColumnTexts(item);
    if (left.length < MIN_MATCHING_COLUMN_SIZE || right.length < MIN_MATCHING_COLUMN_SIZE) {
      return {
        valid: false,
        reason: `matching requires left and right columns with at least ${MIN_MATCHING_COLUMN_SIZE} items each; got left=${left.length}, right=${right.length}`,
      };
    }
    return { valid: true };
  }

  if (type === 'multiple_choice') {
    const options = Array.isArray(item.options) ? item.options : [];
    const withText = options.filter((o) => typeof o?.text === 'string' && (o.text as string).trim().length > 0);
    if (withText.length < MIN_MC_OPTIONS) {
      return { valid: false, reason: `multiple_choice requires at least ${MIN_MC_OPTIONS} options with display text; got ${withText.length}` };
    }
    return { valid: true };
  }

  if (type === 'source_analysis') {
    const src = item.source;
    const content = typeof src?.content === 'string' ? src.content.trim() : '';
    if (content.length < MIN_EXCERPT_LENGTH) {
      return { valid: false, reason: `source_analysis requires source.content with at least ${MIN_EXCERPT_LENGTH} characters; got ${content.length}` };
    }
    if (isAnswerLeakingExcerpt(content)) {
      return { valid: false, reason: 'source_analysis excerpt appears to be answer-leaking (abstract/summary style)' };
    }
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Scan spec and return all invalid items plus counts by type.
 */
export function validateSpecItems(spec: SpecLike): ItemValidityResult {
  const invalid: InvalidItem[] = [];
  const countsByType: Record<string, number> = {};

  for (const section of spec.sections || []) {
    const sectionId = (section.id as string) || '';
    for (const item of section.items || []) {
      const type = (item.type as string) || '';
      countsByType[type] = (countsByType[type] || 0) + 1;
      const { valid, reason } = validateItem(item, sectionId);
      if (!valid && reason) {
        invalid.push({
          sectionId,
          itemId: (item.id as string) || '',
          type,
          reason,
        });
      }
    }
  }
  return { invalid, countsByType };
}

/**
 * Map item type to fallback type for degradation (when repair fails).
 * ordering -> short_answer, matching -> paragraph; others stay or map to short_answer.
 */
export function getDegradationType(itemType: string): 'short_answer' | 'paragraph' {
  if (itemType === 'matching') return 'paragraph';
  return 'short_answer';
}
