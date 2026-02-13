# Narrative Observability Logging

**Fecha:** 2026-02-11  
**Tipo:** Observability (No Behavior Changes)  
**Propósito:** Entender exactamente qué contiene el objeto `response` antes de ser serializado a JSON

---

## Ubicación del Cambio

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`  
**Líneas:** ~1956-1970 (justo antes del `return new Response(JSON.stringify(response), ...)`)

---

## Diff Exacto (Patch)

```diff
--- a/supabase/functions/modify-evaluation-v2/index.ts
+++ b/supabase/functions/modify-evaluation-v2/index.ts
@@ -1955,6 +1955,18 @@ serve(async (req) => {
       // 3. Log probe status
       console.log('[PROBE] x-aulaplus-build-probe=NARRATIVE_PROBE_2026_02_11 narrative_len=', (response.aiReport && typeof response.aiReport.narrative === 'string') ? response.aiReport.narrative.length : 0);
       
+      // OBSERVABILITY: Log exact state of response object before JSON.stringify
+      console.log('[FINAL_RESPONSE_KEYS]', Object.keys(response));
+      console.log('[FINAL_AIREPORT_KEYS]', Object.keys(response.aiReport || {}));
+      console.log('[FINAL_HAS_NARRATIVE]', response.aiReport?.narrative);
+      console.log('[FINAL_AIREPORT_TYPE]', typeof response.aiReport);
+      console.log('[FINAL_AIREPORT_IS_NULL]', response.aiReport === null);
+      console.log('[FINAL_AIREPORT_IS_UNDEFINED]', response.aiReport === undefined);
+      if (response.aiReport && typeof response.aiReport === 'object' && response.aiReport !== null) {
+        console.log('[FINAL_AIREPORT_KEYS_DETAILED]', Object.keys(response.aiReport));
+        console.log('[FINAL_AIREPORT_NARRATIVE_IN_OBJECT]', 'narrative' in response.aiReport);
+        console.log('[FINAL_AIREPORT_NARRATIVE_VALUE]', (response.aiReport as Record<string, unknown>).narrative);
+        console.log('[FINAL_AIREPORT_NARRATIVE_TYPE]', typeof (response.aiReport as Record<string, unknown>).narrative);
+      }
+      
       // 4. Return with HTTP header probe
       return new Response(JSON.stringify(response), {
         headers: { 
```

---

## Explicación

### Dónde se Construye el Objeto Response

El objeto `response` se construye en el **success path** del handler:

1. **Líneas ~1909-1938:** Se construye el objeto `response` de tipo `V2Response`:
   ```typescript
   const response: V2Response = {
     success: true,
     evaluationSpec: result.spec,
     requestedVersions,
     instrumentDesignRulesApplied: instrumentDesignRules,
     teacherRemindersByStudent: teacherReminders,
     aiReport: normalizedAiReport, // Normalized to match AIDesignReportData contract
     warnings: [...],
     debug: { ... }
   };
   ```

2. **Línea ~1915:** `aiReport` se asigna como `normalizedAiReport`, que viene de `normalizeAiReportForFrontend()` (línea ~1872)

3. **Líneas ~1942-1953:** Hay un PROBE que modifica `response.debug.build` y `response.aiReport.narrative`

4. **Línea ~1959:** Se serializa y retorna: `return new Response(JSON.stringify(response), ...)`

### Por Qué Esta Ubicación

- **Justo antes del return:** Los logs se ejecutan inmediatamente antes de `JSON.stringify(response)`, capturando el estado exacto del objeto que será serializado
- **Después de todas las modificaciones:** El logging ocurre después de:
  - Construcción del objeto `response` (línea ~1909)
  - Normalización de `aiReport` (línea ~1872)
  - Validación runtime (líneas ~1878-1891)
  - Modificaciones del PROBE (líneas ~1942-1953)
- **Estado final:** Captura el estado final del objeto antes de ser serializado a JSON

### Qué Información Captura

Los logs capturan:

1. **`[FINAL_RESPONSE_KEYS]`:** Todas las keys del objeto `response` (success, evaluationSpec, aiReport, warnings, debug, etc.)
2. **`[FINAL_AIREPORT_KEYS]`:** Todas las keys de `response.aiReport` (o `[]` si es null/undefined)
3. **`[FINAL_HAS_NARRATIVE]`:** Valor de `response.aiReport?.narrative` (usando optional chaining)
4. **`[FINAL_AIREPORT_TYPE]`:** Tipo de `response.aiReport` (object, null, undefined)
5. **`[FINAL_AIREPORT_IS_NULL]`:** Si `response.aiReport === null`
6. **`[FINAL_AIREPORT_IS_UNDEFINED]`:** Si `response.aiReport === undefined`
7. **`[FINAL_AIREPORT_KEYS_DETAILED]`:** Keys detalladas si `aiReport` es un objeto
8. **`[FINAL_AIREPORT_NARRATIVE_IN_OBJECT]`:** Si `'narrative'` existe como key en el objeto
9. **`[FINAL_AIREPORT_NARRATIVE_VALUE]`:** Valor exacto de `narrative` si existe
10. **`[FINAL_AIREPORT_NARRATIVE_TYPE]`:** Tipo de `narrative` si existe

---

## Análisis Esperado

### Escenario 1: Narrative Presente

Si `narrative` está presente en `normalizedAiReport` y se preserva:

```
[FINAL_RESPONSE_KEYS] [ 'success', 'evaluationSpec', 'requestedVersions', 'instrumentDesignRulesApplied', 'teacherRemindersByStudent', 'aiReport', 'warnings', 'debug' ]
[FINAL_AIREPORT_KEYS] [ 'narrative', 'rationale', 'versions', 'contemplaciones', 'response_options' ]
[FINAL_HAS_NARRATIVE] "Esta evaluación fue diseñada para..."
[FINAL_AIREPORT_TYPE] object
[FINAL_AIREPORT_IS_NULL] false
[FINAL_AIREPORT_IS_UNDEFINED] false
[FINAL_AIREPORT_KEYS_DETAILED] [ 'narrative', 'rationale', 'versions', 'contemplaciones', 'response_options' ]
[FINAL_AIREPORT_NARRATIVE_IN_OBJECT] true
[FINAL_AIREPORT_NARRATIVE_VALUE] "Esta evaluación fue diseñada para..."
[FINAL_AIREPORT_NARRATIVE_TYPE] string
```

**Conclusión:** Narrative está presente en el objeto antes de `JSON.stringify()`. Si no aparece en HTTP, el problema está en la serialización o después.

### Escenario 2: Narrative Ausente

Si `narrative` NO está presente en `normalizedAiReport`:

```
[FINAL_RESPONSE_KEYS] [ 'success', 'evaluationSpec', 'requestedVersions', 'instrumentDesignRulesApplied', 'teacherRemindersByStudent', 'aiReport', 'warnings', 'debug' ]
[FINAL_AIREPORT_KEYS] [ 'rationale', 'versions', 'contemplaciones', 'response_options' ]
[FINAL_HAS_NARRATIVE] undefined
[FINAL_AIREPORT_TYPE] object
[FINAL_AIREPORT_IS_NULL] false
[FINAL_AIREPORT_IS_UNDEFINED] false
[FINAL_AIREPORT_KEYS_DETAILED] [ 'rationale', 'versions', 'contemplaciones', 'response_options' ]
[FINAL_AIREPORT_NARRATIVE_IN_OBJECT] false
[FINAL_AIREPORT_NARRATIVE_VALUE] undefined
[FINAL_AIREPORT_NARRATIVE_TYPE] undefined
```

**Conclusión:** Narrative NO está presente en el objeto antes de `JSON.stringify()`. El problema está en:
- `normalizeAiReportForFrontend()` no está incluyendo `narrative`
- O `normalizedAiReport` no tiene `narrative` cuando se asigna a `response.aiReport`

### Escenario 3: aiReport es null/undefined

Si `normalizedAiReport` es null o undefined:

```
[FINAL_RESPONSE_KEYS] [ 'success', 'evaluationSpec', 'requestedVersions', 'instrumentDesignRulesApplied', 'teacherRemindersByStudent', 'aiReport', 'warnings', 'debug' ]
[FINAL_AIREPORT_KEYS] []
[FINAL_HAS_NARRATIVE] undefined
[FINAL_AIREPORT_TYPE] object  // o 'null' o 'undefined'
[FINAL_AIREPORT_IS_NULL] true  // o false
[FINAL_AIREPORT_IS_UNDEFINED] true  // o false
```

**Conclusión:** `normalizedAiReport` es null/undefined, por lo que `response.aiReport` es null/undefined.

---

## Dónde se Puede Perder el Narrative

Basado en el código, el narrative puede perderse en:

1. **`normalizeAiReportForFrontend()` (línea ~1872):**
   - Si `normalizeAiReportForFrontend()` no incluye `narrative` en el objeto retornado
   - Si `normalizeAiReportForFrontend()` establece `narrative` como `undefined` o lo elimina

2. **Runtime validation (líneas ~1878-1891):**
   - Si `normalizedAiReport.narrative` es inválido (no string, string vacío), se elimina con `delete normalizedAiReport.narrative`

3. **Asignación a response (línea ~1915):**
   - `response.aiReport = normalizedAiReport` - si `normalizedAiReport` no tiene `narrative`, `response.aiReport` tampoco lo tendrá

4. **JSON.stringify() (línea ~1959):**
   - `JSON.stringify()` debería preservar todas las keys del objeto, pero si `narrative` es `undefined`, no se serializa

---

## Próximos Pasos

Después de revisar los logs:

1. **Si narrative está presente en logs pero no en HTTP:**
   - El problema está en `JSON.stringify()` o después (middleware, proxy, etc.)
   - Verificar si hay algún middleware que modifique la respuesta

2. **Si narrative NO está presente en logs:**
   - Revisar `normalizeAiReportForFrontend()` para ver por qué no incluye `narrative`
   - Revisar la validación runtime (líneas ~1878-1891) para ver si está eliminando `narrative`
   - Revisar `baseAiReport.narrative` para ver si se está estableciendo correctamente

3. **Si aiReport es null/undefined:**
   - Revisar `normalizeAiReportForFrontend()` para ver por qué retorna null/undefined
   - Verificar que `baseAiReport` se está construyendo correctamente

---

## Conclusión

Este logging de observabilidad captura el estado exacto del objeto `response` justo antes de ser serializado a JSON. Esto permitirá determinar:

- Si `narrative` está presente en el objeto antes de `JSON.stringify()`
- Si `aiReport` es null/undefined
- Qué keys tiene `aiReport` en ese momento
- El tipo y valor exacto de `narrative` si existe

Con esta información, podremos identificar exactamente dónde se pierde el `narrative` en el flujo.

**Estado:** ✅ IMPLEMENTED - Observability logging listo para diagnóstico

---

**Fin del Documento**
