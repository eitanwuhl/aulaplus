# V2 AI Report Narrative Implementation

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Tipo:** Feature Enhancement (AI Report Narrative)  
**Debug Build:** `mejorar-evaluaciones-aiReport-narrative-1`

---

## Problema Identificado

V2 está estable (no cae a V1), pero `aiReport.narrative` está faltando en las respuestas. El componente frontend `AIDesignReport.tsx` solo muestra el narrative si `reportData.narrative` existe, pero la API actual retorna solo campos estructurados legacy (`designRationale`, `versionsExplanation`, etc.) sin el campo `narrative`.

### Síntomas

- `aiReport.narrative` no está presente en las respuestas de V2
- Frontend siempre muestra el UI legacy estructurado en lugar del narrative
- No hay explicación teacher-friendly del diseño de la evaluación

### Objetivo

- Retornar `aiReport.narrative` como string amigable para el docente
- **NUNCA** cambiar `success:true` a `false` si narrative falta/falla
- Narrative debe ser teacher-only, general, sin recomendaciones por estudiante

---

## Solución Implementada

### 1. Generación de Narrative en la Misma Llamada de OpenAI

**Estrategia Preferida:**
- El narrative se genera en la **misma llamada de OpenAI** que produce `evaluationSpec`
- Se incluye en el objeto JSON retornado por el modelo como `aiReport.narrative`
- Esto es más eficiente y coherente que generar narrative en una llamada separada

### 2. Actualización del Prompt del Sistema

**Cambios en `buildV2SystemPrompt()`:**

1. **Agregado campo `aiReport` al ejemplo de estructura JSON:**
   ```json
   "aiReport": {
     "narrative": "<texto narrativo de 6-12 líneas...>"
   }
   ```

2. **Agregada sección "REPORTE NARRATIVO PARA DOCENTE":**
   - Instrucciones claras sobre qué incluir en el narrative
   - Reglas estrictas: NO mencionar estudiantes individuales, NO recomendaciones por estudiante
   - Contenido requerido:
     * Por qué se eligieron las secciones y tipos de items
     * Cómo se mantiene la dificultad entre formatos de respuesta equivalentes
     * Por qué difieren las versiones A/B/C (perspectiva DUA/accesibilidad)
     * Dónde se agregaron opciones de respuesta equivalentes y cómo funcionan
   - Tono: pedagógico y amigable, como explicando a un colega docente
   - Longitud: 6-12 líneas, párrafos cortos
   - Ejemplo incluido

3. **Marcado como OPCIONAL:**
   - Instrucción explícita: "aiReport.narrative es OPCIONAL. Si no puedes generarlo, omítelo pero NO falles la generación por esto."

### 3. Validación y Preservación de Narrative

**Cambios en `validateAndNormalizeSpec()`:**

- **Preserva `aiReport` si está presente** (campo opcional, no falla si falta)
- **Valida `aiReport.narrative` si existe:**
  - Debe ser `string`
  - Debe ser no-vacío después de `trim()`
  - Si es inválido: se elimina pero **NO falla la validación**
  - Si es válido: se preserva (trimmed)
- **Warnings no-fatal:**
  - `AI_REPORT_NARRATIVE_INVALID_TYPE`: si no es string
  - `AI_REPORT_NARRATIVE_EMPTY`: si está vacío después de trim

### 4. Extracción y Fallback de Narrative

**Cambios en el handler (`serve` function):**

**Prioridad 1: Narrative de OpenAI (si presente)**
```typescript
if (result.spec.aiReport?.narrative && typeof result.spec.aiReport.narrative === 'string') {
  const openaiNarrative = result.spec.aiReport.narrative.trim();
  if (openaiNarrative.length > 0) {
    baseAiReport.narrative = openaiNarrative;
    // ✅ Usar narrative de OpenAI
  }
}
```

**Prioridad 2: Generación local (fallback)**
```typescript
if (!baseAiReport.narrative) {
  try {
    baseAiReport.narrative = buildNarrativeLocal(...);
    // ✅ Generar localmente si OpenAI no lo incluyó
  } catch (narrativeError) {
    // ⚠️ Warning pero NO cambia success:true
    narrativeWarning = {
      code: 'AI_REPORT_NARRATIVE_MISSING',
      severity: 'warning'
    };
  }
}
```

### 5. Actualización de Tipos

**Cambios en `EvaluationSpecV2` interface:**
```typescript
interface EvaluationSpecV2 {
  // ... campos existentes ...
  aiReport?: {
    narrative?: string;  // Teacher-friendly narrative (optional, generated in same OpenAI call)
  };
}
```

---

## Cambios Específicos

### Archivo: `supabase/functions/modify-evaluation-v2/index.ts`

1. **Línea ~27:** `DEBUG_BUILD` actualizado a `'mejorar-evaluaciones-aiReport-narrative-1'`

2. **Líneas ~93-114:** `EvaluationSpecV2` interface actualizado:
   - Agregado campo opcional `aiReport?: { narrative?: string }`

3. **Líneas ~919-924:** Ejemplo de estructura JSON en prompt:
   - Agregado `"aiReport": { "narrative": "..." }` al ejemplo

4. **Líneas ~910-932:** Nueva sección en prompt del sistema:
   - "REPORTE NARRATIVO PARA DOCENTE (aiReport.narrative)"
   - Reglas del narrative (teacher-only, general, sin estudiantes individuales)
   - Contenido requerido (secciones, dificultad, versiones, opciones equivalentes)
   - Ejemplo de narrative
   - Marcado como OPCIONAL

5. **Líneas ~745-780:** Validación de `aiReport.narrative` en `validateAndNormalizeSpec()`:
   - Preserva `aiReport` si está presente
   - Valida `narrative` (string, no-vacío)
   - Elimina si inválido pero NO falla la validación
   - Agrega warnings no-fatal

6. **Líneas ~1666-1705:** Extracción y fallback de narrative en handler:
   - Prioridad 1: Usar narrative de OpenAI si presente
   - Prioridad 2: Generar localmente si falta
   - Warning si ambos fallan, pero `success:true` se mantiene

---

## Invariante Garantizado

**DESPUÉS DE LA FIX:**

```typescript
// Narrative es OPCIONAL y NUNCA causa success:false
// Si OpenAI incluye narrative → se usa
// Si OpenAI no incluye narrative → se genera localmente
// Si ambos fallan → warning pero success:true se mantiene

// CASOS GARANTIZADOS:
// ✅ OpenAI incluye narrative → aiReport.narrative presente
// ✅ OpenAI no incluye narrative → aiReport.narrative generado localmente
// ✅ Ambos fallan → aiReport sin narrative, warning, pero success:true
```

---

## Escenarios de Prueba

### ✅ Escenario 1: OpenAI incluye narrative

**Pasos:**
1. Generar evaluación V2
2. Verificar en Network tab:

```json
{
  "success": true,
  "evaluationSpec": {
    "aiReport": {
      "narrative": "Esta evaluación fue diseñada para Matemáticas..."
    }
  },
  "aiReport": {
    "narrative": "Esta evaluación fue diseñada para Matemáticas...",
    "rationale": "...",
    "versions": { ... },
    "contemplaciones": { ... },
    "response_options": { ... }
  }
}
```

**Resultado esperado:** ✅ `aiReport.narrative` presente y no-vacío, viene de OpenAI

---

### ✅ Escenario 2: OpenAI no incluye narrative

**Pasos:**
1. Generar evaluación V2 (simular que OpenAI no incluye narrative)
2. Verificar en Network tab:

```json
{
  "success": true,
  "evaluationSpec": {
    // sin aiReport.narrative
  },
  "aiReport": {
    "narrative": "Esta evaluación fue diseñada para...",  // ✅ Generado localmente
    "rationale": "...",
    ...
  }
}
```

**Resultado esperado:** ✅ `aiReport.narrative` presente, generado localmente como fallback

---

### ✅ Escenario 3: Ambos fallan (narrative ausente)

**Pasos:**
1. Forzar fallo de generación local (simular error en `buildNarrativeLocal`)
2. Verificar en Network tab:

```json
{
  "success": true,  // ✅ NO cambia a false
  "evaluationSpec": { ... },
  "aiReport": {
    // sin narrative
    "rationale": "...",
    "versions": { ... },
    ...
  },
  "warnings": [
    {
      "code": "AI_REPORT_NARRATIVE_MISSING",
      "severity": "warning"  // ✅ Warning, no error
    }
  ]
}
```

**Resultado esperado:** ✅ `success:true`, `aiReport` sin narrative, warning `AI_REPORT_NARRATIVE_MISSING`

---

## Verificación en DevTools Network

### Test 1: Verificar narrative presente

**Pasos:**
1. Generar evaluación V2 para demo group "9no1"
2. Verificar en Network tab:

```json
{
  "success": true,
  "aiReport": {
    "narrative": "Esta evaluación fue diseñada para [materia] con [N] secciones...",  // ✅ VERIFICAR
    "rationale": "...",
    "versions": { ... },
    "contemplaciones": { ... },
    "response_options": { ... }
  },
  "debug": {
    "build": "mejorar-evaluaciones-aiReport-narrative-1"  // ✅ VERIFICAR
  }
}
```

**Verificaciones:**
- ✅ `aiReport.narrative` existe y es string no-vacío
- ✅ Narrative NO menciona estudiantes individuales
- ✅ Narrative menciona secciones, versiones, opciones equivalentes (si aplica)
- ✅ `debug.build === "mejorar-evaluaciones-aiReport-narrative-1"`

---

### Test 2: Verificar narrative ausente (fallback)

**Pasos:**
1. Simular que OpenAI no incluye narrative (o esperar caso real)
2. Verificar en Network tab:

```json
{
  "success": true,  // ✅ VERIFICAR (no cambia a false)
  "aiReport": {
    "narrative": "...",  // ✅ VERIFICAR (generado localmente)
    ...
  },
  "warnings": []  // ✅ Sin warnings si fallback funciona
}
```

**Verificaciones:**
- ✅ `success:true` se mantiene
- ✅ `aiReport.narrative` presente (generado localmente)
- ✅ Sin warnings si fallback funciona

---

### Test 3: Verificar narrative completamente ausente

**Pasos:**
1. Forzar fallo de ambos (OpenAI no incluye + generación local falla)
2. Verificar en Network tab:

```json
{
  "success": true,  // ✅ VERIFICAR (no cambia a false)
  "aiReport": {
    // sin narrative
    "rationale": "...",  // ✅ VERIFICAR (campos legacy presentes)
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
- ✅ `aiReport` sin `narrative` pero con campos legacy
- ✅ Warning `AI_REPORT_NARRATIVE_MISSING` con severity `warning`

---

## Contenido Esperado del Narrative

El narrative generado por OpenAI debe:

1. **Explicar estructura general:**
   - "Esta evaluación fue diseñada para [materia] con [N] secciones que evalúan [contenidos principales]"

2. **Explicar versiones (si aplica):**
   - "Se generaron [versiones] para adaptarse a diferentes necesidades del grupo, manteniendo la misma demanda cognitiva"

3. **Explicar opciones equivalentes (si aplica):**
   - "Se incluyeron opciones de respuesta equivalentes en items de desarrollo, permitiendo que los estudiantes elijan el formato que mejor se adapte a su forma de expresar su comprensión, sin reducir la dificultad requerida"

4. **NO incluir:**
   - ❌ IDs de estudiantes
   - ❌ Nombres de estudiantes
   - ❌ Recomendaciones por estudiante
   - ❌ "Estudiante 1", "Estudiante 2", etc.
   - ❌ Consejos de adaptación para estudiantes específicos

---

## Impacto

### Antes de la Fix

- ❌ `aiReport.narrative` no estaba presente en respuestas
- ❌ Frontend siempre mostraba UI legacy estructurado
- ❌ No había explicación teacher-friendly del diseño

### Después de la Fix

- ✅ `aiReport.narrative` presente en la mayoría de casos (generado por OpenAI o localmente)
- ✅ Frontend puede mostrar narrative como contenido principal
- ✅ Explicación teacher-friendly del diseño disponible
- ✅ Narrative es opcional y nunca causa `success:false`
- ✅ Fallback local garantiza narrative incluso si OpenAI no lo incluye

---

## Notas Técnicas

1. **Narrative se genera en la misma llamada de OpenAI:** Más eficiente y coherente que llamada separada
2. **Narrative es opcional:** Validación nunca falla si falta
3. **Fallback local:** Garantiza narrative incluso si OpenAI no lo incluye
4. **Teacher-only:** Narrative no menciona estudiantes individuales
5. **Backward compatible:** Campos legacy (`designRationale`, `versionsExplanation`, etc.) se mantienen

---

## Conclusión

El narrative ahora se genera en la misma llamada de OpenAI que produce `evaluationSpec`, se valida y preserva correctamente, y tiene un fallback local robusto. El narrative es completamente opcional y nunca causa `success:false`, garantizando que V2 permanezca estable incluso si narrative falla.

**Estado:** ✅ IMPLEMENTED - Narrative presente en respuestas, opcional, con fallback robusto

---

**Fin del Documento**
