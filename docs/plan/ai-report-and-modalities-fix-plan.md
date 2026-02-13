# Plan de Implementación: Fixes para Reporte Narrativo y Opciones de Respuesta Equivalentes

**Fecha:** 2025-01-XX  
**Rama:** `mejorar-evaluaciones`  
**Basado en:** `docs/debug/ai-report-and-modalities-root-cause.md`

---

## Resumen Ejecutivo

Este plan documenta las correcciones necesarias para resolver dos problemas críticos identificados en el análisis de causa raíz:

1. **Reporte narrativo no aparece en UI V2** → Fix #1 y #2
2. **Opciones de respuesta equivalentes no aparecen** → Fix #3 y #4

**Prioridad:** ALTA para Fix #1 y #2, MEDIA para Fix #3, BAJA para Fix #4

**Restricciones:**
- ✅ Solo modificar V2 (V1 es legacy)
- ✅ Mantener backward compatibility (legacy report debe seguir funcionando)
- ✅ No refactorizar código no relacionado

---

## A) Definición de Comportamiento Esperado

### A1) Reporte Narrativo (`aiReport.narrative`)

#### Cuando `narrative` Existe y es Válido

**Condición:** `aiReport.narrative` es un string no vacío con longitud ≥ 80 caracteres

**Comportamiento esperado:**
1. **Modo V2:** El componente `V2AIReportPanel` debe:
   - Verificar `aiReport.narrative` al inicio
   - Si existe, renderizar **SOLO** el texto narrativo en párrafos continuos
   - Usar estilos: `prose prose-sm`, `whitespace-pre-wrap`, `leading-relaxed`
   - **NO mostrar** campos legacy (designRationale, versionsExplanation, etc.)
   - Mantener el panel collapsible con título "Reporte de diseño de IA"

2. **Modo V1 (legacy):** El componente `AIDesignReport` ya funciona correctamente:
   - Verifica `reportData.narrative` (línea 79)
   - Si existe, muestra narrativo
   - Si no existe, muestra formato legacy

**Lo que el docente debe ver:**
- Un panel colapsible con título "Reporte de diseño de IA"
- Al expandir, un texto narrativo continuo de 200-400 palabras en 3-6 párrafos
- El texto explica: grupo/materia, contenidos/competencias, versiones generadas, contemplaciones, opciones equivalentes (si aplica), requerimientos del docente, fuentes utilizadas
- **NO debe ver:** Checklist estructurado, chips de versiones, contadores de contemplaciones

---

#### Cuando `narrative` No Existe o es Inválido

**Condición:** `aiReport.narrative` es `undefined`, `null`, string vacío, o longitud < 80 caracteres

**Comportamiento esperado:**
1. **Modo V2:** El componente `V2AIReportPanel` debe:
   - Detectar que `narrative` no existe
   - Renderizar el formato legacy estructurado como fallback
   - Mostrar: designRationale, versionsExplanation, contemplacionesApplied, responseOptions, varkSummary
   - Mantener el mismo comportamiento que tiene actualmente

2. **Modo V1:** El componente `AIDesignReport` ya funciona correctamente como fallback

**Lo que el docente debe ver:**
- El formato legacy estructurado (checklist con secciones)
- Esto garantiza que nunca se muestre una pantalla vacía

---

#### Persistencia y Carga

**Al guardar:**
- `aiReport.narrative` debe guardarse en:
  - `evaluacion_generada.ai_report.narrative` (dentro de JSONB)
  - `ai_design_report.narrative` (columna separada JSONB)

**Al cargar desde DB:**
- Debe leerse desde:
  - `evaluacion_generada?.ai_report?.narrative` (prioridad 1)
  - `ai_design_report?.narrative` (prioridad 2, fallback)
- Debe setearse en el state `aiDesignReport` como JSON stringificado

**Al recargar página:**
- El narrativo debe persistir y mostrarse correctamente
- No debe perderse al recargar

---

### A2) Opciones de Respuesta Equivalentes (`equivalentResponseOptions`)

#### Cuando `responseOptionsInclude === true`

**Condición:** El `evaluation_design_plan.responseOptions.include === true`

**Comportamiento esperado:**

1. **Generación (Edge Function):**
   - Items de tipo `essay`, `paragraph`, `source_analysis`, `true_false_justify` **DEBEN** incluir `equivalentResponseOptions`
   - Cada item debe tener exactamente 3 opciones
   - Las opciones deben ser context-appropriate según la demanda cognitiva del prompt

2. **Validación:**
   - Debe verificar que items de comprensión/proceso tengan `equivalentResponseOptions` cuando `responseOptionsInclude === true`
   - Debe verificar que haya exactamente 3 opciones
   - Debe agregar warnings si falta o hay cantidad incorrecta

3. **Normalización (Frontend):**
   - `equivalentResponseOptions` se convierte a `responseOptions` (ya funciona correctamente)

4. **Renderizado (UI):**
   - Items con `responseOptions.enabled === true` muestran el componente `ResponseOptions`
   - Se muestran las 3 opciones con formato, descripción y texto de metacognición

**Lo que el docente debe ver:**
- Items de comprensión/proceso (essay, paragraph, source_analysis, true_false_justify) muestran:
  - Un panel destacado con borde azul
  - Título: "Opciones de Respuesta Equivalentes"
  - Texto de metacognición explicando que son equivalentes
  - 3 opciones numeradas (Opción 1, Opción 2, Opción 3) con:
    - Formato (ej: "essay", "analysis_table")
    - Descripción detallada

---

#### Cuando `responseOptionsInclude === false`

**Comportamiento esperado:**
- Ningún item debe incluir `equivalentResponseOptions`
- El modelo no debe generar opciones
- La UI no debe mostrar el panel de opciones

---

## B) Correcciones de Flujo de Datos

### B1) Flujo de `aiReport.narrative`

#### Flujo Actual (Roto)

```
1. Edge function genera narrative ✅
   ↓
2. Edge function incluye en response.aiReport.narrative ✅
   ↓
3. Frontend service pasa aiReport directamente ✅
   ↓
4. Frontend setea aiDesignReport state ✅
   ↓
5. Frontend guarda en DB (evaluacion_generada.ai_report) ✅
   ↓
6. [FALTA] Carga desde DB al recargar página ❌
   ↓
7. [FALTA] V2AIReportPanel verifica narrative ❌
   ↓
8. UI muestra formato legacy (incorrecto) ❌
```

#### Flujo Corregido (Esperado)

```
1. Edge function genera narrative ✅
   ↓
2. Edge function incluye en response.aiReport.narrative ✅
   ↓
3. Frontend service pasa aiReport directamente ✅
   ↓
4. Frontend setea aiDesignReport state ✅
   ↓
5. Frontend guarda en DB (evaluacion_generada.ai_report + ai_design_report) ✅
   ↓
6. [NUEVO] useEffect carga desde DB al montar/recargar ✅
   ↓
7. [NUEVO] V2AIReportPanel verifica aiReport.narrative ✅
   ↓
8a. Si narrative existe → UI muestra narrativo ✅
8b. Si narrative no existe → UI muestra formato legacy (fallback) ✅
```

**Puntos de corrección:**
- **Punto 6:** Agregar carga desde DB en `EvaluacionesGrupo.tsx`
- **Punto 7:** Agregar verificación de `narrative` en `V2AIReportPanel`

---

### B2) Flujo de `equivalentResponseOptions`

#### Flujo Actual (Roto)

```
1. Prompt instruye solo para essay, paragraph ❌
   ↓
2. Modelo genera opciones solo para essay, paragraph ❌
   ↓
3. [FALTA] Validación de equivalentResponseOptions ❌
   ↓
4. Normalización convierte a responseOptions ✅
   ↓
5. UI renderiza responseOptions ✅
```

#### Flujo Corregido (Esperado)

```
1. Prompt instruye para essay, paragraph, source_analysis, true_false_justify ✅
   ↓
2. Modelo genera opciones para todos los tipos de comprensión/proceso ✅
   ↓
3. [NUEVO] Validación verifica presencia y cantidad (exactamente 3) ✅
   ↓
4. Normalización convierte a responseOptions ✅
   ↓
5. UI renderiza responseOptions ✅
```

**Puntos de corrección:**
- **Punto 1:** Actualizar prompt para incluir todos los tipos
- **Punto 3:** Agregar validación de `equivalentResponseOptions`

---

## C) Alcance de Cambios

### Fix #1: Agregar Verificación de `narrative` en V2AIReportPanel

#### Archivo: `src/components/evaluaciones/v2/V2InfoPanels.tsx`

**Responsabilidad del archivo:**
- Renderizar paneles informativos para evaluaciones V2
- `V2AIReportPanel` específicamente renderiza el reporte de IA

**Cambios conceptuales:**

1. **Agregar verificación de `narrative` al inicio del componente:**
   - Verificar si `aiReport.narrative` existe y es válido (string no vacío, longitud ≥ 80)
   - Similar a la verificación en `AIDesignReport.tsx` línea 79

2. **Renderizado condicional:**
   - **Si `narrative` existe:**
     - Renderizar SOLO el narrativo en formato de párrafos
     - Usar los mismos estilos que `AIDesignReport.tsx` (líneas 110-125)
     - NO renderizar campos legacy
   - **Si `narrative` NO existe:**
     - Renderizar formato legacy estructurado (comportamiento actual)
     - Mantener todos los campos: designRationale, versionsExplanation, etc.

3. **Mantener estructura del componente:**
   - Mantener el panel collapsible
   - Mantener el título y badge "Solo docente"
   - Solo cambiar el contenido interno según si hay narrative o no

**Líneas a modificar:**
- ~315-429: Función `V2AIReportPanel`
- Agregar verificación al inicio (después de línea 320)
- Agregar renderizado de narrative (nuevo bloque)
- Envolver renderizado legacy en condición `!hasNarrative`

**Dependencias:**
- Ninguna (es un cambio aislado en el componente)

---

### Fix #2: Agregar Carga de `aiDesignReport` desde DB

#### Archivo: `src/pages/EvaluacionesGrupo.tsx`

**Responsabilidad del archivo:**
- Página principal de generación de evaluaciones
- Maneja el estado de `aiDesignReport` (string JSON)

**Cambios conceptuales:**

1. **Agregar `useEffect` para cargar desde DB:**
   - Detectar si hay un `evaluationId` en la URL (query param o route param)
   - Si existe, cargar la evaluación desde Supabase
   - Extraer `evaluacion_generada.ai_report` o `ai_design_report`
   - Setear `aiDesignReport` state con `JSON.stringify(aiReport)`

2. **Lógica de carga:**
   - Prioridad 1: `evaluacion_generada?.ai_report`
   - Prioridad 2: `ai_design_report` (fallback)
   - Si ninguno existe, dejar `aiDesignReport` como `null`

3. **Cuándo ejecutar:**
   - Al montar el componente (si hay `evaluationId`)
   - Al cambiar el `evaluationId` (si es dinámico)
   - NO ejecutar si ya hay `aiDesignReport` setado (evitar sobrescribir)

**Líneas a agregar:**
- Después de los `useEffect` existentes (buscar donde están los otros `useEffect`)
- Nuevo `useEffect` con dependencias: `[evaluationId]` (si existe)

**Dependencias:**
- Necesita acceso a `supabase` client (ya importado)
- Necesita definir cómo se pasa `evaluationId` (URL param, query param, o state)

**Consideraciones:**
- Verificar si `EvaluacionesGrupo` recibe `evaluationId` como prop o desde URL
- Si no existe mecanismo para pasar `evaluationId`, considerar agregarlo

---

### Fix #3: Actualizar Prompt para Incluir Todos los Tipos de Items

#### Archivo: `supabase/functions/modify-evaluation-v2/index.ts`

**Responsabilidad del archivo:**
- Edge function que genera evaluaciones V2
- Construye prompts para OpenAI
- `buildV2SystemPrompt()` construye el system prompt

**Cambios conceptuales:**

1. **Actualizar sección de instrucciones sobre `equivalentResponseOptions`:**
   - **Línea ~488-492:** Cambiar "Items de desarrollo (essay, paragraph)" a "Items de comprensión/proceso (essay, paragraph, source_analysis, true_false_justify)"
   - Explicar que estos 4 tipos requieren procesamiento y construcción de respuesta

2. **Actualizar sección de tipos de items:**
   - **Línea ~664:** Agregar `equivalentResponseOptions` a:
     - `paragraph: Puede incluir "equivalentResponseOptions"`
     - `source_analysis: Puede incluir "equivalentResponseOptions"`
     - `true_false_justify: Puede incluir "equivalentResponseOptions"`

3. **Mantener instrucciones existentes:**
   - Mantener la instrucción de exactamente 3 opciones
   - Mantener la instrucción de context-appropriate
   - Mantener la instrucción de equivalencia en dificultad

**Líneas a modificar:**
- ~488-492: Sección "OPCIONES DE RESPUESTA EQUIVALENTES" en `buildV2SystemPrompt()`
- ~613-615: Instrucción específica sobre items de desarrollo
- ~664: Lista de tipos de items

**Dependencias:**
- Ninguna (solo cambios en strings del prompt)

---

### Fix #4: Implementar Validación de `equivalentResponseOptions`

#### Archivo: `supabase/functions/modify-evaluation-v2/index.ts`

**Responsabilidad del archivo:**
- Edge function que genera evaluaciones V2
- `validateAndNormalizeSpec()` valida y normaliza el spec generado

**Cambios conceptuales:**

1. **Crear función `validateEquivalentResponseOptions()`:**
   - Parámetros: `item`, `responseOptionsInclude`, `warnings` array
   - Verificar si el item es de tipo comprensión/proceso: `essay`, `paragraph`, `source_analysis`, `true_false_justify`
   - Si es de comprensión/proceso Y `responseOptionsInclude === true`:
     - Verificar que `equivalentResponseOptions` existe
     - Verificar que `equivalentResponseOptions.enabled === true`
     - Verificar que `equivalentResponseOptions.options` es un array
     - Verificar que `equivalentResponseOptions.options.length === 3`
     - Si falta o cantidad incorrecta, agregar warning y normalizar (agregar opciones faltantes o eliminar excedentes)

2. **Integrar en `validateAndNormalizeSpec()`:**
   - Iterar sobre todos los items en todas las secciones
   - Llamar `validateEquivalentResponseOptions()` para cada item
   - Pasar `responseOptionsInclude` como parámetro (necesita estar disponible en el contexto)

3. **Normalización automática:**
   - Si hay menos de 3 opciones: Agregar opciones genéricas faltantes
   - Si hay más de 3 opciones: Mantener solo las primeras 3
   - Agregar warning en ambos casos

**Líneas a agregar:**
- Nueva función después de `validateAndNormalizeSpec()` (después de línea ~407)
- Llamada a la función dentro de `validateAndNormalizeSpec()`, en el loop de items (después de línea ~318)

**Dependencias:**
- Necesita acceso a `responseOptionsInclude` en el contexto de `validateAndNormalizeSpec()`
- Actualmente `validateAndNormalizeSpec()` no recibe `responseOptionsInclude` como parámetro
- **Solución:** Agregar `responseOptionsInclude` como parámetro opcional a `validateAndNormalizeSpec()`
- Pasar `responseOptionsInclude` desde donde se llama `validateAndNormalizeSpec()` (línea ~788)

**Consideraciones:**
- La validación debe ser no-fatal (solo warnings, no errores)
- La normalización debe ser automática para no romper el flujo

---

## D) Criterios de Aceptación

### D1) Reporte Narrativo

#### AC1: Narrative se Muestra en Modo V2

**Criterio:**
- Cuando `aiReport.narrative` existe y es válido (string ≥ 80 caracteres)
- Y el usuario está en modo V2 (`useBetaV2 === true`)
- Entonces `V2AIReportPanel` debe mostrar SOLO el texto narrativo en párrafos continuos

**Verificación:**
1. Generar evaluación V2
2. Verificar en Network tab que `data.aiReport.narrative` existe
3. Verificar en UI que el panel "Reporte de diseño de IA" muestra texto narrativo
4. Verificar que NO muestra campos legacy (Justificación, Versiones, Contemplaciones)

---

#### AC2: Legacy Fallback Funciona

**Criterio:**
- Cuando `aiReport.narrative` NO existe o es inválido
- Y el usuario está en modo V2
- Entonces `V2AIReportPanel` debe mostrar el formato legacy estructurado

**Verificación:**
1. Abrir evaluación legacy (sin narrative)
2. Verificar que el panel muestra formato legacy (checklist estructurado)
3. Verificar que todos los campos legacy están presentes

---

#### AC3: Narrative Persiste al Recargar

**Criterio:**
- Cuando se guarda una evaluación con `narrative`
- Y el usuario recarga la página
- Entonces el `narrative` debe cargarse desde la DB y mostrarse correctamente

**Verificación:**
1. Generar evaluación V2 (con narrative)
2. Guardar la evaluación
3. Recargar la página
4. Verificar que el `narrative` se muestra correctamente

---

#### AC4: Backward Compatibility

**Criterio:**
- Evaluaciones existentes sin `narrative` deben seguir funcionando
- El formato legacy debe renderizarse correctamente
- No debe haber errores en la consola

**Verificación:**
1. Abrir evaluación legacy (sin narrative)
2. Verificar que se muestra formato legacy
3. Verificar que no hay errores en consola

---

### D2) Opciones de Respuesta Equivalentes

#### AC5: Opciones se Generan para Todos los Tipos

**Criterio:**
- Cuando `responseOptionsInclude === true`
- Items de tipo `essay`, `paragraph`, `source_analysis`, `true_false_justify` deben incluir `equivalentResponseOptions`
- Cada item debe tener exactamente 3 opciones

**Verificación:**
1. Generar evaluación V2 con `responseOptionsInclude: true`
2. Verificar en Network tab que items de comprensión/proceso tienen `equivalentResponseOptions`
3. Verificar que `equivalentResponseOptions.options.length === 3` para cada item

---

#### AC6: Opciones se Muestran en UI

**Criterio:**
- Cuando un item tiene `responseOptions.enabled === true`
- Entonces la UI debe mostrar el componente `ResponseOptions` con las 3 opciones

**Verificación:**
1. Generar evaluación V2 con opciones equivalentes
2. Verificar en UI que items de comprensión/proceso muestran el panel de opciones
3. Verificar que se muestran exactamente 3 opciones
4. Verificar que cada opción tiene formato y descripción

---

#### AC7: Validación Detecta Problemas

**Criterio:**
- Cuando un item de comprensión/proceso NO tiene `equivalentResponseOptions` y debería tenerlo
- O cuando tiene cantidad incorrecta de opciones
- Entonces debe agregarse un warning (no fatal)

**Verificación:**
1. Simular respuesta del modelo sin opciones (o con cantidad incorrecta)
2. Verificar que se agrega warning en `v2Response.warnings`
3. Verificar que la evaluación se genera igual (no falla)

---

#### AC8: Normalización Automática

**Criterio:**
- Cuando un item tiene menos de 3 opciones, debe agregarse opciones faltantes
- Cuando un item tiene más de 3 opciones, debe mantener solo las primeras 3
- Debe agregarse warning en ambos casos

**Verificación:**
1. Simular respuesta con 2 opciones
2. Verificar que se agrega una opción genérica (total = 3)
3. Verificar que se agrega warning
4. Simular respuesta con 4 opciones
5. Verificar que se mantienen solo las primeras 3
6. Verificar que se agrega warning

---

## E) Estrategia de Testing

### E1) Testing Unitario (Donde Aplique)

#### Test 1: V2AIReportPanel - Narrative Exists

**Archivo:** `src/components/evaluaciones/v2/V2InfoPanels.test.tsx` (crear si no existe)

**Test:**
- Renderizar `V2AIReportPanel` con `aiReport.narrative = "Texto narrativo de prueba..."`
- Verificar que se renderiza el narrativo
- Verificar que NO se renderizan campos legacy

---

#### Test 2: V2AIReportPanel - Narrative Missing

**Test:**
- Renderizar `V2AIReportPanel` con `aiReport.narrative = undefined`
- Verificar que se renderizan campos legacy
- Verificar que NO se renderiza narrativo

---

#### Test 3: validateEquivalentResponseOptions - Valid Item

**Archivo:** `supabase/functions/modify-evaluation-v2/index.test.ts` (crear si no existe)

**Test:**
- Llamar `validateEquivalentResponseOptions()` con:
  - Item tipo `essay`
  - `equivalentResponseOptions` con 3 opciones
  - `responseOptionsInclude = true`
- Verificar que no se agregan warnings
- Verificar que el item no se modifica

---

#### Test 4: validateEquivalentResponseOptions - Missing Options

**Test:**
- Llamar `validateEquivalentResponseOptions()` con:
  - Item tipo `essay`
  - `equivalentResponseOptions` undefined
  - `responseOptionsInclude = true`
- Verificar que se agrega warning
- Verificar que se agregan 3 opciones genéricas

---

### E2) Testing de Integración

#### Test 5: Flujo Completo - Narrative Generation to UI

**Pasos:**
1. Generar evaluación V2
2. Verificar que `aiReport.narrative` existe en la respuesta del edge function
3. Verificar que `aiReport.narrative` se guarda en DB
4. Verificar que `aiReport.narrative` se carga desde DB
5. Verificar que `V2AIReportPanel` muestra el narrativo

**Verificación en cada paso:**
- Network tab: Verificar payloads y respuestas
- Console logs: Verificar mensajes de debug
- UI: Verificar renderizado

---

#### Test 6: Flujo Completo - Equivalent Response Options

**Pasos:**
1. Generar evaluación V2 con `responseOptionsInclude: true`
2. Verificar que items de comprensión/proceso tienen `equivalentResponseOptions` en la respuesta
3. Verificar que la validación no agrega warnings (si está correcto)
4. Verificar que la normalización convierte a `responseOptions`
5. Verificar que la UI muestra las opciones

**Verificación en cada paso:**
- Network tab: Verificar estructura del spec
- Console logs: Verificar warnings
- UI: Verificar renderizado de opciones

---

### E3) Testing Manual End-to-End (Grupo Demo "9no1")

#### Test End-to-End #1: Narrative en Nueva Generación

**Pasos:**
1. Navegar a `/evaluaciones/nuevo`
2. Seleccionar grupo "9no1"
3. Seleccionar materia "Historia"
4. Seleccionar contenidos: "Batllismo", "Movimiento obrero"
5. Seleccionar competencias y criterios
6. Activar "Usar V2" (toggle `useBetaV2`)
7. Hacer click en "Generar Evaluación"
8. Esperar a que se genere
9. **Verificar:**
   - En Network tab: `data.aiReport.narrative` existe y es string válido
   - En UI: Panel "Reporte de diseño de IA" muestra texto narrativo
   - En UI: NO muestra campos legacy estructurados
10. Guardar la evaluación
11. Recargar la página
12. **Verificar:**
    - El narrativo se carga desde DB
    - El narrativo se muestra correctamente

**Resultado esperado:** ✅ Narrative visible en UI, persiste al recargar

---

#### Test End-to-End #2: Narrative Fallback (Legacy)

**Pasos:**
1. Abrir evaluación existente sin `narrative` (evaluación legacy)
2. **Verificar:**
   - Panel "Reporte de diseño de IA" muestra formato legacy
   - Se muestran: Justificación, Versiones, Contemplaciones
   - NO hay errores en consola

**Resultado esperado:** ✅ Formato legacy se muestra correctamente

---

#### Test End-to-End #3: Equivalent Response Options

**Pasos:**
1. Navegar a `/evaluaciones/nuevo`
2. Seleccionar grupo "9no1"
3. Seleccionar materia "Historia"
4. Seleccionar contenidos, competencias, criterios
5. **Activar "Incluir opciones de respuesta equivalentes"** (si existe toggle)
6. Activar "Usar V2"
7. Hacer click en "Generar Evaluación"
8. Esperar a que se genere
9. **Verificar en Network tab:**
   - `responseOptionsInclude: true` en el payload
   - Items tipo `essay` tienen `equivalentResponseOptions` con 3 opciones
   - Items tipo `paragraph` tienen `equivalentResponseOptions` con 3 opciones
   - Items tipo `source_analysis` tienen `equivalentResponseOptions` con 3 opciones (NUEVO)
   - Items tipo `true_false_justify` tienen `equivalentResponseOptions` con 3 opciones (NUEVO)
10. **Verificar en UI:**
    - Items `essay` muestran panel de opciones equivalentes
    - Items `paragraph` muestran panel de opciones equivalentes
    - Items `source_analysis` muestran panel de opciones equivalentes (NUEVO)
    - Items `true_false_justify` muestran panel de opciones equivalentes (NUEVO)
    - Cada panel muestra exactamente 3 opciones
    - Cada opción tiene formato y descripción

**Resultado esperado:** ✅ Todos los items de comprensión/proceso muestran 3 opciones equivalentes

---

#### Test End-to-End #4: Validación de Opciones

**Pasos:**
1. Simular respuesta del modelo con item `essay` que tiene solo 2 opciones (incorrecto)
2. **Verificar:**
   - Se agrega warning: "Item X tiene 2 opciones, se requieren exactamente 3"
   - Se agrega una opción genérica (total = 3)
   - La evaluación se genera exitosamente (no falla)

**Resultado esperado:** ✅ Validación detecta problema y normaliza automáticamente

---

## F) Riesgos y Salvaguardas

### F1) Riesgos Identificados

#### Riesgo #1: Romper Evaluaciones Legacy

**Descripción:**
- Si `V2AIReportPanel` solo verifica `narrative` y no tiene fallback, evaluaciones legacy sin `narrative` mostrarían pantalla vacía

**Salvaguarda:**
- **AC2:** Garantizar que cuando `narrative` no existe, se muestra formato legacy
- **Implementación:** Usar patrón `hasNarrative ? renderNarrative() : renderLegacy()`
- **Testing:** Test End-to-End #2 verifica este caso

---

#### Riesgo #2: Pérdida de Datos al Recargar

**Descripción:**
- Si la carga desde DB no funciona correctamente, el narrativo se perdería al recargar

**Salvaguarda:**
- **AC3:** Verificar que el narrativo persiste al recargar
- **Implementación:** Cargar desde ambas rutas (`evaluacion_generada.ai_report` y `ai_design_report`)
- **Testing:** Test End-to-End #1 paso 11-12

---

#### Riesgo #3: Validación Demasiado Estricta

**Descripción:**
- Si la validación de `equivalentResponseOptions` es fatal (error en lugar de warning), podría romper generaciones válidas

**Salvaguarda:**
- **Implementación:** Validación debe ser no-fatal (solo warnings)
- **Normalización:** Agregar opciones faltantes automáticamente en lugar de fallar
- **Testing:** Test 4 y Test End-to-End #4

---

#### Riesgo #4: Cambios en Prompt Afecten Generaciones Existentes

**Descripción:**
- Si el prompt cambia significativamente, podría afectar la calidad de generaciones existentes

**Salvaguarda:**
- **Implementación:** Cambios mínimos y específicos (solo agregar tipos faltantes)
- **Testing:** Comparar generaciones antes/después del cambio
- **Rollback:** Los cambios en prompt son fáciles de revertir

---

### F2) Orden de Implementación Recomendado

**Orden sugerido para minimizar riesgo:**

1. **Fix #1 (V2AIReportPanel)** - PRIORIDAD ALTA
   - **Razón:** Bloquea completamente la funcionalidad del narrativo
   - **Riesgo:** Bajo (solo agrega verificación, no modifica lógica existente)
   - **Testing:** Test End-to-End #1 y #2

2. **Fix #2 (Carga desde DB)** - PRIORIDAD ALTA
   - **Razón:** Afecta persistencia, pero no bloquea si Fix #1 está hecho
   - **Riesgo:** Medio (agrega nueva lógica de carga)
   - **Testing:** Test End-to-End #1 paso 11-12

3. **Fix #3 (Prompt completo)** - PRIORIDAD MEDIA
   - **Razón:** Afecta funcionalidad parcial (solo algunos tipos de items)
   - **Riesgo:** Bajo (solo cambios en strings)
   - **Testing:** Test End-to-End #3

4. **Fix #4 (Validación)** - PRIORIDAD BAJA
   - **Razón:** Mejora calidad pero no bloquea funcionalidad
   - **Riesgo:** Bajo (solo agrega validación, no modifica lógica existente)
   - **Testing:** Test 3, 4, y Test End-to-End #4

**Estrategia:**
- Implementar Fix #1 y #2 primero (ambos críticos para narrativo)
- Luego Fix #3 (crítico para opciones equivalentes)
- Finalmente Fix #4 (mejora calidad)

---

### F3) Puntos de Verificación Post-Implementación

**Después de cada fix, verificar:**

1. **No hay regresiones:**
   - Evaluaciones legacy siguen funcionando
   - Evaluaciones V1 no se ven afectadas
   - No hay errores en consola

2. **Funcionalidad nueva funciona:**
   - Narrative se muestra en V2 (Fix #1)
   - Narrative persiste al recargar (Fix #2)
   - Opciones equivalentes se generan para todos los tipos (Fix #3)
   - Validación detecta problemas (Fix #4)

3. **Backward compatibility:**
   - Evaluaciones sin `narrative` muestran formato legacy
   - Evaluaciones sin `equivalentResponseOptions` no fallan

---

## G) Resumen de Archivos a Modificar

### Archivos a Modificar (4)

1. ✅ `src/components/evaluaciones/v2/V2InfoPanels.tsx`
   - **Fix:** #1 (Verificación de narrative)
   - **Cambios:** Agregar verificación y renderizado condicional

2. ✅ `src/pages/EvaluacionesGrupo.tsx`
   - **Fix:** #2 (Carga desde DB)
   - **Cambios:** Agregar useEffect para cargar aiDesignReport

3. ✅ `supabase/functions/modify-evaluation-v2/index.ts`
   - **Fix:** #3 (Prompt completo) y #4 (Validación)
   - **Cambios:** Actualizar prompts y agregar función de validación

### Archivos a Crear (0)

- No se requieren archivos nuevos

---

## H) Checklist de Implementación

### Pre-Implementación

- [ ] Leer y entender el análisis de causa raíz completo
- [ ] Verificar que se está en la rama `mejorar-evaluaciones`
- [ ] Hacer backup o commit del estado actual
- [ ] Revisar los archivos a modificar

### Implementación (Orden Recomendado)

- [ ] **Fix #1:** Modificar `V2InfoPanels.tsx` para verificar `narrative`
- [ ] **Fix #2:** Agregar carga desde DB en `EvaluacionesGrupo.tsx`
- [ ] **Fix #3:** Actualizar prompts en `modify-evaluation-v2/index.ts`
- [ ] **Fix #4:** Agregar validación de `equivalentResponseOptions`

### Post-Implementación

- [ ] Ejecutar Test End-to-End #1 (Narrative en nueva generación)
- [ ] Ejecutar Test End-to-End #2 (Narrative fallback)
- [ ] Ejecutar Test End-to-End #3 (Equivalent response options)
- [ ] Ejecutar Test End-to-End #4 (Validación)
- [ ] Verificar que no hay errores de linting
- [ ] Verificar que no hay regresiones en evaluaciones legacy
- [ ] Commit con mensaje descriptivo

---

## I) Notas Adicionales

### I1) Consideraciones de Performance

- **Carga desde DB:** El `useEffect` debe ejecutarse solo cuando sea necesario (no en cada render)
- **Validación:** La validación de `equivalentResponseOptions` debe ser eficiente (no iterar múltiples veces)

### I2) Consideraciones de UX

- **Loading states:** Si la carga desde DB tarda, considerar mostrar loading state
- **Error handling:** Si la carga falla, no debe romper la UI (dejar `aiDesignReport` como `null`)

### I3) Consideraciones de Mantenibilidad

- **Código duplicado:** El renderizado de narrative en `V2AIReportPanel` puede ser similar a `AIDesignReport.tsx`
- **Considerar:** Extraer a componente compartido si hay mucha duplicación (pero no en esta fase)

---

**Fin del Plan de Implementación**
