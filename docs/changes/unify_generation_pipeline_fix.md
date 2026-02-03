# Unify Generation Pipeline Fix

**Fecha**: 2026-02-01  
**Objetivo**: Unificar el pipeline de generación de evaluaciones para que siempre use `generation_mode: 'universal'`, eliminando el path `generation_context` que deshabilita versiones y opciones equivalentes.

---

## Resumen de Causa Raíz

### Por qué `generation_context` deshabilita versiones/opciones

El path `generation_context` en el edge function (`supabase/functions/modify-evaluation/index.ts`, líneas 245-480) fue diseñado para generar evaluaciones basadas en sesiones/materiales con un formato JSON estructurado que incluye time budgeting y mapeo de cobertura.

**Problemas identificados**:

1. **Deshabilita versiones B/C**: En `src/pages/EvaluacionesGrupo.tsx` (líneas 856-872), cuando existe `generationContext`, se fuerza:
   - `triggers: { versionB: false, versionC: false }`
   - `contentAdaptationStudentIds: []`
   - Todas las asignaciones a 'A'

2. **No incluye opciones equivalentes**: El prompt del path `generation_context` (líneas 298-332) no tiene sección sobre opciones equivalentes de respuesta, incluso si `responseOptions.include === true`.

3. **Retorna `aiDesignReport` en lugar de `aiReport`**: El edge function retorna `aiDesignReport` (línea 471) en lugar de `aiReport`, causando inconsistencia con la UI que busca `data?.aiReport` primero.

**Solución elegida**: Eliminar el uso del path `generation_context` para generación de evaluaciones. En su lugar, siempre usar `generation_mode: 'universal'` y pasar el contexto de sesiones/materiales como texto plano en el campo `modification`.

---

## Parche Exacto

### Archivo: `src/pages/EvaluacionesGrupo.tsx`

#### Cambio 1: Eliminar override de `effectivePlan`

**Líneas**: 856-873

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
      // Siempre usar el plan completo (sin overrides)
      const effectivePlan = plan;
```

#### Cambio 2: Unificar request body - siempre usar `generation_mode: 'universal'`

**Líneas**: 875-898

```typescript
// ANTES:
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

// DESPUÉS:
      // Construir modification con contexto de sesiones/materiales si existe
      let modificationText = requerimientos || 'Genera una evaluación escrita universal basada en los contenidos seleccionados.';
      
      if (generationContext) {
        const { serializeGenerationContext } = await import('@/services/evaluations');
        const serialized = serializeGenerationContext(generationContext);
        
        // Construir texto legible del contexto
        const contextSections: string[] = [];
        
        if (serialized.sessions && serialized.sessions.length > 0) {
          contextSections.push('SESIONES DE CLASE A EVALUAR:');
          serialized.sessions.forEach((s: any, idx: number) => {
            contextSections.push(`\nSesión ${s.order}: ${s.title || `Sesión ${s.order}`}`);
            if (s.anepContent?.length) contextSections.push(`- Contenidos ANEP: ${s.anepContent.join(', ')}`);
            if (s.competencies?.length) contextSections.push(`- Competencias: ${s.competencies.join(', ')}`);
            if (s.objectives) contextSections.push(`- Objetivos: ${s.objectives}`);
            if (s.activitiesSummary) contextSections.push(`- Resumen de actividades: ${s.activitiesSummary}`);
            if (s.resources?.length) contextSections.push(`- Recursos: ${s.resources.join(', ')}`);
            if (s.attachedMaterials?.length) {
              contextSections.push(`- Materiales adjuntos: ${s.attachedMaterials.map((m: any) => m.title).join(', ')}`);
            }
            if (idx < serialized.sessions.length - 1) contextSections.push('\n---');
          });
        }
        
        if (serialized.materials && serialized.materials.length > 0) {
          contextSections.push('\n\nMATERIALES DOCENTES ADJUNTOS:');
          serialized.materials.forEach((m: any, idx: number) => {
            contextSections.push(`\n${idx + 1}. ${m.title} (${m.mimeType})`);
            if (m.focusText) contextSections.push(`   Enfoque: ${m.focusText}`);
            if (m.extractedText) {
              contextSections.push(`   Contenido extraído del PDF:\n   ${m.extractedText.substring(0, 1000)}${m.extractedText.length > 1000 ? '...' : ''}`);
            }
            if (idx < serialized.materials.length - 1) contextSections.push('\n---');
          });
        }
        
        if (serialized.evaluationFocus) {
          contextSections.push(`\n\nENFOQUE DE EVALUACIÓN (ESPECIFICADO POR EL DOCENTE):\n${serialized.evaluationFocus}`);
        }
        
        if (serialized.timeBudget) {
          contextSections.push(`\n\nPRESUPUESTO DE TIEMPO:\n- Duración objetivo: ${serialized.timeBudget.targetMinutes} minutos\n- Tolerancia: ${Math.round((serialized.timeBudget.flexibilityThreshold || 0.10) * 100)}%`);
        }
        
        if (contextSections.length > 0) {
          modificationText = `${modificationText}\n\n${contextSections.join('\n')}`;
        }
      }

      const requestBody: any = {
        originalEvaluation: basePrototype || generatePrototipo(selectedSubtemas, requerimientos, 1),
        modification: modificationText,
        groupContext,
        type: 'modification',
        // SIEMPRE usar generation_mode: 'universal'
        generation_mode: 'universal',
        evaluation_design_plan: {
          instrumentDesignRules,
          responseOptions: effectivePlan.responseOptions,
          triggers: effectivePlan.triggers,
          assignmentByStudentId: effectivePlan.assignmentByStudentId,
          perStudentReminders: effectivePlan.perStudentReminders,
          varkDistribution: effectivePlan.varkDistribution,
          highStructureNeed: effectivePlan.highStructureNeed,
          designComplexityCount: effectivePlan.designComplexityCount,
          bucketedContemplacionIds: effectivePlan.bucketedContemplacionIds
        }
      };
```

---

## Pasos de Verificación

### Verificación desde UI + Network Tab

#### 1. Verificar Request Incluye `generation_mode: "universal"`

1. Abrir DevTools → Network tab
2. Ir a "Generar Evaluaciones"
3. Seleccionar grupo, materia, contenidos
4. (Opcional) Seleccionar sesiones/materiales
5. Hacer clic en "Generar Evaluaciones Inteligentes"
6. En Network tab, filtrar por "modify-evaluation"
7. Inspeccionar el request (click derecho → "Copy" → "Copy as cURL" o ver en "Payload")
8. **Verificar**: El request debe incluir:
   ```json
   {
     "generation_mode": "universal",
     "evaluation_design_plan": {
       "triggers": { "versionB": ..., "versionC": ... },
       "responseOptions": { "include": ..., "optionCount": ... },
       "assignmentByStudentId": { ... }
     }
   }
   ```
9. **Verificar**: NO debe incluir `generation_context` (solo si hay sesiones/materiales, debe estar en `modification` como texto)

#### 2. Verificar Response Incluye `aiReport` (no null)

1. En Network tab, inspeccionar la respuesta de "modify-evaluation"
2. Abrir la respuesta JSON
3. **Verificar**: Debe existir la clave `aiReport` (no `aiDesignReport`)
4. **Verificar**: `aiReport` debe ser un objeto (no `null`)
5. **Verificar**: `aiReport.versions.generated` debe ser un array (ej: `["A"]` o `["A", "C"]`)
6. **Verificar (opcional)**: Debe existir `_debug.generationPath === "universal"` confirmando que se usó el path correcto

#### 3. Verificar Response Incluye `evaluationBundle.versions`

1. En la misma respuesta JSON
2. **Verificar**: Debe existir `evaluationBundle.versions.A` (string HTML)
3. **Verificar**: Si hay estudiantes con adaptación de contenido (ej: Diego), debe existir `evaluationBundle.versions.C` (string HTML, no `null`)
4. **Verificar**: Si `triggers.versionB === true`, debe existir `evaluationBundle.versions.B` (string HTML, no `null`)

#### 4. Verificar `studentAssignments` Incluye Diego como 'C'

1. En la misma respuesta JSON
2. Buscar `studentAssignments` (objeto con IDs de estudiantes como keys)
3. **Verificar**: Si Diego tiene adaptación de contenido, debe existir `studentAssignments[diegoId] === "C"`
4. **Verificar**: NO debe haber asignaciones a 'B' o 'C' si esas versiones no fueron generadas (deben estar normalizadas a 'A')

#### 5. Verificar Opciones Equivalentes en HTML de Versión A

1. En la respuesta JSON, copiar `evaluationBundle.versions.A`
2. Buscar en el HTML el texto: "Elige UNA opción"
3. **Verificar**: Si `responseOptions.include === true`, el HTML debe contener:
   - Texto: "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
   - Opción 1: "Respuesta escrita tradicional (párrafo)"
   - Opción 2: "Respuesta estructurada (lista con viñetas o tabla)"
   - (Si `optionCount === 3`) Opción 3: "Respuesta visual (diagrama o esquema con texto explicativo)"
4. **Verificar**: Las opciones deben aparecer después de cada consigna que requiera respuesta escrita

#### 6. Verificar en UI - Versión C Existe para Diego

1. Después de generar, en la página de generación
2. **Verificar**: Si Diego tiene adaptación de contenido, debe existir una sección "Versión C (Adecuación de contenido)"
3. **Verificar**: En el panel de asignaciones, Diego debe estar asignado a Versión C
4. Guardar la evaluación
5. Abrir la evaluación guardada en la página de detalle
6. **Verificar**: Debe aparecer Versión C con Diego asignado

#### 7. Verificar en UI - AI Report Se Renderiza

1. En la página de detalle de la evaluación guardada
2. **Verificar**: Debe aparecer el componente `AIDesignReport` (no el mensaje de fallback "El reporte de IA no está disponible...")
3. **Verificar**: El reporte debe mostrar información sobre versiones generadas, contemplaciones, opciones de respuesta, etc.

---

## Cambios de Código Implementados

### Archivo: `src/pages/EvaluacionesGrupo.tsx`

**Cambios realizados**:
1. ✅ Eliminado override de `effectivePlan` (líneas 856-873) - ahora siempre usa `plan` completo
2. ✅ Unificado `requestBody` - siempre envía `generation_mode: 'universal'` + `evaluation_design_plan`
3. ✅ Contexto de sesiones/materiales embebido como texto en `modification` cuando existe `generationContext`

### Archivo: `supabase/functions/modify-evaluation/index.ts`

**Cambios realizados**:
1. ✅ Agregado campo `_debug.generationPath: 'universal'` en la respuesta (línea ~781) para verificación en Network tab

---

## Notas de Compatibilidad

### Evaluaciones Legacy

- **No afectadas**: Las evaluaciones guardadas antes de este cambio seguirán funcionando igual
- **Lectura**: `EvaluacionDetalle.tsx` mantiene la lectura legacy (`ai_report` o `ai_design_report`)

### Evaluaciones Nuevas

- **Siempre usan path universal**: Todas las evaluaciones nuevas (con o sin sesiones/materiales) usan `generation_mode: 'universal'`
- **Versiones habilitadas**: Versiones B/C se generan según contemplaciones (no forzadas a false)
- **Opciones equivalentes**: Se incluyen en Versión A cuando `responseOptions.include === true`
- **AI Report consistente**: Siempre retorna `aiReport` (nunca `aiDesignReport`)

### Edge Function

- **Path `generation_context`**: Sigue existiendo pero ya no se usa para generación de evaluaciones
- **Path `universal`**: Ahora maneja tanto evaluaciones con ANEP como con sesiones/materiales (contexto en `modification`)

---

## Resumen

Este cambio unifica el pipeline de generación eliminando el path `generation_context` que causaba:
- ❌ Versiones B/C deshabilitadas
- ❌ Opciones equivalentes omitidas
- ❌ AI Report inconsistente (`aiDesignReport` vs `aiReport`)

Ahora todas las evaluaciones usan `generation_mode: 'universal'` con el contexto de sesiones/materiales embebido como texto en `modification`, permitiendo:
- ✅ Versiones B/C según contemplaciones
- ✅ Opciones equivalentes cuando corresponde
- ✅ AI Report consistente y persistente
