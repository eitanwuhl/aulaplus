# Implementación: Parche Versiones B/C, Asignaciones y Reporte de IA

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Tipo**: Parche crítico implementado

---

## Archivos Editados

1. `supabase/functions/modify-evaluation/index.ts` (+79 líneas, -13 líneas)
2. `src/pages/EvaluacionesGrupo.tsx` (+8 líneas, -4 líneas)

---

## Cambios Aplicados

### 1. Edge Function: Ajustar `studentAssignments` si B/C no se generan

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 647-668

**Cambio**:
```typescript
// ANTES:
if (generateVersionB && !versionBHtml) {
  warnings.push('La versión B estaba planificada pero no se generó; se reasignará a versión A.');
}
if (generateVersionC && !versionCHtml) {
  warnings.push('La versión C estaba planificada pero no se generó; se reasignará a versión A.');
}

return new Response(JSON.stringify({
  // ...
  studentAssignments,  // ← Sin ajustar
  // ...
}));

// DESPUÉS:
// PATCH 1: Ajustar studentAssignments si B/C no se generaron
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
  studentAssignments: adjustedAssignments,  // ← Ajustado
  // ...
}));
```

---

### 2. Edge Function: Garantizar `aiReport` siempre presente

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 670-702

**Cambio**:
```typescript
// ANTES:
return new Response(JSON.stringify({
  // ...
  aiReport: parsed.ai_report || null,  // ← Puede ser null
  // ...
}));

// DESPUÉS:
// PATCH 2: Construir aiReport con fallback si OpenAI no lo generó
const aiReportFromAI = parsed.ai_report;
const generatedVersions: string[] = ['A'];
if (versionBHtml) generatedVersions.push('B');
if (versionCHtml) generatedVersions.push('C');

const aiReport = aiReportFromAI || {
  versions: {
    generated: generatedVersions,
    reason: generatedVersions.length === 1
      ? 'Solo se generó la versión base universal.'
      : `Se generaron las versiones ${generatedVersions.join(', ')} según las necesidades del grupo.`
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
      ? `Se incluyeron ${responseOptionCount} opciones equivalentes de respuesta por necesidad de estructuración y diversidad de formatos.`
      : 'No se incluyeron opciones equivalentes de respuesta.'
  },
  vark: {
    summary: `Distribución VARK: Visual=${varkDistribution.visual || 0}, Auditivo=${varkDistribution.auditory || 0}, Lecto-escritor=${varkDistribution.readWrite || 0}, Kinestésico=${varkDistribution.kinesthetic || 0}`
  },
  assignments: {
    rationale: 'Asignaciones determinadas por contemplaciones y necesidades del grupo.'
  },
  warnings: warnings
};

return new Response(JSON.stringify({
  // ...
  aiReport,  // ← Siempre presente, nunca null
  // ...
}));
```

---

### 3. Edge Function: Fortalecer prompt para opciones de respuesta

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 520-531

**Cambio**:
```typescript
// ANTES:
RESPUESTAS CON OPCIONES EQUIVALENTES:
- Si corresponde, cada consigna debe incluir "Elige UNA opción. Todas equivalentes."
- Opciones equivalentes en dificultad y evidencia, solo cambia el formato de respuesta
- Máximo ${responseOptionCount} opciones cuando se solicitan opciones

// DESPUÉS:
RESPUESTAS CON OPCIONES EQUIVALENTES:
${responseOptionsInclude ? `
- OBLIGATORIO: Cada consigna que requiera respuesta escrita debe incluir ${responseOptionCount} opciones equivalentes de formato.
- Formato requerido: "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
- Ejemplo de opciones:
  * Opción 1: Respuesta escrita tradicional (párrafo)
  * Opción 2: Respuesta estructurada (lista con viñetas o tabla)
  ${responseOptionCount === 3 ? '  * Opción 3: Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
- Las opciones deben aparecer INMEDIATAMENTE después de cada consigna relevante.
` : `
- NO incluir opciones equivalentes de respuesta.
`}
```

---

### 4. Edge Function: Fortalecer prompt para versiones B/C

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 574-593

**Cambio**:
```typescript
// ANTES:
VERSIONES:
- Generar versión B equivalente: ${generateVersionB ? 'Sí' : 'No'}
- Generar versión C con adecuación de contenido: ${generateVersionC ? 'Sí' : 'No'}

TAREA:
1. Genera la versión base (A) universal.
2. Si se pide, genera versión B equivalente (solo cambia formato, misma evidencia).
3. Si se pide, genera versión C con adecuación de contenido (solo para estudiantes explícitos).
4. Devuelve únicamente el JSON solicitado.
5. En ai_report usa lenguaje docente simple (sin jerga técnica) y NO incluyas nombres de estudiantes.`;

// DESPUÉS:
VERSIONES:
${generateVersionB ? `
- OBLIGATORIO: Generar versión B equivalente (solo cambia formato, misma evidencia).
- La versión B debe ser funcionalmente equivalente a la A pero con formato diferente.
- Si no generas versión B, la evaluación será incompleta.
` : `
- NO generar versión B.
`}
${generateVersionC ? `
- OBLIGATORIO: Generar versión C con adecuación de contenido (solo para estudiantes explícitos).
- La versión C debe adaptar el contenido manteniendo los objetivos de aprendizaje.
- Si no generas versión C, la evaluación será incompleta.
` : `
- NO generar versión C.
`}

TAREA:
1. Genera la versión base (A) universal. ${generateVersionB ? 'OBLIGATORIO: También genera versión B.' : ''} ${generateVersionC ? 'OBLIGATORIO: También genera versión C.' : ''}
2. ${generateVersionB ? 'Versión B: equivalente en formato, misma evidencia.' : 'No generar versión B.'}
3. ${generateVersionC ? 'Versión C: adecuación de contenido para estudiantes específicos.' : 'No generar versión C.'}
4. Devuelve únicamente el JSON solicitado con TODAS las versiones requeridas.
5. En ai_report usa lenguaje docente simple (sin jerga técnica) y NO incluyas nombres de estudiantes.`;
```

---

### 5. UI: Normalizar asignaciones en fallback legacy

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Líneas**: 936-960

**Cambio**:
```typescript
// ANTES:
} else {
  const content = data?.content || basePrototype || generatePrototipo(selectedSubtemas, requerimientos, 1);
  setEvaluationBundle(null);
  setGeneratedEvaluations([
    {
      id: 'A',
      version: 1,
      versionKind: 'A',
      versionLabel: 'Versión A (Universal)',
      title: 'Versión A (Universal)',
      content,
      adaptations: [],
      assignedStudents: [],
      assignedStudentIds: []
    }
  ]);
  setStudentAssignments(rawAssignments);
  setAssignmentWarnings([]);
}

// DESPUÉS:
} else {
  // Fallback legacy: normalizar asignaciones contra versiones disponibles (solo A)
  const content = data?.content || basePrototype || generatePrototipo(selectedSubtemas, requerimientos, 1);
  setEvaluationBundle(null);
  setGeneratedEvaluations([
    {
      id: 'A',
      version: 1,
      versionKind: 'A',
      versionLabel: 'Versión A (Universal)',
      title: 'Versión A (Universal)',
      content,
      adaptations: [],
      assignedStudents: [],
      assignedStudentIds: []
    }
  ]);
  
  // PATCH 5: Normalizar asignaciones en fallback legacy (todas a A)
  const legacyNormalized: Record<string, 'A' | 'B' | 'C'> = {};
  Object.keys(rawAssignments).forEach(studentId => {
    legacyNormalized[studentId] = 'A';  // Forzar A en fallback legacy
  });
  setStudentAssignments(legacyNormalized);
  setAssignmentWarnings(['Modo legacy: todas las asignaciones fueron normalizadas a Versión A.']);
}
```

---

### 6. UI: Leer `data.aiReport` primero

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Líneas**: 983-990

**Cambio**:
```typescript
// ANTES:
if (data?.aiReport) {
  setAiDesignReport(JSON.stringify(data.aiReport));
} else if (data?.aiDesignReport) {
  setAiDesignReport(JSON.stringify(data.aiDesignReport));
} else {
  setAiDesignReport(null);
}

// DESPUÉS:
// PATCH 6: Leer data.aiReport primero, luego legacy aiDesignReport
if (data?.aiReport) {
  setAiDesignReport(JSON.stringify(data.aiReport));
} else if (data?.aiDesignReport) {
  setAiDesignReport(JSON.stringify(data.aiDesignReport));
} else {
  setAiDesignReport(null);
}
```

**Nota**: El código ya leía `data.aiReport` primero, pero se agregó un comentario para claridad. El título "Reporte de IA" ya estaba correcto en ambos archivos (`EvaluacionesGrupo.tsx` línea 1930, `EvaluacionDetalle.tsx` línea 379).

---

## Checklist de Verificación Manual

### ✅ 1. Verificar Asignaciones Ajustadas

**Pantalla**: `/evaluaciones-grupo?grupo=<grupo-id>`

**Pasos**:
1. Seleccionar grupo con estudiantes que tengan contemplaciones de estructuración (ej: `contemplacion-13`, `contemplacion-23`).
2. Configurar evaluación con contenidos ANEP.
3. Generar evaluación.
4. Abrir DevTools → Network → Buscar llamada a `modify-evaluation`.
5. Inspeccionar respuesta:
   - ✅ Verificar `evaluationBundle.versionBHtml` y `versionCHtml` (pueden ser `null` si no se generaron).
   - ✅ Verificar `studentAssignments`: **NO debe tener asignaciones a B/C si `versionBHtml` o `versionCHtml` son `null`**.
   - ✅ Verificar `warnings`: debe incluir mensaje si B/C no se generaron.

**Resultado esperado**:
```json
{
  "evaluationBundle": {
    "versionBHtml": null,
    "versionCHtml": null
  },
  "studentAssignments": {
    "1": "A",
    "2": "A",  // ← Debe ser A, no B
    "3": "A"   // ← Debe ser A, no C
  },
  "warnings": [
    "La versión B estaba planificada pero no se generó; se reasignará a versión A.",
    "La versión C estaba planificada pero no se generó; se reasignará a versión A."
  ]
}
```

---

### ✅ 2. Verificar AI Report Siempre Presente

**Pantalla**: `/evaluaciones-grupo?grupo=<grupo-id>`

**Pasos**:
1. Generar evaluación.
2. Abrir DevTools → Network → Inspeccionar respuesta de `modify-evaluation`.
3. Verificar `aiReport`:
   - ✅ **Debe existir** (no `null`).
   - ✅ Debe tener `versions.generated` con al menos `["A"]`.
   - ✅ Debe tener `response_options.included` y `response_options.optionCount`.
   - ✅ Debe tener `vark.summary`.

**Resultado esperado**:
```json
{
  "aiReport": {
    "versions": {
      "generated": ["A"],
      "reason": "Solo se generó la versión base universal."
    },
    "response_options": {
      "included": true,
      "optionCount": 2,
      "rationale": "Se incluyeron 2 opciones equivalentes..."
    },
    "vark": {
      "summary": "Distribución VARK: Visual=5, Auditivo=3..."
    }
  }
}
```

4. Verificar en UI:
   - ✅ Panel "Reporte de IA" debe estar visible.
   - ✅ No debe mostrar "no disponible".
   - ✅ Debe mostrar justificación, opciones de respuesta, y distribución VARK.

---

### ✅ 3. Verificar Opciones de Respuesta en HTML

**Pantalla**: `/evaluaciones-grupo?grupo=<grupo-id>`

**Pasos**:
1. Generar evaluación con grupo que tenga contemplaciones de estructuración (para activar `responseOptions.include === true`).
2. Inspeccionar HTML generado en `evaluationBundle.baseHtml`.
3. Buscar en el HTML:
   - ✅ Texto "Elige UNA opción. Todas equivalentes."
   - ✅ Múltiples opciones de formato por consigna (escrita, estructurada, visual si `optionCount === 3`).

**Resultado esperado**:
```html
<strong>1. Consigna de ejemplo</strong>
<p>Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta.</p>
<ul>
  <li><strong>Opción 1:</strong> Respuesta escrita tradicional (párrafo)</li>
  <li><strong>Opción 2:</strong> Respuesta estructurada (lista con viñetas o tabla)</li>
  <li><strong>Opción 3:</strong> Respuesta visual (diagrama o esquema con texto explicativo)</li>
</ul>
```

---

### ✅ 4. Verificar Persistencia en DB

**Pantalla**: `/mis-evaluaciones` → Abrir evaluación guardada

**Pasos**:
1. Guardar evaluación generada.
2. Abrir evaluación desde "Mis Evaluaciones".
3. Abrir DevTools → Console → Ejecutar:
```javascript
const { data } = await supabase
  .from('evaluaciones')
  .select('*')
  .eq('id', '<evaluation-id>')
  .single();

console.log('student_assignments:', data.evaluacion_generada?.student_assignments);
console.log('ai_report:', data.evaluacion_generada?.ai_report);
console.log('ai_design_report:', data.ai_design_report);
```

**Verificar**:
- ✅ `student_assignments`: Solo debe tener asignaciones a versiones que existen (A siempre, B/C solo si existen).
- ✅ `ai_report` o `ai_design_report`: **Debe existir** (no `null`).

---

### ✅ 5. Verificar Render en UI (EvaluacionDetalle)

**Pantalla**: `/evaluacion-detalle/<evaluation-id>`

**Pasos**:
1. Abrir evaluación guardada.
2. Verificar:
   - ✅ Panel "Asignaciones por estudiante": Solo debe mostrar asignaciones a versiones que existen.
   - ✅ Panel "Reporte de IA": Debe estar visible con contenido (no "no disponible").
   - ✅ Si hay warnings, deben mostrarse en panel de advertencias.

**Inspeccionar en DevTools**:
```javascript
// En React DevTools, inspeccionar estado del componente EvaluacionDetalle
// Buscar:
// - normalizedAssignments: debe tener solo A si B/C no existen
// - aiReportPayload: debe existir (no null)
```

---

### ✅ 6. Verificar Fallback Legacy

**Pantalla**: `/evaluaciones-grupo?grupo=<grupo-id>`

**Pasos**:
1. Generar evaluación que retorne solo `content` (sin `evaluationBundle`).
2. Verificar:
   - ✅ Panel de advertencias debe mostrar "Modo legacy: todas las asignaciones fueron normalizadas a Versión A."
   - ✅ `studentAssignments` debe tener todas las asignaciones como 'A'.

---

## Resumen

### Cambios Implementados

1. ✅ Edge function ajusta `studentAssignments` si B/C no se generan.
2. ✅ Edge function garantiza `aiReport` siempre presente (fallback mínimo).
3. ✅ Prompt fortalecido para opciones de respuesta (obligatorio cuando `responseOptionsInclude === true`).
4. ✅ Prompt fortalecido para versiones B/C (obligatorio cuando `generateVersionB/C === true`).
5. ✅ UI normaliza asignaciones en fallback legacy (todas a A).
6. ✅ UI lee `data.aiReport` primero (ya estaba implementado, comentario agregado).

### Backward Compatibility

- ✅ Evaluaciones legacy (sin `evaluationBundle`) siguen funcionando.
- ✅ Asignaciones legacy se normalizan a A en fallback.
- ✅ AI Report legacy muestra mensaje informativo si no existe.
- ✅ No hay cambios en esquema de DB.
- ✅ No hay nuevas dependencias.

### Riesgo

- **Bajo**: Cambios aislados, backward compatible, no rompe funcionalidad existente.

---

**Fin de la Implementación**
