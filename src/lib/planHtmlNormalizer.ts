/**
 * HTML normalization utilities for plan_desarrollo rendering
 * Ensures consistent structure for proper styling
 */

/**
 * Ensures each <h2> heading has a <strong> wrapper for bold styling.
 * This function is idempotent: if <strong> is already present, it remains unchanged.
 * 
 * Pattern matched: <h2>text without strong</h2>
 * Pattern ignored: <h2><strong>text</strong></h2> (already correct)
 * 
 * @param html - Raw HTML content from plan_desarrollo.html_completo
 * @returns Normalized HTML with <strong> wrapper inside all <h2> tags
 * 
 * @example
 * // Input:  '<h2>Inicio (15 min)</h2>'
 * // Output: '<h2><strong>Inicio (15 min)</strong></h2>'
 * 
 * @example
 * // Input:  '<h2><strong>Desarrollo</strong></h2>'
 * // Output: '<h2><strong>Desarrollo</strong></h2>' (unchanged)
 */
export function normalizePlanHeadings(html: string): string {
  if (!html) return '';
  
  // Match <h2> tags that don't already contain <strong>
  // Negative lookahead (?!<strong>) ensures we skip h2 tags that already have strong
  const h2WithoutStrong = /<h2>((?!<strong>).+?)<\/h2>/gis;
  
  // Wrap inner content with <strong>
  const normalized = html.replace(
    h2WithoutStrong, 
    '<h2><strong>$1</strong></h2>'
  );
  
  return normalized;
}

