/**
 * V2 points redistribution — pure helpers for editing section/total points.
 * Redistributes item points proportionally with min 1 per item and deterministic rounding.
 */

import type { EvaluationSpecV2, EvaluationSectionV2, EvaluationItemV2 } from './v2Types';

const MIN_POINTS_PER_ITEM = 1;

/**
 * Distribute `targetTotal` across items proportionally to their current weights.
 * Each item gets at least MIN_POINTS_PER_ITEM. Uses largest-remainder for rounding so sum is exact.
 */
function distributeToItems(
  items: EvaluationItemV2[],
  targetTotal: number
): number[] {
  const n = items.length;
  if (n === 0) return [];
  const currentSum = items.reduce((s, i) => s + Math.max(0, i.points ?? 0), 0);
  if (currentSum <= 0) {
    const each = Math.max(MIN_POINTS_PER_ITEM, Math.floor(targetTotal / n));
    const remainder = targetTotal - each * n;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      out.push(each + (i < remainder ? 1 : 0));
    }
    return out;
  }
  const minTotal = n * MIN_POINTS_PER_ITEM;
  if (targetTotal < minTotal) {
    return items.map(() => MIN_POINTS_PER_ITEM);
  }
  const fracs = items.map((i) => (Math.max(0, i.points ?? 0) / currentSum) * targetTotal);
  const ints = fracs.map((f) => Math.floor(f));
  let assigned = ints.reduce((s, v) => s + v, 0);
  const remainders = fracs.map((f, i) => ({ i, r: f - ints[i] }));
  remainders.sort((a, b) => b.r - a.r);
  for (const { i } of remainders) {
    if (assigned >= targetTotal) break;
    ints[i]++;
    assigned++;
  }
  const out = ints.map((v) => Math.max(MIN_POINTS_PER_ITEM, v));
  const outSum = out.reduce((s, v) => s + v, 0);
  if (outSum !== targetTotal) {
    const diff = targetTotal - outSum;
    if (diff > 0) {
      const idx = out.findIndex((v) => v > MIN_POINTS_PER_ITEM) ?? 0;
      if (idx >= 0) out[idx] += diff;
    } else if (diff < 0) {
      for (let k = 0; k < -diff && out.some((v) => v > MIN_POINTS_PER_ITEM); k++) {
        const j = out.findIndex((v) => v > MIN_POINTS_PER_ITEM);
        if (j >= 0) out[j]--;
      }
    }
  }
  return out;
}

/**
 * Redistribute points within one section so the section total equals newSectionPoints.
 * Returns a new section (immutable); items get at least 1 point each.
 */
export function redistributeSectionPoints(
  section: EvaluationSectionV2,
  newSectionPoints: number
): EvaluationSectionV2 {
  const items = section.items ?? [];
  const n = items.length;
  const minFeasible = n * MIN_POINTS_PER_ITEM;
  const target = Math.max(minFeasible, Math.round(newSectionPoints));
  const points = distributeToItems(items, target);
  return {
    ...section,
    items: items.map((item, i) => ({
      ...item,
      points: points[i] ?? MIN_POINTS_PER_ITEM
    }))
  };
}

/**
 * Apply a section points edit to the full spec: redistribute that section and update meta.totalPoints.
 */
export function applySectionPointsEdit(
  spec: EvaluationSpecV2,
  sectionId: string,
  newSectionPoints: number
): { spec: EvaluationSpecV2; warning?: string } {
  const sections = spec.sections ?? [];
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return { spec };
  const minFeasible = (section.items?.length ?? 0) * MIN_POINTS_PER_ITEM;
  const target = Math.max(minFeasible, Math.round(newSectionPoints));
  const updatedSection = redistributeSectionPoints(section, target);
  const updatedSections = sections.map((s) => (s.id === sectionId ? updatedSection : s));
  const newTotal = updatedSections.reduce(
    (sum, s) => sum + (s.items ?? []).reduce((a, it) => a + (it.points ?? 0), 0),
    0
  );
  const warning =
    newSectionPoints > 0 && newSectionPoints < minFeasible
      ? `Mínimo ${minFeasible} puntos para esta sección (${section.items?.length ?? 0} ítems).`
      : undefined;
  return {
    spec: {
      ...spec,
      sections: updatedSections,
      meta: { ...spec.meta, totalPoints: newTotal }
    },
    warning
  };
}

/**
 * Result of total redistribution: updated spec and optional warning when section totals were clamped.
 */
export interface RedistributeTotalResult {
  spec: EvaluationSpecV2;
  warning?: string;
}

/**
 * Redistribute total points across sections proportionally, then within each section.
 * Section targets use largest-remainder so they sum exactly to newTotalPoints.
 */
export function redistributeTotalPoints(
  spec: EvaluationSpecV2,
  newTotalPoints: number
): RedistributeTotalResult {
  const sections = spec.sections ?? [];
  if (sections.length === 0) {
    return { spec };
  }
  const currentSectionTotals = sections.map((s) =>
    (s.items ?? []).reduce((sum, i) => sum + Math.max(0, i.points ?? 0), 0)
  );
  const currentTotal = currentSectionTotals.reduce((a, b) => a + b, 0);
  if (currentTotal <= 0) {
    return { spec };
  }
  const minPerSection = sections.map((s) => (s.items?.length ?? 0) * MIN_POINTS_PER_ITEM);
  const totalMin = minPerSection.reduce((a, b) => a + b, 0);
  const requestedTotal = Math.round(newTotalPoints);
  const targetTotal = Math.max(totalMin, requestedTotal);
  const warning =
    requestedTotal > 0 && requestedTotal < totalMin
      ? `El total pedido (${requestedTotal}) es menor que el mínimo por cantidad de ítems (${totalMin}). Se usó ${totalMin}.`
      : undefined;

  const spare = targetTotal - totalMin;
  if (spare <= 0) {
    const updatedSections = sections.map((sec, i) => redistributeSectionPoints(sec, minPerSection[i]));
    return {
      spec: {
        ...spec,
        sections: updatedSections,
        meta: { ...spec.meta, totalPoints: targetTotal }
      },
      warning
    };
  }
  const currentAboveMin = currentSectionTotals.map((t, i) => Math.max(0, t - minPerSection[i]));
  const sumAboveMin = currentAboveMin.reduce((a, b) => a + b, 0);
  const sectionTargets: number[] = sumAboveMin > 0
    ? minPerSection.map((min, i) => min + Math.round((spare * currentAboveMin[i]) / sumAboveMin))
    : minPerSection.map((min) => min + Math.floor(spare / sections.length));
  const sectionSum = sectionTargets.reduce((a, b) => a + b, 0);
  const diff = targetTotal - sectionSum;
  if (diff !== 0) {
    const idx = sectionTargets.findIndex((_, i) => (sumAboveMin > 0 ? currentAboveMin[i] > 0 : true));
    if (idx >= 0) sectionTargets[idx] += diff;
  }
  const updatedSections = sections.map((sec, i) =>
    redistributeSectionPoints(sec, Math.max(minPerSection[i], sectionTargets[i] ?? minPerSection[i]))
  );
  const actualTotal = updatedSections.reduce(
    (sum, s) => sum + (s.items ?? []).reduce((a, it) => a + (it.points ?? 0), 0),
    0
  );
  const newSpec: EvaluationSpecV2 = {
    ...spec,
    sections: updatedSections,
    meta: { ...spec.meta, totalPoints: actualTotal }
  };
  return { spec: newSpec, warning };
}
