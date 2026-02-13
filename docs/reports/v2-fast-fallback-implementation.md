# Resumen de Implementación: Fast Fallback para V2 Timeouts

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Debug Build:** `mejorar-evaluaciones-fast-fallback-1`

---

## Objetivo

Hacer que `modify-evaluation-v2` retorne `success:true` con `evaluationSpec` válido incluso cuando el primer intento falla por timeout, usando un fast fallback que genera solo Versión A.

---

## Cambios Exactos

### Archivo: `supabase/functions/modify-evaluation-v2/index.ts`

#### 1. Constantes Modificadas

**Línea ~22:**
```typescript
const OPENAI_TIMEOUT_RETRY_MS = 28000;  // Reducido de 45s a 28s
```

**Línea ~27 (NUEVA):**
```typescript
const DEBUG_BUILD = 'mejorar-evaluaciones-fast-fallback-1';
```

---

#### 2. Funciones Nuevas Agregadas

**A) `aggregateInstrumentDesignRules(rules: string[])`** (Líneas ~1025-1055)
- Agrega hasta 8 reglas concisas
- Deduplica reglas similares (>70% palabras comunes)
- Trunca reglas largas (>120 caracteres)

**B) `summarizeTeacherReminders(reminders)`** (Líneas ~1057-1121)
- Resume recordatorios en conteos + top 6 más frecuentes
- Formato: "Recordatorio (X estudiantes) | Otro (Y estudiantes)"

**C) `buildReducedUserPrompt(...)`** (Líneas ~1126-1208)
- Construye prompt reducido para fast fallback
- **Limitaciones:**
  - Contenidos: máximo 6 bullets
  - Competencias: máximo 6
  - Criterios de logro: máximo 6
  - Reglas de diseño: máximo 8 (agregadas)
  - Recordatorios: resumidos (conteos + top frecuentes)

---

#### 3. Función Modificada: `generateEvaluationV2`

**Firma actualizada** (Líneas ~1214-1232):
- Agregados parámetros opcionales: `groupContext`, `modification`, `instrumentDesignRules`, `teacherReminders`

**Tipo de retorno actualizado** (Líneas ~1233-1244):
- Agregado `actualVersions: { A: boolean; B: boolean; C: boolean }`

**Lógica de Fast Fallback** (Líneas ~1262-1322):
```typescript
if (isRetryAttempt) {
  reducedVersions = { A: true, B: false, C: false }; // HARD FORCE
  useFastModel = true; // gpt-4o-mini
  // Reduce prompts, build reduced user prompt
}
```

**Configuración del modelo** (Líneas ~1326-1328):
```typescript
const modelToUse = useFastModel ? 'gpt-4o-mini' : 'gpt-4.1-2025-04-14';
const maxTokens = useFastModel ? 2500 : (isRetryAttempt ? 4000 : 6000);
const temperature = useFastModel ? 0.5 : 0.7;
```

**Retorno actualizado** (Líneas ~1430-1438):
- Incluye `actualVersions: reducedVersions`

---

#### 4. Handler Principal Modificado

**Llamada actualizada** (Líneas ~1741-1774):
- Pasa parámetros adicionales a `generateEvaluationV2`

**Construcción de respuesta** (Líneas ~1849-1891):
- Usa `result.actualVersions` en lugar de `requestedVersions` original
- Agrega `debug.build = DEBUG_BUILD`
- Actualiza `versionsExplanation.notGenerated` para reflejar fast fallback

**Narrative fallback optimizado** (Líneas ~1822-1846):
- Omite narrative fallback en fast fallback mode

---

## Resumen de Funciones Clave

| Función | Tipo | Líneas | Propósito |
|---------|------|--------|-----------|
| `aggregateInstrumentDesignRules` | Nueva | ~1025-1055 | Agregar reglas en 8 bullets |
| `summarizeTeacherReminders` | Nueva | ~1057-1121 | Resumir recordatorios |
| `buildReducedUserPrompt` | Nueva | ~1126-1208 | Construir prompt reducido |
| `generateEvaluationV2` | Modificada | ~1214-1490 | Agregar fast fallback logic |
| Handler principal | Modificado | ~1740-1895 | Usar actualVersions, agregar debug.build |

---

## Cómo Testear en Localhost

### Test: Inducir Timeout y Verificar Fast Fallback

**Pasos:**
1. Abrir Chrome DevTools → Network tab
2. Navegar a `/evaluaciones/nuevo`
3. Seleccionar grupo "9no1"
4. Seleccionar materia "Historia"
5. Seleccionar **múltiples contenidos** (6+) para aumentar payload
6. Seleccionar **múltiples competencias** (6+) para aumentar payload
7. Activar "Incluir opciones de respuesta equivalentes"
8. Activar Versión B (si está disponible)
9. Activar "Usar V2"
10. Hacer click en "Generar Evaluación"
11. Esperar respuesta (puede tomar ~55s+ si hay timeout)

**Verificación en Network Tab:**

1. **Buscar llamada a `modify-evaluation-v2`**
2. **Verificar Response JSON:**
   ```json
   {
     "success": true,  // ✅ DEBE ser true
     "evaluationSpec": { ... },  // ✅ DEBE ser non-null
     "requestedVersions": {
       "A": true,
       "B": false,  // ✅ false si fast fallback
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
       "build": "mejorar-evaluaciones-fast-fallback-1",  // ✅ VERIFICAR
       "model": "gpt-4o-mini (fast fallback)",  // ✅ Si fast fallback
       "attempt": 2,  // ✅ 2 si fast fallback
       "retryReason": "timeout"
     }
   }
   ```

3. **Verificar evaluationSpec:**
   - `evaluationSpec.sections` es array no vacío
   - `evaluationSpec.versionVariants` solo tiene `A`

4. **Verificar equivalentResponseOptions (si responseOptions.include === true):**
   - Items elegibles tienen `equivalentResponseOptions` con 3 opciones

5. **Verificar aiReport.narrative:**
   - Puede estar presente o ausente (no bloquea)

**Resultado esperado:** ✅ `success:true` con `evaluationSpec` válido, incluso después de timeout

---

## Verificación del Debug Build Stamp

En Network tab, verificar:
```javascript
data.debug.build === "mejorar-evaluaciones-fast-fallback-1"
```

Si este valor está presente, confirma que el código desplegado incluye el fast fallback.

---

## Comportamiento Esperado

### Escenario: Timeout en Primer Intento

1. **Intento 1 (Full):**
   - Modelo: `gpt-4.1-2025-04-14`
   - Timeout: 55s
   - Versiones: A/B/C según solicitud
   - **Resultado:** Timeout después de 55s

2. **Intento 2 (Fast Fallback):**
   - Modelo: `gpt-4o-mini`
   - Timeout: 28s
   - Versiones: Solo A (forzado)
   - Prompt: Reducido (contenidos/competencias limitados, reglas agregadas)
   - **Resultado:** `success:true` con `evaluationSpec` (solo Versión A)

3. **Respuesta Final:**
   - `success: true`
   - `evaluationSpec: { ... }` (non-null)
   - `requestedVersions: { A: true, B: false, C: false }`
   - `warnings: [RETRY_FAST_FALLBACK_USED, VERSIONS_DEFERRED]`
   - `debug.build: "mejorar-evaluaciones-fast-fallback-1"`

---

## Archivos Modificados

1. **`supabase/functions/modify-evaluation-v2/index.ts`**
   - 3 funciones nuevas agregadas
   - 1 función modificada (`generateEvaluationV2`)
   - Handler principal modificado
   - Constantes actualizadas

**Total:** 1 archivo, ~250 líneas modificadas/agregadas

---

**Fin del Resumen**
