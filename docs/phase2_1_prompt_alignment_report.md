# Phase 2.1: Prompt & Payload Alignment Report

**Fecha**: 26 de diciembre de 2024  
**Estado**: ✅ IMPLEMENTADO  
**Objetivo**: Alinear prompts entre ambos paths de generación y forzar títulos distintos y progresión didáctica clara

---

## Resumen Ejecutivo

Phase 2.1 cierra las brechas finales en la generación progresiva de clases:

1. ✅ **Path A (`modify-evaluation`) ahora usa `unitContext`** en el prompt
2. ✅ **Títulos distintos forzados** en ambos paths
3. ✅ **Comportamiento refinado** para clases intermedias y finales
4. ✅ **Clarificación de `isExtraSlot`** con instrucciones específicas
5. ✅ **Backward compatibility mantenida** (todo es opcional)

---

## Cambios Realizados

### 1. Path A: `modify-evaluation/index.ts`

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

#### 1.1 Extracción de `unitContext`

**Líneas**: ~224-231

```typescript
const { 
  originalEvaluation, 
  modification, 
  groupContext, 
  type = 'modification',
  adaptationLevel = 'standard',
  prompt: customPrompt,
  // PHASE 2.1: unitContext para generación progresiva (opcional para backward compatibility)
  unitContext
} = await req.json();
```

**Cambio**: Agregado `unitContext` a la extracción del request body.

#### 1.2 Construcción de Contexto de Secuencia

**Líneas**: ~284-314

**Antes**: No había contexto de secuencia didáctica.

**Después**: Se construye `sequenceContext` similar a `generate-plan-completo`:

```typescript
// PHASE 2.1: Construir contexto de secuencia didáctica si unitContext está presente
const sequenceContext = unitContext ? `
DIDACTIC SEQUENCE CONTEXT:
This class is part of a thematic unit called "${unitContext.contenido}".

- This is class ${unitContext.claseEnUnidad} of ${unitContext.totalClasesUnidad}.
- Content must be progressive and non-repetitive.
- Do NOT repeat explanations already covered in previous classes.
- If this is the first class, introduce the topic and its context.
- If this is a middle class, deepen and complexify the content.
- If this is the final class, prioritize synthesis, reflection, debate, or application.
${unitContext.isExtraSlot ? 'This is an additional session and may be used for review, assessment, or an integrative project.' : ''}

SPECIFIC INSTRUCTIONS BY CLASS POSITION:
${unitContext.claseEnUnidad === 1 ? '- This is the FIRST class: Focus on introduction, context setting, and initial exploration. The class title must reflect this introductory purpose and be different from other classes in the same unit.' : ''}
${unitContext.claseEnUnidad > 1 && unitContext.claseEnUnidad < unitContext.totalClasesUnidad ? `- This is a MIDDLE class (${unitContext.claseEnUnidad} of ${unitContext.totalClasesUnidad}): Begin with a brief activation of prior knowledge connecting to the previous class, without repeating long explanations. Deepen and complexify the content. Avoid introducing new core concepts. The class title must reflect this deepening focus and be different from other classes in the same unit.` : ''}
${unitContext.claseEnUnidad === unitContext.totalClasesUnidad && !unitContext.isExtraSlot ? '- This is the FINAL class: Avoid introducing new core concepts. Focus on integration, transfer, debate, or applied activities. The class title must reflect this synthesis/application purpose and be different from other classes in the same unit.' : ''}
${unitContext.isExtraSlot ? `- This is an ADDITIONAL class beyond the original sequence (class ${unitContext.claseEnUnidad} of ${unitContext.totalClasesUnidad}): Use it preferably for guided review, integrative activities, formative assessment, or an applied project. The class title should clearly reflect this purpose (e.g., "Integrative Review", "Applied Project", "Formative Assessment").` : ''}

` : '';
```

**Características**:
- ✅ Instrucciones específicas según posición (primera, intermedia, final)
- ✅ Forzado de títulos distintos
- ✅ Comportamiento específico para clases intermedias (activación breve, sin repetir)
- ✅ Comportamiento específico para clases finales (sin nuevos conceptos, integración)
- ✅ Clarificación de `isExtraSlot` con ejemplos de títulos

#### 1.3 Inyección en Prompt

**Líneas**: ~315-320

```typescript
userPrompt = `SOLICITUD DE PLANIFICACIÓN:
${modification}
${sequenceContext}
CONTEXTO ADICIONAL:
${groupContext?.additionalContext || 'No especificado'}

TAREA: Genera sugerencias didácticas específicas, prácticas y aplicables. Incluye actividades concretas, recursos necesarios y adaptaciones para diferentes estilos de aprendizaje.${unitContext ? '\n\nIMPORTANTE: El título de la clase debe reflejar el enfoque específico de esta sesión y debe ser diferente de otras clases en la misma unidad.' : ''}`;
```

**Cambio**: `sequenceContext` inyectado en el prompt, y recordatorio sobre títulos distintos si `unitContext` está presente.

---

### 2. Path B: `generate-plan-completo/index.ts`

**Archivo**: `supabase/functions/generate-plan-completo/index.ts`

#### 2.1 Mejora del Contexto de Secuencia

**Líneas**: ~56-75

**Antes**: Contexto básico sin instrucciones específicas por posición.

**Después**: Contexto expandido con instrucciones detalladas:

```typescript
// PHASE 2.1: Construir sección de contexto de secuencia didáctica si unitContext está presente
const secuenciaContext = unitContext ? `
CONTEXTO DE SECUENCIA DIDÁCTICA:
Esta clase forma parte de una unidad temática llamada "${unitContext.contenido}".

- Esta es la clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad} de esta unidad.
- El contenido debe ser progresivo y no repetitivo.
- No repitas explicaciones ya dadas en clases anteriores.
- El título de la clase debe reflejar el enfoque específico de esta sesión y debe ser diferente de otras clases en la misma unidad.

INSTRUCCIONES ESPECÍFICAS SEGÚN POSICIÓN:
${unitContext.claseEnUnidad === 1 ? '- Esta es la PRIMERA clase: Enfócate en introducción, contextualización y exploración inicial. El título debe reflejar este propósito introductorio.' : ''}
${unitContext.claseEnUnidad > 1 && unitContext.claseEnUnidad < unitContext.totalClasesUnidad ? `- Esta es una clase INTERMEDIA (${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Comienza con una breve activación de conocimientos previos conectando con la clase anterior, sin repetir explicaciones largas. Profundiza y complejiza el contenido. Evita introducir nuevos conceptos centrales. El título debe reflejar este enfoque de profundización.' : ''}
${unitContext.claseEnUnidad === unitContext.totalClasesUnidad && !unitContext.isExtraSlot ? '- Esta es la ÚLTIMA clase: Evita introducir nuevos conceptos centrales. Enfócate en integración, transferencia, debate o actividades aplicadas. El título debe reflejar este propósito de síntesis/aplicación.' : ''}
${unitContext.isExtraSlot ? `- Esta es una clase ADICIONAL más allá de la secuencia original (clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Úsala preferentemente para repaso guiado, actividades integradoras, evaluación formativa o un proyecto aplicado. El título debe reflejar claramente este propósito (ej: "Repaso Integrador", "Proyecto Aplicado", "Evaluación Formativa").` : ''}

` : '';
```

**Mejoras**:
- ✅ Instrucciones específicas por posición (primera, intermedia, final)
- ✅ Para clases intermedias: "Comienza con breve activación... sin repetir explicaciones largas"
- ✅ Para clases finales: "Evita introducir nuevos conceptos centrales"
- ✅ Clarificación de `isExtraSlot` con ejemplos de títulos

#### 2.2 Forzado de Títulos Distintos en Estructura

**Líneas**: ~100-102

**Antes**:
```typescript
<section id="plan">
  <h1>Planificación de Clase</h1>
```

**Después**:
```typescript
<section id="plan">
  <h1>Título específico y claro de esta clase (debe ser diferente de otras clases en la misma unidad)</h1>
```

**Cambio**: El ejemplo de estructura ahora muestra que el título debe ser específico y diferente.

#### 2.3 Requisito Explícito en REQUISITOS ESTRICTOS

**Líneas**: ~152-163

**Antes**: No había requisito explícito sobre títulos distintos.

**Después**:
```typescript
REQUISITOS ESTRICTOS:
1. Usar SOLO HTML válido - NO Markdown, NO code fences
2. NUNCA incluir "Diferenciación/Adaptaciones" dentro de las secciones Inicio, Desarrollo o Cierre
3. Incluir SIEMPRE: <strong>Actividad:</strong> y <strong>Recursos:</strong> en cada sección principal
4. Adaptar duraciones según el tiempo total (${duracionMin} min)
5. Incluir actividades específicas y detalladas
6. OBLIGATORIO: El título H1 debe ser específico y diferente de otras clases en la misma unidad. No reutilices títulos de otras clases.
7. OBLIGATORIO: Los títulos H2 de Inicio, Desarrollo y Cierre DEBEN tener <strong> dentro del H2
...
```

**Cambio**: Agregado requisito #6 explícito sobre títulos distintos.

---

## Comparación: Antes vs. Después

### Antes de Phase 2.1

**Path A (`modify-evaluation`)**:
- ❌ No usaba `unitContext` en el prompt
- ❌ No tenía contexto de secuencia didáctica
- ❌ No forzaba títulos distintos
- ❌ No tenía instrucciones específicas por posición

**Path B (`generate-plan-completo`)**:
- ✅ Tenía contexto básico de secuencia
- ❌ No forzaba títulos distintos explícitamente
- ❌ Instrucciones genéricas (no específicas por posición)
- ❌ No clarificaba `isExtraSlot` con ejemplos

**Resultado**: Clases podían tener títulos similares y progresión inconsistente.

### Después de Phase 2.1

**Path A (`modify-evaluation`)**:
- ✅ Usa `unitContext` en el prompt
- ✅ Tiene contexto completo de secuencia didáctica
- ✅ Fuerza títulos distintos
- ✅ Instrucciones específicas por posición (primera, intermedia, final)

**Path B (`generate-plan-completo`)**:
- ✅ Contexto mejorado de secuencia
- ✅ Fuerza títulos distintos (en estructura y requisitos)
- ✅ Instrucciones específicas por posición
- ✅ Clarifica `isExtraSlot` con ejemplos de títulos

**Resultado**: Ambos paths generan clases con:
- ✅ Títulos distintos y específicos
- ✅ Progresión didáctica clara
- ✅ Comportamiento consistente

---

## Flujo de Metadata Actualizado

### Path A (modify-evaluation)

```
useFullSessionGeneration.ts
  ↓
generateAIPlan({
  unitAssignment: assignment,
  requerimientosDocente: planificacion.requerimientos_docente
})
  ↓
unitContext construido desde unitAssignment
  ↓
Payload a modify-evaluation:
{
  type: 'planning',
  modification: "...",
  groupContext: {...},
  unitContext: {...}  // ← Incluido
}
  ↓
modify-evaluation/index.ts
  ↓
const { unitContext } = await req.json()  // ← Extraído
  ↓
sequenceContext construido con instrucciones específicas
  ↓
userPrompt incluye sequenceContext
  ↓
OpenAI API recibe contexto completo de secuencia
```

### Path B (generate-plan-completo)

```
PlanificacionWizard.tsx
  ↓
assignment = sessionAssignments[i]
  ↓
unitContext construido desde assignment
  ↓
Payload a generate-plan-completo:
{
  ...existingFields,
  unitContext: unitContext  // ← Incluido
}
  ↓
generate-plan-completo/index.ts
  ↓
const { unitContext } = await req.json()  // ← Extraído
  ↓
secuenciaContext construido con instrucciones específicas
  ↓
prompt incluye secuenciaContext
  ↓
OpenAI API recibe contexto completo de secuencia
```

---

## Ejemplos de Prompts Generados

### Ejemplo 1: Primera Clase de Unidad (3 clases)

**Prompt generado**:
```
SOLICITUD DE PLANIFICACIÓN:
Genera un plan de clase estructurado para la sesión 1 de 3:

MATERIA: Historia
CONTENIDO: Batllismo
...

DIDACTIC SEQUENCE CONTEXT:
This class is part of a thematic unit called "Batllismo".

- This is class 1 of 3.
- Content must be progressive and non-repetitive.
- Do NOT repeat explanations already covered in previous classes.
- If this is the first class, introduce the topic and its context.
- If this is a middle class, deepen and complexify the content.
- If this is the final class, prioritize synthesis, reflection, debate, or application.

SPECIFIC INSTRUCTIONS BY CLASS POSITION:
- This is the FIRST class: Focus on introduction, context setting, and initial exploration. The class title must reflect this introductory purpose and be different from other classes in the same unit.

TAREA: Genera sugerencias didácticas específicas...
IMPORTANTE: El título de la clase debe reflejar el enfoque específico de esta sesión y debe ser diferente de otras clases en la misma unidad.
```

**Título esperado**: "Introducción al Batllismo: Contexto Histórico y Primeras Reformas"

### Ejemplo 2: Clase Intermedia (Clase 2 de 3)

**Prompt generado**:
```
...

SPECIFIC INSTRUCTIONS BY CLASS POSITION:
- This is a MIDDLE class (2 of 3): Begin with a brief activation of prior knowledge connecting to the previous class, without repeating long explanations. Deepen and complexify the content. Avoid introducing new core concepts. The class title must reflect this deepening focus and be different from other classes in the same unit.
```

**Título esperado**: "Profundizando en el Batllismo: Reformas Sociales y Transformaciones"

### Ejemplo 3: Clase Final (Clase 3 de 3)

**Prompt generado**:
```
...

SPECIFIC INSTRUCTIONS BY CLASS POSITION:
- This is the FINAL class: Avoid introducing new core concepts. Focus on integration, transfer, debate, or applied activities. The class title must reflect this synthesis/application purpose and be different from other classes in the same unit.
```

**Título esperado**: "Síntesis del Batllismo: Debate y Aplicación de Conceptos"

### Ejemplo 4: Clase Adicional (isExtraSlot = true)

**Prompt generado**:
```
...

SPECIFIC INSTRUCTIONS BY CLASS POSITION:
- This is an ADDITIONAL class beyond the original sequence (class 4 of 3): Use it preferably for guided review, integrative activities, formative assessment, or an applied project. The class title should clearly reflect this purpose (e.g., "Integrative Review", "Applied Project", "Formative Assessment").
```

**Título esperado**: "Repaso Integrador del Batllismo" o "Proyecto Aplicado: Análisis del Legado Batllista"

---

## Verificación Manual

### Paso 1: Crear Planificación con Unidad de 3 Clases

1. Abrir wizard de planificación
2. Crear unidad didáctica:
   - Contenido: "Batllismo"
   - `clases_estimadas`: 3
3. Completar wizard y crear planificación

### Paso 2: Generar Planes Automáticamente

1. Esperar a que se generen los planes automáticamente
2. Verificar en console logs que `unitContext` se incluye en payloads

### Paso 3: Verificar Títulos Distintos

1. Abrir cada una de las 3 sesiones generadas
2. Verificar que cada una tiene un título H1 diferente:
   - ✅ Clase 1: Título introductorio (ej: "Introducción al Batllismo...")
   - ✅ Clase 2: Título de profundización (ej: "Profundizando en el Batllismo...")
   - ✅ Clase 3: Título de síntesis (ej: "Síntesis del Batllismo...")
3. Confirmar que NO hay títulos duplicados

### Paso 4: Verificar Progresión Didáctica

1. **Clase 1**:
   - ✅ Debe introducir el tema
   - ✅ Debe establecer contexto
   - ✅ No debe asumir conocimiento previo

2. **Clase 2**:
   - ✅ Debe comenzar con breve activación de conocimientos previos
   - ✅ Debe profundizar en el contenido
   - ✅ NO debe repetir explicaciones largas de la clase 1
   - ✅ NO debe introducir nuevos conceptos centrales

3. **Clase 3**:
   - ✅ NO debe introducir nuevos conceptos centrales
   - ✅ Debe enfocarse en síntesis, integración, debate o aplicación
   - ✅ Debe conectar todos los conceptos anteriores

### Paso 5: Verificar Comportamiento en Ambos Paths

**Path A (modify-evaluation)**:
- Usar `useFullSessionGeneration` (si está disponible en el flujo)
- Verificar que genera con progresión similar

**Path B (generate-plan-completo)**:
- Usar wizard normal (más común)
- Verificar que genera con progresión similar

**Resultado esperado**: Ambos paths producen el mismo comportamiento progresivo.

### Paso 6: Verificar Clase Adicional (Opcional)

1. Crear planificación con unidad de 2 clases pero 3 sesiones totales
2. Verificar que la sesión 3 (adicional) tiene:
   - ✅ Título que refleja propósito adicional (ej: "Repaso Integrador", "Proyecto Aplicado")
   - ✅ Contenido enfocado en repaso, evaluación o proyecto

---

## Criterios de Aceptación

✅ **Una unidad con 3 clases genera**:
- 3 clases con títulos claramente diferentes
- Progresión lógica (introducción → profundización → síntesis)
- No hay planes duplicados
- Comportamiento específico según posición

✅ **Comportamiento idéntico**:
- Desde planning wizard (Path B)
- Desde automatic generation flows (Path A)
- Ambos paths producen resultados consistentes

✅ **Sin cambios en UI**:
- UI permanece igual
- Solo cambios internos en prompts

✅ **Sin cambios en BD**:
- No hay migraciones
- No hay cambios en esquema

✅ **Compilación exitosa**:
- ✅ `npm run build` pasa sin errores
- ✅ No hay errores de TypeScript
- ✅ No hay errores de linting

---

## Archivos Modificados

1. **`supabase/functions/modify-evaluation/index.ts`**
   - Líneas ~224-231: Extracción de `unitContext`
   - Líneas ~284-320: Construcción de `sequenceContext` y actualización de prompt

2. **`supabase/functions/generate-plan-completo/index.ts`**
   - Líneas ~56-75: Mejora de `secuenciaContext` con instrucciones específicas
   - Líneas ~100-102: Actualización de ejemplo de estructura (título específico)
   - Líneas ~152-163: Agregado requisito explícito sobre títulos distintos

---

## Resumen de Mejoras

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Path A usa unitContext** | ❌ No | ✅ Sí |
| **Títulos distintos forzados** | ❌ No explícito | ✅ Sí (ambos paths) |
| **Instrucciones por posición** | ❌ Genéricas | ✅ Específicas (primera, intermedia, final) |
| **Clases intermedias** | ❌ Sin instrucción específica | ✅ "Breve activación, sin repetir" |
| **Clases finales** | ❌ Sin instrucción específica | ✅ "Sin nuevos conceptos, integración" |
| **isExtraSlot clarificado** | ❌ Vago | ✅ Con ejemplos de títulos |
| **Comportamiento consistente** | ❌ Diferente entre paths | ✅ Idéntico en ambos paths |

---

## Conclusión

Phase 2.1 completa la alineación de prompts entre ambos paths de generación. Ahora:

- ✅ Ambos paths usan `unitContext` para generación progresiva
- ✅ Títulos distintos están explícitamente forzados
- ✅ Comportamiento específico según posición de clase
- ✅ `isExtraSlot` clarificado con ejemplos
- ✅ Backward compatibility mantenida

**Resultado**: Generación progresiva, consistente y sin duplicación en ambos paths.

---

**Fin del Reporte - Phase 2.1 Implementado**




















