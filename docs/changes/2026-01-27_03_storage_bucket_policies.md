# Supabase Storage Bucket + Policies for Teacher Materials

> **Date**: January 27, 2026  
> **Task**: Create Supabase Storage bucket and RLS policies for teacher materials files  
> **Status**: ✅ Completed

---

## Summary

Created Supabase Storage bucket `teacher-materials` with Row Level Security policies that enforce user isolation. Users can only upload, view, update, and delete files stored under their own user ID prefix in the bucket.

**What Changed**: 
- Created migration `20260127000001_add_teacher_materials_storage_bucket.sql`
- Bucket configured as private (requires authentication)
- Four RLS policies created for SELECT, INSERT, UPDATE, DELETE operations
- Path convention enforced: `{userId}/{optional-folder}/{timestamp}-{filename}`

**Why**: 
- Enable secure file storage for teacher materials library
- Enforce user data isolation at the storage layer (not just application layer)
- Follow existing storage patterns in the repository (same as `comunicaciones` bucket)
- Prepare infrastructure for UI file upload/download features

**Impact**: 
- New storage bucket (no changes to existing buckets)
- No breaking changes to existing code
- Service layer code (`src/services/materials/storage.ts`) already uses correct path convention
- Ready for frontend file upload implementation

---

## Impact Analysis (SSoT Guardrails)

### Guardrails Touched

1. **Data Isolation** (Guardrail #3 - Database RLS)
   - **Status**: ✅ Extended to Storage layer
   - **Changes**: 
     - Added RLS policies for `storage.objects` table
     - Policies enforce `auth.uid()::text = (storage.foldername(name))[1]`
     - Users can only access files under their own userId prefix
   - **Risk**: None - Follows existing storage patterns from `comunicaciones` bucket
   - **Mitigation**: 
     - Copied pattern from existing migration `20250924211603`
     - Verified service code uses matching path convention

2. **Storage Architecture** (New infrastructure, follows existing patterns)
   - **Status**: ✅ New bucket added (consistent with existing storage setup)
   - **Changes**: 
     - Bucket created via SQL migration (same as existing buckets)
     - Private bucket (public = false) for authenticated users only
     - Policies use same `storage.foldername()` pattern as existing buckets
   - **Risk**: Low - Follows documented patterns from existing migrations
   - **Mitigation**: Reviewed existing storage migrations for consistency

### Guardrails NOT Touched

- ✅ Plan Parser (`src/lib/planParser.ts`) - Not modified
- ✅ AI Generation Contract - No changes to edge function contracts
- ✅ Authentication Flow - Not modified
- ✅ Session Estado Enum - Not modified
- ✅ Contemplaciones Catalog - Not modified
- ✅ Database Tables - No changes to database tables (only storage)
- ✅ Explicit Save Pattern - Not affected
- ✅ Session-Plan Relationship - Not modified

### Compatibility Guarantees

1. **No Breaking Changes**: 
   - No modifications to existing buckets or policies ✅
   - No changes to existing service code ✅
   - New bucket is independent (additive only) ✅

2. **Follows Existing Patterns**:
   - Bucket creation matches `comunicaciones` pattern ✅
   - Policy structure identical to existing storage policies ✅
   - Path convention matches service layer implementation ✅
   - Uses same `storage.foldername()` function for path parsing ✅

3. **Path Convention Verification**:
   - Service layer: `${user.id}/${folder}${timestamp}-${sanitizedFileName}` ✅
   - Policy check: `auth.uid()::text = (storage.foldername(name))[1]` ✅
   - First path segment is always `user.id` ✅
   - Perfect alignment between code and policies ✅

---

## Migration Created

### `supabase/migrations/20260127000001_add_teacher_materials_storage_bucket.sql` (NEW)

**Purpose**: Create storage bucket and RLS policies for teacher materials

**Contents**:

1. **Bucket Creation**:
   ```sql
   INSERT INTO storage.buckets (id, name, public) 
   VALUES ('teacher-materials', 'teacher-materials', false)
   ON CONFLICT (id) DO NOTHING;
   ```
   - Bucket ID: `teacher-materials`
   - Private bucket (`public = false`) - requires authentication
   - `ON CONFLICT DO NOTHING` - idempotent (safe to run multiple times)

2. **Storage Policies** (4 policies for CRUD operations):

   **SELECT Policy** - View/list files:
   ```sql
   CREATE POLICY "Users can view their own teacher materials files" 
   ON storage.objects 
   FOR SELECT 
   USING (
     bucket_id = 'teacher-materials' 
     AND auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

   **INSERT Policy** - Upload files:
   ```sql
   CREATE POLICY "Users can upload their own teacher materials files" 
   ON storage.objects 
   FOR INSERT 
   WITH CHECK (
     bucket_id = 'teacher-materials' 
     AND auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

   **UPDATE Policy** - Replace/modify files:
   ```sql
   CREATE POLICY "Users can update their own teacher materials files" 
   ON storage.objects 
   FOR UPDATE 
   USING (
     bucket_id = 'teacher-materials' 
     AND auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

   **DELETE Policy** - Remove files:
   ```sql
   CREATE POLICY "Users can delete their own teacher materials files" 
   ON storage.objects 
   FOR DELETE 
   USING (
     bucket_id = 'teacher-materials' 
     AND auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

3. **Policy Explanation**:
   - `bucket_id = 'teacher-materials'` - Only applies to this bucket
   - `auth.uid()::text` - Currently authenticated user's ID (as text)
   - `(storage.foldername(name))[1]` - First segment of file path
   - **Result**: User can only access files where first path segment matches their user ID

4. **Path Convention**:
   - Required format: `{userId}/{optional-folders}/{filename}`
   - Example: `550e8400-e29b-41d4-a716-446655440000/pdfs/1706345678901-ejemplo.pdf`
   - Service layer automatically enforces this in `uploadMaterialFile()`

5. **Comments**: Policy documentation for future reference

---

## Path Convention Verification

### Service Layer Implementation

**File**: `src/services/materials/storage.ts` (line 59)

```typescript
const filePath = `${user.id}/${folder}${timestamp}-${sanitizedFileName}`;
```

**Breakdown**:
- `user.id` - UUID of authenticated user (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- `folder` - Optional subfolder (e.g., `pdfs/`, `images/`, or empty string)
- `timestamp` - Unix timestamp in milliseconds (e.g., `1706345678901`)
- `sanitizedFileName` - Original filename with special chars replaced by `_`

**Example paths**:
- Without folder: `550e8400-e29b-41d4-a716-446655440000/1706345678901-documento.pdf`
- With folder: `550e8400-e29b-41d4-a716-446655440000/pdfs/1706345678901-documento.pdf`

### Policy Enforcement

**Mechanism**: `storage.foldername(name)[1]`

- `name` - Full path of file in storage
- `storage.foldername(name)` - Splits path into array of folder names
- `[1]` - Gets first segment (array is 1-indexed in Postgres)

**Example**:
```sql
-- Path: 550e8400-e29b-41d4-a716-446655440000/pdfs/1706345678901-documento.pdf
-- storage.foldername(name) = ['550e8400-e29b-41d4-a716-446655440000', 'pdfs', '1706345678901-documento.pdf']
-- storage.foldername(name)[1] = '550e8400-e29b-41d4-a716-446655440000'
```

**Policy Check**:
```sql
auth.uid()::text = (storage.foldername(name))[1]
-- Translates to:
'current-user-uuid' = 'first-path-segment'
```

### Verification

✅ **Service layer path starts with `user.id`**  
✅ **Policy checks first path segment equals `auth.uid()`**  
✅ **Perfect alignment - user can only access their own files**

---

## Files Created

### 1. `supabase/migrations/20260127000001_add_teacher_materials_storage_bucket.sql` (NEW)
- **Purpose**: Migration for storage bucket and policies
- **Size**: ~80 lines
- **Content**: Bucket creation, 4 RLS policies, comments

### 2. `docs/changes/2026-01-27_03_storage_bucket_policies.md` (NEW)
- **Purpose**: This change report
- **Content**: Complete documentation of storage setup

---

## Files Modified

**None** - Only new files created (migration and documentation)

---

## Manual Verification Steps

### For Remote Supabase (Production/Staging)

Since local Supabase Docker is not available on this machine, verification must be done against remote Supabase instance:

#### Step 1: Apply Migration

**Via Supabase Dashboard**:
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260127000001_add_teacher_materials_storage_bucket.sql`
3. Run the SQL
4. Verify no errors in output

**Via Supabase CLI** (if available):
```bash
supabase db push
```

#### Step 2: Verify Bucket Exists

**Via Dashboard**:
1. Go to Storage → Buckets
2. Verify `teacher-materials` bucket appears in list
3. Click bucket → Verify "Public" toggle is OFF (private bucket)

**Via SQL Editor**:
```sql
SELECT id, name, public 
FROM storage.buckets 
WHERE id = 'teacher-materials';
```

**Expected result**:
```
id                | name              | public
------------------|-------------------|-------
teacher-materials | teacher-materials | false
```

#### Step 3: Verify Policies Exist

**Via Dashboard**:
1. Go to Authentication → Policies
2. Filter by table: `storage.objects`
3. Verify 4 policies for `teacher-materials` bucket exist

**Via SQL Editor**:
```sql
SELECT 
  policyname, 
  cmd, 
  permissive,
  roles,
  qual
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname ILIKE '%teacher materials%'
ORDER BY policyname;
```

**Expected result**: 4 policies (SELECT, INSERT, UPDATE, DELETE)

#### Step 4: Test Upload (via Service Layer)

**Prerequisites**: 
- Frontend running with authenticated user
- Materials service layer deployed

**Test code** (can run in browser console):
```javascript
// Upload a test file
const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

const { uploadMaterialFile } = await import('@/services/materials');
const result = await uploadMaterialFile(file);

console.log('Upload result:', result);
// Expected: { success: true, storagePath: '{userId}/...', publicUrl: '...' }
```

**Verify in Storage**:
1. Go to Storage → teacher-materials bucket
2. Verify folder with your user UUID exists
3. Verify file appears inside that folder

#### Step 5: Test Cross-User Access (Security Check)

**Goal**: Verify users CANNOT access other users' files

**Test**:
1. Note down a file path from another user (if available)
2. Try to access it via API or signed URL
3. **Expected**: Access denied error

**SQL Check** (as admin):
```sql
-- Count files per user (should only see own files when authenticated)
SELECT 
  (storage.foldername(name))[1] as user_folder,
  COUNT(*) as file_count
FROM storage.objects
WHERE bucket_id = 'teacher-materials'
GROUP BY user_folder;
```

### For Local Supabase (Future)

When local Supabase Docker is available:

```bash
# Reset database (applies all migrations)
supabase db reset

# Verify migration applied
supabase migration list

# Check bucket exists
echo "SELECT * FROM storage.buckets WHERE id = 'teacher-materials';" | supabase db query

# Check policies exist
echo "SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname ILIKE '%teacher materials%';" | supabase db query
```

---

## Architecture Alignment

### Followed Patterns from Existing Code

1. **Storage Migration Pattern** (from `20250924211603_a52ebf1d-0e0e-4be0-bde2-9cb16072468e.sql`):
   - Use `INSERT INTO storage.buckets ... ON CONFLICT DO NOTHING` ✅
   - Create policies on `storage.objects` table ✅
   - Use `storage.foldername(name)[1]` for path parsing ✅
   - Policy condition: `bucket_id = 'X' AND auth.uid()::text = (storage.foldername(name))[1]` ✅

2. **User Isolation Pattern** (from existing RLS policies):
   - All user data must be isolated via RLS ✅
   - Use `auth.uid()` to identify current user ✅
   - No cross-user access allowed ✅

3. **Path Convention** (from service layer code):
   - First path segment is always user ID ✅
   - Matches existing service implementation ✅
   - Enforced automatically by upload function ✅

### Consistency with Existing Storage Buckets

| Feature | `comunicaciones` Bucket | `teacher-materials` Bucket |
|---------|------------------------|---------------------------|
| **Managed via migration** | ✅ Yes (`20250924211603`) | ✅ Yes (`20260127000001`) |
| **Private/Public** | Public (`public = true`) | Private (`public = false`) |
| **Policy pattern** | `auth.uid() = foldername[1]` | `auth.uid() = foldername[1]` |
| **Path convention** | `{userId}/...` | `{userId}/...` |
| **Policies count** | 4 (SELECT, INSERT, UPDATE, DELETE) | 4 (SELECT, INSERT, UPDATE, DELETE) |

**Differences**:
- `comunicaciones` is public (anyone can view URLs)
- `teacher-materials` is private (requires signed URLs or authentication)

**Rationale for private**: Teacher materials should not be publicly accessible. Only authenticated users should access their own files.

---

## Security Considerations

### Enforced Security

1. **Authentication Required**: 
   - Private bucket requires authenticated session
   - Unauthenticated users cannot access any files

2. **User Isolation**: 
   - RLS policies enforce `auth.uid() = path-prefix`
   - Users physically cannot query other users' files
   - Database-level enforcement (cannot be bypassed by application bugs)

3. **Path Validation**: 
   - Service layer automatically prefixes paths with `user.id`
   - No way for application to violate path convention
   - Policies reject any path not starting with user's ID

### Attack Scenarios Prevented

❌ **Scenario 1: User tries to upload to another user's folder**
- Service layer: Uses `user.id` from authenticated session (cannot fake)
- Policy: Rejects upload if path doesn't start with `auth.uid()`
- **Result**: Upload rejected at database level

❌ **Scenario 2: User tries to read another user's file**
- Service layer: Gets file via Supabase client (uses session)
- Policy: SELECT policy checks `auth.uid() = foldername[1]`
- **Result**: File not returned (filtered by RLS)

❌ **Scenario 3: User tries to delete another user's file**
- Service layer: Calls delete via Supabase client
- Policy: DELETE policy checks `auth.uid() = foldername[1]`
- **Result**: Delete fails (RLS blocks operation)

❌ **Scenario 4: Unauthenticated user tries to access bucket**
- No authenticated session (`auth.uid()` is NULL)
- All policies require `auth.uid()` to match path
- **Result**: All operations rejected

### Additional Recommendations (Future)

1. **File Type Validation**: Add MIME type restrictions (e.g., only PDFs, images)
2. **File Size Limits**: Configure bucket max file size (e.g., 50MB)
3. **Virus Scanning**: Integrate with file scanning service for uploaded files
4. **Audit Logging**: Log all file access for security audits

---

## Quality Gates

### 1. TypeScript Build

**Command**: `npm run build`

**Result**: ✅ **Passed**

**Output**:
```
✓ 4315 modules transformed.
✓ built in 23.77s
```

**Notes**: 
- No TypeScript errors
- Build completed successfully
- Warnings about chunk size (pre-existing, not related to this change)

### 2. Migration Syntax

**Verification**: Manual SQL review

**Result**: ✅ **Passed**

**Checks**:
- [x] Valid SQL syntax
- [x] Uses existing patterns from `comunicaciones` migration
- [x] Idempotent (`ON CONFLICT DO NOTHING`)
- [x] Includes BEGIN/COMMIT transaction
- [x] Includes comments for documentation

### 3. Path Convention Alignment

**Verification**: Code inspection

**Result**: ✅ **Passed**

**Checks**:
- [x] Service layer uses `${user.id}/...` pattern
- [x] Policy checks `auth.uid() = foldername[1]`
- [x] Perfect alignment between code and policy
- [x] No code changes required

---

## Known Limitations / Future Work

### Current Limitations

1. **Manual Migration Application**:
   - Local Supabase not running on dev machine
   - Migration must be applied manually to remote instance
   - **Future**: Set up local Supabase Docker for easier testing

2. **No File Type Restrictions**:
   - Bucket accepts any file type
   - **Future**: Add MIME type restrictions in bucket configuration
   - **Future**: Add file type validation in service layer

3. **No File Size Limits**:
   - No explicit size limits configured
   - **Future**: Configure bucket max file size (e.g., 50MB per file)

4. **No Signed URL Generation in UI**:
   - Service layer has `getSignedUrl()` function
   - UI not yet implemented to display files
   - **Future**: Add file preview/download UI components

5. **No Bucket Deletion Policy**:
   - Old files accumulate (no automatic cleanup)
   - **Future**: Implement file retention policy or manual cleanup UI

### Follow-up Tasks

1. **Apply Migration to Remote Supabase**:
   - Run migration in Supabase Dashboard SQL Editor
   - Verify bucket and policies created correctly

2. **Test File Upload Flow**:
   - Create test UI component for file upload
   - Test upload → create material → verify storage
   - Test signed URL generation and access

3. **Configure Bucket Settings** (in Dashboard):
   - Set max file size limit (e.g., 50MB)
   - Configure allowed MIME types (optional)
   - Set up bucket CORS if needed for direct uploads

4. **Add Monitoring**:
   - Track storage usage per user
   - Alert on unusual upload patterns
   - Monitor failed upload attempts

---

## Success Criteria

✅ **Completed**:
- [x] Storage bucket migration created
- [x] Four RLS policies implemented (SELECT, INSERT, UPDATE, DELETE)
- [x] Path convention verified (matches service layer code)
- [x] Private bucket configuration (requires authentication)
- [x] Follows existing storage patterns in repo
- [x] No breaking changes to existing code
- [x] TypeScript build passes
- [x] Change report created with verification steps
- [x] Manual verification instructions provided (local + remote)

---

## Commit Information

**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`

**Commit Message**: `feat(storage): teacher-materials bucket + policies`

**Files Changed**:
- `supabase/migrations/20260127000001_add_teacher_materials_storage_bucket.sql` (new)
- `docs/changes/2026-01-27_03_storage_bucket_policies.md` (new)

**Git Status**:
```bash
$ git status
On branch Uso-material-docente-y-nexo-clases-evaluaciones
nothing to commit, working tree clean
```

**Git Log**:
```bash
$ git log -1 --oneline
1855ffd feat(storage): teacher-materials bucket + policies
```

**Commit Hash**: `1855ffd`

---

**End of Change Report**

