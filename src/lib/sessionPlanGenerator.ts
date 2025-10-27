export interface GeneratedPlan {
  inicio: { descripcion: string; duracion: number };
  desarrollo: { descripcion: string; duracion: number };
  cierre: { descripcion: string; duracion: number };
}

export const generateSessionPlan = (
  competencias: string[],
  contenidos: string[],
  duracionMinutos: number
): GeneratedPlan => {
  // Cálculo de duración: mínimo 5 min inicio y cierre
  const duracionInicio = Math.max(5, Math.floor(duracionMinutos * 0.15));
  const duracionCierre = Math.max(5, Math.floor(duracionMinutos * 0.15)); 
  const duracionDesarrollo = duracionMinutos - duracionInicio - duracionCierre;

  const competenciasPrincipales = competencias.slice(0, 2);
  const contenidoPrincipal = contenidos[0] || "contenido de la sesión";

  return {
    inicio: {
      descripcion: `<p><strong>Activación y presentación</strong> (${duracionInicio} minutos)</p>
<p>Realizar una dinámica de bienvenida y contextualización:</p>
<ul>
<li>Recuperar conocimientos previos con preguntas dirigidas sobre ${contenidoPrincipal}</li>
<li>Presentar el objetivo de la clase y conectarlo con ${competenciasPrincipales.join(' y ')}</li>
<li>Organizar el aula según la modalidad de trabajo planificada</li>
<li>Establecer acuerdos de convivencia para la sesión</li>
</ul>`,
      duracion: duracionInicio
    },
    desarrollo: {
      descripcion: `<p><strong>Exploración y construcción</strong> (${duracionDesarrollo} minutos)</p>
<p>Implementar actividades secuenciadas sobre ${contenidoPrincipal}:</p>
<ul>
<li>Presentar el tema con ejemplos concretos del contexto estudiantil</li>
<li>Alternar trabajo individual (${Math.floor(duracionDesarrollo * 0.3)} min) y grupal (${Math.floor(duracionDesarrollo * 0.5)} min)</li>
<li>Facilitar la construcción de aprendizajes con preguntas guía hacia ${competenciasPrincipales.join(' y ')}</li>
<li>Realizar pausas de verificación cada ${Math.floor(duracionDesarrollo / 3)} minutos</li>
<li>Registrar ideas principales en pizarra o papelógrafo</li>
</ul>`,
      duracion: duracionDesarrollo
    },
    cierre: {
      descripcion: `<p><strong>Síntesis y proyección</strong> (${duracionCierre} minutos)</p>
<p>Consolidar aprendizajes y planificar continuidad:</p>
<ul>
<li>Realizar puesta en común de los principales hallazgos sobre ${contenidoPrincipal}</li>
<li>Conectar lo aprendido con las competencias trabajadas: ${competenciasPrincipales.join(' y ')}</li>
<li>Proponer una actividad breve de autoevaluación (oral o en ticket de salida)</li>
<li>Adelantar la próxima sesión y asignar tarea opcional si corresponde</li>
</ul>`,
      duracion: duracionCierre
    }
  };
};
// Generar mejoras para un bloque específico basado en prompt del docente
export const generateBlockPlan = (
  competencias: string[],
  duracionMinutos: number,
  prompt: string,
  contenidoActual: string = ''
): string => {
  const competenciasTexto = competencias.length > 0 ? competencias.join(', ') : 'competencias generales';
  
  // Generar contenido mejorado basado en el prompt
  const promptsComunes: Record<string, string> = {
    'dinámico': 'actividades participativas y motivadoras con movimiento y interacción',
    'grupal': 'trabajo colaborativo en grupos pequeños con roles definidos',
    'práctica': 'ejercicios prácticos y aplicación directa de conceptos',
    'reflexivo': 'momentos de reflexión personal y síntesis de aprendizajes',
    'juegos': 'actividades lúdicas y gamificación para mayor engagement',
    'ejemplos': 'casos prácticos y ejemplos concretos del contexto estudiantes',
    'motivación': 'elementos que generen interés y conexión emocional'
  };
  
  let estrategiaDescripcion = '';
  
  // Identificar estrategias en el prompt
  for (const [clave, descripcion] of Object.entries(promptsComunes)) {
    if (prompt.toLowerCase().includes(clave)) {
      estrategiaDescripcion = descripcion;
      break;
    }
  }
  
  if (!estrategiaDescripcion) {
    estrategiaDescripcion = 'actividades adaptadas según la solicitud del docente';
  }
  
  const contenidoMejorado = `${contenidoActual ? '<p>Actividades mejoradas:</p>' : ''}
<ul>
<li>Desarrollo de ${estrategiaDescripcion} enfocadas en ${competenciasTexto}</li>
<li>Tiempo estimado: ${duracionMinutos} minutos con transiciones fluidas</li>
<li>Adaptación específica: ${prompt}</li>
<li>Estrategias diferenciadas según niveles del grupo</li>
<li>Evaluación formativa continua durante el desarrollo</li>
</ul>`;

  return contenidoMejorado;
};