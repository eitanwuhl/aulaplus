# Auditoría de IA - AulaPlus: Seguimiento y Validación

**Fecha:** 2025-01-XX  
**Tipo:** Validación de Afirmaciones del Documento de Auditoría Inicial  
**Método:** Verificación con Evidencia Concreta del Código

---

## Correcciones al Documento de Auditoría Anterior

### 1. Deployment / Hosting

**❌ INCORRECTO en auditoría anterior:**
- Afirmación: "Frontend: Render.com (aulaplus.onrender.com)"
- También mencionaba "Vercel" como posible opción

**✅ CORRECCIÓN:**
- **Frontend:** Render.com únicamente
- **Evidencia:** `aulaplus/vite.config.ts:11` - `allowedHosts: ['aulaplus.onrender.com']`
- **No hay evidencia de Vercel:** No existe `vercel.json`, `render.yaml`, ni referencias a Vercel en el código

---

### 2. Modelos de OpenAI

**❌ PARCIALMENTE INCORRECTO:**
- Auditoría anterior mencionaba `gpt-4.1-2025-04-14` para todas las evaluaciones
- Auditoría anterior mencionaba `gpt-4o-mini` para planificación

**✅ CORRECCIÓN:**

**generate-plan-completo:**
- **Modelo:** `gpt-4o-mini` ✅ CORRECTO
- **Evidencia:** `supabase/functions/generate-plan-completo/index.ts:343`
- **Temperatura:** `0.7` ✅ CORRECTO
- **Evidencia:** `supabase/functions/generate-plan-completo/index.ts:348`
- **Max Tokens:** No especificado (usa default de OpenAI)

**modify-evaluation (V1):**
- **Modelo:** Variable según `type`:
  - `type === 'chat'` → `gpt-5-mini-2025-08-07` ⚠️ **NUEVO HALLAZGO**
  - Otros tipos → `gpt-4.1-2025-04-14`
- **Evidencia:** `supabase/functions/modify-evaluation/index.ts:3378`
- **Max Completion Tokens:** `6000` (en path universal)
- **Evidencia:** `supabase/functions/modify-evaluation/index.ts:2324`
- **Response Format:** NO usa `json_object` (usa delimiter blocks)
- **Evidencia:** `supabase/functions/modify-evaluation/index.ts:2323` (comentario explícito)

**modify-evaluation-v2:**
- **Modelo:** `gpt-4.1-2025-04-14` ✅ CORRECTO
- **Evidencia:** `supabase/functions/modify-evaluation-v2/index.ts:733`
- **Response Format:** `{ type: 'json_object' }` ✅ CORRECTO
- **Evidencia:** `supabase/functions/modify-evaluation-v2/index.ts:738`
- **Max Completion Tokens:** `4000-6000` (variable según intento)
- **Evidencia:** `supabase/functions/modify-evaluation-v2/index.ts:740`

**generate-bulletin-text:**
- **Modelo:** `gpt-4.1-2025-04-14` ✅ CORRECTO
- **Evidencia:** `supabase/functions/generate-bulletin-text/index.ts:115`
- **Max Tokens:** `400` ✅ CORRECTO
- **Evidencia:** `supabase/functions/generate-bulletin-text/index.ts:120`
- **Temperatura:** `0.7` ✅ CORRECTO
- **Evidencia:** `supabase/functions/generate-bulletin-text/index.ts:121`

---

### 3. Estructura de Base de Datos

**❌ PARCIALMENTE INCORRECTO:**

**evaluaciones table:**
- **Auditoría anterior mencionaba:** `evaluation_spec_v2`, `evaluation_html`
- **✅ REALIDAD:**
  - Campo principal: `evaluacion_generada` (JSONB)
  - **Evidencia:** `supabase/migrations/20251222000000_add_evaluaciones_explicit_save.sql:31`
  - Campo adicional: `ai_design_report` (JSONB)
  - **Evidencia:** `supabase/migrations/20260129000002_add_ai_design_report.sql:6`
  - **NO EXISTEN** columnas `evaluation_spec_v2` ni `evaluation_html` como columnas separadas
  - Los datos V2 se guardan dentro de `evaluacion_generada` como JSONB

**sesiones_clase table:**
- **Auditoría anterior mencionaba:** `plan_desarrollo.html_completo`, `plan_desarrollo.titulo`
- **✅ REALIDAD:**
  - Campo: `plan_desarrollo` (JSONB) - estructura completa
  - **Evidencia:** `supabase/migrations/20250923163758_55c12a12-40c6-4eac-8b92-032b9e90ec85.sql:27`
  - Campo adicional: `session_brief` (TEXT)
  - **Evidencia:** `supabase/migrations/20251227003612_add_session_brief_column.sql:5`
  - Campo adicional: `ai_design_report` (JSONB)
  - **Evidencia:** `supabase/migrations/20260129000003_add_sesiones_clase_ai_design_report.sql` (referenciado)
  - El HTML y título están dentro del JSONB `plan_desarrollo`, no como columnas separadas

**teacher_materials table:**
- **✅ CORRECTO:** `extracted_text` (TEXT)
- **Evidencia:** `supabase/migrations/20260128000006_add_extracted_text_to_materials.sql:10`

---

## Hechos Verificados

### 1. Inventario Autoritativo de Edge Functions

**Total: 6 Edge Functions**

| Función | Path | Llama OpenAI? | Evidencia |
|---------|------|---------------|-----------|
| `generate-plan-completo` | `supabase/functions/generate-plan-completo/index.ts` | ✅ SÍ | Línea 336-350: `fetch('https://api.openai.com/v1/chat/completions')` |
| `modify-evaluation` | `supabase/functions/modify-evaluation/index.ts` | ✅ SÍ | Línea 2311: `fetch('https://api.openai.com/v1/chat/completions')` (path universal), Línea 3401 (path legacy) |
| `modify-evaluation-v2` | `supabase/functions/modify-evaluation-v2/index.ts` | ✅ SÍ | Línea 724: `fetchWithTimeout('https://api.openai.com/v1/chat/completions')` |
| `generate-bulletin-text` | `supabase/functions/generate-bulletin-text/index.ts` | ✅ SÍ | Línea 108: `fetch('https://api.openai.com/v1/chat/completions')` |
| `extract-material-text` | `supabase/functions/extract-material-text/index.ts` | ❌ NO | Usa `unpdf` library (PDF.js para Deno), no OpenAI |
| `ensure-demo-users` | `supabase/functions/ensure-demo-users/index.ts` | ❌ NO | Solo crea/actualiza usuarios demo en Supabase Auth |

**Resumen:** 4 de 6 funciones usan OpenAI.

---

### 2. Inventario Autoritativo de Llamadas desde Frontend

**Total: 20+ call sites encontrados**

#### Llamadas a `generate-plan-completo`:

1. **`src/pages/PlanificacionWorkspace.tsx:315`**
   - Función: `handleRegenerarSesion()`
   - Payload: `modo`, `sesionId`, `orden`, `duracionMin`, `materia`, `nivel`, `contenidos`, `competencias`, `criterios`, `perfilGrupo`, `estudiantes`, `instruccionesDocente`, `planActual`, `unitContext`, `sessionBrief`, `materialsContext`

2. **`src/pages/PlanificacionWizard.tsx:578`**
   - Función: `generarPlanesAutomaticamente()`
   - Payload: Similar al anterior, generado en batch para múltiples sesiones

3. **`src/components/planificacion/EditorSesionTabs.tsx:372`**
   - Función: `handleSolicitarModificacion()`
   - Payload: `modo: 'regenerar'`, `planActual`, `modification`, etc.

4. **`src/components/planificacion/EditorSesionTabs.tsx:468`**
   - Función: `handlePedirCambiosIA()`
   - Payload: Similar, con `type: 'html_plan'`

5. **`src/components/planificacion/EditorSesionNuevo.tsx:360`**
   - Función: `handleGenerarPlan()`
   - Payload: Datos de sesión nueva

6. **`src/components/planificacion/EditorSesionNuevo.tsx:495`**
   - Función: Similar, regeneración

7. **`src/hooks/useFullSessionGeneration.ts:294`**
   - Función: `generateAIPlan()` (interno)
   - Payload: Datos de sesión con contexto de unidad

#### Llamadas a `modify-evaluation` (V1):

1. **`src/pages/EvaluacionesGrupo.tsx:794`**
   - Función: `handleGenerarEvaluacion()`
   - Payload: `modification`, `groupContext`, `evaluation_design_plan`, `type`, `adaptationLevel`

2. **`src/pages/EvaluacionesGrupo.tsx:1203`**
   - Función: Fallback cuando V2 falla
   - Payload: Similar

3. **`src/pages/EvaluacionesGrupo.tsx:1598`**
   - Función: `handleAjustarEvaluacion()`
   - Payload: Modificación de evaluación existente

4. **`src/pages/EvaluacionesGrupo.tsx:1678`**
   - Función: Similar, otro punto de ajuste

5. **`src/pages/EvaluacionesGrupo.tsx:1774`**
   - Función: Similar, otro punto de ajuste

6. **`src/services/evaluations/requestService.ts:307`**
   - Función: `requestV1()`
   - Payload: `modification`, `groupContext`, `evaluation_design_plan`

7. **`src/hooks/useFullSessionGeneration.ts:294`**
   - Función: `generateAIPlan()` - usa `modify-evaluation` con `type: 'html_plan'`
   - Payload: Datos de planificación

8. **`src/hooks/useAIPlanification.ts:39`**
   - Función: `generateSuggestions()`
   - Payload: `type: 'planning'`, `modification`, `groupContext`

9. **`src/hooks/useAIPlanification.ts:97`**
   - Función: `modifySuggestions()`
   - Payload: Similar

10. **`src/components/planificacion/EditorSesionTabs.tsx:551`**
    - Función: `handlePedirCambiosIA()`
    - Payload: `type: 'html_plan'`, `prompt`

11. **`src/components/EnhancedEvaluationGenerator.tsx:61`**
    - Función: Generación de evaluación
    - Payload: Datos de evaluación

12. **`src/components/EnhancedEvaluationGenerator.tsx:142`**
    - Función: Similar

13. **`src/components/EnhancedEvaluationGenerator.tsx:399`**
    - Función: Similar

14. **`src/components/EnhancedEvaluationGenerator.tsx:473`**
    - Función: Similar

#### Llamadas a `modify-evaluation-v2`:

1. **`src/pages/EvaluacionesGrupo.tsx:1133`**
   - Función: `handleGenerarEvaluacion()` (cuando `useBeta: true`)
   - Payload: `mode`, `modification`, `groupContext`, `evaluation_design_plan`, `currentEvaluationSpec`, `adjustmentDetails`

2. **`src/services/evaluations/requestService.ts:353`**
   - Función: `requestV2()`
   - Payload: `modification`, `groupContext`, `evaluation_design_plan`

3. **`src/components/evaluaciones/v2/EvaluationAdjustmentsPanel.tsx:248`**
   - Función: `handleAdjustEvaluation()`
   - Payload: `mode: 'adjust'`, `currentEvaluationSpec`, `adjustmentDetails`, `modification`

#### Llamadas a `generate-bulletin-text`:

1. **`src/hooks/useBulletinGenerator.ts:40`**
   - Función: `generateBulletinText()`
   - Payload: `student`, `period`, `contemplaciones`, `academicHistory`, `qualitativeComments`, `customAspects`

#### Llamadas a `extract-material-text`:

1. **`src/services/materials/materials.ts:338`**
   - Función: `extractMaterialText()`
   - Método: `fetch()` directo (no `supabase.functions.invoke`)
   - URL: `${VITE_SUPABASE_URL}/functions/v1/extract-material-text`
   - Payload: `materialId` en body

#### Llamadas a `ensure-demo-users`:

1. **`src/pages/PlanificacionWizard.tsx:948`**
   - Función: `handleSubmit()`
   - Payload: Ninguno (solo verifica/crea usuario demo)

2. **`src/contexts/AuthContext.tsx:53`**
   - Función: `ensureSupabaseAuth()`
   - Payload: Ninguno

---

### 3. Biblioteca de Prompts (Autoritativa)

#### Prompt P1: Planificación de Clases (generate-plan-completo)

- **ID:** P1
- **Archivo:** `supabase/functions/generate-plan-completo/index.ts`
- **Función:** Template inline (líneas 229-333)
- **Propósito:** Generar plan de clase completo en HTML
- **Inputs Incluidos:**
  - `modo` (generar/regenerar)
  - `sesionId`, `orden`, `duracionMin`
  - `materia`, `nivel`
  - `contenidos` (array)
  - `competencias`, `criterios` (arrays)
  - `perfilGrupo` (tamaño, dominante, distribución)
  - `estudiantes` (array con perfil, ajustes, contemplaciones)
  - `instruccionesDocente` (texto libre)
  - `planActual` (HTML existente, si regenerar)
  - `unitContext` (clase X de Y, contexto de secuencia)
  - `sessionBrief` (override del docente)
  - `materialsContext` (texto extraído de PDFs)
- **Output Esperado:** JSON con `plan_html`, `argumento_competencias`, `recursos`, `titulo`, `ai_design_report`
- **System Message:** "Eres un asistente pedagógico experto." (línea 345)
- **Tipo:** Hardcoded template con interpolación directa

---

#### Prompt P2: Evaluaciones V2 - System Prompt

- **ID:** P2
- **Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`
- **Función:** `buildV2SystemPrompt()` (líneas 420-548)
- **Propósito:** Instrucciones del sistema para generación de evaluación estructurada JSON
- **Inputs Dinámicos:**
  - `responseOptionsInclude` (boolean)
  - `responseOptionCount` (number: 2 o 3)
  - `requestedVersions` ({ A, B, C })
- **Output Esperado:** String con instrucciones del sistema
- **Características:**
  - Incluye instrucciones para Versión B si `requestedVersions.B === true` (líneas 425-469)
  - Instrucciones para `equivalentResponseOptions` si `responseOptionsInclude === true` (líneas 488-492)
  - Schema JSON requerido (líneas 494-529)
  - Tipos de items permitidos (líneas 531-545)

---

#### Prompt P3: Evaluaciones V2 - User Prompt

- **ID:** P3
- **Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`
- **Función:** `buildV2UserPrompt()` (líneas 550-599)
- **Propósito:** Contexto del grupo y requerimientos para generación
- **Inputs Incluidos:**
  - `groupContext` (subject, groupName, content, competencies, criteriosLogro, students)
  - `modification` (texto libre del docente) ⚠️ **PROMPT INJECTION RISK**
  - `instrumentDesignRules` (array de strings)
  - `requestedVersions` ({ A, B, C })
- **Output Esperado:** String con prompt del usuario
- **Tipo:** Template con interpolación directa

---

#### Prompt P4: Evaluaciones V1 - Universal Path System Prompt

- **ID:** P4
- **Archivo:** `supabase/functions/modify-evaluation/index.ts`
- **Función:** Template inline (líneas 2144-2203)
- **Propósito:** Generar evaluación universal (Versión A, opcionalmente B/C)
- **Inputs Incluidos:**
  - `groupContext` (subject, content, competencies, etc.)
  - `modification` (texto libre) ⚠️ **PROMPT INJECTION RISK**
  - `evaluation_design_plan` (plan estructurado)
  - `requestedVersions` (A, B, C)
- **Output Esperado:** HTML de evaluación con delimitadores para versiones
- **Tipo:** Hardcoded template muy largo

---

#### Prompt P5: Evaluaciones V1 - Universal Path User Prompt

- **ID:** P5
- **Archivo:** `supabase/functions/modify-evaluation/index.ts`
- **Función:** Template inline (líneas 2204-2236)
- **Propósito:** Contexto específico para generación universal
- **Inputs:** Similar a P4
- **Tipo:** Hardcoded template

---

#### Prompt P6: Evaluaciones V1 - Chat Mode System Prompt

- **ID:** P6
- **Archivo:** `supabase/functions/modify-evaluation/index.ts`
- **Función:** Template inline (líneas 3022-3034)
- **Propósito:** Chat inteligente para ayudar a docentes
- **Inputs:** `groupContext` (subject, content, students, groupName)
- **Output Esperado:** Respuesta de chat (texto libre)
- **Tipo:** Hardcoded template corto

---

#### Prompt P7: Evaluaciones V1 - Chat Mode User Prompt

- **ID:** P7
- **Archivo:** `supabase/functions/modify-evaluation/index.ts`
- **Función:** Template inline (líneas 3036-3038)
- **Propósito:** Mensaje del usuario para chat
- **Inputs:** `modification` (texto libre del docente) ⚠️ **PROMPT INJECTION RISK**
- **Output Esperado:** Respuesta de chat
- **Tipo:** Template simple

---

#### Prompt P8: Evaluaciones V1 - HTML Plan Mode System Prompt

- **ID:** P8
- **Archivo:** `supabase/functions/modify-evaluation/index.ts`
- **Función:** Template inline (líneas 3042-3049)
- **Propósito:** Generar plan HTML puro (sin Markdown)
- **Inputs:** `customPrompt` (texto libre) ⚠️ **PROMPT INJECTION RISK**
- **Output Esperado:** HTML válido
- **Tipo:** Hardcoded template corto

---

#### Prompt P9: Boletín - System Prompt

- **ID:** P9
- **Archivo:** `supabase/functions/generate-bulletin-text/index.ts`
- **Función:** Template inline (líneas 22-86)
- **Propósito:** Generar texto de boletín para Historia 9º grado
- **Inputs:** Ninguno (hardcoded, específico para Historia)
- **Output Esperado:** Texto de boletín (90-140 palabras)
- **Tipo:** Hardcoded, 86 líneas, específico para Historia
- **⚠️ DEBILIDAD:** No es genérico, solo funciona para Historia

---

#### Prompt P10: Boletín - User Prompt

- **ID:** P10
- **Archivo:** `supabase/functions/generate-bulletin-text/index.ts`
- **Función:** Template inline (líneas 88-106)
- **Propósito:** Datos del estudiante para generación de boletín
- **Inputs Incluidos:**
  - `student` (name, perfil)
  - `period` (texto)
  - `contemplaciones` (array)
  - `academicHistory` (texto)
  - `qualitativeComments` (array, limitado a primeros 2)
  - `customAspects` (texto libre) ⚠️ **PROMPT INJECTION RISK**
- **Output Esperado:** Texto de boletín
- **Tipo:** Template con interpolación directa

---

#### Prompt P11: Evaluaciones V2 - Adjustment Mode Section

- **ID:** P11
- **Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`
- **Función:** `buildAdjustmentSection()` (líneas 879-983)
- **Propósito:** Instrucciones para modo ajuste (refinamiento de evaluación existente)
- **Inputs Incluidos:**
  - `currentSpec` (EvaluationSpecV2 completo)
  - `adjustmentDetails` (targetVersions, scope, sectionId, itemId)
  - `teacherAdjustmentText` (texto libre) ⚠️ **PROMPT INJECTION RISK**
- **Output Esperado:** Sección adicional para user prompt
- **Tipo:** Builder function que construye sección de prompt

---

**Resumen de Prompts:**
- **Total:** 11 prompts identificados
- **Con Prompt Injection Risk:** P3, P4, P5, P7, P8, P10, P11 (7 de 11)
- **Hardcoded (no genérico):** P9 (solo Historia)
- **Builders (funciones):** P2, P3, P11
- **Templates inline:** P1, P4, P5, P6, P7, P8, P9, P10

---

### 4. Verificación de equivalentResponseOptions

**✅ VERIFICADO:**

**Definición en Types:**
- **Archivo:** `src/services/evaluations/v2Types.ts:111`
- **Tipo:** `EquivalentResponseOptions?` (opcional)
- **Estructura:**
  ```typescript
  {
    enabled: boolean;
    options: Array<{
      id: string;
      format: string;
      description: string;
    }>;
    metacognitionText: string;
  }
  ```

**Uso en Prompts:**
- **Archivo:** `supabase/functions/modify-evaluation-v2/index.ts:490`
- **Línea:** 490-492
- **Condición:** Solo si `responseOptionsInclude === true`
- **Restricción:** "Items de desarrollo (essay, paragraph) DEBEN incluir equivalentResponseOptions"
- **Evidencia:** Línea 538 también menciona: "essay: Puede incluir 'guidingQuestions', 'equivalentResponseOptions'"

**Consumo en Frontend:**
- **Archivo:** `src/services/evaluations/v2Normalizer.ts:306`
- **Función:** Normaliza `equivalentResponseOptions` si existe

**Conclusión:**
- ✅ **EXISTE** en el sistema
- ✅ **LIMITADO** a items tipo `essay` y `paragraph` (items de desarrollo)
- ⚠️ **NO se aplica** a otros tipos como `multiple_choice`, `true_false`, etc.

---

### 5. Verificación de Estructura de Datos

**evaluaciones table:**
- ✅ **Campo principal:** `evaluacion_generada` (JSONB)
  - **Evidencia:** `supabase/migrations/20251222000000_add_evaluaciones_explicit_save.sql:31`
  - **Uso en código:** `src/pages/EvaluacionesGrupo.tsx:606` - guarda `evaluacion_generada: { evaluation_bundle, ... }`
- ✅ **Campo adicional:** `ai_design_report` (JSONB)
  - **Evidencia:** `supabase/migrations/20260129000002_add_ai_design_report.sql:6`
- ❌ **NO EXISTEN:** `evaluation_spec_v2`, `evaluation_html` como columnas separadas
  - Los datos V2 se guardan dentro de `evaluacion_generada` como JSONB

**sesiones_clase table:**
- ✅ **Campo:** `plan_desarrollo` (JSONB)
  - **Evidencia:** `supabase/migrations/20250923163758_55c12a12-40c6-4eac-8b92-032b9e90ec85.sql:27`
  - **Estructura interna:** Contiene `html_completo`, `titulo`, `recursos`, etc. como propiedades del JSONB
- ✅ **Campo:** `session_brief` (TEXT)
  - **Evidencia:** `supabase/migrations/20251227003612_add_session_brief_column.sql:5`
- ✅ **Campo:** `ai_design_report` (JSONB)
  - **Evidencia:** Referenciado en migraciones (20260129000003)

**teacher_materials table:**
- ✅ **Campo:** `extracted_text` (TEXT)
  - **Evidencia:** `supabase/migrations/20260128000006_add_extracted_text_to_materials.sql:10`

---

## Afirmaciones No Verificadas

### UNV1: Deployment en Producción

**Afirmación:** "Frontend: Render.com (aulaplus.onrender.com)"

**Estado:** ✅ **VERIFICADO PARCIALMENTE**
- ✅ Configuración en `vite.config.ts` confirma Render
- ❓ **NO VERIFICADO:** Si realmente está desplegado en Render o si es solo configuración
- **Cómo Confirmar:** Revisar documentación de deployment, CI/CD configs, o preguntar al equipo

---

### UNV2: Límites de Timeout de Supabase

**Afirmación:** "Supabase Edge Functions: Pro plans have ~150s limit, free plans ~60s"

**Estado:** ❓ **NO VERIFICADO**
- No hay evidencia en código de estos límites
- **Evidencia encontrada:** `modify-evaluation-v2/index.ts:17-24` menciona estos límites en comentarios, pero no hay verificación
- **Cómo Confirmar:** Revisar documentación oficial de Supabase o verificar en dashboard

---

### UNV3: Costos de Modelos OpenAI

**Afirmación:** "gpt-4.1-2025-04-14 es más caro que gpt-4o-mini"

**Estado:** ❓ **NO VERIFICADO**
- No hay evidencia en código de precios
- **Cómo Confirmar:** Revisar precios actuales en OpenAI pricing page

---

## Mapa de IA Actualizado (Corregido)

### Resumen de Edge Functions y OpenAI

| Edge Function | Modelo(s) | Endpoint | Response Format | Max Tokens | Temperature | Timeout Config |
|---------------|-----------|----------|-----------------|------------|-------------|----------------|
| `generate-plan-completo` | `gpt-4o-mini` | `/v1/chat/completions` | Default (text) | Default | 0.7 | Retry: 3 intentos, 2s base |
| `modify-evaluation` (universal) | `gpt-4.1-2025-04-14` | `/v1/chat/completions` | Default (delimiters) | 6000 | No especificado | Retry con backoff |
| `modify-evaluation` (chat) | `gpt-5-mini-2025-08-07` | `/v1/chat/completions` | Default (text) | 4000 | No especificado | Retry con backoff |
| `modify-evaluation` (legacy) | `gpt-4.1-2025-04-14` | `/v1/chat/completions` | Default (HTML) | No especificado | Variable (0.7-0.9) | Retry con backoff |
| `modify-evaluation-v2` | `gpt-4.1-2025-04-14` | `/v1/chat/completions` | `{type: 'json_object'}` | 4000-6000 | Default | 55s (gen), 45s (retry), 30s (adjust) |
| `generate-bulletin-text` | `gpt-4.1-2025-04-14` | `/v1/chat/completions` | Default (text) | 400 | 0.7 | No retry |
| `extract-material-text` | N/A (unpdf) | N/A | N/A | N/A | N/A | N/A |
| `ensure-demo-users` | N/A | N/A | N/A | N/A | N/A | N/A |

---

### Resumen de Prompts

| ID | Ubicación | Tipo | Inputs Dinámicos | Prompt Injection Risk | Específico para Materia |
|----|-----------|------|------------------|------------------------|--------------------------|
| P1 | generate-plan-completo | Template inline | 10+ | ⚠️ Sí (instruccionesDocente, sessionBrief) | ❌ No |
| P2 | modify-evaluation-v2 | Builder function | 3 | ❌ No | ❌ No |
| P3 | modify-evaluation-v2 | Builder function | 4 | ⚠️ Sí (modification) | ❌ No |
| P4 | modify-evaluation | Template inline | 4 | ⚠️ Sí (modification) | ❌ No |
| P5 | modify-evaluation | Template inline | 4 | ⚠️ Sí (modification) | ❌ No |
| P6 | modify-evaluation | Template inline | 1 | ❌ No | ❌ No |
| P7 | modify-evaluation | Template inline | 1 | ⚠️ Sí (modification) | ❌ No |
| P8 | modify-evaluation | Template inline | 1 | ⚠️ Sí (customPrompt) | ❌ No |
| P9 | generate-bulletin-text | Template inline | 0 | ❌ No | ✅ Sí (Historia) |
| P10 | generate-bulletin-text | Template inline | 6 | ⚠️ Sí (customAspects) | ❌ No |
| P11 | modify-evaluation-v2 | Builder function | 3 | ⚠️ Sí (teacherAdjustmentText) | ❌ No |

**Total:** 11 prompts, 7 con riesgo de prompt injection, 1 específico para materia.

---

### Resumen de Estructura de Datos

| Tabla | Campo Principal | Tipo | Estructura Interna | Evidencia |
|-------|-----------------|------|-------------------|-----------|
| `evaluaciones` | `evaluacion_generada` | JSONB | `{ evaluation_bundle, evaluation_design_plan, ... }` | Migration 20251222000000 |
| `evaluaciones` | `ai_design_report` | JSONB | `{ inputsUsed, decisions, assumptions }` | Migration 20260129000002 |
| `sesiones_clase` | `plan_desarrollo` | JSONB | `{ html_completo, titulo, recursos, ... }` | Migration 20250923163758 |
| `sesiones_clase` | `session_brief` | TEXT | Texto libre | Migration 20251227003612 |
| `sesiones_clase` | `ai_design_report` | JSONB | Similar a evaluaciones | Migration 20260129000003 |
| `teacher_materials` | `extracted_text` | TEXT | Texto plano extraído | Migration 20260128000006 |

---

## Conclusiones del Seguimiento

### Correcciones Críticas

1. **Deployment:** Solo Render, no Vercel
2. **Modelos:** `modify-evaluation` usa `gpt-5-mini-2025-08-07` para chat mode (nuevo hallazgo)
3. **Estructura DB:** `evaluacion_generada` es JSONB, no columnas separadas `evaluation_spec_v2`/`evaluation_html`
4. **Estructura DB:** `plan_desarrollo` es JSONB con estructura interna, no columnas separadas

### Verificaciones Exitosas

1. ✅ Todos los edge functions identificados correctamente
2. ✅ Todos los call sites del frontend mapeados
3. ✅ Todos los prompts identificados con ubicaciones exactas
4. ✅ `equivalentResponseOptions` confirmado y limitado a essay/paragraph
5. ✅ Modelos y configuraciones de OpenAI verificadas

### Riesgos Confirmados

1. ⚠️ **7 de 11 prompts** tienen riesgo de prompt injection
2. ⚠️ **1 prompt hardcoded** para Historia (no genérico)
3. ⚠️ **No hay sanitización** de inputs antes de interpolar en prompts

---

**Fin del Documento de Seguimiento**
