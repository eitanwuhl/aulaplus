# Inspection: generate-plan-completo - Prompt & Strict Requirements (Phase 2.1)

**File**: `supabase/functions/generate-plan-completo/index.ts`  
**Date**: 26 de diciembre de 2024  
**Inspection Type**: READ-ONLY

---

## 1. Request Payload Destructuring

**Location**: Lines 38-54

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
  // PHASE 2: unitContext para generación progresiva (opcional para backward compatibility)
  unitContext
} = await req.json();
```

**Key Observations**:
- ✅ `unitContext` is extracted from request body
- ✅ `instruccionesDocente` is extracted (used for teacher requirements)
- ✅ Both are optional (no default values, can be `undefined`)
- ✅ Backward compatibility maintained

---

## 2. Construction of `secuenciaContext`

**Location**: Lines 56-72

```typescript
// PHASE 2.1: Construir sección de contexto de secuencia didáctica si unitContext está presente
const secuenciaContext = unitContext ? `
CONTEXTO DE SECUENCIA DIDÁCTICA:
Esta clase forma parte de una unidad temática llamada "${unitContext.contenido}".

- Esta es la clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad} de esta unidad.
- El contenido debe ser progresivo y no repetitivo.
- No repitas explicaciones ya dadas en clases anteriores.
- El título de la clase debe reflejar el enfoque específico de esta sesión y debe ser diferente de otras clases en la misma unidad.

INSTRUCCIONES ESPECÍFICAS SEGÚN POSICIÓN:
${unitContext.claseEnUnidad === 1 ? '- Esta es la PRIMERA clase: Enfócate en introducción, contextualización y exploración inicial. El título debe reflejar este propósito introductorio.' : ''}
${unitContext.claseEnUnidad > 1 && unitContext.claseEnUnidad < unitContext.totalClasesUnidad ? `- Esta es una clase INTERMEDIA (${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Comienza con una breve activación de conocimientos previos conectando con la clase anterior, sin repetir explicaciones largas. Profundiza y complejiza el contenido. Evita introducir nuevos conceptos centrales. El título debe reflejar este enfoque de profundización.' : ''}
${unitContext.claseEnUnidad === unitContext.totalClasesUnidad && !unitContext.isExtraSlot ? '- Esta es la ÚLTIMA clase: Evita introducir nuevos conceptos centrales. Enfócate en integración, transferencia, debate o actividades aplicadas. El título debe reflejar este propósito de síntesis/aplicación.' : ''}
${unitContext.isExtraSlot ? `- Esta es una clase ADICIONAL más allá de la secuencia original (clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Úsala preferentemente para repaso guiado, actividades integradoras, evaluación formativa o un proyecto aplicado. El título debe reflejar claramente este propósito (ej: "Repaso Integrador", "Proyecto Aplicado", "Evaluación Formativa").` : ''}

` : '';
```

**Key Observations**:
- ✅ Only built if `unitContext` is present (backward compatible)
- ✅ Contains general progressive instructions
- ✅ Contains specific instructions by class position (first, middle, final, extra)
- ✅ Explicitly enforces different titles
- ✅ For middle classes: "Comienza con breve activación... sin repetir explicaciones largas"
- ✅ For final classes: "Evita introducir nuevos conceptos centrales"
- ✅ For extra slots: Provides example titles

---

## 3. Construction of `instruccionesDocenteSection`

**Location**: Lines 74-87

```typescript
// PHASE 2: Construir sección de instrucciones del docente con contexto adicional
const instruccionesDocenteSection = instruccionesDocente ? `
INSTRUCCIONES DEL DOCENTE:
${instruccionesDocente}

Estas instrucciones pueden:
- Aplicar a toda la planificación
- Aplicar solo a algunas clases
- Indicar temas específicos para una clase puntual

Respeta explícitamente estas indicaciones si están presentes.
No inventes una secuencia distinta si el docente ya la definió.

` : '';
```

**Key Observations**:
- ✅ Only built if `instruccionesDocente` is present
- ✅ Includes teacher instructions verbatim
- ✅ Adds context about how instructions may apply
- ✅ Explicitly tells AI to respect teacher overrides

---

## 4. Full Prompt Template

**Location**: Lines 89-178

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
${secuenciaContext}${instruccionesDocenteSection}${planActual ? `\nPLAN ACTUAL A MODIFICAR:\n${planActual}` : ''}

ESTRUCTURA OBLIGATORIA - DEVOLVER SOLO HTML VÁLIDO:
<section id="plan">
  <h1>Título específico y claro de esta clase (debe ser diferente de otras clases en la misma unidad)</h1>

  <h2><strong>Inicio (15 min)</strong></h2>
  <h3>Actividad de apertura motivadora</h3>
  <p><strong>Actividad:</strong> Descripción específica de la actividad de inicio</p>
  <ul>
    <li>Paso detallado 1</li>
    <li>Paso detallado 2</li>
    <li>Paso detallado 3</li>
  </ul>
  <p><strong>Recursos:</strong> Lista de recursos específicos</p>

  <h2><strong>Desarrollo (${Math.max(duracionMin - 20, 30)} min)</strong></h2>
  <h3>Parte A - Actividad principal</h3>
  <ul>
    <li>Descripción detallada de la actividad</li>
    <li>Secuencia de pasos específicos</li>
  </ul>
  <p><strong>Recursos:</strong> Recursos necesarios</p>

  <h3>Parte B - Actividad secundaria</h3>
  <ul>
    <li>Descripción de la segunda actividad</li>
    <li>Pasos de implementación</li>
  </ul>

  <h2><strong>Cierre (5 min)</strong></h2>
  <h3>Actividad de síntesis</h3>
  <ul>
    <li>Síntesis de lo aprendido</li>
    <li>Reflexión grupal</li>
  </ul>

  <h2><strong>Diferenciación/Adaptaciones</strong></h2>
  <ul>
    <li><strong>Momento:</strong> Inicio - durante la actividad de apertura<br>
        <strong>Perfil/Necesidad:</strong> Estudiantes con dificultades de atención<br>
        <strong>Propósito:</strong> Facilitar la participación activa desde el inicio de la clase<br>
        <strong>Cómo aplicarla:</strong> Proporcionar apoyos visuales (imágenes claras) y permitir respuestas orales además de escritas</li>
    <li><strong>Momento:</strong> Desarrollo - durante el trabajo grupal<br>
        <strong>Perfil/Necesidad:</strong> Estudiantes con necesidades de adaptación curricular<br>
        <strong>Propósito:</strong> Garantizar acceso al contenido principal<br>
        <strong>Cómo aplicarla:</strong> Organizar grupos heterogéneos, asignar roles claros y proporcionar guías paso a paso con ejemplos</li>
    <li><strong>Momento:</strong> Cierre - durante la síntesis<br>
        <strong>Perfil/Necesidad:</strong> Estudiantes con dificultades de expresión escrita<br>
        <strong>Propósito:</strong> Permitir demostración de comprensión por múltiples vías<br>
        <strong>Cómo aplicarla:</strong> Aceptar síntesis mediante dibujos, mapas conceptuales o exposición oral además de textos escritos</li>
  </ul>
</section>

REQUISITOS ESTRICTOS:
1. Usar SOLO HTML válido - NO Markdown, NO code fences
2. NUNCA incluir "Diferenciación/Adaptaciones" dentro de las secciones Inicio, Desarrollo o Cierre
3. Incluir SIEMPRE: <strong>Actividad:</strong> y <strong>Recursos:</strong> en cada sección principal
4. Adaptar duraciones según el tiempo total (${duracionMin} min)
5. Incluir actividades específicas y detalladas
6. OBLIGATORIO: El título H1 debe ser específico y diferente de otras clases en la misma unidad. No reutilices títulos de otras clases.
7. OBLIGATORIO: Los títulos H2 de Inicio, Desarrollo y Cierre DEBEN tener <strong> dentro del H2
8. EJEMPLO CORRECTO: <h2><strong>Inicio (15 min)</strong></h2>
9. EJEMPLO INCORRECTO: <h2>Inicio (15 min)</h2>
10. OBLIGATORIO: La sección "Diferenciación/Adaptaciones" DEBE aparecer DESPUÉS de Cierre, al final del plan
11. Cada adaptación DEBE incluir:
    - <strong>Momento:</strong> Indica exactamente cuándo aplicar (Inicio/Desarrollo/Cierre y actividad específica)
    - <strong>Perfil/Necesidad:</strong> Para qué perfil de estudiante o necesidad está dirigida
    - <strong>Propósito:</strong> Qué mejora o facilita esta adaptación
    - <strong>Cómo aplicarla:</strong> Instrucciones concretas y prácticas, no vagas

DEVOLVER JSON EXACTO:
{
  "plan_html": "<section id=\\"plan\\">...</section>",
  "argumento_competencias": "<p>Explicación de cómo las actividades desarrollan las competencias seleccionadas</p>",
  "recursos": ["Proyector", "Pizarrón", "Marcadores", "Material específico"]
}
`;
```

**Key Observations**:
- ✅ Prompt includes `secuenciaContext` if `unitContext` is present
- ✅ Prompt includes `instruccionesDocenteSection` if `instruccionesDocente` is present
- ✅ Example structure shows title must be specific and different
- ✅ Strict requirements section explicitly enforces different titles (#6)
- ✅ Requires HTML format (not Markdown)
- ✅ Requires specific structure with sections

---

## 5. STRICT REQUIREMENTS / Output Rules Section

**Location**: Lines 155-170

```typescript
REQUISITOS ESTRICTOS:
1. Usar SOLO HTML válido - NO Markdown, NO code fences
2. NUNCA incluir "Diferenciación/Adaptaciones" dentro de las secciones Inicio, Desarrollo o Cierre
3. Incluir SIEMPRE: <strong>Actividad:</strong> y <strong>Recursos:</strong> en cada sección principal
4. Adaptar duraciones según el tiempo total (${duracionMin} min)
5. Incluir actividades específicas y detalladas
6. OBLIGATORIO: El título H1 debe ser específico y diferente de otras clases en la misma unidad. No reutilices títulos de otras clases.
7. OBLIGATORIO: Los títulos H2 de Inicio, Desarrollo y Cierre DEBEN tener <strong> dentro del H2
8. EJEMPLO CORRECTO: <h2><strong>Inicio (15 min)</strong></h2>
9. EJEMPLO INCORRECTO: <h2>Inicio (15 min)</h2>
10. OBLIGATORIO: La sección "Diferenciación/Adaptaciones" DEBE aparecer DESPUÉS de Cierre, al final del plan
11. Cada adaptación DEBE incluir:
    - <strong>Momento:</strong> Indica exactamente cuándo aplicar (Inicio/Desarrollo/Cierre y actividad específica)
    - <strong>Perfil/Necesidad:</strong> Para qué perfil de estudiante o necesidad está dirigida
    - <strong>Propósito:</strong> Qué mejora o facilita esta adaptación
    - <strong>Cómo aplicarla:</strong> Instrucciones concretas y prácticas, no vagas
```

**Key Observations**:
- ✅ Rule #6 explicitly enforces different titles
- ✅ Rules #7-9 enforce H2 format with `<strong>` tags
- ✅ Rule #10 enforces "Diferenciación/Adaptaciones" placement
- ✅ Rule #11 enforces structure of each adaptation
- ✅ Rules #1-5 enforce HTML format and content requirements

---

## 6. Expected Output Format

**Location**: Lines 172-177

```typescript
DEVOLVER JSON EXACTO:
{
  "plan_html": "<section id=\\"plan\\">...</section>",
  "argumento_competencias": "<p>Explicación de cómo las actividades desarrollan las competencias seleccionadas</p>",
  "recursos": ["Proyector", "Pizarrón", "Marcadores", "Material específico"]
}
```

**Key Observations**:
- ✅ Response must be JSON
- ✅ `plan_html` must contain HTML structure
- ✅ `argumento_competencias` must be HTML string
- ✅ `recursos` must be array of strings
- ✅ HTML must include `<section id="plan">` wrapper

---

## 7. Complete Prompt Structure (When unitContext Present)

**Full Prompt** (with `unitContext` and `instruccionesDocente`):

```
Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP).
Generá el plan de la sesión [orden] con duración [duracionMin] minutos.

CONTEXTO DE LA CLASE:
- Materia: [materia]
- Nivel: [nivel]
- Contenidos ANEP: [contenidos]
- Competencias: [competencias]
- Criterios de logro: [criterios]
- Perfil del grupo: [perfilGrupo.dominante] ([perfilGrupo.tamanio] estudiantes)
- Estudiantes con ajustes: [count]

CONTEXTO DE SECUENCIA DIDÁCTICA:
Esta clase forma parte de una unidad temática llamada "[unitContext.contenido]".

- Esta es la clase [unitContext.claseEnUnidad] de [unitContext.totalClasesUnidad] de esta unidad.
- El contenido debe ser progresivo y no repetitivo.
- No repitas explicaciones ya dadas en clases anteriores.
- El título de la clase debe reflejar el enfoque específico de esta sesión y debe ser diferente de otras clases en la misma unidad.

INSTRUCCIONES ESPECÍFICAS SEGÚN POSICIÓN:
[Specific instruction based on claseEnUnidad position]

INSTRUCCIONES DEL DOCENTE:
[instruccionesDocente]

Estas instrucciones pueden:
- Aplicar a toda la planificación
- Aplicar solo a algunas clases
- Indicar temas específicos para una clase puntual

Respeta explícitamente estas indicaciones si están presentes.
No inventes una secuencia distinta si el docente ya la definió.

ESTRUCTURA OBLIGATORIA - DEVOLVER SOLO HTML VÁLIDO:
<section id="plan">
  <h1>Título específico y claro de esta clase (debe ser diferente de otras clases en la misma unidad)</h1>
  ...
</section>

REQUISITOS ESTRICTOS:
1. Usar SOLO HTML válido - NO Markdown, NO code fences
...
6. OBLIGATORIO: El título H1 debe ser específico y diferente de otras clases en la misma unidad. No reutilices títulos de otras clases.
...

DEVOLVER JSON EXACTO:
{
  "plan_html": "<section id=\"plan\">...</section>",
  "argumento_competencias": "<p>...</p>",
  "recursos": [...]
}
```

---

## 8. Summary

**Request Payload**:
- ✅ Extracts `unitContext` and `instruccionesDocente`
- ✅ Both optional for backward compatibility

**Context Construction**:
- ✅ `secuenciaContext`: Progressive instructions with position-specific rules
- ✅ `instruccionesDocenteSection`: Teacher requirements with context

**Prompt Structure**:
- ✅ Includes class context
- ✅ Includes sequence context (if `unitContext` present)
- ✅ Includes teacher instructions (if present)
- ✅ Shows example HTML structure with specific title requirement
- ✅ Lists strict requirements including title uniqueness (#6)

**Output Requirements**:
- ✅ Must return JSON with `plan_html`, `argumento_competencias`, `recursos`
- ✅ HTML must follow strict structure
- ✅ Title must be specific and different from other classes



















