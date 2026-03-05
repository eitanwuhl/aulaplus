# Fix del ajuste de duración (auto-extend / auto-trim)

**Objetivo:** Hacer que el LLM modifique el spec de forma que la **estimación heurística** suba o baje de forma fiable, en lugar de limitarse a expandir o acortar texto (que no cambia la estimación).

---

## 1) Por qué fallaba el extend anterior

La estimación de duración se calcula con `estimateDurationFromSpec`: **suma por tipo de ítem** (y 1 min de sobrecarga por sección). La cantidad de texto o explicaciones **no** entra en la fórmula.

En pruebas reales, con objetivo 80 min la estimación extendida seguía en ~32 min. Los logs mostraban `[DURATION_AUTO_EXTEND] extended estimate=32 target=80`. El modelo estaba **ampliando texto** dentro de ítems existentes, pero eso no aumenta los minutos heurísticos. Por tanto, el auto-extend no podía acercarse al objetivo hasta que el prompt obligara al modelo a **añadir ítems o cambiar tipos** (según la tabla de minutos por tipo).

---

## 2) Cambios en el prompt y la lógica del extend

### Prompt de extend

- **Regla explícita:** “Añadir más texto o explicaciones más largas NO aumenta la duración estimada en este sistema.”
- **Instrucción explícita:** “Para aumentar la duración estimada DEBES añadir ítems nuevos y/o convertir tipos de ítem a tipos de más minutos según la tabla proporcionada.”
- Se incluye la **tabla heurística** en el prompt (mismos valores que en `durationMath.ts`: minutos por tipo + 1 min de sobrecarga por sección). Se aclara que la estimación es **suma por tipo de ítem**, no por cantidad de texto.
- Se envían **currentEstimateMinutes**, **targetMinutes**, banda low/high (90–110%) y **deltaMinutesNeeded** (minutos heurísticos que faltan para llegar al menos a `low`).
- Guía concreta: añadir al menos `deltaMinutesNeeded` minutos en ítems; preferir ítems nuevos con IDs únicos; no modificar IDs existentes; se pueden añadir 1–2 secciones si hace falta (sobrecarga 1 min por sección, enfocarse en ítems).

### Bucle de 2 intentos

- Si el intento 1 devuelve un spec válido pero la estimación heurística **no sube de forma relevante** (p. ej. `newEst <= oldEst + 1`), el intento 2 lleva una instrucción añadida: “Tu intento anterior no aumentó los minutos heurísticos estimados; debes añadir ítems nuevos o cambiar tipos de ítem; expandir texto no basta.”
- Se mantiene la lógica de “mejor spec” y se prioriza el spec que **aumente** la estimación heurística.

### Logs

- Inicial: `initial estimate`, `target`, `deltaMinutesNeeded`.
- Por intento: `oldEst → newEst` y, si aplica, “rejected: heuristic estimate did not increase meaningfully”.

---

## 3) Auto-trim (cuando la estimación supera el 120% del objetivo)

Si `estimatedMinutes > targetDurationMinutes * 1.2`, se ejecuta un único paso de **auto-trim** (`runDurationAutoTrim`):

- **Reglas en el prompt:** No basta con acortar texto; hay que **reducir la estimación heurística** quitando ítems o convirtiendo a tipos de menos minutos. Mantener la cobertura esencial. No cambiar los IDs de los ítems que se conserven; los ítems eliminados desaparecen.
- Banda objetivo 90–110%. Se usa la misma tabla heurística y validación/normalización que en el extend.
- Si el trim falla (parse, validación o OpenAI), se devuelve la evaluación sin recortar y se añade el warning **DURATION_TRIM_FAILED**.

---

## 4) Cómo probar a mano

- **Target 80:** Generar una evaluación con duración objetivo 80 min. Revisar que, si la estimación inicial es baja, el extend añada ítems o cambie tipos hasta acercarse a 80 (logs: `deltaMinutesNeeded`, `oldEst → newEst`). Comprobar en la UI “objetivo vs estimado”.
- **Target 120:** Igual con objetivo 120 min; verificar que el extend suba la estimación heurística de forma apreciable cuando parta de menos del 85% del objetivo.
- **Target 10:** Generar con objetivo 10 min. Si la evaluación generada tiene estimación > 12 min (120% de 10), debe ejecutarse el auto-trim. Comprobar que la estimación baje (o que aparezca DURATION_TRIM_FAILED si el trim falla).

---

## 5) Limitaciones conocidas

- **Tokens:** Respuestas muy largas pueden truncarse; el spec podría quedar inválido. El flujo actual hace hasta 2 intentos de extend y 1 de trim; si fallan, se devuelve best-effort con los warnings correspondientes.
- **Comportamiento best-effort:** No se garantiza alcanzar exactamente la banda 90–110%; si tras los intentos la estimación sigue fuera de rango, se mantiene el mejor spec y se emite DURATION_EXTEND_FAILED o DURATION_TOO_LONG / DURATION_TRIM_FAILED según el caso.
- **IDs:** Los IDs de ítems/secciones existentes no se modifican; solo los ítems nuevos llevan IDs únicos generados por el modelo.
