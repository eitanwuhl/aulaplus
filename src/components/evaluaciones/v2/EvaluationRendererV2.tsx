/**
 * V2 Evaluation Renderer - Main Component
 * 
 * Renders a complete evaluation from normalized v2 JSON data.
 * No HTML, no dangerouslySetInnerHTML - pure React components.
 * 
 * Phase 4: JSON-based rendering
 */

import React, { useMemo, useState, useRef } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, FileWarning, Bug, Download, FileText } from 'lucide-react';
import { 
  V2Response, 
  NormalizedEvaluation, 
  NormalizationResult 
} from '@/services/evaluations/v2Types';
import { normalizeV2Response, canRenderV2 } from '@/services/evaluations/v2Normalizer';
import EvalHeader from './EvalHeader';
import MapTable from './MapTable';
import EvalSection from './EvalSection';

// ============================================================================
// TYPES
// ============================================================================

interface EvaluationRendererV2Props {
  /** Raw v2 response from the API */
  v2Response: V2Response | null;
  /** Which version to render (A, B, or C) - controlled externally or internally */
  selectedVersion?: 'A' | 'B' | 'C';
  /** Callback when version changes */
  onVersionChange?: (version: 'A' | 'B' | 'C') => void;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when v2 cannot be rendered (triggers fallback to v1) */
  onRenderError?: (reason: string) => void;
  /** Show debug panel (controlled by env flag) */
  showDebug?: boolean;
}

// ============================================================================
// LOADING STATE
// ============================================================================

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </CardContent>
    </Card>
  </div>
);

// ============================================================================
// ERROR STATE
// ============================================================================

interface ErrorDisplayProps {
  title: string;
  description: string;
  details?: string[];
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ title, description, details }) => (
  <Alert variant="destructive" className="border-2">
    <AlertTriangle className="h-5 w-5" />
    <AlertTitle className="text-lg">{title}</AlertTitle>
    <AlertDescription>
      <p className="mb-2">{description}</p>
      {details && details.length > 0 && (
        <ul className="list-disc list-inside text-sm mt-2 space-y-1">
          {details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </AlertDescription>
  </Alert>
);

// ============================================================================
// DEBUG PANEL
// ============================================================================

interface DebugPanelProps {
  normalization: NormalizationResult;
  rawResponse: V2Response | null;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ normalization, rawResponse }) => {
  const showDebug = import.meta.env.VITE_DEBUG_EVAL_PIPELINE === 'true';
  
  if (!showDebug) return null;

  return (
    <Card className="border-2 border-dashed border-purple-400 bg-purple-50 dark:bg-purple-950/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bug className="h-4 w-4 text-purple-600" />
          <span className="font-mono text-sm font-bold text-purple-600">
            V2 Renderer Debug
          </span>
        </div>
        
        <div className="space-y-2 text-xs font-mono">
          <div>
            <strong>Normalization success:</strong> {normalization.success ? '✅' : '❌'}
          </div>
          
          {normalization.warnings.length > 0 && (
            <div>
              <strong>Warnings ({normalization.warnings.length}):</strong>
              <ul className="list-disc list-inside ml-2">
                {normalization.warnings.map((w, i) => (
                  <li key={i} className="text-amber-600">{w}</li>
                ))}
              </ul>
            </div>
          )}
          
          {normalization.errors.length > 0 && (
            <div>
              <strong>Errors ({normalization.errors.length}):</strong>
              <ul className="list-disc list-inside ml-2">
                {normalization.errors.map((e, i) => (
                  <li key={i} className="text-red-600">{e}</li>
                ))}
              </ul>
            </div>
          )}
          
          {normalization.evaluation && (
            <div>
              <strong>Normalized data:</strong>
              <div className="mt-1 p-2 bg-white dark:bg-gray-900 rounded border max-h-40 overflow-auto">
                <pre className="text-[10px]">
                  {JSON.stringify({
                    sections: normalization.evaluation.sections.length,
                    totalItems: normalization.evaluation.totalItems,
                    totalPoints: normalization.evaluation.totalPoints,
                    versions: normalization.evaluation.availableVersions.map(v => v.key),
                  }, null, 2)}
                </pre>
              </div>
            </div>
          )}
          
          {rawResponse?.debug && (
            <div>
              <strong>API Debug:</strong>
              <span className="ml-2">
                model={rawResponse.debug.model}, 
                attempt={rawResponse.debug.attempt},
                extraction={rawResponse.debug.extractionMethod}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// WARNINGS DISPLAY
// ============================================================================

interface WarningsDisplayProps {
  warnings: string[];
}

const WarningsDisplay: React.FC<WarningsDisplayProps> = ({ warnings }) => {
  if (warnings.length === 0) return null;

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
      <FileWarning className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        Advertencias de normalización
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 mt-1">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EvaluationRendererV2: React.FC<EvaluationRendererV2Props> = ({
  v2Response,
  selectedVersion: externalVersion,
  onVersionChange,
  isLoading = false,
  onRenderError,
  showDebug,
}) => {
  // Internal version state if not controlled externally
  const [internalVersion, setInternalVersion] = useState<'A' | 'B' | 'C'>('A');
  const selectedVersion = externalVersion ?? internalVersion;
  
  // Ref for PDF export
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // DEBUG: Log every render to diagnose blank screen
  console.log('[V2_RENDERER] Render called', {
    hasV2Response: !!v2Response,
    v2ResponseSuccess: v2Response?.success,
    hasEvaluationSpec: !!v2Response?.evaluationSpec,
    sectionsCount: v2Response?.evaluationSpec?.sections?.length,
    selectedVersion,
    isLoading
  });

  // Effective version: only use selectedVersion if it was actually generated (requestedVersions); otherwise A or first available
  const effectiveVersion = ((): 'A' | 'B' | 'C' => {
    const rv = v2Response?.requestedVersions;
    if (!rv) return 'A';
    if (rv[selectedVersion]) return selectedVersion;
    if (rv.A) return 'A';
    if (rv.B) return 'B';
    if (rv.C) return 'C';
    return 'A';
  })();

  // Normalize the response with effectiveVersion so content matches what we show (never render "B" content when only A exists)
  const normalization = useMemo<NormalizationResult>(() => {
    if (!v2Response) {
      console.warn('[V2_RENDERER] No v2Response provided');
      return {
        success: false,
        evaluation: null,
        warnings: [],
        errors: ['No v2 response provided'],
      };
    }

    // Check if response can be rendered
    const canRender = canRenderV2(v2Response);
    console.log('[V2_RENDERER] canRenderV2 result:', canRender, {
      success: v2Response.success,
      hasSpec: !!v2Response.evaluationSpec,
      sectionsLength: v2Response.evaluationSpec?.sections?.length,
      firstSectionItems: v2Response.evaluationSpec?.sections?.[0]?.items?.length
    });
    
    if (!canRender) {
      return {
        success: false,
        evaluation: null,
        warnings: [],
        errors: ['V2 response does not meet minimum rendering requirements'],
      };
    }

    const result = normalizeV2Response(v2Response, effectiveVersion);
    console.log('[V2_RENDERER] normalization result:', {
      success: result.success,
      hasEvaluation: !!result.evaluation,
      sectionsCount: result.evaluation?.sections?.length,
      effectiveVersion,
      warnings: result.warnings,
      errors: result.errors
    });
    return result;
  }, [v2Response, effectiveVersion]);

  // Trigger fallback callback if normalization failed
  // BUT do NOT trigger immediately - give UI a chance to show error state
  React.useEffect(() => {
    if (!normalization.success && onRenderError && v2Response) {
      const reason = normalization.errors.join('; ') || 'Unknown normalization error';
      console.warn('[V2_RENDERER] Normalization failed, will trigger fallback:', reason);
      // Delay fallback to allow error UI to render first
      const timer = setTimeout(() => {
        onRenderError(reason);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [normalization.success, normalization.errors, onRenderError, v2Response]);

  // Sync parent selectedVersion when current selection is not in available versions (e.g. only A generated but state was B)
  React.useEffect(() => {
    if (!normalization.success || !normalization.evaluation?.availableVersions?.length || !onVersionChange) return;
    const available = normalization.evaluation.availableVersions.map((v) => v.key);
    if (!available.includes(selectedVersion)) {
      const first = normalization.evaluation.availableVersions[0]?.key ?? 'A';
      onVersionChange(first);
    }
  }, [normalization.success, normalization.evaluation?.availableVersions, selectedVersion, onVersionChange]);

  // Handle version change
  const handleVersionChange = (version: 'A' | 'B' | 'C') => {
    if (onVersionChange) {
      onVersionChange(version);
    } else {
      setInternalVersion(version);
    }
  };

  /**
   * PDF Export using html2canvas + jsPDF
   * 
   * CONFIGURATION NOTES:
   * - A4 dimensions: 210mm x 297mm
   * - Printable area with 10mm margins: 190mm x 277mm
   * - At 96 DPI: 190mm ≈ 718px, 277mm ≈ 1046px per page
   * - Scale factor of 2 gives crisp text at 192 DPI effective
   * 
   * TO ADJUST MARGINS:
   * - Change PDF_MARGIN_MM for overall margin
   * - Modify .pdf-export-mode width in index.css for content width
   * 
   * TO ADJUST SCALE:
   * - Increase html2canvas scale for sharper output (2-3 recommended)
   * - Higher scale = larger file size
   */
  const handleExportPdf = async () => {
    if (!contentRef.current || isExportingPdf) return;
    
    setIsExportingPdf(true);
    
    // Constants for A4 PDF
    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;
    const PDF_MARGIN_MM = 10; // Margin on all sides
    const PRINTABLE_WIDTH_MM = A4_WIDTH_MM - (PDF_MARGIN_MM * 2); // 190mm
    const PRINTABLE_HEIGHT_MM = A4_HEIGHT_MM - (PDF_MARGIN_MM * 2); // 277mm
    
    // Capture width in pixels (at 96 DPI: 190mm ≈ 718px)
    const CAPTURE_WIDTH_PX = Math.round((PRINTABLE_WIDTH_MM / 25.4) * 96); // ~718px
    
    try {
      // Dynamic imports
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const element = contentRef.current;
      
      // Store original styles
      const originalWidth = element.style.width;
      const originalMaxWidth = element.style.maxWidth;
      const originalClassName = element.className;
      
      // Apply PDF export mode for clean capture
      // This sets fixed width and PDF-friendly styles
      element.classList.add('pdf-export-mode');
      element.style.width = `${CAPTURE_WIDTH_PX}px`;
      element.style.maxWidth = `${CAPTURE_WIDTH_PX}px`;
      
      // Wait for styles to apply and re-render
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture with html2canvas
      const canvas = await html2canvas(element, {
        scale: 2, // 2x scale for crisp text (effective 192 DPI)
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: CAPTURE_WIDTH_PX,
        windowWidth: CAPTURE_WIDTH_PX,
        // Remove any scroll to capture full content
        scrollX: 0,
        scrollY: 0,
        // Ensure we capture the full height
        height: element.scrollHeight,
      });
      
      // Restore original styles immediately
      element.classList.remove('pdf-export-mode');
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      
      // Calculate dimensions for PDF
      const imgWidth = PRINTABLE_WIDTH_MM;
      const imgHeight = (canvas.height * PRINTABLE_WIDTH_MM) / canvas.width;
      
      // Convert canvas to image
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Add pages as needed
      let heightRemaining = imgHeight;
      let currentY = 0;
      let pageNum = 0;
      
      while (heightRemaining > 0) {
        if (pageNum > 0) {
          pdf.addPage();
        }
        
        // Calculate the slice position
        const sourceY = pageNum * PRINTABLE_HEIGHT_MM;
        
        // Add the image with offset to show the correct portion
        pdf.addImage(
          imgData,
          'PNG',
          PDF_MARGIN_MM,
          PDF_MARGIN_MM - sourceY,
          imgWidth,
          imgHeight,
          undefined,
          'FAST'
        );
        
        // Clip to printable area (hide overflow from previous/next pages)
        // This is handled by adding each page and positioning the image
        
        heightRemaining -= PRINTABLE_HEIGHT_MM;
        pageNum++;
        
        // Safety limit to prevent infinite loops
        if (pageNum > 50) {
          console.warn('[PDF_EXPORT] Too many pages, stopping at 50');
          break;
        }
      }
      
      // Generate filename with version
      const subject = normalization.evaluation?.subject?.replace(/[^a-zA-Z0-9]/g, '_') || 'evaluacion';
      const date = new Date().toISOString().split('T')[0];
      const filename = `${subject}_v${selectedVersion}_${date}.pdf`;
      
      // Save the PDF
      pdf.save(filename);
      
      console.log('[PDF_EXPORT] Success', {
        pages: pageNum,
        canvasSize: { width: canvas.width, height: canvas.height },
        pdfSize: { width: imgWidth, height: imgHeight },
      });
      
    } catch (error) {
      console.error('[PDF_EXPORT] Error:', error);
      // Restore styles on error
      if (contentRef.current) {
        contentRef.current.classList.remove('pdf-export-mode');
      }
      // Fallback: open browser print dialog
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Loading state
  if (isLoading) {
    console.log('[V2_RENDERER] Showing loading skeleton');
    return <LoadingSkeleton />;
  }

  // Error state (normalization failed) - ALWAYS show this, never return null
  if (!normalization.success || !normalization.evaluation) {
    console.log('[V2_RENDERER] Showing error state', { errors: normalization.errors });
    return (
      <div className="space-y-4">
        <ErrorDisplay
          title="No se pudo renderizar la evaluación"
          description="El formato de la evaluación v2 no es compatible. Se utilizará el formato estándar."
          details={normalization.errors}
        />
        {showDebug && (
          <DebugPanel normalization={normalization} rawResponse={v2Response} />
        )}
      </div>
    );
  }

  const evaluation = normalization.evaluation;
  console.log('[V2_RENDERER] Rendering evaluation successfully', {
    title: evaluation.title,
    sectionsCount: evaluation.sections.length,
    totalItems: evaluation.totalItems
  });

  // Get available versions from the response (only versions that were actually generated)
  const availableVersions = evaluation.availableVersions || [{ key: 'A', label: 'Versión A' }];
  const displayVersion = availableVersions.some((v) => v.key === selectedVersion) ? selectedVersion : (availableVersions[0]?.key ?? 'A');

  // Success - render the evaluation
  return (
    <div className="space-y-6">
      {/* Debug panel (if enabled) */}
      {showDebug && (
        <DebugPanel normalization={normalization} rawResponse={v2Response} />
      )}

      {/* Normalization warnings */}
      <WarningsDisplay warnings={normalization.warnings} />

      {/* Toolbar: Version Selector + PDF Export */}
      <Card className="border-0 shadow-sm bg-white dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Version Selector: only show versions that were generated; value is displayVersion so we never show invalid selection */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Ver versión:</span>
              <Select 
                value={displayVersion} 
                onValueChange={(v) => handleVersionChange(v as 'A' | 'B' | 'C')}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccionar versión" />
                </SelectTrigger>
                <SelectContent>
                  {availableVersions.map((v) => (
                    <SelectItem key={v.key} value={v.key}>
                      <div className="flex items-center gap-2">
                        <span>{v.label}</span>
                        {v.isBase && <Badge variant="outline" className="text-xs">base</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Version badges */}
              <div className="hidden md:flex gap-1">
                {availableVersions.map((v) => (
                  <Badge
                    key={v.key}
                    variant={v.key === displayVersion ? 'default' : 'outline'}
                    className={`cursor-pointer transition-colors ${
                      v.key === selectedVersion ? '' : 'hover:bg-muted'
                    }`}
                    onClick={() => handleVersionChange(v.key)}
                  >
                    {v.key}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Export Button */}
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="gap-2"
            >
              {isExportingPdf ? (
                <>
                  <Download className="h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Descargar PDF
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main content (for PDF export) */}
      <div ref={contentRef} className="space-y-6 print-content print:space-y-4">
        {/* Header - PDF no break */}
        <EvalHeader evaluation={evaluation} />

        {/* Map of the test - PDF no break */}
        <MapTable evaluation={evaluation} />

        {/* Sections - Each section has pdf-no-break */}
        <div className="space-y-6 print:space-y-4">
          {evaluation.sections.map((section) => (
            <EvalSection key={section.id} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default EvaluationRendererV2;
