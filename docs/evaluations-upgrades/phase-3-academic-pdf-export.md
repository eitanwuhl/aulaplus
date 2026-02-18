# Phase 3 — Academic PDF Export (documento real, no captura)

**Objetivo:** Exportar evaluaciones V2 como PDF académico: documento de texto real, paginado, con encabezado, espacios de respuesta y pie de página. Se mantiene la exportación por captura (html2canvas + jsPDF) como alternativa.

**Rama:** `mejorar-evaluaciones`

---

## 1. Qué cambió

- **Nueva ruta de exportación:** "Descargar PDF (Académico)" genera un PDF con `@react-pdf/renderer` (texto seleccionable, no imagen).
- **Encabezado** en la primera página: institución (opcional), docente, materia, grupo, fecha (línea en blanco `____/____/____`), nombre del estudiante (línea larga en blanco).
- **Cuerpo:** secciones e ítems numerados de forma global (1, 2, 3…), consigna por ítem, opciones equivalentes de respuesta en línea (“Puedes responder de estas formas: A) … B) …”) y espacios de respuesta según tipo (líneas pautadas, bloques, casillas).
- **Pie en todas las páginas:** “Página _____” y marca “AULA+”.
- **Paginación:** se evita cortar una pregunta a mitad de página (`wrap={false}` en cada ítem y `break` cada N ítems).
- **Nombre de archivo:** `Evaluacion_{materia}_{grupo}_{fecha}.pdf` (fecha desde `generatedAt` o hoy).

---

## 2. Archivos nuevos

| Ruta | Descripción |
|------|-------------|
| `src/components/evaluaciones/pdf/AcademicEvaluationDocument.tsx` | Documento React-PDF: `Document`, `Page`, encabezado, secciones/ítems, espacios de respuesta, pie. |
| `src/components/evaluaciones/pdf/generateAcademicEvaluationPdf.ts` | `generateAcademicEvaluationPdf(options)` → `Promise<Blob>`, `getAcademicPdfFilename(options)` y `generateAcademicEvaluationPdfFromSpec(spec, options)` para uso con spec crudo. |
| `src/components/evaluaciones/pdf/index.ts` | Reexportaciones del módulo PDF. |

---

## 3. Cómo se arma el PDF desde EvaluationSpecV2

- **Entrada:** Se usa la evaluación ya normalizada (`NormalizedEvaluation`) que produce `normalizeV2Response(v2Response, version)`, más opcionalmente `meta` (de `EvaluationSpecV2.meta`) y `teacherName`.
- **Encabezado:**  
  `subject`, `groupName` desde `meta` o `evaluation`; `teacherName` desde perfil (o “Docente”); fecha y estudiante como líneas en blanco.
- **Cuerpo:**  
  Se recorren `evaluation.sections` y, por cada sección, `section.items`. Cada ítem tiene número global (1, 2, 3…), `item.prompt`, tipo y puntos, y si aplica `equivalentResponseOptions` se muestra “Puedes responder de estas formas: A) … B) …”.
- **Espacios de respuesta por tipo:**
  - `short_answer`: 4 líneas pautadas.
  - `paragraph` / `essay` / `source_analysis`: bloque de 16 líneas pautadas.
  - `multiple_choice`: opciones con círculo vacío y texto.
  - `true_false` / `true_false_justify`: círculos V/F; en justify además “Justificación:” y 3 líneas.
  - `matching` / `ordering` / `table_completion`: 6 líneas pautadas (representación simplificada).
- **Paginación:** Cada bloque de ítem tiene `wrap={false}`. Se inserta `<View break />` cada `ITEMS_FIRST_PAGE` (4) y luego cada `ITEMS_PER_PAGE` (6) para abrir nueva página y no cortar preguntas.

---

## 4. Puntos de uso en la UI

- **Vista grupo (EvaluacionesGrupo):** En la barra del render V2, junto a “Descargar PDF” (captura), el botón **“Descargar PDF (Académico)”** llama a `generateAcademicEvaluationPdf` con la evaluación normalizada, `rawSpec.meta` y `teacherName` (desde `useAuth().user?.name`) y descarga el archivo.
- **Detalle de evaluación (EvaluacionDetalle):** Cuando hay `evaluation_spec` y se muestra `EvaluationRendererV2`, el mismo botón “Descargar PDF (Académico)” está disponible en la barra del renderer; `teacherName` se pasa desde `useAuth().user?.name`.
- **Evaluaciones V1 (sin evaluation_spec):** No se muestra el renderer V2 ni este botón; no hay cambio para evals antiguas. No se añade tooltip “Solo V2” porque el botón solo existe dentro del renderer V2.

---

## 5. Checklist de pruebas manuales

- **Una sola página**  
  - Evaluación corta (pocos ítems).  
  - Verificar: encabezado completo, numeración 1, 2, 3…, consignas legibles, espacios de respuesta según tipo, pie “Página _____” y “AULA+”.  
  - Abrir el PDF y comprobar que el texto es seleccionable (no es imagen).

- **Varias páginas**  
  - Evaluación con muchos ítems (más de 4–6 por página).  
  - Verificar: ninguna pregunta partida entre páginas; pie en cada página; encabezado solo en la primera.

- **Tipos de ítem**  
  - **Opción múltiple:** opciones con círculo vacío y texto.  
  - **Verdadero/Falso (con justificación):** casillas V/F y líneas de justificación.  
  - **Respuesta corta:** líneas pautadas (3–5).  
  - **Párrafo / ensayo:** bloque grande de líneas pautadas (12–18).  
  - **Opciones equivalentes:** ítem con “Puedes responder de estas formas: A) … B) …” debajo de la consigna.

- **Datos de encabezado**  
  - Con usuario logueado: nombre del docente en el PDF.  
  - Sin nombre en perfil: “Docente” en el PDF.  
  - Materia y grupo coinciden con la evaluación.

- **Nombre de archivo**  
  - Formato `Evaluacion_{materia}_{grupo}_{fecha}.pdf`, sin caracteres raros y con fecha coherente.

- **Fallback**  
  - Evaluación guardada solo como V1 (sin `evaluation_spec`): no aparece el botón “Descargar PDF (Académico)” (solo el flujo V1 con su exportación si existe).
