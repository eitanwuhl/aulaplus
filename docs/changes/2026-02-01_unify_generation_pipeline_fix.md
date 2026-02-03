# Unify Generation Pipeline Fix

**Fecha**: 2026-02-01  
**Rama**: `nuevas-evaluaciones`  
**Objetivo**: Unificar el pipeline de generación de evaluaciones para que siempre use `generation_mode: "universal"` y siempre envíe `evaluation_design_plan`, eliminando el uso de `generation_context` que deshabilita versiones B/C, opciones equivalentes y causa inconsistencias en el AI report.

---

## Resumen de Causa Raíz

El path `generation_context` en el edge function fue diseñado para generar evaluaciones basadas en sesiones/materiales con un formato JSON estructurado. Sin embargo, cuando la UI envía `generation_context`, se activa un override que fuerza:

1. **Versiones B/C deshabilitadas**: Se fuerza `triggers: { versionB: false, versionC: false }` y todas las asignaciones a 'A', impidiendo que estudiantes con adaptación de contenido (como Diego Martinez) reciban la Versión C que necesitan.

2. **Opciones equivalentes omitidas**: El prompt del path `generation_context` no incluye instrucciones sobre opciones equivalentes de respuesta, incluso cuando `responseOptions.include === true`, resultando en evaluaciones sin las opciones metacognitivas requeridas.

3. **AI Report inconsistente**: El edge function retorna `aiDesignReport` en lugar de `aiReport` cuando se usa `generation_context`, causando que la UI muestre "AI report is not available..." porque busca `data?.aiReport` primero.

**Solución**: Eliminar completamente el uso de `generation_context` para generación de evaluaciones. Siempre usar `generation_mode: 'universal'` y embebir el contexto de sesiones/materiales como texto legible en el campo `modification`, con límites estrictos para evitar payloads excesivos.

---

## Archivos Modificados

### 1. `src/pages/EvaluacionesGrupo.tsx`

**Por qué se cambió**: Este archivo contenía la lógica que decidía entre usar `generation_context` o `generation_mode: 'universal'`. El override de `effectivePlan` forzaba comportamiento de versión única cuando existía `generationContext`, y el request body incluía `generation_context` en lugar de siempre usar el path universal.

**Cambios realizados**:
- Eliminado el override condicional de `effectivePlan` que forzaba `triggers: { versionB: false, versionC: false }`
- Construcción de `modificationText` que embebe contexto de sesiones/materiales como texto legible
- Aplicación de límites estrictos: máximo 5 sesiones, 5 materiales, 500 caracteres de `extractedText` por material
- Request body siempre incluye `generation_mode: 'universal'` y `evaluation_design_plan`
- Eliminado completamente el envío de `generation_context`

### 2. `supabase/functions/modify-evaluation/index.ts`

**Por qué se cambió**: Agregar campo de debug opcional para verificar qué path de generación se está usando, pero solo cuando se configura explícitamente una variable de entorno para mantener las respuestas de producción limpias.

**Cambios realizados**:
- Agregado campo `_debug.generationPath` condicional, solo si `DEBUG_GENERATION_PATH === "true"`

---

## Diffs Clave (Comportamiento Antes/Después)

### Antes

- **Con sesiones/materiales**: Se enviaba `generation_context`, se forzaba `triggers: { versionB: false, versionC: false }`, todas las asignaciones a 'A', `contentAdaptationStudentIds: []`
- **Sin sesiones/materiales**: Se enviaba `generation_mode: 'universal'` con `evaluation_design_plan` completo
- **Resultado**: Evaluaciones con sesiones/materiales no generaban versiones B/C, no incluían opciones equivalentes, y el AI report no persistía correctamente

### Después

- **Con o sin sesiones/materiales**: Siempre se envía `generation_mode: 'universal'` con `evaluation_design_plan` completo
- **Contexto de sesiones/materiales**: Se embebe como texto legible en `modification` (máximo 5 sesiones, 5 materiales, 500 chars por material)
- **Resultado**: Todas las evaluaciones generan versiones B/C según contemplaciones, incluyen opciones equivalentes cuando corresponde, y el AI report persiste correctamente

### Cambios Específicos

- ✅ `effectivePlan` siempre usa el plan completo (sin overrides)
- ✅ `requestBody.generation_context` nunca se envía
- ✅ `requestBody.generation_mode` siempre es `'universal'`
- ✅ `requestBody.evaluation_design_plan` siempre está presente con todos los campos
- ✅ `modification` incluye contexto de sesiones/materiales como texto cuando existe
- ✅ Límites estrictos aplicados: 5 sesiones, 5 materiales, 500 chars por `extractedText`

---

## Verificación (Solo Pasos Visibles al Usuario)

### Paso 1: Verificar Request en DevTools Network

1. Abrir DevTools (F12) → pestaña "Network"
2. Ir a "Generar Evaluaciones" en la aplicación
3. Seleccionar grupo, materia, contenidos
4. (Opcional) Seleccionar sesiones/materiales
5. Hacer clic en "Generar Evaluaciones Inteligentes"
6. En Network tab, filtrar por "modify-evaluation"
7. Click en el request → pestaña "Payload" o "Preview"
8. **Verificar**:
   - ✅ El request tiene `generation_mode: "universal"`
   - ✅ El request tiene `evaluation_design_plan` con todos los campos (triggers, responseOptions, assignmentByStudentId, etc.)
   - ✅ El request NO tiene `generation_context`
   - ✅ Si hay sesiones/materiales, el campo `modification` contiene texto legible con "SESIONES DE CLASE A EVALUAR" o "MATERIALES DOCENTES ADJUNTOS"

### Paso 2: Verificar Response en DevTools Network

1. En la misma pestaña Network, click en el request → pestaña "Response"
2. **Verificar**:
   - ✅ El response tiene `aiReport` (objeto, no null)
   - ✅ El response tiene `evaluationBundle.versions.A` (string HTML)
   - ✅ Si Diego tiene adaptación de contenido, el response tiene `evaluationBundle.versions.C` (string HTML, no null)
   - ✅ El response tiene `studentAssignments` con asignaciones correctas (Diego como 'C' si corresponde)

### Paso 3: Verificar Versión C para Diego en UI

1. Después de generar, en la página de generación
2. **Verificar**:
   - ✅ Si Diego tiene adaptación de contenido, existe una sección "Versión C (Adecuación de contenido)"
   - ✅ En el panel de asignaciones, Diego está asignado a Versión C
3. Guardar la evaluación
4. Abrir la evaluación guardada en la página de detalle
5. **Verificar**:
   - ✅ Aparece Versión C con Diego asignado
   - ✅ El componente `AIDesignReport` se renderiza (no el mensaje "AI report is not available...")

### Paso 4: Verificar Opciones Equivalentes en Versión A

1. Preparar grupo con contemplaciones que requieran opciones equivalentes (ej: estudiantes con "Modelos y plantillas de respuesta" o grupo con predominio V+K)
2. Generar evaluación
3. En la UI, abrir la Versión A generada
4. **Verificar**:
   - ✅ Cada consigna que requiera respuesta escrita incluye el texto: "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
   - ✅ Aparecen las opciones: "Opción 1: Respuesta escrita tradicional (párrafo)", "Opción 2: Respuesta estructurada (lista con viñetas o tabla)"
   - ✅ Las opciones aparecen inmediatamente después de cada consigna relevante

### Paso 5: Verificar Límites de Contexto

1. Seleccionar más de 5 sesiones o más de 5 materiales
2. Generar evaluación
3. En DevTools Network, inspeccionar el request → campo `modification`
4. **Verificar**:
   - ✅ Máximo 5 sesiones listadas (si hay más, debe aparecer nota: "Se incluyeron las primeras 5 de X sesiones seleccionadas")
   - ✅ Máximo 5 materiales listados (si hay más, debe aparecer nota: "Se incluyeron los primeros 5 de X materiales seleccionados")
   - ✅ Cada `extractedText` de material tiene máximo 500 caracteres (truncado con `...`)

---

## Rollback

Si es necesario revertir este cambio:

1. **Revertir commit**: Si se hizo un commit único, usar `git revert <commit-hash>`
2. **Revertir archivos manualmente**:
   - `src/pages/EvaluacionesGrupo.tsx`: Restaurar el override condicional de `effectivePlan` y la lógica que envía `generation_context` cuando existe `generationContext`
   - `supabase/functions/modify-evaluation/index.ts`: Eliminar el campo `_debug` condicional

**Nota**: Después del rollback, las evaluaciones generadas con sesiones/materiales volverán a usar el path `generation_context`, lo que causará que:
- Versiones B/C estén deshabilitadas
- Opciones equivalentes no se incluyan
- AI report no persista correctamente

---

## Estado de Implementación

✅ **Completado**: Todos los cambios han sido implementados y verificados.

- ✅ `src/pages/EvaluacionesGrupo.tsx`: Override eliminado, `modificationText` construido con límites, request body siempre con `generation_mode: 'universal'`
- ✅ `supabase/functions/modify-evaluation/index.ts`: Campo `_debug` condicional agregado
- ✅ TypeScript: Sin errores de compilación o linting
