# AulaPlus v0 - Architecture Single Source of Truth (SSoT)

> **Purpose**: Compact, operational architecture reference for Cursor context. Use this as the definitive guide for all code changes.
>
> **Last Updated**: January 31, 2026  
> **Status**: Active

---

## System Description

**AulaPlus** is an AI-powered pedagogical planning and evaluation platform for Uruguayan teachers (ANEP). It's a React SPA frontend with Supabase backend (PostgreSQL + Auth + Edge Functions) that generates lesson plans and evaluations using OpenAI GPT-4o-mini. The system enforces explicit save patterns, soft deletes, and Row Level Security for user data isolation. Key domain: contemplaciones (student accommodations) system with canonical catalog, deterministic enforcement, and localStorage persistence.

---

## Repo Map

**Note**: File counts are indicative and may drift as the codebase evolves. Focus on structure and boundaries, not exact counts.

```
src/
├── pages/              # Route-level orchestration (indicative count)
├── components/         # UI components
│   ├── evaluaciones/  # Evaluation components (indicative count)
│   ├── planificacion/ # Planning components (indicative count)
│   └── ui/            # shadcn/ui primitives (indicative count)
├── hooks/             # Business logic hooks (indicative count)
├── lib/               # Pure utilities
│   └── contemplaciones/ # Contemplaciones system (indicative count)
├── contexts/          # React contexts (AuthContext)
├── integrations/      # Supabase client
├── data/              # Static data (competencies, mock groups)
├── types/             # TypeScript definitions
└── services/          # Specialized services
│   └── groupContext/ # Unified group context provider (use provider.ts)
└── utils/             # Shared utilities (groupContext deprecated, kept for backward compatibility)

supabase/
├── functions/         # Edge functions (4 core + 1 demo auxiliary: ensure-demo-users)
├── migrations/        # SQL migrations (indicative count, may drift)
└── config.toml       # Project config
```

---

## Runtime Boundaries

| Process | Technology | Port/URL | Purpose |
|---------|-----------|----------|---------|
| **Frontend Dev** | Vite | `localhost:8080` | Local development |
| **Frontend Build** | Vite | `dist/` | Static build output |
| **Supabase DB** | PostgreSQL | Supabase Cloud | Data persistence |
| **Supabase Auth** | Supabase Auth | Supabase Cloud | User authentication |
| **Edge Functions** | Deno | Supabase Cloud | Serverless AI generation |

**No background workers, no cron jobs**: All processing is synchronous.

---

## Primary Contracts

### Database Invariants

1. **Explicit Save Pattern**:
   - `is_saved = true AND saved_at IS NOT NULL` → appears in "Mis X" lists
   - `is_saved = false` → draft, hidden from lists
   - **Tables**: `planificaciones`, `evaluaciones`
   - **Enforced by**: Application queries (`WHERE is_saved = true`)

2. **Soft Delete Pattern**:
   - `deleted_at IS NULL` → active record
   - `deleted_at IS NOT NULL` → soft-deleted, filtered out
   - **Enforced by**: Application queries (`WHERE deleted_at IS NULL`)

3. **User Isolation**:
   - All tables enforce RLS: `auth.uid() = user_id`
   - `sesiones_clase` enforced via parent: `EXISTS (SELECT 1 FROM planificaciones WHERE id = planificacion_id AND user_id = auth.uid())`
   - **Enforced by**: Database RLS policies (cannot be bypassed)

4. **Session-Plan Relationship**:
   - `sesiones_clase.planificacion_id` → `planificaciones.id` (FK, CASCADE DELETE)
   - **Enforced by**: Database foreign key constraint

5. **Session Estado Enum**:
   - Values: `'backlog'`, `'planificada'`, `'dictada'`, `'omitida'`, `'pausada'`
   - **Type**: `sesion_estado` enum (migration `20250930180042`)
   - **Default**: `'backlog'` (when `fecha IS NULL`)

### Edge Function Contracts

#### `generate-plan-completo`

**Path**: `supabase/functions/generate-plan-completo/index.ts`

**Request**:
```typescript
{
  modo?: 'generar' | 'regenerar',
  sesionId?: string,
  orden: number,
  duracionMin: number,
  materia: string,
  nivel: string,
  contenidos: string[],
  competencias: string[],
  criterios: string[],
  perfilGrupo?: { tamanio: number, dominante: string, distribucion?: Record<string, number> },
  estudiantes?: Array<{ perfil?: string, ajustes?: string, contemplaciones?: string[] }>,
  instruccionesDocente?: string,
  planActual?: string,
  unitContext?: { unidadId: string, contenido: string, claseEnUnidad: number, totalClasesUnidad: number, isExtraSlot?: boolean },
  sessionBrief?: string  // Teacher-specified topic focus (PEDAGOGICALLY BINDING)
}
```

**Response**:
```typescript
{
  plan_html: string,              // HTML with <section id="plan">...</section>
  argumento_competencias: string, // AI justification for competency selection
  recursos: string[],             // Auto-extracted resources
  titulo: string                  // Extracted from H1 or sessionBrief
}
```

**Model**: `gpt-4o-mini` (no fallback)

**Retry**: 3 attempts, exponential backoff (base delay: 1000ms)

**CORS**: `Access-Control-Allow-Origin: *`

**JWT**: `verify_jwt = false` (demo mode)

#### `modify-evaluation`

**Path**: `supabase/functions/modify-evaluation/index.ts`

**Request** (planning mode):
```typescript
{
  type: 'planning',
  modification: string,
  groupContext: { subject: string, content: string[], competencies: string[], groupName: string, ... },
  unitContext?: {...},
  sessionBrief?: string,
  generation_mode?: 'legacy' | 'universal',
  evaluation_design_plan?: {
    instrumentDesignRules?: string[],
    responseOptions?: { include: boolean, optionCount: 1 | 2 | 3 },
    triggers?: { versionB: boolean, versionC: boolean }
  }
}
```

**Response**: `{ content: string, evaluationBundle?: {...} }` (plain text + optional bundle)

```typescript
{
  content: string,
  evaluationBundle?: {
    baseHtml: string,
    versionBHtml?: string | null,
    versionCHtml?: string | null,
    responseOptionsIncluded?: boolean,
    responseOptionCount?: number
  }
}
```

**Model**: `gpt-5-mini-2025-08-07` (if type === 'chat'), `gpt-4.1-2025-04-14` (otherwise)

#### `generate-bulletin-text`

**Path**: `supabase/functions/generate-bulletin-text/index.ts`

**Request**: `{ studentName: string, subject: string, evaluationResults: string, context?: string }`

**Response**: `{ bulletinText: string }`

**Model**: `gpt-4.1-2025-04-14`

#### `ensure-demo-users` (Demo Only)

**Path**: `supabase/functions/ensure-demo-users/index.ts`

**Purpose**: Auxiliary function for demo mode. Creates demo user in Supabase Auth if it doesn't exist.

**Note**: Demo-only, not used in production flows.

### Parsing Contract

**File**: `src/lib/planParser.ts`

**Function**: `parsePlan(html: string, fallbackResources?: string[]): ParsedPlan`

**Input**: HTML with structure:
```html
<section id="plan">
  <h1>Session Title</h1>
  <h2><strong>Inicio</strong></h2>
  ...
  <h2><strong>Desarrollo</strong></h2>
  ...
  <h2><strong>Cierre</strong></h2>
  ...
  <h2><strong>Diferenciación/Adaptaciones</strong></h2>
  ...
</section>
```

**Output**:
```typescript
{
  inicio: string,        // Clean HTML (no resources)
  desarrollo: string,    // Clean HTML (no resources)
  cierre: string,        // Clean HTML (no resources)
  recursos: string[],    // Normalized, de-duplicated
  diferenciacion?: string
}
```

**Backward Compatibility**: **CRITICAL** - Must parse all existing saved plans. Changes must be additive only.

---

## Guardrails (Top 10)

1. **Plan Parser Backward Compatibility** (`src/lib/planParser.ts`)
   - Must parse all existing saved plans
   - HTML structure changes must be additive only
   - **Risk**: Breaking changes lose user data

2. **Authentication Flow** (`src/contexts/AuthContext.tsx`)
   - Users must be able to log in
   - Profiles must auto-create on first login
   - Session must persist across page reloads
   - **Risk**: Auth changes break all protected routes

3. **Data Isolation** (Database RLS)
   - RLS policies must enforce user isolation
   - Users must only see their own data
   - **Risk**: Policy changes break queries

4. **Explicit Save Pattern** (Application logic)
   - `is_saved = true` → appears in "Mis X" lists
   - `is_saved = false` → draft, not in lists
   - **Risk**: Changing pattern breaks user expectations

5. **Session-Plan Relationship** (Database FK)
   - Sessions must belong to a plan (FK constraint)
   - Deleting plan deletes sessions (CASCADE)
   - **Risk**: FK changes break data integrity

6. **AI Generation Contract** (`supabase/functions/generate-plan-completo/index.ts`)
   - Must return: `{ plan_html, argumento_competencias, recursos, titulo }`
   - HTML must contain `<section id="plan">` with H1, H2 sections
   - **Risk**: Contract changes break frontend parsing

7. **Contemplaciones Catalog** (`src/lib/contemplaciones/catalog.ts`)
   - Catalog IDs must remain stable (no breaking changes)
   - Defaults versioning must be backward compatible
   - **Risk**: Catalog changes break enforcement

8. **Edge Functions ↔ Frontend Hooks**
   - Hooks expect specific response format
   - **Risk**: Function changes break frontend
   - **Mitigation**: Maintain API contract, version functions if needed

9. **Session Estado Enum** (Database enum)
   - Values: `'backlog'`, `'planificada'`, `'dictada'`, `'omitida'`, `'pausada'`
   - **Risk**: Enum changes break application logic
   - **File**: Migration `20250930180042`

10. **Group Context Loading** (`src/services/groupContext/provider.ts`)
    - Hybrid: Supabase (teacher_sugerencias) + mockData (students)
    - **Risk**: Changing loading logic breaks AI generation
    - **Future**: Migrate students to Supabase
    - **Note**: `src/utils/groupContext.ts` is deprecated but kept for backward compatibility

---

## Where to Change Things

### Add New Page/Route
1. Create: `src/pages/NewPage.tsx`
2. Add route: `src/App.tsx` → `AppRoutes`
3. Add navigation: `src/components/AppSidebar.tsx` → `navigationItems`
4. Use: `ProtectedTeacherRoute` or `ProtectedStudentRoute` wrapper

### Modify Database Schema
1. Create migration: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Add RLS policies (if new table)
3. Test: `supabase db reset`
4. Update types: `supabase gen types typescript` → `src/integrations/supabase/types.ts`
5. Update application code

**Rules**: Never modify existing migrations, always include RLS, always test sequence

### Add New Edge Function
1. Create: `supabase/functions/new-function/index.ts`
2. Configure: `supabase/functions/new-function/config.toml` (JWT settings)
3. Add CORS headers
4. Deploy: `supabase functions deploy new-function`
5. Call: `supabase.functions.invoke('new-function', { body: {...} })`

**Rules**: Use Deno runtime, handle CORS preflight, include error handling

### Modify AI Prompt
**File**: `supabase/functions/generate-plan-completo/index.ts` (lines 177-265)

**Rules**: Maintain HTML structure requirements, test with different inputs, **warning**: changes affect all future generations

### Add New Contemplación
1. Update: `src/lib/contemplaciones/catalog.ts` → Add to `CONTEMPLACIONES_CATALOG`
2. Update defaults (if needed): `src/lib/contemplaciones/defaults.ts`
3. Test enforcement: Verify reminders appear in evaluation cards
4. Update docs: `docs/CONTEMPLACIONES_CATALOG.md`

**Rules**: Use canonical ID format (`contemplacion-{number}`), define materializaciones, specify category

### Modify Plan Parser
**File**: `src/lib/planParser.ts`

**Rules**: **CRITICAL** - Maintain backward compatibility, test with existing plan HTML, changes must be additive only

---

## Current Known Gaps

1. **Demo-Only Authentication** (`src/contexts/AuthContext.tsx`)
   - Any credentials accepted (not production-ready)
   - All users share same Supabase user
   - **Evidence**: `README.md` mentions "Demo: Cualquier usuario y contraseña son válidos"

2. **No Testing Infrastructure**
   - No Jest/Vitest configured
   - One unused test file: `src/__tests__/sessionBriefMapping.test.ts`
   - **Evidence**: `package.json` has no test dependencies

3. **Brittle HTML Parsing** (`src/lib/planParser.ts`)
   - Regex-based parsing (brittle)
   - **Risk**: AI output format changes break parser
   - **Evidence**: Regex patterns in `planParser.ts`, used throughout codebase

4. **Hybrid Data Model** (`src/services/groupContext/provider.ts`)
   - Students in `mockData.ts` (not in database)
   - **Future**: Migrate to Supabase `students` table
   - **Evidence**: `provider.ts` loads from both Supabase and mockData
   - **Note**: `src/utils/groupContext.ts` is deprecated
   - **Note**: `src/utils/groupContext.ts` is deprecated

5. **No Structured Logging**
   - Console logs only (DEV mode)
   - No external log aggregation
   - **Evidence**: No logging library in `package.json`

6. **No Error Tracking**
   - No Sentry/LogRocket
   - Basic error boundaries only
   - **Evidence**: `src/components/ErrorBoundary.tsx` is basic, no external service

---

## Environment Variables

| Variable | Required | Location | Purpose |
|----------|----------|----------|---------|
| `VITE_SUPABASE_URL` | ✅ | `.env` (root) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | `.env` (root) | Supabase anonymous key (public) |
| `OPENAI_API_KEY` | ✅ | Supabase Dashboard | OpenAI API key for edge functions |
| `SERVICE_ROLE_KEY` | ✅ | Supabase Dashboard | Supabase service role (admin) |

**Validation**: Client validates env vars on startup (`src/integrations/supabase/client.ts`)

---

## Key File References

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

**Contemplaciones**:
- `src/lib/contemplaciones/catalog.ts` - Canonical catalog
- `src/lib/contemplaciones/enforcement.ts` - Deterministic enforcement
- `src/lib/contemplaciones/storage.ts` - localStorage persistence

---

**End of SSoT Document**

