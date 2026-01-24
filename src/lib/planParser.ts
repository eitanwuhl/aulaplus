/**
 * Parser for lesson plans that separates class sections (Start/Development/Closure)
 * from resources, normalizes and de-duplicates resources.
 * 
 * @module planParser
 */

import { enforceForLessonPlan, type Student } from './contemplaciones/enforcement';

export interface ParsedPlan {
  inicio: string;       // Clean HTML/markdown for Start section (no resources)
  desarrollo: string;   // Clean HTML/markdown for Development section (no resources)
  cierre: string;       // Clean HTML/markdown for Closure section (no resources)
  recursos: string[];   // Normalized, de-duplicated resources
  diferenciacion?: string;   // Differentiation/Adaptations section (optional, extracted separately)
  durations?: {         // Extracted duration labels for each section (e.g., "(15 min)")
    inicio?: string;
    desarrollo?: string;
    cierre?: string;
  };
}

/**
 * Hoists inline Diferenciaci├│n/Adaptaciones blocks from section content
 * Detects <p><strong>Diferenciaci├│n/Adaptaciones:</strong></p> and extracts it
 * 
 * @param html - Section HTML content
 * @returns Object with cleaned HTML and extracted diferenciacion block
 */
function hoistInlineDiferenciacion(
  html: string
): { cleanedHtml: string; extracted: string } {
  if (!html) return { cleanedHtml: '', extracted: '' };

  const headerRe =
    /<p[^>]*>\s*<strong>\s*(?:diferenciaci[o├│]n(?:es)?(?:\s*(?:\/| y )\s*adaptaciones?)?|adaptaciones?)\s*:?\s*<\/strong>\s*<\/p>/i;

  const headerMatch = html.match(headerRe);
  if (!headerMatch) return { cleanedHtml: html, extracted: '' };

  const start = headerMatch.index ?? -1;
  if (start < 0) return { cleanedHtml: html, extracted: '' };

  const rest = html.slice(start + headerMatch[0].length);

  const cutRegex = new RegExp(
    [
      '<h2[^>]*>',                 // siguiente secci├│n principal
      '<h[3-6][^>]*>',             // cualquier subt├¡tulo html
      '<p[^>]*>\\s*<strong>\\s*(?!diferenciaci[o├│]n|adaptaciones)[^<]*<\\/strong>\\s*<\\/p>', // otro subheader
      '<p[^>]*>\\s*(?:recursos?|material(?:es)?)\\s*:\\s*' // recursos/materiales
    ].join('|'),
    'i'
  );

  const nextCut = rest.search(cutRegex);
  const extractedBody = nextCut >= 0 ? rest.slice(0, nextCut) : rest;

  const endIndex = start + headerMatch[0].length + extractedBody.length;
  let cleanedHtml = html.slice(0, start) + html.slice(endIndex);
  
  // Goal 1: Do NOT include the header in the extracted block
  let block = extractedBody.trim();

  cleanedHtml = cleanedHtml
    .replace(/(\s*<br\s*\/?>\s*){2,}/gi, '<br />')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanedHtml, extracted: block };
}

/**
 * Parses raw lesson plan content and extracts structured sections and resources
 * 
 * @param input - Raw HTML/text content from generation flow
 * @param fallbackResources - Optional array of resources from API response
 * @returns Parsed plan with separated sections and normalized resources
 */
export function parsePlan(input: string, fallbackResources?: string[]): ParsedPlan {
  // Initialize parsed sections
  let inicio = '';
  let desarrollo = '';
  let cierre = '';
  let diferenciacion = '';
  const extractedRecursos: string[] = [];
  const durations: { inicio?: string; desarrollo?: string; cierre?: string } = {};

  // Tokenize input by headings
  const tokens = tokenizeByHeadings(input);
  
  // Collect main section titles to exclude from demotion
  const mainSectionTitles = tokens.map(t => t.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  
  // Process each token
  tokens.forEach(token => {
    const sectionType = detectSectionType(token.title);
    const cleanedContent = extractAndCleanResources(token.content, extractedRecursos);
    // Demote internal headings (but not the main section headings)
    const demotedContent = demoteInternalHeadings(cleanedContent, mainSectionTitles);
    
    switch (sectionType) {
      case 'inicio':
        // Accumulate content if duplicate heading
        inicio += (inicio ? '\n\n' : '') + demotedContent;
        if (!durations.inicio) durations.inicio = extractDuration(token.title);
        break;
      case 'desarrollo':
        // Accumulate content if duplicate heading
        desarrollo += (desarrollo ? '\n\n' : '') + demotedContent;
        if (!durations.desarrollo) durations.desarrollo = extractDuration(token.title);
        break;
      case 'cierre':
        // Accumulate content if duplicate heading
        cierre += (cierre ? '\n\n' : '') + demotedContent;
        if (!durations.cierre) durations.cierre = extractDuration(token.title);
        break;
      case 'diferenciacion':
        // Accumulate content if duplicate heading
        diferenciacion += (diferenciacion ? '\n\n' : '') + demotedContent;
        break;
      default:
        // If no specific section detected, try to append to desarrollo
        if (demotedContent.trim()) {
          desarrollo += (desarrollo ? '\n\n' : '') + demotedContent;
        }
    }
  });

  // If no sections were detected, treat entire input as desarrollo
  if (!inicio && !desarrollo && !cierre) {
    desarrollo = extractAndCleanResources(input, extractedRecursos);
  }

  // Post-process each section to hoist inline diferenciacion blocks
  const diffs: string[] = [];

  const r1 = hoistInlineDiferenciacion(inicio);
  inicio = r1.cleanedHtml;
  if (r1.extracted) diffs.push(r1.extracted);

  const r2 = hoistInlineDiferenciacion(desarrollo);
  desarrollo = r2.cleanedHtml;
  if (r2.extracted) diffs.push(r2.extracted);

  const r3 = hoistInlineDiferenciacion(cierre);
  cierre = r3.cleanedHtml;
  if (r3.extracted) diffs.push(r3.extracted);

  // Merge hoisted diferenciacion with any existing diferenciacion section
  let diferenciacionHtml = diffs.join('\n');
  
  // Goal 2: Defensive cleanup - strip any leading inline header fragments
  if (diferenciacionHtml) {
    diferenciacionHtml = diferenciacionHtml.replace(
      /^\s*<p[^>]*>\s*<strong>\s*(?:diferenciaci[o├│]n(?:es)?(?:(?:\/| y )?adaptaciones?)?|adaptaciones?)\s*:?\s*<\/strong>\s*<\/p>/i,
      ''
    ).trim();
  }
  
  if (diferenciacionHtml) {
    diferenciacion = diferenciacion 
      ? `${diferenciacion}\n${diferenciacionHtml}` 
      : diferenciacionHtml;
  }

  // Merge and normalize resources
  const allRecursos = mergeResources(extractedRecursos, fallbackResources);
  
  return {
    inicio: cleanHtml(inicio),
    desarrollo: cleanHtml(desarrollo),
    cierre: cleanHtml(cierre),
    recursos: allRecursos,
    diferenciacion: diferenciacion ? cleanHtml(diferenciacion) : undefined,
    durations: Object.keys(durations).length > 0 ? durations : undefined
  };
}

/**
 * Serializes a parsed plan back into normalized HTML with clean headings.
 * Ensures resources remain separated and only class narrative is present.
 * 
 * @param parsed - Parsed plan with sections
 * @param additionalDiferenciacion - Optional additional diferenciacion content to append (e.g., from contemplaciones)
 */
export function buildPlanHtml(parsed: ParsedPlan, additionalDiferenciacion?: string): string {
  const sections: Array<{ label: string; key: 'inicio' | 'desarrollo' | 'cierre' }> = [
    { label: 'Inicio', key: 'inicio' },
    { label: 'Desarrollo', key: 'desarrollo' },
    { label: 'Cierre', key: 'cierre' }
  ];

  const lines: string[] = [];
  let hasContent = false;

  lines.push('<section id="plan">');

  sections.forEach(({ label, key }) => {
    const content = (parsed[key] || '').trim();
    if (!content) {
      return;
    }
    hasContent = true;
    const duration = parsed.durations?.[key];
    const headingText = duration ? `${label} ${duration}` : label;
    lines.push(`<h2><strong>${headingText}</strong></h2>`);
    lines.push(content);
  });

  // Merge diferenciacion from parser with additional content
  let diferenciacionContent = (parsed.diferenciacion || '').trim();
  const additionalContent = (additionalDiferenciacion || '').trim();
  
  if (diferenciacionContent && additionalContent) {
    // Both exist: append additional with separator
    diferenciacionContent = `${diferenciacionContent}\n\n${additionalContent}`;
  } else if (additionalContent) {
    // Only additional exists
    diferenciacionContent = additionalContent;
  }
  
  if (diferenciacionContent) {
    hasContent = true;
    lines.push('<h2><strong>Diferenciaci├│n/Adaptaciones</strong></h2>');
    lines.push(diferenciacionContent);
  }

  lines.push('</section>');

  if (!hasContent) {
    return '';
  }

  return lines.join('\n');
}

interface Token {
  title: string;    // Original heading text with duration (e.g., "Inicio (15 min)")
  content: string;  // Content from this heading to next heading or EOF
}

/**
 * Tokenizes input by detecting all headings and slicing content between them.
 * This ensures the last section (often Cierre) captures content until EOF.
 * Only detects H2 as section headings; h3-h6 are left in content for demotion.
 */
function tokenizeByHeadings(input: string): Token[] {
  const tokens: Token[] = [];
  
  // Heading patterns (case-insensitive, with accents and optional duration)
  // Pattern 1: Only HTML h2 tags (NOT h3-h6) - these are section headings
  // Allow letters, spaces, slashes, and hyphens in headings
  const htmlHeadingPattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  
  // Pattern 2: Bold or plain title (fallback) - only for main sections
  const plainHeadingPattern = /^\s*(?:\*\*([A-Za-z├ü├ë├ì├ô├Ü├æ├í├®├¡├│├║├▒ ]+?)\*\*|([A-Z├ü├ë├ì├ô├Ü├æ][^\n:]{3,40}))\s*(?:\((\d+\s*min)\))?\s*$/gm;
  
  // Collect all heading matches with their positions
  interface HeadingMatch {
    index: number;
    length: number;
    title: string;
  }
  
  const headings: HeadingMatch[] = [];
  
  // Find HTML headings
  let match;
  while ((match = htmlHeadingPattern.exec(input)) !== null) {
    const innerHtml = match[1];

    // Strip nested tags (e.g., <strong>, <em>) and normalize whitespace
    const textContent = innerHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!textContent) {
      continue;
    }

    const durationMatch = textContent.match(/\((\d+\s*min)\)/i);
    const duration = durationMatch ? ` (${durationMatch[1]})` : '';
    const titleWithoutDuration = textContent.replace(/\s*\((\d+\s*min)\)\s*/i, '').trim();
    const normalizedTitle = titleWithoutDuration || textContent;

    headings.push({
      index: match.index,
      length: match[0].length,
      title: normalizedTitle + duration
    });
  }
  
  // Find plain/bold headings (only if not already found as HTML)
  plainHeadingPattern.lastIndex = 0;
  while ((match = plainHeadingPattern.exec(input)) !== null) {
    // Check if this position is already covered by an HTML heading
    const alreadyCovered = headings.some(h => 
      match.index >= h.index && match.index < h.index + h.length
    );
    
    if (!alreadyCovered) {
      const title = (match[1] || match[2] || '').trim();
      const duration = match[3] ? ` (${match[3]})` : '';
      headings.push({
        index: match.index,
        length: match[0].length,
        title: title + duration
      });
    }
  }
  
  // Sort headings by position
  headings.sort((a, b) => a.index - b.index);
  
  // Extract content between headings
  for (let i = 0; i < headings.length; i++) {
    const currentHeading = headings[i];
    const nextHeading = headings[i + 1];
    
    // Content starts after current heading
    const contentStart = currentHeading.index + currentHeading.length;
    
    // Content ends at next heading or EOF
    const contentEnd = nextHeading ? nextHeading.index : input.length;
    
    const content = input.substring(contentStart, contentEnd);
    
    tokens.push({
      title: currentHeading.title,
      content: content
    });
  }
  
  // If no headings found, treat entire input as one token with empty title
  if (tokens.length === 0) {
    tokens.push({ title: '', content: input });
  }
  
  return tokens;
}

/**
 * Detects the type of section based on header text.
 * Normalizes for case-insensitivity and removes accents before matching.
 */
function detectSectionType(header: string): 'inicio' | 'desarrollo' | 'cierre' | 'diferenciacion' | 'unknown' {
  // Remove duration labels first (e.g., "(15 min)")
  const withoutDuration = header.replace(/\s*\(\d+\s*min\)\s*/gi, '');
  
  // Normalize: lowercase + remove accents
  const normalized = withoutDuration.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Match section keywords
  if (/\b(inicio|apertura)\b/.test(normalized)) {
    return 'inicio';
  }
  if (/\bdesarrollo\b/.test(normalized)) {
    return 'desarrollo';
  }
  if (/\bcierre\b/.test(normalized)) {
    return 'cierre';
  }
  // Check for Diferenciaci├│n/Adaptaciones variants
  // Accept: Diferenciaci├│n, Diferenciaciones, Adaptaci├│n, Adaptaciones, Diferenciaci├│n/Adaptaciones
  if (/(diferenciacion(es)?|adaptacion(es)?)/.test(normalized)) {
    return 'diferenciacion';
  }
  
  return 'unknown';
}

/**
 * Extracts duration label from a heading (e.g., "(15 min)" from "Inicio (15 min)")
 * Returns undefined if no duration is found.
 */
function extractDuration(heading: string): string | undefined {
  const match = heading.match(/\((\d+\s*min)\)/i);
  return match ? `(${match[1]})` : undefined;
}

/**
 * Demotes ALL internal headings (h1-h6) to strong paragraphs to maintain clean hierarchy.
 * After parsing, NO h1-h6 tags should remain in section content.
 * Everything becomes <p><strong>...</strong></p>
 */
function demoteInternalHeadings(content: string, mainSectionTitles: string[]): string {
  if (!content) return '';
  
  let demoted = content;
  
  // Pattern to match any heading tag (h1-h6)
  const headingPattern = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
  
  demoted = demoted.replace(headingPattern, (match, level, innerHtml) => {
    // Extract plain text from innerHtml (remove any nested tags)
    const plainText = innerHtml.replace(/<[^>]+>/g, '').trim();
    
    if (!plainText) {
      return ''; // Empty heading, remove it
    }
    
    // Normalize for comparison
    const normalized = plainText.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*\(\d+\s*min\)\s*/gi, ''); // Remove duration
    
    // Check if this is a duplicate main section heading (should be removed entirely)
    const isMainSection = mainSectionTitles.some(title => {
      const titleNormalized = title.replace(/\s*\(\d+\s*min\)\s*/gi, '');
      return titleNormalized === normalized;
    });
    
    if (isMainSection) {
      // This is a duplicate main heading inside section content - remove it entirely
      return '';
    }
    
    // ALL other headings get demoted (no exceptions)
    // Remove duration from demoted headings
    const textWithoutDuration = plainText.replace(/\s*\(\d+\s*min\)\s*/gi, '');
    
    // Goal 3: Check if this is a "Diferenciaci├│n/Adaptaciones" heading - skip it entirely
    const normalizedWithoutDuration = textWithoutDuration.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    
    const isDiferenciacionHeading = /^(diferenciacion(es)?(\s*(\/|y)\s*adaptacion(es)?)?|adaptacion(es)?)(\s*:)?$/i.test(normalizedWithoutDuration);
    
    if (isDiferenciacionHeading) {
      // This is a diferenciaci├│n/adaptaciones heading inside content - remove it entirely
      return '';
    }
    
    // Convert to strong paragraph
    return `<p><strong>${textWithoutDuration}</strong></p>`;
  });
  
  // Clean up any empty paragraphs created
  demoted = demoted.replace(/<p><strong>\s*<\/strong><\/p>/g, '');
  
  return demoted;
}

/**
 * Extracts resources from content and returns cleaned content without resource blocks
 */
function extractAndCleanResources(content: string, resourcesArray: string[]): string {
  if (!content) return '';
  
  let cleaned = content;
  
  // 1. Handle resource blocks with HTML lists (e.g., <p>Recursos:</p><ul><li>...</li></ul>)
  const resourceListPattern = /<p[^>]*>\s*(?:recursos?|material(?:es)?)\s*(?:necesarios?)?[:\s]*<\/p>\s*<ul[^>]*>(.*?)<\/ul>/gis;
  let match;
  
  while ((match = resourceListPattern.exec(content)) !== null) {
    const listContent = match[1];
    if (listContent) {
      extractResourceItems(listContent, resourcesArray);
    }
    // Remove the entire block (paragraph + list)
    cleaned = cleaned.replace(match[0], '');
  }
  
  // 2. Handle paragraphs that mention resources (including cases with <strong>, <em>, etc.)
  const paragraphPattern = /<p[^>]*>[\s\S]*?<\/p>/gi;
  cleaned = cleaned.replace(paragraphPattern, paragraph => {
    const textContent = paragraph.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^(?:recursos?|material(?:es)?)\s*(?:necesarios?)?[:.\s-]/i.test(textContent)) {
      const afterKeyword = textContent.replace(
        /^(?:recursos?|material(?:es)?)\s*(?:necesarios?)?[:.\s-]+/i,
        ''
      ).trim();
      if (afterKeyword) {
        extractResourceItems(afterKeyword, resourcesArray);
      }
      return '';
    }
    return paragraph;
  });
  
  // 3. Handle plain text resource lines (no HTML or with minimal HTML)
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    
    // Check if line contains resource keyword at the start (ignoring HTML tags)
    const withoutTags = trimmed.replace(/<[^>]+>/g, '');
    
    if (/^(?:recursos?|material(?:es)?)\s*(?:necesarios?)?[:.\s]/i.test(withoutTags)) {
      // Extract the resource if it has content after the keyword
      const afterKeyword = withoutTags.replace(/^(?:recursos?|material(?:es)?)\s*(?:necesarios?)?[:.\s]+/i, '').trim();
      if (afterKeyword) {
        extractResourceItems(afterKeyword, resourcesArray);
      }
      return false; // Remove this line
    }
    
    return true; // Keep this line
  });
  
  cleaned = filteredLines.join('\n');
  
  return cleaned;
}

/**
 * Extracts individual resource items from text
 */
function extractResourceItems(text: string, resourcesArray: string[]): void {
  if (!text) return;
  
  // Clean HTML tags
  let cleaned = text.replace(/<[^>]+>/g, '');
  cleaned = cleaned.replace(/\s+(?:y|e|o)\s+/gi, ', ');
  
  // Split by common separators
  const items = cleaned.split(/[,;]|\n|<br\s*\/?>/i);
  
  items.forEach(item => {
    // Clean item: remove bullets, dashes, extra spaces
    const cleanedItem = item
      .replace(/^[-ÔÇó*]\s*/, '')
      .replace(/^<li>|<\/li>$/gi, '')
      .trim();
    
    if (cleanedItem && cleanedItem.length > 2) {
      resourcesArray.push(cleanedItem);
    }
  });
}

/**
 * Merges and normalizes resources from multiple sources
 */
function mergeResources(extracted: string[], fallback?: string[]): string[] {
  const allResources = [...extracted];
  
  // Add fallback resources if provided
  if (fallback && Array.isArray(fallback)) {
    allResources.push(...fallback);
  }
  
  // Normalize and de-duplicate
  const normalized = allResources
    .map(r => normalizeResource(r))
    .filter(r => r.length > 0);
  
  // De-duplicate case-insensitively
  const uniqueMap = new Map<string, string>();
  normalized.forEach(resource => {
    const key = resource.toLowerCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, resource);
    }
  });
  
  return Array.from(uniqueMap.values()).sort();
}

/**
 * Normalizes a single resource string
 */
function normalizeResource(resource: string): string {
  return resource
    .trim()
    .replace(/^[-ÔÇó*]\s*/, '') // Remove leading bullets
    .replace(/^(\d+[\).])\s*/, '') // Remove leading numbers
    .replace(/[.,;:]+$/g, '') // Remove trailing punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Cleans HTML content, preserving basic formatting
 */
function cleanHtml(html: string): string {
  if (!html) return '';
  
  return html
    .trim()
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .replace(/\s{2,}/g, ' ') // Normalize spaces within lines
    .trim();
}

/**
 * Builds plan HTML with deterministic contemplaciones reminders injected into Diferenciación/Adaptaciones
 * 
 * @param parsed - Parsed plan with sections
 * @param students - List of students with IDs and names (for contemplaciones lookup)
 * @param lessonContent - Optional lesson content for detecting written instructions
 * @returns HTML string with reminders injected
 */
export function buildPlanHtmlWithReminders(
  parsed: ParsedPlan,
  students: Student[],
  lessonContent?: string
): string {
  // Generate deterministic reminders from contemplaciones
  const enforcement = enforceForLessonPlan(students, lessonContent);
  
  // Convert reminder lines to HTML list
  let remindersHtml = '';
  if (enforcement.diferenciacionBlock.length > 0) {
    remindersHtml = '<ul>\n' + 
      enforcement.diferenciacionBlock.map(line => `  <li>${line}</li>`).join('\n') + 
      '\n</ul>';
  }
  
  // Build plan with injected reminders
  return buildPlanHtml(parsed, remindersHtml);
}

