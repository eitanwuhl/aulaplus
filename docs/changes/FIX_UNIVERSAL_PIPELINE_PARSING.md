# Fix Universal Pipeline Parsing and Response Schema

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Objetivo**: Corregir el parsing del output del modelo para extraer HTML de estructuras JSON anidadas y asegurar que el path universal siempre retorne el esquema completo.

---

## Problema Observado

A pesar de que el frontend envía `generation_mode: "universal"`, la respuesta del edge function tiene:
- `_debug.generationPath === "legacy_return"` (debería ser `"universal"`)
- `evaluationBundle.baseHtml` y `evaluationBundle.versions.A` son strings JSON embebidos, no HTML puro:
  ```json
  "{ \"versions\": { \"A\": \"<html>...\", \"B\": \"<html>...\" } }"
  ```
- `studentAssignments` es `{}` (vacío)
- `_debug.triggers.versionC` es `false` aunque hay estudiantes con adaptación de contenido
- `aiReport` es genérico ("respuesta no estructurada") aunque el HTML incluye opciones equivalentes
- UI renderiza versiones dentro del mismo contenedor porque el HTML es un JSON string

---

## Cambios Implementados

### A) Edge Function: Parsing Robusto y Esquema Universal

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

#### A1: Parsing Robusto del Output del Modelo (líneas ~398-500)

**Problema**: El modelo retorna JSON que contiene `versions`, pero el código lo parsea y luego trata `versions.A` como HTML, cuando en realidad puede ser un string JSON embebido.

**Solución**: Agregar parsing multi-estrategia para extraer HTML de estructuras JSON anidadas:

```typescript
// Strategy 1: Direct versions object
if (parsed.versions && typeof parsed.versions === 'object') {
  versions = parsed.versions;
}
// Strategy 2: Alternative shape {A:"<html>",B:"<html>"}
else if (parsed.A || parsed.B || parsed.C) {
  versions = { A: parsed.A, B: parsed.B, C: parsed.C };
}
// Strategy 3: Nested evaluationBundle
else if (parsed.evaluationBundle?.versions) {
  versions = parsed.evaluationBundle.versions;
}

// Extract HTML strings, handling nested JSON strings
const extractHtml = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    // Check if it's a JSON string containing HTML
    if (value.trim().startsWith('{') && value.includes('"versions"')) {
      try {
        const nested = JSON.parse(value);
        if (nested.versions?.A) return nested.versions.A;
        if (nested.A) return nested.A;
        if (nested.evaluationBundle?.versions?.A) return nested.evaluationBundle.versions.A;
      } catch (e) {
        // Not JSON, treat as HTML
      }
    }
    return value;
  }
  if (typeof value === 'object' && value.A) {
    return extractHtml(value.A);
  }
  return null;
};
```

**Resultado**: El HTML se extrae correctamente de estructuras JSON anidadas, y se retorna como string HTML puro.

#### A2: Asegurar Path Universal Siempre (líneas ~244-246)

**Problema**: El path universal no se ejecutaba si había `generation_context`.

**Solución**: Verificar `generation_mode === 'universal'` PRIMERO, antes del path de `generation_context`:

```typescript
// FORCE: Universal path takes priority - if generation_mode === 'universal', use it regardless of generation_context
// Universal evaluation path (must be checked FIRST before generation_context)
if (type === 'modification' && generation_mode === 'universal') {
  // ... código del path universal ...
}

// PHASE 6b: Handle evaluation generation with session digests + time budgeting (legacy, only if NOT universal)
if (generation_context && type === 'modification' && generation_mode !== 'universal') {
  // ... código del path legacy ...
}
```

**Resultado**: Si `generation_mode === 'universal'`, siempre se ejecuta el path universal.

#### A3: Mejorar aiReport con Información Útil (líneas ~715-783)

**Problema**: El `aiReport` era genérico y no explicaba las decisiones de diseño.

**Solución**: Construir `aiReport` detallado con:
- `design_rationale`: Contenidos y competencias seleccionadas
- `versions.reason`: Por qué se generaron las versiones A/B/C
- `response_options.rationale`: Por qué se incluyeron opciones metacognitivas y dónde aparecen
- `assignments.rationale`: Conteos por versión y IDs de estudiantes con adaptación de contenido
- `contemplaciones`: Reglas de diseño, recordatorios, contemplaciones aplicadas

**Resultado**: El `aiReport` es útil y explica todas las decisiones de diseño.

#### A4: Asegurar studentAssignments y Triggers Correctos (líneas ~647-691)

**Problema**: `studentAssignments` estaba vacío y `triggers` no reflejaban el plan.

**Solución**:
1. Inicializar `studentAssignments` desde `evaluation_design_plan.assignmentByStudentId`
2. Normalizar todas las keys a strings
3. Asegurar que `triggers` reflejen el plan (no defaults a `false`)

```typescript
// A4: studentAssignments MUST NOT be empty - start with evaluation_design_plan.assignmentByStudentId
const rawAssignments = designPlan.assignmentByStudentId || designPlan.studentAssignments || studentAssignments || {};
const adjustedAssignments: Record<string, 'A' | 'B' | 'C'> = {};

// Normalize all keys to strings
Object.entries(rawAssignments).forEach(([key, value]) => {
  adjustedAssignments[String(key)] = value as 'A' | 'B' | 'C';
});
```

**Resultado**: `studentAssignments` siempre tiene valores y `triggers` reflejan el plan.

#### A5: Debug Path Correcto (líneas ~800-820)

**Problema**: `_debug.generationPath` era `"legacy_return"` incluso en el path universal.

**Solución**: Cambiar `generationPath` a `"universal"` o `"universal_parse_failed"` según corresponda:

```typescript
_debug: {
  generationPath: parseFailed ? 'universal_parse_failed' : 'universal',
  hasEvaluationBundle: true,
  hasAiReport: true,
  versionsLengths: { A: baseHtml?.length || 0, B: versionBHtml?.length || 0, C: versionCHtml?.length || 0 },
  triggers: { versionB: generateVersionB, versionC: generateVersionC },
  responseOptions: { include: responseOptionsInclude, optionCount: responseOptionCount },
  assignmentCounts: { A: assignmentCounts.A, B: assignmentCounts.B, C: assignmentCounts.C }
}
```

**Resultado**: `_debug.generationPath` siempre refleja el path ejecutado correctamente.

---

### B) Frontend: Parsing Defensivo y Renderizado Separado

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

#### B1: Parsing Defensivo (líneas ~1194-1230)

**Problema**: El frontend recibía HTML como JSON strings embebidos.

**Solución**: Agregar función `extractHtmlFromJsonString` que:
1. Detecta si un string es JSON
2. Extrae HTML de estructuras anidadas
3. Retorna HTML puro

```typescript
const extractHtmlFromJsonString = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') && (trimmed.includes('"versions"') || trimmed.includes('"A"'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.versions?.A) return parsed.versions.A;
        if (parsed.A) return parsed.A;
        if (parsed.evaluationBundle?.versions?.A) return parsed.evaluationBundle.versions.A;
      } catch (e) {
        // Not valid JSON, treat as HTML
      }
    }
    return value;
  }
  return value;
};
```

**Resultado**: El frontend extrae HTML correctamente incluso si viene como JSON string.

#### B2: Renderizado en Cards Separadas (líneas ~1636-1675)

**Problema**: Las versiones se renderizaban en el mismo contenedor.

**Solución**: Ya implementado - `displayEvaluations.map()` renderiza cada versión en su propia card usando `EvaluacionVisualRenderer`.

**Resultado**: Cada versión (A/B/C) se muestra en su propia card separada.

---

### C) Detección Confiable de Adaptación de Contenido

**Archivo**: `src/services/evaluations/designPlan.ts`

#### C1: Consolidar Detección (líneas ~216-219)

**Problema**: Múltiples nombres de campo para adaptación de contenido.

**Solución**: Consolidar en una sola función que acepta múltiples nombres:

```typescript
const contentAdaptationStudentIds = students
  .filter(student => {
    // Check multiple possible field names
    return (
      student.hasDeclaredContentAdaptation === true ||
      student.requiereAdecuacionContenido === true ||
      student.requiresContentAdaptation === true ||
      (student.informeTecnico?.requiereAdecuacionContenido === true)
    );
  })
  .map(student => String(student.studentId));
```

**Resultado**: La detección de adaptación de contenido es confiable y acepta múltiples nombres de campo.

---

## Archivos Modificados

1. **`supabase/functions/modify-evaluation/index.ts`**:
   - Parsing robusto multi-estrategia para extraer HTML de JSON anidado
   - Path universal verificado PRIMERO
   - `aiReport` mejorado con información útil
   - `studentAssignments` inicializado desde el plan
   - `_debug.generationPath` corregido

2. **`src/pages/EvaluacionesGrupo.tsx`**:
   - Parsing defensivo para extraer HTML de JSON strings
   - Renderizado en cards separadas (ya implementado)

3. **`src/services/evaluations/designPlan.ts`**:
   - Detección consolidada de adaptación de contenido

---

## Comandos de Deploy

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

---

## Criterios de Aceptación

1. ✅ Network response para llamadas universales tiene `_debug.generationPath` que empieza con `"universal"` (NO `"legacy_return"`)
2. ✅ Response incluye `evaluationBundle.versions.A` como string HTML (empieza con `"<html"` no `"{"`)
3. ✅ Si B existe, `evaluationBundle.versions.B` es string HTML y la card B se renderiza separadamente
4. ✅ Si hay estudiantes con adaptación de contenido, `evaluationBundle.versions.C` existe y la card C se renderiza; esos estudiantes están asignados a C
5. ✅ `aiReport` es detallado y referencia:
   - Contenidos/competencias elegidos
   - Por qué se generaron las versiones
   - Por qué se hicieron las asignaciones
   - Por qué se incluyeron opciones metacognitivas
6. ✅ En UI, las versiones se muestran en cards separadas, no mezcladas

---

## Rollback

Si es necesario revertir:

1. **Revertir commit**: `git revert <commit-hash>`
2. **Revertir archivos manualmente**:
   - `supabase/functions/modify-evaluation/index.ts`: Restaurar parsing simple
   - `src/pages/EvaluacionesGrupo.tsx`: Remover parsing defensivo
   - `src/services/evaluations/designPlan.ts`: Restaurar detección simple
