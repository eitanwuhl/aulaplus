# Fix del script de verificación (auth y forma de la respuesta)

**Problema:** Tras un deploy correcto, `npm run supabase:verify:v2` fallaba con "response.debug.build missing or not a string" en ambos checks (default y legacy).

---

## 1) Por qué fallaba la verificación

Las causas más probables son:

1. **Auth en el gateway de Supabase:** Las Edge Functions suelen exigir autenticación. Si solo se envía `Authorization: Bearer <key>`, algunos proyectos o configuraciones pueden rechazar la petición o devolver una respuesta de gateway (por ejemplo JSON con `message` o `error`) que **no** incluye `debug.build`. Así el script ve un JSON válido pero sin `response.debug.build`.

2. **Cabeceras requeridas:** En muchos proyectos de Supabase hace falta enviar **ambas** cabeceras:
   - `Authorization: Bearer <VITE_SUPABASE_ANON_KEY>`
   - `apikey: <VITE_SUPABASE_ANON_KEY>`
   para que la petición llegue a la función y no se quede en el gateway.

3. **Falta de información en el fallo:** Si el script no imprimía el status HTTP ni el body, no se podía ver si la respuesta era 401/403 u otro JSON sin `debug.build`.

---

## 2) Cabeceras que envía ahora el script

El script `scripts/supabase-verify-v2.js` envía siempre:

- `Content-Type: application/json`
- `Authorization: Bearer <VITE_SUPABASE_ANON_KEY>`
- `apikey: <VITE_SUPABASE_ANON_KEY>`

En la segunda petición (legacy) además:

- `x-aulaplus-env: legacy`

Todas las cabeceras usan el valor de `VITE_SUPABASE_ANON_KEY` leído de `.env` / `.env.local`.

---

## 3) Forma de la respuesta ping

La función contesta al body `{ "__ping": true }` **muy pronto** en el handler (justo después de parsear el body y sin llamar a OpenAI), con un JSON como:

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

Con el header `x-aulaplus-env: legacy`:

```json
{
  "success": true,
  "pong": true,
  "debug": {
    "build": "<BUILD_ID>-legacy",
    "mode": "legacy",
    "now": "<ISO timestamp>"
  }
}
```

- `debug.build` es siempre un string (p. ej. `v2-guided-deploy-2026-02-new` o `...-legacy`).
- `debug.mode` indica el path usado (`new` o `legacy`).

Si la petición no llega a la función (auth o gateway), la respuesta será otra (p. ej. 401 con otro JSON) y el script mostrará status y body para diagnosticar.

---

## 4) Cómo ejecutar deploy y verificación de forma fiable

1. **Variables de entorno:** En la raíz del repo, tener `.env` (o `.env.local`) con:
   - `VITE_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<anon public key del mismo proyecto>`

2. **Desplegar:**
   ```bash
   npm run supabase:deploy:v2
   ```
   Escribir `YES` cuando pida confirmación.

3. **Verificar:**
   ```bash
   npm run supabase:verify:v2
   ```
   Debe mostrar:
   - `OK (default, no header): debug.build = ...-new`
   - `OK (legacy header): debug.build = ...-legacy`

4. Si la verificación falla, el script imprime:
   - **HTTP status** de la respuesta
   - **Body** (completo si es corto, o los primeros ~1200 caracteres)
   así puedes ver si es un 401, un mensaje del gateway o una respuesta inesperada de la función.

---

## 5) CORS

La cabecera `x-aulaplus-env` está incluida en `Access-Control-Allow-Headers` de la función para que, si alguien prueba desde el navegador, pueda enviar el header de rollback. El script de verificación corre en Node y no depende de CORS.
