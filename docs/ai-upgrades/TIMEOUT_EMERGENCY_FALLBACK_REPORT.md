# V2 Timeout Emergency Fallback Fix

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Tipo:** Bug Fix Crítico (Timeout Reliability)  
**Debug Build:** `mejorar-evaluaciones-timeout-emergency-fallback-1`

---

## Problema Identificado

`modify-evaluation-v2` estaba retornando `success:false` cuando **AMBOS** intentos de OpenAI fallaban por timeout:
- Attempt 1: timeout después de ~55s
- Attempt 2: timeout después de ~45s
- Total request duration ~100s confirma que ambos intentos se ejecutaron y fallaron

Esto causaba que el sistema cayera a V1, bloqueando todas las características de V2 (narrative AI report, equivalent response options, etc.).

### Síntomas

- V2 retorna `success:false` con `evaluationSpec:null`
- Sistema cae a V1 cuando OpenAI está lento/no disponible
- Características de V2 nunca se muestran
- Usuarios no pueden usar V2 cuando OpenAI tiene problemas

### Causa Raíz

**TIMEOUT RELIABILITY:** 
- Attempt 2 usaba el mismo modelo pesado (`gpt-4.1-2025-04-14`) con timeout de 45s
- No había fallback no-AI cuando ambos intentos fallaban
- El sistema no tenía forma de garantizar que V2 siempre retorne `success:true` con un spec válido

---

## Solución Implementada

### 1. Fast Fallback Realmente Rápido

**Cambios en Attempt 2:**
- **Modelo:** `gpt-4o-mini` (más rápido que `gpt-4.1-2025-04-14`)
- **Timeout:** 24s (reducido de 45s, dentro del rango 20-28s)
- **Max Tokens:** 1800 (reducido de 4000-6000)
- **Temperature:** 0.4 (más determinístico, reducido de 0.7)
- **Prompt:** Versión A solamente, sin narrative, sin B/C, sin equivalent response options

**Optimizaciones del Prompt:**
- Remueve instrucciones de Versión B/C del system prompt
- Remueve instrucciones de narrative report
- Remueve instrucciones de equivalent response options
- Reduce user prompt a solo información esencial (materia, contenidos, competencias, criterios, requerimientos)
- Limita a ~2000 caracteres si es necesario

### 2. Emergency Template (Non-AI Fallback)

**Nueva función `buildEmergencyTemplateSpec()`:**
- Se ejecuta cuando **AMBOS** intentos fallan (timeout/openai_error/parse_error/validation_error)
- **NO llama a OpenAI** - es completamente determinístico
- Retorna un `EvaluationSpecV2` mínimo pero **VÁLIDO**:
  - `version: "2.0"`
  - `meta` con subject, gradeLevel, groupName, totalStudents, duration, totalPoints, evaluationType
  - `sections`: 1 sección con 2-4 items generados determinísticamente
  - `versionVariants`: Versión A siempre presente, B/C marcadas como "no generadas" si fueron solicitadas

**Items del Emergency Template:**
- 1 `multiple_choice` con 3 opciones (5 puntos)
- 1 `essay` con guiding questions (5 puntos)
- Total: 10 puntos

**Invariante Crítico:**
- Retorna `success:true` (NUNCA `success:false`)
- `evaluationSpec` siempre es válido (no null)
- `aiReport: null` (no hay reporte de IA para template de emergencia)
- Warning `OPENAI_UNAVAILABLE_EMERGENCY_FALLBACK` con severity `error`

### 3. Debug Mejorado con Attempts Array

**Nuevo campo `debug.attempts[]`:**
Cada attempt incluye:
- `attempt`: número de intento (1, 2, o 3 para emergency)
- `mode`: `'full'` | `'fast_fallback'` | `'emergency_template'`
- `model`: modelo usado (`gpt-4.1-2025-04-14`, `gpt-4o-mini`, o `'none'` para emergency)
- `timeoutMs`: timeout usado
- `maxTokens`: max tokens configurado
- `temperature`: temperature configurado
- `promptSizeKB`: tamaño del prompt en KB
- `startedAtMs`: tiempo desde el inicio de la request
- `openaiDurationMs`: duración de la llamada a OpenAI (si aplica)
- `outcome`: `'success'` | `'timeout'` | `'openai_error'` | `'parse_error'` | `'validation_error'` | `'unknown_error'`
- `errorMessage`: mensaje de error si falló

**Incluido en todas las respuestas:**
- `debug.build = 'mejorar-evaluaciones-timeout-emergency-fallback-1'`
- `debug.attempts[]` con todos los intentos ejecutados

---

## Cambios Específicos

### Archivo: `supabase/functions/modify-evaluation-v2/index.ts`

1. **Línea ~22:** `OPENAI_TIMEOUT_RETRY_MS` cambiado de `45000` a `24000` (24s)

2. **Línea ~27:** `DEBUG_BUILD` actualizado a `'mejorar-evaluaciones-timeout-emergency-fallback-1'`

3. **Líneas ~507-600:** Agregada función `buildEmergencyTemplateSpec()`:
   - Genera spec mínimo válido sin llamar a OpenAI
   - Usa datos disponibles de `groupContext` y `designPlan`
   - Funciona incluso si algunos campos están faltando

4. **Líneas ~872-890:** Agregado array `attempts[]` y tipos `AttemptOutcome` y `AttemptMode`

5. **Líneas ~912-960:** Fast fallback mejorado:
   - Usa `gpt-4o-mini`
   - `maxTokens = 1800`
   - `temperature = 0.4`
   - Prompt agresivamente reducido (sin B/C, sin narrative, sin equivalent options)

6. **Líneas ~965-1300:** Registro de attempts:
   - Cada attempt se registra con todos sus detalles
   - Outcomes correctamente tipados
   - Error messages capturados

7. **Líneas ~1700-1780:** Emergency template integration:
   - Cuando `result.spec === null` (ambos intentos fallaron)
   - Llama a `buildEmergencyTemplateSpec()`
   - Retorna `success:true` con spec de emergencia
   - Agrega warning `OPENAI_UNAVAILABLE_EMERGENCY_FALLBACK`

8. **Línea ~158:** Tipo `V2Response.debug` actualizado para incluir `attempts[]`

---

## Invariante Garantizado

**DESPUÉS DE LA FIX:**

```typescript
// V2 SIEMPRE retorna success:true con evaluationSpec válido
// Incluso si OpenAI falla completamente → emergency template
// V2 NUNCA cae a V1 debido a timeouts de OpenAI

// CASOS GARANTIZADOS:
// ✅ Attempt 1 succeed → success:true, evaluationSpec (full)
// ✅ Attempt 1 timeout → Attempt 2 (fast fallback) → success:true, evaluationSpec (A-only)
// ✅ Both attempts fail → Emergency template → success:true, evaluationSpec (minimal but valid)
```

---

## Escenarios de Prueba

### ✅ Escenario 1: Normal Case (Attempt 1 succeeds)
**Antes:** `success:true`, `evaluationSpec` presente  
**Después:** `success:true`, `evaluationSpec` presente, `debug.attempts.length === 1`

### ✅ Escenario 2: Timeout Case (Attempt 1 fails, Attempt 2 succeeds)
**Antes:** `success:false` si attempt 2 también fallaba  
**Después:** `success:true`, `evaluationSpec` presente (A-only), `debug.attempts.length === 2`, attempt 2 usa `gpt-4o-mini` con 24s timeout

### ✅ Escenario 3: Worst Case (Both attempts fail)
**Antes:** `success:false`, `evaluationSpec: null` → cae a V1  
**Después:** `success:true`, `evaluationSpec` presente (emergency template), `debug.attempts.length === 3`, warning `OPENAI_UNAVAILABLE_EMERGENCY_FALLBACK`

---

## Verificación en DevTools Network

### Test 1: Verificar fast fallback

**Pasos:**
1. Generar evaluación V2 con payload grande (para inducir timeout en attempt 1)
2. Verificar en Network tab:

```json
{
  "success": true,
  "evaluationSpec": { ... },
  "debug": {
    "build": "mejorar-evaluaciones-timeout-emergency-fallback-1",
    "attempts": [
      {
        "attempt": 1,
        "mode": "full",
        "model": "gpt-4.1-2025-04-14",
        "timeoutMs": 55000,
        "maxTokens": 6000,
        "temperature": 0.7,
        "outcome": "timeout"
      },
      {
        "attempt": 2,
        "mode": "fast_fallback",
        "model": "gpt-4o-mini",  // ✅ VERIFICAR
        "timeoutMs": 24000,      // ✅ VERIFICAR (24s, no 45s)
        "maxTokens": 1800,       // ✅ VERIFICAR
        "temperature": 0.4,     // ✅ VERIFICAR
        "outcome": "success"     // ✅ VERIFICAR
      }
    ]
  }
}
```

**Resultado esperado:** ✅ Attempt 2 usa `gpt-4o-mini`, timeout 24s, maxTokens 1800, temperature 0.4, outcome `success`

---

### Test 2: Verificar emergency template

**Pasos:**
1. Simular fallo de OpenAI (o esperar timeout real en ambos intentos)
2. Verificar en Network tab:

```json
{
  "success": true,  // ✅ DEBE ser true (no false)
  "evaluationSpec": {  // ✅ DEBE estar presente (no null)
    "version": "2.0",
    "meta": { ... },
    "sections": [
      {
        "id": "section-emergency-1",
        "title": "Evaluación - Versión de contingencia",
        "items": [ ... ]
      }
    ]
  },
  "warnings": [
    {
      "code": "OPENAI_UNAVAILABLE_EMERGENCY_FALLBACK",  // ✅ VERIFICAR
      "severity": "error"
    }
  ],
  "debug": {
    "build": "mejorar-evaluaciones-timeout-emergency-fallback-1",
    "attempts": [
      {
        "attempt": 1,
        "mode": "full",
        "outcome": "timeout"
      },
      {
        "attempt": 2,
        "mode": "fast_fallback",
        "model": "gpt-4o-mini",
        "outcome": "timeout"  // ✅ Ambos fallaron
      },
      {
        "attempt": 3,
        "mode": "emergency_template",  // ✅ VERIFICAR
        "model": "none",
        "outcome": "success"  // ✅ VERIFICAR
      }
    ]
  }
}
```

**Resultado esperado:** ✅ `success:true`, `evaluationSpec` presente (emergency template), `debug.attempts.length === 3`, attempt 3 con `mode: 'emergency_template'`

---

## Impacto

### Antes de la Fix

- ❌ Attempt 2 usaba mismo modelo pesado con timeout largo (45s)
- ❌ Ambos intentos fallaban frecuentemente por timeout
- ❌ `success:false` cuando ambos intentos fallaban
- ❌ Sistema caía a V1, bloqueando características de V2
- ❌ No había forma de garantizar que V2 siempre funcione

### Después de la Fix

- ✅ Attempt 2 usa `gpt-4o-mini` con timeout corto (24s) y tokens reducidos (1800)
- ✅ Fast fallback tiene alta probabilidad de completar exitosamente
- ✅ Emergency template garantiza `success:true` incluso cuando OpenAI falla completamente
- ✅ V2 nunca cae a V1 debido a timeouts de OpenAI
- ✅ Debug mejorado muestra claramente qué pasó en cada attempt

---

## Notas Técnicas

1. **No se modificó V1:** Todos los cambios son exclusivos de V2
2. **Emergency template es determinístico:** No llama a OpenAI, funciona incluso si OpenAI está completamente caído
3. **Fast fallback es agresivo:** Remueve características no esenciales (B/C, narrative, equivalent options) para maximizar velocidad
4. **AbortController:** Ya está implementado en `fetchWithTimeout()` y cancela correctamente las requests
5. **Backward compatible:** El formato de respuesta se mantiene, solo se agregan campos nuevos (`debug.attempts[]`)

---

## Conclusión

El bug era un **problema de confiabilidad de timeout**: cuando OpenAI estaba lento o no disponible, V2 fallaba completamente y caía a V1.

La fix:
- Hace el fast fallback realmente rápido (gpt-4o-mini, 24s, 1800 tokens)
- Agrega un emergency template no-AI que garantiza `success:true` siempre
- Mejora el debug para mostrar claramente qué pasó en cada attempt
- Garantiza que V2 nunca caiga a V1 debido a problemas de OpenAI

**Estado:** ✅ FIXED - V2 ahora es confiable incluso cuando OpenAI está lento/no disponible

---

**Fin del Documento**
