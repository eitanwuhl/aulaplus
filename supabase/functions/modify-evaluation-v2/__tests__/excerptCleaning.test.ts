import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  extractKeyTerms,
  cleanAndSelectExcerpt,
  looksLikeMetadata,
  cleanMaterialTextForPrompt,
  filterPassagesByQuality,
  filterPassagesByQualityCached,
  filterPassageByQuality,
} from "../excerptCleaning.ts";
import { MIN_EXCERPT_LENGTH_CHARS, MAX_EXCERPT_LENGTH_CHARS } from "../excerptValidation.ts";

Deno.test("extractKeyTerms: extracts words 4+ chars, deduped, lowercased", () => {
  const prompt = "Analiza las políticas económicas del Batllismo y su impacto en el Estado.";
  const terms = extractKeyTerms(prompt);
  assert(terms.length > 0);
  assert(terms.some((t) => t === "analiza" || t === "políticas"));
  assert(terms.some((t) => t === "económicas" || t === "batllismo"));
  assert(terms.every((t) => t.length >= 4));
});

Deno.test("extractKeyTerms: empty or short prompt returns empty", () => {
  assertEquals(extractKeyTerms(""), []);
  assertEquals(extractKeyTerms("a b c"), []);
});

Deno.test("excerpt cleaning: removes obvious metadata blocks", () => {
  const rawText = [
    "Instituto de Educación",
    "Autor: Juan Pérez",
    "correspondencia: juan@instituto.edu.uy",
    "Universidad de la República",
    "",
    "El Batllismo fue un movimiento político que impulsó políticas económicas de bienestar.",
    "El Estado asumió un rol central en la economía y en la distribución de recursos.",
  ].join("\n");
  const result = cleanAndSelectExcerpt(rawText, "políticas económicas Batllismo Estado");
  assertEquals(result.source, "cleaned_selection");
  assert(result.excerpt.length >= MIN_EXCERPT_LENGTH_CHARS);
  assert(!result.excerpt.includes("juan@instituto.edu.uy"));
  assert(!result.excerpt.includes("Autor:"));
  assert(result.excerpt.includes("Batllismo") || result.excerpt.includes("políticas"));
});

Deno.test("excerpt selection relevance: chooses paragraph containing target keywords", () => {
  const rawText = [
    "Portada del documento. Título: Historia del Uruguay.",
    "",
    "Introducción general sin contenido específico.",
    "",
    "Las políticas económicas del Batllismo transformaron el Estado. El programa batllista incluyó reformas laborales y sociales que tuvieron un impacto duradero en la sociedad uruguaya.",
  ].join("\n");
  const result = cleanAndSelectExcerpt(rawText, "políticas económicas Batllismo programa impacto Estado");
  assertEquals(result.source, "cleaned_selection");
  assert((result.topMatchedKeywords?.length ?? 0) >= 2);
  assert(result.excerpt.includes("Batllismo") || result.excerpt.includes("políticas"));
});

Deno.test("looksLikeMetadata: true when most lines look like metadata", () => {
  const metadataDump = [
    "Autor: María García",
    "Instituto de Estudios Superiores",
    "maria.garcia@universidad.edu",
    "DOI: 10.1234/example",
    "Correspondencia: Facultad de Ciencias",
    "Página 1 de 10",
  ].join("\n");
  assert(metadataDump.length >= 100);
  assert(looksLikeMetadata(metadataDump) === true);
});

Deno.test("looksLikeMetadata: false for substantive paragraph", () => {
  const substantive = "El Batllismo fue un movimiento político uruguayo que impulsó reformas sociales y económicas durante las primeras décadas del siglo XX. El Estado asumió un rol activo en la economía.".repeat(2);
  assert(looksLikeMetadata(substantive) === false);
});

Deno.test("cleanMaterialTextForPrompt: returns cleaned text within max length", () => {
  const raw = [
    "Universidad de la República",
    "Autor: X",
    "",
    "Este es un párrafo sustantivo que contiene ideas importantes sobre el tema. Debe conservarse en la salida para que el modelo pueda usarlo en los ítems de análisis de fuentes.",
  ].join("\n");
  const out = cleanMaterialTextForPrompt(raw, MAX_EXCERPT_LENGTH_CHARS);
  assert(out.length <= MAX_EXCERPT_LENGTH_CHARS + 100);
  assert(!out.includes("Autor: X"));
  assert(out.includes("sustantivo") || out.includes("importantes"));
});

Deno.test("cleanAndSelectExcerpt: enforces min length and returns raw when text too short", () => {
  const short = "Solo un título.";
  const result = cleanAndSelectExcerpt(short, "cualquier prompt");
  assertEquals(result.source, "fallback");
  assert(result.excerptLengthChars === 0);
  assert(result.lowRelevance === true);
});

Deno.test("filterPassageByQuality: rejects TOC-like block", () => {
  const tocBlock = [
    "Índice",
    "",
    "Capítulo 1. Introducción .............. 5",
    "Capítulo 2. Desarrollo .............. 12",
    "Capítulo 3. Conclusiones .............. 20",
  ].join("\n");
  const result = filterPassageByQuality(tocBlock);
  assert(result.keep === false);
  assert(result.reason === "toc");
});

Deno.test("cleanAndSelectExcerpt: rejects TOC block as fallback with toc reason", () => {
  const tocBlock = [
    "Índice",
    "1. Introducción .......... 3",
    "2. Desarrollo .......... 9",
    "3. Conclusiones .......... 15",
  ].join("\n");
  const result = cleanAndSelectExcerpt(tocBlock, "analizar causas históricas");
  assertEquals(result.source, "fallback");
  assertEquals(result.excerptLengthChars, 0);
  assertEquals(result.excerptRejectReason, "toc");
});

Deno.test("filterPassageByQuality: rejects prologue when from start", () => {
  const prologueBlock = [
    "Prólogo",
    "",
    "Este libro fue escrito con la intención de ofrecer al lector una visión actualizada del tema. Agradecemos a todas las instituciones que apoyaron este proyecto.",
  ].join("\n");
  const result = filterPassageByQuality(prologueBlock, { isFromStartOfDocument: true });
  assert(result.keep === false);
  assert(result.reason === "prologue");
});

Deno.test("filterPassageByQuality: keeps substantive block", () => {
  const block = "El Batllismo fue un movimiento político uruguayo que impulsó reformas sociales y económicas durante las primeras décadas del siglo XX. El Estado asumió un rol activo en la economía y en la distribución de recursos.";
  const result = filterPassageByQuality(block);
  assert(result.keep === true);
});

Deno.test("filterPassagesByQuality: returns rejectedByReason counts", () => {
  const blocks = [
    "Índice\n\nCapítulo 1 ..... 1\nCapítulo 2 ..... 5",
    "Prólogo\n\nAgradecimientos a la universidad.",
    "El contenido sustantivo del documento que debe conservarse para el análisis.",
  ];
  const { kept, rejectedByReason } = filterPassagesByQuality(blocks);
  assert(kept.length === 1);
  assert(kept[0].includes("sustantivo"));
  assert((rejectedByReason.toc ?? 0) >= 1);
  assert((rejectedByReason.prologue ?? 0) >= 1);
});

Deno.test("filterPassagesByQualityCached: reuses cache for repeated blocks", () => {
  const repeated = "Índice\n\nCapítulo 1 ..... 1\nCapítulo 2 ..... 5";
  const blocks = [repeated, repeated, "Contenido sustantivo y coherente para evaluar comprensión."];
  const cache = new Map();
  const first = filterPassagesByQualityCached(blocks, cache);
  const second = filterPassagesByQualityCached(blocks, cache);
  assert((first.cacheMisses ?? 0) > 0);
  assert((second.cacheHits ?? 0) >= blocks.length);
});
