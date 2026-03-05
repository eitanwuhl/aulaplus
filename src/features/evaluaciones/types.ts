/**
 * Shared evaluation pipeline types (used by useEvaluationPipeline and EvaluacionesGrupo).
 * Reused from page to avoid circular imports.
 */

export interface GeneratedEvaluation {
  id: string;
  version: number;
  title: string;
  content: string;
  versionLabel?: string;
  versionKind?: string;
  adaptations: string[];
  assignedStudents: string[];
  assignedStudentIds?: (string | number)[];
  rubrica?: unknown[];
  feedback?: {
    liked: string[];
    disliked: string[];
    suggestions: string[];
  };
}

export interface EvaluationBundle {
  baseHtml?: string;
  versionBHtml?: string | null;
  versionCHtml?: string | null;
  versions?: { A: string; B?: string | null; C?: string | null };
  responseOptionsIncluded?: boolean;
  responseOptionCount?: number;
  finalAssignmentCounts?: { A: number; B: number; C: number };
}

export interface GenerationErrorState {
  message: string;
  details?: string;
  code?: string;
  requestId?: string;
  show: boolean;
}

export interface PipelineDebugState {
  lastRequest?: {
    generationMode: string;
    hasEvaluationDesignPlan: boolean;
    hasGenerationContext: boolean;
    triggers: { versionB: boolean; versionC: boolean };
    responseOptionsInclude: boolean;
    assignmentsCount: number;
  };
  lastResponse?: {
    hasAiReport: boolean;
    hasEvaluationBundle: boolean;
    versionsGenerated: string[];
    warningsCount: number;
    endpoint: string;
    error?: string;
  };
}
