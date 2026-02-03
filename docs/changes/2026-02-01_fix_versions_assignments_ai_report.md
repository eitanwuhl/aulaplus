# Fix Robusto: Versiones, Asignaciones y Reporte de IA

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Tipo**: Fix crítico - Consistencia de datos

---

## Resumen Ejecutivo

Se implementó un fix robusto para garantizar que `studentAssignments` y `aiReport` siempre sean consistentes con las versiones realmente generadas, sin depender de variables fuera de scope.

**Cambios principales**:
1. ✅ `studentAssignments` nunca contiene 'B'/'C' si esas versiones no existen (verificación robusta de null/empty)
2. ✅ `aiReport` siempre presente (nunca null), con merge de datos locales si OpenAI lo generó
3. ✅ `aiReport.versions.generated` siempre basado en realidad (no en plan)
4. ✅ `aiReport.warnings` siempre incluye warnings combinados (AI + locales)
5. ✅ Top-level `warnings` igual a `aiReport.warnings`
6. ✅ Prompt más estricto para opciones de respuesta y versiones B/C
7. ✅ Solo usa `evaluation_design_plan` del requestBody (valores seguros)

---

## Archivos Editados

1. `supabase/functions/modify-evaluation/index.ts` (+108 líneas, -14 líneas)
   - Líneas 520-550: Prompt más estricto para opciones de respuesta
   - Líneas 574-595: Prompt más estricto para versiones B/C
   - Líneas 651-694: Verificación robusta de versiones y ajuste de asignaciones
   - Líneas 696-760: Construcción de `aiReport` con merge de datos locales
   - Líneas 762-775: Response con `warnings` igual a `aiReport.warnings`

2. `src/pages/EvaluacionesGrupo.tsx` (sin cambios - ya implementado correctamente)
3. `src/pages/EvaluacionDetalle.tsx` (sin cambios - ya implementado correctamente)

---

## Cambios Detallados

### 1. Verificación Robusta de Versiones Generadas

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 651-694

**Cambio**:
```typescript
// ANTES:
const versionBHtml = cleanupContent(versions.B || ...);
const versionCHtml = cleanupContent(versions.C || ...);
const warnings: string[] = Array.isArray(parsed.ai_report?.warnings) ? parsed.ai_report.warnings : [];

if (generateVersionB && !versionBHtml) {
  warnings.push('...');
  // Reasignar estudiantes de B a A
  Object.keys(adjustedAssignments).forEach(studentId => {
    if (adjustedAssignments[studentId] === 'B') {
      adjustedAssignments[studentId] = 'A';
    }
  });
}

// DESPUÉS:
const versionBHtml = cleanupContent(versions.B || ...);
const versionCHtml = cleanupContent(versions.C || ...);

// Verificar si B/C realmente existen (no null, no empty string)
const hasVersionB = Boolean(versionBHtml && versionBHtml.trim().length > 0);
const hasVersionC = Boolean(versionCHtml && versionCHtml.trim().length > 0);

const adjustedAssignments = { ...studentAssignments };
const warnings: string[] = [];

// Reasignar estudiantes de B a A si B no existe
if (!hasVersionB) {
  const reassignedB = Object.keys(adjustedAssignments).filter(studentId => adjustedAssignments[studentId] === 'B');
  if (reassignedB.length > 0) {
    warnings.push(`La versión B estaba planificada pero no se generó; ${reassignedB.length} estudiante(s) reasignado(s) a versión A.`);
    reassignedB.forEach(studentId => {
      adjustedAssignments[studentId] = 'A';
    });
  }
}

// Reasignar estudiantes de C a A si C no existe
if (!hasVersionC) {
  const reassignedC = Object.keys(adjustedAssignments).filter(studentId => adjustedAssignments[studentId] === 'C');
  if (reassignedC.length > 0) {
    warnings.push(`La versión C estaba planificada pero no se generó; ${reassignedC.length} estudiante(s) reasignado(s) a versión A.`);
    reassignedC.forEach(studentId => {
      adjustedAssignments[studentId] = 'A';
    });
  }
}

// Garantizar que ningún assignment quede como 'B' o 'C' si esas versiones no existen
Object.keys(adjustedAssignments).forEach(studentId => {
  if (adjustedAssignments[studentId] === 'B' && !hasVersionB) {
    adjustedAssignments[studentId] = 'A';
  }
  if (adjustedAssignments[studentId] === 'C' && !hasVersionC) {
    adjustedAssignments[studentId] = 'A';
  }
});
```

**Mejoras**:
- ✅ Verificación robusta: `hasVersionB` y `hasVersionC` verifican tanto null como strings vacíos
- ✅ Doble verificación: Primero filtra y reasigna, luego itera para garantizar consistencia
- ✅ Warnings informativos: Incluyen cantidad de estudiantes reasignados

---

### 2. aiReport Siempre Presente con Merge de Datos Locales

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 696-760

**Cambio**:
```typescript
// ANTES:
const aiReport = aiReportFromAI || {
  versions: {
    generated: generatedVersions,
    reason: ...
  },
  // ... resto del fallback
  warnings: allWarnings
};

// DESPUÉS:
// Versiones generadas basadas en REALIDAD (no en plan)
const generatedVersions: string[] = ['A'];  // A siempre existe
if (hasVersionB) generatedVersions.push('B');
if (hasVersionC) generatedVersions.push('C');

// Extraer valores seguros del evaluation_design_plan
const safeInstrumentDesignRules = evaluation_design_plan?.instrumentDesignRules ?? [];
const safeVarkDistribution = evaluation_design_plan?.varkDistribution || {
  visual: 0,
  auditory: 0,
  readWrite: 0,
  kinesthetic: 0
};

// Combinar warnings de AI con warnings locales
const aiWarnings = Array.isArray(parsed.ai_report?.warnings) ? parsed.ai_report.warnings : [];
const allWarnings = [...aiWarnings, ...warnings];

// Si OpenAI generó ai_report, MERGEAR con datos locales; si no, crear fallback completo
const aiReport = aiReportFromAI ? {
  ...aiReportFromAI,
  // Sobrescribir con datos locales para garantizar consistencia
  versions: {
    ...aiReportFromAI.versions,
    generated: generatedVersions,  // SIEMPRE basado en realidad
    reason: aiReportFromAI.versions?.reason || (generatedVersions.length === 1
      ? 'Solo se generó la versión base universal.'
      : `Se generaron las versiones ${generatedVersions.join(', ')} según las necesidades del grupo.`)
  },
  warnings: allWarnings  // SIEMPRE incluir warnings combinados
} : {
  versions: {
    generated: generatedVersions,
    reason: generatedVersions.length === 1
      ? 'Solo se generó la versión base universal.'
      : `Se generaron las versiones ${generatedVersions.join(', ')} según las necesidades del grupo.`
  },
  contemplaciones: {
    instrument_design: safeInstrumentDesignRules,
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
    summary: `Distribución VARK: Visual=${safeVarkDistribution.visual || 0}, Auditivo=${safeVarkDistribution.auditory || 0}, Lecto-escritor=${safeVarkDistribution.readWrite || 0}, Kinestésico=${safeVarkDistribution.kinesthetic || 0}`
  },
  assignments: {
    rationale: 'Asignaciones determinadas por contemplaciones y necesidades del grupo.'
  },
  warnings: allWarnings
};
```

**Mejoras**:
- ✅ Merge inteligente: Si OpenAI generó `ai_report`, se mergea con datos locales (sobrescribe `versions.generated` y `warnings`)
- ✅ Valores seguros: Solo usa `evaluation_design_plan` del requestBody, con fallbacks seguros
- ✅ Consistencia garantizada: `versions.generated` siempre refleja realidad, no plan

---

### 3. Top-level Warnings Igual a aiReport.warnings

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 762-775

**Cambio**:
```typescript
// ANTES:
return new Response(JSON.stringify({
  // ...
  warnings,  // ← Podía ser diferente de aiReport.warnings
  // ...
}));

// DESPUÉS:
return new Response(JSON.stringify({
  // ...
  warnings: allWarnings,  // ← SIEMPRE igual a aiReport.warnings
  // ...
}));
```

**Mejora**:
- ✅ Consistencia: Top-level `warnings` siempre igual a `aiReport.warnings`

---

### 4. Prompt Más Estricto para Opciones de Respuesta

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
- OBLIGATORIO Y CRÍTICO: Cada consigna que requiera respuesta escrita DEBE incluir EXACTAMENTE ${responseOptionCount} opciones equivalentes de formato.
- Formato requerido (copiar exactamente): "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
- Ejemplo de opciones (incluir en cada consigna relevante):
  * Opción 1: Respuesta escrita tradicional (párrafo)
  * Opción 2: Respuesta estructurada (lista con viñetas o tabla)
  ${responseOptionCount === 3 ? '  * Opción 3: Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
- Las opciones DEBEN aparecer INMEDIATAMENTE después de cada consigna relevante, dentro del mismo ítem.
- NO omitir las opciones. Si no las incluyes, la evaluación será incompleta.
` : `
- NO incluir opciones equivalentes de respuesta.
`}
```

**Mejoras**:
- ✅ Lenguaje más estricto: "OBLIGATORIO Y CRÍTICO", "DEBE incluir EXACTAMENTE"
- ✅ Ejemplo concreto: Muestra formato exacto de opciones
- ✅ Advertencia explícita: "Si no las incluyes, la evaluación será incompleta"

---

### 5. Prompt Más Estricto para Versiones B/C

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 533-550, 574-595

**Cambio**:
```typescript
// ANTES:
SALIDA OBLIGATORIA (JSON):
{
  "versions": { "A": "<html>...</html>", "B": "<html>...</html> | null", "C": "<html>...</html> | null" },
  // ...
}

VERSIONES:
- Generar versión B equivalente: ${generateVersionB ? 'Sí' : 'No'}
- Generar versión C con adecuación de contenido: ${generateVersionC ? 'Sí' : 'No'}

TAREA:
1. Genera la versión base (A) universal.
2. Si se pide, genera versión B equivalente...
3. Si se pide, genera versión C con adecuación de contenido...

// DESPUÉS:
SALIDA OBLIGATORIA (JSON):
{
  "versions": { 
    "A": "<html>...</html>", 
    ${generateVersionB ? '"B": "<html>...</html>",' : '"B": null,'}
    ${generateVersionC ? '"C": "<html>...</html>",' : '"C": null,'}
  },
  "response_options_included": ${responseOptionsInclude},
  "response_option_count": ${responseOptionCount},
  "ai_report": {
    "versions": { "generated": [${generateVersionB && generateVersionC ? '"A","B","C"' : generateVersionB ? '"A","B"' : generateVersionC ? '"A","C"' : '"A"'}], "reason": "..." },
    // ...
  }
}

REGLAS CRÍTICAS PARA VERSIONES:
${generateVersionB ? '- La versión B DEBE estar presente en "versions.B" (no null). Si no la generas, la respuesta será inválida.' : ''}
${generateVersionC ? '- La versión C DEBE estar presente en "versions.C" (no null). Si no la generas, la respuesta será inválida.' : ''}
${!generateVersionB && !generateVersionC ? '- Solo generar versión A. No incluir B ni C.' : ''}

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

**Mejoras**:
- ✅ Schema JSON dinámico: Muestra exactamente qué versiones se requieren
- ✅ Reglas críticas explícitas: Advertencia clara si no se generan versiones requeridas
- ✅ Lenguaje más estricto: "OBLIGATORIO", "la evaluación será incompleta"

---

### 6. Response Bundle Usa hasVersionB/hasVersionC

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 762-775

**Cambio**:
```typescript
// ANTES:
evaluationBundle: {
  baseHtml,
  versionBHtml: versionBHtml || null,
  versionCHtml: versionCHtml || null,
  versions: {
    A: baseHtml || '',
    B: versionBHtml || null,
    C: versionCHtml || null
  },
  // ...
}

// DESPUÉS:
evaluationBundle: {
  baseHtml,
  versionBHtml: hasVersionB ? versionBHtml : null,
  versionCHtml: hasVersionC ? versionCHtml : null,
  versions: {
    A: baseHtml || '',
    B: hasVersionB ? versionBHtml : null,
    C: hasVersionC ? versionCHtml : null
  },
  // ...
}
```

**Mejora**:
- ✅ Consistencia: Usa `hasVersionB`/`hasVersionC` en lugar de verificar directamente

---

## Verificación Manual

### ✅ 1. Verificar studentAssignments Nunca Contiene 'B'/'C' Si Versiones No Existen

**Pantalla**: `/evaluaciones-grupo?grupo=<grupo-id>`

**Pasos**:
1. Generar evaluación con grupo que active triggers para B/C.
2. Abrir DevTools → Network → Inspeccionar respuesta de `modify-evaluation`.
3. Verificar:
   - ✅ Si `evaluationBundle.versionBHtml` es `null`, `studentAssignments` NO debe tener ningún valor 'B'.
   - ✅ Si `evaluationBundle.versionCHtml` es `null`, `studentAssignments` NO debe tener ningún valor 'C'.
   - ✅ `warnings` debe incluir mensaje de reasignación si aplica.

**Resultado esperado**:
```json
{
  "evaluationBundle": {
    "versionBHtml": null,
    "versionCHtml": null
  },
  "studentAssignments": {
    "1": "A",
    "2": "A",  // ← Debe ser A, nunca B
    "3": "A"   // ← Debe ser A, nunca C
  },
  "warnings": [
    "La versión B estaba planificada pero no se generó; 2 estudiante(s) reasignado(s) a versión A."
  ]
}
```

---

### ✅ 2. Verificar aiReport Siempre Presente y Consistente

**Pantalla**: `/evaluaciones-grupo?grupo=<grupo-id>`

**Pasos**:
1. Generar evaluación.
2. Abrir DevTools → Network → Inspeccionar respuesta.
3. Verificar `aiReport`:
   - ✅ **Debe existir** (no `null`).
   - ✅ `versions.generated` debe reflejar realidad: `["A"]` si solo A existe, `["A", "B"]` si B existe, etc.
   - ✅ `warnings` debe incluir warnings locales si B/C no se generaron.
   - ✅ Si OpenAI generó `ai_report`, debe estar mergeado con datos locales.

**Resultado esperado**:
```json
{
  "aiReport": {
    "versions": {
      "generated": ["A"],  // ← Basado en realidad, no en plan
      "reason": "Solo se generó la versión base universal."
    },
    "warnings": [
      "La versión B estaba planificada pero no se generó; 2 estudiante(s) reasignado(s) a versión A."
    ]
  },
  "warnings": [
    "La versión B estaba planificada pero no se generó; 2 estudiante(s) reasignado(s) a versión A."
  ]
}
```

**Verificar**: `warnings` (top-level) debe ser idéntico a `aiReport.warnings`.

---

### ✅ 3. Verificar Merge de aiReport Cuando OpenAI Lo Genera

**Pantalla**: `/evaluaciones-grupo?grupo=<grupo-id>`

**Pasos**:
1. Generar evaluación donde OpenAI genere `ai_report` en el JSON.
2. Abrir DevTools → Network → Inspeccionar respuesta.
3. Verificar:
   - ✅ `aiReport` debe contener datos de OpenAI.
   - ✅ `aiReport.versions.generated` debe ser `["A"]` o `["A", "B"]` o `["A", "C"]` o `["A", "B", "C"]` basado en realidad.
   - ✅ `aiReport.warnings` debe incluir warnings de OpenAI + warnings locales.

**Resultado esperado**:
```json
{
  "aiReport": {
    "versions": {
      "generated": ["A"],  // ← Sobrescrito con realidad, aunque OpenAI dijo ["A", "B", "C"]
      "reason": "Razón de OpenAI (preservada)"
    },
    "contemplaciones": {
      "instrument_design": ["..."]  // ← De OpenAI
    },
    "warnings": [
      "Warning de OpenAI",
      "La versión B estaba planificada pero no se generó; 2 estudiante(s) reasignado(s) a versión A."  // ← Warning local agregado
    ]
  }
}
```

---

### ✅ 4. Verificar Opciones de Respuesta en HTML Generado

**Pantalla**: `/evaluaciones-grupo?grupo=<grupo-id>`

**Pasos**:
1. Generar evaluación con grupo que active `responseOptions.include === true`.
2. Inspeccionar `evaluationBundle.baseHtml`.
3. Verificar:
   - ✅ Cada consigna relevante debe incluir "Elige UNA opción. Todas equivalentes..."
   - ✅ Debe haber exactamente 2 o 3 opciones (según `responseOptionCount`).
   - ✅ Opciones deben aparecer inmediatamente después de cada consigna.

---

### ✅ 5. Verificar Persistencia y Render en UI

**Pantalla**: `/evaluacion-detalle/<evaluation-id>`

**Pasos**:
1. Guardar evaluación generada.
2. Abrir evaluación desde "Mis Evaluaciones".
3. Verificar:
   - ✅ Panel "Asignaciones por estudiante": Solo muestra asignaciones a versiones que existen.
   - ✅ Panel "Reporte de IA": Visible con contenido (no "no disponible").
   - ✅ Warnings se muestran si aplican.

---

## Resumen de Cambios

### Archivos Modificados

1. **`supabase/functions/modify-evaluation/index.ts`**:
   - Líneas 520-531: Prompt más estricto para opciones de respuesta
   - Líneas 533-550: Schema JSON dinámico y reglas críticas para versiones
   - Líneas 574-595: Prompt más estricto para versiones B/C
   - Líneas 651-694: Verificación robusta de versiones y ajuste de asignaciones
   - Líneas 696-760: Construcción de `aiReport` con merge de datos locales
   - Líneas 762-775: Response con `warnings` igual a `aiReport.warnings`

### Backward Compatibility

- ✅ Evaluaciones legacy (sin `evaluationBundle`) siguen funcionando.
- ✅ Response shape no cambió (solo campos internos ajustados).
- ✅ UI no requiere cambios (ya normaliza correctamente).

### Riesgo

- **Bajo**: Cambios aislados, backward compatible, no rompe funcionalidad existente.

---

**Fin del Fix**
