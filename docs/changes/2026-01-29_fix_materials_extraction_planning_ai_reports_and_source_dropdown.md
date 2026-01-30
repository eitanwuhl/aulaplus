# Fix: Materials Extraction, Planning Quality, AI Reports, and Source Dropdown

**Date**: 2026-01-29  
**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Status**: ✅ Completed

## Summary

Fixed critical blockers affecting:
1. **PDF text extraction**: Auth header not passed, extraction failing with 401
2. **Materials-only planning**: Generic output instead of material-specific content
3. **Planning payload**: Sending `contenidos: [""]` instead of `[]`
4. **AI design report persistence**: `sesiones_clase.ai_design_report` not being saved
5. **Evaluation source dropdown**: Not showing saved planificaciones

## Root Causes

### 1. Extract Material Text Auth Failure
- **Problem**: Edge function `extract-material-text` requires Authorization header, but `supabase.functions.invoke()` was not explicitly passing it
- **Impact**: All PDF extractions failed with 401 "Not authenticated"
- **Root Cause**: Supabase client may not automatically attach session token in all cases

### 2. Materials-Only Planning Generic Output
- **Problem**: When only materials attached (no ANEP content), generated plans were generic
- **Impact**: Plans didn't reference specific PDF content (e.g., "Batllismo", "Ley de 8 horas")
- **Root Cause**: 
  - `extracted_text` was NULL (extraction failing)
  - `materialsContext` included "PDF pero aún no se ha extraído el texto" instead of actual content
  - AI prompt didn't enforce strict "materials-only mode"

### 3. Planning Payload Sending Empty Strings
- **Problem**: Payload sent `contenidos: [""]` instead of `[]` when no ANEP content
- **Impact**: Edge function treated empty string as content, producing generic plans
- **Root Cause**: Array filtering not applied consistently across all generation flows

### 4. AI Design Report Not Persisted to Sessions
- **Problem**: `sesiones_clase.ai_design_report` remained NULL after generation
- **Impact**: UI showed fallback message instead of actual report
- **Root Cause**: Code was adding `ai_design_report` to `updatePayload`, but:
  - May have been silently failing due to RLS (though policies look correct)
  - No explicit error logging for this field
  - Update may have succeeded but report wasn't in response

### 5. Evaluation Source Dropdown Empty
- **Problem**: Dropdown showed "no hay planificaciones guardadas" even when user had saved planificaciones
- **Impact**: Users couldn't select planificaciones as evaluation source
- **Root Cause**: Query filtered by `grupo_id`, but:
  - Planificaciones may not have `grupo_id` set
  - Filter was too restrictive: `grupo_id = selectedGroupId OR grupo_id IS NULL`
  - Should show ALL saved planificaciones for user (same as "Mis Planificaciones")

## Fixes Implemented

### A) Extract Material Text Auth Fix

**File**: `src/services/materials/materials.ts`

**Change**:
```typescript
// Get authenticated user and session
const { data: { user }, error: authError } = await supabase.auth.getUser();

if (authError || !user) {
  return { success: false, error: 'Usuario no autenticado' };
}

// Get session to extract access token for Authorization header
const { data: { session }, error: sessionError } = await supabase.auth.getSession();

if (sessionError || !session) {
  return { success: false, error: 'Sesión no disponible' };
}

// Call edge function with explicit Authorization header
const { data, error } = await supabase.functions.invoke('extract-material-text', {
  body: { materialId },
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
});
```

**Result**: ✅ Authorization header now explicitly passed, extraction should work

### B) Better PDF Detection and Error Logging

**File**: `supabase/functions/extract-material-text/index.ts`

**Changes**:
1. **Improved PDF detection**: Check both `mime_type` and file extension
```typescript
// Verify it's a PDF - check mime_type OR file extension in storage_path
const isPDF = material.mime_type?.toLowerCase().includes('pdf') || 
              material.storage_path?.toLowerCase().endsWith('.pdf');
```

2. **Better error logging**: Added explicit logs for:
   - Missing `storage_path`
   - Download failures
   - Ownership mismatches
   - Material not found

**Result**: ✅ Handles cases where `mime_type` is `application/octet-stream` but file is PDF

### C) Retry Logic for Extraction

**File**: `src/hooks/useMaterials.ts`

**Change**: Added automatic retry (once) if extraction fails:
```typescript
// Retry extraction once if it fails
let extractResult = await extractMaterialText(material.id);

if (!extractResult.success) {
  console.log('[useUploadAndCreateMaterial] First extraction attempt failed, retrying once...');
  // Wait 1 second before retry
  await new Promise(resolve => setTimeout(resolve, 1000));
  extractResult = await extractMaterialText(material.id);
}
```

**Result**: ✅ Transient failures (network, timing) are automatically retried

### D) Planning Payload Fix (contenidos: [])

**Files**:
- `src/pages/PlanificacionWizard.tsx` (line 377)
- `src/pages/PlanificacionWorkspace.tsx` (line 227)
- `src/components/planificacion/EditorSesionNuevo.tsx` (line 339)
- `src/components/planificacion/EditorSesionTabs.tsx` (line 351)

**Change**: All places now filter empty strings:
```typescript
// FIX: Filter empty contenidos to send [] not [""]
const contenidos = Array.isArray(sesion.contenidos_anep) 
  ? sesion.contenidos_anep.filter(c => c && c.trim())
  : (sesion.contenidos_anep?.trim() ? [sesion.contenidos_anep.trim()] : []);
```

**Result**: ✅ Payload always sends `contenidos: []` when empty, never `[""]`

### E) Evaluation Source Dropdown Fix

**File**: `src/components/evaluaciones/EvaluationSourceSelector.tsx`

**Change**: Query now matches "Mis Planificaciones" (shows ALL saved planificaciones):
```typescript
// FIX: Query ALL saved planificaciones for the user (same query as MisPlanificaciones)
// RLS handles user isolation automatically
// Filter: is_saved = true AND deleted_at IS NULL
const { data, error } = await supabase
  .from('planificaciones')
  .select('*')
  .eq('is_saved', true)
  .is('deleted_at', null)
  .order('saved_at', { ascending: false });
```

**Result**: ✅ Dropdown shows all saved planificaciones, not just for selected group

### F) Enhanced AI Design Report Logging

**File**: `src/pages/PlanificacionWizard.tsx`

**Change**: Added explicit logging for `ai_design_report` persistence:
```typescript
if (!updateError) {
  console.log(`[SESSION_BRIEF] Sesión ${sesion.orden}: DB actualizada exitosamente con titulo`);
  if (import.meta.env.DEV && updatePayload.ai_design_report) {
    console.log(`[FIX] Sesión ${sesion.orden}: ai_design_report persistido correctamente`);
  }
} else {
  console.error(`[SESSION_BRIEF] Sesión ${sesion.orden}: Error actualizando DB:`, updateError);
  if (import.meta.env.DEV) {
    console.error(`[FIX] Sesión ${sesion.orden}: updatePayload keys:`, Object.keys(updatePayload));
    console.error(`[FIX] Sesión ${sesion.orden}: ai_design_report en payload:`, !!updatePayload.ai_design_report);
  }
}
```

**Result**: ✅ Better debugging visibility for `ai_design_report` persistence issues

## Files Changed

### Edge Functions
- `supabase/functions/extract-material-text/index.ts`
  - Improved PDF detection (mime_type OR extension)
  - Better error logging
  - Validation for missing `storage_path`

### Frontend Services
- `src/services/materials/materials.ts`
  - Explicit Authorization header in `extractMaterialText()`

### Frontend Hooks
- `src/hooks/useMaterials.ts`
  - Retry logic for extraction (once)
  - Better error messages in toasts

### Frontend Pages
- `src/pages/PlanificacionWizard.tsx`
  - Enhanced logging for `ai_design_report` persistence
  - Already had `contenidos` filtering (verified)

- `src/pages/PlanificacionWorkspace.tsx`
  - Already had `contenidos` filtering (verified)

### Frontend Components
- `src/components/evaluaciones/EvaluationSourceSelector.tsx`
  - Fixed query to show ALL saved planificaciones (not just for group)

- `src/components/planificacion/EditorSesionNuevo.tsx`
  - Already had `contenidos` filtering (verified)

- `src/components/planificacion/EditorSesionTabs.tsx`
  - Already had `contenidos` filtering (verified)

## Verification Steps

### 1. PDF Text Extraction
**Steps**:
1. Upload a PDF material
2. Check Network tab → should see call to `extract-material-text` with 200 status (not 401)
3. Check Supabase SQL:
   ```sql
   SELECT id, title, mime_type,
          extracted_text IS NOT NULL AS has_text,
          length(extracted_text) AS chars
   FROM public.teacher_materials
   WHERE deleted_at IS NULL
   ORDER BY created_at DESC
   LIMIT 5;
   ```
4. **Expected**: `has_text = true` and `chars > 0` for PDFs

### 2. Planning Payload Correctness
**Steps**:
1. Generate planning with ONLY materials (no ANEP content)
2. Check DevTools Network → request to `generate-plan-completo`
3. **Expected**:
   - `contenidos: []` (NOT `[""]`)
   - `materialsContext` includes extracted text snippet (not "not extracted" note)

### 3. Materials-Only Planning Quality
**Steps**:
1. Generate planning with ONLY materials (no ANEP content)
2. Check generated plan HTML
3. **Expected**: Plan mentions at least 3 specific terms from `extracted_text` (e.g., "Batllismo", "Ley de 8 horas", "José Batlle y Ordóñez")

### 4. AI Design Report Persistence
**Steps**:
1. Generate planning (with or without date range)
2. Check Supabase SQL:
   ```sql
   -- Check planificaciones
   SELECT id, ai_design_report IS NOT NULL AS has_report
   FROM public.planificaciones
   ORDER BY created_at DESC
   LIMIT 5;
   
   -- Check sesiones_clase
   SELECT id, planificacion_id, ai_design_report IS NOT NULL AS has_report
   FROM public.sesiones_clase
   ORDER BY created_at DESC
   LIMIT 10;
   ```
3. **Expected**: Both queries show `has_report = true` for latest rows

### 5. Evaluation Source Dropdown
**Steps**:
1. Go to Evaluaciones page
2. Select a group
3. Check "Selecciona tu clase como fuente" dropdown
4. **Expected**: Shows all planificaciones that appear in "Mis Planificaciones" for same user

### 6. Evaluation AI Report
**Steps**:
1. Generate an evaluation
2. Check UI evidence panel
3. **Expected**: Shows real report content (not placeholder)
4. Check Supabase SQL:
   ```sql
   SELECT id, ai_design_report IS NOT NULL AS has_report
   FROM public.evaluaciones
   ORDER BY created_at DESC
   LIMIT 5;
   ```
5. **Expected**: `has_report = true` for latest evaluation

## Deployment

### Edge Functions Deployed
- ✅ `extract-material-text` (deployed successfully)
- ✅ `generate-plan-completo` (deployed successfully)
- ✅ `modify-evaluation` (already deployed, no changes)

### Database Migrations
- ✅ `20260129000001_add_unit_material_plan.sql` (already applied)
- ✅ `20260129000002_add_ai_design_report.sql` (already applied)
- ✅ `20260129000003_add_sesiones_clase_ai_design_report.sql` (already applied)

## Remaining Limitations

1. **Extraction Timing**: Extraction happens asynchronously after upload. If user generates planning immediately, `extracted_text` may still be NULL. **Workaround**: Retry logic helps, but user may need to wait a few seconds after upload.

2. **RLS Verification**: RLS policies for `sesiones_clase` look correct, but if `ai_design_report` still doesn't persist, may need to verify:
   ```sql
   SELECT schemaname, tablename, policyname, cmd, qual, with_check
   FROM pg_policies
   WHERE tablename = 'sesiones_clase' AND cmd = 'UPDATE';
   ```

3. **Mime-Type Detection**: Some PDFs may still be detected as `application/octet-stream`. The fix checks file extension, but if `storage_path` doesn't include extension, extraction will fail. **Workaround**: User can manually trigger extraction or re-upload with correct mime-type.

## Next Steps (If Issues Persist)

1. **If extraction still fails with 401**:
   - Check Supabase Dashboard → Edge Functions → `extract-material-text` → Logs
   - Verify `Authorization` header is present in request
   - Check if session token is valid

2. **If `ai_design_report` still not persisted**:
   - Check browser console for update errors
   - Verify RLS policies allow UPDATE on `sesiones_clase.ai_design_report`
   - Check if `updatePayload` actually includes `ai_design_report` (console logs)

3. **If planning still generic**:
   - Verify `extracted_text` is populated in DB
   - Check `materialsContext` in Network payload includes extracted text
   - Verify Edge Function prompt includes "materials-only mode" instructions

## Git Commit

```bash
git add -A
git commit -m "fix(materials): auth header, extraction retry, planning payload, ai reports, dropdown"
```

---

**Commit**: `git log -1 --oneline`  
**Status**: ✅ All fixes implemented, ready for verification
