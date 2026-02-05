# STEP 1-4: Backend String Enforcement (Fix Object vs String Bug)

**Fecha**: 2026-02-03  
**Status**: ✅ IMPLEMENTADO  
**Root Cause**: `evaluationBundle.versions.A/B/C` eran **objetos** en lugar de strings HTML

---

## Hard Evidence (Runtime Console)

```
[UI_VERSIONS_RAW] shows:
A: { type: 'object', keys: [...], ... }
B: { type: 'object', keys: [...], ... }
C: { type: 'object', keys: [...], ... }
```

**Conclusión**: `versions.A/B/C` son objetos, no strings. Esto causa:
- Card A missing (UI espera string HTML, recibe object)
- Wrapper leakage (objeto se serializa como JSON en UI)
- Mixed versions (C muestra contenido de A porque extracción falla)

---

## NON-NEGOTIABLE FIX

**Backend must guarantee**: `evaluationBundle.versions.<key>` son strings que contienen HTML puro (start con `<`) o `null`. **NUNCA objetos.**

---

## STEP 1: Prove the Bug in Backend with Logs

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Ubicación**: Antes de llamar `buildUniversalResponse`

```typescript
// STEP 1: PROVE THE BUG - log types before responding
console.log('[BACKEND_VERSIONS_TYPES]', {
  typeofA: typeof finalA,
  typeofB: typeof finalB,
  typeofC: typeof finalC,
  keysA: finalA && typeof finalA === 'object' ? Object.keys(finalA) : null,
  keysB: finalB && typeof finalB === 'object' ? Object.keys(finalB) : null,
  keysC: finalC && typeof finalC === 'object' ? Object.keys(finalC) : null,
  startA: typeof finalA === 'string' ? finalA.slice(0, 40) : null,
  startB: typeof finalB === 'string' ? finalB.slice(0, 40) : null,
  startC: typeof finalC === 'string' ? finalC.slice(0, 40) : null
});
```

**Propósito**: 
- Probar con evidencia si `finalA/B/C` son objetos antes de enviar response
- Mostrar keys del objeto si es object
- Mostrar primeros 40 chars si es string

---

## STEP 2: Implement `toHtmlStringStrict(raw, key)` in Backend

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Función nueva** (single source of truth para conversión):

```typescript
// STEP 2: toHtmlStringStrict - converts ANY shape to HTML string or null
const pickLeaf = (obj: any, key: 'A' | 'B' | 'C'): unknown => {
  if (!obj || typeof obj !== 'object') return null;
  return obj?.versions?.[key]
    ?? obj?.[key]
    ?? obj?.evaluationBundle?.versions?.[key]
    ?? obj?.html
    ?? obj?.content
    ?? obj?.baseHtml
    ?? obj?.base_html
    ?? null;
};

const toHtmlStringStrict = (raw: unknown, key: 'A' | 'B' | 'C'): string | null => {
  if (!raw) return null;

  // If string
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('<')) return cleanupContent(t);
    if (t.startsWith('{') || t.includes('"versions"')) {
      try {
        const parsed = JSON.parse(t);
        return toHtmlStringStrict(pickLeaf(parsed, key), key);
      } catch {
        console.warn(`[toHtmlStringStrict] JSON parse failed for key ${key}`);
        return null;
      }
    }
    return null;
  }

  // If object, pick leaf and recurse
  if (typeof raw === 'object') {
    const leaf = pickLeaf(raw, key);
    if (leaf === raw) {
      // Infinite recursion guard
      console.error(`[toHtmlStringStrict] Infinite recursion detected for key ${key}`);
      return null;
    }
    return toHtmlStringStrict(leaf, key);
  }

  return null;
};
```

**Uso**:
```typescript
let finalA = toHtmlStringStrict(baseHtml ?? generatedContent, 'A');
let finalB = shouldHaveB ? toHtmlStringStrict(versionBHtml, 'B') : null;
let finalC = shouldHaveC ? toHtmlStringStrict(versionCHtml, 'C') : null;
```

**Garantías**:
- Si `raw` es string y empieza con `<` → retorna HTML limpio
- Si `raw` es string y empieza con `{` → parsea JSON y extrae key EXACTA (no fallback)
- Si `raw` es objeto → extrae hoja (`versions[key]`, `[key]`, `html`, `content`, etc) y recursa
- Si después de recursión todavía es objeto o string con `{` → retorna `null`
- Infinite recursion guard

**Propósito**: Convertir **cualquier shape** (objeto anidado, JSON string, HTML string) en string HTML o null.

---

## STEP 3: Backend Must Respond with Strings Only

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Función `buildUniversalResponse`** (modificada):

```typescript
const buildUniversalResponse = ({ baseHtml, versionBHtml, versionCHtml, ... }) => {
  // STEP 3: ENFORCE strings only (never objects)
  const safeA = typeof baseHtml === 'string' ? baseHtml : '<div><strong>Error:</strong> Version A is not a string (backend bug)</div>';
  const safeB = versionBHtml && typeof versionBHtml === 'string' ? versionBHtml : null;
  const safeC = versionCHtml && typeof versionCHtml === 'string' ? versionCHtml : null;

  // STEP 3: If A starts with { → replace with error block
  const finalSafeA = safeA.trim().startsWith('{') 
    ? '<div><strong>Error:</strong> Wrapper JSON detected in Version A (backend normalization failed)</div>'
    : safeA;
  
  // STEP 3: If C required but null → error block (never fallback to A)
  const finalSafeC = safeC || (versionCHtml ? '<div><strong>Error:</strong> Version C normalization failed</div>' : null);

  return new Response(JSON.stringify({
    success: true,
    content: finalSafeA || '',
    type: type,
    evaluationBundle: {
      // Legacy fields for backward compat
      baseHtml: finalSafeA || '',
      versionBHtml: safeB,
      versionCHtml: finalSafeC,
      // STEP 3: versions.* are ONLY strings or null (never objects)
      versions: {
        A: finalSafeA || '',
        B: safeB,
        C: finalSafeC
      },
      responseOptionsIncluded,
      responseOptionCount
    },
    // ... rest of response
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};
```

**Garantías**:
- `typeof` check: Si `baseHtml` no es string, reemplazar con error block
- Si `safeA` empieza con `{`, reemplazar con error block (wrapper detected)
- Si C es null pero era requerido, reemplazar con error block (no fallback a A)
- **Resultado**: `versions.A/B/C` son SIEMPRE strings o null, NUNCA objetos

---

## STEP 4: Frontend - Remove Parsing, Only Accept String HTML

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

### 4A. Type Validation

```typescript
// STEP 4: Frontend - remove any parsing, only accept string HTML
let rawA = versions ? (versions.A ?? null) : legacyA;
let rawB = versions ? (versions.B ?? null) : null;
let rawC = versions ? (versions.C ?? null) : null;

// STEP 4: If typeof rawA/B/C !== 'string' → error block (and log)
if (rawA && typeof rawA !== 'string') {
  console.error('[EVAL_UI] CRITICAL: rawA is not a string, it is:', typeof rawA, rawA);
  rawA = null; // Will trigger error block below
}
if (rawB && typeof rawB !== 'string') {
  console.error('[EVAL_UI] CRITICAL: rawB is not a string, it is:', typeof rawB, rawB);
  rawB = null;
}
if (rawC && typeof rawC !== 'string') {
  console.error('[EVAL_UI] CRITICAL: rawC is not a string, it is:', typeof rawC, rawC);
  rawC = null;
}
```

**Propósito**:
- Si backend envía objeto (bug), frontend lo detecta y logea
- Reemplaza con null para triggerear error block ("Version X missing")
- **NO intenta parsear objetos** (eso solo oculta el bug)

### 4B. Console Logs Enhanced

```typescript
// STEP 4: Console logs for debugging (after type validation)
console.log('[UI_VERSIONS_RAW]', {
  A: { 
    type: typeof rawA, 
    isObject: typeof rawA === 'object' && rawA !== null,
    keys: typeof rawA === 'object' && rawA !== null ? Object.keys(rawA) : null,
    start: typeof rawA === 'string' ? rawA.slice(0, 40) : '(not string)', 
    len: typeof rawA === 'string' ? rawA.length : 0, 
    wrapper: wrapperA 
  },
  // ... similar for B, C
});
```

**Propósito**:
- Mostrar `type`, `isObject`, `keys` (si es objeto), `start`, `len`
- Permite diagnosticar si backend está enviando objetos

### 4C. Debug Panel Enhancement

```tsx
<div className={typeof debugA !== 'string' && debugA !== null ? 'text-red-600 font-bold' : ''}>
  A: type={typeof debugA} {typeof debugA === 'object' && debugA !== null ? `keys=[${Object.keys(debugA).join(',')}]` : ''} start="{String(debugA ?? '').slice(0, 40)}" len={String(debugA ?? '').length}
</div>

{/* Red warning if objects detected */}
{(typeof debugA === 'object' && debugA !== null) || ... && (
  <div className="mt-2 p-2 bg-red-100 border-2 border-red-500 rounded text-red-800 font-bold text-xs">
    ⚠️ BACKEND BUG: versions.* contains OBJECTS instead of strings!
  </div>
)}
```

**Propósito**:
- Mostrar `typeof` en UI
- Si es objeto, mostrar keys
- Red warning visible si backend envía objetos

---

## Render Only if String Starts with `<`

**Ya implementado en PHASE 1B** (`HTMLRenderer.tsx`, `CleanEvaluationDisplay.tsx`):

```typescript
if (wrapperDetected) {
  return <ErrorBlock>WRAPPER DETECTED: {snippet}</ErrorBlock>;
}

if (trimmed.startsWith('<')) {
  return <div dangerouslySetInnerHTML={{ __html: trimmed }} />;
}

return <ErrorBlock>Invalid content: not HTML</ErrorBlock>;
```

**Garantía**: Si contenido no es string HTML (empieza con `<`), se muestra error, NO se renderiza texto crudo.

---

## Definition of Done (Must Show Proof)

Después de fix, proveer:

### 1. Network Response Screenshot

En network tab (response de `modify-evaluation`):
```json
{
  "evaluationBundle": {
    "versions": {
      "A": "<html>...",  // typeof === "string"
      "B": null,
      "C": "<html>..."   // typeof === "string"
    }
  },
  "_debug": {
    "startsWith": {
      "A": "<html>...",
      "C": "<html>..."
    },
    "isHtml": {
      "A": true,
      "C": true
    }
  }
}
```

**Verificar**:
- `typeof versions.A === "string"`
- `versions.A` starts with `<`
- `versions.C` starts with `<` (when required)
- `_debug.isHtml.A/C` es `true`

### 2. UI Debug Panel Screenshot

Panel `[UI_VERSION_DEBUG]` mostrando:
```
A: type=string start="<html>..." len=12345
C: type=string start="<html>..." len=6789
```

**Verificar**:
- `type=string` (NO `type=object`)
- No aparece red warning "BACKEND BUG: versions.* contains OBJECTS"
- `cardA.content === versions.A` es `✅ TRUE`
- `cardC.content === versions.C` es `✅ TRUE`

### 3. Console Logs

Terminal (backend):
```
[BACKEND_VERSIONS_TYPES] {
  typeofA: 'string',
  typeofB: 'object', // ← si esto no es 'string' o null, hay bug
  typeofC: 'string',
  keysA: null,
  startA: '<html>...'
}
```

Browser console (frontend):
```
[UI_VERSIONS_RAW] {
  A: { type: 'string', isObject: false, start: '<html>...', len: 12345 },
  C: { type: 'string', isObject: false, start: '<html>...', len: 6789 }
}
```

**Verificar**:
- `typeofA/C === 'string'`
- `isObject === false`
- No errors `[EVAL_UI] CRITICAL: rawA is not a string`

### 4. Rendered Cards

- Card A muestra HTML formateado (NO "Version A missing")
- Card C muestra HTML formateado, diferente de A (NO wrapper JSON text)
- No aparece texto `{ "versions": ...` en ninguna card
- No aparece bloque rojo "WRAPPER DETECTED"

---

## Archivos Modificados

1. **`supabase/functions/modify-evaluation/index.ts`**:
   - `toHtmlStringStrict()` (STEP 2)
   - Logs `[BACKEND_VERSIONS_TYPES]` (STEP 1)
   - `buildUniversalResponse()` con type enforcement (STEP 3)

2. **`src/pages/EvaluacionesGrupo.tsx`**:
   - Type validation para `rawA/B/C` (STEP 4)
   - Enhanced console logs con `type`, `isObject`, `keys`
   - Debug panel con `typeof` display y red warning para objects

---

## Próximo Paso

**Verificación en runtime**:

1. Setear `VITE_DEBUG_EVAL_PIPELINE=true`
2. Generar evaluación
3. Tomar screenshots de:
   - Network response (JSON con `versions.*`)
   - UI debug panel
   - Rendered cards
4. Pegar logs de terminal (backend) y browser console (frontend)

**No reclamar éxito sin esas pruebas.**
