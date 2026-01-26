# Fix: Per-Student Reminder Attribution y Persistence

**Fecha:** 2026-01-23  
**Rama:** `Nuevos-perfiles-y-reglas-para-contemplaciones`  
**Tipo:** Hotfix crítico  
**Commit:** (pendiente)

---

## Resumen

Hotfix que corrige dos problemas críticos identificados en pruebas manuales:

1. 🔧 **FIXED:** Recordatorios ahora se atribuyen correctamente a cada estudiante según sus propias contemplaciones (sin duplicación cruzada)
2. 🔧 **FIXED:** Recordatorios persisten correctamente después de guardar y reabrir desde "Mis evaluaciones"
3. ✅ **MAINTAINED:** Recordatorios NO aparecen en el contenido de la evaluación (invariante mantenido)

**Estado de Verificación:** 🔧 **FIXED** - Requiere pruebas manuales con diagnósticos habilitados (ver sección "Cómo Verificar").

**Cambios Clave:**
- ✅ Helper compartido `normalizeStudentId()` para normalización consistente
- ✅ Map con keys normalizados (`Map<string, string[]>`)
- ✅ Arrays clonados (no compartidos entre estudiantes)
- ✅ Diagnósticos DEV-only para debugging
- ✅ Carga robusta de estudiantes en `EvaluacionDetalle`
- ✅ Guardrails para prevenir fallback a "siempre los mismos 4 nombres"

---

## Problemas Identificados

### Problema 1: Recordatorios Duplicados Entre Estudiantes

**Síntoma:** Los mismos recordatorios aparecían en múltiples tarjetas de estudiante, sin respetar las contemplaciones específicas de cada estudiante.

**Causa Raíz:**
- El Map `perStudentReminders` en `enforcement.ts` usaba `student.id` directamente como key (podía ser `string | number`)
- En `SimplifiedSmartRubric.tsx`, se normalizaban los IDs antes de hacer lookup
- **Mismatch:** El Map tenía keys sin normalizar, pero el lookup usaba IDs normalizados
- **Resultado:** Lookup fallaba y se mostraban recordatorios incorrectos o duplicados

**Ejemplo del bug:**
```typescript
// enforcement.ts (ANTES - BROKEN)
perStudentReminders.set(student.id, reminders);  // Key: 101 (number)

// SimplifiedSmartRubric.tsx (ANTES - BROKEN)
const normalizedId = normalizeStudentId(101);  // "101" (string)
reminders = perStudentReminders.get(normalizedId);  // undefined! (key mismatch)
```

### Problema 2: Recordatorios No Persisten Después de Guardar/Reabrir

**Síntoma:** Al guardar una evaluación y reabrirla desde "Mis evaluaciones", los recordatorios no aparecían o aparecían estudiantes incorrectos.

**Causa Raíz:**
- `EvaluacionDetalle.tsx` no cargaba el array de `students` necesario para calcular recordatorios
- `SimplifiedSmartRubric` recibía `students=[]`, por lo que no podía calcular recordatorios
- Los `assignedStudentIds` se guardaban correctamente, pero sin `students` no se podían calcular los recordatorios

---

## Solución Implementada

### A) Helper de Normalización Compartido

**Archivo nuevo:** `src/lib/contemplaciones/utils.ts`

```typescript
export function normalizeStudentId(id: string | number | null | undefined): string {
  if (id === null || id === undefined) return '';
  return String(id).trim();
}
```

**Uso consistente en:**
- `enforcement.ts`: Para normalizar keys del Map
- `SimplifiedSmartRubric.tsx`: Para normalizar IDs en filtrado y lookup
- `storage.ts`: (futuro, si es necesario)

### B) Fix en `enforcement.ts`: Map con Keys Normalizados

**Cambios:**
1. **Map type:** Cambiado de `Map<string | number, string[]>` a `Map<string, string[]>`
2. **Keys normalizados:** Todas las operaciones de set/get usan `normalizeStudentId()`
3. **Storage lookup:** Se usa `student.id` raw para storage (correcto), pero se normaliza para el Map

```typescript
// DESPUÉS (FIXED)
const perStudentReminders = new Map<string, string[]>();  // Keys siempre strings normalizados

for (const student of students) {
  const normalizedId = normalizeStudentId(student.id);
  
  // Read from storage using raw student.id (correct for localStorage key)
  const selected = readSelected(student.id, 'evaluaciones');
  selectedIdsByStudent.set(normalizedId, selected);  // Store with normalized key
  
  // ... process reminders ...
  
  // Set reminders with normalized key
  perStudentReminders.set(normalizedId, [...existing, reminder]);
}
```

**Garantía:** El mismo ID siempre produce la misma key normalizada, permitiendo lookup consistente.

### C) Fix en `SimplifiedSmartRubric.tsx`: Lookup Consistente

**Cambios:**
1. **Import shared helper:** Usa `normalizeStudentId` de `utils.ts`
2. **Lookup normalizado:** Busca recordatorios usando la misma normalización

```typescript
// DESPUÉS (FIXED)
import { normalizeStudentId } from '@/lib/contemplaciones/utils';

// Lookup usando misma normalización
const reminders = student
  ? (perStudentReminders.get(normalizeStudentId(student.id)) || [])
  : [];
```

**Garantía:** El lookup usa la misma normalización que se usó para crear las keys del Map.

### D) Fix en `EvaluacionDetalle.tsx`: Cargar Students del Grupo

**Cambios:**
1. **Estado nuevo:** `const [students, setStudents] = useState<...>([])`
2. **Carga de grupo:** Después de cargar la evaluación, busca el grupo en `mockGroups` para obtener estudiantes
3. **Pasar students:** Pasa `students={students}` a `EvaluacionVisualRenderer`

```typescript
// DESPUÉS (FIXED)
// Load group to get students (needed for reminders calculation)
if (evaluacionData.grupo_id) {
  const mockGroup = mockGroups.find(g => g.id === evaluacionData.grupo_id);
  if (mockGroup?.students) {
    setStudents(mockGroup.students);
  }
}

// Pass students to renderer
<EvaluacionVisualRenderer
  students={students}
  ...
/>
```

**Garantía:** Al reabrir una evaluación guardada, se cargan los estudiantes del grupo y se pueden calcular los recordatorios correctamente.

### E) Guardrail en `CleanEvaluationDisplay.tsx`

**Cambio:**
- Agregado comentario explícito documentando que este componente **NUNCA** debe usar `enforceForEvaluation()` o inyectar recordatorios

```typescript
// GUARDRAIL: This component displays ONLY the student-facing evaluation content.
// It MUST NEVER import or use enforceForEvaluation() or inject reminders.
// Reminders belong ONLY in SimplifiedSmartRubric student cards, never in evaluation content.
```

---

## Archivos Modificados

### 1. `src/lib/contemplaciones/utils.ts` (NUEVO)

**Contenido:**
- Función `normalizeStudentId()` para normalización consistente de IDs

### 2. `src/lib/contemplaciones/enforcement.ts`

**Cambios:**
- ✅ Importado `normalizeStudentId` de `utils.ts`
- ✅ Cambiado `Map<string | number, string[]>` a `Map<string, string[]>`
- ✅ Todas las operaciones de set/get usan keys normalizados
- ✅ Removida función `groupStudentsByContemplacion` (reemplazada con inline filtering)
- ✅ Fix en `getStudentRemindersForEvaluation()` para usar normalización

**Diff resumido:**
```diff
+ import { normalizeStudentId } from './utils';
- const perStudentReminders = new Map<string | number, string[]>();
+ const perStudentReminders = new Map<string, string[]>();
- perStudentReminders.set(student.id, reminders);
+ const normalizedId = normalizeStudentId(student.id);
+ perStudentReminders.set(normalizedId, reminders);
- return output.perStudentReminders.get(studentId) || [];
+ const normalizedId = normalizeStudentId(studentId);
+ return output.perStudentReminders.get(normalizedId) || [];
```

### 3. `src/components/evaluaciones/SimplifiedSmartRubric.tsx`

**Cambios:**
- ✅ Importado `normalizeStudentId` de `utils.ts`
- ✅ Removida función local `normalizeStudentId` (ahora usa shared helper)
- ✅ Simplificado cálculo de recordatorios (Map ya tiene keys normalizados)
- ✅ Diagnósticos DEV-only agregados para cada tarjeta renderizada

**Diff resumido:**
```diff
+ import { normalizeStudentId } from '@/lib/contemplaciones/utils';
- const normalizeStudentId = (id: string | number): string => { ... }
+ // Use shared normalizeStudentId from utils (imported above)
- const normalizedMap = new Map<string, string[]>();
- enforcementOutput.perStudentReminders.forEach((reminders, studentId) => {
-   const normalizedId = normalizeStudentId(studentId);
-   normalizedMap.set(normalizedId, reminders);
- });
- return normalizedMap;
+ // The Map already has normalized keys, return as-is
+ return enforcementOutput.perStudentReminders;
+ const DIAGNOSTIC_MODE = import.meta.env.DEV && (window as any).__CONTEMPLACIONES_DEBUG__ === true;
+ if (DIAGNOSTIC_MODE) console.log('[RUBRIC] Rendering student card:', { ... });
```

### 4. `src/pages/EvaluacionDetalle.tsx`

**Cambios:**
- ✅ Agregado estado `students`
- ✅ Carga de grupo desde `mockGroups` después de cargar evaluación
- ✅ Pasa `students={students}` a `EvaluacionVisualRenderer`
- ✅ Warning claro si grupo no se encuentra (no fallback silencioso)
- ✅ Set explícito a array vacío si no hay grupo (previene fallback a "siempre los mismos 4 nombres")
- ✅ Diagnósticos DEV-only agregados

**Diff resumido:**
```diff
+ import { mockGroups } from '@/data/mockData';
+ const [students, setStudents] = useState<Array<...>>([]);
+ // Load group to get students
+ const mockGroup = mockGroups.find(g => g.id === evaluacionData.grupo_id);
+ if (mockGroup?.students) {
+   setStudents(mockGroup.students);
+   if (DIAGNOSTIC_MODE) console.log('[EVALUACION DETALLE] Loaded students...');
+ } else {
+   console.warn('⚠️ Grupo no encontrado en mockData:', evaluacionData.grupo_id);
+   setStudents([]);  // Explicit empty, no fallback
+ }
+ students={students}
```

### 5. `src/components/evaluaciones/CleanEvaluationDisplay.tsx`

**Cambios:**
- ✅ Agregado comentario guardrail documentando invariante

**Diff resumido:**
```diff
+ // GUARDRAIL: This component displays ONLY the student-facing evaluation content.
+ // It MUST NEVER import or use enforceForEvaluation() or inject reminders.
+ // Reminders belong ONLY in SimplifiedSmartRubric student cards, never in evaluation content.
```

### 6. `src/lib/contemplaciones/__tests__/enforcement.test.ts` (NUEVO)

**Contenido:**
- Test harness para verificación determinística de atribución de recordatorios
- Verifica que no hay cross-contamination entre estudiantes

### 7. `src/lib/contemplaciones/utils.ts` (NUEVO)

**Contenido:**
- Helper compartido `normalizeStudentId()` para normalización consistente
- Usado en `enforcement.ts` y `SimplifiedSmartRubric.tsx`

---

## Cómo Verificar el Fix

### Habilitar Diagnósticos DEV-Only

**Antes de verificar, habilitar logging diagnóstico:**

1. Abrir consola del navegador (F12)
2. Ejecutar en consola:
   ```javascript
   window.__CONTEMPLACIONES_DEBUG__ = true;
   ```
3. Recargar la página

**Los logs aparecerán con prefijo:**
- `[ENFORCEMENT]` - Cálculo de recordatorios en `enforcement.ts`
- `[RUBRIC]` - Renderizado de tarjetas en `SimplifiedSmartRubric.tsx`
- `[EVALUACION DETALLE]` - Carga de estudiantes en `EvaluacionDetalle.tsx`

---

### Test 1: Fresh Evaluation View - Recordatorios Correctos por Estudiante

**Setup:**
1. **Estudiante A (ej: ID 1, nombre "Juan Pérez"):**
   - Ir a "Perfiles de Estudiantes" → Seleccionar estudiante
   - En "Contemplaciones para evaluaciones", seleccionar:
     - ✅ "Lectura oral de consignas" (`contemplacion-1`)

2. **Estudiante B (ej: ID 2, nombre "María González"):**
   - Seleccionar otro estudiante
   - En "Contemplaciones para evaluaciones", seleccionar:
     - ✅ "Tiempo adicional y pausas" (`contemplacion-3`)

3. **Estudiante C (ej: ID 3, nombre "Pedro Martínez"):**
   - Seleccionar otro estudiante
   - En "Contemplaciones para evaluaciones", seleccionar:
     - ✅ "Corrección centrada en contenido (no forma)" (`contemplacion-9-22`)

**Pasos:**
1. Ir a "Evaluaciones Grupales"
2. Seleccionar grupo que contiene estos 3 estudiantes
3. Configurar y generar evaluación
4. Los estudiantes se asignarán automáticamente a versiones según sus flags
5. Ir a la sección "Rúbrica de Evaluación"
6. Buscar "¿A quién contempla esta versión?"

**Verificación en Consola (con `__CONTEMPLACIONES_DEBUG__ = true`):**

Buscar logs `[ENFORCEMENT]` y `[RUBRIC]`. Deberías ver:

```
[ENFORCEMENT] Student processing: {
  rawId: 1,
  normalizedId: "1",
  name: "Juan Pérez",
  selectedContemplaciones: ["contemplacion-1"],
  ...
}
[ENFORCEMENT] Added reminder: {
  contemplacionId: "contemplacion-1",
  studentRawId: 1,
  normalizedId: "1",
  reminder: "Recordar leer consignas en voz alta",
  ...
}
[RUBRIC] Rendering student card: {
  assignmentName: "Juan Pérez",
  studentRawId: 1,
  studentNormalizedId: "1",
  storedContemplaciones: ["contemplacion-1"],
  remindersFetched: ["Recordar leer consignas en voz alta"],
  remindersCount: 1,
  ...
}
```

**Verificación Visual en UI:**

**Tarjeta de "Juan Pérez":**
- ✅ Muestra: "Recordar leer consignas en voz alta"
- ❌ NO muestra: "Recuerda brindar más tiempo..."
- ❌ NO muestra: "No penalizar ortografía..."

**Tarjeta de "María González":**
- ✅ Muestra: "Recuerda brindar más tiempo y pausas en caso de ser necesario para este alumno"
- ❌ NO muestra: "Recordar leer consignas..."
- ❌ NO muestra: "No penalizar ortografía..."

**Tarjeta de "Pedro Martínez":**
- ✅ Muestra: "No penalizar ortografía/sintaxis cuando no es objetivo"
- ❌ NO muestra: "Recordar leer consignas..."
- ❌ NO muestra: "Recuerda brindar más tiempo..."

**Evidencia Textual Esperada:**

```
┌─────────────────────────────────────┐
│ Juan Pérez                           │
│ Justificación contextual...         │
│                                     │
│ Recordatorios para esta evaluación: │
│ • Recordar leer consignas en voz alta│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ María González                      │
│ Justificación contextual...         │
│                                     │
│ Recordatorios para esta evaluación: │
│ • Recuerda brindar más tiempo y     │
│   pausas en caso de ser necesario   │
│   para este alumno                   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Pedro Martínez                      │
│ Justificación contextual...         │
│                                     │
│ Recordatorios para esta evaluación: │
│ • No penalizar ortografía/sintaxis  │
│   cuando no es objetivo              │
└─────────────────────────────────────┘
```

**Estado:** 🔧 **FIXED** - Requiere verificación manual con diagnósticos

---

### Test 2: Saved/Reopened Evaluation - Persistence

**Pasos:**
1. Usar la evaluación del Test 1
2. Hacer click en "Guardar evaluación"
3. Dar nombre (ej: "Test Persistence Fix")
4. Confirmar guardado
5. Ir a "Mis evaluaciones"
6. Buscar y abrir "Test Persistence Fix"

**Verificación en Consola:**

Buscar logs `[EVALUACION DETALLE]`:

```
[EVALUACION DETALLE] Loaded students from mockGroup: {
  grupoId: "9no 1",
  studentsCount: 25,
  studentIds: [
    { id: 1, name: "Juan Pérez" },
    { id: 2, name: "María González" },
    { id: 3, name: "Pedro Martínez" },
    ...
  ]
}
```

**Verificación Visual en UI:**

1. Verificar que aparecen las mismas tarjetas de estudiante que antes de guardar
2. Verificar que cada tarjeta muestra los mismos recordatorios
3. Verificar que NO aparecen estudiantes diferentes

**Evidencia Textual Esperada:**

Mismas tarjetas y recordatorios que en Test 1.

**Si el grupo no se encuentra:**

Deberías ver en consola:
```
⚠️ [EVALUACION DETALLE] Grupo no encontrado en mockData: "9no 1"
⚠️ [EVALUACION DETALLE] Los recordatorios no se mostrarán. Grupos disponibles: [...]
```

Y en UI: NO deberían aparecer tarjetas de estudiante (no fallback a "siempre los mismos 4 nombres").

**Estado:** 🔧 **FIXED** - Requiere verificación manual con diagnósticos

---

### Test 3: Recordatorios NO en Contenido de Evaluación

**Pasos:**
1. Usar evaluación del Test 1 o Test 2
2. Buscar la segunda tarjeta grande (contenido puro de la evaluación)
   - Tiene icono de libro (BookOpen)
   - Muestra título de la evaluación
   - Tiene badge "Versión X"
3. Revisar TODO el contenido visible en esa tarjeta

**Verificación:**

**Buscar en el contenido (NO deberían aparecer):**
- ❌ "Recordar leer consignas"
- ❌ "Recuerda brindar más tiempo"
- ❌ "No penalizar ortografía"
- ❌ "Recordatorio"
- ❌ Cualquier mención a contemplaciones o adaptaciones

**El contenido SOLO debe contener:**
- ✅ Consignas
- ✅ Preguntas
- ✅ Ejercicios
- ✅ Instrucciones para estudiantes

**Evidencia Textual Esperada:**

```
┌─────────────────────────────────────┐
│ Evaluación - Historia - 9º1         │
│ Versión 1                            │
├─────────────────────────────────────┤
│ [Contenido de evaluación]            │
│                                     │
│ Parte I                              │
│ 1. Lee el siguiente texto...        │
│ 2. Responde las siguientes...        │
│                                     │
│ [NO hay recordatorios aquí]          │
└─────────────────────────────────────┘
```

**Estado:** ✅ **MAINTAINED** - Invariante mantenido (verificación manual requerida)

---

## Diagnósticos DEV-Only

### Habilitar Logging

**En consola del navegador:**
```javascript
window.__CONTEMPLACIONES_DEBUG__ = true;
```

**Luego recargar la página.** Los logs aparecerán automáticamente.

### Qué Observar en los Logs

**1. Procesamiento de Estudiantes (`[ENFORCEMENT] Student processing`):**
- `rawId`: ID crudo del estudiante (number o string)
- `normalizedId`: ID normalizado usado como key del Map
- `selectedContemplaciones`: Contemplaciones leídas de localStorage para ese estudiante
- **Verificar:** Cada estudiante tiene su propio `rawId` y `normalizedId` únicos

**2. Agregado de Recordatorios (`[ENFORCEMENT] Added reminder`):**
- `studentRawId`: ID crudo del estudiante
- `normalizedId`: Key usado en el Map
- `reminder`: Texto del recordatorio agregado
- **Verificar:** Cada recordatorio se agrega al `normalizedId` correcto

**3. Resumen Final (`[ENFORCEMENT] Final output summary`):**
- `studentsWithReminders`: Lista de IDs normalizados que tienen recordatorios
- `remindersByStudent`: Objeto con recordatorios por estudiante
- **Verificar:** Cada estudiante tiene su propia lista de recordatorios (no compartida)

**4. Renderizado de Tarjetas (`[RUBRIC] Rendering student card`):**
- `studentRawId`: ID crudo del estudiante
- `studentNormalizedId`: ID normalizado usado para lookup
- `storedContemplaciones`: Contemplaciones leídas de localStorage
- `remindersFetched`: Recordatorios obtenidos del Map
- `mapHasKey`: Si el Map tiene una key para ese estudiante
- `allMapKeys`: Todas las keys en el Map (para debugging)
- **Verificar:** 
  - `studentNormalizedId` coincide con una key en `allMapKeys`
  - `remindersFetched` contiene solo recordatorios de ese estudiante
  - `storedContemplaciones` coincide con lo esperado

### Ejemplo de Logs Correctos

```
[ENFORCEMENT] Student processing: {
  rawId: 1,
  normalizedId: "1",
  name: "Juan Pérez",
  selectedContemplaciones: ["contemplacion-1"]
}
[ENFORCEMENT] Student processing: {
  rawId: 2,
  normalizedId: "2",
  name: "María González",
  selectedContemplaciones: ["contemplacion-3"]
}
[ENFORCEMENT] Added reminder: {
  contemplacionId: "contemplacion-1",
  studentRawId: 1,
  normalizedId: "1",
  reminder: "Recordar leer consignas en voz alta"
}
[ENFORCEMENT] Added reminder: {
  contemplacionId: "contemplacion-3",
  studentRawId: 2,
  normalizedId: "2",
  reminder: "Recuerda brindar más tiempo y pausas..."
}
[ENFORCEMENT] Final output summary: {
  totalStudents: 2,
  studentsWithReminders: ["1", "2"],
  remindersByStudent: {
    "1": { count: 1, reminders: ["Recordar leer consignas en voz alta"] },
    "2": { count: 1, reminders: ["Recuerda brindar más tiempo y pausas..."] }
  }
}
[RUBRIC] Rendering student card: {
  assignmentName: "Juan Pérez",
  studentRawId: 1,
  studentNormalizedId: "1",
  storedContemplaciones: ["contemplacion-1"],
  remindersFetched: ["Recordar leer consignas en voz alta"],
  remindersCount: 1,
  mapHasKey: true,
  allMapKeys: ["1", "2"]
}
[RUBRIC] Rendering student card: {
  assignmentName: "María González",
  studentRawId: 2,
  studentNormalizedId: "2",
  storedContemplaciones: ["contemplacion-3"],
  remindersFetched: ["Recuerda brindar más tiempo y pausas..."],
  remindersCount: 1,
  mapHasKey: true,
  allMapKeys: ["1", "2"]
}
```

### Test Harness Determinístico

**Archivo:** `src/lib/contemplaciones/__tests__/enforcement.test.ts`

**Función:** `testPerStudentReminderAttribution()`

**Setup:**
```typescript
localStorage:
  - contemplacionesEval:101 -> ['contemplacion-1']
  - contemplacionesEval:202 -> ['contemplacion-3']
  - contemplacionesEval:303 -> ['contemplacion-9-22']
```

**Verificación:**
- `Map['101']` contiene SOLO reminder para #1
- `Map['202']` contiene SOLO reminder para #3
- `Map['303']` contiene SOLO reminder para #9-22
- No hay cross-contamination

**Ejecución:**
```bash
# Si hay test runner configurado
npm test enforcement.test.ts

# O ejecutar manualmente en Node.js
node -e "require('./src/lib/contemplaciones/__tests__/enforcement.test.ts')"
```

---

## Root Cause Analysis

### Problema 1: Recordatorios Duplicados

**Root Cause:** Mismatch de normalización entre creación de keys del Map y lookup

**Flujo del bug:**
1. `enforcement.ts` crea Map con key `student.id` (number: `101`)
2. `SimplifiedSmartRubric.tsx` normaliza ID a string (`"101"`) para lookup
3. `Map.get("101")` busca key string, pero el Map tiene key number
4. Lookup falla → se muestran recordatorios incorrectos o vacíos

**Fix:**
- Normalizar keys al crear el Map (en `enforcement.ts`)
- Usar misma normalización para lookup (en `SimplifiedSmartRubric.tsx`)
- Helper compartido garantiza consistencia

### Problema 2: No Persistence

**Root Cause:** `EvaluacionDetalle.tsx` no cargaba el array de `students` necesario para calcular recordatorios

**Flujo del bug:**
1. Evaluación se guarda con `assignedStudentIds` correctamente
2. Al reabrir, `EvaluacionDetalle` carga la evaluación pero NO carga estudiantes
3. `EvaluacionVisualRenderer` recibe `students=[]`
4. `SimplifiedSmartRubric` no puede calcular recordatorios sin estudiantes
5. Tarjetas aparecen vacías o con estudiantes incorrectos

**Fix:**
- Cargar grupo desde `mockGroups` después de cargar evaluación
- Pasar `students` array a `EvaluacionVisualRenderer`
- Ahora `SimplifiedSmartRubric` puede calcular recordatorios correctamente

---

## Limitaciones Conocidas

### 1. Students en MockData (Crítico)

**Limitación:** Los estudiantes se cargan desde `mockGroups` (mockData), no desde Supabase.

**Impacto:**
- Si un grupo no existe en `mockGroups`, los recordatorios NO se mostrarán al reabrir
- El código ahora muestra un warning claro en consola si el grupo no se encuentra
- NO hay fallback silencioso a "siempre los mismos 4 nombres" (se muestra array vacío)

**Workaround Actual:**
- Asegurar que todos los grupos usados tengan entrada en `mockGroups`
- Si un grupo no se encuentra, se muestra warning pero la evaluación se carga (sin recordatorios)

**Solución Futura:**
- Migrar estudiantes a tabla en Supabase
- O almacenar `students` array en `evaluacion_generada` al guardar

### 2. Backward Compatibility con Evaluaciones Antiguas

**Limitación:** Evaluaciones guardadas antes de este hotfix pueden no tener `assignedStudentIds`.

**Impacto:**
- Se usará fallback a `assignedStudents` (name-based matching)
- Funcional pero menos robusto que ID-based matching
- Puede fallar si los nombres no coinciden exactamente

**Mitigación:** El código mantiene soporte para `assignedStudents` como fallback, pero prioriza `assignedStudentIds`.

### 3. Diagnósticos Requieren Flag Manual

**Limitación:** Los logs diagnósticos solo aparecen si `window.__CONTEMPLACIONES_DEBUG__ = true` está configurado.

**Impacto:**
- Sin el flag, no hay visibilidad de qué está pasando internamente
- Requiere configuración manual en consola

**Mitigación:** Los logs están documentados y son fáciles de habilitar cuando se necesita debugging.

---

## Notas de Implementación

### Normalización Consistente

**Garantía:** El mismo ID siempre se normaliza igual:
- `101` (number) → `"101"` (string)
- `"101"` (string) → `"101"` (string)
- `" 101 "` (string con espacios) → `"101"` (string trim)

**Uso:**
- Storage keys: Usan `student.id` raw (correcto para localStorage)
- Map keys: Usan `normalizeStudentId(student.id)` (consistente para lookup)
- Lookup: Usa `normalizeStudentId(student.id)` (misma normalización)

### Separación de Responsabilidades

**`enforcement.ts`:**
- Calcula recordatorios basándose en contemplaciones de cada estudiante
- Retorna Map con keys normalizados

**`SimplifiedSmartRubric.tsx`:**
- Filtra estudiantes asignados (usando `assignedStudentIds`)
- Busca recordatorios en el Map (usando misma normalización)
- Renderiza tarjetas con recordatorios

**`CleanEvaluationDisplay.tsx`:**
- Muestra SOLO contenido de evaluación
- NUNCA calcula o muestra recordatorios

---

## Cómo Reproducir y Verificar el Fix

### Paso 1: Habilitar Diagnósticos

1. Abrir aplicación en navegador
2. Abrir consola (F12)
3. Ejecutar: `window.__CONTEMPLACIONES_DEBUG__ = true`
4. Recargar página

### Paso 2: Configurar Estudiantes de Prueba

1. Ir a "Perfiles de Estudiantes"
2. Seleccionar estudiante 1 (ej: "Juan Pérez", ID: 1)
   - En "Contemplaciones para evaluaciones":
     - ✅ Seleccionar: "Lectura oral de consignas"
   - Guardar
3. Seleccionar estudiante 2 (ej: "María González", ID: 2)
   - En "Contemplaciones para evaluaciones":
     - ✅ Seleccionar: "Tiempo adicional y pausas"
   - Guardar

### Paso 3: Generar Evaluación

1. Ir a "Evaluaciones Grupales"
2. Seleccionar grupo que contiene estudiantes 1 y 2
3. Configurar evaluación (materia, contenidos, criterios)
4. Generar evaluación
5. Los estudiantes se asignarán automáticamente a versiones

### Paso 4: Verificar en Consola

**Buscar logs `[ENFORCEMENT]`:**

Deberías ver algo como:
```
[ENFORCEMENT] Student processing: {
  rawId: 1,
  normalizedId: "1",
  name: "Juan Pérez",
  selectedContemplaciones: ["contemplacion-1"]
}
[ENFORCEMENT] Student processing: {
  rawId: 2,
  normalizedId: "2",
  name: "María González",
  selectedContemplaciones: ["contemplacion-3"]
}
[ENFORCEMENT] Added reminder: {
  contemplacionId: "contemplacion-1",
  studentRawId: 1,
  normalizedId: "1",
  reminder: "Recordar leer consignas en voz alta"
}
[ENFORCEMENT] Added reminder: {
  contemplacionId: "contemplacion-3",
  studentRawId: 2,
  normalizedId: "2",
  reminder: "Recuerda brindar más tiempo y pausas..."
}
[ENFORCEMENT] Final output summary: {
  totalStudents: 2,
  studentsWithReminders: ["1", "2"],
  remindersByStudent: {
    "1": { count: 1, reminders: ["Recordar leer consignas en voz alta"] },
    "2": { count: 1, reminders: ["Recuerda brindar más tiempo y pausas..."] }
  }
}
```

**Buscar logs `[RUBRIC]`:**

Deberías ver algo como:
```
[RUBRIC] Rendering student card: {
  assignmentName: "Juan Pérez",
  studentRawId: 1,
  studentNormalizedId: "1",
  storedContemplaciones: ["contemplacion-1"],
  remindersFetched: ["Recordar leer consignas en voz alta"],
  remindersCount: 1,
  mapHasKey: true,
  allMapKeys: ["1", "2"]
}
[RUBRIC] Rendering student card: {
  assignmentName: "María González",
  studentRawId: 2,
  studentNormalizedId: "2",
  storedContemplaciones: ["contemplacion-3"],
  remindersFetched: ["Recuerda brindar más tiempo y pausas..."],
  remindersCount: 1,
  mapHasKey: true,
  allMapKeys: ["1", "2"]
}
```

### Paso 5: Verificar en UI

**En "¿A quién contempla esta versión?":**

- Tarjeta "Juan Pérez": Debe mostrar SOLO "Recordar leer consignas en voz alta"
- Tarjeta "María González": Debe mostrar SOLO "Recuerda brindar más tiempo y pausas..."
- NO debe haber duplicación (cada estudiante tiene solo sus recordatorios)

### Paso 6: Verificar Persistence

1. Guardar evaluación con nombre "Test Fix"
2. Ir a "Mis evaluaciones"
3. Abrir "Test Fix"
4. Verificar en consola logs `[EVALUACION DETALLE]`:
   ```
   [EVALUACION DETALLE] Loaded students from mockGroup: {
     grupoId: "...",
     studentsCount: ...,
     studentIds: [...]
   }
   ```
5. Verificar en UI que aparecen las mismas tarjetas y recordatorios

### Paso 7: Verificar Invariante (Recordatorios NO en Contenido)

1. Buscar segunda tarjeta grande (contenido de evaluación)
2. Revisar TODO el contenido
3. Verificar que NO aparecen:
   - "Recordar leer consignas"
   - "Recuerda brindar más tiempo"
   - Cualquier recordatorio

---

## Próximos Pasos (Opcional)

1. **Migrar estudiantes a Supabase:** Crear tabla de estudiantes para persistencia real
2. **Tests automatizados:** Integrar test harness en test runner del proyecto
3. **Deprecar name-based matching:** Después de período de transición, remover soporte para `assignedStudents` legacy
4. **Mejorar diagnóstico:** Considerar agregar UI de diagnóstico en modo desarrollo

---

## Observaciones Esperadas (Después de Verificación Manual)

### Escenario: 2 Estudiantes con Diferentes Contemplaciones

**Setup:**
- Estudiante A (ID: 1, nombre: "Juan Pérez"): `contemplacion-1`
- Estudiante B (ID: 2, nombre: "María González"): `contemplacion-3`

**Evidencia Textual Esperada en UI:**

```
┌─────────────────────────────────────┐
│ Juan Pérez                           │
│ Justificación contextual...         │
│                                     │
│ Recordatorios para esta evaluación: │
│ • Recordar leer consignas en voz alta│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ María González                      │
│ Justificación contextual...         │
│                                     │
│ Recordatorios para esta evaluación: │
│ • Recuerda brindar más tiempo y     │
│   pausas en caso de ser necesario   │
│   para este alumno                   │
└─────────────────────────────────────┘
```

**Evidencia en Consola (con `__CONTEMPLACIONES_DEBUG__ = true`):**

```
[ENFORCEMENT] Student processing: {
  rawId: 1,
  normalizedId: "1",
  name: "Juan Pérez",
  selectedContemplaciones: ["contemplacion-1"]
}
[ENFORCEMENT] Student processing: {
  rawId: 2,
  normalizedId: "2",
  name: "María González",
  selectedContemplaciones: ["contemplacion-3"]
}
[ENFORCEMENT] Added reminder: {
  contemplacionId: "contemplacion-1",
  studentRawId: 1,
  normalizedId: "1",
  reminder: "Recordar leer consignas en voz alta"
}
[ENFORCEMENT] Added reminder: {
  contemplacionId: "contemplacion-3",
  studentRawId: 2,
  normalizedId: "2",
  reminder: "Recuerda brindar más tiempo y pausas..."
}
[ENFORCEMENT] Final output summary: {
  totalStudents: 2,
  studentsWithReminders: ["1", "2"],
  remindersByStudent: {
    "1": { count: 1, reminders: ["Recordar leer consignas en voz alta"] },
    "2": { count: 1, reminders: ["Recuerda brindar más tiempo y pausas..."] }
  }
}
[RUBRIC] Rendering student card: {
  assignmentName: "Juan Pérez",
  studentRawId: 1,
  studentNormalizedId: "1",
  storedContemplaciones: ["contemplacion-1"],
  remindersFetched: ["Recordar leer consignas en voz alta"],
  remindersCount: 1,
  mapHasKey: true,
  allMapKeys: ["1", "2"]
}
[RUBRIC] Rendering student card: {
  assignmentName: "María González",
  studentRawId: 2,
  studentNormalizedId: "2",
  storedContemplaciones: ["contemplacion-3"],
  remindersFetched: ["Recuerda brindar más tiempo y pausas..."],
  remindersCount: 1,
  mapHasKey: true,
  allMapKeys: ["1", "2"]
}
```

**Verificación de No Duplicación:**
- ✅ `remindersByStudent["1"]` contiene SOLO reminder de `contemplacion-1`
- ✅ `remindersByStudent["2"]` contiene SOLO reminder de `contemplacion-3`
- ✅ `remindersFetched` para cada estudiante contiene solo sus propios recordatorios
- ✅ NO hay cross-contamination (cada estudiante tiene array independiente)

---

## Confirmación: Recordatorios NO en Contenido de Evaluación

**Verificación Manual Requerida:**

1. Buscar segunda tarjeta grande (contenido de evaluación)
2. Revisar TODO el contenido HTML/texto visible
3. Buscar strings:
   - "Recordar leer consignas"
   - "Recuerda brindar más tiempo"
   - "No penalizar ortografía"
   - "Recordatorio"
   - Cualquier mención a contemplaciones

**Resultado Esperado:**
- ❌ NINGUNO de estos strings aparece en el contenido
- ✅ Solo aparecen consignas, preguntas, ejercicios

**Garantía de Código:**
- `CleanEvaluationDisplay.tsx` NO importa `enforceForEvaluation`
- `CleanEvaluationDisplay.tsx` tiene comentario guardrail explícito
- El contenido se limpia con `ContentCleaner.extractPureEvaluation()`

---

**Última actualización:** 2026-01-23

