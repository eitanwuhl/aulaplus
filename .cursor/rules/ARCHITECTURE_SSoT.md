# Architecture Single Source of Truth (SSoT) - Cursor Rules

> **CRITICAL**: This rule enforces the Architecture SSoT as the primary contract for all code changes.

## Primary Reference

**ALWAYS** read and follow `docs/ARCHITECTURE_SSoT.md` before making any code changes. This document is the definitive operational reference for:
- Database invariants
- Edge function contracts
- Parsing contracts
- Guardrails and boundaries
- "Where to change things" guide

## Mandatory Checks Before Code Changes

### 1. Impact Analysis Required

Before touching any code that affects:
- `src/lib/planParser.ts` (plan parsing)
- `supabase/functions/*` (edge function contracts)
- Database migrations or RLS policies
- `src/lib/contemplaciones/*` (contemplaciones system)
- `src/contexts/AuthContext.tsx` (authentication)
- `src/utils/groupContext.ts` (group context loading)

**You MUST**:
1. Read the relevant section in `docs/ARCHITECTURE_SSoT.md`
2. Identify which guardrails/invariants are affected
3. Provide a brief "impact analysis" explaining:
   - Which contracts/invariants are touched
   - What could break if the change is incorrect
   - How backward compatibility is maintained (if applicable)

### 2. Guardrails Enforcement

**NEVER** break these guardrails without explicit approval:

1. **Plan Parser Backward Compatibility** (`src/lib/planParser.ts`)
   - Must parse all existing saved plans
   - Changes must be additive only
   - Test with existing plan HTML from database

2. **AI Generation Contract** (`supabase/functions/generate-plan-completo/index.ts`)
   - Must return: `{ plan_html, argumento_competencias, recursos, titulo }`
   - HTML must contain `<section id="plan">` with H1, H2 sections
   - Do NOT change response structure without updating frontend

3. **Database Invariants**
   - Explicit save pattern: `is_saved = true` → appears in lists
   - Soft delete: `deleted_at IS NULL` → active record
   - User isolation: RLS policies must enforce `auth.uid() = user_id`
   - Session-Plan relationship: FK constraint with CASCADE DELETE

4. **Contemplaciones Catalog** (`src/lib/contemplaciones/catalog.ts`)
   - Catalog IDs must remain stable
   - Defaults versioning must be backward compatible

5. **Session Estado Enum**
   - Values: `'backlog'`, `'planificada'`, `'dictada'`, `'omitida'`, `'pausada'`
   - Do NOT add/remove values without migration

### 3. Contract Changes

When modifying edge functions:
- **Request/Response contracts**: Update `docs/ARCHITECTURE_SSoT.md` immediately
- **Model changes**: Document in SSoT
- **Retry logic changes**: Document in SSoT
- **CORS/JWT changes**: Document in SSoT

### 4. Database Schema Changes

**ALWAYS**:
1. Create new migration file (never modify existing)
2. Include RLS policies for new tables
3. Test migration sequence: `supabase db reset`
4. Update TypeScript types: `supabase gen types typescript`
5. Update `docs/ARCHITECTURE_SSoT.md` if schema changes affect contracts

### 5. File Path Verification

Before referencing files in code or documentation:
- Verify file exists at stated path
- Verify exports match documented signatures
- Verify dependencies match documented structure

## Common Change Patterns

### Adding a New Page/Route
1. Create: `src/pages/NewPage.tsx`
2. Add route: `src/App.tsx` → `AppRoutes`
3. Add navigation: `src/components/AppSidebar.tsx` → `navigationItems`
4. Use: `ProtectedTeacherRoute` or `ProtectedStudentRoute` wrapper

### Modifying AI Prompt
**File**: `supabase/functions/generate-plan-completo/index.ts` (lines 177-265)

**Rules**:
- Maintain HTML structure requirements
- Test with different inputs
- **Warning**: Changes affect all future generations (not backward compatible)

### Modifying Plan Parser
**File**: `src/lib/planParser.ts`

**Rules**:
- **CRITICAL**: Maintain backward compatibility
- Test with existing plan HTML from database
- Changes must be additive only
- Do NOT remove parsing logic for old formats

### Adding New Contemplación
1. Update: `src/lib/contemplaciones/catalog.ts` → Add to `CONTEMPLACIONES_CATALOG`
2. Update defaults (if needed): `src/lib/contemplaciones/defaults.ts`
3. Test enforcement: Verify reminders appear in evaluation cards
4. Update docs: `docs/CONTEMPLACIONES_CATALOG.md`

## Error Prevention

**Before committing changes that touch guardrails**:
- [ ] Read relevant section in `docs/ARCHITECTURE_SSoT.md`
- [ ] Identified affected contracts/invariants
- [ ] Provided impact analysis
- [ ] Verified backward compatibility (if applicable)
- [ ] Updated SSoT document (if contracts changed)
- [ ] Tested with existing data (if parser/schema changes)

## Questions?

If unsure about a change:
1. Read `docs/ARCHITECTURE_SSoT.md` first
2. Check "Where to Change Things" section
3. Review guardrails list
4. If still unclear, ask for clarification before proceeding

---

**This rule is enforced by Cursor. Violations may break production.**


