# Hotfix: ID-Based Matching para Estudiantes Asignados

**Fecha:** 2026-01-23  
**Rama:** `Nuevos-perfiles-y-reglas-para-contemplaciones`  
**Tipo:** Hotfix crítico  
**Commit:** (pendiente)

---

## Resumen

Hotfix que corrige el matching de estudiantes asignados en "¿A quién contempla esta versión?" cambiando de matching basado en nombres (brittle) a matching basado en IDs (estable). Esto resuelve tres problemas críticos:

1. ✅ Las tarjetas de estudiante correctas se muestran (no siempre los mismos 4 nombres)
2. ✅ Los recordatorios persisten y reaparecen correctamente al abrir evaluaciones guardadas desde "Mis evaluaciones"
3. ✅ Si múltiples estudiantes asignados tienen recordatorios, TODAS las tarjetas correspondientes muestran sus recordatorios

---

## Problema Identificado

### Síntomas

1. **Siempre los mismos 4 estudiantes:** Independientemente de qué estudiantes estén asignados a una versión, siempre se mostraban los primeros 4 estudiantes del grupo.

2. **Recordatorios no persisten:** Al guardar una evaluación y reabrirla desde "Mis evaluaciones", los recordatorios no aparecían en las tarjetas de estudiante.

3. **Recordatorios solo en una tarjeta:** Si múltiples estudiantes tenían recordatorios, solo uno de ellos los mostraba.

### Causa Raíz

El código en `SimplifiedSmartRubric.tsx` usaba **matching basado en nombres normalizados** para filtrar estudiantes:

```typescript
// ANTES (BROKEN)
const assignedStudentNamesNormalized = new Set(
  assignedStudents.map(name => normalizeStudentName(name))
);

const filteredStudents = students.filter(student => {
  const normalizedStudentName = normalizeStudentName(student.name);
  return assignedStudentNamesNormalized.has(normalizedStudentName);
});
```

**Problemas con este enfoque:**
- Los nombres pueden cambiar o tener variaciones (acentos, espacios, mayúsculas)
- Al guardar/cargar, los nombres pueden no coincidir exactamente
- El fallback mostraba siempre los primeros 4 estudiantes si no había match

---

## Solución Implementada

### Cambio Principal: ID-Based Matching

Se reemplazó el matching basado en nombres por **matching basado en IDs estables**:

```typescript
// DESPUÉS (FIXED)
const assignedIdsSet = new Set(
  assignedStudentIds.map(id => normalizeStudentId(id))
);

const filteredStudents = students.filter(student => {
  const normalizedId = normalizeStudentId(student.id);
  return assignedIdsSet.has(normalizedId);
});
```

### Mejoras Adicionales

1. **Helper de normalización de IDs:** Función `normalizeStudentId()` que maneja string/number de forma consistente
2. **Priorización clara:** 
   - PRIORITY 1: `assignedStudentIds` (nuevo, ID-based)
   - PRIORITY 2: `assignedStudents` (legacy, name-based, backward compatibility)
   - PRIORITY 3: Fallback solo cuando NO hay datos guardados
3. **Recordatorios normalizados:** Los recordatorios se calculan y buscan usando la misma normalización de IDs
4. **Fallback gated:** El fallback que mostraba "siempre los mismos 4 nombres" ahora solo se activa cuando NO hay datos guardados

---

## Archivos Modificados

### 1. `src/components/evaluaciones/SimplifiedSmartRubric.tsx`

**Cambios:**
- ✅ Agregado prop `assignedStudentIds?: (string | number)[]`
- ✅ Agregado helper `normalizeStudentId()` para normalización consistente
- ✅ Reemplazado matching basado en nombres por matching basado en IDs
- ✅ Actualizado cálculo de recordatorios para usar misma normalización de IDs
- ✅ Gated fallback para que solo se active cuando NO hay datos guardados

**Diff resumido:**
```diff
+ assignedStudentIds?: (string | number)[];  // NEW: Student IDs assigned to this version
+ const normalizeStudentId = (id: string | number): string => { ... }
- // Matching basado en nombres (BROKEN)
+ // Matching basado en IDs (FIXED)
- const assignedStudentNamesNormalized = new Set(...)
+ const assignedIdsSet = new Set(assignedStudentIds.map(id => normalizeStudentId(id)))
- // Fallback siempre activo
+ // Fallback solo cuando NO hay datos guardados
```

### 2. `src/components/evaluaciones/EvaluacionVisualRenderer.tsx`

**Cambios:**
- ✅ Agregado `assignedStudentIds` al interface de `evaluation`
- ✅ Pasado `assignedStudentIds` a `SimplifiedSmartRubric`

**Diff resumido:**
```diff
  evaluation: {
    ...
+   assignedStudentIds?: (string | number)[];  // NEW: Student IDs assigned to this version
  }
+ assignedStudentIds={evaluation.assignedStudentIds}
```

### 3. `src/pages/EvaluacionesGrupo.tsx`

**Cambios:**
- ✅ Agregado `assignedStudentIds` al interface `GeneratedEvaluation`
- ✅ Actualizado `getVersionData()` para incluir IDs en los detalles de estudiantes
- ✅ Actualizado generación de evaluaciones para incluir `assignedStudentIds` en cada versión
- ✅ `assignedStudentIds` se guarda en `evaluacion_generada.evaluaciones[]`

**Diff resumido:**
```diff
  interface GeneratedEvaluation {
    ...
+   assignedStudentIds?: (string | number)[];  // NEW: Student IDs assigned to this version
  }
  
  const detalles = (arr: typeof alumnos) =>
    arr.map(a => ({
      nombre: a.name,
      contemplaciones: activas,
+     id: a.id  // NEW: Include ID for persistence
    }));
  
  assignedStudentIds: versionStudentData?.v1.map(s => s.id) || []
```

### 4. `src/pages/EvaluacionDetalle.tsx`

**Cambios:**
- ✅ Agregado `assignedStudentIds` al interface de evaluación guardada
- ✅ Pasado `assignedStudentIds` desde evaluación guardada a `EvaluacionVisualRenderer`

**Diff resumido:**
```diff
  evaluacion_generada?: {
    evaluaciones?: Array<{
      ...
+     assignedStudentIds?: (string | number)[];  // NEW: Student IDs assigned to this version
    }>;
  };
+ assignedStudentIds: evalItem.assignedStudentIds
```

---

## Estructura de Datos

### Antes (Solo Nombres)

```typescript
{
  assignedStudents: ["Juan Pérez", "María González"]  // Solo nombres
}
```

### Después (IDs + Nombres para Backward Compatibility)

```typescript
{
  assignedStudents: ["Juan Pérez", "María González"],  // Legacy (backward compatibility)
  assignedStudentIds: [123, 456]  // NEW: IDs estables (source of truth)
}
```

**Nota:** Se mantiene `assignedStudents` para backward compatibility con evaluaciones guardadas anteriormente. El código prioriza `assignedStudentIds` si está disponible.

---

## Verificación Manual

### Test 1: Crear Evaluación con Múltiples Estudiantes Asignados que Tienen Recordatorios

**Pasos:**

1. **Preparar datos:**
   - Ir a "Perfiles de Estudiantes"
   - Seleccionar estudiante "Juan Pérez" (ID: 123)
     - En "Contemplaciones para evaluaciones", seleccionar:
       - ✅ "Lectura oral de consignas"
       - ✅ "Tiempo adicional y pausas"
   - Seleccionar estudiante "María González" (ID: 456)
     - En "Contemplaciones para evaluaciones", seleccionar:
       - ✅ "Corrección centrada en contenido"
       - ✅ "Hoja auxiliar / borrador permitido"
   - Seleccionar estudiante "Pedro Martínez" (ID: 789)
     - En "Contemplaciones para evaluaciones", seleccionar:
       - ✅ "Monitoreo docente y andamiaje"

2. **Generar evaluación:**
   - Ir a "Evaluaciones Grupales"
   - Seleccionar grupo que contiene estos 3 estudiantes
   - Configurar evaluación y generar

3. **Verificar asignación:**
   - Verificar que los 3 estudiantes están asignados a versiones (según sus flags de adecuación)
   - Ir a la sección "Rúbrica de Evaluación"
   - Buscar "¿A quién contempla esta versión?"

4. **VERIFICAR:**
   - ✅ Las tarjetas de estudiante muestran los nombres correctos (Juan, María, Pedro)
   - ✅ NO aparecen estudiantes no asignados
   - ✅ Cada tarjeta muestra sus propios recordatorios:
     - Tarjeta de Juan: "Recordar leer consignas...", "Recuerda brindar más tiempo..."
     - Tarjeta de María: "No penalizar ortografía...", "Permitir hoja auxiliar..."
     - Tarjeta de Pedro: "Verificar comprensión durante la prueba..."

**Resultado esperado:** Todas las tarjetas de estudiantes asignados muestran sus recordatorios correctamente.

---

### Test 2: Guardar y Reabrir Evaluación desde "Mis Evaluaciones"

**Pasos:**

1. **Usar la evaluación del Test 1**

2. **Guardar evaluación:**
   - Hacer click en "Guardar evaluación"
   - Dar un nombre (ej: "Test ID Matching")
   - Confirmar guardado

3. **Cerrar y reabrir:**
   - Ir a "Mis Evaluaciones"
   - Buscar "Test ID Matching"
   - Hacer click para abrir

4. **VERIFICAR:**
   - ✅ Las tarjetas de estudiante muestran los mismos estudiantes que antes de guardar
   - ✅ Los recordatorios aparecen en cada tarjeta (igual que antes de guardar)
   - ✅ NO aparecen estudiantes diferentes o "siempre los mismos 4 nombres"

**Resultado esperado:** Los estudiantes asignados y sus recordatorios persisten correctamente después de guardar/cargar.

---

### Test 3: Confirmar Recordatorios NO Aparecen en el Contenido de la Evaluación

**Pasos:**

1. **Usar la evaluación del Test 1 o Test 2**

2. **Verificar contenido de evaluación:**
   - Buscar la segunda tarjeta grande (contenido puro de la evaluación)
   - Revisar TODO el contenido visible

3. **VERIFICAR:**
   - ❌ NO aparece "Recordar leer consignas"
   - ❌ NO aparece "Recuerda brindar más tiempo"
   - ❌ NO aparece "No penalizar ortografía"
   - ❌ NO aparece ningún recordatorio en el contenido

**Resultado esperado:** Los recordatorios SOLO aparecen en las tarjetas de "¿A quién contempla...?", NUNCA en el contenido de la evaluación.

---

## Regresión Guard

### Helper de Normalización

Se agregó `normalizeStudentId()` para garantizar normalización consistente:

```typescript
const normalizeStudentId = (id: string | number): string => {
  if (id === null || id === undefined) return '';
  return String(id).trim();
};
```

**Uso consistente:**
- ✅ Al construir el Set de IDs asignados
- ✅ Al filtrar estudiantes
- ✅ Al buscar recordatorios en el Map
- ✅ Al normalizar keys del Map de recordatorios

**Garantía:** Mismo ID siempre se normaliza a la misma string, independientemente de si viene como string o number.

---

## Backward Compatibility

### Evaluaciones Guardadas Anteriormente

Las evaluaciones guardadas antes de este hotfix solo tienen `assignedStudents` (nombres). El código mantiene soporte para ellas:

1. **Prioridad:** Si `assignedStudentIds` existe → usar ID-based matching
2. **Fallback:** Si solo `assignedStudents` existe → usar name-based matching (legacy)
3. **Último recurso:** Si no hay datos → fallback gated (solo si realmente no hay datos)

**Resultado:** Evaluaciones antiguas siguen funcionando, pero nuevas evaluaciones usan el sistema mejorado.

---

## Riesgo

**Nivel:** 🟡 **MEDIO**

**Razones:**
- Cambios en múltiples archivos del flujo de evaluaciones
- Cambio en estructura de datos persistida
- Lógica de matching completamente reemplazada

**Mitigaciones:**
- ✅ Backward compatibility mantenida (soporte para `assignedStudents` legacy)
- ✅ Fallback gated (no se activa si hay datos guardados)
- ✅ Helper de normalización centralizado (reduce errores de inconsistencia)
- ✅ Tests manuales exhaustivos documentados

**Consideraciones:**
- Evaluaciones guardadas antes del hotfix seguirán usando name-based matching (funcional pero menos robusto)
- Nuevas evaluaciones usarán ID-based matching (más robusto)
- Si hay problemas, se puede revertir fácilmente (código legacy aún existe)

---

## Notas de Implementación

### Normalización de IDs

Los IDs pueden venir como `string` o `number`. La normalización garantiza:
- `123` (number) → `"123"` (string)
- `"123"` (string) → `"123"` (string)
- `" 123 "` (string con espacios) → `"123"` (string trim)

**Garantía:** Mismo ID siempre se normaliza igual, permitiendo matching confiable.

### Cálculo de Recordatorios

Los recordatorios se calculan usando la misma normalización:

```typescript
// Filtrar estudiantes asignados (misma normalización)
const assignedIdsSet = new Set(assignedStudentIds.map(id => normalizeStudentId(id)));
studentsToProcess = students.filter(s => assignedIdsSet.has(normalizeStudentId(s.id)));

// Calcular recordatorios
const enforcementOutput = enforceForEvaluation(enforcementStudents);

// Normalizar keys del Map para lookup consistente
const normalizedMap = new Map<string, string[]>();
enforcementOutput.perStudentReminders.forEach((reminders, studentId) => {
  const normalizedId = normalizeStudentId(studentId);
  normalizedMap.set(normalizedId, reminders);
});
```

**Garantía:** Los recordatorios se buscan usando la misma normalización que se usó para filtrar estudiantes.

---

## Próximos Pasos (Opcional)

1. **Migración de datos:** Script para actualizar evaluaciones antiguas agregando `assignedStudentIds` desde `assignedStudents` (requiere lookup de IDs desde nombres)

2. **Deprecación gradual:** Después de un período de transición, remover soporte para `assignedStudents` (name-based matching)

3. **Tests automatizados:** Agregar tests unitarios para verificar matching por IDs y persistencia de recordatorios

---

**Última actualización:** 2026-01-23








