# Evaluation Versioning with Explicit Flags - Implementation Report

> **Date**: 2025-01-XX  
> **Feature**: Use explicit adaptation flags to determine evaluation versions and student assignments  
> **Status**: ✅ Implemented

---

## Summary

Updated group evaluation generation to use explicit adaptation flags (`requiereAdecuacionAcceso`, `requiereAdecuacionContenido`) as the source of truth for determining which evaluation versions to generate and which students are assigned to each version. The "highly adapted" version (V3) is now **only** generated when there is at least one student with content adaptation, and it is assigned **only** to those students.

---

## Previous Behavior vs New Behavior

### Previous Behavior

**Student Classification** (lines 599-624, before fix):
- **V1 (Standard)**: Students with `contemplaciones.length === 0`
- **V2 (Moderate)**: Students with `contemplaciones.length === 1 || 2`
- **V3 (High)**: Students with `contemplaciones.length >= 3` OR text matching "adecuaciones curriculares" in `modalidadCursado`

**Problems**:
- ❌ Inference-based: Counted `contemplaciones` array length
- ❌ Text parsing: Checked if `modalidadCursado` contained keywords
- ❌ Always generated 3 versions (even if no students needed content adaptation)
- ❌ V3 assigned to students without formal content adaptations
- ❌ Unreliable: Text parsing could miss variations, contemplaciones count doesn't distinguish access vs content

---

### New Behavior

**Student Classification** (lines 647-666, after fix):
- **V3 (Content-Adapted)**: **ONLY** students with `requiereAdecuacionContenido === true`
- **V2 (Moderate Support)**: Students with `requiereAdecuacionAcceso === true` (but NOT content adaptation)
- **V1 (Standard)**: All remaining students (no explicit flags)

**Version Generation**:
- **Always generated**: V1 (standard), V2 (moderate support)
- **Conditionally generated**: V3 (highly adapted) **only if** `hasContentAdaptation === true`
- If no students have content adaptation → **2 versions** generated (V1, V2)
- If at least 1 student has content adaptation → **3 versions** generated (V1, V2, V3)

**Benefits**:
- ✅ Explicit flags: Teacher must explicitly declare adaptations
- ✅ Deterministic: No inference, no text parsing
- ✅ Accurate: V3 only for students with formal content adaptations
- ✅ Efficient: Don't generate V3 if not needed

---

## Exact Rules Implemented

### Rule 1: Content Adaptation Eligibility

**Definition**: A student requires content adaptation **if and only if** `requiereAdecuacionContenido === true`

**Implementation**:
- Function: `studentRequiresContentAdaptation(student)` (lines 64-86)
- Checks:
  1. localStorage: `adecuacionContenido:${student.id}` → if `true`, return `true`
  2. Fallback: `student.informeTecnico?.requiereAdecuacionContenido === true`
  3. Default: `false`

**Usage**:
- Determines if V3 should be generated
- Determines which students are assigned to V3

---

### Rule 2: Access Accommodations

**Definition**: A student requires access accommodations **if and only if** `requiereAdecuacionAcceso === true`

**Implementation**:
- Function: `studentRequiresAccessAccommodations(student)` (lines 88-110)
- Checks:
  1. localStorage: `adecuacionAcceso:${student.id}` → if `true`, return `true`
  2. Fallback: `student.informeTecnico?.requiereAdecuacionAcceso === true`
  3. Default: `false`

**Usage**:
- Determines which students are assigned to V2 (moderate support)
- Students with BOTH access and content → assigned to V3 (content takes priority)

---

### Rule 3: Version Assignment Logic

**Location**: `getVersionData()` function (lines 641-682)

**Assignment Rules**:
```typescript
// V3: Only students with content adaptation
const conAdecuacionContenido = alumnos.filter(a => 
  studentRequiresContentAdaptation(a)
);

// V2: Students with access accommodations (but NOT content adaptation)
const conAdecuacionAcceso = alumnos.filter(a => 
  studentRequiresAccessAccommodations(a) && !studentRequiresContentAdaptation(a)
);

// V1: All remaining students
const sinAdecuacionesExplicitas = alumnos.filter(a => 
  !studentRequiresContentAdaptation(a) && !studentRequiresAccessAccommodations(a)
);
```

**Priority**: Content adaptation > Access accommodations > Standard

**Result**:
- `v1`: Students with no explicit flags
- `v2`: Students with access accommodations only
- `v3`: Students with content adaptation (regardless of access flag)

---

### Rule 4: Conditional V3 Generation

**Location**: `handleGenerateEvaluations()` function (lines 778-805)

**Logic**:
```typescript
const hasContentAdaptation = versionStudentData?.hasContentAdaptation ?? false;

const evaluationConfigs = [
  { id: '1', ... },  // Always generated
  { id: '2', ... },  // Always generated
  // V3 only if hasContentAdaptation === true
  ...(hasContentAdaptation ? [{ id: '3', ... }] : [])
];
```

**Behavior**:
- If `hasContentAdaptation === false`: Generate 2 versions (V1, V2)
- If `hasContentAdaptation === true`: Generate 3 versions (V1, V2, V3)

---

## Files Modified

1. **`src/pages/EvaluacionesGrupo.tsx`**
   - Added `studentRequiresContentAdaptation()` helper function (lines 64-86)
   - Added `studentRequiresAccessAccommodations()` helper function (lines 88-110)
   - Updated `getVersionData()` to use explicit flags instead of contemplaciones heuristics (lines 641-682)
   - Updated `handleGenerateEvaluations()` to conditionally generate V3 (lines 778-805)
   - Updated fallback generation to conditionally generate V3 (lines 860-880)
   - Updated UI text to reflect variable number of versions (line 1579)

---

## Data Source Priority

### 1. localStorage (Primary - User-Controlled)

**Keys**:
- `adecuacionContenido:${student.id}` → boolean
- `adecuacionAcceso:${student.id}` → boolean

**Why Primary**: 
- Set by teacher via explicit checkboxes in StudentProfile
- Represents current user-controlled state
- Persists across sessions

**Reading Pattern**:
```typescript
const key = `adecuacionContenido:${student.id}`;
const stored = localStorage.getItem(key);
if (stored !== null) {
  const value = JSON.parse(stored);
  if (value === true) return true;
}
```

---

### 2. student.informeTecnico (Fallback - Mock Data)

**Fields**:
- `student.informeTecnico.requiereAdecuacionContenido` → boolean
- `student.informeTecnico.requiereAdecuacionAcceso` → boolean

**Why Fallback**:
- Used if localStorage doesn't have values yet
- Allows mock data to have initial values
- Maintains backward compatibility

---

### 3. Default (No Adaptations)

**Value**: `false`

**When Used**:
- localStorage has no value for the student
- `student.informeTecnico` is undefined or flags are `false`/undefined
- Any error reading localStorage

---

## Edge Cases Handled

### 1. No Students with Content Adaptation

**Scenario**: All students have `requiereAdecuacionContenido === false`

**Behavior**:
- `hasContentAdaptation === false`
- V3 is **NOT generated**
- Only V1 and V2 are generated
- UI shows 2 evaluation versions

**Code**:
```typescript
...(hasContentAdaptation ? [{ id: '3', ... }] : [])
```

---

### 2. All Students with Content Adaptation

**Scenario**: All students have `requiereAdecuacionContenido === true`

**Behavior**:
- `hasContentAdaptation === true`
- V3 is generated
- V3 assigned to all students
- V1 and V2 may be empty (but still generated)

**Result**: 3 versions generated, but V1 and V2 have no assigned students

---

### 3. Student with Both Flags

**Scenario**: Student has both `requiereAdecuacionAcceso === true` AND `requiereAdecuacionContenido === true`

**Behavior**:
- Assigned to **V3** (content adaptation takes priority)
- **NOT** assigned to V2 (even though access accommodation is true)
- Logic: `studentRequiresAccessAccommodations(a) && !studentRequiresContentAdaptation(a)` excludes this case

---

### 4. localStorage Read Errors

**Scenario**: JSON.parse fails or localStorage is unavailable

**Behavior**:
- Wrapped in try/catch
- Falls through to `student.informeTecnico` fallback
- Defaults to `false` if both sources fail
- Never throws errors

---

### 5. Empty Assigned Students Arrays

**Scenario**: A version has no assigned students (e.g., all students in V3, V1 and V2 empty)

**Behavior**:
- Version is still generated (for consistency)
- `assignedStudents: []` (empty array)
- UI rendering handles empty arrays gracefully (shows message or empty state)

---

## Before/After Examples

### Example 1: Group with No Content Adaptations

**Before**:
- Generated: 3 versions (V1, V2, V3)
- V3 assigned to: Students with 3+ contemplaciones or text match
- Problem: V3 generated even though no formal content adaptations

**After**:
- Generated: 2 versions (V1, V2)
- V3: **NOT generated** (no students with `requiereAdecuacionContenido === true`)
- Result: More efficient, accurate

---

### Example 2: Group with 2 Students Needing Content Adaptation

**Before**:
- Generated: 3 versions
- V3 assigned to: 2 students with content + students with 3+ contemplaciones
- Problem: V3 included students without formal content adaptations

**After**:
- Generated: 3 versions
- V3 assigned to: **ONLY** the 2 students with `requiereAdecuacionContenido === true`
- Result: Accurate assignment, only students who need it

---

### Example 3: Group with Mixed Adaptations

**Students**:
- 5 students: No flags (standard)
- 3 students: `requiereAdecuacionAcceso === true` (access accommodations)
- 2 students: `requiereAdecuacionContenido === true` (content adaptation)

**After**:
- **V1**: 5 students (no flags)
- **V2**: 3 students (access accommodations only)
- **V3**: 2 students (content adaptation)
- **Generated**: 3 versions (because `hasContentAdaptation === true`)

---

## UI Behavior

### Evaluation Display

**Location**: `src/pages/EvaluacionesGrupo.tsx` (line 1612)

**Rendering**:
```typescript
{generatedEvaluations.map((evaluation) => (
  <EvaluacionVisualRenderer ... />
))}
```

**Behavior**:
- Maps over `generatedEvaluations` array (2 or 3 items)
- Each evaluation shows assigned students via `evaluation.assignedStudents`
- UI automatically handles 2 or 3 versions (no hardcoded count)

---

### User Feedback Text

**Before** (line 1579):
```
"Se generarán 3 versiones automáticamente adaptadas según las contemplaciones de tus estudiantes"
```

**After**:
```
"Se generarán versiones automáticamente adaptadas según las adecuaciones declaradas de tus estudiantes"
```

**Change**: Removed "3" (now variable), changed "contemplaciones" to "adecuaciones declaradas"

---

## Testing Recommendations

1. **No Content Adaptations**:
   - Set no students with `requiereAdecuacionContenido === true`
   - Generate evaluations
   - Verify: Only 2 versions generated (V1, V2)

2. **With Content Adaptations**:
   - Set 2-3 students with `requiereAdecuacionContenido === true`
   - Generate evaluations
   - Verify: 3 versions generated, V3 assigned only to those students

3. **Mixed Scenarios**:
   - Mix of access accommodations and content adaptations
   - Verify: Correct assignment to V2 vs V3

4. **localStorage Persistence**:
   - Set flags, generate evaluations
   - Refresh page, generate again
   - Verify: Same assignments (flags persist)

5. **Flag Changes**:
   - Generate evaluations
   - Change flags in student profile
   - Generate again
   - Verify: Assignments update correctly

---

## Related Documentation

- `docs/STUDENT_PROFILE_ADAPTATION_FLAGS.md` - Implementation of explicit flags in student profile
- `docs/GROUP_SUMMARY_ADAPTATION_COUNT_FIX.md` - Group summary count fix using explicit flags
- `docs/EVAL_ASSIGNED_STUDENTS_FIX.md` - Fix for assigned students display
- `docs/EVAL_PROFILES_PIPELINE.md` - Original inspection of evaluation generation pipeline

---

## Changes Made By Cursor

**Files Modified**:
1. `src/pages/EvaluacionesGrupo.tsx`
   - Added `studentRequiresContentAdaptation()` helper (lines 64-86)
   - Added `studentRequiresAccessAccommodations()` helper (lines 88-110)
   - Updated `getVersionData()` to use explicit flags (lines 641-682)
   - Updated `handleGenerateEvaluations()` to conditionally generate V3 (lines 778-805)
   - Updated fallback generation to conditionally generate V3 (lines 860-880)
   - Updated UI text to reflect variable versions (line 1579)

**Files Created**:
- `docs/EVAL_VERSIONING_EXPLICIT_FLAGS.md` (this file)

**No Changes To**:
- Edge functions (`modify-evaluation`)
- AI prompts
- Database schema
- Student profile UI (flags already implemented)
- Evaluation rendering logic (already handles variable count)

**Methodology**:
- Located student classification logic in `getVersionData()`
- Created helper functions following localStorage + fallback pattern (same as TeacherGroups.tsx)
- Replaced inference-based logic with explicit flag checking
- Added conditional V3 generation based on `hasContentAdaptation` flag
- Updated both main generation and fallback paths
- Minimal changes (only classification and generation logic)

---

## Backward Compatibility

✅ **Maintained**:
- Falls back to `student.informeTecnico` if localStorage not set
- Defaults to `false` if neither source has values
- UI handles 2 or 3 versions gracefully
- Existing evaluation rendering continues to work

⚠️ **Behavior Change**:
- V3 may not be generated if no students have content adaptation (this is intentional and correct)

---

## Future Integration

When these flags are used in other parts of the system:
- **Group Summary**: Already updated (see `docs/GROUP_SUMMARY_ADAPTATION_COUNT_FIX.md`)
- **Evaluation Assignment Display**: Already fixed (see `docs/EVAL_ASSIGNED_STUDENTS_FIX.md`)
- **AI Prompt Enhancement** (future): Could pass explicit flags to edge function for better prompt construction
- **Database Migration** (future): Flags can be migrated to database columns when students table is added










