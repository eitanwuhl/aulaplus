# Fix: AI Report Contract Normalization

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Tipo:** Bug Fix Crítico (Contract Mismatch)  
**Debug Build:** `mejorar-evaluaciones-aiReport-contract-1`

---

## Problema Identificado

El frontend (`AIDesignReport.tsx`) espera un objeto `AIDesignReportData` con keys específicas, pero el backend `modify-evaluation-v2` estaba devolviendo `aiReport` con keys diferentes, causando que el componente no pudiera renderizar correctamente y nunca mostrara el `narrative` como contenido principal.

### Síntomas

- `AIDesignReport` no muestra el `narrative` aunque esté presente en la respuesta
- El componente siempre cae al fallback legacy
- Mismatch entre contrato esperado y contrato recibido

### Causa Raíz

**CONTRATO MISMATCH:** El backend devolvía:
```typescript
{
  designRationale: string,
  versionsExplanation: { generated: string[], notGenerated?: Record<string, string> },
  contemplacionesApplied: { instrumentDesign: string[], adminReminders: number, correctionReminders: number },
  responseOptions: { included: boolean, count?: number, reason?: string }
}
```

Pero el frontend esperaba:
```typescript
{
  narrative?: string,
  rationale?: string,
  versions?: { generated?: string[], reason?: string, count?: number },
  contemplaciones?: { instrument_design?: string[], admin_reminders?: string[], correction_reminders?: string[] },
  response_options?: { included?: boolean, optionCount?: number, rationale?: string, location?: string }
}
```

---

## Solución Implementada

### 1. Función de Normalización

Se creó `normalizeAiReportForFrontend()` que mapea el formato del backend al formato esperado por el frontend:

**Mapping:**
- `designRationale` → `rationale`
- `versionsExplanation.generated` → `versions.generated`
- `versionsExplanation.notGenerated` → `versions.reason` (concatenado)
- `versionsExplanation.generated.length` → `versions.count`
- `contemplacionesApplied.instrumentDesign` → `contemplaciones.instrument_design`
- `contemplacionesApplied.adminReminders` → omitido (solo conteo, no array)
- `contemplacionesApplied.correctionReminders` → omitido (solo conteo, no array)
- `responseOptions.included` → `response_options.included`
- `responseOptions.count` → `response_options.optionCount`
- `responseOptions.reason` → `response_options.rationale`
- `responseOptions.included === true` → `response_options.location = 'items.equivalentResponseOptions'`

### 2. Narrative Siempre Presente (Best-Effort)

La función `normalizeAiReportForFrontend()` garantiza que `narrative` siempre esté presente:

- Si `backendReport.narrative` existe y no está vacío → se usa directamente
- Si no existe o está vacío → se genera usando `buildNarrativeLocal()` (determinístico, sin OpenAI)

### 3. Actualización de DEBUG_BUILD

- Cambiado de `mejorar-evaluaciones-v2-narrative-2` a `mejorar-evaluaciones-aiReport-contract-1`
- Incluido en todas las respuestas (éxito y fallo)

### 4. Tipo Actualizado

El tipo `V2Response.aiReport` ahora acepta tanto `AIReportV2` (formato legacy) como `Record<string, unknown>` (formato normalizado) para mantener compatibilidad.

---

## Cambios Específicos

### Archivo: `supabase/functions/modify-evaluation-v2/index.ts`

1. **Línea ~27:** Actualizado `DEBUG_BUILD` a `'mejorar-evaluaciones-aiReport-contract-1'`

2. **Líneas ~280-400:** Agregada función `normalizeAiReportForFrontend()`:
   - Asegura `narrative` siempre presente
   - Mapea todos los campos al contrato del frontend
   - Genera `versions.reason` si no existe
   - Omite `admin_reminders` y `correction_reminders` si solo hay conteos

3. **Línea ~152:** Actualizado tipo `V2Response.aiReport` para aceptar formato normalizado

4. **Líneas ~1340-1345:** Aplicada normalización antes de construir respuesta final:
   ```typescript
   const normalizedAiReport = normalizeAiReportForFrontend(
     baseAiReport,
     result.spec,
     requestedVersions
   );
   ```

---

## Ejemplo de Response JSON

### Antes (Backend Format):
```json
{
  "success": true,
  "evaluationSpec": { ... },
  "aiReport": {
    "designRationale": "Evaluación generada para Matemáticas con 3 secciones.",
    "versionsExplanation": {
      "generated": ["A", "B"],
      "notGenerated": { "C": "No hay estudiantes con adecuación de contenido declarada" }
    },
    "contemplacionesApplied": {
      "instrumentDesign": ["Regla 1", "Regla 2"],
      "adminReminders": 5,
      "correctionReminders": 3
    },
    "responseOptions": {
      "included": true,
      "count": 3,
      "reason": "Configurado en el plan de diseño"
    }
  }
}
```

### Después (Normalized Format):
```json
{
  "success": true,
  "evaluationSpec": { ... },
  "aiReport": {
    "narrative": "Esta evaluación fue diseñada para Matemáticas. Consta de 3 secciones con un total de 100 puntos y una duración estimada de 90 minutos. La evaluación está organizada en: Parte 1, Parte 2, Parte 3.\n\nDecisiones de diseño:\n• Se generaron 2 versiones (A, B): Versión A es universal; Versión B adapta el formato y estructura para mayor claridad. Todas las versiones mantienen la misma demanda cognitiva y evalúan los mismos objetivos de aprendizaje.\n• Se incluyeron opciones de respuesta equivalentes (3 formatos por item elegible). Los estudiantes pueden elegir el formato que mejor se adapte a su forma de expresar su comprensión, sin que esto reduzca la dificultad o la evidencia requerida.\n• Se aplicaron adaptaciones al instrumento: Regla 1, Regla 2.\n\nLos recordatorios específicos por estudiante (8 totales: 5 administrativos, 3 de corrección) se entregan aparte; este reporte es global.",
    "rationale": "Evaluación generada para Matemáticas con 3 secciones.",
    "versions": {
      "generated": ["A", "B"],
      "count": 2,
      "reason": "Versión C: No hay estudiantes con adecuación de contenido declarada"
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
  "debug": {
    "build": "mejorar-evaluaciones-aiReport-contract-1",
    ...
  }
}
```

---

## Invariante Garantizado

**DESPUÉS DE LA FIX:**

```typescript
// aiReport SIEMPRE tiene el formato normalizado que espera el frontend
// narrative SIEMPRE está presente (generado localmente si falta)
// Todos los campos están mapeados correctamente al contrato AIDesignReportData
```

---

## Verificación en DevTools Network

### Test 1: Verificar que el contrato es correcto

**Pasos:**
1. Abrir Chrome DevTools → Network tab
2. Generar evaluación V2
3. Buscar llamada a `modify-evaluation-v2`
4. Verificar Response JSON:

```json
{
  "success": true,
  "aiReport": {
    "narrative": "...",  // ✅ DEBE estar presente
    "rationale": "...",  // ✅ DEBE estar presente (de designRationale)
    "versions": {        // ✅ DEBE estar presente (de versionsExplanation)
      "generated": ["A", ...],
      "count": 2,
      "reason": "..."
    },
    "contemplaciones": {  // ✅ DEBE estar presente (de contemplacionesApplied)
      "instrument_design": [...]
    },
    "response_options": {  // ✅ DEBE estar presente (de responseOptions)
      "included": true,
      "optionCount": 3,
      "rationale": "...",
      "location": "items.equivalentResponseOptions"
    }
  },
  "debug": {
    "build": "mejorar-evaluaciones-aiReport-contract-1"  // ✅ VERIFICAR
  }
}
```

**Resultado esperado:** ✅ `aiReport` tiene el formato correcto, `narrative` está presente, todos los campos están mapeados

---

### Test 2: Verificar que AIDesignReport renderiza correctamente

**Pasos:**
1. Generar evaluación V2
2. Abrir la evaluación en el frontend
3. Verificar que `AIDesignReport` muestra:
   - `narrative` como contenido principal (si existe)
   - Fallback a legacy si `narrative` no existe

**Resultado esperado:** ✅ `AIDesignReport` renderiza correctamente con el `narrative` como contenido principal

---

## Impacto

### Antes de la Fix

- ❌ `aiReport` tenía formato incompatible con el frontend
- ❌ `AIDesignReport` no podía renderizar correctamente
- ❌ `narrative` nunca se mostraba aunque estuviera presente
- ❌ Componente siempre caía al fallback legacy

### Después de la Fix

- ✅ `aiReport` tiene formato normalizado que coincide con `AIDesignReportData`
- ✅ `AIDesignReport` renderiza correctamente
- ✅ `narrative` siempre está presente y se muestra como contenido principal
- ✅ Todos los campos están mapeados correctamente
- ✅ Backward compatibility mantenida (campos legacy aún disponibles internamente)

---

## Notas Técnicas

1. **No se modificó V1:** Todos los cambios son exclusivos de V2
2. **No se cambiaron contratos de API externos:** Solo se normalizó el formato interno de `aiReport`
3. **Narrative generation:** Siempre determinística (local), sin llamadas adicionales a OpenAI
4. **Campos omitidos:** `admin_reminders` y `correction_reminders` se omiten si solo hay conteos (no se inventan arrays)
5. **Location field:** `response_options.location` se establece a `'items.equivalentResponseOptions'` cuando `included === true`

---

## Conclusión

El bug era un **mismatch de contrato**: el backend devolvía `aiReport` con keys diferentes a las que esperaba el frontend.

La fix:
- Normaliza `aiReport` al formato esperado por `AIDesignReportData`
- Garantiza que `narrative` siempre esté presente (best-effort)
- Mapea todos los campos correctamente
- Mantiene backward compatibility

**Estado:** ✅ FIXED - `AIDesignReport` ahora puede renderizar correctamente el `narrative` y todos los campos

---

**Fin del Documento**
