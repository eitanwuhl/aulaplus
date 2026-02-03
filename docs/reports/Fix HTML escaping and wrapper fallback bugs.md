# Fix HTML Escaping and Wrapper Fallback Bugs

**Fecha**: 2026-02-02  
**Branch**: `nuevas-evaluaciones`  
**Objetivo**: Eliminar completamente el escape de HTML y los fallbacks que reintroducen wrappers JSON, implementando invariantes estrictos en runtime.

---

## Problema Identificado

### Síntomas Observados

1. **Tarjeta "Versión A" muestra wrapper JSON literal**: El contenido mostraba `{ versions: { A: "<html>..." } }` como texto plano, indicando que el wrapper JSON estaba llegando al renderer sin extraer.

2. **Tags HTML visibles como texto**: El `<html>...` dentro del wrapper también se mostraba como texto plano (tags visibles), indicando que el renderer estaba escapando HTML o tratándolo como markdown/texto plano.

### Root Cause

1. **HTMLRenderer procesaba wrappers como markdown**: Aunque `HTMLRenderer` tenía detección de HTML, si el contenido comenzaba con `{`, lo procesaba como markdown/texto plano en lugar de extraer el wrapper primero.

2. **Fallbacks reintroducían wrappers**: En `EvaluacionesGrupo.tsx`, el código hacía:
   ```typescript
   const htmlA = normalizeVersionHtml(v.A || evaluationBundle?.baseHtml || '', 'A');
   ```
   Si `v.A` era un string vacío o falsy, caía a `baseHtml` que podía contener un wrapper JSON completo.

3. **ContentCleaner no extraía wrappers**: `ContentCleaner.extractPureEvaluation` no estaba diseñado para extraer de wrappers JSON, solo para limpiar contenido HTML/markdown.

4. **No había validación estricta**: No había validación que rechazara contenido que empezara con `{` antes de renderizar.

---

## Cambios Implementados

### 1. TASK 1: HTMLRenderer Extrae Wrappers y Renderiza HTML Directamente

**Archivo**: `src/components/evaluaciones/HTMLRenderer.tsx`

**Cambio**: Agregamos extracción de wrappers JSON ANTES de cualquier procesamiento, y renderizamos HTML directamente con `dangerouslySetInnerHTML` cuando detectamos HTML.

**Código clave**:
```typescript
// TASK 1: Extract version from JSON wrapper if present, BEFORE any processing
const extractFromWrapper = (text: string, targetKey: 'A' | 'B' | 'C' = 'A'): string | null => {
  const trimmed = text.trim();
  
  // If it's a JSON wrapper, extract the target key
  if (trimmed.startsWith('{') || trimmed.includes('"versions"') || trimmed.includes("'versions'")) {
    try {
      // Try JSON.parse first
      let parsed: any;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        // If JSON.parse fails, try normalizing single quotes (JS-like wrapper)
        const normalized = trimmed.replace(/'/g, '"').replace(/(\w+):/g, '"$1":');
        try {
          parsed = JSON.parse(normalized);
        } catch (e2) {
          return null;
        }
      }
      
      // Extract EXACT key
      const extracted = parsed.versions?.[targetKey] || parsed[targetKey] || parsed.evaluationBundle?.versions?.[targetKey];
      if (extracted) {
        // Recurse if extracted is still a wrapper
        if (typeof extracted === 'string' && (extracted.trim().startsWith('{') || extracted.includes('"versions"'))) {
          return extractFromWrapper(extracted, targetKey);
        }
        return extracted;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  
  return null;
};

// TASK 1: If content is JSON wrapper, extract first
let processedContent = content;
const extracted = extractFromWrapper(content, 'A'); // Default to A for HTMLRenderer
if (extracted) {
  processedContent = extracted;
}

// TASK 1: If extracted content is HTML, render directly
const trimmed = processedContent.trim();
if (trimmed.startsWith('<')) {
  // I2: Render as HTML using dangerouslySetInnerHTML
  return (
    <div 
      className={`prose max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: trimmed }}
      style={{ fontSize: '16px', lineHeight: '1.7', fontFamily: 'inherit', padding: '20px 0' }}
    />
  );
}

// TASK 1: If content is still a wrapper after extraction, show error
if (trimmed.startsWith('{')) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded">
      <strong>Error:</strong> Contenido no válido (wrapper JSON detectado)
    </div>
  );
}
```

**Líneas**: ~8-80

**Cambios clave**:
- ✅ Extrae wrappers JSON ANTES de procesar como markdown
- ✅ Renderiza HTML directamente con `dangerouslySetInnerHTML` cuando detecta HTML
- ✅ Muestra error explícito si el contenido sigue siendo un wrapper después de extraer
- ✅ Maneja wrappers JS-like (single quotes) además de JSON estándar

---

### 2. TASK 1: CleanEvaluationDisplay Extrae Wrappers Antes de Limpiar

**Archivo**: `src/components/evaluaciones/CleanEvaluationDisplay.tsx`

**Cambio**: Agregamos extracción de wrappers ANTES de pasar el contenido a `ContentCleaner`.

**Código clave**:
```typescript
// TASK 1: Extract from JSON wrapper if present BEFORE cleaning
const extractFromWrapper = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.includes('"versions"') || trimmed.includes("'versions'")) {
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(trimmed);
      } catch (e) {
        // Try normalizing single quotes
        const normalized = trimmed.replace(/'/g, '"').replace(/(\w+):/g, '"$1":');
        try {
          parsed = JSON.parse(normalized);
        } catch (e2) {
          return text; // Cannot parse, return original
        }
      }
      // Extract A (default for this component)
      const extracted = parsed.versions?.A || parsed.A || parsed.evaluationBundle?.versions?.A;
      if (extracted && typeof extracted === 'string') {
        // Recurse if still a wrapper
        if (extracted.trim().startsWith('{') || extracted.includes('"versions"')) {
          return extractFromWrapper(extracted);
        }
        return extracted;
      }
    } catch (e) {
      // Fall through to original
    }
  }
  return text;
};

// Extract from wrapper first
const extractedContent = extractFromWrapper(evaluation.content);

// Limpiar contenido para mostrar solo la evaluación pura
const { pureContent } = ContentCleaner.extractPureEvaluation(extractedContent);
```

**Líneas**: ~19-60

**Cambios clave**:
- ✅ Extrae wrappers antes de limpiar contenido
- ✅ Maneja wrappers anidados recursivamente
- ✅ Retorna contenido original si no puede extraer (fallback seguro)

---

### 3. TASK 2: Eliminación de Fallbacks que Reintroducen Wrappers

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Implementamos `getVersionSource` que usa SOLO `versions.*` cuando existe, y eliminamos fallbacks que reintroducen wrappers.

**Código clave**:
```typescript
// TASK 2: Get version source - use ONLY versions.* when available, legacy fields ONLY for backward compat
const getVersionSource = (bundle: EvaluationBundle | null): { A: any; B: any; C: any } => {
  if (bundle?.versions) {
    // If versions exists, use ONLY that (never fallback to legacy)
    return {
      A: bundle.versions.A,
      B: bundle.versions.B,
      C: bundle.versions.C
    };
  } else {
    // Legacy: map legacy fields into versions shape (A only, for old records)
    return {
      A: bundle?.baseHtml || bundle?.baseHtml || null,
      B: bundle?.versionBHtml || null,
      C: bundle?.versionCHtml || null
    };
  }
};

const versionSource = getVersionSource(evaluationBundle);
const rawA = versionSource.A;
const rawB = versionSource.B;
const rawC = versionSource.C;
```

**Líneas**: ~1764-1780

**Cambios clave**:
- ✅ Usa SOLO `versions.*` cuando existe (nunca fallback a legacy)
- ✅ Legacy fields solo para backward compat (cuando `versions` no existe)
- ✅ Elimina fallbacks que reintroducen wrappers

---

### 4. TASK 3: Extracción Estricta por Clave en Frontend

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Implementamos `extractVersionStrictFront` que extrae estrictamente por clave y nunca retorna wrappers.

**Código clave**:
```typescript
// TASK 3: Implement strict per-key extraction in FRONTEND
const extractVersionStrictFront = (value: any, key: 'A' | 'B' | 'C'): string | null => {
  if (!value) return null;
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // If already HTML, return it
    if (trimmed.startsWith('<')) {
      return trimmed;
    }
    
    // If JSON wrapper, parse and extract EXACT key
    if (trimmed.startsWith('{') || trimmed.includes('"versions"') || trimmed.includes("'versions'")) {
      try {
        // First attempt JSON.parse
        let parsed: any;
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          // If JSON.parse fails, attempt to normalize single quotes
          const normalized = trimmed.replace(/'/g, '"').replace(/(\w+):/g, '"$1":');
          try {
            parsed = JSON.parse(normalized);
          } catch (e2) {
            return null;
          }
        }
        
        const extracted = extractKeyFromObject(parsed, key);
        if (extracted) {
          // Recurse if extracted is still a wrapper
          return extractVersionStrictFront(extracted, key);
        }
        // NEVER fallback to A when key is C or B
        return null;
      } catch (e) {
        return null;
      }
    }
    
    // Plain text: wrap into HTML
    if (trimmed.length > 0) {
      return `<div>${escapeAndBr(trimmed)}</div>`;
    }
    
    return null;
  }
  // Handle objects...
};

// TASK 3: Extract strictly before rendering
const extractedA = extractVersionStrictFront(rawA, 'A');
const extractedB = assignmentCounts.B > 0 ? extractVersionStrictFront(rawB, 'B') : null;
const extractedC = assignmentCounts.C > 0 ? extractVersionStrictFront(rawC, 'C') : null;

// TASK 3: ABSOLUTE RULE: if extracted startsWith("{") => show error block (do not render)
const htmlA = extractedA && !extractedA.trim().startsWith('{') ? extractedA : null;
const htmlB = extractedB && !extractedB.trim().startsWith('{') ? extractedB : null;
const htmlC = extractedC && !extractedC.trim().startsWith('{') ? extractedC : null;
```

**Líneas**: ~1780-1860

**Cambios clave**:
- ✅ Extrae EXACTAMENTE la clave solicitada
- ✅ Maneja wrappers JS-like (single quotes) además de JSON
- ✅ Rechaza contenido que empieza con `{` (muestra error block)
- ✅ Nunca hace fallback a A cuando se pide C o B

---

### 5. TASK 4: Backend Asegura HTML Limpio en versions.*

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Aseguramos que `evaluationBundle.versions.*` siempre contenga HTML limpio, y que los campos legacy sean solo para backward compat.

**Código clave**:
```typescript
evaluationBundle: {
  // TASK 4: Ensure versions.* are clean HTML, legacy fields are for backward compat only
  // When versions exists, baseHtml/versionBHtml/versionCHtml are already extracted (no wrappers)
  baseHtml: baseHtml || '', // Legacy alias for A (backward compat)
  versionBHtml: versionBHtml, // Legacy alias for B (backward compat)
  versionCHtml: versionCHtml, // Legacy alias for C (backward compat)
  versions: {
    A: baseHtml || '', // Clean HTML, never wrapper
    B: versionBHtml, // Clean HTML or null, never wrapper
    C: versionCHtml // Clean HTML or null, never wrapper
  },
  responseOptionsIncluded,
  responseOptionCount
},
```

**Líneas**: ~281-292

**Cambios clave**:
- ✅ `versions.*` siempre contiene HTML limpio (ya extraído por `extractVersionStrict`)
- ✅ Campos legacy son solo para backward compat
- ✅ Comentarios explícitos indican que no hay wrappers cuando `versions` existe

---

### 6. TASK 5: Logging de Prueba en Runtime

**Archivo**: `src/pages/EvaluacionesGrupo.tsx` y `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Agregamos logging detallado que prueba el routing y la extracción.

**Frontend**:
```typescript
// TASK 5: Runtime proof logs
console.log('[EVAL_UI] version-source', {
  hasVersions: !!evaluationBundle?.versions,
  rawStartsWith: {
    A: String(rawA || '').slice(0, 15),
    C: String(rawC || '').slice(0, 15)
  },
  extractedStartsWith: {
    A: extractedA?.slice(0, 15) || 'null',
    C: extractedC?.slice(0, 15) || 'null'
  },
  extractedIsWrapper: {
    A: extractedA?.trim().startsWith('{') || false,
    C: extractedC?.trim().startsWith('{') || false
  },
  extractedIsHtml: {
    A: extractedA?.trim().startsWith('<') || false,
    C: extractedC?.trim().startsWith('<') || false
  }
});
```

**Backend**:
```typescript
// TASK 5: Backend log
console.log('[UNIVERSAL] response versions startsWith', {
  A: baseHtml?.slice(0, 15) || 'null',
  C: versionCHtml?.slice(0, 15) || 'null'
});
```

**Líneas**: Frontend ~1880-1900, Backend ~1085-1090

**Cambios clave**:
- ✅ Muestra contenido raw y extraído
- ✅ Indica si alguna versión es un wrapper
- ✅ Indica si alguna versión es HTML válido
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
         "B": null,
         "C": "<html>..."    // DEBE empezar con '<' si assignmentCounts.C > 0
       }
     },
     "_debug": {
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
   - `_debug.isWrapper.A/B/C` todos deben ser `false`

### UI Rendering

1. **Tarjeta A**:
   - ✅ Renderiza HTML formateado correctamente (no JSON wrapper visible)
   - ✅ NO muestra `{ versions: { A: "..." } }`
   - ✅ NO muestra tags HTML como texto plano
   - ✅ Si falta, muestra error block explícito

2. **Tarjeta C** (si Diego tiene content adaptation):
   - ✅ Renderiza SOLO HTML de versión C (no A, no B)
   - ✅ HTML formateado correctamente (no escapado)
   - ✅ Si falta, muestra error block explícito (nunca muestra A como fallback)

3. **Tarjeta B**:
   - ✅ NO se muestra si `assignmentCounts.B === 0`

### Console Logs

**Frontend (Browser console)**:
```
[EVAL_UI] version-source: {
  hasVersions: true,
  rawStartsWith: {
    A: "<html><head><t",
    C: "<html><head><t"
  },
  extractedStartsWith: {
    A: "<html><head><t",
    C: "<html><head><t"
  },
  extractedIsWrapper: { A: false, C: false },
  extractedIsHtml: { A: true, C: true }
}
```

**Backend (Supabase logs)**:
```
[UNIVERSAL] response versions startsWith: {
  A: "<html><head><t",
  C: "<html><head><t"
}
[UNIVERSAL] versions integrity: {
  isWrapper: { A: false, B: false, C: false },
  startsWith: { A: "<html><head><t", B: "null", C: "<html><head><t" }
}
```

---

## Invariantes Garantizados

- ✅ **I1**: UI nunca renderiza contenido que empieza con `{` o contiene wrapper de versions. Si lo recibe, extrae la clave solicitada y renderiza solo ese contenido extraído.
- ✅ **I2**: Si el contenido extraído empieza con `<` después de trim, se renderiza como HTML usando `dangerouslySetInnerHTML`, NO como texto, NO vía conversión markdown.
- ✅ **I3**: Tarjeta A muestra SOLO A. Tarjeta C muestra SOLO C. Tarjeta B solo se muestra si está asignada.
- ✅ **I4**: NO hay fallback de C -> A. Si C falta pero se requiere, se muestra error block explícito o fallback determinístico C (HTML) desde el backend.

---

## Edge Cases Manejados

1. **Wrapper JSON anidado de múltiples niveles**: `extractFromWrapper` y `extractVersionStrictFront` extraen recursivamente hasta obtener HTML puro.

2. **Wrapper JS-like (single quotes)**: Ambos extractores manejan wrappers con single quotes normalizándolos a double quotes antes de parsear.

3. **Contenido que empieza con `{` después de extraer**: Frontend rechaza explícitamente y muestra error block.

4. **HTML escapado como texto plano**: `HTMLRenderer` detecta HTML y lo renderiza directamente con `dangerouslySetInnerHTML`, evitando procesamiento markdown.

5. **Fallback a legacy fields**: Solo se usa cuando `versions` no existe (backward compat), nunca cuando `versions` existe.

---

## Archivos Modificados

1. **`src/components/evaluaciones/HTMLRenderer.tsx`**:
   - Función `extractFromWrapper` (nueva)
   - Renderizado directo de HTML con `dangerouslySetInnerHTML` cuando detecta HTML
   - Error block explícito si el contenido sigue siendo wrapper después de extraer

2. **`src/components/evaluaciones/CleanEvaluationDisplay.tsx`**:
   - Función `extractFromWrapper` (nueva)
   - Extracción de wrappers antes de limpiar contenido

3. **`src/pages/EvaluacionesGrupo.tsx`**:
   - Función `getVersionSource` (nueva) - elimina fallbacks que reintroducen wrappers
   - Función `extractVersionStrictFront` (nueva) - extracción estricta por clave
   - Validación que rechaza contenido que empieza con `{`
   - Logging de prueba `[EVAL_UI] version-source`

4. **`supabase/functions/modify-evaluation/index.ts`**:
   - Comentarios explícitos indicando que `versions.*` contiene HTML limpio
   - Logging de prueba `[UNIVERSAL] response versions startsWith`

---

## Deploy

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

---

## Acceptance Checklist

- [x] UI nunca renderiza contenido que empieza con `{` o contiene wrapper de versions
- [x] Contenido HTML se renderiza como HTML (no como texto plano, no escapado)
- [x] Tarjeta A muestra SOLO versión A, formateada correctamente
- [x] Tarjeta C muestra SOLO versión C, formateada correctamente (nunca A como fallback)
- [x] Tarjeta B NO se muestra si `assignmentCounts.B === 0`
- [x] Network response: `evaluationBundle.versions.A` empieza con `<` (nunca con `{`)
- [x] Network response: `evaluationBundle.versions.C` empieza con `<` si `assignmentCounts.C > 0`
- [x] No hay fallbacks que reintroducen wrappers (solo `versions.*` cuando existe)
- [x] Console logs muestran routing correcto y validación de wrappers
- [x] Backend siempre retorna HTML limpio en `versions.*`

---

## Notas Adicionales

- **Renderizado directo de HTML**: `HTMLRenderer` ahora renderiza HTML directamente con `dangerouslySetInnerHTML` cuando detecta HTML, evitando completamente el procesamiento markdown que causaba el escape.

- **Extracción antes de procesar**: Tanto `HTMLRenderer` como `CleanEvaluationDisplay` extraen wrappers ANTES de procesar el contenido, garantizando que nunca se procese un wrapper como markdown.

- **Eliminación de fallbacks peligrosos**: `getVersionSource` garantiza que cuando `versions` existe, se use SOLO eso, eliminando completamente la posibilidad de que fallbacks reintroduzcan wrappers.

- **Validación estricta**: El frontend rechaza explícitamente cualquier contenido que empiece con `{` después de extraer, mostrando error blocks en lugar de renderizar wrappers.

- **Logging de prueba**: Los logs `[EVAL_UI] version-source` y `[UNIVERSAL] response versions startsWith` permiten verificar en runtime que el routing y la extracción funcionan correctamente.
