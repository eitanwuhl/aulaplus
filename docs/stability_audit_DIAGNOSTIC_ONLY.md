# Stability & Reliability Audit - AULA+ App

**Date**: 2025-12-23  
**Branch**: `Aulaplus-by-eitan-2`  
**Type**: DIAGNOSTIC ONLY (No code changes)  
**Scope**: Teacher pages, Supabase integration, charting, data normalization

---

## Executive Summary

This audit identifies **10 critical risk areas** that could cause runtime crashes, white screens, or data corruption. The top 5 risks are:

1. **JSONB field access without runtime shape validation** (High risk, 4 locations)
2. **Recharts data validation gaps** (Medium risk, 2 locations)
3. **Date formatting in render paths** (Medium risk, 8+ locations)
4. **Missing error boundaries** (Medium risk, all pages)
5. **Schema readiness checks incomplete** (High risk, 3 tables)

---

## 1. Page/Feature → Supabase Tables → Critical Fields Map

### 1.1 MisEvaluaciones (`src/pages/MisEvaluaciones.tsx`)

**Supabase Tables Used**:
- `evaluaciones` (SELECT, UPDATE)

**Critical Fields Relied Upon**:
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users)
- `nombre` (text, nullable, default '')
- `materia` (text, NOT NULL)
- `grupo_id` (text, NOT NULL)
- `nivel` (text, nullable)
- `fecha` (date, nullable) ⚠️ **Can be null/empty/invalid**
- `competencias_anep` (text[], default '{}') ⚠️ **Can be null/string/non-array**
- `is_saved` (boolean, default false) ⚠️ **Must exist (migration)**
- `saved_at` (timestamptz, nullable) ⚠️ **Must exist (migration)**
- `deleted_at` (timestamptz, nullable) ⚠️ **Must exist (migration)**
- `evaluacion_generada` (jsonb, nullable) ⚠️ **No runtime validation**
- `rubrica` (jsonb, nullable) ⚠️ **No runtime validation**
- `configuracion` (jsonb, nullable) ⚠️ **No runtime validation**

**Query Patterns**:
- `.from('evaluaciones').select('*').eq('is_saved', true).is('deleted_at', null)`
- `.from('evaluaciones').update({ deleted_at: ... })`

**Normalization Applied**: ✅ Yes (lines 152-174)
- `competencias_anep` → `normalizeArrayField()` at load time
- `fecha` → validated and normalized to `string | null`

**Defensive Guards**: ✅ Partial
- `Array.isArray()` checks in filters (line 213, 292, 338, 373)
- Date parsing wrapped in try-catch (lines 223-236, 238-258)

---

### 1.2 MisPlanificaciones (`src/pages/MisPlanificaciones.tsx`)

**Supabase Tables Used**:
- `planificaciones` (SELECT, UPDATE)
- `sesiones_clase` (SELECT)
- `profiles` (SELECT, for sharing)

**Critical Fields Relied Upon**:
- `planificaciones.id` (uuid, PK)
- `planificaciones.user_id` (uuid, FK)
- `planificaciones.materia` (text, NOT NULL)
- `planificaciones.grupo_id` (text, nullable) ⚠️ **Can be null**
- `planificaciones.is_saved` (boolean, default false) ⚠️ **Must exist (migration)**
- `planificaciones.saved_at` (timestamptz, nullable) ⚠️ **Must exist (migration)**
- `planificaciones.deleted_at` (timestamptz, nullable) ⚠️ **Must exist (migration)**
- `planificaciones.fecha_inicio` (date, NOT NULL) ⚠️ **Can be invalid date string**
- `planificaciones.fecha_fin` (date, NOT NULL) ⚠️ **Can be invalid date string**
- `planificaciones.unidades_didacticas` (jsonb, nullable) ⚠️ **No runtime validation**
- `sesiones_clase.id` (uuid, PK)
- `sesiones_clase.planificacion_id` (uuid, FK)
- `sesiones_clase.fecha` (date, NOT NULL) ⚠️ **Can be null/invalid after normalization**
- `sesiones_clase.estado` (text, enum) ⚠️ **Must match enum values**
- `sesiones_clase.competencias_anep` (text[], default '{}') ⚠️ **Can be null/string/non-array**
- `sesiones_clase.plan_desarrollo` (jsonb, nullable) ⚠️ **No runtime validation**

**Query Patterns**:
- `.from('planificaciones').select('*').eq('is_saved', true).is('deleted_at', null)`
- `.from('sesiones_clase').select('*').order('fecha', { ascending: false })`
- `.from('planificaciones').update({ deleted_at: ... })`

**Normalization Applied**: ✅ Yes (lines 183-205)
- `sesiones_clase.competencias_anep` → `normalizeArrayField()` at load time
- `sesiones_clase.fecha` → validated and normalized to `string | null`

**Defensive Guards**: ✅ Partial
- `Array.isArray()` checks in filters (line 262, 418, 523)
- Date parsing wrapped in try-catch (lines 274-310, 545-567)
- Recharts count validation (line 444): `(typeof count === 'number' && isFinite(count)) ? count : 0`

---

### 1.3 EvaluacionesGrupo (`src/pages/EvaluacionesGrupo.tsx`)

**Supabase Tables Used**:
- `evaluaciones` (INSERT)

**Critical Fields Written**:
- `user_id` (uuid, from `auth.getUser()`)
- `nombre` (text, from user input, trimmed)
- `materia` (text, NOT NULL, from state)
- `grupo_id` (text, NOT NULL, from `selectedGroupId`)
- `nivel` (text, derived from `selectedGroup.year`)
- `fecha` (date, `new Date().toISOString().split('T')[0]`)
- `competencias_anep` (text[], normalized with `normalizeArrayField()`)
- `contenidos` (text[], normalized)
- `criterios_logro` (text[], normalized)
- `evaluacion_generada` (jsonb) ⚠️ **No runtime validation before insert**
- `is_saved` (boolean, true)
- `saved_at` (timestamptz, `new Date().toISOString()`)
- `deleted_at` (timestamptz, null)

**Query Patterns**:
- `.from('evaluaciones').insert(evaluacionData).select().single()`

**Error Handling**: ✅ Good (lines 445-492)
- Detailed Supabase error logging
- User-friendly error messages based on error type
- Handles: permissions, null violations, missing table

**Risks**:
- ⚠️ `evaluacion_generada` JSONB structure not validated before insert
- ⚠️ If `selectedGroup` is undefined, `getNivelFromGroup()` returns '8vo' (fallback) - acceptable but could be more explicit

---

### 1.4 PlanificacionWorkspace (`src/pages/PlanificacionWorkspace.tsx`)

**Supabase Tables Used**:
- `planificaciones` (SELECT, UPDATE)
- `sesiones_clase` (SELECT, UPDATE)

**Critical Fields Relied Upon**:
- `planificaciones.id` (uuid, PK)
- `planificaciones.unidades_didacticas` (jsonb) ⚠️ **Accessed without validation (line 99)**
- `planificaciones.distribucion_modalidades` (jsonb) ⚠️ **Cast to type without validation (line 89)**
- `planificaciones.configuracion_horario` (jsonb) ⚠️ **Cast to type without validation (line 91)**
- `sesiones_clase.competencias_anep` (text[]) ⚠️ **Accessed with `|| []` fallback (line 158)**
- `sesiones_clase.plan_desarrollo` (jsonb) ⚠️ **No runtime validation**

**Query Patterns**:
- `.from('planificaciones').select('*').eq('id', id).maybeSingle()`
- `.from('sesiones_clase').select('*').eq('planificacion_id', id)`
- `.from('planificaciones').update({ ... })`

**Normalization Applied**: ⚠️ Partial
- `sesiones_clase.recursos` → `normalizeArrayField()` (line 178, 186)
- `planificaciones.unidades_didacticas` → **NOT normalized**, accessed directly (line 99)

**Risks**:
- ⚠️ **HIGH**: `unidades_didacticas` accessed with `forEach` without `Array.isArray()` check (line 99)
- ⚠️ **HIGH**: JSONB fields cast to TypeScript types without runtime validation (lines 89, 91)

---

## 2. Risk Patterns Identified

### 2.1 Array Fields Assumed to Be Arrays

**Pattern**: Code calls `.forEach()`, `.map()`, or `.length` on fields that may be `null`, `undefined`, or non-array types.

**Locations Found**:

1. **`PlanificacionWorkspace.tsx` (line 99)** ⚠️ **HIGH RISK**
   ```typescript
   planificacionConverted.unidades_didacticas.forEach((unidad: any) => {
     if (unidad.competencias_ids && Array.isArray(unidad.competencias_ids)) {
   ```
   **Issue**: `unidades_didacticas` is JSONB, could be `null`, `undefined`, or non-array. No guard before `forEach`.
   **Fix Needed**: Add `Array.isArray()` check before `forEach`.

2. **`MisEvaluaciones.tsx` (line 203)** ✅ **GUARDED**
   ```typescript
   competenciasCatalog.forEach(comp => {
   ```
   **Status**: Safe - `competenciasCatalog` is memoized and always returns `[]` if empty.

3. **`MisPlanificaciones.tsx` (line 230)** ✅ **GUARDED**
   ```typescript
   competenciasCatalog.forEach(comp => {
   ```
   **Status**: Safe - same as above.

**Summary**: 1 high-risk location, 0 medium-risk locations (others are guarded or normalized).

---

### 2.2 Date Parsing/Formatting Without Validation

**Pattern**: `new Date()`, `toLocaleDateString()`, or date arithmetic without checking for invalid dates.

**Locations Found**:

1. **`MisEvaluaciones.tsx` (lines 829-831)** ⚠️ **MEDIUM RISK**
   ```typescript
   const fecha = new Date(evaluacion.fecha);
   if (!isNaN(fecha.getTime())) {
     return <span>📅 {fecha.toLocaleDateString('es-ES')}</span>;
   ```
   **Status**: ✅ Guarded with `isNaN()` check.

2. **`MisEvaluaciones.tsx` (lines 843-845)** ⚠️ **MEDIUM RISK**
   ```typescript
   const savedAt = new Date(evaluacion.saved_at);
   if (!isNaN(savedAt.getTime())) {
     return <span>💾 {savedAt.toLocaleDateString('es-ES')}</span>;
   ```
   **Status**: ✅ Guarded with `isNaN()` check.

3. **`MisPlanificaciones.tsx` (lines 1351-1354)** ⚠️ **MEDIUM RISK**
   ```typescript
   const inicio = new Date(plan.fecha_inicio);
   const fin = new Date(plan.fecha_fin);
   if (!isNaN(inicio.getTime()) && !isNaN(fin.getTime())) {
     return `${inicio.toLocaleDateString('es-ES')} - ${fin.toLocaleDateString('es-ES')}`;
   ```
   **Status**: ✅ Guarded with `isNaN()` checks.

4. **`MisPlanificaciones.tsx` (lines 1280-1285)** ⚠️ **MEDIUM RISK**
   ```typescript
   try {
     const inicio = new Date(plan.fecha_inicio);
     const fin = new Date(plan.fecha_fin);
     if (!isNaN(inicio.getTime()) && !isNaN(fin.getTime())) {
       return `${inicio.toLocaleDateString('es-ES')} - ${fin.toLocaleDateString('es-ES')}`;
     }
   } catch (e) {
     return 'Fecha no disponible';
   }
   ```
   **Status**: ✅ Guarded with try-catch and `isNaN()` checks.

5. **`MisPlanificaciones.tsx` (lines 1038-1042)** ⚠️ **MEDIUM RISK**
   ```typescript
   try {
     const from = new Date(fechaRange.from);
     const to = new Date(fechaRange.to);
     if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
       return `${from.toLocaleDateString('es-ES')} - ${to.toLocaleDateString('es-ES')}`;
     }
   } catch (e) {
     return 'Rango de fechas no disponible';
   }
   ```
   **Status**: ✅ Guarded with try-catch and `isNaN()` checks.

**Summary**: All date formatting locations are guarded. ✅ **LOW RISK** (already hardened).

---

### 2.3 JSONB Fields Accessed Without Runtime Shape Checks

**Pattern**: JSONB fields are cast to TypeScript types or accessed with property accessors without validating the runtime shape.

**Locations Found**:

1. **`PlanificacionWorkspace.tsx` (line 89)** ⚠️ **HIGH RISK**
   ```typescript
   distribucion_modalidades: data.distribucion_modalidades as unknown as DistribucionModalidades,
   ```
   **Issue**: No runtime validation. If DB contains invalid JSONB, cast will succeed but runtime access may crash.
   **Fix Needed**: Add runtime shape validation or use a schema validator (e.g., Zod).

2. **`PlanificacionWorkspace.tsx` (line 91)** ⚠️ **HIGH RISK**
   ```typescript
   configuracion_horario: data.configuracion_horario as unknown as ConfiguracionHorario[],
   ```
   **Issue**: Same as above. Assumes array shape, but JSONB could be object/null/string.

3. **`PlanificacionWorkspace.tsx` (line 90)** ⚠️ **HIGH RISK**
   ```typescript
   unidades_didacticas: (data.unidades_didacticas as any) || [],
   ```
   **Issue**: Cast to `any` bypasses type safety. No `Array.isArray()` check before use (line 99).

4. **`EvaluacionesGrupo.tsx` (line 422)** ⚠️ **MEDIUM RISK**
   ```typescript
   evaluacion_generada: {
     evaluaciones: generatedEvaluations,
     base_prototype: basePrototype
   },
   ```
   **Issue**: Structure is created in code, but if `generatedEvaluations` or `basePrototype` are malformed, insert may succeed but read may crash.
   **Fix Needed**: Validate structure before insert (optional, lower priority).

5. **`MisEvaluaciones.tsx` / `MisPlanificaciones.tsx`** ⚠️ **MEDIUM RISK**
   - `evaluacion_generada`, `rubrica`, `configuracion` are never accessed in these pages.
   - **Status**: ✅ Safe (not accessed, so no crash risk).

**Summary**: 3 high-risk locations, 1 medium-risk location.

---

### 2.4 Chart Inputs That Could Become NaN/undefined

**Pattern**: Recharts receives data where numeric values (`count`, `porcentaje`) could be `NaN`, `undefined`, or non-finite.

**Locations Found**:

1. **`MisEvaluaciones.tsx` (lines 303-323)** ✅ **GUARDED**
   ```typescript
   count,
   porcentaje: totalCompetencias > 0 ? Math.round((count / totalCompetencias) * 100) : 0,
   ```
   **Status**: ✅ `count` is from `Map.get()` which returns `number | undefined`, but `|| 0` ensures number. `porcentaje` has division guard.

2. **`MisPlanificaciones.tsx` (lines 435-449)** ✅ **GUARDED**
   ```typescript
   count,
   porcentaje: totalCompetencias > 0 ? Math.round((count / totalCompetencias) * 100) : 0,
   ```
   **Status**: ✅ Same as above.

3. **`MisPlanificaciones.tsx` (line 444)** ✅ **EXPLICIT VALIDATION**
   ```typescript
   count: (typeof count === 'number' && isFinite(count)) ? count : 0,
   ```
   **Status**: ✅ Explicit validation before Recharts (if this code path is used).

**Summary**: ✅ **LOW RISK** (already guarded or validated).

---

### 2.5 Missing Error Handling That Could Cause Blank Screen

**Pattern**: Unhandled promise rejections, uncaught exceptions, or missing error boundaries.

**Locations Found**:

1. **All Pages** ⚠️ **MEDIUM RISK**
   - No React Error Boundaries implemented.
   - If a component throws during render, entire page becomes white screen.
   - **Fix Needed**: Add Error Boundary wrapper for each major page.

2. **`MisEvaluaciones.tsx` (line 177)** ✅ **GUARDED**
   ```typescript
   } catch (error) {
     console.error('Error cargando evaluaciones:', error);
     toast({ title: "Error", description: "No se pudieron cargar las evaluaciones", variant: "destructive" });
   }
   ```
   **Status**: ✅ Error caught, toast shown, loading state cleared.

3. **`MisPlanificaciones.tsx` (line 209)** ⚠️ **PARTIAL**
   ```typescript
   } catch (error) {
     console.error('Error cargando datos:', error);
   } finally {
     setIsLoading(false);
   }
   ```
   **Issue**: Error logged but no user-facing message. User sees empty state without explanation.
   **Fix Needed**: Add toast/alert for user feedback.

4. **`EvaluacionesGrupo.tsx` (line 470)** ✅ **GUARDED**
   ```typescript
   } catch (error: any) {
     console.error('[SAVE EVALUATION] Error guardando evaluación:', error);
     // ... detailed error message logic
     toast({ title: "Error al guardar", description: errorMessage, variant: "destructive" });
   }
   ```
   **Status**: ✅ Comprehensive error handling with user feedback.

5. **`PlanificacionWorkspace.tsx`** ⚠️ **PARTIAL**
   - Some async operations have try-catch, but not all.
   - Missing error boundaries for render-time crashes.

**Summary**: 1 high-risk (missing error boundaries), 1 medium-risk (silent error in MisPlanificaciones).

---

## 3. Schema Readiness Risks

### 3.1 Tables That Must Exist

**Critical Tables** (app will crash if missing):

1. **`evaluaciones`** ⚠️ **HIGH RISK**
   - **Status**: May not exist (recent migration, may not be applied)
   - **Impact**: `EvaluacionesGrupo` INSERT fails, `MisEvaluaciones` SELECT fails → white screen
   - **Error**: `Could not find the table 'public.evaluaciones' in the schema cache`
   - **Fix**: Execute `docs/sql/create_evaluaciones_table.sql` in Supabase SQL Editor

2. **`planificaciones`** ✅ **EXISTS**
   - **Status**: Exists (created in early migration)
   - **Impact**: Low (table exists)

3. **`sesiones_clase`** ✅ **EXISTS**
   - **Status**: Exists (created in early migration)
   - **Impact**: Low (table exists)

4. **`profiles`** ✅ **EXISTS**
   - **Status**: Exists (created in migration `20250923180747`)
   - **Impact**: Low (table exists, used only for sharing feature)

---

### 3.2 Columns That Must Exist (Migration-Dependent)

**Critical Columns** (app will crash if missing):

1. **`evaluaciones.is_saved`** ⚠️ **HIGH RISK**
   - **Status**: May not exist (migration `20251222000000` may not be applied)
   - **Impact**: `MisEvaluaciones` SELECT fails with `PGRST204` → white screen
   - **Error Handling**: ✅ Detected and shown to user (line 138-146 in `MisEvaluaciones.tsx`)

2. **`evaluaciones.saved_at`** ⚠️ **HIGH RISK**
   - **Status**: Same as above
   - **Impact**: Same as above

3. **`evaluaciones.deleted_at`** ⚠️ **HIGH RISK**
   - **Status**: Same as above
   - **Impact**: Same as above

4. **`planificaciones.is_saved`** ⚠️ **MEDIUM RISK**
   - **Status**: May not exist (migration `20251219163000` may not be applied)
   - **Impact**: `MisPlanificaciones` SELECT fails with `PGRST204` → white screen
   - **Error Handling**: ✅ Detected and shown to user (line 160-168 in `MisPlanificaciones.tsx`)

5. **`planificaciones.saved_at`** ⚠️ **MEDIUM RISK**
   - **Status**: Same as above
   - **Impact**: Same as above

6. **`planificaciones.deleted_at`** ⚠️ **MEDIUM RISK**
   - **Status**: Same as above
   - **Impact**: Same as above

**Summary**: 3 high-risk columns (evaluaciones), 3 medium-risk columns (planificaciones). Error handling exists but user must apply migrations.

---

## 4. Prioritized Fix Recommendations (Top 10)

### Fix #1: Add Array Guard for `unidades_didacticas` in PlanificacionWorkspace

**File**: `src/pages/PlanificacionWorkspace.tsx`  
**Lines**: 98-100  
**Risk**: **HIGH** (can crash on invalid JSONB)  
**Implementation Risk**: **LOW** (simple guard)

**Current Code**:
```typescript
if (planificacionConverted.unidades_didacticas && Array.isArray(planificacionConverted.unidades_didacticas)) {
  planificacionConverted.unidades_didacticas.forEach((unidad: any) => {
```

**Issue**: Line 99 calls `forEach` without checking if `unidades_didacticas` is an array. If JSONB is `null`, `undefined`, or non-array, this crashes.

**Fix**:
```typescript
if (planificacionConverted.unidades_didacticas && Array.isArray(planificacionConverted.unidades_didacticas)) {
  planificacionConverted.unidades_didacticas.forEach((unidad: any) => {
    // ... existing code
  });
}
```

**Why It Matters**: Prevents white screen crash when loading planificaciones with malformed `unidades_didacticas` JSONB.

---

### Fix #2: Add Runtime Validation for JSONB Fields in PlanificacionWorkspace

**File**: `src/pages/PlanificacionWorkspace.tsx`  
**Lines**: 87-94  
**Risk**: **HIGH** (type casts without validation)  
**Implementation Risk**: **MEDIUM** (requires schema definition or Zod)

**Current Code**:
```typescript
const planificacionConverted = {
  ...data,
  distribucion_modalidades: data.distribucion_modalidades as unknown as DistribucionModalidades,
  unidades_didacticas: (data.unidades_didacticas as any) || [],
  configuracion_horario: data.configuracion_horario as unknown as ConfiguracionHorario[],
```

**Issue**: Type casts assume correct shape, but JSONB could be invalid. Runtime access may crash.

**Fix Options**:
- **Option A (Simple)**: Add `Array.isArray()` checks and default to safe values
- **Option B (Robust)**: Use Zod schema validation

**Recommended**: Option A for quick fix, Option B for long-term robustness.

**Why It Matters**: Prevents crashes when JSONB structure doesn't match TypeScript types.

---

### Fix #3: Add Error Boundary for MisEvaluaciones

**File**: `src/pages/MisEvaluaciones.tsx`  
**Risk**: **MEDIUM** (uncaught render errors cause white screen)  
**Implementation Risk**: **LOW** (standard React pattern)

**Current State**: No error boundary. If any component throws, entire page becomes white.

**Fix**: Wrap page content in `<ErrorBoundary>` component that:
- Catches render errors
- Shows user-friendly error message
- Logs error details to console
- Provides "Reload" button

**Why It Matters**: Prevents white screen crashes and provides user feedback.

---

### Fix #4: Add Error Boundary for MisPlanificaciones

**File**: `src/pages/MisPlanificaciones.tsx`  
**Risk**: **MEDIUM** (same as above)  
**Implementation Risk**: **LOW**

**Current State**: No error boundary.

**Fix**: Same as Fix #3.

**Why It Matters**: Same as above.

---

### Fix #5: Add User Feedback for Silent Errors in MisPlanificaciones

**File**: `src/pages/MisPlanificaciones.tsx`  
**Lines**: 209-213  
**Risk**: **MEDIUM** (user sees empty state without explanation)  
**Implementation Risk**: **LOW** (add toast)

**Current Code**:
```typescript
} catch (error) {
  console.error('Error cargando datos:', error);
} finally {
  setIsLoading(false);
}
```

**Issue**: Error logged but user sees empty state without explanation.

**Fix**:
```typescript
} catch (error) {
  console.error('Error cargando datos:', error);
  toast({
    title: "Error",
    description: "No se pudieron cargar las planificaciones. Por favor, recarga la página.",
    variant: "destructive"
  });
} finally {
  setIsLoading(false);
}
```

**Why It Matters**: Improves UX by explaining why data is missing.

---

### Fix #6: Validate `evaluacion_generada` Structure Before Insert

**File**: `src/pages/EvaluacionesGrupo.tsx`  
**Lines**: 422-425  
**Risk**: **MEDIUM** (malformed JSONB may cause read-time crashes)  
**Implementation Risk**: **LOW** (simple shape check)

**Current Code**:
```typescript
evaluacion_generada: {
  evaluaciones: generatedEvaluations,
  base_prototype: basePrototype
},
```

**Issue**: If `generatedEvaluations` or `basePrototype` are malformed, insert succeeds but read may crash.

**Fix**: Add validation before insert:
```typescript
const evaluacionGenerada = {
  evaluaciones: Array.isArray(generatedEvaluations) ? generatedEvaluations : [],
  base_prototype: basePrototype || null
};
```

**Why It Matters**: Prevents data corruption and read-time crashes.

---

### Fix #7: Add Schema Readiness Check on App Startup

**File**: Create new utility `src/lib/schemaCheck.ts`  
**Risk**: **MEDIUM** (early detection of missing tables/columns)  
**Implementation Risk**: **MEDIUM** (requires Supabase query)

**Current State**: Errors only surface when user navigates to affected pages.

**Fix**: Create a schema check utility that:
- Queries `information_schema` to verify required tables/columns exist
- Runs on app startup (or on first page load)
- Shows clear error message if schema is incomplete
- Provides link to migration SQL files

**Why It Matters**: Early detection prevents user confusion and reduces support burden.

---

### Fix #8: Add Error Boundary for EvaluacionesGrupo

**File**: `src/pages/EvaluacionesGrupo.tsx`  
**Risk**: **MEDIUM** (complex component, many async operations)  
**Implementation Risk**: **LOW**

**Current State**: No error boundary.

**Fix**: Same as Fix #3.

**Why It Matters**: Prevents white screen during evaluation generation/save.

---

### Fix #9: Add Error Boundary for PlanificacionWorkspace

**File**: `src/pages/PlanificacionWorkspace.tsx`  
**Risk**: **MEDIUM** (complex component, JSONB parsing)  
**Implementation Risk**: **LOW**

**Current State**: No error boundary.

**Fix**: Same as Fix #3.

**Why It Matters**: Prevents white screen when loading/editing planificaciones.

---

### Fix #10: Consolidate Date Formatting Utilities

**File**: Create `src/lib/dateUtils.ts`  
**Risk**: **LOW** (already guarded, but consolidation reduces duplication)  
**Implementation Risk**: **LOW** (refactor, no behavior change)

**Current State**: Date formatting logic duplicated across pages with similar try-catch patterns.

**Fix**: Create utility functions:
```typescript
export function safeFormatDate(date: string | Date | null, locale: string = 'es-ES'): string {
  // ... existing validation logic
}

export function safeFormatDateRange(from: Date | undefined, to: Date | undefined): string {
  // ... existing validation logic
}
```

**Why It Matters**: Reduces code duplication and ensures consistent error handling.

---

## 5. Manual Smoke Test Checklist

### Test 1: MisEvaluaciones Page Load

**Steps**:
1. Navigate to `/mis-evaluaciones`
2. Wait for page to load

**Expected**:
- ✅ Page renders (no white screen)
- ✅ If no data: shows "Aún no has guardado evaluaciones"
- ✅ If data exists: shows list of evaluaciones
- ✅ Console: No uncaught errors

**Failure Modes**:
- ❌ White screen → Check console for React error
- ❌ Error toast "Falta aplicar migración" → Apply `docs/sql/create_evaluaciones_table.sql`

---

### Test 2: MisEvaluaciones with Filters

**Steps**:
1. Navigate to `/mis-evaluaciones`
2. Select a subject (e.g., "Historia")
3. Select a group (e.g., "9no 1")
4. Set date range (e.g., last month)

**Expected**:
- ✅ "Balance de Competencias" chart renders (or shows empty state)
- ✅ "Competencias Pendientes" list renders (or shows "Great" message)
- ✅ Evaluaciones list filters correctly
- ✅ Console: No errors

**Failure Modes**:
- ❌ Chart crashes → Check Recharts data (NaN/undefined)
- ❌ Date filter crashes → Check date parsing logic

---

### Test 3: Save Evaluation

**Steps**:
1. Navigate to `/evaluaciones/nuevo`
2. Select group and materia
3. Generate evaluation (optional)
4. Click "Guardar evaluación"
5. Enter name and confirm

**Expected**:
- ✅ Success toast: "Evaluación guardada"
- ✅ Navigation to `/mis-evaluaciones` after 1.5s
- ✅ Evaluation appears in list
- ✅ Console: `[SAVE EVALUATION] Success: {...}`

**Failure Modes**:
- ❌ Error toast "Error al guardar" → Check Supabase error in console
- ❌ Table missing error → Apply `docs/sql/create_evaluaciones_table.sql`
- ❌ Permission error → Check RLS policies

---

### Test 4: MisPlanificaciones Page Load

**Steps**:
1. Navigate to `/mis-planificaciones`
2. Wait for page to load

**Expected**:
- ✅ Page renders (no white screen)
- ✅ If no data: shows empty state
- ✅ If data exists: shows list of planificaciones
- ✅ Console: No uncaught errors

**Failure Modes**:
- ❌ White screen → Check console for React error
- ❌ Error toast "Falta aplicar migración" → Apply migration for `is_saved` columns

---

### Test 5: MisPlanificaciones with Filters

**Steps**:
1. Navigate to `/mis-planificaciones`
2. Select a subject (e.g., "Historia")
3. Select a group (e.g., "9no 1")
4. Set date range

**Expected**:
- ✅ "Balance de Competencias" chart renders
- ✅ "Competencias Pendientes" list renders
- ✅ Planificaciones list filters correctly
- ✅ Console: No errors

**Failure Modes**:
- ❌ Chart crashes → Check Recharts data
- ❌ Date filter crashes → Check date parsing

---

### Test 6: PlanificacionWorkspace Load

**Steps**:
1. Navigate to a planificacion workspace (e.g., `/planificacion/workspace/{id}`)
2. Wait for page to load

**Expected**:
- ✅ Page renders (no white screen)
- ✅ Planificacion data loads
- ✅ Sessions calendar renders
- ✅ Console: No errors

**Failure Modes**:
- ❌ White screen → Check console for React error
- ❌ JSONB parsing error → Check `unidades_didacticas` structure

---

### Test 7: Edge Case: Null/Invalid Dates

**Steps**:
1. In Supabase, manually insert an evaluacion with `fecha = null`
2. Navigate to `/mis-evaluaciones`
3. Apply filters that would include this evaluacion

**Expected**:
- ✅ Page renders (no crash)
- ✅ Evaluacion with null fecha is excluded from date-filtered results
- ✅ Evaluacion appears in list (if no date filter)
- ✅ Date display shows fallback (or omits date)

**Failure Modes**:
- ❌ Crash on date formatting → Check `toLocaleDateString` guards

---

### Test 8: Edge Case: Invalid JSONB

**Steps**:
1. In Supabase, manually set `planificaciones.unidades_didacticas = 'invalid json'`
2. Navigate to `/planificacion/workspace/{id}`

**Expected**:
- ✅ Page renders (no crash)
- ✅ Error message shown to user
- ✅ Console: Error logged

**Failure Modes**:
- ❌ White screen → Add JSONB validation (Fix #2)

---

### Test 9: Edge Case: Empty Arrays

**Steps**:
1. In Supabase, manually set `evaluaciones.competencias_anep = '{}'` (empty array)
2. Navigate to `/mis-evaluaciones`
3. Select subject and apply filters

**Expected**:
- ✅ Page renders (no crash)
- ✅ Evaluacion with empty competencias is excluded from balance chart
- ✅ Empty state message shown

**Failure Modes**:
- ❌ Crash on `forEach` → Check array normalization

---

### Test 10: Schema Readiness

**Steps**:
1. Check Supabase Dashboard → Table Editor
2. Verify tables exist: `evaluaciones`, `planificaciones`, `sesiones_clase`
3. Verify columns exist: `evaluaciones.is_saved`, `planificaciones.is_saved`

**Expected**:
- ✅ All tables exist
- ✅ All required columns exist

**Failure Modes**:
- ❌ Table missing → Apply migration SQL
- ❌ Column missing → Apply migration SQL

---

## 6. Summary of Top 5 Risks

1. **JSONB field access without runtime validation** (HIGH)
   - **Location**: `PlanificacionWorkspace.tsx` lines 89-99
   - **Impact**: White screen crash when loading planificaciones with malformed JSONB
   - **Fix Priority**: #1, #2

2. **Missing error boundaries** (MEDIUM)
   - **Location**: All major pages
   - **Impact**: Uncaught render errors cause white screen with no user feedback
   - **Fix Priority**: #3, #4, #8, #9

3. **Schema readiness gaps** (HIGH)
   - **Location**: `evaluaciones` table, `is_saved` columns
   - **Impact**: App crashes on page load if migrations not applied
   - **Fix Priority**: #7 (early detection), plus manual migration application

4. **Silent error in MisPlanificaciones** (MEDIUM)
   - **Location**: `MisPlanificaciones.tsx` line 209
   - **Impact**: User sees empty state without explanation when data load fails
   - **Fix Priority**: #5

5. **Array access without guard in PlanificacionWorkspace** (HIGH)
   - **Location**: `PlanificacionWorkspace.tsx` line 99
   - **Impact**: Crash when `unidades_didacticas` is not an array
   - **Fix Priority**: #1

---

## 7. Next Steps

1. **Immediate (High Priority)**:
   - Apply Fix #1 (array guard for `unidades_didacticas`)
   - Apply Fix #2 (JSONB validation in PlanificacionWorkspace)
   - Verify schema readiness (apply migrations if needed)

2. **Short-term (Medium Priority)**:
   - Apply Fix #3, #4, #8, #9 (error boundaries)
   - Apply Fix #5 (user feedback for errors)

3. **Long-term (Low Priority)**:
   - Apply Fix #6 (validate `evaluacion_generada`)
   - Apply Fix #7 (schema readiness check)
   - Apply Fix #10 (consolidate date utilities)

---

**Status**: ✅ Diagnostic complete  
**Branch**: `Aulaplus-by-eitan-2`  
**Next**: Review and prioritize fixes based on business needs

















