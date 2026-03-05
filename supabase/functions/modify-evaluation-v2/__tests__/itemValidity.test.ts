import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  validateItem,
  validateSpecItems,
  isAnswerLeakingExcerpt,
  getDegradationType,
} from "../itemValidity.ts";

Deno.test("ordering: without elements is flagged", () => {
  const item = { id: "o1", type: "ordering", prompt: "Ordena los eventos.", points: 2, itemsToOrder: [] };
  const r = validateItem(item, "s1");
  assertEquals(r.valid, false);
  assert(r.reason?.includes("ordering"));
  assert(r.reason?.includes("at least 2 elements"));
});

Deno.test("ordering: with one element is flagged", () => {
  const item = { id: "o1", type: "ordering", prompt: "Ordena.", points: 2, itemsToOrder: ["Solo uno"] };
  const r = validateItem(item, "s1");
  assertEquals(r.valid, false);
});

Deno.test("ordering: with two elements is valid", () => {
  const item = { id: "o1", type: "ordering", prompt: "Ordena.", points: 2, itemsToOrder: ["Paso A", "Paso B"] };
  const r = validateItem(item, "s1");
  assertEquals(r.valid, true);
});

Deno.test("matching: without columns is flagged", () => {
  const item = { id: "m1", type: "matching", prompt: "Relaciona.", points: 2 };
  const r = validateItem(item, "s1");
  assertEquals(r.valid, false);
  assert(r.reason?.includes("matching"));
  assert(r.reason?.includes("left") || r.reason?.includes("right"));
});

Deno.test("matching: with only left column is flagged", () => {
  const item = { id: "m1", type: "matching", prompt: "Relaciona.", points: 2, leftColumn: ["A", "B"], rightColumn: [] };
  const r = validateItem(item, "s1");
  assertEquals(r.valid, false);
});

Deno.test("matching: with both columns >= 2 is valid", () => {
  const item = {
    id: "m1",
    type: "matching",
    prompt: "Relaciona.",
    points: 2,
    leftColumn: ["Concepto 1", "Concepto 2"],
    rightColumn: ["Definición A", "Definición B"],
  };
  const r = validateItem(item, "s1");
  assertEquals(r.valid, true);
});

Deno.test("multiple_choice: fewer than 3 options with text is flagged", () => {
  const item = {
    id: "mc1",
    type: "multiple_choice",
    prompt: "Elige.",
    points: 1,
    options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
  };
  const r = validateItem(item, "s1");
  assertEquals(r.valid, false);
  assert(r.reason?.includes("multiple_choice"));
  assert(r.reason?.includes("at least 3"));
});

Deno.test("multiple_choice: 3 options with text is valid", () => {
  const item = {
    id: "mc1",
    type: "multiple_choice",
    prompt: "Elige.",
    points: 1,
    options: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }],
  };
  const r = validateItem(item, "s1");
  assertEquals(r.valid, true);
});

Deno.test("source_analysis: excerpt with abstract-like phrase is flagged as answer-leaking", () => {
  const leaking = "En este trabajo se analiza el impacto de las políticas económicas del Batllismo. Se examinan las características del Estado benefactor. Las ideas principales son la reforma laboral y la educación. ".repeat(2);
  assert(leaking.length >= 200);
  assertEquals(isAnswerLeakingExcerpt(leaking), true);
});

Deno.test("source_analysis: valid excerpt not flagged", () => {
  const ok = "El Batllismo impulsó una serie de reformas a comienzos del siglo XX. Los trabajadores obtuvieron derechos que antes no tenían. La educación pública se expandió en todo el territorio.".repeat(2);
  assert(ok.length >= 200);
  assertEquals(isAnswerLeakingExcerpt(ok), false);
});

Deno.test("validateSpecItems: returns invalid list and counts", () => {
  const spec = {
    sections: [
      {
        id: "s1",
        items: [
          { id: "o1", type: "ordering", prompt: "Ordena.", points: 2, itemsToOrder: [] },
          { id: "m1", type: "matching", prompt: "Relaciona.", points: 2 },
        ],
      },
    ],
  };
  const result = validateSpecItems(spec);
  assertEquals(result.invalid.length, 2);
  assert(result.invalid.some((i) => i.type === "ordering"));
  assert(result.invalid.some((i) => i.type === "matching"));
  assert(result.countsByType["ordering"] === 1);
  assert(result.countsByType["matching"] === 1);
});

Deno.test("getDegradationType: ordering -> short_answer, matching -> paragraph", () => {
  assertEquals(getDegradationType("ordering"), "short_answer");
  assertEquals(getDegradationType("matching"), "paragraph");
  assertEquals(getDegradationType("multiple_choice"), "short_answer");
  assertEquals(getDegradationType("source_analysis"), "short_answer");
});
