# Supabase Frontend Key Mismatch Resolution (2025-12-09)

## Problem Summary

**Issue:** Frontend running on `http://localhost:8080` was experiencing `AuthApiError: Legacy API keys are disabled` when calling `supabase.auth.signInWithPassword()`.

**Symptoms:**
- Browser console showed: `[Supabase Client] ANON prefix: eyJhbGciOiJI...` (old JWT format)
- Network request to `POST /auth/v1/token?grant_type=password` returned 401 Unauthorized
- Error message: "Legacy API keys are disabled"
- ANON length shown as 208 characters (legacy key length)

**Contradictory Evidence:**
- Same `curl` command with new `sb_publishable_...` key worked perfectly (returned 200 + access_token)
- User reported `.env` had been updated with new key
- Edge Function tests worked fine with new key

---

## Root Cause Analysis

### Investigation Steps

1. **Verified Supabase Client Code** (`src/integrations/supabase/client.ts`):
   - ✅ Correctly reads `import.meta.env.VITE_SUPABASE_URL`
   - ✅ Correctly reads `import.meta.env.VITE_SUPABASE_ANON_KEY`
   - ✅ Logs the first 12 characters of the key in dev mode (line 11)
   - ✅ No hardcoded keys or fallbacks

2. **Checked Vite Configuration** (`vite.config.ts`):
   - ✅ Server configured to run on port 8080 (line 10)
   - ✅ No env variable overrides or custom loading logic
   - ✅ Standard Vite env handling (prefixed with `VITE_`)

3. **Searched for Legacy Keys in Codebase**:
   - ❌ No `eyJhbGciOiJI...` keys found in source code
   - ✅ Only found in documentation markdown files (examples)

4. **Checked for Multiple `.env` Files**:
   - ✅ No `.env.local` file found
   - ✅ No `.env.development` file found
   - ✅ No `.env.production` file found
   - ✅ Only one `.env` file exists at repo root

5. **Inspected Actual `.env` File** (via PowerShell):
   ```powershell
   Get-Content .env
   ```
   **Result:**
   ```
   VITE_SUPABASE_URL=https://srlrbuphsogwgymqywhe.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybHJidXBoc29nd2d5bXF5d2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NzYxMDksImV4cCI6MjA3MjM1MjEwOX0.AzxiHH4NtxxrGlv9d3E8-mGAGg1gO6e-ZJtEQ2DqPSc
   ```

### THE PROBLEM

**The `.env` file was NOT actually updated with the new key.**

Despite user reporting that `.env` had been updated to use `sb_publishable_5D-oXfd9WLrn1eP7fwkSaQ_pLY8-Aym`, the file on disk still contained the old legacy JWT format key `eyJhbGciOiJI...`.

**Why This Happened:**
- `.env` is in `.gitignore` (correct security practice)
- User may have edited a different file or the changes weren't saved
- No file watching/validation to catch env var format mismatches
- Vite dev server was potentially running when edit was attempted (cached env vars)

---

## Solution Implemented

### Change: Update `.env` File with Correct Key

**File:** `.env` (repo root)

**Command Used:**
```powershell
Set-Content -Path .env -Value "VITE_SUPABASE_URL=https://srlrbuphsogwgymqywhe.supabase.co`nVITE_SUPABASE_ANON_KEY=sb_publishable_5D-oXfd9WLrn1eP7fwkSaQ_pLY8-Aym"
```

**Before:**
```env
VITE_SUPABASE_URL=https://srlrbuphsogwgymqywhe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybHJidXBoc29nd2d5bXF5d2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NzYxMDksImV4cCI6MjA3MjM1MjEwOX0.AzxiHH4NtxxrGlv9d3E8-mGAGg1gO6e-ZJtEQ2DqPSc
```

**After:**
```env
VITE_SUPABASE_URL=https://srlrbuphsogwgymqywhe.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_5D-oXfd9WLrn1eP7fwkSaQ_pLY8-Aym
```

**Key Characteristics:**
- ✅ No quotes around values
- ✅ No spaces around `=`
- ✅ New key format: `sb_publishable_` prefix (not `eyJ...` JWT format)
- ✅ Key length: ~40 characters (new format) vs 208 chars (legacy JWT)

---

## How to Run Frontend with Fixed Config

### Step 1: Ensure Dev Server is Stopped

If dev server is running, stop it:
- Press `Ctrl+C` in the terminal running `npm run dev`
- Or close the terminal window

**Why:** Vite caches env vars on startup. Changes to `.env` require server restart.

---

### Step 2: Start Dev Server on Port 8080

```bash
npm run dev
```

**Note:** `vite.config.ts` already configures port 8080:
```typescript
server: {
  host: "::",
  port: 8080,
}
```

So `npm run dev` (which runs `vite`) will automatically start on port 8080.

---

### Step 3: Verify in Browser Console

Navigate to `http://localhost:8080` and open DevTools (F12) → Console tab.

**Expected Output:**
```
[Supabase Client] URL: https://srlrbuphsogwgymqywhe.supabase.co
[Supabase Client] ANON length: 40
[Supabase Client] ANON prefix: sb_publishab...
```

**Key Checks:**
- ✅ ANON prefix should show `sb_publishab...` (not `eyJhbGciOiJI...`)
- ✅ ANON length should be ~40 (not 208)
- ❌ If you still see `eyJhbGciOiJI...`, the server wasn't restarted or `.env` wasn't saved

---

### Step 4: Verify Network Requests

Open DevTools → Network tab → Filter: `token`

**Look for:**
```
POST https://srlrbuphsogwgymqywhe.supabase.co/auth/v1/token?grant_type=password
```

**Expected Response:** 200 OK

**Response Body Should Include:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": {
    "id": "...",
    "email": "demo.teacher@example.com",
    ...
  }
}
```

**If 401 Unauthorized:**
- Check Request Headers → `apikey` should be `sb_publishable_5D-...` (not `eyJ...`)
- If still using old key → Dev server not restarted, or browser cache issue

---

### Step 5: Verify Auth Flow

**Expected Sequence in Console:**
1. `Demo user authenticated successfully` (from `ensureSupabaseAuth`)
2. `Profile updated silently` (from profile upsert)

**Expected Behavior:**
- No errors in console
- Can navigate to `/teacher-login`
- Can login with any username/password (demo mode)
- Redirects to `/teacher-dashboard` successfully

---

## Verification Commands (Optional)

### Verify `.env` File Contents

```powershell
Get-Content .env
```

**Expected Output:**
```
VITE_SUPABASE_URL=https://srlrbuphsogwgymqywhe.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_5D-oXfd9WLrn1eP7fwkSaQ_pLY8-Aym
```

---

### Test Auth Directly (Outside App)

```bash
curl -X POST "https://srlrbuphsogwgymqywhe.supabase.co/auth/v1/token?grant_type=password" ^
  -H "apikey: sb_publishable_5D-oXfd9WLrn1eP7fwkSaQ_pLY8-Aym" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"demo.teacher@example.com\",\"password\":\"DemoPassword2024!\"}"
```

**Expected:** 200 OK with access_token

---

## Environment Variable Precedence in Vite

### How Vite Loads `.env` Files

Vite loads env files in this order (higher priority overrides lower):

1. `.env.[mode].local` (highest priority)
2. `.env.[mode]`
3. `.env.local`
4. `.env` (lowest priority)

**Mode** is determined by:
- `npm run dev` → `development` mode
- `npm run build` → `production` mode
- `npm run preview` → `production` mode

**In This Project:**
- ✅ Only `.env` exists
- ✅ No `.env.local` or `.env.development` to override
- ✅ No mode-specific files
- ✅ Simple, predictable env loading

**Key Rule:** Variables MUST start with `VITE_` prefix to be exposed to client code.

---

## Caveats & Notes

### Caveat 1: Dev Server Must Be Restarted

**If you modify `.env`:**
1. Stop dev server (`Ctrl+C`)
2. Restart: `npm run dev`

Vite does NOT hot-reload env vars. Changes require full restart.

---

### Caveat 2: Browser Cache

If dev server was restarted but old key still appears:
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Or: DevTools → Application → Clear Storage → "Clear site data"

---

### Caveat 3: Port Already in Use

If port 8080 is occupied:
```
Error: Port 8080 is already in use
```

**Solutions:**
- Find and kill the process using port 8080
- Or temporarily change port in `vite.config.ts`:
  ```typescript
  server: {
    host: "::",
    port: 5173, // or any free port
  }
  ```

---

### Caveat 4: Multiple Tabs/Windows

If you have multiple browser tabs open to `localhost:8080`:
- Some tabs may cache the old env vars
- Close ALL tabs, restart browser, then reopen app

---

## Why curl Worked But Browser Didn't

**curl Command:**
```bash
curl -X POST "..." -H "apikey: sb_publishable_5D-..."
```

- curl uses the key you **explicitly pass** in the command
- No file reading, no env vars, no caching
- Direct, immediate use of new key

**Browser (Vite Dev Server):**
```typescript
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

- Vite reads `.env` file **on server startup**
- Env vars are **baked into** the bundled JavaScript
- **Cached** until dev server restarts
- Browser was using the **old** value from the file on disk

**Result:** curl used new key directly, browser used old key from cached env.

---

## Key Format Differences

### Legacy JWT Format (Old)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybHJidXBoc29nd2d5bXF5d2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NzYxMDksImV4cCI6MjA3MjM1MjEwOX0.AzxiHH4NtxxrGlv9d3E8-mGAGg1gO6e-ZJtEQ2DqPSc
```

**Characteristics:**
- Starts with `eyJhbGciOiJI...`
- JWT format (3 base64 segments separated by `.`)
- Length: ~200-250 characters
- **Status:** Deprecated/disabled in newer Supabase projects

### New Publishable Key Format (Current)
```
sb_publishable_5D-oXfd9WLrn1eP7fwkSaQ_pLY8-Aym
```

**Characteristics:**
- Starts with `sb_publishable_`
- Opaque token format (not JWT)
- Length: ~40 characters
- **Status:** Current standard for Supabase projects

---

## Summary of Changes

### Files Modified
- ✅ `.env` (updated `VITE_SUPABASE_ANON_KEY` from legacy JWT to new publishable format)

### Files NOT Modified
- ✅ `src/integrations/supabase/client.ts` (already correct)
- ✅ `vite.config.ts` (already correct)
- ✅ `package.json` (already correct)
- ✅ No source code changes needed

### Configuration Verified
- ✅ Only one `.env` file exists
- ✅ No env overrides or multiple env files
- ✅ Vite port 8080 already configured
- ✅ Supabase client already reads correct env vars

---

## Post-Fix Checklist

After applying this fix:

- [ ] Stop any running dev server
- [ ] Verify `.env` has new key: `Get-Content .env`
- [ ] Start dev server: `npm run dev`
- [ ] Open `http://localhost:8080`
- [ ] Check console: `[Supabase Client] ANON prefix: sb_publishab...`
- [ ] Check ANON length: should be ~40 (not 208)
- [ ] Verify Network tab: `/auth/v1/token` returns 200 OK
- [ ] Verify no `AuthApiError: Legacy API keys are disabled`
- [ ] Test demo login flow: navigate to `/teacher-login`
- [ ] Confirm redirect to `/teacher-dashboard` works

---

## Related Documentation

- Initial investigation: `refactor/001-aulaplus-v0-codebase-investigation.md`
- Auth debug guide: `refactor/002-supabase-auth-and-demo-users-debug.md`
- Service key migration: `refactor/003-edge-function-service-key-migration.md`
- Bootstrap fix: `refactor/004-edge-functions-auth-bootstrap-fix.md`
- Env diagnosis: `docs/supabase-env-connection-diagnosis.md`

---

## Document Status

**Created:** 2025-12-09  
**Status:** Resolved  
**Root Cause:** `.env` file not actually updated with new key despite user belief  
**Fix:** Updated `.env` with correct `sb_publishable_...` key  
**Risk Level:** None (simple file content fix)  
**Verification:** Pending user restart of dev server and browser test

