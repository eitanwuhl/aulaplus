# AulaPlus v0 - Architecture Single Source of Truth

> **Purpose**: This document defines the architectural contract for AulaPlus. It establishes boundaries, responsibilities, and rules for safe changes. Use this as the ONLY reference for development decisions.

---

## 1. Purpose and Scope

**AulaPlus** is an educational planning and evaluation platform for the Uruguayan education system (ANEP). It enables teachers to:
- Generate AI-powered lesson plans aligned with ANEP curriculum
- Create and manage student evaluations with rubrics
- Track competencies across the ANEP framework
- Manage student groups and communications

**Architecture Pattern**: React SPA + Supabase (PostgreSQL + Auth + Edge Functions) + OpenAI API

**Scope**: This document covers the production codebase structure, data ownership, runtime flows, and change procedures. It does NOT cover deployment infrastructure details (managed by Lovable.dev/Supabase).

---

## 2. System Context

### External Systems

| System | Purpose | Integration Point | Authentication |
|--------|---------|-------------------|----------------|
| **Supabase** | Database, Auth, Edge Functions | `src/integrations/supabase/client.ts` | JWT (anon key) |
| **OpenAI API** | AI lesson plan generation | `supabase/functions/generate-plan-completo/index.ts` | API Key (env var) |
| **Supabase Auth** | User authentication | `src/contexts/AuthContext.tsx` | Email/password (demo) |

### Integration Boundaries

- **Frontend ↔ Supabase**: Direct client queries with RLS enforcement
- **Frontend ↔ Edge Functions**: `supabase.functions.invoke()` calls
- **Edge Functions ↔ OpenAI**: Direct HTTPS API calls
- **No direct database access**: All data access via Supabase client (RLS enforced)

---

## 3. High-Level Architecture

### Subsystems

```
┌─────────────────────────────────────────┐
│         Frontend (React SPA)            │
│  ┌────────────┐  ┌────────────┐        │
│  │  Routing   │  │   State    │        │
│  │  (Router)  │  │ (Context + │        │
│  └────────────┘  │  React Q)  │        │
│                   └────────────┘        │
│  ┌──────────────────────────────────┐  │
│  │  Pages → Components → Hooks      │  │
│  └──────────────────────────────────┘  │
└───────────────┬──────────────────────────┘
                │ Supabase Client SDK
┌───────────────┴──────────────────────────┐
│      Supabase Backend                     │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │   Auth   │  │ Postgres │  │  Edge   │ │
│  │  (JWT)   │  │   (RLS)  │  │ Functions│ │
│  └──────────┘  └──────────┘  └─────────┘ │
└───────────────┬──────────────────────────┘
                │ HTTPS API
┌───────────────┴──────────────────────────┐
│         OpenAI API (GPT-4o-mini)          │
└───────────────────────────────────────────┘
```

### Responsibilities by Layer

**Frontend Layer** (`src/`)
- **Pages**: Route-level components, orchestrate feature flows
- **Components**: Reusable UI, feature-specific components
- **Hooks**: Business logic, data fetching, state management
- **Lib**: Pure utilities, parsers, validators
- **Contexts**: Global state (Auth)

**Backend Layer** (`supabase/`)
- **Migrations**: Schema definition, RLS policies
- **Edge Functions**: Serverless business logic, AI integration
- **Database**: Data persistence, RLS enforcement

**Integration Layer** (`src/integrations/`)
- **Supabase Client**: Configured client instance
- **Types**: Generated TypeScript types from schema

---

## 4. Component Catalog

| Component | Responsibility | Key Files | Dependencies |
|-----------|---------------|-----------|--------------|
| **Authentication** | User auth, profile management | `src/contexts/AuthContext.tsx` | Supabase Auth, localStorage |
| **Routing** | Route definition, protection | `src/App.tsx` | React Router, AuthContext |
| **Layout** | App shell, navigation | `src/components/AppLayout.tsx`, `src/components/AppSidebar.tsx` | SidebarProvider, Breadcrumbs |
| **Lesson Planning** | Plan creation, editing | `src/pages/PlanificacionWizard.tsx`, `src/pages/PlanificacionWorkspace.tsx` | `useFullSessionGeneration`, `planParser` |
| **AI Generation** | Lesson plan AI generation | `src/hooks/useFullSessionGeneration.ts`, `supabase/functions/generate-plan-completo/index.ts` | OpenAI API, `planParser` |
| **Plan Parser** | HTML plan parsing | `src/lib/planParser.ts` | Pure utility (no deps) |
| **Evaluations** | Evaluation creation, management | `src/pages/EvaluacionesGrupo.tsx`, `src/pages/MisEvaluaciones.tsx` | Supabase client |
| **Competency Tracking** | Extract and map competencies | `src/lib/competencyExtractor.ts` | Static data catalogs |
| **Error Handling** | React error boundaries | `src/components/ErrorBoundary.tsx` | React error boundary API |
| **UI Components** | Reusable UI primitives | `src/components/ui/` | Radix UI, Tailwind |

### Critical Components (Do Not Break)

1. **`src/integrations/supabase/client.ts`**: Single source of Supabase client
2. **`src/contexts/AuthContext.tsx`**: Authentication state management
3. **`src/lib/planParser.ts`**: Parses all saved lesson plans (backward compatibility critical)
4. **`supabase/functions/generate-plan-completo/index.ts`**: AI generation contract
5. **Database RLS policies**: Security boundary (defined in migrations)

---

## 5. Data Architecture

### Data Ownership

| Table | Owner | Access Pattern | RLS Policy |
|-------|-------|----------------|------------|
| `profiles` | User (self) | `user_id = auth.uid()` | Users can read/update own profile |
| `planificaciones` | User (creator) | `user_id = auth.uid()` | Users can CRUD own plans |
| `sesiones_clase` | User (via planificacion) | `planificacion.user_id = auth.uid()` | Users can CRUD sessions of own plans |
| `evaluaciones` | User (creator) | `user_id = auth.uid()` | Users can CRUD own evaluations |
| `grupos` | User (creator) | `user_id = auth.uid()` | Users can CRUD own groups |
| `comunicaciones` | User (creator) | `user_id = auth.uid()` | Users can CRUD own communications |

### Data Invariants

1. **Explicit Save Pattern**: 
   - `is_saved = true` AND `saved_at IS NOT NULL` → appears in "Mis X" lists
   - `is_saved = false` → draft, not visible in lists
   - **Enforced by**: Application logic, not database constraints

2. **Soft Delete Pattern**:
   - `deleted_at IS NULL` → active record
   - `deleted_at IS NOT NULL` → soft-deleted, filtered out in queries
   - **Enforced by**: Application queries (WHERE deleted_at IS NULL)

3. **User Isolation**:
   - All tables enforce RLS: users can only access their own data
   - **Enforced by**: Database RLS policies (cannot be bypassed)

4. **Session-Plan Relationship**:
   - `sesiones_clase.planificacion_id` → `planificaciones.id` (FK, CASCADE DELETE)
   - **Enforced by**: Database foreign key constraint

### Migration Rules

1. **Always create new migration files**: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. **Never modify existing migrations**: Create new migration to alter schema
3. **Always include RLS policies**: For new tables, enable RLS and create policies
4. **Update types after migration**: Run `supabase gen types typescript` → update `src/integrations/supabase/types.ts`
5. **Test locally first**: `supabase db reset` to test migration sequence

### Key Migrations

- `20250923163758_*.sql`: Initial schema (planificaciones, sesiones_clase)
- `20251219163000_*.sql`: Explicit save pattern for planificaciones
- `20251222000000_*.sql`: Explicit save pattern for evaluaciones
- `20251227003612_*.sql`: Added session_brief column

---

## 6. Runtime Flows

### Flow 1: Authentication

```
User → RoleSelection → TeacherLogin
  → AuthContext.login()
    → ensure-demo-users (edge function)
      → Supabase Auth.signInWithPassword()
        → Auth state listener fires
          → Profile upsert (idempotent)
            → User state set
              → localStorage persisted
                → Redirect to /teacher-dashboard
```

**Key Files**: `src/contexts/AuthContext.tsx`, `supabase/functions/ensure-demo-users/index.ts`

**Invariants**:
- Demo user always exists (created by edge function)
- Profile auto-created on first auth
- Session persisted in localStorage

### Flow 2: Lesson Plan Creation (Main User Journey)

```
User → /planificacion/nuevo
  → PlanificacionWizard (4 steps)
    Step 1: Basic info (subject, level, dates, hours)
    Step 2: Competencies & units
    Step 3: Group profile (optional)
    Step 4: Teacher instructions (optional)
  → Calculate total sessions needed
  → For each session:
      → useFullSessionGeneration hook
        → supabase.functions.invoke('generate-plan-completo')
          → Edge function calls OpenAI API
            → Response: { plan_html, argumento_competencias, recursos, titulo }
          → planParser.parse() extracts sections
          → Save to sesiones_clase table
  → Save planificacion (is_saved = true)
  → Redirect to /planificacion/:id
```

**Key Files**: 
- `src/pages/PlanificacionWizard.tsx`
- `src/hooks/useFullSessionGeneration.ts`
- `supabase/functions/generate-plan-completo/index.ts`
- `src/lib/planParser.ts`

**Invariants**:
- All sessions must be generated before saving plan
- Plan must have at least one session
- Sessions linked to plan via `planificacion_id` FK

### Flow 3: AI Generation (Core Domain)

```
Input: {
  modo: 'generar' | 'regenerar',
  sesionId, orden, duracionMin,
  materia, nivel, contenidos[], competencias[], criterios[],
  perfilGrupo, estudiantes[],
  instruccionesDocente,
  unitContext (optional),
  sessionBrief (optional, teacher override)
}

Edge Function:
  1. Construct prompt with all context sections
  2. Call OpenAI API (GPT-4o-mini, temp=0.7)
  3. Retry on rate limit (3 attempts, exponential backoff)
  4. Parse JSON response
  5. Validate HTML structure
  6. Return: { plan_html, argumento_competencias, recursos, titulo }

Frontend:
  1. planParser.parse(plan_html) → { inicio, desarrollo, cierre, recursos, diferenciacion }
  2. Normalize resources (de-duplicate)
  3. Save to sesiones_clase.plan_desarrollo (JSONB)
  4. Extract and save competencies to competencias_anep[]
```

**Key Files**: `supabase/functions/generate-plan-completo/index.ts` (lines 177-265), `src/lib/planParser.ts`

**Invariants**:
- AI response must contain `<section id="plan">` with H1, H2 sections
- Session brief (if provided) takes priority over AI-generated title
- Resources are normalized and de-duplicated
- Differentiation section extracted separately (not in main sections)

---

## 7. Configuration and Environments

### Environment Variables

| Variable | Required | Location | Purpose |
|----------|----------|----------|---------|
| `VITE_SUPABASE_URL` | ✅ | `.env` (root) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | `.env` (root) | Supabase anonymous key (public) |
| `OPENAI_API_KEY` | ✅ | Supabase Dashboard | OpenAI API key for edge functions |
| `SERVICE_ROLE_KEY` | ✅ | Supabase Dashboard | Supabase service role (admin) |
| `SUPABASE_URL` | ✅ | Supabase Dashboard | Supabase URL (edge functions) |

**Validation**: Client validates env vars on startup (`src/integrations/supabase/client.ts` lines 15-33)

**Edge Function Secrets**: Set via Supabase Dashboard → Settings → Edge Functions → Secrets

### Configuration Files

- `vite.config.ts`: Build config, path aliases (`@/` → `src/`)
- `tailwind.config.ts`: Tailwind theme, custom colors, animations
- `tsconfig.json`: TypeScript compiler options (relaxed strictness)
- `supabase/config.toml`: Supabase project ID, edge function JWT settings

### Environment Detection

- `import.meta.env.DEV`: Development mode (enables debug logging, component tagger)
- `import.meta.env.PROD`: Production mode
- Debug logging: Only in DEV mode (`if (import.meta.env.DEV) console.log(...)`)

---

## 8. Operational Concerns

### Error Handling

**Frontend**:
- **Error Boundaries**: `src/components/ErrorBoundary.tsx` catches React render errors
- **Try/Catch**: All async operations wrapped in try/catch
- **User Feedback**: Toast notifications for errors (`toast({ variant: "destructive" })`)
- **Error Logging**: `console.error()` in DEV mode only

**Edge Functions**:
- **Retry Logic**: Exponential backoff for OpenAI rate limits (3 attempts, baseDelay=1000ms)
- **Error Responses**: JSON error responses with status codes
- **CORS Headers**: All edge functions include CORS headers

**Pattern**:
```typescript
try {
  // operation
} catch (error: any) {
  if (import.meta.env.DEV) {
    console.error('[CONTEXT] Error:', error);
  }
  toast({ title: "Error", description: "User-friendly message", variant: "destructive" });
}
```

### Logging

**Current State**: Console logging only (DEV mode)
- No structured logging library
- No external log aggregation service
- No log retention policy

**Pattern**: `console.log('[CONTEXT] Message')` with context prefix

**Recommendation**: Add structured logging (pino/winston) and external service (Sentry/LogRocket) for production

### Rate Limiting

**OpenAI API**:
- **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s delays)
- **Rate Limit Detection**: Checks for 429 status code
- **Location**: `supabase/functions/generate-plan-completo/index.ts` (lines 12-30)

**Supabase**:
- **RLS Policies**: Enforce user isolation (no explicit rate limiting)
- **Connection Pooling**: Managed by Supabase

**Frontend**:
- **No rate limiting**: Client-side requests not throttled
- **Recommendation**: Add request throttling for AI generation calls

### Performance

**Current State**: No performance monitoring
- No APM (Application Performance Monitoring)
- No Web Vitals tracking
- No performance budgets

**Known Bottlenecks**:
- AI generation: Sequential session generation (one at a time)
- Large plans: Many sessions = many API calls
- No caching: Plans/evaluations fetched on every page load

---

## 9. Change Playbooks

### Adding a New Page/Route

1. **Create page**: `src/pages/NewPage.tsx`
2. **Add route**: `src/App.tsx` → `AppRoutes` component
3. **Add navigation**: `src/components/AppSidebar.tsx` → `navigationItems` array
4. **Add breadcrumb** (if needed): `src/components/Breadcrumbs.tsx`

**Rules**:
- Use `ProtectedTeacherRoute` or `ProtectedStudentRoute` wrapper
- Follow existing page component structure
- Add to appropriate navigation group

### Modifying Database Schema

1. **Create migration**: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. **Add RLS policies**: Enable RLS, create policies for new tables
3. **Test locally**: `supabase db reset`
4. **Update types**: `supabase gen types typescript` → update `src/integrations/supabase/types.ts`
5. **Update application code**: Use new types, handle new columns

**Rules**:
- Never modify existing migrations
- Always include RLS policies
- Always test migration sequence
- Update TypeScript types immediately

### Adding a New Edge Function

1. **Create function**: `supabase/functions/new-function/index.ts`
2. **Configure**: `supabase/functions/new-function/config.toml` (JWT settings)
3. **Add CORS headers**: Include CORS headers in responses
4. **Deploy**: `supabase functions deploy new-function`
5. **Call from frontend**: `supabase.functions.invoke('new-function', { body: {...} })`

**Rules**:
- Use Deno runtime (not Node.js)
- Handle CORS preflight (OPTIONS requests)
- Include error handling and retry logic (if calling external APIs)
- Set secrets via Supabase Dashboard

### Modifying AI Prompt

**File**: `supabase/functions/generate-plan-completo/index.ts`

**Rules**:
- Modify prompt sections (lines 177-265)
- Maintain HTML structure requirements
- Test with different inputs
- **Warning**: Prompt changes affect all future generations (not backward compatible)

### Adding a New UI Component

1. **Use shadcn/ui** (if available): `npx shadcn-ui@latest add [component]`
2. **Create custom**: `src/components/ui/NewComponent.tsx`
3. **Follow patterns**: Use Radix UI primitives, Tailwind styling
4. **Export**: Import directly or add to index

**Rules**:
- Prefer shadcn/ui components over custom
- Use Tailwind classes (not inline styles)
- Follow existing component structure

### Modifying Authentication

**File**: `src/contexts/AuthContext.tsx`

**Rules**:
- Maintain demo user pattern (for development)
- Profile upsert must be idempotent (handle 409 conflicts)
- Session persistence in localStorage
- **Warning**: Auth changes affect all protected routes

### Changing Data Models

**Rules**:
- Update TypeScript types: `src/types/*.ts`
- Update validation schemas: `src/types/validation.ts` (if using Zod)
- Update components using the model
- Consider migration if changing database schema

### Modifying Plan Parser

**File**: `src/lib/planParser.ts`

**Rules**:
- **CRITICAL**: Maintain backward compatibility with existing saved plans
- Test with existing plan HTML from database
- Changes must not break parsing of old plans
- Add new parsing logic, don't remove old logic (unless deprecating)

---

## 10. Guardrails and Invariants

### What Must NOT Break

1. **Authentication Flow**:
   - Users must be able to log in
   - Profiles must auto-create on first login
   - Session must persist across page reloads
   - **Files**: `src/contexts/AuthContext.tsx`, `supabase/functions/ensure-demo-users/index.ts`

2. **Data Isolation**:
   - RLS policies must enforce user isolation
   - Users must only see their own data
   - **Enforced by**: Database RLS (cannot be bypassed)

3. **Plan Parser Backward Compatibility**:
   - Must parse all existing saved plans
   - HTML structure changes must be additive only
   - **File**: `src/lib/planParser.ts`

4. **Explicit Save Pattern**:
   - `is_saved = true` → appears in "Mis X" lists
   - `is_saved = false` → draft, not in lists
   - **Enforced by**: Application queries (WHERE is_saved = true)

5. **Session-Plan Relationship**:
   - Sessions must belong to a plan (FK constraint)
   - Deleting plan deletes sessions (CASCADE)
   - **Enforced by**: Database foreign key

6. **AI Generation Contract**:
   - Edge function must return: `{ plan_html, argumento_competencias, recursos, titulo }`
   - HTML must contain `<section id="plan">` with H1, H2 sections
   - **File**: `supabase/functions/generate-plan-completo/index.ts`

### Coupling Hotspots

1. **`planParser.ts` ↔ Saved Plans**:
   - Parser must understand all existing plan HTML structures
   - **Risk**: Changing parser breaks existing plans
   - **Mitigation**: Test with existing plans, maintain backward compatibility

2. **`AuthContext.tsx` ↔ All Protected Routes**:
   - All routes depend on AuthContext
   - **Risk**: Auth changes break all routes
   - **Mitigation**: Test auth flow after changes

3. **Database RLS Policies ↔ All Queries**:
   - All queries depend on RLS policies
   - **Risk**: Policy changes break queries
   - **Mitigation**: Test queries after policy changes

4. **Edge Functions ↔ Frontend Hooks**:
   - Hooks expect specific response format
   - **Risk**: Function changes break frontend
   - **Mitigation**: Maintain API contract, version functions if needed

### Legacy Areas

1. **Testing Infrastructure**: Minimal (only 1 test file)
   - **Risk**: Changes not validated by tests
   - **Recommendation**: Add test framework (Vitest/Jest)

2. **Error Monitoring**: None (console only)
   - **Risk**: Production errors not tracked
   - **Recommendation**: Add Sentry or similar

3. **Performance Monitoring**: None
   - **Risk**: Performance issues not detected
   - **Recommendation**: Add Web Vitals tracking

---

## 11. Navigation Index

### Minimum Files to Understand the System

**Start Here** (Core Architecture):
1. `src/main.tsx` - Application entry point
2. `src/App.tsx` - Routing and app structure
3. `src/integrations/supabase/client.ts` - Database client setup
4. `src/contexts/AuthContext.tsx` - Authentication

**Core Flows**:
5. `src/pages/PlanificacionWizard.tsx` - Lesson plan creation flow
6. `src/hooks/useFullSessionGeneration.ts` - AI generation orchestration
7. `supabase/functions/generate-plan-completo/index.ts` - AI generation logic
8. `src/lib/planParser.ts` - Plan parsing (critical for compatibility)

**Data Layer**:
9. `supabase/migrations/20250923163758_*.sql` - Initial schema
10. `src/integrations/supabase/types.ts` - TypeScript types

**UI Structure**:
11. `src/components/AppLayout.tsx` - Layout wrapper
12. `src/components/AppSidebar.tsx` - Navigation

**Understanding a Feature**:
- Read the page component (`src/pages/FeatureName.tsx`)
- Read related hooks (`src/hooks/useFeatureName.ts`)
- Read related components (`src/components/feature-name/`)
- Check database schema (migrations)

---

## 12. Appendix: Changes Made By Cursor

**Files Created**:
- `docs/ARCHITECTURE_SOT.md` (this file)

**Files Modified**:
- None (only documentation created)

**Methodology**:
- Read `docs/PROJECT_DEEP_DIVE.md` in full
- Resolved unknowns by inspecting repository:
  - Testing: Jest-style syntax found, but no test runner configured
  - Error handling: ErrorBoundary + try/catch + toast notifications
  - No CI/CD, Docker, or external monitoring found
- Created focused architecture document emphasizing:
  - Clear boundaries and responsibilities
  - Runtime flows and data ownership
  - Change procedures and guardrails
  - Stability over exhaustiveness

**Supporting Documentation**:
- This document is self-contained
- References concrete file paths throughout
- No additional supporting files created





