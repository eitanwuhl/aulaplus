# Inspection: useFullSessionGeneration.ts - Phase 1 Implementation

**File**: `src/hooks/useFullSessionGeneration.ts`  
**Date**: 26 de diciembre de 2024  
**Inspection Type**: READ-ONLY

---

## 1. Function: `expandUnitsToSessionPlan`

**Location**: Lines 138-165

**Full Implementation**:

```typescript
// PHASE 1: Expandir unidades didácticas según clases_estimadas
function expandUnitsToSessionPlan(
  unidades: UnidadDidactica[]
): UnitAssignmentMetadata[] {
  const expanded: UnitAssignmentMetadata[] = [];
  
  for (let i = 0; i < unidades.length; i++) {
    const unidad = unidades[i];
    // Validar clases_estimadas: si es <= 0 o NaN, usar 1 como default
    const totalClases = (unidad.clases_estimadas && unidad.clases_estimadas > 0 && !isNaN(unidad.clases_estimadas))
      ? unidad.clases_estimadas
      : 1;
    
    for (let claseNum = 1; claseNum <= totalClases; claseNum++) {
      expanded.push({
        unidadIndex: i,
        unidadId: unidad.id,
        contenido_texto: unidad.contenido_texto,
        competencias_ids: unidad.competencias_ids || [],
        claseEnUnidad: claseNum,
        totalClasesUnidad: totalClases,
        isExtraSlot: false
      });
    }
  }
  
  return expanded;
}
```

**Key Observations**:
- ✅ Uses `for (let i = 0; i < unidades.length; i++)` - **index-based loop, NOT `indexOf()`**
- ✅ `unidadIndex: i` is set directly from loop index (stable)
- ✅ Validates `clases_estimadas` (must be > 0 and not NaN, defaults to 1)
- ✅ Creates sequential entries: claseEnUnidad = 1, 2, 3... for each unit

---

## 2. Function: `mapSessionsToUnits`

**Location**: Lines 167-205

**Full Implementation**:

```typescript
// PHASE 1: Mapear sesiones a unidades expandidas
function mapSessionsToUnits(
  totalSlots: number,
  expandedPlan: UnitAssignmentMetadata[]
): UnitAssignmentMetadata[] {
  if (expandedPlan.length === 0) {
    // Fallback: crear sesiones con contenido genérico
    return Array.from({ length: totalSlots }, () => ({
      unidadIndex: -1,
      unidadId: '',
      contenido_texto: 'Contenido general',
      competencias_ids: [],
      claseEnUnidad: 1,
      totalClasesUnidad: 1,
      isExtraSlot: false
    }));
  }
  
  if (totalSlots <= expandedPlan.length) {
    // Caso normal o truncado: usar las primeras totalSlots
    return expandedPlan.slice(0, totalSlots);
  }
  
  // Caso: más sesiones que clases estimadas
  // Repetir última unidad para sesiones adicionales
  const remaining = totalSlots - expandedPlan.length;
  const lastUnit = expandedPlan[expandedPlan.length - 1];
  
  const additionalSessions: UnitAssignmentMetadata[] = [];
  for (let i = 1; i <= remaining; i++) {
    additionalSessions.push({
      ...lastUnit,
      claseEnUnidad: lastUnit.totalClasesUnidad + i,
      isExtraSlot: true
    });
  }
  
  return [...expandedPlan, ...additionalSessions];
}
```

**Key Observations**:
- ✅ Handles 3 cases: empty plan (fallback), slots <= expanded (truncate), slots > expanded (repeat last)
- ✅ Uses `expandedPlan.slice(0, totalSlots)` for truncation (safe)
- ✅ For extra slots, spreads `...lastUnit` and increments `claseEnUnidad`
- ✅ Sets `isExtraSlot: true` for additional sessions

---

## 3. Relevant Portion of `generateAllSessions()`

### 3.1 Unit/Session Assignment Calculation

**Location**: Lines 26-31

```typescript
// Convertir unidades didácticas del JSON
const unidadesDidacticas: UnidadDidactica[] = ((planificacion as any).unidades_didacticas) || [];

// PHASE 1: Expandir unidades según clases_estimadas y mapear a sesiones
const expandedPlan = expandUnitsToSessionPlan(unidadesDidacticas);
const sessionAssignments = mapSessionsToUnits(fechasSesiones.length, expandedPlan);
```

**Key Observations**:
- ✅ Extracts `unidades_didacticas` from planificacion (with fallback to empty array)
- ✅ Calls `expandUnitsToSessionPlan()` first
- ✅ Then calls `mapSessionsToUnits()` with `fechasSesiones.length`

### 3.2 Assignment Selection Per Session

**Location**: Lines 61-63

```typescript
const sessionPromises = fechasSesiones.map(async (fecha, index) => {
  // PHASE 1: Usar asignación determinística en lugar de rotación
  const assignment = sessionAssignments[index];
```

**Key Observations**:
- ✅ Uses `sessionAssignments[index]` - **direct array access by index**
- ✅ **NO uses `indexOf()` or reference-based lookup**
- ✅ Assignment is deterministic: same index always gets same assignment

### 3.3 Usage of Assignment in Session Creation

**Location**: Lines 69-81, 84, 87-89, 96-97

```typescript
// Generar plan de desarrollo con IA
const planDesarrollo = await generateAIPlan({
  materia: planificacion.materia,
  contenido: assignment.contenido_texto,  // ← Uses assignment
  competencias: competenciasAll,
  modalidad: modalidadesDistribuidas[index],
  duracionMinutos: duracionReal,
  diferenciacion: planificacion.estrategias_diferenciacion,
  grupoId: planificacion.grupo_id,
  sesionNumero: index + 1,
  totalSesiones: fechasSesiones.length,
  // PHASE 1: Pasar metadata (aunque no se use en prompt hasta Phase 2)
  unitAssignment: assignment  // ← Passes full assignment metadata
});

// Generar recursos automáticamente basados en contenido
const recursos = generateResources(assignment.contenido_texto, planificacion.materia);  // ← Uses assignment

// Usar competencias de la unidad asignada si están disponibles, sino todas
const competenciasSesion = assignment.competencias_ids.length > 0
  ? assignment.competencias_ids
  : competenciasAll;  // ← Uses assignment

// ... later in return object:
competencias_anep: normalizeArrayField(competenciasSesion.slice(0, 3)),
contenidos_anep: normalizeArrayField([assignment.contenido_texto]),  // ← Uses assignment
```

**Key Observations**:
- ✅ `assignment.contenido_texto` used for AI plan generation
- ✅ `assignment.competencias_ids` used (with fallback to `competenciasAll`)
- ✅ `assignment` passed to `generateAIPlan()` as `unitAssignment`
- ✅ `assignment.contenido_texto` stored in `contenidos_anep`

---

## 4. Function Signature: `generateAIPlan()`

**Location**: Lines 234-247

**Full Signature**:

```typescript
// Generar plan de desarrollo con IA
async function generateAIPlan(params: {
  materia: string;
  contenido: string;
  competencias: string[];
  modalidad: string;
  duracionMinutos: number;
  diferenciacion?: string;
  grupoId: string;
  sesionNumero: number;
  totalSesiones: number;
  // PHASE 1: Metadata de asignación (no se usa en prompt hasta Phase 2)
  unitAssignment?: UnitAssignmentMetadata;
}) {
```

**Key Observations**:
- ✅ `unitAssignment` is **optional** (`unitAssignment?:`)
- ✅ Type is `UnitAssignmentMetadata | undefined`
- ✅ Comment indicates it's not used in prompt yet (reserved for Phase 2)

---

## 5. Check: Array.indexOf() Usage

**Search Results**: 
- ❌ **NOT FOUND** - No usage of `Array.indexOf()`, `unidades.indexOf()`, or similar reference-based indexing
- ✅ Uses index-based `for` loop: `for (let i = 0; i < unidades.length; i++)`
- ✅ Direct array access: `sessionAssignments[index]`
- ✅ Stable indices: `unidadIndex: i` set from loop counter

**Conclusion**: ✅ **Implementation is safe** - no reference-based indexing that could break with duplicate units.

---

## Summary

✅ **All requirements met**:
1. `expandUnitsToSessionPlan()` implemented with index-based loop
2. `mapSessionsToUnits()` handles all edge cases correctly
3. `generateAllSessions()` uses deterministic assignment
4. `generateAIPlan()` accepts `unitAssignment` (optional, not used yet)
5. **NO `indexOf()` usage** - all indexing is stable and deterministic













