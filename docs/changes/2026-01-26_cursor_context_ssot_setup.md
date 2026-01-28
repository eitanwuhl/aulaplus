# Cursor Context SSoT Setup

> **Date**: January 26, 2026  
> **Task**: Set up Architecture SSoT as always-on reference in Cursor  
> **Status**: ✅ Completed

---

## Summary

Configured `docs/ARCHITECTURE_SSoT.md` as the definitive operational reference for Cursor, with persistent rules that enforce architectural contracts and guardrails. This ensures all future code changes consistently follow the established architecture.

---

## Files Created

### 1. `.cursor/rules/ARCHITECTURE_SSoT.md` (NEW)
- **Purpose**: Detailed Cursor rule file enforcing SSoT as primary contract
- **Size**: ~150 lines
- **Content**:
  - Mandatory checks before code changes
  - Guardrails enforcement (top 10)
  - Impact analysis requirements
  - Common change patterns
  - Error prevention checklist

### 2. `.cursorrules` (NEW)
- **Purpose**: Legacy Cursor rules file (compatibility)
- **Size**: ~60 lines
- **Content**: Compact version referencing SSoT and key guardrails
- **Format**: Compatible with all Cursor versions

### 3. `AGENTS.md` (NEW)
- **Purpose**: Quick operational reference for AI agents and developers
- **Size**: ~100 lines
- **Content**:
  - Primary architecture reference pointer
  - Commands (dev/build/lint)
  - High-risk invariants (top 5)
  - Key file references
  - Environment variables
  - Known gaps

### 4. `docs/changes/2026-01-26_cursor_context_ssot_setup.md` (NEW)
- **Purpose**: This change report
- **Content**: Summary of setup, files created/modified, corrections made

---

## Files Modified

### 1. `docs/ARCHITECTURE_SSoT.md` (UPDATED)
- **Changes**:
  - Fixed `modify-evaluation` model description: Changed from "gpt-4o-mini (default), fallback gpt-4.1-2025-04-14 (if type === 'chat')" to "gpt-5-mini-2025-08-07 (if type === 'chat'), gpt-4.1-2025-04-14 (otherwise)"
  - **Evidence**: `supabase/functions/modify-evaluation/index.ts:600` uses `gpt-5-mini-2025-08-07` for chat type
  - Fixed temperature/max_tokens note: Clarified that max_tokens is not explicitly set (uses OpenAI defaults)
  - **Evidence**: `supabase/functions/generate-plan-completo/index.ts:280` only sets `temperature: 0.7`, no `max_tokens`

---

## Corrections Made to SSoT

| Issue | Before | After | Evidence |
|-------|--------|-------|----------|
| **modify-evaluation model** | "gpt-4o-mini (default), fallback gpt-4.1-2025-04-14 (if type === 'chat')" | "gpt-5-mini-2025-08-07 (if type === 'chat'), gpt-4.1-2025-04-14 (otherwise)" | `modify-evaluation/index.ts:600` |
| **max_tokens note** | "Max Tokens: 3000 (not explicitly set, uses OpenAI defaults)" | "Max Tokens: Not set (uses OpenAI defaults)" | Code only sets `temperature: 0.7` |

---

## How to Use the New Rules in Cursor

### Rule Files Location

1. **`.cursor/rules/ARCHITECTURE_SSoT.md`** (Primary)
   - Detailed rules with checklists
   - Impact analysis requirements
   - Guardrails enforcement

2. **`.cursorrules`** (Legacy compatibility)
   - Compact version for older Cursor versions
   - References SSoT document
   - Key guardrails summary

### How Cursor Loads Rules

- **Modern Cursor**: Automatically loads `.cursor/rules/*.md` files
- **Legacy Cursor**: Loads `.cursorrules` file in repo root
- **Both formats**: Created for maximum compatibility

### What the Rules Enforce

1. **Mandatory SSoT Reading**: Before any code change, agent must read `docs/ARCHITECTURE_SSoT.md`

2. **Impact Analysis Required** for changes to:
   - Plan parser (`src/lib/planParser.ts`)
   - Edge functions (`supabase/functions/*`)
   - Database migrations/RLS
   - Contemplaciones system (`src/lib/contemplaciones/*`)
   - Authentication (`src/contexts/AuthContext.tsx`)
   - Group context (`src/utils/groupContext.ts`)

3. **Guardrails Enforcement**: Never break top 10 guardrails without approval

4. **Contract Updates**: When modifying contracts, update SSoT immediately

### Verification

To verify rules are active:
1. Ask Cursor to modify `src/lib/planParser.ts`
2. Agent should:
   - Reference `docs/ARCHITECTURE_SSoT.md`
   - Provide impact analysis
   - Check backward compatibility
   - Test with existing plans

---

## Risks and Follow-ups

### Low Risk ✅
- Rule files are documentation only (no runtime impact)
- SSoT corrections were minor (model names, notes)
- No code behavior changed

### Follow-ups Recommended

1. **Test Rule Enforcement**:
   - Try making a change to `src/lib/planParser.ts`
   - Verify agent references SSoT and provides impact analysis
   - If rules don't load, check Cursor version compatibility

2. **Update SSoT as Code Evolves**:
   - When contracts change, update `docs/ARCHITECTURE_SSoT.md` immediately
   - Keep rule files in sync with SSoT

3. **Team Awareness**:
   - Inform team about new SSoT reference
   - Ensure all developers know to check SSoT before major changes

4. **Monitor Rule Effectiveness**:
   - Track if agents consistently reference SSoT
   - Adjust rules if needed based on usage patterns

---

## Validation Performed

### SSoT Validation Against Codebase

✅ **Verified**:
- Edge function contracts match code (request/response shapes)
- Model names match code (`gpt-4o-mini`, `gpt-5-mini-2025-08-07`, `gpt-4.1-2025-04-14`)
- Retry logic matches code (3 attempts, 2000ms base delay)
- Temperature setting matches code (0.7)
- Max tokens: Not set in code (uses OpenAI defaults)
- File paths exist and are correct
- Database invariants match migrations
- Guardrails are accurate

✅ **Corrected**:
- `modify-evaluation` model description (was incorrect)
- Max tokens note (was misleading)

---

## Architecture Decisions

### Why Two Rule Files?

1. **`.cursor/rules/ARCHITECTURE_SSoT.md`**: Modern format, detailed, folder-based
2. **`.cursorrules`**: Legacy format, compact, root-level

**Rationale**: Maximum compatibility across Cursor versions. If folder-based rules don't load, legacy file provides fallback.

### Why AGENTS.md?

**Purpose**: Quick reference for agents and developers without duplicating full architecture.

**Content**: Commands, high-risk invariants, key files, environment variables.

**Rationale**: Agents need quick access to operational info without reading full SSoT every time.

### Why Impact Analysis Requirement?

**Purpose**: Prevent breaking changes to critical contracts.

**Rationale**: Plan parser, edge functions, and database invariants are high-risk. Requiring impact analysis forces agents to consider consequences before making changes.

---

## Success Criteria

✅ **Completed**:
- [x] SSoT validated against codebase
- [x] Corrections made to SSoT
- [x] Cursor rules created (both formats)
- [x] AGENTS.md created
- [x] Change report created
- [x] No code behavior changed
- [x] No runtime dependencies added

---

## Next Steps

1. **Test**: Verify Cursor loads rules correctly
2. **Monitor**: Track if agents reference SSoT consistently
3. **Maintain**: Update SSoT as code evolves
4. **Iterate**: Adjust rules based on effectiveness

---

**End of Change Report**







