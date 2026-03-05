# 36) Planificación: material grounded, multi-sesión y reporte docente

Fecha: 2026-03-04  
Ámbito: `generate-plan-completo` (filtro de pasajes, cobertura por sesión, narrativo docente).

## Causas raíz observadas

- **TOC/Prólogo como contenido de clase:** Fragmentos de Índice, Prólogo o Referencias se usaban como base del plan, generando planes genéricos o poco útiles.
- **Planes genéricos en sesión 2+:** En planes multi-sesión, la sesión 2 (o intermedias) no siempre usaban el segmento de material asignado, sino texto genérico.
- **Reporte IA poco enfocado:** El narrativo no priorizaba contenido enseñado desde pasajes, operacionalización de competencias, contemplaciones/adaptaciones y evidencia de aprendizaje; riesgo de dumps técnicos o HTML visible.

## Cambios realizados

### 1) Filtro determinista de pasajes (antes de usar material)

- **Ubicación:** `generate-plan-completo/passageQualityFilter.ts`.
- **Función:** `filterMaterialPassages(materialsContext)`.
- **Criterios de rechazo:** Iguales conceptualmente a evaluaciones: toc, biblio, prologue, metadata.
- **Uso:** Se aplica al `materialsContext` antes de construir la sección de materiales del prompt, el plan de cobertura y el resumen de material. Solo el texto filtrado (`filteredText`) se usa en el prompt y en `buildContentCoverage` / `extractMaterialSummary`.
- **Métricas de debug:** En la respuesta se añade `debug.passagesRejectedCount`, `debug.passagesSelectedCount`, `debug.materialsCharsSent` (sin logs pesados).

### 2) Cobertura multi-sesión y uso obligatorio del segmento

- **Plan de cobertura:** Ya existía `buildCoveragePlan`; ahora se alimenta con el **material filtrado** (no con el crudo).
- **Prompt:** En la sección COBERTURA DE CONTENIDO se refuerza:
  - “Segmento del material a trabajar (USA SOLO ESTE SEGMENTO para esta sesión)”.
  - “OBLIGATORIO: El plan de esta sesión debe usar ÚNICAMENTE el contenido asignado a esta sesión en el mapeo anterior. No generes planes genéricos; incluye conceptos y detalles específicos del segmento asignado.”
- **Evitar TOC/Prólogo como contenido:** En REGLAS CRÍTICAS PARA MATERIALES-ONLY se añade: no usar Índice, Prólogo, Presentación editorial ni Bibliografía/Referencias como contenido de clase salvo petición explícita del docente.

### 3) Reporte narrativo docente (enfoque y formato)

- **Prompt:** En REPORTE NARRATIVO se exige que el narrativo se enfoque en:
  - (1) Qué contenido se enseña a partir de los pasajes seleccionados.
  - (2) Cómo se operacionalizan las competencias en las actividades.
  - (3) Cómo el plan atiende contemplaciones/adaptaciones del grupo (no solo lista genérica de “diferenciación”).
  - (4) Qué evidencia de aprendizaje se espera.
- **Formato:** No incluir volcados largos de material crudo ni JSON técnico. Salida en texto limpio o markdown; no dejar etiquetas HTML visibles.

### 4) UI del reporte (confirmación)

- **Detalle técnico (raw):** Oculto por defecto; solo visible con `window.__PLAN_REPORT_DEBUG__ = true`.
- **Narrativa:** Se aplica `stripHtmlToText` para que no se vean `<p>` ni otras etiquetas; el contenido relevante se integra en la narrativa docente (propósito, secuencia, competencias, evidencia, adaptaciones, materiales).

## Cómo se evita WORKER_LIMIT

- **Una sola llamada OpenAI** por generación de plan.
- **Filtro de pasajes** y construcción del plan de cobertura son deterministas (sin llamadas adicionales).
- No se añaden pasos LLM extra; solo mejoras de prompt y filtrado previo del material.

## Cómo probar manualmente (“max difficulty”)

1. **Plan multi-sesión con material:**
   - Crear planificación con 2 o 3 sesiones y un material largo (varias secciones).
   - Verificar en la respuesta (si está disponible) `debug.passagesRejectedCount`, `debug.passagesSelectedCount`, `debug.materialsCharsSent`.
   - Abrir la **sesión 2**: el plan debe contener conceptos o detalles específicos del segmento asignado a esa sesión (no solo texto genérico de “desarrollo” o “profundización” sin anclaje al material).

2. **Reporte IA docente:**
   - Abrir el reporte de IA de una sesión generada.
   - Comprobar: no se muestra “Detalle técnico (raw)” en modo normal.
   - La narrativa se ve como texto limpio (sin etiquetas `<p>` visibles).
   - El contenido incluye enfoque en qué se enseña, competencias, adaptaciones/contemplaciones y evidencia esperada, sin dump de JSON ni material crudo largo.

3. **Checklist repetible (resumen):**
   - [ ] Generar evaluación con máxima dificultad y material → existe sección con excerpt + 4–6 MC + short_answer; no “fragmento anterior” sin fuente.
   - [ ] Generar plan multi-sesión con material → sesión 2 contiene contenido específico del material (no genérico).
   - [ ] Reporte IA de planificación → docente-friendly, sin raw técnico, sin `<p>` visibles; narrativa enfocada en contenido, competencias, adaptaciones y evidencia.
