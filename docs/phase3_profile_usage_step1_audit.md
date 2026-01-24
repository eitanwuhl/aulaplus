# Phase 3 — Step 1: Audit of Group Profile Usage

**Fecha**: 27 de diciembre de 2024  
**Objetivo**: Identificar cómo se construye y utiliza actualmente el perfil de grupo y los ajustes de estudiantes en el flujo de generación de planes.

---

## Resumen Ejecutivo

### ✅ Datos Disponibles
- **Estructura de datos completa**: `Student`, `Group`, `InformeTecnico`, `TeacherSugerencias`
- **Campos ricos**: `perfil`, `ajustes`, `contemplaciones`, `ajustesProgramaticos`, `estiloAprendizaje`
- **Edge functions preparados**: `perfilGrupo` y `estudiantes` son parámetros aceptados

### ❌ Problema Actual
- **Frontend NO pasa datos de perfil**: `PlanificacionWizard.tsx` y `EditorSesionNuevo.tsx` NO incluyen `perfilGrupo` ni `estudiantes` en los payloads
- **Prompts ignoran detalles**: Los edge functions solo mencionan genéricamente el perfil ("Perfil: mixto") sin usar la información para decisiones pedagógicas concretas
- **Uso superficial**: Conteo de estudiantes sin serialización de ajustes individuales

---

## 1. Estructura de Datos Disponible

### 1.1 Interfaz `Student` (src/data/mockData.ts)

```typescript
export interface Student {
  id: number;
  name: string;
  perfil: string;                    // ej: "Visual-Kinestésico", "Auditivo-Lector/escritor"
  ajustes?: string;                  // ej: "Tiempo extendido, Contenido visual"
  progreso?: number;
  promedio?: number;
  tendencia?: 'up' | 'down' | 'stable';
  alertas?: string[];
  avatar: string;
  contemplaciones: string[];         // ej: ["Lectura oral de consignas", "Tiempo adicional y pausas"]
  anotaciones?: string;
  seguimiento?: string[];
  historialAcademico?: HistorialAcademico[];
  evaluacionesCualitativas?: EvaluacionCualitativa[];
  informeTecnico?: InformeTecnico;   // Informe psicopedagógico detallado
}
```

**Ubicación**: `src/data/mockData.ts` líneas 30-46

**Campos relevantes para personalización pedagógica:**
- `perfil`: Estilo de aprendizaje dominante
- `ajustes`: Resumen de ajustes necesarios
- `contemplaciones`: Lista de adaptaciones concretas (ej: "Palabras clave en negrita e íconos de apoyo")
- `informeTecnico`: Objeto con datos estructurados del equipo psicopedagógico

### 1.2 Interfaz `InformeTecnico` (src/data/mockData.ts)

```typescript
export interface InformeTecnico {
  sintesis: string;                              // Resumen ejecutivo del perfil
  estiloAprendizaje: string;                     // Descripción detallada del estilo
  objetivosPriorizados: string[];                // Objetivos pedagógicos específicos
  modalidadCursado: string;                      // ej: "Común con apoyos específicos"
  ajustesProgramaticos: {                        // Ajustes por materia
    materia: string;
    ajustes: string[];
  }[];
}
```

**Ubicación**: `src/data/mockData.ts` líneas 22-28

**Ejemplo real de datos:**
```typescript
informeTecnico: {
  sintesis: "Estudiante con perfil visual-kinestésico que requiere apoyos específicos para el manejo de la ansiedad evaluativa.",
  estiloAprendizaje: "Visual-Kinestésico: procesa mejor la información a través de imágenes, esquemas y actividades prácticas.",
  objetivosPriorizados: ["Reducir ansiedad evaluativa", "Fortalecer comprensión lectora", "Desarrollar autonomía"],
  modalidadCursado: "Común con apoyos específicos",
  ajustesProgramaticos: [
    { materia: "Todas", ajustes: ["Tiempo adicional", "Apoyos visuales", "Segmentación de consignas"] }
  ]
}
```

### 1.3 Interfaz `Group` (src/data/mockData.ts)

```typescript
export interface Group {
  id: string;
  name: string;
  studentCount: number;
  year: string;
  section: string;
  students: Student[];                    // Array de estudiantes con todos sus datos
  teacher_sugerencias?: TeacherSugerencias;  // Sugerencias personalizadas del docente
}
```

**Ubicación**: `src/data/mockData.ts` líneas 54-62

### 1.4 Interfaz `TeacherSugerencias` (src/data/mockData.ts)

```typescript
export interface TeacherSugerencias {
  aula?: string;          // Sugerencias para el aula (editable por docente)
  evaluaciones?: string;  // Sugerencias para evaluaciones (editable por docente)
  otras?: string;         // Otras sugerencias importantes
}
```

**Ubicación**: `src/data/mockData.ts` líneas 48-52

**Contexto**: Esta estructura se agregó en Phase anterior para permitir que los docentes editen y persistan sugerencias en el perfil de grupo (ver `docs/ux_group_profile_sugerencias_editable.md`).

---

## 2. Edge Functions: Parámetros Aceptados vs. Uso Real

### 2.1 `generate-plan-completo/index.ts`

**Parámetros aceptados** (líneas 38-56):

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
  perfilGrupo,        // ✅ DEFINIDO como parámetro
  estudiantes,        // ✅ DEFINIDO como parámetro
  instruccionesDocente,
  planActual,
  unitContext,
  sessionBrief
} = await req.json();
```

**Uso actual en el prompt** (líneas 114-115):

```typescript
${perfilGrupo ? `- Perfil del grupo: ${perfilGrupo.dominante || 'mixto'} (${perfilGrupo.tamanio || 'sin especificar'} estudiantes)` : ''}
${estudiantes?.length ? `- Estudiantes con ajustes: ${estudiantes.filter(e => e.ajustes?.length).length}` : ''}
```

**⚠️ Problemas identificados:**

1. **Uso genérico y superficial**: Solo se menciona el perfil dominante y un conteo de estudiantes con ajustes
2. **NO se serializan ajustes específicos**: La lista `contemplaciones` no se incluye
3. **NO se usa `informeTecnico`**: Los datos estructurados del equipo psicopedagógico se ignoran
4. **NO se usan `teacher_sugerencias`**: Las sugerencias editables del docente no se incluyen
5. **NO hay reglas pedagógicas explícitas**: El prompt no indica al AI cómo usar esta información activamente

### 2.2 `modify-evaluation/index.ts`

**Path: `type === 'planning'`** (líneas 288-361)

**Parámetros aceptados** (líneas 224-235):

```typescript
const { 
  originalEvaluation, 
  modification, 
  groupContext,       // ✅ Objeto con datos del grupo
  type = 'modification',
  adaptationLevel = 'standard',
  prompt: customPrompt,
  unitContext,
  sessionBrief
} = await req.json();
```

**Estructura esperada de `groupContext`** (inferida del código):

```typescript
groupContext: {
  subject: string,
  content: string[],
  competencies: string[],
  groupName: string,
  students?: Student[],           // ✅ Array completo de estudiantes
  dominantProfile?: string,
  objective?: string,
  additionalContext?: string
}
```

**Uso actual en el prompt** (líneas 334-339):

```typescript
SPECIFIC CONTEXT:
Subject: ${groupContext?.subject || 'Not specified'}
Contents: ${groupContext?.content?.join(', ') || 'Not specified'}
Dominant profile: ${groupContext?.dominantProfile || 'Mixed'}
Objective: ${groupContext?.objective || 'Not specified'}
Students: ${groupContext?.students?.length || 0}
Group: ${groupContext?.groupName || 'No name'}
```

**⚠️ Problemas identificados:**

1. **`students` se reduce a un conteo**: `groupContext?.students?.length || 0`
2. **NO se serializan `contemplaciones`**: Aunque `students` está disponible, no se extraen ni formatean las contemplaciones
3. **NO se serializa `informeTecnico`**: Datos estructurados del equipo psicopedagógico ignorados
4. **Perfil dominante genérico**: Solo se menciona `'Mixed'` sin detallar distribución de estilos

---

## 3. Frontend: ¿Se Pasan Estos Datos?

### 3.1 `PlanificacionWizard.tsx` → `generarPlanesAutomaticamente()`

**Payload enviado a `generate-plan-completo`** (líneas 380-395):

```typescript
const payload = {
  modo: 'generar_plan_html',
  sesionId: sesion.id,
  orden: sesion.orden,
  duracionMin: sesion.duracion_minutos,
  materia: materia || 'Sin especificar',
  nivel: nivel || 'Sin especificar',
  contenidos: contenidosSesion,
  competencias: competenciasSesion,
  criterios: criterios,
  instruccionesDocente: planificacion.requerimientos_docente || undefined,
  unitContext: unitContext,
  ...(sessionBrief?.trim() && { sessionBrief: sessionBrief.trim() })
};
```

**❌ Campos faltantes:**
- `perfilGrupo`: **NO se incluye**
- `estudiantes`: **NO se incluye**

**Ubicación**: `src/pages/PlanificacionWizard.tsx` líneas 380-395

### 3.2 `EditorSesionNuevo.tsx` → `handleGenerarPlanInicial()`

**Payload enviado a `generate-plan-completo`** (líneas 385-396):

```typescript
const payload = {
  modo: 'generar_plan_html',
  sesionId: sesion.id,
  orden: sesion.orden,
  duracionMin: sesion.duracion_minutos,
  materia: materia || 'Sin especificar',
  nivel: nivel || 'Sin especificar',
  contenidos: sesion.contenidos_anep || [],
  competencias: sesion.competencias_anep || [],
  criterios: sesion.criterios_logro_anep || [],
  instruccionesDocente: undefined
};
```

**❌ Campos faltantes:**
- `perfilGrupo`: **NO se incluye**
- `estudiantes`: **NO se incluye**
- `unitContext`: **NO se incluye**
- `sessionBrief`: **NO se incluye**

**Ubicación**: `src/components/planificacion/EditorSesionNuevo.tsx` líneas 385-396

### 3.3 `useFullSessionGeneration.ts` → `generateAIPlan()`

**Path**: `useFullSessionGeneration.ts` → `modify-evaluation` (type: 'planning')

**Payload enviado a `modify-evaluation`** (líneas 262-295):

```typescript
const { data, error } = await supabase.functions.invoke('modify-evaluation', {
  body: {
    type: 'planning',
    modification: `Generate a structured lesson plan...`,
    groupContext: {
      subject: params.materia,
      content: [params.contenido],
      competencies: params.competencias,
      groupName: params.grupoId,
      additionalContext: `Modalidad: ${params.modalidad}, Sesión ${params.sesionNumero}/${params.totalSesiones}`
    },
    ...(unitContext && { unitContext }),
    ...(params.sessionBrief?.trim() && { sessionBrief: params.sessionBrief.trim() })
  }
});
```

**❌ Campos faltantes en `groupContext`:**
- `students`: **NO se incluye**
- `dominantProfile`: **NO se incluye**
- `objective`: **NO se incluye**

**Ubicación**: `src/hooks/useFullSessionGeneration.ts` líneas 262-295

**Nota**: Este path (Path A) se usa desde el editor de sesiones individuales, NO desde el wizard de planificación completa.

---

## 4. ¿Dónde Vive la Información de Grupo en el Frontend?

### 4.1 Componente `GroupProfile`

**Ubicación**: `src/components/GroupProfile.tsx`

**Props recibidas**:

```typescript
interface GroupProfileProps {
  group: Group;  // ✅ Contiene students completo con ajustes, contemplaciones, informeTecnico
  onBack: () => void;
  onStudentClick: (student: Student) => void;
}
```

**Funcionalidad**:
- Muestra estadísticas de estilos de aprendizaje del grupo (líneas 61-78)
- Calcula distribución de estilos: Visual, Kinestésico, Auditivo, Lector/escritor
- Permite editar y persistir `teacher_sugerencias` en Supabase (tabla `grupos`)
- Muestra lista de estudiantes con sus perfiles y ajustes

**⚠️ Problema**: Este componente tiene TODA la información de grupo, pero NO está conectado con el flujo de planificación.

### 4.2 Página `TeacherGroups`

**Ubicación**: `src/pages/TeacherGroups.tsx`

**Funcionalidad**:
- Lista de grupos del docente (mockGroups por ahora)
- Navegación a `GroupProfile` para ver detalles
- Conversión de `MockGroup` a `Group` para pasar a `GroupProfile`

**⚠️ Problema**: NO hay conexión entre la vista de grupos y el wizard de planificación.

### 4.3 Hook `useAIPlanification`

**Ubicación**: `src/hooks/useAIPlanification.ts`

**Interfaz**:

```typescript
export interface AIPlanificationProps {
  subject: string;
  content: string[];
  groupName: string;
  students: Student[];        // ✅ Recibe array completo de estudiantes
  dominantProfile: string;
  objective?: string;
}
```

**Payload enviado a `modify-evaluation`** (líneas 39-62):

```typescript
const adaptations = props.students
  .filter(s => s.contemplaciones && s.contemplaciones.length > 0)
  .map(s => `${s.name}: ${s.contemplaciones.join(', ')}`)
  .join('\n');

const context = `
PLANIFICACIÓN DE CLASE - CONTEXTO:
- Materia: ${props.subject}
- Contenidos: ${props.content.join(', ')}
- Grupo: ${props.groupName}
- Estudiantes: ${props.students.length}
- Perfil dominante: ${props.dominantProfile}
- Objetivo: ${props.objective || 'No especificado'}

ESTUDIANTES CON ADAPTACIONES:
${adaptations || 'Ninguno con adaptaciones específicas'}
`;

const { data, error } = await supabase.functions.invoke('modify-evaluation', {
  body: {
    type: 'planning',
    modification: `Genera un plan de clase detallado...`,
    groupContext: {
      subject: props.subject,
      content: props.content,
      groupName: props.groupName,
      students: props.students,       // ✅ Pasa array completo
      dominantProfile: props.dominantProfile,
      objective: props.objective,
      additionalContext: context
    }
  }
});
```

**✅ Buenas prácticas identificadas**:
- Serializa `contemplaciones` de estudiantes en `additionalContext`
- Pasa array completo de `students` en `groupContext`
- Incluye `dominantProfile`

**⚠️ Problema**: Este hook NO se usa en el wizard principal (`PlanificacionWizard.tsx`) ni en el editor de sesiones (`EditorSesionNuevo.tsx`).

---

## 5. Resumen de Hallazgos

### ✅ Datos Disponibles pero NO Utilizados

| Campo | Disponible en | Pasado a Edge Function | Usado en Prompt |
|-------|---------------|------------------------|-----------------|
| `Student.perfil` | ✅ mockData | ❌ NO | ❌ NO |
| `Student.ajustes` | ✅ mockData | ❌ NO | ❌ NO |
| `Student.contemplaciones` | ✅ mockData | ❌ NO | ❌ NO |
| `Student.informeTecnico` | ✅ mockData | ❌ NO | ❌ NO |
| `InformeTecnico.estiloAprendizaje` | ✅ mockData | ❌ NO | ❌ NO |
| `InformeTecnico.ajustesProgramaticos` | ✅ mockData | ❌ NO | ❌ NO |
| `Group.teacher_sugerencias` | ✅ mockData + DB | ❌ NO | ❌ NO |
| `perfilGrupo` (agregado) | ❌ NO construido en frontend | ❌ NO | ⚠️ Superficial |
| `estudiantes` (array) | ❌ NO pasado desde frontend | ❌ NO | ⚠️ Solo count |

### 🔧 Wiring Necesario (Minimal)

1. **En `PlanificacionWizard.tsx`**:
   - Obtener `grupo_id` de `wizardData.contexto.grupo_id`
   - Fetch datos de grupo desde Supabase (tabla `grupos`) o mockData
   - Construir objeto `perfilGrupo` con estadísticas de estilos
   - Construir array `estudiantes` con campos relevantes: `name`, `perfil`, `ajustes`, `contemplaciones`
   - Incluir en payload a `generate-plan-completo`

2. **En `EditorSesionNuevo.tsx`**:
   - Recibir `grupo_id` como prop adicional (desde `planificaciones.grupo_id`)
   - Fetch datos de grupo
   - Incluir `perfilGrupo` y `estudiantes` en payload

3. **En `useFullSessionGeneration.ts`**:
   - Recibir `perfilGrupo` y `estudiantes` como parámetros en `generateAIPlan()`
   - Incluir en `groupContext` del payload a `modify-evaluation`

### 🎯 Prompt Enrichment Necesario

#### En `generate-plan-completo/index.ts` (Path B - HTML)

**Agregar nueva sección antes de `ESTRUCTURA OBLIGATORIA`**:

```typescript
// NUEVO: Sección de perfil de grupo y ajustes
const groupProfileSection = perfilGrupo || estudiantes?.length ? `

GROUP PROFILE AND STUDENT ADJUSTMENTS:
${perfilGrupo ? `
Group Composition:
- Total students: ${perfilGrupo.tamanio || 'not specified'}
- Dominant learning style: ${perfilGrupo.dominante || 'mixed'}
- Learning style distribution:
${perfilGrupo.distribucion ? Object.entries(perfilGrupo.distribucion).map(([estilo, count]) => `  * ${estilo}: ${count} students`).join('\n') : '  * Not specified'}
` : ''}
${estudiantes?.length ? `
Students with Specific Adjustments (${estudiantes.filter(e => e.ajustes || e.contemplaciones?.length).length}):
${estudiantes
  .filter(e => e.ajustes || e.contemplaciones?.length)
  .map((e, idx) => `
  Student ${String.fromCharCode(65 + idx)} (${e.perfil || 'Not specified'}):
  - Adjustments: ${e.ajustes || 'None specified'}
  ${e.contemplaciones?.length ? `- Specific accommodations:
${e.contemplaciones.map(c => `    * ${c}`).join('\n')}` : ''}
`).join('\n')}
` : ''}

MANDATORY PEDAGOGICAL RULES (ACTIVE USE):
Rule A — Evidence Inside Activities:
- The DESARROLLO section MUST include at LEAST TWO explicit pedagogical decisions derived from the group profile or student adjustments.
- Example: "Visual students: activity divided into two 7-minute blocks with step-by-step visual checklist"
- Example: "Kinesthetic students: manipulative materials for exploring the concept"
- Avoid generic phrases like "consider learning styles" — decisions must be CONCRETE and OBSERVABLE.

Rule B — Student Adjustments:
${estudiantes?.filter(e => e.contemplaciones?.length).length ? `- Since ${estudiantes.filter(e => e.contemplaciones?.length).length} students have specific accommodations, the "Diferenciación/Adaptaciones" section MUST include at LEAST THREE concrete, actionable adaptations.
- Each adaptation MUST specify:
  * <strong>Momento:</strong> Exact moment (Inicio/Desarrollo/Cierre + specific activity)
  * <strong>Perfil/Necesidad:</strong> Which student profile or need it addresses
  * <strong>Propósito:</strong> What it facilitates or improves
  * <strong>Cómo aplicarla:</strong> Concrete, practical instructions (not vague)
- DO NOT invent diagnoses or conditions. Use language: supports, scaffolding, access, representation options, expression options.
` : '- Since no students have specific accommodations, include at least ONE general UDL-based adaptation in "Diferenciación/Adaptaciones".'}

Rule C — No Stereotypes or Invented Diagnoses:
- DO NOT invent diagnoses, conditions, or labels not present in student data.
- Use respectful, UDL-aligned language: supports, scaffolding, multiple means of representation/expression/engagement.
- If group profile is mixed or information is limited, apply basic UDL principles without assuming deficits.

Rule D — Do Not Force Content:
- If NO group profile AND NO student adjustments exist, DO NOT add artificial personalization.
- Maintain backward compatibility: output identical to previous behavior.

` : '';
```

**Integrar en prompt principal** (después de `sessionBriefSection`):

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
${secuenciaContext}${sessionBriefSection}${groupProfileSection}${instruccionesDocenteSection}${planActual ? `\nPLAN ACTUAL A MODIFICAR:\n${planActual}` : ''}

ESTRUCTURA OBLIGATORIA - DEVOLVER SOLO HTML VÁLIDO:
...
```

#### En `modify-evaluation/index.ts` (Path A - Plain Text)

**Agregar nueva sección en `type === 'planning'`**:

```typescript
// NUEVO: Sección de perfil de grupo y ajustes (Path A - Plain Text)
const groupProfileSectionText = groupContext?.students?.length || groupContext?.dominantProfile ? `

GROUP PROFILE AND STUDENT ADJUSTMENTS:
${groupContext.dominantProfile ? `- Dominant learning style: ${groupContext.dominantProfile}` : ''}
${groupContext.students?.length ? `- Total students: ${groupContext.students.length}
- Students with specific adjustments: ${groupContext.students.filter(s => s.contemplaciones?.length || s.ajustes).length}
${groupContext.students
  .filter(s => s.contemplaciones?.length || s.ajustes)
  .slice(0, 5)  // Limit to 5 for brevity in plain text path
  .map((s, idx) => `
  Student ${String.fromCharCode(65 + idx)} (${s.perfil || 'Not specified'}):
  - Adjustments: ${s.ajustes || 'None'}
  ${s.contemplaciones?.length ? `- Accommodations: ${s.contemplaciones.join('; ')}` : ''}
`).join('\n')}
` : ''}

MANDATORY PEDAGOGICAL RULES (ACTIVE USE):
Rule A — Evidence Inside Activities:
- Each section (INICIO, DESARROLLO, CIERRE) MUST include at least ONE explicit pedagogical decision derived from group profile or student adjustments.
- Example in INICIO: "Actividad: Visual opener using color-coded cards for 5 minutes..."
- Example in DESARROLLO: "Actividad: Group work with assigned roles (auditory learners lead discussion, kinesthetic learners manipulate materials)..."
- Avoid generic phrases — decisions must be CONCRETE and OBSERVABLE inside "Actividad:" text.

Rule B — Student Adjustments:
${groupContext?.students?.filter(s => s.contemplaciones?.length).length ? `- Since ${groupContext.students.filter(s => s.contemplaciones?.length).length} students have specific accommodations, embed at LEAST TWO concrete adaptations directly into "Actividad:" descriptions (do NOT create new sections).
- Use language: supports, scaffolding, access options, multiple representations.
` : '- Include at least ONE UDL-based support embedded in DESARROLLO activities.'}

Rule C — No Stereotypes:
- DO NOT invent diagnoses. Use respectful language: supports, scaffolding, options.

Rule D — Do Not Force:
- If NO profile and NO adjustments exist, output remains identical to previous behavior.

` : '';
```

**Integrar en userPrompt** (después de `sequenceContext`):

```typescript
userPrompt = `PLANNING REQUEST:
${modification}
${sequenceContext}${sessionBriefSection}${groupProfileSectionText}ADDITIONAL CONTEXT:
${groupContext?.additionalContext || 'Not specified'}

TASK: Generate specific, practical, and applicable didactic suggestions. Include concrete activities, necessary resources, and adaptations for different learning styles.

MANDATORY OUTPUT FORMAT:
...
```

---

## 6. Campos que Existen pero NO se Usan

### En Edge Functions (aceptados pero ignorados)

- `perfilGrupo.distribucion` (distribución detallada de estilos)
- `perfilGrupo.dominante` (mencionado genéricamente sin consecuencias pedagógicas)
- `estudiantes[].perfil` (individual, no serializado)
- `estudiantes[].contemplaciones` (array de adaptaciones concretas, NO usado)
- `estudiantes[].informeTecnico` (informe psicopedagógico completo, NO usado)
- `teacher_sugerencias` (sugerencias editables del docente, NO pasado ni usado)

### En Frontend (disponibles pero no pasados)

- Todos los datos de `Group` y `Student` disponibles en `GroupProfile`
- `teacher_sugerencias` editables y persistidas en DB (tabla `grupos`)
- Estadísticas de estilos de aprendizaje calculadas en `GroupProfile.getLearningstyleStats()`

---

## 7. Recomendaciones para Phase 3

### 7.1 Minimal Wiring (Frontend)

**Prioridad 1**: `PlanificacionWizard.tsx`

1. Agregar fetch de datos de grupo desde `wizardData.contexto.grupo_id`
2. Construir objeto `perfilGrupo`:
   ```typescript
   {
     tamanio: number,
     dominante: string,  // ej: "Visual" (el más frecuente)
     distribucion: { [estilo: string]: number }  // ej: { "Visual": 5, "Kinestésico": 3 }
   }
   ```
3. Construir array `estudiantes` con solo campos necesarios:
   ```typescript
   {
     perfil: string,
     ajustes?: string,
     contemplaciones?: string[]
   }
   ```
4. Incluir en payload línea 380+

**Prioridad 2**: `EditorSesionNuevo.tsx`

1. Recibir `grupo_id` como prop
2. Fetch y construir `perfilGrupo` y `estudiantes`
3. Incluir en payload línea 385+

**Prioridad 3**: `useFullSessionGeneration.ts`

1. Recibir `perfilGrupo` y `estudiantes` en params de `generateAIPlan()`
2. Incluir en `groupContext` línea 284+

### 7.2 Prompt Enrichment (Edge Functions)

**generate-plan-completo/index.ts**:
- Agregar sección `GROUP PROFILE AND STUDENT ADJUSTMENTS` (ver sección 5)
- Agregar `MANDATORY PEDAGOGICAL RULES` con Rules A/B/C/D
- Integrar después de `sessionBriefSection` en prompt principal

**modify-evaluation/index.ts**:
- Agregar sección equivalente para path `type === 'planning'`
- Adaptar formato a salida plain text (sin HTML)

### 7.3 Backward Compatibility

✅ **Preservada**:
- Si `perfilGrupo` es undefined → sección no se agrega
- Si `estudiantes` es undefined o vacío → sección no se agrega
- Output format NO cambia (HTML para Path B, plain text para Path A)
- Payload schemas públicos NO cambian (campos nuevos son opcionales)

---

## 8. Ejemplos de Uso Activo (Target Output)

### Path B (HTML) - Ejemplo de actividad con decisión explícita

**Antes** (genérico):
```html
<p><strong>Actividad:</strong> Los estudiantes trabajan en grupos para analizar el tema.</p>
```

**Después** (decisión explícita basada en perfil):
```html
<p><strong>Actividad:</strong> Los estudiantes trabajan en grupos heterogéneos de 4 integrantes. 
Los estudiantes visuales reciben un organizador gráfico con íconos de colores para mapear conceptos clave. 
Los estudiantes kinestésicos manipulan tarjetas móviles para ordenar secuencias cronológicas. 
Duración: 15 minutos con pausa de movimiento a los 7 minutos.</p>
```

### Path A (Plain Text) - Ejemplo de adaptación integrada

**Antes** (genérico):
```
Actividad: Lectura de texto y preguntas de comprensión.
Recursos: Fotocopia del texto.
```

**Después** (adaptación integrada):
```
Actividad: Lectura guiada del texto con apoyo de imágenes proyectadas. Consignas leídas en voz alta por el docente. 
Estudiantes con necesidad de tiempo adicional reciben texto con palabras clave resaltadas en negrita. 
Preguntas de comprensión con opción de respuesta oral para estudiantes con dificultades de escritura.
Recursos: Proyector, fotocopias con palabras clave resaltadas, timer visible.
```

---

## Conclusión

**Estado actual**: Los datos de perfil de grupo y ajustes de estudiantes están **disponibles pero no se utilizan activamente**. Los edge functions tienen parámetros preparados pero los prompts solo mencionan esta información de forma superficial.

**Gap principal**: **Wiring faltante** entre el componente `GroupProfile` (que tiene todos los datos) y el wizard de planificación / editor de sesiones.

**Próximo paso**: Implementar minimal wiring en frontend (Step 3) y enriquecer prompts en edge functions (Step 2) según las especificaciones de este audit.












