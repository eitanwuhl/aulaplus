# 34) Fixes deterministas: MC, referencias a fragmento y compatibilidad de renderer

Fecha: 2026-03-04  
Ámbito: `supabase/functions/modify-evaluation-v2`, `src/services/evaluations/v2Normalizer.ts`

## Objetivo

Corregir problemas de calidad/renderizado sin agregar llamadas LLM, manteniendo estabilidad de IDs y evitando reintroducir `WORKER_LIMIT`.

## Cambios implementados

### 1) `multiple_choice`: completado determinista de opciones

Se reforzó `fillMissingItemDataDeterministically(...)` para que en ítems `multiple_choice`:

- Detecte opciones inválidas:
  - faltantes
  - menos de 3 con texto
  - placeholders genéricos (`Opción A/B/C/D`, `Option A/B/C/D`)
- Genere opciones coherentes de forma determinista desde keywords/tema.
- Marque una opción correcta (`isCorrect: true`) cuando no exista ninguna marcada.
- Mantenga estable el `item.id` y genere sub-IDs estables para opciones (`<itemId>-opt-N`).

Warning agregado:

- `MC_OPTIONS_FILLED` (severity `info`)

### 2) “Fragment referenced but missing”

Se agregó detección determinista de referencias en prompt:

- `según el fragmento...`
- `texto proporcionado`
- `fuente anterior`, etc.

Si el ítem no tiene fuente y no hay fuente previa utilizable en la misma sección:

- En `source_analysis`: se adjunta excerpt determinista (selección limpia existente o fallback conservador).
- En otros tipos: se reescribe el prompt para remover la dependencia a “fragmento anterior”.

Warning agregado:

- `PROMPT_FRAGMENT_REFERENCE_FIXED` (severity `info`)

### 3) Normalización de shape para renderer (ordering/matching/table)

Sin llamadas LLM, se agregó normalización defensiva de aliases legacy:

En backend (`fillMissingItemDataDeterministically`):

- `orderingItems` / `sequence` -> `itemsToOrder`
- `leftItems` / `rightItems` -> `leftColumn` / `rightColumn`
- `tableData` / `headers+rows` -> `table.columns + table.rows`

En frontend (`v2Normalizer`):

- `ordering`: soporta `itemsToOrder`, `orderingItems`, `sequence`, `orderedItems`
- `matching`: soporta `leftColumn`, `leftItems`, `left`, `columnLeft` y equivalentes right
- `table_completion`: soporta `table.columns|headers`, `tableData`, `headers/columns + rows`
- Normalización de texto robusta para valores objeto (`{ text }`, `{ header }`)

## Tests añadidos

### Deno (Edge Function)

Archivo: `supabase/functions/modify-evaluation-v2/__tests__/deterministicItemFill.test.ts`

- Extensión de test existente para cubrir:
  - autocompletado MC + `isCorrect`
  - fix de referencia a fragmento
  - warnings `MC_OPTIONS_FILLED` y `PROMPT_FRAGMENT_REFERENCE_FIXED`
- Nuevo test de aliases legacy (ordering/matching/table).

### Frontend (manual verification)

Archivo: `src/services/evaluations/__tests__/v2RendererShapeNormalization.test.ts`

- Pruebas manuales para normalización de shapes legacy hacia estructura renderizable.
- Ejecutable desde consola del navegador:
  - `import('@/services/evaluations/__tests__/v2RendererShapeNormalization.test').then(m => m.runAllTests())`

## Pasos de validación manual

1. Generar evaluación con al menos un ítem MC y un ítem que mencione “fragmento anterior” sin `source`.
2. Confirmar en respuesta:
   - MC con `>=3` opciones y una `isCorrect: true`.
   - Prompt ya no bloqueado por referencia a fragmento faltante (o `source` adjunta en `source_analysis`).
3. Verificar warnings:
   - `MC_OPTIONS_FILLED`
   - `PROMPT_FRAGMENT_REFERENCE_FIXED`
4. Abrir vista V2 y comprobar que:
   - `ordering` siempre muestra lista
   - `matching` siempre muestra dos columnas
   - `table_completion` no cae en “sin datos” cuando hay estructura legacy equivalente

## Impacto en performance

- No se agregaron nuevas llamadas OpenAI.
- Todo el post-procesamiento nuevo es determinista y lineal sobre items/materiales ya cargados.
- Se mantiene el objetivo de estabilidad frente a `WORKER_LIMIT`.

