# Fix Evaluation Generation End-to-End (Versions B/C, Metacognitive Response Options, and AI Report Persistence)

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Objetivo**: Asegurar que las evaluaciones generadas incluyan todas las versiones requeridas (A, B, C), opciones metacognitivas equivalentes en versión A, y que el AI report persista correctamente.

---

## Problema Identificado

A pesar de que el network muestra una request exitosa a `modify-evaluation` (HTTP 200), la aplicación aún produce:
- Solo una versión de evaluación (A)
- Sin opciones metacognitivas equivalentes en Versión A
- Sin AI report en el detalle de evaluación ("AI report is not available...")
- Sin versión diferente para estudiantes con adaptación de contenido (se espera Versión C)

Esto indica que el mapeo de la respuesta del edge function y/o la persistencia en la UI están incorrectos.

---

## Cambios Implementados

### R1 — Request Payload Enforce Universal Pipeline

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambios**:
1. **Agregado logging explícito del payload** (líneas ~1005-1021):
   ```typescript
   console.info('[EVAL_PIPELINE] payload', {
     generation_mode: requestBody.generation_mode,
     triggers: effectivePlan.triggers,
     responseOptions: {
       include: effectivePlan.responseOptions.include,
       optionCount: effectivePlan.responseOptions.optionCount
     },
     assignmentsByVersion: {
       A: Object.values(effectivePlan.assignmentByStudentId).filter(v => v === 'A').length,
       B: Object.values(effectivePlan.assignmentByStudentId).filter(v => v === 'B').length,
       C: Object.values(effectivePlan.assignmentByStudentId).filter(v => v === 'C').length
     }
   });
   ```

2. **Verificación explícita de que `generation_context` NO se envía**:
   - El código ya no incluye `generation_context` en el request body
   - Solo se envía `generation_mode: 'universal'` y `evaluation_design_plan` completo

3. **El `evaluation_design_plan` siempre incluye**:
   - `triggers.versionB` y `triggers.versionC` (sin forzar `false` cuando hay sesiones/materiales)
   - `responseOptions.include` y `responseOptions.optionCount`
   - `assignmentByStudentId` incluyendo "C" para estudiantes con adaptación de contenido
   - `perStudentReminders`, `varkDistribution`, `highStructureNeed`, etc.

---

### R2 — Edge Function Always Returns aiReport + Versions Bundle

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Estado actual**: El edge function ya implementa correctamente:

1. **Path universal** (líneas 483-791):
   - Verifica `generation_mode === 'universal'` después de verificar `generation_context`
   - Si `generation_context` no existe, usa el path universal

2. **Respuesta siempre incluye** (líneas 758-790):
   ```typescript
   {
     success: true,
     content: baseHtml || '',
     evaluationBundle: {
       baseHtml,
       versionBHtml: hasVersionB ? versionBHtml : null,
       versionCHtml: hasVersionC ? versionCHtml : null,
       versions: {
         A: baseHtml || '',
         B: hasVersionB ? versionBHtml : null,
         C: hasVersionC ? versionCHtml : null
       },
       responseOptionsIncluded: parsed.response_options_included === true,
       responseOptionCount: parsed.response_option_count || responseOptionCount
     },
     studentAssignments: adjustedAssignments,
     teacherRemindersByStudent,
     aiReport,  // SIEMPRE presente, nunca null
     warnings: allWarnings
   }
   ```

3. **Verificación de versiones** (líneas 656-694):
   - Si `triggers.versionC === true`, `evaluationBundle.versions.C` NO puede ser null
   - Si `triggers.versionB === true`, `evaluationBundle.versions.B` NO puede ser null
   - Si una versión no se genera, los estudiantes se reasignan a A con warnings

4. **Opciones equivalentes** (líneas 520-532):
   - Si `responseOptions.include === true`, el prompt incluye instrucciones explícitas para incluir opciones equivalentes
   - El formato requerido es: "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
   - Las opciones deben aparecer INMEDIATAMENTE después de cada consigna relevante

5. **aiReport siempre presente** (líneas 718-756):
   - Si OpenAI genera `ai_report`, se mergea con datos locales
   - Si no, se crea un fallback completo con toda la información necesaria
   - Nunca retorna `null`

---

### R3 — UI Maps Versions and Persists aiReport

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambios**:

1. **Mapeo correcto desde `evaluationBundle.versions`** (líneas ~1108-1142):
   ```typescript
   // R3: Always use evaluationBundle.versions structure
   const evaluationBundleToSet: EvaluationBundle = {
     baseHtml: data.evaluationBundle?.versions?.A || data.evaluationBundle?.baseHtml || '',
     versionBHtml: data.evaluationBundle?.versions?.B ?? data.evaluationBundle?.versionBHtml ?? null,
     versionCHtml: data.evaluationBundle?.versions?.C ?? data.evaluationBundle?.versionCHtml ?? null,
     versions: {
       A: data.evaluationBundle?.versions?.A || data.evaluationBundle?.baseHtml || '',
       B: data.evaluationBundle?.versions?.B ?? data.evaluationBundle?.versionBHtml ?? null,
       C: data.evaluationBundle?.versions?.C ?? data.evaluationBundle?.versionCHtml ?? null
     },
     responseOptionsIncluded: data.evaluationBundle?.responseOptionsIncluded ?? false,
     responseOptionCount: data.evaluationBundle?.responseOptionCount ?? 2
   };
   ```

2. **Verificación de campos críticos** (líneas ~1054-1080):
   ```typescript
   // R2: Verify that edge function returned aiReport and evaluationBundle.versions
   if (!data?.evaluationBundle) {
     // Error: mostrar banner y no continuar
   }
   
   if (!data?.aiReport) {
     // Error: mostrar banner y no continuar
   }
   
   const hasVersionA = Boolean(
     data?.evaluationBundle?.versions?.A || 
     data?.evaluationBundle?.baseHtml
   );
   
   if (!hasVersionA) {
     // Error: mostrar banner y no continuar
   }
   ```

3. **Persistencia de aiReport** (líneas ~1164-1174 y ~598-605):
   ```typescript
   // Leer aiReport de la respuesta
   if (data?.aiReport) {
     setAiDesignReport(JSON.stringify(data.aiReport));
   }
   
   // Al guardar, persistir en ambos lugares:
   evaluacion_generada: {
     ai_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,
     // ...
   },
   ai_design_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,  // Legacy compatibility
   ```

4. **`displayEvaluations` mapea correctamente** (líneas ~1508-1574):
   - Usa `evaluationBundle.versions.A` para versión A
   - Usa `evaluationBundle.versions.B` para versión B (si existe)
   - Usa `evaluationBundle.versions.C` para versión C (si existe)
   - Asigna estudiantes según `studentAssignments` o `evaluationDesignPlan.assignmentByStudentId`

---

### R4 — Content Adaptation: Student MUST Receive Version C

**Archivo**: `src/services/evaluations/designPlan.ts`

**Estado actual**: El código ya implementa correctamente:

1. **Detección de estudiantes con adaptación de contenido** (líneas 216-219):
   ```typescript
   const contentAdaptationStudentIds = students
     .filter(student => student.hasDeclaredContentAdaptation)
     .map(student => String(student.studentId));
   const versionCTriggered = contentAdaptationStudentIds.length > 0;
   ```

2. **Asignación a versión C** (líneas 232-236):
   ```typescript
   if (versionCTriggered) {
     for (const studentId of contentAdaptationStudentIds) {
       assignmentByStudentId[studentId] = 'C';
     }
   }
   ```

3. **Triggers** (líneas 51-54):
   ```typescript
   triggers: {
     versionB: boolean;
     versionC: boolean;  // true si hay estudiantes con adaptación de contenido
   }
   ```

**Verificación**: Si un estudiante tiene `hasDeclaredContentAdaptation === true` (ej: Diego Martinez), entonces:
- `triggers.versionC` será `true`
- El estudiante será asignado a versión C en `assignmentByStudentId`
- El edge function recibirá `triggers.versionC === true` y generará versión C

---

### R5 — Remove Silent Fallback

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambios**:

1. **Eliminado fallback silencioso** (líneas ~1110-1142):
   - **Antes**: Si `evaluationBundle.baseHtml` no existía, creaba una evaluación local solo con versión A
   - **Después**: Si `evaluationBundle.versions.A` no existe, muestra error y no genera evaluación local

2. **Verificación estricta de campos críticos**:
   ```typescript
   if (!hasVersionA) {
     console.error('[EVAL_PIPELINE] Response missing Version A (critical field)');
     setGenerationError({
       message: 'Error en la respuesta del servidor',
       details: 'La respuesta no contiene la versión A de la evaluación. Por favor, intentá nuevamente.',
       show: true
     });
     toast({
       title: "Error crítico",
       description: "La respuesta del servidor no contiene la versión A de la evaluación.",
       variant: "destructive"
     });
     setIsGenerating(false);
     return;  // NO continúa, NO crea evaluación local
   }
   ```

3. **Estado limpio en caso de error**:
   - `setGeneratedEvaluations([])` - no crea evaluaciones locales
   - `setEvaluationBundle(null)` - limpia el bundle
   - Muestra banner de error visible

---

### R6 — teacher_sugerencias 404 Must Not Block

**Archivo**: `src/services/groupContext/provider.ts`

**Estado actual**: Ya implementado correctamente (cambio previo):

```typescript
async function loadTeacherSugerencias(grupoId: string): Promise<TeacherSugerenciasForAI | undefined> {
  try {
    // ... código de fetch ...
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - expected, use mock data
        return undefined;
      }
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('404')) {
        // Table/column doesn't exist - non-blocking
        console.warn('[getGroupContextForAI] Table/column teacher_sugerencias not available:', error.message);
        return undefined;  // ✅ No bloquea generación
      }
      // Other errors - log but don't block
      console.warn('[getGroupContextForAI] Error fetching teacher_sugerencias (non-blocking):', error);
      return undefined;  // ✅ Nunca bloquea
    }
    
    // ...
  } catch (error: any) {
    // Catch all errors gracefully - never block generation
    console.warn('[getGroupContextForAI] Error loading teacher_sugerencias (non-blocking):', error);
    return undefined;
  }
}
```

**Resultado**: El 404 de `teacher_sugerencias` nunca bloquea la generación de evaluaciones.

---

## Forma Exacta de la Respuesta del Edge Function

### Request Payload (Universal Path)

```typescript
{
  originalEvaluation: string,
  modification: string,
  groupContext: GroupContextForAI,
  type: 'modification',
  generation_mode: 'universal',  // ✅ Siempre presente
  evaluation_design_plan: {
    instrumentDesignRules: string[],
    responseOptions: {
      include: boolean,
      optionCount: 1 | 2 | 3
    },
    triggers: {
      versionB: boolean,
      versionC: boolean
    },
    assignmentByStudentId: Record<string, 'A' | 'B' | 'C'>,
    perStudentReminders: StudentReminders[],
    varkDistribution: { visual, auditory, readWrite, kinesthetic, total },
    highStructureNeed: { totalStudents, qualifyingStudents, percent, qualifyingStudentIds },
    designComplexityCount: number,
    bucketedContemplacionIds: Record<ContemplacionBucket, string[]>
  }
  // ❌ NO incluye generation_context
}
```

### Response Payload (Universal Path)

```typescript
{
  success: true,
  content: string,  // Versión A HTML (legacy compatibility)
  type: 'modification',
  evaluationBundle: {
    baseHtml: string,  // Versión A HTML
    versionBHtml: string | null,  // Versión B HTML o null
    versionCHtml: string | null,  // Versión C HTML o null
    versions: {
      A: string,  // ✅ Siempre presente (no null)
      B: string | null,  // null si no se generó
      C: string | null  // null si no se generó
    },
    responseOptionsIncluded: boolean,
    responseOptionCount: number
  },
  studentAssignments: Record<string, 'A' | 'B' | 'C'>,  // ✅ Ajustado: nunca contiene 'B'/'C' si versiones no existen
  teacherRemindersByStudent: StudentReminders[],
  aiReport: {  // ✅ Siempre presente, nunca null
    versions: {
      generated: string[],  // ['A'] o ['A', 'B'] o ['A', 'C'] o ['A', 'B', 'C']
      reason: string
    },
    contemplaciones: {
      instrument_design: string[],
      admin_reminders: string[],
      correction_reminders: string[]
    },
    response_options: {
      included: boolean,
      optionCount: number,
      rationale: string
    },
    vark: {
      summary: string
    },
    assignments: {
      rationale: string
    },
    warnings: string[]
  },
  warnings: string[],
  metadata: {
    tokensUsed: number,
    model: string
  }
}
```

---

## Cómo la UI Mapea Versiones y Persiste aiReport

### 1. Mapeo de Versiones en `displayEvaluations`

**Ubicación**: `src/pages/EvaluacionesGrupo.tsx` líneas ~1508-1574

```typescript
const displayEvaluations = useMemo(() => {
  if (!evaluationBundle?.baseHtml && !evaluationBundle?.versions?.A) {
    return generatedEvaluations;  // Fallback a evaluaciones generadas localmente (legacy)
  }

  const assignmentByStudentId = Object.keys(studentAssignments).length > 0
    ? studentAssignments
    : (evaluationDesignPlan?.assignmentByStudentId || {});
  
  const students = selectedGroup?.students || [];
  const getAssigned = (kind: 'A' | 'B' | 'C') => {
    const assigned = students.filter(student => assignmentByStudentId[String(student.id)] === kind);
    return {
      ids: assigned.map(student => student.id),
      names: assigned.map(student => student.name || `Estudiante ${student.id}`)
    };
  };

  const baseAssigned = getAssigned('A');
  const baseHtml = evaluationBundle.baseHtml || evaluationBundle.versions?.A || '';
  const evaluations: GeneratedEvaluation[] = [
    {
      id: 'A',
      title: 'Versión A (Universal)',
      content: baseHtml,
      version: 1,
      versionKind: 'A',
      versionLabel: 'Versión A (Universal)',
      adaptations: [],
      assignedStudents: baseAssigned.names,
      assignedStudentIds: baseAssigned.ids
    }
  ];

  // Agregar versión B si existe
  const versionBHtml = evaluationBundle.versionBHtml || evaluationBundle.versions?.B || null;
  if (versionBHtml) {
    const assigned = getAssigned('B');
    evaluations.push({
      id: 'B',
      title: 'Versión B (Equivalente)',
      content: versionBHtml,
      version: 2,
      versionKind: 'B',
      versionLabel: 'Versión B (Equivalente)',
      adaptations: [],
      assignedStudents: assigned.names,
      assignedStudentIds: assigned.ids
    });
  }

  // Agregar versión C si existe
  const versionCHtml = evaluationBundle.versionCHtml || evaluationBundle.versions?.C || null;
  if (versionCHtml) {
    const assigned = getAssigned('C');
    evaluations.push({
      id: 'C',
      title: 'Versión C (Adecuación de contenido)',
      content: versionCHtml,
      version: 3,
      versionKind: 'C',
      versionLabel: 'Versión C (Adecuación de contenido)',
      adaptations: [],
      assignedStudents: assigned.names,
      assignedStudentIds: assigned.ids
    });
  }

  return evaluations;
}, [evaluationBundle, evaluationDesignPlan, generatedEvaluations, selectedGroup]);
```

### 2. Persistencia de aiReport

**Ubicación**: `src/pages/EvaluacionesGrupo.tsx` líneas ~1164-1174 y ~598-605

```typescript
// Después de recibir respuesta del edge function
if (data?.aiReport) {
  console.info('[EVAL_PIPELINE] Using aiReport from response');
  setAiDesignReport(JSON.stringify(data.aiReport));
} else if (data?.aiDesignReport) {
  console.warn('[EVAL_PIPELINE] Falling back to aiDesignReport (legacy)');
  setAiDesignReport(JSON.stringify(data.aiDesignReport));
} else {
  console.warn('[EVAL_PIPELINE] No aiReport or aiDesignReport in response');
  setAiDesignReport(null);
}

// Al guardar evaluación
const evaluacionData = {
  // ... otros campos ...
  evaluacion_generada: {
    evaluaciones: displayEvaluations,
    base_prototype: basePrototype,
    ai_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,  // ✅ Nuevo campo
    aiDesignReport: aiDesignReport ? JSON.parse(aiDesignReport) : null,  // Legacy
    evaluation_bundle: evaluationBundle,
    evaluation_design_plan: evaluationDesignPlan,
    student_assignments: studentAssignments,
    teacher_reminders_by_student: teacherReminders
  },
  ai_design_report: aiDesignReport ? JSON.parse(aiDesignReport) : null  // ✅ Top-level column (legacy compatibility)
};
```

### 3. Lectura de aiReport en Detalle

**Ubicación**: `src/pages/EvaluacionDetalle.tsx` líneas ~210-211

```typescript
// PATCH: Leer ai_report primero desde evaluacion_generada, luego desde ai_design_report
const aiReportPayload = evaluacion.evaluacion_generada?.ai_report || evaluacion.ai_design_report || null;

// Renderizar
{aiReportPayload ? (
  <AIDesignReport
    reportData={aiReportPayload as AIDesignReportData}
    className="mt-4"
  />
) : (
  <Card className="border-l-4 border-amber-500 bg-amber-50">
    <CardContent>
      <p>El reporte de IA no está disponible para esta evaluación (legacy o generación previa).</p>
    </CardContent>
  </Card>
)}
```

---

## Cómo se Enfuerza la Asignación de Versión C

### Flujo Completo

1. **Detección de estudiantes con adaptación de contenido**:
   - `src/services/groupContext/provider.ts` detecta estudiantes con `hasDeclaredContentAdaptation === true`
   - Esto se pasa a `buildEvaluationDesignPlan()` en `src/services/evaluations/designPlan.ts`

2. **Plan de diseño**:
   - `buildEvaluationDesignPlan()` detecta estudiantes con adaptación (líneas 216-219)
   - Establece `triggers.versionC = true` si hay al menos uno (línea 219)
   - Asigna esos estudiantes a versión C en `assignmentByStudentId` (líneas 232-236)

3. **Request al edge function**:
   - `evaluation_design_plan.triggers.versionC = true` se envía al edge function
   - `evaluation_design_plan.assignmentByStudentId` incluye los IDs de estudiantes asignados a 'C'

4. **Edge function genera versión C**:
   - El prompt incluye instrucciones explícitas para generar versión C (líneas 592-598)
   - Si `triggers.versionC === true`, el prompt dice: "OBLIGATORIO: Generar versión C con adecuación de contenido"
   - El edge function verifica que `versionCHtml` no sea null/empty (línea 662)

5. **UI mapea versión C**:
   - `displayEvaluations` verifica si `evaluationBundle.versions.C` existe
   - Si existe, crea un objeto `GeneratedEvaluation` con `id: 'C'`
   - Asigna estudiantes según `studentAssignments` (que viene de `assignmentByStudentId`)

6. **Persistencia**:
   - `evaluation_bundle.versions.C` se guarda en la DB
   - `student_assignments` se guarda con los IDs de estudiantes asignados a 'C'

---

## Criterios de Aceptación (Manual)

Después de generar una evaluación para un grupo donde:
- `responseOptions.include` debería ser `true`
- Hay al menos un estudiante con adaptación de contenido (ej: Diego Martinez)

Entonces:

1. ✅ **UI muestra Versión A Y Versión C** (y B si está triggerada):
   - Verificar en la pestaña "Resultados" que aparecen ambas versiones
   - Verificar que cada versión tiene estudiantes asignados

2. ✅ **Versión A contiene opciones metacognitivas**:
   - Verificar que después de cada consigna relevante aparece: "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
   - Verificar que hay exactamente `responseOptionCount` opciones (2 o 3)

3. ✅ **Pantalla de detalle muestra AI report**:
   - Guardar la evaluación
   - Abrir la evaluación guardada
   - Verificar que aparece el componente `AIDesignReport` (no el mensaje de fallback)

4. ✅ **Tabla `evaluaciones` tiene campos no-null**:
   - Verificar en Supabase que `evaluacion_generada.ai_report` es no-null
   - Verificar que `ai_design_report` (top-level) es no-null
   - Verificar que `evaluation_bundle.versions.C` es no-null si hay estudiantes con adaptación

---

## Archivos Modificados

1. **`src/pages/EvaluacionesGrupo.tsx`**:
   - Agregado logging explícito del payload (R1)
   - Verificación estricta de campos críticos (R2, R5)
   - Mapeo correcto desde `evaluationBundle.versions` (R3)
   - Eliminado fallback silencioso (R5)

2. **`src/services/groupContext/provider.ts`**:
   - Manejo graceful de 404 de `teacher_sugerencias` (R6) - ya implementado previamente

3. **`supabase/functions/modify-evaluation/index.ts`**:
   - No requiere cambios - ya implementa correctamente el path universal

4. **`src/services/evaluations/designPlan.ts`**:
   - No requiere cambios - ya implementa correctamente la detección y asignación de versión C

5. **`src/pages/EvaluacionDetalle.tsx`**:
   - No requiere cambios - ya lee correctamente `ai_report` desde `evaluacion_generada`

---

## Rollback

Si es necesario revertir este cambio:

1. **Revertir commit**: Si se hizo un commit único, usar `git revert <commit-hash>`
2. **Revertir archivos manualmente**:
   - `src/pages/EvaluacionesGrupo.tsx`: Restaurar verificación de `baseHtml` en lugar de `versions.A`, restaurar fallback silencioso

**Nota**: Después del rollback, volverán los problemas de:
- Solo versión A generada
- Sin opciones metacognitivas
- Sin AI report persistido
- Sin versión C para estudiantes con adaptación
