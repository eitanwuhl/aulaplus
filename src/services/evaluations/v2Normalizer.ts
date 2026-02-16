/**
 * V2 Evaluation Normalizer
 * 
 * Converts raw v2 Edge Function response to a stable, UI-friendly ViewModel.
 * Handles missing fields, applies defaults, and validates required data.
 * 
 * Phase 4: JSON-based rendering (no HTML)
 */

import {
  EvaluationSpecV2,
  EvaluationSectionV2,
  EvaluationItemV2,
  ItemRubricV2,
  ItemType,
  NormalizedEvaluation,
  NormalizedSection,
  NormalizedItem,
  NormalizationResult,
  V2Response,
} from './v2Types';

// ============================================================================
// CONSTANTS
// ============================================================================

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  multiple_choice: 'Opción múltiple',
  true_false: 'Verdadero/Falso',
  true_false_justify: 'Verdadero/Falso con justificación',
  short_answer: 'Respuesta corta',
  paragraph: 'Párrafo',
  essay: 'Desarrollo',
  source_analysis: 'Análisis de fuente',
  table_completion: 'Completar tabla',
  matching: 'Unir con flechas',
  ordering: 'Ordenar secuencia',
};

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

interface ValidationContext {
  warnings: string[];
  errors: string[];
}

function createContext(): ValidationContext {
  return { warnings: [], errors: [] };
}

function isValidItemType(type: unknown): type is ItemType {
  return typeof type === 'string' && type in ITEM_TYPE_LABELS;
}

function safeString(value: unknown, fallback: string = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function safeNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeRubric(raw: unknown): ItemRubricV2 | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const rubric = raw as Record<string, unknown>;
  if (!Array.isArray(rubric.levels)) return undefined;

  const levels = rubric.levels
    .map((level) => {
      if (!level || typeof level !== 'object') return null;
      const l = level as Record<string, unknown>;
      const key = safeString(l.key).trim();
      const label = safeString(l.label, key).trim();
      const descriptor = safeString(l.descriptor).trim();
      if (!key || !label || !descriptor) return null;

      const minPoints = l.minPoints !== undefined ? safeNumber(l.minPoints, 0) : undefined;
      const maxPoints = l.maxPoints !== undefined ? safeNumber(l.maxPoints, 0) : undefined;

      return {
        key,
        label,
        descriptor,
        minPoints,
        maxPoints,
      };
    })
    .filter((level): level is NonNullable<typeof level> => level !== null);

  if (levels.length === 0) return undefined;
  return { levels };
}

// ============================================================================
// ITEM NORMALIZER
// ============================================================================

function normalizeItem(
  raw: unknown,
  index: number,
  ctx: ValidationContext,
  selectedVersion: 'A' | 'B' | 'C' = 'A'
): NormalizedItem | null {
  if (!raw || typeof raw !== 'object') {
    ctx.warnings.push(`Item ${index + 1} is not an object, skipping`);
    return null;
  }

  const item = raw as Record<string, unknown>;
  
  // Required fields
  const id = safeString(item.id, `item-${index}`);
  
  // Get base prompt
  const basePrompt = safeString(item.prompt);
  
  // Apply versioned content if available and version B/C is selected
  let prompt = basePrompt;
  const versionedContent = item.versionedContent as Record<string, unknown> | undefined;
  
  // DEV logging for versionedContent presence (always log in development)
  const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  if (isDev && selectedVersion !== 'A') {
    if (versionedContent) {
      const hasPromptB = !!versionedContent.promptB;
      const hasPromptC = !!versionedContent.promptC;
      console.log(`[V2Normalizer] Item ${id}: versionedContent found, promptB=${hasPromptB}, promptC=${hasPromptC}, selectedVersion=${selectedVersion}`);
    } else {
      console.warn(`[V2Normalizer] Item ${id}: NO versionedContent found! Version ${selectedVersion} will use base prompt.`);
    }
  }
  
  if (versionedContent && selectedVersion === 'B' && versionedContent.promptB) {
    const adaptedPrompt = safeString(versionedContent.promptB);
    if (adaptedPrompt) {
      prompt = adaptedPrompt;
      if (isDev) {
        console.log(`[V2Normalizer] Item ${id}: ✅ Using Version B adapted prompt (${adaptedPrompt.length} chars)`);
      }
    }
  } else if (versionedContent && selectedVersion === 'C' && versionedContent.promptC) {
    const adaptedPrompt = safeString(versionedContent.promptC);
    if (adaptedPrompt) {
      prompt = adaptedPrompt;
      if (isDev) {
        console.log(`[V2Normalizer] Item ${id}: ✅ Using Version C adapted prompt`);
      }
    }
  } else if (selectedVersion !== 'A' && isDev) {
    console.warn(`[V2Normalizer] Item ${id}: ⚠️ Version ${selectedVersion} selected but no adapted content, using base prompt`);
  }
  
  if (!prompt) {
    ctx.warnings.push(`Item ${index + 1} has no prompt, skipping`);
    return null;
  }

  // Type with fallback
  let type: ItemType = 'short_answer';
  if (isValidItemType(item.type)) {
    type = item.type;
  } else {
    ctx.warnings.push(`Item ${index + 1} has invalid type "${item.type}", defaulting to short_answer`);
  }

  const points = safeNumber(item.points, 1);
  
  // Determine if this item is using adapted content
  const isAdapted = prompt !== basePrompt;

  const normalized: NormalizedItem = {
    id,
    number: index + 1,
    type,
    typeLabel: ITEM_TYPE_LABELS[type],
    prompt,
    points,
    isAdapted, // Track if using adapted content
  };

  // Type-specific fields (use versionedContent.optionsB when B selected for multiple_choice)
  switch (type) {
    case 'multiple_choice': {
      const optionsSource = (selectedVersion === 'B' && versionedContent?.optionsB && Array.isArray(versionedContent.optionsB))
        ? (versionedContent.optionsB as Array<Record<string, unknown>>)
        : Array.isArray(item.options)
          ? (item.options as Array<Record<string, unknown>>)
          : [];
      if (optionsSource.length > 0) {
        normalized.options = optionsSource.map((opt: Record<string, unknown>, i: number) => ({
          id: safeString(opt?.id, `opt-${i}`),
          text: safeString(opt?.text, ''),
          letter: LETTERS[i] || `${i + 1}`,
        })).filter(o => o.text);
      }
      break;
    }

    case 'true_false':
    case 'true_false_justify':
      normalized.hasCorrectAnswer = item.correctAnswer !== undefined;
      if (type === 'true_false_justify') {
        normalized.justificationRequired = true;
      }
      break;

    case 'paragraph':
    case 'essay':
      if (typeof item.minLength === 'number') normalized.minLength = item.minLength;
      if (typeof item.maxLength === 'number') normalized.maxLength = item.maxLength;
      if (Array.isArray(item.guidingQuestions)) {
        normalized.guidingQuestions = item.guidingQuestions.filter(
          (q): q is string => typeof q === 'string' && q.length > 0
        );
      }
      break;

    case 'source_analysis':
      if (item.source && typeof item.source === 'object') {
        const src = item.source as Record<string, unknown>;
        normalized.source = {
          type: src.type === 'image' ? 'image' : 'text',
          content: safeString(src.content),
          url: safeString(src.url),
          caption: safeString(src.caption),
          attribution: safeString(src.attribution),
        };
      }
      // Source analysis often has sub-items
      if (Array.isArray(item.subItems)) {
        normalized.subItems = item.subItems.map((sub: unknown, i: number) => {
          const s = sub as Record<string, unknown>;
          return {
            id: safeString(s?.id, `sub-${i}`),
            letter: LETTERS[i] || `${i + 1}`,
            prompt: safeString(s?.prompt, ''),
            points: safeNumber(s?.points, 1),
          };
        }).filter(s => s.prompt);
      }
      break;

    case 'matching':
      if (Array.isArray(item.leftColumn)) {
        normalized.leftColumn = item.leftColumn.map((text: unknown, i: number) => ({
          id: `left-${i}`,
          text: safeString(text),
        })).filter(x => x.text);
      }
      if (Array.isArray(item.rightColumn)) {
        normalized.rightColumn = item.rightColumn.map((text: unknown, i: number) => ({
          id: `right-${i}`,
          text: safeString(text),
        })).filter(x => x.text);
      }
      break;

    case 'ordering':
      if (Array.isArray(item.itemsToOrder)) {
        normalized.itemsToOrder = item.itemsToOrder.map((text: unknown, i: number) => ({
          id: `order-${i}`,
          text: safeString(text),
        })).filter(x => x.text);
      }
      break;

    case 'table_completion':
      // Process table structure: columns (headers) and rows (cells)
      // Spec: item.table = { columns: [{header}], rows: string[][] }
      // Alternative spec: item.headers + item.rows directly
      if (item.table && typeof item.table === 'object') {
        const tableObj = item.table as Record<string, unknown>;
        const columns = Array.isArray(tableObj.columns) ? tableObj.columns : [];
        const rows = Array.isArray(tableObj.rows) ? tableObj.rows : [];
        
        normalized.table = {
          columns: columns.map((col: unknown, i: number) => {
            if (typeof col === 'string') {
              return { id: `col-${i}`, header: col };
            }
            const c = col as Record<string, unknown>;
            return {
              id: safeString(c?.id, `col-${i}`),
              header: safeString(c?.header, `Columna ${i + 1}`),
            };
          }),
          rows: rows.map((row: unknown) => {
            if (Array.isArray(row)) {
              return row.map((cell: unknown) => safeString(cell));
            }
            return [];
          }),
          cellType: tableObj.cellType === 'numeric' ? 'numeric' : 'text',
        };
      } else if (Array.isArray(item.headers) || Array.isArray(item.columns)) {
        // Alternative format: headers/columns at top level
        const headers = (item.headers || item.columns) as unknown[];
        const rows = Array.isArray(item.rows) ? item.rows : [];
        
        normalized.table = {
          columns: headers.map((h: unknown, i: number) => {
            if (typeof h === 'string') {
              return { id: `col-${i}`, header: h };
            }
            const hObj = h as Record<string, unknown>;
            return {
              id: safeString(hObj?.id, `col-${i}`),
              header: safeString(hObj?.header || hObj?.text, `Columna ${i + 1}`),
            };
          }),
          rows: (rows as unknown[]).map((row: unknown) => {
            if (Array.isArray(row)) {
              return row.map((cell: unknown) => safeString(cell));
            }
            return [];
          }),
          cellType: item.cellType === 'numeric' ? 'numeric' : 'text',
        };
      }
      break;
  }

  // Equivalent response options (can appear on essay, paragraph, etc.)
  // Handle BOTH shapes: object format { enabled, options, metacognitionText } OR array format [{ id, format?, description }]
  if (item.equivalentResponseOptions) {
    const DEBUG_V2_OPTIONS = false; // Set to true to enable debug logging
    
    if (DEBUG_V2_OPTIONS) {
      console.log('[V2Normalizer] equivalentResponseOptions raw shape:', {
        isArray: Array.isArray(item.equivalentResponseOptions),
        type: typeof item.equivalentResponseOptions,
        value: item.equivalentResponseOptions
      });
    }
    
    let normalizedOptions: Array<{ id: string; format: string; description: string }> = [];
    let metacognitionText = 'Choose ONE format. All options assess the same learning goal.';
    
    // Case 1: Object format { enabled: boolean, options: [...], metacognitionText?: string }
    if (!Array.isArray(item.equivalentResponseOptions) && typeof item.equivalentResponseOptions === 'object') {
      const ero = item.equivalentResponseOptions as Record<string, unknown>;
      if (ero.enabled === true && Array.isArray(ero.options)) {
        // Normalize options: ensure all have id, format, description
        normalizedOptions = ero.options.map((opt: unknown, index: number) => {
          const o = opt as Record<string, unknown>;
          const format = safeString(o?.format, '');
          const description = safeString(o?.description, '');
          
          // Generate stable ID if missing
          const id = safeString(o?.id, '') || `opt-${index + 1}`;
          
          return {
            id,
            format,
            description,
          };
        }).filter(o => o.format || o.description); // Keep only options with at least format or description
        
        metacognitionText = safeString(ero.metacognitionText, metacognitionText);
      }
    }
    // Case 2: Array format [{ id?, format?, description }, ...]
    else if (Array.isArray(item.equivalentResponseOptions)) {
      const optionsArray = item.equivalentResponseOptions;
      
      normalizedOptions = optionsArray
        .map((opt: unknown, index: number) => {
          if (!opt || typeof opt !== 'object') return null;
          
          const o = opt as Record<string, unknown>;
          const description = safeString(o?.description, '');
          
          // Skip if description is empty
          if (!description.trim()) return null;
          
          // Generate stable ID if missing
          const id = safeString(o?.id, '') || `opt-${index + 1}`;
          
          // Infer format from description if missing
          let format = safeString(o?.format, '');
          if (!format) {
            const descLower = description.toLowerCase();
            if (descLower.includes('tabla') || descLower.includes('table')) {
              format = 'analysis_table';
            } else if (descLower.includes('preguntas orientadoras') || descLower.includes('guía') || descLower.includes('guide')) {
              format = 'guided_questions';
            } else {
              format = 'brief_written';
            }
          }
          
          return {
            id,
            format,
            description,
          };
        })
        .filter((o): o is { id: string; format: string; description: string } => o !== null);
    }
    
    // Set responseOptions if we have at least 1 valid option
    if (normalizedOptions.length > 0) {
      normalized.responseOptions = {
        enabled: true,
        options: normalizedOptions,
        metacognitionText,
      };
      
      if (DEBUG_V2_OPTIONS) {
        console.log('[V2Normalizer] normalized responseOptions:', normalized.responseOptions);
      }
    }
  }

  // Rubric per item (pass through normalized, optional)
  const rubric = normalizeRubric(item.rubric);
  if (rubric) {
    normalized.rubric = rubric;
  }

  return normalized;
}

// ============================================================================
// SECTION NORMALIZER
// ============================================================================

function normalizeSection(
  raw: unknown,
  index: number,
  ctx: ValidationContext,
  selectedVersion: 'A' | 'B' | 'C' = 'A'
): NormalizedSection | null {
  if (!raw || typeof raw !== 'object') {
    ctx.warnings.push(`Section ${index + 1} is not an object, skipping`);
    return null;
  }

  const section = raw as Record<string, unknown>;
  
  const id = safeString(section.id, `section-${index}`);
  const title = safeString(section.title, `Parte ${index + 1}`);
  
  // Normalize items with version awareness
  const rawItems = safeArray<unknown>(section.items);
  const items: NormalizedItem[] = [];
  
  for (let i = 0; i < rawItems.length; i++) {
    const normalized = normalizeItem(rawItems[i], i, ctx, selectedVersion);
    if (normalized) {
      items.push(normalized);
    }
  }

  if (items.length === 0) {
    ctx.warnings.push(`Section "${title}" has no valid items, skipping`);
    return null;
  }

  const totalPoints = items.reduce((sum, item) => sum + item.points, 0);

  return {
    id,
    number: index + 1,
    title,
    duration: typeof section.duration === 'number' ? section.duration : undefined,
    instructions: safeString(section.instructions) || undefined,
    items,
    totalPoints,
  };
}

// ============================================================================
// MAIN NORMALIZER
// ============================================================================

export function normalizeV2Response(
  response: V2Response,
  selectedVersion: 'A' | 'B' | 'C' = 'A'
): NormalizationResult {
  const ctx = createContext();

  // Check response success
  if (!response.success) {
    ctx.errors.push('V2 response indicates failure');
    return {
      success: false,
      evaluation: null,
      warnings: ctx.warnings,
      errors: ctx.errors,
    };
  }

  // Check spec exists
  if (!response.evaluationSpec) {
    ctx.errors.push('V2 response has no evaluationSpec');
    return {
      success: false,
      evaluation: null,
      warnings: ctx.warnings,
      errors: ctx.errors,
    };
  }

  const spec = response.evaluationSpec;

  // Validate sections exist
  if (!Array.isArray(spec.sections) || spec.sections.length === 0) {
    ctx.errors.push('V2 spec has no sections');
    return {
      success: false,
      evaluation: null,
      warnings: ctx.warnings,
      errors: ctx.errors,
      rawSpec: spec,
    };
  }

  // Normalize sections with version awareness
  const sections: NormalizedSection[] = [];
  for (let i = 0; i < spec.sections.length; i++) {
    const normalized = normalizeSection(spec.sections[i], i, ctx, selectedVersion);
    if (normalized) {
      // Re-number after filtering
      normalized.number = sections.length + 1;
      sections.push(normalized);
    }
  }

  if (sections.length === 0) {
    ctx.errors.push('No valid sections after normalization');
    return {
      success: false,
      evaluation: null,
      warnings: ctx.warnings,
      errors: ctx.errors,
      rawSpec: spec,
    };
  }

  // Calculate totals
  const totalPoints = sections.reduce((sum, s) => sum + s.totalPoints, 0);
  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

  // Extract version info: use response.requestedVersions (effective) so we only offer versions that were actually generated
  const requestedVersions = response.requestedVersions ?? { A: true, B: false, C: false };
  const variants = spec.versionVariants || { A: { label: 'Versión A', isBase: true } };
  const currentVariant = variants[selectedVersion] || variants.A;
  
  const availableVersions: NormalizedEvaluation['availableVersions'] = [];
  if (requestedVersions.A) {
    const vA = variants.A as { label?: string; isBase?: boolean } | undefined;
    availableVersions.push({
      key: 'A',
      label: vA?.label || 'Versión A (Universal)',
      isBase: vA?.isBase ?? true,
    });
  }
  if (requestedVersions.B) {
    const vB = variants.B as { label?: string; isBase?: boolean; reason?: string } | undefined;
    availableVersions.push({
      key: 'B',
      label: vB?.label || 'Versión B (Formato Equivalente)',
      isBase: vB?.isBase ?? false,
      reason: vB?.reason,
    });
  }
  if (requestedVersions.C) {
    const vC = variants.C as { label?: string; isBase?: boolean; reason?: string } | undefined;
    availableVersions.push({
      key: 'C',
      label: vC?.label || 'Versión C (Adecuación)',
      isBase: vC?.isBase ?? false,
      reason: vC?.reason,
    });
  }
  // If none pushed (shouldn't happen), at least A
  if (availableVersions.length === 0) {
    availableVersions.push({ key: 'A', label: 'Versión A (Universal)', isBase: true });
  }

  // Build normalized evaluation
  const evaluation: NormalizedEvaluation = {
    // Header
    title: `Evaluación - ${spec.meta?.subject || 'Sin materia'}`,
    subject: safeString(spec.meta?.subject, 'Sin materia'),
    groupName: safeString(spec.meta?.groupName),
    gradeLevel: safeString(spec.meta?.gradeLevel),
    totalStudents: typeof spec.meta?.totalStudents === 'number' ? spec.meta.totalStudents : undefined,
    generatedAt: safeString(spec.generatedAt, new Date().toISOString()),

    // Duration
    totalDuration: spec.meta?.duration?.minutes ?? 90,
    durationBreakdown: spec.meta?.duration?.breakdown,

    // Structure
    sections,
    totalPoints,
    totalItems,

    // Version
    currentVersion: selectedVersion,
    versionLabel: currentVariant?.label || `Versión ${selectedVersion}`,
    availableVersions,

    // Response options
    responseOptions: response.aiReport?.responseOptions
      ? {
          included: response.aiReport.responseOptions.included,
          count: response.aiReport.responseOptions.count,
        }
      : undefined,

    // Metadata
    contentIds: safeArray<string>(spec.meta?.contentIds),
    competencyIds: safeArray<string>(spec.meta?.competencyIds),
    criteriosLogro: safeArray<string>(spec.meta?.criteriosLogro),
  };

  return {
    success: true,
    evaluation,
    warnings: ctx.warnings,
    errors: ctx.errors,
    rawSpec: spec,
  };
}

// ============================================================================
// VALIDATION FOR RENDERABILITY
// ============================================================================

/**
 * Check if a v2 response can be rendered.
 * Returns false if critical data is missing.
 * 
 * DEBUG: Enhanced logging for blank screen diagnosis
 */
export function canRenderV2(response: unknown): response is V2Response {
  console.log('[V2_NORMALIZER] canRenderV2 called with:', {
    responseType: typeof response,
    isNull: response === null,
    isUndefined: response === undefined
  });

  if (!response || typeof response !== 'object') {
    console.warn('[V2_NORMALIZER] canRenderV2 FAIL: response is not an object');
    return false;
  }
  
  const r = response as Record<string, unknown>;
  
  // Must have success: true
  if (r.success !== true) {
    console.warn('[V2_NORMALIZER] canRenderV2 FAIL: success is not true', { success: r.success });
    return false;
  }
  
  // Must have evaluationSpec
  if (!r.evaluationSpec || typeof r.evaluationSpec !== 'object') {
    console.warn('[V2_NORMALIZER] canRenderV2 FAIL: no evaluationSpec', { evaluationSpec: r.evaluationSpec });
    return false;
  }
  
  const spec = r.evaluationSpec as Record<string, unknown>;
  
  // Must have sections array with at least one section
  if (!Array.isArray(spec.sections)) {
    console.warn('[V2_NORMALIZER] canRenderV2 FAIL: sections is not an array', { sections: spec.sections });
    return false;
  }
  
  if (spec.sections.length === 0) {
    console.warn('[V2_NORMALIZER] canRenderV2 FAIL: sections is empty');
    return false;
  }
  
  // At least one section must have items
  const hasItems = spec.sections.some((section: unknown) => {
    if (!section || typeof section !== 'object') return false;
    const s = section as Record<string, unknown>;
    return Array.isArray(s.items) && s.items.length > 0;
  });
  
  if (!hasItems) {
    console.warn('[V2_NORMALIZER] canRenderV2 FAIL: no section has items', {
      sections: spec.sections.map((s: any) => ({
        title: s?.title,
        itemsCount: Array.isArray(s?.items) ? s.items.length : 'not array'
      }))
    });
    return false;
  }
  
  console.log('[V2_NORMALIZER] canRenderV2 PASS ✓');
  return true;
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export { ITEM_TYPE_LABELS };
