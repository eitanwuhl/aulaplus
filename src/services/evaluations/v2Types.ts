/**
 * V2 Evaluation Types
 * 
 * TypeScript interfaces matching the v2 Edge Function response contract.
 * These types define the raw v2 JSON structure from the backend.
 * 
 * Phase 4: JSON-based rendering (no HTML)
 */

// ============================================================================
// ITEM TYPES
// ============================================================================

export type ItemType = 
  | 'multiple_choice'
  | 'true_false'
  | 'true_false_justify'
  | 'short_answer'
  | 'paragraph'
  | 'essay'
  | 'source_analysis'
  | 'table_completion'
  | 'matching'
  | 'ordering';

export interface MultipleChoiceOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface EquivalentResponseOption {
  id: string;
  format: string;
  description: string;
}

export interface EquivalentResponseOptions {
  enabled: boolean;
  options: EquivalentResponseOption[];
  metacognitionText?: string;
}

/**
 * Alternative array format for equivalentResponseOptions (sometimes returned by backend)
 * Array of options without the wrapper object structure
 */
export type EquivalentResponseOptionsArray = Array<{
  id?: string;
  format?: string;
  description?: string;
}>;

export interface ItemSource {
  type: 'text' | 'image';
  content?: string;
  url?: string;
  caption?: string;
  attribution?: string;
}

export interface SubItem {
  id: string;
  prompt: string;
  points: number;
  responseFormat?: string;
}

/**
 * Table structure for table_completion items
 * The LLM generates headers and pre-filled rows; empty cells are for student completion
 */
export interface TableColumn {
  id: string;
  header: string;
}

export interface TableData {
  columns: TableColumn[];
  /** Each row is an array of cell values. Empty string = blank cell for student to fill */
  rows: string[][];
  /** Optional cell type hint: 'text' (default) or 'numeric' */
  cellType?: 'text' | 'numeric';
}

export interface RubricLevelV2 {
  key: string;
  label: string;
  descriptor: string;
  minPoints?: number;
  maxPoints?: number;
}

export interface ItemRubricV2 {
  levels: RubricLevelV2[];
}

/**
 * Versioned content for items that need adaptation.
 * When Version B is selected, the renderer uses promptB instead of prompt.
 * This enables real pedagogical differences (simplified vocabulary, clearer structure, etc.)
 */
export interface VersionedContent {
  /** Simplified prompt for Version B (content adaptation) */
  promptB?: string;
  /** Exceptional adaptation prompt for Version C */
  promptC?: string;
  /** Simplified options for multiple choice items (Version B) */
  optionsB?: MultipleChoiceOption[];
  /** Simplified guiding questions (Version B) */
  guidingQuestionsB?: string[];
  /** Simplified source content (Version B) */
  sourceB?: ItemSource;
  /** Simplified sub-items (Version B) */
  subItemsB?: SubItem[];
}

export interface EvaluationItemV2 {
  id: string;
  type: ItemType;
  prompt: string;
  points: number;
  competencyId?: string;
  criterioLogroId?: string;
  
  // Type-specific fields
  options?: MultipleChoiceOption[];
  correctAnswer?: boolean | string;
  justificationRequired?: boolean;
  maxLength?: number;
  minLength?: number;
  guidingQuestions?: string[];
  rubric?: ItemRubricV2;
  /**
   * Equivalent response options can come in two shapes:
   * 1. Object format (preferred): { enabled: boolean, options: [...], metacognitionText?: string }
   * 2. Array format (sometimes returned by backend): [{ id, format?, description }, ...]
   */
  equivalentResponseOptions?: EquivalentResponseOptions | EquivalentResponseOptionsArray;
  source?: ItemSource;
  subItems?: SubItem[];
  
  // Matching/ordering specific
  leftColumn?: string[];
  rightColumn?: string[];
  itemsToOrder?: string[];
  
  /**
   * Versioned content for adapted versions (B, C).
   * When present and selectedVersion is B, renderer uses versionedContent.promptB
   * instead of the base prompt. This enables real pedagogical adaptation.
   */
  versionedContent?: VersionedContent;
}

// ============================================================================
// SECTION TYPES
// ============================================================================

export interface EvaluationSectionV2 {
  id: string;
  title: string;
  duration?: number;
  instructions?: string;
  items: EvaluationItemV2[];
}

// ============================================================================
// VERSION VARIANTS
// ============================================================================

export interface VersionVariantBase {
  label: string;
  isBase: boolean;
}

export interface VersionVariantModified extends VersionVariantBase {
  reason: string;
  modifications: Array<{
    itemId?: string;
    sectionId?: string;
    changeType: string;
    description: string;
  }>;
}

export interface VersionVariants {
  A: VersionVariantBase;
  B?: VersionVariantModified;
  C?: VersionVariantModified;
}

// ============================================================================
// META & SPEC
// ============================================================================

export interface EvaluationMetaV2 {
  subject: string;
  gradeLevel?: string;
  groupName?: string;
  totalStudents?: number;
  duration?: {
    minutes: number;
    breakdown?: Record<string, number>;
  };
  totalPoints?: number;
  evaluationType: string;
  contentIds?: string[];
  competencyIds?: string[];
  criteriosLogro?: string[];
}

export interface EvaluationSpecV2 {
  version: '2.0' | string;
  generatedAt: string;
  meta: EvaluationMetaV2;
  sections: EvaluationSectionV2[];
  versionVariants: VersionVariants;
}

// ============================================================================
// TEACHER REMINDERS & WARNINGS
// ============================================================================

export interface TeacherReminderV2 {
  studentId: string;
  studentName: string;
  admin: string[];
  correction: string[];
}

export interface WarningV2 {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  context?: Record<string, unknown>;
}

// ============================================================================
// AI REPORT
// ============================================================================

/** Per-version AI report (narrative + optional decisions/warnings) */
export interface AiReportPerVersionV2 {
  narrative: string;
  decisionsApplied?: string[];
  warnings?: string[];
}

export interface AIReportV2 {
  narrative?: string;  // Global narrative (fallback when byVersion not used)
  /** Per-version report: A always when present, B/C only when that version was generated */
  byVersion?: {
    A?: AiReportPerVersionV2;
    B?: AiReportPerVersionV2;
    C?: AiReportPerVersionV2;
  };
  designRationale?: string;
  versionsExplanation?: {
    generated: string[];
    notGenerated?: Record<string, string>;
  };
  contemplacionesApplied?: {
    instrumentDesign: string[];
    adminReminders: number;
    correctionReminders: number;
  };
  responseOptions?: {
    included: boolean;
    count?: number;
    reason?: string;
  };
  varkSummary?: string;
}

// ============================================================================
// FULL V2 RESPONSE
// ============================================================================

export interface V2Response {
  success: boolean;
  evaluationSpec: EvaluationSpecV2 | null;
  requestedVersions: { A: boolean; B: boolean; C: boolean };
  instrumentDesignRulesApplied: string[];
  teacherRemindersByStudent: TeacherReminderV2[];
  aiReport: AIReportV2 | null;
  warnings: WarningV2[];
  debug?: {
    model: string;
    promptTokensEstimate?: number;
    completionTokensEstimate?: number;
    attempt: number;
    extractionMethod: string;
  };
}

// ============================================================================
// NORMALIZED VIEW MODEL (for rendering)
// ============================================================================

/**
 * A stable, UI-friendly view model derived from v2 spec.
 * The normalizer converts raw v2 to this format for consistent rendering.
 */

export interface NormalizedItem {
  id: string;
  number: number; // Display number within section
  type: ItemType;
  typeLabel: string; // Human-readable type label in Spanish
  prompt: string;
  points: number;
  
  /** Indicates this item is using adapted content (Version B/C) instead of base prompt */
  isAdapted?: boolean;
  
  // Normalized type-specific fields
  options?: Array<{ id: string; text: string; letter: string }>; // letter = a, b, c...
  hasCorrectAnswer?: boolean;
  justificationRequired?: boolean;
  maxLength?: number;
  minLength?: number;
  guidingQuestions?: string[];
  
  // Equivalent response options
  responseOptions?: {
    enabled: boolean;
    options: Array<{ id: string; format: string; description: string }>;
    metacognitionText?: string;
  };
  rubric?: ItemRubricV2;
  
  // Source analysis
  source?: {
    type: 'text' | 'image';
    content?: string;
    url?: string;
    caption?: string;
    attribution?: string;
  };
  
  // Sub-items (for complex items)
  subItems?: Array<{
    id: string;
    letter: string;
    prompt: string;
    points: number;
  }>;
  
  // Matching/ordering
  leftColumn?: Array<{ id: string; text: string }>;
  rightColumn?: Array<{ id: string; text: string }>;
  itemsToOrder?: Array<{ id: string; text: string }>;
  
  // Table completion
  /** Table data for table_completion items: columns (headers) + rows (cells) */
  table?: {
    columns: Array<{ id: string; header: string }>;
    rows: string[][];
    cellType?: 'text' | 'numeric';
  };
}

export interface NormalizedSection {
  id: string;
  number: number; // Display number (1, 2, 3...)
  title: string;
  duration?: number;
  instructions?: string;
  items: NormalizedItem[];
  totalPoints: number;
}

export interface NormalizedEvaluation {
  // Header info
  title: string;
  subject: string;
  groupName?: string;
  gradeLevel?: string;
  totalStudents?: number;
  generatedAt: string;
  
  // Duration
  totalDuration: number;
  durationBreakdown?: Record<string, number>;
  
  // Structure
  sections: NormalizedSection[];
  totalPoints: number;
  totalItems: number;
  
  // Version info
  currentVersion: 'A' | 'B' | 'C';
  versionLabel: string;
  availableVersions: Array<{
    key: 'A' | 'B' | 'C';
    label: string;
    isBase: boolean;
    reason?: string;
  }>;
  
  // Response options summary
  responseOptions?: {
    included: boolean;
    count?: number;
  };
  
  // Metadata
  contentIds?: string[];
  competencyIds?: string[];
  criteriosLogro?: string[];
}

export interface NormalizationResult {
  success: boolean;
  evaluation: NormalizedEvaluation | null;
  warnings: string[];
  errors: string[];
  rawSpec?: EvaluationSpecV2; // Keep original for debugging
}
