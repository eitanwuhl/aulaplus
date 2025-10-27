// Competencias Específicas y Criterios de Logro para Historia 9º grado - ANEP
// Basado en el documento oficial del programa

export interface CompetenciaEspecifica {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  criteriosLogro: CriterioLogro[];
}

export interface CriterioLogro {
  id: string;
  codigo: string;
  descripcion: string;
}

export const COMPETENCIAS_HISTORIA: CompetenciaEspecifica[] = [
  {
    id: "ce1",
    codigo: "CE1",
    nombre: "Interpreta e interrelaciona de forma crítica información proveniente de distintas fuentes históricas e historiográficas",
    descripcion: "Interpreta e interrelaciona de forma crítica información proveniente de distintas fuentes históricas e historiográficas.",
    criteriosLogro: [
      {
        id: "cl1_1",
        codigo: "CL1.1",
        descripcion: "Contrasta fuentes históricas e historiográficas construyendo una mirada personal."
      },
      {
        id: "cl1_2", 
        codigo: "CL1.2",
        descripcion: "Interrelaciona distintas posiciones historiográficas con argumentos y es capaz de elaborar una posición propia."
      }
    ]
  },
  {
    id: "ce2",
    codigo: "CE2",
    nombre: "Construye una oralidad y escritura autónoma argumentando con la utilización del vocabulario histórico",
    descripcion: "Construye una oralidad y escritura autónoma argumentando con la utilización del vocabulario histórico.",
    criteriosLogro: [
      {
        id: "cl2_1",
        codigo: "CL2.1",
        descripcion: "Elabora una oralidad y una escritura argumentada incorporando el vocabulario histórico."
      },
      {
        id: "cl2_2",
        codigo: "CL2.2", 
        descripcion: "Produce un relato sobre una situación histórica poniendo en juego conceptos históricos."
      }
    ]
  },
  {
    id: "ce3",
    codigo: "CE3", 
    nombre: "Indaga la realidad social con herramientas propias de la disciplina formulando proyectos a partir de sus intereses en diálogo con las manifestaciones culturales y patrimoniales del pasado",
    descripcion: "Indaga la realidad social con herramientas propias de la disciplina formulando proyectos a partir de sus intereses en diálogo con las manifestaciones culturales y patrimoniales del pasado.",
    criteriosLogro: [
      {
        id: "cl3_1",
        codigo: "CL3.1",
        descripcion: "Diseña sus propias preguntas y proyectos de indagación de contenido histórico."
      },
      {
        id: "cl3_2", 
        codigo: "CL3.2",
        descripcion: "Traspone herramientas propias de la metodología de investigación en historia a otras áreas de conocimiento."
      },
      {
        id: "cl3_3", 
        codigo: "CL3.3",
        descripcion: "Reconoce al patrimonio local/global como identidad y clave de sostenibilidad."
      }
    ]
  },
  {
    id: "ce4",
    codigo: "CE4",
    nombre: "Analiza las opiniones divergentes y negocia significados compartidos desde el respeto por la alteridad y otredad en el presente y en el pasado",
    descripcion: "Analiza las opiniones divergentes y negocia significados compartidos desde el respeto por la alteridad y otredad en el presente y en el pasado.",
    criteriosLogro: [
      {
        id: "cl4_1", 
        codigo: "CL4.1",
        descripcion: "Interactúa con opiniones divergentes y diferentes a la propia construyendo significado."
      },
      {
        id: "cl4_2",
        codigo: "CL4.2",
        descripcion: "Comprende diferentes perspectivas de los sujetos y grupos protagonistas de los procesos históricos."
      }
    ]
  },
  {
    id: "ce5", 
    codigo: "CE5",
    nombre: "Analiza información confiable con distintas herramientas digitales reconociendo la propiedad intelectual",
    descripcion: "Analiza información confiable con distintas herramientas digitales reconociendo la propiedad intelectual.",
    criteriosLogro: [
      {
        id: "cl5_1",
        codigo: "CL5.1", 
        descripcion: "Utiliza con pertinencia los recursos tecnológicos disponibles para profundizar el conocimiento histórico."
      },
      {
        id: "cl5_2",
        codigo: "CL5.2",
        descripcion: "Explica los avances tecnológicos y científicos y su incidencia en las sociedades actuales."
      }
    ]
  },
  {
    id: "ce6",
    codigo: "CE6",
    nombre: "Reflexiona en forma autónoma acerca de sus procesos de aprendizaje, y es capaz de regularlos",
    descripcion: "Reflexiona en forma autónoma acerca de sus procesos de aprendizaje, y es capaz de regularlos.",
    criteriosLogro: [
      {
        id: "cl6_1",
        codigo: "CL 6.1",
        descripcion: "Sistematiza las distintas estrategias durante el proceso de aprendizaje autónomo."
      },
      {
        id: "cl6_2",
        codigo: "CL 6.2", 
        descripcion: "Reflexiona sobre sus procesos de aprendizaje históricos y utiliza herramientas para regularse."
      }
    ]
  },
  {
    id: "ce7",
    codigo: "CE7",
    nombre: "Construye conciencia histórica en relación con el pasado y experiencias",
    descripcion: "Construye conciencia histórica en relación con el pasado y experiencias.",
    criteriosLogro: [
      {
        id: "cl7",
        codigo: "CL 7",
        descripcion: "Analiza los fenómenos del pasado reconociendo su incidencia en las experiencias del presente."
      }
    ]
  },
  {
    id: "ce8",
    codigo: "CE8", 
    nombre: "Reflexiona el valor de la convivencia democrática como construcción histórica y asume responsabilidades individuales y colectivas",
    descripcion: "Reflexiona el valor de la convivencia democrática como construcción histórica y asume responsabilidades individuales y colectivas.",
    criteriosLogro: [
      {
        id: "cl8",
        codigo: "CL 8",
        descripcion: "Valora y se responsabiliza por la convivencia en un Estado de derecho."
      }
    ]
  },
  {
    id: "ce9",
    codigo: "CE9",
    nombre: "Utiliza categorías de análisis propias de la investigación histórica construyendo explicaciones y argumentaciones",
    descripcion: "Utiliza categorías de análisis propias de la investigación histórica construyendo explicaciones y argumentaciones.",
    criteriosLogro: [
      {
        id: "cl9_1",
        codigo: "CL 9.1",
        descripcion: "Interpreta fenómenos históricos a partir de categorías de análisis propias del método histórico."
      },
      {
        id: "cl9_2",
        codigo: "CL 9.2",
        descripcion: "Construye el relato histórico argumentando y haciendo interactuar la espacialidad/temporalidad en los fenómenos históricos."
      }
    ]
  }
];

// Función para obtener competencias específicas
export const getCompetenciasEspecificas = (): CompetenciaEspecifica[] => {
  return COMPETENCIAS_HISTORIA;
};

// Función para obtener criterios de logro por competencias seleccionadas
export const getCriteriosLogroPorCompetencias = (competenciasIds: string[]): CriterioLogro[] => {
  const competenciasSeleccionadas = COMPETENCIAS_HISTORIA.filter(c => 
    competenciasIds.includes(c.id)
  );
  
  return competenciasSeleccionadas.flatMap(c => c.criteriosLogro);
};

// Función para obtener una competencia específica por ID
export const getCompetenciaById = (id: string): CompetenciaEspecifica | undefined => {
  return COMPETENCIAS_HISTORIA.find(c => c.id === id);
};