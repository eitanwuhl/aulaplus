import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BacklogSesiones } from '@/components/planificacion/BacklogSesiones';
import { CalendarioDnD } from '@/components/planificacion/CalendarioDnD';
import { EditorSesionNuevo } from '@/components/planificacion/EditorSesionNuevo';
import { useCalendarioSesiones } from '@/hooks/useCalendarioSesiones';
import { Planificacion, SesionClase, DistribucionModalidades, ConfiguracionHorario } from '@/types/planificacion';
import { supabase } from '@/integrations/supabase/client';

export default function PlanificacionWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [planificacion, setPlanificacion] = useState<Planificacion | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [competenciasDelPeriodo, setCompetenciasDelPeriodo] = useState<string[]>([]);
  
  const {
    sesiones,
    sesionSeleccionada,
    mesActual,
    isLoading,
    setSesionSeleccionada,
    cargarSesiones,
    actualizarSesion,
    marcarExcepcion,
    cambiarMes
  } = useCalendarioSesiones(id);

  // Cargar planificación
  useEffect(() => {
    const cargarPlanificacion = async () => {
      if (!id) {
        console.log('No hay ID de planificación');
        return;
      }
      
      console.log('Cargando planificación con ID:', id);
      setIsLoadingPlan(true);
      try {
        const { data, error } = await supabase
          .from('planificaciones')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        console.log('Datos de planificación:', data);
        console.log('Error de planificación:', error);

        if (error) throw error;
        
        if (!data) {
          toast({
            title: "Error",
            description: "No se encontró la planificación solicitada",
            variant: "destructive"
          });
          navigate('/planificacion');
          return;
        }
        
        // Convertir tipos JSON a TypeScript tipos
        const planificacionConverted = {
          ...data,
          distribucion_modalidades: data.distribucion_modalidades as unknown as DistribucionModalidades,
          unidades_didacticas: (data.unidades_didacticas as any) || [],
          configuracion_horario: data.configuracion_horario as unknown as ConfiguracionHorario[],
          fecha_inicio: data.fecha_inicio || undefined,
          fecha_fin: data.fecha_fin || undefined
        };
        
        // Calcular competencias del período desde unidades didácticas
        const competenciasUnicas = new Set<string>();
        if (planificacionConverted.unidades_didacticas && Array.isArray(planificacionConverted.unidades_didacticas)) {
          planificacionConverted.unidades_didacticas.forEach((unidad: any) => {
            if (unidad.competencias_ids && Array.isArray(unidad.competencias_ids)) {
              unidad.competencias_ids.forEach((comp: string) => competenciasUnicas.add(comp));
            }
          });
        }
        setCompetenciasDelPeriodo(Array.from(competenciasUnicas));
        
        setPlanificacion(planificacionConverted as unknown as Planificacion);
      } catch (error) {
        console.error('Error cargando planificación:', error);
        toast({
          title: "Error",
          description: "No se pudo cargar la planificación",
          variant: "destructive"
        });
        navigate('/planificacion');
      } finally {
        setIsLoadingPlan(false);
      }
    };

    cargarPlanificacion();
  }, [id, navigate, toast]);

  // Recargar sesiones cada 5 segundos si no hay planes generados
  useEffect(() => {
    if (!id) return;

    const interval = setInterval(() => {
      // Solo recargar si hay sesiones sin plan
      const sesionesSinPlan = sesiones.filter(s => !s.plan_desarrollo?.html_completo);
      if (sesionesSinPlan.length > 0) {
        console.log('Recargando sesiones para detectar planes generados...');
        cargarSesiones();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id, sesiones, cargarSesiones]);

  // Handlers para DnD
  const handleAgendarSesion = async (sesionId: string, fecha: string) => {
    await actualizarSesion(sesionId, { fecha, estado: 'planificada' });
  };

  const handleMoverSesion = async (sesionId: string, nuevaFecha: string) => {
    await actualizarSesion(sesionId, { fecha: nuevaFecha });
  };

  const handleMarcarDictada = async (sesionId: string) => {
    await actualizarSesion(sesionId, { estado: 'dictada' });
  };

  const handlePausarSesion = async (sesionId: string) => {
    await actualizarSesion(sesionId, { fecha: null, estado: 'pausada' });
  };

  const handleOmitirSesion = async (sesionId: string, motivo: string) => {
    await marcarExcepcion(sesionId, motivo);
  };

  const handleToggleLock = async (sesionId: string) => {
    const sesion = sesiones.find(s => s.id === sesionId);
    if (sesion) {
      await actualizarSesion(sesionId, { bloqueo_reserva: !sesion.bloqueo_reserva });
    }
  };

  const handleSesionSelect = (sesion: SesionClase) => {
    console.log('=== SESIÓN SELECCIONADA EN WORKSPACE ===');
    console.log('Sesión recibida:', sesion);
    console.log('ID de sesión:', sesion.id);
    console.log('Fecha de sesión:', sesion.fecha);
    console.log('Estado de sesión:', sesion.estado);
    console.log('Plan desarrollo:', sesion.plan_desarrollo);
    console.log('HTML completo:', sesion.plan_desarrollo?.html_completo);
    console.log('Argumento competencias:', sesion.argumento_competencias);
    console.log('Recursos:', sesion.recursos);
    console.log('========================================');
    setSesionSeleccionada(sesion);
  };

  const handleActualizarSesion = async (updates: Partial<SesionClase>) => {
    if (!sesionSeleccionada?.id) return;
    await actualizarSesion(sesionSeleccionada.id, updates);
  };

  const handleExportarExcel = () => {
    toast({
      title: "Exportando...",
      description: "Generando archivo Excel de la planificación",
    });
  };

  if (isLoadingPlan) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando planificación...</p>
        </div>
      </div>
    );
  }

  if (!planificacion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-muted-foreground mb-4">No se pudo cargar la planificación</p>
          <Button onClick={() => navigate('/planificacion')}>
            Volver a Planificaciones
          </Button>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className="min-h-screen bg-background">
        
        {/* Header */}
        <div className="border-b bg-card px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/planificacion')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              
              <div>
                <h1 className="text-xl font-bold">
                  {planificacion.materia} - {planificacion.grupo_id}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {planificacion.fecha_inicio && planificacion.fecha_fin
                    ? `${new Date(planificacion.fecha_inicio).toLocaleDateString('es-ES')} - ${new Date(planificacion.fecha_fin).toLocaleDateString('es-ES')}`
                    : 'Planificación flexible (sin fechas fijas)'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportarExcel}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configuración
              </Button>
            </div>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="container mx-auto py-6">
          <div className="grid grid-cols-12 gap-6">
            
            {/* Backlog (3 columnas) */}
            <div className="col-span-3">
              <BacklogSesiones
                sesiones={sesiones}
                onSesionSelect={handleSesionSelect}
                sesionSeleccionada={sesionSeleccionada}
              />
            </div>

            {/* Calendario (4 columnas) */}
            <div className="col-span-4">
              <CalendarioDnD
                mesActual={mesActual}
                sesiones={sesiones}
                onCambiarMes={cambiarMes}
                onAgendarSesion={handleAgendarSesion}
                onMoverSesion={handleMoverSesion}
                onMarcarDictada={handleMarcarDictada}
                onPausarSesion={handlePausarSesion}
                onOmitirSesion={handleOmitirSesion}
                onToggleLock={handleToggleLock}
                onSesionSelect={handleSesionSelect}
              />
            </div>

            {/* Editor de Sesión (5 columnas) */}
            <div className="col-span-5">
              <EditorSesionNuevo
                sesion={sesionSeleccionada}
                onActualizar={handleActualizarSesion}
                competenciasDelPeriodo={competenciasDelPeriodo}
                planificacionId={planificacion?.id}
                materia={planificacion?.materia}
                nivel={planificacion?.nivel}
              />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error renderizando PlanificacionWorkspace:', error);
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error de Renderizado</h2>
          <p className="text-muted-foreground mb-4">
            Ocurrió un error al mostrar la planificación: {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
          <Button onClick={() => navigate('/planificacion')}>
            Volver a Planificaciones
          </Button>
        </div>
      </div>
    );
  }
}