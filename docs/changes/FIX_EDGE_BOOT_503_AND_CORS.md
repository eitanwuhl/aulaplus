# Fix Edge Function Boot 503 + CORS Preflight

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Objetivo**: Eliminar el 503 en preflight (boot crash), asegurar CORS correcto y mantener el path universal.

---

## Problema observado

- Preflight `OPTIONS` a `modify-evaluation` devuelve **503** → el worker no inicia (boot crash).
- CORS error visible en el navegador por fallo de boot.
- Requerimiento: **OPTIONS** debe responder siempre con 204 y headers correctos.

---

## Cambios realizados

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

### 1) CORS preflight hard (OPTIONS 204)

Se agregaron headers completos y retorno temprano con status 204:

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

### 2) Triggers de versiones consistentes con asignaciones

Se fuerza `versionB`/`versionC` a `true` si hay estudiantes asignados a esas versiones:

```ts
const assignmentsIncludeB = Object.values(studentAssignments).includes('B');
const assignmentsIncludeC = Object.values(studentAssignments).includes('C');
const generateVersionB = designPlan.triggers?.versionB === true || assignmentsIncludeB;
const generateVersionC = designPlan.triggers?.versionC === true || assignmentsIncludeC;
```

---

## Archivos modificados

- `supabase/functions/modify-evaluation/index.ts`

---

## Verificación local

Intento de `serve`:

```
supabase functions serve modify-evaluation --no-verify-jwt
```

Resultado: **falló** porque Docker no está disponible en este entorno.

Mensaje:
```
Docker Desktop is a prerequisite for local development.
```

---

## Deploy

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

---

## Verificación post-deploy (manual)

1) **Network (preflight)**
   - OPTIONS → **204**  
   - Headers:
     - `Access-Control-Allow-Origin: *`
     - `Access-Control-Allow-Methods: POST, OPTIONS`
     - `Access-Control-Allow-Headers: apikey, authorization, content-type, x-client-info`

2) **POST**
   - Respuesta 200
   - `_debug.generationPath` empieza con `universal`

3) **Supabase Logs**
   - Sin errores de boot/compile en `modify-evaluation`

---

## Notas

- Si el worker sigue devolviendo 503, revisar los **logs de Edge Functions** y buscar el error de boot más reciente.
- Docker es requisito para `supabase functions serve` en local.

