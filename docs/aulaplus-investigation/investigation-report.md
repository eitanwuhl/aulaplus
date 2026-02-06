# AulaPlus v0 - Reporte de Investigación Técnica

**Fecha:** 5 de febrero de 2026  
**Estado:** Fase de Investigación (no se implementaron cambios)  
**Objetivo:** Diagnóstico completo del codebase para planificar mejoras progresivas

---

## 📁 Project Map

### Estructura de Carpetas Principal

```
aulaplus/
├── src/
│   ├── components/           # Componentes React (9,268 LOC total)
│   │   ├── evaluaciones/     # 19 componentes para evaluaciones (~3,500 LOC)
│   │   ├── planificacion/    # 18 componentes para planificación (~6,200 LOC)
│   │   ├── materials/        # Biblioteca de materiales
│   │   ├── shared/           # Componentes compartidos
│   │   └── ui/               # Primitivas shadcn/ui
│   ├── pages/                # Páginas principales (9,912 LOC total)
│   ├── hooks/                # Custom hooks (9 archivos)
│   ├── services/             # Lógica de negocio
│   │   ├── evaluations/      # Servicios de evaluaciones
│   │   ├── groupContext/     # Provider de contexto de grupo
│   │   └── materials/        # Gestión de materiales
│   ├── lib/                  # Utilidades y parsers
│   │   └── contemplaciones/  # Sistema de contemplaciones
│   ├── data/                 # Datos mock y catálogos
│   ├── types/                # TypeScript types
│   ├── integrations/         # Supabase client y types
│   ├── contexts/             # Auth context
│   └── utils/                # Helpers varios
├── supabase/
│   ├── functions/            # Edge functions (5)
│   └── migrations/           # 33 migraciones SQL
├── tests/                    # Tests mínimos (1 archivo)
└── refactor/                 # Documentación de refactors previos
```

### Archivos Críticos a Conocer

| Archivo | LOC | Rol |
|---------|-----|-----|
| [src/pages/EvaluacionesGrupo.tsx](src/pages/EvaluacionesGrupo.tsx) | 2,683 | ⚠️ **MAYOR** - Generación de evaluaciones |
| [src/pages/MisPlanificaciones.tsx](src/pages/MisPlanificaciones.tsx) | 1,664 | Dashboard de planificaciones |
| [src/pages/PlanificacionWizard.tsx](src/pages/PlanificacionWizard.tsx) | 1,399 | Wizard de creación de planificación |
| [src/pages/PlanificacionWorkspace.tsx](src/pages/PlanificacionWorkspace.tsx) | 1,111 | Workspace de edición de sesiones |
| [src/components/planificacion/WizardSteps.tsx](src/components/planificacion/WizardSteps.tsx) | 1,112 | Pasos del wizard |
| [src/components/planificacion/EditorSesionNuevo.tsx](src/components/planificacion/EditorSesionNuevo.tsx) | 1,098 | Editor de sesión individual |
| [src/components/StudentProfile.tsx](src/components/StudentProfile.tsx) | 1,107 | Perfil de estudiante |
| [src/lib/planParser.ts](src/lib/planParser.ts) | 822 | ⚠️ **CRÍTICO** - Parser de planes HTML |
| [src/data/mockData.ts](src/data/mockData.ts) | 781 | Datos hardcodeados de estudiantes |
| [src/services/groupContext/provider.ts](src/services/groupContext/provider.ts) | 653 | Provider unificado de contexto |
| [supabase/functions/generate-plan-completo/index.ts](supabase/functions/generate-plan-completo/index.ts) | 567 | Edge function de generación IA |

---

## 🔧 Tech Stack

| Categoría | Tecnología | Versión |
|-----------|------------|---------|
| **Framework** | React | 18.3.1 |
| **Router** | react-router-dom | 6.26.2 |
| **State Management** | TanStack Query | 5.56.2 |
| **UI Framework** | shadcn/ui + Radix | Multiple |
| **Styling** | Tailwind CSS | 3.4.11 |
| **Forms** | react-hook-form + zod | 7.53.0 / 3.23.8 |
| **Backend** | Supabase | 2.56.1 |
| **Build** | Vite | 7.3.1 |
| **Language** | TypeScript | 5.5.3 |
| **Rich Text** | react-quill | 2.0.0 |
| **Charts** | Recharts | 2.12.7 |
| **PDF** | jspdf + html2canvas | 4.1.0 / 1.4.1 |
| **Animations** | framer-motion | 12.19.1 |

---

## 🚀 Current Features & Flows

### 1. Autenticación (Demo Mode)
- **Archivo:** [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- **Estado:** Solo demo, no production-ready
- Usuario demo hardcodeado: `demo.teacher@example.com`
- Cualquier credencial es aceptada (sin validación real)
- Crea usuario mock en Supabase en background

### 2. Dashboard del Profesor
- **Ruta:** `/teacher-dashboard`
- **Archivo:** [src/components/TeacherDashboard.tsx](src/components/TeacherDashboard.tsx)
- Muestra resumen de grupos, alertas, accesos rápidos

### 3. Gestión de Grupos
- **Ruta:** `/teacher-groups`
- **Archivos:** [TeacherGroups.tsx](src/pages/TeacherGroups.tsx), [GroupProfile.tsx](src/components/GroupProfile.tsx)
- Lista grupos con estudiantes (mock data)
- Perfil de grupo con sugerencias del docente (Supabase)

### 4. Perfil de Estudiante
- **Archivo:** [src/components/StudentProfile.tsx](src/components/StudentProfile.tsx)
- Historial académico, contemplaciones, evaluaciones cualitativas
- Informe técnico psicopedagógico
- **Datos:** Completamente hardcodeados en mockData.ts

### 5. Wizard de Planificación
- **Ruta:** `/planificacion/nuevo`
- **Archivos:** [PlanificacionWizard.tsx](src/pages/PlanificacionWizard.tsx), [WizardSteps.tsx](src/components/planificacion/WizardSteps.tsx)
- **Pasos:**
  1. Contexto (grupo, materia, fechas)
  2. Horario semanal
  3. Enfoque (unidades didácticas, competencias)
  4. Generación IA de sesiones
- Guarda en Supabase: `planificaciones`, `sesiones_clase`

### 6. Workspace de Planificación
- **Ruta:** `/planificacion/:id`
- **Archivo:** [PlanificacionWorkspace.tsx](src/pages/PlanificacionWorkspace.tsx)
- Calendario drag-and-drop de sesiones
- Editor de sesión individual con regeneración IA
- Gestión de materiales adjuntos

### 7. Generación de Evaluaciones
- **Ruta:** `/evaluaciones/nuevo`
- **Archivo:** [EvaluacionesGrupo.tsx](src/pages/EvaluacionesGrupo.tsx)
- Selección de grupo, materia, contenidos ANEP
- Generación de versiones adaptadas (A/B/C)
- Rúbrica inteligente
- Recordatorios por estudiante (contemplaciones)

### 8. Mis Evaluaciones / Mis Planificaciones
- **Rutas:** `/mis-evaluaciones`, `/mis-planificaciones`
- Listado con filtros, soft delete, export

### 9. Biblioteca de Materiales
- **Ruta:** `/biblioteca-materiales`
- Upload de PDFs, extracción de texto
- Asociación a sesiones/evaluaciones

---

## 🔴 Top 10 Critical Issues

### 1. **EvaluacionesGrupo.tsx - Archivo Monolítico (2,683 LOC)**
- **Severidad:** 🔴 Alta
- **Impacto:** Mantenibilidad, testing, performance
- **Detalle:** Contiene lógica de UI, estado complejo, llamadas API, helpers, todo mezclado
- **Síntomas:** Difícil de debuggear, re-renders innecesarios, alta carga cognitiva

### 2. **Datos de Estudiantes Hardcodeados**
- **Severidad:** 🔴 Alta
- **Impacto:** No escalable, datos inconsistentes
- **Archivos afectados:**
  - [src/data/mockData.ts](src/data/mockData.ts) - 781 LOC de datos mock
  - [src/services/groupContext/provider.ts](src/services/groupContext/provider.ts) - TODOs pendientes
- **Problema:** Toda la información de estudiantes (perfiles, historial, informes técnicos) está hardcodeada. El provider tiene `SupabaseStudentDataSource` como placeholder sin implementar.

### 3. **Plan Parser Frágil (Regex-Based)**
- **Severidad:** 🔴 Alta
- **Impacto:** Planes mal parseados, pérdida de contenido
- **Archivo:** [src/lib/planParser.ts](src/lib/planParser.ts) (822 LOC)
- **Problema:** Parser basado en regex para HTML generado por IA. Cualquier cambio en formato de salida puede romper el parsing. Ya documentado en AGENTS.md como crítico.

### 4. **512 Errores de ESLint**
- **Severidad:** 🟠 Media-Alta
- **Impacto:** Code quality, dead code, potential bugs
- **Desglose:**
  - ~400 `@typescript-eslint/no-unused-vars` (imports/variables no usadas)
  - ~80 `@typescript-eslint/no-explicit-any` (tipos inseguros)
  - ~7 auto-fixable
- **Archivos más afectados:** EvaluacionesGrupo.tsx, PlanificacionWizard.tsx, MisPlanificaciones.tsx

### 5. **Build Warning: Chunk de 2.4MB**
- **Severidad:** 🟠 Media
- **Impacto:** Performance de carga inicial
- **Detalle:** `index-cCDhnJ2I.js` es de 2,395KB (686KB gzipped)
- **Causa:** Sin code splitting adecuado, todo en un chunk

### 6. **Inconsistencia en Manejo de Errores**
- **Severidad:** 🟠 Media
- **Impacto:** UX inconsistente, errores silenciosos
- **Problemas detectados:**
  - Algunos catch blocks vacíos
  - `console.error` sin feedback al usuario
  - ErrorBoundary solo en algunos componentes
  - Edge functions devuelven errores inconsistentes

### 7. **Autenticación Solo Demo**
- **Severidad:** 🟠 Media (para producción)
- **Impacto:** Seguridad
- **Archivo:** [AuthContext.tsx](src/contexts/AuthContext.tsx)
- **Problema:** `// NO VALIDATION - any credentials are accepted`

### 8. **Console.log/warn/error Excesivos en Producción**
- **Severidad:** 🟡 Baja-Media
- **Impacto:** Performance, exposición de información
- **Detalle:** 50+ matches encontrados, muchos no condicionados a DEV

### 9. **Prop Drilling y Estado Distribuido**
- **Severidad:** 🟡 Media
- **Impacto:** Mantenibilidad
- **Ejemplos:**
  - WizardSteps recibe >10 props
  - Estado duplicado entre localStorage y React state
  - Contemplaciones en 3 lugares: catalog, storage, mock data

### 10. **Falta de Tests**
- **Severidad:** 🟡 Media
- **Impacto:** Confianza en refactors
- **Estado actual:**
  - Solo 2 archivos de test: `sessionBriefMapping.test.ts`, `wrapper_detection.test.ts`
  - Sin configuración de test runner (no hay `vitest` o `jest` en dependencies)

---

## ⚡ Quick Wins

### 1. Limpiar imports no usados (Auto-fix)
```bash
npm run lint -- --fix
```
**Impacto:** Reducir ~50% de errores de lint en minutos

### 2. Agregar ErrorBoundary a rutas principales
- Envolver cada página con ErrorBoundary en App.tsx
- **Tiempo:** 30 min
- **Impacto:** Prevenir pantallas blancas

### 3. Condicionar console.* a DEV
- Buscar/reemplazar: `console.log(` → `import.meta.env.DEV && console.log(`
- **Tiempo:** 1 hora
- **Impacto:** Builds más limpios

### 4. Extraer types duplicados
- StudentForAI, GroupContextForAI ya existen en types/
- Eliminar interfaces duplicadas en páginas
- **Tiempo:** 2 horas
- **Impacto:** Single source of truth para types

### 5. Agregar lazy loading a rutas
```tsx
const EvaluacionesGrupo = lazy(() => import('./pages/EvaluacionesGrupo'));
```
- **Tiempo:** 1 hora
- **Impacto:** Reducir bundle inicial significativamente

### 6. Crear barrel exports para components
- Agregar `index.ts` a cada carpeta de componentes
- **Tiempo:** 30 min
- **Impacto:** Imports más limpios

---

## 🏗️ Recommended Architecture Adjustments

### A. Separación de Componentes Gigantes

**Target:** EvaluacionesGrupo.tsx (2,683 → ~500 LOC por archivo)

**Propuesta de split:**
```
src/pages/EvaluacionesGrupo/
├── index.tsx                    # Container principal (~200 LOC)
├── hooks/
│   ├── useEvaluacionGenerator.ts    # Lógica de generación IA
│   ├── useEvaluacionState.ts        # Estado complejo del form
│   └── useContemplaciones.ts        # Lógica de contemplaciones
├── components/
│   ├── ContentSelector.tsx          # Selector de contenidos ANEP
│   ├── CompetenciasPanel.tsx        # Panel de competencias
│   ├── VersionSelector.tsx          # Selector de versiones A/B/C
│   └── GeneratedEvaluationView.tsx  # Vista de evaluación generada
└── utils/
    └── evaluationHelpers.ts         # Helpers puros
```

### B. Services Pattern para AI

**Actual:** Llamadas a supabase.functions.invoke() dispersas en componentes

**Propuesto:**
```typescript
// src/services/ai/index.ts
export const aiService = {
  generatePlan: (params: PlanGenerationParams) => Promise<PlanResult>,
  generateEvaluation: (params: EvalGenerationParams) => Promise<EvalResult>,
  modifyEvaluation: (params: ModifyParams) => Promise<EvalResult>,
};

// Con retry, error handling, caching centralizado
```

### C. Data Layer Abstraction

**Actual:** Mix de Supabase queries, mock data, localStorage

**Propuesto:**
```typescript
// src/services/data/students.ts
interface StudentRepository {
  getByGroupId(groupId: string): Promise<Student[]>;
  getContemplaciones(studentId: string, category: Category): Promise<string[]>;
  updateContemplaciones(studentId: string, category: Category, ids: string[]): Promise<void>;
}

// Implementaciones:
class MockStudentRepository implements StudentRepository { ... }
class SupabaseStudentRepository implements StudentRepository { ... }

// Factory según environment
export const studentRepository = createStudentRepository(config);
```

### D. State Ownership Rules

| Dominio | Owner | Persistencia |
|---------|-------|--------------|
| Auth | AuthContext | Supabase session |
| Planificaciones | Supabase + React Query | Supabase DB |
| Sesiones | Supabase + React Query | Supabase DB |
| Evaluaciones | Supabase + React Query | Supabase DB |
| Estudiantes | StudentRepository | Mock → Supabase (futuro) |
| Contemplaciones | ContemStorage + localStorage | localStorage → Supabase (futuro) |
| UI/Forms | Local state + useReducer | Ephemeral |

### E. Hook Pattern Guidelines

```typescript
// ❌ Evitar: Hooks que hacen todo
function useEvaluacion() {
  // 500 líneas de todo mezclado
}

// ✅ Preferir: Composición de hooks pequeños
function useEvaluacionForm() { /* solo estado del form */ }
function useEvaluacionGeneration() { /* solo llamada IA */ }
function useEvaluacionPersistence() { /* solo guardado */ }

function useEvaluacion() {
  const form = useEvaluacionForm();
  const generation = useEvaluacionGeneration();
  const persistence = useEvaluacionPersistence();
  return { form, generation, persistence };
}
```

---

## 📋 Plan for Next Phase (Planning)

### Phase 1: Estabilización (1-2 semanas)

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Fix lint errors (auto-fixable) | P0 | 30 min | Medio |
| Add ErrorBoundary global | P0 | 1h | Alto |
| Condicionar console.* a DEV | P1 | 1h | Bajo |
| Documentar contratos AI actuales | P1 | 2h | Alto |
| Setup Vitest | P1 | 2h | Medio |
| Test crítico para planParser | P0 | 4h | Muy Alto |

### Phase 2: Modularización (2-3 semanas)

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Split EvaluacionesGrupo.tsx | P0 | 8h | Muy Alto |
| Split PlanificacionWizard.tsx | P1 | 6h | Alto |
| Extraer aiService | P1 | 4h | Alto |
| Crear StudentRepository interface | P1 | 4h | Alto |
| Implementar lazy routes | P2 | 2h | Medio |

### Phase 3: Data Layer (3-4 semanas)

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Schema para students table | P1 | 4h | Alto |
| Migrar mockData a Supabase | P1 | 8h | Muy Alto |
| Schema para contemplaciones | P2 | 4h | Medio |
| Migrar localStorage → DB | P2 | 8h | Medio |

### Phase 4: Polish (2 semanas)

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Reducir bundle size | P2 | 4h | Medio |
| Audit any types | P2 | 4h | Medio |
| Add more tests | P2 | 8h | Alto |
| Documentación actualizada | P3 | 4h | Medio |

---

## ❓ Questions for the Owner

### Datos y Modelo de Negocio

1. **Estudiantes en producción:** ¿Los datos de estudiantes vendrán de un sistema externo (ANEP, sistema del liceo) o los docentes cargarán a mano?

2. **Contemplaciones:** ¿El sistema de contemplaciones (26 tipos) está completo o puede crecer? ¿Quién define nuevas contemplaciones?

3. **Informes técnicos:** ¿Los informes psicopedagógicos (`informeTecnico` en student) serán ingresados por psicólogos/psicopedagogos o importados de otro sistema?

4. **Multi-tenancy:** ¿Un docente puede pertenecer a múltiples instituciones? ¿Hay separación por institución?

### AI y Generación

5. **Rate limits:** ¿Cuántas generaciones de plan/evaluación por usuario/día son aceptables? ¿Hay costo concern?

6. **Calidad de generación:** ¿Hay feedback estructurado de docentes sobre planes generados? ¿Se guardan métricas de regeneraciones?

7. **Materiales:** ¿El texto extraído de PDFs se usa bien actualmente? ¿Hay planes de OCR para imágenes?

8. **Modelo GPT:** ¿Hay plan de usar GPT-4 en vez de GPT-4o-mini para casos complejos?

### Funcionalidad

9. **Evaluaciones versiones A/B/C:** ¿El algoritmo actual de asignación de estudiantes a versiones es correcto o necesita ajustes?

10. **Calendario:** ¿Deben integrarse feriados nacionales automáticamente? ¿Hay un API oficial?

11. **Comunicaciones:** La feature `/comunicaciones` parece parcialmente implementada. ¿Es prioritaria?

12. **Export/Print:** ¿Qué formato de export es más importante (PDF, Word, impresión directa)?

### Técnicos

13. **Tests existentes:** ¿Los 2 archivos de test (`sessionBriefMapping.test.ts`, `wrapper_detection.test.ts`) están pasando? ¿Cómo se corren?

14. **Environment vars:** ¿Hay un `.env.example` o documentación de variables requeridas?

15. **Deployment:** ¿Dónde está hosteado el frontend actualmente? ¿Vercel, Netlify, otro?

16. **Monitoring:** ¿Hay logging/error tracking (Sentry, LogRocket) configurado o planeado?

### Prioridades

17. **MVP vs Features:** ¿Cuáles son las 3 features más críticas para los primeros usuarios reales?

18. **Usuarios beta:** ¿Hay docentes usando la app actualmente? ¿Cuál es el feedback principal?

19. **Timeline:** ¿Hay una fecha objetivo para "producción"?

20. **Budget:** ¿Hay restricciones de tiempo/recursos para el refactor?

---

## 📊 Summary Metrics

| Métrica | Valor |
|---------|-------|
| Total archivos TS/TSX | ~150 |
| Total LOC (src/) | ~35,000 |
| Páginas | 14 |
| Componentes | ~80 |
| Hooks custom | 9 |
| Edge functions | 5 |
| Migraciones SQL | 33 |
| Errores lint | 512 |
| Bundle size (main) | 2.4MB |
| Tests | 2 archivos |

---

*Este reporte fue generado como parte de la fase de investigación. No se realizaron cambios al código.*
