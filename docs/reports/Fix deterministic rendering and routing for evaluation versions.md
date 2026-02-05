# Fix deterministic routing/rendering of evaluation versions (A/B/C)

**Fecha**: 2026-02-03  
**Objetivo**: Garantizar routing determinístico y render correcto de A/B/C sin wrappers JSON.  
**Status**: ✅ STEP 1-4 IMPLEMENTED (backend string enforcement + frontend validation)  
**Root Cause**: `versions.A/B/C` eran **objetos** en lugar de strings HTML

---

## Archivos modificados

1. `supabase/functions/modify-evaluation/index.ts`
2. `src/pages/EvaluacionesGrupo.tsx`
3. `src/components/evaluaciones/HTMLRenderer.tsx`
4. `src/components/evaluaciones/CleanEvaluationDisplay.tsx`

---

## Backend — Guarantee definitivo (finalizeVersion)

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

### Función final (single source of truth)

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
      return cleanupContent(trimmed);
    }
    if (trimmed.startsWith('{') || trimmed.includes('"versions"')) {
      try {
        let parsed: any;
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          const normalized = trimmed.replace(/'/g, '"').replace(/(\w+):/g, '"$1":');
          parsed = JSON.parse(normalized);
        }
        const extracted = extractKeyFromObject(parsed, key);
        if (extracted) {
          return finalizeVersion(extracted, key);
        }
        return null;
      } catch (e) {
        return null;
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

### Construcción final (A2/A4)

- `finalA = finalizeVersion(baseHtml ?? generatedContent, 'A')`
- `finalB = shouldHaveB ? finalizeVersion(versionBHtml, 'B') : null`
- `finalC = shouldHaveC ? finalizeVersion(versionCHtml, 'C') : null`

Fallbacks:
- Si `finalA` es `null`: se fuerza HTML de error y se loguea crítico
- Si `shouldHaveC` es `true` y `finalC` es `null`: HTML de error (nunca copiar A)

### Logs + _debug (A3)

```typescript
console.log('[VERSIONS_FINAL]', {
  shouldHaveB, shouldHaveC,
  startsWith: { A: finalA?.slice(0, 15), B: finalB?.slice(0, 15), C: finalC?.slice(0, 15) },
  isHtml: { A: !!finalA && finalA.trim().startsWith('<'), ... },
  hasWrapper: { A: !!finalA && finalA.trim().startsWith('{'), ... },
  lens: { A: finalA?.length ?? 0, ... }
});
```

Y en `_debug` del response:

```json
{
  "_debug": {
    "shouldHaveB": true,
    "shouldHaveC": true,
    "startsWith": { "A": "<p>...", "B": "<p>...", "C": "<p>..." },
    "isHtml": { "A": true, "B": true, "C": true },
    "hasWrapper": { "A": false, "B": false, "C": false },
    "versionsLengths": { "A": 1234, "B": 987, "C": 456 }
  }
}
```

---

## Frontend — Cards solo desde versions.*

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

### Fuente única

```typescript
const rawA = evaluationBundle?.versions?.A ?? null;
const rawB = evaluationBundle?.versions?.B ?? null;
const rawC = evaluationBundle?.versions?.C ?? null;

const htmlA = isHtmlString(rawA) ? rawA.trim() : null;
const htmlB = isHtmlString(rawB) ? rawB.trim() : null;
const htmlC = isHtmlString(rawC) ? rawC.trim() : null;
```

### Reglas de cards

- A siempre se muestra; si `htmlA` es null → error block
- B se muestra solo si `assignmentCounts.B > 0` **o** `triggers.versionB === true`
- C se muestra solo si `assignmentCounts.C > 0`; si falta → error block

### Log de prueba

```typescript
console.log('[UI_VERSIONS]', {
  A: { type: typeof rawA, start: String(rawA ?? '').slice(0, 30), len: String(rawA ?? '').length },
  B: { type: typeof rawB, start: String(rawB ?? '').slice(0, 30), len: String(rawB ?? '').length },
  C: { type: typeof rawC, start: String(rawC ?? '').slice(0, 30), len: String(rawC ?? '').length },
  assignmentCounts
});
```

---

## Render pipeline — HTML sin escape + wrapper error

**Archivo**: `src/components/evaluaciones/HTMLRenderer.tsx`

- Si el contenido empieza con `<`, se renderiza con `dangerouslySetInnerHTML`
- Si empieza con `{`, se muestra bloque de error (nunca wrapper crudo)

**Archivo**: `src/components/evaluaciones/CleanEvaluationDisplay.tsx`

- Si recibe wrapper, muestra error explícito y no intenta parsear

---

## Respuesta esperada (ejemplo)

```json
{
  "success": true,
  "evaluationBundle": {
    "versions": {
      "A": "<p>...A...</p>",
      "B": null,
      "C": "<p>...C...</p>"
    }
  },
  "_debug": {
    "shouldHaveB": false,
    "shouldHaveC": true,
    "startsWith": { "A": "<p>...A", "B": "null", "C": "<p>...C" },
    "isHtml": { "A": true, "B": false, "C": true },
    "hasWrapper": { "A": false, "B": false, "C": false }
  }
}
```

---

## Resultado esperado en runtime

- A card renderiza SOLO `evaluationBundle.versions.A`
- C card renderiza SOLO `evaluationBundle.versions.C`
- B card NO aparece si `assignmentCounts.B == 0` y `triggers.versionB === false`
- Nunca se renderiza wrapper JSON ni fragmentos `"versions": { ... }`

---

## PHASE 1 — Panel de Integridad en UI (forensics)

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

Panel visible solo con `VITE_DEBUG_EVAL_PIPELINE=true`, muestra:
- `typeof` de `versions.A/B/C`
- `start` (primeros 30 chars)
- `len`
- `assignmentCounts`
- `renderSource` usado por cada card

---

## PHASE 1B — Render Path Assertion

**Archivos**:
- `src/components/evaluaciones/HTMLRenderer.tsx`
- `src/components/evaluaciones/CleanEvaluationDisplay.tsx`

Regla:
- Si `content` empieza con `{` **o** contiene `"versions"` antes del primer `<`, se muestra un bloque de error rojo con snippet (120 chars). Nunca se renderiza wrapper.

---

## PHASE 3 — Heurística para wrappers inválidos

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

Si el wrapper JSON es inválido y `JSON.parse` falla, se intenta extracción heurística:
- Busca la clave `"A"`/`"B"`/`"C"`
- Toma el primer `<` luego de la clave
- Cierra en `</html>` o `</section>` o `</div>` o fin

Esto evita que wrappers rotos lleguen al frontend.

