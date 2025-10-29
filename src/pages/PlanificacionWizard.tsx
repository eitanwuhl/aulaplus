import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { usePlanificacionWizard } from '@/hooks/usePlanificacionWizard';
import { useFullSessionGeneration } from '@/hooks/useFullSessionGeneration';
import { WizardSteps } from '@/components/planificacion/WizardSteps';
import { supabase } from '@/integrations/supabase/client';
import {
  extractCompetenciesFromUnits,
  extractContenidosFromUnits,
  buildCompetenciasContenidosMap,
} from '@/lib/competencyExtractor';
import { normalizeArrayField } from '@/lib/normalizeSupabaseArrays';

// Función para generar automáticamente los planes de todas las sesiones
const generarPlanesAutomaticamente = async (planificacionId: string, materia: string, nivel: string) => {
  try {
    console.log('Iniciando generación automática de planes...');
    
    // Obtener la planificación completa con sus datos
    const { data: planificacion, error: planificacionError } = await supabase
      .from('planificaciones')
      .select('*')
      .eq('id', planificacionId)
      .single();

    if (planificacionError) {
      console.error('Error obteniendo planificación:', planificacionError);
      return;
    }

    // Obtener todas las sesiones de la planificación
    const { data: sesiones, error: sesionesError } = await supabase
      .from('sesiones_clase')
      .select('*')
      .eq('planificacion_id', planificacionId)
      .order('orden');

    if (sesionesError) {
      console.error('Error obteniendo sesiones:', sesionesError);
      return;
    }

    if (!sesiones || sesiones.length === 0) {
      console.log('No hay sesiones para generar planes');
      return;
    }

    console.log(`Generando planes para ${sesiones.length} sesiones...`);

    // Usar los datos de la planificación para todas las sesiones
    const contenidos = planificacion.contenidos_programa || [];
    const competencias = planificacion.competencias_seleccionadas || [];
    const criterios = planificacion.mapeo_competencias_contenidos || [];

    console.log('Datos de la planificación:', {
      contenidos,
      competencias,
      criterios,
      materia,
      nivel
    });
    
    // Delay inicial para resetear rate limit
    console.log('Esperando 2 segundos antes de iniciar la generación...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generar plan para cada sesión con reintentos
    for (let i = 0; i < sesiones.length; i++) {
      const sesion = sesiones[i];
      
      // Asignar competencias específicas a esta sesión (distribuir entre sesiones)
      const competenciasPorSesion = Math.ceil(competencias.length / sesiones.length);
      const inicioCompetencias = (sesion.orden - 1) * competenciasPorSesion;
      const finCompetencias = Math.min(inicioCompetencias + competenciasPorSesion, competencias.length);
      const competenciasSesion = competencias.slice(inicioCompetencias, finCompetencias);

      console.log(`Sesión ${sesion.orden}: Competencias asignadas:`, competenciasSesion);
      console.log(`Total competencias: ${competencias.length}, Competencias por sesión: ${competenciasPorSesion}`);
      console.log(`Rango para sesión ${sesion.orden}: ${inicioCompetencias} a ${finCompetencias}`);
      
      // Delay inicial entre sesiones para evitar rate limiting
      if (i > 0) {
        console.log(`Esperando 3 segundos antes de procesar sesión ${sesion.orden}...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      let intentos = 0;
      const maxIntentos = 3;
      
      while (intentos < maxIntentos) {
        try {
          const payload = {
            modo: 'generar_plan_html',
            sesionId: sesion.id,
            orden: sesion.orden,
            duracionMin: sesion.duracion_minutos,
            materia: materia || 'Sin especificar',
            nivel: nivel || 'Sin especificar',
            contenidos: contenidos,
            competencias: competenciasSesion, // Usar competencias específicas de esta sesión
            criterios: criterios,
            instruccionesDocente: undefined
          };

          console.log(`Generando plan para sesión ${sesion.orden} (intento ${intentos + 1}/${maxIntentos}) con payload:`, payload);

          // Agregar timeout de 30 segundos
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout después de 30 segundos')), 30000)
          );

          const functionPromise = supabase.functions.invoke('generate-plan-completo', {
            body: payload
          });

          const { data, error } = await Promise.race([functionPromise, timeoutPromise]) as any;

          console.log(`Respuesta para sesión ${sesion.orden}:`, { data, error });

          if (error) {
            console.error(`Error generando plan para sesión ${sesion.orden}:`, error);
            throw new Error(`Error en sesión ${sesion.orden}: ${error.message}`);
          }

          if (!data) {
            console.error(`Sin datos para sesión ${sesion.orden}`);
            throw new Error(`Sin datos para sesión ${sesion.orden}`);
          }

          if (!data.plan_html || !data.plan_html.includes('<section id="plan">')) {
            console.error(`Respuesta inválida para sesión ${sesion.orden}:`, data);
            throw new Error(`Respuesta inválida para sesión ${sesion.orden}`);
          }

          // Actualizar la sesión con el plan generado
          console.log(`Guardando competencias para sesión ${sesion.orden}:`, competenciasSesion);
          const { error: updateError } = await supabase
            .from('sesiones_clase')
            .update({
              plan_desarrollo: { html_completo: data.plan_html },
              argumento_competencias: data.argumento_competencias,
              recursos: normalizeArrayField(data.recursos),
              contenidos_anep: normalizeArrayField(contenidos),
              competencias_anep: normalizeArrayField(competenciasSesion),
              criterios_logro_anep: normalizeArrayField(criterios)
            })
            .eq('id', sesion.id);

          if (updateError) {
            console.error(`Error actualizando sesión ${sesion.orden}:`, updateError);
            throw new Error(`Error actualizando sesión ${sesion.orden}: ${updateError.message}`);
          } else {
            console.log(`Plan generado exitosamente para sesión ${sesion.orden}`);
            break; // Salir del bucle de reintentos si fue exitoso
          }

        } catch (error) {
          intentos++;
          console.error(`Error procesando sesión ${sesion.orden} (intento ${intentos}/${maxIntentos}):`, error);
          
          // Manejo específico para error 429 (Too Many Requests)
          if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
            console.warn(`Rate limit detectado para sesión ${sesion.orden}. Esperando más tiempo...`);
          }
          
          if (intentos >= maxIntentos) {
            console.error(`Falló definitivamente la sesión ${sesion.orden} después de ${maxIntentos} intentos`);
            // Continuar con la siguiente sesión en lugar de fallar todo
            break;
          } else {
            // Esperar más tiempo antes del siguiente intento (especialmente para 429)
            const delayTime = error.message?.includes('429') ? 5000 : 3000; // 5s para 429, 3s para otros
            console.log(`Esperando ${delayTime/1000} segundos antes del siguiente intento...`);
            await new Promise(resolve => setTimeout(resolve, delayTime));
          }
        }
      }
    }

    console.log('Generación automática de planes completada');
    
    // Verificar que todas las sesiones tengan planes generados
    const { data: sesionesVerificacion, error: verificacionError } = await supabase
      .from('sesiones_clase')
      .select('id, plan_desarrollo')
      .eq('planificacion_id', planificacionId);

    if (verificacionError) {
      console.error('Error verificando planes generados:', verificacionError);
      return false;
    }

    const sesionesSinPlan = sesionesVerificacion?.filter(s => !s.plan_desarrollo?.html_completo) || [];
    
    if (sesionesSinPlan.length > 0) {
      console.error(`${sesionesSinPlan.length} sesiones sin plan generado:`, sesionesSinPlan);
      return false;
    }

    console.log('Todas las sesiones tienen planes generados correctamente');
    return true;

  } catch (error) {
    console.error('Error en generación automática de planes:', error);
    return false;
  }
};

export default function PlanificacionWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isGeneratingPlans, setIsGeneratingPlans] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const {
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
  } = usePlanificacionWizard();

  const { generateAllSessions, isGenerating } = useFullSessionGeneration();

  const handleNext = () => {
    const validacion = validarPaso(wizardData.paso);
    if (validacion.valid) {
      // Si estamos en el paso 0 y el tipo es "sin_periodo", saltar al paso 2
      if (wizardData.paso === 0 && wizardData.tipo_planificacion === 'sin_periodo') {
        updatePaso(2);
      } else {
        updatePaso((wizardData.paso + 1) as any);
      }
    }
  };

  const handlePrev = () => {
    if (wizardData.paso > 0) {
      // Si estamos en el paso 2 y el tipo es "sin_periodo", volver al paso 0
      if (wizardData.paso === 2 && wizardData.tipo_planificacion === 'sin_periodo') {
        updatePaso(0);
      } else {
        updatePaso((wizardData.paso - 1) as any);
      }
    }
  };

  const handleRetryGeneration = async () => {
    if (!wizardData.planificacionId) return;
    
    setIsGeneratingPlans(true);
    setGenerationError(null);
    
    // Esperar un poco antes de reintentar para evitar rate limiting
    console.log('Esperando 5 segundos antes de reintentar...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      const planesGenerados = await generarPlanesAutomaticamente(
        wizardData.planificacionId, 
        wizardData.materia || 'Sin especificar', 
        wizardData.nivel || 'Sin especificar'
      );
      
      if (planesGenerados) {
        toast({
          title: "¡Planificación completa!",
          description: "Todos los planes de clase han sido generados y guardados.",
        });
        navigate(`/planificacion/${wizardData.planificacionId}`);
      } else {
        throw new Error('No se pudieron generar todos los planes');
      }
    } catch (error) {
      console.error('Error en reintento de generación:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setGenerationError(errorMessage);
      toast({
        title: "Error en reintento",
        description: "El problema persiste. Revisa la consola para más detalles.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPlans(false);
    }
  };

  const handleFinish = async () => {
    if (!wizardData.contexto || !wizardData.horario || !wizardData.enfoque) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure we have a valid session
      let currentUser;
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('No valid session, ensuring demo auth...');
        const { error: ensureError } = await supabase.functions.invoke('ensure-demo-users');
        if (ensureError) {
          console.error('Error ensuring demo users:', ensureError);
        }
        
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: 'demo.teacher@example.com',
          password: 'DemoPassword2024!'
        });
        
        if (signInError) {
          throw new Error('No se pudo autenticar. Por favor, intenta hacer login nuevamente.');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: { user: retryUser }, error: retryError } = await supabase.auth.getUser();
        if (retryError || !retryUser) {
          throw new Error('No se pudo establecer la sesión de usuario.');
        }
        currentUser = retryUser;
      } else {
        currentUser = user;
      }

      console.log('Creating planification with user:', currentUser.id);

      // Extract competencies, contenidos, and mapping from wizard data
      const unidadesDidacticas = wizardData.enfoque?.unidades_didacticas ?? [];
      const competenciasSeleccionadas = extractCompetenciesFromUnits(unidadesDidacticas);
      const contenidosPrograma = extractContenidosFromUnits(unidadesDidacticas);
      const mapeoCompetenciasContenidos = buildCompetenciasContenidosMap(unidadesDidacticas);

      console.log('[Planificacion Creation] Extracted competencies:', competenciasSeleccionadas.length);
      console.log('[Planificacion Creation] Extracted contenidos:', contenidosPrograma.length);

      // Crear la planificación
      const { data: planificacion, error: planError } = await supabase
        .from('planificaciones')
        .insert({
          user_id: currentUser.id,
          grupo_id: wizardData.contexto.grupo_id,
          materia: wizardData.contexto.materia,
          fecha_inicio: wizardData.contexto.fecha_inicio || null,
          fecha_fin: wizardData.contexto.fecha_fin || null,
          horas_semanales: wizardData.horario.horas_semanales,
          configuracion_horario: wizardData.horario.configuracion,
          unidades_didacticas: wizardData.enfoque.unidades_didacticas,
          competencias_seleccionadas: competenciasSeleccionadas,
          contenidos_programa: contenidosPrograma,
          mapeo_competencias_contenidos: mapeoCompetenciasContenidos,
          requerimientos_docente: wizardData.enfoque.requerimientos_docente,
          distribucion_modalidades: wizardData.enfoque.distribucion_modalidades,
          estrategias_diferenciacion: wizardData.enfoque.estrategias_diferenciacion,
          objetivos_unidad: wizardData.enfoque.objetivos_unidad,
          cantidad_sesiones: wizardData.contexto.cantidad_sesiones,
          cadencia_deseada: wizardData.contexto.cadencia_deseada,
          bloques_preferidos: wizardData.contexto.bloques_preferidos,
          ventana_sugerida: wizardData.contexto.ventana_sugerida,
          nivel: '9' // Required field with default
        })
        .select()
        .maybeSingle();

      if (planError) {
        console.error('Plan error:', planError);
        throw new Error(`Error DB (${planError.code}): ${planError.message}`);
      }
      if (!planificacion) throw new Error('No se pudo crear la planificación');

      console.log('Planificación creada:', planificacion.id);
      
      // Guardar el ID de la planificación para posibles reintentos
      wizardData.planificacionId = planificacion.id;

      // Determinar tipo de planificación y crear sesiones
      if (wizardData.tipo_planificacion === 'sin_periodo') {
        // Modo backlog: crear sesiones sin fecha específica
        const cantidadSesiones = wizardData.contexto.cantidad_sesiones!;
        const duracionPorSesion = wizardData.contexto.duracion_por_sesion!;

        console.log('Creando sesiones en backlog:', cantidadSesiones, 'duración:', duracionPorSesion);

        const sesionesBacklog = Array.from({ length: cantidadSesiones }, (_, i) => ({
          planificacion_id: planificacion.id,
          fecha: null,
          orden: i + 1,
          estado: 'backlog' as const,
          duracion_minutos: duracionPorSesion,
          competencias_anep: [],
          contenidos_anep: [],
          criterios_logro_anep: [],
          plan_desarrollo: {},
          evaluacion: { tipo: 'observacion' as const },
          recursos: [],
          es_feriado: false,
          bloqueo_reserva: false
        }));

        const { error: sesionesError } = await supabase
          .from('sesiones_clase')
          .insert(sesionesBacklog);

        if (sesionesError) {
          console.error('Sesiones error:', sesionesError);
          throw new Error(`Error creando sesiones (${sesionesError.code}): ${sesionesError.message}`);
        }

        console.log('Sesiones creadas exitosamente en backlog');

        toast({
          title: "¡Planificación flexible creada!",
          description: `Se crearon ${cantidadSesiones} sesiones en backlog listas para agendar`,
        });

      } else {
        // Modo con fechas específicas: crear sesiones directamente en el calendario
        const fechasSesiones = generarSesionesEsquema();
        console.log('Creando sesiones en calendario:', fechasSesiones.length, 'fechas');

        const sesionesCalendario = fechasSesiones.map((fecha, index) => {
          // Calcular duración basada en la configuración del día
          const diaSemana = fecha.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
          const configDia = wizardData.horario?.configuracion.find(
            config => config.dia === diaSemana
          );
          const duracion = configDia?.duracionMinutos || 60;

          return {
            planificacion_id: planificacion.id,
            fecha: fecha.toISOString().split('T')[0],
            orden: index + 1,
            estado: 'planificada' as const,
            duracion_minutos: duracion,
            competencias_anep: [],
            contenidos_anep: [],
            criterios_logro_anep: [],
            plan_desarrollo: {},
            evaluacion: { tipo: 'observacion' as const },
            recursos: [],
            es_feriado: false,
            bloqueo_reserva: false
          };
        });

        const { error: sesionesError } = await supabase
          .from('sesiones_clase')
          .insert(sesionesCalendario);

        if (sesionesError) {
          console.error('Sesiones error:', sesionesError);
          throw new Error(`Error creando sesiones (${sesionesError.code}): ${sesionesError.message}`);
        }

        console.log('Sesiones creadas exitosamente en calendario');

        toast({
          title: "¡Planificación con fechas creada!",
          description: `Se crearon ${fechasSesiones.length} sesiones automáticamente en el calendario`,
        });
      }

      // Generar automáticamente los planes de todas las sesiones ANTES de navegar
      setIsGeneratingPlans(true);
      setGenerationError(null);
      toast({
        title: "Generando planes automáticamente",
        description: "La IA está creando el contenido de todas las sesiones. Esto puede tomar unos momentos...",
      });
      
      // Esperar a que se complete la generación antes de navegar
      try {
        const planesGenerados = await generarPlanesAutomaticamente(planificacion.id, planificacion.materia, planificacion.nivel);
        
        if (planesGenerados) {
          toast({
            title: "¡Planificación completa!",
            description: "Todos los planes de clase han sido generados y guardados.",
          });
          navigate(`/planificacion/${planificacion.id}`);
        } else {
          throw new Error('No se pudieron generar todos los planes');
        }
      } catch (generationError) {
        console.error('Error en generación automática:', generationError);
        const errorMessage = generationError instanceof Error ? generationError.message : 'Error desconocido';
        setGenerationError(errorMessage);
        toast({
          title: "Error en generación",
          description: "Hubo un problema al generar los planes. Revisa la consola para más detalles.",
          variant: "destructive"
        });
        // NO navegar si hay errores - mantener en pantalla de carga
        setIsGeneratingPlans(false);
        return;
      } finally {
        setIsGeneratingPlans(false);
      }

    } catch (error) {
      console.error('Error creando planificación:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudo crear la planificación. Inténtalo nuevamente.';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      setError(`Error creando la planificación: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const validation = validarPaso(wizardData.paso);

  // Mostrar pantalla de carga cuando se están generando los planes
  if (isGeneratingPlans || generationError) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <Card className="text-center p-12">
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-6">
                  <Bot className="h-16 w-16 text-primary animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">
                  {generationError ? 'Error en la generación' : 'Generando planes automáticamente. Tu clase estaraá lista pronto!'}
                </h2>
                <p className="text-muted-foreground">
                  {generationError 
                    ? (generationError.includes('429') || generationError.includes('Too Many Requests')
                        ? 'Demasiadas solicitudes a la IA. El sistema está esperando antes de reintentar...'
                        : 'Hubo un problema al generar los planes. Por favor, reintentar.')
                    : 'La IA está creando el contenido de todas las sesiones. Esto puede tomar varios minutos porque queremos asegurar la mejor calidad posible.'
                  }
                </p>
                {!generationError && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                    <strong>Nota:</strong> El proceso es lento intencionalmente para evitar errores de velocidad. 
                    Por favor, no cierres esta ventana.
                  </div>
                )}
              </div>

              {generationError ? (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-mono">
                      {generationError}
                    </p>
                  </div>
                  <Button 
                    onClick={handleRetryGeneration}
                    disabled={isGeneratingPlans}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isGeneratingPlans ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Reintentando...
                      </>
                    ) : (
                      'Reintentar generación'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              
              <div className="text-sm text-muted-foreground">
                {generationError 
                  ? 'Revisa la consola del navegador (F12) para ver los detalles del error.'
                  : 'Por favor, no cierres esta ventana mientras se generan los planes.'
                }
              </div>
            </div>
          </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/planificacion')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        
        <div>
          <h1 className="text-2xl font-bold">Asistente de Planificación Inteligente</h1>
          <p className="text-muted-foreground">
            Crea una planificación completa con IA paso a paso
          </p>
        </div>
      </div>

      {/* Wizard Content */}
      <WizardSteps
        wizardData={wizardData}
        onUpdateContexto={updateContexto}
        onUpdateHorario={updateHorario}
        onUpdateEnfoque={updateEnfoque}
        onUpdateTipoPlanificacion={updateTipoPlanificacion}
        onNext={handleNext}
        onPrev={handlePrev}
        onFinish={handleFinish}
        isLoading={isLoading || isGenerating}
        validation={validation}
      />

      {/* Info Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">🤖 Planificación Automática con IA</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Este asistente genera automáticamente planes completos para cada clase usando IA. 
            Cada sesión incluirá actividades estructuradas (inicio, desarrollo, cierre), 
            diferenciación integrada, recursos específicos y evaluación alineada con competencias ANEP.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}