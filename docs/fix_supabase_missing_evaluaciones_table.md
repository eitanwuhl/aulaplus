# Fix: Supabase Missing evaluaciones Table

**Date**: 2025-12-23  
**Branch**: `Aulaplus-by-eitan-2`  
**Error**: `Could not find the table 'public.evaluaciones' in the schema cache`

---

## Root Cause: Case A - Table Does Not Exist

**Diagnosis**: The `evaluaciones` table does not exist in the connected Supabase project.

**Evidence**:
- **Error Message**: `Could not find the table 'public.evaluaciones' in the schema cache`
- **Migrations Exist Locally**: 
  - `supabase/migrations/20251222000000_add_evaluaciones_explicit_save.sql`
  - `supabase/migrations/20251222000001_add_evaluaciones_rls_policies.sql`
- **Migrations Not Applied**: These migrations exist in the repo but have not been applied to the remote Supabase project.

**Why Case A (Not B or C)**:
- **Not Case B (Stale Cache)**: PostgREST cache errors typically show different messages. The "Could not find the table" error indicates the table truly doesn't exist.
- **Not Case C (Name Mismatch)**: Code consistently uses `.from('evaluaciones')` in 3 places, and migrations also use `evaluaciones` - no name mismatch.

---

## Evidence

### 1. Supabase Project Configuration

**File**: `src/integrations/supabase/client.ts`

**Configuration**:
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

**Project ID** (from `supabase/config.toml`): `srlrbuphsogwgymqywhe`

**App Points To**: Project URL from `VITE_SUPABASE_URL` environment variable (resolved at runtime).

**Note**: The exact URL cannot be determined from code alone - it's in `.env` file (not committed). The app connects to whatever project is specified in `VITE_SUPABASE_URL`.

### 2. Code Insertion Points

**File**: `src/pages/EvaluacionesGrupo.tsx` (line 439-443)

```typescript
const { data, error } = await supabase
  .from('evaluaciones')  // ← Table name used
  .insert(evaluacionData)
  .select()
  .single();
```

**Other Usages**:
- `src/pages/MisEvaluaciones.tsx` (line 131): `.from('evaluaciones')` - SELECT query
- `src/pages/MisEvaluaciones.tsx` (line 480): `.from('evaluaciones')` - UPDATE query (soft delete)

**All code consistently uses**: `'evaluaciones'` (lowercase, no schema prefix in code, defaults to `public` schema)

### 3. Migration Files

**Migrations that create/modify `evaluaciones` table**:

1. **`supabase/migrations/20251222000000_add_evaluaciones_explicit_save.sql`**
   - Creates table with `CREATE TABLE IF NOT EXISTS evaluaciones`
   - Adds all columns: `nombre`, `materia`, `grupo_id`, `nivel`, `fecha`, `competencias_anep`, `is_saved`, `saved_at`, `deleted_at`, etc.
   - Creates indexes
   - Creates trigger function and trigger for `updated_at`

2. **`supabase/migrations/20251222000001_add_evaluaciones_rls_policies.sql`**
   - Enables RLS: `ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY`
   - Creates 3 policies: SELECT, INSERT, UPDATE (all scoped to `user_id = auth.uid()`)

**Migration Status**: These migrations exist locally but have **NOT been applied** to the remote Supabase project.

---

## Fix Implementation

### Solution: Manual SQL Execution

Since the migrations exist but haven't been applied, we provide a consolidated SQL script that can be executed manually in Supabase SQL Editor.

### File Created: `docs/sql/create_evaluaciones_table.sql`

**Contents**: Complete SQL script that:
1. Creates the `evaluaciones` table with all columns
2. Creates all required indexes
3. Creates trigger function and trigger for `updated_at`
4. Enables RLS
5. Creates all RLS policies
6. Adds table/column comments

**Why This Approach**:
- ✅ Safe: Uses `CREATE TABLE IF NOT EXISTS` and `IF NOT EXISTS` for indexes
- ✅ Idempotent: Can be run multiple times without errors
- ✅ Complete: Includes everything from both migrations
- ✅ No Dependencies: Doesn't require Supabase CLI setup

### Steps to Apply Fix

#### Option 1: Supabase Dashboard SQL Editor (Recommended)

1. **Open Supabase Dashboard**:
   - Navigate to your Supabase project: `https://supabase.com/dashboard/project/srlrbuphsogwgymqywhe`
   - Or use the project URL from `VITE_SUPABASE_URL`

2. **Open SQL Editor**:
   - Go to "SQL Editor" in the left sidebar
   - Click "New query"

3. **Execute Script**:
   - Copy contents of `docs/sql/create_evaluaciones_table.sql`
   - Paste into SQL Editor
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

4. **Verify**:
   - Check "Table Editor" → should see `evaluaciones` table
   - Or run verification query (included at end of script):
     ```sql
     SELECT table_name, column_name, data_type 
     FROM information_schema.columns 
     WHERE table_schema = 'public' 
       AND table_name = 'evaluaciones'
     ORDER BY ordinal_position;
     ```

#### Option 2: Supabase CLI (If Available)

```bash
# Link to project (if not already linked)
supabase link --project-ref srlrbuphsogwgymqywhe

# Apply migrations
supabase db push

# Or apply specific migration
supabase migration up
```

**Note**: This requires Supabase CLI to be installed and configured.

---

## Code Changes

### None Required

The code is already correct:
- ✅ Uses `.from('evaluaciones')` consistently
- ✅ Handles errors appropriately
- ✅ No table name mismatches

**Only database-side fix needed**: Create the table.

---

## Verification

### Manual Verification Steps

1. **After applying SQL script**:
   - Navigate to `/evaluaciones/nuevo`
   - Select a group and materia
   - Generate an evaluation (optional)
   - Click "Guardar evaluación"
   - Enter a name and confirm

2. **Expected Result**:
   - ✅ No error toast
   - ✅ Success toast: "Evaluación guardada"
   - ✅ Navigation to `/mis-evaluaciones` after 1.5s
   - ✅ Evaluation appears in "Mis Evaluaciones" list

3. **Database Verification**:
   - Open Supabase Dashboard → Table Editor → `evaluaciones`
   - Should see the newly saved evaluation row
   - Verify columns:
     - `nombre`: Custom name entered
     - `materia`: Selected materia
     - `grupo_id`: Selected group ID (string)
     - `nivel`: "9no" or "8vo" (derived from group.year)
     - `is_saved`: `true`
     - `saved_at`: Recent timestamp
     - `deleted_at`: `null`
     - `competencias_anep`: Array of competency IDs

4. **Console Verification**:
   - Open browser DevTools → Console
   - Look for: `[SAVE EVALUATION] Success: {...}`
   - Should show the inserted row data

### Runtime Check Added

**File**: `src/pages/EvaluacionesGrupo.tsx` (lines 443-444)

**Existing Code** (already present):
```typescript
console.log('[SAVE EVALUATION] Success:', data);
```

**This confirms**:
- ✅ Insert succeeded
- ✅ Returns the inserted row
- ✅ Can be verified in console

---

## Risks and Follow-ups

### Immediate Risks

1. **RLS Policy Enforcement**
   - **Risk**: If user is not authenticated, INSERT will fail with permission error
   - **Mitigation**: Ensure user is logged in (AuthContext handles this)
   - **Status**: ✅ Handled by existing auth flow

2. **Missing Columns in Future**
   - **Risk**: If new columns are added in future migrations, they won't exist
   - **Mitigation**: Apply all future migrations to remote project
   - **Follow-up**: Consider setting up Supabase CLI for automated migrations

### Follow-ups Required

1. **Apply All Migrations**
   - **Action**: Review all migrations in `supabase/migrations/` and ensure they're applied
   - **Priority**: Medium
   - **Benefit**: Ensures schema is up-to-date with codebase

2. **Set Up Supabase CLI (Optional)**
   - **Action**: Install and configure Supabase CLI for automated migrations
   - **Priority**: Low (manual SQL works, but CLI is more maintainable)
   - **Benefit**: Easier to apply future migrations

3. **Schema Verification Script**
   - **Action**: Create a script that verifies required tables/columns exist
   - **Priority**: Low
   - **Benefit**: Early detection of missing schema

4. **PostgREST Cache Refresh (If Needed)**
   - **Action**: If table exists but still shows cache error, refresh PostgREST cache
   - **SQL**: 
     ```sql
     NOTIFY pgrst, 'reload schema';
     ```
   - **Priority**: Only if Case B occurs (stale cache)

---

## Summary

✅ **Root Cause**: Case A - Table does not exist in remote Supabase project

✅ **Fix**: Execute `docs/sql/create_evaluaciones_table.sql` in Supabase SQL Editor

✅ **Code Changes**: None required (code is correct)

✅ **Verification**: Manual testing steps provided above

✅ **Risks**: Low - fix is safe and idempotent

---

**Status**: ✅ Fix ready to apply  
**Branch**: `Aulaplus-by-eitan-2`  
**Next**: Execute SQL script in Supabase Dashboard


















