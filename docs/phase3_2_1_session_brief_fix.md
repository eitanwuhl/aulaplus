# Phase 3.2.1 - Session Brief Display Fix

**Date**: 28 de diciembre de 2024  
**Status**: ✅ Implemented  
**Issue**: Teacher-provided per-session topics (session briefs) were not reflected in generated sessions or UI

---

## Root Cause Analysis

### Problem Summary

Users reported that after entering "temas de clase por sesión" (per-session topics) in the wizard, the generated sessions did NOT reflect those topics, and the UI (calendar/session cards) did not show the topics anywhere.

### Identified Root Causes

#### ✅ 1. UI Input - Working Correctly
**Location**: `src/components/planificacion/WizardSteps.tsx` lines 852-897

The user enters topics in **Step 2 of the wizard**, in the "Tema de cada clase (opcional)" section. Values are correctly stored in `wizardData.enfoque.sessionBriefs`.

**Status**: No issues found.

---

#### ✅ 2. Database Persistence - Working Correctly
**Location**: `src/pages/PlanificacionWizard.tsx` lines 166-244, 806

Session briefs are correctly persisted to `sesiones_clase.session_brief` before generation (Phase 3.2.1 implemented). Mapping by `orden` works correctly.

**Status**: No issues found.

---

#### ✅ 3. Payload to Edge Function - Working Correctly
**Location**: `src/pages/PlanificacionWizard.tsx` lines 397-418

`sessionBrief` is included in the payload sent to the Edge Function when present (line 414).

**Status**: No issues found.

---

#### ⚠️ 4. ISSUE #1: Weak Prompt in Edge Function

**Location**: `supabase/functions/generate-plan-completo/index.ts` lines 77-87, 168, 224

**Problem**: 
- The prompt mentions sessionBrief but does NOT make it **mandatory** in the H1.
- Line 168 had a ternary that allows a generic title if no sessionBrief:
  ```html
  <h1>${sessionBrief?.trim() ? sessionBrief.trim() : 'Título específico y claro...'}</h1>
  ```
- The AI could "interpret" or reformulate the brief instead of using it exactly.

**Impact**: AI could generate titles that don't reflect the teacher-provided sessionBrief.

**Fix Applied**:
1. **Hardened the prompt instructions** (lines 77-87):
   - Changed "CRÍTICO" to "CRÍTICO - OBLIGATORIO"
   - Made it explicit: "El título H1 DEBE SER EXACTAMENTE este sessionBrief, palabra por palabra"
   - Added: "Si sessionBrief existe, SIEMPRE tiene prioridad sobre cualquier otro título"

2. **Updated H1 placeholder** (line 168):
   - Changed from ternary to OR operator for consistency
   - Ensures sessionBrief is used when present

3. **Strengthened requirements** (line 224):
   - Changed to "OBLIGATORIO CRÍTICO: El título H1 DEBE SER EXACTAMENTE el sessionBrief"
   - Added "sin ninguna modificación, reformulación ni interpretación"
   - Emphasized "prioridad absoluta"

4. **Added titulo to JSON response** (line 236):
   - Updated expected JSON schema to include `"titulo"` field
   - Edge Function now extracts and returns the title

5. **Implemented title extraction logic** (after line 286):
   ```typescript
   // Priority: 1) sessionBrief (teacher override), 2) Extract H1 from generated HTML
   let extractedTitle = sessionBrief?.trim();
   if (!extractedTitle && parsed.plan_html) {
     const h1Match = parsed.plan_html.match(/<h1[^>]*>(.*?)<\/h1>/i);
     if (h1Match && h1Match[1]) {
       extractedTitle = h1Match[1].trim();
     }
   }
   parsed.titulo = extractedTitle;
   ```

---

#### ❌ 5. ISSUE #2: `titulo` Field Not Updated (CRITICAL)

**Location**: `src/pages/PlanificacionWizard.tsx` lines 455-465

**Problem**:
After generating the plan, multiple fields were updated: `plan_desarrollo`, `argumento_competencias`, `recursos`, `contenidos_anep`, etc.

**The `titulo` field was NOT updated**, even though it's what the UI uses to display the session name.

**Original Code**:
```typescript
.update({
  plan_desarrollo: { html_completo: data.plan_html },
  argumento_competencias: data.argumento_competencias,
  recursos: normalizeArrayField(data.recursos),
  contenidos_anep: normalizeArrayField(contenidosSesion),
  competencias_anep: normalizeArrayField(competenciasSesion),
  criterios_logro_anep: normalizeArrayField(criterios)
  // ❌ MISSING: titulo field
})
```

**Fix Applied**:
```typescript
// Build update payload
const updatePayload: any = {
  plan_desarrollo: { html_completo: data.plan_html },
  argumento_competencias: data.argumento_competencias,
  recursos: normalizeArrayField(data.recursos),
  contenidos_anep: normalizeArrayField(contenidosSesion),
  competencias_anep: normalizeArrayField(competenciasSesion),
  criterios_logro_anep: normalizeArrayField(criterios)
};

// ✅ PHASE 3.2.1 FIX: Update titulo if available
// Priority: 1) data.titulo (extracted from generated HTML), 2) sessionBrief (teacher input)
if (data.titulo) {
  updatePayload.titulo = data.titulo;
} else if (sessionBrief) {
  updatePayload.titulo = sessionBrief;
}

const { error: updateError } = await supabase
  .from('sesiones_clase')
  .update(updatePayload)
  .eq('id', sesion.id);
```

**Priority Logic**:
1. **First**: Use `data.titulo` (extracted from generated HTML by Edge Function)
2. **Fallback**: Use `sessionBrief` (teacher input, if extraction failed)

---

#### ❌ 6. ISSUE #3: UI Not Displaying session_brief

**Locations**:
- `src/components/planificacion/CalendarioDnD.tsx` line 206
- `src/components/planificacion/BacklogSesiones.tsx` line 57
- `src/pages/PlanificacionWorkspace.tsx` line 826

**Problem**:
All components used `sesion.titulo || "Sesión X"` but:
- `sesion.titulo` was `null` (never updated during generation)
- `sesion.session_brief` exists in DB but **was not used in UI**

**Original Code** (all three components):
```tsx
<span>{sesion.titulo || `S${sesion.orden}`}</span> // ❌ titulo is null
```

**Fix Applied**:

### CalendarioDnD.tsx
```tsx
<div className="flex flex-col gap-0.5">
  <div className="flex items-center gap-1">
    {sesion.bloqueo_reserva && <Lock className="h-3 w-3" />}
    <span className="truncate font-medium">
      {sesion.session_brief || sesion.titulo || `S${sesion.orden}`}
    </span>
  </div>
  {sesion.session_brief && sesion.contenidos_anep?.[0] && (
    <span className="text-[10px] text-muted-foreground truncate">
      {sesion.contenidos_anep[0]}
    </span>
  )}
</div>
```

**Enhancement**: When `session_brief` exists, shows ANEP content as secondary line.

### BacklogSesiones.tsx & PlanificacionWorkspace.tsx
```tsx
<h4 className="font-medium text-sm truncate">
  {sesion.session_brief || sesion.titulo || `Sesión ${sesion.orden}`}
</h4>

{sesion.contenidos_anep && sesion.contenidos_anep.length > 0 && (
  <p className="text-xs text-muted-foreground truncate mt-1">
    {sesion.session_brief ? `Contenido ANEP: ${sesion.contenidos_anep[0]}` : sesion.contenidos_anep[0]}
  </p>
)}
```

**Enhancement**: When `session_brief` exists, prefixes ANEP content with "Contenido ANEP:" to distinguish it.

**Display Priority**:
1. **First**: `session_brief` (teacher-provided topic override)
2. **Second**: `titulo` (extracted from generated HTML)
3. **Fallback**: `"Sesión N"` (default)

---

## Files Modified

| File | Lines | Type | Description |
|------|-------|------|-------------|
| `supabase/functions/generate-plan-completo/index.ts` | 77-87 | Modified | Hardened sessionBrief prompt section |
| `supabase/functions/generate-plan-completo/index.ts` | 168 | Modified | Updated H1 placeholder to use sessionBrief directly |
| `supabase/functions/generate-plan-completo/index.ts` | 224 | Modified | Strengthened requirements for sessionBrief usage |
| `supabase/functions/generate-plan-completo/index.ts` | 236 | Modified | Added `titulo` to expected JSON response |
| `supabase/functions/generate-plan-completo/index.ts` | 286+ | Added | Title extraction logic (sessionBrief → H1 → fallback) |
| `src/pages/PlanificacionWizard.tsx` | 450-475 | Modified | Added `titulo` to update payload with priority logic |
| `src/components/planificacion/CalendarioDnD.tsx` | 203-215 | Modified | Display session_brief first, show ANEP content as secondary |
| `src/components/planificacion/BacklogSesiones.tsx` | 54-67 | Modified | Display session_brief first, prefix ANEP content when needed |
| `src/pages/PlanificacionWorkspace.tsx` | 823-839 | Modified | Display session_brief first, prefix ANEP content when needed |

---

## Backward Compatibility

✅ **100% Backward Compatible**

| Scenario | Behavior |
|----------|----------|
| No sessionBrief provided | AI generates title based on ANEP content (unchanged) |
| sessionBrief provided | AI uses exact sessionBrief as H1 title (new) |
| Old sessions (no session_brief in DB) | Display `titulo` or fallback to "Sesión N" (unchanged) |
| Edge Function fails to extract title | Fallback to sessionBrief in PlanificacionWizard (safe) |
| All fields empty | Display "Sesión N" (unchanged) |

**Guarantees**:
- No breaking changes to existing sessions
- No database migrations required
- All changes are additive (new fields, new priorities)

---

## Solution Flow (End-to-End)

### 1. User Input (Wizard)
```
User fills "Tema de cada clase" inputs in Step 2
         ↓
wizardData.enfoque.sessionBriefs = ["Topic 1", "Topic 2", ...]
```

### 2. Persistence (Before Generation)
```
handleFinish() → persistSessionBriefs()
         ↓
UPDATE sesiones_clase SET session_brief = "Topic N" WHERE orden = N
```

### 3. Generation (Edge Function Call)
```
generarPlanesAutomaticamente()
         ↓
For each session:
  sessionBrief = sessionBriefsArray[i]
  payload = { ..., sessionBrief: "Topic N" }
         ↓
Edge Function: generate-plan-completo
```

### 4. Prompt Processing (Edge Function)
```
sessionBriefSection = "CRÍTICO - OBLIGATORIO: El título H1 DEBE SER EXACTAMENTE..."
         ↓
H1 placeholder = sessionBrief (NOT generic)
         ↓
Requirements = "OBLIGATORIO CRÍTICO: palabra por palabra, prioridad absoluta"
         ↓
OpenAI generates plan with H1 = sessionBrief
```

### 5. Title Extraction (Edge Function)
```
OpenAI response → JSON parse
         ↓
extractedTitle = sessionBrief || (extract H1 from HTML)
         ↓
Return: { plan_html, argumento_competencias, recursos, titulo: extractedTitle }
```

### 6. Database Update (PlanificacionWizard)
```
updatePayload = { plan_desarrollo, argumento_competencias, recursos, ... }
         ↓
if (data.titulo) updatePayload.titulo = data.titulo
else if (sessionBrief) updatePayload.titulo = sessionBrief
         ↓
UPDATE sesiones_clase WHERE id = sesion.id
```

### 7. UI Display (Calendar/Backlog/Workspace)
```
Display priority:
  1. sesion.session_brief (teacher override)
  2. sesion.titulo (extracted from generated HTML)
  3. "Sesión N" (fallback)
         ↓
If session_brief exists:
  - Primary line: session_brief
  - Secondary line: ANEP content (with "Contenido ANEP:" prefix)
```

---

## Console Logs Added

### Edge Function (generate-plan-completo)
```typescript
console.log('[generate-plan-completo] Extracted title:', extractedTitle);
```

### PlanificacionWizard (generarPlanesAutomaticamente)
```typescript
console.log(`Guardando para sesión ${sesion.orden}:`, {
  contenido: contenidosSesion[0]?.substring(0, 40),
  competencias: competenciasSesion.length,
  titulo: data.titulo || sessionBrief || '(sin título)'
});
```

**Purpose**: Verify that titles are being extracted and persisted correctly.

---

## Manual Test Plan

### Pre-Conditions
1. Database has `sesiones_clase.session_brief` column (migration already applied)
2. Edge Function is deployed with latest changes
3. Frontend is running with latest changes

---

### Test 1: Generate Plan with Session Briefs (Full Flow)

**Steps**:
1. Open Wizard (PlanificacionWizard)
2. Complete Step 0 (Context):
   - Select a group
   - Set dates (or choose "sin periodo")
   - Configure 10 sessions
3. Complete Step 1 (Schedule):
   - Configure weekly hours
4. Complete Step 2 (Content):
   - Add 3 ANEP content blocks (total 10 classes)
   - **Enter 10 session briefs** in "Tema de cada clase (opcional)":
     - Session 1: "Surgimiento y contexto histórico del Batllismo"
     - Session 2: "Reformas sociales del primer gobierno de Batlle"
     - Session 3: "Reformas políticas: voto secreto y sufragio"
     - Session 4: "Reformas económicas: estatización y proteccionismo"
     - Session 5: "Segunda presidencia de Batlle: profundización"
     - Session 6: "Oposición al Batllismo: sectores conservadores"
     - Session 7: "Impacto social: clase media y trabajadores"
     - Session 8: "Legado del Batllismo en Uruguay"
     - Session 9: "Comparación con otros movimientos latinoamericanos"
     - Session 10: "Proyecto integrador: Batllismo hoy"
5. Click "Finalizar"
6. Wait for automatic generation (several minutes)

**Expected Results**:
- ✅ All 10 session briefs are persisted to `sesiones_clase.session_brief` before generation
- ✅ Console shows: `[persistSessionBriefs] Successfully persisted 10 session briefs`
- ✅ Each generation call includes `sessionBrief` in payload
- ✅ Console shows for each session: `Guardando para sesión N: { ..., titulo: "..." }`
- ✅ Generated HTML has H1 matching sessionBrief exactly
- ✅ Database `sesiones_clase.titulo` is updated with sessionBrief
- ✅ UI (calendar/backlog) shows session brief as title

**Verification Queries** (Supabase SQL Editor):
```sql
-- Check session_brief persisted
SELECT orden, session_brief, titulo 
FROM sesiones_clase 
WHERE planificacion_id = 'YOUR_PLAN_ID'
ORDER BY orden;

-- Expected: All 10 rows have non-null session_brief and titulo matching
```

---

### Test 2: Verify UI Display (Calendar)

**Steps**:
1. Navigate to PlanificacionWorkspace for the generated plan
2. Open calendar view (if using CalendarioDnD component)
3. Hover over each session card

**Expected Results**:
- ✅ Session cards show **session brief as primary title** (not "Sesión N")
- ✅ Example: "Surgimiento y contexto histórico del Batllismo"
- ✅ Secondary line shows ANEP content (if present)
- ✅ No generic "Sesión 1", "Sesión 2" displayed when session_brief exists

---

### Test 3: Verify UI Display (Backlog)

**Steps**:
1. Create a plan "sin periodo" (backlog mode)
2. Enter 5 session briefs
3. Generate plan
4. View BacklogSesiones component

**Expected Results**:
- ✅ Backlog cards show **session brief as title**
- ✅ Subtitle shows "Contenido ANEP: [content]" when session_brief exists
- ✅ No generic "Sesión N" when session_brief exists

---

### Test 4: Verify Prompt Enforcement (H1 Extraction)

**Steps**:
1. Generate one session with sessionBrief = "La Revolución Industrial en Inglaterra"
2. Check Edge Function logs (Supabase dashboard)
3. Inspect generated HTML in database

**Expected Results**:
- ✅ Edge Function log shows: `[generate-plan-completo] Extracted title: La Revolución Industrial en Inglaterra`
- ✅ Generated HTML has: `<h1>La Revolución Industrial en Inglaterra</h1>`
- ✅ Database `titulo` field = "La Revolución Industrial en Inglaterra"
- ✅ **H1 is EXACTLY the sessionBrief** (no reformulation, no interpretation)

---

### Test 5: Backward Compatibility (No Session Brief)

**Steps**:
1. Create a new plan
2. Complete wizard **WITHOUT entering any session briefs** (leave all inputs empty)
3. Generate plan

**Expected Results**:
- ✅ Generation succeeds normally
- ✅ AI generates titles based on ANEP content (old behavior)
- ✅ UI displays generated titles or "Sesión N" fallback
- ✅ No errors or crashes

---

### Test 6: Partial Session Briefs

**Steps**:
1. Create a plan with 10 sessions
2. Enter session briefs for **only sessions 1, 3, 5, 7, 9** (leave 2, 4, 6, 8, 10 empty)
3. Generate plan

**Expected Results**:
- ✅ Sessions 1, 3, 5, 7, 9: Show teacher-provided brief as title
- ✅ Sessions 2, 4, 6, 8, 10: Show AI-generated title based on ANEP content
- ✅ No errors
- ✅ Mixed display works correctly in UI

---

### Test 7: Regeneration Preserves Session Brief

**Steps**:
1. Generate a plan with 10 session briefs
2. Open EditorSesionNuevo for one session
3. Click "Regenerar plan"
4. Check if session brief is still used

**Expected Results**:
- ✅ Session brief is reloaded from database
- ✅ Regenerated plan H1 still matches sessionBrief
- ✅ No loss of teacher-provided topic

**Note**: EditorSesionNuevo already loads session data including `session_brief` from database, so this should work automatically.

---

### Test 8: Verify Mapping by `orden` (Non-Contiguous)

**Steps**:
1. Manually create sessions in database with non-contiguous `orden`: 1, 3, 5, 7
2. Add session_brief for each
3. Verify UI and generation

**Expected Results**:
- ✅ loadSessionBriefs() handles sparse arrays correctly
- ✅ briefs[orden-1] mapping works
- ✅ No index out of bounds errors

---

## Regression Checklist

| Test | Description | Status |
|------|-------------|--------|
| Phase 1 | Unit assignment deterministic mapping | ✅ Not affected |
| Phase 2 | Progressive generation (unitContext) | ✅ Not affected |
| Phase 3 | Group profile usage | ✅ Not affected |
| Phase 3.1 | Session brief UI inputs | ✅ Enhanced |
| Phase 3.2 | Session brief persistence | ✅ Enhanced |
| Phase 4 | Group context from Supabase | ✅ Not affected |

---

## Known Limitations

1. **HTML Extraction Regex**:
   - Current regex: `/<h1[^>]*>(.*?)<\/h1>/i`
   - Handles simple H1 tags
   - May not handle nested HTML inside H1 (rare case)
   - **Mitigation**: sessionBrief fallback ensures titulo is always set

2. **Long Session Briefs**:
   - No character limit enforced in UI
   - Very long briefs may truncate in calendar view
   - **Mitigation**: CSS `truncate` class handles overflow gracefully

3. **Special Characters**:
   - sessionBrief is trimmed but not sanitized beyond that
   - HTML special chars (< > &) should be escaped by browser automatically
   - **Mitigation**: React/TSX handles escaping automatically

---

## Future Enhancements (Out of Scope)

1. **Character limit** in wizard inputs (e.g., 80 chars)
2. **Preview** of how brief will appear in calendar before generating
3. **Bulk edit** session briefs after generation (without regenerating)
4. **Copy session brief** to clipboard from UI
5. **Validate uniqueness** of session briefs (warn if duplicates)

---

## Conclusion

✅ **Phase 3.2.1 Session Brief Display Fix - COMPLETED**

**Impact**:
- 🎯 Teacher-provided session topics now appear in generated plans (H1)
- 📊 Session topics visible in calendar, backlog, and workspace UI
- 🔄 Backward compatible (no breaking changes)
- ✅ Three critical issues fixed (weak prompt, missing titulo update, UI not showing brief)

**Before**:
- sessionBrief stored but ignored during generation
- titulo field never updated
- UI showed "Sesión N" or null

**After**:
- sessionBrief enforced as exact H1 title
- titulo extracted and persisted
- UI shows session brief as primary display

**Testing**: Manual test plan provided for comprehensive verification.

---

**Related Documents**:
- `docs/phase3_1_ui_implementation.md` - Session brief UI inputs
- `docs/phase3_2_implementation_report.md` - Session brief persistence
- `docs/phase3_2_1_code_changes.md` - Previous Phase 3.2.1 fixes (mapping by orden)
- `docs/PHASE4_SUMMARY.md` - Group profile consistency

















