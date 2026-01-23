# Fix: Group Summary Adaptation Count

> **Date**: 2025-01-XX  
> **Issue**: Group summary incorrectly reported all students as having adjustments  
> **Status**: ✅ Fixed

---

## Problem Summary

The group summary in "Ver grupos" (TeacherGroups page) was incorrectly counting all students as having adjustments. For example, group "9no 1" with 10 students showed "10 alumnos con ajustes necesarios" even when only a few students actually required adjustments.

### Root Cause

**Location**: `src/pages/TeacherGroups.tsx` (lines 69-71, before fix)

**Incorrect Logic**:
```typescript
const studentsWithAdjustments = students.filter(student => 
  student.contemplaciones && student.contemplaciones.length > 0
).length;
```

**Problem**:
- Counted ALL students with ANY `contemplaciones` (accommodations list)
- Did not use the explicit adaptation flags (`requiereAdecuacionAcceso`, `requiereAdecuacionContenido`)
- All students in mock data have `contemplaciones` arrays (even if empty or with generic items)
- This caused false positives: students without formal adaptations were counted

---

## Solution

### New Rule (Source of Truth)

A student is considered "con ajustes necesarios" **if and only if**:
- `requiereAdecuacionAcceso === true` **OR**
- `requiereAdecuacionContenido === true`

**No inference allowed**:
- ❌ NOT from `contemplaciones.length`
- ❌ NOT from text in `modalidadCursado`
- ❌ NOT from presence of `informeTecnico`
- ❌ NOT from any other text-based inference

---

## Implementation

### Helper Function: `studentRequiresAdjustments()`

**Location**: `src/pages/TeacherGroups.tsx` (lines 61-93)

**Logic**:
1. **Primary Source**: Check `localStorage` for user-controlled values:
   - `adecuacionAcceso:${student.id}` → boolean
   - `adecuacionContenido:${student.id}` → boolean
   - If either is `true`, return `true`

2. **Fallback Source**: Check `student.informeTecnico` (if present in mock data):
   - `student.informeTecnico.requiereAdecuacionAcceso === true`
   - `student.informeTecnico.requiereAdecuacionContenido === true`
   - If either is `true`, return `true`

3. **Default**: Return `false` (no adjustments required)

**Code**:
```typescript
const studentRequiresAdjustments = (student: MockStudent): boolean => {
  // Check localStorage first (user-controlled values)
  try {
    const accesoKey = `adecuacionAcceso:${student.id}`;
    const contenidoKey = `adecuacionContenido:${student.id}`;
    
    const accesoFromStorage = localStorage.getItem(accesoKey);
    const contenidoFromStorage = localStorage.getItem(contenidoKey);
    
    if (accesoFromStorage !== null) {
      const accesoValue = JSON.parse(accesoFromStorage);
      if (accesoValue === true) return true;
    }
    
    if (contenidoFromStorage !== null) {
      const contenidoValue = JSON.parse(contenidoFromStorage);
      if (contenidoValue === true) return true;
    }
  } catch (error) {
    // If localStorage read fails, fall through to fallback
  }
  
  // Fallback: check student.informeTecnico (if present in mock data)
  if (student.informeTecnico) {
    if (student.informeTecnico.requiereAdecuacionAcceso === true) return true;
    if (student.informeTecnico.requiereAdecuacionContenido === true) return true;
  }
  
  // Default: no adjustments required
  return false;
};
```

---

### Updated Counting Logic

**Location**: `src/pages/TeacherGroups.tsx` (lines 95-120)

**Before**:
```typescript
const studentsWithAdjustments = students.filter(student => 
  student.contemplaciones && student.contemplaciones.length > 0
).length;
```

**After**:
```typescript
// Count students with explicit adjustment flags (source of truth)
const studentsWithAdjustments = students.filter(student => 
  studentRequiresAdjustments(student)
).length;
```

---

## Data Source Priority

### 1. localStorage (Primary - User-Controlled)

**Keys**:
- `adecuacionAcceso:${student.id}` → boolean
- `adecuacionContenido:${student.id}` → boolean

**Why Primary**: 
- These are set by the teacher via explicit checkboxes in StudentProfile
- They represent the current user-controlled state
- They persist across sessions

**Reading**:
- Check if key exists (`localStorage.getItem() !== null`)
- Parse JSON value
- Return `true` if value is `true`

---

### 2. student.informeTecnico (Fallback - Mock Data)

**Fields**:
- `student.informeTecnico.requiereAdecuacionAcceso` → boolean
- `student.informeTecnico.requiereAdecuacionContenido` → boolean

**Why Fallback**:
- Used if localStorage doesn't have values yet
- Allows mock data to have initial values
- Maintains backward compatibility

**Reading**:
- Check if `student.informeTecnico` exists
- Check each flag explicitly (`=== true`)
- Return `true` if either is `true`

---

### 3. Default (No Adjustments)

**Value**: `false`

**When Used**:
- localStorage has no value for the student
- `student.informeTecnico` is undefined or flags are `false`/undefined
- Any error reading localStorage

---

## UI Update Behavior

### Automatic Refresh

The count updates automatically when:
1. **Component Re-renders**: When `TeacherGroups` component re-renders, `getGroupStats()` is called, which reads fresh values from localStorage
2. **Returning from Student Profile**: When user navigates back from `StudentProfile`, the component re-renders and reads updated localStorage values
3. **State Changes**: Any state change in `TeacherGroups` triggers re-render and fresh count

**No Additional Refresh Logic Needed**:
- `getGroupStats()` is called during render (not memoized)
- Reads from localStorage on each call (always fresh)
- React's re-render cycle ensures updates are reflected

---

## Before/After Behavior

### Before

**Example**: Group "9no 1" with 10 students
- **Counted**: All 10 students (because all have `contemplaciones` arrays)
- **Display**: "10 alumnos con ajustes necesarios"
- **Problem**: Incorrect - most students don't actually require formal adaptations

**Logic**: 
```typescript
student.contemplaciones && student.contemplaciones.length > 0
```
- This counted students with ANY accommodations, even generic ones
- No distinction between access accommodations and content adaptations
- No use of explicit flags

---

### After

**Example**: Group "9no 1" with 10 students
- **Counted**: Only students with explicit flags set to `true`
- **Display**: "X alumnos con ajustes necesarios" (where X = actual count)
- **Result**: Accurate count based on explicit teacher declarations

**Logic**:
```typescript
studentRequiresAdjustments(student)
// Checks: requiereAdecuacionAcceso === true OR requiereAdecuacionContenido === true
```

**Scenarios**:
- **0 students with flags**: Shows nothing (count is 0, condition `stats.adjustmentsNeeded > 0` is false)
- **2 students with flags**: Shows "2 alumnos con ajustes necesarios"
- **All students with flags**: Shows "10 alumnos con ajustes necesarios" (only if all explicitly marked)

---

## Files Modified

1. **`src/pages/TeacherGroups.tsx`**
   - Added `studentRequiresAdjustments()` helper function (lines 61-93)
   - Updated `getGroupStats()` to use explicit flags instead of `contemplaciones.length` (lines 104-106)
   - Removed incorrect inference logic

---

## Edge Cases Handled

1. **localStorage Read Errors**:
   - Wrapped in try/catch
   - Falls through to fallback if parse fails
   - Never throws errors

2. **Missing localStorage Values**:
   - Checks `!== null` before parsing
   - Falls back to `student.informeTecnico` if not found
   - Defaults to `false` if neither source has values

3. **Undefined informeTecnico**:
   - Checks existence before accessing fields
   - Safe navigation prevents errors
   - Defaults to `false` if undefined

4. **Component Re-render**:
   - `getGroupStats()` called during render (not memoized)
   - Always reads fresh values from localStorage
   - Updates automatically when returning from StudentProfile

---

## Testing Recommendations

1. **Initial State**:
   - Open "Ver grupos" with no flags set
   - Verify count is 0 (or hidden if condition is `> 0`)

2. **Set Flags**:
   - Open a student profile
   - Toggle "Requiere adecuación de acceso" checkbox
   - Return to "Ver grupos"
   - Verify count increases by 1

3. **Multiple Students**:
   - Set flags for 2-3 students
   - Return to "Ver grupos"
   - Verify count matches number of students with flags

4. **Clear Flags**:
   - Uncheck all flags
   - Return to "Ver grupos"
   - Verify count returns to 0

5. **localStorage Persistence**:
   - Set flags, refresh page
   - Verify count persists after page reload

---

## Related Documentation

- `docs/STUDENT_PROFILE_ADAPTATION_FLAGS.md` - Implementation of explicit flags in student profile
- `docs/EVAL_PROFILES_PIPELINE.md` - How student profiles are used in evaluation generation

---

## Changes Made By Cursor

**Files Modified**:
1. `src/pages/TeacherGroups.tsx`
   - Added `studentRequiresAdjustments()` helper function
   - Updated `getGroupStats()` to use explicit flags
   - Removed incorrect `contemplaciones.length` counting logic

**Files Created**:
- `docs/GROUP_SUMMARY_ADAPTATION_COUNT_FIX.md` (this file)

**No Changes To**:
- Evaluation generation logic
- Database schema
- AI prompts or edge functions
- Student profile UI (flags already implemented)
- Other UI components

**Methodology**:
- Located counting logic in `getGroupStats()` function
- Created helper function following localStorage + fallback pattern
- Replaced inference-based counting with explicit flag checking
- Maintained automatic refresh via React re-render cycle
- Minimal changes (only counting logic, no UI changes)

---

## Backward Compatibility

✅ **Maintained**:
- Falls back to `student.informeTecnico` if localStorage not set
- Defaults to `false` if neither source has values
- No breaking changes to component interfaces
- Existing UI visuals unchanged (only the number changes)

---

## Future Integration

When these flags are used in evaluation generation (follow-up task):
- `requiereAdecuacionContenido === true` → Only trigger for Version 3 (content-adapted)
- `requiereAdecuacionAcceso === true` → Use for Version 2 (moderate support)
- Both flags `false` → Version 1 (standard)

The same `studentRequiresAdjustments()` logic can be reused in evaluation generation code.




