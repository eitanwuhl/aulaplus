/**
 * EvaluationContentWrapper Component
 * 
 * Wraps both v1 (HTML) and v2 (JSON) evaluation renderers with:
 * - Version selector (A/B/C tabs)
 * - "View as student" selector
 * - PDF export button
 * 
 * This component ONLY handles the evaluation content area.
 * Other sections (reminders, rubric, etc.) are handled separately.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Download, 
  User, 
  Loader2, 
  AlertCircle,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CollapsibleSection from './CollapsibleSection';
import { EvaluacionVisualRenderer } from './EvaluacionVisualRenderer';
import { EvaluationRendererV2 } from './v2';
import type { V2Response } from '@/services/evaluations/v2Types';

// ============================================================================
// TYPES
// ============================================================================

interface Student {
  id: number | string;
  name: string;
  displayName?: string;
}

interface EvaluationVersion {
  id: string;
  content: string;
  versionLabel?: string;
  versionKind?: string;
}

interface EvaluationContentWrapperProps {
  /** Available evaluation versions (v1 HTML format) */
  versions: {
    A?: string | null;
    B?: string | null;
    C?: string | null;
  };
  /** V2 raw response for JSON-based rendering (optional) */
  v2Response?: V2Response | null;
  /** Whether to use v2 renderer (beta toggle) */
  useBetaV2?: boolean;
  /** Student assignments mapping: studentId -> version */
  studentAssignments?: Record<string, 'A' | 'B' | 'C'>;
  /** List of students for "view as" selector */
  students?: Student[];
  /** Subject name */
  subject?: string;
  /** Selected content items */
  selectedContent?: Array<{ nombre: string }>;
  /** Evaluation duration */
  duration?: string;
  /** Requirements text */
  requirements?: string;
  /** Selected criterios de logro */
  criteriosLogro?: string[];
  /** Whether evaluation is loading/generating */
  isLoading?: boolean;
  /** Show debug panel */
  showDebug?: boolean;
  /** Callback when v2 render fails */
  onV2RenderError?: (reason: string) => void;
  /** Feedback callback */
  onFeedback?: (evaluationId: string, feedback: string) => void;
  /** Regenerate callback */
  onRegenerate?: (evaluationId: string) => void;
}

// ============================================================================
// PDF EXPORT (Client-side)
// ============================================================================

const exportToPdf = async (
  contentRef: React.RefObject<HTMLDivElement>,
  filename: string,
  onError: (error: string) => void
): Promise<boolean> => {
  try {
    // Dynamically import html2pdf to avoid bundle bloat
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default;
    
    if (!contentRef.current) {
      throw new Error('No content to export');
    }

    const element = contentRef.current;
    
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' 
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf().set(opt).from(element).save();
    return true;
  } catch (error) {
    console.error('[PDF_EXPORT] Failed:', error);
    onError('No se pudo generar el PDF. Por favor, intentá nuevamente.');
    return false;
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EvaluationContentWrapper: React.FC<EvaluationContentWrapperProps> = ({
  versions,
  v2Response,
  useBetaV2 = false,
  studentAssignments = {},
  students = [],
  subject = '',
  selectedContent = [],
  duration = '90 minutos',
  requirements = '',
  criteriosLogro = [],
  isLoading = false,
  showDebug = false,
  onV2RenderError,
  onFeedback,
  onRegenerate,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  // State
  const [selectedVersion, setSelectedVersion] = useState<'A' | 'B' | 'C'>('A');
  const [viewAsStudentId, setViewAsStudentId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Determine available versions
  const availableVersions = useMemo(() => {
    const available: Array<'A' | 'B' | 'C'> = [];
    if (versions.A) available.push('A');
    if (versions.B) available.push('B');
    if (versions.C) available.push('C');
    return available;
  }, [versions]);

  // Get the version to display
  const displayVersion = useMemo(() => {
    // If viewing as student, use their assigned version
    if (viewAsStudentId && studentAssignments[viewAsStudentId]) {
      return studentAssignments[viewAsStudentId];
    }
    // Otherwise use selected version (if available) or first available
    if (availableVersions.includes(selectedVersion)) {
      return selectedVersion;
    }
    return availableVersions[0] || 'A';
  }, [viewAsStudentId, studentAssignments, selectedVersion, availableVersions]);

  // Get student name for view-as
  const viewAsStudentName = useMemo(() => {
    if (!viewAsStudentId) return null;
    const student = students.find(s => String(s.id) === viewAsStudentId);
    return student?.displayName || student?.name || `Estudiante ${viewAsStudentId}`;
  }, [viewAsStudentId, students]);

  // Handle PDF export
  const handleExportPdf = useCallback(async () => {
    setIsExporting(true);
    
    const versionLabel = viewAsStudentName 
      ? `${viewAsStudentName}-Version${displayVersion}`
      : `Version${displayVersion}`;
    const filename = `Evaluacion-${subject || 'Sin-Materia'}-${versionLabel}`;
    
    const success = await exportToPdf(
      contentRef,
      filename.replace(/\s+/g, '-'),
      (error) => {
        toast({
          title: 'Error al exportar',
          description: error,
          variant: 'destructive'
        });
      }
    );
    
    if (success) {
      toast({
        title: 'PDF generado',
        description: `Se descargó ${filename}.pdf`,
        duration: 3000
      });
    }
    
    setIsExporting(false);
  }, [contentRef, subject, displayVersion, viewAsStudentName, toast]);

  // Build evaluation object for v1 renderer
  const v1Evaluation = useMemo((): EvaluationVersion | null => {
    const content = versions[displayVersion];
    if (!content) return null;
    
    return {
      id: displayVersion,
      content,
      versionLabel: `Versión ${displayVersion}`,
      versionKind: displayVersion === 'A' ? 'universal' : 
                   displayVersion === 'B' ? 'formato_equivalente' : 'adecuacion_contenido'
    };
  }, [versions, displayVersion]);

  // No content available
  if (availableVersions.length === 0 && !v2Response) {
    return (
      <CollapsibleSection
        id="evaluation-content"
        title="Contenido de la Evaluación"
        icon={<FileText className="h-5 w-5 text-primary" />}
        defaultExpanded={true}
      >
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No hay contenido de evaluación disponible.</p>
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="evaluation-content"
      title="Contenido de la Evaluación"
      icon={<FileText className="h-5 w-5 text-primary" />}
      defaultExpanded={true}
      badge={
        useBetaV2 && v2Response && (
          <Badge variant="secondary" className="text-xs">
            v2 Beta
          </Badge>
        )
      }
    >
      {/* Toolbar: Version selector + View as student + PDF export */}
      <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b">
        {/* Version selector (only if multiple versions) */}
        {availableVersions.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Versión:</span>
            <Tabs 
              value={displayVersion} 
              onValueChange={(v) => {
                setSelectedVersion(v as 'A' | 'B' | 'C');
                setViewAsStudentId(null); // Clear view-as when manually selecting
              }}
            >
              <TabsList className="h-8">
                {availableVersions.map((v) => (
                  <TabsTrigger 
                    key={v} 
                    value={v}
                    className="px-3 h-7 text-xs"
                    disabled={viewAsStudentId !== null}
                  >
                    {v}
                    {v === 'A' && ' (Universal)'}
                    {v === 'B' && ' (Formato)'}
                    {v === 'C' && ' (Contenido)'}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* View as student selector */}
        {students.length > 0 && Object.keys(studentAssignments).length > 0 && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <Select
              value={viewAsStudentId || 'none'}
              onValueChange={(value) => setViewAsStudentId(value === 'none' ? null : value)}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Ver como estudiante..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Ver versión general</span>
                </SelectItem>
                {students.map((student) => {
                  const assignment = studentAssignments[String(student.id)];
                  if (!assignment) return null;
                  return (
                    <SelectItem key={student.id} value={String(student.id)}>
                      <div className="flex items-center gap-2">
                        <span>{student.displayName || student.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {assignment}
                        </Badge>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* View-as indicator */}
        {viewAsStudentName && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            Viendo como: {viewAsStudentName} (Versión {displayVersion})
          </Badge>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* PDF export button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPdf}
          disabled={isExporting || isLoading}
          className="gap-2"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isExporting ? 'Exportando...' : 'Descargar PDF'}
        </Button>
      </div>

      {/* Evaluation content (with ref for PDF export) */}
      <div ref={contentRef} className="evaluation-export-content">
        {/* Show which version is being displayed */}
        <div className="mb-4 text-sm text-muted-foreground">
          Mostrando: <span className="font-medium">Versión {displayVersion}</span>
          {displayVersion === 'A' && ' — Universal (todos los estudiantes)'}
          {displayVersion === 'B' && ' — Formato equivalente (alta estructuración)'}
          {displayVersion === 'C' && ' — Adecuación de contenido'}
        </div>

        {/* V2 Renderer (JSON-based) */}
        {useBetaV2 && v2Response ? (
          <EvaluationRendererV2
            v2Response={v2Response}
            selectedVersion={displayVersion}
            isLoading={isLoading}
            showDebug={showDebug}
            onRenderError={onV2RenderError}
          />
        ) : v1Evaluation ? (
          /* V1 Renderer (HTML-based) */
          <EvaluacionVisualRenderer
            evaluation={{
              id: v1Evaluation.id,
              title: `Versión ${v1Evaluation.id}`,
              content: v1Evaluation.content,
              version: v1Evaluation.id === 'A' ? 1 : v1Evaluation.id === 'B' ? 2 : 3,
              versionLabel: v1Evaluation.versionLabel,
              versionKind: v1Evaluation.versionKind,
              adaptations: [],
              assignedStudents: [],
            }}
            subject={subject}
            selectedContent={selectedContent}
            duration={duration}
            requirements={requirements}
            students={students as any}
            criteriosLogro={criteriosLogro}
            onFeedback={onFeedback}
            onRegenerate={onRegenerate}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No hay contenido disponible para la versión {displayVersion}.</p>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default EvaluationContentWrapper;
