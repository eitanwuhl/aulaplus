/**
 * Deterministic passage quality filter for lesson planning.
 * Excludes TOC/index, bibliography, prologue, metadata before using material in prompts.
 * Mirrors logic in modify-evaluation-v2/excerptCleaning.ts for consistency.
 */

export type PassageRejectReason = "toc" | "biblio" | "prologue" | "metadata";

const METADATA_PATTERNS = [
  /@\s*[\w.-]+\s*\.\s*\w{2,}/,
  /^(instituto|universidad|facultad|departamento|centro)\s+/i,
  /^(autor|autores|correspondencia|affiliation)\s*[:.]/i,
  /^(pp\.|p\.|página|páginas)\s*\d/i,
  /^(doi|issn|isbn)\s*[:.]/i,
  /^https?:\/\/\S+$/i,
];

function looksLikeMetadata(content: string): boolean {
  if (!content || content.length < 100) return false;
  const lines = content.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const metadataLike = lines.filter((l) => {
    if (l.length < 15) return true;
    return METADATA_PATTERNS.some((p) => p.test(l));
  }).length;
  return metadataLike >= Math.min(3, Math.ceil(lines.length * 0.5));
}

const TOC_INDEX_PATTERNS = [
  /\.{2,}\s*\d+\s*$/m,
  /^\s*(capítulo|chapter|cap\.)\s*[\dIVXLCDM]+\s*[\.\-\s]/im,
  /\b(índice|indice|contenido|contents|table of contents)\s*$/im,
  /^\s*\d+\s+\.{3,}\s+\d+\s*$/gm,
  /página\s+\d+|p\.\s*\d+|pp\.\s*\d+-\d+/gi,
];
const TOC_TITLE_MARKERS = ["índice", "indice", "contenido", "contents", "table of contents", "sumario"];
const MIN_TOC_LINE_COUNT = 3;

function isLikelyTocOrIndex(block: string): boolean {
  const t = block.trim();
  if (t.length < 50) return false;
  const lower = t.toLowerCase();
  const firstLine = t.split(/\n/)[0]?.trim().toLowerCase() || "";
  if (TOC_TITLE_MARKERS.some((m) => firstLine.includes(m) || lower.slice(0, 200).includes(m))) return true;
  const tocLikeLines = t.split(/\n/).filter((line) => {
    const l = line.trim();
    return TOC_INDEX_PATTERNS.some((p) => p.test(l)) || /^\d+\s*[\.\)]\s*.{1,60}\s+\.{2,}\s*\d*$/.test(l);
  });
  return tocLikeLines.length >= MIN_TOC_LINE_COUNT;
}

const BIBLIO_MARKERS = [
  /^\s*(referencias|bibliografía|bibliografia|references|bibliography|obras citadas|fuentes)\s*[:.]?\s*$/im,
  /^\s*\d+\.\s*[A-ZÁÉÍÓÚ][^.]{20,200}\s*\.\s*\w+\s*,\s*\d{4}/m,
  /doi\s*[:.]\s*10\./i,
];

function isLikelyBibliography(block: string): boolean {
  const t = block.trim();
  if (t.length < 80) return false;
  const firstLines = t.split(/\n/).slice(0, 5).join(" ");
  if (BIBLIO_MARKERS.some((p) => p.test(firstLines) || p.test(t.slice(0, 400)))) return true;
  const hasAuthorYear = /[A-ZÁÉÍÓÚ][a-záéíóúñ]+\s*,?\s*\(?\d{4}\)?/.test(t) && /\d{4}/.test(t);
  const hasDoiOrUrl = /doi\s*[:.]|https?:\/\//i.test(t);
  return hasAuthorYear && (hasDoiOrUrl || t.split(/\n/).length >= 4);
}

const PROLOGUE_MARKERS = [
  /^\s*(prólogo|prologo|presentación|presentacion|prefacio|introducción editorial|nota del editor)\s*[:.]?\s*$/im,
  /^\s*(agradecimientos|acknowledgments)\s*[:.]?\s*$/im,
];
const PROLOGUE_MAX_RATIO_FIRST_BLOCK = 0.4;

function isLikelyPrologue(block: string, isFromStartOfDocument: boolean): boolean {
  const t = block.trim();
  if (t.length < 60 || !isFromStartOfDocument) return false;
  const firstLine = t.split(/\n/)[0]?.trim() || "";
  const lowerStart = t.toLowerCase().slice(0, 200);
  if (PROLOGUE_MARKERS.some((p) => p.test(firstLine) || p.test(lowerStart))) return true;
  if (/^(prólogo|prologo|presentación|prefacio)\s*$/im.test(firstLine)) return true;
  return false;
}

export interface FilterPassagesResult {
  kept: string[];
  rejectedByReason: Record<PassageRejectReason, number>;
}

/**
 * Split text into blocks (by double newline), filter by quality, return kept blocks and rejection counts.
 */
export function filterMaterialPassages(materialsContext: string): {
  filteredText: string;
  keptCount: number;
  rejectedByReason: Record<PassageRejectReason, number>;
  materialsCharsSent: number;
} {
  if (!materialsContext || !materialsContext.trim()) {
    return {
      filteredText: "",
      keptCount: 0,
      rejectedByReason: { toc: 0, biblio: 0, prologue: 0, metadata: 0 },
      materialsCharsSent: 0,
    };
  }
  const blocks = materialsContext
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 60);
  const rejectedByReason: Record<PassageRejectReason, number> = { toc: 0, biblio: 0, prologue: 0, metadata: 0 };
  const kept: string[] = [];
  blocks.forEach((block, idx) => {
    const isFromStart = idx < Math.ceil(blocks.length * PROLOGUE_MAX_RATIO_FIRST_BLOCK);
    let keep = true;
    if (looksLikeMetadata(block)) {
      rejectedByReason.metadata++;
      keep = false;
    } else if (isLikelyTocOrIndex(block)) {
      rejectedByReason.toc++;
      keep = false;
    } else if (isLikelyBibliography(block)) {
      rejectedByReason.biblio++;
      keep = false;
    } else if (isLikelyPrologue(block, isFromStart)) {
      rejectedByReason.prologue++;
      keep = false;
    }
    if (keep) kept.push(block);
  });
  const filteredText = kept.join("\n\n");
  const materialsCharsSent = filteredText.length;
  return {
    filteredText,
    keptCount: kept.length,
    rejectedByReason,
    materialsCharsSent,
  };
}
