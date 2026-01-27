# AulaPlus v0 - Project Deep Dive

## A) Executive Summary

**AulaPlus** is an educational planning and evaluation platform designed for the Uruguayan education system (ANEP - Administración Nacional de Educación Pública). The application helps teachers create lesson plans, generate evaluations, track student competencies, and manage classroom activities.

**Core Functionality:**
- **Lesson Planning (Planificación)**: AI-powered generation of detailed lesson plans aligned with ANEP curriculum standards
- **Evaluations (Evaluaciones)**: Create and manage group and individual student evaluations with rubrics
- **Competency Tracking**: Track student competencies across the ANEP framework
- **Group Management**: Manage student groups and profiles
- **Communication**: Teacher-student communication system
- **Reports**: Generate executive reports and bulletins

**Target Users:**
- **Teachers**: Primary users who create plans, evaluations, and track student progress
- **Students**: Secondary users who can take diagnostic assessments

**Architecture Pattern:**
- Frontend: React SPA (Single Page Application) with TypeScript
- Backend: Supabase (PostgreSQL + Auth + Edge Functions)
- AI Integration: OpenAI GPT-4o-mini for lesson plan generation
- Deployment: Likely via Lovable.dev platform (based on README)

---

## B) Tech Stack

| Component | Technology | Version (if known) | Location/Evidence |
|-----------|-----------|-------------------|-------------------|
| **Frontend Framework** | React | 18.3.1 | `package.json` |
| **Language** | TypeScript | 5.5.3 | `package.json` |
| **Build Tool** | Vite | 5.4.1 | `package.json`, `vite.config.ts` |
| **UI Framework** | shadcn/ui (Radix UI) | Various | `package.json` (multiple `@radix-ui/*` packages) |
| **Styling** | Tailwind CSS | 3.4.11 | `package.json`, `tailwind.config.ts` |
| **Routing** | React Router | 6.26.2 | `package.json`, `src/App.tsx` |
| **State Management** | React Context + React Query | 5.56.2 | `src/contexts/AuthContext.tsx`, `src/App.tsx` |
| **Backend/Database** | Supabase (PostgreSQL) | 2.56.1 | `package.json`, `src/integrations/supabase/` |
| **Authentication** | Supabase Auth | Built-in | `src/contexts/AuthContext.tsx` |
| **API Layer** | Supabase Client + Edge Functions | Deno runtime | `supabase/functions/` |
| **AI Service** | OpenAI API | GPT-4o-mini | `supabase/functions/generate-plan-completo/index.ts` |
| **Form Handling** | React Hook Form | 7.53.0 | `package.json` |
| **Validation** | Zod | 3.23.8 | `package.json` |
| **PDF Generation** | jsPDF | 3.0.1 | `package.json` |
| **Date Handling** | date-fns | 3.6.0 | `package.json` |
| **Charts** | Recharts | 2.12.7 | `package.json` |
| **Rich Text Editor** | React Quill | 0.0.2 | `package.json` |
| **Testing** | Unknown | - | Only one test file found: `src/__tests__/sessionBriefMapping.test.ts` |
| **Linting** | ESLint | 9.9.0 | `package.json`, `eslint.config.js` |

---

## C) Repository Map

```
aulaplus-v0/
├── src/                          # Main source code
│   ├── main.tsx                  # Application entry point
│   ├── App.tsx                   # Root component with routing
│   ├── App.css / index.css       # Global styles
│   │
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui base components (63 files)
│   │   ├── planificacion/        # Lesson planning components
│   │   ├── evaluaciones/         # Evaluation components
│   │   ├── AppLayout.tsx         # Main layout wrapper
│   │   ├── AppSidebar.tsx        # Navigation sidebar
│   │   ├── TeacherDashboard.tsx  # Teacher dashboard
│   │   └── [other feature components]
│   │
│   ├── pages/                    # Route-level page components
│   │   ├── PlanificacionWizard.tsx      # Lesson plan creation wizard
│   │   ├── PlanificacionWorkspace.tsx   # Lesson plan editor
│   │   ├── MisPlanificaciones.tsx       # Saved plans list
│   │   ├── EvaluacionesGrupo.tsx        # Group evaluation creator
│   │   ├── MisEvaluaciones.tsx          # Saved evaluations list
│   │   ├── TeacherGroups.tsx            # Group management
│   │   └── [other pages]
│   │
│   ├── contexts/                 # React Context providers
│   │   └── AuthContext.tsx       # Authentication state management
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── usePlanificacionWizard.ts    # Wizard state management
│   │   ├── useFullSessionGeneration.ts  # AI plan generation
│   │   ├── useBulletinGenerator.ts      # Bulletin generation
│   │   └── [other hooks]
│   │
│   ├── lib/                      # Utility libraries
│   │   ├── planParser.ts         # HTML plan parser
│   │   ├── competencyExtractor.ts # Competency extraction logic
│   │   ├── sessionPlanGenerator.ts # Session plan generation
│   │   ├── registroCompetencialPDF.ts # PDF generation
│   │   └── [other utilities]
│   │
│   ├── integrations/             # Third-party integrations
│   │   └── supabase/
│   │       ├── client.ts         # Supabase client setup
│   │       └── types.ts          # Generated TypeScript types
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── planificacion.ts      # Planning-related types
│   │   ├── calendario.ts         # Calendar types
│   │   └── validation.ts         # Validation schemas
│   │
│   ├── data/                     # Static data/catalogs
│   │   ├── competencias.ts       # ANEP competencies catalog
│   │   ├── competenciasCiudadania.ts
│   │   ├── competenciasLiteratura.ts
│   │   └── catalogo.ts           # General catalog
│   │
│   ├── utils/                    # Utility functions
│   │   └── groupContext.ts       # Group context utilities
│   │
│   └── assets/                   # Static assets
│       └── logo/                 # Application logo
│
├── supabase/                     # Supabase backend configuration
│   ├── config.toml               # Supabase project config
│   ├── migrations/               # Database migrations (23 files)
│   │   ├── 20250923163758_*.sql  # Initial schema (planificaciones, sesiones_clase)
│   │   ├── 20251222000000_*.sql  # Evaluaciones explicit save
│   │   └── [other migrations]
│   │
│   └── functions/                # Supabase Edge Functions (Deno)
│       ├── ensure-demo-users/    # Demo user creation
│       ├── generate-plan-completo/ # AI lesson plan generation
│       ├── generate-bulletin-text/ # Bulletin text generation
│       └── modify-evaluation/    # Evaluation modification
│
├── public/                       # Static public assets
├── dist/                         # Build output (generated)
├── docs/                         # Documentation (85+ markdown files)
├── refactor/                     # Refactoring notes and plans
│
├── package.json                  # Dependencies and scripts
├── vite.config.ts                # Vite build configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
└── eslint.config.js              # ESLint configuration
```

**Directory Responsibilities:**

- **`src/components/`**: Reusable UI components, organized by feature
- **`src/pages/`**: Route-level page components (one per route)
- **`src/hooks/`**: Custom React hooks for business logic
- **`src/lib/`**: Pure utility functions and parsers
- **`src/integrations/`**: Third-party service clients
- **`src/types/`**: TypeScript type definitions
- **`src/data/`**: Static catalogs and reference data
- **`supabase/migrations/`**: Database schema evolution
- **`supabase/functions/`**: Serverless backend functions

---

## D) Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React SPA)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Routing    │  │   Context   │  │   React      │      │
│  │ (React Router)│  │  (Auth)    │  │   Query      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Component Hierarchy                      │  │
│  │  App → AppLayout → [Pages] → [Feature Components]    │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS/REST
                        │ Supabase Client SDK
┌───────────────────────┴─────────────────────────────────────┐
│              Supabase Backend                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Auth       │  │  PostgreSQL  │  │   Edge       │      │
│  │  (JWT)       │  │  (Database)  │  │   Functions  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Row Level Security (RLS) Policies                    │  │
│  │  - Users can only access their own data               │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS API
                        │
┌───────────────────────┴─────────────────────────────────────┐
│              External Services                                 │
│  ┌──────────────┐                                             │
│  │   OpenAI     │  (GPT-4o-mini for lesson plan generation)   │
│  │   API        │                                             │
│  └──────────────┘                                             │
└───────────────────────────────────────────────────────────────┘
```

### Data Flow Patterns

1. **Authentication Flow:**
   - User logs in → `AuthContext` → Supabase Auth → JWT stored in localStorage
   - Profile auto-created/updated via `profiles` table upsert
   - Session persisted across page reloads

2. **Lesson Plan Generation Flow:**
   - User fills wizard → `PlanificacionWizard` → `useFullSessionGeneration` hook
   - Hook calls Supabase Edge Function `generate-plan-completo`
   - Edge Function calls OpenAI API with structured prompt
   - Response parsed by `planParser.ts` → Saved to `sesiones_clase` table

3. **Data Fetching Pattern:**
   - React Query for server state caching
   - Supabase client for direct database queries
   - RLS policies enforce user isolation

---

## E) Responsibilities by Module/Component

### Authentication (`src/contexts/AuthContext.tsx`)
- Manages user authentication state
- Handles login/logout
- Auto-creates/updates user profiles in Supabase
- Provides demo user setup via `ensure-demo-users` edge function
- Stores user in localStorage for persistence

### Routing (`src/App.tsx`)
- Defines all application routes
- Implements protected routes (teacher/student)
- Handles route-level authentication checks
- Wraps app with providers (QueryClient, Auth, Tooltip)

### Layout (`src/components/AppLayout.tsx`)
- Provides consistent layout structure
- Includes sidebar navigation
- Header with breadcrumbs and user actions
- Floating communication button

### Lesson Planning Module

**`src/pages/PlanificacionWizard.tsx`**
- Multi-step wizard for creating lesson plans
- Collects: subject, level, dates, competencies, units
- Manages wizard state and navigation
- Triggers AI generation via hooks

**`src/pages/PlanificacionWorkspace.tsx`**
- Editor for viewing/editing lesson plans
- Calendar view of sessions
- Session editing and regeneration
- Save/delete operations

**`src/hooks/useFullSessionGeneration.ts`**
- Orchestrates AI plan generation
- Calls `generate-plan-completo` edge function
- Handles retries and error states
- Parses and validates AI responses

**`src/lib/planParser.ts`**
- Parses HTML lesson plans from AI
- Extracts: Inicio, Desarrollo, Cierre sections
- Normalizes resources list
- Handles differentiation/adaptations section

**`src/lib/competencyExtractor.ts`**
- Extracts competency IDs from lesson units
- Maps competencies to content
- Builds competency-content relationships

### Evaluation Module

**`src/pages/EvaluacionesGrupo.tsx`**
- Creates group evaluations
- Configures evaluation parameters
- Generates evaluation content
- Saves evaluations with explicit save pattern

**`src/pages/MisEvaluaciones.tsx`**
- Lists saved evaluations
- Filters by subject, group, date
- Shows competency counts
- Links to evaluation detail view

**`src/components/evaluaciones/`**
- Smart rubric components
- Evaluation rendering
- Version personalization
- HTML renderer for evaluation content

### Database Schema (`supabase/migrations/`)

**Core Tables:**
- `profiles`: User profile information (role, display_name)
- `planificaciones`: Lesson planning periods (subject, level, dates, config)
- `sesiones_clase`: Individual class sessions (date, content, competencies, plan HTML)
- `evaluaciones`: Group evaluations (content, rubric, competencies)
- `grupos`: Student groups (name, teacher suggestions)
- `comunicaciones`: Teacher-student communications
- `calendario_eventos`: Calendar events

**Key Patterns:**
- **Explicit Save**: `is_saved`, `saved_at` columns for explicit save pattern
- **Soft Delete**: `deleted_at` for soft deletion
- **RLS Policies**: Row-level security on all tables
- **Timestamps**: `created_at`, `updated_at` with auto-update triggers

### Edge Functions (`supabase/functions/`)

**`generate-plan-completo`**
- Receives session parameters (subject, competencies, group profile)
- Constructs detailed prompt for OpenAI
- Handles retries with exponential backoff
- Returns structured HTML lesson plan
- Validates response structure

**`ensure-demo-users`**
- Creates/updates demo teacher user
- Ensures profile exists
- Uses service role key for admin operations

**`generate-bulletin-text`**
- Generates bulletin text content
- Likely uses AI for text generation

**`modify-evaluation`**
- Modifies existing evaluations
- Handles evaluation updates

---

## F) Key Flows

### 1. Authentication/Login Flow

```
1. User visits app → RoleSelection page
2. User selects "Teacher" → Redirects to /teacher-login
3. User enters credentials → TeacherLogin component
4. AuthContext.login() called
5. If no Supabase session exists:
   - Calls ensure-demo-users edge function
   - Signs in with demo.teacher@example.com
6. Auth state listener fires → Profile upserted
7. Mock user created in frontend state
8. User stored in localStorage
9. Redirect to /teacher-dashboard
```

**Key Files:**
- `src/contexts/AuthContext.tsx` (lines 149-183)
- `src/components/TeacherLogin.tsx`
- `supabase/functions/ensure-demo-users/index.ts`

### 2. Lesson Plan Creation Flow (Main User Journey)

```
1. Teacher navigates to /planificacion/nuevo
2. PlanificacionWizard loads → Step 1: Basic Info
   - Selects: subject, level, start/end dates, weekly hours
3. Step 2: Competencies & Content
   - Selects ANEP competencies
   - Creates didactic units (UnidadDidactica)
   - Assigns estimated classes per unit
4. Step 3: Group Profile (optional)
   - Configures group size, learning styles
   - Adds student-specific adjustments
5. Step 4: Teacher Instructions (optional)
   - Adds custom instructions for AI
6. Wizard calculates total sessions needed
7. For each session:
   - useFullSessionGeneration hook called
   - Calls generate-plan-completo edge function
   - Edge function calls OpenAI API
   - Response parsed by planParser
   - Session saved to sesiones_clase table
8. Plan saved to planificaciones table
9. Redirect to /planificacion/:id (workspace)
```

**Key Files:**
- `src/pages/PlanificacionWizard.tsx`
- `src/hooks/useFullSessionGeneration.ts`
- `supabase/functions/generate-plan-completo/index.ts`
- `src/lib/planParser.ts`

### 3. Core Domain Workflow: Session Plan Generation

```
Input:
- Session order, duration, subject, level
- Competencies, content, criteria (ANEP)
- Group profile, student adjustments
- Unit context (if part of sequence)
- Session brief (teacher override)

Process:
1. Edge function constructs prompt:
   - System role: "pedagogical assistant"
   - Context sections: sequence, group profile, instructions
   - Mandatory HTML structure requirements
   - Session brief override (if provided)

2. OpenAI API call (GPT-4o-mini):
   - Temperature: 0.7
   - Retry logic: 3 attempts with exponential backoff
   - Rate limit handling

3. Response parsing:
   - Extract JSON: { plan_html, argumento_competencias, recursos, titulo }
   - Validate HTML structure
   - Fallback plan if invalid

4. Frontend processing:
   - planParser extracts sections
   - Resources normalized and de-duplicated
   - Differentiation section extracted
   - Session saved to database

Output:
- Structured session plan in sesiones_clase table
- HTML content in plan_desarrollo JSONB field
- Competencies tracked in competencias_anep array
```

**Key Files:**
- `supabase/functions/generate-plan-completo/index.ts` (lines 177-265)
- `src/lib/planParser.ts`
- `src/hooks/useFullSessionGeneration.ts`

---

## G) Configuration & Environment Variables

| Variable Name | Purpose | Where Used | Required |
|--------------|---------|------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | `src/integrations/supabase/client.ts` | ✅ Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key | `src/integrations/supabase/client.ts` | ✅ Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI generation | `supabase/functions/generate-plan-completo/index.ts` | ✅ Yes (Edge Function) |
| `SERVICE_ROLE_KEY` | Supabase service role key (admin) | `supabase/functions/ensure-demo-users/index.ts` | ✅ Yes (Edge Function) |
| `SUPABASE_URL` | Supabase URL (Edge Functions) | `supabase/functions/*/index.ts` | ✅ Yes (Edge Functions) |

**Environment Setup:**
- Frontend: `.env` file in project root (not committed, see `.gitignore`)
- Edge Functions: Set via Supabase Dashboard → Settings → Edge Functions → Secrets
- Validation: Client validates env vars on startup (throws error if missing)

**Configuration Files:**
- `supabase/config.toml`: Supabase project configuration
  - Project ID: `srlrbuphsogwgymqywhe`
  - Edge function JWT verification settings

---

## H) Build/Run/Test/Deploy Instructions

### Development

```bash
# Install dependencies
npm install

# Start development server (port 8080)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

**Development Server:**
- URL: `http://localhost:8080` (or `http://[::]:8080`)
- Hot Module Replacement (HMR) enabled
- Component tagger enabled in dev mode (Lovable integration)

### Testing

**Current State:**
- Only one test file found: `src/__tests__/sessionBriefMapping.test.ts`
- No test runner configuration visible in `package.json`
- **Unknown**: Test framework, test commands, CI/CD setup

**Recommendation:** Add testing infrastructure (Vitest, Jest, or React Testing Library)

### Deployment

**Based on README:**
- Primary deployment via Lovable.dev platform
- Click "Share → Publish" in Lovable interface
- Custom domain support available

**Build Artifacts:**
- `dist/` directory contains production build
- Static assets in `dist/assets/`
- `index.html` as entry point

**Unknown:**
- CI/CD pipeline configuration
- Automated deployment process
- Environment-specific builds
- Docker configuration (if any)

### Supabase Setup

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Link to project
supabase link --project-ref srlrbuphsogwgymqywhe

# Run migrations locally
supabase db reset

# Deploy edge functions
supabase functions deploy <function-name>
```

---

## I) Change Guide - "Where to Modify X"

### Adding a New Page/Route

1. **Create page component**: `src/pages/NewPage.tsx`
2. **Add route**: `src/App.tsx` (add to `AppRoutes` component)
3. **Add navigation**: `src/components/AppSidebar.tsx` (add menu item)
4. **Add breadcrumb**: `src/components/Breadcrumbs.tsx` (if needed)

### Modifying Database Schema

1. **Create migration**: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. **Update types**: Run `supabase gen types typescript` → update `src/integrations/supabase/types.ts`
3. **Update RLS policies**: Add policies in migration file
4. **Test locally**: `supabase db reset`

### Adding a New Edge Function

1. **Create function**: `supabase/functions/new-function/index.ts`
2. **Configure**: `supabase/functions/new-function/config.toml` (JWT settings)
3. **Deploy**: `supabase functions deploy new-function`
4. **Call from frontend**: `supabase.functions.invoke('new-function', { body: {...} })`

### Modifying AI Prompt (Lesson Plan Generation)

**File**: `supabase/functions/generate-plan-completo/index.ts`
- Lines 177-265: Main prompt construction
- Modify prompt sections to change AI behavior
- Test with different inputs to validate changes

### Adding a New UI Component

1. **Use shadcn/ui**: `npx shadcn-ui@latest add [component]` (if available)
2. **Create custom**: `src/components/ui/NewComponent.tsx`
3. **Export**: Add to appropriate index or import directly

### Modifying Authentication Flow

**File**: `src/contexts/AuthContext.tsx`
- Lines 149-183: Login logic
- Lines 75-147: Auth state listener
- Modify demo user setup, profile creation, or session handling

### Changing Competency Catalog

**Files**: 
- `src/data/competencias.ts`
- `src/data/competenciasCiudadania.ts`
- `src/data/competenciasLiteratura.ts`

Update the arrays/objects with new competency definitions.

### Modifying Lesson Plan Parser

**File**: `src/lib/planParser.ts`
- Main parsing logic for HTML lesson plans
- Section extraction, resource normalization
- **Warning**: Changes here affect all saved plans

### Adding New Evaluation Type

1. **Database**: Add columns to `evaluaciones` table (migration)
2. **UI**: Modify `src/pages/EvaluacionesGrupo.tsx`
3. **Components**: Update evaluation renderers in `src/components/evaluaciones/`

### Changing Styling/Theming

**Files**:
- `src/index.css`: CSS variables for theme
- `tailwind.config.ts`: Tailwind configuration
- Component-level: Modify className props

### Modifying Sidebar Navigation

**File**: `src/components/AppSidebar.tsx`
- Update `navigationItems` array (lines 27-52)
- Add/remove menu items
- Modify icons (from `lucide-react`)

---

## J) Open Questions / Unknowns

### Testing Infrastructure
**Status**: Unknown / Needs confirmation
**Evidence**: Only one test file found, no test scripts in `package.json`
**Files Checked**: `package.json`, `src/__tests__/`
**Action Needed**: Determine testing strategy and add test framework

### CI/CD Pipeline
**Status**: Unknown / Needs confirmation
**Evidence**: No `.github/workflows/`, `.gitlab-ci.yml`, or similar files found
**Files Checked**: Repository root
**Action Needed**: Identify deployment pipeline or confirm manual deployment

### Environment-Specific Configuration
**Status**: Partially known
**Evidence**: `.env` file pattern used, but no `.env.example` found
**Files Checked**: Repository root
**Action Needed**: Create `.env.example` with required variables

### Error Monitoring/Logging
**Status**: Unknown / Needs confirmation
**Evidence**: No Sentry, LogRocket, or similar service found
**Files Checked**: `package.json`, `src/`
**Action Needed**: Determine if error monitoring is needed/configured

### Performance Monitoring
**Status**: Unknown
**Evidence**: No performance monitoring tools visible
**Action Needed**: Assess if needed for production

### Database Backup Strategy
**Status**: Unknown (Supabase-managed)
**Evidence**: Supabase handles backups, but strategy not documented
**Action Needed**: Document backup/restore procedures

### Feature Flags
**Status**: Not implemented
**Evidence**: No feature flag system found
**Action Needed**: Consider if needed for gradual rollouts

### API Rate Limiting
**Status**: Partially known
**Evidence**: OpenAI API has retry logic, but no explicit rate limiting
**Files Checked**: `supabase/functions/generate-plan-completo/index.ts`
**Action Needed**: Document rate limits and implement client-side throttling if needed

### Local Development Database
**Status**: Unknown
**Evidence**: Supabase CLI mentioned but setup not documented
**Action Needed**: Document local Supabase setup process

### Production Environment Variables
**Status**: Unknown
**Evidence**: Variables needed but production values not documented
**Action Needed**: Document where production env vars are set (Lovable? Supabase Dashboard?)

---

## Changes Made By Cursor

**Files Created:**
- `docs/PROJECT_DEEP_DIVE.md` (this file)

**Files Modified:**
- None (only documentation created)

**Supporting Documentation:**
- This document is self-contained and references existing files in the repository
- No additional supporting files were created

**Methodology:**
- Analyzed repository structure via `list_dir` and `glob_file_search`
- Read key configuration files (`package.json`, `vite.config.ts`, `tsconfig.json`)
- Examined source code files to understand architecture
- Reviewed database migrations to understand schema
- Analyzed edge functions to understand backend logic
- Documented findings based solely on repository evidence










