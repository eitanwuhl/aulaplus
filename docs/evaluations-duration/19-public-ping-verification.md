# Verificación por ping público (sin JWT)

> **Nota:** Se revirtió el enfoque de ping público: la función volvió a `verify_jwt=true` para evitar 501 en generación. El ping **requiere** JWT (mismo que la app). Ver **docs/evaluations-duration/21-fix-v2-auth-501.md** para la configuración actual y cómo verificar.

**Problema (histórico):** Tras un deploy correcto, `npm run supabase:verify:v2` devolvía **HTTP 401 Invalid JWT**. El script enviaba `Authorization: Bearer <VITE_SUPABASE_ANON_KEY>` y `apikey`, pero la verificación debe ser sencilla y no depender de sesión ni de JWT.

---

## 1) Por qué aparecía "Invalid JWT"

El **gateway** de Supabase comprueba el JWT **antes** de que la petición llegue al código de la función. Por defecto (`verify_jwt = true`):

- Toda llamada a la función debe incluir un token válido (p. ej. `Authorization: Bearer <anon_key>`).
- La anon key es un JWT; si el proyecto usa otro formato de clave (p. ej. publishable key que no es JWT) o el token está mal formado/caducado, el gateway responde **401 Invalid JWT** y la función **no se ejecuta**.

Por tanto, ningún cambio solo dentro del handler podía hacer el ping “público”: había que cambiar la configuración del gateway para esa función.

---

## 2) Por qué el ping es público y sigue siendo seguro

- **Configuración:** En `supabase/config.toml` la función `modify-evaluation-v2` tiene **`verify_jwt = false`**. Así el gateway deja pasar todas las peticiones y el handler decide.
- **En el handler:**  
  - Se parsea el body.  
  - Si el body es **`{ "__ping": true }`** → se responde de inmediato con `{ success, pong, debug: { build, mode, now } }` y **no** se exige JWT ni se llama a OpenAI ni a la base de datos.  
  - Para **cualquier otra** petición (generación, ajuste, etc.) se exige un JWT válido; si falta o es inválido se devuelve **401** desde nuestro código.
- **Qué expone el ping:** Solo el marcador de build y el modo (`new`/`legacy`). No se exponen secretos ni datos de evaluación.
- **Resumen:** El ping es “público” solo en el sentido de que no requiere JWT; el resto del endpoint sigue protegido por JWT dentro del handler.

---

## 3) Cómo desplegar y verificar

1. **Desplegar** (aplica `config.toml` con `verify_jwt = false` para `modify-evaluation-v2`; hay que redesplegar si se cambia la config):
   ```bash
   npm run supabase:deploy:v2
   ```
   Escribir `YES` cuando pida confirmación.

2. **Verificar** (sin enviar Authorization ni apikey):
   ```bash
   npm run supabase:verify:v2
   ```
   - Debe mostrar: `OK (default, no header): debug.build = ...-new` y `OK (legacy header): debug.build = ...-legacy`.
   - Si sigue saliendo 401, comprobar que el deploy se hizo con el `config.toml` actual (con `[functions.modify-evaluation-v2] verify_jwt = false`) y que la función desplegada es la que tiene el path ping público y la comprobación JWT para no-ping.

3. **Forma de la respuesta ping:**
   ```json
   {
     "success": true,
     "pong": true,
     "debug": {
       "build": "<BUILD_ID>-new",
       "mode": "new",
       "now": "<ISO timestamp>"
     }
   }
   ```
   Con header `x-aulaplus-env: legacy` el `build` y `mode` pasan a `...-legacy` y `legacy`.

El script de verificación **no** envía `Authorization` ni `apikey`; solo `Content-Type: application/json` y, en el segundo request, `x-aulaplus-env: legacy`.
