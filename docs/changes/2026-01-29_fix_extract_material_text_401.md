# Fix: extract-material-text 401 Authentication Error

**Date**: 2026-01-29  
**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Status**: ✅ Completed

## Summary

Fixed critical 401 "Not authenticated" error in `extract-material-text` edge function. The root cause was using `SERVICE_ROLE_KEY` to create the authenticated client, which prevented the Authorization header from being properly validated.

## Root Cause

**Problem**: Edge function was using `SERVICE_ROLE_KEY` to create the authenticated Supabase client:
```typescript
const authSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: { headers: { Authorization: authHeader } }
});
```

**Why it failed**: When using `SERVICE_ROLE_KEY`, Supabase ignores the Authorization header because the service role key has full admin privileges. The client doesn't validate the user's JWT token, causing `auth.getUser()` to fail or return null.

**Impact**: All PDF text extractions failed with 401, preventing `teacher_materials.extracted_text` from being populated.

## Fix Implemented

### A) Use ANON_KEY for User Authentication

**File**: `supabase/functions/extract-material-text/index.ts`

**Changes**:

1. **Added ANON_KEY constant**:
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;
// Service role client for storage and DB operations that need elevated privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

2. **Create user client with ANON_KEY**:
```typescript
// Create authenticated client using ANON_KEY (not service role) so Authorization header is respected
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } }
});

// Get current user - this validates the JWT token
const { data: { user }, error: authError } = await userClient.auth.getUser();
```

3. **Use service role client only for privileged operations**:
   - Storage download (needs elevated privileges)
   - DB update (after ownership verification)

4. **Enhanced error logging**:
```typescript
if (authError || !user) {
  console.error('[extract-material-text] Auth error:', { 
    error: authError?.message, 
    hasUser: !!user,
    authHeaderPresent: !!authHeader 
  });
  return new Response(
    JSON.stringify({ error: 'Not authenticated', details: authError?.message }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

5. **Added DEV mode logging**:
```typescript
// Log user info in DEV mode
if (Deno.env.get('ENVIRONMENT') === 'development' || !Deno.env.get('ENVIRONMENT')) {
  console.log('[extract-material-text] Authenticated user:', { userId: user.id, email: user.email });
  console.log('[extract-material-text] Material found:', { 
    materialId, 
    title: material.title,
    hasStoragePath: !!material.storage_path,
    mimeType: material.mime_type
  });
}
```

6. **Improved storage_path validation**:
```typescript
// Download PDF from storage using service role client (elevated privileges)
if (!material.storage_path) {
  console.error('[extract-material-text] Missing storage_path:', { materialId, material });
  return new Response(
    JSON.stringify({ error: 'Material has no storage path' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

## Security Model

**RLS Isolation Maintained**: 
- User authentication uses `ANON_KEY` + Authorization header (respects RLS)
- Ownership verification: `material.user_id === user.id` (manual check)
- Service role client only used for:
  - Storage download (after ownership verified)
  - DB update (with explicit `user_id` filter for safety)

**Flow**:
1. Extract Authorization header from request
2. Create user client with `ANON_KEY` + Authorization header
3. Validate user JWT via `userClient.auth.getUser()`
4. Fetch material using service role (bypasses RLS for ownership check)
5. Verify ownership: `material.user_id === user.id`
6. Download PDF using service role (elevated privileges)
7. Extract text from PDF
8. Update DB using service role with explicit `user_id` filter

## Verification Steps

### 1. Supabase Function Tester

**Steps**:
1. Go to Supabase Dashboard → Edge Functions → `extract-material-text` → Test
2. **Body**:
   ```json
   {
     "materialId": "<uuid-of-pdf-material>"
   }
   ```
3. **Headers**:
   - `Authorization`: `Bearer <USER_ACCESS_TOKEN>`
   - `apikey`: `<ANON_KEY>`
   - `Content-Type`: `application/json`

4. **Expected**: Status 200 with response:
   ```json
   {
     "ok": true,
     "extractedChars": 1234,
     "pagesProcessed": 3
   }
   ```

### 2. SQL Verification

**Query**:
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

**Expected Results**:
- `has_text = true` for PDFs that have been processed
- `chars > 0` (typically 100-10000 characters depending on PDF content)
- Recent PDFs should have `extracted_text` populated

### 3. Frontend Integration Test

**Steps**:
1. Upload a PDF material via UI
2. Check browser console for extraction logs
3. Check Network tab → should see call to `extract-material-text` with 200 status
4. Wait a few seconds for extraction to complete
5. Refresh materials list
6. Verify material shows extracted text badge/indicator

### 4. Error Cases

**Test 1: Missing Authorization Header**
- **Request**: No `Authorization` header
- **Expected**: 401 with `{ "error": "Missing authorization header" }`

**Test 2: Invalid Token**
- **Request**: `Authorization: Bearer invalid_token`
- **Expected**: 401 with `{ "error": "Not authenticated", "details": "..." }`

**Test 3: Wrong User (Ownership Mismatch)**
- **Request**: Valid token for User A, but `materialId` belongs to User B
- **Expected**: 403 with `{ "error": "Not authorized to extract text from this material" }`

**Test 4: Non-PDF File**
- **Request**: Valid token, but material is not a PDF
- **Expected**: 400 with `{ "error": "Only PDF files can have text extracted" }`

## Files Changed

- `supabase/functions/extract-material-text/index.ts`
  - Changed authentication client from `SERVICE_ROLE_KEY` to `ANON_KEY`
  - Added explicit `SUPABASE_ANON_KEY` environment variable
  - Enhanced error logging
  - Added DEV mode logging
  - Improved storage_path validation

## Deployment

**Command**:
```bash
supabase functions deploy extract-material-text --no-verify-jwt
```

**Status**: ✅ Deployed successfully

**Note**: The `--no-verify-jwt` flag is used because we're handling JWT verification manually in the function code.

## Environment Variables Required

The edge function requires these environment variables (set in Supabase Dashboard):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Anon/public key (for user authentication)
- `SERVICE_ROLE_KEY` - Service role key (for storage and DB operations)

## Remaining Limitations

1. **Extraction Timing**: Extraction happens asynchronously after upload. If user generates planning immediately, `extracted_text` may still be NULL. **Workaround**: Retry logic in frontend helps, but user may need to wait a few seconds.

2. **PDF Parsing Errors**: Some PDFs may fail to parse (encrypted, corrupted, image-only). **Workaround**: Error is logged and returned to frontend, user can re-upload or use manual text entry.

3. **Storage Path Issues**: If `storage_path` is missing or incorrect, extraction will fail. **Workaround**: Validation added, but upstream issue (upload) needs to be fixed.

## Next Steps (If Issues Persist)

1. **If still getting 401**:
   - Check Supabase Dashboard → Edge Functions → `extract-material-text` → Logs
   - Verify `SUPABASE_ANON_KEY` is set correctly
   - Verify Authorization header format: `Bearer <token>` (not just `<token>`)
   - Check if JWT token is expired

2. **If extraction succeeds but `extracted_text` is NULL**:
   - Check DB update logs in function logs
   - Verify RLS policies allow UPDATE on `teacher_materials.extracted_text`
   - Check if `user_id` filter in update query is working

3. **If PDF parsing fails**:
   - Check function logs for parsing errors
   - Verify PDF is not encrypted or corrupted
   - Try with a different PDF to isolate issue

## Git Commit

```bash
git add -A
git commit -m "fix(extract-material-text): use ANON_KEY for auth, fix 401 error"
```

---

**Commit**: `910bea4 fix(extract-material-text): use ANON_KEY for auth, fix 401 error`  
**Status**: ✅ Fix implemented and deployed, ready for verification
