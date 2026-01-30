# Fix: Extraction Pipeline + Block Materials-Only Until Ready

**Date**: 2026-01-30  
**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Status**: ✅ Completed

## Summary

Fixed critical issues preventing PDF text extraction from working and added blocking guards to prevent materials-only planning/evaluation when `extracted_text` is missing. This ensures users get quality, material-specific outputs instead of generic placeholders.

## Root Causes Found

### 1. JSON Parse Bug (500 Error)
**Problem**: Edge function `extract-material-text` was failing with 500 error:
```
{"details":"Expected property name or '}' in JSON at position 1"}
```

**Root Cause**: Direct `await req.json()` usage without error handling. Malformed, empty, or BOM-encoded request bodies caused unhandled exceptions.

**Evidence**: 
- Function logs showed parse errors
- Network requests returned 500 instead of 400
- Extraction never completed

### 2. Extraction Not Triggered or Failing Silently
**Problem**: `teacher_materials.extracted_text` remained NULL after PDF upload.

**Root Causes**:
- Authorization header may not have been passed correctly in all cases
- Extraction errors were not surfaced to user
- No retry mechanism for transient failures
- No manual re-extraction option

**Evidence**:
- SQL queries showed `has_text = false` for PDFs
- Network tab showed extraction calls but no success confirmation
- User had no way to retry failed extractions

### 3. Materials-Only Planning Producing Generic Output
**Problem**: When planning with only materials (no ANEP content), output was generic because `materialsContext` included "PDF pero aún no se ha extraído el texto" instead of actual content.

**Root Cause**: No blocking guard prevented generation when `extracted_text` was missing. System attempted generation anyway, producing generic output.

**Evidence**:
- Generated plans didn't mention specific PDF terms
- `materialsContext` in Network payload showed "not extracted" note
- User had no warning that output would be generic

## Fixes Implemented

### A) Robust JSON Parsing in Edge Function

**File**: `supabase/functions/extract-material-text/index.ts`

**Changes**:
1. **Read raw text first**:
```typescript
// Read raw text once
const raw = await req.text();
console.log('[extract-material-text] Raw body received:', raw.slice(0, 200));

// Remove BOM and trim
const cleaned = raw.replace(/^\uFEFF/, '').trim();
```

2. **Try-catch JSON parsing**:
```typescript
let body: any = {};
if (cleaned) {
  try {
    body = JSON.parse(cleaned);
  } catch (parseError) {
    console.error('[extract-material-text] JSON parse error:', {
      error: parseError.message,
      received: cleaned.slice(0, 200)
    });
    return new Response(
      JSON.stringify({ 
        error: 'Invalid JSON body', 
        details: parseError.message,
        received: cleaned.slice(0, 200)
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

3. **Fallback to query parameter**:
```typescript
materialId = body.materialId || null;

// Fallback: check query parameter if body doesn't have materialId
if (!materialId) {
  try {
    const url = new URL(req.url);
    materialId = url.searchParams.get('materialId');
  } catch (urlError) {
    console.error('[extract-material-text] URL parse error:', urlError);
  }
}
```

4. **Enhanced logging**:
```typescript
console.log('[extract-material-text] Material found:', { 
  userId: user.id,
  materialId, 
  title: material.title,
  hasStoragePath: !!material.storage_path,
  storagePath: material.storage_path,
  mimeType: material.mime_type
});

console.log('[extract-material-text] Downloading PDF from storage:', {
  materialId,
  storage_path: material.storage_path,
  bucket: 'teacher-materials'
});

console.log('[extract-material-text] PDF downloaded successfully:', {
  materialId,
  fileSize: fileData.size
});

console.log('[extract-material-text] Updating material with extracted text:', {
  materialId,
  extractedChars: extractedText.length
});

console.log('[extract-material-text] Successfully updated material:', {
  materialId,
  extractedChars: extractedText.length,
  pagesProcessed: Math.min(MAX_PAGES, extractedText.split('\n\n').length)
});
```

**Result**: ✅ Function now returns 400 (not 500) for parse errors, with detailed error messages

### B) Enhanced Error Surfacing in Frontend

**File**: `src/services/materials/materials.ts`

**Changes**:
```typescript
if (error) {
  console.error('[extractMaterialText] Edge function error:', error);
  const errorMessage = error.message || 'Error al extraer texto del PDF';
  // Include details if available
  const details = (error as any).details || (error as any).error?.details;
  return { 
    success: false, 
    error: details ? `${errorMessage}: ${details}` : errorMessage
  };
}

if (!data || !data.ok) {
  const errorMessage = data?.error || 'Error desconocido al extraer texto';
  const details = data?.details;
  return { 
    success: false, 
    error: details ? `${errorMessage}: ${details}` : errorMessage
  };
}
```

**Result**: ✅ Users see exact error messages in toasts, not generic failures

### C) Polling Utility for Extracted Text

**File**: `src/utils/pollExtractedText.ts` (NEW)

**Purpose**: Poll database for `extracted_text` to become available when materials-only planning/evaluation is attempted.

**Key Functions**:
1. `pollExtractedText()`: Polls with configurable timeout and interval
2. `hasExtractedText()`: Quick check if material has extracted text

**Usage**:
```typescript
const pollResult = await pollExtractedText({
  materialId: material.material_id,
  maxWaitSeconds: 10,
  pollIntervalMs: 1000,
  onProgress: (attempt, maxAttempts) => {
    console.log(`Polling (${attempt}/${maxAttempts})...`);
  }
});
```

**Result**: ✅ System can wait for extraction to complete before blocking

### D) Blocking Guard for Materials-Only Planning

**Files**:
- `src/pages/PlanificacionWizard.tsx`
- `src/pages/PlanificacionWorkspace.tsx`
- `src/services/evaluations/sessionDigests.ts`

**Logic**:
1. **Detect materials-only mode**: No ANEP content + materials exist
2. **Check for missing extracted_text**: Filter PDFs without `extracted_text`
3. **Trigger extraction**: Call `extractMaterialText()` for all missing materials
4. **Poll for results**: Wait up to 10 seconds with 1-second intervals
5. **Block if still missing**: Throw error with actionable message

**Implementation** (PlanificacionWizard):
```typescript
// FIX: BLOCK materials-only planning if PDFs lack extracted_text
const hasAnepContent = contenidosSesion.length > 0;
const hasMaterials = allMaterials.length > 0;
const pdfMaterials = allMaterials.filter(m => m.mime_type?.includes('pdf'));
const materialsWithoutText = pdfMaterials.filter(m => !m.extracted_text);

if (!hasAnepContent && hasMaterials && materialsWithoutText.length > 0) {
  const missingTitles = materialsWithoutText.map(m => m.title).join(', ');
  const missingIds = materialsWithoutText.map(m => m.material_id).filter(Boolean) as string[];
  
  // Try to trigger extraction and poll for results
  const { extractMaterialText } = await import('@/services/materials');
  const { pollExtractedText } = await import('@/utils/pollExtractedText');
  
  // Trigger extraction for all missing materials
  const extractionPromises = missingIds.map(id => extractMaterialText(id));
  await Promise.allSettled(extractionPromises);
  
  // Poll for extracted_text
  let allExtracted = true;
  for (const material of materialsWithoutText) {
    if (!material.material_id) continue;
    
    const pollResult = await pollExtractedText({
      materialId: material.material_id,
      maxWaitSeconds: 10,
      pollIntervalMs: 1000
    });
    
    if (!pollResult.success) {
      allExtracted = false;
      console.error(`[MATERIALS] ❌ Failed to extract text for "${material.title}": ${pollResult.error}`);
    } else {
      // Reload material to get updated extracted_text
      const updatedMaterials = await loadAttachedMaterialsForSession(planificacionId, sesion.id);
      const updatedMaterial = updatedMaterials.find(m => m.material_id === material.material_id);
      if (updatedMaterial?.extracted_text) {
        const index = allMaterials.findIndex(m => m.material_id === material.material_id);
        if (index >= 0) {
          allMaterials[index] = updatedMaterial;
        }
      }
    }
  }
  
  // If still missing after polling, throw error to block generation
  if (!allExtracted) {
    const stillMissing = allMaterials.filter(m => 
      m.mime_type?.includes('pdf') && !m.extracted_text
    );
    const stillMissingTitles = stillMissing.map(m => m.title).join(', ');
    throw new Error(
      `No se puede generar planificación solo con materiales: los siguientes PDFs no tienen texto extraído: ${stillMissingTitles}. ` +
      `Por favor, espera a que se complete la extracción o usa el botón "Re-extraer" en la biblioteca de materiales.`
    );
  }
  
  // Re-format materials context with updated extracted_text
  materialsContext = formatMaterialsForAI(allMaterials);
}
```

**Result**: ✅ Materials-only planning/evaluation is blocked until `extracted_text` is available

### E) Re-Extract Button in Materials UI

**File**: `src/components/materials/MaterialsLibraryDialog.tsx`

**Changes**:
1. **Added re-extract button** to `MaterialCard` component:
```typescript
{/* Re-extract button for PDFs */}
{isPDF && (
  <div className="flex-shrink-0">
    <Button
      variant="ghost"
      size="sm"
      onClick={handleReExtract}
      disabled={isExtracting}
      className="h-8 w-8 p-0"
      title={hasExtractedText ? 'Re-extraer texto' : 'Extraer texto'}
    >
      {isExtracting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
    </Button>
  </div>
)}
```

2. **Added extraction status badge**:
```typescript
{/* PDF extraction status */}
{isPDF && (
  <div className="flex items-center gap-2 mt-2">
    {hasExtractedText ? (
      <Badge variant="outline" className="text-xs text-green-600">
        Texto extraído
      </Badge>
    ) : (
      <Badge variant="outline" className="text-xs text-amber-600">
        Sin texto extraído
      </Badge>
    )}
  </div>
)}
```

3. **Re-extract handler**:
```typescript
const handleReExtract = async (e: React.MouseEvent) => {
  e.stopPropagation(); // Prevent card selection
  
  if (!isPDF) {
    toast({
      title: 'No es un PDF',
      description: 'Solo los archivos PDF pueden tener texto extraído',
      variant: 'destructive'
    });
    return;
  }

  setIsExtracting(true);
  try {
    const { extractMaterialText } = await import('@/services/materials');
    const result = await extractMaterialText(material.id);
    
    if (result.success) {
      toast({
        title: 'Texto extraído',
        description: `Se extrajeron ${result.extractedChars} caracteres del PDF`,
      });
      // Invalidate queries to refresh material data
      queryClient.invalidateQueries({ queryKey: materialsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: materialsKeys.detail(material.id) });
    } else {
      toast({
        title: 'Error al extraer texto',
        description: result.error || 'No se pudo extraer texto del PDF',
        variant: 'destructive'
      });
    }
  } catch (error) {
    console.error('[MaterialCard] Re-extract error:', error);
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Error inesperado',
      variant: 'destructive'
    });
  } finally {
    setIsExtracting(false);
  }
};
```

**Result**: ✅ Users can manually trigger extraction for PDFs that failed or were uploaded before extraction was implemented

### F) Verification of storage_path

**Status**: ✅ Verified

**Evidence**:
- `src/hooks/useMaterials.ts` line 296: `storage_path: uploadResult.storagePath!` is always set
- `src/services/materials/storage.ts` line 84: `storagePath: data.path` is returned from upload
- Edge function validates `storage_path` exists before download (line 175)

**Result**: ✅ `storage_path` is always set when material is created

## Files Changed

### New Files
- `src/utils/pollExtractedText.ts` - Polling utility for extracted_text

### Edge Functions
- `supabase/functions/extract-material-text/index.ts`
  - Robust JSON parsing with BOM removal
  - Enhanced logging (user id, material id, storage_path, download result, extractedChars, update result)
  - Returns 400 (not 500) for parse errors
  - Fallback to query parameter

### Frontend Services
- `src/services/materials/materials.ts`
  - Enhanced error messages with details

### Frontend Pages
- `src/pages/PlanificacionWizard.tsx`
  - Blocking guard for materials-only planning
  - Polling for extracted_text
  - Auto-trigger extraction if missing

- `src/pages/PlanificacionWorkspace.tsx`
  - Blocking guard for materials-only regeneration
  - Polling for extracted_text
  - Auto-trigger extraction if missing

### Frontend Services
- `src/services/evaluations/sessionDigests.ts`
  - Blocking guard for materials-only evaluation
  - Throws error if PDFs lack extracted_text

### Frontend Components
- `src/components/materials/MaterialsLibraryDialog.tsx`
  - Re-extract button in MaterialCard
  - Extraction status badge
  - Query invalidation after extraction

## Deployment

**Command**:
```bash
supabase functions deploy extract-material-text --no-verify-jwt
```

**Status**: ✅ Deployed successfully

## Manual Verification Steps

### 1. Upload PDF and Verify Extraction

**Steps**:
1. Go to Biblioteca de Materiales
2. Upload a PDF file
3. Check Network tab → should see call to `extract-material-text` with 200 status
4. Wait 5-10 seconds
5. Check material card → should show "Texto extraído" badge
6. Run SQL:
   ```sql
   SELECT 
     id, 
     title, 
     mime_type,
     extracted_text IS NOT NULL AS has_text,
     length(extracted_text) AS chars,
     storage_path IS NOT NULL AS has_storage_path
   FROM public.teacher_materials
   WHERE id = '<materialId>';
   ```

**Expected**:
- `has_text = true`
- `chars > 0` (typically 100-10000)
- `has_storage_path = true`

**Evidence**: SQL output showing `has_text=true` and `chars > 0`

### 2. Re-Extract Button

**Steps**:
1. Go to Biblioteca de Materiales
2. Find a PDF material
3. Click re-extract button (RefreshCw icon)
4. Wait for extraction to complete
5. Verify toast shows success with character count
6. Verify badge updates to "Texto extraído"

**Expected**: Button triggers extraction, shows progress, updates UI

**Evidence**: Screenshot of button + toast notification

### 3. Materials-Only Planning Blocking

**Steps**:
1. Create new planning with NO ANEP content
2. Attach a PDF material (ensure `extracted_text` is NULL)
3. Try to generate class plan
4. **Expected**: Error message blocking generation:
   ```
   No se puede generar planificación solo con materiales: los siguientes PDFs no tienen texto extraído: [material title]. 
   Por favor, espera a que se complete la extracción o usa el botón "Re-extraer" en la biblioteca de materiales.
   ```
5. Click re-extract button in materials library
6. Wait for extraction
7. Try generating again
8. **Expected**: Generation succeeds and plan mentions specific PDF terms

**Evidence**: 
- Error message screenshot
- Console logs showing polling attempts
- Generated plan HTML snippet with specific terms

### 4. Materials-Only Planning Success

**Steps**:
1. Upload PDF about specific topic (e.g., "Batllismo")
2. Wait for extraction to complete (verify `has_text=true` in SQL)
3. Create planning with NO ANEP content
4. Attach the PDF material
5. Generate class plan
6. Check generated HTML

**Expected**:
- Plan mentions at least 3 specific terms from `extracted_text` (e.g., "Batllismo", "Ley de 8 horas", "José Batlle y Ordóñez")
- Plan title (H1) is specific to material topic
- NOT generic placeholder

**Evidence**: 
- Generated plan HTML snippet
- SQL showing `extracted_text` contains the terms
- Network payload showing `materialsContext` includes extracted text snippet

### 5. Materials-Only Evaluation Blocking

**Steps**:
1. Go to Evaluaciones
2. Select group
3. Do NOT select ANEP content
4. Do NOT select sessions
5. Attach PDF material (ensure `extracted_text` is NULL)
6. Try to generate evaluation
7. **Expected**: Error message blocking generation

**Evidence**: Error message screenshot

### 6. Evaluation with Materials (Success)

**Steps**:
1. Upload PDF and wait for extraction
2. Create evaluation with materials attached
3. Generate evaluation
4. **Expected**: Evaluation references PDF content

**Evidence**: Generated evaluation snippet

## SQL Queries for Verification

### Check Extraction Status
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
WHERE deleted_at IS NULL
  AND mime_type LIKE '%pdf%'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Output Example**:
```
id                                   | title              | mime_type        | has_text | chars  | has_storage_path | created_at
-------------------------------------|--------------------|------------------|----------|--------|------------------|------------------
abc-123-def-456                      | Batllismo.pdf      | application/pdf  | true     | 3456   | true             | 2026-01-30 10:00:00
```

### Verify Planning Uses Extracted Text
```sql
-- Get latest session with materials
SELECT 
  sc.id,
  sc.titulo,
  sc.plan_desarrollo->>'html_completo' AS html_preview
FROM public.sesiones_clase sc
WHERE sc.plan_desarrollo IS NOT NULL
ORDER BY sc.created_at DESC
LIMIT 5;
```

**Expected**: HTML should contain specific terms from attached materials' `extracted_text`

### Check Evaluation Reports
```sql
SELECT 
  id,
  nombre,
  ai_design_report IS NOT NULL AS has_report,
  direct_material_ids
FROM public.evaluaciones
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: `has_report = true` and `direct_material_ids` contains material IDs

## Curl Command for Testing Extraction

**Command**:
```bash
curl -X POST "https://srlrbuphsogwgymqywhe.supabase.co/functions/v1/extract-material-text" \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"materialId":"<uuid>"}'
```

**Expected Response** (200 OK):
```json
{
  "ok": true,
  "extractedChars": 1234,
  "pagesProcessed": 3
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "Invalid JSON body",
  "details": "Expected property name or '}' in JSON at position 1",
  "received": "..."
}
```

## Network Payload Verification

### Planning Generation Payload

**Expected** (materials-only mode):
```json
{
  "modo": "generar_plan_html",
  "contenidos": [],
  "materialsContext": "MATERIALES ADJUNTOS:\n\nMaterial: Batllismo.pdf\n   Contenido extraído del PDF: [first 2000 chars of extracted_text]..."
}
```

**NOT Expected**:
```json
{
  "contenidos": [""],
  "materialsContext": "...Nota: Este material es un PDF pero aún no se ha extraído el texto."
}
```

## Remaining Limitations

1. **Extraction Timing**: Extraction happens asynchronously. If user generates planning immediately after upload, system will poll for up to 10 seconds. If extraction takes longer, generation will be blocked with error message.

2. **PDFs Without Text Layer**: Some PDFs (image-only, scanned) may have no extractable text. Function returns success with `extractedChars: 0`, but planning will still be blocked (empty extracted_text = no text).

3. **Polling Timeout**: 10-second timeout may not be enough for very large PDFs. **Workaround**: User can use re-extract button and wait, then retry generation.

4. **Multiple PDFs**: If multiple PDFs lack extracted_text, system polls all of them sequentially. This may take up to 10 seconds per PDF. **Future**: Parallel polling or longer timeout.

## Next Steps (If Issues Persist)

1. **If extraction still fails**:
   - Check function logs in Supabase Dashboard
   - Verify `SUPABASE_ANON_KEY` is set correctly
   - Check Authorization header format: `Bearer <token>`
   - Verify PDF is not encrypted/corrupted
   - Check `storage_path` exists in DB

2. **If planning still generic**:
   - Verify `extracted_text` is populated in DB (SQL query)
   - Check `materialsContext` in Network payload includes extracted text
   - Verify Edge Function prompt includes "materials-only mode" instructions
   - Check blocking guard is working (should see error message)

3. **If blocking doesn't work**:
   - Check browser console for error messages
   - Verify `materialsWithoutText` array is populated
   - Check polling logs in console
   - Verify `pollExtractedText` function is imported correctly

## Git Commit

```bash
git add -A
git commit -m "fix(extraction): robust JSON parsing, blocking guard, re-extract button, polling"
```

---

**Commit**: `git log -1 --oneline`  
**Status**: ✅ All fixes implemented and deployed, ready for verification
