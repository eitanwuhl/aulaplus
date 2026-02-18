# Phase 3 — Academic PDF: campo Fecha y paginación (evitar huecos en blanco)

**Objetivo:** Ajustar solo el layout del PDF académico: espaciado natural del campo Fecha y permitir que el área de respuesta (líneas pautadas) fluya a la siguiente página para evitar grandes huecos en blanco.

**Archivo modificado:** `src/components/evaluaciones/pdf/AcademicEvaluationDocument.tsx`

---

## 1. Comportamiento anterior del hueco en blanco

- Cada ítem se renderizaba dentro de un único bloque con **wrap={false}**, de modo que React-PDF no podía partir el ítem.
- Si al final de la página 1 no cabía el ítem completo (enunciado + metadata + área de respuesta), el motor movía **todo** el ítem a la página 2, dejando un hueco grande en la página 1.
- El enunciado nunca se partía a mitad de página (correcto), pero el coste era ese espacio vacío cuando el siguiente ítem era largo.

---

## 2. Nueva estrategia de partición

- **Bloque de cabecera del ítem (no separable):**  
  Se envuelve en un `View` con **wrap={false}**:
  - Número + enunciado
  - Línea de metadata (tipo · puntos)
  - Opciones equivalentes de respuesta (si existen)
  Así el enunciado y la instrucción nunca se parten a mitad de página.

- **Bloque de área de respuesta (separable solo en ítems abiertos):**  
  Se envuelve en un `View` con **wrap={answerCanFlow}**:
  - Para tipos **abiertos** (essay, paragraph, source_analysis, short_answer, true_false_justify): **wrap={true}**. Las líneas pautadas pueden continuar en la página siguiente si no caben.
  - Para el resto (opción múltiple, V/F sin justificación, matching, etc.): **wrap={false}**, para que el bloque corto quede junto al enunciado.

- **Sin “break cada N ítems”:**  
  No se reintroduce ninguna heurística de salto por número de ítems. La paginación sigue siendo la natural del documento.

- **Pie “Página X de Y”:**  
  Sin cambios; se sigue usando el callback `render` de React-PDF en el pie fijo.

---

## 3. Cambios realizados

### 3.1 Campo Fecha

- **Antes:** En la columna “Fecha” se usaba un subrayado con **flex: 1** (y minWidth 60), lo que generaba un hueco grande entre la etiqueta y el texto “____/____/____”.
- **Después:**  
  - Etiqueta “Fecha:” con el mismo estilo de columna.  
  - Bloque de fecha de **ancho fijo** (`headerDateBlock`: width 100): dentro, un subrayado de ancho fijo (`headerDateUnderline`: width 72) y a continuación el texto “____/____/____”.  
  Así el campo Fecha queda compacto y alineado, sin espacio excesivo. El campo “Alumno/a” mantiene su subrayado largo (flex: 1).

### 3.2 Estructura del ítem

- **itemBlock:** Se elimina `breakInside: 'avoid'`. Se añaden estilos `itemHeaderBlock` e `itemAnswerBlock` (solo márgenes, sin break).
- **Helper** `isOpenEndedItemType(type)`: devuelve true para essay, paragraph, source_analysis, short_answer, true_false_justify.
- Por cada ítem:
  - Contenedor exterior: `View` con `styles.itemBlock` (sin wrap a nivel de contenedor).
  - Primer hijo: `View wrap={false} style={itemHeaderBlock}` → número, enunciado, metadata, opciones equivalentes.
  - Segundo hijo: `View wrap={answerCanFlow} style={itemAnswerBlock}` → `AnswerSpacePDF` (líneas pautadas o casillas).  
  `answerCanFlow === isOpenEndedItemType(item.type)`.

---

## 4. Checklist de pruebas manuales

- [ ] **Campo Fecha:** Generar un PDF y comprobar que en el encabezado la fila “Fecha: ____/____/____” tiene espaciado natural, sin hueco grande entre “Fecha:” y el placeholder.

- [ ] **Caso: pregunta 2 al final de página 1 y líneas en página 2**  
  - Evaluación con al menos 2 ítems; el primero corto (p. ej. opción múltiple) y el segundo abierto (p. ej. desarrollo/ensayo con varias líneas).  
  - Ajustar si hace falta (más ítems o enunciados más largos) para que el **enunciado** del ítem 2 quepa al final de la página 1 pero las **líneas de respuesta** no quepan todas.  
  - Verificar:  
    - En la página 1 aparece el enunciado (y metadata) del ítem 2, y si acaso el inicio del bloque de líneas.  
    - El resto de las líneas del ítem 2 continúan al inicio de la página 2.  
    - No queda un hueco grande en blanco en la página 1 (no se mueve todo el ítem 2 a la página 2).

- [ ] **Pie de página:** Comprobar que en todas las páginas sigue viéndose “Página X de Y” correcto.

- [ ] **Ítems no abiertos:** Verificar que ítems de opción múltiple o V/F sin justificación no se parten (el bloque de casillas queda junto al enunciado en la misma página).
