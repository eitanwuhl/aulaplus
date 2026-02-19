# Phase 3 — Step 2: UI extraction report

**Rama:** Micro-cambios  
**Alcance:** Extracción de dos secciones de UI (Results y Save) en componentes dedicados, sin cambiar comportamiento ni maquetado.

---

## What UI blocks were moved

**EvaluationResultsSection**

- Bloque condicional que se muestra cuando hay resultados (V1 o V2): contenedor `space-y-6`, `Tabs` con pestaña "Evaluaciones Generadas", y `TabsContent` "results".
- Dentro del tab: fila de cabecera (título "Evaluaciones generadas para {groupName}" + botón de guardar), panel de debug de integridad de versiones (cuando `VITE_DEBUG_EVAL_PIPELINE=true`), rama V2 (V2InfoPanels, EvaluationRendererV2, EvaluationAdjustmentsPanel) y rama V1 (card de avisos de asignación, EvaluationAssignmentsPanel, TeacherRemindersPanel, lista de EvaluacionVisualRenderer, AIDesignReport o card de “reporte no disponible”, card de Criterios de logro).
- El botón "Guardar evaluación" de la cabecera se sustituyó por un slot `saveButton` (ReactNode) que la página rellena con `SaveEvaluationSection`.

**SaveEvaluationSection**

- Botón "Guardar evaluación" (icono Save + texto).
- Diálogo "Guardar Evaluación": título, input "Nombre de la evaluación", texto de ayuda "Este nombre aparecerá en Mis Evaluaciones", botones "Cancelar" y "Guardar" (estados disabled y "Guardando..." preservados).
- Sin lógica de persistencia: al confirmar se llama `onSaveRequest()`; la página sigue siendo responsable del insert en Supabase.

---

## New component props (public API)

**EvaluationResultsSection**

- `groupName`, `activeTab`, `onActiveTabChange`, `saveButton` (ReactNode).
- Debug: `showDebugPanel`, `debugA`, `debugB`, `debugC`, `debugAssignmentCounts`, `debugVersions`, `cardA`, `cardB`, `cardC`, `diffCheckA`, `diffCheckB`, `diffCheckC`.
- V2: `useBetaV2`, `v2RawResponse`, `v2SelectedVersion`, `onV2VersionChange`, `onV2ResponseChange`, `isGenerating`, `teacherName`, `onPointsWarning`, `onRenderError`, `previousV2Response`, `onAdjustmentApplied`, `onUndo`, `groupContext`, `evaluationDesignPlan`.
- V1: `assignmentWarnings`, `studentAssignments`, `students`, `teacherReminders`, `missingTemplateErrors`, `displayEvaluations`, `subjectDisplay`, `selectedContent`, `duration`, `requirements`, `selectedCriteriosLogro`, `onFeedbackRequest`, `onRegenerateRequest`, `aiDesignReport`, `criteriosLogroContent` (ReactNode).

**SaveEvaluationSection**

- `saveDialogOpen`, `onSaveDialogOpenChange`, `nombreEvaluacion`, `onNombreEvaluacionChange`, `isSaving`, `onSaveRequest`, `onOpenSaveDialog` (callback al hacer clic en "Guardar evaluación" para abrir el diálogo; la página puede prefijar el nombre ahí).

---

## Files created/changed

**Creados**

- `src/features/evaluaciones/components/SaveEvaluationSection.tsx` — Botón + diálogo de guardado; llama a `onSaveRequest` al confirmar.
- `src/features/evaluaciones/components/EvaluationResultsSection.tsx` — Área de resultados: Tabs, cabecera con slot para el botón de guardar, panel de debug (opcional), rama V2 (V2InfoPanels, EvaluationRendererV2, EvaluationAdjustmentsPanel) y rama V1 (avisos, asignaciones, recordatorios, EvaluacionVisualRenderer, reporte IA, criterios de logro).

**Modificados**

- `src/pages/EvaluacionesGrupo.tsx` — Sustitución del bloque de resultados y del diálogo de guardado por `EvaluationResultsSection` y `SaveEvaluationSection`; paso de props desde estado del hook y de la página; eliminación de imports ya no usados (Dialog, Save, EvaluationRendererV2, V2InfoPanels, EvaluationAdjustmentsPanel, EvaluacionVisualRenderer, EvaluationAssignmentsPanel, TeacherRemindersPanel, AIDesignReport, AIDesignReportData, Input para el diálogo).

---

## Notes confirming behavior parity

- La condición para mostrar el bloque de resultados se mantiene: `(displayEvaluations.length > 0 || (useBetaV2 && v2RawResponse))`; la página la evalúa y solo monta `EvaluationResultsSection` cuando aplica.
- El texto del botón "Guardar evaluación", del diálogo ("Guardar Evaluación", "Nombre de la evaluación", placeholder, "Este nombre aparecerá en Mis Evaluaciones", "Cancelar", "Guardar", "Guardando...") y las reglas de disabled (Guardar cuando `!nombre.trim()` o `isSaving`) se conservan.
- El flujo de abrir el diálogo y prefijar el nombre se mantiene: la página pasa `onOpenSaveDialog` que hace `setNombreEvaluacion(defaultName)` y `setSaveDialogOpen(true)` con el mismo `defaultName` que antes.
- La rama V2 sigue usando los mismos componentes (V2InfoPanels, EvaluationRendererV2, EvaluationAdjustmentsPanel) con las mismas props; los callbacks (onRenderError, onAdjustmentApplied, onUndo) replican el mismo comportamiento (toast, setV2RawResponse, setPreviousV2Response).
- La rama V1 mantiene el mismo orden y contenido: avisos de asignación, panel de asignaciones, panel de recordatorios, lista de EvaluacionVisualRenderer (subject, selectedContent, duration, requirements, criteriosLogro, onFeedback, onRegenerate), reporte de IA o card de respaldo, criterios de logro. La página sigue pasando `onFeedbackRequest` que actualiza `currentFeedback` y llama a `handleFeedback`, y `onRegenerateRequest` que llama a `handleRegenerate`.
- El panel de debug de versiones (Forensic Panel) se muestra bajo la misma condición `showDebugPanel` y con los mismos campos y textos.

---

## Manual test checklist

1. **Generar V1:** Desactivar Beta V2, generar evaluación; comprobar que se ven las tarjetas A/B/C, asignaciones, recordatorios, reporte de IA y criterios de logro.
2. **Generar V2:** Activar Beta V2, generar; comprobar que se ven V2InfoPanels, EvaluationRendererV2 y EvaluationAdjustmentsPanel.
3. **Abrir guardado:** Con resultados en pantalla, clic en "Guardar evaluación"; comprobar que se abre el diálogo y el nombre se pre-rellena.
4. **Guardar V1:** Rellenar nombre (o usar el sugerido), Guardar; comprobar que se persiste y que al reabrir se ve la evaluación V1.
5. **Guardar V2:** Tras generar V2, Guardar evaluación, nombre, Guardar; comprobar que se persiste y al reabrir se ve el contenido V2.
6. **Validación del diálogo:** Dejar el nombre vacío y comprobar que el botón Guardar está deshabilitado; con nombre, comprobar que está habilitado.
7. **Cancelar:** Abrir el diálogo y Cancelar; comprobar que se cierra sin guardar.
8. **Debug (opcional):** Con `VITE_DEBUG_EVAL_PIPELINE=true`, generar y comprobar que el panel de integridad de versiones se muestra igual que antes.
9. **Feedback/Regenerar V1:** En una evaluación V1, usar feedback o regenerar y comprobar que el flujo sigue funcionando (los callbacks se invocan desde EvaluationResultsSection).

---

*Paso 2 completado. La página queda reducida y centrada en configuración y en el encaje del hook con los dos nuevos componentes.*
