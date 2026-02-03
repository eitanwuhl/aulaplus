# Diagnóstico: Desajuste entre Versiones Generadas, Asignaciones y Reporte de IA

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Tipo**: Diagnóstico (sin cambios de comportamiento)

---

## Resumen Ejecutivo

**Confianza**: Alta (90%)

**Causa raíz probable**:
1. **Versiones B/C no generadas**: El edge function puede retornar `versionBHtml: null` o `versionCHtml: null` incluso cuando el `evaluation_design_plan` indica que deben generarse (`triggers.versionB === true` o `triggers.versionC === true`).
2. **Asignaciones derivadas del plan, no de la realidad**: La UI muestra asignaciones basadas en `evaluationDesignPlan.assignmentByStudentId` o `data.studentAssignments`, pero no verifica si las versiones realmente existen en `evaluationBundle`.
3. **AI Report no retornado o no persistido**: El edge function puede no incluir `aiReport` en la respuesta, o puede no persistirse correctamente en la base de datos.

**Impacto**: 
- Los docentes ven asignaciones a versiones B/C que no existen.
- El panel "Reporte de IA" muestra "no disponible" cuando debería mostrar el reporte.
- Las opciones de respuesta metacognitivas pueden no estar incluidas en el HTML generado.

---

## Flujo de Datos End-to-End

### 1. UI Trigger → Service Call

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Función**: `handleGenerateEvaluations()` (línea 781)

**Flujo**:
1. Construye `evaluationDesignPlan` usando `buildEvaluationDesignPlan()` (línea 847)
2. Prepara `requestBody` con `generation_mode: 'universal'` y `evaluation_design_plan` (líneas 875-898)
3. Invoca `supabase.functions.invoke('modify-evaluation', { body: requestBody })` (línea 900)

**Código clave**:
```typescript:src/pages/EvaluacionesGrupo.tsx
const plan = buildEvaluationDesignPlan({
  groupContext: groupContextData,
  teacherRequirementsText: requerimientos
});

const requestBody: any = {
  originalEvaluation: basePrototype || generatePrototipo(...),
  modification: requerimientos || '...',
  groupContext,
  type: 'modification'
};

requestBody.generation_mode = 'universal';
requestBody.evaluation_design_plan = {
  instrumentDesignRules,
  responseOptions: effectivePlan.responseOptions,
  triggers: effectivePlan.triggers,
  assignmentByStudentId: effectivePlan.assignmentByStudentId,
  perStudentReminders: effectivePlan.perStudentReminders,
  // ... más campos
};

const { data, error } = await supabase.functions.invoke('modify-evaluation', {
  body: requestBody
});
```

---

### 2. Edge Function Request → Response

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Función**: `serve()` handler (línea 217)

**Request esperado** (líneas 224-240):
```typescript
{
  type: 'modification',
  generation_mode: 'universal',
  evaluation_design_plan: {
    instrumentDesignRules: string[],
    responseOptions: { include: boolean, optionCount: 1 | 2 | 3 },
    triggers: { versionB: boolean, versionC: boolean },
    assignmentByStudentId: Record<string, 'A' | 'B' | 'C'>,
    perStudentReminders: Array<{ studentId, admin, correction, allowances }>,
    // ... más campos
  },
  groupContext: { ... },
  modification: string
}
```

**Response esperado** (líneas 634-660):
```typescript
{
  success: true,
  content: string,  // HTML base (backward compatibility)
  evaluationBundle: {
    baseHtml: string,
    versionBHtml: string | null,
    versionCHtml: string | null,
    versions: { A: string, B: string | null, C: string | null },
    responseOptionsIncluded: boolean,
    responseOptionCount: number
  },
  studentAssignments: Record<string, 'A' | 'B' | 'C'>,
  teacherRemindersByStudent: Array<{ studentId, admin, correction, allowances }>,
  aiReport: {
    versions: { generated: string[], reason: string },
    contemplaciones: { ... },
    response_options: { ... },
    vark: { ... },
    assignments: { ... },
    warnings?: string[]
  } | null,
  warnings: string[]
}
```

**Problema identificado** (líneas 621-632):
- El edge function parsea `parsed.versions.B` y `parsed.versions.C` del JSON de OpenAI.
- Si OpenAI no genera B/C (aunque `generateVersionB === true`), retorna `null`.
- Agrega warnings, pero **no ajusta `studentAssignments`** para reflejar que B/C no existen.

**Código problemático**:
```typescript:supabase/functions/modify-evaluation/index.ts
const versionBHtml = cleanupContent(versions.B || parsed.version_b_html || parsed.versionBHtml || '');
const versionCHtml = cleanupContent(versions.C || parsed.version_c_html || parsed.versionCHtml || '');

if (generateVersionB && !versionBHtml) {
  warnings.push('La versión B estaba planificada pero no se generó; se reasignará a versión A.');
}
if (generateVersionC && !versionCHtml) {
  warnings.push('La versión C estaba planificada pero no se generó; se reasignará a versión A.');
}

// ❌ PROBLEMA: studentAssignments se retorna tal cual, sin ajustar
return new Response(JSON.stringify({
  // ...
  studentAssignments,  // ← Puede tener asignaciones a B/C que no existen
  // ...
}));
```

---

### 3. UI Processing → State Update

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Función**: `handleGenerateEvaluations()` (líneas 906-982)

**Flujo**:
1. Lee `data.studentAssignments` o usa `effectivePlan.assignmentByStudentId` como fallback (línea 906)
2. Normaliza asignaciones contra `evaluationBundle` disponible (líneas 907-925)
3. Actualiza estado: `setStudentAssignments(normalizedResult.normalized)` (línea 933)

**Código de normalización** (líneas 907-925):
```typescript:src/pages/EvaluacionesGrupo.tsx
const normalizeAssignments = (
  assignments: Record<string, 'A' | 'B' | 'C'>,
  bundle: EvaluationBundle | null
) => {
  const available = {
    A: true,
    B: Boolean(bundle?.versionBHtml),
    C: Boolean(bundle?.versionCHtml)
  };
  const normalized: Record<string, 'A' | 'B' | 'C'> = { ...assignments };
  const warnings: string[] = [];
  Object.entries(normalized).forEach(([studentId, version]) => {
    if (!available[version]) {
      normalized[studentId] = 'A';
      warnings.push(`Se reasignó ${studentId} a Versión A porque ${version} no fue generada.`);
    }
  });
  return { normalized, warnings };
};
```

**✅ CORRECTO**: La UI normaliza asignaciones contra versiones disponibles.

**Problema residual**: Si `data.evaluationBundle` no existe (fallback a legacy), las asignaciones no se normalizan (línea 952).

---

### 4. DB Persistence

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Función**: `handleSaveEvaluation()` (líneas 445-663)

**Campos persistidos** (líneas 551-587):
```typescript
evaluacion_generada: {
  evaluaciones: displayEvaluations,  // Legacy array
  base_prototype: basePrototype,
  evaluation_bundle: evaluationBundle,  // ✅ Nuevo bundle
  evaluation_design_plan: evaluationDesignPlan,  // ✅ Plan
  student_assignments: studentAssignments,  // ✅ Asignaciones normalizadas
  teacher_reminders_by_student: teacherReminders,  // ✅ Recordatorios
  ai_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,  // ⚠️ Puede ser null
  // ...
},
ai_design_report: aiDesignReport ? JSON.parse(aiDesignReport) : null  // ⚠️ Puede ser null
```

**Problema**: Si `aiDesignReport` es `null` en el estado, se persiste como `null` en ambos campos.

---

### 5. UI Re-read → Render

**Archivo**: `src/pages/EvaluacionDetalle.tsx`  
**Función**: `useEffect()` + `displayEvaluations` memo (líneas 83-292)

**Lectura de DB** (líneas 206-210):
```typescript:src/pages/EvaluacionDetalle.tsx
const evaluationBundle = evaluacion.evaluacion_generada?.evaluation_bundle;
const evaluationDesignPlan = evaluacion.evaluacion_generada?.evaluation_design_plan;
const rawAssignments = evaluacion.evaluacion_generada?.student_assignments 
  || evaluationDesignPlan?.assignmentByStudentId 
  || {};
const teacherReminders = evaluacion.evaluacion_generada?.teacher_reminders_by_student 
  || evaluationDesignPlan?.perStudentReminders 
  || [];
const aiReportPayload = evaluacion.evaluacion_generada?.ai_report 
  || evaluacion.ai_design_report 
  || null;
```

**Normalización de asignaciones** (líneas 212-227):
```typescript:src/pages/EvaluacionDetalle.tsx
const { normalizedAssignments, assignmentWarnings } = useMemo(() => {
  const available = {
    A: true,
    B: Boolean(evaluationBundle?.versionBHtml),
    C: Boolean(evaluationBundle?.versionCHtml)
  };
  const normalized: Record<string, 'A' | 'B' | 'C'> = { ...rawAssignments };
  const warnings: string[] = [];
  Object.entries(normalized).forEach(([studentId, version]) => {
    if (!available[version]) {
      normalized[studentId] = 'A';
      warnings.push(`Se reasignó ${studentId} a Versión A porque ${version} no fue generada.`);
    }
  });
  return { normalizedAssignments: normalized, assignmentWarnings: warnings };
}, [evaluationBundle, rawAssignments]);
```

**✅ CORRECTO**: La UI normaliza asignaciones al leer desde DB.

**Render de AI Report** (líneas 370-388):
```typescript:src/pages/EvaluacionDetalle.tsx
{aiReportPayload ? (
  <AIDesignReport
    reportData={aiReportPayload as AIDesignReportData}
    className="mt-4"
  />
) : (
  <Card className="border-l-4 border-amber-500 bg-amber-50">
    <CardContent>
      <p className="text-sm text-amber-700">
        El reporte de IA no está disponible para esta evaluación (legacy o generación previa).
      </p>
    </CardContent>
  </Card>
)}
```

**Problema**: Si `aiReportPayload` es `null`, muestra "no disponible" sin explicar por qué.

---

## Fuentes de Verdad

### a) Versiones Generadas

**Dónde se decide qué versiones existen**:
1. **Plan determinístico**: `src/services/evaluations/designPlan.ts` → `buildEvaluationDesignPlan()` calcula `triggers.versionB` y `triggers.versionC` (líneas 214-219).
2. **Edge function**: `supabase/functions/modify-evaluation/index.ts` → Parsea JSON de OpenAI y extrae `versions.A`, `versions.B`, `versions.C` (líneas 621-624).
3. **UI normalización**: `src/pages/EvaluacionesGrupo.tsx` → `normalizeAssignments()` verifica `bundle?.versionBHtml` y `bundle?.versionCHtml` (líneas 911-914).

**Forma actual del edge response**:
```typescript
{
  evaluationBundle: {
    baseHtml: string,           // ✅ Siempre presente
    versionBHtml: string | null, // ⚠️ Puede ser null aunque triggers.versionB === true
    versionCHtml: string | null, // ⚠️ Puede ser null aunque triggers.versionC === true
    versions: {
      A: string,
      B: string | null,
      C: string | null
    },
    responseOptionsIncluded: boolean,
    responseOptionCount: number
  }
}
```

**Problema**: El edge function no garantiza que B/C existan si `triggers.versionB === true` o `triggers.versionC === true`. OpenAI puede no generar esas versiones por:
- Límite de tokens
- Error en el prompt
- Interpretación incorrecta de las instrucciones

---

### b) Asignaciones de Estudiantes

**Dónde decide la UI cada estudiante A/B/C**:
1. **Plan determinístico**: `src/services/evaluations/designPlan.ts` → `buildEvaluationDesignPlan()` calcula `assignmentByStudentId` (líneas 221-236).
2. **Edge function response**: `supabase/functions/modify-evaluation/index.ts` → Retorna `studentAssignments` (línea 650), pero **no lo ajusta** si B/C no se generaron.
3. **UI normalización**: `src/pages/EvaluacionesGrupo.tsx` → `normalizeAssignments()` ajusta asignaciones contra versiones disponibles (líneas 907-925).

**Código exacto** (líneas 221-236 de `designPlan.ts`):
```typescript:src/services/evaluations/designPlan.ts
const assignmentByStudentId: Record<string, EvaluationVersionKind> = {};
for (const student of students) {
  assignmentByStudentId[String(student.studentId)] = 'A';  // Default: todos A
}

if (versionBTriggered) {
  for (const student of qualifyingStudents) {
    assignmentByStudentId[String(student.studentId)] = 'B';  // Asigna B
  }
}

if (versionCTriggered) {
  for (const studentId of contentAdaptationStudentIds) {
    assignmentByStudentId[studentId] = 'C';  // Asigna C (sobrescribe B si aplica)
  }
}
```

**Problema**: El plan asigna B/C basado en triggers determinísticos, pero el edge function puede no generar esas versiones. La UI normaliza, pero **solo si `evaluationBundle` existe**. Si el edge function retorna `content` sin `evaluationBundle` (fallback legacy), las asignaciones no se normalizan.

---

### c) AI Report (Reporte de IA)

**Dónde lee la UI el reporte**:
1. **Estado en generación**: `src/pages/EvaluacionesGrupo.tsx` → `aiDesignReport` (línea 437), actualizado desde `data?.aiReport` o `data?.aiDesignReport` (líneas 976-982).
2. **DB al leer**: `src/pages/EvaluacionDetalle.tsx` → `aiReportPayload` (línea 210), lee desde `evaluacion.evaluacion_generada?.ai_report` o `evaluacion.ai_design_report`.

**Clave en edge response**:
- `aiReport` (línea 652 de `modify-evaluation/index.ts`)
- Fallback: `aiDesignReport` (no usado en código actual)

**Persistencia en DB**:
- `evaluacion_generada.ai_report` (JSONB dentro de `evaluacion_generada`)
- `ai_design_report` (JSONB en columna raíz de `evaluaciones`)

**Condición que dispara "no disponible"**:
```typescript:src/pages/EvaluacionDetalle.tsx
const aiReportPayload = evaluacion.evaluacion_generada?.ai_report 
  || evaluacion.ai_design_report 
  || null;  // ← Si ambos son null/undefined, muestra "no disponible"
```

**Problema**: Si el edge function no retorna `aiReport`, o si OpenAI no lo genera en el JSON, el reporte nunca se persiste y la UI muestra "no disponible".

---

## Evidencia del Código

### Edge Function: Generación de Versiones

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 503-632

**Prompt para OpenAI** (líneas 506-575):
- Solicita JSON con `versions: { A, B, C }`
- `B` y `C` pueden ser `null` si no se generan
- No hay validación post-generación que fuerce B/C si `triggers.versionB === true`

**Parsing** (líneas 621-624):
```typescript:supabase/functions/modify-evaluation/index.ts
const versions = parsed.versions || {};
const baseHtml = cleanupContent(versions.A || parsed.base_html || parsed.baseHtml || '');
const versionBHtml = cleanupContent(versions.B || parsed.version_b_html || parsed.versionBHtml || '');
const versionCHtml = cleanupContent(versions.C || parsed.version_c_html || parsed.versionCHtml || '');
```

**⚠️ PROBLEMA**: Si `parsed.versions.B` es `null` o `undefined`, `versionBHtml` será `''` (string vacío), que luego se convierte a `null` en el bundle.

---

### UI: Normalización de Asignaciones

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Líneas**: 906-935

**Flujo**:
1. Lee `data.studentAssignments` o usa `effectivePlan.assignmentByStudentId`
2. Normaliza contra `data.evaluationBundle`
3. Actualiza estado con asignaciones normalizadas

**✅ CORRECTO**: La normalización funciona si `evaluationBundle` existe.

**⚠️ PROBLEMA**: Si `data.evaluationBundle` no existe (fallback legacy), las asignaciones no se normalizan (línea 952).

---

### UI: Lectura de AI Report

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Líneas**: 976-982

```typescript:src/pages/EvaluacionesGrupo.tsx
if (data?.aiReport) {
  setAiDesignReport(JSON.stringify(data.aiReport));
} else if (data?.aiDesignReport) {
  setAiDesignReport(JSON.stringify(data.aiDesignReport));
} else {
  setAiDesignReport(null);  // ← Si no existe, queda null
}
```

**Problema**: Si el edge function no retorna `aiReport`, el estado queda en `null` y nunca se persiste.

---

## Instrucciones para Reproducir en Dev Local

### 1. Generar Evaluación sin Versiones B/C

**Pantalla**: `/evaluaciones-grupo?grupo=<grupo-id>`

**Pasos**:
1. Seleccionar grupo con estudiantes que tengan contemplaciones de estructuración (ej: `contemplacion-13`, `contemplacion-23`).
2. Configurar evaluación con contenidos ANEP.
3. Generar evaluación.
4. Abrir DevTools → Network → Buscar llamada a `modify-evaluation`.
5. Inspeccionar respuesta:
   - Verificar `evaluationBundle.versionBHtml` y `evaluationBundle.versionCHtml` (deben ser `null` si no se generaron).
   - Verificar `studentAssignments` (puede tener asignaciones a B/C aunque no existan).
   - Verificar `aiReport` (puede ser `null`).

**Claves a buscar en la respuesta**:
```json
{
  "evaluationBundle": {
    "baseHtml": "...",
    "versionBHtml": null,  // ← Verificar si es null
    "versionCHtml": null,  // ← Verificar si es null
    "versions": { "A": "...", "B": null, "C": null }
  },
  "studentAssignments": { "1": "A", "2": "B", "3": "C" },  // ← Puede tener B/C aunque no existan
  "aiReport": null  // ← Puede ser null
}
```

---

### 2. Verificar Persistencia en DB

**Pantalla**: `/mis-evaluaciones` → Abrir evaluación guardada

**Pasos**:
1. Guardar evaluación generada.
2. Abrir evaluación desde "Mis Evaluaciones".
3. Abrir DevTools → Console → Ejecutar:
```javascript
// Leer evaluación desde Supabase
const { data } = await supabase
  .from('evaluaciones')
  .select('*')
  .eq('id', '<evaluation-id>')
  .single();

console.log('evaluation_bundle:', data.evaluacion_generada?.evaluation_bundle);
console.log('student_assignments:', data.evaluacion_generada?.student_assignments);
console.log('ai_report:', data.evaluacion_generada?.ai_report);
console.log('ai_design_report:', data.ai_design_report);
```

**Verificar**:
- `evaluation_bundle.versionBHtml` y `versionCHtml` deben ser `null` si no se generaron.
- `student_assignments` debe tener asignaciones normalizadas (solo A si B/C no existen).
- `ai_report` o `ai_design_report` deben existir si se generó el reporte.

---

### 3. Verificar Render en UI

**Pantalla**: `/evaluacion-detalle/<evaluation-id>`

**Pasos**:
1. Abrir evaluación guardada.
2. Verificar:
   - Panel "Asignaciones por estudiante": ¿Muestra asignaciones a B/C aunque no existan?
   - Panel "Reporte de IA": ¿Muestra "no disponible" aunque debería existir?

**Inspeccionar en DevTools**:
```javascript
// En React DevTools, inspeccionar estado del componente EvaluacionDetalle
// Buscar:
// - normalizedAssignments: debe tener solo A si B/C no existen
// - aiReportPayload: debe ser null si no se persistió
```

---

## Plan de Corrección (NO Implementado)

### 1. Edge Function: Ajustar `studentAssignments` si B/C no se generaron

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 627-660

**Cambio propuesto**:
```typescript
// Después de parsear versiones
const warnings: string[] = Array.isArray(parsed.ai_report?.warnings) ? parsed.ai_report.warnings : [];

// Ajustar studentAssignments si B/C no se generaron
const adjustedAssignments = { ...studentAssignments };
if (generateVersionB && !versionBHtml) {
  warnings.push('La versión B estaba planificada pero no se generó; se reasignará a versión A.');
  // Reasignar estudiantes de B a A
  Object.keys(adjustedAssignments).forEach(studentId => {
    if (adjustedAssignments[studentId] === 'B') {
      adjustedAssignments[studentId] = 'A';
    }
  });
}
if (generateVersionC && !versionCHtml) {
  warnings.push('La versión C estaba planificada pero no se generó; se reasignará a versión A.');
  // Reasignar estudiantes de C a A
  Object.keys(adjustedAssignments).forEach(studentId => {
    if (adjustedAssignments[studentId] === 'C') {
      adjustedAssignments[studentId] = 'A';
    }
  });
}

return new Response(JSON.stringify({
  // ...
  studentAssignments: adjustedAssignments,  // ← Usar asignaciones ajustadas
  // ...
}));
```

**Impacto**: Las asignaciones retornadas por el edge function reflejarán la realidad de versiones generadas.

---

### 2. Edge Function: Validar y Forzar Generación de B/C si `triggers` lo requiere

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 577-632

**Cambio propuesto**:
```typescript
// Después de parsear JSON de OpenAI
if (generateVersionB && !versionBHtml) {
  // Reintentar generación de B con prompt más explícito
  console.warn('[UNIVERSAL] Versión B no generada, reintentando...');
  // ... lógica de reintento o fallback
}

if (generateVersionC && !versionCHtml) {
  // Reintentar generación de C con prompt más explícito
  console.warn('[UNIVERSAL] Versión C no generada, reintentando...');
  // ... lógica de reintento o fallback
}
```

**Impacto**: Mayor probabilidad de que B/C se generen si los triggers lo requieren.

---

### 3. Edge Function: Garantizar `aiReport` en la respuesta

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 604-632

**Cambio propuesto**:
```typescript
const aiReport = parsed.ai_report || {
  versions: {
    generated: ['A'],
    reason: 'Solo se generó la versión base universal.'
  },
  contemplaciones: {
    instrument_design: instrumentDesignRules,
    admin_reminders: [],
    correction_reminders: []
  },
  response_options: {
    included: responseOptionsInclude,
    optionCount: responseOptionCount,
    rationale: responseOptionsInclude 
      ? `Incluidas ${responseOptionCount} opciones equivalentes por necesidad de estructuración.`
      : 'No se incluyeron opciones equivalentes.'
  },
  vark: {
    summary: `Distribución VARK: V=${varkDistribution.visual}, A=${varkDistribution.auditory}, R=${varkDistribution.readWrite}, K=${varkDistribution.kinesthetic}`
  },
  assignments: {
    rationale: 'Asignaciones determinadas por contemplaciones y necesidades del grupo.'
  },
  warnings: warnings
};

return new Response(JSON.stringify({
  // ...
  aiReport,  // ← Siempre presente, incluso si OpenAI no lo generó
  // ...
}));
```

**Impacto**: El reporte siempre estará presente, incluso si OpenAI no lo genera explícitamente.

---

### 4. UI: Normalizar Asignaciones en Fallback Legacy

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Líneas**: 936-954

**Cambio propuesto**:
```typescript
} else {
  // Fallback legacy: normalizar asignaciones contra versiones disponibles (solo A)
  const content = data?.content || basePrototype || generatePrototipo(...);
  setEvaluationBundle(null);
  setGeneratedEvaluations([{
    id: 'A',
    // ...
  }]);
  
  // Normalizar asignaciones: todas a A si no hay bundle
  const legacyNormalized: Record<string, 'A' | 'B' | 'C'> = {};
  Object.keys(rawAssignments).forEach(studentId => {
    legacyNormalized[studentId] = 'A';  // Forzar A en fallback legacy
  });
  setStudentAssignments(legacyNormalized);
  setAssignmentWarnings(['Modo legacy: todas las asignaciones fueron normalizadas a Versión A.']);
}
```

**Impacto**: Las asignaciones se normalizan incluso en modo legacy.

---

### 5. UI: Mejorar Mensaje "Reporte No Disponible"

**Archivo**: `src/pages/EvaluacionDetalle.tsx`  
**Líneas**: 376-388

**Cambio propuesto**:
```typescript
) : (
  <Card className="border-l-4 border-amber-500 bg-amber-50">
    <CardHeader>
      <CardTitle className="text-sm text-amber-800">
        Reporte de IA
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-amber-700">
        El reporte de IA no está disponible para esta evaluación.
      </p>
      <p className="text-xs text-amber-600 mt-2">
        Posibles causas: evaluación generada antes de implementar reportes, o error en la generación.
      </p>
    </CardContent>
  </Card>
)}
```

**Impacto**: Mensaje más informativo para el docente.

---

## Notas de Seguridad

### Compatibilidad Hacia Atrás

1. **Evaluaciones legacy**: Las evaluaciones guardadas antes de implementar `evaluationBundle` deben seguir funcionando. El código actual tiene fallback a `evaluaciones[]` (línea 231 de `EvaluacionDetalle.tsx`).

2. **Asignaciones legacy**: Si no hay `student_assignments` en DB, la UI usa `evaluationDesignPlan.assignmentByStudentId` como fallback (línea 208 de `EvaluacionDetalle.tsx`).

3. **AI Report legacy**: Si no hay `ai_report` ni `ai_design_report`, la UI muestra mensaje informativo sin romper (líneas 376-388 de `EvaluacionDetalle.tsx`).

### Evitar Cambios Rompedores

1. **No modificar estructura de `evaluationBundle`**: Mantener `baseHtml`, `versionBHtml`, `versionCHtml`, `versions` como están.

2. **No cambiar claves de DB**: Mantener `evaluacion_generada.evaluation_bundle`, `evaluacion_generada.student_assignments`, `evaluacion_generada.ai_report`, `ai_design_report`.

3. **No eliminar fallbacks**: Mantener todos los fallbacks a legacy en `EvaluacionDetalle.tsx` y `EvaluacionesGrupo.tsx`.

---

## Conclusión

**Causa raíz confirmada**:
1. El edge function no ajusta `studentAssignments` si B/C no se generan.
2. El edge function puede no retornar `aiReport` si OpenAI no lo genera.
3. La UI normaliza asignaciones, pero solo si `evaluationBundle` existe (no en fallback legacy).

**Prioridad de corrección**:
1. **Alta**: Ajustar `studentAssignments` en edge function si B/C no se generan.
2. **Media**: Garantizar `aiReport` siempre presente (con fallback si OpenAI no lo genera).
3. **Baja**: Normalizar asignaciones en fallback legacy (mejora UX, no crítico).

**Riesgo de implementación**: Bajo (cambios aislados, backward compatible).

---

**Fin del Diagnóstico**
