# Phase 3 — Academic PDF Export Polish

**Objetivo:** Mejorar el aspecto del PDF académico (encabezado en dos columnas, pie “Página X de Y”, paginación natural, casillas V/F y líneas de respuesta más realistas). Sin cambios en generación, persistencia ni flujos de UI.

**Archivos modificados:** `src/components/evaluaciones/pdf/AcademicEvaluationDocument.tsx`

---

## 1. Descripción antes / después

### Antes
- **Encabezado:** Lista vertical de etiquetas (Docente, Materia, Grupo, Fecha, Estudiante) con valores o subrayados en una sola columna; opcional “Institución”.
- **Pie:** Texto fijo “Página _____” (sin número real).
- **Paginación:** Se forzaba un salto de página cada N ítems (4 en la primera página, 6 en las siguientes) con `<View break />`.
- **Opción múltiple / V-F:** Círculos (borderRadius) y etiquetas “Verdadero” / “Falso”.
- **Líneas pautadas:** Altura 14pt, border 0.5, espaciado 2pt entre líneas; bloques de ensayo con 16 líneas.

### Después
- **Encabezado:** Formulario académico en dos columnas:
  - Fila 1: `Docente: ________` (valor a la derecha) | `Asignatura: ________` (valor a la derecha)
  - Fila 2: `Grupo: ________` | `Fecha: ____/____/____`
  - Fila 3: `Alumno/a: ________________________________` (subrayado ancho a toda la fila)
  Minimal, alineado y apto para impresión.
- **Pie:** “Página {pageNumber} de {totalPages}” en todas las páginas, usando el callback `render` de `Text` de React-PDF (pie fijo).
- **Paginación:** Sin heurística “cada N ítems”. Se usa solo la paginación natural del documento; cada ítem mantiene `wrap={false}` para no partir una pregunta a mitad de página. Los bloques largos (ensayo) no se parten; si un ítem no cabe entero, pasa a la página siguiente.
- **Opción múltiple / V-F:** Casillas cuadradas (`View` con borde, sin borderRadius) para todas las opciones. En verdadero/falso solo dos casillas con etiquetas “V” y “F”.
- **Líneas pautadas:** Trazo fino (0.4), color #888, altura de línea 18pt, sin espacio extra entre líneas (marginBottom 0). Respuesta corta: 5 líneas; ensayo/párrafo: 14 líneas en bloque tipo “área de escritura”.

---

## 2. Cambios realizados

| Área | Cambio |
|------|--------|
| **Footer** | `<Text render={({ pageNumber, totalPages }) => \`Página ${pageNumber} de ${totalPages}\`} fixed />` dentro del `View` de pie ya existente (fixed), de modo que el número aparece en cada página. |
| **Header** | Nuevos estilos `headerRow`, `headerCol`, `headerUnderline`, `headerUnderlineWide`, `headerStudentRow`. Dos filas de dos columnas (Docente/Asignatura, Grupo/Fecha) y una fila ancha para Alumno/a. Se eliminó el bloque “Institución” del layout actual (el prop `platformTitle` se mantiene en la interfaz por si se quiere usar más adelante). |
| **Paginación** | Eliminados `ITEMS_FIRST_PAGE`, `ITEMS_PER_PAGE` y la lógica de `breakBefore`; eliminado `<View break />`. Solo se mantiene `wrap={false}` en el contenedor de cada ítem (`itemBlock`). |
| **Casillas** | Estilo `choiceCircle` sustituido por `checkbox`: `View` 11×11 con `borderWidth: 1`, sin `borderRadius`. Opciones múltiples y V/F usan este mismo estilo; en V/F las etiquetas son solo “V” y “F”. |
| **Líneas pautadas** | `ruledLine`: `height: 18`, `borderBottomWidth: 0.4`, `borderBottomColor: '#888'`, `marginBottom: 0`. `ruledBlock` / `ruledBlockEssay` para espaciado superior. Respuesta corta: 5 líneas; ensayo/párrafo/análisis de fuente: 14 líneas con estilo “essay”. |

---

## 3. Comprobaciones manuales sugeridas

- **Varias páginas**
  - Generar una evaluación con bastantes ítems (p. ej. 10+).
  - Verificar que el pie muestre “Página 1 de N”, “Página 2 de N”, etc., y que N sea correcto.
  - Confirmar que ningún ítem se parte a mitad de pregunta (el bloque completo de un ítem pasa a la siguiente página si no cabe).

- **Consigna larga**
  - Incluir al menos un ítem con prompt muy largo (varias líneas).
  - Comprobar que el bloque del ítem no se parte a mitad de texto y que el espaciado se ve bien.

- **Ítem tipo ensayo**
  - Revisar que el bloque de 14 líneas pautadas se vea como zona de escritura (líneas finas, separación uniforme, no demasiado denso ni vacío).

- **Ítem opción múltiple**
  - Verificar que las opciones tengan casillas cuadradas (no círculos) y que se impriman bien en el PDF.

- **Ítem verdadero/falso**
  - Confirmar que solo aparezcan dos casillas con “V” y “F” (sin “Verdadero”/“Falso” completo).

---

## 4. Limitación conocida

- **Bloques muy largos (ensayo):** Con `wrap={false}` el ítem completo se mantiene en una sola página. Si un ítem (p. ej. ensayo con 14 líneas de respuesta) no cabe en el espacio restante, React-PDF puede truncar o generar una página extra según el motor de layout. Si en pruebas se observa truncado en casos extremos, habría que documentar “no dividir ítem” como limitación aceptada o valorar permitir `wrap={true}` solo en el bloque de líneas del ensayo (con riesgo de partir una pregunta entre páginas).
