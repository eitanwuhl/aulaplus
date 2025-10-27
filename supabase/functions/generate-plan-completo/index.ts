import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      modo,
      sesionId,
      orden,
      duracionMin,
      materia,
      nivel,
      contenidos,
      competencias,
      criterios,
      perfilGrupo,
      estudiantes,
      instruccionesDocente,
      planActual
    } = await req.json();

    const prompt = `
Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP).
${modo === 'regenerar' ? 'Modificá' : 'Generá'} el plan de la sesión ${orden} con duración ${duracionMin} minutos.

CONTEXTO DE LA CLASE:
- Materia: ${materia || 'Sin especificar'}
- Nivel: ${nivel || 'Sin especificar'}
- Contenidos ANEP: ${Array.isArray(contenidos) ? contenidos.join(', ') : contenidos || 'Sin especificar'}
- Competencias: ${Array.isArray(competencias) ? competencias.join(', ') : competencias || 'Sin especificar'}
- Criterios de logro: ${Array.isArray(criterios) ? criterios.join(', ') : criterios || 'Sin especificar'}
${perfilGrupo ? `- Perfil del grupo: ${perfilGrupo.dominante || 'mixto'} (${perfilGrupo.tamanio || 'sin especificar'} estudiantes)` : ''}
${estudiantes?.length ? `- Estudiantes con ajustes: ${estudiantes.filter(e => e.ajustes?.length).length}` : ''}
${instruccionesDocente ? `\nINSTRUCCIONES DEL DOCENTE:\n${instruccionesDocente}` : ''}
${planActual ? `\nPLAN ACTUAL A MODIFICAR:\n${planActual}` : ''}

ESTRUCTURA OBLIGATORIA - DEVOLVER SOLO HTML VÁLIDO:
<section id="plan">
  <h1>Planificación de Clase</h1>

  <h2><strong>Inicio (15 min)</strong></h2>
  <h3>Actividad de apertura motivadora</h3>
  <p><strong>Actividad:</strong> Descripción específica de la actividad de inicio</p>
  <ul>
    <li>Paso detallado 1</li>
    <li>Paso detallado 2</li>
    <li>Paso detallado 3</li>
  </ul>
  <p><strong>Recursos:</strong> Lista de recursos específicos</p>
  <p><strong>Diferenciación/Adaptaciones:</strong></p>
  <ul>
    <li>Adaptación para perfil visual</li>
    <li>Adaptación para perfil auditivo</li>
  </ul>

  <h2><strong>Desarrollo (${Math.max(duracionMin - 20, 30)} min)</strong></h2>
  <h3>Parte A - Actividad principal</h3>
  <ul>
    <li>Descripción detallada de la actividad</li>
    <li>Secuencia de pasos específicos</li>
  </ul>
  <p><strong>Recursos:</strong> Recursos necesarios</p>

  <h3>Parte B - Actividad secundaria</h3>
  <ul>
    <li>Descripción de la segunda actividad</li>
    <li>Pasos de implementación</li>
  </ul>

  <h2><strong>Cierre (5 min)</strong></h2>
  <h3>Actividad de síntesis</h3>
  <ul>
    <li>Síntesis de lo aprendido</li>
    <li>Reflexión grupal</li>
  </ul>
</section>

REQUISITOS ESTRICTOS:
1. Usar SOLO HTML válido - NO Markdown, NO code fences
2. Incluir SIEMPRE: <strong>Actividad:</strong>, <strong>Recursos:</strong>, <strong>Diferenciación/Adaptaciones:</strong>
3. Adaptar duraciones según el tiempo total (${duracionMin} min)
4. Incluir actividades específicas y detalladas
5. Considerar diferenciación para estudiantes con necesidades especiales
6. OBLIGATORIO: Los títulos H2 de Inicio, Desarrollo y Cierre DEBEN tener <strong> dentro del H2
7. EJEMPLO CORRECTO: <h2><strong>Inicio (15 min)</strong></h2>
8. EJEMPLO INCORRECTO: <h2>Inicio (15 min)</h2>

DEVOLVER JSON EXACTO:
{
  "plan_html": "<section id=\\"plan\\">...</section>",
  "argumento_competencias": "<p>Explicación de cómo las actividades desarrollan las competencias seleccionadas</p>",
  "recursos": ["Proyector", "Pizarrón", "Marcadores", "Material específico"]
}
`;

    const response = await retryWithBackoff(async () => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Eres un asistente pedagógico experto.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('OpenAI API error:', res.status, errorText);
        throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
      }

      return res;
    }, 3, 2000); // 3 intentos con delay base de 2 segundos

    const data = await response.json();
    let content = data.choices[0].message.content.trim();

    console.log('OpenAI response content:', content.substring(0, 200));

    // Intentar parsear como JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error, attempting extraction:', parseError);
      // Si no es JSON válido, intentar extraer
      parsed = {
        plan_html: content,
        argumento_competencias: '',
        recursos: []
      };
    }

    // Validar estructura HTML
    if (!parsed.plan_html || !parsed.plan_html.includes('<section id="plan">')) {
      console.error('Invalid HTML structure, creating fallback plan');
      
      // Crear plan de respaldo con estructura HTML válida
      parsed = {
        plan_html: `<section id="plan">
  <h1>Planificación de Clase</h1>

  <h2><strong>Inicio (15 min)</strong></h2>
  <h3>Actividad de apertura motivadora</h3>
  <p><strong>Actividad:</strong> Dinámica de bienvenida y contextualización del tema</p>
  <ul>
    <li>Recuperar conocimientos previos con preguntas dirigidas</li>
    <li>Presentar el objetivo de la clase</li>
    <li>Organizar el aula según la modalidad de trabajo</li>
  </ul>
  <p><strong>Recursos:</strong> Pizarra, marcadores</p>
  <p><strong>Diferenciación/Adaptaciones:</strong></p>
  <ul>
    <li>Visual: Apoyos gráficos y esquemas</li>
    <li>Auditivo: Explicaciones orales claras</li>
  </ul>

  <h2><strong>Desarrollo (${Math.max(duracionMin - 20, 30)} min)</strong></h2>
  <h3>Parte A - Exploración del contenido</h3>
  <ul>
    <li>Presentar el tema con ejemplos concretos</li>
    <li>Trabajo individual y grupal alternado</li>
    <li>Construcción colaborativa de aprendizajes</li>
  </ul>
  <p><strong>Recursos:</strong> Material didáctico, proyector</p>

  <h3>Parte B - Aplicación práctica</h3>
  <ul>
    <li>Actividades de aplicación del conocimiento</li>
    <li>Verificación de comprensión</li>
    <li>Registro de ideas principales</li>
  </ul>

  <h2><strong>Cierre (5 min)</strong></h2>
  <h3>Actividad de síntesis</h3>
  <ul>
    <li>Síntesis de lo aprendido</li>
    <li>Reflexión grupal</li>
    <li>Proyección para próximas clases</li>
  </ul>
</section>`,
        argumento_competencias: `<p>Las actividades propuestas favorecen el desarrollo de competencias mediante la construcción colaborativa de conocimientos y la aplicación práctica de conceptos.</p>`,
        recursos: ["Pizarra", "Marcadores", "Proyector", "Material didáctico"]
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-plan-completo function:', {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack
    });
    
    const isRateLimit = error.message?.includes('429') || error.message?.includes('Too Many Requests');
    const errorMessage = isRateLimit 
      ? 'Rate limit exceeded. Please wait a moment and try again.'
      : error.message || 'Unknown error';
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      error_code: isRateLimit ? 'RATE_LIMIT' : (error.code || 'FUNCTION_ERROR'),
      error_status: isRateLimit ? 429 : (error.status || 500),
      isRateLimit: isRateLimit
    }), {
      status: isRateLimit ? 429 : (error.status || 500),
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
