import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeRequestedVersionsForModify } from "../index.ts";

Deno.test("computeRequestedVersionsForModify: preserves B when current spec already has B", () => {
  const out = computeRequestedVersionsForModify({
    currentEvaluationSpec: {
      versionVariants: {
        A: { label: "A", isBase: true },
        B: { label: "B", isBase: false }
      }
    },
    declaredContentAdaptationCount: 0,
    versionCFromDecision: false,
    designPlanTriggers: { versionB: false, versionC: false }
  });
  assertEquals(out, { A: true, B: true, C: false });
});

Deno.test("computeRequestedVersionsForModify: enables B when content adaptation exists", () => {
  const out = computeRequestedVersionsForModify({
    currentEvaluationSpec: {
      versionVariants: { A: { label: "A", isBase: true } }
    },
    declaredContentAdaptationCount: 2,
    versionCFromDecision: false,
    designPlanTriggers: { versionB: false, versionC: false }
  });
  assertEquals(out.B, true);
});

Deno.test("computeRequestedVersionsForModify: keeps B false when no signals exist", () => {
  const out = computeRequestedVersionsForModify({
    currentEvaluationSpec: {
      versionVariants: { A: { label: "A", isBase: true } }
    },
    declaredContentAdaptationCount: 0,
    versionCFromDecision: false,
    designPlanTriggers: { versionB: false, versionC: false }
  });
  assertEquals(out, { A: true, B: false, C: false });
});

