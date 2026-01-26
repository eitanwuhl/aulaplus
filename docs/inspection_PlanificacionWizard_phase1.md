# Inspection: PlanificacionWizard.tsx - Phase 1 Implementation

**File**: `src/pages/PlanificacionWizard.tsx`  
**Date**: 26 de diciembre de 2024  
**Inspection Type**: READ-ONLY

---

## 1. Function: `generarPlanesAutomaticamente()`

**Location**: Lines 88-320

---

## 2. Units Expansion Logic

**Location**: Lines 124-127

```typescript
// PHASE 1: Obtener unidades didácticas y aplicar mapeo determinístico
const unidadesDidacticas: UnidadDidactica[] = (planificacion.unidades_didacticas as any) || [];
const expandedPlan = expandUnitsToSessionPlan(unidadesDidacticas);
const sessionAssignments = mapSessionsToUnits(sesiones.length, expandedPlan);
```

**Key Observations**:
- ✅ Extracts `unidades_didacticas` from planificacion (with fallback to empty array)
- ✅ Calls `expandUnitsToSessionPlan()` - **same helper function as in useFullSessionGeneration.ts**
- ✅ Calls `mapSessionsToUnits()` - **same helper function as in useFullSessionGeneration.ts**

---

## 3. Helper Functions: Duplication Confirmation

### 3.1 `expandUnitsToSessionPlan()`

**Location**: Lines 19-46

**Full Implementation**:

```typescript
// PHASE 1: Helper para expandir unidades según clases_estimadas (reutilizable)
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

**Comparison with `useFullSessionGeneration.ts`**:
- ✅ **IDENTICAL implementation** (lines 138-165 in useFullSessionGeneration.ts)
- ✅ Same validation logic for `clases_estimadas`
- ✅ Same index-based loop structure

### 3.2 `mapSessionsToUnits()`

**Location**: Lines 48-86

**Full Implementation**:

```typescript
// PHASE 1: Helper para mapear sesiones a unidades expandidas (reutilizable)
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

**Comparison with `useFullSessionGeneration.ts`**:
- ✅ **IDENTICAL implementation** (lines 167-205 in useFullSessionGeneration.ts)
- ✅ Same edge case handling (empty, truncate, extend)

**Conclusion**: ✅ **Helper functions are DUPLICATED** (same logic in both files)

---

## 4. Deterministic Session Mapping

**Location**: Lines 170-174

```typescript
// Generar plan para cada sesión con reintentos
for (let i = 0; i < sesiones.length; i++) {
  const sesion = sesiones[i];
  
  // PHASE 1: Usar asignación determinística
  const assignment = sessionAssignments[i];
```

**Key Observations**:
- ✅ Uses `sessionAssignments[i]` - **direct array access by index**
- ✅ **NO uses rotation or `indexOf()`**
- ✅ Assignment is deterministic: same index always gets same assignment

---

## 5. Contents/Competencies Assignment Per Session

**Location**: Lines 173-189

```typescript
// PHASE 1: Usar asignación determinística
const assignment = sessionAssignments[i];

// Usar competencias de la unidad asignada, o todas si no hay específicas
const competenciasSesion = assignment.competencias_ids.length > 0
  ? assignment.competencias_ids
  : competencias;

// Usar contenido de la unidad asignada
const contenidosSesion = [assignment.contenido_texto];

console.log(`Sesión ${sesion.orden}:`, {
  contenido: assignment.contenido_texto.substring(0, 40),
  claseEnUnidad: assignment.claseEnUnidad,
  totalClasesUnidad: assignment.totalClasesUnidad,
  competencias: competenciasSesion.length
});
```

**Key Observations**:
- ✅ `contenidosSesion` = `[assignment.contenido_texto]` - **uses assignment content**
- ✅ `competenciasSesion` = `assignment.competencias_ids` (with fallback to all)
- ✅ Logs show `claseEnUnidad` and `totalClasesUnidad` - **confirms metadata is available**

### 5.1 Payload Construction

**Location**: Lines 202-213

```typescript
const payload = {
  modo: 'generar_plan_html',
  sesionId: sesion.id,
  orden: sesion.orden,
  duracionMin: sesion.duracion_minutos,
  materia: materia || 'Sin especificar',
  nivel: nivel || 'Sin especificar',
  contenidos: contenidosSesion, // PHASE 1: Usar contenido de unidad asignada
  competencias: competenciasSesion, // PHASE 1: Usar competencias de unidad asignada
  criterios: criterios,
  instruccionesDocente: undefined
};
```

**Key Observations**:
- ✅ `contenidos: contenidosSesion` - **uses assignment content**
- ✅ `competencias: competenciasSesion` - **uses assignment competencies**
- ✅ **NO includes `unitAssignment` in payload** (not sent to edge function)

### 5.2 Session Update

**Location**: Lines 250-260

```typescript
const { error: updateError } = await supabase
  .from('sesiones_clase')
  .update({
    plan_desarrollo: { html_completo: data.plan_html },
    argumento_competencias: data.argumento_competencias,
    recursos: normalizeArrayField(data.recursos),
    contenidos_anep: normalizeArrayField(contenidosSesion), // PHASE 1: Contenido de unidad asignada
    competencias_anep: normalizeArrayField(competenciasSesion),
    criterios_logro_anep: normalizeArrayField(criterios)
  })
  .eq('id', sesion.id);
```

**Key Observations**:
- ✅ `contenidos_anep: normalizeArrayField(contenidosSesion)` - **persists assignment content**
- ✅ `competencias_anep: normalizeArrayField(competenciasSesion)` - **persists assignment competencies**

---

## 6. Confirmation: `clases_estimadas` Respected

**Evidence**:

1. **Expansion uses `clases_estimadas`**:
   ```typescript
   const totalClases = (unidad.clases_estimadas && unidad.clases_estimadas > 0 && !isNaN(unidad.clases_estimadas))
     ? unidad.clases_estimadas
     : 1;
   ```
   - ✅ Validates and uses `unidad.clases_estimadas`
   - ✅ Defaults to 1 if invalid

2. **Loop creates entries per `clases_estimadas`**:
   ```typescript
   for (let claseNum = 1; claseNum <= totalClases; claseNum++) {
     expanded.push({ ... });
   }
   ```
   - ✅ Creates exactly `totalClases` entries per unit

3. **Logging confirms calculation**:
   ```typescript
   totalClasesEstimadas: unidadesDidacticas.reduce((sum, u) => sum + (u.clases_estimadas || 1), 0),
   ```
   - ✅ Logs total estimated classes

**Conclusion**: ✅ **`clases_estimadas` is FULLY RESPECTED** in this path

---

## Summary

✅ **All requirements met**:
1. ✅ Units are expanded using `expandUnitsToSessionPlan()` (duplicated helper)
2. ✅ Sessions are mapped deterministically using `mapSessionsToUnits()` (duplicated helper)
3. ✅ Contents/competencies assigned per session from `assignment`
4. ✅ Helper logic is **DUPLICATED** (same implementation as `useFullSessionGeneration.ts`)
5. ✅ `clases_estimadas` is **FULLY RESPECTED** (validated, used in expansion, logged)

**Note**: The duplication is intentional (as noted in implementation report) to avoid circular dependencies. Both paths use identical logic, ensuring consistency.














