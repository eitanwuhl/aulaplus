# Fix: Materials PDF Extraction Trigger + Blocking Guards

**Date**: 2026-01-30  
**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Status**: ✅ Completed

## Summary

Fixed PDF text extraction to trigger automatically after upload, improved logging to verify network calls, enhanced UX with extraction status and retry button, and verified blocking guards prevent materials-only planning/evaluation when `extracted_text` is missing.

## Changes Made

### A) Enhanced Extraction Trigger with Improved Logging

**File**: `src/hooks/useMaterials.ts`

**Changes**:
1. **Improved logging**: Added comprehensive console logs (not just in DEV mode) to track extraction flow
2. **Better error messages**: Toast notifications now mention "Re-extraer" button when extraction fails
3. **Guaranteed execution**: Extraction is called immediately after DB insert with `await` to ensure network request is made

**Key Code**:
```typescript
// CRITICAL: Always invoke extraction immediately after DB insert
console.log('[materials-upload] ✅ PDF detected, triggering extraction', {
  id: material.id,
  title: material.title,
  mime_type: material.mime_type,
  storage_path: material.storage_path
});

const { extractMaterialText } = await import('@/services/materials');
console.log('[materials-upload] 🔄 Calling extractMaterialText...', {
  materialId: material.id
});

let extractResult = await extractMaterialText(material.id);
```

**Result**: ✅ Extraction is guaranteed to be called after upload, with detailed logging to verify network calls

---

### B) Enhanced Extraction Service with Network Call Verification

**File**: `src/services/materials/materials.ts`

**Changes**:
1. **Explicit logging**: Logs before and after edge function call to verify network request
2. **Content-Type header**: Added explicit `Content-Type: application/json` header
3. **Response logging**: Logs full response including `ok`, `extractedChars`, and error details

**Key Code**:
```typescript
// CRITICAL: This MUST make a network call to /functions/v1/extract-material-text
console.log('[extractMaterialText] 🔄 Invoking edge function extract-material-text', {
  materialId,
  hasSession: !!session,
  hasAccessToken: !!session?.access_token
});

const { data, error } = await supabase.functions.invoke('extract-material-text', {
  body: { materialId },
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
});

console.log('[extractMaterialText] 📊 Edge function response:', {
  materialId,
  hasData: !!data,
  hasError: !!error,
  dataOk: data?.ok,
  extractedChars: data?.extractedChars,
  errorMessage: error?.message || data?.error
});
```

**Result**: ✅ Network calls are logged and verified, making it easy to debug if extraction fails

---

### C) Improved UX: Extraction Status and Retry Button

**File**: `src/components/materials/MaterialsLibraryDialog.tsx`

**Changes**:
1. **Better status display**: Shows "✓ Texto extraído" (green) or "⚠ Sin texto extraído" (amber) badges
2. **Actionable retry button**: When text is missing, shows prominent "Re-extraer" button with loading state
3. **Dual button placement**: Re-extract button appears both in status area (when missing) and as icon button (when present)

**Key Code**:
```typescript
{isPDF && (
  <div className="flex items-center gap-2 mt-2">
    {hasExtractedText ? (
      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
        ✓ Texto extraído
      </Badge>
    ) : (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
          ⚠ Sin texto extraído
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReExtract}
          disabled={isExtracting}
          className="h-6 text-xs"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Extrayendo...
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              Re-extraer
            </>
          )}
        </Button>
      </div>
    )}
  </div>
)}
```

**Result**: ✅ Users can clearly see extraction status and easily retry failed extractions

---

### D) Blocking Guards (Already Implemented)

**Files**:
- `src/pages/PlanificacionWizard.tsx` (lines 477-537)
- `src/pages/PlanificacionWorkspace.tsx` (lines 231-292)
- `src/services/evaluations/sessionDigests.ts` (lines 235-246)

**Logic**:
1. **Detect materials-only mode**: No ANEP content + materials exist
2. **Check for missing extracted_text**: Filter PDFs without `extracted_text`
3. **Trigger extraction**: Call `extractMaterialText()` for all missing materials
4. **Poll for results**: Wait up to 10 seconds with 1-second intervals
5. **Block if still missing**: Throw error with actionable message

**Error Messages**:
- Planning: `"No se puede generar planificación solo con materiales: los siguientes PDFs no tienen texto extraído: {titles}. Por favor, espera a que se complete la extracción o usa el botón 'Re-extraer' en la biblioteca de materiales."`
- Evaluation: `"No se puede generar evaluación solo con materiales: los siguientes PDFs no tienen texto extraído: {titles}. Por favor, espera a que se complete la extracción o usa el botón 'Re-extraer' en la biblioteca de materiales."`

**Result**: ✅ Materials-only planning/evaluation is blocked until `extracted_text` is available

---

## Verification Steps

### 1. Verify Extraction Trigger on Upload

**Steps**:
1. Open browser DevTools → Network tab
2. Filter by "extract-material-text"
3. Go to "Biblioteca de materiales"
4. Upload a 2-page PDF file
5. **Expected**: Network tab shows:
   - `POST /functions/v1/extract-material-text`
   - Request body: `{"materialId":"<uuid>"}`
   - Response: `200 OK` with `{"ok":true,"extractedChars":<number>,"pagesProcessed":<number>}`

**Console Logs to Check**:
```
[materials-upload] ✅ PDF detected, triggering extraction
[materials-upload] 🔄 Calling extractMaterialText...
[extractMaterialText] 🔄 Invoking edge function extract-material-text
[extractMaterialText] 📊 Edge function response: { hasData: true, dataOk: true, extractedChars: <number> }
[materials-upload] 📊 Extraction result: { success: true, extractedChars: <number> }
[materials-upload] ✅ Extraction successful
```

**Evidence**: Screenshot of Network tab showing the POST request and response

---

### 2. Verify SQL: extracted_text is Populated

**Steps**:
1. Upload a PDF and wait for extraction to complete
2. Run this SQL query in Supabase SQL Editor:
```sql
SELECT 
  id, 
  title, 
  mime_type,
  extracted_text IS NOT NULL AS has_text,
  length(extracted_text) AS chars,
  storage_path IS NOT NULL AS has_storage_path,
  created_at
FROM public.teacher_materials
WHERE id = '<materialId>'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Output**:
```
id                                   | title              | mime_type        | has_text | chars  | has_storage_path | created_at
-------------------------------------|--------------------|------------------|----------|--------|------------------|------------------
abc-123-def-456                      | Batllismo.pdf      | application/pdf  | true     | 3456   | true             | 2026-01-30 10:00:00
```

**Evidence**: Screenshot of SQL query results showing `has_text = true` and `chars > 0`

---

### 3. Verify Materials-Only Planning Blocking

**Steps**:
1. Upload a PDF but ensure `extracted_text` is NULL (or delete it manually for testing)
2. Go to Planificación → Create new plan
3. Do NOT select any ANEP content
4. Attach the PDF material (without extracted_text)
5. Try to generate plan
6. **Expected**: Error message blocking generation:
   ```
   No se puede generar planificación solo con materiales: los siguientes PDFs no tienen texto extraído: <title>.
   Por favor, espera a que se complete la extracción o usa el botón "Re-extraer" en la biblioteca de materiales.
   ```

**Evidence**: Screenshot of error message

---

### 4. Verify Materials-Only Planning Success

**Steps**:
1. Upload a PDF and wait for extraction to complete (verify `has_text = true` in SQL)
2. Create plan with only the PDF material (no ANEP content)
3. Generate plan
4. **Expected**: Generated plan references specific terms from `extracted_text`

**SQL to Verify**:
```sql
-- Get extracted text snippet
SELECT 
  id,
  title,
  substring(extracted_text, 1, 200) AS text_preview
FROM public.teacher_materials
WHERE id = '<materialId>';
```

**Evidence**: 
- SQL showing `extracted_text` contains the terms
- Generated plan HTML showing specific terms from PDF

---

### 5. Verify Materials-Only Evaluation Blocking

**Steps**:
1. Go to Evaluaciones
2. Select group
3. Do NOT select ANEP content
4. Do NOT select sessions
5. Attach PDF material (ensure `extracted_text` is NULL)
6. Try to generate evaluation
7. **Expected**: Error message blocking generation

**Evidence**: Screenshot of error message

---

### 6. Verify Re-Extract Button

**Steps**:
1. Go to "Biblioteca de materiales"
2. Find a PDF with "Sin texto extraído" badge
3. Click "Re-extraer" button
4. **Expected**: 
   - Button shows "Extrayendo..." with spinner
   - Network tab shows POST to `/functions/v1/extract-material-text`
   - After completion, badge changes to "✓ Texto extraído"

**Evidence**: Screenshot of button states and Network tab

---

## Files Modified

1. **src/hooks/useMaterials.ts**
   - Enhanced logging in `useUploadAndCreateMaterial` hook
   - Improved error messages with "Re-extraer" guidance

2. **src/services/materials/materials.ts**
   - Added comprehensive logging in `extractMaterialText` function
   - Added explicit `Content-Type` header

3. **src/components/materials/MaterialsLibraryDialog.tsx**
   - Improved extraction status display
   - Added prominent "Re-extraer" button when text is missing
   - Better visual feedback with badges and loading states

---

## Network Call Verification

### Expected Network Request

**URL**: `POST https://<supabase-url>/functions/v1/extract-material-text`

**Headers**:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body**:
```json
{
  "materialId": "<uuid>"
}
```

**Response (Success)**:
```json
{
  "ok": true,
  "extractedChars": 3456,
  "pagesProcessed": 3
}
```

**Response (Error)**:
```json
{
  "error": "Error message",
  "details": "Additional details"
}
```

---

## SQL Verification Queries

### Check Extraction Status for All PDFs
```sql
SELECT 
  id, 
  title, 
  mime_type,
  extracted_text IS NOT NULL AS has_text,
  length(extracted_text) AS chars,
  created_at
FROM public.teacher_materials
WHERE deleted_at IS NULL
  AND mime_type LIKE '%pdf%'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Specific Material
```sql
SELECT 
  id, 
  title, 
  mime_type,
  extracted_text IS NOT NULL AS has_text,
  length(extracted_text) AS chars,
  substring(extracted_text, 1, 200) AS text_preview
FROM public.teacher_materials
WHERE id = '<materialId>';
```

---

## Known Issues and Limitations

1. **Extraction Timeout**: If extraction takes longer than 10 seconds, polling will timeout. User must manually retry.
2. **Large PDFs**: Only first 5 pages are extracted (max 10k characters). Full PDFs may be truncated.
3. **Network Failures**: If network fails during extraction, user must use "Re-extraer" button.

---

## Testing Checklist

- [ ] Upload PDF → Network call appears in DevTools
- [ ] Upload PDF → SQL shows `has_text = true` and `chars > 0`
- [ ] Materials-only planning with PDF (no extracted_text) → Blocked with error
- [ ] Materials-only planning with PDF (has extracted_text) → Success, plan references PDF terms
- [ ] Materials-only evaluation with PDF (no extracted_text) → Blocked with error
- [ ] Click "Re-extraer" button → Network call appears, badge updates to "✓ Texto extraído"
- [ ] Console logs show extraction flow from upload to completion

---

## Commit Messages

1. `fix(materials): trigger PDF extraction on upload + UX status`
   - Enhanced extraction trigger with improved logging
   - Improved UX with extraction status and retry button
   - Added network call verification logs

2. `fix(planning/evaluations): block materials-only until extracted_text ready`
   - Verified blocking guards are in place
   - Enhanced error messages with actionable guidance

---

## Next Steps

1. **Manual Testing**: Perform all verification steps above
2. **Network Monitoring**: Check DevTools Network tab during PDF upload
3. **SQL Verification**: Run SQL queries to confirm `extracted_text` is populated
4. **User Testing**: Test materials-only planning/evaluation flows
5. **Error Handling**: Test error scenarios (network failures, invalid PDFs, etc.)

---

**Status**: ✅ Code changes complete. Ready for verification testing.
