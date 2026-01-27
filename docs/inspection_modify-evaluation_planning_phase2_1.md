# Inspection: modify-evaluation - Planning Path (Phase 2.1)

**File**: `supabase/functions/modify-evaluation/index.ts`  
**Date**: 26 de diciembre de 2024  
**Inspection Type**: READ-ONLY

---

## 1. Request Body Destructuring

**Location**: Lines 224-233

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

**Key Observations**:
- ✅ `unitContext` is extracted from request body
- ✅ It is optional (no default value, can be `undefined`)
- ✅ Backward compatibility maintained (old calls without `unitContext` still work)

---

## 2. Logic for Building Prompt When `type === 'planning'`

**Location**: Lines 286-337

### 2.1 Construction of `sequenceContext`

**Location**: Lines 287-306

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

**Key Observations**:
- ✅ `sequenceContext` is only built if `unitContext` is present
- ✅ Contains general progressive instructions
- ✅ Contains specific instructions based on class position (first, middle, final, extra)
- ✅ Explicitly enforces different titles for each class
- ✅ For middle classes: "Begin with brief activation... without repeating long explanations"
- ✅ For final classes: "Avoid introducing new core concepts"
- ✅ For extra slots: Provides example titles

### 2.2 System Prompt Construction

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
- Desarrollo principal (45 min) 
- Cierre y síntesis (20 min)

CONTEXTO ESPECÍFICO:
Materia: ${groupContext?.subject || 'No especificada'}
Contenidos: ${groupContext?.content?.join(', ') || 'No especificados'}
Perfil dominante: ${groupContext?.dominantProfile || 'Mixto'}
Objetivo: ${groupContext?.objective || 'No especificado'}
Estudiantes: ${groupContext?.students?.length || 0}
Grupo: ${groupContext?.groupName || 'Sin nombre'}`;
```

**Key Observations**:
- ✅ System prompt defines pedagogical principles
- ✅ Defines expected class structure
- ✅ Includes specific context from `groupContext`
- ✅ Does NOT include `unitContext` directly (it's in user prompt)

### 2.3 User Prompt Construction

**Location**: Lines 331-337

```typescript
userPrompt = `SOLICITUD DE PLANIFICACIÓN:
${modification}
${sequenceContext}
CONTEXTO ADICIONAL:
${groupContext?.additionalContext || 'No especificado'}

TAREA: Genera sugerencias didácticas específicas, prácticas y aplicables. Incluye actividades concretas, recursos necesarios y adaptaciones para diferentes estilos de aprendizaje.${unitContext ? '\n\nIMPORTANTE: El título de la clase debe reflejar el enfoque específico de esta sesión y debe ser diferente de otras clases en la misma unidad.' : ''}`;
```

**Key Observations**:
- ✅ `sequenceContext` is injected into user prompt
- ✅ If `unitContext` is present, adds explicit reminder about different titles
- ✅ `modification` contains the main request (includes content, materia, etc.)
- ✅ `groupContext?.additionalContext` provides additional context

---

## 3. Final Prompt String Sent to Model

**Location**: Lines 495-519

```typescript
const result = await retryWithBackoff(async () => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 4000,
    }),
  });
```

**Complete Prompt Structure**:

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
- Desarrollo principal (45 min) 
- Cierre y síntesis (20 min)

CONTEXTO ESPECÍFICO:
Materia: [from groupContext.subject]
Contenidos: [from groupContext.content]
Perfil dominante: [from groupContext.dominantProfile]
Objetivo: [from groupContext.objective]
Estudiantes: [from groupContext.students.length]
Grupo: [from groupContext.groupName]
```

**User Message** (when `unitContext` is present):
```
SOLICITUD DE PLANIFICACIÓN:
Genera un plan de clase estructurado para la sesión [X] de [Y]:

MATERIA: [materia]
CONTENIDO: [contenido]
MODALIDAD PRINCIPAL: [modalidad]
DURACIÓN: [duracionMinutos] minutos

DIDACTIC SEQUENCE CONTEXT:
This class is part of a thematic unit called "[contenido]".

- This is class [claseEnUnidad] of [totalClasesUnidad].
- Content must be progressive and non-repetitive.
- Do NOT repeat explanations already covered in previous classes.
- If this is the first class, introduce the topic and its context.
- If this is a middle class, deepen and complexify the content.
- If this is the final class, prioritize synthesis, reflection, debate, or application.
[If isExtraSlot: This is an additional session and may be used for review, assessment, or an integrative project.]

SPECIFIC INSTRUCTIONS BY CLASS POSITION:
[Specific instruction based on claseEnUnidad position]

CONTEXTO ADICIONAL:
[from groupContext.additionalContext]

TAREA: Genera sugerencias didácticas específicas, prácticas y aplicables. Incluye actividades concretas, recursos necesarios y adaptaciones para diferentes estilos de aprendizaje.

IMPORTANTE: El título de la clase debe reflejar el enfoque específico de esta sesión y debe ser diferente de otras clases en la misma unidad.
```

**User Message** (when `unitContext` is NOT present - backward compatibility):
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

CONTEXTO ADICIONAL:
[from groupContext.additionalContext]

TAREA: Genera sugerencias didácticas específicas, prácticas y aplicables. Incluye actividades concretas, recursos necesarios y adaptaciones para diferentes estilos de aprendizaje.
```

**Key Observations**:
- ✅ When `unitContext` is present: Full progressive context included
- ✅ When `unitContext` is absent: Falls back to basic structure (backward compatible)
- ✅ Model used: `gpt-4.1-2025-04-14` (line 490)
- ✅ Max tokens: 4000

---

## Summary

**Path A (`modify-evaluation`) for `type === 'planning'`**:
- ✅ Extracts `unitContext` from request body
- ✅ Builds `sequenceContext` with progressive instructions
- ✅ Includes specific instructions by class position
- ✅ Enforces different titles explicitly
- ✅ Maintains backward compatibility (works without `unitContext`)
- ✅ Sends complete prompt to OpenAI API with system and user messages



















