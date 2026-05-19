# AulaPlus v0 - Agent Reference Guide

> **Quick operational reference for AI agents and developers**

## Primary Architecture Reference

**ALWAYS consult**: `docs/ARCHITECTURE_SSoT.md` before making code changes.

This document contains:
- Database invariants and contracts
- Edge function request/response contracts
- Parsing contracts (backward compatibility critical)
- Guardrails (top 10 things that must not break)
- "Where to change things" guide

**Notificaciones del dashboard (persistencia, tablas, RLS, seeds):** [docs/dashboard-notifications.md](docs/dashboard-notifications.md)

**Mis Grupos (Postgres + seeds):** [docs/teacher-groups.md](docs/teacher-groups.md)

## Commands

### Development
```bash
npm run dev          # Start dev server (localhost:8080)
npm run build        # Production build
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Database
```bash
supabase db reset    # Reset local database (test migrations)
supabase gen types typescript  # Generate TypeScript types from schema
```

### Edge Functions
```bash
supabase functions deploy <function-name>  # Deploy edge function
```

## High-Risk Invariants

**DO NOT BREAK** these without explicit approval:

1. **Plan Parser** (`src/lib/planParser.ts`)
   - Must parse all existing saved plans
   - Changes must be additive only

2. **AI Generation Contract** (`supabase/functions/generate-plan-completo/index.ts`)
   - Response: `{ plan_html, argumento_competencias, recursos, titulo }`
   - HTML must contain `<section id="plan">` with H1, H2 sections

3. **Database Invariants**
   - `is_saved = true` → appears in "Mis X" lists
   - `deleted_at IS NULL` → active record
   - RLS: `auth.uid() = user_id` (user isolation)

4. **Contemplaciones Catalog** (`src/lib/contemplaciones/catalog.ts`)
   - Catalog IDs must remain stable
   - Defaults versioning must be backward compatible

5. **Session Estado Enum**
   - Values: `'backlog'`, `'planificada'`, `'dictada'`, `'omitida'`, `'pausada'`

## Key Files

**Start Here**:
- `src/main.tsx` - Entry point
- `src/App.tsx` - Routing
- `src/integrations/supabase/client.ts` - Database client
- `src/contexts/AuthContext.tsx` - Authentication

**Core Flows**:
- `src/pages/PlanificacionWizard.tsx` - Lesson plan creation
- `src/hooks/useFullSessionGeneration.ts` - AI generation orchestration
- `supabase/functions/generate-plan-completo/index.ts` - AI generation logic
- `src/lib/planParser.ts` - Plan parsing (critical for compatibility)

**Data Layer**:
- `supabase/migrations/20250923163758_*.sql` - Initial schema
- `supabase/migrations/20251219163000_*.sql` - Explicit save pattern
- `src/integrations/supabase/types.ts` - TypeScript types

## Environment Variables

Required in `.env` (root):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Set in Supabase Dashboard:
- `OPENAI_API_KEY` (edge functions)
- `SERVICE_ROLE_KEY` (admin)

## Known Gaps

1. Demo-only authentication (not production-ready)
2. No testing infrastructure
3. Brittle HTML parsing (regex-based)
4. Hybrid data model (students in mockData, not DB)
5. No structured logging
6. No error tracking

See `docs/ARCHITECTURE_SSoT.md` for complete details.

---

**For full architecture details, see**: `docs/ARCHITECTURE_SSoT.md`  
**For Cursor rules, see**: `.cursor/rules/ARCHITECTURE_SSoT.md`







