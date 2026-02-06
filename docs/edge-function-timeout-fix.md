# Edge Function Timeout Fix: modify-evaluation-v2

## Root Cause Analysis

### Issue
`POST /functions/v1/modify-evaluation-v2` was returning **504 Gateway Timeout** errors, preventing evaluation generation.

### Root Causes Identified

1. **Compounding Retry Logic (CRITICAL)**
   - `retryWithBackoff()` had 3 retries with exponential backoff (1s, 2s, 4s delays)
   - `generateEvaluationV2()` had 3 attempts
   - **Worst case: 9 OpenAI API calls** (3 retries × 3 attempts)
   - Each OpenAI call takes 10-25s → Total could exceed 150s+

2. **No Timeout on OpenAI Fetch**
   - `fetch()` to OpenAI API had no `AbortController`
   - Could hang indefinitely on slow/stuck requests
   - No visibility into where time was being spent

3. **Large Token Counts**
   - `max_completion_tokens: 8000` resulted in longer response times
   - Version B prompt instructions added significant overhead

4. **Supabase Edge Function Limits**
   - Free tier: ~26s timeout
   - Pro tier: ~50s timeout
   - Our worst-case exceeded both limits easily

### Evidence (from logs)
```
[V2_RETRY] Attempt 1 failed, retrying in 1000ms...
[V2_RETRY] Attempt 2 failed, retrying in 2000ms...
[V2_RETRY] Attempt 3 failed
[V2_GENERATION] Attempt 2/3...
// Function killed by Supabase before completion
```

## Fix Implementation

### Changes Made

| Component | Before | After |
|-----------|--------|-------|
| Retry logic | 3 retries × 3 attempts = 9 calls | 2 attempts, no internal retries |
| OpenAI timeout | None | 25s AbortController |
| Total timeout budget | None | 40s with early exit |
| max_completion_tokens | 8000 | 6000 |
| Logging | Scattered console.log | Structured Timer with requestId |

### Key Code Changes

1. **Removed `retryWithBackoff()`** - Replaced with single `fetchWithTimeout()`

2. **Added `fetchWithTimeout()` helper:**
```typescript
async function fetchWithTimeout(url, options, timeoutMs, requestId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // ... fetch with signal: controller.signal
}
```

3. **Added timeout budget check:**
```typescript
if (timer.elapsed() > TOTAL_TIMEOUT_MS - 5000) {
  timer.log('ABORT: Only ${remaining}ms remaining, skipping attempt');
  break;
}
```

4. **Added structured logging with requestId:**
```typescript
const requestId = generateRequestId(); // e.g., "v2-m5k3x7-8h2a"
const timer = new Timer(requestId);
timer.log('OpenAI request starting');
// Logs: [v2-m5k3x7-8h2a] +1523ms OpenAI request starting
```

### Constants
```typescript
const OPENAI_TIMEOUT_MS = 25000;   // Max 25s for single OpenAI call
const TOTAL_TIMEOUT_MS = 40000;    // Max 40s total function runtime
```

## Response Changes

### Success Response (debug field)
```json
{
  "debug": {
    "model": "gpt-4.1-2025-04-14",
    "promptTokensEstimate": 2500,
    "completionTokensEstimate": 1200,
    "attempt": 1,
    "extractionMethod": "json_parse",
    "requestId": "v2-m5k3x7-8h2a",
    "timings": {
      "body_parsed": 12,
      "versions_computed": 15,
      "prompts_built": 45,
      "openai_attempt_1": 18234,
      "json_parsed": 18245,
      "validation_complete": 18250,
      "generation_complete": 18251
    },
    "totalDurationMs": 18300,
    "openaiDurationMs": 18200
  }
}
```

### Timeout Error Response
```json
{
  "success": false,
  "warnings": [{
    "code": "OPENAI_TIMEOUT",
    "message": "El servicio de IA tardó demasiado (>25000ms). Intenta de nuevo.",
    "severity": "error"
  }],
  "debug": {
    "requestId": "v2-m5k3x7-8h2a",
    "timings": { ... },
    "totalDurationMs": 25100
  }
}
```

## Manual Test Plan

### Test 1: Normal Group (10 students, A+B versions)
**Expected:**
- Completes in < 30s
- Returns `success: true`
- `debug.totalDurationMs` < 30000

### Test 2: Large Group (30 students, A+B+C versions)
**Expected:**
- Either completes in < 40s with `success: true`
- OR returns `success: false` with `OPENAI_TIMEOUT` warning (no 504)

### Test 3: Verify No 504
**Steps:**
1. Generate evaluation with V2 Beta toggle ON
2. Wait for response
3. Check browser Network tab - should see HTTP 200

**Pass criteria:**
- No 504 errors
- Clear error message if generation fails
- `requestId` visible in response for debugging

## Monitoring

### Log Search Queries (Supabase Dashboard)
```
# Find slow requests
requestId totalDurationMs > 30000

# Find timeouts
OPENAI_TIMEOUT

# Trace specific request
v2-m5k3x7-8h2a
```

### Recommended Alerts
- Alert if `totalDurationMs > 35000` (approaching limit)
- Alert if `OPENAI_TIMEOUT` count > 5/hour
- Alert if `success: false` rate > 10%

## Future Improvements

1. **Streaming Response** - Return partial progress to client
2. **Job Queue** - For very large evaluations, return 202 + job ID
3. **Prompt Caching** - Cache compiled system prompts
4. **Model Selection** - Use faster model (gpt-4o-mini) for retries
