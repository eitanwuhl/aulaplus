import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildDurationBreakdownFromSpec,
  estimateDurationFromSpec,
  SECTION_OVERHEAD_MINUTES,
  computeDeltaMinutesNeeded,
  formatHeuristicTableForPrompt,
  DEFAULT_MINUTES_PER_ITEM,
} from "../durationMath.ts";

Deno.test("estimateDurationFromSpec calcula duración determinística por tipo de ítem", () => {
  const spec = {
    sections: [
      {
        id: "s1",
        title: "Parte 1",
        items: [
          { type: "multiple_choice" },      // 2
          { type: "essay" },                // 14
          { type: "short_answer" },         // 4
        ]
      },
      {
        id: "s2",
        title: "Parte 2",
        items: [
          { type: "true_false" },           // 1
          { type: "source_analysis" },      // 14
        ]
      }
    ]
  };

  // section overhead: 2 * 1 = 2
  // items: 2 + 14 + 4 + 1 + 14 = 35
  // total = 37
  assertEquals(estimateDurationFromSpec(spec), 37);
});

Deno.test("buildDurationBreakdownFromSpec devuelve secciones y total consistentes", () => {
  const spec = {
    sections: [
      {
        id: "s1",
        title: "Parte 1",
        items: [{ type: "multiple_choice" }, { type: "paragraph" }]
      }
    ]
  };

  const breakdown = buildDurationBreakdownFromSpec(spec);
  assertEquals(breakdown.sections.length, 1);
  assertEquals(breakdown.sections[0].sectionId, "s1");
  assertEquals(breakdown.sections[0].itemCount, 2);
  assertEquals(
    breakdown.sections[0].estimatedMinutes,
    SECTION_OVERHEAD_MINUTES + 2 + 9
  );
  assertEquals(breakdown.totalEstimatedMinutes, estimateDurationFromSpec(spec));
  assert(breakdown.heuristicAssumptions.length > 10);
});

Deno.test("computeDeltaMinutesNeeded: zero when current >= targetLow", () => {
  assertEquals(computeDeltaMinutesNeeded(80, 72), 0);
  assertEquals(computeDeltaMinutesNeeded(72, 72), 0);
});

Deno.test("computeDeltaMinutesNeeded: positive delta ceil to reach targetLow", () => {
  assertEquals(computeDeltaMinutesNeeded(32, 72), 40);
  assertEquals(computeDeltaMinutesNeeded(30, 72), 42);
  assertEquals(computeDeltaMinutesNeeded(0, 72), 72);
});

Deno.test("computeDeltaMinutesNeeded: negative targetLow clamped to zero", () => {
  assertEquals(computeDeltaMinutesNeeded(100, 50), 0);
});

Deno.test("formatHeuristicTableForPrompt includes known types and section overhead", () => {
  const table = formatHeuristicTableForPrompt();
  assert(table.includes("multiple_choice"));
  assert(table.includes("2 min por ítem"));
  assert(table.includes("essay"));
  assert(table.includes("14 min por ítem"));
  assert(table.includes("sobrecarga por sección"));
  assert(table.includes(`${DEFAULT_MINUTES_PER_ITEM} min por ítem`));
});

// 95% target band: aim for >=95% of target (target-centered), not 90%
Deno.test("95% target band: low = 76 for target 80", () => {
  const target = 80;
  const low = Math.round(target * 0.95);
  assertEquals(low, 76);
});

Deno.test("computeDeltaMinutesNeeded for 95% target: current 70, target 80 => delta 6", () => {
  const target = 80;
  const low = Math.round(target * 0.95);
  assertEquals(low, 76);
  assertEquals(computeDeltaMinutesNeeded(70, low), 6);
});

Deno.test("95% target band: high = 84 for target 80 (105%)", () => {
  const target = 80;
  const high = Math.round(target * 1.05);
  assertEquals(high, 84);
});
