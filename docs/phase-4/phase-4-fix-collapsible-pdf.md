# Phase 4 Fix: Collapsible Sections & PDF Export

> **Date**: 2025-02-04  
> **Status**: Complete  
> **Type**: Bugfix + Enhancement

## Summary

This fix addresses a regression introduced in Phase 4 where the v2 JSON renderer replaced too much of the UI, removing essential panels. Additionally, it adds collapsible sections and PDF export functionality.

## Problems Fixed

### 1. V2 Renderer Regression (Task A)
**Problem**: The initial v2 implementation replaced the entire evaluation UI, losing:
- Teacher reminders panel
- Per-student version assignments panel
- Version selector (A/B/C tabs)
- "View as student" functionality
- AI design report section
- Criterios de logro section

**Solution**: Created `EvaluationContentWrapper` that encapsulates ONLY the evaluation content area, preserving all surrounding panels.

### 2. No Collapsible Sections (Task B)
**Problem**: Long evaluation pages were hard to navigate with all sections expanded.

**Solution**: Created `CollapsibleSection` component with localStorage persistence. All major sections are now collapsible:
- Assignment warnings
- Student assignments
- Teacher reminders
- Evaluation content
- AI design report
- Criterios de logro

### 3. No PDF Export (Task C)
**Problem**: Users couldn't export evaluations to PDF for printing or sharing.

**Solution**: Added "Download PDF" button inside `EvaluationContentWrapper` using `html2pdf.js` for client-side generation.

## New Components

### `CollapsibleSection.tsx`
Reusable collapsible card wrapper with:
- `id` - unique identifier for localStorage
- `title` - section title (always visible)
- `icon` - optional icon component
- `defaultExpanded` - initial state
- `persistState` - enable/disable localStorage persistence
- `badge` - optional badge shown when collapsed

```tsx
<CollapsibleSection
  id="student-assignments"
  title="Asignación de versiones por estudiante"
  icon={<Users className="h-4 w-4 text-primary" />}
  defaultExpanded={false}
  badge={<Badge>5 estudiantes</Badge>}
>
  {/* content */}
</CollapsibleSection>
```

### `EvaluationContentWrapper.tsx`
Unified wrapper for v1/v2 evaluation content with:
- **Version selector**: Tabs for A/B/C versions (shows only available)
- **View as student**: Dropdown to see evaluation as specific student
- **PDF export**: Client-side generation with html2pdf.js
- **v1/v2 toggle**: Automatically uses v2 renderer when available

```tsx
<EvaluationContentWrapper
  versions={{ A: htmlA, B: htmlB, C: htmlC }}
  v2Response={v2RawResponse}
  useBetaV2={useBetaV2}
  studentAssignments={studentAssignments}
  students={students}
  subject="Historia"
  onV2RenderError={(reason) => fallbackToV1()}
/>
```

## Dependencies Added

```json
{
  "html2pdf.js": "^0.10.3"
}
```

Dynamically imported to avoid bundle bloat when not used.

## Files Modified

| File | Change |
|------|--------|
| `src/components/evaluaciones/CollapsibleSection.tsx` | New component |
| `src/components/evaluaciones/EvaluationContentWrapper.tsx` | New component |
| `src/components/evaluaciones/index.ts` | Added exports |
| `src/pages/EvaluacionesGrupo.tsx` | Refactored to use new components |
| `package.json` | Added html2pdf.js dependency |

## Testing Checklist

### Collapsible Sections
- [ ] All sections collapse/expand correctly
- [ ] Collapsed state persists in localStorage after page refresh
- [ ] Badge shows summary when collapsed
- [ ] ChevronUp/ChevronDown icon updates correctly

### Version Selector
- [ ] Only available versions show as tabs
- [ ] Clicking tab changes displayed version
- [ ] "View as student" dropdown works
- [ ] Student assignment badges show correct version

### PDF Export
- [ ] "Download PDF" button appears in evaluation content
- [ ] PDF generates without errors
- [ ] PDF filename includes version and subject
- [ ] PDF content is clean and readable

### V2 Renderer Fallback
- [ ] When v2 enabled and response available, uses v2 renderer
- [ ] When v2 fails, falls back to v1 with toast notification
- [ ] v1 renderer shows correct version content

## localStorage Keys

Collapsible state is stored with prefix `aulaplus:collapsible:`:
- `aulaplus:collapsible:assignment-warnings`
- `aulaplus:collapsible:student-assignments`
- `aulaplus:collapsible:teacher-reminders`
- `aulaplus:collapsible:evaluation-content`
- `aulaplus:collapsible:ai-design-report`
- `aulaplus:collapsible:criterios-logro`

## Bundle Impact

- `html2pdf.js` chunk: ~975 KB (gzipped: ~278 KB)
- Loaded dynamically only when PDF export is triggered
- No impact on initial page load

## Notes

- The v2 renderer now receives `selectedVersion` prop to render correct version
- View-as-student automatically switches to student's assigned version
- PDF export captures only the evaluation content area, not surrounding panels
