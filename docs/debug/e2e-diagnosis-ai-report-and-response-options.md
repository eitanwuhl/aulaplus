# Diagnóstico End-to-End: Reporte Narrativo y Opciones de Respuesta Equivalentes

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Objetivo:** Identificar por qué el reporte narrativo y las opciones de respuesta equivalentes no aparecen en la UI V2

---

## Resumen Ejecutivo

Este diagnóstico analiza el flujo completo de datos desde la generación hasta el renderizado en la UI para identificar las causas raíz de dos problemas:

1. **V2 AI Report panel muestra UI legacy** en lugar de narrativo
2. **Opciones de respuesta equivalentes no aparecen** en items V2

**Metodología:** Análisis basado en evidencia del código, estructura de datos, y flujos de transformación.

---

## A) Flujo de Request Payload

### A1) Construcción del Payload

**Archivo:** `src/pages/EvaluacionesGrupo.tsx`

**Líneas relevantes:** ~1102-1128, ~1136-1138

**Evidencia del código:**
```typescript
// Línea ~1123-1126: Construcción del payload
responseOptions: {
  include: effectivePlan.responseOptions.include,
  optionCount: effectivePlan.responseOptions.optionCount
}

// Línea ~1136-1138: Log del payload
responseOptionsInclude: effectivePlan.responseOptions.include,
```

**Campo en request:** `responseOptions.include` (boolean)  
**Campo en request:** `responseOptions.optionCount` (number, default: 2)

**Verificación requerida:**
- ✅ Confirmar que `effectivePlan.responseOptions.include === true` cuando el toggle está activado
- ✅ Confirmar que el payload enviado a `modify-evaluation-v2` contiene `responseOptions: { include: true, optionCount: 3 }`

**Punto de verificación:** Network tab → Request payload → `responseOptions.include`

---

### A2) Lectura en Edge Function

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**Líneas relevantes:** ~1214-1218

**Evidencia del código:**
```typescript
// Línea ~1215-1218: Extracción del payload
const responseOptions = designPlan.responseOptions || {};
const responseOptionsInclude = responseOptions.include === true;
const responseOptionCount = [2, 3].includes(responseOptions.optionCount)
  ? responseOptions.optionCount
  : 2;
```

**Variable usada:** `responseOptionsInclude` (boolean)  
**Variable usada:** `responseOptionCount` (number, default: 2)

**Verificación requerida:**
- ✅ Confirmar que `responseOptions.include` se lee correctamente del payload
- ✅ Confirmar que `responseOptionCount` es 3 cuando se solicita

**Punto de verificación:** Edge function logs → `responseOptionsInclude: true`, `responseOptionCount: 3`

---

## B) Flujo de AI Report Narrative

### B1) Generación en Edge Function

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**Líneas relevantes:** ~1299-1331

**Evidencia del código:**
```typescript
// Línea ~1299-1306: Extracción del narrative del spec
let narrative: string | undefined = undefined;
if (result.spec.aiReport && typeof result.spec.aiReport === 'object') {
  const specAiReport = result.spec.aiReport as Record<string, unknown>;
  if (typeof specAiReport.narrative === 'string' && specAiReport.narrative.trim().length >= 80) {
    narrative = specAiReport.narrative.trim();
  }
}

// Línea ~1308-1321: Generación de fallback si falta
if (!narrative) {
  narrative = await generateNarrativeReportFallback(...);
}

// Línea ~1330-1331: Inclusión en respuesta
aiReport: {
  ...(narrative ? { narrative } : {}),
  // ... otros campos
}
```

**Campo en respuesta:** `v2Response.aiReport.narrative` (string | undefined)

**Verificación requerida:**
- ✅ Confirmar que `result.spec.aiReport.narrative` existe en la respuesta del modelo
- ✅ Confirmar que `narrative` se incluye en `aiReport` de la respuesta final
- ✅ Confirmar que `narrative.length >= 80` después de trim

**Punto de verificación:** Network tab → Response JSON → `data.aiReport.narrative`

---

### B2) Paso desde Service a Frontend

**Archivo:** `src/services/evaluations/requestService.ts`

**Líneas relevantes:** ~390

**Evidencia del código:**
```typescript
// Línea ~390: Paso directo de aiReport
return {
  success: true,
  evaluationBundle,
  aiReport: v2Response.aiReport,  // ✅ PASA DIRECTAMENTE
  // ...
};
```

**Campo en resultado:** `data.aiReport` (AIReportV2 | null)

**Verificación requerida:**
- ✅ Confirmar que `v2Response.aiReport` se pasa directamente sin modificación
- ✅ Confirmar que `data.aiReport.narrative` existe en el resultado

**Punto de verificación:** Console log → `[EVAL_PIPELINE] V2 Response structure` → `hasAiReport: true`

---

### B3) Seteo en State (EvaluacionesGrupo)

**Archivo:** `src/pages/EvaluacionesGrupo.tsx`

**Líneas relevantes:** ~1236, ~1496-1505

**Evidencia del código:**
```typescript
// Línea ~1236: Seteo desde v2Response
aiReport: v2Response.aiReport,

// Línea ~1496-1505: Seteo en aiDesignReport state (V2)
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
```

**State:** `aiDesignReport` (string | null) - JSON stringificado

**Problema potencial identificado:**
- ⚠️ **V2 NO USA `aiDesignReport` state** - V2 usa `v2RawResponse` directamente
- ⚠️ El state `aiDesignReport` se setea pero **NO se usa** en modo V2

**Verificación requerida:**
- ✅ Confirmar que `v2RawResponse` se setea correctamente (línea ~1219)
- ✅ Confirmar que `v2RawResponse.aiReport.narrative` existe

**Punto de verificación:** Console log → `[EVAL_PIPELINE] V2 Response structure` → `hasAiReport: true`

---

### B4) Paso a V2InfoPanels

**Archivo:** `src/pages/EvaluacionesGrupo.tsx`

**Líneas relevantes:** ~2802-2806

**Evidencia del código:**
```typescript
// Línea ~2802-2806: Renderizado de V2InfoPanels
<V2InfoPanels 
  v2Response={v2RawResponse}
  students={selectedGroup?.students || []}
  studentAssignments={studentAssignments}
/>
```

**Prop pasada:** `v2Response` (V2Response completo)

**Verificación requerida:**
- ✅ Confirmar que `v2RawResponse` no es null
- ✅ Confirmar que `v2RawResponse.aiReport` existe

**Punto de verificación:** Console log → `[V2_INFO_PANELS] Rendering with response` → `hasAiReport: true`

---

### B5) Extracción en V2InfoPanels

**Archivo:** `src/components/evaluaciones/v2/V2InfoPanels.tsx`

**Líneas relevantes:** ~880, ~946-950

**Evidencia del código:**
```typescript
// Línea ~880: Extracción defensiva
const aiReport = v2Response?.aiReport ?? null;

// Línea ~946-950: Paso a V2AIReportPanel
<V2AIReportPanel
  aiReport={aiReport}
  instrumentDesignRulesApplied={instrumentDesignRulesApplied}
  warnings={warnings}
/>
```

**Prop pasada:** `aiReport` (AIReportV2 | null)

**Verificación requerida:**
- ✅ Confirmar que `aiReport` no es null
- ✅ Confirmar que `aiReport.narrative` existe y es string válido

**Punto de verificación:** Console log → `[V2_INFO_PANELS] Rendering with response` → `hasAiReport: true`

---

### B6) Verificación en V2AIReportPanel

**Archivo:** `src/components/evaluaciones/v2/V2InfoPanels.tsx`

**Líneas relevantes:** ~338-339

**Evidencia del código:**
```typescript
// Línea ~338-339: Verificación de narrative
const hasNarrative = aiReport?.narrative && typeof aiReport.narrative === 'string' && aiReport.narrative.trim().length >= 80;
```

**Condición:** `hasNarrative` (boolean)

**Problema potencial identificado:**
- ⚠️ **VERIFICACIÓN CORRECTA** - El código verifica correctamente
- ⚠️ **RENDERIZADO CONDICIONAL CORRECTO** - Renderiza narrativo si existe, legacy si no

**Verificación requerida:**
- ✅ Agregar console log temporal: `console.log('[V2_AI_REPORT] aiReport:', aiReport, 'hasNarrative:', hasNarrative)`
- ✅ Confirmar que `aiReport.narrative` existe en el momento de renderizado
- ✅ Confirmar que `hasNarrative === true` cuando narrative existe

**Punto de verificación:** Console log temporal en V2AIReportPanel

---

## C) Flujo de Equivalent Response Options

### C1) Generación en Edge Function

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**Líneas relevantes:** ~612-615 (prompt), ~268-350 (validación)

**Evidencia del código:**
```typescript
// Línea ~613-615: Instrucción en prompt
- OBLIGATORIO: Items de comprensión/proceso (essay, paragraph, source_analysis, true_false_justify) DEBEN incluir equivalentResponseOptions con exactamente ${responseOptionCount} opciones.

// Línea ~268-350: Validación y normalización
function validateEquivalentResponseOptions(
  item: Record<string, unknown>,
  itemType: string,
  itemId: string,
  responseOptionsInclude: boolean,
  expectedCount: number,
  warnings: WarningV2[]
): void {
  // Valida presencia, cantidad, y normaliza
}
```

**Campo en spec:** `item.equivalentResponseOptions` (object | undefined)

**Verificación requerida:**
- ✅ Confirmar que el prompt incluye la instrucción para todos los tipos
- ✅ Confirmar que la validación se ejecuta para cada item
- ✅ Confirmar que `equivalentResponseOptions` se genera en items de comprensión/proceso

**Punto de verificación:** Network tab → Response JSON → `data.evaluationSpec.sections[].items[].equivalentResponseOptions`

---

### C2) Estructura en Spec

**Archivo:** `src/services/evaluations/v2Types.ts`

**Líneas relevantes:** ~62-66

**Evidencia del código:**
```typescript
// Línea ~62-66: Tipo en EvaluationItemV2
equivalentResponseOptions?: {
  enabled: boolean;
  options: Array<{
    format: string;
    description: string;
  }>;
  metacognitionText?: string;
};
```

**Estructura esperada:**
```json
{
  "equivalentResponseOptions": {
    "enabled": true,
    "options": [
      { "format": "essay", "description": "..." },
      { "format": "analysis_table", "description": "..." },
      { "format": "brief_written", "description": "..." }
    ],
    "metacognitionText": "..."
  }
}
```

**Verificación requerida:**
- ✅ Confirmar que `equivalentResponseOptions.enabled === true`
- ✅ Confirmar que `equivalentResponseOptions.options.length === 3`
- ✅ Confirmar que cada opción tiene `format` y `description`

**Punto de verificación:** Network tab → Response JSON → `data.evaluationSpec.sections[0].items[0].equivalentResponseOptions`

---

### C3) Normalización en Frontend

**Archivo:** `src/services/evaluations/v2Normalizer.ts`

**Líneas relevantes:** ~305-322

**Evidencia del código:**
```typescript
// Línea ~305-322: Normalización de equivalentResponseOptions
if (item.equivalentResponseOptions && typeof item.equivalentResponseOptions === 'object') {
  const ero = item.equivalentResponseOptions as Record<string, unknown>;
  if (ero.enabled === true && Array.isArray(ero.options)) {
    normalized.responseOptions = {
      enabled: true,
      options: ero.options.map((opt: unknown) => {
        const o = opt as Record<string, unknown>;
        return {
          id: safeString(o?.id, ''),
          format: safeString(o?.format, ''),
          description: safeString(o?.description, ''),
        };
      }).filter(o => o.format || o.description),
      metacognitionText: safeString(ero.metacognitionText),
    };
  }
}
```

**Transformación:** `equivalentResponseOptions` → `responseOptions`

**Verificación requerida:**
- ✅ Confirmar que la normalización se ejecuta para items con `equivalentResponseOptions`
- ✅ Confirmar que `normalized.responseOptions.enabled === true`
- ✅ Confirmar que `normalized.responseOptions.options.length === 3`

**Punto de verificación:** Console log temporal en v2Normalizer → `normalized.responseOptions`

---

### C4) Renderizado en EvalItem

**Archivo:** `src/components/evaluaciones/v2/EvalItem.tsx`

**Líneas relevantes:** ~58-63

**Evidencia del código:**
```typescript
// Línea ~58-63: Renderizado condicional
{item.responseOptions?.enabled && (
  <div className="ml-10">
    <ResponseOptions options={item.responseOptions} />
  </div>
)}
```

**Condición:** `item.responseOptions?.enabled === true`

**Verificación requerida:**
- ✅ Agregar console log temporal: `console.log('[EVAL_ITEM] item:', item, 'responseOptions:', item.responseOptions)`
- ✅ Confirmar que `item.responseOptions.enabled === true`
- ✅ Confirmar que `item.responseOptions.options.length === 3`

**Punto de verificación:** Console log temporal en EvalItem

---

## D) Análisis de Causas Raíz

### D1) Problema: Narrative No Aparece

#### Causa Raíz #1: V2AIReportPanel Recibe aiReport Correcto (ALTA CONFIANZA)

**Evidencia:**
- ✅ El código verifica `aiReport.narrative` correctamente (línea 339)
- ✅ El renderizado condicional está implementado (líneas 355-448)
- ✅ El flujo de datos es correcto: `v2Response` → `V2InfoPanels` → `V2AIReportPanel`

**Hipótesis:**
- `aiReport.narrative` **NO existe** en `v2Response.aiReport` en el momento de renderizado
- O `aiReport.narrative` existe pero es **muy corto** (< 80 caracteres)

**Verificación requerida:**
1. Agregar console log en V2AIReportPanel:
   ```typescript
   console.log('[V2_AI_REPORT] aiReport:', aiReport);
   console.log('[V2_AI_REPORT] narrative:', aiReport?.narrative);
   console.log('[V2_AI_REPORT] hasNarrative:', hasNarrative);
   ```
2. Verificar en Network tab que `data.aiReport.narrative` existe en la respuesta
3. Comparar el valor de `narrative` en Network vs Console

**Confianza:** ALTA - El código está correcto, el problema es probablemente de datos

---

#### Causa Raíz #2: Narrative No se Genera en Edge Function (MEDIA CONFIANZA)

**Evidencia:**
- ✅ El código genera fallback si narrative falta (línea ~1308-1321)
- ⚠️ El fallback puede fallar silenciosamente (catch en línea ~505-509)

**Hipótesis:**
- El modelo **NO genera** `aiReport.narrative` en el spec
- El fallback **falla** y retorna un string mínimo

**Verificación requerida:**
1. Verificar en Network tab que `data.evaluationSpec.aiReport.narrative` existe
2. Verificar logs del edge function para errores en `generateNarrativeReportFallback`
3. Verificar que el prompt incluye instrucciones para generar narrative (línea ~673-680)

**Confianza:** MEDIA - El fallback puede estar fallando silenciosamente

---

#### Causa Raíz #3: Narrative se Pierde en Transformación (BAJA CONFIANZA)

**Evidencia:**
- ✅ `v2Response.aiReport` se pasa directamente sin modificación (línea 390 de requestService.ts)
- ✅ `V2InfoPanels` extrae `aiReport` correctamente (línea 880)

**Hipótesis:**
- El narrative se pierde en alguna transformación intermedia (poco probable)

**Verificación requerida:**
- Comparar `v2Response.aiReport.narrative` en diferentes puntos del flujo

**Confianza:** BAJA - El flujo es directo, no hay transformaciones intermedias

---

### D2) Problema: Equivalent Response Options No Aparecen

#### Causa Raíz #1: Options No se Generan en Edge Function (ALTA CONFIANZA)

**Evidencia:**
- ✅ El prompt incluye instrucciones para generar options (línea ~613-615)
- ✅ La validación normaliza si faltan (línea ~268-350)
- ⚠️ El modelo puede **ignorar** las instrucciones del prompt

**Hipótesis:**
- El modelo **NO genera** `equivalentResponseOptions` en items de comprensión/proceso
- O genera pero con estructura incorrecta

**Verificación requerida:**
1. Verificar en Network tab que `data.evaluationSpec.sections[].items[].equivalentResponseOptions` existe
2. Verificar que items de tipo `essay`, `paragraph`, `source_analysis`, `true_false_justify` tienen options
3. Verificar que `responseOptionsInclude === true` en el request payload

**Confianza:** ALTA - El modelo puede no estar siguiendo las instrucciones

---

#### Causa Raíz #2: Options No se Normalizan Correctamente (MEDIA CONFIANZA)

**Evidencia:**
- ✅ El código de normalización está correcto (línea ~305-322)
- ⚠️ La normalización puede fallar si la estructura es incorrecta

**Hipótesis:**
- `equivalentResponseOptions` existe pero tiene estructura incorrecta
- La normalización falla silenciosamente (filter elimina todas las opciones)

**Verificación requerida:**
1. Agregar console log en v2Normalizer:
   ```typescript
   console.log('[V2_NORMALIZER] item.equivalentResponseOptions:', item.equivalentResponseOptions);
   console.log('[V2_NORMALIZER] normalized.responseOptions:', normalized.responseOptions);
   ```
2. Verificar que `ero.enabled === true` y `ero.options` es array
3. Verificar que el filter no elimina todas las opciones

**Confianza:** MEDIA - La normalización puede fallar si la estructura es incorrecta

---

#### Causa Raíz #3: Options No se Renderizan (BAJA CONFIANZA)

**Evidencia:**
- ✅ El código de renderizado está correcto (línea ~58-63)
- ✅ La condición `item.responseOptions?.enabled` es correcta

**Hipótesis:**
- `item.responseOptions.enabled === false` o `undefined`
- O el componente `ResponseOptions` tiene un bug

**Verificación requerida:**
1. Agregar console log en EvalItem:
   ```typescript
   console.log('[EVAL_ITEM] item:', item);
   console.log('[EVAL_ITEM] responseOptions:', item.responseOptions);
   console.log('[EVAL_ITEM] shouldRender:', item.responseOptions?.enabled);
   ```
2. Verificar que `item.responseOptions.enabled === true`
3. Verificar que `ResponseOptions` se renderiza correctamente

**Confianza:** BAJA - El código de renderizado es simple y correcto

---

## E) Plan de Verificación (Pasos Concretos)

### E1) Verificar Request Payload

**Pasos:**
1. Abrir Chrome DevTools → Network tab
2. Filtrar por `modify-evaluation-v2`
3. Generar evaluación V2 con "Incluir opciones de respuesta equivalentes" activado
4. Inspeccionar Request payload:
   - ✅ Verificar `responseOptions.include === true`
   - ✅ Verificar `responseOptions.optionCount === 3`
   - ✅ Verificar `useBetaV2 === true` (si aplica)

**Evidencia esperada:**
```json
{
  "responseOptions": {
    "include": true,
    "optionCount": 3
  }
}
```

---

### E2) Verificar Response JSON

**Pasos:**
1. En Network tab, inspeccionar Response JSON
2. Verificar estructura:
   - ✅ `data.aiReport.narrative` existe y es string ≥ 80 caracteres
   - ✅ `data.evaluationSpec.sections[].items[].equivalentResponseOptions` existe para items de comprensión/proceso
   - ✅ `data.evaluationSpec.sections[].items[].equivalentResponseOptions.options.length === 3`

**Evidencia esperada:**
```json
{
  "aiReport": {
    "narrative": "Esta evaluación fue diseñada para..."
  },
  "evaluationSpec": {
    "sections": [
      {
        "items": [
          {
            "type": "essay",
            "equivalentResponseOptions": {
              "enabled": true,
              "options": [
                { "format": "essay", "description": "..." },
                { "format": "analysis_table", "description": "..." },
                { "format": "brief_written", "description": "..." }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

---

### E3) Verificar Console Logs

**Pasos:**
1. Agregar console logs temporales (NO commit):
   - En `V2AIReportPanel`: log `aiReport` y `hasNarrative`
   - En `v2Normalizer`: log `item.equivalentResponseOptions` y `normalized.responseOptions`
   - En `EvalItem`: log `item.responseOptions`
2. Generar evaluación V2
3. Revisar console logs

**Evidencia esperada:**
```
[V2_AI_REPORT] aiReport: { narrative: "...", ... }
[V2_AI_REPORT] hasNarrative: true
[V2_NORMALIZER] normalized.responseOptions: { enabled: true, options: [...] }
[EVAL_ITEM] item.responseOptions: { enabled: true, options: [...] }
```

---

### E4) Verificar DB Persistence

**Pasos:**
1. Generar evaluación V2 con narrative
2. Guardar la evaluación
3. Abrir Supabase dashboard
4. Buscar la fila en tabla `evaluaciones`
5. Verificar:
   - ✅ `evaluacion_generada.ai_report.narrative` existe
   - ✅ `ai_design_report.narrative` existe (si se guarda en columna separada)

**Evidencia esperada:**
```json
{
  "evaluacion_generada": {
    "ai_report": {
      "narrative": "Esta evaluación fue diseñada para..."
    }
  }
}
```

---

## F) Causas Raíz Identificadas (Priorizadas)

### F1) Narrative No Aparece

**Causa más probable:** **Narrative no se genera en edge function** (Confianza: ALTA)

**Razón:**
- El modelo puede no estar generando `aiReport.narrative` en el spec
- O el fallback está fallando silenciosamente

**Evidencia requerida:**
- Verificar en Network tab que `data.evaluationSpec.aiReport.narrative` existe
- Verificar logs del edge function para errores

**Fix sugerido:**
- Mejorar el prompt para enfatizar la generación de narrative
- Agregar logging más detallado en el fallback
- Validar que narrative se genera antes de retornar respuesta

---

**Causa secundaria:** **Narrative existe pero es muy corto** (Confianza: MEDIA)

**Razón:**
- El modelo genera narrative pero < 80 caracteres
- La validación lo elimina (línea ~394-401)

**Evidencia requerida:**
- Verificar longitud de `narrative` en Network tab
- Verificar warnings en `v2Response.warnings` con código `NARRATIVE_TOO_SHORT`

**Fix sugerido:**
- Ajustar el umbral mínimo (80 → 50 caracteres) o mejorar el prompt

---

### F2) Equivalent Response Options No Aparecen

**Causa más probable:** **Options no se generan en edge function** (Confianza: ALTA)

**Razón:**
- El modelo puede no estar siguiendo las instrucciones del prompt
- O `responseOptionsInclude` no se está pasando correctamente

**Evidencia requerida:**
- Verificar en Network tab que `data.evaluationSpec.sections[].items[].equivalentResponseOptions` existe
- Verificar que `responseOptionsInclude === true` en el request payload

**Fix sugerido:**
- Mejorar el prompt para enfatizar la generación de options
- Agregar validación más estricta que falle si options faltan
- Agregar logging en la validación para detectar items sin options

---

**Causa secundaria:** **Options se generan pero no se normalizan** (Confianza: MEDIA)

**Razón:**
- La estructura de `equivalentResponseOptions` es incorrecta
- El filter elimina todas las opciones

**Evidencia requerida:**
- Verificar estructura de `equivalentResponseOptions` en Network tab
- Verificar console logs en v2Normalizer

**Fix sugerido:**
- Mejorar la normalización para manejar estructuras incorrectas
- Agregar logging detallado en la normalización

---

## G) Plan de Fix Prioritizado (Alto Nivel)

### G1) Fix Narrative (Prioridad: ALTA)

1. **Mejorar prompt en edge function:**
   - Enfatizar que `aiReport.narrative` es OBLIGATORIO
   - Especificar longitud mínima (200-400 palabras)
   - Agregar ejemplo en el prompt

2. **Mejorar fallback:**
   - Agregar logging detallado
   - Validar que narrative se genera antes de retornar
   - Retornar error si fallback falla

3. **Agregar validación estricta:**
   - Falla si narrative no existe después de fallback
   - Agregar warning si narrative es muy corto

---

### G2) Fix Equivalent Response Options (Prioridad: ALTA)

1. **Mejorar prompt en edge function:**
   - Enfatizar que `equivalentResponseOptions` es OBLIGATORIO para items de comprensión/proceso
   - Especificar que debe haber exactamente 3 opciones
   - Agregar ejemplo en el prompt

2. **Mejorar validación:**
   - Falla si options faltan cuando `responseOptionsInclude === true`
   - Agregar logging detallado para items sin options
   - Normalizar automáticamente si cantidad es incorrecta

3. **Agregar logging en frontend:**
   - Log en v2Normalizer cuando options se normalizan
   - Log en EvalItem cuando options se renderizan

---

## H) Conclusión

**Problemas identificados:**
1. ✅ Narrative: Probablemente no se genera en edge function o es muy corto
2. ✅ Equivalent Response Options: Probablemente no se generan en edge function

**Confianza en diagnóstico:**
- Narrative: ALTA - El código está correcto, el problema es de datos
- Options: ALTA - El modelo puede no estar siguiendo las instrucciones

**Próximos pasos:**
1. Ejecutar verificaciones en E) para confirmar causas
2. Implementar fixes en G) según prioridad
3. Agregar logging detallado para debugging futuro

---

**Fin del Diagnóstico**
