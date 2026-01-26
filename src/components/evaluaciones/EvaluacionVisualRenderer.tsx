import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Edit, RefreshCw } from 'lucide-react';
import { EvaluationInfoHeader } from './EvaluationInfoHeader';
import { CleanEvaluationDisplay } from './CleanEvaluationDisplay';
import { EnhancedVersionPersonalization } from './EnhancedVersionPersonalization';
import { SimplifiedSmartRubric } from './SimplifiedSmartRubric';
import { DurationValidator } from '@/lib/durationValidator';
import { Clock } from 'lucide-react';
import RequirementParser from './RequirementParser';

interface EvaluacionVisualRendererProps {
  evaluation: {
    id: string;
    title: string;
    content: string;
    version: number;
    adaptations?: string[];
    assignedStudents?: string[];  // Legacy: Student names (for backward compatibility)
    assignedStudentIds?: (string | number)[];  // NEW: Student IDs assigned to this version
  };
  subject?: string;
  selectedContent?: { nombre: string }[];
  duration?: string;
  requirements?: string;
  onFeedback?: (evaluationId: string, feedback: string) => void;
  onRegenerate?: (evaluationId: string) => void;
  // Nuevos props para personalización
  students?: Array<{
    id: number;
    name: string;
    contemplaciones: string[];
    informeTecnico?: { modalidadCursado: string };
  }>;
  criteriosLogro?: string[];
}

export const EvaluacionVisualRenderer: React.FC<EvaluacionVisualRendererProps> = ({
  evaluation,
  subject,
  selectedContent,
  duration = "80 minutos",
  requirements,
  onFeedback,
  onRegenerate,
  students = [],
  criteriosLogro = []
}) => {
  const [adjustmentRequest, setAdjustmentRequest] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Validar duración de la evaluación
  const durationValidation = DurationValidator.validateFor90Minutes(evaluation.content);

  return (
    <div className="space-y-8 max-w-none">
      {/* 1. INFORMACIÓN GENERAL - Diseño sobrio y profesional */}
      <Card className="border-0 shadow">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <div className="text-muted-foreground font-medium">Materia</div>
              <div className="font-semibold text-foreground">{subject || "Historia"}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-medium">Tiempo</div>
              <div className="font-semibold text-foreground">{duration}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-medium">Modalidad</div>
              <div className="font-semibold text-foreground">Escrito formal</div>
            </div>
            <div>
              <div className="text-muted-foreground font-medium">Formato</div>
              <div className="font-semibold text-foreground">Parcial cuatrimestral</div>
            </div>
          </div>
          {selectedContent && selectedContent.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-muted-foreground font-medium text-sm mb-2">Contenidos seleccionados</div>
              <div className="flex flex-wrap gap-2">
                {selectedContent.map((content, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {content.nombre}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. EVALUACIÓN LIMPIA - Instrumento listo para aplicar */}
      <Card className="border-0 shadow">
        <CardContent className="p-8">
          <CleanEvaluationDisplay evaluation={evaluation} />
        </CardContent>
      </Card>

      {/* 3. RÚBRICA GLOBAL ÚNICA - Derivada de criterios ANEP con estudiantes contemplados integrados */}
      <Card className="border-0 shadow">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold text-foreground">Rúbrica de Evaluación</CardTitle>
          <div className="text-sm text-muted-foreground">
            Criterios de logro derivados de competencias ANEP seleccionadas
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <SimplifiedSmartRubric
            evaluationContent={evaluation.content}
            criteriosLogro={criteriosLogro}
            version={String(evaluation.version)}
            students={students}
            assignedStudents={evaluation.assignedStudents}
            assignedStudentIds={evaluation.assignedStudentIds}
          />
        </CardContent>
      </Card>

      {/* 4. REQUERIMIENTOS DEL DOCENTE - Si existen */}
      {requirements && (
        <Card className="border-0 shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-foreground">Requerimientos Específicos</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <RequirementParser 
              requirements={requirements}
              evaluationContent={evaluation.content}
            />
          </CardContent>
        </Card>
      )}

      {/* 5. SOLICITAR AJUSTES - Campo limpio sin decoración */}
      <Card className="border-0 shadow">
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Solicitar ajustes a esta versión
            </h3>
            
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Edit className="w-4 h-4 mr-2" />
                Escribir solicitud de ajustes
              </Button>
            ) : (
              <div className="space-y-3">
                <Textarea
                  placeholder="Describe qué cambios necesitas en esta evaluación..."
                  value={adjustmentRequest}
                  onChange={(e) => setAdjustmentRequest(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (adjustmentRequest.trim() && onFeedback) {
                        onFeedback(evaluation.id, adjustmentRequest);
                        setAdjustmentRequest('');
                        setIsEditing(false);
                      }
                    }}
                    disabled={!adjustmentRequest.trim()}
                    size="sm"
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Aplicar cambios
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditing(false);
                      setAdjustmentRequest('');
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvaluacionVisualRenderer;