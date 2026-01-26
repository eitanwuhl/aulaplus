# Hardening: MisPlanificaciones Normalization

**Date**: 2025-12-23  
**Branch**: `Aulaplus-by-eitan-2`  
**Task**: Prevent recurrence of crash class (array/date normalization issues) in `MisPlanificaciones.tsx`

---

## Overview

This document describes the hardening applied to `MisPlanificaciones.tsx` to prevent crashes similar to those fixed in `MisEvaluaciones.tsx`. The focus is on consistent normalization of Supabase array and date fields, with defensive guards throughout the component.

---

## Assumptions Found (Before Hardening)

### 1. Array Field Assumptions

**Location**: Multiple places in `MisPlanificaciones.tsx`

**Assumption**: `sesiones[].competencias_anep` is always a `string[]` array

**Risk**:
- Supabase can return `null`, `undefined`, `""`, or string `"[]"` for `text[]` fields
- Code called `.forEach()` on non-array → `TypeError: forEach is not a function`
- Code checked `!sesion.competencias_anep` which fails if value is empty string

**Found in**:
- Line 242: `if (!sesion.competencias_anep || sesion.competencias_anep.length === 0)`
- Line 381: `sesion.competencias_anep.forEach(compId => ...)`
- Line 443: `if (sesion.competencias_anep && sesion.competencias_anep.length > 0)`
- Line 523: `s.competencias_anep && s.competencias_anep.length > 0`

### 2. Date Field Assumptions

**Location**: Multiple places in `MisPlanificaciones.tsx`

**Assumption**: `sesiones[].fecha` is always a valid date string or Date object

**Risk**:
- Supabase can return `null`, `undefined`, `""`, or invalid date strings
- Code called `new Date(sesion.fecha + 'T00:00:00')` on null → `Invalid Date`
- Code called `toLocaleDateString()` on Invalid Date → `RangeError: Invalid time value`

**Found in**:
- Line 255: `new Date(sesion.fecha + 'T00:00:00')` (no validation)
- Line 564: `new Date(sesion.fecha)` (no validation)
- Line 505-507: `new Date(s.fecha + 'T00:00:00')` (no validation)
- Line 1281-1282: `new Date(plan.fecha_inicio).toLocaleDateString()` (no validation)
- Line 1040: `fechaRange.from.toLocaleDateString()` (no validation)

### 3. Recharts Data Assumptions

**Location**: `competenciasCount` useMemo (line 434-450)

**Assumption**: `count` values are always finite numbers

**Risk**:
- If calculation produces `NaN` or `Infinity`, Recharts may crash or render incorrectly
- No validation before passing to chart component

**Found in**:
- Line 444: `count` (no validation)
- Line 445: `porcentaje` calculation (no validation for division by zero or NaN)

---

## Changes Made

### File: `src/pages/MisPlanificaciones.tsx`

#### 1. Enhanced Data Normalization at Load Time

**Lines**: 181-199 (previously 181-186)

**Before**:
```typescript
// Normalize competencias_anep to ensure it's always a string[] array
const sesionesNormalizadas = (sesionData || []).map((sesion) => ({
  ...sesion,
  competencias_anep: normalizeArrayField(sesion.competencias_anep),
}));
```

**After**:
```typescript
// Normalize data at load time to ensure consistent types
const sesionesNormalizadas = (sesionData || []).map((sesion) => {
  // Normalize competencias_anep: always ensure it's a string[]
  const competenciasNormalizadas = normalizeArrayField(sesion.competencias_anep);
  
  // Normalize fecha: convert empty string to null, validate format
  let fechaNormalizada: string | null = null;
  if (sesion.fecha) {
    const fechaStr = String(sesion.fecha).trim();
    if (fechaStr) {
      // Validate date format (YYYY-MM-DD or similar)
      const dateObj = new Date(fechaStr);
      if (!isNaN(dateObj.getTime())) {
        fechaNormalizada = fechaStr;
      }
    }
  }
  
  return {
    ...sesion,
    competencias_anep: competenciasNormalizadas,
    fecha: fechaNormalizada,
  };
});
```

**What this does**:
- ✅ Normalizes `competencias_anep` to always be `string[]` (never null/undefined/string)
- ✅ Normalizes `fecha` to always be `string | null` (never empty string or invalid format)
- ✅ Invalid dates are converted to `null` (safe to check with `if (sesion.fecha)`)
- ✅ All normalization happens once at load time

#### 2. Defensive Guards in Filter Logic

**Lines**: 241-243 (previously 241-244)

**Before**:
```typescript
// Must have at least one competency assigned (competencias_anep is already normalized at load time)
if (!sesion.competencias_anep || sesion.competencias_anep.length === 0) {
  return false;
}
```

**After**:
```typescript
// Must have at least one competency assigned (competencias_anep is already normalized at load time)
// Defensive guard: ensure it's an array (should never fail after normalization, but safety first)
if (!Array.isArray(sesion.competencias_anep) || sesion.competencias_anep.length === 0) {
  return false;
}
```

**What this does**:
- ✅ Uses `Array.isArray()` check (more explicit than truthy check)
- ✅ Prevents crashes if normalization somehow fails
- ✅ Consistent with pattern used in `MisEvaluaciones.tsx`

#### 3. Safe Date Parsing in Filter

**Lines**: 247-272 (previously 247-272)

**Before**:
```typescript
// Date range filter
if (fechaRange?.from || fechaRange?.to) {
  if (!sesion.fecha) {
    return false;
  }
  // Parse date more reliably: handle both string and Date objects
  const fechaSesion = sesion.fecha instanceof Date 
    ? sesion.fecha 
    : new Date(sesion.fecha + 'T00:00:00'); // Add time to avoid timezone issues
  
  if (fechaRange.from) {
    const startDate = new Date(fechaRange.from);
    startDate.setHours(0, 0, 0, 0);
    if (fechaSesion < startDate) {
      return false;
    }
  }
  // ... rest of date comparison
}
```

**After**:
```typescript
// Date range filter - safe date parsing
if (fechaRange?.from || fechaRange?.to) {
  if (!sesion.fecha) {
    return false;
  }
  // Parse date safely: validate before creating Date object
  let fechaSesion: Date;
  try {
    if (sesion.fecha instanceof Date) {
      fechaSesion = sesion.fecha;
    } else {
      const fechaStr = String(sesion.fecha).trim();
      if (!fechaStr) {
        return false;
      }
      fechaSesion = new Date(fechaStr + 'T00:00:00'); // Add time to avoid timezone issues
      // Validate date
      if (isNaN(fechaSesion.getTime())) {
        return false;
      }
    }
  } catch (e) {
    // Invalid date format
    return false;
  }
  
  // ... rest of date comparison (unchanged)
}
```

**What this does**:
- ✅ Validates date string before creating Date object
- ✅ Checks for Invalid Date with `isNaN(date.getTime())`
- ✅ Try-catch around date parsing
- ✅ Returns `false` (filters out) if date is invalid

#### 4. Defensive Guard in forEach Loop

**Lines**: 415-422 (previously 378-385)

**Before**:
```typescript
// sesionesFiltradas already contains only sessions with competencias_anep.length > 0
sesionesFiltradas.forEach(sesion => {
  // competencias_anep is already normalized and guaranteed to have length > 0 by filter
  sesion.competencias_anep.forEach(compId => {
    competenciasCountMap.set(compId, (competenciasCountMap.get(compId) || 0) + 1);
    totalCompetencias++;
  });
});
```

**After**:
```typescript
// sesionesFiltradas already contains only sessions with competencias_anep.length > 0
sesionesFiltradas.forEach(sesion => {
  // competencias_anep is already normalized and guaranteed to have length > 0 by filter
  // Defensive guard: ensure it's an array before forEach (should never fail, but safety first)
  if (Array.isArray(sesion.competencias_anep) && sesion.competencias_anep.length > 0) {
    sesion.competencias_anep.forEach(compId => {
      competenciasCountMap.set(compId, (competenciasCountMap.get(compId) || 0) + 1);
      totalCompetencias++;
    });
  }
});
```

**What this does**:
- ✅ Adds `Array.isArray()` check before `forEach`
- ✅ Prevents crash if normalization fails or data structure changes
- ✅ Consistent with pattern used in `MisEvaluaciones.tsx`

#### 5. Recharts Data Validation

**Lines**: 444-445 (previously 444-445)

**Before**:
```typescript
count,
porcentaje: totalCompetencias > 0 ? Math.round((count / totalCompetencias) * 100) : 0,
```

**After**:
```typescript
count: (typeof count === 'number' && isFinite(count)) ? count : 0,
porcentaje: totalCompetencias > 0 && typeof count === 'number' && isFinite(count) 
  ? Math.round((count / totalCompetencias) * 100) 
  : 0,
```

**What this does**:
- ✅ Ensures `count` is always a finite number (never `NaN` or `Infinity`)
- ✅ Validates before percentage calculation
- ✅ Prevents Recharts crashes from invalid numeric values

#### 6. Safe Date Parsing in planificacionesFiltradas Filter

**Lines**: 563-568 (previously 563-568)

**Before**:
```typescript
const hayEnRango = sesionesPlan.some(sesion => {
  const fechaSesion = new Date(sesion.fecha);
  if (fechaRange.from && fechaSesion < fechaRange.from) return false;
  if (fechaRange.to && fechaSesion > fechaRange.to) return false;
  return true;
});
```

**After**:
```typescript
const hayEnRango = sesionesPlan.some(sesion => {
  if (!sesion.fecha) return false;
  // Safe date parsing
  try {
    const fechaStr = String(sesion.fecha).trim();
    if (!fechaStr) return false;
    const fechaSesion = new Date(fechaStr);
    if (isNaN(fechaSesion.getTime())) return false;
    
    if (fechaRange.from && fechaSesion < fechaRange.from) return false;
    if (fechaRange.to && fechaSesion > fechaRange.to) return false;
    return true;
  } catch (e) {
    return false;
  }
});
```

**What this does**:
- ✅ Validates `fecha` exists before parsing
- ✅ Validates date string is not empty
- ✅ Checks for Invalid Date
- ✅ Try-catch around date operations

#### 7. Safe Date Formatting in Render (plan.fecha_inicio/fin)

**Lines**: 1280-1285 (previously 1280-1285)

**Before**:
```typescript
<span>
  {new Date(plan.fecha_inicio).toLocaleDateString('es-ES')} - {' '}
  {new Date(plan.fecha_fin).toLocaleDateString('es-ES')}
</span>
```

**After**:
```typescript
<span>
  {(() => {
    try {
      if (plan.fecha_inicio && plan.fecha_fin) {
        const inicio = new Date(plan.fecha_inicio);
        const fin = new Date(plan.fecha_fin);
        if (!isNaN(inicio.getTime()) && !isNaN(fin.getTime())) {
          return `${inicio.toLocaleDateString('es-ES')} - ${fin.toLocaleDateString('es-ES')}`;
        }
      }
    } catch (e) {
      console.warn('[PLANIFICACIONES] Error formatting dates:', e);
    }
    return 'Fechas no disponibles';
  })()}
</span>
```

**What this does**:
- ✅ Validates dates exist before formatting
- ✅ Checks for Invalid Date before `toLocaleDateString()`
- ✅ Try-catch around formatting
- ✅ Returns fallback text if dates are invalid

#### 8. Safe Date Formatting in Render (fechaRange)

**Lines**: 1038-1042 (previously 1038-1042)

**Before**:
```typescript
{fechaRange?.from && fechaRange?.to && (
  <span className="block mt-1">
    {fechaRange.from.toLocaleDateString('es-ES')} - {fechaRange.to.toLocaleDateString('es-ES')}
  </span>
)}
```

**After**:
```typescript
{fechaRange?.from && fechaRange?.to && (() => {
  try {
    const from = new Date(fechaRange.from);
    const to = new Date(fechaRange.to);
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      return (
        <span className="block mt-1">
          {from.toLocaleDateString('es-ES')} - {to.toLocaleDateString('es-ES')}
        </span>
      );
    }
  } catch (e) {
    console.warn('[PLANIFICACIONES] Error formatting date range:', e);
  }
  return null;
})()}
```

**What this does**:
- ✅ Validates dates before formatting
- ✅ Checks for Invalid Date
- ✅ Try-catch around formatting
- ✅ Returns `null` if dates are invalid (doesn't render)

#### 9. Safe Date Parsing in getEmptyBalanceReason

**Lines**: 502-519 (previously 502-519)

**Before**:
```typescript
const fechaSesion = s.fecha instanceof Date 
  ? s.fecha 
  : new Date(s.fecha + 'T00:00:00');
if (fechaRange.from) {
  const startDate = new Date(fechaRange.from);
  startDate.setHours(0, 0, 0, 0);
  if (fechaSesion < startDate) return false;
}
if (fechaRange.to) {
  const endDate = new Date(fechaRange.to);
  endDate.setHours(23, 59, 59, 999);
  if (fechaSesion > endDate) return false;
}
```

**After**:
```typescript
if (!s.fecha) return false;
try {
  const fechaStr = String(s.fecha).trim();
  if (!fechaStr) return false;
  const fechaSesion = new Date(fechaStr + 'T00:00:00');
  if (isNaN(fechaSesion.getTime())) return false;
  
  if (fechaRange.from) {
    const startDate = new Date(fechaRange.from);
    startDate.setHours(0, 0, 0, 0);
    if (fechaSesion < startDate) return false;
  }
  if (fechaRange.to) {
    const endDate = new Date(fechaRange.to);
    endDate.setHours(23, 59, 59, 999);
    if (fechaSesion > endDate) return false;
  }
} catch (e) {
  return false;
}
```

**What this does**:
- ✅ Validates `fecha` exists before parsing
- ✅ Validates date string is not empty
- ✅ Checks for Invalid Date
- ✅ Try-catch around date operations

#### 10. Defensive Guard in getEmptyBalanceReason

**Lines**: 522-524 (previously 522-524)

**Before**:
```typescript
const sesionesConCompetencias = sesionesNoOmitidas.filter(s => 
  s.competencias_anep && s.competencias_anep.length > 0
);
```

**After**:
```typescript
const sesionesConCompetencias = sesionesNoOmitidas.filter(s => 
  Array.isArray(s.competencias_anep) && s.competencias_anep.length > 0
);
```

**What this does**:
- ✅ Uses `Array.isArray()` check (more explicit)
- ✅ Consistent with other guards in the file

---

## Before/After Behavior

### Before Hardening

**Crashes Possible**:
- ❌ `TypeError: forEach is not a function` if `competencias_anep` is not an array
- ❌ `RangeError: Invalid time value` if `fecha` is invalid and formatted
- ❌ `TypeError: Cannot read property 'length' of null` if `competencias_anep` is null
- ❌ Recharts crash if `count` is `NaN` or `Infinity`

**Data Handling**:
- ❌ No normalization of `fecha` field
- ❌ No validation of date strings before parsing
- ❌ No validation of numeric values for Recharts

### After Hardening

**Crashes Prevented**:
- ✅ All array fields normalized at load time
- ✅ All date fields normalized at load time
- ✅ Defensive guards in all loops and filters
- ✅ Safe date parsing with validation
- ✅ Safe date formatting with try-catch
- ✅ Recharts receives only finite numbers

**Data Handling**:
- ✅ `competencias_anep` always `string[]` after normalization
- ✅ `fecha` always `string | null` after normalization (never empty string)
- ✅ Invalid dates converted to `null` (filtered out safely)
- ✅ All numeric values validated before passing to Recharts

---

## Files Modified

### Modified:
1. **`src/pages/MisPlanificaciones.tsx`**
   - Enhanced normalization in `useEffect` (competencias_anep + fecha)
   - Added `Array.isArray()` guards in filters and loops
   - Added safe date parsing in multiple locations
   - Added safe date formatting in render functions
   - Added Recharts data validation

**Lines Changed**: ~80 lines modified (added normalization, added guards, improved date handling)

### Reused Utilities:
- **`src/lib/normalizeSupabaseArrays.ts`** - `normalizeArrayField()` function (already imported and used)

**No New Files Created**: All changes are localized to `MisPlanificaciones.tsx`

---

## Testing Recommendations

### Manual Test Cases

1. **Empty State (No Sessions)**
   - Navigate to `/mis-planificaciones`
   - Ensure no sessions exist
   - **Expected**: Page loads, shows empty state, no crashes

2. **Sessions with Valid Data**
   - Create sessions with valid `fecha` and `competencias_anep`
   - Navigate to `/mis-planificaciones`
   - **Expected**: Page loads, chart renders, no crashes

3. **Sessions with NULL fecha**
   - (In DB) Set session `fecha` to `NULL`
   - Navigate to `/mis-planificaciones`
   - **Expected**: Session filtered out (no crash), date range filter works

4. **Sessions with Empty String fecha**
   - (In DB) Set session `fecha` to `""`
   - Navigate to `/mis-planificaciones`
   - **Expected**: Normalization converts `""` to `null`, session filtered out

5. **Sessions with NULL competencias_anep**
   - (In DB) Set session `competencias_anep` to `NULL`
   - Navigate to `/mis-planificaciones`
   - **Expected**: Normalization converts `NULL` to `[]`, session filtered out

6. **Sessions with Invalid Date String**
   - (In DB) Set session `fecha` to `"invalid-date"`
   - Navigate to `/mis-planificaciones`
   - **Expected**: Normalization converts to `null`, session filtered out

7. **Planificaciones with NULL fecha_inicio/fin**
   - (In DB) Set planificacion `fecha_inicio` or `fecha_fin` to `NULL`
   - Navigate to `/mis-planificaciones`
   - **Expected**: Shows "Fechas no disponibles" instead of crashing

8. **Chart Rendering with Edge Cases**
   - Create sessions that produce edge case counts
   - Navigate to `/mis-planificaciones`
   - Select materia and view chart
   - **Expected**: Chart renders with valid numeric values, no crashes

---

## Follow-ups Required

### Immediate (Before Production)

1. **Remove Diagnostic Logs**
   - Lines 219-356 contain extensive `[BALANCE DIAGNOSTIC]` console logs
   - These should be removed or gated behind a debug flag
   - **Risk**: Performance impact and console noise in production

2. **Runtime Testing**
   - Execute manual test cases above
   - Verify no crashes with edge case data
   - Confirm charts render correctly

### Short Term (Code Quality)

1. **Consolidate Date Normalization**
   - Consider extracting date normalization to a utility function
   - Both `MisPlanificaciones.tsx` and `MisEvaluaciones.tsx` have similar logic
   - **Benefit**: DRY principle, easier maintenance

2. **Type Safety Improvements**
   - Consider generating Supabase types automatically
   - Add runtime type guards for JSONB fields
   - **Benefit**: Catch type mismatches at compile time

### Medium Term (Architecture)

1. **Service Layer for Normalization**
   - Extract normalization logic to a service function
   - Centralize data transformation at fetch layer
   - **Benefit**: Consistent normalization across all components

2. **Error Boundaries**
   - Add permanent error boundaries (not just diagnostic)
   - Provide fallback UI for crashes
   - **Benefit**: Better user experience on unexpected errors

---

## Summary

✅ **Hardening Complete**: All identified assumptions have been addressed with normalization and defensive guards

✅ **Consistency**: Normalization pattern matches `MisEvaluaciones.tsx` (proven to work)

✅ **Type Safety**: All array and date fields are normalized at load time

✅ **Defensive Programming**: Multiple layers of guards prevent crashes even if normalization fails

✅ **Recharts Safety**: All numeric values validated before passing to chart component

⏳ **Pending**: Remove diagnostic logs, execute runtime testing

---

**Status**: ✅ Hardening implemented and ready for testing  
**Branch**: `Aulaplus-by-eitan-2`  
**Next**: Runtime testing + remove diagnostic logs


















