import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { EvaluationSpecV2 } from "../index.ts";
import { fillMissingItemDataDeterministically, hasSectionWithComprehensionBundle } from "../index.ts";

function buildSpecWithMissingComplexData(): EvaluationSpecV2 {
  return {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    meta: {
      subject: "Historia",
      evaluationType: "sumativa",
    },
    sections: [
      {
        id: "s1",
        title: "Sección 1",
        items: [
          { id: "i-source", type: "source_analysis", prompt: "Analiza la fuente.", points: 4, source: { type: "text", content: "" } },
          { id: "i-table", type: "table_completion", prompt: "Completa la tabla.", points: 3 },
          { id: "i-match", type: "matching", prompt: "Relaciona conceptos.", points: 2 },
          { id: "i-order", type: "ordering", prompt: "Ordena eventos.", points: 2 },
          {
            id: "i-mc",
            type: "multiple_choice",
            prompt: "Selecciona la mejor opción.",
            points: 2,
            options: [{ id: "a", text: "Opción A" }, { id: "b", text: "Opción B" }],
          },
          {
            id: "i-fragment",
            type: "short_answer",
            prompt: "Según el fragmento anterior, explica una consecuencia del proceso.",
            points: 2,
          },
        ],
      },
    ],
    versionVariants: { A: { label: "A", isBase: true } },
  } as unknown as EvaluationSpecV2;
}

Deno.test("fillMissingItemDataDeterministically completa source/table/matching/ordering y mantiene IDs", () => {
  const spec = buildSpecWithMissingComplexData();
  const materials = [
    {
      title: "Texto base",
      extractedText:
        "La secuencia histórica muestra una etapa inicial con reformas institucionales y un proceso de consolidación social. " +
        "Se observan cambios en las políticas públicas y en la participación ciudadana.\n\n" +
        "En un segundo momento, el debate político se amplía y aparecen nuevos actores que discuten el alcance de las medidas. " +
        "Este material aporta evidencia para analizar causas, decisiones e impactos en distintos sectores.",
    },
  ];
  const warnings: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }> = [];

  fillMissingItemDataDeterministically(spec, materials, ["reformas", "políticas", "impacto"], "Historia", warnings);

  const items = spec.sections[0].items;
  const source = items.find((i) => i.id === "i-source")!;
  const table = items.find((i) => i.id === "i-table")!;
  const matching = items.find((i) => i.id === "i-match")!;
  const ordering = items.find((i) => i.id === "i-order")!;
  const mc = items.find((i) => i.id === "i-mc")!;
  const fragment = items.find((i) => i.id === "i-fragment")!;

  assert(source.id === "i-source");
  assert((source.source?.content || "").trim().length >= 120, "source_analysis debe tener texto usable");

  assert(table.id === "i-table");
  assert(table.table && table.table.columns.length >= 2, "table_completion debe tener columnas");
  assert(table.table && table.table.rows.length >= 1, "table_completion debe tener filas");

  assert(matching.id === "i-match");
  assert(Array.isArray(matching.leftColumn) && matching.leftColumn.length >= 2, "matching debe tener leftColumn");
  assert(Array.isArray(matching.rightColumn) && matching.rightColumn.length >= 2, "matching debe tener rightColumn");

  assert(ordering.id === "i-order");
  assert(Array.isArray(ordering.itemsToOrder) && ordering.itemsToOrder.length >= 3, "ordering debe tener itemsToOrder");

  assert(mc.id === "i-mc");
  assert(Array.isArray(mc.options) && mc.options.length >= 3, "multiple_choice debe tener al menos 3 opciones");
  assert(mc.options?.some((o) => o.isCorrect === true), "multiple_choice debe tener una opción correcta marcada");
  assert(!/fragmento anterior/i.test(fragment.prompt || ""), "prompt con referencia a fragmento debe corregirse si no hay fuente visible");

  const codes = warnings.map((w) => w.code);
  assert(codes.includes("SOURCE_FILLED"));
  assert(codes.includes("ITEM_DATA_FILLED_TABLE"));
  assert(codes.includes("MATCHING_FILLED"));
  assert(codes.includes("ORDERING_FILLED"));
  assert(codes.includes("MC_OPTIONS_FILLED"));
  assert(codes.includes("PROMPT_FRAGMENT_REFERENCE_FIXED"));
});

Deno.test("smoke max-difficulty: ningún ítem complejo queda sin estructura renderizable", () => {
  const spec = buildSpecWithMissingComplexData();
  const warnings: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }> = [];
  const materials = [
    {
      title: "Material largo",
      extractedText:
        "Primer bloque con contexto histórico suficiente para análisis. " +
        "Segundo bloque con evidencia y actores relevantes para justificar respuestas. ".repeat(12),
    },
  ];

  fillMissingItemDataDeterministically(spec, materials, ["cronología", "evidencia", "causas", "impactos"], "Historia", warnings);

  for (const section of spec.sections) {
    for (const item of section.items) {
      if (item.type === "source_analysis") {
        assert((item.source?.content || "").trim().length > 0, `source vacío en ${item.id}`);
      }
      if (item.type === "table_completion") {
        assert(item.table?.columns?.length && item.table.columns.length >= 2, `table columns insuficientes en ${item.id}`);
        assert(item.table?.rows?.length && item.table.rows.length >= 1, `table rows insuficientes en ${item.id}`);
      }
      if (item.type === "matching") {
        const leftLen = Array.isArray(item.leftColumn) ? item.leftColumn.length : 0;
        const rightLen = Array.isArray(item.rightColumn) ? item.rightColumn.length : 0;
        assert(leftLen >= 2 && rightLen >= 2, `matching incompleto en ${item.id}`);
      }
      if (item.type === "ordering") {
        const len = Array.isArray(item.itemsToOrder) ? item.itemsToOrder.length : 0;
        assert(len >= 3, `ordering incompleto en ${item.id}`);
      }
    }
  }

  assertEquals(warnings.length > 0, true);
});

Deno.test("normaliza aliases legacy para ordering/matching/table sin cambiar IDs", () => {
  const spec = {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    meta: { subject: "Historia", evaluationType: "sumativa" },
    sections: [
      {
        id: "s-legacy",
        title: "Legacy",
        items: [
          { id: "legacy-order", type: "ordering", prompt: "Ordena", points: 2, orderingItems: ["Paso 1", "Paso 2", "Paso 3"] },
          {
            id: "legacy-match",
            type: "matching",
            prompt: "Relaciona",
            points: 2,
            leftItems: ["Concepto 1", "Concepto 2"],
            rightItems: ["Impacto 1", "Impacto 2"],
          },
          {
            id: "legacy-table",
            type: "table_completion",
            prompt: "Completa",
            points: 3,
            tableData: { headers: ["Col A", "Col B"], rows: [["A1", ""], ["A2", ""]] },
          },
        ],
      },
    ],
    versionVariants: { A: { label: "A", isBase: true } },
  } as unknown as EvaluationSpecV2;

  const warnings: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }> = [];
  fillMissingItemDataDeterministically(spec, [], ["proceso", "causas"], "Historia", warnings);

  const items = spec.sections[0].items;
  const ord = items.find((i) => i.id === "legacy-order")!;
  const match = items.find((i) => i.id === "legacy-match")!;
  const table = items.find((i) => i.id === "legacy-table")!;

  assertEquals(ord.id, "legacy-order");
  assert(Array.isArray(ord.itemsToOrder) && ord.itemsToOrder.length >= 3, "orderingItems debe mapearse a itemsToOrder");
  assertEquals(match.id, "legacy-match");
  assert(Array.isArray(match.leftColumn) && match.leftColumn.length >= 2, "leftItems debe mapearse a leftColumn");
  assert(Array.isArray(match.rightColumn) && match.rightColumn.length >= 2, "rightItems debe mapearse a rightColumn");
  assertEquals(table.id, "legacy-table");
  assert(table.table?.columns?.length === 2, "tableData debe mapearse a table.columns");
});

Deno.test("hasSectionWithComprehensionBundle: true when section has source_analysis + 4 MC + short_answer", () => {
  const specWithBundle = {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    meta: { subject: "Historia", evaluationType: "sumativa" },
    sections: [
      {
        id: "s1",
        title: "Comprensión",
        items: [
          {
            id: "sa1",
            type: "source_analysis",
            prompt: "Analiza la fuente.",
            points: 4,
            source: { type: "text", content: "Fragmento largo suficiente para cumplir mínimo de caracteres requerido para considerar que hay excerpt adjunto en el ítem de análisis de fuente.".repeat(2) },
          },
          { id: "mc1", type: "multiple_choice", prompt: "P1", points: 2, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }] },
          { id: "mc2", type: "multiple_choice", prompt: "P2", points: 2, options: [] },
          { id: "mc3", type: "multiple_choice", prompt: "P3", points: 2, options: [] },
          { id: "mc4", type: "multiple_choice", prompt: "P4", points: 2, options: [] },
          { id: "sh1", type: "short_answer", prompt: "Cita evidencia.", points: 3 },
        ],
      },
    ],
    versionVariants: { A: { label: "A", isBase: true } },
  } as unknown as EvaluationSpecV2;
  assert(hasSectionWithComprehensionBundle(specWithBundle) === true);
});

Deno.test("hasSectionWithComprehensionBundle: false when no source_analysis with content", () => {
  const specNoBundle = {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    meta: { subject: "Historia", evaluationType: "sumativa" },
    sections: [
      {
        id: "s1",
        title: "Solo MC",
        items: [
          { id: "mc1", type: "multiple_choice", prompt: "P1", points: 2, options: [] },
          { id: "mc2", type: "multiple_choice", prompt: "P2", points: 2, options: [] },
          { id: "mc3", type: "multiple_choice", prompt: "P3", points: 2, options: [] },
          { id: "mc4", type: "multiple_choice", prompt: "P4", points: 2, options: [] },
        ],
      },
    ],
    versionVariants: { A: { label: "A", isBase: true } },
  } as unknown as EvaluationSpecV2;
  assert(hasSectionWithComprehensionBundle(specNoBundle) === false);
});
