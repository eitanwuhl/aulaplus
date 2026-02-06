import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

// ════════════════════════════════════════════════════════════════════════════
// ⚠️  MODIFY-EVALUATION V1 (LEGACY) - If you see this log, V1 is being used!
// ════════════════════════════════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════════════════════');
console.log('⚠️  [V1_ENTRY] MODIFY-EVALUATION V1 (LEGACY) EDGE FUNCTION LOADED');
console.log('═══════════════════════════════════════════════════════════════');

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
console.log('OpenAI API Key:', openAIApiKey);

// Initialize Supabase client for image rehosting
// Note: Using SERVICE_ROLE_KEY instead of SUPABASE_SERVICE_ROLE_KEY
// because Supabase reserves the SUPABASE_* prefix for system secrets
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
};

// Helper function to clean up generated content
function cleanupContent(content: string): string {
  if (!content) return content;
  
  let cleaned = content;
  
  // 1. Eliminar múltiples <br> consecutivos (máximo 2)
  cleaned = cleaned.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');
  
  // 2. Reemplazar TODAS las etiquetas <img> con enlaces de texto
  cleaned = cleaned.replace(
    /<img[^>]+src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi,
    '<p><strong>Imagen:</strong> <a href="$1" target="_blank" rel="noopener noreferrer">$1</a> — $2</p>'
  );
  
  // 3. Manejar img tags sin alt
  cleaned = cleaned.replace(
    /<img[^>]+src=["']([^"']*)["'][^>]*\/?>/gi,
    '<p><strong>Imagen:</strong> <a href="$1" target="_blank" rel="noopener noreferrer">$1</a></p>'
  );
  
  // 4. Eliminar espaciado excesivo entre párrafos
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
  
  // 5. Limpiar espacios antes y después de tags HTML
  cleaned = cleaned.replace(/\s+</g, '<');
  cleaned = cleaned.replace(/>\s+/g, '>');
  
  // 6. Normalizar saltos de línea dentro de tablas
  cleaned = cleaned.replace(/(<\/tr>)\s*\n+\s*(<tr>)/gi, '$1\n  $2');
  
  console.log('Content cleanup applied');
  return cleaned.trim();
}

// ============================================================================
// WRAPPER DETECTION & CLEANING (Single Source of Truth - Backend Only)
// ============================================================================

/**
 * CRITICAL: Detect wrappers ANYWHERE in content, not just at start.
 * This is the single source of truth for wrapper detection.
 * Enhanced to detect ALL wrapper patterns including evaluationBundle.
 */
function hasWrapperLeak(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  
  // Check if starts with JSON wrapper
  if (trimmed.startsWith('{')) return true;
  
  // Check for "versions" key anywhere (indicates JSON wrapper)
  const versionsPattern = /"versions"\s*:\s*\{/;
  if (versionsPattern.test(trimmed)) {
    const firstLt = trimmed.indexOf('<');
    const versionsIdx = trimmed.indexOf('"versions"');
    
    // If "versions" appears before first <, it's definitely a wrapper
    if (firstLt === -1 || versionsIdx < firstLt) return true;
    
    // If "versions" appears after <, check if it's inside HTML content
    const beforeHtml = trimmed.slice(0, Math.min(versionsIdx, firstLt));
    if (beforeHtml.includes('{') && beforeHtml.includes('"versions"')) {
      return true;
    }
  }
  
  // Check for JSON-like fragments: ", "A":", ", "B":", ", "C":"
  const jsonFragmentPattern = /",\s*"[ABC]"\s*:/;
  if (jsonFragmentPattern.test(trimmed)) {
    return true;
  }
  
  // Check for {"versions": {"A": pattern anywhere
  if (/\{\s*"versions"\s*:\s*\{\s*"[ABC]"\s*:/i.test(trimmed)) {
    return true;
  }
  
  // Check for evaluationBundle or similar JSON keys
  if (/evaluationBundle|evaluation_bundle|evaluation-bundle/i.test(trimmed)) {
    // Only flag if it appears before HTML or outside HTML tags
    const bundleIdx = trimmed.toLowerCase().indexOf('evaluationbundle');
    const firstLt = trimmed.indexOf('<');
    if (firstLt === -1 || bundleIdx < firstLt) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract HTML from a value that might be wrapped as an object or JSON string.
 * This handles cases where the model returns the full object or serialized JSON instead of just the HTML.
 * 
 * @param value - The value that might be an object, JSON string, or HTML string
 * @param key - The version key ('A', 'B', or 'C') to extract
 * @returns The extracted HTML string, or empty string if extraction fails
 */
function extractHtmlFromPossiblyWrappedValue(value: unknown, key: 'A' | 'B' | 'C'): string {
  if (value == null) return '';

  // Helper to safely extract string from nested object
  const tryExtract = (obj: any, paths: string[]): string | null => {
    for (const path of paths) {
      const parts = path.split('.');
      let current: any = obj;
      for (const part of parts) {
        if (current == null) break;
        current = current[part];
      }
      if (typeof current === 'string' && current.trim()) {
        return current;
      }
    }
    return null;
  };

  // string no-JSON -> devolver tal cual (pero verificar que no tenga wrappers)
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return '';
    
    // Si no empieza con {, puede ser HTML directo, pero verificar que no tenga wrappers JSON
    if (!s.startsWith('{')) {
      // Verificar que no tenga fragmentos JSON embebidos
      if (hasWrapperLeak(s)) {
        // Tiene wrappers, intentar extraer
        console.warn(`[EXTRACT] String has wrapper leak, attempting extraction for ${key}`);
        // Intentar parsear como JSON parcial
        try {
          const parsed: any = JSON.parse(s);
          const extracted = tryExtract(parsed, [
            `versions.${key}`,
            key,
            `evaluationBundle.versions.${key}`,
            `evaluationBundle.version${key}Html`,
            key === 'A' ? 'evaluationBundle.baseHtml' : '',
            key === 'B' ? 'evaluationBundle.versionBHtml' : '',
            key === 'C' ? 'evaluationBundle.versionCHtml' : ''
          ].filter(Boolean));
          if (extracted) return extracted;
        } catch {
          // No es JSON válido, pero tiene wrappers - buscar patrón manualmente
          const versionsMatch = s.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 's'));
          if (versionsMatch && versionsMatch[1]) {
            // Unescape JSON string
            try {
              return JSON.parse(`"${versionsMatch[1]}"`);
            } catch {
              return versionsMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            }
          }
        }
      }
      return s;
    }

    // string JSON -> parsear y extraer
    try {
      const parsed: any = JSON.parse(s);
      const extracted = tryExtract(parsed, [
        `versions.${key}`,
        key,
        `evaluationBundle.versions.${key}`,
        `evaluationBundle.version${key}Html`,
        key === 'A' ? 'evaluationBundle.baseHtml' : '',
        key === 'B' ? 'evaluationBundle.versionBHtml' : '',
        key === 'C' ? 'evaluationBundle.versionCHtml' : '',
        key === 'A' ? 'baseHtml' : '',
        key === 'B' ? 'versionBHtml' : '',
        key === 'C' ? 'versionCHtml' : ''
      ].filter(Boolean));
      if (extracted) return extracted;
      
      // Si no se encontró, intentar buscar en el string directamente con regex
      const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]*(?:\\\\.[^"]*)*)"`, 's');
      const match = s.match(regex);
      if (match && match[1]) {
        try {
          return JSON.parse(`"${match[1]}"`);
        } catch {
          return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
      }
      
      return '';
    } catch (e) {
      // JSON parse failed, pero puede ser JSON parcial - intentar extraer con regex
      const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]*(?:\\\\.[^"]*)*)"`, 's');
      const match = s.match(regex);
      if (match && match[1]) {
        try {
          return JSON.parse(`"${match[1]}"`);
        } catch {
          return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
      }
      return '';
    }
  }

  // objeto -> extraer
  if (typeof value === 'object') {
    const obj: any = value;
    const extracted = tryExtract(obj, [
      `versions.${key}`,
      key,
      `evaluationBundle.versions.${key}`,
      `evaluationBundle.version${key}Html`,
      key === 'A' ? 'evaluationBundle.baseHtml' : '',
      key === 'B' ? 'evaluationBundle.versionBHtml' : '',
      key === 'C' ? 'evaluationBundle.versionCHtml' : '',
      key === 'A' ? 'baseHtml' : '',
      key === 'B' ? 'versionBHtml' : '',
      key === 'C' ? 'versionCHtml' : ''
    ].filter(Boolean));
    if (extracted) return extracted;
  }

  return '';
}

/**
 * Detect forbidden HTML tags that cause CSS leakage or layout issues.
 * This detects wrapper tags: <html>, <head>, <body>, <style>, <script>, <link>
 */
function hasForbiddenTags(s: string | null): boolean {
  if (!s) return false;
  const lowerHtml = s.toLowerCase();
  const FORBIDDEN_TAGS = ['<html', '</html', '<head', '</head', '<body', '</body', '<style', '</style', '<script', '</script', '<link'];
  return FORBIDDEN_TAGS.some(tag => lowerHtml.includes(tag));
}

/**
 * Detect HTML wrapper tags (html, head, body, style, link rel="stylesheet").
 * Used for validation and logging after normalization.
 */
function hasWrapper(html: string | null): boolean {
  if (!html) return false;
  const lower = html.toLowerCase();
  return (
    lower.includes('<html') ||
    lower.includes('<head') ||
    lower.includes('<body') ||
    lower.includes('<style') ||
    (lower.includes('<link') && lower.includes('stylesheet'))
  );
}

/**
 * Detect cross-contamination: other version content inside this version.
 * For C: detect "versión a", "version a", "versión b", "version b", or markers like <<<VERSION_A etc inside C.
 */
function hasCrossContamination(versionKey: 'A' | 'B' | 'C', html: string | null): boolean {
  if (!html) return false;
  const trimmed = html.trim();
  const DELIM_SUFFIX = '8f3a7b';
  const otherVersionMarkers: string[] = [];
  
  if (versionKey !== 'A') {
    otherVersionMarkers.push(
      `<<<A_EVAL_HTML_START_${DELIM_SUFFIX}>>>`,
      `<<<A_EVAL_HTML_END_${DELIM_SUFFIX}>>>`,
      '<<<VERSION_A_HTML>>>',
      '<<<END_VERSION_A_HTML>>>',
      'Versión A',
      'Version A',
      'VERSION_A_HTML',
      'versión a',
      'version a'
    );
  }
  if (versionKey !== 'B') {
    otherVersionMarkers.push(
      `<<<B_EVAL_HTML_START_${DELIM_SUFFIX}>>>`,
      `<<<B_EVAL_HTML_END_${DELIM_SUFFIX}>>>`,
      '<<<VERSION_B_HTML>>>',
      '<<<END_VERSION_B_HTML>>>',
      'Versión B',
      'Version B',
      'VERSION_B_HTML',
      'versión b',
      'version b'
    );
  }
  if (versionKey !== 'C') {
    otherVersionMarkers.push(
      `<<<C_EVAL_HTML_START_${DELIM_SUFFIX}>>>`,
      `<<<C_EVAL_HTML_END_${DELIM_SUFFIX}>>>`,
      '<<<VERSION_C_HTML>>>',
      '<<<END_VERSION_C_HTML>>>',
      'Versión C',
      'Version C',
      'VERSION_C_HTML',
      'versión c',
      'version c'
    );
  }
  
  return otherVersionMarkers.some(marker => trimmed.includes(marker));
}

/**
 * Check if content looks like a valid HTML block.
 * Must start with < and NOT have wrapper leaks.
 */
function looksLikeValidHtmlBlock(s: string | null): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  return trimmed.startsWith('<') && !hasWrapperLeak(trimmed);
}

/**
 * CRITICAL: Remove any JSON wrapper fragments from HTML content.
 * This is the single source of truth for wrapper cleaning.
 * Applied BEFORE validation to ensure clean HTML.
 */
function removeWrapperFragments(html: string): string {
  if (!html) return html;
  
  let cleaned = html;
  
  // CRITICAL: Remove wrapper patterns in order of specificity (most specific first)
  
  // 1. Remove complete JSON wrapper patterns: {"versions": {"A": " or {"versions": {"B": " or {"versions": {"C": "
  cleaned = cleaned.replace(/\{\s*"versions"\s*:\s*\{\s*"[ABC]"\s*:\s*"/gi, '');
  
  // 2. Remove partial wrapper: {"versions": { (without version key)
  cleaned = cleaned.replace(/\{\s*"versions"\s*:\s*\{/gi, '');
  
  // 3. Remove JSON fragment patterns: ", "A":", ", "B":", ", "C":"
  cleaned = cleaned.replace(/",\s*"[ABC]"\s*:/gi, '');
  cleaned = cleaned.replace(/",\s*"[ABC]"\s*"\s*:/gi, '');
  
  // 4. Remove "Nota:" that might be followed by wrapper fragments
  // Pattern: "Nota: ... { "versions" ..." -> remove the wrapper part, keep "Nota:"
  cleaned = cleaned.replace(/Nota:\s*[^<]*\{\s*"versions"/gi, 'Nota:');
  cleaned = cleaned.replace(/Nota:\s*[^<]*",\s*"[ABC]"\s*:/gi, 'Nota:');
  
  // 5. Remove any remaining "versions" key that might be left
  cleaned = cleaned.replace(/"versions"\s*:/gi, '');
  
  // 6. Remove standalone JSON braces at start/end (must be last, after other patterns)
  cleaned = cleaned.replace(/^\s*\{\s*/, '');
  cleaned = cleaned.replace(/\s*\}\s*$/, '');
  
  // 7. If content still starts with {, try to extract HTML part
  if (cleaned.trim().startsWith('{')) {
    // Try to find first < and extract from there
    const firstLt = cleaned.indexOf('<');
    if (firstLt > 0) {
      cleaned = cleaned.slice(firstLt);
    } else {
      // No < found, try to extract from first quote after "A": "
      const pattern = /"[ABC]"\s*:\s*"([^"]*)/;
      const match = cleaned.match(pattern);
      if (match && match[1]) {
        cleaned = match[1];
      } else {
        // Last resort: try JSON.parse and extract
        try {
          const parsed = JSON.parse(cleaned);
          const extracted = parsed?.versions?.A || parsed?.versions?.B || parsed?.versions?.C || parsed?.A || parsed?.B || parsed?.C || null;
          if (typeof extracted === 'string' && extracted.trim().startsWith('<')) {
            cleaned = extracted.trim();
          } else {
            // If extraction fails, return empty (will be replaced with error block)
            cleaned = '';
          }
        } catch (e) {
          // If JSON.parse fails, return empty (will be replaced with error block)
          cleaned = '';
        }
      }
    }
  }
  
  // 8. Clean up any double spaces, newlines, or artifacts left by removals
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/\s*,\s*,\s*/g, ', '); // Remove double commas
  
  return cleaned.trim();
}

/**
 * CRITICAL: Normalize HTML to a safe fragment for injection.
 * This is the single source of truth for HTML normalization in the backend.
 * 
 * Rules:
 * 1) Trim
 * 2) Remove code fences (```html ... ``` or ``` ... ```)
 * 3) Extract content from <body> if present
 * 4) Remove wrapper tags: <html>, <head>, <body>, <style>, <script>, <link>
 * 5) Return clean fragment ready for injection
 */
function normalizeHtmlFragment(input: string): string {
  if (!input) return input;
  
  let normalized = input;
  
  // Step 1: Trim
  normalized = normalized.trim();
  
  // Step 2: Remove code fences (```html ... ``` or ``` ... ```)
  // Match ```html or ``` followed by content and closing ```
  normalized = normalized.replace(/```html\s*([\s\S]*?)```/gi, '$1');
  normalized = normalized.replace(/```\s*([\s\S]*?)```/gi, '$1');
  
  // Step 3: Extract content from <body> if present (keep inner content, remove tags)
  const bodyMatch = normalized.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    normalized = bodyMatch[1];
  }
  
  // Step 4: Remove DOCTYPE
  normalized = normalized.replace(/<!DOCTYPE[^>]*>/gi, '');
  
  // Step 5: Remove <html> tags (opening and closing)
  normalized = normalized.replace(/<html[^>]*>/gi, '');
  normalized = normalized.replace(/<\/html>/gi, '');
  
  // Step 6: Remove entire <head> section including contents (prevents <link>, <meta>, etc.)
  normalized = normalized.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  
  // Step 7: Remove <body> tags (but keep content inside - already extracted above, but remove any remaining)
  normalized = normalized.replace(/<body[^>]*>/gi, '');
  normalized = normalized.replace(/<\/body>/gi, '');
  
  // Step 8: Remove entire <style> sections - CRITICAL for preventing CSS leakage
  normalized = normalized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Step 9: Remove entire <script> sections
  normalized = normalized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Step 10: Remove <link> tags (can load external stylesheets)
  // Match <link ... rel="stylesheet" ...> or any <link> tag
  normalized = normalized.replace(/<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi, '');
  normalized = normalized.replace(/<link[^>]*>/gi, '');
  
  // Step 11: Remove any remaining standalone wrapper tags
  normalized = normalized.replace(/<head[^>]*>/gi, '');
  normalized = normalized.replace(/<\/head>/gi, '');
  
  // Step 12: Remove dangerous inline styles that could affect global layout
  normalized = normalized.replace(/style\s*=\s*["'][^"']*(?:position\s*:\s*(?:fixed|absolute)|width\s*:\s*100(?:vw|%)|height\s*:\s*100(?:vh|%))[^"']*["']/gi, '');
  
  // Final trim
  return normalized.trim();
}

/**
 * CRITICAL: Sanitize HTML to prevent CSS leakage and layout shrink.
 * Removes tags that can affect global layout: <html>, <head>, <body>, <style>, <script>, <link>
 * 
 * NOTE: This function is kept for backward compatibility but normalizeHtmlFragment is preferred.
 * normalizeHtmlFragment includes code fence removal and body extraction.
 */
function sanitizeHtmlForInjection(html: string): string {
  // Use normalizeHtmlFragment for consistency
  return normalizeHtmlFragment(html);
}

/**
 * Validate that HTML is clean and doesn't contain wrapper fragments.
 * Returns validation result with detailed flags.
 */
function validateCleanHtml(html: string | null, versionKey: 'A' | 'B' | 'C'): {
  ok: boolean;
  html: string | null;
  hasWrapper: boolean;
  hasForbiddenTags: boolean;
  hasCrossContamination: boolean;
  reason?: string;
} {
  if (!html) {
    return { ok: false, html: null, hasWrapper: false, hasForbiddenTags: false, hasCrossContamination: false, reason: 'Empty or null' };
  }
  
  const trimmed = html.trim();
  
  // Must start with <
  if (!trimmed.startsWith('<')) {
    return { ok: false, html: null, hasWrapper: false, hasForbiddenTags: false, hasCrossContamination: false, reason: 'Does not start with <' };
  }
  
  // Check for wrapper
  const hasWrapper = hasWrapperLeak(trimmed);
  if (hasWrapper) {
    return { ok: false, html: null, hasWrapper: true, hasForbiddenTags: false, hasCrossContamination: false, reason: 'Contains JSON wrapper' };
  }
  
  // Check for forbidden tags (cause CSS leakage)
  const lowerHtml = trimmed.toLowerCase();
  const FORBIDDEN_TAGS = ['<html', '</html', '<head', '</head', '<body', '</body', '<style', '</style', '<script', '</script', '<link'];
  const hasForbiddenTags = FORBIDDEN_TAGS.some(tag => lowerHtml.includes(tag.toLowerCase()));
  
  // Check for cross-contamination (other version markers inside this version)
  const DELIM_SUFFIX = '8f3a7b';
  const otherVersionMarkers: string[] = [];
  if (versionKey !== 'A') {
    otherVersionMarkers.push(`<<<A_EVAL_HTML_START_${DELIM_SUFFIX}>>>`, `<<<A_EVAL_HTML_END_${DELIM_SUFFIX}>>>`, 'Versión A', 'Version A', 'VERSION_A_HTML');
  }
  if (versionKey !== 'B') {
    otherVersionMarkers.push(`<<<B_EVAL_HTML_START_${DELIM_SUFFIX}>>>`, `<<<B_EVAL_HTML_END_${DELIM_SUFFIX}>>>`, 'Versión B', 'Version B', 'VERSION_B_HTML');
  }
  if (versionKey !== 'C') {
    otherVersionMarkers.push(`<<<C_EVAL_HTML_START_${DELIM_SUFFIX}>>>`, `<<<C_EVAL_HTML_END_${DELIM_SUFFIX}>>>`, 'Versión C', 'Version C', 'VERSION_C_HTML');
  }
  const hasCrossContamination = otherVersionMarkers.some(marker => trimmed.includes(marker));
  
  if (hasCrossContamination) {
    return { ok: false, html: null, hasWrapper: false, hasForbiddenTags, hasCrossContamination: true, reason: 'Contains markers from other versions' };
  }
  
  return { ok: true, html: trimmed, hasWrapper: false, hasForbiddenTags, hasCrossContamination: false };
}

/**
 * CRITICAL: Finalize a version through the complete pipeline.
 * This is the single source of truth for version processing.
 * Returns ok/fail with detailed reasons for debugging.
 */
function finalizeVersion(raw: string | null, key: 'A' | 'B' | 'C'): { ok: boolean; html: string | null; reasons: string[] } {
  const reasons: string[] = [];
  
  // Step 1: Null check (A must not be null, B/C can be null)
  if (!raw) {
    if (key === 'A') {
      reasons.push('Version A is required but is null or empty');
      return { ok: false, html: null, reasons };
    }
    // B/C can be null
    return { ok: true, html: null, reasons: ['Version is optional and not provided'] };
  }
  
  // Step 2: Cleanup content (normalize HTML)
  let processed = cleanupContent(raw);
  
  // Step 3: Remove wrapper fragments
  processed = removeWrapperFragments(processed);
  
  // Step 4: Sanitize for injection (prevent CSS leakage)
  processed = sanitizeHtmlForInjection(processed);
  
  // Step 5: Validate looksLikeValidHtmlBlock
  if (!looksLikeValidHtmlBlock(processed)) {
    reasons.push('Content does not look like valid HTML block (must start with < and have no wrappers)');
    return { ok: false, html: null, reasons };
  }
  
  // Step 6: Check for wrapper leaks
  if (hasWrapperLeak(processed)) {
    reasons.push('Wrapper leak detected after cleaning');
    return { ok: false, html: null, reasons };
  }
  
  // Step 7: Check for forbidden tags
  if (hasForbiddenTags(processed)) {
    // Try to sanitize again (shouldn't happen, but defense in depth)
    processed = sanitizeHtmlForInjection(processed);
    if (hasForbiddenTags(processed)) {
      reasons.push('Forbidden tags detected after sanitization');
      return { ok: false, html: null, reasons };
    }
  }
  
  // Step 8: Check for cross-contamination (especially for C)
  if (hasCrossContamination(key, processed)) {
    reasons.push(`Cross-contamination detected: other version markers found in version ${key}`);
    return { ok: false, html: null, reasons };
  }
  
  // All checks passed
  return { ok: true, html: processed, reasons: ['All validations passed'] };
}

/**
 * Check if HTML string is clean (starts with < and doesn't contain wrappers).
 * Used in JSON fallback to reject contaminated content.
 */
function isCleanHtml(str: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed.startsWith('<')) return false;
  // Reject if it contains JSON wrapper fragments
  if (trimmed.includes('"versions"') && trimmed.includes('{')) return false;
  if (/",\s*"[ABC]"\s*:/.test(trimmed)) return false;
  return true;
}

/**
 * CRITICAL: Extract versions from model output supporting BOTH formats:
 * 1) JSON wrapper format: {"versions": {"A": "...", "B": "...", "C": "..."}}
 * 2) Delimiter format: <<<A_EVAL_HTML_START_...>>> ... <<<A_EVAL_HTML_END_...>>>
 * 
 * This is the SINGLE source of truth for version extraction.
 * Returns extracted HTML strings, or null if extraction failed.
 */
function extractVersionsFromModelOutput(raw: string): { A: string | null; B: string | null; C: string | null; method: 'delimiters' | 'json' | 'regex' | 'failed' } {
  if (!raw || typeof raw !== 'string') {
    return { A: null, B: null, C: null, method: 'failed' };
  }
  
  const DELIM_SUFFIX = '8f3a7b';
  
  // Helper: extract block between delimiters
  const extractDelimitedBlock = (text: string, startMarker: string, endMarker: string): string | null => {
    const startIdx = text.indexOf(startMarker);
    if (startIdx === -1) return null;
    const contentStart = startIdx + startMarker.length;
    const endIdx = text.indexOf(endMarker, contentStart);
    if (endIdx === -1) return null;
    return text.slice(contentStart, endIdx).trim();
  };
  
  // Helper: safely unescape JSON string value
  const safeUnescapeJsonString = (str: string): string => {
    if (!str) return str;
    try {
      // Try to parse as a JSON string value (handles \n, \", etc.)
      return JSON.parse(`"${str.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}"`);
    } catch {
      // Fallback: manual unescape
      return str
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
  };
  
  // METHOD 1: Try delimiter extraction (new format)
  let A = extractDelimitedBlock(raw, `<<<A_EVAL_HTML_START_${DELIM_SUFFIX}>>>`, `<<<A_EVAL_HTML_END_${DELIM_SUFFIX}>>>`);
  let B = extractDelimitedBlock(raw, `<<<B_EVAL_HTML_START_${DELIM_SUFFIX}>>>`, `<<<B_EVAL_HTML_END_${DELIM_SUFFIX}>>>`);
  let C = extractDelimitedBlock(raw, `<<<C_EVAL_HTML_START_${DELIM_SUFFIX}>>>`, `<<<C_EVAL_HTML_END_${DELIM_SUFFIX}>>>`);
  
  // Try legacy delimiters if new ones not found
  if (!A) A = extractDelimitedBlock(raw, '<<<VERSION_A_HTML>>>', '<<<END_VERSION_A_HTML>>>');
  if (!B) B = extractDelimitedBlock(raw, '<<<VERSION_B_HTML>>>', '<<<END_VERSION_B_HTML>>>');
  if (!C) C = extractDelimitedBlock(raw, '<<<VERSION_C_HTML>>>', '<<<END_VERSION_C_HTML>>>');
  
  if (A) {
    console.log('[EXTRACT_VERSIONS] Method: delimiters');
    return { A, B, C, method: 'delimiters' };
  }
  
  // METHOD 2: Try JSON parsing (wrapper format)
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const jsonA = parsed?.versions?.A || parsed?.A || null;
      const jsonB = parsed?.versions?.B || parsed?.B || null;
      const jsonC = parsed?.versions?.C || parsed?.C || null;
      
      // If JSON parsing worked and we have A, use it
      if (jsonA && typeof jsonA === 'string') {
        console.log('[EXTRACT_VERSIONS] Method: json');
        return { 
          A: jsonA,
          B: jsonB && typeof jsonB === 'string' ? jsonB : null,
          C: jsonC && typeof jsonC === 'string' ? jsonC : null,
          method: 'json'
        };
      }
    } catch (e) {
      // JSON parse failed - try regex extraction
      console.log('[EXTRACT_VERSIONS] JSON parse failed, trying regex extraction');
    }
    
    // METHOD 3: Regex extraction for malformed JSON with escaped content
    // Pattern: "A": "..." where content may have escaped quotes and newlines
    const extractJsonValue = (text: string, key: string): string | null => {
      // Match "A": "..." pattern, handling escaped quotes
      const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
      const match = text.match(pattern);
      if (match && match[1]) {
        // Unescape the captured value
        try {
          return JSON.parse(`"${match[1]}"`);
        } catch {
          // Manual unescape
          return match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
        }
      }
      return null;
    };
    
    const regexA = extractJsonValue(trimmed, 'A');
    const regexB = extractJsonValue(trimmed, 'B');
    const regexC = extractJsonValue(trimmed, 'C');
    
    if (regexA) {
      console.log('[EXTRACT_VERSIONS] Method: regex');
      return { A: regexA, B: regexB, C: regexC, method: 'regex' };
    }
  }
  
  console.warn('[EXTRACT_VERSIONS] All extraction methods failed');
  return { A: null, B: null, C: null, method: 'failed' };
}

/**
 * CRITICAL: Complete version finalization pipeline.
 * Takes raw extracted version and returns clean, validated HTML or null.
 * This is the SINGLE source of truth for version cleaning.
 */
function finalizeExtractedVersion(raw: string | null, key: 'A' | 'B' | 'C'): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  
  // Step 1: Remove wrapper fragments
  let cleaned = removeWrapperFragments(raw);
  
  // Step 2: Cleanup content (normalize HTML)
  cleaned = cleanupContent(cleaned);
  
  // Step 3: Sanitize for injection (prevent CSS leakage)
  cleaned = sanitizeHtmlForInjection(cleaned);
  
  // Step 4: Validate - must start with < and have no wrapper leaks
  const trimmed = cleaned.trim();
  if (!trimmed.startsWith('<')) {
    console.warn(`[FINALIZE_VERSION] ${key}: Does not start with <, returning null`);
    return null;
  }
  
  if (hasWrapperLeak(trimmed)) {
    console.warn(`[FINALIZE_VERSION] ${key}: Still has wrapper leak after cleaning, returning null`);
    return null;
  }
  
  if (hasForbiddenTags(trimmed)) {
    console.warn(`[FINALIZE_VERSION] ${key}: Has forbidden tags after sanitization`);
    // Try one more sanitization pass
    cleaned = sanitizeHtmlForInjection(trimmed);
    if (hasForbiddenTags(cleaned)) {
      console.warn(`[FINALIZE_VERSION] ${key}: Still has forbidden tags, returning null`);
      return null;
    }
  }
  
  if (hasCrossContamination(key, trimmed)) {
    console.warn(`[FINALIZE_VERSION] ${key}: Has cross-contamination markers`);
    return null;
  }
  
  return trimmed;
}

/**
 * Calculate similarity between two HTML strings (0-1 scale).
 * Used to detect if Version C is too similar to Version A.
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  // Remove HTML tags for comparison
  const text1 = str1.replace(/<[^>]+>/g, '').trim();
  const text2 = str2.replace(/<[^>]+>/g, '').trim();
  
  if (text1.length === 0 || text2.length === 0) return 0;
  
  // Simple word-based similarity
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Validates an image URL and rehosts if necessary
 */
async function validateAndRehostImage(url: string, title: string = 'Imagen'): Promise<{
  original_url: string;
  direct_download_url: string;
  title: string;
  source: string;
}> {
  try {
    // Check if URL is direct image URL
    const isDirectImage = /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url);
    
    if (!isDirectImage) {
      // Not a direct image URL, can't process
      return {
        original_url: url,
        direct_download_url: url,
        title,
        source: 'Invalid'
      };
    }

    // Try to validate the image URL
    try {
      const headResponse = await fetch(url, { method: 'HEAD' });
      
      if (!headResponse.ok) {
        throw new Error(`HTTP ${headResponse.status}`);
      }

      const contentType = headResponse.headers.get('Content-Type') || '';
      if (!/image\/(jpeg|jpg|png|webp)/i.test(contentType)) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      // Check for CORS by looking at headers
      const accessControlAllowOrigin = headResponse.headers.get('Access-Control-Allow-Origin');
      const hasCORS = accessControlAllowOrigin === '*' || accessControlAllowOrigin?.includes('lovableproject.com');

      if (hasCORS) {
        // Image is valid and has CORS, use it directly
        let source = 'Web';
        if (url.includes('unsplash.com')) source = 'Unsplash';
        else if (url.includes('pexels.com')) source = 'Pexels';
        else if (url.includes('wikimedia.org')) source = 'Wikimedia';
        
        return {
          original_url: url,
          direct_download_url: url,
          title,
          source
        };
      }
    } catch (error) {
      console.log(`Image validation failed for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // If validation fails or no CORS, rehost the image
    console.log(`Rehosting image: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }

    const blob = await response.blob();
    const contentType = blob.type;
    
    // Determine file extension
    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileName = `${timestamp}-${randomId}.${extension}`;
    const filePath = `images/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('evaluaciones-assets')
      .upload(filePath, blob, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('evaluaciones-assets')
      .getPublicUrl(filePath);

    return {
      original_url: url,
      direct_download_url: publicUrl,
      title,
      source: 'SupabaseStorage'
    };

  } catch (error) {
    console.error(`Error processing image ${url}:`, error);
    return {
      original_url: url,
      direct_download_url: url,
      title,
      source: 'Error'
    };
  }
}

// Helper function to search for real images (simplified version)
async function searchHistoricalImage(query: string): Promise<string | null> {
  try {
    // Para esta implementación simplificada, generamos URLs específicas conocidas
    const uruguayanHistoryImages: { [key: string]: string } = {
      'batlle': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Jose_Batlle_y_Ordonez.jpg/250px-Jose_Batlle_y_Ordonez.jpg',
      'manifestacion': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Montevideo_1918.jpg/400px-Montevideo_1918.jpg',
      'obrera': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Workers_Montevideo_1910s.jpg/350px-Workers_Montevideo_1910s.jpg',
      'legislativo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Palacio_Legislativo_Uruguay.jpg/400px-Palacio_Legislativo_Uruguay.jpg',
      'uruguay': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Flag_of_Uruguay.svg/320px-Flag_of_Uruguay.svg.png'
    };
    
    const queryLower = query.toLowerCase();
    for (const [keyword, url] of Object.entries(uruguayanHistoryImages)) {
      if (queryLower.includes(keyword)) {
        return url;
      }
    }
    
    return null;
  } catch (error) {
    console.log('Image search failed:', error);
    return null;
  }
}

// Helper function for retry logic with exponential backoff
async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error.message?.includes('429') || error.status === 429;
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (isRateLimit && !isLastAttempt) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
}

serve(async (req) => {
  // ════════════════════════════════════════════════════════════════════════════
  // ⚠️  V1 REQUEST RECEIVED - This means the frontend is NOT using V2!
  // ════════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('⚠️  [V1_REQUEST] MODIFY-EVALUATION V1 REQUEST RECEIVED');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`[V1_REQUEST] Timestamp: ${new Date().toISOString()}`);
  console.log(`[V1_REQUEST] Method: ${req.method}`);
  console.log('[V1_REQUEST] If you expected V2, check: 1) Beta toggle enabled? 2) localStorage aulaplus:eval-beta-toggle=true?');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // DEBUG ENDPOINT: Para verificar la API key
  const url = new URL(req.url);
  if (url.pathname.includes('modify-evaluation') && url.searchParams.get('debug') === 'apikey') {
    return new Response(JSON.stringify({ 
      apiKeyPresent: !!openAIApiKey,
      apiKeyPreview: openAIApiKey ? `${openAIApiKey.substring(0, 10)}...${openAIApiKey.substring(openAIApiKey.length - 4)}` : 'NOT SET',
      apiKeyLength: openAIApiKey?.length || 0
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  try {
    const { 
      originalEvaluation, 
      modification, 
      groupContext, 
      type = 'modification',
      adaptationLevel = 'standard',
      prompt: customPrompt,
      // PHASE 2.1: unitContext para generación progresiva (opcional para backward compatibility)
      unitContext,
      // PHASE 3: Optional per-session focus override
      sessionBrief,
      // PHASE 6b: Session digests + time budgeting + AI design report
      generation_context,
      // Universal evaluation generation (backward compatible)
      generation_mode = 'legacy',
      evaluation_design_plan
    } = await req.json();

    console.log('Request received:', { type, adaptationLevel, modification, hasGenerationContext: !!generation_context, generation_mode });
    console.log('OpenAI API Key:', openAIApiKey ? `${openAIApiKey.substring(0, 10)}...${openAIApiKey.substring(openAIApiKey.length - 4)}` : 'NOT SET');

    // FORCE: Universal path takes priority - if generation_mode === 'universal', use it regardless of generation_context
    // Universal evaluation path (must be checked FIRST before generation_context)
    if (type === 'modification' && generation_mode === 'universal') {
      /**
       * Extract versions from input - returns { A?: string, B?: string|null, C?: string|null }
       * NEVER returns wrapper JSON string
       * 
       * Caso 1: output es objeto y ya tiene versions => usarlo
       * Caso 2: output es string JSON válido => JSON.parse y extraer versions
       * Caso 3: output es string "HTML + JSON pegado" => separar: tomar substring desde primer "{" hasta último "}", intentar JSON.parse
       * Si JSON.parse falla => return { A: makeErrorHtml("Model returned non-JSON wrapper"), B:null, C:null }
       */
      const makeErrorHtml = (message: string): string => {
        return `<div class="evaluation"><p><strong>Error:</strong> ${message}</p></div>`;
      };

      const extractVersions = (input: unknown): { A?: string; B?: string | null; C?: string | null } => {
        // Caso 1: output es objeto y ya tiene versions => usarlo
        if (input && typeof input === 'object' && !Array.isArray(input)) {
          const obj = input as any;
          if (obj.versions && typeof obj.versions === 'object') {
            return {
              A: obj.versions.A ?? null,
              B: obj.versions.B ?? null,
              C: obj.versions.C ?? null
            };
          }
          // También verificar en raíz
          if (obj.A || obj.B || obj.C) {
            // CRITICAL FIX: Si A/B/C son strings que empiezan con "{", son wrappers JSON
            // Necesitamos extraer el contenido del wrapper antes de devolverlos
            const aIsWrapper = typeof obj.A === 'string' && obj.A.trim().startsWith('{');
            const bIsWrapper = typeof obj.B === 'string' && obj.B.trim().startsWith('{');
            const cIsWrapper = typeof obj.C === 'string' && obj.C.trim().startsWith('{');
            
            // Si A es wrapper, intentar extraer de él (A suele contener el wrapper completo)
            if (aIsWrapper) {
              try {
                const parsed = JSON.parse(obj.A.trim());
                if (parsed.versions && typeof parsed.versions === 'object') {
                  // Wrapper tiene formato {versions: {A, B, C}}
                  return {
                    A: parsed.versions.A ?? null,
                    B: parsed.versions.B ?? (bIsWrapper ? null : obj.B) ?? null,
                    C: parsed.versions.C ?? (cIsWrapper ? null : obj.C) ?? null
                  };
                }
                if (parsed.A || parsed.B || parsed.C) {
                  // Wrapper tiene formato {A, B, C} en raíz
                  return {
                    A: parsed.A ?? null,
                    B: parsed.B ?? (bIsWrapper ? null : obj.B) ?? null,
                    C: parsed.C ?? (cIsWrapper ? null : obj.C) ?? null
                  };
                }
              } catch (e) {
                // JSON parse falló - el wrapper está malformado
                // Intentar extraer con regex como fallback
                const firstBrace = obj.A.trim().indexOf('{');
                const lastBrace = obj.A.trim().lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                  const jsonCandidate = obj.A.trim().slice(firstBrace, lastBrace + 1);
                  try {
                    const parsed = JSON.parse(jsonCandidate);
                    if (parsed.versions && typeof parsed.versions === 'object') {
                      return {
                        A: parsed.versions.A ?? null,
                        B: parsed.versions.B ?? (bIsWrapper ? null : obj.B) ?? null,
                        C: parsed.versions.C ?? (cIsWrapper ? null : obj.C) ?? null
                      };
                    }
                    if (parsed.A || parsed.B || parsed.C) {
                      return {
                        A: parsed.A ?? null,
                        B: parsed.B ?? (bIsWrapper ? null : obj.B) ?? null,
                        C: parsed.C ?? (cIsWrapper ? null : obj.C) ?? null
                      };
                    }
                  } catch (e2) {
                    // Ambos intentos fallaron - devolver error HTML para A
                    return {
                      A: makeErrorHtml('Model returned non-JSON wrapper in Version A (parse failed)'),
                      B: bIsWrapper ? null : obj.B ?? null,
                      C: cIsWrapper ? null : obj.C ?? null
                    };
                  }
                }
                // Si no se pudo extraer, devolver error HTML para A
                return {
                  A: makeErrorHtml('Model returned non-JSON wrapper in Version A (parse failed)'),
                  B: bIsWrapper ? null : obj.B ?? null,
                  C: cIsWrapper ? null : obj.C ?? null
                };
              }
            }
            
            // Si B o C son wrappers pero A no, intentar extraer de ellos individualmente
            if (bIsWrapper && !aIsWrapper) {
              try {
                const parsed = JSON.parse(obj.B.trim());
                if (parsed.versions?.B) {
                  obj.B = parsed.versions.B;
                } else if (parsed.B) {
                  obj.B = parsed.B;
                } else {
                  obj.B = null; // Wrapper no contiene B válido
                }
              } catch (e) {
                obj.B = null; // Parse falló
              }
            }
            
            if (cIsWrapper && !aIsWrapper) {
              try {
                const parsed = JSON.parse(obj.C.trim());
                if (parsed.versions?.C) {
                  obj.C = parsed.versions.C;
                } else if (parsed.C) {
                  obj.C = parsed.C;
                } else {
                  obj.C = null; // Wrapper no contiene C válido
                }
              } catch (e) {
                obj.C = null; // Parse falló
              }
            }
            
            // Si no hay wrappers o la extracción fue exitosa, devolver valores
            return {
              A: obj.A ?? null,
              B: obj.B ?? null,
              C: obj.C ?? null
            };
          }
        }

        // Caso 2 y 3: output es string
        if (typeof input === 'string') {
          const trimmed = input.trim();
          if (!trimmed) {
            return { A: makeErrorHtml('Model returned empty output'), B: null, C: null };
          }

          // Si input es string que empieza con "{": intentar JSON.parse
          if (trimmed.startsWith('{')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.versions && typeof parsed.versions === 'object') {
                return {
                  A: parsed.versions.A ?? null,
                  B: parsed.versions.B ?? null,
                  C: parsed.versions.C ?? null
                };
              }
              if (parsed.A || parsed.B || parsed.C) {
                return {
                  A: parsed.A ?? null,
                  B: parsed.B ?? null,
                  C: parsed.C ?? null
                };
              }
            } catch (e) {
              // JSON parse falló => return error HTML
              return { A: makeErrorHtml('Model returned non-JSON wrapper (parse failed)'), B: null, C: null };
            }
          }

          // Caso 3: input tiene HTML antes del "{": separar jsonCandidate = input.slice(firstBrace, lastBrace+1) y parsear
          const firstBrace = trimmed.indexOf('{');
          const lastBrace = trimmed.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
            try {
              const parsed = JSON.parse(jsonCandidate);
              if (parsed.versions && typeof parsed.versions === 'object') {
                return {
                  A: parsed.versions.A ?? null,
                  B: parsed.versions.B ?? null,
                  C: parsed.versions.C ?? null
                };
              }
              if (parsed.A || parsed.B || parsed.C) {
                return {
                  A: parsed.A ?? null,
                  B: parsed.B ?? null,
                  C: parsed.C ?? null
                };
              }
            } catch (e) {
              // JSON parse falló => return error HTML
              return { A: makeErrorHtml('Model returned mixed HTML+JSON but JSON parse failed'), B: null, C: null };
            }
          }

          // Si no es JSON y empieza con "<", tratar como HTML directo
          if (trimmed.startsWith('<')) {
            return { A: trimmed, B: null, C: null };
          }

          // Si no es ni JSON ni HTML, error
          return { A: makeErrorHtml('Model returned invalid format (not JSON, not HTML)'), B: null, C: null };
        }

        // Si no es objeto ni string, error
        return { A: makeErrorHtml('Model returned invalid type'), B: null, C: null };
      };

      /**
       * Normalize HTML to safe fragment
       * - si null => null
       * - remover code fences
       * - remover DOCTYPE
       * - si hay <body> => extraer inner body
       * - remover completamente: <head>...</head>, <style>...</style>, <script>...</script>, <link ...>, y tags <html>/<body>/<head> residuales
       * - trim
       * - VALIDAR: no contiene "<head" ni "<style" ni empieza con "{"
       * - si falla => return makeErrorHtml("Unsafe/invalid HTML returned")
       */
      const normalizeHtmlFragment = (html: string | null | undefined): string | null => {
        if (html == null) return null;
        if (typeof html !== 'string') return null;

        let cleaned = html.trim();
        if (!cleaned) return null;

        // Remover code fences
        cleaned = cleaned.replace(/```html\s*([\s\S]*?)```/gi, '$1');
        cleaned = cleaned.replace(/```\s*([\s\S]*?)```/gi, '$1');

        // Remover DOCTYPE
        cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');

        // Si hay <body> => extraer inner body
        const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch && bodyMatch[1]) {
          cleaned = bodyMatch[1];
        }

        // Remover completamente: <head>...</head>, <style>...</style>, <script>...</script>, <link ...>
        cleaned = cleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
        cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        cleaned = cleaned.replace(/<link[^>]*>/gi, '');

        // Remover tags residuales: <html>, </html>, <body>, </body>, <head>, </head>
        cleaned = cleaned.replace(/<html[^>]*>/gi, '');
        cleaned = cleaned.replace(/<\/html>/gi, '');
        cleaned = cleaned.replace(/<body[^>]*>/gi, '');
        cleaned = cleaned.replace(/<\/body>/gi, '');
        cleaned = cleaned.replace(/<head[^>]*>/gi, '');
        cleaned = cleaned.replace(/<\/head>/gi, '');

        cleaned = cleaned.trim();

        // VALIDAR: no contiene "<head" ni "<style" ni empieza con "{"
        if (cleaned.includes('<head') || cleaned.includes('</head>')) {
          return makeErrorHtml('Unsafe/invalid HTML returned (contains &lt;head&gt;)');
        }
        if (cleaned.includes('<style') || cleaned.includes('</style>')) {
          return makeErrorHtml('Unsafe/invalid HTML returned (contains &lt;style&gt;)');
        }
        if (cleaned.startsWith('{') || /"versions"\s*:\s*\{/.test(cleaned)) {
          return makeErrorHtml('Unsafe/invalid HTML returned (contains JSON wrapper)');
        }

        // Asegurar que empieza con "<"
        if (!cleaned.startsWith('<')) {
          cleaned = `<div class="evaluation">${cleaned}</div>`;
        }

        return cleaned.trim();
      };

      /**
       * Extract and normalize versions from AI output - SINGLE SOURCE OF TRUTH
       * Handles: delimiters, JSON wrapper, HTML+JSON mixed, HTML blocks, error fallback
       * Returns: { A: string|null; B: string|null; C: string|null; warnings: string[]; extractionMethod: string }
       * @deprecated Use extractVersions + normalizeHtmlFragment instead
       */
      const extractAndNormalizeVersions = (aiTextOrObject: unknown): { 
        A: string | null; 
        B: string | null; 
        C: string | null; 
        warnings: string[];
        extractionMethod: 'delimiters' | 'json_wrapper' | 'regex' | 'html_blocks' | 'error_fallback';
      } => {
        const warnings: string[] = [];
        const DELIM_SUFFIX = '8f3a7b';

        // Helper: extract block between delimiters
        const extractDelimitedBlock = (text: string, startMarker: string, endMarker: string): string | null => {
          const startIdx = text.indexOf(startMarker);
          if (startIdx === -1) return null;
          const contentStart = startIdx + startMarker.length;
          const endIdx = text.indexOf(endMarker, contentStart);
          if (endIdx === -1) return null;
          return text.slice(contentStart, endIdx).trim();
        };

        // Helper: normalize HTML to safe fragment
        const normalizeToFragment = (html: string): string => {
          if (!html || typeof html !== 'string') return '';
          let cleaned = html.trim();
          if (!cleaned) return '';

          // Remove code fences
          cleaned = cleaned.replace(/```html\s*([\s\S]*?)```/gi, '$1');
          cleaned = cleaned.replace(/```\s*([\s\S]*?)```/gi, '$1');

          // Remove <head>...</head>, <style>...</style>, <script>...</script>, <link>
          cleaned = cleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
          cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
          cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
          cleaned = cleaned.replace(/<link[^>]*>/gi, '');

          // Remove residual tags
          cleaned = cleaned.replace(/<html[^>]*>/gi, '');
          cleaned = cleaned.replace(/<\/html>/gi, '');
          cleaned = cleaned.replace(/<body[^>]*>/gi, '');
          cleaned = cleaned.replace(/<\/body>/gi, '');
          cleaned = cleaned.replace(/<head[^>]*>/gi, '');
          cleaned = cleaned.replace(/<\/head>/gi, '');
          cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');

          // Extract body content if exists
          const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          if (bodyMatch && bodyMatch[1]) {
            cleaned = bodyMatch[1];
          }

          cleaned = cleaned.trim();

          // Final validation: if still contains <head, <style, starts with {, or contains "versions"
          if (cleaned.includes('<head') || cleaned.includes('</head>') || 
              cleaned.includes('<style') || cleaned.includes('</style>') ||
              cleaned.startsWith('{') || /"versions"\s*:\s*\{/.test(cleaned)) {
            return '<div class="evaluation"><p><strong>Error:</strong> El backend detectó contenido inválido (wrapper JSON o tags peligrosos).</p></div>';
          }

          // Ensure starts with <
          if (!cleaned.startsWith('<')) {
            cleaned = `<div class="evaluation">${cleaned}</div>`;
          }

          return cleaned.trim();
        };

        // Convert input to string if needed
        let rawText = '';
        if (typeof aiTextOrObject === 'string') {
          rawText = aiTextOrObject;
        } else if (aiTextOrObject && typeof aiTextOrObject === 'object') {
          // If it's an object with versions, extract them
          const obj = aiTextOrObject as any;
          if (obj.versions && typeof obj.versions === 'object') {
            const A = obj.versions.A ? normalizeToFragment(String(obj.versions.A)) : null;
            const B = obj.versions.B ? normalizeToFragment(String(obj.versions.B)) : null;
            const C = obj.versions.C ? normalizeToFragment(String(obj.versions.C)) : null;
            return { A, B, C, warnings, extractionMethod: 'json_wrapper' };
          }
          // Try to stringify
          try {
            rawText = JSON.stringify(aiTextOrObject);
          } catch {
            rawText = String(aiTextOrObject);
          }
        } else {
          rawText = String(aiTextOrObject);
        }

        if (!rawText.trim()) {
          return { A: null, B: null, C: null, warnings: ['Empty input'], extractionMethod: 'error_fallback' };
        }

        // METHOD 1: Try delimiter extraction
        let A = extractDelimitedBlock(rawText, `<<<A_EVAL_HTML_START_${DELIM_SUFFIX}>>>`, `<<<A_EVAL_HTML_END_${DELIM_SUFFIX}>>>`);
        let B = extractDelimitedBlock(rawText, `<<<B_EVAL_HTML_START_${DELIM_SUFFIX}>>>`, `<<<B_EVAL_HTML_END_${DELIM_SUFFIX}>>>`);
        let C = extractDelimitedBlock(rawText, `<<<C_EVAL_HTML_START_${DELIM_SUFFIX}>>>`, `<<<C_EVAL_HTML_END_${DELIM_SUFFIX}>>>`);

        // Try legacy delimiters
        if (!A) A = extractDelimitedBlock(rawText, '<<<VERSION_A_HTML>>>', '<<<END_VERSION_A_HTML>>>');
        if (!B) B = extractDelimitedBlock(rawText, '<<<VERSION_B_HTML>>>', '<<<END_VERSION_B_HTML>>>');
        if (!C) C = extractDelimitedBlock(rawText, '<<<VERSION_C_HTML>>>', '<<<END_VERSION_C_HTML>>>');

        if (A) {
          return {
            A: normalizeToFragment(A),
            B: B ? normalizeToFragment(B) : null,
            C: C ? normalizeToFragment(C) : null,
            warnings,
            extractionMethod: 'delimiters'
          };
        }

        // METHOD 2: Try JSON wrapper extraction
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonPart = rawText.slice(firstBrace, lastBrace + 1);
          try {
            const parsed = JSON.parse(jsonPart);
            if (parsed.versions && typeof parsed.versions === 'object') {
              return {
                A: parsed.versions.A ? normalizeToFragment(String(parsed.versions.A)) : null,
                B: parsed.versions.B ? normalizeToFragment(String(parsed.versions.B)) : null,
                C: parsed.versions.C ? normalizeToFragment(String(parsed.versions.C)) : null,
                warnings,
                extractionMethod: 'json_wrapper'
              };
            }
            if (parsed.A || parsed.B || parsed.C) {
              return {
                A: parsed.A ? normalizeToFragment(String(parsed.A)) : null,
                B: parsed.B ? normalizeToFragment(String(parsed.B)) : null,
                C: parsed.C ? normalizeToFragment(String(parsed.C)) : null,
                warnings,
                extractionMethod: 'json_wrapper'
              };
            }
          } catch (e) {
            // JSON parse failed, continue to regex
          }
        }

        // METHOD 3: Try regex extraction for malformed JSON
        const extractJsonValue = (text: string, key: string): string | null => {
          const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's');
          const match = text.match(pattern);
          if (match && match[1]) {
            try {
              return JSON.parse(`"${match[1]}"`);
            } catch {
              return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
          }
          return null;
        };

        const regexA = extractJsonValue(rawText, 'A');
        const regexB = extractJsonValue(rawText, 'B');
        const regexC = extractJsonValue(rawText, 'C');

        if (regexA) {
          return {
            A: normalizeToFragment(regexA),
            B: regexB ? normalizeToFragment(regexB) : null,
            C: regexC ? normalizeToFragment(regexC) : null,
            warnings,
            extractionMethod: 'regex'
          };
        }

        // METHOD 4: Try HTML blocks extraction
        const htmlBlocks = rawText.match(/<html[^>]*>[\s\S]*?<\/html>/gi);
        if (htmlBlocks && htmlBlocks.length > 0) {
          return {
            A: normalizeToFragment(htmlBlocks[0]),
            B: htmlBlocks[1] ? normalizeToFragment(htmlBlocks[1]) : null,
            C: htmlBlocks[2] ? normalizeToFragment(htmlBlocks[2]) : null,
            warnings,
            extractionMethod: 'html_blocks'
          };
        }

        // METHOD 5: Error fallback - treat as HTML direct or error
        if (rawText.trim().startsWith('<')) {
          // It's HTML, normalize it
          const normalized = normalizeToFragment(rawText);
          return {
            A: normalized || '<div class="evaluation"><p><strong>Error:</strong> Versión A no pudo ser extraída correctamente.</p></div>',
            B: null,
            C: null,
            warnings: [...warnings, 'Treated as direct HTML input'],
            extractionMethod: 'error_fallback'
          };
        }

        // Final fallback: error HTML
        warnings.push('All extraction methods failed');
        return {
          A: '<div class="evaluation"><p><strong>Error:</strong> No se pudo extraer la versión A del output del modelo.</p></div>',
          B: null,
          C: null,
          warnings,
          extractionMethod: 'error_fallback'
        };
      };

      /**
       * Extract JSON object from string - helper puro y testeable
       * Si input.trim().startsWith('{') → intentar JSON.parse(input)
       * Si no, buscar la primera { y la última } y parsear ese substring
       * Si el string tiene HTML antes del { (ej "<p>..</p>{...}") igualmente parsear el bloque JSON
       * Si no parsea → retornar null (no inventar)
       */
      const extractJsonObjectFromString = (input: string): object | null => {
        if (!input || typeof input !== 'string') return null;
        
        const trimmed = input.trim();
        if (!trimmed) return null;

        // Si empieza con '{', intentar parsear todo
        if (trimmed.startsWith('{')) {
          try {
            return JSON.parse(trimmed);
          } catch (e) {
            return null;
          }
        }

        // Buscar primera { y última } y parsear ese substring
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonPart = trimmed.slice(firstBrace, lastBrace + 1);
          try {
            return JSON.parse(jsonPart);
          } catch (e) {
            return null;
          }
        }

        return null;
      };

      /**
       * Unwrap versions payload - debe soportar:
       * - payload objeto { versions: {A,B,C} }
       * - payload string JSON completo "{\"versions\":{...}}"
       * - payload string mezclado "<p>nota</p>{\"versions\":{...}}"
       * - payload HTML directo (sin JSON): en ese caso retornar {A: payloadString, B: null, C: null}
       * MUY IMPORTANTE: si lográs parsear {versions:{...}}, NO devuelvas el wrapper; devolvé solo versions.A/B/C
       */
      type Versions = { A: string | null; B: string | null; C: string | null };
      const unwrapVersionsPayload = (payload: unknown): Versions => {
        // 1) Si payload es objeto y tiene versions -> devolver versions
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const obj = payload as any;
          if (obj.versions && typeof obj.versions === 'object') {
            return {
              A: obj.versions.A ?? null,
              B: obj.versions.B ?? null,
              C: obj.versions.C ?? null
            };
          }
          // También verificar en raíz
          if (obj.A || obj.B || obj.C) {
            return {
              A: obj.A ?? null,
              B: obj.B ?? null,
              C: obj.C ?? null
            };
          }
        }

        // 2) Si payload es string
        if (typeof payload === 'string') {
          const trimmed = payload.trim();
          if (!trimmed) return { A: null, B: null, C: null };

          // Intentar extraer JSON object
          const jsonObj = extractJsonObjectFromString(trimmed);
          
          if (jsonObj) {
            // Si logramos parsear JSON, extraer versions
            const obj = jsonObj as any;
            if (obj.versions && typeof obj.versions === 'object') {
              return {
                A: obj.versions.A ?? null,
                B: obj.versions.B ?? null,
                C: obj.versions.C ?? null
              };
            }
            if (obj.A || obj.B || obj.C) {
              return {
                A: obj.A ?? null,
                B: obj.B ?? null,
                C: obj.C ?? null
              };
            }
          }

          // Si NO parsea: payload HTML directo (sin JSON)
          return { A: trimmed, B: null, C: null };
        }

        // 3) Sino: return nulls
        return { A: null, B: null, C: null };
      };

      /**
       * Extract versions from input that might be wrapped in JSON or mixed HTML+JSON.
       * Handles: objects with versions, JSON strings, HTML+JSON mixed strings, plain HTML strings.
       * @deprecated Use unwrapVersionsPayload instead
       */
      const extractVersionsFromMaybeWrapped = (input: unknown): Versions => {
        // 1) Si input es objeto y tiene versions -> devolver versions
        if (input && typeof input === 'object' && !Array.isArray(input)) {
          const obj = input as any;
          if (obj.versions && typeof obj.versions === 'object') {
            return {
              A: obj.versions.A ?? null,
              B: obj.versions.B ?? null,
              C: obj.versions.C ?? null
            };
          }
          // También verificar en raíz
          if (obj.A || obj.B || obj.C) {
            return {
              A: obj.A ?? null,
              B: obj.B ?? null,
              C: obj.C ?? null
            };
          }
        }

        // 2) Si input es string
        if (typeof input === 'string') {
          let s = input.trim();
          if (!s) return {};

          // Remover code fences ``` si existen
          if (s.startsWith('```')) {
            s = s.replace(/```html\s*([\s\S]*?)```/gi, '$1');
            s = s.replace(/```\s*([\s\S]*?)```/gi, '$1');
            s = s.trim();
          }

          // Si contiene JSON wrapper: detectar primera '{' y última '}' y hacer JSON.parse
          // Caso especial: "HTMLprefix{...json...}" -> separar: si hay '{' luego de algún HTML, parsear JSON a partir de '{'
          const firstBrace = s.indexOf('{');
          const lastBrace = s.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            // Verificar si hay HTML antes del '{' (indicador de contenido mixto)
            const beforeBrace = s.slice(0, firstBrace).trim();
            const hasHtmlBeforeBrace = beforeBrace.includes('<') && beforeBrace.length > 0;
            
            // Si hay HTML antes, extraer solo el JSON part
            const jsonPart = s.slice(firstBrace, lastBrace + 1);
            
            try {
              const parsed = JSON.parse(jsonPart);
              if (parsed.versions && typeof parsed.versions === 'object') {
                return {
                  A: parsed.versions.A ?? null,
                  B: parsed.versions.B ?? null,
                  C: parsed.versions.C ?? null
                };
              }
              // También verificar en raíz del JSON
              if (parsed.A || parsed.B || parsed.C) {
                return {
                  A: parsed.A ?? null,
                  B: parsed.B ?? null,
                  C: parsed.C ?? null
                };
              }
            } catch (e) {
              // JSON parse falló, continuar
            }
            
            // Si había HTML antes del JSON y no se pudo parsear, devolver solo el HTML (sin el JSON)
            if (hasHtmlBeforeBrace) {
              return { A: beforeBrace };
            }
          }

          // Si empieza con '{', intentar parsear todo el string
          if (s.startsWith('{')) {
            try {
              const parsed = JSON.parse(s);
              if (parsed.versions && typeof parsed.versions === 'object') {
                return {
                  A: parsed.versions.A ?? null,
                  B: parsed.versions.B ?? null,
                  C: parsed.versions.C ?? null
                };
              }
              if (parsed.A || parsed.B || parsed.C) {
                return {
                  A: parsed.A ?? null,
                  B: parsed.B ?? null,
                  C: parsed.C ?? null
                };
              }
            } catch (e) {
              // JSON parse falló
            }
          }

          // Si NO parsea: devolver { A: input } (tratar como HTML directo)
          return { A: s };
        }

        // 3) Sino: return {}
        return {};
      };

      /**
       * Sanitize HTML to fragment - garantiza:
       * - remover code fences ``` y ```html
       * - remover <!doctype ...>
       * - si hay <body>...</body> extraer solo lo de adentro
       * - remover completamente: <head>...</head>, <style>...</style>, <script>...</script>, cualquier <link ...>
       * - remover tags residuales: <html>, </html>, <body>, </body>, <head>, </head>
       * - trim final
       * - assert final: NO contiene <head, NO contiene <style, NO empieza con {
       * - Ideal: empieza con < (si no, envolver en <div>)
       */
      const sanitizeHtmlToFragment = (html: string): string => {
        if (!html || typeof html !== 'string') return '';
        
        let cleaned = html.trim();
        if (!cleaned) return '';

        // Remover code fences
        cleaned = cleaned.replace(/```html\s*([\s\S]*?)```/gi, '$1');
        cleaned = cleaned.replace(/```\s*([\s\S]*?)```/gi, '$1');

        // Remover <head>...</head> completo
        cleaned = cleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
        // Remover <style>...</style> completo
        cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        // Remover <script>...</script> completo
        cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        // Remover <link ...> (cualquier link)
        cleaned = cleaned.replace(/<link[^>]*>/gi, '');
        
        // Remover tags residuales <html>, </html>, <body>, </body>, <head>, </head>
        cleaned = cleaned.replace(/<html[^>]*>/gi, '');
        cleaned = cleaned.replace(/<\/html>/gi, '');
        cleaned = cleaned.replace(/<body[^>]*>/gi, '');
        cleaned = cleaned.replace(/<\/body>/gi, '');
        cleaned = cleaned.replace(/<head[^>]*>/gi, '');
        cleaned = cleaned.replace(/<\/head>/gi, '');

        // Extraer contenido de <body> si existe
        const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch && bodyMatch[1]) {
          cleaned = bodyMatch[1];
        }

        // Remover DOCTYPE
        cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');

        // Trim final
        cleaned = cleaned.trim();

        // Assert final: NO contiene <head, NO contiene <style, NO empieza con {
        if (cleaned.includes('<head') || cleaned.includes('</head>')) {
          // Remover cualquier resto de head
          cleaned = cleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
          cleaned = cleaned.replace(/<head[^>]*>/gi, '');
          cleaned = cleaned.replace(/<\/head>/gi, '');
          cleaned = cleaned.trim();
        }
        if (cleaned.includes('<style') || cleaned.includes('</style>')) {
          // Remover cualquier resto de style
          cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
          cleaned = cleaned.trim();
        }

        // NO empieza con {
        if (cleaned.startsWith('{')) {
          // Si empieza con {, es un error - envolver en div de error
          return '<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> JSON wrapper detected in HTML fragment</div>';
        }

        // Ideal: empieza con < (si no, envolver en <div>)
        if (!cleaned.startsWith('<')) {
          cleaned = `<div>${cleaned}</div>`;
        }

        return cleaned.trim();
      };

      /**
       * HARD GATE FINAL: Garantiza HTML limpio antes de responder.
       * Elimina wrappers JSON, tags peligrosos (<head>, <style>, <script>, <link>), y valida formato.
       * Retorna HTML limpio o error HTML si no se puede limpiar.
       */
      const finalGateHtml = (html: unknown, key: 'A' | 'B' | 'C'): string | null => {
        // Early exit: debe ser string
        if (typeof html !== 'string') {
          return null;
        }

        // Trim y validar vacío
        let cleaned = html.trim();
        if (!cleaned) {
          return null;
        }

        // Early exit: si empieza con '{' => error HTML (NO intentar parsear múltiples veces)
        if (cleaned.startsWith('{')) {
          return `<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> Invalid JSON wrapper detected in Version ${key}</div>`;
        }

        // Remover code fences ``` ```
        cleaned = cleaned.replace(/```html\s*([\s\S]*?)```/gi, '$1');
        cleaned = cleaned.replace(/```\s*([\s\S]*?)```/gi, '$1');

        // Remover wrappers/tags peligrosos con regex
        // Quitar <head>...</head> completo
        cleaned = cleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
        // Quitar <style>...</style> completo
        cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        // Quitar <script>...</script> completo
        cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        // Quitar tags residuales <html>, <body>, <head>
        cleaned = cleaned.replace(/<html[^>]*>/gi, '');
        cleaned = cleaned.replace(/<\/html>/gi, '');
        cleaned = cleaned.replace(/<body[^>]*>/gi, '');
        cleaned = cleaned.replace(/<\/body>/gi, '');
        cleaned = cleaned.replace(/<head[^>]*>/gi, '');
        cleaned = cleaned.replace(/<\/head>/gi, '');
        // Quitar <link ...> (cualquier link)
        cleaned = cleaned.replace(/<link[^>]*>/gi, '');

        // Trim después de remover tags
        cleaned = cleaned.trim();

        // Validaciones finales: si sigue conteniendo tags peligrosos => error HTML
        if (cleaned.includes('<head') || cleaned.includes('</head>')) {
          return `<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> CSS leakage risk: &lt;head&gt; tag detected in Version ${key}</div>`;
        }
        if (cleaned.includes('<style') || cleaned.includes('</style>')) {
          return `<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> CSS leakage risk: &lt;style&gt; tag detected in Version ${key}</div>`;
        }

        // Si sigue empezando con '{' o contiene JSON wrapper pattern => error HTML
        if (cleaned.startsWith('{') || /"versions"\s*:\s*\{/.test(cleaned)) {
          return `<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> Invalid JSON wrapper detected in Version ${key}</div>`;
        }

        // Si NO empieza con '<' => error HTML
        if (!cleaned.startsWith('<')) {
          return `<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> Invalid HTML format in Version ${key} (does not start with &lt;)</div>`;
        }

        return cleaned;
      };

      const buildUniversalResponse = ({
        baseHtml,
        versionBHtml,
        versionCHtml,
        responseOptionsIncluded,
        responseOptionCount,
        studentAssignments,
        teacherRemindersByStudent,
        aiReport,
        warnings,
        metadata,
        generationPath,
        shouldDropB = false,
        finalTriggers,
        finalAssignmentCounts
      }: {
        baseHtml: string;
        versionBHtml: string | null;
        versionCHtml: string | null;
        responseOptionsIncluded: boolean;
        responseOptionCount: number;
        studentAssignments: Record<string, 'A' | 'B' | 'C'>;
        teacherRemindersByStudent: any[];
        aiReport: any;
        warnings: string[];
        metadata: { tokensUsed: number; model: string };
        generationPath: 'universal' | 'universal_parse_failed';
        shouldDropB?: boolean;
        finalTriggers?: { versionB: boolean; versionC: boolean };
        finalAssignmentCounts?: { A: number; B: number; C: number };
      }) => {
        // CRITICAL: Extract versions and normalize to HTML fragments
        // Combine all inputs to extract versions
        const modelOutput = {
          A: baseHtml,
          B: versionBHtml,
          C: versionCHtml
        };

        // Extract versions (never returns wrapper JSON string)
        const versions = extractVersions(modelOutput);

        // Normalize each version to safe HTML fragment
        const A = normalizeHtmlFragment(versions.A) || makeErrorHtml('Version A normalization failed');
        const B = normalizeHtmlFragment(versions.B);
        const C = normalizeHtmlFragment(versions.C);

        // Final values
        const finalA = A;
        const finalB = B;
        const finalC = C;

        return new Response(JSON.stringify({
          success: true,
          content: finalA,
          type: type,
          evaluationBundle: {
            // Legacy fields for backward compat
            baseHtml: finalA,
            versionBHtml: finalB,
            versionCHtml: finalC,
            // versions.* is an OBJECT with string values (never a string with JSON)
            versions: {
              A: finalA,
              B: finalB,
              C: finalC
            },
            responseOptionsIncluded,
            responseOptionCount,
            // Agregar finalAssignmentCounts en evaluationBundle
            finalAssignmentCounts: finalAssignmentCounts || {
              A: Object.values(studentAssignments).filter(v => v === 'A').length,
              B: Object.values(studentAssignments).filter(v => v === 'B').length,
              C: Object.values(studentAssignments).filter(v => v === 'C').length
            }
          },
          studentAssignments,
          finalAssignmentCounts: finalAssignmentCounts || {
            A: Object.values(studentAssignments).filter(v => v === 'A').length,
            B: Object.values(studentAssignments).filter(v => v === 'B').length,
            C: Object.values(studentAssignments).filter(v => v === 'C').length
          },
          teacherRemindersByStudent,
          aiReport,
          warnings,
          metadata,
          _debug: {
            generationPath,
            hasEvaluationBundle: true,
            hasAiReport: true,
            shouldHaveB,
            shouldHaveC,
            // DEBUG mínimo para verificar en Network (sin loguear HTML completo)
            wrapperDetected: {
              contentStartsWithBrace: finalA.trim().startsWith('{'),
              baseHtmlStartsWithBrace: finalA.trim().startsWith('{'),
              aStartsWithBrace: finalA.trim().startsWith('{'),
              cStartsWithBrace: finalC ? finalC.trim().startsWith('{') : false
            },
            aStartsWithBrace: finalA.trim().startsWith('{'),
            aHasHead: finalA.includes('<head'),
            aHasStyle: finalA.includes('<style'),
            cStartsWithBrace: finalC ? finalC.trim().startsWith('{') : false,
            cHasHead: finalC ? finalC.includes('<head') : false,
            cHasStyle: finalC ? finalC.includes('<style') : false,
            aPrefix: finalA.slice(0, 60),
            cPrefix: finalC ? finalC.slice(0, 60) : null,
            hasHeadStyleAfterNormalize: {
              A: finalA.includes('<head') || finalA.includes('<style'),
              B: finalB ? (finalB.includes('<head') || finalB.includes('<style')) : false,
              C: finalC ? (finalC.includes('<head') || finalC.includes('<style')) : false
            },
            startsWith: {
              A: finalA.slice(0, 60),
              C: finalC ? finalC.slice(0, 60) : null
            },
            hasHead: {
              A: finalA.includes('<head'),
              C: finalC ? finalC.includes('<head') : false
            },
            hasStyle: {
              A: finalA.includes('<style'),
              C: finalC ? finalC.includes('<style') : false
            },
            isJsonWrapper: {
              A: finalA.trim().startsWith('{'),
              C: finalC ? finalC.trim().startsWith('{') : false
            },
            versionsLengths: {
              A: finalA.length,
              B: finalB?.length || 0,
              C: finalC?.length || 0
            },
            isHtml: {
              A: finalA.trim().startsWith('<'),
              B: finalB ? finalB.trim().startsWith('<') : false,
              C: finalC ? finalC.trim().startsWith('<') : false
            },
            hasWrapper: {
              A: finalA.trim().startsWith('{') || /"versions"\s*:\s*\{/.test(finalA),
              B: finalB ? (finalB.trim().startsWith('{') || /"versions"\s*:\s*\{/.test(finalB)) : false,
              C: finalC ? (finalC.trim().startsWith('{') || /"versions"\s*:\s*\{/.test(finalC)) : false
            },
            hasForbiddenTags: {
              A: finalA.includes('<head') || finalA.includes('<style'),
              B: finalB ? (finalB.includes('<head') || finalB.includes('<style')) : false,
              C: finalC ? (finalC.includes('<head') || finalC.includes('<style')) : false
            },
            wrapperDetectedBefore: {
              A: baseHtml.trim().startsWith('{') || /"versions"\s*:\s*\{/.test(baseHtml),
              B: versionBHtml ? (versionBHtml.trim().startsWith('{') || /"versions"\s*:\s*\{/.test(versionBHtml)) : false,
              C: versionCHtml ? (versionCHtml.trim().startsWith('{') || /"versions"\s*:\s*\{/.test(versionCHtml)) : false
            },
            wrapperDetectedAfter: {
              A: false, // Should always be false after normalization
              B: false,
              C: false
            },
            hasCrossContamination: {
              A: false, // Checked in pipeline
              B: false,
              C: false
            },
            triggers: {
              versionB: finalTriggers?.versionB ?? false,
              versionC: finalTriggers?.versionC ?? false
            },
            finalTriggers: finalTriggers || {
              versionB: false,
              versionC: false
            },
            responseOptions: {
              include: responseOptionsIncluded,
              optionCount: responseOptionsIncluded ? responseOptionCount : 0
            },
            assignmentCounts: finalAssignmentCounts || {
              A: Object.values(studentAssignments).filter(v => v === 'A').length,
              B: Object.values(studentAssignments).filter(v => v === 'B').length,
              C: Object.values(studentAssignments).filter(v => v === 'C').length
            },
            droppedVersions: {
              B: shouldDropB || false
            }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      };

      console.log('[UNIVERSAL] Processing evaluation with universal path');
      
      // ======================= OPENAI CONTEXT LOGGING =======================
      // Log the input context data that will be used to build the prompt
      console.log('[OPENAI_CONTEXT] ========== INPUT DATA START ==========');
      console.log('[OPENAI_CONTEXT] groupContext.subject:', groupContext?.subject || 'NOT PROVIDED');
      console.log('[OPENAI_CONTEXT] groupContext.content:', JSON.stringify(groupContext?.content || []));
      console.log('[OPENAI_CONTEXT] groupContext.competencies:', JSON.stringify(groupContext?.competencies || []));
      console.log('[OPENAI_CONTEXT] groupContext.criteriosLogro:', JSON.stringify(groupContext?.criteriosLogro || []));
      console.log('[OPENAI_CONTEXT] groupContext.students.count:', groupContext?.students?.length || 0);
      console.log('[OPENAI_CONTEXT] modification:', modification || 'NONE');
      console.log('[OPENAI_CONTEXT] evaluation_design_plan.keys:', Object.keys(evaluation_design_plan || {}));
      console.log('[OPENAI_CONTEXT] ========== INPUT DATA END ==========');
      // =====================================================================
      
      const designPlan = evaluation_design_plan || {};
      const instrumentDesignRules = Array.isArray(designPlan.instrumentDesignRules)
        ? designPlan.instrumentDesignRules
        : [];
      const studentAssignments = designPlan.studentAssignments || designPlan.assignmentByStudentId || {};
      const teacherRemindersByStudent = Array.isArray(designPlan.perStudentReminders)
        ? designPlan.perStudentReminders
        : [];
      const varkDistribution = designPlan.varkDistribution || {};
      const highStructureNeed = designPlan.highStructureNeed || {};
      const designComplexityCount = typeof designPlan.designComplexityCount === 'number'
        ? designPlan.designComplexityCount
        : instrumentDesignRules.length;
      const bucketedContemplacionIds = designPlan.bucketedContemplacionIds || {};
      const responseOptions = designPlan.responseOptions || {};
      const responseOptionsInclude = responseOptions.include === true;
      const responseOptionCount = [2, 3].includes(responseOptions.optionCount)
        ? responseOptions.optionCount
        : 2;
      const assignmentsIncludeB = Object.values(studentAssignments).includes('B');
      const assignmentsIncludeC = Object.values(studentAssignments).includes('C');
      const hasContentAdaptationStudent = Array.isArray(groupContext?.students)
        ? groupContext.students.some((student: any) =>
            student?.hasDeclaredContentAdaptation === true ||
            student?.requiereAdecuacionContenido === true ||
            student?.requiresContentAdaptation === true ||
            student?.informeTecnico?.requiereAdecuacionContenido === true
          )
        : false;
      
      // ======================= OPENAI CONTEXT LOGGING (DESIGN PLAN) =======================
      console.log('[OPENAI_CONTEXT] ========== DESIGN PLAN DETAILS ==========');
      console.log('[OPENAI_CONTEXT] instrumentDesignRules:', JSON.stringify(instrumentDesignRules));
      console.log('[OPENAI_CONTEXT] studentAssignments.count:', Object.keys(studentAssignments).length);
      console.log('[OPENAI_CONTEXT] studentAssignments.sample:', JSON.stringify(Object.entries(studentAssignments).slice(0, 5)));
      console.log('[OPENAI_CONTEXT] varkDistribution:', JSON.stringify(varkDistribution));
      console.log('[OPENAI_CONTEXT] responseOptionsInclude:', responseOptionsInclude);
      console.log('[OPENAI_CONTEXT] responseOptionCount:', responseOptionCount);
      console.log('[OPENAI_CONTEXT] assignmentsIncludeB:', assignmentsIncludeB);
      console.log('[OPENAI_CONTEXT] assignmentsIncludeC:', assignmentsIncludeC);
      console.log('[OPENAI_CONTEXT] hasContentAdaptationStudent:', hasContentAdaptationStudent);
      console.log('[OPENAI_CONTEXT] designPlan.triggers:', JSON.stringify(designPlan.triggers || {}));
      console.log('[OPENAI_CONTEXT] ========== DESIGN PLAN END ==========');
      // ===================================================================================
      
      // ======================= PHASE 2: REQUESTED VERSIONS (SINGLE SOURCE OF TRUTH) =======================
      // Version A: Always required
      // Version B: Only if design plan triggers it OR students are assigned to B
      // Version C: Only if design plan triggers it OR students are assigned to C OR any student requires content adaptation
      const requestedVersions = {
        A: true, // Always required
        B: designPlan.triggers?.versionB === true || assignmentsIncludeB,
        C: designPlan.triggers?.versionC === true || assignmentsIncludeC || hasContentAdaptationStudent
      };
      
      // Log the centralized decision for observability
      console.log('[REQUESTED_VERSIONS] ========== VERSION DECISION ==========');
      console.log('[REQUESTED_VERSIONS] A:', requestedVersions.A, '(always required)');
      console.log('[REQUESTED_VERSIONS] B:', requestedVersions.B, '| triggers.versionB:', designPlan.triggers?.versionB, '| assignmentsIncludeB:', assignmentsIncludeB);
      console.log('[REQUESTED_VERSIONS] C:', requestedVersions.C, '| triggers.versionC:', designPlan.triggers?.versionC, '| assignmentsIncludeC:', assignmentsIncludeC, '| hasContentAdaptation:', hasContentAdaptationStudent);
      console.log('[REQUESTED_VERSIONS] summary:', requestedVersions.A ? 'A' : '', requestedVersions.B ? '+B' : '', requestedVersions.C ? '+C' : '');
      console.log('[REQUESTED_VERSIONS] ==========================================');
      // ===================================================================================================
      
      // Legacy variables for backward compatibility (will be removed in future phases)
      const generateVersionB = requestedVersions.B;
      const generateVersionC = requestedVersions.C;
      
      // STRATEGY: Unique delimiter blocks + HTML fragments only (no <html>/<head>/<body>/<style>)
      const DELIMITER_SUFFIX = '8f3a7b'; // Unique suffix to avoid accidental matches
      const systemPrompt = `Eres un especialista en evaluación educativa. Tu tarea es generar una evaluación escrita universal, lista para entregar.

REGLAS CRÍTICAS (NO NEGOCIABLES):
1. Evidencia SIEMPRE escrita. Prohibido generar tareas "solo orales".
2. NO inferir diagnósticos ni necesidades desde narrativas. Usa SOLO datos estructurados.
3. CE/CL son definidos por el docente: NO inventar ni inferir nuevos criterios.
4. No incluir explicaciones meta ni razonamientos de IA. NO incluir "Nota:" ni comentarios sobre adaptaciones.
5. **CRÍTICO HTML**: Usa SOLO fragmentos HTML. PROHIBIDO usar:
   - <html>, </html>
   - <head>, </head>
   - <body>, </body>
   - <style>, </style>
   - Cualquier CSS global
6. **CRÍTICO JSON**: NO usar JSON. NO usar { ni }. Si generas JSON, la respuesta es INVÁLIDA.

FORMATO HTML PERMITIDO:
- Usa <div class="evaluation">...</div> como contenedor principal
- Usa <strong>, <p>, <table>, <ul>, <ol>, <li>, <h2>, <h3>
- NO uses <html>, <head>, <body>, <style>, <script>
- Incluye puntajes por ítem cuando aplique

RESPUESTAS CON OPCIONES EQUIVALENTES:
${responseOptionsInclude ? `
- OBLIGATORIO: Cada consigna que requiera respuesta escrita DEBE incluir EXACTAMENTE ${responseOptionCount} opciones equivalentes de formato.
- Formato: "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
` : `
- NO incluir opciones equivalentes de respuesta.
`}

**FORMATO DE SALIDA OBLIGATORIO (DELIMITADORES ÚNICOS):**

Tu respuesta DEBE contener ÚNICAMENTE bloques delimitados así:

<<<A_EVAL_HTML_START_${DELIMITER_SUFFIX}>>>
<div class="evaluation">
...contenido completo de versión A...
</div>
<<<A_EVAL_HTML_END_${DELIMITER_SUFFIX}>>>

${generateVersionB ? `<<<B_EVAL_HTML_START_${DELIMITER_SUFFIX}>>>
<div class="evaluation">
...contenido completo de versión B (formato equivalente, misma evidencia)...
</div>
<<<B_EVAL_HTML_END_${DELIMITER_SUFFIX}>>>` : '(NO generar versión B)'}

${generateVersionC ? `<<<C_EVAL_HTML_START_${DELIMITER_SUFFIX}>>>
<div class="evaluation">
...contenido completo de versión C (adecuación de contenido)...
</div>
<<<C_EVAL_HTML_END_${DELIMITER_SUFFIX}>>>` : '(NO generar versión C)'}

REGLAS ABSOLUTAS:
- PROHIBIDO usar JSON ({ o "versions":)
- PROHIBIDO usar <html>, <head>, <body>, <style>
- Cada versión es INDEPENDIENTE: NO incluir contenido de otras versiones dentro de una versión
- NO incluir notas como "Nota: Esta versión..." ni "Versión A:" dentro del contenido
- La evaluación debe verse como un examen real de secundaria
${generateVersionB ? '- Versión B: Genera esta versión con formato equivalente pero diferente de A.' : '- Versión B: NO generar (no fue solicitada para este grupo).'}
${generateVersionC ? '- Versión C: Genera esta versión con adecuación de contenido, diferente de A y B.' : '- Versión C: NO generar (no fue solicitada para este grupo).'}`;

      const userPrompt = `CONTEXTO DEL GRUPO:
Materia: ${groupContext?.subject || 'No especificada'}
Contenidos: ${groupContext?.content?.join(', ') || 'No especificados'}
Competencias: ${groupContext?.competencies?.join(', ') || 'No provistas'}
Criterios de logro: ${groupContext?.criteriosLogro?.join(', ') || 'No provistos'}

REQUERIMIENTOS DOCENTE:
${modification || 'No hay requerimientos adicionales'}

REGLAS DE DISEÑO:
${instrumentDesignRules.length ? instrumentDesignRules.map((rule: string) => `- ${rule}`).join('\n') : '- (Sin reglas adicionales)'}

VERSIONES REQUERIDAS:
- Versión A: Requerida (evaluación universal base)
${generateVersionB ? '- Versión B: Requerida (formato equivalente, misma evidencia)' : '- Versión B: No requerida para este grupo'}
${generateVersionC ? '- Versión C: Requerida (adecuación de contenido para estudiantes específicos)' : '- Versión C: No requerida para este grupo'}

TAREA:
1. Genera evaluaciones usando los delimitadores <<<X_EVAL_HTML_START_${DELIMITER_SUFFIX}>>> y <<<X_EVAL_HTML_END_${DELIMITER_SUFFIX}>>>.
2. USA SOLO fragmentos HTML (<div class="evaluation">, <p>, <table>, etc). 
   PROHIBIDO usar: <html>, <head>, <body>, <style>, <script>
3. Cada versión debe ser INDEPENDIENTE - NO incluir contenido de otras versiones.
4. NO uses JSON. NO uses { ni }. NO incluyas "versions": { ni ", "A": ni ", "B": ni ", "C":
5. NO incluyas notas meta como "Nota: Esta versión..." dentro del contenido.
6. Las evaluaciones deben verse como exámenes reales de secundaria.

CRÍTICO: Si generas JSON o incluyes fragmentos como {"versions": {"A": " o ", "B":, la respuesta será rechazada.`;

      /**
       * CRITICAL: Generate evaluation with automatic retry and repair.
       * This ensures backend NEVER returns wrapper-contaminated content.
       */
      async function generateEvaluationWithRetries(
        systemPrompt: string,
        userPrompt: string,
        generateVersionB: boolean,
        generateVersionC: boolean,
        shouldHaveB: boolean,
        shouldHaveC: boolean
      ): Promise<{
        rawA: string | null;
        rawB: string | null;
        rawC: string | null;
        warnings: string[];
        attempt: number;
        success: boolean;
        extractionMethod: string;
      }> {
        const MAX_ATTEMPTS = 3;
        const DELIM_SUFFIX = '8f3a7b';

        let lastFailedOutput = '';
        const warnings: string[] = [];
        let extractionMethod = 'unknown';

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          console.log(`[RETRY_SYSTEM] Attempt ${attempt}/${MAX_ATTEMPTS}`);

          // Build prompt (repair prompt for attempts > 1)
          let currentSystemPrompt = systemPrompt;
          let currentUserPrompt = userPrompt;

          if (attempt > 1 && lastFailedOutput) {
            // Repair prompt
            const truncatedOutput = lastFailedOutput.slice(0, 1500);
            currentUserPrompt = `Tu salida anterior violó el formato requerido. Aquí está tu salida anterior (truncada):

${truncatedOutput}

ERRORES DETECTADOS:
- La salida contiene JSON o fragmentos como {"versions": {"A": " o ", "B":
- O contiene wrappers JSON que no deberían aparecer
- O no usa los delimitadores correctos

REQUERIMIENTOS ABSOLUTOS:
1. Re-genera SOLO los bloques delimitados, HTML limpio, sin JSON, sin notas.
2. Cada bloque DEBE empezar con <div (no texto plano).
3. NO incluyas texto antes/después de los bloques.
4. NO incluyas otras versiones dentro de ninguna versión.
5. USA SOLO los delimitadores: <<<A_EVAL_HTML_START_${DELIM_SUFFIX}>>>, etc.

CONTEXTO ORIGINAL:
${userPrompt}`;
          }

          // ======================= OPENAI PROMPT LOGGING =======================
          // Structured logging for prompt observability in Supabase Edge Function logs
          console.log('[OPENAI_PROMPT] ========== REQUEST METADATA ==========');
          console.log('[OPENAI_PROMPT] path: universal');
          console.log('[OPENAI_PROMPT] attempt:', attempt);
          console.log('[OPENAI_PROMPT] model: gpt-4.1-2025-04-14');
          console.log('[OPENAI_PROMPT] max_completion_tokens: 6000');
          console.log('[OPENAI_PROMPT] requestedVersions:', JSON.stringify({ A: true, B: generateVersionB, C: generateVersionC }));
          console.log('[OPENAI_PROMPT] isRepairAttempt:', attempt > 1);
          console.log('[OPENAI_PROMPT] ========== SYSTEM PROMPT START ==========');
          console.log(currentSystemPrompt);
          console.log('[OPENAI_PROMPT] ========== SYSTEM PROMPT END ==========');
          console.log('[OPENAI_PROMPT] systemPromptLength:', currentSystemPrompt.length);
          console.log('[OPENAI_PROMPT] ========== USER PROMPT START ==========');
          console.log(currentUserPrompt);
          console.log('[OPENAI_PROMPT] ========== USER PROMPT END ==========');
          console.log('[OPENAI_PROMPT] userPromptLength:', currentUserPrompt.length);
          console.log('[OPENAI_PROMPT] totalPromptLength:', currentSystemPrompt.length + currentUserPrompt.length);
          // ======================= END OPENAI PROMPT LOGGING =======================

          // Call OpenAI
          const result = await retryWithBackoff(async () => {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openAIApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4.1-2025-04-14',
                messages: [
                  { role: 'system', content: currentSystemPrompt },
                  { role: 'user', content: currentUserPrompt }
                ],
                // NO response_format: json_object - we use delimiter blocks
                max_completion_tokens: 6000
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`OpenAI API error ${response.status}:`, errorText);
              throw new Error(`OpenAI API error: ${response.status}`);
            }

            return await response.json();
          });

          const generatedContent = result.choices[0]?.message?.content;
          lastFailedOutput = generatedContent || '';

          // CRITICAL: Use unified extraction function (handles delimiters AND JSON)
          const extracted = extractVersionsFromModelOutput(generatedContent || '');
          extractionMethod = extracted.method;
          
          console.log(`[RETRY_SYSTEM] Attempt ${attempt} extraction method:`, extracted.method);

          // CRITICAL: Finalize each version through the complete pipeline
          const finalizedA = finalizeExtractedVersion(extracted.A, 'A');
          const finalizedB = finalizeExtractedVersion(extracted.B, 'B');
          const finalizedC = finalizeExtractedVersion(extracted.C, 'C');
          
          // Validate with finalizeVersion for comprehensive checks
          const resultA = finalizeVersion(finalizedA, 'A');
          const resultB = finalizeVersion(finalizedB, 'B');
          const resultC = finalizeVersion(finalizedC, 'C');

          // Validation logs
          console.log(`[RETRY_SYSTEM] Attempt ${attempt} validation:`, {
            A: { ok: resultA.ok, length: resultA.html?.length || 0, reasons: resultA.reasons },
            B: { ok: resultB.ok, length: resultB.html?.length || 0, reasons: resultB.reasons },
            C: { ok: resultC.ok, length: resultC.html?.length || 0, reasons: resultC.reasons }
          });

          // Check if all required versions are valid
          const aValid = resultA.ok;
          const bValid = shouldHaveB ? resultB.ok : (resultB.ok || !rawB); // B valid if required and ok, or optional and null
          const cValid = shouldHaveC ? resultC.ok : (resultC.ok || !rawC); // C valid if required and ok, or optional and null

          if (aValid && bValid && cValid) {
            // Success!
            console.log(`[RETRY_SYSTEM] Success on attempt ${attempt}`);
            if (attempt > 1) {
              warnings.push(`Generación exitosa después de ${attempt} intentos (intentos anteriores fallaron validación)`);
            }
            return {
              rawA: resultA.html,
              rawB: resultB.html,
              rawC: resultC.html,
              warnings,
              attempt,
              success: true,
              extractionMethod
            };
          }

          // Validation failed - log reasons
          const failures: string[] = [];
          if (!aValid) failures.push(`A: ${resultA.reasons.join(', ')}`);
          if (!bValid && shouldHaveB) failures.push(`B: ${resultB.reasons.join(', ')}`);
          if (!cValid && shouldHaveC) failures.push(`C: ${resultC.reasons.join(', ')}`);

          console.warn(`[RETRY_SYSTEM] Attempt ${attempt} failed validation:`, failures);

          // If last attempt, return what we have (will be replaced with error blocks)
          if (attempt === MAX_ATTEMPTS) {
            console.error(`[RETRY_SYSTEM] All ${MAX_ATTEMPTS} attempts failed validation`);
            warnings.push(`Generación falló después de ${MAX_ATTEMPTS} intentos. Se usarán bloques de error.`);
            return {
              rawA: resultA.html,
              rawB: resultB.html,
              rawC: resultC.html,
              warnings,
              attempt,
              success: false,
              extractionMethod
            };
          }
        }

        // Should never reach here, but TypeScript needs it
        return {
          rawA: null,
          rawB: null,
          rawC: null,
          warnings,
          attempt: MAX_ATTEMPTS,
          success: false,
          extractionMethod: 'failed'
        };
      }

      // Compute assignment counts for final response (used later)
      const rawAssignmentsForCheck = designPlan.assignmentByStudentId || designPlan.studentAssignments || studentAssignments || {};
      const assignmentCountsForCheck = {
        A: Object.values(rawAssignmentsForCheck).filter((v: any) => v === 'A').length,
        B: Object.values(rawAssignmentsForCheck).filter((v: any) => v === 'B').length,
        C: Object.values(rawAssignmentsForCheck).filter((v: any) => v === 'C').length
      };
      
      // PHASE 2: Use requestedVersions as single source of truth for validation
      // These aliases ensure backward compatibility with existing code
      const shouldHaveB = requestedVersions.B;
      const shouldHaveC = requestedVersions.C;

      // Use generateEvaluationWithRetries instead of direct OpenAI call
      const generationResult = await generateEvaluationWithRetries(
        systemPrompt,
        userPrompt,
        generateVersionB,
        generateVersionC,
        shouldHaveB,
        shouldHaveC
      );

      const { rawA, rawB, rawC, warnings: retryWarnings } = generationResult;
      const warnings: string[] = [...retryWarnings];

      // CRITICAL: Apply extraction, normalization, and cleanup pipeline
      // Step 1: Extract HTML from possibly wrapped values (JSON/object -> HTML string)
      // This handles cases where the model returns the full object or serialized JSON
      let extractedA = extractHtmlFromPossiblyWrappedValue(rawA, 'A');
      let extractedB = rawB ? extractHtmlFromPossiblyWrappedValue(rawB, 'B') : null;
      let extractedC = rawC ? extractHtmlFromPossiblyWrappedValue(rawC, 'C') : null;

      // Log extraction results for debugging
      console.log('[EXTRACT_HTML] Extraction results', {
        A: {
          rawType: typeof rawA,
          rawStartsWith: typeof rawA === 'string' ? rawA.slice(0, 50) : 'not string',
          extractedType: typeof extractedA,
          extractedStartsWith: extractedA ? extractedA.slice(0, 50) : 'empty',
          extractedLength: extractedA ? extractedA.length : 0,
          isWrapped: extractedA ? (extractedA.trim().startsWith('{') || hasWrapperLeak(extractedA)) : false
        },
        B: {
          rawType: typeof rawB,
          extractedStartsWith: extractedB ? extractedB.slice(0, 50) : 'null',
          isWrapped: extractedB ? (extractedB.trim().startsWith('{') || hasWrapperLeak(extractedB)) : false
        },
        C: {
          rawType: typeof rawC,
          extractedStartsWith: extractedC ? extractedC.slice(0, 50) : 'null',
          isWrapped: extractedC ? (extractedC.trim().startsWith('{') || hasWrapperLeak(extractedC)) : false
        }
      });

      if (!extractedA && rawA) {
        console.warn('[EXTRACT_HTML] Version A extraction failed or returned empty', {
          rawAType: typeof rawA,
          rawAStartsWith: typeof rawA === 'string' ? rawA.slice(0, 200) : 'not string',
          isObject: typeof rawA === 'object',
          rawAKeys: typeof rawA === 'object' && rawA !== null ? Object.keys(rawA).slice(0, 10) : null
        });
      }

      // Step 2: Check if extracted values still have wrappers - re-extract if needed
      // This handles cases where extraction didn't fully unwrap the JSON
      const checkAndReExtract = (extracted: string | null, key: 'A' | 'B' | 'C'): string | null => {
        if (!extracted) return null;
        const trimmed = extracted.trim();
        
        // If starts with { or has wrapper leak, try re-extraction
        if (trimmed.startsWith('{') || hasWrapperLeak(trimmed)) {
          console.warn(`[NORMALIZE] extracted${key} still has wrappers, attempting re-extraction`, {
            startsWith: trimmed.slice(0, 50),
            hasWrapperLeak: hasWrapperLeak(trimmed)
          });
          
          // Try extraction up to 3 times (defense in depth)
          let current = extracted;
          for (let i = 0; i < 3; i++) {
            const reExtracted = extractHtmlFromPossiblyWrappedValue(current, key);
            if (reExtracted && !reExtracted.trim().startsWith('{') && !hasWrapperLeak(reExtracted)) {
              console.log(`[NORMALIZE] extracted${key} re-extraction successful on attempt ${i + 1}`);
              return reExtracted;
            }
            if (reExtracted && reExtracted !== current) {
              current = reExtracted;
            } else {
              break;
            }
          }
          
          console.error(`[NORMALIZE] extracted${key} re-extraction failed after 3 attempts`);
          return null;
        }
        
        return extracted;
      };

      extractedA = checkAndReExtract(extractedA, 'A') || '';
      extractedB = checkAndReExtract(extractedB, 'B');
      extractedC = checkAndReExtract(extractedC, 'C');

      // Step 2b: Normalize HTML fragment (remove code fences, <html>/<head>/<body>, <style>, <link>, <script>)
      extractedA = extractedA ? normalizeHtmlFragment(extractedA) : '';
      extractedB = extractedB ? normalizeHtmlFragment(extractedB) : null;
      extractedC = extractedC ? normalizeHtmlFragment(extractedC) : null;

      // Step 3: Apply cleanupContent if exists (normalize HTML structure)
      if (extractedA) {
        extractedA = cleanupContent(extractedA);
      }
      if (extractedB) {
        extractedB = cleanupContent(extractedB);
      }
      if (extractedC) {
        extractedC = cleanupContent(extractedC);
      }

      // Step 4: Apply final sanitization (defense in depth - remove any remaining wrappers)
      let baseHtml = extractedA ? sanitizeHtmlForInjection(extractedA) : null;
      let versionBHtml = extractedB ? sanitizeHtmlForInjection(extractedB) : null;
      let versionCHtml = extractedC ? sanitizeHtmlForInjection(extractedC) : null;

      // Final validation: if still wrapped after all processing, use error block
      // This is the last line of defense - if content still has wrappers, replace with error
      const finalCheck = (html: string | null, key: string): string | null => {
        if (!html) return null;
        const trimmed = html.trim();
        
        if (trimmed.startsWith('{') || hasWrapperLeak(trimmed)) {
          console.error(`[PIPELINE] ${key} still wrapped after full pipeline`, {
            startsWith: trimmed.slice(0, 150),
            hasWrapperLeak: hasWrapperLeak(trimmed),
            length: trimmed.length
          });
          return `<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> Versión ${key} no pudo ser extraída correctamente del wrapper. El backend detectó contenido JSON donde debería haber HTML.</div>`;
        }
        
        // Also check that it starts with < (valid HTML)
        if (!trimmed.startsWith('<')) {
          console.error(`[PIPELINE] ${key} does not start with < after full pipeline`, {
            startsWith: trimmed.slice(0, 150)
          });
          return `<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> Versión ${key} no es HTML válido.</div>`;
        }
        
        return html;
      };

      baseHtml = finalCheck(baseHtml, 'A');
      versionBHtml = finalCheck(versionBHtml, 'B');
      versionCHtml = finalCheck(versionCHtml, 'C');

      // Handle failure case: if retry failed, use error blocks
      if (!generationResult.success || !baseHtml) {
        console.error('[RETRY_SYSTEM] Generation failed after all retries, using error blocks');
        const debugCode = `ERR-${Date.now().toString(36).toUpperCase()}`;
        baseHtml = `<div class="p-4 bg-red-50 border-2 border-red-500 rounded">
          <strong>Error:</strong> La generación de la evaluación falló después de ${generationResult.attempt} intentos.
          <br><small>Código de depuración: ${debugCode}</small>
        </div>`;
        if (shouldHaveC && !versionCHtml) {
          versionCHtml = `<div class="p-4 bg-red-50 border-2 border-red-500 rounded">
            <strong>Error:</strong> La versión C es requerida pero no pudo ser generada después de ${generationResult.attempt} intentos.
            <br><small>Código de depuración: ${debugCode}</small>
          </div>`;
        }
      }

      // CRITICAL: Hard gates - Final validation before response
      // If ANY version STILL has wrapper leak (JSON starting with {) or doesn't start with <, replace with error block
      // This should rarely trigger now since we extract and normalize before this point
      let finalA = baseHtml;
      let finalB = versionBHtml;
      let finalC = versionCHtml;

      // Final check: if still wrapped (starts with { or has wrapper leak), try one more extraction
      if (finalA && (finalA.trim().startsWith('{') || hasWrapperLeak(finalA))) {
        console.warn('[HARD_GATE] finalA still wrapped after normalization, attempting final extraction');
        const reExtracted = extractHtmlFromPossiblyWrappedValue(finalA, 'A');
        if (reExtracted && !reExtracted.trim().startsWith('{') && !hasWrapperLeak(reExtracted)) {
          finalA = normalizeHtmlFragment(reExtracted);
          finalA = cleanupContent(finalA);
          finalA = sanitizeHtmlForInjection(finalA);
        } else {
          console.error('[HARD_GATE] CRITICAL: finalA still wrapped after re-extraction', {
            first120: finalA.slice(0, 120)
          });
          finalA = '<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> Versión A contaminada detectada (wrapper leak o formato inválido).</div>';
        }
      }

      if (finalA) {
        const aStartsWithLt = finalA.trim().startsWith('<');
        if (!aStartsWithLt) {
          console.error('[HARD_GATE] CRITICAL: finalA does not start with <', {
            first120: finalA.slice(0, 120)
          });
          finalA = '<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> Versión A no es HTML válido.</div>';
        }
      }

      if (finalB) {
        if (finalB.trim().startsWith('{') || hasWrapperLeak(finalB)) {
          console.warn('[HARD_GATE] finalB still wrapped after normalization, attempting final extraction');
          const reExtracted = extractHtmlFromPossiblyWrappedValue(finalB, 'B');
          if (reExtracted && !reExtracted.trim().startsWith('{') && !hasWrapperLeak(reExtracted)) {
            finalB = normalizeHtmlFragment(reExtracted);
            finalB = cleanupContent(finalB);
            finalB = sanitizeHtmlForInjection(finalB);
          } else {
            console.error('[HARD_GATE] CRITICAL: finalB still wrapped after re-extraction');
            finalB = null; // Drop B if contaminated
          }
        }
        if (finalB && !finalB.trim().startsWith('<')) {
          console.error('[HARD_GATE] CRITICAL: finalB does not start with <');
          finalB = null; // Drop B if invalid
        }
      }

      if (finalC) {
        if (finalC.trim().startsWith('{') || hasWrapperLeak(finalC)) {
          console.warn('[HARD_GATE] finalC still wrapped after normalization, attempting final extraction');
          const reExtracted = extractHtmlFromPossiblyWrappedValue(finalC, 'C');
          if (reExtracted && !reExtracted.trim().startsWith('{') && !hasWrapperLeak(reExtracted)) {
            finalC = normalizeHtmlFragment(reExtracted);
            finalC = cleanupContent(finalC);
            finalC = sanitizeHtmlForInjection(finalC);
          } else {
            console.error('[HARD_GATE] CRITICAL: finalC still wrapped after re-extraction', {
              first120: finalC.slice(0, 120)
            });
            finalC = '<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> Versión C contaminada detectada (wrapper leak o formato inválido).</div>';
          }
        }
        if (finalC && !finalC.trim().startsWith('<')) {
          console.error('[HARD_GATE] CRITICAL: finalC does not start with <', {
            first120: finalC.slice(0, 120)
          });
          finalC = '<div class="p-4 bg-red-50 border-2 border-red-500 rounded"><strong>Error:</strong> Versión C no es HTML válido.</div>';
        }
      }

      // R3a: Enforcement determinístico de metacognición (using finalA after hard gates)
      const metacognitionPhrase = 'Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta.';
      if (responseOptionsInclude && finalA && !finalA.includes(metacognitionPhrase)) {
        console.log('[UNIVERSAL] R3a: Metacognition not found in Version A, injecting deterministically');
        
        // Inyectar opciones equivalentes después de cada ítem numerado o consigna relevante
        const numberedItemPattern = /(\d+[\.\)]|\d+\.\s*[A-Z]|^[a-z][\.\)])/i;
        
        let injectedHtml = finalA;
        let injectionCount = 0;
        
        // Buscar ítems que requieren respuesta escrita
        const responseKeywords = ['explica', 'describe', 'analiza', 'compara', 'justifica', 'desarrolla', 'redacta', 'escribe'];
        const needsInjection = (text: string) => {
          const lowerText = text.toLowerCase();
          return responseKeywords.some(keyword => lowerText.includes(keyword)) || 
                 numberedItemPattern.test(text);
        };
        
        // Inyectar después de cada párrafo que contenga consigna relevante
        injectedHtml = injectedHtml.replace(/(<p[^>]*>.*?<\/p>)/gi, (match, pTag) => {
          if (needsInjection(pTag) && !pTag.includes(metacognitionPhrase)) {
            injectionCount++;
            const optionsHtml = `
<p><strong>${metacognitionPhrase}</strong></p>
<ul>
  <li><strong>Opción 1:</strong> Respuesta escrita tradicional (párrafo)</li>
  <li><strong>Opción 2:</strong> Respuesta estructurada (lista con viñetas o tabla)${responseOptionCount === 3 ? '</li>\n  <li><strong>Opción 3:</strong> Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
</ul>`;
            return match + optionsHtml;
          }
          return match;
        });
        
        if (injectionCount > 0) {
          finalA = injectedHtml;
          warnings.push(`Se inyectaron ${injectionCount} bloques de opciones equivalentes determinísticamente (no estaban en la respuesta de la IA).`);
        } else {
          // R4: Fallback: inyectar al menos UNA VEZ después del primer prompt de respuesta escrita
          const firstWrittenResponseMatch = finalA.match(/<p[^>]*>.*?(explica|describe|analiza|compara|justifica|desarrolla|redacta|escribe).*?<\/p>/i);
          if (firstWrittenResponseMatch && firstWrittenResponseMatch.index !== undefined) {
            const insertIndex = firstWrittenResponseMatch.index + firstWrittenResponseMatch[0].length;
            const optionsHtml = `
<p><strong>${metacognitionPhrase}</strong></p>
<ul>
  <li><strong>Opción 1:</strong> Respuesta escrita tradicional (párrafo)</li>
  <li><strong>Opción 2:</strong> Respuesta estructurada (lista con viñetas o tabla)${responseOptionCount === 3 ? '</li>\n  <li><strong>Opción 3:</strong> Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
</ul>`;
            finalA = finalA.slice(0, insertIndex) + optionsHtml + finalA.slice(insertIndex);
            warnings.push('Se inyectó bloque de opciones equivalentes determinísticamente después del primer prompt de respuesta escrita (no estaba en la respuesta de la IA).');
          } else {
            // Último fallback: inyectar al final de la primera sección
            const firstSectionEnd = finalA.indexOf('</p>', finalA.indexOf('<p'));
            if (firstSectionEnd > 0) {
              const optionsHtml = `
<p><strong>${metacognitionPhrase}</strong></p>
<ul>
  <li><strong>Opción 1:</strong> Respuesta escrita tradicional (párrafo)</li>
  <li><strong>Opción 2:</strong> Respuesta estructurada (lista con viñetas o tabla)${responseOptionCount === 3 ? '</li>\n  <li><strong>Opción 3:</strong> Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
</ul>`;
              finalA = finalA.slice(0, firstSectionEnd + 4) + optionsHtml + finalA.slice(firstSectionEnd + 4);
              warnings.push('Se inyectó bloque de opciones equivalentes determinísticamente al inicio (no estaba en la respuesta de la IA).');
            }
          }
        }
        
      }
      
      // R3b: Enforcement determinístico de versión C
      const needsVersionC = generateVersionC && (!versionCHtml || versionCHtml.trim().length === 0);
      if (needsVersionC) {
        console.log('[UNIVERSAL] R3b: Version C required but not generated, creating fallback deterministically');
        console.warn('[UNIVERSAL] Version C requerida pero no fue generada por la IA. Se usará fallback seguro en el response.');
        warnings.push('La versión C fue requerida pero no fue generada por la IA; se devolverá fallback seguro.');
      }
      
      // Determine if parseFailed based on extraction method
      const parseFailed = !generationResult.success;
      
      // A4: studentAssignments MUST NOT be empty - start with evaluation_design_plan.assignmentByStudentId
      // Normalize keys to String and ensure all students have assignments
      const rawAssignments = designPlan.assignmentByStudentId || designPlan.studentAssignments || studentAssignments || {};
      const adjustedAssignments: Record<string, 'A' | 'B' | 'C'> = {};
      
      // Normalize all keys to strings
      Object.entries(rawAssignments).forEach(([key, value]) => {
        adjustedAssignments[String(key)] = value as 'A' | 'B' | 'C';
      });
      
      // Asignar versión C a estudiantes con adecuación de contenido (si corresponde)
      const sid = (s: any): string => String(s?.studentId ?? s?.id ?? s?.student_id ?? '');
      const contentAdaptationIds = Array.isArray(groupContext?.students)
        ? groupContext.students
            .filter((student: any) =>
              student?.hasDeclaredContentAdaptation === true ||
              student?.requiereAdecuacionContenido === true ||
              student?.requiresContentAdaptation === true ||
              student?.informeTecnico?.requiereAdecuacionContenido === true
            )
            .map((student: any) => sid(student))
        : [];
      if (contentAdaptationIds.length > 0) {
        contentAdaptationIds.forEach((studentId) => {
          if (studentId) {
            adjustedAssignments[studentId] = 'C';
          }
        });
      }

      // Compute assignment counts and required versions (already computed above, reuse)
      const assignmentCountsLocal = {
        A: Object.values(adjustedAssignments).filter(v => v === 'A').length,
        B: Object.values(adjustedAssignments).filter(v => v === 'B').length,
        C: Object.values(adjustedAssignments).filter(v => v === 'C').length
      };
      // shouldHaveB and shouldHaveC already defined above, don't redeclare

      // Verificar si B/C realmente existen (no null, no empty string) - después del enforcement
      // A4) Make B truly disappear if not assigned and not forced
      // Apply this to finalB (after hard gates) instead of versionBHtml
      if (assignmentCountsLocal.B === 0 && designPlan.triggers?.versionB !== true) {
        if (finalB) {
          console.log('[UNIVERSAL] Dropping Version B: no assignments to B and triggers.versionB is false');
          warnings.push('La versión B fue generada pero no es necesaria (sin asignaciones y triggers.versionB=false); se eliminó de la respuesta.');
          finalB = null;
        }
      }
      
      // Ensure finalA is never null (shouldn't happen after hard gates, but defense in depth)
      if (!finalA) {
        console.error('[VERSIONS_FINAL] CRITICAL: Version A is null after hard gates');
        finalA = '<div><strong>Error:</strong> Version A generation failed.</div>';
      }

      // Ensure finalC exists if required
      if (shouldHaveC && !finalC) {
        console.error('[VERSIONS_FINAL] CRITICAL: Version C required but missing after hard gates');
        finalC = '<div><strong>Error:</strong> Version C required but missing.</div>';
      }

      // Final validation: ensure version C is not identical to A
      if (finalC && finalA && finalC.trim() === finalA.trim()) {
        console.warn('[UNIVERSAL] Version C equals A, this may indicate extraction bug');
      }
      
      const shouldDropB = assignmentCountsLocal.B === 0 && designPlan.triggers?.versionB !== true;

      // REQUIREMENT 2-3: Construir aiReport - SIEMPRE presente
      // Versiones generadas basadas en REALIDAD (no en plan)
      const generatedVersions: string[] = ['A'];  // A siempre existe
      if (finalB) generatedVersions.push('B');
      if (finalC) generatedVersions.push('C');

      // Extraer valores seguros del evaluation_design_plan
      const safeInstrumentDesignRules = evaluation_design_plan?.instrumentDesignRules ?? [];
      const safeVarkDistribution = evaluation_design_plan?.varkDistribution || {
        visual: 0,
        auditory: 0,
        readWrite: 0,
        kinesthetic: 0
      };

      // Combinar warnings
      const allWarnings = [...warnings];

      // A3: Build meaningful aiReport with design decisions
      const assignmentCounts = {
        A: Object.values(adjustedAssignments).filter(v => v === 'A').length,
        B: Object.values(adjustedAssignments).filter(v => v === 'B').length,
        C: Object.values(adjustedAssignments).filter(v => v === 'C').length
      };
      
      const contentAdaptationStudentIds = Object.entries(adjustedAssignments)
        .filter(([_, version]) => version === 'C')
        .map(([studentId, _]) => studentId);

      const assignmentsByVersion = {
        A: [] as string[],
        B: [] as string[],
        C: [] as string[]
      };
      Object.entries(adjustedAssignments).forEach(([studentId, version]) => {
        if (version === 'A') assignmentsByVersion.A.push(studentId);
        if (version === 'B') assignmentsByVersion.B.push(studentId);
        if (version === 'C') assignmentsByVersion.C.push(studentId);
      });
      
      const perStudentReminders = designPlan.perStudentReminders || [];
      
      // Build detailed rationale
      const contentsRationale = groupContext?.content?.length 
        ? `Contenidos seleccionados: ${groupContext.content.join(', ')}. `
        : '';
      const competenciesRationale = groupContext?.competencies?.length
        ? `Competencias trabajadas: ${groupContext.competencies.join(', ')}. `
        : '';
      
      const versionsRationale = generatedVersions.length === 1
        ? 'Solo se generó la versión base universal (A) porque no se requirieron versiones diferenciadas según el plan de diseño.'
        : `Se generaron las versiones ${generatedVersions.join(', ')} porque: ${generateVersionB ? 'Versión B para estudiantes que requieren formato equivalente. ' : ''}${generateVersionC ? 'Versión C para estudiantes con adecuación de contenido explícita. ' : ''}`;
      
      const responseOptionsRationale = responseOptionsInclude
        ? `Se incluyeron ${responseOptionCount} opciones equivalentes de respuesta (metacognición) para permitir que los estudiantes elijan el formato que mejor se adapte a su estilo de aprendizaje. Las opciones aparecen después de cada consigna que requiere respuesta escrita.`
        : 'No se incluyeron opciones equivalentes de respuesta porque no se detectaron en el HTML final.';
      
      const assignmentsRationale = `Asignaciones: ${assignmentCounts.A} estudiante(s) en versión A (universal), ${assignmentCounts.B} en versión B${assignmentCounts.B > 0 ? ` (formato equivalente)` : ''}, ${assignmentCounts.C} en versión C${assignmentCounts.C > 0 ? ` (adecuación de contenido)` : ''}.${contentAdaptationStudentIds.length > 0 ? ` Estudiantes con adecuación de contenido (IDs: ${contentAdaptationStudentIds.slice(0, 5).join(', ')}${contentAdaptationStudentIds.length > 5 ? ` y ${contentAdaptationStudentIds.length - 5} más` : ''}) asignados a versión C.` : ''}`;
      
      const contemplacionesRationale = Object.keys(bucketedContemplacionIds).length > 0
        ? `Contemplaciones aplicadas: ${Object.keys(bucketedContemplacionIds).length} categorías de contemplaciones fueron consideradas en el diseño del instrumento.`
        : 'No se aplicaron contemplaciones específicas en el diseño.';
      
      const aiReport = {
        design_rationale: `${contentsRationale}${competenciesRationale}${contemplacionesRationale}`,
        versions: {
          generated: generatedVersions,
          reason: versionsRationale,
          count: generatedVersions.length
        },
        contemplaciones: {
          instrument_design: safeInstrumentDesignRules,
          admin_reminders: perStudentReminders.filter((r: any) => r.type === 'admin').map((r: any) => r.text),
          correction_reminders: perStudentReminders.filter((r: any) => r.type === 'correction').map((r: any) => r.text),
          bucketed_ids: bucketedContemplacionIds,
          high_structure_need_percent: highStructureNeed.percent || 0
        },
        response_options: {
          included: responseOptionsInclude,
          optionCount: responseOptionCount,
          rationale: responseOptionsRationale,
          location: responseOptionsInclude ? 'Después de cada consigna que requiere respuesta escrita' : 'No aplica'
        },
        vark: {
          summary: `Distribución VARK: Visual=${safeVarkDistribution.visual || 0}, Auditivo=${safeVarkDistribution.auditory || 0}, Lecto-escritor=${safeVarkDistribution.readWrite || 0}, Kinestésico=${safeVarkDistribution.kinesthetic || 0}`,
          distribution: safeVarkDistribution
        },
        assignments: {
          rationale: assignmentsRationale,
          counts: assignmentCounts,
          content_adaptation_student_ids: contentAdaptationStudentIds,
          by_version: assignmentsByVersion,
          total_students: Object.keys(adjustedAssignments).length
        },
        warnings: allWarnings
      };
      
      // TASK 5: Backend log
      console.log('[UNIVERSAL] response versions startsWith', {
        A: finalA?.slice(0, 15) || 'null',
        C: finalC?.slice(0, 15) || 'null'
      });
      
      // STEP 2: Calculate FINAL assignment counts (after B may have been dropped)
      const finalAssignmentCounts = {
        A: Object.values(adjustedAssignments).filter(v => v === 'A').length,
        B: Object.values(adjustedAssignments).filter(v => v === 'B').length,
        C: Object.values(adjustedAssignments).filter(v => v === 'C').length
      };

      // CRITICAL: Extract and normalize versions from AI output BEFORE building response
      // This is the SINGLE SOURCE OF TRUTH for version extraction and normalization
      // Combine all potential sources into one input
      const aiOutput = {
        A: finalA,
        B: finalB,
        C: finalC
      };

      // Extract and normalize using robust pipeline
      const extracted = extractAndNormalizeVersions(aiOutput);
      
      // Update final values with extracted and normalized versions
      finalA = extracted.A || '<div class="evaluation"><p><strong>Error:</strong> Versión A no pudo ser extraída.</p></div>';
      finalB = extracted.B;
      finalC = extracted.C;

      // Log extraction method for debugging
      console.log('[EXTRACT_AND_NORMALIZE] Extraction result', {
        method: extracted.extractionMethod,
        warnings: extracted.warnings,
        startsWith: {
          A: finalA.slice(0, 60),
          B: finalB?.slice(0, 60) || null,
          C: finalC?.slice(0, 60) || null
        },
        hasHead: {
          A: finalA.includes('<head'),
          B: finalB ? finalB.includes('<head') : false,
          C: finalC ? finalC.includes('<head') : false
        },
        hasStyle: {
          A: finalA.includes('<style'),
          B: finalB ? finalB.includes('<style') : false,
          C: finalC ? finalC.includes('<style') : false
        },
        startsWithBrace: {
          A: finalA.trim().startsWith('{'),
          B: finalB ? finalB.trim().startsWith('{') : false,
          C: finalC ? finalC.trim().startsWith('{') : false
        },
        hasVersionsKey: {
          A: /"versions"\s*:\s*\{/.test(finalA),
          B: finalB ? /"versions"\s*:\s*\{/.test(finalB) : false,
          C: finalC ? /"versions"\s*:\s*\{/.test(finalC) : false
        }
      });

      // Log final integrity check with wrapper detection info
      console.log('[UNIVERSAL] versions integrity', {
        assignmentCounts: finalAssignmentCounts,
        startsWith: {
          A: finalA?.trim().slice(0, 15) || 'null',
          B: finalB?.trim().slice(0, 15) || 'null',
          C: finalC?.trim().slice(0, 15) || 'null'
        },
        isWrapper: {
          A: finalA?.trim().startsWith('{') || false,
          B: finalB?.trim().startsWith('{') || false,
          C: finalC?.trim().startsWith('{') || false
        },
        lengths: {
          A: finalA?.length || 0,
          B: finalB?.length || 0,
          C: finalC?.length || 0
        }
      });

      return buildUniversalResponse({
        baseHtml: finalA,
        versionBHtml: finalB,
        versionCHtml: finalC,
        responseOptionsIncluded: responseOptionsInclude,
        responseOptionCount: responseOptionsInclude ? responseOptionCount : 0,
        studentAssignments: adjustedAssignments,
        teacherRemindersByStudent,
        aiReport,
        warnings: allWarnings,
        metadata: {
          tokensUsed: 0, // Tokens not tracked in retry system
          model: 'gpt-4.1-2025-04-14'
        },
        generationPath: parseFailed ? 'universal_parse_failed' : 'universal',
        shouldDropB: shouldDropB || false,
        finalTriggers: {
          versionB: designPlan.triggers?.versionB || false,
          versionC: designPlan.triggers?.versionC || false
        },
        finalAssignmentCounts
      });
    }

    // Legacy path (backward compatibility)
    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'chat') {
      // Respuesta de chat inteligente
      systemPrompt = `Eres un asistente pedagógico especializado en evaluación educativa. Tu rol es ayudar a docentes a mejorar sus evaluaciones de manera práctica y contextualizada.

CARACTERÍSTICAS:
- Respuestas claras y específicas
- Sugerencias pedagógicamente fundamentadas  
- Enfoque en adaptaciones curriculares
- Conocimiento de diferentes estilos de aprendizaje

CONTEXTO DEL GRUPO:
Materia: ${groupContext?.subject || 'No especificada'}
Contenidos: ${groupContext?.content?.join(', ') || 'No especificados'}
Estudiantes: ${groupContext?.students?.length || 0} estudiantes
Grupo: ${groupContext?.groupName || 'Sin nombre'}`;

      userPrompt = `El docente dice: "${modification}"

Responde de manera útil y específica, sugiriendo mejoras concretas para la evaluación.`;

    } else if (type === 'html_plan') {
      // Planificación específica en HTML puro (sin Markdown)
      systemPrompt = `Eres un asistente pedagógico experto. Tu única tarea es devolver HTML válido y autocontenido.

REGLAS ESTRICTAS:
- NUNCA uses Markdown (no ###, no **negritas**, no ---, no listas con guiones)
- Usá únicamente <h2>, <p>, <ul>, <li>, <strong>, <em>
- No incluyas explicaciones, comentarios ni texto fuera del HTML
- La respuesta debe ser directamente renderizable con dangerouslySetInnerHTML

Estructura requerida:
<section id="plan">
  <h2>Inicio (X min)</h2>
  <p>Descripción en párrafos.</p>
  <ul><li>Actividades específicas</li></ul>
  
  <h2>Desarrollo (Y min)</h2>
  <p>Descripción del desarrollo.</p>
  <ul><li>Más actividades</li></ul>
  
  <h2>Cierre (Z min)</h2>
  <p>Actividades de cierre.</p>
</section>`;

      userPrompt = customPrompt || 'Genera una planificación de clase en HTML válido siguiendo la estructura requerida.';

    } else if (type === 'planning') {
      // PHASE 2.2.1: Construir contexto de secuencia didáctica si unitContext está presente (explanatory text in English)
      const sequenceContext = unitContext ? `
DIDACTIC SEQUENCE CONTEXT:
This class is part of a thematic unit called "${unitContext.contenido}".

- This is class ${unitContext.claseEnUnidad} of ${unitContext.totalClasesUnidad} in this unit.
- Content must be progressive and non-repetitive.
- Do NOT repeat explanations already covered in previous classes.
- Do NOT restate long explanations from previous classes; assume the prior class introduced the basics.
${unitContext.claseEnUnidad === 1 ? '- This is the FIRST class: Focus on introduction, contextualization, and initial exploration.' : ''}
${unitContext.claseEnUnidad > 1 && unitContext.claseEnUnidad < unitContext.totalClasesUnidad ? `- This is a MIDDLE class (${unitContext.claseEnUnidad} of ${unitContext.totalClasesUnidad}): Begin with a brief activation of prior knowledge connecting to the previous class, without repeating long explanations. Deepen and complexify the content. Avoid introducing new core concepts.` : ''}
${unitContext.claseEnUnidad === unitContext.totalClasesUnidad && !unitContext.isExtraSlot ? '- This is the FINAL class: Avoid introducing new core concepts. Focus on integration, transfer, debate, or applied activities.' : ''}
${unitContext.isExtraSlot ? `- This is an ADDITIONAL class beyond the original sequence (class ${unitContext.claseEnUnidad} of ${unitContext.totalClasesUnidad}): Use it preferably for guided review, integrative activities, formative assessment, or an applied project.` : ''}

` : '';

      // PHASE 3.2.1: Build sessionBrief section if provided - PEDAGOGICALLY BINDING
      const sessionBriefSection = sessionBrief?.trim() ? `
ENFOQUE ESPECÍFICO DE ESTA SESIÓN (TEACHER OVERRIDE):
Topic: "${sessionBrief.trim()}"

MANDATORY RULES (HIGH PRIORITY):
1. All main activities (INICIO, DESARROLLO, CIERRE) MUST be explicitly oriented toward this topic.
   - INICIO: Opening activity must directly introduce or activate prior knowledge related to "${sessionBrief.trim()}"
   - DESARROLLO: Main activities must develop, explore, or apply concepts from "${sessionBrief.trim()}" - NOT generic content
   - CIERRE: Synthesis must connect back to "${sessionBrief.trim()}" explicitly

2. Include at least 3 guiding questions that directly reference concepts from the topic (not generic).
   - Questions must use specific terminology or concepts from "${sessionBrief.trim()}"
   - Example: If topic is "Surgimiento del Batllismo", questions should mention "Batllismo", "Batlle", "reformas", NOT just "el período histórico"

3. For each main activity, include a short justification explaining how it addresses the session focus.
   - Add a note like: "Esta actividad desarrolla [concepto específico del sessionBrief] porque..."
   - Make the connection explicit, not implicit

4. Avoid generic activities (e.g. "general discussion", "analyze the topic") unless clearly anchored to the session brief.
   - Replace generic phrases with specific references to "${sessionBrief.trim()}"
   - Example: Instead of "discutir el tema", use "discutir cómo [aspecto específico del sessionBrief] se relaciona con..."

5. If the session brief is narrower than the macro content, prioritize depth over coverage.
   - Focus deeply on "${sessionBrief.trim()}" even if it means covering less of the macro ANEP content
   - Quality and specificity over breadth

CRITICAL: This sessionBrief is a TEACHER OVERRIDE that takes absolute priority over generic ANEP content wording.
- The entire lesson structure must serve this specific focus.
- Do NOT generate a generic lesson and then try to fit the sessionBrief into it.
- Generate the lesson AROUND the sessionBrief from the start.

` : '';

      // PHASE 3 (Profile Usage): Build group profile and student adjustments section (Plain Text Path)
      const groupProfileSectionText = groupContext?.students?.length || groupContext?.dominantProfile ? `

GROUP PROFILE AND STUDENT ADJUSTMENTS:
${groupContext.dominantProfile ? `- Dominant learning style: ${groupContext.dominantProfile}` : ''}
${groupContext.students?.length ? `- Total students: ${groupContext.students.length}
- Students with specific adjustments: ${groupContext.students.filter((s: any) => s.contemplaciones?.length || s.ajustes).length}
${groupContext.students
  .filter((s: any) => s.contemplaciones?.length || s.ajustes)
  .slice(0, 5)  // Limit to 5 for brevity in plain text path
  .map((s: any, idx: number) => `
  Student ${String.fromCharCode(65 + idx)} (${s.perfil || 'Not specified'}):
  - Adjustments: ${s.ajustes || 'None'}
  ${s.contemplaciones?.length ? `- Accommodations: ${s.contemplaciones.join('; ')}` : ''}
`).join('\n')}
` : ''}

MANDATORY PEDAGOGICAL RULES (ACTIVE USE):
Rule A — Evidence Inside Activities:
- Each section (INICIO, DESARROLLO, CIERRE) MUST include at least ONE explicit pedagogical decision derived from group profile or student adjustments.
- Example in INICIO: "Actividad: Visual opener using color-coded cards for 5 minutes..."
- Example in DESARROLLO: "Actividad: Group work with assigned roles (auditory learners lead discussion, kinesthetic learners manipulate materials)..."
- Avoid generic phrases — decisions must be CONCRETE and OBSERVABLE inside "Actividad:" text.

Rule B — Student Adjustments:
${groupContext?.students?.filter((s: any) => s.contemplaciones?.length).length ? `- Since ${groupContext.students.filter((s: any) => s.contemplaciones?.length).length} students have specific accommodations, embed at LEAST TWO concrete adaptations directly into "Actividad:" descriptions (do NOT create new sections).
- Use language: supports, scaffolding, access options, multiple representations.
` : '- Include at least ONE UDL-based support embedded in DESARROLLO activities.'}

Rule C — No Stereotypes:
- DO NOT invent diagnoses. Use respectful language: supports, scaffolding, options.

Rule D — Do Not Force:
- If NO profile and NO adjustments exist, output remains identical to previous behavior.

` : '';

      // Planificación de clase con IA
      systemPrompt = `You are an expert in didactic planning and pedagogy. Your task is to create specific and practical suggestions for class planning, considering different learning styles and curricular adaptation needs.

PEDAGOGICAL PRINCIPLES:
- Meaningful and contextualized learning
- Attention to diversity and learning styles
- Use of active and participatory methodologies
- Inclusion of formative assessment
- Varied and accessible resources

EXPECTED CLASS STRUCTURE:
- Motivational opening (15 min)
- Main development (40 min) 
- Closing and synthesis (5 min)

SPECIFIC CONTEXT:
Subject: ${groupContext?.subject || 'Not specified'}
Contents: ${groupContext?.content?.join(', ') || 'Not specified'}
Dominant profile: ${groupContext?.dominantProfile || 'Mixed'}
Objective: ${groupContext?.objective || 'Not specified'}
Students: ${groupContext?.students?.length || 0}
Group: ${groupContext?.groupName || 'No name'}`;

      // PHASE 3.2.1: Log sessionBrief in modify-evaluation
      if (sessionBrief?.trim()) {
        console.log(`[SESSION_BRIEF] modify-evaluation recibió sessionBrief: "${sessionBrief.trim()}"`);
      }

      userPrompt = `PLANNING REQUEST:
${modification}
${sessionBriefSection}${sequenceContext}${groupProfileSectionText}ADDITIONAL CONTEXT:
${groupContext?.additionalContext || 'Not specified'}

TASK: Generate specific, practical, and applicable didactic suggestions. Include concrete activities, necessary resources, and adaptations for different learning styles.

MANDATORY OUTPUT FORMAT:
- The response MUST be plain text (NO HTML, NO Markdown, NO code fences).
- The response MUST start with "INICIO" and MUST end after the "CIERRE" section.
- NO preamble, NO trailing text, NO extra sections or labels (Title, Objectives, Notes, etc.).
- MUST include exactly one section for each header, in this exact order:
  * INICIO
  * DESARROLLO
  * CIERRE
- Each section MUST include:
  * Actividad: (one or more sentences describing the activity)
  * Recursos: (comma-separated list)
- Do NOT include any other top-level headers.
- Headers MUST be uppercase Spanish: INICIO, DESARROLLO, CIERRE.
${sessionBrief?.trim() ? '- If sessionBrief is provided, ensure the DESARROLLO section directly and clearly develops that focus. Do NOT introduce a different main topic.' : ''}`;

    } else {
      // Generación/Modificación de evaluación LISTA PARA EL ALUMNO
      systemPrompt = `Eres un especialista en evaluación educativa para Historia de Uruguay (9º año). 

## TAREA PRINCIPAL
Generar una evaluación COMPLETA Y LISTA para entregar directamente a estudiantes. No un borrador, no un esquema - sino la propuesta final imprimible.

## POLÍTICA ESTRICTA DE IMÁGENES
CRÍTICO: NUNCA uses etiquetas <img> en tu respuesta. Si necesitas incluir recursos visuales:
- Proporciona ÚNICAMENTE URLs directas de imágenes (que terminen en .jpg, .jpeg, .png, .webp)
- Usa el formato: "Imagen recomendada: https://ejemplo.com/imagen.jpg - Descripción de la imagen"
- Prefiere fuentes con CORS abierto: Unsplash, Pexels, Wikimedia, sitios gubernamentales
- Evita Google Images, páginas de vista previa, o URLs con parámetros complejos que requieran cookies
- Todas las URLs de imágenes deben ser descargables directamente y funcionar con crossOrigin="anonymous"

Para contenido visual específico:
- Historia: Usa Wikimedia Commons o archivos gubernamentales
- Fotografías generales: Unsplash o Pexels
- Mapas: OpenStreetMap o recursos gubernamentales
- Documentos históricos: Bibliotecas digitales con acceso abierto

## COMPORTAMIENTO POR DEFECTO
Si el docente no especifica modalidad: generar un parcial/escrito formal tradicional con:
- Partes I, II, III claramente diferenciadas
- Consignas comprensibles para estudiantes
- Puntajes asignados por ítem
- Duración exacta según configuración (ej: 90 minutos)

Si especifica otra modalidad (interdisciplinaria, proyectos, portafolio): adaptar el formato manteniendo estas reglas.

## FORMATO OBLIGATORIO

**TÍTULO:**
Evaluación – Historia – 9º1 – [Fecha opcional]

**INSTRUCCIONES GENERALES (máx. 2-3 líneas):**
Ejemplo: "Lee atentamente cada consigna. Responde de forma clara y completa. Tiempo: 90 minutos."

**ESTRUCTURA DE PARTES:**

**Parte I** (Ejemplo: 20 minutos)
1. [Consigna opción múltiple] (2 puntos)
2. [Consigna V/F con justificación] (3 puntos)

**Parte II** (Ejemplo: 35 minutos)
[Imagen histórica: Manifestación obrera en Montevideo, 1911]
3. Observa la imagen y responde... (8 puntos)
4. [Documento fuente: Fragmento del periódico El Día, 1903]
   Analiza el documento... (10 puntos)

**Parte III** (Ejemplo: 35 minutos)
5. Explica las causas de... (12 puntos)
6. Compara los procesos... (8 puntos)

## TABLAS Y CUADROS PARA COMPLETAR
Cuando requieras que el estudiante complete información en formato tabular:

- SIEMPRE usar <table> HTML con bordes visibles y encabezados ESPECÍFICOS al contenido
- NUNCA usar múltiples <br> consecutivos como espaciado (máximo 1 <br> por vez)
- Celdas vacías con altura mínima para escritura a mano
- Los encabezados deben ser RELEVANTES al tema de la evaluación, NO usar ejemplos fijos
- Ejemplos de tablas contextuales:

Para causas históricas:
<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
  <tr style="background-color: #f5f5f5;">
    <th style="padding: 8px; border: 1px solid #333;">Tipo de causa</th>
    <th style="padding: 8px; border: 1px solid #333;">Descripción específica</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #333;">Económica</td>
    <td style="padding: 8px; height: 50px; border: 1px solid #333;"></td>
  </tr>
</table>

Para conceptos:
<table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
  <tr style="background-color: #f5f5f5;">
    <th style="padding: 8px; border: 1px solid #333;">Concepto clave</th>
    <th style="padding: 8px; border: 1px solid #333;">Su significado en el contexto</th>
  </tr>
</table>

## MANEJO DE IMÁGENES Y RECURSOS VISUALES
CRÍTICO: NO USAR ETIQUETAS <img> EN LAS EVALUACIONES. Solo incluir URLs como texto simple.

1. **Para referencias visuales:** 
- NO incrustar imágenes con <img> tags
- Incluir solo URLs verificables como texto plano
- Formato: "Imagen histórica: [URL] - [Descripción]"

2. **Para recursos complementarios:**
- Mencionar solo la descripción del recurso visual necesario
- NO generar placeholders con <img>
- Ejemplo: "Observa la manifestación obrera de 1911 (buscar en archivos históricos)"

3. **Formato correcto para recursos:**
**Imagen histórica:** https://ejemplo.com/imagen.jpg - Manifestación obrera en Montevideo, 1911

4. **Evitar completamente:**
- Etiquetas <img src="...">
- Divs con estilos de imagen
- Placeholders visuales complejos

## CONTROL DE TIEMPO AUTOMÁTICO

**Heurística obligatoria:**
- Opción múltiple: 1.5-2 min por ítem
- V/F + justificación: 3-4 min por ítem  
- Respuesta corta (2-4 líneas): 5-7 min
- Desarrollo breve (8-12 líneas): 10-12 min
- Análisis de fuente/imagen: 8-10 min por ítem
- Ensayo/producción: 12-15 min
- Overhead (instrucciones, transición): +5% del total

**Ajuste automático hasta calzar exacto:**
- Si excede tiempo: reducir ítems redundantes, acortar extensión, sustituir desarrollo por múltiple opción
- Si queda corto: añadir 1-2 ítems cortos o ampliar consigna
- Resultado final: EXACTAMENTE el tiempo configurado (ej: 90 min)

## ADAPTACIÓN POR VERSIÓN

**Versión 1 (Estándar):** Evaluación completa, balance de ítems, vocabulario académico apropiado.

**Versión 2 (Apoyo Moderado):** Mismos contenidos, consignas más estructuradas, apoyo visual adicional.

**Versión 3 (Adaptación Alta):** Contenidos priorizados, consignas simplificadas, menor cantidad pero más profundas.

## FORMATO TÉCNICO
- HTML con negritas reales (<strong>, <b>) para títulos
- NO usar bloques de código con backticks
- NO usar asteriscos para formato
- Fuentes con placeholders: [Imagen histórica: ...] [Documento fuente: ...]
- Sin mini-rúbricas en el cuerpo
- Márgenes apropiados para impresión

## PROHIBIDO INCLUIR:
- Listados de "ítems incluidos"
- "Expectativas de respuesta"  
- Razonamientos internos de IA
- Explicaciones pedagógicas
- Comentarios sobre diseño
- Bloques meta-informativos

## RESULTADO ESPERADO:
ÚNICAMENTE el documento de evaluación listo para fotocopiar y entregar a estudiantes. Nada más.

CONTEXTO: ${groupContext?.subject || 'Historia'} - ${groupContext?.content?.join(', ') || 'Contenidos no especificados'}`;

      if (originalEvaluation) {
        userPrompt = `EVALUACIÓN ORIGINAL:
${originalEvaluation}

INSTRUCCIÓN DEL DOCENTE:
"${modification}"

TAREA: Modifica la evaluación aplicando exactamente lo que solicita el docente, manteniendo la estructura pedagógica obligatoria y el formato HTML correcto.`;
      } else {
        userPrompt = `GENERAR EVALUACIONES COMPLETAS:

INSTRUCCIONES ESPECÍFICAS:
${modification || 'Generar 3 versiones de evaluación siguiendo la estructura pedagógica obligatoria'}

TAREA: Genera 3 versiones completas de evaluación (Versión 1, 2 y 3) siguiendo EXACTAMENTE:
- Los 5 componentes pedagógicos obligatorios
- Variedad de ítems con puntajes y mini-rúbricas
- Formato HTML correcto (<strong> para negritas)
- Placeholders para recursos visuales
- Alineación con contenidos y competencias seleccionadas
- Transferencia específica al contexto uruguayo`;
      }
    }

    // Use more reliable model for evaluation modifications
    const model = type === 'chat' ? 'gpt-5-mini-2025-08-07' : 'gpt-4.1-2025-04-14';

    // ======================= OPENAI PROMPT LOGGING (LEGACY PATH) =======================
    // Structured logging for prompt observability in Supabase Edge Function logs
    console.log('[OPENAI_PROMPT] ========== REQUEST METADATA ==========');
    console.log('[OPENAI_PROMPT] path: legacy');
    console.log('[OPENAI_PROMPT] type:', type);
    console.log('[OPENAI_PROMPT] model:', model);
    console.log('[OPENAI_PROMPT] max_completion_tokens: 4000');
    console.log('[OPENAI_PROMPT] hasOriginalEvaluation:', !!originalEvaluation);
    console.log('[OPENAI_PROMPT] hasCustomPrompt:', !!customPrompt);
    console.log('[OPENAI_PROMPT] ========== SYSTEM PROMPT START ==========');
    console.log(systemPrompt);
    console.log('[OPENAI_PROMPT] ========== SYSTEM PROMPT END ==========');
    console.log('[OPENAI_PROMPT] systemPromptLength:', systemPrompt.length);
    console.log('[OPENAI_PROMPT] ========== USER PROMPT START ==========');
    console.log(userPrompt);
    console.log('[OPENAI_PROMPT] ========== USER PROMPT END ==========');
    console.log('[OPENAI_PROMPT] userPromptLength:', userPrompt.length);
    console.log('[OPENAI_PROMPT] totalPromptLength:', systemPrompt.length + userPrompt.length);
    // ======================= END OPENAI PROMPT LOGGING =======================

    const result = await retryWithBackoff(async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error ${response.status}:`, errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      return await response.json();
    });

    console.log('OpenAI Full Response:', JSON.stringify(result, null, 2));
    
    let generatedContent = result.choices[0]?.message?.content;
    const finishReason = result.choices[0]?.finish_reason;
    
    console.log('Generated Content Length:', generatedContent?.length || 0);
    console.log('Generated Content Preview:', generatedContent?.substring(0, 200));
    console.log('Finish Reason:', finishReason);

    // LIMPIEZA SERVER-SIDE: quitar code fences si están presentes
    if (generatedContent && type === 'html_plan') {
      const codeBlockPattern = /```(?:html)?\s*([\s\S]*?)\s*```/g;
      const match = codeBlockPattern.exec(generatedContent);
      
      if (match && match[1]) {
        const cleanedContent = match[1].trim();
        console.log('Server-side: Unwrapped HTML from code fence');
        console.log('Original length:', generatedContent.length);
        console.log('Cleaned length:', cleanedContent.length);
        generatedContent = cleanedContent;
      }

      // Remover marcadores Markdown residuales (#, ---) si llegan por error
      generatedContent = generatedContent.replace(/#{1,6}\s*/g, '');
      generatedContent = generatedContent.replace(/-{3,}\s*/g, '');
    }

    // Check if the model hit token limit
    if (finishReason === 'length') {
      console.warn('OpenAI hit token limit, content may be incomplete');
      
      // If we have some content but hit the limit, try to use what we have
      if (generatedContent && generatedContent.trim().length > 100) {
        console.log('Using partial content from token-limited response');
        // R1: Convert legacy return to universal format
        const truncatedHtml = cleanupContent(generatedContent);
        const truncationWarnings = ['La respuesta fue truncada por límite de tokens. El contenido puede estar incompleto.'];
        const truncationAiReport = {
          versions: { generated: ['A'], reason: 'Solo se generó la versión base (respuesta truncada por límite de tokens).' },
          contemplaciones: { instrument_design: [], admin_reminders: [], correction_reminders: [] },
          response_options: { included: false, optionCount: 2, rationale: 'No se pudieron incluir opciones equivalentes (respuesta truncada).' },
          vark: { summary: 'Distribución VARK no disponible (respuesta truncada).' },
          assignments: { rationale: 'Asignaciones no disponibles (respuesta truncada).' },
          warnings: truncationWarnings
        };
        return new Response(JSON.stringify({ 
          success: true,
          content: truncatedHtml,
          type: type,
          evaluationBundle: {
            baseHtml: truncatedHtml,
            versionBHtml: null,
            versionCHtml: null,
            versions: { A: truncatedHtml, B: null, C: null },
            responseOptionsIncluded: false,
            responseOptionCount: 2
          },
          studentAssignments: {},
          teacherRemindersByStudent: [],
          aiReport: truncationAiReport,
          warnings: truncationWarnings,
          metadata: {
            tokensUsed: result.usage?.total_tokens || 0,
            model: result.model || model,
            finishReason: finishReason
          },
          _debug: {
            generationPath: 'legacy_return',
            hasEvaluationBundle: true,
            hasAiReport: true,
            versionsLengths: { A: truncatedHtml.length, B: 0, C: 0 },
            triggers: { versionB: false, versionC: false },
            responseOptions: { include: false, optionCount: 2 }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate content is not empty or only whitespace
    if (!generatedContent || generatedContent.trim().length === 0) {
      console.error('OpenAI returned empty content');
      console.error('Full API Response:', JSON.stringify(result, null, 2));
      
      // Return a meaningful response instead of throwing an error
      const fallbackMessage = type === 'chat' 
        ? 'No pude procesar tu solicitud. ¿Podrías reformularla de manera más específica?'
        : originalEvaluation 
          ? `${originalEvaluation}\n\n**Nota:** No se pudo aplicar la modificación solicitada: "${modification}". El contenido original se mantiene sin cambios.`
          : 'No se pudo generar el contenido solicitado. Por favor, intenta con una solicitud más específica.';
      
      // R1: Convert legacy return to universal format
      const fallbackHtml = cleanupContent(fallbackMessage);
      const fallbackWarnings = [`La IA no generó contenido nuevo. Razón: ${finishReason || 'unknown'}. Se proporciona contenido alternativo.`];
      const fallbackAiReport = {
        versions: { generated: ['A'], reason: 'Solo se generó la versión base (contenido alternativo por falta de respuesta de IA).' },
        contemplaciones: { instrument_design: [], admin_reminders: [], correction_reminders: [] },
        response_options: { included: false, optionCount: 2, rationale: 'No se pudieron incluir opciones equivalentes (contenido alternativo).' },
        vark: { summary: 'Distribución VARK no disponible (contenido alternativo).' },
        assignments: { rationale: 'Asignaciones no disponibles (contenido alternativo).' },
        warnings: fallbackWarnings
      };
      return new Response(JSON.stringify({ 
        success: true,
        content: fallbackHtml,
        type: type,
        evaluationBundle: {
          baseHtml: fallbackHtml,
          versionBHtml: null,
          versionCHtml: null,
          versions: { A: fallbackHtml, B: null, C: null },
          responseOptionsIncluded: false,
          responseOptionCount: 2
        },
        studentAssignments: {},
        teacherRemindersByStudent: [],
        aiReport: fallbackAiReport,
        warnings: fallbackWarnings,
        metadata: {
          tokensUsed: result.usage?.total_tokens || 0,
          model: result.model || model
        },
        _debug: {
          generationPath: 'catch_fallback',
          hasEvaluationBundle: true,
          hasAiReport: true,
          versionsLengths: { A: fallbackHtml.length, B: 0, C: 0 },
          triggers: { versionB: false, versionC: false },
          responseOptions: { include: false, optionCount: 2 }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST-PROCESSING: Limpiar contenido antes de enviarlo
    generatedContent = cleanupContent(generatedContent);
    
    // Post-process to remove any <img> tags that might have been generated
    generatedContent = generatedContent.replace(/<img[^>]*>/g, '');
    
    // Collapse multiple consecutive <br> tags
    generatedContent = generatedContent.replace(/(<br\s*\/?>){3,}/g, '<br/><br/>');

    console.log('OpenAI response generated successfully');
    console.log('Final content length:', generatedContent.length);
    console.log('Content preview:', generatedContent.substring(0, 100) + '...');

    // R1: Convert legacy return to universal format (legacy path for non-modification types)
    const legacyHtml = cleanupContent(generatedContent);
    const legacyWarnings: string[] = [];
    const legacyAiReport = {
      versions: { generated: ['A'], reason: 'Generada desde path legacy (no modification type).' },
      contemplaciones: { instrument_design: [], admin_reminders: [], correction_reminders: [] },
      response_options: { included: false, optionCount: 2, rationale: 'No se incluyeron opciones equivalentes (path legacy).' },
      vark: { summary: 'Distribución VARK no disponible (path legacy).' },
      assignments: { rationale: 'Asignaciones no disponibles (path legacy).' },
      warnings: legacyWarnings
    };
    return new Response(JSON.stringify({ 
      success: true,
      content: legacyHtml,
      type: type,
      evaluationBundle: {
        baseHtml: legacyHtml,
        versionBHtml: null,
        versionCHtml: null,
        versions: { A: legacyHtml, B: null, C: null },
        responseOptionsIncluded: false,
        responseOptionCount: 2
      },
      studentAssignments: {},
      teacherRemindersByStudent: [],
      aiReport: legacyAiReport,
      warnings: legacyWarnings,
      metadata: {
        tokensUsed: result.usage?.total_tokens || 0,
        model: result.model || model
      },
      _debug: {
        generationPath: 'legacy_return',
        hasEvaluationBundle: true,
        hasAiReport: true,
        versionsLengths: { A: legacyHtml.length, B: 0, C: 0 },
        triggers: { versionB: false, versionC: false },
        responseOptions: { include: false, optionCount: 2 }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in modify-evaluation function:', error);
    
    const isRateLimit = error.message?.includes('429') || error.status === 429;
    const errorMessage = isRateLimit 
      ? 'Rate limit exceeded. Please wait a moment and try again.'
      : error.message || 'Unknown error occurred';

    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      isRateLimit: isRateLimit
    }), {
      status: isRateLimit ? 429 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});