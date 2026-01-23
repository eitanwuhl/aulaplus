# AULA+ Onboarding Report

**Date**: 2025-12-23  
**Project**: AULA+ (Plataforma Educativa Inclusiva)  
**Stack**: React + TypeScript + Vite + Supabase  
**Branch**: `Aulaplus-by-eitan-2`

---

## 1. Overview

### What the App Is

**AULA+** es una plataforma educativa diseñada para docentes de educación secundaria en Uruguay, enfocada en educación inclusiva y adaptada a los perfiles de aprendizaje de los estudiantes.

**Dominio**: Educación inclusiva / Planificación pedagógica / Evaluaciones adaptadas

**Propósito Principal**:
- Asistir a docentes en la planificación de clases con IA
- Generar evaluaciones adaptadas a perfiles de aprendizaje individuales
- Gestionar competencias curriculares ANEP (Administración Nacional de Educación Pública)
- Facilitar comunicación entre docentes, dirección y equipo psicopedagógico
- Generar reportes y análisis de competencias trabajadas

### User Roles

**Identificados en código**:

1. **Teacher (Docente)** - Rol principal
   - Autenticación: `role === 'teacher'`
   - Acceso: Todas las funcionalidades principales
   - Flujos: Planificación, Evaluaciones, Grupos, Comunicaciones

2. **Student (Estudiante)** - Rol secundario
   - Autenticación: `role === 'student'`
   - Acceso: Diagnóstico individual (`/student-diagnostic`)
   - Flujos limitados (no explorados en detalle en este análisis)

**Nota**: El sistema usa autenticación demo con usuario fijo (`demo.teacher@example.com`) para desarrollo.

---

## 2. Tech Stack

### Frontend
- **Framework**: React 18.3.1
- **Build Tool**: Vite 5.4.1
- **Language**: TypeScript 5.5.3
- **Routing**: React Router DOM 6.26.2
- **State Management**: 
  - React Context API (`AuthContext`)
  - React Query (`@tanstack/react-query`) para server state
  - Local state con hooks (`useState`, `useMemo`, `useEffect`)
- **UI Library**: 
  - Shadcn UI (componentes base de Radix UI)
  - Tailwind CSS 3.4.11
  - Lucide React (iconos)
- **Charts**: Recharts 2.12.7
- **Forms**: React Hook Form 7.53.0 + Zod 3.23.8
- **Date Handling**: date-fns 3.6.0 + react-day-picker 8.10.1
- **PDF Generation**: jsPDF 3.0.1 + html2canvas 1.4.1
- **Animations**: Framer Motion 12.19.1

### Backend / Infrastructure
- **BaaS**: Supabase
  - Database: PostgreSQL (via Supabase)
  - Auth: Supabase Auth (email/password)
  - Storage: Supabase Storage (para archivos de comunicaciones)
  - Edge Functions: Deno runtime (4 funciones)
- **AI Integration**: OpenAI API (vía edge functions)

### Development Tools
- **Linting**: ESLint 9.9.0
- **Package Manager**: npm (también hay `bun.lockb` presente)
- **IDE Integration**: Lovable.dev (component tagging en dev mode)

---

## 3. Repo Structure

### Top-Level Organization

```
aulaplus-v0/
├── src/                    # Código fuente principal
├── supabase/              # Configuración y migraciones de Supabase
├── public/                # Assets estáticos
├── docs/                  # Documentación (análisis, guías)
├── refactor/              # Documentación de refactorizaciones
├── tools/                 # Herramientas y planes de arquitectura
├── vite.config.ts         # Configuración de Vite
├── tailwind.config.ts     # Configuración de Tailwind
├── tsconfig.json          # Configuración TypeScript
├── package.json           # Dependencias y scripts
└── README.md              # Documentación básica
```

### Key Directories

#### `src/`
- **`pages/`** (12 archivos): Componentes de página/ruta principales
  - `EvaluacionesChoice.tsx` - Pantalla de elección para evaluaciones
  - `EvaluacionesGrupo.tsx` - Workspace de generación de evaluaciones
  - `MisEvaluaciones.tsx` - Dashboard de evaluaciones guardadas
  - `PlanificacionClase.tsx` - Pantalla de elección para planificaciones
  - `PlanificacionWizard.tsx` - Wizard de creación de planificación
  - `PlanificacionWorkspace.tsx` - Workspace de edición de planificación
  - `MisPlanificaciones.tsx` - Dashboard de planificaciones guardadas
  - `TeacherGroups.tsx` - Gestión de grupos
  - `TeacherDashboard.tsx` - Dashboard principal
  - `StudentDiagnostic.tsx` - Diagnóstico individual (estudiante)
  - `Comunicaciones.tsx` - Comunicaciones con dirección/psicopedagogía
  - `NotFound.tsx` - Página 404

- **`components/`** (128 archivos): Componentes reutilizables
  - `ui/` - Componentes base de Shadcn UI (40+ componentes)
  - `planificacion/` - Componentes específicos de planificación (13 archivos)
  - `evaluaciones/` - Componentes específicos de evaluaciones (11 archivos)
  - `AppLayout.tsx` - Layout principal con sidebar
  - `AppSidebar.tsx` - Sidebar de navegación
  - `TeacherDashboard.tsx` - Dashboard del docente
  - Varios componentes de visualización y análisis

- **`hooks/`** (7 archivos): Custom React hooks
  - `usePlanificacionWizard.ts` - Lógica del wizard
  - `useFullSessionGeneration.ts` - Generación de sesiones
  - `useAIPlanification.ts` - Integración con IA
  - `useBulletinGenerator.ts` - Generación de boletines
  - `useCalendarioSesiones.ts` - Gestión de calendario
  - `use-toast.ts` - Sistema de notificaciones
  - `use-mobile.tsx` - Detección de móvil

- **`lib/`** (14 archivos): Utilidades y helpers
  - `normalizeSupabaseArrays.ts` - Normalización de arrays de Supabase
  - `subjectNormalizer.ts` - Normalización de nombres de materias
  - `planParser.ts` - Parser de planes HTML
  - `competencyExtractor.ts` - Extracción de competencias
  - `registroCompetencialPDF.ts` - Generación de PDFs
  - `storage.ts` - Utilidades de Supabase Storage
  - Varios validadores y normalizadores

- **`data/`** (5 archivos): Catálogos estáticos
  - `competencias.ts` - Catálogo de competencias de Historia
  - `competenciasLiteratura.ts` - Catálogo de competencias de Literatura
  - `competenciasCiudadania.ts` - Catálogo de competencias de Ciudadanía
  - `catalogo.ts` - Catálogo jerárquico de contenidos
  - `mockData.ts` - Datos mock de grupos y estudiantes

- **`types/`** (3 archivos): Definiciones TypeScript
  - `planificacion.ts` - Tipos de planificaciones y sesiones
  - `calendario.ts` - Tipos de calendario
  - `validation.ts` - Tipos de validación

- **`contexts/`** (1 archivo): React Context
  - `AuthContext.tsx` - Contexto de autenticación

- **`integrations/`** (2 archivos): Integraciones externas
  - `supabase/client.ts` - Cliente de Supabase
  - `supabase/types.ts` - Tipos generados de Supabase

#### `supabase/`
- **`migrations/`** (18 archivos SQL): Migraciones de base de datos
  - Ordenadas por timestamp
  - Últimas migraciones: explicit save, soft delete, evaluaciones
- **`functions/`** (4 funciones): Edge Functions (Deno)
  - `generate-plan-completo` - Genera planes de sesión con IA
  - `modify-evaluation` - Modifica evaluaciones con IA
  - `generate-bulletin-text` - Genera textos de boletines
  - `ensure-demo-users` - Crea usuarios demo
- **`config.toml`**: Configuración local de Supabase

#### `docs/` y `refactor/`
- Documentación de análisis, bugfixes, y guías de implementación
- ~40 archivos markdown con historial de cambios

---

## 4. Routing / Navigation Map

### Route Structure

**Entry Point**: `src/main.tsx` → `src/App.tsx`

**Router**: React Router DOM v6 (`BrowserRouter`)

### Public Routes
- `/` - Role selection (redirige si autenticado)
- `/teacher-login` - Login de docente
- `/student-login` - Login de estudiante

### Protected Teacher Routes
Todas envueltas en `<ProtectedTeacherRoute>` que:
- Verifica autenticación
- Verifica `user.role === 'teacher'`
- Envuelve en `<AppLayout>` (sidebar + contenido)

**Rutas principales**:
- `/teacher-dashboard` → `TeacherDashboard` - Dashboard principal
- `/teacher-groups` → `TeacherGroups` - Gestión de grupos

**Planificaciones**:
- `/planificacion` → `PlanificacionClase` - Pantalla de elección
- `/planificacion/nuevo` → `PlanificacionWizard` - Wizard de creación
- `/planificacion/:id` → `PlanificacionWorkspace` - Workspace de edición
- `/mis-planificaciones` → `MisPlanificaciones` - Dashboard guardadas

**Evaluaciones**:
- `/evaluaciones` → `EvaluacionesChoice` - Pantalla de elección
- `/evaluaciones/nuevo` → `EvaluacionesGrupo` - Workspace de generación
- `/mis-evaluaciones` → `MisEvaluaciones` - Dashboard guardadas

**Otros**:
- `/comunicaciones` → `Comunicaciones` - Comunicaciones con dirección

### Protected Student Routes
- `/student-diagnostic` → `StudentDiagnostic` - Diagnóstico individual

### Navigation Component
**`AppSidebar.tsx`**: Sidebar colapsable con:
- Inicio (`/teacher-dashboard`)
- Evaluaciones Grupales (`/evaluaciones`)
- Planificación de Clase (`/planificacion`)
- Mis Planificaciones (`/mis-planificaciones`)

---

## 5. Supabase Integration

### Client Configuration

**File**: `src/integrations/supabase/client.ts`

**Setup**:
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

**Environment Variables Required**:
- `VITE_SUPABASE_URL` - URL del proyecto Supabase
- `VITE_SUPABASE_ANON_KEY` - Clave pública anónima

**Validations**:
- Valida presencia de variables en runtime
- Warning en dev si anon key es muy corta (< 50 chars)

### Authentication

**File**: `src/contexts/AuthContext.tsx`

**Strategy**: Demo mode con autenticación automática

**Flow**:
1. `AuthProvider` monta → llama `ensureSupabaseAuth()`
2. `ensureSupabaseAuth()`:
   - Invoca edge function `ensure-demo-users` (crea usuario si no existe)
   - Hace sign-in con `demo.teacher@example.com` / `DemoPassword2024!`
3. `onAuthStateChange` listener:
   - Actualiza `session` state
   - Upsert silencioso en tabla `profiles` (crea/actualiza perfil)
4. Frontend crea `User` mock con nombre aleatorio de lista
5. Guarda en `localStorage` para persistencia

**User Object**:
```typescript
interface User {
  id: string;           // De Supabase session o generado
  role: 'teacher' | 'student';
  name: string;         // Nombre aleatorio para demo
  username?: string;    // Solo para estudiantes
}
```

**Protected Routes**:
- `ProtectedTeacherRoute`: Verifica `user.role === 'teacher'`
- `ProtectedStudentRoute`: Verifica `user.role === 'student'`
- Redirige a `/` si no autenticado o rol incorrecto

### Database Queries

**Pattern**: Direct Supabase client calls (no abstracción de servicio)

**Common Patterns**:
```typescript
// SELECT with filters
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('field', value)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });

// INSERT
const { data, error } = await supabase
  .from('table_name')
  .insert(payload)
  .select()
  .single();

// UPDATE (soft delete)
await supabase
  .from('table_name')
  .update({ deleted_at: new Date().toISOString() })
  .in('id', idsArray);
```

**Tables Queried** (identificadas en código):
- `planificaciones` - Planificaciones de clases
- `sesiones_clase` - Sesiones individuales
- `evaluaciones` - Evaluaciones guardadas
- `profiles` - Perfiles de usuario
- `comunicaciones` - Comunicaciones con dirección
- `calendario_eventos` - Eventos del calendario

### Edge Functions

**Location**: `supabase/functions/`

**Functions**:

1. **`generate-plan-completo`**
   - **Purpose**: Genera plan de desarrollo de sesión con IA
   - **Input**: sesionId, materia, contenidos, competencias, perfilGrupo, estudiantes
   - **Output**: HTML del plan generado
   - **Used by**: `EditorSesionTabs.tsx` (generación de plan de sesión)

2. **`modify-evaluation`**
   - **Purpose**: Modifica evaluaciones existentes con IA
   - **Input**: originalEvaluation, modification, groupContext
   - **Output**: Evaluación modificada
   - **Used by**: `EvaluacionesGrupo.tsx`, `EnhancedEvaluationGenerator.tsx`, hooks

3. **`generate-bulletin-text`**
   - **Purpose**: Genera textos de boletines con IA
   - **Used by**: `useBulletinGenerator.ts`

4. **`ensure-demo-users`**
   - **Purpose**: Crea usuarios demo si no existen
   - **Used by**: `AuthContext.tsx` (background setup)

**Configuration**: `config.toml` indica que algunas funciones tienen `verify_jwt = false`

### Storage

**Buckets Identified**:
- `comunicaciones` - Archivos adjuntos de comunicaciones
- `evaluaciones-assets` - Assets de evaluaciones (mencionado en migraciones)

**Usage**:
- `src/lib/storage.ts` - Utilidades para upload/download
- `src/lib/imageValidator.ts` - Validación y rehosting de imágenes

### RLS (Row Level Security)

**Enabled on**:
- `planificaciones` - Policies: SELECT/INSERT/UPDATE por `user_id = auth.uid()`
- `sesiones_clase` - Policies: SELECT/INSERT/UPDATE por `user_id = auth.uid()`
- `evaluaciones` - Policies: SELECT (solo guardadas), INSERT, UPDATE por `user_id = auth.uid()`
- `profiles` - Policies: SELECT/INSERT/UPDATE por `user_id = auth.uid()`
- `comunicaciones` - Policies: SELECT/INSERT/UPDATE por `user_id = auth.uid()`
- `calendario_eventos` - Policies: SELECT/INSERT/UPDATE por `user_id = auth.uid()`

**Pattern**: Todas las políticas verifican `auth.uid() = user_id` para aislamiento por usuario.

---

## 6. Data Model Map

### Core Tables

#### 1. `planificaciones`
**Purpose**: Planificaciones pedagógicas de períodos/clases

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `grupo_id` (text) - ID del grupo
- `materia` (text) - Materia (Historia, Literatura, etc.)
- `nivel` (text) - Nivel (8vo, 9no)
- `fecha_inicio`, `fecha_fin` (date) - Período
- `competencias_seleccionadas` (text[]) - IDs de competencias
- `contenidos_programa` (text) - Contenidos
- `mapeo_competencias_contenidos` (jsonb) - Mapeo
- `configuracion_horario` (jsonb) - Horarios semanales
- `distribucion_modalidades` (jsonb) - Modalidades
- `nombre` (text, nullable) - Nombre personalizado
- `is_saved` (boolean) - Flag de guardado explícito
- `saved_at` (timestamptz, nullable) - Timestamp de guardado
- `deleted_at` (timestamptz, nullable) - Soft delete
- `created_at`, `updated_at` (timestamptz)

**Relationships**:
- `sesiones_clase.planificacion_id` → `planificaciones.id` (1:N)

**Indexes**:
- `idx_planificaciones_is_saved_deleted` - Para queries de guardadas

#### 2. `sesiones_clase`
**Purpose**: Sesiones individuales de clase

**Key Columns**:
- `id` (uuid, PK)
- `planificacion_id` (uuid, FK → planificaciones)
- `fecha` (date, nullable) - Fecha de la sesión
- `duracion_minutos` (integer)
- `competencias_anep` (text[]) - IDs de competencias
- `contenidos_anep` (text[])
- `criterios_logro_anep` (text[])
- `plan_desarrollo` (jsonb) - Plan de inicio/desarrollo/cierre
- `evaluacion` (jsonb) - Configuración de evaluación
- `estado` (text) - 'backlog' | 'planificada' | 'dictada' | 'omitida' | 'pausada'
- `orden` (integer) - Orden en la planificación
- `created_at`, `updated_at` (timestamptz)

**Relationships**:
- `planificacion_id` → `planificaciones.id` (N:1)

**Normalization Note**: `competencias_anep` puede venir como null/string/array → requiere normalización.

#### 3. `evaluaciones`
**Purpose**: Evaluaciones generadas y guardadas

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `nombre` (text) - Nombre personalizado
- `materia` (text) - Materia
- `grupo_id` (text) - ID del grupo
- `nivel` (text) - Nivel (8vo, 9no)
- `fecha` (date, nullable) - Fecha de la evaluación
- `competencias_anep` (text[]) - IDs de competencias usadas
- `contenidos` (text[]) - IDs de contenidos
- `criterios_logro` (text[])
- `requerimientos` (text)
- `evaluacion_generada` (jsonb) - Contenido generado (versiones, etc.)
- `rubrica` (jsonb) - Datos de rúbrica
- `configuracion` (jsonb)
- `is_saved` (boolean) - Flag de guardado explícito
- `saved_at` (timestamptz, nullable)
- `deleted_at` (timestamptz, nullable) - Soft delete
- `created_at`, `updated_at` (timestamptz)

**Relationships**: Ninguna FK (tabla independiente)

**Indexes**:
- `idx_evaluaciones_user_saved` - Para queries de guardadas
- `idx_evaluaciones_filters` - Para filtros (materia, grupo, fecha)
- `idx_evaluaciones_competencias` - GIN index para array

**Normalization Note**: `competencias_anep` y `fecha` requieren normalización (pueden ser null/string/array).

#### 4. `profiles`
**Purpose**: Perfiles de usuario extendidos

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, UNIQUE)
- `display_name` (text)
- `role` (text) - 'teacher' | 'student'
- `created_at`, `updated_at` (timestamptz)

**Relationships**:
- `user_id` → `auth.users.id` (1:1)

#### 5. `comunicaciones`
**Purpose**: Comunicaciones entre docentes y dirección/psicopedagogía

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `to_role` (text) - 'direccion' | 'psicopedagogico'
- `subject` (text)
- `message` (text)
- `attachment_urls` (jsonb) - URLs de archivos
- `related_planificacion_id` (uuid, FK → planificaciones, nullable)
- `status` (text) - Estado de la comunicación
- `created_at` (timestamptz)

**Relationships**:
- `related_planificacion_id` → `planificaciones.id` (N:1, nullable)

#### 6. `calendario_eventos`
**Purpose**: Eventos del calendario (institucionales, grupales, personales)

**Key Columns**:
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users)
- `fecha` (date)
- `titulo` (text)
- `alcance` (text) - 'institucional' | 'grupo' | 'personal'
- `created_at` (timestamptz)

### Denormalized / JSON Fields

**Campos JSONB que pueden causar problemas de tipo**:

1. **`planificaciones.mapeo_competencias_contenidos`** (jsonb)
   - Tipo esperado: `Record<string, string[]>`
   - Riesgo: Estructura puede variar

2. **`planificaciones.configuracion_horario`** (jsonb)
   - Tipo esperado: `ConfiguracionHorario[]`
   - Riesgo: Array puede no ser array

3. **`sesiones_clase.plan_desarrollo`** (jsonb)
   - Tipo esperado: `PlanDesarrollo` (objeto con inicio/desarrollo/cierre)
   - Riesgo: Puede ser null o estructura diferente

4. **`sesiones_clase.evaluacion`** (jsonb)
   - Tipo esperado: `Evaluacion` (objeto con tipo, config, contenido)
   - Riesgo: Estructura variable

5. **`evaluaciones.evaluacion_generada`** (jsonb)
   - Contiene: `{ evaluaciones: GeneratedEvaluation[], base_prototype: string }`
   - Riesgo: Estructura compleja, puede variar

6. **`evaluaciones.rubrica`** (jsonb)
   - Tipo esperado: Array de criterios de rúbrica
   - Riesgo: Puede ser null o estructura diferente

### Array Fields Requiring Normalization

**Campos `text[]` que pueden venir en formatos inconsistentes**:

1. **`sesiones_clase.competencias_anep`** (text[])
   - Puede ser: `null`, `undefined`, `""`, `"[]"`, `["CE1", "CE2"]`
   - Normalización: `normalizeArrayField()` en load time

2. **`sesiones_clase.contenidos_anep`** (text[])
   - Similar a competencias_anep

3. **`sesiones_clase.criterios_logro_anep`** (text[])
   - Similar

4. **`evaluaciones.competencias_anep`** (text[])
   - Similar, requiere normalización en `MisEvaluaciones.tsx`

5. **`evaluaciones.contenidos`** (text[])
   - Similar

6. **`planificaciones.competencias_seleccionadas`** (text[])
   - Similar

---

## 7. Key Workflows

### Workflow 1: Planificar Clase

**Entry**: Sidebar → "Planificación de Clase" → `/planificacion`

**Screens**:
1. **`PlanificacionClase.tsx`** - Pantalla de elección
   - Opción 1: "Asistente de Planificación" → `/planificacion/nuevo`
   - Opción 2: "Mis Planificaciones" → `/mis-planificaciones`

2. **`PlanificacionWizard.tsx`** - Wizard de creación (4 pasos)
   - Paso 1: Contexto (grupo, materia, fechas, sesiones)
   - Paso 2: Horario (horas semanales, configuración)
   - Paso 3: Enfoque (unidades didácticas, competencias, contenidos)
   - Paso 4: Resumen y generación
   - **Data Written**: INSERT en `planificaciones` con `is_saved: false`

3. **`PlanificacionWorkspace.tsx`** - Workspace de edición
   - Muestra planificación cargada
   - Genera sesiones automáticamente
   - Permite editar sesiones individuales
   - **Action**: Botón "Guardar sesión" → UPDATE `planificaciones` con `is_saved: true`, `saved_at`, `nombre`

4. **`MisPlanificaciones.tsx`** - Dashboard
   - **Data Read**: SELECT de `planificaciones` WHERE `is_saved = true AND deleted_at IS NULL`
   - Filtros: materia, grupo, rango fechas
   - Cards: Balance de competencias, Competencias pendientes, Lista de planificaciones
   - **Data Written**: UPDATE `deleted_at` para soft delete

**Data Flow**:
- `planificaciones` → `sesiones_clase` (1:N)
- `sesiones_clase.competencias_anep` → usado para calcular balance

### Workflow 2: Generar Evaluación

**Entry**: Sidebar → "Evaluaciones Grupales" → `/evaluaciones`

**Screens**:
1. **`EvaluacionesChoice.tsx`** - Pantalla de elección
   - Opción 1: "Generar Evaluación" → `/evaluaciones/nuevo`
   - Opción 2: "Mis Evaluaciones" → `/mis-evaluaciones`

2. **`EvaluacionesGrupo.tsx`** - Workspace de generación
   - Selección de grupo (`selectedGroupId` → busca en `mockGroups`)
   - Selección de materia (o interdisciplinaria)
   - Selección de competencias específicas
   - Selección de contenidos (subtemas)
   - Criterios de logro
   - Requerimientos especiales
   - **Action**: "Generar Evaluaciones Inteligentes"
     - Invoca edge function `modify-evaluation` múltiples veces
     - Genera 3 versiones adaptadas
   - **Action**: "Guardar evaluación" → INSERT en `evaluaciones` con `is_saved: true`

3. **`MisEvaluaciones.tsx`** - Dashboard
   - **Data Read**: SELECT de `evaluaciones` WHERE `is_saved = true AND deleted_at IS NULL`
   - Filtros: materia, grupo, rango fechas
   - Cards: Balance de competencias, Competencias pendientes, Lista de evaluaciones
   - **Data Written**: UPDATE `deleted_at` para soft delete

**Data Flow**:
- `evaluaciones.competencias_anep` → usado para calcular balance
- `evaluaciones.fecha` → usado para filtrado por rango

### Workflow 3: Gestión de Grupos

**Entry**: `/teacher-groups`

**Screen**: `TeacherGroups.tsx`
- Lista de grupos (de `mockData.ts`)
- Perfiles de estudiantes
- Análisis grupal
- **Data**: Mayormente mock data, no persistido en DB

### Workflow 4: Comunicaciones

**Entry**: `/comunicaciones`

**Screen**: `Comunicaciones.tsx`
- Envío de comunicaciones a dirección/psicopedagogía
- **Data Written**: INSERT en `comunicaciones`
- **Storage**: Upload de archivos a bucket `comunicaciones`

---

## 8. Local Dev & Deployment

### Local Development

**Setup**:
```bash
npm install
npm run dev
```

**Server**: Vite dev server en puerto 8080 (configurado en `vite.config.ts`)

**Environment Variables**:
- `.env` file required (no `.env.example` visible, pero código espera):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

**Supabase Local**:
- Config en `supabase/config.toml`
- Project ID: `srlrbuphsogwgymqywhe`
- Migrations: Aplicar con `supabase db push` o manualmente

### Build

**Command**: `npm run build`
- Output: `dist/` folder
- Build tool: Vite
- TypeScript: Compilado a JavaScript

### Deployment

**Target**: No explícitamente configurado en código, pero:
- README menciona Lovable.dev como plataforma
- Vite build sugiere deployment estático (Vercel/Netlify)
- Supabase: Hosted en cloud (no local)

**Build Output**: Static files (HTML, JS, CSS) → compatible con cualquier hosting estático

### Runtime Configuration

**Differences Dev vs Prod**:
- Dev: Component tagging habilitado (`componentTagger()`)
- Dev: Console logs de diagnóstico de Supabase
- Ambos: Mismo cliente Supabase, misma autenticación demo

---

## 9. Observed Risks / Unknowns

### Data Consistency Risks

1. **Array Field Normalization**
   - **Risk**: Supabase puede devolver `text[]` como `null`, `""`, string, o array
   - **Impact**: Crashes en `.forEach()` si no normalizado
   - **Mitigation**: `normalizeArrayField()` utility existe, pero debe usarse consistentemente

2. **Date Field Normalization**
   - **Risk**: `fecha` puede ser `null`, `""`, o string inválido
   - **Impact**: Crashes en `toLocaleDateString()` si no validado
   - **Mitigation**: Normalización en load time (implementado en `MisEvaluaciones`)

3. **JSONB Field Structure**
   - **Risk**: Campos JSONB pueden tener estructuras inesperadas
   - **Impact**: Type errors o crashes al acceder propiedades
   - **Mitigation**: Type assertions (`as any`) usados en varios lugares

### Type Safety Risks

1. **Supabase Type Generation**
   - **Unknown**: ¿Se generan tipos desde schema? (`src/integrations/supabase/types.ts` existe pero no revisado)
   - **Risk**: Desincronización entre DB y tipos TypeScript

2. **Mock Data vs Real Data**
   - **Risk**: `mockGroups` usa `Group.id: number`, pero `selectedGroupId` es `string`
   - **Impact**: Type mismatches (ej: `.includes()` en number)
   - **Status**: Bug conocido y parcialmente fixeado

### Authentication Risks

1. **Demo Mode**
   - **Risk**: Autenticación automática con credenciales hardcodeadas
   - **Impact**: No seguro para producción
   - **Unknown**: ¿Hay plan para autenticación real?

2. **Session Persistence**
   - **Risk**: `localStorage` para user object puede desincronizarse con Supabase session
   - **Impact**: Estado inconsistente

### Performance Risks

1. **Large JSONB Fields**
   - **Risk**: `evaluacion_generada` puede ser muy grande
   - **Impact**: Queries lentas, payload grande

2. **Array Operations**
   - **Risk**: Operaciones en arrays grandes sin paginación
   - **Impact**: Render lento, memoria alta

### Architecture Risks

1. **No Service Layer**
   - **Risk**: Lógica de negocio mezclada con componentes
   - **Impact**: Difícil testear, código duplicado

2. **Direct Supabase Calls**
   - **Risk**: Queries dispersas en múltiples componentes
   - **Impact**: Difícil mantener consistencia, cambios de schema afectan muchos lugares

---

## 10. Bug Reconnaissance: Involved Files + Hypotheses

### BUG A: MisEvaluaciones White Screen

**Status**: ✅ FIXED (commit 5a0a98b)

**Files Involved**:
- `src/pages/MisEvaluaciones.tsx` (907 líneas)
  - Componente principal del dashboard
  - **State**: `evaluaciones[]`, `filtroMateria`, `filtroGrupo`, `fechaRange`
  - **Data Objects**: `Evaluacion` interface
  - **Key useMemo hooks**:
    - `evaluacionesFiltradas` (línea 210) - Filtra por competencias, fecha, materia, grupo
    - `competenciasCount` (línea 272) - Calcula conteo de competencias
    - `competenciasPendientes` (línea 325) - Calcula competencias no usadas

**Root Cause (Fixed)**:
- `competencias_anep` no normalizado → `.forEach()` crashea
- `fecha` inválida (empty string) → date formatting crashea
- **Fix**: Normalización en load time + guards defensivos

**Remaining Risks**:
- Si normalización falla, guards deberían prevenir crash
- Recharts puede crashear con datos inválidos (NaN, undefined)

### BUG B: Evaluation Save Crash (selectedGroup.id.includes)

**Status**: ✅ FIXED (commit f9c83ff)

**Files Involved**:
- `src/pages/EvaluacionesGrupo.tsx` (1595 líneas)
  - Workspace de generación de evaluaciones
  - **State**: `selectedGroupId` (string), `selectedGroup` (Group | undefined)
  - **Data Objects**: 
    - `Group` interface de `mockData.ts` (línea 48-55)
    - `Group.id: number` ← **TYPE MISMATCH**
  - **Key Function**: `handleSaveEvaluation()` (línea 347)
    - **Buggy Line** (antes del fix): `nivel: selectedGroup?.id.includes('9') ? '9no' : '8vo'`
    - **Fixed**: Usa `getNivelFromGroup()` que deriva de `selectedGroup.year` (string)

**Root Cause (Fixed)**:
- `selectedGroup.id` es `number` (ej: `9`)
- Código intentaba llamar `.includes()` en number → TypeError
- **Fix**: Usa `selectedGroup.year` (string) para derivar nivel

**Related Files**:
- `src/data/mockData.ts` (línea 48-55) - Define `Group.id: number`
- `src/pages/EvaluacionesGrupo.tsx` (línea 341-344) - `selectedGroup` useMemo
- `src/pages/EvaluacionesGrupo.tsx` (línea 378-397) - `getNivelFromGroup()` helper

**Remaining Risks**:
- Si `selectedGroup.year` es undefined o formato inesperado, fallback a "8vo"
- Si `selectedGroup` es undefined, también fallback a "8vo"

### Potential Future Bugs

**Hot Paths Identified**:

1. **`MisPlanificaciones.tsx`** - Similar a `MisEvaluaciones`
   - **Risk**: Mismo patrón de normalización requerido
   - **Files**: `src/pages/MisPlanificaciones.tsx`
   - **Data**: `sesiones_clase.competencias_anep` requiere normalización

2. **Date Parsing en Filtros**
   - **Risk**: `fechaRange.from/to` pueden ser undefined
   - **Files**: Ambos dashboards usan `DateRangePicker`
   - **Mitigation**: Ya protegido con try-catch en algunos lugares

3. **Recharts Data Validation**
   - **Risk**: `competenciasCount` puede tener `count: NaN` o `undefined`
   - **Files**: `MisEvaluaciones.tsx`, `MisPlanificaciones.tsx`
   - **Mitigation**: Validar antes de pasar a chart

---

## Next Actions for Bug Fixing

### Immediate Priorities

1. **Verify Fixes Applied**
   - ✅ BUG B: `selectedGroup.id.includes` → Fixed (commit f9c83ff)
   - ✅ BUG A: White screen → Fixed (commit 5a0a98b)
   - **Action**: Test both fixes in runtime

2. **Files to Monitor for Similar Issues**

   **Normalization Consistency**:
   - `src/pages/MisPlanificaciones.tsx` (línea ~159) - Verificar normalización de `sesiones_clase.competencias_anep`
   - Cualquier componente que cargue datos de Supabase con arrays

   **Type Safety**:
   - `src/data/mockData.ts` - Verificar consistencia de tipos (Group.id vs selectedGroupId)
   - Cualquier uso de `mockGroups` → verificar que tipos coincidan

   **Date Handling**:
   - Todos los componentes que usan `DateRangePicker`
   - Todos los lugares que formatean fechas con `toLocaleDateString()`

3. **Testing Checklist**

   **BUG A (White Screen)**:
   - [ ] Navegar a `/mis-evaluaciones` → no white screen
   - [ ] Evaluación con `fecha: null` → no crash
   - [ ] Evaluación con `competencias_anep: null` → normaliza a `[]`
   - [ ] Filtros funcionan correctamente
   - [ ] Gráfico renderiza sin errores

   **BUG B (Save Crash)**:
   - [ ] Generar evaluación → click "Guardar evaluación" → no crash
   - [ ] Verificar `nivel` guardado correctamente en DB
   - [ ] Probar con diferentes grupos (9no, 8vo si existe)

4. **Code Quality Improvements** (Future)

   - **Service Layer**: Extraer lógica de Supabase a servicios
   - **Type Generation**: Generar tipos desde Supabase schema automáticamente
   - **Error Boundaries**: Agregar error boundaries permanentes (no solo diagnóstico)
   - **Normalization Utility**: Crear hook `useNormalizedSupabaseData()` para reutilizar normalización

### File Paths Reference

**Bug-Related Files**:
- `src/pages/EvaluacionesGrupo.tsx` - Save evaluation crash (FIXED)
- `src/pages/MisEvaluaciones.tsx` - White screen crash (FIXED)
- `src/data/mockData.ts` - Group interface definition
- `src/lib/normalizeSupabaseArrays.ts` - Normalization utility
- `src/integrations/supabase/client.ts` - Supabase client config

**Related Files to Review**:
- `src/pages/MisPlanificaciones.tsx` - Similar patterns, verificar normalización
- `src/pages/PlanificacionWorkspace.tsx` - Guardado de planificaciones
- `src/components/ui/date-range-picker.tsx` - Date picker component

**Documentation**:
- `refactor/fix_bug_a_misEvaluaciones_white_screen.md` - Fix documentation
- `refactor/fix_bug_b_save_selectedGroup_includes.md` - Fix documentation
- `refactor/evaluaciones_diagnostic_round2.md` - Diagnostic report

---

**Report Generated**: 2025-12-23  
**Status**: ✅ Complete  
**Next**: Runtime testing of fixes

















