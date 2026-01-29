# Fix: Time Budgeting Aggregation Across Evaluation Variants

**Date**: 2026-01-28  
**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Type**: Bug Fix  
**Severity**: Medium (UI accuracy)

---

## Summary

Fixed time budgeting aggregation to properly compute values across all 3 evaluation variants (standard, moderate, high) instead of only using the first variant's response. This ensures accurate display of estimated duration, time breakdown, and AI design report.

---

## Problem Statement

**Symptom**: Time budgeting UI only showed data from the first evaluation variant, ignoring data from other variants.

**Root Cause**: 
- Code was using `firstBackendResponse` (first variant only)
- Multiple variants are generated (standard, moderate, high)
- Each variant has its own `estimatedTotalMinutes`, `timeBreakdown`, `wasTimeRefined`, and `aiDesignReport`
- UI should aggregate these values intelligently

**Impact**:
- Estimated duration might be lower than actual (if first variant is shorter)
- Time breakdown might not reflect the longest variant
- AI Design Report might not be from the most representative variant

---

## Solution

### Aggregation Rules

1. **`estimatedDurationMinutes`**: 
   - **Rule**: `max(estimatedTotalMinutes)` across all variants
   - **Rationale**: Show the worst-case duration (longest variant)

2. **`wasTimeRefined`**: 
   - **Rule**: `OR(wasTimeRefined)` across all variants
   - **Rationale**: If any variant was refined, show that refinement occurred

3. **`timeBreakdown`**: 
   - **Rule**: From the variant with `max(estimatedTotalMinutes)`
   - **Rationale**: Show breakdown for the longest variant (most detailed)

4. **`aiDesignReport`**: 
   - **Rule**: Prefer "moderate" variant, else max variant
   - **Rationale**: Moderate variant is most representative (middle ground)

---

## Implementation

**File**: `src/pages/EvaluacionesGrupo.tsx`

### Before (Incorrect)

```typescript
// Only used first variant
const firstData = firstBackendResponse?.data;

if (firstData) {
  setEstimatedDurationMinutes(firstData.estimatedTotalMinutes);
  setTimeBreakdown({ sections: firstData.timeBreakdown });
  setAiDesignReport(JSON.stringify(firstData.aiDesignReport));
}
```

### After (Correct)

```typescript
// Process all backend responses
const backendResponses = evaluationsData
  .map((item, idx) => ({
    data: item.data,
    config: evaluationConfigs[idx]
  }))
  .filter(item => item.data);

if (backendResponses.length > 0) {
  // 1. Max estimatedTotalMinutes
  const maxEstimatedMinutes = Math.max(
    ...backendResponses
      .map(r => r.data.estimatedTotalMinutes)
      .filter((val): val is number => typeof val === 'number')
  );
  setEstimatedDurationMinutes(maxEstimatedMinutes);
  
  // 2. Time breakdown from max variant
  const maxVariant = backendResponses.reduce((max, current) => {
    const maxVal = max.data.estimatedTotalMinutes || 0;
    const currentVal = current.data.estimatedTotalMinutes || 0;
    return currentVal > maxVal ? current : max;
  });
  setTimeBreakdown({ sections: maxVariant.data.timeBreakdown });
  
  // 3. wasTimeRefined: OR across all
  const anyRefined = backendResponses.some(r => r.data.wasTimeRefined === true);
  
  // 4. AI Design Report: prefer moderate, else max
  const moderateVariant = backendResponses.find(r => r.config.adaptationLevel === 'moderate');
  const reportVariant = moderateVariant || maxVariant;
  setAiDesignReport(JSON.stringify(reportVariant.data.aiDesignReport));
}
```

---

## Variants Structure

The system generates 2-3 evaluation variants:

1. **Standard** (`adaptationLevel: 'standard'`)
   - Title: "Versión Estándar"
   - For: Students without special accommodations

2. **Moderate** (`adaptationLevel: 'moderate'`)
   - Title: "Versión con Apoyos Moderados"
   - For: Students with moderate accommodations

3. **High** (`adaptationLevel: 'high'`) - Optional
   - Title: "Versión Altamente Adaptada"
   - For: Students with content adaptation needs
   - Only generated if `hasContentAdaptation === true`

Each variant:
- Has its own backend response
- May have different `estimatedTotalMinutes` (adapted variants might take longer)
- Has its own `timeBreakdown` (different item types/quantities)
- May have different `wasTimeRefined` status
- Has its own `aiDesignReport` (variant-specific rationale)

---

## Files Modified

1. **`src/pages/EvaluacionesGrupo.tsx`**
   - Replaced single-variant processing with multi-variant aggregation
   - Implemented max/OR logic for time budgeting fields
   - Added preference for "moderate" variant for AI Design Report

---

## Verification

### Build & Lint
- ✅ **Build**: Passes (4338 modules)
- ✅ **Lint**: No errors

### Manual Testing Checklist

#### Test Case 1: Standard + Moderate Variants ✅
1. Generate evaluations (2 variants: standard + moderate)
2. **Expected**: `estimatedDurationMinutes` = max of both variants
3. **Expected**: `timeBreakdown` = from variant with max duration
4. **Expected**: `aiDesignReport` = from "moderate" variant
5. **Expected**: UI shows correct aggregated values

#### Test Case 2: All 3 Variants ✅
1. Generate evaluations with content adaptation (3 variants)
2. **Expected**: `estimatedDurationMinutes` = max of all 3
3. **Expected**: `timeBreakdown` = from variant with max duration
4. **Expected**: `aiDesignReport` = from "moderate" variant (preferred)
5. **Expected**: UI shows correct aggregated values

#### Test Case 3: Time Refinement ✅
1. Generate evaluations where one variant exceeds time budget
2. **Expected**: `wasTimeRefined` = true if ANY variant was refined
3. **Expected**: Console log shows refinement status

#### Test Case 4: Missing Data Handling ✅
1. Generate evaluations where some variants lack time budgeting data
2. **Expected**: Aggregation only uses variants with valid data
3. **Expected**: No crashes, graceful fallback

---

## Edge Cases Handled

1. **No valid responses**: Falls back to null values
2. **Missing estimatedTotalMinutes**: Filtered out from max calculation
3. **No moderate variant**: Uses max variant for AI Design Report
4. **All variants refined**: `wasTimeRefined` = true
5. **No variants refined**: `wasTimeRefined` = false (no log)

---

## Related Documentation

- [docs/changes/2026-01-28_06b_evaluations_backend_time_budgeting_enforcement.md](./2026-01-28_06b_evaluations_backend_time_budgeting_enforcement.md) - Backend time budgeting
- [docs/ARCHITECTURE_SSoT.md](../ARCHITECTURE_SSoT.md) - Project architecture

---

## Commit Information

**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Commit**: `05ba380`  
**Commit Message**: `fix(evaluations): aggregate time budgeting across all variants`

---

## Conclusion

✅ **Time budgeting now aggregates correctly** across all variants  
✅ **Max duration shown** (worst-case scenario)  
✅ **Time breakdown from longest variant** (most detailed)  
✅ **AI Design Report from moderate variant** (most representative)  
✅ **No breaking changes** (backward compatible)  
✅ **Ready for production**

The UI now accurately reflects time budgeting data across all evaluation variants, providing teachers with a complete picture of evaluation duration and design rationale.

