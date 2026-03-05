# Fix de flicker + `ERR_CONNECTION_CLOSED` en Workspace de Planificación

**Objetivo:** evitar bucles de loading/flicker, detener ciclos de reintento infinitos y mostrar errores claros cuando falla la carga del plan.

---

## 1) Análisis de causa raíz

Se detectaron múltiples factores combinados:

1. **Dependencia inestable en `useEffect` de carga de planificación**  
   En `PlanificacionWorkspace`, `backToState` se construía como objeto literal en cada render y estaba en dependencias del efecto de carga.  
   Resultado: el efecto podía dispararse repetidamente aunque `id` no cambiara, alternando estados de loading (`isLoadingPlan`) y provocando flicker.

2. **Estado `isEnsuringPlans` podía quedar atascado**  
   En el efecto de auto-generación de planes faltantes, si se activaba cleanup/cancelación en un momento intermedio, el flag podía no liberarse en todos los caminos.  
   Resultado: loading persistente o estado de “generando” sin salida.

3. **Sin guard estricto de in-flight para ciclos ensure/load**  
   El flujo podía relanzar ciclos sobre el mismo conjunto de sesiones faltantes, especialmente bajo errores de red.

4. **Logs excesivos de objetos grandes**  
   Había logs con objetos de sesión completos y contenido extenso (incluyendo HTML), que degradaban rendimiento del navegador y empeoraban la experiencia durante reintentos.

5. **Falla de red (`ERR_CONNECTION_CLOSED`) sin estrategia de recuperación acotada**  
   La carga de `planificaciones` no tenía backoff/reintentos limitados a nivel workspace.  
   Resultado: alternancia entre pantallas de loading y error, con reintentos implícitos por re-render.

---

## 2) Por qué ocurría `ERR_CONNECTION_CLOSED` y cómo se maneja ahora

`ERR_CONNECTION_CLOSED` es un fallo de transporte HTTP (conexión cerrada), no un error de lógica de `generate-plan-completo` en sí.  
Como la función edge devolvía HTML correctamente pero luego fallaba el GET a `/rest/v1/planificaciones`, el problema se expresaba en la fase de lectura del registro.

### Manejo nuevo

- Se agregó `fetchPlanificacionWithRetry(planId)` con:
  - **máximo 3 intentos**,
  - **backoff incremental**,
  - clasificación básica de error de red,
  - error final claro si agotó intentos.
- Si falla definitivamente:
  - se corta el ciclo,
  - se muestra error visible con contexto de `planId`,
  - no se mantiene spinner infinito.

---

## 3) Cambios implementados (archivos)

### `src/pages/PlanificacionWorkspace.tsx`

1. **Estabilización de dependencias**
   - `backToState` pasó a `useMemo` para evitar que cambie referencia en cada render.

2. **Guardas estrictas de concurrencia**
   - `planLoadInFlightRef` para impedir cargas concurrentes de la misma planificación.
   - `ensureInFlightRef` para impedir más de un ciclo `ensurePlans` simultáneo.

3. **Ciclo ensure por firma única**
   - Se mantiene/usa `attemptedMissingSignaturesRef` para evitar relanzar infinitamente el mismo conjunto de sesiones faltantes.
   - Si reaparece la misma firma, se corta con error visible y se pide retry manual.

4. **Liberación defensiva de flags**
   - `setIsEnsuringPlans(false)` se ejecuta en finalización del ciclo (incluyendo caminos cancelados), evitando estado pegado.

5. **Retry manual limpio**
   - `handleRetryGeneration` limpia las guardas (`attemptedMissingSignaturesRef`, `ensureInFlightRef`) antes de recargar.

6. **Timeout de generación por sesión**
   - `generatePlanForSession` usa timeout de 120s con `Promise.race`, evitando waits indefinidos.

7. **Observabilidad controlada**
   - Debug mode opcional (`window.__PLAN_WS_DEBUG__ === true`) con logs concisos.
   - Se eliminan logs verbosos de sesión/HTML en flujo normal.

### `src/hooks/useCalendarioSesiones.ts`

1. **Reducción de logging pesado**
   - Logs de carga de sesiones se limitaron a resumen (count/error), no dump completo de datos.
   - Debug mode opcional (`window.__PLAN_SESIONES_DEBUG__ === true`).

---

## 4) Pasos de prueba manual

1. Crear una planificación nueva desde el wizard y finalizar.
2. Verificar que entra al workspace sin alternar indefinidamente entre:
   - “Generando contenido…”
   - “Cargando planificación…”
3. Confirmar que, si hay sesiones faltantes:
   - corre un único ciclo ensure por firma de faltantes,
   - no hay loops concurrentes.
4. Simular red inestable (o fallo transitorio):
   - verificar que se hacen reintentos limitados de carga,
   - si falla definitivamente, aparece error claro con contexto (no spinner eterno).
5. Pulsar “Reintentar generación”:
   - comprobar que limpia guardas y relanza ciclo una sola vez.
6. Activar debug opcional en consola:
   - `window.__PLAN_WS_DEBUG__ = true`
   - `window.__PLAN_SESIONES_DEBUG__ = true`
   - validar logs concisos con `planId` y `attempt`.

---

## 5) Resultado esperado

- Sin flicker infinito.
- Sin loading perpetuo.
- Reintentos acotados y con backoff.
- Error visible cuando no se puede recuperar.
- Workspace responsivo (sin freeze por logs gigantes).
