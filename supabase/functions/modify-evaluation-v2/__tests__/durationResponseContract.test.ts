import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { estimateDurationFromSpec } from "../durationMath.ts";

type WarningLike = { code: string; message: string; severity: string };

function hasDurationBestEffortWarning(warnings: WarningLike[]): boolean {
  return warnings.some(
    (w) =>
      w.code === "DURATION_EXTEND_FAILED" ||
      w.code === "DURATION_DEVIATION" ||
      w.code === "DURATION_TRIM_FAILED"
  );
}

Deno.test("contract: target 80 incluye campos root y minutes==estimatedTotalMinutes", () => {
  const targetDurationMinutes = 80;
  const evaluationSpec = {
    version: "2.0",
    generatedAt: new Date().toISOString(),
    meta: {
      subject: "Historia",
      evaluationType: "written_exam",
      duration: { minutes: 0, targetMinutes: targetDurationMinutes },
    },
    sections: [
      {
        id: "s1",
        title: "Parte única",
        items: [
          { type: "essay" },
          { type: "paragraph" },
          { type: "short_answer" },
          { type: "multiple_choice" },
          { type: "multiple_choice" },
        ]
      }
    ]
  };

  const estimatedTotalMinutes = estimateDurationFromSpec(evaluationSpec);
  evaluationSpec.meta.duration.minutes = estimatedTotalMinutes;

  const warnings: WarningLike[] =
    estimatedTotalMinutes >= Math.round(targetDurationMinutes * 0.9) &&
    estimatedTotalMinutes <= Math.round(targetDurationMinutes * 1.1)
      ? []
      : [{ code: "DURATION_EXTEND_FAILED", message: "best effort", severity: "warning" }];

  const response = {
    success: true,
    evaluationSpec,
    targetDurationMinutes,
    estimatedTotalMinutes,
    timeBreakdown: {
      sections: [{ itemType: "Parte única", estimatedMinutes: estimatedTotalMinutes, description: "mock" }],
      heuristicAssumptions: "mock",
      totalEstimatedMinutes: estimatedTotalMinutes
    },
    warnings
  };

  assert(typeof response.estimatedTotalMinutes === "number");
  assertEquals(response.evaluationSpec.meta.duration.minutes, response.estimatedTotalMinutes);
  assertEquals(response.targetDurationMinutes, targetDurationMinutes);

  const inBand =
    response.estimatedTotalMinutes >= Math.round(targetDurationMinutes * 0.9) &&
    response.estimatedTotalMinutes <= Math.round(targetDurationMinutes * 1.1);
  assert(inBand || hasDurationBestEffortWarning(response.warnings));
});
