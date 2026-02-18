# Phase 3 — Academic PDF: campo Fecha y eliminación de etiquetas de tipo (material alumno)

**Objetivo:** Corregir el espaciado del campo Fecha en el encabezado y dejar el PDF en modo “material para alumno”: solo puntos en la metadata, sin etiquetas de tipo de ítem; instrucciones mínimas solo para MC y V/F.

**Archivo modificado:** `src/components/evaluaciones/pdf/AcademicEvaluationDocument.tsx`

---

## 1. Causa de los dos problemas

### 1.1 Campo Fecha con hueco

- **Causa:** En la columna “Fecha” se usaba un bloque (`headerDateBlock`) de ancho fijo que incluía un `View` con borde inferior (`headerDateUnderline`, width 72) y luego el texto “____/____/____”. La columna seguía siendo `headerCol` con **flex: 1**, ocupando media fila. La combinación de contenedor ancho y bloque intermedio (subrayado) generaba un espacio visual grande entre la etiqueta “Fecha:” y el placeholder, o hacía que el placeholder no quedara pegado a la etiqueta.
- **Solución:** La columna de Fecha pasa a ser de ancho contenido (`headerColFecha` con `flex: 0`). Se elimina el `View` de subrayado intermedio. Se renderiza solo “Fecha:” + “____/____/____” en la misma fila, sin flex que estire ni espaciador, de modo que el placeholder quede junto a la etiqueta y alineado con la fila de Asignatura/Grupo.

### 1.2 Etiquetas de tipo en la metadata

- **Causa:** La línea bajo cada enunciado mostraba `{item.typeLabel} · {item.points} pts` (p. ej. “Respuesta corta · 20 pts”, “Análisis de fuente · 30 pts”). Eso es útil para el docente pero no debe aparecer en la hoja del alumno.
- **Solución:** Una única regla para todos los ítems: en esa línea se muestra **solo “N pts”** (alineado a la derecha). No se usa `item.typeLabel` ni ningún helper de tipo en el PDF; la metadata es solo puntos.

---

## 2. Cambios realizados

### 2.1 Fecha (sin hueco, sin flex)

- Eliminados los estilos `headerDateBlock` y `headerDateUnderline`.
- Nuevo estilo **headerColFecha**: `flex: 0`, `flexDirection: 'row'`, `alignItems: 'center'` (sin flex que estire la columna).
- En el encabezado, la celda de Fecha usa `headerColFecha` y contiene solo:
  - `Text` “Fecha:” (con el mismo `headerLabel`, que ya tiene `marginRight: 6`).
  - `Text` “____/____/____” (fontSize 10).
- Así “Fecha:” y “____/____/____” quedan uno al lado del otro, con alineación coherente con la fila de Asignatura/Grupo y sin depender del ancho disponible.

### 2.2 Metadata: solo puntos (material alumno)

- En la línea de metadata bajo el enunciado (misma para todos los ítems) se muestra únicamente:
  - `{item.points} {item.points === 1 ? 'pt' : 'pts'}`,
  - con el mismo estilo `itemMetaText` y alineación a la derecha (`itemMetaSpacer` + texto).
- Se eliminó cualquier uso de `item.typeLabel` en el documento. No se usa ningún helper de “type label” en este PDF.

### 2.3 Instrucciones mínimas (solo MC y V/F)

- Nueva función **getItemInstruction(type)** que devuelve:
  - `'Marca una opción.'` para `multiple_choice`,
  - `'Marca V o F.'` para `true_false`,
  - `'Marca V o F y justifica.'` para `true_false_justify`,
  - `null` para el resto.
- Se añadió el estilo **itemInstruction**: fuente 8, color #666, marginLeft 24, marginBottom 2.
- En el cuerpo del ítem, después de la fila de metadata (solo puntos) y antes de las opciones equivalentes, se renderiza una línea de instrucción solo cuando `getItemInstruction(item.type)` no es null. No se añaden más etiquetas de tipo.

---

## 3. Checklist de pruebas manuales (y qué revisar en capturas)

- [ ] **Fecha**
  - Generar un PDF y abrir la primera página.
  - Comprobar que la fila “Fecha:” muestra “Fecha:” seguido de “____/____/____” sin hueco grande entre ellos.
  - Comprobar que la fila queda alineada con “Docente:/Asignatura:” y “Grupo:” (misma altura de línea, sin estiramiento raro).

- [ ] **Metadata sin tipo**
  - Revisar varios ítems (respuesta corta, desarrollo, análisis de fuente, opción múltiple, V/F, etc.).
  - En todos debe aparecer **solo** “N pt” o “N pts” a la derecha bajo el enunciado.
  - No debe aparecer en ningún ítem texto como “Respuesta corta”, “Análisis de fuente”, “Desarrollo”, “Opción múltiple”, etc.

- [ ] **Instrucciones mínimas**
  - Ítem de opción múltiple: debe verse “Marca una opción.” bajo la línea de puntos (misma fuente pequeña).
  - Ítem V/F (sin justificación): “Marca V o F.”
  - Ítem V/F con justificación: “Marca V o F y justifica.”
  - Ítems de desarrollo, respuesta corta, etc.: no debe aparecer ninguna de estas frases ni otras etiquetas de tipo.

- [ ] **Capturas sugeridas**
  - Captura del encabezado (Docente, Asignatura, Grupo, Fecha, Alumno/a) para verificar Fecha.
  - Captura de 2–3 ítems de tipos distintos mostrando solo “N pts” y, en MC/V/F, la instrucción corta.
