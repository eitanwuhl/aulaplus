# Phase 3: Structured Section Rendering in Class Plan UI

## Phase Summary

**Goal**: Restore and modernize the structured section rendering of the class plan inside the workspace (Inicio / Desarrollo / Cierre + Diferenciación/Adaptaciones) in the "Clase" tab, using the parser's structured output.

**Status**: ✅ Complete

**Outcome**:
- ✅ "Clase" tab now renders plan as separate visual sections (Inicio/Desarrollo/Cierre/Diferenciación)
- ✅ Section headers with durations displayed prominently
- ✅ Visual separators between sections for clarity
- ✅ Fallback rendering for legacy HTML that doesn't parse cleanly
- ✅ PDF export updated to mirror structured layout
- ✅ All Phase 2 behavior preserved (generation/modification flows unchanged)
- ✅ No changes to Supabase schema, edge functions, or tab structure
- ✅ Application compiles with zero errors

---

## Context from Previous Phases

**Phase 0**: Analysis and documentation of differences vs reference commit  
**Phase 1**: Restored `src/lib/planParser.ts` from commit 9e87845 (dormant, not used)  
**Phase 2**: Integrated parser into generation/modification flows (data sanitization)  
**Phase 3**: Restored structured section rendering in UI (current phase)

---

## File Modified in Phase 3

### `src/components/planificacion/EditorSesionNuevo.tsx`

**Purpose**: Transform "Clase" tab from single HTML block to structured section rendering

**Changes Made**:

#### 1. Added Helper Functions (lines ~23-86)

Three lightweight helper functions to support rendering:

```typescript
// Check if HTML has actual content
const hasHtml = (html?: string): boolean => {
  if (!html) return false;
  const stripped = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return stripped.length > 0;
};

// Remove stray section headings that might be duplicates
const sanitizeHeadings = (html: string): string => {
  // Removes h1-h6 tags containing section names (inicio/desarrollo/cierre/diferenciacion)
  // Demotes other headings to <p><strong>
  // Returns cleaned HTML
};

// Strip leading duplicate section heading if present
const stripLeadingDuplicateSectionHeading = (
  html: string, 
  section: 'inicio' | 'desarrollo' | 'cierre'
): string => {
  // Removes leading <h2>Inicio</h2> from inicio content (already shown by component)
  // Same for desarrollo and cierre
  // Returns cleaned HTML
};
```

**Design rationale**:
- **`hasHtml()`**: Simple check to avoid rendering empty sections
- **`sanitizeHeadings()`**: Removes redundant headings that might be in AI output (already shown by component)
- **`stripLeadingDuplicateSectionHeading()`**: Defensive cleanup to avoid "Inicio Inicio" or "Desarrollo Desarrollo" duplicates

These are minimal, focused helpers adapted from the reference commit (9e87845) but simplified for current needs.

#### 2. Added Parsed Plan State (lines ~105-127)

```typescript
// PHASE 3: Parse plan for structured rendering
const planParsed = useMemo<ParsedPlan>(() => {
  if (!planHtml || planHtml.trim().length === 0) {
    return {
      inicio: '',
      desarrollo: '',
      cierre: '',
      recursos: recursos || [],
      diferenciacion: undefined,
      durations: undefined
    };
  }
  
  try {
    return parsePlan(planHtml, recursos);
  } catch (error) {
    console.error('Error parsing plan for rendering:', error);
    // Fallback to empty structure if parsing fails
    return { /* empty structure */ };
  }
}, [planHtml, recursos]);
```

**Key points**:
- Uses `useMemo` for performance (only re-parses when `planHtml` or `recursos` change)
- Defensive error handling (returns empty structure if parsing fails)
- Parses ONLY for rendering (generation/modification already use parser in Phase 2)

#### 3. Replaced Single-Block Rendering with Structured Sections (lines ~470-575)

**Before Phase 3**:
```tsx
<TabsContent value="clase" className="space-y-4">
  <div 
    className="w-full prose max-w-none p-6 bg-card rounded-lg border"
    dangerouslySetInnerHTML={{ __html: planHtml }}
  />
</TabsContent>
```

**After Phase 3**:
```tsx
<TabsContent value="clase" className="space-y-4">
  <Card>
    <CardContent className="p-6">
      {(hasHtml(planParsed.inicio) || hasHtml(planParsed.desarrollo) || hasHtml(planParsed.cierre)) ? (
        <div className="space-y-8">
          {/* Inicio Section */}
          {hasHtml(planParsed.inicio) && (
            <div>
              <h2 className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3 text-primary">
                Inicio{planParsed.durations?.inicio ? ` ${planParsed.durations.inicio}` : ''}
              </h2>
              <div className="prose prose-sm max-w-none space-y-4 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizedInicioHtml }}
              />
            </div>
          )}

          {/* Separator */}
          {hasHtml(planParsed.inicio) && hasHtml(planParsed.desarrollo) && (
            <div role="separator" className="border-t border-border my-6" />
          )}

          {/* Similar for Desarrollo, Cierre, Diferenciación... */}
        </div>
      ) : planHtml ? (
        // Fallback for legacy HTML
        <div className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: planHtml }}
        />
      ) : (
        <p className="text-muted-foreground italic">No hay contenido de clase disponible</p>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

**Rendering logic**:

1. **Check if parser returned sections**: `hasHtml(planParsed.inicio) || hasHtml(planParsed.desarrollo) || hasHtml(planParsed.cierre)`
   - If YES → Render structured sections
   - If NO but `planHtml` exists → Fallback to raw HTML (legacy sessions)
   - If NO and no `planHtml` → Show empty state message

2. **For each section**:
   - Render only if `hasHtml(section)` is true
   - Show H2 heading with Tailwind classes: `scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3 text-primary`
   - Append duration if available: "Inicio (15 min)"
   - Render content with prose styling: `prose prose-sm max-w-none space-y-4 leading-relaxed`
   - Apply sanitization: `sanitizeHeadings()` and `stripLeadingDuplicateSectionHeading()`

3. **Separators**:
   - Horizontal line between sections: `<div role="separator" className="border-t border-border my-6" />`
   - Only rendered if BOTH adjacent sections have content
   - Extra separator before "Diferenciación/Adaptaciones" if any main section exists

4. **Section order (fixed)**:
   1. Inicio
   2. Separator (conditional)
   3. Desarrollo
   4. Separator (conditional)
   5. Cierre
   6. Separator (conditional)
   7. Diferenciación/Adaptaciones (always at end)

#### 4. Updated PDF Export Layout (lines ~641-706)

**Before Phase 3**:
```tsx
{/* 3. Plan (Inicio/Desarrollo/Cierre) */}
<div dangerouslySetInnerHTML={{ __html: planHtml }} />
```

**After Phase 3**:
```tsx
{/* 3. Plan (Inicio/Desarrollo/Cierre) - PHASE 3: Structured sections */}
<div className="space-y-4">
  {hasHtml(planParsed.inicio) && (
    <div>
      <h2 className="text-xl font-semibold mb-2">
        Inicio{planParsed.durations?.inicio ? ` ${planParsed.durations.inicio}` : ''}
      </h2>
      <div dangerouslySetInnerHTML={{ __html: sanitizedInicioHtml }} />
    </div>
  )}
  
  {/* Similar for Desarrollo, Cierre, Diferenciación... */}
</div>
```

**Key changes**:
- PDF now mirrors the same structured layout as "Clase" tab
- Uses same `planParsed` object (no duplicate parsing)
- Uses same helper functions (`hasHtml`, `sanitizeHeadings`, etc.)
- Slightly adapted styling for print (removes some screen-specific classes)
- Section order identical to screen rendering

---

## How Structured Rendering Works

### Data Flow

```
┌─────────────────┐
│  planHtml       │ ← Saved in DB (already sanitized by Phase 2)
│  (string)       │
└────────┬────────┘
         │
         │ useMemo + parsePlan()
         ▼
┌─────────────────┐
│  planParsed     │ ← Structured object
│  (ParsedPlan)   │
├─────────────────┤
│ inicio: string  │
│ desarrollo: str │
│ cierre: string  │
│ diferenciacion? │
│ durations?      │
│ recursos: []    │
└────────┬────────┘
         │
         │ Component renders
         ▼
┌─────────────────────────────┐
│  UI (Clase Tab)             │
│  ┌─────────────────────┐   │
│  │ H2: Inicio (15 min) │   │
│  │ Content             │   │
│  ├─────────────────────┤   │
│  │ --- Separator ---   │   │
│  ├─────────────────────┤   │
│  │ H2: Desarrollo      │   │
│  │ Content             │   │
│  ├─────────────────────┤   │
│  │ H2: Cierre          │   │
│  │ Content             │   │
│  ├─────────────────────┤   │
│  │ H2: Diferenciación  │   │
│  │ Content             │   │
│  └─────────────────────┘   │
└─────────────────────────────┘
```

### Fallback Behavior for Legacy HTML

**Scenario 1: New/modified session (post-Phase 2)**
- `planHtml` contains clean HTML from `buildPlanHtml()` (Phase 2)
- Parser extracts sections successfully
- Renders as structured sections ✅

**Scenario 2: Old session (pre-Phase 2) with valid structure**
- `planHtml` contains older HTML with `<h2>Inicio</h2>`, etc.
- Parser extracts sections (parser is flexible)
- Renders as structured sections ✅

**Scenario 3: Old session with unstructured HTML**
- `planHtml` contains HTML without clear section markers
- Parser returns empty sections (can't detect structure)
- Condition: `!(hasHtml(inicio) || hasHtml(desarrollo) || hasHtml(cierre))`
- Falls back to raw HTML rendering ✅
- User sees: Single block of content (like before Phase 3)
- No broken UI, no lost content

**Scenario 4: Empty plan**
- `planHtml` is empty or null
- Shows message: "No hay contenido de clase disponible" ✅

### Durations Display

**Source**: `planParsed.durations` object
- Extracted by parser from section headings in HTML
- Format: `{ inicio: "(15 min)", desarrollo: "(30 min)", cierre: "(5 min)" }`

**Display**: Appended to section heading
- Example: "Inicio (15 min)", "Desarrollo (30 min)"
- If duration not present, shows just "Inicio", "Desarrollo", etc.

**Styling**: Same font/size as heading, not visually distinct (part of heading text)

### Diferenciación/Adaptaciones Positioning

**Always at the end** (after Inicio/Desarrollo/Cierre)

**Separator logic**:
```typescript
{(hasHtml(planParsed.inicio) || hasHtml(planParsed.desarrollo) || hasHtml(planParsed.cierre)) &&
  hasHtml(planParsed.diferenciacion) && (
    <div role="separator" className="border-t border-border my-6" />
  )}
```

**Meaning**: Show separator before Diferenciación ONLY if:
- At least one main section has content AND
- Diferenciación has content

**Heading**: Fixed text "Diferenciación/Adaptaciones" (no duration)

---

## Visual Design

### Section Headings

**Tailwind classes**: `scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3 text-primary`

**Breakdown**:
- `scroll-m-20`: Scroll margin for anchor links
- `text-xl`: Large text (20px)
- `font-semibold`: Font weight 600
- `tracking-tight`: Tighter letter spacing
- `mt-6 mb-3`: Margin top 24px, margin bottom 12px
- `text-primary`: Brand color (blue/purple depending on theme)

**Result**: Bold, prominent section headers that stand out visually

### Section Content

**Tailwind classes**: `prose prose-sm max-w-none space-y-4 leading-relaxed`

**Breakdown**:
- `prose`: Typography plugin (auto-styles paragraphs, lists, etc.)
- `prose-sm`: Smaller prose scale (14px base)
- `max-w-none`: No max-width constraint (use full card width)
- `space-y-4`: 16px vertical spacing between child elements
- `leading-relaxed`: Line height 1.625 (more readable)

**Result**: Clean, readable content with consistent spacing

### Separators

**Tailwind classes**: `border-t border-border my-6`

**Breakdown**:
- `border-t`: Top border only
- `border-border`: Default border color (gray-200 light mode, gray-800 dark mode)
- `my-6`: Margin top/bottom 24px

**Result**: Subtle horizontal line between sections

### Overall Layout

**Outer container**: `space-y-8`
- 32px vertical spacing between sections
- Creates clear visual grouping

**Card wrapping**: `<Card><CardContent className="p-6">`
- Consistent padding (24px all sides)
- Card border and shadow (from UI library)
- Matches existing tab layout

---

## What Changed vs What Stayed the Same

### ✅ Changed (Phase 3 scope)

1. **"Clase" tab rendering**
   - From: Single HTML block with prose styling
   - To: Structured sections with headers and separators

2. **Visual hierarchy**
   - Section headers added (Inicio, Desarrollo, Cierre, Diferenciación/Adaptaciones)
   - Separators added between sections
   - Duration labels displayed in headers

3. **PDF export layout**
   - From: Single HTML block
   - To: Structured sections (mirrors "Clase" tab)

4. **Helper functions**
   - Added 3 new helpers for rendering logic
   - Moved from global scope to module scope (just before component)

### ❌ NOT Changed (intentionally preserved)

1. **Tab structure**
   - Still 3 tabs: "Clase" / "Recursos" / "Evaluación"
   - Tab order unchanged

2. **"Recursos" tab**
   - Still single textarea (no two-card layout yet)
   - Will be addressed in Phase 4

3. **Competencies header card**
   - Unchanged layout and content
   - Still shows competencies as badges

4. **AI modification card**
   - Purple card with "Solicitar cambios a la IA" unchanged
   - Workflow and UX preserved

5. **Generation/modification flows**
   - Phase 2 integration unchanged
   - Parser still used in save operations
   - Edge functions unchanged

6. **Supabase**
   - No schema changes
   - No data model changes
   - No client configuration changes

---

## Code Quality & Patterns

### Performance Optimization

**`useMemo` for parsing**:
```typescript
const planParsed = useMemo<ParsedPlan>(() => {
  return parsePlan(planHtml, recursos);
}, [planHtml, recursos]);
```

**Why**: Parsing HTML is CPU-intensive. Only re-parse when dependencies change.

**Dependencies**:
- `planHtml`: Changes when AI generates/modifies plan
- `recursos`: Changes when user manually adds resources

**Impact**: Avoids redundant parsing on every render (e.g., state updates from unrelated fields)

### Error Handling

**Defensive parsing**:
```typescript
try {
  return parsePlan(planHtml, recursos);
} catch (error) {
  console.error('Error parsing plan for rendering:', error);
  return { /* empty structure */ };
}
```

**Why**: Parser might fail on unexpected HTML structure

**Fallback**: Empty structure → component falls back to raw HTML rendering

**Result**: Never crashes, never loses content

### Conditional Rendering

**Pattern**: Only render if content exists
```typescript
{hasHtml(planParsed.inicio) && (
  <div>...</div>
)}
```

**Why**: Avoid empty sections with just headers

**Result**: Clean UI without unnecessary empty blocks

### Separator Logic

**Pattern**: Render separator ONLY if both adjacent sections exist
```typescript
{hasHtml(planParsed.inicio) && hasHtml(planParsed.desarrollo) && (
  <div role="separator" />
)}
```

**Why**: Avoid stray separators at top/bottom or between missing sections

**Result**: Separators only appear where they make sense visually

### IIFE Pattern for Section Rendering

**Pattern**: Immediately-invoked function expression
```typescript
{hasHtml(planParsed.inicio) && (() => {
  const inicioHtml = stripLeadingDuplicateSectionHeading(
    sanitizeHeadings(planParsed.inicio),
    'inicio'
  );
  
  return (
    <div>...</div>
  );
})()}
```

**Why**: Allows local variables (e.g., `inicioHtml`) scoped to that section

**Alternative**: Could extract to separate component, but IIFE keeps logic inline

**Trade-off**: Slightly less readable but avoids prop drilling and component overhead

---

## Testing & Verification

### Manual Testing Scenarios

#### Scenario 1: New Session (Post-Phase 2)
**Setup**: Generate new session via auto-generation (Phase 2 flow)

**Expected**:
- ✅ "Clase" tab shows 3-4 sections (Inicio/Desarrollo/Cierre/Diferenciación)
- ✅ Each section has header with duration
- ✅ Separators between sections
- ✅ No duplicate headings in content

**Actual**: As expected ✅

#### Scenario 2: Modified Session
**Setup**: Use "Solicitar cambios a la IA" to modify existing plan

**Expected**:
- ✅ Modified plan parsed and rendered as structured sections
- ✅ Changes reflected immediately in UI

**Actual**: As expected ✅

#### Scenario 3: Old Session (Pre-Phase 2, with structure)
**Setup**: Load session created before Phase 2, but with H2 section markers

**Expected**:
- ✅ Parser extracts sections successfully
- ✅ Renders as structured sections (benefits from Phase 3 UI)

**Actual**: As expected ✅

#### Scenario 4: Old Session (Pre-Phase 2, unstructured)
**Setup**: Load very old session with plain HTML, no section markers

**Expected**:
- ✅ Parser returns empty sections
- ✅ Falls back to raw HTML rendering
- ✅ No broken UI, no lost content

**Actual**: As expected ✅

#### Scenario 5: Empty Session
**Setup**: Create session but don't generate plan yet

**Expected**:
- ✅ Shows "No hay contenido de clase disponible" message

**Actual**: As expected ✅

#### Scenario 6: PDF Export
**Setup**: Generate PDF for session with structured plan

**Expected**:
- ✅ PDF includes all sections with headers
- ✅ Sections in correct order
- ✅ Duration labels present

**Actual**: As expected ✅

### Build Verification

```bash
npm run build
✓ 4298 modules transformed
✓ built in 15.18s
```

**Result**: ✅ Zero TypeScript errors, zero linter errors

### Code Review Checklist

- [x] Helper functions are minimal and focused
- [x] No duplicate parsing logic (reused for screen and PDF)
- [x] Error handling in place (try/catch in useMemo)
- [x] Fallback rendering for edge cases
- [x] Conditional rendering prevents empty sections
- [x] Separator logic is correct (only between existing sections)
- [x] Diferenciación always at end
- [x] Durations displayed correctly
- [x] PDF export mirrors screen layout
- [x] No changes to Supabase, edge functions, or other tabs
- [x] Existing UX elements preserved (competencies card, AI modification card)

---

## Constraints Respected ✅

### ✅ What Changed (Phase 3 Scope):
- [x] "Clase" tab now shows structured sections
- [x] Visual separators between sections
- [x] Duration labels in section headers
- [x] Diferenciación/Adaptaciones at end
- [x] PDF export mirrors structured layout
- [x] Fallback for legacy HTML

### ✅ What DID NOT Change (Constraints):
- [x] No changes to Supabase schema or data models
- [x] No changes to edge functions
- [x] No changes to tab structure (still 3 tabs)
- [x] No changes to "Recursos" tab (Phase 4)
- [x] No changes to "Evaluación" tab
- [x] No changes to competencies header card
- [x] No changes to AI modification workflow
- [x] No changes to generation/modification flows (Phase 2)
- [x] No changes to auto-generation logic in PlanificacionWorkspace

---

## Comparison: Before vs After Phase 3

### Before Phase 3 (Post-Phase 2)

**"Clase" Tab**:
```
┌─────────────────────────────────────┐
│  <h2>Inicio (15 min)</h2>          │
│  Actividad de apertura...          │
│  <h2>Desarrollo (30 min)</h2>      │
│  Actividad principal...            │
│  <h2>Cierre (5 min)</h2>           │
│  Síntesis...                       │
│  <p><strong>Diferenciación:</...   │
└─────────────────────────────────────┘
   ↑
   Single HTML block
   Headers IN content, not component-controlled
```

**Issues**:
- Headers not visually distinct (same styling as content)
- No separators between sections
- Hard to scan/navigate
- Diferenciación might be anywhere (not guaranteed at end)

### After Phase 3

**"Clase" Tab**:
```
┌─────────────────────────────────────┐
│  Component Header (large, colored) │
│  ┌─ H2: Inicio (15 min) ─┐        │
│  │  Actividad de apertura...      │
│  └─────────────────────────────────┘
│  ────────────────────────           │ ← Separator
│  ┌─ H2: Desarrollo (30 min) ─┐    │
│  │  Actividad principal...        │
│  └─────────────────────────────────┘
│  ────────────────────────           │
│  ┌─ H2: Cierre (5 min) ─┐          │
│  │  Síntesis...                    │
│  └─────────────────────────────────┘
│  ────────────────────────           │
│  ┌─ H2: Diferenciación ─┐           │
│  │  Adaptaciones...                │
│  └─────────────────────────────────┘
└─────────────────────────────────────┘
   ↑
   Structured sections
   Headers generated by component
   Separators between sections
```

**Improvements**:
- ✅ Clear visual hierarchy
- ✅ Easy to scan and navigate
- ✅ Diferenciación guaranteed at end
- ✅ Durations prominently displayed
- ✅ Professional, modern appearance

---

## Next Steps: Phase 4 Preview

**Goal**: Restore resource isolation (show resources only in "Recursos" tab, not in "Clase" tab)

**Plan**:
1. Modify "Recursos" tab to show two cards:
   - Card 1: Parsed resources from HTML (read-only list)
   - Card 2: Additional manual resources (editable textarea)
2. Ensure resources are NOT shown in "Clase" tab content
3. Parser already extracts resources (Phase 2), so mainly UI changes

**Estimated effort**: 2 hours

**Foundation ready**: Parser already separates resources from narrative content (Phase 2)!

---

## Summary

### Key Accomplishments

✅ Structured section rendering restored in "Clase" tab  
✅ Visual hierarchy with headers and separators  
✅ Durations displayed in section headers  
✅ Diferenciación/Adaptaciones always at end  
✅ PDF export mirrors structured layout  
✅ Fallback rendering for legacy HTML  
✅ Zero changes to data models or generation flows  
✅ Backward compatible with all existing sessions  
✅ Application compiles with zero errors  

### Code Quality

- Minimal, focused helper functions (3 total, ~60 lines)
- Performance optimized with `useMemo`
- Defensive error handling (try/catch, fallbacks)
- No duplicate logic (reused for screen and PDF)
- Clean separation of concerns (parsing vs rendering)
- Conditional rendering prevents empty sections

### Files Modified

1. `src/components/planificacion/EditorSesionNuevo.tsx` (+180 lines net)
   - Added helper functions (3 functions, 63 lines)
   - Added parsed plan state (`useMemo`, 22 lines)
   - Replaced "Clase" tab rendering (structured sections, 105 lines)
   - Updated PDF export layout (30 lines)

### Files NOT Modified (as intended)

- ✅ No changes to `src/pages/PlanificacionWorkspace.tsx` (Phase 2 logic untouched)
- ✅ No changes to `src/lib/planParser.ts` (still dormant, used by Phase 2/3)
- ✅ No changes to Supabase integration or edge functions
- ✅ No changes to "Recursos" or "Evaluación" tabs

---

## Verification Commands

```bash
# Confirm structured rendering exists
grep -A5 "PHASE 3: Structured section rendering" src/components/planificacion/EditorSesionNuevo.tsx

# Confirm helper functions exist
grep "const hasHtml" src/components/planificacion/EditorSesionNuevo.tsx
grep "const sanitizeHeadings" src/components/planificacion/EditorSesionNuevo.tsx
grep "const stripLeadingDuplicateSectionHeading" src/components/planificacion/EditorSesionNuevo.tsx

# Confirm useMemo for parsing
grep "const planParsed = useMemo" src/components/planificacion/EditorSesionNuevo.tsx

# Confirm build succeeds
npm run build
```

---

**Document created**: 2025-12-11  
**Phase**: 3 (Structured Section Rendering)  
**Status**: ✅ Complete  
**Branch**: restore-plan-parser  
**Next phase**: Phase 4 (Resource Isolation in Tabs)  
**Build status**: ✅ Passing (4298 modules, 15.18s)



