# Auditoría: Generación de Planificación por Unidades

**Fecha**: 26 de diciembre de 2024  
**Alcance**: Análisis READ-ONLY del flujo de generación de planificación basada en unidades didácticas

---

## 1. CURRENT GENERATION FLOW

### Ubicación del Código

**Archivos principales**:
- `src/pages/PlanificacionWizard.tsx` (líneas 340-658): Creación de planificación y sesiones
- `src/hooks/useFullSessionGeneration.ts` (líneas 15-97): Generación de todas las sesiones
- `src/hooks/useCalendarioSesiones.ts`: Gestión de sesiones en calendario

### Cómo se Define una Unidad

**Archivo**: `src/types/planificacion.ts` (líneas 90-97)

```typescript
export interface UnidadDidactica {
  id: string;
  contenido_id: string;
  contenido_texto: string;
  competencias_ids: string[];
  clases_estimadas: number;  // ← Número de clases estimadas para esta unidad
  orden: number;
}
```

**Respuesta**: Una unidad se define como un objeto con:
- Contenido (macro-contenido ANEP)
- Competencias asociadas
- `clases_estimadas`: número de clases que el docente estima necesarias
- `orden`: posición en la secuencia de unidades

### Cómo se Pasan los Contenidos al Generador

**Archivo**: `src/hooks/useFullSessionGeneration.ts` (líneas 26-39)

```typescript
const unidadesDidacticas = ((planificacion as any).unidades_didacticas) || [];

const sessionPromises = fechasSesiones.map(async (fecha, index) => {
  // Rotar unidades didácticas
  const unidadIndex = unidadesDidacticas.length > 0 
    ? Math.floor(index / Math.ceil(fechasSesiones.length / unidadesDidacticas.length))
    : 0;
  const unidad = unidadesDidacticas[unidadIndex] || { contenido_texto: 'Contenido general', competencias_ids: [] };
```

**Respuesta**: Los contenidos se pasan mediante **rotación circular**:
- Se calcula qué unidad corresponde a cada sesión usando `Math.floor(index / Math.ceil(total / unidades.length))`
- Si hay 3 unidades y 9 sesiones, cada unidad se repite 3 veces
- **NO se usa `clases_estimadas`** para determinar cuántas sesiones crear para cada unidad

### Cómo se Maneja el Número de Clases por Contenido

**Archivo**: `src/pages/PlanificacionWizard.tsx` (líneas 395-470)

**Respuesta**: **NO se usa `clases_estimadas`** para crear sesiones. En su lugar:

1. **Modo "sin_periodo"**: Se crean `cantidad_sesiones` sesiones en backlog (línea 398)
2. **Modo "periodo_especifico"**: Se generan sesiones basadas en fechas del calendario (línea 437)

El campo `clases_estimadas` se muestra en la UI (`UnidadCard.tsx`) pero **no influye en la creación de sesiones**.

### ¿Existe un Loop "Generar la Misma Clase N Veces"?

**Respuesta**: **SÍ, pero de forma indirecta**

**Archivo**: `src/hooks/useFullSessionGeneration.ts` (líneas 34-55)

```typescript
const sessionPromises = fechasSesiones.map(async (fecha, index) => {
  const unidadIndex = unidadesDidacticas.length > 0 
    ? Math.floor(index / Math.ceil(fechasSesiones.length / unidadesDidacticas.length))
    : 0;
  const unidad = unidadesDidacticas[unidadIndex];
  
  const planDesarrollo = await generateAIPlan({
    materia: planificacion.materia,
    contenido: unidad?.contenido_texto || 'Contenido general',
    // ... mismo contenido para múltiples sesiones
  });
```

**Explicación**: 
- Si una unidad tiene `clases_estimadas: 3`, pero el sistema crea 9 sesiones totales, esa unidad se repetirá 3 veces (si hay 3 unidades)
- Cada repetición genera un plan **independiente** con el mismo contenido
- **NO hay diferenciación** entre "clase 1 de la unidad X" vs "clase 2 de la unidad X"

### ¿Existe Concepto de "Secuencia", "Progresión" o "Índice de Clase"?

**Respuesta**: **PARCIALMENTE**

**Campos existentes**:
- `sesionNumero`: número de sesión (1, 2, 3...) - **SÍ existe**
- `totalSesiones`: total de sesiones - **SÍ existe**
- `orden`: orden de la sesión en la planificación - **SÍ existe**

**Campos NO existentes**:
- `clase_numero_en_unidad`: no existe (ej: "clase 1 de 3 para esta unidad")
- `unidad_actual`: no se identifica explícitamente qué unidad corresponde
- `clase_anterior`: no hay referencia a la clase previa
- `clase_siguiente`: no hay referencia a la clase siguiente
- `progresion_unidad`: no hay concepto de progresión dentro de una unidad

**Archivo**: `src/hooks/useFullSessionGeneration.ts` (líneas 45-55)

```typescript
const planDesarrollo = await generateAIPlan({
  // ...
  sesionNumero: index + 1,  // ← Solo número global de sesión
  totalSesiones: fechasSesiones.length
});
```

---

## 2. AI PROMPT PAYLOAD

### Payload Enviado a la IA

**Archivo**: `supabase/functions/generate-plan-completo/index.ts` (líneas 38-52)

```typescript
const { 
  modo,
  sesionId,
  orden,
  duracionMin,
  materia,
  nivel,
  contenidos,
  competencias,
  criterios,
  perfilGrupo,        // ← Opcional, rara vez usado
  estudiantes,        // ← Opcional, rara vez usado
  instruccionesDocente, // ← Opcional, casi nunca pasado
  planActual
} = await req.json();
```

### Campos Incluidos en el Prompt

**Archivo**: `supabase/functions/generate-plan-completo/index.ts` (líneas 54-67)

```typescript
const prompt = `
Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP).
${modo === 'regenerar' ? 'Modificá' : 'Generá'} el plan de la sesión ${orden} con duración ${duracionMin} minutos.

CONTEXTO DE LA CLASE:
- Materia: ${materia || 'Sin especificar'}
- Nivel: ${nivel || 'Sin especificar'}
- Contenidos ANEP: ${Array.isArray(contenidos) ? contenidos.join(', ') : contenidos || 'Sin especificar'}
- Competencias: ${Array.isArray(competencias) ? competencias.join(', ') : competencias || 'Sin especificar'}
- Criterios de logro: ${Array.isArray(criterios) ? criterios.join(', ') : criterios || 'Sin especificar'}
${perfilGrupo ? `- Perfil del grupo: ${perfilGrupo.dominante || 'mixto'} (${perfilGrupo.tamanio || 'sin especificar'} estudiantes)` : ''}
${estudiantes?.length ? `- Estudiantes con ajustes: ${estudiantes.filter(e => e.ajustes?.length).length}` : ''}
${instruccionesDocente ? `\nINSTRUCCIONES DEL DOCENTE:\n${instruccionesDocente}` : ''}
```

**Respuesta**: El prompt incluye:
- ✅ Materia, nivel, contenidos, competencias, criterios
- ✅ Número de sesión (`orden`)
- ❌ **NO incluye**: número de clase dentro de la unidad
- ❌ **NO incluye**: información sobre clases anteriores
- ❌ **NO incluye**: información sobre clases siguientes
- ❌ **NO incluye**: progresión esperada dentro de la unidad

### ¿Cada Generación de Clase es Consciente de su Número?

**Respuesta**: **SÍ, pero solo del número global**

- El prompt menciona "sesión ${orden}" pero no "clase 1 de 3 de la unidad X"
- La IA sabe que es la sesión 5 de 12, pero no sabe que es la clase 2 de 3 para el contenido "Revolución Industrial"

### ¿Cada Generación es Consciente de Clases Previas/Siguientes?

**Respuesta**: **NO**

**Evidencia**:
- No se pasa información de `sesiones_clase` anteriores al prompt
- No se pasa información de `plan_desarrollo` de clases previas
- No hay lógica que consulte clases anteriores antes de generar

**Archivo**: `src/pages/PlanificacionWorkspace.tsx` (líneas 164-175)

```typescript
const payload = {
  modo: 'generar_plan_html',
  sesionId: sesion.id,
  orden: sesion.orden,
  // ... NO incluye información de sesiones anteriores
  instruccionesDocente: undefined  // ← Incluso esto está undefined
};
```

### ¿Se Reutiliza el Mismo Prompt N Veces sin Diferenciación?

**Respuesta**: **SÍ, con diferenciación mínima**

**Archivo**: `src/hooks/useFullSessionGeneration.ts` (líneas 150-170)

```typescript
modification: `Genera un plan de clase estructurado para la sesión ${params.sesionNumero} de ${params.totalSesiones}:

MATERIA: ${params.materia}
CONTENIDO: ${params.contenido}  // ← Mismo contenido para múltiples sesiones
MODALIDAD PRINCIPAL: ${params.modalidad}
DURACIÓN: ${params.duracionMinutos} minutos
```

**Diferenciación mínima**:
- Solo cambia `sesionNumero` y `modalidad` (distribuida aleatoriamente)
- El mismo `contenido` se pasa múltiples veces
- **NO hay instrucción** como "Esta es la clase 2 de 3 sobre Revolución Industrial, debes avanzar desde donde quedó la clase 1"

---

## 3. REQUERIMIENTOS DEL DOCENTE

### Dónde se Define en la UI

**Archivo**: `src/components/planificacion/WizardSteps.tsx` (líneas 841-856)

```typescript
{/* Requerimientos del Docente */}
<Card>
  <CardHeader>
    <CardTitle>Requerimientos del Docente para la Planificación</CardTitle>
  </CardHeader>
  <CardContent>
    <Textarea
      value={wizardData.enfoque?.requerimientos_docente || ''}
      onChange={(e) => updateWizardData('enfoque', {
        requerimientos_docente: value 
      })}
      placeholder="Ej: Priorizar trabajo en grupos, incluir actividades prácticas..."
    />
  </CardContent>
</Card>
```

**Respuesta**: Se define en el Paso 2 (Enfoque) del wizard, como un campo de texto libre.

### Dónde se Almacena

**Archivo**: `src/pages/PlanificacionWizard.tsx` (línea 366)

```typescript
requerimientos_docente: wizardData.enfoque.requerimientos_docente,
```

**Tabla**: `planificaciones.requerimientos_docente` (TEXT, nullable)

**Respuesta**: Se almacena en la tabla `planificaciones` como texto libre.

### Dónde se Inyecta en el Prompt de IA

**Respuesta**: **CASI NUNCA se inyecta**

**Evidencia**:

1. **En generación automática inicial**: **NO se pasa**
   - `src/pages/PlanificacionWorkspace.tsx` (línea 174): `instruccionesDocente: undefined`
   - `src/components/planificacion/EditorSesionNuevo.tsx` (línea 395): `instruccionesDocente: undefined`

2. **En regeneración manual**: **SÍ se pasa** (solo si el docente lo escribe manualmente)
   - `src/components/planificacion/EditorSesionTabs.tsx` (línea 432): `instruccionesDocente: instruccionesIA || undefined`
   - Pero `instruccionesIA` es un campo local del componente, NO `requerimientos_docente` de la planificación

3. **En `useFullSessionGeneration`**: **NO se pasa**
   - No hay referencia a `requerimientos_docente` en el hook

### ¿Se Pasa Verbatim a la IA?

**Respuesta**: **NO, porque casi nunca se pasa**

Cuando se pasa (solo en regeneración manual), sí se pasa verbatim en:
```typescript
${instruccionesDocente ? `\nINSTRUCCIONES DEL DOCENTE:\n${instruccionesDocente}` : ''}
```

### ¿Hay Parsing o Estructura Aplicada?

**Respuesta**: **NO**

- Se almacena como texto libre
- No hay parsing, validación, o estructura
- No se extraen keywords, temas, o requisitos estructurados

### ¿Puede Influir en Clases Individuales de Forma Diferente?

**Respuesta**: **NO**

- `requerimientos_docente` es un campo global de la planificación
- No hay forma de especificar requerimientos diferentes para clase 1 vs clase 2
- Si se pasara, se aplicaría igual a todas las clases

---

## 4. DATA MODEL FOR CLASSES

### ¿Las Clases Individuales son Entidades Explícitas?

**Respuesta**: **SÍ**

**Tabla**: `sesiones_clase` (definida en migración `20250923163758_...sql`)

```sql
CREATE TABLE public.sesiones_clase (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  planificacion_id UUID NOT NULL REFERENCES public.planificaciones(id),
  fecha DATE NOT NULL,
  duracion_minutos INTEGER NOT NULL DEFAULT 60,
  competencias_anep TEXT[] DEFAULT '{}',
  contenidos_anep TEXT[] DEFAULT '{}',
  criterios_logro_anep TEXT[] DEFAULT '{}',
  plan_desarrollo JSONB DEFAULT '{}',
  diferenciacion TEXT,
  evaluacion JSONB DEFAULT '{}',
  recursos TEXT[] DEFAULT '{}',
  observaciones TEXT,
  estado TEXT DEFAULT 'borrador',
  orden: number,  // ← Campo de orden
  // ...
);
```

**Cada clase es una fila explícita** con:
- ID único
- Fecha (o null para backlog)
- Contenido, competencias, plan de desarrollo
- Estado (backlog, planificada, dictada, omitida, pausada)

### ¿Son Solo Bloques Generados Repetidos?

**Respuesta**: **NO, son entidades explícitas, pero el contenido se genera de forma repetitiva**

- Las clases SÍ son entidades explícitas en la BD
- Pero el `plan_desarrollo` se genera de forma independiente para cada clase
- No hay relación explícita entre "clase 1 de unidad X" y "clase 2 de unidad X"

### Lógica del Workspace/Editor

**Archivo**: `src/pages/PlanificacionWorkspace.tsx` (líneas 810-826)

```typescript
{sesiones
  .filter(s => s.estado !== 'omitida')
  .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  .map((sesion) => (
    <div key={sesion.id}>
      {sesion.titulo || `Sesión ${sesion.orden}`}
    </div>
  ))}
```

**Respuesta**: 
- Las clases se renderizan ordenadas por `orden`
- Cada clase se edita independientemente
- No hay UI que muestre "Esta es la clase 2 de 3 de la unidad X"

### ¿El Sistema Podría Soportar Metadata por Clase sin Cambios en BD?

**Respuesta**: **PARCIALMENTE**

**Campos existentes que podrían usarse**:
- `titulo` (TEXT, nullable): podría almacenar "Clase 1: Introducción a Revolución Industrial"
- `observaciones` (TEXT, nullable): podría almacenar metadata
- `plan_desarrollo` (JSONB): podría incluir metadata estructurada

**Limitaciones**:
- No hay campo explícito para "unidad_id" o "clase_numero_en_unidad"
- No hay relación explícita entre clases de la misma unidad
- Se requeriría lógica adicional para mantener consistencia

**Respuesta final**: **SÍ, pero con limitaciones**. Se podría usar `titulo` o `observaciones` para metadata, pero no hay estructura que garantice consistencia.

---

## 5. GROUP PROFILES & CONTEXT

### ¿El Sistema Tiene Acceso a `grupo_id` Durante la Generación?

**Respuesta**: **SÍ, pero no se usa**

**Archivo**: `src/pages/PlanificacionWizard.tsx` (línea 356)

```typescript
grupo_id: wizardData.contexto.grupo_id,
```

**Archivo**: `src/hooks/useFullSessionGeneration.ts` (línea 52)

```typescript
grupoId: planificacion.grupo_id,
```

**Pero**: `grupoId` se pasa a `generateAIPlan` pero **NO se incluye en el prompt de IA**.

### ¿Se Tiene Acceso a Resúmenes de Perfil Grupal?

**Respuesta**: **NO**

**Evidencia**:
- No hay queries a tabla `grupos` durante la generación
- No se consulta `teacher_sugerencias` de grupos
- No se consulta perfil dominante del grupo

**Tabla `grupos` existe** (creada en migración `20251226174831_...sql`) pero **NO se usa** en generación de planes.

### ¿Se Tiene Acceso a Perfiles de Estudiantes?

**Respuesta**: **NO**

**Evidencia**:
- No hay queries a datos de estudiantes durante la generación
- El campo `estudiantes` en el prompt de `generate-plan-completo` existe pero **casi siempre es undefined**
- No se consulta `mockData.ts` ni ninguna tabla de estudiantes

**Archivo**: `supabase/functions/generate-plan-completo/index.ts` (línea 65)

```typescript
${estudiantes?.length ? `- Estudiantes con ajustes: ${estudiantes.filter(e => e.ajustes?.length).length}` : ''}
```

**Respuesta**: El prompt tiene soporte para estudiantes, pero **nunca se pasa** en la práctica.

### ¿Se Tiene Acceso a Diagnósticos u Observaciones?

**Respuesta**: **NO**

- No hay queries a diagnósticos
- No hay queries a observaciones pasadas
- No hay queries a evaluaciones previas del grupo

### ¿Se Tiene Acceso a Observaciones del Docente por Materia?

**Respuesta**: **NO**

- No hay queries a observaciones del docente
- No hay queries a anotaciones por grupo/materia
- El campo `requerimientos_docente` existe pero no se usa (ver sección 3)

### Resumen de Disponibilidad de Datos

| Dato | Dónde Vive | Cómo se Consulta | ¿Se Incluye en IA? |
|------|------------|------------------|-------------------|
| `grupo_id` | `planificaciones.grupo_id` | Ya disponible en planificación | ❌ NO |
| Perfil grupal | `grupos.teacher_sugerencias` | No se consulta | ❌ NO |
| Perfiles estudiantes | `mockData.ts` / (futuro: BD) | No se consulta | ❌ NO |
| Diagnósticos | No existe tabla | N/A | ❌ NO |
| Observaciones pasadas | No existe tabla | N/A | ❌ NO |
| `requerimientos_docente` | `planificaciones.requerimientos_docente` | Ya disponible | ❌ NO (casi nunca) |

---

## 6. LIMITATIONS & GAPS

### ¿Qué Falta para Generar una Secuencia de Enseñanza Real?

**Gaps Estructurales** (requieren cambios en BD o lógica):

1. **Falta relación explícita entre clases de la misma unidad**
   - No hay campo `unidad_id` en `sesiones_clase`
   - No hay campo `clase_numero_en_unidad`
   - No hay forma de agrupar clases por unidad

2. **Falta uso de `clases_estimadas`**
   - El campo existe pero no se usa para crear sesiones
   - No hay lógica que diga "crear 3 sesiones para esta unidad"

3. **Falta contexto de progresión**
   - No se pasa información de clases anteriores
   - No se pasa información de clases siguientes
   - No hay concepto de "avance" dentro de una unidad

4. **Falta metadata de secuencia**
   - No hay campo "tema de la clase" (ej: "Introducción", "Desarrollo", "Síntesis")
   - No hay campo "objetivo específico de esta clase"
   - No hay campo "prerequisitos" o "continuación de"

**Gaps a Nivel de Prompt** (se pueden resolver sin cambios en BD):

1. **Prompt no menciona secuencia**
   - No dice "Esta es la clase 2 de 3 sobre Revolución Industrial"
   - No dice "En la clase anterior se cubrió X, ahora avanzamos a Y"
   - No dice "Esta clase debe preparar para la siguiente que cubrirá Z"

2. **Prompt no incluye contexto grupal**
   - No incluye perfil dominante del grupo
   - No incluye sugerencias del docente para el grupo
   - No incluye requerimientos del docente (aunque existe el campo)

3. **Prompt no diferencia clases repetidas**
   - Si la misma unidad se repite 3 veces, el prompt es idéntico
   - No hay instrucción para variar o progresar

### ¿Qué Gaps son Estructurales vs Prompt-Level?

**Estructurales** (requieren cambios en BD o lógica):
- Relación clases ↔ unidades
- Uso de `clases_estimadas`
- Campos de metadata de secuencia
- Consulta de datos de grupo/estudiantes

**Prompt-Level** (se pueden resolver sin cambios en BD):
- Incluir `requerimientos_docente` en el prompt
- Incluir información de `grupo_id` (si se consulta)
- Agregar instrucciones sobre secuencia en el prompt
- Diferenciar clases repetidas con instrucciones específicas

### ¿Qué Gaps se Pueden Resolver sin Cambios en BD?

**Respuesta**: **Varios, pero con limitaciones**

1. **Incluir `requerimientos_docente` en prompt**
   - ✅ Ya existe el campo
   - ✅ Solo requiere pasar `planificacion.requerimientos_docente` al prompt
   - **Limitación**: Es global, no por clase

2. **Consultar y pasar datos de grupo**
   - ✅ Tabla `grupos` existe
   - ✅ `grupo_id` está disponible
   - ✅ Solo requiere query + incluir en prompt
   - **Limitación**: No hay datos de estudiantes en BD (solo mockData)

3. **Agregar instrucciones de secuencia en prompt**
   - ✅ Se puede calcular "clase X de Y" basado en rotación
   - ✅ Se puede incluir en el prompt sin cambios en BD
   - **Limitación**: No hay información real de clases anteriores (solo se puede inferir)

4. **Diferenciar clases repetidas**
   - ✅ Se puede agregar lógica: "Si es la segunda vez que aparece esta unidad, variar actividades"
   - ✅ Solo requiere lógica en el prompt
   - **Limitación**: Sin metadata real de progresión

---

## RESUMEN FINAL

### ¿Qué Podemos Hacer Ya?

1. ✅ **Generar planes de clase individuales** con estructura completa (Inicio/Desarrollo/Cierre)
2. ✅ **Rotar contenidos** de unidades didácticas a través de múltiples sesiones
3. ✅ **Distribuir modalidades** (individual/pareja/grupos/toda_clase) proporcionalmente
4. ✅ **Almacenar requerimientos del docente** (aunque no se usen)
5. ✅ **Identificar número de sesión global** (sesión 5 de 12)

### ¿Qué NO Podemos Hacer Aún?

1. ❌ **Generar secuencias reales de enseñanza** donde cada clase avanza desde la anterior
2. ❌ **Usar `clases_estimadas`** para crear sesiones específicas por unidad
3. ❌ **Diferenciar "clase 1 de unidad X" vs "clase 2 de unidad X"** (mismo contenido, diferente progresión)
4. ❌ **Incluir contexto grupal** (perfil, sugerencias, estudiantes) en la generación
5. ❌ **Incluir requerimientos del docente** en la generación automática
6. ❌ **Referenciar clases anteriores/siguientes** en el prompt
7. ❌ **Generar planes que preparen para la siguiente clase** o continúen desde la anterior

### ¿Cuál es la Razón Técnica Principal por la que las Clases se Duplican Hoy?

**Respuesta**: **Falta de concepto de secuencia dentro de unidades**

**Razón técnica específica**:

1. **Rotación sin progresión**: El sistema rota unidades mediante `Math.floor(index / Math.ceil(total / unidades.length))`, lo que hace que la misma unidad aparezca múltiples veces, pero **cada aparición genera un plan independiente** sin conocimiento de las apariciones anteriores.

2. **Prompt idéntico para contenido repetido**: Cuando la misma unidad se repite (ej: unidad "Revolución Industrial" en sesiones 1, 4, 7), el prompt es **prácticamente idéntico** excepto por `sesionNumero` y `modalidad`. No hay instrucción que diga "Esta es la segunda clase sobre este tema, debes avanzar desde la primera".

3. **Falta de metadata de secuencia**: No hay campos que identifiquen:
   - Qué unidad corresponde a cada clase
   - Qué número de clase es dentro de esa unidad (1, 2, 3...)
   - Qué se cubrió en clases anteriores de la misma unidad

4. **Generación independiente**: Cada clase se genera de forma **completamente independiente**, sin consultar planes anteriores ni considerar qué viene después.

**En resumen**: Las clases se "duplican" porque el sistema trata cada sesión como un evento aislado, no como parte de una secuencia didáctica progresiva dentro de una unidad.

---

## REFERENCIAS DE CÓDIGO

### Archivos Clave

- `src/pages/PlanificacionWizard.tsx`: Creación de planificación y sesiones iniciales
- `src/hooks/useFullSessionGeneration.ts`: Generación de planes para todas las sesiones
- `src/hooks/useCalendarioSesiones.ts`: Gestión de sesiones en calendario
- `supabase/functions/generate-plan-completo/index.ts`: Función edge que genera planes
- `supabase/functions/modify-evaluation/index.ts`: Función edge alternativa (tipo 'planning')
- `src/types/planificacion.ts`: Definiciones de tipos
- `src/components/planificacion/UnidadDidacticaBuilder.tsx`: UI para crear unidades
- `src/components/planificacion/WizardSteps.tsx`: UI del wizard (incluye requerimientos_docente)

### Funciones Clave

- `generarPlanesAutomaticamente()`: `src/pages/PlanificacionWizard.tsx:19`
- `generateAllSessions()`: `src/hooks/useFullSessionGeneration.ts:15`
- `generateAIPlan()`: `src/hooks/useFullSessionGeneration.ts:135`
- `extractCompetenciesFromUnits()`: `src/lib/competencyExtractor.ts:19`
- `extractContenidosFromUnits()`: `src/lib/competencyExtractor.ts:40`

---

**Fin del Reporte de Auditoría**














