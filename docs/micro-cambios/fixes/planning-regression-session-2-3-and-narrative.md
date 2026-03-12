# Fix: Regresión sesión 2/3 genéricas y narrativa docente en planificación

**Fecha:** 2025-03-12  
**Ámbito:** Solo flujo de planificación (evaluación no tocada).

---

## Resumen

Se corrigieron dos regresiones reintroducidas tras merges/pushes:

1. **Sesiones 2 y 3 genéricas:** La sesión 2 y sobre todo la 3 dejaban de ser continuaciones coherentes de la sesión 1 y pasaban a contenido/títulos placeholder.
2. **Narrativa del reporte de IA:** Volvían a mostrarse en el reporte para docentes las subsecciones "Propósito y foco", "Secuencia didáctica", "Competencias", "Evidencia esperada", "Materiales y fuentes" (y sus bloques de contenido).

---

## Causa raíz exacta

### Sesiones 2 y 3 genéricas

- **Índice de sesión en backend:** En `generate-plan-completo` se calculaba el índice para el plan de cobertura como `orden + 1`, asumiendo que el frontend enviaba `orden` **0-based** (0, 1, 2). En realidad, **todos los entrypoints envían `orden` 1-based** (1, 2, 3) porque viene de `sesion.orden` en BD, y las sesiones se crean con `orden: i + 1`. Consecuencia: sesión 1 recibía cobertura de la 2, sesión 2 de la 3, sesión 3 la única correcta; las dos primeras quedaban con foco de contenido desplazado o genérico.
- **Total de sesiones:** Si no se enviaba `totalSlots`, el backend usaba `unitContext.totalClasesUnidad` como tamaño del plan. En planes con más sesiones que clases en la unidad (p. ej. 3 sesiones y unidad de 2 clases), el plan de cobertura solo tenía 2 entradas y la sesión 3 caía en fallback (cobertura de la primera), generando contenido genérico. Los payloads ya incluyen `totalSlots` en todos los flujos; el backend debe usarlo y tratar `orden` como 1-based.

### Narrativa con secciones prohibidas

- **UI:** En `PlanningAIDesignReport` se volvía a construir la narrativa visible añadiendo bloques con esos títulos desde `contentCoverage`/competencies/etc., por lo que reaparecían en pantalla.
- **Sin sanitización:** No había un paso único que eliminara esos bloques antes de persistir y antes de mostrar, por lo que respuestas del modelo o datos antiguos podían seguir mostrándose.

---

## Archivos modificados (en este fix y en el flujo actual)

| Archivo | Cambio |
|--------|--------|
| `supabase/functions/generate-plan-completo/index.ts` | **Contrato `orden`:** Cálculo de `coverageSessionIndexUsed` corregido: si `orden` está en [1, totalSessions] se usa como índice 1-based; si no, se asume 0-based y se usa `orden + 1` (retrocompatibilidad). Con `totalSlots` se usa para `totalSessions` y así el plan de cobertura tiene una entrada por sesión. Sanitización de narrativa (quitar secciones prohibidas) y guard de títulos genéricos ya presentes. |
| `src/components/planificacion/PlanningAIDesignReport.tsx` | Narrativa docente = solo texto limpio; no se añaden bloques "Propósito y foco", etc. Se aplica `stripForbiddenNarrativeSections()` al narrativo antes de mostrarlo. |
| `src/services/planning/teacherSafeAiReport.ts` | `stripForbiddenNarrativeSections()` + lista de títulos prohibidos. En `sanitizePlanningAiDesignReport` se sanitiza narrative/report_narrative antes de devolver (persistencia). |
| `src/pages/PlanificacionWizard.tsx` | Payload con `unitContext`, `totalSlots: sesiones.length`, y `orden: sesion.orden` (1-based). |
| `src/pages/PlanificacionWorkspace.tsx` | Payload con `unitContext`, `totalSlots: sesiones.length`, `orden: sesion.orden`. |
| `src/components/planificacion/EditorSesionNuevo.tsx` | Payload con `unitContext`, `totalSlots: planificacionContext?.cantidad_sesiones ?? 1`, `orden: sesion.orden`. |
| `src/components/planificacion/EditorSesionTabs.tsx` | Payload con `unitContext`, `totalSlots: planificacionContext?.cantidad_sesiones ?? 1`, `orden: sesion.orden`. |
| `src/services/planning/sessionUnitContext.ts` | Sin cambio en este fix; usa `orden` 1-based (`sessionAssignments[orden - 1]`). |

---

## Contrato: `orden`, `unitContext`, `totalSlots`

### `orden`

- **Envío:** Todos los entrypoints envían `orden` **1-based** (1 = primera sesión, 2 = segunda, 3 = tercera). Origen: `sesion.orden` de la base de datos; las sesiones se crean con `orden: i + 1` (Wizard y flujos que insertan en `sesiones_clase`).
- **Backend:** Se interpreta como 1-based cuando `1 ≤ orden ≤ totalSessions` y se usa directamente como índice de sesión para el plan de cobertura. Si `orden` está fuera de ese rango, se asume 0-based legacy y se usa `orden + 1` limitado a [1, totalSessions].
- **sessionUnitContext:** `buildUnitContextForSession` espera `orden` 1-based; hace `sessionAssignments[orden - 1]`.

### `unitContext`

- **Wizard:** Se construye en memoria a partir de `sessionAssignments[i]` (asignación por sesión): `unidadId`, `contenido`, `claseEnUnidad`, `totalClasesUnidad`, `isExtraSlot`.
- **Workspace / EditorSesionNuevo / EditorSesionTabs:** Se obtiene con `buildUnitContextForSession({ unidades, orden: sesion.orden, totalSlots })`. Así cada sesión tiene su contexto de unidad y posición (1ª, 2ª, 3ª clase de la unidad).
- **Backend:** Usa `unitContext` para la sección de secuencia didáctica del prompt y para `buildTeacherReportNarrative`; si no hay `totalSlots`, usa `unitContext.totalClasesUnidad` como total de sesiones.

### `totalSlots`

- **Envío:** Siempre que se llame a `generate-plan-completo`: Wizard y Workspace envían `sesiones.length`; Editores envían `planificacionContext?.cantidad_sesiones ?? 1`.
- **Backend:** Si `totalSlots` es numérico y > 0, define el tamaño del plan de cobertura (`totalSessions`) y permite que la sesión N use la entrada N del plan (con `orden` 1-based). Sin `totalSlots`, se usa `unitContext?.totalClasesUnidad` (comportamiento anterior).

---

## Cómo se aplica la sanitización de la narrativa

1. **Prompt (backend):** En las reglas del reporte narrativo se indica que no se incluyan los subencabezados "Propósito y foco", "Secuencia didáctica", "Competencias", "Evidencia esperada", "Materiales y fuentes".
2. **Backend (respuesta):** `sanitizeReportNarrative` elimina esos bloques del texto antes de armar el objeto teacher-safe y devolverlo.
3. **Frontend (persistencia):** Antes de guardar en BD, `sanitizePlanningAiDesignReport` aplica `stripForbiddenNarrativeSections()` a `narrative` y `report_narrative`.
4. **Frontend (UI):** En `PlanningAIDesignReport` la "Narrativa pedagógica" es solo el narrativo limpio (sin añadir esos bloques) y se aplica `stripForbiddenNarrativeSections()` al string antes de mostrarlo.

Títulos prohibidos definidos en `FORBIDDEN_NARRATIVE_HEADINGS` en `teacherSafeAiReport.ts` y en el edge function; cualquier bloque que comience por uno de ellos (con o sin `**`) se descarta.

---

## Guardrails

- **Narrativa:** Sanitización antes de persistir y antes de mostrar; mismo conjunto de títulos prohibidos en backend y frontend.
- **Títulos genéricos:** En el backend, si el título es tipo "S3", "Sesión 3" o muy genérico y existe `sessionCoverage.contentFocus` o `unitContext.contenido`, se reemplaza por ese contexto (hasta 80 caracteres).

---

## QA manual: generación y regeneración en 3 sesiones

### Generación de 3 sesiones (Wizard)

1. Crear una planificación con **3 sesiones** (p. ej. 3 fechas o 3 en backlog) y al menos una unidad con contenido (p. ej. 3 clases estimadas).
2. Ejecutar "Generar planes" (o equivalente) para las 3 sesiones.
3. **Comprobar sesión 1:** Título y contenido deben ser de introducción/primer bloque (no genérico).
4. **Comprobar sesión 2:** Título y contenido deben ser de continuación/desarrollo (no "Sesión 2" ni igual a la 1).
5. **Comprobar sesión 3:** Título y contenido deben ser de cierre/integración (no "Sesión 3" ni igual a la 1).
6. Abrir el **Reporte de IA** de cada sesión: en "Narrativa pedagógica" no debe aparecer ninguno de: "Propósito y foco", "Secuencia didáctica", "Competencias", "Evidencia esperada", "Materiales y fuentes".

### Regeneración (Workspace o Editor)

1. En un plan ya existente con 3 sesiones, abrir la **sesión 2** o **sesión 3**.
2. Regenerar el plan con IA (Workspace o Editor).
3. Verificar que el contenido sea coherente con la posición (2ª o 3ª sesión) y que el título no sea solo "Sesión 2" / "Sesión 3" cuando haya contexto de unidad/sesión.
4. Verificar de nuevo que el reporte de IA no muestre las cinco subsecciones prohibidas.

### Resultado esperado

- Las tres sesiones tienen foco distinto y secuencia lógica (intro → desarrollo → cierre).
- Los títulos reflejan el contenido cuando hay contexto (no placeholders "Sesión 2", "S3", etc.).
- La narrativa del reporte de IA es texto continuo, sin los cinco subencabezados ni sus bloques.
