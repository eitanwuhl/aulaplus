import React, { useMemo } from 'react';
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
import { Materia } from '@/data/catalogo';

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

  // Helper function to get error message for a specific field
  const getError = (fieldId: string): string | undefined => {
    const error = validation.errors.find(e => e.fieldId === fieldId);
    return error?.message;
  };

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
              onValueChange={(value) => 
                onUpdateContexto({ ...wizardData.contexto, grupo_id: value })
              }
            >
              <SelectTrigger>
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
                        onSelect={(date) => 
                          onUpdateContexto({ 
                            ...wizardData.contexto, 
                            fecha_fin: date?.toISOString().split('T')[0] || '' 
                          })
                        }
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
                    onChange={(e) => 
                      onUpdateContexto({ 
                        ...wizardData.contexto, 
                        cantidad_sesiones: parseInt(e.target.value) || undefined
                      })
                    }
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
                    onChange={(e) => 
                      onUpdateContexto({ 
                        ...wizardData.contexto, 
                        duracion_por_sesion: parseInt(e.target.value) || undefined
                      })
                    }
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
        <div>
          <Label htmlFor="horas">Horas Semanales *</Label>
          <Input
            id="horas"
            type="number"
            min="1"
            max="10"
            value={wizardData.horario?.horas_semanales || ''}
            onChange={(e) => 
              onUpdateHorario({
                configuracion: wizardData.horario?.configuracion || [],
                horas_semanales: parseInt(e.target.value) || 2
              })
            }
            placeholder="Ej: 3"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Configuración de Horarios *</Label>
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
            {(wizardData.horario?.configuracion || []).map((config, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                <Select
                  value={config.dia}
                  onValueChange={(value) => actualizarHorario(index, 'dia', value)}
                >
                  <SelectTrigger className="w-32">
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

                <Input
                  type="time"
                  value={config.horaInicio}
                  onChange={(e) => actualizarHorario(index, 'horaInicio', e.target.value)}
                  className="w-24"
                />

                <span className="text-muted-foreground">a</span>

                <Input
                  type="time"
                  value={config.horaFin}
                  onChange={(e) => actualizarHorario(index, 'horaFin', e.target.value)}
                  className="w-24"
                />

                <Input
                  type="number"
                  min="15"
                  max="240"
                  step="15"
                  value={config.duracionMinutos}
                  onChange={(e) => actualizarHorario(index, 'duracionMinutos', parseInt(e.target.value))}
                  className="w-20"
                  placeholder="min"
                />

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
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderPaso2 = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Enfoque Pedagógico</CardTitle>
          <CardDescription>
            Define competencias, contenidos y preferencias metodológicas para este período
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Unidades Didácticas */}
      {wizardData.contexto?.materia && (
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
            wizardData.horario && wizardData.contexto?.fecha_inicio && wizardData.contexto?.fecha_fin
              ? Math.floor(
                  (new Date(wizardData.contexto.fecha_fin).getTime() - 
                   new Date(wizardData.contexto.fecha_inicio).getTime()) / 
                  (1000 * 60 * 60 * 24 * 7)
                ) * wizardData.horario.horas_semanales
              : 0
          }
        />
      )}

      {/* Distribución de Modalidades */}
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

      {/* TODO: Will be removed - inline errors now shown per field */}
      {/* Global validation banner temporarily commented while migration in progress */}

      {/* Navigation buttons */}
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
            onClick={onNext}
            disabled={!validation.valid || isLoading}
          >
            Siguiente
          </Button>
        ) : (
          <Button
            onClick={onFinish}
            disabled={!validation.valid || isLoading}
          >
            {isLoading ? 'Creando...' : 'Crear Planificación'}
          </Button>
        )}
      </div>
    </div>
  );
};