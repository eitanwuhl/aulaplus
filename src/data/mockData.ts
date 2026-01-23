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

export interface InformeTecnico {
  sintesis: string;
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
    ],
    informeTecnico: {
      sintesis: "Estudiante con perfil visual-kinestésico que requiere apoyos específicos para el manejo de la ansiedad evaluativa.",
      estiloAprendizaje: "Visual-Kinestésico: procesa mejor la información a través de imágenes, esquemas y actividades prácticas.",
      objetivosPriorizados: ["Reducir ansiedad evaluativa", "Fortalecer comprensión lectora", "Desarrollar autonomía"],
      modalidadCursado: "Común con apoyos específicos",
      ajustesProgramaticos: [
        { materia: "Todas", ajustes: ["Tiempo adicional", "Apoyos visuales", "Segmentación de consignas"] }
      ]
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
      sintesis: "Estudiante con fortalezas en procesamiento auditivo que destaca en instancias de intercambio oral.",
      estiloAprendizaje: "Auditivo-Lector/escritor: aprende mejor a través de explicaciones verbales y refuerza con material escrito.",
      objetivosPriorizados: ["Fortalecer escritura estructurada", "Desarrollar síntesis escrita", "Mantener fortalezas orales"],
      modalidadCursado: "Común con privilegio de instancias orales",
      ajustesProgramaticos: [
        { materia: "Todas", ajustes: ["Explicaciones orales previas", "Evaluaciones orales complementarias", "Esquemas de apoyo para escritura"] }
      ]
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
      sintesis: "Estudiante con excelente capacidad de organización y síntesis que responde muy bien a estructuras visuales.",
      estiloAprendizaje: "Visual-Lector/escritor: procesa eficientemente información presentada de manera visual y estructurada.",
      objetivosPriorizados: ["Potenciar habilidades de síntesis", "Desarrollar presentaciones orales", "Mantener organización visual"],
      modalidadCursado: "Común con énfasis en organizadores gráficos",
      ajustesProgramaticos: [
        { materia: "Todas", ajustes: ["Organizadores gráficos", "Esquemas y mapas conceptuales", "Secuencias visuales"] }
      ]
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
      sintesis: "Estudiante con discapacidad intelectual leve que requiere adecuaciones curriculares de contenido para acceder al aprendizaje.",
      estiloAprendizaje: "Kinestésico-Concreto: requiere experiencias de aprendizaje simplificadas, secuenciadas y con apoyo visual constante.",
      objetivosPriorizados: ["Contenidos esenciales y funcionales", "Desarrollo de habilidades para la vida", "Fortalecimiento de la autoestima"],
      modalidadCursado: "Común con adecuaciones curriculares significativas de contenido",
      ajustesProgramaticos: [
        { materia: "Todas", ajustes: ["Contenidos priorizados y simplificados", "Objetivos de aprendizaje específicos", "Evaluaciones adaptadas al nivel de desarrollo"] },
        { materia: "Matemática", ajustes: ["Operaciones básicas funcionales", "Conceptos concretos aplicados a la vida diaria", "Uso de calculadora y material manipulativo"] },
        { materia: "Lengua", ajustes: ["Textos adaptados de menor complejidad", "Vocabulario esencial", "Comprensión lectora básica"] },
        { materia: "Ciencias/Historia", ajustes: ["Conceptos centrales simplificados", "Información presentada paso a paso", "Relación con experiencias cotidianas"] }
      ]
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