# Phase 2: V2 Edge Function Implementation

> **Fecha**: 2026-02-06  
> **Estado**: Implementado (listo para deploy)  
> **Objetivo**: Crear función paralela v2 que retorna JSON estructurado

---

## Resumen

Se creó una nueva Edge Function `modify-evaluation-v2` que retorna JSON estructurado en lugar de HTML. La función v1 original permanece **sin cambios** y sigue siendo el default de producción.

## Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `supabase/functions/modify-evaluation-v2/index.ts` | Nueva Edge Function v2 |

## Archivos NO Modificados

- `supabase/functions/modify-evaluation/index.ts` (v1 intacto)
- Base de datos (sin migraciones)
- Frontend (sin cambios)

---

## Contrato de Request/Response V2

### Request

```typescript
interface V2Request {
  modification: string;              // Requerimientos del docente
  groupContext: {
    subject?: string;
    groupName?: string;
    content?: string[];
    competencies?: string[];
    criteriosLogro?: string[];
    students?: Array<{
      studentId: string | number;
      displayName?: string;
      hasDeclaredContentAdaptation?: boolean;
      requiresContentAdaptation?: boolean;
    }>;
  };
  evaluation_design_plan?: {
    triggers?: { versionB?: boolean; versionC?: boolean };
    instrumentDesignRules?: string[];
    studentAssignments?: Record<string, 'A' | 'B' | 'C'>;
    perStudentReminders?: Array<{
      studentId: string | number;
      admin?: string[];
      correction?: string[];
      allowances?: string[];  // NOT included in teacherRemindersByStudent
    }>;
    responseOptions?: {
      include?: boolean;
      optionCount?: 2 | 3;
    };
  };
}
```

### Response

```typescript
interface V2Response {
  success: boolean;
  
  // Structured evaluation specification (null if failed)
  evaluationSpec: {
    version: '2.0';
    generatedAt: string;
    meta: {
      subject: string;
      gradeLevel?: string;
      groupName?: string;
      totalStudents?: number;
      duration?: { minutes: number };
      totalPoints?: number;
      evaluationType: string;
      contentIds?: string[];
      competencyIds?: string[];
      criteriosLogro?: string[];
    };
    sections: Array<{
      id: string;
      title: string;
      duration?: number;
      instructions?: string;
      items: Array<{
        id: string;
        type: 'multiple_choice' | 'true_false' | 'essay' | ...;
        prompt: string;
        points: number;
        // Type-specific fields...
      }>;
    }>;
    versionVariants: {
      A: { label: string; isBase: true };
      B?: { label: string; reason: string; modifications: unknown[] };
      C?: { label: string; reason: string; modifications: unknown[] };
    };
  } | null;
  
  // Which versions were requested (single source of truth)
  requestedVersions: { A: boolean; B: boolean; C: boolean };
  
  // Global instrument design rules (NOT per-student)
  instrumentDesignRulesApplied: string[];
  
  // Teacher reminders (ONLY admin + correction, NOT allowances)
  teacherRemindersByStudent: Array<{
    studentId: string;
    studentName: string;
    admin: string[];
    correction: string[];
  }>;
  
  // AI explanation of what was generated
  aiReport: {
    designRationale: string;
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
  } | null;
  
  // Warnings/errors for frontend to display
  warnings: Array<{
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    context?: Record<string, unknown>;
  }>;
  
  // Debug metadata (optional)
  debug?: {
    model: string;
    promptTokensEstimate: number;
    completionTokensEstimate: number;
    attempt: number;
    extractionMethod: string;
  };
}
```

---

## Diferencias Clave vs V1

| Aspecto | V1 | V2 |
|---------|----|----|
| **Output** | HTML strings (A, B, C) | Structured JSON spec |
| **Parsing** | Delimiter-based extraction | Native JSON (`response_format: json_object`) |
| **Validation** | HTML wrapper detection | JSON schema validation |
| **Errors** | Can throw/crash | Always returns 200 with `success: false` |
| **Teacher Reminders** | In design plan | Extracted to `teacherRemindersByStudent` |
| **Instrument Rules** | Mixed in prompts | Separated to `instrumentDesignRulesApplied` |

---

## Testing Local

### 1. Levantar Supabase local

```bash
supabase start
```

### 2. Serve la función

```bash
supabase functions serve modify-evaluation-v2 --env-file .env.local
```

### 3. Test con curl

```bash
curl -X POST http://localhost:54321/functions/v1/modify-evaluation-v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "modification": "Genera una evaluación de historia sobre el Batllismo",
    "groupContext": {
      "subject": "Historia",
      "groupName": "9º1",
      "content": ["Batllismo", "Reformas sociales"],
      "competencies": ["CE1.2"],
      "criteriosLogro": ["Identifica causas del Batllismo"],
      "students": [
        { "studentId": "1", "displayName": "Estudiante A" },
        { "studentId": "2", "displayName": "Estudiante B" }
      ]
    },
    "evaluation_design_plan": {
      "triggers": { "versionB": false, "versionC": false },
      "instrumentDesignRules": ["Palabras clave en negrita"],
      "responseOptions": { "include": false }
    }
  }'
```

### 4. Verificar respuesta

- `success: true` → JSON spec generado
- `success: false` → Check `warnings` array

---

## Deploy a Producción

```bash
supabase functions deploy modify-evaluation-v2
```

### Variables de entorno requeridas

Ya configuradas para v1, v2 las hereda:
- `OPENAI_API_KEY`

---

## Logging

Los logs usan prefijos para facilitar búsqueda en Supabase Dashboard:

| Prefijo | Contenido |
|---------|-----------|
| `[V2_REQUEST]` | Request recibido |
| `[V2_VERSIONS]` | Versiones solicitadas |
| `[V2_OPENAI]` | Llamada a OpenAI |
| `[V2_GENERATION]` | Proceso de generación |
| `[V2_RESPONSE]` | Respuesta final |
| `[V2_ERROR]` | Errores |
| `[V2_RETRY]` | Reintentos |

---

## Limitaciones Conocidas

1. **Sin integración frontend**: Esta fase solo crea el backend. El frontend sigue usando v1.

2. **Sin feature flag**: No hay toggle para cambiar entre v1/v2 en el cliente aún.

3. **Item types limitados**: Solo los tipos básicos están definidos. Agregar más según necesidad.

4. **Sin versionVariants detallados**: Las modificaciones de B/C son placeholder. Expandir en fase 3.

5. **Sin cache**: Cada request genera desde cero. Considerar cache en fase futura.

---

## Próximos Pasos (Phase 3)

1. **Feature flag frontend**: Toggle para usar v2 en lugar de v1
2. **Componentes de renderizado**: `EvaluationRendererV2` que consume el JSON
3. **Dual rendering**: Fallback a v1 si v2 falla
4. **Validación exhaustiva**: Zod schema para validación completa
5. **A/B testing**: Gradual rollout a usuarios

---

## Referencias

- [Phase 1 Specification](./ai-eval-v2-phase1/specification.md)
- [V1 Edge Function](../supabase/functions/modify-evaluation/index.ts)
- [Design Plan Service](../src/services/evaluations/designPlan.ts)
