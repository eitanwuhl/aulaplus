# Phase 4 — Implementation Report: Group Profile Consistency + Real Supabase Source

**Fecha**: 27 de diciembre de 2024  
**Objetivo**: Hacer consistente el uso de perfil de grupo en TODOS los puntos de entrada de generación de planes, y conectar con datos reales de Supabase.

---

## Resumen Ejecutivo

### ✅ Completado

1. **Audit completo** de fuentes de datos en Supabase (Step 1)
2. **Helper compartido** creado (`src/utils/groupContext.ts`) - single source of truth (Step 2)
3. **PlanificacionWizard** actualizado para usar helper (Step 3)
4. **EditorSesionNuevo** actualizado para incluir contexto (Step 4)
5. **useFullSessionGeneration** actualizado para Path A (Step 5)
6. **Enriquecimiento de prompts** con `teacherSugerencias` (Step 6 - integrado en edge functions ya existentes)

### 🎯 Resultado

- ✅ **Consistencia total**: Todos los puntos de entrada usan el mismo helper
- ✅ **Datos reales de Supabase**: `teacher_sugerencias` se carga desde tabla `grupos`
- ✅ **Fallback inteligente**: Usa `mockGroups` para datos de estudiantes (hasta que exista tabla real)
- ✅ **Anonimización**: Sin nombres de estudiantes en prompts
- ✅ **Límites de tamaño**: Cap de 10 estudiantes con ajustes
- ✅ **Backward compatibility**: Sin perfil/ajustes = comportamiento idéntico al anterior

---

## Archivos Modificados

### 1. NUEVO: `src/utils/groupContext.ts` (Helper Compartido)

**Propósito**: Single source of truth para datos de grupo, usado por TODOS los puntos de entrada.

**Exports principales**:
- `loadGroupContext(grupoId)` - Función principal
- `getGrupoIdFromPlanificacion(planificacionId)` - Helper para derivar grupoId
- Tipos: `PerfilGrupo`, `EstudianteAjuste`, `GroupContextData`

**Flujo interno**:
```typescript
1. Si no hay grupoId → retorna {} (backward compatible)
2. Intenta cargar teacher_sugerencias desde Supabase (tabla grupos)
3. Usa fallback a mockGroups para datos de estudiantes
4. Calcula distribución de estilos de aprendizaje
5. Determina estilo dominante (más frecuente)
6. Anonimiza estudiantes (sin nombres, solo perfil + ajustes + contemplaciones)
7. Filtra solo estudiantes con ajustes/contemplaciones
8. Caps a MAX_STUDENTS_WITH_ADJUSTMENTS (10)
9. Retorna objeto combinado o {} si no hay datos significativos
```

**Código completo**: Ver `src/utils/groupContext.ts` (266 líneas)

**Características clave**:
- ✅ Híbrido: Supabase (real) + mockGroups (fallback)
- ✅ Logging informativo para debugging
- ✅ Manejo robusto de errores (fail gracefully)
- ✅ Chequeo de "meaningful data" para evitar estructuras vacías
- ✅ Futuro-proof: Si se agrega tabla de estudiantes en Supabase, solo este archivo necesita cambiar

---

### 2. `src/pages/PlanificacionWizard.tsx` (Path Principal - Wizard)

#### 2.1 Import del Helper

**Cambio**:
```typescript
// ANTES
import { mockGroups } from '@/data/mockData';

// DESPUÉS
import { loadGroupContext } from '@/utils/groupContext';
```

#### 2.2 Eliminación de Código Local

**Eliminado** (~60 líneas de `buildGroupContextFromId()` local):
```typescript
// PHASE 4: Use shared helper for group context (removed local implementation)
// See src/utils/groupContext.ts for centralized logic
```

**Razón**: Código duplicado reemplazado por helper compartido.

#### 2.3 Actualización de Flujo de Generación

**Antes** (líneas ~310-320):
```typescript
// PHASE 3 (Profile Usage): Build group context if grupo_id is provided
const groupContext = buildGroupContextFromId(grupoId);

if (groupContext.perfilGrupo) {
  console.log('[PHASE3-Profile] Using group profile:', {
    tamanio: groupContext.perfilGrupo.tamanio,
    dominante: groupContext.perfilGrupo.dominante,
    distribucion: groupContext.perfilGrupo.distribucion,
    estudiantesConAjustes: groupContext.estudiantes?.length || 0
  });
} else {
  console.log('[PHASE3-Profile] No group profile available (backward compatibility mode)');
}
```

**Después** (líneas ~250-261):
```typescript
// PHASE 4: Load group context from Supabase + mockGroups (shared helper)
const groupContext = await loadGroupContext(grupoId);

if (groupContext.perfilGrupo) {
  console.log('[PHASE4-Profile] Using group profile:', {
    tamanio: groupContext.perfilGrupo.tamanio,
    dominante: groupContext.perfilGrupo.dominante,
    distribucion: groupContext.perfilGrupo.distribucion,
    estudiantesConAjustes: groupContext.estudiantes?.length || 0,
    teacherSugerenciasPresent: !!groupContext.teacherSugerencias
  });
} else {
  console.log('[PHASE4-Profile] No group profile available (backward compatibility mode)');
}
```

**Cambios**:
- ✅ Usa `await loadGroupContext()` (async)
- ✅ Log incluye presencia de `teacherSugerencias`
- ✅ Log marca fase como "PHASE4"

**Nota**: El resto del flujo NO cambia - el payload ya incluía `perfilGrupo` y `estudiantes` desde Phase 3.

---

### 3. `src/components/planificacion/EditorSesionNuevo.tsx` (Editor Individual)

#### 3.1 Import del Helper

**Agregado**:
```typescript
import { loadGroupContext, getGrupoIdFromPlanificacion } from '@/utils/groupContext';
```

#### 3.2 Actualización de `handleGenerarPlanInicial()`

**Antes** (líneas ~380-396):
```typescript
const handleGenerarPlanInicial = async () => {
  if (!sesion) return;

  setIsAILoading(true);
  try {
    const payload = {
      modo: 'generar_plan_html',
      sesionId: sesion.id,
      orden: sesion.orden,
      duracionMin: sesion.duracion_minutos,
      materia: materia || 'Sin especificar',
      nivel: nivel || 'Sin especificar',
      contenidos: sesion.contenidos_anep || [],
      competencias: sesion.competencias_anep || [],
      criterios: sesion.criterios_logro_anep || [],
      instruccionesDocente: undefined
    };
```

**Después** (líneas ~380-408):
```typescript
const handleGenerarPlanInicial = async () => {
  if (!sesion) return;

  setIsAILoading(true);
  try {
    // PHASE 4: Load group context from Supabase + mockGroups
    const grupoId = await getGrupoIdFromPlanificacion(planificacionId);
    const groupContext = await loadGroupContext(grupoId);
    
    if (groupContext.perfilGrupo) {
      console.log('[PHASE4-EditorSesion] Using group profile:', {
        tamanio: groupContext.perfilGrupo.tamanio,
        dominante: groupContext.perfilGrupo.dominante,
        estudiantesConAjustes: groupContext.estudiantes?.length || 0,
        teacherSugerenciasPresent: !!groupContext.teacherSugerencias
      });
    }
    
    const payload = {
      modo: 'generar_plan_html',
      sesionId: sesion.id,
      orden: sesion.orden,
      duracionMin: sesion.duracion_minutos,
      materia: materia || 'Sin especificar',
      nivel: nivel || 'Sin especificar',
      contenidos: sesion.contenidos_anep || [],
      competencias: sesion.competencias_anep || [],
      criterios: sesion.criterios_logro_anep || [],
      instruccionesDocente: undefined,
      // PHASE 4: Include group profile and student adjustments if available
      ...(groupContext.perfilGrupo && { perfilGrupo: groupContext.perfilGrupo }),
      ...(groupContext.estudiantes && { estudiantes: groupContext.estudiantes })
    };
```

**Cambios**:
- ✅ Deriva `grupoId` desde `planificacionId` usando helper
- ✅ Carga contexto de grupo usando helper compartido
- ✅ Log informativo para debugging
- ✅ Incluye `perfilGrupo` y `estudiantes` en payload si existen

**Impacto**: Ahora el editor individual de sesiones TAMBIÉN genera planes personalizados basados en el perfil del grupo (consistencia con wizard).

---

### 4. `src/hooks/useFullSessionGeneration.ts` (Path A - Plain Text)

#### 4.1 Import del Helper

**Agregado**:
```typescript
import { loadGroupContext } from '@/utils/groupContext';
```

#### 4.2 Actualización de `generateAIPlan()`

**Antes** (líneas ~252-295):
```typescript
async function generateAIPlan(params: { ... }) {
  try {
    // PHASE 2: Construir unitContext si unitAssignment está disponible
    const unitContext = params.unitAssignment ? { ... } : undefined;

    const { data, error } = await supabase.functions.invoke('modify-evaluation', {
      body: {
        type: 'planning',
        modification: `...`,
        groupContext: {
          subject: params.materia,
          content: [params.contenido],
          competencies: params.competencias,
          groupName: params.grupoId,
          additionalContext: `Modalidad: ${params.modalidad}, Sesión ${params.sesionNumero}/${params.totalSesiones}`
        },
        ...(unitContext && { unitContext }),
        ...(params.sessionBrief?.trim() && { sessionBrief: params.sessionBrief.trim() })
      }
    });
```

**Después** (líneas ~252-332):
```typescript
async function generateAIPlan(params: { ... }) {
  try {
    // PHASE 2: Construir unitContext si unitAssignment está disponible
    const unitContext = params.unitAssignment ? { ... } : undefined;

    // PHASE 4: Load group context from Supabase + mockGroups
    const groupContextData = await loadGroupContext(params.grupoId);
    
    if (groupContextData.perfilGrupo) {
      console.log('[PHASE4-useFullSessionGen] Using group profile:', {
        dominante: groupContextData.perfilGrupo.dominante,
        estudiantesConAjustes: groupContextData.estudiantes?.length || 0,
        teacherSugerenciasPresent: !!groupContextData.teacherSugerencias
      });
    }
    
    // Build enriched additionalContext with teacher suggestions if available
    let additionalContext = `Modalidad: ${params.modalidad}, Sesión ${params.sesionNumero}/${params.totalSesiones}`;
    
    if (groupContextData.teacherSugerencias) {
      const suggestions = [];
      if (groupContextData.teacherSugerencias.aula) {
        suggestions.push(`Teacher suggestions for classroom: ${groupContextData.teacherSugerencias.aula}`);
      }
      if (groupContextData.teacherSugerencias.evaluaciones) {
        suggestions.push(`Teacher suggestions for evaluations: ${groupContextData.teacherSugerencias.evaluaciones}`);
      }
      if (groupContextData.teacherSugerencias.otras) {
        suggestions.push(`Other important notes: ${groupContextData.teacherSugerencias.otras}`);
      }
      if (suggestions.length > 0) {
        additionalContext += `\n\n` + suggestions.join('\n');
      }
    }

    const { data, error } = await supabase.functions.invoke('modify-evaluation', {
      body: {
        type: 'planning',
        modification: `...`,
        groupContext: {
          subject: params.materia,
          content: [params.contenido],
          competencies: params.competencias,
          groupName: params.grupoId,
          additionalContext,
          // PHASE 4: Include anonymized students and dominant profile
          ...(groupContextData.estudiantes && { students: groupContextData.estudiantes }),
          ...(groupContextData.perfilGrupo && { dominantProfile: groupContextData.perfilGrupo.dominante })
        },
        ...(unitContext && { unitContext }),
        ...(params.sessionBrief?.trim() && { sessionBrief: params.sessionBrief.trim() })
      }
    });
```

**Cambios**:
- ✅ Carga contexto de grupo usando helper compartido
- ✅ Log informativo para debugging
- ✅ Enriquece `additionalContext` con `teacherSugerencias` si existen
- ✅ Incluye `students` (anonimizados) en `groupContext`
- ✅ Incluye `dominantProfile` en `groupContext`

**Impacto**: El path A (plain text usado por edición avanzada) AHORA también recibe perfil de grupo y sugerencias del docente. Esto alimenta al prompt de `modify-evaluation` con los datos correctos.

---

## Enriquecimiento de Prompts (Ya Implementado en Phase 3)

**Nota**: Los edge functions (`generate-plan-completo` y `modify-evaluation`) ya fueron actualizados en Phase 3 para usar `perfilGrupo`, `estudiantes` y generar planes con decisiones explícitas.

**En Phase 4, agregamos:**
- `teacherSugerencias` se incluyen en `additionalContext` (Path A)
- Los edge functions YA tienen la lógica para usar estos datos activamente (ver `docs/phase3_profile_usage_implementation.md`)

**NO se requieren cambios adicionales en edge functions** porque:
1. Ya aceptan `perfilGrupo` y `estudiantes` como parámetros opcionales
2. Ya generan secciones detalladas con estos datos
3. `teacherSugerencias` se incluye en `additionalContext` que ya es procesado por los prompts

---

## Flujos Completos (End-to-End)

### Flujo 1: Wizard Generation (PlanificacionWizard)

```
Usuario completa wizard → "Finalizar"
         ↓
generarPlanesAutomaticamente(grupoId)
         ↓
await loadGroupContext(grupoId)
  1. Intenta cargar teacher_sugerencias desde Supabase (tabla grupos)
  2. Usa mockGroups para estudiantes (fallback)
  3. Calcula distribución y dominante
  4. Anonimiza y filtra estudiantes (cap 10)
         ↓
Para cada sesión:
  Payload incluye: perfilGrupo, estudiantes, unitContext, sessionBrief
         ↓
supabase.functions.invoke('generate-plan-completo')
         ↓
Edge function usa groupProfileSection con reglas pedagógicas
         ↓
OpenAI genera plan con decisiones explícitas
         ↓
Plan guardado en sesiones_clase
```

### Flujo 2: Single Session Editor (EditorSesionNuevo)

```
Docente abre editor de sesión individual
         ↓
handleGenerarPlanInicial()
         ↓
grupoId = await getGrupoIdFromPlanificacion(planificacionId)
         ↓
await loadGroupContext(grupoId)
  [Mismo proceso que Flujo 1]
         ↓
Payload incluye: perfilGrupo, estudiantes
         ↓
supabase.functions.invoke('generate-plan-completo')
         ↓
[Mismo proceso que Flujo 1]
```

### Flujo 3: Advanced Session Generation (useFullSessionGeneration)

```
Generación avanzada desde hook
         ↓
generateAIPlan(params con grupoId)
         ↓
await loadGroupContext(params.grupoId)
  [Mismo proceso que Flujo 1]
         ↓
Enriquece additionalContext con teacherSugerencias
         ↓
groupContext incluye: students, dominantProfile, additionalContext
         ↓
supabase.functions.invoke('modify-evaluation', { type: 'planning' })
         ↓
Edge function usa groupProfileSectionText con reglas pedagógicas
         ↓
OpenAI genera plan plain text con decisiones explícitas
         ↓
Plan parseado y usado en sesión
```

---

## Backward Compatibility ✅

### Casos Preservados

1. ✅ **Sin grupoId**: 
   - `loadGroupContext(undefined)` → retorna `{}`
   - Edge functions NO agregan sección de perfil
   - Output idéntico al anterior

2. ✅ **Grupo no encontrado en Supabase**:
   - Se usa fallback a mockGroups
   - Si tampoco está en mockGroups → retorna `{}`
   - Output idéntico al anterior

3. ✅ **Grupo sin estudiantes con ajustes**:
   - `estudiantes` es `undefined` (no se incluye en payload)
   - Solo se incluye `perfilGrupo` si hay distribución de estilos
   - Reglas pedagógicas ajustadas: "Include at least ONE UDL-based support"

4. ✅ **Grupo sin teacher_sugerencias en Supabase**:
   - Campo `teacherSugerencias` es `undefined`
   - NO se enriquece `additionalContext`
   - Funciona con datos de mockGroups solo

5. ✅ **Llamadas desde componentes legacy** (si los hubiera):
   - Si NO pasan `perfilGrupo` ni `estudiantes`
   - Edge functions manejan ausencia con condicional
   - Output idéntico al anterior

### Garantías

- ✅ Schemas de payload NO modificados (campos opcionales)
- ✅ NO se requieren migraciones de BD
- ✅ NO se modifican contratos públicos de API
- ✅ Output format NO modificado
- ✅ Fallback graceful en todos los puntos de falla

---

## Límites de Tamaño Implementados

### Cap de Estudiantes

**Constante en `groupContext.ts`**:
```typescript
const MAX_STUDENTS_WITH_ADJUSTMENTS = 10;
```

**Razón**:
- Grupo típico: 20-30 estudiantes
- Estudiantes con ajustes: ~20-40% (4-12 estudiantes)
- 10 estudiantes con ~3 contemplaciones cada uno = ~30 líneas de texto
- Añade ~500-1000 tokens al prompt (manejable)

**Implementación**:
```typescript
const filtered = students
  .filter(s => s.ajustes || (s.contemplaciones && s.contemplaciones.length > 0))
  .slice(0, MAX_STUDENTS_WITH_ADJUSTMENTS) // Cap
```

**Efecto**: Si hay más de 10 estudiantes con ajustes, solo los primeros 10 se incluyen en el prompt.

---

## Datos Reales de Supabase vs. Mock Fallback

### Tabla `grupos` en Supabase

**Contiene**:
- ✅ `id`, `name`, `year`, `section`
- ✅ `teacher_sugerencias` (JSONB) - editadas por docente
- ✅ `user_id` - para RLS

**NO contiene**:
- ❌ Lista de estudiantes
- ❌ Perfiles de aprendizaje de estudiantes
- ❌ Ajustes o contemplaciones de estudiantes

**Uso en Phase 4**:
- Se carga desde Supabase usando `supabase.from('grupos').select('teacher_sugerencias')...`
- Si no se encuentra (PGRST116) o hay error, se continúa sin `teacherSugerencias`
- No bloquea el flujo

### `mockGroups` (Fallback)

**Contiene**:
- ✅ Lista completa de estudiantes con perfiles y ajustes
- ✅ Datos hardcoded para demo/MVP

**Uso en Phase 4**:
- Se usa para calcular distribución de estilos
- Se usa para obtener estudiantes con ajustes/contemplaciones
- Fallback transparente si tabla `grupos` no existe o no tiene datos

**Futuro**: Si se agrega tabla `students` o `alumnos` en Supabase:
- Solo modificar `loadGroupContext()` en `groupContext.ts`
- Reemplazar `mockGroups.find()` por fetch de Supabase
- Consumidores (wizard, editor, hook) NO necesitan cambiar

---

## Manual Test Checklist

### Test 1: Wizard generation with grupo_id present

**Pasos:**
1. En wizard, seleccionar grupo "9no 1" (tiene estudiantes con ajustes)
2. Completar wizard y generar planes
3. Verificar console logs: `[PHASE4-Profile] Using group profile`
4. Abrir una sesión generada y verificar plan HTML

**Resultado esperado:**
- ✅ Log muestra: `{ tamanio: 10, dominante: "Visual" (o el más frecuente), estudiantesConAjustes: X, teacherSugerenciasPresent: true/false }`
- ✅ Plan contiene al menos 2 decisiones explícitas en DESARROLLO basadas en perfil
- ✅ Sección "Diferenciación/Adaptaciones" tiene al menos 3 adaptaciones concretas
- ✅ Adaptaciones incluyen: Momento, Perfil/Necesidad, Propósito, Cómo aplicarla

### Test 2: EditorSesionNuevo generation with same grupo_id

**Pasos:**
1. Abrir una sesión existente de una planificación con grupo_id
2. Hacer clic en "Generar plan con IA" o regenerar
3. Verificar console logs: `[PHASE4-EditorSesion] Using group profile`
4. Verificar que el plan generado tiene decisiones explícitas

**Resultado esperado:**
- ✅ Log muestra perfil del grupo
- ✅ Plan tiene decisiones basadas en perfil (mismo comportamiento que wizard - CONSISTENCIA)
- ✅ Si el grupo tiene `teacherSugerencias` en Supabase, aparecen en logs

### Test 3: useFullSessionGeneration → modify-evaluation planning path

**Pasos:**
1. Usar el path avanzado de generación (si está expuesto en UI, o verificar logs)
2. Verificar console logs: `[PHASE4-useFullSessionGen] Using group profile`
3. Verificar output en formato plain text (INICIO / DESARROLLO / CIERRE)

**Resultado esperado:**
- ✅ Output respeta formato plain text (NO HTML, NO Markdown)
- ✅ Contiene secciones: INICIO, DESARROLLO, CIERRE (sin extras)
- ✅ Cada sección tiene: `Actividad:` con decisiones explícitas, `Recursos:` con lista
- ✅ Si hay `teacherSugerencias`, se reflejan en el contenido

### Test 4: No grupo_id → behavior unchanged

**Pasos:**
1. Crear planificación SIN seleccionar grupo (grupo_id = undefined)
2. Generar planes
3. Verificar console logs: `[PHASE4-Profile] No group profile available`
4. Verificar output

**Resultado esperado:**
- ✅ Log indica modo backward compatibility
- ✅ Plan se genera sin errores
- ✅ Plan tiene contenido genérico (sin personalizaciones basadas en perfil)
- ✅ Comportamiento idéntico a Phase 2 (antes de agregar perfiles)

### Test 5: Large groups → caps applied

**Pasos:**
1. Modificar `mockGroups` temporalmente para tener un grupo con 15+ estudiantes con ajustes
2. Generar plan para ese grupo
3. Verificar console logs: `estudiantesConAjustes`
4. Verificar payload enviado a edge function

**Resultado esperado:**
- ✅ Log muestra: `estudiantesConAjustes: 10` (no 15+)
- ✅ Payload contiene máximo 10 estudiantes en array `estudiantes`
- ✅ Plan se genera exitosamente (no falla por prompt demasiado largo)

### Test 6: teacher_sugerencias from Supabase

**Pasos:**
1. En componente `GroupProfile`, editar y guardar sugerencias para un grupo
2. Verificar que se guardó en Supabase (console log o query directa)
3. Generar un plan para ese grupo
4. Verificar console logs y payload

**Resultado esperado:**
- ✅ Log muestra: `teacherSugerenciasPresent: true`
- ✅ En Path A (useFullSessionGeneration), `additionalContext` incluye las sugerencias
- ✅ En Path B (wizard/editor), las sugerencias están disponibles para usar en prompts futuros (preparado para integración)

---

## Decisiones de Diseño Clave

### 1. Enfoque Híbrido (Supabase + Mock)

**Decisión**: Cargar `teacher_sugerencias` desde Supabase, pero usar `mockGroups` para estudiantes.

**Razón**: 
- Supabase solo tiene tabla `grupos` (sin tabla de estudiantes)
- Permite usar datos reales cuando existen
- Fallback transparente a mock para demo/MVP
- Futuro-proof: Solo cambiar helper si se agrega tabla de estudiantes

### 2. Single Source of Truth

**Decisión**: Crear helper compartido en `src/utils/groupContext.ts`.

**Razón**:
- Evita duplicación de código
- Garantiza consistencia entre paths
- Facilita mantenimiento (un solo lugar para cambiar lógica)
- Simplifica testing

### 3. Anonimización Obligatoria

**Decisión**: NO enviar nombres de estudiantes a la IA, usar "Estudiante A, B, C...".

**Razón**:
- Privacidad de datos sensibles
- Cumplimiento de regulaciones (GDPR/similares)
- No necesario para personalización pedagógica
- Reduce tamaño de prompt

### 4. Cap de Estudiantes

**Decisión**: Limitar a 10 estudiantes con ajustes en prompt.

**Razón**:
- Evita prompts excesivamente largos
- 10 estudiantes es suficiente para personalización significativa
- Reduce riesgo de timeout en edge functions
- Mantiene costos de OpenAI controlados

### 5. Fail Gracefully

**Decisión**: Si cualquier paso falla, retornar objeto vacío (NO lanzar errores).

**Razón**:
- No debe bloquear generación de planes si perfil no está disponible
- Backward compatibility con planificaciones sin grupo
- UX más robusta (mejor un plan genérico que ningún plan)

---

## Archivos No Modificados (Reutilización de Phase 3)

**Edge functions**:
- `supabase/functions/generate-plan-completo/index.ts` - YA acepta y usa `perfilGrupo`, `estudiantes`
- `supabase/functions/modify-evaluation/index.ts` - YA acepta y usa `groupContext.students`, `dominantProfile`

**Razón**: Phase 3 ya implementó la lógica de prompts enriquecidos. Phase 4 solo necesitó hacer consistente el envío de datos desde TODOS los puntos de entrada.

---

## Próximos Pasos (Opcional - Fuera de Scope)

### Prioridad MEDIA

1. **Integración de `teacherSugerencias` en prompts de Path B**:
   - Actualmente se incluyen en `additionalContext` de Path A
   - Se podría agregar sección explícita en `generate-plan-completo`
   - Ejemplo: "SUGERENCIAS DEL DOCENTE: ..." después de `groupProfileSection`

### Prioridad BAJA

2. **Tabla de estudiantes en Supabase**:
   - Crear `CREATE TABLE students` o `alumnos`
   - Campos: `id`, `grupo_id` (FK), `perfil`, `ajustes`, `contemplaciones` (JSONB)
   - Modificar `loadGroupContext()` para usar tabla real
   - Agregar UI para que docentes gestionen estudiantes

3. **Caching de datos de grupo**:
   - Si el mismo `grupoId` se usa múltiples veces, cachear en memoria
   - Evita múltiples fetches a Supabase
   - Invalidar cache cuando se editan `teacher_sugerencias`

4. **Analytics de uso de perfiles**:
   - Trackear cuántas generaciones usan perfil vs. sin perfil
   - Medir impacto en calidad percibida de planes
   - Iterar en prompts basado en feedback

---

## Conclusión

✅ **Phase 4 completada exitosamente.**

**Impacto**:
- 🎯 **Consistencia total**: TODOS los puntos de entrada ahora usan perfil de grupo
- 📊 **Datos reales**: `teacher_sugerencias` vienen de Supabase
- 🔄 **Fallback inteligente**: Mock data para estudiantes hasta que exista tabla real
- 🔒 **Privacidad**: Anonimización de nombres de estudiantes
- ⚡ **Optimizado**: Caps para evitar prompts gigantes
- ✅ **Backward compatible**: Sin perfil = comportamiento idéntico al anterior

**Archivos afectados**:
- NUEVO: `src/utils/groupContext.ts` (266 líneas)
- Modificado: `src/pages/PlanificacionWizard.tsx` (eliminó código duplicado, usa helper)
- Modificado: `src/components/planificacion/EditorSesionNuevo.tsx` (carga contexto)
- Modificado: `src/hooks/useFullSessionGeneration.ts` (enriquece groupContext)
- NO modificado: Edge functions (ya preparados en Phase 3)

**Testing pendiente**: Ver "Manual Test Checklist" arriba.

**Documentos relacionados**:
- `docs/phase4_group_profile_sources_audit.md` - Audit de fuentes de datos
- `docs/phase4_group_profile_consistency_implementation.md` - Este documento
- `docs/phase3_profile_usage_implementation.md` - Implementación previa de prompts enriquecidos

















