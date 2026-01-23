import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EvaluacionVisualRenderer } from '@/components/evaluaciones/EvaluacionVisualRenderer';
import { getSubtemaPorId } from '@/data/catalogo';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
      adaptations?: string[];
      assignedStudents?: string[];
    }>;
    base_prototype?: string;
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
        const { data, error: fetchError } = await supabase
          .from('evaluaciones')
          .select('*')
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          setError('Evaluación no encontrada');
          setIsLoading(false);
          return;
        }

        setEvaluacion(data as unknown as Evaluacion);
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

  // Get evaluaciones from evaluacion_generada
  const evaluacionesGeneradas = evaluacion.evaluacion_generada?.evaluaciones || [];

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
        {evaluacionesGeneradas.length > 0 ? (
          <div className="space-y-8">
            {evaluacionesGeneradas.map((evalItem) => (
              <EvaluacionVisualRenderer
                key={evalItem.id}
                evaluation={{
                  id: evalItem.id,
                  title: evalItem.title,
                  content: evalItem.content,
                  version: evalItem.version || 1,
                  adaptations: evalItem.adaptations
                }}
                subject={evaluacion.materia}
                selectedContent={selectedContent}
                duration="90 minutos"
                requirements={evaluacion.requerimientos}
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














