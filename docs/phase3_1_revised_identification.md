# Phase 3.1 (Revised) - Identification of Configuration Screen Components

## 1. Configuration Screen Component

**File**: `src/components/planificacion/WizardSteps.tsx`

**Function**: `renderPaso2()` (lines 776-937)

This is the lesson planning configuration screen where teachers configure:
- Didactic units (`UnidadDidacticaBuilder`)
- Modality distribution (`ModalityDistribution`)
- Teacher requirements ("Requerimientos del Docente para la Planificación")
- Differentiation strategies ("Estrategias de Diferenciación")

**Current State**: There is already a Phase 3.1 implementation (lines 841-895), but it has a bug: it returns `null` when `totalSesiones === 0`, which violates the requirement that the section must still appear with a guidance message.

---

## 2. "Requerimientos del Docente" Field Component

**File**: `src/components/planificacion/WizardSteps.tsx`

**Location**: Lines 897-915

```897:915:src/components/planificacion/WizardSteps.tsx
      {/* Requerimientos del Docente */}
      <Card>
        <CardHeader>
          <CardTitle>Requerimientos del Docente para la Planificación</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanningTextArea
            value={wizardData.enfoque?.requerimientos_docente || ''}
            onChange={(value) => 
              onUpdateEnfoque({ 
                ...wizardData.enfoque, 
                requerimientos_docente: value 
              })
            }
            placeholder="Describe cualquier requerimiento específico que tengas para esta planificación (opcional)..."
            minHeight="min-h-24"
          />
        </CardContent>
      </Card>
```

**Placement Requirement**: The Session Brief section must appear **immediately before** this Card.

---

## 3. State/Type Definition File

**File**: `src/types/planificacion.ts`

**Interface**: `WizardData['enfoque']` (lines 129-137)

```129:137:src/types/planificacion.ts
  enfoque?: {
    unidades_didacticas: UnidadDidactica[];
    requerimientos_docente: string;
    distribucion_modalidades: DistribucionModalidades;
    estrategias_diferenciacion: string;
    objetivos_unidad?: string;
    // PHASE 3.1: Optional per-session focus/title overrides
    sessionBriefs?: (string | undefined)[];
  };
```

**Status**: ✅ Already includes `sessionBriefs?: (string | undefined)[]`

---

## 4. Automatic Generation Function

**File**: `src/pages/PlanificacionWizard.tsx`

**Function**: `generarPlanesAutomaticamente` (lines 89-320)

**Signature**:
```typescript
const generarPlanesAutomaticamente = async (
  planificacionId: string, 
  materia: string, 
  nivel: string,
  sessionBriefs?: (string | undefined)[]  // PHASE 3.1: Optional per-session focus overrides
) => { /* ... */ }
```

**Payload Construction** (lines 220-238):
```typescript
// PHASE 3.1: Extract sessionBrief from UI state
const sessionBrief = sessionBriefsArray[i]?.trim();

const payload = {
  modo: 'generar_plan_html',
  sesionId: sesion.id,
  orden: sesion.orden,
  duracionMin: sesion.duracion_minutos,
  materia: materia || 'Sin especificar',
  nivel: nivel || 'Sin especificar',
  contenidos: contenidosSesion,
  competencias: competenciasSesion,
  criterios: criterios,
  instruccionesDocente: planificacion.requerimientos_docente || undefined,
  unitContext: unitContext,
  // PHASE 3: Include sessionBrief if provided (non-empty, trimmed)
  ...(sessionBrief?.trim() && { sessionBrief: sessionBrief.trim() })
};
```

**Status**: ✅ Already correctly implemented

**Call Sites**:
1. `handleFinish` (line 626-630): ✅ Already passes `wizardData.enfoque?.sessionBriefs`
2. `handleRetryGeneration` (line 405-409): ❌ **MISSING** - Does not pass `sessionBriefs`

---

## Summary of Required Changes

1. **Fix UI in `WizardSteps.tsx`**: Show Session Brief section even when `totalSesiones === 0` with guidance message
2. **Fix `handleRetryGeneration` in `PlanificacionWizard.tsx`**: Pass `sessionBriefs` parameter
3. **Verify backward compatibility**: Empty `sessionBriefs` should not break existing behavior



















