# Phase 2.2.2: Language Alignment

**Date**: 26 de diciembre de 2024  
**Phase**: 2.2.2 Final Language Alignment

---

## Summary

Phase 2.2.2 standardizes prompt language across Path A (plain text parsing) and Path B (HTML output) to prevent language drift. The modification string in `useFullSessionGeneration.ts` is converted to English, while parser-critical tokens (INICIO, DESARROLLO, CIERRE, Actividad:, Recursos:) remain in Spanish for parser compatibility.

---

## Path A vs Path B

### Path A: Plain Text Parsing

**Flow**: `useFullSessionGeneration.ts` → `modify-evaluation` (type: 'planning') → Plain text output → `parseAIResponseToPlan()`

**Output Format**:
- Plain text (no HTML, no Markdown)
- No title (response starts with "INICIO")
- Structured sections: INICIO, DESARROLLO, CIERRE (Spanish, parser-critical)
- Section labels: Actividad:, Recursos: (Spanish, parser-critical - must match exactly)

**Title Requirements**: None (titles don't exist in Path A output)

### Path B: HTML Output

**Flow**: `PlanificacionWizard.tsx` → `generate-plan-completo` → HTML output → Direct storage

**Output Format**:
- HTML (structured markup)
- Title required: `<h1>` element with class title
- Structured sections: HTML sections with content
- Full document structure

**Title Requirements**: Title uniqueness explicitly required in prompt; must reflect class position (first/middle/final/extra slot)

---

## Language Distribution

### Path A (modify-evaluation)

| Element | Language | Reason |
|---------|----------|--------|
| System prompt | English | Explanatory text |
| Sequence context | English | Instructional text |
| Output format rules | English | Instructions to model |
| Modification string | English | Aligned with edge function prompts |
| Parsing headers | Spanish (INICIO, DESARROLLO, CIERRE) | Parser compatibility |
| Section labels | Spanish (Actividad:, Recursos:) | Parser compatibility |

### Path B (generate-plan-completo)

| Element | Language | Reason |
|---------|----------|--------|
| System prompt | Spanish | "Sos un asistente pedagógico experto..." (Uruguayan Spanish) |
| Sequence context | Spanish | "CONTEXTO DE SECUENCIA DIDÁCTICA:" (Spanish) |
| Output format rules | Spanish | "REQUISITOS ESTRICTOS:" (Spanish) |
| HTML structure | Spanish (section IDs, h2 headers) | UI rendering |
| Title (h1) | Spanish | User-facing content |
| Section labels | Spanish (Actividad:, Recursos:) | Consistent with Path A parser labels |

---

## Progression Validation

### Path A

Progression is enforced via `unitContext` + prompt anti-duplication rules:
1. `unitContext` provides sequence position (claseEnUnidad, totalClasesUnidad)
2. Edge function injects progressive instructions based on position
3. Anti-duplication rules prevent repeated explanations
4. **No automatic cross-session diff validation is implemented**

Validation is purely content-based (titles don't exist in Path A output).

### Path B

Both title and content are validated:
1. `unitContext` provides sequence position
2. Edge function injects progressive instructions + title requirements
3. Title must be distinct and reflect class position
4. Content must be progressive (via sequence context)
5. Both title and content validated

---

## Code Change

**File**: `src/hooks/useFullSessionGeneration.ts`

**Diff snippet showing the explicit label enforcement**:

```diff
  Include specific differentiation integrated into each section, concrete resources, and detailed activities.
+ Use these exact labels in the output: 'Actividad:' and 'Recursos:'.
```

**Purpose**: Prevents output drift by explicitly enforcing Spanish parser-critical labels, even though the instruction text is in English.
