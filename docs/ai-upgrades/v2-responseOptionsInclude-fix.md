# V2 Fix: ReferenceError responseOptionsInclude is not defined

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Tipo:** Bug Fix Crítico (Production-Blocking)  
**Debug Build:** `mejorar-evaluaciones-fix-responseOptionsInclude-1`

---

## Problema Identificado

`modify-evaluation-v2` estaba crasheando con un `ReferenceError: responseOptionsInclude is not defined` en "Attempt 1", causando que la generación fallara completamente y no pudiera proceder al attempt 2 (fast fallback).

### Síntomas

- Error en Network: `API_ERROR: "Attempt 1: API error - responseOptionsInclude is not defined"`
- La función retornaba `success:false` con `GENERATION_FAILED`
- El sistema no podía proceder al attempt 2 (fast fallback)
- V2 completamente bloqueado

### Causa Raíz

**PROBLEMA DE SCOPE:** Las variables `responseOptionsInclude` y `responseOptionCount` estaban declaradas dentro del try block (líneas 2010-2013), pero se usaban en múltiples lugares:

1. **En `buildV2SystemPrompt`** (línea 2054-2058) - dentro del try block, pero si hay un error antes, no están definidas
2. **En `generateEvaluationV2`** (línea 2093-2094) - se pasan como parámetros, pero si hay un error antes, no están definidas
3. **En el catch block** - no estaban disponibles si había un error temprano

Si había un error al parsear el JSON o al extraer el designPlan antes de llegar a las líneas 2010-2013, estas variables no estaban definidas, causando un `ReferenceError` cuando se intentaba usarlas.

---

## Solución Implementada

### 1. Declaración Temprana con Valores por Defecto Seguros

**Antes:**
```typescript
try {
  // ... parse JSON ...
  // ... extract designPlan ...
  const responseOptions = designPlan.responseOptions || {};
  const responseOptionsInclude = responseOptions.include === true;  // ❌ Solo dentro del try
  const responseOptionCount = [2, 3].includes(responseOptions.optionCount)
    ? responseOptions.optionCount
    : 2;
  // ... usar responseOptionsInclude ...
} catch (error) {
  // ❌ responseOptionsInclude no está disponible aquí
}
```

**Después:**
```typescript
// CRITICAL: Define responseOptionsInclude and responseOptionCount early with safe defaults
// These MUST be available in all execution paths (full attempt, fast fallback, error handlers)
// If these are not defined, generateEvaluationV2 will crash with ReferenceError
let responseOptionsInclude: boolean = false;
let responseOptionCount: number = 2;

try {
  // ... parse JSON ...
  // ... extract designPlan ...
  const responseOptions = designPlan?.responseOptions ?? {};
  responseOptionsInclude = responseOptions.include === true;  // ✅ Actualizar valor
  responseOptionCount = [2, 3].includes(responseOptions.optionCount)
    ? responseOptions.optionCount
    : 2;  // ✅ Actualizar valor
  // ... usar responseOptionsInclude ...
} catch (error) {
  // ✅ responseOptionsInclude está disponible aquí con valor por defecto
}
```

**Razón:** Garantiza que las variables estén siempre definidas, incluso si hay un error temprano en el try block.

---

### 2. Uso de Nullish Coalescing Operator

**Antes:**
```typescript
const responseOptions = designPlan.responseOptions || {};
```

**Después:**
```typescript
const responseOptions = designPlan?.responseOptions ?? {};
```

**Razón:** Usa optional chaining (`?.`) y nullish coalescing (`??`) para manejar casos donde `designPlan` o `responseOptions` sean `null` o `undefined` de forma más segura.

---

### 3. Declaración de Otras Variables Críticas Fuera del Try

**Agregado:**
```typescript
// Also declare other variables that might be needed in catch block
let requestedVersions: { A: boolean; B: boolean; C: boolean } = { A: true, B: false, C: false };
let instrumentDesignRules: string[] = [];
let teacherReminders: Array<{ studentId: string; admin?: string[]; correction?: string[] }> = [];
```

**Razón:** Asegura que estas variables también estén disponibles en el catch block si hay un error temprano.

---

### 4. Actualización de Debug Build Stamp

**Antes:**
```typescript
const DEBUG_BUILD = 'mejorar-evaluaciones-v2-diagnostics-1';
```

**Después:**
```typescript
const DEBUG_BUILD = 'mejorar-evaluaciones-fix-responseOptionsInclude-1';
```

**Razón:** Permite verificar en Network tab que el fix está desplegado.

---

## Cambios Específicos

### Archivo: `supabase/functions/modify-evaluation-v2/index.ts`

1. **Línea ~27:** Actualizado `DEBUG_BUILD` a `'mejorar-evaluaciones-fix-responseOptionsInclude-1'`

2. **Líneas ~1974-1980:** Agregadas declaraciones tempranas fuera del try block:
   ```typescript
   let responseOptionsInclude: boolean = false;
   let responseOptionCount: number = 2;
   let requestedVersions: { A: boolean; B: boolean; C: boolean } = { A: true, B: false, C: false };
   let instrumentDesignRules: string[] = [];
   let teacherReminders: Array<{ studentId: string; admin?: string[]; correction?: string[] }> = [];
   ```

3. **Línea ~2009:** Cambiado `const responseOptions = designPlan.responseOptions || {};` a `const responseOptions = designPlan?.responseOptions ?? {};`

4. **Líneas ~2010-2013:** Cambiado `const responseOptionsInclude = ...` a `responseOptionsInclude = ...` (asignación en lugar de declaración)

5. **Líneas ~2002-2004:** Cambiado `const instrumentDesignRules = ...` a `instrumentDesignRules = ...` (asignación)

6. **Líneas ~2045-2049:** Cambiado `const requestedVersions = ...` a `requestedVersions = ...` (asignación)

7. **Líneas ~2054-2058:** Cambiado `const teacherReminders = ...` a `teacherReminders = ...` (asignación)

---

## Invariante Garantizado

**DESPUÉS DE LA FIX:**

```typescript
// INVARIANTE: responseOptionsInclude y responseOptionCount están SIEMPRE definidos
// antes de cualquier uso, incluso si hay errores tempranos en el try block.

// CASOS GARANTIZADOS:
// ✅ Error al parsear JSON → responseOptionsInclude = false (valor por defecto)
// ✅ Error al extraer designPlan → responseOptionsInclude = false (valor por defecto)
// ✅ designPlan.responseOptions es undefined → responseOptionsInclude = false (valor por defecto)
// ✅ designPlan.responseOptions.include es true → responseOptionsInclude = true (actualizado)
// ✅ Error en attempt 1 → responseOptionsInclude disponible para attempt 2
// ✅ Error en catch block → responseOptionsInclude disponible con valor por defecto
```

---

## Escenarios de Prueba

### ✅ Escenario 1: Error al parsear JSON
**Antes:** `ReferenceError: responseOptionsInclude is not defined`  
**Después:** `responseOptionsInclude = false` (valor por defecto), función continúa

### ✅ Escenario 2: evaluation_design_plan es undefined
**Antes:** `ReferenceError: responseOptionsInclude is not defined`  
**Después:** `responseOptionsInclude = false` (valor por defecto), función continúa

### ✅ Escenario 3: designPlan.responseOptions es undefined
**Antes:** `responseOptionsInclude = false` (correcto)  
**Después:** `responseOptionsInclude = false` (correcto, sin cambios)

### ✅ Escenario 4: Error en attempt 1, attempt 2 debe ejecutarse
**Antes:** `ReferenceError` en attempt 1 → función crashea, attempt 2 no se ejecuta  
**Después:** Error manejado → attempt 2 se ejecuta con `responseOptionsInclude` disponible

### ✅ Escenario 5: Todo funciona correctamente
**Antes:** `responseOptionsInclude` se extrae del designPlan (correcto)  
**Después:** `responseOptionsInclude` se extrae del designPlan (correcto, sin cambios)

---

## Verificación en DevTools Network

### Test 1: Verificar que el crash desapareció

**Pasos:**
1. Abrir Chrome DevTools → Network tab
2. Generar evaluación V2
3. Buscar llamada a `modify-evaluation-v2`
4. Verificar Response JSON:

```json
{
  "success": true,  // ✅ O false si ambos intentos fallaron, pero NO por ReferenceError
  "debug": {
    "build": "mejorar-evaluaciones-fix-responseOptionsInclude-1"  // ✅ VERIFICAR
  },
  "warnings": [
    // ✅ NO debe haber "responseOptionsInclude is not defined"
  ]
}
```

**Resultado esperado:** ✅ No hay `ReferenceError` en warnings, `debug.build` confirma el fix

---

### Test 2: Verificar que attempt 2 se ejecuta si attempt 1 falla

**Pasos:**
1. Generar evaluación V2 con payload grande (para inducir timeout en attempt 1)
2. Verificar en Network tab:

```json
{
  "debug": {
    "build": "mejorar-evaluaciones-fix-responseOptionsInclude-1",
    "attempts": [
      {
        "attempt": 1,
        "outcome": "timeout"  // ✅ Attempt 1 falla
      },
      {
        "attempt": 2,
        "mode": "fast_fallback",  // ✅ Attempt 2 se ejecuta
        "outcome": "success"  // ✅ O cualquier otro, pero se ejecuta
      }
    ]
  }
}
```

**Resultado esperado:** ✅ `debug.attempts.length === 2`, attempt 2 se ejecuta incluso si attempt 1 falla

---

## Impacto

### Antes de la Fix

- ❌ `ReferenceError: responseOptionsInclude is not defined` en attempt 1
- ❌ Función crashea completamente
- ❌ Attempt 2 (fast fallback) no se ejecuta
- ❌ V2 completamente bloqueado
- ❌ Sistema cae a V1

### Después de la Fix

- ✅ `responseOptionsInclude` y `responseOptionCount` siempre definidos
- ✅ Valores por defecto seguros si hay errores tempranos
- ✅ Attempt 2 se ejecuta incluso si attempt 1 falla
- ✅ V2 funciona correctamente
- ✅ Sistema usa V2 cuando es apropiado

---

## Notas Técnicas

1. **No se modificó V1:** Todos los cambios son exclusivos de V2
2. **No se cambiaron contratos de API:** La estructura de respuesta se mantiene igual
3. **No se agregaron features:** Solo se corrigió el problema de scope
4. **Valores por defecto son seguros:** `responseOptionsInclude = false` y `responseOptionCount = 2` son valores válidos
5. **Backward compatible:** Si el designPlan tiene `responseOptions.include === true`, se usa correctamente

---

## Conclusión

El bug era un **problema de scope**: `responseOptionsInclude` y `responseOptionCount` estaban declaradas dentro del try block, causando un `ReferenceError` si había un error antes de llegar a su declaración.

La fix:
- Declara las variables fuera del try block con valores por defecto seguros
- Actualiza los valores dentro del try block si el designPlan está disponible
- Garantiza que las variables estén siempre disponibles en todos los execution paths
- Permite que attempt 2 se ejecute incluso si attempt 1 falla

**Estado:** ✅ FIXED - V2 ya no crashea con ReferenceError

---

**Fin del Documento**
