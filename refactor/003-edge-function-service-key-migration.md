# Edge Function Service Key Migration (2025-12-09)

## Session Summary

**Date:** 2025-12-09  
**Objective:** Migrate edge functions from using `SUPABASE_SERVICE_ROLE_KEY` to `SERVICE_ROLE_KEY` due to Supabase's reserved namespace restrictions.

---

## Background

Supabase reserves the `SUPABASE_*` prefix for system-managed environment variables. Custom secrets must use different names. The project's service role key has been configured in the Supabase Dashboard under Edge Function Secrets as:

- **Secret Name:** `SERVICE_ROLE_KEY`
- **Value:** `sb_secret_...` (current service role key from Dashboard → Project Settings → API)

Frontend environment variables remain unchanged:
- `VITE_SUPABASE_URL=https://srlrbuphsogwgymqywhe.supabase.co`
- `VITE_SUPABASE_ANON_KEY=sb_publishable_...` (anon public key)

---

## Code Changes Made

### Files Modified

#### 1. `supabase/functions/ensure-demo-users/index.ts`

**Change:** Line 17-18

**Before:**
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
```

**After:**
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
// Note: Using SERVICE_ROLE_KEY instead of SUPABASE_SERVICE_ROLE_KEY
// because Supabase reserves the SUPABASE_* prefix for system secrets
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;
```

**Rationale:** Updated to read from `SERVICE_ROLE_KEY` which is now configured in Supabase Dashboard. Added comment explaining the naming constraint.

---

#### 2. `supabase/functions/modify-evaluation/index.ts`

**Change:** Lines 7-10

**Before:**
```typescript
// Initialize Supabase client for image rehosting
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

**After:**
```typescript
// Initialize Supabase client for image rehosting
// Note: Using SERVICE_ROLE_KEY instead of SUPABASE_SERVICE_ROLE_KEY
// because Supabase reserves the SUPABASE_* prefix for system secrets
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

**Rationale:** Same as above. This function uses the admin client for image rehosting to Supabase Storage.

---

### Files Checked (No Changes Needed)

- ✅ `supabase/functions/generate-bulletin-text/index.ts` - Only uses OpenAI API, no Supabase admin client
- ✅ `supabase/functions/generate-plan-completo/index.ts` - Only uses OpenAI API, no Supabase admin client

---

## Deployment Instructions

### Step 1: Verify Supabase CLI is Installed

```bash
# Check if Supabase CLI is available
supabase --version

# If not installed, install it:
npm install -g supabase
```

### Step 2: Login to Supabase (if not already logged in)

```bash
supabase login
```

### Step 3: Link to the Project

```bash
# From repo root
supabase link --project-ref srlrbuphsogwgymqywhe
```

### Step 4: Deploy Updated Functions

Deploy both modified functions:

```bash
# Deploy ensure-demo-users
supabase functions deploy ensure-demo-users

# Deploy modify-evaluation
supabase functions deploy modify-evaluation
```

**Expected Output:**
```
Deploying function ensure-demo-users...
✓ Function deployed successfully
Function URL: https://srlrbuphsogwgymqywhe.supabase.co/functions/v1/ensure-demo-users
```

### Alternative: Deploy All Functions

If you prefer to deploy all functions at once:

```bash
supabase functions deploy
```

---

## Validation: cURL Tests

### Test 1: Auth Token with Anon Key

**Purpose:** Verify the anon key works for password grant authentication.

**Command:**
```bash
curl -X POST "https://srlrbuphsogwgymqywhe.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: sb_publishable_YOUR_ANON_KEY_HERE" \
  -H "Authorization: Bearer sb_publishable_YOUR_ANON_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo.teacher@example.com",
    "password": "DemoPassword2024!"
  }'
```

**Expected Success Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": {
    "id": "...",
    "email": "demo.teacher@example.com",
    "email_confirmed_at": "...",
    ...
  }
}
```

**Failure Scenarios:**
- `401 "Legacy API keys are disabled"` → Anon key is outdated, get new one from Dashboard
- `401 "Invalid login credentials"` → Demo user doesn't exist yet, run Test 2 first
- `400 "Invalid email or password"` → Check credentials match exactly

---

### Test 2: Ensure Demo Users Function

**Purpose:** Test the Edge Function with the new `SERVICE_ROLE_KEY` configuration.

**Command:**
```bash
curl -X POST "https://srlrbuphsogwgymqywhe.supabase.co/functions/v1/ensure-demo-users" \
  -H "apikey: sb_publishable_YOUR_ANON_KEY_HERE" \
  -H "Authorization: Bearer sb_publishable_YOUR_ANON_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Demo users ensured"
}
```

**Failure Scenarios:**
- `500 "Failed to list users"` → `SERVICE_ROLE_KEY` not set or invalid in Supabase Dashboard
- `500 "Internal server error"` → Check function logs in Supabase Dashboard
- `403 Forbidden` → Service key doesn't have admin permissions
- `404 Not Found` → Function not deployed or URL incorrect

**How to check function logs:**
1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Click on `ensure-demo-users`
4. View "Logs" tab for detailed error messages

---

### Test 3: Service Role Key Direct Validation (Optional, Secure Environment Only)

**⚠️ WARNING:** Only run this test from a secure, trusted environment. Never expose service role key in browser or shared systems.

**Purpose:** Confirm the `SERVICE_ROLE_KEY` has admin permissions.

**Command:**
```bash
curl -X GET "https://srlrbuphsogwgymqywhe.supabase.co/auth/v1/admin/users?page=1&per_page=5" \
  -H "apikey: sb_secret_YOUR_SERVICE_ROLE_KEY_HERE" \
  -H "Authorization: Bearer sb_secret_YOUR_SERVICE_ROLE_KEY_HERE" \
  -H "Content-Type: application/json"
```

**Expected Success Response (200 OK):**
```json
{
  "users": [
    {
      "id": "...",
      "email": "demo.teacher@example.com",
      ...
    }
  ],
  "aud": "authenticated"
}
```

**Interpretation:**
- ✅ Success → Service key is valid and has admin access
- ❌ 401/403 → Service key is invalid or doesn't have admin permissions
- ❌ 404 → Incorrect URL or project

---

## Test Results

### Pre-Deployment Status
- Frontend `.env` updated with current anon key: ✅
- `SERVICE_ROLE_KEY` configured in Supabase Dashboard: ✅
- Code updated in 2 edge functions: ✅

### Post-Deployment Tests

**Test 1: Auth Token (Anon Key)**
```
Status: [PENDING - Run after deployment]
Response: 
Notes: 
```

**Test 2: Ensure Demo Users Function**
```
Status: [PENDING - Run after deployment]
Response: 
Notes: 
```

**Test 3: Service Key Direct (Optional)**
```
Status: [PENDING - Run after deployment]
Response: 
Notes: 
```

### Frontend Verification

**Steps:**
1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. Check browser console for Supabase client logs:
   ```
   [Supabase Client] URL: https://srlrbuphsogwgymqywhe.supabase.co
   [Supabase Client] ANON length: [should be 100+]
   [Supabase Client] ANON prefix: sb_publishable_...
   ```
4. Test demo login flow:
   - Navigate to `/teacher-login`
   - Enter any username/password
   - Verify successful authentication

**Results:**
```
Status: [PENDING - Run after deployment]
Console Output: 
Login Successful: 
Session Created: 
```

---

## Troubleshooting Guide

### Issue: Function Still Returns 500 After Deployment

**Possible Causes:**
1. `SERVICE_ROLE_KEY` not set in Dashboard → Check Dashboard → Edge Functions → Secrets
2. Old function version still cached → Redeploy: `supabase functions deploy ensure-demo-users --no-verify-jwt`
3. Service key value is incorrect → Re-copy from Dashboard → Project Settings → API → service_role

**Debug Steps:**
1. Check function logs in Supabase Dashboard
2. Verify secret is visible in function's "Configuration" tab
3. Try manual redeploy via Dashboard UI
4. Check project is not paused or suspended

---

### Issue: Test 1 Returns "Legacy API keys are disabled"

**Solution:**
1. Go to Dashboard → Project Settings → API
2. Copy the **current** "anon public" key (look for newest key if multiple exist)
3. Update `.env`:
   ```env
   VITE_SUPABASE_ANON_KEY=sb_publishable_NEW_KEY_HERE
   ```
4. Restart dev server: `Ctrl+C` then `npm run dev`
5. Retry Test 1

---

### Issue: Function Logs Show "undefined" for SERVICE_ROLE_KEY

**Solution:**
1. Verify secret name is exactly `SERVICE_ROLE_KEY` (case-sensitive)
2. Re-add secret in Dashboard with correct name
3. Redeploy function: `supabase functions deploy ensure-demo-users`
4. Wait 30-60 seconds for propagation
5. Retry Test 2

---

## Summary Checklist

- [x] Audited all edge functions for `SUPABASE_SERVICE_ROLE_KEY` usage
- [x] Updated 2 functions to use `SERVICE_ROLE_KEY`
- [x] Added explanatory comments in code
- [ ] Deployed updated functions via Supabase CLI
- [ ] Ran Test 1: Auth token with anon key
- [ ] Ran Test 2: Ensure demo users function
- [ ] Verified frontend dev server loads correctly
- [ ] Tested demo login flow end-to-end

---

## Next Steps

1. **Deploy Functions:** Run the deployment commands in Section "Deployment Instructions"
2. **Run Tests:** Execute all 3 cURL tests and document results above
3. **Verify Frontend:** Start dev server and test login flow
4. **Update This Document:** Fill in test results sections with actual outputs
5. **Close Issue:** If all tests pass, mark this migration as complete

---

## Related Documentation

- Previous analysis: `refactor/002-supabase-auth-and-demo-users-debug.md`
- Full codebase investigation: `refactor/001-aulaplus-v0-codebase-investigation.md`
- Supabase connection guide: `docs/supabase-connection-overview.md`

---

## Document Status

**Created:** 2025-12-09  
**Status:** Code Updated - Awaiting Deployment & Testing  
**Author:** AI-assisted refactor (Claude Sonnet 4.5)  
**Next Update:** After deployment and test results

