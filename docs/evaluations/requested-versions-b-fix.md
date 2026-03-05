# Fix: persistencia de Versión B en modify/regenerate

## Contexto
En el flujo de modificación (`modify-evaluation-v2`), la Versión B podía desaparecer después de pedir ajustes, aunque hubiera existido antes.

## Root cause
- En backend, `requestedVersions.B` se derivaba principalmente de `declaredContentAdaptationCount > 0`.
- En ajustes (`mode=adjust`), si el payload no traía suficiente señal de adaptación declarada, la decisión quedaba en `B=false`.
- Cuando la respuesta de modify volvía sin B (o parcial), frontend aceptaba ese estado y reemplazaba la evaluación anterior, perdiendo B silenciosamente.

## Archivos cambiados

### 1) Política compartida de versiones y guardrail de merge
- `src/services/evaluations/requestedVersionsPolicy.ts` (nuevo)
  - `decideRequestedVersionsForModify(...)`:
    - Fuerza `A=true`.
    - `B=true` si se cumple al menos una:
      - ya existía B en `currentEvaluationSpec`/estado previo,
      - `currentRequestedVersions.B` era true,
      - `evaluationDesignPlan.triggers.versionB` es true,
      - hay estudiantes asignados a B en `assignmentByStudentId`/`studentAssignments`,
      - hay señales de adecuación de contenido en estudiantes del contexto.
    - `C` aplica la misma lógica de preservación/señales para evitar regresión equivalente.
  - `applyModifyCarryForward(...)`:
    - Si la respuesta nueva pierde B pero la evaluación previa la tenía, y **no hubo remoción explícita**, hace carry-forward.
    - Restaura `requestedVersions.B=true`, `versionVariants.B` y `promptB` por `item.id` cuando faltan.
    - Emite `console.warn` con `requestId`.

### 2) Hook de pipeline (requests modify v2)
- `src/features/evaluaciones/hooks/useEvaluationPipeline.ts`
  - Ahora el request a `modify-evaluation-v2` incluye `requestedVersions` calculado por política compartida.
  - Se preservan triggers/asignaciones/reminders existentes en `evaluation_design_plan` (sin recortes de plan).

### 3) Panel de ajustes (modify/regenerate manual)
- `src/components/evaluaciones/v2/EvaluationAdjustmentsPanel.tsx`
  - Calcula `requestedVersions` con política compartida usando:
    - estado v2 actual,
    - `evaluationDesignPlan`,
    - `groupContext.students`.
  - Envía `requestedVersions` explícito en el payload de `modify-evaluation-v2`.
  - Aplica guardrail `applyModifyCarryForward` antes de actualizar UI para evitar pérdida silenciosa de B.
  - Mantiene `evaluation_design_plan` completo cuando está disponible (asignaciones/reminders/triggers no se pierden).

### 4) Backend v2 (decisión robusta de requestedVersions)
- `supabase/functions/modify-evaluation-v2/index.ts`
  - Nueva función exportada `computeRequestedVersionsForModify(...)`.
  - En `mode=adjust`/`generate`, la decisión de versiones ahora considera:
    - `requestedVersions` enviado por cliente,
    - presencia previa de `versionVariants.B/C` en `currentEvaluationSpec`,
    - adaptación declarada,
    - triggers del design plan.
  - Esto evita que B se apague por defaults incompletos del request.

## Nuevas reglas de requestedVersions (B)
- **B = true** si:
  1. ya existía en evaluación actual, o
  2. el plan/asignaciones la requieren, o
  3. hay consideraciones de adaptación de contenido, o
  4. cliente la solicita explícitamente.
- **B = false** sólo cuando no hay ninguna señal anterior, ni requerimiento, ni solicitud explícita.
- Remoción explícita queda reservada a una señal explícita de producto (no por default).

## Tests agregados

### Frontend (unit tests manuales)
- `src/services/evaluations/__tests__/requestedVersionsPolicy.test.ts`
  - Cubre decisión de `requestedVersions.B`.
  - Cubre guardrail de carry-forward de B.
  - Cubre caso de remoción explícita (no carry-forward).

### Backend (Deno tests)
- `supabase/functions/modify-evaluation-v2/__tests__/requestedVersionsPolicy.test.ts`
  - Cubre preservación de B por `currentEvaluationSpec`.
  - Cubre activación por adaptación declarada.
  - Cubre `B=false` cuando no hay señales.

## QA manual sugerido
1. Generar evaluación con B presente (estudiantes con adaptación de contenido o trigger B).
2. Abrir “Solicitar ajustes” y aplicar cambios con `targetVersions=all`.
3. Verificar en respuesta/UI:
   - `requestedVersions.B === true`,
   - selector/render de versión B sigue disponible,
   - consignas B (`promptB`) siguen presentes.
4. Repetir con ajustes sólo en versión A (`targetVersions=A`) y confirmar que B no desaparece.
5. Forzar respuesta parcial (simular backend sin B) y verificar warning de carry-forward con `requestId` en consola + persistencia visual de B.

## Edge cases
- **Remoción explícita de B**: el guardrail respeta remoción explícita (no hace carry-forward).
- **Respuesta parcial del backend**: frontend protege contra pérdida silenciosa de B mientras no haya remoción explícita.
- **Fallback v2→v1**: no se modifica (permanece deshabilitado según configuración vigente).
- **ULTRA_LITE CPU-safe**: no se alteró la lógica de bundling/materiales.
