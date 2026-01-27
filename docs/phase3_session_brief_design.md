# Phase 3: Structured Per-Session Override (Session Brief)

**Date**: 26 de diciembre de 2024  
**Phase**: 3.0 Session Brief Implementation  
**Status**: Design Document

---

## Summary

Phase 3 adds an optional `sessionBrief` field that allows teachers to specify the intended topic/title for each class session. When provided, the AI must strictly follow the brief. When not provided, the system behaves exactly as Phase 2.2.2 (autonomous topic generation).

**Key Principle**: `sessionBrief` is opt-in and per-session. It does not replace teacher global requirements (`requerimientos_docente`), but takes priority over autonomous topic selection.

---

## Core Concept: `sessionBrief`

### Definition

```typescript
sessionBrief?: string
// Short teacher-provided focus/title for that specific session
// Optional (opt-in)
// Per-session (can be filled for some sessions and left blank for others)
```

### Behavior Rules

#### A) When `sessionBrief` is NOT provided (default)
- **No behavior change** from Phase 2.2.2
- AI autonomously determines session focus using:
  - Macro unit content
  - `unitContext` progression rules
  - Anti-duplication rules
  - Teacher general instructions (`requerimientos_docente`)
- Teacher can edit later in workspace

#### B) When `sessionBrief` IS provided
- `sessionBrief` becomes the **primary session focus**
- AI must:
  - **NOT** change, replace, or reinterpret the focus
  - Develop the session **strictly around the brief**
  - Still apply `unitContext` progression rules (intro/deepen/synthesize based on position)
  - Still respect anti-duplication rules (no repeated explanations)

### Priority Rules

When deciding the session's main focus (priority order):

1. **`sessionBrief`** (if present) — **overrides** session topic
2. **Teacher general requirements** (`requerimientos_docente` / `instruccionesDocente`) — constraints/overrides
3. **Macro unit content**
4. **`unitContext`** — progression shaping (intro/middle/final/extra) and anti-duplication enforcement

**Important**: `requerimientos_docente` must **not** redefine the session topic when `sessionBrief` is present. It only adds constraints.

---

## Data Model / Payload Changes

### Path A: `useFullSessionGeneration.ts` → `modify-evaluation`

**Current Payload Structure** (Phase 2.2.2):
```typescript
{
  type: 'planning',
  modification: string,
  groupContext: {...},
  unitContext?: {...}
}
```

**Updated Payload Structure** (Phase 3):
```typescript
{
  type: 'planning',
  modification: string,
  groupContext: {...},
  unitContext?: {...},
  sessionBrief?: string  // NEW: Optional per-session focus
}
```

### Path B: `PlanificacionWizard.tsx` → `generate-plan-completo`

**Current Payload Structure** (Phase 2.2.2):
```typescript
{
  modo: 'generar_plan_html',
  sesionId: string,
  orden: number,
  duracionMin: number,
  materia: string,
  nivel: string,
  contenidos: string[],
  competencias: string[],
  criterios: any,
  instruccionesDocente?: string,
  unitContext?: {...}
}
```

**Updated Payload Structure** (Phase 3):
```typescript
{
  modo: 'generar_plan_html',
  sesionId: string,
  orden: number,
  duracionMin: number,
  materia: string,
  nivel: string,
  contenidos: string[],
  competencias: string[],
  criterios: any,
  instruccionesDocente?: string,
  unitContext?: {...},
  sessionBrief?: string  // NEW: Optional per-session focus
}
```

---

## Prompt Changes

### Shared Rule (Both Paths)

Add this instruction verbatim (or functionally identical) to both prompts:

```
If a sessionBrief is provided, it defines the primary focus of this session.
Do NOT change, replace, broaden, narrow, or reinterpret it.
Develop the lesson strictly around this focus.

If no sessionBrief is provided, autonomously determine the session focus
based on the macro content, unitContext progression rules, and anti-duplication constraints.
```

### Path A: `modify-evaluation` Planning Prompt

**Location**: `supabase/functions/modify-evaluation/index.ts` (type === 'planning')

**Current Prompt Structure** (Phase 2.2.2):
- System prompt (English)
- User prompt with:
  - PLANNING REQUEST
  - modification string
  - sequenceContext (if unitContext present)
  - ADDITIONAL CONTEXT
  - TASK
  - MANDATORY OUTPUT FORMAT

**Updated Prompt Structure** (Phase 3):

**Extract `sessionBrief` from request body**:
```typescript
const {
  // ... existing params
  sessionBrief  // PHASE 3: Optional per-session focus
} = await req.json();
```

**Add `sessionBrief` section to user prompt** (after `sequenceContext`, before `ADDITIONAL CONTEXT`):
```typescript
const sessionBriefSection = sessionBrief ? `
SESSION FOCUS (TEACHER-SPECIFIED):
${sessionBrief}

CRITICAL: This sessionBrief defines the primary focus of this session.
- Do NOT change, replace, broaden, narrow, or reinterpret it.
- Develop the lesson strictly around this focus.
- Ensure the DESARROLLO section directly and clearly develops this focus.
- Do NOT introduce a different main topic.

` : '';

const userPrompt = `PLANNING REQUEST:
${modification}
${sequenceContext}${sessionBriefSection}ADDITIONAL CONTEXT:
${groupContext?.additionalContext || 'Not specified'}

TASK: Generate specific, practical, and applicable didactic suggestions. Include concrete activities, necessary resources, and adaptations for different learning styles.

MANDATORY OUTPUT FORMAT:
- The response MUST be plain text (NO HTML, NO Markdown, NO code fences).
- The response MUST start with "INICIO" and MUST end after the "CIERRE" section.
- NO preamble, NO trailing text, NO extra sections or labels (Title, Objectives, Notes, etc.).
- MUST include exactly one section for each header, in this exact order:
  * INICIO
  * DESARROLLO
  * CIERRE
- Each section MUST include:
  * Actividad: (one or more sentences describing the activity)
  * Recursos: (comma-separated list)
- Do NOT include any other top-level headers.
- Headers MUST be uppercase Spanish: INICIO, DESARROLLO, CIERRE.
${sessionBrief ? '\n- If sessionBrief is provided, ensure the DESARROLLO section directly and clearly develops that focus. Do NOT introduce a different main topic.' : ''}`;
```

### Path B: `generate-plan-completo` Prompt

**Location**: `supabase/functions/generate-plan-completo/index.ts`

**Current Prompt Structure** (Phase 2.2.2):
- System prompt (Spanish)
- User prompt with:
  - CONTEXTO DE LA CLASE
  - secuenciaContext (if unitContext present)
  - instruccionesDocenteSection (if instruccionesDocente present)
  - PLAN ACTUAL A MODIFICAR (if planActual present)
  - ESTRUCTURA OBLIGATORIA
  - REQUISITOS ESTRICTOS

**Updated Prompt Structure** (Phase 3):

**Extract `sessionBrief` from request body**:
```typescript
const {
  // ... existing params
  sessionBrief  // PHASE 3: Optional per-session focus
} = await req.json();
```

**Add `sessionBrief` section** (after `secuenciaContext`, before `instruccionesDocenteSection`):
```typescript
const sessionBriefSection = sessionBrief ? `
ENFOQUE DE SESIÓN (ESPECIFICADO POR EL DOCENTE):
${sessionBrief}

CRÍTICO: Este sessionBrief define el enfoque principal de esta sesión.
- NO cambies, reemplaces, amplíes, reduzcas o reinterpretes este enfoque.
- Desarrolla la clase estrictamente alrededor de este enfoque.
- El título H1 debe ser exactamente este sessionBrief O una reformulación mínima y fiel (sin desviación del tema).
- El contenido del plan debe seguir estrictamente este enfoque mientras respeta las reglas de progresión de unitContext.

` : '';

const prompt = `
Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP).
${modo === 'regenerar' ? 'Modificá' : 'Generá'} el plan de la sesión ${orden} con duración ${duracionMin} minutos.

CONTEXTO DE LA CLASE:
- Materia: ${materia || 'Sin especificar'}
- Nivel: ${nivel || 'Sin especificar'}
- Contenidos ANEP: ${Array.isArray(contenidos) ? contenidos.join(', ') : contenidos || 'Sin especificar'}
- Competencias: ${Array.isArray(competencias) ? competencias.join(', ') : competencias || 'Sin especificar'}
- Criterios de logro: ${Array.isArray(criterios) ? criterios.join(', ') : criterios || 'Sin especificar'}
${perfilGrupo ? `- Perfil del grupo: ${perfilGrupo.dominante || 'mixto'} (${perfilGrupo.tamanio || 'sin especificar'} estudiantes)` : ''}
${estudiantes?.length ? `- Estudiantes con ajustes: ${estudiantes.filter(e => e.ajustes?.length).length}` : ''}
${secuenciaContext}${sessionBriefSection}${instruccionesDocenteSection}${planActual ? `\nPLAN ACTUAL A MODIFICAR:\n${planActual}` : ''}

ESTRUCTURA OBLIGATORIA - DEVOLVER SOLO HTML VÁLIDO:
<section id="plan">
  <h1>${sessionBrief ? `${sessionBrief}` : 'Título específico y claro de esta clase (debe ser diferente de otras clases en la misma unidad)'}</h1>
  // ... rest of structure
</section>

REQUISITOS ESTRICTOS:
1. Usar SOLO HTML válido - NO Markdown, NO code fences
2. NUNCA incluir "Diferenciación/Adaptaciones" dentro de las secciones Inicio, Desarrollo o Cierre
3. Incluir SIEMPRE: <strong>Actividad:</strong> y <strong>Recursos:</strong> en cada sección principal
4. Adaptar duraciones según el tiempo total (${duracionMin} min)
5. Incluir actividades específicas y detalladas
${sessionBrief ? '6. OBLIGATORIO: Si sessionBrief está presente, el título H1 debe ser exactamente el sessionBrief O una reformulación mínima y fiel. NO introduzcas un tema diferente.' : '6. OBLIGATORIO: El título H1 debe ser específico y diferente de otras clases en la misma unidad. No reutilices títulos de otras clases.'}
7. OBLIGATORIO: Los títulos H2 de Inicio, Desarrollo y Cierre DEBEN tener <strong> dentro del H2
// ... rest of requirements
`;
```

---

## File-by-File Implementation Plan

### 1. `src/hooks/useFullSessionGeneration.ts`

**Changes Required**:

1. **Update `generateAIPlan()` function signature**:
```typescript
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
  unitAssignment?: UnitAssignmentMetadata;
  requerimientosDocente?: string;
  sessionBrief?: string;  // PHASE 3: Optional per-session focus
}) {
```

2. **Pass `sessionBrief` to edge function**:
```typescript
const { data, error } = await supabase.functions.invoke('modify-evaluation', {
  body: {
    type: 'planning',
    modification: `...`,
    groupContext: {...},
    ...(unitContext && { unitContext }),
    // PHASE 3: Include sessionBrief if provided
    ...(params.sessionBrief && { sessionBrief: params.sessionBrief })
  }
});
```

3. **Update call site in `generateAllSessions()`**:
```typescript
const planDesarrollo = await generateAIPlan({
  materia: planificacion.materia,
  contenido: assignment.contenido_texto,
  competencias: competenciasAll,
  modalidad: modalidadesDistribuidas[index],
  duracionMinutos: duracionReal,
  diferenciacion: planificacion.estrategias_diferenciacion,
  grupoId: planificacion.grupo_id,
  sesionNumero: index + 1,
  totalSesiones: fechasSesiones.length,
  unitAssignment: assignment,
  requerimientosDocente: planificacion.requerimientos_docente,
  // PHASE 3: Pass sessionBrief if available (to be implemented in UI)
  sessionBrief: undefined  // TODO: Extract from UI state when available
});
```

**Diff Summary**:
- Add `sessionBrief?: string` to `generateAIPlan()` params
- Include `sessionBrief` in payload to `modify-evaluation` (conditional)
- Update call site to pass `sessionBrief` (initially `undefined`, to be connected to UI later)

---

### 2. `src/pages/PlanificacionWizard.tsx`

**Changes Required**:

1. **Update `generarPlanesAutomaticamente()` payload**:
```typescript
const payload = {
  modo: 'generar_plan_html',
  sesionId: sesion.id,
  orden: sesion.orden,
  duracionMin: sesion.duracion_minutos,
  materia: materia || 'Sin especificar',
  nivel: nivel || 'Sin especificar',
  contenidos: contenidosSesion,
  competencias: competenciasSesion,
  criterios: criterios,
  instruccionesDocente: planificacion.requerimientos_docente || undefined,
  unitContext: unitContext,
  // PHASE 3: Include sessionBrief if available (to be implemented in UI)
  ...(sessionBriefs?.[i] && { sessionBrief: sessionBriefs[i] })
};
```

**Note**: `sessionBriefs` array will be populated from UI (to be implemented in Phase 3 UI work).

**Diff Summary**:
- Add `sessionBrief` to payload (conditional, from UI state)
- Extract `sessionBrief` for each session from UI-provided array

---

### 3. `supabase/functions/modify-evaluation/index.ts`

**Changes Required**:

1. **Extract `sessionBrief` from request body**:
```typescript
const {
  type,
  modification,
  groupContext,
  unitContext,
  sessionBrief  // PHASE 3: Optional per-session focus
} = await req.json();
```

2. **Build `sessionBriefSection`** (in `type === 'planning'` branch):
```typescript
// PHASE 3: Build sessionBrief section if provided
const sessionBriefSection = sessionBrief ? `
SESSION FOCUS (TEACHER-SPECIFIED):
${sessionBrief}

CRITICAL: This sessionBrief defines the primary focus of this session.
- Do NOT change, replace, broaden, narrow, or reinterpret it.
- Develop the lesson strictly around this focus.
- Ensure the DESARROLLO section directly and clearly develops this focus.
- Do NOT introduce a different main topic.

` : '';
```

3. **Inject `sessionBriefSection` into user prompt**:
```typescript
userPrompt = `PLANNING REQUEST:
${modification}
${sequenceContext}${sessionBriefSection}ADDITIONAL CONTEXT:
${groupContext?.additionalContext || 'Not specified'}

TASK: Generate specific, practical, and applicable didactic suggestions. Include concrete activities, necessary resources, and adaptations for different learning styles.

MANDATORY OUTPUT FORMAT:
- The response MUST be plain text (NO HTML, NO Markdown, NO code fences).
- The response MUST start with "INICIO" and MUST end after the "CIERRE" section.
- NO preamble, NO trailing text, NO extra sections or labels (Title, Objectives, Notes, etc.).
- MUST include exactly one section for each header, in this exact order:
  * INICIO
  * DESARROLLO
  * CIERRE
- Each section MUST include:
  * Actividad: (one or more sentences describing the activity)
  * Recursos: (comma-separated list)
- Do NOT include any other top-level headers.
- Headers MUST be uppercase Spanish: INICIO, DESARROLLO, CIERRE.
${sessionBrief ? '\n- If sessionBrief is provided, ensure the DESARROLLO section directly and clearly develops that focus. Do NOT introduce a different main topic.' : ''}`;
```

**Diff Summary**:
- Extract `sessionBrief` from request body
- Build `sessionBriefSection` conditional string
- Inject into user prompt (after `sequenceContext`, before `ADDITIONAL CONTEXT`)
- Add conditional note in MANDATORY OUTPUT FORMAT

---

### 4. `supabase/functions/generate-plan-completo/index.ts`

**Changes Required**:

1. **Extract `sessionBrief` from request body**:
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
  planActual,
  unitContext,
  sessionBrief  // PHASE 3: Optional per-session focus
} = await req.json();
```

2. **Build `sessionBriefSection`**:
```typescript
// PHASE 3: Build sessionBrief section if provided
const sessionBriefSection = sessionBrief ? `
ENFOQUE DE SESIÓN (ESPECIFICADO POR EL DOCENTE):
${sessionBrief}

CRÍTICO: Este sessionBrief define el enfoque principal de esta sesión.
- NO cambies, reemplaces, amplíes, reduzcas o reinterpretes este enfoque.
- Desarrolla la clase estrictamente alrededor de este enfoque.
- El título H1 debe ser exactamente este sessionBrief O una reformulación mínima y fiel (sin desviación del tema).
- El contenido del plan debe seguir estrictamente este enfoque mientras respeta las reglas de progresión de unitContext.

` : '';
```

3. **Inject `sessionBriefSection` into prompt**:
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
${perfilGrupo ? `- Perfil del grupo: ${perfilGrupo.dominante || 'mixto'} (${perfilGrupo.tamanio || 'sin especificar'} estudiantes)` : ''}
${estudiantes?.length ? `- Estudiantes con ajustes: ${estudiantes.filter(e => e.ajustes?.length).length}` : ''}
${secuenciaContext}${sessionBriefSection}${instruccionesDocenteSection}${planActual ? `\nPLAN ACTUAL A MODIFICAR:\n${planActual}` : ''}

ESTRUCTURA OBLIGATORIA - DEVOLVER SOLO HTML VÁLIDO:
<section id="plan">
  <h1>${sessionBrief ? `${sessionBrief}` : 'Título específico y claro de esta clase (debe ser diferente de otras clases en la misma unidad)'}</h1>
  // ... rest of structure
</section>

REQUISITOS ESTRICTOS:
1. Usar SOLO HTML válido - NO Markdown, NO code fences
2. NUNCA incluir "Diferenciación/Adaptaciones" dentro de las secciones Inicio, Desarrollo o Cierre
3. Incluir SIEMPRE: <strong>Actividad:</strong> y <strong>Recursos:</strong> en cada sección principal
4. Adaptar duraciones según el tiempo total (${duracionMin} min)
5. Incluir actividades específicas y detalladas
${sessionBrief ? '6. OBLIGATORIO: Si sessionBrief está presente, el título H1 debe ser exactamente el sessionBrief O una reformulación mínima y fiel. NO introduzcas un tema diferente.' : '6. OBLIGATORIO: El título H1 debe ser específico y diferente de otras clases en la misma unidad. No reutilices títulos de otras clases.'}
7. OBLIGATORIO: Los títulos H2 de Inicio, Desarrollo y Cierre DEBEN tener <strong> dentro del H2
// ... rest of requirements
`;
```

**Diff Summary**:
- Extract `sessionBrief` from request body
- Build `sessionBriefSection` conditional string (Spanish)
- Inject into prompt (after `secuenciaContext`, before `instruccionesDocenteSection`)
- Update `<h1>` example in ESTRUCTURA OBLIGATORIA to use `sessionBrief` if present
- Update REQUISITOS ESTRICTOS #6 to be conditional based on `sessionBrief`

---

## Backward Compatibility Strategy

### Guarantees

1. **If `sessionBrief` is NOT provided**:
   - All behavior identical to Phase 2.2.2
   - AI autonomously determines session focus
   - Progressive generation via `unitContext` works as before
   - Anti-duplication rules apply as before
   - Teacher requirements (`requerimientos_docente`) work as before

2. **If `sessionBrief` IS provided**:
   - Takes priority over autonomous topic selection
   - Does NOT override `unitContext` progression rules (still applies intro/middle/final/extra shaping)
   - Does NOT override anti-duplication rules
   - Does NOT override teacher general requirements (they become constraints)

### Testing Checklist

- [ ] Case 1: No briefs provided → Generation identical to Phase 2.2.2
- [ ] Case 2: Partial briefs → Sessions with brief follow it; sessions without brief are autonomous
- [ ] Case 3: Full briefs → All sessions follow teacher-defined focus
- [ ] Path A parser compatibility → Still extracts INICIO/DESARROLLO/CIERRE correctly
- [ ] Path B HTML structure → Still returns valid HTML with `<h1>` title
- [ ] Regression test → No behavior change when `sessionBrief` is absent

---

## UI Requirements (Future Work)

**Note**: UI implementation is not part of this Phase 3 design document, but the data flow must support it.

### Required UI Components

1. **Per-Session Brief Input**:
   - Optional text input for each session within a unit
   - Label: "Enfoque de la clase" or "Título/Tema de la sesión"
   - Placeholder: "Dejar vacío para generación automática"
   - Stored/held so each generation call knows the `sessionBrief` for that specific session

2. **Data Storage**:
   - Store `sessionBriefs` array (one per session) in component state
   - Pass to generation functions when calling `generateAIPlan()` or `generarPlanesAutomaticamente()`

3. **UI Location**:
   - Likely in `PlanificacionWizard.tsx` during unit definition step
   - Or in a separate step before finalizing planificación

---

## Acceptance Criteria

### Case 1: No Briefs Provided

- ✅ Generation is identical to Phase 2.2.2 behavior
- ✅ Progressive, non-duplicated plans
- ✅ AI autonomously determines session focus

### Case 2: Partial Briefs

- ✅ Sessions with a brief follow it strictly
- ✅ Sessions without a brief are generated autonomously
- ✅ Progression via `unitContext` remains consistent across all sessions

### Case 3: Full Briefs

- ✅ All sessions follow teacher-defined focus
- ✅ Path B titles match briefs faithfully (or minimal faithful rephrase)
- ✅ Progression (intro/middle/final/extra) is reflected in activity design, not topic drift

### Path A Compatibility

- ✅ Parser still extracts INICIO/DESARROLLO/CIERRE correctly
- ✅ Output format remains plain text (no HTML/Markdown)
- ✅ Labels remain Spanish: Actividad:, Recursos:
- ✅ DESARROLLO section develops `sessionBrief` focus when provided

### Path B Compatibility

- ✅ HTML structure remains valid
- ✅ `<h1>` title uses `sessionBrief` when provided (or minimal faithful rephrase)
- ✅ Title uniqueness naturally satisfied by teacher input when `sessionBrief` present
- ✅ All strict requirements remain intact

---

## Implementation Checklist

### Code Changes

- [ ] Update `src/hooks/useFullSessionGeneration.ts`:
  - [ ] Add `sessionBrief?: string` to `generateAIPlan()` params
  - [ ] Include `sessionBrief` in payload to `modify-evaluation`
  - [ ] Update call site to pass `sessionBrief` (initially `undefined`)

- [ ] Update `src/pages/PlanificacionWizard.tsx`:
  - [ ] Add `sessionBrief` to payload to `generate-plan-completo`
  - [ ] Extract `sessionBrief` from UI state (when UI is implemented)

- [ ] Update `supabase/functions/modify-evaluation/index.ts`:
  - [ ] Extract `sessionBrief` from request body
  - [ ] Build `sessionBriefSection` conditional string
  - [ ] Inject into user prompt (after `sequenceContext`)

- [ ] Update `supabase/functions/generate-plan-completo/index.ts`:
  - [ ] Extract `sessionBrief` from request body
  - [ ] Build `sessionBriefSection` conditional string (Spanish)
  - [ ] Inject into prompt (after `secuenciaContext`)
  - [ ] Update `<h1>` example in ESTRUCTURA OBLIGATORIA
  - [ ] Update REQUISITOS ESTRICTOS #6 to be conditional

### Testing

- [ ] Test Case 1: No briefs provided
- [ ] Test Case 2: Partial briefs
- [ ] Test Case 3: Full briefs
- [ ] Test Path A parser compatibility
- [ ] Test Path B HTML structure
- [ ] Regression test: No behavior change when `sessionBrief` absent

### Documentation

- [ ] Update Phase 3 design document with implementation results
- [ ] Document UI requirements for future work

---

## Notes

- **UI Implementation**: The UI for entering `sessionBrief` values is not part of this Phase 3 design. The code changes prepare the infrastructure, but UI work will be done separately.

- **Database Storage**: `sessionBrief` values may need to be stored in the database (e.g., in `sesiones_clase` table) if teachers want to edit them later. This is not part of Phase 3 core implementation but should be considered for future work.

- **Title Uniqueness**: When `sessionBrief` is provided, title uniqueness is naturally satisfied by teacher input. The prompt should not force a different title that deviates from the brief.

---

**End of Phase 3 Design Document**



















