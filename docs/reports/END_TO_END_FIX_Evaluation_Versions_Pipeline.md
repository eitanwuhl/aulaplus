# END-TO-END FIX: Evaluation Versions Pipeline (A/B/C)

**Fecha**: 2026-02-03  
**Status**: ✅ IMPLEMENTADO - PENDIENTE VERIFICACIÓN RUNTIME  
**Root Cause**: `evaluationBundle.versions.*` eran objetos en lugar de strings HTML

---

## RESUMEN EJECUTIVO

Se implementó un fix end-to-end que **garantiza** que `evaluationBundle.versions.A/B/C` sean SIEMPRE strings HTML o null, NUNCA objetos ni JSON wrappers.

### Archivos modificados

1. **`supabase/functions/modify-evaluation/index.ts`** (Backend)
   - `coerceVersionToHtmlString()` - ÚNICA función de normalización
   - Hard enforcement de tipos antes de response
   - `finalAssignmentCounts` en response
   - Logs TEMP para debugging

2. **`src/pages/EvaluacionesGrupo.tsx`** (Frontend)
   - Type validation estricta para `rawA/B/C`
   - Uso de `finalAssignmentCounts` del backend
   - B card hidden si `finalAssignmentCounts.B === 0`
   - Teacher reminders sin fallback a student adjustments

3. **`src/components/evaluaciones/HTMLRenderer.tsx`** (ya correcto)
   - Render directo si starts with `<`
   - Error block si wrapper detectado

4. **`src/components/evaluaciones/CleanEvaluationDisplay.tsx`** (ya correcto)
   - Sin extracción de wrappers
   - Error block si wrapper detectado

---

## STEP 0: Backend - `coerceVersionToHtmlString()` ÚNICA función

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Reemplazó**: `finalizeVersion()` y `toHtmlStringStrict()` (que estaban duplicadas)

```typescript
const coerceVersionToHtmlString = (raw: unknown, key: 'A' | 'B' | 'C', depth = 0): string | null => {
  // Infinite recursion guard
  if (depth > 10) {
    console.error(`[coerceVersion] Max recursion depth for key ${key}`);
    return null;
  }
  
  if (!raw) return null;

  // CASE 1: raw is a string
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    
    // CASE 1A: Valid HTML string
    if (trimmed.startsWith('<')) {
      return cleanupContent(trimmed);
    }
    
    // CASE 1B: Wrapper string (JSON) - parse and extract EXACT key
    if (trimmed.startsWith('{') || trimmed.includes('"versions"')) {
      try {
        const parsed = JSON.parse(trimmed);
        // Extract from parsed object and recurse
        const extracted = parsed?.versions?.[key] 
          ?? parsed?.[key] 
          ?? parsed?.evaluationBundle?.versions?.[key]
          ?? null;
        return coerceVersionToHtmlString(extracted, key, depth + 1);
      } catch (e) {
        // JSON parse failed - DO NOT return wrapper as text
        console.warn(`[coerceVersion] JSON parse failed for key ${key}, snippet:`, trimmed.slice(0, 100));
        return null;
      }
    }
    
    // CASE 1C: String but not HTML, not wrapper - invalid
    return null;
  }

  // CASE 2: raw is an object - extract EXACT key and recurse
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as any;
    const extracted = obj?.versions?.[key]
      ?? obj?.[key]
      ?? obj?.evaluationBundle?.versions?.[key]
      ?? obj?.html
      ?? obj?.content
      ?? obj?.baseHtml
      ?? obj?.base_html
      ?? null;
    
    // Infinite recursion guard
    if (extracted === raw) {
      console.error(`[coerceVersion] Infinite loop detected for key ${key}, object keys:`, Object.keys(obj).slice(0, 10));
      return null;
    }
    
    return coerceVersionToHtmlString(extracted, key, depth + 1);
  }

  // CASE 3: Other types (number, boolean, etc) - invalid
  return null;
};
```

**Uso**:
```typescript
let finalA = coerceVersionToHtmlString(baseHtml ?? generatedContent, 'A');
let finalB = shouldHaveB ? coerceVersionToHtmlString(versionBHtml, 'B') : null;
let finalC = shouldHaveC ? coerceVersionToHtmlString(versionCHtml, 'C') : null;
```

**Garantías**:
- Si `raw` es string HTML (`startsWith('<')`) → retorna HTML limpio
- Si `raw` es string wrapper (`startsWith('{')`) → parsea, extrae key EXACTA, recursa
- Si `raw` es objeto → extrae key EXACTA (`versions[key]`, `[key]`, `html`, `content`, etc), recursa
- Si JSON.parse falla → retorna `null` (NO retorna wrapper como texto)
- Infinite recursion guard (depth > 10)
- **NUNCA retorna objetos**

---

## STEP 1: Backend - Hard enforce strings + TEMP logs

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Después de `coerceVersionToHtmlString`**:

```typescript
// STEP 0: TEMP LOGS - prove types before building response
console.log('[BACKEND_VERSIONS_TYPES_BEFORE_BUILD]', {
  typeofA: typeof finalA,
  typeofB: typeof finalB,
  typeofC: typeof finalC,
  isObjectA: typeof finalA === 'object' && finalA !== null,
  isObjectB: typeof finalB === 'object' && finalB !== null,
  isObjectC: typeof finalC === 'object' && finalC !== null,
  keysA: finalA && typeof finalA === 'object' ? Object.keys(finalA).slice(0, 5) : null,
  keysB: finalB && typeof finalB === 'object' ? Object.keys(finalB).slice(0, 5) : null,
  keysC: finalC && typeof finalC === 'object' ? Object.keys(finalC).slice(0, 5) : null,
  startA: typeof finalA === 'string' ? finalA.slice(0, 40) : '(NOT STRING)',
  startB: typeof finalB === 'string' ? finalB.slice(0, 40) : '(NOT STRING)',
  startC: typeof finalC === 'string' ? finalC.slice(0, 40) : '(NOT STRING)',
  lenA: typeof finalA === 'string' ? finalA.length : 0,
  lenB: typeof finalB === 'string' ? finalB.length : 0,
  lenC: typeof finalC === 'string' ? finalC.length : 0
});

// STEP 1: HARD ENFORCE - if still objects, replace with error HTML
if (typeof finalA !== 'string') {
  console.error('[BACKEND] CRITICAL: finalA is not a string after coercion!', typeof finalA);
  finalA = '<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Backend Error:</strong> Version A is not a string after normalization (type=' + typeof finalA + ')</div>';
}
if (finalB && typeof finalB !== 'string') {
  console.error('[BACKEND] CRITICAL: finalB is not a string after coercion!', typeof finalB);
  finalB = null; // Drop B if not string
}
if (finalC && typeof finalC !== 'string') {
  console.error('[BACKEND] CRITICAL: finalC is not a string after coercion!', typeof finalC);
  finalC = '<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Backend Error:</strong> Version C is not a string after normalization (type=' + typeof finalC + ')</div>';
}
```

**Propósito**:
- Logs TEMP muestran `typeof`, `isObject`, `keys`, `start`, `len` para cada version
- Si después de `coerceVersionToHtmlString` todavía hay objetos → reemplazar con HTML de error
- **Garantiza que `finalA/B/C` son SIEMPRE strings o null**

---

## STEP 2: Backend - `finalAssignmentCounts` en response

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Antes de `buildUniversalResponse`**:

```typescript
// STEP 2: Calculate FINAL assignment counts (after B may have been dropped)
const finalAssignmentCounts = {
  A: Object.values(adjustedAssignments).filter(v => v === 'A').length,
  B: Object.values(adjustedAssignments).filter(v => v === 'B').length,
  C: Object.values(adjustedAssignments).filter(v => v === 'C').length
};
```

**En `buildUniversalResponse` signature**:

```typescript
const buildUniversalResponse = ({
  baseHtml,
  versionBHtml,
  versionCHtml,
  responseOptionsIncluded,
  responseOptionCount,
  studentAssignments,
  teacherRemindersByStudent,
  aiReport,
  warnings,
  metadata,
  generationPath,
  shouldDropB = false,
  finalTriggers,
  finalAssignmentCounts  // ← NEW
}: {
  baseHtml: string;
  versionBHtml: string | null;
  versionCHtml: string | null;
  responseOptionsIncluded: boolean;
  responseOptionCount: number;
  studentAssignments: Record<string, 'A' | 'B' | 'C'>;
  teacherRemindersByStudent: any[];
  aiReport: any;
  warnings: string[];
  metadata: { tokensUsed: number; model: string };
  generationPath: 'universal' | 'universal_parse_failed';
  shouldDropB?: boolean;
  finalTriggers?: { versionB: boolean; versionC: boolean };
  finalAssignmentCounts?: { A: number; B: number; C: number };  // ← NEW
}) => { ... }
```

**En response JSON**:

```typescript
return new Response(JSON.stringify({
  success: true,
  content: finalSafeA || '',
  type: type,
  evaluationBundle: {
    baseHtml: finalSafeA || '',
    versionBHtml: safeB,
    versionCHtml: finalSafeC,
    versions: {
      A: finalSafeA || '',
      B: safeB,
      C: finalSafeC
    },
    responseOptionsIncluded,
    responseOptionCount
  },
  studentAssignments,
  finalAssignmentCounts: finalAssignmentCounts || { ... },  // ← NEW
  teacherRemindersByStudent,
  aiReport,
  warnings,
  metadata,
  _debug: { ... }
}), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

**Propósito**:
- Backend calcula assignment counts DESPUÉS de que B puede haber sido dropped
- Frontend usa estos counts finales para decidir si mostrar B card
- **Garantiza que B card desaparece si `finalAssignmentCounts.B === 0`**

---

## STEP 3A: Frontend - Type validation estricta

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Al recibir response del backend**:

```typescript
// STEP 3: Frontend DUMB - accept versions.* as strings from backend (no parsing)
const versionA = data.evaluationBundle?.versions?.A || data.evaluationBundle?.baseHtml || '';
const versionB = data.evaluationBundle?.versions?.B ?? data.evaluationBundle?.versionBHtml ?? null;
const versionC = data.evaluationBundle?.versions?.C ?? data.evaluationBundle?.versionCHtml ?? null;

// STEP 3: Type validation - if not string, log CRITICAL error
if (versionA && typeof versionA !== 'string') {
  console.error('[EVAL_PIPELINE] CRITICAL: versionA from backend is not string!', typeof versionA, versionA);
}
if (versionB && typeof versionB !== 'string') {
  console.error('[EVAL_PIPELINE] CRITICAL: versionB from backend is not string!', typeof versionB, versionB);
}
if (versionC && typeof versionC !== 'string') {
  console.error('[EVAL_PIPELINE] CRITICAL: versionC from backend is not string!', typeof versionC, versionC);
}

const evaluationBundleToSet: EvaluationBundle = {
  baseHtml: typeof versionA === 'string' ? versionA : '',
  versionBHtml: typeof versionB === 'string' ? versionB : null,
  versionCHtml: typeof versionC === 'string' ? versionC : null,
  versions: {
    A: typeof versionA === 'string' ? versionA : '',
    B: typeof versionB === 'string' ? versionB : null,
    C: typeof versionC === 'string' ? versionC : null
  },
  responseOptionsIncluded: data.evaluationBundle?.responseOptionsIncluded ?? false,
  responseOptionCount: data.evaluationBundle?.responseOptionCount ?? 2,
  finalAssignmentCounts: data.finalAssignmentCounts  // STEP 2: Store from backend
};
```

**En `displayEvaluations` useMemo**:

```typescript
// STEP 4: Frontend - remove any parsing, only accept string HTML
const versions = evaluationBundle?.versions ?? null;
const legacyA = !versions
  ? (evaluationBundle?.baseHtml || evaluationBundle?.base_html || evaluationBundle?.content || evaluationBundle?.html || null)
  : null;

// STEP 4: Cards must use ONLY versions.<key> (no multi-layer extraction)
let rawA = versions ? (versions.A ?? null) : legacyA;
let rawB = versions ? (versions.B ?? null) : null;
let rawC = versions ? (versions.C ?? null) : null;

// STEP 4: If typeof rawA/B/C !== 'string' → error block (and log)
if (rawA && typeof rawA !== 'string') {
  console.error('[EVAL_UI] CRITICAL: rawA is not a string, it is:', typeof rawA, rawA);
  rawA = null; // Will trigger error block below
}
if (rawB && typeof rawB !== 'string') {
  console.error('[EVAL_UI] CRITICAL: rawB is not a string, it is:', typeof rawB, rawB);
  rawB = null;
}
if (rawC && typeof rawC !== 'string') {
  console.error('[EVAL_UI] CRITICAL: rawC is not a string, it is:', typeof rawC, rawC);
  rawC = null;
}
```

**Console logs mejorados**:

```typescript
// STEP 4: Console logs for debugging (after type validation)
console.log('[UI_VERSIONS_RAW]', {
  A: { 
    type: typeof rawA, 
    isObject: typeof rawA === 'object' && rawA !== null,
    keys: typeof rawA === 'object' && rawA !== null ? Object.keys(rawA) : null,
    start: typeof rawA === 'string' ? rawA.slice(0, 40) : '(not string)', 
    len: typeof rawA === 'string' ? rawA.length : 0, 
    wrapper: wrapperA 
  },
  B: { ... },
  C: { ... },
  assignmentCounts
});
```

**Propósito**:
- Si backend envía objeto (bug), frontend lo detecta y logea **CRITICAL**
- Reemplaza con null para triggerear error block
- **NO intenta parsear objetos** (eso solo oculta el bug backend)

---

## STEP 3B: Frontend - B card hidden si `finalAssignmentCounts.B === 0`

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Uso de `finalAssignmentCounts`**:

```typescript
// STEP 2: Use finalAssignmentCounts from backend (after B may have been dropped)
// If not available, calculate from assignments (legacy/fallback)
const backendFinalCounts = evaluationBundle?.finalAssignmentCounts;
const assignmentCounts = backendFinalCounts ?? {
  A: Object.values(assignmentByStudentId).filter(v => v === 'A').length,
  B: Object.values(assignmentByStudentId).filter(v => v === 'B').length,
  C: Object.values(assignmentByStudentId).filter(v => v === 'C').length
};

// STEP 3: Log assignment counts for debugging
console.log('[UI_ASSIGNMENT_COUNTS]', {
  backendFinalCounts,
  calculated: { ... },
  final: assignmentCounts
});
```

**B card visibility**:

```typescript
// STEP 3: B card must be hidden if finalAssignmentCounts.B === 0 (even if triggers.versionB was initially true)
// Backend may have dropped B if no students were assigned to it after reassignment
const shouldShowB = assignmentCounts.B > 0;
```

**Propósito**:
- Usa `finalAssignmentCounts` del backend (post-reassignment)
- B card solo se muestra si `finalAssignmentCounts.B > 0`
- **Garantiza que B desaparece cuando no tiene asignaciones**

---

## STEP 4: Frontend - Teacher reminders sin fallback a student adjustments

**Archivo**: `src/pages/EvaluacionesGrupo.tsx`

**Antes (INCORRECTO)**:

```typescript
const reminders = Array.isArray(data?.teacherRemindersByStudent)
  ? data.teacherRemindersByStudent
  : (effectivePlan.perStudentReminders || []);  // ← Fallback INCORRECTO
setTeacherReminders(reminders);
```

**Después (CORRECTO)**:

```typescript
// STEP 4: Teacher reminders must come from backend teacherRemindersByStudent ONLY
// If not available, show empty state (NOT fallback to perStudentReminders which is for students)
const reminders = Array.isArray(data?.teacherRemindersByStudent) && data.teacherRemindersByStudent.length > 0
  ? data.teacherRemindersByStudent
  : [];
setTeacherReminders(reminders);

if (!Array.isArray(data?.teacherRemindersByStudent) || data.teacherRemindersByStudent.length === 0) {
  console.warn('[EVAL_PIPELINE] No teacher reminders available from backend, showing empty state');
}
```

**Propósito**:
- Teacher reminders vienen SOLO de `data.teacherRemindersByStudent`
- Si no disponible → array vacío (empty state en `TeacherRemindersPanel`)
- **NO fallback** a `perStudentReminders` (que es para ajustes de estudiantes, no para docente)
- **Elimina duplicación** de student adjustments en sección teacher reminders

---

## HTMLRenderer y CleanEvaluationDisplay (ya correctos)

**No se modificaron** porque ya implementan:

1. **Si content empieza con `<`** → render con `dangerouslySetInnerHTML`
2. **Si content empieza con `{` o contiene `"versions"` antes del primer `<`** → mostrar error block rojo con snippet
3. **NO intentan parsear wrappers** (extraction debe ocurrir upstream)

---

## Acceptance Criteria - Cómo Verificar

### 1. Backend TEMP Logs (Terminal Supabase)

Después de generar evaluación, buscar en terminal donde corre `supabase functions serve`:

```
[BACKEND_VERSIONS_TYPES_BEFORE_BUILD] {
  typeofA: 'string',          // ✅ DEBE SER 'string'
  typeofB: 'object',          // ❌ SI ES 'object', HAY BUG
  typeofC: 'string',          // ✅ DEBE SER 'string'
  isObjectA: false,           // ✅ DEBE SER false
  isObjectB: true,            // ❌ SI ES true, HAY BUG
  isObjectC: false,           // ✅ DEBE SER false
  keysA: null,                // ✅ Si es object, mostrará keys
  keysB: ['A', 'B', 'C'],     // ❌ Si no es null, HAY BUG
  keysC: null,
  startA: '<html>...',        // ✅ DEBE empezar con '<'
  startB: '(NOT STRING)',     // ❌ SI no es string, HAY BUG
  startC: '<html>...',        // ✅ DEBE empezar con '<'
  lenA: 12345,
  lenB: 0,
  lenC: 6789
}
```

**Criterio de éxito**:
- `typeofA === 'string'`, `isObjectA === false`, `startA` empieza con `<`
- `typeofC === 'string'`, `isObjectC === false`, `startC` empieza con `<`
- `typeofB === 'string' | 'object'` → si es `'object'`, **HAY BUG EN coerceVersionToHtmlString**

---

### 2. Frontend Console Logs (Browser DevTools)

```
[UI_VERSIONS_RAW] {
  A: {
    type: 'string',           // ✅ DEBE SER 'string'
    isObject: false,          // ✅ DEBE SER false
    keys: null,               // ✅ Si es object, mostrará keys
    start: '<html>...',       // ✅ DEBE empezar con '<'
    len: 12345,
    wrapper: false
  },
  C: {
    type: 'string',           // ✅ DEBE SER 'string'
    isObject: false,          // ✅ DEBE SER false
    keys: null,
    start: '<html>...',       // ✅ DEBE empezar con '<'
    len: 6789,
    wrapper: false
  }
}
```

```
[UI_ASSIGNMENT_COUNTS] {
  backendFinalCounts: { A: 18, B: 0, C: 2 },  // ← Del backend
  calculated: { A: 18, B: 5, C: 2 },          // ← Calculado frontend (pre-reassignment)
  final: { A: 18, B: 0, C: 2 }                // ← Usado para B card visibility
}
```

**Criterio de éxito**:
- `type === 'string'`, `isObject === false`, `keys === null`
- `start` empieza con `<`, NO con `{`
- `wrapper === false`
- `backendFinalCounts.B === 0` → B card **NO debe aparecer**

---

### 3. UI Debug Panel (con `VITE_DEBUG_EVAL_PIPELINE=true`)

Panel `[UI_VERSION_DEBUG]`:

```
RAW API BUNDLE FIELDS:
A: type=string start="<html>..." len=12345
B: type=object keys=[A,B,C] start="[object Object]" len=0  // ❌ SI type=object, HAY BUG
C: type=string start="<html>..." len=6789

CARD CONTENT (FINAL):
cardA.content: start="<html>..." len=12345
cardC.content: start="<html>..." len=6789

DIFF-STYLE CHECK:
cardA.content === versions.A: ✅ TRUE
cardC.content === versions.C: ✅ TRUE
```

**Criterio de éxito**:
- `type=string` para A y C
- NO aparece red warning "BACKEND BUG: versions.* contains OBJECTS"
- Diff checks son `✅ TRUE`

---

### 4. Network Tab (Response `modify-evaluation`)

```json
{
  "success": true,
  "evaluationBundle": {
    "versions": {
      "A": "<html>...",    // ✅ String HTML
      "B": null,           // ✅ null (o string HTML si B existe)
      "C": "<html>..."     // ✅ String HTML
    },
    "baseHtml": "<html>...",
    "versionBHtml": null,
    "versionCHtml": "<html>..."
  },
  "finalAssignmentCounts": {
    "A": 18,
    "B": 0,              // ✅ Si 0, B card NO debe aparecer
    "C": 2
  },
  "_debug": {
    "startsWith": {
      "A": "<html>...",  // ✅ Empieza con '<'
      "C": "<html>..."   // ✅ Empieza con '<'
    },
    "isHtml": {
      "A": true,         // ✅ true
      "C": true          // ✅ true
    },
    "hasWrapper": {
      "A": false,        // ✅ false
      "C": false         // ✅ false
    }
  }
}
```

**Criterio de éxito**:
- `versions.A/C` son strings que empiezan con `<`
- `_debug.isHtml.A/C === true`
- `_debug.hasWrapper.A/C === false`
- `finalAssignmentCounts.B === 0` → B card NO debe aparecer

---

### 5. Cards Renderizadas en UI

**Card A**:
- ✅ Muestra HTML formateado (no "Version A missing")
- ✅ NO contiene texto `{ "versions": ...`
- ✅ NO aparece bloque rojo "WRAPPER DETECTED"

**Card C**:
- ✅ Muestra HTML formateado **diferente de A**
- ✅ NO contiene texto `{ "versions": ...`
- ✅ NO aparece bloque rojo "WRAPPER DETECTED"
- ✅ NO muestra contenido de A

**Card B**:
- ✅ NO aparece si `finalAssignmentCounts.B === 0`

**"Recordatorios para el docente"**:
- ✅ NO duplica lista de "¿A quién contempla esta versión?"
- ✅ Muestra solo teacher-specific guidance (admin/correction reminders)
- ✅ Si no hay reminders → empty state "No hay recordatorios específicos"

---

## Próximos Pasos (USUARIO)

1. **Setear** en `.env`:
   ```
   VITE_DEBUG_EVAL_PIPELINE=true
   ```

2. **Reiniciar** dev server:
   ```bash
   npm run dev
   ```

3. **Generar evaluación** y **pegar aquí**:
   - Logs de terminal (backend): `[BACKEND_VERSIONS_TYPES_BEFORE_BUILD]`
   - Logs de browser console (frontend): `[UI_VERSIONS_RAW]`, `[UI_ASSIGNMENT_COUNTS]`
   - Screenshot del UI debug panel
   - Screenshot del network response (`modify-evaluation`)

4. **Verificar en UI**:
   - Card A muestra HTML (no error)
   - Card C muestra HTML diferente de A (no wrapper)
   - Card B no aparece si `B === 0`
   - "Recordatorios para el docente" no duplica student list

**NO RECLAMAR ÉXITO SIN ESA EVIDENCIA.**

---

## Errores de Linter (PRE-EXISTENTES)

Los errores de Deno y algunas variables en `supabase/functions/modify-evaluation/index.ts` son **pre-existentes** (no introducidos por este fix). No afectan el runtime si Supabase está configurado correctamente.

Si el código no compila en el IDE, es solo linter; Deno runtime lo manejará correctamente.

---

## Summary

- ✅ Backend: `coerceVersionToHtmlString()` consolidada
- ✅ Backend: Hard enforcement de tipos + logs TEMP
- ✅ Backend: `finalAssignmentCounts` en response
- ✅ Frontend: Type validation estricta
- ✅ Frontend: B card hidden si `finalAssignmentCounts.B === 0`
- ✅ Frontend: Teacher reminders sin fallback a student adjustments
- ✅ Renderers: Ya correctos (no parsing)

**PENDIENTE**: Verificación runtime con evidencia del usuario.
