# PHASE 1-3: Forensics + Hard Assertions + Backend Heuristics

**Fecha**: 2026-02-03  
**Status**: ✅ IMPLEMENTADO  
**Objetivo**: Detener adivinanzas. Implementar panel forensic UI visible + assertions estrictas + backend robusto.

---

## Problema Runtime Actual

- **Card A**: "Version A missing" (htmlA es null)
- **Card C**: Contenido empieza con `{ "versions": { "A": ... } }` (wrapper leakage)
- **Card C**: Muestra contenido de A (y a veces fragmentos de B) en lugar de solo C
- **Card B**: Nunca debería aparecer si no hay asignaciones, pero lógica inconsistente

---

## PHASE 1: Forensics (UI visible + runtime evidence)

### 1A. Panel de Integridad de Versiones (UI visible)

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Ubicación**: Panel visible en UI (solo con `VITE_DEBUG_EVAL_PIPELINE=true`), **encima** de las cards de evaluación.

**Contenido**:
```typescript
// Compute debug values
const debugVersions = evaluationBundle?.versions ?? null;
const debugA = debugVersions ? debugVersions.A ?? null : legacyA;
const debugB = debugVersions ? debugVersions.B ?? null : null;
const debugC = debugVersions ? debugVersions.C ?? null : null;

// Compute diff-style checks
const cardA = displayEvaluations.find(e => e.id === 'A');
const cardC = displayEvaluations.find(e => e.id === 'C');
const diffCheckA = cardA && debugA ? (cardA.content === debugA) : null;
const diffCheckC = cardC && debugC ? (cardC.content === debugC) : null;
```

**Panel UI**:
```tsx
{showDebugPanel && (
  <Card className="mb-6 border-2 border-purple-300 bg-purple-50">
    <CardHeader>
      <CardTitle>[UI_VERSION_DEBUG] - Forensic Panel</CardTitle>
    </CardHeader>
    <CardContent className="text-xs font-mono space-y-3">
      {/* RAW API BUNDLE FIELDS */}
      <div>A: type={typeof debugA} start="{debugA?.slice(0, 40)}" len={debugA?.length}</div>
      <div>B: type={typeof debugB} start="{debugB?.slice(0, 40)}" len={debugB?.length}</div>
      <div>C: type={typeof debugC} start="{debugC?.slice(0, 40)}" len={debugC?.length}</div>
      <div>assignmentCounts: A={...}, B={...}, C={...}</div>
      <div>renderSource: A={debugVersions ? 'versions.A' : 'legacy'}</div>
      
      {/* CARD CONTENT (FINAL) */}
      <div>cardA.content: start="{cardA?.content.slice(0, 40)}" len={cardA?.content.length}</div>
      <div>cardC.content: start="{cardC?.content.slice(0, 40)}" len={cardC?.content.length}</div>
      
      {/* DIFF-STYLE CHECK */}
      <div className={diffCheckA === false ? 'text-red-600 font-bold' : ''}>
        cardA.content === versions.A: {diffCheckA ? '✅ TRUE' : '❌ FALSE'}
      </div>
      <div className={diffCheckC === false ? 'text-red-600 font-bold' : ''}>
        cardC.content === versions.C: {diffCheckC ? '✅ TRUE' : '❌ FALSE'}
      </div>
      
      {/* BIG RED FLAG */}
      {(diffCheckA === false || diffCheckC === false) && (
        <div className="mt-4 p-3 bg-red-100 border-2 border-red-500 rounded text-red-800 font-bold">
          🚨 BIG RED FLAG: CARD CONTENT DOES NOT MATCH VERSIONS SOURCE
        </div>
      )}
    </CardContent>
  </Card>
)}
```

**Propósito**: 
- Mostrar **en pantalla** (no solo console) la verdad sobre qué contiene `versions.A/B/C` del API response.
- Mostrar qué contienen las cards finales.
- **Diff check**: ¿El contenido de la card coincide con la fuente `versions.*`?
- **Big red flag**: Si diff es FALSE, alerta visible.

---

### 1B. Render Path Assertion (guard en componentes)

**Archivos**: 
- `src/components/evaluaciones/HTMLRenderer.tsx`
- `src/components/evaluaciones/CleanEvaluationDisplay.tsx`

**Lógica**:
```typescript
const trimmed = content.trim();
const versionsIdx = trimmed.indexOf('"versions"');
const firstLt = trimmed.indexOf('<');
const wrapperDetected = trimmed.startsWith('{') || (versionsIdx >= 0 && (firstLt === -1 || versionsIdx < firstLt));

if (wrapperDetected) {
  return (
    <div className="p-4 bg-red-50 border-2 border-red-500 rounded">
      <strong>ERROR: WRAPPER DETECTED</strong>
      <code className="text-xs bg-red-100 p-2 block mt-2 overflow-x-auto">
        {content.slice(0, 120)}
      </code>
    </div>
  );
}

if (trimmed.startsWith('<')) {
  return <div dangerouslySetInnerHTML={{ __html: trimmed }} />;
}

// Si no es HTML válido, mostrar error
return <div className="text-red-600">Invalid content: not HTML</div>;
```

**Propósito**:
- Si contenido empieza con `{` o contiene `"versions"` antes del primer `<`, **NUNCA** renderizar como texto.
- Mostrar bloque rojo con snippet (120 chars).
- Esto revela **dónde** se está filtrando el wrapper.

---

## PHASE 2: Fix Source-of-Truth en Frontend (no más multi-layer extraction)

### 2A. Cards usan SOLO `evaluationBundle.versions.<key>`

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambios**:
```typescript
// PHASE 2: Use ONLY evaluationBundle.versions.* as source (no fallbacks to bundle object)
const versions = evaluationBundle?.versions ?? null;
const legacyA = !versions
  ? (evaluationBundle?.baseHtml || evaluationBundle?.base_html || evaluationBundle?.content || evaluationBundle?.html || null)
  : null;

// PHASE 2A: Cards must use ONLY versions.<key> (no multi-layer extraction)
const rawA = versions ? (versions.A ?? null) : legacyA;
const rawB = versions ? (versions.B ?? null) : null;
const rawC = versions ? (versions.C ?? null) : null;

// PHASE 2B: Hard assertion - detect wrappers BEFORE building cards
const detectWrapper = (str: string | null): boolean => {
  if (!str) return false;
  const trimmed = str.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('{')) return true;
  const versionsIdx = trimmed.indexOf('"versions"');
  const firstLt = trimmed.indexOf('<');
  return versionsIdx >= 0 && (firstLt === -1 || versionsIdx < firstLt);
};

const wrapperA = detectWrapper(rawA);
const wrapperB = detectWrapper(rawB);
const wrapperC = detectWrapper(rawC);

// If wrapper detected, replace with explicit HTML error block (NEVER render wrapper as text)
const buildErrorBlock = (key: string, snippet: string): string => {
  return `<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>ERROR: WRAPPER DETECTED (${key})</strong><br><code class="text-xs bg-red-100 p-2 block mt-2 overflow-x-auto">${snippet.slice(0, 120)}</code></div>`;
};

const htmlA = wrapperA 
  ? buildErrorBlock('A', rawA!) 
  : (isHtmlString(rawA) ? rawA.trim() : null);
const htmlB = wrapperB 
  ? buildErrorBlock('B', rawB!) 
  : (isHtmlString(rawB) ? rawB.trim() : null);
const htmlC = wrapperC 
  ? buildErrorBlock('C', rawC!) 
  : (isHtmlString(rawC) ? rawC.trim() : null);
```

**Card builder**:
```typescript
// PHASE 2B: Build cards with hard assertions (no mutation, no reuse)
const evaluations: GeneratedEvaluation[] = [];

// Card A - always shown
const contentA = htmlA || '<div class="...">Error: Version A missing.</div>';
evaluations.push({
  id: 'A',
  title: 'Versión A (Universal)',
  content: contentA, // IMMUTABLE, no reuse
  version: 1,
  versionKind: 'A',
  // ...
});

// Card B - only if assigned or forced
if (shouldShowB) {
  const contentB = htmlB || '<div class="...">Error: Version B missing.</div>';
  evaluations.push({
    id: 'B',
    content: contentB, // IMMUTABLE
    // ...
  });
}

// Card C - only if C is assigned
if (assignmentCounts.C > 0) {
  const contentC = htmlC || '<div class="...">Error: Version C missing.</div>';
  evaluations.push({
    id: 'C',
    content: contentC, // IMMUTABLE
    // ...
  });
}

// PHASE 1: Log card content for debugging (after build)
console.log('[UI_CARDS_BUILT]', evaluations.map(e => ({
  id: e.id,
  contentStart: e.content.slice(0, 40),
  contentLen: e.content.length
})));

return evaluations;
```

**Garantías**:
- Cada card tiene su propio `content*` variable (no reuso).
- Si wrapper detectado, se reemplaza con HTML de error **antes** de pushear a array.
- Logs de construcción de cards para debugging.

---

### 2B. Renderer components are DUMB (no wrapper extraction)

**Archivos**: 
- `src/components/evaluaciones/HTMLRenderer.tsx`
- `src/components/evaluaciones/CleanEvaluationDisplay.tsx`

**Cambios**:
- **Removidos**: Todas las funciones de extracción de wrapper (`extractFromWrapper`, etc).
- **Lógica nueva**:
  - Si contenido empieza con `<` → render con `dangerouslySetInnerHTML`
  - Si contenido empieza con `{` → mostrar bloque de error con snippet
  - **No intentar parsear JSON wrappers en el renderer**

---

## PHASE 3: Fix Backend Normalization Robustly (JSON.parse + heuristic fallback)

### 3A. Tolerant extraction strategy en backend

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Función `finalizeVersion`** (ya implementada en fix anterior):
```typescript
const finalizeVersion = (raw: unknown, key: 'A' | 'B' | 'C'): string | null => {
  if (!raw) return null;

  const extractKeyFromObject = (obj: any, k: 'A' | 'B' | 'C'): unknown => {
    if (!obj || typeof obj !== 'object') return null;
    return obj.versions?.[k] ?? obj[k] ?? obj.evaluationBundle?.versions?.[k] ?? null;
  };

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('<')) {
      return cleanupContent(trimmed); // HTML válido
    }
    if (trimmed.startsWith('{') || trimmed.includes('"versions"')) {
      try {
        // Try JSON.parse with normalization
        let parsed: any;
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          const normalized = trimmed.replace(/'/g, '"').replace(/(\w+):/g, '"$1":');
          parsed = JSON.parse(normalized);
        }
        const extracted = extractKeyFromObject(parsed, key);
        if (extracted) {
          return finalizeVersion(extracted, key); // Recursive
        }
        return null;
      } catch (e) {
        // HEURISTIC FALLBACK: Extract HTML by key marker
        console.warn(`[HEURISTIC] JSON.parse failed for key ${key}, trying heuristic extraction`);
        
        // Find marker like "A": "<html..." or 'A': '<html...'
        const keyMarker = `"${key}"`;
        const keyIdx = trimmed.indexOf(keyMarker);
        if (keyIdx === -1) return null;
        
        // Find start of HTML content (first < after key)
        const afterKey = trimmed.slice(keyIdx + keyMarker.length);
        const htmlStart = afterKey.indexOf('<');
        if (htmlStart === -1) return null;
        
        // Extract up to closing </html> or end of string
        const htmlContent = afterKey.slice(htmlStart);
        const htmlEnd = htmlContent.indexOf('</html>');
        const extracted = htmlEnd !== -1 
          ? htmlContent.slice(0, htmlEnd + 7)
          : htmlContent;
        
        return cleanupContent(extracted);
      }
    }
    return null;
  }

  if (typeof raw === 'object') {
    const extracted = extractKeyFromObject(raw, key);
    if (extracted) {
      return finalizeVersion(extracted, key);
    }
    return null;
  }

  return null;
};
```

**Propósito**:
- Si `JSON.parse` falla (JSON inválido del modelo), **no rendirse**.
- Usar heurística para extraer HTML después del marcador `"A"`, `"B"`, `"C"`.
- Esto tolera JSON malformado que el modelo puede generar.

---

### 3B. Enforce backend invariants + debug fields

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Respuesta buildUniversalResponse**:
```typescript
const finalA = finalizeVersion(versionA, 'A');
const finalB = finalizeVersion(versionB, 'B');
const finalC = finalizeVersion(versionC, 'C');

// ENFORCE: If A is missing, return safe HTML error (not null)
const safeA = finalA || '<div class="...">Error: Version A generation failed.</div>';

// ENFORCE: If C is required but missing, return safe HTML error (not A)
const safeC = shouldHaveC && !finalC 
  ? '<div class="...">Error: Version C generation failed.</div>' 
  : finalC;

// ENFORCE: If any version still starts with {, replace with error AND set debug flag
const wrapperDetected = {
  A: !!safeA && safeA.trim().startsWith('{'),
  B: !!finalB && finalB.trim().startsWith('{'),
  C: !!safeC && safeC.trim().startsWith('{')
};

if (wrapperDetected.A) {
  safeA = '<div class="...">Error: Wrapper detected in A (backend bug).</div>';
}
if (wrapperDetected.B) {
  finalB = '<div class="...">Error: Wrapper detected in B (backend bug).</div>';
}
if (wrapperDetected.C) {
  safeC = '<div class="...">Error: Wrapper detected in C (backend bug).</div>';
}

return new Response(JSON.stringify({
  success: true,
  evaluationBundle: {
    versions: {
      A: safeA,
      B: finalB,
      C: safeC
    },
    // legacy fields for backward compat
    baseHtml: safeA,
    versionBHtml: finalB,
    versionCHtml: safeC
  },
  _debug: {
    startsWith: {
      A: safeA?.slice(0, 40) || 'null',
      B: finalB?.slice(0, 40) || 'null',
      C: safeC?.slice(0, 40) || 'null'
    },
    lengths: {
      A: safeA?.length || 0,
      B: finalB?.length || 0,
      C: safeC?.length || 0
    },
    isHtml: {
      A: !!safeA && safeA.trim().startsWith('<'),
      B: !!finalB && finalB.trim().startsWith('<'),
      C: !!safeC && safeC.trim().startsWith('<')
    },
    wrapperDetected: wrapperDetected,
    // ... otros debug fields
  }
}), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

**Propósito**:
- Garantizar que `versions.A/B/C` **NUNCA** contengan wrappers.
- Si se detecta wrapper, reemplazar con HTML de error y setear `_debug.wrapperDetected`.
- Incluir `_debug` con `startsWith`, `lengths`, `isHtml`, `wrapperDetected` para comparación con UI debug panel.

---

## Cómo verificar en runtime (sin adivinar)

1. **Setear variable de entorno**:
   ```bash
   # En .env (root)
   VITE_DEBUG_EVAL_PIPELINE=true
   ```

2. **Reiniciar dev server**:
   ```bash
   npm run dev
   ```

3. **Generar evaluación** y observar:
   - **Panel forensic UI** (encima de las cards): Debe mostrar `versions.A/B/C` raw values, `cardA/C.content` values, y diff checks.
   - **Network tab**: Ver response de `modify-evaluation` → revisar `_debug` object.
   - **Browser console**: Logs `[UI_VERSIONS_RAW]` y `[UI_CARDS_BUILT]`.

4. **Proof of invariants**:
   - `versions.A` debe empezar con `<` (no `{`).
   - `versions.C` debe empezar con `<` (no `{`).
   - `cardA.content === versions.A` debe ser `✅ TRUE`.
   - `cardC.content === versions.C` debe ser `✅ TRUE`.
   - **No debe aparecer big red flag**.
   - Si aparece wrapper, se debe ver bloque rojo en UI (no texto crudo).

---

## Definition of Done (must show proof)

Después de fix, proveer reporte con:

1. **Screenshot del UI debug panel** mostrando:
   - `versions.A` starts with `<`
   - `versions.C` starts with `<`
   - `cardA.content` matches `versions.A`
   - `cardC.content` matches `versions.C`
   - No wrapper detected blocks
   - No B card when `assignmentCounts.B == 0`

2. **Network response `_debug`** showing:
   - `startsWith.A/C` empieza con `<html` o similar
   - `isHtml.A/C` es `true`
   - `wrapperDetected.A/C` es `false`

3. **Console logs** showing:
   - `[UI_VERSIONS_RAW]` con valores correctos
   - `[UI_CARDS_BUILT]` con contenido correcto
   - No errors de `[EVAL_UI]` sobre versiones faltantes (a menos que sea legítimo)

**No reclamar éxito sin ese proof.**

---

## Archivos modificados

1. `src/pages/EvaluacionesGrupo.tsx`:
   - Panel forensic UI (PHASE 1A)
   - Wrapper detection antes de card build (PHASE 2B)
   - Card builder sin mutación (PHASE 2B)
   - Diff checks para panel (PHASE 1)
   - Console logs para debugging

2. `src/components/evaluaciones/HTMLRenderer.tsx`:
   - Render path assertion (PHASE 1B)
   - Bloque de error si wrapper detectado
   - Lógica simplificada (no extraction)

3. `src/components/evaluaciones/CleanEvaluationDisplay.tsx`:
   - Render path assertion (PHASE 1B)
   - Bloque de error si wrapper detectado
   - Lógica simplificada (no extraction)

4. `supabase/functions/modify-evaluation/index.ts`:
   - `finalizeVersion` con heurística (PHASE 3A)
   - Backend invariants enforcement (PHASE 3B)
   - `_debug` fields extensos (PHASE 3B)

---

## Próximo paso

**Verificación en runtime**: Setear `VITE_DEBUG_EVAL_PIPELINE=true`, generar evaluación, y pegar aquí los valores del `[UI_VERSION_DEBUG]` panel y `_debug` del network response.

Con eso confirmamos el camino real y cerramos el bug **sin suposiciones**.
