# PING Mode Implementation

**Fecha:** 2026-02-11  
**Tipo:** Zero-Cost Probe Mode  
**Propósito:** Verificar definitivamente que las requests están llegando a esta función y que el código desplegado es el que se está sirviendo

---

## Ubicación del Cambio

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`  
**Líneas:** ~1608-1640 (justo después de parsear el request body, antes de cualquier procesamiento pesado)

---

## Diff Exacto (Patch)

```diff
--- a/supabase/functions/modify-evaluation-v2/index.ts
+++ b/supabase/functions/modify-evaluation-v2/index.ts
@@ -1607,8 +1607,40 @@ serve(async (req) => {
   try {
     timer.log('Request received, parsing body');
     
-    const {
+    const requestBody = await req.json();
+    
+    // PING MODE: Zero-cost probe to verify function is deployed and reachable
+    // If __ping is true, return immediately without any OpenAI calls or heavy processing
+    if (requestBody && typeof requestBody === 'object' && requestBody.__ping === true) {
+      const pingNow = new Date().toISOString();
+      // Try to get region from Deno.env if available (Supabase Edge Functions)
+      // @ts-ignore - Deno is available at runtime in Edge Functions
+      const pingRegion = typeof Deno !== 'undefined' && Deno.env ? (Deno.env.get('DENO_REGION') || Deno.env.get('SUPABASE_REGION')) : undefined;
+      
+      console.log(`[PING_V2] build=PING_V2_2026_02_11 requestId=${requestId}`);
+      
+      const pingResponse = {
+        success: true,
+        pong: true,
+        debug: {
+          build: 'PING_V2_2026_02_11',
+          now: pingNow,
+          ...(pingRegion ? { region: pingRegion } : {})
+        }
+      };
+      
+      return new Response(JSON.stringify(pingResponse), {
+        headers: {
+          ...corsHeaders,
+          'Content-Type': 'application/json',
+          'x-aulaplus-build-probe': 'PING_V2_2026_02_11'
+        }
+      });
+    }
+    
+    const {
       mode,  // 'generate' (default) or 'adjust'
       modification,
       groupContext,
       evaluation_design_plan,
       currentEvaluationSpec,  // For adjust mode: the current spec to refine
       adjustmentDetails       // For adjust mode: { targetVersions, scope, sectionId?, itemId? }
-    } = await req.json();
+    } = requestBody;
     
     timer.mark('body_parsed');
```

---

## Explicación

### Dónde se Implementa

El PING mode se implementa **inmediatamente después de parsear el request body**, antes de cualquier procesamiento pesado:

1. **Línea ~1609:** Se parsea el request body: `const requestBody = await req.json();`
2. **Líneas ~1612-1640:** Se verifica si `requestBody.__ping === true`
3. **Si es PING:** Se retorna inmediatamente sin:
   - Llamadas a OpenAI
   - Procesamiento pesado
   - Generación de evaluación
   - Cualquier otra lógica costosa
4. **Si NO es PING:** Se continúa con el flujo normal (destructuring de `requestBody`)

### Por Qué Esta Ubicación

- **Antes de cualquier procesamiento:** El PING se verifica antes de cualquier lógica costosa, garantizando respuesta instantánea
- **Después de parsear body:** Necesitamos el body parseado para verificar `__ping`, pero no necesitamos procesar nada más
- **Antes de timer.mark('body_parsed'):** El PING retorna antes de marcar el timer, evitando cualquier overhead

### Garantías del PING Mode

1. **Zero-cost:** No hace llamadas a OpenAI, no procesa datos pesados, retorna inmediatamente
2. **Fully reversible:** Se puede eliminar fácilmente sin afectar el comportamiento normal
3. **No afecta requests normales:** Solo se activa si `__ping: true` está presente en el body
4. **CORS headers preservados:** Usa los mismos `corsHeaders` que las requests normales
5. **Success semantics preservados:** No cambia el comportamiento de `success` para requests normales

---

## Revert Diff (Clean Removal)

Para revertir completamente el PING mode y restaurar el comportamiento anterior:

```diff
--- a/supabase/functions/modify-evaluation-v2/index.ts
+++ b/supabase/functions/modify-evaluation-v2/index.ts
@@ -1607,40 +1607,8 @@ serve(async (req) => {
   try {
     timer.log('Request received, parsing body');
     
-    const requestBody = await req.json();
-    
-    // PING MODE: Zero-cost probe to verify function is deployed and reachable
-    // If __ping is true, return immediately without any OpenAI calls or heavy processing
-    if (requestBody && typeof requestBody === 'object' && requestBody.__ping === true) {
-      const pingNow = new Date().toISOString();
-      // Try to get region from Deno.env if available (Supabase Edge Functions)
-      // @ts-ignore - Deno is available at runtime in Edge Functions
-      const pingRegion = typeof Deno !== 'undefined' && Deno.env ? (Deno.env.get('DENO_REGION') || Deno.env.get('SUPABASE_REGION')) : undefined;
-      
-      console.log(`[PING_V2] build=PING_V2_2026_02_11 requestId=${requestId}`);
-      
-      const pingResponse = {
-        success: true,
-        pong: true,
-        debug: {
-          build: 'PING_V2_2026_02_11',
-          now: pingNow,
-          ...(pingRegion ? { region: pingRegion } : {})
-        }
-      };
-      
-      return new Response(JSON.stringify(pingResponse), {
-        headers: {
-          ...corsHeaders,
-          'Content-Type': 'application/json',
-          'x-aulaplus-build-probe': 'PING_V2_2026_02_11'
-        }
-      });
-    }
-    
     const {
       mode,  // 'generate' (default) or 'adjust'
       modification,
       groupContext,
       evaluation_design_plan,
       currentEvaluationSpec,  // For adjust mode: the current spec to refine
       adjustmentDetails       // For adjust mode: { targetVersions, scope, sectionId?, itemId? }
-    } = requestBody;
+    } = await req.json();
     
     timer.mark('body_parsed');
```

---

## Uso del PING Mode

### Request Example

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/modify-evaluation-v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <anon-key>" \
  -d '{"__ping": true}'
```

### Response Expected

**HTTP Headers:**
```
x-aulaplus-build-probe: PING_V2_2026_02_11
Content-Type: application/json
Access-Control-Allow-Origin: *
...
```

**JSON Body:**
```json
{
  "success": true,
  "pong": true,
  "debug": {
    "build": "PING_V2_2026_02_11",
    "now": "2026-02-11T12:34:56.789Z",
    "region": "us-east-1"  // Si está disponible
  }
}
```

### Server Logs

```
[PING_V2] build=PING_V2_2026_02_11 requestId=sb-abc123...
```

---

## Verificación en DevTools

### Test 1: Verificar PING Response

**Pasos:**
1. Abrir DevTools → Network tab
2. Hacer request POST a `modify-evaluation-v2` con body: `{"__ping": true}`
3. Verificar response:

**Headers tab:**
```
x-aulaplus-build-probe: PING_V2_2026_02_11  // ✅ VERIFICAR
```

**Response/Preview tab:**
```json
{
  "success": true,  // ✅ VERIFICAR
  "pong": true,  // ✅ VERIFICAR
  "debug": {
    "build": "PING_V2_2026_02_11",  // ✅ VERIFICAR
    "now": "2026-02-11T...",  // ✅ VERIFICAR (ISO timestamp)
    "region": "..."  // ✅ VERIFICAR (opcional, si está disponible)
  }
}
```

**Verificaciones:**
- ✅ Header `x-aulaplus-build-probe: PING_V2_2026_02_11` presente
- ✅ `success === true`
- ✅ `pong === true`
- ✅ `debug.build === "PING_V2_2026_02_11"`
- ✅ `debug.now` es un ISO timestamp válido
- ✅ Response time < 100ms (zero-cost, sin OpenAI)

### Test 2: Verificar que Requests Normales No se Afectan

**Pasos:**
1. Hacer request POST normal (sin `__ping`)
2. Verificar que el flujo normal funciona:
   - Se genera evaluación
   - Se llama a OpenAI
   - Response incluye `evaluationSpec`

**Verificaciones:**
- ✅ Request normal funciona como antes
- ✅ No hay cambios en `success` semantics
- ✅ CORS headers preservados

---

## Ventajas del PING Mode

1. **Zero-cost:** No hace llamadas a OpenAI, respuesta instantánea
2. **Definitivo:** Confirma que el código desplegado es el que se está sirviendo
3. **Visible:** HTTP header + JSON body + server logs = triple confirmación
4. **Fully reversible:** Revert diff limpio restaura comportamiento exacto anterior
5. **No afecta requests normales:** Solo se activa con `__ping: true`

---

## Conclusión

El PING mode está implementado en el lugar correcto (justo después de parsear el body) y garantiza que:
- Las requests con `__ping: true` retornan inmediatamente sin costo
- El header HTTP `x-aulaplus-build-probe` confirma el código desplegado
- El JSON body incluye `debug.build` y timestamp
- Los requests normales no se afectan
- Es completamente reversible con el revert diff proporcionado

**Estado:** ✅ IMPLEMENTED - PING mode listo para validación

---

**Fin del Documento**
