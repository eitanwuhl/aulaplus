# Phase 3 — Academic PDF: header underlines and item metadata

**Objetivo:** Ajustar solo el layout del PDF académico: encabezado sin subrayados en datos fijos, metadata de ítem con estilo de examen impreso y menos espacio vertical entre prompt, metadata y opciones.

**Archivo modificado:** `src/components/evaluaciones/pdf/AcademicEvaluationDocument.tsx`

---

## 1. Resumen de cambios

| Área | Cambio |
|------|--------|
| **Encabezado — campos fijos** | Docente, Asignatura y Grupo se muestran como texto normal “Label: Valor”, sin línea en blanco antes del valor. Ej.: “Docente: Carlos Rodríguez”, “Asignatura: Historia”, “Grupo: 9no 1”. |
| **Encabezado — campos a completar** | Fecha y Alumno/a siguen con subrayado: “Fecha: ____/____/____” y “Alumno/a: ____________________________”. Se mantiene el layout de dos columnas. |
| **Metadata de ítem** | Se sustituye la línea “Opción múltiple — 10 pts” por una línea más discreta: tipo y puntos con separador “·”, fuente pequeña (8pt), color #777, alineada a la derecha bajo el prompt. Ej.: “Opción múltiple · 10 pts”. |
| **Espaciado** | Se reduce el espacio entre el prompt y la línea de metadata (marginBottom del header de ítem de 6 a 2), entre metadata y opciones/líneas (marginBottom de 4 a 2), y entre prompt y bloques de opciones/líneas (marginTop de 8/4 a 2/4). Casillas y opciones usan `choiceBlock` con marginTop: 2 y choiceRow marginBottom: 4 para alineación uniforme. |

---

## 2. Antes / después (descripción)

### Encabezado
- **Antes:** En Docente, Asignatura y Grupo había una línea horizontal entre la etiqueta y el valor (“Docente: ____ Carlos Rodríguez”), lo que no se parece a un examen impreso.
- **Después:** Esos tres campos son solo texto: “Docente: Carlos Rodríguez”, “Asignatura: Historia”, “Grupo: 9no 1”. Fecha y Alumno/a conservan subrayado para completar a mano.

### Metadata de ítem
- **Antes:** Línea “Opción múltiple — 10 pts” o “Verdadero/Falso con justificación — 15 pts” con guión largo, tamaño 9 y color #666, más parecida a una UI que a un examen.
- **Después:** Una sola línea bajo el enunciado, alineada a la derecha: “Opción múltiple · 10 pts” (u otro tipo), fuente 8pt, color #777 y separador “·”. El enunciado sigue siendo el elemento principal.

### Espaciado
- **Antes:** Más espacio entre enunciado, metadata, opciones y líneas de respuesta.
- **Después:** Menos espacio vertical entre esos elementos; bloques de opciones y de líneas más pegados al enunciado y a la metadata.

---

## 3. Checklist de pruebas manuales

- [ ] **Encabezado:** Generar un PDF y comprobar que Docente, Asignatura y Grupo se ven como “Label: Valor” sin subrayado, y que Fecha y Alumno/a tienen línea para completar.
- [ ] **Metadata:** Revisar ítems de opción múltiple, V/F, desarrollo, etc. y que en todos se vea “tipoLabel · N pts” en pequeño y alineado a la derecha bajo el enunciado.
- [ ] **Espaciado:** Ver que no haya huecos grandes entre enunciado, metadata y opciones/líneas, y que las casillas y las opciones queden alineadas.
- [ ] **Varias páginas:** Confirmar que el encabezado solo aparece en la primera página y que el pie “Página X de Y” se mantiene en todas.
