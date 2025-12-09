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
      prompt: customPrompt
    } = await req.json();

    console.log('Request received:', { type, adaptationLevel, modification });

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
      // Planificación de clase con IA
      systemPrompt = `Eres un experto en planificación didáctica y pedagogía. Tu tarea es crear sugerencias específicas y prácticas para planificación de clases, considerando diferentes estilos de aprendizaje y necesidades de adaptación curricular.

PRINCIPIOS PEDAGÓGICOS:
- Aprendizaje significativo y contextualizado
- Atención a la diversidad y estilos de aprendizaje
- Uso de metodologías activas y participativas
- Inclusión de evaluación formativa
- Recursos variados y accesibles

ESTRUCTURA DE CLASE ESPERADA:
- Apertura motivadora (15 min)
- Desarrollo principal (45 min) 
- Cierre y síntesis (20 min)

CONTEXTO ESPECÍFICO:
Materia: ${groupContext?.subject || 'No especificada'}
Contenidos: ${groupContext?.content?.join(', ') || 'No especificados'}
Perfil dominante: ${groupContext?.dominantProfile || 'Mixto'}
Objetivo: ${groupContext?.objective || 'No especificado'}
Estudiantes: ${groupContext?.students?.length || 0}
Grupo: ${groupContext?.groupName || 'Sin nombre'}`;

      userPrompt = `SOLICITUD DE PLANIFICACIÓN:
${modification}

CONTEXTO ADICIONAL:
${groupContext?.additionalContext || 'No especificado'}

TAREA: Genera sugerencias didácticas específicas, prácticas y aplicables. Incluye actividades concretas, recursos necesarios y adaptaciones para diferentes estilos de aprendizaje.`;

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