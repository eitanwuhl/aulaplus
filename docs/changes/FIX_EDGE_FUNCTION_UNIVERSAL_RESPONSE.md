# Fix Edge Function Universal Response Schema

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Objetivo**: Asegurar que el edge function `modify-evaluation` SIEMPRE retorne el formato universal completo cuando `generation_mode === "universal"`, eliminando todos los returns legacy/minimales.

---

## Problema Observado

A pesar de que el frontend envía:
- `generation_mode: "universal"`
- `evaluation_design_plan: {...}`

La respuesta del edge function es legacy/minimal:
```json
{
  "success": true,
  "content": "<html>",
  "type": "modification",
  "metadata": {...}
}
```

**Faltan campos críticos**:
- `evaluationBundle` (necesario para versiones B/C)
- `aiReport` (necesario para persistencia)
- `studentAssignments` (necesario para asignaciones)
- `warnings` (necesario para debugging)

Esto impide que funcionen:
- Versiones B/C
- Opciones metacognitivas
- Persistencia de AI report

---

## Cambios Implementados

### 1) Forzar Selección del Path Universal

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio** (líneas ~244-246):
- **Antes**: El path de `generation_context` se ejecutaba primero, incluso si `generation_mode === 'universal'`
- **Después**: El path universal se verifica PRIMERO, antes del path de `generation_context`

```typescript
// FORCE: Universal path takes priority - if generation_mode === 'universal', use it regardless of generation_context
// Universal evaluation path (must be checked FIRST before generation_context)
if (type === 'modification' && generation_mode === 'universal') {
  // ... código del path universal ...
}

// PHASE 6b: Handle evaluation generation with session digests + time budgeting (legacy, only if NOT universal)
if (generation_context && type === 'modification' && generation_mode !== 'universal') {
  // ... código del path legacy ...
}
```

**Resultado**: Si `generation_mode === 'universal'`, siempre se usa el path universal, incluso si existe `generation_context`.

---

### 2) Eliminar Todos los Returns Legacy/Minimales

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Returns convertidos**:

#### a) Return en catch de parse JSON (líneas ~404-434)
- **Antes**: `{ success: true, content: "...", type: "...", warning: "..." }`
- **Después**: Formato universal completo con `evaluationBundle`, `aiReport`, `studentAssignments`, `warnings`, `_debug`

#### b) Return en path de generation_context (líneas ~483-520)
- **Antes**: `{ success: true, content: "...", estimatedTotalMinutes, timeBreakdown, aiDesignReport, ... }`
- **Después**: Formato universal completo con `evaluationBundle.versions`, `aiReport`, etc.

#### c) Return en catch de parse JSON del path universal (líneas ~404-434)
- **Antes**: `{ success: true, content: "...", type: "...", warning: "..." }`
- **Después**: Formato universal completo

#### d) Return cuando se alcanza límite de tokens (líneas ~1089-1101)
- **Antes**: `{ success: true, content: "...", warning: "...", metadata: {...} }`
- **Después**: Formato universal completo

#### e) Return cuando contenido está vacío (líneas ~1117-1124)
- **Antes**: `{ success: true, content: "...", warning: "..." }`
- **Después**: Formato universal completo

#### f) Return del path legacy (líneas ~1140-1150)
- **Antes**: `{ success: true, content: "...", type: "...", metadata: {...} }`
- **Después**: Formato universal completo

**Formato universal aplicado a todos**:
```typescript
{
  success: true,
  type: "modification",
  content: versions.A (legacy alias),
  evaluationBundle: {
    baseHtml,
    versionBHtml: null | string,
    versionCHtml: null | string,
    versions: { A: string, B: string | null, C: string | null },
    responseOptionsIncluded: boolean,
    responseOptionCount: number
  },
  studentAssignments: Record<string, 'A' | 'B' | 'C'>,
  teacherRemindersByStudent: StudentReminders[],
  aiReport: { ... },  // Siempre presente, nunca null
  warnings: string[],
  metadata: { ... },
  _debug: { ... }  // Siempre presente (no gated)
}
```

---

### 3) Agregar Debug Siempre Visible

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

**Cambio** (líneas ~638-656):
- **Antes**: `_debug` solo se incluía si `DEBUG_GENERATION_PATH === 'true'`
- **Después**: `_debug` SIEMPRE se incluye en todas las respuestas

```typescript
_debug: {
  generationPath: 'universal' | 'legacy_return' | 'catch_fallback',
  hasEvaluationBundle: boolean,
  hasAiReport: boolean,
  versionsLengths: { A: number, B: number, C: number },
  triggers: { versionB: boolean, versionC: boolean },
  responseOptions: { include: boolean, optionCount: number }
}
```

**Valores de `generationPath`**:
- `'universal'`: Path universal ejecutado correctamente
- `'legacy_return'`: Return legacy convertido a formato universal
- `'catch_fallback'`: Catch block que retorna formato universal

**Resultado**: El debug está siempre visible en Network tab, facilitando diagnóstico de producción.

---

### 4) Enforcement Determinístico (Ya Implementado)

**Archivo**: `supabase/functions/modify-evaluation/index.ts`

#### a) Metacognición (líneas ~445-509)

**Lógica**:
1. Verificar si `responseOptions.include === true` y si `baseHtml` no contiene la frase exacta
2. Buscar párrafos que contengan palabras clave de respuesta escrita o ítems numerados
3. Inyectar bloque de opciones equivalentes después de cada consigna relevante
4. Si no se encuentra ningún lugar, inyectar al final de la primera sección como fallback

**Formato inyectado**:
```html
<p><strong>Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta.</strong></p>
<ul>
  <li><strong>Opción 1:</strong> Respuesta escrita tradicional (párrafo)</li>
  <li><strong>Opción 2:</strong> Respuesta estructurada (lista con viñetas o tabla)</li>
  <li><strong>Opción 3:</strong> Respuesta visual (diagrama o esquema con texto explicativo)</li>  <!-- Si optionCount === 3 -->
</ul>
```

#### b) Versión C (líneas ~511-544)

**Lógica**:
1. Verificar si `triggers.versionC === true` pero `versionCHtml` es null/empty
2. **NO reasignar estudiantes a A** (esto se hace después si el fallback falla)
3. Crear `fallbackC` desde `baseHtml`:
   - Simplificar lenguaje (reemplazar verbos complejos)
   - Reducir cantidad de ítems (eliminar ítems pares si hay más de 3)
   - Mantener mismo tema y objetivos
4. Agregar nota de simplificación al inicio
5. Asignar `versionCHtml = fallbackC`

**Transformaciones aplicadas**:
- `analizar` → `explicar`
- `examinar` → `explicar`
- `investigar` → `explicar`
- `evaluar` → `explicar`
- `complejo/compleja` → `importante`
- `desarrollar` → `escribir`
- `elaborar` → `escribir`
- `construir` → `escribir`

---

## Archivos Modificados

1. **`supabase/functions/modify-evaluation/index.ts`**:
   - **Líneas ~244-246**: Reordenado checks: path universal PRIMERO (antes de `generation_context`)
   - **Líneas ~404-434**: Convertido return en catch de parse JSON a formato universal
   - **Líneas ~483-520**: Convertido return del path de `generation_context` a formato universal
   - **Líneas ~638-656**: Agregado `_debug` siempre visible (no gated) en path universal
   - **Líneas ~1089-1101**: Convertido return cuando se alcanza límite de tokens a formato universal
   - **Líneas ~1117-1124**: Convertido return cuando contenido está vacío a formato universal
   - **Líneas ~1140-1150**: Convertido return del path legacy a formato universal
   - **Líneas ~457-510**: Enforcement determinístico de metacognición (inyección si falta)
   - **Líneas ~512-545**: Enforcement determinístico de versión C (fallback si falta)

---

## Comandos de Deploy

Después de los cambios de código, ejecutar:

```bash
supabase functions deploy modify-evaluation --no-verify-jwt
```

**Confirmación del nombre de función**: El nombre debe ser exactamente `modify-evaluation` (sin espacios, sin mayúsculas).

**Verificación después del deploy**:
1. Generar una evaluación desde la UI
2. Abrir DevTools → Network
3. Buscar request a `modify-evaluation`
4. Verificar que la respuesta incluye:
   - `evaluationBundle.versions.A` (non-null)
   - `evaluationBundle.versions.B` (puede ser null)
   - `evaluationBundle.versions.C` (puede ser null)
   - `aiReport` (non-null)
   - `studentAssignments` (object)
   - `warnings` (array)
   - `_debug.generationPath` (debe ser `"universal"`)

---

## Resumen de Cambios

### Eliminado

- ❌ Returns legacy que solo incluían `content`, `type`, `metadata`
- ❌ Path de `generation_context` ejecutándose antes del universal
- ❌ Debug gated por variable de entorno

### Agregado

- ✅ Formato universal completo en TODOS los returns exitosos
- ✅ Path universal verificado PRIMERO (antes de `generation_context`)
- ✅ Debug siempre visible con `generationPath`, `hasEvaluationBundle`, `hasAiReport`, `versionsLengths`, `triggers`, `responseOptions`
- ✅ Enforcement determinístico de metacognición (inyección si falta)
- ✅ Enforcement determinístico de versión C (fallback si falta)

### Resultado

- ✅ TODAS las respuestas exitosas incluyen `evaluationBundle`, `aiReport`, `studentAssignments`, `warnings`
- ✅ El path universal siempre se ejecuta cuando `generation_mode === 'universal'`
- ✅ El debug está siempre visible para diagnóstico
- ✅ Las opciones metacognitivas se inyectan determinísticamente si faltan
- ✅ La versión C se genera determinísticamente si falta

---

## Rollback

Si es necesario revertir este cambio:

1. **Revertir commit**: Si se hizo un commit único, usar `git revert <commit-hash>`
2. **Revertir archivos manualmente**:
   - `supabase/functions/modify-evaluation/index.ts`: Restaurar orden original de checks, restaurar returns legacy

**Nota**: Después del rollback, volverán los problemas de:
- Respuestas legacy sin `evaluationBundle`, `aiReport`, etc.
- Path de `generation_context` ejecutándose antes del universal
- Debug no visible en producción
