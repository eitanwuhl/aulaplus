import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { estimateDurationFromSpec } from "../durationMath.ts";
import type { EvaluationSpecV2 } from "../index.ts";
import { applyDeltaFiller } from "../index.ts";

/** Minimal V2 spec for testing (single section, enough MC items to approximate target estimate). */
function minimalSpec(estimatedMinutes: number): EvaluationSpecV2 {
  const items: Array<{ id: string; type: string; prompt: string; points: number }> = [];
  const sectionOverhead = 1;
  let remaining = Math.max(0, estimatedMinutes - sectionOverhead);
  const minutesPerMC = 2;
  while (remaining >= minutesPerMC && items.length < 40) {
    items.push({
      id: `item-${items.length}`,
      type: "multiple_choice",
      prompt: "Test",
      points: 1
    });
    remaining -= minutesPerMC;
  }
  return {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    meta: { subject: "Test", evaluationType: "sumative", duration: { minutes: estimatedMinutes } },
    sections: [{ id: "s1", title: "Sección 1", items }],
    versionVariants: { A: { label: "A", isBase: true } }
  } as unknown as EvaluationSpecV2;
}

Deno.test("delta filler: adds items until estimate >= 95% of target (low)", () => {
  const target = 80;
  const low = Math.round(target * 0.95);
  assertEquals(low, 76);

  const spec = minimalSpec(48);
  const before = estimateDurationFromSpec(spec);
  assert(before < low);

  const warnings: Array<{ code: string; message: string; severity: string }> = [];
  const { spec: afterSpec, itemsAdded } = applyDeltaFiller(
    spec,
    target,
    [], // no materials -> short_answer items
    warnings,
    "Historia"
  );

  assert(itemsAdded > 0, "should add at least one filler item");
  const after = estimateDurationFromSpec(afterSpec);
  assert(after >= low, `estimate ${after} should be >= low ${low}`);
  assert(
    warnings.some((w) => w.code === "DURATION_DELTA_FILLER_APPLIED"),
    "should add DURATION_DELTA_FILLER_APPLIED warning"
  );
});

Deno.test("delta filler: no items added when estimate already >= low", () => {
  const target = 80;
  const spec = minimalSpec(78);
  const before = estimateDurationFromSpec(spec);
  assert(before >= 76);

  const warnings: Array<{ code: string; message: string; severity: string }> = [];
  const { spec: afterSpec, itemsAdded } = applyDeltaFiller(spec, target, [], warnings);

  assertEquals(itemsAdded, 0);
  assertEquals(estimateDurationFromSpec(afterSpec), before);
  assert(!warnings.some((w) => w.code === "DURATION_DELTA_FILLER_APPLIED"));
});

Deno.test("delta filler: hard cap <= 6 and no MC without high-quality excerpt", () => {
  const target = 120; // forces a large delta from minimal spec
  const spec = minimalSpec(20);
  const warnings: Array<{ code: string; message: string; severity: string }> = [];
  const { spec: afterSpec, itemsAdded } = applyDeltaFiller(spec, target, [], warnings, "Historia");
  assert(itemsAdded <= 6, `itemsAdded (${itemsAdded}) debe ser <= 6`);
  const fillerSection = (afterSpec.sections || []).find((s) => s.title === "Complemento de duración");
  const fillerItems = fillerSection?.items || [];
  assert(fillerItems.every((i) => i.type !== "multiple_choice"), "sin excerpt de calidad no debe haber MC filler");
});
