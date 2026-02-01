import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Initialize Supabase client for image rehosting
// Note: Using SERVICE_ROLE_KEY instead of SUPABASE_SERVICE_ROLE_KEY
// because Supabase reserves the SUPABASE_* prefix for system secrets
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    return new Response(null, { headers: corsHeaders });
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

    console.log('Request received:', { type, adaptationLevel, modification, hasGenerationContext: !!generation_context });

    // PHASE 6b: Handle evaluation generation with session digests + time budgeting
    if (generation_context && type === 'modification') {
      console.log('[PHASE 6b] Processing evaluation with generation_context');
      console.log('- Sessions:', generation_context.sessions?.length || 0);
      console.log('- Materials:', generation_context.materials?.length || 0);
      console.log('- Time Budget:', generation_context.timeBudget);
      
      // Build session digests section
      const sessionsSection = generation_context.sessions && generation_context.sessions.length > 0
        ? `
SESIONES DE CLASE A EVALUAR:
${generation_context.sessions.map((s: any, idx: number) => `
Sesión ${s.order}: ${s.title || `Sesión ${s.order}`}
- Contenidos ANEP: ${s.anepContent?.join(', ') || 'No especificados'}
- Competencias: ${s.competencies?.join(', ') || 'No especificadas'}
- Objetivos: ${s.objectives || 'No especificados'}
- Resumen de actividades: ${s.activitiesSummary || 'No disponible'}
- Recursos: ${s.resources?.join(', ') || 'No especificados'}
${s.attachedMaterials?.length ? `- Materiales adjuntos: ${s.attachedMaterials.map((m: any) => m.title).join(', ')}` : ''}
`).join('\n---\n')}
` : '';

      // Build materials section
      const materialsSection = generation_context.materials && generation_context.materials.length > 0
        ? `
MATERIALES DOCENTES ADJUNTOS:
${generation_context.materials.map((m: any, idx: number) => `
${idx + 1}. ${m.title} (${m.mimeType})
${m.focusText ? `   Enfoque: ${m.focusText}` : ''}
${m.extractedText ? `   Contenido extraído del PDF:\n   ${m.extractedText}` : '   (No hay texto extraído disponible)'}
`).join('\n---\n')}
` : '';

      // Build evaluation focus section
      const focusSection = generation_context.evaluationFocus
        ? `
ENFOQUE DE EVALUACIÓN (ESPECIFICADO POR EL DOCENTE):
${generation_context.evaluationFocus}

INSTRUCCIÓN CRÍTICA: La evaluación debe enfocarse específicamente en los aspectos mencionados arriba.
` : '';

      // Build time budget section
      const timeBudgetSection = generation_context.timeBudget
        ? `
PRESUPUESTO DE TIEMPO:
- Duración objetivo: ${generation_context.timeBudget.targetMinutes} minutos
- Tolerancia: ${Math.round((generation_context.timeBudget.flexibilityThreshold || 0.10) * 100)}%

INSTRUCCIÓN CRÍTICA: La evaluación debe completarse dentro del tiempo objetivo.
Debes incluir en tu respuesta una estimación de tiempo por sección.
` : '';

      // First generation attempt
      const systemPrompt = `Eres un experto en evaluación educativa. Tu tarea es generar una evaluación basada en:
1. Sesiones de clase específicas (con sus contenidos, objetivos, actividades)
2. Materiales docentes adjuntos
3. Enfoque evaluativo del docente
4. Presupuesto de tiempo

FORMATO DE RESPUESTA REQUERIDO (JSON):
Debes devolver un objeto JSON con la siguiente estructura:
{
  "evaluationHTML": "<html>...</html>",
  "estimatedTotalMinutes": 75,
  "timeBreakdown": [
    {"itemType": "multiple_choice", "estimatedMinutes": 20, "description": "10 preguntas de opción múltiple"},
    {"itemType": "short_answer", "estimatedMinutes": 25, "description": "5 preguntas de respuesta corta"},
    {"itemType": "essay", "estimatedMinutes": 30, "description": "1 pregunta de desarrollo"}
  ],
  "aiDesignReport": {
    "rationale": "Esta evaluación integra las 3 sesiones trabajadas...",
    "coverageMapping": [
      {"sessionId": "uuid-123", "sessionTitle": "Sesión 1", "sectionsIncluded": ["Sección I", "Sección II"]}
    ],
    "materialsUsage": [
      {"materialId": "mat-456", "materialTitle": "Material X", "usageDescription": "Utilizado en pregunta 3..."}
    ],
    "adaptationNotes": "Las contemplaciones se aplicaron diferenciadamente..."
  }
}

REGLAS CRÍTICAS:
1. El HTML debe ser válido y renderizable
2. estimatedTotalMinutes debe ser la suma de timeBreakdown
3. aiDesignReport.coverageMapping debe mapear cada sesión a secciones específicas de la evaluación
4. aiDesignReport NO debe incluir recomendaciones por estudiante (eso va en casillas separadas)
5. Si hay timeBudget, intenta que estimatedTotalMinutes <= targetMinutes`;

      const userPrompt = `${sessionsSection}${materialsSection}${focusSection}${timeBudgetSection}

CONTEXTO DEL GRUPO:
Materia: ${groupContext?.subject || 'No especificada'}
Estudiantes: ${groupContext?.students?.length || 0}
Nivel de adaptación: ${adaptationLevel}

${modification ? `REQUERIMIENTOS ADICIONALES:\n${modification}` : ''}

Genera la evaluación en formato JSON siguiendo la estructura especificada.`;

      console.log('[PHASE 6b] System Prompt:', systemPrompt.substring(0, 500) + '...');
      console.log('[PHASE 6b] User Prompt:', userPrompt.substring(0, 500) + '...');

      // First generation attempt with JSON mode
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

      let generatedContent = result.choices[0]?.message?.content;
      let parsed: any;

      try {
        parsed = JSON.parse(generatedContent || '{}');
      } catch (e) {
        console.error('[PHASE 6b] Failed to parse JSON response:', e);
        // Fallback: return content as-is
        return new Response(JSON.stringify({
          success: true,
          content: generatedContent,
          type: type,
          warning: 'Time budgeting no disponible (respuesta no estructurada)'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if time budget exceeded
      const targetMinutes = generation_context.timeBudget?.targetMinutes || Infinity;
      const threshold = generation_context.timeBudget?.flexibilityThreshold || 0.10;
      const maxAllowedMinutes = targetMinutes * (1 + threshold);
      const estimatedMinutes = parsed.estimatedTotalMinutes || 0;

      let wasTimeRefined = false;

      if (estimatedMinutes > maxAllowedMinutes && generation_context.timeBudget) {
        console.log(`[PHASE 6b] Time budget exceeded: ${estimatedMinutes} > ${maxAllowedMinutes}`);
        console.log('[PHASE 6b] Running refinement pass...');

        // Refinement pass
        const refinementPrompt = `La evaluación generada excede el presupuesto de tiempo:
- Tiempo estimado: ${estimatedMinutes} minutos
- Tiempo objetivo: ${targetMinutes} minutos
- Máximo permitido: ${maxAllowedMinutes} minutos

TAREA: Refina la evaluación para que se ajuste al tiempo objetivo, manteniendo:
1. Cobertura de todos los temas/sesiones
2. Contemplaciones aplicadas (no eliminar adaptaciones)
3. Calidad pedagógica

ESTRATEGIAS PERMITIDAS:
- Reducir número de preguntas (ej: 10 → 7 preguntas de opción múltiple)
- Acortar preguntas de desarrollo (pedir respuestas más concisas)
- Combinar secciones similares
- Simplificar instrucciones sin perder claridad

DEVUELVE: El mismo formato JSON con evaluationHTML refinada, estimatedTotalMinutes actualizado, y timeBreakdown actualizado.`;

        const refinementResult = await retryWithBackoff(async () => {
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
                { role: 'user', content: userPrompt },
                { role: 'assistant', content: generatedContent },
                { role: 'user', content: refinementPrompt }
              ],
              response_format: { type: 'json_object' },
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

        const refinedContent = refinementResult.choices[0]?.message?.content;
        try {
          parsed = JSON.parse(refinedContent || '{}');
          wasTimeRefined = true;
          console.log(`[PHASE 6b] Refinement successful. New estimated time: ${parsed.estimatedTotalMinutes}`);
        } catch (e) {
          console.error('[PHASE 6b] Failed to parse refined JSON, using original');
        }
      }

      // Return structured response
      return new Response(JSON.stringify({
        success: true,
        content: parsed.evaluationHTML || '',
        type: type,
        // PHASE 6b fields
        estimatedTotalMinutes: parsed.estimatedTotalMinutes,
        timeBreakdown: parsed.timeBreakdown,
        aiDesignReport: parsed.aiDesignReport,
        wasTimeRefined,
        metadata: {
          tokensUsed: result.usage?.total_tokens || 0,
          model: result.model || 'gpt-4.1-2025-04-14'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Universal evaluation path (backward compatible)
    if (type === 'modification' && generation_mode === 'universal') {
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
      const generateVersionB = designPlan.triggers?.versionB === true;
      const generateVersionC = designPlan.triggers?.versionC === true;
      
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
- Si corresponde, cada consigna debe incluir "Elige UNA opción. Todas equivalentes."
- Opciones equivalentes en dificultad y evidencia, solo cambia el formato de respuesta
- Máximo ${responseOptionCount} opciones cuando se solicitan opciones

SALIDA OBLIGATORIA (JSON):
{
  "versions": { "A": "<html>...</html>", "B": "<html>...</html> | null", "C": "<html>...</html> | null" },
  "response_options_included": true/false,
  "response_option_count": ${responseOptionCount},
  "ai_report": {
    "versions": { "generated": ["A","B","C"], "reason": "..." },
    "contemplaciones": {
      "instrument_design": ["..."],
      "admin_reminders": ["..."],
      "correction_reminders": ["..."]
    },
    "response_options": { "included": true/false, "optionCount": ${responseOptionCount}, "rationale": "..." },
    "vark": { "summary": "..." },
    "assignments": { "rationale": "..." },
    "warnings": ["..."]
  }
}`;

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
- Generar versión B equivalente: ${generateVersionB ? 'Sí' : 'No'}
- Generar versión C con adecuación de contenido: ${generateVersionC ? 'Sí' : 'No'}

TAREA:
1. Genera la versión base (A) universal.
2. Si se pide, genera versión B equivalente (solo cambia formato, misma evidencia).
3. Si se pide, genera versión C con adecuación de contenido (solo para estudiantes explícitos).
4. Devuelve únicamente el JSON solicitado.
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
      let parsed: any;

      try {
        parsed = JSON.parse(generatedContent || '{}');
      } catch (e) {
        console.error('[UNIVERSAL] Failed to parse JSON response:', e);
        return new Response(JSON.stringify({
          success: true,
          content: generatedContent || '',
          type: type,
          warning: 'Respuesta no estructurada; se devuelve el contenido base.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const versions = parsed.versions || {};
      const baseHtml = cleanupContent(versions.A || parsed.base_html || parsed.baseHtml || '');
      const versionBHtml = cleanupContent(versions.B || parsed.version_b_html || parsed.versionBHtml || '');
      const versionCHtml = cleanupContent(versions.C || parsed.version_c_html || parsed.versionCHtml || '');
      const warnings: string[] = Array.isArray(parsed.ai_report?.warnings) ? parsed.ai_report.warnings : [];

      if (generateVersionB && !versionBHtml) {
        warnings.push('La versión B estaba planificada pero no se generó; se reasignará a versión A.');
      }
      if (generateVersionC && !versionCHtml) {
        warnings.push('La versión C estaba planificada pero no se generó; se reasignará a versión A.');
      }

      return new Response(JSON.stringify({
        success: true,
        content: baseHtml || '',
        type: type,
        evaluationBundle: {
          baseHtml,
          versionBHtml: versionBHtml || null,
          versionCHtml: versionCHtml || null,
          versions: {
            A: baseHtml || '',
            B: versionBHtml || null,
            C: versionCHtml || null
          },
          responseOptionsIncluded: parsed.response_options_included === true,
          responseOptionCount: parsed.response_option_count || responseOptionCount
        },
        studentAssignments,
        teacherRemindersByStudent,
        aiReport: parsed.ai_report || null,
        warnings,
        metadata: {
          tokensUsed: result.usage?.total_tokens || 0,
          model: result.model || 'gpt-4.1-2025-04-14'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        return new Response(JSON.stringify({ 
          success: true,
          content: generatedContent,
          type: type,
          warning: 'La respuesta fue truncada por límite de tokens. El contenido puede estar incompleto.',
          metadata: {
            tokensUsed: result.usage?.total_tokens || 0,
            model: result.model || model,
            finishReason: finishReason
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
      
      return new Response(JSON.stringify({ 
        success: true,
        content: fallbackMessage,
        type: type,
        warning: `La IA no generó contenido nuevo. Razón: ${finishReason || 'unknown'}. Se proporciona contenido alternativo.`
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

    return new Response(JSON.stringify({ 
      success: true,
      content: generatedContent,
      type: type,
      metadata: {
        tokensUsed: result.usage?.total_tokens || 0,
        model: result.model || model
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