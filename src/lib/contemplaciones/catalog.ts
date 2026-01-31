/**
 * Catálogo canónico de contemplaciones (1-26)
 * Single Source of Truth para contemplaciones en AulaPlus
 * 
 * Este catálogo define:
 * - IDs estables para cada contemplación
 * - Etiquetas canónicas
 * - Aplicabilidad por categoría (clase/evaluaciones/ambas)
 * - Cómo se materializa cada contemplación en la UI
 * - Reglas de deduplicación (#9 y #22 se unifican)
 */

export type ContemplacionCategory = 'clase' | 'evaluaciones' | 'ambas';

export type MaterializacionTipo = 
  | 'diseño_cuadernillo'      // Diseño en cuadernillo/materiales
  | 'recordatorio_docente'    // Recordatorio en "¿A quién contempla...?"
  | 'diferenciacion_adaptaciones' // En "Diferenciación/Adaptaciones"
  | 'regla_correccion'        // Regla en corrección/rúbrica
  | 'norma_formato'           // Norma de formato estándar
  | 'recomendacion_perfil';   // Recomendación en planificación/perfil

export interface Materializacion {
  tipo: MaterializacionTipo;
  descripcion: string;
  contexto?: 'evaluacion' | 'clase' | 'ambos';
}

export interface Contemplacion {
  id: string; // ID estable (contemplacion-1, contemplacion-2, etc.)
  numero: number; // Número original (1-26)
  label: string; // Etiqueta canónica
  category: ContemplacionCategory;
  materializaciones: Materializacion[];
  reglasEspecificas?: string[]; // Reglas adicionales explícitas
  notas?: string; // Notas sobre deduplicación o casos especiales
}

/**
 * Catálogo completo de contemplaciones 1-26
 * IMPORTANTE: #9 y #22 están unificadas en una sola entrada (contemplacion-9-22)
 * para evitar duplicados en la UI, pero mantienen la regla explícita.
 */
export const CONTEMPLACIONES_CATALOG: Contemplacion[] = [
  {
    id: 'contemplacion-1',
    numero: 1,
    label: 'Lectura oral de consignas',
    category: 'evaluaciones', // Clase solo si hay consignas escritas puntuales
    materializaciones: [
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Recordar leer consignas en voz alta',
        contexto: 'evaluacion'
      },
      {
        tipo: 'diferenciacion_adaptaciones',
        descripcion: 'Recordar leer consignas escritas en voz alta para (nombres...)',
        contexto: 'clase'
      }
    ],
    reglasEspecificas: [
      'Evaluación: no se escribe en cuadernillo; recordatorio en "¿A quién contempla...?"',
      'Clase: en "Diferenciación/Adaptaciones" solo si aplica'
    ]
  },
  {
    id: 'contemplacion-2',
    numero: 2,
    label: 'Palabras clave en negrita e íconos de apoyo',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Negritas, señalética simple',
        contexto: 'evaluacion'
      },
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Recordar al docente poner palabras clave en negrita e iconografías si aplica',
        contexto: 'clase'
      }
    ]
  },
  {
    id: 'contemplacion-3',
    numero: 3,
    label: 'Tiempo adicional y pausas',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Recuerda brindar más tiempo y pausas en caso de ser necesario para este alumno',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: ['Clase: no aplica']
  },
  {
    id: 'contemplacion-4',
    numero: 4,
    label: 'Letra ampliada y alto contraste',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Tipografía legible en cuadernillo',
        contexto: 'evaluacion'
      },
      {
        tipo: 'diferenciacion_adaptaciones',
        descripcion: 'Cuando se utilice material, recuerda letra particularmente legible para (nombres...)',
        contexto: 'clase'
      }
    ]
  },
  {
    id: 'contemplacion-5',
    numero: 5,
    label: 'Segmentación de consignas en pasos numerados',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Consignas en 2 capas (producto + pasos)',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: ['Clase: no aplica (en esta etapa)']
  },
  {
    id: 'contemplacion-6',
    numero: 6,
    label: 'Hoja auxiliar / borrador permitido',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Recordatorio docente en "¿A quién contempla...?"',
        contexto: 'evaluacion'
      }
    ]
  },
  {
    id: 'contemplacion-7',
    numero: 7,
    label: 'Calculadora / material concreto cuando corresponda',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Recordatorio docente (en evaluación especialmente si corresponde)',
        contexto: 'ambos'
      }
    ],
    reglasEspecificas: ['Solo cuando la tarea lo permite']
  },
  {
    id: 'contemplacion-8',
    numero: 8,
    label: 'Respuesta oral alternativa (cuando corresponda)',
    category: 'clase', // Evaluación: como apoyo docente, NO evidencia
    materializaciones: [
      {
        tipo: 'diferenciacion_adaptaciones',
        descripcion: 'Participación oral guiada',
        contexto: 'clase'
      },
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Docente puede escuchar y ayudar a escribir; NO en cuadernillo',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: [
      'Evaluación: recordatorio en "¿A quién contempla...?"',
      'Evaluación: NO evidencia, solo apoyo docente'
    ]
  },
  {
    id: 'contemplacion-9-22',
    numero: 9, // Mantiene el número original para referencia
    label: 'Corrección centrada en contenido (no forma)',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'regla_correccion',
        descripcion: 'Regla en corrección/rúbrica y recordatorio en "¿A quién contempla...?"',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: [
      'No penalizar ortografía/sintaxis cuando no es objetivo',
      'Rúbrica alineada a CL',
      'DEDUPLICACIÓN: Unifica #9 y #22 en una sola opción UI'
    ],
    notas: 'Esta contemplación unifica las contemplaciones #9 y #22 para evitar duplicados en la UI. Incluye explícitamente la regla "no penalizar ortografía/sintaxis cuando no es objetivo".'
  },
  {
    id: 'contemplacion-10',
    numero: 10,
    label: 'Monitoreo docente y andamiaje (verificación de comprensión)',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Verificar comprensión durante la prueba sin dar respuestas',
        contexto: 'evaluacion'
      },
      {
        tipo: 'diferenciacion_adaptaciones',
        descripcion: 'Recuerda monitorear la comprensión de (nombres...)',
        contexto: 'clase'
      }
    ]
  },
  {
    id: 'contemplacion-11',
    numero: 11,
    label: 'Ubicación estratégica en aula (cerca del docente y/o pizarrón)',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'recomendacion_perfil',
        descripcion: 'Recomendación en planificación/perfil',
        contexto: 'clase'
      },
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Recordatorio docente si aplica',
        contexto: 'evaluacion'
      }
    ]
  },
  {
    id: 'contemplacion-12',
    numero: 12,
    label: 'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'diferenciacion_adaptaciones',
        descripcion: 'Recomendar entregar agenda/objetivos antes de la clase para (nombres...)',
        contexto: 'clase'
      },
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Incluir "mapa de la prueba" (secciones, puntaje, tiempo)',
        contexto: 'evaluacion'
      }
    ]
  },
  {
    id: 'contemplacion-13',
    numero: 13,
    label: 'Modelos y plantillas de respuesta (ejemplos ilustrativos, organizadores)',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Plantillas (tabla/matriz/guía) sin dar respuesta',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: ['Clase: no aplica (en esta etapa)']
  },
  {
    id: 'contemplacion-14',
    numero: 14,
    label: 'Guía de revisión / checklist del estudiante (autocontrol)',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Checklist final (cité evidencia, respondí todo, etc.)',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: ['Clase: no aplica']
  },
  {
    id: 'contemplacion-15',
    numero: 15,
    label: 'Reducción de copia mecánica (materiales fotocopiados o consignas ya impresas)',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'diferenciacion_adaptaciones',
        descripcion: 'Recordar llevar material impreso para (nombres...)',
        contexto: 'clase'
      },
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Cuadernillo siempre impreso/entregado',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: ['Clase: principal', 'Evaluación: sí']
  },
  {
    id: 'contemplacion-16',
    numero: 16,
    label: 'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'norma_formato',
        descripcion: 'Estándar de diseño de materiales y cuadernillo',
        contexto: 'ambos'
      }
    ]
  },
  {
    id: 'contemplacion-17',
    numero: 17,
    label: 'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'norma_formato',
        descripcion: 'Norma de formato del cuadernillo/materiales',
        contexto: 'ambos'
      }
    ],
    reglasEspecificas: ['Arial 13–14; interlineado 1.5 o doble']
  },
  {
    id: 'contemplacion-18',
    numero: 18,
    label: 'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'norma_formato',
        descripcion: 'Norma de redacción en consignas y guías',
        contexto: 'ambos'
      }
    ]
  },
  {
    id: 'contemplacion-19',
    numero: 19,
    label: 'Fragmentación de textos + preguntas inmediatamente después de cada fragmento',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Texto por bloques + preguntas por bloque',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: ['Clase: no aplica en desarrollo (en esta etapa)']
  },
  {
    id: 'contemplacion-20',
    numero: 20,
    label: 'Señalización explícita de tiempos (avisar límites, tiempos por sección)',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Cronograma sugerido por secciones',
        contexto: 'evaluacion'
      },
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Recordatorio docente para ciertos estudiantes',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: ['Clase: no aplica']
  },
  {
    id: 'contemplacion-21',
    numero: 21,
    label: 'Inicio anticipado / extensión operativa del tiempo (comenzar antes o terminar después)',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Recordatorio docente en "¿A quién contempla...?"',
        contexto: 'evaluacion'
      }
    ]
  },
  // Nota: #22 está unificada con #9 en contemplacion-9-22
  {
    id: 'contemplacion-23',
    numero: 23,
    label: 'Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación)',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Plantillas/casilleros; si hay V/F exigir justificación para no bajar exigencia',
        contexto: 'evaluacion'
      },
      {
        tipo: 'recordatorio_docente',
        descripcion: 'No pedir justificaciones extensas',
        contexto: 'evaluacion'
      }
    ]
  },
  {
    id: 'contemplacion-24',
    numero: 24,
    label: 'Priorización de tareas (orden recomendado, qué hacer primero)',
    category: 'evaluaciones', // Clase: consignas con orden y foco
    materializaciones: [
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Brindarle sugerencia de orden de respuesta',
        contexto: 'evaluacion'
      },
      {
        tipo: 'diferenciacion_adaptaciones',
        descripcion: 'Consignas con orden y foco si aplica',
        contexto: 'clase'
      }
    ]
  },
  {
    id: 'contemplacion-25',
    numero: 25,
    label: 'Refuerzo positivo / comentarios de reconocimiento (motivación externa)',
    category: 'clase', // Evaluación: administración mínima
    materializaciones: [
      {
        tipo: 'diferenciacion_adaptaciones',
        descripcion: 'Recordatorio en "Diferenciación/adaptaciones" si corresponde',
        contexto: 'clase'
      },
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Apoyos motivacionales breves, sin interferir con evidencia',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: [
      'Clase: principal',
      'Evaluación: administración mínima'
    ]
  },
  {
    id: 'contemplacion-26',
    numero: 26,
    label: 'Soporte digital para producción escrita (teclado / dictado a texto si el centro lo permite)',
    category: 'ambas',
    materializaciones: [
      {
        tipo: 'recordatorio_docente',
        descripcion: 'Recordatorio docente + opción de formato (evidencia sigue escrita)',
        contexto: 'ambos'
      }
    ],
    reglasEspecificas: [
      '"Grabación" NO como evidencia → traducir a "dictado a texto/teclado"'
    ]
  },
  {
    id: 'contemplacion-27',
    numero: 27,
    label: 'Apoyatura de memotecnia',
    category: 'evaluaciones',
    materializaciones: [
      {
        tipo: 'diseño_cuadernillo',
        descripcion: 'Apoyaturas de memotecnia (anclajes de pensamiento) cerca de consignas relevantes, sin respuestas',
        contexto: 'evaluacion'
      }
    ],
    reglasEspecificas: [
      'No incluir respuestas; solo orientar el pensamiento (causa→consecuencia, tesis→evidencia, criterios de comparación, etc.)'
    ]
  }
];

/**
 * Helper: Obtener todas las contemplaciones
 */
export function getAllContemplaciones(): Contemplacion[] {
  return CONTEMPLACIONES_CATALOG;
}

/**
 * Helper: Obtener contemplaciones por categoría
 */
export function getContemplacionesByCategory(
  category: ContemplacionCategory
): Contemplacion[] {
  if (category === 'ambas') {
    return CONTEMPLACIONES_CATALOG.filter(c => c.category === 'ambas');
  }
  return CONTEMPLACIONES_CATALOG.filter(c => c.category === category);
}

/**
 * Helper: Obtener contemplación por ID
 */
export function getContemplacionById(id: string): Contemplacion | undefined {
  return CONTEMPLACIONES_CATALOG.find(c => c.id === id);
}

/**
 * Helper: Obtener contemplación por número original
 */
export function getContemplacionByNumero(numero: number): Contemplacion | undefined {
  return CONTEMPLACIONES_CATALOG.find(c => c.numero === numero);
}

/**
 * Helper: Normalizar IDs de contemplaciones
 * Maneja la deduplicación de #9 y #22
 * 
 * Si se recibe 'contemplacion-9' o 'contemplacion-22', retorna 'contemplacion-9-22'
 */
export function normalizeContemplacionId(id: string): string {
  if (id === 'contemplacion-9' || id === 'contemplacion-22') {
    return 'contemplacion-9-22';
  }
  return id;
}

/**
 * Helper: Verificar si dos IDs de contemplación son duplicados
 * (es decir, si ambos se refieren a la misma contemplación unificada)
 */
export function areContemplacionesDuplicadas(id1: string, id2: string): boolean {
  const normalized1 = normalizeContemplacionId(id1);
  const normalized2 = normalizeContemplacionId(id2);
  return normalized1 === normalized2;
}

/**
 * Helper: Deduplicar lista de IDs de contemplaciones
 * Elimina duplicados y normaliza #9/#22 a contemplacion-9-22
 */
export function deduplicateContemplacionIds(ids: string[]): string[] {
  const normalized = ids.map(normalizeContemplacionId);
  return Array.from(new Set(normalized));
}

/**
 * Helper: Obtener contemplaciones aplicables para un contexto específico
 */
export function getContemplacionesForContext(
  context: 'clase' | 'evaluacion' | 'ambos'
): Contemplacion[] {
  if (context === 'ambos') {
    return CONTEMPLACIONES_CATALOG.filter(c => c.category === 'ambas');
  }
  
  return CONTEMPLACIONES_CATALOG.filter(c => {
    if (c.category === 'ambas') return true;
    if (context === 'clase' && c.category === 'clase') return true;
    if (context === 'evaluacion' && c.category === 'evaluaciones') return true;
    return false;
  });
}








