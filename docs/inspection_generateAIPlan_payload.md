# Inspection: generateAIPlan → Edge Function Payload Flow

**Date**: 26 de diciembre de 2024  
**Inspection Type**: READ-ONLY

---

## 1. Flow Overview

There are **TWO different paths** that call edge functions for plan generation:

1. **Path A**: `useFullSessionGeneration.ts` → `generateAIPlan()` → `modify-evaluation` edge function
2. **Path B**: `PlanificacionWizard.tsx` → `generarPlanesAutomaticamente()` → `generate-plan-completo` edge function

**Important**: These are **different edge functions** with **different payloads**.

---

## 2. Path A: useFullSessionGeneration.ts → modify-evaluation

### 2.1 Function: `generateAIPlan()`

**File**: `src/hooks/useFullSessionGeneration.ts`  
**Location**: Lines 234-288

**Full Implementation**:

```typescript
// Generar plan de desarrollo con IA
async function generateAIPlan(params: {
  materia: string;
  contenido: string;
  competencias: string[];
  modalidad: string;
  duracionMinutos: number;
  diferenciacion?: string;
  grupoId: string;
  sesionNumero: number;
  totalSesiones: number;
  // PHASE 1: Metadata de asignación (no se usa en prompt hasta Phase 2)
  unitAssignment?: UnitAssignmentMetadata;
}) {
  try {
    const { data, error } = await supabase.functions.invoke('modify-evaluation', {
      body: {
        type: 'planning',
        modification: `Genera un plan de clase estructurado para la sesión ${params.sesionNumero} de ${params.totalSesiones}:

MATERIA: ${params.materia}
CONTENIDO: ${params.contenido}
MODALIDAD PRINCIPAL: ${params.modalidad}
DURACIÓN: ${params.duracionMinutos} minutos

Estructura necesaria:
- INICIO (15 min): Actividad de apertura motivadora
- DESARROLLO (40 min): Actividades principales adaptadas a modalidad ${params.modalidad}
- CIERRE (5 min): Síntesis y reflexión

${params.diferenciacion ? `DIFERENCIACIÓN REQUERIDA: ${params.diferenciacion}` : ''}

Incluye diferenciación específica integrada en cada sección, recursos concretos y actividades detalladas.`,
        groupContext: {
          subject: params.materia,
          content: [params.contenido],
          competencies: params.competencias,
          groupName: params.grupoId,
          additionalContext: `Modalidad: ${params.modalidad}, Sesión ${params.sesionNumero}/${params.totalSesiones}`
        }
      }
    });

    if (error) throw error;

    const contenidoIA = data?.content || '';
    
    // Parsear respuesta IA y estructurar en secciones
    return parseAIResponseToPlan(contenidoIA, params.duracionMinutos);

  } catch (error) {
    console.error('Error generando plan con IA:', error);
    return generateFallbackPlan(params);
  }
}
```

### 2.2 Payload Sent to `modify-evaluation`

**Exact Payload Structure**:

```typescript
{
  type: 'planning',
  modification: string,  // Prompt text (includes sesionNumero, totalSesiones, contenido, etc.)
  groupContext: {
    subject: string,      // params.materia
    content: string[],    // [params.contenido]
    competencies: string[], // params.competencias
    groupName: string,    // params.grupoId
    additionalContext: string  // "Modalidad: X, Sesión Y/Z"
  }
}
```

### 2.3 Where `unitAssignment` is Passed (or Dropped)

**Location**: Line 80 in `generateAllSessions()`

```typescript
const planDesarrollo = await generateAIPlan({
  // ... other params
  unitAssignment: assignment  // ← PASSED to generateAIPlan()
});
```

**Inside `generateAIPlan()`**:
- ✅ `unitAssignment` is **RECEIVED** as parameter (line 246)
- ❌ `unitAssignment` is **NOT included** in payload to `modify-evaluation`
- ❌ `unitAssignment` is **NOT used** in prompt construction
- ❌ `unitAssignment` is **NOT passed** to edge function

**Conclusion**: 
- `unitAssignment` is **passed to `generateAIPlan()`** but **DROPPED/IGNORED** before sending to edge function
- The prompt only includes `params.contenido` (which comes from `assignment.contenido_texto`), but not the metadata itself

---

## 3. Path B: PlanificacionWizard.tsx → generate-plan-completo

### 3.1 Function: `generarPlanesAutomaticamente()`

**File**: `src/pages/PlanificacionWizard.tsx`  
**Location**: Lines 88-320

### 3.2 Payload Construction

**Location**: Lines 202-213

```typescript
const payload = {
  modo: 'generar_plan_html',
  sesionId: sesion.id,
  orden: sesion.orden,
  duracionMin: sesion.duracion_minutos,
  materia: materia || 'Sin especificar',
  nivel: nivel || 'Sin especificar',
  contenidos: contenidosSesion, // PHASE 1: Usar contenido de unidad asignada
  competencias: competenciasSesion, // PHASE 1: Usar competencias de unidad asignada
  criterios: criterios,
  instruccionesDocente: undefined
};
```

**Where `contenidosSesion` and `competenciasSesion` come from** (Lines 173-182):

```typescript
// PHASE 1: Usar asignación determinística
const assignment = sessionAssignments[i];

// Usar competencias de la unidad asignada, o todas si no hay específicas
const competenciasSesion = assignment.competencias_ids.length > 0
  ? assignment.competencias_ids
  : competencias;

// Usar contenido de la unidad asignada
const contenidosSesion = [assignment.contenido_texto];
```

### 3.3 Payload Sent to `generate-plan-completo`

**Location**: Lines 222-224

```typescript
const functionPromise = supabase.functions.invoke('generate-plan-completo', {
  body: payload
});
```

**Exact Payload Structure**:

```typescript
{
  modo: 'generar_plan_html',
  sesionId: string,
  orden: number,
  duracionMin: number,
  materia: string,
  nivel: string,
  contenidos: string[],      // From assignment.contenido_texto
  competencias: string[],    // From assignment.competencias_ids (or fallback)
  criterios: any,
  instruccionesDocente: undefined
}
```

### 3.4 Where `unitAssignment` is Passed (or Dropped)

**Observation**:
- ✅ `assignment` is **calculated** from `sessionAssignments[i]` (line 174)
- ✅ `assignment.contenido_texto` is **used** in `contenidosSesion`
- ✅ `assignment.competencias_ids` is **used** in `competenciasSesion`
- ❌ `assignment` (the full metadata object) is **NOT included** in payload
- ❌ `unitAssignment` field is **NOT present** in payload

**Conclusion**: 
- `unitAssignment` metadata is **USED INDIRECTLY** (content and competencies extracted from it)
- But the **full `unitAssignment` object is DROPPED** - not sent to edge function

---

## 4. Edge Function: `generate-plan-completo`

**File**: `supabase/functions/generate-plan-completo/index.ts`  
**Location**: Lines 32-277

### 4.1 Payload Extraction

**Location**: Lines 38-52

```typescript
const { 
  modo,
  sesionId,
  orden,
  duracionMin,
  materia,
  nivel,
  contenidos,
  competencias,
  criterios,
  perfilGrupo,
  estudiantes,
  instruccionesDocente,
  planActual
} = await req.json();
```

**Key Observations**:
- ❌ **NO `unitAssignment` field** in destructuring
- ❌ **NO `claseEnUnidad` field**
- ❌ **NO `totalClasesUnidad` field**
- ❌ **NO `unidadIndex` field**
- ✅ Only receives: `contenidos`, `competencias`, `orden`, etc.

### 4.2 Prompt Construction

**Location**: Lines 54-143

**Relevant Excerpt**:

```typescript
const prompt = `
Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP).
${modo === 'regenerar' ? 'Modificá' : 'Generá'} el plan de la sesión ${orden} con duración ${duracionMin} minutos.

CONTEXTO DE LA CLASE:
- Materia: ${materia || 'Sin especificar'}
- Nivel: ${nivel || 'Sin especificar'}
- Contenidos ANEP: ${Array.isArray(contenidos) ? contenidos.join(', ') : contenidos || 'Sin especificar'}
- Competencias: ${Array.isArray(competencias) ? competencias.join(', ') : competencias || 'Sin especificar'}
- Criterios de logro: ${Array.isArray(criterios) ? criterios.join(', ') : criterios || 'Sin especificar'}
...
`;
```

**Key Observations**:
- ✅ Prompt includes `orden` (session number)
- ✅ Prompt includes `contenidos` (from assignment, but AI doesn't know it's from a unit)
- ✅ Prompt includes `competencias` (from assignment, but AI doesn't know it's from a unit)
- ❌ **NO mention of `claseEnUnidad`** (e.g., "Esta es la clase 2 de 3 de la unidad X")
- ❌ **NO mention of `totalClasesUnidad`**
- ❌ **NO mention of unit context** (which unit this session belongs to)

---

## 5. Summary: unitAssignment Flow

### Path A (useFullSessionGeneration → modify-evaluation)

| Stage | unitAssignment Status |
|-------|----------------------|
| `generateAllSessions()` calls `generateAIPlan()` | ✅ **PASSED** as `unitAssignment: assignment` |
| `generateAIPlan()` receives parameter | ✅ **RECEIVED** (optional parameter) |
| Payload to `modify-evaluation` | ❌ **DROPPED** - not included |
| Prompt construction | ❌ **NOT USED** - only `params.contenido` used |

### Path B (PlanificacionWizard → generate-plan-completo)

| Stage | unitAssignment Status |
|-------|----------------------|
| `generarPlanesAutomaticamente()` calculates | ✅ **CALCULATED** as `assignment = sessionAssignments[i]` |
| Content/competencies extracted | ✅ **USED INDIRECTLY** (`assignment.contenido_texto`, `assignment.competencias_ids`) |
| Payload to `generate-plan-completo` | ❌ **DROPPED** - full object not included |
| Edge function receives | ❌ **NOT PRESENT** - not in payload destructuring |
| Prompt construction | ❌ **NOT USED** - only `contenidos` and `competencias` arrays used |

---

## 6. Conclusion

### Current State (Phase 1)

✅ **What works**:
- `unitAssignment` is calculated correctly in both paths
- Content and competencies from `unitAssignment` are used (indirectly)
- Sessions are assigned deterministically based on `clases_estimadas`

❌ **What's missing** (for Phase 2):
- `unitAssignment` metadata is **NOT sent** to edge functions
- Edge functions **DO NOT receive** `claseEnUnidad`, `totalClasesUnidad`, `unidadIndex`
- AI prompts **DO NOT include** unit context (e.g., "Esta es la clase 2 de 3 de la unidad Batllismo")
- AI **CANNOT generate progressive content** because it doesn't know which class-in-unit this is

### For Phase 2

To enable progressive class generation, Phase 2 must:
1. Add `unitAssignment` (or its fields) to payloads sent to edge functions
2. Modify edge functions to extract and use `claseEnUnidad`, `totalClasesUnidad`
3. Include unit context in AI prompts (e.g., "Esta es la clase 2 de 3 para la unidad X")















