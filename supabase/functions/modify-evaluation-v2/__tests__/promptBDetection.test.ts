import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { EvaluationSpecV2 } from "../index.ts";
import { detectRubricAndPromptBRepairCandidates } from "../index.ts";

/** Minimal spec with some items missing promptB. */
function specWithPartialPromptB(hasB: boolean): EvaluationSpecV2 {
  const items = [
    {
      id: "item-1",
      type: "short_answer",
      prompt: "Pregunta 1",
      points: 2,
      versionedContent: hasB ? { promptB: "Consigna adaptada 1" } : {}
    },
    {
      id: "item-2",
      type: "short_answer",
      prompt: "Pregunta 2",
      points: 2
    },
    {
      id: "item-3",
      type: "essay",
      prompt: "Ensayo",
      points: 5,
      versionedContent: { promptB: "Consigna B para ensayo" }
    }
  ];
  return {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    meta: { subject: "Test", evaluationType: "sumative" },
    sections: [{ id: "s1", title: "Sección 1", items }],
    versionVariants: { A: { label: "A", isBase: true }, B: { label: "B", isBase: false, reason: "", modifications: [] } }
  } as unknown as EvaluationSpecV2;
}

Deno.test("detectRubricAndPromptBRepairCandidates: returns all items missing promptB when B requested", () => {
  const spec = specWithPartialPromptB(false);
  const requestedVersions = { A: true, B: true, C: false };
  const { rubricRepairIds, promptBRepairIds } = detectRubricAndPromptBRepairCandidates(spec, requestedVersions);

  assert(promptBRepairIds.includes("item-1"), "item-1 has no promptB");
  assert(promptBRepairIds.includes("item-2"), "item-2 has no promptB");
  assert(promptBRepairIds.includes("item-3") === false, "item-3 has promptB");
  assertEquals(promptBRepairIds.length, 2);
});

Deno.test("detectRubricAndPromptBRepairCandidates: repair required when B requested and any missing promptB", () => {
  const spec = specWithPartialPromptB(false);
  const requestedVersions = { A: true, B: true, C: false };
  const { promptBRepairIds } = detectRubricAndPromptBRepairCandidates(spec, requestedVersions);

  assert(promptBRepairIds.length > 0, "repair required when items missing promptB and B requested");
});

Deno.test("detectRubricAndPromptBRepairCandidates: no promptB repair when B not requested", () => {
  const spec = specWithPartialPromptB(false);
  const requestedVersions = { A: true, B: false, C: false };
  const { promptBRepairIds } = detectRubricAndPromptBRepairCandidates(spec, requestedVersions);

  assertEquals(promptBRepairIds.length, 0);
});
