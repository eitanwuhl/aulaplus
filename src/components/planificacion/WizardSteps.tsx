import React, { useMemo, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { PlanningTextArea } from './PlanningTextArea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WizardData, ConfiguracionHorario, DistribucionModalidades } from '@/types/planificacion';
import { ValidationResult } from '@/types/validation';
import { mockGroups } from '@/data/mockData';
import { ModalityDistribution } from './ModalityDistribution';
import { UnidadDidacticaBuilder } from './UnidadDidacticaBuilder';
import { PlanMaterialsSection } from './PlanMaterialsSection';
import { Materia } from '@/data/catalogo';
import { useToast } from '@/hooks/use-toast';

interface WizardStepsProps {
  wizardData: WizardData;
  onUpdateContexto: (contexto: WizardData['contexto']) => void;
  onUpdateHorario: (horario: WizardData['horario']) => void;
  onUpdateEnfoque: (enfoque: WizardData['enfoque']) => void;
  onUpdateTipoPlanificacion: (tipo: 'periodo_especifico' | 'sin_periodo') => void;
  onNext: () => void;
  onPrev: () => void;
  onFinish: () => void;
  isLoading: boolean;
  validation: ValidationResult;
}

export const WizardSteps: React.FC<WizardStepsProps> = ({
  wizardData,
  onUpdateContexto,
  onUpdateHorario,
  onUpdateEnfoque,
  onUpdateTipoPlanificacion,
  onNext,
  onPrev,
  onFinish,
  isLoading,
  validation
}) => {
  const { toast } = useToast();

  // Pristine state tracking: campos no muestran errores hasta que el usuario intente avanzar o interactúe
  const [submitAttempted, setSubmitAttempted] = useState<Record<number, boolean>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Helper para marcar un campo como "touched" (interactuado)
  const markFieldAsTouched = useCallback((fieldId: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldId));
  }, []);

  // Helper function to get error message for a specific field (respeta pristine state)
  const getError = (fieldId: string): string | undefined => {
    const currentPaso = wizardData.paso;
    
    // Si no se ha intentado enviar este paso Y el campo no ha sido touched, NO mostrar error
    if (!submitAttempted[currentPaso] && !touchedFields.has(fieldId)) {
      return undefined;
    }

    const error = validation.errors.find(e => e.fieldId === fieldId);
    return error?.message;
  };

  // Focus and scroll to first invalid field
  const focusFirstInvalidField = useCallback((validation: ValidationResult) => {
    if (!validation.firstInvalidField) return;

    const fieldId = validation.firstInvalidField;
    
    // Intentar encontrar el elemento por ID directo
    let element = document.getElementById(fieldId) as HTMLElement | null;
    
    // Si no existe, intentar encontrar por aria-describedby (para campos dentro de portales)
    if (!element) {
      element = document.querySelector(`[aria-describedby="${fieldId}-error"]`) as HTMLElement | null;
    }

    // Para arrays dinámicos, buscar cualquier elemento que comience con el fieldId
    if (!element && fieldId.includes('[')) {
      const baseId = fieldId.split('[')[0];
      element = document.querySelector(`[id^="${baseId}"]`) as HTMLElement | null;
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
        if (element) {
          element.focus({ preventScroll: true });
        }
      }, 300);
    }
  }, []);

  // Handle Next button click with validation and focus
  const handleNext = useCallback(() => {
    const currentPaso = wizardData.paso;
    
    // Marcar que se intentó enviar este paso
    setSubmitAttempted(prev => ({ ...prev, [currentPaso]: true }));

    if (!validation.valid) {
      // Focus primer campo inválido
      focusFirstInvalidField(validation);
      
      // No avanzar al siguiente paso
      return;
    }

    // Validación exitosa: avanzar
    onNext();
  }, [wizardData.paso, validation, focusFirstInvalidField, onNext]);

  // Handle Prev button click - resetear submitAttempted del paso actual
  const handlePrev = useCallback(() => {
    const currentPaso = wizardData.paso;
    
    // Resetear submitAttempted del paso actual (permitir volver a editar sin errores)
    setSubmitAttempted(prev => {
      const newState = { ...prev };
      delete newState[currentPaso];
      return newState;
    });
    
    onPrev();
  }, [wizardData.paso, onPrev]);

  // Handle final step (Crear Planificación) with validation
  const handleFinish = useCallback(() => {
    const currentPaso = wizardData.paso;
    
    // Marcar que se intentó enviar
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

    // Validación exitosa: crear planificación
    onFinish();
  }, [wizardData.paso, wizardData.tipo_planificacion, validation, focusFirstInvalidField, onFinish, toast]);

  const renderPaso0 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Contexto del Curso</CardTitle>
        <CardDescription>
          Define el período o la cantidad de sesiones que vas a planificar
        </CardDescription>
      </CardHeader>
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
              onValueChange={(value) => {
                onUpdateContexto({ ...wizardData.contexto, grupo_id: value });
                markFieldAsTouched('grupo_id');
              }}
            >
              <SelectTrigger onBlur={() => markFieldAsTouched('grupo_id')}>
                <SelectValue placeholder="Seleccionar grupo" />
              </SelectTrigger>
              <SelectContent>
                {mockGroups.map((group) => (
                  <SelectItem key={group.id} value={group.name}>
                    {group.name} ({group.studentCount} estudiantes)
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
              onValueChange={(value) => {
                onUpdateContexto({ ...wizardData.contexto, materia: value });
                markFieldAsTouched('materia');
              }}
            >
              <SelectTrigger onBlur={() => markFieldAsTouched('materia')}>
                <SelectValue placeholder="Seleccionar materia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Historia">Historia</SelectItem>
                <SelectItem value="Literatura">Literatura</SelectItem>
                <SelectItem value="Educación para la Ciudadanía">Educación para la Ciudadanía</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>

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

            <p className="text-sm text-muted-foreground">
              Selecciona cómo quieres planificar tu curso
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4 mb-6">
            <div 
              className={cn(
                "border-2 rounded-lg p-4 cursor-pointer transition-all",
                wizardData.tipo_planificacion === 'periodo_especifico' 
                  ? "border-primary bg-primary/5" 
                  : "border-muted hover:border-primary/50"
              )}
              onClick={() => {
                // Limpiar campos del otro tipo
                onUpdateContexto({ 
                  ...wizardData.contexto, 
                  cantidad_sesiones: undefined,
                  duracion_por_sesion: undefined
                });
                
                // Resetear touched de campos irrelevantes
                setTouchedFields(prev => {
                  const newSet = new Set(prev);
                  newSet.delete('cantidad_sesiones');
                  newSet.delete('duracion_por_sesion');
                  return newSet;
                });
                
                // Marcar tipo como touched
                markFieldAsTouched('tipo_planificacion');
                
                // Actualizar tipo
                onUpdateTipoPlanificacion('periodo_especifico');
              }}
            >
              <div className="flex items-center space-x-2 mb-2">
                <input 
                  type="radio" 
                  id="tipo_planificacion"
                  name="tipo-planificacion" 
                  checked={wizardData.tipo_planificacion === 'periodo_especifico'}
                  onChange={() => {}}
                  className="text-primary"
                  aria-invalid={getError('tipo_planificacion') ? 'true' : 'false'}
                />
                <Label className="font-semibold">Período Específico</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Planificar para un período con fechas específicas
              </p>
            </div>

            <div 
              className={cn(
                "border-2 rounded-lg p-4 cursor-pointer transition-all",
                wizardData.tipo_planificacion === 'sin_periodo' 
                  ? "border-primary bg-primary/5" 
                  : "border-muted hover:border-primary/50"
              )}
              onClick={() => {
                // Limpiar campos del otro tipo
                onUpdateContexto({ 
                  ...wizardData.contexto, 
                  fecha_inicio: undefined,
                  fecha_fin: undefined
                });
                
                // Resetear touched de campos irrelevantes
                setTouchedFields(prev => {
                  const newSet = new Set(prev);
                  newSet.delete('fecha_inicio');
                  newSet.delete('fecha_fin');
                  return newSet;
                });
                
                // Marcar tipo como touched
                markFieldAsTouched('tipo_planificacion');
                
                // Actualizar tipo
                onUpdateTipoPlanificacion('sin_periodo');
              }}
            >
              <div className="flex items-center space-x-2 mb-2">
                <input 
                  type="radio" 
                  name="tipo-planificacion" 
                  checked={wizardData.tipo_planificacion === 'sin_periodo'}
                  onChange={() => {}}
                  className="text-primary"
                />
                <Label className="font-semibold">Sin Período Específico</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Planificar por cantidad de sesiones (backlog)
              </p>
            </div>
          </div>

          {/* Campos condicionales según el tipo seleccionado */}
          {wizardData.tipo_planificacion === 'periodo_especifico' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Define el período con fechas específicas
              </p>
              <div className="grid grid-cols-2 gap-4">
                {/* Campo: Fecha de Inicio */}
                <FormField
                  id="fecha_inicio"
                  label="Fecha de Inicio"
                  required
                  error={getError('fecha_inicio')}
                >
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="fecha_inicio"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !wizardData.contexto?.fecha_inicio && "text-muted-foreground"
                        )}
                        onBlur={() => markFieldAsTouched('fecha_inicio')}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {wizardData.contexto?.fecha_inicio ? 
                          format(new Date(wizardData.contexto.fecha_inicio), "PPP", { locale: es }) : 
                          "Seleccionar fecha"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={wizardData.contexto?.fecha_inicio ? new Date(wizardData.contexto.fecha_inicio) : undefined}
                        onSelect={(date) => {
                          const newStartDate = date?.toISOString().split('T')[0] || '';
                          const currentEndDate = wizardData.contexto?.fecha_fin;
                          
                          markFieldAsTouched('fecha_inicio');
                          
                          // Si la nueva fecha de inicio es posterior a la fecha de fin actual, ajustar fecha de fin
                          if (newStartDate && currentEndDate && newStartDate > currentEndDate) {
                            onUpdateContexto({ 
                              ...wizardData.contexto, 
                              fecha_inicio: newStartDate,
                              fecha_fin: newStartDate
                            });
                          } else {
                            onUpdateContexto({ 
                              ...wizardData.contexto, 
                              fecha_inicio: newStartDate
                            });
                          }
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </FormField>

                {/* Campo: Fecha de Fin */}
                <FormField
                  id="fecha_fin"
                  label="Fecha de Fin"
                  required
                  error={getError('fecha_fin')}
                >
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="fecha_fin"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !wizardData.contexto?.fecha_fin && "text-muted-foreground"
                        )}
                        onBlur={() => markFieldAsTouched('fecha_fin')}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {wizardData.contexto?.fecha_fin ? 
                          format(new Date(wizardData.contexto.fecha_fin), "PPP", { locale: es }) : 
                          "Seleccionar fecha"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={wizardData.contexto?.fecha_fin ? new Date(wizardData.contexto.fecha_fin) : undefined}
                        onSelect={(date) => {
                          markFieldAsTouched('fecha_fin');
                          onUpdateContexto({ 
                            ...wizardData.contexto, 
                            fecha_fin: date?.toISOString().split('T')[0] || '' 
                          });
                        }}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          
                          // Deshabilitar fechas antes de hoy
                          if (date < today) return true;
                          
                          // Deshabilitar fechas antes o iguales a la fecha de inicio
                          if (wizardData.contexto?.fecha_inicio) {
                            const startDate = new Date(wizardData.contexto.fecha_inicio);
                            startDate.setHours(0, 0, 0, 0);
                            return date <= startDate;
                          }
                          
                          return false;
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </FormField>
              </div>
            </div>
          )}

          {wizardData.tipo_planificacion === 'sin_periodo' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Especifica la cantidad de sesiones y duración
              </p>
              <div className="grid grid-cols-2 gap-4">
                {/* Campo: Cantidad de Sesiones */}
                <FormField
                  id="cantidad_sesiones"
                  label="Cantidad de Sesiones"
                  required
                  error={getError('cantidad_sesiones')}
                >
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={wizardData.contexto?.cantidad_sesiones || ''}
                    onChange={(e) => {
                      onUpdateContexto({ 
                        ...wizardData.contexto, 
                        cantidad_sesiones: parseInt(e.target.value) || undefined
                      });
                      markFieldAsTouched('cantidad_sesiones');
                    }}
                    onBlur={() => markFieldAsTouched('cantidad_sesiones')}
                    placeholder="Ej: 8"
                  />
                </FormField>

                {/* Campo: Duración por Sesión */}
                <FormField
                  id="duracion_por_sesion"
                  label="Duración por Sesión (min)"
                  required
                  error={getError('duracion_por_sesion')}
                >
                  <Input
                    type="number"
                    min="15"
                    max="240"
                    step="15"
                    value={wizardData.contexto?.duracion_por_sesion || ''}
                    onChange={(e) => {
                      onUpdateContexto({ 
                        ...wizardData.contexto, 
                        duracion_por_sesion: parseInt(e.target.value) || undefined
                      });
                      markFieldAsTouched('duracion_por_sesion');
                    }}
                    onBlur={() => markFieldAsTouched('duracion_por_sesion')}
                    placeholder="Ej: 80"
                  />
                </FormField>
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-4 mt-4">
          <Label htmlFor="objetivos-unidad">Tus Objetivos para esta Unidad (opcional)</Label>
          <Textarea
            id="objetivos-unidad"
            value={wizardData.contexto?.objetivos_unidad || ''}
            onChange={(e) => 
              onUpdateContexto({ 
                ...wizardData.contexto, 
                objetivos_unidad: e.target.value
              })
            }
            placeholder="Describe los objetivos que quieres alcanzar con esta planificación..."
            className="min-h-24"
          />
        </div>
      </CardContent>
    </Card>
  );

  const agregarHorario = () => {
    const nuevaConfig: ConfiguracionHorario = {
      dia: 'lunes',
      horaInicio: '09:00',
      horaFin: '10:00',
      duracionMinutos: 60
    };
    
    const configuracionActual = wizardData.horario?.configuracion || [];
    onUpdateHorario({
      horas_semanales: wizardData.horario?.horas_semanales || 2,
      configuracion: [...configuracionActual, nuevaConfig]
    });
  };

  const eliminarHorario = (index: number) => {
    const configuracionActual = wizardData.horario?.configuracion || [];
    onUpdateHorario({
      horas_semanales: wizardData.horario?.horas_semanales || 2,
      configuracion: configuracionActual.filter((_, i) => i !== index)
    });
  };

  const actualizarHorario = (index: number, campo: keyof ConfiguracionHorario, valor: any) => {
    const configuracionActual = wizardData.horario?.configuracion || [];
    const nuevaConfig = [...configuracionActual];
    nuevaConfig[index] = { ...nuevaConfig[index], [campo]: valor };
    
    onUpdateHorario({
      horas_semanales: wizardData.horario?.horas_semanales || 2,
      configuracion: nuevaConfig
    });
  };

  const renderPaso1 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Horario Real de Clases</CardTitle>
        <CardDescription>
          Configura los días y horarios exactos en que dictarás esta materia
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Campo: Horas Semanales */}
        <FormField
          id="horas_semanales"
          label="Horas Semanales"
          required
          error={getError('horas_semanales')}
        >
          <Input
            type="number"
            min="1"
            max="10"
            value={wizardData.horario?.horas_semanales || ''}
            onChange={(e) => {
              onUpdateHorario({
                configuracion: wizardData.horario?.configuracion || [],
                horas_semanales: parseInt(e.target.value) || 2
              });
              markFieldAsTouched('horas_semanales');
            }}
            onBlur={() => markFieldAsTouched('horas_semanales')}
            placeholder="Ej: 3"
          />
        </FormField>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="space-y-1">
              <Label className={cn(getError('configuracion') && 'text-destructive')}>
                Configuración de Horarios
                <span className="text-destructive ml-1">*</span>
              </Label>
              {getError('configuracion') && (
                <p className="text-sm text-destructive font-medium" role="alert">
                  {getError('configuracion')}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={agregarHorario}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar horario
            </Button>
          </div>

          <div className="space-y-3">
            {(wizardData.horario?.configuracion || []).map((config, index) => {
              const prefix = `configuracion[${index}]`;
              return (
                <div key={index} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {/* Día */}
                    <div className="flex-1">
                      <Select
                        value={config.dia}
                        onValueChange={(value) => {
                          actualizarHorario(index, 'dia', value);
                          markFieldAsTouched(`${prefix}.dia`);
                        }}
                      >
                        <SelectTrigger 
                          id={`${prefix}.dia`}
                          className={cn(
                            "w-32",
                            getError(`${prefix}.dia`) && 'border-destructive focus:ring-destructive'
                          )}
                          aria-invalid={getError(`${prefix}.dia`) ? 'true' : 'false'}
                          onBlur={() => markFieldAsTouched(`${prefix}.dia`)}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lunes">Lunes</SelectItem>
                          <SelectItem value="martes">Martes</SelectItem>
                          <SelectItem value="miércoles">Miércoles</SelectItem>
                          <SelectItem value="jueves">Jueves</SelectItem>
                          <SelectItem value="viernes">Viernes</SelectItem>
                        </SelectContent>
                      </Select>
                      {getError(`${prefix}.dia`) && (
                        <p className="text-xs text-destructive mt-1" role="alert">
                          {getError(`${prefix}.dia`)}
                        </p>
                      )}
                    </div>

                    {/* Hora Inicio */}
                    <div>
                      <Input
                        id={`${prefix}.horaInicio`}
                        type="time"
                        value={config.horaInicio}
                        onChange={(e) => {
                          actualizarHorario(index, 'horaInicio', e.target.value);
                          markFieldAsTouched(`${prefix}.horaInicio`);
                        }}
                        onBlur={() => markFieldAsTouched(`${prefix}.horaInicio`)}
                        className={cn(
                          "w-24",
                          getError(`${prefix}.horaInicio`) && 'border-destructive'
                        )}
                        aria-invalid={getError(`${prefix}.horaInicio`) ? 'true' : 'false'}
                      />
                      {getError(`${prefix}.horaInicio`) && (
                        <p className="text-xs text-destructive mt-1" role="alert">
                          {getError(`${prefix}.horaInicio`)}
                        </p>
                      )}
                    </div>

                    <span className="text-muted-foreground">a</span>

                    {/* Hora Fin */}
                    <div>
                      <Input
                        id={`${prefix}.horaFin`}
                        type="time"
                        value={config.horaFin}
                        onChange={(e) => {
                          actualizarHorario(index, 'horaFin', e.target.value);
                          markFieldAsTouched(`${prefix}.horaFin`);
                        }}
                        onBlur={() => markFieldAsTouched(`${prefix}.horaFin`)}
                        className={cn(
                          "w-24",
                          getError(`${prefix}.horaFin`) && 'border-destructive'
                        )}
                        aria-invalid={getError(`${prefix}.horaFin`) ? 'true' : 'false'}
                      />
                      {getError(`${prefix}.horaFin`) && (
                        <p className="text-xs text-destructive mt-1" role="alert">
                          {getError(`${prefix}.horaFin`)}
                        </p>
                      )}
                    </div>

                    {/* Duración */}
                    <div>
                      <Input
                        id={`${prefix}.duracionMinutos`}
                        type="number"
                        min="15"
                        max="240"
                        step="15"
                        value={config.duracionMinutos}
                        onChange={(e) => {
                          actualizarHorario(index, 'duracionMinutos', parseInt(e.target.value));
                          markFieldAsTouched(`${prefix}.duracionMinutos`);
                        }}
                        onBlur={() => markFieldAsTouched(`${prefix}.duracionMinutos`)}
                        className={cn(
                          "w-20",
                          getError(`${prefix}.duracionMinutos`) && 'border-destructive'
                        )}
                        placeholder="min"
                        aria-invalid={getError(`${prefix}.duracionMinutos`) ? 'true' : 'false'}
                      />
                      {getError(`${prefix}.duracionMinutos`) && (
                        <p className="text-xs text-destructive mt-1" role="alert">
                          {getError(`${prefix}.duracionMinutos`)}
                        </p>
                      )}
                    </div>

                    {/* Botón eliminar */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => eliminarHorario(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderPaso2 = () => (
    <div className="space-y-6">
      {/* Material Docente (Plan-level) - SINGLE materials attach section - BEFORE Resumen */}
      <PlanMaterialsSection
        attachedMaterialIds={wizardData.enfoque?.attachedPlanMaterialIds || []}
        onMaterialsChange={(materialIds) =>
          onUpdateEnfoque({
            ...wizardData.enfoque,
            attachedPlanMaterialIds: materialIds
          })
        }
        disabled={isLoading}
      />

      {/* Unidades Didácticas */}
      {wizardData.contexto?.materia && (
        <div className="space-y-2">
          <UnidadDidacticaBuilder
            materia={wizardData.contexto.materia as Materia}
            unidades={wizardData.enfoque?.unidades_didacticas || []}
            onChange={(unidades) => 
              onUpdateEnfoque({ 
                ...wizardData.enfoque, 
                unidades_didacticas: unidades 
              })
            }
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
            errorCompetencias={getError('competencias_especificas')}
          />
          {getError('unidades_didacticas') && (
            <p className="text-sm text-destructive font-medium" role="alert">
              {getError('unidades_didacticas')}
            </p>
          )}
          
          {/* FIX: Helper text for materials-only generation */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 Podés generar usando solo materiales docentes (sin ANEP). Adjunta materiales usando la sección "Material Docente" más abajo.
            </p>
          </div>
        </div>
      )}

      {/* Distribución de Modalidades */}
      <div className="space-y-2">
        <ModalityDistribution
          distribucion={wizardData.enfoque?.distribucion_modalidades || {
            individual: 25,
            pareja: 25,
            grupos: 25,
            toda_clase: 25
          }}
          onChange={(distribucion) => 
            onUpdateEnfoque({ 
              ...wizardData.enfoque, 
              distribucion_modalidades: distribucion 
            })
          }
        />
        {getError('distribucion_modalidades') && (
          <p className="text-sm text-destructive font-medium" role="alert">
            {getError('distribucion_modalidades')}
          </p>
        )}
      </div>

      {/* A/B/C Validation Error */}
      {getError('generation_requirements') && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-900 dark:text-amber-200 font-medium" role="alert">
            ⚠️ {getError('generation_requirements')}
          </p>
        </div>
      )}

      {/* PHASE 3.1: Tema de cada clase (opcional) */}
      {(() => {
        // Calcular número total de sesiones basado en unidades didácticas
        const unidadesDidacticas = wizardData.enfoque?.unidades_didacticas || [];
        const totalSesiones = unidadesDidacticas.reduce((sum, unidad) => {
          const clasesEstimadas = (unidad.clases_estimadas && unidad.clases_estimadas > 0 && !isNaN(unidad.clases_estimadas))
            ? unidad.clases_estimadas
            : 1;
          return sum + clasesEstimadas;
        }, 0);

        const sessionBriefs = wizardData.enfoque?.sessionBriefs || Array(Math.max(totalSesiones, 0)).fill(undefined);

        return (
          <Card>
            <CardHeader>
              <CardTitle>Tema de cada clase (opcional)</CardTitle>
              <CardDescription className="mt-2">
                Podés indicar el tema o foco de cada clase. Si dejás un campo vacío, la IA definirá automáticamente el tema de esa clase.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {totalSesiones === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Primero definí al menos una unidad didáctica y la cantidad de clases para habilitar estos campos.
                </p>
              ) : (
                Array.from({ length: totalSesiones }, (_, index) => {
                  const sessionNumber = index + 1;
                  return (
                    <div key={index} className="space-y-2">
                      <Label htmlFor={`session-brief-${index}`}>
                        Clase {sessionNumber} – Tema de la clase
                      </Label>
                      <Input
                        id={`session-brief-${index}`}
                        type="text"
                        value={sessionBriefs[index] || ''}
                        onChange={(e) => {
                          const newBriefs = [...sessionBriefs];
                          const trimmedValue = e.target.value.trim();
                          newBriefs[index] = trimmedValue || undefined;
                          onUpdateEnfoque({
                            ...wizardData.enfoque,
                            sessionBriefs: newBriefs
                          });
                        }}
                        placeholder="Ej: Surgimiento y contexto histórico del Batllismo"
                        className="w-full"
                      />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Requerimientos del Docente */}
      <Card>
        <CardHeader>
          <CardTitle>Requerimientos del Docente para la Planificación</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanningTextArea
            value={wizardData.enfoque?.requerimientos_docente || ''}
            onChange={(value) => 
              onUpdateEnfoque({ 
                ...wizardData.enfoque, 
                requerimientos_docente: value 
              })
            }
            placeholder="Describe cualquier requerimiento específico que tengas para esta planificación (opcional)..."
            minHeight="min-h-24"
          />
        </CardContent>
      </Card>

      {/* Estrategias de Diferenciación */}
      <Card>
        <CardHeader>
          <CardTitle>Estrategias de Diferenciación</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanningTextArea
            value={wizardData.enfoque?.estrategias_diferenciacion || ''}
            onChange={(value) => 
              onUpdateEnfoque({ 
                ...wizardData.enfoque, 
                estrategias_diferenciacion: value 
              })
            }
            placeholder="Describe las estrategias de diferenciación que te gustaría implementar (espacios físicos, diferenciación cognitiva, centros de motivación, etc.)..."
            minHeight="min-h-24"
          />
        </CardContent>
      </Card>
    </div>
  );

  const renderPaso3 = () => (
    <Card>
      <CardHeader>
        <CardTitle>Confirmación</CardTitle>
        <CardDescription>
          Revisa la configuración antes de crear tu planificación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium">Contexto</h4>
            <p className="text-sm text-muted-foreground">
              {wizardData.contexto?.grupo_id} - {wizardData.contexto?.materia}
            </p>
            <p className="text-sm text-muted-foreground">
              {wizardData.contexto?.fecha_inicio} al {wizardData.contexto?.fecha_fin}
            </p>
          </div>
          
          <div>
            <h4 className="font-medium">Horario</h4>
            <p className="text-sm text-muted-foreground">
              {wizardData.horario?.horas_semanales} horas semanales
            </p>
            <p className="text-sm text-muted-foreground">
              {(wizardData.horario?.configuracion || []).length} slots configurados
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-medium">Unidades Didácticas</h4>
          <p className="text-sm text-muted-foreground">
            {wizardData.enfoque?.unidades_didacticas?.length || 0} unidades creadas
          </p>
          <p className="text-sm text-muted-foreground">
            {wizardData.enfoque?.unidades_didacticas?.reduce((total, unidad) => total + unidad.clases_estimadas, 0) || 0} clases planificadas
          </p>
        </div>

        <div>
          <h4 className="font-medium">Modalidades de Trabajo</h4>
          <p className="text-sm text-muted-foreground">
            Individual: {wizardData.enfoque?.distribucion_modalidades?.individual || 0}%, 
            Parejas: {wizardData.enfoque?.distribucion_modalidades?.pareja || 0}%, 
            Grupos: {wizardData.enfoque?.distribucion_modalidades?.grupos || 0}%, 
            Toda la clase: {wizardData.enfoque?.distribucion_modalidades?.toda_clase || 0}%
          </p>
        </div>

        {wizardData.enfoque?.requerimientos_docente && (
          <div>
            <h4 className="font-medium">Requerimientos del Docente</h4>
            <p className="text-sm text-muted-foreground">
              {wizardData.enfoque.requerimientos_docente}
            </p>
          </div>
        )}

        {wizardData.enfoque?.estrategias_diferenciacion && (
          <div>
            <h4 className="font-medium">Estrategias de Diferenciación</h4>
            <p className="text-sm text-muted-foreground">
              {wizardData.enfoque.estrategias_diferenciacion}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center space-x-2">
        {[0, 1, 2, 3].map((paso) => (
          <div
            key={paso}
            className={cn(
              "h-2 w-8 rounded-full transition-colors",
              paso <= wizardData.paso ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Content */}
      {wizardData.paso === 0 && renderPaso0()}
      {wizardData.paso === 1 && renderPaso1()}
      {wizardData.paso === 2 && renderPaso2()}
      {wizardData.paso === 3 && renderPaso3()}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={wizardData.paso === 0 || isLoading}
        >
          Anterior
        </Button>

        {wizardData.paso < 3 ? (
          <Button
            onClick={handleNext}
            disabled={isLoading}
          >
            Siguiente
          </Button>
        ) : (
          <Button
            onClick={handleFinish}
            disabled={isLoading}
          >
            {isLoading ? 'Creando...' : 'Crear Planificación'}
          </Button>
        )}
      </div>
    </div>
  );
};