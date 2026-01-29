# Planning: Use Materials Extracted Text in Generation

**Date**: 2026-01-29  
**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Type**: Feature Fix  
**Severity**: High (User-facing bug)

---

## Summary

Fixed planning/class generation to use teacher materials `extracted_text` in AI context, enabling materials-only generation (without ANEP content) to produce specific, non-generic content.

---

## Problem

**Symptom**: Planning generation using ONLY teacher materials produced generic content (material was ignored).

**Root Cause**: 
- `loadAttachedMaterialsForSession` didn't include `extracted_text` from `teacher_materials`
- `formatMaterialsForAI` didn't include extracted text in the prompt
- Edge function `generate-plan-completo` didn't receive/use materials context properly
- No special instructions for materials-only mode (when no ANEP content)

---

## Solution

### 1. Updated `loadAttachedMaterials.ts`

**File**: `src/utils/loadAttachedMaterials.ts`

**Changes**:
- Added `extracted_text` and `mime_type` to `AttachedMaterialForAI` interface
- Updated `loadAttachedMaterialsForSession` to fetch and include `extracted_text` from `teacher_materials`
- Updated `formatMaterialsForAI` to include extracted text (truncated to 2000 chars) in the prompt
- Added special instructions for materials-only mode

**Before**:
```typescript
export interface AttachedMaterialForAI {
  material_id: string;
  title: string;
  focus_text?: string;
  source: 'plan' | 'session';
}
```

**After**:
```typescript
export interface AttachedMaterialForAI {
  material_id: string;
  title: string;
  focus_text?: string;
  extracted_text?: string; // FIX: Include extracted PDF text
  mime_type?: string;
  source: 'plan' | 'session';
}
```

**Formatting**:
- Includes `extracted_text` (truncated to 2000 chars) in the prompt
- Adds warning: "Si NO hay contenido ANEP especificado, estos materiales son la FUENTE PRINCIPAL del contenido."
- Instructs: "Debes usar conceptos, vocabulario, eventos y nombres específicos del material. NO uses plantillas genéricas."

### 2. Updated Edge Function `generate-plan-completo`

**File**: `supabase/functions/generate-plan-completo/index.ts`

**Changes**:
- Added `materialsContext` to request payload destructuring
- Built `materialsSection` with special instructions for materials-only mode
- Added `ai_design_report` to response JSON structure
- Ensured `ai_design_report` exists even in fallback cases

**Materials-Only Mode Instructions**:
```
⚠️ MODO MATERIALES-ONLY (SIN ANEP):
NO hay contenido ANEP especificado. Los materiales docentes adjuntos son la ÚNICA fuente de contenido.

REGLAS CRÍTICAS PARA MATERIALES-ONLY:
1. El contenido del plan DEBE basarse EXCLUSIVAMENTE en el texto extraído de los PDFs proporcionados.
2. NO uses plantillas genéricas ni contenido de relleno.
3. DEBES incluir conceptos, vocabulario, eventos, nombres y detalles ESPECÍFICOS del material.
4. Si el material menciona "Batllismo", "Batlle", "reformas sociales", etc., el plan DEBE usar esos términos exactos.
5. Las actividades DEBEN trabajar con el contenido real del material, no con abstracciones genéricas.
6. Las preguntas guía DEBEN referenciar conceptos específicos del material.
7. El título H1 DEBE reflejar el tema específico del material, no un título genérico.
```

**AI Design Report**:
- Added `ai_design_report` to JSON response structure
- Includes `inputsUsed`, `decisions`, `assumptions`
- Ensured it exists even in fallback/error cases

### 3. Updated Planning Generation Flow

**File**: `src/pages/PlanificacionWizard.tsx`

**Changes**:
- Updated `generarPlanesAutomaticamente` to include unit-level materials (`unit_material_plan`)
- Combines plan-level, session-level, and unit-level materials
- Accumulates `ai_design_report` from all sessions
- Persists aggregated `ai_design_report` to `planificaciones` table

**Unit Materials**:
- Checks if session's unit has `unit_material_plan`
- Includes materials if `claseEnUnidad <= unitMaterial.classCount`
- Fetches full material data including `extracted_text`
- Uses per-class guidance from `perClassGuidance[claseEnUnidad - 1]`

**AI Design Report Aggregation**:
- Accumulates reports from all generated sessions
- Aggregates into single report with:
  - `inputsUsed`: Combined flags from all sessions
  - `decisions`: Structure and time allocation
  - `assumptions`: Common assumptions
  - `sessionsGenerated`: Count of sessions

---

## Files Modified

1. **`src/utils/loadAttachedMaterials.ts`**
   - Added `extracted_text` and `mime_type` to interface
   - Updated loading to fetch extracted text
   - Updated formatting to include extracted text in prompt

2. **`supabase/functions/generate-plan-completo/index.ts`**
   - Added `materialsContext` to payload
   - Built materials section with materials-only instructions
   - Added `ai_design_report` to response

3. **`src/pages/PlanificacionWizard.tsx`**
   - Added unit-level materials loading
   - Combined all material sources (plan + session + unit)
   - Accumulated and persisted `ai_design_report`

---

## Verification

### Test Case: Materials-Only Generation

1. **Setup**:
   - Upload a PDF with specific identifiable content (e.g., "Batllismo y reformas sociales")
   - Create a new planification
   - Attach the material to the plan (or to a unit)
   - Do NOT select any ANEP content

2. **Generate**:
   - Click "Generar planes automáticamente"
   - Wait for generation to complete

3. **Verify**:
   - Generated plan includes specific terms from the PDF (e.g., "Batllismo", "Batlle", "reformas")
   - Plan does NOT contain generic placeholders
   - Activities reference specific concepts from the material
   - Title reflects the material's topic

### Expected Output

**Before Fix**:
- Generic: "Análisis de un período histórico"
- Generic: "Discusión sobre reformas"
- Generic: "Actividad de comprensión lectora"

**After Fix**:
- Specific: "El Batllismo y las reformas sociales de José Batlle y Ordóñez"
- Specific: "Análisis del texto sobre la Ley de 8 horas"
- Specific: "Debate sobre el impacto de las reformas batllistas en la sociedad uruguaya"

---

## Quality Gates

- ✅ **Build**: Passes (4339 modules)
- ✅ **Type Safety**: All TypeScript types correct
- ✅ **Backward Compatibility**: Existing flows (ANEP-only, mixed) still work

---

## Commit

**Commit**: `[will be added]`  
**Message**: `feat(planning): use materials extracted_text in generation + materials-only mode`

---

## Next Steps (TASK B)

- Add AI evidence panel to `PlanificacionWorkspace.tsx`
- Ensure `ai_design_report` is displayed after generation
- Update panel on modify actions

