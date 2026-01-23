# AulaPlus v0 - Project Overview

**Date**: December 28, 2024  
**Repository**: aulaplus-v0  
**Build System**: Vite + React + TypeScript

---

## A. Executive Summary

### What This Product Is

**AulaPlus** is an AI-powered **pedagogical planning and evaluation platform** designed specifically for teachers in the Uruguayan education system (ANEP - Administración Nacional de Educación Pública). The platform automates and intelligently assists teachers in creating:

1. **Lesson Plans** (Planificaciones de Clase) - Structured, competency-based session plans
2. **Evaluations** (Evaluaciones) - Differentiated assessments with rubrics
3. **Student Reports** (Reportes) - Group and individual student analytics

The system integrates with Uruguay's official curricular framework (ANEP competencies, content, and learning criteria) and leverages OpenAI's GPT models to generate contextually appropriate, pedagogically sound educational materials.

### Who It Is For

**Primary Users**: Teachers (Docentes) in Uruguay's public education system
- Middle school teachers (7mo-9no grado / 7th-9th grade)
- Focus on subjects like History, Literature, Citizenship, Mathematics
- Teachers managing multiple groups (classes) with diverse learning needs

**Secondary Users**: Students (limited diagnostic functionality)

### Core User Journeys

#### Journey 1: Teacher Creates a Multi-Week Lesson Plan
```
1. Login → Teacher Dashboard
2. Navigate to "Planificación" → "Nueva Planificación"
3. Planning Wizard (4 steps):
   Step 0 (Contexto): Select group, subject, dates, session count
   Step 1 (Horario): Configure weekly schedule
   Step 2 (Contenido): Build didactic units with ANEP competencies/content
   Step 3 (Enfoque): Set pedagogical approach, modalities, differentiation
4. AI generates complete plan with sessions mapped to calendar
5. Teacher views generated sessions in CalendarioDnD (drag-and-drop calendar)
6. Teacher edits individual sessions (EditorSesionNuevo)
7. Teacher saves plan explicitly → appears in "Mis Planificaciones"
```

**Key Features**:
- **Didactic Units** (Unidades Didácticas): Content chunked into themes with estimated class count
- **Session Brief**: Per-session focus overrides for teacher-specified topics
- **Group Profile Integration**: AI considers learning styles and student adjustments
- **Progressive Generation**: Multi-class sequences avoid repetition, respect unit progression

#### Journey 2: Teacher Generates Differentiated Evaluations
```
1. Dashboard → "Evaluaciones" → "Nueva Evaluación"
2. Select group, subject, ANEP competencies, content
3. Define evaluation requirements (type, duration, format)
4. AI generates 3 versions:
   - Base version (standard)
   - Moderately adapted (some scaffolding)
   - Highly adapted (extensive supports)
5. Each version includes rubric with competency-aligned criteria
6. Teacher saves evaluation → appears in "Mis Evaluaciones"
7. Teacher can generate bulletin text (Boletín) from evaluation results
```

**Key Features**:
- **Smart Rubrics**: Auto-generated rubrics aligned to ANEP competencies
- **Version Personalization**: Explicit adaptations for diverse learners
- **Global Rubric**: Reusable rubric library across evaluations

#### Journey 3: Teacher Views Group Profile and Analytics
```
1. Dashboard → "Mis Grupos" → Select group (e.g., "9no 1")
2. View group profile:
   - Student list with learning styles (Visual, Kinestésico, Auditivo, Lector/Escritor)
   - Distribution chart of learning styles
   - Pedagogical recommendations based on dominant style
   - Teacher-editable suggestions (saved to Supabase)
3. View individual student profiles:
   - Historical academic performance
   - Contemplaciones (specific adaptations required)
   - Technical reports (Informe Técnico) from psychopedagogical team
4. Analytics dashboard (planned, partially implemented):
   - Group KPIs per competency
   - Alerts (e.g., low attention, reading support needs)
```

**Key Features**:
- **Group Profile Usage**: AI actively uses learning styles in plan generation
- **Student Adjustments**: Anonymized student needs inform differentiation
- **Teacher Sugerencias**: Editable teacher notes stored in Supabase

---

## B. Tech Stack

### Frontend Framework & Libraries

| Component | Technology | Version | Configuration |
|-----------|------------|---------|---------------|
| **Build Tool** | Vite | 5.4.1 | `vite.config.ts` |
| **Framework** | React | 18.3.1 | SPA with React Router |
| **Language** | TypeScript | 5.5.3 | `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` |
| **Bundler** | Vite (esbuild) | - | Fast HMR with SWC plugin |
| **Compiler** | @vitejs/plugin-react-swc | 3.5.0 | Faster than Babel |

**Key Frontend Dependencies** (`package.json`):
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.2",
  "@tanstack/react-query": "^5.56.2",
  "framer-motion": "^12.19.1"
}
```

### UI Component Library

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Design System** | shadcn/ui | - | Radix UI + Tailwind wrapper |
| **Primitives** | @radix-ui/* | Various | Unstyled accessible components |
| **Styling** | Tailwind CSS | 3.4.11 | Utility-first CSS framework |
| **Animations** | tailwindcss-animate | 1.0.7 | Animation utilities |
| **Icons** | lucide-react | 0.462.0 | Icon library |

**Configuration**:
- `tailwind.config.ts`: Custom design tokens, animations, color system
- `components.json`: shadcn/ui configuration (path aliases)

**Key UI Components** (`src/components/ui/`): 63 components including:
- Form components (Input, Select, Checkbox, etc.)
- Layout components (Card, Tabs, Dialog, Sheet, etc.)
- Data display (Table, Avatar, Badge, Progress, etc.)
- Feedback (Toast/Sonner, Alert, Tooltip, etc.)

### Backend & Database

| Component | Technology | Details |
|-----------|------------|---------|
| **Backend-as-a-Service** | Supabase | PostgreSQL + Auth + Edge Functions + Storage |
| **Database** | PostgreSQL | Hosted by Supabase |
| **ORM/Client** | @supabase/supabase-js | 2.56.1 |
| **Authentication** | Supabase Auth | Email/password (demo users) |
| **Row Level Security** | Supabase RLS | Enforced on all tables |

**Supabase Configuration**:
- `supabase/config.toml`: Project ID, edge function settings
- `src/integrations/supabase/client.ts`: Client initialization
- `src/integrations/supabase/types.ts`: Auto-generated TypeScript types

**Environment Variables** (Required):
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_public_key>
```

**Note**: Project uses Lovable.dev deployment platform, environment variables managed there.

### Serverless Functions (Edge Functions)

| Function | Path | Purpose | Model Used |
|----------|------|---------|------------|
| **generate-plan-completo** | `supabase/functions/generate-plan-completo/index.ts` | Generate full HTML lesson plans | gpt-4o-mini |
| **modify-evaluation** | `supabase/functions/modify-evaluation/index.ts` | Modify evaluations OR generate plain-text lesson plans | gpt-4o-mini |
| **generate-bulletin-text** | `supabase/functions/generate-bulletin-text/index.ts` | Generate bulletin text from evaluation results | gpt-4o-mini |
| **ensure-demo-users** | `supabase/functions/ensure-demo-users/index.ts` | Create demo users for authentication | - |

**Configuration**: `supabase/config.toml` sets `verify_jwt = false` (demo mode)

**OpenAI Integration**:
- API Key: `OPENAI_API_KEY` environment variable (set in Supabase dashboard)
- Models: `gpt-4o-mini` (default), `gpt-4.1-2025-04-14` (optional fallback)
- Retry logic: Exponential backoff for rate limits (3 retries)

### State Management

| Approach | Implementation | Usage |
|----------|----------------|-------|
| **Server State** | @tanstack/react-query | Async data fetching, caching, invalidation |
| **Client State** | React Hooks (useState, useContext) | Local component state |
| **Auth Context** | `src/contexts/AuthContext.tsx` | Global auth state (user, session) |
| **Form State** | react-hook-form | Form validation and state |

**Key Query Client** (`src/App.tsx`):
```typescript
const queryClient = new QueryClient();
<QueryClientProvider client={queryClient}>
```

### PDF Generation & Export

| Library | Version | Purpose |
|---------|---------|---------|
| **jspdf** | 3.0.1 | PDF generation |
| **html2canvas** | 1.4.1 | HTML to canvas (for PDF export) |

**Implementation**: `src/components/PDFGenerator.tsx`, `src/lib/registroCompetencialPDF.ts`

### Date & Time

| Library | Version | Purpose |
|---------|---------|---------|
| **date-fns** | 3.6.0 | Date manipulation and formatting |
| **react-day-picker** | 8.10.1 | Calendar component |

### Form Validation

| Library | Version | Purpose |
|---------|---------|---------|
| **react-hook-form** | 7.53.0 | Form state management |
| **zod** | 3.23.8 | Schema validation |
| **@hookform/resolvers** | 3.9.0 | Zod integration with RHF |

### Testing

**Status**: ❌ No testing framework configured
- No Jest, Vitest, or testing libraries in `package.json`
- One test file exists: `src/__tests__/sessionBriefMapping.test.ts` (appears unused)

**Recommendation**: Add Vitest + React Testing Library

### Build Tooling & CI/CD

| Tool | Configuration | Purpose |
|------|---------------|---------|
| **Bundler** | Vite | `vite.config.ts` |
| **Linter** | ESLint | `eslint.config.js` |
| **TypeScript** | tsc | `tsconfig.json` |
| **Package Manager** | npm | `package-lock.json` |
| **Alternative PM** | Bun | `bun.lockb` (appears to coexist) |

**Scripts** (`package.json`):
```json
{
  "dev": "vite",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

**Deployment**: Lovable.dev platform (auto-deployment from git)
- No GitHub Actions, Vercel config, or CI/CD pipelines in repo
- `README.md` references Lovable project URL

### Hosting & Deployment

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Frontend Hosting** | Lovable.dev | Auto-deploy on git push |
| **Database** | Supabase (hosted PostgreSQL) | Project ID in `supabase/config.toml` |
| **Edge Functions** | Supabase Edge Functions | Deno runtime |

**Build Output**: `dist/` folder (Vite static build)

---

## C. High-Level Architecture

### System Diagram (Textual Representation)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (SPA)                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  React Components (src/components/, src/pages/)                │ │
│  │  ├─ Teacher Dashboard                                          │ │
│  │  ├─ PlanificacionWizard (4-step wizard)                        │ │
│  │  ├─ PlanificacionWorkspace (calendar view, session editor)    │ │
│  │  ├─ EvaluacionesGrupo (evaluation generator)                   │ │
│  │  ├─ TeacherGroups (group profiles, student data)               │ │
│  │  └─ MisEvaluaciones, MisPlanificaciones (saved items)          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               ↕                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Custom Hooks (src/hooks/)                                     │ │
│  │  ├─ usePlanificacionWizard (wizard state machine)              │ │
│  │  ├─ useFullSessionGeneration (AI plan generation)              │ │
│  │  ├─ useBulletinGenerator (bulletin text gen)                   │ │
│  │  └─ useAIPlanification (legacy, partial use)                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               ↕                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Utilities & Helpers (src/lib/, src/utils/)                    │ │
│  │  ├─ planParser.ts (HTML → structured plan)                     │ │
│  │  ├─ normalizeSupabaseArrays.ts (fix Supabase array bugs)      │ │
│  │  ├─ groupContext.ts (load group profile from Supabase+mock)   │ │
│  │  └─ contentCleaner.ts, durationValidator.ts, etc.             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               ↕                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Supabase Client (src/integrations/supabase/client.ts)        │ │
│  │  - Auth (session management)                                   │ │
│  │  - Database queries (React Query)                              │ │
│  │  - Edge function invocations                                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                               ↕ HTTPS
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPABASE BACKEND                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Edge Functions (Deno runtime)                                 │ │
│  │  ├─ generate-plan-completo (OpenAI GPT-4o-mini)                │ │
│  │  ├─ modify-evaluation (OpenAI GPT-4o-mini)                     │ │
│  │  ├─ generate-bulletin-text (OpenAI GPT-4o-mini)                │ │
│  │  └─ ensure-demo-users (setup)                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               ↕                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL Database                                           │ │
│  │  ├─ planificaciones (lesson plans)                             │ │
│  │  ├─ sesiones_clase (individual sessions)                       │ │
│  │  ├─ evaluaciones (evaluations)                                 │ │
│  │  ├─ grupos (group metadata, teacher suggestions)               │ │
│  │  └─ profiles (user profiles)                                   │ │
│  │  RLS: Enforced on all tables (auth.uid() checks)               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               ↕                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Supabase Auth (email/password)                                │ │
│  │  - Demo users: demo.teacher@example.com                        │ │
│  │  - JWT tokens (anon key + session token)                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                               ↕ HTTPS
┌─────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL APIS                                 │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  OpenAI API (api.openai.com)                                   │ │
│  │  - Model: gpt-4o-mini (default)                                │ │
│  │  - Fallback: gpt-4.1-2025-04-14                                │ │
│  │  - API Key: Stored in Supabase env vars                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow: User Creates a Lesson Plan

```
1. User Action: Completes PlanificacionWizard → Click "Finalizar"
   ↓
2. Frontend: PlanificacionWizard.tsx → generarPlanesAutomaticamente()
   ↓
3. Load Group Context: await loadGroupContext(grupoId)
   ├─ Supabase: SELECT teacher_sugerencias FROM grupos WHERE id = grupoId
   └─ Fallback: mockGroups (hardcoded student data)
   ↓
4. Calculate: Learning style distribution, dominant style, anonymized student adjustments
   ↓
5. For Each Session (e.g., 10 sessions):
   ├─ Build payload with:
   │  ├─ sesionId, orden, duracionMin
   │  ├─ materia, nivel
   │  ├─ contenidos, competencias, criterios (from ANEP catalogs)
   │  ├─ perfilGrupo (learning styles)
   │  ├─ estudiantes (anonymized adjustments)
   │  ├─ unitContext (didactic unit metadata)
   │  └─ sessionBrief (teacher-specified topic focus, if any)
   ↓
6. Edge Function Invocation: supabase.functions.invoke('generate-plan-completo', { body: payload })
   ↓
7. Edge Function (Deno): generate-plan-completo/index.ts
   ├─ Construct AI prompt with:
   │  ├─ Sequence context (class X of Y in unit Z)
   │  ├─ Group profile section (learning styles, student adjustments)
   │  ├─ Session brief section (PEDAGOGICALLY BINDING, takes priority)
   │  ├─ Strict output format rules (HTML with specific structure)
   │  └─ Pedagogical rules (MUST include explicit profile-driven decisions)
   ├─ Call OpenAI API: POST https://api.openai.com/v1/chat/completions
   │  └─ Model: gpt-4o-mini, temperature: 0.7, max_tokens: 3000
   ├─ Retry logic: 3 attempts with exponential backoff (if rate limit 429)
   └─ Return: { plan_html, recursos, argumento_competencias }
   ↓
8. Frontend: Receives plan_html
   ├─ Parse HTML: planParser.ts → Extract Inicio, Desarrollo, Cierre, Diferenciación, Recursos
   ├─ Normalize: Remove duplicate headings, sanitize HTML
   └─ Merge resources: Auto-generated + teacher-added manual resources
   ↓
9. Database Write: INSERT INTO sesiones_clase (planificacion_id, fecha, plan_desarrollo, recursos, ...)
   ├─ RLS Check: auth.uid() = planificaciones.user_id
   └─ Trigger: update_updated_at_column() (auto-update timestamp)
   ↓
10. Frontend: Update local state, invalidate React Query cache
    ↓
11. Navigate: Redirect to PlanificacionWorkspace → Show calendar with generated sessions
```

### Async/Event Flows

**React Query Cache Invalidation**:
- After creating/updating planificaciones or sesiones_clase
- After saving evaluaciones
- Pattern: `queryClient.invalidateQueries(['planificaciones'])` or `['sesiones']`

**Authentication Flow**:
1. User logs in → `AuthContext.login()`
2. Silent background auth: Supabase Auth session created
3. Edge function `ensure-demo-users` creates demo user if not exists
4. Frontend localStorage stores mock user data (for demo purposes)
5. Subsequent API calls use Supabase session token (auto-attached by client)

**Error Handling**:
- Edge functions: Try/catch with specific error messages
- Frontend: Toast notifications (Sonner) for user feedback
- Error boundaries: `src/components/ErrorBoundary.tsx` (catches React errors)

---

## D. Repository Structure

### Top-Level Directories

```
aulaplus-v0/
├── dist/                       # Vite build output (deployable static files)
├── docs/                       # Documentation (audit reports, implementation notes)
│   ├── changes/                # Change logs (cursor sessions)
│   ├── claude_runs/            # Claude AI conversation logs
│   ├── cursor/                 # Cursor AI conversation logs
│   ├── sql/                    # SQL scripts (e.g., create_evaluaciones_table.sql)
│   └── *.md                    # Various docs (phase reports, verification, audits)
├── node_modules/               # npm dependencies
├── public/                     # Static assets (favicon, placeholder images)
├── refactor/                   # Refactoring documentation (21 .md files)
├── src/                        # Main application source code
│   ├── __tests__/              # Test files (currently minimal)
│   ├── components/             # React components
│   │   ├── evaluaciones/       # Evaluation-related components
│   │   ├── planificacion/      # Planning-related components
│   │   └── ui/                 # shadcn/ui components (63 files)
│   ├── contexts/               # React contexts (AuthContext)
│   ├── data/                   # Static data (competencies, mock data, catalogs)
│   ├── hooks/                  # Custom React hooks
│   ├── integrations/           # External service integrations (Supabase)
│   ├── lib/                    # Utility libraries and helpers
│   ├── pages/                  # Top-level page components (routes)
│   ├── types/                  # TypeScript type definitions
│   ├── utils/                  # Shared utilities (groupContext.ts)
│   ├── App.tsx                 # Root component with routes
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── supabase/                   # Supabase configuration and migrations
│   ├── functions/              # Edge functions (Deno)
│   │   ├── generate-plan-completo/
│   │   ├── modify-evaluation/
│   │   ├── generate-bulletin-text/
│   │   └── ensure-demo-users/
│   ├── migrations/             # SQL migration files (23 files)
│   └── config.toml             # Supabase project configuration
├── tools/                      # Development tools (architecture plan)
├── .gitignore                  # Git ignore patterns
├── components.json             # shadcn/ui configuration
├── eslint.config.js            # ESLint configuration
├── index.html                  # HTML entry point
├── package.json                # npm dependencies and scripts
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript base configuration
├── vite.config.ts              # Vite build configuration
└── README.md                   # Project overview (Lovable template)
```

### Key Entry Points

#### Frontend Entry Point
1. **`index.html`**: HTML shell
2. **`src/main.tsx`**: React DOM render
3. **`src/App.tsx`**: React Router setup, routes definition
4. **`src/components/AppLayout.tsx`**: Layout wrapper with sidebar navigation

#### Backend Entry Points
1. **`supabase/functions/generate-plan-completo/index.ts`**: Lesson plan generation
2. **`supabase/functions/modify-evaluation/index.ts`**: Evaluation modification + plain-text plans
3. **`supabase/functions/generate-bulletin-text/index.ts`**: Bulletin text generation

#### Key Routes (`src/App.tsx`)
```typescript
// Public
"/" → RoleSelection (login screen)
"/teacher-login" → TeacherLogin
"/student-login" → StudentLogin

// Protected Teacher Routes
"/teacher-dashboard" → TeacherDashboard
"/teacher-groups" → TeacherGroups
"/planificacion/nuevo" → PlanificacionWizard (4-step wizard)
"/planificacion/:id" → PlanificacionWorkspace (calendar + editor)
"/mis-planificaciones" → MisPlanificaciones (saved plans list)
"/evaluaciones/nuevo" → EvaluacionesGrupo (evaluation generator)
"/mis-evaluaciones" → MisEvaluaciones (saved evaluations list)
"/mis-evaluaciones/:id" → EvaluacionDetalle (evaluation detail view)
"/comunicaciones" → Comunicaciones (communications, planned)

// Protected Student Routes
"/student-diagnostic" → StudentDiagnostic (student self-assessment)
```

### Major Directories Explained

#### `src/components/`
- **General Components**: Dashboard, GroupProfile, TeacherDashboard, etc.
- **`evaluaciones/`**: Evaluation-specific components
  - `EnhancedSmartRubric.tsx`: AI-generated rubric display
  - `EvaluationInfoHeader.tsx`: Evaluation metadata display
  - `HTMLRenderer.tsx`: Safely render AI-generated HTML
- **`planificacion/`**: Planning-specific components
  - `CalendarioDnD.tsx`: Drag-and-drop calendar for sessions
  - `EditorSesionNuevo.tsx`: Session editor (HTML + resources)
  - `UnidadDidacticaBuilder.tsx`: Build didactic units (content + competencies)
  - `WizardSteps.tsx`: Wizard UI components
- **`ui/`**: shadcn/ui components (buttons, cards, dialogs, etc.)

#### `src/data/`
- **`competencias.ts`**: ANEP Historia competencies (Competencias Específicas, Criterios de Logro)
- **`competenciasCiudadania.ts`**: Citizenship competencies
- **`competenciasLiteratura.ts`**: Literature competencies
- **`catalogo.ts`**: Content catalog (e.g., "Surgimiento del Batllismo")
- **`mockData.ts`**: Mock groups and students (570 lines)
  - Group interface: `Group` (id, name, students, teacher_sugerencias)
  - Student interface: `Student` (id, name, perfil, ajustes, contemplaciones, informeTecnico)

#### `src/hooks/`
- **`usePlanificacionWizard.ts`**: Wizard state machine (paso 0-3), validation logic
- **`useFullSessionGeneration.ts`**: AI-powered session generation (calls modify-evaluation)
- **`useCalendarioSesiones.ts`**: Calendar state management (drag-and-drop, slot booking)
- **`useBulletinGenerator.ts`**: Generate bulletin text from evaluation results
- **`useAIPlanification.ts`**: Legacy planning hook (partially replaced)

#### `src/lib/`
- **`planParser.ts`**: Parse AI-generated HTML into structured sections (Inicio, Desarrollo, Cierre, etc.)
- **`normalizeSupabaseArrays.ts`**: Fix Supabase array serialization bugs (string → array)
- **`contentCleaner.ts`**: Clean HTML content (remove scripts, sanitize)
- **`durationValidator.ts`**: Validate session durations
- **`sessionPlanGenerator.ts`**: Legacy plan generator (fallback if AI fails)
- **`registroCompetencialPDF.ts`**: Generate PDF reports

#### `src/utils/`
- **`groupContext.ts`**: Load group profile + student adjustments (Supabase + mockGroups hybrid)
  - `loadGroupContext(grupoId)`: Fetch teacher_sugerencias from Supabase, student data from mockGroups
  - `getGrupoIdFromPlanificacion(planificacionId)`: Helper to derive grupoId

#### `supabase/migrations/`
- 23 SQL migration files (schema evolution)
- Key migrations:
  - `20250923163758_*.sql`: Initial schema (planificaciones, sesiones_clase)
  - `20251219163000_*.sql`: Add explicit save (is_saved, saved_at, deleted_at)
  - `20251222000000_*.sql`: Add evaluaciones table
  - `20251226174831_*.sql`: Add grupos table (teacher_sugerencias)
  - `20251227003612_*.sql`: Add session_brief column

---

## E. Runtime Environments

### Local Development Workflow

1. **Install Dependencies**:
   ```bash
   npm install
   # OR
   bun install
   ```

2. **Environment Variables**:
   Create `.env` file at project root (not in repo, .gitignore):
   ```bash
   VITE_SUPABASE_URL=https://srlrbuphsogwgymqywhe.supabase.co
   VITE_SUPABASE_ANON_KEY=<your_anon_key>
   ```
   **Where to get these**:
   - Supabase Dashboard → Project Settings → API
   - `VITE_SUPABASE_URL`: Project URL
   - `VITE_SUPABASE_ANON_KEY`: "anon public" key (NOT service_role)

3. **Run Development Server**:
   ```bash
   npm run dev
   # Opens at http://localhost:8080 (configured in vite.config.ts)
   ```

4. **Access Supabase Locally** (Optional):
   - Install Supabase CLI: `npm install -g supabase`
   - Start local Supabase: `supabase start`
   - Update `.env` to point to local instance: `http://localhost:54321`

5. **Login**:
   - Navigate to `http://localhost:8080`
   - Select "Docente" (Teacher)
   - Enter any non-empty username/password (demo mode accepts all)
   - Background: Auto-authenticates with `demo.teacher@example.com`

### Environment Variables Used in Code

**Frontend** (`src/integrations/supabase/client.ts`):
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

**Edge Functions** (Supabase manages these):
```typescript
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
```
**Set in**: Supabase Dashboard → Project Settings → Edge Functions → Secrets

### Staging vs. Production

**Current Setup**: Single production environment (Lovable.dev)
- No explicit staging environment
- `npm run build:dev` exists but not used in CI/CD
- Lovable deploys directly from `main` branch (assumed)

**Recommendations**:
- Add staging environment with separate Supabase project
- Use branch-based deployments (e.g., `staging` branch → staging Supabase)
- Environment variables per environment (Lovable supports this)

---

## F. Backend/API Surface Area

### Supabase Database Schema

#### Table: `planificaciones`

**Purpose**: Store lesson plans (multi-week/multi-session plans)

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `grupo_id` (text) - References mock group (e.g., "9no 1")
- `materia` (text) - Subject (e.g., "Historia")
- `nivel` (text, legacy) - Level (e.g., "9no")
- `fecha_inicio`, `fecha_fin` (date) - Planning period
- `competencias_seleccionadas` (text[]) - Selected ANEP competency IDs
- `contenidos_programa` (text) - Content IDs (comma-separated, legacy)
- `mapeo_competencias_contenidos` (jsonb) - Mapping: `{ contenido_id: [competencia_ids] }`
- `requerimientos_docente` (text) - Teacher's custom instructions
- `distribucion_modalidades` (jsonb) - `{ individual, pareja, grupos, toda_clase }` percentages
- `estrategias_diferenciacion` (text) - Differentiation strategies
- `horas_semanales` (integer) - Weekly hours
- `configuracion_horario` (jsonb) - Array of `{ dia, horaInicio, horaFin, duracionMinutos }`
- `nombre` (text, nullable) - Custom name (overrides default materia - grupo_id)
- `is_saved` (boolean, default false) - Explicit save flag (shows in "Mis Planificaciones")
- `saved_at` (timestamptz, nullable) - When explicitly saved
- `deleted_at` (timestamptz, nullable) - Soft delete
- `created_at`, `updated_at` (timestamptz)

**RLS Policies**:
- SELECT, INSERT, UPDATE, DELETE: `auth.uid() = user_id`

**Indexes**:
- `idx_planificaciones_user_id` ON `user_id`
- `idx_planificaciones_materia` ON `materia`

**Trigger**: `update_planificaciones_updated_at` (auto-update `updated_at`)

#### Table: `sesiones_clase`

**Purpose**: Individual class sessions (children of planificaciones)

**Key Columns**:
- `id` (uuid, PK)
- `planificacion_id` (uuid, FK → planificaciones, ON DELETE CASCADE)
- `fecha` (date, nullable) - Session date (NULL if backlog)
- `duracion_minutos` (integer) - Session duration (e.g., 60)
- `competencias_anep` (text[]) - ANEP competency IDs
- `contenidos_anep` (text[]) - ANEP content IDs
- `criterios_logro_anep` (text[]) - ANEP criteria IDs
- `plan_desarrollo` (jsonb) - `{ inicio: {...}, desarrollo: {...}, cierre: {...} }`
- `diferenciacion` (text, nullable) - Differentiation notes
- `evaluacion` (jsonb) - Evaluation config: `{ tipo, configuracion, contenido }`
- `recursos` (text[]) - Resources (e.g., ["Pizarra", "Video"])
- `observaciones` (text, nullable) - Teacher notes
- `estado` (text) - 'backlog' | 'planificada' | 'dictada' | 'omitida' | 'pausada'
- `es_feriado` (boolean) - Holiday flag
- `motivo_excepcion` (text, nullable) - Exception reason
- `orden` (integer) - Order in planificacion (1, 2, 3, ...)
- `semana_objetivo` (integer, nullable) - Target week
- `bloque_preferido` (jsonb, nullable) - Preferred time slot
- `bloqueo_reserva` (boolean) - Slot reservation lock
- `motivo_cambio` (text, nullable) - Change reason
- `argumento_competencias` (text, nullable) - AI justification for competency selection
- `titulo` (text, nullable) - Session title
- `evaluacion_docente` (text, nullable) - Teacher's evaluation of session
- `session_brief` (text, nullable) - **PHASE 3.2**: Teacher-specified topic focus (takes priority in AI generation)
- `created_at`, `updated_at` (timestamptz)

**RLS Policies**:
- SELECT, INSERT, UPDATE, DELETE: `EXISTS (SELECT 1 FROM planificaciones WHERE id = planificacion_id AND user_id = auth.uid())`

**Indexes**:
- `idx_sesiones_clase_planificacion_id` ON `planificacion_id`
- `idx_sesiones_clase_fecha` ON `fecha`
- `idx_sesiones_clase_estado` ON `estado`
- **PHASE 4.6**: `idx_sesiones_clase_planificacion_orden` ON `(planificacion_id, orden)` (performance optimization)

**Trigger**: `update_sesiones_clase_updated_at`

**Normalization Issue**: `competencias_anep` may be stored as string instead of array (bug in old Supabase client)
- **Fix**: `normalizeArrayField()` in `src/lib/normalizeSupabaseArrays.ts`

#### Table: `evaluaciones`

**Purpose**: Store generated evaluations (assessments)

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `nombre` (text) - Custom name
- `materia` (text) - Subject
- `grupo_id` (text) - Group ID
- `nivel` (text, nullable) - Level
- `fecha` (date, nullable) - Evaluation date
- `competencias_anep` (text[]) - Competency IDs
- `contenidos` (text[]) - Content IDs
- `criterios_logro` (text[]) - Criteria IDs
- `requerimientos` (text, nullable) - Requirements
- `evaluacion_generada` (jsonb) - Generated evaluation content: `{ versiones: [...] }`
- `rubrica` (jsonb) - Rubric data
- `configuracion` (jsonb) - Additional config
- `is_saved` (boolean, default false) - Explicit save flag
- `saved_at` (timestamptz, nullable)
- `deleted_at` (timestamptz, nullable) - Soft delete
- `created_at`, `updated_at` (timestamptz)

**RLS Policies**:
- SELECT, INSERT, UPDATE, DELETE: `auth.uid() = user_id`

**Indexes**:
- `idx_evaluaciones_user_saved` ON `(user_id, is_saved, deleted_at)` WHERE `is_saved = true AND deleted_at IS NULL`
- `idx_evaluaciones_filters` ON `(materia, grupo_id, fecha)` WHERE `is_saved = true AND deleted_at IS NULL`
- `idx_evaluaciones_competencias` GIN ON `competencias_anep` WHERE `is_saved = true AND deleted_at IS NULL`

**Trigger**: Auto-generated `updated_at` trigger

#### Table: `grupos`

**Purpose**: Store group metadata and teacher-editable suggestions

**Key Columns**:
- `id` (text, PK) - Group ID (e.g., "9no 1")
- `name` (text) - Group name (e.g., "9no 1")
- `year` (text, nullable) - Year (e.g., "9no")
- `section` (text, nullable) - Section (e.g., "1")
- `user_id` (uuid, FK → auth.users)
- `teacher_sugerencias` (jsonb, nullable) - `{ aula?: string, evaluaciones?: string, otras?: string }`
- `created_at`, `updated_at` (timestamptz)

**RLS Policies**:
- SELECT, INSERT, UPDATE: `auth.uid() = user_id`

**Indexes**:
- `idx_grupos_user_id` ON `user_id`

**Trigger**: `update_grupos_updated_at`

**Note**: This table does NOT store students (students are in mockData.ts for now)

#### Table: `profiles`

**Purpose**: Extended user profiles

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, UNIQUE)
- `display_name` (text, nullable)
- `role` (text, default 'teacher') - 'teacher' | 'student'
- `created_at`, `updated_at` (timestamptz)

**RLS Policies**:
- SELECT, INSERT, UPDATE: `auth.uid() = user_id`

**Trigger**: `update_profiles_updated_at`

### Edge Functions (Supabase Functions)

#### Function: `generate-plan-completo`

**Path**: `supabase/functions/generate-plan-completo/index.ts`

**Purpose**: Generate complete HTML lesson plan for a single session

**HTTP Method**: POST

**Request Payload**:
```typescript
{
  modo: 'generar_plan_html',
  sesionId: string,
  orden: number,
  duracionMin: number,
  materia: string,
  nivel: string,
  contenidos: string[],                // ANEP content IDs
  competencias: string[],              // ANEP competency IDs
  criterios: string[],                 // ANEP criteria IDs
  perfilGrupo?: {                      // PHASE 3/4: Group profile
    tamanio: number,
    dominante: string,
    distribucion?: Record<string, number>
  },
  estudiantes?: Array<{                // PHASE 3/4: Student adjustments
    perfil?: string,
    ajustes?: string,
    contemplaciones?: string[]
  }>,
  instruccionesDocente?: string,       // Teacher custom instructions
  planActual?: string,                 // Current plan (for modification)
  unitContext?: {                      // PHASE 2: Didactic unit context
    unidadId: string,
    contenido: string,
    claseEnUnidad: number,
    totalClasesUnidad: number,
    isExtraSlot?: boolean
  },
  sessionBrief?: string                // PHASE 3.2: Teacher-specified topic focus (BINDING)
}
```

**Response**:
```typescript
{
  plan_html: string,                   // HTML with structure: <section id="plan">...</section>
  recursos: string[],                  // Auto-extracted resources
  argumento_competencias: string       // AI justification for competency selection
}
```

**AI Model**: `gpt-4o-mini` (default), fallback to `gpt-4.1-2025-04-14`

**Temperature**: 0.7, Max Tokens: 3000

**Prompt Structure**:
1. System message: "You are a pedagogical expert..."
2. User message with:
   - Sequence context (if unitContext)
   - Session brief section (if sessionBrief) - **PEDAGOGICALLY BINDING**
   - Group profile section (if perfilGrupo or estudiantes)
   - ANEP competencies, content, criteria
   - Output format rules (strict HTML structure)
   - Pedagogical rules (explicit profile-driven decisions)

**Output Format** (HTML):
```html
<section id="plan">
  <h1>Session Title</h1>
  <h2><strong>Inicio</strong></h2>
  <p><strong>Actividad:</strong> ...</p>
  <p><strong>Recursos:</strong> ...</p>
  <h2><strong>Desarrollo</strong></h2>
  <p><strong>Actividad:</strong> ...</p>
  <p><strong>Recursos:</strong> ...</p>
  <h2><strong>Cierre</strong></h2>
  <p><strong>Actividad:</strong> ...</p>
  <p><strong>Recursos:</strong> ...</p>
  <h2><strong>Diferenciación/Adaptaciones</strong></h2>
  <ul>
    <li><strong>Momento:</strong> ... <strong>Perfil:</strong> ... <strong>Propósito:</strong> ... <strong>Cómo aplicarla:</strong> ...</li>
  </ul>
</section>
```

**Error Handling**:
- Retry logic: 3 attempts with exponential backoff (429 rate limits)
- Fallback model if primary model fails
- Returns error details in response

**CORS**: Enabled for all origins (`Access-Control-Allow-Origin: *`)

#### Function: `modify-evaluation`

**Path**: `supabase/functions/modify-evaluation/index.ts`

**Purpose**: Dual-purpose function
1. Modify existing evaluations
2. Generate plain-text lesson plans (used by `useFullSessionGeneration`)

**HTTP Method**: POST

**Request Payload (Type: evaluation modification)**:
```typescript
{
  type: 'modification',
  originalEvaluation: string,
  modification: string,
  groupContext: {
    subject: string,
    content: string[],
    groupName: string,
    adaptationLevel?: 'standard' | 'moderate' | 'high'
  }
}
```

**Request Payload (Type: planning)**:
```typescript
{
  type: 'planning',
  modification: string,                // Prompt describing what to generate
  groupContext: {
    subject: string,
    content: string[],
    competencies: string[],
    groupName: string,
    additionalContext?: string,        // PHASE 4: Enriched with teacher_sugerencias
    students?: Array<{...}>,           // PHASE 4: Anonymized student adjustments
    dominantProfile?: string           // PHASE 4: Dominant learning style
  },
  unitContext?: {...},                 // PHASE 2: Didactic unit context
  sessionBrief?: string                // PHASE 3: Teacher-specified topic focus
}
```

**Response**:
```typescript
{
  content: string                      // Plain text (for planning) or modified HTML (for evaluation)
}
```

**AI Model**: `gpt-4o-mini` (default)

**Temperature**: 0.7

**Output Format (Planning)**:
```
INICIO

Actividad: ...
Recursos: ...

DESARROLLO

Actividad: ...
Recursos: ...

CIERRE

Actividad: ...
Recursos: ...
```

**Note**: This function's "planning" mode is used by `useFullSessionGeneration` for legacy flows. New flows use `generate-plan-completo`.

#### Function: `generate-bulletin-text`

**Path**: `supabase/functions/generate-bulletin-text/index.ts`

**Purpose**: Generate bulletin (report card) text from evaluation results

**HTTP Method**: POST

**Request Payload**:
```typescript
{
  studentName: string,
  subject: string,
  evaluationResults: string,          // Summary of evaluation results
  context?: string                    // Additional context
}
```

**Response**:
```typescript
{
  bulletinText: string                // Generated bulletin text
}
```

**AI Model**: `gpt-4o-mini`

**Temperature**: 0.5 (more deterministic)

**Prompt**: Generates concise, professional bulletin text summarizing student performance

#### Function: `ensure-demo-users`

**Path**: `supabase/functions/ensure-demo-users/index.ts`

**Purpose**: Setup demo users for authentication (called on app init)

**HTTP Method**: POST

**Request Payload**: None

**Response**:
```typescript
{
  message: string,
  users: Array<{ email: string, created: boolean }>
}
```

**Logic**:
- Checks if demo users exist in Supabase Auth
- Creates them if missing (email: `demo.teacher@example.com`, password: `DemoPassword2024!`)
- Uses service_role key (admin access)

### Supabase RLS Policies Summary

**All tables enforce Row Level Security**:
- Users can only access their own data (`auth.uid() = user_id`)
- `sesiones_clase` enforced via parent `planificaciones` check
- Demo mode: All users share same Supabase user (authenticated as `demo.teacher@example.com`)

**Security Note**: Frontend auth is mock-based (any credentials work), real Supabase session happens silently in background. This is DEMO-only, not production-ready.

### Supabase Storage

**Status**: Not currently used
- No files uploaded/stored in Supabase Storage
- PDF generation happens client-side (jspdf, html2canvas)

---

## G. Core Domains + Business Logic

### Domain: Planificación (Lesson Planning)

**Entities**:
1. **Planificacion** (Multi-week plan)
   - Owner: Teacher (user_id)
   - Belongs to: Group (grupo_id)
   - Has many: Sesiones Clase
   - Contains: Didactic units, competencies, schedule configuration

2. **SesionClase** (Individual class session)
   - Belongs to: Planificacion
   - Has: Plan development (Inicio, Desarrollo, Cierre), Resources, Differentiation
   - Status: backlog → planificada → dictada | omitida | pausada

3. **UnidadDidactica** (Didactic unit, in-memory only)
   - Not stored in DB (in-memory during wizard)
   - Contains: Content ID, competencies, estimated class count
   - Purpose: Structure content into thematic chunks

**Key Business Logic**:

#### Wizard State Machine (`usePlanificacionWizard.ts`)
```typescript
Paso 0 (Contexto): Validate grupo_id, materia, tipo_planificacion, dates/sessions
  ↓
Paso 1 (Horario): Validate horas_semanales, configuracion_horario
  ↓
Paso 2 (Contenido): Build UnidadDidactica[], assign sessions to units
  ↓
Paso 3 (Enfoque): Set modalidades, diferenciacion, sessionBriefs
  ↓
Finalizar: Create planificacion + sesiones_clase in DB
```

#### AI Plan Generation (`generate-plan-completo`)
- **Input**: ANEP competencies + content + group profile + session brief
- **Process**: OpenAI GPT generates structured HTML
- **Output**: HTML plan (Inicio, Desarrollo, Cierre, Diferenciación) + resources
- **Validation**: Parse HTML, extract sections, sanitize

#### Plan Parsing (`planParser.ts`)
- **Function**: `parsePlan(html, fallbackResources)`
- **Output**: `{ inicio, desarrollo, cierre, diferenciacion, recursos }`
- **Normalization**: Remove duplicate headings, extract resources from HTML

#### Session State Management (`useCalendarioSesiones.ts`)
- **States**: backlog, planificada, dictada, omitida, pausada
- **Transitions**:
  - backlog → planificada (drag to calendar)
  - planificada → dictada (mark as completed)
  - planificada → backlog (drag back)
  - planificada → omitida (skip session)

### Domain: Evaluación (Evaluation/Assessment)

**Entities**:
1. **Evaluacion** (Evaluation)
   - Owner: Teacher (user_id)
   - Target: Group (grupo_id), Subject (materia)
   - Contains: Generated content, rubric, versions (standard, adapted)

2. **Rubric** (Rubric)
   - Embedded in Evaluacion (rubrica jsonb)
   - Structure: Competencies → Criteria → Levels → Descriptors

**Key Business Logic**:

#### Evaluation Generation (`EnhancedEvaluationGenerator.tsx`)
```typescript
1. Teacher selects: subject, content, group, requirements
2. For each version (standard, moderate, high adaptation):
   - Call modify-evaluation with adaptationLevel
   - Generate HTML evaluation content
   - Extract rubric criteria from competencies
3. Display side-by-side comparison
4. Teacher saves selected version → evaluaciones table
```

#### Smart Rubric (`EnhancedSmartRubric.tsx`)
- **Auto-generation**: Based on selected ANEP competencies
- **Levels**: Sobresaliente, Satisfactorio, En desarrollo, Requiere apoyo
- **Criteria**: Aligned to Criterios de Logro (ANEP)
- **Descriptors**: AI-generated based on competency descriptions

#### Version Personalization (`VersionPersonalization.tsx`)
- **Standard Version**: No adaptations
- **Moderate Version**: Some scaffolding, visual aids, simplified language
- **High Version**: Extensive supports, oral options, concrete materials

### Domain: Grupo (Group/Class)

**Entities**:
1. **Group** (Class section)
   - Stored in: `grupos` table (metadata only) + `mockData.ts` (students)
   - Contains: Students, teacher suggestions
   - Properties: Learning style distribution, size

2. **Student** (Individual learner)
   - Stored in: `mockData.ts` (not in DB yet)
   - Contains: Learning style, adjustments (contemplaciones), technical report (informeTecnico)
   - Privacy: Anonymized in AI prompts

**Key Business Logic**:

#### Group Profile Loading (`groupContext.ts`)
```typescript
loadGroupContext(grupoId):
  1. Fetch teacher_sugerencias from Supabase grupos table
  2. Fetch students from mockGroups (fallback)
  3. Calculate learning style distribution
  4. Determine dominant style (most frequent)
  5. Anonymize students (only perfil, ajustes, contemplaciones)
  6. Filter students with adjustments
  7. Cap to 10 students (avoid huge prompts)
  8. Return { perfilGrupo, estudiantes, teacherSugerencias }
```

#### Learning Styles
- **Types**: Visual, Kinestésico (Kinesthetic), Auditivo, Lector/Escritor
- **Composite**: Students can have multiple (e.g., "Visual-Kinestésico")
- **Calculation**: Count occurrences, determine dominant
- **Usage**: AI includes profile-driven decisions in activities

#### Student Adjustments (Contemplaciones)
- **Examples**:
  - "Lectura oral de consignas" (Oral reading of instructions)
  - "Tiempo adicional y pausas" (Additional time and breaks)
  - "Palabras clave en negrita" (Bold keywords)
- **Purpose**: Inform differentiation in lesson plans and evaluations
- **Anonymization**: Names replaced with "Estudiante A/B/C" in AI prompts

### Domain: Competencias (Competencies & Curriculum)

**Entities**:
1. **Competencia Específica** (Specific Competency)
   - From: ANEP official curriculum
   - Structure: ID, código, nombre, descripción, criterios de logro
   - Example: "CE1: Interpreta e interrelaciona de forma crítica información..."

2. **Criterio de Logro** (Achievement Criterion)
   - Child of: Competencia Específica
   - Example: "CL1.1: Contrasta fuentes históricas..."

3. **Contenido** (Content)
   - From: ANEP official program
   - Example: "Surgimiento del Batllismo" (History, 9th grade)

**Data Sources**:
- `src/data/competencias.ts` (Historia)
- `src/data/competenciasCiudadania.ts` (Citizenship)
- `src/data/competenciasLiteratura.ts` (Literatura)
- `src/data/catalogo.ts` (Content catalog)

**Key Business Logic**:

#### Competency Selection (`CompetenceSelector.tsx`)
- Teacher selects competencies from hierarchical list
- System validates: At least 1 competency selected
- Mapping: Competencies → Content (many-to-many)

#### Competency Justification
- AI generates "argumento_competencias" explaining why selected competencies fit the content
- Stored in `sesiones_clase.argumento_competencias`

---

## H. Critical Components

### 1. `PlanificacionWizard.tsx` (Wizard Orchestrator)

**Responsibility**: 4-step wizard for creating lesson plans

**Key Functions**:
- `handleSiguiente()`: Navigate forward, validate current step
- `handleAtras()`: Navigate backward
- `handleFinish()`: Create planificacion + generate sessions
- `generarPlanesAutomaticamente()`: AI generation for all sessions

**Dependencies**:
- `usePlanificacionWizard` (state management)
- `loadGroupContext` (load group profile)
- `generate-plan-completo` (AI generation)

**God Object Risk**: ⚠️ High (800+ lines, multiple responsibilities)
- **Recommendations**:
  - Extract session generation logic to custom hook
  - Split wizard steps into separate components
  - Move validation to dedicated utility

### 2. `EditorSesionNuevo.tsx` (Session Editor)

**Responsibility**: Edit individual session plans (HTML + resources + metadata)

**Key Functions**:
- `handleGenerarPlanInicial()`: Generate plan with AI
- `handleModificar()`: Modify existing plan with AI
- `handleGuardarCambios()`: Save to database
- `handlePDFExport()`: Export to PDF

**UI Features**:
- Tabs: Clase (main plan), Evaluación, Observaciones
- HTML editing with rich text
- Resource management (add/delete)
- Differentiation section display

**Dependencies**:
- `planParser.ts` (parse AI HTML)
- `generate-plan-completo` (AI generation)
- `PDFGenerator` (export)

**God Object Risk**: ⚠️ High (969 lines, complex state)
- **Recommendations**:
  - Extract AI generation logic to custom hook
  - Split tabs into separate components
  - Move PDF export to separate module

### 3. `generate-plan-completo/index.ts` (Edge Function)

**Responsibility**: AI lesson plan generation (core business logic)

**Key Logic**:
- Construct AI prompt with context
- Call OpenAI API
- Retry on rate limits
- Validate output format
- Extract resources from HTML

**Prompt Engineering**:
- **Sequence Context**: Guides progressive content across multi-class units
- **Session Brief**: Teacher-specified topic (takes absolute priority)
- **Group Profile**: Learning styles + student adjustments
- **Pedagogical Rules**: Force explicit profile-driven decisions

**God Object Risk**: ⚠️ Medium (426 lines, single file)
- **Recommendations**:
  - Extract prompt building to separate module
  - Extract OpenAI call logic to reusable function
  - Add comprehensive error logging

### 4. `groupContext.ts` (Group Profile Loader)

**Responsibility**: Single source of truth for group data

**Key Function**: `loadGroupContext(grupoId)`
- Fetch teacher_sugerencias from Supabase
- Fetch students from mockGroups
- Calculate learning style distribution
- Anonymize student data
- Cap to 10 students

**Hybrid Approach**: Supabase (teacher_sugerencias) + mockGroups (students)
- **Reason**: No student table in DB yet
- **Future**: Replace mockGroups with real Supabase query

**God Object Risk**: ✅ Low (266 lines, single responsibility)

### 5. `planParser.ts` (HTML Parser)

**Responsibility**: Parse AI-generated HTML into structured plan

**Key Function**: `parsePlan(html, fallbackRecursos)`
- Extract sections by regex: Inicio, Desarrollo, Cierre, Diferenciación
- Extract resources from HTML
- Clean duplicate headings
- Normalize structure

**Complexity**: High (regex-based parsing, brittle)
- **Risks**: AI output format changes break parser
- **Recommendations**:
  - Add comprehensive tests
  - Consider AST-based parsing (e.g., jsdom)
  - Add validation for expected HTML structure

### 6. `normalizeSupabaseArrays.ts` (Array Normalization)

**Responsibility**: Fix Supabase array serialization bug

**Key Function**: `normalizeArrayField(field)`
- Convert string → array
- Handle `{item1,item2}` format (Postgres array literal)
- Handle null/undefined

**Why Needed**: Old Supabase client bug sometimes returns arrays as strings
- **Status**: Workaround, should be fixed upstream
- **Recommendation**: Monitor Supabase updates, remove when fixed

### 7. `EvaluacionesGrupo.tsx` (Evaluation Generator)

**Responsibility**: Wizard for creating evaluations

**Key Functions**:
- `handleGenerateEvaluations()`: Generate 3 versions (standard, moderate, high)
- `handleSaveEvaluation()`: Save to database
- Rubric management
- Version comparison

**Dependencies**:
- `EnhancedSmartRubric` (display rubric)
- `modify-evaluation` (AI generation)

**God Object Risk**: ⚠️ High (1600+ lines, multiple responsibilities)
- **Recommendations**:
  - Extract version generation to custom hook
  - Split wizard steps into separate components
  - Move rubric logic to dedicated module

### 8. `AuthContext.tsx` (Authentication)

**Responsibility**: Manage user authentication and session

**Key Features**:
- Demo mode: Any credentials accepted
- Silent Supabase auth: Background session creation
- Mock user data: Stored in localStorage

**Security Risk**: ⚠️ Critical
- **Current**: Demo-only, NOT production-ready
- **Issues**:
  - No real authentication
  - Service role key exposed (in edge function)
  - All users share same Supabase user
- **Recommendations**:
  - Implement real auth (email/password, OAuth)
  - Remove demo user auto-creation
  - Implement proper user registration

---

## I. Observability and Error Handling

### Logging

**Frontend Logging**:
- **Console logs**: Extensive use of `console.log`, `console.error`, `console.warn`
- **Dev-only**: `if (import.meta.env.DEV)` guards in `supabase/client.ts`
- **Phase markers**: `[PHASE3-Profile]`, `[PHASE4-EditorSesion]` for debugging

**Backend Logging** (Edge Functions):
- **Console logs**: Deno `console.log`, `console.error`
- **Request logs**: Supabase dashboard (Edge Functions → Logs)
- **Error details**: Full stack traces in response

**Recommendations**:
- ❌ No structured logging (no log levels, no log aggregation)
- ❌ No log retention policy
- ✅ Add structured logging library (e.g., pino, winston)
- ✅ Send logs to external service (e.g., Sentry, LogRocket)

### Monitoring

**Status**: ❌ No monitoring infrastructure
- No APM (Application Performance Monitoring)
- No error tracking service
- No uptime monitoring
- No performance metrics

**Recommendations**:
- Add Sentry for error tracking
- Add Vercel Analytics (if migrating from Lovable)
- Add Web Vitals tracking (Core Web Vitals)
- Add Supabase dashboard monitoring alerts

### Error Boundaries

**Frontend**: `src/components/ErrorBoundary.tsx`
- Catches React errors
- Displays fallback UI: "Algo salió mal"
- **Issue**: Basic implementation, no error reporting

**Recommendations**:
- Add error reporting to Sentry
- Add "Retry" button in fallback UI
- Add error context (componentStack, props)

### Retry Logic

**Edge Functions**: Exponential backoff for OpenAI rate limits
```typescript
retryWithBackoff(fn, maxRetries=3, baseDelay=1000):
  - Attempt 1: No delay
  - Attempt 2: 1s delay
  - Attempt 3: 2s delay
  - Gives up after 3 attempts
```

**Frontend**: ❌ No retry logic
- Failed API calls not retried
- User must manually retry (refresh page or re-submit)

**Recommendations**:
- Add React Query retry config
- Add exponential backoff for transient errors

### Toast Notifications

**Library**: Sonner (`sonner`) + shadcn/ui Toast
- **Usage**: User feedback for actions (success, error, info)
- **Pattern**: `toast.success()`, `toast.error()`, `toast.info()`

**Locations**: Throughout components (e.g., after save, after AI generation)

### Error Types & Handling

| Error Type | Handling | User Feedback |
|------------|----------|---------------|
| **Supabase Query Error** | Try/catch, log error | Toast: "Error al guardar" |
| **OpenAI Rate Limit (429)** | Retry 3x with backoff | Toast: "Servicio temporalmente no disponible" |
| **OpenAI API Error** | Try fallback model, log error | Toast: "Error generando plan" |
| **Validation Error** | Display field errors, prevent submit | Inline error messages |
| **Network Error** | Display toast, log error | Toast: "Error de conexión" |
| **Parsing Error** | Use fallback content | Toast: "Advertencia: formato inesperado" |

---

## J. Risks / Known Issues / TODOs

### Architectural Pain Points

#### 1. God Objects / Monolithic Components

**Issue**: Several components exceed 800+ lines with multiple responsibilities

**Files**:
- `PlanificacionWizard.tsx` (800+ lines)
- `EditorSesionNuevo.tsx` (969 lines)
- `EvaluacionesGrupo.tsx` (1600+ lines)

**Impact**:
- Hard to test
- Hard to refactor
- High cognitive load
- Merge conflicts

**Recommendation**: Break into smaller components, extract hooks

#### 2. Coupling: Mock Data + Database

**Issue**: Student data hardcoded in `mockData.ts`, but group metadata in Supabase

**Hybrid Approach**: `loadGroupContext()` mixes sources
- teacher_sugerencias → Supabase
- students → mockGroups

**Impact**:
- Cannot add students in production
- Inconsistent data model
- Demo-only limitation

**Recommendation**: Create `students` table in Supabase, migrate data

#### 3. Array Normalization Hell

**Issue**: Supabase returns arrays as strings (bug in old client)

**Workaround**: `normalizeArrayField()` everywhere

**Files**: 15+ files import and use this utility

**Impact**:
- Boilerplate code
- Easy to forget
- Performance overhead

**Recommendation**: Upgrade `@supabase/supabase-js` to latest, test if bug persists

#### 4. AI Output Parsing Brittleness

**Issue**: `planParser.ts` uses regex to parse AI-generated HTML

**Risk**: AI output format changes break parser

**Example**: If AI adds unexpected headings, parser fails

**Impact**: Plans fail to save, user sees raw HTML

**Recommendation**:
- Add AI output validation (schema)
- Use HTML parser (jsdom, DOMParser)
- Add fallback: Save raw HTML if parsing fails

#### 5. No Testing Infrastructure

**Issue**: Zero tests (except one unused file)

**Impact**:
- Refactoring is risky
- Regressions undetected
- Hard to onboard new developers

**Recommendation**: Add Vitest + React Testing Library, start with critical paths

#### 6. Security: Demo-Only Auth

**Issue**: Current auth is demo-only, not production-ready

**Risks**:
- No real user management
- All users share same Supabase user
- Service role key exposed (in edge function)
- Any credentials accepted

**Impact**: Cannot deploy to production

**Recommendation**: Implement real authentication (Supabase Auth with proper flows)

#### 7. No Staging Environment

**Issue**: Single production environment, no staging

**Risks**:
- Breaking changes deployed directly
- No pre-release testing
- Hard to debug production issues

**Recommendation**: Add staging environment with separate Supabase project

#### 8. Edge Function Timeouts

**Issue**: OpenAI calls can be slow, edge functions have 30s timeout

**Risk**: Large prompts or slow API → timeout

**Mitigation**: Retry logic exists, but not ideal

**Recommendation**:
- Optimize prompts (reduce size)
- Add progress indicators
- Consider async processing (webhook callback)

#### 9. No Database Backups

**Issue**: Unknown if Supabase backups are configured

**Risk**: Data loss

**Recommendation**: Verify Supabase backup policy, add manual backup script

#### 10. Unclear Ownership: Didactic Units

**Issue**: UnidadDidactica exists only in-memory during wizard, not persisted

**Impact**:
- Cannot edit units after creation
- Cannot reorder sessions across units
- Unit context lost after plan creation

**Recommendation**: Add `unidades_didacticas` table, persist units

### Known Issues (From Docs)

**From `docs/` review**:

1. **PGRST204 Error** (Fixed):
   - Supabase array bug, fixed with normalization
   - See: `CHANGELOG_PGRST204_FIX.md`

2. **Session Brief Not Binding** (Fixed):
   - AI was ignoring `sessionBrief` parameter
   - Fixed in Phase 3.2.1 with MANDATORY RULES in prompt
   - See: `docs/RESUMEN_SESSION_BRIEF_FIX.md`

3. **Group ID String Inconsistency** (Fixed):
   - grupo_id was sometimes number, sometimes string
   - Fixed: All grupo_id now string (consistent with UI selectors)
   - See: `docs/audit_group_id_string_consistency.md`

4. **Evaluaciones Table Missing** (Fixed):
   - Table not created in initial migrations
   - Fixed: Migration `20251222000000_add_evaluaciones_explicit_save.sql`
   - See: `docs/fix_supabase_missing_evaluaciones_table.md`

5. **Stability Issues** (Partially Fixed):
   - AI generation failures
   - Parsing errors
   - See: `docs/stability_hardening_phase1.md`

### TODOs (From Code Comments)

**High Priority**:
- [ ] Add students table in Supabase (remove mockData dependency)
- [ ] Implement real authentication (replace demo mode)
- [ ] Add testing infrastructure (Vitest + RTL)
- [ ] Add error tracking (Sentry)
- [ ] Add staging environment

**Medium Priority**:
- [ ] Refactor god components (PlanificacionWizard, EditorSesionNuevo, EvaluacionesGrupo)
- [ ] Persist didactic units in database
- [ ] Add HTML parser for AI output (replace regex)
- [ ] Add structured logging
- [ ] Add performance monitoring

**Low Priority**:
- [ ] Remove `normalizeArrayField` (upgrade Supabase client)
- [ ] Add dark mode
- [ ] Add student-facing features (diagnostics, reports)
- [ ] Add teacher collaboration features
- [ ] Add analytics dashboard

### Missing Boundaries / Unclear Ownership

| Concern | Current Owner | Recommended Boundary |
|---------|---------------|----------------------|
| **AI Prompt Construction** | Edge functions (inline) | Separate module: `src/lib/prompts/` |
| **HTML Parsing** | `planParser.ts` | Separate module: `src/lib/parsers/` |
| **Group Context** | `groupContext.ts` ✅ | Already well-bounded |
| **Validation Logic** | Scattered in components | Centralize: `src/lib/validators/` |
| **Session State Machine** | `useCalendarioSesiones.ts` | Consider XState for complex state |
| **PDF Generation** | `PDFGenerator.tsx` | Extract to `src/lib/pdf/` |
| **Rubric Generation** | `EnhancedSmartRubric.tsx` | Extract to `src/lib/rubrics/` |

---

## K. Summary & Recommendations

### What Works Well ✅

1. **Supabase Integration**: Clean abstraction, well-structured RLS policies
2. **UI Components**: shadcn/ui provides consistent, accessible components
3. **AI Integration**: Sophisticated prompt engineering with context awareness
4. **Group Profile System**: Single source of truth (`groupContext.ts`), phase-based implementation
5. **Explicit Save Pattern**: Prevents clutter in "Mis Planificaciones" / "Mis Evaluaciones"
6. **Soft Deletes**: Non-destructive, recoverable
7. **TypeScript**: Strong typing throughout (types in `src/types/`)

### Critical Improvements Needed ⚠️

1. **Authentication**: Replace demo mode with real auth
2. **Testing**: Add test infrastructure (currently zero tests)
3. **Monitoring**: Add error tracking, logging, performance monitoring
4. **Refactoring**: Break up god components (800+ lines)
5. **Data Model**: Add students table (remove mockData dependency)
6. **Staging**: Add staging environment for safe deployments
7. **Parsing**: Replace regex-based HTML parsing with robust parser

### Architecture Evolution Path

**Phase 1 (Immediate)**:
1. Add Sentry for error tracking
2. Add basic tests for critical paths
3. Implement real authentication

**Phase 2 (Short-term)**:
2. Create students table, migrate mockData
3. Add staging environment
4. Refactor largest components

**Phase 3 (Medium-term)**:
1. Persist didactic units
2. Add structured logging
3. Replace regex parsing with HTML parser

**Phase 4 (Long-term)**:
1. Add student-facing features
2. Add teacher collaboration
3. Add analytics dashboard

---

## L. Conclusion

**AulaPlus v0** is a sophisticated AI-powered pedagogical platform with strong integration between OpenAI, Supabase, and React. The codebase demonstrates advanced prompt engineering, careful attention to Uruguayan curriculum requirements (ANEP), and thoughtful user experience design.

**Key Strengths**:
- Well-structured Supabase schema with RLS
- Comprehensive UI component library (shadcn/ui)
- Sophisticated AI prompt engineering with progressive content generation
- Strong TypeScript typing

**Key Weaknesses**:
- Demo-only authentication (not production-ready)
- Large, monolithic components (hard to maintain)
- No testing infrastructure
- Brittle AI output parsing
- No monitoring/observability

**Production Readiness**: 🟡 60%
- ✅ Database, UI, core features work
- ⚠️ Auth, testing, monitoring need work
- ❌ Cannot deploy to production without auth overhaul

**Recommendation**: Focus on Phase 1 improvements (auth, tests, monitoring) before expanding features.

---

**End of Project Overview**









