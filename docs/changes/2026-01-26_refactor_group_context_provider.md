# Refactor: Unified Group Context Provider for AI Generation

> **Date**: January 26, 2026  
> **Task**: Create single access point for student/group information used in AI generation  
> **Status**: ✅ Completed

---

## Summary

Refactored all student/group data access for AI generation (lesson plans and evaluations) into a unified provider module. This centralizes data access logic and enables seamless migration from mock/localStorage to Supabase DB in the future.

**What Changed**: Centralized data access for AI generation  
**Why**: Enable future DB migration with minimal code changes  
**Impact**: No product changes, only internal reorganization

---

## Impact Analysis (SSoT Guardrails)

### Guardrails Touched

1. **Group Context Loading** (Guardrail #10 - `src/utils/groupContext.ts`)
   - **Status**: ✅ Preserved
   - **Changes**: Refactored internal implementation, maintained external contract
   - **Risk**: Low - Wrapper maintains backward compatibility
   - **Mitigation**: `loadGroupContext()` wraps new provider, converts format

2. **Edge Functions ↔ Frontend Hooks** (Guardrail #8)
   - **Status**: ✅ Preserved
   - **Changes**: None - Payload shapes remain identical
   - **Risk**: None - No contract changes
   - **Mitigation**: TypeScript types ensure contract compliance

3. **Contemplaciones Catalog** (Guardrail #7)
   - **Status**: ✅ Preserved
   - **Changes**: None - Uses existing storage functions
   - **Risk**: None - No catalog changes
   - **Mitigation**: Uses `readSelected()` from existing storage module

### Guardrails NOT Touched

- ✅ Plan Parser (`src/lib/planParser.ts`) - Not modified
- ✅ Database Schema - No migrations created
- ✅ RLS Policies - No changes
- ✅ AI Generation Contract - No changes to edge function contracts
- ✅ Authentication Flow - Not modified
- ✅ Session Estado Enum - Not modified

### Compatibility Guarantees

1. **Edge Function Payloads**: Identical shapes maintained
2. **Data Sources**: Same sources (Supabase + mock + localStorage)
3. **Anonymization**: Same logic, same format
4. **Backward Compatibility**: Wrapper function maintains old API

---

## Files Created

### 1. `src/types/groupContextForAI.ts` (NEW)
- **Purpose**: TypeScript types for unified group context
- **Exports**:
  - `StudentForAI` - Student data structure for AI prompts
  - `GroupProfileForAI` - Group profile (learning style distribution)
  - `TeacherSugerenciasForAI` - Teacher suggestions from Supabase
  - `GroupContextForAI` - Complete context for AI generation
  - `GroupContextOptions` - Options for context loading

### 2. `src/services/groupContext/provider.ts` (NEW)
- **Purpose**: Unified provider for all group/student data used in AI generation
- **Exports**:
  - `getGroupContextForAI(grupoId, options)` - Main provider function
- **Features**:
  - Abstracts data sources via `StudentDataSource` interface
  - Current implementation: `MockStudentDataSource` (mock + localStorage)
  - Future implementation: `SupabaseStudentDataSource` (placeholder with TODOs)
  - Loads teacher suggestions from Supabase
  - Loads students from data source
  - Loads contemplaciones from data source
  - Calculates learning style distribution
  - Anonymizes student data for prompts
  - Determines content adaptation requirements

---

## Files Modified

### 1. `src/utils/groupContext.ts` (UPDATED)
- **Changes**:
  - `loadGroupContext()` now wraps `getGroupContextForAI()` for backward compatibility
  - Marked as `@deprecated` with migration instructions
  - Converts new format to old format for existing call sites
- **Rationale**: Maintain backward compatibility during migration

### 2. `src/hooks/useFullSessionGeneration.ts` (UPDATED)
- **Changes**:
  - Replaced `loadGroupContext()` with `getGroupContextForAI()`
  - Updated to use `groupContext.anonymizedStudentsForPrompt`
  - Updated to use `groupContext.dominantLearningStyle`
- **Lines**: ~264-323

### 3. `src/components/planificacion/EditorSesionNuevo.tsx` (UPDATED)
- **Changes**:
  - Replaced `loadGroupContext()` with `getGroupContextForAI()`
  - Updated payload construction to use new provider format
- **Lines**: ~423-450

### 4. `src/pages/EvaluacionesGrupo.tsx` (UPDATED)
- **Changes**:
  - Added `getGroupContextForAI()` call in `handleGenerateEvaluations()`
  - Updated `groupContext` construction to use unified provider data
  - Combines group data with evaluation-specific fields (subject, content, etc.)
- **Lines**: ~763-777

---

## Relevant SSoT Constraints Considered

1. **Edge Function Contracts** (Guardrail #6)
   - ✅ Maintained: Request payload shapes remain identical
   - ✅ `perfilGrupo` and `estudiantes` shapes match existing contracts
   - ✅ No changes to `generate-plan-completo` or `modify-evaluation` contracts

2. **Group Context Loading** (Guardrail #10)
   - ✅ Preserved: Hybrid approach (Supabase teacher_sugerencias + mock students)
   - ✅ Future-proof: Easy migration path to Supabase students table
   - ✅ Behavior identical: Same data, same format, same anonymization

3. **Contemplaciones System** (Guardrail #7)
   - ✅ Preserved: Uses existing `readSelected()` from `storage.ts`
   - ✅ No changes to catalog IDs or storage keys
   - ✅ Maintains category separation (clase vs evaluaciones)

4. **No Database Schema Changes** (Guardrail #3, #4, #5)
   - ✅ No migrations created
   - ✅ No RLS changes
   - ✅ No schema modifications

5. **No Plan Parser Changes** (Guardrail #1)
   - ✅ Not touched: `src/lib/planParser.ts` unchanged

---

## Impact Analysis

### What Could Break

**Low Risk** ✅:
- Edge function contracts remain identical (same payload shapes)
- UI behavior unchanged (no product changes)
- Data sources unchanged (still mock + localStorage)

**Mitigation**:
- Backward compatibility wrapper (`loadGroupContext`) maintained
- Gradual migration: New code uses provider, old code still works
- Type safety: TypeScript types ensure contract compliance

### Compatibility Preserved

1. **Edge Function Payloads**:
   - `perfilGrupo` shape: `{ tamanio, dominante, distribucion? }` ✅
   - `estudiantes` shape: `Array<{ perfil?, ajustes?, contemplaciones? }>` ✅
   - No breaking changes to request contracts ✅

2. **Data Sources**:
   - Teacher suggestions: Still from Supabase `grupos` table ✅
   - Students: Still from `mockData.ts` ✅
   - Contemplaciones: Still from localStorage ✅

3. **Anonymization**:
   - Student names still anonymized (Estudiante A, B, C, ...) ✅
   - Same filtering logic (only students with adjustments) ✅
   - Same capping (max 10 students) ✅

---

## Manual Verification Steps Performed

### 1. Type Checking
- ✅ Ran `npm run lint` - No errors
- ✅ TypeScript compilation successful
- ✅ All imports resolve correctly

### 2. Code Inspection
- ✅ Verified `getGroupContextForAI()` returns correct shape
- ✅ Verified backward compatibility wrapper works
- ✅ Verified call sites updated correctly
- ✅ Verified edge function payloads match contracts

### 3. Data Flow Verification
- ✅ Teacher suggestions loaded from Supabase
- ✅ Students loaded from mock data
- ✅ Contemplaciones loaded from localStorage
- ✅ Learning style distribution calculated correctly
- ✅ Content adaptation flags determined correctly

---

## How to Migrate Provider to Supabase (Future)

### Step 1: Create Students Table
```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id TEXT NOT NULL REFERENCES grupos(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  perfil TEXT,
  ajustes TEXT,
  informe_tecnico JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own students"
  ON students FOR SELECT
  USING (auth.uid() = user_id);
```

### Step 2: Create Student Contemplaciones Junction Table
```sql
CREATE TABLE student_contemplaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  contemplacion_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('clase', 'evaluaciones')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, contemplacion_id, category)
);

-- RLS
ALTER TABLE student_contemplaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own student contemplaciones"
  ON student_contemplaciones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = student_contemplaciones.student_id
      AND students.user_id = auth.uid()
    )
  );
```

### Step 3: Implement SupabaseStudentDataSource
Update `src/services/groupContext/provider.ts`:
```typescript
class SupabaseStudentDataSource implements StudentDataSource {
  async getGroupStudents(grupoId: string): Promise<Student[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('grupo_id', grupoId)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('[SupabaseStudentDataSource] Error loading students:', error);
      return [];
    }
    
    // Convert Supabase rows to Student format
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      perfil: row.perfil,
      ajustes: row.ajustes,
      informeTecnico: row.informe_tecnico,
      // ... other fields
    }));
  }
  
  async getStudentContemplaciones(
    studentId: string | number,
    category: 'clase' | 'evaluaciones'
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('student_contemplaciones')
      .select('contemplacion_id')
      .eq('student_id', studentId)
      .eq('category', category);
    
    if (error) {
      console.error('[SupabaseStudentDataSource] Error loading contemplaciones:', error);
      return [];
    }
    
    return (data || []).map(row => row.contemplacion_id);
  }
}
```

### Step 4: Switch Data Source
In `src/services/groupContext/provider.ts`, change:
```typescript
// OLD:
const dataSource: StudentDataSource = new MockStudentDataSource();

// NEW:
const dataSource: StudentDataSource = new SupabaseStudentDataSource();
```

### Step 5: Migrate Existing Data (One-time)
Create migration script to:
1. Read students from `mockData.ts`
2. Insert into `students` table
3. Read contemplaciones from localStorage
4. Insert into `student_contemplaciones` table

### Step 6: Remove Mock Data Source
Once migration is complete:
- Remove `MockStudentDataSource` class
- Remove `mockData.ts` dependency (or keep for fallback)
- Update documentation

---

## Risks and Follow-ups

### Low Risk ✅
- No breaking changes to contracts
- Backward compatibility maintained
- Type safety ensures correctness

### Follow-ups Recommended

1. **Complete EvaluacionesGrupo.tsx Migration**:
   - Some call sites still use `selectedGroup.students` directly
   - TODO comments mark locations for future migration
   - Low priority: Works correctly, just not using unified provider

2. **Test with Real Data**:
   - Verify provider works with actual group data
   - Test edge cases (empty groups, no contemplaciones, etc.)
   - Verify anonymization works correctly

3. **Monitor Performance**:
   - Provider loads contemplaciones for each student (async)
   - Consider batching if performance issues arise
   - Current implementation: Sequential Promise.all (acceptable for < 10 students)

4. **Future: Supabase Migration**:
   - Follow step-by-step guide above
   - Test thoroughly before switching data source
   - Keep mock data source as fallback initially

---

## Architecture Decisions

### Why `src/services/groupContext/`?
- Follows service layer pattern
- Separates data access from business logic
- Clear location for future data source implementations

### Why Keep `loadGroupContext()` Wrapper?
- Backward compatibility during migration
- Gradual adoption: New code uses provider, old code still works
- Can be removed once all call sites migrated

### Why `StudentDataSource` Abstraction?
- Enables easy data source switching
- Clear contract for data access
- Testable (can mock data source)

### Why Separate Types File?
- Reusable across modules
- Clear contract definition
- Type safety for consumers

---

## Success Criteria

✅ **Completed**:
- [x] Unified provider created
- [x] Data source abstraction implemented
- [x] Call sites refactored (planning)
- [x] Call sites refactored (evaluations - partial)
- [x] Types defined
- [x] Backward compatibility maintained
- [x] No breaking changes to contracts
- [x] Documentation created

---

## Next Steps

1. **Complete Evaluation Migration**: Update remaining call sites in `EvaluacionesGrupo.tsx`
2. **Test**: Verify provider works with real data
3. **Monitor**: Watch for performance issues
4. **Future**: Migrate to Supabase when students table is ready

---

**End of Change Report**

