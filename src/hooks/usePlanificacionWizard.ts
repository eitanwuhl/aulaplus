import { useState, useCallback } from 'react';
import { WizardData, ConfiguracionHorario } from '@/types/planificacion';
import { ValidationResult, FieldError } from '@/types/validation';

export const usePlanificacionWizard = () => {
  const [wizardData, setWizardData] = useState<WizardData>({
    paso: 0
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePaso = useCallback((paso: WizardData['paso']) => {
    setWizardData(prev => ({ ...prev, paso }));
  }, []);

  const updateContexto = useCallback((contexto: WizardData['contexto']) => {
    setWizardData(prev => ({ ...prev, contexto }));
  }, []);

  const updateHorario = useCallback((horario: WizardData['horario']) => {
    setWizardData(prev => ({ ...prev, horario }));
  }, []);

  const updateEnfoque = useCallback((enfoque: WizardData['enfoque']) => {
    setWizardData(prev => ({ ...prev, enfoque }));
  }, []);

  const updateTipoPlanificacion = useCallback((tipo: 'periodo_especifico' | 'sin_periodo') => {
    setWizardData(prev => ({ ...prev, tipo_planificacion: tipo }));
  }, []);

  const validarPaso = useCallback((paso: number): ValidationResult => {
    const errors: FieldError[] = [];
    let firstInvalidField: string | undefined;

    switch (paso) {
      case 0: {
        // Validar grupo_id
        if (!wizardData.contexto?.grupo_id) {
          errors.push({
            fieldId: 'grupo_id',
            message: 'Grupo a evaluar es obligatorio',
            type: 'required'
          });
          if (!firstInvalidField) firstInvalidField = 'grupo_id';
        }

        // Validar materia
        if (!wizardData.contexto?.materia) {
          errors.push({
            fieldId: 'materia',
            message: 'Materia es obligatoria',
            type: 'required'
          });
          if (!firstInvalidField) firstInvalidField = 'materia';
        }

        // Validar tipo_planificacion
        if (!wizardData.tipo_planificacion) {
          errors.push({
            fieldId: 'tipo_planificacion',
            message: 'Debes seleccionar un tipo de planificación',
            type: 'required'
          });
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

  const generarSesionesEsquema = useCallback((): Date[] => {
    if (!wizardData.contexto || !wizardData.horario) return [];

    const fechas: Date[] = [];
    const inicio = new Date(wizardData.contexto.fecha_inicio);
    const fin = new Date(wizardData.contexto.fecha_fin);
    
    // Mapear días de la semana
    const diasSemana = {
      'lunes': 1,
      'martes': 2,
      'miércoles': 3,
      'jueves': 4,
      'viernes': 5
    };

    const fechaActual = new Date(inicio);
    
    while (fechaActual <= fin) {
      const diaActual = fechaActual.getDay();
      
      // Verificar si hay clase este día
      const hayClase = wizardData.horario.configuracion.some(config => 
        diasSemana[config.dia] === diaActual
      );
      
      if (hayClase) {
        fechas.push(new Date(fechaActual));
      }
      
      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    return fechas;
  }, [wizardData.contexto, wizardData.horario]);

  const reiniciarWizard = useCallback(() => {
    setWizardData({ paso: 0 });
    setError(null);
  }, []);

  const isDataComplete = useCallback(() => {
    const validacion = validarPaso(3);
    return validacion.valid;
  }, [validarPaso]);

  return {
    wizardData,
    isLoading,
    error,
    updatePaso,
    updateContexto,
    updateHorario,
    updateEnfoque,
    updateTipoPlanificacion,
    validarPaso,
    generarSesionesEsquema,
    reiniciarWizard,
    isDataComplete,
    setIsLoading,
    setError
  };
};