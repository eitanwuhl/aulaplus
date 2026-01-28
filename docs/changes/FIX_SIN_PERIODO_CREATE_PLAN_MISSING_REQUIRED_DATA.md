# Fix: Validación de Datos Requeridos para Creación de Planificaciones "Sin Período Específico"

**Fecha**: 2025-01-XX  
**Tipo**: Bugfix  
**Alcance**: Corrección de validación excesivamente estricta que impedía crear planificaciones en modo "Sin Período Específico"

## Resumen de Causa Raíz

Después de arreglar la validación del paso 3 en el wizard, apareció un nuevo problema: al hacer clic en "Crear Planificación" en el flujo "Sin Período Específico", se mostraba un toast de error:

> "Error — Faltan datos requeridos para crear la planificación"

**Causa**: El guard clause en `handleFinish` (función `onFinish` en `PlanificacionWizard.tsx`) requería siempre que `wizardData.horario` existiera, pero para `tipo_planificacion === 'sin_periodo'`, el paso 1 (Horario) se salta intencionalmente y `wizardData.horario` puede ser `undefined`.

**Ubicación del problema**: `src/pages/PlanificacionWizard.tsx`, línea 657

```typescript
// Código problemático (ANTES)
if (!wizardData.contexto || !wizardData.horario || !wizardData.enfoque) {
  toast({
    title: "Error",
    description: "Faltan datos requeridos para crear la planificación",
    variant: "destructive"
  });
  return;
}
```

Este guard clause bloqueaba la creación cuando `wizardData.horario` era `undefined`, lo cual es correcto para "periodo_especifico" pero incorrecto para "sin_periodo".

## Archivos Modificados

### 1. `src/pages/PlanificacionWizard.tsx`

**Cambios realizados**:

1. **Validación condicional basada en `tipo_planificacion`** (líneas 656-695)
   - Validación separada para `contexto` y `enfoque` (siempre requeridos)
   - Validación condicional de `horario` (solo requerido para "periodo_especifico")
   - Validación específica para "sin_periodo" (requiere `cantidad_sesiones` y `duracion_por_sesion`)

2. **Campos opcionales en inserción de planificación** (líneas 731-756)
   - `horas_semanales` y `configuracion_horario` ahora usan optional chaining (`?.`) y fallback a `null`

3. **Logging DEV agregado** (líneas 658-665)
   - Log del estado de validación al inicio de `handleFinish`

**Código modificado**:

#### Validación Condicional

**Antes**:
```typescript
const handleFinish = async () => {
  if (!wizardData.contexto || !wizardData.horario || !wizardData.enfoque) {
    toast({
      title: "Error",
      description: "Faltan datos requeridos para crear la planificación",
      variant: "destructive"
    });
    return;
  }
  // ...
}
```

**Después**:
```typescript
const handleFinish = async () => {
  // DEV: Log validation state at start
  if (import.meta.env.DEV) {
    console.log('[PlanificacionWizard] handleFinish called', {
      tipo_planificacion: wizardData.tipo_planificacion,
      hasContexto: !!wizardData.contexto,
      hasHorario: !!wizardData.horario,
      hasEnfoque: !!wizardData.enfoque
    });
  }

  // Conditional validation based on tipo_planificacion
  // Always require contexto and enfoque
  if (!wizardData.contexto || !wizardData.enfoque) {
    toast({
      title: "Error",
      description: "Faltan datos requeridos para crear la planificación",
      variant: "destructive"
    });
    return;
  }

  // Require horario ONLY for periodo_especifico
  if (wizardData.tipo_planificacion !== 'sin_periodo' && !wizardData.horario) {
    toast({
      title: "Error",
      description: "Faltan datos requeridos para crear la planificación (horario no configurado)",
      variant: "destructive"
    });
    return;
  }

  // For sin_periodo, validate cantidad_sesiones and duracion_por_sesion
  if (wizardData.tipo_planificacion === 'sin_periodo') {
    if (!wizardData.contexto.cantidad_sesiones || wizardData.contexto.cantidad_sesiones <= 0) {
      toast({
        title: "Error",
        description: "Debes especificar una cantidad de sesiones mayor a 0",
        variant: "destructive"
      });
      return;
    }
    if (!wizardData.contexto.duracion_por_sesion || wizardData.contexto.duracion_por_sesion <= 0) {
      toast({
        title: "Error",
        description: "Debes especificar una duración por sesión mayor a 0 minutos",
        variant: "destructive"
      });
      return;
    }
  }
  // ...
}
```

#### Inserción de Planificación (Campos Opcionales)

**Antes**:
```typescript
const { data: planificacion, error: planError } = await supabase
  .from('planificaciones')
  .insert({
    // ...
    horas_semanales: wizardData.horario.horas_semanales,  // ❌ Error si horario es undefined
    configuracion_horario: wizardData.horario.configuracion,  // ❌ Error si horario es undefined
    // ...
  })
```

**Después**:
```typescript
const { data: planificacion, error: planError } = await supabase
  .from('planificaciones')
  .insert({
    // ...
    // horario fields: only for periodo_especifico
    horas_semanales: wizardData.horario?.horas_semanales || null,  // ✅ Opcional
    configuracion_horario: wizardData.horario?.configuracion || null,  // ✅ Opcional
    // ...
  })
```

## Reglas de Validación Implementadas

### Validación General (Todos los Tipos)

1. **`wizardData.contexto`**: Siempre requerido
   - Se usa en todos los flujos para grupo, materia, fechas/cantidad de sesiones, etc.

2. **`wizardData.enfoque`**: Siempre requerido
   - Se usa para unidades didácticas, competencias, modalidades, etc.

### Validación para "Período Específico"

3. **`wizardData.horario`**: Requerido cuando `tipo_planificacion === 'periodo_especifico'`
   - Se usa para generar fechas de sesiones y calcular duraciones
   - Se valida con mensaje específico: "horario no configurado"

### Validación para "Sin Período Específico"

4. **`wizardData.horario`**: NO requerido cuando `tipo_planificacion === 'sin_periodo'`
   - El paso 1 se salta intencionalmente
   - Los campos `horas_semanales` y `configuracion_horario` se insertan como `null`

5. **`wizardData.contexto.cantidad_sesiones`**: Requerido y debe ser > 0
   - Mensaje específico: "Debes especificar una cantidad de sesiones mayor a 0"

6. **`wizardData.contexto.duracion_por_sesion`**: Requerido y debe ser > 0
   - Mensaje específico: "Debes especificar una duración por sesión mayor a 0 minutos"

## Comportamiento Antes y Después

### Antes

**Flujo "Sin Período Específico"**:
1. Usuario completa paso 0 → salta a paso 2 → completa paso 2 → llega a paso 3
2. Usuario hace clic en "Crear Planificación"
3. **Resultado**: ❌ Toast de error: "Faltan datos requeridos para crear la planificación"
4. **Razón**: `wizardData.horario` es `undefined` porque el paso 1 nunca se completó

**Flujo "Período Específico"**:
1. Usuario completa pasos 0, 1, 2 → llega a paso 3
2. Si falta `horario`, muestra error genérico
3. Si falta `cantidad_sesiones` o `duracion_por_sesion`, no se valida específicamente

### Después

**Flujo "Sin Período Específico"**:
1. Usuario completa paso 0 (con `cantidad_sesiones` y `duracion_por_sesion`) → salta a paso 2 → completa paso 2 → llega a paso 3
2. Usuario hace clic en "Crear Planificación"
3. **Resultado**: ✅ Se valida correctamente (no requiere `horario`), se crea la planificación, se crean sesiones backlog y se navega al workspace

**Si faltan `cantidad_sesiones` o `duracion_por_sesion`**:
- **Resultado**: ✅ Toast específico: "Debes especificar una cantidad de sesiones mayor a 0" o "Debes especificar una duración por sesión mayor a 0 minutos"

**Flujo "Período Específico"**:
1. Usuario completa pasos 0, 1, 2 → llega a paso 3
2. Si falta `horario`, muestra error específico: "horario no configurado"
3. **Resultado**: ✅ Comportamiento sin cambios (mantiene validación estricta)

## Pruebas Manuales

### Caso de Prueba 1: "Sin Período Específico" - Creación Exitosa

**Pasos**:
1. Navegar a `/planificacion/wizard`
2. **Paso 0**:
   - Seleccionar grupo (ej: "Grupo 3A")
   - Seleccionar materia (ej: "Historia")
   - Seleccionar "Sin Período Específico"
   - Ingresar **Cantidad de Sesiones**: `3`
   - Ingresar **Duración por Sesión**: `80`
   - Hacer clic en "Siguiente" (salta al paso 2)
3. **Paso 2**:
   - Crear al menos 1 unidad didáctica
   - Asignar competencias y contenidos
   - Hacer clic en "Siguiente"
4. **Paso 3** (Confirmación):
   - Revisar resumen
   - Hacer clic en "Crear Planificación"

**Resultado Esperado**:
- ✅ (DEV) Log en consola: `[PlanificacionWizard] handleFinish called` con objeto mostrando `tipo_planificacion: 'sin_periodo'`, `hasHorario: false`, etc.
- ✅ No se muestra toast de error
- ✅ Se crea la planificación exitosamente
- ✅ Se crean 3 sesiones en backlog con:
  - `fecha = null`
  - `estado = 'backlog'`
  - `orden = 1, 2, 3`
  - `duracion_minutos = 80`
- ✅ Se navega automáticamente a `/planificacion/{id}` (workspace)

### Caso de Prueba 2: "Sin Período Específico" - Falta `cantidad_sesiones`

**Pasos**:
1. Navegar a `/planificacion/wizard`
2. **Paso 0**:
   - Seleccionar grupo y materia
   - Seleccionar "Sin Período Específico"
   - **NO ingresar** cantidad de sesiones (o ingresar 0)
   - Ingresar Duración por Sesión: `80`
   - Hacer clic en "Siguiente" (debe bloquear, pero si se fuerza avanzar)
3. Llegar al paso 3 sin `cantidad_sesiones` válido
4. Hacer clic en "Crear Planificación"

**Resultado Esperado**:
- ✅ Toast destructivo: "Error — Debes especificar una cantidad de sesiones mayor a 0"
- ✅ NO se crea la planificación
- ✅ NO navega

### Caso de Prueba 3: "Sin Período Específico" - Falta `duracion_por_sesion`

**Pasos**:
1. Similar al Caso 2, pero sin ingresar duración por sesión (o ingresar 0)
2. Hacer clic en "Crear Planificación" en paso 3

**Resultado Esperado**:
- ✅ Toast destructivo: "Error — Debes especificar una duración por sesión mayor a 0 minutos"
- ✅ NO se crea la planificación
- ✅ NO navega

### Caso de Prueba 4: "Período Específico" - Falta `horario`

**Pasos**:
1. Navegar a `/planificacion/wizard`
2. **Paso 0**:
   - Seleccionar grupo y materia
   - Seleccionar "Período Específico"
   - Completar fechas
   - Hacer clic en "Siguiente"
3. **Paso 1**:
   - **NO completar** horario (dejar vacío)
   - Intentar avanzar (debería bloquear, pero si se fuerza)
4. Llegar al paso 3 sin `horario`
5. Hacer clic en "Crear Planificación"

**Resultado Esperado**:
- ✅ Toast destructivo: "Error — Faltan datos requeridos para crear la planificación (horario no configurado)"
- ✅ NO se crea la planificación
- ✅ NO navega

### Caso de Prueba 5: "Período Específico" - Flujo Completo Exitoso

**Pasos**:
1. Navegar a `/planificacion/wizard`
2. Completar todos los pasos (0, 1, 2) correctamente
3. Llegar al paso 3
4. Hacer clic en "Crear Planificación"

**Resultado Esperado**:
- ✅ (DEV) Log en consola mostrando `tipo_planificacion: 'periodo_especifico'`, `hasHorario: true`
- ✅ Se crea la planificación exitosamente
- ✅ Se crean sesiones en calendario (con fechas)
- ✅ Se navega al workspace
- ✅ Comportamiento sin cambios respecto a la versión anterior

### Caso de Prueba 6: Verificación de Logging DEV

**Pasos**:
1. Abrir DevTools → Console
2. Ejecutar Caso de Prueba 1 o 5
3. Hacer clic en "Crear Planificación"

**Resultado Esperado (DEV mode)**:
- ✅ Console muestra: `[PlanificacionWizard] handleFinish called` con objeto:
  ```javascript
  {
    tipo_planificacion: 'sin_periodo' | 'periodo_especifico',
    hasContexto: true/false,
    hasHorario: true/false,
    hasEnfoque: true/false
  }
  ```

**Resultado Esperado (PROD mode)**:
- ✅ No se muestra log en console (solo se ejecuta en DEV)

## Consideraciones Técnicas

### Preservación de Funcionalidad

- ✅ **Flujo "Período Específico"**: Comportamiento sin cambios, mantiene validación estricta de `horario`
- ✅ **Inserción de planificación**: Los campos `horas_semanales` y `configuracion_horario` se insertan como `null` para "sin_periodo", lo cual es válido en el esquema de BD
- ✅ **Creación de sesiones backlog**: Se mantiene la lógica existente (ya estaba correcta)

### Compatibilidad

- ✅ **Backward compatible**: No afecta planificaciones existentes
- ✅ **Sin cambios en BD**: No requiere migraciones (los campos ya aceptan `null`)
- ✅ **Sin cambios en APIs**: No afecta contratos de datos

### Mejoras de UX

- ✅ **Mensajes de error específicos**: Los usuarios ven exactamente qué campo falta
- ✅ **Validación temprana**: Se valida antes de intentar crear, ahorrando requests innecesarios
- ✅ **Debugging mejorado**: Los desarrolladores tienen logs claros en DEV mode

## Conclusión

Este fix resuelve el problema de validación excesivamente estricta que impedía crear planificaciones "Sin Período Específico" después de arreglar la validación del paso 3 del wizard.

**Cambios mínimos y focalizados**:
- 1 archivo modificado (`PlanificacionWizard.tsx`)
- Validación condicional simple basada en `tipo_planificacion`
- Mensajes de error específicos y accionables
- Logging DEV agregado para debugging

El fix garantiza que:
1. ✅ Las planificaciones "Sin Período Específico" se pueden crear exitosamente cuando los campos requeridos están presentes
2. ✅ Las planificaciones "Período Específico" mantienen su comportamiento original (validación estricta)
3. ✅ Los usuarios reciben mensajes de error claros y específicos cuando faltan campos
4. ✅ Las sesiones backlog se crean correctamente con los campos esperados (`fecha=null`, `estado='backlog'`, `orden`, `duracion_minutos`)
5. ✅ La navegación al workspace funciona correctamente después de la creación exitosa















