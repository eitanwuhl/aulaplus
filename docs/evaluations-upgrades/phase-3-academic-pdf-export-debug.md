# Phase 3 — Academic PDF export debug: verificación de wiring y uso del documento

**Objetivo:** Comprobar por qué los cambios en `AcademicEvaluationDocument.tsx` no se ven al exportar y asegurar que el flujo use siempre ese documento.

---

## 1. Causas probables (cuando los cambios no se ven)

Tras revisar el código, el **wiring es correcto**: el botón "Descargar PDF (Académico)" llama a `generateAcademicEvaluationPdf`, que usa `AcademicEvaluationDocument`. Las causas más probables son:

| Causa | Descripción |
|-------|-------------|
| **Botón equivocado** | Se está usando **"Descargar PDF"** (segundo botón), que genera el PDF por captura (html2canvas + jsPDF). Ese flujo no usa `AcademicEvaluationDocument`, por lo que ningún cambio en ese componente se refleja. |
| **Mismo nombre de archivo** | El nombre es `Evaluacion_{materia}_{grupo}_{fecha}.pdf`. Si no cambia materia/grupo/fecha, el navegador o el sistema pueden abrir siempre el mismo archivo ya descargado (p. ej. desde la carpeta Descargas), y se ve la versión antigua. |
| **Caché del navegador/build** | Menos frecuente: caché del bundler o del navegador sirviendo un JS antiguo. Reiniciar el servidor de desarrollo o hard refresh puede descartarlo. |

No se encontró ningún uso de un documento duplicado ni imports incorrectos: el generador importa `AcademicEvaluationDocument` desde `./AcademicEvaluationDocument` y el barrel `pdf/index.ts` reexporta los símbolos correctos.

---

## 2. Verificaciones realizadas

### 2.1 UI y handlers

- **Archivo:** `src/components/evaluaciones/v2/EvaluationRendererV2.tsx`
- **Primer botón (izquierda):** etiqueta "Descargar PDF (Académico)", `onClick={handleExportAcademicPdf}`.
- **Segundo botón:** etiqueta "Descargar PDF", `onClick={handleExportPdf}` (captura con html2canvas/jsPDF).
- **handleExportAcademicPdf** llama a `generateAcademicEvaluationPdf({ evaluation, meta, teacherName })`, luego `getAcademicPdfFilename(...)`, crea el Blob, el `<a download>` y revoca la URL. No se usa html2canvas ni jsPDF en este camino.

### 2.2 Generador y documento

- **Archivo:** `src/components/evaluaciones/pdf/generateAcademicEvaluationPdf.ts`
- Import: `import { AcademicEvaluationDocument } from './AcademicEvaluationDocument';`
- Uso: `pdf(React.createElement(AcademicEvaluationDocument, { evaluation, meta, teacherName, platformTitle })).toBlob()`.
- No hay otro documento ni componente alternativo usado para este export.

### 2.3 Barrel

- **Archivo:** `src/components/evaluaciones/pdf/index.ts`
- Reexporta `AcademicEvaluationDocument` desde `./AcademicEvaluationDocument` y `generateAcademicEvaluationPdf` / `getAcademicPdfFilename` desde `./generateAcademicEvaluationPdf`.

---

## 3. Cambios aplicados para depuración y verificación

### 3.1 Marcador de debug en el documento

- En **AcademicEvaluationDocument.tsx** se añadió la constante `DEBUG_ACADEMIC_PDF = false`.
- Cuando está en `true`, en el encabezado del PDF se muestra el texto **"ACADEMIC_PDF_DEBUG"** (fuente pequeña, color #999).
- **Cómo usarlo:** poner `const DEBUG_ACADEMIC_PDF = true` en ese archivo, exportar con "Descargar PDF (Académico)" y abrir el PDF generado. Si aparece "ACADEMIC_PDF_DEBUG", se está usando este documento. Después volver a dejarlo en `false` o quitarlo.

### 3.2 Nombre de archivo único en desarrollo

- En **generateAcademicEvaluationPdf.ts** y **getAcademicPdfFilename** se añadió la opción `devUniqueFilename?: boolean`.
- Si es `true`, al nombre base se le añade `_<timestamp>.pdf` (p. ej. `Evaluacion_Historia_9no1_2025-02-16_1739123456789.pdf`), de modo que cada export tenga un nombre distinto.
- En **EvaluationRendererV2.tsx**, al llamar a `getAcademicPdfFilename` se pasa `devUniqueFilename: import.meta.env.DEV`. Así, en desarrollo cada descarga tiene un nombre único y se evita abrir por error un PDF antiguo con el mismo nombre. En producción (`import.meta.env.DEV === false`) el nombre sigue siendo el determinista sin timestamp.

---

## 4. Cómo comprobar que el fix es correcto

1. **Comprobar que se usa el botón académico**  
   Pulsar explícitamente **"Descargar PDF (Académico)"** (primer botón, icono FileDown). No usar "Descargar PDF" (segundo botón).

2. **Comprobar con el marcador de debug**  
   - En `AcademicEvaluationDocument.tsx` poner `DEBUG_ACADEMIC_PDF = true`.  
   - Guardar, exportar con "Descargar PDF (Académico)" y abrir el PDF descargado.  
   - Ver que en la parte superior del encabezado aparece "ACADEMIC_PDF_DEBUG".  
   - Volver a poner `DEBUG_ACADEMIC_PDF = false`.

3. **Comprobar que no es caché de nombre de archivo**  
   - En desarrollo, cada export debe generar un nombre con timestamp (p. ej. `..._1739123456789.pdf`).  
   - Abrir ese archivo nuevo y ver que el contenido (y, si se dejó activo, el marcador de debug) corresponde al código actual.

4. **Comprobar que los cambios de layout se ven**  
   Tras lo anterior, cualquier cambio en `AcademicEvaluationDocument.tsx` (encabezado, metadata, espaciado, etc.) debe verse en el PDF generado con "Descargar PDF (Académico)" al exportar de nuevo (en dev, con nombre único).

---

## 5. Resumen

- **Causa raíz más probable:** uso del botón de captura ("Descargar PDF") en lugar del académico, o reapertura de un PDF antiguo con el mismo nombre.
- **Cambios hechos:** (1) marcador opcional `DEBUG_ACADEMIC_PDF` en el documento para confirmar que se usa este componente; (2) `devUniqueFilename` y uso de `import.meta.env.DEV` para nombre único en desarrollo y evitar confusión por caché de nombre.
- **Verificación:** usar solo "Descargar PDF (Académico)", opcionalmente activar el marcador de debug y comprobar nombres con timestamp en dev; los cambios en `AcademicEvaluationDocument.tsx` deben reflejarse en el PDF generado por ese botón.
