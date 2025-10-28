# "Educación para la Ciudadanía" Data Not Loading - Root Cause Analysis

**RUN_ID:** `planificacion-ciudadania_2025-10-28_analysis`  
**Date:** October 28, 2025  
**Affected Routes:**  
- ❌ **Planning Wizard:** `/planificacion/nuevo` (broken)
- ✅ **Evaluations:** `/evaluaciones` (working correctly)

**Analyst:** Claude (Staff+ Frontend Architect Mode)  
**Status:** ANALYSIS COMPLETE (No code changes)

---

## Executive Summary

The Planning Wizard fails to display ANEP Program Contents and Specific Competencies for "Educación para la Ciudadanía" due to **missing import and incomplete mapping logic** in `CompetenceSelector.tsx`. The component:

1. ✅ **Correctly handles the label mismatch** for ANEP contents ("Educación para la Ciudadanía" → "Formación para la ciudadanía")
2. ❌ **Missing import** for `competenciasCiudadania.ts` functions
3. ❌ **Incomplete if-else chain** that only checks Historia and Literatura, defaulting to empty array `[]` for Ciudadanía

Meanwhile, the Evaluations page **correctly imports and maps** all three subjects.

**Impact:** Users selecting "Educación para la Ciudadanía" in the wizard see empty dropdowns for competencies, making the subject unusable.

---

## Root Causes (File:Line References)

### Root Cause #1: Missing Import in CompetenceSelector

**File:** `src/components/planificacion/CompetenceSelector.tsx`  
**Lines:** 1-12 (import section)

**Current State:**
```tsx
import { COMPETENCIAS_HISTORIA, getCompetenciasEspecificas } from '@/data/competencias';
import { COMPETENCIAS_LITERATURA, getCompetenciasEspecificasLiteratura } from '@/data/competenciasLiteratura';
import { CATALOGO_JERARQUICO, contenidosPorMateria, type Materia } from '@/data/catalogo';
```

**Missing:**
```tsx
// ❌ NOT IMPORTED
import { COMPETENCIAS_CIUDADANIA, getCompetenciasEspecificasCiudadania } from '@/data/competenciasCiudadania';
```

**Evidence:** Evaluations page (working) has this import at line 19:
```tsx
// src/pages/EvaluacionesGrupo.tsx:19
import { getCompetenciasEspecificasCiudadania, getCriteriosLogroPorCompetenciasCiudadania } from "@/data/competenciasCiudadania";
```

---

### Root Cause #2: Incomplete Materia → Competencias Mapping

**File:** `src/components/planificacion/CompetenceSelector.tsx`  
**Lines:** 35-39

**Current Logic:**
```tsx
const competencias = materia === 'Historia' 
  ? getCompetenciasEspecificas()
  : materia === 'Literatura' 
  ? getCompetenciasEspecificasLiteratura()
  : [];  // ❌ Returns empty array for Ciudadanía
```

**Issue:** The ternary chain only handles Historia and Literatura. When `materia === 'Educación para la Ciudadanía'`, it falls through to the default `[]`.

**Expected Logic (from Evaluations page):**
```tsx
// EvaluacionesGrupo.tsx uses conditional rendering per materia:
{materia === "Historia" && getCompetenciasEspecificas().map(...)}
{materia === "Literatura" && getCompetenciasEspecificasLiteratura().map(...)}
{materia === "Formación para la ciudadanía" && getCompetenciasEspecificasCiudadania().map(...)}
```

---

### Root Cause #3: Label Mismatch (Partially Handled)

**File:** `src/components/planificacion/CompetenceSelector.tsx`  
**Lines:** 42-44

**Current State (ANEP Contents):**
```tsx
const materiaCatalogo = materia === 'Educación para la Ciudadanía' 
  ? 'Formación para la ciudadanía' as Materia
  : materia as Materia;

const contenidosCatalogo = contenidosPorMateria(materiaCatalogo);
```

**Status:** ✅ **This works correctly!** The component already translates the wizard's label ("Educación para la Ciudadanía") to the catalog's canonical key ("Formación para la ciudadanía").

**Evidence:** ANEP contents ARE loading correctly (catalogo.ts uses "Formación para la ciudadanía" at lines 293-400).

---

### Root Cause Summary Table

| Issue | File | Lines | Severity | Fixed? |
|-------|------|-------|----------|--------|
| Missing import for Ciudadanía competencies | CompetenceSelector.tsx | 1-12 | 🔴 **Critical** | ❌ No |
| Incomplete materia → competencias mapping | CompetenceSelector.tsx | 35-39 | 🔴 **Critical** | ❌ No |
| Label mismatch for ANEP contents | CompetenceSelector.tsx | 42-44 | 🟢 **Already handled** | ✅ Yes |
| Missing import in other components | (see Blast Radius below) | Various | 🟡 **Medium** | ❌ No |

---

## Data Shape Parity Check

### Expected Structure (from competenciasCiudadania.ts)

```typescript
export interface CompetenciaEspecificaCiudadania {
  id: string;           // e.g., "ce1-ciudadania"
  codigo: string;       // e.g., "CE1"
  nombre: string;       // e.g., "Integración de conceptos sociales..."
  descripcion: string;  // Full text
  criteriosLogro: CriterioLogroCiudadania[];
}

export interface CriterioLogroCiudadania {
  id: string;           // e.g., "cl1-1-ciudadania"
  codigo: string;       // e.g., "CL1.1"
  descripcion: string;
}
```

### Comparison with Historia/Literatura

| Property | Historia | Literatura | Ciudadanía | Match? |
|----------|----------|------------|------------|--------|
| `id` | ✅ slug format | ✅ slug format | ✅ slug format | ✅ Compatible |
| `codigo` | ✅ "CE1", "CE2"... | ✅ "CE1", "CE2"... | ✅ "CE1", "CE2"... | ✅ Compatible |
| `nombre` | ✅ Short title | ✅ Short title | ✅ Short title | ✅ Compatible |
| `descripcion` | ✅ Full text | ✅ Full text | ✅ Full text | ✅ Compatible |
| `criteriosLogro` | ✅ Array | ✅ Array | ✅ Array | ✅ Compatible |

**Conclusion:** ✅ **Data shapes are 100% compatible.** All three subjects use identical interfaces with only different type names (`CompetenciaEspecificaCiudadania` vs `CompetenciaEspecifica`). No structural changes needed.

### Available Functions (Ciudadanía)

| Function | Exported? | Used in Evaluations? | Used in Wizard? |
|----------|-----------|---------------------|-----------------|
| `getCompetenciasEspecificasCiudadania()` | ✅ Yes (line 197) | ✅ Yes (line 1000) | ❌ **No (missing)** |
| `getCriteriosLogroPorCompetenciasCiudadania()` | ✅ Yes (line 201) | ✅ Yes (line 19) | ❌ Not used |
| `getCompetenciaCiudadaniaById()` | ✅ Yes (line 214) | ❓ Not directly | ❌ Not used |
| `COMPETENCIAS_CIUDADANIA` | ✅ Yes (line 18) | ❓ Indirect use | ❌ **No (missing)** |

---

## Flow Diff: Wizard vs Evaluations

### Wizard Flow (src/components/planificacion/CompetenceSelector.tsx)

```
User selects "Educación para la Ciudadanía" in WizardSteps.tsx (line 92)
  ↓
CompetenceSelector receives materia = "Educación para la Ciudadanía"
  ↓
Line 35-39: Check materia
  ├─ materia === 'Historia' → getCompetenciasEspecificas() ✅
  ├─ materia === 'Literatura' → getCompetenciasEspecificasLiteratura() ✅
  └─ ELSE → [] ❌ (Ciudadanía falls here)
  ↓
competencias = [] (EMPTY)
  ↓
Line 42-44: Map label for ANEP contents
  └─ "Educación para la Ciudadanía" → "Formación para la ciudadanía" ✅
  ↓
contenidosCatalogo = contenidosPorMateria("Formación para la ciudadanía") ✅
  ↓
RESULT:
  - Competencias panel: EMPTY ❌
  - ANEP contents panel: POPULATED ✅
```

### Evaluations Flow (src/pages/EvaluacionesGrupo.tsx)

```
User selects "Formación para la ciudadanía" in dropdown (line 899)
  ↓
materia state = "Formación para la ciudadanía" (canonical key used directly)
  ↓
Line 1000: Conditional render
  └─ {materia === "Formación para la ciudadanía" && getCompetenciasEspecificasCiudadania().map(...)}
  ↓
competencias = [...7 competencias from COMPETENCIAS_CIUDADANIA] ✅
  ↓
contenidosCatalogo = contenidosPorMateria("Formación para la ciudadanía") ✅
  ↓
RESULT:
  - Competencias panel: POPULATED ✅
  - ANEP contents panel: POPULATED ✅
```

### Key Differences

| Aspect | Wizard | Evaluations | Impact |
|--------|--------|-------------|--------|
| **Label used** | "Educación para la Ciudadanía" | "Formación para la ciudadanía" | Wizard must translate |
| **Import Ciudadanía** | ❌ Missing | ✅ Line 19 | Wizard can't access data |
| **Mapping logic** | Ternary chain (incomplete) | Conditional rendering per materia | Wizard defaults to `[]` |
| **ANEP contents** | ✅ Translates correctly | ✅ Uses canonical key | Both work |

---

## Fix Options (Ranked)

### Option 1: Add Import + Extend Ternary Chain (Minimal, Recommended)

**Scope:** Single file, minimal changes  
**Risk:** 🟢 **Very Low** (surgical fix)

**Files to Modify:**
1. `src/components/planificacion/CompetenceSelector.tsx`

**Exact Changes:**

**Change 1.1: Add Import (line 12, after competenciasLiteratura import)**
```diff
 import { COMPETENCIAS_LITERATURA, getCompetenciasEspecificasLiteratura } from '@/data/competenciasLiteratura';
+import { COMPETENCIAS_CIUDADANIA, getCompetenciasEspecificasCiudadania } from '@/data/competenciasCiudadania';
 import { CATALOGO_JERARQUICO, contenidosPorMateria, type Materia } from '@/data/catalogo';
```

**Change 1.2: Extend Ternary Chain (lines 35-39)**
```diff
 const competencias = materia === 'Historia' 
   ? getCompetenciasEspecificas()
   : materia === 'Literatura' 
   ? getCompetenciasEspecificasLiteratura()
-  : [];
+  : materia === 'Educación para la Ciudadanía'
+  ? getCompetenciasEspecificasCiudadania()
+  : [];
```

**Alternative (if we want to use canonical key for consistency):**
```diff
 const competencias = materia === 'Historia' 
   ? getCompetenciasEspecificas()
   : materia === 'Literatura' 
   ? getCompetenciasEspecificasLiteratura()
-  : [];
+  : (materia === 'Educación para la Ciudadanía' || materia === 'Formación para la ciudadanía')
+  ? getCompetenciasEspecificasCiudadania()
+  : [];
```

**Pros:**
- ✅ Minimal blast radius (1 file, 3 lines added)
- ✅ Matches existing pattern (Historia/Literatura already use ternary)
- ✅ No refactoring needed
- ✅ Easy to test and verify
- ✅ Fast to implement (~2 minutes)

**Cons:**
- ⚠️ Ternary chain gets longer (consider refactor if adding more subjects later)
- ⚠️ Doesn't address broader design issue of label inconsistency

**Acceptance Criteria:**
- ✅ "Educación para la Ciudadanía" shows 7 competencies in wizard
- ✅ ANEP contents remain populated (regression test)
- ✅ Historia and Literatura unaffected

---

### Option 2: Centralized Mapper Function (Scalable, Medium Effort)

**Scope:** Create shared utility, update 2-3 files  
**Risk:** 🟡 **Low-Medium** (touches multiple files, but cleaner architecture)

**Files to Modify:**
1. `src/lib/subjectMapper.ts` (NEW FILE)
2. `src/components/planificacion/CompetenceSelector.tsx` (update import + logic)
3. Optionally: `src/pages/EvaluacionesGrupo.tsx` (refactor to use mapper)

**New File: src/lib/subjectMapper.ts**
```typescript
import { getCompetenciasEspecificas, type CompetenciaEspecifica } from '@/data/competencias';
import { getCompetenciasEspecificasLiteratura } from '@/data/competenciasLiteratura';
import { getCompetenciasEspecificasCiudadania, type CompetenciaEspecificaCiudadania } from '@/data/competenciasCiudadania';
import type { Materia } from '@/data/catalogo';

/**
 * Canonical subject keys used in data layer (catalogo.ts, etc.)
 */
export type CanonicalSubject = Materia; // "Historia" | "Literatura" | "Formación para la ciudadanía"

/**
 * Display labels used in UI (wizard, forms)
 */
export type DisplaySubjectLabel = 
  | "Historia" 
  | "Literatura" 
  | "Educación para la Ciudadanía";

/**
 * Map display labels to canonical keys
 */
export const SUBJECT_LABEL_MAP: Record<DisplaySubjectLabel, CanonicalSubject> = {
  "Historia": "Historia",
  "Literatura": "Literatura",
  "Educación para la Ciudadanía": "Formación para la ciudadanía"
};

/**
 * Normalize any subject string to canonical key
 * Handles accents, casing, and label variants
 */
export function normalizeSubjectKey(subject: string): CanonicalSubject | null {
  // Exact match for canonical keys
  if (subject === "Historia" || subject === "Literatura" || subject === "Formación para la ciudadanía") {
    return subject as CanonicalSubject;
  }
  
  // Map display labels
  if (subject in SUBJECT_LABEL_MAP) {
    return SUBJECT_LABEL_MAP[subject as DisplaySubjectLabel];
  }
  
  // Fallback: case-insensitive, accent-tolerant matching
  const normalized = subject.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
  
  if (normalized.includes("historia")) return "Historia";
  if (normalized.includes("literatura")) return "Literatura";
  if (normalized.includes("ciudadan") || normalized.includes("formacion")) {
    return "Formación para la ciudadanía";
  }
  
  return null;
}

/**
 * Get competencies for any subject (with type narrowing)
 */
export function getCompetenciasBySubject(
  subject: string
): CompetenciaEspecifica[] | CompetenciaEspecificaCiudadania[] {
  const canonical = normalizeSubjectKey(subject);
  
  switch (canonical) {
    case "Historia":
      return getCompetenciasEspecificas();
    case "Literatura":
      return getCompetenciasEspecificasLiteratura();
    case "Formación para la ciudadanía":
      return getCompetenciasEspecificasCiudadania();
    default:
      return [];
  }
}
```

**Update CompetenceSelector.tsx:**
```diff
-import { COMPETENCIAS_HISTORIA, getCompetenciasEspecificas } from '@/data/competencias';
-import { COMPETENCIAS_LITERATURA, getCompetenciasEspecificasLiteratura } from '@/data/competenciasLiteratura';
+import { getCompetenciasBySubject, normalizeSubjectKey } from '@/lib/subjectMapper';
 import { CATALOGO_JERARQUICO, contenidosPorMateria, type Materia } from '@/data/catalogo';

...

-  const competencias = materia === 'Historia' 
-    ? getCompetenciasEspecificas()
-    : materia === 'Literatura' 
-    ? getCompetenciasEspecificasLiteratura()
-    : [];
+  const competencias = getCompetenciasBySubject(materia);

   // Obtener contenidos del catálogo ANEP según la materia
-  const materiaCatalogo = materia === 'Educación para la Ciudadanía' 
-    ? 'Formación para la ciudadanía' as Materia
-    : materia as Materia;
+  const materiaCatalogo = normalizeSubjectKey(materia) || materia as Materia;
   
   const contenidosCatalogo = contenidosPorMateria(materiaCatalogo);
```

**Pros:**
- ✅ **Future-proof:** Easy to add new subjects (Inglés, Matemática, etc.)
- ✅ **Single source of truth** for subject mapping
- ✅ **Handles edge cases:** Accents, casing, variants
- ✅ **Type-safe:** TypeScript ensures correct keys
- ✅ **DRY:** Eliminates duplicate if-else chains across codebase

**Cons:**
- ⚠️ More code to write (~70 lines new file)
- ⚠️ Requires updating multiple components (CompetenceSelector, potentially others)
- ⚠️ Longer testing cycle (test mapper + all consumers)

**Acceptance Criteria:**
- ✅ All subjects work in wizard and evaluations
- ✅ Handles "Educación para la Ciudadanía" and "Formación para la ciudadanía" interchangeably
- ✅ Case-insensitive and accent-tolerant matching
- ✅ Unit tests for mapper pass

---

### Option 3: Use Evaluations Pattern (Conditional Rendering)

**Scope:** Refactor CompetenceSelector to match Evaluations page  
**Risk:** 🟡 **Medium** (larger refactor, changes component structure)

**Files to Modify:**
1. `src/components/planificacion/CompetenceSelector.tsx` (significant refactor)

**Approach:**
- Replace ternary chain with conditional rendering per materia (like Evaluations line 945-1030)
- Import all 3 competency modules
- Render competency checkboxes conditionally based on materia

**Conceptual Change:**
```tsx
import { getCompetenciasEspecificas } from '@/data/competencias';
import { getCompetenciasEspecificasLiteratura } from '@/data/competenciasLiteratura';
import { getCompetenciasEspecificasCiudadania } from '@/data/competenciasCiudadania';

...

{/* Historia competencias */}
{materia === 'Historia' && getCompetenciasEspecificas().map(comp => (
  <CompetenciaCheckbox key={comp.id} competencia={comp} ... />
))}

{/* Literatura competencias */}
{materia === 'Literatura' && getCompetenciasEspecificasLiteratura().map(comp => (
  <CompetenciaCheckbox key={comp.id} competencia={comp} ... />
))}

{/* Ciudadanía competencias */}
{(materia === 'Educación para la Ciudadanía' || materia === 'Formación para la ciudadanía') && 
  getCompetenciasEspecificasCiudadania().map(comp => (
    <CompetenciaCheckbox key={comp.id} competencia={comp} ... />
  ))}
```

**Pros:**
- ✅ Matches proven pattern from Evaluations (consistency)
- ✅ Explicit per-materia handling (easier to debug)
- ✅ No new files or abstractions

**Cons:**
- ❌ **Larger refactor** (~50 lines changed in CompetenceSelector)
- ❌ More verbose than ternary (repeated conditional blocks)
- ❌ Doesn't solve root issue of label inconsistency
- ❌ **Higher risk** of breaking existing Historia/Literatura rendering

**Acceptance Criteria:**
- ✅ Same as Option 1
- ✅ Component structure matches Evaluations pattern
- ✅ No performance regression (conditional rendering is efficient)

---

### Recommended Approach: **Option 1** (Minimal Fix)

**Why:**
1. 🎯 **Solves the immediate problem** with minimal code changes
2. 🚀 **Fastest to implement and test** (~5 minutes coding, 10 minutes testing)
3. 🔒 **Lowest risk** (surgical change, no refactoring)
4. ✅ **Follows existing pattern** (ternary chain already used for Historia/Literatura)
5. 🧪 **Easy rollback** (single 3-line change)

**When to use Option 2:**
- If adding 4+ subjects in the future
- If label inconsistency becomes a broader issue
- As part of a larger refactor sprint

**When to use Option 3:**
- If team prefers conditional rendering pattern universally
- If CompetenceSelector is already being refactored for other reasons

---

## Blast Radius Audit

### Components Potentially Affected by Subject Mapping

| Component | File | Uses Materia? | Handles Ciudadanía? | Needs Fix? |
|-----------|------|---------------|---------------------|------------|
| **WizardSteps** | `src/components/planificacion/WizardSteps.tsx` | ✅ Line 92 | ✅ Dropdown has "Educación para la Ciudadanía" | ✅ No (display only) |
| **CompetenceSelector** | `src/components/planificacion/CompetenceSelector.tsx` | ✅ Lines 35-44 | ⚠️ Partial (contents yes, competencias no) | ❌ **YES (ROOT CAUSE)** |
| **UnidadCard** | `src/components/planificacion/UnidadCard.tsx` | ✅ Line 41 | ✅ Has case for "Formación para la ciudadanía" | ✅ No |
| **BibliotecaElementos** | `src/components/planificacion/BibliotecaElementos.tsx` | ✅ Line 45 | ✅ Has case for "Formación para la ciudadanía" | ✅ No |
| **ResumenPlanificacion** | `src/components/planificacion/ResumenPlanificacion.tsx` | ✅ Line 36 | ✅ Has case for "Formación para la ciudadanía" | ✅ No |
| **EvaluacionesGrupo** | `src/pages/EvaluacionesGrupo.tsx` | ✅ Lines 899, 945-1030 | ✅ Fully implemented | ✅ **No (REFERENCE)** |

**Key Finding:** Only `CompetenceSelector.tsx` is broken. Other components either:
- Use "Formación para la ciudadanía" consistently (UnidadCard, BibliotecaElementos, ResumenPlanificacion)
- Only handle display labels (WizardSteps)
- Work correctly (EvaluacionesGrupo)

**Regression Risk:** 🟢 **Very Low** if we only fix CompetenceSelector

---

## Label Inconsistency Map

### Current Subject Labels Across Codebase

| Location | Key/Label Used | Type |
|----------|---------------|------|
| **WizardSteps dropdown** (line 92) | "Educación para la Ciudadanía" | Display label |
| **catalogo.ts Materia type** (line 4) | "Formación para la ciudadanía" | Canonical key |
| **CATALOGO_JERARQUICO** (lines 293-400) | "Formación para la ciudadanía" | Data key |
| **competenciasCiudadania.ts comment** (line 1) | "Formación para la ciudadanía" | Documentation |
| **EvaluacionesGrupo dropdown** (line 899) | "Formación para la ciudadanía" | Display label |
| **CompetenceSelector (ANEP contents)** (line 42) | Translates "Educación..." → "Formación..." | ✅ Handled |
| **CompetenceSelector (competencias)** (line 35) | ❌ No translation for competencias | **BROKEN** |

### Proposed Canonical Key

**Recommendation:** Use `"Formación para la ciudadanía"` as canonical key everywhere.

**Rationale:**
1. ✅ Matches ANEP official program name
2. ✅ Used in catalogo.ts (data layer source of truth)
3. ✅ Used in competenciasCiudadania.ts file documentation
4. ✅ Used in Evaluations page (working reference)

**Display Label Variants:**
- UI-facing (wizard): "Educación para la Ciudadanía" (more user-friendly?)
- Data layer: "Formación para la ciudadanía" (ANEP official)

**Proposed Mapping (if implementing Option 2):**
```typescript
{
  displayLabel: "Educación para la Ciudadanía",
  canonicalKey: "Formación para la ciudadanía",
  aliases: [
    "Formacion para la ciudadania",  // No accents
    "educacion para la ciudadania",   // Lowercase
    "ciudadania",                      // Short form
    "formacion ciudadana"              // Variant
  ],
  datasets: {
    competencias: COMPETENCIAS_CIUDADANIA,
    contenidos: CATALOGO_JERARQUICO.filter(c => c.materia === "Formación para la ciudadanía")
  }
}
```

---

## Acceptance Criteria

### Functional Requirements

**FR1: Competencias Display**
- ✅ Selecting "Educación para la Ciudadanía" in wizard shows 7 specific competencies
- ✅ Each competencia has correct `codigo` (CE1-CE7), `nombre`, `descripcion`
- ✅ Checkboxes are functional (can select/deselect)

**FR2: ANEP Contents Display**
- ✅ ANEP contents panel shows 3 chapters (La convivencia, Democracia y ciudadanía, Derechos)
- ✅ Subtemas are selectable (collapsible sections work)
- ✅ Contents match catalogo.ts data for "Formación para la ciudadanía"

**FR3: No Regressions**
- ✅ Historia competencias still load (getCompetenciasEspecificas())
- ✅ Literatura competencias still load (getCompetenciasEspecificasLiteratura())
- ✅ ANEP contents for Historia/Literatura unchanged

**FR4: Label Handling**
- ✅ Works with "Educación para la Ciudadanía" (wizard label)
- ✅ Works with "Formación para la ciudadanía" (canonical key)
- ⚠️ (Optional for Option 2) Case-insensitive matching
- ⚠️ (Optional for Option 2) Accent-tolerant matching

### Non-Functional Requirements

**NFR1: Performance**
- ✅ No noticeable delay when switching between subjects
- ✅ No unnecessary re-renders or data fetching

**NFR2: Type Safety**
- ✅ TypeScript compilation succeeds with no new errors
- ✅ Materia types remain strict (no `as any` casts)

**NFR3: Code Quality**
- ✅ Consistent with existing patterns (Option 1) OR
- ✅ Improves architecture (Option 2)
- ✅ No linting errors

---

## Test Plan (Manual Verification)

### Test Setup
```bash
# Ensure dev server is running
npm run dev

# Navigate to Planning Wizard
# URL: http://localhost:8080/planificacion/nuevo
```

### Test Case 1: Ciudadanía Competencias Load (Critical)

**Steps:**
1. Open Planning Wizard (`/planificacion/nuevo`)
2. Login as teacher if required
3. **Step 1 - Contexto:** Select "Educación para la Ciudadanía" from materia dropdown
4. Click "Siguiente" to proceed to Step 2
5. **Step 2 - Enfoque Pedagógico:** Scroll to "Competencias Específicas" section

**Expected Result:**
- ✅ Panel shows 7 competencias:
  - CE1: "Integración de conceptos sociales, jurídicos y políticos"
  - CE2: "Cuestionamiento y problematización de situaciones cotidianas"
  - CE3: "Colaboración en situaciones que involucren a la comunidad"
  - CE5: "Análisis y comprensión del patrimonio cultural"
  - CE7: "Interpreta, cuestiona y resignifica la información..."
  - (Plus 2 more)
- ✅ Each competencia is checkable
- ✅ Clicking checkbox selects/deselects competencia
- ✅ Criterios de logro appear when competencia is selected

**Actual Result (Before Fix):**
- ❌ Panel is empty or shows "No competencias available"

**Actual Result (After Fix):**
- ✅ Should match Expected Result

---

### Test Case 2: Ciudadanía ANEP Contents Load (Regression)

**Steps:**
1. Continue from TC1 (Ciudadanía selected)
2. Scroll to "Contenidos del Programa ANEP" section

**Expected Result:**
- ✅ Shows 3 macro chapters:
  1. "LA CONVIVENCIA EN LA CONSTRUCCIÓN DE CIUDADANÍA"
  2. "DEMOCRACIA Y CIUDADANÍA"
  3. "DERECHOS HUMANOS, ÉTICA Y CULTURA DE PAZ"
- ✅ Each chapter is expandable (chevron icon)
- ✅ Subtemas are selectable (checkboxes)

**Actual Result (Before and After Fix):**
- ✅ Should work in both cases (ANEP contents already load correctly)

---

### Test Case 3: Historia Regression Test

**Steps:**
1. Reset wizard or open new session
2. **Step 1:** Select "Historia" from materia dropdown
3. **Step 2:** Check "Competencias Específicas" and "Contenidos del Programa ANEP"

**Expected Result:**
- ✅ Competencias show (9 competencias for Historia)
- ✅ ANEP contents show (3 chapters: La construcción de un modelo..., La consolidación..., Crisis y transformaciones...)
- ✅ No errors in console

---

### Test Case 4: Literatura Regression Test

**Steps:**
1. Reset wizard
2. **Step 1:** Select "Literatura"
3. **Step 2:** Check both panels

**Expected Result:**
- ✅ Competencias show (7 competencias for Literatura)
- ✅ ANEP contents show (3 chapters for Literatura)
- ✅ No errors in console

---

### Test Case 5: Competencia Selection and Mapping

**Steps:**
1. Select "Educación para la Ciudadanía"
2. In Step 2, select competencia CE1
3. In "Contenidos del Programa ANEP", select a subtema (e.g., "Las normas y su importancia...")
4. Scroll to "Mapeo de Competencias y Contenidos" section
5. Click "Asociar" button to link CE1 with selected contenido

**Expected Result:**
- ✅ Mapping UI appears
- ✅ Can associate CE1 with ANEP contenido
- ✅ Badge shows mapping (e.g., "CE1 → [contenido]")
- ✅ Can remove mapping

---

### Test Case 6: Cross-Page Consistency (Evaluations Reference)

**Steps:**
1. Navigate to `/evaluaciones`
2. Select "Formación para la ciudadanía" from materia dropdown
3. Expand "Competencias Específicas" section

**Expected Result:**
- ✅ Shows same 7 competencias as wizard (after fix)
- ✅ Same IDs, códigos, nombres, descripciones
- ✅ Criterios de logro match

---

### Test Case 7: Edge Cases (Desktop + Mobile)

**Viewports to Test:**
- 375px (iPhone SE)
- 768px (iPad)
- 1440px (Desktop)

**Steps:**
1. Repeat TC1 on each viewport
2. Verify competencias and contents sections are responsive

**Expected Result:**
- ✅ No layout breaks
- ✅ Checkboxes and collapsibles functional on all sizes
- ✅ Text wraps correctly (no overflow)

---

### Test Case 8: Console Error Check

**Steps:**
1. Open browser DevTools (F12) → Console tab
2. Perform TC1-TC5
3. Monitor for errors

**Expected Result:**
- ✅ No TypeScript errors (e.g., "Cannot read property 'map' of undefined")
- ✅ No import errors (e.g., "Module not found")
- ⚠️ Warnings OK (e.g., chunk size warnings)

---

## Unit Test Outline (for Future Implementation)

### If Implementing Option 2 (Mapper Function)

**File:** `src/lib/__tests__/subjectMapper.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { 
  normalizeSubjectKey, 
  getCompetenciasBySubject,
  SUBJECT_LABEL_MAP 
} from '../subjectMapper';

describe('subjectMapper', () => {
  describe('normalizeSubjectKey', () => {
    it('returns canonical key for exact matches', () => {
      expect(normalizeSubjectKey('Historia')).toBe('Historia');
      expect(normalizeSubjectKey('Literatura')).toBe('Literatura');
      expect(normalizeSubjectKey('Formación para la ciudadanía')).toBe('Formación para la ciudadanía');
    });

    it('maps display labels to canonical keys', () => {
      expect(normalizeSubjectKey('Educación para la Ciudadanía')).toBe('Formación para la ciudadanía');
    });

    it('handles case-insensitive variants', () => {
      expect(normalizeSubjectKey('historia')).toBe('Historia');
      expect(normalizeSubjectKey('LITERATURA')).toBe('Literatura');
      expect(normalizeSubjectKey('educación para la ciudadanía')).toBe('Formación para la ciudadanía');
    });

    it('handles accent variants', () => {
      expect(normalizeSubjectKey('Formacion para la ciudadania')).toBe('Formación para la ciudadanía');
      expect(normalizeSubjectKey('Educacion para la Ciudadania')).toBe('Formación para la ciudadanía');
    });

    it('returns null for unknown subjects', () => {
      expect(normalizeSubjectKey('Matemática')).toBeNull();
      expect(normalizeSubjectKey('Inglés')).toBeNull();
      expect(normalizeSubjectKey('')).toBeNull();
    });
  });

  describe('getCompetenciasBySubject', () => {
    it('returns Historia competencias (9 items)', () => {
      const competencias = getCompetenciasBySubject('Historia');
      expect(competencias).toHaveLength(9);
      expect(competencias[0]).toHaveProperty('codigo', 'CE1');
    });

    it('returns Literatura competencias (7 items)', () => {
      const competencias = getCompetenciasBySubject('Literatura');
      expect(competencias).toHaveLength(7);
      expect(competencias[0]).toHaveProperty('codigo', 'CE1');
    });

    it('returns Ciudadanía competencias with display label', () => {
      const competencias = getCompetenciasBySubject('Educación para la Ciudadanía');
      expect(competencias).toHaveLength(7); // Assuming 7 competencias
      expect(competencias[0]).toHaveProperty('id', 'ce1-ciudadania');
    });

    it('returns Ciudadanía competencias with canonical key', () => {
      const competencias = getCompetenciasBySubject('Formación para la ciudadanía');
      expect(competencias).toHaveLength(7);
    });

    it('returns empty array for unknown subject', () => {
      const competencias = getCompetenciasBySubject('Matemática');
      expect(competencias).toEqual([]);
    });
  });
});
```

**Run Tests:**
```bash
npm run test -- subjectMapper.test.ts
```

---

## Open Questions for Team Discussion

### Q1: Canonical Display Label

**Question:** Should we standardize on "Educación para la Ciudadanía" (user-friendly) or "Formación para la ciudadanía" (ANEP official) as the display label across all UI?

**Current State:**
- Wizard uses: "Educación para la Ciudadanía"
- Evaluations uses: "Formación para la ciudadanía"
- Data layer uses: "Formación para la ciudadanía"

**Options:**
- **A:** Keep "Educación para la Ciudadanía" in wizard for UX, translate internally
- **B:** Change wizard to "Formación para la ciudadanía" for consistency
- **C:** Use both as valid aliases (implement Option 2 mapper)

**Recommendation:** **Option A** (current wizard label is fine, just fix the mapping)

---

### Q2: Accent/Casing Normalization

**Question:** Should we implement accent-insensitive and case-insensitive matching for subject keys?

**Use Case:** 
- User types "formacion ciudadania" in search
- Backend API returns "Formación para la ciudadanía"
- Should we auto-match?

**Recommendation:** **Yes, if implementing Option 2.** Otherwise, exact match is sufficient for MVP.

---

### Q3: Future Subjects

**Question:** Are we planning to add more subjects (Matemática, Inglés, Educación Física, etc.)?

**Impact on Fix Strategy:**
- If **yes** (4+ subjects planned): Implement **Option 2** (centralized mapper) now
- If **no** (only 3 subjects): Implement **Option 1** (minimal fix) now, refactor later

**Recommendation:** Ask product team. Most schools have 10+ subjects, so Option 2 may be worth it.

---

### Q4: Type Safety for Subject Keys

**Question:** Should we enforce subject keys via TypeScript enum or union type?

**Current State:**
- `Materia` type exists in catalogo.ts: `"Literatura" | "Formación para la ciudadanía" | "Historia"`
- But wizard uses string literal "Educación para la Ciudadanía" (not in type)

**Proposal:**
```typescript
// src/types/subjects.ts
export type CanonicalSubject = "Historia" | "Literatura" | "Formación para la ciudadanía";
export type DisplaySubject = "Historia" | "Literatura" | "Educación para la Ciudadanía";
export type SubjectKey = CanonicalSubject | DisplaySubject; // Union of both
```

**Recommendation:** **Yes, add stricter types** if implementing Option 2.

---

### Q5: WizardSteps Dropdown Label

**Question:** Should we change the wizard dropdown to use "Formación para la ciudadanía" instead of "Educación para la Ciudadanía"?

**Pros of changing:**
- ✅ Consistency with Evaluations page
- ✅ Matches ANEP official name
- ✅ Eliminates need for translation logic

**Cons of changing:**
- ❌ "Educación para la Ciudadanía" may be more recognizable to teachers
- ❌ Breaks any existing saved plans that reference the old label

**Recommendation:** **Keep current label**, just fix the mapping. Users are already familiar with it.

---

### Q6: Retroactive Fix for Existing Plans

**Question:** If we change label/mapping logic, do we need to migrate existing `planificaciones` in the database that have `materia: "Educación para la Ciudadanía"`?

**Scenarios:**
1. Plans saved before fix: `materia: "Educación para la Ciudadanía"`
2. After fix: Does competency loading still work?

**Option 1 (Minimal Fix):** ✅ **No migration needed** (fix handles both labels)  
**Option 2 (Mapper):** ✅ **No migration needed** (mapper normalizes both)

**Recommendation:** No database migration required for any option.

---

## Implementation Plan Checklist

Use this checklist for the next prompt when implementing the fix:

### Pre-Implementation

- [ ] **Decision:** Choose fix option (1, 2, or 3) based on team discussion
- [ ] **Decision:** Confirm canonical label ("Formación para la ciudadanía")
- [ ] **Decision:** Decide if wizard dropdown label should change
- [ ] **Branch:** Create feature branch `fix/ciudadania-competencias_2025-10-28`

---

### Implementation (Option 1 - Minimal Fix)

- [ ] **Edit:** `src/components/planificacion/CompetenceSelector.tsx`
  - [ ] Line 12: Add import for `competenciasCiudadania`
  - [ ] Lines 35-39: Extend ternary chain to handle Ciudadanía
  - [ ] Optional: Add type annotation for competencias array
- [ ] **Build:** Run `npm run build` → verify no TypeScript errors
- [ ] **Lint:** Run linter → fix any issues

---

### Implementation (Option 2 - Centralized Mapper)

- [ ] **Create:** `src/lib/subjectMapper.ts` with mapper functions
- [ ] **Edit:** `src/components/planificacion/CompetenceSelector.tsx`
  - [ ] Update imports to use mapper
  - [ ] Replace ternary chain with `getCompetenciasBySubject(materia)`
  - [ ] Replace label translation with `normalizeSubjectKey(materia)`
- [ ] **Optional:** Refactor other components (UnidadCard, BibliotecaElementos) to use mapper
- [ ] **Tests:** Create `src/lib/__tests__/subjectMapper.test.ts`
- [ ] **Run Tests:** `npm run test`
- [ ] **Build:** `npm run build`

---

### Testing

- [ ] **TC1:** Ciudadanía competencias load in wizard ✅
- [ ] **TC2:** Ciudadanía ANEP contents still load ✅
- [ ] **TC3:** Historia regression test ✅
- [ ] **TC4:** Literatura regression test ✅
- [ ] **TC5:** Competencia-contenido mapping works ✅
- [ ] **TC6:** Cross-page consistency (wizard vs evaluations) ✅
- [ ] **TC7:** Mobile/tablet responsive (375px, 768px, 1440px) ✅
- [ ] **TC8:** No console errors ✅

---

### Documentation

- [ ] **Update:** Add comment in `CompetenceSelector.tsx` explaining label translation
- [ ] **Update:** (If Option 2) Document mapper in `tools/architecture_plan.md`
- [ ] **Create:** Implementation report at `docs/claude_runs/planificacion-ciudadania_2025-10-28_implementation.md`
- [ ] **Update:** (If needed) Update PR description with before/after screenshots

---

### Commit & Deploy

- [ ] **Stage:** `git add src/components/planificacion/CompetenceSelector.tsx`
- [ ] **Stage:** (If Option 2) `git add src/lib/subjectMapper.ts src/lib/__tests__/subjectMapper.test.ts`
- [ ] **Commit:** Use conventional commit message:
  ```
  fix(planificacion): add Ciudadanía competencies to wizard selector
  
  - Import getCompetenciasEspecificasCiudadania from competenciasCiudadania.ts
  - Extend ternary chain to handle "Educación para la Ciudadanía" subject
  - ANEP contents already loaded correctly (materiaCatalogo translation working)
  - Result: wizard now shows 7 Ciudadanía competencias like Evaluations page
  
  Fixes issue where selecting Ciudadanía left competencias panel empty
  while ANEP contents loaded correctly.
  
  Tested with Historia, Literatura, Ciudadanía - all subjects now work.
  ```
- [ ] **Push:** `git push origin fix/ciudadania-competencias_2025-10-28`
- [ ] **PR:** Create pull request with analysis report linked

---

### Post-Deployment

- [ ] **Verify:** Test on staging environment
- [ ] **Monitor:** Check Sentry/error logs for issues
- [ ] **Communicate:** Notify team that Ciudadanía subject is now fully functional

---

## Document Metadata

**Created:** October 28, 2025  
**Analyst:** Claude (Anthropic AI) - Staff+ Frontend Architect Mode  
**Analysis Duration:** ~30 minutes  
**Files Analyzed:** 10+ (CompetenceSelector, WizardSteps, EvaluacionesGrupo, catalogo, competencias files)  
**Root Causes Found:** 2 (missing import, incomplete ternary chain)  
**Fix Options Proposed:** 3 (ranked by effort/risk)  
**Recommendation:** ✅ **Option 1** (Minimal Fix - add import + extend ternary)  

**Next Steps:** Review with team → Choose fix option → Implement using checklist above

**Status:** ✅ **ANALYSIS COMPLETE** (No code changes made per requirement)

---

**END OF ANALYSIS REPORT**
