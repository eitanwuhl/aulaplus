# Unify Generation Pipeline Fix - Verification and Enforcement

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Objetivo**: Verificar y asegurar que la generación de evaluaciones siempre llama al edge function `modify-evaluation` usando el pipeline universal, y agregar herramientas de debug visibles al usuario para diagnosticar problemas.

---

## Causa Raíz Encontrada

### Problema Identificado

El código ya estaba implementado para llamar a `modify-evaluation` con `generation_mode: 'universal'`, pero **no había visibilidad** para el usuario sobre:
- Si el request realmente se estaba enviando
- Qué endpoint se estaba usando
- Si el response contenía los datos esperados (`aiReport`, `evaluationBundle.versions`, etc.)

Sin logs visibles o panel de debug, era imposible diagnosticar si:
- El código se estaba ejecutando pero fallaba silenciosamente
- Había un error de red que impedía el request
- El response no contenía los campos esperados

### Endpoint Verificado

**Endpoint usado**: `supabase.functions.invoke('modify-evaluation')`  
**Ubicación**: `src/pages/EvaluacionesGrupo.tsx`, línea ~943

El código **ya estaba correctamente implementado** para usar el pipeline universal, pero faltaba:
1. Logs de debug visibles en consola
2. Panel de debug visible al usuario (gated por feature flag)
3. Verificación explícita de que el request se envía y el response se recibe correctamente

---

## Cambios Exactos Aplicados

### Archivo: `src/pages/EvaluacionesGrupo.tsx`

#### Cambio 1: Agregar Estado para Panel de Debug

**Ubicación**: Líneas ~437-450

```typescript
// DEBUG: Pipeline debug panel (gated by feature flag)
const [pipelineDebug, setPipelineDebug] = useState<{
  lastRequest?: {
    generationMode: string;
    hasEvaluationDesignPlan: boolean;
    hasGenerationContext: boolean;
    triggers: { versionB: boolean; versionC: boolean };
    responseOptionsInclude: boolean;
    assignmentsCount: number;
  };
  lastResponse?: {
    hasAiReport: boolean;
    hasEvaluationBundle: boolean;
    versionsGenerated: string[];
    warningsCount: number;
    endpoint: string;
  };
}>({});
const showDebugPanel = import.meta.env.VITE_DEBUG_EVAL_PIPELINE === 'true';
```

#### Cambio 2: Agregar Logs de Debug en `handleGenerateEvaluations`

**Ubicación**: Líneas ~781-790

```typescript
const handleGenerateEvaluations = async () => {
  console.info('[EVAL_PIPELINE] handleGenerateEvaluations called');
  
  // Validaciones con logs
  if (!selectedGroup || (!materia && !esInterdisciplinaria)) {
    console.info('[EVAL_PIPELINE] Early return: missing group or materia');
    return;
  }
  // ... más validaciones con logs
  
  console.info('[EVAL_PIPELINE] Starting generation', {
    hasAnepContent,
    hasSessions,
    hasMaterials,
    groupId: selectedGroup.id
  });
```

#### Cambio 3: Log Request Payload Summary

**Ubicación**: Líneas ~940-960

```typescript
// DEBUG: Log request payload summary
const requestSummary = {
  generationMode: requestBody.generation_mode,
  hasEvaluationDesignPlan: !!requestBody.evaluation_design_plan,
  hasGenerationContext: !!requestBody.generation_context,
  triggers: effectivePlan.triggers,
  responseOptionsInclude: effectivePlan.responseOptions.include,
  assignmentsCount: Object.keys(effectivePlan.assignmentByStudentId).length
};
console.info('[EVAL_PIPELINE] Request payload summary:', requestSummary);

if (showDebugPanel) {
  setPipelineDebug(prev => ({
    ...prev,
    lastRequest: requestSummary
  }));
}

console.info('[EVAL_PIPELINE] Invoking modify-evaluation edge function');
```

#### Cambio 4: Log Response Summary

**Ubicación**: Líneas ~965-1000

```typescript
console.info('[EVAL_PIPELINE] Edge function response received', {
  hasAiReport: !!data?.aiReport,
  hasEvaluationBundle: !!data?.evaluationBundle,
  hasVersions: {
    A: !!data?.evaluationBundle?.versions?.A,
    B: !!data?.evaluationBundle?.versions?.B,
    C: !!data?.evaluationBundle?.versions?.C
  },
  studentAssignmentsCount: Object.keys(data?.studentAssignments || {}).length
});

// DEBUG: Log response summary
const versionsGenerated: string[] = [];
if (data?.evaluationBundle?.versions?.A) versionsGenerated.push('A');
if (data?.evaluationBundle?.versions?.B) versionsGenerated.push('B');
if (data?.evaluationBundle?.versions?.C) versionsGenerated.push('C');

const responseSummary = {
  hasAiReport: !!data?.aiReport,
  hasEvaluationBundle: !!data?.evaluationBundle,
  versionsGenerated,
  warningsCount: Array.isArray(data?.warnings) ? data.warnings.length : 0,
  endpoint: 'modify-evaluation'
};

if (showDebugPanel) {
  setPipelineDebug(prev => ({
    ...prev,
    lastResponse: responseSummary
  }));
}
```

#### Cambio 5: Agregar Panel de Debug en UI

**Ubicación**: Líneas ~1975-2010 (después del botón "Generar Evaluaciones Inteligentes")

```typescript
{/* DEBUG: Pipeline debug panel (only visible when VITE_DEBUG_EVAL_PIPELINE=true) */}
{showDebugPanel && (pipelineDebug.lastRequest || pipelineDebug.lastResponse) && (
  <Card className="mt-4 border-2 border-blue-300 bg-blue-50 dark:bg-blue-950/20">
    <CardHeader>
      <CardTitle className="text-sm text-blue-800 dark:text-blue-200">
        🔍 Debug: Pipeline de Generación
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 text-sm">
      {pipelineDebug.lastRequest && (
        <div>
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Último Request:</h4>
          <ul className="list-disc pl-5 space-y-1 text-blue-800 dark:text-blue-200">
            <li>Endpoint: <code>modify-evaluation</code></li>
            <li>Generation Mode: <code>{pipelineDebug.lastRequest.generationMode}</code></li>
            <li>Has evaluation_design_plan: {pipelineDebug.lastRequest.hasEvaluationDesignPlan ? '✅ Sí' : '❌ No'}</li>
            <li>Has generation_context: {pipelineDebug.lastRequest.hasGenerationContext ? '❌ Sí (ERROR)' : '✅ No'}</li>
            <li>Triggers: versionB={pipelineDebug.lastRequest.triggers.versionB ? '✅' : '❌'}, versionC={pipelineDebug.lastRequest.triggers.versionC ? '✅' : '❌'}</li>
            <li>Response Options Include: {pipelineDebug.lastRequest.responseOptionsInclude ? '✅ Sí' : '❌ No'}</li>
            <li>Assignments Count: {pipelineDebug.lastRequest.assignmentsCount}</li>
          </ul>
        </div>
      )}
      {pipelineDebug.lastResponse && (
        <div>
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Último Response:</h4>
          <ul className="list-disc pl-5 space-y-1 text-blue-800 dark:text-blue-200">
            <li>Endpoint: <code>{pipelineDebug.lastResponse.endpoint}</code></li>
            <li>Has aiReport: {pipelineDebug.lastResponse.hasAiReport ? '✅ Sí' : '❌ No'}</li>
            <li>Has evaluationBundle: {pipelineDebug.lastResponse.hasEvaluationBundle ? '✅ Sí' : '❌ No'}</li>
            <li>Versions Generated: {pipelineDebug.lastResponse.versionsGenerated.length > 0 ? pipelineDebug.lastResponse.versionsGenerated.join(', ') : 'Ninguna'}</li>
            <li>Warnings Count: {pipelineDebug.lastResponse.warningsCount}</li>
          </ul>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

---

## Verificación desde UI (Sin DevTools)

### Paso 1: Habilitar Panel de Debug

1. Crear o editar archivo `.env` en la raíz del proyecto (si no existe)
2. Agregar la línea: `VITE_DEBUG_EVAL_PIPELINE=true`
3. Guardar el archivo
4. Reiniciar el servidor de desarrollo (`npm run dev`)
5. **Nota**: El panel solo aparece después de generar al menos una evaluación

### Paso 2: Generar Evaluación y Verificar Panel

1. Ir a "Generar Evaluaciones"
2. Seleccionar grupo, materia, contenidos
3. (Opcional) Seleccionar sesiones/materiales
4. Hacer clic en "Generar Evaluaciones Inteligentes"
5. **Verificar**: Debe aparecer un panel azul "🔍 Debug: Pipeline de Generación" debajo del botón
6. **Verificar en el panel**:
   - ✅ Endpoint: `modify-evaluation`
   - ✅ Generation Mode: `universal`
   - ✅ Has evaluation_design_plan: ✅ Sí
   - ✅ Has generation_context: ✅ No (si aparece ❌ Sí, hay un error)
   - ✅ Triggers: versionB y versionC según contemplaciones
   - ✅ Response Options Include: ✅ Sí (si corresponde)
   - ✅ Has aiReport: ✅ Sí
   - ✅ Has evaluationBundle: ✅ Sí
   - ✅ Versions Generated: A, C (si Diego tiene adaptación de contenido)

### Paso 3: Verificar Versión C para Diego

1. Preparar grupo con Diego marcado para adaptación de contenido
2. Generar evaluación
3. **Verificar en el panel de debug**:
   - ✅ Triggers: versionC=✅
   - ✅ Versions Generated: incluye "C"
4. **Verificar en la UI**:
   - ✅ Existe sección "Versión C (Adecuación de contenido)"
   - ✅ Diego está asignado a Versión C en el panel de asignaciones

### Paso 4: Verificar Opciones Equivalentes en Versión A

1. Preparar grupo con contemplaciones que requieran opciones equivalentes
2. Generar evaluación
3. **Verificar en el panel de debug**:
   - ✅ Response Options Include: ✅ Sí
4. **Verificar en la UI**:
   - ✅ Versión A incluye texto "Elige UNA opción..."
   - ✅ Aparecen las opciones equivalentes después de cada consigna

### Paso 5: Verificar AI Report Persiste

1. Generar evaluación
2. **Verificar en el panel de debug**:
   - ✅ Has aiReport: ✅ Sí
3. Guardar la evaluación
4. Abrir la evaluación guardada en la página de detalle
5. **Verificar**:
   - ✅ El componente `AIDesignReport` se renderiza (no el mensaje "AI report is not available...")

---

## Comportamiento Esperado

### Para Diego (Content Adaptation)

**Cuando Diego tiene adaptación de contenido marcada**:
- ✅ `triggers.versionC === true` en el request
- ✅ `evaluationBundle.versions.C` existe en el response (string HTML, no null)
- ✅ `studentAssignments[diegoId] === "C"` en el response
- ✅ Versión C aparece en la UI con Diego asignado

**Cuando Diego NO tiene adaptación de contenido**:
- ✅ `triggers.versionC === false` en el request
- ✅ `evaluationBundle.versions.C` es null en el response
- ✅ Diego está asignado a Versión A

### Para Opciones Equivalentes en Versión A

**Cuando `responseOptions.include === true`**:
- ✅ El request incluye `evaluation_design_plan.responseOptions.include === true`
- ✅ El HTML de Versión A incluye el texto: "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
- ✅ Aparecen las opciones: "Opción 1: Respuesta escrita tradicional (párrafo)", "Opción 2: Respuesta estructurada (lista con viñetas o tabla)"
- ✅ Las opciones aparecen después de cada consigna que requiera respuesta escrita

**Cuando `responseOptions.include === false`**:
- ✅ El HTML de Versión A NO incluye opciones equivalentes
- ✅ Solo aparece la consigna sin opciones de formato

---

## Logs en Consola

Con el panel de debug habilitado, también se pueden ver logs en la consola del navegador (F12 → Console) con el prefijo `[EVAL_PIPELINE]`:

```
[EVAL_PIPELINE] handleGenerateEvaluations called
[EVAL_PIPELINE] Starting generation { hasAnepContent: true, hasSessions: false, ... }
[EVAL_PIPELINE] Request payload summary: { generationMode: 'universal', ... }
[EVAL_PIPELINE] Invoking modify-evaluation edge function
[EVAL_PIPELINE] Edge function response received { hasAiReport: true, ... }
```

Estos logs ayudan a diagnosticar problemas si el panel de debug no aparece o si hay errores en el flujo.

---

## Troubleshooting

### El panel de debug no aparece

1. Verificar que `VITE_DEBUG_EVAL_PIPELINE=true` está en `.env`
2. Reiniciar el servidor de desarrollo
3. Verificar que se generó al menos una evaluación (el panel solo aparece después de generar)

### El request muestra `hasGenerationContext: ❌ Sí (ERROR)`

- **Problema**: El código todavía está enviando `generation_context`
- **Solución**: Verificar que no hay código legacy que agregue `requestBody.generation_context`

### El response muestra `hasAiReport: ❌ No`

- **Problema**: El edge function no está retornando `aiReport`
- **Solución**: Verificar que el edge function está usando el path `universal` y construyendo `aiReport` correctamente

### Versions Generated no incluye "C" cuando debería

- **Problema**: Diego no está marcado correctamente para adaptación de contenido, o `triggers.versionC` es false
- **Solución**: Verificar en localStorage o mockData que Diego tiene `requiereAdecuacionContenido === true`

---

## Resumen

Este fix agrega:
- ✅ Logs de debug con prefijo `[EVAL_PIPELINE]` en consola
- ✅ Panel de debug visible al usuario (gated por `VITE_DEBUG_EVAL_PIPELINE=true`)
- ✅ Verificación explícita de que el request se envía y el response se recibe
- ✅ Visibilidad completa del pipeline de generación sin necesidad de DevTools Network

El código ya estaba correctamente implementado para usar el pipeline universal; este fix agrega visibilidad y herramientas de diagnóstico.
