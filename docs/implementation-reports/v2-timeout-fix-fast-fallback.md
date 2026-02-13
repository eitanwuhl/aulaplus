# Implementación: Fast Fallback para Timeouts en V2

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Objetivo:** Hacer que `modify-evaluation-v2` retorne `success:true` con `evaluationSpec` válido de forma confiable, incluso cuando hay timeouts

**Debug Build Stamp:** `mejorar-evaluaciones-fast-fallback-1`

---

## Cambios Exactos Realizados

### 1. Constantes Agregadas/Modificadas

**Línea ~27:**
```typescript
const DEBUG_BUILD = 'mejorar-evaluaciones-fast-fallback-1';
```

**Línea ~22:**
```typescript
const OPENAI_TIMEOUT_RETRY_MS = 28000;  // Reducido de 45s a 28s
```

---

### 2. Funciones Nuevas Agregadas

#### A) `aggregateInstrumentDesignRules(rules: string[])` (Líneas ~1025-1055)
- **Propósito:** Agregar reglas de diseño en hasta 8 bullets concisos
- **Lógica:** Deduplica reglas similares (>70% palabras comunes), trunca a 120 caracteres

#### B) `summarizeTeacherReminders(reminders)` (Líneas ~1057-1121)
- **Propósito:** Resumir recordatorios en conteos + top 6 más frecuentes
- **Formato:** "Recordatorio (X estudiantes) | Otro (Y estudiantes)"

#### C) `buildReducedUserPrompt(...)` (Líneas ~1126-1208)
- **Propósito:** Construir prompt reducido para fast fallback
- **Limitaciones:**
  - Contenidos: máximo 6 bullets
  - Competencias: máximo 6
  - Criterios de logro: máximo 6
  - Reglas de diseño: máximo 8 (agregadas)
  - Recordatorios: resumidos (conteos + top frecuentes)

---

### 3. Función Modificada: `generateEvaluationV2`

**Líneas modificadas:** ~1214-1490

**Cambios principales:**

1. **Firma actualizada** (Líneas ~1214-1232):
   - Agregados parámetros opcionales: `groupContext`, `modification`, `instrumentDesignRules`, `teacherReminders`
   - Para permitir construcción de prompt reducido en fast fallback

2. **Tipo de retorno actualizado** (Líneas ~1233-1244):
   - Agregado `actualVersions: { A: boolean; B: boolean; C: boolean }`
   - Refleja las versiones realmente usadas (puede ser A-only en fast fallback)

3. **Lógica de Fast Fallback** (Líneas ~1262-1322):
   - Detecta `isRetryAttempt` (attempt > 1)
   - Fuerza `reducedVersions = { A: true, B: false, C: false }`
   - Activa `useFastModel = true` (gpt-4o-mini)
   - Reduce system prompt (elimina instrucciones B/C)
   - Construye user prompt reducido usando `buildReducedUserPrompt()`
   - Agrega warnings: `RETRY_FAST_FALLBACK_USED` y `VERSIONS_DEFERRED`

4. **Configuración del modelo** (Líneas ~1326-1328):
   ```typescript
   const modelToUse = useFastModel ? 'gpt-4o-mini' : 'gpt-4.1-2025-04-14';
   const maxTokens = useFastModel ? 2500 : (isRetryAttempt ? 4000 : 6000);
   const temperature = useFastModel ? 0.5 : 0.7;
   ```

5. **Retorno actualizado** (Líneas ~1430-1438):
   - Incluye `actualVersions: reducedVersions` en el retorno

---

### 4. Handler Principal Modificado

**Líneas modificadas:** ~1740-1895

**Cambios principales:**

1. **Llamada a generateEvaluationV2** (Líneas ~1741-1774):
   - Pasa parámetros adicionales para fast fallback

2. **Construcción de respuesta** (Líneas ~1849-1891):
   - Usa `result.actualVersions` en lugar de `requestedVersions` original
   - Agrega `debug.build = DEBUG_BUILD`
   - Actualiza `versionsExplanation.notGenerated` para reflejar fast fallback

3. **Narrative fallback optimizado** (Líneas ~1822-1846):
   - Omite narrative fallback en fast fallback mode para evitar timeout

---

## Problema Identificado

- `modify-evaluation-v2` estaba retornando `success:false` con `evaluationSpec:null` cuando había timeouts
- Timeouts ocurrían a los 55s (primer intento) y 45s (retry)
- Esto causaba que el narrative y las opciones de respuesta equivalentes nunca aparecieran en la UI

---

## Solución Implementada

### A) Estrategia de "Fast Path" con Dos Intentos

#### Intento 1 (Full): Generación Completa
- **Modelo:** `gpt-4.1-2025-04-14`
- **Timeout:** 55s
- **Versiones:** A/B/C según se solicite
- **Max tokens:** 6000
- **Temperature:** 0.7

#### Intento 2 (Fast Fallback): Solo Versión A
- **Modelo:** `gpt-4o-mini` (más rápido)
- **Timeout:** 28s (reducido de 45s)
- **Versiones:** Forzado a `{A: true, B: false, C: false}`
- **Max tokens:** 2500 (reducido)
- **Temperature:** 0.5 (más determinístico)
- **Prompt reducido:** Agregados resúmenes en lugar de listas detalladas

---

### B) Reducción Agresiva del Prompt en Fast Fallback

#### Funciones Agregadas:

1. **`aggregateInstrumentDesignRules(rules: string[])`** (Líneas ~1025-1055)
   - Agrega hasta 8 reglas concisas
   - Deduplica reglas similares (>70% palabras comunes)
   - Trunca reglas largas (>120 caracteres)

2. **`summarizeTeacherReminders(reminders)`** (Líneas ~1057-1100)
   - Resume recordatorios en conteos + top 6 más frecuentes
   - Formato: "Recordatorio (X estudiantes) | Otro (Y estudiantes)"

3. **`buildReducedUserPrompt(...)`** (Líneas ~1102-1155)
   - Construye prompt reducido usando funciones de agregación
   - Elimina listas detalladas de estudiantes
   - Mantiene solo información esencial: grupo, materia, contenidos, competencias, criterios, requerimientos

---

### C) Cambios en el Loop de Reintentos

**Líneas modificadas:** ~1240-1320

**Cambios principales:**

1. **Detección de Fast Fallback:**
   ```typescript
   if (isRetryAttempt) {
     reducedVersions = { A: true, B: false, C: false }; // HARD FORCE
     useFastModel = true; // gpt-4o-mini
   }
   ```

2. **Reducción del System Prompt:**
   - Elimina instrucciones de Versión B/C
   - Simplifica sección de equivalent response options
   - Hace narrative opcional en fast mode

3. **Reducción del User Prompt:**
   - Usa `buildReducedUserPrompt()` con datos agregados
   - Elimina listas detalladas de estudiantes
   - Mantiene solo información esencial

4. **Configuración del Modelo:**
   ```typescript
   const modelToUse = useFastModel ? 'gpt-4o-mini' : 'gpt-4.1-2025-04-14';
   const maxTokens = useFastModel ? 2500 : (isRetryAttempt ? 4000 : 6000);
   const temperature = useFastModel ? 0.5 : 0.7;
   ```

---

### D) Asegurar Retorno de Spec Válido

**Lógica implementada:**

1. **Si el segundo intento tiene éxito:**
   - Retorna `success:true` con `evaluationSpec` (solo Versión A)
   - Agrega warnings:
     - `RETRY_FAST_FALLBACK_USED`
     - `VERSIONS_DEFERRED` (si B/C fueron solicitadas)

2. **Narrative Fallback Optimizado:**
   - En fast fallback mode, **NO se genera narrative fallback** para evitar timeout
   - Se continúa sin narrative (legacy fields se mostrarán)

3. **Solo retorna `success:false` si:**
   - Ambos intentos fallan completamente
   - No se puede generar ningún spec válido

---

### E) Debug Build Stamp

**Línea agregada:** ~27
```typescript
const DEBUG_BUILD = 'mejorar-evaluaciones-fast-fallback-1';
```

**Agregado a todas las respuestas:**
- `debug.build = DEBUG_BUILD` en respuestas exitosas (línea ~1878)
- `debug.build = DEBUG_BUILD` en respuestas de fallo (línea ~1910, ~1925)

**Verificación:** En Network tab, buscar `data.debug.build === "mejorar-evaluaciones-fast-fallback-1"`

---

### F) Timeouts Ajustados

**Líneas modificadas:** ~21-24

**Antes:**
```typescript
const OPENAI_TIMEOUT_RETRY_MS = 45000;  // 45s
```

**Después:**
```typescript
const OPENAI_TIMEOUT_RETRY_MS = 28000;  // 28s (fast fallback)
```

**Razón:** El segundo intento debe completarse más rápido para evitar timeout total. 28s es suficiente para `gpt-4o-mini` con prompt reducido.

---

## Archivos Modificados

1. **`supabase/functions/modify-evaluation-v2/index.ts`**
   - Agregadas funciones de agregación de prompt (3 nuevas funciones)
   - Modificado loop de reintentos para fast fallback
   - Agregado debug.build stamp
   - Ajustados timeouts
   - Optimizado narrative fallback para fast mode

**Total:** 1 archivo, ~200 líneas modificadas/agregadas

---

## Comportamiento Resultante

### Antes:
- ❌ Timeout a los 55s → `success:false`, `evaluationSpec:null`
- ❌ Retry a los 45s → `success:false`, `evaluationSpec:null`
- ❌ Narrative y opciones equivalentes nunca aparecían

### Después:
- ✅ Timeout a los 55s → Retry automático con fast fallback
- ✅ Fast fallback (28s, gpt-4o-mini) → `success:true`, `evaluationSpec` (solo Versión A)
- ✅ Warnings claros indican que B/C fueron diferidas
- ✅ Narrative y opciones equivalentes aparecen (si se generan en fast mode)

---

## Warnings Agregados

1. **`RETRY_FAST_FALLBACK_USED`** (severity: warning)
   - Indica que se usó fast fallback mode
   - Versión A generada exitosamente

2. **`VERSIONS_DEFERRED`** (severity: info)
   - Indica que Versiones B/C no se generaron debido a timeout
   - Se pueden regenerar después si se necesita

---

## Testing en Localhost

### Test Principal: Inducir Timeout y Verificar Fast Fallback

**Objetivo:** Confirmar que cuando el primer intento falla por timeout, el fast fallback retorna `success:true` con `evaluationSpec` válido.

**Pasos:**
1. Abrir Chrome DevTools → Network tab
2. Navegar a `/evaluaciones/nuevo`
3. Seleccionar grupo "9no1"
4. Seleccionar materia "Historia"
5. Seleccionar **múltiples contenidos** (6+) para aumentar payload
6. Seleccionar **múltiples competencias** (6+) para aumentar payload
7. Activar "Incluir opciones de respuesta equivalentes"
8. Activar Versión B (si está disponible) para aumentar complejidad
9. Activar "Usar V2" (toggle `useBetaV2`)
10. Hacer click en "Generar Evaluación"
11. Esperar a que se genere (puede tomar ~55s+ si hay timeout)

**Verificación en Network Tab:**

1. **Buscar llamada a `modify-evaluation-v2`**
2. **Verificar Request:**
   - Payload contiene `evaluation_design_plan` con múltiples contenidos/competencias
   - `triggers.versionB === true` (si se activó)

3. **Verificar Response:**
   ```json
   {
     "success": true,  // ✅ DEBE ser true (no false)
     "evaluationSpec": { ... },  // ✅ DEBE ser non-null
     "requestedVersions": {
       "A": true,
       "B": false,  // ✅ false si fast fallback se activó
       "C": false
     },
     "warnings": [
       {
         "code": "RETRY_FAST_FALLBACK_USED",
         "severity": "warning"
       },
       {
         "code": "VERSIONS_DEFERRED",
         "severity": "info"
       }
     ],
     "debug": {
       "build": "mejorar-evaluaciones-fast-fallback-1",  // ✅ DEBE estar presente
       "model": "gpt-4o-mini (fast fallback)",  // ✅ Si fast fallback se usó
       "attempt": 2,  // ✅ 2 si fast fallback se activó
       "retryReason": "timeout"
     }
   }
   ```

4. **Verificar que evaluationSpec es válido:**
   - `evaluationSpec.sections` es array no vacío
   - `evaluationSpec.sections[].items` tiene items válidos
   - `evaluationSpec.versionVariants` solo tiene `A` (no B/C)

5. **Verificar equivalentResponseOptions (si responseOptions.include === true):**
   - Items elegibles (`essay`, `paragraph`, etc.) tienen `equivalentResponseOptions`
   - Cada uno tiene exactamente 3 opciones

6. **Verificar aiReport.narrative:**
   - Puede estar presente (si el modelo lo genera en fast mode)
   - Si falta, `aiReport` tiene campos legacy (no bloquea)

**Resultado esperado:** ✅ `success:true` con `evaluationSpec` válido, incluso después de timeout

---

### Test 1: Verificar Fast Fallback se Activa

**Pasos:**
1. Generar evaluación V2 para grupo "9no1" con Versiones B/C solicitadas
2. Simular timeout en primer intento (o esperar timeout real)
3. Verificar en Network tab:
   - `data.success === true`
   - `data.evaluationSpec !== null`
   - `data.debug.build === "mejorar-evaluaciones-timeout-fix-1"`
   - `data.debug.model === "gpt-4o-mini (fast fallback)"` o contiene "gpt-4o-mini"
   - `data.warnings` contiene `RETRY_FAST_FALLBACK_USED` y `VERSIONS_DEFERRED`

**Resultado esperado:** ✅ Fast fallback se activa y retorna spec válido

---

### Test 2: Verificar Versión A se Genera en Fast Fallback (Alternativa)

**Pasos:**
1. Generar evaluación V2 que active fast fallback
2. Verificar en Network tab:
   - `data.evaluationSpec.versionVariants` solo tiene `A`
   - `data.evaluationSpec.sections[].items[]` NO tienen `versionedContent`
   - `data.requestedVersions.B === false` y `data.requestedVersions.C === false` (en fast fallback)

**Resultado esperado:** ✅ Solo Versión A se genera en fast fallback

---

### Test 3: Verificar Narrative en Fast Fallback

**Pasos:**
1. Generar evaluación V2 que active fast fallback
2. Verificar en Network tab:
   - `data.aiReport.narrative` puede estar presente (si el modelo lo genera)
   - Si falta, `data.aiReport` tiene campos legacy (designRationale, etc.)

**Resultado esperado:** ✅ Narrative puede estar presente o ausente (no bloquea)

---

### Test 4: Verificar Equivalent Response Options en Fast Fallback

**Pasos:**
1. Generar evaluación V2 con `responseOptions.include === true` que active fast fallback
2. Verificar en Network tab:
   - `data.evaluationSpec.sections[].items[].equivalentResponseOptions` existe para items elegibles
   - Tiene exactamente 3 opciones

**Resultado esperado:** ✅ Opciones equivalentes se generan en fast fallback

---

### Test 5: Verificar Debug Build Stamp

**Pasos:**
1. Generar cualquier evaluación V2
2. Verificar en Network tab:
   - `data.debug.build === "mejorar-evaluaciones-timeout-fix-1"`

**Resultado esperado:** ✅ Debug build stamp está presente

---

## Verificación en Network Tab

### Request Payload:
```json
{
  "groupContext": { ... },
  "evaluation_design_plan": {
    "triggers": { "versionB": true, "versionC": false },
    "responseOptions": { "include": true, "optionCount": 3 }
  }
}
```

### Response (Fast Fallback):
```json
{
  "success": true,
  "evaluationSpec": {
    "version": "2.0",
    "sections": [ ... ],
    "versionVariants": {
      "A": { "label": "Versión A (Universal)", "isBase": true }
    }
  },
  "warnings": [
    {
      "code": "RETRY_FAST_FALLBACK_USED",
      "message": "Using fast fallback mode...",
      "severity": "warning"
    },
    {
      "code": "VERSIONS_DEFERRED",
      "message": "Versions B/C not generated due to timeout...",
      "severity": "info"
    }
  ],
  "debug": {
    "build": "mejorar-evaluaciones-timeout-fix-1",
    "model": "gpt-4o-mini (fast fallback)",
    "attempt": 2,
    "retryReason": "timeout"
  }
}
```

---

## Notas Adicionales

- **V1 no modificado:** Solo cambios en V2
- **Backward compatibility:** Evaluaciones existentes siguen funcionando
- **Narrative opcional en fast mode:** No bloquea el retorno si falta
- **Versiones B/C diferidas:** Se pueden regenerar después si se necesita

---

## Próximos Pasos Recomendados

1. **Monitorear en producción:**
   - Verificar frecuencia de fast fallback activado
   - Verificar que `success:true` rate aumenta
   - Verificar que timeouts disminuyen

2. **Optimizaciones futuras (opcional):**
   - Reducir aún más el prompt en fast fallback si es necesario
   - Considerar cachear narrative fallback si se usa frecuentemente
   - Ajustar timeouts según métricas de producción

---

**Fin del Reporte**
