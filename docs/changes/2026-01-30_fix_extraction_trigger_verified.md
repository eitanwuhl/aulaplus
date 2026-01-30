# Fix: extract-material-text Not Called After PDF Upload

**Date**: 2026-01-30  
**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Status**: ✅ Completed

## Summary

Fixed critical issue where PDF text extraction was not being triggered after material upload. The problem was that PDF detection relied only on `mime_type`, which can be incorrect or missing. Now extraction is triggered reliably using robust PDF detection (mime_type, storage_path, or file name).

## Root Cause

**Problem**: When uploading a PDF material, there was NO request in DevTools Network to `/functions/v1/extract-material-text`.

**Root Cause**: PDF detection in `useUploadAndCreateMaterial` only checked `material.mime_type.includes('pdf')`. If:
- `mime_type` was incorrect (e.g., `application/octet-stream`)
- `mime_type` was missing/null
- Browser didn't detect PDF correctly

Then extraction was never triggered, and `teacher_materials.extracted_text` remained NULL forever.

**Evidence**:
- Network tab showed no POST to `extract-material-text`
- SQL queries showed `has_text = false` for PDFs
- Console showed no extraction logs

## Fixes Implemented

### A) Robust PDF Detection

**File**: `src/hooks/useMaterials.ts`

**Before**:
```typescript
if (material.mime_type && material.mime_type.includes('pdf')) {
  // trigger extraction
}
```

**After**:
```typescript
// Robust PDF detection: check mime_type, storage_path, or file name
const isPdf = 
  (material.mime_type && material.mime_type.toLowerCase().includes('pdf')) ||
  (material.storage_path && material.storage_path.toLowerCase().endsWith('.pdf')) ||
  (file && file.name.toLowerCase().endsWith('.pdf'));

if (isPdf) {
  // trigger extraction
}
```

**Result**: ✅ PDFs are detected even if `mime_type` is wrong or missing

### B) Pass File Object to onSuccess

**File**: `src/hooks/useMaterials.ts`

**Change**: Modified `mutationFn` to return `file` object so `onSuccess` can use it for PDF detection:

```typescript
return {
  material: createResult.data!,
  uploadResult,
  file // Include file for PDF detection by name
};
```

**Result**: ✅ File name is available for PDF detection

### C) Enhanced DEV Logging

**File**: `src/hooks/useMaterials.ts`

**Added Logs**:

1. **After DB insert** (in `mutationFn`):
```typescript
if (import.meta.env.DEV) {
  console.log('[materials-upload] created', {
    id: createResult.data!.id,
    title: createResult.data!.title,
    mime_type: createResult.data!.mime_type,
    storage_path: createResult.data!.storage_path,
    file_name: file.name
  });
}
```

2. **Before invoking extraction**:
```typescript
if (import.meta.env.DEV) {
  console.log('[materials-upload] invoking extract-material-text', {
    id: material.id,
    title: material.title,
    mime_type: material.mime_type,
    storage_path: material.storage_path
  });
}
```

3. **After extraction result**:
```typescript
if (import.meta.env.DEV) {
  console.log('[materials-upload] extraction result', {
    id: material.id,
    success: extractResult.success,
    extractedChars: extractResult.extractedChars,
    pagesProcessed: extractResult.pagesProcessed,
    error: extractResult.error
  });
}
```

4. **After retry**:
```typescript
if (import.meta.env.DEV) {
  console.log('[materials-upload] extraction retry result', {
    id: material.id,
    success: extractResult.success,
    extractedChars: extractResult.extractedChars,
    error: extractResult.error
  });
}
```

5. **On extraction error**:
```typescript
console.error('[materials-upload] extraction error', {
  id: material.id,
  error: extractError instanceof Error ? extractError.message : 'Error desconocido',
  stack: extractError instanceof Error ? extractError.stack : undefined
});
```

**Result**: ✅ Full visibility into extraction flow in DEV mode

### D) Enhanced Error Surfacing

**File**: `src/hooks/useMaterials.ts`

**Changes**:
- Error messages now include full error details
- Toast notifications show specific error messages (not generic)
- Errors are logged with material ID for debugging

**Result**: ✅ Users see actionable error messages

### E) Guaranteed Extraction Invocation

**File**: `src/hooks/useMaterials.ts`

**Change**: Extraction is now `await`ed (not fire-and-forget) to ensure the request is made:

```typescript
// Always invoke extraction (await to ensure request is made)
let extractResult = await extractMaterialText(material.id);
```

**Result**: ✅ Network request is guaranteed to occur

## Files Changed

### Modified Files
- `src/hooks/useMaterials.ts`
  - Robust PDF detection (mime_type, storage_path, file name)
  - Pass `file` object to `onSuccess`
  - Enhanced DEV logging (5 log points)
  - Improved error messages
  - Guaranteed extraction invocation with `await`

## Verification Steps

### A) Upload PDF and Verify Network Request

**Steps**:
1. Open DevTools → Network tab
2. Filter by "extract-material-text"
3. Go to Biblioteca de Materiales
4. Click "Subir" button
5. Select a PDF file
6. Fill in title
7. Click "Subir Material"
8. **Expected**: Network tab shows POST request to `/functions/v1/extract-material-text` with status 200

**Evidence**: Screenshot of Network tab showing POST request

### B) Verify Console Logs

**Steps**:
1. Open DevTools → Console tab
2. Upload a PDF
3. **Expected**: Console shows logs in this order:
   ```
   [materials-upload] created { id: "...", title: "...", mime_type: "...", storage_path: "...", file_name: "..." }
   [materials-upload] invoking extract-material-text { id: "...", title: "...", mime_type: "...", storage_path: "..." }
   [materials-upload] extraction result { id: "...", success: true, extractedChars: 1234, pagesProcessed: 3 }
   ```

**Evidence**: Console log screenshot or copied output

### C) Verify SQL Database

**Steps**:
1. Upload a PDF
2. Wait 5-10 seconds for extraction to complete
3. Run SQL:
   ```sql
   SELECT 
     id, 
     title,
     mime_type,
     storage_path,
     extracted_text IS NOT NULL AS has_text,
     length(extracted_text) AS chars,
     created_at
   FROM public.teacher_materials
   WHERE deleted_at IS NULL
   ORDER BY created_at DESC
   LIMIT 3;
   ```

**Expected Output**:
```
id                                   | title              | mime_type        | storage_path                    | has_text | chars  | created_at
-------------------------------------|--------------------|------------------|--------------------------------|----------|--------|------------------
abc-123-def-456                      | Batllismo.pdf      | application/pdf  | pdfs/abc-123-def-456.pdf        | true     | 3456   | 2026-01-30 15:00:00
```

**Evidence**: SQL query output showing `has_text = true` and `chars > 0`

### D) Test with Wrong MIME Type

**Steps**:
1. Upload a PDF file that browser reports as `application/octet-stream` (or rename to `.pdf` but wrong MIME)
2. Verify extraction still triggers
3. **Expected**: 
   - Console shows `[materials-upload] invoking extract-material-text`
   - Network shows POST request
   - SQL shows `has_text = true`

**Evidence**: Console/Network screenshots

### E) Test Error Handling

**Steps**:
1. Upload a PDF
2. If extraction fails, verify:
   - Toast shows error message with details
   - Console shows error log with material ID
   - Material is still created (extraction failure doesn't block upload)

**Evidence**: Toast screenshot + console error log

## SQL Queries for Verification

### Check Latest Materials
```sql
SELECT 
  id, 
  title,
  mime_type,
  storage_path,
  extracted_text IS NOT NULL AS has_text,
  length(extracted_text) AS chars,
  created_at
FROM public.teacher_materials
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
```

### Check PDFs Without Extracted Text (Should be Empty After Fix)
```sql
SELECT 
  id, 
  title,
  mime_type,
  storage_path,
  extracted_text IS NOT NULL AS has_text
FROM public.teacher_materials
WHERE deleted_at IS NULL
  AND (
    mime_type LIKE '%pdf%' 
    OR storage_path LIKE '%.pdf'
  )
  AND extracted_text IS NULL
ORDER BY created_at DESC;
```

**Expected**: Empty result set (all PDFs have extracted_text)

## Network Request Verification

### Expected Request
**URL**: `POST https://<project>.supabase.co/functions/v1/extract-material-text`  
**Headers**:
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Body**:
```json
{
  "materialId": "<uuid>"
}
```

**Expected Response** (200 OK):
```json
{
  "ok": true,
  "extractedChars": 1234,
  "pagesProcessed": 3
}
```

## Console Logs Example

**Successful Extraction**:
```
[materials-upload] created {
  id: "abc-123-def-456",
  title: "Batllismo.pdf",
  mime_type: "application/pdf",
  storage_path: "pdfs/abc-123-def-456.pdf",
  file_name: "Batllismo.pdf"
}
[materials-upload] invoking extract-material-text {
  id: "abc-123-def-456",
  title: "Batllismo.pdf",
  mime_type: "application/pdf",
  storage_path: "pdfs/abc-123-def-456.pdf"
}
[materials-upload] extraction result {
  id: "abc-123-def-456",
  success: true,
  extractedChars: 3456,
  pagesProcessed: 3,
  error: undefined
}
```

**Failed Extraction (with Retry)**:
```
[materials-upload] created { ... }
[materials-upload] invoking extract-material-text { ... }
[materials-upload] extraction result {
  id: "abc-123-def-456",
  success: false,
  extractedChars: undefined,
  pagesProcessed: undefined,
  error: "Failed to download PDF file"
}
[materials-upload] First extraction attempt failed, retrying once... {
  id: "abc-123-def-456",
  error: "Failed to download PDF file"
}
[materials-upload] extraction retry result {
  id: "abc-123-def-456",
  success: true,
  extractedChars: 3456,
  error: undefined
}
```

## What Was Wrong

1. **PDF Detection Too Narrow**: Only checked `mime_type`, which can be:
   - Incorrect (browser misdetection)
   - Missing (null/undefined)
   - Generic (`application/octet-stream`)

2. **No Fallback Detection**: Didn't check `storage_path` or `file.name`

3. **Missing Logs**: No visibility into why extraction wasn't triggered

4. **File Object Not Available**: `onSuccess` didn't have access to original `file` object for name-based detection

## Impact

**Before Fix**:
- PDFs with wrong/missing `mime_type` → no extraction → `has_text = false` forever
- No way to debug why extraction wasn't triggered
- Users had to manually re-extract

**After Fix**:
- PDFs detected by any of: `mime_type`, `storage_path`, or `file.name`
- Full logging in DEV mode
- Extraction always triggered for PDFs
- Users see clear error messages if extraction fails

## Remaining Limitations

1. **Extraction Timing**: Extraction happens asynchronously. If user navigates away immediately, extraction may still complete in background.

2. **PDFs Without Text Layer**: Image-only or scanned PDFs may have `extractedChars: 0`. This is expected behavior.

3. **Network Failures**: If network fails during extraction, user sees error toast but material is still created.

## Next Steps (If Issues Persist)

1. **If extraction still not triggered**:
   - Check console logs for `[materials-upload] invoking extract-material-text`
   - Verify PDF detection logic (check all 3 conditions)
   - Verify `file` object is passed to `onSuccess`

2. **If Network request not visible**:
   - Check Network tab filter (should filter by "extract-material-text")
   - Verify edge function is deployed
   - Check browser console for errors

3. **If SQL shows `has_text = false`**:
   - Check Network tab for failed requests (status 400/500)
   - Check console logs for extraction errors
   - Verify edge function logs in Supabase Dashboard

## Git Commit

```bash
git add -A
git commit -m "fix(materials): robust PDF detection + guaranteed extraction trigger"
```

---

**Commits**:
- `32ef206` - fix(materials): robust PDF detection + guaranteed extraction trigger
- `583ba76` - docs: add extraction trigger fix report

**Status**: ✅ Fix implemented, ready for verification
