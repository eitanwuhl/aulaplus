# Inspection: useFullSessionGeneration - AI Plan Generation & Parsing

**File**: `src/hooks/useFullSessionGeneration.ts`  
**Date**: 26 de diciembre de 2024  
**Inspection Type**: READ-ONLY

---

## 1. Full `generateAIPlan()` Function

**Location**: Lines 235-313

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
  // PHASE 2: Metadata de asignación para generación progresiva
  unitAssignment?: UnitAssignmentMetadata;
  requerimientosDocente?: string;
}) {
  try {
    // PHASE 2: Construir unitContext si unitAssignment está disponible
    const unitContext = params.unitAssignment ? {
      unidadId: params.unitAssignment.unidadId,
      contenido: params.unitAssignment.contenido_texto,
      claseEnUnidad: params.unitAssignment.claseEnUnidad,
      totalClasesUnidad: params.unitAssignment.totalClasesUnidad,
      ...(params.unitAssignment.isExtraSlot && { isExtraSlot: true })
    } : undefined;

    const { data, error } = await supabase.functions.invoke('modify-evaluation', {
      body: {
        type: 'planning',
        modification: `Genera un plan de clase estructurado para la sesión ${params.sesionNumero} de ${params.totalSesiones}:

MATERIA: ${params.materia}
CONTENIDO: ${params.contenido}
MODALIDAD PRINCIPAL: ${params.modalidad}
DURACIÓN: ${params.duracionMinutos} minutos

${unitContext ? `CONTEXTO DE SECUENCIA DIDÁCTICA:
Esta clase forma parte de una unidad temática llamada "${unitContext.contenido}".

- Esta es la clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad} de esta unidad.
- El contenido debe ser progresivo.
- No repitas explicaciones ya dadas en clases anteriores.
- Si es la primera clase, introduce el tema y el contexto.
- Si es una clase intermedia, profundiza y complejiza.
- Si es la última clase, prioriza síntesis, reflexión, debate o aplicación.
${unitContext.isExtraSlot ? 'Esta clase es adicional: puede usarse para repaso, evaluación o proyecto integrador.' : ''}

` : ''}Estructura necesaria:
- INICIO (15 min): Actividad de apertura motivadora
- DESARROLLO (40 min): Actividades principales adaptadas a modalidad ${params.modalidad}
- CIERRE (5 min): Síntesis y reflexión

${params.diferenciacion ? `DIFERENCIACIÓN REQUERIDA: ${params.diferenciacion}` : ''}
${params.requerimientosDocente ? `\nINSTRUCCIONES DEL DOCENTE:\n${params.requerimientosDocente}\n\nEstas instrucciones pueden:\n- Aplicar a toda la planificación\n- Aplicar solo a algunas clases\n- Indicar temas específicos para una clase puntual\n\nRespeta explícitamente estas indicaciones si están presentes.\nNo inventes una secuencia distinta si el docente ya la definió.` : ''}

Incluye diferenciación específica integrada en cada sección, recursos concretos y actividades detalladas.`,
        groupContext: {
          subject: params.materia,
          content: [params.contenido],
          competencies: params.competencias,
          groupName: params.grupoId,
          additionalContext: `Modalidad: ${params.modalidad}, Sesión ${params.sesionNumero}/${params.totalSesiones}`
        },
        // PHASE 2: Incluir unitContext en payload (opcional para backward compatibility)
        ...(unitContext && { unitContext })
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

**Key Observations**:
- ✅ Constructs `unitContext` from `unitAssignment` if available
- ✅ Includes `unitContext` in payload to `modify-evaluation`
- ✅ Includes `requerimientosDocente` in `modification` string
- ✅ Calls `modify-evaluation` edge function with `type: 'planning'`
- ✅ Parses response using `parseAIResponseToPlan()`
- ✅ Falls back to `generateFallbackPlan()` on error

---

## 2. Parsing Logic: `parseAIResponseToPlan()`

**Location**: Lines 315-336

```typescript
// Parsear respuesta de IA a estructura de plan
function parseAIResponseToPlan(contenido: string, duracionTotal: number) {
  // Buscar secciones en el contenido
  const inicioMatch = contenido.match(/INICIO[\s\S]*?(?=DESARROLLO|$)/i);
  const desarrolloMatch = contenido.match(/DESARROLLO[\s\S]*?(?=CIERRE|$)/i);
  const cierreMatch = contenido.match(/CIERRE[\s\S]*$/i);

  return {
    inicio: {
      descripcion: inicioMatch ? cleanSection(inicioMatch[0]) : 'Actividad de apertura motivadora adaptada al grupo',
      duracion: 15
    },
    desarrollo: {
      descripcion: desarrolloMatch ? cleanSection(desarrolloMatch[0]) : 'Actividades principales de exploración y construcción de conocimiento',
      duracion: Math.max(duracionTotal - 20, 30)
    },
    cierre: {
      descripcion: cierreMatch ? cleanSection(cierreMatch[0]) : 'Síntesis de lo aprendido y reflexión grupal',
      duracion: 5
    }
  };
}
```

**Key Observations**:
- ✅ Uses regex to find sections: `INICIO`, `DESARROLLO`, `CIERRE`
- ✅ Regex patterns:
  - `INICIO`: Matches until `DESARROLLO` or end of string
  - `DESARROLLO`: Matches until `CIERRE` or end of string
  - `CIERRE`: Matches until end of string
- ✅ Case-insensitive matching (`/i` flag)
- ✅ Falls back to default descriptions if sections not found
- ✅ Calls `cleanSection()` to clean each section
- ✅ Hardcoded durations: inicio=15, cierre=5, desarrollo=calculated

**Potential Issues**:
- ⚠️ Parser expects text format (INICIO/DESARROLLO/CIERRE), but `modify-evaluation` may return HTML or structured text
- ⚠️ No validation that response contains expected structure
- ⚠️ Parser may not handle HTML responses from `modify-evaluation` correctly

---

## 3. Helper Function: `cleanSection()`

**Location**: Lines 338-344

```typescript
function cleanSection(section: string): string {
  return section
    .replace(/^(INICIO|DESARROLLO|CIERRE)[\s:]*\n?/i, '')
    .replace(/\*\*/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}
```

**Key Observations**:
- ✅ Removes section headers (INICIO/DESARROLLO/CIERRE)
- ✅ Removes markdown bold markers (`**`)
- ✅ Replaces newlines with spaces
- ✅ Trims whitespace
- ⚠️ Does NOT handle HTML tags (may leave HTML in description if response is HTML)

---

## 4. Fallback Logic: `generateFallbackPlan()`

**Location**: Lines 346-362

```typescript
// Plan de respaldo si falla la IA
function generateFallbackPlan(params: { materia: string; contenido: string; modalidad: string; duracionMinutos: number }) {
  return {
    inicio: {
      descripcion: `Apertura de la clase de ${params.materia} con actividad motivadora relacionada con ${params.contenido}. Modalidad: ${params.modalidad}.`,
      duracion: 15
    },
    desarrollo: {
      descripcion: `Desarrollo del contenido "${params.contenido}" mediante actividades adaptadas a la modalidad ${params.modalidad}. Incluye exploración, análisis y construcción de conocimiento.`,
      duracion: Math.max(params.duracionMinutos - 20, 30)
    },
    cierre: {
      descripcion: 'Síntesis de lo aprendido, reflexión grupal y proyección para próximas clases.',
      duracion: 5
    }
  };
}
```

**Key Observations**:
- ✅ Generates generic plan structure
- ✅ Uses `params.contenido` and `params.modalidad` in descriptions
- ✅ Calculates desarrollo duration: `Math.max(duracionMinutos - 20, 30)`
- ✅ Fixed durations for inicio (15) and cierre (5)
- ✅ No progressive context in fallback (generic descriptions)

---

## 5. Assumptions About Format

### 5.1 Expected Response Format from `modify-evaluation`

**From `generateAIPlan()`**:
- Expects `data?.content` to be a string
- Assumes content contains text sections labeled "INICIO", "DESARROLLO", "CIERRE"
- Does NOT expect HTML structure
- Does NOT expect JSON structure

**Potential Mismatch**:
- ⚠️ `modify-evaluation` with `type: 'planning'` may return:
  - Plain text with sections
  - HTML structure
  - Structured suggestions (not a plan)
- ⚠️ Parser expects text format, but response may be different

### 5.2 Parsing Assumptions

**Regex Patterns**:
- Assumes sections are separated by keywords "DESARROLLO" and "CIERRE"
- Assumes case-insensitive matching
- Assumes sections appear in order: INICIO → DESARROLLO → CIERRE

**Fallback Behavior**:
- If section not found, uses default description
- No error thrown if parsing fails
- Always returns valid structure (3 sections with descriptions and durations)

---

## 6. Summary of Parsing Logic

**What the Parser Does**:
1. ✅ Extracts text between "INICIO" and "DESARROLLO" → `inicio.descripcion`
2. ✅ Extracts text between "DESARROLLO" and "CIERRE" → `desarrollo.descripcion`
3. ✅ Extracts text after "CIERRE" → `cierre.descripcion`
4. ✅ Cleans each section (removes headers, markdown, newlines)
5. ✅ Assigns fixed durations (inicio=15, cierre=5, desarrollo=calculated)

**What the Parser Does NOT Handle**:
- ❌ HTML structure (expects plain text)
- ❌ JSON responses
- ❌ Missing sections (falls back to defaults, no error)
- ❌ Progressive context (parser doesn't use `unitContext` information)
- ❌ Title extraction (parser doesn't extract class title)

**Potential Issues**:
- ⚠️ If `modify-evaluation` returns HTML, parser may include HTML tags in descriptions
- ⚠️ If response format changes, parser may fail silently (uses defaults)
- ⚠️ Parser doesn't validate that response matches expected format
- ⚠️ No extraction of title, resources, or other metadata from response

---

## 7. Comparison with Path B

**Path B (`generate-plan-completo`)**:
- Returns structured JSON: `{ plan_html, argumento_competencias, recursos }`
- Response is HTML, not text sections
- No parsing needed (direct HTML)

**Path A (`modify-evaluation`)**:
- Returns `{ content: string }` (text)
- Parser expects text sections (INICIO/DESARROLLO/CIERRE)
- Parses into structured object

**Mismatch Risk**:
- ⚠️ If `modify-evaluation` changes format, parser may fail
- ⚠️ Parser doesn't handle HTML (but `modify-evaluation` may return HTML for `type: 'planning'`)

---

## Summary

**`generateAIPlan()` Function**:
- ✅ Constructs `unitContext` from `unitAssignment`
- ✅ Sends complete payload to `modify-evaluation`
- ✅ Includes progressive context in `modification` string
- ✅ Parses response using regex-based parser

**Parsing Logic**:
- ✅ Extracts INICIO/DESARROLLO/CIERRE sections using regex
- ✅ Cleans sections (removes headers, markdown)
- ✅ Falls back to defaults if sections not found
- ⚠️ Assumes text format (may not handle HTML correctly)
- ⚠️ Doesn't extract title or other metadata

**Fallback Logic**:
- ✅ Generates generic plan structure
- ✅ Uses content and modality in descriptions
- ✅ No progressive context in fallback















