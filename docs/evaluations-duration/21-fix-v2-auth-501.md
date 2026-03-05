# Fix V2 auth 501 (JWT secret not configured)

**Problema:** Tras habilitar ping público con `verify_jwt=false`, la generación V2 fallaba: el frontend caía a V1, la red devolvía **HTTP 501 Not Implemented** y en los logs de Supabase aparecía **"[V2_AUTH] JWT secret not configured"**.

---

## 1) Causa del 501

Con `verify_jwt=false` el gateway de Supabase **no** validaba el JWT y dejaba pasar todas las peticiones al handler. Para no dejar la función abierta, en el handler se añadió una verificación JWT manual que necesitaba una variable de entorno:

- `SUPABASE_JWT_SECRET` o `JWT_SECRET`

Ese valor **no** está disponible por defecto en el runtime de Edge Functions en Supabase (o tiene otro nombre/configuración), así que el código devolvía **501** con el mensaje "Server auth not configured" y la generación V2 dejaba de funcionar.

---

## 2) Qué se cambió

### Auth: solo gateway, sin JWT secret

- Se **eliminó** la verificación JWT manual en el handler (y la dependencia de djwt y de cualquier variable JWT secret).
- Se **volvió** a usar **`verify_jwt=true`** para `modify-evaluation-v2` en `supabase/config.toml`. El **gateway** de Supabase valida el JWT antes de llamar a la función; no hace falta configurar ningún secreto JWT en el proyecto.

### config.toml

```toml
[functions.modify-evaluation-v2]
verify_jwt = true
```

Así, todas las peticiones (incluido el ping) deben llevar un JWT válido (p. ej. `Authorization: Bearer <anon_key>`). La app ya envía ese token con `invokeEdgeFunctionAuthed`, por lo que la generación V2 vuelve a funcionar sin tocar el frontend.

### Ping

- El path **`__ping`** se mantiene: si el body es `{ "__ping": true }`, la función responde de inmediato con `debug.build` y `mode` **sin** llamar a OpenAI.
- Con `verify_jwt=true`, el ping **también** exige JWT: el script de verificación debe enviar `Authorization` y `apikey` con la anon key del proyecto (desde `.env`).

---

## 3) Cómo desplegar sin romper V2

1. Asegurar que en la raíz del repo está el `config.toml` con `verify_jwt = true` para `modify-evaluation-v2`.
2. Desplegar solo la función:
   ```bash
   npm run supabase:deploy:v2
   ```
3. No hace falta definir `SUPABASE_JWT_SECRET` ni `JWT_SECRET` en Supabase; el gateway usa la config del proyecto para validar el JWT.

---

## 4) Cómo comprobar que V2 funciona

**Opción A – Script de verificación (ping con JWT)**  
Desde la raíz del repo, con `.env` (o `.env.local`) con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`:

```bash
npm run supabase:verify:v2
```

Debe mostrar algo como:
- `OK (default, no header): debug.build = ...-new`
- `OK (legacy header): debug.build = ...-legacy`

Si sale **401**, revisar que la anon key en `.env` sea la del proyecto (Dashboard → API → anon public). Con `verify_jwt=true`, el ping **requiere** ese token.

**Opción B – Desde la app**  
Generar una evaluación V2 desde la app (grupo con V2, generar evaluación). En la respuesta de la red, comprobar:

- Status 200 y body con `evaluationSpec`, etc.
- `response.debug.build` termina en `-new` (o `-legacy` si se envió el header correspondiente).

Eso confirma que la generación V2 está activa y qué build/modo está corriendo.

---

## 5) Resumen

| Antes (roto) | Después (arreglado) |
|--------------|----------------------|
| `verify_jwt=false` + verificación JWT manual en el handler | `verify_jwt=true`; solo el gateway valida JWT |
| Dependencia de `SUPABASE_JWT_SECRET` / `JWT_SECRET` en el runtime | No se usa ningún JWT secret en la función |
| 501 "Server auth not configured" en generación | Generación V2 responde 200 con la evaluación |
| Ping sin auth | Ping con auth (mismo JWT que el resto); script envía anon key |

Producción sigue segura: todas las peticiones (generación y ping) pasan por la validación JWT del gateway.
