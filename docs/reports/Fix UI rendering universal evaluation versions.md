# Fix UI Rendering of Universal Evaluation Versions

**Fecha**: 2026-02-02  
**Branch**: `nuevas-evaluaciones`  
**Objetivo**: Eliminar wrappers JSON en el HTML renderizado, mostrar versiones en tarjetas separadas, y ocultar versiones no asignadas.

---

## Problema Identificado

### Síntomas Observados

1. **JSON wrapper visible en UI**: El HTML de la evaluación mostraba un wrapper JSON como:
   ```json
   {
     "versions": {
       "A": "...",
       "B": "...",
       "C": "..."
     }
   }
   ```

2. **Versiones en la misma tarjeta**: Múltiples versiones aparecían dentro del mismo contenedor.

3. **Versión B no asignada visible**: La versión B se mostraba aunque ningún estudiante estuviera asignado a ella.

### Root Cause

1. **Backend**: La función `extractHtml` no garantizaba que el output fuera HTML puro. A veces el modelo devolvía JSON anidado y el código almacenaba el JSON completo como string en `versions.A`.

2. **Backend**: No había validación final que asegurara que `baseHtml`, `versionBHtml`, y `versionCHtml` empezaran con `<` (HTML válido).

3. **Backend**: La versión B se devolvía incluso cuando no había asignaciones a B y `triggers.versionB` era `false`.

4. **Frontend**: El UI mostraba versiones basándose en la presencia de HTML, no en las asignaciones de estudiantes.

---

## Cambios Implementados

### 1. Backend: Función `extractVersionsFromModelOutput` Robusta

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Reemplazamos la función `extractHtml` con una función más robusta `extractVersionsFromModelOutput` que:

- Acepta múltiples formas de input (objeto, string JSON, string HTML)
- Extrae recursivamente HTML de JSON anidado
- Valida que el output final sea HTML puro (empieza con `<`)
- Retorna `null` si no puede extraer HTML válido

**Código clave**:
```typescript
const extractVersionsFromModelOutput = (input: any): { A: string | null; B: string | null; C: string | null } => {
  // Strategy 1: Parse JSON strings
  // Strategy 2: Extract from parsed object (multiple shapes)
  // Strategy 3: Recursively extract if nested JSON
  // Final validation: ensure HTML starts with '<'
}
```

**Líneas**: ~505-600

---

### 2. Backend: Validación Final de HTML Puro

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Agregamos función `ensurePureHtml` que:

- Detecta si un string empieza con `{` (JSON wrapper)
- Intenta extraer HTML usando `extractVersionsFromModelOutput`
- Retorna `null` si no puede garantizar HTML puro
- Aplica `cleanupContent` solo a HTML válido

**Código clave**:
```typescript
const ensurePureHtml = (html: string | null): string | null => {
  if (!html) return null;
  const trimmed = html.trim();
  if (trimmed.startsWith('{')) {
    // Try extraction, return null if fails
  }
  if (trimmed.startsWith('<')) {
    return cleanupContent(trimmed);
  }
  return null;
};
```

**Líneas**: ~650-680

---

### 3. Backend: No Devolver Versión B si No es Necesaria

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Agregamos lógica que elimina la versión B de la respuesta si:

- `assignmentCountB === 0` (ningún estudiante asignado a B)
- `designPlan.triggers.versionB === false`
- Pero la versión B fue generada de todas formas

**Código clave**:
```typescript
const assignmentCountB = Object.values(adjustedAssignments).filter(v => v === 'B').length;
const shouldDropB = hasVersionB && assignmentCountB === 0 && !designPlan.triggers?.versionB;
if (shouldDropB) {
  versionBHtml = null;
  warnings.push('La versión B fue generada pero no es necesaria; se eliminó de la respuesta.');
}
```

**Líneas**: ~847-856

---

### 4. Backend: Logging Mejorado

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Agregamos logs que muestran:

- Resultados de extracción de HTML (primeros 20 caracteres de cada versión)
- Si se detectó JSON wrapper
- Si se aplicó fallback
- Si se eliminó versión B

**Código clave**:
```typescript
console.log('[UNIVERSAL] HTML extraction results:', {
  baseHtmlStartsWith: baseHtml.trim().substring(0, 20),
  versionBHtmlExists: !!versionBHtml,
  versionCHtmlExists: !!versionCHtml,
  parseFailed
});
```

**Líneas**: ~680-690

---

### 5. Frontend: Helper `normalizeVersionHtml`

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Agregamos función `normalizeVersionHtml` que:

- Extrae HTML de JSON strings anidados
- Valida que el output sea HTML puro (empieza con `<`)
- Retorna `null` si no puede normalizar

**Código clave**:
```typescript
const normalizeVersionHtml = (value: any): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') && (trimmed.includes('"versions"') || ...)) {
      // Parse and extract recursively
    }
    return trimmed.startsWith('<') ? trimmed : null;
  }
  // Handle objects...
};
```

**Líneas**: ~1641-1680

---

### 6. Frontend: Mostrar Solo Versiones Asignadas

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Modificamos `displayEvaluations` para:

- Calcular `assignmentCounts` (A, B, C)
- Mostrar versión A siempre (universal)
- Mostrar versión B **solo si** `assignmentCounts.B > 0`
- Mostrar versión C **solo si** `assignmentCounts.C > 0`
- Normalizar HTML antes de asignar a `content`

**Código clave**:
```typescript
const assignmentCounts = {
  A: Object.values(assignmentByStudentId).filter(v => v === 'A').length,
  B: Object.values(assignmentByStudentId).filter(v => v === 'B').length,
  C: Object.values(assignmentByStudentId).filter(v => v === 'C').length
};

// Only show B if assigned
if (versionBHtmlRaw && assignmentCounts.B > 0) {
  const versionBHtml = normalizeVersionHtml(versionBHtmlRaw);
  if (versionBHtml) {
    evaluations.push({ /* Version B */ });
  }
}
```

**Líneas**: ~1680-1750

---

## Verificación

### Network Response (Chrome DevTools)

1. **OPTIONS preflight**: Debe retornar `204` con headers CORS correctos.

2. **POST response**: Debe retornar `200` con JSON que contiene:
   ```json
   {
     "evaluationBundle": {
       "versions": {
         "A": "<html>...",  // DEBE empezar con '<', nunca con '{'
         "B": null,          // null si no hay asignaciones a B
         "C": "<html>..."    // null o HTML puro
       }
     },
     "_debug": {
       "generationPath": "universal",
       "versionsLengths": { "A": 1234, "B": 0, "C": 567 },
       "assignmentCounts": { "A": 10, "B": 0, "C": 1 },
       "droppedVersions": { "B": true }
     }
   }
   ```

3. **Validación crítica**:
   - `evaluationBundle.versions.A.trim().startsWith('<') === true`
   - `evaluationBundle.versions.B === null` si `assignmentCounts.B === 0`
   - `evaluationBundle.versions.C` es `null` o HTML puro

### UI Rendering

1. **Versiones en tarjetas separadas**:
   - Versión A: Tarjeta propia con título "Versión A (Universal)"
   - Versión C (si Diego tiene content adaptation): Tarjeta propia con título "Versión C (Adecuación de contenido)"
   - Versión B: **NO debe aparecer** si no hay estudiantes asignados a B

2. **HTML puro visible**:
   - El contenido de cada tarjeta debe empezar con HTML válido (ej: `<p>`, `<div>`, `<h1>`)
   - **NO debe aparecer** texto como `{ "versions": { "A": "..." } }`

3. **Asignaciones correctas**:
   - Si Diego tiene content adaptation, debe aparecer en la tarjeta de Versión C
   - Si no hay estudiantes asignados a B, la tarjeta B no debe aparecer

### Console Logs

**Backend (Supabase logs)**:
```
[UNIVERSAL] HTML extraction results: {
  baseHtmlStartsWith: "<html><head>...",
  versionBHtmlExists: false,
  versionCHtmlExists: true,
  versionCHtmlStartsWith: "<html><head>...",
  parseFailed: false
}
[UNIVERSAL] Dropping Version B: no assignments to B and triggers.versionB is false
```

**Frontend (Browser console)**:
```
[EVAL_PIPELINE] Response integrity check: {
  versionsKeys: ["A", "C"],
  versionALength: 1234,
  versionBLength: 0,
  versionCLength: 567
}
```

---

## Edge Cases Manejados

1. **JSON anidado**: Si el modelo devuelve JSON dentro de JSON (ej: `{ "versions": { "A": "{ \"html\": \"...\" }" } }`), la función `extractVersionsFromModelOutput` lo extrae recursivamente.

2. **HTML inválido**: Si después de extraer, el string no empieza con `<`, se retorna `null` y se aplica fallback seguro.

3. **Versión B generada pero no necesaria**: Si el modelo genera B pero no hay asignaciones y `triggers.versionB` es `false`, se elimina de la respuesta.

4. **Mismatch de IDs**: El frontend normaliza IDs de estudiantes usando `sid()` helper, pero si hay mismatch, las versiones no asignadas simplemente no se muestran (no causan error).

---

## Archivos Modificados

1. **`supabase/functions/modify-evaluation/index.ts`**:
   - Función `extractVersionsFromModelOutput` (nueva)
   - Función `ensurePureHtml` (nueva)
   - Lógica para eliminar versión B si no es necesaria
   - Logging mejorado
   - Parámetro `shouldDropB` en `buildUniversalResponse`

2. **`src/pages/EvaluacionesGrupo.tsx`**:
   - Función `normalizeVersionHtml` (nueva)
   - Modificación de `displayEvaluations` para mostrar solo versiones asignadas
   - Normalización de HTML antes de renderizar

---

## Deploy

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

---

## Acceptance Checklist

- [x] Network response: `evaluationBundle.versions.A` empieza con `<` (no con `{`)
- [x] Network response: `evaluationBundle.versions.B` es `null` si no hay asignaciones a B
- [x] Network response: `evaluationBundle.versions.C` es HTML puro o `null`
- [x] UI: Versión A se muestra en tarjeta separada
- [x] UI: Versión C se muestra en tarjeta separada (si Diego tiene content adaptation)
- [x] UI: Versión B **NO** se muestra si no hay estudiantes asignados a B
- [x] UI: El contenido de cada tarjeta es HTML puro (no JSON wrapper)
- [x] Console logs muestran extracción correcta y eliminación de B si aplica

---

## Notas Adicionales

- **Backward compatibility**: Las evaluaciones legacy que ya tienen JSON wrappers en la base de datos seguirán funcionando gracias a `normalizeVersionHtml` en el frontend.

- **Performance**: La extracción recursiva de JSON puede ser costosa si hay muchos niveles de anidación, pero en la práctica el modelo no genera estructuras tan complejas.

- **Futuro**: Si se agrega un flag "show all versions" para preview del docente, se puede modificar la condición `assignmentCounts.B > 0` para permitir mostrar B incluso sin asignaciones.
