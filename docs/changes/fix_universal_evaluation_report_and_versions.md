# Fix Universal Evaluation Report and Versions

**Fecha**: 2026-02-01  
**Objetivo**: Corregir tres problemas visibles en evaluaciones recién generadas (no legacy)

---

## Problemas Identificados

### Problema 1: UI muestra "AI report is not available..." después de generar y guardar
**Síntoma**: Después de generar una evaluación nueva y guardarla, al abrirla en la página de detalle, aparece el mensaje de fallback indicando que el reporte de IA no está disponible.

### Problema 2: Versión A no incluye opciones de respuesta equivalentes metacognitivas
**Síntoma**: La Versión A generada no incluye las opciones equivalentes de formato de respuesta (múltiples formas de responder la misma consigna) cuando debería hacerlo según las contemplaciones del grupo.

### Problema 3: Diego Martinez no recibe Versión C (adaptación de contenido)
**Síntoma**: El estudiante Diego Martinez, que requiere adaptación de contenido, no está recibiendo una versión distinta adaptada (Versión C).

---

## Análisis de Causas Raíz

### Problema 1: AI Report No Disponible

#### Evidencia del Flujo de Datos

**1. Edge Function Response** (`supabase/functions/modify-evaluation/index.ts`)

```776:776:supabase/functions/modify-evaluation/index.ts
        aiReport,  // REQUIREMENT 2: Siempre presente, nunca null
```

**Confirmación**: El edge function SIEMPRE retorna `aiReport` (nunca null) en la ruta `generation_mode === 'universal'` (líneas 696-756). El objeto `aiReport` se construye con fallback completo si OpenAI no lo genera.

**2. UI Guarda el Reporte** (`src/pages/EvaluacionesGrupo.tsx`)

```983:990:src/pages/EvaluacionesGrupo.tsx
      // PATCH 6: Leer data.aiReport primero, luego legacy aiDesignReport
      if (data?.aiReport) {
        setAiDesignReport(JSON.stringify(data.aiReport));
      } else if (data?.aiDesignReport) {
        setAiDesignReport(JSON.stringify(data.aiDesignReport));
      } else {
        setAiDesignReport(null);
      }
```

**Problema identificado**: El código lee `data?.aiReport` correctamente, pero hay un problema en el guardado:

```562:577:src/pages/EvaluacionesGrupo.tsx
        evaluacion_generada: {
          evaluaciones: displayEvaluations,
          base_prototype: basePrototype,
          // PHASE 6: Time budgeting + AI Design Report
          targetDurationMinutes,
          estimatedDurationMinutes,
          timeBreakdown,
          aiDesignReport: aiDesignReport ? JSON.parse(aiDesignReport) : null,
          ai_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,
          evaluation_bundle: evaluationBundle,
          evaluation_design_plan: evaluationDesignPlan,
          student_assignments: studentAssignments,
          teacher_reminders_by_student: teacherReminders
        },
        // PHASE C: Persist AI design report in DB column
        ai_design_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,
```

**Causa raíz**: 
- `aiDesignReport` es un string JSON (se guarda con `JSON.stringify` en línea 985)
- Al guardar, se hace `JSON.parse(aiDesignReport)` dos veces (líneas 569 y 570)
- Si `aiDesignReport` es `null`, se guarda `null` en ambos campos
- **PERO**: El edge function SIEMPRE retorna `aiReport`, así que el problema está en que `data?.aiReport` puede no estar presente si la respuesta no viene del path `generation_mode === 'universal'`

**Verificación del path de generación**:

```856:898:src/pages/EvaluacionesGrupo.tsx
      const effectivePlan = generationContext
        ? {
            ...plan,
            triggers: { versionB: false, versionC: false },
            assignmentByStudentId: Object.fromEntries(
              groupContextData.students.map(student => [String(student.studentId), 'A'])
            ),
            versionPlans: [
              {
                kind: 'A',
                label: 'Versión A (Universal)',
                assignedStudentIds: groupContextData.students.map(student => student.studentId),
                reason: 'Modo sesiones/materiales: versión única'
              }
            ],
            contentAdaptationStudentIds: []
          }
        : plan;

      const requestBody: any = {
        originalEvaluation: basePrototype || generatePrototipo(selectedSubtemas, requerimientos, 1),
        modification: requerimientos || 'Genera una evaluación escrita universal basada en los contenidos seleccionados.',
        groupContext,
        type: 'modification'
      };

      if (generationContext) {
        const { serializeGenerationContext } = await import('@/services/evaluations');
        requestBody.generation_context = serializeGenerationContext(generationContext);
      } else {
        requestBody.generation_mode = 'universal';
        requestBody.evaluation_design_plan = {
          instrumentDesignRules,
          responseOptions: effectivePlan.responseOptions,
          triggers: effectivePlan.triggers,
          assignmentByStudentId: effectivePlan.assignmentByStudentId,
          perStudentReminders: effectivePlan.perStudentReminders,
          varkDistribution: effectivePlan.varkDistribution,
          highStructureNeed: effectivePlan.highStructureNeed,
          designComplexityCount: effectivePlan.designComplexityCount,
          bucketedContemplacionIds: effectivePlan.bucketedContemplacionIds
        };
      }
```

**Problema crítico**: 
- Si `generationContext` existe (modo sesiones/materiales), NO se envía `generation_mode: 'universal'`
- El edge function procesa esto en el path `generation_context` (líneas 245-480), que retorna `aiDesignReport` (no `aiReport`)
- La UI busca `data?.aiReport` primero (línea 984), pero en el path de `generation_context` el campo se llama `aiDesignReport` (línea 471)

**3. UI Lee el Reporte** (`src/pages/EvaluacionDetalle.tsx`)

```210:211:src/pages/EvaluacionDetalle.tsx
  // PATCH: Leer ai_report primero desde evaluacion_generada, luego desde ai_design_report
  const aiReportPayload = evaluacion.evaluacion_generada?.ai_report || evaluacion.ai_design_report || null;
```

**Confirmación**: La lectura es correcta, pero si ambos campos son `null`, muestra el fallback.

**Causa raíz final**: 
- En modo `generation_context`, el edge function retorna `aiDesignReport` (línea 471), pero la UI busca `data?.aiReport` primero (línea 984)
- Si no encuentra `aiReport`, busca `aiDesignReport` (línea 986), pero si el guardado falló, ambos serán `null`

---

### Problema 2: Versión A Sin Opciones de Respuesta Equivalentes

#### Evidencia del Flujo

**1. Decisión de Incluir Opciones** (`src/services/evaluations/designPlan.ts`)

```275:293:src/services/evaluations/designPlan.ts
  const teacherRequest = detectTeacherRequestedOptions(input.teacherRequirementsText);
  const hasStructuringNeeds = students.some(student =>
    student.contemplacionesEvaluaciones
      .map(normalizeContemplacionId)
      .some(id => STRUCTURE_NEED_CONTEMPLACIONES.has(id))
  );

  const responseTriggers: string[] = [];
  if (hasStructuringNeeds) responseTriggers.push('Necesidades de estructuración/plantillas');
  if (vkRatio >= 0.5) responseTriggers.push('Predominio V+K');
  if (nonRRatio >= 0.5) responseTriggers.push('Mayoría no-R');
  if (teacherRequest.requested) responseTriggers.push('Pedido explícito docente');

  const includeOptions = responseTriggers.length > 0;
  let optionCount: 1 | 2 | 3 = includeOptions ? 2 : 1;

  if (includeOptions && (designComplexityCount >= 6 || teacherRequest.requestedOptionCount === 3)) {
    optionCount = 3;
  }
```

**Confirmación**: La lógica determina `responseOptions.include` y `responseOptions.optionCount` correctamente.

**2. Envío al Edge Function** (`src/pages/EvaluacionesGrupo.tsx`)

```886:897:src/pages/EvaluacionesGrupo.tsx
        requestBody.generation_mode = 'universal';
        requestBody.evaluation_design_plan = {
          instrumentDesignRules,
          responseOptions: effectivePlan.responseOptions,
          triggers: effectivePlan.triggers,
          assignmentByStudentId: effectivePlan.assignmentByStudentId,
          perStudentReminders: effectivePlan.perStudentReminders,
          varkDistribution: effectivePlan.varkDistribution,
          highStructureNeed: effectivePlan.highStructureNeed,
          designComplexityCount: effectivePlan.designComplexityCount,
          bucketedContemplacionIds: effectivePlan.bucketedContemplacionIds
        };
```

**Confirmación**: `responseOptions` se envía correctamente en `evaluation_design_plan`.

**3. Prompt en Edge Function** (`supabase/functions/modify-evaluation/index.ts`)

```498:532:supabase/functions/modify-evaluation/index.ts
      const responseOptions = designPlan.responseOptions || {};
      const responseOptionsInclude = responseOptions.include === true;
      const responseOptionCount = [2, 3].includes(responseOptions.optionCount)
        ? responseOptions.optionCount
        : 2;
      const generateVersionB = designPlan.triggers?.versionB === true;
      const generateVersionC = designPlan.triggers?.versionC === true;
      
      const systemPrompt = `Eres un especialista en evaluación educativa. Tu tarea es generar una evaluación escrita universal, lista para entregar.

REGLAS CRÍTICAS (NO NEGOCIABLES):
1. Evidencia SIEMPRE escrita. Prohibido generar tareas "solo orales".
2. NO inferir diagnósticos ni necesidades desde narrativas. Usa SOLO datos estructurados.
3. CE/CL son definidos por el docente: NO inventar ni inferir nuevos criterios.
4. No incluir explicaciones meta ni razonamientos de IA.
5. HTML válido, renderizable. NO usar Markdown. NO usar <img>.

FORMATO:
- Usa <strong> para títulos y secciones
- Evita múltiples <br> consecutivos
- Incluye puntajes por ítem cuando aplique

RESPUESTAS CON OPCIONES EQUIVALENTES:
${responseOptionsInclude ? `
- OBLIGATORIO Y CRÍTICO: Cada consigna que requiera respuesta escrita DEBE incluir EXACTAMENTE ${responseOptionCount} opciones equivalentes de formato.
- Formato requerido (copiar exactamente): "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
- Ejemplo de opciones (incluir en cada consigna relevante):
  * Opción 1: Respuesta escrita tradicional (párrafo)
  * Opción 2: Respuesta estructurada (lista con viñetas o tabla)
  ${responseOptionCount === 3 ? '  * Opción 3: Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
- Las opciones DEBEN aparecer INMEDIATAMENTE después de cada consigna relevante, dentro del mismo ítem.
- NO omitir las opciones. Si no las incluyes, la evaluación será incompleta.
` : `
- NO incluir opciones equivalentes de respuesta.
`}
```

**Problema identificado**: 
- El prompt es correcto y estricto
- **PERO**: El prompt solo se aplica cuando `generation_mode === 'universal'` (línea 483)
- Si se usa `generation_context` (modo sesiones/materiales), el prompt es diferente (líneas 298-332) y **NO incluye instrucciones sobre opciones equivalentes**

**Causa raíz**: 
- En modo `generation_context`, el sistema no envía `responseOptions` al prompt
- El prompt de `generation_context` no tiene sección sobre opciones equivalentes
- Por lo tanto, la Versión A generada en modo sesiones/materiales nunca incluirá opciones equivalentes, incluso si `responseOptions.include === true`

---

### Problema 3: Diego Martinez No Recibe Versión C

#### Evidencia del Flujo

**1. Detección de Adaptación de Contenido** (`src/services/groupContext/provider.ts`)

```173:214:src/services/groupContext/provider.ts
function checkContentAdaptation(student: Student): {
  hasDeclaredContentAdaptation: boolean;
  declaredContentAdaptationSource: 'informe_tecnico' | 'docente' | null;
  declaredContentAdaptationNotes?: string | null;
} {
  // Check localStorage first (teacher override - highest priority)
  try {
    const key = `adecuacionContenido:${student.id}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const value = JSON.parse(stored);
      if (value === true) {
        return {
          hasDeclaredContentAdaptation: true,
          declaredContentAdaptationSource: 'docente',
          declaredContentAdaptationNotes: 'Marcado explícitamente por docente'
        };
      }
    }
  } catch {
    // Fall through to informeTecnico check
  }
  
  // Check informeTecnico (formal declaration)
  if (student.informeTecnico?.requiereAdecuacionContenido === true) {
    const notes = student.informeTecnico.ajustesProgramaticos
      ?.map(aj => `${aj.materia}: ${aj.ajustes.join(', ')}`)
      .join('; ') || null;
    
    return {
      hasDeclaredContentAdaptation: true,
      declaredContentAdaptationSource: 'informe_tecnico',
      declaredContentAdaptationNotes: notes || undefined
    };
  }
  
  // No explicit declaration found
  return {
    hasDeclaredContentAdaptation: false,
    declaredContentAdaptationSource: null
  };
}
```

**Confirmación**: La función detecta correctamente estudiantes con adaptación de contenido.

**2. Plan de Diseño** (`src/services/evaluations/designPlan.ts`)

```216:236:src/services/evaluations/designPlan.ts
  const contentAdaptationStudentIds = students
    .filter(student => student.hasDeclaredContentAdaptation)
    .map(student => String(student.studentId));
  const versionCTriggered = contentAdaptationStudentIds.length > 0;

  const assignmentByStudentId: Record<string, EvaluationVersionKind> = {};
  for (const student of students) {
    assignmentByStudentId[String(student.studentId)] = 'A';
  }

  if (versionBTriggered) {
    for (const student of qualifyingStudents) {
      assignmentByStudentId[String(student.studentId)] = 'B';
    }
  }

  if (versionCTriggered) {
    for (const studentId of contentAdaptationStudentIds) {
      assignmentByStudentId[studentId] = 'C';
    }
  }
```

**Confirmación**: Si Diego tiene `hasDeclaredContentAdaptation === true`, debería estar en `contentAdaptationStudentIds` y asignado a versión C.

**3. Override en Modo Sesiones/Materiales** (`src/pages/EvaluacionesGrupo.tsx`)

```856:872:src/pages/EvaluacionesGrupo.tsx
      const effectivePlan = generationContext
        ? {
            ...plan,
            triggers: { versionB: false, versionC: false },
            assignmentByStudentId: Object.fromEntries(
              groupContextData.students.map(student => [String(student.studentId), 'A'])
            ),
            versionPlans: [
              {
                kind: 'A',
                label: 'Versión A (Universal)',
                assignedStudentIds: groupContextData.students.map(student => student.studentId),
                reason: 'Modo sesiones/materiales: versión única'
              }
            ],
            contentAdaptationStudentIds: []
          }
        : plan;
```

**Causa raíz identificada**: 
- Si `generationContext` existe (modo sesiones/materiales), se **fuerza** `triggers.versionC = false` (línea 859)
- Se **fuerza** `contentAdaptationStudentIds = []` (línea 871)
- Se **fuerza** todas las asignaciones a 'A' (líneas 860-862)
- **Por lo tanto, Diego nunca recibirá versión C si se genera en modo sesiones/materiales**

**4. Generación de Versión C en Edge Function** (`supabase/functions/modify-evaluation/index.ts`)

```504:598:supabase/functions/modify-evaluation/index.ts
      const generateVersionC = designPlan.triggers?.versionC === true;
      
      const systemPrompt = `Eres un especialista en evaluación educativa. Tu tarea es generar una evaluación escrita universal, lista para entregar.

REGLAS CRÍTICAS (NO NEGOCIABLES):
1. Evidencia SIEMPRE escrita. Prohibido generar tareas "solo orales".
2. NO inferir diagnósticos ni necesidades desde narrativas. Usa SOLO datos estructurados.
3. CE/CL son definidos por el docente: NO inventar ni inferir nuevos criterios.
4. No incluir explicaciones meta ni razonamientos de IA.
5. HTML válido, renderizable. NO usar Markdown. NO usar <img>.

FORMATO:
- Usa <strong> para títulos y secciones
- Evita múltiples <br> consecutivos
- Incluye puntajes por ítem cuando aplique

RESPUESTAS CON OPCIONES EQUIVALENTES:
${responseOptionsInclude ? `
- OBLIGATORIO Y CRÍTICO: Cada consigna que requiera respuesta escrita DEBE incluir EXACTAMENTE ${responseOptionCount} opciones equivalentes de formato.
- Formato requerido (copiar exactamente): "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
- Ejemplo de opciones (incluir en cada consigna relevante):
  * Opción 1: Respuesta escrita tradicional (párrafo)
  * Opción 2: Respuesta estructurada (lista con viñetas o tabla)
  ${responseOptionCount === 3 ? '  * Opción 3: Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
- Las opciones DEBEN aparecer INMEDIATAMENTE después de cada consigna relevante, dentro del mismo ítem.
- NO omitir las opciones. Si no las incluyes, la evaluación será incompleta.
` : `
- NO incluir opciones equivalentes de respuesta.
`}

SALIDA OBLIGATORIA (JSON):
{
  "versions": { 
    "A": "<html>...</html>", 
    ${generateVersionB ? '"B": "<html>...</html>",' : '"B": null,'}
    ${generateVersionC ? '"C": "<html>...</html>",' : '"C": null,'}
  },
  "response_options_included": ${responseOptionsInclude},
  "response_option_count": ${responseOptionCount},
  "ai_report": {
    "versions": { "generated": [${generateVersionB && generateVersionC ? '"A","B","C"' : generateVersionB ? '"A","B"' : generateVersionC ? '"A","C"' : '"A"'}], "reason": "..." },
    "contemplaciones": {
      "instrument_design": ["..."],
      "admin_reminders": ["..."],
      "correction_reminders": ["..."]
    },
    "response_options": { "included": ${responseOptionsInclude}, "optionCount": ${responseOptionCount}, "rationale": "..." },
    "vark": { "summary": "..." },
    "assignments": { "rationale": "..." },
    "warnings": ["..."]
  }
}

REGLAS CRÍTICAS PARA VERSIONES:
${generateVersionB ? '- La versión B DEBE estar presente en "versions.B" (no null). Si no la generas, la respuesta será inválida.' : ''}
${generateVersionC ? '- La versión C DEBE estar presente en "versions.C" (no null). Si no la generas, la respuesta será inválida.' : ''}
${!generateVersionB && !generateVersionC ? '- Solo generar versión A. No incluir B ni C.' : ''}`;

      const userPrompt = `CONTEXTO DEL GRUPO:
Materia: ${groupContext?.subject || 'No especificada'}
Contenidos: ${groupContext?.content?.join(', ') || 'No especificados'}
Competencias (si provistas por docente): ${groupContext?.competencies?.join(', ') || 'No provistas'}
Criterios de logro (si provistos por docente): ${groupContext?.criteriosLogro?.join(', ') || 'No provistos'}

REQUERIMIENTOS DOCENTE:
${modification || 'No hay requerimientos adicionales'}

REGLAS DE DISEÑO DEL INSTRUMENTO (determinísticas, no omitir):
${instrumentDesignRules.length ? instrumentDesignRules.map((rule: string) => `- ${rule}`).join('\n') : '- (Sin reglas adicionales)'}

DETALLE DEL PLAN (NO INVENTAR DATOS):
- Complejidad de diseño: ${designComplexityCount}
- Necesidad de estructura (resumen): ${highStructureNeed.percent ?? 0}% del grupo
- VARK distribución: ${JSON.stringify(varkDistribution)}
- Contemplaciones por bucket: ${JSON.stringify(bucketedContemplacionIds)}

OPCIONES DE RESPUESTA:
- Incluir opciones equivalentes: ${responseOptionsInclude ? 'Sí' : 'No'}
- Cantidad de opciones por consigna (si aplica): ${responseOptionCount}

VERSIONES:
${generateVersionB ? `
- OBLIGATORIO: Generar versión B equivalente (solo cambia formato, misma evidencia).
- La versión B debe ser funcionalmente equivalente a la A pero con formato diferente.
- Si no generas versión B, la evaluación será incompleta.
` : `
- NO generar versión B.
`}
${generateVersionC ? `
- OBLIGATORIO: Generar versión C con adecuación de contenido (solo para estudiantes explícitos).
- La versión C debe adaptar el contenido manteniendo los objetivos de aprendizaje.
- Si no generas versión C, la evaluación será incompleta.
` : `
- NO generar versión C.
`}

TAREA:
1. Genera la versión base (A) universal. ${generateVersionB ? 'OBLIGATORIO: También genera versión B.' : ''} ${generateVersionC ? 'OBLIGATORIO: También genera versión C.' : ''}
2. ${generateVersionB ? 'Versión B: equivalente en formato, misma evidencia.' : 'No generar versión B.'}
3. ${generateVersionC ? 'Versión C: adecuación de contenido para estudiantes específicos.' : 'No generar versión C.'}
4. Devuelve únicamente el JSON solicitado con TODAS las versiones requeridas.
5. En ai_report usa lenguaje docente simple (sin jerga técnica) y NO incluyas nombres de estudiantes.`;
```

**Confirmación**: Si `generateVersionC === true`, el prompt instruye generar versión C. Pero si el plan tiene `triggers.versionC = false`, nunca se generará.

**Causa raíz final**: 
- En modo `generation_context`, se fuerza `triggers.versionC = false`, por lo que Diego nunca recibirá versión C
- Incluso en modo `universal`, si Diego no está correctamente marcado en `hasDeclaredContentAdaptation`, no se generará versión C

---

## Plan de Parche Mínimo

### Parche 1: Corregir Lectura de AI Report en Modo generation_context

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Líneas**: 983-990

**Cambio**:
```typescript
// ANTES:
      // PATCH 6: Leer data.aiReport primero, luego legacy aiDesignReport
      if (data?.aiReport) {
        setAiDesignReport(JSON.stringify(data.aiReport));
      } else if (data?.aiDesignReport) {
        setAiDesignReport(JSON.stringify(data.aiDesignReport));
      } else {
        setAiDesignReport(null);
      }

// DESPUÉS:
      // PATCH 6: Leer data.aiReport primero, luego legacy aiDesignReport
      // En modo generation_context, el campo se llama aiDesignReport
      if (data?.aiReport) {
        setAiDesignReport(JSON.stringify(data.aiReport));
      } else if (data?.aiDesignReport) {
        setAiDesignReport(JSON.stringify(data.aiDesignReport));
      } else {
        // Fallback: construir aiReport mínimo desde datos disponibles
        const fallbackReport = {
          versions: {
            generated: ['A'],
            reason: 'Versión única generada'
          },
          contemplaciones: {
            instrument_design: [],
            admin_reminders: [],
            correction_reminders: []
          },
          response_options: {
            included: false,
            optionCount: 1,
            rationale: 'No se incluyeron opciones equivalentes de respuesta.'
          },
          vark: {
            summary: 'Distribución VARK no disponible'
          },
          assignments: {
            rationale: 'Asignaciones determinadas por contemplaciones y necesidades del grupo.'
          },
          warnings: []
        };
        setAiDesignReport(JSON.stringify(fallbackReport));
      }
```

**Alternativa más robusta**: También corregir el edge function para que siempre retorne `aiReport` (no `aiDesignReport`) en modo `generation_context`.

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 464-479

**Cambio**:
```typescript
// ANTES:
      return new Response(JSON.stringify({
        success: true,
        content: parsed.evaluationHTML || '',
        type: type,
        // PHASE 6b fields
        estimatedTotalMinutes: parsed.estimatedTotalMinutes,
        timeBreakdown: parsed.timeBreakdown,
        aiDesignReport: parsed.aiDesignReport,
        wasTimeRefined,
        metadata: {
          tokensUsed: result.usage?.total_tokens || 0,
          model: result.model || 'gpt-4.1-2025-04-14'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

// DESPUÉS:
      // Construir aiReport desde aiDesignReport si existe, o crear fallback
      const aiReport = parsed.aiDesignReport ? {
        ...parsed.aiDesignReport,
        versions: {
          generated: ['A'],
          reason: parsed.aiDesignReport.versions?.reason || 'Versión única generada desde sesiones/materiales'
        }
      } : {
        versions: {
          generated: ['A'],
          reason: 'Versión única generada desde sesiones/materiales'
        },
        contemplaciones: {
          instrument_design: [],
          admin_reminders: [],
          correction_reminders: []
        },
        response_options: {
          included: false,
          optionCount: 1,
          rationale: 'No se incluyeron opciones equivalentes de respuesta.'
        },
        vark: {
          summary: 'Distribución VARK no disponible'
        },
        assignments: {
          rationale: 'Asignaciones determinadas por contemplaciones y necesidades del grupo.'
        },
        warnings: []
      };

      return new Response(JSON.stringify({
        success: true,
        content: parsed.evaluationHTML || '',
        type: type,
        // PHASE 6b fields
        estimatedTotalMinutes: parsed.estimatedTotalMinutes,
        timeBreakdown: parsed.timeBreakdown,
        aiReport,  // ← Cambiar de aiDesignReport a aiReport
        wasTimeRefined,
        metadata: {
          tokensUsed: result.usage?.total_tokens || 0,
          model: result.model || 'gpt-4.1-2025-04-14'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
```

---

### Parche 2: Incluir Opciones Equivalentes en Modo generation_context

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 297-332

**Cambio**:
```typescript
// ANTES:
      const systemPrompt = `Eres un experto en evaluación educativa. Tu tarea es generar una evaluación basada en:
1. Sesiones de clase específicas (con sus contenidos, objetivos, actividades)
2. Materiales docentes adjuntos
3. Enfoque evaluativo del docente
4. Presupuesto de tiempo

FORMATO DE RESPUESTA REQUERIDO (JSON):
Debes devolver un objeto JSON con la siguiente estructura:
{
  "evaluationHTML": "<html>...</html>",
  "estimatedTotalMinutes": 75,
  "timeBreakdown": [
    {"itemType": "multiple_choice", "estimatedMinutes": 20, "description": "10 preguntas de opción múltiple"},
    {"itemType": "short_answer", "estimatedMinutes": 25, "description": "5 preguntas de respuesta corta"},
    {"itemType": "essay", "estimatedMinutes": 30, "description": "1 pregunta de desarrollo"}
  ],
  "aiDesignReport": {
    "rationale": "Esta evaluación integra las 3 sesiones trabajadas...",
    "coverageMapping": [
      {"sessionId": "uuid-123", "sessionTitle": "Sesión 1", "sectionsIncluded": ["Sección I", "Sección II"]}
    ],
    "materialsUsage": [
      {"materialId": "mat-456", "materialTitle": "Material X", "usageDescription": "Utilizado en pregunta 3..."}
    ],
    "adaptationNotes": "Las contemplaciones se aplicaron diferenciadamente..."
  }
}

REGLAS CRÍTICAS:
1. El HTML debe ser válido y renderizable
2. estimatedTotalMinutes debe ser la suma de timeBreakdown
3. aiDesignReport.coverageMapping debe mapear cada sesión a secciones específicas de la evaluación
4. aiDesignReport NO debe incluir recomendaciones por estudiante (eso va en casillas separadas)
5. Si hay timeBudget, intenta que estimatedTotalMinutes <= targetMinutes`;

// DESPUÉS:
      // Extraer responseOptions del generation_context si está disponible
      const responseOptionsFromContext = generation_context?.responseOptions || {};
      const responseOptionsInclude = responseOptionsFromContext.include === true;
      const responseOptionCount = [2, 3].includes(responseOptionsFromContext.optionCount)
        ? responseOptionsFromContext.optionCount
        : 2;

      const systemPrompt = `Eres un experto en evaluación educativa. Tu tarea es generar una evaluación basada en:
1. Sesiones de clase específicas (con sus contenidos, objetivos, actividades)
2. Materiales docentes adjuntos
3. Enfoque evaluativo del docente
4. Presupuesto de tiempo

FORMATO DE RESPUESTA REQUERIDO (JSON):
Debes devolver un objeto JSON con la siguiente estructura:
{
  "evaluationHTML": "<html>...</html>",
  "estimatedTotalMinutes": 75,
  "timeBreakdown": [
    {"itemType": "multiple_choice", "estimatedMinutes": 20, "description": "10 preguntas de opción múltiple"},
    {"itemType": "short_answer", "estimatedMinutes": 25, "description": "5 preguntas de respuesta corta"},
    {"itemType": "essay", "estimatedMinutes": 30, "description": "1 pregunta de desarrollo"}
  ],
  "aiDesignReport": {
    "rationale": "Esta evaluación integra las 3 sesiones trabajadas...",
    "coverageMapping": [
      {"sessionId": "uuid-123", "sessionTitle": "Sesión 1", "sectionsIncluded": ["Sección I", "Sección II"]}
    ],
    "materialsUsage": [
      {"materialId": "mat-456", "materialTitle": "Material X", "usageDescription": "Utilizado en pregunta 3..."}
    ],
    "adaptationNotes": "Las contemplaciones se aplicaron diferenciadamente..."
  }
}

REGLAS CRÍTICAS:
1. El HTML debe ser válido y renderizable
2. estimatedTotalMinutes debe ser la suma de timeBreakdown
3. aiDesignReport.coverageMapping debe mapear cada sesión a secciones específicas de la evaluación
4. aiDesignReport NO debe incluir recomendaciones por estudiante (eso va en casillas separadas)
5. Si hay timeBudget, intenta que estimatedTotalMinutes <= targetMinutes

RESPUESTAS CON OPCIONES EQUIVALENTES:
${responseOptionsInclude ? `
- OBLIGATORIO Y CRÍTICO: Cada consigna que requiera respuesta escrita DEBE incluir EXACTAMENTE ${responseOptionCount} opciones equivalentes de formato.
- Formato requerido (copiar exactamente): "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
- Ejemplo de opciones (incluir en cada consigna relevante):
  * Opción 1: Respuesta escrita tradicional (párrafo)
  * Opción 2: Respuesta estructurada (lista con viñetas o tabla)
  ${responseOptionCount === 3 ? '  * Opción 3: Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
- Las opciones DEBEN aparecer INMEDIATAMENTE después de cada consigna relevante, dentro del mismo ítem.
- NO omitir las opciones. Si no las incluyes, la evaluación será incompleta.
` : `
- NO incluir opciones equivalentes de respuesta.
`}`;
```

**Adicional**: Incluir `responseOptions` en `generation_context` cuando se serializa.

**Archivo**: `src/services/evaluations/index.ts` (o donde se serializa `generation_context`)

**Cambio**: Asegurar que `responseOptions` del plan se incluya en `generation_context` al serializar.

---

### Parche 3: Permitir Versión C en Modo generation_context (Opcional)

**Nota**: Este parche es opcional porque el modo `generation_context` está diseñado para generar una versión única. Sin embargo, si se requiere versión C para adaptación de contenido, se debe permitir.

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Líneas**: 856-872

**Cambio**:
```typescript
// ANTES:
      const effectivePlan = generationContext
        ? {
            ...plan,
            triggers: { versionB: false, versionC: false },
            assignmentByStudentId: Object.fromEntries(
              groupContextData.students.map(student => [String(student.studentId), 'A'])
            ),
            versionPlans: [
              {
                kind: 'A',
                label: 'Versión A (Universal)',
                assignedStudentIds: groupContextData.students.map(student => student.studentId),
                reason: 'Modo sesiones/materiales: versión única'
              }
            ],
            contentAdaptationStudentIds: []
          }
        : plan;

// DESPUÉS:
      const effectivePlan = generationContext
        ? {
            ...plan,
            triggers: { 
              versionB: false,  // Modo sesiones/materiales: no generar B
              versionC: plan.triggers.versionC  // ← Permitir C si hay estudiantes con adaptación de contenido
            },
            assignmentByStudentId: (() => {
              // Asignar todos a A por defecto
              const assignments: Record<string, 'A' | 'B' | 'C'> = {};
              for (const student of groupContextData.students) {
                assignments[String(student.studentId)] = 'A';
              }
              // Si hay versión C, asignar estudiantes con adaptación de contenido
              if (plan.triggers.versionC && plan.contentAdaptationStudentIds.length > 0) {
                for (const studentId of plan.contentAdaptationStudentIds) {
                  assignments[studentId] = 'C';
                }
              }
              return assignments;
            })(),
            versionPlans: (() => {
              const plans: EvaluationVersionPlan[] = [
                {
                  kind: 'A',
                  label: 'Versión A (Universal)',
                  assignedStudentIds: groupContextData.students
                    .filter(student => {
                      const studentId = String(student.studentId);
                      return effectivePlan?.assignmentByStudentId?.[studentId] === 'A' || 
                             !plan.contentAdaptationStudentIds.includes(studentId);
                    })
                    .map(student => student.studentId),
                  reason: 'Modo sesiones/materiales: versión base'
                }
              ];
              // Agregar versión C si hay estudiantes con adaptación
              if (plan.triggers.versionC && plan.contentAdaptationStudentIds.length > 0) {
                plans.push({
                  kind: 'C',
                  label: 'Versión C (Adecuación de contenido)',
                  assignedStudentIds: plan.contentAdaptationStudentIds.map(id => {
                    // Convertir string ID a number si es necesario
                    const student = groupContextData.students.find(s => String(s.studentId) === id);
                    return student?.studentId || id;
                  }),
                  reason: 'Adecuación de contenido declarada explícitamente'
                });
              }
              return plans;
            })(),
            contentAdaptationStudentIds: plan.contentAdaptationStudentIds  // ← Mantener, no vaciar
          }
        : plan;
```

**Nota**: Este cambio es más complejo y requiere ajustar también el edge function para manejar versión C en modo `generation_context`. Se recomienda implementar solo si es estrictamente necesario.

**Alternativa más simple**: Si Diego debe recibir versión C, asegurar que la evaluación se genere en modo `universal` (sin `generation_context`), o que el docente marque explícitamente a Diego en localStorage con `adecuacionContenido:${diegoId} = true`.

---

## Pasos de Verificación

### Verificación Problema 1: AI Report Disponible

1. **Generar evaluación nueva**:
   - Ir a "Generar Evaluaciones"
   - Seleccionar grupo, materia, contenidos
   - Generar evaluación
   - Guardar con nombre

2. **Verificar en Network tab (DevTools)**:
   - Abrir DevTools → Network
   - Filtrar por "modify-evaluation"
   - Inspeccionar la respuesta JSON
   - **Verificar**: La respuesta debe tener la clave `aiReport` (no `aiDesignReport`) con un objeto no-null

3. **Verificar en página de detalle**:
   - Abrir la evaluación guardada
   - **Verificar**: Debe aparecer el componente `AIDesignReport` (no el mensaje de fallback)

4. **Verificar en base de datos** (opcional):
   - Consultar tabla `evaluaciones`
   - Buscar la evaluación recién guardada
   - **Verificar**: `evaluacion_generada.ai_report` debe ser un objeto JSON (no null)
   - **Verificar**: `ai_design_report` debe ser un objeto JSON (no null)

---

### Verificación Problema 2: Opciones Equivalentes en Versión A

1. **Preparar grupo con contemplaciones que requieran opciones**:
   - Seleccionar grupo con estudiantes que tengan contemplaciones de estructuración (ej: "Modelos y plantillas de respuesta", "Respuestas estructuradas")
   - O grupo con predominio V+K (Visual + Kinestésico)

2. **Generar evaluación**:
   - Generar evaluación en modo `universal` (sin sesiones/materiales)
   - **Verificar en Network tab**: El request debe incluir `evaluation_design_plan.responseOptions.include === true`

3. **Inspeccionar Versión A generada**:
   - Abrir la Versión A en el UI
   - **Verificar**: Cada consigna que requiera respuesta escrita debe incluir:
     - Texto: "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
     - Opción 1: Respuesta escrita tradicional (párrafo)
     - Opción 2: Respuesta estructurada (lista con viñetas o tabla)
     - (Opcional) Opción 3: Respuesta visual (si `optionCount === 3`)

4. **Verificar en modo generation_context** (después del parche):
   - Generar evaluación con sesiones/materiales seleccionadas
   - **Verificar**: La Versión A debe incluir opciones equivalentes si `responseOptions.include === true`

---

### Verificación Problema 3: Diego Recibe Versión C

1. **Verificar marcado de Diego**:
   - Abrir DevTools → Application → Local Storage
   - Buscar clave `adecuacionContenido:${diegoId}`
   - **Verificar**: Debe ser `true` (o verificar en `mockData` que `informeTecnico.requiereAdecuacionContenido === true`)

2. **Generar evaluación en modo universal**:
   - Generar evaluación SIN sesiones/materiales (modo `universal`)
   - **Verificar en Network tab**: El request debe incluir `evaluation_design_plan.triggers.versionC === true`
   - **Verificar en Network tab**: El request debe incluir `evaluation_design_plan.contentAdaptationStudentIds` con el ID de Diego

3. **Verificar respuesta del edge function**:
   - En Network tab, inspeccionar la respuesta
   - **Verificar**: `evaluationBundle.versionCHtml` debe ser un string HTML no-vacío (no null)
   - **Verificar**: `studentAssignments` debe tener `diegoId: 'C'`

4. **Verificar en UI**:
   - En la página de generación, verificar que existe "Versión C (Adecuación de contenido)"
   - Verificar que Diego está asignado a Versión C en el panel de asignaciones

5. **Verificar en modo generation_context** (si se implementa el parche opcional):
   - Generar evaluación CON sesiones/materiales
   - **Verificar**: Si Diego está marcado, debe generarse versión C y Diego asignado a C

---

## Notas de Riesgo y Compatibilidad Hacia Atrás

### Riesgos

1. **Parche 1 (AI Report)**:
   - **Riesgo bajo**: Solo afecta nuevas evaluaciones generadas
   - **Compatibilidad**: Evaluaciones legacy seguirán mostrando fallback (comportamiento actual)
   - **Mitigación**: El fallback construye un `aiReport` mínimo, así que nunca será `null`

2. **Parche 2 (Opciones Equivalentes)**:
   - **Riesgo medio**: Cambia el contenido generado de la Versión A
   - **Compatibilidad**: Evaluaciones ya guardadas no se verán afectadas
   - **Mitigación**: Solo se aplica si `responseOptions.include === true`, que es determinístico

3. **Parche 3 (Versión C en generation_context)**:
   - **Riesgo alto**: Cambia el comportamiento del modo sesiones/materiales
   - **Compatibilidad**: Puede romper expectativas de que ese modo siempre genera versión única
   - **Mitigación**: Solo se aplica si hay estudiantes con `hasDeclaredContentAdaptation === true`

### Compatibilidad Hacia Atrás

- **Evaluaciones legacy**: No se verán afectadas (siguen usando fallback para AI report)
- **Evaluaciones guardadas antes del parche**: No se regeneran automáticamente
- **API contracts**: No se rompen (solo se agregan campos opcionales)

---

## Cómo Confirmar que la Función Desplegada Coincide con el Código

### Método 1: Verificar Versión en Logs

1. **Agregar versión al response** (temporal, para debugging):
   ```typescript
   return new Response(JSON.stringify({
     // ... campos existentes ...
     _debug: {
       version: '2026-02-01-fix-universal-eval',
       timestamp: new Date().toISOString()
     }
   }), { ... });
   ```

2. **Verificar en Network tab**: La respuesta debe incluir `_debug.version`

### Método 2: Verificar en Supabase Logs

1. Ir a Supabase Dashboard → Edge Functions → `modify-evaluation` → Logs
2. Buscar logs recientes de generación
3. Verificar que los logs muestran:
   - `[UNIVERSAL]` para modo universal
   - `[PHASE 6b]` para modo generation_context
   - Construcción de `aiReport` (no solo `aiDesignReport`)

### Método 3: Verificar Comportamiento Esperado

1. Generar evaluación nueva
2. Verificar que `aiReport` está presente en la respuesta
3. Guardar y abrir en detalle
4. Verificar que el componente `AIDesignReport` se renderiza (no fallback)

---

## Resumen de Cambios Requeridos

### Archivos a Modificar

1. **`src/pages/EvaluacionesGrupo.tsx`**:
   - Líneas 983-990: Mejorar lectura de `aiReport` con fallback robusto
   - (Opcional) Líneas 856-872: Permitir versión C en modo `generation_context`

2. **`supabase/functions/modify-evaluation/index.ts`**:
   - Líneas 464-479: Cambiar `aiDesignReport` a `aiReport` en modo `generation_context`
   - Líneas 297-332: Agregar sección de opciones equivalentes al prompt de `generation_context`

3. **`src/services/evaluations/index.ts`** (o archivo de serialización):
   - Incluir `responseOptions` en `generation_context` al serializar

### Prioridad

1. **Alta**: Parche 1 (AI Report) - Bloquea funcionalidad crítica
2. **Media**: Parche 2 (Opciones Equivalentes) - Mejora calidad pero no bloquea
3. **Baja**: Parche 3 (Versión C en generation_context) - Opcional, requiere validación de requisitos

---

## Conclusión

Los tres problemas tienen causas raíz identificadas y parches mínimos propuestos. El problema más crítico es el AI Report no disponible, que se debe a una inconsistencia en los nombres de campos entre el edge function y la UI. Los otros dos problemas requieren ajustes en los prompts y en la lógica de generación de versiones.
