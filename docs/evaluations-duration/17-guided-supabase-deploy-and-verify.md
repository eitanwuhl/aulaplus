# Deploy guiado y verificación de modify-evaluation-v2

**Objetivo:** Desplegar solo la Edge Function `modify-evaluation-v2` al proyecto Supabase configurado en `.env`, con confirmación y verificación, sin tocar Render ni la rama `production`.

---

## 1) Qué hacen los scripts

| Script | Qué hace |
|--------|----------|
| **supabase:deploy:v2** | Lee `VITE_SUPABASE_URL` de `.env`/`.env.local`, muestra el proyecto al que vas a desplegar, pide que escribas `YES` para continuar, ejecuta `supabase functions deploy modify-evaluation-v2` y al terminar imprime los pasos para verificar. |
| **supabase:verify:v2** | Envía dos peticiones **ping** (body `{ "__ping": true }`) a la función: una sin header y otra con `x-aulaplus-env: legacy`. Comprueba que `response.debug.build` termine en `-new` y en `-legacy` respectivamente. No llama a OpenAI. Si algo no coincide, sale con error. |

La función usa una constante **BUILD_ID** en código; las respuestas incluyen `debug.build = BUILD_ID + "-new"` o `BUILD_ID + "-legacy"` según el path. El ping usa el mismo marcador para que el script de verificación pueda comprobar el comportamiento sin generar evaluaciones.

---

## 2) Cómo ejecutarlos

Desde la **raíz del repo** (donde está `package.json`):

```bash
# Desplegar (guiado: muestra proyecto, pide YES, despliega solo modify-evaluation-v2)
npm run supabase:deploy:v2

# Verificar tras el deploy (ping default = -new, ping legacy = -legacy)
npm run supabase:verify:v2
```

Requisitos:

- Tener **Supabase CLI** instalado y en el PATH (`supabase --version`).
- Tener el proyecto **linkeado** (`supabase link`); el proyecto linkeado debe ser el mismo que `VITE_SUPABASE_URL` en tu `.env`, o el deploy irá a otro proyecto.
- Archivo **`.env`** (o `.env.local`) con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para el script de verificación.

---

## 3) Salida esperada

### Deploy

```
========================================
  Supabase Edge Function — Guided Deploy
  Function: modify-evaluation-v2 only
========================================

Supabase project (from .env / .env.local):
  VITE_SUPABASE_URL = https://XXXXXXXX.supabase.co
  Project ref        = XXXXXXXX

This deploy will update the Edge Function on the project above.
If your Render production app uses this same project, it will use the new function after deploy.

Type YES to continue (anything else cancels): YES

Deploying...

Bundling modify-evaluation-v2...
Deploying modify-evaluation-v2...
... (output de Supabase CLI) ...

========================================
  Deploy finished successfully
========================================

Verify that the deployed function uses the NEW default behavior:

  npm run supabase:verify:v2
...
```

### Verificación

```
========================================
  Verify modify-evaluation-v2 (ping only)
========================================

URL: https://XXXXXXXX.supabase.co/functions/v1/modify-evaluation-v2

OK (default, no header): debug.build = v2-guided-deploy-2026-02-new
OK (legacy header): debug.build = v2-guided-deploy-2026-02-legacy

All checks passed. NEW default and LEGACY rollback path are working.
```

Si algo falla (por ejemplo `debug.build` no termina en `-new` o `-legacy`), el script imprime un mensaje claro y termina con código de salida 1.

---

## 4) Notas de seguridad (Supabase compartido con Render)

- **Mismo proyecto:** Si la app en Render usa el mismo `VITE_SUPABASE_URL` que tu `.env` local, un deploy desde tu máquina **actualiza la función que usa producción**. El script te muestra la URL antes de desplegar para que confirmes.
- **Confirmación:** No se despliega nada hasta que escribes `YES` (exactamente, mayúsculas).
- **Solo una función:** Solo se despliega `modify-evaluation-v2`; no se tocan otras funciones ni la base de datos.
- **Render y Git:** No hace falta cambiar variables en Render ni hacer push a la rama `production`; el frontend en Render sigue llamando a la misma URL de Supabase y usará la nueva versión de la función en la siguiente petición.

Para no afectar producción, usa un **proyecto Supabase de desarrollo** (otra URL en `.env.local`) y enlázalo con `supabase link` antes de ejecutar el deploy. Ver `11-dev-prod-supabase-strategy.md`.

---

## 5) Troubleshooting

| Problema | Qué hacer |
|----------|-----------|
| **Supabase CLI no instalado** | Instalar: ver [docs de Supabase](https://supabase.com/docs/guides/cli). En Windows puede ser `supabase.exe`; asegúrate de que `supabase` esté en el PATH. |
| **Cannot find project ref / not linked** | En la raíz del repo ejecutar `supabase link` y elegir el proyecto. El proyecto linkeado debe ser el que corresponda a `VITE_SUPABASE_URL` de tu `.env` si quieres desplegar donde apunta tu app. |
| **Error de autenticación al desplegar** | Iniciar sesión: `supabase login`. Si usas token: configurar según documentación de la CLI. |
| **Deploy OK pero verify falla** | Comprobar que `VITE_SUPABASE_ANON_KEY` en `.env` sea la clave anónima (pública) del mismo proyecto. Si la función requiere JWT, la anon key debe ser válida para ese proyecto. |
| **FAIL (default): expected debug.build to end with "-new"** | La función desplegada no es la que incluye BUILD_ID y el path new/legacy. Asegúrate de haber desplegado el código actual (rama donde está BUILD_ID y el ping con `currentBuildMarker`) y de estar llamando al proyecto correcto. |
| **Script no encuentra .env** | Ejecutar desde la raíz del repo (`cd` al directorio donde está `package.json`). Los scripts leen `.env` y `.env.local` desde `process.cwd()`. |

---

## Resumen de comandos

```bash
npm run supabase:deploy:v2   # Despliega (con confirmación)
npm run supabase:verify:v2   # Verifica -new y -legacy con ping
```
