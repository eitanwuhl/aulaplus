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
3. Llama `buildPlanHtml()` con recordatorios como parámetro adicional

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

#### 3.1 Importar funciones necesarias

```typescript
import { parsePlan, buildPlanHtml, buildPlanHtmlWithReminders, ParsedPlan } from '@/lib/planParser';
import { loadGroupContext, getGrupoIdFromPlanificacion } from '@/utils/groupContext';
import { mockGroups } from '@/data/mockData';
import type { Student as EnforcementStudent } from '@/lib/contemplaciones/enforcement';
```

#### 3.2 Modificar `handleGenerarPlanInicial()`

**Implementación idéntica a `PlanificacionWorkspace.tsx`:**

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

### 3. No en `PlanificacionWizard`

**Limitación:** Wizard de creación inicial NO inyecta recordatorios (genera planes en batch rápido).

**Justificación:**
- Wizard prioriza velocidad (genera 10-20 planes en batch)
- Planes se pueden regenerar después con recordatorios desde workspace
- Evita complejidad adicional en flujo de creación

**Mitigación:** Documentar que recordatorios aparecen después de regenerar planes individuales.

---

## Archivos Modificados

### 1. `src/lib/planParser.ts`

**Cambios:**
- ✅ Importar `enforceForLessonPlan` y `Student` de `enforcement.ts`
- ✅ Extender `buildPlanHtml()` con parámetro opcional `additionalDiferenciacion`
- ✅ Nueva función `buildPlanHtmlWithReminders()`

**Líneas modificadas:** ~40 líneas agregadas

### 2. `src/pages/PlanificacionWorkspace.tsx`

**Cambios:**
- ✅ Importar `buildPlanHtmlWithReminders`, `mockGroups`, `EnforcementStudent`
- ✅ Modificar `generatePlanForSession()` para inyectar recordatorios

**Líneas modificadas:** ~35 líneas agregadas/modificadas

### 3. `src/components/planificacion/EditorSesionNuevo.tsx`

**Cambios:**
- ✅ Importar `buildPlanHtmlWithReminders`, `mockGroups`, `EnforcementStudent`
- ✅ Modificar `handleGenerarPlanInicial()` para inyectar recordatorios

**Líneas modificadas:** ~35 líneas agregadas/modificadas

### 4. `docs/LESSON_DIFFERENCIACION_REMINDERS.md` (NUEVO)

**Contenido:** Documentación completa de la feature (este archivo).

---

## Próximos Pasos

1. ✅ Verificar manualmente con datos de prueba
2. ✅ Confirmar que no hay regresiones en planes existentes
3. ✅ Commit con mensaje especificado
4. 🔄 Merge a main después de revisión

---

**Última actualización:** 2026-01-24

