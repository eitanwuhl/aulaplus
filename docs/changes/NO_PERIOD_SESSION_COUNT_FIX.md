# Fix: Conteo de Sesiones Disponibles en Planificación "Sin Período Específico"

**Fecha**: 2025-01-XX  
**Tipo**: Bugfix  
**Alcance**: Corrección de cálculo de sesiones disponibles en modo "Sin Período Específico"

## Problema Identificado

### Síntoma
Cuando se crea una planificación con tipo "Sin Período Específico" y se ingresan valores para cantidad de sesiones (ej: 3) y duración por sesión (ej: 80 minutos), el resumen de planificación mostraba incorrectamente "3/0 clases disponibles" en lugar de "3/3 clases disponibles".

### Comportamiento Esperado vs. Real
- **Esperado**: El resumen debería mostrar "X/Y" donde Y = cantidad de sesiones ingresadas por el usuario
- **Real**: Mostraba "X/0" bloqueando la creación final porque el sistema validaba exceso de tiempo con denominador 0

### Impacto
1. El botón "Crear planificación" no funcionaba (permanecía en la pantalla de resumen)
2. La validación de tiempo disponible fallaba debido a división por 0
3. Los usuarios no podían completar la creación de planificaciones flexibles (backlog)

## Análisis de Causa Raíz

### Ubicación del Bug
**Archivo**: `src/components/planificacion/WizardSteps.tsx`  
**Líneas**: 799-807

### Código Problemático
```typescript
totalClasesDisponibles={
  wizardData.horario && wizardData.contexto?.fecha_inicio && wizardData.contexto?.fecha_fin
    ? Math.floor(
        (new Date(wizardData.contexto.fecha_fin).getTime() - 
         new Date(wizardData.contexto.fecha_inicio).getTime()) / 
        (1000 * 60 * 60 * 24 * 7)
      ) * wizardData.horario.horas_semanales
    : 0
}
```

### Causa
El cálculo de `totalClasesDisponibles` solo consideraba el modo "Período Específico" (requiere `fecha_inicio`, `fecha_fin` y `horario`). Para el modo "Sin Período Específico", no había ninguna rama de código que usara `cantidad_sesiones`, por lo que siempre retornaba `0`.

### Validación Existente
- El paso 0 ya valida que `cantidad_sesiones` sea mayor a 0 cuando `tipo_planificacion === 'sin_periodo'` (ver `src/hooks/usePlanificacionWizard.ts` líneas 110-123)
- Sin embargo, esta validación no se reflejaba en el cálculo del resumen

## Solución Implementada

### Cambio Realizado
Se agregó una condición para detectar el tipo de planificación y usar el valor correcto:

**Archivo**: `src/components/planificacion/WizardSteps.tsx`  
**Líneas**: 799-807

```typescript
totalClasesDisponibles={
  wizardData.tipo_planificacion === 'sin_periodo'
    ? (wizardData.contexto?.cantidad_sesiones || 0)
    : wizardData.horario && wizardData.contexto?.fecha_inicio && wizardData.contexto?.fecha_fin
      ? Math.floor(
          (new Date(wizardData.contexto.fecha_fin).getTime() - 
           new Date(wizardData.contexto.fecha_inicio).getTime()) / 
          (1000 * 60 * 60 * 24 * 7)
        ) * wizardData.horario.horas_semanales
      : 0
}
```

### Lógica
1. **Si `tipo_planificacion === 'sin_periodo'`**: Usa `cantidad_sesiones` del contexto
2. **Si `tipo_planificacion === 'periodo_especifico'`**: Usa el cálculo basado en fechas y horas semanales
3. **Caso por defecto**: Retorna 0 (para estados intermedios)

## Archivos Modificados

### 1. `src/components/planificacion/WizardSteps.tsx`
- **Cambio**: Actualización del cálculo de `totalClasesDisponibles` en el prop pasado a `UnidadDidacticaBuilder`
- **Líneas afectadas**: 799-807

## Verificación de Comportamiento Existente

### Creación de Sesiones Backlog
El código existente en `src/pages/PlanificacionWizard.tsx` (líneas 751-788) ya estaba correcto:

```typescript
if (wizardData.tipo_planificacion === 'sin_periodo') {
  const cantidadSesiones = wizardData.contexto.cantidad_sesiones!;
  const duracionPorSesion = wizardData.contexto.duracion_por_sesion!;
  
  const sesionesBacklog = Array.from({ length: cantidadSesiones }, (_, i) => ({
    planificacion_id: planificacion.id,
    fecha: null,
    orden: i + 1,
    estado: 'backlog' as const,
    duracion_minutos: duracionPorSesion,
    // ... otros campos
  }));
  
  // Insertar en BD y navegar a workspace
}
```

**Confirmación**: 
- ✅ Las sesiones se crean con `orden` correcto (1..N)
- ✅ `duracion_minutos` usa `duracion_por_sesion` del contexto
- ✅ `fecha` es `null` (correcto para backlog)
- ✅ `estado` es `'backlog'` (correcto)
- ✅ Navegación a workspace funciona correctamente después de crear sesiones

### Generación de Planes
La función `generarPlanesAutomaticamente` (líneas 250-558) funciona correctamente con sesiones backlog porque:
- Obtiene sesiones de BD ordenadas por `orden` (no depende de fechas)
- Usa `sesiones.length` para determinar el total
- Genera planes para todas las sesiones independientemente de si tienen fecha o no

**Confirmación**: ✅ No requiere cambios

## Validaciones y Guardrails

### Validaciones Existentes (Ya Funcionaban)
1. **Paso 0**: Valida que `cantidad_sesiones > 0` y `duracion_por_sesion > 0` cuando `tipo_planificacion === 'sin_periodo'`
   - Ubicación: `src/hooks/usePlanificacionWizard.ts` líneas 110-134
   - **Resultado**: El usuario no puede avanzar al paso 2 sin completar estos campos

2. **ResumenPlanificacion**: Protección contra división por 0
   - Ubicación: `src/components/planificacion/ResumenPlanificacion.tsx` líneas 58-60
   - **Código**: `const porcentajeClasesUsadas = totalClasesDisponibles > 0 ? (totalClasesAsignadas / totalClasesDisponibles) * 100 : 0;`
   - **Resultado**: No hay errores de división por 0, pero el porcentaje mostraba 0% incorrectamente

### Guardrails Agregados Implícitamente
Con el fix, ahora:
- ✅ El denominador nunca será 0 en modo `sin_periodo` si el paso 0 se completó correctamente
- ✅ La validación de exceso de tiempo funciona correctamente (comparación `totalClasesAsignadas > totalClasesDisponibles`)
- ✅ El resumen muestra correctamente el progreso (ej: "3/3 clases")

## Comportamiento Antes y Después

### Antes
1. Usuario selecciona "Sin Período Específico"
2. Ingresa: Cantidad de Sesiones = 3, Duración = 80 min
3. Crea 3 unidades y asigna 3 clases a una unidad
4. **Resumen muestra**: "3/0 clases disponibles" ❌
5. Validación de tiempo falla (3 > 0, pero el cálculo está mal)
6. Botón "Crear planificación" no funciona o permanece en resumen

### Después
1. Usuario selecciona "Sin Período Específico"
2. Ingresa: Cantidad de Sesiones = 3, Duración = 80 min
3. Crea 3 unidades y asigna 3 clases a una unidad
4. **Resumen muestra**: "3/3 clases disponibles" ✅
5. Validación de tiempo funciona correctamente
6. Botón "Crear planificación" crea planificación + 3 sesiones backlog
7. Navega a PlanificacionWorkspace donde el docente puede arrastrar sesiones al calendario

## Pruebas Manuales

### Caso de Prueba 1: Planificación Sin Período Específico Básica
1. Ir a `/planificacion/wizard`
2. Seleccionar grupo y materia
3. Seleccionar "Sin Período Específico"
4. Ingresar:
   - Cantidad de Sesiones: 3
   - Duración por Sesión: 80
5. Avanzar al paso 2 (saltando paso 1)
6. Crear 1 unidad didáctica y asignar 3 clases estimadas
7. **Verificar**: Resumen muestra "3/3 clases disponibles" ✅
8. Avanzar al paso 3 (confirmación)
9. Hacer clic en "Crear planificación"
10. **Verificar**: 
    - Se crean 3 sesiones en backlog (fecha=null, estado='backlog', duracion_minutos=80)
    - Se navega a `/planificacion/{id}` (workspace)
    - Las sesiones aparecen en la bandeja de backlog listas para arrastrar al calendario

### Caso de Prueba 2: Planificación Sin Período - Validación de Exceso
1. Repetir pasos 1-6 del caso anterior
2. En el paso 2, asignar 4 clases estimadas a la unidad (más que las 3 disponibles)
3. **Verificar**: 
    - Resumen muestra "4/3 clases disponibles" con badge rojo
    - Alerta: "La planificación excede el tiempo disponible en 1 clases"
    - Validación bloquea avanzar al paso 3

### Caso de Prueba 3: Planificación Período Específico (Regresión)
1. Ir a `/planificacion/wizard`
2. Seleccionar grupo y materia
3. Seleccionar "Período Específico"
4. Ingresar fechas de inicio y fin
5. Completar paso 1 (horario)
6. Completar paso 2 (unidades)
7. **Verificar**: Resumen muestra cálculo correcto basado en fechas y horas semanales (comportamiento sin cambios) ✅

## Consideraciones Técnicas

### Preservación de Flujos Existentes
- ✅ El flujo "Período Específico" no se modificó
- ✅ Las validaciones del paso 0 siguen siendo las mismas
- ✅ El esquema de BD no cambió
- ✅ La estructura de `WizardData` no cambió

### Compatibilidad
- ✅ Backward compatible: los datos existentes en BD no se ven afectados
- ✅ No hay migraciones requeridas
- ✅ No hay cambios en APIs o contratos de datos

## Conclusión

Este bugfix corrige un problema crítico en el flujo de creación de planificaciones "Sin Período Específico" que impedía a los usuarios completar la planificación. La solución es mínima y focalizada:

- **1 archivo modificado**
- **1 cálculo corregido** (9 líneas)
- **Sin cambios en estructura de datos**
- **Sin cambios en validaciones existentes**

El fix garantiza que:
1. El denominador de sesiones disponibles use el valor correcto según el tipo de planificación
2. Las validaciones funcionen correctamente
3. El botón "Crear planificación" funcione como se espera
4. Las sesiones backlog se creen correctamente y el usuario pueda arrastrarlas al calendario después















