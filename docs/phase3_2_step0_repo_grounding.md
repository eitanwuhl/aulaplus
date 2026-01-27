# Phase 3.2 - Step 0: Repository Grounding

## Sessions Table

**Table Name**: `sesiones_clase`

**Link to Planning**: `sesiones_clase.planificacion_id` (FK → `planificaciones.id`)

**Schema Location**: `supabase/migrations/20250923163758_55c12a12-40c6-4eac-8b92-032b9e90ec85.sql`

---

## Create Sessions

### Location: `src/pages/PlanificacionWizard.tsx`

**Function**: `handleFinish` (lines 435-672)

**Two paths**:

1. **Sin período (backlog)** - Lines 555-568:
   ```typescript
   const { error: sesionesError } = await supabase
     .from('sesiones_clase')
     .insert(sesionesBacklog);
   ```

2. **Período específico (calendar)** - Lines 600-602:
   ```typescript
   const { error: sesionesError } = await supabase
     .from('sesiones_clase')
     .insert(sesionesCalendario);
   ```

**Session Structure** (from lines 575-597):
```typescript
{
  planificacion_id: planificacion.id,
  fecha: fecha.toISOString().split('T')[0], // or null for backlog
  orden: index + 1,
  estado: 'planificada' as const,
  duracion_minutos: duracion,
  competencias_anep: [],
  contenidos_anep: [],
  criterios_logro_anep: [],
  plan_desarrollo: {},
  evaluacion: { tipo: 'observacion' as const },
  recursos: [],
  es_feriado: false,
  bloqueo_reserva: false
}
```

**Note**: Sessions are created **before** calling `generarPlanesAutomaticamente`.

---

## Fetch Sessions

### Location 1: `src/pages/PlanificacionWizard.tsx`

**Function**: `generarPlanesAutomaticamente` (lines 111-115)

```typescript
const { data: sesiones, error: sesionesError } = await supabase
  .from('sesiones_clase')
  .select('*')
  .eq('planificacion_id', planificacionId)
  .order('orden');
```

**Purpose**: Fetch sessions ordered by `orden` for plan generation.

---

### Location 2: `src/hooks/useCalendarioSesiones.ts`

**Function**: `cargarSesiones` (lines 15-46)

```typescript
const { data, error } = await supabase
  .from('sesiones_clase')
  .select('*')
  .eq('planificacion_id', planificacionId)
  .order('fecha', { ascending: true });
```

**Purpose**: Load sessions for calendar view in workspace.

---

### Location 3: `src/pages/MisPlanificaciones.tsx`

**Function**: `cargarDatos` (lines 178-181)

```typescript
const { data: sesionData, error: sesionError } = await supabase
  .from('sesiones_clase')
  .select('*')
  .order('fecha', { ascending: false });
```

**Purpose**: Load all sessions for list view.

---

## Update Sessions

### Location 1: `src/pages/PlanificacionWizard.tsx`

**Function**: `generarPlanesAutomaticamente` (lines 275-285)

```typescript
const { error: updateError } = await supabase
  .from('sesiones_clase')
  .update({
    plan_desarrollo: { html_completo: data.plan_html },
    argumento_competencias: data.argumento_competencias,
    recursos: normalizeArrayField(data.recursos),
    contenidos_anep: normalizeArrayField(contenidosSesion),
    competencias_anep: normalizeArrayField(competenciasSesion),
    criterios_logro_anep: normalizeArrayField(criterios)
  })
  .eq('id', sesion.id);
```

**Purpose**: Update session with generated plan content.

---

### Location 2: `src/hooks/useCalendarioSesiones.ts`

**Function**: `actualizarSesion` (lines 107-151)

```typescript
const { data, error } = await supabase
  .from('sesiones_clase')
  .update(updates)
  .eq('id', sesionId)
  .select();
```

**Purpose**: Update session from workspace editor.

---

## Type Definitions

### Location: `src/types/planificacion.ts`

**Interface**: `SesionClase` (lines 62-88)

```typescript
export interface SesionClase {
  id: string;
  planificacion_id: string;
  fecha: string | null;
  duracion_minutos: number;
  competencias_anep: string[];
  contenidos_anep: string[];
  criterios_logro_anep: string[];
  plan_desarrollo: PlanDesarrollo;
  diferenciacion?: string;
  evaluacion: Evaluacion;
  recursos: string[];
  observaciones?: string;
  estado: 'backlog' | 'planificada' | 'dictada' | 'omitida' | 'pausada';
  es_feriado: boolean;
  motivo_excepcion?: string;
  orden: number;
  semana_objetivo?: number;
  bloque_preferido?: any;
  bloqueo_reserva: boolean;
  motivo_cambio?: string;
  argumento_competencias?: string;
  titulo?: string;
  evaluacion_docente?: string;
  created_at: string;
  updated_at: string;
}
```

**Note**: `session_brief` field does NOT exist yet (to be added in Step 1).

---

### Location: `src/integrations/supabase/types.ts`

**Table Definition**: `sesiones_clase` (lines 230-315)

**Note**: Auto-generated types. Will need regeneration after migration.

---

## Wizard Loading Existing Planning

**Status**: ❌ **NOT IMPLEMENTED**

The wizard (`PlanificacionWizard.tsx`) does NOT load existing planifications for editing. It only creates new ones.

**Implication for Phase 3.2**: 
- Step 3 (Load persisted briefs when editing) may not be applicable to the wizard flow.
- However, if sessions are regenerated via `handleRetryGeneration`, we should load briefs from DB.

---

## Summary

| Operation | File | Function | Order By |
|-----------|------|----------|----------|
| **Create** | `src/pages/PlanificacionWizard.tsx` | `handleFinish` | N/A (insert) |
| **Fetch (generation)** | `src/pages/PlanificacionWizard.tsx` | `generarPlanesAutomaticamente` | `orden` ASC |
| **Fetch (workspace)** | `src/hooks/useCalendarioSesiones.ts` | `cargarSesiones` | `fecha` ASC |
| **Update (generation)** | `src/pages/PlanificacionWizard.tsx` | `generarPlanesAutomaticamente` | N/A (by id) |
| **Update (workspace)** | `src/hooks/useCalendarioSesiones.ts` | `actualizarSesion` | N/A (by id) |

**Key Finding**: Sessions are always ordered by `orden` when fetched for generation, which matches the `sessionBriefs` array index mapping (`index = orden - 1`).















