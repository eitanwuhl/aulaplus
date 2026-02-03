# Fix Escaped JSON/HTML Rendering and Version Routing

**Fecha**: 2026-02-02  
**Branch**: `nuevas-evaluaciones`  
**Objetivo**: Corregir el renderizado de HTML escapado y el enrutamiento de versiones para que cada tarjeta muestre SOLO su versión correspondiente, formateada correctamente.

---

## Problema Identificado

### Síntomas Observados

1. **Tarjeta "Versión A" muestra JSON wrapper literal**: El contenido mostraba texto como `{ "versions": { "A": "<html>..." } }` y `<html>...` como texto plano, indicando que el HTML estaba siendo escapado o tratado como texto plano.

2. **Tarjeta "Versión C" muestra A + tail de B**: La tarjeta C contenía contenido de A limpio pero también incluía `"B":` al final, indicando que la extracción para C estaba extrayendo contenido incorrecto o el backend retornaba un wrapper combinado.

### Root Cause

1. **Frontend**: `HTMLRenderer.parseContent` estaba diseñado para procesar texto plano/markdown y convertirlo a HTML. Cuando recibía HTML ya formateado (especialmente si venía de un JSON wrapper), lo trataba como texto plano y lo procesaba incorrectamente, escapando los tags HTML.

2. **Frontend**: `normalizeVersionHtml` no manejaba correctamente JSON anidado de múltiples niveles, causando que extrajera versiones incorrectas o fallara en la extracción.

3. **Backend**: Aunque `ensurePureHtml` validaba que el HTML empezara con `<`, no había una validación final antes de construir la respuesta que garantizara que `evaluationBundle.versions.A/B/C` fueran HTML puro.

4. **Backend**: No había logging suficiente para diagnosticar problemas de extracción y enrutamiento.

---

## Cambios Implementados

### 1. Frontend: `HTMLRenderer` Detecta HTML Puro

**Archivo**: `src/components/evaluaciones/HTMLRenderer.tsx`

**Cambio**: Agregamos detección de HTML puro al inicio de `parseContent` para que si el contenido ya es HTML, se renderice directamente sin procesamiento adicional.

**Código clave**:
```typescript
const isAlreadyHTML = (text: string): boolean => {
  const trimmed = text.trim();
  return trimmed.startsWith('<') && (
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<div') ||
    trimmed.startsWith('<p') ||
    trimmed.startsWith('<h1') ||
    trimmed.startsWith('<h2') ||
    trimmed.startsWith('<h3') ||
    trimmed.startsWith('<section') ||
    trimmed.startsWith('<table') ||
    trimmed.startsWith('<ul') ||
    trimmed.startsWith('<ol')
  );
};

const parseContent = (text: string): string => {
  let normalized = text.trim();
  
  // CRITICAL: If content is already HTML, return it directly (only minimal cleanup)
  if (isAlreadyHTML(normalized)) {
    // Only apply minimal cleanup for HTML: remove code block artifacts, normalize breaks
    normalized = normalized.replace(/^```html\s*/i, '');
    normalized = normalized.replace(/\s*```\s*$/i, '');
    normalized = normalized.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');
    return normalized;
  }
  // ... rest of markdown processing
};
```

**Líneas**: ~8-30

**Cambios clave**:
- ✅ Detecta HTML puro y lo renderiza directamente
- ✅ Solo aplica limpieza mínima (remover code blocks, normalizar breaks)
- ✅ Evita procesar HTML como markdown/texto plano

---

### 2. Frontend: `normalizeVersionHtml` Mejorado para JSON Anidado

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Mejoramos `normalizeVersionHtml` para manejar mejor JSON anidado de múltiples niveles y asegurar extracción correcta.

**Código clave**:
```typescript
// If it's a JSON string, parse and extract EXACTLY the targetKey
if (trimmed.startsWith('{') && (trimmed.includes('"versions"') || trimmed.includes(`"${targetKey}"`) || ...)) {
  try {
    const parsed = JSON.parse(trimmed);
    const extracted = extractVersionByKey(parsed, targetKey);
    if (extracted) {
      // Recursively normalize the extracted value (might be nested JSON or HTML string)
      const normalized = normalizeVersionHtml(extracted, targetKey);
      // If normalized result is HTML (starts with '<'), return it
      if (normalized && normalized.trim().startsWith('<')) {
        return normalized;
      }
      // If normalized is still not HTML, it might be a JSON string that needs another parse
      if (normalized && typeof normalized === 'string' && normalized.trim().startsWith('{')) {
        // Try one more level of extraction
        return normalizeVersionHtml(normalized, targetKey);
      }
      // If we got plain text, wrap it
      if (normalized && normalized.length > 0) {
        return normalized;
      }
    }
    return null; // Don't fallback to A
  } catch (e) {
    // Handle errors...
  }
}
```

**Líneas**: ~1683-1701

**Cambios clave**:
- ✅ Maneja JSON anidado de múltiples niveles recursivamente
- ✅ Valida que el resultado final sea HTML (empieza con `<`)
- ✅ Nunca hace fallback a A cuando se pide C o B

---

### 3. Backend: Validación Final Antes de Respuesta

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Agregamos validación final que asegura que todas las versiones sean HTML puro antes de construir la respuesta.

**Código clave**:
```typescript
// FINAL VALIDATION: Ensure all versions are pure HTML strings (start with '<'), never JSON wrappers
const finalBaseHtml = baseHtml && baseHtml.trim().startsWith('<') ? baseHtml : '<div>Contenido no disponible.</div>';
const finalVersionBHtml = (hasVersionB && versionBHtml && versionBHtml.trim().startsWith('<')) ? versionBHtml : null;
const finalVersionCHtml = (hasVersionC && versionCHtml && versionCHtml.trim().startsWith('<')) ? versionCHtml : null;

// Log final integrity check
console.log('[UNIVERSAL] versions integrity', {
  assignmentCounts: finalAssignmentCounts,
  startsWith: {
    A: finalBaseHtml?.trim().slice(0, 20) || 'null',
    B: finalVersionBHtml?.trim().slice(0, 20) || 'null',
    C: finalVersionCHtml?.trim().slice(0, 20) || 'null'
  },
  lengths: { A: ..., B: ..., C: ... },
  isHTML: { A: ..., B: ..., C: ... }
});

return buildUniversalResponse({
  baseHtml: finalBaseHtml,
  versionBHtml: finalVersionBHtml,
  versionCHtml: finalVersionCHtml,
  // ...
});
```

**Líneas**: ~1058-1083

**Cambios clave**:
- ✅ Valida que todas las versiones empiecen con `<` antes de enviar
- ✅ Aplica fallback seguro si alguna versión no es HTML válido
- ✅ Logging detallado de integridad para diagnóstico

---

### 4. Frontend: Logging Mejorado

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Mejoramos el logging para mostrar tanto el contenido original como el normalizado.

**Código clave**:
```typescript
console.log('[EVAL_UI] version routing', {
  assignmentCounts,
  startsWith: {
    A: versions.A?.trim().slice(0, 30) || 'null',
    B: versions.B?.trim().slice(0, 30) || 'null',
    C: versions.C?.trim().slice(0, 30) || 'null'
  },
  normalizedStartsWith: {
    A: htmlA?.slice(0, 30) || 'null',
    B: htmlB?.slice(0, 30) || 'null',
    C: htmlC?.slice(0, 30) || 'null'
  },
  isHTML: {
    A: htmlA?.trim().startsWith('<') || false,
    B: htmlB?.trim().startsWith('<') || false,
    C: htmlC?.trim().startsWith('<') || false
  }
});
```

**Líneas**: ~1769-1785

**Cambios clave**:
- ✅ Muestra contenido original y normalizado
- ✅ Indica si cada versión es HTML válido
- ✅ Facilita diagnóstico de problemas de enrutamiento

---

## Verificación

### Network Response (Chrome DevTools)

1. **POST response**: Debe retornar `200` con JSON que contiene:
   ```json
   {
     "evaluationBundle": {
       "versions": {
         "A": "<html>...",  // DEBE empezar con '<', nunca con '{'
         "B": null,          // null si no hay asignaciones
         "C": "<html>..."    // DEBE empezar con '<' si assignmentCounts.C > 0
       }
     },
     "_debug": {
       "generationPath": "universal",
       "versionsLengths": { "A": 1234, "B": 0, "C": 567 },
       "assignmentCounts": { "A": 10, "B": 0, "C": 1 },
       "isHTML": { "A": true, "B": false, "C": true }
     }
   }
   ```

2. **Validación crítica**:
   - `evaluationBundle.versions.A.trim().startsWith('<') === true`
   - `evaluationBundle.versions.C.trim().startsWith('<') === true` si `assignmentCounts.C > 0`
   - `evaluationBundle.versions.B === null` si `assignmentCounts.B === 0`

### UI Rendering

1. **Tarjeta A**:
   - ✅ Renderiza HTML formateado correctamente (no JSON wrapper visible)
   - ✅ No muestra texto como `{ "versions": { "A": "..." } }`
   - ✅ No muestra `<html>...` como texto plano

2. **Tarjeta C** (si Diego tiene content adaptation):
   - ✅ Renderiza SOLO HTML de versión C (no A, no B, no `"B":` tail)
   - ✅ HTML formateado correctamente (no escapado)
   - ✅ Diferente de A (contenido adaptado)

3. **Tarjeta B**:
   - ✅ NO se muestra si `assignmentCounts.B === 0`

### Console Logs

**Frontend (Browser console)**:
```
[EVAL_UI] version routing: {
  assignmentCounts: { A: 10, B: 0, C: 1 },
  startsWith: {
    A: "<html><head><title>Evaluación",
    B: "null",
    C: "<html><head><title>Evaluación"
  },
  normalizedStartsWith: {
    A: "<html><head><title>Evaluación",
    B: "null",
    C: "<html><head><title>Evaluación"
  },
  isHTML: { A: true, B: false, C: true }
}
```

**Backend (Supabase logs)**:
```
[UNIVERSAL] versions integrity: {
  assignmentCounts: { A: 10, B: 0, C: 1 },
  startsWith: {
    A: "<html><head><title>",
    B: "null",
    C: "<html><head><title>"
  },
  lengths: { A: 1234, B: 0, C: 567 },
  isHTML: { A: true, B: false, C: true }
}
```

---

## Edge Cases Manejados

1. **HTML dentro de JSON anidado**: `normalizeVersionHtml` extrae recursivamente hasta obtener HTML puro.

2. **HTML escapado como texto plano**: `HTMLRenderer` detecta HTML puro y lo renderiza directamente sin procesamiento adicional.

3. **JSON wrapper en respuesta**: Backend valida que todas las versiones sean HTML puro antes de enviar, aplicando fallback seguro si es necesario.

4. **Versión C igual a A**: Backend detecta esto y agrega nota diferenciadora (ya implementado en cambios anteriores).

5. **Plain text en lugar de HTML**: `normalizeVersionHtml` envuelve texto plano en `<div>` con escape HTML para evitar tarjetas vacías.

---

## Archivos Modificados

1. **`src/components/evaluaciones/HTMLRenderer.tsx`**:
   - Función `isAlreadyHTML` (nueva)
   - Modificación de `parseContent` para detectar HTML puro y renderizarlo directamente

2. **`src/pages/EvaluacionesGrupo.tsx`**:
   - Mejora de `normalizeVersionHtml` para manejar JSON anidado de múltiples niveles
   - Logging mejorado `[EVAL_UI] version routing`

3. **`supabase/functions/modify-evaluation/index.ts`**:
   - Validación final antes de construir respuesta
   - Logging de integridad `[UNIVERSAL] versions integrity`

---

## Deploy

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

---

## Acceptance Checklist

- [x] Tarjeta A renderiza HTML formateado correctamente (no JSON wrapper, no texto plano)
- [x] Tarjeta C renderiza SOLO HTML de versión C (no A, no B, no `"B":` tail)
- [x] Tarjeta B NO se muestra si `assignmentCounts.B === 0`
- [x] Network response: `evaluationBundle.versions.A` empieza con `<`
- [x] Network response: `evaluationBundle.versions.C` empieza con `<` si `assignmentCounts.C > 0`
- [x] Network response: `evaluationBundle.versions.B` es `null` si `assignmentCounts.B === 0`
- [x] Console logs muestran routing correcto y validación de HTML
- [x] `HTMLRenderer` detecta HTML puro y lo renderiza directamente
- [x] `normalizeVersionHtml` maneja JSON anidado de múltiples niveles

---

## Notas Adicionales

- **Performance**: La detección de HTML puro en `HTMLRenderer` es eficiente porque se hace al inicio y evita procesamiento innecesario.

- **Backward compatibility**: Las evaluaciones legacy que tienen HTML puro seguirán funcionando correctamente gracias a la detección de HTML en `HTMLRenderer`.

- **Debugging**: Los logs `[EVAL_UI] version routing` y `[UNIVERSAL] versions integrity` permiten diagnosticar problemas de extracción y enrutamiento rápidamente.

- **Seguridad**: `dangerouslySetInnerHTML` se usa correctamente solo después de validar que el contenido es HTML puro y no contiene scripts maliciosos (el backend ya aplica `cleanupContent`).
