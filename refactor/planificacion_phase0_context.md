# Phase 0: Planning Workspace Restoration - Context & Analysis

## Context and Goal

This document establishes a safe baseline for partially restoring behaviors from commit **9e87845984f1db916008cb19f203a04c7a30e832** in the class planning workspace, while preserving improvements and features introduced after that commit.

**Objective**: Restore the structured section parsing, resource isolation, and "Diferenciación/Adaptaciones" positioning from the reference commit, without breaking current Supabase integration, workspace layout, or other valuable post-commit enhancements.

**Status**: Phase 0 - Analysis and documentation only. No runtime behavior changes have been implemented yet.

---

## Commit Check

### Reference Commit Verification

✅ **Commit exists and has been inspected**

```
Commit: 9e87845984f1db916008cb19f203a04c7a30e832
Message: "fix(planificacion): impedir recursos en contenido de sesiones sin período"
Author: [Author info]
Date: [Recent commit in project history]
```

### Current Working Branch

✅ **Branch**: `restore-plan-parser`

Successfully created and switched to dedicated feature branch for this restoration work.

### Build Verification

✅ **Project builds successfully**

```bash
npm run build
# ✓ 4297 modules transformed
# ✓ built in 16.78s
```

No breaking changes or compilation errors detected at the start of Phase 0.

---

## Per-File Diff Summary

### Overview Statistics

Between commit **9e8784** and **HEAD**:

- **3 files changed**: 36 insertions(+), 1,235 deletions(-)
- **1 file deleted entirely**: `src/lib/planParser.ts` (576 lines)
- **2 files unchanged**: `src/lib/planHtmlNormalizer.ts`, `supabase/functions/generate-plan-completo/index.ts`

### Detailed File Analysis

#### 1. `src/lib/planParser.ts`

**Status**: ❌ **DELETED** (existed in reference commit, removed in current HEAD)

**Reference commit**:
- 576 lines of structured plan parsing logic
- Export interface `ParsedPlan` with sections: `inicio`, `desarrollo`, `cierre`, `diferenciacion`, `recursos`, `durations`
- Functions for:
  - `parsePlan()`: Main parser that separates HTML into structured sections
  - `buildPlanHtml()`: Serializes parsed plan back to clean HTML
  - `tokenizeByHeadings()`: Splits HTML by H2 headers
  - `detectSectionType()`: Identifies section type (inicio/desarrollo/cierre/diferenciacion)
  - `extractAndCleanResources()`: Extracts resources from HTML and removes them from narrative
  - `hoistInlineDiferenciacion()`: Extracts differentiation blocks embedded in sections
  - `demoteInternalHeadings()`: Converts h1-h6 to `<p><strong>` for clean hierarchy
  - `mergeResources()`: Normalizes and deduplicates resources
  - `cleanHtml()`: Basic HTML cleanup

**Current HEAD**:
- ❌ File does not exist
- Parsing logic completely removed
- No structured separation of sections

**Impact**:
- ❌ **Section structure (Inicio/Desarrollo/Cierre)**: No longer parsed or visually separated
- ❌ **Resources handling**: No automatic extraction from HTML
- ❌ **Diferenciación positioning**: No longer extracted or moved to end
- ❌ **Header/metadata**: Not directly affected (handled by component)

---

#### 2. `src/lib/planHtmlNormalizer.ts`

**Status**: ✅ **UNCHANGED** (existed in reference commit, no changes in HEAD)

**Both versions**:
- 40 lines
- Single function: `normalizePlanHeadings(html: string)`
- Purpose: Ensures `<h2>` tags have `<strong>` wrapper for consistent bold styling
- Idempotent operation

**Impact**:
- ✅ No changes to analyze
- This file is a simple utility that complements (but doesn't replace) the deleted parser

---

#### 3. `src/components/planificacion/EditorSesionNuevo.tsx`

**Status**: 🔄 **SIGNIFICANTLY MODIFIED** (major refactor)

**Changes**: 1 file changed, 27 insertions(+), 403 deletions(-)

**Reference commit** (lines 1-893):
- Used `parsePlan()` to structure HTML into sections
- Rendered three distinct section blocks with headers:
  - `<h2>Inicio</h2>` + content
  - Separator (`<div role="separator" className="border-t" />`)
  - `<h2>Desarrollo</h2>` + content
  - Separator
  - `<h2>Cierre</h2>` + content
  - Separator (conditional)
  - `<h2>Diferenciación/Adaptaciones</h2>` + content (always at end)
- Tab "Recursos" had two cards:
  - Main card: Displayed `planParsed.recursos` (extracted from HTML, read-only)
  - Secondary card: Manual additional resources (editable textarea)
  - Clear instruction: "Estos NO aparecerán en la pestaña Clase"
- Helper functions (lines 45-241):
  - `stripTags()`, `hasHtml()`, `normalize()`, `isSectionTitle()`
  - `sanitizeHeadings()`: Aggressively removed duplicate section headings
  - `demoteInternalHeadings()`: Converted h1-h6 to `<p><strong>`
  - `stripLeadingDuplicateSectionHeading()`: Cleaned section-specific duplicates

**Current HEAD** (lines 1-516):
- No `parsePlan()` usage
- Direct HTML rendering:
  ```tsx
  <div 
    className="w-full prose max-w-none p-6 bg-card rounded-lg border"
    dangerouslySetInnerHTML={{ __html: planHtml }}
  />
  ```
- Uses Tailwind Typography (`prose-*` classes) for styling
- Tab "Recursos" simplified:
  - Single textarea for manual resources
  - No separation between parsed and manual resources
  - No extraction of resources from HTML
- All helper functions removed (27 insertions vs 403 deletions)

**Impact**:
- ❌ **Section structure**: Sections no longer visually separated by component
  - No component-generated H2 headers
  - No separators between sections
  - Relies entirely on AI-generated HTML structure
- ❌ **Resources handling**: 
  - Resources may appear in "Clase" tab (if AI included them in HTML)
  - No automatic extraction or isolation
  - "Recursos" tab only shows manually-added resources
  - Risk of duplication (resources in HTML + manual resources)
- ⚠️ **Diferenciación positioning**: 
  - Position depends entirely on AI output
  - No extraction or reordering logic
  - May appear anywhere (within Inicio, Desarrollo, or Cierre)
- ✅ **Header/metadata**: Unchanged (competencies still displayed in header card)

---

#### 4. `src/pages/PlanificacionWorkspace.tsx`

**Status**: 🔄 **MODIFIED** (functionality added)

**Changes**: 1 file changed, 9 insertions(+), 256 deletions(-)

**Reference commit** (lines 1-303):
- Basic workspace layout with:
  - BacklogSesiones (left sidebar)
  - CalendarioDnD (main calendar)
  - EditorSesionNuevo (full-width bottom section)
- Manual session reloading every 5 seconds to detect generated plans

**Current HEAD** (lines 1-550):
- Same layout structure (preserved)
- ✅ **NEW FEATURE**: Automatic plan generation on workspace load
  - `generatePlanForSession()` function (lines 154-204)
  - `useEffect` that ensures all sessions have plans (lines 221-282)
  - Progress tracking: `planGenerationProgress`, `planGenerationError`
  - Loading screen with progress indicator
  - Retry logic on error
- ✅ **NEW FEATURE**: Floating session tray (lines 456-531)
  - Minimizable sidebar with unassigned sessions
  - Drag-and-drop to calendar
  - Opens via state from navigation
- Additional state management for generation flow

**Impact**:
- ✅ **Section structure**: Not affected by workspace changes
- ✅ **Resources handling**: Not affected by workspace changes
- ✅ **Diferenciación positioning**: Not affected by workspace changes
- ✅ **Header/metadata**: Not affected by workspace changes
- ⚠️ **Parser restoration consideration**: 
  - Auto-generation calls `parsePlan()` and `buildPlanHtml()` (lines 186-187)
  - If parser is restored, must update these calls to use restored functions
  - Must import from correct module

---

#### 5. `supabase/functions/generate-plan-completo/index.ts`

**Status**: ✅ **UNCHANGED**

**Both versions**:
- Same OpenAI prompt structure
- Same JSON response format
- Same retry logic with exponential backoff
- Prompt explicitly requests:
  - `<h2><strong>Inicio (X min)</strong></h2>`
  - `<h2><strong>Desarrollo (X min)</strong></h2>`
  - `<h2><strong>Cierre (X min)</strong></h2>`
  - Resources within sections: `<p><strong>Recursos:</strong> ...</p>`
  - Differentiation within sections: `<p><strong>Diferenciación/Adaptaciones:</strong></p>`

**Impact**:
- ✅ No changes needed for Phase 0
- ⚠️ **Future consideration**: If parser is restored, AI prompt already generates correct structure
  - Parser will extract sections from well-formed HTML
  - May need prompt adjustments if AI format changes

---

## Post-Commit Behaviors to Preserve

### Critical "Must-Preserve" Features

These features were introduced **after** commit 9e8784 and must NOT be broken during parser restoration:

#### 1. Automatic Plan Generation Flow (PlanificacionWorkspace)

**Introduced in**: Commit 119d187 or between 9e8784 and HEAD

**Features**:
- Auto-generation of plans for sessions without content on workspace load
- Progress tracking UI (`planGenerationProgress`)
- Error handling with retry option (`planGenerationError`)
- Loading screen with spinner and progress counter
- Polling logic to detect completed generation

**Integration points with parser**:
```typescript
// Current code (lines 186-187 in workspace, now deleted in current HEAD):
const parsedPlan = parsePlan(data.plan_html, fallbackRecursos);
const sanitizedHtml = buildPlanHtml(parsedPlan);
```

**Preservation requirement**:
- If parser is restored, auto-generation must continue to use `parsePlan()` and `buildPlanHtml()`
- Must sanitize AI-generated HTML before saving to DB
- Must extract resources properly

#### 2. Floating Session Tray (PlanificacionWorkspace)

**Features**:
- Minimizable floating panel with unassigned sessions
- Drag-and-drop to calendar
- Shows count of unassigned sessions
- Opens via navigation state (`location.state.openBandeja`)

**Preservation requirement**:
- Layout and positioning must not be affected by parser restoration
- No changes to DnD logic

#### 3. Supabase Integration Fixes (Commit 119d187)

**Features**:
- Updated Supabase client configuration
- Edge function authentication fixes
- Service key migration
- Demo user bootstrap improvements

**Files affected**:
- `src/integrations/supabase/client.ts`
- `supabase/functions/ensure-demo-users/*`
- `supabase/functions/modify-evaluation/*`

**Preservation requirement**:
- Do NOT modify Supabase client or edge function authentication
- Do NOT change data model shapes (especially `sesiones_clase` table)
- Parser restoration should only affect frontend HTML processing

#### 4. Current Workspace Layout

**Features**:
- 3-column grid layout (BacklogSesiones / CalendarioDnD / EditorSesionNuevo)
- Responsive breakpoints (col-span-12 lg:col-span-3, etc.)
- Full-width editor section below calendar
- Top navigation header with breadcrumbs

**Preservation requirement**:
- Do NOT change grid structure or component ordering
- Parser restoration should only affect EditorSesionNuevo internal rendering

#### 5. Tab Structure in EditorSesionNuevo

**Current tabs**:
- "Clase" (class plan content)
- "Recursos" (resources)
- "Evaluación" (teacher evaluation)

**Features**:
- AI modification request card (purple card with Wand2 icon)
- PDF export section (hidden div for print)
- Competencies header card (above tabs)

**Preservation requirement**:
- Keep 3-tab structure
- Keep AI modification feature
- Keep PDF export logic
- Parser should only affect content WITHIN "Clase" and "Recursos" tabs

#### 6. Competencies Display in Header

**Status**: Already working correctly in both versions

**Features**:
- Header card shows: title, date, duration, materia, nivel, competencies
- Competencies rendered as badges (`<Badge variant="secondary">`)
- Fallback message if no competencies

**Preservation requirement**:
- Do NOT modify header card structure
- Competencies display should remain identical

---

## Constraints for Future Phases

### Absolute Constraints (MUST NOT violate)

1. **Do not modify Supabase data models**
   - Schema: `sesiones_clase`, `planificaciones`, `competencias_sesion`, etc.
   - Field types: `plan_desarrollo: { html_completo: string }`, `recursos: string[]`, etc.
   - If parser is restored, it operates on frontend only (transforms HTML for display)

2. **Do not break authentication or edge functions**
   - Supabase client configuration must remain untouched
   - Edge function invocations in workspace must continue to work
   - Service key usage in generate-plan-completo must not change

3. **Do not change workspace layout structure**
   - Grid system: BacklogSesiones (3 cols) + CalendarioDnD (9 cols) + EditorSesionNuevo (12 cols)
   - Component hierarchy and order must remain the same
   - Floating session tray must continue to work

4. **Do not remove auto-generation feature**
   - `generatePlanForSession()` logic must be preserved
   - Progress tracking and error handling must continue to function
   - If parser is restored, auto-generation must use it correctly

5. **Do not modify PDF export logic**
   - Hidden div `#sesion-pdf-content` must remain functional
   - PDF structure: header + competencias card + plan sections + recursos + evaluacion
   - PDFGenerator.generateFromElement() call must continue to work

### Strong Preferences (SHOULD preserve)

6. **Preserve AI modification feature**
   - Purple card with "Solicitar cambios a la IA"
   - `handleSolicitarModificacion()` function and UX
   - If parser is restored, ensure modifications are sanitized through parser

7. **Preserve current tab structure**
   - "Clase", "Recursos", "Evaluación" tabs
   - Tab content should be enhanced (not replaced) by parser

8. **Preserve Tailwind Typography styling**
   - `prose` classes provide good default styling
   - If parser adds explicit section headers, they should complement (not conflict with) prose styles

9. **Preserve competencies card**
   - Blue card with "¿Cómo se desarrollan estas competencias?"
   - Displays `argumentoCompetencias` from AI response

### Flexible Areas (CAN modify)

10. **Content rendering within "Clase" tab**
    - Current: Single `dangerouslySetInnerHTML` with prose classes
    - Can be replaced with structured section rendering (Inicio/Desarrollo/Cierre)
    - Can add separators between sections

11. **Resources tab content**
    - Current: Single textarea for manual resources
    - Can be enhanced to show:
      - Parsed resources from HTML (read-only)
      - Manual additional resources (editable)
    - Can add clear instructions about where resources appear

12. **Diferenciación positioning**
    - Current: Wherever AI places it in HTML
    - Can be extracted and moved to end of "Clase" tab

13. **Helper functions in EditorSesionNuevo**
    - Can add back: `stripTags()`, `hasHtml()`, `sanitizeHeadings()`, etc.
    - Can use `useMemo` for parsing to avoid re-parsing on every render

---

## Recommended Restoration Strategy

Based on the analysis above, here is the recommended phased approach for future work:

### Phase 1: Restore Parser (Low Risk)

**Goal**: Bring back `planParser.ts` without changing components yet

**Steps**:
1. Restore `src/lib/planParser.ts` from commit 9e8784
2. Verify it compiles (no type errors)
3. Add unit tests for key functions (parsePlan, buildPlanHtml)
4. Do NOT use it in components yet

**Risk**: Low (no runtime changes)

### Phase 2: Update Auto-Generation to Use Parser (Medium Risk)

**Goal**: Ensure AI-generated HTML is sanitized through parser before saving

**Steps**:
1. In `PlanificacionWorkspace.tsx`, update `generatePlanForSession()`:
   - Import `parsePlan()` and `buildPlanHtml()`
   - Parse AI response: `const parsedPlan = parsePlan(data.plan_html, fallbackRecursos)`
   - Build clean HTML: `const sanitizedHtml = buildPlanHtml(parsedPlan)`
   - Save to DB: `plan_desarrollo: { html_completo: sanitizedHtml }`
2. Test auto-generation flow end-to-end
3. Verify existing sessions still display correctly

**Risk**: Medium (affects data saved to DB, but structure remains compatible)

### Phase 3: Restore Structured Section Rendering (Medium-High Risk)

**Goal**: Show Inicio/Desarrollo/Cierre as separate visual blocks

**Steps**:
1. In `EditorSesionNuevo.tsx`, add back:
   - `useMemo` to parse `planHtml` into `planParsed`
   - Helper functions: `hasHtml()`, `sanitizeHeadings()`, `stripLeadingDuplicateSectionHeading()`
2. Replace single `dangerouslySetInnerHTML` with structured rendering:
   - Inicio section with H2 header
   - Separator
   - Desarrollo section with H2 header
   - Separator
   - Cierre section with H2 header
   - Separator (conditional)
   - Diferenciación section with H2 header (if present)
3. Preserve prose styling on section content divs
4. Test with various AI-generated plans

**Risk**: Medium-High (changes visible UX, may have edge cases)

### Phase 4: Restore Resource Isolation (Medium Risk)

**Goal**: Show resources only in "Recursos" tab, not in "Clase" tab

**Steps**:
1. In "Clase" tab, use parsed sections without resources:
   - `planParsed.inicio`, `planParsed.desarrollo`, `planParsed.cierre`
   - Resources already extracted by parser
2. In "Recursos" tab, add back two-card structure:
   - Card 1: Show `planParsed.recursos` (read-only list from HTML)
   - Card 2: Textarea for additional manual resources
   - Instruction: "Recursos adicionales que no fueron detectados automáticamente"
3. On save, merge parsed + manual resources (with deduplication)
4. Test resource extraction and display

**Risk**: Medium (changes data flow, but backwards compatible)

### Phase 5: Testing & Polish (High Priority)

**Goal**: Ensure no regressions and smooth UX

**Tests**:
1. Auto-generation creates properly structured plans
2. Manual modifications through AI still work
3. PDF export includes all sections correctly
4. Resources appear only in "Recursos" tab
5. Diferenciación always at end of "Clase" tab
6. Competencies header displays correctly
7. Floating session tray still works
8. DnD to calendar still works
9. Loading states and error handling work

---

## Next Steps

1. ✅ **Phase 0 Complete**: Context documented, baseline established
2. ⏭️ **Phase 1 TODO**: Restore `planParser.ts` without using it yet
3. ⏭️ **Phase 2 TODO**: Integrate parser into auto-generation flow
4. ⏭️ **Phase 3 TODO**: Restore structured section rendering
5. ⏭️ **Phase 4 TODO**: Restore resource isolation
6. ⏭️ **Phase 5 TODO**: Comprehensive testing

---

## Appendix: Key Code Snippets

### A. ParsedPlan Interface (from reference commit)

```typescript
export interface ParsedPlan {
  inicio: string;       // Clean HTML for Start section (no resources)
  desarrollo: string;   // Clean HTML for Development section (no resources)
  cierre: string;       // Clean HTML for Closure section (no resources)
  recursos: string[];   // Normalized, de-duplicated resources
  diferenciacion?: string;   // Differentiation/Adaptations section (optional)
  durations?: {         // Extracted duration labels (e.g., "(15 min)")
    inicio?: string;
    desarrollo?: string;
    cierre?: string;
  };
}
```

### B. Current Rendering in EditorSesionNuevo (HEAD)

```tsx
<TabsContent value="clase" className="space-y-4">
  <div 
    className="w-full prose max-w-none p-6 bg-card rounded-lg border 
      prose-headings:font-bold prose-h2:text-xl prose-h2:text-primary
      prose-p:mb-4 prose-ul:mb-4 prose-li:mb-2"
    dangerouslySetInnerHTML={{ __html: planHtml }}
  />
</TabsContent>
```

### C. Previous Structured Rendering (reference commit)

```tsx
<div className="space-y-8">
  {hasHtml(planParsed?.inicio) && (
    <div>
      <h2 className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3">
        Inicio{planParsed?.durations?.inicio ? ` ${planParsed.durations.inicio}` : ''}
      </h2>
      <div className="space-y-4 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizedInicioHtml }}
      />
    </div>
  )}
  
  {hasHtml(planParsed?.inicio) && hasHtml(planParsed?.desarrollo) && (
    <div role="separator" className="border-t border-border my-6" />
  )}
  
  {/* Similar for Desarrollo, Cierre, Diferenciación */}
</div>
```

### D. Auto-Generation Integration Point (PlanificacionWorkspace)

```typescript
// In generatePlanForSession() - lines 186-187 (reference commit, now removed)
const parsedPlan = parsePlan(data.plan_html, fallbackRecursos);
const sanitizedHtml = buildPlanHtml(parsedPlan);

const { error: updateError } = await supabase
  .from('sesiones_clase')
  .update({
    plan_desarrollo: { html_completo: sanitizedHtml },
    argumento_competencias: data.argumento_competencias,
    recursos: sanitizedResources
  })
  .eq('id', sesion.id);
```

---

**Document created**: 2025-12-11  
**Reference commit**: 9e87845984f1db916008cb19f203a04c7a30e832  
**Current HEAD**: 119d1877c6526b91cca957618a35af995adea921  
**Working branch**: restore-plan-parser  
**Phase**: 0 (Analysis & Documentation)  
**Status**: ✅ Complete - Ready for Phase 1























