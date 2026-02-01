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

### Actual
- `supabase/functions/modify-evaluation/index.ts`
- `docs/ARCHITECTURE_SSoT.md`
- `src/pages/EvaluacionesGrupo.tsx`
- `src/pages/EvaluacionDetalle.tsx`
- `src/components/evaluaciones/AIDesignReport.tsx`
- `src/components/shared/AIDesignEvidencePanel.tsx`
- `src/pages/PlanificacionWorkspace.tsx`
- `src/services/evaluations/index.ts`

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

## Commit Log

- `d8c0334` docs: add impact analysis for universal evaluation generation consistency + AI report
- `205bfe3` chore(evaluations): stabilize exports and file formatting
- `3bf25aa` feat(edge/evaluations): generate version bundle aligned to deterministic plan
- `9c862f6` feat(ui): align student assignment with generated versions + fallback

---

## Rollback Plan

- `git revert 9c862f6`
- `git revert 3bf25aa`
- `git revert 205bfe3`
- `git revert d8c0334`

---

## Branch Discipline

- Branch used: `nuevas-evaluaciones`
- Statement: no commits on `main`
