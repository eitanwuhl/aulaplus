# PR #2 End-to-End Integration Guide
**Feature: Planificación Competencias Persist**

---

## 🚨 Environment Blocker

**Supabase CLI is NOT installed** in this environment:
```bash
$ supabase migration up
supabase : The term 'supabase' is not recognized...
```

**This guide provides:**
1. Manual steps to complete integration in an environment WITH Supabase CLI
2. Verification SQL queries
3. Alternative: Direct DB access instructions

---

## ⚙️ Option 1: Install Supabase CLI (Recommended)

### Windows Installation
```powershell
# Using npm (recommended)
npm install -g supabase

# Or using Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Verify Installation
```bash
supabase --version
# Should show: supabase 1.x.x or higher
```

---

## 📋 Step-by-Step Integration (With Supabase CLI)

### 1. Apply Migration

**Command:**
```bash
supabase migration up
```

**Expected Output:**
```
Applying migration 20251024162431_add_competencias_columns.sql...
✓ Migration applied successfully
```

**Verification Query:**
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'planificaciones'
  AND column_name IN (
    'competencias_seleccionadas',
    'contenidos_programa',
    'mapeo_competencias_contenidos'
  )
ORDER BY column_name;
```

**Expected Result:**
```
column_name                      | data_type      | column_default
---------------------------------|----------------|-------------------
competencias_seleccionadas       | ARRAY          | '{}'::text[]
contenidos_programa              | ARRAY          | '{}'::text[]
mapeo_competencias_contenidos    | jsonb          | '{}'::jsonb
```

---

### 2. Regenerate Supabase Types

**Command:**
```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

**Verification:**
```bash
# Check that the file was updated
ls -l src/integrations/supabase/types.ts
# File should have recent timestamp

# Search for new columns in types
grep -n "competencias_seleccionadas" src/integrations/supabase/types.ts
grep -n "contenidos_programa" src/integrations/supabase/types.ts
grep -n "mapeo_competencias_contenidos" src/integrations/supabase/types.ts
```

**Expected:** Should find matches showing these columns in the `planificaciones` table type.

---

### 3. Remove Temporary Type Casts

**File:** `src/pages/PlanificacionWizard.tsx`

**Find (around line 369):**
```typescript
} as any)
```

**Replace with:**
```typescript
})
```

**Explanation:** The `as any` cast was temporary because types hadn't been regenerated. After step 2, TypeScript knows about the new columns, so the cast is no longer needed.

---

### 4. Verify Build

**Command:**
```bash
npm run build
```

**Expected:**
```
✓ 4293 modules transformed.
✓ built in XXs
```

**No TypeScript errors about `competencias_seleccionadas`, `contenidos_programa`, or `mapeo_competencias_contenidos`.**

---

## 🧪 Manual E2E Testing

### Test Case 1: Normal Flow (Overlapping Competencies)

#### Setup
1. Start dev server:
   ```bash
   npm run dev
   ```
2. Open browser: http://localhost:8084/ (or shown port)
3. Login as teacher

#### Steps
1. **Create New Planificación:**
   - Click "Nueva Planificación" or navigate to wizard
   - Complete basic info (materia, nivel, grupo)

2. **Select Content Units with Overlapping Competencies:**
   - **Unit 1:** Select competencies: `["C1", "C2", "C3"]`
   - **Unit 2:** Select competencies: `["C2", "C3", "C4"]` (C2, C3 overlap)
   - **Unit 3:** Select competencies: `["C4", "C5"]` (C4 overlaps)

3. **Complete Wizard:**
   - Finish all steps
   - Click "Finalizar" or "Crear Planificación"

#### Verification

**Console Logs (Browser DevTools):**
```javascript
[Planificacion Creation] Extracted competencies: 5
[Planificacion Creation] Extracted contenidos: 3
```
✅ **Pass Criteria:** Count matches unique competencies (C1, C2, C3, C4, C5 = 5)

**Database Verification:**
```sql
-- 1. Check planificaciones table
SELECT 
  id,
  titulo,
  competencias_seleccionadas,
  contenidos_programa,
  mapeo_competencias_contenidos
FROM planificaciones
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
```json
{
  "id": "...",
  "titulo": "Test Plan",
  "competencias_seleccionadas": ["C1", "C2", "C3", "C4", "C5"],  // deduplicated, insertion order
  "contenidos_programa": ["Contenido 1", "Contenido 2", "Contenido 3"],
  "mapeo_competencias_contenidos": {
    "contenido-1": ["C1", "C2", "C3"],
    "contenido-2": ["C2", "C3", "C4"],
    "contenido-3": ["C4", "C5"]
  }
}
```

✅ **Pass Criteria:**
- Array has 5 unique elements (no duplicates)
- Order is preserved (first occurrence wins)
- `contenidos_programa` has 3 elements
- `mapeo_competencias_contenidos` maps content IDs to competencies

**Sessions Verification:**
```sql
-- 2. Check sesiones_clase table
SELECT 
  id,
  orden,
  contenidos_anep,
  competencias_anep,
  array_length(competencias_anep, 1) as num_competencias
FROM sesiones_clase
WHERE planificacion_id = '<id-from-previous-query>'
ORDER BY orden;
```

**Expected:**
```
id     | orden | contenidos_anep        | competencias_anep         | num_competencias
-------|-------|------------------------|---------------------------|------------------
...    | 1     | ["Contenido 1"]        | ["C1", "C2", "C3"]       | 3
...    | 2     | ["Contenido 2"]        | ["C2", "C3", "C4"]       | 3
...    | 3     | ["Contenido 3"]        | ["C4", "C5"]             | 2
```

✅ **Pass Criteria:**
- Each session has `competencias_anep` populated (non-empty)
- Competencies match the content's mapped competencies
- No sessions have empty competencies (unless content had none)

---

### Test Case 2: Edge Case (Zero Competencies)

#### Setup
Same as Test Case 1

#### Steps
1. **Create New Planificación**
2. **Select Content Units WITHOUT Competencies:**
   - **Unit 1:** Select content but leave competencies empty `[]`
   - **Unit 2:** Select content but leave competencies empty `[]`

3. **Complete Wizard**

#### Verification

**Console Logs:**
```javascript
[Planificacion Creation] Extracted competencies: 0
[Planificacion Creation] Extracted contenidos: 2
```

**Database Verification:**
```sql
SELECT 
  competencias_seleccionadas,
  contenidos_programa
FROM planificaciones
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
```json
{
  "competencias_seleccionadas": [],  // empty array
  "contenidos_programa": ["Contenido 1", "Contenido 2"]
}
```

✅ **Pass Criteria:**
- No crash/error
- Empty array stored (not null)
- Plan creation succeeds

**Sessions Verification:**
```sql
SELECT 
  id,
  orden,
  competencias_anep
FROM sesiones_clase
WHERE planificacion_id = '<id>'
ORDER BY orden;
```

**Expected:**
```
id     | orden | competencias_anep
-------|-------|-------------------
...    | 1     | []
...    | 2     | []
```

✅ **Pass Criteria:**
- Sessions have empty arrays (not null, not crashed)
- Plan is usable even without competencies

---

## 📸 Screenshot Checklist

Capture the following for PR documentation:

### 1. Console Logs
- Browser DevTools Console showing:
  ```
  [Planificacion Creation] Extracted competencies: 5
  [Planificacion Creation] Extracted contenidos: 3
  ```

### 2. Database Query Results
- SQL query showing `competencias_seleccionadas` with deduplicated array
- SQL query showing `sesiones_clase` with populated `competencias_anep`

### 3. Network Payload (Optional)
- DevTools Network tab → `generate-plan-completo` requests
- Show request body includes `competencias` array

### 4. UI Confirmation
- Screenshot of wizard with selected competencies
- Screenshot of session view showing competency badges

---

## 🔄 Option 2: Manual DB Access (Without Supabase CLI)

If Supabase CLI cannot be installed, use direct DB access:

### Apply Migration Manually

**Option A: Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Copy contents of `supabase/migrations/20251024162431_add_competencias_columns.sql`
5. Paste and run
6. Verify with:
   ```sql
   \d planificaciones
   ```

**Option B: `psql` Command Line**
```bash
# Get connection string from Supabase dashboard
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres"

# Run migration
\i supabase/migrations/20251024162431_add_competencias_columns.sql

# Verify
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'planificaciones' 
  AND column_name LIKE '%competencias%';
```

### Regenerate Types Manually

**Option A: Use Supabase Studio (Web)**
1. Go to Supabase Dashboard → API Docs
2. Copy TypeScript types
3. Paste into `src/integrations/supabase/types.ts`

**Option B: Use REST API**
```bash
curl -X GET "https://[YOUR-PROJECT].supabase.co/rest/v1/?apikey=[YOUR-ANON-KEY]" \
  -H "Accept: application/vnd.pgrst.object+json"
# Extract types from response
```

---

## ✅ Completion Checklist

After completing all steps above:

- [ ] Migration applied successfully
- [ ] Types regenerated with new columns
- [ ] `as any` cast removed from `PlanificacionWizard.tsx`
- [ ] Build passes without TypeScript errors
- [ ] Test Case 1 passes (overlapping competencies)
- [ ] Test Case 2 passes (zero competencies edge case)
- [ ] Console logs show extraction counts
- [ ] DB shows `competencias_seleccionadas` populated and deduplicated
- [ ] `sesiones_clase.competencias_anep` populated per session
- [ ] Screenshots captured for PR

---

## 🚀 Ready for Merge

Once all checklist items are complete:

1. **Commit Changes:**
   ```bash
   git add src/integrations/supabase/types.ts
   git add src/pages/PlanificacionWizard.tsx
   git commit -m "chore(supabase): regenerate types after migration"
   git commit -m "refactor(plan): remove temporary any-casts from plan insert payload"
   ```

2. **Update PR Description:**
   - Add "✅ Migration applied"
   - Add "✅ Types regenerated"
   - Attach screenshots/SQL outputs
   - Link to this integration guide

3. **Merge PR #2:**
   - All acceptance criteria met
   - E2E testing complete
   - Ready for production

---

## 📝 Current Status

**Environment:** Windows 10, Supabase CLI NOT INSTALLED  
**Blocker:** Cannot run `supabase migration up` or `supabase gen types`  
**Solution:** Follow Option 1 (install CLI) or Option 2 (manual DB access)  
**Dev Server:** Running at http://localhost:8084/  
**Branch:** `feature/planificacion-competencias-persist`

---

**Next Step:** Install Supabase CLI or use manual DB access to complete integration! 🚀

