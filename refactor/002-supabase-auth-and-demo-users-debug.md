# Supabase Auth & Edge Function Debug Analysis (2025-12-09)

## Problem Summary

The AulaPlus v0 application is experiencing authentication failures with Supabase:

**Observed Errors:**
1. `POST https://<PROJECT>.supabase.co/functions/v1/ensure-demo-users` → **500 Internal Server Error**
2. `POST https://<PROJECT>.supabase.co/auth/v1/token?grant_type=password` → **401 Unauthorized**
3. Error message: **`AuthApiError: Legacy API keys are disabled`**

**Impact:**
- Users cannot authenticate to the application
- Demo user provisioning fails
- All protected routes become inaccessible

---

## 1. Code-Level Findings

### 1.1 Supabase Client Setup (`src/integrations/supabase/client.ts`)

**How the client is created:**
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

**Environment Variables Required:**
- `VITE_SUPABASE_URL` (from `import.meta.env.VITE_SUPABASE_URL`)
- `VITE_SUPABASE_ANON_KEY` (from `import.meta.env.VITE_SUPABASE_ANON_KEY`)

**Runtime Checks Implemented:**
1. **Missing variable validation**: Throws error if URL or anon key is missing
2. **Dev-time logging**: 
   - Logs URL, anon key length, and first 12 characters of key
   - Example output: `[Supabase Client] ANON prefix: eyJhbGciOiJI...`
3. **Key length validation**: Warns if anon key < 50 characters (likely invalid/wrong key type)

**Auth Features Used:**
- ✅ `auth.signInWithPassword()` - Password-based authentication
- ✅ `auth.onAuthStateChange()` - Session lifecycle listener
- ✅ `persistSession: true` - Sessions stored in localStorage
- ✅ `autoRefreshToken: true` - Automatic token refresh

---

### 1.2 Auth Flow (`src/contexts/AuthContext.tsx`)

#### `ensureSupabaseAuth()` Function Logic

**When called:**
- On app mount (via `useEffect` in `AuthProvider`)
- When user explicitly logs in and no session exists

**Step-by-step flow:**

```typescript
const ensureSupabaseAuth = async () => {
  try {
    // Step 1: Invoke Edge Function to ensure demo user exists
    const { error: ensureError } = await supabase.functions.invoke('ensure-demo-users');
    
    if (ensureError) {
      console.error('Error ensuring demo users:', ensureError);
    }

    // Step 2: Sign in with demo credentials
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: DEMO_TEACHER_EMAIL,      // 'demo.teacher@example.com'
      password: DEMO_TEACHER_PASSWORD  // 'DemoPassword2024!'
    });

    if (signInError) {
      console.error('Background auth error:', signInError);
    } else {
      console.log('Demo user authenticated successfully');
    }
  } catch (error) {
    console.error('Demo user setup error:', error);
  }
};
```

**Hardcoded Demo Credentials:**
```typescript
const DEMO_TEACHER_EMAIL = 'demo.teacher@example.com';
const DEMO_TEACHER_PASSWORD = 'DemoPassword2024!';
```

**Error Handling:**
- ❌ **Errors are logged but NOT thrown** - app continues even if Edge Function or auth fails
- ❌ **No retry logic** - if first attempt fails, no automatic retry
- ⚠️ **Silent failures** - user may see blank/broken UI without clear error messages

**Critical Assumption:**
The code assumes that if `ensure-demo-users` fails, `signInWithPassword` might still succeed (if user already exists). This can mask the real problem.

---

### 1.3 Edge Function: `ensure-demo-users` (`supabase/functions/ensure-demo-users/index.ts`)

#### Admin Client Construction

```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
```

**Environment Variables Required (Edge Function side):**
- `SUPABASE_URL` - Must match the project URL (auto-injected by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key with full database access

#### Function Flow

1. **List all users** (pagination: 1000 users max)
   ```typescript
   const { data: listData, error: listError } = 
     await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
   ```
   - ❌ **Fails → 500 response** if `SUPABASE_SERVICE_ROLE_KEY` is invalid/legacy

2. **Find existing demo user** by email (`demo.teacher@example.com`)
   ```typescript
   const existingUser = listData.users.find(
     u => (u.email || '').toLowerCase() === demoTeacherEmail.toLowerCase()
   );
   ```

3. **If user doesn't exist → Create user**
   ```typescript
   const { data: created, error: createError } = 
     await supabaseAdmin.auth.admin.createUser({
       email: demoTeacherEmail,
       password: demoTeacherPassword,
       email_confirm: true,  // Bypass email verification
       user_metadata: { role: 'teacher', display_name: 'Profesor Demo' }
     });
   ```
   - ❌ **Fails → 500 response** if admin API rejects the service key

4. **If user exists → Update password & metadata**
   ```typescript
   await supabaseAdmin.auth.admin.updateUserById(userId, {
     password: demoTeacherPassword,
     user_metadata: { role: 'teacher', display_name: 'Profesor Demo' }
   });
   ```

5. **Upsert profile in `profiles` table**
   - Uses `supabaseAdmin.from('profiles')` (bypasses RLS via service role)

#### Conditions That Cause 500 Error

1. **Missing `SUPABASE_SERVICE_ROLE_KEY`**: 
   - `Deno.env.get()` returns `undefined`
   - Client creation fails or admin API calls fail

2. **Invalid/Legacy Service Role Key**:
   - Key format is outdated (pre-migration format)
   - Supabase rejects the key with authentication error
   - Admin API calls (`listUsers`, `createUser`, etc.) return 401/403

3. **Wrong `SUPABASE_URL`**:
   - URL points to different project than frontend
   - Service key doesn't match the URL project

4. **Auth Admin API disabled**:
   - Supabase project has disabled Admin API access
   - Rare, but possible in certain org/billing configs

5. **Database/RLS errors**:
   - `profiles` table doesn't exist
   - RLS policies block even admin client (misconfiguration)

#### Legacy Pattern Analysis

**Potential incompatibilities:**
- Uses `@supabase/supabase-js@2.39.3` (relatively recent, but not latest)
- Uses `auth.admin` namespace which requires current API key format
- No explicit version check or fallback for legacy keys

**The function DOES NOT use legacy patterns**, but it REQUIRES modern keys to work.

---

### 1.4 Configuration Guide (`docs/supabase-connection-overview.md`)

**Intended Configuration:**

#### Frontend (`.env` at repo root):
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Source for keys:**
- Dashboard → Project Settings → API
- **Project URL**: Copy from "Project URL" section
- **anon public key**: Copy from "Project API keys" → "anon public" (NOT "service_role")

#### Edge Function Environment (Supabase Dashboard):
```
SUPABASE_URL=https://your-project-id.supabase.co  (auto-injected)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-...  (not relevant to this auth issue)
```

**Source for service key:**
- Dashboard → Project Settings → API → "service_role" key
- ⚠️ **CRITICAL**: Must be the **current** service key, not copied from old project

**Key Security Rules:**
- ✅ Frontend uses **anon public key** (safe, protected by RLS)
- ✅ Edge Function uses **service_role key** (full access, server-side only)
- ❌ NEVER use service_role in frontend
- ❌ NEVER commit `.env` to git

---

## 2. Root Cause Analysis

### 2.1 Why `401 Unauthorized` with "Legacy API keys are disabled"?

**Error Location:** `POST /auth/v1/token?grant_type=password`

**What this error means:**

Supabase projects undergo periodic migrations to newer infrastructure. During these migrations:
- **Old API key format** (pre-2023 projects) becomes incompatible
- Projects get **new anon/service keys** with updated JWT structure
- **Legacy keys are disabled** to force migration to new key format

**Likely causes in this codebase:**

1. **Using an old anon key** (`VITE_SUPABASE_ANON_KEY`):
   - Key was copied from an old Supabase project
   - Project has been migrated but `.env` still has old key
   - Key format: legacy JWT structure that Supabase no longer accepts

2. **Using wrong key type**:
   - Less likely, but possible: accidentally used `service_role` key in frontend
   - Would cause different error typically, but worth checking

3. **Project settings changed**:
   - Supabase dashboard setting explicitly disabled legacy keys
   - Project was paused/restarted and keys regenerated

**How to confirm:**
- Check if anon key in `.env` starts with modern JWT prefix (typically 100+ characters)
- Compare key in `.env` with current key in Supabase Dashboard
- Verify key was copied from "anon public" row, not "service_role"

---

### 2.2 Why `500 Internal Server Error` on `/functions/v1/ensure-demo-users`?

**Error Location:** Edge Function invocation from frontend

**Likely causes (in order of probability):**

#### 1. **Invalid/Legacy `SUPABASE_SERVICE_ROLE_KEY`** (MOST LIKELY)

If the service role key is legacy/invalid:
```typescript
// This fails silently or with auth error:
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {...});

// This then fails with 401/403:
await supabaseAdmin.auth.admin.listUsers(...);

// Edge Function catches error and returns 500:
return new Response(
  JSON.stringify({ error: 'Failed to list users', details: listError.message }),
  { status: 500, ... }
);
```

**Smoking gun:** If service key is legacy, `listUsers()` will fail immediately with an auth error, which the function catches and returns as 500.

#### 2. **Missing `SUPABASE_SERVICE_ROLE_KEY` in Edge Function environment**

If key is not set in Supabase Dashboard → Edge Functions environment:
```typescript
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Returns undefined, client creation fails
```

#### 3. **Mismatched `SUPABASE_URL`**

Frontend uses one project, Edge Function uses different project's service key:
- Keys don't match projects
- Admin API rejects calls
- 500 error returned

#### 4. **Auth Admin API rate limits/errors**

Rare, but:
- Too many `listUsers` calls hitting rate limits
- Temporary Supabase API outage
- Project billing/quota exceeded

---

### 2.3 Dependency Chain & Failure Cascade

**What happens when Edge Function fails (500)?**

```typescript
// In AuthContext.tsx:
const { error: ensureError } = await supabase.functions.invoke('ensure-demo-users');

if (ensureError) {
  console.error('Error ensuring demo users:', ensureError);  // Logged but NOT thrown
}

// Code CONTINUES to attempt sign-in:
const { error: signInError } = await supabase.auth.signInWithPassword({...});
```

**Outcome:**
- Edge Function 500 is logged but ignored
- App tries to sign in anyway with `demo.teacher@example.com`
- **If user doesn't exist:** Sign-in fails with 400 "Invalid credentials"
- **If anon key is legacy:** Sign-in fails with 401 "Legacy API keys are disabled"

**Current behavior:**
- ❌ App continues loading with no Supabase session
- ❌ Frontend mock user might be created anyway (from localStorage)
- ❌ User sees broken UI or access denied errors
- ❌ No clear error message explaining the root cause

---

## 3. cURL Test Plan

Use these commands to isolate whether the issue is in code or Supabase configuration.

**Prerequisites:**
- Replace placeholders with your actual values
- Get keys from Supabase Dashboard → Project Settings → API
- Run from terminal (not from browser)

---

### Test 1: Verify Anon Key Works (Password Grant)

**Purpose:** Test if the anon public key can authenticate with demo credentials.

**Command:**
```bash
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR_ANON_PUBLIC_KEY" \
  -H "Authorization: Bearer YOUR_ANON_PUBLIC_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo.teacher@example.com",
    "password": "DemoPassword2024!"
  }'
```

**How to fill placeholders:**
- `YOUR_PROJECT_ID`: From your Supabase URL (e.g., `abcdefghijklmnop`)
- `YOUR_ANON_PUBLIC_KEY`: From Dashboard → API → "anon public" key (starts with `eyJ...`)

**Interpreting results:**

✅ **Success (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": { "id": "...", "email": "demo.teacher@example.com", ... }
}
```
**Meaning:** ✅ Anon key is valid. Frontend should work. Problem is likely in `.env` file or dev server not restarted.

---

❌ **Failure (401 Unauthorized):**
```json
{
  "error": "invalid_grant",
  "error_description": "Invalid login credentials"
}
```
**Meaning:** Demo user doesn't exist yet. Need to run Edge Function first (see Test 2).

---

❌ **Failure (401) with "Legacy API keys are disabled":**
```json
{
  "code": "...",
  "msg": "Legacy API keys are disabled",
  "error": "..."
}
```
**Meaning:** 🚨 **Anon key is outdated/legacy**. Must get new key from Dashboard.

**Action:** 
1. Go to Dashboard → Project Settings → API
2. Copy the **current** "anon public" key (should be 100+ characters)
3. Update `.env`:
   ```env
   VITE_SUPABASE_ANON_KEY=<NEW_KEY_HERE>
   ```
4. Restart dev server: `npm run dev`

---

### Test 2: Call Edge Function with Anon Key (Client-Style)

**Purpose:** Test if the Edge Function can be invoked from client (like frontend does).

**Command:**
```bash
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/ensure-demo-users" \
  -H "apikey: YOUR_ANON_PUBLIC_KEY" \
  -H "Authorization: Bearer YOUR_ANON_PUBLIC_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Interpreting results:**

✅ **Success (200 OK):**
```json
{
  "success": true,
  "message": "Demo users ensured"
}
```
**Meaning:** ✅ Edge Function works. Service role key is valid. Demo user now exists. Retry Test 1.

---

❌ **Failure (500 Internal Server Error):**
```json
{
  "error": "Failed to list users",
  "details": "..."
}
```
**OR:**
```json
{
  "error": "Internal server error",
  "details": "..."
}
```

**Meaning:** 🚨 **Edge Function has a configuration problem**. Most likely:
- Service role key is missing or invalid
- Service role key is legacy/outdated

**Action:** Go to Test 3 to confirm service key validity.

---

### Test 3: Test Service Role Key Directly (Admin-Style)

**⚠️ WARNING:** This test uses the **service_role key** which has FULL database access. Only run from secure environment, NEVER from browser or shared computer.

**Purpose:** Confirm if service role key can list users (bypass Edge Function).

**Command:**
```bash
curl -X GET "https://YOUR_PROJECT_ID.supabase.co/auth/v1/admin/users?page=1&per_page=10" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Interpreting results:**

✅ **Success (200 OK):**
```json
{
  "users": [
    { "id": "...", "email": "demo.teacher@example.com", ... },
    ...
  ],
  "aud": "authenticated"
}
```
**Meaning:** ✅ Service role key is valid. Problem is likely:
- Key not set in Edge Function environment (Dashboard → Edge Functions → Environment Variables)
- Key set incorrectly (typo, spaces, quotes)

**Action:**
1. Go to Dashboard → Edge Functions
2. Click on `ensure-demo-users` function
3. Go to "Settings" or "Environment Variables"
4. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
5. Redeploy function if needed

---

❌ **Failure (401/403):**
```json
{
  "code": "...",
  "msg": "...",
  "error": "..."
}
```

**Meaning:** 🚨 **Service role key is invalid/legacy**.

**Action:**
1. Go to Dashboard → Project Settings → API
2. Find "service_role" key (⚠️ Keep this secret!)
3. Copy the **current** key (100+ characters, starts with `eyJ...`)
4. Update Edge Function environment:
   - Dashboard → Edge Functions → `ensure-demo-users` → Environment Variables
   - Set: `SUPABASE_SERVICE_ROLE_KEY=<NEW_KEY_HERE>`
5. Redeploy function
6. Retry Test 2

---

### Test 4: Verify Keys Match Project

**Purpose:** Ensure all keys belong to the same Supabase project.

**Commands:**

```bash
# Decode anon key (first 2 segments of JWT):
echo "YOUR_ANON_PUBLIC_KEY" | cut -d'.' -f1-2 | base64 -d 2>/dev/null | jq '.'

# Decode service key:
echo "YOUR_SERVICE_ROLE_KEY" | cut -d'.' -f1-2 | base64 -d 2>/dev/null | jq '.'
```

**What to check:**
- Both JWTs should have **same `iss` (issuer)** field
- `iss` should match your `SUPABASE_URL`
- Example: `"iss": "https://abcdefgh.supabase.co/auth/v1"`

**If different:** You're mixing keys from different projects. Get all keys from same project.

---

## 4. Configuration Checklist

Follow this checklist to verify and fix Supabase configuration:

### Step 1: Access Supabase Dashboard

1. Go to [https://app.supabase.com/](https://app.supabase.com/)
2. Select your AulaPlus project
3. Click ⚙️ **Project Settings** in left sidebar
4. Click **API** in settings menu

---

### Step 2: Copy Current Project URL

1. Find section: **Project URL**
2. Copy the full URL (format: `https://xxxxx.supabase.co`)
3. **Important:** This is your `SUPABASE_URL` for both frontend and Edge Functions

**Example:**
```
https://abcdefghijklmnop.supabase.co
```

---

### Step 3: Copy Current Anon Public Key

1. Find section: **Project API keys**
2. Locate row: **anon public**
3. Click "Copy" or select the entire key
4. **Verify:** Key should be 100+ characters, start with `eyJhbGciOiJI...`

⚠️ **DO NOT copy "service_role" key here!**

---

### Step 4: Copy Current Service Role Key

1. In same **Project API keys** section
2. Locate row: **service_role**
3. Click "Copy" or select the entire key
4. **Verify:** Key should be 100+ characters, start with `eyJhbGciOiJI...`
5. **⚠️ Keep this secret!** Never commit to git, never expose in frontend

---

### Step 5: Update Frontend `.env` File

1. Open `.env` file at repo root (create if doesn't exist)
2. Update with current values (NO quotes, NO spaces around `=`):

```env
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxMDg...
```

3. **Verify `.env` location:** Must be at repo root (same level as `package.json`)
4. **Save file**
5. **Restart dev server:** `Ctrl+C` then `npm run dev`

---

### Step 6: Update Edge Function Environment Variables

1. In Supabase Dashboard, go to **Edge Functions** (lightning icon in left sidebar)
2. Select `ensure-demo-users` function
3. Click **Settings** tab or find **Environment Variables** section
4. Set these variables:

```
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjEwOD...
```

5. **Verify:** `SUPABASE_URL` matches value in frontend `.env`
6. **Click "Save" or "Deploy"** to apply changes

---

### Step 7: Verify Edge Function Deployment

After updating environment variables:

1. Check function status: Should show "Deployed" or "Active"
2. If stuck in "Building" or "Failed":
   - Click "Deploy" or "Redeploy" button
   - Wait for deployment to complete (30-60 seconds)
3. Check function logs for errors:
   - Click "Logs" tab
   - Look for errors related to env vars or auth

---

### Step 8: Test Configuration

Run the cURL tests from Section 3:

1. **Test 1** (anon key auth): Should return 200 with access_token
   - If 401 "Legacy keys": Get new anon key (repeat Steps 3, 5)
   - If 401 "Invalid credentials": Continue to Test 2

2. **Test 2** (Edge Function): Should return 200 with `"success": true`
   - If 500: Check service key is set correctly (repeat Steps 4, 6, 7)
   - If still failing: Run Test 3

3. **Test 3** (service key direct): Should return 200 with user list
   - If 401/403: Get new service key (repeat Steps 4, 6, 7)

4. **Retry Test 1**: Should now work if demo user was created

---

### Step 9: Clear Browser State & Restart App

1. Open browser DevTools (F12)
2. Go to Application → Storage
3. Clear:
   - Local Storage (all keys)
   - Session Storage (all keys)
   - Cookies (supabase-related)
4. Close DevTools
5. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
6. Check console for new Supabase client logs:
   ```
   [Supabase Client] URL: https://abcdefghijklmnop.supabase.co
   [Supabase Client] ANON length: 250
   [Supabase Client] ANON prefix: eyJhbGciOiJI...
   ```

---

### Summary of Key Requirements

| Component | Variable | Value Source | Key Type |
|-----------|----------|--------------|----------|
| Frontend `.env` | `VITE_SUPABASE_URL` | Dashboard → API → Project URL | N/A |
| Frontend `.env` | `VITE_SUPABASE_ANON_KEY` | Dashboard → API → "anon public" | Anon (safe for client) |
| Edge Function Env | `SUPABASE_URL` | Same as frontend URL | N/A |
| Edge Function Env | `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → API → "service_role" | Service (server-only) |

**Critical Rules:**
- ✅ Frontend uses **anon** key
- ✅ Edge Function uses **service_role** key
- ✅ Both must be **current** (non-legacy) keys
- ✅ All keys must be from **same project**
- ❌ NEVER use service_role in frontend
- ❌ NEVER commit `.env` to git

---

## 5. Next Steps After Configuration

Once configuration is correct and tests pass:

1. **Monitor console logs** for auth errors
2. **Test demo user login** via UI:
   - Navigate to `/teacher-login`
   - Enter any username/password
   - Should create Supabase session + frontend mock user

3. **Verify session persistence**:
   - Refresh page
   - Session should be restored from localStorage
   - Should stay logged in

4. **Test Edge Function integration**:
   - Open Network tab in DevTools
   - Check `/functions/v1/ensure-demo-users` call
   - Should return 200 with `"success": true`

5. **If errors persist:**
   - Check Supabase project status (not paused)
   - Verify project is on current Supabase infrastructure
   - Check for billing/quota issues
   - Review Supabase status page: [https://status.supabase.com/](https://status.supabase.com/)

---

## 6. Common Pitfalls & Solutions

### Pitfall 1: `.env` file in wrong location
**Symptom:** Variables are `undefined`, client throws error  
**Solution:** Move `.env` to repo root (same level as `package.json`)

### Pitfall 2: Dev server not restarted
**Symptom:** Old keys still in use, errors persist  
**Solution:** Stop server (`Ctrl+C`), then `npm run dev`

### Pitfall 3: Spaces or quotes in `.env`
**Symptom:** Keys not parsed correctly  
**Solution:** Use format: `VAR=value` (no spaces, no quotes)

### Pitfall 4: Mixed keys from different projects
**Symptom:** Auth works but database queries fail  
**Solution:** Get all keys from same project (check JWT `iss` field)

### Pitfall 5: Service key in frontend
**Symptom:** Security warning, app works but unsafe  
**Solution:** Use anon key in `.env`, service key only in Edge Function env

### Pitfall 6: Edge Function not redeployed
**Symptom:** Env vars updated but function still uses old values  
**Solution:** Manually redeploy function in Dashboard

---

## Document Status

**Date Created:** 2025-12-09  
**Status:** Analysis Complete - Awaiting User Configuration Verification  
**Next Action:** User should follow Configuration Checklist and run cURL tests  
**Expected Outcome:** All tests pass, auth errors resolved, app loads successfully

