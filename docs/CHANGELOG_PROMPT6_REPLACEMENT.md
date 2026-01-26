# Changelog: Replace Generic Diferenciación with Deterministic Contemplaciones Reminders

**Fecha:** 2026-01-24  
**Rama:** `Nuevos-perfiles-y-reglas-para-contemplaciones`  
**Tipo:** Feature Enhancement  
**Commit:** `feat(planificacion): replace generic diferenciación when deterministic reminders exist`

---

## Resumen Ejecutivo

Esta actualización cambia el comportamiento de la sección "Diferenciación/Adaptaciones" en los planes de lección generados:

- **ANTES**: Los recordatorios determinísticos de contemplaciones se **mezclaban** (merge) con el contenido genérico generado por la IA
- **AHORA**: Los recordatorios determinísticos **reemplazan** (replace) el contenido genérico cuando existen

**Objetivo**: Eliminar contenido genérico/duplicado y mantener la sección completamente personalizada con nombres de estudiantes específicos.

---

## Cambios Realizados

### 1. Código: `src/lib/planParser.ts`

#### 1.1 Función `buildPlanHtml()` - Nueva Opción de Reemplazo

**Cambio en la firma:**
```typescript
// ANTES
export function buildPlanHtml(
  parsed: ParsedPlan, 
  additionalDiferenciacion?: string
): string

// AHORA
export function buildPlanHtml(
  parsed: ParsedPlan, 
  additionalDiferenciacion?: string,
  options?: { replaceDiferenciacion?: boolean }  // ← NUEVO parámetro
): string
```

**Nueva lógica condicional:**
```typescript
const shouldReplace = options?.replaceDiferenciacion === true;

if (shouldReplace && additionalContent) {
  // Replace mode: usar SOLO additional content (ignora parsedContent)
  diferenciacionContent = additionalContent;
} else {
  // Merge mode (default, backward compatible)
  // ... lógica de merge existente ...
}
```

**Backward Compatibility:**
- El parámetro `options` es **opcional**
- Default: `replaceDiferenciacion = false` (comportamiento de merge original)
- Todas las llamadas existentes a `buildPlanHtml(parsed)` o `buildPlanHtml(parsed, additional)` siguen funcionando sin cambios

#### 1.2 Función `buildPlanHtmlWithReminders()` - Usa Replace Mode

**Cambio en la implementación:**
```typescript
// ANTES
return buildPlanHtml(parsed, remindersHtml);

// AHORA
if (remindersHtml) {
  // Replace mode: usar SOLO recordatorios determinísticos
  return buildPlanHtml(parsed, remindersHtml, { replaceDiferenciacion: true });
} else {
  // No reminders: mantener diferenciacion original
  return buildPlanHtml(parsed);
}
```

**Efecto:**
- Cuando `enforcement.diferenciacionBlock.length > 0`: **Reemplaza** contenido genérico de IA
- Cuando `enforcement.diferenciacionBlock.length === 0`: **Mantiene** contenido original de IA

### 2. Documentación: `docs/LESSON_DIFFERENCIACION_REMINDERS.md`

**Actualizaciones:**
1. ✅ Agregada sección "Regla de Reemplazo (Replacement Rule)" con:
   - Descripción del comportamiento
   - Rationale técnico
   - Ejemplo comparativo (ANTES vs DESPUÉS)
   - Guía de verificación manual

2. ✅ Actualizados snippets de código en sección "Implementación":
   - Firma extendida de `buildPlanHtml()` con `options` parameter
   - Lógica condicional de replace vs merge
   - Llamada actualizada en `buildPlanHtmlWithReminders()`

3. ✅ Actualizado diagrama de flujo de datos para reflejar comportamiento de replace

---

## Por Qué Este Cambio

### Problema: Contenido Genérico Mezclado con Personalizado

**Antes del cambio:**
```
Diferenciación/Adaptaciones
• Considerar que algunos estudiantes tienen perfil visual predominante     ← GENÉRICO (IA)
• Adaptar las explicaciones para diferentes ritmos de aprendizaje          ← GENÉRICO (IA)
• Mateo López: Lectura oral de consignas (si hay consignas escritas...)    ← PERSONALIZADO
• Ana García, Juan Pérez: Explicaciones con soporte visual explícito       ← PERSONALIZADO
```

**Problemas identificados:**
1. ❌ Redundancia: los bullets genéricos son vagos cuando tenemos datos específicos
2. ❌ Ruido: mezclar genérico + personalizado dificulta la lectura
3. ❌ Confusión: no queda claro cuáles son las acciones prioritarias

### Solución: Reemplazo Cuando Existe Contenido Personalizado

**Después del cambio:**
```
Diferenciación/Adaptaciones
• Mateo López: Lectura oral de consignas (si hay consignas escritas...)    ← SOLO PERSONALIZADO
• Ana García, Juan Pérez: Explicaciones con soporte visual explícito       ← SOLO PERSONALIZADO
• Sofía Rodríguez: Adaptar recursos de lectura según nivel de comprensión  ← SOLO PERSONALIZADO
```

**Beneficios:**
1. ✅ Claridad: solo acciones específicas y accionables
2. ✅ Personalización completa: todos los recordatorios incluyen nombres de estudiantes
3. ✅ Eficiencia: el docente ve directamente qué hacer con cada estudiante

### Caso Backward Compatible: Sin Contemplaciones

**Cuando NO hay contemplaciones seleccionadas:**
```
Diferenciación/Adaptaciones
• Considerar que algunos estudiantes tienen perfil visual predominante
• Adaptar las explicaciones para diferentes ritmos de aprendizaje
```

**Comportamiento:**
- ✅ Se mantiene el contenido original de la IA
- ✅ No se rompen planes existentes
- ✅ Compatible con flujos sin contemplaciones

---

## Cómo Verificar Manualmente

### Caso 1: Plan CON Contemplaciones Seleccionadas

**Pasos:**
1. Ir a un grupo donde al menos un estudiante tenga `contemplacionesClase` seleccionadas
2. Crear una nueva planificación usando el **Asistente de Planificación Inteligente**
3. Generar los planes de sesión

**Resultado esperado:**
- ✅ La sección "Diferenciación/Adaptaciones" contiene **SOLO** recordatorios con nombres de estudiantes
- ✅ **NO** aparecen bullets genéricos como:
  - "Considerar perfil visual predominante"
  - "Adaptar para diferentes ritmos de aprendizaje"
  - "Tener en cuenta estudiantes con..."
- ✅ Cada recordatorio incluye el nombre de al menos un estudiante

**Ejemplo:**
```
Diferenciación/Adaptaciones
• Mateo López, Juan Pérez: Lectura oral de consignas (si hay consignas escritas puntuales)
• Ana García: Explicaciones con soporte visual explícito
• Sofía Rodríguez, Pedro Gómez: Adaptar recursos de lectura según nivel de comprensión
```

### Caso 2: Plan SIN Contemplaciones Seleccionadas

**Pasos:**
1. Ir a un grupo donde **ningún** estudiante tenga `contemplacionesClase` seleccionadas
2. Crear una nueva planificación
3. Generar los planes de sesión

**Resultado esperado:**
- ✅ La sección "Diferenciación/Adaptaciones" muestra el contenido generado por la IA
- ✅ Puede incluir sugerencias genéricas (es aceptable en este caso)
- ✅ **Backward compatible**: planes antiguos siguen funcionando igual

**Ejemplo:**
```
Diferenciación/Adaptaciones
• Considerar que algunos estudiantes tienen perfil visual predominante
• Adaptar las explicaciones para estudiantes con diferentes ritmos de aprendizaje
• Proporcionar ejemplos concretos y material visual de apoyo
```

### Caso 3: Edición y Regeneración de Plan

**Pasos:**
1. Abrir un plan existente en el **Workspace de Planificación**
2. Regenerar el plan de una sesión usando el botón "Regenerar Plan"
3. Verificar la sección "Diferenciación/Adaptaciones"

**Resultado esperado:**
- ✅ Si el grupo tiene contemplaciones → **SOLO** reminders personalizados
- ✅ Si el grupo NO tiene contemplaciones → contenido de IA
- ✅ El comportamiento es consistente con la creación inicial

---

## Archivos Modificados

```
src/lib/planParser.ts                            [MODIFICADO]
├─ buildPlanHtml()                               ← Agregado parámetro options
└─ buildPlanHtmlWithReminders()                  ← Usa replace mode cuando hay reminders

docs/LESSON_DIFFERENCIACION_REMINDERS.md         [MODIFICADO]
├─ Sección "Regla de Reemplazo"                  ← NUEVA sección completa
├─ Sección "Implementación"                      ← Snippets actualizados
└─ Diagrama de flujo                             ← Actualizado

docs/CHANGELOG_PROMPT6_REPLACEMENT.md            [NUEVO]
└─ Este archivo                                  ← Documenta cambios
```

---

## Puntos de Integración

### Componentes que Heredan el Nuevo Comportamiento

Estos componentes **automáticamente** usan el nuevo comportamiento de reemplazo porque llaman a `buildPlanHtmlWithReminders()`:

1. **`src/pages/PlanificacionWizard.tsx`**
   - Flujo: Asistente de Planificación Inteligente → Crear Planificación
   - Línea: ~502 - `finalHtml = buildPlanHtmlWithReminders(parsedPlan, students, data.plan_html);`
   - ✅ Sin cambios necesarios

2. **`src/pages/PlanificacionWorkspace.tsx`**
   - Flujo: Workspace → Regenerar Plan de Sesión
   - Línea: ~225 - `sanitizedHtml = buildPlanHtmlWithReminders(parsedPlan, students, fullPlanContent);`
   - ✅ Sin cambios necesarios

3. **`src/components/planificacion/EditorSesionNuevo.tsx`**
   - Flujo: Editor de Sesión → Generar Plan Inicial
   - Línea: ~486 - `sanitizedHtml = buildPlanHtmlWithReminders(parsedPlan, students, fullPlanContent);`
   - ✅ Sin cambios necesarios

**Nota importante:** No se requieren cambios en ninguno de estos componentes. El nuevo comportamiento se hereda automáticamente a través de la función `buildPlanHtmlWithReminders()`.

---

## Testing Recomendado

### 1. Type Safety
```bash
# Verificar que no hay errores de TypeScript
npm run typecheck
# o
tsc --noEmit
```

### 2. Build
```bash
# Verificar que el build pasa sin errores
npm run build
```

### 3. Prueba Manual (Crítico)

**Escenario A: Grupo "9no 1" (CON contemplaciones)**
- Estudiante: Mateo López → tiene `contemplacionesClase` seleccionadas
- Crear planificación nueva
- **Verificar**: Solo reminders con nombres, sin bullets genéricos

**Escenario B: Grupo sin contemplaciones**
- Crear grupo temporal sin contemplaciones seleccionadas
- Crear planificación nueva
- **Verificar**: Contenido de IA se mantiene intacto

**Escenario C: Regeneración**
- Plan existente → Regenerar una sesión
- **Verificar**: Comportamiento consistente con creación inicial

---

## Notas de Implementación

### Decisiones de Diseño

1. **Parámetro `options` en lugar de nuevo parámetro booleano**
   - **Por qué**: Permite agregar más opciones en el futuro sin romper la firma
   - **Alternativa descartada**: `buildPlanHtml(parsed, additional, replace: boolean)`

2. **Default `replaceDiferenciacion = false`**
   - **Por qué**: Backward compatibility - comportamiento original se mantiene por defecto
   - **Beneficio**: Todas las llamadas existentes siguen funcionando sin cambios

3. **Condicional explícito en `buildPlanHtmlWithReminders()`**
   - **Por qué**: Claridad - se ve explícitamente cuándo se usa replace vs merge
   - **Beneficio**: Facilita debugging y mantenimiento futuro

### Consideraciones Futuras

**Posible extensión del objeto `options`:**
```typescript
options?: {
  replaceDiferenciacion?: boolean;
  // Futuras opciones posibles:
  // mergeSeparator?: string;        // Personalizar separador de merge
  // includeDuration?: boolean;      // Mostrar/ocultar duraciones
  // format?: 'html' | 'markdown';   // Formato de salida
}
```

---

## Resumen de Impacto

| Aspecto | Impacto | Notas |
|---------|---------|-------|
| **Backward Compatibility** | ✅ Sin ruptura | Parámetro opcional con default safe |
| **Componentes existentes** | ✅ Sin cambios requeridos | Heredan automáticamente el comportamiento |
| **Planes existentes** | ✅ Sin migración necesaria | Funcionalidad es runtime, no afecta DB |
| **Performance** | ✅ Sin cambio | Misma complejidad computacional |
| **UX para docentes** | ✅ Mejorado | Sección más clara y accionable |
| **Personalización** | ✅ Mejorado | 100% contenido específico con nombres |
| **Mantenibilidad** | ✅ Mejorado | Lógica claramente separada (replace vs merge) |

---

## Preguntas Frecuentes (FAQ)

### ¿Qué pasa si un estudiante tiene contemplaciones pero `enforcement` no genera ningún recordatorio?

**R:** Se mantiene el contenido original de la IA. El replace solo ocurre cuando `remindersHtml` es no-vacío.

### ¿Se puede volver al comportamiento de merge anterior?

**R:** Sí, técnicamente. Llamando `buildPlanHtml(parsed, remindersHtml, { replaceDiferenciacion: false })`, pero no hay UI para esto actualmente.

### ¿Esto afecta planes ya generados en la base de datos?

**R:** No. Los planes ya guardados en `sesiones_clase.plan_desarrollo.html_completo` no cambian. Solo afecta la **generación** o **regeneración** de nuevos planes.

### ¿Qué pasa si edito manualmente la sección "Diferenciación/Adaptaciones"?

**R:** Las ediciones manuales se preservan. El replace solo ocurre durante la **generación** automática del plan (Wizard, Regenerar, etc.). Una vez guardado, el HTML es editable libremente.

### ¿Cómo sé si un plan fue generado con replace o merge?

**R:** No hay marca explícita. Para verificar:
1. Si ves bullets genéricos ("considerar perfil visual...") **Y** recordatorios con nombres → merge (comportamiento antiguo)
2. Si ves **SOLO** recordatorios con nombres → replace (comportamiento nuevo)
3. Si ves **SOLO** bullets genéricos → no había contemplaciones (esperado)

---

## Contacto y Soporte

Para reportar problemas o inconsistencias con este cambio:
1. Verificar que estás en la rama `Nuevos-perfiles-y-reglas-para-contemplaciones`
2. Revisar los logs de consola: `[WIZARD-CONTEMPLACIONES]`, `[WORKSPACE-CONTEMPLACIONES]`, `[EDITOR-CONTEMPLACIONES]`
3. Documentar el caso específico (grupo, estudiantes, contemplaciones seleccionadas)
4. Incluir el HTML generado de la sección "Diferenciación/Adaptaciones"

---

**Última actualización:** 2026-01-24  
**Autor:** AI Assistant  
**Revisor:** Eitan Wuhl

