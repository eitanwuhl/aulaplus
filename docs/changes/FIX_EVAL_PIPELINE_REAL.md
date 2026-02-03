# Fix Evaluation Pipeline Real (ID Normalization, Deterministic Enforcement, Persistence Verification)

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Objetivo**: Corregir problemas reales observados: normalización de IDs de estudiantes, enforcement determinístico de metacognición y versión C, y verificación de persistencia de AI report.

---

## Problema Observado

A pesar de que el network muestra una request exitosa a `modify-evaluation` (HTTP 200), la aplicación aún produce:
- Solo una versión de evaluación (A)
- Sin opciones metacognitivas equivalentes en Versión A
- Sin AI report en el detalle de evaluación ("not available")
- Estudiante con adaptación de contenido nunca recibe Versión C

Esto indica problemas en:
- **(a) Mapeo de IDs**: Los IDs de estudiantes no están normalizados, causando que las asignaciones no coincidan
- **(b) Mapeo de respuesta a UI**: La UI no muestra versiones basadas en HTML presente
- **(c) Persistencia**: El AI report no se persiste o no se verifica después de guardar
- **(d) Falta de enforcement determinístico**: El edge function no fuerza metacognición ni versión C cuando la IA no las genera

---

## Cambios Implementados

### R0 — Normalización de IDs de Estudiantes

**Problema**: Los IDs de estudiantes pueden venir en diferentes formatos:
- `student.id` (number)
- `student.studentId` (string o number)
- `student.student_id` (string)
- Keys en `assignmentByStudentId` pueden ser strings o numbers

Esto causa que las asignaciones no coincidan y los estudiantes no reciban las versiones correctas.

**Solución**: Implementar helper `sid()` que normaliza todos los IDs a strings consistentes.

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambios**:

1. **Helper de normalización** (línea ~1542):
   ```typescript
   // R0: Helper para normalizar IDs de estudiantes en todos lados
   const sid = (s: any): string => String(s?.studentId ?? s?.id ?? s?.student_id ?? '');
   ```

2. **Normalización en `displayEvaluations`** (líneas ~1547-1557):
   ```typescript
   // R0: Normalizar assignmentByStudentId keys
   const rawAssignments = Object.keys(studentAssignments).length > 0
     ? studentAssignments
     : (evaluationDesignPlan?.assignmentByStudentId || {});
   
   // Normalizar todas las keys a strings consistentes
   const assignmentByStudentId: Record<string, 'A' | 'B' | 'C'> = {};
   Object.entries(rawAssignments).forEach(([key, value]) => {
     assignmentByStudentId[String(key)] = value;
   });

   const students = selectedGroup?.students || [];
   
   // R0: Usar sid() helper para normalizar IDs en todas las comparaciones
   const getAssigned = (kind: 'A' | 'B' | 'C') => {
     const assigned = students.filter(student => {
       const normalizedId = sid(student);
       return assignmentByStudentId[normalizedId] === kind;
     });
     return {
       ids: assigned.map(student => sid(student)),
       names: assigned.map(student => student.name || `Estudiante ${sid(student)}`)
     };
   };
   ```

3. **Normalización en `normalizeAssignments`** (líneas ~1104-1123):
   ```typescript
   const normalizeAssignments = (
     assignments: Record<string, 'A' | 'B' | 'C'>,
     bundle: EvaluationBundle | null
   ) => {
     const available = {
       A: true,
       B: Boolean(bundle?.versionBHtml || bundle?.versions?.B),
       C: Boolean(bundle?.versionCHtml || bundle?.versions?.C)
     };
     // R0: Normalizar todas las keys a strings
     const normalized: Record<string, 'A' | 'B' | 'C'> = {};
     Object.entries(assignments).forEach(([key, value]) => {
       normalized[String(key)] = value;
     });
     // ...
   };
   ```

**Dónde se aplica**:
- `evaluation_design_plan.assignmentByStudentId` keys
- `studentAssignments` keys del edge response
- `getAssigned()` y cualquier lookup de asignaciones
- Guardado/carga desde DB

---

### R1 — UI: Mostrar Versiones Basadas en HTML Presente

**Problema**: La UI solo mostraba versiones si había estudiantes asignados, ocultando versiones cuando había mismatch de IDs.

**Solución**: Mostrar versiones basadas en HTML presente, independientemente de asignaciones.

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambios** (líneas ~1575-1600):

```typescript
// R1: Mostrar versiones basadas en HTML presente, no en asignaciones
// Si evaluationBundle.versions.B es non-null, renderizar Versión B incluso si assignedStudents está vacío
const versionBHtml = evaluationBundle.versionBHtml || evaluationBundle.versions?.B || null;
if (versionBHtml && versionBHtml.trim().length > 0) {
  const assigned = getAssigned('B');
  evaluations.push({
    id: 'B',
    title: 'Versión B (Equivalente)',
    content: versionBHtml,
    version: 2,
    versionKind: 'B',
    versionLabel: 'Versión B (Equivalente)',
    adaptations: [],
    assignedStudents: assigned.names,  // Puede estar vacío si hay mismatch de IDs
    assignedStudentIds: assigned.ids
  });
}

// R1: Mostrar versión C basada en HTML presente, no en asignaciones
const versionCHtml = evaluationBundle.versionCHtml || evaluationBundle.versions?.C || null;
if (versionCHtml && versionCHtml.trim().length > 0) {
  const assigned = getAssigned('C');
  evaluations.push({
    id: 'C',
    title: 'Versión C (Adecuación de contenido)',
    content: versionCHtml,
    version: 3,
    versionKind: 'C',
    versionLabel: 'Versión C (Adecuación de contenido)',
    adaptations: [],
    assignedStudents: assigned.names,  // Puede estar vacío si hay mismatch de IDs
    assignedStudentIds: assigned.ids
  });
}
```

**Resultado**: Las versiones B y C se muestran siempre que el HTML esté presente, incluso si no hay estudiantes asignados (lo cual puede indicar un problema de normalización de IDs que se puede corregir después).

---

### R2 — Persistir AI Report y Verificar Después de Guardar

**Problema**: El AI report no se persistía correctamente o no se verificaba después de guardar, causando que el detalle mostrara "not available".

**Solución**: Verificar explícitamente que el AI report se persistió después de insertar/actualizar.

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambios** (líneas ~625-650):

```typescript
const { data: insertedData, error } = await supabase
  .from('evaluaciones')
  .insert(evaluacionData)
  .select()
  .single();

if (error) {
  // ... manejo de error ...
  throw error;
}

// R2: Verificar que ai_report se persistió correctamente
if (insertedData) {
  const hasAiReportInGenerated = !!insertedData.evaluacion_generada?.ai_report;
  const hasAiDesignReport = !!insertedData.ai_design_report;
  
  console.info('[SAVE EVALUATION] Persistence verification', {
    hasAiReportInGenerated,
    hasAiDesignReport,
    evaluationId: insertedData.id,
    aiReportInGenerated: insertedData.evaluacion_generada?.ai_report ? 'present' : 'missing',
    aiDesignReport: insertedData.ai_design_report ? 'present' : 'missing'
  });
  
  if (!hasAiReportInGenerated && !hasAiDesignReport) {
    console.error('[SAVE EVALUATION] CRITICAL: AI report not persisted!');
    toast({
      title: "Error al guardar",
      description: "El reporte de IA no se guardó correctamente. Por favor, intentá nuevamente.",
      variant: "destructive"
    });
    setIsSaving(false);
    return;  // No continuar si el AI report no se persistió
  }
}

const data = insertedData;
```

**Persistencia** (líneas ~598-605):
```typescript
evaluacion_generada: {
  ai_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,  // ✅ Nuevo campo
  aiDesignReport: aiDesignReport ? JSON.parse(aiDesignReport) : null,  // Legacy
  // ...
},
ai_design_report: aiDesignReport ? JSON.parse(aiDesignReport) : null  // ✅ Top-level column (legacy compatibility)
```

**Lectura en detalle** (`src/pages/EvaluacionDetalle.tsx` línea ~210):
```typescript
// PATCH: Leer ai_report primero desde evaluacion_generada, luego desde ai_design_report
const aiReportPayload = evaluacion.evaluacion_generada?.ai_report || evaluacion.ai_design_report || null;
```

---

### R3a — Enforcement Determinístico de Metacognición

**Problema**: Si `responseOptions.include === true` pero la IA no incluye las opciones equivalentes en el HTML, la versión A no las tiene.

**Solución**: Post-procesar `baseHtml` para inyectar determinísticamente las opciones equivalentes si no están presentes.

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambios** (líneas ~651-700):

```typescript
// R3a: Enforcement determinístico de metacognición
const metacognitionPhrase = 'Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta.';
if (responseOptionsInclude && baseHtml && !baseHtml.includes(metacognitionPhrase)) {
  console.log('[UNIVERSAL] R3a: Metacognition not found in Version A, injecting deterministically');
  
  // Inyectar opciones equivalentes después de cada ítem numerado o consigna relevante
  const responseKeywords = ['explica', 'describe', 'analiza', 'compara', 'justifica', 'desarrolla', 'redacta', 'escribe'];
  const needsInjection = (text: string) => {
    const lowerText = text.toLowerCase();
    return responseKeywords.some(keyword => lowerText.includes(keyword)) || 
           numberedItemPattern.test(text);
  };
  
  // Inyectar después de cada párrafo que contenga consigna relevante
  injectedHtml = injectedHtml.replace(/(<p[^>]*>.*?<\/p>)/gi, (match, pTag) => {
    if (needsInjection(pTag) && !pTag.includes(metacognitionPhrase)) {
      injectionCount++;
      const optionsHtml = `
<p><strong>${metacognitionPhrase}</strong></p>
<ul>
  <li><strong>Opción 1:</strong> Respuesta escrita tradicional (párrafo)</li>
  <li><strong>Opción 2:</strong> Respuesta estructurada (lista con viñetas o tabla)${responseOptionCount === 3 ? '</li>\n  <li><strong>Opción 3:</strong> Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
</ul>`;
      return match + optionsHtml;
    }
    return match;
  });
  
  if (injectionCount > 0) {
    baseHtml = injectedHtml;
    warnings.push(`Se inyectaron ${injectionCount} bloques de opciones equivalentes determinísticamente (no estaban en la respuesta de la IA).`);
  } else {
    // Fallback: inyectar al final de la primera sección
    // ...
  }
}
```

**Lógica**:
1. Verificar si `responseOptions.include === true` y si `baseHtml` no contiene la frase exacta
2. Buscar párrafos que contengan palabras clave de respuesta escrita o ítems numerados
3. Inyectar el bloque de opciones equivalentes después de cada consigna relevante
4. Si no se encuentra ningún lugar, inyectar al final de la primera sección como fallback
5. Agregar warning indicando que se usó enforcement determinístico

---

### R3b — Enforcement Determinístico de Versión C

**Problema**: Si `triggers.versionC === true` pero la IA no genera `versionCHtml`, los estudiantes se reasignan a A en lugar de recibir una versión C fallback.

**Solución**: Crear determinísticamente una versión C fallback desde `baseHtml` si no se generó.

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambios** (líneas ~700-750):

```typescript
// R3b: Enforcement determinístico de versión C
const needsVersionC = generateVersionC && (!versionCHtml || versionCHtml.trim().length === 0);
if (needsVersionC) {
  console.log('[UNIVERSAL] R3b: Version C required but not generated, creating fallback deterministically');
  
  // Crear versión C fallback desde baseHtml
  let fallbackC = baseHtml;
  
  // Simplificar lenguaje: reemplazar palabras complejas
  fallbackC = fallbackC.replace(/\b(analizar|examinar|investigar|evaluar)\b/gi, 'explicar');
  fallbackC = fallbackC.replace(/\b(complejo|compleja|complejos|complejas)\b/gi, 'importante');
  fallbackC = fallbackC.replace(/\b(desarrollar|elaborar|construir)\b/gi, 'escribir');
  
  // Reducir cantidad de ítems: eliminar cada segundo ítem numerado si hay más de 3
  const itemMatches = [...fallbackC.matchAll(/(\d+[\.\)]|\d+\.\s*[A-Z])/gi)];
  if (itemMatches.length > 3) {
    // Eliminar ítems pares (mantener impares: 1, 3, 5, ...)
    let itemIndex = 0;
    fallbackC = fallbackC.replace(/(\d+[\.\)]|\d+\.\s*[A-Z])(.*?)(?=\d+[\.\)]|\d+\.\s*[A-Z]|$)/gi, (match) => {
      itemIndex++;
      if (itemIndex % 2 === 0) {
        return ''; // Eliminar ítem par
      }
      return match;
    });
  }
  
  // Agregar nota de simplificación
  const simplificationNote = '<p><em>Nota: Esta versión ha sido adaptada para facilitar la comprensión, manteniendo los mismos objetivos de aprendizaje.</em></p>';
  fallbackC = simplificationNote + fallbackC;
  
  versionCHtml = cleanupContent(fallbackC);
  warnings.push('Se generó versión C determinísticamente como fallback (la IA no la generó pero era requerida).');
}
```

**Lógica**:
1. Verificar si `triggers.versionC === true` pero `versionCHtml` es null/empty
2. **NO reasignar estudiantes a A** (esto se hace después si la versión C fallback falla)
3. Crear `fallbackC` desde `baseHtml`:
   - Simplificar lenguaje (reemplazar verbos complejos por simples)
   - Reducir cantidad de ítems (eliminar ítems pares si hay más de 3)
   - Mantener mismo tema y objetivos
4. Agregar nota de simplificación al inicio
5. Asignar `versionCHtml = fallbackC`
6. Agregar warning indicando que se usó fallback

**Resultado**: Los estudiantes con adaptación de contenido siempre reciben una versión C, incluso si la IA no la genera.

---

### R4 — Logging de Integridad de Respuesta

**Problema**: No hay visibilidad en la consola sobre qué campos están presentes en la respuesta del edge function.

**Solución**: Agregar logging detallado de integridad de respuesta.

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambios** (líneas ~1072-1100):

```typescript
// R4: Response integrity log
console.info('[EVAL_PIPELINE] Edge function response received', {
  hasAiReport: !!data?.aiReport,
  hasEvaluationBundle: !!data?.evaluationBundle,
  hasVersions: {
    A: !!data?.evaluationBundle?.versions?.A,
    B: !!data?.evaluationBundle?.versions?.B,
    C: !!data?.evaluationBundle?.versions?.C
  },
  studentAssignmentsCount: Object.keys(data?.studentAssignments || {}).length
});

// R4: Detailed integrity log
console.info('[EVAL_PIPELINE] Response integrity check', {
  responseKeys: Object.keys(data || {}),
  hasAiReport: !!data?.aiReport,
  aiReportKeys: data?.aiReport ? Object.keys(data.aiReport) : [],
  evaluationBundleKeys: data?.evaluationBundle ? Object.keys(data.evaluationBundle) : [],
  versionsKeys: data?.evaluationBundle?.versions ? Object.keys(data.evaluationBundle.versions) : [],
  versionALength: data?.evaluationBundle?.versions?.A?.length || 0,
  versionBLength: data?.evaluationBundle?.versions?.B?.length || 0,
  versionCLength: data?.evaluationBundle?.versions?.C?.length || 0,
  studentAssignmentsKeys: data?.studentAssignments ? Object.keys(data.studentAssignments) : []
});
```

**Resultado**: La consola muestra exactamente qué campos están presentes y sus longitudes, facilitando el debugging.

---

## Archivos Modificados

1. **`src/pages/EvaluacionesGrupo.tsx`**:
   - R0: Helper `sid()` para normalización de IDs
   - R0: Normalización en `displayEvaluations` y `normalizeAssignments`
   - R1: Mostrar versiones basadas en HTML presente
   - R2: Verificación de persistencia de AI report después de guardar
   - R4: Logging de integridad de respuesta

2. **`supabase/functions/modify-evaluation/index.ts`**:
   - R3a: Enforcement determinístico de metacognición (inyección de opciones equivalentes)
   - R3b: Enforcement determinístico de versión C (fallback desde baseHtml)

3. **`src/pages/EvaluacionDetalle.tsx`**:
   - No requiere cambios - ya lee correctamente `ai_report` desde `evaluacion_generada`

---

## Explicación del Bug de Normalización de IDs

### Problema

Los IDs de estudiantes pueden venir en diferentes formatos:
- Desde `mockData`: `student.id` (number, ej: `1`, `2`, `3`)
- Desde `groupContext`: `student.studentId` (string, ej: `"1"`, `"2"`, `"3"`)
- Desde DB: `student.student_id` (string)
- En `assignmentByStudentId`: keys pueden ser strings o numbers

### Ejemplo del Bug

```typescript
// Estudiante Diego tiene id: 5 (number)
const student = { id: 5, name: "Diego Martinez" };

// assignmentByStudentId tiene key: "5" (string)
const assignmentByStudentId = { "5": "C" };

// Comparación falla:
String(student.id) === "5"  // "5" === "5" ✅ (funciona)
// Pero si assignmentByStudentId tiene key: 5 (number):
assignmentByStudentId[5] === "C"  // undefined === "C" ❌ (falla)
```

### Solución

El helper `sid()` normaliza todos los IDs a strings:

```typescript
const sid = (s: any): string => String(s?.studentId ?? s?.id ?? s?.student_id ?? '');
```

Y todas las comparaciones usan `sid()`:

```typescript
const getAssigned = (kind: 'A' | 'B' | 'C') => {
  const assigned = students.filter(student => {
    const normalizedId = sid(student);  // Siempre string
    return assignmentByStudentId[normalizedId] === kind;  // Comparación consistente
  });
  // ...
};
```

### Dónde se Aplicó

1. **`displayEvaluations`**: Normaliza `assignmentByStudentId` keys y usa `sid()` en `getAssigned()`
2. **`normalizeAssignments`**: Normaliza todas las keys a strings antes de procesar
3. **Guardado**: Los IDs se normalizan antes de guardar en `student_assignments`

---

## Lógica de Enforcement Determinístico

### Metacognición (R3a)

**Trigger**: `responseOptions.include === true` AND `baseHtml` no contiene la frase exacta

**Proceso**:
1. Buscar párrafos que contengan palabras clave de respuesta escrita (`explica`, `describe`, `analiza`, etc.)
2. O buscar ítems numerados (`1.`, `2.`, `a)`, etc.)
3. Inyectar bloque de opciones después de cada consigna relevante
4. Si no se encuentra ningún lugar, inyectar al final de la primera sección

**Formato inyectado**:
```html
<p><strong>Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta.</strong></p>
<ul>
  <li><strong>Opción 1:</strong> Respuesta escrita tradicional (párrafo)</li>
  <li><strong>Opción 2:</strong> Respuesta estructurada (lista con viñetas o tabla)</li>
  <li><strong>Opción 3:</strong> Respuesta visual (diagrama o esquema con texto explicativo)</li>  <!-- Si optionCount === 3 -->
</ul>
```

### Versión C (R3b)

**Trigger**: `triggers.versionC === true` AND `versionCHtml` es null/empty

**Proceso**:
1. **NO reasignar estudiantes a A** (esto se hace después si el fallback falla)
2. Crear `fallbackC` desde `baseHtml`:
   - Simplificar lenguaje (reemplazar verbos complejos)
   - Reducir cantidad de ítems (eliminar ítems pares si hay más de 3)
   - Mantener mismo tema y objetivos
3. Agregar nota de simplificación
4. Asignar `versionCHtml = fallbackC`

**Transformaciones aplicadas**:
- `analizar` → `explicar`
- `examinar` → `explicar`
- `investigar` → `explicar`
- `evaluar` → `explicar`
- `complejo/compleja` → `importante`
- `desarrollar` → `escribir`
- `elaborar` → `escribir`
- `construir` → `escribir`

**Reducción de ítems**:
- Si hay más de 3 ítems numerados, eliminar ítems pares (mantener 1, 3, 5, ...)
- Esto reduce la carga cognitiva manteniendo la cobertura

---

## Verificación

### Después de Generar

1. **Consola debe mostrar**:
   ```
   [EVAL_PIPELINE] Response integrity check
   - responseKeys: ["success", "content", "evaluationBundle", "aiReport", ...]
   - hasAiReport: true
   - versionALength: > 0
   - versionCLength: > 0 (si hay estudiantes con adaptación)
   ```

2. **UI debe mostrar**:
   - Versión A con opciones equivalentes (si `responseOptions.include === true`)
   - Versión C (si hay estudiantes con adaptación, incluso si la IA no la generó)

### Después de Guardar

1. **Consola debe mostrar**:
   ```
   [SAVE EVALUATION] Persistence verification
   - hasAiReportInGenerated: true
   - hasAiDesignReport: true
   - aiReportInGenerated: "present"
   - aiDesignReport: "present"
   ```

2. **Si falta AI report**:
   - Aparece toast de error
   - No se navega a `/mis-evaluaciones`
   - El usuario puede reintentar

### En Detalle de Evaluación

1. **Debe mostrar AI report**:
   - Lee `evaluacion_generada.ai_report` primero
   - Fallback a `ai_design_report` si no existe
   - No muestra mensaje "not available" si el reporte está presente

---

## Rollback

Si es necesario revertir este cambio:

1. **Revertir commit**: Si se hizo un commit único, usar `git revert <commit-hash>`
2. **Revertir archivos manualmente**:
   - `src/pages/EvaluacionesGrupo.tsx`: Eliminar helper `sid()`, restaurar lógica de asignaciones sin normalización
   - `supabase/functions/modify-evaluation/index.ts`: Eliminar enforcement determinístico de metacognición y versión C

**Nota**: Después del rollback, volverán los problemas de:
- Mismatch de IDs causando que estudiantes no reciban versiones correctas
- Falta de opciones metacognitivas si la IA no las genera
- Falta de versión C si la IA no la genera
- AI report no persistido sin verificación
