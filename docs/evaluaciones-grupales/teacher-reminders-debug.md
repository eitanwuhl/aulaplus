# Teacher Reminders Debug Report

## 1. Current Pipeline (End-to-End)

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TEACHER REMINDERS GENERATION PIPELINE                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. USER SELECTS CONTEMPLACIONES (UI)
   └─> localStorage: contemplaciones_evaluaciones_${studentId}

2. getGroupContextForAI() 
   └─> [src/services/groupContext/provider.ts:370-440]
   └─> Calls: readSelected(studentId, 'evaluaciones')
   └─> Returns: { students: [{ contemplacionesEvaluaciones: [...] }] }

3. buildEvaluationDesignPlan()
   └─> [src/services/evaluations/designPlan.ts:240-397]
   └─> Calls: mapSelectedContemplacionesToBuckets(contemplaciones)
   └─> Calls: buildPerStudentReminders(students)
   └─> Returns: { perStudentReminders: [...], _reminderValidation: {...} }

4. FRONTEND SENDS TO EDGE FUNCTION
   └─> [src/pages/EvaluacionesGrupo.tsx:1019-1030]
   └─> evaluation_design_plan: { perStudentReminders: [...] }

5. EDGE FUNCTION PROCESSES
   └─> [supabase/functions/modify-evaluation/index.ts:2048-2050]
   └─> teacherRemindersByStudent = designPlan.perStudentReminders || []

6. EDGE FUNCTION RETURNS
   └─> response.teacherRemindersByStudent = [...]

7. FRONTEND RECEIVES & SETS STATE
   └─> [src/pages/EvaluacionesGrupo.tsx:1237-1254]
   └─> setTeacherReminders(data.teacherRemindersByStudent || [])

8. UI RENDERS
   └─> [src/components/evaluaciones/TeacherRemindersPanel.tsx:27-35]
   └─> Filter: reminders with non-empty admin/correction/allowances
```

### Detailed Code Paths

#### Step 1: Reading Contemplaciones from localStorage

**File**: [src/lib/contemplaciones/storage.ts#L156-L180](src/lib/contemplaciones/storage.ts#L156-L180)

```typescript
export function readSelected(
  studentId: string | number,
  category: ContemplacionCategoryStorage
): string[] {
  const key = getSelectedKey(studentId, category);  // → contemplaciones_evaluaciones_${studentId}
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return [];  // ⚠️ CRITICAL: Returns empty if no key found
    }
    
    const ids: string[] = JSON.parse(stored);
    return ids.map(id => normalizeContemplacionId(String(id)));
  } catch (error) {
    return [];
  }
}
```

**Key format**: `contemplaciones_evaluaciones_${studentId}`

#### Step 2: Loading Students with Contemplaciones

**File**: [src/services/groupContext/provider.ts#L410-L435](src/services/groupContext/provider.ts#L410-L435)

```typescript
const studentsWithContemplaciones: StudentForAI[] = await Promise.all(
  students.slice(0, maxStudents).map(async (student, index) => {
    const contemplacionesEvaluaciones = await dataSource.getStudentContemplaciones(
      student.id,
      'evaluaciones'
    );
    
    return {
      studentId: student.id,
      contemplacionesEvaluaciones,  // ⚠️ CRITICAL: If empty, no reminders generated
      // ...
    };
  })
);
```

#### Step 3: Bucketing Contemplaciones

**File**: [src/lib/contemplaciones/mapping.ts#L18-L51](src/lib/contemplaciones/mapping.ts#L18-L51)

```typescript
const MATERIALIZACION_BUCKET_MAP: Partial<Record<MaterializacionTipo, ContemplacionBucket>> = {
  diseño_cuadernillo: 'INSTRUMENT_DESIGN',
  norma_formato: 'INSTRUMENT_DESIGN',
  recordatorio_docente: 'ADMIN_REMINDER',     // ← Teacher reminders here
  regla_correccion: 'CORRECTION_REMINDER'     // ← Teacher reminders here
};

function collectBucketsForContemplacion(contemplacion: Contemplacion): ContemplacionBucket[] {
  const buckets = new Set<ContemplacionBucket>();

  for (const materializacion of contemplacion.materializaciones) {
    // ⚠️ CRITICAL: Only buckets for materializaciones with contexto === 'evaluacion' or 'ambos'
    if (materializacion.contexto !== 'evaluacion' && materializacion.contexto !== 'ambos') {
      continue;
    }
    const bucket = MATERIALIZACION_BUCKET_MAP[materializacion.tipo];
    if (bucket) buckets.add(bucket);
  }
  return Array.from(buckets);
}
```

#### Step 4: Template Lookup

**File**: [src/lib/contemplaciones/enforcement.ts#L40-L89](src/lib/contemplaciones/enforcement.ts#L40-L89)

```typescript
// ADMIN_REMINDER templates (from recordatorio_docente)
const EVALUATION_REMINDER_TEMPLATES: Record<string, string> = {
  'contemplacion-1': 'Recordar leer consignas en voz alta',
  'contemplacion-3': 'Recuerda brindar más tiempo y pausas...',
  'contemplacion-6': 'Permitir hoja auxiliar / borrador',
  'contemplacion-7': 'Recordatorio: calculadora / material concreto...',
  'contemplacion-8': 'Docente puede escuchar y ayudar a escribir...',
  'contemplacion-9-22': 'No penalizar ortografía/sintaxis cuando no es objetivo',
  'contemplacion-10': 'Verificar comprensión durante la prueba sin dar respuestas',
  // ...
};

// INSTRUMENT_DESIGN templates (from diseño_cuadernillo)
const EVALUATION_DESIGN_RULES: Record<string, string> = {
  'contemplacion-2': 'Palabras clave en negrita e íconos de apoyo',
  'contemplacion-4': 'Tipografía legible (letra ampliada y alto contraste)',
  'contemplacion-5': 'Consignas en 2 capas (producto + pasos numerados)',
  // ...
};
```

#### Step 5: Building Per-Student Reminders

**File**: [src/services/evaluations/designPlan.ts#L185-L238](src/services/evaluations/designPlan.ts#L185-L238)

```typescript
export function buildPerStudentReminders(students: StudentForAI[]): BuildRemindersResult {
  const missingTemplates: MissingTemplateError[] = [];
  
  const reminders = students.map(student => {
    // ⚠️ CRITICAL: If contemplacionesEvaluaciones is empty, buckets will be empty
    const buckets = getEvaluationBucketsForStudent(student.contemplacionesEvaluaciones);
    const admin = new Set<string>();
    const correction = new Set<string>();
    const allowances = new Set<string>();

    for (const [bucket, ids] of buckets.entries()) {
      for (const rawId of ids) {
        const normalizedId = normalizeContemplacionId(rawId);
        const contemplacion = getContemplacionById(normalizedId);
        if (!contemplacion) {
          console.error(`[buildPerStudentReminders] Contemplacion not found: ${normalizedId}`);
          continue;
        }

        const reminder = buildReminderText(contemplacion, bucket);
        
        if (!reminder) {
          // FAIL-FAST: Record missing template
          missingTemplates.push({ contemplacionId: normalizedId, bucket, studentId, ... });
          continue;
        }

        if (bucket === 'ADMIN_REMINDER') admin.add(reminder);
        if (bucket === 'CORRECTION_REMINDER') correction.add(reminder);
        if (bucket === 'INSTRUMENT_DESIGN') allowances.add(reminder);
      }
    }

    return {
      studentId: student.studentId,
      admin: Array.from(admin),
      correction: Array.from(correction),
      allowances: Array.from(allowances)
    };
  });

  return { reminders, missingTemplates };
}
```

---

## 2. Observed Behavior

### Current Symptoms

1. **"Recordatorios para el docente" shows empty state**: "No hay recordatorios específicos para este grupo."
2. **No error state shown**: Despite fail-fast implementation, no missing template errors are displayed
3. **Console shows**: `[EVAL_PIPELINE] No teacher reminders available from backend, showing empty state`

### Expected vs Actual

| Step | Expected | Actual |
|------|----------|--------|
| localStorage | Contains contemplaciones per student | **Unknown - needs verification** |
| `getGroupContextForAI` | Returns students with `contemplacionesEvaluaciones: [...]` | **Unknown - needs verification** |
| `buildPerStudentReminders` | Returns reminders with admin/correction/allowances | Returns `[]` or empty arrays |
| Backend response | `teacherRemindersByStudent: [...]` | `teacherRemindersByStudent: []` (or undefined) |

---

## 3. Root Cause Candidates (Ranked by Likelihood)

### Candidate 1: 🟥 contemplacionesEvaluaciones is empty (HIGH PROBABILITY)

**Evidence**:
1. `readSelected()` returns `[]` if localStorage key doesn't exist
2. localStorage key format: `contemplaciones_evaluaciones_${studentId}`
3. If no contemplaciones were saved for evaluation category, everything downstream is empty

**Code paths**:
- [storage.ts#L165-L168](src/lib/contemplaciones/storage.ts#L165-L168): Returns `[]` if no key found
- [provider.ts#L420](src/services/groupContext/provider.ts#L420): Passes empty array to `StudentForAI`

**Verification needed**:
```javascript
// In browser console:
const students = [1, 2, 3, 4, 5]; // student IDs
students.forEach(id => {
  const key = `contemplaciones_evaluaciones_${id}`;
  console.log(`${key}:`, localStorage.getItem(key));
});
```

### Candidate 2: 🟧 Buckets filtering excludes all contemplaciones (MEDIUM PROBABILITY)

**Evidence**:
- `collectBucketsForContemplacion()` only includes materializaciones where `contexto === 'evaluacion' || 'ambos'`
- If contemplaciones are defined with `contexto: 'clase'` only, they get filtered out

**Code paths**:
- [mapping.ts#L23-L27](src/lib/contemplaciones/mapping.ts#L23-L27): Filter by contexto
- [catalog.ts](src/lib/contemplaciones/catalog.ts): Materializacion definitions

**Example**: `contemplacion-8` has:
```typescript
{
  tipo: 'recordatorio_docente',
  descripcion: 'Docente puede escuchar y ayudar a escribir; NO en cuadernillo',
  contexto: 'evaluacion'  // ✅ Should be included
}
```

### Candidate 3: 🟨 Students array is empty or filtered out (LOW-MEDIUM PROBABILITY)

**Evidence**:
- `studentsWithAdjustments` filters students without contemplaciones:
  ```typescript
  const studentsWithAdjustments = studentsWithContemplaciones.filter(s => 
    s.ajustes || 
    (purpose === 'evaluation' && s.contemplacionesEvaluaciones.length > 0)
  );
  ```
- If no students have `contemplacionesEvaluaciones`, the array might be empty

**Code paths**:
- [provider.ts#L448-L453](src/services/groupContext/provider.ts#L448-L453): Filter logic

### Candidate 4: 🟩 Template lookup fails silently (LOW PROBABILITY)

**Evidence**:
- `buildReminderText()` returns `null` if no template exists
- But we added fail-fast that should create `missingTemplateErrors`
- If this were the cause, we'd see the error UI

**Code paths**:
- [designPlan.ts#L163-L176](src/services/evaluations/designPlan.ts#L163-L176): `buildReminderText`

---

## 4. Minimal Fix Plan

### Step 1: Add Diagnostic Logging (Non-invasive)

Add diagnostic logs guarded by `import.meta.env.DEV` in these locations:

#### A. In `getGroupContextForAI` after loading contemplaciones

**File**: [src/services/groupContext/provider.ts](src/services/groupContext/provider.ts) (~line 435)

```typescript
// ADD AFTER: const contemplacionesEvaluaciones = await dataSource...
if (import.meta.env.DEV) {
  console.log(`[DIAG:getGroupContextForAI] Student ${student.id} contemplacionesEvaluaciones:`, contemplacionesEvaluaciones);
}
```

#### B. In `buildPerStudentReminders` at entry

**File**: [src/services/evaluations/designPlan.ts](src/services/evaluations/designPlan.ts) (~line 187)

```typescript
// ADD AT START of buildPerStudentReminders:
if (import.meta.env.DEV) {
  console.log('[DIAG:buildPerStudentReminders] Input students:', 
    students.map(s => ({
      studentId: s.studentId,
      contemplacionesEvaluaciones: s.contemplacionesEvaluaciones
    }))
  );
}
```

#### C. In `buildPerStudentReminders` after bucket calculation

**File**: [src/services/evaluations/designPlan.ts](src/services/evaluations/designPlan.ts) (~line 192)

```typescript
// ADD AFTER: const buckets = getEvaluationBucketsForStudent(...)
if (import.meta.env.DEV) {
  console.log(`[DIAG:buildPerStudentReminders] Student ${student.studentId} buckets:`, 
    Object.fromEntries(buckets)
  );
}
```

### Step 2: Verify localStorage Data

Before fixing code, verify the actual data state:

```javascript
// Run in browser console while on EvaluacionesGrupo page:
function diagnoseReminders() {
  console.log('=== DIAGNOSING TEACHER REMINDERS ===');
  
  // 1. Check what contemplaciones are stored
  const keys = Object.keys(localStorage).filter(k => k.includes('contemplaciones_evaluaciones'));
  console.log('Contemplaciones localStorage keys:', keys);
  keys.forEach(k => {
    console.log(`  ${k}:`, JSON.parse(localStorage.getItem(k) || '[]'));
  });
  
  // 2. Check if any adecuaciones are set
  const adecKeys = Object.keys(localStorage).filter(k => k.includes('adecuacion'));
  console.log('Adecuaciones localStorage keys:', adecKeys);
  adecKeys.forEach(k => {
    console.log(`  ${k}:`, localStorage.getItem(k));
  });
}
diagnoseReminders();
```

### Step 3: Ensure Contemplaciones Are Being Selected

**Hypothesis**: Users have not selected contemplaciones for "evaluaciones" category.

**Quick verification**:
1. Navigate to student configuration (Contemplaciones/Adecuaciones selector)
2. Ensure contemplaciones are selected specifically for the **"evaluaciones"** category, not just "clase"
3. Regenerate evaluation

### Step 4: If localStorage IS populated correctly

If Step 2/3 shows contemplaciones ARE stored but reminders still empty:

1. Check that `context: 'evaluacion'` is present in catalog materializaciones
2. Check that template IDs match exactly (e.g., `contemplacion-1` not `contemplacion-01`)
3. Add more detailed logging in `buildReminderText()`:

```typescript
function buildReminderText(contemplacion: Contemplacion, bucket: ContemplacionBucket): string | null {
  if (import.meta.env.DEV) {
    console.log(`[DIAG:buildReminderText] Looking up ${contemplacion.id} for bucket ${bucket}`);
  }
  
  if (bucket === 'INSTRUMENT_DESIGN') {
    const result = getEvaluationDesignRuleTemplate(contemplacion.id);
    if (import.meta.env.DEV) {
      console.log(`  -> INSTRUMENT_DESIGN template:`, result || 'NOT FOUND');
    }
    return result || null;
  }
  // ... rest
}
```

---

## 5. Diagnostics Added

### Added diagnostic console.logs (DEV only)

**Location 1**: [src/services/evaluations/designPlan.ts#L188-L197](src/services/evaluations/designPlan.ts#L188-L197) - `buildPerStudentReminders` entry

```typescript
// DIAGNOSTIC: Log input students (DEV only)
if (import.meta.env.DEV) {
  console.log('[DIAG:buildPerStudentReminders] Input students:', 
    students.map(s => ({
      studentId: s.studentId,
      contemplacionesEvaluaciones: s.contemplacionesEvaluaciones,
      contemplacionesCount: s.contemplacionesEvaluaciones?.length || 0
    }))
  );
}
```

**Location 2**: [src/services/evaluations/designPlan.ts#L204-L210](src/services/evaluations/designPlan.ts#L204-L210) - after buckets calculation

```typescript
// DIAGNOSTIC: Log buckets per student (DEV only)
if (import.meta.env.DEV) {
  console.log(`[DIAG:buildPerStudentReminders] Student ${student.studentId}:`, {
    inputContemplaciones: student.contemplacionesEvaluaciones,
    buckets: Object.fromEntries(buckets),
    hasBuckets: buckets.size > 0
  });
}
```

**Location 3**: [src/services/groupContext/provider.ts#L426-L431](src/services/groupContext/provider.ts#L426-L431) - after loading contemplaciones

```typescript
// DIAGNOSTIC: Log contemplaciones loaded from localStorage (DEV only)
if (import.meta.env.DEV && (contemplacionesClase.length > 0 || contemplacionesEvaluaciones.length > 0)) {
  console.log(`[DIAG:getGroupContextForAI] Student ${student.id} contemplaciones:`, {
    clase: contemplacionesClase,
    evaluaciones: contemplacionesEvaluaciones
  });
}
```

### Pre-existing TypeScript Errors (Not from this investigation)

During investigation, found pre-existing type errors in [designPlan.ts#L292-L294](src/services/evaluations/designPlan.ts#L292-L294):

```typescript
// These properties don't exist on StudentForAI type:
student.requiereAdecuacionContenido === true ||
(student.informeTecnico?.requiereAdecuacionContenido === true)
```

**Note**: These errors are unrelated to the reminders pipeline and should be addressed separately.

---

## 6. Next Steps Summary

1. **Immediate**: Run `diagnoseReminders()` in browser console to verify localStorage state
2. **If localStorage empty**: Issue is in Contemplaciones selector UI - users need to select contemplaciones for "evaluaciones" category
3. **If localStorage has data but reminders still empty**: Add the diagnostic logs above and check console output during evaluation generation
4. **If buckets are empty**: Check `contexto` field in catalog matches 'evaluacion' or 'ambos'
5. **If templates not found**: Verify template keys in `EVALUATION_REMINDER_TEMPLATES` match catalog IDs exactly

---

## Appendix: Quick Console Diagnostic Script

Paste this in browser console while on the evaluations page:

```javascript
(async function diagnoseTeacherReminders() {
  console.log('%c=== TEACHER REMINDERS DIAGNOSTIC ===', 'color: blue; font-weight: bold');
  
  // 1. Check localStorage
  console.log('\n%c1. LocalStorage State:', 'font-weight: bold');
  const evalKeys = Object.keys(localStorage).filter(k => k.includes('contemplaciones_evaluaciones'));
  if (evalKeys.length === 0) {
    console.warn('⚠️ NO contemplaciones_evaluaciones keys found in localStorage!');
    console.log('   This is likely the root cause. Users need to select contemplaciones for evaluations.');
  } else {
    evalKeys.forEach(k => {
      const data = JSON.parse(localStorage.getItem(k) || '[]');
      console.log(`   ${k}: ${data.length} items`, data);
    });
  }
  
  // 2. Check class contemplaciones (for comparison)
  console.log('\n%c2. Class Contemplaciones (for comparison):', 'font-weight: bold');
  const claseKeys = Object.keys(localStorage).filter(k => k.includes('contemplaciones_clase'));
  if (claseKeys.length === 0) {
    console.log('   No class contemplaciones either');
  } else {
    claseKeys.forEach(k => {
      const data = JSON.parse(localStorage.getItem(k) || '[]');
      console.log(`   ${k}: ${data.length} items`, data);
    });
  }
  
  console.log('\n%c=== END DIAGNOSTIC ===', 'color: blue; font-weight: bold');
})();
```
