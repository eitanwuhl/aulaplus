import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EvaluacionVisualRenderer, EvaluationAssignmentsPanel, TeacherRemindersPanel } from '@/components/evaluaciones';
import { getSubtemaPorId } from '@/data/catalogo';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { mockGroups } from '@/data/mockData';

interface Evaluacion {
  id: string;
  user_id: string;
  nombre: string;
  materia: string;
  grupo_id: string;
  nivel?: string;
  fecha: string | null;
  competencias_anep: string[];
  contenidos?: string[];
  criterios_logro?: string[];
  requerimientos?: string;
  evaluacion_generada?: {
    evaluaciones?: Array<{
      id: string;
      title: string;
      content: string;
      version: number;
      versionLabel?: string;
      versionKind?: string;
      adaptations?: string[];
      assignedStudents?: string[];  // Legacy: Student names (for backward compatibility)
      assignedStudentIds?: (string | number)[];  // NEW: Student IDs assigned to this version
    }>;
    base_prototype?: string;
    evaluation_bundle?: {
      baseHtml?: string;
      versionBHtml?: string | null;
      versionCHtml?: string | null;
      responseOptionsIncluded?: boolean;
      responseOptionCount?: number;
    };
    evaluation_design_plan?: {
      assignmentByStudentId?: Record<string, 'A' | 'B' | 'C'>;
      perStudentReminders?: Array<{
        studentId: string | number;
        admin: string[];
        correction: string[];
        allowances: string[];
      }>;
    };
  };
  is_saved: boolean;
  saved_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const EvaluacionDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [evaluacion, setEvaluacion] = useState<Evaluacion | null>(null);
  const [students, setStudents] = useState<Array<{ id: number; name: string; contemplaciones: string[] }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargarEvaluacion = async () => {
      if (!id) {
        setError('ID de evaluación no proporcionado');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Load evaluation
        const { data: evalData, error: fetchError } = await supabase
          .from('evaluaciones')
          .select('*')
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!evalData) {
          setError('Evaluación no encontrada');
          setIsLoading(false);
          return;
        }

        const evaluacionData = evalData as unknown as Evaluacion;
        setEvaluacion(evaluacionData);

        // Load group to get students (needed for reminders calculation)
        // Note: Students are stored in mockData, not in Supabase grupos table
        if (evaluacionData.grupo_id) {
          // Try to find group in mockGroups (fallback for student data)
          const mockGroup = mockGroups.find(g => g.id === evaluacionData.grupo_id);
          if (mockGroup?.students) {
            setStudents(mockGroup.students);
            
            // DEV-ONLY: Diagnostic logging
            if (import.meta.env.DEV && (window as any).__CONTEMPLACIONES_DEBUG__ === true) {
              console.log('[EVALUACION DETALLE] Loaded students from mockGroup:', {
                grupoId: evaluacionData.grupo_id,
                studentsCount: mockGroup.students.length,
                studentIds: mockGroup.students.map(s => ({ id: s.id, name: s.name }))
              });
            }
          } else {
            console.warn('[EVALUACION DETALLE] ⚠️ Grupo no encontrado en mockData:', evaluacionData.grupo_id);
            console.warn('[EVALUACION DETALLE] Los recordatorios no se mostrarán. Grupos disponibles:', mockGroups.map(g => g.id));
            // Non-fatal: continue without students (reminders won't show but evaluation will)
            // Set empty array explicitly to avoid fallback to "first 4 students"
            setStudents([]);
          }
        } else {
          // No grupo_id, set empty array explicitly
          setStudents([]);
        }
      } catch (err: any) {
        console.error('[EVALUACION DETALLE] Error cargando evaluación:', err);
        setError(err.message || 'Error al cargar la evaluación');
        toast({
          title: "Error",
          description: "No se pudo cargar la evaluación",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    cargarEvaluacion();
  }, [id, toast]);

  // Render loading state
  if (isLoading) {
    return (
      <ErrorBoundary>
        <div className="container mx-auto py-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Cargando evaluación...</p>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Render error state
  if (error || !evaluacion) {
    return (
      <ErrorBoundary>
        <div className="container mx-auto py-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center max-w-md">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-semibold mb-2">
                {error || 'Evaluación no encontrada'}
              </h3>
              <p className="text-muted-foreground mb-6">
                La evaluación que buscas no existe o fue eliminada.
              </p>
              <Button onClick={() => navigate('/mis-evaluaciones')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a Mis Evaluaciones
              </Button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Get contenidos (subtemas) for display
  const selectedContent = evaluacion.contenidos?.map(id => {
    const subtema = getSubtemaPorId(id);
    return { nombre: subtema?.contenido || id };
  }).filter(Boolean) || [];

  const evaluationBundle = evaluacion.evaluacion_generada?.evaluation_bundle;
  const evaluationDesignPlan = evaluacion.evaluacion_generada?.evaluation_design_plan;

  const displayEvaluations = useMemo(() => {
    if (!evaluationBundle?.baseHtml) {
      return evaluacion.evaluacion_generada?.evaluaciones || [];
    }

    const assignmentByStudentId = evaluationDesignPlan?.assignmentByStudentId || {};
    const getAssigned = (kind: 'A' | 'B' | 'C') => {
      const assigned = students.filter(student => assignmentByStudentId[String(student.id)] === kind);
      return {
        ids: assigned.map(student => student.id),
        names: assigned.map(student => student.name || `Estudiante ${student.id}`)
      };
    };

    const baseAssigned = getAssigned('A');
    const base = {
      id: 'A',
      title: 'Versión A (Universal)',
      content: evaluationBundle.baseHtml || '',
      version: 1,
      versionKind: 'A',
      versionLabel: 'Versión A (Universal)',
      adaptations: [],
      assignedStudents: baseAssigned.names,
      assignedStudentIds: baseAssigned.ids
    };

    const evaluations = [base];

    if (evaluationBundle.versionBHtml) {
      const assigned = getAssigned('B');
      evaluations.push({
        id: 'B',
        title: 'Versión B (Equivalente)',
        content: evaluationBundle.versionBHtml,
        version: 2,
        versionKind: 'B',
        versionLabel: 'Versión B (Equivalente)',
        adaptations: [],
        assignedStudents: assigned.names,
        assignedStudentIds: assigned.ids
      });
    }

    if (evaluationBundle.versionCHtml) {
      const assigned = getAssigned('C');
      evaluations.push({
        id: 'C',
        title: 'Versión C (Adecuación de contenido)',
        content: evaluationBundle.versionCHtml,
        version: 3,
        versionKind: 'C',
        versionLabel: 'Versión C (Adecuación de contenido)',
        adaptations: [],
        assignedStudents: assigned.names,
        assignedStudentIds: assigned.ids
      });
    }

    return evaluations;
  }, [evaluationBundle, evaluationDesignPlan, evaluacion, students]);

  return (
    <ErrorBoundary>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/mis-evaluaciones')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{evaluacion.nombre}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">{evaluacion.materia}</Badge>
                <Badge variant="outline">{evaluacion.grupo_id}</Badge>
                {evaluacion.fecha && (
                  <span className="text-sm text-muted-foreground">
                    📅 {new Date(evaluacion.fecha).toLocaleDateString('es-ES')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Evaluaciones Generadas */}
        {displayEvaluations.length > 0 ? (
          <div className="space-y-8">
            {evaluationDesignPlan?.assignmentByStudentId && (
              <EvaluationAssignmentsPanel
                assignments={evaluationDesignPlan.assignmentByStudentId}
                students={students}
              />
            )}
            {evaluationDesignPlan?.perStudentReminders && (
              <TeacherRemindersPanel reminders={evaluationDesignPlan.perStudentReminders} students={students} />
            )}
            {displayEvaluations.map((evalItem) => (
              <EvaluacionVisualRenderer
                key={evalItem.id}
                evaluation={{
                  id: evalItem.id,
                  title: evalItem.title,
                  content: evalItem.content,
                  version: evalItem.version || 1,
                  versionKind: evalItem.versionKind,
                  versionLabel: evalItem.versionLabel,
                  adaptations: evalItem.adaptations,
                  assignedStudents: evalItem.assignedStudents,
                  assignedStudentIds: evalItem.assignedStudentIds
                }}
                subject={evaluacion.materia}
                selectedContent={selectedContent}
                duration="90 minutos"
                requirements={evaluacion.requerimientos}
                students={students}
                criteriosLogro={evaluacion.criterios_logro || []}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Esta evaluación no tiene contenido generado.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default EvaluacionDetalle;














