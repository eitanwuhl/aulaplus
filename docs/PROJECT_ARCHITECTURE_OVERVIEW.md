# AulaPlus v0 - Arquitectura del Proyecto

> **Documento de referencia para ingenieros nuevos**  
> Última actualización: Enero 2026  
> Estado: Activo

---

## A) Resumen Ejecutivo

### ¿Qué es AulaPlus?

**AulaPlus** es una plataforma de planificación pedagógica y evaluación asistida por IA para docentes de ANEP (Administración Nacional de Educación Pública de Uruguay). El sistema genera automáticamente planes de clase y evaluaciones utilizando OpenAI GPT-4o-mini, adaptados al contexto del grupo, competencias ANEP, y contemplaciones (acomodaciones) de estudiantes.

El producto es una Single Page Application (SPA) React con backend Supabase (PostgreSQL + Auth + Edge Functions) que permite a los docentes:

1. **Planificar clases**: Crear planificaciones de períodos completos con múltiples sesiones, generadas automáticamente por IA
2. **Generar evaluaciones**: Crear evaluaciones adaptadas con múltiples versiones (estándar, moderada, altamente adaptada)
3. **Gestionar materiales**: Subir y adjuntar materiales pedagógicos (PDFs, imágenes) a sesiones y evaluaciones
4. **Aplicar contemplaciones**: Sistema determinístico de acomodaciones para estudiantes con necesidades especiales

### Roles de Usuario

- **Docente (Teacher)**: Usuario principal. Crea planificaciones, genera evaluaciones, gestiona grupos y materiales
- **Estudiante (Student)**: Rol limitado, principalmente para diagnósticos (funcionalidad básica)

**Nota**: El sistema actualmente opera en modo demo. La autenticación acepta cualquier credencial y todos los usuarios comparten el mismo usuario Supabase en background.

### Flujos Principales

1. **Planificación de Clases**:
   - Docente crea planificación mediante wizard (grupo, materia, fechas, unidades didácticas)
   - Sistema genera automáticamente sesiones de clase con planes completos usando IA
   - Docente puede editar, guardar explícitamente, o eliminar (soft delete)

2. **Generación de Evaluaciones**:
   - Docente selecciona grupo, materia, contenidos (ANEP o sesiones previas)
   - Sistema genera 3 versiones adaptadas (estándar, moderada, alta adaptación)
   - Docente puede modificar vía chat, adjuntar materiales, guardar

3. **Gestión de Materiales**:
   - Docente sube materiales (PDFs, imágenes) a biblioteca personal
   - Materiales pueden adjuntarse a sesiones o evaluaciones
   - PDFs se procesan para extraer texto (OCR) para contexto en generación IA

---

## B) Stack Tecnológico y Herramientas

### Frontend

- **Framework**: React 18.3.1 (SPA)
- **Build Tool**: Vite 5.4.1 (dev server en `localhost:8080`)
- **Lenguaje**: TypeScript 5.5.3
- **Routing**: React Router DOM 6.26.2
- **State Management**: 
  - React Context API (`AuthContext`)
  - TanStack Query (React Query) 5.56.2 para cache de datos
- **UI Libraries**:
  - shadcn/ui (componentes basados en Radix UI)
  - Tailwind CSS 3.4.11 para estilos
  - Framer Motion 12.19.1 para animaciones
  - Lucide React para iconos
- **Formularios**: React Hook Form 7.53.0 + Zod 3.23.8 para validación
- **Editor Rich Text**: React Quill 0.0.2
- **PDF/Export**: jsPDF 3.0.1 + html2canvas 1.4.1
- **Gráficos**: Recharts 2.12.7

### Backend

- **Runtime**: Deno (Edge Functions de Supabase)
- **API Style**: Edge Functions (serverless, invocadas vía HTTP)
- **Autenticación**: Supabase Auth (JWT-based)
- **Base de Datos**: PostgreSQL (Supabase Cloud)
- **Storage**: Supabase Storage (buckets para materiales docentes)
- **Background Jobs**: No hay. Todo es síncrono.

### Base de Datos y Almacenamiento

- **Motor**: PostgreSQL (Supabase)
- **Migrations**: Archivos SQL en `supabase/migrations/` (34 migraciones)
- **Schema Management**: Migraciones versionadas por timestamp
- **Storage Buckets**: `teacher-materials` (materiales pedagógicos)
- **Caching**: No hay cache externo. React Query cachea queries en frontend.

### Infraestructura y DevOps

- **Hosting Frontend**: Lovable.dev (deployment automático)
- **Hosting Backend**: Supabase Cloud (PostgreSQL + Edge Functions + Auth + Storage)
- **CI/CD**: No configurado explícitamente (Lovable maneja deployments)
- **Gestión de Entornos**: Variables de entorno en `.env` (root)
- **Secrets**: 
  - `OPENAI_API_KEY` en Supabase Dashboard (Edge Functions)
  - `SERVICE_ROLE_KEY` en Supabase Dashboard (admin)
  - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env` local

### Integraciones de Terceros

- **Supabase**: Backend completo (DB, Auth, Storage, Edge Functions)
- **OpenAI**: GPT-4o-mini y GPT-4.1-2025-04-14 para generación de contenido
- **Lovable**: Plataforma de desarrollo/deployment (opcional)

---

## C) Arquitectura de Alto Nivel

### Diagrama de Arquitectura (Texto)

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Pages      │  │  Components  │  │    Hooks    │        │
│  │  (Routing)   │  │   (UI/Logic) │  │  (Business) │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                            │                                 │
│                    ┌────────▼────────┐                        │
│                    │  Supabase Client │                       │
│                    │  (REST API)      │                       │
│                    └────────┬────────┘                        │
└────────────────────────────┼─────────────────────────────────┘
                              │
                    ┌──────────▼──────────┐
                    │   SUPABASE CLOUD    │
                    │                     │
    ┌───────────────┼───────────────┐    │
    │               │               │    │
┌───▼────┐   ┌──────▼──────┐  ┌─────▼────┐
│PostgreSQL│  │Edge Functions│ │  Storage │
│          │  │  (Deno)      │  │ (Buckets)│
│  - Tables│  │              │  │          │
│  - RLS   │  │- generate-   │  │- teacher-│
│  - Migr. │  │  plan-       │  │  materials│
│          │  │  completo    │  │          │
│          │  │- modify-     │  │          │
│          │  │  evaluation  │  │          │
│          │  │- generate-   │  │          │
│          │  │  bulletin-   │  │          │
│          │  │  text        │  │          │
│          │  │- extract-    │  │          │
│          │  │  material-   │  │          │
│          │  │  text        │  │          │
└──────────┘  └──────────────┘  └──────────┘
                    │
                    │ HTTP
                    │
            ┌───────▼────────┐
            │   OpenAI API   │
            │  (GPT Models)  │
            └────────────────┘
```

### Capas y Contextos Acotados

1. **Capa de Presentación (UI)**
   - **Responsabilidad**: Renderizado, interacción de usuario, navegación
   - **Componentes**: `src/pages/`, `src/components/`
   - **Entry Point**: `src/main.tsx` → `src/App.tsx`

2. **Capa de Lógica de Negocio (Hooks/Services)**
   - **Responsabilidad**: Orquestación de flujos, validación, transformación de datos
   - **Componentes**: `src/hooks/`, `src/services/`, `src/lib/`
   - **Ejemplos**: `useFullSessionGeneration.ts`, `usePlanificacionWizard.ts`

3. **Capa de Datos (Integración)**
   - **Responsabilidad**: Comunicación con Supabase, normalización de datos
   - **Componentes**: `src/integrations/supabase/`, `src/services/groupContext/provider.ts`
   - **Cliente**: `src/integrations/supabase/client.ts`
   - **Nota**: `src/utils/groupContext.ts` está deprecado; usar `src/services/groupContext/provider.ts` para generación IA

4. **Capa de Servicios Externos (Edge Functions)**
   - **Responsabilidad**: Generación IA, procesamiento de materiales
   - **Componentes**: `supabase/functions/*`
   - **Runtime**: Deno (serverless)

5. **Capa de Persistencia (Base de Datos)**
   - **Responsabilidad**: Almacenamiento estructurado, RLS, integridad referencial
   - **Componentes**: `supabase/migrations/*`, PostgreSQL

### Responsabilidades por Módulo

| Módulo | Responsabilidad | Ubicación |
|--------|----------------|-----------|
| **Pages** | Orquestación de rutas, coordinación de componentes | `src/pages/` |
| **Components** | UI reutilizable, componentes de dominio | `src/components/` |
| **Hooks** | Lógica de negocio reutilizable, estado complejo | `src/hooks/` |
| **Services** | Servicios especializados (evaluations, materials, groupContext) | `src/services/` |
| **Lib** | Utilidades puras, parsers, catálogos | `src/lib/` |
| **Contexts** | Estado global (Auth) | `src/contexts/` |
| **Edge Functions** | Generación IA, procesamiento serverless | `supabase/functions/` |
| **Migrations** | Schema, RLS, constraints | `supabase/migrations/` |

---

## D) Mapa del Código Fuente (Guía del Repositorio)

### Estructura de Directorios Principales

```
aulaplus-v0/
├── src/                          # Código fuente frontend
│   ├── main.tsx                  # Entry point React
│   ├── App.tsx                   # Routing y providers
│   ├── pages/                    # Páginas/componentes de ruta (14 archivos)
│   ├── components/               # Componentes UI y de dominio
│   │   ├── ui/                   # shadcn/ui primitives (63 archivos)
│   │   ├── planificacion/        # Componentes de planificación (18 archivos)
│   │   ├── evaluaciones/         # Componentes de evaluación (18 archivos)
│   │   └── materials/            # Componentes de materiales (4 archivos)
│   ├── hooks/                    # Custom hooks (9 archivos)
│   ├── lib/                      # Utilidades y parsers
│   │   └── contemplaciones/      # Sistema de contemplaciones (8 archivos, incluye __tests__)
│   ├── services/                 # Servicios especializados
│   │   ├── evaluations/          # Servicios de evaluación (2 archivos)
│   │   ├── materials/            # Servicios de materiales (4 archivos)
│   │   └── groupContext/         # Contexto de grupo unificado (1 archivo: provider.ts)
│   ├── contexts/                 # React contexts
│   │   └── AuthContext.tsx       # Autenticación
│   ├── integrations/             # Integraciones externas
│   │   └── supabase/             # Cliente Supabase
│   │       ├── client.ts         # Cliente configurado
│   │       └── types.ts          # Tipos TypeScript generados
│   ├── data/                     # Datos estáticos
│   │   ├── mockData.ts           # Grupos y estudiantes mock
│   │   ├── competencias.ts       # Catálogo competencias ANEP
│   │   └── catalogo.ts           # Catálogo de contenidos
│   ├── types/                    # Definiciones TypeScript (4 archivos)
│   └── utils/                    # Utilidades compartidas (5 archivos)
│
├── supabase/                     # Backend Supabase
│   ├── functions/                # Edge Functions (5 funciones)
│   │   ├── generate-plan-completo/    # Generación de planes
│   │   ├── modify-evaluation/         # Generación/modificación de evaluaciones
│   │   ├── generate-bulletin-text/    # Generación de textos de boletín
│   │   ├── extract-material-text/     # Extracción de texto de PDFs
│   │   └── ensure-demo-users/         # Setup de usuarios demo
│   ├── migrations/               # Migraciones SQL (34 archivos)
│   └── config.toml               # Configuración del proyecto
│
├── docs/                         # Documentación (165 archivos .md)
│   └── ARCHITECTURE_SSoT.md      # Single Source of Truth (referencia principal)
│
├── public/                       # Assets estáticos
├── dist/                         # Build output (generado)
└── package.json                  # Dependencias y scripts
```

### Archivos Clave por Carpeta

#### `src/pages/` (Páginas/Componentes de Ruta)

- **`PlanificacionWizard.tsx`**: Wizard de creación de planificaciones (flujo principal)
- **`PlanificacionWorkspace.tsx`**: Workspace de edición de planificación existente
- **`PlanificacionClase.tsx`**: Vista de planificación de clase individual
- **`MisPlanificaciones.tsx`**: Lista de planificaciones guardadas
- **`EvaluacionesGrupo.tsx`**: Generación de evaluaciones (flujo principal)
- **`EvaluacionDetalle.tsx`**: Vista detallada de evaluación
- **`MisEvaluaciones.tsx`**: Lista de evaluaciones guardadas
- **`BibliotecaMateriales.tsx`**: Gestión de biblioteca de materiales
- **`TeacherGroups.tsx`**: Gestión de grupos
- **`Comunicaciones.tsx`**: Comunicaciones (funcionalidad básica)
- **`StudentDiagnostic.tsx`**: Diagnóstico estudiantil (rol estudiante)

#### `src/components/` (Componentes UI y Dominio)

- **`planificacion/`**: Componentes específicos de planificación (wizard steps, calendario, etc.)
- **`evaluaciones/`**: Componentes de evaluación (generador, versión adaptada, etc.)
- **`materials/`**: Componentes de materiales (upload, attach, library)
- **`ui/`**: Componentes primitivos shadcn/ui (Button, Card, Dialog, etc.)

#### `src/hooks/` (Lógica de Negocio)

- **`useFullSessionGeneration.ts`**: Orquestación de generación de todas las sesiones
- **`usePlanificacionWizard.ts`**: Estado y validación del wizard de planificación
- **`useCalendarioSesiones.ts`**: Gestión de estado de sesiones (backlog, planificada, dictada, etc.)

#### `src/lib/` (Utilidades Puras)

- **`planParser.ts`**: **CRÍTICO** - Parser de HTML de planes (backward compatibility crítica)
- **`contemplaciones/`**: Sistema de contemplaciones (catálogo, enforcement, storage)
  - **`catalog.ts`**: Catálogo canónico de contemplaciones (1-26)
  - **`enforcement.ts`**: Aplicación determinística de contemplaciones
  - **`storage.ts`**: Persistencia en localStorage

#### `src/services/` (Servicios Especializados)

- **`evaluations/`**: Construcción de contexto de generación de evaluaciones
- **`materials/`**: Gestión de materiales (upload, attach, extract)
- **`groupContext/`**: Carga de contexto de grupo para IA (unificado)

#### `supabase/functions/` (Edge Functions)

- **`generate-plan-completo/index.ts`**: Genera plan HTML completo usando GPT-4o-mini
- **`modify-evaluation/index.ts`**: Genera/modifica evaluaciones usando GPT-4.1-2025-04-14
- **`generate-bulletin-text/index.ts`**: Genera textos de boletín
- **`extract-material-text/index.ts`**: Extrae texto de PDFs (OCR)
- **`ensure-demo-users/index.ts`**: Crea usuarios demo en Supabase Auth

#### `supabase/migrations/` (Schema y Migraciones)

- **`20250923163758_*.sql`**: Schema inicial (planificaciones, sesiones_clase)
- **`20250930180042_*.sql`**: Enum `sesion_estado` (backlog, planificada, dictada, omitida, pausada)
- **`20251219163000_*.sql`**: Patrón de guardado explícito (`is_saved`, `saved_at`) y soft delete
- **`20251222000000_*.sql`**: Guardado explícito para evaluaciones
- **`20260127000000_*.sql`**: Schema de materiales docentes
- **`20260128000000_*.sql`**: Fuentes de evaluación (sesiones, materiales, focus)

---

## E) Flujos de Ejecución (Rutas Críticas)

### Flujo 1: Creación de Planificación y Generación de Sesiones

**Trigger**: Usuario navega a `/planificacion/nuevo` y completa wizard

**Secuencia**:

1. **Wizard Steps** (`PlanificacionWizard.tsx`):
   ```
   Paso 0: Contexto (grupo, materia, tipo, fechas)
   Paso 1: Horario (horas semanales, configuración)
   Paso 2: Contenido (unidades didácticas, competencias)
   Paso 3: Enfoque (modalidades, diferenciación, session briefs)
   ```

2. **Creación de Planificación**:
   - `usePlanificacionWizard` valida datos
   - Inserta `planificaciones` en DB (con `is_saved = false`)
   - Genera fechas de sesiones según horario

3. **Generación de Sesiones** (`useFullSessionGeneration.ts`):
   - Expande unidades según `clases_estimadas`
   - Mapea sesiones a unidades (determinístico)
   - Para cada sesión:
     - Calcula duración real según horario
     - Carga contexto de grupo (`getGroupContextForAI` de `src/services/groupContext/provider.ts`)
     - Invoca `generate-plan-completo` edge function
     - Parsea HTML respuesta (`planParser.ts`)
     - Aplica contemplaciones (`enforceForLessonPlan`)
     - Inserta `sesiones_clase` en DB

4. **Guardado Explícito**:
   - Usuario hace click en "Guardar planificación"
   - Actualiza `planificaciones` con `is_saved = true`, `saved_at = now()`
   - Planificación aparece en "Mis Planificaciones"

**Puntos de Lectura/Escritura**:
- **Lectura**: `grupos` (teacher_sugerencias), `mockData.ts` (estudiantes), competencias ANEP
- **Escritura**: `planificaciones`, `sesiones_clase`

**Manejo de Errores**:
- Validación en cada paso del wizard
- Retry con exponential backoff en edge function (3 intentos)
- Toast notifications para errores
- Fallback a contenido genérico si generación falla

---

### Flujo 2: Generación de Evaluación

**Trigger**: Usuario navega a `/evaluaciones/nuevo` y hace click en "Generar evaluación"

**Secuencia**:

1. **Configuración de Evaluación** (`EvaluacionesGrupo.tsx`):
   - Usuario selecciona: grupo, materia, contenidos (ANEP o sesiones), materiales
   - Opcional: `evaluation_focus` (texto de enfoque)
   - Opcional: `requerimientos` (instrucciones adicionales)

2. **Construcción de Contexto** (`buildEvaluationGenerationContext`):
   - Si hay sesiones seleccionadas:
     - Carga `sesiones_clase` de DB
     - Construye "session digests" (resúmenes estructurados)
   - Si hay materiales:
     - Carga `teacher_materials` de DB
     - Construye "material digests" (con `extracted_text` si disponible)
   - Combina con contenidos ANEP (backward compatibility)

3. **Clasificación de Estudiantes**:
   - Carga estudiantes desde `mockData.ts` (híbrido)
   - Clasifica en 3 versiones: estándar, moderada, alta adaptación
   - Limita a 10 estudiantes con ajustes (para evitar prompts enormes)

4. **Generación por Versión**:
   - Para cada versión (estándar, moderada, alta):
     - Invoca `modify-evaluation` edge function
     - Payload incluye: contexto de grupo, contenidos, materiales, contemplaciones
     - Recibe HTML de evaluación
     - Renderiza con `dangerouslySetInnerHTML`

5. **Modificación vía Chat**:
   - Usuario puede modificar evaluación mediante chat
   - Invoca `modify-evaluation` con `type: 'chat'`
   - Actualiza contenido en tiempo real

6. **Guardado Explícito**:
   - Usuario hace click en "Guardar evaluación"
   - Inserta `evaluaciones` con `is_saved = true`, `saved_at = now()`
   - Guarda `source_planificacion_id`, `source_session_ids`, `direct_material_ids`

**Puntos de Lectura/Escritura**:
- **Lectura**: `sesiones_clase`, `teacher_materials`, `grupos`, `mockData.ts`
- **Escritura**: `evaluaciones`

**Manejo de Errores**:
- Validación: debe haber al menos contenido ANEP, sesiones, o materiales
- Bloqueo si PDFs no tienen `extracted_text` (solo materiales, sin sesiones/ANEP)
- Toast notifications
- Fallback a contenido genérico

---

### Flujo 3: Subida y Adjunto de Materiales

**Trigger**: Usuario sube archivo en `BibliotecaMateriales.tsx` o `AttachMaterialsPanel.tsx`

**Secuencia**:

1. **Upload de Archivo**:
   - Usuario selecciona archivo (PDF, imagen)
   - Valida tipo MIME y tamaño
   - Sube a Supabase Storage bucket `teacher-materials`

2. **Inserción en DB**:
   - Inserta registro en `teacher_materials`:
     - `user_id` (RLS)
     - `file_path` (ruta en storage)
     - `mime_type`, `file_size`
     - `is_archived = false`

3. **Extracción de Texto** (si es PDF):
   - Invoca `extract-material-text` edge function
   - Edge function usa OCR (tesseract o similar) para extraer texto
   - Actualiza `teacher_materials.extracted_text`

4. **Adjunto a Sesión/Evaluación**:
   - Usuario selecciona materiales en `AttachMaterialsPanel`
   - Guarda relación:
     - Para sesiones: `sesiones_clase.material_ids` (array)
     - Para evaluaciones: `evaluaciones.direct_material_ids` (array)

**Puntos de Lectura/Escritura**:
- **Lectura**: `teacher_materials` (con RLS)
- **Escritura**: Supabase Storage, `teacher_materials`, `sesiones_clase.material_ids`, `evaluaciones.direct_material_ids`

**Manejo de Errores**:
- Validación de tipo y tamaño en frontend
- Error si storage falla
- Error si OCR falla (pero material se guarda sin `extracted_text`)

---

### Flujo 4: Autenticación (Demo)

**Trigger**: Usuario hace login en `/teacher-login` o `/student-login`

**Secuencia**:

1. **Login Frontend** (`AuthContext.tsx`):
   - Usuario ingresa cualquier credencial (demo)
   - `login()` valida que no estén vacías
   - Crea usuario mock en memoria
   - Guarda en `localStorage`

2. **Autenticación Supabase (Background)**:
   - `ensureSupabaseAuth()` se ejecuta automáticamente
   - Invoca `ensure-demo-users` edge function (crea usuario si no existe)
   - Hace `signInWithPassword` con credenciales demo fijas:
     - Email: `demo.teacher@example.com`
     - Password: `DemoPassword2024!`

3. **Creación de Perfil**:
   - `onAuthStateChange` listener detecta sesión
   - Hace upsert en `profiles` (idempotente, maneja conflictos 409)
   - `display_name: 'Profesor Demo'`, `role: 'teacher'`

4. **Persistencia**:
   - Sesión Supabase se guarda en `localStorage`
   - Usuario mock se guarda en `localStorage` (key: `auth_user`)

**Puntos de Lectura/Escritura**:
- **Lectura**: `localStorage` (auth_user, sesión Supabase)
- **Escritura**: `profiles` (upsert), `auth.users` (Supabase Auth)

**Manejo de Errores**:
- Errores 409 (conflicto) se tratan como éxito (perfil ya existe)
- Otros errores se loguean pero no bloquean (demo mode)

---

## F) Modelo de Datos - Resumen

### Entidades Principales

#### 1. **planificaciones** (Planificaciones de Período)

**Propósito**: Representa una planificación completa de un período (ej: "Historia 9no 1 - Marzo 2026")

**Campos Clave**:
- `id` (UUID, PK)
- `user_id` (UUID, FK a `auth.users`, RLS)
- `grupo_id` (UUID, referencia a grupo)
- `materia` (TEXT)
- `nivel` (TEXT)
- `fecha_inicio`, `fecha_fin` (DATE)
- `horas_semanales` (INTEGER)
- `configuracion_horario` (JSONB): Array de días/horas
- `unidades_didacticas` (JSONB): Array de unidades con contenidos y competencias
- `is_saved` (BOOLEAN): Solo `true` aparece en "Mis Planificaciones"
- `saved_at` (TIMESTAMPTZ): Timestamp de guardado explícito
- `deleted_at` (TIMESTAMPTZ): Soft delete
- `unit_material_plan` (JSONB): Plan de materiales por unidad
- `ai_design_report` (JSONB): Evidencia de diseño IA

**Relaciones**:
- `sesiones_clase.planificacion_id` → `planificaciones.id` (FK, CASCADE DELETE)

#### 2. **sesiones_clase** (Sesiones de Clase Individuales)

**Propósito**: Representa una sesión individual dentro de una planificación

**Campos Clave**:
- `id` (UUID, PK)
- `planificacion_id` (UUID, FK a `planificaciones`, CASCADE DELETE)
- `orden` (INTEGER): Orden en la secuencia
- `fecha` (DATE, nullable): Fecha asignada (null = backlog)
- `duracion_minutos` (INTEGER)
- `estado` (ENUM): `'backlog'`, `'planificada'`, `'dictada'`, `'omitida'`, `'pausada'`
- `competencias_anep` (TEXT[]): IDs de competencias
- `contenidos_anep` (TEXT[]): Contenidos ANEP
- `plan_desarrollo` (JSONB): Plan estructurado (inicio, desarrollo, cierre, recursos)
- `diferenciacion` (TEXT): Sección de diferenciación/adaptaciones
- `recursos` (TEXT[]): Recursos normalizados
- `session_brief` (TEXT): Enfoque específico de sesión (teacher override)
- `material_ids` (UUID[]): Materiales adjuntos
- `ai_design_report` (JSONB): Evidencia de diseño IA

**Relaciones**:
- Pertenece a `planificaciones` (FK)

#### 3. **evaluaciones** (Evaluaciones)

**Propósito**: Representa una evaluación generada (con múltiples versiones posibles)

**Campos Clave**:
- `id` (UUID, PK)
- `user_id` (UUID, FK a `auth.users`, RLS)
- `grupo_id` (UUID)
- `materia` (TEXT)
- `contenido` (TEXT): Contenido HTML de evaluación
- `is_saved` (BOOLEAN): Solo `true` aparece en "Mis Evaluaciones"
- `saved_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ)
- `source_planificacion_id` (UUID, FK): Planificación origen (si aplica)
- `source_session_ids` (UUID[]): Sesiones seleccionadas para evaluar
- `evaluation_focus` (TEXT): Enfoque específico del docente
- `direct_material_ids` (UUID[]): Materiales adjuntos directamente
- `include_session_materials` (BOOLEAN): Incluir materiales de sesiones
- `ai_design_report` (JSONB): Evidencia de diseño IA

**Relaciones**:
- Pertenece a usuario (RLS)
- Opcionalmente referencia `planificaciones`

#### 4. **teacher_materials** (Materiales Pedagógicos)

**Propósito**: Materiales subidos por docentes (PDFs, imágenes)

**Campos Clave**:
- `id` (UUID, PK)
- `user_id` (UUID, FK a `auth.users`, RLS)
- `file_path` (TEXT): Ruta en Supabase Storage
- `title` (TEXT)
- `mime_type` (TEXT)
- `file_size` (BIGINT)
- `extracted_text` (TEXT): Texto extraído de PDF (OCR)
- `is_archived` (BOOLEAN): Soft delete
- `archived_at` (TIMESTAMPTZ)

**Relaciones**:
- Pertenece a usuario (RLS)
- Referenciado por `sesiones_clase.material_ids` y `evaluaciones.direct_material_ids` (arrays)

#### 5. **grupos** (Grupos/Clases)

**Propósito**: Perfil de grupo y sugerencias del docente

**Campos Clave**:
- `id` (UUID, PK)
- `user_id` (UUID, FK a `auth.users`, RLS)
- `nombre` (TEXT)
- `teacher_sugerencias` (JSONB): Sugerencias del docente sobre el grupo

**Relaciones**:
- Pertenece a usuario (RLS)
- Referenciado por `planificaciones.grupo_id` y `evaluaciones.grupo_id`

#### 6. **profiles** (Perfiles de Usuario)

**Propósito**: Información adicional de usuarios (además de `auth.users`)

**Campos Clave**:
- `user_id` (UUID, PK, FK a `auth.users`)
- `display_name` (TEXT)
- `role` (TEXT): `'teacher'` o `'student'`

**Relaciones**:
- 1:1 con `auth.users`

### Relaciones Principales

```
auth.users (Supabase Auth)
  └── profiles (1:1)
  └── planificaciones (1:N, RLS)
  └── evaluaciones (1:N, RLS)
  └── teacher_materials (1:N, RLS)
  └── grupos (1:N, RLS)

planificaciones
  └── sesiones_clase (1:N, FK CASCADE DELETE)
  └── grupos (N:1, FK)

sesiones_clase
  └── planificaciones (N:1, FK)
  └── teacher_materials (N:M, via material_ids array)

evaluaciones
  └── planificaciones (N:1, FK opcional, source_planificacion_id)
  └── sesiones_clase (N:M, via source_session_ids array)
  └── teacher_materials (N:M, via direct_material_ids array)
  └── grupos (N:1, FK)
```

### Constraints y Reglas de Negocio

1. **Row Level Security (RLS)**:
   - Todas las tablas tienen RLS habilitado
   - Política base: `auth.uid() = user_id`
   - `sesiones_clase` se protege vía parent: `EXISTS (SELECT 1 FROM planificaciones WHERE id = planificacion_id AND user_id = auth.uid())`

2. **Soft Delete**:
   - `planificaciones.deleted_at`, `evaluaciones.deleted_at`, `teacher_materials.is_archived`
   - Filtrado en aplicación: `WHERE deleted_at IS NULL` o `WHERE is_archived = false`

3. **Explicit Save Pattern**:
   - `is_saved = true AND saved_at IS NOT NULL` → aparece en listas "Mis X"
   - `is_saved = false` → borrador, oculto de listas
   - Aplicado a: `planificaciones`, `evaluaciones`

4. **Foreign Keys**:
   - `sesiones_clase.planificacion_id` → `planificaciones.id` (CASCADE DELETE)
   - `evaluaciones.source_planificacion_id` → `planificaciones.id` (SET NULL)

5. **Enums**:
   - `sesion_estado`: `'backlog'`, `'planificada'`, `'dictada'`, `'omitida'`, `'pausada'`

### Ubicación del Schema

- **Migraciones**: `supabase/migrations/*.sql` (34 archivos, ordenados por timestamp)
- **Tipos TypeScript**: `src/integrations/supabase/types.ts` (generado con `supabase gen types typescript`)
- **Validación**: Constraints en SQL, validación adicional en aplicación

---

## G) Seguridad y Permisos

### Mecanismo de Autenticación

**Modo Actual**: Demo (no production-ready)

- **Frontend**: Cualquier credencial es aceptada (validación: no vacías)
- **Backend**: Todos los usuarios comparten el mismo usuario Supabase:
  - Email: `demo.teacher@example.com`
  - Password: `DemoPassword2024!`
- **Auto-login**: `AuthContext` hace login automático en background con credenciales demo
- **Persistencia**: Usuario mock en `localStorage`, sesión Supabase en `localStorage`

**Nota**: Para producción, se requiere implementar autenticación real con Supabase Auth (email/password, OAuth, etc.).

### Modelo de Autorización

**Roles**:
- `teacher`: Acceso completo (planificaciones, evaluaciones, materiales)
- `student`: Acceso limitado (solo diagnósticos básicos)

**Protección de Rutas**:
- `ProtectedTeacherRoute`: Wrapper que verifica `user.role === 'teacher'`
- `ProtectedStudentRoute`: Wrapper que verifica `user.role === 'student'`
- Implementado en `src/App.tsx`

### Row Level Security (RLS)

**Políticas Base** (aplicadas a todas las tablas de usuario):

```sql
-- SELECT: Usuarios solo ven sus propios registros
CREATE POLICY "Users can view their own X"
ON table_name FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Usuarios solo crean registros propios
CREATE POLICY "Users can create their own X"
ON table_name FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Usuarios solo actualizan sus propios registros
CREATE POLICY "Users can update their own X"
ON table_name FOR UPDATE
USING (auth.uid() = user_id);

-- DELETE: Usuarios solo eliminan sus propios registros
CREATE POLICY "Users can delete their own X"
ON table_name FOR DELETE
USING (auth.uid() = user_id);
```

**Políticas Especiales**:

- **`sesiones_clase`**: Protección vía parent (debe pertenecer a planificación del usuario)
  ```sql
  USING (EXISTS (
    SELECT 1 FROM planificaciones p 
    WHERE p.id = planificacion_id AND p.user_id = auth.uid()
  ))
  ```

**Ubicación de Políticas**: Definidas en migraciones SQL (`supabase/migrations/*.sql`)

### Operaciones Sensibles y Protección

1. **Generación IA** (Edge Functions):
   - **Protección Actual**: 
     - `generate-plan-completo`: `verify_jwt = false` (en `supabase/config.toml`)
     - `generate-bulletin-text`: `verify_jwt = false` (en `supabase/config.toml`)
     - `ensure-demo-users`: `verify_jwt = false` (en `supabase/functions/ensure-demo-users/config.toml`)
     - `modify-evaluation`, `extract-material-text`: Sin config explícita (usan default, probablemente `true`)
   - **Riesgo**: Funciones con `verify_jwt = false` pueden ser invocadas por cualquiera que conozca la URL
   - **Recomendación Producción**: Habilitar `verify_jwt = true` para todas las funciones y validar JWT

2. **Storage (Materiales)**:
   - **Protección**: RLS en `teacher_materials` + políticas de Storage bucket
   - **Bucket**: `teacher-materials` con políticas de acceso por usuario

3. **API Keys**:
   - `OPENAI_API_KEY`: Almacenado en Supabase Dashboard (Edge Functions env)
   - `SERVICE_ROLE_KEY`: Almacenado en Supabase Dashboard (no expuesto a frontend)
   - `VITE_SUPABASE_ANON_KEY`: Público (seguro para frontend, limitado por RLS)

---

## H) Desarrollo Local y Entornos

### Cómo Ejecutar Localmente

**Prerrequisitos**:
- Node.js 18+ (recomendado: usar nvm)
- npm o yarn
- Supabase CLI (opcional, para migraciones locales)

**Pasos**:

1. **Clonar repositorio**:
   ```bash
   git clone <repository-url>
   cd aulaplus-v0
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   Crear archivo `.env` en la raíz:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Iniciar servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   - Servidor se inicia en `http://localhost:8080`
   - Hot reload habilitado

5. **Abrir en navegador**:
   - Navegar a `http://localhost:8080`
   - Login con cualquier credencial (demo mode)

### Variables de Entorno Requeridas

| Variable | Requerida | Ubicación | Propósito |
|----------|-----------|-----------|-----------|
| `VITE_SUPABASE_URL` | ✅ | `.env` (root) | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | `.env` (root) | Clave anónima pública de Supabase |
| `OPENAI_API_KEY` | ✅ | Supabase Dashboard | API key de OpenAI (Edge Functions) |
| `SERVICE_ROLE_KEY` | ✅ | Supabase Dashboard | Clave de servicio (admin, no expuesta) |

**Nota**: No incluir secrets en `.env` en el repositorio. Usar `.env.local` o variables de entorno del sistema.

### Comandos Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor dev (localhost:8080)
npm run build        # Build de producción (output: dist/)
npm run build:dev    # Build en modo desarrollo
npm run preview      # Preview del build de producción
npm run lint         # Ejecuta ESLint

# Base de datos (Supabase CLI)
supabase db reset    # Resetea DB local y aplica todas las migraciones
supabase gen types typescript  # Genera tipos TypeScript desde schema
supabase functions deploy <function-name>  # Despliega edge function
```

### Tests y Linting

**Linting**:
- **Herramienta**: ESLint 9.9.0
- **Config**: `eslint.config.js`
- **Comando**: `npm run lint`
- **Plugins**: React Hooks, React Refresh

**Tests**:
- **Estado**: No hay infraestructura de testing configurada
- **Evidencia**: `package.json` no tiene dependencias de test (Jest/Vitest)
- **Excepción**: Existe un archivo de test no utilizado: `src/__tests__/sessionBriefMapping.test.ts`

**Recomendación**: Configurar Vitest o Jest para tests unitarios e integración.

### Datos Mock y Seeding

**Datos Mock**:
- **Ubicación**: `src/data/mockData.ts`
- **Contenido**: Grupos y estudiantes mock (usado en desarrollo)
- **Uso**: Cargado en `src/services/groupContext/provider.ts` (híbrido con Supabase)
- **Nota**: `src/utils/groupContext.ts` está deprecado pero se mantiene por compatibilidad

**Seeding de Base de Datos**:
- **Estado**: No hay scripts de seeding automatizados
- **Datos iniciales**: Se crean on-demand:
  - Usuarios demo: `ensure-demo-users` edge function
  - Perfiles: Auto-creados en `AuthContext` (upsert)

**Recomendación**: Crear script de seeding para datos de prueba (grupos, competencias, etc.).

---

## I) Observabilidad y Debugging

### Estrategia de Logging

**Frontend**:
- **Herramienta**: `console.log`, `console.error`, `console.warn`
- **Nivel**: Solo en modo desarrollo (`import.meta.env.DEV`)
- **Ubicación**: Disperso en componentes, hooks, servicios
- **Ejemplo**:
  ```typescript
  if (import.meta.env.DEV) {
    console.log('[Component] Debug info:', data);
  }
  ```

**Backend (Edge Functions)**:
- **Herramienta**: `console.log`, `console.error` (Deno)
- **Nivel**: Siempre activo (no hay diferenciación dev/prod)
- **Ubicación**: `supabase/functions/*/index.ts`

**Limitaciones**:
- No hay logging estructurado (JSON, niveles, contexto)
- No hay agregación externa (LogRocket, Datadog, etc.)
- Logs de Edge Functions solo visibles en Supabase Dashboard

### Reporte de Errores

**Frontend**:
- **Error Boundaries**: `src/components/ErrorBoundary.tsx` (básico)
- **Notificaciones**: Toast notifications (`sonner`, `shadcn/ui toast`)
- **Tracking**: No hay servicio externo (Sentry, LogRocket)

**Backend**:
- **Manejo**: Try/catch en edge functions, retorna errores en respuesta
- **Tracking**: No hay servicio externo

**Recomendación**: Integrar Sentry o similar para tracking de errores en producción.

### Métricas y Tracing

**Estado**: No hay métricas ni tracing configurado

**Recomendación**: 
- Integrar métricas de performance (Web Vitals)
- Tracing de requests (OpenTelemetry)
- Métricas de uso de IA (tokens, latencia)

### Debugging en Desarrollo

**Herramientas**:
- **React DevTools**: Inspección de componentes y estado
- **Redux DevTools**: No aplicable (no usa Redux)
- **Supabase Dashboard**: Inspección de DB, logs de Edge Functions
- **Browser DevTools**: Console, Network, Storage

**Instrumentación DEV**:
- `mockGroups` expuesto a `window.__mockGroups` en desarrollo (`src/main.tsx`)
- Logs condicionales con `import.meta.env.DEV`

---

## J) Preguntas Abiertas / Gaps

### Preguntas para el Equipo

1. **Autenticación en Producción**:
   - ¿Qué método de autenticación se usará? (Email/password, OAuth, SSO)
   - ¿Se mantendrá el auto-login demo o se requerirá login explícito?

2. **Migración de Estudiantes**:
   - ¿Cuándo se migrarán estudiantes de `mockData.ts` a tabla `students` en DB?
   - ¿Qué estructura tendrá la tabla `students`?

3. **Testing**:
   - ¿Qué nivel de cobertura se requiere?
   - ¿Tests unitarios, integración, E2E?

4. **Deployment**:
   - ¿Cuál es el proceso de deployment a producción?
   - ¿Hay staging environment?

5. **Escalabilidad**:
   - ¿Cuál es el volumen esperado de usuarios?
   - ¿Hay límites de rate limiting para Edge Functions?

### Inconsistencias entre Documentación y Código

1. **README.md vs Realidad**:
   - README menciona Lovable como plataforma principal, pero el código es independiente
   - README no menciona Supabase ni la arquitectura real

2. **Documentación de Flujos**:
   - Algunos flujos documentados en `docs/` pueden estar desactualizados
   - Verificar con código actual antes de confiar ciegamente

### Gaps Conocidos (del ARCHITECTURE_SSoT.md)

1. **Demo-Only Authentication**: No production-ready
2. **No Testing Infrastructure**: Sin Jest/Vitest configurado
3. **Brittle HTML Parsing**: Regex-based, riesgo si formato IA cambia
4. **Hybrid Data Model**: Estudiantes en mockData, no en DB
5. **No Structured Logging**: Solo console.log
6. **No Error Tracking**: Sin Sentry/LogRocket

### Recomendaciones de Mejora

1. **Corto Plazo**:
   - Configurar testing (Vitest)
   - Implementar autenticación real
   - Migrar estudiantes a DB
   - Integrar error tracking (Sentry)

2. **Mediano Plazo**:
   - Mejorar parser HTML (usar DOM parser en lugar de regex)
   - Implementar logging estructurado
   - Agregar métricas de performance
   - Documentar API de Edge Functions (OpenAPI/Swagger)

3. **Largo Plazo**:
   - Migración a arquitectura más escalable (si es necesario)
   - Implementar cache para queries frecuentes
   - Optimizar generación IA (batch, streaming)

---

## Referencias Adicionales

- **Documentación Principal**: `docs/ARCHITECTURE_SSoT.md` (Single Source of Truth)
- **Guía de Agentes**: `AGENTS.md` (referencia rápida para AI agents)
- **Changelog**: `CHANGELOG_PGRST204_FIX.md`, `CHANGES.md`
- **Guías de Migración**: `MIGRATION_GUIDE_is_saved.md`
- **Documentación de Contemplaciones**: `CONTEMPLACIONES_V2.md`

---

---

## K) Índice de Evidencia

Esta sección mapea las afirmaciones principales del documento a sus fuentes en el código.

### Stack Tecnológico

| Afirmación | Evidencia |
|------------|-----------|
| React 18.3.1 | `package.json` línea 55 |
| Vite 5.4.1 | `package.json` línea 87 |
| TypeScript 5.5.3 | `package.json` línea 85 |
| React Router DOM 6.26.2 | `package.json` línea 61 |
| TanStack Query 5.56.2 | `package.json` línea 43 |
| Supabase JS 2.56.1 | `package.json` línea 42 |
| Port 8080 | `vite.config.ts` línea 10 |

### Arquitectura y Estructura

| Afirmación | Evidencia |
|------------|-----------|
| 5 Edge Functions | `supabase/functions/` (list_dir): generate-plan-completo, modify-evaluation, generate-bulletin-text, extract-material-text, ensure-demo-users |
| 34 Migraciones | `supabase/migrations/` (list_dir): 34 archivos SQL |
| 14 Páginas | `src/pages/` (list_dir): 14 archivos .tsx |
| 9 Hooks | `src/hooks/` (list_dir): 9 archivos |
| 18 Componentes evaluaciones | `src/components/evaluaciones/` (list_dir): 18 archivos |
| 18 Componentes planificacion | `src/components/planificacion/` (list_dir): 18 archivos |
| 63 Componentes UI | `src/components/ui/` (list_dir): 63 archivos |
| 8 Archivos contemplaciones | `src/lib/contemplaciones/` (list_dir): 8 archivos (incluye __tests__) |

### Flujos y Contratos

| Afirmación | Evidencia |
|------------|-----------|
| Retry baseDelay 1000ms | `supabase/functions/generate-plan-completo/index.ts` línea 12 |
| GPT-4o-mini para planes | `supabase/functions/generate-plan-completo/index.ts` línea 343 |
| GPT-4.1-2025-04-14 para evaluaciones | `supabase/functions/modify-evaluation/index.ts` línea 841 |
| GPT-5-mini-2025-08-07 para chat | `supabase/functions/modify-evaluation/index.ts` línea 841 |
| verify_jwt = false (planes) | `supabase/config.toml` líneas 6-7 |
| verify_jwt = false (boletín) | `supabase/config.toml` líneas 3-4 |
| Entry point main.tsx | `src/main.tsx` línea 12 |
| Routing en App.tsx | `src/App.tsx` líneas 60-147 |
| Protected routes | `src/App.tsx` líneas 30-57 |

### Modelo de Datos

| Afirmación | Evidencia |
|------------|-----------|
| Explicit save pattern | `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql` |
| Soft delete pattern | `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql` |
| Session estado enum | `supabase/migrations/20250930180042_5f97ad70-1b65-4737-a39f-61b92f293635.sql` |
| RLS policies | `supabase/migrations/20250923163758_*.sql` líneas 40-95 |
| FK CASCADE DELETE | `supabase/migrations/20250923163758_*.sql` línea 21 |

### Servicios y Utilidades

| Afirmación | Evidencia |
|------------|-----------|
| groupContext provider | `src/services/groupContext/provider.ts` (archivo principal) |
| groupContext deprecated | `src/utils/groupContext.ts` líneas 4-12 (comentario @deprecated) |
| planParser crítico | `src/lib/planParser.ts` (usado en múltiples lugares) |
| Contemplaciones catalog | `src/lib/contemplaciones/catalog.ts` |

---

## L) Drift e Inconsistencias (SSoT vs Código)

Esta sección documenta discrepancias entre `docs/ARCHITECTURE_SSoT.md` y el código actual.

### Discrepancias en Conteos

| Item | SSoT dice | Código real | Evidencia |
|------|-----------|-------------|-----------|
| Edge Functions | 4 | 5 | `supabase/functions/`: falta `ensure-demo-users` en SSoT |
| Migraciones | 23 | 34 | `supabase/migrations/`: SSoT desactualizado |
| Páginas | 13 | 14 | `src/pages/`: SSoT no cuenta `Index.tsx` |
| Hooks | 7 | 9 | `src/hooks/`: SSoT desactualizado |
| Componentes evaluaciones | 13 | 18 | `src/components/evaluaciones/`: SSoT desactualizado |
| Componentes planificacion | 15 | 18 | `src/components/planificacion/`: SSoT desactualizado |

### Discrepancias en Detalles Técnicos

| Item | SSoT dice | Código real | Evidencia |
|------|-----------|-------------|-----------|
| Retry baseDelay | 2000ms | 1000ms | `supabase/functions/generate-plan-completo/index.ts` línea 12 |
| groupContext ubicación | `src/utils/groupContext.ts` | `src/services/groupContext/provider.ts` (nuevo) | `src/utils/groupContext.ts` está deprecado (líneas 4-12) |

### Notas sobre SSoT

- **SSoT es referencia operacional**: Diseñado para contexto de Cursor, no documentación completa
- **Conteos pueden estar desactualizados**: SSoT se actualiza menos frecuentemente que el código
- **SSoT enfatiza guardrails**: Se enfoca en qué no romper, no en inventario completo

**Recomendación**: Actualizar SSoT con conteos correctos y ubicación actualizada de groupContext.

---

**Fin del Documento**
