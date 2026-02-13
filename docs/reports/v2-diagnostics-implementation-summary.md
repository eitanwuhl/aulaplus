# Resumen: Diagnóstico Completo para V2

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Debug Build:** `mejorar-evaluaciones-v2-diagnostics-1`

---

## Objetivo

Hacer que `modify-evaluation-v2` sea auto-diagnóstico desde la respuesta de Network. Cada request debe poder probar si el fast fallback se ejecutó, qué modelo/timeouts se usaron, y por qué falló (si falló).

---

## Cambios Implementados

### 1. DEBUG_BUILD Actualizado

**Línea ~27:**
```typescript
const DEBUG_BUILD = 'mejorar-evaluaciones-v2-diagnostics-1';
```

**Incluido en TODAS las respuestas:**
- ✅ Respuestas exitosas (línea ~2096)
- ✅ Respuestas de fallo (línea ~2139)
- ✅ Errores no manejados (línea ~2188)

---

### 2. Tipo V2Response Actualizado

**Líneas ~153-175:**
- `debug` ahora es **requerido** (no opcional)
- Agregado `debug.attempts: Array<{...}>` con estructura completa:
  ```typescript
  attempts: Array<{
    attempt: number;
    mode: "full" | "fast_fallback";
    model: string;
    timeoutMs: number;
    maxTokens: number;
    temperature: number;
    promptSizeKB: number;
    startedAtMs: number;
    openaiDurationMs?: number;
    outcome: "success" | "timeout" | "parse_error" | "validation_error" | "openai_error" | "unknown_error";
    errorMessage?: string;
  }>
  ```

---

### 3. Función `runOpenAIAttempt` Creada

**Líneas ~1223-1384:**
- Wrapper que captura **TODOS** los errores (incluyendo timeouts/AbortError)
- Retorna `AttemptResult` con outcome detallado
- Maneja parsing, validación, y errores de API de forma centralizada

**Características:**
- ✅ Captura timeouts (incluyendo AbortError)
- ✅ Captura errores de parsing JSON
- ✅ Captura errores de validación
- ✅ Captura errores de API de OpenAI
- ✅ Retorna outcome tipado para diagnóstico

---

### 4. Función `generateEvaluationV2` Modificada

**Parámetros agregados (Líneas ~1406-1408):**
```typescript
responseOptionsInclude: boolean = false,
responseOptionCount: number = 2
```

**Retorno actualizado (Líneas ~1409-1421):**
- Agregado `attempts: Array<{...}>` al retorno

**Registro de intentos (Líneas ~1581-1720):**
- Cada intento se registra en `attempts` array **antes** de la llamada a OpenAI
- Después de cada intento (éxito o fallo), se actualiza el registro con:
  - `outcome` (success/timeout/parse_error/validation_error/openai_error/unknown_error)
  - `openaiDurationMs`
  - `errorMessage` (si aplica)

**Fast Fallback garantizado:**
- Si attempt 1 falla por **CUALQUIER razón**, attempt 2 (fast fallback) **SIEMPRE** se ejecuta
- Fast fallback usa: `gpt-4o-mini`, timeout 28s, solo Versión A, prompt reducido

---

### 5. Handler Principal Modificado

**Llamada a generateEvaluationV2 (Líneas ~2007-2020):**
- Pasa `responseOptionsInclude` y `responseOptionCount`

**Construcción de respuesta exitosa (Líneas ~2095-2108):**
- Incluye `debug.build = DEBUG_BUILD`
- Incluye `debug.attempts = result.attempts || []`

**Construcción de respuesta de fallo (Líneas ~2138-2151):**
- Incluye `debug.build = DEBUG_BUILD`
- Incluye `debug.attempts = result.attempts || []` (incluso en fallo)

**Construcción de respuesta de error no manejado (Líneas ~2187-2197):**
- Incluye `debug.build = DEBUG_BUILD`
- Incluye `debug.attempts = []` (vacío porque no se registraron intentos)

---

## Verificación en DevTools Network

### Test 1: Verificar debug.build

**Pasos:**
1. Abrir Chrome DevTools → Network tab
2. Generar evaluación V2
3. Buscar llamada a `modify-evaluation-v2`
4. Verificar Response JSON:

```json
{
  "debug": {
    "build": "mejorar-evaluaciones-v2-diagnostics-1"  // ✅ DEBE estar presente
  }
}
```

**Resultado esperado:** ✅ `debug.build === "mejorar-evaluaciones-v2-diagnostics-1"` en TODAS las respuestas

---

### Test 2: Verificar debug.attempts (2 intentos cuando full falla)

**Pasos:**
1. Generar evaluación V2 con payload grande (múltiples contenidos/competencias)
2. Esperar a que attempt 1 falle por timeout
3. Verificar Response JSON:

```json
{
  "debug": {
    "build": "mejorar-evaluaciones-v2-diagnostics-1",
    "attempts": [
      {
        "attempt": 1,
        "mode": "full",
        "model": "gpt-4.1-2025-04-14",
        "timeoutMs": 55000,
        "maxTokens": 6000,
        "temperature": 0.7,
        "promptSizeKB": 45.2,
        "startedAtMs": 1234,
        "openaiDurationMs": 55000,
        "outcome": "timeout",  // ✅ DEBE ser "timeout"
        "errorMessage": "TIMEOUT after 55000ms"
      },
      {
        "attempt": 2,
        "mode": "fast_fallback",  // ✅ DEBE ser "fast_fallback"
        "model": "gpt-4o-mini",  // ✅ DEBE ser "gpt-4o-mini"
        "timeoutMs": 28000,  // ✅ DEBE ser 28-30s
        "maxTokens": 2500,
        "temperature": 0.5,
        "promptSizeKB": 12.5,
        "startedAtMs": 57834,
        "openaiDurationMs": 15000,
        "outcome": "success"  // ✅ Puede ser "success" o cualquier otro
      }
    ]
  }
}
```

**Resultado esperado:** ✅ `debug.attempts.length === 2` cuando attempt 1 falla

---

### Test 3: Verificar fast_fallback usa gpt-4o-mini + 28-30s timeout

**Pasos:**
1. Verificar `debug.attempts[1]` (segundo intento):
   - `mode === "fast_fallback"` ✅
   - `model === "gpt-4o-mini"` ✅
   - `timeoutMs >= 28000 && timeoutMs <= 30000` ✅

**Resultado esperado:** ✅ Fast fallback usa modelo más rápido y timeout más corto

---

## Archivos Modificados

1. **`supabase/functions/modify-evaluation-v2/index.ts`**
   - Constante `DEBUG_BUILD` actualizada
   - Tipo `V2Response` actualizado
   - Función `runOpenAIAttempt` creada (~160 líneas)
   - Función `generateEvaluationV2` modificada (agregado registro de attempts)
   - Handler principal modificado (agregado debug.build y debug.attempts a todas las respuestas)

**Total:** 1 archivo, ~200 líneas modificadas/agregadas

---

## Comportamiento Esperado

### Escenario: Attempt 1 falla por timeout

1. **Attempt 1 (Full):**
   - Registrado en `debug.attempts[0]`
   - `outcome: "timeout"`
   - `model: "gpt-4.1-2025-04-14"`
   - `timeoutMs: 55000`

2. **Attempt 2 (Fast Fallback):**
   - **SIEMPRE** se ejecuta
   - Registrado en `debug.attempts[1]`
   - `mode: "fast_fallback"`
   - `model: "gpt-4o-mini"`
   - `timeoutMs: 28000`
   - `outcome: "success"` (si tiene éxito) o cualquier otro

3. **Respuesta Final:**
   - `debug.build: "mejorar-evaluaciones-v2-diagnostics-1"` ✅
   - `debug.attempts.length === 2` ✅
   - `success: true` (si attempt 2 tiene éxito) o `false` (si ambos fallan)

---

## Garantías

1. ✅ `debug.build` está **SIEMPRE** presente en todas las respuestas
2. ✅ `debug.attempts` está **SIEMPRE** presente (puede estar vacío solo en errores no manejados)
3. ✅ Fast fallback **SIEMPRE** se ejecuta si attempt 1 falla
4. ✅ Cada intento se registra con información completa (modelo, timeout, outcome, error)
5. ✅ Timeouts se capturan correctamente (incluyendo AbortError)

---

**Fin del Resumen**
