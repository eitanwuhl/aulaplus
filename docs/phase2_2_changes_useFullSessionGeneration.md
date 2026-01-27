# Phase 2.2 Changes: useFullSessionGeneration - generateAIPlan & Parser

**File**: `src/hooks/useFullSessionGeneration.ts`  
**Date**: 26 de diciembre de 2024  
**Phase**: 2.2 Hardening

---

## 1. Updated `generateAIPlan()` Function

**Location**: Lines 235-313

### 1.1 Function Signature (Unchanged)

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
```

### 1.2 UnitContext Construction (Unchanged)

**Location**: Lines 250-258

```typescript
try {
  // PHASE 2: Construir unitContext si unitAssignment está disponible
  const unitContext = params.unitAssignment ? {
    unidadId: params.unitAssignment.unidadId,
    contenido: params.unitAssignment.contenido_texto,
    claseEnUnidad: params.unitAssignment.claseEnUnidad,
    totalClasesUnidad: params.unitAssignment.totalClasesUnidad,
    ...(params.unitAssignment.isExtraSlot && { isExtraSlot: true })
  } : undefined;
```

### 1.3 Updated Modification String (Removed Duplicate Sequence Context)

**Location**: Lines 260-289

**Before (Phase 2.1)**:
```typescript
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
...
```

**After (Phase 2.2)**:
```typescript
const { data, error } = await supabase.functions.invoke('modify-evaluation', {
  body: {
    type: 'planning',
    // PHASE 2.2: Remover contexto de secuencia duplicado - solo enviar solicitud base
    // El edge function modify-evaluation construye el contexto de secuencia desde unitContext
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
```

**Key Changes**:
- ✅ **Removed duplicate "CONTEXTO DE SECUENCIA DIDÁCTICA" block** from modification string
- ✅ **Single source of truth**: Only `modify-evaluation` edge function constructs sequence context from `unitContext`
- ✅ **Kept teacher requirements** (`requerimientosDocente`) in modification string (as before)
- ✅ **Still sends `unitContext` in payload** so edge function can build sequence context

---

## 2. Updated `cleanSection()` Function (Defensive Hardening)

**Location**: Lines 338-347

**Before (Phase 2.1)**:
```typescript
function cleanSection(section: string): string {
  return section
    .replace(/^(INICIO|DESARROLLO|CIERRE)[\s:]*\n?/i, '')
    .replace(/\*\*/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}
```

**After (Phase 2.2)**:
```typescript
function cleanSection(section: string): string {
  // PHASE 2.2: Sanitización defensiva para HTML/Markdown accidental
  return section
    .replace(/^(INICIO|DESARROLLO|CIERRE)[\s:]*\n?/i, '')  // Remover encabezado de sección
    .replace(/<[^>]+>/g, '')  // Remover tags HTML
    .replace(/\*\*/g, '')  // Remover markdown bold
    .replace(/#{1,6}\s*/g, '')  // Remover markdown headers
    .replace(/-{3,}/g, '')  // Remover markdown horizontal rules
    .replace(/\n+/g, ' ')  // Colapsar saltos de línea
    .replace(/\s+/g, ' ')  // Colapsar espacios múltiples
    .trim();
}
```

**Key Changes**:
- ✅ **Added HTML tag removal**: `/<[^>]+>/g` - strips all HTML tags
- ✅ **Added Markdown header removal**: `/#{1,6}\s*/g` - removes #, ##, ###, etc.
- ✅ **Added Markdown horizontal rule removal**: `/-{3,}/g` - removes ---
- ✅ **Added whitespace collapse**: `/\s+/g` - collapses multiple spaces to single space
- ✅ **Kept existing replacements**: section header removal, markdown bold removal, newline collapse

**Purpose**: Defensive hardening to handle cases where model accidentally returns HTML or Markdown despite instructions.

---

## 3. Related Parsing Logic (Unchanged)

### 3.1 `parseAIResponseToPlan()` Function

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
- ✅ Parser expects uppercase headers: `INICIO`, `DESARROLLO`, `CIERRE`
- ✅ Uses case-insensitive regex (`/i` flag)
- ✅ Calls `cleanSection()` on each matched section
- ✅ Falls back to default descriptions if sections not found
- ✅ Hardcoded durations: inicio=15, cierre=5, desarrollo=calculated

**Alignment with Prompt**:
- ✅ Prompt now enforces uppercase headers (INICIO, DESARROLLO, CIERRE)
- ✅ Prompt enforces plain text format (no HTML/Markdown)
- ✅ Parser can now reliably extract sections

---

## 4. Flow After Phase 2.2

### 4.1 Data Flow

```
useFullSessionGeneration.ts
  ↓
generateAIPlan({
  unitAssignment: assignment,
  requerimientosDocente: planificacion.requerimientos_docente
})
  ↓
unitContext construido desde unitAssignment
  ↓
Payload a modify-evaluation:
{
  type: 'planning',
  modification: "Genera un plan... [SIN contexto de secuencia duplicado]",
  groupContext: {...},
  unitContext: {...}  // ← Única fuente de verdad para contexto de secuencia
}
  ↓
modify-evaluation/index.ts
  ↓
sequenceContext construido desde unitContext (en español)
  ↓
userPrompt incluye sequenceContext + formato de salida estricto
  ↓
OpenAI API
  ↓
Respuesta: texto plano con INICIO/DESARROLLO/CIERRE
  ↓
parseAIResponseToPlan()
  ↓
cleanSection() sanitiza HTML/Markdown accidental
  ↓
Estructura parseada: { inicio, desarrollo, cierre }
```

### 4.2 Single Source of Truth

**Before Phase 2.2**:
- ❌ Sequence context duplicated in:
  1. `generateAIPlan()` modification string
  2. `modify-evaluation` sequenceContext
- ❌ Risk of drift between two locations

**After Phase 2.2**:
- ✅ Sequence context only in:
  1. `modify-evaluation` sequenceContext (built from `unitContext`)
- ✅ `generateAIPlan()` sends only baseline request + teacher requirements
- ✅ No duplication, no drift risk

---

## 5. Summary of Changes

| Component | Change | Purpose |
|-----------|--------|---------|
| **modification string** | Removed duplicate "CONTEXTO DE SECUENCIA DIDÁCTICA" block | Single source of truth |
| **cleanSection()** | Added HTML/Markdown sanitization | Defensive hardening against accidental format violations |
| **unitContext payload** | Still sent (unchanged) | Edge function builds sequence context from it |

---

## 6. Expected Behavior

### With `unitContext` Present

1. `generateAIPlan()` sends baseline request + `unitContext` in payload
2. `modify-evaluation` builds Spanish sequence context from `unitContext`
3. Prompt includes sequence context + strict output format rules
4. Model returns plain text with INICIO/DESARROLLO/CIERRE
5. Parser extracts sections reliably
6. `cleanSection()` sanitizes any accidental HTML/Markdown

### Without `unitContext` (Backward Compatibility)

1. `generateAIPlan()` sends baseline request (no `unitContext`)
2. `modify-evaluation` builds prompt without sequence context
3. Prompt still includes strict output format rules
4. Model returns plain text with INICIO/DESARROLLO/CIERRE
5. Parser extracts sections reliably
6. Works exactly as before Phase 2

---

## 7. Parser Resilience

**Before Phase 2.2**:
- ⚠️ Parser could fail if model returned HTML or Markdown
- No sanitization of accidental format violations

**After Phase 2.2**:
- ✅ `cleanSection()` removes HTML tags
- ✅ `cleanSection()` removes Markdown artifacts
- ✅ Parser more resilient to model mistakes
- ✅ Still expects plain text, but handles HTML/Markdown gracefully

---

## Summary

**Changes Made**:
1. ✅ Removed duplicate sequence context from `generateAIPlan()` modification string
2. ✅ Enhanced `cleanSection()` with HTML/Markdown sanitization
3. ✅ Single source of truth: only `modify-evaluation` builds sequence context

**Result**:
- ✅ No duplication of sequence context
- ✅ Parser more resilient to accidental HTML/Markdown
- ✅ Backward compatibility maintained
- ✅ Deterministic parsing of INICIO/DESARROLLO/CIERRE sections



















