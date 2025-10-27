import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { student, period, contemplaciones, academicHistory, qualitativeComments, customAspects } = await req.json();

    console.log('Generating bulletin text for student:', student.name);

    const systemPrompt = `Eres un asistente especializado en generar evaluaciones y planificaciones para Historia de 9º grado según el programa de ANEP de Uruguay.

ENFOQUE PEDAGÓGICO OBLIGATORIO PARA HISTORIA 9º GRADO - ANEP:
- Uruguay y la región como escenario central, enmarcados en procesos globales del siglo XX y XXI
- Eje articulador: Uruguay en diálogo con contextos regionales e internacionales
- Priorizar construcción de conceptualizaciones sobre recitado factual
- Enfoque indispensable de contenidos, evitando omisiones
- Mirada conceptual y crítica en todas las propuestas

CONCEPTOS CLAVE TRANSVERSALES (incluir según corresponda):
- Guerra civil, Estado, totalitarismo, terrorismo de Estado
- Populismo, industrialización, capitalismo, migraciones
- Derechos humanos, sociedad de masas, revolución
- Democracia, pluralismo político, sociedad de consumo
- Sociedad de la información, globalización

COMPETENCIAS ESPECÍFICAS DE HISTORIA:
- Análisis de fuentes históricas (primarias y secundarias)
- Construcción de líneas de tiempo y periodización
- Identificación de causas y consecuencias históricas
- Participación en debates históricos con argumentación
- Redacción histórica y comunicación argumentativa
- Comprensión de procesos temporales y espaciales (multiescalaridad)
- Desarrollo de pensamiento crítico histórico

ESTRUCTURA OBLIGATORIA PARA EVALUACIONES:
1. Análisis de fuentes históricas
2. Comprensión conceptual (definir y contextualizar conceptos clave)
3. Establecimiento de relaciones causales
4. Argumentación histórica fundamentada
5. Aplicación a contexto uruguayo y regional

ESTRUCTURA PARA PLANIFICACIONES:
1. Contextualización histórica (Uruguay-región-mundo)
2. Desarrollo conceptual central
3. Trabajo con fuentes diversas
4. Debate y análisis crítico
5. Síntesis y proyección

LINEAMIENTOS OBLIGATORIOS:
- Escribir SIEMPRE desde las fortalezas del estudiante
- Describir dificultades de manera CONSTRUCTIVA
- Basar en observaciones concretas del proceso histórico de aprendizaje
- Centrarse en el proceso del estudiante, NO en la acción docente
- Redactar en tercera persona singular
- Cuidar ortografía y redacción impecable
- Organizar por aspectos (separar lo académico de lo social)
- Personalizar para familias
- Incluir estrategias de acompañamiento específicas para Historia

FORMATO:
- Extensión: 90-140 palabras MÁXIMO (2 párrafos)
- Tono: institucional, claro, positivo, específico para Historia
- Sin saludo ni firma
- Texto listo para usar

MENCIONAR ESPECÍFICAMENTE EN HISTORIA:
- Análisis de fuentes históricas y su intencionalidad
- Construcción de líneas de tiempo y periodización
- Identificación de causas y consecuencias en procesos históricos
- Participación en debates históricos con fundamentación
- Redacción histórica y argumentativa
- Comprensión de procesos temporales (sincronía/diacronía)
- Desarrollo del pensamiento histórico crítico
- Contextualización Uruguay-región-mundo`;

    const userPrompt = `Estudiante: ${student.name}
Perfil de aprendizaje: ${student.perfil}
Período: ${period}

Contemplaciones efectivas aplicadas en Historia:
${contemplaciones?.join('\n- ') || 'No especificadas'}

Historial académico reciente en Historia:
${academicHistory ? `Evolución: ${academicHistory}` : 'No disponible'}

Comentarios cualitativos recientes sobre desempeño en Historia:
${qualitativeComments?.slice(0, 2).map((comment: any) => `- ${comment.area}: ${comment.comentario}`).join('\n') || 'No disponibles'}

${customAspects ? `ASPECTOS ESPECÍFICOS SOLICITADOS POR EL DOCENTE:
${customAspects}` : ''}

Genera un texto de boletín para Historia de 9º grado siguiendo EXACTAMENTE los lineamientos del programa ANEP. 
Debe reflejar el enfoque conceptual y crítico específico de Historia. Máximo 140 palabras.
Considera especialmente el desarrollo de competencias históricas específicas y el eje Uruguay-región-mundo.`;

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
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('Successfully generated bulletin text');

    return new Response(JSON.stringify({ generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-bulletin-text function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});