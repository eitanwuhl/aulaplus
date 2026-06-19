import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SesionClase, Planificacion, DistribucionModalidades, UnidadDidactica, UnitAssignmentMetadata } from '@/types/planificacion';
import { normalizeArrayField } from '@/lib/normalizeSupabaseArrays';
import { appendInstitutionToPromptText } from '@/lib/institution/buildInstitutionContextForAI';
import { loadGroupContext } from '@/services/groupContext/provider';
import {
  expandUnitsToSessionPlan,
  mapSessionsToUnits,
} from '@/lib/planificacion/unitSessionPlan';

interface SessionGenerationContext {
  planificacion: Planificacion;
  fechasSesiones: Date[];
}

export const useFullSessionGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAllSessions = async ({ planificacion, fechasSesiones }: SessionGenerationContext): Promise<SesionClase[]> => {
    setIsGenerating(true);
    setError(null);

    try {
      const modalidades = ['individual', 'pareja', 'grupos', 'toda_clase'] as const;
      const distribucion = planificacion.distribucion_modalidades;
      
      // Crear array de modalidades distribuidas proporcionalmente
      const modalidadesDistribuidas = createModalidadDistribution(fechasSesiones.length, distribucion);
      
      // Convertir unidades didácticas del JSON
      const unidadesDidacticas: UnidadDidactica[] = ((planificacion as any).unidades_didacticas) || [];
      
      // PHASE 1: Expandir unidades según clases_estimadas y mapear a sesiones
      const expandedPlan = expandUnitsToSessionPlan(unidadesDidacticas);
      const sessionAssignments = mapSessionsToUnits(fechasSesiones.length, expandedPlan, {
        fallbackContenido: 'Contenido general',
      });
      
      // DEV-only: Log resumen de asignaciones
      if (import.meta.env.DEV) {
        const DEBUG = false; // Cambiar a true para logs detallados por sesión
        const summary = {
          totalUnidades: unidadesDidacticas.length,
          totalClasesEstimadas: unidadesDidacticas.reduce((sum, u) => sum + (u.clases_estimadas || 1), 0),
          totalExpanded: expandedPlan.length,
          totalSesiones: fechasSesiones.length,
          primerosAsignamientos: sessionAssignments.slice(0, 5).map(a => ({
            unidad: a.contenido_texto.substring(0, 30),
            claseEnUnidad: a.claseEnUnidad,
            totalClases: a.totalClasesUnidad,
            isExtra: a.isExtraSlot
          }))
        };
        console.log('[PHASE1] Mapeo unidades→sesiones:', summary);
        if (DEBUG) {
          sessionAssignments.forEach((assignment, idx) => {
            console.log(`[PHASE1-DEBUG] Sesión ${idx + 1}:`, assignment);
          });
        }
      }
      
      // Extraer todas las competencias de las unidades didácticas
      const competenciasAll: string[] = Array.from(new Set(
        unidadesDidacticas.flatMap((u) => (u.competencias_ids || []))
      ));
      
      const sessionPromises = fechasSesiones.map(async (fecha, index) => {
        // PHASE 1: Usar asignación determinística en lugar de rotación
        const assignment = sessionAssignments[index];
        
        // Calcular duración real basada en configuración horaria
        const duracionReal = calculateSessionDuration(fecha, planificacion.configuracion_horario);
        
        // Generar plan de desarrollo con IA
        const planDesarrollo = await generateAIPlan({
          materia: planificacion.materia,
          contenido: assignment.contenido_texto,
          competencias: competenciasAll,
          modalidad: modalidadesDistribuidas[index],
          duracionMinutos: duracionReal,
          diferenciacion: planificacion.estrategias_diferenciacion,
          grupoId: planificacion.grupo_id,
          sesionNumero: index + 1,
          totalSesiones: fechasSesiones.length,
          // PHASE 2: Pasar metadata para generación progresiva
          unitAssignment: assignment,
          requerimientosDocente: planificacion.requerimientos_docente
        });

        // Generar recursos automáticamente basados en contenido
        const recursos = generateResources(assignment.contenido_texto, planificacion.materia);
        
        // Usar competencias de la unidad asignada si están disponibles, sino todas
        const competenciasSesion = assignment.competencias_ids.length > 0
          ? assignment.competencias_ids
          : competenciasAll;
        
        return {
          id: crypto.randomUUID(),
          planificacion_id: planificacion.id,
          fecha: fecha.toISOString().split('T')[0],
          duracion_minutos: duracionReal,
          competencias_anep: normalizeArrayField(competenciasSesion.slice(0, 3)),
          contenidos_anep: normalizeArrayField([assignment.contenido_texto]),
          criterios_logro_anep: normalizeArrayField(generateCriteriosLogro(competenciasSesion)),
          plan_desarrollo: planDesarrollo,
          diferenciacion: planificacion.estrategias_diferenciacion || '',
          evaluacion: {
            tipo: 'observacion' as const,
            configuracion: {},
            instrumento_generado: false
          },
          recursos: normalizeArrayField(recursos),
          observaciones: '',
          estado: 'planificada' as const,
          es_feriado: false,
          motivo_excepcion: undefined,
          orden: index,
          bloqueo_reserva: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as SesionClase;
      });

      const sesiones = await Promise.all(sessionPromises);
      return sesiones;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error generando sesiones';
      setError(errorMessage);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateAllSessions,
    isGenerating,
    error,
    setError
  };
};

// Helper para crear distribución proporcional de modalidades
function createModalidadDistribution(totalSesiones: number, distribucion: DistribucionModalidades): string[] {
  const modalidades: string[] = [];
  
  const individual = Math.round((distribucion.individual / 100) * totalSesiones);
  const pareja = Math.round((distribucion.pareja / 100) * totalSesiones);
  const grupos = Math.round((distribucion.grupos / 100) * totalSesiones);
  const todaClase = totalSesiones - individual - pareja - grupos;

  for (let i = 0; i < individual; i++) modalidades.push('individual');
  for (let i = 0; i < pareja; i++) modalidades.push('pareja');
  for (let i = 0; i < grupos; i++) modalidades.push('grupos');
  for (let i = 0; i < todaClase; i++) modalidades.push('toda_clase');

  // Mezclar array para distribución aleatoria
  return shuffleArray(modalidades);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Generar plan de desarrollo con IA
async function generateAIPlan(params: {
  materia: string;
  contenido: string;
  competencias: string[];
  modalidad: string;
  duracionMinutos: number;
  diferenciacion?: string;
  grupoId: string;
  sesionNumero: number;
  totalSesiones: number;
  // PHASE 2: Metadata de asignación para generación progresiva
  unitAssignment?: UnitAssignmentMetadata;
  requerimientosDocente?: string;
  // PHASE 3: Optional per-session focus override
  sessionBrief?: string;
}) {
  try {
    // PHASE 2: Construir unitContext si unitAssignment está disponible
    const unitContext = params.unitAssignment ? {
      unidadId: params.unitAssignment.unidadId,
      contenido: params.unitAssignment.contenido_texto,
      claseEnUnidad: params.unitAssignment.claseEnUnidad,
      totalClasesUnidad: params.unitAssignment.totalClasesUnidad,
      ...(params.unitAssignment.isExtraSlot && { isExtraSlot: true })
    } : undefined;

    // Load unified group context for AI generation
    const { getGroupContextForAI } = await import('@/services/groupContext/provider');
    const groupContext = await getGroupContextForAI(params.grupoId, { purpose: 'planning' });
    
    if (groupContext.groupProfile) {
      console.log('[useFullSessionGen] Using group profile:', {
        dominante: groupContext.groupProfile.dominante,
        estudiantesConAjustes: groupContext.anonymizedStudentsForPrompt.length,
        teacherSugerenciasPresent: !!groupContext.teacherSugerencias
      });
    }
    
    // Build enriched additionalContext with teacher suggestions if available
    let additionalContext = `Modalidad: ${params.modalidad}, Sesión ${params.sesionNumero}/${params.totalSesiones}`;
    
    if (groupContext.teacherSugerencias) {
      const suggestions = [];
      if (groupContext.teacherSugerencias.aula) {
        suggestions.push(`Teacher suggestions for classroom: ${groupContext.teacherSugerencias.aula}`);
      }
      if (groupContext.teacherSugerencias.evaluaciones) {
        suggestions.push(`Teacher suggestions for evaluations: ${groupContext.teacherSugerencias.evaluaciones}`);
      }
      if (groupContext.teacherSugerencias.otras) {
        suggestions.push(`Other important notes: ${groupContext.teacherSugerencias.otras}`);
      }
      if (suggestions.length > 0) {
        additionalContext += `\n\n` + suggestions.join('\n');
      }
    }

    if (groupContext.institutionPromptBlock) {
      additionalContext = appendInstitutionToPromptText(
        additionalContext,
        groupContext.institutionPromptBlock
      );
    }

    const { data, error } = await supabase.functions.invoke('modify-evaluation', {
      body: {
        type: 'planning',
        // PHASE 2.2.2: Language alignment - modification string in English, parser-critical tokens in Spanish
        // The edge function modify-evaluation constructs sequence context from unitContext
        modification: `Generate a structured lesson plan for session ${params.sesionNumero} of ${params.totalSesiones}:

SUBJECT: ${params.materia}
CONTENT: ${params.contenido}
PRIMARY MODALITY: ${params.modalidad}
DURATION: ${params.duracionMinutos} minutes

Required structure:
- INICIO (15 min): Motivational opening activity
- DESARROLLO (40 min): Main activities adapted to ${params.modalidad} modality
- CIERRE (5 min): Synthesis and reflection

${params.diferenciacion ? `DIFFERENTIATION REQUIRED: ${params.diferenciacion}` : ''}
${params.requerimientosDocente ? `\nTEACHER INSTRUCTIONS:\n${params.requerimientosDocente}\n\nThese instructions may:\n- Apply to the entire planning\n- Apply only to some classes\n- Indicate specific topics for a particular class\n\nExplicitly respect these indications if present.\nDo not invent a different sequence if the teacher has already defined it.` : ''}

Include specific differentiation integrated into each section, concrete resources, and detailed activities.
Use these exact labels in the output: 'Actividad:' and 'Recursos:'.`,
        groupContext: {
          subject: params.materia,
          content: [params.contenido],
          competencies: params.competencias,
          groupName: params.grupoId,
          additionalContext,
          // Include anonymized students and dominant profile from unified provider
          ...(groupContext.anonymizedStudentsForPrompt.length > 0 && { 
            students: groupContext.anonymizedStudentsForPrompt 
          }),
          ...(groupContext.dominantLearningStyle && { 
            dominantProfile: groupContext.dominantLearningStyle 
          }),
          ...(groupContext.institutionPromptBlock && {
            institutionContext: groupContext.institutionPromptBlock,
          }),
        },
        // PHASE 2: Incluir unitContext en payload (opcional para backward compatibility)
        ...(unitContext && { unitContext }),
        // PHASE 3: Include sessionBrief if provided (non-empty, trimmed)
        ...(params.sessionBrief?.trim() && { sessionBrief: params.sessionBrief.trim() })
      }
    });

    if (error) throw error;

    const contenidoIA = data?.content || '';
    
    // Parsear respuesta IA y estructurar en secciones
    return parseAIResponseToPlan(contenidoIA, params.duracionMinutos);

  } catch (error) {
    console.error('Error generando plan con IA:', error);
    return generateFallbackPlan(params);
  }
}

// Parsear respuesta de IA a estructura de plan
function parseAIResponseToPlan(contenido: string, duracionTotal: number) {
  // Buscar secciones en el contenido
  const inicioMatch = contenido.match(/INICIO[\s\S]*?(?=DESARROLLO|$)/i);
  const desarrolloMatch = contenido.match(/DESARROLLO[\s\S]*?(?=CIERRE|$)/i);
  const cierreMatch = contenido.match(/CIERRE[\s\S]*$/i);

  return {
    inicio: {
      descripcion: inicioMatch ? cleanSection(inicioMatch[0]) : 'Actividad de apertura motivadora adaptada al grupo',
      duracion: 15
    },
    desarrollo: {
      descripcion: desarrolloMatch ? cleanSection(desarrolloMatch[0]) : 'Actividades principales de exploración y construcción de conocimiento',
      duracion: Math.max(duracionTotal - 20, 30)
    },
    cierre: {
      descripcion: cierreMatch ? cleanSection(cierreMatch[0]) : 'Síntesis de lo aprendido y reflexión grupal',
      duracion: 5
    }
  };
}

function cleanSection(section: string): string {
  // PHASE 2.2: Sanitización defensiva para HTML/Markdown accidental
  return section
    .replace(/^(INICIO|DESARROLLO|CIERRE)[\s:]*\n?/i, '')  // Remover encabezado de sección
    .replace(/<[^>]+>/g, '')  // Remover tags HTML
    .replace(/\*\*/g, '')  // Remover markdown bold
    .replace(/#{1,6}\s*/g, '')  // Remover markdown headers
    .replace(/-{3,}/g, '')  // Remover markdown horizontal rules
    .replace(/\n+/g, ' ')  // Colapsar saltos de línea
    .replace(/\s+/g, ' ')  // Colapsar espacios múltiples
    .trim();
}

// Plan de respaldo si falla la IA
function generateFallbackPlan(params: { materia: string; contenido: string; modalidad: string; duracionMinutos: number }) {
  return {
    inicio: {
      descripcion: `Apertura de la clase de ${params.materia} con actividad motivadora relacionada con ${params.contenido}. Modalidad: ${params.modalidad}.`,
      duracion: 15
    },
    desarrollo: {
      descripcion: `Desarrollo del contenido "${params.contenido}" mediante actividades adaptadas a la modalidad ${params.modalidad}. Incluye exploración, análisis y construcción de conocimiento.`,
      duracion: Math.max(params.duracionMinutos - 20, 30)
    },
    cierre: {
      descripcion: 'Síntesis de lo aprendido, reflexión grupal y proyección para próximas clases.',
      duracion: 5
    }
  };
}

// Generar recursos automáticamente
function generateResources(contenido: string, materia: string): string[] {
  const recursos = ['Pizarra', 'Marcadores'];
  
  // Recursos específicos por materia
  if (materia.toLowerCase().includes('historia')) {
    recursos.push('Mapas históricos', 'Documentos fuente', 'Línea de tiempo');
  } else if (materia.toLowerCase().includes('ciencias')) {
    recursos.push('Material de laboratorio', 'Microscopio', 'Muestras');
  } else if (materia.toLowerCase().includes('matemática')) {
    recursos.push('Calculadora', 'Regla', 'Instrumentos de geometría');
  } else if (materia.toLowerCase().includes('literatura')) {
    recursos.push('Textos literarios', 'Diccionario', 'Material audiovisual');
  }

  // Recursos por tipo de contenido
  if (contenido.toLowerCase().includes('mapa')) {
    recursos.push('Atlas', 'Mapas impresos');
  }
  if (contenido.toLowerCase().includes('experimento')) {
    recursos.push('Material experimental', 'Fichas de registro');
  }

  return [...new Set(recursos)]; // Eliminar duplicados
}

// Calcular duración real de la sesión basada en configuración horaria
function calculateSessionDuration(fecha: Date, configuracionHorario: any[]): number {
  const diaSemana = fecha.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
  
  // Buscar configuración para este día
  const configDia = configuracionHorario.find(config => 
    config.dia.toLowerCase() === diaSemana
  );
  
  if (configDia && configDia.duracionMinutos) {
    return configDia.duracionMinutos;
  }
  
  // Si no encuentra configuración específica, calcular basado en horario
  if (configDia && configDia.horaInicio && configDia.horaFin) {
    const [horaInicio, minInicio] = configDia.horaInicio.split(':').map(Number);
    const [horaFin, minFin] = configDia.horaFin.split(':').map(Number);
    
    const inicioMinutos = horaInicio * 60 + minInicio;
    const finMinutos = horaFin * 60 + minFin;
    
    return finMinutos - inicioMinutos;
  }
  
  // Duración por defecto si no hay configuración
  return 60;
}

// Generar criterios de logro básicos
function generateCriteriosLogro(competencias: string[]): string[] {
  return competencias.slice(0, 3).map(comp => 
    `Demuestra comprensión de ${comp.toLowerCase()} mediante participación activa en clase`
  );
}