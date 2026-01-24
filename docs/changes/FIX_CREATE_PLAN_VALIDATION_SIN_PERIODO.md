# Fix: Validación del Paso 3 para Planificaciones "Sin Período Específico"

**Fecha**: 2025-01-XX  
**Tipo**: Bugfix  
**Alcance**: Corrección de validación recursiva que impedía crear planificaciones en modo "Sin Período Específico"

## Resumen de Causa Raíz

El botón "Crear Planificación" en el paso 3 (Confirmación) no respondía cuando el tipo de planificación era "Sin Período Específico" porque:

1. **Validación recursiva incompatible**: El paso 3 siempre validaba recursivamente los pasos 0, 1 y 2.
2. **Paso 1 se salta en "sin_periodo"**: Cuando `tipo_planificacion === 'sin_periodo'`, el wizard salta del paso 0 al paso 2 (omite el paso 1), por lo que los campos del paso 1 (`horas_semanales`, `configuracion`) nunca se completan.
3. **Validación falla silenciosamente**: `validarPaso(1)` siempre requiere estos campos, causando que `validation.valid === false`, y el handler retornaba temprano sin ningún feedback visual.

**Diagnóstico completo**: Ver `docs/changes/DIAGNOSE_CREATE_PLAN_BUTTON_NOOP.md`

## Archivos Modificados

### 1. `src/hooks/usePlanificacionWizard.ts`

**Cambio**: Validación condicional del paso 1 en el caso 3

**Líneas afectadas**: 258-266

**Antes**:
```typescript
case 3: {
  // Validación final: recursiva de todos los pasos
  const paso0 = validarPaso(0);
  const paso1 = validarPaso(1);  // ❌ Siempre validaba, incluso si se saltó
  const paso2 = validarPaso(2);

  errors.push(...paso0.errors, ...paso1.errors, ...paso2.errors);
  firstInvalidField = paso0.firstInvalidField || paso1.firstInvalidField || paso2.firstInvalidField;
  break;
}
```

**Después**:
```typescript
case 3: {
  // Validación final: recursiva de todos los pasos
  const paso0 = validarPaso(0);
  // Validar paso 1 solo si NO es "sin_periodo" (en ese flujo se salta el paso 1)
  const paso1 = wizardData.tipo_planificacion === 'sin_periodo'
    ? { valid: true, errors: [] as FieldError[], firstInvalidField: undefined }
    : validarPaso(1);
  const paso2 = validarPaso(2);

  errors.push(...paso0.errors, ...paso1.errors, ...paso2.errors);
  firstInvalidField = paso0.firstInvalidField || paso1.firstInvalidField || paso2.firstInvalidField;
  break;
}
```

**Razón**: Cuando `tipo_planificacion === 'sin_periodo'`, el paso 1 se omite intencionalmente, por lo que no debe validarse. Se retorna un resultado de validación vacío (sin errores) para ese paso.

### 2. `src/components/planificacion/WizardSteps.tsx`

**Cambios**:
1. Agregado import de `useToast`
2. Agregado hook `useToast` en el componente
3. Mejorado `handleFinish` para mostrar feedback cuando la validación falla

**Líneas afectadas**: 
- Import: línea 22 (agregado)
- Hook: línea 48 (agregado)
- Función `handleFinish`: 142-158 (modificado)

**Antes**:
```typescript
const handleFinish = useCallback(() => {
  const currentPaso = wizardData.paso;
  
  setSubmitAttempted(prev => ({ ...prev, [currentPaso]: true }));

  if (!validation.valid) {
    // Focus primer campo inválido (puede estar en pasos anteriores)
    focusFirstInvalidField(validation);
    
    // No crear planificación
    return;  // ❌ Sin feedback visual
  }

  onFinish();
}, [wizardData.paso, validation, focusFirstInvalidField, onFinish]);
```

**Después**:
```typescript
const handleFinish = useCallback(() => {
  const currentPaso = wizardData.paso;
  
  setSubmitAttempted(prev => ({ ...prev, [currentPaso]: true }));

  if (!validation.valid) {
    // DEV: Log validation failure for debugging
    if (import.meta.env.DEV) {
      console.warn('[WizardSteps] Final validation failed', {
        errors: validation.errors,
        firstInvalidField: validation.firstInvalidField,
        tipo_planificacion: wizardData.tipo_planificacion
      });
    }
    
    // Show user-visible feedback
    toast({
      title: "Campos obligatorios incompletos",
      description: "Hay campos obligatorios sin completar. Revisá los pasos anteriores.",
      variant: "destructive",
      duration: 5000
    });
    
    // Focus primer campo inválido (puede estar en pasos anteriores)
    focusFirstInvalidField(validation);
    
    // No crear planificación
    return;
  }

  onFinish();
}, [wizardData.paso, wizardData.tipo_planificacion, validation, focusFirstInvalidField, onFinish, toast]);
```

**Razón**: 
- Agrega feedback visual claro para el usuario cuando la validación falla (toast destructivo)
- Agrega logging en DEV mode para facilitar debugging
- Mantiene el comportamiento de focus en el primer campo inválido

## Comportamiento Antes y Después

### Antes

**Flujo "Sin Período Específico"**:
1. Usuario completa paso 0 (selecciona "Sin Período Específico", cantidad de sesiones, duración)
2. Wizard salta al paso 2 (omite paso 1)
3. Usuario completa paso 2 (unidades didácticas)
4. Usuario llega al paso 3 y hace clic en "Crear Planificación"
5. **Resultado**: ❌ No pasa nada (sin logs, sin toasts, sin navegación)

**Razón**: La validación del paso 3 fallaba porque `validarPaso(1)` requería campos del paso 1 que nunca se completaron, y el handler retornaba temprano sin feedback.

**Flujo "Período Específico"**:
1. Usuario completa pasos 0, 1, 2
2. Usuario llega al paso 3 y hace clic en "Crear Planificación"
3. Si la validación falla (campos faltantes en pasos anteriores):
   - **Resultado**: ❌ No pasa nada (sin feedback visual)

### Después

**Flujo "Sin Período Específico"**:
1. Usuario completa paso 0 (selecciona "Sin Período Específico", cantidad de sesiones, duración)
2. Wizard salta al paso 2 (omite paso 1)
3. Usuario completa paso 2 (unidades didácticas)
4. Usuario llega al paso 3 y hace clic en "Crear Planificación"
5. **Resultado**: ✅ La validación pasa (paso 1 se omite), se ejecuta `onFinish()`, se crea la planificación y se navega al workspace

**Flujo "Período Específico"**:
1. Usuario completa pasos 0, 1, 2
2. Usuario llega al paso 3 y hace clic en "Crear Planificación"
3. Si la validación falla (campos faltantes):
   - **Resultado**: ✅ Toast destructivo visible: "Campos obligatorios incompletos. Hay campos obligatorios sin completar. Revisá los pasos anteriores."
   - **DEV**: Log en consola con detalles de errores
   - Focus automático en el primer campo inválido

## Pruebas Manuales

### Caso de Prueba 1: "Sin Período Específico" - Flujo Completo Exitoso

**Pasos**:
1. Navegar a `/planificacion/wizard`
2. **Paso 0**:
   - Seleccionar grupo (ej: "Grupo 3A")
   - Seleccionar materia (ej: "Historia")
   - Seleccionar "Sin Período Específico"
   - Ingresar Cantidad de Sesiones: `3`
   - Ingresar Duración por Sesión: `80`
   - Hacer clic en "Siguiente"
3. **Paso 2** (se salta paso 1):
   - Crear al menos 1 unidad didáctica
   - Asignar competencias y contenidos
   - Hacer clic en "Siguiente"
4. **Paso 3** (Confirmación):
   - Revisar resumen
   - Hacer clic en "Crear Planificación"

**Resultado Esperado**:
- ✅ No se muestra toast de error
- ✅ Se crea la planificación exitosamente
- ✅ Se crean 3 sesiones en backlog (fecha=null, estado='backlog', duracion_minutos=80)
- ✅ Se navega automáticamente a `/planificacion/{id}` (workspace)

### Caso de Prueba 2: "Sin Período Específico" - Validación Fallida en Paso 0

**Pasos**:
1. Navegar a `/planificacion/wizard`
2. **Paso 0**:
   - Seleccionar grupo
   - Seleccionar materia
   - Seleccionar "Sin Período Específico"
   - **NO ingresar** cantidad de sesiones o duración
   - Hacer clic en "Siguiente" (debería bloquear, pero si se fuerza avanzar)
3. Llegar al paso 3 sin completar campos obligatorios
4. Hacer clic en "Crear Planificación"

**Resultado Esperado**:
- ✅ Toast destructivo visible: "Campos obligatorios incompletos..."
- ✅ (DEV) Log en consola: `[WizardSteps] Final validation failed` con detalles
- ✅ Focus automático en el primer campo inválido (en paso 0)
- ✅ NO se crea la planificación
- ✅ NO navega

### Caso de Prueba 3: "Período Específico" - Validación Normal (Sin Cambios)

**Pasos**:
1. Navegar a `/planificacion/wizard`
2. **Paso 0**:
   - Seleccionar grupo y materia
   - Seleccionar "Período Específico"
   - Ingresar fechas de inicio y fin
   - Hacer clic en "Siguiente"
3. **Paso 1**:
   - Completar horario (horas semanales y configuración)
   - Hacer clic en "Siguiente"
4. **Paso 2**:
   - Crear unidades didácticas
   - Hacer clic en "Siguiente"
5. **Paso 3**:
   - Hacer clic en "Crear Planificación"

**Resultado Esperado**:
- ✅ Se crea la planificación exitosamente (comportamiento sin cambios)
- ✅ Navega al workspace

### Caso de Prueba 4: "Período Específico" - Validación Fallida (Paso 1 Incompleto)

**Pasos**:
1. Navegar a `/planificacion/wizard`
2. **Paso 0**:
   - Seleccionar grupo, materia, "Período Específico"
   - Completar fechas
   - Hacer clic en "Siguiente"
3. **Paso 1**:
   - **NO completar** horario (dejar vacío)
   - Hacer clic en "Siguiente" (debería bloquear, pero si se fuerza avanzar)
4. Llegar al paso 3 sin completar paso 1
5. Hacer clic en "Crear Planificación"

**Resultado Esperado**:
- ✅ Toast destructivo visible: "Campos obligatorios incompletos..."
- ✅ (DEV) Log en consola con detalles de errores del paso 1
- ✅ Focus automático en primer campo inválido del paso 1
- ✅ NO se crea la planificación
- ✅ NO navega

### Caso de Prueba 5: Verificación de Logging DEV

**Pasos**:
1. Abrir DevTools → Console
2. Ejecutar cualquier caso que resulte en validación fallida (Caso 2 o 4)
3. Hacer clic en "Crear Planificación"

**Resultado Esperado (DEV mode)**:
- ✅ Console muestra: `[WizardSteps] Final validation failed` con objeto que contiene:
  - `errors`: Array de errores con `fieldId` y `message`
  - `firstInvalidField`: ID del primer campo inválido
  - `tipo_planificacion`: 'sin_periodo' o 'periodo_especifico'

**Resultado Esperado (PROD mode)**:
- ✅ No se muestra log en console (solo toast)

## Consideraciones Técnicas

### Compatibilidad

- ✅ **Backward compatible**: No cambia el comportamiento de "Período Específico"
- ✅ **Sin cambios en BD**: No requiere migraciones
- ✅ **Sin cambios en APIs**: No afecta contratos de datos

### Preservación de Funcionalidad

- ✅ **Validación del paso 0**: Sin cambios (siempre se valida)
- ✅ **Validación del paso 1**: Sin cambios cuando `tipo_planificacion === 'periodo_especifico'`
- ✅ **Validación del paso 2**: Sin cambios (siempre se valida)
- ✅ **Focus automático**: Se mantiene cuando la validación falla
- ✅ **Agregación de errores**: La lógica de `errors` y `firstInvalidField` funciona correctamente

### Mejoras de UX

- ✅ **Feedback visible**: Los usuarios ahora ven claramente cuando hay errores de validación
- ✅ **Debugging mejorado**: Los desarrolladores tienen logs claros en DEV mode
- ✅ **Mensaje accionable**: El toast indica que deben revisar los pasos anteriores

## Conclusión

Este fix resuelve el problema principal de validación para planificaciones "Sin Período Específico" y mejora la experiencia de usuario en ambos flujos (con y sin período) al agregar feedback visual cuando la validación falla.

**Cambios mínimos y focalizados**:
- 2 archivos modificados
- Validación condicional simple
- Feedback visual agregado
- Sin cambios breaking

El fix garantiza que:
1. ✅ Las planificaciones "Sin Período Específico" se pueden crear exitosamente
2. ✅ Las planificaciones "Período Específico" mantienen su comportamiento original
3. ✅ Los usuarios reciben feedback claro cuando hay errores de validación
4. ✅ Los desarrolladores tienen logs útiles para debugging









