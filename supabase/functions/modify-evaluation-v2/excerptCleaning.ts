/**
 * Deterministic excerpt cleaning and selection for source_analysis items.
 * Strips metadata/cover-page content and selects 1–3 contiguous paragraphs relevant to the item prompt.
 * Documented in 23-quality-duration-and-excerpt-coherence.md.
 */

import { MIN_EXCERPT_LENGTH_CHARS, MAX_EXCERPT_LENGTH_CHARS } from "./excerptValidation.ts";

/** Patterns (line-level) that suggest metadata/cover page; lines matching these are dropped or de-prioritized. */
const METADATA_PATTERNS = [
  /@\s*[\w.-]+\s*\.\s*\w{2,}/,                    // email
  /^(instituto|universidad|facultad|departamento|centro)\s+/i,
  /^(autor|autores|correspondencia|affiliation|affiliations)\s*[:.]/i,
  /^\s*[\d]+\s*$/,                                  // standalone number (footnote)
  /^(pp\.|p\.|página|páginas)\s*\d/i,
  /^(doi|issn|isbn)\s*[:.]/i,
  /^https?:\/\/\S+$/i,
  /^\s*[-_=]{2,}\s*$/,                              // separator line
];

/** Minimum line length to consider "substantive"; very short lines are often headers/titles. */
const MIN_SUBSTANTIVE_LINE_LEN = 40;

function isLikelyMetadataLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 15) return true;  // very short lines often titles/repeated
  return METADATA_PATTERNS.some((p) => p.test(t));
}

/**
 * Extract key terms from item prompt for relevance scoring (simple: words 4+ chars, lowercased).
 */
export function extractKeyTerms(prompt: string, maxTerms = 25): string[] {
  if (!prompt || typeof prompt !== "string") return [];
  const normalized = prompt.toLowerCase().replace(/\s+/g, " ");
  const words = normalized.split(/\P{L}+/u).filter((w) => w.length >= 4);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= maxTerms) break;
  }
  return out;
}

/**
 * Score a paragraph by keyword overlap (count of key terms that appear in the paragraph).
 */
function scoreParagraph(paragraph: string, keyTerms: string[]): number {
  const lower = paragraph.toLowerCase();
  let count = 0;
  for (const term of keyTerms) {
    if (lower.includes(term)) count += 1;
  }
  return count;
}

/**
 * Strip metadata-like lines from text and return cleaned lines (paragraphs as single strings).
 */
function stripMetadataAndParagraphs(rawText: string): string[] {
  const lines = rawText.split(/\n/).map((l) => l.trim());
  const cleanedLines: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const p = current.join(" ").trim();
    if (p.length >= MIN_SUBSTANTIVE_LINE_LEN) cleanedLines.push(p);
    current = [];
  };
  for (const line of lines) {
    if (isLikelyMetadataLine(line)) {
      flush();
      continue;
    }
    if (line.length > 0) current.push(line);
    else flush();
  }
  flush();
  return cleanedLines;
}

export type ExcerptCleaningResult = {
  excerpt: string;
  source: "cleaned_selection" | "fallback";
  excerptLengthChars: number;
  topMatchedKeywords?: string[];
  wasCleaned?: boolean;
  lowRelevance?: boolean;
  excerptRejectReason?: PassageRejectReason;
};

/**
 * Clean and select 1–3 contiguous paragraphs from raw extracted text that are relevant to the item prompt.
 * - Strips metadata/cover-page lines.
 * - Scores paragraphs by keyword overlap with prompt.
 * - Returns a contiguous block meeting min/max length; if no good match, returns best-effort and sets lowRelevance.
 */
export function cleanAndSelectExcerpt(
  rawText: string,
  itemPrompt: string,
  minLen: number = MIN_EXCERPT_LENGTH_CHARS,
  maxLen: number = MAX_EXCERPT_LENGTH_CHARS
): ExcerptCleaningResult {
  const trimmed = (rawText || "").trim();
  const trimmedQuality = filterPassageByQuality(trimmed, { isFromStartOfDocument: false });
  if (!trimmedQuality.keep) {
    return {
      excerpt: "",
      source: "fallback",
      excerptLengthChars: 0,
      lowRelevance: true,
      excerptRejectReason: trimmedQuality.reason,
    };
  }
  if (trimmed.length < minLen) {
    return {
      excerpt: "",
      source: "fallback",
      excerptLengthChars: 0,
      lowRelevance: true,
    };
  }
  const keyTerms = extractKeyTerms(itemPrompt);
  const paragraphs = stripMetadataAndParagraphs(trimmed).filter((p) => filterPassageByQuality(p, { isFromStartOfDocument: false }).keep);
  if (paragraphs.length === 0) {
    const fallback = trimmed.slice(0, maxLen).trim();
    const fallbackQuality = filterPassageByQuality(fallback, { isFromStartOfDocument: false });
    return {
      excerpt: fallbackQuality.keep ? fallback : "",
      source: "fallback",
      excerptLengthChars: fallbackQuality.keep ? fallback.length : 0,
      wasCleaned: true,
      lowRelevance: true,
      excerptRejectReason: fallbackQuality.keep ? undefined : fallbackQuality.reason,
    };
  }
  const scored = paragraphs.map((p, i) => ({ i, text: p, score: scoreParagraph(p, keyTerms) }));
  let bestStart = 0;
  let bestLen = 0;
  let bestScore = -1;
  let bestMatched: string[] = [];
  for (let start = 0; start < paragraphs.length; start++) {
    let block = "";
    let totalScore = 0;
    const matched: string[] = [];
    for (let n = 1; n <= 3 && start + n <= paragraphs.length; n++) {
      const idx = start + n - 1;
      const p = paragraphs[idx];
      block = (block ? block + "\n\n" : "") + p;
      totalScore += scored[idx].score;
      const words = keyTerms.filter((t) => p.toLowerCase().includes(t));
      words.forEach((w) => { if (!matched.includes(w)) matched.push(w); });
      const len = block.length;
      if (len >= minLen && len <= maxLen && (totalScore > bestScore || (totalScore === bestScore && len > bestLen))) {
        bestScore = totalScore;
        bestStart = start;
        bestLen = n;
        bestMatched = [...matched];
      }
      if (len > maxLen) break;
    }
  }
  if (bestLen === 0) {
    const fallback = paragraphs.slice(0, 3).join("\n\n").slice(0, maxLen);
    const lowRel = keyTerms.length > 0 && bestMatched.length === 0;
    const fallbackCandidate = fallback.length >= minLen ? fallback : trimmed.slice(0, maxLen);
    const fallbackQuality = filterPassageByQuality(fallbackCandidate, { isFromStartOfDocument: false });
    return {
      excerpt: fallbackQuality.keep ? fallbackCandidate : "",
      source: fallbackQuality.keep ? "cleaned_selection" : "fallback",
      excerptLengthChars: fallbackQuality.keep ? Math.min(fallbackCandidate.length, maxLen) : 0,
      topMatchedKeywords: bestMatched.length ? bestMatched.slice(0, 10) : undefined,
      wasCleaned: true,
      lowRelevance: lowRel,
      excerptRejectReason: fallbackQuality.keep ? undefined : fallbackQuality.reason,
    };
  }
  const selected = paragraphs.slice(bestStart, bestStart + bestLen).join("\n\n");
  const excerpt = selected.length > maxLen ? selected.slice(0, maxLen) : selected;
  const excerptQuality = filterPassageByQuality(excerpt, { isFromStartOfDocument: false });
  if (!excerptQuality.keep) {
    return {
      excerpt: "",
      source: "fallback",
      excerptLengthChars: 0,
      topMatchedKeywords: bestMatched.length ? bestMatched.slice(0, 10) : undefined,
      wasCleaned: true,
      lowRelevance: true,
      excerptRejectReason: excerptQuality.reason,
    };
  }
  return {
    excerpt,
    source: "cleaned_selection",
    excerptLengthChars: excerpt.length,
    topMatchedKeywords: bestMatched.length ? bestMatched.slice(0, 10) : undefined,
    wasCleaned: true,
    lowRelevance: keyTerms.length > 0 && bestMatched.length < 2,
  };
}

/**
 * Decide if existing content looks like raw metadata (should be replaced with cleaned selection).
 */
export function looksLikeMetadata(content: string): boolean {
  if (!content || content.length < 100) return false;
  const lines = content.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const metadataLike = lines.filter((l) => isLikelyMetadataLine(l)).length;
  return metadataLike >= Math.min(3, Math.ceil(lines.length * 0.5));
}

/**
 * Clean material text for prompt/repair: strip metadata and return first 1–3 substantive paragraphs (no keyword matching).
 * Used when building the materials section so the LLM receives coherent passages.
 */
export function cleanMaterialTextForPrompt(
  rawText: string,
  maxLen: number = MAX_EXCERPT_LENGTH_CHARS
): string {
  const paragraphs = stripMetadataAndParagraphs((rawText || "").trim());
  if (paragraphs.length === 0) return (rawText || "").trim().slice(0, maxLen);
  let out = "";
  for (let n = 0; n < Math.min(3, paragraphs.length); n++) {
    const next = out ? out + "\n\n" + paragraphs[n] : paragraphs[n];
    if (next.length > maxLen) break;
    out = next;
  }
  return out.length >= MIN_EXCERPT_LENGTH_CHARS ? out : (rawText || "").trim().slice(0, maxLen);
}

// ============================================================================
// DETERMINISTIC PASSAGE QUALITY FILTER (TOC / BIBLIO / PROLOGUE / METADATA)
// Shared logic: exclude blocks that are not pedagogical content before Index+Passages.
// ============================================================================

export type PassageRejectReason = "toc" | "biblio" | "prologue" | "metadata";

/** Dot leaders, page numbers, index/chapter list patterns */
const TOC_INDEX_PATTERNS = [
  /\.{2,}\s*\d+\s*$/m,                           // ..... 12
  /^\s*(capítulo|chapter|cap\.)\s*[\dIVXLCDM]+\s*[\.\-\s]/im,
  /^\s*\d+\s*\.\s*[A-ZÁÉÍÓÚ].{2,80}\s*\.{2,}\s*\d+/im,  // 1. Title ..... 5
  /\b(índice|indice|contenido|contents|table of contents)\s*$/im,
  /^\s*\d+\s+\.{3,}\s+\d+\s*$/gm,               // 1 ... 10
  /página\s+\d+|p\.\s*\d+|pp\.\s*\d+-\d+/gi,
];
const TOC_TITLE_MARKERS = ["índice", "indice", "contenido", "contents", "table of contents", "sumario"];
const MIN_TOC_LINE_COUNT = 3;  // at least this many toc-like lines to reject block as TOC
const TOC_LINE_PATTERNS = [
  /.*\.{3,}.*\d{1,3}\s*$/i, // dotted leaders + page number ending
  /^\s*(?:\d+|[IVXLCDM]+)[\.\)]?\s+.{1,90}\s+\d{1,3}\s*$/i, // section title + ending page number
  /^\s*[\dIVXLCDM]+(?:\.[\dIVXLCDM]+)*\s+.{1,80}\s*$/i, // numbered section heading
];

function looksLikeTOCLine(line: string): boolean {
  const l = (line || "").trim();
  if (!l) return false;
  if (TOC_LINE_PATTERNS.some((p) => p.test(l))) return true;
  if (/\.{4,}/.test(l) && /\d{1,3}\s*$/.test(l)) return true;
  return false;
}

function isLikelyTocOrIndex(block: string): boolean {
  const t = block.trim();
  if (t.length < 50) return false;
  const lower = t.toLowerCase();
  const firstLine = t.split(/\n/)[0]?.trim().toLowerCase() || "";
  if (TOC_TITLE_MARKERS.some((m) => firstLine.includes(m) || lower.slice(0, 200).includes(m))) return true;
  const lines = t.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const tocLikeLines = lines.filter((line) => {
    const l = line.trim();
    return looksLikeTOCLine(l) || TOC_INDEX_PATTERNS.some((p) => p.test(l)) || /^\d+\s*[\.\)]\s*.{1,60}\s+\.{2,}\s*\d*$/.test(l);
  });
  const pageEndingLines = lines.filter((l) => /\b\d{1,3}\s*$/.test(l)).length;
  const shortLines = lines.filter((l) => l.length <= 90).length;
  const tocRatio = lines.length > 0 ? tocLikeLines.length / lines.length : 0;
  const pageRatio = lines.length > 0 ? pageEndingLines / lines.length : 0;
  const shortRatio = lines.length > 0 ? shortLines / lines.length : 0;
  return (
    tocLikeLines.length >= MIN_TOC_LINE_COUNT ||
    (tocRatio >= 0.35 && pageRatio >= 0.35) ||
    (tocRatio >= 0.3 && shortRatio >= 0.7)
  );
}

/** Public helper for runtime guards in excerpt and filler selection. */
export function looksLikeTOC(block: string): boolean {
  return isLikelyTocOrIndex(block);
}

const BIBLIO_MARKERS = [
  /^\s*(referencias|bibliografía|bibliografia|references|bibliography|obras citadas|fuentes)\s*[:.]?\s*$/im,
  /^\s*\d+\.\s*[A-ZÁÉÍÓÚ][^.]{20,200}\s*\.\s*\w+\s*,\s*\d{4}/m,
  /\(?\d{4}\)?\.\s*[A-ZÁÉÍÓÚ]/,
  /doi\s*[:.]\s*10\./i,
  /https?:\/\/[^\s]+/,
];
const MIN_BIBLIO_LENGTH = 80;

function isLikelyBibliography(block: string): boolean {
  const t = block.trim();
  if (t.length < MIN_BIBLIO_LENGTH) return false;
  const firstLines = t.split(/\n/).slice(0, 5).join(" ");
  if (BIBLIO_MARKERS.some((p) => p.test(firstLines) || p.test(t.slice(0, 400)))) return true;
  const hasAuthorYear = /[A-ZÁÉÍÓÚ][a-záéíóúñ]+\s*,?\s*\(?\d{4}\)?/.test(t) && /\d{4}/.test(t);
  const hasDoiOrUrl = /doi\s*[:.]|https?:\/\//i.test(t);
  return hasAuthorYear && (hasDoiOrUrl || t.split(/\n/).length >= 4);
}

const PROLOGUE_MARKERS = [
  /^\s*(prólogo|prologo|presentación|presentacion|prefacio|introducción editorial|nota del editor)\s*[:.]?\s*$/im,
  /^\s*(este (libro|texto|documento) (fue|ha sido)|agradecimientos|acknowledgments)\s*[:.]?\s*$/im,
];
const PROLOGUE_MAX_RATIO_FIRST_BLOCK = 0.4;  // only treat as prologue if in first ~40% of doc (caller can pass position hint)

function isLikelyPrologue(block: string, isFromStartOfDocument: boolean = true): boolean {
  const t = block.trim();
  if (t.length < 60) return false;
  if (!isFromStartOfDocument) return false;
  const firstLine = t.split(/\n/)[0]?.trim() || "";
  const lowerStart = t.toLowerCase().slice(0, 200);
  if (PROLOGUE_MARKERS.some((p) => p.test(firstLine) || p.test(lowerStart))) return true;
  if (/^(prólogo|prologo|presentación|prefacio)\s*$/im.test(firstLine)) return true;
  return false;
}

export interface FilterPassageResult {
  keep: boolean;
  reason?: PassageRejectReason;
}

/**
 * Single-block quality filter. Returns { keep: false, reason } for TOC, biblio, prologue, or metadata.
 */
export function filterPassageByQuality(
  block: string,
  options?: { isFromStartOfDocument?: boolean }
): FilterPassageResult {
  const t = (block || "").trim();
  if (t.length < 40) return { keep: true };
  if (looksLikeMetadata(t)) return { keep: false, reason: "metadata" };
  if (isLikelyTocOrIndex(t)) return { keep: false, reason: "toc" };
  if (isLikelyBibliography(t)) return { keep: false, reason: "biblio" };
  if (isLikelyPrologue(t, options?.isFromStartOfDocument ?? true)) return { keep: false, reason: "prologue" };
  return { keep: true };
}

export interface FilterPassagesResult {
  kept: string[];
  rejected: string[];
  rejectedByReason: Record<PassageRejectReason, number>;
  cacheHits?: number;
  cacheMisses?: number;
}

/**
 * Filter a list of text blocks. Rejection counts by reason (toc, biblio, prologue, metadata) for debug metrics.
 */
export function filterPassagesByQuality(blocks: string[]): FilterPassagesResult {
  return filterPassagesByQualityCached(blocks);
}

export function filterPassagesByQualityCached(
  blocks: string[],
  cache?: Map<string, FilterPassageResult>
): FilterPassagesResult {
  const rejectedByReason: Record<PassageRejectReason, number> = {
    toc: 0,
    biblio: 0,
    prologue: 0,
    metadata: 0,
  };
  const kept: string[] = [];
  const rejected: string[] = [];
  const qualityCache = cache ?? new Map<string, FilterPassageResult>();
  let cacheHits = 0;
  let cacheMisses = 0;
  blocks.forEach((block, idx) => {
    const isFromStart = idx < Math.ceil(blocks.length * PROLOGUE_MAX_RATIO_FIRST_BLOCK);
    const key = `${isFromStart ? "S" : "N"}::${block}`;
    const cached = qualityCache.get(key);
    const result = cached ?? filterPassageByQuality(block, { isFromStartOfDocument: isFromStart });
    if (cached) cacheHits += 1;
    else {
      cacheMisses += 1;
      qualityCache.set(key, result);
    }
    if (result.keep) {
      kept.push(block);
    } else {
      rejected.push(block);
      if (result.reason) rejectedByReason[result.reason] = (rejectedByReason[result.reason] || 0) + 1;
    }
  });
  return { kept, rejected, rejectedByReason, cacheHits, cacheMisses };
}
