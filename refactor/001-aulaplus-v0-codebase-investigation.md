# AulaPlus v0 – Codebase Investigation (2025-12-09)

## 1. Project Overview

**AulaPlus v0** is a pedagogical intelligence Single Page Application (SPA) designed for the Uruguayan education system (ANEP). The platform provides teachers and students with AI-assisted tools for:

- **Lesson Planning**: Multi-step wizard for creating complete class plans with AI-generated session content
- **Session Generation**: Automated generation of detailed class sessions with structured inicio/desarrollo/cierre sections
- **Intelligent Evaluations**: AI-assisted evaluation creation and modification with adaptation levels
- **Bulletin Text Generation**: GPT-powered report card comments aligned with Uruguay's curriculum
- **Communications**: Teacher-to-administration messaging system
- **Group & Student Diagnostics**: Profile management and learning analytics

The application is currently demo-oriented, with automatic provisioning of demo teacher accounts via Supabase Edge Functions.

**Domain Context**: The system is tailored to ANEP Uruguay's educational framework, particularly focused on Historia (History) for 9th grade, with emphasis on competency-based assessment and pedagogical accuracy.

---

## 2. Technology Stack Summary

### Frontend
- **Framework**: React 18.3.1 with TypeScript 5.5.3
- **Build Tool**: Vite 5.4.1 (SWC transpilation)
- **Routing**: React Router DOM 6.26.2 (client-side, role-based guards)
- **UI System**: shadcn/ui (62+ components) built on Radix UI primitives
- **Styling**: Tailwind CSS 3.4.11 with custom theme
- **Animations**: Framer Motion 12.19.1
- **Icons**: Lucide React 0.462.0

### State Management
- **Server State**: @tanstack/react-query 5.56.2 (caching, sync, optimistic updates)
- **Global State**: React Context API (AuthContext only)
- **Component State**: useState/useReducer

### Forms & Validation
- **Form Management**: React Hook Form 7.53.0
- **Schema Validation**: Zod 3.23.8
- **Integration**: @hookform/resolvers 3.9.0

### Backend-as-a-Service (Supabase)
- **Client SDK**: @supabase/supabase-js 2.56.1
- **Database**: PostgreSQL (5 core tables, 16 migrations applied)
- **Authentication**: Supabase Auth (demo user flow)
- **Storage**: Supabase Storage (2 buckets: `comunicaciones`, `evaluaciones-assets`)
- **Edge Functions**: 4 Deno-runtime serverless functions

### AI Integration
- **Provider**: OpenAI API
- **Models Used**:
  - `gpt-4.1-2025-04-14` (bulletin text, evaluations – high quality)
  - `gpt-4o-mini` (lesson plan generation – cost-effective)
  - `gpt-5-mini-2025-08-07` (chat responses)

### Utilities & Misc
- **Date Handling**: date-fns 3.6.0
- **PDF Generation**: jsPDF 3.0.1 + html2canvas 1.4.1
- **Notifications**: sonner 1.5.0 (toast system)
- **Class Utilities**: clsx 2.1.1 + tailwind-merge 2.5.2

### Development Tools
- **Linting**: ESLint 9.9.0 (flat config) + TypeScript ESLint 8.0.1
- **CSS Processing**: PostCSS 8.4.47 + Autoprefixer 10.4.20
- **Package Manager**: npm (primary), bun.lockb present but npm preferred

---

## 3. Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER (React SPA)                           │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  React Router (Client-Side Navigation)                     │  │
│  │    ├─ Public: /, /teacher-login, /student-login           │  │
│  │    ├─ Teacher (guarded): /teacher-dashboard,              │  │
│  │    │   /planificacion/*, /evaluaciones, /comunicaciones   │  │
│  │    └─ Student (guarded): /student-diagnostic              │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                           │
│  ┌───────────────────▼───────────────────────────────────────┐  │
│  │  Feature Layers                                            │  │
│  │    Pages (src/pages/)                                      │  │
│  │      ↓                                                     │  │
│  │    Feature Components (src/components/)                    │  │
│  │      ↓                                                     │  │
│  │    Custom Hooks (src/hooks/)  ← Business Logic            │  │
│  │      ↓                                                     │  │
│  │    React Query (cache layer)                              │  │
│  │      ↓                                                     │  │
│  │    Supabase Client (src/integrations/supabase/client.ts)  │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                           │
│  ┌───────────────────▼───────────────────────────────────────┐  │
│  │  Shared Resources                                          │  │
│  │    ├─ UI Components (src/components/ui/)                  │  │
│  │    ├─ Lib Utilities (src/lib/)                            │  │
│  │    ├─ Static Data (src/data/)                             │  │
│  │    ├─ Types (src/types/)                                  │  │
│  │    └─ Auth Context (src/contexts/)                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS (WebSocket for realtime)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SUPABASE PLATFORM (BaaS)                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Auth        │  │  PostgreSQL  │  │  Storage     │          │
│  │  (Sessions)  │  │  (5 tables)  │  │  (2 buckets) │          │
│  └──────────────┘  └──────┬───────┘  └──────────────┘          │
│                           │                                      │
│                           │ RLS Policies                         │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  Edge Functions (Deno Runtime)                       │        │
│  │    ├─ ensure-demo-users (user provisioning)         │        │
│  │    ├─ generate-plan-completo (lesson plans)         │        │
│  │    ├─ modify-evaluation (evaluations/planning)      │        │
│  │    └─ generate-bulletin-text (report cards)         │        │
│  └─────────────────────┬───────────────────────────────┘        │
└────────────────────────┼─────────────────────────────────────────┘
                         │ HTTPS API Calls
                         ▼
              ┌─────────────────────┐
              │  OpenAI API         │
              │  (GPT-4.1 / 4o-mini)│
              └─────────────────────┘
```

### Layering Rules

Based on `tools/architecture_plan.md`, dependencies flow **inward** (outer layers depend on inner layers, never reverse):

```
Pages (routes, minimal logic)
  ↓
Feature Components (feature-specific UI)
  ↓
Custom Hooks (business logic + state)
  ↓
UI Components (reusable presentational) + Lib (pure functions)
  ↓
Types (shared interfaces)
  ↓
Integrations (Supabase client)
  ↓
Data (static catalogs)
```

**Forbidden Dependencies**:
- ❌ UI Components importing Feature Components
- ❌ Lib importing React or Supabase
- ❌ Types importing implementation code
- ❌ Direct OpenAI calls from frontend (must go through Edge Functions)

---

## 4. Detailed Findings

### 4.1 Routing Map

**Entry Point**: `src/main.tsx` → `src/App.tsx`

**Route Structure** (`src/App.tsx`):

#### Public Routes
- `/` → `RoleSelection` (or redirect to dashboard if authenticated)
- `/teacher-login` → `TeacherLogin`
- `/student-login` → `StudentLogin`

#### Protected Teacher Routes (wrapped in `ProtectedTeacherRoute` + `AppLayout`)
- `/teacher-dashboard` → `TeacherDashboard`
- `/teacher-groups` → `TeacherGroups`
- `/evaluaciones` → `EvaluacionesGrupo`
- `/planificacion` → `PlanificacionClase`
- `/planificacion/nuevo` → `PlanificacionWizard`
- `/planificacion/:id` → `PlanificacionWorkspace`
- `/mis-planificaciones` → `MisPlanificaciones`
- `/comunicaciones` → `Comunicaciones`

#### Protected Student Routes (wrapped in `ProtectedStudentRoute`)
- `/student-diagnostic` → `StudentDiagnostic`

#### Fallback
- `*` → `NotFound`

**Route Guards**: Check `user.role` from `AuthContext`. Teachers must have `role === 'teacher'`, students `role === 'student'`. Unauthenticated users redirected to `/`.

---

### 4.2 Auth System

**Implementation**: `src/contexts/AuthContext.tsx`

#### Demo-Oriented Authentication Flow

1. **On App Mount**:
   - Supabase auth state listener established
   - `ensureSupabaseAuth()` function called:
     - Invokes `ensure-demo-users` edge function (creates/updates demo teacher user)
     - Signs in with hardcoded credentials: `demo.teacher@example.com` / `DemoPassword2024!`
     - Persists Supabase session in localStorage (via supabase-js)
     - Upserts `profiles` table row with `display_name: 'Profesor Demo'`, `role: 'teacher'`

2. **Login Function** (`login`):
   - Accepts `role` (`teacher`/`student`) and credentials
   - Validates non-empty username/password (any values accepted for demo)
   - Ensures Supabase session exists (calls `ensureSupabaseAuth` if needed)
   - Creates **mock frontend user** object:
     - For teachers: random name from `teacherNames` array, uses Supabase `user.id` if available
     - For students: synthetic ID and name based on username
   - Saves mock user to localStorage as `auth_user`
   - Sets user in React state

3. **Logout Function** (`logout`):
   - Clears frontend user state
   - Removes `auth_user` from localStorage
   - **Keeps Supabase session active** for seamless demo experience

4. **Session Restoration**:
   - On component mount, reads `auth_user` from localStorage
   - Restores mock user to state if found

#### Key Characteristics
- **Dual-layer**: Supabase session (for DB/RLS) + mock frontend user (for UI/routing)
- **Demo credentials**: Hardcoded in AuthContext and edge function
- **Profile sync**: Silent background upsert to `profiles` table on auth state change
- **Role-based**: `user.role` drives route guards

#### Demo User Credentials
- **Email**: `demo.teacher@example.com`
- **Password**: `DemoPassword2024!`
- **Metadata**: `role: 'teacher'`, `display_name: 'Profesor Demo'`

---

### 4.3 Supabase Edge Functions

All functions are Deno-based, located in `supabase/functions/`, with CORS headers for browser access.

#### Function: `ensure-demo-users`

**Purpose**: Create/update demo teacher user and profile (idempotent).

**Runtime**: Deno with `@supabase/supabase-js@2.39.3`

**Flow**:
1. Creates admin Supabase client with `SUPABASE_SERVICE_ROLE_KEY`
2. Lists all users (pagination up to 1000)
3. Searches for existing user with `demo.teacher@example.com`
4. If not found:
   - Creates user with `admin.createUser()` (email confirmed automatically)
   - Sets password and metadata (`role: 'teacher'`, `display_name: 'Profesor Demo'`)
5. If found:
   - Updates user password and metadata to ensure consistency
6. Upserts `profiles` table row with matching `user_id`
7. Returns `{ success: true, message: 'Demo users ensured' }`

**Environment Variables**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**RLS Bypass**: Uses service role to write to `profiles` regardless of RLS policies.

---

#### Function: `generate-plan-completo`

**Purpose**: Generate complete HTML lesson plan for a single session using AI.

**Runtime**: Deno with `@supabase/supabase-js` (not used in implementation)

**Input** (JSON body):
```typescript
{
  modo: 'generar' | 'regenerar',
  sesionId: string,
  orden: number,
  duracionMin: number,
  materia: string,
  nivel: string,
  contenidos: string[],
  competencias: string[],
  criterios: string[],
  perfilGrupo?: { dominante: string, tamanio: number },
  estudiantes?: Array<{ ajustes: string[] }>,
  instruccionesDocente?: string,
  planActual?: string  // For modifications
}
```

**AI Prompt Structure**:
- System: "Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP)"
- User: Detailed prompt with context, estructura obligatoria (HTML), requisitos estrictos
- Enforces HTML-only output (NO Markdown)
- Requires specific sections: `<h2><strong>Inicio (X min)</strong></h2>`, Desarrollo, Cierre
- Includes differentiation/adaptations for diverse learning profiles

**AI Call**:
- Model: `gpt-4o-mini`
- Temperature: 0.7
- Retry logic with exponential backoff (3 attempts, base delay 2s)
- Rate limit handling (429 errors)

**Output** (JSON):
```json
{
  "plan_html": "<section id=\"plan\">...</section>",
  "argumento_competencias": "<p>Explicación...</p>",
  "recursos": ["Proyector", "Pizarrón", ...]
}
```

**Fallback**: If AI response is invalid or incomplete, generates a static HTML structure with generic content.

**Error Handling**:
- JSON parse errors → attempts extraction/fallback
- Missing `<section id="plan">` → creates fallback plan
- Rate limits → returns 429 status with error code

**Environment Variables**:
- `OPENAI_API_KEY`

---

#### Function: `modify-evaluation`

**Purpose**: Multi-function AI pipeline for evaluations, planning, and chat responses.

**Runtime**: Deno with `@supabase/supabase-js@2.56.1`, XHR polyfill

**Input** (JSON body):
```typescript
{
  type: 'chat' | 'html_plan' | 'planning' | 'modification' (default),
  originalEvaluation?: string,
  modification: string,
  groupContext?: {
    subject: string,
    content: string[],
    students: any[],
    groupName: string,
    dominantProfile: string,
    objective: string,
    additionalContext: string
  },
  adaptationLevel?: 'standard' | 'moderate' | 'high',
  prompt?: string  // For custom html_plan
}
```

**Type-Specific Behaviors**:

1. **`type: 'chat'`**:
   - Pedagogical assistant for evaluation improvement
   - Model: `gpt-5-mini-2025-08-07`
   - Responds to teacher questions with practical suggestions

2. **`type: 'html_plan'`**:
   - Pure HTML lesson plan generation (no Markdown)
   - Enforces HTML-only tags: `<h2>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<em>`
   - Structure: Inicio/Desarrollo/Cierre with duration markers

3. **`type: 'planning'`**:
   - Class planning suggestions with pedagogical principles
   - 80-minute structure: Apertura (15), Desarrollo (45), Cierre (20)
   - Includes adaptations for diverse learning styles

4. **Default (evaluation generation/modification)**:
   - Generates complete student-ready evaluations for Historia 9º (Uruguay)
   - **CRITICAL POLICY**: NO `<img>` tags allowed (images as text URLs only)
   - Structure: Parte I/II/III with clear time allocation
   - Adaptation by version (1: standard, 2: moderate support, 3: high adaptation)
   - Automatic time control heuristics (e.g., multiple choice: 1.5-2 min/item)
   - HTML tables for student responses (NO multiple `<br>` tags)

**AI Model Selection**:
- Chat: `gpt-5-mini-2025-08-07`
- All others: `gpt-4.1-2025-04-14`

**Content Cleanup** (server-side):
- `cleanupContent()` function removes:
  - Excessive `<br>` tags (max 2 consecutive)
  - All `<img>` tags → converted to text links
  - Excessive paragraph spacing
  - Code fences (```html```) unwrapped
  - Markdown markers (#, ---)

**Image Handling**:
- `validateAndRehostImage()`: Downloads images from valid URLs, uploads to Supabase Storage bucket `evaluaciones-assets`, returns public URL
- CORS validation: Prefers Unsplash, Pexels, Wikimedia sources
- Fallback: If image validation fails, returns original URL
- Historical images: Hardcoded Uruguay history image URLs (Batlle, Montevideo, etc.)

**Retry Logic**:
- `retryWithBackoff()`: 3 attempts, exponential backoff (base 1s)
- Handles 429 rate limit errors specifically

**Output** (JSON):
```json
{
  "success": true,
  "content": "Generated HTML/text content",
  "type": "chat" | "html_plan" | "planning" | ...,
  "metadata": {
    "tokensUsed": number,
    "model": string
  },
  "warning": "Optional warning message"
}
```

**Special Cases**:
- Token limit (`finish_reason: 'length'`): Returns partial content with warning
- Empty content: Returns fallback message or original evaluation
- Rate limits: Returns 429 status with `isRateLimit: true`

**Environment Variables**:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (for image rehosting to Storage)

---

#### Function: `generate-bulletin-text`

**Purpose**: Generate personalized bulletin/report card text for students (Historia 9º).

**Runtime**: Deno with XHR polyfill

**Input** (JSON body):
```typescript
{
  student: {
    name: string,
    perfil: string,
    evaluacionesCualitativas?: Array<{
      fecha: string,
      evaluador: string,
      area: string,
      comentario: string,
      tipo: 'docente' | 'psicopedagogico'
    }>
  },
  period: string,
  contemplaciones: string[],  // Adaptations applied
  academicHistory: string,
  qualitativeComments: any[],
  customAspects?: string
}
```

**AI System Prompt** (extensive, 86+ lines):
- Expert in Historia 9º evaluation for ANEP Uruguay
- Enforces Uruguay-region-world context (eje articulador)
- Key concepts: guerra civil, Estado, totalitarismo, derechos humanos, globalización
- Specific Historia competencies: análisis de fuentes, periodización, causalidad, debate histórico
- Structure: academic aspects → social aspects
- **Obligatory guidelines**:
  - Always write from student's strengths
  - Describe difficulties constructively
  - Base on concrete historical learning process observations
  - Third person singular
  - 90-140 words MAX (2 paragraphs)
  - Institutional tone, clear, positive, Historia-specific

**AI Call**:
- Model: `gpt-4.1-2025-04-14`
- Max tokens: 400
- Temperature: 0.7

**Output** (JSON):
```json
{
  "generatedText": "Bulletin text ready for families (90-140 words)"
}
```

**Environment Variables**:
- `OPENAI_API_KEY`

---

### 4.4 Data Model / Tables / Enums / RLS

#### Database Schema

All tables in `public` schema with Row Level Security (RLS) enabled.

#### Table: `planificaciones`

**Purpose**: Stores teacher lesson planning periods.

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL) – links to auth.users
- `grupo_id` (text, NOT NULL) – e.g., "9no 1"
- `materia` (text, NOT NULL) – e.g., "Historia"
- `nivel` (text)
- `fecha_inicio`, `fecha_fin` (date) – planning period
- `horas_semanales` (integer, default 2)
- `configuracion_horario` (jsonb, NOT NULL) – array of `{ dia, horaInicio, horaFin, duracionMinutos }`
- `competencias_seleccionadas` (text[], NOT NULL) – flattened competency IDs
- `contenidos_programa` (text[]) – extracted content texts
- `mapeo_competencias_contenidos` (jsonb, NOT NULL) – map of contenido_id → competencias_ids
- `distribucion_modalidades` (jsonb) – `{ individual: 25, pareja: 25, grupos: 25, toda_clase: 25 }`
- `estrategias_diferenciacion` (text)
- `unidades_didacticas` (jsonb) – array of units with content and competencies
- `cantidad_sesiones` (integer) – for "sin periodo" planning
- `cadencia_deseada`, `bloques_preferidos`, `ventana_sugerida` (text/jsonb)
- `requerimientos_docente`, `metas_aprendizaje` (text)
- `carpeta` (text) – organization folder
- `compartido_direccion`, `compartido_equipo` (boolean)
- `created_at`, `updated_at` (timestamptz)

**RLS Policies**:
- Users can view/create/update/delete their own planificaciones (`auth.uid() = user_id`)

**Indexes**:
- `idx_planificaciones_user_id`
- `idx_planificaciones_materia`

**Trigger**: `update_planificaciones_updated_at` (auto-update `updated_at`)

---

#### Table: `sesiones_clase`

**Purpose**: Individual class sessions within a planificacion.

**Key Columns**:
- `id` (uuid, PK)
- `planificacion_id` (uuid, FK → planificaciones.id, CASCADE delete)
- `fecha` (date) – session date
- `duracion_minutos` (integer, default 60)
- `competencias_anep` (text[], default '{}') – ANEP competencies for this session
- `contenidos_anep` (text[], default '{}')
- `criterios_logro_anep` (text[], default '{}')
- `plan_desarrollo` (jsonb, default '{}') – structured plan (inicio/desarrollo/cierre) or HTML
- `diferenciacion` (text)
- `evaluacion` (jsonb, default '{}') – evaluation configuration
- `recursos` (text[], default '{}')
- `observaciones` (text)
- `estado` (enum: `sesion_estado`) – 'backlog' | 'planificada' | 'dictada' | 'omitida' | 'pausada'
- `es_feriado` (boolean, default false)
- `motivo_excepcion`, `motivo_cambio` (text)
- `orden` (integer) – added in later migration (index commented out)
- `semana_objetivo` (integer)
- `bloque_preferido` (jsonb)
- `bloqueo_reserva` (boolean)
- `argumento_competencias` (text) – AI-generated competency justification
- `titulo` (text)
- `created_at`, `updated_at` (timestamptz)

**RLS Policies**:
- Users can view/create/update/delete sessions of their own planificaciones (via FK check)

**Indexes**:
- `idx_sesiones_clase_planificacion_id`
- `idx_sesiones_clase_fecha`
- `idx_sesiones_clase_estado`

**Trigger**: `update_sesiones_clase_updated_at`

---

#### Table: `comunicaciones`

**Purpose**: Teacher communications to administration/support.

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `to_role` (text, NOT NULL) – CHECK: 'direccion' | 'psicopedagogico'
- `subject` (text, NOT NULL)
- `message` (text, NOT NULL)
- `attachment_urls` (jsonb, default '[]') – array of file URLs
- `related_planificacion_id` (uuid, FK → planificaciones.id, SET NULL)
- `status` (text, default 'enviado')
- `created_at` (timestamptz)

**RLS Policies**:
- Users can view/create/update their own communications (`auth.uid() = user_id`)

**Storage Integration**:
- Bucket: `comunicaciones` (public)
- Storage policies: users can view/upload/update/delete files in their own folder (by `user_id`)

---

#### Table: `profiles`

**Purpose**: Extended user profile information.

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, UNIQUE)
- `display_name` (text)
- `role` (text, default 'teacher')
- `created_at`, `updated_at` (timestamptz)

**RLS Policies**:
- Users can view/update/insert their own profile (`auth.uid() = user_id`)

**Trigger**: `update_profiles_updated_at`

---

#### Table: `calendario_eventos`

**Purpose**: Calendar events (institutional, group, personal).

**Key Columns**:
- `id` (uuid, PK)
- `fecha` (date, NOT NULL)
- `titulo` (text, NOT NULL)
- `alcance` (text, default 'institucional')
- `created_at` (timestamptz)

**RLS Policies**:
- **Very permissive**: All users can view/create/update/delete (policies use `true`)

**Index**:
- `idx_calendario_eventos_fecha`

---

#### Enums

**`sesion_estado`**:
- `backlog` – Not yet scheduled
- `planificada` – Scheduled/planned
- `dictada` – Already taught
- `omitida` – Skipped
- `pausada` – Paused

---

#### Storage Buckets

1. **`comunicaciones`** (public):
   - Path structure: `{user_id}/filename`
   - Policies: per-user folder access (based on `auth.uid()`)

2. **`evaluaciones-assets`** (public):
   - Stores rehosted images for evaluations
   - Path: `images/{timestamp}-{randomId}.{ext}`
   - Created dynamically by `modify-evaluation` edge function

---

#### Generated Types

All database types auto-generated in `src/integrations/supabase/types.ts` (470 lines).

Key type exports:
- `Database` (full schema)
- `Tables<'table_name'>` (row types)
- `TablesInsert<'table_name'>` (insert types)
- `TablesUpdate<'table_name'>` (update types)
- `Enums<'enum_name'>`

---

### 4.5 Key Flows (End-to-End)

#### Flow 1: Demo Authentication & Profile Setup

1. **App Mount** (`src/main.tsx` → `src/App.tsx` → `AuthContext`):
   - Supabase auth state listener initialized
   - `ensureSupabaseAuth()` called automatically

2. **Ensure Demo User** (background):
   - Frontend invokes `supabase.functions.invoke('ensure-demo-users')`
   - Edge function creates/updates demo teacher in auth.users
   - Edge function upserts `profiles` table
   - Frontend signs in with demo credentials via `supabase.auth.signInWithPassword()`
   - Supabase session persisted in localStorage

3. **User Login** (explicit):
   - User navigates to `/teacher-login` or `/student-login`
   - Enters credentials (any non-empty values accepted for demo)
   - `login()` function:
     - Ensures Supabase session exists
     - Creates mock frontend user object
     - Saves to `localStorage.auth_user`
     - Sets React state

4. **Session Restoration**:
   - On future visits, reads `auth_user` from localStorage
   - Restores mock user without re-authentication
   - Supabase session auto-refreshed by supabase-js

5. **Profile Sync** (silent):
   - On auth state change, frontend upserts `profiles` table
   - Uses Supabase session user_id
   - RLS allows user to write own profile

---

#### Flow 2: Planificación Wizard & Session Generation

**Entry**: User navigates to `/planificacion/nuevo`

**Component**: `PlanificacionWizard.tsx` + `usePlanificacionWizard` hook

**Steps**:

1. **Paso 0 – Contexto**:
   - User selects: `grupo_id`, `materia`, tipo (`periodo_especifico` or `sin_periodo`)
   - If `periodo_especifico`: validates `fecha_inicio`, `fecha_fin` (must be future dates, fin > inicio)
   - If `sin_periodo`: validates `cantidad_sesiones` > 0, `duracion_por_sesion` > 0
   - Validation via `usePlanificacionWizard.validarPaso(0)`

2. **Paso 1 – Horario**:
   - User inputs: `horas_semanales`
   - User configures `configuracion_horario` array: `{ dia, horaInicio, horaFin, duracionMinutos }`
   - Validates: at least one config, each config has dia/horaInicio/horaFin, horaFin > horaInicio, duracionMinutos > 0

3. **Paso 2 – Enfoque**:
   - User creates `unidades_didacticas`: array of `{ contenido_id, contenido_texto, competencias_ids, clases_estimadas, orden }`
   - User sets `distribucion_modalidades`: sliders for individual/pareja/grupos/toda_clase (must sum to 100%)
   - User inputs `estrategias_diferenciacion` (text)
   - Validates: at least one unidad, at least one competency selected across all units, modalidades sum to 100%

4. **Paso 3 – Revisión**:
   - Recursively validates all previous steps
   - Displays summary

5. **Submission** (`handleFinalizarPlanificacion`):
   - Extracts competencies from units: `extractCompetenciesFromUnits()` → flattened deduplicated array
   - Extracts content: `extractContenidosFromUnits()` → text array
   - Builds mapping: `buildCompetenciasContenidosMap()` → `{ contenido_id: [competencia_ids] }`
   - Ensures Supabase user authenticated (retries demo user setup if needed)
   - **Creates `planificaciones` row** in Supabase:
     - Inserts with user_id, wizard data, extracted competencies/content/mapping
   - **Generates calendar of session dates** (based on periodo or cantidad_sesiones)
   - **Creates `sesiones_clase` rows** (one per date):
     - Initially with basic data (fecha, duracionMinutos, competencias, contenidos, criterios, estado: 'planificada')
   - **Auto-generates plans for all sessions**:
     - Calls `generarPlanesAutomaticamente(planificacionId, materia, nivel)`
     - For each session:
       - Distributes competencies across sessions (round-robin)
       - Invokes `supabase.functions.invoke('generate-plan-completo')` with session context
       - Retries up to 3 times with 3s delay (5s for 429 errors)
       - Updates session with `plan_desarrollo: { html_completo }`, `argumento_competencias`, `recursos`
   - **Navigates** to `/planificacion/:id` (PlanificacionWorkspace)

**Key Functions**:
- `generarPlanesAutomaticamente()` in `PlanificacionWizard.tsx`: orchestrates batch AI generation with rate-limit handling
- `usePlanificacionWizard`: manages wizard state, validation, step transitions
- `extractCompetenciesFromUnits`, `extractContenidosFromUnits`, `buildCompetenciasContenidosMap` in `src/lib/competencyExtractor.ts`

---

#### Flow 3: AI-Assisted Evaluation Generation

**Entry**: User navigates to `/evaluaciones`

**Component**: `EvaluacionesGrupo.tsx`

**Flow**:

1. **User selects group context**:
   - Subject, content areas, students, group name

2. **User requests evaluation generation**:
   - Clicks "Generar evaluación" button
   - Optionally provides custom instructions

3. **Frontend calls edge function**:
   ```typescript
   const { data, error } = await supabase.functions.invoke('modify-evaluation', {
     body: {
       type: 'modification',  // or leave default
       modification: 'Generar 3 versiones de evaluación...',
       groupContext: {
         subject: 'Historia',
         content: ['Batllismo', 'Movimiento obrero'],
         students: [...],
         groupName: '9no 1',
         // ...
       },
       adaptationLevel: 'standard'  // or 'moderate' / 'high'
     }
   });
   ```

4. **Edge function processes**:
   - Constructs detailed system prompt (120+ lines) with ANEP Historia context
   - Calls OpenAI `gpt-4.1-2025-04-14`
   - Receives HTML evaluation content (3 versions if requested)
   - Cleans content: removes `<img>` tags, collapses `<br>`, strips code fences
   - Returns `{ success: true, content: "HTML string" }`

5. **Frontend displays**:
   - Renders HTML evaluation with `dangerouslySetInnerHTML`
   - User can modify via chat interface (invokes same function with type `chat`)
   - User can regenerate specific sections

6. **User exports**:
   - Can print to PDF (via browser print)
   - Can save to database (not fully implemented in read sections)

---

#### Flow 4: Bulletin Text Generation

**Entry**: Teacher views student profile or group dashboard

**Component**: `GeneradorTextosBoletin.tsx` + `useBulletinGenerator` hook

**Flow**:

1. **User selects student**:
   - Student object with `name`, `perfil`, `evaluacionesCualitativas`

2. **User clicks "Generar texto"**:
   - Optionally provides `period` (e.g., "Primer trimestre")
   - Optionally provides `customAspects` (specific instructions)

3. **Hook calls edge function**:
   ```typescript
   const { data, error } = await supabase.functions.invoke('generate-bulletin-text', {
     body: {
       student,
       period,
       contemplaciones: ['Apoyo visual', 'Tiempo adicional', ...],
       academicHistory: 'Historia: 8.5 → 9.0 puntos',
       qualitativeComments: student.evaluacionesCualitativas || [],
       customAspects
     }
   });
   ```

4. **Edge function generates**:
   - Calls OpenAI `gpt-4.1-2025-04-14` with Historia-specific system prompt (86 lines)
   - Max tokens: 400, temperature: 0.7
   - Returns `{ generatedText: "90-140 word bulletin text" }`

5. **Frontend displays**:
   - Shows generated text in editable field
   - User can regenerate or manually edit
   - Can copy to clipboard or export

**Fallback**: If API fails, returns static fallback text with generic Historia-focused language.

---

#### Flow 5: Session Auto-Generation (via Hook)

**Entry**: Used during `PlanificacionWizard` submission or manual regeneration

**Hook**: `useFullSessionGeneration`

**Flow**:

1. **Input**:
   - `planificacion`: full planificacion object
   - `fechasSesiones`: array of Date objects

2. **Modality distribution**:
   - `createModalidadDistribution()`: converts percentage distribution to session list
   - Example: 25% individual, 25% pareja → [individual, individual, ..., pareja, pareja, ...]
   - Shuffles array for random distribution

3. **For each session**:
   - **Rotate unidades didácticas**: `Math.floor(index / ceil(total / units.length))`
   - **Calculate real duration**: `calculateSessionDuration(fecha, configuracion_horario)` (matches day-of-week config)
   - **Generate AI plan**:
     - Calls `generateAIPlan()` which invokes `modify-evaluation` with type `planning`
     - Sends: materia, contenido, competencias, modalidad, duracionMinutos, diferenciacion, session context
     - Parses response: `parseAIResponseToPlan(contenidoIA)` → extracts inicio/desarrollo/cierre sections
   - **Generate resources**: `generateResources(contenido, materia)` → subject-specific list (e.g., Historia: "Mapas históricos", "Documentos fuente")
   - **Build session object**:
     - `competencias_anep`: first 3 competencies (normalized array)
     - `contenidos_anep`: unidad content (normalized)
     - `criterios_logro_anep`: generated from competencies
     - `plan_desarrollo`: structured object `{ inicio, desarrollo, cierre }`
     - `recursos`: normalized array
     - `evaluacion`: default `{ tipo: 'observacion', configuracion: {}, instrumento_generado: false }`
     - `estado`: 'planificada'

4. **Returns**: Array of `SesionClase` objects ready for DB insertion

**Fallback**: If AI generation fails, `generateFallbackPlan()` creates generic structured plan.

**Key Helpers**:
- `shuffleArray()`: Fisher-Yates shuffle
- `generateCriteriosLogro()`: maps competencies to generic success criteria
- `cleanSection()`: strips Markdown formatting from AI responses

---

### 4.6 UI/UX and Layering Conventions

#### Component Organization

**Pages** (`src/pages/`):
- Route-level components
- Minimal business logic
- Compose feature components
- Handle route params (e.g., `:id`)
- Example: `PlanificacionWorkspace.tsx` fetches planificacion by ID, renders `PlanificacionLayout` component

**Feature Components** (`src/components/`):
- Domain-specific UI (planificacion, evaluaciones, dashboards)
- Delegate state/logic to hooks
- Examples:
  - `planificacion/WizardSteps.tsx`: renders wizard UI, calls hook methods
  - `evaluaciones/EvaluacionGenerator.tsx`: evaluation creation interface
  - `GeneradorTextosBoletin.tsx`: bulletin text generation UI

**Custom Hooks** (`src/hooks/`):
- Business logic encapsulation
- API calls (Supabase, edge functions)
- Complex state management
- Testable independently of UI
- Examples:
  - `usePlanificacionWizard`: wizard state, validation, step transitions
  - `useFullSessionGeneration`: batch session creation with AI
  - `useAIPlanification`: AI planning suggestions
  - `useBulletinGenerator`: bulletin text generation

**UI Components** (`src/components/ui/`):
- Reusable, presentational primitives (62+ components)
- shadcn/ui derived (Radix UI + Tailwind)
- NO business logic, NO hooks with side effects
- Examples: Button, Card, Dialog, Select, Tabs, Toast

**Lib Utilities** (`src/lib/`):
- Pure functions (NO React, NO Supabase)
- Utilities: `cn()` (class merge), content cleaning, duration validation, PDF generation
- Examples:
  - `sessionPlanGenerator.ts`: generates structured plan object
  - `competencyExtractor.ts`: extracts/flattens competencies from units
  - `normalizeSupabaseArrays.ts`: ensures arrays are not nullish
  - `storage.ts`: file upload helpers

**Static Data** (`src/data/`):
- Catalogues, mock data
- No runtime mutations
- Examples: `competencias.ts`, `competenciasCiudadania.ts`, `mockData.ts` (groups/students)

**Types** (`src/types/`):
- TypeScript interfaces, no implementation
- Examples:
  - `planificacion.ts`: `Planificacion`, `SesionClase`, `WizardData`, `UnidadDidactica`
  - `validation.ts`: `ValidationResult`, `FieldError`

---

#### Styling Approach

- **Tailwind Utility-First**: Classes directly on JSX elements
- **Custom Theme**: Extended colors, spacing, animations in `tailwind.config.ts`
- **Variants**: `class-variance-authority` for component variants
- **Global Styles**: `src/index.css`, `src/App.css` (minimal resets, CSS variables for theme)
- **Animations**: Framer Motion for complex transitions, Tailwind for simple hover/focus

---

#### State Management Patterns

- **Server State**: React Query (`useQuery`, `useMutation`)
  - Caching with stale-while-revalidate
  - Automatic refetching on window focus
  - Optimistic updates
- **Auth State**: React Context (`AuthContext`) wrapping entire app
- **Local State**: `useState`, `useReducer` in components/hooks
- **Form State**: React Hook Form (uncontrolled, validation via Zod)
- **NO Redux, NO Zustand, NO MobX**

---

### 4.7 Environment & Configuration

#### Frontend Environment Variables

**Required** (in `.env` at repo root):
- `VITE_SUPABASE_URL` – Supabase project URL (e.g., `https://abcdef.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` – Supabase anon public key (JWT, safe for frontend)

**Validation** (`src/integrations/supabase/client.ts`):
- Throws error if missing
- Dev-mode logging: URL, anon key length, anon key prefix (first 12 chars)
- Warns if anon key < 50 chars (likely invalid)

**Important Notes**:
- Vite only exposes vars with `VITE_` prefix
- File must be at repo root (NOT in `src/`)
- Must restart dev server after changes

**Documentation**: `docs/supabase-connection-overview.md` (144 lines, step-by-step guide)

---

#### Edge Function Environment Variables

**Required** (Supabase Dashboard → Settings → Edge Functions):
- `SUPABASE_URL` – Same as frontend (injected automatically)
- `SUPABASE_SERVICE_ROLE_KEY` – Admin key (NOT anon, DO NOT expose in frontend)
- `OPENAI_API_KEY` – OpenAI API key for GPT models

**Usage**:
- `Deno.env.get('VARIABLE_NAME')`
- No dotenv required (Deno runtime)

---

#### Local Development Setup

**Prerequisites**:
- Node.js (via nvm recommended)
- npm (primary) or bun (optional)
- Supabase project with API keys

**Steps**:
1. Clone repo
2. Create `.env` at root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Install dependencies: `npm install`
4. Run dev server: `npm run dev` (Vite on port 5173)

**Scripts** (`package.json`):
- `npm run dev` – Vite dev server
- `npm run build` – Production build
- `npm run build:dev` – Dev-mode build
- `npm run lint` – ESLint check
- `npm run preview` – Preview production build

---

#### Deployment

**Frontend**:
- Built with `npm run build` → outputs to `dist/`
- Deployed via Lovable.dev (per README)
- Custom domain support available

**Edge Functions**:
- Deployed via Supabase CLI or dashboard
- Automatically linked to Supabase project
- Environment variables set in Supabase dashboard

**Database**:
- Migrations applied via Supabase CLI: `supabase db push`
- 16 migration files in `supabase/migrations/`
- RLS policies enforced at runtime

---

## 5. Open Questions / Missing Information

### Real Usage & Environments
1. **Is AulaPlus v0 currently used only as a demo/prototype, or is it in real pilot programs or production with actual teachers/students from ANEP?**
2. **Which environments exist (development, staging, production)?**
   - Where is the frontend currently deployed (Lovable.dev URL, custom domain)?
   - How many Supabase projects are there (one per environment or shared)?
   - Are there separate OpenAI API keys per environment, or one shared key?
3. **Are there plans for non-demo authentication flows?**
   - Real teacher accounts with unique credentials?
   - Additional roles beyond teacher/student (e.g., director, inspector, psicopedagogo)?
   - Integration with existing ANEP identity systems?

### Operational Constraints & Observability
4. **What are the constraints or expectations around OpenAI API usage?**
   - Is there a monthly budget or rate limit?
   - Are there latency requirements for AI responses (e.g., max 10s for lesson plan generation)?
   - Should the system handle OpenAI outages gracefully (longer fallback strategies)?
5. **Are there known performance hotspots or slow areas?**
   - Is batch session generation (10+ sessions) currently too slow?
   - Do dashboards with many students cause lag?
   - Are there issues with large planificaciones (50+ sessions)?
6. **What observability/monitoring exists today?**
   - Any error tracking (Sentry, LogRocket)?
   - Console logging conventions (debug levels, structured logs)?
   - Supabase analytics or custom dashboards?

### Quality & Testing
7. **What testing setup exists today?**
   - Are there any unit tests (Vitest, Jest)?
   - Integration tests for hooks or Supabase interactions?
   - E2E tests (Playwright, Cypress)?
   - If none, is testing desired for future iterations?
8. **Which code paths are considered "trusted" vs. "fragile"?**
   - Are there specific features that frequently break (e.g., wizard validation, AI generation)?
   - Are there areas the team avoids touching due to complexity?

### Domain & Workflows
9. **What is the intended lifecycle for `comunicaciones`?**
   - Beyond `status: 'enviado'`, are there other statuses (e.g., 'recibido', 'respondido', 'archivado')?
   - Do recipients (direccion/psicopedagogico) ever interact with the system, or is it one-way?
10. **Is the permissive RLS on `calendario_eventos` intentional?**
    - Should all users really be able to create/update/delete any event?
    - Or should it be restricted by role (e.g., only teachers create personal/group events, admins create institutional)?
11. **For evaluations: is there a desired workflow for review/approval?**
    - Should evaluations be saved to the database (currently not visible in migrations)?
    - Is there a concept of "draft" vs. "published" evaluations?
    - Can evaluations be shared across teachers?

### Data & Content
12. **Are the static catalogues (`src/data/competencias.ts`, etc.) authoritative?**
    - Should they eventually be moved to the database?
    - Who maintains them (developers, ANEP administrators)?
13. **For `unidades_didacticas` in planificaciones: is the JSON structure stable?**
    - Should this be a separate table with foreign keys?
    - Or is the flexibility of JSONB intentional for rapid iteration?

---

## 6. Work Completed Summary

### Investigation Scope
This investigation analyzed the **AulaPlus v0** codebase as of December 9, 2025, focusing on:
- Repository structure and conventions
- Technology stack and external integrations
- Frontend architecture (React, routing, state management)
- Backend architecture (Supabase: Postgres, Auth, Storage, Edge Functions)
- Domain analysis (planning, evaluations, groups, communications)
- Data model (5 tables, RLS policies, migrations)
- Key end-to-end flows (auth, wizard, AI generation, bulletin)

### Methodology
- Read authoritative architecture documentation (`tools/architecture_plan.md`)
- Inspected entry points (`src/main.tsx`, `src/App.tsx`)
- Analyzed contexts, hooks, and edge functions
- Reviewed Supabase migrations and generated TypeScript types
- Traced data flows from user actions to database writes
- Examined OpenAI integration patterns and prompt engineering

### Deliverables
- **This document**: Comprehensive technical reference for the current system state
- **No code modifications**: Pure discovery and documentation phase
- **Factual observations only**: No refactoring suggestions or architectural proposals

### Next Steps
After clarifying open questions:
1. Prioritize bug fixes and stability improvements
2. Identify technical debt hotspots
3. Plan feature enhancements based on real user needs
4. Establish testing strategy if desired

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-09  
**Author**: AI-assisted codebase investigation (Claude Sonnet 4.5)  
**Status**: Awaiting user clarification on open questions before proceeding to implementation work

