/**
 * Formats equivalent response options as a single exam-style Spanish sentence
 * for inline use inside the question prompt (student handout).
 * Natural, human wording (Uruguay/neutral Spanish); no UI-like headings or bullets.
 */

export interface ResponseOptionLike {
  format?: string;
  description?: string;
}

/** Options wrapper that may include metacognitionText (e.g. "Elegí el formato que mejor te ayude..."). */
export interface ResponseOptionsWithMetacognition {
  enabled?: boolean;
  options?: ResponseOptionLike[];
  metacognitionText?: string;
}

const MAX_OPTIONS_TO_MENTION = 3;
const MORE_THAN_THREE_SUFFIX = ' (u otra forma equivalente acordada con el docente)';

/**
 * Returns a natural Spanish sentence for 2–3 options; if more than 3, uses best 3 + suffix.
 * - 1 option: "Puedes responder con un texto breve."
 * - 2 options: "Puedes responder con un texto breve o con un esquema claro."
 * - 3 options: "Puedes responder con un texto breve, con un esquema claro o mediante una lista."
 * - >3: same as 3 but ends with " (u otra forma equivalente acordada con el docente)."
 */
export function formatResponseOptionsAsInlineSentence(
  options: ResponseOptionLike[] | undefined
): string {
  if (!options || options.length === 0) return '';
  const take = Math.min(options.length, MAX_OPTIONS_TO_MENTION);
  const parts: string[] = [];
  for (let i = 0; i < take; i++) {
    const opt = options[i];
    const text = [opt.format, opt.description].filter(Boolean).join(' ').trim();
    if (text) parts.push(text);
  }
  if (parts.length === 0) return '';
  const hasMore = options.length > MAX_OPTIONS_TO_MENTION;
  if (parts.length === 1) {
    return `Puedes responder ${parts[0]}${hasMore ? MORE_THAN_THREE_SUFFIX : ''}.`;
  }
  if (parts.length === 2) {
    return `Puedes responder ${parts[0]} o ${parts[1]}${hasMore ? MORE_THAN_THREE_SUFFIX : ''}.`;
  }
  const last = parts.pop();
  const rest = parts.join(', ');
  return `Puedes responder ${rest} o ${last}${hasMore ? MORE_THAN_THREE_SUFFIX : ''}.`;
}

/** Substrings that indicate the prompt already contains an inline "Puedes responder" sentence (avoid double-injection). */
const INLINE_OPTIONS_MARKERS = /Puedes responder|puedes responder|puedes elegir|Puedes elegir/i;

/**
 * Builds the display prompt for student view: base prompt + inline options sentence
 * and, when present, a short metacognition sentence (e.g. "Elegí el formato que mejor te ayude...").
 * If the base prompt already contains a "Puedes responder" (or similar) phrase, options are not appended again.
 */
export function getDisplayPromptWithInlineOptions(
  basePrompt: string,
  responseOptions?: ResponseOptionsWithMetacognition | null
): string {
  const trimmed = (basePrompt || '').trim();
  if (!responseOptions?.enabled || !responseOptions.options?.length) {
    return trimmed;
  }
  if (INLINE_OPTIONS_MARKERS.test(trimmed)) {
    return trimmed;
  }
  const optionsSentence = formatResponseOptionsAsInlineSentence(responseOptions.options);
  if (!optionsSentence) return trimmed;
  const withOptions = trimmed.endsWith('.') || trimmed.endsWith('?') || trimmed.endsWith('!')
    ? `${trimmed} ${optionsSentence}`
    : `${trimmed}. ${optionsSentence}`;
  const meta = (responseOptions.metacognitionText || '').trim();
  if (!meta) return withOptions;
  return `${withOptions} ${meta.endsWith('.') ? meta : `${meta}.`}`;
}
