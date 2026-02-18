# Phase 3 — Academic PDF: refactor estructural (grid del encabezado + puntos en línea)

**Objetivo:** Corregir el layout del PDF académico con una rejilla fija en el encabezado y los puntos en la misma línea que el enunciado (estilo examen). Solo cambios en `AcademicEvaluationDocument.tsx`.

---

## 1. Por qué space-between / flex provocaban desalineación en el encabezado

- **Antes:** Se usaban columnas con `flex: 1` (o una columna “Fecha” con `flex: 0`) y, en algunos casos, espaciadores o contenido que no tenía ancho fijo. Con `flex: 1`, cada columna ocupaba la mitad del espacio disponible, pero el **contenido** dentro (label + valor) quedaba al inicio de esa mitad. Si la segunda columna tenía poco contenido (p. ej. “Fecha: ____/____/____”), el texto quedaba pegado al borde izquierdo de esa mitad, es decir, desplazado hacia la derecha respecto a “Docente”/“Grupo”, y visualmente desalineado. Cualquier uso de `justifyContent: 'space-between'` o de un espaciador con `flexGrow` acentuaba ese efecto y hacía que “Fecha” se alejara del label o que las columnas no coincidieran entre filas.
- **Solución:** Encabezado con **rejilla de dos columnas de ancho fijo**: cada celda tiene **width: '50%'** (`headerColHalf`). No se usa `flex: 1`, `flexGrow` ni `space-between`. Así, la columna izquierda es siempre el 50% y la derecha el otro 50%, y “Docente”/“Grupo” alinean con “Asignatura”/“Fecha” de forma predecible. La fila “Alumno/a” usa una sola columna de ancho completo (`headerColFull`).

---

## 2. Por qué los puntos en línea mejoran el realismo académico

- **Antes:** El enunciado iba en una fila y los puntos en **otra fila** debajo (“N pts” alineado a la derecha). Eso separaba mucho la información y no se parece a un examen impreso típico, donde el valor del ítem suele ir en la misma línea que la pregunta (p. ej. “1. ¿Qué es…? (10 pts)”).
- **Después:** Una **sola fila** por ítem: a la izquierda el número y el enunciado (contenedor flexible que ocupa el espacio restante) y a la **derecha** un bloque de ancho fijo (48pt) con el texto “(N pt)” o “(N pts)”. Así los puntos quedan alineados a la derecha, pegados visualmente al enunciado, y se elimina la fila de metadata suelta. No se muestran etiquetas de tipo; solo puntos.

---

## 3. Estructura antes / después

### Encabezado

**Antes**
- Filas con columnas `flex: 1` o mixtas (una con `flex: 0` para Fecha).
- Contenido variable por columna → “Fecha” y otros campos se desalineaban.
- Posible uso de espaciadores o flex que estiraba.

**Después**
- **Fila 1:** Columna izquierda 50%: “Docente: {name}”. Columna derecha 50%: “Asignatura: {subject}”.
- **Fila 2:** Columna izquierda 50%: “Grupo: {group}”. Columna derecha 50%: “Fecha: ____/____/____”.
- **Fila 3:** Ancho completo: “Alumno/a:” + subrayado de ancho fijo (280pt).
- Estilos: `headerColHalf` (width: '50%'), `headerColFull` (width: '100%'). Sin `justifyContent: 'space-between'` ni espaciadores con flex.

### Cuerpo del ítem

**Antes**
- Fila 1: número + enunciado.
- Fila 2: metadata (solo puntos) alineada a la derecha.
- Luego instrucción mínima (si aplica) y opciones equivalentes.

**Después**
- **Una sola fila de cabecera:** `itemHeader` con:
  - `itemNumber` (ancho fijo): “1.”
  - `itemPromptWrap` (flex: 1): enunciado.
  - `itemPointsCol` (width: 48): “(10 pts)” o “(1 pt)” con `itemPointsText`.
- Se elimina por completo la fila de metadata (`itemMetaRow` / `itemMetaSpacer` / `itemMetaText`).
- Se mantienen las instrucciones mínimas (MC, V/F) y las opciones equivalentes debajo; no se reintroducen etiquetas de tipo ni se toca la lógica de paginación.

---

## 4. Cambios realizados (resumen)

- **Header:** Rejilla con `headerColHalf` (50% por columna) en filas 1 y 2, y `headerColFull` en la fila de Alumno/a. “Fecha” en la segunda columna de la fila 2, mismo ancho que “Asignatura”. Subrayado de Alumno/a con ancho fijo 280pt.
- **Ítems:** Un único `itemHeader` con número, enunciado y columna de puntos (48pt). Eliminados `itemMetaRow`, `itemMetaSpacer` y `itemMetaText`. Formato de puntos: “(N pt)” / “(N pts)”.
- **Preservado:** Sin etiquetas de tipo, instrucciones mínimas solo para MC y V/F, misma lógica de paginación (wrap del header del ítem y del bloque de respuesta).
