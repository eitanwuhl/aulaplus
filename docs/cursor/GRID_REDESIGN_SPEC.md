# Class Planning Screen — Grid Redesign & Session Summary Styling

**Feature Branch:** `feature/planning-grid-redesign`  
**Status:** Analysis & Preparation Phase  
**Date:** 2025-10-28

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Proposed Layout Changes](#proposed-layout-changes)
4. [Component-Level Specifications](#component-level-specifications)
5. [Responsive Behavior](#responsive-behavior)
6. [Data Mapping & Logic](#data-mapping--logic)
7. [Visual Design Tokens](#visual-design-tokens)
8. [Accessibility Requirements](#accessibility-requirements)
9. [Performance Considerations](#performance-considerations)
10. [Implementation Checklist](#implementation-checklist)
11. [QA Test Cases](#qa-test-cases)
12. [Risks & Mitigations](#risks--mitigations)

---

## 1. Executive Summary

### Goal
Refactor the **Class Planning Workspace** (`PlanificacionWorkspace.tsx`) layout to:
- Expand calendar from 4 to **9 columns**
- Split right panel into **two side-by-side 6-column sections** (Summary + Competencies)
- Create **full-width (12 cols) sections** for Session Summary and AI Assistance
- Polish session summary UI with proper typography, chip-based competency display, and removal of debug strings

### Scope
- ✅ Layout grid restructuring
- ✅ Session summary card visual redesign
- ✅ Competencies panel refinement
- ✅ Responsive breakpoint implementation
- ✅ Competency code-to-label mapping
- ❌ No schema changes
- ❌ No calendar behavior changes
- ❌ No new features

### Key Deliverables
1. Updated `PlanificacionWorkspace.tsx` with new grid layout
2. Refactored `EditorSesionNuevo.tsx` for split panels and full-width sections
3. Competency label resolution utility
4. Visual specification document (this file)

---

## 2. Current State Analysis

### 2.1 Existing Grid Layout

**File:** `src/pages/PlanificacionWorkspace.tsx` (lines 258-282)

```tsx
<div className="grid grid-cols-12 gap-6">
  {/* Backlog (3 columnas) */}
  <div className="col-span-3">
    <BacklogSesiones />
  </div>

  {/* Calendario (4 columnas) */}
  <div className="col-span-4">
    <CalendarioDnD />
  </div>

  {/* Editor de Sesión (5 columnas) */}
  <div className="col-span-5">
    <EditorSesionNuevo />
  </div>
</div>
```

**Total:** 3 + 4 + 5 = **12 columns**

### 2.2 Editor Session Internal Structure

**File:** `src/components/planificacion/EditorSesionNuevo.tsx`

**Current Sections (lines 295-520):**

1. **Session Header Card** (lines 303-336)
   - Title: `contenidoPrincipal` (first content item)
   - Meta grid: Date, Duration, Subject, Level
   - Competency badges: `sesion.competencias_anep.map()`
   - **⚠️ Debug line** (line 335): `Debug: competencias_anep = {JSON.stringify(...)}`

2. **Competencies Card** (lines 351-369)
   - Blue-tinted card with lightbulb icon
   - Title: "¿Cómo se desarrollan estas competencias?"
   - Content: `argumentoCompetencias` HTML

3. **Tabs Container** (lines 372-515)
   - **Clase Tab:**
     - Plan HTML display (lines 381-396)
     - AI modification request card (lines 399-430)
     - Hidden PDF content section (lines 434-502)
   - **Recursos Tab:** (lines 505-512)
   - **Evaluación Tab:** (lines 515-519)

### 2.3 Competency Data Sources

**Files:**
- `src/data/competencias.ts` — Historia competencias (CE1, CE2, etc.)
- `src/data/competenciasLiteratura.ts` — Literatura competencias
- `src/data/competenciasCiudadania.ts` — Ciudadanía competencias

**Structure:**
```typescript
interface CompetenciaEspecifica {
  id: string;
  codigo: string;        // "CE1", "CE2", etc.
  nombre: string;        // Short label
  descripcion: string;   // Full description
  criteriosLogro: CriterioLogro[];
}
```

**Current Usage:**
- `sesion.competencias_anep` stores raw strings (e.g., `["CE1", "CE2"]` or full descriptions)
- No label resolution — displays raw value in badges

---

## 3. Proposed Layout Changes

### 3.1 Desktop Layout (≥1280px)

```
┌─────────────────────────────────────────────────────────────┐
│                         Header (12 cols)                    │
├──────────┬──────────────────────────────┬──────────┬─────────┤
│          │                              │          │         │
│ Backlog  │         Calendar             │ Summary  │  Comp.  │
│ (3 cols) │        (9 cols)              │ (6 cols) │(6 cols) │
│          │                              │          │         │
│          │                              │          │         │
└──────────┴──────────────────────────────┴──────────┴─────────┘
                    ▼ When session selected ▼
┌─────────────────────────────────────────────────────────────┐
│                  Session Summary (12 cols)                  │
├─────────────────────────────────────────────────────────────┤
│                  AI Assistance (12 cols)                    │
├─────────────────────────────────────────────────────────────┤
│                  Tabs: Clase | Recursos | Evaluación        │
└─────────────────────────────────────────────────────────────┘
```

**Grid Classes:**
```tsx
<div className="grid grid-cols-12 gap-6">
  {/* Backlog: unchanged */}
  <div className="col-span-3">
    <BacklogSesiones />
  </div>

  {/* Calendar: 4 → 9 columns */}
  <div className="col-span-9 xl:col-span-9">
    <CalendarioDnD />
  </div>

  {/* Editor: split into two rows */}
  <div className="col-span-12 grid grid-cols-12 gap-6">
    {/* Summary panel: 6 cols */}
    <div className="col-span-6">
      <SessionSummaryCard />
    </div>

    {/* Competencies panel: 6 cols */}
    <div className="col-span-6">
      <CompetenciesPanelCard />
    </div>

    {/* Session Summary: full width */}
    <div className="col-span-12">
      <SessionDetailsSection />
    </div>

    {/* AI Assistance: full width */}
    <div className="col-span-12">
      <AIAssistanceSection />
    </div>

    {/* Tabs: full width */}
    <div className="col-span-12">
      <SessionTabs />
    </div>
  </div>
</div>
```

### 3.2 Tablet Layout (768px - 1279px)

```
┌──────────────────────────────────┐
│         Header (12 cols)         │
├──────────────────────────────────┤
│       Backlog (12 cols)          │
├──────────────────────────────────┤
│       Calendar (12 cols)         │
├──────────────────────────────────┤
│       Summary (12 cols)          │
├──────────────────────────────────┤
│    Competencies (12 cols)        │
├──────────────────────────────────┤
│   Session Summary (12 cols)      │
├──────────────────────────────────┤
│   AI Assistance (12 cols)        │
└──────────────────────────────────┘
```

**Grid Classes:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
  <div className="md:col-span-12 lg:col-span-3">
    <BacklogSesiones />
  </div>
  
  <div className="md:col-span-12 lg:col-span-9 xl:col-span-9">
    <CalendarioDnD />
  </div>

  {/* Editor sections stack on tablet */}
  <div className="md:col-span-12">
    <SessionSummaryCard />
  </div>
  <div className="md:col-span-12">
    <CompetenciesPanelCard />
  </div>
  {/* ... rest full-width */}
</div>
```

### 3.3 Mobile Layout (<768px)

Single column flow — all sections 100% width with preserved spacing.

```tsx
<div className="grid grid-cols-1 gap-4">
  <BacklogSesiones />
  <CalendarioDnD />
  <SessionSummaryCard />
  <CompetenciesPanelCard />
  <SessionDetailsSection />
  <AIAssistanceSection />
  <SessionTabs />
</div>
```

---

## 4. Component-Level Specifications

### 4.1 Session Summary Card (NEW)

**Location:** Right panel, 6 columns on desktop  
**Current Implementation:** Lines 303-336 in `EditorSesionNuevo.tsx`  
**Purpose:** Quick overview of session metadata

**Anatomy:**
```
┌────────────────────────────────────────┐
│ 📅 Session Overview                    │ ← Heading (text-lg, font-semibold)
├────────────────────────────────────────┤
│ Contenido Principal Truncated...      │ ← Title (text-xl, 2 lines max, ellipsis)
│ See more ↓                             │ ← Affordance (text-sm, text-primary)
├────────────────────────────────────────┤
│ 📅 15 de marzo    ⏱ 60 min            │ ← Meta row (grid-cols-2, text-sm)
│ 📚 Historia       👥 9º A              │
├────────────────────────────────────────┤
│ [CE1] [CE2 - Interculturalidad] ...   │ ← Competency chips (flex-wrap, gap-2)
├────────────────────────────────────────┤
│ Short description if available...      │ ← Optional description (text-sm, 3 lines max)
└────────────────────────────────────────┘
```

**Props:**
```typescript
interface SessionSummaryCardProps {
  titulo: string;
  fecha?: string;
  duracion: number;
  materia: string;
  nivel: string;
  competencias: string[];  // ["CE1", "CE2", ...]
  descripcionCorta?: string;
}
```

**Tailwind Classes:**
```tsx
<Card className="h-fit">
  <CardHeader className="pb-3">
    <CardTitle className="text-lg font-semibold">
      📅 Session Overview
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Title */}
    <h3 className="text-xl font-bold line-clamp-2">
      {titulo}
    </h3>
    
    {/* Meta Grid */}
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="flex items-center gap-1">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span>{formatFecha(fecha)}</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>{duracion} min</span>
      </div>
      {/* ... materia, nivel */}
    </div>

    {/* Competency Chips */}
    <div className="flex flex-wrap gap-2">
      {competencias.map(comp => (
        <Badge 
          key={comp} 
          variant="secondary"
          className="text-xs"
        >
          {resolveCompetencyLabel(comp, materia)}
        </Badge>
      ))}
    </div>

    {/* Description */}
    {descripcionCorta && (
      <p className="text-sm text-muted-foreground line-clamp-3">
        {descripcionCorta}
      </p>
    )}
  </CardContent>
</Card>
```

**Spacing:**
- Card padding: `p-4` (CardContent default)
- Section gaps: `space-y-4`
- Chip gaps: `gap-2`
- Icon spacing: `gap-1`

**Elevation:**
- Default card shadow (no extra elevation)
- Subtle border: `border`

**Typography:**
- Heading: `text-lg font-semibold`
- Title: `text-xl font-bold`
- Meta: `text-sm`
- Description: `text-sm text-muted-foreground`

**Truncation:**
- Title: `line-clamp-2` (Tailwind utility)
- Description: `line-clamp-3`

**To Remove:**
- ❌ Debug line (line 335): `Debug: competencias_anep = {JSON.stringify(sesion.competencias_anep)}`

---

### 4.2 Competencies Panel (REFINED)

**Location:** Right panel, 6 columns on desktop (side-by-side with Summary)  
**Current Implementation:** Lines 351-369 in `EditorSesionNuevo.tsx`  
**Purpose:** Explain how competencies are developed in this session

**Anatomy:**
```
┌────────────────────────────────────────┐
│ 💡 How Competencies Are Developed     │ ← Heading (text-lg, font-semibold)
├────────────────────────────────────────┤
│ This session develops intercultural    │
│ competence through comparative         │
│ analysis of primary sources from...    │ ← Body (prose, comfortable line-height)
│                                        │
│ Students will engage in:               │
│ • Source analysis                      │
│ • Group discussion                     │
│ • Written reflection                   │
└────────────────────────────────────────┘
```

**Current Issues:**
- ✅ Already has info tint background (`bg-blue-50 dark:bg-blue-950/20`)
- ✅ Has icon (`Lightbulb`)
- ⚠️ Heading could be larger
- ⚠️ Line height could be more comfortable

**Refined Classes:**
```tsx
<Card className="border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 h-fit">
  <CardHeader className="pb-3">
    <CardTitle className="text-lg font-semibold flex items-center gap-2">
      <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      How Competencies Are Developed
    </CardTitle>
  </CardHeader>
  <CardContent>
    {argumentoCompetencias ? (
      <div 
        className="prose prose-sm max-w-none 
          prose-p:leading-relaxed 
          prose-ul:mt-2 prose-ul:space-y-1
          prose-li:text-sm"
        dangerouslySetInnerHTML={{ __html: argumentoCompetencias }}
      />
    ) : (
      <p className="text-sm text-muted-foreground italic">
        Loading competency analysis...
      </p>
    )}
  </CardContent>
</Card>
```

**Changes:**
- Heading: `text-lg` → ensure visible hierarchy
- Background: `bg-blue-50/50` (50% opacity) for calmer highlight
- Prose classes: Add `prose-p:leading-relaxed` for comfortable reading
- Icon color: Adjust for dark mode (`dark:text-blue-400`)
- Height: Add `h-fit` to match Summary card height behavior

---

### 4.3 Session Details Section (FULL-WIDTH)

**Location:** Below Summary + Competencies, 12 columns  
**Purpose:** Display full session plan HTML (Inicio, Desarrollo, Cierre)

**Current Implementation:** Lines 381-396 (inside Tabs)  
**Proposed Change:** Extract as standalone section **above** tabs

**Anatomy:**
```
┌──────────────────────────────────────────────────────────────┐
│ 📋 Session Plan                                              │ ← Heading (text-2xl, font-bold)
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   [Full plan HTML with Inicio, Desarrollo, Cierre]          │ ← Prose content
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Implementation:**
```tsx
<Card className="col-span-12">
  <CardHeader>
    <CardTitle className="text-2xl font-bold flex items-center gap-2">
      <FileText className="h-6 w-6 text-primary" />
      Session Plan
    </CardTitle>
    <CardDescription>
      Complete lesson structure with timing and activities
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div 
      className="prose prose-lg max-w-none
        prose-headings:font-bold
        prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-4
        prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-4 prose-h2:text-primary
        prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-3
        prose-p:mb-4 prose-p:leading-relaxed
        prose-ul:mb-4 prose-ul:ml-4
        prose-li:mb-2
        prose-strong:font-bold prose-strong:text-primary"
      dangerouslySetInnerHTML={{ __html: planHtml }}
    />
  </CardContent>
</Card>
```

**Spacing:**
- Generous padding: Card default + prose spacing
- Heading: `text-2xl` to establish primary hierarchy
- Description: Add context about section purpose

---

### 4.4 AI Assistance Section (FULL-WIDTH)

**Location:** Below Session Plan, 12 columns  
**Current Implementation:** Lines 399-430 (inside Tabs)  
**Proposed Change:** Extract as standalone section **above** tabs

**Anatomy:**
```
┌──────────────────────────────────────────────────────────────┐
│ 🪄 AI Assistance                                             │ ← Heading (text-2xl, font-bold)
├──────────────────────────────────────────────────────────────┤
│ Describe what changes you want the AI to make to this plan  │ ← Description
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Make it more dynamic, add examples...                    │ │ ← Textarea
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│ [Apply Changes] ────────────────────────────────────────────►│ ← Button
└──────────────────────────────────────────────────────────────┘
```

**Implementation:**
```tsx
<Card className="col-span-12 border-l-4 border-purple-500 bg-purple-50/30 dark:bg-purple-950/10">
  <CardHeader>
    <CardTitle className="text-2xl font-bold flex items-center gap-2">
      <Wand2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
      AI Assistance
    </CardTitle>
    <CardDescription>
      Request modifications to this lesson plan using natural language
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <Textarea
      placeholder="E.g., Make the opening activity more engaging, add more examples for struggling students, adjust timing for 45-minute period..."
      value={instruccionesModificacion}
      onChange={(e) => setInstruccionesModificacion(e.target.value)}
      className="min-h-[120px] resize-none"
    />
    <Button 
      onClick={handleSolicitarModificacion}
      disabled={isModificando || !instruccionesModificacion.trim()}
      size="lg"
      className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500"
    >
      {isModificando ? (
        <>
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Applying changes...
        </>
      ) : (
        <>
          <Wand2 className="h-5 w-5 mr-2" />
          Apply Changes
        </>
      )}
    </Button>
  </CardContent>
</Card>
```

**Visual Changes:**
- Background: `bg-purple-50/30` (more subtle than current `bg-purple-50`)
- Heading: `text-2xl` for hierarchy parity with Session Plan
- Button: `size="lg"` for prominence
- Textarea: `min-h-[120px]` for comfortable input area

---

## 5. Responsive Behavior

### 5.1 Breakpoint Strategy

**Tailwind Breakpoints:**
```scss
sm:  640px   // Small phones (not used for this layout)
md:  768px   // Tablets
lg:  1024px  // Small laptops
xl:  1280px  // Desktop (PRIMARY BREAKPOINT)
2xl: 1536px  // Large screens
```

**Our Breakpoints:**
- **Mobile:** `< 768px` — Single column
- **Tablet:** `768px - 1279px` — Stacked 12-column sections
- **Desktop:** `≥ 1280px` — 3-9 split, 6-6 side-by-side, 12 full-width

### 5.2 Class Application

```tsx
{/* Backlog */}
<div className="col-span-12 md:col-span-6 lg:col-span-3">
  <BacklogSesiones />
</div>

{/* Calendar */}
<div className="col-span-12 md:col-span-6 lg:col-span-9 xl:col-span-9">
  <CalendarioDnD />
</div>

{/* Summary */}
<div className="col-span-12 lg:col-span-6">
  <SessionSummaryCard />
</div>

{/* Competencies */}
<div className="col-span-12 lg:col-span-6">
  <CompetenciesPanelCard />
</div>

{/* Full-width sections */}
<div className="col-span-12">
  <SessionDetailsSection />
</div>
```

### 5.3 Layout Shift Prevention

**Strategies:**
- Use `min-h-screen` on container to prevent page jump
- Apply `h-fit` to cards to avoid unnecessary expansion
- Set `max-h-[600px] overflow-y-auto` on calendar if height becomes issue
- Skeleton loaders while loading session data

---

## 6. Data Mapping & Logic

### 6.1 Competency Label Resolution

**Problem:**  
`sesion.competencias_anep` may contain:
- Short codes: `["CE1", "CE2"]`
- Full descriptions: `["Interpreta e interrelaciona de forma crítica..."]`
- Mixed formats

**Solution:** Create utility to resolve labels

**File:** `src/lib/competencyLabelResolver.ts` (NEW)

```typescript
import { COMPETENCIAS_HISTORIA } from '@/data/competencias';
import { COMPETENCIAS_LITERATURA } from '@/data/competenciasLiteratura';
import { COMPETENCIAS_CIUDADANIA } from '@/data/competenciasCiudadania';

const COMPETENCY_CATALOGS = {
  'Historia': COMPETENCIAS_HISTORIA,
  'Literatura': COMPETENCIAS_LITERATURA,
  'Formación para la ciudadanía': COMPETENCIAS_CIUDADANIA,
  'Ciudadanía': COMPETENCIAS_CIUDADANIA,
  'Educación para la Ciudadanía': COMPETENCIAS_CIUDADANIA,
};

export function resolveCompetencyLabel(
  code: string, 
  subject: string
): string {
  const catalog = COMPETENCY_CATALOGS[subject];
  if (!catalog) {
    // No catalog for subject — return code as-is
    return code;
  }

  // Try to find by codigo
  const competencia = catalog.find(c => c.codigo === code.toUpperCase());
  if (competencia) {
    return `${competencia.codigo} – ${competencia.nombre.slice(0, 40)}...`;
  }

  // Try to find by partial match in nombre/descripcion
  const match = catalog.find(c => 
    c.nombre.includes(code) || 
    c.descripcion.includes(code)
  );
  if (match) {
    return `${match.codigo} – ${match.nombre.slice(0, 40)}...`;
  }

  // Fallback: return code with neutral badge
  console.warn(`[CompetencyResolver] No match found for "${code}" in ${subject}`);
  return code;
}
```

**Usage:**
```tsx
{sesion.competencias_anep.map((comp, i) => (
  <Badge key={i} variant="secondary">
    {resolveCompetencyLabel(comp, materia)}
  </Badge>
))}
```

**Fallback Behavior:**
- If code not found → display code as-is
- Log warning once (non-blocking)
- Use neutral badge variant

### 6.2 Subject Normalization

**Issue:** Subject names vary  
**Solution:** Use existing `normalizeSubjectName()` from Phase 3

**File:** `src/lib/subjectNormalizer.ts` (EXISTING)

```typescript
export function normalizeSubjectName(subject: string): string {
  const normalized = subject.toLowerCase().trim();
  
  if (normalized.includes('ciudadan')) {
    return 'Formación para la ciudadanía';
  }
  if (normalized.includes('histor')) {
    return 'Historia';
  }
  if (normalized.includes('literat')) {
    return 'Literatura';
  }
  
  return subject; // Return as-is if no match
}
```

**Integration:**
```typescript
import { normalizeSubjectName } from '@/lib/subjectNormalizer';

// In component
const normalizedSubject = normalizeSubjectName(materia || '');
const label = resolveCompetencyLabel(comp, normalizedSubject);
```

---

## 7. Visual Design Tokens

### 7.1 Typography Scale

```css
/* Headings */
--text-3xl: 1.875rem;  /* 30px - Page title */
--text-2xl: 1.5rem;    /* 24px - Section headings */
--text-xl:  1.25rem;   /* 20px - Card titles */
--text-lg:  1.125rem;  /* 18px - Subheadings */
--text-base: 1rem;     /* 16px - Body text */
--text-sm:  0.875rem;  /* 14px - Secondary text */
--text-xs:  0.75rem;   /* 12px - Captions */

/* Font weights */
--font-bold: 700;
--font-semibold: 600;
--font-medium: 500;
--font-normal: 400;

/* Line heights */
--leading-tight: 1.25;
--leading-snug: 1.375;
--leading-normal: 1.5;
--leading-relaxed: 1.625;
--leading-loose: 2;
```

### 7.2 Spacing Scale

```css
/* Gap between sections */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */

/* Padding */
--p-card: 1rem;      /* 16px - Default card padding */
--p-section: 1.5rem; /* 24px - Section padding */
```

### 7.3 Color Tokens

```css
/* Info palette (Competencies panel) */
--blue-50: #eff6ff;
--blue-100: #dbeafe;
--blue-400: #60a5fa;
--blue-500: #3b82f6;
--blue-600: #2563eb;
--blue-950: #172554;

/* AI palette (AI Assistance) */
--purple-50: #faf5ff;
--purple-100: #f3e8ff;
--purple-400: #c084fc;
--purple-500: #a855f7;
--purple-600: #9333ea;
--purple-700: #7e22ce;
--purple-950: #3b0764;

/* Neutral palette */
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-500: #6b7280;
--gray-900: #111827;

/* Semantic colors */
--primary: hsl(var(--primary));  /* shadcn variable */
--muted-foreground: hsl(var(--muted-foreground));
--border: hsl(var(--border));
```

### 7.4 Elevation & Shadows

```css
/* Card shadows (shadcn defaults) */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);

/* No extra elevation needed */
/* Use default card border + shadow */
```

### 7.5 Border Radius

```css
--radius-sm: 0.125rem;  /* 2px */
--radius-md: 0.375rem;  /* 6px - Default */
--radius-lg: 0.5rem;    /* 8px */
```

---

## 8. Accessibility Requirements

### 8.1 Semantic HTML

```tsx
{/* Correct heading hierarchy */}
<h1>Planificación - {materia}</h1>  {/* Page title */}
<h2>Session Overview</h2>            {/* Section headings */}
<h3>{contenidoPrincipal}</h3>        {/* Card titles */}
```

### 8.2 ARIA Labels

```tsx
{/* Competency chips */}
<div role="list" aria-label="Session competencies">
  {competencias.map(comp => (
    <Badge key={comp} role="listitem">
      {resolveCompetencyLabel(comp, materia)}
    </Badge>
  ))}
</div>

{/* AI textarea */}
<Textarea
  aria-label="Request AI modifications to lesson plan"
  aria-describedby="ai-help-text"
  // ...
/>
<p id="ai-help-text" className="sr-only">
  Describe changes you want the AI to make, such as adding examples or adjusting timing
</p>
```

### 8.3 Keyboard Navigation

- **Tab order:** Header → Backlog → Calendar → Summary → Competencies → Session Plan → AI → Tabs
- **No keyboard traps:** Ensure all interactive elements reachable
- **Focus visible:** Use `:focus-visible` ring on buttons/links

### 8.4 Color Contrast

**WCAG AA Requirements:**
- Normal text: 4.5:1
- Large text (≥18px): 3:1

**Verification:**
- Text on blue-50 background: Use `text-blue-900` for 4.5:1
- Text on purple-50 background: Use `text-purple-900`
- Badges: Use `secondary` variant (gray-100 bg + gray-900 text)

### 8.5 Screen Reader Announcements

```tsx
{/* Loading state */}
<div role="status" aria-live="polite">
  {isModificando && (
    <span className="sr-only">
      Applying AI modifications to lesson plan...
    </span>
  )}
</div>
```

---

## 9. Performance Considerations

### 9.1 Re-render Optimization

**Problem:** Calendar navigation triggers full page re-render

**Solution:**
```tsx
// Memoize calendar to prevent re-render on session selection
const MemoizedCalendar = React.memo(CalendarioDnD);

// In PlanificacionWorkspace.tsx
<MemoizedCalendar
  mesActual={mesActual}
  sesiones={sesiones}
  onCambiarMes={cambiarMes}
  // ... other props
/>
```

### 9.2 Lazy Loading

```tsx
// Long description truncation
const [isExpanded, setIsExpanded] = useState(false);

<p className={cn(
  "text-sm text-muted-foreground",
  !isExpanded && "line-clamp-3"
)}>
  {descripcion}
</p>
{descripcion.length > 200 && (
  <Button 
    variant="ghost" 
    size="sm"
    onClick={() => setIsExpanded(!isExpanded)}
  >
    {isExpanded ? 'Show less' : 'See more'}
  </Button>
)}
```

### 9.3 Skeleton Loaders

```tsx
// While loading session
{!sesion ? (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-32" />  {/* Title skeleton */}
    </CardHeader>
    <CardContent className="space-y-4">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />  {/* Chip skeleton */}
        <Skeleton className="h-6 w-20" />
      </div>
    </CardContent>
  </Card>
) : (
  <SessionSummaryCard {...sessionData} />
)}
```

---

## 10. Implementation Checklist

### 10.1 Phase 1: Layout Restructure

- [ ] Update `PlanificacionWorkspace.tsx` grid:
  - [ ] Change calendar from `col-span-4` to `col-span-9`
  - [ ] Wrap editor in new container with `col-span-12`
  - [ ] Split editor into two 6-col sections + full-width sections
- [ ] Add responsive classes:
  - [ ] Mobile: `col-span-12` for all
  - [ ] Tablet: `md:col-span-12` stack
  - [ ] Desktop: `xl:col-span-9` calendar, `lg:col-span-6` side-by-side
- [ ] Test breakpoint transitions (768px, 1280px)

### 10.2 Phase 2: Session Summary Card

- [ ] Extract session header into `SessionSummaryCard` component
- [ ] Remove debug line (line 335)
- [ ] Implement title truncation (`line-clamp-2`)
- [ ] Create meta grid (date, duration, subject, level)
- [ ] Add competency chips with label resolution
- [ ] Style with spacing/elevation per spec
- [ ] Add skeleton loader

### 10.3 Phase 3: Competency Label Resolution

- [ ] Create `src/lib/competencyLabelResolver.ts`
- [ ] Import all competency catalogs
- [ ] Implement `resolveCompetencyLabel()` function
- [ ] Add subject normalization integration
- [ ] Implement fallback behavior
- [ ] Add console warning for missing labels (once per session)

### 10.4 Phase 4: Competencies Panel Refinement

- [ ] Extract competencies card into `CompetenciesPanelCard`
- [ ] Adjust background opacity (`bg-blue-50/50`)
- [ ] Increase heading size if needed
- [ ] Add comfortable line-height to prose
- [ ] Ensure dark mode compatibility
- [ ] Add `h-fit` for height matching

### 10.5 Phase 5: Full-Width Sections

- [ ] Extract Session Plan to standalone section
  - [ ] Add section heading (text-2xl)
  - [ ] Add description
  - [ ] Move above tabs
- [ ] Extract AI Assistance to standalone section
  - [ ] Add section heading (text-2xl)
  - [ ] Adjust background opacity
  - [ ] Increase button size
  - [ ] Move above tabs
- [ ] Update tabs to only contain: Clase | Recursos | Evaluación

### 10.6 Phase 6: Testing & Polish

- [ ] Manual QA:
  - [ ] Desktop layout (1920x1080, 1440x900)
  - [ ] Tablet layout (1024x768, iPad)
  - [ ] Mobile layout (375x667, 414x896)
- [ ] Competency label resolution:
  - [ ] Test Historia competencias
  - [ ] Test Literatura competencias
  - [ ] Test Ciudadanía competencias
  - [ ] Test missing/unknown codes
- [ ] Accessibility audit:
  - [ ] axe DevTools scan
  - [ ] Keyboard navigation flow
  - [ ] Screen reader testing (VoiceOver/NVDA)
  - [ ] Color contrast verification
- [ ] Performance:
  - [ ] Verify calendar doesn't re-render on session select
  - [ ] Check for layout shifts
  - [ ] Measure paint/layout times

### 10.7 Phase 7: Documentation

- [ ] Add component JSDoc comments
- [ ] Document competency resolution logic
- [ ] Create visual changelog
- [ ] Update README with new layout
- [ ] Screenshot before/after for PR

---

## 11. QA Test Cases

### 11.1 Layout Tests

| Test Case | Input | Expected Output | Status |
|-----------|-------|----------------|--------|
| Desktop layout (≥1280px) | View workspace on 1920x1080 | Calendar 9 cols, Summary 6, Comp 6, Full-width 12 | ⏳ |
| Tablet layout (768-1279px) | Resize to 1024x768 | All sections stack (12 cols each) | ⏳ |
| Mobile layout (<768px) | View on iPhone 12 (390x844) | Single column, no horizontal scroll | ⏳ |
| Breakpoint transition | Resize from 1400 → 700px | Smooth reflow, no layout shift | ⏳ |

### 11.2 Competency Label Tests

| Test Case | Input | Expected Output | Status |
|-----------|-------|----------------|--------|
| Historia code | `["CE1"]` + materia "Historia" | Badge: "CE1 – Interpreta e interrelaciona..." | ⏳ |
| Literatura code | `["CL2"]` + materia "Literatura" | Badge: "CL2 – Construye una oralidad..." | ⏳ |
| Ciudadanía code | `["CC1"]` + materia "Ciudadanía" | Badge: "CC1 – [label]" | ⏳ |
| Unknown code | `["XYZ"]` + any materia | Badge: "XYZ" (fallback, warning logged) | ⏳ |
| Full description | `["Interpreta e..."]` | Badge: Matched code + truncated label | ⏳ |
| Mixed formats | `["CE1", "Full text", "CE2"]` | All resolved correctly | ⏳ |

### 11.3 Content Display Tests

| Test Case | Input | Expected Output | Status |
|-----------|-------|----------------|--------|
| Long title (>100 chars) | `contenidoPrincipal` = 150 chars | Truncate at 2 lines with ellipsis | ⏳ |
| No competencias | `competencias_anep = []` | Show "No competencies for this session" | ⏳ |
| Many competencias (>10) | `competencias_anep` = 12 items | Chips wrap to multiple rows, no overflow | ⏳ |
| Missing fecha | `fecha = null` | Show "Date to be confirmed" | ⏳ |
| AI loading | `isModificando = true` | Button disabled, spinner visible | ⏳ |
| Empty AI input | `instruccionesModificacion = ""` | Button disabled | ⏳ |

### 11.4 Accessibility Tests

| Test Case | Tool | Expected Output | Status |
|-----------|------|----------------|--------|
| Color contrast | axe DevTools | All text passes WCAG AA | ⏳ |
| Keyboard navigation | Manual | Tab reaches all interactive elements | ⏳ |
| Screen reader | VoiceOver | Headings announced correctly | ⏳ |
| Focus visible | Manual | Focus ring visible on all elements | ⏳ |
| ARIA labels | axe DevTools | No missing labels on form controls | ⏳ |

### 11.5 Performance Tests

| Test Case | Metric | Target | Status |
|-----------|--------|--------|--------|
| Calendar navigation | Re-renders | Calendar doesn't re-render on session select | ⏳ |
| Session load | Time to interactive | <500ms to display summary card | ⏳ |
| Large competency list | Render time | <100ms for 20 chips | ⏳ |
| Layout shift (CLS) | DevTools | <0.1 cumulative layout shift | ⏳ |

### 11.6 Cross-Browser Tests

| Browser | Version | Desktop | Tablet | Mobile | Status |
|---------|---------|---------|--------|--------|--------|
| Chrome | Latest | ⏳ | ⏳ | ⏳ | ⏳ |
| Safari | Latest | ⏳ | ⏳ | ⏳ | ⏳ |
| Firefox | Latest | ⏳ | ⏳ | N/A | ⏳ |
| Edge | Latest | ⏳ | N/A | N/A | ⏳ |

---

## 12. Risks & Mitigations

### 12.1 Risk: Crowding at Smaller Widths

**Impact:** High — Could make Summary/Competencies panels unreadable on small laptops

**Mitigation:**
- Test at 1280px (MacBook 13") extensively
- Ensure truncation (`line-clamp`) works correctly
- Add horizontal scrolling to chip container if needed: `overflow-x-auto`
- Consider collapsing Competencies panel on smaller desktops (<1400px)

### 12.2 Risk: Competency Label Lookup Fails

**Impact:** Medium — Users see codes instead of readable labels

**Mitigation:**
- Graceful fallback: display code as-is
- Log warning once (console.warn)
- Non-blocking: UI remains functional
- Monitor logs in production to identify missing mappings

### 12.3 Risk: Calendar Height Increases

**Impact:** Low — Expanding to 9 cols may increase height, causing page jump

**Mitigation:**
```tsx
<div className="max-h-[600px] overflow-y-auto">
  <CalendarioDnD />
</div>
```
- Cap calendar container height
- Add internal scroll if needed
- Test with months that have 6 rows (35 days visible)

### 12.4 Risk: Layout Shifts on Load

**Impact:** Medium — CLS (Cumulative Layout Shift) hurts UX and SEO

**Mitigation:**
- Use skeleton loaders with correct dimensions
- Set min-height on card containers
- Preload competency labels in initial query
- Use `aspect-ratio` for image placeholders (if applicable)

### 12.5 Risk: RTL Languages

**Impact:** Low — Out of scope, but mentioned in reqs

**Mitigation:**
- Not required for initial implementation
- Tailwind RTL support available if needed later
- Use logical properties (`start`/`end` instead of `left`/`right`)

---

## 13. File Change Summary

### Files to Modify

1. **`src/pages/PlanificacionWorkspace.tsx`** (258-282)
   - Change calendar col-span: `4` → `9`
   - Wrap editor in nested grid
   - Add responsive classes

2. **`src/components/planificacion/EditorSesionNuevo.tsx`** (303-520)
   - Extract Session Summary Card
   - Extract Competencies Panel
   - Extract Session Plan section (full-width)
   - Extract AI Assistance section (full-width)
   - Remove debug line (335)
   - Restructure tabs

### Files to Create

3. **`src/lib/competencyLabelResolver.ts`** (NEW)
   - `resolveCompetencyLabel()` function
   - Catalog imports
   - Fallback logic

4. **`src/components/planificacion/SessionSummaryCard.tsx`** (NEW - Optional)
   - Extracted component for reusability
   - Props interface
   - Skeleton loader

5. **`src/components/planificacion/CompetenciesPanelCard.tsx`** (NEW - Optional)
   - Extracted component
   - Props interface

### Files to Reference (No Changes)

- `src/data/competencias.ts` — Historia catalog
- `src/data/competenciasLiteratura.ts` — Literatura catalog
- `src/data/competenciasCiudadania.ts` — Ciudadanía catalog
- `src/lib/subjectNormalizer.ts` — Subject normalization (existing)

---

## 14. Next Steps

1. **Review & Approval** — Share this spec with team for feedback
2. **Create Feature Branch** — `feature/planning-grid-redesign`
3. **Phase 1 Implementation** — Layout grid restructure (2-3 hours)
4. **Phase 2 Implementation** — Session Summary Card (2-3 hours)
5. **Phase 3 Implementation** — Competency label resolution (1-2 hours)
6. **Phase 4-5 Implementation** — Remaining sections (2-3 hours)
7. **QA & Testing** — Manual + automated tests (3-4 hours)
8. **PR & Review** — Submit with screenshots and spec
9. **Merge & Deploy** — After approval

**Total Estimated Time:** 12-18 hours

---

## Appendix A: Before/After Mockups

### Current Layout (Desktop)

```
┌─────────────────────────────────────────────────────┐
│                     Header                          │
├──────┬─────────────┬──────────────────────────────┬─┤
│      │             │                              │ │
│ Back │  Calendar   │     Editor de Sesión         │ │
│ log  │   (4 cols)  │        (5 cols)              │ │
│ (3)  │             │                              │ │
│      │             │  - Header                    │ │
│      │             │  - Competencies Card         │ │
│      │             │  - Tabs (Clase/Rec/Eval)     │ │
└──────┴─────────────┴──────────────────────────────┴─┘
```

### Proposed Layout (Desktop)

```
┌──────────────────────────────────────────────────────────────┐
│                          Header                              │
├──────┬──────────────────────────────┬──────────┬─────────────┤
│      │                              │ Summary  │ Compet.     │
│ Back │       Calendar               │  Card    │  Panel      │
│ log  │        (9 cols)              │ (6 cols) │ (6 cols)    │
│ (3)  │                              │          │             │
└──────┴──────────────────────────────┴──────────┴─────────────┘
┌──────────────────────────────────────────────────────────────┐
│                   Session Plan (12 cols)                     │
├──────────────────────────────────────────────────────────────┤
│                  AI Assistance (12 cols)                     │
├──────────────────────────────────────────────────────────────┤
│              Tabs: Clase | Recursos | Evaluación            │
└──────────────────────────────────────────────────────────────┘
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-28  
**Author:** GitHub Copilot  
**Status:** ✅ Ready for Implementation
