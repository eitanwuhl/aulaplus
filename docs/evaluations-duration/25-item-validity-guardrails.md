# Guardrails de validez de ítems (ordenamiento, relación, opciones, fragmentos)

**Objetivo:** Asegurar que los ítems generados sean pedagógicamente válidos y totalmente renderizables, aplicando validación determinista por tipo, una pasada de reparación con LLM y, si falla, degradación determinista sin LLM. Los IDs se mantienen estables.

---

## 1) Los tres problemas observados y por qué importan

**A) Fragmento de source_analysis “regala” la respuesta**  
Si el fragmento en `source.content` es un resumen o abstract que ya enuncia las conclusiones (p. ej. “en este trabajo se analiza…”, “las ideas principales son…”), el estudiante no tiene que analizar evidencia; la consigna pierde validez. El fragmento debe aportar **evidencia** sin enunciar explícitamente la respuesta esperada.

**B) Ítems de ordenamiento sin lista**  
Los ítems de tipo `ordering` deben incluir una lista de elementos (eventos, pasos, etc.) que el estudiante ordene. Si falta `itemsToOrder` o está vacío, la UI no puede mostrar nada que ordenar y el ítem no es renderizable.

**C) Ítems de relación sin columnas**  
Los ítems de tipo `matching` deben incluir columnas izquierda y derecha (`leftColumn`, `rightColumn`) con texto visible. Sin ellas, la UI no puede mostrar las listas a relacionar.

---

## 2) Reglas de validación por tipo

Se aplican en servidor (módulo `itemValidity.ts`) sobre el spec final:

| Tipo              | Requisito                                                                 | Inválido si |
|-------------------|---------------------------------------------------------------------------|-------------|
| **ordering**      | `itemsToOrder` no vacío, con al menos 2 elementos con texto de visualización | Array vacío, &lt; 2 elementos, o textos vacíos |
| **matching**      | `leftColumn` y `rightColumn` no vacíos, con al menos 2 elementos cada uno   | Alguna columna vacía o con &lt; 2 elementos con texto |
| **multiple_choice** | `options` con al menos 3 opciones con `text` no vacío                    | &lt; 3 opciones con texto |
| **source_analysis** | `source.content` con al menos 200 caracteres y **no** con estilo abstract/answer-leaking | Excerpt corto o detectado como “answer-leaking” |

Formatos aceptados para listas: array de strings o array de `{ id, text }`; se considera “con texto” si hay contenido después de normalizar.

---

## 3) Detección de fragmentos “answer-leaking”

Se usan heurísticas sobre el texto del excerpt (español). Se considera **answer-leaking** si aparece al menos una de las siguientes ideas:

- “en este trabajo/artículo/texto se analiza…”
- “se examinan las características/ideas…”
- “se presentan/describen/resumen las ideas principales”
- “las ideas principales son/incluyen…”
- “incluye/consiste en el análisis/estudio de…”
- “en este trabajo se demuestra/concluye/muestra…”
- “resumen/abstract:”
- “el objetivo de este trabajo es…”
- “en conclusión, se observa/concluye…”
- “se analizan las consecuencias…”
- Frases muy específicas que enuncian tesis (p. ej. “las políticas económicas del Batllismo fueron…”)

**Ejemplos:**

- **Leaking:** *“En este trabajo se analiza el impacto de las políticas del Batllismo. Se examinan las características del Estado. Las ideas principales son la reforma laboral y la educación.”*
- **No leaking:** *“El Batllismo impulsó reformas a comienzos del siglo XX. Los trabajadores obtuvieron derechos. La educación pública se expandió.”* (evidencia sin enunciar la conclusión).

Si se detecta answer-leaking, el ítem se marca como inválido y se intenta reemplazo en la reparación (o degradación si la reparación falla).

---

## 4) Flujo de reparación y degradación

1. **Validación**  
   Tras rubric/promptB repair se ejecuta `validateSpecItems(spec)`. Si hay ítems inválidos:
   - Se emite `SOURCE_EXCERPT_ANSWER_LEAK` (warning) cuando alguno es source_analysis por answer-leaking.
   - Se guardan conteos por tipo para debug (`invalidItemCountsByType`).

2. **Una pasada de reparación (LLM)**  
   Si hay inválidos se llama una sola vez a `runItemValidityRepair`:
   - Entrada: spec actual, lista de ítems inválidos, materiales, contexto de grupo, `requestedVersions`.
   - Instrucciones: devolver el JSON completo; no cambiar ningún id; completar `itemsToOrder`/`leftColumn`/`rightColumn`/`options` con contenido coherente; reemplazar excerpts answer-leaking por un pasaje de 1–3 párrafos que aporte evidencia sin dar la respuesta.
   - Si la respuesta parsea y pasa validación y **vuelve a pasar** `validateSpecItems`, se usa ese spec y se emite `ITEM_SCHEMA_REPAIRED` (info).

3. **Degradación si la reparación falla o deja inválidos**  
   Si el repair falla (parse, validación) o tras el repair sigue habiendo ítems inválidos:
   - **Degradación determinista** (sin LLM):
     - `ordering` → `short_answer` (consigna tipo “Explique el orden o la secuencia…”); se elimina `itemsToOrder`.
     - `matching` → `paragraph` (consigna tipo “Relacione los conceptos y explique en sus propias palabras”); se eliminan `leftColumn` y `rightColumn`.
     - `multiple_choice` / `source_analysis` inválidos → `short_answer`; se eliminan `options` o `source` según corresponda.
   - Se mantienen los **ids** de los ítems; solo se cambia tipo, consigna si hace falta y se añade rúbrica si es ítem abierto.
   - Se emite **un** aviso `ITEM_SCHEMA_REPAIR_FAILED` (warning) indicando que se aplicó degradación.

4. **Duración tras degradación**  
   Tras degradar se recalcula `estimateDurationFromSpec(spec)`. Si hay objetivo de duración y la estimación queda por debajo del 95% del objetivo, se aplica de nuevo el **delta filler** para mantener la duración ≥ low.

---

## 5) Códigos de aviso y debug

- **ITEM_SCHEMA_REPAIRED** (info): La reparación con LLM corrigió ítems inválidos.
- **ITEM_SCHEMA_REPAIR_FAILED** (warning): La reparación falló o fue insuficiente y se aplicó degradación (conversión a short_answer/paragraph).
- **SOURCE_EXCERPT_ANSWER_LEAK** (warning): Se detectó al menos un fragmento con estilo abstract/answer-leaking; se intenta reemplazo o degradación.

En la respuesta, en `debug.invalidItemCountsByType` (solo cuando hubo inválidos) se incluyen los conteos por tipo de ítem inválido antes de reparar/degradar.

---

## 6) Cómo probar a mano

1. **Ordenamiento con lista visible**  
   Generar una evaluación que incluya ítems de ordenamiento. En la UI, comprobar que cada ítem de ordenamiento muestre la lista de eventos/elementos a ordenar (no solo la consigna).

2. **Relación con columnas A/B**  
   Generar ítems de relación de conceptos. En la UI, comprobar que cada ítem muestre columnas izquierda y derecha con ítems a relacionar.

3. **Fragmentos analizables (source_analysis)**  
   Revisar ítems de análisis de fuente: el fragmento debe ser un pasaje de 1–3 párrafos que aporte evidencia; no debe ser un abstract ni un resumen que diga explícitamente “en este trabajo se analiza…”, “las ideas principales son…”, etc. Si se reemplazó por answer-leak, puede aparecer el aviso `SOURCE_EXCERPT_ANSWER_LEAK`.

4. **Opciones múltiples**  
   Cada ítem de opción múltiple debe tener al menos 3 opciones con texto visible.

---

## 7) Tests unitarios (deterministas)

- **itemValidity.test.ts**
  - ordering: sin elementos o con uno → inválido; con al menos 2 elementos con texto → válido.
  - matching: sin columnas o solo una → inválido; ambas columnas con ≥ 2 ítems con texto → válido.
  - multiple_choice: &lt; 3 opciones con texto → inválido; ≥ 3 → válido.
  - source_analysis: excerpt con frases tipo abstract → `isAnswerLeakingExcerpt` true; excerpt solo evidencia → false.
  - `validateSpecItems`: devuelve lista de inválidos y conteos por tipo.
  - `getDegradationType`: ordering → short_answer, matching → paragraph.

Ejecución (con Deno):

```bash
deno test __tests__/itemValidity.test.ts --allow-read
```
