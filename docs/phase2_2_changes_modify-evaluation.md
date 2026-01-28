# Phase 2.2 Changes: modify-evaluation Planning Prompt

**File**: `supabase/functions/modify-evaluation/index.ts`  
**Date**: 26 de diciembre de 2024  
**Phase**: 2.2 Hardening

---

## Updated Planning Prompt Building Code

### 1. System Prompt Construction

**Location**: Lines 308-329

```typescript
// Planificación de clase con IA
systemPrompt = `Eres un experto en planificación didáctica y pedagogía. Tu tarea es crear sugerencias específicas y prácticas para planificación de clases, considerando diferentes estilos de aprendizaje y necesidades de adaptación curricular.

PRINCIPIOS PEDAGÓGICOS:
- Aprendizaje significativo y contextualizado
- Atención a la diversidad y estilos de aprendizaje
- Uso de metodologías activas y participativas
- Inclusión de evaluación formativa
- Recursos variados y accesibles

ESTRUCTURA DE CLASE ESPERADA:
- Apertura motivadora (15 min)
- Desarrollo principal (40 min) 
- Cierre y síntesis (5 min)

CONTEXTO ESPECÍFICO:
Materia: ${groupContext?.subject || 'No especificada'}
Contenidos: ${groupContext?.content?.join(', ') || 'No especificados'}
Perfil dominante: ${groupContext?.dominantProfile || 'Mixto'}
Objetivo: ${groupContext?.objective || 'No especificado'}
Estudiantes: ${groupContext?.students?.length || 0}
Grupo: ${groupContext?.groupName || 'Sin nombre'}`;
```

**Key Changes**:
- ✅ **ESTRUCTURA DE CLASE ESPERADA** updated from `15/45/20` to `15/40/5` (aligned with parser expectations)

---

### 2. Sequence Context Construction (Updated to Spanish)

**Location**: Lines 287-306

```typescript
// PHASE 2.2: Construir contexto de secuencia didáctica si unitContext está presente (en español)
const sequenceContext = unitContext ? `
CONTEXTO DE SECUENCIA DIDÁCTICA:
Esta clase forma parte de una unidad temática llamada "${unitContext.contenido}".

- Esta es la clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad} de esta unidad.
- El contenido debe ser progresivo y no repetitivo.
- No repitas explicaciones ya dadas en clases anteriores.
- No repitas explicaciones largas de clases previas; asume que la clase anterior introdujo los conceptos básicos.
${unitContext.claseEnUnidad === 1 ? '- Esta es la PRIMERA clase: Enfócate en introducción, contextualización y exploración inicial.' : ''}
${unitContext.claseEnUnidad > 1 && unitContext.claseEnUnidad < unitContext.totalClasesUnidad ? `- Esta es una clase INTERMEDIA (${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Comienza con una breve activación de conocimientos previos conectando con la clase anterior, sin repetir explicaciones largas. Profundiza y complejiza el contenido. Evita introducir nuevos conceptos centrales.` : ''}
${unitContext.claseEnUnidad === unitContext.totalClasesUnidad && !unitContext.isExtraSlot ? '- Esta es la ÚLTIMA clase: Evita introducir nuevos conceptos centrales. Enfócate en integración, transferencia, debate o actividades aplicadas.' : ''}
${unitContext.isExtraSlot ? `- Esta es una clase ADICIONAL más allá de la secuencia original (clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Úsala preferentemente para repaso guiado, actividades integradoras, evaluación formativa o un proyecto aplicado.` : ''}

` : '';
```

**Key Changes**:
- ✅ **Converted to Spanish** (consistent with rest of system and parser keys)
- ✅ **Added anti-duplication instruction**: "No repitas explicaciones largas de clases previas; asume que la clase anterior introdujo los conceptos básicos."
- ✅ **Removed title requirements** from sequence context (handled in output format rules)
- ✅ **Simplified instructions** (removed redundant English text)

---

### 3. User Prompt Construction (With Strict Output Rules)

**Location**: Lines 331-345

```typescript
userPrompt = `SOLICITUD DE PLANIFICACIÓN:
${modification}
${sequenceContext}
CONTEXTO ADICIONAL:
${groupContext?.additionalContext || 'No especificado'}

TAREA: Genera sugerencias didácticas específicas, prácticas y aplicables. Incluye actividades concretas, recursos necesarios y adaptaciones para diferentes estilos de aprendizaje.

FORMATO DE SALIDA OBLIGATORIO:
- La respuesta DEBE ser texto plano (NO HTML, NO Markdown, NO code fences).
- DEBE incluir exactamente una sección para cada encabezado, en este orden:
  * INICIO
  * DESARROLLO
  * CIERRE
- Cada sección DEBE incluir:
  * Actividad: (una o más oraciones describiendo la actividad)
  * Recursos: (lista separada por comas)
- NO incluyas otros encabezados de nivel superior.
- Los encabezados DEBEN estar en mayúsculas: INICIO, DESARROLLO, CIERRE.`;
```

**Key Changes**:
- ✅ **Added "FORMATO DE SALIDA OBLIGATORIO" section** with strict rules:
  - Must be plain text (no HTML, no Markdown, no code fences)
  - Must include exactly one section for each header (INICIO, DESARROLLO, CIERRE) in order
  - Each section must include "Actividad:" and "Recursos:"
  - No other top-level headers
  - Headers must be uppercase: INICIO, DESARROLLO, CIERRE
- ✅ **Removed title requirement** from user prompt (handled by output format rules)

---

## Complete Updated Prompt Structure

### When `unitContext` is Present

**System Message**:
```
Eres un experto en planificación didáctica y pedagogía. Tu tarea es crear sugerencias específicas y prácticas para planificación de clases, considerando diferentes estilos de aprendizaje y necesidades de adaptación curricular.

PRINCIPIOS PEDAGÓGICOS:
- Aprendizaje significativo y contextualizado
- Atención a la diversidad y estilos de aprendizaje
- Uso de metodologías activas y participativas
- Inclusión de evaluación formativa
- Recursos variados y accesibles

ESTRUCTURA DE CLASE ESPERADA:
- Apertura motivadora (15 min)
- Desarrollo principal (40 min) 
- Cierre y síntesis (5 min)

CONTEXTO ESPECÍFICO:
Materia: [from groupContext.subject]
Contenidos: [from groupContext.content]
Perfil dominante: [from groupContext.dominantProfile]
Objetivo: [from groupContext.objective]
Estudiantes: [from groupContext.students.length]
Grupo: [from groupContext.groupName]
```

**User Message**:
```
SOLICITUD DE PLANIFICACIÓN:
Genera un plan de clase estructurado para la sesión [X] de [Y]:

MATERIA: [materia]
CONTENIDO: [contenido]
MODALIDAD PRINCIPAL: [modalidad]
DURACIÓN: [duracionMinutos] minutos

Estructura necesaria:
- INICIO (15 min): Actividad de apertura motivadora
- DESARROLLO (40 min): Actividades principales adaptadas a modalidad [modalidad]
- CIERRE (5 min): Síntesis y reflexión

[If diferenciacion]: DIFERENCIACIÓN REQUERIDA: [diferenciacion]

[If requerimientosDocente]: INSTRUCCIONES DEL DOCENTE:
[requerimientosDocente]

Estas instrucciones pueden:
- Aplicar a toda la planificación
- Aplicar solo a algunas clases
- Indicar temas específicos para una clase puntual

Respeta explícitamente estas indicaciones si están presentes.
No inventes una secuencia distinta si el docente ya la definió.

Incluye diferenciación específica integrada en cada sección, recursos concretos y actividades detalladas.

CONTEXTO DE SECUENCIA DIDÁCTICA:
Esta clase forma parte de una unidad temática llamada "[unitContext.contenido]".

- Esta es la clase [unitContext.claseEnUnidad] de [unitContext.totalClasesUnidad] de esta unidad.
- El contenido debe ser progresivo y no repetitivo.
- No repitas explicaciones ya dadas en clases anteriores.
- No repitas explicaciones largas de clases previas; asume que la clase anterior introdujo los conceptos básicos.
[Specific instruction based on claseEnUnidad position]

CONTEXTO ADICIONAL:
[from groupContext.additionalContext]

TAREA: Genera sugerencias didácticas específicas, prácticas y aplicables. Incluye actividades concretas, recursos necesarios y adaptaciones para diferentes estilos de aprendizaje.

FORMATO DE SALIDA OBLIGATORIO:
- La respuesta DEBE ser texto plano (NO HTML, NO Markdown, NO code fences).
- DEBE incluir exactamente una sección para cada encabezado, en este orden:
  * INICIO
  * DESARROLLO
  * CIERRE
- Cada sección DEBE incluir:
  * Actividad: (una o más oraciones describiendo la actividad)
  * Recursos: (lista separada por comas)
- NO incluyas otros encabezados de nivel superior.
- Los encabezados DEBEN estar en mayúsculas: INICIO, DESARROLLO, CIERRE.
```

### When `unitContext` is NOT Present (Backward Compatibility)

**User Message** (without sequence context):
```
SOLICITUD DE PLANIFICACIÓN:
Genera un plan de clase estructurado para la sesión [X] de [Y]:

MATERIA: [materia]
CONTENIDO: [contenido]
MODALIDAD PRINCIPAL: [modalidad]
DURACIÓN: [duracionMinutos] minutos

Estructura necesaria:
- INICIO (15 min): Actividad de apertura motivadora
- DESARROLLO (40 min): Actividades principales adaptadas a modalidad [modalidad]
- CIERRE (5 min): Síntesis y reflexión

[If diferenciacion]: DIFERENCIACIÓN REQUERIDA: [diferenciacion]

[If requerimientosDocente]: INSTRUCCIONES DEL DOCENTE: ...

Incluye diferenciación específica integrada en cada sección, recursos concretos y actividades detalladas.

CONTEXTO ADICIONAL:
[from groupContext.additionalContext]

TAREA: Genera sugerencias didácticas específicas, prácticas y aplicables. Incluye actividades concretas, recursos necesarios y adaptaciones para diferentes estilos de aprendizaje.

FORMATO DE SALIDA OBLIGATORIO:
- La respuesta DEBE ser texto plano (NO HTML, NO Markdown, NO code fences).
- DEBE incluir exactamente una sección para cada encabezado, en este orden:
  * INICIO
  * DESARROLLO
  * CIERRE
- Cada sección DEBE incluir:
  * Actividad: (una o más oraciones describiendo la actividad)
  * Recursos: (lista separada por comas)
- NO incluyas otros encabezados de nivel superior.
- Los encabezados DEBEN estar en mayúsculas: INICIO, DESARROLLO, CIERRE.
```

**Key Observation**: Even without `unitContext`, the output format rules still enforce the INICIO/DESARROLLO/CIERRE structure.

---

## Summary of Changes

| Aspect | Before (Phase 2.1) | After (Phase 2.2) |
|--------|---------------------|-------------------|
| **Time structure** | 15/45/20 min | ✅ 15/40/5 min (aligned with parser) |
| **Sequence context language** | English | ✅ Spanish (consistent with system) |
| **Anti-duplication instruction** | Generic | ✅ Explicit: "No repitas explicaciones largas..." |
| **Output format rules** | None | ✅ Strict rules enforcing plain text + INICIO/DESARROLLO/CIERRE |
| **Title requirements** | In sequence context | ✅ Removed (handled by output format) |

---

## Expected Output Format

The model must return plain text with this exact structure:

```
INICIO
Actividad: [description]
Recursos: [comma-separated list]

DESARROLLO
Actividad: [description]
Recursos: [comma-separated list]

CIERRE
Actividad: [description]
Recursos: [comma-separated list]
```

This format is parseable by `parseAIResponseToPlan()` which expects uppercase headers INICIO, DESARROLLO, CIERRE.




















