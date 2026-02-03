import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

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
        finalTriggers
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
      }) => {
        return new Response(JSON.stringify({
          success: true,
          content: baseHtml || '',
          type: type,
          evaluationBundle: {
            // TASK 4: Ensure versions.* are clean HTML, legacy fields are for backward compat only
            // When versions exists, baseHtml/versionBHtml/versionCHtml are already extracted (no wrappers)
            baseHtml: baseHtml || '', // Legacy alias for A (backward compat)
            versionBHtml: versionBHtml, // Legacy alias for B (backward compat)
            versionCHtml: versionCHtml, // Legacy alias for C (backward compat)
            versions: {
              A: baseHtml || '', // Clean HTML, never wrapper
              B: versionBHtml, // Clean HTML or null, never wrapper
              C: versionCHtml // Clean HTML or null, never wrapper
            },
            responseOptionsIncluded,
            responseOptionCount
          },
          studentAssignments,
          teacherRemindersByStudent,
          aiReport,
          warnings,
          metadata,
          _debug: {
            generationPath,
            hasEvaluationBundle: true,
            hasAiReport: true,
            versionsLengths: {
              A: baseHtml?.length || 0,
              B: versionBHtml?.length || 0,
              C: versionCHtml?.length || 0
            },
            startsWith: {
              A: baseHtml?.trim().slice(0, 15) || 'null',
              B: versionBHtml?.trim().slice(0, 15) || 'null',
              C: versionCHtml?.trim().slice(0, 15) || 'null'
            },
            isWrapper: {
              A: baseHtml?.trim().startsWith('{') || false,
              B: versionBHtml?.trim().startsWith('{') || false,
              C: versionCHtml?.trim().startsWith('{') || false
            },
            triggers: {
              versionB: generateVersionB,
              versionC: generateVersionC
            },
            finalTriggers: finalTriggers || {
              versionB: false,
              versionC: false
            },
            responseOptions: {
              include: responseOptionsInclude,
              optionCount: responseOptionsInclude ? responseOptionCountFinal : 0
            },
            assignmentCounts: {
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
      const generateVersionB = designPlan.triggers?.versionB === true || assignmentsIncludeB;
      const generateVersionC = designPlan.triggers?.versionC === true || assignmentsIncludeC || hasContentAdaptationStudent;
      
      const systemPrompt = `Eres un especialista en evaluación educativa. Tu tarea es generar una evaluación escrita universal, lista para entregar.

REGLAS CRÍTICAS (NO NEGOCIABLES):
1. Evidencia SIEMPRE escrita. Prohibido generar tareas "solo orales".
2. NO inferir diagnósticos ni necesidades desde narrativas. Usa SOLO datos estructurados.
3. CE/CL son definidos por el docente: NO inventar ni inferir nuevos criterios.
4. No incluir explicaciones meta ni razonamientos de IA.
5. HTML válido, renderizable. NO usar Markdown. NO usar <img>.

FORMATO:
- Usa <strong> para títulos y secciones
- Evita múltiples <br> consecutivos
- Incluye puntajes por ítem cuando aplique

RESPUESTAS CON OPCIONES EQUIVALENTES:
${responseOptionsInclude ? `
- OBLIGATORIO Y CRÍTICO: Cada consigna que requiera respuesta escrita DEBE incluir EXACTAMENTE ${responseOptionCount} opciones equivalentes de formato.
- Formato requerido (copiar exactamente): "Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta."
- Ejemplo de opciones (incluir en cada consigna relevante):
  * Opción 1: Respuesta escrita tradicional (párrafo)
  * Opción 2: Respuesta estructurada (lista con viñetas o tabla)
  ${responseOptionCount === 3 ? '  * Opción 3: Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
- Las opciones DEBEN aparecer INMEDIATAMENTE después de cada consigna relevante, dentro del mismo ítem.
- NO omitir las opciones. Si no las incluyes, la evaluación será incompleta.
` : `
- NO incluir opciones equivalentes de respuesta.
`}

SALIDA OBLIGATORIA (JSON):
{
  "versions": { 
    "A": "<html>...</html>", 
    ${generateVersionB ? '"B": "<html>...</html>",' : '"B": null,'}
    ${generateVersionC ? '"C": "<html>...</html>",' : '"C": null,'}
  },
  "response_options_included": ${responseOptionsInclude},
  "response_option_count": ${responseOptionCount},
  "ai_report": {
    "versions": { "generated": [${generateVersionB && generateVersionC ? '"A","B","C"' : generateVersionB ? '"A","B"' : generateVersionC ? '"A","C"' : '"A"'}], "reason": "..." },
    "contemplaciones": {
      "instrument_design": ["..."],
      "admin_reminders": ["..."],
      "correction_reminders": ["..."]
    },
    "response_options": { "included": ${responseOptionsInclude}, "optionCount": ${responseOptionCount}, "rationale": "..." },
    "vark": { "summary": "..." },
    "assignments": { "rationale": "..." },
    "warnings": ["..."]
  }
}

REGLAS CRÍTICAS PARA VERSIONES:
${generateVersionB ? '- La versión B DEBE estar presente en "versions.B" (no null). Si no la generas, la respuesta será inválida.' : ''}
${generateVersionC ? '- La versión C DEBE estar presente en "versions.C" (no null). Si no la generas, la respuesta será inválida.' : ''}
${!generateVersionB && !generateVersionC ? '- Solo generar versión A. No incluir B ni C.' : ''}`;

      const userPrompt = `CONTEXTO DEL GRUPO:
Materia: ${groupContext?.subject || 'No especificada'}
Contenidos: ${groupContext?.content?.join(', ') || 'No especificados'}
Competencias (si provistas por docente): ${groupContext?.competencies?.join(', ') || 'No provistas'}
Criterios de logro (si provistos por docente): ${groupContext?.criteriosLogro?.join(', ') || 'No provistos'}

REQUERIMIENTOS DOCENTE:
${modification || 'No hay requerimientos adicionales'}

REGLAS DE DISEÑO DEL INSTRUMENTO (determinísticas, no omitir):
${instrumentDesignRules.length ? instrumentDesignRules.map((rule: string) => `- ${rule}`).join('\n') : '- (Sin reglas adicionales)'}

DETALLE DEL PLAN (NO INVENTAR DATOS):
- Complejidad de diseño: ${designComplexityCount}
- Necesidad de estructura (resumen): ${highStructureNeed.percent ?? 0}% del grupo
- VARK distribución: ${JSON.stringify(varkDistribution)}
- Contemplaciones por bucket: ${JSON.stringify(bucketedContemplacionIds)}

OPCIONES DE RESPUESTA:
- Incluir opciones equivalentes: ${responseOptionsInclude ? 'Sí' : 'No'}
- Cantidad de opciones por consigna (si aplica): ${responseOptionCount}

VERSIONES:
${generateVersionB ? `
- OBLIGATORIO: Generar versión B equivalente (solo cambia formato, misma evidencia).
- La versión B debe ser funcionalmente equivalente a la A pero con formato diferente.
- Si no generas versión B, la evaluación será incompleta.
` : `
- NO generar versión B.
`}
${generateVersionC ? `
- OBLIGATORIO: Generar versión C con adecuación de contenido (solo para estudiantes explícitos).
- La versión C debe adaptar el contenido manteniendo los objetivos de aprendizaje.
- Si no generas versión C, la evaluación será incompleta.
` : `
- NO generar versión C.
`}

TAREA:
1. Genera la versión base (A) universal. ${generateVersionB ? 'OBLIGATORIO: También genera versión B.' : ''} ${generateVersionC ? 'OBLIGATORIO: También genera versión C.' : ''}
2. ${generateVersionB ? 'Versión B: equivalente en formato, misma evidencia.' : 'No generar versión B.'}
3. ${generateVersionC ? 'Versión C: adecuación de contenido para estudiantes específicos.' : 'No generar versión C.'}
4. Devuelve únicamente el JSON solicitado con TODAS las versiones requeridas.
5. En ai_report usa lenguaje docente simple (sin jerga técnica) y NO incluyas nombres de estudiantes.`;

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
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            max_completion_tokens: 4000
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
      let parseFailed = false;

      const parseMaybeJsonString = (value: any): any | null => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed.startsWith('{')) return null;
        try {
          return JSON.parse(trimmed);
        } catch {
          return null;
        }
      };

      const extractVersions = (payload: any): { A: any; B: any; C: any } => {
        if (!payload || typeof payload !== 'object') return { A: null, B: null, C: null };
        if (payload.versions && typeof payload.versions === 'object') return payload.versions;
        if (payload.A || payload.B || payload.C) return { A: payload.A, B: payload.B, C: payload.C };
        if (payload.evaluationBundle?.versions) return payload.evaluationBundle.versions;
        return { A: null, B: null, C: null };
      };

      /**
       * Robust HTML extractor that guarantees pure HTML strings, never JSON wrappers.
       * Handles nested JSON strings, multiple shapes, and ensures output starts with '<'.
       */
      const extractVersionsFromModelOutput = (input: any): { A: string | null; B: string | null; C: null } => {
        const result: { A: string | null; B: string | null; C: string | null } = { A: null, B: null, C: null };
        
        if (!input) return result;
        
        // Strategy 1: If input is a string, try to parse it as JSON
        let parsed: any = null;
        if (typeof input === 'string') {
          const trimmed = input.trim();
          if (trimmed.startsWith('{')) {
            try {
              parsed = JSON.parse(trimmed);
            } catch {
              // Not valid JSON, treat as HTML if it starts with '<'
              if (trimmed.startsWith('<')) {
                result.A = trimmed;
                return result;
              }
              return result;
            }
          } else if (trimmed.startsWith('<')) {
            // Already HTML
            result.A = trimmed;
            return result;
          } else {
            return result;
          }
        } else if (typeof input === 'object') {
          parsed = input;
        } else {
          return result;
        }
        
        // Strategy 2: Extract versions from parsed object
        const extractFromObject = (obj: any): { A: string | null; B: string | null; C: string | null } => {
          const extracted: { A: string | null; B: string | null; C: string | null } = { A: null, B: null, C: null };
          
          // Try multiple shapes
          if (obj.versions && typeof obj.versions === 'object') {
            extracted.A = obj.versions.A || null;
            extracted.B = obj.versions.B || null;
            extracted.C = obj.versions.C || null;
          } else if (obj.A || obj.B || obj.C) {
            extracted.A = obj.A || null;
            extracted.B = obj.B || null;
            extracted.C = obj.C || null;
          } else if (obj.evaluationBundle?.versions) {
            extracted.A = obj.evaluationBundle.versions.A || null;
            extracted.B = obj.evaluationBundle.versions.B || null;
            extracted.C = obj.evaluationBundle.versions.C || null;
          } else if (obj.base_html || obj.baseHtml) {
            extracted.A = obj.base_html || obj.baseHtml || null;
            extracted.B = obj.version_b_html || obj.versionBHtml || null;
            extracted.C = obj.version_c_html || obj.versionCHtml || null;
          }
          
          return extracted;
        };
        
        const extracted = extractFromObject(parsed);
        
        // Strategy 3: Recursively extract if any value is itself a JSON string
        const normalizeHtml = (value: any): string | null => {
          if (!value) return null;
          if (typeof value === 'string') {
            const trimmed = value.trim();
            // If it's a JSON string, parse and extract again
            if (trimmed.startsWith('{') && (trimmed.includes('"versions"') || trimmed.includes('"A"') || trimmed.includes('"B"') || trimmed.includes('"C"'))) {
              try {
                const nested = JSON.parse(trimmed);
                const nestedExtracted = extractFromObject(nested);
                // Prefer A from nested, fallback to nested root
                return nestedExtracted.A || nested.A || nested.html || nested.content || null;
              } catch {
                // Not valid JSON, return as-is if it looks like HTML
                return trimmed.startsWith('<') ? trimmed : null;
              }
            }
            // If it's already HTML, return it
            return trimmed.startsWith('<') ? trimmed : null;
          }
          if (typeof value === 'object') {
            const objExtracted = extractFromObject(value);
            return objExtracted.A || value.html || value.content || null;
          }
          return null;
        };
        
        result.A = normalizeHtml(extracted.A);
        result.B = normalizeHtml(extracted.B);
        result.C = normalizeHtml(extracted.C);
        
        // Final validation: ensure A/B/C are HTML strings (start with '<') or null
        const validateHtml = (html: string | null): string | null => {
          if (!html) return null;
          const trimmed = html.trim();
          if (trimmed.startsWith('<')) return trimmed;
          // If it doesn't start with '<', it's not valid HTML - return null
          return null;
        };
        
        result.A = validateHtml(result.A);
        result.B = validateHtml(result.B);
        result.C = validateHtml(result.C);
        
        return result;
      };
      
      const extractHtml = (value: any, key: 'A' | 'B' | 'C'): string | null => {
        const extracted = extractVersionsFromModelOutput(value);
        return extracted[key];
      };

      let parsed: any = null;
      if (generatedContent) {
        parsed = parseMaybeJsonString(generatedContent);
        if (!parsed) {
          const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = parseMaybeJsonString(jsonMatch[0]);
          }
        }
      }
      if (!parsed) {
        parseFailed = true;
      }

      const versions = extractVersions(parsed || {});
      let baseHtml = extractHtml(versions.A || parsed?.base_html || parsed?.baseHtml || parsed?.A || '', 'A') || '';
      let versionBHtml = extractHtml(versions.B || parsed?.version_b_html || parsed?.versionBHtml || parsed?.B, 'B');
      let versionCHtml = extractHtml(versions.C || parsed?.version_c_html || parsed?.versionCHtml || parsed?.C, 'C');

      if (baseHtml.trim().startsWith('{')) {
        const parsedBase = parseMaybeJsonString(baseHtml);
        if (parsedBase) {
          const nestedVersions = extractVersions(parsedBase);
          baseHtml = extractHtml(nestedVersions.A || parsedBase.A || baseHtml, 'A') || baseHtml;
          versionBHtml = versionBHtml || extractHtml(nestedVersions.B || parsedBase.B, 'B');
          versionCHtml = versionCHtml || extractHtml(nestedVersions.C || parsedBase.C, 'C');
        }
      }

      /**
       * STRICT extractor that returns ONLY the target version.
       * NEVER returns JSON wrappers, NEVER fallbacks to A when key is B or C.
       */
      const extractVersionStrict = (input: unknown, key: 'A' | 'B' | 'C'): string | null => {
        if (!input) return null;
        
        // Helper to escape and convert newlines to <br/>
        const escapeAndBr = (text: string): string => {
          return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\n/g, '<br/>');
        };
        
        // Helper to extract specific key from object
        const extractKeyFromObject = (obj: any, k: 'A' | 'B' | 'C'): string | null => {
          if (!obj || typeof obj !== 'object') return null;
          if (obj.versions?.[k]) return obj.versions[k];
          if (obj[k]) return obj[k];
          if (obj.evaluationBundle?.versions?.[k]) return obj.evaluationBundle.versions[k];
          // Legacy fallbacks ONLY for A
          if (k === 'A') {
            if (obj.base_html || obj.baseHtml) return obj.base_html || obj.baseHtml;
            if (obj.html) return obj.html;
            if (obj.content) return obj.content;
          }
          return null;
        };
        
        if (typeof input === 'string') {
          const trimmed = input.trim();
          
          // If already HTML, return cleaned
          if (trimmed.startsWith('<')) {
            return cleanupContent(trimmed);
          }
          
          // If JSON wrapper, parse and extract EXACT key
          if (trimmed.startsWith('{') || trimmed.includes('"versions"')) {
            try {
              const parsed = JSON.parse(trimmed);
              const extracted = extractKeyFromObject(parsed, key);
              if (extracted) {
                // Recurse on extracted value (might be nested JSON or HTML)
                return extractVersionStrict(extracted, key);
              }
              // Key not found, return null (NEVER fallback to A)
              return null;
      } catch (e) {
              // Not valid JSON, treat as plain text
              if (trimmed.length > 0) {
                return `<div>${escapeAndBr(trimmed)}</div>`;
              }
              return null;
            }
          }
          
          // Plain text: wrap safely
          if (trimmed.length > 0) {
            return `<div>${escapeAndBr(trimmed)}</div>`;
          }
          
          return null;
        }
        
        if (typeof input === 'object') {
          const extracted = extractKeyFromObject(input, key);
          if (extracted) {
            return extractVersionStrict(extracted, key);
          }
          return null;
        }
        
        return null;
      };
      
      // A3: STRICT extraction before building response
      // Force strict extraction to prevent JSON wrappers from leaking
      let finalA = extractVersionStrict(baseHtml || generatedContent || '', 'A');
      let finalB = versionBHtml ? extractVersionStrict(versionBHtml, 'B') : null;
      let finalC = versionCHtml ? extractVersionStrict(versionCHtml, 'C') : null;
      
      // Fallback for A if extraction failed
      if (!finalA || !finalA.trim().startsWith('<')) {
        parseFailed = true;
        finalA = '<div>Contenido no disponible.</div>';
        warnings.push('La versión A no pudo ser extraída correctamente; se aplicó fallback seguro.');
      }
      
      // A4: If C is required but missing, create deterministic fallback
      const finalAssignmentCounts = {
        A: Object.values(adjustedAssignments).filter(v => v === 'A').length,
        B: Object.values(adjustedAssignments).filter(v => v === 'B').length,
        C: Object.values(adjustedAssignments).filter(v => v === 'C').length
      };
      
      if (finalAssignmentCounts.C > 0 && (!finalC || !finalC.trim().startsWith('<'))) {
        console.warn('[UNIVERSAL] Version C required but missing, generating deterministic fallback');
        // Create deterministic fallback C from A
        let fallbackC = finalA;
        
        // Prepend adaptation note
        const adaptationNote = '<p><em>Nota: Esta versión ha sido adaptada para facilitar la comprensión, manteniendo los mismos objetivos de aprendizaje.</em></p>';
        fallbackC = adaptationNote + fallbackC;
        
        // Simplify language minimally
        fallbackC = fallbackC.replace(/\b(analizar|examinar|investigar|evaluar)\b/gi, 'explicar');
        fallbackC = fallbackC.replace(/\b(complejo|compleja|complejos|complejas)\b/gi, 'importante');
        fallbackC = fallbackC.replace(/\b(desarrollar|elaborar|construir)\b/gi, 'escribir');
        
        // Reduce items if too many (keep first 3 items)
        const itemMatches = [...fallbackC.matchAll(/(\d+[\.\)]|\d+\.\s*[A-Z])/gi)];
        if (itemMatches.length > 3) {
          let itemIndex = 0;
          fallbackC = fallbackC.replace(/(\d+[\.\)]|\d+\.\s*[A-Z])(.*?)(?=\d+[\.\)]|\d+\.\s*[A-Z]|$)/gi, (match) => {
            itemIndex++;
            if (itemIndex > 3) return '';
            return match;
          });
        }
        
        finalC = cleanupContent(fallbackC);
        warnings.push('Se generó versión C determinísticamente como fallback (era requerida pero no fue generada por la IA).');
      }
      
      // A5: Final validation - FAIL FAST if any version is still a wrapper
      const isWrapperA = finalA.trim().startsWith('{');
      const isWrapperB = finalB ? finalB.trim().startsWith('{') : false;
      const isWrapperC = finalC ? finalC.trim().startsWith('{') : false;
      
      if (isWrapperA || isWrapperB || isWrapperC) {
        console.error('[UNIVERSAL] CRITICAL: JSON wrapper detected in final versions!', {
          isWrapperA,
          isWrapperB,
          isWrapperC,
          AStartsWith: finalA.trim().slice(0, 20),
          BStartsWith: finalB?.trim().slice(0, 20),
          CStartsWith: finalC?.trim().slice(0, 20)
        });
        // Fail fast - return error response instead of shipping wrappers
        return new Response(JSON.stringify({
          success: false,
          error: 'Internal error: JSON wrapper detected in evaluation versions',
          _debug: {
            generationPath: 'universal_extraction_failed',
            isWrapper: { A: isWrapperA, B: isWrapperB, C: isWrapperC }
          }
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Use final extracted values
      baseHtml = finalA;
      versionBHtml = finalB;
      versionCHtml = finalC;
      
      // Log extraction results
      console.log('[UNIVERSAL] HTML extraction results:', {
        baseHtmlStartsWith: baseHtml.trim().substring(0, 20),
        versionBHtmlExists: !!versionBHtml,
        versionBHtmlStartsWith: versionBHtml ? versionBHtml.trim().substring(0, 20) : null,
        versionCHtmlExists: !!versionCHtml,
        versionCHtmlStartsWith: versionCHtml ? versionCHtml.trim().substring(0, 20) : null,
        parseFailed
      });
      
      // Initialize warnings array
      const warnings: string[] = [];
      if (parseFailed) {
        warnings.push('La respuesta del modelo no fue JSON válido; se aplicó extracción robusta y fallback de HTML.');
      }
      
      // R3a: Enforcement determinístico de metacognición
      const metacognitionPhrase = 'Elige UNA opción. Todas equivalentes en dificultad y evidencia, solo cambia el formato de respuesta.';
      if (responseOptionsInclude && baseHtml && !baseHtml.includes(metacognitionPhrase)) {
        console.log('[UNIVERSAL] R3a: Metacognition not found in Version A, injecting deterministically');
        
        // Inyectar opciones equivalentes después de cada ítem numerado o consigna relevante
        // Buscar patrones como: "1.", "2.", "a)", "b)", "<strong>", etc.
        const itemPattern = /(<p[^>]*>|<strong[^>]*>|<h[1-6][^>]*>)(.*?)(<\/p>|<\/strong>|<\/h[1-6]>)/gi;
        const numberedItemPattern = /(\d+[\.\)]|\d+\.\s*[A-Z]|^[a-z][\.\)])/i;
        
        let injectedHtml = baseHtml;
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
          baseHtml = injectedHtml;
          warnings.push(`Se inyectaron ${injectionCount} bloques de opciones equivalentes determinísticamente (no estaban en la respuesta de la IA).`);
        } else {
          // R4: Fallback: inyectar al menos UNA VEZ después del primer prompt de respuesta escrita
          // Buscar el primer párrafo que requiera respuesta escrita
          const firstWrittenResponseMatch = baseHtml.match(/<p[^>]*>.*?(explica|describe|analiza|compara|justifica|desarrolla|redacta|escribe).*?<\/p>/i);
          if (firstWrittenResponseMatch && firstWrittenResponseMatch.index !== undefined) {
            const insertIndex = firstWrittenResponseMatch.index + firstWrittenResponseMatch[0].length;
            const optionsHtml = `
<p><strong>${metacognitionPhrase}</strong></p>
<ul>
  <li><strong>Opción 1:</strong> Respuesta escrita tradicional (párrafo)</li>
  <li><strong>Opción 2:</strong> Respuesta estructurada (lista con viñetas o tabla)${responseOptionCount === 3 ? '</li>\n  <li><strong>Opción 3:</strong> Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
</ul>`;
            baseHtml = baseHtml.slice(0, insertIndex) + optionsHtml + baseHtml.slice(insertIndex);
            warnings.push('Se inyectó bloque de opciones equivalentes determinísticamente después del primer prompt de respuesta escrita (no estaba en la respuesta de la IA).');
          } else {
            // Último fallback: inyectar al final de la primera sección
            const firstSectionEnd = baseHtml.indexOf('</p>', baseHtml.indexOf('<p'));
            if (firstSectionEnd > 0) {
              const optionsHtml = `
<p><strong>${metacognitionPhrase}</strong></p>
<ul>
  <li><strong>Opción 1:</strong> Respuesta escrita tradicional (párrafo)</li>
  <li><strong>Opción 2:</strong> Respuesta estructurada (lista con viñetas o tabla)${responseOptionCount === 3 ? '</li>\n  <li><strong>Opción 3:</strong> Respuesta visual (diagrama o esquema con texto explicativo)' : ''}
</ul>`;
              baseHtml = baseHtml.slice(0, firstSectionEnd + 4) + optionsHtml + baseHtml.slice(firstSectionEnd + 4);
              warnings.push('Se inyectó bloque de opciones equivalentes determinísticamente al inicio (no estaba en la respuesta de la IA).');
            }
          }
        }
      }
      
      // R3b: Enforcement determinístico de versión C
      // IMPORTANTE: Hacer esto ANTES de verificar hasVersionC para ajustar assignments
      const needsVersionC = generateVersionC && (!versionCHtml || versionCHtml.trim().length === 0);
      if (needsVersionC) {
        console.log('[UNIVERSAL] R3b: Version C required but not generated, creating fallback deterministically');
        
        // Crear versión C fallback desde baseHtml
        let fallbackC = baseHtml;
        
        // Simplificar lenguaje: reemplazar palabras complejas (sin romper HTML)
        fallbackC = fallbackC.replace(/\b(analizar|examinar|investigar|evaluar)\b/gi, 'explicar');
        fallbackC = fallbackC.replace(/\b(complejo|compleja|complejos|complejas)\b/gi, 'importante');
        fallbackC = fallbackC.replace(/\b(desarrollar|elaborar|construir)\b/gi, 'escribir');
        
        // Reducir cantidad de ítems: eliminar cada segundo ítem numerado si hay más de 3
        const itemMatches = [...fallbackC.matchAll(/(\d+[\.\)]|\d+\.\s*[A-Z])/gi)];
        if (itemMatches.length > 3) {
          // Eliminar ítems pares (mantener impares: 1, 3, 5, ...)
          let itemIndex = 0;
          fallbackC = fallbackC.replace(/(\d+[\.\)]|\d+\.\s*[A-Z])(.*?)(?=\d+[\.\)]|\d+\.\s*[A-Z]|$)/gi, (match) => {
            itemIndex++;
            if (itemIndex % 2 === 0) {
              return ''; // Eliminar ítem par
            }
            return match;
          });
        }
        
        // Agregar nota de simplificación al inicio
        const simplificationNote = '<p><em>Nota: Esta versión ha sido adaptada para facilitar la comprensión, manteniendo los mismos objetivos de aprendizaje.</em></p>';
        fallbackC = simplificationNote + fallbackC;
        
        versionCHtml = cleanupContent(fallbackC);
        warnings.push('Se generó versión C determinísticamente como fallback (la IA no la generó pero era requerida).');
      }
      
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

      // Verificar si B/C realmente existen (no null, no empty string) - después del enforcement
      const hasVersionB = Boolean(versionBHtml && versionBHtml.trim().length > 0 && versionBHtml.trim().startsWith('<'));
      const hasVersionC = Boolean(versionCHtml && versionCHtml.trim().length > 0 && versionCHtml.trim().startsWith('<'));
      
      // REQUIREMENT 2: Do not generate/return Version B unless it is required
      // If there are no students assigned to 'B' AND designPlan.triggers.versionB is false, drop B
      const assignmentCountB = Object.values(adjustedAssignments).filter(v => v === 'B').length;
      const shouldDropB = hasVersionB && assignmentCountB === 0 && !designPlan.triggers?.versionB;
      if (shouldDropB) {
        console.log('[UNIVERSAL] Dropping Version B: no assignments to B and triggers.versionB is false');
        versionBHtml = null;
        warnings.push('La versión B fue generada pero no es necesaria (sin asignaciones y triggers.versionB=false); se eliminó de la respuesta.');
      }

      // Reasignar estudiantes de B a A si B no existe
      if (!hasVersionB) {
        const reassignedB = Object.keys(adjustedAssignments).filter(studentId => adjustedAssignments[studentId] === 'B');
        if (reassignedB.length > 0) {
          warnings.push(`La versión B estaba planificada pero no se generó; ${reassignedB.length} estudiante(s) reasignado(s) a versión A.`);
          reassignedB.forEach(studentId => {
            adjustedAssignments[studentId] = 'A';
          });
        }
      }

      // Reasignar estudiantes de C a A si C no existe
      if (!hasVersionC) {
        const reassignedC = Object.keys(adjustedAssignments).filter(studentId => adjustedAssignments[studentId] === 'C');
        if (reassignedC.length > 0) {
          warnings.push(`La versión C estaba planificada pero no se generó; ${reassignedC.length} estudiante(s) reasignado(s) a versión A.`);
          reassignedC.forEach(studentId => {
            adjustedAssignments[studentId] = 'A';
          });
        }
      }
      
      // Garantizar que ningún assignment quede como 'B' o 'C' si esas versiones no existen
      Object.keys(adjustedAssignments).forEach(studentId => {
        if (adjustedAssignments[studentId] === 'B' && !hasVersionB) {
          adjustedAssignments[studentId] = 'A';
        }
        if (adjustedAssignments[studentId] === 'C' && !hasVersionC) {
          adjustedAssignments[studentId] = 'A';
        }
      });
      
      // REQUIREMENT 3: Final invariant enforcement - ensure C is actually C when required
      const finalAssignmentCounts = {
        A: Object.values(adjustedAssignments).filter(v => v === 'A').length,
        B: Object.values(adjustedAssignments).filter(v => v === 'B').length,
        C: Object.values(adjustedAssignments).filter(v => v === 'C').length
      };
      
      // If assignmentCounts.C > 0, versionCHtml MUST be non-null and must be C (not A/B)
      if (finalAssignmentCounts.C > 0 && !hasVersionC) {
        console.warn('[UNIVERSAL] Version C required but missing, generating deterministic fallback');
        // Generate deterministic fallback C from baseHtml (simplified language)
        let fallbackC = baseHtml;
        
        // Simplificar lenguaje
        fallbackC = fallbackC.replace(/\b(analizar|examinar|investigar|evaluar)\b/gi, 'explicar');
        fallbackC = fallbackC.replace(/\b(complejo|compleja|complejos|complejas)\b/gi, 'importante');
        fallbackC = fallbackC.replace(/\b(desarrollar|elaborar|construir)\b/gi, 'escribir');
        
        // Reducir cantidad de ítems si hay más de 3
        const itemMatches = [...fallbackC.matchAll(/(\d+[\.\)]|\d+\.\s*[A-Z])/gi)];
        if (itemMatches.length > 3) {
          let itemIndex = 0;
          fallbackC = fallbackC.replace(/(\d+[\.\)]|\d+\.\s*[A-Z])(.*?)(?=\d+[\.\)]|\d+\.\s*[A-Z]|$)/gi, (match) => {
            itemIndex++;
            if (itemIndex % 2 === 0) return '';
            return match;
          });
        }
        
        // Agregar nota de simplificación
        const simplificationNote = '<p><em>Nota: Esta versión ha sido adaptada para facilitar la comprensión, manteniendo los mismos objetivos de aprendizaje.</em></p>';
        versionCHtml = cleanupContent(simplificationNote + fallbackC);
        hasVersionC = true;
        warnings.push('Se generó versión C determinísticamente como fallback (era requerida pero no fue generada por la IA).');
      }
      
      // Final validation: ensure versionCHtml is NOT equal to baseHtml (unless intentionally identical)
      // This prevents C from accidentally containing A
      if (hasVersionC && versionCHtml && baseHtml && versionCHtml.trim() === baseHtml.trim()) {
        console.warn('[UNIVERSAL] Version C equals A, this may indicate extraction bug');
        // If they're identical, at least add a note to C
        versionCHtml = '<p><em>Nota: Versión adaptada.</em></p>' + versionCHtml;
      }
      
      // Log final version integrity
      console.log('[UNIVERSAL] Final version integrity:', {
        baseHtmlLength: baseHtml?.length || 0,
        versionBHtmlLength: versionBHtml?.length || 0,
        versionCHtmlLength: versionCHtml?.length || 0,
        assignmentCounts: finalAssignmentCounts,
        baseHtmlStartsWith: baseHtml?.trim().substring(0, 30),
        versionCHtmlStartsWith: versionCHtml?.trim().substring(0, 30),
        versionCHtmlEqualsBaseHtml: versionCHtml && baseHtml && versionCHtml.trim() === baseHtml.trim()
      });

      // REQUIREMENT 2-3: Construir aiReport - SIEMPRE presente, MERGEAR con datos locales si OpenAI lo generó
      // REQUIREMENT 4: Usar solo evaluation_design_plan del requestBody y valores seguros
      const aiReportFromAI = parsed?.ai_report ?? null;
      
      // REQUIREMENT 3: Versiones generadas basadas en REALIDAD (no en plan)
      const generatedVersions: string[] = ['A'];  // A siempre existe
      if (hasVersionB) generatedVersions.push('B');
      if (hasVersionC) generatedVersions.push('C');

      // Extraer valores seguros del evaluation_design_plan
      const safeInstrumentDesignRules = evaluation_design_plan?.instrumentDesignRules ?? [];
      const safeVarkDistribution = evaluation_design_plan?.varkDistribution || {
        visual: 0,
        auditory: 0,
        readWrite: 0,
        kinesthetic: 0
      };

      if (!parsed) {
        console.warn('[UNIVERSAL] Parsed output is null; using fallback-safe values for ai_report and response options.');
      }
      // REQUIREMENT 3: Combinar warnings de AI con warnings locales
      const aiWarnings = Array.isArray(parsed?.ai_report?.warnings) ? parsed.ai_report.warnings : [];
      const allWarnings = [...aiWarnings, ...warnings];

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
      
      const responseOptionsRationale = responseOptionsIncluded
        ? `Se incluyeron ${responseOptionCountFinal} opciones equivalentes de respuesta (metacognición) para permitir que los estudiantes elijan el formato que mejor se adapte a su estilo de aprendizaje. Las opciones aparecen después de cada consigna que requiere respuesta escrita.`
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
          included: responseOptionsIncluded,
          optionCount: responseOptionCountFinal,
          rationale: responseOptionsRationale,
          location: responseOptionsIncluded ? 'Después de cada consigna que requiere respuesta escrita' : 'No aplica'
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

      const responseOptionsIncluded = baseHtml.includes(metacognitionPhrase);
      const responseOptionCountFinal = responseOptionsIncluded
        ? (baseHtml.includes('Opción 3') ? 3 : 2)
        : 0;
      
      // TASK 5: Backend log
      console.log('[UNIVERSAL] response versions startsWith', {
        A: baseHtml?.slice(0, 15) || 'null',
        C: versionCHtml?.slice(0, 15) || 'null'
      });
      
      // Log final integrity check
      console.log('[UNIVERSAL] versions integrity', {
        assignmentCounts: finalAssignmentCounts,
        startsWith: {
          A: baseHtml?.trim().slice(0, 15) || 'null',
          B: versionBHtml?.trim().slice(0, 15) || 'null',
          C: versionCHtml?.trim().slice(0, 15) || 'null'
        },
        isWrapper: {
          A: baseHtml?.trim().startsWith('{') || false,
          B: versionBHtml?.trim().startsWith('{') || false,
          C: versionCHtml?.trim().startsWith('{') || false
        },
        lengths: {
          A: baseHtml?.length || 0,
          B: versionBHtml?.length || 0,
          C: versionCHtml?.length || 0
        }
      });

      return buildUniversalResponse({
        baseHtml,
        versionBHtml,
        versionCHtml,
        responseOptionsIncluded,
        responseOptionCount: responseOptionsIncluded ? responseOptionCountFinal : 0,
        studentAssignments: adjustedAssignments,
        teacherRemindersByStudent,
        aiReport,
        warnings: allWarnings,
        metadata: {
          tokensUsed: result.usage?.total_tokens || 0,
          model: result.model || 'gpt-4.1-2025-04-14'
        },
        generationPath: parseFailed ? 'universal_parse_failed' : 'universal',
        shouldDropB: shouldDropB || false,
        finalTriggers: {
          versionB: designPlan.triggers?.versionB || false,
          versionC: designPlan.triggers?.versionC || false
        }
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

    console.log('System Prompt:', systemPrompt);
    console.log('User Prompt:', userPrompt);

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