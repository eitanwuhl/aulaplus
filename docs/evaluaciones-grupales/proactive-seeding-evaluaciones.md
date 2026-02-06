# Proactive Seeding for Evaluation Contemplaciones

## Summary

This document explains the fix implemented to ensure "Recordatorios para el docente" shows real per-student reminders when generating group evaluations.

---

## Why Reminders Were Previously Empty

### The Problem

When generating a group evaluation, "Recordatorios para el docente" was showing an empty state ("No hay recordatorios específicos para este grupo") even when students had applicable contemplaciones defined in the defaults.

### Root Cause

Evaluation contemplaciones were **only seeded when `StudentProfile.tsx` was opened**. The seeding logic (`seedDefaultsForStudent()`) was called inside `StudentProfile`'s `useEffect`:

```typescript
// StudentProfile.tsx
useEffect(() => {
  const seedingResults = seedDefaultsForStudent(student.id, student.name, isDev);
  // ...
}, [student.id, ...]);
```

**If a teacher generated a group evaluation without opening each student's profile first:**

1. The localStorage keys `contemplaciones_evaluaciones_${studentId}` did not exist
2. `getGroupContextForAI()` read empty arrays for each student's `contemplacionesEvaluaciones`
3. `buildPerStudentReminders()` received empty input → produced empty output
4. The reminders panel had nothing to show

---

## What Proactive Seeding Does

**Proactive seeding ensures evaluation contemplaciones exist for ALL students in the selected group BEFORE the evaluation design plan is built.**

The seeding system:

1. **Checks if defaults exist** for each student ID in [defaults.ts](../../src/lib/contemplaciones/defaults.ts)
2. **Resolves labels to IDs** using the catalog
3. **Writes to localStorage** at key `contemplaciones_evaluaciones_${studentId}`
4. **Respects user modifications** via the `user_touched` flag (see below)

---

## Where the Seeding Now Happens

**File**: [src/pages/EvaluacionesGrupo.tsx](../../src/pages/EvaluacionesGrupo.tsx)

**Location**: Inside `handleGenerateEvaluations()`, immediately BEFORE calling `getGroupContextForAI()`.

```typescript
// Around line 912-928
try {
  const { supabase } = await import('@/integrations/supabase/client');
  const { getGroupContextForAI } = await import('@/services/groupContext/provider');
  const { seedDefaultsForStudent } = await import('@/lib/contemplaciones/seeding');
  
  // PROACTIVE SEEDING: Ensure evaluation contemplaciones exist for ALL students
  // in the selected group BEFORE loading the group context.
  if (selectedGroup?.students) {
    const isDev = import.meta.env.DEV;
    if (isDev) {
      console.log('[EVAL_PIPELINE] Proactive seeding: ensuring contemplaciones exist for all students');
    }
    for (const student of selectedGroup.students) {
      seedDefaultsForStudent(student.id, student.name, false); // Suppress verbose logs
    }
    if (isDev) {
      console.log(`[EVAL_PIPELINE] Proactive seeding complete for ${selectedGroup.students.length} students`);
    }
  }
  
  // Load unified group context for AI generation
  const groupContextData = await getGroupContextForAI(selectedGroup.id, { purpose: 'evaluation' });
  // ...
}
```

---

## Why This Does NOT Override Teacher Choices

The seeding system has built-in protection via the `user_touched` flag:

### How `user_touched` Works

1. When a teacher manually changes contemplaciones in `StudentProfile.tsx`, the `toggleSelected()` function calls `markUserTouched(studentId, category)`

2. This sets a localStorage flag: `contemplaciones_user_touched_evaluaciones_${studentId} = "true"`

3. When `seedDefaultsForStudent()` runs, it checks this flag:

```typescript
// seeding.ts
const userHasTouched = isUserTouched(studentId, category);

if (userHasTouched) {
  if (verbose) {
    console.log(`[SEED] [${CAT_UPPER}] 🔒 USER TOUCHED → SKIP (respecting manual edits)`);
  }
  return result; // Does NOT overwrite
}
```

### Result

| Scenario | What Happens |
|----------|--------------|
| Teacher never customized contemplaciones | Defaults are seeded |
| Teacher manually selected/deselected items in StudentProfile | `user_touched=true` → seeding is SKIPPED |
| Teacher clears all selections | Still `user_touched=true` → seeding is SKIPPED |

**Teacher choices are always preserved.**

---

## How to Verify the Fix Manually

### Step 1: Clear localStorage (Optional - for clean test)

In browser DevTools console:
```javascript
// Clear all contemplaciones keys for a clean test
Object.keys(localStorage)
  .filter(k => k.includes('contemplaciones'))
  .forEach(k => localStorage.removeItem(k));
```

### Step 2: Generate Evaluation Without Opening Student Profiles

1. Navigate to "Evaluaciones Grupales" (`/evaluaciones-grupo`)
2. Select a group (e.g., "1º Historia")
3. Select materia and content
4. Click "Generar Evaluación"

### Step 3: Check localStorage

In DevTools console:
```javascript
// Check that evaluation contemplaciones were seeded
Object.keys(localStorage)
  .filter(k => k.includes('contemplaciones_evaluaciones'))
  .forEach(k => console.log(k, JSON.parse(localStorage.getItem(k))));
```

**Expected**: Keys like `contemplaciones_evaluaciones_1`, `contemplaciones_evaluaciones_2`, etc. with arrays of contemplacion IDs.

### Step 4: Verify Console Logs (DEV mode)

In DEV mode, you should see:
```
[EVAL_PIPELINE] Proactive seeding: ensuring contemplaciones exist for all students
[EVAL_PIPELINE] Proactive seeding complete for 10 students
```

### Step 5: Check "Recordatorios para el docente" Panel

After generation completes, scroll to "Recordatorios para el docente" panel.

**Expected**: Per-student reminders grouped by student (Admin / Corrección / Permisos sections).

### Step 6: Verify Teacher Customizations Are Preserved

1. Open a student's profile in "Todos los Alumnos"
2. Modify their evaluation contemplaciones (check/uncheck items)
3. Go back to "Evaluaciones Grupales"
4. Generate a new evaluation
5. Check localStorage for that student

**Expected**: The student's contemplaciones should match what you set manually (not overwritten by defaults).

---

## Related Files

| File | Purpose |
|------|---------|
| [src/pages/EvaluacionesGrupo.tsx](../../src/pages/EvaluacionesGrupo.tsx) | Where proactive seeding is called |
| [src/lib/contemplaciones/seeding.ts](../../src/lib/contemplaciones/seeding.ts) | `seedDefaultsForStudent()` function |
| [src/lib/contemplaciones/storage.ts](../../src/lib/contemplaciones/storage.ts) | localStorage read/write, `user_touched` flag |
| [src/lib/contemplaciones/defaults.ts](../../src/lib/contemplaciones/defaults.ts) | Default contemplaciones per student profile |
| [src/services/groupContext/provider.ts](../../src/services/groupContext/provider.ts) | `getGroupContextForAI()` that reads contemplaciones |
| [src/services/evaluations/designPlan.ts](../../src/services/evaluations/designPlan.ts) | `buildPerStudentReminders()` that generates reminders |

---

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| `contemplaciones_evaluaciones_${studentId}` exists after generation | ✅ Proactive seeding creates them |
| `buildPerStudentReminders()` receives non-empty contemplaciones | ✅ Now populated by seeded defaults |
| "Recordatorios para el docente" shows per-student reminders | ✅ Admin/correction/allowances populated |
| Students without applicable contemplaciones show no reminders (no error) | ✅ Empty arrays handled gracefully |
| Teacher customizations are NOT overwritten | ✅ `user_touched` flag respected |
