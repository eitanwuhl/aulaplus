# Fill determinista de datos de ítems complejos (sin llamadas LLM extra)

**Objetivo:** mantener tipos complejos (`source_analysis`, `table_completion`, `matching`, `ordering`) siempre renderizables y coherentes, sin reintroducir WORKER_LIMIT.

---

## 1) Qué se completa determinísticamente

Implementado en `modify-evaluation-v2` como post-procesador server-side:

- **`source_analysis`**
  - Si falta `item.source.content` o está vacío:
    - se intenta seleccionar excerpt limpio/coherente desde materiales (`cleanAndSelectExcerpt`),
    - si no hay candidato usable, se construye un pasaje fallback conservador.
  - Se preserva `item.id`.

- **`table_completion`**
  - Si falta estructura de tabla:
    - se crea `item.table` con columnas y filas mínimas coherentes (2–3 columnas, 3–5 filas),
    - orientado por términos de contexto/tema.
  - Se preserva `item.id`.

- **`matching`**
  - Si faltan `leftColumn`/`rightColumn` (o tienen <2 elementos):
    - se generan pares mínimos deterministas y coherentes desde keywords de contexto.
  - Se preserva `item.id`.

- **`ordering`**
  - Si falta `itemsToOrder` (o <3 elementos):
    - se genera una secuencia cronológica/plausible mínima (etapa inicial → desarrollo → consolidación → impacto).
  - Se preserva `item.id`.

---

## 2) Warnings emitidos

Cuando se aplica fill, se agregan warnings `info` por tipo:

- `SOURCE_FILLED`
- `ITEM_DATA_FILLED_TABLE`
- `MATCHING_FILLED`
- `ORDERING_FILLED`

Estos warnings permiten trazabilidad sin romper el contrato de salida.

---

## 3) Diseño y restricciones de implementación

- Sin dependencias nuevas pesadas.
- Sin nuevas llamadas OpenAI.
- Complejidad lineal sobre ítems/materiales relevantes (en práctica O(n)).
- IDs de ítems se mantienen estables.
- Sub-IDs deterministas y estables para columnas/listas cuando se requieren (`l-<itemId>-n`, `r-<itemId>-n`, `o-<itemId>-n`).

---

## 4) Tests agregados

Archivo:
- `supabase/functions/modify-evaluation-v2/__tests__/deterministicItemFill.test.ts`

Casos:

1. **Unit test de completado**
   - Entrada: spec con `source/table/matching/ordering` incompletos.
   - Verifica que post-procesador complete estructura renderizable en cada tipo.
   - Verifica warnings por tipo y estabilidad de IDs.

2. **Smoke “max difficulty” (contract shape)**
   - Entrada: spec con tipos complejos sin datos.
   - Verifica que ninguno de esos tipos quede sin shape mínima UI-required después del fill.

> Nota local: en este entorno no se pudo ejecutar `deno test` porque `deno` no está instalado en PATH, pero los archivos pasan linter del workspace.

---

## 5) Cómo probar manualmente (smoke funcional)

1. Generar evaluación V2 con combinaciones que incluyan:
   - `source_analysis`,
   - `table_completion`,
   - `matching`,
   - `ordering`.
2. Abrir detalle/render V2 y comprobar:
   - source muestra texto (no vacío),
   - tabla renderiza columnas/filas (no “tabla sin datos”),
   - matching muestra ambas columnas,
   - ordering muestra secuencia de elementos.
3. Revisar `warnings` de respuesta para códigos de fill determinista.
4. Confirmar que no se agregaron pasos LLM extra en flujo normal (`debug.llmCallCount` no aumenta por estos fills).

---

## 6) Por qué esto evita WORKER_LIMIT

Antes, los faltantes de shape podían empujar a reparaciones adicionales o degradaciones tardías.  
Ahora, los faltantes críticos de render se corrigen con lógica determinista local, sin costo de modelo.

Resultado:
- más robustez de salida,
- menos probabilidad de loops de reparación,
- menor riesgo de límites de cómputo por request.
