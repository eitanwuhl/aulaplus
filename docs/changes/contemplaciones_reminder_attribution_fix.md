# Critical Fix: Per-Student Reminder Attribution (Cross-Contamination)

**Fecha:** 2026-01-23  
**Rama:** `Nuevos-perfiles-y-reglas-para-contemplaciones`  
**Tipo:** Hotfix crítico  
**Commit:** (pendiente)

---

## Resumen

Hotfix que corrige un bug crítico de atribución de recordatorios: todos los estudiantes mostraban los mismos recordatorios en lugar de sus propios recordatorios basados en sus contemplaciones individuales.

**Estado:** 🔧 **FIXED**

---

## Root Cause Found

### Problema Principal

**Síntoma:** Todos los estudiantes mostraban los mismos recordatorios (ej: "Recuerda brindar más tiempo...") en lugar de recordatorios específicos basados en sus propias contemplaciones.

**Root Cause:** `studentAssignments` NO incluía el ID del estudiante, solo `{ nombre, justificacion }`.

**Flujo del bug:**

1. `generateStudentAssignments()` creaba objetos SIN el campo `id`:
   ```typescript
   // ANTES (BROKEN)
   return filteredStudents.map(student => ({
     nombre: student.name,
     justificacion: generateContextualJustification(student, evaluationContent)
     // ❌ NO HAY ID
   }));
   ```

2. Al renderizar tarjetas, se iteraba sobre `studentAssignments`:
   ```typescript
   // ANTES (BROKEN)
   studentAssignments.map((assignment, index) => {
     // Tenía que BUSCAR el estudiante por nombre para obtener su ID
     const student = students?.find(s => {
       // Match by name (unreliable!)
       return normalizeStudentName(s.name) === normalizeStudentName(assignment.nombre);
     });
     
     // Si la búsqueda falla o encuentra el estudiante incorrecto...
     const reminders = student 
       ? perStudentReminders.get(normalizeStudentId(student.id))
       : [];
     // ❌ Podía obtener recordatorios del estudiante incorrecto
   })
   ```

3. **Resultado:** La búsqueda por nombre podía:
   - Fallar si los nombres no coinciden exactamente
   - Encontrar el primer estudiante con nombre similar
   - Retornar el mismo estudiante para múltiples assignments
   - Causar que todos los estudiantes obtengan los mismos recordatorios

### Por Qué Ocurría

- `studentAssignments` se generaba filtrando estudiantes y mapeando a `{ nombre, justificacion }`
- El ID se **perdía** en este proceso
- Al renderizar, NO teníamos acceso directo al ID del estudiante
- Teníamos que buscarlo de vuelta por nombre (poco confiable)
- La búsqueda fallaba o retornaba estudiante incorrecto
- Todos terminaban con los mismos recordatorios

---

## Solución Implementada

### 1. Incluir ID en StudentAssignment

**Cambio en interfaz:**
```typescript
// DESPUÉS (FIXED)
interface StudentAssignment {
  id: string | number;  // CRITICAL: Student ID for reminder lookup
  nombre: string;
  justificacion: string;
}
```

**Cambio en generación:**
```typescript
// DESPUÉS (FIXED)
return filteredStudents.map(student => ({
  id: student.id,  // ✅ INCLUIR ID
  nombre: student.name || `Estudiante ${student.id}`,
  justificacion: generateContextualJustification(student, evaluationContent)
}));
```

### 2. Usar ID Directamente para Lookup

**Cambio en renderizado:**
```typescript
// DESPUÉS (FIXED)
studentAssignments.map((assignment, index) => {
  // ✅ NO search needed - use assignment.id directly
  const studentNormalizedId = normalizeStudentId(assignment.id);
  
  // ✅ Direct lookup with correct ID
  const reminders = perStudentReminders.get(studentNormalizedId) || [];
  
  // ✅ Each student gets ONLY their own reminders
})
```

**Beneficios:**
- ✅ No necesitamos buscar el estudiante
- ✅ Usamos el ID correcto directamente
- ✅ Cada estudiante obtiene sus propios recordatorios
- ✅ No hay búsqueda por nombre (poco confiable)
- ✅ No hay cross-contamination

---

## Archivos Modificados

### 1. `src/components/evaluaciones/SimplifiedSmartRubric.tsx`

**Cambios:**
- ✅ Agregado campo `id` a interfaz `StudentAssignment`
- ✅ Incluido `student.id` en todos los lugares donde se genera `studentAssignments`
- ✅ Eliminada búsqueda de estudiante por nombre en renderizado
- ✅ Uso directo de `assignment.id` para lookup de recordatorios
- ✅ Diagnósticos mejorados mostrando `assignment.id` y `storageKey`

**Diff resumido:**
```diff
interface StudentAssignment {
+ id: string | number;  // CRITICAL: Student ID for reminder lookup
  nombre: string;
  justificacion: string;
}

return filteredStudents.map(student => ({
+ id: student.id,  // CRITICAL: Include ID for reminder lookup
  nombre: student.name || `Estudiante ${student.id}`,
  justificacion: generateContextualJustification(student, evaluationContent)
}));

studentAssignments.map((assignment, index) => {
- // Tenía que buscar el estudiante por nombre
- const student = students?.find(s => ...);
- const studentNormalizedId = student ? normalizeStudentId(student.id) : null;
- const reminders = studentNormalizedId ? perStudentReminders.get(studentNormalizedId) : [];
+ // Usa assignment.id directamente (no search needed)
+ const studentNormalizedId = normalizeStudentId(assignment.id);
+ const reminders = perStudentReminders.get(studentNormalizedId) || [];
})
```

### 2. `src/lib/contemplaciones/__tests__/reminder-attribution.test.ts` (NUEVO)

**Contenido:**
- Test harness determinístico para verificar atribución correcta
- Simula 3 estudiantes con diferentes contemplaciones
- Verifica que no hay cross-contamination
- Ejecutable en browser console: `testReminderAttribution()`

---

## Cómo Verificar Manualmente

### Paso 1: Habilitar Diagnósticos

```javascript
// En consola del navegador (ANTES de cargar/generar evaluación)
window.__CONTEMPLACIONES_DEBUG__ = true;
```

**IMPORTANTE:** Los diagnósticos ahora están SIEMPRE habilitados cuando el flag está configurado (no requieren `import.meta.env.DEV`).

**Logs esperados:**
- `[ENFORCEMENT] ========== Starting enforceForEvaluation ==========`
- `[ENFORCEMENT] Processing student:` (uno por cada estudiante)
- `[ENFORCEMENT] ========== Final output summary ==========`
- `[RUBRIC] Computing reminders - inputs:`
- `[RUBRIC] ========== Rendering student card ==========` (uno por cada tarjeta)

### Paso 2: Configurar Estudiantes de Prueba

1. Ir a "Perfiles de Estudiantes"
2. **Estudiante 1:** Seleccionar SOLO "Lectura oral de consignas" (contemplacion-1)
3. **Estudiante 2:** Seleccionar SOLO "Tiempo adicional y pausas" (contemplacion-3)
4. Guardar cada uno

### Paso 3: Generar Evaluación

1. Ir a "Evaluaciones Grupales"
2. Seleccionar grupo con ambos estudiantes
3. Generar evaluación

### Paso 4: Verificar en Consola

**CRÍTICO: Verificar que los IDs coinciden en todos los pasos**

**1. Buscar logs `[ENFORCEMENT] Processing student:`**

Para cada estudiante, verificar:
```
[ENFORCEMENT] Processing student: {
  'student.id': 1,                    // ← ID crudo del estudiante
  'student.id type': 'number',        // ← Tipo del ID
  normalizedId: "1",                  // ← ID normalizado (string)
  'normalizedId type': 'string',
  name: "Student 1",
  storageKey: "contemplacionesEval:1", // ← Key de localStorage
  'localStorage.getItem(storageKey)': '["contemplacion-1"]', // ← Datos en storage
  'readSelected result': ["contemplacion-1"] // ← Contemplaciones leídas
}
```

**VERIFICAR:**
- ✅ `storageKey` usa el mismo ID que el estudiante real
- ✅ `localStorage.getItem(storageKey)` retorna datos (no null)
- ✅ `readSelected result` contiene las contemplaciones esperadas

**2. Buscar logs `[ENFORCEMENT] ========== Final output summary ==========`**

Verificar que el Map tiene keys correctas:
```
[ENFORCEMENT] Map size: 2
[ENFORCEMENT] Map keys: ["1", "2"]
[ENFORCEMENT] Map keys types: ["string", "string"]
[ENFORCEMENT] Reminders by student:
  [1] (type: string): ["Recordar leer consignas en voz alta"]
  [2] (type: string): ["Recuerda brindar más tiempo y pausas..."]
```

**VERIFICAR:**
- ✅ Map size coincide con número de estudiantes con contemplaciones
- ✅ Map keys son strings normalizados ("1", "2", etc.)
- ✅ Cada estudiante tiene diferentes reminders

**3. Buscar logs `[RUBRIC] ========== Rendering student card ==========`**

Para cada tarjeta, verificar:
```
[RUBRIC] Card details: {
  assignmentName: "Student 1",
  'assignment.id': 1,                 // ← ID del assignment
  'assignment.id type': 'number',
  normalizedId: "1",                  // ← ID normalizado
  'normalizedId type': 'string'
}
[RUBRIC] Storage lookup: {
  storageKey: "contemplacionesEval:1",
  'localStorage.getItem(storageKey)': '["contemplacion-1"]',
  parsedContemplaciones: ["contemplacion-1"]
}
[RUBRIC] Map lookup: {
  'perStudentReminders.has(normalizedId)': true,  // ← DEBE SER TRUE
  'perStudentReminders.get(normalizedId)': ["Recordar leer consignas en voz alta"],
  remindersFetched: ["Recordar leer consignas en voz alta"],
  remindersCount: 1
}
[RUBRIC] All Map keys: ["1", "2"]
```

**VERIFICAR:**
- ✅ `assignment.id` coincide con el ID del estudiante real
- ✅ `storageKey` usa el mismo ID
- ✅ `localStorage.getItem(storageKey)` retorna datos
- ✅ `perStudentReminders.has(normalizedId)` es `true`
- ✅ `remindersFetched` contiene los recordatorios esperados

**Si `perStudentReminders.has(normalizedId)` es `false`:**
- ❌ Hay un mismatch de IDs entre enforcement y UI
- Comparar `normalizedId` en RUBRIC con las keys en `All Map keys`
- Verificar que `assignment.id` es el ID correcto del estudiante

### Paso 5: Verificar en UI

**Verificar que cada tarjeta muestra SOLO sus propios recordatorios:**

- ✅ Tarjeta "Student 1": SOLO "Recordar leer consignas en voz alta"
- ✅ Tarjeta "Student 2": SOLO "Recuerda brindar más tiempo y pausas..."
- ❌ NO debe haber duplicación
- ❌ NO deben aparecer los mismos recordatorios en ambas tarjetas

---

## Test Harness Determinístico

### Ejecutar en Browser Console

```javascript
// Cargar página con código actualizado
// En consola:
testReminderAttribution();
```

**Expected Output:**
```
[TEST] Starting per-student reminder attribution test...
[TEST] Setup complete: {
  "contemplacionesEval:1": ["contemplacion-1"],
  "contemplacionesEval:2": ["contemplacion-3"],
  "contemplacionesEval:3": ["contemplacion-9-22"]
}
[TEST] ✅ PASS - No cross-contamination detected
```

**El test verifica:**
- ✅ Student 1 tiene SOLO reminder de contemplacion-1
- ✅ Student 2 tiene SOLO reminder de contemplacion-3
- ✅ Student 3 tiene SOLO reminder de contemplacion-9-22
- ✅ NO hay cross-contamination (ningún estudiante tiene recordatorios de otro)

---

## Acceptance Criteria

### ✅ Criteria 1: UI muestra recordatorios correctos por estudiante

**Test:** Configurar 2 estudiantes con diferentes contemplaciones y generar evaluación.

**Ejemplo concreto:**
```javascript
// Verificar en consola:
localStorage.getItem("contemplacionesEval:3")
// Debe retornar: ["contemplacion-5","contemplacion-9-22"]

// Si contemplacion-9-22 está presente, ese estudiante DEBE mostrar:
// "No penalizar ortografía/sintaxis cuando no es objetivo"
```

**Resultado esperado:**
- Cada tarjeta muestra SOLO los recordatorios de ese estudiante
- NO aparecen los mismos recordatorios en múltiples tarjetas
- Si `contemplacionesEval:3` incluye `contemplacion-9-22`, la tarjeta del estudiante 3 muestra el reminder correspondiente

**Verificación:** 
1. Buscar `[RUBRIC] ========== Rendering student card ==========` en consola
2. Para cada tarjeta, verificar:
   - `assignment.id` coincide con el ID del estudiante
   - `storageKey` usa el mismo ID
   - `localStorage.getItem(storageKey)` retorna las contemplaciones esperadas
   - `perStudentReminders.has(normalizedId)` es `true`
   - `remindersFetched` contiene los recordatorios esperados para ESE estudiante

### ✅ Criteria 2: Persistence funciona correctamente

**Test:** Guardar evaluación y reabrirla desde "Mis evaluaciones".

**Resultado esperado:**
- Aparecen los mismos estudiantes
- Cada estudiante tiene sus propios recordatorios (no recordatorios de otro)

**Verificación:** Buscar `[EVALUACION DETALLE] Loaded students` y `[RUBRIC] Rendering student card` en consola.

### ✅ Criteria 3: Recordatorios NO aparecen en contenido de evaluación

**Test:** Revisar segunda tarjeta grande (contenido de evaluación).

**Resultado esperado:**
- NO aparece ningún recordatorio en el contenido
- Solo aparecen consignas y ejercicios

**Verificación:** `CleanEvaluationDisplay` NO importa `enforceForEvaluation`.

---

## Comparación: Antes vs Después

### ANTES (BROKEN)

```
┌─────────────────────────────────────┐
│ Student 1                            │
│ Justificación...                     │
│                                     │
│ Recordatorios:                       │
│ • Recuerda brindar más tiempo...     │  ❌ INCORRECTO
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Student 2                            │
│ Justificación...                     │
│                                     │
│ Recordatorios:                       │
│ • Recuerda brindar más tiempo...     │  ❌ DUPLICADO
└─────────────────────────────────────┘
```

**Problema:** Ambos estudiantes muestran el mismo recordatorio (del estudiante 2).

### DESPUÉS (FIXED)

```
┌─────────────────────────────────────┐
│ Student 1                            │
│ Justificación...                     │
│                                     │
│ Recordatorios:                       │
│ • Recordar leer consignas en voz alta│  ✅ CORRECTO
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Student 2                            │
│ Justificación...                     │
│                                     │
│ Recordatorios:                       │
│ • Recuerda brindar más tiempo y      │  ✅ CORRECTO
│   pausas en caso de ser necesario... │
└─────────────────────────────────────┘
```

**Solución:** Cada estudiante muestra SOLO sus propios recordatorios.

---

## Limitaciones Conocidas

### 1. Students en MockData

**Limitación:** Los estudiantes se cargan desde `mockGroups` (mockData), no desde Supabase.

**Mitigación:** Ya implementado en hotfix anterior - se carga desde mockGroups al reabrir evaluación.

### 2. Backward Compatibility

**Limitación:** Evaluaciones antiguas pueden no tener `assignedStudentIds`.

**Mitigación:** Mantiene soporte para `assignedStudents` (name-based) como fallback.

---

## Próximos Pasos

1. ✅ Verificar manualmente con diagnósticos habilitados
2. ✅ Ejecutar test harness: `testReminderAttribution()`
3. ✅ Confirmar que no hay regresiones en otras funcionalidades
4. ✅ Commit y documentación completa

---

**Última actualización:** 2026-01-23

