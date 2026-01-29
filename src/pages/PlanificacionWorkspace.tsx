import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Download, Settings, GripVertical, Minimize2, ChevronUp, Loader2, Save, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BacklogSesiones } from '@/components/planificacion/BacklogSesiones';
import { CalendarioDnD } from '@/components/planificacion/CalendarioDnD';
import { EditorSesionNuevo } from '@/components/planificacion/EditorSesionNuevo';
import { useCalendarioSesiones } from '@/hooks/useCalendarioSesiones';
import { Planificacion, SesionClase, DistribucionModalidades, ConfiguracionHorario } from '@/types/planificacion';
import { supabase } from '@/integrations/supabase/client';
import { parsePlan, buildPlanHtml, buildPlanHtmlWithReminders, buildSanitizedLessonPlanHtml } from '@/lib/planParser';
import { normalizeArrayField } from '@/lib/normalizeSupabaseArrays';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { loadGroupContext, getGrupoIdFromPlanificacion } from '@/utils/groupContext';
import { mockGroups } from '@/data/mockData';
import type { Student as EnforcementStudent } from '@/lib/contemplaciones/enforcement';
import { resolveMockGroup } from '@/utils/resolveMockGroup';
import { AIDesignReport } from '@/components/evaluaciones/AIDesignReport';
import type { AIDesignReportData } from '@/components/evaluaciones/AIDesignReport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// FIX: Helper to adapt planning ai_design_report format to evaluation format
function adaptPlanningReportToEvaluationFormat(planningReport: any): AIDesignReportData | null {
  if (!planningReport) return null;
  
  // Planning reports have a different structure, adapt it
  return {
    rationale: planningReport.decisions?.structure || planningReport.assumptions?.join('. ') || 'Reporte de diseño de la planificación',
    coverageMapping: [], // Planning doesn't have session-to-section mapping like evaluations
    materialsUsage: [], // Could be extracted from inputsUsed.materials if available
    adaptationNotes: planningReport.assumptions?.join('. ') || 'Sin notas de adaptación'
  };
}

export default function PlanificacionWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [planificacion, setPlanificacion] = useState<Planificacion | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [competenciasDelPeriodo, setCompetenciasDelPeriodo] = useState<string[]>([]);
  const [isEnsuringPlans, setIsEnsuringPlans] = useState(false);
  const [planGenerationProgress, setPlanGenerationProgress] = useState({ done: 0, total: 0 });
  const [planGenerationError, setPlanGenerationError] = useState<string | null>(null);
  
  // State for save dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [customNombre, setCustomNombre] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // State for exit confirmation guard
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const isNavigatingRef = useRef(false);
  
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

  // FIX: Function to reload planificacion (including ai_design_report)
  const recargarPlanificacion = useCallback(async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('planificaciones')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return;
      
      // Update planificacion state with fresh data (including ai_design_report)
      const planificacionConverted = {
        ...data,
        distribucion_modalidades: data.distribucion_modalidades as unknown as DistribucionModalidades,
        unidades_didacticas: Array.isArray(data.unidades_didacticas) ? data.unidades_didacticas : [],
        configuracion_horario: data.configuracion_horario as unknown as ConfiguracionHorario[],
        fecha_inicio: data.fecha_inicio || undefined,
        fecha_fin: data.fecha_fin || undefined,
        ai_design_report: (data as any).ai_design_report || null
      };
      
      setPlanificacion(planificacionConverted as unknown as Planificacion);
      
      if (import.meta.env.DEV && (data as any).ai_design_report) {
        console.log('[FIX] Planificación recargada con ai_design_report');
      }
    } catch (error) {
      console.error('[FIX] Error recargando planificación:', error);
    }
  }, [id]);

  // Cargar planificaci?n
  useEffect(() => {
    const cargarPlanificacion = async () => {
      if (!id) {
        console.log('No hay ID de planificaci?n');
        return;
      }
      
      console.log('Cargando planificaci?n con ID:', id);
      setIsLoadingPlan(true);
      try {
        const { data, error } = await supabase
          .from('planificaciones')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        console.log('Datos de planificaci?n:', data);
        console.log('Error de planificaci?n:', error);

        if (error) throw error;
        
        if (!data) {
          toast({
            title: "Error",
            description: "No se encontr? la planificaci?n solicitada",
            variant: "destructive"
          });
          navigate('/planificacion');
          return;
        }
        
        // Convertir tipos JSON a TypeScript tipos
        // Defensive: Ensure unidades_didacticas is always an array to prevent forEach crashes
        let unidadesDidacticasSafe: any[] = [];
        if (data.unidades_didacticas) {
          if (Array.isArray(data.unidades_didacticas)) {
            unidadesDidacticasSafe = data.unidades_didacticas;
          } else {
            // If it's not an array (null, object, string, etc.), default to empty array
            if (import.meta.env.DEV) {
              console.warn('[PlanificacionWorkspace] unidades_didacticas is not an array, defaulting to []', typeof data.unidades_didacticas);
            }
            unidadesDidacticasSafe = [];
          }
        }
        
        const planificacionConverted = {
          ...data,
          distribucion_modalidades: data.distribucion_modalidades as unknown as DistribucionModalidades,
          unidades_didacticas: unidadesDidacticasSafe,
          configuracion_horario: data.configuracion_horario as unknown as ConfiguracionHorario[],
          fecha_inicio: data.fecha_inicio || undefined,
          fecha_fin: data.fecha_fin || undefined,
          // FIX: Include ai_design_report from database
          ai_design_report: (data as any).ai_design_report || null
        };
        
        // Calcular competencias del per?odo desde unidades did?cticas
        // unidades_didacticas is now guaranteed to be an array, safe to iterate
        const competenciasUnicas = new Set<string>();
        unidadesDidacticasSafe.forEach((unidad: any) => {
          if (unidad && unidad.competencias_ids && Array.isArray(unidad.competencias_ids)) {
            unidad.competencias_ids.forEach((comp: string) => competenciasUnicas.add(comp));
          }
        });
        setCompetenciasDelPeriodo(Array.from(competenciasUnicas));
        
        setPlanificacion(planificacionConverted as unknown as Planificacion);
      } catch (error) {
        console.error('Error cargando planificaci?n:', error);
        toast({
          title: "Error",
          description: "No se pudo cargar la planificaci?n",
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
    if (!id || isEnsuringPlans) return;

    const interval = setInterval(() => {
      // Solo recargar si hay sesiones sin plan
      const sesionesSinPlan = sesiones.filter(s => !s.plan_desarrollo?.html_completo);
      if (sesionesSinPlan.length > 0) {
        console.log('Recargando sesiones para detectar planes generados...');
        cargarSesiones();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id, sesiones, cargarSesiones, isEnsuringPlans]);

  // Generate plan for a single session using AI + parser
  // PHASE 2: Invokes AI edge function, then uses parsePlan/buildPlanHtml to sanitize and structure HTML.
  // PHASE 4: Merges auto-detected resources (from new plan) with existing manual resources (teacher-added)
  //          to prevent data loss on regeneration.
  const generatePlanForSession = useCallback(
    async (sesion: SesionClase) => {
      if (!planificacion) {
        throw new Error('Planificaci?n no disponible');
      }

      const payload = {
        modo: 'generar_plan_html',
        sesionId: sesion.id,
        orden: sesion.orden,
        duracionMin: sesion.duracion_minutos,
        materia: planificacion.materia || 'Sin especificar',
        nivel: planificacion.nivel || 'Sin especificar',
        contenidos: sesion.contenidos_anep || [],
        competencias: sesion.competencias_anep || [],
        criterios: sesion.criterios_logro_anep || [],
        instruccionesDocente: undefined
      };

      const { data, error } = await supabase.functions.invoke('generate-plan-completo', {
        body: payload
      });

      if (error) {
        throw new Error(error.message || 'Error generando plan de clase');
      }

      if (!data?.plan_html?.includes('<section id="plan">')) {
        throw new Error('Respuesta de IA sin estructura v?lida');
      }

      // PHASE 2: Parse and sanitize AI-generated HTML before saving
      // This extracts sections (Inicio/Desarrollo/Cierre), removes resource blocks from narrative,
      // and normalizes resources into a clean array.
      const fallbackRecursos = normalizeArrayField(data?.recursos);
      
      // CONTEMPLACIONES: Use centralized helper to inject deterministic reminders in REPLACE mode
      const sanitizedHtml = buildSanitizedLessonPlanHtml(
        data.plan_html,
        fallbackRecursos,
        planificacion.grupo_id,
        '[WORKSPACE-CONTEMPLACIONES]'
      );
      
      // Parse again for resource extraction
      const parsedPlan = parsePlan(data.plan_html, fallbackRecursos);
      
      // PHASE 4: Preserve existing manual resources when auto-generating
      // Auto-detected resources from new plan
      const autoResources = normalizeArrayField(parsedPlan.recursos);
      // Existing resources from DB (may include manual additions from teacher)
      const existingResources = normalizeArrayField(sesion.recursos);
      
      // Merge: keep manual resources that aren't auto-detected in new plan
      const autoLowercase = autoResources.map(r => r.toLowerCase());
      const manualResources = existingResources.filter(r => {
        const normalized = r.trim().toLowerCase();
        return normalized.length > 0 && !autoLowercase.includes(normalized);
      });
      
      // Final merged list: new auto-detected + preserved manual
      const mergedResources = [...autoResources, ...manualResources];

      const { error: updateError } = await supabase
        .from('sesiones_clase')
        .update({
          plan_desarrollo: { html_completo: sanitizedHtml },
          argumento_competencias: data.argumento_competencias,
          recursos: mergedResources
        } as Partial<SesionClase>)
        .eq('id', sesion.id);

      if (updateError) {
        throw new Error(updateError.message || 'Error guardando plan generado');
      }
    },
    [planificacion]
  );

  // Memoize unassigned sessions for floating tray
  const defaultOpenBandeja = Boolean((location.state as any)?.openBandeja);
  const [isBandejaOpen, setIsBandejaOpen] = useState(defaultOpenBandeja);

  useEffect(() => {
    if (defaultOpenBandeja) {
      setIsBandejaOpen(true);
    }
  }, [defaultOpenBandeja]);

  const sesionesNoAsignadas = useMemo(
    () =>
      sesiones.filter((sesion) => !sesion.fecha || sesion.estado === 'backlog'),
    [sesiones]
  );

  // Auto-generate plans for sessions that don't have one
  // This effect runs once when the workspace loads and identifies sessions missing plan content.
  // For each missing session, it calls generatePlanForSession (which uses the AI + parser flow).
  // Progress and errors are tracked in state and displayed to the user.
  useEffect(() => {
    if (!planificacion) return;
    if (isEnsuringPlans) return;
    if (planGenerationError) return;
    if (sesiones.length === 0) return;

    const faltantes = sesiones.filter(s => !s.plan_desarrollo?.html_completo);
    if (faltantes.length === 0) return;

    let cancelled = false;

    const ensurePlans = async () => {
      setPlanGenerationError(null);
      setIsEnsuringPlans(true);
      setPlanGenerationProgress({ total: faltantes.length, done: 0 });

      let failed = false;

      for (let i = 0; i < faltantes.length; i++) {
        if (cancelled) break;

        try {
          await generatePlanForSession(faltantes[i]);

          if (!cancelled) {
            setPlanGenerationProgress({
              total: faltantes.length,
              done: i + 1
            });
          }
        } catch (error) {
          console.error('Error generando contenido de la sesi?n:', error);
          failed = true;
          if (!cancelled) {
            const message =
              error instanceof Error ? error.message : 'No se pudo generar el plan de clase.';
            setPlanGenerationError(message);
            toast({
              title: "Error generando sesiones",
              description: message,
              variant: "destructive"
            });
          }
          break;
        }
      }

      if (!cancelled && !failed) {
        await cargarSesiones();
      }

      if (!cancelled) {
        setIsEnsuringPlans(false);
      }
    };

    ensurePlans();

    return () => {
      cancelled = true;
    };
  }, [planificacion, sesiones, isEnsuringPlans, planGenerationError, generatePlanForSession, cargarSesiones, toast]);

  const handleRetryGeneration = async () => {
    setPlanGenerationError(null);
    setPlanGenerationProgress({ done: 0, total: 0 });
    await cargarSesiones();
  };

  // Handlers para DnD
  // Handler to open save dialog
  const handleOpenSaveDialog = () => {
    if (!planificacion) return;
    // Default name is current materia - grupo_id
    const defaultName = planificacion.nombre || `${planificacion.materia} - ${planificacion.grupo_id}`;
    setCustomNombre(defaultName);
    setSaveDialogOpen(true);
  };

  // Handler to save planification explicitly
  const handleSavePlanificacion = async () => {
    // Pre-save validation
    if (!planificacion) {
      toast({
        title: "Error",
        description: "No hay planificación para guardar",
        variant: "destructive"
      });
      return;
    }

    if (!customNombre.trim()) {
      toast({
        title: "Error",
        description: "Ingresá un nombre",
        variant: "destructive"
      });
      return;
    }

    // Prevent double-submit
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('planificaciones')
        .update({
          nombre: customNombre.trim(),
          is_saved: true,
          saved_at: new Date().toISOString()
        } as any)
        .eq('id', planificacion.id);

      if (error) {
        // GUARDRAIL: Si las columnas no existen (PGRST204), mostrar error claro
        if (error.code === 'PGRST204' || error.message.includes('is_saved') || error.message.includes('nombre') || error.message.includes('saved_at')) {
          console.error('? MIGRACI?N FALTANTE: Columnas is_saved/nombre/saved_at no existen en planificaciones');
          toast({
            title: "Error de Base de Datos",
            description: "Falta aplicar migraci?n de planificaciones. Por favor ejecuta: supabase db push",
            variant: "destructive"
          });
          setIsSaving(false);
          setSaveDialogOpen(false);
          return;
        }
        throw error;
      }

      // Update local state
      setPlanificacion(prev => prev ? {
        ...prev,
        nombre: customNombre.trim(),
        is_saved: true,
        saved_at: new Date().toISOString()
      } : null);

      setSaveDialogOpen(false);
      setCustomNombre('');

      toast({
        title: "Planificaci?n guardada",
        description: `"${customNombre.trim()}" se agreg? a Mis Planificaciones`,
      });

    } catch (error: any) {
      // Detailed error logging in DEV
      if (import.meta.env.DEV) {
        console.error('[SAVE PLANIFICACION] Error guardando planificación:', {
          error,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        });
      }

      // User-friendly error message (avoid technical codes)
      let errorMessage = "No se pudo guardar la planificación. Por favor, intentá nuevamente.";
      
      if (error?.message) {
        if (error.message.includes('permission denied') || error.message.includes('policy')) {
          errorMessage = "No tenés permisos para guardar. Contactá al administrador.";
        } else if (error.message.includes('null value') || error.message.includes('violates not-null')) {
          errorMessage = "Faltan datos requeridos. Revisá que todos los campos estén completos.";
        } else if (error.message.includes('relation') || error.message.includes('does not exist')) {
          errorMessage = "Error de configuración. Contactá al administrador.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Error de conexión. Revisá tu conexión a internet e intentá nuevamente.";
        }
      }
      
      toast({
        title: "Error al guardar",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Exit confirmation guard: Check if planification is unsaved
  const shouldBlockExit = planificacion && planificacion.is_saved === false;

  // Handle navigation attempts (internal navigation)
  const handleNavigate = useCallback((targetPath: string) => {
    if (shouldBlockExit && !isNavigatingRef.current) {
      setPendingNavigation(() => () => {
        isNavigatingRef.current = true;
        navigate(targetPath);
      });
      setExitConfirmOpen(true);
      return false;
    }
    return true;
  }, [shouldBlockExit, navigate]);

  // Browser-level exit guard (refresh/close tab)
  useEffect(() => {
    if (!shouldBlockExit) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages, but we still need to call preventDefault
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldBlockExit]);

  // Intercept navigation from sidebar and other links
  useEffect(() => {
    if (!shouldBlockExit) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Find the closest anchor or NavLink
      const link = target.closest('a[href]');
      
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href) return;
      
      // Skip if it's the same route or external link
      if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      
      // Skip if it's the current route
      if (href === location.pathname) {
        return;
      }
      
      // Intercept the navigation
      e.preventDefault();
      e.stopPropagation();
      
      // Use our navigation handler
      handleNavigate(href);
    };

    // Use capture phase to intercept before React Router handles it
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [shouldBlockExit, handleNavigate, location.pathname]);

  // Handle exit confirmation dialog actions
  const handleConfirmExit = () => {
    setExitConfirmOpen(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleCancelExit = () => {
    setExitConfirmOpen(false);
    setPendingNavigation(null);
  };

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
    console.log('=== SESI?N SELECCIONADA EN WORKSPACE ===');
    console.log('Sesi?n recibida:', sesion);
    console.log('ID de sesi?n:', sesion.id);
    console.log('Fecha de sesi?n:', sesion.fecha);
    console.log('Estado de sesi?n:', sesion.estado);
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
    // FIX: Reload planificacion after session update (in case ai_design_report was updated)
    // This ensures the AI evidence panel updates after regeneration
    await recargarPlanificacion();
  };

  const handleExportarExcel = () => {
    toast({
      title: "Exportando...",
      description: "Generando archivo Excel de la planificaci?n",
    });
  };

  // Error screen for plan generation failures
  if (planGenerationError) {
    return (
      <ErrorBoundary>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-red-600">Error al generar los planes</h2>
            <p className="text-muted-foreground">
              {planGenerationError}
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={handleRetryGeneration}>
                Reintentar generaci?n
              </Button>
              <Button variant="outline" onClick={() => {
                if (shouldBlockExit) {
                  handleNavigate('/planificacion');
                } else {
                  navigate('/planificacion');
                }
              }}>
                Volver a planificaciones
              </Button>
          </div>
        </div>
      </div>
      </ErrorBoundary>
    );
  }

  const isInitialSessionsLoading = sesiones.length === 0 && isLoading;

  // Loading screen (includes plan generation progress)
  if (isLoadingPlan || isEnsuringPlans || isInitialSessionsLoading) {
    const { total, done } = planGenerationProgress;
    const message = isEnsuringPlans
      ? `Generando contenido de las sesiones${total ? ` (${Math.min(done, total)}/${total})` : ''}`
      : 'Cargando planificaci?n...';

    return (
      <ErrorBoundary>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">{message}</p>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (!planificacion) {
    return (
      <ErrorBoundary>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-muted-foreground mb-4">No se pudo cargar la planificaci?n</p>
            <Button onClick={() => {
            if (shouldBlockExit) {
              handleNavigate('/planificacion');
            } else {
              navigate('/planificacion');
            }
          }}>
            Volver a Planificaciones
          </Button>
        </div>
      </div>
      </ErrorBoundary>
    );
  }

  // Exit confirmation dialog
  const exitConfirmDialog = (
    <AlertDialog open={exitConfirmOpen} onOpenChange={setExitConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
          <AlertDialogDescription>
            No has guardado la sesión.
            ¿Estás seguro de que quieres salir igual?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelExit}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmExit}>
            Salir igual
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        
        {/* Header */}
        <div className="border-b bg-card px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (shouldBlockExit) {
                    handleNavigate('/planificacion');
                  } else {
                    navigate('/planificacion');
                  }
                }}
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
                    : 'Planificaci?n flexible (sin fechas fijas)'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Show "Guardar sesi?n" button only if not saved yet */}
              {planificacion && !planificacion.is_saved && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleOpenSaveDialog}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar sesi?n
                </Button>
              )}

              {/* Show indicator if already saved */}
              {planificacion && planificacion.is_saved && (
                <div className="flex items-center gap-1 text-sm text-green-600 px-3 py-1.5 bg-green-50 rounded-md border border-green-200">
                  <BookmarkCheck className="h-4 w-4" />
                  <span className="font-medium">Guardada</span>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={handleExportarExcel}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configuraci?n
              </Button>
            </div>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="container mx-auto py-6">
          <div className="grid grid-cols-12 gap-6">
            
            {/* Row 1: Sesiones Pendientes + Calendario */}
            {/* Sesiones Pendientes (3 columnas en lg+, 12 en md-) */}
            <div className="col-span-12 lg:col-span-3 lg:order-1">
              <BacklogSesiones
                sesiones={sesiones}
                onSesionSelect={handleSesionSelect}
                sesionSeleccionada={sesionSeleccionada}
              />
            </div>

            {/* Calendario (9 columnas en lg+, 12 en md-) */}
            <div className="col-span-12 lg:col-span-9 lg:order-2">
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

            {/* Row 2: Editor de Sesi?n (full width) */}
            <div className="col-span-12 order-3">
              <EditorSesionNuevo
                sesion={sesionSeleccionada}
                onActualizar={handleActualizarSesion}
                competenciasDelPeriodo={competenciasDelPeriodo}
                planificacionId={planificacion?.id}
                materia={planificacion?.materia}
                nivel={planificacion?.nivel}
              />
            </div>

            {/* FIX: AI Design Report Panel (Row 3) */}
            {planificacion?.ai_design_report && (
              <div className="col-span-12 order-4 mt-4">
                <AIDesignReport
                  reportData={adaptPlanningReportToEvaluationFormat(planificacion.ai_design_report)}
                  className="mt-6"
                />
              </div>
            )}
          </div>
        </div>

        {/* Bandeja flotante de sesiones */}
        {isBandejaOpen ? (
          <aside className="fixed bottom-6 right-6 z-50 w-[320px] rounded-xl border bg-card shadow-lg pointer-events-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <p className="text-sm font-semibold">Bandeja de sesiones</p>
                <p className="text-xs text-muted-foreground">
                  Arrastra al calendario para asignar ? No asignadas: {sesionesNoAsignadas.length}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsBandejaOpen(false)}
                aria-label="Minimizar bandeja"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-4 space-y-2">
              {sesionesNoAsignadas.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  No hay sesiones pendientes
                </div>
              ) : (
                sesionesNoAsignadas
                  .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                  .map((sesion) => (
                    <div
                      key={sesion.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('sesionId', sesion.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className="p-3 border rounded-lg bg-background hover:bg-accent cursor-move transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium truncate">
                              {sesion.session_brief || sesion.titulo || `Sesión ${sesion.orden}`}
                            </h4>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {sesion.duracion_minutos} min
                            </span>
                          </div>
                          {sesion.contenidos_anep?.length ? (
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {sesion.session_brief ? `Contenido ANEP: ${sesion.contenidos_anep[0]}` : sesion.contenidos_anep[0]}
                            </p>
                          ) : null}
                          {sesion.competencias_anep?.length ? (
                            <div className="flex gap-1 mt-1">
                              <span className="text-[10px] px-2 py-0.5 rounded-full border text-muted-foreground">
                                {sesion.competencias_anep.length} comp.
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </aside>
        ) : (
          <Button
            className="fixed bottom-6 right-6 z-40 shadow-lg"
            onClick={() => setIsBandejaOpen(true)}
          >
            <ChevronUp className="h-4 w-4 mr-2" />
            Sesiones ({sesionesNoAsignadas.length})
          </Button>
        )}

        {/* Dialog for saving planification with custom name */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Guardar planificaci?n</DialogTitle>
              <DialogDescription>
                Dale un nombre personalizado a esta planificaci?n para identificarla f?cilmente en "Mis Planificaciones".
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nombre-planificacion">
                  Nombre de la planificaci?n
                </Label>
                <Input
                  id="nombre-planificacion"
                  value={customNombre}
                  onChange={(e) => setCustomNombre(e.target.value)}
                  placeholder="Ej: Historia - 9no 1"
                  disabled={isSaving}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customNombre.trim()) {
                      handleSavePlanificacion();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Este es el nombre que ver?s en tu lista de planificaciones guardadas.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSaveDialogOpen(false);
                  setCustomNombre('');
                }}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSavePlanificacion}
                disabled={!customNombre.trim() || isSaving}
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Exit confirmation guard dialog */}
        {exitConfirmDialog}
      </div>
    </ErrorBoundary>
  );
}