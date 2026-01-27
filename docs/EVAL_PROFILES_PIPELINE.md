# Evaluation Profiles Pipeline - Inspection Report

> **Purpose**: Understand how group profiles and student adjustments are stored and used in GROUP evaluation generation. Inspection-only, no code modifications.

---

## A) Where Profiles Live

### A.1 Group Profiles

**Status**: ✅ **STORED IN SUPABASE DATABASE**

**Table**: `grupos`
**Columns**:
- `id` (TEXT, PK) - Group ID (e.g., "9no 1")
- `name` (TEXT) - Group name
- `year` (TEXT, nullable) - Year (e.g., "9no")
- `section` (TEXT, nullable) - Section (e.g., "1")
- `user_id` (UUID, FK → auth.users) - Owner
- `teacher_sugerencias` (JSONB, nullable) - Teacher-editable suggestions: `{ aula?: string, evaluaciones?: string, otras?: string }`
- `created_at`, `updated_at` (timestamptz)

**Migration File**: `supabase/migrations/20251226174831_add_grupos_table_teacher_sugerencias.sql` (lines 4-13)

**RLS Policies**: Users can only access their own groups (lines 19-33 in migration)

**Usage**:
- Loaded via `src/utils/groupContext.ts` → `loadGroupContext(grupoId)` (lines 141-241)
- Fetches `teacher_sugerencias` from Supabase (lines 156-176)
- Falls back to empty if not found

---

### A.2 Individual Student Profiles/Adjustments

**Status**: ❌ **NOT STORED IN DATABASE** - Only in frontend mock data

**Location**: `src/data/mockData.ts`

**Structure**:
```typescript
export interface Student {
  id: number;
  name: string;
  perfil: string;                    // Learning style (e.g., "Visual-Kinestésico")
  ajustes?: string;                  // Adjustments summary (e.g., "Tiempo extendido")
  contemplaciones: string[];         // Specific accommodations
  informeTecnico?: InformeTecnico;   // Technical report with modalidadCursado
  // ... other fields
}

export interface Group {
  id: string;
  name: string;
  students: Student[];  // Students array (NOT in DB)
  teacher_sugerencias?: TeacherSugerencias;
}
```

**Mock Data**: `mockGroups` array (line 545+ in `src/data/mockData.ts`)

**Loading**:
- `src/utils/groupContext.ts` → `loadGroupContext()` uses `mockGroups.find()` (line 181)
- No database table exists for students
- Students are hardcoded in frontend

**Files Checked**:
- `src/data/mockData.ts` (entire file)
- `supabase/migrations/` (all files - no students table found)
- `src/utils/groupContext.ts` (lines 178-192)

---

## B) End-to-End Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ UI ENTRYPOINT: EvaluacionesGrupo.tsx                            │
│ - User selects group, subject, content, competencies             │
│ - Clicks "Generar evaluaciones" button                          │
│ - handleGenerateEvaluations() called (line 711)                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Student Classification                                │
│ - getVersionData() called (line 594)                            │
│ - Classifies students by contemplaciones count:                │
│   • v1: contemplaciones.length === 0 (sin adaptaciones)        │
│   • v2: contemplaciones.length === 1 || 2 (adaptaciones medias)│
│   • v3: contemplaciones.length >= 3 || adecuaciones curriculares│
│ - Returns: { v1: [...], v2: [...], v3: [...] }                  │
│   Each array contains: { nombre, contemplaciones }             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Build Request Payloads                                 │
│ - Creates 3 evaluation configs (lines 741-763)                 │
│ - assignedStudents set per version:                            │
│   • v1: versionStudentData.v1.map(s => s.nombre)              │
│   • v2: versionStudentData.v2.map(s => s.nombre)              │
│   • v3: versionStudentData.v3.map(s => s.nombre)              │
│ - groupContext includes ALL students (line 737):               │
│   students: selectedGroup.students  // ⚠️ ALL students, not filtered│
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: modify-evaluation (3 parallel calls)             │
│ File: supabase/functions/modify-evaluation/index.ts            │
│                                                                 │
│ Request Body (lines 224-235):                                   │
│ {                                                                │
│   originalEvaluation: string,                                   │
│   modification: string,                                         │
│   groupContext: {                                               │
│     subject: string,                                            │
│     content: string[],                                          │
│     students: Student[]  // ⚠️ ALL students (not version-specific)│
│   },                                                            │
│   type: 'modification',                                         │
│   adaptationLevel: 'standard' | 'moderate' | 'high'            │
│ }                                                                │
│                                                                 │
│ Note: assignedStudents NOT sent to edge function                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: Prompt Construction                              │
│ - System prompt (lines 428-573): Evaluation generation rules   │
│ - User prompt (lines 575-596): Includes groupContext.students  │
│ - groupContext.students filtered to 5 max (line 348):          │
│   .filter(s => s.contemplaciones?.length || s.ajustes)         │
│   .slice(0, 5)                                                  │
│ - LLM receives: ALL students (up to 5 with adjustments)        │
│ - No explicit version-specific student list                    │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ LLM: OpenAI API (GPT-4.1-2025-04-14)                           │
│ - Generates evaluation content                                  │
│ - Does NOT receive version-specific student assignments         │
│ - Does NOT know which students belong to which version         │
│ - Returns: HTML evaluation content only                        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Save Evaluation Objects                               │
│ - Creates GeneratedEvaluation[] (lines 789-801)                │
│ - Each evaluation has:                                          │
│   • id, version, title, content (from LLM)                     │
│   • adaptations: string[]                                        │
│   • assignedStudents: string[]  // ✅ Calculated in frontend   │
│ - assignedStudents set from versionStudentData (lines 747, 754, 761)│
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI RENDERING: EvaluacionVisualRenderer                          │
│ - Receives: evaluation object + students prop                  │
│ - students prop: ALL students (line 1579)                      │
│ - evaluation.assignedStudents: NOT passed to renderer          │
│ - SimplifiedSmartRubric called (line 110)                      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ BUG LOCATION: SimplifiedSmartRubric.tsx                        │
│ - generateStudentAssignments() (lines 117-133)                  │
│ - Uses: students.slice(0, Math.min(4, students.length))        │
│ - Always takes FIRST 4 students from full list                 │
│ - Does NOT use evaluation.assignedStudents                     │
│ - Result: Same 4 students shown in all 3 versions              │
└─────────────────────────────────────────────────────────────────┘
```

---

## C) Exact Request/Response Contracts

### C.1 Request Body to `modify-evaluation` Edge Function

**File**: `supabase/functions/modify-evaluation/index.ts` (lines 224-235)

**Exact Shape**:
```typescript
{
  originalEvaluation?: string,              // Optional: existing evaluation HTML
  modification: string,                     // Required: modification instruction
  groupContext: {                           // Required: group and student data
    subject: string,                        // Subject name (e.g., "Historia")
    content: string[],                      // Content IDs (subtema IDs)
    competencies?: string[],                // Optional: competency IDs
    criteriosLogro?: string[],              // Optional: criteria IDs
    isInterdisciplinary?: boolean,          // Optional: multi-subject flag
    groupName: string,                      // Group name (e.g., "9no 1")
    students: Array<{                       // ⚠️ ALL students (not filtered by version)
      id: number,
      name: string,
      perfil: string,
      ajustes?: string,
      contemplaciones: string[],
      informeTecnico?: {
        modalidadCursado: string
      }
    }>
  },
  type: 'modification' | 'chat' | 'html_plan' | 'planning',  // Required
  adaptationLevel: 'standard' | 'moderate' | 'high',          // Required
  prompt?: string                                             // Optional: custom prompt
}
```

**Key Fields**:
- **Group Profile**: NOT explicitly sent. Derived from `groupContext.students` in edge function (lines 340-374)
- **Student List**: `groupContext.students` - ALL students from selected group
- **Per-Student Adjustments**: Included in `students[]` array (each student has `contemplaciones`, `ajustes`, `informeTecnico`)
- **Content Adaptation Flags**: `adaptationLevel` field indicates version type

**Files**:
- Request construction: `src/pages/EvaluacionesGrupo.tsx` (lines 729-771)
- Edge function extraction: `supabase/functions/modify-evaluation/index.ts` (lines 224-235)

---

### C.2 Response Body from Edge Function

**File**: `supabase/functions/modify-evaluation/index.ts` (lines 716-726)

**Exact Shape**:
```typescript
{
  success: boolean,
  content: string,              // HTML evaluation content
  type: string,                 // Request type
  metadata?: {
    tokensUsed: number,
    model: string
  },
  warning?: string              // Optional: warnings (e.g., token limit)
}
```

**Note**: Response does NOT include student assignments. Only evaluation HTML content.

---

### C.3 Frontend Evaluation Object

**File**: `src/pages/EvaluacionesGrupo.tsx` (lines 40-53)

**Exact Shape**:
```typescript
interface GeneratedEvaluation {
  id: string,                   // "1", "2", or "3"
  version: number,              // 1, 2, or 3
  title: string,                // "Versión Estándar", etc.
  content: string,               // HTML from LLM
  adaptations: string[],         // Adaptation descriptions
  assignedStudents: string[],   // ✅ Student names for this version
  rubrica?: any[],
  feedback?: {
    liked: string[],
    disliked: string[],
    suggestions: string[]
  }
}
```

**Key**: `assignedStudents` is calculated in frontend (`getVersionData()`) but NOT used in rendering.

---

## D) Findings About "Same 4 Students" Issue

### D.1 Root Cause

**Status**: ✅ **CONFIRMED** - Same input array used for all versions

**Location**: `src/components/evaluaciones/SimplifiedSmartRubric.tsx` (lines 117-133)

**Code**:
```typescript
const generateStudentAssignments = (): StudentAssignment[] => {
  if (!students || students.length === 0) {
    // Uses mockStudents.slice(0, 4) - always first 4
    const selectedStudents = mockStudents.slice(0, Math.min(4, mockStudents.length));
    return selectedStudents.map(student => ({ ... }));
  }

  // ⚠️ BUG: Always takes first 4 students, regardless of version
  const selectedStudents = students.slice(0, Math.min(4, students.length));
  return selectedStudents.map(student => ({ ... }));
};
```

**Problem**:
1. `SimplifiedSmartRubric` receives `students` prop (ALL students, line 1579 in `EvaluacionesGrupo.tsx`)
2. Component does NOT receive `evaluation.assignedStudents` (calculated per version)
3. Component always uses `students.slice(0, 4)` - first 4 students from full list
4. All 3 versions render the same component with same `students` prop
5. Result: Same 4 students shown in all versions

---

### D.2 Evidence

**File**: `src/pages/EvaluacionesGrupo.tsx`

1. **Student Classification Works** (lines 594-644):
   - `getVersionData()` correctly classifies students by contemplaciones
   - Returns different arrays: `v1`, `v2`, `v3`
   - Each array has different student names

2. **assignedStudents Set Correctly** (lines 747, 754, 761):
   ```typescript
   assignedStudents: versionStudentData?.v1.map(s => s.nombre) || []  // v1
   assignedStudents: versionStudentData?.v2.map(s => s.nombre) || []  // v2
   assignedStudents: versionStudentData?.v3.map(s => s.nombre) || []  // v3
   ```

3. **assignedStudents NOT Passed to Renderer** (lines 1566-1593):
   ```typescript
   <EvaluacionVisualRenderer
     evaluation={evaluation}  // ✅ Contains assignedStudents
     students={selectedGroup?.students}  // ⚠️ ALL students (not filtered)
     // ❌ evaluation.assignedStudents NOT passed
   />
   ```

4. **Renderer Doesn't Use assignedStudents** (`EvaluacionVisualRenderer.tsx`):
   - Receives `evaluation` prop but doesn't extract `assignedStudents`
   - Passes `students` prop to `SimplifiedSmartRubric` (line 114)
   - `SimplifiedSmartRubric` ignores `evaluation.assignedStudents`

---

### D.3 Why Edge Function Doesn't Help

**File**: `supabase/functions/modify-evaluation/index.ts`

1. **Edge Function Receives ALL Students** (line 737 in `EvaluacionesGrupo.tsx`):
   ```typescript
   students: selectedGroup.students  // All students, not filtered
   ```

2. **Edge Function Filters to 5 Max** (lines 346-354):
   ```typescript
   groupContext.students
     .filter((s: any) => s.contemplaciones?.length || s.ajustes)
     .slice(0, 5)  // First 5 with adjustments
   ```
   - Same 5 students sent to all 3 versions
   - No version-specific filtering

3. **LLM Doesn't Know Version Assignments**:
   - Prompt includes students but no explicit "these students use version 1" instruction
   - LLM generates content but doesn't assign students to versions
   - Student assignment is frontend-only logic

---

### D.4 Most Likely Root Cause

**Primary Issue**: `SimplifiedSmartRubric` component uses hardcoded logic (`students.slice(0, 4)`) instead of using `evaluation.assignedStudents` that was calculated per version.

**Secondary Issue**: `evaluation.assignedStudents` exists in the evaluation object but is never passed to or used by the renderer components.

**Evidence**:
- ✅ `assignedStudents` calculated correctly per version (lines 747, 754, 761)
- ✅ `assignedStudents` stored in evaluation object (line 786, 796)
- ❌ `assignedStudents` NOT passed to `EvaluacionVisualRenderer`
- ❌ `SimplifiedSmartRubric` doesn't receive or use `assignedStudents`
- ❌ Component always uses `students.slice(0, 4)` - same for all versions

---

## E) Open Questions

### E.1 Student Data Storage

**Question**: Will students be moved to Supabase database in the future?

**Status**: Unknown

**Evidence Checked**:
- `supabase/migrations/` - No students table exists
- `src/utils/groupContext.ts` - Uses mockGroups fallback
- Documentation mentions "future-proof" design (line 138 in `groupContext.ts`)

**Files Checked**: All migrations, `groupContext.ts`, `mockData.ts`

---

### E.2 Version-Specific Student Assignment in LLM

**Question**: Should the LLM be responsible for assigning students to versions?

**Status**: Unknown (design decision)

**Current Behavior**: 
- Frontend classifies students (by contemplaciones count)
- Edge function receives ALL students
- LLM doesn't receive version-specific student lists
- LLM doesn't know which students belong to which version

**Files Checked**: `modify-evaluation/index.ts` (prompt construction), `EvaluacionesGrupo.tsx` (request building)

---

### E.3 assignedStudents Usage

**Question**: Is `assignedStudents` field used anywhere else in the codebase?

**Status**: Partially checked

**Found**:
- `src/pages/EvaluacionDetalle.tsx` (line 32) - Interface includes `assignedStudents?`
- `src/components/evaluaciones/VersionPersonalization.tsx` - Uses different logic
- `src/components/evaluaciones/EnhancedVersionPersonalization.tsx` - Uses different logic

**Files Checked**: 
- `grep -r "assignedStudents" src/` (33 matches)
- Most are in `EvaluacionesGrupo.tsx` (setting the field)
- Not used in rendering logic

---

## Summary

### Data Storage
- ✅ Group profiles: Supabase `grupos` table (`teacher_sugerencias` JSONB)
- ❌ Student profiles: Frontend only (`src/data/mockData.ts`)

### Data Flow
- Frontend classifies students per version (`getVersionData()`)
- Edge function receives ALL students (not filtered)
- LLM doesn't receive version-specific student assignments
- Frontend stores `assignedStudents` per version but doesn't use it in rendering

### Bug Root Cause
- `SimplifiedSmartRubric` always uses `students.slice(0, 4)` - first 4 students
- `evaluation.assignedStudents` exists but is never passed to or used by renderer
- All 3 versions show same 4 students because they all use same logic

### Files Modified
**None** - This is an inspection-only document.

**Files Read**:
- `src/pages/EvaluacionesGrupo.tsx`
- `src/utils/groupContext.ts`
- `src/data/mockData.ts`
- `supabase/functions/modify-evaluation/index.ts`
- `src/components/evaluaciones/SimplifiedSmartRubric.tsx`
- `src/components/evaluaciones/EvaluacionVisualRenderer.tsx`
- `supabase/migrations/20251226174831_add_grupos_table_teacher_sugerencias.sql`






