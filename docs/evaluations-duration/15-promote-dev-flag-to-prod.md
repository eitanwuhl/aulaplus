# Promoción del flag dev a producción (NEW por defecto + rollback legacy)

**Objetivo:** Hacer que el comportamiento **NEW** (auto-extend heurístico, validación/reparación de excerpts, auto-trim, bundling) sea el **por defecto** en producción, manteniendo un interruptor de rollback para emergencias.

---

## 1) Cómo quedó el comportamiento

| Condición | Comportamiento |
|-----------|----------------|
| **Por defecto** (header ausente o cualquier valor distinto de `legacy`) | **NEW**: se ejecutan auto-extend (2–3 intentos), validación y reparación de excerpts, auto-trim cuando la estimación > 120% del target. |
| **Header `x-aulaplus-env: legacy`** | **LEGACY**: se omiten auto-extend, validación/repair de excerpts y auto-trim. El resto del flujo (generación, normalización, aiReport) es igual. |

El frontend de producción **no** debe enviar nunca el header `x-aulaplus-env: legacy`. Ese header es solo para pruebas manuales o rollback de emergencia (p. ej. curl o Postman).

---

## 2) Cómo promover (qué se hizo)

- **Default invertido:** Antes, el “dev” se activaba con `x-aulaplus-env: dev`; ahora el default es NEW (no hace falta ningún header para producción).
- **Rollback:** Si en una petición se envía `x-aulaplus-env: legacy` (case-insensitive), el handler usa la ruta LEGACY (sin extend, excerpt, trim).
- **Marcador en respuestas:** Todas las respuestas incluyen `debug.build` con sufijo:
  - **NEW:** `debug.build = "<DEBUG_BUILD>-new"` (ej. `v3-timeout-fix-DEPLOY-FP-2026-02-17-05-new`).
  - **LEGACY:** `debug.build = "<DEBUG_BUILD>-legacy"`.
- **CORS:** Se añadió `x-aulaplus-env` a `Access-Control-Allow-Headers` para que pruebas manuales desde el navegador puedan enviar el header si hace falta.

Para “promover” en producción basta con **desplegar** esta versión de la edge function. No hay que cambiar variables de entorno ni el frontend: al no enviar `x-aulaplus-env: legacy`, todas las peticiones usan NEW.

---

## 3) Cómo hacer rollback rápido con el header legacy

Si en producción aparece un problema atribuible al comportamiento NEW (extend, excerpt o trim), se puede volver al comportamiento anterior **por petición** sin redesplegar:

1. **Desde curl (recomendado para comprobar):**
   ```bash
   curl -X POST "https://<TU_PROYECTO>.supabase.co/functions/v1/modify-evaluation-v2" \
     -H "Authorization: Bearer <ANON_KEY>" \
     -H "Content-Type: application/json" \
     -H "x-aulaplus-env: legacy" \
     -d '{"__ping": true}'
   ```
   La respuesta debe incluir `debug.build: "...-legacy"`. Para una generación real, sustituye el body por el payload completo de la app.

2. **Desde el navegador (DevTools / extensión):**  
   Añadir a la petición que invoca `modify-evaluation-v2` el header `x-aulaplus-env: legacy`. La respuesta debe mostrar `debug.build` con sufijo `-legacy`.

3. **Rollback “global” sin redeploy:**  
   No hay mecanismo automático. Opciones: (a) cambiar temporalmente el frontend para que envíe `x-aulaplus-env: legacy` en todas las llamadas a V2 (solo si se controla el deploy del frontend), o (b) redeploy de la edge function a la versión anterior del código. El header legacy sirve sobre todo para **probar** que el problema se debe al path NEW y para uso puntual/emergencia.

---

## 4) Cómo quitar el path legacy más adelante

Cuando el comportamiento NEW lleve suficiente tiempo estable en producción y se decida eliminar el path LEGACY:

1. **En la edge function `modify-evaluation-v2`:**
   - Eliminar la lectura del header `x-aulaplus-env` y la variable `useLegacyPath`.
   - Eliminar el `if (!useLegacyPath) { ... }` que envuelve auto-extend, validación de excerpts y auto-trim (dejar solo el contenido del bloque).
   - Dejar un único marcador: `debug.build = DEBUG_BUILD` (o mantener el sufijo `-new` si se quiere seguir distinguiendo en logs).
   - Opcional: quitar `x-aulaplus-env` de `Access-Control-Allow-Headers` si ya no se usa.

2. **Documentación:**  
   Actualizar o archivar este doc (15-promote-dev-flag-to-prod.md) indicando que el rollback por header ya no existe.

3. **Desplegar** la nueva versión de la función.

No se requieren cambios en el frontend para la eliminación del path legacy, ya que el frontend no debe depender de `x-aulaplus-env: legacy`.

---

## 5) Verificación

- **Producción (default):** Llamar a V2 **sin** header `x-aulaplus-env`. La respuesta debe tener `debug.build` terminado en `-new`.
- **Rollback:** Llamar a V2 **con** header `x-aulaplus-env: legacy`. La respuesta debe tener `debug.build` terminado en `-legacy` y no debe ejecutarse auto-extend ni excerpt repair ni auto-trim (se puede comprobar por logs en Supabase o por duración/estructura del spec).
- **Logs:** En los logs de la función aparecen líneas `[BEHAVIOR] useLegacyPath=true|false` y `buildMarker=...-new|...-legacy`.
