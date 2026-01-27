# Phase 4 — Step 1: Audit of Group Profile Data Sources in Supabase

**Fecha**: 27 de diciembre de 2024  
**Objetivo**: Identificar fuentes de datos reales en Supabase para perfil de grupo y estudiantes, y determinar la mejor estrategia para cargar estos datos.

---

## Resumen Ejecutivo

### ✅ Datos Disponibles en Supabase

1. **Tabla `grupos`** existe y contiene:
   - Metadata del grupo (id, name, year, section)
   - `teacher_sugerencias` (JSONB) - sugerencias editables del docente
   - `user_id` - propietario del grupo

2. **Tabla `planificaciones`** tiene campo `grupo_id` que referencia a grupos

### ❌ Datos NO Disponibles en Supabase

- **NO existe tabla de estudiantes** en Supabase
- Los datos de estudiantes (perfil, ajustes, contemplaciones) solo existen en `mockData.ts`

### 🎯 Estrategia Recomendada

**Enfoque Híbrido:**
1. Cargar metadata y `teacher_sugerencias` desde Supabase (tabla `grupos`)
2. Usar fallback a `mockGroups` para datos de estudiantes
3. En futuro: si se agrega tabla de estudiantes en Supabase, solo modificar el helper (transparente para consumidores)

---

## 1. Tabla `grupos` en Supabase

### 1.1 Esquema

**Archivo**: `supabase/migrations/20251226174831_add_grupos_table_teacher_sugerencias.sql`

```sql
CREATE TABLE IF NOT EXISTS public.grupos (
  id TEXT NOT NULL PRIMARY KEY,           -- ID del grupo (ej: "9no 1", "9no 2")
  name TEXT NOT NULL,                     -- Nombre del grupo
  year TEXT,                              -- Año (ej: "9no", "8vo")
  section TEXT,                           -- Sección (ej: "1", "2")
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_sugerencias JSONB DEFAULT NULL, -- Sugerencias editables del docente
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

**Ubicación**: `supabase/migrations/20251226174831_add_grupos_table_teacher_sugerencias.sql` líneas 4-13

### 1.2 RLS Policies

- ✅ Row Level Security habilitado
- ✅ Usuarios solo ven/editan sus propios grupos
- ✅ Políticas: SELECT, INSERT, UPDATE (filtradas por `auth.uid() = user_id`)

### 1.3 Estructura de `teacher_sugerencias`

```typescript
{
  aula?: string;          // Sugerencias para el aula
  evaluaciones?: string;  // Sugerencias para evaluaciones
  otras?: string;         // Otras sugerencias importantes
}
```

**Ejemplo real**:
```json
{
  "aula": "• Utilizar más recursos visuales\n• Incorporar debates semanales",
  "evaluaciones": "• Permitir tiempo adicional\n• Evaluaciones orales opcionales",
  "otras": "Este grupo requiere atención especial en matemáticas."
}
```

### 1.4 Uso Actual en Frontend

**Archivo**: `src/components/GroupProfile.tsx`

**Fetch de `teacher_sugerencias`** (líneas 174-199):

```typescript
const loadTeacherSugerencias = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('grupos')
      .select('teacher_sugerencias')
      .eq('id', group.id)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error loading teacher_sugerencias:', error);
      return;
    }

    if (data?.teacher_sugerencias) {
      setTeacherSugerencias(data.teacher_sugerencias as TeacherSugerencias);
    }
  } catch (error) {
    console.error('Error loading teacher_sugerencias:', error);
  }
};
```

**Observaciones:**
- ✅ Ya hay patrón establecido para cargar datos desde `grupos`
- ✅ Maneja caso de grupo no encontrado (PGRST116)
- ✅ Valida autenticación antes de fetch

---

## 2. Tabla `planificaciones` - Relación con Grupos

### 2.1 Campo `grupo_id`

**Archivo**: `supabase/migrations/20250923173313_a6536237-9abe-4434-b27b-b4b6b4dce04f.sql`

```sql
ALTER TABLE planificaciones 
ADD COLUMN IF NOT EXISTS grupo_id text,
-- ... otros campos
```

**Ubicación**: `supabase/migrations/20250923173313_a6536237-9abe-4434-b27b-b4b6b4dce04f.sql` línea 6

### 2.2 Uso en Wizard

**Archivo**: `src/hooks/usePlanificacionWizard.ts`

- `wizardData.contexto.grupo_id` se valida como obligatorio (línea 40)
- Se usa para crear la planificación (guardado en `planificaciones.grupo_id`)

**Archivo**: `src/pages/PlanificacionWizard.tsx`

- En `handleFinish()`, se guarda `wizardData.contexto.grupo_id` en la tabla (línea 654)

### 2.3 Flujo de Derivación de `grupo_id`

```
Wizard (Paso 0)
  ↓
Usuario selecciona grupo
  ↓
wizardData.contexto.grupo_id = "9no 1" (ejemplo)
  ↓
handleFinish() → INSERT planificaciones (grupo_id = "9no 1")
  ↓
planificacion.id creado
  ↓
Sesiones se crean con planificacion_id
  ↓
Para cargar grupo: sesion → planificacion.grupo_id → grupos.id
```

**Para EditorSesionNuevo**:
- Recibe `planificacionId` como prop
- Necesita fetch de `planificaciones.grupo_id` para obtener el grupo
- Luego puede cargar datos de grupo

---

## 3. Datos de Estudiantes - Solo en Mock Data

### 3.1 Ubicación Actual

**Archivo**: `src/data/mockData.ts`

**Interfaz `Student`** (líneas 30-46):

```typescript
export interface Student {
  id: number;
  name: string;
  perfil: string;                    // ej: "Visual-Kinestésico"
  ajustes?: string;                  // ej: "Tiempo extendido, Contenido visual"
  progreso?: number;
  promedio?: number;
  tendencia?: 'up' | 'down' | 'stable';
  alertas?: string[];
  avatar: string;
  contemplaciones: string[];         // ej: ["Lectura oral de consignas", "Tiempo adicional"]
  anotaciones?: string;
  seguimiento?: string[];
  historialAcademico?: HistorialAcademico[];
  evaluacionesCualitativas?: EvaluacionCualitativa[];
  informeTecnico?: InformeTecnico;
}
```

**Interfaz `Group`** (líneas 54-62):

```typescript
export interface Group {
  id: string;
  name: string;
  studentCount: number;
  year: string;
  section: string;
  students: Student[];                    // ✅ Datos de estudiantes aquí
  teacher_sugerencias?: TeacherSugerencias;
}
```

**mockGroups** (línea 545+):

```typescript
export const mockGroups: Group[] = [
  {
    id: "1",  // Ahora string para consistencia con tabla grupos
    name: "9no 1",
    studentCount: 10,
    year: "9no",
    section: "1",
    students: [...mockStudents],  // Los 10 estudiantes mock con todos sus datos
  },
  // ... más grupos
];
```

### 3.2 Campos Relevantes para Prompts

De cada `Student`, solo necesitamos:
- `perfil`: Estilo de aprendizaje (ej: "Visual-Kinestésico")
- `ajustes`: Resumen de ajustes (ej: "Tiempo extendido")
- `contemplaciones`: Lista de adaptaciones específicas
- `informeTecnico`: (opcional) Datos estructurados del equipo psicopedagógico

**NO necesitamos** (privacidad/irrelevancia):
- `name` - DEBE anonimizarse como "Estudiante A, B, C..."
- `id`, `progreso`, `promedio`, `avatar`, `anotaciones`, `seguimiento`, etc.

### 3.3 Búsqueda de Tabla de Estudiantes en Supabase

**Búsqueda realizada:**
- ❌ NO existe `CREATE TABLE students` o `CREATE TABLE alumnos` en migraciones
- ❌ NO hay referencias a tabla de estudiantes en esquema actual
- ❌ NO hay foreign keys de `grupos` a tabla de estudiantes

**Conclusión**: Los datos de estudiantes solo existen en mock data por ahora.

---

## 4. Estrategia Híbrida para `loadGroupContext()`

### 4.1 Flujo Propuesto

```typescript
async function loadGroupContext(grupoId: string | undefined): Promise<GroupContextData> {
  // 1. Si no hay grupoId, retornar vacío (backward compatibility)
  if (!grupoId) {
    return {};
  }

  // 2. Intentar cargar desde Supabase (tabla grupos)
  const supabaseData = await fetchFromSupabaseGrupos(grupoId);
  
  // 3. Usar fallback a mockGroups para datos de estudiantes
  const mockData = getMockGroupData(grupoId);
  
  // 4. Combinar datos:
  //    - teacher_sugerencias de Supabase (si existe)
  //    - students de mockData (si existe)
  
  // 5. Calcular distribución de estilos y perfil dominante
  const perfilGrupo = calculateProfile(mockData?.students);
  
  // 6. Anonimizar y filtrar estudiantes (solo con ajustes)
  const estudiantes = anonymizeStudents(mockData?.students);
  
  // 7. Retornar objeto combinado
  return {
    perfilGrupo,
    estudiantes,
    teacherSugerencias: supabaseData?.teacher_sugerencias
  };
}
```

### 4.2 Ventajas de Este Enfoque

1. **Usa datos reales de Supabase cuando existen** (`teacher_sugerencias`)
2. **Mantiene funcionalidad actual** con mockGroups como fallback
3. **Preparado para el futuro**: Si se agrega tabla de estudiantes en Supabase, solo cambiar la función `fetchStudentsFromSupabase()` dentro del helper
4. **Transparente para consumidores**: Los componentes no necesitan saber si los datos vienen de Supabase o mock
5. **Backward compatible**: Si no hay datos, retorna objeto vacío

### 4.3 Limitaciones Actuales

- **Estudiantes hardcoded**: Los datos de estudiantes están en mockData, no en BD real
- **No persistentes**: Cambios en perfiles/ajustes de estudiantes no se guardan
- **Demo only**: Los grupos "9no 1", "8vo 1", etc. son ejemplos hardcoded

**Nota**: Esto es aceptable para MVP/demo. En producción real, se necesitaría:
- Tabla `students` o `alumnos` en Supabase
- Relación con `grupos` (ej: `grupo_id` foreign key)
- UI para que docentes carguen/editen estudiantes

---

## 5. Patrones de Fetch Existentes

### 5.1 Desde `GroupProfile.tsx`

**Patrón para cargar grupo**:

```typescript
const { data, error } = await supabase
  .from('grupos')
  .select('teacher_sugerencias')
  .eq('id', group.id)
  .eq('user_id', user.id)
  .single();
```

**Observaciones:**
- ✅ Usa `.single()` para obtener un solo registro
- ✅ Filtra por `user_id` (RLS adicional en frontend)
- ✅ Maneja error PGRST116 (no rows returned) como caso válido

### 5.2 Desde `PlanificacionWizard.tsx`

**Patrón para cargar planificación**:

```typescript
const { data: planificacion, error: planificacionError } = await supabase
  .from('planificaciones')
  .select('*')
  .eq('id', planificacionId)
  .single();
```

**Para obtener `grupo_id`**:
- `planificacion.grupo_id` está disponible en el objeto retornado
- Se usa para fetch posterior si se necesita información de grupo

---

## 6. Tipos Necesarios para el Helper

### 6.1 Tipos de Input/Output

```typescript
// Input
type GrupoId = string | undefined;

// Output
interface GroupContextData {
  perfilGrupo?: PerfilGrupo;
  estudiantes?: EstudianteAjuste[];
  teacherSugerencias?: TeacherSugerencias;
}

// Sub-tipos
interface PerfilGrupo {
  tamanio: number;
  dominante: string;
  distribucion?: Record<string, number>;
}

interface EstudianteAjuste {
  perfil?: string;
  ajustes?: string;
  contemplaciones?: string[];
  // informeTecnico omitido por simplicidad inicial (puede agregarse después)
}

interface TeacherSugerencias {
  aula?: string;
  evaluaciones?: string;
  otras?: string;
}
```

### 6.2 Ubicación del Helper

**Archivo propuesto**: `src/utils/groupContext.ts`

**Exports**:
- `loadGroupContext(grupoId)` - función principal
- Tipos: `GroupContextData`, `PerfilGrupo`, `EstudianteAjuste` (re-export desde types si se crea un archivo de types compartidos)

---

## 7. Acceso a `grupo_id` en Diferentes Contextos

### 7.1 En `PlanificacionWizard.tsx`

**Disponible directamente**:
- `wizardData.contexto?.grupo_id` (antes de crear planificación)
- `planificacion.grupo_id` (después de crear)

### 7.2 En `EditorSesionNuevo.tsx`

**Props actuales** (líneas 176-183):
```typescript
export function EditorSesionNuevo({ 
  sesion, 
  onActualizar, 
  competenciasDelPeriodo,
  planificacionId,   // ✅ Tiene planificacionId
  materia,
  nivel
}: EditorSesionNuevoProps)
```

**Necesita fetch**:
```typescript
// Dentro del componente, al cargar
const { data: planificacion } = await supabase
  .from('planificaciones')
  .select('grupo_id')
  .eq('id', planificacionId)
  .single();

const grupoId = planificacion?.grupo_id;
```

**Alternativa mejor**: Pasar `grupo_id` como prop desde el componente padre (si ya está disponible)

### 7.3 En `useFullSessionGeneration.ts`

**Parámetros actuales de `generateAIPlan()`** (líneas 236-251):
```typescript
async function generateAIPlan(params: {
  materia: string;
  contenido: string;
  competencias: string[];
  modalidad: string;
  duracionMinutos: number;
  diferenciacion?: string;
  grupoId: string;          // ✅ Ya recibe grupoId
  sesionNumero: number;
  totalSesiones: number;
  unitAssignment?: UnitAssignmentMetadata;
  requerimientosDocente?: string;
  sessionBrief?: string;
})
```

**Observación**: Ya tiene `grupoId` en params, pero actualmente no se usa para cargar perfil.

---

## 8. Límites de Tamaño de Prompts

### 8.1 Consideraciones

- **Edge functions**: Timeout de 30 segundos (actual)
- **OpenAI tokens**: Límite de entrada varía según modelo
  - `gpt-4o-mini`: ~128k tokens de contexto
  - `gpt-4.1`: ~128k tokens de contexto
- **Supabase Edge Functions**: Límite de payload request ~6MB

### 8.2 Estrategia de Limitación

**Cap propuesto para estudiantes con ajustes**: 10 estudiantes máximo

**Razón**:
- Grupo típico: 20-30 estudiantes
- Estudiantes con ajustes: ~20-40% (4-12 estudiantes)
- 10 estudiantes con ~3 contemplaciones cada uno = ~30 líneas de texto
- Añade ~500-1000 tokens al prompt (manejable)

**Implementación**:
```typescript
const estudiantes = group.students
  .filter(s => s.ajustes || s.contemplaciones?.length > 0)
  .slice(0, 10)  // Cap a 10 estudiantes
  .map(s => ({ perfil: s.perfil, ajustes: s.ajustes, contemplaciones: s.contemplaciones }));
```

---

## 9. Recomendaciones para Implementación

### 9.1 Prioridad ALTA

1. **Crear helper `src/utils/groupContext.ts`**:
   - Función `loadGroupContext(grupoId)`
   - Lógica híbrida: Supabase + mockGroups fallback
   - Anonimización de nombres
   - Cálculo de distribución de estilos
   - Cap de 10 estudiantes con ajustes

2. **Actualizar `PlanificacionWizard.tsx`**:
   - Reemplazar `buildGroupContextFromId()` local por `loadGroupContext()`
   - Incluir `teacherSugerencias` en logs/payload si están disponibles

3. **Actualizar `EditorSesionNuevo.tsx`**:
   - Fetch `planificaciones.grupo_id` antes de generar
   - Llamar `loadGroupContext(grupoId)`
   - Incluir `perfilGrupo`, `estudiantes` en payload

4. **Actualizar `useFullSessionGeneration.ts`**:
   - Llamar `loadGroupContext(params.grupoId)`
   - Incluir `students` y `dominantProfile` en `groupContext`

### 9.2 Prioridad MEDIA

5. **Enriquecer prompts con `teacherSugerencias`**:
   - En `generate-plan-completo`: Agregar sección de sugerencias del docente
   - En `modify-evaluation`: Incluir en `additionalContext`

### 9.3 Prioridad BAJA (Futuro)

6. **Migración a tabla de estudiantes en Supabase**:
   - Crear tabla `students` o `alumnos`
   - Relación con `grupos`
   - Modificar `loadGroupContext()` para usar tabla real
   - Agregar UI para gestión de estudiantes

---

## 10. Checklist de Verificación

Antes de implementar, verificar:

- ✅ Tabla `grupos` existe en Supabase
- ✅ `teacher_sugerencias` es JSONB con estructura conocida
- ✅ `planificaciones.grupo_id` está poblado en registros existentes
- ✅ `mockGroups` contiene estudiantes con perfiles y contemplaciones
- ❌ NO existe tabla de estudiantes en Supabase (usar mock como fallback)

---

## Conclusión

**Estrategia Clara**:
1. Cargar `teacher_sugerencias` desde Supabase (tabla `grupos`)
2. Cargar datos de estudiantes desde `mockGroups` (fallback hasta que exista tabla real)
3. Combinar ambos en un helper compartido (`loadGroupContext()`)
4. Usar este helper en TODOS los puntos de entrada de generación

**Ventajas**:
- ✅ Usa datos reales cuando existen
- ✅ Mantiene compatibilidad con demo/mock
- ✅ Preparado para futuro (tabla de estudiantes)
- ✅ Single source of truth (un solo helper)
- ✅ Anonimización y límites implementados desde el inicio

**Archivos que necesitarán cambios**:
- NUEVO: `src/utils/groupContext.ts`
- Modificar: `src/pages/PlanificacionWizard.tsx`
- Modificar: `src/components/planificacion/EditorSesionNuevo.tsx`
- Modificar: `src/hooks/useFullSessionGeneration.ts`
- Opcional: Edge functions (para incluir `teacherSugerencias` en prompts)













