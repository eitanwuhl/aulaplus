# Plan de Implementación: Modalidades Equivalentes Context-Apropiadas y Reporte Narrativo de IA

**Rama:** `mejorar-evaluaciones`  
**Fecha:** 2025-01-XX  
**Audiencia:** Desarrolladores no expertos

---

## Resumen Ejecutivo

Este plan documenta las mejoras a implementar en el sistema de generación de evaluaciones V2 de AulaPlus:

1. **Modalidades de respuesta equivalentes context-appropriadas:** Extender el sistema actual para generar exactamente 3 modalidades equivalentes por item de comprensión/proceso, seleccionadas según la demanda cognitiva del prompt.

2. **Reporte narrativo de IA:** Reemplazar el formato actual de reporte de IA (checklist estructurado) con un texto narrativo amigable para docentes, tanto para evaluaciones como para planes de clase.

**Restricciones críticas:**
- ✅ Solo modificar V2 (`modify-evaluation-v2`)
- ✅ V1 es legacy y NO debe modificarse
- ✅ Modalidades deben ser context-appropriate (el modelo debe razonar)
- ✅ Reporte debe ser narrativo (texto libre), no checklist

---

## A) Definición de "Comprehension/Process Item"

### Definición Operacional

Un **"comprehension/process item"** es un item de evaluación que requiere que el estudiante:

1. **Procese información** (no solo recuerde)
2. **Construya una respuesta** (no solo seleccione)
3. **Demuestre comprensión** mediante desarrollo escrito

### Tipos de Items que Califican

Basado en `src/services/evaluations/v2Types.ts`, los siguientes tipos son "comprehension/process":

| Tipo | ¿Por qué califica? | Ejemplo de prompt |
|------|---------------------|-------------------|
| `essay` | Requiere desarrollo extenso, argumentación, síntesis | "Explica las causas económicas, políticas y sociales del Batllismo" |
| `paragraph` | Requiere desarrollo breve pero estructurado | "Describe el proceso de industrialización en Uruguay" |
| `source_analysis` | Requiere análisis y procesamiento de información | "Analiza esta fuente histórica y explica su contexto" |
| `true_false_justify` | Requiere justificación escrita (procesamiento) | "Verdadero/Falso: El Batllismo fue un movimiento obrero. Justifica tu respuesta" |

### Tipos que NO Califican

| Tipo | ¿Por qué NO califica? | Nota |
|------|----------------------|------|
| `multiple_choice` | Solo requiere selección, no construcción | No aplica modalidades equivalentes |
| `true_false` | Solo requiere selección binaria | Sin justificación = no procesamiento |
| `short_answer` | Respuesta muy breve, más memoria que comprensión | Puede considerarse en el futuro |
| `table_completion` | Estructura predefinida, no construcción libre | No aplica |
| `matching` | Asociación simple, no construcción | No aplica |
| `ordering` | Secuenciación simple, no construcción | No aplica |

### Criterio de Decisión para el Modelo

El modelo debe identificar un item como "comprehension/process" si:

1. El `type` es `essay`, `paragraph`, `source_analysis`, o `true_false_justify`
2. **Y** el `prompt` contiene verbos de procesamiento cognitivo:
   - **Análisis:** "analiza", "examina", "interpreta", "evalúa"
   - **Síntesis:** "explica", "describe", "desarrolla", "argumenta"
   - **Comparación:** "compara", "contrasta", "relaciona"
   - **Clasificación:** "clasifica", "organiza", "categoriza"
   - **Secuenciación:** "ordena", "secuencia", "establece cronología"
   - **Justificación:** "justifica", "fundamenta", "sustenta"

**Ejemplo de prompt que califica:**
- ✅ "Analiza las causas económicas de la Revolución Industrial"
- ✅ "Compara el Batllismo con el Neobatllismo"
- ✅ "Explica el proceso de industrialización en Uruguay"

**Ejemplo de prompt que NO califica:**
- ❌ "Menciona tres causas de la Revolución Industrial" (memoria, no procesamiento)
- ❌ "Selecciona la opción correcta" (selección, no construcción)

---

## B) Plan de Modelo de Datos

### Estado Actual

El campo `equivalentResponseOptions` ya existe en el tipo `EvaluationItemV2`:

```typescript
// src/services/evaluations/v2Types.ts:111
equivalentResponseOptions?: EquivalentResponseOptions;

// src/services/evaluations/v2Types.ts:38-42
export interface EquivalentResponseOptions {
  enabled: boolean;
  options: EquivalentResponseOption[];
  metacognitionText?: string;
}

// src/services/evaluations/v2Types.ts:32-36
export interface EquivalentResponseOption {
  id: string;
  format: string;
  description: string;
}
```

### Cambios Requeridos (Mínimos, Backward-Compatible)

**No se requieren cambios en el schema TypeScript.** El tipo actual es suficiente.

**Cambios en la generación (Edge Function):**

1. **Garantizar que siempre hay exactamente 3 opciones** cuando `enabled: true`
2. **Agregar validación** para asegurar que las opciones son context-appropriate
3. **Mejorar `metacognitionText`** para explicar por qué estas modalidades son equivalentes

### Estructura Esperada Post-Implementación

```json
{
  "id": "item-5",
  "type": "essay",
  "prompt": "Analiza las causas económicas, políticas y sociales del Batllismo",
  "points": 12,
  "equivalentResponseOptions": {
    "enabled": true,
    "options": [
      {
        "id": "opt-1",
        "format": "essay",
        "description": "Redacta un ensayo argumentativo de 150-200 palabras"
      },
      {
        "id": "opt-2",
        "format": "analysis_table",
        "description": "Completa una tabla de 3 columnas (Económicas | Políticas | Sociales) con causas y efectos"
      },
      {
        "id": "opt-3",
        "format": "titled_outline",
        "description": "Organiza tu respuesta en un esquema con títulos y subtítulos (I. Causas Económicas, II. Causas Políticas, III. Causas Sociales)"
      }
    ],
    "metacognitionText": "Elige UNA opción. Todas evalúan la misma comprensión y tienen la misma dificultad. Solo cambia el formato de respuesta."
  }
}
```

### Compatibilidad Hacia Atrás

- ✅ Items sin `equivalentResponseOptions` siguen funcionando (campo opcional)
- ✅ Items con `enabled: false` se ignoran (comportamiento actual)
- ✅ Items con menos de 3 opciones se validan y se agregan opciones faltantes (nuevo comportamiento)

---

## C) Plan de Cambios en Prompts (V2 Only)

### Archivo a Modificar

**`supabase/functions/modify-evaluation-v2/index.ts`**

### Función 1: `buildV2SystemPrompt`

**Ubicación actual:** Línea ~420

**Cambios requeridos:**

#### 1.1 Sección de Modalidades Equivalentes (Reemplazar líneas 488-492)

**Antes:**
```typescript
## OPCIONES DE RESPUESTA EQUIVALENTES
${responseOptionsInclude ? `
- OBLIGATORIO: Items de desarrollo (essay, paragraph) DEBEN incluir equivalentResponseOptions con ${responseOptionCount} opciones.
- Cada opción representa un formato diferente pero equivalente en evidencia y dificultad.
` : '- NO incluir equivalentResponseOptions en ningún item.'}
```

**Después:**
```typescript
## OPCIONES DE RESPUESTA EQUIVALENTES (CONTEXT-APPROPRIATE)

${responseOptionsInclude ? `
CRÍTICO: Items de comprensión/proceso (essay, paragraph, source_analysis, true_false_justify) DEBEN incluir equivalentResponseOptions con EXACTAMENTE 3 opciones.

REGLAS DE SELECCIÓN DE MODALIDADES:
1. Analiza la demanda cognitiva del prompt:
   - Si el prompt requiere COMPARAR → incluye "comparison_chart" o "double_entry_table"
   - Si el prompt requiere ANALIZAR causas/efectos → incluye "analysis_table" (causa→efecto)
   - Si el prompt requiere EXPLICAR un proceso → incluye "titled_outline" o "brief_written"
   - Si el prompt requiere CLASIFICAR → incluye "double_entry_table" (solo si mapea dos dimensiones)
   - Si el prompt requiere ARGUMENTAR → incluye "essay" o "brief_written"

2. Modalidades permitidas (elige 3 context-appropriate):
   - "brief_written": Respuesta escrita breve/desarrollo corto
   - "titled_outline": Esquema con títulos y subtítulos
   - "analysis_table": Tabla de análisis (causa→efecto, evidencia→interpretación)
   - "double_entry_table": Tabla de doble entrada (SOLO si el prompt requiere mapear dos dimensiones)
   - "comparison_chart": Tabla de comparación (SOLO si el prompt requiere comparar)
   - "true_false_with_justification": V/F con justificación (como modalidad de respuesta, no como tipo de item)
   - "multiple_choice_with_justification": Opción múltiple con justificación (como modalidad de respuesta)
   - "fill_in_blanks_explanation": Completar espacios + explicación (solo si preserva dificultad)

3. NUNCA incluyas una modalidad que no se ajuste a la demanda cognitiva:
   - ❌ NO uses "comparison_chart" si el prompt no requiere comparar
   - ❌ NO uses "double_entry_table" si el prompt no requiere mapear dos dimensiones
   - ❌ NO uses "fill_in_blanks_explanation" si reduce la dificultad

4. Todas las modalidades deben:
   - Evaluar el mismo objetivo de aprendizaje
   - Tener la misma dificultad cognitiva
   - Requerir la misma evidencia de comprensión

EJEMPLO CORRECTO (prompt requiere análisis de causas):
{
  "prompt": "Analiza las causas económicas, políticas y sociales del Batllismo",
  "equivalentResponseOptions": {
    "enabled": true,
    "options": [
      {"id": "opt-1", "format": "essay", "description": "Redacta un ensayo argumentativo"},
      {"id": "opt-2", "format": "analysis_table", "description": "Completa una tabla de 3 columnas (Económicas | Políticas | Sociales)"},
      {"id": "opt-3", "format": "titled_outline", "description": "Organiza tu respuesta en un esquema con títulos"}
    ]
  }
}

EJEMPLO INCORRECTO (prompt NO requiere comparar, pero se incluye comparison_chart):
{
  "prompt": "Explica el proceso de industrialización",
  "equivalentResponseOptions": {
    "options": [
      {"format": "essay"},
      {"format": "comparison_chart"}  // ❌ INCORRECTO: El prompt no requiere comparar
    ]
  }
}
` : '- NO incluir equivalentResponseOptions en ningún item.'}
```

#### 1.2 Actualizar Ejemplo en Schema JSON (Línea ~538)

**Antes:**
```typescript
- essay: Puede incluir "guidingQuestions", "equivalentResponseOptions"
```

**Después:**
```typescript
- essay: Puede incluir "guidingQuestions", "equivalentResponseOptions" (3 opciones context-appropriate)
- paragraph: Puede incluir "equivalentResponseOptions" (3 opciones context-appropriate)
- source_analysis: Puede incluir "equivalentResponseOptions" (3 opciones context-appropriate)
- true_false_justify: Puede incluir "equivalentResponseOptions" (3 opciones context-appropriate)
```

### Función 2: `buildV2UserPrompt`

**Ubicación actual:** Línea ~550

**Cambios requeridos:**

#### 2.1 Agregar Instrucciones Específicas sobre Modalidades (Después de línea ~592)

**Agregar después de la sección "INSTRUCCIONES":**

```typescript
${responseOptionsInclude ? `
## MODALIDADES EQUIVALENTES (CRÍTICO)

Para CADA item de comprensión/proceso (essay, paragraph, source_analysis, true_false_justify):
1. Analiza la demanda cognitiva del prompt:
   - ¿Requiere comparar? → Incluye "comparison_chart" o "double_entry_table"
   - ¿Requiere analizar causas/efectos? → Incluye "analysis_table"
   - ¿Requiere explicar un proceso? → Incluye "titled_outline" o "brief_written"
   - ¿Requiere argumentar? → Incluye "essay" o "brief_written"

2. Genera EXACTAMENTE 3 opciones que:
   - Sean context-appropriate (ajustadas a la demanda cognitiva)
   - Evalúen el mismo objetivo de aprendizaje
   - Tengan la misma dificultad

3. NUNCA incluyas modalidades que no se ajusten:
   - Si el prompt NO requiere comparar → NO uses "comparison_chart"
   - Si el prompt NO requiere mapear dos dimensiones → NO uses "double_entry_table"

4. Incluye un "metacognitionText" que explique por qué estas modalidades son equivalentes.
` : ''}
```

### Función 3: `buildAdjustmentSection`

**Ubicación actual:** Línea ~879

**Cambios requeridos:**

#### 3.1 Agregar Instrucciones sobre Modalidades en Modo Ajuste

**Agregar después de las instrucciones de ajuste existentes:**

```typescript
## MODALIDADES EQUIVALENTES EN AJUSTES

Si el ajuste afecta items de comprensión/proceso:
- Si se agregan nuevos items de comprensión/proceso → Incluye equivalentResponseOptions (3 opciones context-appropriate)
- Si se modifica un prompt existente → Re-evalúa si las modalidades siguen siendo context-appropriate
- Si el prompt cambia de "explicar" a "comparar" → Actualiza las modalidades para reflejar la nueva demanda cognitiva
```

---

## D) Plan de Validación y Normalización

### Archivo a Modificar

**`supabase/functions/modify-evaluation-v2/index.ts`**

### Función: `validateAndNormalizeSpec`

**Ubicación actual:** Línea ~267

**Cambios requeridos:**

#### 1. Validación de Modalidades Equivalentes

**Agregar nueva función de validación:**

```typescript
function validateEquivalentResponseOptions(
  item: EvaluationItemV2,
  warnings: WarningV2[]
): void {
  if (!item.equivalentResponseOptions?.enabled) {
    return; // No validation needed if disabled
  }

  const options = item.equivalentResponseOptions.options || [];
  
  // Validar que hay exactamente 3 opciones
  if (options.length !== 3) {
    warnings.push({
      code: 'INVALID_RESPONSE_OPTIONS_COUNT',
      message: `Item ${item.id} tiene ${options.length} opciones equivalentes, se requieren exactamente 3. Se agregarán opciones faltantes.`,
      severity: 'warning',
      context: { itemId: item.id, currentCount: options.length }
    });
    
    // Normalizar: Agregar opciones faltantes o eliminar excedentes
    if (options.length < 3) {
      // Agregar opciones genéricas faltantes
      const missingCount = 3 - options.length;
      for (let i = 0; i < missingCount; i++) {
        options.push({
          id: `opt-${options.length + i + 1}`,
          format: 'brief_written',
          description: 'Respuesta escrita breve'
        });
      }
    } else {
      // Eliminar excedentes (mantener solo las primeras 3)
      item.equivalentResponseOptions.options = options.slice(0, 3);
    }
  }

  // Validar que las modalidades son context-appropriate (heurística básica)
  const promptLower = item.prompt.toLowerCase();
  const formats = options.map(opt => opt.format.toLowerCase());
  
  // Heurística: Si el prompt requiere comparar, debe haber comparison_chart o double_entry_table
  if ((promptLower.includes('compara') || promptLower.includes('contrasta')) && 
      !formats.some(f => f.includes('comparison') || f.includes('double_entry'))) {
    warnings.push({
      code: 'POTENTIALLY_INAPPROPRIATE_MODALITY',
      message: `Item ${item.id} requiere comparar pero no incluye modalidad de comparación. Revisar manualmente.`,
      severity: 'info',
      context: { itemId: item.id, prompt: item.prompt.substring(0, 100) }
    });
  }

  // Heurística: Si el prompt requiere analizar causas/efectos, debe haber analysis_table
  if ((promptLower.includes('causa') || promptLower.includes('efecto') || promptLower.includes('consecuencia')) &&
      !formats.some(f => f.includes('analysis_table'))) {
    warnings.push({
      code: 'POTENTIALLY_INAPPROPRIATE_MODALITY',
      message: `Item ${item.id} requiere análisis de causas/efectos pero no incluye analysis_table. Revisar manualmente.`,
      severity: 'info',
      context: { itemId: item.id, prompt: item.prompt.substring(0, 100) }
    });
  }
}
```

#### 2. Integrar Validación en `validateAndNormalizeSpec`

**Agregar llamada a validación por item:**

```typescript
// Dentro de validateAndNormalizeSpec, después de validar cada item:
for (const section of spec.sections) {
  for (const item of section.items) {
    // ... validaciones existentes ...
    
    // Nueva validación de modalidades equivalentes
    validateEquivalentResponseOptions(item, warnings);
  }
}
```

### Archivo: `src/services/evaluations/v2Normalizer.ts`

**No se requieren cambios.** El normalizador ya maneja `equivalentResponseOptions` correctamente (líneas 306-322).

---

## E) Plan de UI/UX para Mostrar Modalidades

### Componentes a Modificar/Crear

#### 1. Componente: Mostrar Modalidades en Version A

**Archivo:** `src/components/evaluaciones/v2/EvalItem.tsx`

**Cambios requeridos:**

**Agregar renderizado de modalidades equivalentes:**

```typescript
// Dentro de renderItemContent, después de mostrar el prompt:

if (item.responseOptions?.enabled && item.responseOptions.options.length > 0) {
  return (
    <div className="space-y-4">
      {/* Prompt principal */}
      <div className="prompt-section">
        {item.prompt}
      </div>
      
      {/* Modalidades equivalentes */}
      <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 p-4 rounded-r">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Opciones de Respuesta Equivalentes
        </h4>
        {item.responseOptions.metacognitionText && (
          <p className="text-xs text-muted-foreground mb-3">
            {item.responseOptions.metacognitionText}
          </p>
        )}
        <div className="space-y-2">
          {item.responseOptions.options.map((opt, idx) => (
            <div key={opt.id} className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border">
              <Badge variant="outline" className="text-xs flex-shrink-0">
                Opción {idx + 1}
              </Badge>
              <div className="flex-1">
                <p className="text-sm font-medium">{opt.format}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### 2. Componente: Mostrar Modalidades en Version B

**Mismo componente, pero mostrar `versionedContent.promptB` si existe:**

```typescript
// Si selectedVersion === 'B' y item.versionedContent?.promptB existe:
const displayPrompt = selectedVersion === 'B' && item.versionedContent?.promptB 
  ? item.versionedContent.promptB 
  : item.prompt;

// Las modalidades equivalentes se muestran igual, pero el prompt es el adaptado
```

**Nota importante:** Las modalidades equivalentes son las mismas para Version A y B. Solo cambia el prompt base.

#### 3. Componente: Panel de Selección de Modalidad (Futuro)

**No se implementa en esta fase**, pero se documenta para futuras mejoras:

- Permitir al docente seleccionar qué modalidad quiere mostrar a cada estudiante
- Guardar la selección en `student_assignments` o en un nuevo campo `responseModalityByStudent`

### Iconos y Estilos

**Usar iconos de Lucide React:**
- `Sparkles` para modalidades equivalentes
- `FileText` para formato escrito
- `Table` para tablas
- `List` para esquemas

**Colores:**
- Borde azul (`border-blue-500`) para destacar modalidades
- Fondo azul claro (`bg-blue-50`) para contraste
- Badge outline para opciones

---

## F) Plan de Reporte Narrativo de IA

### Estado Actual

#### Evaluaciones V2

**Archivo:** `supabase/functions/modify-evaluation-v2/index.ts` (línea ~1159)

**Formato actual (estructurado):**
```typescript
aiReport: {
  designRationale: string;  // Texto breve
  versionsExplanation: {
    generated: string[];
    notGenerated?: Record<string, string>;
  };
  contemplacionesApplied: {
    instrumentDesign: string[];
    adminReminders: number;
    correctionReminders: number;
  };
  responseOptions: {
    included: boolean;
    count?: number;
    reason?: string;
  };
  varkSummary?: string;
}
```

#### Planes de Clase

**Archivo:** `supabase/functions/generate-plan-completo/index.ts` (línea ~400)

**Formato actual (estructurado):**
```typescript
ai_design_report: {
  inputsUsed: {
    anepContent: boolean;
    materials: boolean;
    sessionBrief: boolean;
    unitContext: boolean;
  };
  decisions: {
    structure: string;
    timeAllocation: string;
  };
  assumptions: string[];
}
```

### Nuevo Formato: Reporte Narrativo

#### Evaluaciones V2

**Reemplazar el objeto estructurado con un solo campo de texto:**

```typescript
aiReport: {
  narrative: string;  // Texto narrativo completo, amigable para docentes
}
```

**Ejemplo de texto narrativo:**

```
Esta evaluación fue diseñada para el grupo 9no 1 de Historia, enfocándose en los contenidos del Batllismo y el movimiento obrero uruguayo. 

Se generaron dos versiones de la evaluación: la Versión A (universal) para la mayoría de los estudiantes, y la Versión B (adaptación de contenido) para aquellos que requieren simplificación de vocabulario y mayor estructuración. La Versión B mantiene los mismos objetivos de aprendizaje pero presenta las consignas con vocabulario más accesible y oraciones más cortas.

Las competencias evaluadas incluyen el análisis de fuentes históricas y la construcción de argumentos basados en evidencia. Para lograr esto, se incluyeron items de análisis de documentos, preguntas de desarrollo que requieren explicar causas y consecuencias, y actividades que promueven el pensamiento crítico.

Se aplicaron adaptaciones al instrumento basadas en las contemplaciones de los estudiantes, incluyendo la lectura oral de consignas y el tiempo adicional para procesar información. Estas adaptaciones no reducen la dificultad cognitiva, sino que facilitan el acceso al contenido.

Para los items de desarrollo (ensayos y párrafos), se incluyeron opciones de respuesta equivalentes que permiten a los estudiantes elegir el formato que mejor se ajuste a su estilo de aprendizaje, manteniendo la misma evidencia de comprensión. Por ejemplo, para el item sobre las causas del Batllismo, los estudiantes pueden elegir entre redactar un ensayo, completar una tabla de análisis, o organizar su respuesta en un esquema con títulos.

El diseño respeta los requerimientos del docente de enfocarse en el análisis de fuentes primarias y evitar la memorización. Se utilizaron los contenidos del programa ANEP y se alinearon con los criterios de logro especificados.
```

**Longitud sugerida:** 200-400 palabras

#### Planes de Clase

**Reemplazar el objeto estructurado con un solo campo de texto:**

```typescript
ai_design_report: {
  narrative: string;  // Texto narrativo completo, amigable para docentes
}
```

**Ejemplo de texto narrativo:**

```
Este plan de clase fue diseñado para la sesión 3 de la unidad "Batllismo y Movimiento Obrero" en el grupo 9no 1 de Historia. La sesión tiene una duración de 80 minutos y se enfoca en el análisis de fuentes históricas del período batllista.

El plan sigue la estructura estándar de Inicio-Desarrollo-Cierre, con 15 minutos para la apertura, 60 minutos para el desarrollo principal, y 5 minutos para el cierre. En el inicio, se propone una actividad motivadora que recupera conocimientos previos sobre el contexto histórico. El desarrollo se divide en dos partes: primero, la exploración del contenido mediante análisis de documentos históricos, y segundo, la aplicación práctica con actividades de construcción colaborativa. El cierre incluye una síntesis grupal y proyección para la próxima clase.

Se consideraron las características del grupo, que tiene un perfil de aprendizaje predominantemente visual, por lo que se incluyeron apoyos visuales como imágenes de documentos históricos y organizadores gráficos. Las actividades están diseñadas para promover la participación activa y el trabajo colaborativo.

Se aplicaron adaptaciones específicas para estudiantes que requieren tiempo adicional y pausas, así como para aquellos que se benefician de consignas segmentadas. Estas adaptaciones están integradas en cada sección del plan, no como elementos separados.

El plan utiliza los contenidos del programa ANEP sobre el Batllismo y se alinea con las competencias de análisis de fuentes históricas. Se respetaron las instrucciones del docente de enfocarse en el análisis crítico y evitar la memorización. Si se adjuntaron materiales del docente, estos fueron incorporados como recursos complementarios.
```

**Longitud sugerida:** 200-400 palabras

### Cambios en Prompts para Generar Reporte Narrativo

#### Evaluaciones V2

**Agregar nueva función:** `buildNarrativeReportPrompt()`

**Ubicación:** Después de `buildV2UserPrompt` (línea ~599)

```typescript
function buildNarrativeReportPrompt(
  groupContext: {
    subject?: string;
    groupName?: string;
    content?: string[];
    competencies?: string[];
    criteriosLogro?: string[];
  },
  modification: string,
  requestedVersions: { A: boolean; B: boolean; C: boolean },
  instrumentDesignRules: string[],
  responseOptionsIncluded: boolean,
  studentCount: number
): string {
  return `Después de generar la especificación JSON de la evaluación, genera un reporte narrativo amigable para docentes.

El reporte debe ser un texto continuo (no lista de viñetas) que explique:

1. Para qué grupo y materia se diseñó la evaluación
2. Qué contenidos y competencias se están evaluando
3. Qué versiones se generaron (A, B, C) y por qué
4. Cómo se aplicaron las contemplaciones de los estudiantes (adaptaciones al instrumento)
5. Si se incluyeron opciones de respuesta equivalentes, explicar brevemente qué son y cómo funcionan
6. Cómo se respetaron los requerimientos del docente
7. Qué fuentes se utilizaron (contenidos ANEP, materiales del docente, etc.)

IMPORTANTE:
- Escribe en un tono amigable y pedagógico, como si le estuvieras explicando a un colega docente
- NO uses lenguaje técnico innecesario
- NO menciones diagnósticos específicos de estudiantes (solo menciona adaptaciones generales)
- NO uses formato de lista, usa párrafos continuos
- Longitud: 200-400 palabras

El reporte debe ser un campo "narrative" dentro del objeto "aiReport" en tu respuesta JSON.`;
}
```

**Modificar la llamada a OpenAI para incluir el reporte narrativo:**

En `generateEvaluationV2()`, después de recibir la respuesta de OpenAI:

```typescript
// Si la respuesta no incluye aiReport.narrative, generarlo en una segunda llamada
if (!spec.aiReport?.narrative) {
  const narrativePrompt = buildNarrativeReportPrompt(
    groupContext,
    modification,
    requestedVersions,
    instrumentDesignRules,
    responseOptionsInclude,
    totalStudents
  );
  
  // Llamada adicional a OpenAI para generar solo el reporte narrativo
  const narrativeResponse = await callOpenAI(
    systemPrompt: "Eres un asistente pedagógico que explica decisiones de diseño de evaluaciones a docentes.",
    userPrompt: narrativePrompt,
    maxTokens: 500,
    temperature: 0.7
  );
  
  spec.aiReport = {
    narrative: narrativeResponse.content
  };
}
```

#### Planes de Clase

**Modificar el prompt en `generate-plan-completo/index.ts` (línea ~229):**

**Agregar al final del prompt principal:**

```typescript
## REPORTE NARRATIVO DE DISEÑO

Después de generar el plan HTML, genera un reporte narrativo amigable para docentes que explique:

1. Para qué sesión y grupo se diseñó el plan
2. Qué contenidos y competencias se están trabajando
3. Cómo se estructuró el plan (Inicio-Desarrollo-Cierre) y por qué
4. Cómo se consideraron las características del grupo (perfil de aprendizaje, tamaño)
5. Qué adaptaciones se incluyeron y por qué
6. Qué fuentes se utilizaron (contenidos ANEP, materiales del docente, sessionBrief, unitContext)
7. Cómo se respetaron las instrucciones del docente

IMPORTANTE:
- Escribe en un tono amigable y pedagógico
- NO uses lenguaje técnico innecesario
- NO uses formato de lista, usa párrafos continuos
- Longitud: 200-400 palabras

El reporte debe ser un campo "narrative" dentro del objeto "ai_design_report" en tu respuesta JSON.
```

### Cambios en Componentes de UI

#### Evaluaciones V2

**Archivo:** `src/components/evaluaciones/AIDesignReport.tsx`

**Cambios requeridos:**

**Reemplazar el renderizado estructurado con renderizado de texto narrativo:**

```typescript
export function AIDesignReport({ reportData, className = '' }: AIDesignReportProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!reportData) return null;
  
  // Si hay narrative, mostrar solo eso
  if (reportData.narrative) {
    return (
      <Card className={`border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 ${className}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5" />
              Reporte de IA
              <Badge variant="secondary" className="text-xs">Solo docente</Badge>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              {isOpen ? 'Ocultar' : 'Ver detalles'}
            </Button>
          </div>
        </CardHeader>
        
        <Collapsible open={isOpen}>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="prose prose-sm max-w-none">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {reportData.narrative}
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }
  
  // Fallback: Si no hay narrative, mostrar formato antiguo (compatibilidad)
  // ... código existente ...
}
```

**Actualizar interface `AIDesignReportData`:**

```typescript
export interface AIDesignReportData {
  narrative?: string;  // Nuevo campo: reporte narrativo
  // ... campos legacy para compatibilidad ...
  rationale?: string;
  coverageMapping?: { ... };
  // ... etc ...
}
```

#### Planes de Clase

**Archivo:** `src/pages/PlanificacionWorkspace.tsx` o componente similar

**Cambios requeridos:**

**Agregar componente para mostrar reporte narrativo de planes:**

```typescript
// Nuevo componente: PlanningAIDesignReport.tsx
export function PlanningAIDesignReport({ narrative, className = '' }: { narrative?: string; className?: string }) {
  if (!narrative) return null;
  
  return (
    <Card className={`border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5" />
          Reporte de IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none">
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {narrative}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## G) Breakdown de Tareas para Implementación y Testing

### Fase 1: Modalidades Equivalentes Context-Apropiadas

#### Tarea 1.1: Actualizar Prompts del Sistema
- **Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`
- **Función:** `buildV2SystemPrompt`
- **Líneas:** ~488-492, ~538
- **Esfuerzo:** 2 horas
- **Dependencias:** Ninguna
- **Testing:** Generar evaluación con `responseOptionsInclude: true`, verificar que las instrucciones están en el prompt

#### Tarea 1.2: Actualizar Prompts del Usuario
- **Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`
- **Función:** `buildV2UserPrompt`
- **Líneas:** ~592 (después de INSTRUCCIONES)
- **Esfuerzo:** 1 hora
- **Dependencias:** Tarea 1.1
- **Testing:** Generar evaluación, verificar que las instrucciones de modalidades están en el user prompt

#### Tarea 1.3: Agregar Validación de Modalidades
- **Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`
- **Función:** `validateEquivalentResponseOptions` (nueva)
- **Líneas:** Después de `validateAndNormalizeSpec`
- **Esfuerzo:** 3 horas
- **Dependencias:** Tarea 1.1, 1.2
- **Testing:**
  - Generar evaluación con items de comprensión/proceso
  - Verificar que cada item tiene exactamente 3 opciones
  - Verificar que las opciones son context-appropriate (heurística básica)
  - Probar con prompts que requieren comparar → debe incluir comparison_chart
  - Probar con prompts que requieren analizar causas → debe incluir analysis_table

#### Tarea 1.4: Actualizar UI para Mostrar Modalidades
- **Archivo:** `src/components/evaluaciones/v2/EvalItem.tsx`
- **Función:** `renderItemContent`
- **Esfuerzo:** 4 horas
- **Dependencias:** Tarea 1.3
- **Testing:**
  - Generar evaluación con modalidades equivalentes
  - Verificar que se muestran las 3 opciones en Version A
  - Verificar que se muestran las 3 opciones en Version B (con prompt adaptado)
  - Verificar que el `metacognitionText` se muestra correctamente
  - Probar en modo oscuro/claro

#### Tarea 1.5: Testing End-to-End con Grupo Demo
- **Grupo:** "9no1"
- **Esfuerzo:** 2 horas
- **Dependencias:** Todas las tareas 1.1-1.4
- **Testing:**
  1. Crear evaluación para grupo "9no1", materia "Historia"
  2. Seleccionar contenidos: "Batllismo", "Movimiento obrero"
  3. Activar opciones de respuesta equivalentes
  4. Generar evaluación V2
  5. Verificar que:
     - Items `essay` tienen 3 modalidades equivalentes
     - Items `paragraph` tienen 3 modalidades equivalentes
     - Items `source_analysis` tienen 3 modalidades equivalentes (si aplica)
     - Las modalidades son context-appropriate (no hay comparison_chart si el prompt no requiere comparar)
     - Version A y B muestran las mismas modalidades
  6. Verificar en UI que las modalidades se renderizan correctamente

### Fase 2: Reporte Narrativo de IA

#### Tarea 2.1: Actualizar Generación de Reporte para Evaluaciones
- **Archivo:** `supabase/functions/modify-evaluation-v2/index.ts`
- **Función:** `buildNarrativeReportPrompt` (nueva), modificar `generateEvaluationV2`
- **Líneas:** Después de `buildV2UserPrompt`, dentro de `generateEvaluationV2`
- **Esfuerzo:** 4 horas
- **Dependencias:** Ninguna
- **Testing:**
  - Generar evaluación V2
  - Verificar que `aiReport.narrative` existe y es un string
  - Verificar que el texto es narrativo (no lista de viñetas)
  - Verificar que menciona grupo, materia, versiones, contemplaciones, modalidades equivalentes

#### Tarea 2.2: Actualizar Generación de Reporte para Planes
- **Archivo:** `supabase/functions/generate-plan-completo/index.ts`
- **Función:** Modificar prompt principal (línea ~229)
- **Esfuerzo:** 2 horas
- **Dependencias:** Ninguna
- **Testing:**
  - Generar plan de clase
  - Verificar que `ai_design_report.narrative` existe y es un string
  - Verificar que el texto es narrativo
  - Verificar que menciona sesión, grupo, contenidos, competencias, adaptaciones

#### Tarea 2.3: Actualizar Componente de UI para Evaluaciones
- **Archivo:** `src/components/evaluaciones/AIDesignReport.tsx`
- **Función:** `AIDesignReport`
- **Esfuerzo:** 2 horas
- **Dependencias:** Tarea 2.1
- **Testing:**
  - Generar evaluación V2
  - Verificar que el reporte se muestra como texto narrativo (no checklist)
  - Verificar que el texto es legible y bien formateado
  - Verificar que el botón de expandir/colapsar funciona

#### Tarea 2.4: Crear Componente de UI para Planes
- **Archivo:** `src/components/planificacion/PlanningAIDesignReport.tsx` (nuevo)
- **Esfuerzo:** 2 horas
- **Dependencias:** Tarea 2.2
- **Testing:**
  - Generar plan de clase
  - Verificar que el reporte se muestra en la UI del plan
  - Verificar que el texto es legible

#### Tarea 2.5: Testing End-to-End con Grupo Demo
- **Grupo:** "9no1"
- **Esfuerzo:** 2 horas
- **Dependencias:** Todas las tareas 2.1-2.4
- **Testing:**
  1. **Evaluaciones:**
     - Generar evaluación V2 para grupo "9no1"
     - Verificar que el reporte narrativo se muestra correctamente
     - Verificar que el texto es amigable y no técnico
     - Verificar que menciona todos los elementos relevantes
  2. **Planes:**
     - Generar plan de clase para grupo "9no1"
     - Verificar que el reporte narrativo se muestra correctamente
     - Verificar que el texto es amigable y no técnico

### Fase 3: Integración y Validación Final

#### Tarea 3.1: Testing de Compatibilidad Hacia Atrás
- **Esfuerzo:** 1 hora
- **Dependencias:** Todas las tareas anteriores
- **Testing:**
  - Generar evaluación V2 sin `responseOptionsInclude` → Verificar que no hay errores
  - Generar evaluación V2 con `responseOptionsInclude: false` → Verificar que no se generan modalidades
  - Generar evaluación V2 legacy (sin `aiReport.narrative`) → Verificar que el componente maneja el fallback

#### Tarea 3.2: Testing de Edge Cases
- **Esfuerzo:** 2 horas
- **Dependencias:** Todas las tareas anteriores
- **Testing:**
  - Item `essay` con prompt que NO requiere comparar → Verificar que NO incluye `comparison_chart`
  - Item `paragraph` con prompt que requiere analizar causas → Verificar que incluye `analysis_table`
  - Item `source_analysis` → Verificar que tiene modalidades equivalentes
  - Evaluación con solo items `multiple_choice` → Verificar que no se generan modalidades
  - Evaluación con mix de items → Verificar que solo items de comprensión/proceso tienen modalidades

#### Tarea 3.3: Documentación de Usuario
- **Archivo:** `docs/user-guide/equivalent-response-modalities.md` (nuevo)
- **Esfuerzo:** 1 hora
- **Dependencias:** Todas las tareas anteriores
- **Contenido:**
  - Explicar qué son las modalidades equivalentes
  - Cómo se activan
  - Cómo se muestran en la UI
  - Ejemplos de uso

### Resumen de Esfuerzo Total

| Fase | Tareas | Esfuerzo Total |
|------|--------|----------------|
| Fase 1: Modalidades Equivalentes | 5 tareas | 12 horas |
| Fase 2: Reporte Narrativo | 5 tareas | 12 horas |
| Fase 3: Integración | 3 tareas | 4 horas |
| **TOTAL** | **13 tareas** | **28 horas** |

**Estimación:** 3-4 días de trabajo para un desarrollador full-time.

---

## Consideraciones Adicionales

### Seguridad y Validación

- ✅ Validar que las modalidades no exponen información sensible
- ✅ Validar que el reporte narrativo no menciona diagnósticos específicos de estudiantes
- ✅ Sanitizar el texto narrativo antes de guardar en base de datos

### Performance

- El reporte narrativo requiere una llamada adicional a OpenAI (o se puede generar en la misma llamada si el modelo lo permite)
- Considerar cachear el reporte si la evaluación no cambia

### Migración de Datos

- Las evaluaciones existentes sin `aiReport.narrative` seguirán funcionando (fallback a formato antiguo)
- No se requiere migración de datos

### Rollback Plan

- Si hay problemas, se puede desactivar la generación de modalidades equivalentes con un flag
- El reporte narrativo puede tener un fallback al formato antiguo

---

## Referencias

- **Tipos V2:** `src/services/evaluations/v2Types.ts`
- **Edge Function V2:** `supabase/functions/modify-evaluation-v2/index.ts`
- **Normalizador V2:** `src/services/evaluations/v2Normalizer.ts`
- **Componente de UI:** `src/components/evaluaciones/v2/EvalItem.tsx`
- **Componente de Reporte:** `src/components/evaluaciones/AIDesignReport.tsx`
- **Edge Function Planes:** `supabase/functions/generate-plan-completo/index.ts`

---

**Fin del Plan de Implementación**
