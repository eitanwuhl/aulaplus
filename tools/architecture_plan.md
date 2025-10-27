# AulaPlus v0 - Architecture Plan
**Single Source of Truth for Architecture Decisions**

---

## Usage Note for Cursor AI

> **CRITICAL:** This document is the authoritative reference for all architecture decisions in this repository. When executing any task in Cursor:
> 1. **ALWAYS** load `tools/architecture_plan.md` as context before making changes
> 2. **FOLLOW** all guidelines, patterns, and conventions documented here
> 3. **UPDATE** this document first if a needed change conflicts with the current architecture
> 4. **PROPOSE** architecture changes via PR with justification before implementing

Any deviation from this plan without updating this document first is considered a violation of project architecture standards.

---

## 1. Purpose & Scope

This Architecture Plan defines the structural foundation, design principles, and development standards for **AulaPlus v0** - a pedagogical intelligence platform for the Uruguayan education system (ANEP).

**Target Audience:** Developers, AI assistants (Cursor), code reviewers, technical leads

**What This Document Provides:**
- Architectural principles and quality attributes
- Module boundaries and dependency rules
- Data flow patterns and contracts
- Technology stack and tooling conventions
- Security, testing, and performance guidelines
- Development workflow and contribution standards

**What This Document Is NOT:**
- End-user documentation
- API reference (see Supabase types for that)
- Step-by-step tutorials
- Business requirements or product specs

---

## 2. Architectural Goals & Quality Attributes

### Primary Quality Attributes (Prioritized)

1. **Maintainability** (HIGHEST)
   - Clear module boundaries with single responsibilities
   - Consistent naming and folder structure
   - Self-documenting code with TypeScript types
   - Minimal coupling between features

2. **Developer Experience**
   - Fast feedback loops (Vite HMR, TypeScript immediate errors)
   - AI-assisted development friendly (clear patterns, conventions)
   - Component reusability (shadcn/ui system)
   - Type-safe end-to-end (Supabase generated types)

3. **Pedagogical Accuracy**
   - Adherence to ANEP Uruguay curriculum standards
   - Competency-based assessment alignment
   - Culturally contextualized content generation

4. **Performance**
   - Sub-3s initial load time (target)
   - Instant client-side navigation (SPA)
   - Optimistic UI updates with React Query
   - Efficient AI API usage (caching, retries)

5. **Security**
   - Row Level Security (RLS) on all Supabase tables
   - No secrets in code or version control
   - HTTPS-only communication
   - Input validation at every boundary

6. **Testability** (ASPIRATIONAL - currently not implemented)
   - Isolated business logic in hooks
   - Pure functions in lib/
   - Mockable integrations
   - Component isolation

### Architectural Principles

- **Convention over Configuration:** Follow established patterns rather than creating new ones
- **Fail Fast:** Validate at boundaries, use TypeScript strict mode (aspirational)
- **Separation of Concerns:** UI components shouldn't know about Supabase, services shouldn't know about React
- **Single Source of Truth:** Database schema drives TypeScript types, not vice versa
- **Progressive Enhancement:** Core functionality works, AI enhancements are additive
- **Explicit over Implicit:** Prefer clear, verbose code over clever abstractions

---

## 3. Tech Stack & Tooling

### Frontend Stack
```
React 18.3.1              # UI framework (with hooks, no class components)
TypeScript 5.5.3          # Type system (relaxed mode currently: noImplicitAny: false)
Vite 5.4.1                # Build tool + dev server (SWC for transpilation)
React Router DOM 6.26.2   # Client-side routing (declarative, protected routes)
```

### Styling & UI Components
```
Tailwind CSS 3.4.11       # Utility-first CSS (with extensive custom theme)
shadcn/ui                 # Component system (based on Radix UI primitives)
Radix UI 1.x/2.x          # Headless accessible primitives (22+ packages)
Framer Motion 12.19.1     # Animations and gestures
Lucide React 0.462.0      # Icon library
```

### State Management
```
@tanstack/react-query 5.56.2   # Server state, caching, sync
React Context API              # Auth state (AuthContext)
useState/useReducer            # Local component state
```

### Forms & Validation
```
React Hook Form 7.53.0    # Form state management
Zod 3.23.8                # Runtime schema validation
@hookform/resolvers 3.9.0 # Bridge between RHF and Zod
```

### Backend-as-a-Service
```
Supabase 2.56.1           # BaaS platform
  ├─ PostgreSQL           # Relational database (15 migrations applied)
  ├─ Supabase Auth        # Authentication & sessions
  ├─ Edge Functions       # Serverless functions (Deno runtime)
  └─ Storage              # File/blob storage
```

### AI Integration
```
OpenAI API
  ├─ GPT-4.1-2025-04-14   # Bulletin text generation (high quality, expensive)
  └─ GPT-4o-mini          # Lesson plan generation (fast, cost-effective)
```

### Utilities
```
date-fns 3.6.0            # Date manipulation
jsPDF 3.0.1               # PDF generation
html2canvas 1.4.1         # HTML to canvas rendering
sonner 1.5.0              # Toast notifications
clsx 2.1.1 + tailwind-merge 2.5.2  # Conditional class names
```

### Development Tools
```
ESLint 9.9.0              # Linting (flat config)
TypeScript ESLint 8.0.1   # TypeScript-specific rules
PostCSS 8.4.47            # CSS processing
Autoprefixer 10.4.20      # CSS vendor prefixing
lovable-tagger 1.1.7      # Dev tooling (Lovable.dev integration)
```

### Package Management
```
npm (primary)             # package-lock.json present
bun (optional)            # bun.lockb present (faster alternative)
```

**RULE:** Use npm for consistency unless team explicitly adopts Bun. Do not mix commands.

---

## 4. High-Level System Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER (React SPA)                           │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  React Router (Client-Side Navigation)                     │  │
│  │    ├─ Public: / (landing), /teacher-login, /student-login │  │
│  │    ├─ Teacher: /teacher-dashboard, /planificacion, etc.   │  │
│  │    └─ Student: /student-diagnostic                        │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                           │
│  ┌───────────────────▼───────────────────────────────────────┐  │
│  │  Feature Modules                                           │  │
│  │    ├─ Authentication (AuthContext)                        │  │
│  │    ├─ Class Planning (planificacion/*)                    │  │
│  │    ├─ Intelligent Evaluations (evaluaciones/*)            │  │
│  │    ├─ Communications & Reports                            │  │
│  │    ├─ Group & Student Management                          │  │
│  │    └─ Pedagogical Intelligence (AI insights)              │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                           │
│  ┌───────────────────▼───────────────────────────────────────┐  │
│  │  Shared Layers                                             │  │
│  │    ├─ Custom Hooks (useAIPlanification, etc.)            │  │
│  │    ├─ UI Components (shadcn/ui + custom)                 │  │
│  │    ├─ Lib Utilities (pure functions)                     │  │
│  │    ├─ Data (catalogs, mock data)                         │  │
│  │    └─ Types (TypeScript interfaces)                      │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                           │
│  ┌───────────────────▼───────────────────────────────────────┐  │
│  │  React Query (Cache Layer)                                │  │
│  └───────────────────┬───────────────────────────────────────┘  │
│                      │                                           │
│  ┌───────────────────▼───────────────────────────────────────┐  │
│  │  Supabase Client                                           │  │
│  │    ├─ from('table').select()                              │  │
│  │    ├─ functions.invoke()                                  │  │
│  │    ├─ auth.signInWithPassword()                           │  │
│  │    └─ storage operations                                  │  │
│  └───────────────────┬───────────────────────────────────────┘  │
└────────────────────────┼─────────────────────────────────────────┘
                         │ HTTPS (WebSocket for realtime)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SUPABASE PLATFORM (BaaS)                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Auth        │  │  PostgreSQL  │  │  Storage     │          │
│  │  (Sessions)  │  │  (15 tables) │  │  (Files)     │          │
│  └──────────────┘  └──────┬───────┘  └──────────────┘          │
│                           │                                      │
│                           │ RLS Policies                         │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  Edge Functions (Deno Runtime)                       │        │
│  │    ├─ generate-bulletin-text                        │        │
│  │    ├─ generate-plan-completo                        │        │
│  │    ├─ modify-evaluation                             │        │
│  │    └─ ensure-demo-users                             │        │
│  └─────────────────────┬───────────────────────────────┘        │
└────────────────────────┼─────────────────────────────────────────┘
                         │ HTTPS API Calls
                         ▼
              ┌─────────────────────┐
              │  OpenAI API         │
              │  (GPT-4.1 / 4o-mini)│
              └─────────────────────┘
```

### Component Flow Pattern

```
User Interaction
    ↓
Page Component (src/pages/)
    ↓
Feature Component (src/components/)
    ↓
Custom Hook (src/hooks/) ← Business Logic Here
    ↓
React Query (useQuery/useMutation)
    ↓
Supabase Client (src/integrations/supabase/client.ts)
    ↓
Supabase API
    ↓
[PostgreSQL] or [Edge Function] or [Storage]
    ↓
[Optional: Edge Function → OpenAI API]
    ↓
Response flows back up the chain
```

---

## 5. Module & Layer Boundaries

### Dependency Direction Rules

**GOLDEN RULE:** Dependencies flow INWARD. Outer layers depend on inner layers, never the reverse.

```
Layers (Outside → Inside):
┌────────────────────────────────────────┐
│  Pages (src/pages/)                    │  ← Routes, minimal logic
├────────────────────────────────────────┤
│  Feature Components (src/components/)  │  ← Feature-specific UI
├────────────────────────────────────────┤
│  Custom Hooks (src/hooks/)             │  ← Business logic + state
├────────────────────────────────────────┤
│  UI Components (src/components/ui/)    │  ← Reusable presentational
├────────────────────────────────────────┤
│  Lib Utilities (src/lib/)              │  ← Pure functions (no React)
├────────────────────────────────────────┤
│  Types (src/types/)                    │  ← Shared interfaces
├────────────────────────────────────────┤
│  Integrations (src/integrations/)      │  ← External service clients
├────────────────────────────────────────┤
│  Data (src/data/)                      │  ← Static data, catalogs
└────────────────────────────────────────┘
```

### Allowed Dependencies

| From Layer | Can Import From |
|------------|----------------|
| Pages | Feature Components, Hooks, UI Components, Contexts, Types |
| Feature Components | Hooks, UI Components, Lib, Types, Data |
| Custom Hooks | Integrations (Supabase), Lib, Types, Data |
| UI Components | Lib (cn, utils), Types, NO hooks with side effects |
| Lib | ONLY standard library, no React, no Supabase |
| Types | ONLY other types, no implementation |
| Integrations | Types, ONLY external SDKs |

### FORBIDDEN Dependencies

❌ **UI Components importing Feature Components** (breaks reusability)  
❌ **Lib importing React or Supabase** (breaks pure function guarantee)  
❌ **Types importing implementation** (circular dependency risk)  
❌ **Pages containing business logic** (put in hooks)  
❌ **Direct OpenAI calls from frontend** (MUST go through Edge Functions)

### Module Map

#### Frontend Modules

**`src/pages/`** - Route-level components
- `Index.tsx` - Landing page with demos
- `TeacherGroups.tsx` - Teacher's group management
- `PlanificacionWizard.tsx` - Multi-step class planning wizard
- `PlanificacionWorkspace.tsx` - Class plan editor workspace
- `MisPlanificaciones.tsx` - List of saved plannings
- `EvaluacionesGrupo.tsx` - Group evaluation management
- `Comunicaciones.tsx` - Communications with families
- `StudentDiagnostic.tsx` - Student learning profile diagnostic
- `NotFound.tsx` - 404 page

**Responsibility:** Routing logic, layout composition, protected route wrappers. Minimal state.

---

**`src/components/`** - Feature and UI components

Subfolders:
- `evaluaciones/` (10 files) - Intelligent evaluation generation
- `planificacion/` (15 files) - Class planning features
- `ui/` (62 files) - Reusable UI primitives (shadcn/ui)

Top-level feature components:
- `AppLayout.tsx`, `AppSidebar.tsx` - App shell
- `TeacherDashboard.tsx` - Teacher main dashboard
- `EvaluacionInteligente.tsx` - AI-powered evaluation
- `InteligenciaPedagogica.tsx` - Pedagogical insights
- `GeneradorTextosBoletin.tsx` - Bulletin text generation
- `AnalisisGrupalAvanzado.tsx` - Advanced group analytics
- `PDFGenerator.tsx` - PDF export functionality
- Others (40+ components)

**Responsibility:** Feature-specific UI logic, composition, user interactions. Delegate business logic to hooks.

---

**`src/hooks/`** - Custom React hooks (business logic)
- `useAIPlanification.ts` - AI lesson planning suggestions
- `useBulletinGenerator.ts` - Bulletin text generation
- `useCalendarioSesiones.ts` - Session calendar management
- `useFullSessionGeneration.ts` - Complete session generation
- `usePlanificacionWizard.ts` - Wizard state management
- `use-toast.ts` - Toast notifications
- `use-mobile.tsx` - Mobile detection

**Responsibility:** Business logic, API calls, complex state management. Should be testable independently of UI.

---

**`src/contexts/`** - React Context providers
- `AuthContext.tsx` - Global authentication state

**Responsibility:** Global state that needs to be accessed across many components. Avoid overuse.

---

**`src/lib/`** - Pure utility functions (NO React dependencies)
- `utils.ts` - General utilities (`cn()` class merge)
- `contentCleaner.ts` - Content sanitization
- `durationAdjuster.ts` - Duration calculations
- `durationValidator.ts` - Duration validation
- `imageValidator.ts` - Image validation
- `registroCompetencialPDF.ts` - PDF generation logic
- `sessionPlanGenerator.ts` - Session plan generation logic
- `storage.ts` - LocalStorage helpers

**Responsibility:** Pure, testable, reusable functions. No side effects except I/O (storage, file operations).

---

**`src/integrations/`** - External service clients
- `supabase/client.ts` - Supabase client singleton
- `supabase/types.ts` - Generated TypeScript types from DB schema

**Responsibility:** Configuration and clients for external services. Types should be auto-generated where possible.

---

**`src/data/`** - Static data and mock data
- `catalogo.ts` - General catalog
- `competencias.ts` - Competencies
- `competenciasCiudadania.ts` - Citizenship competencies
- `competenciasLiteratura.ts` - Literature competencies
- `mockData.ts` - Mock data for demos/testing

**Responsibility:** Static configuration, catalogs, demo data. Should be JSON-like (serializable).

---

**`src/types/`** - Shared TypeScript types
- `calendario.ts` - Calendar types
- `planificacion.ts` - Planning types

**Responsibility:** Shared interfaces/types used across multiple modules. Avoid circular dependencies.

---

#### Backend Modules (Supabase)

**`supabase/migrations/`** - Database schema migrations (15 files)

**Tables (from types.ts, partial list):**
- `calendario_eventos` - Academic calendar events
- `comunicaciones` - Communications with families
- `planificaciones` - Class plannings
- `profiles` - User profiles
- (Others not fully analyzed)

**Responsibility:** Database schema evolution. Never edit existing migrations, only add new ones.

---

**`supabase/functions/`** - Edge Functions (Deno runtime)

**Functions:**

1. `generate-bulletin-text/` 
   - **Input:** Student data, period, contemplaciones, history
   - **Output:** Personalized bulletin text (90-140 words)
   - **Integration:** OpenAI GPT-4.1
   - **Context:** ANEP Uruguay pedagogy, Historia 9º grade

2. `generate-plan-completo/`
   - **Input:** Session details, duration, subject, competencies, student profiles
   - **Output:** HTML lesson plan + competency explanation + resources list
   - **Integration:** OpenAI GPT-4o-mini
   - **Features:** Retry logic, fallback plan, rate limit handling

3. `modify-evaluation/` (referenced, not analyzed)
   - **Purpose:** Modify/generate evaluations with AI

4. `ensure-demo-users/` (referenced, not analyzed)
   - **Purpose:** Seed demo users for Auth

**Responsibility:** Serverless compute, AI integration, heavy processing. Keep functions small and focused.

---

## 6. Repository Structure & Naming Conventions

### Current Folder Structure

```
aulaplus-v0/
├── docs/                        # Documentation (analysis reports, ADRs)
│   └── cursor/                  # Cursor AI reports
├── node_modules/                # Dependencies (gitignored)
├── public/                      # Static assets (served as-is)
│   ├── favicon.ico
│   ├── placeholder.svg
│   └── robots.txt
├── src/                         # Frontend source code
│   ├── components/              # React components (feature + UI)
│   │   ├── evaluaciones/        # Evaluation feature components
│   │   ├── planificacion/       # Planning feature components
│   │   └── ui/                  # Reusable UI components (shadcn/ui)
│   ├── contexts/                # React Context providers
│   ├── data/                    # Static data and catalogs
│   ├── hooks/                   # Custom React hooks
│   ├── integrations/            # External service clients
│   │   └── supabase/            # Supabase client and types
│   ├── lib/                     # Pure utility functions
│   ├── pages/                   # Route-level components
│   ├── types/                   # Shared TypeScript types
│   ├── App.tsx                  # Root component
│   ├── App.css                  # App-specific styles
│   ├── index.css                # Global styles + CSS variables
│   ├── main.tsx                 # Entry point
│   └── vite-env.d.ts            # Vite environment types
├── supabase/                    # Supabase configuration
│   ├── config.toml              # Supabase project config
│   ├── functions/               # Edge Functions (Deno)
│   │   ├── generate-bulletin-text/
│   │   ├── generate-plan-completo/
│   │   ├── modify-evaluation/
│   │   └── ensure-demo-users/
│   └── migrations/              # Database migrations (15 .sql files)
├── tools/                       # Development tools and docs
│   └── architecture_plan.md     # THIS FILE
├── components.json              # shadcn/ui configuration
├── eslint.config.js             # ESLint configuration (flat config)
├── index.html                   # HTML entry point
├── package.json                 # Dependencies and scripts
├── package-lock.json            # npm lock file
├── postcss.config.js            # PostCSS configuration
├── README.md                    # Project README
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript base config
├── tsconfig.app.json            # TypeScript app config
├── tsconfig.node.json           # TypeScript Node config
└── vite.config.ts               # Vite configuration
```

### Naming Conventions

#### Files

| Type | Convention | Examples |
|------|-----------|----------|
| React Components | PascalCase.tsx | `TeacherDashboard.tsx`, `EvaluacionInteligente.tsx` |
| Hooks | camelCase.ts(x) with `use` prefix | `useAIPlanification.ts`, `useBulletinGenerator.ts` |
| Utilities | camelCase.ts | `contentCleaner.ts`, `utils.ts` |
| Types | camelCase.ts | `planificacion.ts`, `calendario.ts` |
| Pages | PascalCase.tsx | `Index.tsx`, `NotFound.tsx` |
| Constants/Data | camelCase.ts | `mockData.ts`, `competencias.ts` |

**RULE:** Use `.tsx` for files containing JSX, `.ts` for pure TypeScript.

#### Variables & Functions

| Type | Convention | Examples |
|------|-----------|----------|
| Variables | camelCase | `selectedStudent`, `isGenerating`, `planList` |
| Functions | camelCase | `handleLogout`, `generateSuggestions`, `validateDuration` |
| React Components | PascalCase | `const AppLayout = () => {}` |
| Constants (immutable) | UPPER_SNAKE_CASE or camelCase | `DEMO_TEACHER_EMAIL`, `defaultSettings` |
| Types/Interfaces | PascalCase | `Student`, `AuthContextType`, `PlanificacionProps` |
| Props Interfaces | PascalCase + `Props` suffix | `AuthProviderProps`, `AppLayoutProps` |
| Type Parameters | Single uppercase letter | `<T>`, `<K extends keyof T>` |

#### CSS & Styling

| Type | Convention | Examples |
|------|-----------|----------|
| Tailwind Classes | Standard Tailwind utilities | `bg-primary`, `text-lg`, `p-4` |
| CSS Variables | kebab-case with `--` prefix | `--primary`, `--background-subtle` |
| CSS Classes (custom) | kebab-case | `.custom-scrollbar`, `.hero-section` |

**RULE:** Prefer Tailwind utilities over custom CSS. Use `cn()` helper for conditional classes.

#### Database (Supabase)

| Type | Convention | Examples |
|------|-----------|----------|
| Tables | snake_case, plural | `calendario_eventos`, `comunicaciones`, `planificaciones` |
| Columns | snake_case | `created_at`, `user_id`, `related_planificacion_id` |
| Foreign Keys | `{table}_id` | `grupo_id`, `user_id` |
| Enums | PascalCase | `UserRole`, `PlanStatus` |

#### Edge Functions

| Type | Convention | Examples |
|------|-----------|----------|
| Function Names | kebab-case | `generate-bulletin-text`, `modify-evaluation` |
| Handler Function | `serve(async (req) => {})` | Standard Deno pattern |
| Input/Output | JSON with camelCase keys | `{ studentData, period }` |

---

## 7. Data & Contracts

### DTO Patterns

**Frontend → Backend:**
```typescript
// Example: Invoking Edge Function
const { data, error } = await supabase.functions.invoke('generate-plan-completo', {
  body: {
    modo: 'generar' | 'regenerar',
    sesionId: string,
    orden: number,
    duracionMin: number,
    materia: string,
    nivel: string,
    contenidos: string[],
    competencias: string[],
    criterios: string[],
    perfilGrupo: { dominante: string, tamanio: number },
    estudiantes: Student[],
    instruccionesDocente?: string,
    planActual?: string
  }
})
```

**Backend → Frontend:**
```typescript
// Success response
{
  plan_html: string,           // HTML structure of lesson plan
  argumento_competencias: string,  // Competency explanation
  recursos: string[]           // Resources list
}

// Error response
{
  error: string,
  error_code?: string,
  error_status?: number,
  isRateLimit?: boolean
}
```

### Validation Strategy

**Input Validation:**
- **Frontend:** Zod schemas with React Hook Form
- **Edge Functions:** Manual validation (no Zod in Deno currently)
- **Database:** PostgreSQL constraints + RLS policies

**Pattern:**
```typescript
// Frontend validation example
import { z } from 'zod'

const PlanSchema = z.object({
  materia: z.string().min(1, 'Materia requerida'),
  duracion: z.number().min(30).max(240),
  estudiantes: z.array(z.object({
    id: z.string(),
    name: z.string()
  }))
})

type PlanInput = z.infer<typeof PlanSchema>
```

### Error Envelope

**Standard Error Response:**
```typescript
interface ErrorResponse {
  error: string               // Human-readable message
  error_code?: string         // Machine-readable code (e.g., 'RATE_LIMIT')
  error_status?: number       // HTTP status (e.g., 429, 500)
  timestamp?: string          // ISO 8601 timestamp
  path?: string               // Request path
}
```

**Error Handling Pattern:**
```typescript
try {
  const { data, error } = await supabase.functions.invoke('function-name', { body })
  
  if (error) {
    console.error('Function error:', error)
    toast.error(error.message || 'Error desconocido')
    return
  }
  
  // Handle success
} catch (err) {
  console.error('Unexpected error:', err)
  toast.error('Error inesperado. Por favor intenta nuevamente.')
}
```

### Pagination (Future Implementation)

**Assumption:** Not currently implemented but will follow this pattern:

```typescript
interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
}
```

### Idempotency (Future Implementation)

**Assumption:** Not currently implemented. For future POST/PUT operations:
- Include `Idempotency-Key` header in critical mutations
- Edge Functions store key in temporary cache (24h)
- Return cached response if key already processed

---

## 8. State Management & UI Guidelines

### State Management Strategy

**Local Component State** (`useState`, `useReducer`)
- UI state (open/closed, active tab, input values)
- Transient state that doesn't need to persist
- State that doesn't need to be shared

**Custom Hooks**
- Business logic with state
- Reusable stateful behavior
- API call orchestration

**React Query** (TanStack Query)
- Server state (data from Supabase)
- Caching, revalidation, optimistic updates
- Background refetching

**React Context**
- Truly global state (currently only Auth)
- Avoid overuse (prefer composition and props)

**LocalStorage**
- User preferences (theme, language)
- Auth token (managed by Supabase)
- Non-sensitive persistent state

**RULE:** Never store sensitive data in localStorage. Use Supabase session for auth state.

### State Management Decision Tree

```
Is it server data? 
  YES → React Query
  NO ↓
  
Is it global auth state?
  YES → AuthContext
  NO ↓
  
Is it shared across many unrelated components?
  YES → Consider Context (sparingly) or lifting state
  NO ↓
  
Is it UI state for this component tree?
  YES → useState/useReducer
  NO ↓
  
Is it derived from props?
  YES → Don't store in state, compute on render (useMemo if expensive)
```

### React Query Patterns

**Query Pattern:**
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['planificaciones', userId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('planificaciones')
      .select('*')
      .eq('user_id', userId)
    
    if (error) throw error
    return data
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
})
```

**Mutation Pattern:**
```typescript
const mutation = useMutation({
  mutationFn: async (newPlan) => {
    const { data, error } = await supabase
      .from('planificaciones')
      .insert([newPlan])
    
    if (error) throw error
    return data
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['planificaciones'])
    toast.success('Planificación guardada')
  },
  onError: (error) => {
    toast.error('Error al guardar')
  }
})
```

### UI Component Guidelines

**Component Composition Pattern:**

```typescript
// ✅ GOOD: Composition over configuration
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
  </CardHeader>
  <CardContent>
    Contenido
  </CardContent>
</Card>

// ❌ BAD: Over-configured single component
<Card 
  title="Título"
  content="Contenido"
  headerClass="..."
  contentClass="..."
/>
```

**Props Destructuring:**

```typescript
// ✅ GOOD: Explicit props
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function Button({ variant = 'primary', size = 'md', children }: ButtonProps) {
  return <button className={cn(variants[variant], sizes[size])}>{children}</button>
}

// ❌ BAD: Props spreading without typing
export function Button({ ...props }) {
  return <button {...props} />
}
```

**Conditional Rendering:**

```typescript
// ✅ GOOD: Clear conditions
{isLoading && <Spinner />}
{error && <ErrorMessage error={error} />}
{data && <DataDisplay data={data} />}

// ❌ BAD: Nested ternaries
{isLoading ? <Spinner /> : error ? <Error /> : data ? <Display /> : null}
```

### Theming & Dark Mode

**Current Implementation:**
- `next-themes` for theme switching
- CSS variables in `src/index.css` (`:root` and `.dark`)
- Variables accessed via `hsl(var(--variable-name))`

**Usage:**
```typescript
import { useTheme } from 'next-themes'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </button>
  )
}
```

**Adding New Colors:**
1. Add to `:root` and `.dark` in `src/index.css`
2. Add to `tailwind.config.ts` theme.extend.colors
3. Use via Tailwind class: `bg-new-color` or `text-new-color`

### Accessibility Guidelines

**Minimum Requirements:**
- ✅ Radix UI primitives are accessible by default
- ✅ Use semantic HTML (`<button>`, `<nav>`, `<main>`, etc.)
- ✅ Provide `aria-label` for icon-only buttons
- ✅ Ensure sufficient color contrast (WCAG AA)
- ✅ Keyboard navigation support (tab, enter, escape)

**RULE:** Before adding custom interactive elements, check if Radix UI or shadcn/ui has a primitive.

---

## 9. API / Edge Functions Guidelines

### Request/Response Schema Conventions

**Request Body:**
```typescript
// Always JSON, use camelCase keys
{
  userId: string,
  sessionId: string,
  parameters: {
    duration: number,
    level: string
  }
}
```

**Response Body:**
```typescript
// Success: data object
{
  result: any,
  metadata?: {
    tokensUsed?: number,
    model?: string
  }
}

// Error: error object
{
  error: string,
  error_code?: string,
  error_status?: number
}
```

### Input Validation

**Edge Functions MUST:**
1. Validate all input parameters
2. Check for required fields
3. Validate types and ranges
4. Sanitize strings (especially for AI prompts)

**Example:**
```typescript
// In Edge Function
const { studentData, period } = await req.json()

if (!studentData?.name) {
  return new Response(
    JSON.stringify({ error: 'studentData.name is required' }),
    { status: 400, headers: corsHeaders }
  )
}

if (typeof period !== 'string' || period.length === 0) {
  return new Response(
    JSON.stringify({ error: 'period must be a non-empty string' }),
    { status: 400, headers: corsHeaders }
  )
}
```

### Authentication & Authorization

**Current Pattern (Demo):**
- Supabase Auth always authenticated with demo user in background
- Frontend manages user roles via AuthContext (mock)
- Edge Functions have `verify_jwt: false` (public for demo)

**Future Production Pattern:**
```typescript
// Edge Function should verify JWT
const authHeader = req.headers.get('Authorization')
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: 'Missing authorization' }),
    { status: 401, headers: corsHeaders }
  )
}

const token = authHeader.replace('Bearer ', '')
const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

if (error || !user) {
  return new Response(
    JSON.stringify({ error: 'Invalid token' }),
    { status: 401, headers: corsHeaders }
  )
}

// Proceed with user.id
```

### Rate Limiting & Backoff

**Current Implementation (in `generate-plan-completo`):**

```typescript
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const isRateLimit = error.message?.includes('429') || error.status === 429
      const isLastAttempt = attempt === maxRetries - 1
      
      if (isRateLimit && !isLastAttempt) {
        const delay = baseDelay * Math.pow(2, attempt)  // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      throw error
    }
  }
}
```

**RULE:** All Edge Functions calling external APIs MUST implement retry logic with exponential backoff.

### CORS Configuration

**All Edge Functions MUST include:**

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // TODO: Restrict in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders })
}

// Include in all responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
})
```

**TODO:** In production, restrict `Access-Control-Allow-Origin` to specific domains.

### OpenAI Integration Guidelines

**Model Selection:**
- **GPT-4.1 / GPT-4-turbo:** High-quality, complex tasks (bulletin texts)
- **GPT-4o-mini:** Fast, cost-effective, simpler tasks (lesson plans)

**Prompt Engineering:**
- Always include system prompt with context (ANEP Uruguay pedagogy)
- Structure prompts with clear sections (CONTEXT, INPUT, OUTPUT FORMAT)
- Specify output format explicitly (JSON, HTML structure, word count)
- Include few-shot examples in system prompt where applicable

**Error Handling:**
```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openAIApiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ model, messages, temperature })
})

if (!response.ok) {
  const errorText = await response.text()
  console.error('OpenAI API error:', response.status, errorText)
  throw new Error(`OpenAI API error: ${response.status}`)
}
```

**RULE:** Never expose OpenAI API key to frontend. All calls go through Edge Functions.

---

## 10. Security

### Secrets Management

**RULES:**
- ❌ **NEVER** commit secrets to version control
- ❌ **NEVER** hardcode API keys in source code
- ✅ **ALWAYS** use environment variables for secrets
- ✅ **ALWAYS** use Supabase Edge Function secrets for OpenAI API key

**Frontend:**
```typescript
// ✅ GOOD: Supabase anon key (public by design)
const SUPABASE_URL = "https://srlrbuphsogwgymqywhe.supabase.co"
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGci..."  // Anon key, safe to expose

// ❌ BAD: OpenAI key in frontend
const OPENAI_API_KEY = "sk-..."  // NEVER DO THIS
```

**Edge Functions:**
```typescript
// ✅ GOOD: Read from environment
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')

if (!openAIApiKey) {
  throw new Error('OPENAI_API_KEY not configured')
}
```

**Setting Secrets:**
```bash
# Supabase CLI
supabase secrets set OPENAI_API_KEY=sk-...
```

### Row Level Security (RLS)

**Assumption:** RLS policies should be configured on all tables.

**Example Policy (should be in migrations):**
```sql
-- Users can only see their own planificaciones
CREATE POLICY "Users can view own planificaciones"
ON planificaciones FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own planificaciones
CREATE POLICY "Users can insert own planificaciones"
ON planificaciones FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

**RULE:** Every table with user-owned data MUST have RLS enabled and appropriate policies.

### Input Sanitization

**Frontend:**
```typescript
// ✅ GOOD: Validate and sanitize
import { z } from 'zod'

const SafeTextSchema = z.string().max(1000).trim()
const safeText = SafeTextSchema.parse(userInput)
```

**Edge Functions:**
```typescript
// ✅ GOOD: Sanitize before AI prompts
function sanitizeInput(input: string): string {
  return input
    .trim()
    .slice(0, 5000)  // Max length
    .replace(/[<>]/g, '')  // Remove potential HTML
}
```

**RULE:** Never trust user input. Validate at every boundary.

### HTTPS & Headers

**All production traffic MUST be HTTPS.**

**Security Headers (should be configured at hosting level):**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
```

**TODO:** Configure security headers in Lovable.dev or hosting platform.

### Authentication Token Storage

**Current:**
- Supabase manages session in localStorage
- Auto-refresh enabled

**RULE:** Never manually store JWT tokens. Let Supabase client handle it.

---

## 11. Testing Strategy

### Current State

**STATUS:** ❌ **NO TESTING FRAMEWORK CONFIGURED**

**Assumption:** Application is in MVP/demo phase without test suite.

### Future Testing Strategy

#### Test Types

| Type | Purpose | Location | Naming |
|------|---------|----------|--------|
| Unit Tests | Pure functions, utilities | `src/lib/__tests__/*.test.ts` | `{filename}.test.ts` |
| Hook Tests | Custom hooks behavior | `src/hooks/__tests__/*.test.ts` | `use{HookName}.test.ts` |
| Component Tests | UI component rendering | `src/components/__tests__/*.test.tsx` | `{ComponentName}.test.tsx` |
| Integration Tests | Feature flows | `src/__tests__/integration/*.test.tsx` | `{feature}.integration.test.tsx` |
| E2E Tests | Critical user journeys | `e2e/*.spec.ts` | `{journey}.spec.ts` |

#### Recommended Tools

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",                    // Test runner (Vite-native)
    "@testing-library/react": "^14.0.0",   // React component testing
    "@testing-library/jest-dom": "^6.0.0", // DOM matchers
    "@testing-library/user-event": "^14.0.0", // User interaction simulation
    "playwright": "^1.40.0"                // E2E testing
  }
}
```

#### Coverage Targets (Future)

- **Unit tests:** 80% coverage for `src/lib/`
- **Hook tests:** 70% coverage for `src/hooks/`
- **Component tests:** 60% coverage for `src/components/` (excluding UI primitives)
- **Integration tests:** Critical paths covered
- **E2E tests:** Happy path + error scenarios for core features

#### Testing Patterns

**Unit Test Example:**
```typescript
// src/lib/__tests__/durationValidator.test.ts
import { describe, it, expect } from 'vitest'
import { validateDuration } from '../durationValidator'

describe('validateDuration', () => {
  it('should accept valid duration', () => {
    expect(validateDuration(60)).toBe(true)
  })
  
  it('should reject negative duration', () => {
    expect(validateDuration(-10)).toBe(false)
  })
})
```

**Component Test Example:**
```typescript
// src/components/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../ui/button'

describe('Button', () => {
  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await userEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledOnce()
  })
})
```

**Hook Test Example:**
```typescript
// src/hooks/__tests__/useAIPlanification.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { useAIPlanification } from '../useAIPlanification'

describe('useAIPlanification', () => {
  it('should generate suggestions', async () => {
    const { result } = renderHook(() => useAIPlanification())
    
    result.current.generateSuggestions({ subject: 'Math' })
    
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false)
      expect(result.current.suggestions).toHaveLength(3)
    })
  })
})
```

#### Mocking Supabase

```typescript
// src/__tests__/mocks/supabase.ts
import { vi } from 'vitest'

export const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: {}, error: null })
  }
}
```

### RULE: Write Tests for New Features

**When adding new features:**
1. Write unit tests for pure functions in `lib/`
2. Write hook tests for custom hooks
3. Write component tests for complex interactive components
4. Update E2E tests if critical path changes

---

## 12. Performance Guidelines

### Bundle Optimization

**Current State:**
- Vite provides automatic code splitting
- SWC compiler (faster than Babel)
- Tree-shaking enabled by default

**Future Improvements:**

1. **Lazy Load Routes:**
```typescript
// ✅ RECOMMENDED: Lazy load heavy routes
const PlanificacionWorkspace = lazy(() => import('./pages/PlanificacionWorkspace'))

<Route path="/planificacion/:id" element={
  <Suspense fallback={<LoadingSpinner />}>
    <PlanificacionWorkspace />
  </Suspense>
} />
```

2. **Analyze Bundle:**
```bash
npm run build
npx vite-bundle-visualizer
```

3. **Dynamic Imports for Heavy Libraries:**
```typescript
// ✅ GOOD: Import jsPDF only when needed
async function exportToPDF() {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  // ...
}
```

### React Performance

**Memoization:**
```typescript
// ✅ USE when expensive calculations
const memoizedValue = useMemo(() => 
  expensiveCalculation(data), 
  [data]
)

// ✅ USE for callbacks passed to optimized child components
const handleClick = useCallback(() => {
  doSomething(id)
}, [id])

// ❌ AVOID premature optimization
// Don't wrap every value in useMemo
```

**Component Splitting:**
```typescript
// ✅ GOOD: Split heavy components
function Dashboard() {
  return (
    <>
      <DashboardHeader />
      <DashboardStats />
      <DashboardCharts />  // Heavy, could be lazy loaded
    </>
  )
}

// ❌ BAD: One giant component with everything
```

### Database Query Optimization

**Current Assumption:** No indexes beyond defaults.

**Future Indexes (document-only, implement via migration):**
```sql
-- Index for frequent queries
CREATE INDEX idx_planificaciones_user_created 
ON planificaciones(user_id, created_at DESC);

CREATE INDEX idx_comunicaciones_status 
ON comunicaciones(status, created_at DESC);
```

**Query Patterns:**

```typescript
// ✅ GOOD: Select only needed columns
const { data } = await supabase
  .from('planificaciones')
  .select('id, titulo, created_at')
  .eq('user_id', userId)

// ❌ BAD: Select everything when not needed
const { data } = await supabase
  .from('planificaciones')
  .select('*')
```

**N+1 Query Prevention:**

```typescript
// ✅ GOOD: Join in single query
const { data } = await supabase
  .from('planificaciones')
  .select(`
    *,
    grupo:grupos(name, year)
  `)

// ❌ BAD: Query in loop
for (const plan of plans) {
  const { data: grupo } = await supabase
    .from('grupos')
    .select('*')
    .eq('id', plan.grupo_id)
}
```

### Caching Strategy

**React Query Configuration:**

```typescript
// Recommended defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      cacheTime: 10 * 60 * 1000,    // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

**Cache Invalidation:**
```typescript
// After mutation
queryClient.invalidateQueries(['planificaciones'])

// Optimistic update
queryClient.setQueryData(['planificaciones'], (old) => [...old, newPlan])
```

### Image Optimization

**TODO:** Implement image optimization
- Use WebP format where supported
- Provide multiple sizes (responsive images)
- Lazy load images below the fold

```typescript
// Future pattern
<img 
  src="/images/hero.webp"
  srcSet="/images/hero-sm.webp 640w, /images/hero-lg.webp 1280w"
  loading="lazy"
  alt="Hero"
/>
```

### Performance Monitoring

**TODO:** Implement Web Vitals tracking

```typescript
// Future implementation
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

function sendToAnalytics(metric) {
  // Send to analytics service
}

getCLS(sendToAnalytics)
getFID(sendToAnalytics)
getFCP(sendToAnalytics)
getLCP(sendToAnalytics)
getTTFB(sendToAnalytics)
```

---

## 13. CI/CD & Branching

### Current State

**STATUS:** ❌ **NO CI/CD PIPELINE CONFIGURED**

**Current Deployment:** Manual via Lovable.dev "Share → Publish" button.

### Recommended CI/CD Pipeline (Future)

#### GitHub Actions Workflow

**`.github/workflows/ci.yml`** (to be created):

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test  # When tests are configured

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

### Branching Strategy

**Recommended: GitHub Flow (simplified)**

```
main (production)
  ↑
  PR
  ↑
feature/feature-name
```

**Branch Naming:**
- `feature/add-evaluation-templates`
- `fix/bulletin-generation-error`
- `refactor/auth-context-cleanup`
- `docs/update-architecture-plan`

**Rules:**
1. `main` branch is protected (no direct commits)
2. All changes via Pull Request
3. PR must pass CI checks before merge
4. Squash commits on merge (clean history)

### Commit Message Convention

**Follow Conventional Commits:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `docs:` Documentation changes
- `style:` Code style changes (formatting, no logic)
- `test:` Test additions or fixes
- `chore:` Build process or auxiliary tool changes

**Examples:**
```
feat(planificacion): add session duration validator

Implements duration validation to prevent sessions shorter than 30 minutes or longer than 4 hours.

Closes #123
```

```
fix(auth): prevent duplicate session creation

The ensureSupabaseAuth function was being called multiple times, creating duplicate sessions.

Fixes #456
```

### Pull Request Template

**`.github/pull_request_template.md`** (to be created):

```markdown
## Description
<!-- Describe your changes in detail -->

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Checklist
- [ ] I have read the Architecture Plan (`tools/architecture_plan.md`)
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have updated the documentation (if applicable)
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix is effective or that my feature works (when applicable)
- [ ] New and existing unit tests pass locally with my changes

## Architecture Compliance
- [ ] My changes align with the module boundaries defined in the Architecture Plan
- [ ] I have not introduced forbidden dependencies (e.g., UI importing Supabase directly)
- [ ] If I needed to deviate from the Architecture Plan, I updated the plan first

## Screenshots (if applicable)
<!-- Add screenshots to help explain your changes -->
```

### Preview Environments

**TODO:** Configure preview deployments for PRs

**Ideal Setup:**
- Every PR gets a unique preview URL
- Comment on PR with preview link
- Auto-deploy on push to PR branch
- Auto-cleanup on PR merge/close

---

## 14. Environment Configuration

### Environment Variables

**Frontend (src/integrations/supabase/client.ts):**
```typescript
// Currently hardcoded (acceptable for demo with anon key)
const SUPABASE_URL = "https://srlrbuphsogwgymqywhe.supabase.co"
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGci..."  // Anon key (public)
```

**Future Pattern (recommended):**
```typescript
// Vite env vars (must start with VITE_)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
```

**Edge Functions (Deno):**
```typescript
// Read from Supabase secrets
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
```

### Environment Files

**TODO:** Create `.env.example` with template:

```bash
# .env.example (to be created)
# Frontend - Supabase (anon key is safe to expose)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Edge Functions (set via Supabase CLI)
# OPENAI_API_KEY=sk-...  (DO NOT commit actual key)
```

**`.gitignore` should include:**
```
.env
.env.local
.env.*.local
```

### Per-Environment Configuration

| Environment | Branch | URL | Database | AI Budget |
|-------------|--------|-----|----------|-----------|
| Development | - | localhost:8080 | Local Supabase or dev project | Unlimited |
| Staging | develop | staging.aulaplus.com | Staging DB | Limited |
| Production | main | aulaplus.com | Production DB | Monitored |

**RULE:** Never use production database from development environment.

---

## 15. Observability

### Current State

**STATUS:** ❌ **NO OBSERVABILITY CONFIGURED**

**What Exists:**
- Console logging in Edge Functions
- React error boundaries (ErrorBoundary component exists)
- Toast notifications for user-facing errors

### Logging Strategy (Future)

**Log Levels:**
```typescript
enum LogLevel {
  DEBUG = 'debug',    // Verbose, development only
  INFO = 'info',      // Informational messages
  WARN = 'warn',      // Warning but not error
  ERROR = 'error',    // Error with recovery
  FATAL = 'fatal',    // Error without recovery
}
```

**Frontend Logging:**
```typescript
// TODO: Implement structured logger
const logger = {
  info: (message: string, context?: object) => {
    if (import.meta.env.DEV) {
      console.log(`[INFO] ${message}`, context)
    }
    // In production: send to logging service
  },
  error: (message: string, error: Error, context?: object) => {
    console.error(`[ERROR] ${message}`, error, context)
    // Send to error tracking service (Sentry, etc.)
  }
}
```

**Edge Function Logging:**
```typescript
// Current pattern
console.log('Generating bulletin text for student:', student.name)
console.error('OpenAI API error:', error)

// Future: Structured logging
logger.info('bulletin_generation_start', { studentId, period })
logger.error('openai_api_error', { error, statusCode, model })
```

### Error Tracking (Future)

**Recommended: Sentry Integration**

```typescript
// TODO: Configure Sentry
import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ]
})
```

### Metrics (Future)

**Recommended Metrics:**
- **Frontend:**
  - Page load time (Web Vitals)
  - API call duration
  - Error rate
  - User session duration

- **Backend (Edge Functions):**
  - Function invocation count
  - Function duration
  - OpenAI API latency
  - Token usage (cost tracking)
  - Error rate by function

### Alerting (Future)

**Critical Alerts:**
- Error rate > 5%
- API latency > 5s (p95)
- OpenAI API budget exceeded
- Database connection failures

**Tools:** Sentry alerts, Supabase monitoring, custom dashboards

---

## 16. Do/Don't Checklist for Contributors

### 🟢 DO

#### Architecture
- ✅ Load `tools/architecture_plan.md` before starting any task
- ✅ Follow module boundaries (Pages → Components → Hooks → Lib)
- ✅ Keep components small and focused (< 250 lines)
- ✅ Extract business logic to custom hooks
- ✅ Use TypeScript for all new files
- ✅ Define interfaces for props and return types

#### Code Quality
- ✅ Use `const` by default, `let` only when reassigning
- ✅ Destructure props in component signatures
- ✅ Use meaningful variable names (`selectedStudent` not `s`)
- ✅ Add JSDoc comments for complex functions
- ✅ Handle loading and error states in UI
- ✅ Validate user input with Zod schemas

#### Styling
- ✅ Use Tailwind utility classes
- ✅ Use `cn()` helper for conditional classes
- ✅ Check shadcn/ui before creating custom components
- ✅ Respect the design system (colors, spacing, radii)
- ✅ Support dark mode (use CSS variables)

#### Data & API
- ✅ Use React Query for server state
- ✅ Implement retry logic in Edge Functions
- ✅ Validate input at every boundary
- ✅ Handle errors gracefully with user-friendly messages
- ✅ Use Supabase generated types (`Database` from types.ts)

#### Security
- ✅ Store secrets in environment variables
- ✅ Sanitize user input before AI prompts
- ✅ Use RLS policies on all tables
- ✅ Call OpenAI only from Edge Functions, never frontend

#### Git & Collaboration
- ✅ Write descriptive commit messages (Conventional Commits)
- ✅ Create feature branches from `main`
- ✅ Open PR with description and checklist
- ✅ Self-review before requesting review
- ✅ Run `npm run lint` before committing

### 🔴 DON'T

#### Architecture Violations
- ❌ Don't access Supabase directly from UI components
- ❌ Don't put business logic in page components
- ❌ Don't create circular dependencies between modules
- ❌ Don't import from parent directories (use absolute imports `@/...`)
- ❌ Don't bypass React Query for Supabase queries

#### Code Smells
- ❌ Don't use `any` type (use `unknown` or proper type)
- ❌ Don't ignore TypeScript errors (`@ts-ignore` without comment)
- ❌ Don't create deeply nested ternaries (> 2 levels)
- ❌ Don't mutate props or state directly
- ❌ Don't use inline arrow functions in render (causes re-renders)

#### Styling Anti-Patterns
- ❌ Don't create custom CSS files (use Tailwind)
- ❌ Don't use `!important` in CSS
- ❌ Don't hardcode colors (use design system tokens)
- ❌ Don't forget responsive design (use `sm:`, `md:`, `lg:`)

#### Data & API
- ❌ Don't fetch data in `useEffect` without cleanup
- ❌ Don't forget to handle loading states
- ❌ Don't ignore error responses
- ❌ Don't call external APIs from frontend
- ❌ Don't store sensitive data in localStorage

#### Security
- ❌ Don't commit `.env` files
- ❌ Don't hardcode API keys
- ❌ Don't expose service role keys to frontend
- ❌ Don't trust user input
- ❌ Don't use `dangerouslySetInnerHTML` without sanitization

#### Git
- ❌ Don't commit directly to `main`
- ❌ Don't commit `node_modules` or `dist/`
- ❌ Don't use generic commit messages ("fix", "update")
- ❌ Don't leave commented-out code
- ❌ Don't commit merge conflicts

---

## 17. ADR-lite Process

### What are ADRs?

**Architecture Decision Records (ADRs)** document significant architectural decisions, their context, and consequences.

### When to Write an ADR

Write an ADR when:
- Choosing between architectural patterns (e.g., MobX vs React Query)
- Adopting a new major technology (e.g., adding GraphQL)
- Changing a fundamental convention (e.g., file structure overhaul)
- Making a trade-off decision (e.g., bundle size vs features)

### ADR Format

```markdown
## ADR-XXX: [Title]
**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-YYY  
**Deciders:** [Names or roles]  

### Context
[What is the issue we're facing? What factors are at play?]

### Decision
[What is the change we're proposing/making?]

### Consequences
**Positive:**
- [Benefit 1]
- [Benefit 2]

**Negative:**
- [Trade-off 1]
- [Trade-off 2]

**Neutral:**
- [Implication 1]

### Alternatives Considered
1. **[Alternative 1]**: [Why rejected]
2. **[Alternative 2]**: [Why rejected]
```

### ADR Storage

ADRs are appended to **Section 18** of this document (`tools/architecture_plan.md`).

---

## 18. Architecture Decision Records

### ADR-001: Use Supabase for Backend

**Date:** 2025-09 (Inferred)  
**Status:** Accepted  
**Deciders:** Project team  

#### Context
Need a backend solution that provides:
- PostgreSQL database with migrations
- Authentication system
- Serverless functions
- Real-time capabilities (future use)
- TypeScript SDK

#### Decision
Adopt Supabase as the Backend-as-a-Service (BaaS) platform.

#### Consequences
**Positive:**
- Rapid development (no backend server to maintain)
- Built-in auth, storage, and database
- TypeScript types generated from schema
- Generous free tier for MVP

**Negative:**
- Vendor lock-in (migration to self-hosted would be complex)
- Less control over backend logic
- Edge Functions limited to Deno runtime

**Neutral:**
- Requires learning Supabase-specific patterns (RLS, PostgREST)

---

### ADR-002: Use OpenAI for AI Features

**Date:** 2025-09 (Inferred)  
**Status:** Accepted  
**Deciders:** Project team  

#### Context
Need AI capabilities for:
- Generating personalized bulletin texts
- Creating lesson plans adapted to student profiles
- Suggesting pedagogical strategies

#### Decision
Integrate OpenAI API (GPT-4.1 and GPT-4o-mini) for AI-powered features.

#### Consequences
**Positive:**
- State-of-the-art natural language generation
- Context-aware responses (ANEP pedagogy)
- Multiple model tiers (cost vs quality)

**Negative:**
- Variable cost per request (depends on usage)
- External dependency (API downtime affects features)
- Token limits require prompt engineering

**Neutral:**
- Requires prompt engineering expertise
- Need fallback for when API is unavailable

#### Alternatives Considered
1. **Open-source LLM (e.g., Llama)**: Rejected due to hosting complexity and quality gap
2. **Anthropic Claude**: Comparable but chose OpenAI for ecosystem maturity

---

### ADR-003: Adopt shadcn/ui Component System

**Date:** 2025-09 (Inferred)  
**Status:** Accepted  
**Deciders:** Frontend team  

#### Context
Need a component library that:
- Provides accessible primitives
- Is customizable (not opinionated styling)
- Works with Tailwind CSS
- Supports dark mode
- Has good TypeScript support

#### Decision
Use shadcn/ui (built on Radix UI) as the component system.

#### Consequences
**Positive:**
- Copy-paste ownership (components live in repo, not node_modules)
- Full customization freedom
- Excellent accessibility (Radix primitives)
- Tailwind-native styling

**Negative:**
- Updates require manual copy-paste (not versioned npm package)
- Larger codebase (62+ component files)

**Neutral:**
- Learning curve for Radix patterns
- Need to maintain components ourselves

#### Alternatives Considered
1. **Material UI**: Rejected for being too opinionated, harder to customize
2. **Chakra UI**: Rejected for not being Tailwind-native

---

### ADR-004: Relax TypeScript Strict Mode

**Date:** 2025-09 (Inferred)  
**Status:** Accepted (with intent to revisit)  
**Deciders:** Project team  

#### Context
TypeScript strict mode (`noImplicitAny: true`, `strictNullChecks: true`) requires more upfront typing work.

#### Decision
Use relaxed TypeScript mode for MVP:
- `noImplicitAny: false`
- `strictNullChecks: false`
- `noUnusedLocals: false`

#### Consequences
**Positive:**
- Faster initial development
- Less friction for AI-assisted coding
- Easier onboarding for less experienced TypeScript developers

**Negative:**
- More runtime errors (null/undefined not caught at compile time)
- Harder to refactor later (implicit any propagates)
- Less IDE autocomplete quality

**Neutral:**
- Technical debt to address post-MVP

#### Future Action
Incrementally enable strict mode as codebase stabilizes.

---

## 19. Future Refactors & Open Questions

### High-Priority Refactors

1. **Enable TypeScript Strict Mode**
   - **Why:** Catch more errors at compile time
   - **Effort:** High (requires typing entire codebase)
   - **Benefit:** Improved code quality, better refactoring safety

2. **Implement Testing Suite**
   - **Why:** Currently no tests, high risk of regressions
   - **Effort:** High (requires Vitest setup + writing tests)
   - **Benefit:** Confidence in refactoring, faster feedback

3. **Configure CI/CD Pipeline**
   - **Why:** Manual deployment is error-prone
   - **Effort:** Medium (GitHub Actions setup)
   - **Benefit:** Automated quality checks, preview environments

4. **Add Error Tracking (Sentry)**
   - **Why:** No visibility into production errors
   - **Effort:** Low (Sentry integration is straightforward)
   - **Benefit:** Proactive bug detection, better UX

5. **Implement RLS Policies**
   - **Why:** Assumption that RLS is configured, but not verified
   - **Effort:** Medium (requires security audit + policy writing)
   - **Benefit:** Secure data isolation

### Medium-Priority Refactors

6. **Lazy Load Routes**
   - **Why:** Improve initial load time
   - **Effort:** Low (add React.lazy wrappers)
   - **Benefit:** Smaller initial bundle

7. **Database Indexing**
   - **Why:** Query performance will degrade with data growth
   - **Effort:** Low (add migrations with indexes)
   - **Benefit:** Faster queries

8. **API Response Caching**
   - **Why:** Reduce OpenAI API costs
   - **Effort:** Medium (implement caching layer in Edge Functions)
   - **Benefit:** Cost savings, faster responses

9. **Move Supabase Config to Env Vars**
   - **Why:** Hardcoded URLs are inflexible
   - **Effort:** Low (refactor to use import.meta.env)
   - **Benefit:** Easier environment switching

10. **Create `.env.example`**
    - **Why:** Document required environment variables
    - **Effort:** Low (create template file)
    - **Benefit:** Easier onboarding

### Low-Priority / Nice-to-Have

11. **Implement Internationalization (i18n)**
    - **Why:** Currently Spanish-only
    - **Effort:** High (extract strings, add i18next)
    - **Benefit:** Potential for expansion to other countries

12. **Performance Monitoring (Web Vitals)**
    - **Why:** No visibility into frontend performance
    - **Effort:** Low (add web-vitals package)
    - **Benefit:** Data-driven performance improvements

13. **A11y Audit**
    - **Why:** Assumed accessible via Radix, not verified
    - **Effort:** Medium (audit with axe-core, fix issues)
    - **Benefit:** Inclusive product

14. **Image Optimization**
    - **Why:** No image optimization pipeline
    - **Effort:** Medium (add build step for WebP conversion)
    - **Benefit:** Faster page loads

15. **Component Storybook**
    - **Why:** No isolated component development environment
    - **Effort:** Medium (setup Storybook, write stories)
    - **Benefit:** Better UI development workflow

### Open Questions

#### Technical
- **Q1:** Are RLS policies correctly configured on all tables?
- **Q2:** What is the actual database schema (all tables, columns, relationships)?
- **Q3:** Are there other Edge Functions not visible in the repository?
- **Q4:** What is the rate limit strategy for OpenAI API?
- **Q5:** Is there a staging environment, or is it production-only?

#### Product
- **Q6:** What is the target scale (users, schools)?
- **Q7:** Are there plans for mobile app (React Native)?
- **Q8:** What is the roadmap for next 6 months?

#### Process
- **Q9:** Who has access to production Supabase dashboard?
- **Q10:** What is the release cycle (weekly, monthly)?
- **Q11:** Is there a QA process before releases?

#### Compliance
- **Q12:** What are the data retention requirements?
- **Q13:** Is GDPR or similar privacy regulation applicable?
- **Q14:** Are there educational regulations (Uruguay) to comply with?

---

## 20. Document Maintenance

### Updating This Plan

**This document MUST be updated when:**
- A new major technology is adopted
- Module boundaries change
- New architectural patterns are introduced
- An ADR is created
- Conventions are changed

**Process:**
1. Create a feature branch: `docs/update-architecture-plan`
2. Edit `tools/architecture_plan.md`
3. Add ADR if it's a significant decision (Section 18)
4. Open PR with "Architecture Plan Update" label
5. Require review from tech lead or architect
6. Merge only after approval

### Review Cadence

- **Quarterly:** Full review of Architecture Plan
- **Post-Major Feature:** Review affected sections
- **Post-Incident:** Review security, error handling, observability sections

### Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-24 | Cursor AI (Initial) | Initial architecture plan based on codebase analysis |

---

## Appendix A: Quick Reference

### File Import Patterns

```typescript
// ✅ GOOD: Use absolute imports with @ alias
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { cn } from '@/lib/utils'

// ❌ BAD: Relative imports across many levels
import { Button } from '../../../components/ui/button'
```

### Common Commands

```bash
# Development
npm run dev              # Start dev server (localhost:8080)
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint

# Supabase (with CLI installed)
supabase start           # Start local Supabase
supabase db push         # Push migrations
supabase functions serve # Serve edge functions locally
```

### Key File Locations

| Purpose | Location |
|---------|----------|
| Supabase Client | `src/integrations/supabase/client.ts` |
| Auth Context | `src/contexts/AuthContext.tsx` |
| Main Router | `src/App.tsx` |
| Global Styles | `src/index.css` |
| Tailwind Config | `tailwind.config.ts` |
| TypeScript Config | `tsconfig.json` |
| shadcn Config | `components.json` |
| Architecture Plan | `tools/architecture_plan.md` (THIS FILE) |

### Useful Snippets

**React Query Hook:**
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  }
})
```

**Edge Function Template:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { param } = await req.json()
    // Logic here
    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

**END OF ARCHITECTURE PLAN**

*This document is maintained by the development team and serves as the single source of truth for architectural decisions in the AulaPlus v0 project.*

*Last Updated: 2025-10-24*

