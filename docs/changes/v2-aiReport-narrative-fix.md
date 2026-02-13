# V2 AI Report Narrative Fix

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Tipo:** Bug Fix (Narrative Missing in HTTP Response)  
**Debug Build:** `mejorar-evaluaciones-aiReport-narrative-fix-1`

---

## Problema Identificado

`aiReport.narrative` no aparecía en la respuesta HTTP de V2, aunque el código intentaba generarlo. La API retornaba:

```json
{
  "aiReport": {
    "designRationale": "...",
    "versionsExplanation": { ... },
    "contemplacionesApplied": { ... },
    "responseOptions": { ... }
  }
}
```

Pero **NO** incluía `aiReport.narrative`, causando que el frontend `AIDesignReport.tsx` siempre mostrara el UI legacy estructurado en lugar del narrative.

### Causa Raíz

**Ubicación exacta del bug:** `supabase/functions/modify-evaluation-v2/index.ts`

1. **Líneas ~1701-1741:** El narrative se extraía de OpenAI o se generaba localmente y se asignaba a `baseAiReport.narrative`
2. **Líneas ~1787-1791:** Se llamaba `normalizeAiReportForFrontend()` que:
   - Verificaba `backendReport.narrative`
   - Si faltaba o estaba vacío, llamaba `buildNarrativeLocal()` **nuevamente**
   - Pero luego establecía `narrative: narrative || ''`, lo que podía resultar en un string vacío
3. **Línea ~318 (normalizeAiReportForFrontend):** El código establecía `narrative: narrative || ''`, lo que significa que si `narrative` era falsy, se convertía en un string vacío `''`
4. **Frontend:** El frontend verifica `reportData.narrative` y un string vacío puede ser considerado como "missing"

**Problemas específicos:**
- El narrative podía ser generado dos veces (una vez en el handler, otra en normalizeAiReportForFrontend)
- El narrative podía ser establecido como string vacío `''` en lugar de `undefined`
- No había logging para diagnosticar el flujo del narrative
- No había validación en tiempo de ejecución antes de retornar la respuesta

---

## Solución Implementada

### 1. Extracción Robusta de Narrative

**Cambios en líneas ~1701-1778:**

- **Tracking de fuente:** Agregado `narrativeSource: 'openai' | 'local' | 'none'` para rastrear de dónde viene el narrative
- **Extracción mejorada:** Verifica `result.spec.aiReport?.narrative` y valida que sea string no-vacío
- **Logging detallado:** Agregado `[AI_REPORT] narrative_len=<n>, narrative_source=<source>` tanto en `timer.log()` como en `console.log()`
- **Manejo de errores:** Si la generación local falla, establece `narrativeText = undefined` y `narrativeSource = 'none'`

### 2. Normalización Mejorada

**Cambios en líneas ~299-320 (normalizeAiReportForFrontend):**

**ANTES:**
```typescript
let narrative = backendReport.narrative;
if (!narrative || narrative.trim().length === 0) {
  narrative = buildNarrativeLocal(...);
}
const normalized: Record<string, unknown> = {
  narrative: narrative || '', // ❌ Siempre presente, incluso si es ''
};
```

**DESPUÉS:**
```typescript
// Preserve narrative from backendReport if present and valid
let narrative: string | undefined = undefined;

if (backendReport.narrative && typeof backendReport.narrative === 'string') {
  const trimmed = backendReport.narrative.trim();
  if (trimmed.length > 0) {
    narrative = trimmed; // ✅ Solo si es válido
  }
}

// Only generate locally if narrative is still missing
if (!narrative) {
  try {
    narrative = buildNarrativeLocal(...);
    if (!narrative || narrative.trim().length === 0) {
      narrative = undefined; // ✅ No establecer string vacío
    }
  } catch (error) {
    narrative = undefined; // ✅ Silent fail
  }
}

const normalized: Record<string, unknown> = {};

// Only include narrative if we have a valid string (not empty)
if (narrative && narrative.trim().length > 0) {
  normalized.narrative = narrative; // ✅ Solo si es válido
}
```

**Mejoras:**
- ✅ No regenera narrative si ya está presente en `backendReport`
- ✅ Solo incluye `narrative` en el objeto normalizado si es un string válido (no-vacío)
- ✅ No establece `narrative: ''` (string vacío), solo lo incluye si es válido

### 3. Validación en Tiempo de Ejecución

**Cambios en líneas ~1793-1810:**

Agregado validación justo antes de construir la respuesta final:

```typescript
// Runtime validation: ensure narrative is valid if present
if (normalizedAiReport.narrative !== undefined) {
  if (typeof normalizedAiReport.narrative !== 'string' || normalizedAiReport.narrative.trim().length === 0) {
    // Invalid narrative - remove it
    delete normalizedAiReport.narrative;
    if (!narrativeWarning) {
      narrativeWarning = {
        code: 'AI_REPORT_NARRATIVE_INVALID',
        message: 'El narrative generado no es válido',
        severity: 'warning'
      };
    }
  }
}

// Log final narrative status
const finalNarrative = normalizedAiReport.narrative;
if (finalNarrative && typeof finalNarrative === 'string') {
  timer.log(`[AI_REPORT] Final narrative present: len=${finalNarrative.length}, source=${narrativeSource}`);
  console.log(`[AI_REPORT] Final narrative present: len=${finalNarrative.length}, source=${narrativeSource}`);
} else {
  timer.log(`[AI_REPORT] Final narrative missing: source=${narrativeSource}`);
  console.log(`[AI_REPORT] Final narrative missing: source=${narrativeSource}`);
}
```

**Garantías:**
- ✅ Valida que `narrative` sea string no-vacío antes de retornar
- ✅ Elimina `narrative` si es inválido (en lugar de retornar string vacío)
- ✅ Logging final para diagnóstico

### 4. Debug Build Actualizado

**Cambio en línea ~27:**

```typescript
const DEBUG_BUILD = 'mejorar-evaluaciones-aiReport-narrative-fix-1';
```

---

## Archivos Cambiados

### `supabase/functions/modify-evaluation-v2/index.ts`

**Cambios clave:**

1. **Líneas ~27:** `DEBUG_BUILD` actualizado a `'mejorar-evaluaciones-aiReport-narrative-fix-1'`

2. **Líneas ~1701-1778:** Extracción mejorada de narrative:
   - Tracking de `narrativeSource`
   - Logging detallado `[AI_REPORT] narrative_len=<n>, narrative_source=<source>`
   - Manejo robusto de errores

3. **Líneas ~299-320:** `normalizeAiReportForFrontend()` refactorizado:
   - No regenera narrative si ya está presente
   - Solo incluye `narrative` si es string válido (no-vacío)
   - No establece `narrative: ''` (string vacío)

4. **Líneas ~1793-1810:** Validación en tiempo de ejecución:
   - Valida `narrative` antes de retornar
   - Elimina si es inválido
   - Logging final del estado

---

## Invariante Garantizado

**DESPUÉS DE LA FIX:**

```typescript
// Narrative solo se incluye en aiReport si es string válido (no-vacío)
// Si narrative es inválido o falta, NO se incluye en el objeto (no string vacío)
// Frontend puede verificar existencia con: if (aiReport.narrative)

// CASOS GARANTIZADOS:
// ✅ OpenAI incluye narrative válido → aiReport.narrative presente
// ✅ OpenAI no incluye → generado localmente → aiReport.narrative presente
// ✅ Ambos fallan → aiReport sin campo narrative (no string vacío), warning, pero success:true
```

---

## Pasos de Prueba

### Test 1: Verificar narrative presente en respuesta HTTP

**Pasos:**
1. Generar evaluación V2 para demo group "9no1"
2. Abrir DevTools → Network tab
3. Buscar request a `modify-evaluation-v2`
4. Verificar response JSON:

```json
{
  "success": true,
  "aiReport": {
    "narrative": "Esta evaluación fue diseñada para...",  // ✅ VERIFICAR (string no-vacío)
    "rationale": "...",
    "versions": { ... },
    "contemplaciones": { ... },
    "response_options": { ... }
  },
  "debug": {
    "build": "mejorar-evaluaciones-aiReport-narrative-fix-1"  // ✅ VERIFICAR
  }
}
```

**Verificaciones:**
- ✅ `aiReport.narrative` existe y es string no-vacío
- ✅ `typeof aiReport.narrative === "string"` es `true`
- ✅ `aiReport.narrative.trim().length > 0` es `true`
- ✅ `debug.build === "mejorar-evaluaciones-aiReport-narrative-fix-1"`

---

### Test 2: Verificar logs del servidor

**Pasos:**
1. Generar evaluación V2
2. Verificar logs del servidor (Supabase Edge Function logs):

```
[AI_REPORT] narrative_len=450, narrative_source=openai
[AI_REPORT] Final narrative present: len=450, source=openai
```

O si viene de generación local:

```
[AI_REPORT] narrative_len=320, narrative_source=local
[AI_REPORT] Final narrative present: len=320, source=local
```

O si falta:

```
[AI_REPORT] narrative_source=none (error: ...)
[AI_REPORT] Final narrative missing: source=none
```

**Verificaciones:**
- ✅ Logs muestran `narrative_len` y `narrative_source`
- ✅ Log final indica si narrative está presente o faltante
- ✅ Si está presente, muestra longitud y fuente

---

### Test 3: Verificar narrative ausente (caso edge)

**Pasos:**
1. Simular fallo de ambos (OpenAI no incluye + generación local falla)
2. Verificar response JSON:

```json
{
  "success": true,  // ✅ VERIFICAR (no cambia a false)
  "aiReport": {
    // sin campo "narrative"  // ✅ VERIFICAR (no string vacío)
    "rationale": "...",
    "versions": { ... },
    ...
  },
  "warnings": [
    {
      "code": "AI_REPORT_NARRATIVE_MISSING",  // ✅ VERIFICAR
      "severity": "warning"  // ✅ VERIFICAR (warning, no error)
    }
  ]
}
```

**Verificaciones:**
- ✅ `success:true` se mantiene
- ✅ `aiReport` NO tiene campo `narrative` (no string vacío `""`)
- ✅ Warning `AI_REPORT_NARRATIVE_MISSING` con severity `warning`

---

## Ejemplo de Response JSON Esperado

### Caso exitoso (narrative presente):

```json
{
  "success": true,
  "evaluationSpec": {
    "version": "2.0",
    "meta": { ... },
    "sections": [ ... ],
    "versionVariants": { ... }
  },
  "aiReport": {
    "narrative": "Esta evaluación fue diseñada para Matemáticas con 3 secciones que evalúan operaciones básicas, geometría y resolución de problemas. Se generaron versiones A y B para adaptarse a diferentes necesidades del grupo, manteniendo la misma demanda cognitiva. Se incluyeron opciones de respuesta equivalentes en items de desarrollo, permitiendo que los estudiantes elijan el formato que mejor se adapte a su forma de expresar su comprensión, sin reducir la dificultad requerida.",
    "rationale": "Evaluación generada para Matemáticas con 3 secciones.",
    "versions": {
      "generated": ["A", "B"],
      "count": 2,
      "reason": "Versión A es universal; Versión B adapta formato y estructura. Todas mantienen la misma demanda cognitiva."
    },
    "contemplaciones": {
      "instrument_design": ["Regla 1", "Regla 2"]
    },
    "response_options": {
      "included": true,
      "optionCount": 3,
      "rationale": "Configurado en el plan de diseño",
      "location": "items.equivalentResponseOptions"
    }
  },
  "warnings": [],
  "debug": {
    "build": "mejorar-evaluaciones-aiReport-narrative-fix-1",
    "attempts": [ ... ]
  }
}
```

---

## Impacto

### Antes de la Fix

- ❌ `aiReport.narrative` no aparecía en respuesta HTTP
- ❌ Narrative podía ser string vacío `''` en lugar de estar ausente
- ❌ No había logging para diagnosticar el flujo
- ❌ Frontend siempre mostraba UI legacy estructurado

### Después de la Fix

- ✅ `aiReport.narrative` aparece en respuesta HTTP cuando es válido
- ✅ Narrative solo se incluye si es string no-vacío (no string vacío)
- ✅ Logging detallado para diagnóstico (`[AI_REPORT] narrative_len=<n>, narrative_source=<source>`)
- ✅ Frontend puede mostrar narrative como contenido principal
- ✅ Validación en tiempo de ejecución garantiza narrative válido
- ✅ `success:true` se mantiene incluso si narrative falta

---

## Notas Técnicas

1. **Narrative solo se incluye si es válido:** No se establece `narrative: ''` (string vacío), solo se incluye si es string no-vacío
2. **No hay doble generación:** Si narrative ya está presente en `backendReport`, no se regenera
3. **Logging detallado:** Tanto `timer.log()` como `console.log()` para diagnóstico
4. **Validación en tiempo de ejecución:** Garantiza narrative válido antes de retornar
5. **Backward compatible:** Campos legacy se mantienen, solo se agrega `narrative` si es válido

---

## Conclusión

El bug era que el narrative podía ser establecido como string vacío `''` o no ser preservado correctamente durante la normalización. La fix asegura que:

1. Narrative solo se incluye si es string válido (no-vacío)
2. No hay doble generación
3. Logging detallado para diagnóstico
4. Validación en tiempo de ejecución garantiza narrative válido

**Estado:** ✅ FIXED - Narrative ahora aparece correctamente en respuesta HTTP cuando es válido

---

**Fin del Documento**
