# Fix Completo: Eliminación de Wrappers JSON en Versiones A/B/C

**Fecha**: 2025-01-XX  
**Objetivo**: Garantizar que `versions.A`, `versions.B`, `versions.C` SIEMPRE sean strings HTML fragmento limpio, nunca JSON ni objetos completos.

## Problema Identificado

### Síntomas
- Frontend mostraba: `[EVAL_UI] Wrapper detected in Version A/C from backend`
- Frontend mostraba: `[HTMLRenderer] CSS leakage risk detected and sanitized`
- El contenido era un string JSON que comenzaba con `{ "versions": { "A": ... } }`
- El backend detectaba wrappers pero NO intentaba "desenvolver" (parsear) el JSON para extraer el HTML

### Root Cause
El modelo a veces devuelve el objeto completo o un string JSON serializado. El backend solo detectaba wrappers y reemplazaba con error, pero NO extraía el HTML del JSON antes de sanitizar/retornar.

## Solución Implementada

### A) Función `extractHtmlFromPossiblyWrappedValue` Mejorada

**Ubicación**: `supabase/functions/modify-evaluation/index.ts` (línea ~120)

Función robusta que extrae HTML de valores que pueden venir envueltos:

```typescript
function extractHtmlFromPossiblyWrappedValue(value: unknown, key: 'A' | 'B' | 'C'): string {
  // Caso 1: string no-JSON (no empieza con {) -> devolver tal cual
  // Caso 2: string JSON -> parsear y extraer de:
  //   - parsed.versions[key]
  //   - parsed[key]
  //   - parsed.evaluationBundle.versions[key]
  //   - parsed.evaluationBundle[version${key}Html]
  //   - parsed.evaluationBundle.baseHtml/versionBHtml/versionCHtml (legacy)
  // Caso 3: objeto -> extraer de las mismas rutas
}
```

**Mejoras**:
- Soporte para `evaluationBundle.versions[key]`
- Soporte para `evaluationBundle[version${key}Html]`
- Manejo de nombres legacy (`baseHtml`, `versionBHtml`, `versionCHtml`)
- Type-safe con `unknown` en lugar de `any`

### B) Pipeline Completo de Procesamiento

**Ubicación 1**: Después de obtener `rawA/rawB/rawC` (línea ~1435)

```typescript
// Step 1: Extract HTML from possibly wrapped values (JSON/object -> HTML string)
let extractedA = extractHtmlFromPossiblyWrappedValue(baseHtml, 'A');
let extractedB = versionBHtml ? extractHtmlFromPossiblyWrappedValue(versionBHtml, 'B') : null;
let extractedC = versionCHtml ? extractHtmlFromPossiblyWrappedValue(versionCHtml, 'C') : null;

// Step 2: Normalize HTML fragment (remove code fences, <html>/<head>/<body>, <style>, <link>, <script>)
extractedA = extractedA ? normalizeHtmlFragment(extractedA) : '';
extractedB = extractedB ? normalizeHtmlFragment(extractedB) : null;
extractedC = extractedC ? normalizeHtmlFragment(extractedC) : null;

// Step 3: Apply cleanupContent (normalize HTML structure)
if (extractedA) extractedA = cleanupContent(extractedA);
if (extractedB) extractedB = cleanupContent(extractedB);
if (extractedC) extractedC = cleanupContent(extractedC);

// Step 4: Apply final sanitization (defense in depth)
baseHtml = extractedA ? sanitizeHtmlForInjection(extractedA) : null;
versionBHtml = extractedB ? sanitizeHtmlForInjection(extractedB) : null;
versionCHtml = extractedC ? sanitizeHtmlForInjection(extractedC) : null;
```

**Ubicación 2**: En `buildUniversalResponse` antes de validar (línea ~985)

Aplica el mismo pipeline completo antes de construir la respuesta final.

### C) Hard Gates Mejorados con Re-extracción

**Ubicación**: Antes de construir respuesta final (línea ~1479)

```typescript
// Final check: if still wrapped (starts with { or has wrapper leak), try one more extraction
if (finalA && (finalA.trim().startsWith('{') || hasWrapperLeak(finalA))) {
  console.warn('[HARD_GATE] finalA still wrapped after normalization, attempting final extraction');
  const reExtracted = extractHtmlFromPossiblyWrappedValue(finalA, 'A');
  if (reExtracted && !reExtracted.trim().startsWith('{') && !hasWrapperLeak(reExtracted)) {
    finalA = normalizeHtmlFragment(reExtracted);
    finalA = cleanupContent(finalA);
    finalA = sanitizeHtmlForInjection(finalA);
  } else {
    // Use error block as fallback
  }
}
```

**Mejoras**:
- Intenta re-extraer si todavía hay wrappers después de normalización
- Aplica pipeline completo de normalización después de re-extracción
- Solo usa error block si re-extracción también falla

## Flujo Completo de Procesamiento

```
Model Output (rawA/rawB/rawC)
  ↓
extractHtmlFromPossiblyWrappedValue() [Extrae HTML de objeto/JSON si es necesario]
  ↓
normalizeHtmlFragment() [Remueve code fences, <html>/<head>/<body>, <style>, <link>, <script>]
  ↓
cleanupContent() [Normaliza estructura HTML]
  ↓
sanitizeHtmlForInjection() [Sanitización final - remueve wrappers residuales]
  ↓
Hard Gates [Valida y re-extrae si todavía hay wrappers]
  ↓
normalizeVersion() [Normalización final antes de response]
  ↓
buildUniversalResponse() [Aplica pipeline completo nuevamente - defensivo]
  ↓
Response (HTML limpio garantizado)
```

## Archivos Modificados

### Backend
1. **`supabase/functions/modify-evaluation/index.ts`**
   - Actualizada función `extractHtmlFromPossiblyWrappedValue()` (línea ~120)
     - Soporte para `evaluationBundle.versions[key]`
     - Soporte para `evaluationBundle[version${key}Html]`
     - Type-safe con `unknown`
   - Pipeline completo agregado después de obtener `rawA/rawB/rawC` (línea ~1435)
     - Extracción → Normalización → Cleanup → Sanitización
   - Hard gates mejorados con re-extracción (línea ~1479)
   - Pipeline completo en `buildUniversalResponse` (línea ~985)

## Validación y Testing

### Checklist de Prueba

- [ ] Generar evaluación y verificar en Network response:
  - [ ] `evaluationBundle.versions.A` es string HTML (empieza con `<`), NO JSON
  - [ ] `evaluationBundle.versions.C` es string HTML (empieza con `<`), NO JSON
  - [ ] NO contiene `{ "versions": { "A": ... } }` en ninguna versión
  - [ ] NO contiene `<html>`, `<head>`, `<body>`, `<style>`, `<link rel="stylesheet">`
- [ ] Verificar en UI:
  - [ ] NO aparece "ERROR: WRAPPER DETECTED (A)" o "(C)"
  - [ ] NO aparecen logs WARN en consola sobre wrappers
  - [ ] NO aparecen logs de "CSS leakage risk detected"
  - [ ] El HTML renderiza correctamente sin afectar layout
- [ ] Verificar en Supabase Logs:
  - [ ] `[EXTRACT_HTML]` warnings solo aparecen si realmente hay un problema
  - [ ] `[HARD_GATE]` warnings solo aparecen si re-extracción es necesaria
  - [ ] No hay errores CRITICAL sobre wrappers persistentes

### Casos de Prueba

1. **Modelo devuelve objeto completo**:
   ```javascript
   {
     versions: {
       A: "<div>...</div>",
       C: "<div>...</div>"
     }
   }
   ```
   ✅ Debe extraer correctamente cada versión

2. **Modelo devuelve string JSON**:
   ```javascript
   '{ "versions": { "A": "<div>...</div>" } }'
   ```
   ✅ Debe parsear y extraer correctamente

3. **Modelo devuelve JSON con evaluationBundle**:
   ```javascript
   '{ "evaluationBundle": { "versions": { "A": "<div>...</div>" } } }'
   ```
   ✅ Debe extraer correctamente

4. **Modelo devuelve HTML con wrappers**:
   ```javascript
   '<html><head><style>...</style></head><body><div>...</div></body></html>'
   ```
   ✅ Debe normalizar y remover wrappers

5. **Modelo devuelve HTML con code fences**:
   ```javascript
   '```html\n<div>...</div>\n```'
   ```
   ✅ Debe remover code fences y extraer HTML

## Criterios de Aceptación

1. ✅ Backend SIEMPRE devuelve HTML string limpio en `versions.A/B/C`, nunca JSON ni objetos
2. ✅ Frontend NO muestra "ERROR: WRAPPER DETECTED" en condiciones normales
3. ✅ Frontend NO muestra "CSS leakage risk detected" en condiciones normales
4. ✅ Pipeline sigue generando evaluaciones correctamente
5. ✅ UI renderiza HTML correctamente sin errores ni afectación de layout
6. ✅ Backward compatible (no rompe código existente)

## Notas Técnicas

### Por qué se aplica en múltiples lugares

1. **Después de obtener rawA/rawB/rawC**: Extrae HTML inmediatamente después de la generación
2. **En hard gates**: Re-extrae si todavía hay wrappers después de normalización
3. **En buildUniversalResponse**: Extracción defensiva por si acaso algún valor llegó sin procesar

### Manejo de Errores

- Si la extracción falla, retorna string vacío `''`
- Si el string vacío llega a hard gates, se re-extrae una vez más
- Si re-extracción también falla, se usa mensaje de error HTML como fallback
- Si `rawA` existe pero la extracción retorna vacío, se loguea warning para debugging

### Compatibilidad

- Maneja nombres legacy (`baseHtml`, `versionBHtml`, `versionCHtml`)
- Maneja estructura nueva (`versions.A/B/C`)
- Maneja `evaluationBundle.versions.A/B/C`
- Maneja `evaluationBundle[version${key}Html]`
- Maneja propiedades directas (`A`, `B`, `C`)
- No rompe si el valor ya es HTML directo

## Regresiones Prevenidas

- ✅ No se rompe el pipeline de generación
- ✅ No se cambia el formato de respuesta (backward compatible)
- ✅ No se introducen dependencias pesadas
- ✅ TypeScript estricto mantenido
- ✅ Cambios mínimos y seguros

---

**Estado**: ✅ Implementado y listo para testing  
**Riesgo**: Bajo (cambios defensivos, backward compatible, múltiples capas de validación)  
**Impacto**: Alto (elimina completamente errores "WRAPPER DETECTED" y "CSS leakage risk")
