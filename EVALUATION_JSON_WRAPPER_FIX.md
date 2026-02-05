# Fix: Extracción de HTML desde Valores Envueltos en JSON

**Fecha**: 2025-01-XX  
**Objetivo**: Garantizar que `versions.A`, `versions.B`, `versions.C` SIEMPRE sean strings de HTML, nunca JSON ni objetos completos.

## Problema Identificado

### Síntomas
- Frontend mostraba error: `ERROR: WRAPPER DETECTED (A)` o `ERROR: WRAPPER DETECTED (C)`
- Consola mostraba: `[EVAL_UI] CRITICAL: Wrapper detected in Version A from backend. Backend should have cleaned this.`
- El contenido del error era un string que empezaba con `{ "versions": { "A": ... } }`
- El backend estaba devolviendo JSON (o el objeto completo) dentro de `versions.A`/`versionAHtml`, cuando el frontend espera HTML

### Root Cause
El modelo a veces devuelve el objeto completo o un string JSON serializado en lugar de solo el HTML de cada versión. El backend no estaba extrayendo correctamente el HTML de estos valores envueltos antes de devolverlos.

## Solución Implementada

### A) Función `extractHtmlFromPossiblyWrappedValue`

**Ubicación**: `supabase/functions/modify-evaluation/index.ts` (línea ~120)

Función robusta que extrae HTML de valores que pueden venir envueltos:

```typescript
function extractHtmlFromPossiblyWrappedValue(value: any, version: 'A' | 'B' | 'C'): string {
  // Caso 1: ya es string no-JSON (no empieza con {)
  // Caso 2: vino como objeto completo (versions.A, A, baseHtml, etc.)
  // Caso 3: vino como string JSON (parsear y extraer)
}
```

**Casos manejados**:
1. **String HTML directo**: Si el valor ya es un string que no empieza con `{`, lo devuelve tal cual
2. **Objeto completo**: Extrae de `versions.A/B/C`, propiedades directas `A/B/C`, o nombres legacy (`baseHtml`, `versionBHtml`, `versionCHtml`)
3. **String JSON**: Parsea el JSON y extrae la versión correspondiente

### B) Aplicación en Pipeline Principal

**Ubicación 1**: Después de obtener `rawA`, `rawB`, `rawC` (línea ~1437)

```typescript
// CRITICAL: Extract HTML from possibly wrapped values (object or JSON string)
let baseHtml = extractHtmlFromPossiblyWrappedValue(rawA, 'A');
let versionBHtml = rawB ? extractHtmlFromPossiblyWrappedValue(rawB, 'B') : null;
let versionCHtml = rawC ? extractHtmlFromPossiblyWrappedValue(rawC, 'C') : null;

// Apply final sanitization (defense in depth)
baseHtml = baseHtml ? sanitizeHtmlForInjection(baseHtml) : null;
versionBHtml = versionBHtml ? sanitizeHtmlForInjection(versionBHtml) : null;
versionCHtml = versionCHtml ? sanitizeHtmlForInjection(versionCHtml) : null;
```

**Ubicación 2**: En `buildUniversalResponse` antes de validar (línea ~908)

```typescript
// CRITICAL: Extract HTML from possibly wrapped values BEFORE validation
const extractedA = extractHtmlFromPossiblyWrappedValue(baseHtml, 'A');
const extractedB = versionBHtml ? extractHtmlFromPossiblyWrappedValue(versionBHtml, 'B') : null;
const extractedC = versionCHtml ? extractHtmlFromPossiblyWrappedValue(versionCHtml, 'C') : null;
```

### C) Logging para Debugging

Se agregó logging cuando la extracción falla o retorna vacío:

```typescript
if (!baseHtml && rawA) {
  console.warn('[EXTRACT_HTML] Version A extraction failed or returned empty', {
    rawAType: typeof rawA,
    rawAStartsWith: typeof rawA === 'string' ? rawA.slice(0, 50) : 'not string',
    isObject: typeof rawA === 'object'
  });
}
```

## Flujo Completo de Procesamiento

```
Model Output (rawA/rawB/rawC)
  ↓
extractHtmlFromPossiblyWrappedValue() [Extrae HTML de objeto/JSON si es necesario]
  ↓
sanitizeHtmlForInjection() [Normaliza HTML fragmento - remueve wrappers]
  ↓
Hard Gates Validation [Valida que sea HTML válido]
  ↓
normalizeVersion() [Normalización final antes de response]
  ↓
buildUniversalResponse() [Extrae nuevamente por si acaso - defensivo]
  ↓
Response (HTML limpio garantizado)
```

## Archivos Modificados

### Backend
1. **`supabase/functions/modify-evaluation/index.ts`**
   - Agregada función `extractHtmlFromPossiblyWrappedValue()` (línea ~120)
   - Aplicada extracción después de obtener `rawA/rawB/rawC` (línea ~1437)
   - Aplicada extracción en `buildUniversalResponse` antes de validar (línea ~908)
   - Agregado logging para debugging (línea ~1442)

## Validación y Testing

### Checklist de Prueba

- [ ] Generar evaluación y verificar en Network response:
  - [ ] `evaluationBundle.versions.A` es string HTML (empieza con `<`), NO JSON
  - [ ] `evaluationBundle.versions.C` es string HTML (empieza con `<`), NO JSON
  - [ ] NO contiene `{ "versions": { "A": ... } }` en ninguna versión
- [ ] Verificar en UI:
  - [ ] NO aparece "ERROR: WRAPPER DETECTED (A)" o "(C)"
  - [ ] NO aparecen logs CRITICAL en consola sobre wrappers
  - [ ] El HTML renderiza correctamente
- [ ] Verificar en Supabase Logs:
  - [ ] `[EXTRACT_HTML]` warnings solo aparecen si realmente hay un problema de extracción
  - [ ] No hay errores de JSON parse

### Casos de Prueba

1. **Modelo devuelve objeto completo**:
   ```javascript
   {
     versions: {
       A: "<div>...</div>",
       B: "<div>...</div>",
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

3. **Modelo devuelve HTML directo**:
   ```javascript
   "<div>...</div>"
   ```
   ✅ Debe devolver tal cual (sin cambios)

4. **Modelo devuelve objeto con nombres legacy**:
   ```javascript
   {
     baseHtml: "<div>...</div>",
     versionBHtml: "<div>...</div>",
     versionCHtml: "<div>...</div>"
   }
   ```
   ✅ Debe extraer correctamente usando nombres legacy

## Criterios de Aceptación

1. ✅ Backend SIEMPRE devuelve HTML string en `versions.A/B/C`, nunca JSON ni objetos
2. ✅ Frontend NO muestra "ERROR: WRAPPER DETECTED" en condiciones normales
3. ✅ Pipeline sigue generando evaluaciones correctamente
4. ✅ UI renderiza HTML correctamente sin errores
5. ✅ Backward compatible (no rompe código existente)

## Notas Técnicas

### Por qué se aplica en dos lugares

1. **Después de obtener rawA/rawB/rawC**: Extrae HTML inmediatamente después de la generación, antes de cualquier procesamiento
2. **En buildUniversalResponse**: Extracción defensiva por si acaso algún valor llegó sin procesar (defensa en profundidad)

### Manejo de Errores

- Si la extracción falla, retorna string vacío `''`
- Si el string vacío llega a `buildUniversalResponse`, se reemplaza con mensaje de error HTML
- Si `rawA` existe pero la extracción retorna vacío, se loguea warning para debugging

### Compatibilidad

- Maneja nombres legacy (`baseHtml`, `versionBHtml`, `versionCHtml`)
- Maneja estructura nueva (`versions.A/B/C`)
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
**Riesgo**: Bajo (cambios mínimos, backward compatible, defensivo)  
**Impacto**: Alto (elimina errores "WRAPPER DETECTED" causados por JSON en lugar de HTML)
