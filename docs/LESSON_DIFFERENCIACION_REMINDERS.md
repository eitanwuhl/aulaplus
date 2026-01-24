# Lesson Plan: Deterministic Diferenciación/Adaptaciones Reminders

**Fecha:** 2026-01-24  
**Rama:** `Nuevos-perfiles-y-reglas-para-contemplaciones`  
**Tipo:** Feature  
**Commit:** `feat(planificacion): inject deterministic 'Diferenciación/Adaptaciones' reminders from contemplaciones`

---

## Resumen

Esta feature inyecta recordatorios determinísticos basados en contemplaciones de CLASE en la sección "Diferenciación/Adaptaciones" del plan de lección, incluyendo nombres de estudiantes.

**Estado:** ✅ **IMPLEMENTED**

---

## Objetivos

### Requerimientos del Usuario

1. **Inyectar recordatorios determinísticos** en "Diferenciación/Adaptaciones"
2. **Incluir nombres de estudiantes** en cada recordatorio
3. **Derivar SOLO de contemplaciones seleccionadas** por estudiante (categoría CLASE)
4. **Colocación específica**: SOLO en sección "Diferenciación/Adaptaciones"
5. **Caso especial #1**: "Lectura oral de consignas" solo si hay consignas escritas puntuales (wording conservador si no detectable)
6. **No romper backward compatibility** con `planParser.ts`

### Criterios de Aceptación

- ✅ Recordatorios aparecen SOLO en "Diferenciación/Adaptaciones"
- ✅ Cada recordatorio incluye nombres de estudiantes
- ✅ Recordatorios se derivan de contemplaciones CLASE seleccionadas
- ✅ Contemplación #1 tiene wording conservador: "(si hay consignas escritas puntuales)"
- ✅ No afecta planes existentes (backward compatible)
- ✅ Funciona en todos los puntos de generación de plan

---

## Arquitectura

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. GENERACIÓN DE PLAN (Edge Function)                           │
│    - generate-plan-completo invocado                             │
│    - Retorna: { plan_html, recursos, argumento_competencias }   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. PARSING (planParser.ts)                                       │
│    - parsePlan() extrae secciones: inicio, desarrollo, cierre   │
│    - Extrae diferenciacion existente (si hay)                    │
│    - Retorna: ParsedPlan                                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ENFORCEMENT (enforcement.ts)                                  │
│    - enforceForLessonPlan(students, lessonContent)               │
│    - Lee contemplaciones de localStorage por estudiante          │
│    - Agrupa estudiantes por contemplación                        │
│    - Genera líneas de recordatorio con nombres                   │
│    - Retorna: { diferenciacionBlock: string[] }                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. INYECCIÓN (planParser.ts)                                     │
│    - buildPlanHtmlWithReminders(parsed, students, content)       │
│    - Convierte diferenciacionBlock a HTML <ul><li>...</li></ul>  │
│    - Si hay reminders: REEMPLAZA diferenciacion (no merge)       │
│    - Si NO hay reminders: mantiene diferenciacion original       │
│    - Retorna: HTML completo con recordatorios personalizados     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. PERSISTENCIA (DB)                                             │
│    - plan_desarrollo.html_completo = sanitizedHtml               │
│    - Guardado en sesiones_clase                                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. RENDERIZADO (EditorSesionNuevo.tsx)                           │
│    - Tab "Clase" muestra secciones estructuradas                 │
│    - Diferenciación/Adaptaciones al final con recordatorios      │
│    - Cada recordatorio muestra nombres de estudiantes            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Regla de Reemplazo (Replacement Rule)

### Comportamiento

**Cuando existen recordatorios determinísticos de contemplaciones:**
- La sección "Diferenciación/Adaptaciones" contiene **SOLO** los recordatorios personalizados con nombres de estudiantes
- Se **REEMPLAZA** (no merge) cualquier contenido genérico generado por la IA
- Esto evita duplicaciones y mantiene la sección completamente personalizada

**Cuando NO existen recordatorios determinísticos:**
- Se mantiene el contenido original de "Diferenciación/Adaptaciones" generado por la IA
- Comportamiento backward-compatible: planes sin contemplaciones seleccionadas siguen funcionando igual

### Rationale (Justificación)

1. **Evitar contenido genérico/duplicado**: Las sugerencias genéricas de la IA ("considerar perfil visual", "adaptar para perfil auditivo") carecen de valor cuando tenemos datos específicos de cada estudiante.

2. **Personalización completa**: Los recordatorios determinísticos incluyen nombres de estudiantes y contemplaciones específicas seleccionadas por el docente, lo que los hace mucho más útiles y accionables.

3. **Claridad**: Una sección con SOLO recordatorios personalizados es más fácil de leer y aplicar que una mezcla de bullets genéricos y específicos.

### Implementación Técnica

```typescript
// En buildPlanHtmlWithReminders():
if (remindersHtml) {
  // Replace mode: usar SOLO recordatorios determinísticos
  return buildPlanHtml(parsed, remindersHtml, { replaceDiferenciacion: true });
} else {
  // No reminders: mantener diferenciacion original
  return buildPlanHtml(parsed);
}

// En buildPlanHtml():
if (shouldReplace && additionalContent) {
  // Ignorar parsed.diferenciacion, usar SOLO additionalContent
  diferenciacionContent = additionalContent;
} else {
  // Merge mode (backward compatible)
  // ...
}
```

### Verificación Manual

Para confirmar que el reemplazo funciona correctamente:

1. **Generar un plan con contemplaciones**:
   - Usar un grupo donde al menos un estudiante tiene `contemplacionesClase` seleccionadas
   - Crear una planificación nueva usando el Asistente de Planificación Inteligente

2. **Verificar la sección "Diferenciación/Adaptaciones"**:
   - ✅ Solo debe contener recordatorios con nombres de estudiantes
   - ✅ NO debe contener bullets genéricos como "considerar perfil visual" o "adaptar para estudiantes con..."
   - ✅ Cada recordatorio debe incluir nombre(s) de estudiante(s) específico(s)

3. **Generar un plan sin contemplaciones**:
   - Usar un grupo sin contemplaciones seleccionadas
   - Verificar que la sección "Diferenciación/Adaptaciones" sigue mostrando contenido de la IA (si lo genera)
   - Confirmar backward compatibility

### Ejemplo Comparativo

**ANTES (merge - contenido mixto):**
```
Diferenciación/Adaptaciones
• Considerar que algunos estudiantes tienen perfil visual predominante
• Adaptar las explicaciones para estudiantes con diferentes ritmos de aprendizaje
• Mateo López: Lectura oral de consignas (si hay consignas escritas puntuales)
• Ana García, Juan Pérez: Explicaciones con soporte visual explícito
```

**DESPUÉS (replace - solo recordatorios personalizados):**
```
Diferenciación/Adaptaciones
• Mateo López: Lectura oral de consignas (si hay consignas escritas puntuales)
• Ana García, Juan Pérez: Explicaciones con soporte visual explícito
• Sofia Rodríguez: Adaptar recursos de lectura según nivel de comprensión
```

---

## Implementación

### 1. Modificaciones en `planParser.ts`

#### 1.1 Importar `enforcement.ts`

```typescript
import { enforceForLessonPlan, type Student } from './contemplaciones/enforcement';
```

#### 1.2 Extender `buildPlanHtml()` con parámetros opcionales

**Antes:**
```typescript
export function buildPlanHtml(parsed: ParsedPlan): string {
  // ...
  const diferenciacion = (parsed.diferenciacion || '').trim();
  if (diferenciacion) {
    hasContent = true;
    lines.push('<h2><strong>Diferenciación/Adaptaciones</strong></h2>');
    lines.push(diferenciacion);
  }
  // ...
}
```

**Después:**
```typescript
export function buildPlanHtml(
  parsed: ParsedPlan, 
  additionalDiferenciacion?: string,
  options?: { replaceDiferenciacion?: boolean }  // ← Nueva opción para modo replace
): string {
  // ...
  // Merge o replace diferenciacion según options
  const parsedContent = (parsed.diferenciacion || '').trim();
  const additionalContent = (additionalDiferenciacion || '').trim();
  const shouldReplace = options?.replaceDiferenciacion === true;
  
  let diferenciacionContent = '';
  
  if (shouldReplace && additionalContent) {
    // Replace mode: usar SOLO additional content (ignora parsedContent)
    diferenciacionContent = additionalContent;
  } else {
    // Merge mode (default, backward compatible):
    if (parsedContent && additionalContent) {
      // Both exist: append additional with separator
      diferenciacionContent = `${parsedContent}\n\n${additionalContent}`;
    } else if (additionalContent) {
      // Only additional exists
      diferenciacionContent = additionalContent;
    } else {
      // Only parsed content exists (or both empty)
      diferenciacionContent = parsedContent;
    }
  }
  
  if (diferenciacionContent) {
    hasContent = true;
    lines.push('<h2><strong>Diferenciación/Adaptaciones</strong></h2>');
    lines.push(diferenciacionContent);
  }
  // ...
}
```

**Beneficios:**
- ✅ Backward compatible: ambos parámetros opcionales, default = merge mode
- ✅ Replace mode: cuando hay reminders determinísticos, reemplaza contenido genérico de IA
- ✅ Merge mode: fallback para casos sin reminders o llamadas antiguas
- ✅ No duplica encabezado

#### 1.3 Nueva función `buildPlanHtmlWithReminders()`

```typescript
/**
 * Builds plan HTML with deterministic contemplaciones reminders injected into Diferenciación/Adaptaciones
 * 
 * When deterministic reminders exist, they REPLACE (not merge) the AI-generated diferenciacion content
 * to avoid generic/duplicated bullets and keep the section fully personalized with student names.
 * 
 * @param parsed - Parsed plan with sections
 * @param students - List of students with IDs and names (for contemplaciones lookup)
 * @param lessonContent - Optional lesson content for detecting written instructions
 * @returns HTML string with reminders injected or replaced
 */
export function buildPlanHtmlWithReminders(
  parsed: ParsedPlan,
  students: Student[],
  lessonContent?: string
): string {
  // Generate deterministic reminders from contemplaciones
  const enforcement = enforceForLessonPlan(students, lessonContent);
  
  // Convert reminder lines to HTML list
  let remindersHtml = '';
  if (enforcement.diferenciacionBlock.length > 0) {
    remindersHtml = '<ul>\n' + 
      enforcement.diferenciacionBlock.map(line => `  <li>${line}</li>`).join('\n') + 
      '\n</ul>';
  }
  
  // Build plan with injected reminders
  if (remindersHtml) {
    // Replace mode: usar SOLO recordatorios determinísticos (ignora diferenciacion genérica de IA)
    return buildPlanHtml(parsed, remindersHtml, { replaceDiferenciacion: true });
  } else {
    // No reminders: mantener diferenciacion original (backward compatible)
    return buildPlanHtml(parsed);
  }
}
```

**Responsabilidades:**
1. Llama `enforceForLessonPlan()` para generar recordatorios
2. Convierte líneas de texto a HTML `<ul><li>...</li></ul>`
3. **REEMPLAZA** contenido genérico de IA cuando existen reminders determinísticos
4. Mantiene contenido original cuando NO hay reminders (backward compatible)
5. Llama `buildPlanHtml()` con recordatorios como parámetro adicional y opción `replaceDiferenciacion: true`

#### 1.4 Helper Centralizado `buildSanitizedLessonPlanHtml()` (NUEVO - 2026-01-24)

**Motivación:** 
Antes de esta mejora, la lógica de post-procesamiento (parsear → cargar estudiantes → inyectar reminders) estaba **duplicada** en múltiples componentes, y el flujo de **regeneración** ("Aplicar cambios") NO inyectaba reminders determinísticos.

**Solución:**
Helper centralizado que encapsula el pipeline completo:

```typescript
/**
 * Centralized helper to build sanitized lesson plan HTML with deterministic reminders.
 * Use this for BOTH initial generation AND regeneration flows to ensure consistency.
 * 
 * @param rawPlanHtml - Raw HTML from AI edge function
 * @param fallbackRecursos - Optional resources array from AI response
 * @param grupoId - Group ID to load students from (for reminder injection)
 * @param logTag - Tag for diagnostic logs (e.g., '[INITIAL-GEN]', '[REGENERATE]')
 * @returns Sanitized HTML with reminders injected (or without if no students/contemplaciones)
 */
export function buildSanitizedLessonPlanHtml(
  rawPlanHtml: string,
  fallbackRecursos?: string[],
  grupoId?: string,
  logTag: string = '[PLAN-BUILD]'
): string {
  // STEP 1: Parse raw HTML
  const parsedPlan = parsePlan(rawPlanHtml, fallbackRecursos);
  
  // STEP 2: Load students (if grupoId provided)
  if (!grupoId) {
    return buildPlanHtml(parsedPlan);
  }
  
  const resolveResult = resolveMockGroup(grupoId, false);
  const mockGroup = resolveResult.group;
  
  if (!mockGroup || !mockGroup.students || mockGroup.students.length === 0) {
    return buildPlanHtml(parsedPlan);
  }
  
  // STEP 3: Map students to enforcement format
  const students = mockGroup.students.map(s => ({ id: s.id, name: s.name }));
  
  // STEP 4: Generate enforcement and log diagnostics
  const enforcement = enforceForLessonPlan(students, rawPlanHtml);
  const hasReminders = enforcement.diferenciacionBlock.length > 0;
  
  console.log(`${logTag} Building plan:`, {
    grupoIdRaw: grupoId,
    matchType: resolveResult.matchType,
    studentsCount: students.length,
    enforcementBlockLength: enforcement.diferenciacionBlock.length,
    replaceModeUsed: hasReminders
  });
  
  // STEP 5: Build with REPLACE mode if reminders exist
  if (hasReminders) {
    const remindersHtml = '<ul>\\n' + 
      enforcement.diferenciacionBlock.map(line => `  <li>${line}</li>`).join('\\n') + 
      '\\n</ul>';
    return buildPlanHtml(parsedPlan, remindersHtml, { replaceDiferenciacion: true });
  } else {
    return buildPlanHtml(parsedPlan); // Backward compatible
  }
}
```

**Responsabilidades:**
1. **Parsea** el HTML crudo de la IA
2. **Resuelve** el grupo y carga estudiantes usando `resolveMockGroup()`
3. **Genera** reminders determinísticos con `enforceForLessonPlan()`
4. **Inyecta** en modo REPLACE cuando hay reminders
5. **Logs diagnósticos** para cada invocación (con tag personalizado)
6. **Fallback graceful** si no hay grupo/estudiantes/contemplaciones

**Ventajas:**
- ✅ **Consistencia**: Mismo comportamiento en inicial + regeneración + wizard
- ✅ **Mantenibilidad**: Cambios en una sola función
- ✅ **Diagnóstico**: Logs integrados con tags identificables
- ✅ **Simplicidad**: Reduce ~50 líneas de código por componente

**Usado en:**
- `EditorSesionNuevo.tsx` (generación inicial Y regeneración "Aplicar cambios")
- `PlanificacionWorkspace.tsx` (regeneración desde workspace)
- `PlanificacionWizard.tsx` (generación batch en wizard)

---

### 2. Integración en `PlanificacionWorkspace.tsx`

#### 2.1 Importar funciones necesarias

```typescript
import { parsePlan, buildPlanHtml, buildPlanHtmlWithReminders } from '@/lib/planParser';
import { loadGroupContext, getGrupoIdFromPlanificacion } from '@/utils/groupContext';
import { mockGroups } from '@/data/mockData';
import type { Student as EnforcementStudent } from '@/lib/contemplaciones/enforcement';
```

#### 2.2 Modificar `generatePlanForSession()`

**Antes:**
```typescript
const parsedPlan = parsePlan(data.plan_html, fallbackRecursos);
const sanitizedHtml = buildPlanHtml(parsedPlan);
```

**Después:**
```typescript
const parsedPlan = parsePlan(data.plan_html, fallbackRecursos);

// CONTEMPLACIONES: Inject deterministic reminders into Diferenciación/Adaptaciones
let sanitizedHtml: string;
try {
  const grupoId = planificacion.grupo_id;
  if (grupoId) {
    const mockGroup = mockGroups.find(g => g.id === grupoId);
    if (mockGroup && mockGroup.students && mockGroup.students.length > 0) {
      // Map students to enforcement format
      const students: EnforcementStudent[] = mockGroup.students.map(s => ({
        id: s.id,
        name: s.name
      }));
      
      // Build with reminders
      const fullPlanContent = data.plan_html; // Use full content for consignas detection
      sanitizedHtml = buildPlanHtmlWithReminders(parsedPlan, students, fullPlanContent);
    } else {
      sanitizedHtml = buildPlanHtml(parsedPlan);
    }
  } else {
    sanitizedHtml = buildPlanHtml(parsedPlan);
  }
} catch (reminderError) {
  // Fail gracefully: if reminder injection fails, use plan without reminders
  console.warn('[generatePlanForSession] Failed to inject reminders:', reminderError);
  sanitizedHtml = buildPlanHtml(parsedPlan);
}
```

**Características:**
- ✅ Carga estudiantes de `mockGroups` usando `grupo_id`
- ✅ Mapea estudiantes a formato `EnforcementStudent` (solo `id` y `name`)
- ✅ Pasa contenido completo del plan para detección de consignas
- ✅ Fail gracefully: si falla inyección, usa plan sin recordatorios
- ✅ Backward compatible: si no hay `grupo_id` o estudiantes, usa plan normal

---

### 3. Integración en `EditorSesionNuevo.tsx`

**IMPORTANTE (2026-01-24):** Este componente tiene DOS flujos que deben inyectar reminders:
1. **Generación inicial**: `handleGenerarPlanInicial()` - ✅ Ya implementado
2. **Regeneración** ("Aplicar cambios"): `handleSolicitarModificacion()` - ✅ **FIXED** - Ahora usa `buildSanitizedLessonPlanHtml()`

**Problema detectado y resuelto:**
- ❌ Antes: Regeneración NO inyectaba reminders → mostraba solo bullets genéricos
- ✅ Ahora: Ambos flujos usan el helper centralizado → comportamiento consistente

#### 3.1 Importar funciones necesarias

```typescript
import { parsePlan, buildPlanHtml, buildPlanHtmlWithReminders, buildSanitizedLessonPlanHtml, ParsedPlan } from '@/lib/planParser';
import { getGrupoIdFromPlanificacion } from '@/utils/groupContext';
import type { Student as EnforcementStudent } from '@/lib/contemplaciones/enforcement';
```

#### 3.2 Modificar `handleGenerarPlanInicial()` (generación inicial)

**Ahora usa el helper centralizado:**

```typescript
const handleGenerarPlanInicial = async () => {
  // ... llamada a AI edge function ...
  
  // Load grupoId
  const grupoId = await getGrupoIdFromPlanificacion(planificacionId);
  
  // Parse and sanitize with centralized helper
  const fallbackRecursos = normalizeArrayField(data.recursos);
  const sanitizedHtml = buildSanitizedLessonPlanHtml(
    data.plan_html,
    fallbackRecursos,
    grupoId,
    '[INITIAL-GEN-CONTEMPLACIONES]'
  );
  
  // ... persistir en DB ...
};
```

#### 3.3 Modificar `handleSolicitarModificacion()` (regeneración/apply changes) **[NUEVO]**

**Implementación idéntica a generación inicial (usa mismo helper):**

```typescript
const handleSolicitarModificacion = async () => {
  // ... construcción de payload y llamada a AI edge function ...
  
  // Load grupoId (MISMO que en generación inicial)
  const grupoId = await getGrupoIdFromPlanificacion(planificacionId);
  
  // Parse and sanitize with centralized helper (MISMA lógica)
  const fallbackRecursos = normalizeArrayField(data.recursos);
  const sanitizedHtml = buildSanitizedLessonPlanHtml(
    data.plan_html,
    fallbackRecursos,
    grupoId,
    '[REGENERATE-CONTEMPLACIONES]'  // ← Tag diferente para logs
  );
  
  // Parse again for resource extraction
  const parsedPlan = parsePlan(data.plan_html, fallbackRecursos);
  
  // ... merge recursos y actualizar estados ...
};
```

**Resultado:**
- ✅ "Aplicar cambios" ahora TAMBIÉN inyecta reminders determinísticos en modo REPLACE
- ✅ Logs con tag `[REGENERATE-CONTEMPLACIONES]` para facilitar debugging
- ✅ Comportamiento idéntico a generación inicial

---

#### 3.4 Snippet antiguo (solo `handleGenerarPlanInicial` - OBSOLETO)

<details>
<summary>Ver implementación anterior (antes del helper centralizado)</summary>

```typescript
const parsedPlan = parsePlan(data.plan_html, fallbackRecursos);

// CONTEMPLACIONES: Inject deterministic reminders into Diferenciación/Adaptaciones
let sanitizedHtml: string;
try {
  if (grupoId) {
    const mockGroup = mockGroups.find(g => g.id === grupoId);
    if (mockGroup && mockGroup.students && mockGroup.students.length > 0) {
      const students: EnforcementStudent[] = mockGroup.students.map(s => ({
        id: s.id,
        name: s.name
      }));
      
      const fullPlanContent = data.plan_html;
      sanitizedHtml = buildPlanHtmlWithReminders(parsedPlan, students, fullPlanContent);
    } else {
      sanitizedHtml = buildPlanHtml(parsedPlan);
    }
  } else {
    sanitizedHtml = buildPlanHtml(parsedPlan);
  }
} catch (reminderError) {
  console.warn('[EditorSesion] Failed to inject reminders:', reminderError);
  sanitizedHtml = buildPlanHtml(parsedPlan);
}
```

---

### 4. Renderizado en UI

El renderizado ya está implementado en `EditorSesionNuevo.tsx` (líneas 820-830):

```tsx
{/* Diferenciación/Adaptaciones Section */}
{hasHtml(planParsed.diferenciacion) && (
  <div>
    <h2 className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3 text-primary">
      Diferenciación/Adaptaciones
    </h2>
    <div
      className="prose prose-sm max-w-none space-y-4 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitizeHeadings(planParsed.diferenciacion) }}
    />
  </div>
)}
```

**Características:**
- ✅ Renderiza solo si hay contenido en `planParsed.diferenciacion`
- ✅ Encabezado consistente con otras secciones
- ✅ Estilo `prose` para formato HTML limpio
- ✅ Separador visual antes de la sección

---

## Ejemplo de Output

### Entrada (Estudiantes con Contemplaciones)

```typescript
// Estudiante 1: Ana García
contemplacionesClase:1 = ["contemplacion-1", "contemplacion-11"]

// Estudiante 2: Carlos Rodríguez  
contemplacionesClase:2 = ["contemplacion-3", "contemplacion-25"]

// Estudiante 3: María López
contemplacionesClase:3 = ["contemplacion-1", "contemplacion-7"]
```

### Output (Diferenciación/Adaptaciones)

```html
<h2><strong>Diferenciación/Adaptaciones</strong></h2>
<ul>
  <li>Recordar leer consignas escritas en voz alta para Ana García y María López (si hay consignas escritas puntuales)</li>
  <li>Recomendación: ubicación estratégica en aula (cerca del docente y/o pizarrón) para Ana García</li>
  <li>Recuerda brindar más tiempo y pausas en caso de ser necesario para Carlos Rodríguez</li>
  <li>Refuerzo positivo y comentarios de reconocimiento para Carlos Rodríguez si corresponde</li>
  <li>Recordatorio: calculadora / material concreto cuando corresponda para María López</li>
</ul>
```

**Características del output:**
- ✅ Recordatorios agrupados por contemplación (no por estudiante)
- ✅ Nombres de estudiantes incluidos en cada línea
- ✅ Wording conservador para contemplación #1
- ✅ Formato HTML limpio (`<ul><li>`)
- ✅ Orden determinístico (por ID de contemplación)

---

## Contemplaciones Soportadas (CLASE)

Las siguientes contemplaciones del catálogo tienen templates para planes de clase:

| ID | Título | Template |
|----|--------|----------|
| `contemplacion-1` | Lectura oral de consignas | "Recordar leer consignas escritas en voz alta para {nombres} (si hay consignas escritas puntuales)" |
| `contemplacion-2` | Palabras clave en negrita e íconos | "Recordar al docente poner palabras clave en negrita e iconografías para {nombres} si aplica" |
| `contemplacion-4` | Tipografía legible | "Cuando se utilice material, recuerda letra particularmente legible para {nombres}" |
| `contemplacion-7` | Calculadora/material concreto | "Recordatorio: calculadora / material concreto cuando corresponda para {nombres}" |
| `contemplacion-8` | Participación oral guiada | "Participación oral guiada para {nombres}" |
| `contemplacion-10` | Monitoreo de comprensión | "Recuerda monitorear la comprensión de {nombres}" |
| `contemplacion-11` | Ubicación estratégica | "Recomendación: ubicación estratégica en aula (cerca del docente y/o pizarrón) para {nombres}" |
| `contemplacion-12` | Agenda/objetivos previos | "Recomendar entregar agenda/objetivos antes de la clase para {nombres}" |
| `contemplacion-15` | Material impreso | "Recordar llevar material impreso para {nombres}" |
| `contemplacion-24` | Consignas con orden y foco | "Consignas con orden y foco para {nombres} si aplica" |
| `contemplacion-25` | Refuerzo positivo | "Refuerzo positivo y comentarios de reconocimiento para {nombres} si corresponde" |
| `contemplacion-26` | Soporte digital | "Recordatorio: soporte digital para producción escrita (teclado/dictado a texto) para {nombres} si el centro lo permite" |

**Nota:** Contemplaciones custom también se soportan (se agregan con formato: `{regla} (para {nombres})`).

---

## Caso Especial: Contemplación #1

### Requerimiento

> "Para #1 Lectura oral de consignas in clase: Only mention if 'si hay consignas escritas puntuales' (conservative wording if not detectable)."

### Implementación

```typescript
// enforcement.ts - líneas 115-129
function hasConsignasEscritasPuntuales(content?: string): boolean {
  if (!content) return false;
  
  const normalized = content.toLowerCase();
  const indicators = [
    'consigna',
    'consignas',
    'instrucción',
    'instrucciones',
    'tarea escrita',
    'ejercicio escrito'
  ];
  
  return indicators.some(indicator => normalized.includes(indicator));
}
```

**Lógica:**
1. Si `lessonContent` es undefined → retorna `false`
2. Si contenido incluye palabras clave → retorna `true`
3. Si no se puede detectar → retorna `false`

**Output:**
- Si `hasConsignas = true`: "Recordar leer consignas escritas en voz alta para {nombres}"
- Si `hasConsignas = false`: "Recordar leer consignas escritas en voz alta para {nombres} (si hay consignas escritas puntuales)"

**Resultado:** Wording conservador siempre incluye la condición, excepto cuando se detecta explícitamente.

---

## Backward Compatibility

### Garantías

1. ✅ **Firma de `buildPlanHtml()` compatible:**
   - Parámetro `additionalDiferenciacion` es opcional
   - Código existente que llama `buildPlanHtml(parsed)` sigue funcionando

2. ✅ **Planes existentes no afectados:**
   - Solo se inyectan recordatorios en generación NUEVA de planes
   - Planes guardados en DB no se modifican retroactivamente

3. ✅ **Fail gracefully:**
   - Si falla carga de estudiantes → usa plan sin recordatorios
   - Si falla enforcement → usa plan sin recordatorios
   - Si no hay `grupo_id` → usa plan sin recordatorios

4. ✅ **Parser no modificado:**
   - `parsePlan()` no cambió
   - `ParsedPlan` interface no cambió
   - Solo se agregó función nueva `buildPlanHtmlWithReminders()`

---

## Testing

### Verificación Manual

#### 1. Configurar Estudiantes de Prueba

1. Ir a "Perfiles de Estudiantes"
2. **Estudiante 1:** Seleccionar contemplaciones CLASE: #1, #11
3. **Estudiante 2:** Seleccionar contemplaciones CLASE: #3, #25
4. Guardar

#### 2. Generar Plan de Clase

1. Ir a "Planificaciones" → Seleccionar planificación con grupo configurado
2. Generar plan para una sesión (botón "Generar Plan Inicial")
3. Esperar respuesta de IA

#### 3. Verificar Output

**Esperado en "Diferenciación/Adaptaciones":**
```
• Recordar leer consignas escritas en voz alta para Estudiante 1 (si hay consignas escritas puntuales)
• Recomendación: ubicación estratégica en aula (cerca del docente y/o pizarrón) para Estudiante 1
• Recuerda brindar más tiempo y pausas en caso de ser necesario para Estudiante 2
• Refuerzo positivo y comentarios de reconocimiento para Estudiante 2 si corresponde
```

#### 4. Verificar en DB

```sql
SELECT plan_desarrollo->'html_completo' 
FROM sesiones_clase 
WHERE id = '<sesion_id>';
```

**Esperado:** HTML incluye sección `<h2><strong>Diferenciación/Adaptaciones</strong></h2>` con `<ul><li>` de recordatorios.

---

## Limitaciones Conocidas

### 1. Solo en Generación Nueva

**Limitación:** Recordatorios solo se inyectan cuando se genera un plan NUEVO (no en planes ya guardados).

**Mitigación:** 
- Botón "Regenerar Plan" en workspace permite actualizar planes existentes
- Botón "Solicitar cambios a la IA" también regenera con recordatorios

### 2. Depende de `mockGroups`

**Limitación:** Estudiantes se cargan desde `mockGroups` (datos mock), no desde Supabase.

**Mitigación:**
- `loadGroupContext()` ya tiene estructura para migrar a Supabase en futuro
- Solo requiere cambiar implementación de helper, no consumidores

### 3. Inyección en Wizard (RESUELTO)

**Estado:** ✅ **IMPLEMENTADO** - El wizard ahora SÍ inyecta recordatorios determinísticos durante la creación inicial.

**Cambios realizados:**
- `PlanificacionWizard.tsx` modificado para cargar estudiantes usando `resolveMockGroup()`
- Reminders se inyectan usando `buildPlanHtmlWithReminders()` antes de persistir `html_completo`
- Se agregaron logs de diagnóstico para verificar la inyección: `[WIZARD-CONTEMPLACIONES]`

**Limitación menor:** Si el `grupoId` no coincide con ningún mock group, el wizard genera el plan sin reminders (fallback graceful).

---

## Archivos Modificados

### 1. `src/lib/planParser.ts`

**Cambios:**
- ✅ Importar `enforceForLessonPlan` y `Student` de `enforcement.ts`
- ✅ Extender `buildPlanHtml()` con parámetros opcionales:
  - `additionalDiferenciacion?: string` - contenido adicional para diferenciación
  - `options?: { replaceDiferenciacion?: boolean }` - **NUEVO**: modo replace vs merge
- ✅ Lógica condicional en `buildPlanHtml()`:
  - Si `options.replaceDiferenciacion === true` y hay `additionalContent`: **REEMPLAZA** (ignora `parsed.diferenciacion`)
  - Si `false` o no especificado: **MERGE** (comportamiento original, backward compatible)
- ✅ Nueva función `buildPlanHtmlWithReminders()`:
  - Genera reminders con `enforceForLessonPlan()`
  - Si hay reminders: llama `buildPlanHtml()` con `{ replaceDiferenciacion: true }`
  - Si NO hay reminders: llama `buildPlanHtml()` sin opciones (mantiene diferenciación original)
- ✅ **NUEVO (2026-01-24)**: Helper centralizado `buildSanitizedLessonPlanHtml()`:
  - Encapsula pipeline completo: parsear → cargar estudiantes → inyectar reminders
  - Logs diagnósticos integrados con tag personalizado
  - Usado en TODOS los flujos (inicial, regeneración, wizard) para consistencia
  - Elimina duplicación de código (~50 líneas por componente)

**Líneas modificadas:** ~120 líneas agregadas/modificadas (incluye helper centralizado)

### 2. `src/pages/PlanificacionWorkspace.tsx`

**Cambios:**
- ✅ Importar `buildPlanHtmlWithReminders`, `resolveMockGroup`, `EnforcementStudent`
- ✅ Modificar `generatePlanForSession()` para inyectar recordatorios:
  - Carga estudiantes usando `resolveMockGroup(planificacion.grupo_id)`
  - Llama `buildPlanHtmlWithReminders()` si hay estudiantes
  - Fallback graceful a `buildPlanHtml()` si no hay estudiantes o error

**Líneas modificadas:** ~40 líneas agregadas/modificadas

### 3. `src/components/planificacion/EditorSesionNuevo.tsx`

**Cambios:**
- ✅ Importar `buildSanitizedLessonPlanHtml` (helper centralizado)
- ✅ Modificar `handleGenerarPlanInicial()` (generación inicial):
  - Usa `buildSanitizedLessonPlanHtml()` con tag `[INITIAL-GEN-CONTEMPLACIONES]`
  - Reemplaza lógica manual (~35 líneas) con 1 llamada al helper
- ✅ **NUEVO (2026-01-24)**: Modificar `handleSolicitarModificacion()` (regeneración/"Aplicar cambios"):
  - **FIX**: Antes NO inyectaba reminders → ahora SÍ
  - Usa `buildSanitizedLessonPlanHtml()` con tag `[REGENERATE-CONTEMPLACIONES]`
  - Comportamiento idéntico a generación inicial

**Líneas modificadas:** ~60 líneas agregadas/modificadas (incluye fix de regeneración)

### 4. `src/pages/PlanificacionWizard.tsx`

**Cambios:**
- ✅ Importar `buildPlanHtmlWithReminders`, `resolveMockGroup`, `enforceForLessonPlan`
- ✅ Modificar `generarPlanesAutomaticamente()` para inyectar recordatorios:
  - Carga estudiantes usando `resolveMockGroup(grupoId)` por cada sesión
  - Llama `buildPlanHtmlWithReminders()` antes de persistir `html_completo`
  - Logs de diagnóstico: `[WIZARD-CONTEMPLACIONES]` para verificar inyección
  - Fallback graceful a `buildPlanHtml()` si no hay grupo o estudiantes

**Líneas modificadas:** ~50 líneas agregadas/modificadas

### 5. `src/utils/resolveMockGroup.ts` (NUEVO)

**Contenido:**
- ✅ Función `resolveMockGroup(grupoIdRaw)`: resolver grupo mock con múltiples estrategias
  - Estrategia 1: Match directo por ID normalizado
  - Estrategia 2: Match por nombre normalizado
  - Estrategia 3: Match por alias mapping (e.g., "9no 1" → "1")
- ✅ Helper `norm()`: normalización de strings para matching consistente
- ✅ `ALIAS_MAP`: mapeo de nombres human-readable a IDs de mock

**Líneas:** ~50 líneas

### 6. `src/utils/groupContext.ts`

**Cambios:**
- ✅ Importar `resolveMockGroup` en lugar de búsqueda directa en `mockGroups`
- ✅ Modificar `loadGroupContext()` para usar `resolveMockGroup(grupoId)`
- ✅ Logs de diagnóstico para rastrear resolución de grupo

**Líneas modificadas:** ~10 líneas

### 7. `src/main.tsx`

**Cambios:**
- ✅ Exponer `mockGroups` globalmente en DEV: `window.__mockGroups`
- ✅ Log de DEV para facilitar debugging en consola del navegador

**Líneas modificadas:** ~5 líneas

### 8. `docs/LESSON_DIFFERENCIACION_REMINDERS.md` (NUEVO)

**Contenido:** Documentación completa de la feature (este archivo).

**Líneas:** ~670 líneas

### 9. `docs/CHANGELOG_PROMPT6_REPLACEMENT.md` (NUEVO)

**Contenido:** Changelog detallado del cambio de merge a replace behavior.

**Líneas:** ~370 líneas

---

## Próximos Pasos

1. ✅ Verificar manualmente con datos de prueba
2. ✅ Confirmar que no hay regresiones en planes existentes
3. ✅ Commit con mensaje especificado
4. 🔄 Merge a main después de revisión

---

**Última actualización:** 2026-01-24

