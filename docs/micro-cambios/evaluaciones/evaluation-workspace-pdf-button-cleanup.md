# Limpieza del botón de descarga PDF en el workspace de evaluación

## Objetivo

Dejar un único botón de descarga PDF en la UI del workspace de evaluación, con la etiqueta "Descargar PDF" y la misma funcionalidad que antes tenía "Descargar PDF (Académico)".

## Archivos modificados

- **`src/components/evaluaciones/v2/EvaluationRendererV2.tsx`**
  - Eliminado el segundo botón "Descargar PDF" (el que usaba captura con html2canvas/jsPDF).
  - Eliminado el estado `isExportingPdf` y el handler `handleExportPdf` (export por screenshot).
  - Eliminado el comentario de configuración asociado a ese export (márgenes, escala, etc.).
  - Eliminados los imports no usados `Download` y `FileText` de `lucide-react`.
  - El botón que antes decía "Descargar PDF (Académico)" pasó a decir **"Descargar PDF"**; se mantiene el mismo `onClick` (`handleExportAcademicPdf`) y el mismo estado `isExportingAcademicPdf`.

## Botón eliminado y handler conservado

- **Eliminado:** El botón con texto "Descargar PDF" que llamaba a `handleExportPdf` y usaba `html2canvas` + `jsPDF` para generar un PDF a partir de una captura de pantalla del contenido.
- **Conservado:** El botón que antes tenía la etiqueta "Descargar PDF (Académico)", que llama a `handleExportAcademicPdf` y usa `generateAcademicEvaluationPdf` + `getAcademicPdfFilename` para generar y descargar el PDF académico. Ese es el único botón visible; su etiqueta es ahora exactamente **"Descargar PDF"**.

## Checklist de prueba manual

1. Abrir el workspace de una evaluación V2 (pantalla donde se ve la evaluación con selector de versión A/B/C).
2. Comprobar que solo aparece **un** botón de descarga PDF, con el texto **"Descargar PDF"**.
3. Pulsar el botón y comprobar que se descarga un PDF con el mismo contenido y formato que antes producía "Descargar PDF (Académico)" (documento académico generado por `generateAcademicEvaluationPdf`).
4. Comprobar que durante la exportación el botón muestra "Exportando..." y queda deshabilitado, y que el resto de controles del workspace (selector de versión, badges, etc.) no se ven afectados.
