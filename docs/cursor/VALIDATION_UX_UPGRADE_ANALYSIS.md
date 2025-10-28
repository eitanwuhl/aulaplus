# Planning Wizard Validation UX Upgrade - Análisis Comprehensivo

**Fecha**: 2025-01-24  
**Fase**: 6 - Validación UX  
**Estado**: ANÁLISIS COMPLETO  
**Branch sugerido**: `feature/validation-ux-upgrade`

---

## 📋 Resumen Ejecutivo

### Problema Actual
El wizard de planificación (`/planificacion/nuevo`) tiene una UX de validación subóptima:
- ❌ **Banner global** que lista todos los errores (abrumador)
- ❌ **Next button bloqueado** cuando hay errores (frustrante, sin indicación clara)
- ❌ **Sin errores inline** en los campos (usuario debe leer banner, buscar campo manualmente)
- ❌ **Sin gestión de foco** (usuario debe hacer scroll manual)
- ❌ **Problemas de accesibilidad** (sin `aria-invalid`, `aria-describedby`)

### Estado Deseado
- ✅ **Errores inline** por campo (borde rojo + mensaje debajo del input)
- ✅ **Next button siempre activo** (validación al hacer click)
- ✅ **Focus automático** al primer campo inválido
- ✅ **Scroll automático** hacia el primer error
- ✅ **Sin banner global** (eliminado completamente)
- ✅ **Accesibilidad completa** (ARIA attributes, focus outline visible)

### Impacto Esperado
- **UX**: Reducción del 70% en tiempo de corrección de errores
- **Accesibilidad**: Cumplimiento WCAG 2.1 AA
- **Código**: ~300 líneas modificadas, sin cambios en lógica de negocio
- **Performance**: Sin impacto (validación sigue siendo síncrona)

---

## 🗂️ 1. Inventario de Campos por Paso

### Paso 0: Contexto del Curso

#### Campos Obligatorios
| Campo ID | Componente | Validación | Mensaje Error |
|----------|-----------|-----------|---------------|
| `grupo_id` | Select | `required` | "Grupo a evaluar es obligatorio" |
| `materia` | Select | `required` | "Materia es obligatoria" |
| `tipo_planificacion` | RadioGroup | `required` | "Debes seleccionar un tipo de planificación" |

#### Campos Condicionales (si `tipo_planificacion === 'periodo_especifico'`)
| Campo ID | Componente | Validación | Mensaje Error |
|----------|-----------|-----------|---------------|
| `fecha_inicio` | Calendar | `required`, `>= today` | "Fecha de inicio es obligatoria"<br>"La fecha de inicio no puede ser anterior a hoy" |
| `fecha_fin` | Calendar | `required`, `>= fecha_inicio` | "Fecha de fin es obligatoria"<br>"La fecha de fin debe ser posterior a la fecha de inicio" |

#### Campos Condicionales (si `tipo_planificacion === 'sin_periodo'`)
| Campo ID | Componente | Validación | Mensaje Error |
|----------|-----------|-----------|---------------|
| `cantidad_sesiones` | Input (number) | `required`, `> 0`, `integer` | "Cantidad de sesiones es obligatoria"<br>"Debe ser un número mayor a 0" |
| `duracion_por_sesion` | Input (number) | `required`, `> 0`, `integer` | "Duración por sesión es obligatoria"<br>"Debe ser un número mayor a 0 minutos" |

#### Campos Opcionales
| Campo ID | Componente | Validación | Mensaje Error |
|----------|-----------|-----------|---------------|
| `objetivos_unidad` | Textarea | `optional` | N/A |

---

### Paso 1: Horario Real de Clases

#### Campos Obligatorios
| Campo ID | Componente | Validación | Mensaje Error |
|----------|-----------|-----------|---------------|
| `horas_semanales` | Input (number) | `required`, `> 0`, `integer` | "Horas semanales es obligatorio"<br>"Debe ser un número mayor a 0" |
| `configuracion` | Array dinámico | `required`, `minLength: 1` | "Debes configurar al menos un horario" |

#### Campos de cada item en `configuracion[]`
| Campo ID | Componente | Validación | Mensaje Error |
|----------|-----------|-----------|---------------|
| `configuracion[i].dia` | Select | `required` | "Día es obligatorio" |
| `configuracion[i].horaInicio` | Input (time) | `required`, `format: HH:MM` | "Hora de inicio es obligatoria"<br>"Formato inválido (debe ser HH:MM)" |
| `configuracion[i].horaFin` | Input (time) | `required`, `> horaInicio`, `format: HH:MM` | "Hora de fin es obligatoria"<br>"Debe ser posterior a la hora de inicio" |
| `configuracion[i].duracionMinutos` | Input (number) | `required`, `> 0` | "Duración es obligatoria"<br>"Debe ser mayor a 0 minutos" |

---

### Paso 2: Enfoque Pedagógico

#### Campos Obligatorios
| Campo ID | Componente | Validación | Mensaje Error |
|----------|-----------|-----------|---------------|
| `unidades_didacticas` | UnidadDidacticaBuilder | `required`, `minLength: 1` | "Debes crear al menos una unidad didáctica" |
| `distribucion_modalidades` | ModalityDistribution | `sum === 100` | "La suma de modalidades debe ser 100%" |

#### Validaciones internas en `UnidadDidacticaBuilder`
*(El componente maneja sus propias validaciones internamente)*
- Unidad debe tener al menos 1 competencia seleccionada
- Unidad debe tener al menos 1 contenido ANEP seleccionado

#### Validaciones internas en `ModalityDistribution`
*(Validación automática con ajuste proporcional)*
- La suma siempre se ajusta a 100% automáticamente
- **NOTA**: Actualmente no produce error, solo indicador visual (verde/rojo)

#### Campos Opcionales
| Campo ID | Componente | Validación | Mensaje Error |
|----------|-----------|-----------|---------------|
| `requerimientos_docente` | Textarea | `optional` | N/A |
| `estrategias_diferenciacion` | Textarea | `optional` | N/A |

---

### Paso 3: Confirmación

**No tiene campos editables** — solo muestra resumen y ejecuta validación final de todos los pasos anteriores.

---

## 🏗️ 2. Arquitectura de Validación Actual

### 2.1 Estructura Actual

```typescript
// src/hooks/usePlanificacionWizard.ts

interface ValidationResult {
  valid: boolean;
  errors: string[];  // ❌ Global error array, no field mapping
}

const validarPaso = (paso: number): ValidationResult => {
  const errors: string[] = [];
  
  switch (paso) {
    case 0:
      if (!wizardData.contexto?.grupo_id) {
        errors.push('Grupo a evaluar es obligatorio');
      }
      // ... más validaciones
      break;
    // ... otros pasos
  }
  
  return { valid: errors.length === 0, errors };
};
```

**Problemas**:
- ❌ No hay mapeo de errores a campos específicos
- ❌ Validación solo se ejecuta en transición de paso (no en tiempo real)
- ❌ No hay forma de saber qué campo causó qué error
- ❌ Múltiples errores del mismo campo se duplican

### 2.2 Renderizado Actual

```tsx
// src/components/planificacion/WizardSteps.tsx

{!validation.valid && validation.errors.length > 0 && (
  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
    <h4 className="font-medium text-destructive mb-2">Errores de validación:</h4>
    <ul className="text-sm text-destructive space-y-1">
      {validation.errors.map((error, index) => (
        <li key={index}>• {error}</li>
      ))}
    </ul>
  </div>
)}

<Button
  onClick={onNext}
  disabled={!validation.valid || isLoading}  // ❌ Bloqueado
>
  Siguiente
</Button>
```

**Problemas**:
- ❌ Banner global con todos los errores (overwhelming)
- ❌ Next button bloqueado (no permite intentar avanzar)
- ❌ Sin indicación visual en los campos inválidos

---

## 🎯 3. Arquitectura de Validación Propuesta

### 3.1 Nueva Estructura de Errores

```typescript
// src/types/planificacion.ts (NEW)

export interface FieldError {
  fieldId: string;          // ID único del campo (ej: 'grupo_id', 'configuracion[0].dia')
  message: string;          // Mensaje en español para mostrar al usuario
  type?: 'required' | 'format' | 'range' | 'custom';  // Opcional: tipo de error
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];     // ✅ Array de errores con campo asociado
  firstInvalidField?: string; // ✅ ID del primer campo inválido (para focus)
}
```

### 3.2 Función de Validación Mejorada

```typescript
// src/hooks/usePlanificacionWizard.ts (MODIFIED)

const validarPaso = useCallback((paso: number): ValidationResult => {
  const errors: FieldError[] = [];
  let firstInvalidField: string | undefined;

  switch (paso) {
    case 0: {
      // Validar grupo_id
      if (!wizardData.contexto?.grupo_id) {
        const error: FieldError = {
          fieldId: 'grupo_id',
          message: 'Grupo a evaluar es obligatorio',
          type: 'required'
        };
        errors.push(error);
        if (!firstInvalidField) firstInvalidField = 'grupo_id';
      }

      // Validar materia
      if (!wizardData.contexto?.materia) {
        const error: FieldError = {
          fieldId: 'materia',
          message: 'Materia es obligatoria',
          type: 'required'
        };
        errors.push(error);
        if (!firstInvalidField) firstInvalidField = 'materia';
      }

      // Validar tipo_planificacion
      if (!wizardData.tipo_planificacion) {
        const error: FieldError = {
          fieldId: 'tipo_planificacion',
          message: 'Debes seleccionar un tipo de planificación',
          type: 'required'
        };
        errors.push(error);
        if (!firstInvalidField) firstInvalidField = 'tipo_planificacion';
      }

      // Validar fechas (si periodo_especifico)
      if (wizardData.tipo_planificacion === 'periodo_especifico') {
        const fechaInicio = wizardData.contexto?.fecha_inicio;
        const fechaFin = wizardData.contexto?.fecha_fin;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (!fechaInicio) {
          errors.push({
            fieldId: 'fecha_inicio',
            message: 'Fecha de inicio es obligatoria',
            type: 'required'
          });
          if (!firstInvalidField) firstInvalidField = 'fecha_inicio';
        } else if (new Date(fechaInicio) < hoy) {
          errors.push({
            fieldId: 'fecha_inicio',
            message: 'La fecha de inicio no puede ser anterior a hoy',
            type: 'range'
          });
          if (!firstInvalidField) firstInvalidField = 'fecha_inicio';
        }

        if (!fechaFin) {
          errors.push({
            fieldId: 'fecha_fin',
            message: 'Fecha de fin es obligatoria',
            type: 'required'
          });
          if (!firstInvalidField) firstInvalidField = 'fecha_fin';
        } else if (fechaInicio && new Date(fechaFin) <= new Date(fechaInicio)) {
          errors.push({
            fieldId: 'fecha_fin',
            message: 'La fecha de fin debe ser posterior a la fecha de inicio',
            type: 'range'
          });
          if (!firstInvalidField) firstInvalidField = 'fecha_fin';
        }
      }

      // Validar cantidad_sesiones y duracion (si sin_periodo)
      if (wizardData.tipo_planificacion === 'sin_periodo') {
        const cantidadSesiones = wizardData.contexto?.cantidad_sesiones;
        const duracion = wizardData.contexto?.duracion_por_sesion;

        if (!cantidadSesiones || cantidadSesiones <= 0) {
          errors.push({
            fieldId: 'cantidad_sesiones',
            message: cantidadSesiones === undefined 
              ? 'Cantidad de sesiones es obligatoria'
              : 'Debe ser un número mayor a 0',
            type: cantidadSesiones === undefined ? 'required' : 'range'
          });
          if (!firstInvalidField) firstInvalidField = 'cantidad_sesiones';
        }

        if (!duracion || duracion <= 0) {
          errors.push({
            fieldId: 'duracion_por_sesion',
            message: duracion === undefined
              ? 'Duración por sesión es obligatoria'
              : 'Debe ser un número mayor a 0 minutos',
            type: duracion === undefined ? 'required' : 'range'
          });
          if (!firstInvalidField) firstInvalidField = 'duracion_por_sesion';
        }
      }

      break;
    }

    case 1: {
      // Validar horas_semanales
      const horasSemanales = wizardData.horario?.horas_semanales;
      if (!horasSemanales || horasSemanales <= 0) {
        errors.push({
          fieldId: 'horas_semanales',
          message: horasSemanales === undefined
            ? 'Horas semanales es obligatorio'
            : 'Debe ser un número mayor a 0',
          type: horasSemanales === undefined ? 'required' : 'range'
        });
        if (!firstInvalidField) firstInvalidField = 'horas_semanales';
      }

      // Validar configuracion
      const configuracion = wizardData.horario?.configuracion || [];
      if (configuracion.length === 0) {
        errors.push({
          fieldId: 'configuracion',
          message: 'Debes configurar al menos un horario',
          type: 'required'
        });
        if (!firstInvalidField) firstInvalidField = 'configuracion';
      } else {
        // Validar cada item de configuración
        configuracion.forEach((config, index) => {
          const prefix = `configuracion[${index}]`;

          if (!config.dia) {
            errors.push({
              fieldId: `${prefix}.dia`,
              message: 'Día es obligatorio',
              type: 'required'
            });
            if (!firstInvalidField) firstInvalidField = `${prefix}.dia`;
          }

          if (!config.horaInicio) {
            errors.push({
              fieldId: `${prefix}.horaInicio`,
              message: 'Hora de inicio es obligatoria',
              type: 'required'
            });
            if (!firstInvalidField) firstInvalidField = `${prefix}.horaInicio`;
          }

          if (!config.horaFin) {
            errors.push({
              fieldId: `${prefix}.horaFin`,
              message: 'Hora de fin es obligatoria',
              type: 'required'
            });
            if (!firstInvalidField) firstInvalidField = `${prefix}.horaFin`;
          } else if (config.horaInicio && config.horaFin <= config.horaInicio) {
            errors.push({
              fieldId: `${prefix}.horaFin`,
              message: 'Debe ser posterior a la hora de inicio',
              type: 'range'
            });
            if (!firstInvalidField) firstInvalidField = `${prefix}.horaFin`;
          }

          if (!config.duracionMinutos || config.duracionMinutos <= 0) {
            errors.push({
              fieldId: `${prefix}.duracionMinutos`,
              message: config.duracionMinutos === undefined
                ? 'Duración es obligatoria'
                : 'Debe ser mayor a 0 minutos',
              type: config.duracionMinutos === undefined ? 'required' : 'range'
            });
            if (!firstInvalidField) firstInvalidField = `${prefix}.duracionMinutos`;
          }
        });
      }

      break;
    }

    case 2: {
      // Validar unidades_didacticas
      const unidades = wizardData.enfoque?.unidades_didacticas || [];
      if (unidades.length === 0) {
        errors.push({
          fieldId: 'unidades_didacticas',
          message: 'Debes crear al menos una unidad didáctica',
          type: 'required'
        });
        if (!firstInvalidField) firstInvalidField = 'unidades_didacticas';
      }

      // Validar distribucion_modalidades (suma = 100%)
      const distribucion = wizardData.enfoque?.distribucion_modalidades;
      if (distribucion) {
        const total = Object.values(distribucion).reduce((sum, val) => sum + val, 0);
        if (total !== 100) {
          errors.push({
            fieldId: 'distribucion_modalidades',
            message: 'La suma de modalidades debe ser 100%',
            type: 'custom'
          });
          if (!firstInvalidField) firstInvalidField = 'distribucion_modalidades';
        }
      }

      break;
    }

    case 3: {
      // Validación final: recursiva de todos los pasos
      const paso0 = validarPaso(0);
      const paso1 = validarPaso(1);
      const paso2 = validarPaso(2);

      errors.push(...paso0.errors, ...paso1.errors, ...paso2.errors);
      firstInvalidField = paso0.firstInvalidField || paso1.firstInvalidField || paso2.firstInvalidField;
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    firstInvalidField
  };
}, [wizardData]);
```

### 3.3 Helper: Obtener Error por Campo

```typescript
// src/hooks/usePlanificacionWizard.ts (NEW helper)

const getFieldError = useCallback((
  fieldId: string,
  validation: ValidationResult
): string | undefined => {
  const error = validation.errors.find(e => e.fieldId === fieldId);
  return error?.message;
}, []);
```

---

## 🎨 4. Componentes UI con Errores Inline

### 4.1 Wrapper para Input con Error

```tsx
// src/components/ui/form-field.tsx (NEW COMPONENT)

import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  description?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required,
  error,
  children,
  description
}) => {
  const errorId = error ? `${id}-error` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={cn(error && 'text-destructive')}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      {description && !error && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      <div>
        {React.cloneElement(children as React.ReactElement, {
          id,
          'aria-invalid': error ? 'true' : 'false',
          'aria-describedby': error ? errorId : descriptionId,
          className: cn(
            (children as React.ReactElement).props.className,
            error && 'border-destructive focus:ring-destructive'
          )
        })}
      </div>

      {error && (
        <p
          id={errorId}
          className="text-sm text-destructive font-medium"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};
```

### 4.2 Ejemplo de Uso en Paso 0

```tsx
// src/components/planificacion/WizardSteps.tsx (MODIFIED)

const renderPaso0 = () => {
  const validation = validarPaso(0); // Ejecutar validación en cada render
  const getError = (fieldId: string) => 
    validation.errors.find(e => e.fieldId === fieldId)?.message;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Campo: Grupo */}
          <FormField
            id="grupo_id"
            label="Grupo a Evaluar"
            required
            error={getError('grupo_id')}
          >
            <Select
              value={wizardData.contexto?.grupo_id || ''}
              onValueChange={(value) => 
                onUpdateContexto({ ...wizardData.contexto, grupo_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar grupo" />
              </SelectTrigger>
              <SelectContent>
                {grupos.map((grupo) => (
                  <SelectItem key={grupo.id} value={grupo.id}>
                    {grupo.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* Campo: Materia */}
          <FormField
            id="materia"
            label="Materia"
            required
            error={getError('materia')}
          >
            <Select
              value={wizardData.contexto?.materia || ''}
              onValueChange={(value) => 
                onUpdateContexto({ ...wizardData.contexto, materia: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar materia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Historia">Historia</SelectItem>
                <SelectItem value="Literatura">Literatura</SelectItem>
                <SelectItem value="Educación para la Ciudadanía">
                  Educación para la Ciudadanía
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {/* Campo: Tipo de Planificación */}
        <div className="border-t pt-4 mt-4">
          <div className="space-y-2">
            <Label className={cn(
              "text-base font-semibold block",
              getError('tipo_planificacion') && 'text-destructive'
            )}>
              Tipo de Planificación
              <span className="text-destructive ml-1">*</span>
            </Label>
            
            {getError('tipo_planificacion') && (
              <p className="text-sm text-destructive font-medium" role="alert">
                {getError('tipo_planificacion')}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Radio buttons... */}
            </div>
          </div>
        </div>

        {/* Campos condicionales de fechas */}
        {wizardData.tipo_planificacion === 'periodo_especifico' && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="fecha_inicio"
              label="Fecha de Inicio"
              required
              error={getError('fecha_inicio')}
            >
              {/* Calendar popover... */}
            </FormField>

            <FormField
              id="fecha_fin"
              label="Fecha de Fin"
              required
              error={getError('fecha_fin')}
            >
              {/* Calendar popover... */}
            </FormField>
          </div>
        )}

        {/* Campos condicionales de sesiones */}
        {wizardData.tipo_planificacion === 'sin_periodo' && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="cantidad_sesiones"
              label="Cantidad de Sesiones"
              required
              error={getError('cantidad_sesiones')}
            >
              <Input
                type="number"
                min="1"
                placeholder="Ej: 8"
                value={wizardData.contexto?.cantidad_sesiones || ''}
                onChange={(e) => 
                  onUpdateContexto({
                    ...wizardData.contexto,
                    cantidad_sesiones: parseInt(e.target.value) || undefined
                  })
                }
              />
            </FormField>

            <FormField
              id="duracion_por_sesion"
              label="Duración por Sesión (min)"
              required
              error={getError('duracion_por_sesion')}
            >
              <Input
                type="number"
                min="1"
                placeholder="Ej: 80"
                value={wizardData.contexto?.duracion_por_sesion || ''}
                onChange={(e) => 
                  onUpdateContexto({
                    ...wizardData.contexto,
                    duracion_por_sesion: parseInt(e.target.value) || undefined
                  })
                }
              />
            </FormField>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## 🎯 5. Estrategia de Focus y Scroll

### 5.1 Función de Focus Automático

```typescript
// src/components/planificacion/WizardSteps.tsx (NEW function)

const focusFirstInvalidField = useCallback((validation: ValidationResult) => {
  if (!validation.firstInvalidField) return;

  const fieldId = validation.firstInvalidField;
  
  // Intentar encontrar el elemento por ID directo
  let element = document.getElementById(fieldId);
  
  // Si no existe, intentar encontrar por aria-describedby (para campos dentro de portales)
  if (!element) {
    element = document.querySelector(`[aria-describedby="${fieldId}-error"]`);
  }

  if (element) {
    // Scroll hacia el elemento con padding superior
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });

    // Delay para permitir que el scroll termine antes de focus
    setTimeout(() => {
      element.focus({ preventScroll: true });
    }, 300);
  }
}, []);
```

### 5.2 Integración en `onNext`

```tsx
// src/components/planificacion/WizardSteps.tsx (MODIFIED)

const handleNext = useCallback(() => {
  const validation = validarPaso(wizardData.paso);
  
  if (!validation.valid) {
    // ✅ Focus primer campo inválido en lugar de bloquear
    focusFirstInvalidField(validation);
    
    // ✅ Opcional: Mostrar toast breve
    toast({
      title: "Revisa los campos",
      description: `Hay ${validation.errors.length} error(es) que corregir`,
      variant: "destructive",
      duration: 3000
    });
    
    return; // No avanzar al siguiente paso
  }

  // Validación exitosa: avanzar
  onNext();
}, [wizardData.paso, validarPaso, focusFirstInvalidField, onNext]);

return (
  <div className="space-y-6">
    {/* ... contenido ... */}

    {/* Botones de navegación */}
    <div className="flex justify-between">
      <Button
        variant="outline"
        onClick={onPrev}
        disabled={wizardData.paso === 0 || isLoading}
      >
        Anterior
      </Button>

      {wizardData.paso < 3 ? (
        <Button
          onClick={handleNext}  // ✅ Siempre activo
          disabled={isLoading}  // ✅ Solo deshabilitado cuando está cargando
        >
          Siguiente
        </Button>
      ) : (
        <Button
          onClick={onFinish}
          disabled={isLoading}
        >
          {isLoading ? 'Creando...' : 'Crear Planificación'}
        </Button>
      )}
    </div>
  </div>
);
```

### 5.3 Manejo de Portales (Date Pickers, Popovers)

Para campos dentro de `Popover` (como los date pickers), necesitamos estrategia especial:

```tsx
// src/components/planificacion/WizardSteps.tsx (MODIFIED)

// En el campo de fecha_inicio:
<FormField
  id="fecha_inicio"
  label="Fecha de Inicio"
  required
  error={getError('fecha_inicio')}
>
  <Popover>
    <PopoverTrigger asChild>
      <Button
        id="fecha_inicio"  // ✅ ID en el trigger para focus
        variant="outline"
        className={cn(
          "justify-start text-left font-normal",
          !wizardData.contexto?.fecha_inicio && "text-muted-foreground",
          getError('fecha_inicio') && 'border-destructive'
        )}
        aria-invalid={getError('fecha_inicio') ? 'true' : 'false'}
        aria-describedby={getError('fecha_inicio') ? 'fecha_inicio-error' : undefined}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {wizardData.contexto?.fecha_inicio 
          ? format(new Date(wizardData.contexto.fecha_inicio), 'PPP', { locale: es })
          : "Seleccionar fecha"
        }
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={wizardData.contexto?.fecha_inicio 
          ? new Date(wizardData.contexto.fecha_inicio)
          : undefined
        }
        onSelect={(date) => {
          if (date) {
            onUpdateContexto({
              ...wizardData.contexto,
              fecha_inicio: date.toISOString()
            });
          }
        }}
        disabled={(date) => {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          return date < hoy;
        }}
        initialFocus
      />
    </PopoverContent>
  </Popover>
</FormField>
```

---

## 📦 6. Plan de Migración Paso a Paso

### Fase 1: Preparación (1 hora)
✅ **Tareas**:
1. Crear `src/types/validation.ts` con `FieldError` y nuevo `ValidationResult`
2. Crear `src/components/ui/form-field.tsx` con componente wrapper
3. Agregar helper `getFieldError()` a `usePlanificacionWizard.ts`
4. Instalar `react-hot-toast` (si no existe) para feedback breve

✅ **Archivos modificados**: 3 nuevos
✅ **Commits**: 1 ("feat: add field-level validation types and FormField component")

---

### Fase 2: Refactor de Validación (2-3 horas)
✅ **Tareas**:
1. Modificar `validarPaso()` en `usePlanificacionWizard.ts`:
   - Cambiar tipo de retorno a nuevo `ValidationResult`
   - Migrar cada `errors.push(string)` a `errors.push({ fieldId, message })`
   - Agregar tracking de `firstInvalidField`
2. Actualizar todos los call sites de `validarPaso()` para usar nueva estructura
3. Testing manual: verificar que errores se mapean correctamente

✅ **Archivos modificados**: 1 (`usePlanificacionWizard.ts`)
✅ **Commits**: 1 ("refactor: migrate validation to field-level error mapping")

---

### Fase 3: UI Paso 0 (2 horas)
✅ **Tareas**:
1. Importar `FormField` en `WizardSteps.tsx`
2. Crear función local `getError(fieldId: string)` usando validation result
3. Refactorizar todos los campos de Paso 0:
   - `grupo_id` (Select)
   - `materia` (Select)
   - `tipo_planificacion` (RadioGroup)
   - `fecha_inicio`, `fecha_fin` (Calendar)
   - `cantidad_sesiones`, `duracion_por_sesion` (Input number)
4. Eliminar banner global para Paso 0
5. Testing manual: verificar errores inline y estilos

✅ **Archivos modificados**: 1 (`WizardSteps.tsx`)
✅ **Commits**: 1 ("feat: add inline validation to Paso 0")

---

### Fase 4: UI Paso 1 (2 horas)
✅ **Tareas**:
1. Refactorizar campo `horas_semanales` con `FormField`
2. Refactorizar array dinámico `configuracion[]`:
   - Crear wrapper para cada item (dia, horaInicio, horaFin, duracionMinutos)
   - Mapear errores con `configuracion[i].{field}`
3. Eliminar banner global para Paso 1
4. Testing manual: agregar/eliminar items, verificar errores

✅ **Archivos modificados**: 1 (`WizardSteps.tsx`)
✅ **Commits**: 1 ("feat: add inline validation to Paso 1")

---

### Fase 5: UI Paso 2 (1-2 horas)
✅ **Tareas**:
1. Refactorizar validación de `unidades_didacticas`:
   - `UnidadDidacticaBuilder` ya maneja validación interna
   - Agregar indicador de error global si array vacío
2. Refactorizar `distribucion_modalidades`:
   - `ModalityDistribution` ya tiene indicador visual (verde/rojo)
   - Verificar si necesita error adicional
3. Campos opcionales (requerimientos, estrategias): sin cambios
4. Eliminar banner global para Paso 2

✅ **Archivos modificados**: 1 (`WizardSteps.tsx`)
✅ **Commits**: 1 ("feat: add inline validation to Paso 2")

---

### Fase 6: Focus y Scroll (1 hora)
✅ **Tareas**:
1. Agregar función `focusFirstInvalidField()`
2. Modificar `handleNext()` para llamar focus en lugar de bloquear
3. Agregar toast breve con resumen de errores
4. Testing manual: verificar scroll suave, focus correcto, toast

✅ **Archivos modificados**: 1 (`WizardSteps.tsx`)
✅ **Commits**: 1 ("feat: add auto-focus and scroll to first invalid field")

---

### Fase 7: Eliminación del Banner Global (30 min)
✅ **Tareas**:
1. Eliminar bloque de renderizado del banner global
2. Eliminar prop `disabled={!validation.valid}` del Next button
3. Cleanup de estilos no utilizados
4. Testing manual: verificar que no hay referencias al banner

✅ **Archivos modificados**: 1 (`WizardSteps.tsx`)
✅ **Commits**: 1 ("refactor: remove global validation banner")

---

### Fase 8: Accesibilidad (1 hora)
✅ **Tareas**:
1. Verificar que todos los campos tienen:
   - `aria-invalid`
   - `aria-describedby`
   - `role="alert"` en mensajes de error
2. Testing con lector de pantalla (VoiceOver en macOS)
3. Testing con teclado (Tab, Shift+Tab, Enter, Escape)
4. Verificar outline visible en focus (no `outline-none`)

✅ **Archivos modificados**: 1 (`form-field.tsx` + ajustes menores en `WizardSteps.tsx`)
✅ **Commits**: 1 ("a11y: improve keyboard and screen reader support")

---

### Fase 9: Testing Final (1 hora)
✅ **Tareas**:
1. Testing de flujo completo (los 4 pasos)
2. Testing de edge cases:
   - Cambiar de tipo_planificacion después de llenar fechas
   - Agregar/eliminar múltiples items en configuracion
   - Validación paso 3 (recursiva)
3. Testing de performance (no degradación)
4. Build de producción y smoke test

✅ **Archivos modificados**: 0
✅ **Commits**: 0 (solo testing)

---

## ⏱️ 7. Estimación de Tiempo

| Fase | Tiempo Estimado |
|------|----------------|
| 1. Preparación | 1 hora |
| 2. Refactor Validación | 2-3 horas |
| 3. UI Paso 0 | 2 horas |
| 4. UI Paso 1 | 2 horas |
| 5. UI Paso 2 | 1-2 horas |
| 6. Focus y Scroll | 1 hora |
| 7. Eliminación Banner | 30 min |
| 8. Accesibilidad | 1 hora |
| 9. Testing Final | 1 hora |
| **TOTAL** | **11.5 - 13.5 horas** |

**Recomendación**: Realizar en 3 sesiones de trabajo:
- **Sesión 1** (4-5h): Fases 1-3 (Preparación + Refactor + Paso 0)
- **Sesión 2** (4-5h): Fases 4-6 (Pasos 1-2 + Focus)
- **Sesión 3** (3-4h): Fases 7-9 (Cleanup + A11y + Testing)

---

## ⚠️ 8. Riesgos y Mitigaciones

### Riesgo 1: Componentes hijos con validación propia
**Descripción**: `UnidadDidacticaBuilder` y `ModalityDistribution` manejan su propia validación interna.  
**Impacto**: Posible duplicación o inconsistencia de errores.  
**Mitigación**: 
- Mantener validación interna de componentes hijos
- Agregar prop `error?: string` a componentes para mostrar errores globales
- Solo validar en `validarPaso()` los casos de "array vacío" o "suma !== 100%"

### Riesgo 2: Portales y focus
**Descripción**: Date pickers dentro de `Popover` renderizan en portal (fuera del DOM tree normal).  
**Impacto**: `document.getElementById()` puede no encontrar el trigger button.  
**Mitigación**:
- Asignar `id` al `PopoverTrigger` button
- Usar `aria-describedby` como fallback en `focusFirstInvalidField()`
- Testing exhaustivo de focus en date pickers

### Riesgo 3: Validación en cada render
**Descripción**: Llamar `validarPaso()` en cada render de paso puede causar re-renders innecesarios.  
**Impacto**: Posible degradación de performance.  
**Mitigación**:
- Usar `useMemo()` para cachear resultado de validación
- Solo revalidar cuando `wizardData` cambia
- Medir performance con React DevTools Profiler

### Riesgo 4: Sincronización de errores en array dinámico
**Descripción**: Al eliminar un item de `configuracion[]`, los IDs de error cambian (`configuracion[0]` → `configuracion[1]`).  
**Impacto**: Errores pueden mostrarse en item incorrecto.  
**Mitigación**:
- Usar índice del array como parte del `fieldId`
- Re-ejecutar validación completa después de cada cambio en array
- Considerar usar UUIDs en lugar de índices (futuro)

### Riesgo 5: Toast spam en Next button
**Descripción**: Usuario hace click repetidamente en Next con errores → múltiples toasts.  
**Impacto**: UX molesta.  
**Mitigación**:
- Usar `toast.dismiss()` antes de mostrar nuevo toast
- Agregar `duration: 3000` corto
- Considerar debounce en `handleNext()` (150ms)

---

## ✅ 9. Checklist de Implementación

### Preparación
- [ ] Crear `src/types/validation.ts`
- [ ] Crear `src/components/ui/form-field.tsx`
- [ ] Instalar dependencia toast si falta
- [ ] Crear branch `feature/validation-ux-upgrade`

### Refactor de Validación
- [ ] Modificar `validarPaso()` en `usePlanificacionWizard.ts`
- [ ] Actualizar tipo de retorno a `ValidationResult`
- [ ] Migrar Paso 0: 7 validaciones con fieldId
- [ ] Migrar Paso 1: validación de horarios con array indices
- [ ] Migrar Paso 2: validación de unidades y modalidades
- [ ] Migrar Paso 3: validación recursiva
- [ ] Testing: verificar mapeo correcto de errores

### UI Paso 0
- [ ] Refactorizar `grupo_id` con `FormField`
- [ ] Refactorizar `materia` con `FormField`
- [ ] Refactorizar `tipo_planificacion` (manual, no Select)
- [ ] Refactorizar `fecha_inicio` con `FormField` + Popover
- [ ] Refactorizar `fecha_fin` con `FormField` + Popover
- [ ] Refactorizar `cantidad_sesiones` con `FormField`
- [ ] Refactorizar `duracion_por_sesion` con `FormField`
- [ ] Testing: verificar errores inline, estilos rojos

### UI Paso 1
- [ ] Refactorizar `horas_semanales` con `FormField`
- [ ] Refactorizar array `configuracion[]`:
  - [ ] `configuracion[i].dia`
  - [ ] `configuracion[i].horaInicio`
  - [ ] `configuracion[i].horaFin`
  - [ ] `configuracion[i].duracionMinutos`
- [ ] Testing: agregar/eliminar items, verificar errores

### UI Paso 2
- [ ] Agregar error global para `unidades_didacticas` vacío
- [ ] Verificar indicador de `distribucion_modalidades`
- [ ] Testing: crear/eliminar unidades, ajustar modalidades

### Focus y Scroll
- [ ] Implementar `focusFirstInvalidField()`
- [ ] Modificar `handleNext()` para llamar focus
- [ ] Agregar toast breve con resumen
- [ ] Testing: verificar scroll suave, focus correcto

### Cleanup
- [ ] Eliminar banner global de validación
- [ ] Eliminar `disabled={!validation.valid}` de Next button
- [ ] Cleanup de estilos no usados
- [ ] Testing: verificar que no hay banner

### Accesibilidad
- [ ] Verificar `aria-invalid` en todos los campos
- [ ] Verificar `aria-describedby` con error IDs
- [ ] Verificar `role="alert"` en mensajes de error
- [ ] Testing con VoiceOver
- [ ] Testing con teclado (Tab, Enter, Escape)

### Testing Final
- [ ] Flujo completo (4 pasos)
- [ ] Edge cases (cambiar tipo_planificacion, array dinámico)
- [ ] Performance (React DevTools Profiler)
- [ ] Build de producción (`npm run build`)
- [ ] Smoke test en dev server

### Documentación
- [ ] Crear PR con descripción detallada
- [ ] Agregar screenshots de antes/después
- [ ] Documentar cambios en API de validación
- [ ] Actualizar README si es necesario

---

## 📝 10. Notas Adicionales

### Decisiones de Diseño

1. **Validación síncrona en cada render vs. onSubmit**:
   - ✅ Elegido: Validación en cada render (con useMemo)
   - Razón: Feedback inmediato, especialmente útil para campos condicionales

2. **Schema library (zod/yup) vs. custom logic**:
   - ✅ Elegido: Custom logic
   - Razón: Validación actual es simple, no justifica dependencia adicional

3. **Toast vs. inline summary**:
   - ✅ Elegido: Toast breve (3s)
   - Razón: No invasivo, desaparece automáticamente

4. **Error colors**:
   - ✅ Elegido: Tailwind `text-destructive`, `border-destructive`
   - Razón: Consistente con tema, accesible (contraste AA)

### Futuros Mejoras (out of scope)

- **Validación en tiempo real (onChange/onBlur)**: Requiere más re-renders, puede ser molesto
- **Errores múltiples por campo**: Actualmente solo se muestra el primero
- **Validación asíncrona**: Para campos que requieren llamadas a API (ej: duplicados)
- **Esquema de validación centralizado**: Migrar a zod/yup para type safety
- **i18n de errores**: Preparar mensajes para multi-idioma

---

## 🎯 11. Criterios de Éxito

✅ **UX**:
- Todos los campos obligatorios muestran error inline cuando están vacíos
- Error desaparece cuando el usuario corrige el campo
- Next button nunca está bloqueado (solo deshabilitado durante loading)
- Primer campo inválido recibe focus automático
- Scroll suave hacia primer error

✅ **Accesibilidad**:
- 100% de campos con `aria-invalid` cuando inválidos
- 100% de campos con `aria-describedby` apuntando a error ID
- Mensajes de error con `role="alert"`
- Navegación completa con teclado
- VoiceOver anuncia errores correctamente

✅ **Code Quality**:
- Build sin warnings/errors
- TypeScript strict mode pasa
- No degradación de performance (< 5% overhead)
- Código DRY (no duplicación de lógica de validación)

✅ **Testing**:
- Flujo completo funciona sin errores
- Edge cases cubiertos (tipos de planificación, arrays dinámicos)
- Smoke test en build de producción

---

**FIN DEL ANÁLISIS**

Este documento debe servir como guía completa para la implementación. Cualquier duda o ajuste debe documentarse aquí antes de proceder con el código.
