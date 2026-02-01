/**
 * AIDesignReport
 * 
 * Collapsible component showing AI generation rationale and coverage mapping
 * PHASE 6: Time Budgeting + AI Design Report
 * 
 * IMPORTANT: This is TEACHER-ONLY. NO per-student instructions or recommendations.
 * Student-specific guidance stays in existing "casillas".
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, FileText, Lightbulb } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';

export interface AIDesignReportData {
  rationale?: string;  // Global design rationale (legacy)
  coverageMapping?: {
    sessionId: string;
    sessionTitle: string;
    sectionsIncluded: string[];  // Which evaluation sections cover this session
  }[];
  materialsUsage?: {
    materialId: string;
    materialTitle: string;
    usageDescription: string;  // How/where the material was used
  }[];
  adaptationNotes?: string;  // How contemplaciones were applied (global, not per-student)
  versions?: {
    generated?: string[];
    reason?: string;
  };
  contemplaciones?: {
    instrument_design?: string[];
    admin_reminders?: string[];
    correction_reminders?: string[];
  };
  response_options?: {
    included?: boolean;
    optionCount?: number;
    rationale?: string;
  };
  vark?: {
    summary?: string;
  };
  assignments?: {
    rationale?: string;
  };
  warnings?: string[];
}

interface AIDesignReportProps {
  reportData: AIDesignReportData | null;
  className?: string;
}

export function AIDesignReport({ reportData, className = '' }: AIDesignReportProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!reportData) return null;
  
  return (
    <Card className={`border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5" />
            Reporte de IA
            <Badge variant="secondary" className="text-xs">Solo docente</Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="ml-auto"
          >
            {isOpen ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Ver detalles
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Explicación global de por qué se generaron versiones, opciones y recordatorios
        </p>
      </CardHeader>
      
      <Collapsible open={isOpen}>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {(reportData.rationale || reportData.versions?.reason) && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Justificación
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {reportData.versions?.reason || reportData.rationale}
                </p>
              </div>
            )}

            {reportData.response_options && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm">Opciones equivalentes</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {reportData.response_options.included
                    ? `Incluidas (${reportData.response_options.optionCount || 2} opciones). ${reportData.response_options.rationale || ''}`.trim()
                    : 'No se incluyeron opciones equivalentes.'}
                </p>
              </div>
            )}

            {reportData.vark?.summary && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm">Diversidad de formatos</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {reportData.vark.summary}
                </p>
              </div>
            )}

            {reportData.assignments?.rationale && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm">Asignaciones</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {reportData.assignments.rationale}
                </p>
              </div>
            )}

            {reportData.warnings && reportData.warnings.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm text-amber-700">Advertencias</h4>
                <ul className="list-disc pl-5 text-sm text-amber-700 dark:text-amber-300">
                  {reportData.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Coverage Mapping (Sessions → Evaluation sections) */}
            {reportData.coverageMapping && reportData.coverageMapping.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm">Mapeo de Cobertura (Sesiones → Secciones)</h4>
                <div className="space-y-2">
                  {reportData.coverageMapping.map((mapping, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded border">
                      <div className="flex items-start gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {mapping.sessionTitle || `Sesión ${idx + 1}`}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong className="text-foreground">Evaluado en:</strong>{' '}
                        {mapping.sectionsIncluded.length > 0
                          ? mapping.sectionsIncluded.join(', ')
                          : 'No especificado'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Materials Usage */}
            {reportData.materialsUsage && reportData.materialsUsage.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm">Uso de Materiales Docentes</h4>
                <div className="space-y-2">
                  {reportData.materialsUsage.map((usage, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded border">
                      <div className="flex items-start gap-2 mb-1">
                        <FileText className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{usage.materialTitle}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {usage.usageDescription}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Adaptation Notes (global, NOT per-student) */}
            {reportData.adaptationNotes && (
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm">Notas de Adaptación</h4>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {reportData.adaptationNotes}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Las recomendaciones específicas por estudiante están en las "casillas" de cada versión.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

