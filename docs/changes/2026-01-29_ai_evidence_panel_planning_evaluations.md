# AI Evidence Panel for Planning and Evaluations

**Date**: 2026-01-29  
**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Type**: Feature  
**Severity**: Medium (User-facing feature)

---

## Summary

Implemented AI evidence panel (`ai_design_report`) for both planning and evaluations, showing safe design evidence (not chain-of-thought) after generation and updating on modify actions.

---

## Problem

**Symptom**: User reports the evidence panel never appears in planning nor evaluations.

**Root Cause**:
- Backend returns `ai_design_report` but frontend doesn't display it in planning
- No fallback UI when `ai_design_report` is missing
- Panel doesn't update after modify actions

---

## Solution

### 1. Backend: Ensure `ai_design_report` in Responses

**File**: `supabase/functions/generate-plan-completo/index.ts`

**Changes**:
- Added `ai_design_report` to JSON response structure
- Ensured it exists even in fallback/error cases
- Added dev logs to verify presence

**Response Structure**:
```json
{
  "plan_html": "...",
  "argumento_competencias": "...",
  "recursos": [...],
  "titulo": "...",
  "ai_design_report": {
    "inputsUsed": {
      "anepContent": true/false,
      "materials": true/false,
      "sessionBrief": true/false,
      "unitContext": true/false
    },
    "decisions": {
      "structure": "...",
      "timeAllocation": "..."
    },
    "assumptions": [...]
  }
}
```

**Note**: Evaluations already return `ai_design_report` from `modify-evaluation` edge function (Phase 6b).

### 2. Frontend: Planning Evidence Panel

**File**: `src/pages/PlanificacionWorkspace.tsx`

**Changes**:
- Added `AIDesignReport` component import
- Added `ai_design_report` to `Planificacion` type
- Load `ai_design_report` from database when loading planification
- Display panel after session editor (Row 3)
- Added fallback UI when `ai_design_report` is missing
- Added `recargarPlanificacion` function to refresh after session updates
- Call `recargarPlanificacion` after `handleActualizarSesion` to update panel

**Helper Function**:
```typescript
function adaptPlanningReportToEvaluationFormat(planningReport: any): AIDesignReportData | null {
  // Adapts planning report structure to evaluation format for reuse
  return {
    rationale: planningReport.decisions?.structure || ...,
    coverageMapping: [], // Planning doesn't have session-to-section mapping
    materialsUsage: [],
    adaptationNotes: planningReport.assumptions?.join('. ') || ...
  };
}
```

**Panel Location**:
- After session editor (Row 3 in grid)
- Collapsible panel with fallback message if missing

### 3. Frontend: Evaluations Evidence Panel

**File**: `src/pages/EvaluacionesGrupo.tsx`

**Changes** (already implemented in Phase 6):
- Panel displays after generated evaluations
- Fallback UI when `ai_design_report` is missing
- Updates after regeneration (via aggregation logic)

### 4. Database: Persist `ai_design_report`

**Planning**:
- `PlanificacionWizard.tsx`: Accumulates `ai_design_report` from all sessions
- Aggregates into single report with combined `inputsUsed`, `decisions`, `assumptions`
- Persists to `planificaciones.ai_design_report` after generation

**Evaluations**:
- Already persists in `evaluaciones.ai_design_report` (Phase 6b)

### 5. Type Updates

**File**: `src/types/planificacion.ts`

**Changes**:
- Added `ai_design_report?: any | null` to `Planificacion` interface

---

## Files Modified

1. **`supabase/functions/generate-plan-completo/index.ts`**
   - Added `ai_design_report` to response JSON structure
   - Ensured it exists in fallback cases
   - Added dev logs

2. **`src/pages/PlanificacionWorkspace.tsx`**
   - Imported `AIDesignReport` component
   - Added `recargarPlanificacion` function
   - Load `ai_design_report` from database
   - Display panel with fallback
   - Reload after session updates

3. **`src/pages/PlanificacionWizard.tsx`**
   - Accumulate `ai_design_report` from all sessions
   - Aggregate and persist to database

4. **`src/types/planificacion.ts`**
   - Added `ai_design_report` field to `Planificacion` interface

---

## Verification

### Test Case 1: Planning Generation

1. **Setup**:
   - Create a new planification
   - Generate plans for all sessions

2. **Verify**:
   - After generation, navigate to workspace
   - Panel should appear below session editor
   - Panel shows `ai_design_report` with inputs used, decisions, assumptions
   - If missing, shows fallback message

### Test Case 2: Planning Modify

1. **Setup**:
   - Open existing planification with generated plans
   - Select a session
   - Click "Regenerar con IA" and modify

2. **Verify**:
   - After modification, panel updates (via `recargarPlanificacion`)
   - Panel reflects new `ai_design_report` if updated

### Test Case 3: Evaluations Generation

1. **Setup**:
   - Create new evaluation
   - Generate evaluations

2. **Verify**:
   - Panel appears below generated evaluations
   - Shows `ai_design_report` with rationale, coverage mapping, materials usage
   - If missing, shows fallback message

### Test Case 4: Evaluations Modify

1. **Setup**:
   - Open existing evaluation
   - Click "Regenerar" on a variant

2. **Verify**:
   - Panel updates with new `ai_design_report`
   - Aggregation logic works correctly

---

## Quality Gates

- ✅ **Build**: Passes (4339 modules)
- ✅ **Type Safety**: All TypeScript types correct
- ✅ **Backward Compatibility**: Works with existing planifications/evaluations without `ai_design_report`

---

## Commits

1. **`[will be added]`** - `feat(planning): AI evidence panel + ai_design_report persistence`

---

## Known Limitations

1. **Individual Session Regeneration**: When regenerating a single session in `EditorSesionNuevo`, the `ai_design_report` in the planification is not automatically updated. The panel updates when the planification is reloaded (via `recargarPlanificacion` after `handleActualizarSesion`).

2. **Panel Format**: Planning reports are adapted to evaluation format. Some fields (like `coverageMapping`) are empty for planning since the structure is different.

3. **Real-time Updates**: Panel doesn't update in real-time during generation. User needs to wait for generation to complete and panel to refresh.

---

## Next Steps

- Consider updating `ai_design_report` in planification when individual sessions are regenerated
- Add per-session `ai_design_report` if needed
- Enhance panel format for planning-specific structure

