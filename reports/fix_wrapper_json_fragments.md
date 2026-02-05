# Fix: Eliminación de Fragmentos JSON Wrapper en Versiones A y C

**Fecha:** 2026-02-04
**Problema:** Fragmentos JSON como `{"versions": {"A": "` y `", "B":"` aparecían dentro del contenido HTML de las versiones A y C.

---

## 1. Análisis del Problema

### Síntomas Observados

1. **Versión A:** Mostraba "ERROR: WRAPPER DETECTED (A)" con snippet `{ "versions": { "A": "`
2. **Versión C:** Contenido HTML válido pero con fragmentos JSON embebidos:
   - `{"versions": {"A":"` dentro del texto
   - `", "B":"` apareciendo en el contenido
   - Fragmentos como `Nota: Esta versión ha sido adaptada... **{"versions": {"A":"**`

### Root Causes Identificados

1. **Detección de wrappers insuficiente:**
   - La función `hasWrapperLeak()` solo verificaba si el contenido empezaba con `{` o si `"versions"` aparecía antes del primer `<`
   - No detectaba fragmentos JSON embebidos dentro del HTML como `", "A":` o `{"versions": {"A": "`

2. **Fallback JSON aceptaba contenido contaminado:**
   - El fallback JSON extraía strings que empezaban con `<` pero que contenían fragmentos JSON dentro
   - No validaba que el contenido estuviera completamente limpio

3. **Falta de limpieza de fragmentos:**
   - No existía una función que removiera fragmentos JSON embebidos antes de validar/renderizar
   - Los fragmentos pasaban a través del pipeline y aparecían en el UI

4. **Prompt con instrucciones contradictorias:**
   - Decía "NO uses <html>" pero luego "Cada versión debe empezar con <html>"
   - Esto confundía al modelo

---

## 2. Cambios Implementados

### 2.1 Backend: `supabase/functions/modify-evaluation/index.ts`

#### A) Función `hasWrapperLeak()` Mejorada

**Antes:**
```typescript
const hasWrapperLeak = (value: string | null): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  const firstLt = trimmed.indexOf('<');
  const versionsIdx = trimmed.indexOf('"versions"');
  return trimmed.startsWith('{') || (versionsIdx >= 0 && (firstLt === -1 || versionsIdx < firstLt));
};
```

**Después:**
```typescript
const hasWrapperLeak = (value: string | null): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  
  // Check if starts with JSON wrapper
  if (trimmed.startsWith('{')) return true;
  
  // Check for "versions" key anywhere (indicates JSON wrapper)
  const versionsPattern = /"versions"\s*:\s*\{/;
  if (versionsPattern.test(trimmed)) {
    const firstLt = trimmed.indexOf('<');
    const versionsIdx = trimmed.indexOf('"versions"');
    
    // If "versions" appears before first <, it's definitely a wrapper
    if (firstLt === -1 || versionsIdx < firstLt) return true;
    
    // If "versions" appears after <, check if it's inside HTML content
    const beforeHtml = trimmed.slice(0, Math.min(versionsIdx, firstLt));
    if (beforeHtml.includes('{') && beforeHtml.includes('"versions"')) {
      return true;
    }
  }
  
  // Check for JSON-like fragments: ", "A":", ", "B":", ", "C":"
  const jsonFragmentPattern = /",\s*"[ABC]"\s*:/;
  if (jsonFragmentPattern.test(trimmed)) {
    return true;
  }
  
  return false;
};
```

**Mejoras:**
- Detecta `"versions": {` en cualquier parte del contenido
- Detecta fragmentos JSON como `", "A":`, `", "B":`, `", "C":`
- Verifica contexto antes y después del HTML para detectar wrappers embebidos

#### B) Nueva Función `removeWrapperFragments()`

```typescript
const removeWrapperFragments = (html: string): string => {
  if (!html) return html;
  
  let cleaned = html;
  
  // Remove JSON wrapper patterns: {"versions": {"A": "
  cleaned = cleaned.replace(/\{\s*"versions"\s*:\s*\{\s*"[ABC]"\s*:\s*"/gi, '');
  
  // Remove JSON fragment patterns: ", "A":", ", "B":", ", "C":"
  cleaned = cleaned.replace(/",\s*"[ABC]"\s*:/gi, '');
  cleaned = cleaned.replace(/",\s*"[ABC]"\s*"\s*:/gi, '');
  
  // Remove standalone JSON braces at start/end
  cleaned = cleaned.replace(/^\s*\{\s*/, '');
  cleaned = cleaned.replace(/\s*\}\s*$/, '');
  
  // Remove "versions" key references
  cleaned = cleaned.replace(/\{\s*"versions"\s*:\s*\{/gi, '');
  
  // Remove "Nota:" that might be followed by wrapper fragments
  cleaned = cleaned.replace(/Nota:\s*[^<]*\{\s*"versions"/gi, 'Nota:');
  
  return cleaned.trim();
};
```

**Aplicación:**
- Se aplica ANTES de `cleanupContent()` y validación
- Se aplica a `finalA`, `finalB`, `finalC` antes de construir la respuesta

```typescript
let finalA = baseHtml ? removeWrapperFragments(cleanupContent(baseHtml)) : null;
let finalB = shouldHaveB && versionBHtml ? removeWrapperFragments(cleanupContent(versionBHtml)) : null;
let finalC = shouldHaveC && versionCHtml ? removeWrapperFragments(cleanupContent(versionCHtml)) : null;
```

#### C) Fallback JSON Mejorado

**Antes:**
```typescript
if (typeof jsonA === 'string' && jsonA.trim().startsWith('<')) {
  rawA = jsonA.trim();
}
```

**Después:**
```typescript
// CRITICAL: Only accept if it's a string starting with < AND doesn't contain wrapper fragments
const isCleanHtml = (str: string | null): boolean => {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed.startsWith('<')) return false;
  // Reject if it contains JSON wrapper fragments
  if (trimmed.includes('"versions"') && trimmed.includes('{')) return false;
  if (/",\s*"[ABC]"\s*:/.test(trimmed)) return false;
  return true;
};

if (isCleanHtml(jsonA)) {
  rawA = jsonA.trim();
} else if (jsonA && typeof jsonA === 'string') {
  console.warn('[DELIMITER_PARSER] Rejected jsonA: contains wrapper fragments');
}
```

**Mejoras:**
- Valida que el contenido no contenga fragmentos JSON antes de aceptarlo
- Rechaza contenido contaminado con logs de advertencia

#### D) Prompt Corregido

**Antes:**
```
2. USA SOLO fragmentos HTML (<div>, <p>, <table>, etc). PROHIBIDO usar <html>, <head>, <body>, <style>.
3. Cada versión debe ser INDEPENDIENTE - NO incluir contenido de otras versiones.
2. NO uses JSON. NO uses { ni }. La salida DEBE ser solo bloques <<<VERSION_X_HTML>>> ... <<<END_VERSION_X_HTML>>>
3. Cada versión debe empezar con <html> y ser HTML puro.  // ← CONTRADICCIÓN
```

**Después:**
```
2. USA SOLO fragmentos HTML (<div class="evaluation">, <p>, <table>, etc). 
   PROHIBIDO usar: <html>, <head>, <body>, <style>, <script>
3. Cada versión debe ser INDEPENDIENTE - NO incluir contenido de otras versiones.
4. NO uses JSON. NO uses { ni }. NO incluyas "versions": { ni ", "A": ni ", "B": ni ", "C":
5. NO incluyas notas meta como "Nota: Esta versión..." dentro del contenido.
6. Las evaluaciones deben verse como exámenes reales de secundaria.

CRÍTICO: Si generas JSON o incluyes fragmentos como {"versions": {"A": " o ", "B":, la respuesta será rechazada.
```

**Mejoras:**
- Eliminadas instrucciones contradictorias
- Prohibición explícita de fragmentos JSON
- Advertencia clara sobre rechazo de respuestas con wrappers

#### E) Logs Mejorados

```typescript
if (hasWrapperLeak(finalA)) {
  wrapperDetected = true;
  console.error('[VERSIONS_FINAL] CRITICAL: Wrapper detected in finalA, replacing with error block');
  finalA = '<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> Wrapper JSON detectado en versión A. El contenido contiene fragmentos JSON que no deberían aparecer.</div>';
}
```

---

### 2.2 Frontend: `src/pages/EvaluacionesGrupo.tsx`

#### A) Función `detectWrapper()` Mejorada

**Antes:**
```typescript
const detectWrapper = (str: string | null): boolean => {
  if (!str) return false;
  const trimmed = str.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('{')) return true;
  const versionsIdx = trimmed.indexOf('"versions"');
  const firstLt = trimmed.indexOf('<');
  return versionsIdx >= 0 && (firstLt === -1 || versionsIdx < firstLt);
};
```

**Después:**
```typescript
const detectWrapper = (str: string | null): boolean => {
  if (!str) return false;
  const trimmed = str.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('{')) return true;
  
  // Check for "versions" key anywhere
  const versionsPattern = /"versions"\s*:\s*\{/;
  if (versionsPattern.test(trimmed)) {
    const firstLt = trimmed.indexOf('<');
    const versionsIdx = trimmed.indexOf('"versions"');
    if (firstLt === -1 || versionsIdx < firstLt) return true;
  }
  
  // Check for JSON-like fragments: ", "A":", ", "B":", ", "C":"
  const jsonFragmentPattern = /",\s*"[ABC]"\s*:/;
  if (jsonFragmentPattern.test(trimmed)) {
    return true;
  }
  
  return false;
};
```

#### B) Nueva Función `removeWrapperFragments()` en Frontend

```typescript
const removeWrapperFragments = (html: string): string => {
  if (!html) return html;
  
  let cleaned = html;
  
  // Remove JSON wrapper patterns
  cleaned = cleaned.replace(/\{\s*"versions"\s*:\s*\{\s*"[ABC]"\s*:\s*"/gi, '');
  
  // Remove JSON fragment patterns
  cleaned = cleaned.replace(/",\s*"[ABC]"\s*:/gi, '');
  cleaned = cleaned.replace(/",\s*"[ABC]"\s*"\s*:/gi, '');
  
  // Remove standalone JSON braces
  cleaned = cleaned.replace(/^\s*\{\s*/, '');
  cleaned = cleaned.replace(/\s*\}\s*$/, '');
  
  // Remove "versions" key references
  cleaned = cleaned.replace(/\{\s*"versions"\s*:\s*\{/gi, '');
  
  // Remove "Nota:" that might be followed by wrapper fragments
  cleaned = cleaned.replace(/Nota:\s*[^<]*\{\s*"versions"/gi, 'Nota:');
  
  return cleaned.trim();
};
```

#### C) Flujo de Limpieza en Frontend

**Antes:**
```typescript
const htmlA = wrapperA 
  ? buildErrorBlock('A', rawA!) 
  : (isHtmlString(rawA) ? rawA.trim() : null);
```

**Después:**
```typescript
// CRITICAL: Remove wrapper fragments BEFORE checking for wrappers
const cleanedA = rawA ? removeWrapperFragments(rawA) : null;
const cleanedB = rawB ? removeWrapperFragments(rawB) : null;
const cleanedC = rawC ? removeWrapperFragments(rawC) : null;

// Re-check for wrappers after cleaning
const wrapperA_after = detectWrapper(cleanedA);
const wrapperB_after = detectWrapper(cleanedB);
const wrapperC_after = detectWrapper(cleanedC);

const htmlA = wrapperA_after 
  ? buildErrorBlock('A', cleanedA || rawA || '') 
  : (isHtmlString(cleanedA) ? cleanedA.trim() : null);
```

**Mejoras:**
- Limpia fragmentos ANTES de detectar wrappers
- Re-valida después de limpiar
- Usa contenido limpio para renderizar

---

## 3. Flujo Completo del Pipeline

### Backend

1. **Extracción de delimitadores** → `rawA`, `rawB`, `rawC`
2. **Validación** → `validateVersionHtml()` (verifica estructura básica)
3. **Sanitización** → `sanitizeHtml()` (remueve `<html>`, `<style>`, etc.)
4. **Limpieza de wrappers** → `removeWrapperFragments()` (remueve fragmentos JSON)
5. **Normalización** → `cleanupContent()` (normaliza HTML)
6. **Detección final** → `hasWrapperLeak()` (verifica si quedan wrappers)
7. **Construcción de respuesta** → Si detecta wrapper, reemplaza con error block

### Frontend

1. **Lectura de `evaluationBundle.versions.*`** → `rawA`, `rawB`, `rawC`
2. **Limpieza de wrappers** → `removeWrapperFragments()` (misma lógica que backend)
3. **Detección** → `detectWrapper()` (verifica si quedan wrappers)
4. **Renderizado:**
   - Si detecta wrapper → Error block
   - Si es HTML válido → Renderiza con `HTMLRenderer`

---

## 4. Patrones Removidos

La función `removeWrapperFragments()` remueve los siguientes patrones:

1. `{"versions": {"A": "`
2. `{"versions": {"B": "`
3. `{"versions": {"C": "`
4. `", "A":`
5. `", "B":`
6. `", "C":`
7. `", "A": "`
8. `", "B": "`
9. `", "C": "`
10. `Nota: ... {"versions"` (remueve el fragmento JSON, mantiene "Nota:")

---

## 5. Resultados Esperados

### Antes
- ❌ Versión A: "ERROR: WRAPPER DETECTED (A)" con snippet `{ "versions": { "A": "`
- ❌ Versión C: Contenido HTML con fragmentos `{"versions": {"A":"` y `", "B":"` embebidos

### Después
- ✅ Versión A: Contenido HTML limpio sin fragmentos JSON
- ✅ Versión C: Contenido HTML limpio sin fragmentos JSON
- ✅ Si se detectan wrappers después de limpiar: Error block explícito (no renderiza el wrapper)

---

## 6. Testing

### Checklist de Verificación

- [ ] Generar evaluación con al menos un estudiante asignado a C
- [ ] Verificar que Versión A muestra contenido HTML (no "WRAPPER DETECTED")
- [ ] Verificar que Versión C muestra contenido HTML diferente de A
- [ ] Verificar que NO aparecen fragmentos como:
  - `{"versions": {"A": "`
  - `", "B":`
  - `", "C":`
- [ ] Verificar logs del backend:
  - `[DELIMITER_PARSER]` - Extracción de delimitadores
  - `[VALIDATION]` - Resultados de validación
  - `[VERSIONS_FINAL]` - Versiones finales antes de respuesta
- [ ] Verificar logs del frontend:
  - `[UI_VERSIONS_RAW]` - Versiones raw recibidas
  - `[UI_ASSIGNMENT_COUNTS]` - Conteos de asignaciones

---

## 7. Archivos Modificados

1. **`supabase/functions/modify-evaluation/index.ts`**
   - Función `hasWrapperLeak()` mejorada
   - Nueva función `removeWrapperFragments()`
   - Fallback JSON mejorado con validación `isCleanHtml()`
   - Prompt corregido (sin contradicciones)
   - Logs mejorados para debugging

2. **`src/pages/EvaluacionesGrupo.tsx`**
   - Función `detectWrapper()` mejorada
   - Nueva función `removeWrapperFragments()` (misma lógica que backend)
   - Flujo de limpieza antes de renderizar

---

## 8. Notas Técnicas

### Por qué limpiar en ambos lados (Backend + Frontend)

1. **Backend:** Garantiza que la respuesta API nunca contenga wrappers
2. **Frontend:** Defensa en profundidad - limpia incluso si el backend falla

### Por qué usar regex en lugar de JSON.parse

- Los fragmentos JSON pueden estar malformados o incompletos
- `JSON.parse()` fallaría con fragmentos parciales
- Regex permite detectar y remover patrones específicos sin requerir JSON válido

### Por qué remover "Nota:" seguido de wrappers

- El modelo a veces genera: `Nota: Esta versión... **{"versions": {"A":"**`
- Removemos el fragmento JSON pero mantenemos "Nota:" si es parte del contenido legítimo

---

## 9. Próximos Pasos (Opcional)

1. **Monitoreo:** Agregar métricas de cuántas veces se detectan wrappers
2. **Alertas:** Notificar si el modelo devuelve wrappers consistentemente
3. **Mejora del prompt:** Ajustar prompt basado en patrones de fallo observados
4. **Tests automatizados:** Agregar tests unitarios para `removeWrapperFragments()` y `hasWrapperLeak()`

---

**Estado:** ✅ Implementado y listo para testing
**Fecha de implementación:** 2026-02-04
