# Change Report: Universal Evaluation Generation (Consistency + AI Report)

**Date**: 2026-02-01  
**Branch**: `nuevas-evaluaciones`  
**Status**: In progress  
**Author**: AI Agent (Cursor)

---

## Impact Analysis

### Scope
- **Evaluation generation UI**: `src/pages/EvaluacionesGrupo.tsx`
- **Evaluation rendering UI**: `src/components/evaluaciones/*`, `src/pages/EvaluacionDetalle.tsx`
- **Contemplaciones mapping**: `src/lib/contemplaciones/*`
- **Edge function**: `supabase/functions/modify-evaluation/index.ts`
- **Group context**: `src/services/groupContext/provider.ts` (single source)

### Contracts / Guardrails Touched
- **Edge function contract** (`modify-evaluation`): additive fields only, backward compatible.
- **Contemplaciones catalog IDs**: stable IDs, additive only.
- **Explicit save pattern**: `is_saved` and `deleted_at` semantics preserved.
- **Provider-only group context**: all generation uses `getGroupContextForAI()` only.
- **AI Report**: structured, persisted, and safely rendered (legacy fallback).

### Consistency Risk (Critical)
- UI assignments (A/B/C) must match generated versions; if missing, reassign to A and warn.

### Backward Compatibility Strategy
- **Read-time**: legacy `evaluaciones[]` render unchanged.
- **Write-time**: new bundle fields additive.
- **UI fallback**: missing bundle/AI report → graceful fallback message.

---

## Deterministic Mapping Rules (Brief)

- `diseño_cuadernillo` + `norma_formato` → `INSTRUMENT_DESIGN`
- `recordatorio_docente` → `ADMIN_REMINDER`
- `regla_correccion` → `CORRECTION_REMINDER`
- Explicit `hasDeclaredContentAdaptation` → `CONTENT_ADAPTATION_EXCEPTION`

Memotecnia (#27): anchors of pensamiento, no answers.

---

## Files Changed (planned)

- `src/lib/contemplaciones/*`
- `src/services/evaluations/*`
- `supabase/functions/modify-evaluation/index.ts`
- `src/pages/EvaluacionesGrupo.tsx`
- `src/pages/EvaluacionDetalle.tsx`
- `src/components/evaluaciones/*`
- `docs/ARCHITECTURE_SSoT.md`

---

## Manual Verification Checklist (pending)

1. Sin contemplaciones → Versión A only; asignaciones A; reporte presente.
2. Con contemplaciones de estructuración → opciones equivalentes; reporte explica.
3. Con memotecnia (#27) → anclajes de pensamiento sin respuestas.
4. Con `hasDeclaredContentAdaptation` → Versión C generada y asignada.
5. Guardar y reabrir → bundle + reporte persistentes.
6. Evaluaciones legacy → fallback OK.
7. Error edge → UI no crashea; fallback/warning.

---

## Rollback Plan

- `git revert <sha>` por cada commit relacionado a esta EPIC.

---

## Branch Discipline

- Branch used: `nuevas-evaluaciones`
- Statement: no commits on `main`
