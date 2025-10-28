import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SesionClase, Planificacion, DistribucionModalidades } from '@/types/planificacion';

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
      const unidadesDidacticas = ((planificacion as any).unidades_didacticas) || [];
      
      // Extraer todas las competencias de las unidades didácticas
      const competenciasAll: string[] = Array.from(new Set(
        unidadesDidacticas.flatMap((u: any) => ((u.competencias_ids || []) as string[]))
      ));
      
      const sessionPromises = fechasSesiones.map(async (fecha, index) => {
        // Rotar unidades didácticas
        const unidadIndex = unidadesDidacticas.length > 0 
          ? Math.floor(index / Math.ceil(fechasSesiones.length / unidadesDidacticas.length))
          : 0;
        const unidad = unidadesDidacticas[unidadIndex] || { contenido_texto: 'Contenido general', competencias_ids: [] };
        
        // Calcular duración real basada en configuración horaria
        const duracionReal = calculateSessionDuration(fecha, planificacion.configuracion_horario);
        
        // Generar plan de desarrollo con IA
        const planDesarrollo = await generateAIPlan({
          materia: planificacion.materia,
          contenido: unidad?.contenido_texto || 'Contenido general',
          competencias: competenciasAll,
          modalidad: modalidadesDistribuidas[index],
          duracionMinutos: duracionReal,
          diferenciacion: planificacion.estrategias_diferenciacion,
          grupoId: planificacion.grupo_id,
          sesionNumero: index + 1,
          totalSesiones: fechasSesiones.length
        });

        // Generar recursos automáticamente basados en contenido
        const recursos = generateResources(unidad?.contenido_texto || '', planificacion.materia);
        
        return {
          id: crypto.randomUUID(),
          planificacion_id: planificacion.id,
          fecha: fecha.toISOString().split('T')[0],
          duracion_minutos: duracionReal,
          competencias_anep: competenciasAll.slice(0, 3),
          contenidos_anep: [unidad?.contenido_texto || 'Contenido general'],
          criterios_logro_anep: generateCriteriosLogro(competenciasAll),
          plan_desarrollo: planDesarrollo,
          diferenciacion: planificacion.estrategias_diferenciacion || '',
          evaluacion: {
            tipo: 'observacion' as const,
            configuracion: {},
            instrumento_generado: false
          },
          recursos,
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
}) {
  try {
    const { data, error } = await supabase.functions.invoke('modify-evaluation', {
      body: {
        type: 'planning',
        modification: `Genera un plan de clase estructurado para la sesión ${params.sesionNumero} de ${params.totalSesiones}:

MATERIA: ${params.materia}
CONTENIDO: ${params.contenido}
MODALIDAD PRINCIPAL: ${params.modalidad}
DURACIÓN: ${params.duracionMinutos} minutos

Estructura necesaria:
- INICIO (15 min): Actividad de apertura motivadora
- DESARROLLO (40 min): Actividades principales adaptadas a modalidad ${params.modalidad}
- CIERRE (5 min): Síntesis y reflexión

${params.diferenciacion ? `DIFERENCIACIÓN REQUERIDA: ${params.diferenciacion}` : ''}

Incluye diferenciación específica integrada en cada sección, recursos concretos y actividades detalladas.`,
        groupContext: {
          subject: params.materia,
          content: [params.contenido],
          competencies: params.competencias,
          groupName: params.grupoId,
          additionalContext: `Modalidad: ${params.modalidad}, Sesión ${params.sesionNumero}/${params.totalSesiones}`
        }
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
  return section
    .replace(/^(INICIO|DESARROLLO|CIERRE)[\s:]*\n?/i, '')
    .replace(/\*\*/g, '')
    .replace(/\n+/g, ' ')
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