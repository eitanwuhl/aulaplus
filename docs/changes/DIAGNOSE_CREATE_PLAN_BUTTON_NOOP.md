# Diagnóstico: Botón "Crear Planificación" No Responde

**Fecha**: 2025-01-XX  
**Tipo**: Diagnóstico  
**Problema**: Click en "Crear Planificación" no produce ningún comportamiento observable (sin logs, sin toasts, sin navegación, sin requests)

## Resumen Ejecutivo

**Causa Raíz Principal**: La validación del paso 3 (Confirmación) ejecuta recursivamente la validación de todos los pasos anteriores (0, 1, 2), pero cuando el tipo de planificación es "Sin Período Específico", el paso 1 (Horario) se salta y sus campos nunca se completan. Esto hace que `validation.valid === false`, y el handler `handleFinish` en `WizardSteps.tsx` retorna temprano sin ningún feedback visual o log.

**Evidencia**: 
- El botón está correctamente conectado al handler
- El handler se ejecuta, pero retorna inmediatamente porque `validation.valid === false`
- No hay logs porque el return temprano ocurre antes de cualquier logging
- No hay toasts porque el return temprano ocurre antes de llamar a `onFinish()` (que es donde está el manejo de errores)

## Análisis Detallado

### 1. Botón "Crear Planificación" - Ubicación y Conexión

**Archivo**: `src/components/planificacion/WizardSteps.tsx`

**Ubicación del botón**: Líneas 1054-1060

```typescript
{wizardData.paso < 3 ? (
  <Button onClick={handleNext} disabled={isLoading}>
    Siguiente
  </Button>
) : (
  <Button
    onClick={handleFinish}  // ✅ Handler conectado correctamente
    disabled={isLoading}     // ⚠️ Solo verifica isLoading
  >
    {isLoading ? 'Creando...' : 'Crear Planificación'}
  </Button>
)}
```

**Conclusión**: ✅ El botón está correctamente conectado al handler `handleFinish` (línea 1056). La condición `wizardData.paso < 3` es correcta (muestra el botón cuando `paso === 3`).

### 2. Handler `handleFinish` - Validación Silenciosa

**Archivo**: `src/components/planificacion/WizardSteps.tsx`

**Ubicación**: Líneas 142-158

```typescript
const handleFinish = useCallback(() => {
  const currentPaso = wizardData.paso;
  
  // Marcar que se intentó enviar
  setSubmitAttempted(prev => ({ ...prev, [currentPaso]: true }));

  if (!validation.valid) {  // ⚠️ AQUÍ ESTÁ EL PROBLEMA
    // Focus primer campo inválido (puede estar en pasos anteriores)
    focusFirstInvalidField(validation);
    
    // No crear planificación
    return;  // ❌ RETURN TEMPRANO SIN LOGS NI TOASTS
  }

  // Validación exitosa: crear planificación
  onFinish();  // ✅ Esta línea nunca se alcanza si validation.valid === false
}, [wizardData.paso, validation, focusFirstInvalidField, onFinish]);
```

**Problema identificado**: 
- Si `validation.valid === false`, el handler retorna inmediatamente sin ningún log, toast o feedback visual
- El `focusFirstInvalidField(validation)` intenta hacer focus en un campo, pero si el campo está en un paso anterior que no está visible (paso 1 cuando se saltó), no hay efecto visible
- No hay logging antes del return temprano

### 3. Validación del Paso 3 - Validación Recursiva Problemática

**Archivo**: `src/hooks/usePlanificacionWizard.ts`

**Ubicación**: Líneas 258-266

```typescript
case 3: {
  // Validación final: recursiva de todos los pasos
  const paso0 = validarPaso(0);
  const paso1 = validarPaso(1);  // ⚠️ SIEMPRE SE EJECUTA
  const paso2 = validarPaso(2);

  errors.push(...paso0.errors, ...paso1.errors, ...paso2.errors);
  firstInvalidField = paso0.firstInvalidField || paso1.firstInvalidField || paso2.firstInvalidField;
  break;
}
```

**Problema identificado**: 
- El paso 3 siempre valida recursivamente los pasos 0, 1 y 2
- **NO HAY EXCEPCIÓN** para cuando `tipo_planificacion === 'sin_periodo'` y el paso 1 se saltó

### 4. Validación del Paso 1 - Requiere Horario Siempre

**Archivo**: `src/hooks/usePlanificacionWizard.ts`

**Ubicación**: Líneas 140-216

```typescript
case 1: {
  // Validar horas_semanales
  const horasSemanales = wizardData.horario?.horas_semanales;
  if (!horasSemanales || horasSemanales <= 0) {
    errors.push({
      fieldId: 'horas_semanales',
      message: 'Horas semanales es obligatorio',  // ❌ ERROR SIEMPRE SE AGREGA SI NO HAY HORARIO
      type: 'required'
    });
    // ...
  }

  // Validar configuracion
  const configuracion = wizardData.horario?.configuracion || [];
  if (configuracion.length === 0) {
    errors.push({
      fieldId: 'configuracion',
      message: 'Debes configurar al menos un horario',  // ❌ ERROR SIEMPRE SE AGREGA SI NO HAY CONFIGURACIÓN
      type: 'required'
    });
    // ...
  }
  // ...
}
```

**Problema identificado**: 
- La validación del paso 1 **siempre** requiere `horas_semanales` y `configuracion`
- **NO HAY CONDICIÓN** que omita esta validación cuando `tipo_planificacion === 'sin_periodo'`
- Cuando el usuario selecciona "Sin Período Específico", el wizard salta del paso 0 al paso 2, pero `wizardData.horario` nunca se inicializa, por lo que `horas_semanales` y `configuracion` están vacíos

### 5. Flujo del Wizard - Salto del Paso 1

**Archivo**: `src/pages/PlanificacionWizard.tsx`

**Ubicación**: Líneas 585-594

```typescript
const handleNext = () => {
  const validacion = validarPaso(wizardData.paso);
  if (validacion.valid) {
    // Si estamos en el paso 0 y el tipo es "sin_periodo", saltar al paso 2
    if (wizardData.paso === 0 && wizardData.tipo_planificacion === 'sin_periodo') {
      updatePaso(2);  // ✅ Salta del 0 al 2, omite el paso 1
    } else {
      updatePaso((wizardData.paso + 1) as any);
    }
  }
};
```

**Comportamiento**: 
- Cuando `tipo_planificacion === 'sin_periodo'` y el usuario está en el paso 0, al hacer clic en "Siguiente", el wizard salta directamente al paso 2
- El paso 1 nunca se muestra ni se completa
- `wizardData.horario` nunca se inicializa (queda `undefined` o vacío)

### 6. Estado Disabled del Botón

**Archivo**: `src/components/planificacion/WizardSteps.tsx`

**Ubicación**: Línea 1057

```typescript
<Button
  onClick={handleFinish}
  disabled={isLoading}  // ✅ Solo verifica isLoading
>
```

**Archivo**: `src/pages/PlanificacionWizard.tsx`

**Ubicación**: Línea 1084

```typescript
<WizardSteps
  // ...
  isLoading={isLoading || isGenerating || isCreating}  // ✅ Se pasa correctamente
  // ...
/>
```

**Conclusión**: 
- El botón solo se deshabilita si `isLoading || isGenerating || isCreating` es `true`
- En el estado inicial, estos valores son `false`, por lo que el botón **NO está deshabilitado**
- El problema no es que el botón esté deshabilitado

### 7. Verificación de Overlays o Interceptores de Clicks

**Archivo**: `src/pages/PlanificacionWizard.tsx`

**Ubicación**: Líneas 927-1051

```typescript
// Mostrar pantalla de carga cuando se están generando los planes
if (isGeneratingPlans || generationError) {
  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <Card className="text-center p-12">
        {/* Pantalla de carga/generación */}
      </Card>
    </div>
  );
}

return (
  <div className="max-w-6xl mx-auto py-8 px-4">
    {/* ... */}
    <WizardSteps ... />
    {/* ... */}
  </div>
);
```

**Conclusión**: 
- No hay overlays o modales que intercepten clicks cuando `isGeneratingPlans === false` y `generationError === null`
- El botón está renderizado normalmente y debería ser clickeable

## Conclusión: Causa Raíz

### Causa Principal: Validación Recursiva Incompatible con Salto de Paso

**Problema**:
1. Cuando `tipo_planificacion === 'sin_periodo'`, el wizard salta del paso 0 al paso 2 (omite el paso 1)
2. El paso 1 nunca se completa, por lo que `wizardData.horario` está `undefined` o vacío
3. Cuando el usuario llega al paso 3 (Confirmación) y hace clic en "Crear Planificación":
   - Se ejecuta `handleFinish` en `WizardSteps.tsx`
   - Se evalúa `validation.valid`, que es el resultado de `validarPaso(3)`
   - `validarPaso(3)` valida recursivamente los pasos 0, 1 y 2
   - `validarPaso(1)` falla porque requiere `horas_semanales` y `configuracion`, que no existen
   - Por lo tanto, `validation.valid === false`
   - El handler retorna temprano (línea 153) **sin logs ni toasts**

### Causas Secundarias Contribuyentes

1. **Falta de feedback visual**: El `handleFinish` no muestra ningún toast o log cuando la validación falla, solo intenta hacer focus en un campo que puede no estar visible

2. **Validación no condicional**: La validación del paso 1 no considera el caso donde `tipo_planificacion === 'sin_periodo'` y el paso se saltó

3. **Return silencioso**: El return temprano no tiene ningún efecto visible para el usuario (no hay mensaje de error, no hay toast, no hay log en consola)

## Evidencia del Flujo

### Flujo Actual (Cuando Falla):

```
Usuario en paso 3 → Click "Crear Planificación"
  ↓
handleFinish() ejecutado (WizardSteps.tsx:142)
  ↓
validation.valid evaluado
  ↓
validarPaso(3) ejecutado (usePlanificacionWizard.ts:258)
  ↓
  ├─ validarPaso(0) → ✅ pasa (campos completos)
  ├─ validarPaso(1) → ❌ falla (horas_semanales y configuracion faltantes)
  └─ validarPaso(2) → ✅ pasa (unidades completas)
  ↓
validation.valid === false (porque paso1.errors.length > 0)
  ↓
if (!validation.valid) { return; } (WizardSteps.tsx:148)
  ↓
❌ NO SE EJECUTA onFinish()
❌ NO HAY LOGS
❌ NO HAY TOASTS
❌ NO HAY NAVEGACIÓN
```

### Código de Referencia Exacto

1. **Botón renderizado**: `src/components/planificacion/WizardSteps.tsx:1054-1060`
2. **Handler definido**: `src/components/planificacion/WizardSteps.tsx:142-158`
3. **Validación paso 3**: `src/hooks/usePlanificacionWizard.ts:258-266`
4. **Validación paso 1**: `src/hooks/usePlanificacionWizard.ts:140-216`
5. **Salto del paso**: `src/pages/PlanificacionWizard.tsx:585-594`

## Plan de Fix Propuesto

### Fix 1: Hacer la Validación del Paso 1 Condicional (PRIMARIO)

**Ubicación**: `src/hooks/usePlanificacionWizard.ts` - función `validarPaso`, caso `case 1:`

**Cambio**: Agregar condición para omitir validación del paso 1 cuando `tipo_planificacion === 'sin_periodo'`

```typescript
case 1: {
  // Si es "sin_periodo", el paso 1 se salta, no validar
  if (wizardData.tipo_planificacion === 'sin_periodo') {
    break; // No validar horario para planificaciones sin período
  }
  
  // Resto de la validación del paso 1...
}
```

### Fix 2: Agregar Feedback Visual cuando la Validación Falla (SECUNDARIO)

**Ubicación**: `src/components/planificacion/WizardSteps.tsx` - función `handleFinish`

**Cambio**: Agregar toast o log cuando `validation.valid === false`

```typescript
if (!validation.valid) {
  // Log para debugging
  if (import.meta.env.DEV) {
    console.warn('[WizardSteps] Validación falló:', validation.errors);
  }
  
  // Opcional: Mostrar toast con resumen de errores
  // (Requiere acceso a useToast hook)
  
  // Focus primer campo inválido
  focusFirstInvalidField(validation);
  
  return;
}
```

### Fix 3: Validación Condicional en Paso 3 (ALTERNATIVA)

**Ubicación**: `src/hooks/usePlanificacionWizard.ts` - función `validarPaso`, caso `case 3:`

**Cambio**: No validar el paso 1 si `tipo_planificacion === 'sin_periodo'`

```typescript
case 3: {
  // Validación recursiva condicional
  const paso0 = validarPaso(0);
  const paso1 = wizardData.tipo_planificacion === 'sin_periodo' 
    ? { valid: true, errors: [], firstInvalidField: undefined }
    : validarPaso(1);
  const paso2 = validarPaso(2);

  errors.push(...paso0.errors, ...paso1.errors, ...paso2.errors);
  firstInvalidField = paso0.firstInvalidField || paso1.firstInvalidField || paso2.firstInvalidField;
  break;
}
```

## Recomendación

**Implementar Fix 1 y Fix 2**:
- Fix 1 resuelve la causa raíz (validación incompatible con salto de paso)
- Fix 2 mejora la experiencia de usuario y debugging (feedback cuando falla validación)

Fix 3 es una alternativa, pero Fix 1 es más limpio porque mantiene la lógica de validación dentro de cada caso.














