# Narrative Probe Implementation

**Fecha:** 2026-02-11  
**Tipo:** Probe (Fully Reversible)  
**Propósito:** Confirmar que el código path correcto produce la respuesta HTTP JSON

---

## Ubicación del Cambio

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`  
**Líneas:** ~1909-1925 (justo antes del `return new Response(...)` en el success path)

---

## Diff Exacto

```diff
--- a/supabase/functions/modify-evaluation-v2/index.ts
+++ b/supabase/functions/modify-evaluation-v2/index.ts
@@ -1906,6 +1906,20 @@ serve(async (req) => {
       timer.log(`SUCCESS: sections=${result.spec.sections.length}, totalTime=${timer.elapsed()}ms, narrative=${baseAiReport.narrative ? 'yes' : 'no'}`);
       
+      // PROBE: Inject probe fields to confirm this code path produces the HTTP response
+      // This probe is fully reversible and does not affect evaluationSpec generation
+      if (response.debug) {
+        (response.debug as Record<string, unknown>).buildProbe = 'NARRATIVE_PROBE_2026_02_11';
+      }
+      
+      // Ensure aiReport is an object (not null) before setting narrative
+      if (response.aiReport && typeof response.aiReport === 'object' && response.aiReport !== null) {
+        (response.aiReport as Record<string, unknown>).narrative = 'NARRATIVE_PROBE_PRESENT';
+      }
+      
+      console.log('[PROBE] buildProbe=NARRATIVE_PROBE_2026_02_11 narrative_len=', (response.aiReport && typeof response.aiReport === 'object' && response.aiReport !== null && 'narrative' in response.aiReport && typeof response.aiReport.narrative === 'string') ? response.aiReport.narrative.length : 0);
+      
       return new Response(JSON.stringify(response), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
```

---

## Explicación

### Dónde se Construye el Payload

El payload se construye en el **success path** del handler, específicamente:

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
     debug: { ... }
   };
   ```

2. **Línea ~1911:** Se serializa y retorna:
   ```typescript
   return new Response(JSON.stringify(response), {
     headers: { ...corsHeaders, 'Content-Type': 'application/json' }
   });
   ```

### Por Qué Esta Ubicación Garantiza que los Campos Aparezcan

- **Inmediatamente antes del return:** Los campos probe se inyectan justo antes de serializar el objeto `response` a JSON, garantizando que:
  - El objeto `response` ya está completamente construido
  - No hay código adicional que pueda modificar o eliminar los campos
  - El `JSON.stringify(response)` incluirá los campos probe

- **`response.debug` ya existe:** El objeto `debug` se construye en las líneas ~1889-1906, por lo que siempre existe cuando llegamos al probe

- **`response.aiReport` ya existe:** El objeto `aiReport` se asigna en la línea ~1884 como `normalizedAiReport`, por lo que siempre existe (puede ser un objeto o `null`, pero verificamos antes de asignar)

### Garantías del Probe

1. **No afecta `evaluationSpec`:** El probe solo modifica `response.debug` y `response.aiReport`, no toca `evaluationSpec`
2. **No cambia `success`:** El probe no modifica el campo `success` (ya es `true` en este path)
3. **No llama a OpenAI:** El probe solo asigna valores literales, no hace llamadas externas
4. **Fully reversible:** Los campos se pueden eliminar fácilmente sin afectar la lógica existente

---

## Pasos de Reversión

Para revertir el probe completamente y restaurar el comportamiento anterior:

### Opción 1: Revert Manual

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`  
**Líneas:** ~1909-1925

**Reemplazar:**
```typescript
      timer.log(`SUCCESS: sections=${result.spec.sections.length}, totalTime=${timer.elapsed()}ms, narrative=${baseAiReport.narrative ? 'yes' : 'no'}`);
      
      // PROBE: Inject probe fields to confirm this code path produces the HTTP response
      // This probe is fully reversible and does not affect evaluationSpec generation
      if (response.debug) {
        (response.debug as Record<string, unknown>).buildProbe = 'NARRATIVE_PROBE_2026_02_11';
      }
      
      // Ensure aiReport is an object (not null) before setting narrative
      if (response.aiReport && typeof response.aiReport === 'object' && response.aiReport !== null) {
        (response.aiReport as Record<string, unknown>).narrative = 'NARRATIVE_PROBE_PRESENT';
      }
      
      console.log('[PROBE] buildProbe=NARRATIVE_PROBE_2026_02_11 narrative_len=', (response.aiReport && typeof response.aiReport === 'object' && response.aiReport !== null && 'narrative' in response.aiReport && typeof response.aiReport.narrative === 'string') ? response.aiReport.narrative.length : 0);
      
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
```

**Con:**
```typescript
      timer.log(`SUCCESS: sections=${result.spec.sections.length}, totalTime=${timer.elapsed()}ms, narrative=${baseAiReport.narrative ? 'yes' : 'no'}`);
      
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
```

### Opción 2: Git Revert (si se hizo commit)

```bash
# Si el probe fue commiteado, revertir el commit específico
git revert <commit-hash>

# O si es el último commit
git revert HEAD
```

---

## Verificación en DevTools

Después de desplegar, verificar en DevTools Network:

1. **Generar una evaluación V2**
2. **Abrir DevTools → Network tab**
3. **Buscar request a `modify-evaluation-v2`**
4. **Verificar response JSON:**

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
    "build": "...",
    "buildProbe": "NARRATIVE_PROBE_2026_02_11",  // ✅ VERIFICAR
    ...
  }
}
```

**Verificaciones:**
- ✅ `debug.buildProbe === "NARRATIVE_PROBE_2026_02_11"`
- ✅ `aiReport.narrative === "NARRATIVE_PROBE_PRESENT"`
- ✅ `success === true` (no cambió)
- ✅ `evaluationSpec` presente y válido (no afectado)

---

## Logs del Servidor

Verificar en Supabase Edge Function logs:

```
[PROBE] buildProbe=NARRATIVE_PROBE_2026_02_11 narrative_len= 25
```

**Verificación:**
- ✅ Log muestra `buildProbe=NARRATIVE_PROBE_2026_02_11`
- ✅ `narrative_len= 25` (longitud de "NARRATIVE_PROBE_PRESENT")

---

## Conclusión

El probe está implementado en el lugar correcto (justo antes del return) y garantiza que:
- Los campos aparecerán en la respuesta HTTP JSON
- No afecta la generación de `evaluationSpec`
- No cambia `success` de `true` a `false`
- No hace llamadas a OpenAI
- Es completamente reversible

**Estado:** ✅ IMPLEMENTED - Probe listo para validación en DevTools

---

**Fin del Documento**
