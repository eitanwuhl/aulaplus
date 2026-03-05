import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SesionClase, Planificacion } from '@/types/planificacion';
import { useToast } from '@/hooks/use-toast';
import { normalizeSessionArrayFields } from '@/lib/normalizeSupabaseArrays';

export const useCalendarioSesiones = (planificacionId?: string) => {
  const DEBUG_SESIONES = import.meta.env.DEV && (window as any).__PLAN_SESIONES_DEBUG__ === true;
  const [sesiones, setSesiones] = useState<SesionClase[]>([]);
  const [sesionSeleccionada, setSesionSeleccionada] = useState<SesionClase | null>(null);
  const [mesActual, setMesActual] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Cargar sesiones de la planificación
  const cargarSesiones = useCallback(async () => {
    if (!planificacionId) {
      if (DEBUG_SESIONES) console.log('[useCalendarioSesiones] No hay planificacionId para cargar sesiones');
      return;
    }
    
    if (DEBUG_SESIONES) console.log('[useCalendarioSesiones] Cargando sesiones para planificación:', planificacionId);
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sesiones_clase')
        .select('*')
        .eq('planificacion_id', planificacionId)
        .order('fecha', { ascending: true });

      if (DEBUG_SESIONES) {
        console.log('[useCalendarioSesiones] Resultado sesiones', {
          planificacionId,
          count: Array.isArray(data) ? data.length : 0,
          hasError: !!error
        });
      }

      if (error) throw error;
      
      setSesiones((data || []) as unknown as SesionClase[]);
    } catch (error) {
      console.error('Error cargando sesiones:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las sesiones de clase",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [planificacionId, toast, DEBUG_SESIONES]);

  // Crear sesiones iniciales basadas en el horario
  const crearSesionesIniciales = useCallback(async (
    planificacion: Planificacion, 
    fechasSesiones: Date[]
  ) => {
    setIsLoading(true);
    try {
      const sesionesACrear = fechasSesiones.map((fecha, index) => {
        // Calcular duración basada en la configuración del día
        const diaSemana = fecha.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
        const configDia = planificacion.configuracion_horario.find(
          config => config.dia === diaSemana
        );
        const duracion = configDia?.duracionMinutos || 60;

        return {
          planificacion_id: planificacion.id,
          fecha: fecha.toISOString().split('T')[0],
          duracion_minutos: duracion,
          competencias_anep: [],
          contenidos_anep: [],
          criterios_logro_anep: [],
          plan_desarrollo: {},
          evaluacion: { tipo: 'observacion' as const },
          recursos: [],
          estado: 'planificada' as const,
          es_feriado: false,
          orden: index,
          bloqueo_reserva: false
        };
      });

      const { data, error } = await supabase
        .from('sesiones_clase')
        .insert(sesionesACrear)
        .select();

      if (error) throw error;

      setSesiones((data || []) as unknown as SesionClase[]);
      
      toast({
        title: "Sesiones creadas",
        description: `Se crearon ${data?.length || 0} sesiones en el calendario`,
      });

    } catch (error) {
      console.error('Error creando sesiones:', error);
      toast({
        title: "Error",
        description: "No se pudieron crear las sesiones iniciales",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Actualizar sesión
  const actualizarSesion = useCallback(async (
    sesionId: string, 
    updates: Partial<SesionClase>
  ) => {
    setIsLoading(true);
    try {
      // Normalizar arrays antes de enviar a Supabase
      const normalizedUpdates = normalizeSessionArrayFields(updates as any);
      
      const { data, error } = await supabase
        .from('sesiones_clase')
        .update(normalizedUpdates as any)
        .eq('id', sesionId)
        .select()
        .single();

      if (error) throw error;

      setSesiones(prev => prev.map(s => s.id === sesionId ? data as unknown as SesionClase : s));
      
      if (sesionSeleccionada?.id === sesionId) {
        setSesionSeleccionada(data as unknown as SesionClase);
      }

      // No mostrar toast para autosave (actualizaciones frecuentes)
      if (Object.keys(updates).length > 1) {
        toast({
          title: "Sesión actualizada",
          description: "Los cambios se guardaron correctamente",
        });
      }

    } catch (error) {
      console.error('Error actualizando sesión:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sesionSeleccionada?.id, toast]);

  // Marcar sesión como feriado/excepción
  const marcarExcepcion = useCallback(async (
    sesionId: string,
    motivo: string,
    esFeriado: boolean = false
  ) => {
    await actualizarSesion(sesionId, {
      estado: 'omitida',
      es_feriado: esFeriado,
      motivo_excepcion: motivo
    });
  }, [actualizarSesion]);

  // Obtener sesiones del mes actual
  const getSesionesMes = useCallback((mes: Date = mesActual) => {
    const inicioMes = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const finMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    
    return sesiones.filter(sesion => {
      const fechaSesion = new Date(sesion.fecha);
      return fechaSesion >= inicioMes && fechaSesion <= finMes;
    });
  }, [sesiones, mesActual]);

  // Obtener alertas de sesiones
  const getAlertasSesiones = useCallback(() => {
    const alertas = {
      sinCompetencias: sesiones.filter(s => s.competencias_anep.length === 0 && s.estado === 'backlog').length,
      sinPlan: sesiones.filter(s => !s.plan_desarrollo?.desarrollo && s.estado === 'backlog').length,
      proximasValidacion: sesiones.filter(s => {
        if (s.estado !== 'planificada' || !s.fecha) return false;
        const fechaSesion = new Date(s.fecha);
        const hoy = new Date();
        const diferenciaDias = Math.ceil((fechaSesion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        return diferenciaDias <= 3 && diferenciaDias >= 0;
      }).length
    };
    
    return alertas;
  }, [sesiones]);

  // Cambiar mes del calendario
  const cambiarMes = useCallback((direccion: 1 | -1) => {
    setMesActual(prev => {
      const nuevoMes = new Date(prev);
      nuevoMes.setMonth(prev.getMonth() + direccion);
      return nuevoMes;
    });
  }, []);

  // Efecto para cargar sesiones al cambiar planificación
  useEffect(() => {
    if (planificacionId) {
      cargarSesiones();
    }
  }, [planificacionId, cargarSesiones]);

  return {
    sesiones,
    sesionSeleccionada,
    mesActual,
    isLoading,
    setSesionSeleccionada,
    cargarSesiones,
    crearSesionesIniciales,
    actualizarSesion,
    marcarExcepcion,
    getSesionesMes,
    getAlertasSesiones,
    cambiarMes,
    setMesActual
  };
};