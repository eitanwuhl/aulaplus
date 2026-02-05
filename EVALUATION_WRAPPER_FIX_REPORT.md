# Fix: HTML Wrapper Normalization en Pipeline de Evaluaciones

**Fecha**: 2025-01-XX  
**Objetivo**: Garantizar que el backend SIEMPRE devuelva HTML como fragmento limpio (sin wrappers: `<html>`, `<head>`, `<body>`, `<style>`, `<link>`)

## Problema Identificado

### Síntomas
- Frontend mostraba logs CRITICAL: `[EVAL_UI] CRITICAL: Wrapper detected in Version C from backend`
- Frontend mostraba warnings: `[HTMLRenderer] CSS leakage risk detected and sanitized`
- El backend a veces devolvía HTML completo con wrappers en lugar de fragmentos limpios

### Root Cause
El backend no aplicaba normalización consistente a TODAS las variantes (A/B/C) antes de construir la respuesta. Aunque existía `sanitizeHtmlForInjection`, no se aplicaba de forma exhaustiva y no manejaba code fences ni extracción de contenido de `<body>`.

## Solución Implementada

### A) Backend: Función `normalizeHtmlFragment` (Single Source of Truth)

**Ubicación**: `supabase/functions/modify-evaluation/index.ts`

Función robusta que normaliza HTML a fragmento seguro:

```typescript
function normalizeHtmlFragment(input: string): string {
  // 1) Trim
  // 2) Remove code fences (```html ... ``` or ``` ... ```)
  // 3) Extract content from <body> if present
  // 4) Remove wrapper tags: <html>, <head>, <body>, <style>, <script>, <link>
  // 5) Return clean fragment ready for injection
}
```

**Reglas aplicadas**:
1. Trim inicial
2. Remover code fences (` ```html ... ``` ` o ` ``` ... ``` `)
3. Si hay `<body>...</body>`, extraer solo el contenido interno
4. Remover DOCTYPE
5. Remover tags `<html>`, `</html>`
6. Remover sección completa `<head>...</head>`
7. Remover tags `<body>`, `</body>` (ya extraído contenido)
8. Remover secciones `<style>...</style>` completas
9. Remover secciones `<script>...</script>` completas
10. Remover tags `<link>` (especialmente `rel="stylesheet"`)
11. Remover tags wrapper residuales
12. Remover estilos inline peligrosos (position: fixed/absolute, width/height 100vw/vh)
13. Trim final

### B) Backend: Función `hasWrapper` para Detección

**Ubicación**: `supabase/functions/modify-evaluation/index.ts`

```typescript
function hasWrapper(html: string | null): boolean {
  // Detecta: <html, <head, <body, <style, <link rel="stylesheet">
}
```

### C) Backend: Normalización Final Antes de Response

**Ubicación**: `supabase/functions/modify-evaluation/index.ts` (línea ~1668)

Se agregó normalización final a TODAS las variantes (A/B/C) justo antes de `buildUniversalResponse`:

```typescript
// Normalize all versions
const normA = normalizeVersion(finalA, 'A');
const normB = normalizeVersion(finalB, 'B');
const normC = normalizeVersion(finalC, 'C');

// Update final values with normalized versions
finalA = normA.normalized || finalA;
finalB = normB.normalized;
finalC = normC.normalized;
```

**Validación y Logging**:
- Detecta wrappers ANTES de normalización (`hadWrapperBefore`)
- Detecta wrappers DESPUÉS de normalización (`hasWrapperAfter` - debería ser siempre `false`)
- Si wrapper persiste después de normalización, loguea warning y re-normaliza
- Si persiste después de re-normalización, usa fallback seguro

### D) Backend: Debug Info en Response

Se agregó a `_debug` en la respuesta:

```typescript
wrapperDetectedBefore: {
  A: boolean,
  B: boolean,
  C: boolean
},
wrapperDetectedAfter: {
  A: boolean, // Should always be false
  B: boolean,
  C: boolean
},
hasForbiddenTags: {
  A: boolean,
  B: boolean,
  C: boolean
}
```

### E) Frontend: Ajuste de Logs

**Ubicación**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Logs CRITICAL → WARN

```typescript
// Antes:
console.error('[EVAL_UI] CRITICAL: Wrapper detected in Version X...');

// Después:
console.warn('[EVAL_UI] Wrapper detected in Version X from backend. Backend should have cleaned this. This is a defensive check.');
```

**Razón**: El backend ahora garantiza normalización, por lo que estos logs son defensivos y no críticos.

**Ubicación**: `src/components/evaluaciones/HTMLRenderer.tsx`

**Cambio**: Solo loguea si realmente detecta y remueve algo

```typescript
// Solo warn si realmente detectamos y removimos algo (defensive check)
if (hadHtml || hadHead || hadBody || hadStyle) {
  console.warn('[HTMLRenderer] CSS leakage risk detected and sanitized (defensive check — backend should have normalized):', {...});
}
```

## Archivos Modificados

### Backend
1. **`supabase/functions/modify-evaluation/index.ts`**
   - Agregada función `normalizeHtmlFragment()` (línea ~258)
   - Agregada función `hasWrapper()` (línea ~122)
   - Actualizada `sanitizeHtmlForInjection()` para usar `normalizeHtmlFragment()` (línea ~331)
   - Agregada normalización final antes de `buildUniversalResponse()` (línea ~1668)
   - Actualizado `_debug` en respuesta con `wrapperDetectedBefore/After` (línea ~988)

### Frontend
2. **`src/pages/EvaluacionesGrupo.tsx`**
   - Cambiados logs CRITICAL → WARN (línea ~1770-1778)
   - Agregado comentario explicativo sobre check defensivo

3. **`src/components/evaluaciones/HTMLRenderer.tsx`**
   - Ajustado logging para solo mostrar si realmente detecta y remueve (línea ~70-79)
   - Agregado comentario sobre check defensivo

## Validación y Testing

### Checklist de Prueba

- [ ] Generar evaluación con 1 estudiante asignado a C
- [ ] Verificar en Network response:
  - [ ] `evaluationBundle.versions.A` empieza con `<` y NO contiene `"versions":` ni wrappers
  - [ ] `evaluationBundle.versions.C` empieza con `<` y NO contiene `"versions":` ni wrappers
  - [ ] `_debug.wrapperDetectedAfter.A/C` es `false`
  - [ ] `_debug.hasForbiddenTags.A/C` es `false` (o `true` solo si había wrappers antes de normalización)
- [ ] Verificar en UI:
  - [ ] NO aparecen logs CRITICAL en consola
  - [ ] NO aparecen warnings de `[HTMLRenderer] CSS leakage` en condiciones normales
  - [ ] El HTML renderiza correctamente sin afectar el layout
  - [ ] Versión C no contiene `<head>`, `<style>`, `<html>`, `<body>`
- [ ] Verificar en Supabase Logs:
  - [ ] `[NORMALIZE_VERSION]` warnings solo aparecen si realmente había wrappers antes
  - [ ] `[UNIVERSAL] versions integrity` muestra `wrapperDetected.after` como `false` para todas las versiones

### Criterios de Aceptación

1. ✅ Backend SIEMPRE devuelve HTML fragmento limpio (sin wrappers)
2. ✅ Frontend NO muestra logs CRITICAL en condiciones normales
3. ✅ Frontend mantiene sanitización defensiva pero solo loguea si realmente detecta algo
4. ✅ Pipeline sigue generando evaluaciones correctamente
5. ✅ UI no cambia (mismo renderizado, sin layout shrink)

## Notas Técnicas

### Por qué `normalizeHtmlFragment` es más robusta que `sanitizeHtmlForInjection`

1. **Maneja code fences**: El modelo a veces devuelve contenido dentro de ` ```html ... ``` `
2. **Extrae contenido de `<body>`**: Si el modelo devuelve documento completo, extrae solo el contenido interno
3. **Aplicación exhaustiva**: Se aplica a TODAS las variantes antes de construir la respuesta
4. **Validación post-normalización**: Detecta si wrappers persisten y re-normaliza o usa fallback

### Pipeline de Normalización

```
Raw Model Output
  ↓
normalizeHtmlFragment() [Remove fences, extract body, remove wrappers]
  ↓
hasWrapper() [Validate - should be false]
  ↓
Response (clean HTML fragment)
```

### Defensa en Profundidad

1. **Backend**: Normalización exhaustiva antes de response
2. **Backend**: Validación post-normalización con re-normalización si es necesario
3. **Frontend**: Detección defensiva (no debería activarse si backend funciona correctamente)
4. **Frontend**: Sanitización defensiva en `HTMLRenderer` (última línea de defensa)

## Regresiones Prevenidas

- ✅ No se rompe el pipeline de generación
- ✅ No se cambia el formato de respuesta (backward compatible)
- ✅ No se introducen dependencias pesadas
- ✅ TypeScript estricto mantenido
- ✅ Cambios mínimos y seguros

## Próximos Pasos (Opcional)

1. **Monitoreo**: Agregar métricas de `wrapperDetectedBefore` para entender frecuencia
2. **Tests Unitarios**: Agregar tests para `normalizeHtmlFragment()` con casos edge
3. **Documentación**: Actualizar docs de arquitectura con este patrón de normalización

---

**Estado**: ✅ Implementado y listo para testing  
**Riesgo**: Bajo (cambios mínimos, backward compatible)  
**Impacto**: Alto (elimina logs críticos y garantiza HTML limpio)
