# Resumen de Cambios: Fix para Equivalent Response Options en V2

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Objetivo:** Hacer que las opciones de respuesta equivalentes aparezcan de forma confiable en la UI V2

---

## Cambios Realizados

### 1. Edge Function: Validación y Normalización Mejorada (`supabase/functions/modify-evaluation-v2/index.ts`)

#### A) Nueva Función: `generateContextAppropriateOptions` (Líneas ~268-340)

**Propósito:** Generar opciones context-appropriate basadas en el prompt del item

**Lógica:**
- Analiza el prompt para detectar demanda cognitiva:
  - Comparación → incluye `comparison_chart`
  - Dos dimensiones (causa→efecto, evidencia→interpretación) → incluye `double_entry_table`
  - Secuencia → incluye `titled_outline`
  - Análisis → incluye `analysis_table`
- Siempre incluye `brief_written` como primera opción (fallback universal)
- **NUNCA** agrega `comparison_chart` a menos que el prompt requiera comparación
- **NUNCA** agrega `double_entry_table` a menos que el prompt requiera mapeo bidimensional
- Rellena slots faltantes con formatos seguros (`titled_outline`, `analysis_table`)

**Razón:** Asegurar que las opciones sean context-appropriate incluso si el modelo no las genera correctamente.

---

#### B) Función Mejorada: `validateEquivalentResponseOptions` (Líneas ~342-450)

**Cambios principales:**

1. **Eliminación de opciones en items no elegibles:**
   - Si el item NO es `essay`, `paragraph`, `source_analysis`, o `true_false_justify` → elimina `equivalentResponseOptions`

2. **Generación automática si faltan:**
   - Si `equivalentResponseOptions` falta o es inválido → genera opciones context-appropriate usando `generateContextAppropriateOptions`
   - Agrega warning pero NO falla

3. **Normalización de estructura:**
   - Asegura que todas las opciones tengan `id`, `format`, `description`
   - Genera IDs si faltan: `opt-1`, `opt-2`, `opt-3`
   - Ajusta cantidad a exactamente `expectedCount` (pad o trim)

4. **Validación de campos requeridos:**
   - Asegura `enabled === true`
   - Asegura `metacognitionText` existe

**Razón:** Hacer el sistema confiable incluso si el modelo ignora el prompt o genera estructura incorrecta.

---

#### C) Prompt Mejorado: `buildV2SystemPrompt` (Líneas ~732-780)

**Cambios principales:**

1. **Sección expandida "EQUIVALENT RESPONSE OPTIONS":**
   - Enfatiza que es **MANDATORY** para items elegibles
   - Lista explícita de tipos elegibles vs no elegibles
   - Estructura JSON requerida con ejemplo

2. **Reglas de selección context-appropriate:**
   - Instrucciones claras sobre cuándo usar cada formato
   - **NUNCA** agregar `comparison_chart` a menos que el prompt requiera comparación
   - **NUNCA** agregar `double_entry_table` a menos que el prompt requiera mapeo bidimensional

3. **Requisito de equivalencia:**
   - Enfatiza que todas las opciones deben evaluar el mismo objetivo de aprendizaje
   - Mismo nivel de demanda cognitiva
   - Mismo nivel de evidencia requerida

4. **Ejemplo concreto:**
   - Incluye ejemplo JSON completo para un prompt de comparación

**Razón:** Mejorar la probabilidad de que el modelo genere opciones correctas siguiendo las reglas.

---

### 2. Frontend: Normalizador Mejorado (`src/services/evaluations/v2Normalizer.ts`)

**Líneas modificadas:** ~305-325

**Cambios principales:**

1. **Generación de IDs estables:**
   - Si `id` falta, genera `opt-${index + 1}` (ej: `opt-1`, `opt-2`, `opt-3`)
   - Asegura que cada opción tenga un ID único

2. **Validación mejorada:**
   - Solo establece `responseOptions` si hay al menos una opción válida
   - Filtra opciones que no tienen `format` ni `description`

3. **MetacognitionText por defecto:**
   - Si falta, usa texto por defecto en inglés

**Antes:**
```typescript
id: safeString(o?.id, ''), // Podía ser string vacío
```

**Después:**
```typescript
const id = safeString(o?.id, '') || `opt-${index + 1}`; // Siempre genera ID si falta
```

**Razón:** Asegurar que el frontend siempre tenga IDs válidos para renderizar correctamente.

---

### 3. Frontend: Renderizado Mejorado (`src/components/evaluaciones/v2/EvalItem.tsx`)

**Líneas modificadas:** ~58-63

**Cambios principales:**

1. **Verificación adicional:**
   - Ahora verifica `item.responseOptions?.enabled && item.responseOptions.options && item.responseOptions.options.length > 0`
   - Solo renderiza si hay opciones disponibles

**Antes:**
```typescript
{item.responseOptions?.enabled && (
  <ResponseOptions options={item.responseOptions} />
)}
```

**Después:**
```typescript
{item.responseOptions?.enabled && item.responseOptions.options && item.responseOptions.options.length > 0 && (
  <ResponseOptions options={item.responseOptions} />
)}
```

**Razón:** Evitar renderizar el componente si no hay opciones (aunque `enabled` sea true).

---

## Tipos de Items Elegibles

**Elegibles (comprehension/process):**
- ✅ `essay`
- ✅ `paragraph`
- ✅ `source_analysis`
- ✅ `true_false_justify`

**No elegibles:**
- ❌ `multiple_choice`
- ❌ `true_false`
- ❌ `short_answer`
- ❌ `table_completion`
- ❌ `matching`
- ❌ `ordering`

---

## Formatos de Opciones Disponibles

1. **`brief_written`** - Respuesta escrita breve (universal, siempre seguro)
2. **`titled_outline`** - Esquema estructurado con títulos y subtítulos
3. **`analysis_table`** - Tabla mostrando evidencia, interpretación, conexiones
4. **`comparison_chart`** - Tabla comparando aspectos, similitudes, diferencias (SOLO si prompt requiere comparación)
5. **`double_entry_table`** - Tabla de mapeo bidimensional (SOLO si prompt requiere dos dimensiones)

---

## Reglas de Context-Appropriate Selection

### Comparación:
- **Cuándo usar:** Prompt incluye "comparar", "contrastar", "diferencias", "similitudes"
- **Formato:** `comparison_chart`
- **Ejemplo:** "Compara las causas de la Primera Guerra Mundial con las de la Segunda"

### Dos Dimensiones:
- **Cuándo usar:** Prompt requiere mapeo bidimensional (causa→efecto, evidencia→interpretación)
- **Formato:** `double_entry_table`
- **Ejemplo:** "Relaciona las causas con sus efectos en el proceso de independencia"

### Secuencia:
- **Cuándo usar:** Prompt incluye "secuencia", "orden", "paso", "proceso"
- **Formato:** `titled_outline`
- **Ejemplo:** "Explica el proceso de formación de una montaña en pasos"

### Análisis:
- **Cuándo usar:** Prompt incluye "analizar", "explicar", "interpretar", "evidencia"
- **Formato:** `analysis_table`
- **Ejemplo:** "Analiza las evidencias que apoyan la teoría de la evolución"

---

## Comportamiento Resultante

### Antes:
- ❌ El modelo podía omitir `equivalentResponseOptions` incluso cuando se solicitaba
- ❌ Las opciones podían no ser context-appropriate
- ❌ No había normalización automática si faltaban opciones
- ❌ El frontend podía fallar si faltaban IDs

### Después:
- ✅ Si el modelo omite opciones → se generan automáticamente (context-appropriate)
- ✅ Las opciones son siempre context-appropriate (basadas en análisis del prompt)
- ✅ Normalización automática asegura exactamente 3 opciones
- ✅ El frontend genera IDs si faltan
- ✅ El UI solo renderiza si hay opciones válidas

---

## Backward Compatibility

✅ **Mantenida:**
- Evaluaciones existentes sin `equivalentResponseOptions` siguen funcionando
- Items no elegibles no muestran opciones (comportamiento correcto)
- Si `responseOptions.include === false`, no se generan opciones

---

## Archivos Modificados

1. `supabase/functions/modify-evaluation-v2/index.ts` (3 cambios principales)
   - Nueva función `generateContextAppropriateOptions`
   - Función `validateEquivalentResponseOptions` mejorada
   - Prompt `buildV2SystemPrompt` mejorado

2. `src/services/evaluations/v2Normalizer.ts` (1 cambio)
   - Normalización mejorada con generación de IDs

3. `src/components/evaluaciones/v2/EvalItem.tsx` (1 cambio)
   - Verificación mejorada antes de renderizar

**Total:** 3 archivos, 5 cambios principales

---

## Checklist de Testing Manual (Grupo Demo "9no1")

### Test 1: Items Elegibles Muestran 3 Opciones

**Pasos:**
1. Navegar a `/evaluaciones/nuevo`
2. Seleccionar grupo "9no1"
3. Seleccionar materia "Historia"
4. Seleccionar contenidos, competencias, criterios
5. **Activar "Incluir opciones de respuesta equivalentes"** (toggle `responseOptions.include`)
6. Activar "Usar V2" (toggle `useBetaV2`)
7. Hacer click en "Generar Evaluación"
8. Esperar a que se genere

**Verificación:**
- ✅ Items tipo `essay` muestran panel de opciones equivalentes
- ✅ Items tipo `paragraph` muestran panel de opciones equivalentes
- ✅ Items tipo `source_analysis` muestran panel de opciones equivalentes
- ✅ Items tipo `true_false_justify` muestran panel de opciones equivalentes
- ✅ Cada panel muestra exactamente 3 opciones
- ✅ Cada opción tiene formato y descripción

**Resultado esperado:** ✅ Todos los items elegibles muestran 3 opciones

---

### Test 2: Items No Elegibles NO Muestran Opciones

**Pasos:**
1. Generar evaluación V2 con opciones equivalentes habilitadas (ver Test 1)
2. Verificar items no elegibles

**Verificación:**
- ✅ Items tipo `multiple_choice` NO muestran panel de opciones
- ✅ Items tipo `true_false` NO muestran panel de opciones
- ✅ Items tipo `short_answer` NO muestran panel de opciones
- ✅ Items tipo `table_completion` NO muestran panel de opciones

**Resultado esperado:** ✅ Items no elegibles no muestran opciones

---

### Test 3: Opciones Context-Appropriate (Comparación)

**Pasos:**
1. Generar evaluación V2 con un item `essay` que requiera comparación
   - Ejemplo: "Compara las causas de la Primera Guerra Mundial con las de la Segunda"
2. Verificar opciones generadas

**Verificación:**
- ✅ Las opciones incluyen `comparison_chart` (porque el prompt requiere comparación)
- ✅ Las opciones NO incluyen `double_entry_table` (porque no requiere mapeo bidimensional)
- ✅ Las opciones incluyen `brief_written` (universal fallback)

**Resultado esperado:** ✅ Opciones son context-appropriate para comparación

---

### Test 4: Opciones Context-Appropriate (Análisis)

**Pasos:**
1. Generar evaluación V2 con un item `essay` que requiera análisis
   - Ejemplo: "Analiza las evidencias que apoyan la teoría de la evolución"
2. Verificar opciones generadas

**Verificación:**
- ✅ Las opciones incluyen `analysis_table` (porque el prompt requiere análisis)
- ✅ Las opciones NO incluyen `comparison_chart` (porque no requiere comparación)
- ✅ Las opciones incluyen `brief_written` (universal fallback)

**Resultado esperado:** ✅ Opciones son context-appropriate para análisis

---

### Test 5: Normalización Automática (Modelo Omite Opciones)

**Pasos:**
1. Simular que el modelo omite `equivalentResponseOptions` (o generar evaluación y verificar)
2. Verificar que se generan automáticamente

**Verificación:**
- ✅ Si el modelo omite opciones, se generan automáticamente
- ✅ Las opciones generadas son context-appropriate
- ✅ Hay exactamente 3 opciones
- ✅ Se agrega warning en `v2Response.warnings` con código `MISSING_EQUIVALENT_RESPONSE_OPTIONS`

**Resultado esperado:** ✅ Normalización automática funciona correctamente

---

### Test 6: Normalización Automática (Cantidad Incorrecta)

**Pasos:**
1. Simular que el modelo genera 2 opciones (o 4 opciones)
2. Verificar normalización

**Verificación:**
- ✅ Si hay 2 opciones → se agrega 1 opción context-appropriate (total = 3)
- ✅ Si hay 4 opciones → se mantienen solo las primeras 3
- ✅ Se agrega warning con código `INVALID_EQUIVALENT_RESPONSE_OPTIONS_COUNT`

**Resultado esperado:** ✅ Normalización ajusta cantidad a exactamente 3

---

### Test 7: IDs Generados si Faltan

**Pasos:**
1. Generar evaluación V2 con opciones equivalentes
2. Verificar en Network tab que las opciones tienen IDs
3. Si alguna opción no tiene ID, verificar que el frontend genera uno

**Verificación:**
- ✅ Todas las opciones tienen `id` válido
- ✅ Si falta `id` en la respuesta, el frontend genera `opt-1`, `opt-2`, `opt-3`
- ✅ El UI renderiza correctamente sin errores

**Resultado esperado:** ✅ IDs se generan automáticamente si faltan

---

### Test 8: Desactivar Opciones Equivalentes

**Pasos:**
1. Generar evaluación V2 **SIN** activar "Incluir opciones de respuesta equivalentes"
2. Verificar que no se muestran opciones

**Verificación:**
- ✅ Items elegibles NO muestran panel de opciones
- ✅ No hay `equivalentResponseOptions` en la respuesta del edge function

**Resultado esperado:** ✅ Opciones no se generan cuando están desactivadas

---

## Notas Adicionales

- **Prompts en inglés:** Los prompts del sistema están en inglés para mejor comprensión del modelo
- **UI en español:** El texto de la UI permanece en español (ya existente)
- **No se agregaron logs adicionales:** El código existente ya tiene logging suficiente
- **V1 no modificado:** Solo cambios en V2

---

**Fin del Resumen**
