# Investigación del pipeline de planificación (planning only)

Fecha: 2026-03-05  
Estado: solo investigación, sin cambios de implementación

## 1) System Map (UI -> Edge -> LLM -> postprocess -> DB -> UI)

```text
PlanificacionWizard / PlanificacionWorkspace / EditorSesionNuevo
  -> construyen payload para `generate-plan-completo`
  -> `supabase.functions.invoke('generate-plan-completo', { body })`
    -> Edge Function `supabase/functions/generate-plan-completo/index.ts`
      -> arma prompt (contexto ANEP + materiales + unitContext + sessionBrief + perfil/estudiantes)
      -> llama OpenAI Chat Completions (`gpt-4o-mini`)
      -> parsea JSON / fallback parse
      -> genera `plan_html`, `argumento_competencias`, `recursos`, `ai_design_report`
      -> sanea reporte docente (`toTeacherSafeAiDesignReport`)
    -> frontend postprocesa HTML (`buildSanitizedLessonPlanHtml`, `parsePlan`)
    -> persiste en `sesiones_clase` (+ a veces `planificaciones.ai_design_report`)
  -> Workspace muestra sesión + panel `PlanningAIDesignReport`
```

Puntos de entrada UI relevantes:
- Creación masiva: `src/pages/PlanificacionWizard.tsx` (`generarPlanesAutomaticamente`).
- Auto-generación faltantes en workspace: `src/pages/PlanificacionWorkspace.tsx` (`generatePlanForSession`).
- Regeneración por sesión: `src/components/planificacion/EditorSesionNuevo.tsx` (`handleSolicitarModificacion`).
- Variante legacy similar: `src/components/planificacion/EditorSesionTabs.tsx`.

---

## 2) Payload exacto enviado a `generate-plan-completo`

### 2.1 Payload principal (Wizard, creación de N sesiones)
Construido en `src/pages/PlanificacionWizard.tsx`.

Campos observados:
- `modo`: `'generar_plan_html'`
- `sesionId`
- `orden`
- `duracionMin`
- `materia`
- `nivel`
- `contenidos` (por asignación de unidad)
- `competencias` (sesión/unidad/global)
- `criterios`
- `instruccionesDocente` (desde `planificacion.requerimientos_docente`)
- `unitContext`: `{ unidadId, contenido, claseEnUnidad, totalClasesUnidad, isExtraSlot? }`
- `sessionBrief` (si existe para esa sesión)
- `perfilGrupo` (opcional)
- `estudiantes` (opcional)
- `materialsContext` (si hay materiales)

### 2.2 Payload de auto-generación en Workspace (sesiones faltantes)
Construido en `src/pages/PlanificacionWorkspace.tsx` (`generatePlanForSession`).

Campos:
- `modo`, `sesionId`, `orden`, `duracionMin`, `materia`, `nivel`, `contenidos`, `competencias`, `criterios`
- `instruccionesDocente: undefined`
- `materialsContext` (opcional)

**No incluye** `unitContext`, `sessionBrief`, `perfilGrupo`, `estudiantes`.

### 2.3 Payload de regeneración por sesión (Editor)
En `src/components/planificacion/EditorSesionNuevo.tsx`:
- `modo: 'regenerar'`
- `sesionId`, `orden`, `duracionMin`, `materia`, `nivel`
- `contenidos`, `competencias`, `criterios`
- `instruccionesDocente` (texto de modificación)
- `planActual`
- `materialsContext` (opcional)

En este flujo tampoco se envían `unitContext`/`sessionBrief`/perfil de grupo.

**Diagnóstico estructural:** hay múltiples contratos de payload para el mismo endpoint; los flujos de workspace/regeneración mandan menos contexto secuencial/pedagógico que el wizard.

---

## 3) Truncaciones de material exactas y su impacto

## 3.1 Extracción PDF (`extract-material-text`)
Archivo: `supabase/functions/extract-material-text/index.ts`
- Guarda `teacher_materials.extracted_text`.
- Post-limpieza corta a `20000` chars (`substring(0, 20000) + '...'`).
- Si extracción queda en 0 chars, responde OK pero **no persiste** texto (queda `NULL`).
- Constantes `MAX_PAGES=5` y `MAX_CHARS=10000` están declaradas pero no se aplican al flujo real.

Impacto:
- PDFs largos se reducen temprano a 20k chars por material.
- Si extracción falla o queda vacía, los flujos “materials-only” se bloquean.

## 3.2 Formateo frontend para prompt
Archivo: `src/utils/loadAttachedMaterials.ts`
- `formatMaterialsForAI()` recorta `extracted_text` a `2000` chars por material.
- No hay tope global de `materialsContext`.
- Incluye `focus_text` y título; agrega instrucciones textuales de grounding.

Impacto:
- Se pierde granularidad en materiales largos (solo prefijo de cada material).
- Si se adjuntan muchos materiales, puede crecer prompt por cantidad, no por profundidad.

## 3.3 Filtrado en Edge antes del prompt
Archivo: `supabase/functions/generate-plan-completo/passageQualityFilter.ts`
- `filterMaterialPassages(materialsContext)` elimina bloques tipo índice/bibliografía/prólogo/metadatos.
- No segmenta por sesión real; solo filtra ruido y vuelve a concatenar bloques.

Impacto:
- Mejora limpieza, pero no garantiza partición fuerte de contenido por sesión.

---

## 4) Lógica exacta de secuenciación multi-sesión

## 4.1 En UI (Wizard)
Archivo: `src/pages/PlanificacionWizard.tsx`
- `expandUnitsToSessionPlan(unidades)` expande por `clases_estimadas`.
- `mapSessionsToUnits(totalSlots, expandedPlan)` asigna sesión->unidad:
  - si faltan unidades, usa fallback `contenido_texto: 'Contenido general'`
  - si sobran slots, extiende última unidad con `isExtraSlot=true`.
- Por sesión se arma `unitContext` con `claseEnUnidad/totalClasesUnidad`.

## 4.2 En Edge (`generate-plan-completo`)
- Usa `unitContext` para reglas de primera/intermedia/última clase en el prompt.
- Construye `coveragePlan` con `buildCoveragePlan(totalSessions, ...)`.
- `totalSessions` = `unitContext?.totalClasesUnidad || 1`.
- Selección de cobertura: `coveragePlan.find(c => c.sessionNumber === orden) || coveragePlan[0]`.

**Hallazgo crítico (evidencia de progresión débil):**
- `orden` es ordinal global de la sesión en la planificación.
- `coveragePlan.sessionNumber` está en escala de la unidad (`1..totalClasesUnidad`).
- En unidades no iniciales, `orden` suele ser mayor que `totalClasesUnidad`; cae al fallback `coveragePlan[0]`.
- Resultado probable: sesiones reciben foco “de primera sesión” o foco incorrecto, degradando continuidad.

## 4.3 Regeneración/auto-workspace
- Flujos de workspace/editor usualmente no envían `unitContext` ni `sessionBrief`.
- El Edge pierde señal de posición didáctica y puede producir salida más genérica.

---

## 5) AI report: teacher-facing vs debug/raw y posibles leaks

Generación/saneamiento:
- Edge usa `toTeacherSafeAiDesignReport(...)` (`supabase/functions/generate-plan-completo/index.ts`) con allowlist:
  - `narrative`, `report_narrative`, `inputsUsed`, `decisions`, `contentCoverage`, `competencyDevelopment`, `teacherRequirementsApplied`, `standardsCoverage`, `competenciesOperationalization`, `sessionsGenerated`.
- Frontend vuelve a sanear antes de persistir (`src/services/planning/teacherSafeAiReport.ts`).

Persistencia:
- No la hace la edge function; persiste frontend:
  - `sesiones_clase.ai_design_report`
  - `planificaciones.ai_design_report`

Riesgos de leak:
- `PlanningAIDesignReport` aún soporta campos legacy (`assumptions`, `report_technical`) y los puede renderizar si llegan desde datos viejos.
- `report_technical` solo visible con flag de debug UI, pero `assumptions` se muestra (filtrando parcialmente).
- Si existen registros históricos sin saneamiento, pueden aparecer en UI.

---

## 6) Hipótesis raíz (rankeadas) para “salida genérica” y “progresión débil”

1. **Desalineación de índices en secuenciación (`orden` global vs sesión dentro de unidad).**  
   Alta severidad/alta probabilidad. Explica continuidad inconsistente y foco incorrecto por sesión.

2. **Contratos de payload inconsistentes entre entrypoints.**  
   Wizard manda `unitContext/sessionBrief/perfil`; workspace/regeneración no siempre. Al faltar esas señales, el modelo cae a patrones genéricos.

3. **Truncación fuerte de materiales + ausencia de segmentación real por sesión.**  
   20k en extracción + 2k por material en frontend; luego filtrado sin “slice” por sesión. El prompt pide secuencia, pero la base factual puede quedar superficial.

4. **Fallbacks generativos muy genéricos cuando falla parseo/estructura.**  
   Si `JSON.parse` falla o HTML inválido, se construyen planes de respaldo estandarizados.

5. **Sesiones con contenido base débil o genérico.**  
   Si no hay unidades robustas, aparece fallback `Contenido general`; además en algunos flujos `competencias/contenidos` pueden ir vacíos.

6. **Personalización de contemplaciones mayormente textual, no siempre operativa.**  
   Hay reglas de prompt y postproceso de diferenciación, pero sin verificador determinista de “adaptaciones accionables por actividad”.

---

## 7) Reproducción local (evidencia)

## 7.1 Caso A: N sesiones con PDF largo
1. Ir a wizard (`PlanificacionWizard`), crear planificación con varias sesiones.
2. Adjuntar 1+ PDFs largos a nivel planificación y/o unidad.
3. Completar `sessionBriefs` para algunas sesiones y dejar otras vacías.
4. Finalizar para disparar generación masiva.
5. Verificar en consola/red payloads a `generate-plan-completo` por sesión.
6. Revisar en DB:
   - `sesiones_clase.plan_desarrollo.html_completo`
   - `sesiones_clase.ai_design_report`
   - `planificaciones.ai_design_report`
7. Señales esperadas del problema:
   - sesiones intermedias con foco repetido/genérico;
   - continuidad pobre respecto de sesión anterior/siguiente;
   - cobertura que no sigue claramente una progresión de material.

## 7.2 Caso B: regeneración de sesión
1. En workspace, abrir una sesión y usar “solicitar modificación”.
2. Ver payload de regeneración (sin `unitContext`/`sessionBrief` en flujo estándar).
3. Comparar versión anterior vs regenerada:
   - pérdida de continuidad en secuencia de unidad;
   - mayor genericidad en actividades;
   - menor anclaje al foco de sesión.

---

## 8) Recomendaciones (fase planning, sin implementar)

1. **Unificar contrato de payload** para todos los entrypoints de planificación:
   siempre enviar `unitContext`, `sessionBrief`, `instruccionesDocente`, `perfilGrupo`, `estudiantes`, `materialsContext` cuando existan.

2. **Corregir la indexación de secuencia en Edge**:
   al resolver cobertura por sesión usar `unitContext.claseEnUnidad` (o map explícito), no `orden` global.

3. **Segmentación determinista de materiales por sesión**:
   precomputar segmentos por unidad/sesión (no solo instrucciones de prompt), y pasar solo el segmento correspondiente.

4. **Añadir verificador determinista post-LLM**:
   validar que el HTML incluya continuidad explícita, objetivos/competencias operativizadas y actividades ancladas a fuentes.

5. **Duración realista con budget determinista**:
   introducir validación de suma temporal por actividad y ajustes automáticos controlados antes de persistir.

6. **Hardening de reporte docente**:
   migrar/limpiar registros legacy con `assumptions`/`report_technical`; mantener render solo de campos safe en UI docente.

