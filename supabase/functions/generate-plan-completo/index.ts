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
      planActual,
      // PHASE 2: unitContext para generación progresiva (opcional para backward compatibility)
      unitContext,
      // PHASE 3: Optional per-session focus override
      sessionBrief,
      // FIX: Materials context (includes extracted_text for materials-only generation)
      materialsContext
    } = await req.json();

    // PHASE 2.1: Construir sección de contexto de secuencia didáctica si unitContext está presente
    const secuenciaContext = unitContext ? `
CONTEXTO DE SECUENCIA DIDÁCTICA:
Esta clase forma parte de una unidad temática llamada "${unitContext.contenido}".

- Esta es la clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad} de esta unidad.
- El contenido debe ser progresivo y no repetitivo.
- No repitas explicaciones ya dadas en clases anteriores.
- El título de la clase debe reflejar el enfoque específico de esta sesión y debe ser diferente de otras clases en la misma unidad.

INSTRUCCIONES ESPECÍFICAS SEGÚN POSICIÓN:
${unitContext.claseEnUnidad === 1 ? '- Esta es la PRIMERA clase: Enfócate en introducción, contextualización y exploración inicial. El título debe reflejar este propósito introductorio.' : ''}
${unitContext.claseEnUnidad > 1 && unitContext.claseEnUnidad < unitContext.totalClasesUnidad ? `- Esta es una clase INTERMEDIA (${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Comienza con una breve activación de conocimientos previos conectando con la clase anterior, sin repetir explicaciones largas. Profundiza y complejiza el contenido. Evita introducir nuevos conceptos centrales. El título debe reflejar este enfoque de profundización.' : ''}
${unitContext.claseEnUnidad === unitContext.totalClasesUnidad && !unitContext.isExtraSlot ? '- Esta es la ÚLTIMA clase: Evita introducir nuevos conceptos centrales. Enfócate en integración, transferencia, debate o actividades aplicadas. El título debe reflejar este propósito de síntesis/aplicación.' : ''}
${unitContext.isExtraSlot ? `- Esta es una clase ADICIONAL más allá de la secuencia original (clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Úsala preferentemente para repaso guiado, actividades integradoras, evaluación formativa o un proyecto aplicado. El título debe reflejar claramente este propósito (ej: "Repaso Integrador", "Proyecto Aplicado", "Evaluación Formativa").` : ''}

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

6. The title H1 MUST be exactly this sessionBrief, word for word, without reformulation or interpretation.

CRITICAL: This sessionBrief is a TEACHER OVERRIDE that takes absolute priority over generic ANEP content wording.
- The entire lesson structure must serve this specific focus.
- Do NOT generate a generic lesson and then try to fit the sessionBrief into it.
- Generate the lesson AROUND the sessionBrief from the start.

` : '';

    // PHASE 3 (Profile Usage): Build group profile and student adjustments section
    const groupProfileSection = perfilGrupo || (estudiantes && estudiantes.length > 0) ? `
PERFIL DEL GRUPO Y AJUSTES DE ESTUDIANTES:
${perfilGrupo ? `
Composición del grupo:
- Total de estudiantes: ${perfilGrupo.tamanio || 'no especificado'}
- Estilo de aprendizaje dominante: ${perfilGrupo.dominante || 'mixto'}
${perfilGrupo.distribucion ? `- Distribución de estilos de aprendizaje:
${Object.entries(perfilGrupo.distribucion).map(([estilo, count]) => `  * ${estilo}: ${count} estudiante(s)`).join('\n')}` : ''}
` : ''}
${estudiantes && estudiantes.length > 0 ? `
Estudiantes con ajustes específicos (${estudiantes.filter((e: any) => e.ajustes || (e.contemplaciones && e.contemplaciones.length > 0)).length}):
${estudiantes
  .filter((e: any) => e.ajustes || (e.contemplaciones && e.contemplaciones.length > 0))
  .map((e: any, idx: number) => `
  Estudiante ${String.fromCharCode(65 + idx)} (${e.perfil || 'No especificado'}):
  - Ajustes: ${e.ajustes || 'Ninguno especificado'}
  ${e.contemplaciones && e.contemplaciones.length > 0 ? `- Contemplaciones específicas:
${e.contemplaciones.map((c: string) => `    * ${c}`).join('\n')}` : ''}
`).join('\n')}
` : ''}

REGLAS PEDAGÓGICAS OBLIGATORIAS (USO ACTIVO):
Regla A — Evidencia Dentro de las Actividades:
- La sección DESARROLLO DEBE incluir AL MENOS DOS decisiones pedagógicas explícitas derivadas del perfil del grupo o de los ajustes de estudiantes.
- Ejemplo: "Estudiantes visuales: actividad dividida en dos bloques de 7 minutos con checklist visual paso a paso"
- Ejemplo: "Estudiantes kinestésicos: materiales manipulables para explorar el concepto"
- Evitar frases genéricas como "considerar estilos de aprendizaje" — las decisiones deben ser CONCRETAS y OBSERVABLES.

Regla B — Ajustes de Estudiantes:
${estudiantes && estudiantes.filter((e: any) => e.contemplaciones && e.contemplaciones.length > 0).length > 0 ? `- Dado que ${estudiantes.filter((e: any) => e.contemplaciones && e.contemplaciones.length > 0).length} estudiante(s) tienen contemplaciones específicas, la sección "Diferenciación/Adaptaciones" DEBE incluir AL MENOS TRES adaptaciones concretas y accionables.
- Cada adaptación DEBE especificar:
  * <strong>Momento:</strong> Momento exacto (Inicio/Desarrollo/Cierre + actividad específica)
  * <strong>Perfil/Necesidad:</strong> Qué perfil de estudiante o necesidad atiende
  * <strong>Propósito:</strong> Qué facilita o mejora
  * <strong>Cómo aplicarla:</strong> Instrucciones concretas y prácticas (no vagas)
- NO inventar diagnósticos o condiciones. Usar lenguaje: apoyos, andamiaje, acceso, opciones de representación, opciones de expresión.
` : '- Incluir al menos UNA adaptación general basada en UDL en "Diferenciación/Adaptaciones".'}

Regla C — Sin Estereotipos o Diagnósticos Inventados:
- NO inventar diagnósticos, condiciones o etiquetas que no estén presentes en los datos de estudiantes.
- Usar lenguaje respetuoso, alineado con DUA: apoyos, andamiaje, múltiples medios de representación/expresión/participación.
- Si el perfil del grupo es mixto o la información es limitada, aplicar principios básicos de DUA sin asumir déficits.

Regla D — No Forzar Contenido:
- Si NO hay perfil de grupo Y NO hay ajustes de estudiantes, NO agregar personalización artificial.
- Mantener compatibilidad hacia atrás: salida idéntica al comportamiento anterior.

` : '';

    // PHASE 2: Construir sección de instrucciones del docente con contexto adicional
    const instruccionesDocenteSection = instruccionesDocente ? `
INSTRUCCIONES DEL DOCENTE:
${instruccionesDocente}

Estas instrucciones pueden:
- Aplicar a toda la planificación
- Aplicar solo a algunas clases
- Indicar temas específicos para una clase puntual

Respeta explícitamente estas indicaciones si están presentes.
No inventes una secuencia distinta si el docente ya la definió.

` : '';

    // FIX: Build materials section with special instructions for materials-only generation
    const hasAnepContent = Array.isArray(contenidos) ? contenidos.length > 0 && contenidos.some((c: any) => c && c.trim()) : contenidos && String(contenidos).trim();
    const hasMaterials = materialsContext && materialsContext.trim().length > 0;
    
    const materialsSection = hasMaterials ? `
${materialsContext}

${!hasAnepContent ? `
⚠️ MODO MATERIALES-ONLY (SIN ANEP):
NO hay contenido ANEP especificado. Los materiales docentes adjuntos son la ÚNICA fuente de contenido.

REGLAS CRÍTICAS PARA MATERIALES-ONLY:
1. El contenido del plan DEBE basarse EXCLUSIVAMENTE en el texto extraído de los PDFs proporcionados.
2. NO uses plantillas genéricas ni contenido de relleno.
3. DEBES incluir conceptos, vocabulario, eventos, nombres y detalles ESPECÍFICOS del material.
4. Si el material menciona "Batllismo", "Batlle", "reformas sociales", etc., el plan DEBE usar esos términos exactos.
5. Si el material describe eventos históricos, personajes, o procesos, el plan DEBE referenciarlos específicamente.
6. Las actividades DEBEN trabajar con el contenido real del material, no con abstracciones genéricas.
7. Las preguntas guía DEBEN referenciar conceptos específicos del material.
8. El título H1 DEBE reflejar el tema específico del material, no un título genérico.

EJEMPLO INCORRECTO (genérico):
- "Análisis de un período histórico"
- "Discusión sobre reformas"
- "Actividad de comprensión lectora"

EJEMPLO CORRECTO (específico del material):
- "El Batllismo y las reformas sociales de José Batlle y Ordóñez"
- "Análisis del texto sobre la Ley de 8 horas"
- "Debate sobre el impacto de las reformas batllistas en la sociedad uruguaya"

Si el material no tiene suficiente contenido extraído, indica esto claramente en el plan.
` : `
Los materiales docentes son complementarios al contenido ANEP. Úsalos para enriquecer y contextualizar, pero el contenido ANEP sigue siendo la base principal.
`}
` : '';

    const prompt = `
Sos un asistente pedagógico experto en planificación de clases para el sistema educativo uruguayo (ANEP).
${modo === 'regenerar' ? 'Modificá' : 'Generá'} el plan de la sesión ${orden} con duración ${duracionMin} minutos.

CONTEXTO DE LA CLASE:
- Materia: ${materia || 'Sin especificar'}
- Nivel: ${nivel || 'Sin especificar'}
- Contenidos ANEP (macro): ${Array.isArray(contenidos) ? contenidos.join(', ') : contenidos || 'Sin especificar'}
- Competencias: ${Array.isArray(competencias) ? competencias.join(', ') : competencias || 'Sin especificar'}
- Criterios de logro: ${Array.isArray(criterios) ? criterios.join(', ') : criterios || 'Sin especificar'}
${sessionBriefSection}${secuenciaContext}${groupProfileSection}${instruccionesDocenteSection}${materialsSection}${planActual ? `\nPLAN ACTUAL A MODIFICAR:\n${planActual}` : ''}

ESTRUCTURA OBLIGATORIA - DEVOLVER SOLO HTML VÁLIDO:
<section id="plan">
  <h1>${sessionBrief?.trim() || 'Título específico y claro de esta clase (debe ser diferente de otras clases en la misma unidad)'}</h1>

  <h2><strong>Inicio (15 min)</strong></h2>
  <h3>Actividad de apertura motivadora</h3>
  <p><strong>Actividad:</strong> Descripción específica de la actividad de inicio</p>
  <ul>
    <li>Paso detallado 1</li>
    <li>Paso detallado 2</li>
    <li>Paso detallado 3</li>
  </ul>
  <p><strong>Recursos:</strong> Lista de recursos específicos</p>

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

  <h2><strong>Diferenciación/Adaptaciones</strong></h2>
  <ul>
    <li><strong>Momento:</strong> Inicio - durante la actividad de apertura<br>
        <strong>Perfil/Necesidad:</strong> Estudiantes con dificultades de atención<br>
        <strong>Propósito:</strong> Facilitar la participación activa desde el inicio de la clase<br>
        <strong>Cómo aplicarla:</strong> Proporcionar apoyos visuales (imágenes claras) y permitir respuestas orales además de escritas</li>
    <li><strong>Momento:</strong> Desarrollo - durante el trabajo grupal<br>
        <strong>Perfil/Necesidad:</strong> Estudiantes con necesidades de adaptación curricular<br>
        <strong>Propósito:</strong> Garantizar acceso al contenido principal<br>
        <strong>Cómo aplicarla:</strong> Organizar grupos heterogéneos, asignar roles claros y proporcionar guías paso a paso con ejemplos</li>
    <li><strong>Momento:</strong> Cierre - durante la síntesis<br>
        <strong>Perfil/Necesidad:</strong> Estudiantes con dificultades de expresión escrita<br>
        <strong>Propósito:</strong> Permitir demostración de comprensión por múltiples vías<br>
        <strong>Cómo aplicarla:</strong> Aceptar síntesis mediante dibujos, mapas conceptuales o exposición oral además de textos escritos</li>
  </ul>
</section>

REQUISITOS ESTRICTOS:
1. Usar SOLO HTML válido - NO Markdown, NO code fences
2. NUNCA incluir "Diferenciación/Adaptaciones" dentro de las secciones Inicio, Desarrollo o Cierre
3. Incluir SIEMPRE: <strong>Actividad:</strong> y <strong>Recursos:</strong> en cada sección principal
4. Adaptar duraciones según el tiempo total (${duracionMin} min)
5. Incluir actividades específicas y detalladas
${sessionBrief?.trim() ? '6. OBLIGATORIO CRÍTICO: El título H1 DEBE SER EXACTAMENTE el sessionBrief proporcionado, palabra por palabra, sin ninguna modificación, reformulación ni interpretación. Este es un override del docente que tiene prioridad absoluta.' : '6. OBLIGATORIO: El título H1 debe ser específico y diferente de otras clases en la misma unidad. No reutilices títulos de otras clases.'}
7. OBLIGATORIO: Los títulos H2 de Inicio, Desarrollo y Cierre DEBEN tener <strong> dentro del H2
8. EJEMPLO CORRECTO: <h2><strong>Inicio (15 min)</strong></h2>
9. EJEMPLO INCORRECTO: <h2>Inicio (15 min)</h2>
10. OBLIGATORIO: La sección "Diferenciación/Adaptaciones" DEBE aparecer DESPUÉS de Cierre, al final del plan
11. Cada adaptación DEBE incluir:
    - <strong>Momento:</strong> Indica exactamente cuándo aplicar (Inicio/Desarrollo/Cierre y actividad específica)
    - <strong>Perfil/Necesidad:</strong> Para qué perfil de estudiante o necesidad está dirigida
    - <strong>Propósito:</strong> Qué mejora o facilita esta adaptación
    - <strong>Cómo aplicarla:</strong> Instrucciones concretas y prácticas, no vagas

DEVOLVER JSON EXACTO:
{
  "plan_html": "<section id=\\"plan\\">...</section>",
  "argumento_competencias": "<p>Explicación de cómo las actividades desarrollan las competencias seleccionadas</p>",
  "recursos": ["Proyector", "Pizarrón", "Marcadores", "Material específico"],
  "titulo": "${sessionBrief?.trim() || 'Título extraído del H1 generado'}",
  "ai_design_report": {
    "inputsUsed": {
      "anepContent": ${hasAnepContent ? 'true' : 'false'},
      "materials": ${hasMaterials ? 'true' : 'false'},
      "sessionBrief": ${sessionBrief?.trim() ? 'true' : 'false'},
      "unitContext": ${unitContext ? 'true' : 'false'}
    },
    "decisions": {
      "structure": "Estructura estándar: Inicio-Desarrollo-Cierre con adaptaciones",
      "timeAllocation": "Distribución de tiempo según duración total (${duracionMin} min)"
    },
    "assumptions": [
      "Estudiantes tienen conocimientos previos básicos del tema",
      "Recursos básicos disponibles (pizarra, proyector)"
    ]
  }
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
        recursos: [],
        ai_design_report: null // FIX: Include ai_design_report even in fallback
      };
    }
    
    // FIX: Ensure ai_design_report exists (add if missing)
    if (!parsed.ai_design_report) {
      parsed.ai_design_report = {
        inputsUsed: {
          anepContent: !!hasAnepContent,
          materials: hasMaterials,
          sessionBrief: !!sessionBrief?.trim(),
          unitContext: !!unitContext
        },
        decisions: {
          structure: 'Estructura estándar: Inicio-Desarrollo-Cierre',
          timeAllocation: `Distribución según duración total (${duracionMin} min)`
        },
        assumptions: [
          'Estudiantes tienen conocimientos previos básicos',
          'Recursos básicos disponibles'
        ]
      };
      console.log('[FIX] Added default ai_design_report to planning response');
    } else {
      console.log('[FIX] ai_design_report found in AI response:', Object.keys(parsed.ai_design_report || {}));
    }

    // Extract title from HTML (either from parsed JSON or from sessionBrief)
    // Priority: 1) sessionBrief (teacher override), 2) Extract H1 from generated HTML
    let extractedTitle = sessionBrief?.trim();
    if (!extractedTitle && parsed.plan_html) {
      // Extract H1 from HTML
      const h1Match = parsed.plan_html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      if (h1Match && h1Match[1]) {
        extractedTitle = h1Match[1].trim();
      }
    }
    
    // Add titulo to response if not already present
    if (extractedTitle && !parsed.titulo) {
      parsed.titulo = extractedTitle;
      console.log('[generate-plan-completo] Extracted title:', extractedTitle);
    }

    // PHASE 3.2.1: Verify sessionBrief is reflected in generated content
    if (sessionBrief?.trim()) {
      const briefInContent = parsed.plan_html?.toLowerCase().includes(sessionBrief.trim().toLowerCase());
      console.log(`[SESSION_BRIEF] Verificación: sessionBrief "${sessionBrief.trim()}" ${briefInContent ? 'ENCONTRADO' : 'NO ENCONTRADO'} en HTML generado`);
      if (!briefInContent) {
        console.warn(`[SESSION_BRIEF] ADVERTENCIA: El sessionBrief no aparece explícitamente en el contenido generado. Revisar prompt.`);
      }
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

  <h2><strong>Diferenciación/Adaptaciones</strong></h2>
  <ul>
    <li><strong>Momento:</strong> Inicio - durante la actividad de apertura<br>
        <strong>Perfil/Necesidad:</strong> Estudiantes con dificultades de atención<br>
        <strong>Propósito:</strong> Facilitar la participación activa desde el inicio<br>
        <strong>Cómo aplicarla:</strong> Proporcionar apoyos visuales (imágenes claras) y permitir respuestas orales además de escritas</li>
    <li><strong>Momento:</strong> Desarrollo - durante el trabajo grupal<br>
        <strong>Perfil/Necesidad:</strong> Estudiantes con necesidades de adaptación curricular<br>
        <strong>Propósito:</strong> Garantizar acceso al contenido principal<br>
        <strong>Cómo aplicarla:</strong> Organizar grupos heterogéneos, asignar roles claros y proporcionar guías paso a paso</li>
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
