# V2 Panels Restoration Audit

> **Date:** 2026-02-06  
> **Status:** Complete (Updated with blank screen fix)

## Executive Summary

This audit identified and fixed multiple critical issues in the V2 evaluation flow:

1. **V2 endpoint never called** - Fixed by adding conditional routing based on `useBetaV2`
2. **Blank screen bug** - The entire results section was gated by `displayEvaluations.length > 0`, which is always empty in V2 mode
3. **Missing features** - Added version selector (A/B/C) and PDF export button

## Problem Analysis

### Issue #1: V2 Endpoint Never Called (Fixed Previously)
- `handleGenerateEvaluations()` always called `modify-evaluation` (v1)
- `v2RawResponse` was never populated

### Issue #2: Blank Screen (NEW - Fixed Today)
**Root Cause:** The entire results rendering block was wrapped in:
```tsx
{displayEvaluations.length > 0 && (
  // ALL V2 AND V1 RENDERING HERE
)}
```

In V2 mode, `displayEvaluations` is an empty array because V2 uses JSON rendering, not HTML-based `GeneratedEvaluation[]`. This caused the **entire results section to be hidden**.

**Fix:** Changed condition to include V2:
```tsx
{(displayEvaluations.length > 0 || (useBetaV2 && v2RawResponse)) && (
  // Now V2 mode renders correctly
)}
```

### Issue #3: Missing UI Features
- No version selector to switch between A/B/C
- No PDF export button

## Solutions Implemented

### 1. Conditional Results Rendering
**File:** [EvaluacionesGrupo.tsx](../src/pages/EvaluacionesGrupo.tsx)

Changed the visibility condition to include V2 responses:
```diff
- {displayEvaluations.length > 0 && (
+ {(displayEvaluations.length > 0 || (useBetaV2 && v2RawResponse)) && (
```

### 2. Enhanced EvaluationRendererV2 with Version Selector + PDF Export
**File:** [EvaluationRendererV2.tsx](../src/components/evaluaciones/v2/EvaluationRendererV2.tsx)

Added:
- Internal version state with external control option
- Select dropdown to switch between A/B/C versions
- Badge buttons for quick version switching
- PDF export using jsPDF + html2canvas
- Extensive debug logging for diagnosis

### 3. Diagnostic Logging
Added comprehensive console logging throughout the V2 pipeline:
- `[EVAL_PIPELINE]` - Request/response in main page
- `[V2_RENDERER]` - Normalization and rendering decisions
- `[V2_NORMALIZER]` - canRenderV2 validation steps
- `[V2_INFO_PANELS]` - Panel rendering state

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/EvaluacionesGrupo.tsx` | Conditional rendering fix, V2 response logging |
| `src/components/evaluaciones/v2/EvaluationRendererV2.tsx` | Version selector, PDF export, debug logging |
| `src/components/evaluaciones/v2/V2InfoPanels.tsx` | Debug logging, error state handling |
| `src/services/evaluations/v2Normalizer.ts` | Detailed validation logging in canRenderV2 |

## Verification Checklist

### Prerequisites
- [ ] Local dev server running (`npm run dev`)
- [ ] Browser console open to see debug logs
- [ ] Test group with students configured

### V2 Mode Testing
1. [ ] Toggle Beta V2 ON
2. [ ] Click "Generar evaluaciones"
3. [ ] **Check console for:** `[EVAL_PIPELINE] V2 response received successfully`
4. [ ] **Check console for:** `[V2_NORMALIZER] canRenderV2 PASS ✓`
5. [ ] **Check console for:** `[V2_RENDERER] Rendering evaluation successfully`
6. [ ] **Verify UI shows:**
   - [ ] Version selector with A/B/C options
   - [ ] PDF export button
   - [ ] V2InfoPanels (collapsible):
     - [ ] Versiones generadas
     - [ ] Recordatorios para el docente
     - [ ] Reporte de diseño de IA
     - [ ] Criterios de logro
   - [ ] Evaluation content (header, map table, sections)
7. [ ] **Test version switching:** Click A, B, C - content should update
8. [ ] **Test PDF export:** Click "Descargar PDF" - file should download

### Blank Screen Diagnosis (if issue persists)
1. Check console for: `[V2_NORMALIZER] canRenderV2 FAIL:` + reason
2. Verify response has:
   - `success: true`
   - `evaluationSpec` with `sections` array
   - At least one section with `items` array containing items

### V1 Mode Testing  
1. [ ] Toggle Beta V2 OFF
2. [ ] Generate evaluation
3. [ ] Verify V1 panels and HTML renderer display correctly

## What Was Broken

| Symptom | Root Cause | Fix |
|---------|------------|-----|
| Blank screen after generation | `displayEvaluations.length > 0` condition hid V2 content | Added `|| (useBetaV2 && v2RawResponse)` |
| No version switching | Not implemented | Added Select dropdown + Badge buttons |
| No PDF export | Not implemented | Added jsPDF + html2canvas export |
| Silent failures | No logging | Added comprehensive `console.log/warn` |

## Recommendations

### Short-term
1. Remove debug logging after V2 is stable (or gate behind env flag)
2. Add E2E tests for V2 flow
3. Consider adding loading state indicator during PDF export

### Long-term
1. Once V2 is stable, make it the default
2. Remove V1 code paths
3. Add proper error tracking (Sentry, etc.)

---

*This audit was updated on 2026-02-06 to document the blank screen fix.*
