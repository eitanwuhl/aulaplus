# Phase 3: Human Inline Response Strategies + Editable Map Points (V2)

## Resumen

Dos mejoras **solo en V2** (rama `mejorar-evaluaciones`):

- **Parte A**: Frase de opciones equivalentes más natural en español (y opcional metacognitionText) integrada en el enunciado.
- **Parte B**: En el "Mapa de la evaluación" el docente puede editar puntos por sección y total; los cambios se redistribuyen en el spec y se persisten al guardar.

---

## Parte A — Estrategias de respuesta en línea (más humanas)

### Objetivo

Que la instrucción suene a examen real (español Uruguay/neutro): una frase tipo "Puedes responder con un texto breve o con un esquema claro." dentro del enunciado, y si existe `metacognitionText`, una segunda frase corta (ej.: "Elegí el formato que mejor te ayude a mostrar lo que aprendiste.").

### Cambios realizados

1. **`src/services/evaluations/responseOptionsInline.ts`**
   - **`formatResponseOptionsAsInlineSentence(options)`**
     - 1 opción: `"Puedes responder <texto>."`
     - 2 opciones: `"Puedes responder <a> o <b>."`
     - 3 opciones: `"Puedes responder <a>, <b> o <c>."`
     - Más de 3: se usan las primeras 3 y se añade `" (u otra forma equivalente acordada con el docente)."`
   - **`getDisplayPromptWithInlineOptions(basePrompt, responseOptions)`**
     - Acepta `ResponseOptionsWithMetacognition` (incluye `metacognitionText` opcional).
     - Concatena: enunciado + frase de opciones; si hay `metacognitionText`, añade esa frase al final (con punto si falta).
   - No se usan títulos tipo "Opciones de respuesta equivalentes" ni listas con viñetas en esta capa.

2. **UI V2 y PDF**
   - **EvalItem** y **AcademicEvaluationDocument** ya usan `getDisplayPromptWithInlineOptions`; al soportar ahora `metacognitionText` en el helper, la consigna mostrada incluye automáticamente la segunda frase cuando exista en el ítem.

### Dónde se aplica

- Cualquier ítem con `responseOptions.enabled` y `options` en la UI V2 y en el PDF académico.
- Los campos del spec (`equivalentResponseOptions`) no se eliminan ni se cambian de estructura.

---

## Parte B — Puntos editables en el Mapa de la evaluación

### Objetivo

En "Mapa de la evaluación" (MapTable), el docente puede:
- Editar los puntos de cada sección (por fila).
- Editar el total (fila TOTAL), redistribuyendo entre secciones y ítems.

Las ediciones actualizan el spec V2 de forma inmutable; el renderizado y el PDF reflejan los nuevos puntos y lo guardado es el spec editado.

### Cambios realizados

1. **Helpers de redistribución** — `src/services/evaluations/pointsRedistribution.ts`
   - **`redistributeSectionPoints(section, newSectionPoints)`**  
     Redistribuye `newSectionPoints` entre los ítems de la sección de forma proporcional a los puntos actuales. Cada ítem tiene al menos 1 punto. Redondeo determinista (largest-remainder) para que la suma coincida con el total.
   - **`applySectionPointsEdit(spec, sectionId, newSectionPoints)`**  
     Aplica el cambio de una sección al spec completo y actualiza `meta.totalPoints`. Devuelve `{ spec, warning? }`; el warning se usa si el valor pedido es menor que el mínimo viable (número de ítems).
   - **`redistributeTotalPoints(spec, newTotalPoints)`**  
     Reparte el nuevo total entre secciones de forma proporcional (respetando mínimo por sección = número de ítems), luego redistribuye dentro de cada sección con `redistributeSectionPoints`. Devuelve `{ spec, warning? }` cuando el total pedido es menor que el mínimo global.

2. **MapTable** — `src/components/evaluaciones/v2/MapTable.tsx`
   - Nuevas props: `evaluationSpec`, `editable`, `onPointsChange`, `onWarning`.
   - Si `editable && evaluationSpec && onPointsChange`: se muestran inputs numéricos para puntos por sección y para el total.
   - Al salir del campo (onBlur) se aplica la redistribución correspondiente y se llama `onPointsChange(updatedSpec)`; si hay warning (mínimos), `onWarning(message)`.
   - Texto de ayuda: "Al cambiar los puntos, se redistribuyen automáticamente entre las preguntas de cada sección."
   - Se usa `key` en los inputs para que al actualizar el spec y re-normalizar, los valores mostrados se refresquen.

3. **EvaluationRendererV2** — `src/components/evaluaciones/v2/EvaluationRendererV2.tsx`
   - Nuevas props opcionales: `onV2ResponseChange`, `onPointsWarning`.
   - Si `onV2ResponseChange` está definido, se pasa a MapTable `evaluationSpec`, `editable=true`, `onPointsChange` (que actualiza el spec en el response) y `onWarning=onPointsWarning`.

4. **EvaluacionesGrupo** — `src/pages/EvaluacionesGrupo.tsx`
   - Se pasa `onV2ResponseChange={setV2RawResponse}` y `onPointsWarning` (toast con el mensaje) a `EvaluationRendererV2`.
   - Al guardar la evaluación, se persiste `v2RawResponse.evaluationSpec` en `evaluation_spec`; por tanto el spec con puntos editados es el que se guarda.

### Reglas de redistribución (con ejemplos)

- **Mínimo por ítem**: 1 punto.
- **Edición de sección**:  
  - Se pide nuevo total de sección (ej. 12).  
  - Si la sección tiene 4 ítems con puntos 3, 4, 3, 2 (total 12), las proporciones se mantienen; si se pide 8, se reparten 8 de forma proporcional (largest-remainder) y cada ítem ≥ 1.  
  - Si se pide menos que el número de ítems (ej. 2 para 4 ítems), se usa el mínimo (4) y se muestra warning.
- **Edición de total**:  
  - Se pide nuevo total global (ej. 40).  
  - Se calcula el mínimo global = suma de (cantidad de ítems por sección). Si 40 es menor que ese mínimo, se usa el mínimo y se muestra warning.  
  - Se reparte el total entre secciones de forma proporcional a los totales actuales de cada sección (respetando el mínimo por sección), luego en cada sección se aplica `redistributeSectionPoints` con ese total de sección.
- **Redondeo**: Largest-remainder para que las sumas den exactamente el total pedido (por sección y global).

### Casos borde manejados

- Total o total de sección menor que el mínimo viable → se ajusta al mínimo y se devuelve warning (toast en grupo).
- Sección sin ítems o spec sin secciones → no se modifica el spec o se devuelve sin cambios.
- Suma actual de puntos 0 → en redistribución por total se devuelve el spec sin cambios; por sección se reparte en partes iguales (respeta mínimo 1 por ítem).

### Persistencia

- En **EvaluacionesGrupo**, al guardar la evaluación se envía `evaluation_spec: v2RawResponse.evaluationSpec`, que ya incluye las ediciones de puntos.
- Al reabrir la evaluación (página de detalle), se carga `evaluacion_generada.evaluation_spec` y se muestra en MapTable y en ítems con los puntos editados (en la página de detalle el mapa es solo lectura; la edición se hace en la página de grupo antes de guardar).

---

## Checklist de pruebas manuales

### Parte A — Estrategias en línea

- [ ] Generar evaluación V2 con opciones equivalentes (y, si aplica, con `metacognitionText`).
- [ ] Comprobar que el enunciado incluye una frase natural del tipo "Puedes responder … o …" (o "…, … o …" con 3 opciones) sin bloque aparte de opciones.
- [ ] Si hay `metacognitionText`, comprobar que aparece una segunda frase corta después (ej. "Elegí el formato que mejor te ayude…").
- [ ] Exportar PDF académico y verificar que el mismo texto aparece en el enunciado y que no hay bloque separado de opciones.

### Parte B — Puntos editables

- [ ] En EvaluacionesGrupo, con una evaluación V2 generada, comprobar que en "Mapa de la evaluación" aparecen inputs numéricos para puntos por sección y para el total.
- [ ] Cambiar los puntos de una sección (blur): verificar que los ítems de esa sección actualizan sus puntos y que la suma de la sección coincide; que el total global se actualiza.
- [ ] Cambiar el total (blur): verificar que las secciones y ítems se actualizan de forma proporcional y que el total mostrado es el pedido.
- [ ] Pedir un total (o total de sección) menor que el mínimo posible: verificar que aparece toast de aviso y que se aplica el mínimo.
- [ ] Exportar PDF académico: verificar que los puntos mostrados en ítems y totales son los editados.
- [ ] Guardar la evaluación y abrir de nuevo la página de detalle: verificar que los puntos en el mapa y en los ítems son los editados (solo lectura en detalle).

---

## Archivos tocados

| Archivo | Cambio |
|--------|--------|
| `src/services/evaluations/responseOptionsInline.ts` | Frase más natural (2/3/>3 opciones), sufijo "u otra forma equivalente acordada con el docente", soporte `metacognitionText` en `getDisplayPromptWithInlineOptions`. |
| `src/services/evaluations/pointsRedistribution.ts` | Nuevo: `redistributeSectionPoints`, `applySectionPointsEdit`, `redistributeTotalPoints` (inmutable, mínimos, warnings). |
| `src/components/evaluaciones/v2/MapTable.tsx` | Props `evaluationSpec`, `editable`, `onPointsChange`, `onWarning`; inputs por sección y total; texto de ayuda; commit on blur. |
| `src/components/evaluaciones/v2/EvaluationRendererV2.tsx` | Props `onV2ResponseChange`, `onPointsWarning`; paso a MapTable para modo editable. |
| `src/pages/EvaluacionesGrupo.tsx` | Paso de `onV2ResponseChange` y `onPointsWarning` (toast) a `EvaluationRendererV2`. |

EvalItem y AcademicEvaluationDocument no requieren cambios de interfaz; ya usan `getDisplayPromptWithInlineOptions`, que ahora incluye `metacognitionText`.
