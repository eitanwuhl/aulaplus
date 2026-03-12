import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Safe CORS headers - defined at top level (no side effects)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400', // 24 hours
};

// Safe env read - wrapped to prevent boot failure
function getOpenAIApiKey(): string | undefined {
  try {
    return Deno.env.get('OPENAI_API_KEY') || undefined;
  } catch {
    return undefined;
  }
}

function extractMaterialSummary(materialsContext?: string): {
  themes: string[];
  concepts: string[];
  vocabulary: string[];
} {
  if (!materialsContext || !materialsContext.trim()) {
    return { themes: [], concepts: [], vocabulary: [] };
  }

  const cleaned = materialsContext
    .replace(/[#*_`>]/g, " ")
    .split("\n")
    .map((line) => line.replace(/^[\s\-•\d\.\)\(]+/, "").trim())
    .filter((line) => line.length >= 12);

  const uniqueLines: string[] = [];
  const seen = new Set<string>();
  for (const line of cleaned) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueLines.push(line);
    }
  }

  const themes = uniqueLines.slice(0, 6);
  const concepts = uniqueLines.slice(0, 10).map((line) => {
    const firstChunk = line.split(/[,:;.!?]/)[0].trim();
    return firstChunk.length > 0 ? firstChunk : line;
  });
  const vocabulary = concepts
    .flatMap((item) => item.split(/\s+/))
    .map((t) => t.trim())
    .filter((t) => t.length >= 5 && /^[A-Za-zÁÉÍÓÚáéíóúÑñüÜ-]+$/.test(t))
    .slice(0, 20);

  return { themes, concepts, vocabulary };
}

import { filterMaterialPassages } from "./passageQualityFilter.ts";

function partitionArray<T>(items: T[], bucketCount: number): T[][] {
  if (bucketCount <= 1) return [items];
  const safeCount = Math.max(1, bucketCount);
  const output: T[][] = Array.from({ length: safeCount }, () => []);
  items.forEach((item, idx) => {
    output[idx % safeCount].push(item);
  });
  return output;
}

/**
 * TASK C: Build coverage plan for multi-session coherence
 * Divides materials/ANEP content across sessions with coherent progression
 */
function buildCoveragePlan(
  totalSessions: number,
  materialsContext: string | undefined,
  contenidos: any,
  unitContext?: any
): Array<{
  sessionNumber: number;
  contentFocus: string;
  materialSegment?: string;
  anepItems?: string[];
  rationale: string;
}> {
  const plan: Array<{
    sessionNumber: number;
    contentFocus: string;
    materialSegment?: string;
    anepItems?: string[];
    rationale: string;
  }> = [];
  
  // Extract content items
  const anepItems = Array.isArray(contenidos) ? contenidos.filter((c: any) => c && String(c).trim()) : [];
  const hasMaterials = materialsContext && materialsContext.trim().length > 0;
  const materialSummary = extractMaterialSummary(materialsContext);
  const segmentedThemes = partitionArray(materialSummary.themes, Math.max(1, totalSessions));
  
  for (let i = 1; i <= totalSessions; i++) {
    const isFirst = i === 1;
    const isLast = i === totalSessions;
    const isMiddle = !isFirst && !isLast;
    
    let contentFocus = '';
    let materialSegment: string | undefined;
    let anepItemsForSession: string[] | undefined;
    let rationale = '';
    
    if (hasMaterials) {
      // Divide material across sessions using extracted summary (if available)
      const sessionThemes = segmentedThemes[i - 1] || [];
      const thematicChunk = sessionThemes.length > 0
        ? sessionThemes.join('; ')
        : undefined;

      if (isFirst) {
        materialSegment = thematicChunk || 'Primera parte del material (introducción y conceptos base)';
        contentFocus = thematicChunk
          ? `Introducción guiada de: ${thematicChunk}`
          : 'Introducción a los conceptos fundamentales del material proporcionado';
        rationale = 'Esta sesión introduce conceptos base del material para construir lenguaje común y contexto histórico-conceptual antes de profundizar.';
      } else if (isMiddle) {
        materialSegment = thematicChunk || `Parte intermedia del material (profundización, sesión ${i} de ${totalSessions})`;
        contentFocus = thematicChunk
          ? `Profundización y análisis de: ${thematicChunk}`
          : `Profundización en conceptos intermedios del material, continuando desde la sesión anterior`;
        rationale = `Esta sesión profundiza y compara ideas ya iniciadas, retomando lo trabajado y elevando la complejidad de análisis para sostener continuidad.`;
      } else {
        materialSegment = thematicChunk || 'Parte final del material (integración y síntesis)';
        contentFocus = thematicChunk
          ? `Integración, debate y transferencia sobre: ${thematicChunk}`
          : 'Integración y síntesis de todo el material trabajado en las sesiones anteriores';
        rationale = 'Esta sesión cierra la secuencia integrando conceptos previos para producir síntesis, argumentación y transferencia a nuevas situaciones.';
      }
    }
    
    if (anepItems.length > 0) {
      // Distribute ANEP items across sessions
      const itemsPerSession = Math.ceil(anepItems.length / totalSessions);
      const startIdx = (i - 1) * itemsPerSession;
      const endIdx = Math.min(startIdx + itemsPerSession, anepItems.length);
      anepItemsForSession = anepItems.slice(startIdx, endIdx);
      
      if (!contentFocus) {
        contentFocus = anepItemsForSession.join(', ');
      } else {
        contentFocus += `; ${anepItemsForSession.join(', ')}`;
      }
      
      if (!rationale) {
        rationale = `Estos contenidos ANEP fueron seleccionados para esta sesión porque ${isFirst ? 'establecen la base conceptual' : isLast ? 'permiten la integración y síntesis' : 'profundizan en conceptos ya introducidos'}.`;
      }
    }
    
    if (!contentFocus) {
      contentFocus = `Contenido de la sesión ${i}`;
      rationale = `Contenido inferido de la estructura del plan generado para esta sesión.`;
    }
    
    plan.push({
      sessionNumber: i,
      contentFocus,
      materialSegment,
      anepItems: anepItemsForSession,
      rationale
    });
  }
  
  return plan;
}

/**
 * Strip debug/markdown/JSON from plan_html so it contains only HTML suitable for rendering the class plan.
 * Removes: ### AI Design Report, ```json ... ```, ``` ... ```, and any trailing content after </section>.
 */
function stripDebugFromPlanHtml(html: string): string {
  if (!html || typeof html !== 'string') return html;
  let out = html.trim();
  // Remove markdown section headers and JSON/code blocks (model sometimes embeds report here)
  out = out.replace(/\n?\s*###\s*AI Design Report\s*\n?/gi, '\n');
  out = out.replace(/\n?\s*```json\s*[\s\S]*?```\s*/gi, '\n');
  out = out.replace(/\n?\s*```\s*[\s\S]*?```\s*/gi, '\n');
  // Keep only the plan section: from <section id="plan"> to the matching </section>
  const sectionStart = out.indexOf('<section id="plan">');
  if (sectionStart !== -1) {
    const afterStart = out.slice(sectionStart);
    const closeTag = afterStart.indexOf('</section>');
    if (closeTag !== -1) {
      out = afterStart.slice(0, closeTag + '</section>'.length);
    }
  }
  // Final pass: remove any remaining ``` fences (in case of malformed or nested blocks)
  if (out.includes('```')) {
    out = out.replace(/\s*```[a-z]*\s*[\s\S]*?```\s*/gi, '\n').trim();
  }
  return out.trim() || html;
}

/** Section headings that must NOT appear in teacher-facing narrative. */
const FORBIDDEN_NARRATIVE_HEADINGS = [
  'Propósito y foco',
  'Secuencia didáctica',
  'Competencias',
  'Evidencia esperada',
  'Materiales y fuentes',
];

/** Strip forbidden section headings and their content, then HTML/whitespace. */
function stripForbiddenNarrativeSectionsBackend(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let out = text;
  for (const heading of FORBIDDEN_NARRATIVE_HEADINGS) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:\\*\\*${escaped}\\*\\*|${escaped})\\s*[\\n\\r]+[^\\n\\r]*(?=[\\n\\r]|$)`, 'gi');
    out = out.replace(re, '\n\n');
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Strip HTML and prompt-instruction leakage from narrative for teacher-facing output. */
function sanitizeReportNarrative(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const noSections = stripForbiddenNarrativeSectionsBackend(text);
  return noSections
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toTeacherSafeAiDesignReport(report: Record<string, unknown> | undefined, cleanNarrative: string): Record<string, unknown> {
  const source = report || {};
  const safe: Record<string, unknown> = {
    narrative: cleanNarrative,
    report_narrative: cleanNarrative,
  };
  const allowlist = [
    'inputsUsed',
    'decisions',
    'contentCoverage',
    'competencyDevelopment',
    'teacherRequirementsApplied',
    'standardsCoverage',
    'competenciesOperationalization',
    'sessionsGenerated',
  ];
  for (const key of allowlist) {
    if (source[key] !== undefined) safe[key] = source[key];
  }
  return safe;
}

/**
 * Build contentCoverage array from available data
 */
function buildContentCoverage(
  contenidos: any,
  materialsContext: string | undefined,
  unitContext: any,
  sessionBrief: string | undefined,
  orden: number,
  hasAnepContent: boolean,
  hasMaterials: boolean
): Array<{
  sourceType: 'uploaded_material' | 'ANEP' | 'teacher_requirements' | 'inferred';
  sourceId?: string;
  coveredPart: string;
  whyThisPartInThisClass: string;
  howItIsWorked: string;
  assessmentOrEvidence: string;
  relatedCompetencies: string[];
}> {
  const coverage: Array<{
    sourceType: 'uploaded_material' | 'ANEP' | 'teacher_requirements' | 'inferred';
    sourceId?: string;
    coveredPart: string;
    whyThisPartInThisClass: string;
    howItIsWorked: string;
    assessmentOrEvidence: string;
    relatedCompetencies: string[];
  }> = [];
  
  // Determine source type
  let sourceType: 'uploaded_material' | 'ANEP' | 'teacher_requirements' | 'inferred' = 'inferred';
  if (hasMaterials && materialsContext) {
    sourceType = 'uploaded_material';
  } else if (hasAnepContent) {
    sourceType = 'ANEP';
  } else if (sessionBrief?.trim()) {
    sourceType = 'teacher_requirements';
  }
  
  // Extract content focuses
  if (Array.isArray(contenidos) && contenidos.length > 0) {
    // Use provided ANEP contents
    contenidos.slice(0, 3).forEach((content, idx) => {
      const isFirstClass = unitContext?.claseEnUnidad === 1;
      const isLastClass = unitContext?.claseEnUnidad === unitContext?.totalClasesUnidad;
      const isIntermediate = !isFirstClass && !isLastClass;
      
      let whyThisPart = '';
      if (isFirstClass) {
        whyThisPart = `Esta es la primera clase de la unidad "${unitContext?.contenido || 'la unidad'}", por lo que se introduce este contenido como base fundamental. Las clases siguientes construirán sobre estos conceptos iniciales.`;
      } else if (isIntermediate) {
        whyThisPart = `Esta clase (${unitContext?.claseEnUnidad} de ${unitContext?.totalClasesUnidad}) profundiza en este contenido como continuación lógica de las clases anteriores. Se asume que los estudiantes ya trabajaron los contenidos introductorios en sesiones previas, permitiendo mayor profundización aquí.`;
      } else if (isLastClass) {
        whyThisPart = `Esta es la última clase de la unidad, por lo que se integra y sintetiza este contenido con todos los trabajados en las ${unitContext?.totalClasesUnidad - 1} clases anteriores. Se busca consolidación y transferencia del aprendizaje.`;
      } else {
        whyThisPart = `Este contenido se trabaja en esta clase como parte de la secuencia didáctica de la unidad.`;
      }
      
      // Add continuity mention if not first class
      if (!isFirstClass && unitContext) {
        whyThisPart += ` Hay continuidad explícita con las clases anteriores de la unidad.`;
      }
      
      coverage.push({
        sourceType: hasAnepContent ? 'ANEP' : sourceType,
        coveredPart: String(content),
        whyThisPartInThisClass: whyThisPart,
        howItIsWorked: `Se trabaja mediante actividades de Inicio (activación de conocimientos previos), Desarrollo (exploración y construcción del conocimiento) y Cierre (síntesis y reflexión).`,
        assessmentOrEvidence: `Se evidencia mediante participación activa, respuestas a preguntas guía, trabajo colaborativo y síntesis final.`,
        relatedCompetencies: []
      });
    });
  } else if (sessionBrief?.trim()) {
    // Use sessionBrief as content focus
    const isFirstClass = unitContext?.claseEnUnidad === 1;
    const isLastClass = unitContext?.claseEnUnidad === unitContext?.totalClasesUnidad;
    
    let whyThisPart = `Este contenido fue especificado por el docente como enfoque específico de esta sesión.`;
    if (unitContext) {
      if (isFirstClass) {
        whyThisPart += ` Como es la primera clase de la unidad, este tema se introduce como base.`;
      } else if (isLastClass) {
        whyThisPart += ` Como es la última clase de la unidad, este tema se integra con los trabajados anteriormente.`;
      } else {
        whyThisPart += ` Esta clase profundiza en este tema como parte de la secuencia de la unidad (clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}).`;
      }
    }
    
    coverage.push({
      sourceType: 'teacher_requirements',
      coveredPart: sessionBrief.trim(),
      whyThisPartInThisClass: whyThisPart,
      howItIsWorked: `Se trabaja mediante actividades específicas orientadas al tema "${sessionBrief.trim()}" en las secciones de Inicio, Desarrollo y Cierre.`,
      assessmentOrEvidence: `Se evidencia mediante la participación y respuestas específicas relacionadas con "${sessionBrief.trim()}".`,
      relatedCompetencies: []
    });
  } else {
    // Inferred from generated plan
    coverage.push({
      sourceType: 'inferred',
      coveredPart: `Contenido inferido de las secciones y actividades generadas para esta clase`,
      whyThisPartInThisClass: `No se proporcionaron materiales fuente, contenidos ANEP o requerimientos específicos del docente, por lo que el contenido se infirió de la estructura del plan generado.`,
      howItIsWorked: `Se trabaja mediante las actividades propuestas en las secciones de Inicio, Desarrollo y Cierre del plan.`,
      assessmentOrEvidence: `Se evidencia mediante la participación y trabajo realizado en las actividades propuestas.`,
      relatedCompetencies: []
    });
  }
  
  return coverage;
}

/**
 * Build standardsCoverage array from available data (GOAL C)
 */
function buildStandardsCoverage(
  contenidos: any,
  competencias: any,
  orden: number,
  unitContext?: any
): Array<{
  standard: string;
  whyPrioritized: string;
  howCovered: string;
  evidence: string;
}> {
  const coverage: Array<{
    standard: string;
    whyPrioritized: string;
    howCovered: string;
    evidence: string;
  }> = [];
  
  if (Array.isArray(contenidos) && contenidos.length > 0) {
    contenidos.slice(0, 3).forEach((content) => {
      const isFirstClass = unitContext?.claseEnUnidad === 1;
      const isLastClass = unitContext?.claseEnUnidad === unitContext?.totalClasesUnidad;
      
      let whyPrioritized = '';
      if (isFirstClass) {
        whyPrioritized = `Este contenido se priorizó porque es fundamental para establecer la base conceptual de la unidad. Las competencias seleccionadas requieren este conocimiento previo.`;
      } else if (isLastClass) {
        whyPrioritized = `Este contenido se priorizó para integrar y sintetizar todos los aprendizajes de la unidad, permitiendo la transferencia de competencias.`;
      } else {
        whyPrioritized = `Este contenido se priorizó porque profundiza en conceptos ya introducidos, permitiendo mayor complejidad en el desarrollo de competencias.`;
      }
      
      coverage.push({
        standard: String(content),
        whyPrioritized: whyPrioritized,
        howCovered: `Se cubre mediante actividades de Inicio (activación), Desarrollo (construcción del conocimiento) y Cierre (síntesis), integrado con las competencias seleccionadas.`,
        evidence: `Se evidencia mediante participación activa, respuestas a preguntas guía, trabajo colaborativo y síntesis final que demuestra comprensión del contenido.`
      });
    });
  }
  
  return coverage;
}

/**
 * Build competenciesOperationalization array from available data (GOAL C)
 */
function buildCompetenciesOperationalization(
  competencias: any,
  planHtml: string
): Array<{
  competency: string;
  concreteDevelopment: string;
  specificActivities: string[];
  learningEvidence: string;
}> {
  const operationalization: Array<{
    competency: string;
    concreteDevelopment: string;
    specificActivities: string[];
    learningEvidence: string;
  }> = [];
  
  if (Array.isArray(competencias) && competencias.length > 0) {
    competencias.slice(0, 4).forEach((competency) => {
      // Extract activities from HTML if available
      const activities: string[] = [];
      if (planHtml) {
        const inicioMatch = planHtml.match(/<h2[^>]*>.*?Inicio.*?<\/h2>/i);
        const desarrolloMatch = planHtml.match(/<h2[^>]*>.*?Desarrollo.*?<\/h2>/i);
        if (inicioMatch) activities.push('Actividades de Inicio');
        if (desarrolloMatch) activities.push('Actividades de Desarrollo');
      }
      
      operationalization.push({
        competency: String(competency),
        concreteDevelopment: `Esta competencia se desarrolla mediante actividades específicas que requieren la aplicación práctica de conocimientos, análisis crítico y construcción colaborativa. Las actividades están diseñadas para ejercitar habilidades específicas de esta competencia.`,
        specificActivities: activities.length > 0 ? activities : ['Actividades del plan generado'],
        learningEvidence: `Se evidencia mediante la participación activa, respuestas que demuestran comprensión, trabajo colaborativo efectivo y síntesis que muestra transferencia del aprendizaje.`
      });
    });
  }
  
  return operationalization;
}

/**
 * Build competencyDevelopment array from available data
 */
function buildCompetencyDevelopment(
  competencias: any,
  planHtml: string
): Array<{
  competency: string;
  howDevelopedInThisClass: string;
  linkedActivities: string[];
}> {
  const development: Array<{
    competency: string;
    howDevelopedInThisClass: string;
    linkedActivities: string[];
  }> = [];
  
  if (Array.isArray(competencias) && competencias.length > 0) {
    competencias.forEach((comp: string) => {
      // Extract activity hints from HTML (simplified)
      const activities: string[] = [];
      if (planHtml) {
        const h3Matches = planHtml.match(/<h3[^>]*>(.*?)<\/h3>/gi);
        if (h3Matches) {
          activities.push(...h3Matches.slice(0, 3).map(m => m.replace(/<[^>]*>/g, '').trim()));
        }
      }
      
      // Try to extract more specific activities from HTML
      const specificActivities: string[] = [];
      if (planHtml) {
        // Extract H3 headings (activity titles)
        const h3Matches = planHtml.match(/<h3[^>]*>(.*?)<\/h3>/gi);
        if (h3Matches) {
          specificActivities.push(...h3Matches.slice(0, 5).map(m => m.replace(/<[^>]*>/g, '').trim()));
        }
        // If no H3, try to extract from list items in Development section
        if (specificActivities.length === 0) {
          const developmentMatch = planHtml.match(/<h2[^>]*>.*?Desarrollo.*?<\/h2>(.*?)(?=<h2|$)/is);
          if (developmentMatch) {
            const liMatches = developmentMatch[1].match(/<li[^>]*>(.*?)<\/li>/gi);
            if (liMatches) {
              specificActivities.push(...liMatches.slice(0, 3).map(m => m.replace(/<[^>]*>/g, '').trim()));
            }
          }
        }
      }
      
      development.push({
        competency: String(comp),
        howDevelopedInThisClass: `Se desarrolla mediante actividades de exploración, construcción colaborativa y aplicación práctica del conocimiento relacionado con esta competencia. Las actividades propuestas permiten que los estudiantes ejerciten habilidades específicas de esta competencia a través de la participación activa y el trabajo colaborativo.`,
        linkedActivities: specificActivities.length > 0 ? specificActivities : (activities.length > 0 ? activities : ['Actividades de Inicio', 'Actividades de Desarrollo', 'Actividades de Cierre'])
      });
    });
  }
  
  return development;
}

/**
 * Build teacherRequirementsApplied array from available data
 */
function buildTeacherRequirementsApplied(
  instruccionesDocente: string | undefined,
  sessionBrief: string | undefined
): Array<{
  requirement: string;
  howItWasSatisfied: string;
}> {
  const applied: Array<{
    requirement: string;
    howItWasSatisfied: string;
  }> = [];
  
  if (sessionBrief?.trim()) {
    applied.push({
      requirement: `Enfoque específico: "${sessionBrief.trim()}"`,
      howItWasSatisfied: `El plan está estructurado alrededor de este tema, con todas las actividades (Inicio, Desarrollo, Cierre) orientadas específicamente hacia "${sessionBrief.trim()}". El título de la clase refleja este enfoque.`
    });
  }
  
  if (instruccionesDocente?.trim()) {
    // Extract key requirements from instructions (simplified)
    const instructions = instruccionesDocente.trim();
    if (instructions.length > 0) {
      applied.push({
        requirement: `Instrucciones del docente: ${instructions.substring(0, 100)}${instructions.length > 100 ? '...' : ''}`,
        howItWasSatisfied: `Las instrucciones fueron consideradas en el diseño de las actividades y la estructura del plan, adaptando el contenido y metodología según las indicaciones proporcionadas.`
      });
    }
  }
  
  return applied;
}

function buildTeacherReportNarrative(params: {
  maybeNarrative: unknown;
  orden: number;
  totalSessions: number;
  duracionMin: number;
  materia?: string;
  nivel?: string;
  sessionCoverage?: { contentFocus?: string; rationale?: string; materialSegment?: string };
  competencies: string[];
  teacherRequirements: string[];
  hasAnepContent: boolean;
  hasMaterials: boolean;
}): string {
  // Use model narrative when present and substantial (>= 200 chars); avoid overwriting with generic fallback
  if (typeof params.maybeNarrative === "string" && params.maybeNarrative.trim().length >= 200) {
    return params.maybeNarrative.trim();
  }

  const continuidad = params.totalSessions > 1
    ? (params.orden === 1
      ? "Esta primera sesión instala las bases para las clases siguientes."
      : params.orden === params.totalSessions
        ? "Esta sesión cierra la secuencia integrando lo trabajado en las clases anteriores."
        : `Esta sesión retoma lo ya trabajado y prepara la continuidad hacia la sesión ${params.orden + 1}.`)
    : "Esta sesión funciona como una clase completa en sí misma.";

  const foco = params.sessionCoverage?.contentFocus || "el contenido previsto para la clase";
  const justificacion = params.sessionCoverage?.rationale || "se priorizó por su relevancia para la progresión didáctica de la unidad.";
  const segmento = params.sessionCoverage?.materialSegment ? `Se trabajó especialmente ${params.sessionCoverage.materialSegment}. ` : "";
  const compText = params.competencies.length > 0
    ? `Las competencias priorizadas fueron ${params.competencies.slice(0, 4).join(", ")}.`
    : "No se informaron competencias específicas para esta sesión, por lo que se priorizó comprensión conceptual y producción guiada.";
  const reqText = params.teacherRequirements.length > 0
    ? `Se atendieron requerimientos docentes concretos: ${params.teacherRequirements.slice(0, 2).join(" | ")}.`
    : "No se recibieron requerimientos docentes adicionales para esta sesión.";
  const ageGuidance = params.nivel
    ? `Se cuidó que la profundidad y el lenguaje sean adecuados para el nivel ${params.nivel}.`
    : "Se cuidó una complejidad progresiva adecuada a la edad del grupo.";

  return [
    `Esta planificación corresponde a la sesión ${params.orden}${params.totalSessions > 1 ? ` de ${params.totalSessions}` : ""} (${params.duracionMin} min) de ${params.materia || "la materia seleccionada"} en nivel ${params.nivel || "no especificado"}. El diseño parte de una lógica de secuencia didáctica clara: asegurar entrada comprensible al contenido, sostener el trabajo cognitivo en el tramo central y cerrar con una producción o síntesis que deje evidencia concreta del aprendizaje.`,
    `Se organiza en Inicio-Desarrollo-Cierre para sostener progresión real y no solo orden formal. En el Inicio se activa conocimiento previo y se instala propósito de trabajo; en el Desarrollo se proponen actividades de análisis, intercambio y producción con andamiaje explícito; en el Cierre se recuperan ideas clave y se verifica comprensión con criterios observables. El foco principal de la sesión fue ${foco}; ${justificacion} ${segmento}${continuidad}`,
    `${compText} La operacionalización de estas competencias se traduce en decisiones concretas de aula: tareas con consigna explícita, preguntas guía con vocabulario disciplinar, momentos de interacción entre pares y producción final breve para verificar transferencia. ${reqText} ${ageGuidance}`,
    `En términos de evaluación formativa, la evidencia esperada no se limita a participación general: se busca argumentación pertinente, uso de conceptos de la sesión, conexión entre ejemplos trabajados y capacidad de síntesis con lenguaje propio. Por eso el plan incluye momentos de observación docente durante el proceso y una salida de cierre que permite detectar comprensión, vacíos y necesidades de refuerzo para la clase siguiente.`,
    `${params.hasMaterials ? "Se usó material fuente como base del diseño para asegurar rigor conceptual y anclaje en evidencia textual, priorizando pasajes pertinentes al objetivo de esta sesión. " : ""}${params.hasAnepContent ? "Los contenidos ANEP orientaron la selección y la priorización didáctica, cuidando alineación con competencias y progresión curricular." : "Cuando faltó detalle curricular explícito, se priorizó consistencia pedagógica a partir del plan generado, manteniendo coherencia con la progresión de la unidad y la evaluación formativa."}`
  ].join("\n\n");
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
  // CRITICAL: Handle OPTIONS FIRST - before ANY other code (no parsing, no logic)
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin') || 'unknown';
    console.log('[GEN_PLAN] OPTIONS preflight', { origin, ts: new Date().toISOString() });
    // TASK 2: Return 200 (as requested) with proper CORS headers
    return new Response('ok', { 
      status: 200, // OK - as per requirements
      headers: corsHeaders 
    });
  }

  // POST handler - log start immediately
  console.log('[GEN_PLAN] POST start', { ts: new Date().toISOString(), method: req.method });

  let requestBody: Record<string, any> = {};
  try {
    // Get API key inside POST handler (not at top level)
    const openAIApiKey = getOpenAIApiKey();
    if (!openAIApiKey) {
      console.error('[GEN_PLAN] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured', error_code: 'CONFIG_ERROR' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    requestBody = await req.json();
    
    // TASK 2: Validate duracionMin at the very start - DO NOT throw uncaught exceptions
    if (!requestBody.duracionMin || isNaN(Number(requestBody.duracionMin)) || Number(requestBody.duracionMin) <= 0) {
      const errorMsg = `Missing or invalid duracionMin. Received: ${requestBody.duracionMin}`;
      console.error('[GEN_PLAN]', errorMsg);
      console.error('[GEN_PLAN] Request body keys:', Object.keys(requestBody || {}));
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          error_code: 'INVALID_INPUT',
          error_field: 'duracionMin',
          received_value: requestBody.duracionMin
        }),
        { 
          status: 400, // Bad Request - clear error, not 500
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
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
      // Multi-session: total slots in plan (so coverage plan and session index match all sessions)
      totalSlots,
      // PHASE 3: Optional per-session focus override
      sessionBrief,
      // FIX: Materials context (includes extracted_text for materials-only generation)
      materialsContext,
      // DRY_RUN: Zero-cost diagnostic mode
      __dry_run
    } = requestBody;

    // DRY_RUN MODE: Return immediately with mock data, no OpenAI calls
    if (__dry_run === true) {
      console.log('[GEN_PLAN] DRY_RUN mode activated');
      console.log('[GEN_PLAN] entry planificacion_id=', requestBody.planificacion_id || 'unknown');
      console.log('[GEN_PLAN] session_id=', sesionId || 'unknown');
      
      // Build minimal valid response
      const dryRunResponse = {
        success: true,
        plan_html: `<section id="plan">
  <h1>Plan de Clase (DRY_RUN)</h1>
  <h2><strong>Inicio (15 min)</strong></h2>
  <p>Actividad de apertura</p>
  <h2><strong>Desarrollo (${Math.max((duracionMin || 90) - 20, 30)} min)</strong></h2>
  <p>Contenido principal</p>
  <h2><strong>Cierre (5 min)</strong></h2>
  <p>Síntesis y reflexión</p>
</section>`,
        argumento_competencias: 'DRY_RUN: Competencias trabajadas en esta sesión',
        recursos: [],
        ai_design_report: {
          narrative: 'DRY_RUN_NARRATIVE_OK',
          report_narrative: 'DRY_RUN_NARRATIVE_OK',
          inputsUsed: {
            anepContent: Array.isArray(contenidos) && contenidos.length > 0,
            materials: !!materialsContext,
            sessionBrief: !!sessionBrief?.trim(),
            unitContext: !!unitContext
          },
          decisions: {
            structure: 'DRY_RUN: Estructura estándar',
            timeAllocation: `DRY_RUN: ${duracionMin || 90} minutos`
          },
          contentCoverage: [],
          competencyDevelopment: [],
          teacherRequirementsApplied: []
        },
        debug: {
          build: 'DRY_RUN_2026_02_12',
          now: new Date().toISOString()
        },
        report_narrative: 'DRY_RUN_NARRATIVE_OK'
      };
      
      console.log('[GEN_PLAN] DRY_RUN completed ok');
      return new Response(JSON.stringify(dryRunResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-aulaplus-dry-run': 'true' }
      });
    }

    // FASE 1B: Logging estructurado al inicio
    const planificacionId = requestBody.planificacion_id || 'unknown';
    const sessionId = sesionId || 'unknown';
    const sessionOrder = orden || 'unknown';
    console.log('[GEN_PLAN] entry planificacion_id=', planificacionId);
    console.log('[GEN_PLAN] session_id=', sessionId);
    console.log('[GEN_PLAN] orden=', sessionOrder);
    console.log('[GEN_PLAN] modo=', modo || 'unknown');
    console.log('[GEN_PLAN] duracionMin=', duracionMin || 'unknown');
    console.log('[GEN_PLAN] competencias_por_sesion', {
      planificacion_id: planificacionId,
      session_id: sessionId,
      count: Array.isArray(competencias) ? competencias.length : 0,
      competencias: Array.isArray(competencias) ? competencias.slice(0, 6) : []
    });
    console.log('[GEN_PLAN] step=start');

    // PHASE 2.1: Construir sección de contexto de secuencia didáctica si unitContext está presente
    let secuenciaContext = '';
    if (unitContext) {
      const claseInfo = `- Esta es la clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad} de esta unidad.`;
      let instruccionesPosicion = '';
      
      if (unitContext.claseEnUnidad === 1) {
        instruccionesPosicion = '- Esta es la PRIMERA clase: Enfócate en introducción, contextualización y exploración inicial. El título debe reflejar este propósito introductorio.';
      } else if (unitContext.claseEnUnidad > 1 && unitContext.claseEnUnidad < unitContext.totalClasesUnidad) {
        instruccionesPosicion = `- Esta es una clase INTERMEDIA (${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Comienza con una breve activación de conocimientos previos conectando con la clase anterior, sin repetir explicaciones largas. Profundiza y complejiza el contenido. Evita introducir nuevos conceptos centrales. El título debe reflejar este enfoque de profundización.`;
      } else if (unitContext.claseEnUnidad === unitContext.totalClasesUnidad && !unitContext.isExtraSlot) {
        instruccionesPosicion = '- Esta es la ÚLTIMA clase: Evita introducir nuevos conceptos centrales. Enfócate en integración, transferencia, debate o actividades aplicadas. El título debe reflejar este propósito de síntesis/aplicación.';
      } else if (unitContext.isExtraSlot) {
        instruccionesPosicion = `- Esta es una clase ADICIONAL más allá de la secuencia original (clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Úsala preferentemente para repaso guiado, actividades integradoras, evaluación formativa o un proyecto aplicado. El título debe reflejar claramente este propósito (ej: "Repaso Integrador", "Proyecto Aplicado", "Evaluación Formativa").`;
      }
      
      secuenciaContext = `
CONTEXTO DE SECUENCIA DIDÁCTICA:
Esta clase forma parte de una unidad temática llamada "${unitContext.contenido}".

${claseInfo}
- El contenido debe ser progresivo y no repetitivo.
- No repitas explicaciones ya dadas en clases anteriores.
- El título de la clase debe reflejar el enfoque específico de esta sesión y debe ser diferente de otras clases en la misma unidad.

INSTRUCCIONES ESPECÍFICAS SEGÚN POSICIÓN:
${instruccionesPosicion}

`;
    }

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

    // Apply deterministic passage quality filter (TOC/biblio/prologue/metadata) before using materials
    const passageFilterResult = filterMaterialPassages(materialsContext || "");
    const filteredMaterialsContext = passageFilterResult.filteredText;
    const materialsContextForPrompt = filteredMaterialsContext || materialsContext || "";
    const passagesRejectedCount = passageFilterResult.rejectedByReason;
    const passagesSelectedCount = passageFilterResult.keptCount;
    const materialsCharsSent = passageFilterResult.materialsCharsSent;

    // TASK C: Build coverage plan BEFORE constructing prompt (for multi-session coherence); use filtered material
    // Use totalSlots (plan session count) when provided so session 3+ gets correct coverage; fallback to unit class count
    const totalSessions = (typeof totalSlots === 'number' && totalSlots > 0)
      ? totalSlots
      : (unitContext?.totalClasesUnidad || 1);
    const coveragePlan = buildCoveragePlan(
      totalSessions,
      materialsContextForPrompt,
      contenidos,
      unitContext
    );
    // CONTRACT: Frontend sends orden 1-based (Wizard/Workspace/Editors all use sesion.orden from DB = 1,2,3...).
    // Use orden as 1-based session index when in [1, totalSessions]; else treat as 0-based for backward compatibility.
    const ordenNum = Number(orden);
    const coverageSessionIndexUsed = (typeof totalSlots === 'number' && totalSlots > 0)
      ? (ordenNum >= 1 && ordenNum <= totalSessions
          ? ordenNum
          : Math.min(Math.max(ordenNum + 1, 1), totalSessions))
      : (Number(unitContext?.claseEnUnidad) || (ordenNum >= 1 ? ordenNum : Math.max(ordenNum + 1, 1)) || 1);
    const sessionCoverage = coveragePlan.find(c => c.sessionNumber === coverageSessionIndexUsed) || coveragePlan[0];
    const materialSummary = extractMaterialSummary(materialsContextForPrompt);
    console.log('[GEN_PLAN] material_summary', {
      planificacion_id: planificacionId,
      session_id: sessionId,
      themes_count: materialSummary.themes.length,
      concepts_count: materialSummary.concepts.length
    });
    console.log('[GEN_PLAN] segmento_asignado', {
      planificacion_id: planificacionId,
      session_id: sessionId,
      orden,
      coverageSessionIndexUsed,
      unitTotalClasses: Number(unitContext?.totalClasesUnidad) || 1,
      contentFocus: sessionCoverage?.contentFocus || 'none',
      materialSegment: sessionCoverage?.materialSegment || 'none'
    });
    console.log('[AI_REPORT_SESSION] session_id=', sessionId, 'coverage_plan_total=', totalSessions, 'session_coverage_focus=', sessionCoverage?.contentFocus?.substring(0, 50) || 'none');
    
    // TASK C: Build coverage context section for prompt
    const coverageSection = sessionCoverage ? `
COBERTURA DE CONTENIDO PARA ESTA SESIÓN (SESIÓN ${coverageSessionIndexUsed} DE ${totalSessions}):
- Foco de contenido específico: ${sessionCoverage.contentFocus}
${sessionCoverage.materialSegment ? `- Segmento del material a trabajar (USA SOLO ESTE SEGMENTO para esta sesión): ${sessionCoverage.materialSegment}` : ''}
${sessionCoverage.anepItems && sessionCoverage.anepItems.length > 0 ? `- Contenidos ANEP para esta sesión: ${sessionCoverage.anepItems.join(', ')}` : ''}
- Justificación de selección: ${sessionCoverage.rationale}
- OBLIGATORIO: El plan de esta sesión debe usar ÚNICAMENTE el contenido asignado a esta sesión en el mapeo anterior. No generes planes genéricos; incluye conceptos y detalles específicos del segmento asignado.
${totalSessions > 1 ? `
CONTINUIDAD MULTI-SESIÓN:
${coverageSessionIndexUsed === 1 ? '- Esta es la PRIMERA sesión: introduce conceptos base necesarios para las siguientes.' : ''}
${coverageSessionIndexUsed > 1 && coverageSessionIndexUsed < totalSessions ? `- Esta es una sesión INTERMEDIA (${coverageSessionIndexUsed} de ${totalSessions}): continúa desde la sesión anterior y prepara para las siguientes.` : ''}
${coverageSessionIndexUsed === totalSessions ? `- Esta es la ÚLTIMA sesión (${coverageSessionIndexUsed} de ${totalSessions}): integra y sintetiza todo lo trabajado en las sesiones anteriores.` : ''}
` : ''}

` : '';

    // FIX: Build materials section with special instructions for materials-only generation (use filtered material)
    const hasAnepContent = Array.isArray(contenidos) ? contenidos.length > 0 && contenidos.some((c: any) => c && c.trim()) : contenidos && String(contenidos).trim();
    const hasMaterials = materialsContextForPrompt && materialsContextForPrompt.trim().length > 0;
    
    const materialsSection = hasMaterials ? `
${materialsContextForPrompt}

${!hasAnepContent ? `
⚠️ MODO MATERIALES-ONLY (SIN ANEP):
NO hay contenido ANEP especificado. Los materiales docentes adjuntos son la ÚNICA fuente de contenido.

REGLAS CRÍTICAS PARA MATERIALES-ONLY:
1. El contenido del plan DEBE basarse EXCLUSIVAMENTE en el texto extraído de los PDFs proporcionados (ya filtrado: no incluye Índice, Prólogo, Referencias ni portada).
2. NO uses como contenido de clase Índice, Prólogo, Presentación editorial ni Bibliografía/Referencias a menos que el docente lo pida explícitamente.
3. NO uses plantillas genéricas ni contenido de relleno.
3. DEBES incluir conceptos, vocabulario, eventos, nombres y detalles ESPECÍFICOS del material.
4. Si el material menciona "Batllismo", "Batlle", "reformas sociales", etc., el plan DEBE usar esos términos exactos.
5. Si el material describe eventos históricos, personajes, o procesos, el plan DEBE referenciarlos específicamente.
6. Las actividades DEBEN trabajar con el contenido real del material, no con abstracciones genéricas.
7. Las preguntas guía DEBEN referenciar conceptos específicos del material.
8. El título H1 DEBE reflejar el tema específico del material, no un título genérico.

${unitContext ? `
DIVISIÓN SECUENCIAL DE MATERIALES (CRÍTICO):
Esta es la clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad} de la unidad "${unitContext.contenido}".

REGLAS PARA DIVIDIR MATERIALES ENTRE MÚLTIPLES CLASES:
${unitContext.claseEnUnidad === 1 ? `
- Esta es la PRIMERA clase: Trabaja con las PRIMERAS secciones/temas del material
- Introduce conceptos fundamentales que serán base para las siguientes clases
- NO trabajes todo el material, solo la parte inicial
- En contentCoverage, indica explícitamente qué sección/tema del material se cubre (ej: "Primera parte del material sobre X", "Introducción a Y")
` : unitContext.claseEnUnidad === unitContext.totalClasesUnidad ? `
- Esta es la ÚLTIMA clase: Trabaja con las ÚLTIMAS secciones/temas del material
- Integra y sintetiza con lo trabajado en clases anteriores
- NO repitas contenido ya trabajado en clases previas
- En contentCoverage, indica explícitamente qué sección/tema final del material se cubre y menciona continuidad con clases anteriores
` : `
- Esta es una clase INTERMEDIA (${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}): Trabaja con secciones/temas INTERMEDIOS del material
- NO repitas contenido de clases anteriores
- NO trabajes contenido que corresponde a clases posteriores
- Profundiza en la parte del material que corresponde a esta posición en la secuencia
- En contentCoverage, indica explícitamente qué sección/tema intermedio del material se cubre y menciona continuidad con clases anteriores y preparación para siguientes
`}
- Si el material es largo y se divide en múltiples clases, cada clase debe cubrir una parte COHERENTE y NO SOLAPADA
- Menciona explícitamente en contentCoverage la continuidad con clases anteriores (si no es la primera) y cómo prepara para las siguientes (si no es la última)
` : ''}

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
${unitContext ? `
DIVISIÓN SECUENCIAL: Esta es la clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}. Si los materiales se dividen entre múltiples clases, trabaja solo con la parte que corresponde a esta posición en la secuencia, sin repetir contenido de clases anteriores.
` : ''}
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
${sessionBriefSection}${secuenciaContext}${coverageSection}${groupProfileSection}${instruccionesDocenteSection}${materialsSection}${planActual ? `\nPLAN ACTUAL A MODIFICAR:\n${planActual}` : ''}

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
12. Ajustar profundidad conceptual, vocabulario y tipo de actividad al nivel/edad del grupo (por ejemplo, nivel 9 ≈ 14-15 años), evitando simplificación excesiva o tecnicismo inalcanzable.

## REPORTE NARRATIVO DE DISEÑO (OBLIGATORIO)

El campo "ai_design_report.narrative" DEBE ser un texto narrativo continuo (no lista de viñetas) de 400-600 palabras (2-4 párrafos largos) que explique EXPLÍCITAMENTE:

1. Para qué sesión y grupo se diseñó el plan (orden de sesión: ${orden}${unitContext ? `, sesión ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}` : ''}, duración: ${duracionMin} min, contexto de unidad)
2. CONTENIDO FOCUS PARA ESTA SESIÓN (OBLIGATORIO):
   - Qué partes específicas del material proporcionado se enseñan/usaron en esta sesión y CÓMO (actividades concretas)
   ${hasMaterials ? `- Si hay materiales subidos: describe QUÉ sección/tema específico del material se cubre en esta clase y CÓMO se trabaja (actividades específicas)` : ''}
   ${hasAnepContent ? `- Si hay contenidos ANEP: qué contenidos específicos se eligieron para enseñar/evaluar en esta sesión y POR QUÉ (alineación con objetivos/competencias)` : ''}
   ${instruccionesDocente ? `- Si hay requerimientos del docente: cómo se satisfacen en esta sesión específica` : ''}
   ${unitContext && unitContext.totalClasesUnidad > 1 ? `- Continuidad: cómo esta sesión se conecta con las sesiones anteriores y prepara para las siguientes` : ''}
3. QUÉ PARTES de las fuentes proporcionadas se enseñan en ESTA sesión específica:
   - Si hay materiales subidos: qué sección/tema específico del material se cubre en esta clase
   - Si hay contenidos ANEP: qué contenidos específicos se trabajan en esta sesión
   - Si hay requerimientos del docente: qué parte de esos requerimientos se satisface en esta clase
   - Si es parte de una secuencia: menciona explícitamente continuidad con clases anteriores (si no es la primera) y cómo prepara para las siguientes (si no es la última)
3. POR QUÉ esas partes fueron seleccionadas para esta sesión:
   - Lógica de secuencia (si es primera, intermedia o última)
   - Cómo se relaciona con las clases anteriores/posteriores
   - Por qué corresponde a esta posición en la secuencia didáctica
4. CÓMO se desarrollan las competencias seleccionadas:
   - Qué actividades específicas desarrollan cada competencia
   - Cómo las actividades permiten ejercitar habilidades de las competencias
5. CÓMO se satisfacen los requerimientos del docente:
   - Si hay instrucciones del docente, explica explícitamente cómo se aplicaron
   - Si hay sessionBrief, explica cómo el plan está estructurado alrededor de ese tema
6. Cómo se estructuró el plan (Inicio-Desarrollo-Cierre) y por qué
7. Cómo se consideraron las características del grupo (perfil de aprendizaje, tamaño)
8. Qué adaptaciones se incluyeron y por qué (basadas en contemplaciones, sin mencionar diagnósticos específicos)

REGLAS DEL REPORTE NARRATIVO:
- Enfoca el narrativo en: (1) qué contenido se enseña a partir de los pasajes seleccionados, (2) cómo se operacionalizan las competencias en las actividades, (3) cómo el plan atiende contemplaciones/adaptaciones del grupo (no solo una lista genérica de "diferenciación"), (4) qué evidencia de aprendizaje se espera.
- Escribe en tono amigable y pedagógico, como explicando a un colega docente.
- NO incluyas en el narrativo secciones con estos títulos: "Propósito y foco", "Secuencia didáctica", "Competencias", "Evidencia esperada", "Materiales y fuentes". Escribe un texto continuo en párrafos, sin subencabezados con esos nombres.
- NO incluyas volcados largos de material crudo ni JSON técnico. Salida en texto limpio o markdown; NO dejes etiquetas HTML visibles (<p>, <br>, etc.).
- NO uses lenguaje técnico innecesario, ni diagnósticos médicos ni etiquetas de estudiantes, ni nombres de estudiantes.
- Usa párrafos continuos (2-4 párrafos largos), 400-600 palabras.
- Si el material se divide en múltiples sesiones: qué parte corresponde a esta sesión y continuidad con otras. Si NO hay materiales/ANEP explícitos: indica que el contenido se infirió de las secciones generadas.

DEVOLVER JSON EXACTO:
{
  "plan_html": "<section id=\\"plan\\">...</section>",
  "argumento_competencias": "<p>Explicación de cómo las actividades desarrollan las competencias seleccionadas</p>",
  "recursos": ["Proyector", "Pizarrón", "Marcadores", "Material específico"],
  "titulo": "${sessionBrief?.trim() || 'Título extraído del H1 generado'}",
  "ai_design_report": {
    "narrative": "<texto narrativo de 400-600 palabras explicando el diseño del plan en párrafos amigables para docentes>",
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
      "Activar conocimientos previos si resulta apropiado para el grupo y el momento de la secuencia.",
      "Recursos básicos disponibles (pizarra, proyector)"
    ],
    "contentCoverage": [
      {
        "sourceType": "uploaded_material" | "ANEP" | "teacher_requirements",
        "sourceId": "<id o referencia si disponible>",
        "coveredPart": "<descripción explícita de qué sección/tema se cubre en ESTA clase específica>",
        "whyThisPartInThisClass": "<explicación de por qué esta parte corresponde a esta clase en la secuencia>",
        "howItIsWorked": "<descripción de actividades y dinámicas que trabajan este contenido>",
        "assessmentOrEvidence": "<cómo se evalúa o evidencia el aprendizaje de este contenido>",
        "relatedCompetencies": ["<competencia 1>", "<competencia 2>"]
      }
    ],
    "competencyDevelopment": [
      {
        "competency": "<nombre de la competencia>",
        "howDevelopedInThisClass": "<cómo se desarrolla específicamente en esta clase>",
        "linkedActivities": ["<actividad 1>", "<actividad 2>"]
      }
    ],
    "teacherRequirementsApplied": [
      {
        "requirement": "<requerimiento del docente>",
        "howItWasSatisfied": "<cómo se satisfizo en el diseño de esta clase>"
      }
    ],
    "standardsCoverage": [
      {
        "standard": "<contenido ANEP específico>",
        "whyPrioritized": "<por qué se priorizó este contenido (alineación con objetivos/competencias)>",
        "howCovered": "<cómo se cubre en esta sesión específica>",
        "evidence": "<cómo se evidencia el aprendizaje de este estándar>"
      }
    ],
    "competenciesOperationalization": [
      {
        "competency": "<nombre de la competencia>",
        "concreteDevelopment": "<cómo se desarrolla concretamente dentro de las actividades de ESTA sesión (no genérico)>",
        "specificActivities": ["<actividad específica 1>", "<actividad específica 2>"],
        "learningEvidence": "<cómo se evidencia el desarrollo de esta competencia en esta sesión>"
      }
    ]
  }
}

REGLAS CRÍTICAS PARA contentCoverage:
- Si hay materiales fuente: menciona qué sección/tema específico del material se cubre en ESTA clase
- Si es parte de una secuencia (unitContext): explica por qué esta parte corresponde a esta posición en la secuencia
  * Clase 1: contenido introductorio/base
  * Clases intermedias: profundización, asumiendo conocimientos de clases anteriores
  * Última clase: integración y síntesis de todo lo trabajado
- Si NO hay materiales fuente/ANEP explícitos: marca sourceType como "inferred" y explica que se infirió de las secciones generadas
- NO inventes detalles de materiales que no fueron proporcionados
- Si el material se divide en múltiples clases: indica explícitamente qué parte corresponde a esta clase y menciona continuidad con clases anteriores/posteriores
- Si hay unitContext: MENCIONA EXPLÍCITAMENTE la continuidad con clases anteriores (si no es la primera) y cómo esta clase prepara para las siguientes (si no es la última)

REGLAS CRÍTICAS PARA competencyDevelopment:
- Mapea cada competencia a actividades específicas del plan generado
- Explica cómo cada actividad desarrolla la competencia
- Si hay múltiples competencias, incluye todas las relevantes para esta clase

REGLAS CRÍTICAS PARA teacherRequirementsApplied:
- Solo incluye requerimientos que realmente se aplicaron en esta clase
- Explica explícitamente cómo se satisfizo cada requerimiento
- Si un requerimiento aplica a múltiples clases, explica cómo se satisface en esta clase específica

REGLAS CRÍTICAS PARA standardsCoverage (OBLIGATORIO si hay contenidos ANEP):
- Para cada contenido ANEP seleccionado, explica:
  * Qué contenido específico se priorizó y por qué (alineación con objetivos/competencias)
  * Cómo se cubre en esta sesión específica (no genérico)
  * Cómo se evidencia el aprendizaje de este estándar
- Si hay múltiples contenidos ANEP, explica la priorización y por qué algunos se trabajan en esta sesión y otros en otras

REGLAS CRÍTICAS PARA competenciesOperationalization (OBLIGATORIO):
- Explica cómo cada competencia seleccionada se desarrolla CONCRETAMENTE dentro de las actividades de ESTA sesión
- NO uses descripciones genéricas como "se desarrolla mediante actividades de Inicio-Desarrollo-Cierre"
- Menciona actividades ESPECÍFICAS del plan generado (ej: "análisis de documentos históricos en Desarrollo", "debate guiado sobre condiciones sociales")
- Explica cómo cada actividad permite ejercitar habilidades específicas de la competencia
- Incluye cómo se evidencia el desarrollo de la competencia en esta sesión
`;

    // FASE 1B: Logging antes de llamada a OpenAI
    console.log('[GEN_PLAN] step=openai_call_start');
    console.log('[GEN_PLAN] session_id=', sessionId, 'prompt_length=', prompt.length);
    const openaiStartTime = Date.now();

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
        console.error('[GEN_PLAN] OpenAI API error:', res.status, errorText);
        throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
      }

      return res;
    }, 3, 2000); // 3 intentos con delay base de 2 segundos

    // FASE 1B: Logging después de llamada a OpenAI
    const openaiElapsed = Date.now() - openaiStartTime;
    console.log('[GEN_PLAN] step=openai_call_end');
    console.log('[GEN_PLAN] session_id=', sessionId, 'openai_elapsed_ms=', openaiElapsed);

    // FASE 1B: Logging antes de parsear respuesta
    console.log('[GEN_PLAN] step=parse_response_start');
    console.log('[GEN_PLAN] session_id=', sessionId);
    
    const parseStartTime = Date.now();
    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    const parseElapsed = Date.now() - parseStartTime;

    console.log('[GEN_PLAN] step=parse_response_end');
    console.log('[GEN_PLAN] session_id=', sessionId, 'parse_elapsed_ms=', parseElapsed);
    console.log('[GEN_PLAN] OpenAI response content length:', content.length);
    console.log('[GEN_PLAN] OpenAI response preview:', content.substring(0, 200));

    // Intentar parsear como JSON
    let parsed;
    let modelReturnedStructuredReport = false;
    try {
      parsed = JSON.parse(content);
      // plan_html must be pure HTML for rendering; strip any embedded debug/markdown/JSON
      if (parsed.plan_html && typeof parsed.plan_html === 'string') {
        parsed.plan_html = stripDebugFromPlanHtml(parsed.plan_html);
      }
      // Detect if model returned a structured ai_design_report (canonical source)
      const adr = parsed.ai_design_report;
      if (adr && typeof adr === 'object') {
        const hasNarrative = typeof adr.narrative === 'string' && adr.narrative.trim().length >= 80;
        const hasReportNarrative = typeof adr.report_narrative === 'string' && adr.report_narrative.trim().length >= 80;
        const hasContentCoverage = Array.isArray(adr.contentCoverage) && adr.contentCoverage.length > 0;
        const hasTeacherReqs = Array.isArray(adr.teacherRequirementsApplied) && adr.teacherRequirementsApplied.length > 0;
        modelReturnedStructuredReport = hasNarrative || hasReportNarrative || hasContentCoverage || hasTeacherReqs;
      }
    } catch (parseError) {
      console.error('JSON parse error, attempting extraction:', parseError);
      // Si no es JSON válido, intentar extraer; plan_html must be pure HTML (strip embedded report)
      parsed = {
        plan_html: stripDebugFromPlanHtml(content),
        argumento_competencias: '',
        recursos: [],
        ai_design_report: {
          inputsUsed: {
            anepContent: !!hasAnepContent,
            materials: hasMaterials,
            sessionBrief: !!sessionBrief?.trim(),
            unitContext: !!unitContext
          },
          decisions: {
            structure: 'Estructura extraída de HTML generado',
            timeAllocation: `Distribución según duración total (${duracionMin} min)`
          },
          assumptions: [
            'Activar conocimientos previos si resulta apropiado para el grupo y el momento de la secuencia.',
            'Recursos básicos disponibles'
          ],
          contentCoverage: buildContentCoverage(
            contenidos,
            materialsContextForPrompt,
            unitContext,
            sessionBrief,
            orden,
            !!hasAnepContent,
            hasMaterials
          ),
          competencyDevelopment: buildCompetencyDevelopment(
            competencias,
            content
          ),
          teacherRequirementsApplied: buildTeacherRequirementsApplied(
            instruccionesDocente,
            sessionBrief
          )
        }
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
          'Activar conocimientos previos si resulta apropiado para el grupo y el momento de la secuencia.',
          'Recursos básicos disponibles'
        ]
      };
      console.log('[FIX] Added default ai_design_report to planning response');
    } else {
      console.log('[FIX] ai_design_report found in AI response:', Object.keys(parsed.ai_design_report || {}));
    }
    
    // Ensure extended fields exist in ai_design_report
    const aiReport: any = parsed.ai_design_report as any;
    
    // Build contentCoverage if missing
    if (!aiReport.contentCoverage || !Array.isArray(aiReport.contentCoverage) || aiReport.contentCoverage.length === 0) {
      aiReport.contentCoverage = buildContentCoverage(
        contenidos,
        materialsContextForPrompt,
        unitContext,
        sessionBrief,
        orden,
        !!hasAnepContent,
        hasMaterials
      );
      console.log('[CONTENT_COVERAGE] Built contentCoverage:', aiReport.contentCoverage.length, 'items');
    }
    
    // Build competencyDevelopment if missing
    if (!aiReport.competencyDevelopment || !Array.isArray(aiReport.competencyDevelopment) || aiReport.competencyDevelopment.length === 0) {
      aiReport.competencyDevelopment = buildCompetencyDevelopment(
        competencias,
        parsed.plan_html || ''
      );
      console.log('[COMPETENCY_DEV] Built competencyDevelopment:', aiReport.competencyDevelopment.length, 'items');
    }
    
    // Build teacherRequirementsApplied if missing
    if (!aiReport.teacherRequirementsApplied || !Array.isArray(aiReport.teacherRequirementsApplied)) {
      aiReport.teacherRequirementsApplied = buildTeacherRequirementsApplied(
        instruccionesDocente,
        sessionBrief
      );
      console.log('[TEACHER_REQ] Built teacherRequirementsApplied:', aiReport.teacherRequirementsApplied.length, 'items');
    }
    
    // GOAL C: Build standardsCoverage if missing (for ANEP contents)
    if (hasAnepContent && (!aiReport.standardsCoverage || !Array.isArray(aiReport.standardsCoverage) || aiReport.standardsCoverage.length === 0)) {
      aiReport.standardsCoverage = buildStandardsCoverage(
        contenidos,
        competencias,
        orden,
        unitContext
      );
      console.log('[AI_REPORT_SESSION] Built standardsCoverage:', aiReport.standardsCoverage.length, 'items');
    }
    
    // GOAL C: Build competenciesOperationalization if missing
    if (!aiReport.competenciesOperationalization || !Array.isArray(aiReport.competenciesOperationalization) || aiReport.competenciesOperationalization.length === 0) {
      aiReport.competenciesOperationalization = buildCompetenciesOperationalization(
        competencias,
        parsed.plan_html || ''
      );
      console.log('[AI_REPORT_SESSION] Built competenciesOperationalization:', aiReport.competenciesOperationalization.length, 'items');
    }
    
    // GOAL C: Log narrative presence
    const hasNarrative = aiReport.narrative && typeof aiReport.narrative === 'string' && aiReport.narrative.trim().length > 0;
    console.log('[AI_REPORT_SESSION] session_id=', sessionId, 'hasNarrative=', hasNarrative ? 'yes' : 'no', 'narrative_length=', hasNarrative ? (aiReport.narrative as string).length : 0);
    console.log('[AI_REPORT_SESSION] session_id=', sessionId, 'contentCoverage_count=', Array.isArray(aiReport.contentCoverage) ? aiReport.contentCoverage.length : 0);
    
    // TASK C: Build coverage context for narrative prompt
    let coverageContext = '';
    if (sessionCoverage) {
      coverageContext = `
CONTEXTO DE COBERTURA PARA ESTA SESIÓN (SESIÓN ${coverageSessionIndexUsed} DE ${totalSessions}):
- Foco de contenido: ${sessionCoverage.contentFocus}
${sessionCoverage.materialSegment ? `- Segmento del material: ${sessionCoverage.materialSegment}` : ''}
${sessionCoverage.anepItems && sessionCoverage.anepItems.length > 0 ? `- Contenidos ANEP para esta sesión: ${sessionCoverage.anepItems.join(', ')}` : ''}
- Justificación: ${sessionCoverage.rationale}
${totalSessions > 1 ? `
CONTINUIDAD MULTI-SESIÓN:
${coverageSessionIndexUsed === 1 ? '- Esta es la PRIMERA sesión: introduce conceptos base que serán necesarios para las sesiones siguientes.' : ''}
${coverageSessionIndexUsed > 1 && coverageSessionIndexUsed < totalSessions ? `- Esta es una sesión INTERMEDIA (${coverageSessionIndexUsed} de ${totalSessions}): continúa desde la sesión anterior y prepara para las siguientes.` : ''}
${coverageSessionIndexUsed === totalSessions ? `- Esta es la ÚLTIMA sesión (${coverageSessionIndexUsed} de ${totalSessions}): integra y sintetiza todo lo trabajado en las sesiones anteriores.` : ''}
` : ''}
`;
    }
    
    // Validate and generate narrative fallback if missing or too short
    // Note: aiReport already declared above at line 754
    if (!aiReport.narrative || typeof aiReport.narrative !== 'string' || aiReport.narrative.trim().length < 80) {
      console.log('[NARRATIVE] Missing or too short, generating fallback...');
      try {
        const narrativePrompt = `Eres un asistente pedagógico que explica decisiones de diseño de planes de clase a docentes.
${coverageContext}

Genera un reporte narrativo amigable (400-600 palabras, 2-4 párrafos largos) que explique EXPLÍCITAMENTE:

1. Para qué sesión y grupo se diseñó el plan (orden de sesión: ${orden}, duración: ${duracionMin} min${unitContext ? `, contexto de unidad: clase ${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad} de "${unitContext.contenido}"` : ''})
2. CONTENIDO FOCUS PARA ESTA SESIÓN (OBLIGATORIO - usar el contexto de cobertura proporcionado):
   ${sessionCoverage ? `
   - Foco de contenido: ${sessionCoverage.contentFocus}
   ${sessionCoverage.materialSegment ? `- Segmento del material trabajado: ${sessionCoverage.materialSegment}` : ''}
   ${sessionCoverage.anepItems && sessionCoverage.anepItems.length > 0 ? `- Contenidos ANEP específicos: ${sessionCoverage.anepItems.join(', ')}` : ''}
   - Por qué estos contenidos fueron seleccionados: ${sessionCoverage.rationale}
   ` : ''}
3. QUÉ PARTES de las fuentes proporcionadas se enseñan en ESTA sesión específica:
   ${hasMaterials ? '- Materiales subidos: qué sección/tema específico del material se cubre en esta clase' : ''}
   ${hasAnepContent ? '- Contenidos ANEP: qué contenidos específicos se trabajan en esta sesión' : ''}
   ${sessionBrief?.trim() ? `- Enfoque específico: "${sessionBrief.trim()}" - cómo se estructura el plan alrededor de este tema` : ''}
   ${instruccionesDocente ? '- Instrucciones del docente: qué parte de esas instrucciones se aplica en esta clase' : ''}
   ${unitContext ? `- Continuidad secuencial: ${unitContext.claseEnUnidad === 1 ? 'Esta es la primera clase, introduce contenidos base' : unitContext.claseEnUnidad === unitContext.totalClasesUnidad ? 'Esta es la última clase, integra y sintetiza' : `Esta clase (${unitContext.claseEnUnidad} de ${unitContext.totalClasesUnidad}) profundiza como continuación de clases anteriores`}` : ''}
   ${totalSessions > 1 ? `- Continuidad multi-sesión: ${coverageSessionIndexUsed === 1 ? 'Primera sesión de la secuencia' : coverageSessionIndexUsed === totalSessions ? `Última sesión (${coverageSessionIndexUsed} de ${totalSessions}) - integra todo lo trabajado` : `Sesión intermedia (${coverageSessionIndexUsed} de ${totalSessions}) - continúa desde la anterior`}` : ''}
4. POR QUÉ esas partes fueron seleccionadas para esta sesión:
   ${unitContext ? `- Lógica de secuencia: ${unitContext.claseEnUnidad === 1 ? 'Primera clase introduce conceptos fundamentales' : unitContext.claseEnUnidad === unitContext.totalClasesUnidad ? 'Última clase integra todo lo trabajado' : `Clase intermedia profundiza en contenidos ya introducidos`}` : '- Relevancia pedagógica de los contenidos elegidos'}
4. CÓMO se desarrollan las competencias seleccionadas:
   - Qué actividades específicas desarrollan cada competencia
   - Cómo las actividades permiten ejercitar habilidades de las competencias
5. CÓMO se satisfacen los requerimientos del docente:
   ${sessionBrief?.trim() ? `- El plan está estructurado alrededor de "${sessionBrief.trim()}" con todas las actividades orientadas a este tema` : ''}
   ${instruccionesDocente ? `- Las instrucciones del docente fueron consideradas en el diseño de las actividades` : ''}
6. Cómo se estructuró el plan (Inicio-Desarrollo-Cierre) y por qué
7. Cómo se consideraron las características del grupo (perfil de aprendizaje, tamaño)
8. Qué adaptaciones se incluyeron y por qué (basadas en contemplaciones, sin mencionar diagnósticos específicos)

REGLAS:
- Tono amigable y pedagógico, como explicando a un colega docente
- NO uses lenguaje técnico innecesario
- NO menciones diagnósticos médicos o etiquetas de estudiantes
- NO menciones estudiantes individuales por nombre
- NO uses formato de lista, usa párrafos continuos (2-4 párrafos largos)
- Longitud: 400-600 palabras
- Contexto: Uruguay/ANEP es apropiado mencionar
- Si el material se divide en múltiples sesiones: menciona explícitamente qué parte corresponde a esta sesión y la continuidad con otras
- Si NO hay materiales fuente/ANEP explícitos: indica que el contenido se infirió de las secciones generadas

CONTEXTO:
- Materia: ${materia || 'No especificada'}
- Nivel: ${nivel || 'No especificado'}
- Contenidos: ${Array.isArray(contenidos) ? contenidos.join(', ') : contenidos || 'No especificados'}
- Competencias: ${Array.isArray(competencias) ? competencias.join(', ') : competencias || 'No especificadas'}
- Criterios: ${Array.isArray(criterios) ? criterios.join(', ') : criterios || 'No especificados'}
${instruccionesDocente ? `- Instrucciones del docente: ${instruccionesDocente.substring(0, 200)}` : ''}
${sessionBrief?.trim() ? `- Enfoque específico de sesión: "${sessionBrief.trim()}"` : ''}

Responde ÚNICAMENTE con el texto narrativo, sin formato JSON, sin code fences, sin explicaciones adicionales.`;

        const narrativeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Eres un asistente pedagógico que explica decisiones de diseño de planes de clase a docentes.' },
              { role: 'user', content: narrativePrompt }
            ],
            max_completion_tokens: 500,
            temperature: 0.7
          }),
        });

        if (narrativeResponse.ok) {
          const narrativeData = await narrativeResponse.json();
          const narrative = narrativeData.choices[0]?.message?.content?.trim() || '';
          if (narrative.length >= 80) {
            aiReport.narrative = narrative;
            console.log('[NARRATIVE] Generated fallback narrative:', narrative.length, 'chars');
          } else {
            console.log('[NARRATIVE] Generated narrative too short, using minimal fallback');
            aiReport.narrative = `Este plan de clase fue diseñado para la sesión ${orden} con duración de ${duracionMin} minutos en la materia ${materia || 'no especificada'}. El plan sigue la estructura estándar de Inicio-Desarrollo-Cierre, adaptado a las necesidades del grupo.`;
          }
        } else {
          throw new Error(`OpenAI API error: ${narrativeResponse.status}`);
        }
      } catch (error) {
        console.error('[NARRATIVE] Failed to generate fallback:', error);
        // Minimal fallback
        aiReport.narrative = `Este plan de clase fue diseñado para la sesión ${orden} con duración de ${duracionMin} minutos en la materia ${materia || 'no especificada'}. El plan sigue la estructura estándar de Inicio-Desarrollo-Cierre, adaptado a las necesidades del grupo.`;
      }
    } else {
      // Trim existing narrative
      aiReport.narrative = (aiReport.narrative as string).trim();
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

    // Guard: avoid generic placeholder titles when richer context is available
    const title = (parsed.titulo || extractedTitle || '').trim();
    const isGenericTitle = /^S\d+$/i.test(title) || /^Sesión\s*\d+$/i.test(title) || (title.length <= 4 && /^\d+$/.test(title));
    const richerContext = sessionCoverage?.contentFocus || unitContext?.contenido;
    if (isGenericTitle && richerContext && typeof richerContext === 'string' && richerContext.trim().length > 5) {
      const fallback = richerContext.trim().length > 80 ? richerContext.trim().slice(0, 77) + '...' : richerContext.trim();
      parsed.titulo = fallback;
      console.log('[GEN_PLAN] Replaced generic title with context-based title');
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
        recursos: ["Pizarra", "Marcadores", "Proyector", "Material didáctico"],
        ai_design_report: {
          inputsUsed: {
            anepContent: !!hasAnepContent,
            materials: hasMaterials,
            sessionBrief: !!sessionBrief?.trim(),
            unitContext: !!unitContext
          },
          decisions: {
            structure: 'Estructura fallback: Inicio-Desarrollo-Cierre estándar',
            timeAllocation: `Distribución según duración total (${duracionMin} min)`,
            reason: 'HTML generado no tenía estructura válida, usando plan de respaldo'
          },
          assumptions: [
            'Activar conocimientos previos si resulta apropiado para el grupo y el momento de la secuencia.',
            'Recursos básicos disponibles'
          ],
          contentCoverage: buildContentCoverage(
            contenidos,
            materialsContextForPrompt,
            unitContext,
            sessionBrief,
            orden,
            !!hasAnepContent,
            hasMaterials
          ),
          competencyDevelopment: buildCompetencyDevelopment(
            competencias,
            ''
          ),
          teacherRequirementsApplied: buildTeacherRequirementsApplied(
            instruccionesDocente,
            sessionBrief
          )
        }
      };
    }

    // Log completion
    // Note: hasNarrative already declared at line 1185 - reuse it instead of redeclaring
    const finalHasNarrative = parsed.ai_design_report?.narrative && typeof parsed.ai_design_report.narrative === 'string' && parsed.ai_design_report.narrative.trim().length > 0;
    const technicalReport = parsed.ai_design_report || {};
    const teacherRequirements = Array.isArray(technicalReport?.teacherRequirementsApplied)
      ? technicalReport.teacherRequirementsApplied
          .map((item: any) => item?.requirement)
          .filter((item: any) => typeof item === 'string' && item.trim().length > 0)
      : [];
    const reportNarrative = buildTeacherReportNarrative({
      maybeNarrative: technicalReport?.report_narrative ?? technicalReport?.narrative,
      orden: coverageSessionIndexUsed,
      totalSessions: Number(totalSessions) || 1,
      duracionMin: Number(duracionMin) || 60,
      materia,
      nivel,
      sessionCoverage,
      competencies: Array.isArray(competencias) ? competencias.filter((c: any) => typeof c === 'string') : [],
      teacherRequirements,
      hasAnepContent: !!hasAnepContent,
      hasMaterials: !!hasMaterials
    });
    const cleanNarrative = sanitizeReportNarrative(reportNarrative);
    parsed.ai_design_report = toTeacherSafeAiDesignReport(technicalReport as Record<string, unknown>, cleanNarrative);
    parsed.report_narrative = cleanNarrative;
    parsed.plan_json = {
      titulo: parsed.titulo || null,
      contentCoverage: parsed.ai_design_report?.contentCoverage || [],
      competencyDevelopment: parsed.ai_design_report?.competencyDevelopment || [],
      teacherRequirementsApplied: parsed.ai_design_report?.teacherRequirementsApplied || []
    };
    console.log('[GEN_PLAN] completed ok');
    console.log('[GEN_PLAN] session_id=', sesionId || 'unknown', 'hasNarrative=', finalHasNarrative ? 'yes' : 'no');
    console.log('[GEN_PLAN] plan_html_length=', parsed.plan_html?.length || 0);
    (parsed as any).debug = {
      ...((parsed as any).debug || {}),
      aiReportSource: modelReturnedStructuredReport ? 'structured' : 'fallback',
      materialsUsed: !!hasMaterials,
      coverageSessionIndexUsed,
      unitTotalClasses: Number(unitContext?.totalClasesUnidad) || 1,
      ...(typeof passageFilterResult !== 'undefined' ? {
        passagesRejectedCount: passageFilterResult.rejectedByReason,
        passagesSelectedCount: passageFilterResult.keptCount,
        materialsCharsSent: passageFilterResult.materialsCharsSent,
      } : {}),
    };

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // Safe error logging (no secrets)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error?.code || 'FUNCTION_ERROR';
    const errorStatus = error?.status || 500;
    
    console.error('[GEN_PLAN] ERROR:', {
      message: errorMessage,
      code: errorCode,
      status: errorStatus,
      // Do NOT log stack or full error object (may contain secrets)
    });
    
    // Try to get session info safely (may not be available if error occurred before parsing)
    let sessionId = 'unknown';
    let planificacionId = 'unknown';
    try {
      sessionId = requestBody?.sesionId || 'unknown';
      planificacionId = requestBody?.planificacion_id || 'unknown';
    } catch {
      // Ignore - requestBody may not be available
    }
    console.error('[GEN_PLAN] session_id=', sessionId);
    console.error('[GEN_PLAN] planificacion_id=', planificacionId);
    
    const isRateLimit = errorMessage?.includes('429') || errorMessage?.includes('Too Many Requests');
    const finalErrorMessage = isRateLimit 
      ? 'Rate limit exceeded. Please wait a moment and try again.'
      : errorMessage || 'Unknown error';
    
    // FIX: Always include ai_design_report even in error responses
    const errorResponse: any = {
      error: finalErrorMessage,
      error_code: isRateLimit ? 'RATE_LIMIT' : errorCode,
      error_status: isRateLimit ? 429 : errorStatus,
      isRateLimit: isRateLimit,
      report_narrative: '',
      ai_design_report: {
        report_narrative: '',
        narrative: '',
        inputsUsed: {
          anepContent: false,
          materials: false,
          sessionBrief: false,
          unitContext: false
        },
        decisions: {
          structure: 'Error: no se pudo generar plan',
          timeAllocation: 'N/A'
        },
        contentCoverage: [],
        competencyDevelopment: [],
        teacherRequirementsApplied: [],
        error: finalErrorMessage
      }
    };
    
    // CRITICAL: Always return CORS headers in error responses
    return new Response(JSON.stringify(errorResponse), {
      status: isRateLimit ? 429 : errorStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
