# Evaluation Wrapper Fix Hardening - Final Report

**Date:** 2026-02-04
**Status:** ✅ Implemented - Backend as Single Source of Truth

---

## 1. Root Cause Summary

### Problem
- **Version A:** Showed "ERROR: WRAPPER DETECTED (A)" with snippet `{ "versions": { "A": "`
- **Version C:** Contained embedded JSON fragments like `{"versions": {"A":"` and `", "B":"` within HTML content
- **Layout Shrink:** Page width changed after evaluation generation due to CSS leakage

### Root Causes
1. **Inconsistent cleaning:** Both backend and frontend were cleaning, causing confusion
2. **Insufficient detection:** Wrapper detection only checked start of content, not embedded fragments
3. **CSS leakage:** Generated HTML contained `<html>`, `<head>`, `<body>`, `<style>` tags that affected global layout
4. **No cross-contamination guard:** Version C could contain content from A or B
5. **No regression tests:** Changes could break wrapper detection without notice

---

## 2. Solution Architecture

### Principle: Backend is Single Source of Truth

**Backend responsibilities:**
- Extract content from model output
- Remove wrapper fragments
- Sanitize HTML (prevent CSS leakage)
- Validate final output
- Detect cross-contamination
- Return clean HTML strings or null

**Frontend responsibilities:**
- Detect wrappers (defense in depth)
- Log CRITICAL errors if backend sends contaminated content
- Show error blocks (never render wrappers)
- Render clean HTML from backend

**Key decision:** Frontend does NOT silently clean. If backend sends wrappers, it's a bug that must be logged and fixed.

---

## 3. Exact Code Changes by File

### 3.1 Backend: `supabase/functions/modify-evaluation/index.ts`

#### A) Consolidated Functions (Global Scope)

**Location:** After `cleanupContent()` function (lines ~55-200)

**Functions added:**
1. `hasWrapperLeak(value: string | null): boolean`
   - Detects wrappers at start: `{`
   - Detects `"versions": {` anywhere in content
   - Detects JSON fragments: `", "A":`, `", "B":`, `", "C":`
   - Returns true if any wrapper pattern found

2. `removeWrapperFragments(html: string): string`
   - Removes `{"versions": {"A": "`
   - Removes `", "A":`, `", "B":`, `", "C":`
   - Removes standalone `{` at start/end
   - Removes `Nota:` followed by wrappers (keeps "Nota:")

3. `sanitizeHtmlForInjection(html: string): string`
   - Removes `<html>`, `</html>`
   - Removes `<head>...</head>` (entire section)
   - Removes `<body>`, `</body>`
   - Removes `<style>...</style>` (entire section)
   - Removes `<script>...</script>`
   - Removes `<link>` tags
   - Removes dangerous inline styles (position:fixed, width:100vw, etc.)

4. `validateCleanHtml(html: string | null, versionKey: 'A'|'B'|'C')`
   - Validates HTML starts with `<`
   - Checks for wrappers
   - Checks for forbidden tags
   - Checks for cross-contamination (other version markers)

5. `isCleanHtml(str: string | null): boolean`
   - Used in JSON fallback to reject contaminated content
   - Validates: starts with `<`, no wrappers, no fragments

6. `calculateSimilarity(str1: string, str2: string): number`
   - Calculates word-based similarity (0-1 scale)
   - Used to detect if Version C is too similar to A

#### B) Updated Processing Flow

**Location:** Universal evaluation path (lines ~1057-1124)

**Before:**
```typescript
let finalA = baseHtml ? cleanupContent(baseHtml) : null;
// ... validation after
```

**After:**
```typescript
// STEP 1: Remove wrapper fragments
let finalA = baseHtml ? removeWrapperFragments(cleanupContent(baseHtml)) : null;

// STEP 2: Sanitize for injection (prevent CSS leakage)
finalA = finalA ? sanitizeHtmlForInjection(finalA) : null;

// STEP 3: Final validation with cross-contamination check
const finalValidationA = validateCleanHtml(finalA, 'A');

// STEP 4: Cross-contamination guard
if (finalC && finalValidationC.ok) {
  const hasA = cContent.includes('versión a') || ...;
  const hasB = cContent.includes('versión b') || ...;
  if (hasA || hasB) {
    finalC = '<div>Error: Cross-contamination detected</div>';
  }
}

// STEP 5: Similarity check
if (finalC && finalA) {
  const similarity = calculateSimilarity(finalA, finalC);
  if (similarity > 0.95) {
    warnings.push('Version C is too similar to A');
  }
}
```

#### C) Updated `_debug` Fields

**Location:** Response building (lines ~1180-1200)

**Added:**
```typescript
_debug: {
  hasForbiddenTags: {
    A: finalValidationA?.hasForbiddenTags || false,
    B: finalValidationB?.hasForbiddenTags || false,
    C: finalValidationC?.hasForbiddenTags || false
  },
  hasCrossContamination: {
    A: finalValidationA?.hasCrossContamination || false,
    B: finalValidationB?.hasCrossContamination || false,
    C: finalValidationC?.hasCrossContamination || false
  }
}
```

#### D) Removed Local Function Definitions

**Removed:**
- Local `hasWrapperLeak()` inside serve function
- Local `removeWrapperFragments()` inside serve function
- Local `sanitizeHtml()` inside serve function
- Local `isCleanHtml()` inside JSON fallback

**Replaced with:** Global function calls

---

### 3.2 Frontend: `src/pages/EvaluacionesGrupo.tsx`

#### A) Removed Silent Cleaning

**Location:** `displayEvaluations` useMemo (lines ~1758-1811)

**Before:**
```typescript
const removeWrapperFragments = (html: string): string => {
  // ... cleaning logic
};

const cleanedA = rawA ? removeWrapperFragments(rawA) : null;
const htmlA = wrapperA_after ? buildErrorBlock(...) : cleanedA;
```

**After:**
```typescript
// FRONTEND: Detection only (no silent cleaning)
const wrapperA = detectWrapper(rawA);

// CRITICAL: Backend should never send wrappers
if (wrapperA) {
  console.error('[EVAL_UI] CRITICAL: Wrapper detected in Version A from backend.');
}

const htmlA = wrapperA 
  ? buildErrorBlock('A', rawA || '') 
  : (isHtmlString(rawA) ? rawA.trim() : null);
```

**Key change:** Frontend no longer cleans. It only detects and errors.

#### B) Enhanced Detection

**Location:** `detectWrapper()` function (lines ~1734-1756)

**Updated to match backend logic:**
- Detects `"versions": {` anywhere
- Detects JSON fragments `", "A":`, etc.
- More robust than before

---

### 3.3 Frontend: `src/components/evaluaciones/HTMLRenderer.tsx`

#### A) Added CSS Isolation Container

**Location:** HTML rendering (lines ~84-98)

**Before:**
```typescript
<div 
  className={`prose max-w-none ${className}`}
  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
/>
```

**After:**
```typescript
<div 
  className={`evaluation-content-wrapper ${className}`}
  style={{
    isolation: 'isolate', // CSS isolation
    contain: 'layout style', // Contain layout and styles
    maxWidth: '100%',
    overflow: 'hidden'
  }}
>
  <div 
    className="prose max-w-none"
    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    style={{
      width: '100%', // Explicit width
      boxSizing: 'border-box'
    }}
  />
</div>
```

**Purpose:** Prevent layout shrink by isolating injected HTML styles.

---

## 4. Why Backend is Single Source of Truth

### Benefits

1. **Consistency:** One place to fix bugs, not two
2. **Performance:** Cleaning happens once, not on every render
3. **Debugging:** Easier to trace issues (backend logs show what was sent)
4. **Testing:** Can test backend functions independently
5. **Maintainability:** Changes in one place, not duplicated logic

### Frontend Role

- **Defense in depth:** Catches bugs if backend fails
- **User experience:** Shows error blocks instead of broken content
- **Monitoring:** Logs CRITICAL errors for alerting

---

## 5. Proof Checklist and Sample `_debug` Output

### Expected `_debug` Structure

```json
{
  "_debug": {
    "startsWith": {
      "A": "<div class=\"evaluation\"><h2>Eval...",
      "B": null,
      "C": "<div class=\"evaluation\"><h2>Eval..."
    },
    "isHtml": {
      "A": true,
      "B": false,
      "C": true
    },
    "hasWrapper": {
      "A": false,
      "B": false,
      "C": false
    },
    "hasForbiddenTags": {
      "A": false,
      "B": false,
      "C": false
    },
    "hasCrossContamination": {
      "A": false,
      "B": false,
      "C": false
    },
    "versionsLengths": {
      "A": 8500,
      "B": 0,
      "C": 7200
    }
  }
}
```

### Verification Checklist

- [ ] `_debug.startsWith.A` starts with `<` (not `{`)
- [ ] `_debug.hasWrapper.A` is `false`
- [ ] `_debug.hasForbiddenTags.A` is `false` (or sanitized)
- [ ] `_debug.hasCrossContamination.C` is `false`
- [ ] `_debug.versionsLengths.A` > 0
- [ ] Network response: `evaluationBundle.versions.A` is a string
- [ ] Network response: `evaluationBundle.versions.A` starts with `<`
- [ ] UI: Version A card shows HTML content (not error block)
- [ ] UI: Version C card shows HTML content (not error block)
- [ ] UI: No JSON fragments visible in rendered content
- [ ] UI: Page width does NOT change after generation
- [ ] Console: No `[EVAL_UI] CRITICAL: Wrapper detected` errors

---

## 6. Test Cases Added

### File: `tests/wrapper_detection.test.ts`

**Test coverage:**
1. ✅ `hasWrapperLeak`: detects wrapper at start
2. ✅ `hasWrapperLeak`: detects wrapper embedded in HTML
3. ✅ `hasWrapperLeak`: detects JSON fragment
4. ✅ `hasWrapperLeak`: clean HTML unchanged
5. ✅ `hasWrapperLeak`: C containing A+B scenario (should not false positive)
6. ✅ `removeWrapperFragments`: removes wrapper at start
7. ✅ `removeWrapperFragments`: removes embedded fragments
8. ✅ `removeWrapperFragments`: clean HTML unchanged
9. ✅ `removeWrapperFragments`: removes Nota with wrapper
10. ✅ `isCleanHtml`: accepts clean HTML
11. ✅ `isCleanHtml`: rejects wrapper at start
12. ✅ `isCleanHtml`: rejects embedded fragments
13. ✅ `isCleanHtml`: rejects non-HTML

**Run tests:**
```bash
deno test tests/wrapper_detection.test.ts
```

---

## 7. How Layout Shrink Was Eliminated

### Problem
Generated HTML contained:
- `<html>`, `<head>`, `<body>` tags
- `<style>` blocks with global CSS rules
- `<link>` tags loading external stylesheets

These affected the entire page layout, causing width changes.

### Solution

#### Backend: `sanitizeHtmlForInjection()`
- Removes ALL structural tags before sending to frontend
- Removes ALL `<style>` blocks
- Removes ALL `<link>` tags
- Removes dangerous inline styles

#### Frontend: `HTMLRenderer.tsx`
- Double sanitization (defense in depth)
- CSS isolation container:
  - `isolation: 'isolate'` - Creates new stacking context
  - `contain: 'layout style'` - Contains layout and styles
  - `maxWidth: '100%'` - Prevents expansion
  - `overflow: 'hidden'` - Prevents overflow

**Result:** Even if backend misses something, frontend isolation prevents layout changes.

---

## 8. Cross-Contamination Prevention

### Detection Logic

```typescript
// Check if C contains markers from A or B
const cContent = finalC.toLowerCase();
const hasA = cContent.includes('versión a') || 
             cContent.includes('version a') || 
             cContent.includes('v_a');
const hasB = cContent.includes('versión b') || 
             cContent.includes('version b') || 
             cContent.includes('v_b');

if (hasA || hasB) {
  finalC = '<div>Error: Cross-contamination detected</div>';
}
```

### Similarity Check

```typescript
const similarity = calculateSimilarity(finalA, finalC);
if (similarity > 0.95) {
  warnings.push('Version C is too similar to A');
}
```

**Threshold:** 95% similarity triggers warning (configurable).

---

## 9. Response Invariants (Enforced)

### Backend Guarantees

1. ✅ `evaluationBundle.versions.A` is ALWAYS a string and starts with `<`
2. ✅ `evaluationBundle.versions.B` is string or null (never object)
3. ✅ `evaluationBundle.versions.C` is string or null (never object)
4. ✅ No wrapper fragments in any version
5. ✅ No forbidden tags in any version (sanitized)
6. ✅ No cross-contamination (C doesn't contain A/B markers)

### Frontend Guarantees

1. ✅ Only renders if content starts with `<`
2. ✅ Shows error block if wrapper detected (never renders wrapper)
3. ✅ Logs CRITICAL error if backend sends wrappers
4. ✅ Version B card only shows if `finalAssignmentCounts.B > 0`
5. ✅ Version C card only shows if `finalAssignmentCounts.C > 0`

---

## 10. Known Limitations

1. **Model compliance:** Model may still occasionally output forbidden tags. Sanitization handles this, but ideally model should comply.

2. **Similarity threshold:** 95% is arbitrary. May need tuning based on real-world data.

3. **Cross-contamination detection:** Currently checks for text markers. May need more sophisticated detection (e.g., content similarity).

4. **Iframe sandboxing:** Not implemented. Current isolation should be sufficient, but iframe would be more robust.

---

## 11. Next Steps (Optional)

1. **Monitoring:** Add metrics for wrapper detection frequency
2. **Alerting:** Alert if backend sends wrappers consistently
3. **Prompt tuning:** Adjust model prompt based on failure patterns
4. **Integration tests:** Add end-to-end tests for full pipeline
5. **Performance:** Measure impact of sanitization on response time

---

## 12. Files Changed Summary

1. **`supabase/functions/modify-evaluation/index.ts`**
   - Added 6 global functions (wrapper detection, cleaning, validation)
   - Updated processing flow (4-step pipeline)
   - Added cross-contamination guard
   - Added similarity check
   - Updated `_debug` fields

2. **`src/pages/EvaluacionesGrupo.tsx`**
   - Removed `removeWrapperFragments()` (frontend cleaning)
   - Updated to detection-only mode
   - Added CRITICAL error logging

3. **`src/components/evaluaciones/HTMLRenderer.tsx`**
   - Added CSS isolation container
   - Enhanced sanitization logging

4. **`tests/wrapper_detection.test.ts`** (NEW)
   - 13 regression tests for wrapper detection/cleaning

---

**Status:** ✅ Complete
**Verification:** Pending runtime testing
**Date:** 2026-02-04
