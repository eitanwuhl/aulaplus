// Datos mock para la demo: grupos y alumnos
// Extraídos de la pantalla Index.tsx para uso compartido

export interface HistorialMateria {
  nombre: string;
  calificacion: string;
}

export interface HistorialAcademico {
  año: string;
  materias: HistorialMateria[];
}

export interface EvaluacionCualitativa {
  fecha: string;
  evaluador: string;
  area: string;
  comentario: string;
  tipo: 'docente' | 'psicopedagogico';
}

/** Resultados de evaluaciones cargados en el perfil (seed → profile_data). */
export interface ResultadoEvaluacion {
  fecha: string;
  materia: string;
  trimestre: string;
  nota: number;
  versionEvaluacion: number;
  observacion: string;
}

export interface EvolucionPeriodo {
  año: string;
  trimestre: string;
  materias: { nombre: string; calificacion: number }[];
}

/** Demo default; copied into profile_data when seeding if absent per student. */
export const DEFAULT_EVOLUCION_DETALLADA: EvolucionPeriodo[] = [
  {
    año: '2023',
    trimestre: 'T1',
    materias: [
      { nombre: 'Matemática', calificacion: 6.5 },
      { nombre: 'Lengua', calificacion: 6.0 },
      { nombre: 'Historia', calificacion: 7.5 },
      { nombre: 'Ciencias', calificacion: 7.0 },
    ],
  },
  {
    año: '2023',
    trimestre: 'T2',
    materias: [
      { nombre: 'Matemática', calificacion: 7.0 },
      { nombre: 'Lengua', calificacion: 6.5 },
      { nombre: 'Historia', calificacion: 8.0 },
      { nombre: 'Ciencias', calificacion: 7.5 },
    ],
  },
  {
    año: '2023',
    trimestre: 'T3',
    materias: [
      { nombre: 'Matemática', calificacion: 7.5 },
      { nombre: 'Lengua', calificacion: 6.5 },
      { nombre: 'Historia', calificacion: 8.5 },
      { nombre: 'Ciencias', calificacion: 7.5 },
    ],
  },
  {
    año: '2024',
    trimestre: 'T1',
    materias: [
      { nombre: 'Matemática', calificacion: 8.0 },
      { nombre: 'Lengua', calificacion: 6.8 },
      { nombre: 'Historia', calificacion: 8.8 },
      { nombre: 'Ciencias', calificacion: 8.0 },
    ],
  },
  {
    año: '2024',
    trimestre: 'T2',
    materias: [
      { nombre: 'Matemática', calificacion: 8.2 },
      { nombre: 'Lengua', calificacion: 7.0 },
      { nombre: 'Historia', calificacion: 9.0 },
      { nombre: 'Ciencias', calificacion: 8.2 },
    ],
  },
  {
    año: '2024',
    trimestre: 'T3',
    materias: [
      { nombre: 'Matemática', calificacion: 8.5 },
      { nombre: 'Lengua', calificacion: 7.0 },
      { nombre: 'Historia', calificacion: 9.0 },
      { nombre: 'Ciencias', calificacion: 8.0 },
    ],
  },
];

/** Demo default; copied into profile_data when seeding if absent per student. */
export const DEFAULT_RESULTADOS_EVALUACION: ResultadoEvaluacion[] = [
  {
    fecha: 'Noviembre 2024',
    materia: 'Historia',
    trimestre: 'Tercer Trimestre',
    nota: 8,
    versionEvaluacion: 1,
    observacion:
      'Demostró un excelente manejo de los contenidos utilizando las imágenes de apoyo. Se sintió cómodo con las consignas más breves y pudo concentrarse mejor con el tiempo adicional otorgado.',
  },
  {
    fecha: 'Octubre 2024',
    materia: 'Matemática',
    trimestre: 'Tercer Trimestre',
    nota: 7,
    versionEvaluacion: 2,
    observacion:
      'Se sintió cómodo expresando sus conocimientos mediante modalidad de opción múltiple, lo cual no había podido desarrollar de la manera deseada cuando se le había pedido desarrollar en otras instancias.',
  },
  {
    fecha: 'Septiembre 2024',
    materia: 'Lengua',
    trimestre: 'Segundo Trimestre',
    nota: 6,
    versionEvaluacion: 1,
    observacion:
      'Mostró mejoras con el uso de apoyos visuales. Aún requiere más tiempo para organizar sus ideas por escrito, pero las consignas más breves le permitieron expresarse mejor.',
  },
];

export type ObjetivoEstado = 'en_progreso' | 'completado' | 'pendiente';

export interface DashboardObjetivo {
  id: number;
  descripcion: string;
  estado: ObjetivoEstado;
  progreso: number;
  fechaLimite: string;
}

export interface DashboardMetricas {
  promedioGeneral: number;
  promedioAnterior: number;
  mejorMateria: { nombre: string; nota: number };
  materiaRiesgo: { nombre: string; nota: number };
  objetivosCumplidos: number;
  objetivosTotales: number;
  progresoAnual: number;
}

export interface ProgresoMateria {
  materia: string;
  actual: number;
  objetivo: number;
  progreso: number;
}

export interface EfectividadContemplacion {
  name: string;
  value: number;
  color: string;
}

/** Dashboard de evolución (métricas, objetivos, gráficos) — seed → profile_data. */
export interface DashboardEvolucionData {
  metricas: DashboardMetricas;
  progresoMaterias: ProgresoMateria[];
  efectividadContemplaciones: EfectividadContemplacion[];
  objetivos: DashboardObjetivo[];
}

const DEFAULT_OBJETIVOS: DashboardObjetivo[] = [
  {
    id: 1,
    descripcion: 'Mejorar comprensión lectora',
    estado: 'en_progreso',
    progreso: 65,
    fechaLimite: '2024-12-15',
  },
  {
    id: 2,
    descripcion: 'Reducir ansiedad evaluativa',
    estado: 'completado',
    progreso: 100,
    fechaLimite: '2024-11-30',
  },
  {
    id: 3,
    descripcion: 'Fortalecer autonomía en tareas',
    estado: 'completado',
    progreso: 100,
    fechaLimite: '2024-10-15',
  },
  {
    id: 4,
    descripcion: 'Desarrollar habilidades sociales',
    estado: 'completado',
    progreso: 100,
    fechaLimite: '2024-09-30',
  },
  {
    id: 5,
    descripcion: 'Mejorar organización personal',
    estado: 'en_progreso',
    progreso: 45,
    fechaLimite: '2024-12-30',
  },
];

const DEFAULT_PROGRESO_MATERIAS: ProgresoMateria[] = [
  { materia: 'Matemática', actual: 8.5, objetivo: 8.0, progreso: 106 },
  { materia: 'Lengua', actual: 7.0, objetivo: 8.0, progreso: 88 },
  { materia: 'Historia', actual: 9.0, objetivo: 8.5, progreso: 106 },
  { materia: 'Ciencias', actual: 8.0, objetivo: 8.0, progreso: 100 },
];

const DEFAULT_EFECTIVIDAD: EfectividadContemplacion[] = [
  { name: 'Muy efectiva', value: 40, color: '#10b981' },
  { name: 'Efectiva', value: 35, color: '#3b82f6' },
  { name: 'Parcialmente efectiva', value: 20, color: '#f59e0b' },
  { name: 'Poco efectiva', value: 5, color: '#ef4444' },
];

/** Builds demo dashboard metrics using student catalog fields when available. */
export function buildDefaultDashboardEvolucion(student?: {
  promedio?: number;
  progreso?: number;
}): DashboardEvolucionData {
  const promedioGeneral = student?.promedio ?? 7.8;
  const promedioAnterior = Math.max(0, Math.round((promedioGeneral - 0.6) * 10) / 10);
  const progresoAnual = student?.progreso ?? 78;

  const progresoMaterias = DEFAULT_PROGRESO_MATERIAS.map((m) => {
    const delta = promedioGeneral - 7.8;
    const actual = Math.min(10, Math.max(0, Math.round((m.actual + delta) * 10) / 10));
    const progreso = Math.round((actual / m.objetivo) * 100);
    return { ...m, actual, progreso };
  });

  const sorted = [...progresoMaterias].sort((a, b) => b.actual - a.actual);

  return {
    metricas: {
      promedioGeneral,
      promedioAnterior,
      mejorMateria: { nombre: sorted[0].materia, nota: sorted[0].actual },
      materiaRiesgo: { nombre: sorted[sorted.length - 1].materia, nota: sorted[sorted.length - 1].actual },
      objetivosCumplidos: DEFAULT_OBJETIVOS.filter((o) => o.estado === 'completado').length,
      objetivosTotales: DEFAULT_OBJETIVOS.length,
      progresoAnual,
    },
    progresoMaterias,
    efectividadContemplaciones: DEFAULT_EFECTIVIDAD,
    objetivos: DEFAULT_OBJETIVOS,
  };
}

export const DEFAULT_DASHBOARD_EVOLUCION = buildDefaultDashboardEvolucion();

export interface InformeTecnico {
  sintesis: string | { title: string; bullets: string[] }[];  // New: support accordion cards OR legacy string
  estiloAprendizaje: string;
  objetivosPriorizados: string[];
  modalidadCursado: string;
  ajustesProgramaticos: { materia: string; ajustes: string[] }[];
  requiereAdecuacionAcceso?: boolean;  // Explicit flag: student requires access accommodations (time, format, supports), but NOT content changes
  requiereAdecuacionContenido?: boolean;  // Explicit flag: student has formally declared content adaptation
}

export interface Student {
  id: number;
  name: string;
  perfil: string;
  ajustes?: string;
  progreso?: number;
  promedio?: number;
  tendencia?: 'up' | 'down' | 'stable';
  alertas?: string[];
  avatar: string;
  contemplaciones: string[];
  anotaciones?: string;
  seguimiento?: string[];
  historialAcademico?: HistorialAcademico[];
  evaluacionesCualitativas?: EvaluacionCualitativa[];
  resultadosEvaluaciones?: ResultadoEvaluacion[];
  evolucionDetallada?: EvolucionPeriodo[];
  dashboardEvolucion?: DashboardEvolucionData;
  informeTecnico?: InformeTecnico;
}

export interface TeacherSugerencias {
  aula?: string;
  evaluaciones?: string;
  otras?: string;
}

export interface Group {
  id: string;  // Changed from number to string for consistency with UI selectors and URL params
  name: string;
  studentCount: number;
  year: string;
  section: string;
  students: Student[];
  teacher_sugerencias?: TeacherSugerencias;
}

// Template system types
export interface PlantillaReporte {
  id: string;
  nombre: string;
  descripcion: string;
  secciones: {
    datosBasicos: boolean;
    rendimientoAcademico: boolean;
    contemplaciones: boolean;
    evolucion: boolean;
    recomendaciones: boolean;
    informeTecnico: boolean;
    alertas: boolean;
    comentarios: boolean;
  };
  comentariosDefault: string;
  fechaCreacion: Date;
  esDefault: boolean;
  esFavorita: boolean;
}

export const mockStudents: Student[] = [
  {
    id: 1,
    name: "Ana García",
    perfil: "Visual-Kinestésico",
    ajustes: "Tiempo extendido, Contenido visual",
    progreso: 85,
    promedio: 8.1,
    tendencia: 'up',
    alertas: ["Necesita apoyo adicional en comprensión lectora", "Monitorear ansiedad evaluativa"],
    avatar: "👩🏻‍🎓",
    contemplaciones: [
      "Lectura oral de consignas",
      "Tiempo adicional y pausas",
      "Palabras clave en negrita e íconos de apoyo",
    ],
    anotaciones:
      "Se pone muy ansioso en situaciones de evaluación escrita. Responde mejor oralmente.",
    seguimiento: [
      "Mostró avances notables con el uso de apoyos visuales",
      "Requiere más acompañamiento para consignas extensas",
    ],
    historialAcademico: [
      {
        año: "9º Año (2024)",
        materias: [
          { nombre: "Matemática", calificacion: "8.5" },
          { nombre: "Lengua", calificacion: "7.0" },
          { nombre: "Historia", calificacion: "9.0" },
          { nombre: "Ciencias", calificacion: "8.0" },
        ],
      },
      {
        año: "8º Año (2023)",
        materias: [
          { nombre: "Matemática", calificacion: "7.5" },
          { nombre: "Lengua", calificacion: "6.5" },
          { nombre: "Historia", calificacion: "8.5" },
          { nombre: "Ciencias", calificacion: "7.5" },
        ],
      },
    ],
    evaluacionesCualitativas: [
      {
        fecha: "Noviembre 2024",
        evaluador: "Equipo Psicopedagógico",
        area: "Evaluación Integral",
        comentario:
          "Ana muestra mejores resultados cuando se le proporcionan apoyos visuales y tiempo adicional. Su ansiedad ante evaluaciones escritas ha disminuido con las contemplaciones implementadas.",
        tipo: "psicopedagogico",
      },
      {
        fecha: "15 Oct 2024",
        evaluador: "Prof. Ana García (Matemática)",
        area: "Matemática - Resolución de problemas",
        comentario:
          "Ha mejorado notablemente en la comprensión de problemas algebraicos desde que implementamos las contemplaciones visuales. Utiliza el material concreto de manera efectiva y su nivel de ansiedad durante las evaluaciones ha disminuido considerablemente.",
        tipo: "docente",
      },
      {
        fecha: "8 Oct 2024",
        evaluador: "Lic. María Rodriguez (Psicopedagoga)",
        area: "Evaluación integral",
        comentario:
          "Se observa un progreso significativo en su autoestima académica. Las estrategias de apoyo implementadas han permitido que exprese mejor sus conocimientos. Recomiendo continuar con el enfoque multimodal y considerar la ampliación de tiempo en evaluaciones escritas.",
        tipo: "psicopedagogico",
      },
      {
        fecha: "25 Sep 2024",
        evaluador: "Prof. Carlos Mendez (Historia)",
        area: "Historia - Comprensión temporal",
        comentario:
          "Excelente respuesta a las líneas de tiempo visuales y mapas conceptuales. Su capacidad para establecer relaciones causa-efecto ha mejorado sustancialmente. Sugiero continuar con recursos gráficos para consolidar aprendizajes complejos.",
        tipo: "docente",
      },
      {
        fecha: "12 Sep 2024",
        evaluador: "Prof. Laura Vega (Lengua)",
        area: "Lengua - Expresión escrita",
        comentario:
          "Muestra progreso en la organización de ideas cuando utiliza esquemas previos. La implementación de borradores estructurados ha mejorado significativamente la coherencia de sus textos. Requiere continuar trabajando la revisión ortográfica con apoyo tecnológico.",
        tipo: "docente",
      },
      {
        fecha: "3 Sep 2024",
        evaluador: "Prof. Roberto Silva (Ciencias)",
        area: "Ciencias Naturales - Experimentación",
        comentario:
          "Demuestra gran interés y habilidad en actividades prácticas de laboratorio. Su comprensión mejora notablemente cuando puede manipular materiales y observar fenómenos directamente. Recomiendo priorizar aprendizaje experimental sobre contenido teórico extenso.",
        tipo: "docente",
      },
    ],
    informeTecnico: {
      sintesis: [
        {
          title: "Potencial Intelectual",
          bullets: ["Posee un potencial intelectual mayor al que está manifestando, debido a diversos factores que inciden en su rendimiento."]
        },
        {
          title: "Rendimiento Cognitivo",
          bullets: [
            "Su performance es comparativamente superior en la inteligencia no verbal respecto a la verbal.",
            "Logra mayores niveles de conceptualización, deducción y abstracción con estímulos no verbales (apoyo icónico o material manipulativo)."
          ]
        },
        {
          title: "Polo Comprensivo",
          bullets: ["Requiere la explicitación de las consignas en forma simplificada, tanto si se brindan de forma oral como escrita."]
        },
        {
          title: "Lenguaje Escrito",
          bullets: [
            "Se observan características congruentes con una dificultad específica en lectoescritura.",
            "Necesidad de evaluar el abordaje frente al conflicto cognitivo, las estrategias que aplica y su grado de inseguridad frente al estudio/tareas escritas, para determinar si se trata de una alteración a nivel global del lenguaje."
          ]
        },
        {
          title: "Área Lógico-Matemática",
          bullets: [
            "Se observan dificultades asociadas al sentido de las operaciones.",
            "Dificultad en la resolución correcta de situaciones problemáticas por falta de flexibilidad en la aplicación de estrategias."
          ]
        }
      ],
      estiloAprendizaje: "Visual-Kinestésico: procesa mejor la información a través de imágenes, esquemas y actividades prácticas.",
      objetivosPriorizados: ["Reducir ansiedad evaluativa", "Fortalecer comprensión lectora", "Desarrollar autonomía"],
      modalidadCursado: "Común con apoyos específicos",
      ajustesProgramaticos: [],
      requiereAdecuacionAcceso: true,
      requiereAdecuacionContenido: false
    }
  },
  {
    id: 2,
    name: "Carlos López",
    perfil: "Auditivo-Lector/escritor",
    ajustes: "Explicaciones orales, Resúmenes escritos",
    progreso: 92,
    promedio: 8.75,
    tendencia: 'up',
    avatar: "👨🏻‍🎓",
    contemplaciones: [
      "Lectura oral de consignas",
      "Respuesta oral alternativa (cuando corresponda)",
      "Monitoreo docente y andamiaje (verificación de comprensión)",
    ],
    anotaciones:
      "Excelente comprensión oral. Prefiere discusiones y explicaciones verbales antes que material escrito extenso.",
    seguimiento: [
      "Destaca en debates y presentaciones orales",
      "Necesita refuerzo en escritura estructurada",
    ],
    historialAcademico: [
      {
        año: "9º Año (2024)",
        materias: [
          { nombre: "Matemática", calificacion: "9.0" },
          { nombre: "Lengua", calificacion: "8.5" },
          { nombre: "Historia", calificacion: "9.5" },
          { nombre: "Ciencias", calificacion: "8.0" },
        ],
      },
    ],
    evaluacionesCualitativas: [
      {
        fecha: "Octubre 2024",
        evaluador: "Prof. María González",
        area: "Historia",
        comentario: "Carlos demuestra excelente comprensión en debates orales. Sus aportes son reflexivos y bien fundamentados.",
        tipo: "docente",
      },
    ],
    informeTecnico: {
      sintesis: [
        {
          title: "Disposición y Adaptación al Trabajo",
          bullets: [
            "Logra ajustarse al encuadre de trabajo.",
            "Se muestra disponible y colaborador."
          ]
        },
        {
          title: "Potencial Intelectual",
          bullets: [
            "Posee un potencial intelectual habilitador que le confiere excelentes posibilidades para enfrentarse a los diferentes desafíos cognitivos.",
            "No obstante, su potencial intelectual dista de su rendimiento real."
          ]
        },
        {
          title: "Recursos Cognitivos (Fortalezas)",
          bullets: ["Cuenta con muy buenos recursos para el razonamiento y la abstracción, tanto verbal como no verbal, de la información."]
        },
        {
          title: "Debilidades del Perfil Cognitivo y su Evidencia Académica",
          bullets: [
            "Los aspectos de la memoria de trabajo y la velocidad de procesamiento se constituyen en debilidades de su perfil.",
            "Estas debilidades se evidencian específicamente en su rendimiento académico, evaluado a través de las áreas instrumentales."
          ]
        },
        {
          title: "Estilo de Aprendizaje y Adaptación a Novedades",
          bullets: [
            "Presenta un estilo de aprendizaje estructurado, algo rígido.",
            "Enfrentarse a tareas novedosas y llevarlas a cabo le insume un marcado tiempo de adaptación."
          ]
        },
        {
          title: "Manejo del Conflicto Cognitivo y Habilidades Pragmáticas",
          bullets: [
            "Las debilidades a nivel de la pragmática del lenguaje, sumadas a su estilo de aprendizaje, generan un modo de enfrentar el conflicto cognitivo en el que puede perder eficacia.",
            "Manifiesta dificultad para pedir ayuda a un adulto o a un par."
          ]
        },
        {
          title: "Diagnóstico y Congruencia del Perfil",
          bullets: ["De acuerdo con sus antecedentes y los resultados obtenidos, se desprende un perfil congruente con un Síndrome Disejecutivo."]
        },
        {
          title: "Definición y Alcance del Síndrome Disejecutivo",
          bullets: [
            "Implica una alteración en las funciones ejecutivas, las cuales abarcan:",
            "Procesos cognitivos: planificación, programación, autorregulación, autocontrol y uso de la retroalimentación.",
            "Procesos emocionales: vinculados a la motivación y a la regulación de sus conductas en función de ésta y de sus emociones."
          ]
        },
        {
          title: "Impacto Específico en la Escritura",
          bullets: ["Esta alteración ha afectado, entre otros procesos, la correcta automatización de la praxia de la escritura, comprometiendo la legibilidad de la misma."]
        }
      ],
      estiloAprendizaje: "Auditivo-Lector/escritor: aprende mejor a través de explicaciones verbales y refuerza con material escrito.",
      objetivosPriorizados: ["Fortalecer escritura estructurada", "Desarrollar síntesis escrita", "Mantener fortalezas orales"],
      modalidadCursado: "Común con privilegio de instancias orales",
      ajustesProgramaticos: [],
      requiereAdecuacionAcceso: true,
      requiereAdecuacionContenido: false
    }
  },
  {
    id: 3,
    name: "María Rodríguez",
    perfil: "Visual-Lector/escritor",
    ajustes: "Organizadores gráficos, Mapas conceptuales",
    progreso: 88,
    promedio: 8.5,
    tendencia: 'up',
    avatar: "👩🏽‍🎓",
    contemplaciones: [
      "Palabras clave en negrita e íconos de apoyo",
      "Segmentación de consignas en pasos numerados",
      "Hoja auxiliar / borrador permitido",
    ],
    anotaciones:
      "Muy organizada y metódica. Responde excelente a estructuras visuales claras y secuencias ordenadas.",
    seguimiento: [
      "Mejoramiento notable con organizadores gráficos",
      "Autonomía creciente en planificación de tareas",
    ],
    historialAcademico: [
      {
        año: "9º Año (2024)",
        materias: [
          { nombre: "Matemática", calificacion: "8.0" },
          { nombre: "Lengua", calificacion: "9.0" },
          { nombre: "Historia", calificacion: "8.5" },
          { nombre: "Ciencias", calificacion: "8.5" },
        ],
      },
    ],
    evaluacionesCualitativas: [
      {
        fecha: "Septiembre 2024",
        evaluador: "Equipo Psicopedagógico",
        area: "Estrategias de Aprendizaje",
        comentario: "María muestra excelente aprovechamiento de las estrategias visuales. Su organización ha mejorado significativamente.",
        tipo: "psicopedagogico",
      },
    ],
    informeTecnico: {
      sintesis: [
        {
          title: "Potencial",
          bullets: ["Posee un potencial intelectual habilitador con muy buenas posibilidades para desafíos cognitivos, pero no está logrando utilizarlo plenamente debido a factores cognitivos y extracognitivos."]
        },
        {
          title: "Perfil Cognitivo",
          bullets: [
            "Rendimiento Homogéneo: Perfil equilibrado en razonamiento verbal, no verbal, memoria operativa y velocidad de procesamiento (no se destacan puntos fuertes ni débiles en su propio perfil).",
            "Mayor Beneficio: Despliega su potencial de forma eficaz al apoyarse en el procesamiento no verbal acompañado de lo icónico."
          ]
        },
        {
          title: "Lenguaje Escrito (Dislexia)",
          bullets: [
            "Rendimiento descendido en lectura y escritura.",
            "Afectación en ambas rutas de acceso al léxico (fonológica y léxica).",
            "Tipología de errores específica y congruente con Dislexia",
            "Obstáculos comprensivos: escasa eficiencia en técnicas de estudio y necesidad de regular la información con un otro al leer textos complejos."
          ]
        },
        {
          title: "Área Lógico-Matemática",
          bullets: [
            "Mayor debilidad en automatizaciones y cálculo.",
            "Dificultad para seleccionar, ordenar y organizar la información necesaria para resolver situaciones problemáticas.",
            "Estas debilidades se consideran secundarias a características de su perfil cognitivo."
          ]
        },
        {
          title: "Factores Emocionales y Metacognitivos",
          bullets: [
            "Impacto Emocional: La predisposición al fracaso y la percepción de competencias asociadas al \"no poder\" en el área matemática interfieren significativamente, condicionando su motivación y persistencia.",
            "Intervención Necesaria: Es fundamental intervenir tanto sobre los procesos instrumentales comprometidos como sobre los aspectos emocionales y actitudinales asociados, promoviendo experiencias de éxito para favorecer la confianza en sus capacidades."
          ]
        },
        {
          title: "Conclusión General",
          bullets: [
            "Recursos Suficientes: Cuenta con recursos cognitivos para afrontar adecuadamente la escolaridad secundaria.",
            "Requerimientos: Las dificultades específicas (lectura, escritura, automatización matemática) sumadas a las variables de orden emocional y metacognitivo, exigen un acompañamiento sistemático y adecuaciones pedagógicas para que pueda desplegar su potencial de manera efectiva."
          ]
        }
      ],
      estiloAprendizaje: "Visual-Lector/escritor: procesa eficientemente información presentada de manera visual y estructurada.",
      objetivosPriorizados: ["Potenciar habilidades de síntesis", "Desarrollar presentaciones orales", "Mantener organización visual"],
      modalidadCursado: "Común con énfasis en organizadores gráficos",
      ajustesProgramaticos: [],
      requiereAdecuacionAcceso: true,
      requiereAdecuacionContenido: false
    }
  },
  {
    id: 4,
    name: "Diego Martínez",
    perfil: "Kinestésico-Visual",
    ajustes: "Actividades prácticas, Manipulación de objetos",
    progreso: 75,
    promedio: 7.25,
    tendencia: 'stable',
    alertas: ["Requiere apoyo constante en tareas complejas", "Necesita descansos frecuentes"],
    avatar: "👨🏻‍🎓",
    contemplaciones: [
      "Calculadora / material concreto cuando corresponda",
      "Tiempo adicional y pausas",
      "Monitoreo docente y andamiaje (verificación de comprensión)",
    ],
    anotaciones:
      "Necesita movimiento y actividades prácticas para mantener la concentración. Aprende mejor manipulando objetos.",
    seguimiento: [
      "Mayor participación con actividades hands-on",
      "Requiere breaks frecuentes para mantener atención",
    ],
    historialAcademico: [
      {
        año: "9º Año (2024)",
        materias: [
          { nombre: "Matemática", calificacion: "7.0" },
          { nombre: "Lengua", calificacion: "6.5" },
          { nombre: "Historia", calificacion: "7.5" },
          { nombre: "Ciencias", calificacion: "8.5" },
        ],
      },
    ],
    evaluacionesCualitativas: [
      {
        fecha: "Noviembre 2024",
        evaluador: "Prof. Roberto Silva",
        area: "Ciencias",
        comentario: "Diego destaca en experimentos y actividades de laboratorio. Su comprensión mejora notablemente con la práctica.",
        tipo: "docente",
      },
    ],
    informeTecnico: {
      sintesis: [
        {
          title: "Dificultades Generales y Presentación",
          bullets: [
            "Presenta significativas y persistentes dificultades de aprendizaje y en la interacción social.",
            "Se destaca su timidez y escasa permanencia de la mirada.",
            "Muestra una motilidad peculiar con rigidez postural.",
            "Sus expresiones verbales oscilan entre una iniciativa verbal muy reducida y la verborragia frente a temas que le generan gran interés.",
            "Su nivel de pensamiento es integrado, coherente y predominantemente realista."
          ]
        },
        {
          title: "Performance Intelectual",
          bullets: [
            "Su performance intelectual se ubica predominantemente muy por debajo de los valores promedio.",
            "Se observa variabilidad en su funcionamiento entre las distintas escalas y en la valoración de una misma función."
          ]
        },
        {
          title: "Perfil Cognitivo (Fortalezas Relativas y Debilidades)",
          bullets: [
            "Indica un mejor funcionamiento a la hora de comprender y utilizar información visoperceptiva y visoespacial en comparación con las destrezas de razonamiento verbal.",
            "Las destrezas de razonamiento verbal se ubican a nivel de deficiencia.",
            "En su procesamiento visoespacial, la capacidad de construcción mental no motora (razonamiento visoespacial, relación entre información visual y conceptos abstractos, rotación mental) se ubica por encima del manejo constructivo específico."
          ]
        },
        {
          title: "Dificultades Instrumentales y Práxicas",
          bullets: [
            "Se observan dificultades instrumentales persistentes y significativas para tareas manipulativas.",
            "Su funcionamiento práxico (copia de figuras, construcciones y grafía) se ubica muy por debajo de su edad cronológica."
          ]
        },
        {
          title: "Procesamiento de la Información Verbal y Lenguaje",
          bullets: [
            "El procesamiento de la información verbal se encuentra francamente comprometido.",
            "Se observan dificultades de evocación y sintácticas en el lenguaje oral y escrito, acompañadas de un bajo nivel lexical.",
            "Las dificultades en el acceso al vocabulario y en el procesamiento de la información entorpecen la comprensión y la expresión.",
            "Los diferentes niveles lingüísticos se encuentran afectados, fundamentalmente los semánticos.",
            "Las dificultades presentes en el lenguaje no son específicas, sino secundarias a una alteración global del desarrollo."
          ]
        },
        {
          title: "Rendimiento en Áreas Instrumentales (Lectura y Escritura)",
          bullets: [
            "En la lectura, presenta una velocidad muy descendida, aunque la precisión es buena. Muestra un descenso en los procesos semánticos y sintácticos.",
            "En la escritura (discurso escrito), elabora textos sencillos de escasa extensión, pero se mantienen las dificultades expresivas en vocabulario y sintaxis."
          ]
        },
        {
          title: "Atención y Funciones Ejecutivas",
          bullets: [
            "Presenta un patrón de desempeño atencional extremadamente comprometido para su edad, con pobre control inhibitorio y escasa permanencia de focalización atencional frente a estímulos tanto verbales como visuales.",
            "Requiere de sostén a través del estímulo externo. Específicamente, la estimulación en relación a sus logros mejora su interés y su performance.",
            "No se observa oposicionismo, pero sí recurre con insistencia a mecanismos para evitar la realización de las tareas (cansancio, aburrimiento, etc.).",
            "Su capacidad de organización, planificación y flexibilidad cognitiva presenta un funcionamiento muy variable y por lo general descendido, vinculado a sus dificultades instrumentales a nivel del lenguaje y práxicas."
          ]
        },
        {
          title: "Perfil Mnésico (Memoria)",
          bullets: [
            "La memoria de trabajo se constituye en una verdadera fortaleza, con un marcado sesgo a favor de la retención de información visual.",
            "La diferencia entre el tipo de estímulo utilizado (visual vs. verbal) persiste tanto a nivel inmediato como diferido, alcanzando niveles de normalidad baja en la retención de información visual.",
            "No presenta dificultades significativas para la codificación de caras, ni para su discriminación y reconocimiento, ni para el aprendizaje y recuerdo demorado de nombres (etiquetas verbales), y se beneficia de los ensayos de aprendizaje reteniendo lo aprendido.",
            "Presenta sin embargo un span de memoria verbal muy descendido para la edad, le cuesta conservar listas de palabras en estado activo con un marcado efecto de interferencia.",
            "Sus mayores dificultades se ubican a nivel de la codificación y evocación de una narración en condiciones de recuerdo libre, indicando un bajo rendimiento a nivel de memoria declarativa para información verbal.",
            "Los relatos son confusos y extremadamente pobres, logrando retener solo las ideas centrales del texto referido con ausencia significativa de detalles."
          ]
        },
        {
          title: "Perfil Afectivo-Emocional y Social",
          bullets: [
            "Presenta un nivel de autonomía e intereses que distan significativamente de lo esperado en función de su edad cronológica.",
            "Percibe sus dificultades a nivel académico y es extremadamente sensible a las manifestaciones de aprobación en su rendimiento, así como a la percepción de sus logros.",
            "Su inhabilidad en el intercambio social persiste, a pesar de los avances logrados y reconocidos por él."
          ]
        }
      ],
      estiloAprendizaje: "Kinestésico-Concreto: requiere experiencias de aprendizaje simplificadas, secuenciadas y con apoyo visual constante.",
      objetivosPriorizados: ["Contenidos esenciales y funcionales", "Desarrollo de habilidades para la vida", "Fortalecimiento de la autoestima"],
      modalidadCursado: "Común con adecuaciones curriculares significativas de contenido",
      ajustesProgramaticos: [
        { materia: "Todas", ajustes: ["Contenidos priorizados y simplificados", "Objetivos de aprendizaje específicos", "Evaluaciones adaptadas al nivel de desarrollo"] },
        { materia: "Matemática", ajustes: ["Operaciones básicas funcionales", "Conceptos concretos aplicados a la vida diaria", "Uso de calculadora y material manipulativo"] },
        { materia: "Lengua", ajustes: ["Textos adaptados de menor complejidad", "Vocabulario esencial", "Comprensión lectora básica"] },
        { materia: "Ciencias/Historia", ajustes: ["Conceptos centrales simplificados", "Información presentada paso a paso", "Relación con experiencias cotidianas"] }
      ],
      requiereAdecuacionAcceso: false,
      requiereAdecuacionContenido: true
    }
  },
  {
    id: 5,
    name: "Sofía Fernández",
    perfil: "Lector/escritor-Auditivo",
    ajustes: "Textos estructurados, Discusiones grupales",
    progreso: 94,
    promedio: 8.75,
    tendencia: 'up',
    avatar: "👩🏻‍🎓",
    contemplaciones: [
      "Lectura oral de consignas",
      "Corrección centrada en contenido (no forma)",
      "Hoja auxiliar / borrador permitido",
    ],
    anotaciones:
      "Excelente en análisis de textos y escritura académica. Disfruta de discusiones intelectuales y debates.",
    seguimiento: [
      "Liderazgo natural en trabajos grupales",
      "Capacidad analítica superior al promedio",
    ],
    historialAcademico: [
      {
        año: "9º Año (2024)",
        materias: [
          { nombre: "Matemática", calificacion: "8.5" },
          { nombre: "Lengua", calificacion: "9.5" },
          { nombre: "Historia", calificacion: "9.0" },
          { nombre: "Ciencias", calificacion: "8.0" },
        ],
      },
    ],
    evaluacionesCualitativas: [
      {
        fecha: "Octubre 2024",
        evaluador: "Prof. Ana Morales",
        area: "Lengua",
        comentario: "Sofía demuestra una capacidad excepcional para el análisis literario y la producción textual académica.",
        tipo: "docente",
      },
    ],
    // Sin informe técnico específico
  },
  {
    id: 6,
    name: "Joaquín Torres",
    perfil: "Auditivo-Kinestésico",
    ajustes: "Explicaciones verbales, Experimentos",
    progreso: 82,
    avatar: "👨🏽‍🎓",
    contemplaciones: [
      "Lectura oral de consignas",
      "Respuesta oral alternativa (cuando corresponda)",
      "Calculadora / material concreto cuando corresponda",
    ],
    anotaciones:
      "Aprende mejor a través de explicaciones orales seguidas de práctica inmediata. Le gusta hacer preguntas.",
    seguimiento: [
      "Participación activa en clases expositivas",
      "Buenos resultados en evaluaciones orales",
    ],
    historialAcademico: [
      {
        año: "9º Año (2024)",
        materias: [
          { nombre: "Matemática", calificacion: "8.0" },
          { nombre: "Lengua", calificacion: "7.5" },
          { nombre: "Historia", calificacion: "8.5" },
          { nombre: "Ciencias", calificacion: "9.0" },
        ],
      },
    ],
    evaluacionesCualitativas: [
      {
        fecha: "Septiembre 2024",
        evaluador: "Equipo Psicopedagógico",
        area: "Modalidades de Aprendizaje",
        comentario: "Joaquín muestra excelente progreso combinando explicaciones orales con actividades experimentales.",
        tipo: "psicopedagogico",
      },
    ],
    // Sin informe técnico específico
  },
  {
    id: 7,
    name: "Valentina Castro",
    perfil: "Visual-Auditivo",
    ajustes: "Presentaciones multimedia, Música de fondo",
    progreso: 89,
    avatar: "👩🏻‍🎓",
    contemplaciones: [
      "Palabras clave en negrita e íconos de apoyo",
      "Letra ampliada y alto contraste",
      "Lectura oral de consignas",
    ],
    anotaciones:
      "Responde muy bien a estímulos audiovisuales. La música suave la ayuda a concentrarse durante el trabajo individual.",
    seguimiento: [
      "Excelente retención con material multimedia",
      "Creatividad destacada en proyectos artísticos",
    ],
    historialAcademico: [
      {
        año: "9º Año (2024)",
        materias: [
          { nombre: "Matemática", calificacion: "7.5" },
          { nombre: "Lengua", calificacion: "8.5" },
          { nombre: "Historia", calificacion: "9.0" },
          { nombre: "Ciencias", calificacion: "8.0" },
        ],
      },
    ],
    evaluacionesCualitativas: [
      {
        fecha: "Octubre 2024",
        evaluador: "Prof. Carmen Díaz",
        area: "Historia",
        comentario: "Valentina sobresale en presentaciones que combinan elementos visuales y narrativos. Su creatividad enriquece las clases.",
        tipo: "docente",
      },
    ],
    // Sin informe técnico específico
  },
  {
    id: 8,
    name: "Mateo Silva",
    perfil: "Kinestésico-Lector/escritor",
    ajustes: "Actividades de escritura activa, Movimiento",
    progreso: 78,
    avatar: "👨🏻‍🎓",
    contemplaciones: [
      "Tiempo adicional y pausas",
      "Hoja auxiliar / borrador permitido",
      "Monitoreo docente y andamiaje (verificación de comprensión)",
    ],
    anotaciones:
      "Necesita escribir y reescribir para procesar información. Los descansos activos mejoran su rendimiento.",
    seguimiento: [
      "Mejoramiento con técnicas de escritura activa",
      "Mayor concentración con breaks de movimiento",
    ],
    historialAcademico: [
      {
        año: "9º Año (2024)",
        materias: [
          { nombre: "Matemática", calificacion: "7.0" },
          { nombre: "Lengua", calificacion: "8.0" },
          { nombre: "Historia", calificacion: "7.5" },
          { nombre: "Ciencias", calificacion: "7.0" },
        ],
      },
    ],
    evaluacionesCualitativas: [
      {
        fecha: "Noviembre 2024",
        evaluador: "Equipo Psicopedagógico",
        area: "Estrategias de Procesamiento",
        comentario: "Mateo ha mostrado progreso significativo utilizando técnicas de escritura activa y pausas programadas.",
        tipo: "psicopedagogico",
      },
    ],
    // Sin informe técnico específico
  },
  {
    id: 9,
    name: "Isabella Morales",
    perfil: "Visual-Lector/escritor",
    ajustes: "Diagramas, Síntesis escritas",
    progreso: 91,
    avatar: "👩🏽‍🎓",
    contemplaciones: [
      "Palabras clave en negrita e íconos de apoyo",
      "Segmentación de consignas en pasos numerados",
      "Corrección centrada en contenido (no forma)",
    ],
    anotaciones:
      "Excelente para sintetizar información compleja en esquemas claros. Prefiere trabajar con material escrito bien estructurado.",
    seguimiento: [
      "Liderazgo en organización de información grupal",
      "Habilidades excepcionales para resumir y esquematizar",
    ],
    historialAcademico: [
      {
        año: "9º Año (2024)",
        materias: [
          { nombre: "Matemática", calificacion: "9.0" },
          { nombre: "Lengua", calificacion: "9.5" },
          { nombre: "Historia", calificacion: "8.5" },
          { nombre: "Ciencias", calificacion: "8.5" },
        ],
      },
    ],
    evaluacionesCualitativas: [
      {
        fecha: "Octubre 2024",
        evaluador: "Prof. Luis Herrera",
        area: "Matemática",
        comentario: "Isabella destaca por su capacidad para crear diagramas y esquemas que facilitan la comprensión de conceptos complejos.",
        tipo: "docente",
      },
    ],
    // Sin informe técnico específico
  },
  {
    id: 10,
    name: "Luciano Vega",
    perfil: "Auditivo-Visual",
    ajustes: "Debates estructurados, Gráficos comentados",
    progreso: 87,
    avatar: "👨🏻‍🎓",
    contemplaciones: [
      "Lectura oral de consignas",
      "Palabras clave en negrita e íconos de apoyo",
      "Respuesta oral alternativa (cuando corresponda)",
    ],
    anotaciones:
      "Combina muy bien la escucha activa con el procesamiento visual. Destaca en actividades que integran ambos canales.",
    seguimiento: [
      "Excelente participación en debates con apoyo visual",
      "Mejora notable cuando combina audio y gráficos",
    ],
    historialAcademico: [
      {
        año: "9º Año (2024)",
        materias: [
          { nombre: "Matemática", calificacion: "8.5" },
          { nombre: "Lengua", calificacion: "8.0" },
          { nombre: "Historia", calificacion: "9.0" },
          { nombre: "Ciencias", calificacion: "7.5" },
        ],
      },
    ],
    evaluacionesCualitativas: [
      {
        fecha: "Noviembre 2024",
        evaluador: "Prof. Elena Ruiz",
        area: "Historia",
        comentario: "Luciano demuestra excelente comprensión cuando se combinan explicaciones orales con mapas y gráficos históricos.",
        tipo: "docente",
      },
    ],
    // Sin informe técnico específico
  },
];

export const mockGroups: Group[] = [
  {
    id: "1",  // Changed to string for type consistency
    name: "9no 1",
    studentCount: 10,
    year: "9º Año",
    section: "1",
    students: mockStudents,
  },
  {
    id: "2",  // Changed to string for type consistency
    name: "9no 2",
    studentCount: 25,
    year: "9º Año",
    section: "2",
    students: [],
  },
  {
    id: "3",  // Changed to string for type consistency
    name: "9no 3",
    studentCount: 22,
    year: "9º Año",
    section: "3",
    students: [],
  },
];