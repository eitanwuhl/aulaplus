import { useState, useCallback } from 'react';
import { WizardData } from '@/types/planificacion';
import { validateWizardStep } from '@/lib/planificacion/wizardValidation';
import { generateSessionDatesFromSchedule } from '@/lib/planificacion/sessionSchedule';

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

  const replaceWizardData = useCallback((data: WizardData) => {
    setWizardData(data);
  }, []);

  const setProgramaId = useCallback((programaId: string | undefined) => {
    setWizardData((prev) => ({ ...prev, programa_id: programaId }));
  }, []);

  const validarPaso = useCallback(
    (paso: number) => validateWizardStep(wizardData, paso),
    [wizardData]
  );

  const generarSesionesEsquema = useCallback((): Date[] => {
    if (!wizardData.contexto?.fecha_inicio || !wizardData.contexto?.fecha_fin || !wizardData.horario) {
      return [];
    }
    return generateSessionDatesFromSchedule({
      fecha_inicio: wizardData.contexto.fecha_inicio,
      fecha_fin: wizardData.contexto.fecha_fin,
      configuracion: wizardData.horario.configuracion,
    });
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
    replaceWizardData,
    setProgramaId,
    validarPaso,
    generarSesionesEsquema,
    reiniciarWizard,
    isDataComplete,
    setIsLoading,
    setError
  };
};