# AI Evaluation v2 — Phase 1 Specification

> **Estado**: ANÁLISIS Y DISEÑO (sin implementación)  
> **Fecha**: 2026-02-06  
> **Objetivo**: Migrar de HTML monolítico a JSON estructurado para renderizado flexible

---

## 1. Inventario de Datos Actuales

### 1.1 Datos de Entrada al Edge Function

El edge function `modify-evaluation/index.ts` recibe los siguientes datos:

#### Request Body

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `originalEvaluation` | `string?` | HTML de evaluación existente (para modificaciones) |
| `modification` | `string` | Requerimientos del docente en texto libre |
| `groupContext` | `GroupContextForAI` | Contexto completo del grupo |
| `type` | `string` | Tipo de request (`'modification'`, `'chat'`, `'planning'`, `'html_plan'`) |
| `adaptationLevel` | `string` | Nivel de adaptación (`'standard'`, etc.) |
| `generation_mode` | `string` | `'universal'` o `'legacy'` |
| `evaluation_design_plan` | `EvaluationDesignPlan` | Plan de diseño calculado en frontend |

#### GroupContextForAI

```typescript
interface GroupContextForAI {
  groupId: string;
  groupName: string;
  gradeLevel?: string;
  subject?: string;
  content?: string[];                    // Contenidos curriculares seleccionados
  competencies?: string[];               // Competencias a evaluar
  criteriosLogro?: string[];             // Criterios de logro específicos
  students: StudentForAI[];              // Lista completa de estudiantes
  groupProfile?: GroupProfileForAI;      // Perfil agregado del grupo
  dominantLearningStyle?: string;        // Estilo dominante (Visual, Auditivo, etc.)
  teacherSugerencias?: {                 // Sugerencias guardadas por docente
    aula?: string;
    evaluaciones?: string;
    otras?: string;
  };
}
```

#### StudentForAI

```typescript
interface StudentForAI {
  studentId: string | number;
  displayName: string;                   // Anonimizado como "Estudiante A, B, C..."
  learningProfile?: string;              // "Visual-Kinestésico", etc.
  contemplacionesClase: string[];        // IDs para contexto clase
  contemplacionesEvaluaciones: string[]; // IDs para evaluaciones (¡clave!)
  ajustes?: string;                      // Texto libre de ajustes
  requiresContentAdaptation: boolean;    // Requiere versión C
  hasDeclaredContentAdaptation: boolean; // Flag explícito (no inferido)
  declaredContentAdaptationSource: 'informe_tecnico' | 'docente' | null;
}
```

#### EvaluationDesignPlan (calculado en frontend)

```typescript
interface EvaluationDesignPlan {
  // Versiones y asignaciones
  versionPlans: EvaluationVersionPlan[];
  assignmentByStudentId: Record<string, 'A' | 'B' | 'C'>;
  triggers: {
    versionB: boolean;
    versionC: boolean;
  };
  contentAdaptationStudentIds: string[];

  // Opciones de respuesta
  responseOptions: {
    include: boolean;
    optionCount: 1 | 2 | 3;
    triggerReasons: string[];
  };

  // Contemplaciones agrupadas por bucket
  bucketedContemplacionIds: {
    INSTRUMENT_DESIGN: string[];      // Afectan diseño del cuadernillo
    ADMIN_REMINDER: string[];         // Recordatorios administrativos
    CORRECTION_REMINDER: string[];    // Recordatorios de corrección
    CONTENT_ADAPTATION_EXCEPTION: string[];
  };
  instrumentDesignContemplacionIds: string[];

  // Métricas del grupo
  varkDistribution: { visual, auditory, readWrite, kinesthetic, total };
  highStructureNeed: {
    totalStudents: number;
    qualifyingStudents: number;
    percent: number;
    qualifyingStudentIds: string[];
  };
  designComplexityCount: number;

  // Recordatorios por estudiante
  perStudentReminders: StudentReminders[];
}
```

#### StudentReminders

```typescript
interface StudentReminders {
  studentId: string | number;
  admin: string[];       // "Leer consignas en voz alta", etc.
  correction: string[];  // "No penalizar ortografía", etc.
  allowances: string[];  // Reglas de diseño del instrumento (NO son reminders)
}
```

### 1.2 Buckets de Contemplaciones

Las contemplaciones se categorizan en 4 buckets (definidos en `mapping.ts`):

| Bucket | Propósito | Dónde aparece |
|--------|-----------|---------------|
| `INSTRUMENT_DESIGN` | Afectan diseño del cuadernillo | AI Design Report |
| `ADMIN_REMINDER` | Recordatorios administrativos | Teacher Reminders Panel |
| `CORRECTION_REMINDER` | Reglas de corrección | Teacher Reminders Panel |
| `CONTENT_ADAPTATION_EXCEPTION` | Excepciones de contenido | Versión C trigger |

**CRÍTICO**: `INSTRUMENT_DESIGN` (allowances) NO son recordatorios para el docente. Afectan cómo se genera el instrumento pero NO aparecen en el panel de "Recordatorios para el docente".

### 1.3 Sistema de Versiones Actual

| Versión | Cuándo se genera | Propósito |
|---------|------------------|-----------|
| A | Siempre | Evaluación universal base |
| B | `triggers.versionB` o estudiantes asignados a B | Formato equivalente (alta estructuración) |
| C | `triggers.versionC` o `hasDeclaredContentAdaptation` | Adecuación de contenido |

### 1.4 Salida Actual (HTML)

El sistema actual devuelve:

```typescript
interface EvaluationBundle {
  baseHtml: string;           // Versión A como HTML
  versionBHtml?: string;      // Versión B como HTML
  versionCHtml?: string;      // Versión C como HTML
  versions: { A, B?, C? };    // Duplicado por compatibilidad
  responseOptionsIncluded: boolean;
  responseOptionCount: number;
  finalAssignmentCounts: { A, B, C };
}
```

**Problema**: El HTML es opaco, difícil de parsear, y no permite renderizados flexibles.

---

## 2. Schema Propuesto: EvaluationSpecV2

### 2.1 Estructura Raíz

```json
{
  "$schema": "https://aulaplus.edu/schemas/evaluation-spec-v2.json",
  "version": "2.0",
  "generatedAt": "2026-02-06T14:30:00Z",
  
  "meta": { ... },
  "sections": [ ... ],
  "versionVariants": { ... },
  "studentAssignments": { ... },
  "teacherReminders": { ... },
  "aiReport": { ... },
  "warnings": [ ... ]
}
```

### 2.2 Meta

```json
"meta": {
  "subject": "Historia",
  "gradeLevel": "9º1",
  "groupName": "9º1 - Turno Matutino",
  "totalStudents": 25,
  "duration": {
    "minutes": 90,
    "breakdown": {
      "parteI": 20,
      "parteII": 35,
      "parteIII": 35
    }
  },
  "totalPoints": 100,
  "scoringType": "points",
  "requestedVersions": ["A", "C"],
  "evaluationType": "written_exam",
  "contentIds": ["batllismo", "reformas-sociales"],
  "competencyIds": ["CE1.2", "CE2.1"],
  "criteriosLogro": ["Identifica causas del Batllismo", "Analiza fuentes primarias"]
}
```

### 2.3 Sections (Partes del examen)

```json
"sections": [
  {
    "id": "parte-i",
    "title": "Parte I",
    "duration": 20,
    "instructions": "Lee atentamente cada consigna antes de responder.",
    "items": [
      {
        "id": "item-1",
        "type": "multiple_choice",
        "prompt": "¿Cuál de los siguientes fue un logro del primer batllismo?",
        "options": [
          { "id": "a", "text": "La creación del Banco de la República", "isCorrect": true },
          { "id": "b", "text": "La abolición de la esclavitud", "isCorrect": false },
          { "id": "c", "text": "La independencia nacional", "isCorrect": false },
          { "id": "d", "text": "La creación del Cabildo", "isCorrect": false }
        ],
        "points": 2,
        "competencyId": "CE1.2",
        "criterioLogroId": "CL1"
      },
      {
        "id": "item-2",
        "type": "true_false_justify",
        "prompt": "Las reformas batllistas beneficiaron principalmente a la clase obrera.",
        "correctAnswer": true,
        "points": 3,
        "justificationRequired": true,
        "justificationMinLength": 20
      }
    ]
  },
  {
    "id": "parte-ii",
    "title": "Parte II - Análisis de Fuentes",
    "duration": 35,
    "items": [
      {
        "id": "item-3",
        "type": "source_analysis",
        "source": {
          "type": "image",
          "url": "https://example.com/manifestacion-1911.jpg",
          "caption": "Manifestación obrera en Montevideo, 1911",
          "attribution": "Archivo General de la Nación"
        },
        "prompt": "Observa la imagen y responde las siguientes preguntas:",
        "subItems": [
          {
            "id": "item-3a",
            "prompt": "¿Qué elementos visuales identificas que caracterizan el período?",
            "points": 4,
            "responseFormat": "paragraph"
          },
          {
            "id": "item-3b", 
            "prompt": "¿Qué relación puedes establecer entre la imagen y las reformas batllistas?",
            "points": 4,
            "responseFormat": "paragraph"
          }
        ],
        "totalPoints": 8
      },
      {
        "id": "item-4",
        "type": "document_analysis",
        "source": {
          "type": "text",
          "content": "\"El trabajo de las mujeres y los niños debe ser regulado...\" - Fragmento del periódico El Día, 1903",
          "attribution": "El Día, 15 de marzo de 1903"
        },
        "prompt": "Analiza el documento considerando su contexto histórico.",
        "points": 10,
        "responseFormat": "extended_paragraph",
        "minLength": 100
      }
    ]
  },
  {
    "id": "parte-iii",
    "title": "Parte III - Desarrollo",
    "duration": 35,
    "items": [
      {
        "id": "item-5",
        "type": "essay",
        "prompt": "Explica las causas económicas, políticas y sociales que llevaron al surgimiento del Batllismo en Uruguay.",
        "points": 12,
        "responseFormat": "essay",
        "minLength": 150,
        "guidingQuestions": [
          "¿Qué rol jugó la industrialización?",
          "¿Cómo influyó la inmigración europea?",
          "¿Qué demandas tenía la clase trabajadora?"
        ],
        "equivalentResponseOptions": {
          "enabled": true,
          "options": [
            {
              "id": "opt-a",
              "format": "essay",
              "description": "Redacta un ensayo argumentativo"
            },
            {
              "id": "opt-b",
              "format": "structured_list",
              "description": "Organiza tu respuesta en un cuadro de 3 columnas (Económicas | Políticas | Sociales)"
            }
          ],
          "metacognitionText": "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
        }
      }
    ]
  }
]
```

### 2.4 Item Types

| Type | Descripción | Campos específicos |
|------|-------------|-------------------|
| `multiple_choice` | Opción múltiple | `options[]`, `correctOption` |
| `true_false_justify` | V/F con justificación | `correctAnswer`, `justificationRequired` |
| `short_answer` | Respuesta corta | `maxLength`, `keywords` |
| `paragraph` | Párrafo de desarrollo | `minLength`, `maxLength` |
| `essay` | Ensayo extendido | `minLength`, `guidingQuestions` |
| `source_analysis` | Análisis de fuente | `source`, `subItems` |
| `document_analysis` | Análisis de documento | `source`, `analysisFramework` |
| `table_completion` | Completar tabla | `headers`, `rows`, `cellType` |
| `matching` | Unir conceptos | `leftColumn`, `rightColumn` |
| `ordering` | Ordenar secuencia | `items`, `correctOrder` |

### 2.5 Version Variants

```json
"versionVariants": {
  "A": {
    "label": "Versión A (Universal)",
    "isBase": true,
    "modifications": []
  },
  "B": {
    "label": "Versión B (Formato Equivalente)",
    "isBase": false,
    "reason": "Alta necesidad de estructuración + complejidad de diseño",
    "modifications": [
      {
        "itemId": "item-5",
        "type": "add_scaffolding",
        "details": {
          "addedGuidingQuestions": true,
          "addedVisualOrganizers": true
        }
      }
    ]
  },
  "C": {
    "label": "Versión C (Adecuación de Contenido)",
    "isBase": false,
    "reason": "Estudiantes con adecuación de contenido declarada",
    "modifications": [
      {
        "itemId": "item-5",
        "type": "content_simplification",
        "details": {
          "reducedComplexity": true,
          "focusOnCoreContent": true,
          "removedItems": []
        }
      }
    ]
  }
}
```

### 2.6 Student Assignments

```json
"studentAssignments": {
  "byStudentId": {
    "1": "A",
    "2": "A",
    "3": "B",
    "4": "C",
    "5": "A"
  },
  "counts": {
    "A": 15,
    "B": 5,
    "C": 5
  },
  "contentAdaptationStudentIds": ["4", "12", "18"]
}
```

### 2.7 Teacher Reminders

**CRÍTICO**: Solo `admin` y `correction`. NO incluir `allowances` (esas van al AI Report).

```json
"teacherReminders": {
  "byStudent": [
    {
      "studentId": "3",
      "studentName": "Estudiante C",
      "admin": [
        "Leer consignas en voz alta para este estudiante",
        "Brindar tiempo adicional si es necesario"
      ],
      "correction": [
        "No penalizar ortografía cuando no es objetivo de evaluación"
      ]
    },
    {
      "studentId": "4",
      "studentName": "Estudiante D",
      "admin": [
        "Entregar versión C (adecuación de contenido)",
        "Permitir uso de calculadora"
      ],
      "correction": [
        "Evaluar comprensión conceptual, no expresión escrita"
      ]
    }
  ],
  "global": [
    "Recordar leer instrucciones generales al inicio del examen"
  ]
}
```

### 2.8 AI Report

```json
"aiReport": {
  "designRationale": "Se generó evaluación basada en contenidos del Batllismo...",
  "versionsExplanation": {
    "generated": ["A", "C"],
    "reason": "Solo A y C porque no hay triggers para B (highStructureNeed < 30%)",
    "notGenerated": {
      "B": "No se requirió: 20% de estudiantes con alta necesidad de estructura (umbral: 30%)"
    }
  },
  "contemplacionesApplied": {
    "instrumentDesign": [
      "contemplacion-2: Palabras clave en negrita",
      "contemplacion-4: Tipografía legible",
      "contemplacion-5: Consignas segmentadas en pasos"
    ],
    "adminReminders": 3,
    "correctionReminders": 2
  },
  "responseOptions": {
    "included": true,
    "count": 2,
    "reason": "Predominio V+K en el grupo (60%)",
    "appliedToItems": ["item-5", "item-6"]
  },
  "varkSummary": "Visual: 8, Auditivo: 4, Lecto-escritor: 6, Kinestésico: 7",
  "timeEstimation": {
    "calculated": 90,
    "configured": 90,
    "withinBudget": true
  }
}
```

### 2.9 Warnings

```json
"warnings": [
  {
    "code": "CONTENT_ADAPTATION_NO_SPECIFIC_GUIDANCE",
    "message": "Estudiante 4 tiene adecuación de contenido pero no se encontraron guías específicas",
    "severity": "info",
    "studentId": "4"
  }
]
```

### 2.10 Safe Fallbacks

Si la generación falla parcialmente:

```json
"fallbacks": {
  "versionCFailed": {
    "reason": "La IA no generó versión C en el intento",
    "fallbackAction": "show_version_a_with_banner",
    "bannerMessage": "La versión C no pudo ser generada. Se muestra la versión A como alternativa."
  }
}
```

---

## 3. OpenAI Prompt Propuesto

### 3.1 System Prompt

```
Eres un especialista en evaluación educativa. Tu tarea es generar una especificación JSON estructurada para una evaluación escrita.

## REGLAS CRÍTICAS (NO NEGOCIABLES)

1. **Solo JSON**: Tu respuesta debe ser ÚNICAMENTE un objeto JSON válido. Sin comentarios, sin explicaciones, sin markdown.

2. **Sin inferencias de diagnóstico**: NO deduzcas necesidades especiales de texto narrativo. Usa SOLO los datos estructurados proporcionados:
   - `hasDeclaredContentAdaptation: true` → Versión C
   - `contemplacionesEvaluaciones` → Buckets de recordatorios
   - `triggers.versionB/versionC` → Qué versiones generar

3. **Evidencia siempre escrita**: Todas las respuestas deben ser escritas o seleccionables. NO generar tareas "solo orales".

4. **CE/CL del docente**: Usa SOLO las competencias y criterios de logro proporcionados. NO inventes nuevos.

5. **Teacher Reminders separados de Instrument Design**:
   - `teacherReminders.byStudent[].admin` → Recordatorios administrativos (leer consignas, dar tiempo)
   - `teacherReminders.byStudent[].correction` → Reglas de corrección (no penalizar ortografía)
   - Las reglas de diseño del instrumento (allowances) van en `aiReport.contemplacionesApplied.instrumentDesign`, NO en teacherReminders.

6. **Versiones condicionales**:
   - `requestedVersions` indica qué versiones generar.
   - Si `requestedVersions: ["A"]`, solo genera contenido para versión A.
   - Si incluye "B" o "C", genera las modificaciones correspondientes en `versionVariants`.

## ESTRUCTURA JSON REQUERIDA

{
  "version": "2.0",
  "generatedAt": "<ISO timestamp>",
  "meta": {
    "subject": "<materia>",
    "gradeLevel": "<grado>",
    "groupName": "<nombre grupo>",
    "totalStudents": <número>,
    "duration": { "minutes": <total>, "breakdown": { ... } },
    "totalPoints": <puntos>,
    "requestedVersions": ["A", ...],
    "evaluationType": "written_exam",
    "contentIds": [...],
    "competencyIds": [...],
    "criteriosLogro": [...]
  },
  "sections": [
    {
      "id": "<id>",
      "title": "<título>",
      "duration": <minutos>,
      "items": [
        {
          "id": "<id>",
          "type": "<tipo>",
          "prompt": "<consigna>",
          "points": <puntos>,
          ...campos específicos del tipo...
        }
      ]
    }
  ],
  "versionVariants": {
    "A": { "label": "...", "isBase": true },
    "B": { ... } // Solo si requestedVersions incluye "B"
    "C": { ... } // Solo si requestedVersions incluye "C"
  },
  "studentAssignments": {
    "byStudentId": { "<id>": "<version>", ... },
    "counts": { "A": <n>, "B": <n>, "C": <n> }
  },
  "teacherReminders": {
    "byStudent": [
      {
        "studentId": "<id>",
        "studentName": "<nombre>",
        "admin": ["<recordatorio>", ...],
        "correction": ["<regla>", ...]
      }
    ],
    "global": [...]
  },
  "aiReport": {
    "designRationale": "<explicación>",
    "versionsExplanation": { ... },
    "contemplacionesApplied": { ... },
    "responseOptions": { ... }
  },
  "warnings": []
}

## TIPOS DE ITEMS

- `multiple_choice`: Requiere `options: [{id, text, isCorrect}]`
- `true_false_justify`: Requiere `correctAnswer`, `justificationRequired`
- `short_answer`: Requiere `maxLength`
- `paragraph`: Requiere `minLength`
- `essay`: Puede incluir `guidingQuestions`, `equivalentResponseOptions`
- `source_analysis`: Requiere `source: {type, url/content, caption}`
- `table_completion`: Requiere `headers`, `rows`

## OPCIONES DE RESPUESTA EQUIVALENTES

Si `responseOptions.include: true`, algunos items de desarrollo DEBEN incluir:

"equivalentResponseOptions": {
  "enabled": true,
  "options": [
    { "id": "opt-a", "format": "essay", "description": "..." },
    { "id": "opt-b", "format": "structured_list", "description": "..." }
  ],
  "metacognitionText": "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
}
```

### 3.2 User Prompt Template

```
## CONTEXTO DEL GRUPO

Materia: {{subject}}
Grupo: {{groupName}} ({{totalStudents}} estudiantes)
Contenidos a evaluar: {{contentIds}}
Competencias: {{competencies}}
Criterios de logro: {{criteriosLogro}}

## VERSIONES SOLICITADAS

requestedVersions: {{requestedVersions}}

{{#if requestedVersions.includes('B')}}
- Versión B requerida: Formato equivalente para estudiantes con alta necesidad de estructuración
{{else}}
- Versión B: NO generar
{{/if}}

{{#if requestedVersions.includes('C')}}
- Versión C requerida: Adecuación de contenido para estudiantes específicos
  Estudiantes asignados a C: {{contentAdaptationStudentIds}}
{{else}}
- Versión C: NO generar
{{/if}}

## ASIGNACIONES POR ESTUDIANTE

{{#each assignmentByStudentId}}
- Estudiante {{@key}}: Versión {{this}}
{{/each}}

## CONTEMPLACIONES POR ESTUDIANTE (para Teacher Reminders)

{{#each perStudentReminders}}
### Estudiante {{studentId}}
- Admin reminders: {{admin}}
- Correction reminders: {{correction}}
{{/each}}

## REGLAS DE DISEÑO DEL INSTRUMENTO (para aiReport, NO para teacherReminders)

{{#each instrumentDesignRules}}
- {{this}}
{{/each}}

## OPCIONES DE RESPUESTA

include: {{responseOptions.include}}
optionCount: {{responseOptions.optionCount}}
reasons: {{responseOptions.triggerReasons}}

## REQUERIMIENTOS DEL DOCENTE

{{modification}}

## INSTRUCCIONES

Genera una especificación JSON completa siguiendo el schema EvaluationSpecV2.
- La evaluación debe durar exactamente {{duration}} minutos.
- Incluye variedad de tipos de items apropiados para {{subject}}.
- Si requestedVersions incluye solo "A", no generes versionVariants para B o C.
- Los teacherReminders.byStudent deben contener SOLO admin y correction (NO allowances).
- El aiReport.contemplacionesApplied.instrumentDesign contiene las reglas de diseño (allowances).

Responde ÚNICAMENTE con el JSON. Sin explicaciones adicionales.
```

---

## 4. Plan de Renderizado Frontend

### 4.1 Componentes Propuestos

```
src/components/evaluaciones-v2/
├── EvaluationRendererV2.tsx       # Orquestador principal
├── EvaluationHeader.tsx           # Meta info (materia, grupo, tiempo)
├── SectionRenderer.tsx            # Renderiza una sección/parte
├── ItemRenderer.tsx               # Dispatcher por tipo de item
├── items/
│   ├── MultipleChoiceItem.tsx
│   ├── TrueFalseJustifyItem.tsx
│   ├── ShortAnswerItem.tsx
│   ├── ParagraphItem.tsx
│   ├── EssayItem.tsx
│   ├── SourceAnalysisItem.tsx
│   ├── TableCompletionItem.tsx
│   └── EquivalentOptionsBlock.tsx # Bloque de metacognición
├── TeacherRemindersV2.tsx         # Panel colapsable de reminders
├── AIReportV2.tsx                 # Reporte de IA (solo docente)
├── VersionSelector.tsx            # Selector de versión a visualizar
├── PrintLayout.tsx                # Layout optimizado para impresión
└── ErrorBoundaryV2.tsx            # Manejo de errores graceful
```

### 4.2 Reglas de UX

#### 4.2.1 Layout Principal

```tsx
<EvaluationRendererV2 spec={evaluationSpec}>
  {/* Header con metadata */}
  <EvaluationHeader />
  
  {/* Selector de versión (solo si hay múltiples) */}
  {versionsAvailable.length > 1 && <VersionSelector />}
  
  {/* Contenido de la evaluación */}
  <main className="print:break-inside-avoid">
    {sections.map(section => (
      <SectionRenderer key={section.id} section={section} />
    ))}
  </main>
  
  {/* Panel de recordatorios (colapsable) */}
  <TeacherRemindersV2 reminders={teacherReminders} />
  
  {/* Reporte de IA (colapsable, solo docente) */}
  <AIReportV2 report={aiReport} />
</EvaluationRendererV2>
```

#### 4.2.2 Compactación para Muchos Estudiantes

- Si `teacherReminders.byStudent.length > 6`: Colapsar todos por defecto
- Botones "Expandir todo" / "Colapsar todo"
- Grid responsivo: 1 columna mobile, 2 columnas desktop
- Truncar nombres largos con ellipsis

#### 4.2.3 Manejo de Errores

```tsx
// NUNCA mostrar errores raw al usuario
<ErrorBoundaryV2 
  fallback={
    <SafeBanner 
      type="warning"
      title="Contenido no disponible"
      message="Parte de la evaluación no pudo cargarse. Intente regenerar."
      action={<Button>Regenerar</Button>}
    />
  }
>
  <ItemRenderer item={item} />
</ErrorBoundaryV2>
```

#### 4.2.4 Fallbacks Visuales

| Situación | Comportamiento |
|-----------|----------------|
| Versión C no generada pero requerida | Banner amarillo + mostrar versión A |
| Item malformado | Placeholder con mensaje amigable |
| Fuente sin URL válida | Mostrar solo caption/descripción |
| JSON parse error | Banner de error + opción de ver HTML legacy |

#### 4.2.5 Print Layout

```css
@media print {
  .no-print { display: none; }
  .print-break { page-break-before: always; }
  .section { page-break-inside: avoid; }
  .item { page-break-inside: avoid; }
  .teacher-reminders { page-break-before: always; }
}
```

### 4.3 Migración Gradual

1. **Feature flag**: `EVAL_V2_ENABLED`
2. **Dual rendering**: Si v2 falla, fallback a HTML renderer existente
3. **A/B testing**: 10% de usuarios ven v2 inicialmente

---

## 5. Checklist Phase 2 (Implementación)

### 5.1 Backend (Edge Function)

- [ ] Crear nuevo archivo `modify-evaluation-v2/index.ts`
- [ ] Implementar prompt builder con templates Handlebars
- [ ] Configurar `response_format: { type: "json_object" }` en OpenAI call
- [ ] Implementar validación de JSON schema con Zod o Ajv
- [ ] Agregar feature flag `EVAL_V2_ENABLED` en request
- [ ] Mantener backward compatibility: si flag off, usar path legacy
- [ ] Agregar logs estructurados: `[EVAL_V2] ...`
- [ ] Implementar retry con schema validation

### 5.2 Frontend

- [ ] Crear tipos TypeScript para `EvaluationSpecV2`
- [ ] Crear componentes en `src/components/evaluaciones-v2/`
- [ ] Implementar `EvaluationRendererV2` con ErrorBoundary
- [ ] Agregar feature flag check en `EvaluacionesGrupo.tsx`
- [ ] Implementar dual rendering (v2 → v1 fallback)
- [ ] Crear tests para cada ItemRenderer

### 5.3 Validación

- [ ] Test: JSON schema válido en 100% de responses
- [ ] Test: teacherReminders NO contiene allowances
- [ ] Test: versionVariants solo incluye versiones solicitadas
- [ ] Test: equivalentResponseOptions solo en items de desarrollo
- [ ] Test: fallback a v1 si v2 falla

### 5.4 Observabilidad

- [ ] Log: `[EVAL_V2] spec generated successfully`
- [ ] Log: `[EVAL_V2] validation errors: ...`
- [ ] Log: `[EVAL_V2] fallback to v1 triggered: ...`
- [ ] Métricas: tiempo de generación v1 vs v2
- [ ] Métricas: tasa de éxito v1 vs v2

### 5.5 Deployment

- [ ] Deploy edge function con feature flag OFF
- [ ] Enable flag para 10% de usuarios
- [ ] Monitor errores y métricas
- [ ] Gradualmente aumentar a 100%
- [ ] Deprecar path v1 después de 2 semanas estables

---

## 6. Riesgos Identificados

| Riesgo | Mitigación |
|--------|------------|
| JSON malformado de OpenAI | Retry hasta 3 veces + fallback a HTML |
| Schema drift (cambios incompatibles) | Versionado estricto (`"version": "2.0"`) |
| Items no reconocidos por frontend | `UnknownItemRenderer` con mensaje amigable |
| Latencia aumentada por JSON parsing | Cache de specs generados |
| Docentes confundidos por nueva UI | Onboarding gradual + documentación |

---

## 7. Referencias

- [groupContextForAI.ts](src/types/groupContextForAI.ts) - Tipos de contexto
- [designPlan.ts](src/services/evaluations/designPlan.ts) - Cálculo de design plan
- [mapping.ts](src/lib/contemplaciones/mapping.ts) - Buckets de contemplaciones
- [TeacherRemindersPanel.tsx](src/components/evaluaciones/TeacherRemindersPanel.tsx) - UI actual
- [AIDesignReport.tsx](src/components/evaluaciones/AIDesignReport.tsx) - UI de reporte IA
