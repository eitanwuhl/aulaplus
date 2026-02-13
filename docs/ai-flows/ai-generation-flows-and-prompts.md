# Flujos de Generación con IA en AulaPlus

**Audiencia:** Desarrolladores no expertos / Product Owners  
**Propósito:** Entender cómo funcionan las características con IA antes de mejorarlas  
**Última actualización:** 2025-01-XX

---

## Tabla de Contenidos

1. [Generación de Planes de Clase](#1-generación-de-planes-de-clase)
2. [Generación de Evaluaciones (V1 - Legacy)](#2-generación-de-evaluaciones-v1---legacy)
3. [Generación de Evaluaciones (V2 - Structured JSON)](#3-generación-de-evaluaciones-v2---structured-json)
4. [Generación de Textos de Boletín](#4-generación-de-textos-de-boletín)
5. [Extracción de Texto de PDFs](#5-extracción-de-texto-de-pdfs)

---

## 1. Generación de Planes de Clase

### ¿Qué hace el docente?

El docente crea una planificación completa para un período (ej: trimestre). Esto puede pasar de dos formas:

**Opción A: Wizard de Planificación Nueva**
1. Navega a `/planificacion/nuevo`
2. Completa un formulario paso a paso:
   - Selecciona materia (ej: "Historia")
   - Selecciona grupo (ej: "9no 1")
   - Define fechas de inicio y fin
   - Selecciona unidades didácticas (temas a cubrir)
   - Configura distribución de modalidades (individual, pareja, grupos)
3. Al finalizar, hace click en "Generar Planificación"
4. El sistema genera automáticamente un plan para cada sesión de clase

**Opción B: Regenerar Plan de Sesión Individual**
1. Navega a una planificación existente (`/planificacion/:id`)
2. Abre una sesión específica en el editor
3. Hace click en "Regenerar Plan" o escribe instrucciones de modificación
4. El sistema regenera solo ese plan

---

### Punto de Entrada en el Frontend

**Archivo principal:** `src/pages/PlanificacionWizard.tsx`

**Para generación automática (Wizard):**
- **Función:** `generarPlanesAutomaticamente()` (línea ~570)
- **Qué hace:** Itera sobre todas las sesiones y genera planes en batch
- **Llamada:** `supabase.functions.invoke('generate-plan-completo', { body: payload })`

**Para regeneración individual:**
- **Archivo:** `src/pages/PlanificacionWorkspace.tsx` o `src/components/planificacion/EditorSesionTabs.tsx`
- **Función:** `handleRegenerarSesion()` o `handleSolicitarModificacion()`
- **Llamada:** Misma edge function, pero con `modo: 'regenerar'`

**Hook auxiliar:**
- **Archivo:** `src/hooks/useFullSessionGeneration.ts`
- **Función:** `generateAIPlan()` (línea ~294)
- **Qué hace:** Construye el payload y llama a la edge function (usado internamente)

---

### Preparación de Datos

Antes de llamar a la IA, el sistema recopila información sobre:

#### 1. Información de la Sesión
- **`sesionId`:** ID único de la sesión (si ya existe)
- **`orden`:** Número de sesión (1, 2, 3...)
- **`duracionMin`:** Duración en minutos (ej: 60, 80)
- **`materia`:** Materia (ej: "Historia")
- **`nivel`:** Nivel educativo (ej: "9no grado")

#### 2. Contenido Curricular (ANEP)
- **`contenidos`:** Array de contenidos del programa ANEP (ej: ["Batllismo", "Movimiento obrero"])
- **`competencias`:** Array de competencias a desarrollar (ej: ["Análisis de fuentes históricas"])
- **`criterios`:** Array de criterios de logro (ej: ["Identifica causas y consecuencias"])

#### 3. Contexto de Secuencia Didáctica
- **`unitContext`:** Objeto con:
  - `claseEnUnidad`: Número de clase dentro de la unidad (ej: 2 de 5)
  - `totalClasesUnidad`: Total de clases en la unidad
  - `contenido`: Nombre de la unidad temática
  - `isExtraSlot`: Si es una clase adicional más allá de la secuencia
- **¿Qué significa?** Le dice a la IA si es la primera, intermedia o última clase de una unidad, para que no repita contenido

#### 4. Perfil del Grupo
- **`perfilGrupo`:** Objeto con:
  - `tamanio`: Cantidad de estudiantes
  - `dominante`: Estilo de aprendizaje dominante (ej: "Visual", "Kinestésico", "mixto")
  - `distribucion`: Cuántos estudiantes de cada estilo (ej: { "Visual": 8, "Kinestésico": 5 })
- **¿De dónde viene?** Se calcula automáticamente desde los perfiles de los estudiantes

#### 5. Estudiantes con Ajustes
- **`estudiantes`:** Array de objetos, cada uno con:
  - `perfil`: Estilo de aprendizaje (ej: "Visual-Kinestésico")
  - `ajustes`: Texto libre de ajustes curriculares (ej: "Requiere tiempo adicional")
  - `contemplaciones`: Array de IDs de contemplaciones (ej: ["contemplacion-1", "contemplacion-3"])
- **¿Qué son las contemplaciones?** Son ajustes específicos predefinidos (26 contemplaciones en total), como:
  - `contemplacion-1`: "Lectura oral de consignas"
  - `contemplacion-3`: "Tiempo adicional y pausas"
  - `contemplacion-8`: "Respuesta oral alternativa"
- **¿De dónde vienen?** Se cargan desde localStorage (actualmente) o desde Supabase (futuro)

#### 6. Instrucciones del Docente
- **`instruccionesDocente`:** Texto libre que el docente puede escribir
- **Ejemplo:** "Enfocarse en el análisis de fuentes primarias, evitar memorización"
- **¿Dónde se escribe?** En el wizard de planificación, campo "Requerimientos del docente"

#### 7. Override Específico de Sesión
- **`sessionBrief`:** Tema específico que el docente quiere para esta sesión
- **Ejemplo:** "Surgimiento del Batllismo"
- **¿Qué hace?** Fuerza a la IA a generar el plan alrededor de este tema específico, no genérico

#### 8. Materiales Adjuntos (Opcional)
- **`materialsContext`:** Texto extraído de PDFs que el docente subió
- **¿De dónde viene?** Si el docente adjuntó materiales PDF, se extrae el texto y se incluye en el prompt

**Función que prepara todo esto:**
- **Archivo:** `src/services/groupContext/provider.ts`
- **Función:** `getGroupContextForAI(grupoId, { purpose: 'planning' })`
- **Qué hace:** Carga estudiantes, contemplaciones, y construye el objeto de contexto unificado

---

### Construcción del Prompt

**Archivo:** `supabase/functions/generate-plan-completo/index.ts`

**Líneas:** 229-333 (template del prompt)

**Estructura del Prompt:**

El prompt se construye como un string largo que incluye:

1. **Instrucción base (fija):**
   ```
   "Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP)."
   ```

2. **Contexto de la clase (dinámico):**
   - Materia, nivel, contenidos ANEP, competencias, criterios
   - Todo esto viene de los datos preparados

3. **Sección de sessionBrief (si existe):**
   - Si el docente escribió un `sessionBrief`, se agrega una sección especial que dice:
   - "ENFOQUE ESPECÍFICO DE ESTA SESIÓN (TEACHER OVERRIDE)"
   - Con reglas obligatorias de que TODO el plan debe girar alrededor de este tema

4. **Sección de secuencia didáctica (si existe unitContext):**
   - Explica si es primera, intermedia o última clase
   - Da instrucciones específicas según la posición (ej: "No repetir explicaciones ya dadas")

5. **Sección de perfil del grupo:**
   - Tamaño del grupo, estilo dominante, distribución
   - Reglas pedagógicas obligatorias:
     - "La sección DESARROLLO DEBE incluir AL MENOS DOS decisiones pedagógicas explícitas derivadas del perfil del grupo"
     - Ejemplo: "Estudiantes visuales: actividad dividida en dos bloques de 7 minutos con checklist visual"

6. **Sección de estudiantes con ajustes:**
   - Lista de estudiantes (anonimizados como "Estudiante A", "Estudiante B")
   - Sus contemplaciones específicas
   - Regla: "La sección 'Diferenciación/Adaptaciones' DEBE incluir AL MENOS TRES adaptaciones concretas"

7. **Sección de instrucciones del docente:**
   - Si el docente escribió instrucciones, se incluyen aquí
   - Se le dice a la IA que respete explícitamente estas indicaciones

8. **Sección de materiales (si hay PDFs adjuntos):**
   - Texto extraído de los PDFs
   - Si NO hay contenido ANEP, se le dice a la IA que use SOLO los materiales como fuente

9. **Estructura HTML requerida (fija):**
   - Se le muestra a la IA exactamente qué estructura HTML debe devolver:
     - `<section id="plan">`
     - `<h1>Título</h1>`
     - `<h2><strong>Inicio (15 min)</strong></h2>`
     - `<h2><strong>Desarrollo (X min)</strong></h2>`
     - `<h2><strong>Cierre (5 min)</strong></h2>`
     - `<h2><strong>Diferenciación/Adaptaciones</strong></h2>`

10. **Requisitos estrictos (fija):**
    - "Usar SOLO HTML válido - NO Markdown"
    - "NUNCA incluir 'Diferenciación/Adaptaciones' dentro de Inicio/Desarrollo/Cierre"
    - "Incluir SIEMPRE: <strong>Actividad:</strong> y <strong>Recursos:</strong>"

**System Message (corto):**
- Línea 345: `"Eres un asistente pedagógico experto."`
- Se envía como mensaje del sistema a OpenAI

**User Message (largo):**
- Todo el prompt construido arriba se envía como mensaje del usuario

---

### Solicitud a la IA

**Edge Function:** `generate-plan-completo`

**Archivo:** `supabase/functions/generate-plan-completo/index.ts`

**Líneas:** 336-350 (llamada a OpenAI)

**Modelo usado:** `gpt-4o-mini`

**Endpoint:** `https://api.openai.com/v1/chat/completions`

**Configuración:**
- **Temperature:** 0.7 (balance entre creatividad y consistencia)
- **Max Tokens:** No especificado (usa default de OpenAI)
- **Messages:**
  - System: "Eres un asistente pedagógico experto."
  - User: El prompt completo construido arriba

**Retry Logic:**
- Si falla, reintenta hasta 3 veces
- Delay entre intentos: exponential backoff (1s, 2s, 4s)
- Función: `retryWithBackoff()` (líneas 12-30)

---

### Manejo de la Respuesta de la IA

**Qué devuelve OpenAI:**
- Un objeto JSON con `choices[0].message.content`
- El contenido es un string JSON que contiene:
  ```json
  {
    "plan_html": "<section id='plan'>...</section>",
    "argumento_competencias": "<p>Explicación...</p>",
    "recursos": ["Proyector", "Pizarrón", ...],
    "titulo": "Título de la clase",
    "ai_design_report": { ... }
  }
  ```

**Validación:**
- Líneas 446-520: Verifica que `plan_html` contenga `<section id="plan">`
- Si no es válido, crea un HTML de respaldo (fallback) con estructura básica

**Limpieza:**
- No hay limpieza específica en esta función
- El HTML se usa directamente

**Manejo de Errores:**
- Si OpenAI devuelve error 429 (rate limit): Retry automático
- Si falla después de 3 intentos: Devuelve error al frontend
- Si la respuesta no tiene estructura válida: Crea fallback HTML

---

### Almacenamiento

**Tabla:** `sesiones_clase`

**Campo:** `plan_desarrollo` (tipo JSONB)

**Estructura guardada:**
```json
{
  "html_completo": "<section id='plan'>...</section>",
  "titulo": "Título de la clase",
  "recursos": ["Proyector", "Pizarrón"],
  "argumento_competencias": "<p>...</p>"
}
```

**Otros campos guardados:**
- `ai_design_report` (JSONB): Metadatos de la generación (qué inputs se usaron, decisiones, etc.)
- `session_brief` (TEXT): El override del docente si existe

**Archivo que guarda:**
- `src/pages/PlanificacionWizard.tsx:618` - Construye el `updatePayload` y guarda en Supabase

**Fuente de verdad:**
- El campo `plan_desarrollo.html_completo` es la fuente de verdad
- Si el docente edita manualmente, se actualiza este campo

---

### Renderizado en la UI

**Componente principal:** `src/components/planificacion/EditorSesionTabs.tsx`

**Cómo se muestra:**
1. Se lee `plan_desarrollo.html_completo` de la base de datos
2. Se renderiza usando `dangerouslySetInnerHTML` (React renderiza HTML directamente)
3. El HTML se muestra en una pestaña "Plan de Desarrollo"

**Qué puede hacer el docente:**
1. **Ver el plan:** Se muestra completo con todas las secciones (Inicio, Desarrollo, Cierre, Adaptaciones)
2. **Editar manualmente:** Puede editar el HTML directamente en un editor
3. **Regenerar:** Click en "Regenerar Plan" → vuelve a llamar a la IA
4. **Solicitar modificaciones:** Escribe instrucciones (ej: "Agregar más actividades prácticas") → la IA regenera con esas instrucciones
5. **Cambiar título:** Puede editar el `session_brief` → regenera el plan con ese enfoque

**Componentes relacionados:**
- `EditorSesionNuevo.tsx`: Editor para sesiones nuevas
- `EditorSesionTabs.tsx`: Editor con pestañas (Plan, Recursos, etc.)

---

## 2. Generación de Evaluaciones (V1 - Legacy)

### ¿Qué hace el docente?

1. Navega a `/evaluaciones/nuevo`
2. Selecciona:
   - Grupo (ej: "9no 1")
   - Materia (ej: "Historia")
   - Contenidos a evaluar (del catálogo ANEP)
   - Competencias y criterios de logro
3. Opcionalmente:
   - Solicita Versión B (adaptación de contenido)
   - Solicita Versión C (adaptación excepcional)
   - Solicita opciones de respuesta equivalentes
   - Escribe requerimientos específicos (texto libre)
4. Hace click en "Generar Evaluación"
5. El sistema genera una evaluación completa con preguntas, opciones, y adaptaciones

---

### Punto de Entrada en el Frontend

**Archivo principal:** `src/pages/EvaluacionesGrupo.tsx`

**Función principal:** `handleGenerarEvaluacion()` (línea ~750)

**Flujo:**
1. El componente `EvaluacionesGrupo` renderiza el formulario
2. Cuando el docente hace click en "Generar", se llama a `handleGenerarEvaluacion()`
3. Esta función:
   - Construye el `evaluation_design_plan` (plan de diseño)
   - Decide si usar V1 o V2 (según flag `useBeta`)
   - Llama a `requestEvaluation()` del servicio

**Servicio:**
- **Archivo:** `src/services/evaluations/requestService.ts`
- **Función:** `requestEvaluation(payload, useBeta)`
- **Qué hace:** Decide si llamar a V1 o V2, y maneja la respuesta

**Para V1 (legacy):**
- **Función:** `requestV1()` (línea ~295)
- **Llamada:** `supabase.functions.invoke('modify-evaluation', { body: ... })`

---

### Preparación de Datos

#### 1. Contexto del Grupo
- **`groupContext`:** Objeto con:
  - `subject`: Materia
  - `groupName`: Nombre del grupo
  - `content`: Array de contenidos a evaluar
  - `competencies`: Array de competencias
  - `criteriosLogro`: Array de criterios de logro
  - `students`: Array de estudiantes (anonimizados)

#### 2. Plan de Diseño de Evaluación
- **`evaluation_design_plan`:** Objeto complejo que incluye:
  - **`versionPlans`:** Qué versiones generar (A, B, C)
  - **`assignmentByStudentId`:** Qué estudiante recibe qué versión
  - **`responseOptions`:** Si incluir opciones de respuesta equivalentes
  - **`instrumentDesignRules`:** Reglas de diseño del instrumento (derivadas de contemplaciones)
  - **`perStudentReminders`:** Recordatorios por estudiante (admin, correction)

**¿Cómo se construye el plan de diseño?**
- **Archivo:** `src/services/evaluations/designPlan.ts`
- **Función:** `buildEvaluationDesignPlan(groupContext, teacherRequirementsText)`
- **Qué hace:**
  1. Lee las contemplaciones de cada estudiante
  2. Las mapea a "buckets" (admin reminders, correction reminders, instrument design rules)
  3. Determina si generar Versión B (alta necesidad de estructuración)
  4. Determina si generar Versión C (adecuación de contenido declarada)
  5. Construye los recordatorios para el docente

#### 3. Requerimientos del Docente
- **`modification`:** Texto libre que el docente escribe
- **Ejemplo:** "Incluir al menos 2 preguntas de análisis de fuentes, evitar preguntas de memoria"

#### 4. Tipo de Solicitud
- **`type`:** Puede ser:
  - `'modification'`: Generar evaluación nueva
  - `'chat'`: Chat inteligente para mejorar evaluación
  - `'html_plan'`: Generar plan HTML (usado en planificación)

---

### Construcción del Prompt

**Archivo:** `supabase/functions/modify-evaluation/index.ts`

**Este archivo es MUY LARGO (3635 líneas)** y tiene múltiples paths:

#### Path 1: Universal (Nuevo)
- **Líneas:** 2144-2203 (system prompt), 2204-2236 (user prompt)
- **Cuándo se usa:** Si `generation_mode === 'universal'` o si hay `evaluation_design_plan`
- **Estructura:**
  - System: Instrucciones para generar evaluación universal con versiones A/B/C
  - User: Contexto del grupo, requerimientos, plan de diseño

#### Path 2: Chat Mode
- **Líneas:** 3022-3038
- **Cuándo se usa:** Si `type === 'chat'`
- **Estructura:**
  - System: "Eres un asistente pedagógico especializado en evaluación educativa"
  - User: "El docente dice: '[modification]'"

#### Path 3: HTML Plan Mode
- **Líneas:** 3042-3049
- **Cuándo se usa:** Si `type === 'html_plan'` (usado en planificación, no en evaluaciones)

#### Path 4: Legacy
- **Líneas:** 3378-3635
- **Cuándo se usa:** Si no hay `evaluation_design_plan` y `generation_mode !== 'universal'`
- **Estructura:** Similar al universal pero con lógica más antigua

**Modelo usado:**
- Universal/Legacy: `gpt-4.1-2025-04-14`
- Chat: `gpt-5-mini-2025-08-07` (línea 3378)

**Formato de respuesta:**
- NO usa `json_object` (structured output)
- Usa "delimiter blocks" (bloques delimitados con marcadores especiales)
- Ejemplo: `<!--VERSION_A_START-->...<!--VERSION_A_END-->`

---

### Manejo de la Respuesta de la IA

**Qué devuelve OpenAI:**
- HTML con las versiones A, B, C (si se solicitaron)
- Las versiones están delimitadas con comentarios HTML especiales

**Extracción de Versiones:**
- **Función:** `extractVersionsFromModelOutput()` (línea ~628)
- **Qué hace:** Busca los delimitadores y extrae cada versión
- **Métodos:** Intenta múltiples métodos (delimiters, JSON parsing, regex)

**Limpieza:**
- **Función:** `cleanupContent()` (línea ~29)
- **Qué hace:**
  - Elimina múltiples `<br>` consecutivos
  - Reemplaza `<img>` tags con enlaces de texto
  - Normaliza espacios

**Wrapper Detection:**
- **Función:** `hasWrapperLeak()` (línea ~72)
- **Problema conocido:** A veces OpenAI devuelve JSON wrappers mezclados con HTML
- **Solución:** Detecta y extrae el HTML del wrapper

**Manejo de Errores:**
- Retry con exponential backoff
- Si falla, devuelve HTML de error

---

### Almacenamiento

**Tabla:** `evaluaciones`

**Campo:** `evaluacion_generada` (tipo JSONB)

**Estructura guardada:**
```json
{
  "evaluation_bundle": {
    "versions": {
      "A": "<div>HTML de versión A</div>",
      "B": "<div>HTML de versión B</div>",
      "C": "<div>HTML de versión C</div>"
    }
  },
  "evaluation_design_plan": { ... },
  "student_assignments": {
    "student-1": "A",
    "student-2": "B"
  },
  "teacher_reminders_by_student": [ ... ],
  "ai_report": { ... }
}
```

**Otros campos:**
- `ai_design_report` (JSONB): Metadatos de generación

**Archivo que guarda:**
- `src/pages/EvaluacionesGrupo.tsx:606` - Construye el objeto y guarda en Supabase

---

### Renderizado en la UI

**Componente principal:** `src/components/evaluaciones/EvaluacionVisualRenderer.tsx`

**Cómo se muestra:**
1. Se lee `evaluacion_generada.evaluation_bundle.versions` de la base de datos
2. Se renderiza cada versión (A, B, C) usando `dangerouslySetInnerHTML`
3. Cada versión se muestra en una pestaña o sección separada

**Qué puede hacer el docente:**
1. **Ver las versiones:** Puede ver Versión A, B, C
2. **Ver asignaciones:** Ve qué estudiante recibe qué versión
3. **Ver recordatorios:** Panel con recordatorios por estudiante (ej: "Recordar leer consignas en voz alta para Estudiante A")
4. **Regenerar:** Click en "Regenerar" → vuelve a llamar a la IA
5. **Ajustar:** Escribe instrucciones de ajuste → la IA modifica la evaluación existente
6. **Editar manualmente:** Puede editar el HTML directamente
7. **Exportar a PDF:** Puede generar PDF de la evaluación

**Componentes relacionados:**
- `TeacherRemindersPanel.tsx`: Muestra recordatorios por estudiante
- `VersionPersonalization.tsx`: Muestra asignaciones de versiones
- `AIDesignReport.tsx`: Muestra el reporte de IA (qué se usó, decisiones, etc.)

---

## 3. Generación de Evaluaciones (V2 - Structured JSON)

### ¿Qué hace el docente?

**Igual que V1**, pero el sistema usa un endpoint diferente que devuelve JSON estructurado en lugar de HTML.

**Diferencia clave:** El docente no nota la diferencia en la UI, pero internamente:
- V2 devuelve JSON estructurado (más fácil de validar y procesar)
- V1 devuelve HTML libre (más flexible pero más difícil de validar)

**Cuándo se usa V2:**
- Si el flag `useBeta: true` está activado
- O si V1 falla y hay fallback a V2

---

### Punto de Entrada en el Frontend

**Mismo que V1:** `src/pages/EvaluacionesGrupo.tsx` → `handleGenerarEvaluacion()`

**Servicio:**
- **Archivo:** `src/services/evaluations/requestService.ts`
- **Función:** `requestV2()` (línea ~342)
- **Llamada:** `supabase.functions.invoke('modify-evaluation-v2', { body: ... })`

---

### Preparación de Datos

**Igual que V1:**
- `groupContext`
- `evaluation_design_plan`
- `modification`

**Diferencia:** V2 también acepta:
- `currentEvaluationSpec`: Si se está ajustando una evaluación existente
- `adjustmentDetails`: Detalles del ajuste (scope, targetVersions, etc.)

---

### Construcción del Prompt

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`

**System Prompt:**
- **Función:** `buildV2SystemPrompt()` (línea ~420)
- **Inputs:** `responseOptionsInclude`, `responseOptionCount`, `requestedVersions`
- **Estructura:**
  1. Instrucciones base: "Eres un especialista en evaluación educativa con experiencia en DUA"
  2. Reglas críticas: Solo JSON, sin inferencias de diagnóstico, evidencia siempre escrita
  3. Instrucciones para Versión B (si se solicita): Cómo adaptar contenido pedagógicamente
  4. Instrucciones para opciones de respuesta equivalentes (si se solicita)
  5. Schema JSON requerido: Estructura exacta que debe devolver

**User Prompt:**
- **Función:** `buildV2UserPrompt()` (línea ~550)
- **Inputs:** `groupContext`, `modification`, `instrumentDesignRules`, `requestedVersions`
- **Estructura:**
  1. Contexto del grupo (materia, grupo, contenidos, competencias)
  2. Versiones solicitadas (A siempre, B/C opcionales)
  3. Reglas de diseño del instrumento
  4. Requerimientos del docente
  5. Instrucciones de generación

**Modo Ajuste (si aplica):**
- **Función:** `buildAdjustmentSection()` (línea ~879)
- **Cuándo:** Si `mode === 'adjust'` y hay `currentEvaluationSpec`
- **Qué hace:** Agrega una sección al user prompt con:
  - Cambios solicitados por el docente
  - Evaluación actual a refinar
  - Restricciones (no cambiar IDs, preservar estructura)

---

### Solicitud a la IA

**Edge Function:** `modify-evaluation-v2`

**Modelo usado:** `gpt-4.1-2025-04-14`

**Configuración especial:**
- **Response Format:** `{ type: 'json_object' }` (línea 738)
- **Esto fuerza a OpenAI a devolver solo JSON válido**

**Max Completion Tokens:**
- Primer intento: 6000
- Retry: 4000 (para respuesta más rápida)

**Timeouts:**
- Generación: 55 segundos
- Retry: 45 segundos
- Ajuste: 30 segundos

**Retry Logic:**
- Si timeout o error de parsing: Retry con prompt simplificado (solo Versión A)
- Máximo 2 intentos

---

### Manejo de la Respuesta de la IA

**Qué devuelve OpenAI:**
- JSON estructurado con schema `EvaluationSpecV2`:
  ```json
  {
    "version": "2.0",
    "generatedAt": "2025-01-XX...",
    "meta": { "subject": "...", "gradeLevel": "...", ... },
    "sections": [
      {
        "id": "section-1",
        "title": "Parte 1",
        "items": [
          {
            "id": "item-1",
            "type": "multiple_choice",
            "prompt": "Pregunta...",
            "points": 10,
            "options": [ ... ],
            "versionedContent": {
              "promptB": "Pregunta adaptada..."
            },
            "equivalentResponseOptions": { ... }
          }
        ]
      }
    ],
    "versionVariants": { "A": {...}, "B": {...}, "C": {...} }
  }
  ```

**Validación:**
- **Función:** `validateAndNormalizeSpec()` (línea ~267)
- **Qué valida:**
  - Que sea un objeto válido
  - Que tenga `meta` y `sections`
  - Que cada sección tenga `items`
  - Que Versión B tenga `versionedContent.promptB` si se solicitó
  - Que la estructura coincida con el schema

**Normalización:**
- Si falta `versionVariants`, lo crea
- Si falta `version` o `generatedAt`, los agrega

**Conversión a formato V1:**
- **Función:** `convertV2ToV1Format()` (en `requestService.ts`)
- **Qué hace:** Convierte el JSON estructurado a formato HTML para que la UI pueda renderizarlo igual que V1
- **Por qué:** Para mantener compatibilidad con componentes existentes

---

### Almacenamiento

**Igual que V1:**
- Tabla: `evaluaciones`
- Campo: `evaluacion_generada` (JSONB)

**Estructura guardada:**
```json
{
  "evaluation_spec_v2": { /* JSON completo del spec */ },
  "evaluation_bundle": { /* Versiones convertidas a HTML para UI */ },
  "evaluation_design_plan": { ... },
  "student_assignments": { ... },
  "teacher_reminders_by_student": [ ... ],
  "ai_report": { ... }
}
```

**Diferencia con V1:**
- V2 guarda el JSON estructurado completo en `evaluation_spec_v2`
- También guarda HTML convertido en `evaluation_bundle` para compatibilidad con UI

---

### Renderizado en la UI

**Componente principal:** `src/components/evaluaciones/v2/EvaluationRendererV2.tsx`

**Cómo se muestra:**
1. Se lee `evaluacion_generada.evaluation_spec_v2` de la base de datos
2. Se renderiza usando el JSON estructurado (no HTML)
3. Cada item se renderiza según su tipo (multiple_choice, essay, etc.)

**Ventajas de V2:**
- Renderizado más controlado (cada tipo de item tiene su componente)
- Más fácil de editar campos individuales
- Mejor para futuras funcionalidades (ej: editar solo una pregunta)

**Qué puede hacer el docente:**
- **Igual que V1:** Ver, editar, regenerar, ajustar, exportar
- **Adicional:** Panel de ajustes (`EvaluationAdjustmentsPanel.tsx`) que permite ajustar secciones o items específicos

---

## 4. Generación de Textos de Boletín

### ¿Qué hace el docente?

1. Navega al perfil de un estudiante o a la vista de grupo
2. Hace click en "Generar Texto de Boletín" o similar
3. Opcionalmente:
   - Selecciona período (ej: "Primer trimestre")
   - Escribe aspectos específicos a mencionar (texto libre)
4. El sistema genera un texto de 90-140 palabras listo para usar en el boletín

---

### Punto de Entrada en el Frontend

**Hook:** `src/hooks/useBulletinGenerator.ts`

**Función:** `generateBulletinText(period, customAspects)` (línea ~26)

**Componente que lo usa:**
- `src/components/GeneradorTextosBoletin.tsx`
- O cualquier componente que muestre perfiles de estudiantes

**Llamada:**
- `supabase.functions.invoke('generate-bulletin-text', { body: ... })`

---

### Preparación de Datos

**Datos enviados:**
1. **`student`:** Objeto con:
   - `name`: Nombre del estudiante
   - `perfil`: Estilo de aprendizaje (ej: "Visual-Kinestésico")
   - `evaluacionesCualitativas`: Array de comentarios cualitativos previos

2. **`period`:** Texto del período (ej: "Primer trimestre")

3. **`contemplaciones`:** Array de contemplaciones aplicadas
   - **Nota:** Actualmente usa datos mock (líneas 32-36)
   - Debería cargarse desde localStorage o Supabase

4. **`academicHistory`:** Texto con evolución académica
   - **Nota:** Actualmente usa datos mock (línea 38)
   - Ejemplo: "Historia: 8.5 → 9.0 puntos (mejora significativa)"

5. **`qualitativeComments`:** Array de comentarios cualitativos recientes
   - Se limitan a los primeros 2 (línea 99 en edge function)

6. **`customAspects`:** Texto libre del docente
   - Aspectos específicos que quiere mencionar

---

### Construcción del Prompt

**Archivo:** `supabase/functions/generate-bulletin-text/index.ts`

**System Prompt (líneas 22-86):**
- **Largo:** 86 líneas
- **Específico para:** Historia 9º grado ANEP
- **Estructura:**
  1. Enfoque pedagógico obligatorio para Historia
  2. Conceptos clave transversales
  3. Competencias específicas de Historia
  4. Estructura obligatoria para evaluaciones
  5. Estructura para planificaciones
  6. Lineamientos obligatorios (escribir desde fortalezas, describir dificultades constructivamente, etc.)
  7. Formato (90-140 palabras, 2 párrafos, sin saludo ni firma)
  8. Qué mencionar específicamente en Historia

**User Prompt (líneas 88-106):**
- **Estructura:**
  1. Datos del estudiante (nombre, perfil)
  2. Período
  3. Contemplaciones aplicadas
  4. Historial académico
  5. Comentarios cualitativos (primeros 2)
  6. Aspectos específicos solicitados por el docente (si hay)

**⚠️ Limitación importante:**
- El system prompt está hardcoded para Historia
- No funciona para otras materias sin modificar el código

---

### Solicitud a la IA

**Edge Function:** `generate-bulletin-text`

**Modelo usado:** `gpt-4.1-2025-04-14`

**Configuración:**
- **Max Tokens:** 400 (línea 120)
- **Temperature:** 0.7 (línea 121)

**No hay retry:** Si falla, devuelve error directamente

---

### Manejo de la Respuesta de la IA

**Qué devuelve OpenAI:**
- JSON con `generatedText`: String de 90-140 palabras

**Validación:**
- No hay validación de longitud
- No hay validación de contenido

**Manejo de Errores:**
- Si falla, el hook devuelve un texto de respaldo (fallback) hardcoded
- El texto de respaldo es específico para Historia

---

### Almacenamiento

**⚠️ NO se guarda automáticamente**

El texto generado se muestra en un campo editable, y el docente:
- Puede copiarlo manualmente
- Puede editarlo
- Puede regenerarlo

**No hay persistencia** en base de datos de los textos de boletín generados.

---

### Renderizado en la UI

**Componente:** `src/components/GeneradorTextosBoletin.tsx`

**Cómo se muestra:**
1. Campo de texto editable
2. Muestra el texto generado
3. Botón "Regenerar" para generar nuevo texto
4. Botón "Copiar" para copiar al portapapeles

**Qué puede hacer el docente:**
1. **Ver el texto generado**
2. **Editar manualmente** el texto
3. **Regenerar** con nuevos parámetros
4. **Copiar** al portapapeles para usar en otro sistema

---

## 5. Extracción de Texto de PDFs

### ¿Qué hace el docente?

1. Navega a `/biblioteca-materiales`
2. Sube un archivo PDF
3. El sistema automáticamente extrae el texto del PDF
4. El texto extraído se usa luego en generación de planes de clase

**Nota:** Esta función NO usa IA (OpenAI). Usa una librería de extracción de texto.

---

### Punto de Entrada en el Frontend

**Servicio:** `src/services/materials/materials.ts`

**Función:** `extractMaterialText(materialId)` (línea ~330)

**Llamada:**
- No usa `supabase.functions.invoke()`
- Usa `fetch()` directo a: `${VITE_SUPABASE_URL}/functions/v1/extract-material-text`

---

### Preparación de Datos

**Datos enviados:**
- **`materialId`:** ID del material en la tabla `teacher_materials`

**Autenticación:**
- Se envía el token de sesión en el header `Authorization`
- La edge function verifica que el material pertenezca al usuario

---

### Procesamiento (NO es IA)

**Edge Function:** `extract-material-text`

**Archivo:** `supabase/functions/extract-material-text/index.ts`

**Librería usada:** `unpdf@1.2.2` (PDF.js para Deno)

**Proceso:**
1. Descarga el PDF desde Supabase Storage
2. Convierte a bytes (Uint8Array)
3. Usa `extractText()` de unpdf para extraer texto
4. Limpia el texto (elimina caracteres de control, normaliza espacios)
5. Limita a 20000 caracteres máximo

**Límites:**
- Máximo 5 páginas procesadas (definido pero no aplicado actualmente)
- Máximo 20000 caracteres de texto

---

### Manejo de la Respuesta

**Qué devuelve la función:**
```json
{
  "ok": true,
  "extractedChars": 1234,
  "pagesProcessed": 3
}
```

**Si el PDF está vacío o no tiene texto:**
- Devuelve `extractedChars: 0`
- NO actualiza la base de datos (mantiene NULL)
- Esto permite que la UI detecte que no hay texto extraído

---

### Almacenamiento

**Tabla:** `teacher_materials`

**Campo:** `extracted_text` (tipo TEXT)

**Cuándo se guarda:**
- Solo si `extractedChars > 0`
- Si es 0, se mantiene NULL para que la UI pueda detectar que no hay texto

**Uso posterior:**
- Cuando el docente adjunta este material a una planificación, el texto extraído se incluye en el prompt de generación de planes
- Se pasa como `materialsContext` a `generate-plan-completo`

---

### Renderizado en la UI

**Componente:** `src/pages/BibliotecaMateriales.tsx`

**Cómo se muestra:**
1. Lista de materiales subidos
2. Indicador de si tiene texto extraído
3. Botón "Extraer Texto" si no se ha extraído aún
4. Preview del texto extraído (si existe)

**Qué puede hacer el docente:**
1. **Subir PDFs**
2. **Ver si tiene texto extraído**
3. **Ver preview del texto**
4. **Adjuntar materiales a planificaciones** (el texto se usa automáticamente en prompts)

---

## Resumen de Flujos

### Flujo Completo: Generación de Plan de Clase

```
1. Docente completa wizard → PlanificacionWizard.tsx
2. Sistema carga contexto de grupo → getGroupContextForAI()
   - Lee estudiantes de mockData
   - Lee contemplaciones de localStorage
   - Calcula perfil de grupo
3. Para cada sesión:
   - Construye payload con todos los datos
   - Llama a generate-plan-completo edge function
4. Edge function construye prompt (300+ líneas)
5. Llama a OpenAI (gpt-4o-mini)
6. Recibe JSON con plan_html
7. Valida estructura HTML
8. Guarda en sesiones_clase.plan_desarrollo
9. UI renderiza HTML con dangerouslySetInnerHTML
10. Docente puede editar, regenerar, o continuar
```

### Flujo Completo: Generación de Evaluación (V2)

```
1. Docente completa formulario → EvaluacionesGrupo.tsx
2. Sistema construye evaluation_design_plan → buildEvaluationDesignPlan()
   - Lee contemplaciones de estudiantes
   - Mapea a buckets (admin, correction, instrument design)
   - Determina versiones a generar (A, B, C)
3. Llama a requestEvaluation() → requestService.ts
4. requestV2() llama a modify-evaluation-v2 edge function
5. Edge function construye prompts (system + user)
6. Llama a OpenAI (gpt-4.1-2025-04-14) con response_format: json_object
7. Recibe JSON estructurado (EvaluationSpecV2)
8. Valida estructura con validateAndNormalizeSpec()
9. Convierte a formato V1-compatible para UI
10. Guarda en evaluaciones.evaluacion_generada
11. UI renderiza usando EvaluationRendererV2
12. Docente puede ver versiones, asignaciones, recordatorios, ajustar, exportar
```

### Flujo Completo: Generación de Boletín

```
1. Docente hace click en "Generar Texto" → useBulletinGenerator hook
2. Hook prepara datos (estudiante, período, contemplaciones, historial)
3. Llama a generate-bulletin-text edge function
4. Edge function construye prompt (system hardcoded para Historia + user con datos)
5. Llama a OpenAI (gpt-4.1-2025-04-14) con max_tokens: 400
6. Recibe texto de 90-140 palabras
7. Hook muestra texto en campo editable
8. Docente puede editar, regenerar, o copiar
9. NO se guarda automáticamente (docente copia manualmente)
```

---

## Conceptos Clave Explicados

### ¿Qué son las "Contemplaciones"?

Son ajustes pedagógicos predefinidos que el docente puede asignar a estudiantes. Hay 26 contemplaciones en total, organizadas en categorías:

- **Para clase:** Ajustes que aplican durante las clases
- **Para evaluaciones:** Ajustes que aplican durante las evaluaciones
- **Para ambas:** Ajustes que aplican en ambos contextos

**Ejemplos:**
- `contemplacion-1`: "Lectura oral de consignas" (para evaluaciones)
- `contemplacion-3`: "Tiempo adicional y pausas" (para evaluaciones)
- `contemplacion-8`: "Respuesta oral alternativa" (para evaluaciones)

**¿Dónde se guardan?**
- Actualmente: localStorage con keys como `contemplaciones_clase_${studentId}`
- Futuro: Supabase (tabla `student_contemplaciones`)

**¿Cómo se usan en IA?**
- Se mapean a "buckets" (admin reminders, correction reminders, instrument design rules)
- Se incluyen en prompts para que la IA genere contenido adaptado
- Se convierten en recordatorios para el docente

### ¿Qué es el "Plan de Diseño de Evaluación"?

Es un objeto estructurado que contiene toda la información necesaria para generar una evaluación adaptada:

- **Versiones a generar:** A (universal), B (adaptación de contenido), C (adaptación excepcional)
- **Asignaciones por estudiante:** Qué estudiante recibe qué versión
- **Reglas de diseño:** Cómo debe diseñarse el instrumento (derivadas de contemplaciones)
- **Recordatorios por estudiante:** Qué recordar al docente durante administración y corrección
- **Opciones de respuesta equivalentes:** Si incluir múltiples formatos de respuesta

**¿Quién lo construye?**
- `buildEvaluationDesignPlan()` en `src/services/evaluations/designPlan.ts`
- Se construye automáticamente antes de llamar a la IA

### ¿Qué es "VersionedContent"?

En evaluaciones V2, cada pregunta puede tener múltiples versiones del mismo prompt:

- **`prompt`:** Versión A (universal, para todos)
- **`versionedContent.promptB`:** Versión B (adaptada, vocabulario simplificado)
- **`versionedContent.promptC`:** Versión C (adaptación excepcional)

**Ejemplo:**
- Versión A: "Analiza las causas económicas de la Revolución Industrial y su impacto en la sociedad europea del siglo XVIII."
- Versión B: "Lee con atención. La Revolución Industrial cambió cómo vivía la gente. ¿Cuál fue una causa importante? Recuerda: Una 'causa' es algo que hizo que pasara."

**¿Cuándo se genera Versión B?**
- Si hay estudiantes con alta necesidad de estructuración (detectado por contemplaciones específicas)
- O si el docente explícitamente la solicita

**¿Cuándo se genera Versión C?**
- Si hay estudiantes con adecuación de contenido declarada (flag explícito en `informeTecnico` o localStorage)

### ¿Qué son las "Opciones de Respuesta Equivalentes"?

Son múltiples formatos de respuesta que el estudiante puede elegir, todos equivalentes en dificultad y evidencia:

**Ejemplo:**
- Opción 1: "Ensayo escrito tradicional"
- Opción 2: "Lista estructurada con viñetas"
- Opción 3: "Diagrama visual con anotaciones"

**¿Cuándo se incluyen?**
- Si el docente lo solicita explícitamente en los requerimientos
- O si hay contemplaciones que lo requieren

**¿Limitación actual?**
- Solo se aplica a items tipo `essay` o `paragraph` (items de desarrollo)
- No se aplica a `multiple_choice`, `true_false`, etc.

---

## Preguntas Frecuentes

### ¿Por qué hay dos versiones de generación de evaluaciones (V1 y V2)?

- **V1 (Legacy):** Sistema original, devuelve HTML libre. Más flexible pero difícil de validar.
- **V2 (Nuevo):** Sistema mejorado, devuelve JSON estructurado. Más fácil de validar y procesar, mejor para futuras funcionalidades.

**Estado actual:** Ambos coexisten. V2 es el preferido pero V1 se mantiene por compatibilidad.

### ¿Dónde se guardan los estudiantes y sus contemplaciones?

**Actualmente:**
- Estudiantes: `src/data/mockData.ts` (datos hardcodeados)
- Contemplaciones: localStorage del navegador

**Futuro:**
- Estudiantes: Tabla `students` en Supabase
- Contemplaciones: Tabla `student_contemplaciones` en Supabase

**Proveedor unificado:**
- `src/services/groupContext/provider.ts` abstrae la fuente de datos
- Permite migrar de mock/localStorage a Supabase sin cambiar el código que lo usa

### ¿Qué pasa si la IA devuelve algo inválido?

**Para planes de clase:**
- Si el HTML no tiene estructura válida, se crea un HTML de respaldo (fallback)
- El fallback tiene estructura básica pero funcional

**Para evaluaciones V1:**
- Múltiples métodos de extracción (delimiters, JSON parsing, regex)
- Si todos fallan, se devuelve HTML de error

**Para evaluaciones V2:**
- Validación estricta del JSON
- Si no es válido, retry con prompt simplificado
- Si falla después de 2 intentos, devuelve `success: false` con warnings

### ¿Cómo se manejan los errores de red o timeouts?

**Retry automático:**
- La mayoría de funciones tienen retry con exponential backoff
- Si falla después de varios intentos, se muestra error al usuario

**Timeouts:**
- V2 tiene timeouts configurados (55s, 45s, 30s según modo)
- Si se excede, retry con prompt simplificado

**Fallbacks:**
- Boletín: Texto de respaldo hardcoded
- Evaluaciones: HTML de error
- Planes: HTML de respaldo con estructura básica

---

## Glosario de Términos Técnicos

- **Edge Function:** Función serverless que corre en Supabase. Equivalente a un endpoint de API.
- **JSONB:** Tipo de dato en PostgreSQL que almacena JSON. Permite consultas eficientes.
- **Prompt:** Instrucciones que se envían a la IA. Consta de "system message" (instrucciones del sistema) y "user message" (contexto específico).
- **Temperature:** Parámetro de OpenAI (0-2). Controla creatividad: 0 = muy determinístico, 2 = muy creativo. 0.7 es un balance.
- **Max Tokens:** Límite de tokens que la IA puede generar en su respuesta. 1 token ≈ 4 caracteres.
- **Retry:** Reintento automático si una llamada falla.
- **Exponential Backoff:** Estrategia de retry donde el delay aumenta exponencialmente (1s, 2s, 4s...).
- **Fallback:** Respuesta de respaldo si algo falla.
- **dangerouslySetInnerHTML:** Función de React que renderiza HTML directamente. Se llama "dangerous" porque puede ser un riesgo de seguridad si el HTML viene de fuentes no confiables.

---

**Fin del Documento**
