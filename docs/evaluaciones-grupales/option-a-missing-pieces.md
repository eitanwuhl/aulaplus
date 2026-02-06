# Option A: Missing Pieces Analysis

> **Decision**: We will use Option A: "Store contemplaciones per student (for evaluations) and generate teacher reminders from those IDs."

This document investigates exactly what is missing in the current codebase for Option A to work end-to-end.

---

## 1. Storage Contract (Source of Truth)

### Exact localStorage Key Pattern

| Category | Key Pattern | Data Shape |
|----------|-------------|------------|
| Evaluations | `contemplaciones_evaluaciones_${studentId}` | `string[]` (array of IDs) |
| Class | `contemplaciones_clase_${studentId}` | `string[]` (array of IDs) |

**Source**: [src/lib/contemplaciones/storage.ts#L5-L6](src/lib/contemplaciones/storage.ts#L5-L6)

```typescript
// Key generator function
function getSelectedKey(studentId: string | number, category: ContemplacionCategoryStorage): string {
  if (category === 'clase') {
    return `contemplaciones_clase_${studentId}`;
  }
  return `contemplaciones_evaluaciones_${studentId}`;  // ← This is the key for evaluations
}
```

### Expected Data Shape

```typescript
// Example: contemplaciones_evaluaciones_1
["contemplacion-1", "contemplacion-3", "contemplacion-9-22", "contemplacion-10"]
```

- **Type**: `string[]` - Array of normalized contemplacion IDs
- **Normalization**: IDs are normalized via `normalizeContemplacionId()` (e.g., `#9` → `contemplacion-9-22`)

### Who Reads These Keys Today

| Consumer | File Path | Function | Purpose |
|----------|-----------|----------|---------|
| Storage reader | `src/lib/contemplaciones/storage.ts` | `readSelected(studentId, 'evaluaciones')` | Low-level read from localStorage |
| Context provider | `src/services/groupContext/provider.ts` | `getStudentContemplaciones()` | Loads contemplaciones into `StudentForAI.contemplacionesEvaluaciones` |
| Design plan builder | `src/services/evaluations/designPlan.ts` | `buildPerStudentReminders()` | Converts IDs to teacher reminders |

**Flow**: `readSelected()` → `getGroupContextForAI()` → `buildEvaluationDesignPlan()` → `perStudentReminders`

---

## 2. Write Path (Who Saves Contemplaciones?)

### ✅ UI Component EXISTS: StudentProfile.tsx

**File**: [src/components/StudentProfile.tsx](src/components/StudentProfile.tsx)

The UI to select and save evaluation contemplaciones **DOES EXIST**:

#### State Initialization (reads from localStorage)

```typescript
// Lines 94-99
const [selectedEval, setSelectedEval] = useState<string[]>(() => 
  readSelected(student.id, 'evaluaciones')
);
```

#### Toggle Handler (writes to localStorage)

```typescript
// Lines 513-516
const handleToggleCatalog = (contemplacionId: string) => {
  const newSelection = toggleSelected(student.id, category, contemplacionId);
  setSelected(newSelection);
};
```

**Actual write call**: [src/lib/contemplaciones/storage.ts#L305-L310](src/lib/contemplaciones/storage.ts#L305-L310)

```typescript
export function toggleSelected(...) {
  // ...
  writeSelected(studentId, category, newSelection);  // ← WRITES to localStorage
  markUserTouched(studentId, category);              // ← Prevents auto-upgrade
  return newSelection;
}
```

#### Seeding on First Load

```typescript
// Lines 186-245
useEffect(() => {
  // Seed defaults for this student (includes evaluation category)
  const seedingResults = seedDefaultsForStudent(student.id, student.name, isDev);
  
  // ...
  
  // If no defaults, fall back to legacy mapping
  if (finalEval.length === 0) {
    const suggestedEval = mapLegacyToCatalogIds(student.contemplaciones, 'evaluaciones');
    if (suggestedEval.length > 0) {
      writeSelected(student.id, 'evaluaciones', suggestedEval);
      setSelectedEval(suggestedEval);
    }
  }
}, [student.id, student.name, student.contemplaciones]);
```

### ⚠️ CRITICAL FINDING: Seeding DOES Write Evaluation Contemplaciones

The seeding system ([src/lib/contemplaciones/seeding.ts](src/lib/contemplaciones/seeding.ts)) DOES populate evaluation contemplaciones when:

1. **Student has defaults defined** in [src/lib/contemplaciones/defaults.ts](src/lib/contemplaciones/defaults.ts)
2. **User has NOT touched** the selection manually (no `user_touched` flag)
3. **StudentProfile is opened** (seeding runs in `useEffect`)

**Key Requirement**: A teacher must open the StudentProfile page at least once to trigger seeding.

---

## 3. Catalog/Templates Coverage

### Template Locations

| Bucket | Template Source | File |
|--------|-----------------|------|
| `ADMIN_REMINDER` | `EVALUATION_REMINDER_TEMPLATES` | [src/lib/contemplaciones/enforcement.ts#L43-L57](src/lib/contemplaciones/enforcement.ts#L43-L57) |
| `CORRECTION_REMINDER` | `EVALUATION_REMINDER_TEMPLATES` | Same file |
| `INSTRUMENT_DESIGN` | `EVALUATION_DESIGN_RULES` | [src/lib/contemplaciones/enforcement.ts#L62-L77](src/lib/contemplaciones/enforcement.ts#L62-L77) |

### Current Supported IDs and What They Produce

#### `EVALUATION_REMINDER_TEMPLATES` (ADMIN_REMINDER + CORRECTION_REMINDER)

| Contemplacion ID | Template Text | Bucket |
|------------------|---------------|--------|
| `contemplacion-1` | "Recordar leer consignas en voz alta" | ADMIN_REMINDER |
| `contemplacion-3` | "Recuerda brindar más tiempo y pausas..." | ADMIN_REMINDER |
| `contemplacion-6` | "Permitir hoja auxiliar / borrador" | ADMIN_REMINDER |
| `contemplacion-7` | "Recordatorio: calculadora / material concreto..." | ADMIN_REMINDER |
| `contemplacion-8` | "Docente puede escuchar y ayudar a escribir..." | ADMIN_REMINDER |
| `contemplacion-9-22` | "No penalizar ortografía/sintaxis..." | CORRECTION_REMINDER |
| `contemplacion-10` | "Verificar comprensión durante la prueba..." | ADMIN_REMINDER |
| `contemplacion-11` | "Recordatorio: ubicación estratégica en aula..." | ADMIN_REMINDER |
| `contemplacion-20` | "Recordatorio: señalización explícita de tiempos..." | ADMIN_REMINDER |
| `contemplacion-21` | "Permitir inicio anticipado o extensión..." | ADMIN_REMINDER |
| `contemplacion-23` | "No pedir justificaciones extensas" | ADMIN_REMINDER |
| `contemplacion-24` | "Brindarle sugerencia de orden de respuesta" | ADMIN_REMINDER |
| `contemplacion-25` | "Apoyos motivacionales breves..." | ADMIN_REMINDER |
| `contemplacion-26` | "Recordatorio: soporte digital..." | ADMIN_REMINDER |

#### `EVALUATION_DESIGN_RULES` (INSTRUMENT_DESIGN → "allowances")

| Contemplacion ID | Template Text |
|------------------|---------------|
| `contemplacion-2` | "Palabras clave en negrita e íconos de apoyo" |
| `contemplacion-4` | "Tipografía legible (letra ampliada y alto contraste)" |
| `contemplacion-5` | "Consignas en 2 capas (producto + pasos numerados)" |
| `contemplacion-12` | "Incluir 'mapa de la prueba' (secciones, puntaje, tiempo)" |
| `contemplacion-13` | "Plantillas de respuesta (tabla/matriz/guía)..." |
| `contemplacion-14` | "Checklist final del estudiante..." |
| `contemplacion-15` | "Cuadernillo siempre impreso/entregado" |
| `contemplacion-16` | "Diagramación legible y 'no saturada'..." |
| `contemplacion-17` | "Tipografía: Arial 13–14; interlineado 1.5 o doble" |
| `contemplacion-18` | "Enunciados simples y lenguaje concreto..." |
| `contemplacion-19` | "Texto por bloques + preguntas inmediatamente..." |
| `contemplacion-20` | "Cronograma sugerido por secciones" |
| `contemplacion-23` | "Plantillas/casilleros; si hay V/F exigir justificación..." |
| `contemplacion-27` | "Apoyaturas de memotecnia..." |

### ⚠️ Missing Templates Analysis

Some contemplaciones in catalog do **NOT** produce ADMIN/CORRECTION reminders because they have `diseño_cuadernillo` type (INSTRUMENT_DESIGN bucket) rather than `recordatorio_docente` type.

**Example**: `contemplacion-5` (Segmentación de consignas en pasos numerados)
- **In catalog**: Has `diseño_cuadernillo` contexto=evaluacion → Goes to INSTRUMENT_DESIGN
- **In EVALUATION_DESIGN_RULES**: Has template → Produces "allowances"
- **NOT in EVALUATION_REMINDER_TEMPLATES**: Does NOT produce admin/correction reminders

This is **BY DESIGN** - some contemplaciones affect the evaluation design but don't need teacher reminders.

---

## 4. End-to-End Trace

### Step 1: Selecting Contemplaciones

| What | Where |
|------|-------|
| **UI** | StudentProfile.tsx opens |
| **Trigger** | `useEffect` runs `seedDefaultsForStudent()` |
| **Write** | `writeSelected(studentId, 'evaluaciones', ids)` |
| **Key** | `contemplaciones_evaluaciones_${studentId}` |

### Step 2: Opening Group Evaluation

| What | Where |
|------|-------|
| **Page** | [EvaluacionesGrupo.tsx](src/pages/EvaluacionesGrupo.tsx) |
| **Trigger** | User clicks "Generar evaluación" |
| **Load context** | `getGroupContextForAI(selectedGroup.id, { purpose: 'evaluation' })` |
| **File** | [src/services/groupContext/provider.ts#L370-L440](src/services/groupContext/provider.ts#L370-L440) |

### Step 3: Reading Contemplaciones into Student Objects

```typescript
// provider.ts ~line 420
const contemplacionesEvaluaciones = await dataSource.getStudentContemplaciones(
  student.id,
  'evaluaciones'
);

// This calls:
// storage.ts readSelected(studentId, 'evaluaciones')
// Which reads: localStorage.getItem(`contemplaciones_evaluaciones_${studentId}`)
```

**Result**: `StudentForAI.contemplacionesEvaluaciones` is populated

### Step 4: Building `teacherRemindersByStudent`

```typescript
// EvaluacionesGrupo.tsx ~line 942
const plan = buildEvaluationDesignPlan({
  groupContext: groupContextData,
  teacherRequirementsText: requerimientos
});

// designPlan.ts buildEvaluationDesignPlan() calls:
const reminderResult = buildPerStudentReminders(students);
// Returns: { reminders: StudentReminders[], missingTemplates: MissingTemplateError[] }

// The plan includes:
perStudentReminders: reminderResult.reminders
```

### Step 5: Sending to Edge Function

```typescript
// EvaluacionesGrupo.tsx ~line 1019-1028
const requestBody = {
  // ...
  evaluation_design_plan: {
    // ...
    perStudentReminders: effectivePlan.perStudentReminders,  // ← Sent to backend
  }
};
```

### Step 6: Edge Function Returns

```typescript
// modify-evaluation/index.ts ~line 2048-2050
const teacherRemindersByStudent = Array.isArray(designPlan.perStudentReminders)
  ? designPlan.perStudentReminders
  : [];
```

### Step 7: Frontend Receives and Sets State

```typescript
// EvaluacionesGrupo.tsx ~line 1239-1242
const reminders = Array.isArray(data?.teacherRemindersByStudent) && data.teacherRemindersByStudent.length > 0
  ? data.teacherRemindersByStudent
  : [];
setTeacherReminders(reminders);
```

### Step 8: TeacherRemindersPanel Renders

```typescript
// TeacherRemindersPanel.tsx ~line 30-33
const meaningfulReminders = reminders.filter(item =>
  item.admin.length > 0 || item.correction.length > 0 || item.allowances.length > 0
);
// If meaningfulReminders.length === 0, shows empty state
```

---

## 5. Why Empty Right Now

### Root Cause Statement

**The reminders panel is empty because `contemplacionesEvaluaciones` arrays are empty for all students at the time `buildPerStudentReminders()` runs.**

### Evidence

1. **Seeding requires StudentProfile to be opened**: 
   - [seeding.ts](src/lib/contemplaciones/seeding.ts) only runs from `StudentProfile.tsx` useEffect
   - If teacher never opens a student's profile, no evaluation contemplaciones are seeded
   
2. **No proactive seeding on evaluation page**:
   - `EvaluacionesGrupo.tsx` does NOT call seeding functions
   - It only reads existing localStorage data via `getGroupContextForAI()`
   
3. **Diagnostic logs confirm empty arrays**:
   - `[DIAG:buildPerStudentReminders]` shows `contemplacionesEvaluaciones: []` for all students

### Why This Happens

```
Teacher opens EvaluacionesGrupo
         ↓
getGroupContextForAI() called
         ↓
readSelected(studentId, 'evaluaciones') for each student
         ↓
localStorage key 'contemplaciones_evaluaciones_${id}' does NOT exist
         ↓
Returns empty array []
         ↓
buildPerStudentReminders() receives students with empty contemplacionesEvaluaciones
         ↓
No buckets are generated, no reminders are produced
         ↓
TeacherRemindersPanel shows "No hay recordatorios específicos"
```

---

## ✅ What is Missing to Make Option A Work

### Checklist

- [ ] **Proactive seeding before evaluation generation**
  - Add a call to seed contemplaciones for ALL students in the selected group before building the design plan
  - Location: `EvaluacionesGrupo.tsx` before `getGroupContextForAI()` call
  - Implementation: Loop through group students and call `seedDefaultsForStudent()` for each

- [ ] **OR: Teacher workflow to select contemplaciones**
  - Ensure teachers are prompted/reminded to configure student contemplaciones before generating evaluations
  - Could be a wizard step or validation message

- [x] **Storage contract is correct**
  - Key pattern: `contemplaciones_evaluaciones_${studentId}` ✅
  - Data shape: `string[]` of contemplacion IDs ✅

- [x] **Write path exists**
  - `StudentProfile.tsx` can read/write evaluation contemplaciones ✅
  - `toggleSelected()` and `writeSelected()` work correctly ✅

- [x] **Templates coverage is complete**
  - `EVALUATION_REMINDER_TEMPLATES` covers admin/correction reminders ✅
  - `EVALUATION_DESIGN_RULES` covers allowances ✅
  - Fail-fast reports missing templates ✅

- [x] **End-to-end plumbing is in place**
  - `buildPerStudentReminders()` produces correct output when input is populated ✅
  - Backend passes through `teacherRemindersByStudent` ✅
  - Frontend sets state and UI renders correctly ✅

### Minimal Fix Required

**Single Point of Failure**: No proactive seeding on the evaluation page.

**Fix Option 1 (Recommended)**: Add proactive seeding in `EvaluacionesGrupo.tsx`:

```typescript
// Before calling getGroupContextForAI()
for (const student of selectedGroup.students) {
  seedDefaultsForStudent(student.id, student.name, import.meta.env.DEV);
}
```

**Fix Option 2**: Add a "Configure Students" step in the evaluation wizard that ensures contemplaciones are selected before generation.

---

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| localStorage key pattern | ✅ Working | `contemplaciones_evaluaciones_${studentId}` |
| Data shape | ✅ Correct | `string[]` of IDs |
| Write path (StudentProfile) | ✅ Exists | Seeding + manual toggle |
| Read path (getGroupContextForAI) | ✅ Working | Reads from localStorage |
| Template mapping | ✅ Complete | 14 ADMIN/CORRECTION + 14 DESIGN templates |
| Bucketing logic | ✅ Working | `mapSelectedContemplacionesToBuckets()` |
| Reminder builder | ✅ Working | `buildPerStudentReminders()` |
| Backend passthrough | ✅ Working | `teacherRemindersByStudent` |
| UI rendering | ✅ Working | TeacherRemindersPanel |
| **Proactive seeding** | ❌ MISSING | No seeding before evaluation generation |

**The system is 95% complete. The only missing piece is proactive seeding of evaluation contemplaciones before the evaluation generation flow.**
