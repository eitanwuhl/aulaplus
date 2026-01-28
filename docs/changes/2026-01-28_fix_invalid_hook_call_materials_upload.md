# Bug Fix: Invalid Hook Call in Materials Upload

**Date**: 2026-01-28  
**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Type**: Bug Fix  
**Severity**: High (blocking feature)

---

## Summary

Fixed "Invalid hook call" error when uploading materials in "Biblioteca de Materiales". The error was caused by calling `useQueryClient()` inside a callback function instead of at the component/hook top level, violating React's Rules of Hooks.

---

## Bug Report

### Symptoms

When attempting to upload a material:
1. Navigate to "Biblioteca de Materiales"
2. Click "Subir Material"
3. Select a PDF file
4. Keep default title
5. Click "Subir Material"

**Result**: Red toast appears with error message:
```
Invalid hook call. Hooks can only be called inside of the body of a function component...
```

**Expected**: File uploads successfully, material record is created, and the UI refreshes to show the new material.

---

## Root Cause

**File**: `src/hooks/useMaterials.ts`  
**Function**: `useUploadAndCreateMaterial()`  
**Line**: 311 (before fix)

**Violation**: The hook `useQueryClient()` was being called **inside the `onSuccess` callback** instead of at the top level of the custom hook.

### Code Before (INCORRECT):

```typescript
export function useUploadAndCreateMaterial() {
  const uploadMutation = useUploadMaterial();
  const createMutation = useCreateMaterial();

  return useMutation({
    mutationFn: async ({ ... }) => { ... },
    onSuccess: ({ material }) => {
      // ❌ WRONG: Hook called inside callback
      const queryClient = useQueryClient();
      queryClient.invalidateQueries({ queryKey: materialsKeys.lists() });
      
      toast({ ... });
    },
    onError: (error: Error) => { ... }
  });
}
```

**Why This Breaks**:
- React Hooks must be called at the **top level** of a React component or custom hook
- Calling hooks inside callbacks, loops, or conditionals violates the Rules of Hooks
- React expects hooks to be called in the same order on every render
- When `useQueryClient()` was called inside `onSuccess`, React detected it was being called conditionally (only when mutation succeeds), causing the error

---

## Fix Applied

**Approach**: Move `useQueryClient()` call to the top level of the hook, alongside other hook calls.

### Code After (CORRECT):

```typescript
export function useUploadAndCreateMaterial() {
  const uploadMutation = useUploadMaterial();
  const createMutation = useCreateMaterial();
  const queryClient = useQueryClient(); // ✅ FIX: Moved to top level

  return useMutation({
    mutationFn: async ({ ... }) => { ... },
    onSuccess: ({ material }) => {
      // ✅ CORRECT: Use queryClient (captured in closure)
      queryClient.invalidateQueries({ queryKey: materialsKeys.lists() });
      
      toast({ ... });
    },
    onError: (error: Error) => { ... }
  });
}
```

**Why This Works**:
- `useQueryClient()` is now called at the top level of the custom hook
- The `queryClient` instance is captured in the closure and can be safely used in callbacks
- React can now track the hook call consistently across renders
- No Rules of Hooks violation

---

## Files Modified

### ✅ `src/hooks/useMaterials.ts`

**Change**: Moved `useQueryClient()` call from inside `onSuccess` callback to top level of `useUploadAndCreateMaterial()` hook.

**Lines**: ~269-327  
**Impact**: Fixes the invalid hook call error while preserving the same functionality (query invalidation on successful upload).

---

## Verification Steps

### 1. Build Verification
```bash
npm run build
```
**Result**: ✅ Build passes successfully (4338 modules, no errors)

### 2. Lint Verification
```bash
npm run lint -- src/hooks/useMaterials.ts
```
**Result**: ✅ No linter errors

### 3. Manual Testing (Recommended)

#### Test Case 1: Upload PDF Material
1. Navigate to "Biblioteca de Materiales"
2. Click "Subir Material"
3. Select a PDF file
4. Enter title: "Test Material"
5. Click "Subir Material"

**Expected**:
- ✅ No "Invalid hook call" error
- ✅ File uploads to `teacher-materials` bucket under `${userId}/pdfs/`
- ✅ Material record created in `teacher_materials` table
- ✅ Green toast: "Material creado: Test Material creado exitosamente"
- ✅ Dialog closes
- ✅ New material appears in the list immediately

#### Test Case 2: Upload with Metadata
1. Click "Subir Material"
2. Select a file
3. Add tags: "historia, batllismo"
4. Add notes: "Material para unidad 3"
5. Upload

**Expected**:
- ✅ Upload succeeds
- ✅ Metadata stored in `material.metadata` JSONB field

#### Test Case 3: Error Handling
1. Disconnect network
2. Attempt upload

**Expected**:
- ✅ Red toast: "Error al crear material"
- ✅ No "Invalid hook call" error

---

## Related Hooks Verification

Verified that all other hooks in the file follow the same pattern:

### ✅ `useCreateMaterial()` (line 116)
```typescript
export function useCreateMaterial() {
  const queryClient = useQueryClient(); // ✅ Top level
  return useMutation({ ... });
}
```

### ✅ `useUpdateMaterial()` (line 153)
```typescript
export function useUpdateMaterial() {
  const queryClient = useQueryClient(); // ✅ Top level
  return useMutation({ ... });
}
```

### ✅ `useArchiveMaterial()` (line 195)
```typescript
export function useArchiveMaterial() {
  const queryClient = useQueryClient(); // ✅ Top level
  return useMutation({ ... });
}
```

**Conclusion**: Only `useUploadAndCreateMaterial()` had the invalid hook call. All other hooks were already correct.

---

## Backward Compatibility

✅ **100% Backward Compatible**

- No API changes
- No prop changes
- No breaking changes to components using this hook
- Same functionality, just fixed the Rules of Hooks violation

**Components Using This Hook**:
- `src/components/materials/UploadMaterialDialog.tsx` (line 33)
- `src/pages/BibliotecaMateriales.tsx` (likely, not verified)

All components will continue to work without any changes.

---

## React Rules of Hooks (Reference)

As per [React documentation](https://react.dev/warnings/invalid-hook-call-warning):

**Rules**:
1. ✅ Only call hooks at the **top level** of a React function component or custom hook
2. ❌ Don't call hooks inside loops, conditions, or nested functions
3. ✅ Custom hooks must start with `use` (e.g., `useUploadAndCreateMaterial`)

**Common Violations**:
- Calling hooks inside `useEffect` callbacks
- Calling hooks inside event handlers
- Calling hooks inside `onSuccess`/`onError` callbacks ← **Our bug**
- Calling hooks inside `setTimeout`/`setInterval`

**Fix Pattern**:
```typescript
// ❌ WRONG
function useExample() {
  return useMutation({
    onSuccess: () => {
      const client = useQueryClient(); // ❌ Hook in callback
      client.invalidateQueries(...);
    }
  });
}

// ✅ CORRECT
function useExample() {
  const client = useQueryClient(); // ✅ Hook at top level
  return useMutation({
    onSuccess: () => {
      client.invalidateQueries(...); // ✅ Use captured value
    }
  });
}
```

---

## Architecture Compliance

### ✅ SSoT Guardrails
- **Explicit save pattern**: Not affected
- **Soft delete pattern**: Not affected
- **User isolation (RLS)**: Not affected
- **Backward compatibility**: ✅ Maintained

### ✅ Code Quality
- **Rules of Hooks**: ✅ Now compliant
- **TypeScript**: ✅ No type errors
- **Linting**: ✅ No new errors
- **Build**: ✅ Passes

---

## Commit Information

**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Commit Message**: `fix(materials): move useQueryClient to top level (Rules of Hooks)`

**Files Changed**: 1
- `src/hooks/useMaterials.ts` (1 line moved)

---

## Related Documentation

- [React Rules of Hooks](https://react.dev/warnings/invalid-hook-call-warning)
- [TanStack Query - useQueryClient](https://tanstack.com/query/latest/docs/react/reference/useQueryClient)
- [docs/ARCHITECTURE_SSoT.md](../ARCHITECTURE_SSoT.md) - Project architecture
- [docs/changes/2026-01-27_02_materials_service_layer.md](./2026-01-27_02_materials_service_layer.md) - Original materials implementation

---

## Conclusion

✅ **Bug fixed successfully**  
✅ **Rules of Hooks compliant**  
✅ **Build passes**  
✅ **No breaking changes**  
✅ **Ready for testing**

The materials upload feature should now work correctly without any "Invalid hook call" errors.

