# Definitive Narrative Probe Implementation

**Fecha:** 2026-02-11  
**Tipo:** Probe Definitivo (Fully Reversible)  
**Propósito:** Confirmar definitivamente qué código path produce la respuesta HTTP JSON

---

## Ubicación del Cambio

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`  
**Líneas:** ~1911-1933 (justo antes del `return new Response(...)` en el success path)

---

## Diff Exacto (Patch)

```diff
--- a/supabase/functions/modify-evaluation-v2/index.ts
+++ b/supabase/functions/modify-evaluation-v2/index.ts
@@ -1908,6 +1908,25 @@ serve(async (req) => {
       timer.log(`SUCCESS: sections=${result.spec.sections.length}, totalTime=${timer.elapsed()}ms, narrative=${baseAiReport.narrative ? 'yes' : 'no'}`);
       
+      // PROBE: Inject probe fields to confirm this code path produces the HTTP response
+      // This probe is fully reversible and does not affect evaluationSpec generation
+      // 1. Ensure debug.build is set (response.debug already exists from line 1889)
+      if (response.debug) {
+        response.debug.build = 'NARRATIVE_PROBE_2026_02_11';
+      }
+      
+      // 2. Ensure aiReport exists and set narrative
+      if (!response.aiReport || typeof response.aiReport !== 'object' || response.aiReport === null) {
+        response.aiReport = {};
+      }
+      (response.aiReport as Record<string, unknown>).narrative = 'NARRATIVE_PROBE_PRESENT';
+      
+      // 3. Log probe status
+      console.log('[PROBE] x-aulaplus-build-probe=NARRATIVE_PROBE_2026_02_11 narrative_len=', (response.aiReport && typeof response.aiReport === 'object' && response.aiReport !== null && 'narrative' in response.aiReport && typeof response.aiReport.narrative === 'string') ? response.aiReport.narrative.length : 0);
+      
+      // 4. Return with HTTP header probe
       return new Response(JSON.stringify(response), {
-        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
+        headers: { 
+          ...corsHeaders, 
+          'Content-Type': 'application/json',
+          'x-aulaplus-build-probe': 'NARRATIVE_PROBE_2026_02_11'
+        }
       });
     } else {
       // CRITICAL: Both attempts failed - use EMERGENCY TEMPLATE (non-AI fallback)
```

---

## Explicación

### Dónde se Construye la Respuesta

El payload se construye en el **success path** del handler:

1. **Líneas ~1878-1907:** Se construye el objeto `response` de tipo `V2Response`:
   ```typescript
   const response: V2Response = {
     success: true,
     evaluationSpec: result.spec,
     requestedVersions,
     instrumentDesignRulesApplied: instrumentDesignRules,
     teacherRemindersByStudent: teacherReminders,
     aiReport: normalizedAiReport, // Normalized to match AIDesignReportData contract
     warnings: [...],
     debug: { ... }  // Construido en líneas 1889-1906
   };
   ```

2. **Línea ~1927:** Se serializa y retorna con headers:
   ```typescript
   return new Response(JSON.stringify(response), {
     headers: { 
       ...corsHeaders, 
       'Content-Type': 'application/json',
       'x-aulaplus-build-probe': 'NARRATIVE_PROBE_2026_02_11'  // Probe header
     }
   });
   ```

### Por Qué Esta Ubicación Garantiza que los Campos Aparezcan

- **Inmediatamente antes del return:** Los campos probe se inyectan justo antes de serializar el objeto `response` a JSON y crear el `Response` con headers, garantizando que:
  - El objeto `response` ya está completamente construido
  - No hay código adicional que pueda modificar o eliminar los campos
  - El `JSON.stringify(response)` incluirá los campos probe
  - Los headers incluyen el probe header

- **`response.debug` ya existe:** El objeto `debug` se construye en las líneas ~1889-1906, por lo que siempre existe cuando llegamos al probe

- **`response.aiReport` puede necesitar creación:** Se asigna en la línea ~1884 como `normalizedAiReport`, pero verificamos y creamos si es necesario

- **HTTP header visible:** El header `x-aulaplus-build-probe` es visible incluso si hay normalización/merging de JSON que elimine campos del body

### Garantías del Probe

1. **HTTP Header visible:** `x-aulaplus-build-probe` aparece en los headers de la respuesta HTTP, visible en DevTools Network → Headers
2. **JSON Body probe:** `debug.build` y `aiReport.narrative` aparecen en el JSON body
3. **No afecta `evaluationSpec`:** El probe solo modifica `response.debug.build` y `response.aiReport.narrative`, no toca `evaluationSpec`
4. **No cambia `success`:** El probe no modifica el campo `success` (ya es `true` en este path)
5. **No llama a OpenAI:** El probe solo asigna valores literales, no hace llamadas externas
6. **Fully reversible:** Los campos se pueden eliminar fácilmente sin afectar la lógica existente

---

## Revert Diff (Clean Removal)

Para revertir completamente el probe y restaurar el comportamiento anterior:

```diff
--- a/supabase/functions/modify-evaluation-v2/index.ts
+++ b/supabase/functions/modify-evaluation-v2/index.ts
@@ -1908,25 +1908,6 @@ serve(async (req) => {
       timer.log(`SUCCESS: sections=${result.spec.sections.length}, totalTime=${timer.elapsed()}ms, narrative=${baseAiReport.narrative ? 'yes' : 'no'}`);
       
-      // PROBE: Inject probe fields to confirm this code path produces the HTTP response
-      // This probe is fully reversible and does not affect evaluationSpec generation
-      // 1. Ensure debug.build is set (response.debug already exists from line 1889)
-      if (response.debug) {
-        response.debug.build = 'NARRATIVE_PROBE_2026_02_11';
-      }
-      
-      // 2. Ensure aiReport exists and set narrative
-      if (!response.aiReport || typeof response.aiReport !== 'object' || response.aiReport === null) {
-        response.aiReport = {};
-      }
-      (response.aiReport as Record<string, unknown>).narrative = 'NARRATIVE_PROBE_PRESENT';
-      
-      // 3. Log probe status
-      console.log('[PROBE] x-aulaplus-build-probe=NARRATIVE_PROBE_2026_02_11 narrative_len=', (response.aiReport && typeof response.aiReport === 'object' && response.aiReport !== null && 'narrative' in response.aiReport && typeof response.aiReport.narrative === 'string') ? response.aiReport.narrative.length : 0);
-      
-      // 4. Return with HTTP header probe
       return new Response(JSON.stringify(response), {
-        headers: { 
-          ...corsHeaders, 
-          'Content-Type': 'application/json',
-          'x-aulaplus-build-probe': 'NARRATIVE_PROBE_2026_02_11'
-        }
+        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     } else {
       // CRITICAL: Both attempts failed - use EMERGENCY TEMPLATE (non-AI fallback)
```

---

## Verificación en DevTools

Después de desplegar, verificar en DevTools Network:

### 1. Verificar HTTP Header

**Pasos:**
1. Generar una evaluación V2
2. Abrir DevTools → Network tab
3. Buscar request a `modify-evaluation-v2`
4. Click en el request → Headers tab
5. Buscar en "Response Headers":

```
x-aulaplus-build-probe: NARRATIVE_PROBE_2026_02_11  // ✅ VERIFICAR
```

### 2. Verificar JSON Body

**Pasos:**
1. En el mismo request → Response tab (o Preview)
2. Verificar JSON:

```json
{
  "success": true,
  "evaluationSpec": { ... },
  "aiReport": {
    "narrative": "NARRATIVE_PROBE_PRESENT",  // ✅ VERIFICAR
    "rationale": "...",
    "versions": { ... },
    ...
  },
  "debug": {
    "build": "NARRATIVE_PROBE_2026_02_11",  // ✅ VERIFICAR
    "model": "...",
    ...
  }
}
```

**Verificaciones:**
- ✅ Header `x-aulaplus-build-probe: NARRATIVE_PROBE_2026_02_11` presente
- ✅ `debug.build === "NARRATIVE_PROBE_2026_02_11"`
- ✅ `aiReport.narrative === "NARRATIVE_PROBE_PRESENT"`
- ✅ `success === true` (no cambió)
- ✅ `evaluationSpec` presente y válido (no afectado)

### 3. Verificar Logs del Servidor

Verificar en Supabase Edge Function logs:

```
[PROBE] x-aulaplus-build-probe=NARRATIVE_PROBE_2026_02_11 narrative_len= 25
```

**Verificación:**
- ✅ Log muestra `x-aulaplus-build-probe=NARRATIVE_PROBE_2026_02_11`
- ✅ `narrative_len= 25` (longitud de "NARRATIVE_PROBE_PRESENT")

---

## Ventajas de Este Probe

1. **HTTP Header visible:** Incluso si hay normalización/merging de JSON que elimine campos del body, el header `x-aulaplus-build-probe` será visible en DevTools Network → Headers
2. **Triple verificación:** Header + `debug.build` + `aiReport.narrative` = confirmación definitiva
3. **Bajo costo:** No hace llamadas a OpenAI, solo asigna valores literales
4. **Fully reversible:** Revert diff limpio restaura comportamiento exacto anterior

---

## Conclusión

El probe está implementado en el lugar correcto (justo antes del return) y garantiza que:
- El header HTTP `x-aulaplus-build-probe` aparece en la respuesta (visible incluso si JSON es normalizado)
- Los campos `debug.build` y `aiReport.narrative` aparecen en el JSON body
- No afecta la generación de `evaluationSpec`
- No cambia `success` de `true` a `false`
- No hace llamadas a OpenAI
- Es completamente reversible con el revert diff proporcionado

**Estado:** ✅ IMPLEMENTED - Probe definitivo listo para validación en DevTools

---

**Fin del Documento**
