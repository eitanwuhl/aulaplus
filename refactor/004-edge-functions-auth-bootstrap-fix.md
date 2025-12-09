# Edge Functions Auth Bootstrap Fix (2025-12-09)

## Session Summary

**Date:** 2025-12-09  
**Issue:** `ensure-demo-users` Edge Function returns 401 "Missing authorization header" when called on app mount  
**Root Cause:** Function requires JWT verification, but it's invoked BEFORE user authentication exists  
**Solution:** Disable JWT verification for this bootstrap/admin function via `config.toml`

---

## Problem Analysis

### The Bootstrap Flow

In `src/contexts/AuthContext.tsx`, the auth initialization flow is:

```typescript
const ensureSupabaseAuth = async () => {
  try {
    // Step 1: Ensure demo user exists (NO SESSION YET)
    const { error: ensureError } = await supabase.functions.invoke('ensure-demo-users');
    
    if (ensureError) {
      console.error('Error ensuring demo users:', ensureError);
    }

    // Step 2: Sign in with demo credentials (CREATES SESSION)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: DEMO_TEACHER_EMAIL,
      password: DEMO_TEACHER_PASSWORD
    });
    // ...
  }
};
```

**The Problem:**
1. `ensure-demo-users` is called FIRST (on app mount)
2. At this point, there is NO Supabase session
3. Therefore, NO JWT token exists to attach to the Edge Function request
4. By default, Supabase Edge Functions require JWT verification
5. The function rejects the call with: `{"code":401,"message":"Missing authorization header"}`

### Why This Function Doesn't Need JWT

The `ensure-demo-users` function:
- Is a **bootstrap/admin helper** that creates demo users
- Uses **SERVICE_ROLE_KEY** internally (full admin access)
- Is designed to be called **before authentication** exists
- Has its own security via the service role key (not exposed to client)
- Returns only success/failure status (no sensitive data)

**Therefore:** It should NOT require a JWT from the caller.

---

## Verification from Outside Repo

### Test 1: Direct Auth Works ✅

```bash
curl -X POST "https://srlrbuphsogwgymqywhe.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: sb_publishable_..." \
  -H "Authorization: Bearer sb_publishable_..." \
  -H "Content-Type: application/json" \
  -d '{"email": "demo.teacher@example.com", "password": "DemoPassword2024!"}'
```

**Result:** ✅ Returns valid `access_token` and user object

**Conclusion:** Anon key is valid, credentials work, Supabase Auth is healthy.

---

### Test 2: Edge Function Call Fails ❌

```bash
curl -X POST "https://srlrbuphsogwgymqywhe.supabase.co/functions/v1/ensure-demo-users" \
  -H "apikey: sb_publishable_..." \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Result:** ❌ `{"code":401,"message":"Missing authorization header"}`

**Conclusion:** Function requires JWT, but we're calling it without one (as designed).

---

## Solution Implemented

### Change 1: Create Function Configuration

**File Created:** `supabase/functions/ensure-demo-users/config.toml`

**Content:**
```toml
# Edge Function Configuration for ensure-demo-users
# This function is a bootstrap/admin helper that runs BEFORE user authentication.
# It uses the SERVICE_ROLE_KEY internally to create/update demo users.
# Therefore, it must NOT require a JWT from the caller.

[functions]
verify_jwt = false
```

**Rationale:**
- `verify_jwt = false` tells Supabase to skip JWT verification for this function
- Caller can invoke with just `apikey` header (anon key)
- Function still secure because it uses `SERVICE_ROLE_KEY` internally
- Aligns with the bootstrap/admin pattern

---

### Change 2: Verify Service Role Key Usage (Already Complete)

**File:** `supabase/functions/ensure-demo-users/index.ts`

**Code (lines 16-19):**
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
// Note: Using SERVICE_ROLE_KEY instead of SUPABASE_SERVICE_ROLE_KEY
// because Supabase reserves the SUPABASE_* prefix for system secrets
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;
```

**Status:** ✅ Already correct (updated in previous session)

**Verification:**
- ✅ Uses `SERVICE_ROLE_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`)
- ✅ Comment explains the naming constraint
- ✅ No other references to old env var name

---

### Other Edge Functions Status

#### `modify-evaluation` (No Changes Needed)

**Current Status:**
- ✅ Already uses `SERVICE_ROLE_KEY` (lines 9-10)
- ✅ Function IS called with user context (authenticated calls)
- ✅ SHOULD keep JWT verification enabled (default behavior)
- ✅ No config.toml needed (default is `verify_jwt = true`)

**Rationale:** This function is invoked from authenticated pages (evaluations, planning) where user session exists. JWT verification is appropriate.

#### `generate-bulletin-text` (No Changes)

**Status:** ✅ No service role key usage, no changes needed

#### `generate-plan-completo` (No Changes)

**Status:** ✅ No service role key usage, no changes needed

---

## Deployment Instructions

### Prerequisites

Ensure Supabase CLI is installed and linked:

```bash
# Check CLI version
supabase --version

# If not installed:
npm install -g supabase

# Login (if needed):
supabase login

# Link to project (if needed):
supabase link --project-ref srlrbuphsogwgymqywhe
```

---

### Deploy Updated Function

```bash
# Deploy only the updated function
supabase functions deploy ensure-demo-users
```

**Expected Output:**
```
Deploying function ensure-demo-users...
✓ Function configuration loaded from config.toml
✓ Function deployed successfully
Function URL: https://srlrbuphsogwgymqywhe.supabase.co/functions/v1/ensure-demo-users
```

**Important:** The deployment will read the new `config.toml` and apply the `verify_jwt = false` setting.

---

## Verification: cURL Tests

### Test 1: Edge Function WITHOUT Authorization Header

**Command (Windows cmd.exe):**
```cmd
curl -X POST "https://srlrbuphsogwgymqywhe.supabase.co/functions/v1/ensure-demo-users" ^
  -H "apikey: sb_publishable_YOUR_FULL_ANON_KEY_HERE" ^
  -H "Content-Type: application/json" ^
  -d "{}"
```

**Replace:** `sb_publishable_YOUR_FULL_ANON_KEY_HERE` with your actual anon key from `.env`

**Expected Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Demo users ensured"
}
```

**What this proves:**
- ✅ Function accepts calls without JWT
- ✅ `verify_jwt = false` is working
- ✅ Function can create/update demo user successfully
- ✅ `SERVICE_ROLE_KEY` is configured correctly in Supabase Dashboard

---

**If you get 401 "Missing authorization header" STILL:**

Possible causes:
1. Function not redeployed yet → Run `supabase functions deploy ensure-demo-users`
2. Config.toml not picked up → Check file exists at correct path
3. Old function version cached → Wait 1-2 minutes, retry
4. Wrong function URL → Verify project ref is `srlrbuphsogwgymqywhe`

---

**If you get 500 "Failed to list users":**

Possible causes:
1. `SERVICE_ROLE_KEY` not set in Dashboard → Go to Dashboard → Edge Functions → Secrets
2. Service key value is incorrect → Re-copy from Dashboard → API → service_role
3. Service key is legacy/expired → Get new key from Dashboard

**Debug:** Check function logs in Supabase Dashboard → Edge Functions → ensure-demo-users → Logs tab

---

### Test 2: Verify Demo User Can Sign In

After Test 1 succeeds (user created), verify auth still works:

**Command (Windows cmd.exe):**
```cmd
curl -X POST "https://srlrbuphsogwgymqywhe.supabase.co/auth/v1/token?grant_type=password" ^
  -H "apikey: sb_publishable_YOUR_FULL_ANON_KEY_HERE" ^
  -H "Authorization: Bearer sb_publishable_YOUR_FULL_ANON_KEY_HERE" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\": \"demo.teacher@example.com\", \"password\": \"DemoPassword2024!\"}"
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
    "user_metadata": {
      "role": "teacher",
      "display_name": "Profesor Demo"
    },
    ...
  }
}
```

**What this proves:**
- ✅ Demo user exists and has correct credentials
- ✅ User metadata (role, display_name) is set correctly
- ✅ Auth flow is healthy end-to-end

---

## Frontend Verification

### Step 1: Start Dev Server

```bash
npm run dev
```

### Step 2: Check Browser Console

Navigate to `http://localhost:5173` and open DevTools Console (F12).

**Expected Logs:**
```
[Supabase Client] URL: https://srlrbuphsogwgymqywhe.supabase.co
[Supabase Client] ANON length: 250
[Supabase Client] ANON prefix: sb_publishable_...
Demo user authenticated successfully
Profile updated silently
```

**If you see:**
- ❌ `Error ensuring demo users: {"code":401,"message":"Missing authorization header"}`
  → Function not redeployed or config not applied. Retry deployment.

- ❌ `Background auth error: {...}`
  → Demo user might not exist. Check Test 1 succeeded.

- ❌ No logs at all
  → Check `.env` file has correct keys, dev server restarted after `.env` changes.

---

### Step 3: Test Demo Login Flow

1. Navigate to `/teacher-login`
2. Enter any username and password (any values accepted for demo)
3. Click "Login"

**Expected Behavior:**
- ✅ Redirected to `/teacher-dashboard`
- ✅ No console errors
- ✅ Supabase session exists (check Application → Local Storage → `sb-srlrbuphsogwgymqywhe-auth-token`)
- ✅ Mock user object stored in `localStorage.auth_user`

**If login fails:**
- Check Network tab for failed requests
- Check Console for error messages
- Verify both Test 1 and Test 2 cURL commands succeeded

---

## Technical Details: How verify_jwt Works

### Default Behavior (verify_jwt = true)

When `verify_jwt = true` (or unspecified):

1. Client calls Edge Function with headers:
   ```
   apikey: <anon_key>
   Authorization: Bearer <JWT_from_session>
   ```

2. Supabase Gateway validates JWT:
   - Checks signature against project's JWT secret
   - Verifies expiration time
   - Extracts user ID and role

3. If JWT invalid/missing → Returns 401

4. If JWT valid → Forwards request to function with `req.headers.get('Authorization')`

**Use case:** Functions that need to know WHO is calling (user-specific operations).

---

### Bootstrap Behavior (verify_jwt = false)

When `verify_jwt = false`:

1. Client calls Edge Function with only:
   ```
   apikey: <anon_key>
   ```

2. Supabase Gateway checks `apikey` is valid for this project

3. If apikey valid → Forwards request immediately (no JWT check)

4. Function receives request and executes

**Use case:** Public functions, webhooks, bootstrap/admin helpers like `ensure-demo-users`.

---

### Security Considerations

**Why is this safe for ensure-demo-users?**

1. **Limited functionality:** Only creates/updates demo users with hardcoded credentials
2. **Internal auth:** Uses `SERVICE_ROLE_KEY` internally (not exposed to client)
3. **No data exposure:** Returns only `{"success": true}`, no user data
4. **Idempotent:** Calling multiple times has same effect (safe to retry)
5. **Rate limited:** Supabase applies rate limits per IP
6. **Audit trail:** All calls logged in Supabase function logs

**What it does NOT do:**
- ❌ Expose service role key to client
- ❌ Allow arbitrary user creation (only demo user)
- ❌ Return sensitive data
- ❌ Bypass RLS policies (uses admin client intentionally)

---

## Monitoring & Debugging

### View Function Logs

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select project `srlrbuphsogwgymqywhe`
3. Navigate to **Edge Functions** (⚡ icon)
4. Click `ensure-demo-users`
5. Go to **Logs** tab

**What to look for:**
- ✅ `Ensuring demo teacher user exists...`
- ✅ `Demo teacher user already exists: <uuid> - ensuring password and metadata`
- ✅ `Profile updated successfully`
- ❌ `Error listing users: ...` → Service key problem
- ❌ `Error creating demo user: ...` → Auth API issue

---

### Common Error Patterns

#### Error: "undefined is not a function" (in function logs)

**Cause:** `SERVICE_ROLE_KEY` env var not set, so `Deno.env.get('SERVICE_ROLE_KEY')` returns undefined.

**Fix:**
1. Dashboard → Edge Functions → Secrets
2. Verify secret `SERVICE_ROLE_KEY` exists
3. If not, add it with value from Dashboard → API → service_role key
4. Redeploy function

---

#### Error: "Failed to list users" with auth error

**Cause:** Service role key is invalid, legacy, or doesn't match project.

**Fix:**
1. Dashboard → Project Settings → API
2. Copy **current** service_role key (should be 100+ chars, starts with `eyJ`)
3. Dashboard → Edge Functions → Secrets
4. Update `SERVICE_ROLE_KEY` with new value
5. Redeploy function

---

#### Error: Function returns 200 but profile not created

**Cause:** RLS policies blocking even admin client, or `profiles` table doesn't exist.

**Fix:**
1. Dashboard → SQL Editor
2. Verify table exists: `SELECT * FROM profiles LIMIT 1;`
3. Check RLS is configured for service role bypass
4. Review function logs for specific error

---

## Summary of Changes

### Files Created
- ✅ `supabase/functions/ensure-demo-users/config.toml`

### Files Modified
- ✅ None (service key usage already updated in previous session)

### Configuration Changes
- ✅ Disabled JWT verification for `ensure-demo-users`
- ✅ Other functions retain default JWT verification

### Deployment Required
- ✅ `ensure-demo-users` must be redeployed to pick up config.toml

---

## Next Steps Checklist

- [ ] Run: `supabase functions deploy ensure-demo-users`
- [ ] Run Test 1 cURL command (without Authorization header)
- [ ] Verify: Response is 200 with `{"success": true, ...}`
- [ ] Run Test 2 cURL command (auth token grant)
- [ ] Verify: Response is 200 with access_token
- [ ] Start dev server: `npm run dev`
- [ ] Check browser console for successful logs
- [ ] Test demo login flow via UI
- [ ] Verify no 401 errors in Network tab

---

## Caveats & Notes

### Caveat 1: Config Changes Require Redeploy

If you modify `config.toml` in the future, you MUST redeploy the function for changes to take effect. Config is not hot-reloaded.

### Caveat 2: Service Role Key Rotation

If you rotate your service_role key in Supabase Dashboard:
1. Update `SERVICE_ROLE_KEY` secret in Dashboard → Edge Functions → Secrets
2. Redeploy affected functions: `ensure-demo-users`, `modify-evaluation`
3. Test all edge functions that use service role

### Caveat 3: Multiple Environments

If you have staging/production environments:
- Each environment needs its own `SERVICE_ROLE_KEY` secret
- Config.toml is committed to git (same across environments)
- Ensure secrets are set in ALL environments before deploying

---

## Related Documentation

- Previous session: `refactor/003-edge-function-service-key-migration.md`
- Auth debug guide: `refactor/002-supabase-auth-and-demo-users-debug.md`
- Full investigation: `refactor/001-aulaplus-v0-codebase-investigation.md`
- Supabase guide: `docs/supabase-connection-overview.md`

---

## Document Status

**Created:** 2025-12-09  
**Status:** Ready for Deployment  
**Changes:** Minimal (1 file created, 0 files modified)  
**Risk Level:** Low (surgical fix, well-isolated)  
**Next Action:** User to run deployment and tests

