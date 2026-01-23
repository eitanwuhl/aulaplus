# Phase 1 Design: Mapeo Determinístico de Unidades a Sesiones

**Fecha**: 26 de diciembre de 2024  
**Objetivo**: Reemplazar rotación circular de unidades con mapeo determinístico basado en `clases_estimadas`  
**Alcance**: Solo lógica de asignación, sin cambios en BD ni prompts de IA

---

## A. ANÁLISIS DEL FLUJO ACTUAL

### A.1 Determinación del Total de Sesiones

**Ubicación**: `src/pages/PlanificacionWizard.tsx`

**Modo "sin_periodo"** (líneas 396-433):
- Total de sesiones = `wizardData.contexto.cantidad_sesiones`
- Se crean sesiones en backlog (sin fecha)
- **NO se usa `clases_estimadas`**

**Modo "periodo_especifico"** (líneas 435-479):
- Total de sesiones = resultado de `generarSesionesEsquema()`
- `generarSesionesEsquema()` está en `src/hooks/usePlanificacionWizard.ts` (líneas 277-311)
- Calcula fechas basándose en:
  - `fecha_inicio` y `fecha_fin`
  - `configuracion_horario` (días de la semana con clase)
- **NO se usa `clases_estimadas`**

**Función clave**: `generarSesionesEsquema()` retorna `Date[]` con todas las fechas donde hay clase según el horario.

### A.2 Generación del Array `fechasSesiones`

**Ubicación**: `src/hooks/useFullSessionGeneration.ts` (línea 15)

```typescript
const generateAllSessions = async ({ planificacion, fechasSesiones }: SessionGenerationContext)
```

**Origen de `fechasSesiones`**:
- En modo "periodo_especifico": viene de `generarSesionesEsquema()` (llamado en `PlanificacionWizard.tsx:437`)
- En modo "sin_periodo": NO se usa `useFullSessionGeneration`, se crean sesiones directamente en BD (líneas 403-421)

**Nota**: `useFullSessionGeneration` solo se usa cuando se generan planes con IA después de crear las sesiones. Las sesiones se crean primero sin contenido.

### A.3 Asignación Actual de Unidades a Sesiones (ROTACIÓN)

**Ubicación**: `src/hooks/useFullSessionGeneration.ts` (líneas 34-39)

```typescript
const sessionPromises = fechasSesiones.map(async (fecha, index) => {
  // Rotar unidades didácticas
  const unidadIndex = unidadesDidacticas.length > 0 
    ? Math.floor(index / Math.ceil(fechasSesiones.length / unidadesDidacticas.length))
    : 0;
  const unidad = unidadesDidacticas[unidadIndex] || { contenido_texto: 'Contenido general', competencias_ids: [] };
```

**Algoritmo actual**:
- Calcula cuántas veces debe repetirse cada unidad: `Math.ceil(fechasSesiones.length / unidadesDidacticas.length)`
- Asigna unidad usando: `Math.floor(index / repeticiones)`
- **Ejemplo**: 3 unidades, 9 sesiones → cada unidad aparece 3 veces
- **Problema**: No respeta `clases_estimadas` de cada unidad

### A.4 Llamada al Generador de Planes IA

**Ubicación**: `src/hooks/useFullSessionGeneration.ts` (líneas 45-55)

```typescript
const planDesarrollo = await generateAIPlan({
  materia: planificacion.materia,
  contenido: unidad?.contenido_texto || 'Contenido general',
  competencias: competenciasAll,
  modalidad: modalidadesDistribuidas[index],
  duracionMinutos: duracionReal,
  diferenciacion: planificacion.estrategias_diferenciacion,
  grupoId: planificacion.grupo_id,
  sesionNumero: index + 1,  // ← Solo número global
  totalSesiones: fechasSesiones.length
});
```

**Parámetros actuales**:
- `sesionNumero`: número global (1, 2, 3...)
- `totalSesiones`: total de sesiones
- **NO incluye**: `unidadIndex`, `claseEnUnidad`, `totalClasesUnidad`

---

## B. DISEÑO PROPUESTO

### B.1 Algoritmo de Expansión de Unidades

**Función nueva**: `expandUnitsToSessionPlan()`

```typescript
interface ExpandedUnitAssignment {
  unidadIndex: number;        // Índice en array original de unidades
  unidadId: string;           // ID de la unidad
  contenido_texto: string;
  competencias_ids: string[];
  claseEnUnidad: number;      // 1..N (número de clase dentro de esta unidad)
  totalClasesUnidad: number;  // N (total de clases estimadas para esta unidad)
}

function expandUnitsToSessionPlan(
  unidades: UnidadDidactica[]
): ExpandedUnitAssignment[] {
  const expanded: ExpandedUnitAssignment[] = [];
  
  for (const unidad of unidades) {
    const totalClases = unidad.clases_estimadas || 1; // Default: 1 si no está definido
    
    for (let claseNum = 1; claseNum <= totalClases; claseNum++) {
      expanded.push({
        unidadIndex: unidades.indexOf(unidad),
        unidadId: unidad.id,
        contenido_texto: unidad.contenido_texto,
        competencias_ids: unidad.competencias_ids,
        claseEnUnidad: claseNum,
        totalClasesUnidad: totalClases
      });
    }
  }
  
  return expanded;
}
```

**Ejemplo**:
```typescript
unidades = [
  { id: "u1", contenido_texto: "Batllismo", clases_estimadas: 3 },
  { id: "u2", contenido_texto: "Otra", clases_estimadas: 2 }
]

expanded = [
  { unidadIndex: 0, unidadId: "u1", contenido_texto: "Batllismo", claseEnUnidad: 1, totalClasesUnidad: 3 },
  { unidadIndex: 0, unidadId: "u1", contenido_texto: "Batllismo", claseEnUnidad: 2, totalClasesUnidad: 3 },
  { unidadIndex: 0, unidadId: "u1", contenido_texto: "Batllismo", claseEnUnidad: 3, totalClasesUnidad: 3 },
  { unidadIndex: 1, unidadId: "u2", contenido_texto: "Otra", claseEnUnidad: 1, totalClasesUnidad: 2 },
  { unidadIndex: 1, unidadId: "u2", contenido_texto: "Otra", claseEnUnidad: 2, totalClasesUnidad: 2 }
]
```

### B.2 Política para Mismatches: Sesiones > Clases Estimadas

**Caso**: `fechasSesiones.length > sum(clases_estimadas)`

**Política propuesta**: **Repetir última unidad con clases de "repaso/proyecto"**

**Justificación**:
- Es común tener sesiones adicionales para repaso, evaluación, o proyectos
- La última unidad es la más reciente, así que tiene sentido repasarla
- Es menos disruptivo que distribuir sesiones aleatorias

**Algoritmo**:
```typescript
function mapSessionsToUnits(
  fechasSesiones: Date[],
  expandedPlan: ExpandedUnitAssignment[]
): (ExpandedUnitAssignment | null)[] {
  const totalSlots = fechasSesiones.length;
  const totalExpanded = expandedPlan.length;
  
  if (totalSlots <= totalExpanded) {
    // Caso normal o truncado (ver B.3)
    return expandedPlan.slice(0, totalSlots);
  }
  
  // Caso: más sesiones que clases estimadas
  const remaining = totalSlots - totalExpanded;
  const lastUnit = expandedPlan[expandedPlan.length - 1];
  
  // Crear sesiones adicionales marcadas como "repaso"
  const additionalSessions: ExpandedUnitAssignment[] = [];
  for (let i = 1; i <= remaining; i++) {
    additionalSessions.push({
      ...lastUnit,
      claseEnUnidad: lastUnit.totalClasesUnidad + i, // Clase 4, 5, 6...
      // Nota: totalClasesUnidad se mantiene igual para mantener contexto
    });
  }
  
  return [...expandedPlan, ...additionalSessions];
}
```

**Alternativa considerada y descartada**:
- ❌ Distribuir sesiones restantes entre todas las unidades: demasiado complejo y poco predecible
- ❌ Dejar sesiones como "genéricas": rompe el flujo de asignación determinística

### B.3 Política para Mismatches: Sesiones < Clases Estimadas

**Caso**: `fechasSesiones.length < sum(clases_estimadas)`

**Política propuesta**: **Truncar desde el final (últimas clases se omiten)**

**Justificación**:
- Es más seguro truncar que intentar "comprimir" contenido
- Las primeras clases de cada unidad son más importantes (introducción, fundamentos)
- El docente puede ajustar `clases_estimadas` si nota que faltan sesiones

**Algoritmo**:
```typescript
// Ya incluido en mapSessionsToUnits:
if (totalSlots <= totalExpanded) {
  return expandedPlan.slice(0, totalSlots); // Trunca desde el final
}
```

**Comportamiento**:
- Si hay 2 unidades (3 y 2 clases) = 5 clases totales, pero solo 3 sesiones disponibles
- Se asignan: Unidad 1 clase 1, Unidad 1 clase 2, Unidad 1 clase 3
- Se omiten: Unidad 1 clase 4, Unidad 2 clase 1, Unidad 2 clase 2

**Nota**: En Phase 1, no se muestra advertencia al docente. En fases futuras se podría agregar validación en el wizard.

### B.4 Caso Especial: Sin Unidades o Unidades Vacías

**Caso**: `unidades.length === 0` o todas tienen `clases_estimadas === 0`

**Política propuesta**: **Fallback a contenido genérico**

```typescript
if (expandedPlan.length === 0) {
  // Crear sesiones con contenido genérico
  return fechasSesiones.map(() => ({
    unidadIndex: -1,
    unidadId: '',
    contenido_texto: 'Contenido general',
    competencias_ids: [],
    claseEnUnidad: 1,
    totalClasesUnidad: 1
  }));
}
```

**Comportamiento actual**: Ya existe este fallback en línea 39 de `useFullSessionGeneration.ts`, se mantiene igual.

---

## C. ALMACENAMIENTO DE METADATA (Phase 1)

### C.1 Dónde Calcular Metadata

**Ubicación**: `src/hooks/useFullSessionGeneration.ts`

**Función modificada**: `generateAllSessions()`

**Flujo propuesto**:
1. Expandir unidades usando `expandUnitsToSessionPlan()`
2. Mapear sesiones usando `mapSessionsToUnits()`
3. Para cada sesión, incluir metadata en el objeto `SesionClase` temporal (antes de guardar en BD)

### C.2 Dónde Almacenar Metadata (Sin Cambios en BD)

**Opción 1: Campo `observaciones` (TEXT, nullable)**
- ✅ Ya existe en `sesiones_clase`
- ✅ No requiere migración
- ❌ No es estructurado (sería JSON string)
- ❌ Podría confundirse con observaciones del docente

**Opción 2: Campo `plan_desarrollo` (JSONB)**
- ✅ Ya existe y es JSONB (permite estructura)
- ✅ No requiere migración
- ✅ Se puede agregar metadata sin romper estructura existente
- ❌ Mezcla metadata de asignación con contenido del plan

**Opción 3: Variable en memoria durante generación**
- ✅ Más limpio para Phase 1
- ✅ No contamina BD
- ❌ Se pierde después de generar
- ✅ Se puede pasar a `generateAIPlan()` para Phase 2

**Decisión para Phase 1**: **Opción 3 (variable en memoria)**

**Justificación**:
- Phase 1 solo necesita calcular y pasar metadata a `generateAIPlan()`
- No necesitamos persistir hasta Phase 2 (cuando se usará en prompts)
- Mantiene BD limpia y permite iterar sin migraciones

### C.3 Estructura de Metadata en Memoria

```typescript
interface UnitAssignmentMetadata {
  unidadIndex: number;
  unidadId: string;
  claseEnUnidad: number;
  totalClasesUnidad: number;
  esRepaso?: boolean; // true si es sesión adicional (slots > expanded)
}

// Se calcula en generateAllSessions y se pasa a generateAIPlan
const assignment = mapSessionsToUnits(fechasSesiones, expandedPlan)[index];
```

### C.4 Transporte de Metadata a `generateAIPlan()`

**Modificación propuesta en `generateAIPlan()`**:

```typescript
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
  // NUEVO para Phase 1 (aunque no se use en prompt hasta Phase 2):
  unitAssignment?: UnitAssignmentMetadata;
}) {
  // En Phase 1, solo se recibe pero no se usa en el prompt
  // En Phase 2, se incluirá en el prompt de IA
}
```

---

## D. ARCHIVOS A MODIFICAR (Lista para Implementación Futura)

### D.1 Archivos Principales

1. **`src/hooks/useFullSessionGeneration.ts`**
   - Agregar función `expandUnitsToSessionPlan()`
   - Agregar función `mapSessionsToUnits()`
   - Modificar `generateAllSessions()` para usar mapeo determinístico
   - Modificar llamada a `generateAIPlan()` para incluir `unitAssignment`

2. **`src/types/planificacion.ts`** (opcional, para TypeScript)
   - Agregar interfaz `UnitAssignmentMetadata` si se quiere tipado estricto

### D.2 Archivos que NO se Modifican en Phase 1

- ❌ `src/pages/PlanificacionWizard.tsx`: No cambia (solo crea sesiones vacías)
- ❌ `src/hooks/usePlanificacionWizard.ts`: No cambia (solo genera fechas)
- ❌ `supabase/functions/generate-plan-completo/index.ts`: No cambia (Phase 2)
- ❌ `src/pages/PlanificacionWorkspace.tsx`: No cambia (solo renderiza)
- ❌ Cualquier migración de BD: No se requiere

### D.3 Cambios Mínimos Requeridos

**Resumen**:
- 1 archivo principal: `useFullSessionGeneration.ts`
- 2 funciones nuevas: `expandUnitsToSessionPlan()`, `mapSessionsToUnits()`
- 1 función modificada: `generateAllSessions()`
- 1 función modificada: `generateAIPlan()` (solo firma, sin cambios en prompt)

---

## E. PLAN DE VERIFICACIÓN

### E.1 Caso 1: Mapeo Exacto (1 unidad, 3 clases, 3 sesiones)

**Setup**:
- Crear planificación con 1 unidad didáctica
- `clases_estimadas = 3`
- Total de sesiones = 3 (ajustar fechas o cantidad_sesiones)

**Verificación**:
1. ✅ Las 3 sesiones se asignan a la misma unidad
2. ✅ `claseEnUnidad` = 1, 2, 3 respectivamente
3. ✅ `totalClasesUnidad` = 3 para todas
4. ✅ `unidadIndex` = 0 para todas
5. ✅ No hay errores de TypeScript
6. ✅ El wizard completa sin errores
7. ✅ Las sesiones aparecen en el workspace

**Cómo verificar**:
- Agregar logs temporales en `generateAllSessions()`:
  ```typescript
  console.log('[PHASE1-DEBUG] Session', index, 'assignment:', assignment);
  ```
- Verificar en consola del navegador durante generación

### E.2 Caso 2: Múltiples Unidades (2 unidades: 3 y 1 clases, 4 sesiones)

**Setup**:
- Unidad A: `clases_estimadas = 3`
- Unidad B: `clases_estimadas = 1`
- Total de sesiones = 4

**Verificación**:
1. ✅ Sesiones 1-3: Unidad A, `claseEnUnidad` = 1, 2, 3
2. ✅ Sesión 4: Unidad B, `claseEnUnidad` = 1
3. ✅ `totalClasesUnidad` correcto para cada sesión
4. ✅ `unidadIndex` alterna correctamente (0, 0, 0, 1)

**Cómo verificar**:
- Mismo método de logs
- Verificar `contenidos_anep` en cada sesión (debe coincidir con unidad asignada)

### E.3 Caso 3a: Más Sesiones que Clases Estimadas

**Setup**:
- Unidad A: `clases_estimadas = 2`
- Unidad B: `clases_estimadas = 1`
- Total = 3 clases estimadas
- Total de sesiones = 5

**Verificación**:
1. ✅ Sesiones 1-2: Unidad A, clases 1-2
2. ✅ Sesión 3: Unidad B, clase 1
3. ✅ Sesiones 4-5: Unidad B (última), `claseEnUnidad` = 2, 3 (repaso)
4. ✅ `esRepaso = true` para sesiones 4-5 (si se implementa flag)
5. ✅ No hay errores

**Comportamiento esperado**:
- Las 2 sesiones adicionales se asignan a la última unidad (B)
- Se marcan como clases 2 y 3 de esa unidad (aunque originalmente tenía 1)

### E.3b: Menos Sesiones que Clases Estimadas

**Setup**:
- Unidad A: `clases_estimadas = 3`
- Unidad B: `clases_estimadas = 2`
- Total = 5 clases estimadas
- Total de sesiones = 3

**Verificación**:
1. ✅ Sesiones 1-3: Unidad A, clases 1-3
2. ✅ Unidad B NO aparece (truncada)
3. ✅ No hay errores
4. ✅ Las sesiones se crean correctamente

**Comportamiento esperado**:
- Se trunca desde el final
- Solo se asignan las primeras 3 clases (todas de Unidad A)
- Unidad B se omite completamente

### E.4 Caso 4: Sin Unidades

**Setup**:
- Crear planificación sin unidades didácticas
- Total de sesiones = 3

**Verificación**:
1. ✅ Todas las sesiones usan contenido genérico
2. ✅ `unidadIndex = -1` (o valor sentinel)
3. ✅ `claseEnUnidad = 1`, `totalClasesUnidad = 1`
4. ✅ No hay crashes

### E.5 Verificación de Compatibilidad

**Tests de regresión**:
1. ✅ `npm run build` sin errores de TypeScript
2. ✅ Wizard se completa sin errores
3. ✅ Workspace renderiza sesiones correctamente
4. ✅ Calendario muestra sesiones en fechas correctas
5. ✅ Backlog muestra sesiones sin fecha (modo "sin_periodo")
6. ✅ No se rompen flujos existentes de edición manual

**Archivos a verificar manualmente**:
- `src/pages/PlanificacionWizard.tsx`: Flujo de creación
- `src/pages/PlanificacionWorkspace.tsx`: Renderizado de sesiones
- `src/components/planificacion/EditorSesionNuevo.tsx`: Edición de sesiones

---

## F. RIESGOS Y ROLLBACK

### F.1 Riesgos Identificados

**Riesgo 1: Cambio de comportamiento visible**
- **Descripción**: Si el docente tenía expectativas sobre rotación, el cambio puede ser confuso
- **Mitigación**: El cambio es interno; la UI no cambia en Phase 1
- **Probabilidad**: Baja (cambio es determinístico y predecible)

**Riesgo 2: Mismatches causan sesiones "raras"**
- **Descripción**: Si hay muchas sesiones extra, todas van a última unidad
- **Mitigación**: Política clara documentada; en Phase 2 se puede mejorar con UI
- **Probabilidad**: Media (depende de uso real)

**Riesgo 3: Truncado silencioso**
- **Descripción**: Si faltan sesiones, se trunca sin aviso
- **Mitigación**: En Phase 1 es aceptable; Phase 2 puede agregar validación
- **Probabilidad**: Media

**Riesgo 4: Bugs en cálculo de índices**
- **Descripción**: Errores off-by-one o índices incorrectos
- **Mitigación**: Tests exhaustivos (Caso 1, 2, 3)
- **Probabilidad**: Baja (algoritmo simple)

### F.2 Plan de Rollback

**Si se detectan problemas críticos**:

1. **Revertir cambios en `useFullSessionGeneration.ts`**:
   ```bash
   git checkout HEAD -- src/hooks/useFullSessionGeneration.ts
   ```

2. **Verificar que rotación original funciona**:
   - Restaurar líneas 35-39 a versión original
   - Remover funciones `expandUnitsToSessionPlan()` y `mapSessionsToUnits()`

3. **No hay cambios en BD**: Rollback es inmediato sin migraciones

**Criterios para rollback**:
- Errores de TypeScript que no se pueden resolver rápidamente
- Crashes en generación de sesiones
- Comportamiento inesperado que rompe flujos existentes

---

## G. CHECKLIST PARA CURSOR (Comandos Locales)

### G.1 Pre-Implementación

```bash
# 1. Verificar que el proyecto compila
npm run build

# 2. Verificar que no hay errores de linting
npm run lint  # (si existe el comando)

# 3. Asegurar que estás en la rama correcta
git branch  # Debe mostrar: Aulaplus-by-eitan-2
```

### G.2 Durante Implementación (Logs Temporales)

**Ubicación para logs**: `src/hooks/useFullSessionGeneration.ts`

**Línea aproximada**: Después de calcular `assignment` en `generateAllSessions()`

```typescript
// TEMPORAL - REMOVER DESPUÉS DE VERIFICACIÓN
if (import.meta.env.DEV) {
  console.log('[PHASE1-DEBUG] Session', index + 1, 'assignment:', {
    unidadIndex: assignment.unidadIndex,
    unidadId: assignment.unidadId,
    contenido: assignment.contenido_texto,
    claseEnUnidad: assignment.claseEnUnidad,
    totalClasesUnidad: assignment.totalClasesUnidad
  });
}
```

**Cuándo remover**: Después de completar todos los casos de verificación (E.1-E.5)

### G.3 Post-Implementación

```bash
# 1. Verificar compilación
npm run build

# 2. Ejecutar tests manuales (ver sección E)
# 3. Verificar en navegador:
#    - Abrir DevTools Console
#    - Crear planificación de prueba
#    - Verificar logs [PHASE1-DEBUG]
#    - Confirmar asignaciones correctas

# 4. Limpiar logs temporales antes de commit
```

### G.4 Verificación de TypeScript

```bash
# Verificar tipos sin compilar
npx tsc --noEmit

# O si está configurado en package.json
npm run type-check  # (si existe)
```

---

## H. RESUMEN EJECUTIVO

### H.1 Cambios Principales

1. **Reemplazar rotación circular** con expansión determinística basada en `clases_estimadas`
2. **Calcular metadata** (`unidadIndex`, `claseEnUnidad`, `totalClasesUnidad`) en memoria
3. **Pasar metadata** a `generateAIPlan()` (aunque no se use en prompt hasta Phase 2)

### H.2 Archivos Afectados

- **1 archivo principal**: `src/hooks/useFullSessionGeneration.ts`
- **0 cambios en BD**: Todo en memoria
- **0 cambios en UI**: Comportamiento interno

### H.3 Políticas de Edge Cases

- **Más sesiones que clases**: Repetir última unidad (repaso)
- **Menos sesiones que clases**: Truncar desde el final
- **Sin unidades**: Fallback a contenido genérico

### H.4 Próximos Pasos (Phase 2)

- Incluir metadata en prompt de IA
- Agregar validación en wizard si hay mismatch
- Considerar persistir metadata en BD (campo nuevo o `plan_desarrollo`)

---

---

## I. ESTADO DE IMPLEMENTACIÓN

**Fecha de implementación**: 26 de diciembre de 2024  
**Estado**: ✅ COMPLETADO

### I.1 Archivos Modificados

1. **`src/hooks/useFullSessionGeneration.ts`**
   - ✅ Agregadas funciones `expandUnitsToSessionPlan()` y `mapSessionsToUnits()`
   - ✅ Modificado `generateAllSessions()` para usar mapeo determinístico
   - ✅ Modificado `generateAIPlan()` para aceptar `unitAssignment` (metadata)
   - ✅ Agregados logs DEV-only con resumen de asignaciones

2. **`src/pages/PlanificacionWizard.tsx`**
   - ✅ Agregadas funciones helper `expandUnitsToSessionPlan()` y `mapSessionsToUnits()` (duplicadas para scope local)
   - ✅ Modificado `generarPlanesAutomaticamente()` para usar mapeo determinístico
   - ✅ Asignación de contenidos y competencias basada en unidades expandidas

3. **`src/types/planificacion.ts`**
   - ✅ Agregada interfaz `UnitAssignmentMetadata` para metadata de asignación

### I.2 Paths de Generación Cubiertos

- ✅ **Path 1**: `useFullSessionGeneration.generateAllSessions()` - usado para periodo_especifico cuando se generan sesiones con planes desde el inicio
- ✅ **Path 2**: `generarPlanesAutomaticamente()` - usado después de crear sesiones vacías (tanto periodo_especifico como sin_periodo)

### I.3 Verificación

- ✅ `npm run build` pasa sin errores
- ✅ No hay errores de TypeScript
- ✅ Logs DEV-only implementados (resumen compacto, no ruidoso)

**Fin del Documento de Diseño - Phase 1**

