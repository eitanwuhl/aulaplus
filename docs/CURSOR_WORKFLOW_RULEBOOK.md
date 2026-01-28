# Cursor Workflow & Engineering Rulebook (As-Is)

> **Purpose**: Document the current "Cursor workflow / engineering rulebook" that this repository follows today, without changing it.  
> **Last Updated**: January 26, 2026  
> **Status**: Active Documentation

---

## 1. Governing Documents and Precedence

### Binding Contracts (Must Read First)

The following documents are **binding contracts** that must be read before making any code changes:

1. **`docs/ARCHITECTURE_SSoT.md`** (Primary Source of Truth)
   - **Purpose**: Compact, operational architecture reference for Cursor context
   - **Status**: Active, Last Updated January 26, 2026
   - **Content**: System description, contracts, guardrails, "where to change things" guide
   - **Authority**: Definitive guide for all code changes

2. **`.cursor/rules/ARCHITECTURE_SSoT.md`** (Cursor Rules - Detailed)
   - **Purpose**: Detailed Cursor rule file enforcing SSoT as primary contract
   - **Status**: Active
   - **Content**: Mandatory checks, guardrails enforcement, impact analysis requirements, common change patterns, error prevention checklist
   - **Authority**: Enforced by Cursor (modern format)

3. **`.cursorrules`** (Cursor Rules - Legacy)
   - **Purpose**: Legacy Cursor rules file for compatibility
   - **Status**: Active (compatibility layer)
   - **Content**: Compact version referencing SSoT and key guardrails
   - **Authority**: Enforced by Cursor (legacy format)

4. **`AGENTS.md`** (Quick Reference)
   - **Purpose**: Quick operational reference for AI agents and developers
   - **Status**: Active
   - **Content**: Primary architecture reference pointer, commands, high-risk invariants, key file references
   - **Authority**: Reference guide (not authoritative, points to SSoT)

5. **`docs/changes/2026-01-26_finalize_group_context_provider.md`** (Example Change Report)
   - **Purpose**: Example of proper change documentation format
   - **Status**: Historical reference
   - **Content**: Complete change report with impact analysis, files created/modified, guardrails touched
   - **Authority**: Template/example for future changes

### Precedence Order

**Observed Precedence** (inferred from rule files):

1. **`docs/ARCHITECTURE_SSoT.md`** - **HIGHEST PRECEDENCE**
   - Explicitly stated as "definitive guide" and "Single Source of Truth"
   - Referenced by all other rule files
   - **Evidence**: `.cursor/rules/ARCHITECTURE_SSoT.md` line 7: "**ALWAYS** read and follow `docs/ARCHITECTURE_SSoT.md`"

2. **`.cursor/rules/ARCHITECTURE_SSoT.md`** - **ENFORCEMENT LAYER**
   - Enforces SSoT as primary contract
   - Provides detailed checklists and procedures
   - **Evidence**: Line 3: "This rule enforces the Architecture SSoT as the primary contract"

3. **`.cursorrules`** - **LEGACY COMPATIBILITY**
   - Points to SSoT for details
   - **Evidence**: Line 45: "**For detailed rules, see**: `.cursor/rules/ARCHITECTURE_SSoT.md`"

4. **`AGENTS.md`** - **REFERENCE ONLY**
   - Quick reference, not authoritative
   - **Evidence**: Line 99: "See `docs/ARCHITECTURE_SSoT.md` for complete details"

5. **`docs/changes/*.md`** - **HISTORICAL RECORDS**
   - Documentation of past changes
   - Examples of proper format
   - **Evidence**: Used as templates for new change reports

**Conflict Resolution**:
- If rules conflict, `docs/ARCHITECTURE_SSoT.md` wins (explicitly stated as "definitive")
- If SSoT is unclear, check `.cursor/rules/ARCHITECTURE_SSoT.md` for detailed procedures
- If still unclear, check `docs/changes/*.md` for examples of similar changes

---

## 2. Standard Operating Procedure for Making Changes

### Expected Sequence of Actions

Based on `.cursor/rules/ARCHITECTURE_SSoT.md` and observed patterns in `docs/changes/*.md`:

#### Step 1: Read Governing Documents

**MANDATORY**: Before any code change:

1. Read `docs/ARCHITECTURE_SSoT.md` (entire document or relevant sections)
2. Identify which guardrails/invariants are affected
3. Check "Where to Change Things" section for patterns
4. Review guardrails list (Top 10)

**Evidence**: `.cursor/rules/ARCHITECTURE_SSoT.md` lines 7, 26-32

#### Step 2: Impact Analysis (If Required)

**Required for changes to**:
- `src/lib/planParser.ts` (plan parsing)
- `supabase/functions/*` (edge function contracts)
- Database migrations or RLS policies
- `src/lib/contemplaciones/*` (contemplaciones system)
- `src/contexts/AuthContext.tsx` (authentication)
- `src/utils/groupContext.ts` (group context loading)

**Impact Analysis Must Include**:
1. Which contracts/invariants are touched
2. What could break if the change is incorrect
3. How backward compatibility is maintained (if applicable)
4. Guardrails touched vs. not touched
5. Compatibility guarantees

**Evidence**: `.cursor/rules/ARCHITECTURE_SSoT.md` lines 18-32, `docs/changes/2026-01-26_finalize_group_context_provider.md` lines 31-85

#### Step 3: Plan the Change

1. Identify files to create/modify
2. Determine if database migration is needed
3. Check if edge function contracts will change
4. Verify backward compatibility requirements
5. Plan testing approach (manual, since no automated tests)

**Evidence**: Observed in all `docs/changes/*.md` files

#### Step 4: Implement the Change

1. Follow "Where to Change Things" patterns from SSoT
2. Maintain architectural boundaries (UI → Business Logic → Data Access → Infrastructure)
3. Preserve backward compatibility (especially for `planParser.ts`)
4. Update contracts if modifying edge functions
5. Add RLS policies if creating new tables

**Evidence**: `docs/ARCHITECTURE_SSoT.md` lines 250-292

#### Step 5: Quality Checks

**Before considering change complete**:

- [ ] Read relevant section in `docs/ARCHITECTURE_SSoT.md`
- [ ] Identified affected contracts/invariants
- [ ] Provided impact analysis (if required)
- [ ] Verified backward compatibility (if applicable)
- [ ] Updated SSoT document (if contracts changed)
- [ ] Tested with existing data (if parser/schema changes)
- [ ] Ran `npm run lint` (no errors)
- [ ] TypeScript compilation successful
- [ ] Manual smoke test performed

**Evidence**: `.cursor/rules/ARCHITECTURE_SSoT.md` lines 119-125

#### Step 6: Document the Change

Create change report in `docs/changes/` (see section below for format)

### How `docs/changes/*` is Used

#### Naming Convention

**Format**: `YYYY-MM-DD_description.md`

**Examples**:
- `2026-01-26_finalize_group_context_provider.md`
- `2026-01-26_refactor_group_context_provider.md`
- `2026-01-26_cursor_context_ssot_setup.md`
- `contemplaciones_catalog_v1_initial.md` (older format, no date prefix)

**Observed Pattern**: Recent files use date prefix, older files may not

#### When It's Mandatory

**Observed**: Change reports are created for:
- Significant refactors (e.g., group context provider)
- New features (e.g., contemplaciones catalog)
- Architecture changes (e.g., SSoT setup)
- Bug fixes that touch guardrails

**Not Observed**: Explicit rule stating when mandatory, but pattern suggests:
- **Mandatory**: Changes that touch guardrails or architectural boundaries
- **Recommended**: All non-trivial changes

#### Required Sections

Based on observed examples (`docs/changes/2026-01-26_finalize_group_context_provider.md`):

1. **Header**:
   ```markdown
   # Title
   
   > **Date**: YYYY-MM-DD
   > **Task**: Brief description
   > **Status**: ✅ Completed / ⏳ In Progress / ❌ Failed
   ```

2. **Summary**:
   - What changed
   - Why (rationale)
   - Impact (product changes vs. internal refactor)

3. **Impact Analysis (SSoT Guardrails)**:
   - Guardrails touched (with status, changes, risk, mitigation)
   - Guardrails NOT touched
   - Compatibility guarantees

4. **Files Created**:
   - List with purpose and brief description

5. **Files Modified**:
   - List with changes, rationale, line numbers (if significant)

6. **Manual Verification Steps Performed** (if applicable):
   - Code inspection
   - Type checking
   - Contract verification

7. **Follow-ups / TODOs** (if applicable):
   - Real technical tasks (not speculative)

8. **Success Criteria** (if applicable):
   - Checklist of completed items

**Evidence**: `docs/changes/2026-01-26_finalize_group_context_provider.md` structure

### What Constitutes "Done"

**Observed Definition of "Done"**:

1. ✅ Code changes implemented
2. ✅ Impact analysis completed (if required)
3. ✅ Quality checks passed (lint, typecheck, manual smoke test)
4. ✅ SSoT updated (if contracts changed)
5. ✅ Change report created (if significant change)
6. ✅ Backward compatibility verified (if applicable)
7. ✅ No breaking changes to guardrails (unless explicitly approved)

**Evidence**: `.cursor/rules/ARCHITECTURE_SSoT.md` lines 119-125, observed in change reports

---

## 3. Architectural Guardrails

### Summary of Invariants and Non-Negotiables

**Source**: `docs/ARCHITECTURE_SSoT.md` lines 195-246

**Top 10 Guardrails** (must never break without explicit approval):

1. **Plan Parser Backward Compatibility** (`src/lib/planParser.ts`)
   - Must parse all existing saved plans
   - HTML structure changes must be additive only
   - **Risk**: Breaking changes lose user data
   - **File**: `src/lib/planParser.ts`

2. **Authentication Flow** (`src/contexts/AuthContext.tsx`)
   - Users must be able to log in
   - Profiles must auto-create on first login
   - Session must persist across page reloads
   - **Risk**: Auth changes break all protected routes
   - **File**: `src/contexts/AuthContext.tsx`

3. **Data Isolation** (Database RLS)
   - RLS policies must enforce user isolation
   - Users must only see their own data
   - **Risk**: Policy changes break queries
   - **Files**: All migration files with RLS policies

4. **Explicit Save Pattern** (Application logic)
   - `is_saved = true` → appears in "Mis X" lists
   - `is_saved = false` → draft, not in lists
   - **Risk**: Changing pattern breaks user expectations
   - **Files**: Application queries, migration `20251219163000_*.sql`

5. **Session-Plan Relationship** (Database FK)
   - Sessions must belong to a plan (FK constraint)
   - Deleting plan deletes sessions (CASCADE)
   - **Risk**: FK changes break data integrity
   - **Files**: Migration `20250923163758_*.sql`

6. **AI Generation Contract** (`supabase/functions/generate-plan-completo/index.ts`)
   - Must return: `{ plan_html, argumento_competencias, recursos, titulo }`
   - HTML must contain `<section id="plan">` with H1, H2 sections
   - **Risk**: Contract changes break frontend parsing
   - **File**: `supabase/functions/generate-plan-completo/index.ts`

7. **Contemplaciones Catalog** (`src/lib/contemplaciones/catalog.ts`)
   - Catalog IDs must remain stable (no breaking changes)
   - Defaults versioning must be backward compatible
   - **Risk**: Catalog changes break enforcement
   - **File**: `src/lib/contemplaciones/catalog.ts`

8. **Edge Functions ↔ Frontend Hooks**
   - Hooks expect specific response format
   - **Risk**: Function changes break frontend
   - **Mitigation**: Maintain API contract, version functions if needed
   - **Files**: Edge functions + hooks that call them

9. **Session Estado Enum** (Database enum)
   - Values: `'backlog'`, `'planificada'`, `'dictada'`, `'omitida'`, `'pausada'`
   - **Risk**: Enum changes break application logic
   - **File**: Migration `20250930180042`

10. **Group Context Loading** (`src/utils/groupContext.ts`)
    - Hybrid: Supabase (teacher_sugerencias) + mockData (students)
    - **Risk**: Changing loading logic breaks AI generation
    - **Future**: Migrate students to Supabase
    - **File**: `src/utils/groupContext.ts` (deprecated, use `src/services/groupContext/provider.ts`)

### Where Guardrails Are Defined

**Primary Definition**: `docs/ARCHITECTURE_SSoT.md` lines 195-246

**Enforcement Rules**: `.cursor/rules/ARCHITECTURE_SSoT.md` lines 34-60

**Quick Reference**: `AGENTS.md` lines 37-59

---

## 4. Code Organization Rules

### Where New Code Should Go by Type

**Source**: `docs/ARCHITECTURE_SSoT.md` lines 250-292, `.cursor/rules/ARCHITECTURE_SSoT.md` lines 86-115

| Code Type | Location | Example |
|-----------|----------|---------|
| **New Page/Route** | `src/pages/NewPage.tsx` | `PlanificacionWizard.tsx` |
| **Page-Specific Component** | `src/components/feature-name/` | `src/components/planificacion/` |
| **Shared UI Component** | `src/components/ui/` (if shadcn pattern) or `src/components/` | `AppSidebar.tsx` |
| **Business Logic Hook** | `src/hooks/useFeatureName.ts` | `useFullSessionGeneration.ts` |
| **Pure Utility Function** | `src/lib/utilityName.ts` | `planParser.ts` |
| **Data Access Helper** | `src/utils/helperName.ts` or `src/services/` | `groupContext.ts`, `services/groupContext/provider.ts` |
| **Type Definitions** | `src/types/featureName.ts` | `planificacion.ts` |
| **Static Data** | `src/data/dataName.ts` | `mockData.ts` |
| **Database Migration** | `supabase/migrations/YYYYMMDDHHMMSS_description.sql` | `20251219163000_*.sql` |
| **Edge Function** | `supabase/functions/function-name/index.ts` | `generate-plan-completo/index.ts` |

### Forbidden Import Paths / Dependency Directions

**Observed Rules** (from architecture boundaries):

1. **UI Layer** (`src/pages/`, `src/components/`):
   - ❌ **CANNOT**: Direct Supabase queries (use hooks/utils)
   - ❌ **CANNOT**: Business logic (delegate to hooks/lib)
   - ✅ **CAN**: Call hooks, use contexts, render UI

2. **Business Logic Layer** (`src/hooks/`, `src/lib/`):
   - ❌ **CANNOT**: Render UI (return data/state)
   - ❌ **CANNOT**: Direct DOM manipulation
   - ✅ **CAN**: Call Supabase client, transform data, enforce rules

3. **Data Access Layer** (`src/integrations/`, `src/utils/`):
   - ❌ **CANNOT**: Business logic (pure data access)
   - ❌ **CANNOT**: UI concerns
   - ✅ **CAN**: Query Supabase, normalize data

4. **Infrastructure Layer** (`supabase/`):
   - ❌ **CANNOT**: Frontend-specific logic
   - ✅ **CAN**: Database schema, edge functions, RLS

**Enforcement**: TypeScript types prevent some violations, but no explicit lint rules observed

**Evidence**: `docs/ARCHITECTURE_SSoT.md` lines 250-292, architectural boundaries inferred from code structure

---

## 5. Quality Gates

### Required Checks Before Change Complete

**Source**: `.cursor/rules/ARCHITECTURE_SSoT.md` lines 119-125

**Checklist** (from Error Prevention section):

- [ ] Read relevant section in `docs/ARCHITECTURE_SSoT.md`
- [ ] Identified affected contracts/invariants
- [ ] Provided impact analysis (if required)
- [ ] Verified backward compatibility (if applicable)
- [ ] Updated SSoT document (if contracts changed)
- [ ] Tested with existing data (if parser/schema changes)

**Additional Checks** (observed in change reports):

- [ ] Ran `npm run lint` (no errors)
- [ ] TypeScript compilation successful
- [ ] All imports resolve correctly
- [ ] Manual smoke test performed
- [ ] Contract verification (payload shapes match)

**Evidence**: 
- `.cursor/rules/ARCHITECTURE_SSoT.md` lines 119-125
- `docs/changes/2026-01-26_finalize_group_context_provider.md` lines 244-262

### What Is Expected When There Is No Automated Test Framework

**Current State**: No testing infrastructure configured

**Observed Practices**:

1. **Manual Verification Steps**:
   - Code inspection
   - Type checking (`npm run lint`, TypeScript compilation)
   - Contract verification (payload shapes, data structures)
   - Manual smoke tests (run app, test affected features)

2. **Documentation of Verification**:
   - Change reports include "Manual Verification Steps Performed" section
   - Lists what was checked and results

3. **Testing with Existing Data**:
   - For parser changes: Test with existing plan HTML from database
   - For schema changes: Test migration sequence with `supabase db reset`

**Evidence**: 
- `docs/changes/2026-01-26_finalize_group_context_provider.md` lines 244-262
- `.cursor/rules/ARCHITECTURE_SSoT.md` line 41: "Test with existing plan HTML from database"

---

## 6. Decision Records / Documentation Style

### How Decisions Are Recorded

**Primary Location**: `docs/changes/*.md`

**Format**: Change reports document:
- What changed
- Why (rationale)
- Impact analysis
- Files created/modified
- Guardrails touched
- Compatibility guarantees

**Other Documentation Locations**:
- `docs/ARCHITECTURE_SSoT.md`: Architectural decisions and contracts
- `docs/CONTEMPLACIONES_CATALOG.md`: Domain-specific decisions (contemplaciones)
- `docs/PROJECT_ARCHITECTURE_DEEP_DIVE.md`: Comprehensive architecture documentation

**Observed**: No separate ADR (Architecture Decision Records) directory. Decisions are embedded in:
- Change reports (tactical decisions)
- SSoT document (architectural contracts)
- Domain-specific docs (feature decisions)

### Tone/Format Conventions

**Observed Style**:

1. **Headers**: Use `#` for title, `##` for major sections, `###` for subsections

2. **Status Indicators**: 
   - ✅ Completed
   - ⏳ In Progress
   - ❌ Failed

3. **Code References**: Use file paths with line numbers when significant:
   - `src/lib/planParser.ts:36-822`
   - `supabase/functions/generate-plan-completo/index.ts:177-265`

4. **Evidence Citations**: Include file paths and line numbers:
   - "**Evidence**: `supabase/functions/modify-evaluation/index.ts:600`"

5. **Lists**: Use markdown lists with checkboxes for checklists:
   - `- [ ] Item`
   - `- [x] Completed item`

6. **Tables**: Use markdown tables for structured data:
   - Guardrails, file locations, environment variables

7. **Code Blocks**: Use fenced code blocks with language tags:
   - TypeScript: ` ```typescript ... ``` `
   - SQL: ` ```sql ... ``` `

8. **Emphasis**: 
   - **Bold** for important terms, file paths, guardrails
   - *Italic* for emphasis within sentences
   - `Code` for inline code, file paths, variable names

**Evidence**: All `docs/changes/*.md` files follow this style

### Required Headings (If Any)

**Observed Required Sections** (from change reports):

1. Title (with date, task, status in header)
2. Summary
3. Impact Analysis (SSoT Guardrails) - if guardrails touched
4. Files Created
5. Files Modified
6. Manual Verification Steps Performed (if applicable)
7. Follow-ups / TODOs (if applicable)
8. Success Criteria (if applicable)

**Not Strictly Required**: Format is flexible, but these sections appear consistently in significant changes

**Evidence**: `docs/changes/2026-01-26_finalize_group_context_provider.md` structure

---

## 7. Examples (Grounded)

### Example 1: Refactor with Impact Analysis

**File**: `docs/changes/2026-01-26_refactor_group_context_provider.md`

**What It Illustrates**:
- **Impact Analysis Format**: Shows how to document guardrails touched vs. not touched
- **Compatibility Guarantees**: Documents that edge function payloads remain identical
- **Backward Compatibility**: Shows wrapper pattern for maintaining old API
- **File Organization**: Demonstrates where to place new service layer code (`src/services/groupContext/provider.ts`)

**Key Sections**:
- Lines 19-55: Impact Analysis with guardrails touched, status, risk, mitigation
- Lines 50-55: Compatibility guarantees (payloads, data sources, anonymization)
- Lines 59-85: Files created with purpose and exports
- Lines 87-115: Files modified with rationale

**Workflow Demonstrated**:
1. Read SSoT (guardrails identified)
2. Impact analysis (guardrails touched documented)
3. Implementation (new provider, wrapper for backward compatibility)
4. Documentation (complete change report)

### Example 2: Architecture Setup with SSoT Updates

**File**: `docs/changes/2026-01-26_cursor_context_ssot_setup.md`

**What It Illustrates**:
- **SSoT Updates**: Shows how to document corrections to SSoT when code is validated
- **Rule File Creation**: Demonstrates creating both modern (`.cursor/rules/`) and legacy (`.cursorrules`) formats
- **Corrections Table**: Shows format for documenting inaccuracies found and fixed
- **Multi-File Changes**: Documents creation of multiple related files (rules, docs, change report)

**Key Sections**:
- Lines 50-58: Files Modified with corrections made to SSoT
- Lines 61-66: Corrections table (Before/After/Evidence format)
- Lines 70-100: How to use new rules (documentation for future reference)

**Workflow Demonstrated**:
1. Validation (code checked against SSoT)
2. Corrections (SSoT updated to match code)
3. Rule files created (enforcement layer)
4. Documentation (change report + usage guide)

### Example 3: Feature Implementation with Guardrails

**File**: `docs/changes/2026-01-26_finalize_group_context_provider.md`

**What It Illustrates**:
- **Comprehensive Impact Analysis**: Most detailed example of guardrail analysis
- **Explicit Flags**: Shows how to document new features that don't break contracts
- **Migration Readiness**: Documents preparation for future changes (DB migration)
- **Verification Steps**: Detailed manual verification checklist

**Key Sections**:
- Lines 31-85: Comprehensive impact analysis (guardrails touched, not touched, compatibility)
- Lines 138-169: Migration readiness (preparation for future DB migration)
- Lines 173-207: Explicit content adaptation flags (new feature, no contract break)
- Lines 244-262: Manual verification steps (code inspection, type checking, contract verification)

**Workflow Demonstrated**:
1. Impact analysis (comprehensive guardrail review)
2. Implementation (new features with explicit flags)
3. Verification (detailed checklist)
4. Documentation (complete change report with future migration notes)

**Pattern Observed**: All three examples follow the same structure:
- Header with date, task, status
- Summary (what/why/impact)
- Impact Analysis (guardrails)
- Files Created/Modified
- Verification steps
- Follow-ups/TODOs

---

## Open Questions / Conflicts

### Observed Inconsistencies

1. **Change Report Naming**:
   - **Recent**: `YYYY-MM-DD_description.md` (e.g., `2026-01-26_finalize_group_context_provider.md`)
   - **Older**: `description.md` (e.g., `contemplaciones_catalog_v1_initial.md`)
   - **Question**: Is date prefix required for all new reports?
   - **Status**: **Unknown** - No explicit rule found

2. **When Change Reports Are Mandatory**:
   - **Observed**: Created for significant refactors, new features, architecture changes
   - **Question**: Are they mandatory for all changes, or only significant ones?
   - **Status**: **Implicit** - Pattern suggests significant changes only, but no explicit rule

3. **SSoT Update Requirements**:
   - **Rule**: "Update `docs/ARCHITECTURE_SSoT.md` if contracts changed" (`.cursor/rules/ARCHITECTURE_SSoT.md` line 65)
   - **Question**: What constitutes a "contract change"? (Only edge functions, or also database schema, parsing contracts?)
   - **Status**: **Partially Explicit** - Edge functions explicitly mentioned, others inferred

4. **Testing Requirements**:
   - **Rule**: "Test with existing plan HTML from database" (for parser changes)
   - **Question**: What testing is required for other types of changes?
   - **Status**: **Implicit** - Manual smoke tests expected, but not explicitly documented for all change types

5. **Precedence Between Rule Files**:
   - **Observed**: `.cursor/rules/ARCHITECTURE_SSoT.md` and `.cursorrules` both exist
   - **Question**: Which takes precedence if they conflict?
   - **Status**: **Inferred** - `.cursor/rules/ARCHITECTURE_SSoT.md` is detailed, `.cursorrules` is legacy compatibility - detailed version likely takes precedence

### Unresolved Questions

1. **CI/CD Integration**: No CI/CD configuration found. Are changes deployed manually?
2. **Code Review Process**: No explicit code review requirements documented (GitHub PRs, etc.)
3. **Branching Strategy**: No explicit branching strategy documented (main/master, feature branches, etc.)
4. **Version Control**: No explicit commit message format requirements (though change reports suggest detailed documentation)

---

## Change Log

### Files Created

1. **`docs/CURSOR_WORKFLOW_RULEBOOK.md`** (NEW)
   - **Purpose**: Document the current "Cursor workflow / engineering rulebook" that this repository follows today
   - **Size**: ~600 lines
   - **Content**:
     - Governing documents and precedence order
     - Standard operating procedure for making changes
     - Architectural guardrails summary
     - Code organization rules
     - Quality gates and expected practices
     - Decision records / documentation style
     - Examples from existing change reports
     - Open questions / conflicts
   - **Source**: 
     - `docs/ARCHITECTURE_SSoT.md`
     - `.cursor/rules/ARCHITECTURE_SSoT.md`
     - `.cursorrules`
     - `AGENTS.md`
     - `docs/changes/2026-01-26_finalize_group_context_provider.md`
     - Other `docs/changes/*.md` files for pattern analysis

### Files Modified

**None** - Only one new file created.

---

**End of Document**






