# Fix: Implementación aiReport Fallback y UI

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Tipo**: Corrección de implementación

---

## Problemas Corregidos

1. **Edge Function**: El fallback de `aiReport` usaba variables (`instrumentDesignRules`, `varkDistribution`) que podían no estar en scope.
2. **Edge Function**: Los warnings dependían de `parsed.ai_report.warnings` en lugar de estar centralizados.
3. **UI**: `EvaluacionDetalle.tsx` ya leía correctamente, pero se agregó comentario para claridad.

---

## Archivos Editados

1. `supabase/functions/modify-evaluation/index.ts` (líneas 641-702)
2. `src/pages/EvaluacionDetalle.tsx` (línea 210)

---

## Cambios Aplicados

### 1. Edge Function: Fix aiReport Fallback

**Archivo**: `supabase/functions/modify-evaluation/index.ts`  
**Líneas**: 641-702

**Cambio**:

```typescript
// ANTES:
const versions = parsed.versions || {};
const baseHtml = cleanupContent(versions.A || parsed.base_html || parsed.baseHtml || '');
const versionBHtml = cleanupContent(versions.B || parsed.version_b_html || parsed.versionBHtml || '');
const versionCHtml = cleanupContent(versions.C || parsed.version_c_html || parsed.versionCHtml || '');
const warnings: string[] = Array.isArray(parsed.ai_report?.warnings) ? parsed.ai_report.warnings : [];

// PATCH 1: Ajustar studentAssignments si B/C no se generaron
const adjustedAssignments = { ...studentAssignments };

if (generateVersionB && !versionBHtml) {
  warnings.push('La versión B estaba planificada pero no se generó; se reasignará a versión A.');
  // ...
}

if (generateVersionC && !versionCHtml) {
  warnings.push('La versión C estaba planificada pero no se generó; se reasignará a versión A.');
  // ...
}

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
    instrument_design: instrumentDesignRules,  // ❌ Variable puede no estar en scope
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
    summary: `Distribución VARK: Visual=${varkDistribution.visual || 0}, Auditivo=${varkDistribution.auditory || 0}, Lecto-escritor=${varkDistribution.readWrite || 0}, Kinestésico=${varkDistribution.kinesthetic || 0}`  // ❌ Variable puede no estar en scope
  },
  assignments: {
    rationale: 'Asignaciones determinadas por contemplaciones y necesidades del grupo.'
  },
  warnings: warnings  // ❌ Depende de parsed.ai_report.warnings
};

// DESPUÉS:
const versions = parsed.versions || {};
const baseHtml = cleanupContent(versions.A || parsed.base_html || parsed.baseHtml || '');
const versionBHtml = cleanupContent(versions.B || parsed.version_b_html || parsed.versionBHtml || '');
const versionCHtml = cleanupContent(versions.C || parsed.version_c_html || parsed.versionCHtml || '');

// PATCH 1: Ajustar studentAssignments si B/C no se generaron
const adjustedAssignments = { ...studentAssignments };
const warnings: string[] = [];  // ✅ Warnings centralizados, no dependen de parsed.ai_report

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

// PATCH 2: Construir aiReport con fallback si OpenAI no lo generó
// Usar solo evaluation_design_plan del requestBody y valores seguros
const aiReportFromAI = parsed.ai_report;
const generatedVersions: string[] = ['A'];
if (versionBHtml) generatedVersions.push('B');
if (versionCHtml) generatedVersions.push('C');

// ✅ Extraer valores seguros del evaluation_design_plan
const safeInstrumentDesignRules = evaluation_design_plan?.instrumentDesignRules ?? [];
const safeVarkDistribution = evaluation_design_plan?.varkDistribution || {
  visual: 0,
  auditory: 0,
  readWrite: 0,
  kinesthetic: 0
};

// ✅ Combinar warnings de AI con warnings locales
const allWarnings = [
  ...(Array.isArray(parsed.ai_report?.warnings) ? parsed.ai_report.warnings : []),
  ...warnings
];

const aiReport = aiReportFromAI || {
  versions: {
    generated: generatedVersions,
    reason: generatedVersions.length === 1
      ? 'Solo se generó la versión base universal.'
      : `Se generaron las versiones ${generatedVersions.join(', ')} según las necesidades del grupo.`
  },
  contemplaciones: {
    instrument_design: safeInstrumentDesignRules,  // ✅ Usa evaluation_design_plan
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
    summary: `Distribución VARK: Visual=${safeVarkDistribution.visual || 0}, Auditivo=${safeVarkDistribution.auditory || 0}, Lecto-escritor=${safeVarkDistribution.readWrite || 0}, Kinestésico=${safeVarkDistribution.kinesthetic || 0}`  // ✅ Usa evaluation_design_plan con fallback
  },
  assignments: {
    rationale: 'Asignaciones determinadas por contemplaciones y necesidades del grupo.'
  },
  warnings: allWarnings  // ✅ Warnings combinados
};
```

**Líneas cambiadas**:
- **Línea 645**: `const warnings: string[] = [];` (inicializado vacío, no depende de `parsed.ai_report`)
- **Líneas 670-677**: Extracción de valores seguros desde `evaluation_design_plan`
- **Líneas 679-682**: Combinación de warnings de AI con warnings locales
- **Línea 684**: `instrument_design: safeInstrumentDesignRules` (usa valor seguro)
- **Línea 696**: `summary: ...` usa `safeVarkDistribution` (usa valor seguro)
- **Línea 701**: `warnings: allWarnings` (warnings combinados)

---

### 2. UI: Clarificar Lectura de aiReport

**Archivo**: `src/pages/EvaluacionDetalle.tsx`  
**Línea**: 210

**Cambio**:

```typescript
// ANTES:
const aiReportPayload = evaluacion.evaluacion_generada?.ai_report || evaluacion.ai_design_report || null;

// DESPUÉS:
// PATCH: Leer ai_report primero desde evaluacion_generada, luego desde ai_design_report
const aiReportPayload = evaluacion.evaluacion_generada?.ai_report || evaluacion.ai_design_report || null;
```

**Nota**: El código ya leía correctamente (`evaluacion_generada?.ai_report` primero), pero se agregó un comentario para claridad. El panel "Reporte de IA" ya estaba correctamente implementado (línea 379).

**Líneas cambiadas**:
- **Línea 210**: Comentario agregado para clarificar el orden de lectura

---

## Resumen de Cambios

### Edge Function (`supabase/functions/modify-evaluation/index.ts`)

1. ✅ **Warnings centralizados**: Inicializados como array vacío, no dependen de `parsed.ai_report.warnings`.
2. ✅ **Valores seguros**: `safeInstrumentDesignRules` y `safeVarkDistribution` extraídos desde `evaluation_design_plan` con fallbacks.
3. ✅ **Warnings combinados**: `allWarnings` combina warnings de AI (si existen) con warnings locales.

### UI (`src/pages/EvaluacionDetalle.tsx`)

1. ✅ **Comentario agregado**: Clarifica que se lee `evaluacion_generada?.ai_report` primero, luego `ai_design_report`.

---

## Verificación

### ✅ 1. Verificar Fallback de aiReport

**Pasos**:
1. Generar evaluación sin que OpenAI genere `ai_report` en el JSON.
2. Abrir DevTools → Network → Inspeccionar respuesta de `modify-evaluation`.
3. Verificar `aiReport`:
   - ✅ Debe existir (no `null`).
   - ✅ `contemplaciones.instrument_design` debe ser array (puede estar vacío).
   - ✅ `vark.summary` debe tener valores numéricos (pueden ser 0s si no hay datos).
   - ✅ `warnings` debe incluir warnings locales si B/C no se generaron.

**Resultado esperado**:
```json
{
  "aiReport": {
    "versions": {
      "generated": ["A"],
      "reason": "Solo se generó la versión base universal."
    },
    "contemplaciones": {
      "instrument_design": [],  // ✅ Array vacío si no hay datos
      "admin_reminders": [],
      "correction_reminders": []
    },
    "vark": {
      "summary": "Distribución VARK: Visual=0, Auditivo=0, Lecto-escritor=0, Kinestésico=0"  // ✅ Valores seguros
    },
    "warnings": [
      "La versión B estaba planificada pero no se generó; se reasignará a versión A."  // ✅ Warning local
    ]
  }
}
```

---

### ✅ 2. Verificar UI Renderiza aiReport

**Pantalla**: `/evaluacion-detalle/<evaluation-id>`

**Pasos**:
1. Abrir evaluación guardada que tenga `evaluacion_generada.ai_report`.
2. Verificar:
   - ✅ Panel "Reporte de IA" debe estar visible con contenido.
   - ✅ No debe mostrar "no disponible".
3. Abrir evaluación guardada que solo tenga `ai_design_report` (legacy).
4. Verificar:
   - ✅ Panel "Reporte de IA" debe estar visible con contenido desde `ai_design_report`.

---

## Backward Compatibility

- ✅ Evaluaciones legacy (sin `evaluation_bundle`) siguen funcionando.
- ✅ Fallback de `aiReport` usa valores seguros (arrays vacíos, 0s) si no hay datos.
- ✅ UI lee ambos campos (`ai_report` y `ai_design_report`) con fallback correcto.

---

**Fin de la Corrección**
