# Phase 1 Implementation Report: Deterministic Unit→Session Mapping

**Fecha**: 26 de diciembre de 2024  
**Estado**: ✅ COMPLETADO  
**Branch**: `Aulaplus-by-eitan-2`

---

## Resumen Ejecutivo

Se implementó el mapeo determinístico de unidades didácticas a sesiones basado en `clases_estimadas`, reemplazando la rotación circular anterior. La implementación cubre ambos paths de generación de sesiones (periodo_especifico y sin_periodo) sin requerir cambios en la base de datos.

---

## Archivos Modificados

### 1. `src/types/planificacion.ts`

**Cambios**:
- Agregada interfaz `UnitAssignmentMetadata` para metadata de asignación unidad→sesión:
  ```typescript
  export interface UnitAssignmentMetadata {
    unidadIndex: number;        // Índice en array original
    unidadId: string;           // ID de la unidad
    contenido_texto: string;
    competencias_ids: string[];
    claseEnUnidad: number;      // 1..N
    totalClasesUnidad: number;  // N
    isExtraSlot?: boolean;      // true si es sesión adicional
  }
  ```

### 2. `src/hooks/useFullSessionGeneration.ts`

**Funciones agregadas**:
- `expandUnitsToSessionPlan(unidades: UnidadDidactica[]): UnitAssignmentMetadata[]`
  - Expande cada unidad según `clases_estimadas`
  - Valida que `clases_estimadas` sea > 0 y no NaN (default: 1)
  
- `mapSessionsToUnits(totalSlots: number, expandedPlan: UnitAssignmentMetadata[]): UnitAssignmentMetadata[]`
  - Mapea sesiones a unidades expandidas
  - Maneja casos: slots == expanded, slots < expanded (trunca), slots > expanded (repite última unidad)

**Funciones modificadas**:
- `generateAllSessions()`:
  - Reemplazada lógica de rotación (líneas 35-39) con mapeo determinístico
  - Usa `sessionAssignments` calculado desde unidades expandidas
  - Pasa `unitAssignment` a `generateAIPlan()`
  - Agregados logs DEV-only con resumen compacto

- `generateAIPlan()`:
  - Parámetro agregado: `unitAssignment?: UnitAssignmentMetadata`
  - Metadata recibida pero no usada en prompt (reservado para Phase 2)

**Líneas clave modificadas**:
- Líneas 26-33: Expansión y mapeo de unidades
- Líneas 35-40: Logs DEV-only
- Líneas 50-60: Uso de `assignment` en lugar de rotación
- Líneas 70-75: Pasar `unitAssignment` a `generateAIPlan()`

### 3. `src/pages/PlanificacionWizard.tsx`

**Funciones agregadas** (duplicadas para scope local):
- `expandUnitsToSessionPlan()` - misma lógica que en `useFullSessionGeneration.ts`
- `mapSessionsToUnits()` - misma lógica que en `useFullSessionGeneration.ts`

**Función modificada**:
- `generarPlanesAutomaticamente()`:
  - Obtiene `unidades_didacticas` de planificación
  - Aplica expansión y mapeo determinístico
  - Asigna contenidos y competencias según `sessionAssignments`
  - Actualiza `contenidos_anep` y `competencias_anep` de cada sesión con valores de unidad asignada
  - Agregados logs DEV-only

**Líneas clave modificadas**:
- Líneas 54-70: Expansión y mapeo de unidades
- Líneas 72-85: Uso de `assignment` para contenidos y competencias
- Líneas 97-108: Payload con contenidos y competencias de unidad asignada
- Líneas 142-152: Actualización de sesión con contenidos de unidad asignada

---

## Cobertura de Paths de Generación

### Path 1: `useFullSessionGeneration.generateAllSessions()`

**Cuándo se usa**:
- Cuando se generan sesiones con planes desde el inicio (periodo_especifico)
- Recibe `fechasSesiones: Date[]` y genera sesiones completas con planes IA

**Estado**: ✅ Implementado con mapeo determinístico

### Path 2: `generarPlanesAutomaticamente()`

**Cuándo se usa**:
- Después de crear sesiones vacías (tanto periodo_especifico como sin_periodo)
- Itera sobre sesiones existentes y les asigna contenidos/planes

**Estado**: ✅ Implementado con mapeo determinístico

**Nota**: Ambos paths ahora usan la misma lógica de mapeo, asegurando consistencia.

---

## Algoritmo de Mapeo Implementado

### Expansión de Unidades

```typescript
// Ejemplo:
unidades = [
  { contenido: "Batllismo", clases_estimadas: 3 },
  { contenido: "Otra", clases_estimadas: 2 }
]

expanded = [
  { unidadIndex: 0, contenido: "Batllismo", claseEnUnidad: 1, totalClasesUnidad: 3 },
  { unidadIndex: 0, contenido: "Batllismo", claseEnUnidad: 2, totalClasesUnidad: 3 },
  { unidadIndex: 0, contenido: "Batllismo", claseEnUnidad: 3, totalClasesUnidad: 3 },
  { unidadIndex: 1, contenido: "Otra", claseEnUnidad: 1, totalClasesUnidad: 2 },
  { unidadIndex: 1, contenido: "Otra", claseEnUnidad: 2, totalClasesUnidad: 2 }
]
```

### Políticas de Edge Cases

1. **Slots == Expanded**: Mapeo directo
2. **Slots < Expanded**: Trunca desde el final
3. **Slots > Expanded**: Repite última unidad con `isExtraSlot: true`
4. **Sin unidades**: Fallback a "Contenido general"
5. **clases_estimadas <= 0 o NaN**: Trata como 1

---

## Verificación Manual

### Escenario 1: Mapeo Exacto

**Setup**:
- 1 unidad didáctica
- `clases_estimadas = 3`
- Total de sesiones = 3

**Resultado esperado**:
- ✅ Las 3 sesiones asignadas a la misma unidad
- ✅ `claseEnUnidad` = 1, 2, 3
- ✅ `totalClasesUnidad` = 3 para todas

**Cómo verificar**:
1. Crear planificación con 1 unidad (3 clases estimadas)
2. Crear 3 sesiones
3. Abrir DevTools Console
4. Buscar log `[PHASE1] Mapeo unidades→sesiones:`
5. Verificar que `primerosAsignamientos` muestre 3 entradas con misma unidad

### Escenario 2: Múltiples Unidades

**Setup**:
- Unidad A: `clases_estimadas = 3`
- Unidad B: `clases_estimadas = 1`
- Total de sesiones = 4

**Resultado esperado**:
- ✅ Sesiones 1-3: Unidad A, `claseEnUnidad` = 1, 2, 3
- ✅ Sesión 4: Unidad B, `claseEnUnidad` = 1

**Cómo verificar**:
1. Crear planificación con 2 unidades (A: 3 clases, B: 1 clase)
2. Crear 4 sesiones
3. Verificar en console log que asignaciones sean A,A,A,B
4. Verificar en BD que `contenidos_anep` de sesiones coincida con unidades

### Escenario 3: Más Sesiones que Clases Estimadas

**Setup**:
- Unidad A: `clases_estimadas = 2`
- Unidad B: `clases_estimadas = 1`
- Total = 3 clases estimadas
- Total de sesiones = 5

**Resultado esperado**:
- ✅ Sesiones 1-2: Unidad A, clases 1-2
- ✅ Sesión 3: Unidad B, clase 1
- ✅ Sesiones 4-5: Unidad B (última), `claseEnUnidad` = 2, 3, `isExtraSlot: true`

**Cómo verificar**:
1. Crear planificación con unidades (A: 2, B: 1)
2. Crear 5 sesiones
3. Verificar en console log que sesiones 4-5 tengan `isExtra: true`
4. Verificar que `contenidos_anep` de sesiones 4-5 sea de Unidad B

### Escenario 4: Menos Sesiones que Clases Estimadas

**Setup**:
- Unidad A: `clases_estimadas = 3`
- Unidad B: `clases_estimadas = 2`
- Total = 5 clases estimadas
- Total de sesiones = 3

**Resultado esperado**:
- ✅ Sesiones 1-3: Unidad A, clases 1-3
- ✅ Unidad B NO aparece (truncada)

**Cómo verificar**:
1. Crear planificación con unidades (A: 3, B: 2)
2. Crear solo 3 sesiones
3. Verificar que todas las sesiones tengan contenido de Unidad A
4. Verificar que Unidad B no aparezca en asignaciones

---

## Logs DEV-Only

### Ubicación

**Path 1** (`useFullSessionGeneration.ts`):
- Línea ~40: Log resumen después de calcular `sessionAssignments`

**Path 2** (`PlanificacionWizard.tsx`):
- Línea ~70: Log resumen después de calcular `sessionAssignments`

### Formato del Log

```javascript
[PHASE1] Mapeo unidades→sesiones: {
  totalUnidades: 2,
  totalClasesEstimadas: 4,
  totalExpanded: 4,
  totalSesiones: 5,
  primerosAsignamientos: [
    { unidad: "Batllismo...", claseEnUnidad: 1, totalClases: 3, isExtra: false },
    { unidad: "Batllismo...", claseEnUnidad: 2, totalClases: 3, isExtra: false },
    // ... hasta 5
  ]
}
```

### Logs Detallados (Opcional)

Para activar logs detallados por sesión, cambiar `const DEBUG = false` a `true` en:
- `useFullSessionGeneration.ts` línea ~38
- `PlanificacionWizard.tsx` (no implementado aún, solo resumen)

---

## Cambios en Base de Datos

**Ninguno**. Phase 1 no requiere cambios en esquema de BD. La metadata se calcula en memoria y se pasa a funciones de generación, pero no se persiste aún.

---

## Compatibilidad y Regresión

### Tests de Compilación

- ✅ `npm run build` pasa sin errores
- ✅ No hay errores de TypeScript
- ✅ No hay errores de linting

### Flujos Existentes

- ✅ Wizard de planificación funciona igual
- ✅ Creación de sesiones (periodo_especifico y sin_periodo) funciona igual
- ✅ Workspace renderiza sesiones correctamente
- ✅ No se rompen flujos de edición manual

### Cambios Visibles para el Usuario

**Ninguno**. El cambio es completamente interno. La UI y flujos de usuario permanecen idénticos.

---

## Próximos Pasos (Phase 2)

1. **Incluir metadata en prompts de IA**:
   - Modificar `generate-plan-completo` para recibir `unitAssignment`
   - Incluir en prompt: "Esta es la clase X de Y para la unidad Z"
   - Permitir que IA genere contenido progresivo

2. **Validación en Wizard**:
   - Mostrar advertencia si `totalSesiones != sum(clases_estimadas)`
   - Sugerir ajustar `clases_estimadas` o cantidad de sesiones

3. **Persistencia de Metadata (Opcional)**:
   - Considerar agregar campo JSONB en `sesiones_clase` para metadata
   - O almacenar en `plan_desarrollo` como metadata adicional

---

## Notas Técnicas

### Duplicación de Funciones Helper

Las funciones `expandUnitsToSessionPlan()` y `mapSessionsToUnits()` están duplicadas en:
- `src/hooks/useFullSessionGeneration.ts`
- `src/pages/PlanificacionWizard.tsx`

**Razón**: Mantener scope local y evitar dependencias circulares. En el futuro se podría extraer a un archivo compartido (`src/lib/unitMapping.ts`).

### Validación de `clases_estimadas`

Se valida que `clases_estimadas` sea:
- `> 0`
- No `NaN`
- No `null` o `undefined`

Si no cumple, se usa `1` como default.

### Manejo de Unidades Vacías

Si `unidades_didacticas` está vacío o es `null/undefined`, se crea un plan expandido con "Contenido general" para todas las sesiones.

---

## Conclusión

Phase 1 implementado exitosamente. El mapeo determinístico reemplaza la rotación circular, asegurando que cada sesión se asigne a una unidad específica según `clases_estimadas`. Ambos paths de generación están cubiertos y el sistema mantiene compatibilidad completa con flujos existentes.

**Estado**: ✅ LISTO PARA PHASE 2














