import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  validateExcerpts,
  MIN_EXCERPT_LENGTH_CHARS,
  ITEM_TYPES_REQUIRING_SOURCE
} from "../excerptValidation.ts";

Deno.test("validateExcerpts: valid when source_analysis has content >= MIN_EXCERPT_LENGTH_CHARS", () => {
  const spec = {
    sections: [
      {
        id: "s1",
        items: [
          { id: "i1", type: "source_analysis", source: { content: "a".repeat(MIN_EXCERPT_LENGTH_CHARS) } },
          { id: "i2", type: "multiple_choice" }
        ]
      }
    ]
  };
  const out = validateExcerpts(spec);
  assertEquals(out.valid, true);
  assertEquals(out.failures.length, 0);
});

Deno.test("validateExcerpts: invalid when source_analysis has short content", () => {
  const spec = {
    sections: [
      {
        id: "s1",
        items: [
          { id: "i1", type: "source_analysis", source: { content: "Solo un título." } }
        ]
      }
    ]
  };
  const out = validateExcerpts(spec);
  assertEquals(out.valid, false);
  assertEquals(out.failures.length, 1);
  assertEquals(out.failures[0].sectionId, "s1");
  assertEquals(out.failures[0].itemId, "i1");
  assertEquals(out.failures[0].itemType, "source_analysis");
});

Deno.test("validateExcerpts: boundary - 199 chars fails, 200 passes", () => {
  const spec199 = {
    sections: [{ id: "s1", items: [{ id: "i1", type: "source_analysis", source: { content: "x".repeat(199) } }] }]
  };
  assertEquals(validateExcerpts(spec199).valid, false);
  assertEquals(validateExcerpts(spec199).failures.length, 1);
  const spec200 = {
    sections: [{ id: "s1", items: [{ id: "i1", type: "source_analysis", source: { content: "x".repeat(MIN_EXCERPT_LENGTH_CHARS) } }] }]
  };
  assertEquals(validateExcerpts(spec200).valid, true);
  assertEquals(validateExcerpts(spec200).failures.length, 0);
});

Deno.test("validateExcerpts: invalid when source_analysis has no source.content", () => {
  const spec = {
    sections: [{ id: "s1", items: [{ id: "i1", type: "source_analysis", source: {} }] }]
  };
  const out = validateExcerpts(spec);
  assertEquals(out.valid, false);
  assertEquals(out.failures.length, 1);
});

Deno.test("validateExcerpts: ignores non-source types", () => {
  const spec = {
    sections: [
      {
        id: "s1",
        items: [
          { id: "i1", type: "essay" },
          { id: "i2", type: "short_answer", source: { content: "x" } }
        ]
      }
    ]
  };
  const out = validateExcerpts(spec);
  assertEquals(out.valid, true);
  assertEquals(out.failures.length, 0);
});

Deno.test("excerpt constants: MIN_EXCERPT_LENGTH_CHARS and ITEM_TYPES_REQUIRING_SOURCE", () => {
  assertEquals(typeof MIN_EXCERPT_LENGTH_CHARS, "number");
  assertEquals(MIN_EXCERPT_LENGTH_CHARS >= 100, true);
  assertEquals(ITEM_TYPES_REQUIRING_SOURCE.includes("source_analysis"), true);
});

Deno.test("excerpt length threshold: MIN_EXCERPT_LENGTH_CHARS is 200 (documented)", () => {
  assertEquals(MIN_EXCERPT_LENGTH_CHARS, 200);
});
