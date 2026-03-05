# Estrategia Dev/Prod: Supabase y Render (sin romper producción)

**Objetivo:** Desplegar Edge Functions de Supabase desde la rama local `micro-cambios` sin impactar la app de producción desplegada en Render (rama `production`). Este documento es solo planificación e investigación; no incluye cambios de código.

---

## 1) Relación entre Render y el proyecto Supabase

### Render (app frontend)

- **Qué es:** El hosting donde corre la **app web** (Vite/React). Render construye y sirve el frontend a partir de un **branch de Git** (en tu caso, `production`).
- **Qué usa:** La app se conecta a Supabase mediante **variables de entorno** configuradas en el servicio de Render:
  - `VITE_SUPABASE_URL` → URL del proyecto Supabase (ej. `https://XXXX.supabase.co`).
  - `VITE_SUPABASE_ANON_KEY` → Clave anónima (pública) del mismo proyecto.
- **Importante:** Esas variables se “hornean” en el build en Render. Cualquier **proyecto Supabase** que uses (DB + Edge Functions) es el que está definido por esa URL y esa clave. Si cambias la URL o la clave en Render, la app en producción apuntará a **otro** proyecto (o dejará de funcionar).

### Supabase (backend)

- **Qué es:** Un **proyecto** concreto en Supabase (base de datos + Auth + Edge Functions). Se identifica por la URL (`https://<project-ref>.supabase.co`) y por las claves (anon, service_role, etc.).
- **Qué contiene:**
  - Base de datos y migraciones.
  - Edge Functions (p. ej. `modify-evaluation-v2`). Cada función se **despliega** con la CLI (`supabase functions deploy <name>`) y queda asociada a **un solo proyecto** (el que tengas “linked” con `supabase link`).
- **Quién la usa:** Cualquier cliente (navegador, app en Render) que tenga la misma `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` está usando **ese** proyecto. Si la app en Render tiene URL y anon key del “Proyecto A”, entonces:
  - Toda la data (DB, Auth) viene del Proyecto A.
  - Todas las llamadas a Edge Functions van al Proyecto A (las funciones que estén desplegadas ahí).

### Resumen de la relación

| Componente        | Dónde vive              | Qué determina el “backend” (Supabase)      |
|-------------------|-------------------------|--------------------------------------------|
| App en Render     | Branch `production`     | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` en Render |
| Tu máquina local  | Branch `micro-cambios`  | `.env` en la raíz del repo (`VITE_SUPABASE_*`) |
| Edge Functions    | Proyecto Supabase       | El proyecto al que hiciste `supabase link` y donde ejecutaste `supabase functions deploy` |

**Conclusión:** Si la app en Render y tu `.env` local usan la **misma** URL y la **misma** anon key, ambos apuntan al **mismo** proyecto Supabase. Cualquier `supabase functions deploy` que hagas desde tu máquina **al proyecto linkeado** actualizará las funciones que usa la app en producción.

---

## 2) Checklist: ¿Local y Render usan el mismo proyecto Supabase?

Sigue estos pasos para saber si tu entorno local y la app en Render comparten el mismo proyecto.

### Variables a comparar

| Variable                 | Uso |
|--------------------------|-----|
| `VITE_SUPABASE_URL`      | URL del proyecto (ej. `https://XXXXXXXX.supabase.co`). Debe ser **idéntica** para ser el mismo proyecto. |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima. Debe ser la **misma** para el mismo proyecto (puede haber formato “publishable” o JWT legacy; lo importante es que corresponda al mismo proyecto). |

No compares `SUPABASE_SERVICE_ROLE_KEY` en Render con nada del frontend; el frontend no debe usar service role. Para este checklist solo importan las dos variables anteriores.

### Dónde ver cada valor

**Local (rama micro-cambios):**

1. En la raíz del repo: archivo **`.env`** (puede estar en `.gitignore`; no subas claves a Git).
2. Variables a leer: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Si usas `.env.local`, ese puede sobreescribir a `.env`; revisa el que use Vite en tu `npm run dev`.

**Render (producción):**

1. Entra a [Render Dashboard](https://dashboard.render.com).
2. Abre el **servicio** que corresponde a la app (Web Service).
3. Pestaña **Environment** (o **Environment Variables**).
4. Localiza `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (pueden estar marcadas como secret).

**Supabase (confirmar proyecto):**

1. [Supabase Dashboard](https://supabase.com/dashboard) → selecciona el proyecto.
2. **Project Settings** → **API**: ahí ves **Project URL** y **anon public** (o “publishable”) key. Deben coincidir con lo que usa la app (local o Render).

### Pasos del checklist

- [ ] **Paso 1:** Anotar `VITE_SUPABASE_URL` del `.env` local (rama micro-cambios).
- [ ] **Paso 2:** Anotar `VITE_SUPABASE_URL` de Render (Environment del servicio).
- [ ] **Paso 3:** ¿Son exactamente iguales?  
  - **Sí** → Local y producción usan el **mismo** proyecto Supabase. Sigue la sección 3.  
  - **No** → Apuntan a proyectos distintos. Sigue la sección 4.
- [ ] **Paso 4 (opcional):** Comparar `VITE_SUPABASE_ANON_KEY`. Deben ser la misma key del mismo proyecto; si la URL ya coincide, la key suele ser la misma. Si la URL es distinta, no hace falta comparar la key (son proyectos distintos).

---

## 3) Si local y Render usan el MISMO proyecto Supabase (enfoque seguro: proyecto DEV)

En este caso, cualquier deploy de Edge Functions que hagas desde tu máquina al proyecto linkeado **afecta directamente a producción**. La opción más segura es usar un **proyecto Supabase de desarrollo** solo para probar `micro-cambios`.

### Plan paso a paso

1. **Crear un proyecto Supabase de desarrollo (DEV)**  
   - En [Supabase Dashboard](https://supabase.com/dashboard): **New project** (ej. nombre “aulaplus-dev” o “aulaplus-micro-cambios”).  
   - Anota la **Project URL** y la **anon public** key del nuevo proyecto.

2. **Configurar el `.env` local para usar DEV**  
   - En la raíz del repo (rama `micro-cambios`):  
     - Opción A: Editar `.env` y reemplazar temporalmente `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` por los del proyecto DEV.  
     - Opción B (recomendada): Crear `.env.local` con solo esas dos variables apuntando a DEV; así no tocas el `.env` que podría seguir siendo el de prod.  
   - **Importante:** No subas `.env` ni `.env.local` a Git. Mantén el `.env` de producción en un lugar seguro (o en un gestor de secretos) por si necesitas volver.

3. **Enlazar la CLI de Supabase al proyecto DEV**  
   - En la raíz del repo:  
     ```bash
     supabase link
     ```  
   - Cuando pida proyecto, elige el **nuevo proyecto DEV** (no el de producción).  
   - Así, los comandos `supabase functions deploy` desplegarán **solo** a DEV.

4. **Desplegar Edge Functions solo en DEV**  
   - Sigue en la rama `micro-cambios`:  
     ```bash
     supabase functions deploy modify-evaluation-v2
     ```  
   - Si tienes otras funciones que quieras probar en DEV, despliégalas también.  
   - Este deploy **no** toca el proyecto que usa Render (producción).

5. **Verificar con el marcador `debug.build`**  
   - En el código de `modify-evaluation-v2` hay una constante `DEBUG_BUILD` (p. ej. en `supabase/functions/modify-evaluation-v2/index.ts`). La respuesta JSON de la función incluye `debug.build` con ese valor.  
   - Con la app local (`npm run dev`) usando el `.env`/`.env.local` de **DEV**: genera una evaluación V2 y en la respuesta (Network o consola) revisa `response.debug.build`.  
   - Debe coincidir con el valor actual de `DEBUG_BUILD` en tu rama `micro-cambios`. Así confirmas que la app está llamando a la función desplegada en DEV y que esa es la versión nueva.

6. **Volver a producción cuando quieras**  
   - Para seguir desarrollando contra prod (con cuidado): restaura en `.env` (o borra `.env.local`) las variables del proyecto de producción y haz `supabase link` de nuevo al proyecto de producción.  
   - Para llevar los cambios a producción: cuando `micro-cambios` esté listo, merge a `production` y en Render se construirá el frontend desde `production`. Las **Edge Functions** de producción solo cambian cuando alguien ejecute `supabase link` al **proyecto de producción** y luego `supabase functions deploy modify-evaluation-v2` (u otras). Ese deploy puede hacerse desde la misma máquina o desde CI, pero siempre al proyecto correcto.

---

## 4) Si local y Render ya usan proyectos DIFERENTES

Si el checklist mostró que la URL (y/o la anon key) de Render es **distinta** a la de tu `.env` local, entonces:

- La **app en Render** usa un proyecto Supabase (llamémoslo “Prod”).
- Tu **entorno local** usa otro proyecto (p. ej. ya un DEV).

En este caso puedes desplegar desde `micro-cambios` con menos riesgo de tocar prod **si** despliegas solo al proyecto al que apunta tu local (el que tengas linkeado con `supabase link`).

### Pasos seguros para micro-cambios

1. Confirmar a qué proyecto está linkeada la CLI:  
   ```bash
   supabase link
   ```  
   Ver qué proyecto muestra (o enlazar explícitamente al que quieras usar para pruebas).

2. Desplegar solo las funciones que cambiaste:  
   ```bash
   supabase functions deploy modify-evaluation-v2
   ```

3. Probar con la app local (que ya apunta a ese proyecto por `.env`): generar una evaluación V2 y comprobar `response.debug.build`.

4. **Llevar a producción cuando corresponda:**  
   - Hacer `supabase link` al **proyecto que usa Render** (prod).  
   - Ejecutar de nuevo `supabase functions deploy modify-evaluation-v2`.  
   - Solo en ese momento las funciones de producción se actualizarán. El frontend en Render no cambia hasta que Render vuelva a construir desde el branch que tenga los cambios (normalmente `production` tras merge).

---

## 5) No romper producción: errores frecuentes

- **Desplegar al proyecto equivocado**  
  Si local y Render usan el **mismo** proyecto y haces `supabase functions deploy` con ese proyecto linkeado, **producción** usará la nueva versión de la función de inmediato. Evita esto usando un proyecto DEV para pruebas (sección 3).

- **Hacer `supabase link` al proyecto de producción y luego deploy**  
  Un solo `supabase functions deploy modify-evaluation-v2` después de `supabase link` a prod actualiza la función en prod. Asegúrate de querer eso (p. ej. después de merge a `production` y de haber probado en DEV).

- **Cambiar variables en Render por error**  
  Si en Render cambias `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY` al proyecto DEV (o a otro proyecto), la app en producción dejará de usar la base de datos y las funciones de producción. No uses las variables de un proyecto DEV en el servicio de Render de producción.

- **Perder las variables de producción**  
  Si sobrescribes el `.env` local con las de DEV, guarda antes las de prod (en un gestor de secretos o copia segura) para poder restaurar o volver a linkear a prod.

- **Confundir “branch” con “proyecto Supabase”**  
  El branch (`production` vs `micro-cambios`) solo afecta qué código construye Render y qué código tienes local. **Qué proyecto Supabase usa** lo definen solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en cada entorno. Puedes tener `micro-cambios` local apuntando a un proyecto DEV y `production` en Render apuntando al proyecto prod.

- **No verificar después del deploy**  
  Después de cualquier deploy a un proyecto (DEV o prod), conviene hacer una llamada V2 y comprobar `debug.build` en la respuesta para confirmar que está corriendo la versión que esperas.

---

## Resumen rápido

| Situación | Acción recomendada |
|-----------|--------------------|
| Local y Render = **mismo** proyecto | Crear proyecto Supabase DEV; `.env`/`.env.local` local → DEV; `supabase link` → DEV; `supabase functions deploy` solo a DEV; verificar con `debug.build`. |
| Local y Render = **distinto** proyecto | Deploy desde `micro-cambios` al proyecto linkeado (el de tu local) es seguro para prod; para actualizar prod, hacer `supabase link` a prod y luego deploy cuando esté listo. |
| Cualquier caso | No cambiar `VITE_SUPABASE_*` en Render a valores de un proyecto de prueba. No hacer deploy a prod sin haber probado en DEV o en el proyecto no-prod. |

Este documento no modifica código; es la estrategia y el checklist para decidir y ejecutar deploys de forma segura.
