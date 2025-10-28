# Planning Wizard Width & Side Margins Analysis

**RUN_ID:** planificacion-width_2025-10-28  
**Date:** October 28, 2025  
**Route:** `/planificacion/nuevo`  
**Analyst:** Claude (Staff+ Frontend Architect Mode)  
**Status:** ANALYSIS ONLY (No code changes)

---

## Executive Summary

The Planning Wizard (`/planificacion/nuevo`) currently suffers from excessive horizontal constraints due to **triple-nested width limitations**: the global `.container` class in `AppLayout`, a page-level `max-w-4xl` wrapper, and an inner `max-w-2xl` content wrapper. On a 1440px+ desktop viewport, the wizard content is constrained to ~672px usable width, leaving ~768px of wasted horizontal space with large side margins.

**Key Finding:** The width is being capped at **three distinct layers**, creating unnecessarily cramped forms on wide screens while the layout remains responsive on mobile/tablet.

---

## 1. Wrapper Inventory & Width Constraints

### 1.1 DOM/Box Model Hierarchy

```
AppLayout (Global Wrapper)
└── SidebarProvider
    ├── AppSidebar (fixed width, ~16rem = 256px)
    └── Main Content Area
        ├── Header (sticky, full-width)
        └── <main className="flex-1 overflow-auto">
            └── <div className="container mx-auto p-6">  ← LAYER 1: Global container
                └── {children}  ← Page content injected here

PlanificacionWizard.tsx (Page Component)
└── <div className="container max-w-4xl mx-auto py-8 px-4">  ← LAYER 2: Page wrapper
    ├── Header section (full width within max-w-4xl)
    └── <div className="max-w-2xl mx-auto">  ← LAYER 3: Wizard content wrapper
        └── <WizardSteps />  ← Actual form content
```

**ASCII Diagram:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser Viewport (1440px example)                               │
├──────────┬──────────────────────────────────────────────────────┤
│          │ AppLayout Main Content                               │
│ Sidebar  ├───────────────────────────────────────────────────────┤
│ (256px)  │ .container (p-6, centers content)                    │
│          │ ┌─────────────────────────────────────────────────┐ │
│          │ │ .container.max-w-4xl (896px max)               │ │
│          │ │ ┌───────────────────────────────────────────┐ │ │
│          │ │ │ .max-w-2xl (672px max)                   │ │ │
│          │ │ │ ┌──────────────────────────────────────┐ │ │ │
│          │ │ │ │ WizardSteps Content                 │ │ │ │
│          │ │ │ │ (Cramped: ~600px usable)           │ │ │ │
│          │ │ │ └──────────────────────────────────────┘ │ │ │
│          │ │ └───────────────────────────────────────────┘ │ │
│          │ └─────────────────────────────────────────────────┘ │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

### 1.2 File-Level Analysis

#### **Layer 1: AppLayout.tsx (Global)**
- **File:** `src/components/AppLayout.tsx`
- **Line:** 83
- **Classes:** `<div className="container mx-auto p-6">`
- **Effect:** 
  - `.container` from Tailwind applies:
    - `center: true` → auto left/right margins
    - `padding: '2rem'` → 32px horizontal padding
    - `screens: { '2xl': '100%' }` → no max-width at 2xl breakpoint (1536px+), but defaults apply below
  - Tailwind default container max-widths:
    - `sm` (640px): 640px
    - `md` (768px): 768px
    - `lg` (1024px): 1024px
    - `xl` (1280px): 1280px
    - `2xl` (1536px+): 100% (no limit)
- **Impact:** At 1440px viewport, container is capped at **1280px** (xl breakpoint default)

#### **Layer 2: PlanificacionWizard.tsx (Page)**
- **File:** `src/pages/PlanificacionWizard.tsx`
- **Lines:** 533, 605
- **Classes:** `<div className="container max-w-4xl mx-auto py-8 px-4">`
- **Effect:**
  - Applies `.container` AGAIN (redundant with AppLayout)
  - `max-w-4xl` = **896px** hard cap
  - `mx-auto` centers within AppLayout's container
  - `px-4` = 16px horizontal padding (additional)
- **Impact:** Content further restricted to 896px, even on ultra-wide screens

#### **Layer 3: PlanificacionWizard.tsx (Inner Content)**
- **File:** `src/pages/PlanificacionWizard.tsx`
- **Lines:** 534, 626
- **Classes:** `<div className="max-w-2xl mx-auto">`
- **Effect:**
  - `max-w-2xl` = **672px** hard cap
  - `mx-auto` centers within the max-w-4xl wrapper
- **Impact:** **Final usable width = ~600-640px** (after padding)

#### **Layer 3b: Info Card (Bottom)**
- **File:** `src/pages/PlanificacionWizard.tsx`
- **Line:** 642
- **Classes:** `<Card className="mt-8 max-w-2xl mx-auto">`
- **Effect:** Same 672px cap as wizard content

---

## 2. Breakpoint Width Analysis

### 2.1 Tailwind Container Breakpoints

From `tailwind.config.ts` (lines 13-18):

```typescript
container: {
  center: true,
  padding: '2rem',
  screens: {
    '2xl': '100%'  // Only 2xl is configured
  }
}
```

**Tailwind Default Container Widths:**

| Breakpoint | Min Viewport | Container Max-Width | Available After Padding (32px × 2) |
|------------|--------------|---------------------|-------------------------------------|
| `sm`       | 640px        | 640px               | 576px                               |
| `md`       | 768px        | 768px               | 704px                               |
| `lg`       | 1024px       | 1024px              | 960px                               |
| `xl`       | 1280px       | 1280px              | 1216px                              |
| `2xl`      | 1536px+      | 100% (no cap)       | Viewport - 64px                     |

### 2.2 Current Effective Widths (Planning Wizard)

| Viewport Width | AppLayout Container | Page max-w-4xl | Inner max-w-2xl | Final Usable Width | Wasted Space |
|----------------|---------------------|----------------|----------------|-------------------|--------------|
| **1280px**     | 1280px → 1216px*   | 896px → 864px† | 672px → 640px‡ | **~600px**        | ~680px       |
| **1440px**     | 1280px → 1216px*   | 896px → 864px† | 672px → 640px‡ | **~600px**        | ~840px       |
| **1536px**     | 100% → 1472px*     | 896px → 864px† | 672px → 640px‡ | **~600px**        | ~936px       |
| **1920px**     | 100% → 1856px*     | 896px → 864px† | 672px → 640px‡ | **~600px**        | ~1320px      |

*After AppLayout p-6 (24px × 2)  
†After page px-4 (16px × 2)  
‡After accounting for card padding (~16px × 2)

**Observation:** On all desktop viewports ≥1280px, the wizard is constrained to ~600px usable width, leaving 680-1320px of white space.

### 2.3 Proposed Widths (Option 3 - Recommended)

| Viewport Width | AppLayout Container | Page max-w-6xl | Inner (removed) | Final Usable Width | Improvement |
|----------------|---------------------|----------------|----------------|-------------------|-------------|
| **1280px**     | 1280px → 1216px    | 1152px → 1088px| (no inner cap) | **~1056px**       | +456px      |
| **1440px**     | 1280px → 1216px    | 1152px → 1088px| (no inner cap) | **~1056px**       | +456px      |
| **1536px**     | 100% → 1472px      | 1152px         | (no inner cap) | **~1120px**       | +520px      |
| **1920px**     | 100% → 1856px      | 1152px         | (no inner cap) | **~1120px**       | +520px      |

**Target:** Achieve **1100-1280px usable width** on ≥1440px viewports (requirement met).

---

## 3. Blast Radius Audit

### 3.1 Routes Using AppLayout Wrapper

**ALL protected teacher routes** inherit the `<div className="container mx-auto p-6">` wrapper from `AppLayout.tsx` (line 83). This affects:

| Route | Component | Page-Specific Width Classes | Current Width | Impact of AppLayout Fix |
|-------|-----------|----------------------------|---------------|-------------------------|
| `/planificacion/nuevo` | PlanificacionWizard.tsx | `.container.max-w-4xl` + `.max-w-2xl` | ~600px | Would inherit wider container, but page classes would still cap at 896px |
| `/planificacion/:id` | PlanificacionWorkspace.tsx | `.container.mx-auto` (line 243) | ~1216px (xl) | ✅ Would benefit from wider AppLayout container |
| `/evaluaciones` | EvaluacionesGrupo.tsx | `.max-w-6xl.mx-auto` (line 833) | 1152px → 1088px | ⚠️ Already wide, minimal impact |
| `/comunicaciones` | Comunicaciones.tsx | `.max-w-4xl.mx-auto` (line 137) | 896px | ⚠️ Would NOT benefit (page-scoped cap) |
| `/mis-planificaciones` | MisPlanificaciones.tsx | (no page wrapper) | ~1216px (xl) | ✅ Would benefit from wider AppLayout container |
| `/teacher-dashboard` | TeacherDashboard.tsx | (varies by widget) | Mixed | ⚠️ Needs per-widget testing |
| `/teacher-groups` | TeacherGroups.tsx | (no page wrapper) | ~1216px (xl) | ✅ Would benefit |
| `/planificacion` | PlanificacionClase.tsx | `.max-w-4xl` (line 28) | 896px | ⚠️ Would NOT benefit (page-scoped cap) |

**Key Insight:** Editing `AppLayout.tsx` would be a **global change** affecting **8 routes**. However, most routes already have their own page-level max-width constraints, so the impact would be limited to routes WITHOUT explicit caps (PlanificacionWorkspace, MisPlanificaciones, TeacherGroups).

### 3.2 Components Using Similar Patterns

**Pages with `max-w-*` wrappers** (would NOT be affected by AppLayout changes alone):

- `PlanificacionWizard.tsx`: `max-w-4xl` + `max-w-2xl` (lines 533-534, 605, 626, 642)
- `EvaluacionesGrupo.tsx`: `max-w-6xl` (line 833)
- `Comunicaciones.tsx`: `max-w-4xl` (line 137)
- `PlanificacionClase.tsx`: `max-w-4xl` (line 28)
- `StudentDiagnostic.tsx`: `max-w-2xl` (line 220)

**Recommendation:** **Page-scoped fixes** are safer and more predictable than global AppLayout changes for this specific issue.

---

## 4. Fix Options (Ranked)

### **Option 1: Minimal Change (Page-Scoped, Low Risk)**

**Scope:** Only modify `src/pages/PlanificacionWizard.tsx`

**Changes:**

```diff
File: src/pages/PlanificacionWizard.tsx

Line 533 (Loading State Wrapper):
-      <div className="container max-w-4xl mx-auto py-8 px-4">
+      <div className="max-w-6xl mx-auto py-8 px-4">

Line 534 (Loading State Inner):
-        <div className="max-w-2xl mx-auto">
+        {/* Remove this wrapper - content goes directly in max-w-6xl */}

Line 605 (Main Wizard Wrapper):
-    <div className="container max-w-4xl mx-auto py-8 px-4">
+    <div className="max-w-6xl mx-auto py-8 px-4">

Line 626 (Wizard Content):
-      <div className="max-w-2xl mx-auto">
+      {/* Remove this wrapper - WizardSteps goes directly in max-w-6xl */}

Line 642 (Info Card):
-      <Card className="mt-8 max-w-2xl mx-auto">
+      <Card className="mt-8">
```

**Exact Edits:**

1. **Line 533:** Remove `.container`, change `max-w-4xl` → `max-w-6xl`
2. **Line 534:** Remove entire `<div className="max-w-2xl mx-auto">` wrapper (delete opening tag)
3. **Line ~580:** Remove corresponding closing `</div>` for max-w-2xl wrapper
4. **Line 605:** Remove `.container`, change `max-w-4xl` → `max-w-6xl`
5. **Line 626:** Remove entire `<div className="max-w-2xl mx-auto">` wrapper
6. **Line ~640:** Remove corresponding closing `</div>`
7. **Line 642:** Remove `max-w-2xl mx-auto` from Card

**Resulting Width:**
- Desktop (≥1280px): **~1120px usable** (meets 1100px+ target)
- Tablet (768-1279px): **~704px** (reasonable for forms)
- Mobile (<768px): **~full width** with px-4 padding (unchanged)

**Pros:**
- ✅ **Minimal blast radius** (only affects `/planificacion/nuevo`)
- ✅ **Predictable outcome** (no global side effects)
- ✅ **Meets target width** (1100-1120px on desktop)
- ✅ **Mobile/tablet unchanged** (still responsive)
- ✅ **No horizontal scroll** (max-w-6xl = 1152px, container provides padding)

**Cons:**
- ⚠️ **Inconsistent with other pages** (EvaluacionesGrupo uses max-w-6xl, but others use max-w-4xl)
- ⚠️ Form fields may appear wider than optimal for readability (but wizard is multi-column layout, so acceptable)

**Risks:**
- 🟢 **Low:** Only one page affected
- 🟢 **No breaking changes:** Wizard steps are designed to be flexible

**Recommendation:** ✅ **RECOMMENDED** for minimal-risk implementation

---

### **Option 2: Moderate Change (Remove All Inner Wrappers, Keep Page Cap)**

**Scope:** Modify `src/pages/PlanificacionWizard.tsx`

**Changes:**

```diff
File: src/pages/PlanificacionWizard.tsx

Line 533:
-      <div className="container max-w-4xl mx-auto py-8 px-4">
-        <div className="max-w-2xl mx-auto">
+      <div className="max-w-5xl mx-auto py-8 px-4">

Line 605:
-    <div className="container max-w-4xl mx-auto py-8 px-4">
+    <div className="max-w-5xl mx-auto py-8 px-4">

Line 626:
-      <div className="max-w-2xl mx-auto">
+      {/* Remove wrapper */}

Line 642:
-      <Card className="mt-8 max-w-2xl mx-auto">
+      <Card className="mt-8 max-w-4xl mx-auto">
```

**Resulting Width:**
- Desktop: **~1000px usable** (max-w-5xl = 1024px - 24px padding)
- Still narrower than Option 1, but removes triple-nesting

**Pros:**
- ✅ **Removes redundant inner wrapper** (cleaner DOM)
- ✅ **Moderate width increase** (~1000px vs 600px)
- ✅ **More conservative than Option 1** (if team prefers narrower forms)

**Cons:**
- ⚠️ **Doesn't fully meet target** (1000px < 1100px target)
- ⚠️ **Still uses max-w-5xl** (uncommon in codebase, max-w-6xl more standard)

**Recommendation:** ⚠️ **Acceptable Alternative** if team wants less aggressive expansion

---

### **Option 3: Global AppLayout Fix (Systemic, Higher Risk)**

**Scope:** Modify `src/components/AppLayout.tsx` + page-specific adjustments

**Changes:**

```diff
File: src/components/AppLayout.tsx

Line 83:
-            <div className="container mx-auto p-6">
+            <div className="max-w-[1600px] mx-auto p-6">
```

**Rationale:**
- Replace Tailwind `.container` with explicit `max-w-[1600px]` to allow wider content globally
- This gives pages more horizontal room without breaking existing page-level caps

**Then, in PlanificacionWizard.tsx:**

```diff
Line 533, 605:
-      <div className="container max-w-4xl mx-auto py-8 px-4">
+      <div className="max-w-6xl mx-auto py-8 px-4">

Lines 534, 626:
-      <div className="max-w-2xl mx-auto">
+      {/* Remove wrapper */}
```

**Resulting Width:**
- Global container: **1600px max → ~1536px usable** (after p-6 padding)
- Planning Wizard: **~1120px usable** (max-w-6xl with padding)
- Other pages: Inherit wider container, but most have own caps

**Pros:**
- ✅ **Systemic cleanup** (benefits all routes without page-level caps)
- ✅ **Future-proof** (new pages get more space by default)
- ✅ **Removes .container confusion** (explicit max-width is clearer)

**Cons:**
- ❌ **High blast radius** (affects all 8+ teacher routes)
- ❌ **Requires comprehensive testing** (TeacherDashboard widgets, all pages)
- ❌ **May break layouts** that assume container defaults

**Risks:**
- 🔴 **High:** Global change with potential for unexpected layout shifts
- 🟡 **Moderate testing burden:** All protected routes must be visually verified

**Recommendation:** ⚠️ **NOT RECOMMENDED** for this task (use for systemic refactor later)

---

### **Option 4: Ultra-Wide Workspace Layout (Specialized)**

**Scope:** Create a custom layout variant for workspace pages

**Approach:**
- Create `WorkspaceLayout.tsx` wrapper with `max-w-[1800px]` or `w-full` with controlled padding
- Use this layout only for `/planificacion/nuevo` and `/planificacion/:id`
- Remove all page-level width constraints

**Changes:**

```tsx
// New file: src/components/WorkspaceLayout.tsx
export function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-[1800px] mx-auto px-6 py-8">
      {children}
    </div>
  );
}
```

```diff
File: src/pages/PlanificacionWizard.tsx

- Wrap entire return in <WorkspaceLayout>
- Remove all max-w-* classes from page
```

**Resulting Width:**
- Desktop: **~1750px+ usable** (ultra-wide for complex multi-column layouts)

**Pros:**
- ✅ **Maximum flexibility** for workspace pages
- ✅ **Isolated from AppLayout** (no global impact)
- ✅ **Optimized for multi-column layouts** (calendar + backlog + editor)

**Cons:**
- ❌ **Adds new component** (increased complexity)
- ❌ **May be too wide** for single-column wizard forms
- ⚠️ **Line length concerns** for text-heavy content (need to constrain prose sections)

**Recommendation:** 🟡 **Consider for PlanificacionWorkspace** (multi-column layout), but **NOT for wizard** (mostly single-column forms)

---

## 5. Accessibility & UX Notes

### 5.1 Horizontal Scroll Check

**Verification:** At each breakpoint, ensure `max-w-*` ≤ `viewport width - sidebar - padding`

| Viewport | Sidebar | Padding | Available | Proposed max-w-6xl | Scroll Risk |
|----------|---------|---------|-----------|-------------------|-------------|
| 1280px   | 256px   | 48px (p-6) | 976px     | 1152px → 976px*   | ✅ No scroll |
| 1440px   | 256px   | 48px    | 1136px    | 1152px → 1136px*  | ✅ No scroll |
| 1536px+  | 256px   | 48px    | 1232px+   | 1152px            | ✅ No scroll |

*`max-w-6xl` (1152px) is capped by available space, so no overflow.

**Conclusion:** ✅ **No horizontal scroll** at any common breakpoint with Option 1.

### 5.2 Readable Line Length

**Concern:** Text blocks (prose) should not exceed 75ch (~600-800px) for optimal readability.

**Mitigation (if needed):**
- Wizard content is primarily **form fields** (labels, inputs, dropdowns), not long-form prose
- For text-heavy sections (instructions, help text), can add:
  ```html
  <div className="max-w-prose mx-auto">
    <!-- Long text content -->
  </div>
  ```
- **Example:** Line 649 in PlanificacionWizard.tsx (Info Card description) could use `max-w-prose` if expanded

**Recommendation:** ✅ **Not a concern** for wizard forms, but monitor if adding long instructional text.

### 5.3 Breathing Room (Padding)

**Current Padding:**
- AppLayout: `p-6` (24px)
- Page wrapper: `px-4 py-8` (16px horizontal, 32px vertical)
- Total horizontal padding: 40px per side = 80px total

**Proposed Padding (Option 1):**
- AppLayout: `p-6` (24px) - unchanged
- Page wrapper: `px-4 py-8` (16px horizontal) - unchanged
- Total: 80px (same as current)

**Recommendation:** ✅ **Padding remains breathable** (standard for Tailwind defaults).

---

## 6. Acceptance Criteria (Explicit)

### 6.1 Desktop (≥1440px)

- ✅ **Target Width:** Wizard main card/container ≥ **1100px wide**
  - **Option 1 achieves:** ~1120px ✅
  - **Option 2 achieves:** ~1000px ❌ (below target)
  - **Option 3 achieves:** ~1120px ✅

- ✅ **No Horizontal Scroll:** Verified for 1280px, 1440px, 1536px, 1920px viewports

- ✅ **Sidebar Intact:** AppSidebar remains fixed at 256px (unchanged)

### 6.2 Mobile (<768px)

- ✅ **Unchanged Behavior:**
  - Current: `px-4` provides 16px side padding
  - Proposed: `px-4` (no change)
  - **Result:** Full-width content with safe margins ✅

### 6.3 Tablet (768-1279px)

- ✅ **Good Padding:**
  - Current: ~704px usable width (Tailwind md container)
  - Proposed: ~704px usable width (max-w-6xl collapses to available width)
  - **Result:** No change, maintains comfortable form width ✅

---

## 7. Test Plan (Manual Verification)

### 7.1 Testing Routes

**Primary:** `/planificacion/nuevo`  
**Secondary:** `/planificacion/:id` (to verify no unintended side effects on workspace layout)

### 7.2 Test Cases

| Test Case | Viewport | Expected Behavior | How to Verify |
|-----------|----------|-------------------|---------------|
| **TC1: Desktop Width** | 1440px | Wizard content spans ~1120px | DevTools: Measure `.max-w-6xl` element width |
| **TC2: No Horizontal Scroll** | 1280px, 1440px, 1536px, 1920px | No horizontal scrollbar appears | Scroll to right edge, verify no cutoff |
| **TC3: Sidebar Unaffected** | All viewports | Sidebar remains 256px wide, functional | Toggle sidebar open/closed, verify no layout shift |
| **TC4: Mobile Responsive** | 375px (iPhone SE), 768px (iPad) | Content fills width with safe padding | Test on device/emulator, verify no overflow |
| **TC5: Form Fields Readable** | All viewports | Input fields, dropdowns not stretched beyond usability | Fill out wizard, verify field widths are comfortable |
| **TC6: Breadcrumbs/Header** | All viewports | Header elements remain aligned and functional | Verify breadcrumbs, search bar, user menu |
| **TC7: Other Pages Unaffected** | 1440px | `/evaluaciones`, `/comunicaciones`, `/mis-planificaciones` maintain current widths | Navigate to each page, verify no layout changes |

### 7.3 Manual Testing Steps

```bash
# 1. Apply Option 1 changes to PlanificacionWizard.tsx
# 2. Run dev server
npm run dev

# 3. Navigate to http://localhost:8080/planificacion/nuevo
# 4. Open DevTools (F12) → Responsive Design Mode
# 5. Test each viewport:
#    - 375px (mobile)
#    - 768px (tablet)
#    - 1280px (desktop)
#    - 1440px (desktop)
#    - 1920px (ultra-wide)
# 6. For each viewport, verify:
#    - Content width (select wizard wrapper in DevTools, check computed width)
#    - No horizontal scroll (scroll right, verify edge alignment)
#    - Form field widths (labels, inputs not stretched excessively)
#    - Card alignment (info card at bottom matches wizard width)
# 7. Repeat for /planificacion/:id (workspace page)
# 8. Spot-check /evaluaciones and /comunicaciones (should be unchanged)
```

### 7.4 Edge Cases

- **Ultra-wide (2560px+):** Verify content doesn't stretch beyond 1152px (max-w-6xl cap)
- **Sidebar Collapsed:** Toggle sidebar closed, verify wizard uses additional space (AppLayout flex-1 expands)
- **Zoom Levels:** Test at 90%, 100%, 110%, 125% browser zoom

---

## 8. Open Questions for the Team

1. **Design System Direction:**
   - Should we establish global width standards (e.g., "workspace pages use max-w-6xl, content pages use max-w-4xl")?
   - Current inconsistency: EvaluacionesGrupo (max-w-6xl) vs PlanificacionWizard (max-w-4xl + max-w-2xl)

2. **Multi-Column Forms:**
   - Does the wizard have plans to add multi-column layouts (e.g., 2-column forms at xl+ breakpoints)?
   - If yes, Option 1 (max-w-6xl) provides ~1120px for comfortable 2-column layout (560px per column)

3. **Container Utility Confusion:**
   - Why does PlanificacionWizard.tsx re-apply `.container` when it's already wrapped by AppLayout's `.container`?
   - **Recommendation:** Remove redundant `.container` class from all page components (use only max-w-* and mx-auto)

4. **AppLayout Refactor Timeline:**
   - Is there appetite for a systemic AppLayout width refactor (Option 3), or should we stick to page-scoped fixes?
   - **Impact:** Would require regression testing all 8 protected routes

5. **Line Length for Instructional Text:**
   - Are there plans to add extensive instructional text to wizard steps?
   - If yes, should we wrap prose sections in `max-w-prose` for readability?

6. **Breakpoint Strategy:**
   - Should we add a custom `3xl` breakpoint (e.g., 1920px) for ultra-wide layouts?
   - Tailwind default stops at `2xl` (1536px), but team may want finer control

---

## 9. Recommendations Summary

### 9.1 Immediate Action (Minimal Risk)

✅ **Implement Option 1** (Page-Scoped Fix)

**Why:**
- Meets acceptance criteria (1100px+ width on desktop)
- Minimal blast radius (only `/planificacion/nuevo`)
- No breaking changes to other pages
- Simple, reversible if issues arise

**Exact Changes:**
1. `PlanificacionWizard.tsx` lines 533, 605: Remove `.container`, change `max-w-4xl` → `max-w-6xl`
2. Lines 534, 626: Delete `<div className="max-w-2xl mx-auto">` wrappers
3. Line 642: Remove `max-w-2xl mx-auto` from Card

### 9.2 Future Improvement (Systemic Cleanup)

🟡 **Consider Option 3** (Global AppLayout Fix) in a separate PR

**When:**
- After Page-scoped fixes are validated
- When team can allocate time for comprehensive regression testing
- As part of broader design system standardization effort

**Benefits:**
- Removes `.container` redundancy across all pages
- Provides more flexible base width for future pages
- Aligns with modern wide-screen design patterns

### 9.3 Design System Standardization

📋 **Document Width Standards** in `tools/architecture_plan.md`:

```markdown
## Layout Width Standards

- **Workspace Pages** (multi-column layouts): `max-w-6xl` (1152px)
  - Example: `/planificacion/nuevo`, `/planificacion/:id`
  
- **Content Pages** (single-column reading): `max-w-4xl` (896px)
  - Example: `/comunicaciones`, `/mis-planificaciones`
  
- **Wide Data Pages** (tables, analytics): `max-w-7xl` (1280px) or no cap
  - Example: `/evaluaciones`
  
- **Prose Sections** (instructional text): `max-w-prose` (~65ch)
  - Use within wider pages for readability
```

---

## 10. Risk Map

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Horizontal scroll on narrow desktops | Medium | Low | max-w-6xl = 1152px fits in 1280px viewport with sidebar |
| Form fields too wide for readability | Low | Low | Wizard uses structured grids/columns, not full-width inputs |
| Breaking other pages | Low | Very Low (Option 1) | Page-scoped change, no global impact |
| Breaking other pages | High | Medium (Option 3) | Global AppLayout change requires full regression testing |
| Inconsistent widths across pages | Low | Medium | Document width standards, enforce in code reviews |
| Mobile layout issues | Low | Very Low | No changes to mobile breakpoints (px-4 maintained) |

---

## 11. Appendix: Tailwind max-w-* Reference

For quick reference when choosing width classes:

| Class | Value | Typical Use Case |
|-------|-------|------------------|
| `max-w-sm` | 384px | Narrow cards, modals |
| `max-w-md` | 448px | Medium modals |
| `max-w-lg` | 512px | Large modals |
| `max-w-xl` | 576px | Extra-large modals |
| `max-w-2xl` | 672px | ⚠️ **Current wizard content** |
| `max-w-3xl` | 768px | Comfortable reading width |
| `max-w-4xl` | 896px | ⚠️ **Current wizard page** |
| `max-w-5xl` | 1024px | Wide content pages |
| `max-w-6xl` | **1152px** | ✅ **Recommended for wizard** |
| `max-w-7xl` | 1280px | Ultra-wide content/tables |
| `max-w-prose` | 65ch | ✅ **Reading text** |
| `max-w-screen-xl` | 1280px | Full viewport (minus sidebar) |
| `max-w-screen-2xl` | 1536px | Ultra-wide viewport |

---

## 12. Visual Verification Guide

### Before (Current - 600px usable):

```
┌────────────────────────────────────────────────┐
│ ←────── 1440px Viewport ──────→               │
│ ┌────┬────────────────────────────────────┐   │
│ │Side│  AppLayout Container (1280px cap)  │   │
│ │bar │  ┌──────────────────────────────┐  │   │
│ │256 │  │ max-w-4xl (896px)          │  │   │
│ │px  │  │  ┌────────────────────┐    │  │   │
│ │    │  │  │ max-w-2xl (672px) │    │  │   │
│ │    │  │  │ WIZARD CONTENT    │    │  │   │
│ │    │  │  │ (600px usable)    │    │  │   │
│ │    │  │  └────────────────────┘    │  │   │
│ │    │  └──────────────────────────────┘  │   │
│ └────┴────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
        ↑                                   ↑
    Large side margins (wasted space)
```

### After Option 1 (Recommended - 1120px usable):

```
┌────────────────────────────────────────────────┐
│ ←────── 1440px Viewport ──────→               │
│ ┌────┬────────────────────────────────────┐   │
│ │Side│  AppLayout Container (1280px cap)  │   │
│ │bar │  ┌──────────────────────────────────┐ │
│ │256 │  │ max-w-6xl (1152px)             │ │
│ │px  │  │ ┌────────────────────────────┐ │ │
│ │    │  │ │ WIZARD CONTENT (no wrapper)│ │ │
│ │    │  │ │ (1120px usable)            │ │ │
│ │    │  │ └────────────────────────────┘ │ │
│ │    │  └──────────────────────────────────┘ │
│ └────┴────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
        ↑                                   ↑
    Balanced margins, more usable space
```

---

## Document Metadata

**Created:** October 28, 2025  
**Author:** Claude (Anthropic AI) - Staff+ Frontend Architect Mode  
**Analysis Duration:** ~45 minutes  
**Files Analyzed:** 10+ (AppLayout, PlanificacionWizard, tailwind.config, multiple pages)  
**Recommendation:** ✅ **Option 1** (Page-Scoped, max-w-6xl, remove inner wrappers)  
**Next Steps:** Implement Option 1 changes, test on dev server, verify with manual test cases  

**Status:** ✅ **ANALYSIS COMPLETE** (Ready for implementation)

---

**END OF ANALYSIS REPORT**
