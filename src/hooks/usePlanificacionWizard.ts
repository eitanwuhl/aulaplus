import { useState, useCallback } from 'react';
import { WizardData, ConfiguracionHorario } from '@/types/planificacion';

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

  const validarPaso = useCallback((paso: number): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    switch (paso) {
      case 0:
        if (!wizardData.contexto?.grupo_id) errors.push('Grupo a evaluar es obligatorio');
        if (!wizardData.contexto?.materia) errors.push('Materia es obligatoria');
        if (!wizardData.tipo_planificacion) errors.push('Debes seleccionar un tipo de planificación');
        
        // Validar según el tipo seleccionado
        if (wizardData.tipo_planificacion === 'periodo_especifico') {
          const tienePeriodo = wizardData.contexto?.fecha_inicio && wizardData.contexto?.fecha_fin;
          if (!tienePeriodo) {
            errors.push('Debes seleccionar fecha de inicio y fecha de fin para planificación con período específico');
          } else {
            // Validar orden de fechas
            const inicio = new Date(wizardData.contexto.fecha_inicio!);
            const fin = new Date(wizardData.contexto.fecha_fin!);
            if (inicio >= fin) {
              errors.push('La fecha de fin debe ser posterior a la fecha de inicio');
            }
          }
        } else if (wizardData.tipo_planificacion === 'sin_periodo') {
          const tieneCantidadDuracion = 
            wizardData.contexto?.cantidad_sesiones && 
            wizardData.contexto.cantidad_sesiones > 0 &&
            wizardData.contexto?.duracion_por_sesion &&
            wizardData.contexto.duracion_por_sesion > 0;
          
          if (!tieneCantidadDuracion) {
            errors.push('Debes indicar cantidad de sesiones y duración por sesión para planificación sin período específico');
          }
        }
        break;

      case 1:
        if (!wizardData.horario?.horas_semanales || wizardData.horario.horas_semanales < 1) {
          errors.push('Debe indicar al menos 1 hora semanal');
        }
        if (!wizardData.horario?.configuracion || wizardData.horario.configuracion.length === 0) {
          errors.push('Debe configurar al menos un horario de clase');
        }
        break;

      case 2:
        if (!wizardData.enfoque?.unidades_didacticas || wizardData.enfoque.unidades_didacticas.length === 0) {
          errors.push('Crea al menos una unidad didáctica');
        }
        
        if (wizardData.enfoque?.unidades_didacticas) {
          const unidadesSinContenido = wizardData.enfoque.unidades_didacticas.filter(u => !u.contenido_id);
          if (unidadesSinContenido.length > 0) {
            errors.push(`${unidadesSinContenido.length} unidades sin contenido seleccionado`);
          }
          
          const unidadesSinCompetencias = wizardData.enfoque.unidades_didacticas.filter(u => u.competencias_ids.length === 0);
          if (unidadesSinCompetencias.length > 0) {
            errors.push(`${unidadesSinCompetencias.length} unidades sin competencias asignadas`);
          }
        }
        
        if (wizardData.enfoque?.distribucion_modalidades) {
          const total = Object.values(wizardData.enfoque.distribucion_modalidades).reduce((sum, val) => sum + val, 0);
          if (total !== 100) {
            errors.push('La distribución de modalidades debe sumar exactamente 100%');
          }
        }
        break;

      case 3:
        // Validación final - todos los pasos anteriores deben estar completos
        const paso0 = validarPaso(0);
        const paso1 = validarPaso(1);
        const paso2 = validarPaso(2);
        
        errors.push(...paso0.errors, ...paso1.errors, ...paso2.errors);
        break;
    }

    return { valid: errors.length === 0, errors };
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