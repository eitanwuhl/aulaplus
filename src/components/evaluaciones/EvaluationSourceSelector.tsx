/**
 * EvaluationSourceSelector
 * 
 * Component for selecting evaluation sources:
 * - Saved planificacion
 * - Multiple sessions from that planificacion
 * - Optional focus text describing what to evaluate
 * 
 * Used in EvaluacionesGrupo for ANEP-alternative evaluation creation
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileText, BookOpen, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Planificacion = Database['public']['Tables']['planificaciones']['Row'];
type SesionClase = Database['public']['Tables']['sesiones_clase']['Row'];

export interface EvaluationSourceConfig {
  planificacionId?: string;
  sessionIds: string[];
  evaluationFocus: string;
}

interface EvaluationSourceSelectorProps {
  grupoId?: string;
  config: EvaluationSourceConfig;
  onChange: (config: EvaluationSourceConfig) => void;
  disabled?: boolean;
}

export function EvaluationSourceSelector({
  grupoId,
  config,
  onChange,
  disabled = false
}: EvaluationSourceSelectorProps) {
  const [savedPlanificaciones, setSavedPlanificaciones] = useState<Planificacion[]>([]);
  const [availableSessions, setAvailableSessions] = useState<SesionClase[]>([]);
  const [isLoadingPlanificaciones, setIsLoadingPlanificaciones] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // PHASE B: Load saved planificaciones for the selected group
  // RLS automatically filters by auth.uid() = user_id
  useEffect(() => {
    if (!grupoId) {
      setSavedPlanificaciones([]);
      return;
    }

    const loadPlanificaciones = async () => {
      setIsLoadingPlanificaciones(true);
      try {
        // FIX: Query planificaciones - RLS handles user isolation automatically
        // Filter: (grupo_id = selectedGroupId OR grupo_id IS NULL) AND deleted_at IS NULL
        // Then filter by is_saved in memory
        const { data, error } = await supabase
          .from('planificaciones')
          .select('*')
          .or(`grupo_id.eq.${grupoId},grupo_id.is.null`)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[EvaluationSourceSelector] Error loading planificaciones:', error);
          if (import.meta.env.DEV) {
            console.log('[EvaluationSourceSelector] Query error details:', {
              grupoId,
              error: error.message,
              code: error.code
            });
          }
          setSavedPlanificaciones([]);
          return;
        }

        // Filter by is_saved in memory (for backward compat if column doesn't exist)
        const filtered = (data || []).filter(p => p.is_saved === true);
        
        if (import.meta.env.DEV) {
          console.log('[EvaluationSourceSelector] Query results:', {
            grupoId,
            totalResults: (data || []).length,
            savedResults: filtered.length,
            filters: 'grupo_id OR NULL, deleted_at IS NULL, is_saved=true'
          });
        }
        
        setSavedPlanificaciones(filtered);
      } finally {
        setIsLoadingPlanificaciones(false);
      }
    };

    loadPlanificaciones();
  }, [grupoId]);

  // Load sessions when planificacion is selected
  useEffect(() => {
    if (!config.planificacionId) {
      setAvailableSessions([]);
      return;
    }

    const loadSessions = async () => {
      setIsLoadingSessions(true);
      try {
        const { data, error } = await supabase
          .from('sesiones_clase')
          .select('*')
          .eq('planificacion_id', config.planificacionId)
          .order('orden', { ascending: true });

        if (error) {
          console.error('[EvaluationSourceSelector] Error loading sessions:', error);
          return;
        }

        setAvailableSessions(data || []);
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadSessions();
  }, [config.planificacionId]);

  const handlePlanificacionChange = (planificacionId: string) => {
    onChange({
      planificacionId,
      sessionIds: [], // Reset session selection
      evaluationFocus: config.evaluationFocus
    });
  };

  const handleSessionToggle = (sessionId: string, checked: boolean) => {
    const newSessionIds = checked
      ? [...config.sessionIds, sessionId]
      : config.sessionIds.filter(id => id !== sessionId);

    onChange({
      ...config,
      sessionIds: newSessionIds
    });
  };

  const handleFocusChange = (focus: string) => {
    onChange({
      ...config,
      evaluationFocus: focus
    });
  };

  const selectedPlanificacion = savedPlanificaciones.find(p => p.id === config.planificacionId);

  return (
    <Card className="border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Selecciona tu clase como fuente
        </CardTitle>
        <CardDescription>
          Selecciona una planificación guardada y las sesiones que quieres evaluar. 
          Esto es opcional - también puedes usar solo contenido ANEP o materiales docentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Planificacion selector */}
        <div className="space-y-2">
          <Label htmlFor="planificacion-selector">Planificación guardada</Label>
          <Select
            value={config.planificacionId || ''}
            onValueChange={handlePlanificacionChange}
            disabled={disabled || isLoadingPlanificaciones}
          >
            <SelectTrigger id="planificacion-selector" className="bg-white">
              <SelectValue placeholder={
                isLoadingPlanificaciones 
                  ? "Cargando..." 
                  : savedPlanificaciones.length === 0
                    ? "No hay planificaciones guardadas"
                    : "Selecciona una planificación"
              } />
            </SelectTrigger>
            <SelectContent className="bg-white max-h-[300px]">
              {savedPlanificaciones.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {isLoadingPlanificaciones 
                    ? 'Cargando...' 
                    : 'No hay planificaciones guardadas para este grupo'}
                </div>
              ) : (
                savedPlanificaciones.map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {plan.nombre || `${plan.materia}${plan.nivel ? ` - ${plan.nivel}` : ''}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {plan.fecha_inicio && plan.fecha_fin 
                          ? `${new Date(plan.fecha_inicio).toLocaleDateString('es-UY')} - ${new Date(plan.fecha_fin).toLocaleDateString('es-UY')}`
                          : plan.fecha_inicio 
                            ? new Date(plan.fecha_inicio).toLocaleDateString('es-UY')
                            : 'Sin fecha'}
                        {plan.cantidad_sesiones && ` • ${plan.cantidad_sesiones} sesiones`}
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {!grupoId && (
            <p className="text-sm text-amber-600">
              ⚠️ Primero selecciona un grupo para ver las planificaciones disponibles.
            </p>
          )}
        </div>

        {/* Sessions multi-selector */}
        {config.planificacionId && (
          <div className="space-y-2">
            <Label>Sesiones a evaluar ({config.sessionIds.length} seleccionadas)</Label>
            {isLoadingSessions ? (
              <p className="text-sm text-muted-foreground">Cargando sesiones...</p>
            ) : availableSessions.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Esta planificación no tiene sesiones todavía.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3 bg-white">
                {availableSessions.map(session => (
                  <label 
                    key={session.id}
                    className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={config.sessionIds.includes(session.id)}
                      onCheckedChange={(checked) => handleSessionToggle(session.id, !!checked)}
                      disabled={disabled}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Sesión {session.orden}
                        </Badge>
                        {session.titulo && (
                          <span className="text-sm font-medium truncate">
                            {session.titulo}
                          </span>
                        )}
                      </div>
                      {session.contenidos_anep && session.contenidos_anep.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {session.contenidos_anep.slice(0, 2).join(', ')}
                          {session.contenidos_anep.length > 2 && '...'}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
            {config.sessionIds.length === 0 && availableSessions.length > 0 && (
              <p className="text-sm text-amber-600">
                ⚠️ Selecciona al menos una sesión para continuar.
              </p>
            )}
          </div>
        )}

        {/* Evaluation focus textarea */}
        {config.planificacionId && config.sessionIds.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="evaluation-focus">
              ¿Qué quieres evaluar de estas sesiones? (opcional)
            </Label>
            <Textarea
              id="evaluation-focus"
              value={config.evaluationFocus}
              onChange={(e) => handleFocusChange(e.target.value)}
              placeholder="Ej: Comprensión de los conceptos principales, habilidades de análisis crítico, capacidad de aplicar lo aprendido en nuevos contextos..."
              className="min-h-[100px] bg-white"
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              Describe los aspectos específicos que quieres evaluar. 
              Esto ayudará a generar una evaluación más enfocada.
            </p>
          </div>
        )}

        {/* Info alert */}
        {!config.planificacionId && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Flexibilidad de evaluación:</strong> Puedes crear evaluaciones basadas en sesiones 
              de tu planificación (opción B) o usando solo contenido ANEP (opción A tradicional). 
              Ambas opciones son válidas.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

