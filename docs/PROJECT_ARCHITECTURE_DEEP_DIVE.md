# AulaPlus v0 - Project Architecture Deep Dive

> **Purpose**: Complete, repository-derived explanation of the project's architecture and implementation.  
> **Last Updated**: January 26, 2026  
> **Source**: Repository code, configs, docs, and migrations

---

## 1. Project Overview

### What the Product Does

**AulaPlus** is an AI-powered pedagogical planning and evaluation platform designed for Uruguayan teachers (ANEP - Administración Nacional de Educación Pública). The system helps teachers:

- **Generate lesson plans** using AI (OpenAI GPT-4o-mini) with structured content aligned to ANEP competencies
- **Create evaluations** with automatic rubric generation and student accommodation enforcement
- **Manage class sessions** with calendar-based planning, unit sequencing, and session state tracking
- **Enforce student accommodations** (contemplaciones) through a canonical catalog system with deterministic enforcement
- **Track competencies** across planning and evaluation workflows

### Users

- **Primary**: Teachers (profesores) - create plans, evaluations, manage groups
- **Secondary**: Students (estudiantes) - view diagnostic results (limited functionality in current version)

### Major Capabilities

1. **AI-Powered Lesson Planning**
   - Multi-step wizard for creating course periods (planificaciones)
   - Automatic session generation with unit-based sequencing
   - HTML plan parsing with resource extraction
   - Session brief override for teacher-specified topic focus

2. **Evaluation Generation**
   - Group-based evaluation creation with competency selection
   - Automatic rubric generation
   - Student accommodation enforcement (contemplaciones)
   - Version personalization for different student needs

3. **Contemplaciones System**
   - Canonical catalog of 26 accommodations (1-26, with #9 and #22 unified)
   - Deterministic enforcement in evaluations and lesson plans
   - localStorage persistence for student-specific accommodations
   - Materialization in UI (reminders, design changes, differentiation sections)

4. **Data Management**
   - Explicit save pattern (drafts vs. saved items)
   - Soft delete for recovery
   - Row Level Security (RLS) for user data isolation
   - Hybrid data model (Supabase for teacher data, mockData for students - migration pending)

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React SPA)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Pages      │  │  Components   │  │    Hooks     │     │
│  │  (13 files)  │  │  (129 files) │  │  (7 files)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Contexts (AuthContext)                       │  │
│  │         Utils (groupContext, planParser)             │  │
│  │         Lib (contemplaciones, validators)             │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        │ HTTP/REST
                        │
┌───────────────────────┴──────────────────────────────────────┐
│              Supabase Backend (Cloud)                          │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │   PostgreSQL      │  │  Edge Functions  │                │
│  │   (23 migrations) │  │  (4 functions)    │                │
│  │                   │  │                  │                │
│  │  - planificaciones│  │  - generate-plan-│                │
│  │  - sesiones_clase │  │    completo      │                │
│  │  - evaluaciones   │  │  - modify-eval- │                │
│  │  - grupos         │  │    uation       │                │
│  │  - profiles       │  │  - generate-     │                │
│  │  - RLS policies   │  │    bulletin-text │                │
│  └──────────────────┘  │  - ensure-demo-  │                │
│                        │    users          │                │
│                        └──────────────────┘                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Supabase Auth (Demo Mode)                    │  │
│  │         - JWT verification disabled                   │  │
│  │         - Shared demo user for all teachers           │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        │ API Calls
                        │
┌───────────────────────┴──────────────────────────────────────┐
│              External Services                                 │
│  ┌──────────────────────────────────────────────────────┐    │
│  │         OpenAI API (GPT-4o-mini, GPT-4.1, etc.)     │    │
│  │         - Lesson plan generation                     │    │
│  │         - Evaluation modification                    │    │
│  │         - Bulletin text generation                  │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack & Tooling

### Languages & Frameworks

- **Frontend Language**: TypeScript (5.5.3)
- **Frontend Framework**: React 18.3.1
- **Backend Runtime**: Deno (for Edge Functions)
- **Database**: PostgreSQL (via Supabase)

### Build Tooling

- **Build Tool**: Vite 5.4.1
- **React Plugin**: `@vitejs/plugin-react-swc` (SWC for fast compilation)
- **Package Manager**: npm (package-lock.json present, bun.lockb also exists)
- **TypeScript Config**: 
  - `tsconfig.json` (base config with path aliases)
  - `tsconfig.app.json` (app-specific)
  - `tsconfig.node.json` (node-specific)

### Linting & Formatting

- **Linter**: ESLint 9.9.0
- **ESLint Plugins**:
  - `eslint-plugin-react-hooks` (React Hooks rules)
  - `eslint-plugin-react-refresh` (Fast Refresh support)
  - `typescript-eslint` (TypeScript-specific rules)
- **Config**: `eslint.config.js` (flat config format)
- **Formatting**: No Prettier config found (likely using editor defaults)

### Testing Frameworks

**Status**: No testing infrastructure configured

- No Jest, Vitest, or other test runner in `package.json`
- One unused test file: `src/__tests__/sessionBriefMapping.test.ts`
- **Evidence**: `package.json` has no test dependencies or scripts

### Dev/Prod Environments

**Development**:
- **Server**: Vite dev server
- **Port**: 8080 (configured in `vite.config.ts`)
- **Host**: `::` (all interfaces)
- **Hot Reload**: Enabled via React Fast Refresh
- **Dev Tools**: 
  - `lovable-tagger` component tagger (dev mode only)
  - Console logging for mockGroups exposure (`window.__mockGroups`)

**Production**:
- **Build Output**: `dist/` directory (static files)
- **Build Command**: `npm run build` (Vite production build)
- **Preview**: `npm run preview` (local preview of production build)
- **Deployment**: Static hosting (no server-side rendering)

### CI/CD

**Status**: No CI/CD configuration found in repository

- No `.github/workflows/`, `.gitlab-ci.yml`, or similar files
- Deployment appears to be manual or handled by external platform (Lovable)

---

## 3. Repository Structure

### Top-Level Folders

```
aulaplus-v0/
├── src/                    # Frontend source code
├── supabase/               # Backend (database + edge functions)
├── public/                 # Static assets
├── docs/                   # Documentation (127 markdown files)
├── dist/                   # Build output (gitignored)
├── node_modules/          # Dependencies
├── tools/                  # Development tools/docs
├── refactor/              # Refactoring notes/documentation
└── [config files]         # Root-level configs
```

### Key Modules/Packages

#### `src/` - Frontend Application

```
src/
├── pages/              # Route-level components (13 files)
│   ├── PlanificacionWizard.tsx      # Multi-step plan creation
│   ├── PlanificacionWorkspace.tsx   # Plan editing workspace
│   ├── EvaluacionesGrupo.tsx        # Evaluation creation
│   ├── MisPlanificaciones.tsx       # Saved plans list
│   ├── MisEvaluaciones.tsx          # Saved evaluations list
│   └── [8 more pages]
│
├── components/        # UI components (129 files)
│   ├── ui/            # shadcn/ui primitives (63 files)
│   ├── planificacion/ # Planning-specific (15 files)
│   ├── evaluaciones/  # Evaluation-specific (13 files)
│   └── [38 other components]
│
├── hooks/             # Business logic hooks (7 files)
│   ├── useFullSessionGeneration.ts  # AI generation orchestration
│   ├── usePlanificacionWizard.ts    # Wizard state management
│   ├── useAIPlanification.ts        # AI plan generation
│   └── [4 more hooks]
│
├── lib/               # Pure utilities
│   ├── contemplaciones/  # Contemplaciones system (9 files)
│   │   ├── catalog.ts         # Canonical catalog (26 items)
│   │   ├── enforcement.ts     # Deterministic enforcement
│   │   ├── storage.ts         # localStorage persistence
│   │   └── [6 more files]
│   ├── planParser.ts          # HTML plan parsing (CRITICAL)
│   ├── competencyExtractor.ts # Competency extraction
│   └── [10 more utilities]
│
├── contexts/          # React contexts
│   └── AuthContext.tsx        # Authentication state
│
├── integrations/     # External service clients
│   └── supabase/
│       ├── client.ts         # Supabase client initialization
│       └── types.ts          # Generated TypeScript types
│
├── data/             # Static data
│   ├── mockData.ts           # Mock student/group data
│   ├── competencias.ts       # ANEP competencies
│   ├── competenciasCiudadania.ts
│   ├── competenciasLiteratura.ts
│   └── catalogo.ts
│
├── types/            # TypeScript type definitions
│   ├── planificacion.ts     # Planning domain types
│   ├── groupContextForAI.ts # AI context types
│   ├── calendario.ts        # Calendar types
│   └── validation.ts        # Validation types
│
├── utils/            # Shared utilities
│   ├── groupContext.ts      # Group context loading (DEPRECATED wrapper)
│   └── resolveMockGroup.ts  # Mock group resolution
│
├── services/         # Service layer
│   └── groupContext/
│       └── provider.ts      # Unified group context provider
│
├── main.tsx          # Application entry point
└── App.tsx           # Root component + routing
```

#### `supabase/` - Backend

```
supabase/
├── functions/        # Edge Functions (Deno runtime)
│   ├── generate-plan-completo/
│   │   └── index.ts  # Main AI plan generation
│   ├── modify-evaluation/
│   │   └── index.ts  # Evaluation modification
│   ├── generate-bulletin-text/
│   │   └── index.ts  # Bulletin text generation
│   └── ensure-demo-users/
│       ├── index.ts  # Demo user setup
│       └── config.toml
│
├── migrations/       # Database migrations (23 files)
│   ├── 20250923163758_*.sql  # Initial schema
│   ├── 20251219163000_*.sql  # Explicit save pattern
│   ├── 20251222000000_*.sql  # Evaluaciones explicit save
│   └── [20 more migrations]
│
└── config.toml       # Supabase project configuration
```

### Monorepo/Workspaces Structure

**Status**: Single-package repository (not a monorepo)

- No `packages/`, `apps/`, or `workspaces` configuration
- Single `package.json` at root
- All code in `src/` directory

---

## 4. Architecture & Boundaries

### Architectural Style

**Pattern**: **Layered Architecture with Feature-Based Organization**

The application follows a layered structure with clear separation:

1. **Presentation Layer**: `src/pages/`, `src/components/`
2. **Business Logic Layer**: `src/hooks/`, `src/lib/`
3. **Data Access Layer**: `src/integrations/supabase/`, `src/utils/groupContext.ts`
4. **Infrastructure Layer**: `supabase/` (database, edge functions)

### Core Boundaries & Responsibilities

#### 1. **UI Layer** (`src/pages/`, `src/components/`)

**Responsibilities**:
- Render user interface
- Handle user interactions
- Display data from hooks/contexts
- Form validation (via `react-hook-form` + `zod`)

**Boundaries**:
- **DOES NOT**: Direct database queries (uses hooks/contexts)
- **DOES NOT**: Business logic (delegates to hooks)
- **DOES NOT**: AI generation (calls edge functions via hooks)

#### 2. **Business Logic Layer** (`src/hooks/`, `src/lib/`)

**Responsibilities**:
- Orchestrate data flows
- Transform data between layers
- Enforce business rules (contemplaciones, validation)
- Coordinate AI generation workflows

**Key Modules**:
- `useFullSessionGeneration.ts`: Orchestrates multi-session AI generation
- `planParser.ts`: Parses AI-generated HTML (CRITICAL - backward compatibility)
- `contemplaciones/`: Enforces student accommodations deterministically

**Boundaries**:
- **DOES NOT**: Direct Supabase calls (uses client from integrations)
- **DOES NOT**: UI rendering (returns data/state)

#### 3. **Data Access Layer** (`src/integrations/`, `src/utils/`)

**Responsibilities**:
- Supabase client initialization
- Query construction
- Data normalization
- Group context loading

**Key Files**:
- `src/integrations/supabase/client.ts`: Supabase client singleton
- `src/utils/groupContext.ts`: Group data loading (DEPRECATED - use `services/groupContext/provider.ts`)

**Boundaries**:
- **DOES NOT**: Business logic (pure data access)
- **DOES NOT**: UI concerns

#### 4. **Infrastructure Layer** (`supabase/`)

**Responsibilities**:
- Database schema and migrations
- Edge functions (AI generation)
- Authentication
- Row Level Security policies

**Boundaries**:
- **DOES NOT**: Frontend-specific logic
- **DOES NOT**: UI rendering

### Dependency Direction

```
UI Layer (pages/components)
    ↓ depends on
Business Logic (hooks/lib)
    ↓ depends on
Data Access (integrations/utils)
    ↓ depends on
Infrastructure (supabase)
```

**Enforcement**: TypeScript types and import paths enforce direction. No circular dependencies observed.

### Where Business Logic Lives vs UI vs Infrastructure

| Concern | Location | Examples |
|---------|----------|----------|
| **UI Rendering** | `src/pages/`, `src/components/` | `PlanificacionWizard.tsx`, `AppSidebar.tsx` |
| **Business Logic** | `src/hooks/`, `src/lib/` | `useFullSessionGeneration.ts`, `planParser.ts`, `contemplaciones/enforcement.ts` |
| **Data Access** | `src/integrations/`, `src/utils/` | `supabase/client.ts`, `groupContext.ts` |
| **Infrastructure** | `supabase/` | Migrations, Edge Functions, RLS policies |
| **State Management** | React Context + Hooks | `AuthContext.tsx`, `useState` in hooks |
| **Routing** | `src/App.tsx` | React Router configuration |

---

## 5. Application Runtime Flow

### Bootstrapping / Entry Points

**Entry Point**: `src/main.tsx`

```typescript
// 1. Import React and App
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

// 2. Expose mockGroups for dev inspection (DEV only)
if (import.meta.env.DEV) {
  (window as any).__mockGroups = mockGroups;
}

// 3. Render App to DOM
createRoot(document.getElementById("root")!).render(<App />);
```

**App Initialization**: `src/App.tsx`

```typescript
// 1. Create QueryClient (React Query for data fetching)
const queryClient = new QueryClient();

// 2. Wrap app with providers (outer to inner):
<BrowserRouter>           // React Router
  <QueryClientProvider>   // React Query
    <AuthProvider>        // Authentication context
      <TooltipProvider>  // UI tooltips
        <AppRoutes />     // Route definitions
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
</BrowserRouter>
```

### Request Lifecycle (Frontend SPA)

**No traditional backend requests** - this is a Single Page Application (SPA) that makes API calls to Supabase:

1. **User Interaction** → Component event handler
2. **Hook/Context Call** → Business logic hook (e.g., `useFullSessionGeneration`)
3. **Supabase Client Call** → `supabase.from('table').select()` or `supabase.functions.invoke()`
4. **Network Request** → HTTPS to Supabase Cloud
5. **Response Handling** → Hook updates state
6. **UI Re-render** → React re-renders affected components

### Navigation/Render Lifecycle

**Routing**: React Router v6 (`react-router-dom`)

**Route Structure**:
- **Public Routes**: `/`, `/teacher-login`, `/student-login`
- **Protected Teacher Routes**: `/teacher-dashboard`, `/planificacion/*`, `/evaluaciones/*`, etc.
- **Protected Student Routes**: `/student-diagnostic`

**Route Protection**:
- `ProtectedTeacherRoute`: Checks `isAuthenticated` and `user.role === 'teacher'`
- `ProtectedStudentRoute`: Checks `isAuthenticated` and `user.role === 'student'`
- Unauthenticated users redirected to `/`

**Render Flow**:
1. Route matches → Page component renders
2. Page component calls hooks (e.g., `useFullSessionGeneration`)
3. Hooks fetch data from Supabase
4. Data flows to components via props/state
5. Components render UI

### State Management Approach

**Pattern**: **React Hooks + Context API** (no Redux/Zustand)

**State Management Layers**:

1. **Global State**: `AuthContext` (user, session, auth methods)
2. **Server State**: React Query (`@tanstack/react-query`) for Supabase data
3. **Local Component State**: `useState` in components/hooks
4. **Form State**: `react-hook-form` for form management
5. **Persistence**: 
   - `localStorage` for auth user (demo mode)
   - `localStorage` for contemplaciones (via `contemplaciones/storage.ts`)
   - Supabase for all persistent data

**No Global State Management Library**: Redux, Zustand, or similar not used.

### Error Handling Patterns

**Error Boundaries**: 
- `src/components/ErrorBoundary.tsx` (basic implementation)
- No external error tracking (Sentry/LogRocket)

**Error Handling in Code**:
- **Try-catch blocks** in async functions (hooks, edge functions)
- **Error state** in hooks (`useState<string | null>(error)`)
- **Toast notifications** for user-facing errors (via `sonner`)
- **Console logging** in DEV mode

**Edge Function Error Handling**:
- CORS error responses
- Retry logic with exponential backoff (in `generate-plan-completo`)
- Error messages returned in response body

---

## 6. Data Layer

### Persistence Choices

**Primary Database**: PostgreSQL (via Supabase)

**ORM/Query Library**: 
- **Supabase JS Client** (`@supabase/supabase-js`)
- **No ORM**: Direct Supabase client queries (PostgREST API)
- **Type Safety**: Generated TypeScript types from schema (`src/integrations/supabase/types.ts`)

**Migration Tool**: Supabase CLI migrations (`supabase/migrations/`)

### Models/Entities

**Core Tables**:

1. **`planificaciones`** (Course Periods)
   - `id`, `user_id`, `nivel`, `materia`, `fecha_inicio`, `fecha_fin`
   - `is_saved`, `saved_at`, `deleted_at` (explicit save pattern)
   - `unidades_didacticas` (JSONB), `configuracion_horario` (JSONB)
   - **Relationships**: One-to-many with `sesiones_clase`

2. **`sesiones_clase`** (Class Sessions)
   - `id`, `planificacion_id` (FK → planificaciones), `fecha`, `duracion_minutos`
   - `competencias_anep`, `contenidos_anep`, `criterios_logro_anep` (arrays)
   - `plan_desarrollo` (JSONB), `recursos` (array)
   - `estado` (enum: 'backlog', 'planificada', 'dictada', 'omitida', 'pausada')
   - `session_brief` (teacher-specified topic focus)
   - **Relationships**: Many-to-one with `planificaciones` (CASCADE DELETE)

3. **`evaluaciones`** (Evaluations)
   - `id`, `user_id`, `nombre`, `materia`, `grupo_id`, `nivel`
   - `is_saved`, `saved_at`, `deleted_at` (explicit save pattern)
   - `competencias_anep`, `contenidos`, `criterios_logro` (arrays)
   - `evaluacion_generada` (JSONB), `rubrica` (JSONB)
   - **Relationships**: Independent (no FK to planificaciones)

4. **`grupos`** (Groups)
   - `id` (TEXT, e.g., "9no 1"), `name`, `year`, `section`, `user_id`
   - `teacher_sugerencias` (JSONB: `{ aula?, evaluaciones?, otras? }`)
   - **Relationships**: One-to-many with planificaciones/evaluaciones (via `grupo_id` TEXT)

5. **`profiles`** (User Profiles)
   - `user_id` (FK → auth.users), `display_name`, `role`
   - Auto-created on first login (via `AuthContext`)

6. **`calendario_eventos`** (Calendar Events)
   - `id`, `fecha`, `titulo`, `alcance`

**Hybrid Data Model**:
- **Supabase**: Teacher data (planificaciones, evaluaciones, grupos, profiles)
- **Mock Data**: Student data (`src/data/mockData.ts`) - **Future migration planned**

### Query Patterns

**Common Query Patterns**:

1. **User-Scoped Queries** (RLS enforced):
```typescript
supabase
  .from('planificaciones')
  .select('*')
  .eq('user_id', userId)  // Redundant (RLS enforces), but explicit
  .eq('is_saved', true)
  .is('deleted_at', null)
```

2. **Filtered Lists** (saved items only):
```typescript
supabase
  .from('planificaciones')
  .select('*')
  .eq('is_saved', true)
  .is('deleted_at', null)
  .order('saved_at', { ascending: false })
```

3. **Related Data** (sessions for a plan):
```typescript
supabase
  .from('sesiones_clase')
  .select('*')
  .eq('planificacion_id', planId)
  .order('fecha', { ascending: true })
```

4. **Array Field Queries** (GIN indexes):
```typescript
supabase
  .from('evaluaciones')
  .select('*')
  .contains('competencias_anep', ['competencia-id'])
```

### Caching

**Status**: No explicit caching layer

- **React Query**: Provides automatic caching for Supabase queries (default: 5 minutes stale time)
- **No Redis/Memcached**: All data fetched from Supabase
- **localStorage**: Used for contemplaciones and auth user (demo mode only)

---

## 7. API / Integration Surface

### Internal APIs (Edge Functions)

**Edge Functions** (Deno runtime, deployed to Supabase Cloud):

#### 1. `generate-plan-completo`

**Path**: `supabase/functions/generate-plan-completo/index.ts`

**Purpose**: Generate complete lesson plan HTML using OpenAI

**Request Contract**:
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
  sessionBrief?: string  // Teacher-specified topic focus
}
```

**Response Contract**:
```typescript
{
  plan_html: string,              // HTML with <section id="plan">...</section>
  argumento_competencias: string, // AI justification for competency selection
  recursos: string[],             // Auto-extracted resources
  titulo: string                  // Extracted from H1 or sessionBrief
}
```

**Model**: `gpt-4o-mini` (no fallback)

**Retry**: 3 attempts, exponential backoff (base delay: 2000ms)

**CORS**: `Access-Control-Allow-Origin: *`

**JWT**: `verify_jwt = false` (demo mode)

#### 2. `modify-evaluation`

**Path**: `supabase/functions/modify-evaluation/index.ts`

**Purpose**: Modify evaluation content using AI

**Request** (planning mode):
```typescript
{
  type: 'planning',
  modification: string,
  groupContext: { subject: string, content: string[], competencies: string[], groupName: string, ... },
  unitContext?: {...},
  sessionBrief?: string
}
```

**Response**: `{ content: string }` (plain text)

**Model**: `gpt-5-mini-2025-08-07` (if type === 'chat'), `gpt-4.1-2025-04-14` (otherwise)

#### 3. `generate-bulletin-text`

**Path**: `supabase/functions/generate-bulletin-text/index.ts`

**Purpose**: Generate bulletin text for student evaluations

**Request**: `{ studentName: string, subject: string, evaluationResults: string, context?: string }`

**Response**: `{ bulletinText: string }`

**Model**: `gpt-4.1-2025-04-14`

#### 4. `ensure-demo-users`

**Path**: `supabase/functions/ensure-demo-users/index.ts`

**Purpose**: Ensure demo users exist in Supabase Auth (demo mode setup)

**Called by**: `AuthContext` on initialization

### External Services

**OpenAI API**:
- **Integration**: Direct API calls from Edge Functions
- **API Key**: Stored in Supabase Dashboard (env var: `OPENAI_API_KEY`)
- **Models Used**:
  - `gpt-4o-mini` (primary for plan generation)
  - `gpt-4.1-2025-04-14` (fallback for evaluations, bulletin text)
  - `gpt-5-mini-2025-08-07` (for chat-type modifications)

**Supabase Services**:
- **Auth**: User authentication (demo mode - shared user)
- **Database**: PostgreSQL with PostgREST API
- **Storage**: Not used in current implementation
- **Realtime**: Not used in current implementation

### Integration Client Configuration

**Supabase Client**: `src/integrations/supabase/client.ts`

```typescript
export const supabase = createClient<Database>(
  SUPABASE_URL,      // From VITE_SUPABASE_URL
  SUPABASE_ANON_KEY, // From VITE_SUPABASE_ANON_KEY
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
```

**Environment Variables**:
- `VITE_SUPABASE_URL`: Supabase project URL (required)
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key (required)
- Validated on client initialization (throws if missing)

**Edge Function Invocation**:
```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { ...requestData }
});
```

---

## 8. AuthN/AuthZ & Security

### Authentication Method(s)

**Primary**: Supabase Auth (Email/Password)

**Current Implementation**: **Demo Mode** (not production-ready)

**Demo Mode Characteristics**:
- **Shared User**: All teachers share same Supabase user (`demo.teacher@example.com`)
- **No Real Validation**: Any non-empty username/password accepted in UI
- **Auto-Login**: `AuthContext` automatically signs in demo user in background
- **JWT Verification**: Disabled in Edge Functions (`verify_jwt = false`)

**Evidence**:
- `src/contexts/AuthContext.tsx`: Lines 36-38 (demo credentials), 149-183 (login accepts any credentials)
- `supabase/config.toml`: `verify_jwt = false` for edge functions
- `README.md`: Mentions "Demo: Cualquier usuario y contraseña son válidos"

**Future**: Production auth should:
- Use real Supabase Auth with proper user creation
- Enable JWT verification in edge functions
- Implement proper role-based access control

### Authorization Model

**Row Level Security (RLS)**: Primary authorization mechanism

**RLS Policies** (enforced at database level):

1. **User Isolation**:
   - All tables: `auth.uid() = user_id` (users only see their own data)
   - `sesiones_clase`: Enforced via parent (`EXISTS (SELECT 1 FROM planificaciones WHERE id = planificacion_id AND user_id = auth.uid())`)

2. **Explicit Save Pattern**:
   - `planificaciones`: Only `is_saved = true AND deleted_at IS NULL` visible in SELECT policies
   - `evaluaciones`: Same pattern

3. **Policy Types**:
   - **SELECT**: Users can view their own saved, non-deleted records
   - **INSERT**: Users can create records with their own `user_id`
   - **UPDATE**: Users can update their own records
   - **DELETE**: Soft delete via `deleted_at` (UPDATE policy covers this)

**Frontend Authorization**:
- **Route Protection**: `ProtectedTeacherRoute`, `ProtectedStudentRoute` (check `user.role`)
- **Component-Level**: Conditional rendering based on `useAuth()` hook

**No Role-Based RLS**: All authenticated users have same permissions (demo mode limitation)

### Secrets/Config Management Patterns

**Frontend Secrets**:
- **Location**: `.env` file (root directory)
- **Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Validation**: Client validates on startup (throws if missing)
- **Security**: Anon key is public (safe to expose in frontend)

**Backend Secrets** (Edge Functions):
- **Location**: Supabase Dashboard (Environment Variables)
- **Variables**: `OPENAI_API_KEY`, `SERVICE_ROLE_KEY`
- **Access**: Only accessible in Edge Functions (Deno runtime)

**No Secret Management Service**: No Vault, AWS Secrets Manager, etc.

---

## 9. UI Layer

### Component Organization

**Structure**: Feature-based + UI primitives

```
src/components/
├── ui/                    # shadcn/ui primitives (63 files)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── [60 more primitives]
│
├── planificacion/         # Planning feature components (15 files)
│   ├── CalendarioSesiones.tsx
│   ├── EditorSesionNuevo.tsx
│   ├── UnidadDidacticaBuilder.tsx
│   └── [12 more]
│
├── evaluaciones/          # Evaluation feature components (13 files)
│   ├── SmartRubric.tsx
│   ├── VersionPersonalization.tsx
│   └── [11 more]
│
└── [38 other components]  # Feature-specific or shared
    ├── AppSidebar.tsx
    ├── TeacherDashboard.tsx
    └── [36 more]
```

### Design System / UI Kit Usage

**Primary UI Library**: **shadcn/ui** (Radix UI + Tailwind CSS)

**Components**: 63 UI primitives in `src/components/ui/`

**Styling**: **Tailwind CSS** (utility-first CSS framework)

**Tailwind Configuration**: `tailwind.config.ts`
- Custom color system (HSL-based)
- Custom spacing, typography, animations
- Dark mode support (`darkMode: ["class"]`)

**Design Tokens**: CSS variables in `src/index.css` (HSL colors, spacing, etc.)

**No Separate Design System Package**: All components in repository

### Routing Strategy

**Library**: React Router v6 (`react-router-dom`)

**Route Definition**: `src/App.tsx` (centralized)

**Route Types**:
- **Public**: `/`, `/teacher-login`, `/student-login`
- **Protected Teacher**: `/teacher-dashboard`, `/planificacion/*`, `/evaluaciones/*`, `/mis-planificaciones`, `/mis-evaluaciones`, `/comunicaciones`
- **Protected Student**: `/student-diagnostic`

**Route Protection**: HOC pattern (`ProtectedTeacherRoute`, `ProtectedStudentRoute`)

**Layout**: `AppLayout` component wraps protected routes (provides sidebar, breadcrumbs)

**No Code Splitting**: All routes loaded upfront (no lazy loading observed)

### Forms/Validation Patterns

**Form Library**: **React Hook Form** (`react-hook-form`)

**Validation Library**: **Zod** (`zod`)

**Resolver**: `@hookform/resolvers` (Zod resolver for React Hook Form)

**Pattern**:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  materia: z.string().min(1, 'Required'),
  // ...
});

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { ... }
});
```

**Form Components**: Custom form components in `src/components/ui/form.tsx` (shadcn/ui pattern)

---

## 10. Cross-Cutting Concerns

### Logging/Observability

**Status**: **Minimal logging infrastructure**

**Current Approach**:
- **Console Logging**: `console.log`, `console.error` (DEV mode only)
- **No Structured Logging**: No Winston, Pino, or similar
- **No Log Aggregation**: No external service (Datadog, LogRocket, etc.)
- **No APM**: No performance monitoring

**Logging Locations**:
- `src/integrations/supabase/client.ts`: Env var validation logs
- `src/contexts/AuthContext.tsx`: Auth state changes (DEV only)
- `src/hooks/useFullSessionGeneration.ts`: Generation progress (DEV only)
- Edge Functions: Console logs (visible in Supabase Dashboard)

**Future**: Structured logging recommended for production

### Feature Flags

**Status**: **No feature flag system**

- No LaunchDarkly, Unleash, or similar
- No environment-based feature toggles
- Features controlled by code deployment only

### Localization

**Status**: **No internationalization (i18n)**

- All text in Spanish (hardcoded)
- No `react-i18next`, `i18next`, or similar
- No language switching

**Future**: i18n may be needed if expanding to other countries

### Background Jobs/Queues

**Status**: **No background jobs or queues**

- All processing is **synchronous**
- No cron jobs, scheduled tasks, or queue workers
- AI generation happens synchronously in Edge Functions (with retries)

**Evidence**: `docs/ARCHITECTURE_SSoT.md` states: "No background workers, no cron jobs: All processing is synchronous."

---

## 11. Testing Strategy

### Unit/Integration/E2E Approach

**Status**: **No testing infrastructure configured**

**Evidence**:
- `package.json`: No test dependencies (Jest, Vitest, React Testing Library, etc.)
- No test scripts in `package.json`
- No test configuration files (`.jest.config.js`, `vitest.config.ts`, etc.)

**One Unused Test File**:
- `src/__tests__/sessionBriefMapping.test.ts` (exists but not runnable without test framework)

### Where Tests Would Live

**Convention** (if tests were added):
- Unit tests: `src/**/*.test.ts` or `src/**/*.spec.ts`
- Integration tests: `src/**/*.integration.test.ts`
- E2E tests: `e2e/` or `tests/e2e/` (would need Playwright/Cypress)

### How to Run Tests

**Current**: Not applicable (no tests)

**If Added**: Would need:
1. Install test framework (Vitest recommended for Vite)
2. Add test script to `package.json`: `"test": "vitest"`
3. Configure test environment

### Test Data Strategy

**Current**: No test data management

**Mock Data**: `src/data/mockData.ts` (used for development, not testing)

**Future**: Would need:
- Test fixtures for database
- Mock Supabase client for unit tests
- Seed scripts for integration tests

---

## 12. Configuration & Environments

### Environment Variables

**Frontend Variables** (`.env` file at root):

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key (public) | `eyJhbGc...` |

**Backend Variables** (Supabase Dashboard):

| Variable | Required | Purpose | Location |
|----------|----------|---------|----------|
| `OPENAI_API_KEY` | ✅ | OpenAI API key for edge functions | Supabase Dashboard |
| `SERVICE_ROLE_KEY` | ✅ | Supabase service role (admin) | Supabase Dashboard |

**Validation**: Client validates frontend env vars on startup (`src/integrations/supabase/client.ts`)

**No Environment-Specific Configs**: No `.env.development`, `.env.production` files (uses single `.env`)

### Example Config Files

**`vite.config.ts`**:
- Dev server port: 8080
- Host: `::` (all interfaces)
- Path alias: `@/*` → `./src/*`
- React plugin: SWC for fast compilation

**`tsconfig.json`**:
- Base config with path aliases
- References: `tsconfig.app.json`, `tsconfig.node.json`
- TypeScript options: `noImplicitAny: false`, `strictNullChecks: false` (relaxed)

**`tailwind.config.ts`**:
- Custom color system (HSL-based)
- Custom animations, spacing, typography
- Dark mode: class-based

**`eslint.config.js`**:
- Flat config format
- React Hooks rules
- TypeScript ESLint rules

**`supabase/config.toml`**:
- Project ID: `srlrbuphsogwgymqywhe`
- Edge function JWT settings: `verify_jwt = false` (demo mode)

---

## 13. Known Risks / Smells / TODOs

### Technical Debt Signals

#### 1. **Demo-Only Authentication** ⚠️ **HIGH RISK**

**Location**: `src/contexts/AuthContext.tsx`

**Issue**: 
- All users share same Supabase user
- No real authentication validation
- JWT verification disabled in edge functions

**Risk**: Not production-ready, security vulnerability

**Mitigation**: Implement proper Supabase Auth with user creation, enable JWT verification

**Evidence**: 
- Lines 36-38: Demo credentials
- Lines 149-183: Login accepts any credentials
- `supabase/config.toml`: `verify_jwt = false`

#### 2. **No Testing Infrastructure** ⚠️ **MEDIUM RISK**

**Location**: Entire codebase

**Issue**: No tests, no test framework configured

**Risk**: Regression risk, difficult to refactor safely

**Mitigation**: Add Vitest, write unit tests for critical paths (planParser, contemplaciones enforcement)

**Evidence**: `package.json` has no test dependencies

#### 3. **Brittle HTML Parsing** ⚠️ **HIGH RISK**

**Location**: `src/lib/planParser.ts`

**Issue**: Regex-based HTML parsing (brittle, breaks if AI output format changes)

**Risk**: Breaking changes lose user data (backward compatibility critical)

**Mitigation**: 
- Consider HTML parser library (cheerio, jsdom)
- Add comprehensive tests with existing plan HTML
- Document HTML structure contract clearly

**Evidence**: Regex patterns throughout `planParser.ts` (lines 36-822)

#### 4. **Hybrid Data Model** ⚠️ **MEDIUM RISK**

**Location**: `src/utils/groupContext.ts`, `src/data/mockData.ts`

**Issue**: Students in mockData (not in database), teacher data in Supabase

**Risk**: Inconsistency, difficult to query students, no student persistence

**Mitigation**: Migrate students to Supabase `students` table (planned future work)

**Evidence**: 
- `groupContext.ts` loads from both Supabase and mockData
- `mockData.ts` contains student data

#### 5. **No Structured Logging** ⚠️ **LOW RISK**

**Location**: Entire codebase

**Issue**: Console logs only, no external log aggregation

**Risk**: Difficult to debug production issues, no observability

**Mitigation**: Add structured logging (Winston, Pino), integrate with log aggregation service

**Evidence**: No logging library in `package.json`

#### 6. **No Error Tracking** ⚠️ **MEDIUM RISK**

**Location**: `src/components/ErrorBoundary.tsx`

**Issue**: Basic error boundary, no external error tracking

**Risk**: Production errors go unnoticed

**Mitigation**: Add Sentry or similar error tracking service

**Evidence**: Basic `ErrorBoundary.tsx`, no external service integration

#### 7. **TypeScript Strictness Disabled** ⚠️ **LOW RISK**

**Location**: `tsconfig.json`

**Issue**: `noImplicitAny: false`, `strictNullChecks: false`

**Risk**: Type safety compromised, potential runtime errors

**Mitigation**: Enable strict mode gradually, fix type errors

**Evidence**: `tsconfig.json` lines 12-17

#### 8. **No Code Splitting** ⚠️ **LOW RISK**

**Location**: `src/App.tsx`

**Issue**: All routes loaded upfront (no lazy loading)

**Risk**: Larger initial bundle, slower first load

**Mitigation**: Add React.lazy() for route components

**Evidence**: No `React.lazy()` usage in `App.tsx`

#### 9. **CORS Wide Open** ⚠️ **MEDIUM RISK**

**Location**: Edge Functions

**Issue**: `Access-Control-Allow-Origin: *` (allows all origins)

**Risk**: CSRF vulnerability (mitigated by auth, but not ideal)

**Mitigation**: Restrict CORS to specific origins in production

**Evidence**: Edge functions return `'Access-Control-Allow-Origin: *'`

#### 10. **No CI/CD** ⚠️ **LOW RISK**

**Location**: Repository root

**Issue**: No automated testing, linting, or deployment

**Risk**: Manual errors, inconsistent deployments

**Mitigation**: Add GitHub Actions or similar for CI/CD

**Evidence**: No `.github/workflows/` or CI config files

### TODOs from Codebase

**Explicit TODOs** (grep for "TODO", "FIXME", "XXX"):

1. **`src/utils/groupContext.ts`**: Deprecated wrapper, migration to `services/groupContext/provider.ts` in progress
2. **Students Migration**: Future migration of students from mockData to Supabase (mentioned in SSoT)

**Implicit TODOs** (from architecture docs):

1. Production authentication implementation
2. Testing infrastructure setup
3. HTML parser refactoring (consider library)
4. Structured logging implementation
5. Error tracking integration
6. CI/CD pipeline setup

---

## 14. "Working Agreements" for Future Changes

### How to Add a Feature Safely

**Step-by-Step Process**:

1. **Read Architecture SSoT**: Always consult `docs/ARCHITECTURE_SSoT.md` first
2. **Impact Analysis**: Identify affected guardrails/invariants
3. **Create Branch**: Create feature branch from main
4. **Implement Changes**:
   - Follow layer boundaries (UI → Business Logic → Data Access → Infrastructure)
   - Maintain backward compatibility (especially for `planParser.ts`)
   - Update contracts if modifying edge functions
5. **Test Locally**: Run `npm run dev`, test manually
6. **Update Documentation**: Update SSoT if contracts changed
7. **Create Migration** (if DB changes): Add migration file, test with `supabase db reset`
8. **Update Types** (if DB changes): Run `supabase gen types typescript`
9. **Commit**: Write clear commit message
10. **Deploy**: Deploy edge functions if modified (`supabase functions deploy <name>`)

### Where to Place New Code by Type

| Code Type | Location | Example |
|-----------|----------|---------|
| **New Page/Route** | `src/pages/NewPage.tsx` | `PlanificacionWizard.tsx` |
| **Page-Specific Component** | `src/components/feature-name/` | `src/components/planificacion/` |
| **Shared UI Component** | `src/components/ui/` (if shadcn pattern) or `src/components/` | `AppSidebar.tsx` |
| **Business Logic Hook** | `src/hooks/useFeatureName.ts` | `useFullSessionGeneration.ts` |
| **Pure Utility Function** | `src/lib/utilityName.ts` | `planParser.ts` |
| **Data Access Helper** | `src/utils/helperName.ts` or `src/services/` | `groupContext.ts` |
| **Type Definitions** | `src/types/featureName.ts` | `planificacion.ts` |
| **Static Data** | `src/data/dataName.ts` | `mockData.ts` |
| **Database Migration** | `supabase/migrations/YYYYMMDDHHMMSS_description.sql` | `20251219163000_*.sql` |
| **Edge Function** | `supabase/functions/function-name/index.ts` | `generate-plan-completo/index.ts` |

### How to Avoid Breaking Architectural Boundaries

**Rules**:

1. **UI Layer** (`src/pages/`, `src/components/`):
   - ✅ **CAN**: Call hooks, use contexts, render UI
   - ❌ **CANNOT**: Direct Supabase queries (use hooks/utils)
   - ❌ **CANNOT**: Business logic (delegate to hooks/lib)

2. **Business Logic Layer** (`src/hooks/`, `src/lib/`):
   - ✅ **CAN**: Call Supabase client, transform data, enforce rules
   - ❌ **CANNOT**: Render UI (return data/state)
   - ❌ **CANNOT**: Direct DOM manipulation

3. **Data Access Layer** (`src/integrations/`, `src/utils/`):
   - ✅ **CAN**: Query Supabase, normalize data
   - ❌ **CANNOT**: Business logic (pure data access)
   - ❌ **CANNOT**: UI concerns

4. **Infrastructure Layer** (`supabase/`):
   - ✅ **CAN**: Database schema, edge functions, RLS
   - ❌ **CANNOT**: Frontend-specific logic

**Enforcement**:
- TypeScript types prevent some violations
- Code reviews should check boundaries
- Linter rules (if added) could enforce import restrictions

### Critical Guardrails (Never Break Without Approval)

1. **Plan Parser Backward Compatibility** (`src/lib/planParser.ts`)
   - Must parse all existing saved plans
   - Changes must be additive only

2. **AI Generation Contract** (`supabase/functions/generate-plan-completo/index.ts`)
   - Must return: `{ plan_html, argumento_competencias, recursos, titulo }`
   - HTML must contain `<section id="plan">` with H1, H2 sections

3. **Database Invariants**:
   - Explicit save pattern: `is_saved = true` → appears in lists
   - Soft delete: `deleted_at IS NULL` → active record
   - User isolation: RLS policies must enforce `auth.uid() = user_id`

4. **Contemplaciones Catalog** (`src/lib/contemplaciones/catalog.ts`)
   - Catalog IDs must remain stable
   - Defaults versioning must be backward compatible

5. **Session Estado Enum**: Values must remain: `'backlog'`, `'planificada'`, `'dictada'`, `'omitida'`, `'pausada'`

---

## Change Log

### Files Created

1. **`docs/PROJECT_ARCHITECTURE_DEEP_DIVE.md`** (NEW)
   - **Purpose**: Complete, repository-derived architecture documentation
   - **Size**: ~1,200 lines
   - **Content**: 
     - Project overview and system diagram
     - Tech stack and tooling details
     - Repository structure explanation
     - Architecture boundaries and responsibilities
     - Runtime flow and state management
     - Data layer (models, queries, caching)
     - API/integration surface (edge functions, external services)
     - AuthN/AuthZ and security patterns
     - UI layer (components, routing, forms)
     - Cross-cutting concerns (logging, feature flags, etc.)
     - Testing strategy (current state: none)
     - Configuration and environments
     - Known risks and technical debt
     - Working agreements for future changes
   - **Source**: Repository code, configs, docs, migrations, and `docs/ARCHITECTURE_SSoT.md`

### Files Modified

**None** - Only one new file created.

---

**End of Document**

