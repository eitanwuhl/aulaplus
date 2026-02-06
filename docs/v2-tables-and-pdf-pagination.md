# V2 Evaluation: Table Rendering & PDF Pagination

> **Date:** February 2026  
> **Scope:** Rendering layer only (no backend/prompt changes)

## Overview

This document describes the implementation of:
1. **Table rendering** for `table_completion` evaluation items
2. **PDF pagination** improvements to keep Part/Section cards together

---

## A) Table Rendering (`table_completion`)

### Problem
Previously, `table_completion` items rendered as a placeholder:
```
[Tabla para completar]
```

### Solution
Implemented a full `TableCompletionContent` component that renders a real HTML `<table>`.

### Files Changed

| File | Change |
|------|--------|
| [src/services/evaluations/v2Types.ts](../src/services/evaluations/v2Types.ts) | Added `TableColumn` and `TableData` interfaces |
| [src/services/evaluations/v2Normalizer.ts](../src/services/evaluations/v2Normalizer.ts) | Added `case 'table_completion'` processing in normalizer |
| [src/components/evaluaciones/v2/EvalItem.tsx](../src/components/evaluaciones/v2/EvalItem.tsx) | Replaced placeholder with `TableCompletionContent` component |
| [supabase/functions/modify-evaluation-v2/index.ts](../supabase/functions/modify-evaluation-v2/index.ts) | Updated prompt to specify exact table JSON schema |

### Type Definitions

```typescript
// v2Types.ts
interface TableColumn {
  id: string;
  header: string;
}

interface TableData {
  columns: TableColumn[];
  rows: string[][];       // Empty string = blank cell for student
  cellType?: 'text' | 'numeric';
}

// Added to NormalizedItem
table?: {
  columns: Array<{ id: string; header: string }>;
  rows: string[][];
  cellType?: 'text' | 'numeric';
};
```

### Normalizer Logic

The normalizer handles two JSON formats from the LLM:

```typescript
// Format 1: Nested table object
item.table = {
  columns: [{ id: "col-1", header: "Concepto" }, ...],
  rows: [["valor", "", ""], ...]
}

// Format 2: Top-level arrays (legacy)
item.headers = ["Concepto", "Definición", ...]
item.rows = [["valor", "", ""], ...]
```

Both formats are normalized to the same structure.

### UI Component: `TableCompletionContent`

Located in [EvalItem.tsx](../src/components/evaluaciones/v2/EvalItem.tsx):

```tsx
/**
 * TableCompletionContent - Renders a real table for table_completion items
 * 
 * Mapping from spec → UI:
 * - item.table.columns → <th> headers
 * - item.table.rows → <tr><td> cells
 * - Empty string cells ("") → blank fillable area (visual underline)
 * - Non-empty cells → pre-filled content (read-only display)
 */
const TableCompletionContent: React.FC<{ item: NormalizedItem }> = ({ item }) => {
  // ... implementation
};
```

**Features:**
- Semantic `<table>` markup for accessibility
- Headers render with gray background
- Empty cells show dotted underline ("fill here" visual)
- Pre-filled cells display content
- If no rows provided, generates 3 blank rows
- `table-fixed` layout prevents column overflow
- `break-words` for long text

**Defensive handling:**
- Missing `table` or `columns` → shows "[Tabla sin datos]" fallback
- Empty rows array → generates 3 blank rows
- Missing cell values → treated as empty (shows blank area)

---

## B) PDF / Print Pagination

### Problem
PDF export had multiple issues:
- Content shifted/clipped horizontally
- Part/Section cards split awkwardly across pages
- Tables could break mid-row
- Headers could appear at page bottom without content

### Solution
Implemented CSS print rules and improved the html2canvas/jsPDF export function.

### Files Changed

| File | Change |
|------|--------|
| [src/index.css](../src/index.css) | Added comprehensive print/PDF CSS rules |
| [src/components/evaluaciones/v2/EvaluationRendererV2.tsx](../src/components/evaluaciones/v2/EvaluationRendererV2.tsx) | Rewrote `handleExportPdf()` with proper dimensions and margins |
| [src/components/evaluaciones/v2/EvalSection.tsx](../src/components/evaluaciones/v2/EvalSection.tsx) | Added `pdf-no-break` class |
| [src/components/evaluaciones/v2/EvalHeader.tsx](../src/components/evaluaciones/v2/EvalHeader.tsx) | Added `pdf-no-break` class |
| [src/components/evaluaciones/v2/MapTable.tsx](../src/components/evaluaciones/v2/MapTable.tsx) | Added `pdf-no-break` class |
| [src/components/evaluaciones/v2/EvalItem.tsx](../src/components/evaluaciones/v2/EvalItem.tsx) | Added `pdf-no-break` and `eval-item` classes |

### CSS Print Rules (index.css)

```css
/* PDF Export Mode Container - Applied during export */
.pdf-export-mode {
  width: 718px !important;      /* A4 printable width at 96dpi */
  max-width: 718px !important;
  background: white !important;
  box-shadow: none !important;
}

/* Page break control - Prevent breaking inside these elements */
.pdf-no-break,
.pdf-export-mode [class*="card"],
.pdf-export-mode table,
.pdf-export-mode .eval-item,
.pdf-export-mode .eval-section-header {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
  -webkit-column-break-inside: avoid !important;
}

/* Table rows should not split */
.pdf-export-mode tr {
  break-inside: avoid !important;
  page-break-inside: avoid !important;
}
```

**Key CSS classes:**
- `.pdf-export-mode` - Applied to container during PDF capture
- `.pdf-no-break` - Prevents page breaks inside element
- `.pdf-break-before` - Forces page break before element
- `.pdf-break-after` - Forces page break after element
- `.eval-item` - Marks individual items for break control
- `.eval-section-header` - Marks section headers

### PDF Export Function

The `handleExportPdf()` function in EvaluationRendererV2.tsx:

```typescript
/**
 * PDF Export Configuration
 * 
 * A4 dimensions: 210mm x 297mm
 * Margins: 10mm each side
 * Printable area: 190mm x 277mm
 * Capture width: 718px (190mm at 96 DPI)
 * Scale: 2x for crisp text
 */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PDF_MARGIN_MM = 10;
const PRINTABLE_WIDTH_MM = A4_WIDTH_MM - (PDF_MARGIN_MM * 2); // 190mm
const CAPTURE_WIDTH_PX = Math.round((PRINTABLE_WIDTH_MM / 25.4) * 96); // ~718px
```

**Export process:**
1. Apply `.pdf-export-mode` class (sets fixed width, white background)
2. Wait 100ms for styles to apply
3. Capture with html2canvas at 2x scale
4. Remove `.pdf-export-mode` class
5. Generate jsPDF with proper pagination
6. Save file

### Library Constraints & Mitigations

| Constraint | Mitigation |
|------------|------------|
| html2canvas doesn't respect CSS `break-inside` | Use fixed-width capture to ensure content fits; pagination handled by jsPDF |
| jsPDF pagination is image-based | Calculate page positions manually; accept that breaks happen at image coordinates, not logical elements |
| Browser print differs from html2canvas | Provide both: `@media print` CSS for Ctrl+P, and `.pdf-export-mode` for button export |

**Known limitation:** If a Part/Section is taller than one full page (~277mm), it will be split. The CSS rules ensure the split happens between items rather than mid-item, but very large tables may still split. This is a fundamental constraint of image-based PDF generation.

---

## How to Verify

### Table Rendering Checklist

- [ ] Generate an evaluation that includes a `table_completion` item
- [ ] Verify the item renders as a real `<table>` (not placeholder text)
- [ ] Check that headers display with gray background
- [ ] Check that pre-filled cells show content
- [ ] Check that empty cells show dotted underline (blank area)
- [ ] Verify table is responsive (horizontal scroll on narrow screens)
- [ ] Export PDF and confirm table appears correctly

### PDF Pagination Checklist

- [ ] Generate an evaluation with 3+ sections
- [ ] Export to PDF using "Descargar PDF" button
- [ ] Verify no horizontal clipping (content not cut at edges)
- [ ] Verify margins are consistent (10mm on all sides)
- [ ] Check that short sections stay on one page
- [ ] Check that if a section crosses pages, it moves entirely to next page (if it fits)
- [ ] For long sections: verify header stays with first item
- [ ] Verify tables don't split mid-row
- [ ] Export same evaluation twice and compare: should be identical

### Quick Test Script

1. Navigate to `/evaluaciones`
2. Select a group with students
3. Enable "Beta (v2)" toggle
4. Generate evaluation
5. Switch to Version A, export PDF
6. Switch to Version B, export PDF
7. Compare both PDFs visually

---

## Configuration Reference

### Adjusting PDF Margins

In `EvaluationRendererV2.tsx`:
```typescript
const PDF_MARGIN_MM = 10; // Change this value
```

And in `index.css`:
```css
.pdf-export-mode {
  width: 718px !important; /* Recalculate: (210 - 2*margins) / 25.4 * 96 */
}
```

### Adjusting Capture Quality

```typescript
const canvas = await html2canvas(element, {
  scale: 2, // Increase for sharper output (3 = very crisp, larger file)
  // ...
});
```

### Adding Break Points

To force a page break before a section:
```tsx
<div className="pdf-break-before">
  <EvalSection ... />
</div>
```

---

## Related Files

- [v2Types.ts](../src/services/evaluations/v2Types.ts) - Type definitions
- [v2Normalizer.ts](../src/services/evaluations/v2Normalizer.ts) - JSON normalization
- [EvalItem.tsx](../src/components/evaluaciones/v2/EvalItem.tsx) - Item renderer
- [EvalSection.tsx](../src/components/evaluaciones/v2/EvalSection.tsx) - Section container
- [EvaluationRendererV2.tsx](../src/components/evaluaciones/v2/EvaluationRendererV2.tsx) - Main renderer + PDF export
- [index.css](../src/index.css) - Print/PDF styles (bottom of file)
