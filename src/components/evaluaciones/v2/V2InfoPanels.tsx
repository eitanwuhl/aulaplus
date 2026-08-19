/**
 * V2 Information Panels
 * 
 * Renders metadata panels for v2 evaluations:
 * - Student Assignments Panel (which version each student takes)
 * - Teacher Reminders Panel (with real student names)
 * - AI Design Report Panel
 * - Criterios de Logro Panel
 * - Evaluation Rubric Panel
 * 
 * These panels consume V2Response data directly.
 * NO v1 components or data mixing.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Users, 
  ClipboardList, 
  Lightbulb, 
  CheckCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  FileCheck,
  UserCheck
} from 'lucide-react';
import type { V2Response, TeacherReminderV2, AIReportV2, WarningV2, RubricLevelV2 } from '@/services/evaluations/v2Types';
import { normalizeStudentId } from '@/lib/contemplaciones/utils';
import ItemRubricPanel from './ItemRubricPanel';

// ============================================================================
// COLLAPSIBLE PANEL WRAPPER
// ============================================================================

interface CollapsiblePanelProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'info';
}

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  id,
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
  variant = 'default'
}) => {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(`v2panel:${id}`);
      return stored !== null ? stored === 'true' : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    try {
      localStorage.setItem(`v2panel:${id}`, String(newState));
    } catch {
      // localStorage puede no estar disponible (modo privado, cuotas, etc.)
    }
  };

  const borderColor = {
    default: 'border-gray-200',
    success: 'border-green-300',
    warning: 'border-amber-300',
    info: 'border-blue-300'
  }[variant];

  return (
    <Card className={`border-2 ${borderColor}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleToggle}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {icon}
                {title}
                {badge}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

// ============================================================================
// STUDENT ASSIGNMENTS PANEL (V2)
// ============================================================================

interface V2StudentAssignmentsPanelProps {
  versionVariants: V2Response['evaluationSpec'] extends { versionVariants: infer V } ? V : never;
  requestedVersions: V2Response['requestedVersions'];
  totalStudents?: number;
}

export const V2StudentAssignmentsPanel: React.FC<V2StudentAssignmentsPanelProps> = ({
  versionVariants,
  requestedVersions,
  totalStudents
}) => {
  // Check which versions were actually generated
  const versionsGenerated: string[] = [];
  if (requestedVersions.A) versionsGenerated.push('A');
  if (requestedVersions.B) versionsGenerated.push('B');
  if (requestedVersions.C) versionsGenerated.push('C');

  if (versionsGenerated.length === 0) {
    return null;
  }

  const getVersionLabel = (version: string) => {
    switch (version) {
      case 'A': return 'Universal';
      case 'B': return 'Formato equivalente';
      case 'C': return 'Adecuación de contenido';
      default: return version;
    }
  };

  return (
    <CollapsiblePanel
      id="v2-assignments"
      title="Versiones generadas"
      icon={<Users className="h-4 w-4 text-primary" />}
      badge={
        <Badge variant="secondary" className="ml-2 text-xs">
          {versionsGenerated.length} versión{versionsGenerated.length !== 1 ? 'es' : ''}
        </Badge>
      }
      defaultOpen={false}
    >
      <div className="space-y-3">
        {versionsGenerated.map((version) => {
          const variantData = versionVariants?.[version as 'A' | 'B' | 'C'];
          const isBase = version === 'A' || variantData?.isBase;
          
          return (
            <div 
              key={version}
              className="flex items-start justify-between p-3 rounded-lg border bg-muted/30"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={isBase ? 'default' : 'secondary'}>
                    Versión {version}
                  </Badge>
                  <span className="text-sm font-medium">
                    {getVersionLabel(version)}
                  </span>
                </div>
                {!isBase && 'reason' in (variantData || {}) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(variantData as any).reason}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        
        {totalStudents && (
          <p className="text-xs text-muted-foreground mt-2">
            Total de estudiantes: {totalStudents}
          </p>
        )}
      </div>
    </CollapsiblePanel>
  );
};

// ============================================================================
// STUDENT NAME RESOLVER HELPER
// ============================================================================

interface StudentInfo {
  id: string | number;
  name?: string;
}

function resolveStudentName(
  studentId: string,
  students: StudentInfo[]
): string {
  if (!students || students.length === 0) {
    return `Estudiante ${studentId}`;
  }
  
  const normalizedTargetId = normalizeStudentId(studentId);
  const match = students.find(s => normalizeStudentId(s.id) === normalizedTargetId);
  return match?.name || `Estudiante ${studentId}`;
}

// ============================================================================
// TEACHER REMINDERS PANEL (V2)
// ============================================================================

interface V2TeacherRemindersPanelProps {
  reminders: TeacherReminderV2[];
  students?: StudentInfo[];
}

export const V2TeacherRemindersPanel: React.FC<V2TeacherRemindersPanelProps> = ({
  reminders,
  students = []
}) => {
  // Filter to only show students with actual reminders
  const meaningfulReminders = reminders.filter(
    r => r.admin.length > 0 || r.correction.length > 0
  );

  if (meaningfulReminders.length === 0) {
    return (
      <CollapsiblePanel
        id="v2-reminders"
        title="Recordatorios para el docente"
        icon={<ClipboardList className="h-4 w-4 text-primary" />}
        defaultOpen={false}
      >
        <p className="text-sm text-muted-foreground">
          No hay recordatorios específicos para este grupo.
        </p>
      </CollapsiblePanel>
    );
  }

  return (
    <CollapsiblePanel
      id="v2-reminders"
      title="Recordatorios para el docente"
      icon={<ClipboardList className="h-4 w-4 text-primary" />}
      badge={
        <Badge variant="secondary" className="ml-2 text-xs">
          {meaningfulReminders.length} estudiante{meaningfulReminders.length !== 1 ? 's' : ''}
        </Badge>
      }
      defaultOpen={false}
    >
      <div className="space-y-4">
        {meaningfulReminders.map((reminder) => (
          <div key={reminder.studentId} className="border rounded-lg p-3">
            <div className="font-medium text-sm mb-2">
              {resolveStudentName(reminder.studentId, students)}
            </div>
            
            {reminder.admin.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Durante la administración:
                </div>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                  {reminder.admin.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {reminder.correction.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Durante la corrección:
                </div>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                  {reminder.correction.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </CollapsiblePanel>
  );
};

// ============================================================================
// AI DESIGN REPORT PANEL (V2)
// ============================================================================

interface V2AIReportPanelProps {
  aiReport: AIReportV2 | null;
  selectedVersion: 'A' | 'B' | 'C';
  instrumentDesignRulesApplied: string[];
  warnings: WarningV2[];
}

export const V2AIReportPanel: React.FC<V2AIReportPanelProps> = ({
  aiReport,
  selectedVersion,
  instrumentDesignRulesApplied,
  warnings
}) => {
  const hasContent = aiReport || instrumentDesignRulesApplied.length > 0;

  // Per-version report: 1) byVersion[selectedVersion] 2) global narrative 3) legacy saved (same object when loaded from DB)
  const versionReport = aiReport?.byVersion?.[selectedVersion];
  const narrativeForVersion = (versionReport && typeof versionReport.narrative === 'string' && versionReport.narrative.trim().length > 0)
    ? versionReport.narrative.trim()
    : (aiReport?.narrative && typeof aiReport.narrative === 'string' && aiReport.narrative.trim().length > 0)
      ? aiReport.narrative.trim()
      : '';

  const hasNarrative = narrativeForVersion.length > 0;

  if (!hasContent) {
    return (
      <CollapsiblePanel
        id="v2-ai-report"
        title="Reporte de IA"
        icon={<Lightbulb className="h-4 w-4 text-primary" />}
        variant="info"
        defaultOpen={false}
      >
        <p className="text-sm text-muted-foreground">
          El reporte de diseño de IA no está disponible para esta evaluación.
        </p>
      </CollapsiblePanel>
    );
  }

  return (
    <CollapsiblePanel
      id="v2-ai-report"
      title="Reporte de diseño de IA"
      icon={<Lightbulb className="h-4 w-4 text-primary" />}
      badge={
        <Badge variant="secondary" className="ml-2 text-xs bg-blue-100 text-blue-700">
          Solo docente
        </Badge>
      }
      variant="info"
      defaultOpen={false}
    >
      <div className="space-y-4">
        {/* Per-version or global narrative: single panel, content changes by selectedVersion */}
        {hasNarrative ? (
          <div className="space-y-2">
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {narrativeForVersion}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay reporte disponible para esta versión.
          </p>
        )}

        {/* FIX #1: Legacy structured report (fallback) - only show if narrative is missing */}
        {!hasNarrative && (
          <>
            {/* Design Rationale */}
            {aiReport?.designRationale && (
              <div>
                <h4 className="text-sm font-semibold mb-1">Justificación del diseño</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {aiReport.designRationale}
                </p>
              </div>
            )}

        {/* Versions Explanation */}
        {aiReport?.versionsExplanation && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Versiones generadas</h4>
            <div className="flex flex-wrap gap-2 mb-2">
              {aiReport.versionsExplanation.generated.map((v) => (
                <Badge key={v} variant="outline">Versión {v}</Badge>
              ))}
            </div>
            {aiReport.versionsExplanation.notGenerated && 
             Object.keys(aiReport.versionsExplanation.notGenerated).length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">No generadas:</span>
                <ul className="list-disc list-inside mt-1">
                  {Object.entries(aiReport.versionsExplanation.notGenerated).map(([v, reason]) => (
                    <li key={v}>Versión {v}: {reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Contemplaciones Applied */}
        {aiReport?.contemplacionesApplied && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Contemplaciones aplicadas</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              {aiReport.contemplacionesApplied.instrumentDesign.length > 0 && (
                <p>
                  <span className="font-medium">Diseño del instrumento:</span>{' '}
                  {aiReport.contemplacionesApplied.instrumentDesign.join(', ')}
                </p>
              )}
              <p>
                <span className="font-medium">Recordatorios administración:</span>{' '}
                {aiReport.contemplacionesApplied.adminReminders}
              </p>
              <p>
                <span className="font-medium">Recordatorios corrección:</span>{' '}
                {aiReport.contemplacionesApplied.correctionReminders}
              </p>
            </div>
          </div>
        )}

        {/* Response Options */}
        {aiReport?.responseOptions && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Opciones de respuesta equivalentes</h4>
            <p className="text-sm text-muted-foreground">
              {aiReport.responseOptions.included 
                ? `Incluidas (${aiReport.responseOptions.count || 2} opciones). ${aiReport.responseOptions.reason || ''}`
                : 'No se incluyeron opciones equivalentes.'
              }
            </p>
          </div>
        )}

        {/* VARK Summary */}
        {aiReport?.varkSummary && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Análisis VARK</h4>
            <p className="text-sm text-muted-foreground">
              {aiReport.varkSummary}
            </p>
          </div>
        )}
          </>
        )}

        {/* Instrument Design Rules - show regardless of narrative (applies to both modes) */}
        {instrumentDesignRulesApplied.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-1">Reglas de diseño aplicadas</h4>
            <div className="flex flex-wrap gap-1">
              {instrumentDesignRulesApplied.map((rule, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {rule}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1 text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              Advertencias
            </h4>
            <ul className="list-disc list-inside text-xs text-amber-600 space-y-0.5">
              {warnings.map((w, idx) => (
                <li key={idx}>{w.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CollapsiblePanel>
  );
};

// ============================================================================
// CRITERIOS DE LOGRO PANEL (V2)
// ============================================================================

interface V2CriteriosLogroPanelProps {
  criteriosLogro: string[];
  meta?: {
    subject?: string;
    competencyIds?: string[];
  };
}

export const V2CriteriosLogroPanel: React.FC<V2CriteriosLogroPanelProps> = ({
  criteriosLogro,
  meta
}) => {
  if (!criteriosLogro || criteriosLogro.length === 0) {
    return null;
  }

  return (
    <CollapsiblePanel
      id="v2-criterios"
      title="Criterios de logro evaluados"
      icon={<CheckCircle className="h-4 w-4 text-green-600" />}
      badge={
        <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-700">
          {criteriosLogro.length} criterio{criteriosLogro.length !== 1 ? 's' : ''}
        </Badge>
      }
      variant="success"
      defaultOpen={false}
    >
      <div className="space-y-2">
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          {criteriosLogro.map((criterio, idx) => (
            <li key={idx}>{criterio}</li>
          ))}
        </ul>
        
        {meta?.subject && (
          <p className="text-xs text-muted-foreground mt-3">
            Materia: <span className="font-medium">{meta.subject}</span>
          </p>
        )}
      </div>
    </CollapsiblePanel>
  );
};

// ============================================================================
// STUDENT ASSIGNMENT BY VERSION PANEL (V2) - NEW
// ============================================================================

interface V2StudentAssignmentByVersionPanelProps {
  studentAssignments: Record<string, 'A' | 'B' | 'C'>;
  students: StudentInfo[];
  requestedVersions?: { A: boolean; B: boolean; C: boolean };
  versionVariants?: V2Response['evaluationSpec'] extends { versionVariants: infer V } ? V : never;
}

export const V2StudentAssignmentByVersionPanel: React.FC<V2StudentAssignmentByVersionPanelProps> = ({
  studentAssignments,
  students,
  requestedVersions,
  versionVariants
}) => {
  // Build effective assignments: use provided assignments OR generate defaults for all students.
  // Never show a student assigned to B/C when that version was not generated (requestedVersions).
  const effectiveAssignments: Record<string, 'A' | 'B' | 'C'> = {};
  const rv = requestedVersions ?? { A: true, B: false, C: false };
  const mapToEffectiveVersion = (v: 'A' | 'B' | 'C'): 'A' | 'B' | 'C' => {
    if (v === 'B' && !rv.B) return 'A';
    if (v === 'C' && !rv.C) return 'A';
    return v;
  };
  
  if (Object.keys(studentAssignments).length > 0) {
    Object.entries(studentAssignments).forEach(([studentId, version]) => {
      effectiveAssignments[studentId] = mapToEffectiveVersion(version);
    });
  } else if (students.length > 0) {
    // No explicit assignments - generate defaults (everyone gets A)
    students.forEach(student => {
      const studentId = String(student.id);
      effectiveAssignments[studentId] = 'A';
    });
  }
  
  const entries = Object.entries(effectiveAssignments);
  const hasExplicitAssignments = Object.keys(studentAssignments).length > 0;
  
  // Empty state only if we have NO students at all
  if (entries.length === 0) {
    return (
      <CollapsiblePanel
        id="v2-student-assignments"
        title="Asignaciones por estudiante"
        icon={<UserCheck className="h-4 w-4 text-primary" />}
        defaultOpen={false}
      >
        <p className="text-sm text-muted-foreground">
          No hay estudiantes disponibles para mostrar asignaciones.
        </p>
      </CollapsiblePanel>
    );
  }

  const getVersionLabel = (version: 'A' | 'B' | 'C'): string => {
    // Try to get label from versionVariants if available
    if (versionVariants) {
      const variant = versionVariants[version];
      if (variant?.label) return variant.label;
    }
    // Default labels
    switch (version) {
      case 'A': return 'Universal';
      case 'B': return 'Formato equivalente';
      case 'C': return 'Adecuación de contenido';
      default: return `Versión ${version}`;
    }
  };

  const getVersionColor = (version: 'A' | 'B' | 'C'): string => {
    switch (version) {
      case 'A': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'B': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'C': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Count students per version
  const versionCounts = entries.reduce((acc, [, version]) => {
    acc[version] = (acc[version] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <CollapsiblePanel
      id="v2-student-assignments"
      title="Asignaciones por estudiante"
      icon={<UserCheck className="h-4 w-4 text-primary" />}
      badge={
        <Badge variant="secondary" className="ml-2 text-xs">
          {entries.length} estudiante{entries.length !== 1 ? 's' : ''}
        </Badge>
      }
      defaultOpen={false}
    >
      <div className="space-y-3">
        {/* Legend */}
        <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-100">
          {requestedVersions?.A && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`inline-block w-2 h-2 rounded-full bg-blue-500`}></span>
              <span className="text-muted-foreground">A: {getVersionLabel('A')}</span>
              <span className="text-gray-400">({versionCounts['A'] || 0})</span>
            </div>
          )}
          {requestedVersions?.B && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`inline-block w-2 h-2 rounded-full bg-purple-500`}></span>
              <span className="text-muted-foreground">B: {getVersionLabel('B')}</span>
              <span className="text-gray-400">({versionCounts['B'] || 0})</span>
            </div>
          )}
          {requestedVersions?.C && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`inline-block w-2 h-2 rounded-full bg-amber-500`}></span>
              <span className="text-muted-foreground">C: {getVersionLabel('C')}</span>
              <span className="text-gray-400">({versionCounts['C'] || 0})</span>
            </div>
          )}
        </div>

        {/* Default assignment notice */}
        {!hasExplicitAssignments && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-blue-50 border border-blue-100">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Todos los estudiantes tienen asignada la Versión A (Universal) por defecto.
            </p>
          </div>
        )}

        {/* Student list */}
        <div className="space-y-1">
          {entries.map(([studentId, version]) => (
            <div
              key={studentId}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
            >
              <span className="font-medium text-foreground">
                {resolveStudentName(studentId, students)}
              </span>
              <Badge variant="outline" className={`${getVersionColor(version)} text-xs font-medium`}>
                {version}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </CollapsiblePanel>
  );
};

// ============================================================================
// EVALUATION RUBRIC PANEL (V2) - Improved styling
// ============================================================================

interface V2RubricPanelProps {
  criteriosLogro: string[];
  subject?: string;
}

export const V2RubricPanel: React.FC<V2RubricPanelProps> = ({
  criteriosLogro,
  subject
}) => {
  const safeCriterios = (Array.isArray(criteriosLogro) ? criteriosLogro : [])
    .map((c) => (typeof c === 'string' ? c.trim() : ''))
    .filter((c) => c.length > 0);

  if (safeCriterios.length === 0) {
    return (
      <CollapsiblePanel
        id="v2-rubric"
        title="Rúbrica de evaluación"
        icon={<FileCheck className="h-4 w-4 text-primary" />}
        defaultOpen={false}
      >
        <p className="text-sm text-muted-foreground">
          No se generó una rúbrica para esta evaluación. 
          La rúbrica se deriva de los criterios de logro ANEP seleccionados.
        </p>
      </CollapsiblePanel>
    );
  }

  // Derive rubric levels from criterio ANEP (fallback-only, deterministic)
  const deriveRubricLevels = (criterio: string) => {
    const normalized = (criterio || '').trim();
    const normalizedLower = normalized.toLowerCase();
    const criterioSafe = normalized || 'Aplica el criterio de forma pertinente en la resolución de la consigna.';

    const isContraste = normalizedLower.includes('contrasta') || normalizedLower.includes('fuente');
    const isArgumentacion = normalizedLower.includes('argumenta') || normalizedLower.includes('oralidad');
    const isIndagacion = normalizedLower.includes('pregunta') || normalizedLower.includes('indaga');
    
    if (isContraste) {
      return {
        excelente: criterioSafe,
        bueno: 'Contrasta dos fuentes; identifica similitudes/diferencias y algunas relaciones causales; contextualiza de forma general.',
        necesitaMejorar: 'Describe fuentes sin verdadero contraste; omite contexto o confunde temporalidades.',
        insuficiente: 'No contrasta; copia fragmentos o saca conclusiones no históricas.'
      };
    }
    
    if (isArgumentacion) {
      return {
        excelente: criterioSafe,
        bueno: 'Tesis presente; dos argumentos con evidencias parciales; algunos conectores; terminología adecuada.',
        necesitaMejorar: 'Tesis poco definida; un argumento débil; escasos conectores; terminología pobre.',
        insuficiente: 'Sin tesis ni argumentos; incoherencias; vocabulario no específico.'
      };
    }
    
    if (isIndagacion) {
      return {
        excelente: criterioSafe,
        bueno: 'Formula 2 preguntas pertinentes pero mayormente descriptivas.',
        necesitaMejorar: '1-2 preguntas básicas sin conexión con procesos históricos.',
        insuficiente: 'Preguntas irrelevantes o inexistentes.'
      };
    }
    
    // Generic derivation
    return {
      excelente: criterioSafe,
      bueno: 'Logro adecuado con evidencia parcial y aplicación correcta del criterio.',
      necesitaMejorar: 'Logro fragmentario sin establecer relaciones claras; requiere apoyo docente.',
      insuficiente: 'No evidencia el logro del criterio; necesita intervención pedagógica intensiva.'
    };
  };

  // Performance level styling
  const levelConfig = [
    { key: 'excelente', label: 'Excelente', color: 'bg-emerald-50 border-emerald-200', badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-300', dotColor: 'bg-emerald-500' },
    { key: 'bueno', label: 'Bueno', color: 'bg-sky-50 border-sky-200', badgeColor: 'bg-sky-100 text-sky-700 border-sky-300', dotColor: 'bg-sky-500' },
    { key: 'necesitaMejorar', label: 'Necesita mejorar', color: 'bg-amber-50 border-amber-200', badgeColor: 'bg-amber-100 text-amber-700 border-amber-300', dotColor: 'bg-amber-500' },
    { key: 'insuficiente', label: 'Insuficiente', color: 'bg-rose-50 border-rose-200', badgeColor: 'bg-rose-100 text-rose-700 border-rose-300', dotColor: 'bg-rose-500' },
  ] as const;

  return (
    <CollapsiblePanel
      id="v2-rubric"
      title="Rúbrica de evaluación"
      icon={<FileCheck className="h-4 w-4 text-primary" />}
      badge={
        <Badge variant="secondary" className="ml-2 text-xs bg-indigo-100 text-indigo-700">
          {safeCriterios.length} criterio{safeCriterios.length !== 1 ? 's' : ''}
        </Badge>
      }
      defaultOpen={false}
    >
      <div className="space-y-4">
        {/* Header with subject */}
        {subject && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pb-2 border-b">
            <span>Materia:</span>
            <span className="font-medium text-foreground">{subject}</span>
          </div>
        )}

        {/* Legend - compact horizontal */}
        <div className="flex flex-wrap gap-3 text-xs">
          {levelConfig.map(level => (
            <div key={level.key} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${level.dotColor}`}></span>
              <span className="text-muted-foreground">{level.label}</span>
            </div>
          ))}
        </div>
        
        {/* Criteria cards */}
        {safeCriterios.map((criterio, idx) => {
          const levels = deriveRubricLevels(criterio);
          return (
            <div key={idx} className="border rounded-lg overflow-hidden bg-white">
              {/* Criterion header */}
              <div className="bg-slate-50 px-3 py-2 border-b">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </Badge>
                  <p className="text-sm font-medium text-slate-700 leading-snug">
                    {criterio.length > 120 ? `${criterio.substring(0, 120)}...` : criterio}
                  </p>
                </div>
              </div>
              
              {/* Performance levels - compact grid */}
              <div className="grid grid-cols-2 gap-px bg-gray-100">
                {levelConfig.map(level => (
                  <div 
                    key={level.key} 
                    className={`p-2.5 ${level.color} border-l first:border-l-0`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${level.dotColor}`}></span>
                      <span className={`text-xs font-medium ${level.badgeColor.split(' ')[1]}`}>
                        {level.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {levels[level.key]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsiblePanel>
  );
};

// ============================================================================
// COMBINED V2 INFO PANELS
// ============================================================================

interface V2InfoPanelsProps {
  v2Response: V2Response;
  selectedVersion?: 'A' | 'B' | 'C';
  students?: StudentInfo[];
  studentAssignments?: Record<string, 'A' | 'B' | 'C'>;
  onV2ResponseChange?: (nextResponse: V2Response) => void;
}

/**
 * Renders all v2 information panels from V2Response data.
 * This is the main export - use this in the evaluation page.
 * 
 * Defensive: Handles null/undefined fields gracefully.
 * 
 * @param v2Response - The raw V2 response from the edge function
 * @param students - Optional array of students for name resolution
 * @param studentAssignments - Optional map of studentId -> version for assignment panel
 */
export const V2InfoPanels: React.FC<V2InfoPanelsProps> = ({ 
  v2Response,
  selectedVersion = 'A',
  students = [],
  studentAssignments = {},
  onV2ResponseChange
}) => {
  // DEBUG: Log when V2InfoPanels renders
  console.log('[V2_INFO_PANELS] Rendering with response:', {
    hasResponse: !!v2Response,
    success: v2Response?.success,
    hasSpec: !!v2Response?.evaluationSpec,
    sectionsCount: v2Response?.evaluationSpec?.sections?.length,
    hasAiReport: !!v2Response?.aiReport,
    remindersCount: v2Response?.teacherRemindersByStudent?.length,
    rulesCount: v2Response?.instrumentDesignRulesApplied?.length,
    studentsCount: students.length,
    assignmentsCount: Object.keys(studentAssignments).length
  });

  // Defensive extraction with defaults
  const evaluationSpec = v2Response?.evaluationSpec ?? null;
  const requestedVersions = v2Response?.requestedVersions ?? { A: true, B: false, C: false };
  const teacherRemindersByStudent = v2Response?.teacherRemindersByStudent ?? [];
  const aiReport = v2Response?.aiReport ?? null;
  const instrumentDesignRulesApplied = v2Response?.instrumentDesignRulesApplied ?? [];
  const warnings = v2Response?.warnings ?? [];
  const hasPerItemRubric = Boolean(
    evaluationSpec?.sections?.some((section) =>
      section.items?.some((item) => Array.isArray(item.rubric?.levels) && item.rubric.levels.length > 0)
    )
  );

  const handleItemRubricChange = (sectionId: string, itemId: string, nextLevels: RubricLevelV2[]) => {
    if (!onV2ResponseChange || !evaluationSpec) return;
    const nextResponse: V2Response = {
      ...v2Response,
      evaluationSpec: {
        ...evaluationSpec,
        sections: evaluationSpec.sections.map((section) => {
          if (section.id !== sectionId) return section;
          return {
            ...section,
            items: section.items.map((item) => {
              if (item.id !== itemId) return item;
              return {
                ...item,
                rubric: {
                  levels: nextLevels,
                },
              };
            }),
          };
        }),
      },
    };
    onV2ResponseChange(nextResponse);
  };

  // If v2Response itself is null/undefined, show friendly message
  if (!v2Response) {
    console.warn('[V2_INFO_PANELS] No v2Response provided');
    return (
      <Card className="border-2 border-amber-300 bg-amber-50">
        <CardContent className="p-4">
          <p className="text-sm text-amber-700">
            Los datos de evaluación V2 no están disponibles. Esto puede ser un error temporal.
          </p>
        </CardContent>
      </Card>
    );
  }

  // If success is false, show error state
  if (!v2Response.success) {
    console.warn('[V2_INFO_PANELS] v2Response.success is false');
    return (
      <Card className="border-2 border-red-300 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-700">Error en generación V2</span>
          </div>
          {warnings.length > 0 && (
            <ul className="list-disc list-inside text-sm text-red-600">
              {warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Student Assignments / Versions Panel */}
      {evaluationSpec?.versionVariants && (
        <V2StudentAssignmentsPanel
          versionVariants={evaluationSpec.versionVariants}
          requestedVersions={requestedVersions}
          totalStudents={evaluationSpec.meta?.totalStudents}
        />
      )}

      {/* Student Assignment by Version Panel - generates defaults if no explicit assignments */}
      <V2StudentAssignmentByVersionPanel
        studentAssignments={studentAssignments}
        students={students}
        requestedVersions={requestedVersions}
        versionVariants={evaluationSpec?.versionVariants}
      />

      {/* Teacher Reminders Panel - now with real student names */}
      <V2TeacherRemindersPanel 
        reminders={teacherRemindersByStudent}
        students={students}
      />

      {/* AI Design Report Panel (single panel; content changes by selected version) */}
      <V2AIReportPanel
        aiReport={aiReport}
        selectedVersion={selectedVersion}
        instrumentDesignRulesApplied={instrumentDesignRulesApplied}
        warnings={warnings}
      />

      {/* Criterios de Logro Panel */}
      {evaluationSpec?.meta?.criteriosLogro && evaluationSpec.meta.criteriosLogro.length > 0 && (
        <V2CriteriosLogroPanel
          criteriosLogro={evaluationSpec.meta.criteriosLogro}
          meta={evaluationSpec.meta}
        />
      )}

      {/* Rubric panels: per-item rubric is primary, CL-derived rubric is fallback */}
      {evaluationSpec && hasPerItemRubric ? (
        <CollapsiblePanel
          id="v2-item-rubric"
          title="Rúbrica por ítem"
          icon={<FileCheck className="h-4 w-4 text-primary" />}
          badge={
            <Badge variant="secondary" className="ml-2 text-xs bg-indigo-100 text-indigo-700">
              Por pregunta
            </Badge>
          }
          defaultOpen={false}
        >
          <ItemRubricPanel
            evaluationSpec={evaluationSpec}
            editable={Boolean(onV2ResponseChange)}
            onRubricChange={handleItemRubricChange}
          />
        </CollapsiblePanel>
      ) : (
        <V2RubricPanel
          criteriosLogro={evaluationSpec?.meta?.criteriosLogro ?? []}
          subject={evaluationSpec?.meta?.subject}
        />
      )}
    </div>
  );
};

export default V2InfoPanels;
