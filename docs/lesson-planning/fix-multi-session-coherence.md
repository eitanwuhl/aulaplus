# Fix de coherencia multi-sesión (implementación + testing)

Fecha: 2026-03-05  
Alcance: cambios focalizados, sin refactor grande

## Archivos cambiados

- `supabase/functions/generate-plan-completo/index.ts`
  - Corrección del índice de cobertura multi-sesión.
  - Logs/debug livianos para trazabilidad del índice usado.
- `src/services/planning/sessionUnitContext.ts` (nuevo)
  - Utilidad compartida para construir `unitContext` por `orden` de sesión.
  - Incluye fallback explícito `1/1` cuando no se puede reconstruir contexto.
- `src/pages/PlanificacionWorkspace.tsx`
  - Payload unificado para `generate-plan-completo` en auto-generación.
- `src/components/planificacion/EditorSesionNuevo.tsx`
  - Payload unificado para generación inicial y regeneración por sesión.
  - Carga contexto mínimo de planificación (unidades/requerimientos/grupo) para enviar `unitContext`.
- `src/components/planificacion/EditorSesionTabs.tsx`
  - Payload unificado en flujos legacy de generación/regeneración.
- `src/components/planificacion/PlanningAIDesignReport.tsx`
  - Hardening: render solo de campos teacher-safe; se ignoran campos legacy técnicos.

## Bug corregido: `orden` global vs `claseEnUnidad`

Problema original:
- El backend armaba `coveragePlan` con tamaño `unitContext.totalClasesUnidad` (escala dentro de la unidad), pero elegía la cobertura con `orden` (escala global de la planificación).
- En unidades posteriores, `orden` no matcheaba `1..totalClasesUnidad`, caía en fallback y repetía foco tipo “primera sesión”.

Fix aplicado:
- Si existe `unitContext`, la selección de cobertura usa `unitContext.claseEnUnidad` (1-based dentro de la unidad).
- Si falta `unitContext`, se mantiene compatibilidad con fallback previo usando `orden`.

Adicional:
- Se agregaron señales de observabilidad livianas:
  - `coverageSessionIndexUsed`
  - `unitTotalClasses`
- Se incorporan tanto en logs como en `debug` de la respuesta.

## Contrato de payload: antes vs después

## Antes
- Wizard: enviaba `unitContext`, `sessionBrief`, `perfilGrupo`, `estudiantes` (más completo).
- Workspace y regeneración: frecuentemente enviaban solo base (`modo`, `orden`, `duracionMin`, etc.), sin contexto secuencial/pedagógico consistente.

## Después
Todos los entrypoints que invocan `generate-plan-completo` envían de forma consistente (cuando hay datos):
- `unitContext` (`unidadId`, `contenido`, `claseEnUnidad`, `totalClasesUnidad`, `isExtraSlot?`)
- `sessionBrief` (si la sesión lo tiene)
- `perfilGrupo` y `estudiantes` (si el contexto de grupo está disponible)
- `instruccionesDocente` (del flujo actual y/o requerimientos de planificación)

Fallback explícito cuando no se logra recuperar contexto de unidad:
- `claseEnUnidad = 1`
- `totalClasesUnidad = 1`

Esto preserva backward compatibility y evita romper flujos con datos incompletos.

## Hardening del reporte docente

En `PlanningAIDesignReport` ahora se renderiza solo un subconjunto teacher-safe:
- `narrative` / `report_narrative`
- `inputsUsed`
- `decisions`
- `contentCoverage`
- `competencyDevelopment`
- `teacherRequirementsApplied`
- `standardsCoverage`
- `competenciesOperationalization`
- `sessionsGenerated` (si viene)

Campos legacy técnicos (aunque existan en filas antiguas) quedan ignorados en render:
- `assumptions`
- `report_technical`
- cualquier dato raw/debug no allowlist.

## QA manual (checklist)

## 1) Plan multi-unidad con N sesiones
1. Crear planificación con al menos 2 unidades y varias clases por unidad.
2. Generar sesiones desde Wizard/Workspace.
3. Verificar en resultados:
   - la primera clase de cada unidad actúa como introducción,
   - clases intermedias profundizan,
   - última clase integra/sintetiza.
4. Revisar debug de respuesta:
   - `coverageSessionIndexUsed` coincide con `claseEnUnidad`.

Esperado:
- No se repite foco de “primera sesión” en clases intermedias/finales de unidades posteriores.

## 2) Regeneración de sesión intermedia
1. Abrir una sesión intermedia y pedir modificación/regeneración.
2. Verificar que el plan mantiene intención de continuidad (no vuelve a framing de clase inicial).
3. Confirmar que el payload incluye `unitContext` + `sessionBrief` (si existe).

Esperado:
- Regeneración coherente con posición dentro de la unidad.

## 3) Auto-generación en Workspace vs Wizard
1. Comparar payloads emitidos por Wizard y Workspace para sesiones equivalentes.
2. Verificar presencia de:
   - `unitContext`
   - `sessionBrief` (si aplica)
   - `perfilGrupo`/`estudiantes` cuando hay contexto.

Esperado:
- Contrato de payload alineado entre entrypoints.

## 4) Seguridad del reporte IA en UI docente
1. Abrir panel de `PlanningAIDesignReport` en sesiones nuevas y en filas legacy.
2. Confirmar que no aparecen secciones técnicas/legacy.

Esperado:
- UI solo muestra narrativa y secciones pedagógicas teacher-safe.

## Limitaciones conocidas / próximo paso recomendado

- La selección de cobertura ya usa índice correcto de unidad, pero la segmentación de materiales por sesión sigue siendo principalmente guiada por prompt.
- Siguiente mejora sugerida (no implementada aquí): segmentación determinista real de materiales por sesión/unidad antes de prompt, para reducir aún más genericidad en PDFs largos.
