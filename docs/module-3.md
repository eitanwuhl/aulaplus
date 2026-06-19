# Módulo 3 — Planificación de clase (wizard de sesiones)

Genera **planificaciones por sesión** con IA a partir del contexto del grupo, unidades didácticas y (opcionalmente) el programa anual (M2).

## Flujo docente

1. **Planificación de Clase** → `/planificacion` → **Asistente de Planificación**.
2. **Paso 0 — Contexto:** grupo, materia, tipo:
   - *Período específico* (fechas + horario semanal), o
   - *Sin período* (cantidad de sesiones en backlog).
3. **Paso 1 — Horario** (solo con período): bloques por día, horas semanales.
4. **Paso 2 — Enfoque:** unidades didácticas, import desde programa anual aprobado, materiales por unidad/plan, modalidades, requerimientos.
5. **Paso 3 — Resumen:** crear planificación → sesiones en DB → generación batch IA → **workspace** `/planificacion/:id`.
6. **Guardar sesión** en workspace (`is_saved = true`) para que aparezca en **Mis Planificaciones**.

## Integración M2

| Acción | Detalle |
|--------|---------|
| Import en wizard | Banner + deep link `?grupo=&materia=&programa=` |
| Persistencia | `planificaciones.programa_id` |
| Programa → en uso | Al crear plan desde programa **aprobado**, pasa a `en_uso` |
| Workspace | Banner con enlace al programa anual |

## Base de datos

| Tabla / columna | Rol |
|-----------------|-----|
| `planificaciones` | Periodo, unidades, horario, `programa_id`, `unit_material_plan`, `is_saved` |
| `sesiones_clase` | Sesiones (`backlog` \| `planificada` \| `dictada` \| …), `plan_desarrollo`, `session_brief` |

## IA

- Edge: `generate-plan-completo`
- Contrato: `{ plan_html, argumento_competencias, recursos, titulo, ai_design_report }`
- HTML: `<section id="plan">` con H1/H2
- Invocación autenticada: `invokeGeneratePlanCompleto` (`src/services/planning/generatePlanCompleto.ts`)

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/planificacion` | Landing (programa anual, asistente, mis planificaciones) |
| `/planificacion/nuevo` | Wizard 4 pasos |
| `/planificacion/:id` | Workspace (calendario, backlog, editor) |
| `/mis-planificaciones` | Solo `is_saved = true` y no borradas |

## Código principal

- `src/pages/PlanificacionWizard.tsx` — wizard + creación + batch IA
- `src/pages/PlanificacionWorkspace.tsx` — edición y calendario
- `src/components/planificacion/WizardSteps.tsx` — UI pasos
- `src/lib/planificacion/wizardValidation.ts` — validación
- `src/lib/planificacion/buildPlanificacionInsert.ts` — payload DB
- `src/lib/planificacion/planificacionDates.ts` — fechas (sin período → ventana simbólica)
- `src/services/planning/` — generación IA, lifecycle M2

## Tests

```bash
npm test -- src/lib/planificacion src/services/planning src/lib/dates
```

| Archivo | Cubre |
|---------|--------|
| `wizardValidation.test.ts` | Pasos 0–3, período vs sin período |
| `planificacionDates.test.ts` | Fechas simbólicas / período |
| `buildPlanificacionInsert.test.ts` | Payload DB + `programa_id` |
| `buildSesionesInsert.test.ts` | Sesiones backlog vs calendario |
| `wizardFlow.integration.test.ts` | Flujo validate → insert → sesiones |
| `planificacionLifecycle.service.test.ts` | `markProgramaEnUsoIfApproved` |
| `generatePlanCompleto.test.ts` | IA autenticada, timeout, errores |
| `sessionUnitContext.test.ts` | Unidad → sesión |
| `localDate.test.ts` | Parsing local YYYY-MM-DD |

## Deploy

```bash
npx supabase db push
npm run supabase:deploy:plans   # edge generate-plan-completo
npm run build
```
