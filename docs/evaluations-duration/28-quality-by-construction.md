# Calidad por construcción: una sola llamada y safeguards deterministas

**Objetivo:** Reducir WORKER_LIMIT manteniendo (o mejorando) la calidad de la evaluación, moviendo los requisitos al prompt principal y eliminando cascadas de reparación por LLM.

---

## 1) Por qué aparecía WORKER_LIMIT

Cada request de generación V2 podía ejecutar **varias llamadas a OpenAI** en secuencia:

1. **Generación principal** (spec completo).
2. **Bucle de extensión de duración** (hasta 2–3 intentos si la duración estimada quedaba por debajo del 95% del objetivo).
3. **Reparación de excerpts** (si los ítems `source_analysis` no tenían fragmento válido).
4. **Auto-trim** (si la duración superaba el 120% del objetivo).
5. **Reparación de rúbrica y promptB** (mejorar rúbricas genéricas y rellenar `versionedContent.promptB` faltantes).
6. **Reparación de validez de ítems** (ordenamiento sin lista, relación sin columnas, MC con &lt;3 opciones, excerpt answer-leaking).
7. **Llamadas adicionales de narrativa** (si el reporte era demasiado corto o faltaban narrativas B/C).

Esa cantidad de llamadas por request consumía mucho tiempo y recursos en el worker, lo que disparaba límites de tiempo (WORKER_LIMIT) y errores de disponibilidad.

---

## 2) Diseño nuevo: una sola llamada en flujo normal

**Estrategia:** Exigir en el **prompt principal** que el modelo cumpla desde el primer intento:

- **Duración:** banda 95–105% del objetivo usando la tabla heurística (minutos por tipo de ítem y sobrecarga por sección).
- **Validez por tipo:**
  - **ordering:** `itemsToOrder` con al menos 2 elementos con texto visible.
  - **matching:** `leftColumn` y `rightColumn` con al menos 2 elementos cada uno y texto visible.
  - **multiple_choice:** al menos 3 opciones con `id` y `text`.
  - **source_analysis:** fragmento de 1–3 párrafos coherentes; prohibido portada/metadatos/abstract que “regale” la respuesta.
- **Versión B:** si se solicita B, **cada** ítem debe incluir `versionedContent.promptB`.
- **Rúbricas:** en ítems abiertos, descriptores específicos al contenido y a la acción pedida (no genéricos).

Con esto, en el flujo típico **solo se hace una llamada OpenAI** (la generación del spec). El resto de pasos son deterministas o opcionales (extend/trim solo cuando la duración lo justifica).

**Configuración:** Por defecto las reparaciones por LLM están **desactivadas** (`USE_LLM_REPAIRS = false`). Se puede activar con la variable de entorno `MODIFY_EVALUATION_V2_USE_LLM_REPAIRS=true` para volver al comportamiento anterior si hace falta.

---

## 3) Safeguards deterministas que se mantienen

Estos pasos **no** usan OpenAI y siempre se ejecutan cuando aplica:

| Safeguard | Descripción |
|-----------|-------------|
| **Validación de excerpts** | Comprueba longitud mínima y coherencia de `source.content` en ítems `source_analysis`. |
| **Limpieza/selección de excerpts** | `applyExcerptCleaningToSpec`: reemplaza contenido crudo/metadatos por 1–3 párrafos sustantivos del material cuando hay texto extraído. |
| **Degradación por excerpt inválido** | Si tras la limpieza un ítem sigue sin fragmento válido, se degrada (p. ej. a respuesta corta) con aviso al docente. |
| **Validación de ítems** | `validateSpecItems`: comprueba por tipo (ordering, matching, MC, source_analysis) según las reglas de validez y answer-leaking. |
| **Degradación de ítems inválidos** | `degradeInvalidItems`: convierte ítems inválidos a un tipo seguro (p. ej. short_answer) con rúbrica de respaldo, sin LLM. |
| **Delta filler de duración** | Si la duración estimada queda por debajo del 95% del objetivo, se añaden ítems de relleno de forma determinista hasta alcanzar la banda. |
| **Auto-extend / auto-trim** | Siguen disponibles cuando la duración lo requiere; usan LLM pero solo en esos casos (y se contabilizan en `llmCallCount`). |

Tras la generación principal, el flujo hace: validación de excerpts → limpieza determinista → (opcional) extend/trim → delta filler → (si `USE_LLM_REPAIRS`) reparación de rúbrica/promptB e ítems; si no, solo validación + degradación determinista.

---

## 4) Cómo probar la calidad

- **Ordenamiento / relación:** Abrir una evaluación generada que incluya ítems de ordenar y de relacionar. Comprobar que se muestran listas para ordenar y dos columnas para emparejar (sin ítems vacíos o sin texto).
- **Excerpts coherentes:** En ítems de análisis de fuente, el fragmento debe ser 1–3 párrafos del material, sin portada ni abstract que enuncien la respuesta.
- **Cobertura de promptB:** Si se pidió Versión B, en el spec cada ítem debe tener `versionedContent.promptB`; en la UI de detalle se puede revisar la variante B.
- **Banda de duración:** En el spec, `meta.duration.minutes` debe estar en el rango 95–105% de `targetDurationMinutes` cuando se haya dado objetivo de duración (salvo que extend/trim no lo logren y se emita warning).
- **Rúbricas:** En ítems abiertos, los niveles de rúbrica deben referirse al contenido concreto del ítem y a la acción (analizar, justificar, etc.), no a frases genéricas reutilizables.

Checklist rápido:

1. Generar evaluación con duración objetivo y materiales para source_analysis.
2. Revisar `debug.llmCallCount` en la respuesta: en flujo normal debería ser 1 (o 2–4 si hubo extend/trim o narrativas adicionales).
3. Abrir la evaluación en la app: ordenar, relacionar, opción múltiple y análisis de fuente se renderizan bien.
4. Si se pidió B: comprobar que existe contenido B y que los ítems tienen promptB.

---

## 5) Reducción esperada de uso de cómputo

- **Antes:** Hasta 1 (main) + 3 (extend) + 1 (excerpt repair) + 1 (trim) + 1 (rubric/promptB) + 1 (item validity) + 1–2 (narrativas) = **hasta ~9–10 llamadas** por request en el peor caso.
- **Ahora (USE_LLM_REPAIRS=false):** 1 (main) + 0–3 (extend solo si duración baja) + 0–1 (trim solo si duración alta) + 0–2 (narrativas solo si faltan) = **típicamente 1, máximo ~6** en casos extremos.

Con el prompt consolidado (“quality by construction”), la mayoría de requests debería resolver con **una sola llamada** y sin activar extend/trim ni reparaciones, reduciendo tiempo por request y probabilidad de WORKER_LIMIT.

---

## 6) Archivos relevantes

- **Prompt:** `supabase/functions/modify-evaluation-v2/index.ts` — `buildV2SystemPrompt`, `buildV2UserPrompt` (incl. sección “VALIDEZ POR CONSTRUCCIÓN” y duración 95–105%).
- **Flag:** Misma función, constante `USE_LLM_REPAIRS` y condicionales que omiten `runExcerptRepair`, `runRubricAndPromptBRepair`, `runItemValidityRepair` cuando es `false`.
- **Métricas:** Objeto `metrics.llmCallCount` en el handler; se expone en `response.debug.llmCallCount` y `response.debug.timings` (stage timings vía `timer.summary()`).
- **Validación/degradación:** `itemValidity.ts`, `excerptValidation.ts`, `excerptCleaning.ts`, `durationMath.ts` (delta filler).
