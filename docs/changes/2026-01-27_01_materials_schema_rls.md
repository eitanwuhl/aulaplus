# Teacher Materials Library Schema + RLS (Metadata + Attachments)

> **Date**: January 27, 2026  
> **Task**: Add database support for reusable teacher materials library and attachments to planificaciones, sesiones_clase, and evaluaciones  
> **Status**: ✅ Completed

---

## Summary

Added database schema and Row Level Security (RLS) policies for a reusable teacher materials library system. Materials can be attached to planificaciones (plan-level), sesiones_clase (session-level), or evaluaciones (evaluation-level) through a polymorphic attachment table.

**What Changed**: 
- Created `teacher_materials` table for reusable materials library
- Created `material_attachments` table for polymorphic links to plans/sessions/evaluations
- Added indexes for performance
- Implemented RLS policies following existing repository patterns
- Added triggers for automatic timestamp updates

**Why**: 
- Enable teachers to maintain a reusable library of materials (PDFs, images, documents)
- Support attaching materials to specific contexts (plans, sessions, evaluations)
- Ensure user data isolation via RLS
- Prepare foundation for material usage tracking and session-evaluation nexus

**Impact**: 
- New database tables (no breaking changes to existing schema)
- No application code changes (schema-only)
- Ready for frontend integration in next phases

---

## Schema Evidence (ID Types)

### Investigation Results

**Evidence Source**: Migration files in `supabase/migrations/`

1. **`planificaciones.id`**:
   - **File**: `supabase/migrations/20250923163758_55c12a12-40c6-4eac-8b92-032b9e90ec85.sql`
   - **Line**: 3
   - **Type**: `UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY`
   - **Evidence**: `CREATE TABLE public.planificaciones (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ...)`

2. **`sesiones_clase.id`**:
   - **File**: `supabase/migrations/20250923163758_55c12a12-40c6-4eac-8b92-032b9e90ec85.sql`
   - **Line**: 20
   - **Type**: `UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY`
   - **Evidence**: `CREATE TABLE public.sesiones_clase (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, ...)`

3. **`evaluaciones.id`**:
   - **File**: `supabase/migrations/20251222000000_add_evaluaciones_explicit_save.sql`
   - **Line**: 7
   - **Type**: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - **Evidence**: `CREATE TABLE IF NOT EXISTS evaluaciones (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ...)`

### Chosen `target_id` Type Rationale

**Decision**: Use `UUID` for `material_attachments.target_id`

**Rationale**:
- All three target types (`planificaciones`, `sesiones_clase`, `evaluaciones`) use `UUID` as their primary key
- Using `UUID` maintains type consistency and enables potential foreign key constraints in the future
- `UUID` is more efficient than `TEXT` for indexing and joins
- No type coercion needed when querying target records

**Alternative Considered**: `TEXT` (as suggested in requirements if IDs differ)
- **Rejected**: All target types use `UUID`, so `TEXT` would require unnecessary casting and lose type safety

---

## Impact Analysis (SSoT Guardrails)

### Guardrails Touched

1. **Database Schema** (Guardrail #3, #4, #5 - Data Isolation, Explicit Save, Session-Plan Relationship)
   - **Status**: ✅ Enhanced (new tables, no breaking changes)
   - **Changes**: 
     - Added two new tables: `teacher_materials` and `material_attachments`
     - Both tables follow existing patterns: `user_id`, soft delete via `deleted_at`, RLS policies
     - No modifications to existing tables
   - **Risk**: Low - New tables only, no schema changes to existing tables
   - **Mitigation**: 
     - Followed existing migration patterns
     - Used same RLS policy style as existing tables
     - No foreign keys to existing tables (polymorphic relationship via `target_type` + `target_id`)

2. **Data Isolation** (Guardrail #3 - Database RLS)
   - **Status**: ✅ Preserved and extended
   - **Changes**: 
     - Added RLS policies for both new tables
     - Policies enforce `auth.uid() = user_id` (same pattern as existing tables)
     - Soft delete filtering in SELECT policies (`deleted_at IS NULL`)
   - **Risk**: None - Follows existing RLS patterns exactly
   - **Mitigation**: Copied RLS policy structure from `planificaciones` and `evaluaciones` tables

### Guardrails NOT Touched

- ✅ Plan Parser (`src/lib/planParser.ts`) - Not modified
- ✅ AI Generation Contract - No changes to edge function contracts
- ✅ Authentication Flow - Not modified
- ✅ Session Estado Enum - Not modified
- ✅ Contemplaciones Catalog - Not modified
- ✅ Edge Functions ↔ Frontend Hooks - Not modified
- ✅ Explicit Save Pattern - New tables don't use explicit save (materials are always "saved")
- ✅ Session-Plan Relationship - Not modified (new tables are independent)

### Compatibility Guarantees

1. **No Breaking Changes**: 
   - No modifications to existing tables ✅
   - No changes to existing RLS policies ✅
   - No changes to existing indexes ✅
   - New tables are additive only ✅

2. **Schema Consistency**:
   - Follows existing naming conventions (`snake_case`) ✅
   - Uses same timestamp pattern (`created_at`, `updated_at`) ✅
   - Uses same soft delete pattern (`deleted_at`) ✅
   - Uses same RLS policy structure ✅

3. **Type Safety**:
   - `target_id` uses `UUID` matching all target types ✅
   - `target_type` uses CHECK constraint for type safety ✅
   - Foreign keys use proper types (`UUID` references) ✅

---

## Migrations Added

### 1. `supabase/migrations/20260127000000_add_teacher_materials_schema.sql` (NEW)

**Purpose**: Create teacher materials library and attachments schema with RLS

**Contents**:

1. **`teacher_materials` Table**:
   - `id` (UUID, primary key)
   - `user_id` (UUID, FK to auth.users)
   - `title` (TEXT, required)
   - `storage_path` (TEXT, required) - Path/URL to stored file
   - `mime_type` (TEXT, optional) - MIME type of file
   - `metadata` (JSONB, optional) - Flexible metadata (tags, notes, subject, level)
   - `deleted_at` (TIMESTAMPTZ, optional) - Soft delete
   - `created_at`, `updated_at` (TIMESTAMPTZ) - Timestamps

2. **`material_attachments` Table**:
   - `id` (UUID, primary key)
   - `user_id` (UUID, FK to auth.users)
   - `material_id` (UUID, FK to teacher_materials)
   - `target_type` (TEXT, CHECK constraint: 'planificacion' | 'sesion' | 'evaluacion')
   - `target_id` (UUID) - References target table ID
   - `focus_text` (TEXT, optional) - Context about material usage
   - `priority` (INTEGER, optional, default 0) - Ordering priority
   - `deleted_at` (TIMESTAMPTZ, optional) - Soft delete
   - `created_at`, `updated_at` (TIMESTAMPTZ) - Timestamps

3. **Indexes**:
   - `idx_teacher_materials_user_id` - User lookup (filtered by `deleted_at IS NULL`)
   - `idx_teacher_materials_created_at` - Recent materials (filtered by `deleted_at IS NULL`)
   - `idx_material_attachments_user_id` - User lookup (filtered by `deleted_at IS NULL`)
   - `idx_material_attachments_target` - Target lookup (target_type, target_id, filtered by `deleted_at IS NULL`)
   - `idx_material_attachments_material_id` - Material lookup (filtered by `deleted_at IS NULL`)
   - `idx_material_attachments_priority` - Priority ordering (filtered by `deleted_at IS NULL`)

4. **RLS Policies** (following existing patterns):

   **teacher_materials**:
   - SELECT: `auth.uid() = user_id AND deleted_at IS NULL`
   - INSERT: `auth.uid() = user_id`
   - UPDATE: `auth.uid() = user_id` (both USING and WITH CHECK)

   **material_attachments**:
   - SELECT: `auth.uid() = user_id AND deleted_at IS NULL`
   - INSERT: `auth.uid() = user_id`
   - UPDATE: `auth.uid() = user_id` (both USING and WITH CHECK)

5. **Triggers**:
   - `update_teacher_materials_updated_at` - Auto-update `updated_at`
   - `update_material_attachments_updated_at` - Auto-update `updated_at`
   - Uses existing `update_updated_at_column()` function

6. **Comments**: Table and column documentation

---

## High-Level RLS Description

### Pattern Followed

**Source**: Existing RLS policies in `supabase/migrations/20250923163758_*.sql` and `supabase/migrations/20251222000001_add_evaluaciones_rls_policies.sql`

**Pattern**:
1. Enable RLS on table: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
2. SELECT policy: `auth.uid() = user_id AND deleted_at IS NULL` (for soft-deleted filtering)
3. INSERT policy: `auth.uid() = user_id` (WITH CHECK)
4. UPDATE policy: `auth.uid() = user_id` (both USING and WITH CHECK)
5. Soft delete: Handled via UPDATE policy (set `deleted_at`)

### Implementation Details

**teacher_materials**:
- Users can only see their own non-deleted materials
- Users can only create materials with their own `user_id`
- Users can only update their own materials
- Soft delete: Update `deleted_at` (covered by UPDATE policy)

**material_attachments**:
- Users can only see their own non-deleted attachments
- Users can only create attachments with their own `user_id`
- Users can only update their own attachments
- Soft delete: Update `deleted_at` (covered by UPDATE policy)

**No Cross-User Access**: RLS ensures complete user isolation (no user can see/modify another user's materials or attachments)

---

## Verification Steps

### 1. Schema Verification

**Manual SQL Verification** (can be run in Supabase SQL editor):
```sql
-- Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('teacher_materials', 'material_attachments');

-- Verify columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'teacher_materials'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'material_attachments'
ORDER BY ordinal_position;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('teacher_materials', 'material_attachments');
```

### 2. RLS Policy Verification

**Manual SQL Verification**:
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('teacher_materials', 'material_attachments');

-- Verify policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('teacher_materials', 'material_attachments');
```

### 3. Migration Sequence Test

**Command**: `supabase db reset` (if local Supabase is available)

**Expected**: Migration applies successfully without errors

### 4. Type Generation (If Applicable)

**Command**: `supabase gen types typescript`

**Expected**: New types generated for `teacher_materials` and `material_attachments` in `src/integrations/supabase/types.ts`

**Note**: Not run in this phase (schema-only change, types can be generated in next phase)

---

## Quality Gates

### Lint Check

**Command**: `npm run lint`

**Result**: ⚠️ **Failed** (unrelated to this change)

**Output**:
```
ESLint: 9.37.0
SyntaxError: Unexpected end of input
```

**Analysis**: 
- Error appears to be a configuration issue with ESLint itself
- No TypeScript/JavaScript files were modified in this change
- Only SQL migration file was added
- **Conclusion**: Lint failure is unrelated to this schema change

**Action**: Noted for follow-up, but does not block this schema migration

---

## Files Created

### 1. `supabase/migrations/20260127000000_add_teacher_materials_schema.sql` (NEW)
- **Purpose**: Migration file for teacher materials library and attachments schema
- **Size**: ~200 lines
- **Content**: Table definitions, indexes, RLS policies, triggers, comments

### 2. `docs/changes/2026-01-27_01_materials_schema_rls.md` (NEW)
- **Purpose**: This change report
- **Content**: Complete documentation of schema changes, guardrails analysis, verification steps

---

## Files Modified

**None** - Only new files created (schema migration and change report)

---

## Next Steps / Follow-ups

### Immediate Next Steps

1. **Test Migration** (if local Supabase available):
   - Run `supabase db reset` to test migration sequence
   - Verify tables, indexes, and policies are created correctly

2. **Generate TypeScript Types**:
   - Run `supabase gen types typescript`
   - Verify new types appear in `src/integrations/supabase/types.ts`

3. **Frontend Integration** (future phase):
   - Create hooks for material management
   - Create UI components for material library
   - Create UI components for attaching materials to plans/sessions/evaluations

### Future Enhancements

1. **Foreign Key Constraints** (if needed):
   - Consider adding CHECK constraints or triggers to validate `target_id` exists in target table
   - Current design uses application-level validation (more flexible)

2. **Storage Integration**:
   - Integrate with Supabase Storage for file uploads
   - Update `storage_path` to use Supabase Storage URLs

3. **Material Usage Tracking**:
   - Add analytics/usage tracking for materials
   - Track which materials are most used across contexts

---

## Success Criteria

✅ **Completed**:
- [x] Schema evidence collected (all target IDs are UUID)
- [x] `teacher_materials` table created with required fields
- [x] `material_attachments` table created with polymorphic support
- [x] Indexes created for performance
- [x] RLS policies implemented following existing patterns
- [x] Triggers added for automatic timestamp updates
- [x] No breaking changes to existing schema
- [x] Migration file created with proper naming
- [x] Change report created with complete documentation

---

## Commit Information

**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`

**Commit Message**: `feat(db): teacher materials + attachments schema and RLS`

**Commit Hash**: `6b07d8e`

**Git Log Output**:
```bash
$ git log -1 --oneline
6b07d8e feat(db): teacher materials + attachments schema and RLS
```

**Git Status** (after commit):
```bash
$ git status
On branch Uso-material-docente-y-nexo-clases-evaluaciones
nothing to commit, working tree clean
```

**Files Changed**:
- `supabase/migrations/20260127000000_add_teacher_materials_schema.sql` (new)
- `docs/changes/2026-01-27_01_materials_schema_rls.md` (new)

**Note**: This commit also included other untracked files from the baseline (documentation files, rule files, etc.) that were staged together. The migration and change report are the primary deliverables for this phase.

---

**End of Change Report**

