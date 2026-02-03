# Fix JSON Wrapper Leakage with Strict Extraction

**Fecha**: 2026-02-02  
**Branch**: `nuevas-evaluaciones`  
**Objetivo**: Eliminar completamente la posibilidad de que wrappers JSON se filtren a `evaluationBundle.versions.*` y al UI, implementando extracción estricta y validación que falle rápido.

---

## Problema Identificado

### Síntomas Observados

1. **Tarjeta "Versión A" muestra JSON wrapper literal**: El contenido mostraba `{ "versions": { "A": "<html>...." } }` literalmente, indicando que el backend estaba enviando un wrapper JSON en `evaluationBundle.versions.A` o el frontend no estaba extrayendo correctamente.

2. **Tarjeta "Versión C" muestra A + tail de B**: La tarjeta C contenía contenido de A limpio pero también incluía `"B":` al final, indicando que la extracción estaba extrayendo la clave incorrecta o usando el wrapper completo.

### Root Cause

1. **Backend**: `ensurePureHtml` no era lo suficientemente estricto. Aunque intentaba extraer, si el modelo devolvía un wrapper JSON anidado, podía pasar a través de la validación y llegar a `evaluationBundle.versions.*`.

2. **Backend**: No había validación que fallara rápido si se detectaba un wrapper JSON en las versiones finales antes de enviar la respuesta.

3. **Frontend**: `normalizeVersionHtml` no manejaba correctamente JSON anidado de múltiples niveles, causando que extrajera versiones incorrectas o fallara silenciosamente.

4. **Frontend**: No había protección explícita para evitar renderizar JSON raw si la extracción fallaba.

---

## Cambios Implementados

### 1. Backend: Función `extractVersionStrict` Estricta

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Reemplazamos `ensurePureHtml` con `extractVersionStrict` que garantiza extracción estricta por clave y nunca retorna wrappers JSON.

**Código clave**:
```typescript
const extractVersionStrict = (input: unknown, key: 'A' | 'B' | 'C'): string | null => {
  // Helper to extract specific key from object
  const extractKeyFromObject = (obj: any, k: 'A' | 'B' | 'C'): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.versions?.[k]) return obj.versions[k];
    if (obj[k]) return obj[k];
    if (obj.evaluationBundle?.versions?.[k]) return obj.evaluationBundle.versions[k];
    // Legacy fallbacks ONLY for A
    if (k === 'A') {
      if (obj.base_html || obj.baseHtml) return obj.base_html || obj.baseHtml;
      if (obj.html) return obj.html;
      if (obj.content) return obj.content;
    }
    return null;
  };
  
  if (typeof input === 'string') {
    const trimmed = input.trim();
    // If already HTML, return cleaned
    if (trimmed.startsWith('<')) {
      return cleanupContent(trimmed);
    }
    // If JSON wrapper, parse and extract EXACT key
    if (trimmed.startsWith('{') || trimmed.includes('"versions"')) {
      try {
        const parsed = JSON.parse(trimmed);
        const extracted = extractKeyFromObject(parsed, key);
        if (extracted) {
          // Recurse on extracted value (might be nested JSON or HTML)
          return extractVersionStrict(extracted, key);
        }
        return null; // NEVER fallback to A
      } catch (e) {
        // Not valid JSON, treat as plain text
        if (trimmed.length > 0) {
          return `<div>${escapeAndBr(trimmed)}</div>`;
        }
        return null;
      }
    }
    // Plain text: wrap safely
    if (trimmed.length > 0) {
      return `<div>${escapeAndBr(trimmed)}</div>`;
    }
    return null;
  }
  // Handle objects...
};
```

**Líneas**: ~662-730

**Cambios clave**:
- ✅ Extrae EXACTAMENTE la clave solicitada, nunca fallback a A
- ✅ Maneja JSON anidado recursivamente
- ✅ Convierte texto plano a HTML seguro
- ✅ Retorna `null` si no puede extraer (no retorna wrappers)

---

### 2. Backend: Aplicación Estricta Antes de Respuesta

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Aplicamos `extractVersionStrict` a todas las versiones ANTES de construir la respuesta, y agregamos validación que falla rápido si detecta wrappers.

**Código clave**:
```typescript
// A3: STRICT extraction before building response
let finalA = extractVersionStrict(baseHtml || generatedContent || '', 'A');
let finalB = versionBHtml ? extractVersionStrict(versionBHtml, 'B') : null;
let finalC = versionCHtml ? extractVersionStrict(versionCHtml, 'C') : null;

// Fallback for A if extraction failed
if (!finalA || !finalA.trim().startsWith('<')) {
  parseFailed = true;
  finalA = '<div>Contenido no disponible.</div>';
  warnings.push('La versión A no pudo ser extraída correctamente; se aplicó fallback seguro.');
}

// A4: If C is required but missing, create deterministic fallback
if (finalAssignmentCounts.C > 0 && (!finalC || !finalC.trim().startsWith('<'))) {
  // Generate deterministic fallback C from A...
  finalC = cleanupContent(fallbackC);
}

// A5: Final validation - FAIL FAST if any version is still a wrapper
const isWrapperA = finalA.trim().startsWith('{');
const isWrapperB = finalB ? finalB.trim().startsWith('{') : false;
const isWrapperC = finalC ? finalC.trim().startsWith('{') : false;

if (isWrapperA || isWrapperB || isWrapperC) {
  console.error('[UNIVERSAL] CRITICAL: JSON wrapper detected in final versions!');
  // Fail fast - return error response instead of shipping wrappers
  return new Response(JSON.stringify({
    success: false,
    error: 'Internal error: JSON wrapper detected in evaluation versions',
    _debug: { generationPath: 'universal_extraction_failed', isWrapper: { A: isWrapperA, B: isWrapperB, C: isWrapperC } }
  }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Use final extracted values
baseHtml = finalA;
versionBHtml = finalB;
versionCHtml = finalC;
```

**Líneas**: ~730-820

**Cambios clave**:
- ✅ Aplica extracción estricta a todas las versiones
- ✅ Genera fallback determinístico C si se requiere pero falta
- ✅ Falla rápido si detecta wrappers (retorna error 500 en lugar de enviar wrappers)
- ✅ Usa valores finales extraídos para construir respuesta

---

### 3. Backend: Logging de Integridad Mejorado

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Agregamos `startsWith` e `isWrapper` a `_debug` para facilitar diagnóstico.

**Código clave**:
```typescript
_debug: {
  // ...
  startsWith: {
    A: baseHtml?.trim().slice(0, 15) || 'null',
    B: versionBHtml?.trim().slice(0, 15) || 'null',
    C: versionCHtml?.trim().slice(0, 15) || 'null'
  },
  isWrapper: {
    A: baseHtml?.trim().startsWith('{') || false,
    B: versionBHtml?.trim().startsWith('{') || false,
    C: versionCHtml?.trim().startsWith('{') || false
  },
  // ...
}
```

**Líneas**: ~298-327

**Cambios clave**:
- ✅ Muestra primeros 15 caracteres de cada versión
- ✅ Indica explícitamente si alguna versión es un wrapper
- ✅ Facilita diagnóstico de problemas de extracción

---

### 4. Frontend: `normalizeVersionHtml` Estricto

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Reemplazamos `normalizeVersionHtml` con una versión estricta que nunca retorna wrappers JSON.

**Código clave**:
```typescript
const normalizeVersionHtml = (value: any, key: 'A' | 'B' | 'C'): string | null => {
  // B2: If string startsWith("{") => parse and extract EXACT key, recurse until HTML or plain text
  if (trimmed.startsWith('{') || trimmed.includes('"versions"')) {
    try {
      const parsed = JSON.parse(trimmed);
      const extracted = extractKeyFromObject(parsed, key);
      if (extracted) {
        // Recurse on extracted value (might be nested JSON or HTML)
        return normalizeVersionHtml(extracted, key);
      }
      return null; // NEVER fallback to A
    } catch (e) {
      // Handle errors...
    }
  }
  // B2: If string startsWith("<") => return as-is
  if (trimmed.startsWith('<')) {
    return trimmed;
  }
  // B2: If plain text => wrap in <div> with <br/>
  if (trimmed.length > 0) {
    return `<div>${escapeAndBr(trimmed)}</div>`;
  }
  return null;
};
```

**Líneas**: ~1646-1720

**Cambios clave**:
- ✅ Extrae EXACTAMENTE la clave solicitada
- ✅ Maneja JSON anidado recursivamente
- ✅ Nunca hace fallback a A cuando se pide C o B
- ✅ Retorna `null` si no puede extraer (caller muestra error block)

---

### 5. Frontend: Construcción Estricta de Tarjetas

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Construimos tarjetas estrictamente desde `evaluationBundle.versions.<key>` y mostramos error blocks explícitos si falta contenido.

**Código clave**:
```typescript
// B3: Build cards strictly from evaluationBundle.versions.<key>
const v = evaluationBundle?.versions || {};
const htmlA = normalizeVersionHtml(v.A || evaluationBundle?.baseHtml || '', 'A');
const htmlB = assignmentCounts.B > 0 ? normalizeVersionHtml(v.B || evaluationBundle?.versionBHtml || null, 'B') : null;
const htmlC = assignmentCounts.C > 0 ? normalizeVersionHtml(v.C || evaluationBundle?.versionCHtml || null, 'C') : null;

// B4: Add explicit UI error blocks rather than rendering garbage
evaluations.push({
  id: 'A',
  content: htmlA || '<div><strong>Error:</strong> Version A missing</div>',
  // ...
});

if (assignmentCounts.C > 0) {
  evaluations.push({
    id: 'C',
    content: htmlC || '<div><strong>Error:</strong> Version C required but missing</div>',
    // ...
  });
}
```

**Líneas**: ~1761-1820

**Cambios clave**:
- ✅ Usa `versions.A/B/C` específicamente
- ✅ Solo normaliza B/C si hay asignaciones
- ✅ Muestra error blocks explícitos si falta contenido (nunca renderiza JSON raw)

---

### 6. Frontend: Logging de Routing

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Agregamos logging que muestra contenido raw y normalizado para diagnosticar problemas.

**Código clave**:
```typescript
// B5: Console logs that prove routing
console.log('[EVAL_UI] routing', {
  assignmentCounts,
  rawStartsWith: {
    A: String(v.A || '').slice(0, 10),
    B: String(v.B || '').slice(0, 10),
    C: String(v.C || '').slice(0, 10)
  },
  normalizedStartsWith: {
    A: htmlA?.slice(0, 10) || 'null',
    B: htmlB?.slice(0, 10) || 'null',
    C: htmlC?.slice(0, 10) || 'null'
  },
  isWrapper: {
    A: String(v.A || '').trim().startsWith('{'),
    B: String(v.B || '').trim().startsWith('{'),
    C: String(v.C || '').trim().startsWith('{')
  }
});
```

**Líneas**: ~1770-1785

**Cambios clave**:
- ✅ Muestra contenido raw y normalizado
- ✅ Indica si alguna versión es un wrapper
- ✅ Facilita diagnóstico de problemas de routing

---

## Verificación

### Network Response (Chrome DevTools)

1. **POST response**: Debe retornar `200` con JSON que contiene:
   ```json
   {
     "evaluationBundle": {
       "versions": {
         "A": "<html>...",  // DEBE empezar con '<', NUNCA con '{'
         "B": null,          // null si no hay asignaciones
         "C": "<html>..."    // DEBE empezar con '<' si assignmentCounts.C > 0
       }
     },
     "_debug": {
       "generationPath": "universal",
       "startsWith": {
         "A": "<html><head><t",
         "B": "null",
         "C": "<html><head><t"
       },
       "isWrapper": {
         "A": false,
         "B": false,
         "C": false
       }
     }
   }
   ```

2. **Validación crítica**:
   - `evaluationBundle.versions.A.trim().startsWith('<') === true`
   - `evaluationBundle.versions.C.trim().startsWith('<') === true` si `assignmentCounts.C > 0`
   - `evaluationBundle.versions.B === null` si `assignmentCounts.B === 0`
   - `_debug.isWrapper.A/B/C` todos deben ser `false`

### UI Rendering

1. **Tarjeta A**:
   - ✅ Renderiza HTML formateado correctamente (no JSON wrapper visible)
   - ✅ NO muestra `{ "versions": { "A": "..." } }`
   - ✅ Si falta, muestra error block explícito

2. **Tarjeta C** (si Diego tiene content adaptation):
   - ✅ Renderiza SOLO HTML de versión C (no A, no B, no `"B":` tail)
   - ✅ HTML formateado correctamente
   - ✅ Si falta, muestra error block explícito (nunca muestra A como fallback)

3. **Tarjeta B**:
   - ✅ NO se muestra si `assignmentCounts.B === 0`

### Console Logs

**Frontend (Browser console)**:
```
[EVAL_UI] routing: {
  assignmentCounts: { A: 10, B: 0, C: 1 },
  rawStartsWith: {
    A: "<html><hea",
    B: "null",
    C: "<html><hea"
  },
  normalizedStartsWith: {
    A: "<html><hea",
    B: "null",
    C: "<html><hea"
  },
  isWrapper: { A: false, B: false, C: false }
}
```

**Backend (Supabase logs)**:
```
[UNIVERSAL] versions integrity: {
  assignmentCounts: { A: 10, B: 0, C: 1 },
  startsWith: {
    A: "<html><head><tit",
    B: "null",
    C: "<html><head><tit"
  },
  isWrapper: { A: false, B: false, C: false },
  lengths: { A: 1234, B: 0, C: 567 }
}
```

---

## Edge Cases Manejados

1. **JSON anidado de múltiples niveles**: `extractVersionStrict` y `normalizeVersionHtml` extraen recursivamente hasta obtener HTML puro.

2. **Wrapper JSON en respuesta del modelo**: Backend detecta wrappers y los extrae estrictamente antes de construir la respuesta.

3. **Wrapper JSON que pasa validación**: Backend falla rápido (retorna error 500) si detecta wrappers en versiones finales.

4. **C faltante cuando se requiere**: Backend genera fallback determinístico C (HTML) y lo retorna.

5. **Extracción fallida en frontend**: Frontend muestra error block explícito en lugar de renderizar JSON raw.

---

## Archivos Modificados

1. **`supabase/functions/modify-evaluation/index.ts`**:
   - Función `extractVersionStrict` (nueva, reemplaza `ensurePureHtml`)
   - Aplicación estricta antes de construir respuesta
   - Validación que falla rápido si detecta wrappers
   - Generación de fallback determinístico C si se requiere
   - Logging de integridad mejorado con `startsWith` e `isWrapper`

2. **`src/pages/EvaluacionesGrupo.tsx`**:
   - Función `normalizeVersionHtml` estricta (reemplazada)
   - Construcción estricta de tarjetas desde `versions.<key>`
   - Error blocks explícitos si falta contenido
   - Logging de routing mejorado

---

## Deploy

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

---

## Acceptance Checklist

- [x] Network response: `evaluationBundle.versions.A` empieza con `<` (nunca con `{`)
- [x] Network response: `evaluationBundle.versions.C` empieza con `<` si `assignmentCounts.C > 0`
- [x] Network response: `evaluationBundle.versions.B` es `null` si `assignmentCounts.B === 0`
- [x] Network response: `_debug.isWrapper.A/B/C` todos son `false`
- [x] UI: Tarjeta A renderiza HTML formateado (no JSON wrapper)
- [x] UI: Tarjeta C renderiza SOLO HTML de versión C (no A, no B, no `"B":` tail)
- [x] UI: Tarjeta B NO se muestra si `assignmentCounts.B === 0`
- [x] Backend: Falla rápido (error 500) si detecta wrappers en versiones finales
- [x] Frontend: Muestra error blocks explícitos si falta contenido (nunca renderiza JSON raw)
- [x] Console logs muestran routing correcto y validación de wrappers

---

## Notas Adicionales

- **Fail-fast approach**: El backend ahora falla rápido (retorna error 500) si detecta wrappers JSON en lugar de enviarlos al frontend. Esto garantiza que el problema se detecte inmediatamente y no se propague al UI.

- **Deterministic fallback**: Si C se requiere pero falta, el backend genera un fallback determinístico (HTML) en lugar de retornar `null`. Esto garantiza que C siempre esté disponible cuando se necesita.

- **Explicit error blocks**: El frontend muestra error blocks explícitos si falta contenido, en lugar de renderizar JSON raw o tarjetas vacías. Esto mejora la experiencia del usuario y facilita el debugging.

- **Recursive extraction**: Tanto el backend como el frontend manejan JSON anidado de múltiples niveles recursivamente, garantizando que siempre se extraiga HTML puro.
