# Parche: Versiones B/C, Asignaciones y Reporte de IA

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Tipo**: Parche crítico

---

## Root Cause

### Problema 1: Asignaciones a Versiones Inexistentes

**Ubicación**: `supabase/functions/modify-evaluation/index.ts` (líneas 627-650)

**Causa**: El edge function detecta cuando B/C no se generaron (líneas 627-632) y agrega warnings, pero **no ajusta `studentAssignments`** antes de retornarlo. La UI normaliza después, pero solo si `evaluationBundle` existe.

**Evidencia**:
```typescript
// Línea 627-632: Detecta problema pero no corrige
if (generateVersionB && !versionBHtml) {
  warnings.push('La versión B estaba planificada pero no se generó...');
}
// ...
// Línea 650: Retorna studentAssignments sin ajustar
studentAssignments,  // ← Puede tener asignaciones a B/C que no existen
```

---

### Problema 2: AI Report Faltante

**Ubicación**: `supabase/functions/modify-evaluation/index.ts` (línea 652)

**Causa**: Si OpenAI no genera `ai_report` en el JSON, se retorna `null`. No hay fallback mínimo.

**Evidencia**:
```typescript
// Línea 652: Retorna null si OpenAI no lo generó
aiReport: parsed.ai_report || null,  // ← Puede ser null
```

---

### Problema 3: Opciones de Respuesta No Incluidas

**Ubicación**: `supabase/functions/modify-evaluation/index.ts` (líneas 520-523, 562-564)

**Causa**: El prompt menciona opciones equivalentes pero no es suficientemente explícito sobre **incluirlas en el HTML generado**. OpenAI puede no incluirlas en el contenido.

**Evidencia**:
```typescript
// Línea 520-523: Menciona opciones pero no fuerza inclusión
RESPUESTAS CON OPCIONES EQUIVALENTES:
- Si corresponde, cada consigna debe incluir "Elige UNA opción. Todas equivalentes."
// ← "Si corresponde" es ambiguo
```

---

### Problema 4: Versiones B/C No Forzadas

**Ubicación**: `supabase/functions/modify-evaluation/index.ts` (líneas 566-575)

**Causa**: El prompt dice "Si se pide, genera versión B/C" pero no fuerza la generación si los triggers lo requieren. OpenAI puede omitirlas por límite de tokens o interpretación incorrecta.

**Evidencia**:
```typescript
// Línea 566-568: Instrucción condicional, no obligatoria
VERSIONES:
- Generar versión B equivalente: ${generateVersionB ? 'Sí' : 'No'}
- Generar versión C con adecuación de contenido: ${generateVersionC ? 'Sí' : 'No'}

TAREA:
2. Si se pide, genera versión B equivalente...  // ← "Si se pide" es débil
```

---

## Patch

### Parche 1: Ajustar `studentAssignments` en Edge Function

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 621-660

**Cambio**:
```typescript
const versions = parsed.versions || {};
const baseHtml = cleanupContent(versions.A || parsed.base_html || parsed.baseHtml || '');
const versionBHtml = cleanupContent(versions.B || parsed.version_b_html || parsed.versionBHtml || '');
const versionCHtml = cleanupContent(versions.C || parsed.version_c_html || parsed.versionCHtml || '');
const warnings: string[] = Array.isArray(parsed.ai_report?.warnings) ? parsed.ai_report.warnings : [];

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
  success: true,
  content: baseHtml || '',
  type: type,
  evaluationBundle: {
    baseHtml,
    versionBHtml: versionBHtml || null,
    versionCHtml: versionCHtml || null,
    versions: {
      A: baseHtml || '',
      B: versionBHtml || null,
      C: versionCHtml || null
    },
    responseOptionsIncluded: parsed.response_options_included === true,
    responseOptionCount: parsed.response_option_count || responseOptionCount
  },
  studentAssignments: adjustedAssignments,  // ← Usar asignaciones ajustadas
  teacherRemindersByStudent,
  aiReport: parsed.ai_report || null,
  warnings,
  metadata: {
    tokensUsed: result.usage?.total_tokens || 0,
    model: result.model || 'gpt-4.1-2025-04-14'
  }
}), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
```

---

### Parche 2: Garantizar `aiReport` Siempre Presente

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 625-652

**Cambio**:
```typescript
const warnings: string[] = Array.isArray(parsed.ai_report?.warnings) ? parsed.ai_report.warnings : [];

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

// ... resto del código ...

return new Response(JSON.stringify({
  // ...
  aiReport,  // ← Siempre presente, nunca null
  // ...
}));
```

---

### Parche 3: Forzar Inclusión de Opciones de Respuesta en Prompt

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 520-523

**Cambio**:
```typescript
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

### Parche 4: Forzar Generación de Versiones B/C en Prompt

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 566-575

**Cambio**:
```typescript
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
5. En ai_report usa lenguaje docente simple (sin jerga técnica) y NO incluyas nombres de estudiantes.
```

---

### Parche 5: Normalizar Asignaciones en Fallback Legacy (UI)

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`  
**Líneas**: 936-954

**Cambio**:
```typescript
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

## Verification

### Checklist Manual de Verificación

#### 1. Verificar Asignaciones Ajustadas

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

#### 2. Verificar AI Report Siempre Presente

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

#### 3. Verificar Opciones de Respuesta en HTML

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

#### 4. Verificar Persistencia en DB

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

#### 5. Verificar Render en UI (EvaluacionDetalle)

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

#### 6. Verificar Versiones B/C Forzadas (Opcional)

**Pantalla**: `/evaluaciones-grupo?grupo=<grupo-id>`

**Pasos**:
1. Seleccionar grupo con:
   - Al menos 30% de estudiantes con 2+ contemplaciones de estructuración.
   - Al menos 6 contemplaciones de diseño de instrumento.
2. Generar evaluación.
3. Verificar:
   - ✅ `evaluationBundle.versionBHtml` debe existir (no `null`).
   - ✅ `studentAssignments` debe tener asignaciones a B para estudiantes calificados.

**Nota**: Este test es opcional porque depende de que OpenAI genere B/C correctamente. Si no se generan, los warnings y ajustes de asignaciones deben funcionar.

---

## Resumen de Cambios

### Archivos Modificados

1. **`supabase/functions/modify-evaluation/index.ts`**:
   - Ajustar `studentAssignments` si B/C no se generan (líneas 621-650).
   - Garantizar `aiReport` siempre presente con fallback (líneas 625-652).
   - Forzar inclusión de opciones de respuesta en prompt (líneas 520-523).
   - Forzar generación de B/C en prompt (líneas 566-575).

2. **`src/pages/EvaluacionesGrupo.tsx`**:
   - Normalizar asignaciones en fallback legacy (líneas 936-954).

### Backward Compatibility

- ✅ Evaluaciones legacy (sin `evaluationBundle`) siguen funcionando.
- ✅ Asignaciones legacy se normalizan a A en fallback.
- ✅ AI Report legacy muestra mensaje informativo si no existe.

### Riesgo

- **Bajo**: Cambios aislados, backward compatible, no rompe funcionalidad existente.

---

**Fin del Parche**
