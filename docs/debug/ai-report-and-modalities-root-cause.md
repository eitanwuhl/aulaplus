# Análisis de Causa Raíz: Reporte Narrativo y Opciones de Respuesta Equivalentes No Aparecen en UI

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Síntomas:** Reporte narrativo y opciones de respuesta equivalentes no se muestran en la UI después de la implementación reciente

---

## 1. Síntomas Observados

### Síntoma 1: Reporte Narrativo No Aparece
- **Observación:** El componente `AIDesignReport` muestra el formato legacy estructurado (checklist con secciones: "Justificación del diseño", "Versiones generadas", "Contemplaciones aplicadas", chips, contadores)
- **Esperado:** Debería mostrar un texto narrativo continuo de 200-400 palabras en párrafos amigables para docentes
- **Ubicación UI:** `src/components/evaluaciones/AIDesignReport.tsx` y `src/components/evaluaciones/v2/V2InfoPanels.tsx`

### Síntoma 2: Opciones de Respuesta Equivalentes No Aparecen
- **Observación:** Items de comprensión/proceso (essay, paragraph, source_analysis, true_false_justify) no muestran las 3 modalidades equivalentes
- **Esperado:** Deberían mostrar 3 opciones de formato de respuesta equivalentes (ej: ensayo, tabla de análisis, esquema con títulos)
- **Ubicación UI:** `src/components/evaluaciones/v2/EvalItem.tsx`

---

## 2. Comportamiento Esperado (Según Requisitos)

### Reporte Narrativo
- Campo `aiReport.narrative` debe ser un string de 200-400 palabras
- Debe explicar: grupo/materia, contenidos/competencias, versiones generadas, contemplaciones aplicadas, opciones de respuesta equivalentes (si aplica), requerimientos del docente, fuentes utilizadas
- Debe ser texto continuo en párrafos, no checklist

### Opciones de Respuesta Equivalentes
- Items de tipo `essay`, `paragraph`, `source_analysis`, `true_false_justify` deben incluir `equivalentResponseOptions` con exactamente 3 opciones
- Las opciones deben ser context-appropriate según la demanda cognitiva del prompt
- Debe activarse cuando `responseOptionsInclude === true` en el `evaluation_design_plan`

---

## 3. Análisis del Flujo de Datos

### A) Pipeline de Datos: Evaluaciones V2

#### Etapa 1: Generación (Edge Function)

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**Líneas relevantes:**
- **1298-1326:** Extracción del narrativo del spec y generación de fallback
- **1330-1350:** Construcción de la respuesta con `aiReport.narrative`

**Evidencia encontrada:**
```typescript
// Línea 1299-1306: Extrae narrative del spec
let narrative: string | undefined = undefined;
if (result.spec.aiReport && typeof result.spec.aiReport === 'object') {
  const specAiReport = result.spec.aiReport as Record<string, unknown>;
  if (typeof specAiReport.narrative === 'string' && specAiReport.narrative.trim().length >= 80) {
    narrative = specAiReport.narrative.trim();
  }
}

// Línea 1308-1321: Genera fallback si falta
if (!narrative) {
  narrative = await generateNarrativeReportFallback(...);
}

// Línea 1330-1350: Incluye narrative en respuesta
aiReport: {
  ...(narrative ? { narrative } : {}),  // ✅ NARRATIVE SE INCLUYE AQUÍ
  designRationale: `...`,
  // ... campos legacy
}
```

**Conclusión:** El narrativo SÍ se genera y se incluye en la respuesta del edge function.

---

#### Etapa 2: Validación y Normalización

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**Líneas relevantes:**
- **390-407:** Validación de `aiReport.narrative` en el spec

**Evidencia encontrada:**
```typescript
// Línea 390-407: Valida narrative
if (spec.aiReport && typeof spec.aiReport === 'object') {
  const aiReport = spec.aiReport as Record<string, unknown>;
  if (aiReport.narrative !== undefined) {
    if (typeof aiReport.narrative !== 'string' || aiReport.narrative.trim().length < 80) {
      warnings.push({ code: 'NARRATIVE_TOO_SHORT', ... });
      delete aiReport.narrative;  // ⚠️ ELIMINA NARRATIVE SI ES MUY CORTO
    } else {
      aiReport.narrative = aiReport.narrative.trim();  // ✅ MANTIENE SI ES VÁLIDO
    }
  }
}
```

**Conclusión:** La validación puede eliminar el narrativo si es muy corto, pero luego se genera el fallback en la etapa 1.

---

#### Etapa 3: Persistencia en Base de Datos

**Archivo:** `src/pages/EvaluacionesGrupo.tsx`

**Líneas relevantes:**
- **606-621:** Construcción del objeto `evaluacion_generada` para guardar
- **1448-1458:** Lectura de `data.aiReport` después de la generación

**Evidencia encontrada:**
```typescript
// Línea 606-621: Guarda en evaluacion_generada
evaluacion_generada: {
  // ...
  aiDesignReport: aiDesignReport ? JSON.parse(aiDesignReport) : null,
  ai_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,  // ⚠️ USA aiDesignReport (string)
  // ...
},
// Línea 621: También guarda en columna separada
ai_design_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,

// Línea 1448-1458: Lee aiReport de la respuesta
if (data?.aiReport) {
  setAiDesignReport(JSON.stringify(data.aiReport));  // ✅ CONVIERTE A STRING
}
```

**Problema identificado #1:**
- `aiDesignReport` es un **string** (JSON stringificado)
- Se guarda como `ai_report` dentro de `evaluacion_generada` (JSONB)
- También se guarda en `ai_design_report` (columna separada JSONB)
- **PERO:** Cuando se carga desde la DB, no se está recuperando correctamente (ver Etapa 4)

---

#### Etapa 4: Carga desde Base de Datos

**Archivo:** `src/pages/EvaluacionDetalle.tsx` (ejemplo de carga)

**Líneas relevantes:**
- **210-211:** Lectura de `ai_report` desde `evaluacion_generada`

**Evidencia encontrada:**
```typescript
// Línea 210-211: Lee ai_report
const aiReportPayload = evaluacion.evaluacion_generada?.ai_report || evaluacion.ai_design_report || null;
```

**Problema identificado #2:**
- En `EvaluacionesGrupo.tsx` (página principal de generación), **NO HAY CÓDIGO QUE CARGUE** `aiDesignReport` desde la DB cuando se abre una evaluación existente
- Solo se carga cuando se genera una nueva evaluación (línea 1448-1458)
- Si el usuario guarda y luego recarga la página, `aiDesignReport` será `null`

---

#### Etapa 5: Conversión y Adaptación

**Archivo:** `src/services/evaluations/requestService.ts`

**Líneas relevantes:**
- **384-400:** Función `requestV2()` que convierte la respuesta

**Evidencia encontrada:**
```typescript
// Línea 384-400: Convierte V2 a formato compatible
const { evaluationBundle, studentAssignments } = convertV2ToV1Format(v2Response);

return {
  success: true,
  evaluationBundle,
  aiReport: v2Response.aiReport,  // ✅ PASA aiReport DIRECTAMENTE
  // ...
};
```

**Conclusión:** El `aiReport` se pasa directamente sin modificación. ✅

---

#### Etapa 6: Renderizado en UI

**Archivo:** `src/components/evaluaciones/AIDesignReport.tsx`

**Líneas relevantes:**
- **78-79:** Verificación de `narrative`
- **110-125:** Renderizado condicional

**Evidencia encontrada:**
```typescript
// Línea 78-79: Verifica narrative
const hasNarrative = reportData.narrative && reportData.narrative.trim().length > 0;

// Línea 110-125: Renderiza narrative si existe
{hasNarrative && (
  <div className="space-y-2">
    <div className="prose prose-sm max-w-none">
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
        {reportData.narrative}
      </p>
    </div>
  </div>
)}
```

**Problema identificado #3:**
- El componente `AIDesignReport` SÍ verifica `reportData.narrative` correctamente
- **PERO:** En modo V2, se usa `V2InfoPanels` que tiene su propio `V2AIReportPanel` (línea 2755 de `EvaluacionesGrupo.tsx`)
- `V2AIReportPanel` (línea 315-429 de `V2InfoPanels.tsx`) **NO VERIFICA `narrative`**, solo muestra campos legacy

**Evidencia crítica:**
```typescript
// V2InfoPanels.tsx línea 350-429: V2AIReportPanel
// ❌ NO HAY VERIFICACIÓN DE aiReport.narrative
// Solo muestra:
// - aiReport?.designRationale
// - aiReport?.versionsExplanation
// - aiReport?.contemplacionesApplied
// - aiReport?.responseOptions
// - aiReport?.varkSummary
```

---

### B) Pipeline de Datos: Opciones de Respuesta Equivalentes

#### Etapa 1: Generación (Edge Function)

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**Líneas relevantes:**
- **488-492:** Instrucciones en system prompt sobre `equivalentResponseOptions`
- **613-615:** Instrucciones específicas para items de desarrollo

**Evidencia encontrada:**
```typescript
// Línea 488-492: Instrucciones en prompt
${responseOptionsInclude ? `
- OBLIGATORIO: Items de desarrollo (essay, paragraph) DEBEN incluir equivalentResponseOptions con ${responseOptionCount} opciones.
- Cada opción representa un formato diferente pero equivalente en evidencia y dificultad.
` : '- NO incluir equivalentResponseOptions en ningún item.'}

// Línea 664: Menciona en tipos de items
- essay: Puede incluir "guidingQuestions", "equivalentResponseOptions"
```

**Problema identificado #4:**
- El prompt solo menciona `essay` y `paragraph`
- **NO menciona** `source_analysis` ni `true_false_justify`, que también son comprehension/process items según el plan de implementación
- El prompt dice "Items de desarrollo (essay, paragraph)" pero debería decir "Items de comprensión/proceso (essay, paragraph, source_analysis, true_false_justify)"

---

#### Etapa 2: Validación

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**Líneas relevantes:**
- **267-407:** Función `validateAndNormalizeSpec()`

**Evidencia encontrada:**
- **NO HAY VALIDACIÓN** de `equivalentResponseOptions` en `validateAndNormalizeSpec()`
- No se verifica que haya exactamente 3 opciones
- No se verifica que las opciones sean context-appropriate

**Problema identificado #5:**
- La validación de `equivalentResponseOptions` que se documentó en el plan de implementación **NO FUE IMPLEMENTADA**

---

#### Etapa 3: Normalización (Frontend)

**Archivo:** `src/services/evaluations/v2Normalizer.ts`

**Líneas relevantes:**
- **305-322:** Conversión de `equivalentResponseOptions` a `responseOptions`

**Evidencia encontrada:**
```typescript
// Línea 305-322: Normaliza equivalentResponseOptions
if (item.equivalentResponseOptions && typeof item.equivalentResponseOptions === 'object') {
  const ero = item.equivalentResponseOptions as Record<string, unknown>;
  if (ero.enabled === true && Array.isArray(ero.options)) {
    normalized.responseOptions = {
      enabled: true,
      options: ero.options.map(...),
      metacognitionText: safeString(ero.metacognitionText),
    };
  }
}
```

**Conclusión:** La normalización está correcta. ✅

---

#### Etapa 4: Renderizado en UI

**Archivo:** `src/components/evaluaciones/v2/EvalItem.tsx`

**Líneas relevantes:**
- **58-62:** Renderizado de `responseOptions`

**Evidencia encontrada:**
```typescript
// Línea 58-62: Renderiza responseOptions
{item.responseOptions?.enabled && (
  <div className="mt-4">
    <ResponseOptions options={item.responseOptions} />
  </div>
)}
```

**Conclusión:** El renderizado está correcto. ✅

---

## 4. Formas de Datos Encontradas en Cada Etapa

### Reporte Narrativo

| Etapa | Campo | Forma de Datos | Evidencia |
|-------|-------|----------------|-----------|
| **1. Generación (Edge)** | `result.spec.aiReport.narrative` | `string \| undefined` | Línea 1303 |
| **2. Respuesta Edge** | `response.aiReport.narrative` | `string \| undefined` | Línea 1330 |
| **3. Frontend Service** | `data.aiReport.narrative` | `string \| undefined` | Línea 390 de requestService.ts |
| **4. Guardado DB** | `evaluacion_generada.ai_report.narrative` | `string \| undefined` (dentro de JSONB) | Línea 614 |
| **5. Carga DB** | `evaluacion.evaluacion_generada?.ai_report?.narrative` | `string \| undefined` | EvaluacionDetalle.tsx:211 |
| **6. UI Component (V1)** | `reportData.narrative` | `string \| undefined` | AIDesignReport.tsx:79 |
| **7. UI Component (V2)** | `aiReport.narrative` | `string \| undefined` | **❌ NO SE VERIFICA** (V2InfoPanels.tsx:350) |

### Opciones de Respuesta Equivalentes

| Etapa | Campo | Forma de Datos | Evidencia |
|-------|-------|----------------|-----------|
| **1. Generación (Edge)** | `item.equivalentResponseOptions` | `{ enabled: boolean, options: Array, metacognitionText: string } \| undefined` | Línea 62-66 |
| **2. Respuesta Edge** | `spec.sections[].items[].equivalentResponseOptions` | Mismo que arriba | Incluido en spec |
| **3. Normalización** | `normalizedItem.responseOptions` | `{ enabled: boolean, options: Array, metacognitionText: string } \| undefined` | v2Normalizer.ts:309 |
| **4. Renderizado UI** | `item.responseOptions` | Mismo que arriba | EvalItem.tsx:59 |

---

## 5. Causas Raíz Identificadas

### Causa Raíz #1: V2AIReportPanel No Verifica `narrative` (SÍNTOMA 1)

**Archivo:** `src/components/evaluaciones/v2/V2InfoPanels.tsx`  
**Líneas:** 315-429

**Problema:**
- El componente `V2AIReportPanel` solo renderiza campos legacy estructurados
- **NO verifica** si `aiReport.narrative` existe
- **NO renderiza** el narrativo cuando está disponible

**Evidencia:**
```typescript
// V2InfoPanels.tsx línea 350-429
// Solo renderiza:
{aiReport?.designRationale && ...}  // Línea 353
{aiReport?.versionsExplanation && ...}  // Línea 363
{aiReport?.contemplacionesApplied && ...}  // Línea 386
{aiReport?.responseOptions && ...}  // Línea 409
{aiReport?.varkSummary && ...}  // Línea 422

// ❌ NO HAY:
{aiReport?.narrative && ...}
```

**Impacto:** CRÍTICO - El narrativo nunca se muestra en modo V2

---

### Causa Raíz #2: Falta Carga de `aiDesignReport` desde DB en EvaluacionesGrupo (SÍNTOMA 1)

**Archivo:** `src/pages/EvaluacionesGrupo.tsx`

**Problema:**
- Cuando se genera una evaluación nueva, `aiDesignReport` se setea desde `data.aiReport` (línea 1451)
- **PERO:** No hay código que cargue `aiDesignReport` desde la DB cuando:
  - El usuario recarga la página después de guardar
  - El usuario abre una evaluación existente desde "Mis Evaluaciones"
  - El usuario navega de vuelta a la página de generación

**Evidencia:**
- No hay `useEffect` que cargue `evaluacion_generada.ai_report` o `ai_design_report` desde Supabase
- Solo se carga cuando se genera nueva evaluación

**Impacto:** ALTO - El narrativo se pierde al recargar la página

---

### Causa Raíz #3: Prompt No Incluye Todos los Tipos de Items (SÍNTOMA 2)

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`  
**Líneas:** 488-492, 613-615, 664

**Problema:**
- El prompt solo menciona `essay` y `paragraph` como items que deben incluir `equivalentResponseOptions`
- **NO menciona** `source_analysis` ni `true_false_justify`
- Según el plan de implementación, estos 4 tipos son "comprehension/process items"

**Evidencia:**
```typescript
// Línea 613-615: Solo menciona essay, paragraph
- OBLIGATORIO: Items de desarrollo (essay, paragraph) DEBEN incluir equivalentResponseOptions

// Línea 664: Solo menciona essay
- essay: Puede incluir "guidingQuestions", "equivalentResponseOptions"
```

**Impacto:** ALTO - El modelo no genera opciones para `source_analysis` y `true_false_justify`

---

### Causa Raíz #4: Falta Validación de `equivalentResponseOptions` (SÍNTOMA 2)

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`  
**Función:** `validateAndNormalizeSpec()` (línea 267)

**Problema:**
- No hay validación que verifique:
  - Que items de comprensión/proceso tengan `equivalentResponseOptions` cuando `responseOptionsInclude === true`
  - Que haya exactamente 3 opciones
  - Que las opciones sean context-appropriate

**Evidencia:**
- La función `validateEquivalentResponseOptions()` documentada en el plan **NO FUE IMPLEMENTADA**
- Solo se valida `versionedContent` para Version B (línea 320-353)

**Impacto:** MEDIO - No se detectan errores de generación, pero no impide que funcione si el modelo genera correctamente

---

### Causa Secundaria #1: Inconsistencia en Rutas de Datos

**Problema:**
- El narrativo se guarda en dos lugares:
  - `evaluacion_generada.ai_report.narrative` (dentro de JSONB)
  - `ai_design_report.narrative` (columna separada JSONB)
- Al cargar, se lee desde `evaluacion_generada?.ai_report || ai_design_report`
- **PERO:** En `EvaluacionesGrupo.tsx`, no se carga desde ningún lugar

**Impacto:** MEDIO - Contribuye a la pérdida del narrativo al recargar

---

### Causa Secundaria #2: Falta Verificación de `responseOptionsInclude` en UI

**Archivo:** `src/pages/EvaluacionesGrupo.tsx`

**Problema:**
- No hay verificación visible en la UI de si `responseOptionsInclude` está activado
- El usuario no puede confirmar si la opción está habilitada antes de generar

**Impacto:** BAJO - No impide funcionalidad, pero dificulta debugging

---

## 6. Causa Más Probable por Síntoma

### Síntoma 1: Narrative No Aparece

**Causa más probable:** **Causa Raíz #1** - `V2AIReportPanel` no verifica `narrative`

**Razón:**
- El narrativo SÍ se genera en el edge function (evidencia en línea 1330)
- El narrativo SÍ se incluye en la respuesta (evidencia en línea 390 de requestService.ts)
- El narrativo SÍ se guarda en la DB (evidencia en línea 614)
- **PERO:** `V2AIReportPanel` nunca verifica `aiReport.narrative`, solo muestra campos legacy

**Causas secundarias que contribuyen:**
- Causa Raíz #2: Falta carga desde DB (afecta al recargar página)
- Causa Secundaria #1: Inconsistencia en rutas de datos

---

### Síntoma 2: Equivalent Response Options No Aparecen

**Causa más probable:** **Causa Raíz #3** - Prompt no incluye todos los tipos de items

**Razón:**
- El prompt solo instruye al modelo para generar opciones en `essay` y `paragraph`
- No menciona `source_analysis` ni `true_false_justify`
- El modelo probablemente no está generando opciones para estos tipos

**Causas secundarias que contribuyen:**
- Causa Raíz #4: Falta validación (no detecta el problema, pero no lo causa)

---

## 7. Direcciones de Fix Propuestas (Alto Nivel)

### Fix #1: Agregar Verificación de `narrative` en V2AIReportPanel

**Archivo:** `src/components/evaluaciones/v2/V2InfoPanels.tsx`

**Cambio:**
- Agregar verificación de `aiReport.narrative` al inicio de `V2AIReportPanel`
- Si existe, renderizar el narrativo (similar a `AIDesignReport.tsx`)
- Si no existe, mostrar campos legacy (fallback)

**Líneas a modificar:** ~315-429

---

### Fix #2: Agregar Carga de `aiDesignReport` desde DB en EvaluacionesGrupo

**Archivo:** `src/pages/EvaluacionesGrupo.tsx`

**Cambio:**
- Agregar `useEffect` que cargue `evaluacion_generada.ai_report` o `ai_design_report` desde Supabase
- Setear `aiDesignReport` state con el valor cargado
- Ejecutar cuando:
  - La página se monta y hay un `evaluationId` en la URL
  - El usuario navega desde "Mis Evaluaciones"

**Líneas a agregar:** Después de los `useEffect` existentes

---

### Fix #3: Actualizar Prompt para Incluir Todos los Tipos de Items

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**Cambio:**
- Actualizar línea 613-615 para mencionar: `essay, paragraph, source_analysis, true_false_justify`
- Actualizar línea 664 para mencionar todos los tipos que pueden incluir `equivalentResponseOptions`

**Líneas a modificar:** ~488-492, ~613-615, ~664

---

### Fix #4: Implementar Validación de `equivalentResponseOptions`

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**Cambio:**
- Agregar función `validateEquivalentResponseOptions()` (como se documentó en el plan)
- Llamarla desde `validateAndNormalizeSpec()` para cada item
- Validar:
  - Que items de comprensión/proceso tengan opciones cuando `responseOptionsInclude === true`
  - Que haya exactamente 3 opciones
  - Agregar warnings si falta

**Líneas a agregar:** Después de `validateAndNormalizeSpec()` (nueva función)

---

## 8. Checklist de Reproducción

### Para Reproducir Síntoma 1 (Narrative No Aparece)

1. ✅ Navegar a `/evaluaciones/nuevo`
2. ✅ Seleccionar grupo (ej: "9no1")
3. ✅ Seleccionar materia (ej: "Historia")
4. ✅ Seleccionar contenidos, competencias, criterios
5. ✅ Activar "Usar V2" (toggle `useBetaV2`)
6. ✅ Hacer click en "Generar Evaluación"
7. ✅ Esperar a que se genere
8. ✅ Verificar en la consola del navegador:
   - `[EVAL_PIPELINE] Using aiReport from response` (debe aparecer)
   - `data.aiReport.narrative` debe existir (verificar en Network tab)
9. ✅ Verificar en la UI:
   - En modo V2, el panel "Reporte de diseño de IA" muestra campos legacy (Justificación, Versiones, Contemplaciones)
   - **NO muestra** texto narrativo continuo
10. ✅ Guardar la evaluación
11. ✅ Recargar la página
12. ✅ Verificar que el narrativo sigue sin aparecer (también se pierde al recargar)

### Para Reproducir Síntoma 2 (Equivalent Response Options No Aparecen)

1. ✅ Navegar a `/evaluaciones/nuevo`
2. ✅ Seleccionar grupo (ej: "9no1")
3. ✅ Seleccionar materia (ej: "Historia")
4. ✅ Seleccionar contenidos, competencias, criterios
5. ✅ **Activar "Incluir opciones de respuesta equivalentes"** (si existe el toggle)
6. ✅ Activar "Usar V2" (toggle `useBetaV2`)
7. ✅ Hacer click en "Generar Evaluación"
8. ✅ Esperar a que se genere
9. ✅ Verificar en la consola:
   - `responseOptionsInclude: true` en el payload (línea 1077-1081)
   - En la respuesta del edge function, verificar que items `essay` o `paragraph` tengan `equivalentResponseOptions`
10. ✅ Verificar en la UI:
   - Items de tipo `essay` o `paragraph` **NO muestran** las 3 opciones equivalentes
   - Items de tipo `source_analysis` o `true_false_justify` tampoco muestran opciones
11. ✅ Verificar en Network tab:
   - `v2Response.evaluationSpec.sections[].items[].equivalentResponseOptions` debe existir para items de comprensión/proceso

### Verificaciones Adicionales

**Para confirmar que el narrativo se genera:**
- Abrir Network tab → buscar llamada a `modify-evaluation-v2`
- Verificar en la respuesta: `data.aiReport.narrative` debe ser un string de 200-400 palabras
- Verificar en la consola: `console.log(data.aiReport)` debe mostrar `narrative: "..."`

**Para confirmar que equivalentResponseOptions se genera:**
- Abrir Network tab → buscar llamada a `modify-evaluation-v2`
- Verificar en la respuesta: `data.evaluationSpec.sections[0].items[0].equivalentResponseOptions` debe existir para items `essay` o `paragraph`
- Verificar que `equivalentResponseOptions.options.length === 3`

---

## 9. Evidencia de Código (Referencias Exactas)

### Reporte Narrativo

| Ubicación | Línea | Código Relevante |
|-----------|-------|------------------|
| Edge function - Extracción | 1299-1306 | `if (result.spec.aiReport && typeof result.spec.aiReport === 'object')` |
| Edge function - Fallback | 1308-1321 | `if (!narrative) { narrative = await generateNarrativeReportFallback(...) }` |
| Edge function - Respuesta | 1330 | `...(narrative ? { narrative } : {})` |
| Frontend service - Paso | 390 | `aiReport: v2Response.aiReport` |
| Frontend - Seteo state | 1451 | `setAiDesignReport(JSON.stringify(data.aiReport))` |
| Frontend - Guardado | 614 | `ai_report: aiDesignReport ? JSON.parse(aiDesignReport) : null` |
| UI Component V1 - Verificación | 79 | `const hasNarrative = reportData.narrative && reportData.narrative.trim().length > 0` |
| UI Component V2 - **FALTA** | 350-429 | **NO HAY verificación de `aiReport.narrative`** |

### Opciones de Respuesta Equivalentes

| Ubicación | Línea | Código Relevante |
|-----------|-------|------------------|
| Edge function - Prompt | 613-615 | `Items de desarrollo (essay, paragraph) DEBEN incluir equivalentResponseOptions` |
| Edge function - Tipos | 664 | `essay: Puede incluir "guidingQuestions", "equivalentResponseOptions"` |
| Edge function - Validación | 267-407 | **NO HAY validación de equivalentResponseOptions** |
| Frontend - Normalización | 306-322 | `if (item.equivalentResponseOptions && typeof item.equivalentResponseOptions === 'object')` |
| Frontend - Renderizado | 59 | `{item.responseOptions?.enabled && <ResponseOptions options={item.responseOptions} />}` |

---

## 10. Resumen Ejecutivo

### Problemas Críticos

1. **V2AIReportPanel no verifica `narrative`** → El narrativo nunca se muestra en modo V2
2. **Falta carga de `aiDesignReport` desde DB** → El narrativo se pierde al recargar
3. **Prompt incompleto para equivalentResponseOptions** → El modelo no genera opciones para `source_analysis` y `true_false_justify`

### Problemas Secundarios

4. **Falta validación de equivalentResponseOptions** → No se detectan errores de generación
5. **Inconsistencia en rutas de datos** → Contribuye a pérdida de datos

### Prioridad de Fixes

1. **ALTA:** Fix #1 (V2AIReportPanel) - Bloquea completamente la funcionalidad
2. **ALTA:** Fix #2 (Carga desde DB) - Afecta persistencia
3. **MEDIA:** Fix #3 (Prompt completo) - Afecta funcionalidad parcial
4. **BAJA:** Fix #4 (Validación) - Mejora calidad pero no bloquea

---

**Fin del Análisis**
