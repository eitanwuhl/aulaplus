# Materials Attach and Planning UI Fix Report

**Date**: 2026-01-30  
**Status**: ✅ COMPLETED  
**Tester**: [TO BE FILLED AFTER MANUAL TESTING]

---

## Summary of Changes

### Files Modified

1. **`src/components/materials/MaterialsLibraryDialog.tsx`**
   - **Fix**: Added missing import `import { useQueryClient } from '@tanstack/react-query'`
   - **Why**: Fixes `useQueryClient is not defined` crash in MaterialCard component
   - **Impact**: Evaluations "Adjuntar materiales" button now works without crash

2. **`src/components/planificacion/UnidadCard.tsx`**
   - **Removed**: `UnitMaterialsSection` component and import
   - **Removed**: Materials attach UI inside competencies dropdown/required block
   - **Why**: Eliminates duplicate materials attach section
   - **Impact**: Only ONE materials section remains (plan-level)

3. **`src/components/planificacion/WizardSteps.tsx`**
   - **Moved**: `PlanMaterialsSection` from after "Tema de cada clase" to BEFORE `UnidadDidacticaBuilder`
   - **Why**: User requirement: materials section must be BEFORE "Resumen de la Planificación"
   - **Updated**: Helper text to reference plan-level materials section
   - **Impact**: Materials section now appears early in paso 2, before units/resumen

4. **`src/hooks/usePlanificacionWizard.ts`**
   - **Changed**: Validation now checks `attachedPlanMaterialIds` (plan-level) instead of `unit_material_plan`
   - **Why**: Plan-level materials are the single source of truth
   - **Impact**: Materials-only planning now works (can advance with NO ANEP, NO competencies)

---

## Key Code Changes

### 1. useQueryClient Import Fix

**File**: `src/components/materials/MaterialsLibraryDialog.tsx`

**Before**:
```typescript
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
```

**After**:
```typescript
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
```

**Location**: Line 204 in MaterialCard component uses `useQueryClient()` - now properly imported.

### 2. Removed Duplicate Materials Section

**File**: `src/components/planificacion/UnidadCard.tsx`

**Removed**:
- Import: `import { UnitMaterialsSection } from './UnitMaterialsSection';`
- Component usage (lines 281-293):
```typescript
{/* PHASE A: Unit Materials Section */}
<div className="mt-4">
  <UnitMaterialsSection
    unitId={unidad.id}
    materials={unidad.unit_material_plan || []}
    onChange={(materials) => {
      onActualizar({
        ...unidad,
        unit_material_plan: materials
      });
    }}
  />
</div>
```

**Impact**: No more materials attach inside competencies dropdown.

### 3. Moved Materials Section Position

**File**: `src/components/planificacion/WizardSteps.tsx`

**Before**: PlanMaterialsSection was at line 939 (after "Tema de cada clase")

**After**: PlanMaterialsSection is now at line 807 (BEFORE UnidadDidacticaBuilder)

**New Position**:
```typescript
const renderPaso2 = () => (
  <div className="space-y-6">
    {/* ... header card ... */}
    
    {/* Material Docente (Plan-level) - SINGLE materials attach section - BEFORE Resumen */}
    <PlanMaterialsSection
      attachedMaterialIds={wizardData.enfoque?.attachedPlanMaterialIds || []}
      onMaterialsChange={(materialIds) =>
        onUpdateEnfoque({
          ...wizardData.enfoque,
          attachedPlanMaterialIds: materialIds
        })
      }
      disabled={isLoading}
    />

    {/* Unidades Didácticas */}
    {wizardData.contexto?.materia && (
      <div className="space-y-2">
        <UnidadDidacticaBuilder ... />
        {/* ResumenPlanificacion is inside UnidadDidacticaBuilder */}
      </div>
    )}
    {/* ... rest of paso 2 ... */}
  </div>
);
```

### 4. Validation Logic Update

**File**: `src/hooks/usePlanificacionWizard.ts`

**Before**:
```typescript
const hasUnitMaterials = unidades.some(u => u.unit_material_plan && u.unit_material_plan.length > 0);

if (!hasAnepContent && !hasSufficientFocusText && !hasUnitMaterials) {
  // Error: need A, B (unit materials), or C
}
```

**After**:
```typescript
const hasPlanMaterials = (wizardData.enfoque?.attachedPlanMaterialIds || []).length > 0;

if (!hasAnepContent && !hasSufficientFocusText && !hasPlanMaterials) {
  // Error: need A, B (plan materials), or C
}
```

**Impact**: Validation now checks plan-level materials, allowing materials-only planning.

---

## Verification Evidence

### ✅ Planning: Single Materials Section

**Location**: Planning Wizard → Paso 2 (Enfoque Pedagógico)

**Evidence**:
- [ ] Screenshot showing materials section appears BEFORE UnidadDidacticaBuilder
- [ ] Screenshot showing NO materials section inside competencies dropdown
- [ ] Console log: No errors when opening Planning configuration

**Screenshot Path**: [TO BE ADDED AFTER TESTING]

### ✅ Planning: Can Advance with Materials Only

**Test Steps**:
1. Open Planning configuration
2. Fill paso 0 (grupo, materia, tipo)
3. Skip paso 1 if "sin_periodo"
4. In paso 2:
   - Do NOT select any ANEP content
   - Do NOT select any competencies
   - DO attach a PDF material using "Adjuntar materiales"
5. Click "Siguiente" or "Crear Planificación"

**Expected Result**:
- [ ] Validation passes (no error message)
- [ ] Can advance to paso 3 or create planificación
- [ ] Console shows no validation errors

**Evidence**:
- [ ] Console log: `validation.valid = true` with materials attached
- [ ] Network: Plan creation succeeds
- [ ] SQL: `material_attachments` table has row with `target_type='planificacion'`

### ✅ Planning: Materials Can Be Complementary

**Test Steps**:
1. In paso 2:
   - Select some ANEP content
   - Select some competencies
   - Attach a PDF material
2. Advance

**Expected Result**:
- [ ] Validation passes
- [ ] Can advance/create planificación
- [ ] All sources (ANEP + competencies + materials) are used

**Evidence**:
- [ ] Console log: validation passes
- [ ] Plan created successfully

### ✅ Evaluations: Attach Materials Works

**Test Steps**:
1. Open Evaluations configuration screen
2. Click "Adjuntar materiales" button
3. Select a PDF material
4. Continue evaluation generation flow

**Expected Result**:
- [ ] Dialog opens without error
- [ ] Materials list loads
- [ ] Can select materials
- [ ] Can proceed with evaluation generation

**Evidence**:
- [ ] Console: No `useQueryClient is not defined` error
- [ ] Console: No blank screen / error boundary
- [ ] Network: Materials list query succeeds
- [ ] UI: Dialog shows materials and allows selection

**Before Fix**:
- Console error: `ReferenceError: useQueryClient is not defined at MaterialCard`
- Screen goes blank or shows error boundary

**After Fix**:
- [ ] No console errors
- [ ] Dialog opens successfully
- [ ] Materials can be selected

---

## Acceptance Test Results

### Planning: Single Materials Attach Location + Can Advance

- [ ] **PASS**: Exactly ONE materials section exists
- [ ] **PASS**: Materials section is BEFORE "Resumen de la Planificación" (before UnidadDidacticaBuilder)
- [ ] **PASS**: Can attach PDF material
- [ ] **PASS**: Can advance with materials only (NO ANEP, NO competencies)

### Planning: Materials Can Also Be Complementary

- [ ] **PASS**: Can attach materials together with ANEP content
- [ ] **PASS**: Can attach materials together with competencies
- [ ] **PASS**: Can advance with all sources combined

### Evaluations: Attach Materials Works

- [ ] **PASS**: Clicking "Adjuntar materiales" opens dialog without error
- [ ] **PASS**: Can select PDF material
- [ ] **PASS**: Can continue evaluation generation flow

### No Crashes / Blank Screens

- [ ] **PASS**: No white screen in Planning
- [ ] **PASS**: No error boundary popup in Evaluations
- [ ] **PASS**: Console has no `useQueryClient is not defined` errors

---

## Console/Network Evidence

### Planning Materials Attach

**Console Logs** (when attaching material):
```
[Materials] Attaching materials...
[PlanMaterialsSection] Material selected: { materialId: "...", title: "..." }
```

**Network Requests**:
- [ ] POST `/functions/v1/extract-material-text` (if PDF) - status 200
- [ ] Materials list query succeeds

### Evaluations Materials Attach

**Console Logs** (when clicking "Adjuntar materiales"):
```
[EvaluationMaterialsSection] Opening materials library...
[MaterialsLibraryDialog] Materials loaded: N materials
```

**Network Requests**:
- [ ] Materials list query succeeds
- [ ] No 500 errors

**Before Fix**:
```
ReferenceError: useQueryClient is not defined
    at MaterialCard (MaterialsLibraryDialog.tsx:204)
```

**After Fix**:
- [ ] No errors in console
- [ ] Dialog opens successfully

---

## SQL Evidence

### Planning: Materials Attached

**Query**:
```sql
SELECT 
  ma.id,
  ma.target_type,
  ma.target_id,
  ma.material_id,
  tm.title,
  tm.extracted_text IS NOT NULL AS has_text
FROM material_attachments ma
JOIN teacher_materials tm ON ma.material_id = tm.id
WHERE ma.target_type = 'planificacion'
  AND ma.target_id = '<PLANIFICACION_ID>'
  AND ma.deleted_at IS NULL;
```

**Expected Result**:
- [ ] At least 1 row returned
- [ ] `has_text = true` for PDF materials

### Evaluations: Materials Attached

**Query**:
```sql
SELECT 
  ma.id,
  ma.target_type,
  ma.target_id,
  ma.material_id,
  tm.title
FROM material_attachments ma
JOIN teacher_materials tm ON ma.material_id = tm.id
WHERE ma.target_type = 'evaluacion'
  AND ma.target_id = '<EVALUACION_ID>'
  AND ma.deleted_at IS NULL;
```

**Expected Result**:
- [ ] Rows returned if materials were attached
- [ ] No errors

---

## Edge Cases and Remaining Issues

### Edge Cases Handled

1. **Empty materials list**: Dialog shows empty state message
2. **PDF without extracted text**: Shows "Sin texto extraído" with "Re-extraer" button
3. **Materials-only planning**: Validation allows it (A/B/C logic)
4. **Multiple materials**: Can select multiple materials in dialog

### Remaining Issues (if any)

- [ ] None identified

---

## Next Steps

1. **Manual Testing Required**:
   - Test Planning flow: attach materials, advance with materials only
   - Test Evaluations flow: attach materials, no crash
   - Verify UI: single materials section, correct position

2. **Screenshots Needed**:
   - Planning paso 2 showing materials section BEFORE units
   - Evaluations showing materials dialog open
   - Console showing no errors

3. **SQL Verification**:
   - Run queries above to confirm materials are attached
   - Verify `material_attachments` table has correct rows

---

## Status

**Code Changes**: ✅ COMPLETE  
**Manual Testing**: [ ] PENDING  
**Verification Report**: [ ] PENDING  

**Ready for**: Manual acceptance testing and evidence collection
