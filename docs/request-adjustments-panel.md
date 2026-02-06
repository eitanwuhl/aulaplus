# Request Adjustments Panel (V2)

This document describes the **Request Adjustments** panel feature for V2 evaluations.

## Overview

The `EvaluationAdjustmentsPanel` component allows teachers to request refinements to a generated V2 evaluation without changing the curricular content (competencies, criterios de logro, content IDs).

### Features

1. **Adjustment Description**: Free-text textarea for teachers to describe desired changes
2. **Target Version Selector**: Apply changes to A, B, C, or all versions
3. **Scope Selector**: Apply to entire evaluation, specific section, or specific item
4. **Apply Button**: Calls `modify-evaluation-v2` in "adjust" mode
5. **Undo Button**: Client-side single-step undo to previous response

### What CAN be adjusted

- Wording and clarity of prompts
- Instructions and scaffolding
- Rubric phrasing
- Pedagogical adaptation style (B/C versions)
- Structure within items (e.g., more options, reorder)
- Formatting

### What CANNOT be adjusted

- Content IDs (curricular topics)
- Competency IDs
- Criterios de Logro IDs
- Adding content outside the original topic

## Components

### EvaluationAdjustmentsPanel.tsx

Location: `src/components/evaluaciones/v2/EvaluationAdjustmentsPanel.tsx`

```tsx
interface EvaluationAdjustmentsPanelProps {
  v2Response: V2Response;
  onAdjustmentApplied: (newResponse: V2Response, previousResponse: V2Response) => void;
  previousResponse?: V2Response | null;
  onUndo?: () => void;
  groupContext?: { ... };
  evaluationDesignPlan?: Record<string, unknown>;
  isLoading?: boolean;
}
```

### Edge Function Changes

Location: `supabase/functions/modify-evaluation-v2/index.ts`

New request parameters:
- `mode`: `'generate'` (default) or `'adjust'`
- `currentEvaluationSpec`: The current V2 spec to refine
- `adjustmentDetails`: `{ targetVersions, scope, sectionId?, itemId? }`

When `mode === 'adjust'`, the function:
1. Includes the current spec in the prompt
2. Adds adjustment-specific instructions
3. Constrains the LLM to preserve structure and IDs
4. Focuses changes on presentation, not content

## State Management

In `EvaluacionesGrupo.tsx`:

```tsx
// V2 state
const [v2RawResponse, setV2RawResponse] = useState<V2Response | null>(null);
const [previousV2Response, setPreviousV2Response] = useState<V2Response | null>(null);

// Handle adjustment
const handleAdjustmentApplied = (newResponse: V2Response, previousResponse: V2Response) => {
  setPreviousV2Response(previousResponse);
  setV2RawResponse(newResponse);
};

// Handle undo
const handleUndo = () => {
  if (previousV2Response) {
    setV2RawResponse(previousV2Response);
    setPreviousV2Response(null);
  }
};
```

## UI Location

The panel renders **after** `EvaluationRendererV2` in the V2 conditional block:

```
V2 Mode:
├── V2InfoPanels
├── EvaluationRendererV2
└── EvaluationAdjustmentsPanel  ← NEW
```

## Collapsible Panel Pattern

Uses the same pattern as other V2 panels:
- Default collapsed
- State persisted to localStorage (`v2panel:adjustments`)
- Purple accent color to distinguish from info panels
- Badge: "Re-generar (v2)"

## Edge Function Adjust Mode

### Request Body (Adjust Mode)

```json
{
  "mode": "adjust",
  "modification": "=== INSTRUCCIONES DE AJUSTE ===\n...",
  "groupContext": { ... },
  "evaluation_design_plan": { ... },
  "currentEvaluationSpec": { ... },
  "adjustmentDetails": {
    "targetVersions": "all",
    "scope": "entire",
    "sectionId": null,
    "itemId": null
  }
}
```

### Adjustment Instruction Building

The `buildAdjustmentInstruction()` function (client-side) creates a structured instruction:

```
=== INSTRUCCIONES DE AJUSTE ===

ALCANCE: Aplicar cambios a toda la evaluación

VERSIONES: Aplicar a todas las versiones (A, B, C si existen)

AJUSTES SOLICITADOS POR EL DOCENTE:
<teacher's text>

=== RESTRICCIONES ===
1. NO cambiar los contenidos curriculares
2. NO agregar contenido fuera del tema
3. PRESERVAR los IDs de secciones e ítems
4. MANTENER la estructura general
5. Se permite mejorar: redacción, claridad, instrucciones, scaffolding, formato
```

## Verification

1. Generate a V2 evaluation
2. Expand "Solicitar ajustes" panel
3. Enter adjustment text (e.g., "Simplificá las instrucciones de la parte 1")
4. Select target versions and scope
5. Click "Aplicar ajustes"
6. Verify the evaluation updates
7. Click "Deshacer último cambio" to revert

## Future Improvements

- Multi-step undo history
- Adjustment history log
- Diff view between versions
- Persist adjustment history to database
