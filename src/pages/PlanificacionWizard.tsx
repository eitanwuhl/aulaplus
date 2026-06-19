import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { usePlanificacionWizard } from '@/hooks/usePlanificacionWizard';
import type { WizardData } from '@/types/planificacion';
import { WizardSteps } from '@/components/planificacion/WizardSteps';
import {
  fetchCatalogItemsForProgram,
  fetchProgramById,
  programUnitsToWizardUnits,
} from '@/services/annualProgram';
import { useAuth } from '@/contexts/AuthContext';
import { createPlanificacionFromWizard } from '@/services/planning/createPlanificacionFromWizard';
import { batchGenerateSessionPlans } from '@/services/planning/batchGenerateSessionPlans';
import { ensurePlanningSession } from '@/lib/planificacion/ensurePlanningSession';
import { resolveSessionBriefs } from '@/lib/planificacion/sessionBriefPersistence';

const PLAN_WIZARD_DRAFT_KEY = 'aulaplus.planWizard.draft';
const SUMMARY_STEP = 3;

export default function PlanificacionWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isGeneratingPlans, setIsGeneratingPlans] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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
    replaceWizardData,
    setProgramaId,
    isDataComplete,
    setIsLoading,
    setError
  } = usePlanificacionWizard();

  useEffect(() => {
    const state = location.state as { returnToWizardStep?: number; fromWorkspace?: boolean } | null;
    if (state?.returnToWizardStep !== SUMMARY_STEP && !state?.fromWorkspace) return;

    try {
      const raw = localStorage.getItem(PLAN_WIZARD_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as WizardData;
      if (draft && typeof draft.paso === 'number' && draft.paso >= 0 && draft.paso <= SUMMARY_STEP) {
        replaceWizardData({ ...draft, paso: SUMMARY_STEP });
      }
    } catch {
      // ignore invalid draft
    }
  }, [location.state, replaceWizardData]);

  useEffect(() => {
    const grupo = searchParams.get('grupo');
    const materia = searchParams.get('materia');
    const programaId = searchParams.get('programa');
    if (!grupo && !materia && !programaId) return;

    const applyContext = async () => {
      if (grupo || materia) {
        updateContexto({
          ...wizardData.contexto,
          grupo_id: grupo ?? wizardData.contexto?.grupo_id ?? '',
          materia: materia ?? wizardData.contexto?.materia ?? '',
        });
      }

      if (!programaId || !user?.schoolId) return;

      const programRes = await fetchProgramById(programaId);
      if (programRes.error || !programRes.data) return;
      if (programRes.data.estado !== 'aprobado' && programRes.data.estado !== 'en_uso') return;

      const catalogRes = await fetchCatalogItemsForProgram({
        schoolId: user.schoolId,
        framework: programRes.data.marco_planificacion,
        materia: programRes.data.materia,
      });
      const catalogById = new Map((catalogRes.data ?? []).map((c) => [c.id, c]));
      const units = programUnitsToWizardUnits(programRes.data.unidades ?? [], catalogById);

      updateEnfoque({
        ...wizardData.enfoque,
        unidades_didacticas: units,
        requerimientos_docente: wizardData.enfoque?.requerimientos_docente ?? '',
        estrategias_diferenciacion: wizardData.enfoque?.estrategias_diferenciacion ?? '',
        distribucion_modalidades: wizardData.enfoque?.distribucion_modalidades ?? {
          individual: 25,
          pareja: 25,
          grupos: 25,
          toda_clase: 25,
        },
      });
      setProgramaId(programaId);
      updatePaso(2);
      toast({
        title: 'Programa anual cargado',
        description: `${units.length} unidades importadas.`,
      });
    };

    void applyContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link once on mount
  }, []);

  const saveDraftAndNavigateToWorkspace = (planificacionId: string) => {
    try {
      localStorage.setItem(PLAN_WIZARD_DRAFT_KEY, JSON.stringify(wizardData));
    } catch {
      // ignore localStorage errors
    }
    navigate(`/planificacion/${planificacionId}`, {
      state: { from: '/planificacion/nuevo', returnToWizardStep: SUMMARY_STEP }
    });
  };

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
      // PHASE 3.2: Resolve sessionBriefs from wizard state or DB (source-of-truth)
      const resolvedBriefs = await resolveSessionBriefs(
        wizardData.planificacionId,
        wizardData.enfoque?.sessionBriefs
      );

      const planesGenerados = await batchGenerateSessionPlans(
        wizardData.planificacionId,
        wizardData.contexto?.materia || 'Sin especificar',
        wizardData.planificacionNivel || 'Sin especificar',
        resolvedBriefs,  // PHASE 3.2: Use resolved briefs (wizard state or DB)
        wizardData.contexto?.grupo_id,  // PHASE 3 (Profile Usage): Pass grupo_id
        wizardData  // GOAL A: Pass wizardData for duracion_por_sesion fallback
      );
      
      if (planesGenerados) {
        toast({
          title: "¡Planificación completa!",
          description: "Todos los planes de clase han sido generados y guardados.",
        });
        saveDraftAndNavigateToWorkspace(wizardData.planificacionId);
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
    // DEV: Log validation state at start
    if (import.meta.env.DEV) {
      console.log('[PlanificacionWizard] handleFinish called', {
        tipo_planificacion: wizardData.tipo_planificacion,
        hasContexto: !!wizardData.contexto,
        hasHorario: !!wizardData.horario,
        hasEnfoque: !!wizardData.enfoque
      });
    }

    // Conditional validation based on tipo_planificacion
    // Always require contexto and enfoque
    if (!wizardData.contexto || !wizardData.enfoque) {
      toast({
        title: "Error",
        description: "Faltan datos requeridos para crear la planificación",
        variant: "destructive"
      });
      return;
    }

    // Require horario ONLY for periodo_especifico
    if (wizardData.tipo_planificacion !== 'sin_periodo' && !wizardData.horario) {
      toast({
        title: "Error",
        description: "Faltan datos requeridos para crear la planificación (horario no configurado)",
        variant: "destructive"
      });
      return;
    }

    // For sin_periodo, validate cantidad_sesiones and duracion_por_sesion
    if (wizardData.tipo_planificacion === 'sin_periodo') {
      if (!wizardData.contexto.cantidad_sesiones || wizardData.contexto.cantidad_sesiones <= 0) {
        toast({
          title: "Error",
          description: "Debes especificar una cantidad de sesiones mayor a 0",
          variant: "destructive"
        });
        return;
      }
      if (!wizardData.contexto.duracion_por_sesion || wizardData.contexto.duracion_por_sesion <= 0) {
        toast({
          title: "Error",
          description: "Debes especificar una duración por sesión mayor a 0 minutos",
          variant: "destructive"
        });
        return;
      }
    }

    // Prevent double-clicks and concurrent creation attempts
    if (isCreating || isLoading || isGeneratingPlans) {
      console.warn('[PlanificacionWizard] Creation already in progress, ignoring duplicate request');
      return;
    }

    setIsCreating(true);
    setIsLoading(true);
    setError(null);
    setGenerationError(null);

    try {
      const sessionResult = await ensurePlanningSession();
      if ('error' in sessionResult) {
        throw new Error(sessionResult.error);
      }
      const currentUser = sessionResult.user;

      console.log('Creating planification with user:', currentUser.id);

      console.log(
        '[Planificacion Creation] Unidades:',
        wizardData.enfoque?.unidades_didacticas?.length ?? 0
      );

      const createResult = await createPlanificacionFromWizard({
        userId: currentUser.id,
        schoolId: user?.schoolId,
        wizardData,
      });

      if (!createResult.ok) {
        throw new Error(createResult.error);
      }

      const planificacion = { id: createResult.planificacionId };
      wizardData.planificacionId = planificacion.id;
      wizardData.planificacionNivel = createResult.nivel;

      // Persist plan-level material attachments (if any)
      const attachedPlanMaterialIds = wizardData.enfoque?.attachedPlanMaterialIds || [];
      if (attachedPlanMaterialIds.length > 0) {
        const { addAttachment } = await import('@/services/materials');
        
        console.log(`[Materials] Attaching ${attachedPlanMaterialIds.length} materials to plan ${planificacion.id}`);
        
        const attachmentPromises = attachedPlanMaterialIds.map((materialId, index) =>
          addAttachment({
            target_type: 'planificacion',
            target_id: planificacion.id,
            material_id: materialId,
            priority: index + 1
          })
        );
        
        const attachmentResults = await Promise.allSettled(attachmentPromises);
        const failedAttachments = attachmentResults.filter(r => r.status === 'rejected');
        
        if (failedAttachments.length > 0) {
          console.error('[Materials] Some attachments failed:', failedAttachments);
          toast({
            title: 'Advertencia',
            description: `${failedAttachments.length} material(es) no se pudieron adjuntar. La planificación se creó correctamente.`,
            variant: 'default'
          });
        } else {
          console.log(`[Materials] Successfully attached ${attachedPlanMaterialIds.length} materials`);
        }
      }

      if (createResult.sesionesMode === 'backlog') {
        toast({
          title: '¡Planificación flexible creada!',
          description: `Se crearon ${createResult.sesionesCount} sesiones en backlog listas para agendar`,
        });
      } else {
        toast({
          title: '¡Planificación con fechas creada!',
          description: `Se crearon ${createResult.sesionesCount} sesiones automáticamente en el calendario`,
        });
      }

      if (!createResult.briefPersist.ok || createResult.briefPersist.failures > 0) {
        toast({
          title: "Advertencia",
          description: "No se pudieron guardar algunos temas de las clases. La generación continuará con los valores actuales.",
          variant: "default"
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
        const result = await batchGenerateSessionPlans(
          planificacion.id,
          createResult.materia,
          createResult.nivel,
          wizardData.enfoque?.sessionBriefs,  // PHASE 3.1: Pass sessionBriefs from wizard state
          wizardData.contexto?.grupo_id,  // PHASE 3 (Profile Usage): Pass grupo_id
          wizardData  // GOAL A: Pass wizardData for duracion_por_sesion fallback
        );
        
        // FASE 1E: Manejar resultado detallado (ahora retorna objeto con success y failedSessions)
        if (result && typeof result === 'object' && result.success === true) {
          toast({
            title: "¡Planificación completa!",
            description: "Todos los planes de clase han sido generados y guardados.",
          });
          
          // Navigate to workspace after successful creation
          const planificacionId = planificacion.id;
          console.log(`[PlanificacionWizard] Navigating to workspace: /planificacion/${planificacionId}`);
          saveDraftAndNavigateToWorkspace(planificacionId);
          return; // Exit early on success
        } else {
          // FASE 1E: Construir mensaje de error detallado con sesiones fallidas
          const failedSessions = result && typeof result === 'object' && 'failedSessions' in result 
            ? result.failedSessions 
            : [];
          const errorMessage = failedSessions.length > 0
            ? `No se pudieron generar ${failedSessions.length} sesión(es). Revisa los detalles en el workspace.`
            : (result && typeof result === 'object' && 'error' in result 
                ? result.error 
                : 'No se pudieron generar todos los planes. Algunas sesiones pueden no tener contenido generado.');
          throw new Error(errorMessage);
        }
      } catch (generationError) {
        const errorMessage = generationError instanceof Error ? generationError.message : 'Error desconocido al generar planes';
        if (import.meta.env.DEV) {
          console.error('[PlanificacionWizard] Error en generación automática:', generationError);
        }
        setGenerationError(errorMessage);
        
        // Show error toast but still navigate if plan was created
        toast({
          title: "Advertencia",
          description: "La planificación se creó pero hubo problemas al generar algunos planes. Puedes generarlos más tarde desde el workspace.",
          variant: "default"
        });
        
        // Navigate anyway if plan was created (partial success)
        if (planificacion?.id) {
          console.log(`[PlanificacionWizard] Navigating to workspace despite generation errors: /planificacion/${planificacion.id}`);
          saveDraftAndNavigateToWorkspace(planificacion.id);
          return;
        }
        
        // Only block navigation if plan creation itself failed
        setIsGeneratingPlans(false);
        return;
      } finally {
        setIsGeneratingPlans(false);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo crear la planificación. Inténtalo nuevamente.';
      
      if (import.meta.env.DEV) {
        console.error('[PlanificacionWizard] Error creando planificación:', error);
      }
      
      toast({
        title: "Error al crear planificación",
        description: errorMessage,
        variant: "destructive",
        duration: 5000 // Show longer for errors
      });
      setError(`Error creando la planificación: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setIsCreating(false);
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
                  <Loader2 className="h-16 w-16 text-primary animate-spin" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">
                  {generationError ? 'Error en la generación' : 'Aguarda un instante mientras generamos las clases. Esperamos no demorar mucho.'}
                </h2>
                {generationError && (
                  <p className="text-muted-foreground">
                    {generationError.includes('429') || generationError.includes('Too Many Requests')
                      ? 'Demasiadas solicitudes a la IA. El sistema está esperando antes de reintentar...'
                      : 'Hubo un problema al generar los planes. Por favor, reintentar.'}
                  </p>
                )}
                {!generationError && (
                  <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-200 p-3 rounded-lg max-w-md mx-auto">
                    No cierres esta ventana ni navegues a otra página mientras la generación está en curso.
                  </div>
                )}
              </div>

              {generationError && (
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
              )}
              
              {generationError && (
                <div className="text-sm text-muted-foreground">
                  Revisa la consola del navegador (F12) para ver los detalles del error.
                </div>
              )}
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
          onClick={() => {
            if (wizardData.paso > 0) {
              handlePrev();
            } else {
              navigate('/planificacion');
            }
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        
        <div>
          <h1 className="text-2xl font-bold">Asistente para planificación de clases</h1>
        </div>
      </div>

      {/* Wizard Content */}
      <WizardSteps
        wizardData={wizardData}
        onUpdateContexto={updateContexto}
        onUpdateHorario={updateHorario}
        onUpdateEnfoque={updateEnfoque}
        onSetProgramaId={setProgramaId}
        onUpdateTipoPlanificacion={updateTipoPlanificacion}
        onNext={handleNext}
        onPrev={handlePrev}
        onFinish={handleFinish}
        isLoading={isLoading || isGeneratingPlans || isCreating}
        validation={validation}
      />
    </div>
  );
}
