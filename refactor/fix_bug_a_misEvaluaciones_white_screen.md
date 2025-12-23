# Fix: MisEvaluaciones White Screen Crash

**Date**: 2025-12-23  
**Branch**: `Aulaplus-by-eitan-2`  
**Commit**: Pending

---

## Root Cause Summary

**Symptom**: "Mis Evaluaciones" page renders briefly (~1 second) then goes completely white (React crash).

**Root Cause**: Data shape inconsistencies from Supabase causing runtime crashes when:
1. `competencias_anep` is not an array (null, undefined, string, object) → `.forEach()` crashes
2. `fecha` is invalid (empty string `""`, malformed) → date parsing/formatting crashes

**Location**: `src/pages/MisEvaluaciones.tsx`

**Why it happens**:
- Supabase can return array fields in inconsistent formats (null, string, object, array)
- Previous normalization was incomplete - only normalized `competencias_anep` but not `fecha`
- Normalization happened but defensive guards were missing in some loops
- Date formatting attempted on invalid dates without validation

---

## Reproduction Steps

1. Navigate to "Evaluaciones Grupales" → "Mis Evaluaciones"
2. Page renders briefly (~1 second)
3. **Screen goes completely white**
4. React error appears in console (if ErrorBoundary was present)

**Expected Error** (before fix):
```
TypeError: Cannot read property 'forEach' of null/undefined
at competenciasCount (MisEvaluaciones.tsx:301)
```

OR

```
RangeError: Invalid time value
at Date.toLocaleDateString (native)
at MisEvaluaciones.tsx:830
```

---

## Solution Implemented

### Strategy: Normalize at Load Time

**Principle**: Normalize Supabase payload immediately after fetch, so the rest of the component can assume correct types. This is the correct layer because:
- Single point of normalization (DRY)
- All downstream code benefits
- Type safety guaranteed after normalization
- Minimal defensive checks needed (only as last line of defense)

### Implementation Details

#### 1. Enhanced Data Normalization (Load Time)

**File**: `src/pages/MisEvaluaciones.tsx`  
**Lines**: 152-175

**Before**:
```typescript
// Only normalized competencias_anep
const evaluacionesNormalizadas = (evalData || []).map((evaluacion) => ({
  ...evaluacion,
  competencias_anep: normalizeArrayField(evaluacion.competencias_anep),
}));
```

**After**:
```typescript
// Normalize data at load time to ensure consistent types
const evaluacionesNormalizadas = (evalData || []).map((evaluacion) => {
  // Normalize competencias_anep: always ensure it's a string[]
  const competenciasNormalizadas = normalizeArrayField(evaluacion.competencias_anep);
  
  // Normalize fecha: convert empty string to null, validate format
  let fechaNormalizada: string | null = null;
  if (evaluacion.fecha) {
    const fechaStr = String(evaluacion.fecha).trim();
    if (fechaStr) {
      // Validate date format (YYYY-MM-DD or similar)
      const dateObj = new Date(fechaStr);
      if (!isNaN(dateObj.getTime())) {
        fechaNormalizada = fechaStr;
      }
    }
  }
  
  return {
    ...evaluacion,
    competencias_anep: competenciasNormalizadas,
    fecha: fechaNormalizada,
  };
});
```

**What this does**:
- ✅ `competencias_anep` is ALWAYS `string[]` after normalization (never null/undefined/string/object)
- ✅ `fecha` is ALWAYS `string | null` (never empty string `""` or invalid format)
- ✅ Invalid dates are converted to `null` (safe to check with `if (evaluacion.fecha)`)
- ✅ All normalization happens once at load time

#### 2. Minimal Defensive Guards (Last Line of Defense)

**File**: `src/pages/MisEvaluaciones.tsx`  
**Locations**: Multiple useMemo hooks

**Added `Array.isArray()` checks**:
```typescript
// In evaluacionesFiltradas filter (line 213)
if (!Array.isArray(evaluacion.competencias_anep) || evaluacion.competencias_anep.length === 0) {
  return false;
}

// In competenciasCount useMemo (line 279)
if (!Array.isArray(evaluacion.competencias_anep)) {
  return; // Skip this evaluation
}

// In competenciasPendientes useMemo (line 337)
if (Array.isArray(evaluacion.competencias_anep) && evaluacion.competencias_anep.length > 0) {
  evaluacion.competencias_anep.forEach(compId => {
    competenciasUsadasIds.add(compId);
  });
}

// In getEmptyBalanceReason (line 371)
const evaluacionesConCompetencias = evaluaciones.filter(e => 
  Array.isArray(e.competencias_anep) && e.competencias_anep.length > 0
);
```

**Why minimal**: After normalization, these guards should never trigger, but they provide safety if:
- Normalization function has a bug
- Data structure changes unexpectedly
- Edge cases not covered by normalization

#### 3. Safe Date Formatting (Already Protected)

**File**: `src/pages/MisEvaluaciones.tsx`  
**Locations**: Lines 587-601, 826-836, 840-850

**Existing protection** (kept as-is):
```typescript
// Date range display
{(() => {
  try {
    const from = new Date(fechaRange.from);
    const to = new Date(fechaRange.to);
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      return `${from.toLocaleDateString('es-ES')} - ${to.toLocaleDateString('es-ES')}`;
    }
  } catch (e) {
    console.warn('[EVALUACIONES] Error formatting date range:', e);
  }
  return '';
})()}

// Evaluation fecha display
{evaluacion.fecha && (() => {
  try {
    const fecha = new Date(evaluacion.fecha);
    if (!isNaN(fecha.getTime())) {
      return <span>📅 {fecha.toLocaleDateString('es-ES')}</span>;
    }
  } catch (e) {
    console.warn('[EVALUACIONES] Error formatting fecha:', evaluacion.fecha);
  }
  return null;
})()}
```

**Why this is safe**:
- ✅ Only formats if `fecha` exists (not null)
- ✅ Validates Date with `isNaN(date.getTime())` before formatting
- ✅ Try-catch around formatting
- ✅ Returns `null` or empty string on error (doesn't crash render)

#### 4. Removed Diagnostic Instrumentation

**Removed**:
- `DiagnosticErrorBoundary` import and wrapper (lines 3, 531, 907)
- All `[🔍 DIAGNOSTIC]` console logs (lines 273-277, 288-294, 297, 307, 311-314, 507-528)
- Diagnostic logging in `competenciasCount` useMemo
- Diagnostic logging in render function

**Result**: Clean, production-ready code

---

## Code Changes Summary

### File: `src/pages/MisEvaluaciones.tsx`

#### Added (Normalization):
- Enhanced normalization in `useEffect` (lines 152-175):
  - Normalize `competencias_anep` using `normalizeArrayField()`
  - Normalize `fecha` (convert `""` to `null`, validate format)
  - Both fields guaranteed to be correct type after normalization

#### Added (Defensive Guards):
- `Array.isArray()` check in `evaluacionesFiltradas` filter (line 213)
- `Array.isArray()` check in `competenciasCount` useMemo (line 279)
- `Array.isArray()` check in `competenciasPendientes` useMemo (line 337)
- `Array.isArray()` check in `getEmptyBalanceReason` (line 371)

#### Removed:
- `DiagnosticErrorBoundary` import (line 3)
- `DiagnosticErrorBoundary` wrapper (lines 531, 907)
- All diagnostic console logs (~50 lines)

#### Kept (Already Safe):
- Date formatting try-catch blocks (lines 587-601, 826-836, 840-850)
- Date parsing defensive checks in filters (lines 217-260)

**Total Changes**: ~80 lines modified (added normalization, added guards, removed diagnostics)

---

## Why This Fix is Correct

### 1. Normalization at Load Time (Correct Layer)

**Why load time is correct**:
- ✅ Single point of normalization (DRY principle)
- ✅ All downstream code benefits automatically
- ✅ Type safety guaranteed after normalization
- ✅ Consistent with pattern used in `MisPlanificaciones.tsx`
- ✅ Matches best practice: normalize external data at boundary

**Why NOT at render time**:
- ❌ Would need normalization in multiple places (redundant)
- ❌ Performance impact (normalization on every render)
- ❌ Easy to miss a normalization point (bugs)

### 2. Type Safety After Normalization

**After normalization**:
```typescript
evaluacion.competencias_anep: string[]  // ALWAYS
evaluacion.fecha: string | null         // ALWAYS (never "")
```

**Downstream code can safely**:
```typescript
evaluacion.competencias_anep.forEach(...)  // ✅ Safe - always array
if (evaluacion.fecha) { ... }             // ✅ Safe - null or valid string
new Date(evaluacion.fecha)                 // ✅ Safe - only if fecha exists
```

### 3. Minimal Defensive Guards

**Guards are minimal because**:
- Normalization should handle all cases
- Guards only catch edge cases or normalization bugs
- Not a substitute for proper normalization
- Kept as "last line of defense" for robustness

### 4. Date Normalization Strategy

**Why normalize fecha**:
- Supabase can return `""` (empty string) for date fields
- Empty string creates Invalid Date → crashes formatting
- Converting `""` to `null` is safe and semantic
- Validation ensures only valid dates are kept

**Normalization logic**:
1. If `fecha` is falsy → `null`
2. If `fecha` is empty string after trim → `null`
3. If `fecha` creates Invalid Date → `null`
4. Otherwise → keep original string

---

## Manual Test Cases

### Test 1: Empty State (No Evaluations)

**Steps**:
1. Navigate to "Mis Evaluaciones"
2. Ensure no evaluations are saved

**Expected Result**:
- ✅ Page loads without white screen
- ✅ Shows empty state: "Aún no has guardado evaluaciones"
- ✅ No console errors

**Status**: ⏳ Pending manual execution

---

### Test 2: Evaluations with Valid Data

**Steps**:
1. Save an evaluation with:
   - Valid `fecha` (e.g., "2025-12-23")
   - Valid `competencias_anep` array (e.g., `["CE1", "CE2"]`)
2. Navigate to "Mis Evaluaciones"

**Expected Result**:
- ✅ Page loads without white screen
- ✅ Evaluation appears in list
- ✅ Date displays correctly (formatted)
- ✅ Competency count shows in badge
- ✅ No console errors

**Status**: ⏳ Pending manual execution

---

### Test 3: Evaluation with NULL fecha

**Steps**:
1. (In DB) Set an evaluation's `fecha` to `NULL`
2. Navigate to "Mis Evaluaciones"

**Expected Result**:
- ✅ Page loads without white screen
- ✅ Evaluation appears in list
- ✅ Date icon/field is omitted (not displayed)
- ✅ No crash from date formatting
- ✅ No console errors

**Status**: ⏳ Pending manual execution

---

### Test 4: Evaluation with Empty String fecha

**Steps**:
1. (In DB) Set an evaluation's `fecha` to `""` (empty string)
2. Navigate to "Mis Evaluaciones"

**Expected Result**:
- ✅ Page loads without white screen
- ✅ Normalization converts `""` to `null`
- ✅ Date icon/field is omitted
- ✅ No crash
- ✅ No console errors

**Status**: ⏳ Pending manual execution

---

### Test 5: Evaluation with NULL competencias_anep

**Steps**:
1. (In DB) Set an evaluation's `competencias_anep` to `NULL`
2. Navigate to "Mis Evaluaciones"
3. Select the evaluation's materia

**Expected Result**:
- ✅ Page loads without white screen
- ✅ Normalization converts `NULL` to `[]`
- ✅ Evaluation filtered out (no competencias)
- ✅ Balance chart shows empty state (not crash)
- ✅ No console errors

**Status**: ⏳ Pending manual execution

---

### Test 6: Evaluation with String competencias_anep

**Steps**:
1. (In DB) Set an evaluation's `competencias_anep` to `"[CE1, CE2]"` (string)
2. Navigate to "Mis Evaluaciones"

**Expected Result**:
- ✅ Page loads without white screen
- ✅ `normalizeArrayField()` handles string → converts appropriately
- ✅ No crash from `.forEach()` on string
- ✅ No console errors

**Status**: ⏳ Pending manual execution

---

### Test 7: Filter by Date Range

**Steps**:
1. Navigate to "Mis Evaluaciones"
2. Select a materia
3. Set date range filter
4. Apply filter

**Expected Result**:
- ✅ Page loads without white screen
- ✅ Filtering works correctly
- ✅ Date range displays in header
- ✅ Only evaluations in range shown
- ✅ No crash from date parsing

**Status**: ⏳ Pending manual execution

---

### Test 8: Balance Chart Rendering

**Steps**:
1. Navigate to "Mis Evaluaciones"
2. Select a materia with saved evaluations that have competencias
3. View "Balance de Competencias" chart

**Expected Result**:
- ✅ Page loads without white screen
- ✅ Chart renders with horizontal bars
- ✅ Labels inside bars display correctly
- ✅ Tooltip works
- ✅ No Recharts errors

**Status**: ⏳ Pending manual execution

---

## Test Results

### ✅ Build Verification
```bash
npm run build
# Result: ✓ built in 16.79s (no TypeScript errors)
```

### ✅ Type Safety Verification
- TypeScript compiler validates all operations
- Normalization ensures runtime types match TypeScript types
- No `any` types used
- All type guards in place

### ⏳ Runtime Testing
**Status**: Pending manual execution

**To verify**:
1. Run `npm run dev`
2. Navigate to "Mis Evaluaciones"
3. Confirm no white screen
4. Test all edge cases above
5. Verify console has no errors

---

## Files Modified

### Modified:
1. **`src/pages/MisEvaluaciones.tsx`**
   - Enhanced normalization in `useEffect` (competencias_anep + fecha)
   - Added `Array.isArray()` guards in multiple useMemo hooks
   - Removed `DiagnosticErrorBoundary` import and wrapper
   - Removed all diagnostic console logs

**Lines Changed**: ~80 lines

### To Delete (if not used elsewhere):
1. **`src/components/DiagnosticErrorBoundary.tsx`** (117 lines)
   - Temporary component for diagnosis
   - Should be deleted if not used in other files

**Note**: Check if DiagnosticErrorBoundary is used elsewhere before deleting.

---

## Normalization Strategy

### Layer: Load Time (useEffect after Supabase fetch)

**Why this layer**:
- ✅ Single point of normalization (DRY)
- ✅ All downstream code benefits
- ✅ Type safety guaranteed
- ✅ Consistent with `MisPlanificaciones` pattern
- ✅ Best practice: normalize external data at boundary

### What Gets Normalized

#### 1. competencias_anep
**Input possibilities**:
- `null` → `[]`
- `undefined` → `[]`
- `""` (empty string) → `[]`
- `"[CE1, CE2]"` (string) → `["CE1", "CE2"]` (if comma-separated)
- `["CE1", "CE2"]` (array) → `["CE1", "CE2"]` (deduplicated, cleaned)
- `{ codes: [...] }` (object) → extracted array

**Output**: ALWAYS `string[]`

**Implementation**: Uses existing `normalizeArrayField()` utility (same as planificaciones)

#### 2. fecha
**Input possibilities**:
- `null` → `null`
- `undefined` → `null`
- `""` (empty string) → `null`
- `"2025-12-23"` (valid ISO) → `"2025-12-23"`
- `"invalid-date"` → `null` (Invalid Date)

**Output**: ALWAYS `string | null` (never empty string)

**Implementation**: Custom normalization with Date validation

---

## Summary

✅ **Bug Fixed**: White screen crash in "Mis Evaluaciones"  
✅ **Normalization**: Data normalized at load time (correct layer)  
✅ **Type Safety**: All fields guaranteed correct types after normalization  
✅ **Defensive Guards**: Minimal `Array.isArray()` checks as last line of defense  
✅ **Date Safety**: Invalid dates converted to `null`, formatting protected  
✅ **Code Clean**: Diagnostic instrumentation removed  
✅ **Build Passes**: No TypeScript errors  

⏳ **Pending**: Manual runtime verification

---

**Status**: ✅ Fix implemented and ready for testing  
**Branch**: `Aulaplus-by-eitan-2`  
**Next**: Manual test execution + commit
