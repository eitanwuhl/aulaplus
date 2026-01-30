/**
 * Poll for extracted_text to become available
 * 
 * Used when materials-only planning/evaluation needs extracted_text
 * but it's not yet available (extraction in progress).
 */

import { supabase } from '@/integrations/supabase/client';

export interface PollExtractedTextOptions {
  materialId: string;
  maxWaitSeconds?: number;
  pollIntervalMs?: number;
  onProgress?: (attempt: number, maxAttempts: number) => void;
}

export interface PollExtractedTextResult {
  success: boolean;
  extractedText?: string;
  extractedChars?: number;
  error?: string;
  attempts?: number;
}

/**
 * Poll database for extracted_text to become non-null
 * 
 * @param options - Polling configuration
 * @returns Result with extracted_text if available
 */
export async function pollExtractedText(
  options: PollExtractedTextOptions
): Promise<PollExtractedTextResult> {
  const {
    materialId,
    maxWaitSeconds = 10,
    pollIntervalMs = 1000,
    onProgress
  } = options;

  const maxAttempts = Math.ceil((maxWaitSeconds * 1000) / pollIntervalMs);
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    
    if (onProgress) {
      onProgress(attempts, maxAttempts);
    }

    try {
      const { data, error } = await supabase
        .from('teacher_materials')
        .select('extracted_text')
        .eq('id', materialId)
        .maybeSingle();

      if (error) {
        console.error('[pollExtractedText] Query error:', error);
        return {
          success: false,
          error: error.message || 'Error al verificar texto extraído',
          attempts
        };
      }

      if (data?.extracted_text) {
        return {
          success: true,
          extractedText: data.extracted_text,
          extractedChars: data.extracted_text.length,
          attempts
        };
      }

      // Wait before next poll (except on last attempt)
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }
    } catch (error) {
      console.error('[pollExtractedText] Unexpected error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error inesperado',
        attempts
      };
    }
  }

  // Timeout: extracted_text still not available
  return {
    success: false,
    error: `Texto no extraído después de ${maxWaitSeconds} segundos`,
    attempts
  };
}

/**
 * Check if material has extracted_text available
 * 
 * @param materialId - Material ID
 * @returns true if extracted_text is non-null
 */
export async function hasExtractedText(materialId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('teacher_materials')
      .select('extracted_text')
      .eq('id', materialId)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    return !!data.extracted_text;
  } catch (error) {
    console.error('[hasExtractedText] Error:', error);
    return false;
  }
}
