/**
 * A/B/C Generation Validation Rule
 * 
 * Generation is allowed if at least ONE of the following is true:
 * A) >= 1 ANEP content selected (unidades didácticas)
 * B) >= 1 material attached (plan-level or session-level)
 * C) Teacher provided sufficiently informative focus/topic text
 * 
 * This module provides helpers to check these conditions.
 */

export interface GenerationValidationInput {
  // A) ANEP content
  hasAnepContent?: boolean;
  anepContenidos?: string[];
  
  // B) Materials
  hasPlanMaterials?: boolean;
  hasSessionMaterials?: boolean;
  materialCount?: number;
  
  // C) Focus text
  sessionBrief?: string;
  requerimientosDocente?: string;
  sessionBriefs?: (string | undefined)[];
}

export interface GenerationValidationResult {
  canGenerate: boolean;
  reasons: string[];
  failedConditions: Array<'A' | 'B' | 'C'>;
  message?: string;
}

/**
 * Check if focus text is sufficiently informative for generation
 * 
 * Rules:
 * - Session brief: >= 15 characters (trimmed)
 * - Requerimientos docente: >= 20 characters (trimmed)
 */
export function hasSufficientFocusText(input: {
  sessionBrief?: string;
  requerimientosDocente?: string;
}): boolean {
  const brief = (input.sessionBrief?.trim() || '').length >= 15;
  const requerimientos = (input.requerimientosDocente?.trim() || '').length >= 20;
  return brief || requerimientos;
}

/**
 * Check if ANEP content is present and valid
 */
export function hasValidAnepContent(input: {
  hasAnepContent?: boolean;
  anepContenidos?: string[];
}): boolean {
  if (input.hasAnepContent !== undefined) {
    return input.hasAnepContent;
  }
  
  if (input.anepContenidos) {
    return input.anepContenidos.some(c => c.trim().length > 0);
  }
  
  return false;
}

/**
 * Check if materials are attached (plan-level or session-level)
 */
export function hasMaterialsAttached(input: {
  hasPlanMaterials?: boolean;
  hasSessionMaterials?: boolean;
  materialCount?: number;
}): boolean {
  if (input.hasPlanMaterials || input.hasSessionMaterials) {
    return true;
  }
  
  if (input.materialCount !== undefined) {
    return input.materialCount > 0;
  }
  
  return false;
}

/**
 * Main validation function: Check A/B/C rule
 * 
 * @param input - Validation input with all available data
 * @returns Validation result with canGenerate flag and detailed reasons
 */
export function validateGenerationConditions(
  input: GenerationValidationInput
): GenerationValidationResult {
  const reasons: string[] = [];
  const failedConditions: Array<'A' | 'B' | 'C'> = [];
  
  // Check A: ANEP content
  const conditionA = hasValidAnepContent({
    hasAnepContent: input.hasAnepContent,
    anepContenidos: input.anepContenidos
  });
  
  if (conditionA) {
    reasons.push('(A) Contenido ANEP seleccionado');
  } else {
    failedConditions.push('A');
  }
  
  // Check B: Materials
  const conditionB = hasMaterialsAttached({
    hasPlanMaterials: input.hasPlanMaterials,
    hasSessionMaterials: input.hasSessionMaterials,
    materialCount: input.materialCount
  });
  
  if (conditionB) {
    reasons.push('(B) Materiales adjuntos');
  } else {
    failedConditions.push('B');
  }
  
  // Check C: Focus text
  const conditionC = hasSufficientFocusText({
    sessionBrief: input.sessionBrief,
    requerimientosDocente: input.requerimientosDocente
  });
  
  if (conditionC) {
    reasons.push('(C) Texto de foco suficientemente informativo');
  } else {
    failedConditions.push('C');
  }
  
  // At least ONE must be true
  const canGenerate = conditionA || conditionB || conditionC;
  
  let message: string | undefined;
  if (!canGenerate) {
    message = 'No se puede generar: falta contenido ANEP (A), materiales adjuntos (B), o texto de foco suficiente (C). Necesitas al menos uno.';
  } else {
    message = `Generación permitida: ${reasons.join(', ')}`;
  }
  
  return {
    canGenerate,
    reasons,
    failedConditions,
    message
  };
}

/**
 * Get user-friendly message for validation result
 */
export function getValidationMessage(result: GenerationValidationResult): string {
  if (result.canGenerate) {
    return `✅ ${result.message}`;
  }
  
  const missingConditions = result.failedConditions.map(c => {
    switch (c) {
      case 'A': return 'contenido ANEP en unidades didácticas';
      case 'B': return 'materiales docentes adjuntos';
      case 'C': return 'texto de foco/tema suficientemente informativo';
    }
  }).join(', ');
  
  return `❌ No se puede generar. Necesitas al menos uno de: ${missingConditions}`;
}

