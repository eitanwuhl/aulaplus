# Block B: Save Flow Reliability UX Implementation

## Resumen

Implementación de mejoras en el flujo de guardado para aumentar la confiabilidad y la experiencia del usuario al guardar evaluaciones y planificaciones. Se agregó validación pre-guardado, prevención de doble envío, estados de guardado claros y mensajes de error más accionables.

## Archivos Modificados

1. `src/pages/EvaluacionesGrupo.tsx`
2. `src/pages/PlanificacionWorkspace.tsx`

## Cambios Realizados

### EvaluacionesGrupo.tsx

#### Cambio 1: Validación Pre-Guardado Completa
**Ubicación**: Línea ~348 (función `handleSaveEvaluation`)

**Antes:**
```typescript
const handleSaveEvaluation = async () => {
  if (!nombreEvaluacion.trim()) {
    toast({ /* ... */ });
    return;
  }
  if (generatedEvaluations.length === 0) {
    toast({ /* ... */ });
    return;
  }
  setIsSaving(true);
  // ...
```

**Después:**
```typescript
const handleSaveEvaluation = async () => {
  // Pre-save validation (client-side)
  if (!selectedGroupId) {
    toast({
      title: "Error",
      description: "Seleccioná un grupo",
      variant: "destructive"
    });
    return;
  }

  if (!esInterdisciplinaria && !materia) {
    toast({
      title: "Error",
      description: "Seleccioná una materia",
      variant: "destructive"
    });
    return;
  }

  if (esInterdisciplinaria && materiasSeleccionadas.length === 0) {
    toast({
      title: "Error",
      description: "Seleccioná una materia",
      variant: "destructive"
    });
    return;
  }

  if (selectedCompetenciasIds.length === 0) {
    toast({
      title: "Error",
      description: "Seleccioná al menos una competencia",
      variant: "destructive"
    });
    return;
  }

  if (!nombreEvaluacion.trim()) {
    toast({
      title: "Error",
      description: "Ingresá un nombre",
      variant: "destructive"
    });
    return;
  }

  if (generatedEvaluations.length === 0) {
    toast({ /* ... */ });
    return;
  }

  // Prevent double-submit
  if (isSaving) {
    return;
  }

  setIsSaving(true);
  // ...
```

**Razón**: Validación client-side antes de iniciar el guardado evita llamadas innecesarias al servidor y proporciona feedback inmediato al usuario.

#### Cambio 2: Prevención de Double-Submit
**Ubicación**: Línea ~405

**Antes:**
```typescript
setIsSaving(true);
```

**Después:**
```typescript
// Prevent double-submit
if (isSaving) {
  return;
}

setIsSaving(true);
```

**Razón**: Previene múltiples clicks en el botón "Guardar" mientras se está procesando el guardado.

#### Cambio 3: Mejora de Mensajes de Error
**Ubicación**: Línea ~471 (catch block)

**Antes:**
```typescript
} catch (error: any) {
  console.error('[SAVE EVALUATION] Error guardando evaluación:', error);
  
  let errorMessage = "No se pudo guardar la evaluación.";
  
  if (error?.message) {
    if (error.message.includes('permission denied') || error.message.includes('policy')) {
      errorMessage = "Error de permisos. Verifica que la migración RLS se haya aplicado correctamente.";
    } else if (error.message.includes('null value') || error.message.includes('violates not-null')) {
      errorMessage = "Faltan datos requeridos. Asegúrate de completar todos los campos.";
    } else if (error.message.includes('relation') || error.message.includes('does not exist')) {
      errorMessage = "La tabla 'evaluaciones' no existe. Aplica las migraciones de base de datos.";
    } else {
      errorMessage = `Error: ${error.message}`;
    }
  }
  
  toast({
    title: "Error al guardar",
    description: errorMessage,
    variant: "destructive"
  });
}
```

**Después:**
```typescript
} catch (error: any) {
  // Detailed error logging in DEV
  if (import.meta.env.DEV) {
    console.error('[SAVE EVALUATION] Error guardando evaluación:', {
      error,
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint
    });
  }
  
  // User-friendly error message (avoid technical codes)
  let errorMessage = "No se pudo guardar la evaluación. Por favor, intentá nuevamente.";
  
  if (error?.message) {
    if (error.message.includes('permission denied') || error.message.includes('policy')) {
      errorMessage = "No tenés permisos para guardar. Contactá al administrador.";
    } else if (error.message.includes('null value') || error.message.includes('violates not-null')) {
      errorMessage = "Faltan datos requeridos. Revisá que todos los campos estén completos.";
    } else if (error.message.includes('relation') || error.message.includes('does not exist')) {
      errorMessage = "Error de configuración. Contactá al administrador.";
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = "Error de conexión. Revisá tu conexión a internet e intentá nuevamente.";
    }
  }
  
  toast({
    title: "Error al guardar",
    description: errorMessage,
    variant: "destructive"
  });
}
```

**Razón**: 
- Los mensajes de error ahora evitan códigos técnicos y términos que el usuario final no entendería.
- Los mensajes son más accionables (ej: "Revisá tu conexión a internet e intentá nuevamente" en lugar de mostrar códigos SQL).
- El logging detallado solo ocurre en DEV para debugging, no en producción.

#### Estado de Guardado Existente
El código ya tenía implementado:
- Estado `isSaving` para rastrear cuando se está guardando
- Botón deshabilitado mientras `isSaving === true`
- Texto "Guardando..." con spinner cuando está guardando
- Botón "Cancelar" también deshabilitado durante el guardado

### PlanificacionWorkspace.tsx

#### Cambio 1: Validación Pre-Guardado
**Ubicación**: Línea ~328 (función `handleSavePlanificacion`)

**Antes:**
```typescript
const handleSavePlanificacion = async () => {
  if (!planificacion || !customNombre.trim()) return;

  setIsSaving(true);
```

**Después:**
```typescript
const handleSavePlanificacion = async () => {
  // Pre-save validation
  if (!planificacion) {
    toast({
      title: "Error",
      description: "No hay planificación para guardar",
      variant: "destructive"
    });
    return;
  }

  if (!customNombre.trim()) {
    toast({
      title: "Error",
      description: "Ingresá un nombre",
      variant: "destructive"
    });
    return;
  }

  // Prevent double-submit
  if (isSaving) {
    return;
  }

  setIsSaving(true);
```

**Razón**: 
- Validación explícita con mensajes de error claros en lugar de retorno silencioso.
- Prevención de double-submit añadida.

#### Cambio 2: Mejora de Mensajes de Error
**Ubicación**: Línea ~374 (catch block)

**Antes:**
```typescript
} catch (error) {
  console.error('Error saving planification:', error);
  toast({
    title: "Error",
    description: "No se pudo guardar la planificaci?n",
    variant: "destructive"
  });
}
```

**Después:**
```typescript
} catch (error: any) {
  // Detailed error logging in DEV
  if (import.meta.env.DEV) {
    console.error('[SAVE PLANIFICACION] Error guardando planificación:', {
      error,
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint
    });
  }

  // User-friendly error message (avoid technical codes)
  let errorMessage = "No se pudo guardar la planificación. Por favor, intentá nuevamente.";
  
  if (error?.message) {
    if (error.message.includes('permission denied') || error.message.includes('policy')) {
      errorMessage = "No tenés permisos para guardar. Contactá al administrador.";
    } else if (error.message.includes('null value') || error.message.includes('violates not-null')) {
      errorMessage = "Faltan datos requeridos. Revisá que todos los campos estén completos.";
    } else if (error.message.includes('relation') || error.message.includes('does not exist')) {
      errorMessage = "Error de configuración. Contactá al administrador.";
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = "Error de conexión. Revisá tu conexión a internet e intentá nuevamente.";
    }
  }
  
  toast({
    title: "Error al guardar",
    description: errorMessage,
    variant: "destructive"
  });
}
```

**Razón**: Mismo principio que en EvaluacionesGrupo: mensajes user-friendly y logging detallado solo en DEV.

#### Estado de Guardado Existente
El código ya tenía implementado:
- Estado `isSaving` para rastrear cuando se está guardando
- Botón deshabilitado mientras `isSaving === true` o `!customNombre.trim()`
- Texto "Guardando..." cuando está guardando
- Botón "Cancelar" también deshabilitado durante el guardado

## Reglas de Validación Agregadas

### EvaluacionesGrupo.tsx

1. **selectedGroupId**: Si está vacío o no está seleccionado → "Seleccioná un grupo"
2. **materia / materiasSeleccionadas**: 
   - Si no es interdisciplinaria y `materia` está vacío → "Seleccioná una materia"
   - Si es interdisciplinaria y `materiasSeleccionadas.length === 0` → "Seleccioná una materia"
3. **selectedCompetenciasIds**: Si `length === 0` → "Seleccioná al menos una competencia"
4. **nombreEvaluacion**: Si está vacío o solo espacios en blanco → "Ingresá un nombre"
5. **generatedEvaluations**: Si `length === 0` → "No hay evaluaciones generadas para guardar" (ya existía)

### PlanificacionWorkspace.tsx

1. **planificacion**: Si es `null` o `undefined` → "No hay planificación para guardar"
2. **customNombre**: Si está vacío o solo espacios en blanco → "Ingresá un nombre"

## Comportamiento Antes vs Después

### Antes

#### EvaluacionesGrupo
- ✅ Ya tenía estado "Guardando..." y prevención básica
- ❌ Solo validaba nombre y evaluaciones generadas
- ❌ No validaba grupo, materia, o competencias antes de guardar
- ❌ Mensajes de error incluían códigos técnicos (ej: "verifica que la migración RLS se haya aplicado")
- ❌ Podía intentar guardar múltiples veces si el usuario hacía click repetidamente

#### PlanificacionWorkspace
- ✅ Ya tenía estado "Guardando..." y prevención básica
- ⚠️ Validación básica pero con retorno silencioso (no mostraba toast)
- ❌ No prevenía double-submit explícitamente
- ❌ Mensajes de error genéricos sin contexto útil
- ❌ Logging de errores siempre activo (incluso en producción)

### Después

#### EvaluacionesGrupo
- ✅ Validación pre-guardado completa (grupo, materia, competencias, nombre)
- ✅ Prevención explícita de double-submit
- ✅ Mensajes de error user-friendly (sin códigos técnicos)
- ✅ Logging detallado solo en DEV
- ✅ Estado "Guardando..." con botones deshabilitados (ya existía, ahora más robusto)

#### PlanificacionWorkspace
- ✅ Validación pre-guardado con mensajes de error claros
- ✅ Prevención explícita de double-submit
- ✅ Mensajes de error user-friendly (sin códigos técnicos)
- ✅ Logging detallado solo en DEV
- ✅ Estado "Guardando..." con botones deshabilitados (ya existía, ahora más robusto)

## Flujo de Guardado Mejorado

### EvaluacionesGrupo

```
Usuario clickea "Guardar"
    ↓
[Validación Pre-Guardado]
    ├─ ¿selectedGroupId? → NO → Toast "Seleccioná un grupo" → STOP
    ├─ ¿materia/materiasSeleccionadas? → NO → Toast "Seleccioná una materia" → STOP
    ├─ ¿selectedCompetenciasIds.length > 0? → NO → Toast "Seleccioná al menos una competencia" → STOP
    ├─ ¿nombreEvaluacion.trim()? → NO → Toast "Ingresá un nombre" → STOP
    └─ ¿generatedEvaluations.length > 0? → NO → Toast "No hay evaluaciones..." → STOP
    ↓ (si todas las validaciones pasan)
[Prevención Double-Submit]
    ├─ ¿isSaving === true? → SÍ → return (ignore click) → STOP
    └─ NO → Continuar
    ↓
setIsSaving(true)
    ↓
Botón muestra "Guardando..." + spinner
Botones deshabilitados
    ↓
[Intentar guardar en Supabase]
    ├─ Éxito → Toast éxito + navegar a /mis-evaluaciones
    └─ Error → Toast error user-friendly + setIsSaving(false)
    ↓
finally: setIsSaving(false)
```

### PlanificacionWorkspace

```
Usuario clickea "Guardar sesión"
    ↓
[Validación Pre-Guardado]
    ├─ ¿planificacion existe? → NO → Toast "No hay planificación..." → STOP
    └─ ¿customNombre.trim()? → NO → Toast "Ingresá un nombre" → STOP
    ↓ (si todas las validaciones pasan)
[Prevención Double-Submit]
    ├─ ¿isSaving === true? → SÍ → return (ignore click) → STOP
    └─ NO → Continuar
    ↓
setIsSaving(true)
    ↓
Botón muestra "Guardando..."
Botones deshabilitados
    ↓
[Intentar actualizar en Supabase]
    ├─ Éxito → Toast éxito + actualizar estado local + cerrar diálogo
    └─ Error → Toast error user-friendly + setIsSaving(false)
    ↓
finally: setIsSaving(false)
```

## Checklist de Pruebas Manuales

### EvaluacionesGrupo.tsx

#### Happy Path
1. **Flujo completo exitoso**
   - Seleccionar grupo
   - Seleccionar materia
   - Seleccionar al menos una competencia
   - Generar evaluaciones
   - Click en "Guardar evaluación"
   - Ingresar nombre
   - Click en "Guardar"
   - **Resultado esperado**: 
     - Botón muestra "Guardando..." con spinner
     - Botones deshabilitados
     - Toast de éxito
     - Navegación a /mis-evaluaciones después de 1.5s

#### Validación Pre-Guardado (Failure Cases)

2. **Sin grupo seleccionado**
   - No seleccionar grupo (o deseleccionar si está seleccionado)
   - Generar evaluaciones
   - Intentar guardar
   - **Resultado esperado**: Toast "Seleccioná un grupo" (sin intentar guardar)

3. **Sin materia seleccionada (evaluación simple)**
   - Seleccionar grupo
   - No seleccionar materia
   - Generar evaluaciones
   - Intentar guardar
   - **Resultado esperado**: Toast "Seleccioná una materia"

4. **Sin materia seleccionada (evaluación interdisciplinaria)**
   - Seleccionar grupo
   - Cambiar a "Evaluación interdisciplinaria"
   - No seleccionar ninguna materia
   - Generar evaluaciones
   - Intentar guardar
   - **Resultado esperado**: Toast "Seleccioná una materia"

5. **Sin competencias seleccionadas**
   - Seleccionar grupo y materia
   - No seleccionar competencias
   - Generar evaluaciones
   - Intentar guardar
   - **Resultado esperado**: Toast "Seleccioná al menos una competencia"

6. **Sin nombre de evaluación**
   - Completar todos los campos requeridos
   - Generar evaluaciones
   - Click en "Guardar evaluación"
   - No ingresar nombre (o solo espacios)
   - Click en "Guardar"
   - **Resultado esperado**: Toast "Ingresá un nombre" (botón "Guardar" debería estar deshabilitado si el campo está vacío)

#### Double-Submit Prevention

7. **Múltiples clicks durante guardado**
   - Completar todos los campos
   - Click en "Guardar"
   - Inmediatamente hacer múltiples clicks en "Guardar"
   - **Resultado esperado**: 
     - Solo se procesa el primer click
     - El botón se deshabilita inmediatamente
     - No se hacen múltiples requests al servidor

#### Error Handling

8. **Error de conexión**
   - Desconectar internet
   - Intentar guardar
   - **Resultado esperado**: 
     - Toast "Error de conexión. Revisá tu conexión a internet e intentá nuevamente."
     - Botón se rehabilita después del error
     - No muestra códigos técnicos

9. **Error de permisos (simulado)**
   - Modificar temporalmente RLS o permisos en Supabase
   - Intentar guardar
   - **Resultado esperado**: 
     - Toast "No tenés permisos para guardar. Contactá al administrador."
     - Botón se rehabilita

10. **Error genérico**
    - Forzar cualquier otro error
    - **Resultado esperado**: 
      - Toast "No se pudo guardar la evaluación. Por favor, intentá nuevamente."
      - Logging detallado en consola (solo en DEV)

### PlanificacionWorkspace.tsx

#### Happy Path

11. **Flujo completo exitoso**
    - Abrir una planificación existente
    - Hacer cambios (si es necesario)
    - Click en "Guardar sesión"
    - Ingresar o confirmar nombre
    - Click en "Guardar"
    - **Resultado esperado**: 
      - Botón muestra "Guardando..."
      - Botones deshabilitados
      - Toast de éxito
      - Diálogo se cierra
      - Indicador "Guardada" aparece en el header

#### Validación Pre-Guardado (Failure Cases)

12. **Sin planificación**
    - (Caso edge - normalmente no debería ocurrir)
    - Si se puede reproducir: intentar guardar sin planificación
    - **Resultado esperado**: Toast "No hay planificación para guardar"

13. **Sin nombre**
    - Abrir diálogo de guardado
    - Limpiar el campo nombre (o dejarlo vacío)
    - Click en "Guardar"
    - **Resultado esperado**: 
      - Botón "Guardar" debería estar deshabilitado si el campo está vacío
      - Si se habilita, toast "Ingresá un nombre"

#### Double-Submit Prevention

14. **Múltiples clicks durante guardado**
    - Abrir diálogo de guardado
    - Click en "Guardar"
    - Inmediatamente hacer múltiples clicks
    - **Resultado esperado**: 
      - Solo se procesa el primer click
      - Botón se deshabilita inmediatamente
      - No se hacen múltiples updates

#### Error Handling

15. **Error de conexión**
    - Desconectar internet
    - Intentar guardar
    - **Resultado esperado**: 
      - Toast "Error de conexión. Revisá tu conexión a internet e intentá nuevamente."
      - Botón se rehabilita

16. **Error de permisos**
    - Modificar temporalmente RLS o permisos
    - Intentar guardar
    - **Resultado esperado**: 
      - Toast "No tenés permisos para guardar. Contactá al administrador."
      - Botón se rehabilita

17. **Error PGRST204 (migración faltante)**
    - (Ya estaba manejado, pero verificar que sigue funcionando)
    - **Resultado esperado**: 
      - Toast con mensaje específico sobre migración faltante
      - Logging detallado en DEV

## Notas Técnicas

- **Validación Client-Side**: Todas las validaciones ocurren antes de `setIsSaving(true)`, evitando llamadas innecesarias al servidor.
- **Logging Condicional**: El logging detallado solo ocurre en `import.meta.env.DEV` para no exponer información técnica en producción.
- **Mensajes User-Friendly**: Se evitan términos técnicos como "RLS", "PGRST204", "violates not-null constraint", etc. Los mensajes están en español y son accionables.
- **Prevención Double-Submit**: Se implementa tanto en la validación inicial (`if (isSaving) return`) como mediante deshabilitación del botón (`disabled={isSaving}`).
- **Estado de UI Consistente**: Ambos archivos mantienen el mismo patrón: estado "Guardando..." + spinner + botones deshabilitados durante el guardado.

## Observaciones

- El código ya tenía implementada la base de los estados de guardado (isSaving, "Guardando...", botones deshabilitados), lo cual hizo que la implementación fuera principalmente añadir validaciones y mejorar mensajes de error.
- La validación en `EvaluacionesGrupo` es más compleja porque tiene más campos requeridos (grupo, materia, competencias, nombre).
- `PlanificacionWorkspace` tiene una validación más simple porque la planificación ya existe y solo necesita un nombre personalizado.
- Los mensajes de error mantienen un tono consistente en ambos archivos, usando "vos" (formato argentino/uruguayo) y lenguaje claro y accionable.














