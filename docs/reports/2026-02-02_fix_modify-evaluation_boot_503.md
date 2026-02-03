# Fix Boot 503 en modify-evaluation

**Fecha**: 2026-02-02  
**Rama**: `nuevas-evaluaciones`  
**Objetivo**: Eliminar errores de boot por duplicación de identificadores y asegurar preflight CORS 204.

---

## Resumen de causa raíz

- **Duplicado encontrado**: `highStructureNeed`
  - **Causa**: dos declaraciones `const highStructureNeed = ...` en el mismo scope del path universal.
  - **Efecto**: `Uncaught SyntaxError: Identifier 'highStructureNeed' has already been declared` → worker no inicia → preflight OPTIONS devuelve 503.
- **Revisión previa**: `bucketedContemplacionIds` ya había sido corregido para quedar con una sola declaración.

---

## Cambios realizados

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

### Fix 1 — Declaración única de `highStructureNeed`

**Antes** (duplicado en el mismo scope):
```ts
const highStructureNeed = designPlan.highStructureNeed || {};
// ...
const highStructureNeed = designPlan.highStructureNeed || {};
```

**Después** (declaración única):
```ts
const highStructureNeed = designPlan.highStructureNeed || {};
// ...
// (se eliminó la segunda declaración)
```

### Fix 2 — CORS preflight 204 (sin cambios de lógica)

Ya presente y verificado en el handler:
```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
};

if (req.method === 'OPTIONS') {
  return new Response(null, { status: 204, headers: corsHeaders });
}
```

---

## Confirmación de unicidad de identificadores

- `highStructureNeed`: **1 declaración** por scope.
- `bucketedContemplacionIds`: **1 declaración** por scope.
- No se detectaron otras duplicaciones en este pass.

---

## Deploy (documentado)

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

---

## Checklist de verificación (operador)

1. **Network (preflight)**  
   - OPTIONS → **204**  
   - Headers:  
     - `Access-Control-Allow-Origin: *`  
     - `Access-Control-Allow-Methods: POST, OPTIONS`  
     - `Access-Control-Allow-Headers: apikey, authorization, content-type, x-client-info`

2. **POST**  
   - 200 OK  
   - `_debug.generationPath` comienza con `"universal"`

3. **Supabase Logs**  
   - Sin `worker boot error` ni `Uncaught SyntaxError`.

