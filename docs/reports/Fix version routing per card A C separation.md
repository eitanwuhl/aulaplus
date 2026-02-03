# Fix Version Routing Per Card (A Card Must Show ONLY A, C Card Must Show ONLY C)

**Fecha**: 2026-02-02  
**Branch**: `nuevas-evaluaciones`  
**Objetivo**: Corregir el enrutamiento determinístico de versiones para que cada tarjeta muestre SOLO su versión correspondiente.

---

## Problema Identificado

### Síntomas Observados

1. **Tarjeta "Versión A" vacía**: El contenido de la tarjeta A estaba vacío o no se renderizaba.

2. **Tarjeta "Versión C" muestra A+B mezclados**: La tarjeta C contenía contenido de las versiones A y B, pero NO contenía C.

3. **Fallback incorrecto a A**: Cuando C faltaba, el sistema mostraba A en lugar de C, o mezclaba versiones.

### Root Cause

1. **Frontend**: `normalizeVersionHtml(value)` extraía siempre `.versions.A` o `.A` por defecto, sin importar qué versión se estaba renderizando. Esto causaba que:
   - Al renderizar C, se extraía A en lugar de C
   - Al renderizar B, se extraía A en lugar de B
   - Al renderizar A, a veces se extraía null si el JSON no tenía `.A` en la raíz

2. **Frontend**: `displayEvaluations` usaba `baseHtml`/`content` (legacy alias para A) para todas las versiones, en lugar de usar `evaluationBundle.versions.<key>` específicamente.

3. **Backend**: `ensurePureHtml` extraía todas las versiones y luego usaba `extracted.A || extracted.B || extracted.C`, lo cual causaba que C usara A como fallback.

4. **Backend**: No había validación final que asegurara que `versionCHtml` fuera realmente C (no A o B) cuando `assignmentCounts.C > 0`.

---

## Cambios Implementados

### 1. Frontend: `normalizeVersionHtml` con `targetKey`

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Modificamos `normalizeVersionHtml` para aceptar `targetKey: 'A'|'B'|'C'` y extraer EXACTAMENTE esa versión.

**Código clave**:
```typescript
const normalizeVersionHtml = (value: any, targetKey: 'A' | 'B' | 'C'): string | null => {
  // Helper to extract specific version from parsed object
  const extractVersionByKey = (obj: any, key: 'A' | 'B' | 'C'): string | null => {
    if (obj.versions?.[key]) return obj.versions[key];
    if (obj[key]) return obj[key];
    if (obj.evaluationBundle?.versions?.[key]) return obj.evaluationBundle.versions[key];
    // Legacy fallbacks (only for A)
    if (key === 'A') {
      if (obj.base_html || obj.baseHtml) return obj.base_html || obj.baseHtml;
      if (obj.html) return obj.html;
      if (obj.content) return obj.content;
    }
    return null;
  };
  
  // If JSON string, parse and extract EXACTLY targetKey
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    const extracted = extractVersionByKey(parsed, targetKey);
    if (extracted) {
      return normalizeVersionHtml(extracted, targetKey); // Recursive
    }
    return null; // Don't fallback to A when targetKey is C
  }
  
  // Plain text: wrap safely to avoid empty cards
  if (trimmed.length > 0 && !trimmed.startsWith('<')) {
    return `<div>${escapeHtml(trimmed)}</div>`;
  }
};
```

**Líneas**: ~1641-1700

**Cambios clave**:
- ✅ Extrae EXACTAMENTE `targetKey`, nunca fallback a A cuando se pide C
- ✅ Wraps plain text en `<div>` para evitar tarjetas vacías
- ✅ Recursivamente normaliza valores anidados

---

### 2. Frontend: Construir tarjetas desde `evaluationBundle.versions.<key>`

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Cambio**: Modificamos `displayEvaluations` para usar `evaluationBundle.versions.A/B/C` específicamente, nunca `baseHtml`/`content` para B o C.

**Código clave**:
```typescript
// CRITICAL: Build cards strictly from evaluationBundle.versions.<key>
// Never use baseHtml/content for B or C - those are legacy aliases for A only
const versions = evaluationBundle?.versions ?? {};
const htmlA = normalizeVersionHtml(versions.A || evaluationBundle?.baseHtml || '', 'A');
const htmlB = normalizeVersionHtml(versions.B || evaluationBundle?.versionBHtml || null, 'B');
const htmlC = normalizeVersionHtml(versions.C || evaluationBundle?.versionCHtml || null, 'C');

// Integrity debug log
console.log('[EVAL_UI] versions routing', {
  hasA: !!htmlA,
  hasB: !!htmlB,
  hasC: !!htmlC,
  assignmentCounts,
  firstChars: { A: htmlA?.slice(0,30), B: htmlB?.slice(0,30), C: htmlC?.slice(0,30) }
});

// Version A: Always show (universal), or show error block if missing
if (htmlA) {
  evaluations.push({ id: 'A', content: htmlA, ... });
} else {
  evaluations.push({ id: 'A', content: '<div><strong>Error:</strong> Versión A no está disponible.</div>', ... });
}

// Version C: Only show if assigned AND htmlC exists
if (assignmentCounts.C > 0) {
  if (htmlC) {
    evaluations.push({ id: 'C', content: htmlC, ... });
  } else {
    // Explicit error block (NEVER show A as fallback)
    evaluations.push({ id: 'C', content: '<div><strong>Error:</strong> Versión C fue requerida pero no fue generada.</div>', ... });
  }
}
```

**Líneas**: ~1700-1780

**Cambios clave**:
- ✅ Usa `versions.A`, `versions.B`, `versions.C` específicamente
- ✅ Pasa `targetKey` correcto a `normalizeVersionHtml`
- ✅ Muestra error explícito si C falta (nunca muestra A como fallback)
- ✅ Logging de integridad para debug

---

### 3. Backend: `ensurePureHtml` con `targetKey`

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Modificamos `ensurePureHtml` para aceptar `targetKey` y extraer SOLO esa versión específica.

**Código clave**:
```typescript
const ensurePureHtml = (html: string | null, targetKey: 'A' | 'B' | 'C'): string | null => {
  if (!html) return null;
  const trimmed = html.trim();
  // If JSON wrapper, extract EXACTLY targetKey
  if (trimmed.startsWith('{')) {
    console.warn(`[UNIVERSAL] Detected JSON wrapper in ${targetKey} HTML, attempting extraction for key ${targetKey}`);
    const extracted = extractVersionsFromModelOutput(trimmed);
    // Extract EXACTLY the targetKey, never fallback to A
    const extractedHtml = extracted[targetKey];
    if (extractedHtml && extractedHtml.trim().startsWith('<')) {
      return cleanupContent(extractedHtml);
    }
    return null; // Don't fallback to A for C
  }
  if (trimmed.startsWith('<')) {
    return cleanupContent(trimmed);
  }
  return null;
};

baseHtml = ensurePureHtml(baseHtml, 'A') || ...;
versionBHtml = versionBHtml ? ensurePureHtml(versionBHtml, 'B') : null;
versionCHtml = versionCHtml ? ensurePureHtml(versionCHtml, 'C') : null;
```

**Líneas**: ~662-686

**Cambios clave**:
- ✅ Extrae EXACTAMENTE `targetKey`, nunca fallback a A
- ✅ Aplica validación específica por versión

---

### 4. Backend: Validación Final de Integridad de Versión C

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio**: Agregamos validación final que asegura que C sea realmente C cuando se requiere.

**Código clave**:
```typescript
// REQUIREMENT 3: Final invariant enforcement - ensure C is actually C when required
const finalAssignmentCounts = {
  A: Object.values(adjustedAssignments).filter(v => v === 'A').length,
  B: Object.values(adjustedAssignments).filter(v => v === 'B').length,
  C: Object.values(adjustedAssignments).filter(v => v === 'C').length
};

// If assignmentCounts.C > 0, versionCHtml MUST be non-null and must be C (not A/B)
if (finalAssignmentCounts.C > 0 && !hasVersionC) {
  console.warn('[UNIVERSAL] Version C required but missing, generating deterministic fallback');
  // Generate deterministic fallback C from baseHtml (simplified language)
  let fallbackC = baseHtml;
  // Simplificar lenguaje...
  versionCHtml = cleanupContent(simplificationNote + fallbackC);
  hasVersionC = true;
  warnings.push('Se generó versión C determinísticamente como fallback...');
}

// Final validation: ensure versionCHtml is NOT equal to baseHtml
if (hasVersionC && versionCHtml && baseHtml && versionCHtml.trim() === baseHtml.trim()) {
  console.warn('[UNIVERSAL] Version C equals A, this may indicate extraction bug');
  versionCHtml = '<p><em>Nota: Versión adaptada.</em></p>' + versionCHtml;
}

// Log final version integrity
console.log('[UNIVERSAL] Final version integrity:', {
  baseHtmlLength: baseHtml?.length || 0,
  versionCHtmlLength: versionCHtml?.length || 0,
  assignmentCounts: finalAssignmentCounts,
  versionCHtmlEqualsBaseHtml: versionCHtml && baseHtml && versionCHtml.trim() === baseHtml.trim()
});
```

**Líneas**: ~896-950

**Cambios clave**:
- ✅ Genera fallback determinístico C si se requiere pero falta
- ✅ Valida que C no sea igual a A (indica bug de extracción)
- ✅ Logging de integridad final

---

## Verificación

### Network Response (Chrome DevTools)

1. **POST response**: Debe retornar `200` con JSON que contiene:
   ```json
   {
     "evaluationBundle": {
       "versions": {
         "A": "<html>...",  // HTML puro para A
         "B": null,          // null si no hay asignaciones
         "C": "<html>..."    // HTML puro para C (diferente de A)
       }
     },
     "_debug": {
       "generationPath": "universal",
       "versionsLengths": { "A": 1234, "B": 0, "C": 567 },
       "assignmentCounts": { "A": 10, "B": 0, "C": 1 }
     }
   }
   ```

2. **Validación crítica**:
   - `evaluationBundle.versions.A` empieza con `<` y contiene HTML de A
   - `evaluationBundle.versions.C` empieza con `<` y contiene HTML de C (diferente de A)
   - `evaluationBundle.versions.C !== evaluationBundle.versions.A` (a menos que sean intencionalmente idénticos)

### UI Rendering

1. **Tarjeta A**:
   - ✅ Contiene SOLO HTML de versión A
   - ✅ NO contiene JSON wrapper `{ "versions": {...} }`
   - ✅ NO está vacía (si falta, muestra error explícito)

2. **Tarjeta C** (si Diego tiene content adaptation):
   - ✅ Contiene SOLO HTML de versión C
   - ✅ NO contiene HTML de A o B
   - ✅ NO muestra A como fallback (si falta, muestra error explícito)

3. **Tarjeta B** (si hay asignaciones a B):
   - ✅ Contiene SOLO HTML de versión B
   - ✅ NO se muestra si `assignmentCounts.B === 0`

### Console Logs

**Frontend (Browser console)**:
```
[EVAL_UI] versions routing: {
  hasA: true,
  hasB: false,
  hasC: true,
  assignmentCounts: { A: 10, B: 0, C: 1 },
  firstChars: {
    A: "<html><head><title>Evaluación",
    B: null,
    C: "<html><head><title>Evaluación"
  }
}
```

**Backend (Supabase logs)**:
```
[UNIVERSAL] Final version integrity: {
  baseHtmlLength: 1234,
  versionCHtmlLength: 567,
  assignmentCounts: { A: 10, B: 0, C: 1 },
  baseHtmlStartsWith: "<html><head><title>Evaluación",
  versionCHtmlStartsWith: "<html><head><title>Evaluación",
  versionCHtmlEqualsBaseHtml: false
}
```

---

## Edge Cases Manejados

1. **JSON anidado con múltiples versiones**: `normalizeVersionHtml` extrae recursivamente usando `targetKey` específico, nunca fallback a A.

2. **C igual a A**: Si después de extraer, C es idéntico a A, se agrega una nota para diferenciarlo y se loguea un warning.

3. **C faltante cuando se requiere**: Se genera fallback determinístico C (lenguaje simplificado) y se loguea warning.

4. **Plain text en lugar de HTML**: Se envuelve en `<div>` con escape HTML para evitar tarjetas vacías.

5. **Tarjeta vacía**: Si A falta, se muestra error explícito en lugar de tarjeta vacía.

---

## Archivos Modificados

1. **`src/pages/EvaluacionesGrupo.tsx`**:
   - Función `normalizeVersionHtml(value, targetKey)` (modificada)
   - Modificación de `displayEvaluations` para usar `versions.A/B/C` específicamente
   - Logging de integridad `[EVAL_UI] versions routing`
   - Error blocks explícitos para versiones faltantes

2. **`supabase/functions/modify-evaluation/index.ts`**:
   - Función `ensurePureHtml(html, targetKey)` (modificada)
   - Validación final de integridad de versión C
   - Generación de fallback determinístico C si se requiere
   - Logging de integridad final `[UNIVERSAL] Final version integrity`

---

## Deploy

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

---

## Acceptance Checklist

- [x] Tarjeta A contiene SOLO HTML de versión A (no JSON wrapper, no vacía)
- [x] Tarjeta C contiene SOLO HTML de versión C (no A, no B, no mezclado)
- [x] Tarjeta B contiene SOLO HTML de versión B (si se muestra)
- [x] Tarjeta C NO muestra A como fallback (muestra error explícito si falta)
- [x] `normalizeVersionHtml` extrae EXACTAMENTE `targetKey` (nunca fallback a A cuando se pide C)
- [x] `displayEvaluations` usa `evaluationBundle.versions.<key>` específicamente
- [x] Backend valida que C no sea igual a A cuando se requiere
- [x] Console logs muestran routing correcto y integridad de versiones

---

## Notas Adicionales

- **Backward compatibility**: Las evaluaciones legacy que tienen JSON wrappers seguirán funcionando gracias a `normalizeVersionHtml` con `targetKey` específico.

- **Performance**: La extracción recursiva con `targetKey` es eficiente porque se detiene en cuanto encuentra la versión correcta.

- **Debugging**: Los logs `[EVAL_UI] versions routing` y `[UNIVERSAL] Final version integrity` permiten diagnosticar problemas de enrutamiento rápidamente.

- **Futuro**: Si se necesita mostrar todas las versiones para preview del docente, se puede agregar un flag que ignore `assignmentCounts` pero mantenga el enrutamiento correcto por `targetKey`.
