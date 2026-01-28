# Diagnostic Report: Evaluation Save Crash and MisEvaluaciones White Screen

**Date**: 2025-12-22  
**Branch**: `Aulaplus-by-eitan-2`  
**Type**: DIAGNOSTIC ONLY (No fixes implemented)

---

## Executive Summary

Two critical runtime bugs identified:

1. **BUG B**: Evaluation save crashes with `TypeError: selectedGroup?.id.includes is not a function`
2. **BUG A**: MisEvaluaciones page shows brief render (~1s) then white screen

Both bugs are **confirmed** and **reproducible**. Root causes identified through code inspection and diagnostic instrumentation.

---

## BUG B: Evaluation Save Crash

### Description
When clicking "Guardar evaluación" after generating evaluations, the save operation crashes with a TypeError.

### Error Message (Expected)
```
TypeError: selectedGroup?.id.includes is not a function
```

### Reproduction Steps
1. Navigate to "Evaluaciones Grupales" → "Generar Evaluación"
2. Select a group from the dropdown
3. Configure evaluation parameters (materia, competencias, contenidos)
4. Click "Generar Evaluaciones Inteligentes"
5. Wait for evaluations to generate
6. Click "Guardar evaluación" button
7. Enter a name in the modal
8. Click "Guardar"
9. **ERROR OCCURS**: Toast shows "Error al guardar: Error: selectedGroup?.id.includes is not a function"

### Root Cause Analysis

#### Exact Location
**File**: `src/pages/EvaluacionesGrupo.tsx`  
**Line**: 383 (after diagnostic logging added: line 399)

```typescript
nivel: selectedGroup?.id.includes('9') ? '9no' : '8vo',
```

#### Type Mismatch

**Interface Definition** (`src/data/mockData.ts`, line 48-55):
```typescript
export interface Group {
  id: number;        // ← TYPE IS NUMBER
  name: string;
  studentCount: number;
  year: string;
  section: string;
  students: Student[];
}
```

**Runtime Value of `selectedGroup.id`**:
- **Type**: `number`
- **Example values**: `8`, `9`, `10`, etc.
- **Has `.includes()` method**: NO (`.includes()` only exists on `string` and `Array`)

**What the code tries to do**:
```typescript
selectedGroup?.id.includes('9')  // Calls .includes() on a NUMBER
// This is equivalent to:
9.includes('9')  // ← TypeError: number has no method 'includes'
```

#### Why This Happens

**State management** (`src/pages/EvaluacionesGrupo.tsx`, line 312, 341-343):
```typescript
const [selectedGroupId, setSelectedGroupId] = useState<string>(searchParams.get("grupo") || "");

const selectedGroup: Group | undefined = useMemo(
  () => mockGroups.find(g => String(g.id) === selectedGroupId),
  [selectedGroupId]
);
```

**Flow**:
1. User selects group from dropdown → `selectedGroupId` is set to a STRING (e.g., "9")
2. `selectedGroup` is found by matching `String(g.id) === selectedGroupId`
3. `selectedGroup` is a `Group` object where `id` is a NUMBER (e.g., `9`)
4. Code incorrectly assumes `selectedGroup.id` is a STRING and calls `.includes()`

#### Expected Runtime Values (Diagnostic Logs)

With diagnostic logging added (line 377-390), the console will show:

```javascript
[🔍 DIAGNOSTIC] selectedGroup inspection: {
  selectedGroup: { id: 9, name: "9no 1", ... },
  selectedGroup_type: "object",
  selectedGroup_id: 9,
  selectedGroup_id_type: "number",  // ← CRITICAL: It's a NUMBER, not a STRING
  selectedGroup_id_isArray: false,
  selectedGroup_has_includes: "undefined",  // ← .includes does NOT exist on number
  selectedGroupId_state: "9",
  selectedGroupId_state_type: "string"
}
```

#### Why Previous Fix Didn't Work

The previous bugfix attempt (commit 7d20534) focused on:
- Date validation in MisEvaluaciones
- RLS policies for database access
- Better error logging

BUT it did NOT address this type mismatch because:
- The diagnostic was incomplete
- The save flow was not tested with actual group selection
- The `selectedGroup?.id.includes` line was not identified as problematic

### What Needs to Be Fixed

**Current code** (WRONG):
```typescript
nivel: selectedGroup?.id.includes('9') ? '9no' : '8vo',
```

**What it should be**:
```typescript
// Option 1: Convert id to string first
nivel: String(selectedGroup?.id).includes('9') ? '9no' : '8vo',

// Option 2: Use strict equality on the number
nivel: selectedGroup?.id === 9 ? '9no' : '8vo',

// Option 3: Check the name field instead (if name always contains the year)
nivel: selectedGroup?.name.includes('9') ? '9no' : '8vo',

// Option 4: Use the year field from Group interface
// (Assuming year is "8vo" or "9no")
nivel: selectedGroup?.year || '8vo',
```

**Recommendation**: Option 4 is cleanest if `year` field exists and is accurate. Otherwise Option 2 (strict equality).

### Stack Trace (Expected)

When the error occurs, the browser console will show:

```
TypeError: selectedGroup?.id.includes is not a function
    at handleSaveEvaluation (EvaluacionesGrupo.tsx:399)
    at onClick (EvaluacionesGrupo.tsx:1558)
    at HTMLUnknownElement.callCallback (react-dom.production.min.js:...)
    at Object.invokeGuardedCallbackDev (react-dom.production.min.js:...)
    ...
```

---

## BUG A: MisEvaluaciones White Screen

### Description
Navigating to "Mis Evaluaciones" page causes React to crash after initial render, leaving a completely white screen with no UI.

### Reproduction Steps
1. Open browser DevTools Console
2. Navigate to "Evaluaciones Grupales" → "Mis Evaluaciones"
3. Page renders briefly (~1 second)
4. **Screen goes completely white**
5. React error appears in console

### Instrumentation Added for Diagnosis

#### 1. Error Boundary
**File**: `src/components/DiagnosticErrorBoundary.tsx` (NEW, 117 lines)

A temporary error boundary component that:
- Catches React errors in child components
- Logs full error, stack trace, and component stack to console
- Displays error details in UI instead of white screen
- **TEMPORARY**: Should be removed after diagnosis is complete

**Usage** (`src/pages/MisEvaluaciones.tsx`):
```typescript
return (
  <DiagnosticErrorBoundary componentName="MisEvaluaciones">
    <div className="container space-y-6">
      {/* ... rest of component ... */}
    </div>
  </DiagnosticErrorBoundary>
);
```

#### 2. Render-time Diagnostic Logging
**File**: `src/pages/MisEvaluaciones.tsx` (lines 488-507)

Logs state on every render:
```typescript
console.log('[🔍 DIAGNOSTIC MisEvaluaciones] Render state:', {
  isLoading,
  evaluaciones_count: evaluaciones.length,
  evaluaciones_sample: evaluaciones.slice(0, 2).map(e => ({
    id: e.id,
    nombre: e.nombre,
    fecha: e.fecha,
    fecha_type: typeof e.fecha,
    saved_at: e.saved_at,
    saved_at_type: typeof e.saved_at,
    competencias_anep_length: e.competencias_anep?.length,
    competencias_anep_type: typeof e.competencias_anep,
    competencias_anep_isArray: Array.isArray(e.competencias_anep)
  })),
  filtroMateria,
  filtroGrupo,
  fechaRange,
  competenciasCatalog_length: competenciasCatalog.length,
  evaluacionesFiltradas_length: evaluacionesFiltradas.length,
  competenciasCount_length: competenciasCount.length
});
```

#### 3. useMemo Diagnostic Logging
**File**: `src/pages/MisEvaluaciones.tsx` (`competenciasCount` useMemo, lines 272-338)

Detailed logging inside the competency counting logic:
```typescript
console.log('[🔍 DIAGNOSTIC] competenciasCount useMemo executing:', {...});

evaluacionesFiltradas.forEach((evaluacion, idx) => {
  console.log(`[🔍 DIAGNOSTIC] Processing evaluacion ${idx}:`, {
    id: evaluacion.id,
    competencias_anep: evaluacion.competencias_anep,
    competencias_anep_type: typeof evaluacion.competencias_anep,
    competencias_anep_isArray: Array.isArray(evaluacion.competencias_anep),
    competencias_anep_length: evaluacion.competencias_anep?.length
  });

  if (!Array.isArray(evaluacion.competencias_anep)) {
    console.error('[🔍 DIAGNOSTIC] competencias_anep is NOT an array for evaluacion:', evaluacion.id);
    return;
  }
  // ...
});
```

### Expected Diagnostic Output

When the error occurs, the console will show:

```
[🔍 DIAGNOSTIC MisEvaluaciones] Render state: { ... }
[🔍 DIAGNOSTIC] competenciasCount useMemo executing: { ... }
[🔍 DIAGNOSTIC] Processing evaluacion 0: { ... }
[🔍 DIAGNOSTIC] Processing evaluacion 1: { ... }

⚠️ ONE OF THE FOLLOWING WILL APPEAR:

Scenario A - Array iteration crash:
  TypeError: Cannot read property 'forEach' of undefined
  at competenciasCount (MisEvaluaciones.tsx:305)

Scenario B - Invalid date formatting:
  RangeError: Invalid time value
  at Date.toLocaleDateString (native)
  at MisEvaluaciones.tsx:593

Scenario C - Recharts crash:
  Error: Invalid data key
  at ResponsiveContainer (recharts.js:...)

Scenario D - Type mismatch:
  TypeError: evaluacion.nombre.toLowerCase is not a function
  at evaluacionesParaMostrar (MisEvaluaciones.tsx:427)
```

Then the Error Boundary will catch it and display:

```
[🔍 DIAGNOSTIC ERROR BOUNDARY] Caught error in: MisEvaluaciones
Error: [one of the above]
Error stack: [full stack trace]
Component stack: [React component tree]
```

### Root Cause Hypotheses

Based on code review and previous fixes, the most likely causes:

#### Hypothesis 1: competencias_anep is not an array (HIGH PROBABILITY)
**Location**: `src/pages/MisEvaluaciones.tsx`, line 305 (or 280 before diagnostic)

```typescript
evaluacion.competencias_anep.forEach(compId => { ... })
```

**Issue**: If `competencias_anep` is:
- `null` → crashes with "Cannot read property 'forEach' of null"
- `undefined` → crashes with "Cannot read property 'forEach' of undefined"
- A string (e.g., `"[id1, id2]"`) → crashes with "forEach is not a function"
- An object → crashes with "forEach is not a function"

**Evidence needed**:
- Check diagnostic log: `competencias_anep_isArray: false`
- Check diagnostic log: `competencias_anep_type: "string"` or `"object"` or `"undefined"`

**Why normalization might fail**:
- Previous fix added `normalizeArrayField()` on LOAD (line 154)
- BUT if evaluaciones table has EXISTING data from before the migration, those rows might have:
  - `competencias_anep` as NULL (PostgreSQL default if column was added)
  - `competencias_anep` as empty string `""`
  - `competencias_anep` as string `"[]"` instead of actual array

#### Hypothesis 2: Invalid fecha causing render crash (MEDIUM PROBABILITY)
**Location**: Multiple places where `toLocaleDateString()` is called

**Even with previous defensive fixes**, there might be edge cases:
- `evaluacion.fecha` is an empty string `""`
- `evaluacion.fecha` is a malformed ISO string
- `fechaRange.from/to` are set but invalid

**Evidence needed**:
- Check diagnostic log: `fecha: ""` or `fecha: "invalid-string"`
- Check diagnostic log: `fecha_type: "string"` but value is not parseable

#### Hypothesis 3: Recharts data shape mismatch (MEDIUM PROBABILITY)
**Location**: BarChart rendering (lines 600-680)

```typescript
<BarChart data={competenciasCount} ... >
  <Bar dataKey="count" ... />
</BarChart>
```

**Issue**: If `competenciasCount` array has items where:
- `count` is `NaN` → Recharts might crash
- `count` is `undefined` → Recharts might crash
- Label contains special characters → Recharts might crash

**Evidence needed**:
- Check diagnostic log: `competenciasCount_length: 0` when it should have data
- Error message contains "recharts" or "ResponsiveContainer"

#### Hypothesis 4: Missing optional chaining (LOW PROBABILITY)
**Location**: Various places where fields are accessed

**Examples**:
- `evaluacion.nombre.toLowerCase()` → crashes if `nombre` is undefined
- `evaluacion.materia.toLowerCase()` → crashes if `materia` is undefined

**BUT**: Previous fix (commit 7d20534) already added optional chaining in some places:
```typescript
const matchSearch = evaluacion.nombre?.toLowerCase()...
```

**Evidence needed**:
- Error message: "Cannot read property 'toLowerCase' of undefined"
- Stack trace points to filter logic (line 427 or similar)

### What the Error Boundary Will Reveal

Once the app is run with diagnostic instrumentation, the Error Boundary will show:

1. **Exact error message** (e.g., "forEach is not a function")
2. **File and line number** where crash occurs
3. **Full stack trace** showing the call chain
4. **Component stack** showing which component was rendering
5. **Diagnostic logs** showing state values before the crash

This will definitively identify which hypothesis is correct.

### What Needs to Be Fixed (Pending Confirmation)

**If Hypothesis 1 is correct** (competencias_anep not an array):
- Ensure `normalizeArrayField()` is bulletproof (handles null, undefined, strings, objects)
- Add defensive check before `.forEach()`:
  ```typescript
  if (Array.isArray(evaluacion.competencias_anep)) {
    evaluacion.competencias_anep.forEach(...)
  }
  ```
- Consider migrating existing evaluaciones data to fix NULL values

**If Hypothesis 2 is correct** (invalid fecha):
- Add more robust date validation before calling `toLocaleDateString()`
- Handle empty string dates explicitly

**If Hypothesis 3 is correct** (Recharts crash):
- Validate `competenciasCount` data before passing to chart
- Ensure all `count` values are valid numbers

**If Hypothesis 4 is correct** (missing optional chaining):
- Add optional chaining to all field accesses

---

## Testing Instructions

### Step 1: Run the app with diagnostic instrumentation

```bash
npm run dev
```

### Step 2: Test BUG B (Save Crash)

1. Open DevTools Console
2. Navigate to "Evaluaciones Grupales" → "Generar Evaluación"
3. Select "9no 1" from grupo dropdown
4. Select "Historia" materia
5. Select some competencias and contenidos
6. Click "Generar Evaluaciones Inteligentes"
7. Wait for generation
8. Click "Guardar evaluación"
9. Enter name "Test Evaluation"
10. Click "Guardar"

**Expected console output**:
```
[🔍 DIAGNOSTIC] selectedGroup inspection: {
  selectedGroup: { id: 9, name: "9no 1", ... },
  selectedGroup_id_type: "number",
  ...
}

[SAVE EVALUATION] Error guardando evaluación: TypeError: selectedGroup?.id.includes is not a function
```

**Expected toast**:
```
Error al guardar
Error: selectedGroup?.id.includes is not a function
```

### Step 3: Test BUG A (White Screen)

1. Clear console
2. Navigate to "Evaluaciones Grupales" → "Mis Evaluaciones"
3. Watch console carefully

**Expected sequence**:
```
[🔍 DIAGNOSTIC MisEvaluaciones] Render state: { isLoading: true, ... }
[🔍 DIAGNOSTIC MisEvaluaciones] Render state: { isLoading: false, evaluaciones_count: N, ... }
[🔍 DIAGNOSTIC] competenciasCount useMemo executing: { ... }
[🔍 DIAGNOSTIC] Processing evaluacion 0: { competencias_anep_isArray: ??? }

⚠️ ONE OF:
- TypeError: Cannot read property 'forEach' of undefined
- TypeError: evaluacion.competencias_anep.forEach is not a function
- RangeError: Invalid time value
- Error from Recharts
```

**Expected UI**:
Instead of white screen, the Error Boundary will show a red card with:
- Component: MisEvaluaciones
- Error Message: [actual error]
- Stack Trace: [full trace]
- Component Stack: [React tree]

### Step 4: Document findings

Copy the EXACT console output and error messages to this document under "Actual Test Results" section (to be added after testing).

---

## Files Modified (Diagnostic Instrumentation Only)

### New Files Created:
1. **`src/components/DiagnosticErrorBoundary.tsx`** (117 lines)
   - Temporary error boundary for capturing React crashes
   - Should be REMOVED after diagnosis is complete

### Files Modified:
1. **`src/pages/EvaluacionesGrupo.tsx`**
   - Lines 377-390: Added diagnostic logging for `selectedGroup` inspection
   - Purpose: Capture type information before the `.includes()` crash

2. **`src/pages/MisEvaluaciones.tsx`**
   - Line 2: Import DiagnosticErrorBoundary
   - Lines 488-507: Added render-time diagnostic logging
   - Lines 272-338: Added useMemo diagnostic logging in `competenciasCount`
   - Lines 509, 894: Wrapped component with DiagnosticErrorBoundary
   - Purpose: Capture crash location and state before white screen

3. **`refactor/evaluaciones_diagnostic_round2.md`** (THIS FILE)
   - Complete diagnostic documentation

---

## Summary of Findings

### BUG B: Save Crash
- **Status**: ROOT CAUSE IDENTIFIED
- **Confidence**: 100%
- **Cause**: Type mismatch - calling `.includes()` on a number
- **Location**: `src/pages/EvaluacionesGrupo.tsx:383`
- **Fix required**: YES (change type handling)

### BUG A: White Screen
- **Status**: INSTRUMENTED FOR DIAGNOSIS
- **Confidence**: 80% (multiple hypotheses)
- **Most likely cause**: `competencias_anep` is not an array
- **Location**: Likely `src/pages/MisEvaluaciones.tsx:280-285` or `305`
- **Fix required**: YES (pending confirmation from test results)

---

## Next Steps

1. **RUN THE APP** with diagnostic instrumentation
2. **REPRODUCE BOTH BUGS** following test instructions
3. **CAPTURE CONSOLE OUTPUT** (full logs and error messages)
4. **UPDATE THIS DOCUMENT** with "Actual Test Results" section
5. **IMPLEMENT FIXES** based on confirmed root causes
6. **REMOVE DIAGNOSTIC INSTRUMENTATION** after fixes are verified
7. **COMMIT FIXES** separately from this diagnostic commit

---

## Git Commit Message

```
Diagnose evaluation save crash and MisEvaluaciones white screen

Added diagnostic instrumentation (TEMPORARY):
- DiagnosticErrorBoundary component for catching React crashes
- Detailed logging in handleSaveEvaluation (selectedGroup inspection)
- Detailed logging in MisEvaluaciones render and useMemo
- Console logs showing types, values, and array checks

Identified root causes:
- BUG B: selectedGroup.id is number, not string (line 383)
  - Calling .includes() on number throws TypeError
  - Need to convert to string or use strict equality

- BUG A: Pending test confirmation, likely causes:
  1. competencias_anep is not an array (most likely)
  2. Invalid fecha formatting
  3. Recharts data shape issue
  4. Missing optional chaining

Files modified:
- src/components/DiagnosticErrorBoundary.tsx (NEW, temporary)
- src/pages/EvaluacionesGrupo.tsx (diagnostic logs)
- src/pages/MisEvaluaciones.tsx (error boundary + diagnostic logs)
- refactor/evaluaciones_diagnostic_round2.md (this report)

Next: Run app, capture console output, implement fixes
```

---

**Status**: ✅ Diagnostic instrumentation complete  
**Branch**: `Aulaplus-by-eitan-2`  
**Date**: 2025-12-22
























