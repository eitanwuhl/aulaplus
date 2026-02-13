/**
 * PlanningAIDesignReport
 * 
 * Component for displaying AI design report for lesson plans.
 * Shows narrative report if available, otherwise shows legacy structured report.
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';

export interface PlanningAIDesignReportData {
  narrative?: string;  // Teacher-friendly narrative report (new)
  report_narrative?: string;
  report_technical?: unknown;
  inputsUsed?: {
    anepContent?: boolean;
    materials?: boolean;
    sessionBrief?: boolean;
    unitContext?: boolean;
  };
  decisions?: {
    structure?: string;
    timeAllocation?: string;
  };
  assumptions?: string[];
  contentCoverage?: Array<{
    sourceType: 'uploaded_material' | 'anep' | 'teacher_requirements' | 'inferred';
    sourceId?: string;
    coveredPart: string;
    whyThisPartInThisClass: string;
    howItIsWorked: string;
    assessmentOrEvidence?: string;
    evidenceOrCheck?: string;
    relatedCompetencies?: string[];
  }>;
  competencyDevelopment?: Array<{
    competency: string;
    howDevelopedInThisClass: string;
    linkedActivities: string[];
  }>;
  teacherRequirementsApplied?: Array<{
    requirement: string;
    howItWasSatisfied: string;
  }>;
  standardsCoverage?: Array<{
    standard: string;
    whyPrioritized: string;
    howCovered: string;
    evidence: string;
  }>;
  competenciesOperationalization?: Array<{
    competency: string;
    concreteDevelopment: string;
    specificActivities: string[];
    learningEvidence: string;
  }>;
}

interface PlanningAIDesignReportProps {
  reportData: PlanningAIDesignReportData | null;
  className?: string;
  sessionCompetencies?: string[];
  sessionTitle?: string;
}

export function PlanningAIDesignReport({
  reportData,
  className = '',
  sessionCompetencies = [],
  sessionTitle
}: PlanningAIDesignReportProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  if (!reportData) return null;
  
  const narrativeText = useMemo(() => {
    const directNarrative = typeof reportData.report_narrative === 'string'
      ? reportData.report_narrative.trim()
      : (typeof reportData.narrative === 'string' ? reportData.narrative.trim() : '');
    if (directNarrative.length > 0) return directNarrative;

    // Fallback amigable para docentes cuando falta narrative
    const competencias = sessionCompetencies.filter(Boolean);
    const competenciasTexto = competencias.length > 0
      ? `Las competencias priorizadas en esta clase son ${competencias.join(', ')}.`
      : 'No hay competencias específicas registradas para esta clase.';

    const contentFocus =
      reportData.contentCoverage?.[0]?.coveredPart ||
      reportData.decisions?.structure ||
      'se trabajó el contenido planificado para la sesión seleccionada';

    const howWorked =
      reportData.contentCoverage?.[0]?.howItIsWorked ||
      reportData.decisions?.timeAllocation ||
      'mediante una secuencia de inicio, desarrollo y cierre adaptada al grupo';

    const requirementApplied = reportData.teacherRequirementsApplied?.[0]?.howItWasSatisfied;

    return [
      `${sessionTitle ? `En ${sessionTitle}` : 'En esta sesión'}, ${contentFocus}.`,
      `El trabajo en aula se organizó ${howWorked}, con foco en continuidad pedagógica y claridad para el grupo.`,
      competenciasTexto,
      requirementApplied
        ? `Además, se atendieron los requerimientos docentes de la sesión: ${requirementApplied}.`
        : 'No se registraron requerimientos docentes adicionales para esta sesión.'
    ].join('\n\n');
  }, [reportData, sessionCompetencies, sessionTitle]);

  // Check for narrative - it should always be visible if present
  const hasNarrative = narrativeText.length > 0;
  
  // Check if there are structured details to show
  const hasStructuredDetails =
    !!reportData.report_technical ||
    reportData.decisions?.structure || 
    reportData.decisions?.timeAllocation ||
    reportData.inputsUsed ||
    (reportData.assumptions && reportData.assumptions.length > 0) ||
    (reportData.contentCoverage && reportData.contentCoverage.length > 0) ||
    (reportData.competencyDevelopment && reportData.competencyDevelopment.length > 0) ||
    (reportData.teacherRequirementsApplied && reportData.teacherRequirementsApplied.length > 0) ||
    (reportData.standardsCoverage && reportData.standardsCoverage.length > 0) ||
    (reportData.competenciesOperationalization && reportData.competenciesOperationalization.length > 0);
  
  return (
    <Card className={`border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5" />
            Reporte de IA
            <Badge variant="secondary" className="text-xs">Solo docente</Badge>
          </CardTitle>
          {hasStructuredDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="ml-auto"
            >
                {detailsOpen ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Ocultar detalle técnico
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Ver detalle técnico
                </>
              )}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {hasNarrative 
            ? 'Explicación narrativa del diseño del plan de clase'
            : 'Explicación del diseño del plan de clase'}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* PART B: Narrative report - ALWAYS VISIBLE if present (primary content) */}
        {hasNarrative && (
          <div className="space-y-2">
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {narrativeText}
              </p>
            </div>
          </div>
        )}
        
        {/* PART B: Details accordion - structured legacy sections + new arrays */}
        {hasStructuredDetails && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleContent>
              <div className="space-y-6 border-t pt-4">
                {reportData.report_technical && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Detalle técnico (raw)</h4>
                    <pre className="text-xs rounded bg-muted p-3 overflow-auto whitespace-pre-wrap">
                      {typeof reportData.report_technical === 'string'
                        ? reportData.report_technical
                        : JSON.stringify(reportData.report_technical, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Content Coverage */}
                {reportData.contentCoverage && reportData.contentCoverage.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Cobertura de Contenidos</h4>
                    {reportData.contentCoverage.map((coverage, idx) => (
                      <div key={idx} className="pl-4 border-l-2 border-blue-200 dark:border-blue-800 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {coverage.sourceType === 'uploaded_material' ? 'Material subido' :
                             coverage.sourceType === 'anep' ? 'ANEP' :
                             coverage.sourceType === 'teacher_requirements' ? 'Requerimiento docente' :
                             'Inferido'}
                          </Badge>
                          <span className="font-medium text-sm">{coverage.coveredPart}</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <strong>Por qué en esta clase:</strong> {coverage.whyThisPartInThisClass}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <strong>Cómo se trabaja:</strong> {coverage.howItIsWorked}
                        </p>
                        {(coverage.assessmentOrEvidence || coverage.evidenceOrCheck) && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            <strong>Evidencia:</strong> {coverage.assessmentOrEvidence || coverage.evidenceOrCheck}
                          </p>
                        )}
                        {coverage.relatedCompetencies && coverage.relatedCompetencies.length > 0 && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            <strong>Competencias relacionadas:</strong> {coverage.relatedCompetencies.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Competency Development */}
                {reportData.competencyDevelopment && reportData.competencyDevelopment.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Desarrollo de Competencias</h4>
                    {reportData.competencyDevelopment.map((dev, idx) => (
                      <div key={idx} className="pl-4 border-l-2 border-green-200 dark:border-green-800 space-y-2">
                        <p className="font-medium text-sm">{dev.competency}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{dev.howDevelopedInThisClass}</p>
                        {dev.linkedActivities && dev.linkedActivities.length > 0 && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            <strong>Actividades:</strong> {dev.linkedActivities.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Teacher Requirements Applied */}
                {reportData.teacherRequirementsApplied && reportData.teacherRequirementsApplied.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Requerimientos del Docente Aplicados</h4>
                    {reportData.teacherRequirementsApplied.map((req, idx) => (
                      <div key={idx} className="pl-4 border-l-2 border-purple-200 dark:border-purple-800 space-y-2">
                        <p className="font-medium text-sm">{req.requirement}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{req.howItWasSatisfied}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* GOAL C: Standards Coverage */}
                {reportData.standardsCoverage && reportData.standardsCoverage.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Cobertura de Estándares ANEP</h4>
                    {reportData.standardsCoverage.map((std, idx) => (
                      <div key={idx} className="pl-4 border-l-2 border-orange-200 dark:border-orange-800 space-y-2">
                        <p className="font-medium text-sm">{std.standard}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <strong>Por qué se priorizó:</strong> {std.whyPrioritized}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <strong>Cómo se cubre:</strong> {std.howCovered}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <strong>Evidencia:</strong> {std.evidence}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* GOAL C: Competencies Operationalization */}
                {reportData.competenciesOperationalization && reportData.competenciesOperationalization.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Operacionalización de Competencias</h4>
                    {reportData.competenciesOperationalization.map((comp, idx) => (
                      <div key={idx} className="pl-4 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-2">
                        <p className="font-medium text-sm">{comp.competency}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{comp.concreteDevelopment}</p>
                        {comp.specificActivities && comp.specificActivities.length > 0 && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            <strong>Actividades específicas:</strong> {comp.specificActivities.join(', ')}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          <strong>Evidencia de aprendizaje:</strong> {comp.learningEvidence}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Legacy structured sections */}
                {reportData.decisions?.structure && (
                  <div className="space-y-2 border-t pt-4">
                    <h4 className="font-semibold text-sm">Estructura</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {reportData.decisions.structure}
                    </p>
                  </div>
                )}
                
                {reportData.decisions?.timeAllocation && (
                  <div className="space-y-2 border-t pt-4">
                    <h4 className="font-semibold text-sm">Distribución de Tiempo</h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {reportData.decisions.timeAllocation}
                    </p>
                  </div>
                )}
                
                {reportData.inputsUsed && (
                  <div className="space-y-2 border-t pt-4">
                    <h4 className="font-semibold text-sm">Fuentes Utilizadas</h4>
                    <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                      {reportData.inputsUsed.anepContent && <li>Contenidos ANEP</li>}
                      {reportData.inputsUsed.materials && <li>Materiales del docente</li>}
                      {reportData.inputsUsed.sessionBrief && <li>Instrucciones específicas de sesión</li>}
                      {reportData.inputsUsed.unitContext && <li>Contexto de unidad</li>}
                    </ul>
                  </div>
                )}
                
                {reportData.assumptions && reportData.assumptions.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <h4 className="font-semibold text-sm">Supuestos</h4>
                    <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
                      {reportData.assumptions.map((assumption, idx) => (
                        <li key={idx}>{assumption}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {!hasNarrative && (
          <div className="text-sm text-muted-foreground italic p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            No hay narrativa disponible para esta sesión.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
