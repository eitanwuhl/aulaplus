# Implementación: Diagnóstico Completo para V2

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Debug Build:** `mejorar-evaluaciones-v2-diagnostics-1`

---

## Cambios Requeridos

### 1. DEBUG_BUILD actualizado
- Cambiar de `'mejorar-evaluaciones-fast-fallback-1'` a `'mejorar-evaluaciones-v2-diagnostics-1'`

### 2. Tipo V2Response actualizado
- `debug` debe ser requerido (no opcional)
- Agregar `debug.attempts` array con estructura completa

### 3. Función `runOpenAIAttempt` creada
- Wrapper que captura TODOS los errores (incluyendo timeouts)
- Retorna `AttemptResult` con outcome detallado

### 4. Función `generateEvaluationV2` modificada
- Agregar parámetros `responseOptionsInclude` y `responseOptionCount`
- Agregar `attempts` array al retorno
- Reemplazar loop for con llamadas explícitas a `runOpenAIAttempt`
- Asegurar que fast fallback SIEMPRE se ejecute si attempt 1 falla

### 5. Handler principal modificado
- Pasar `responseOptionsInclude` y `responseOptionCount` a `generateEvaluationV2`
- Incluir `debug.build` y `debug.attempts` en TODAS las respuestas (éxito o fallo)

---

## Estado Actual

El código tiene:
- ✅ `runOpenAIAttempt` creada
- ✅ `DEBUG_BUILD` actualizado
- ✅ Tipo `V2Response` actualizado
- ⚠️ `generateEvaluationV2` todavía usa loop antiguo (necesita reemplazo)
- ⚠️ Handler principal no pasa `responseOptionsInclude`/`responseOptionCount`
- ⚠️ Handler principal no incluye `debug.attempts` en respuestas

---

## Próximos Pasos

1. Reemplazar loop en `generateEvaluationV2` con llamadas explícitas a `runOpenAIAttempt`
2. Actualizar handler principal para pasar parámetros y construir `debug.attempts`
3. Asegurar que `debug.build` y `debug.attempts` estén SIEMPRE presentes
