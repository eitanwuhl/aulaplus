// Competencias específicas y criterios de logro - Literatura 9º grado ANEP
// Usar exactamente los textos provistos en la especificación

export interface CompetenciaEspecificaLiteratura {
  id: string; // slug único
  codigo: string; // CE1, CE2, etc.
  nombre: string;
  descripcion: string; // Descripción completa de la competencia
  criteriosLogro: CriterioLogroLiteratura[]; // Criterios asociados
}

export interface CriterioLogroLiteratura {
  id: string; // slug único
  codigo: string; // CL1, CL2, etc.
  descripcion: string;
}

export const COMPETENCIAS_LITERATURA: CompetenciaEspecificaLiteratura[] = [
  {
    id: "ce1-literatura",
    codigo: "CE1",
    nombre: "Desarrollo del hábito lector y competencia lectora",
    descripcion: "Manifiesta gusto e interés, para favorecer el surgimiento de un hábito lector que trascienda el aula. Lee y escribe como un lector crítico, consciente, reflexivo e informado para disfrutar del valor ético y estético de la literatura, tanto de aquellas obras que integran los contenidos curriculares como de aquellas con finalidad recreativa. Lee en voz alta con mayor fluidez, inflexión e intención, de acuerdo a los diferentes géneros discursivos, de textos de mediana extensión, para facilitar la comprensión lectora.",
    criteriosLogro: [
      {
        id: "cl1-literatura",
        codigo: "CL1",
        descripcion: "Desarrolla en forma crítica, consciente, reflexiva e informada el valor ético y estético de las obras de diferentes géneros literarios con mediación docente."
      }
    ]
  },
  {
    id: "ce2-literatura",
    codigo: "CE2",
    nombre: "Contextualización histórica y registro de la oralidad",
    descripcion: "Contextualiza el texto desde una perspectiva histórica, considerando la sensibilidad de la época. Reconoce diferentes registros de la oralidad para descubrir la importancia de la lengua como identidad social.",
    criteriosLogro: [
      {
        id: "cl2-literatura",
        codigo: "CL2",
        descripcion: "Identifica las especificidades del lenguaje literario mediante la creación personal y/o colectiva, el análisis, el reconocimiento y la generalización."
      }
    ]
  },
  {
    id: "ce3-literatura",
    codigo: "CE3",
    nombre: "Fundamentación crítica de textos",
    descripcion: "Explicita y se aproxima a una fundamentación crítica sobre los textos, para desarrollar un proceso de des-velamiento aplicable a todos los campos del saber.",
    criteriosLogro: [
      {
        id: "cl3-literatura",
        codigo: "CL3",
        descripcion: "Evidencia una actitud crítica hacia la interpretación de los textos literarios."
      }
    ]
  },
  {
    id: "ce4-literatura",
    codigo: "CE4",
    nombre: "Trabajo colaborativo y comunicación",
    descripcion: "En actividades compartidas, maneja la interacción con sus pares y es capaz de trabajar colaborativamente, respetando las diversidades y las opiniones de los otros como aportes significativos a la tarea. Aprecia las ventajas de expresarse de forma coherente para mejorar la comunicación social y su cosmovisión.",
    criteriosLogro: [
      {
        id: "cl4-literatura",
        codigo: "CL4",
        descripcion: "Formula preguntas, debate y argumenta en función de las obras literarias analizadas durante el curso, en forma colectiva y colaborativa."
      },
      {
        id: "cl5-literatura",
        codigo: "CL5",
        descripcion: "Empatiza con personajes, situaciones, emociones, de forma que puede conmoverse con la peripecia propia y ajena."
      },
      {
        id: "cl6-literatura",
        codigo: "CL6",
        descripcion: "Identifica y reconoce características propias del texto ficcional estableciendo conexiones y un diálogo con la realidad y su entorno."
      },
      {
        id: "cl7-literatura",
        codigo: "CL7",
        descripcion: "Analiza, investiga y comprende la 'poiesis' (proceso creativo) propia y ajena como solución de problemas cotidianos."
      }
    ]
  },
  {
    id: "ce5-literatura",
    codigo: "CE5",
    nombre: "Reconocimiento y uso de figuras literarias",
    descripcion: "Reconoce las principales figuras literarias en las obras analizadas, así como también puede emplearlas en textos de creación propia para disfrutar de la especificidad que este arte utiliza para provocar el goce estético.",
    criteriosLogro: [
      {
        id: "cl8-literatura",
        codigo: "CL8",
        descripcion: "Desarrolla una producción oral y escrita coherente y cohesiva incorporando conocimientos y recursos literarios como estrategias para comunicarse."
      }
    ]
  }
];

// Funciones auxiliares
export function getCompetenciasEspecificasLiteratura(): CompetenciaEspecificaLiteratura[] {
  return COMPETENCIAS_LITERATURA;
}

export function getCriteriosLogroPorCompetenciasLiteratura(competenciasIds: string[]): CriterioLogroLiteratura[] {
  const criterios: CriterioLogroLiteratura[] = [];
  
  for (const id of competenciasIds) {
    const competencia = COMPETENCIAS_LITERATURA.find(c => c.id === id);
    if (competencia) {
      criterios.push(...competencia.criteriosLogro);
    }
  }
  
  return criterios;
}

export function getCompetenciaLiteraturaById(id: string): CompetenciaEspecificaLiteratura | undefined {
  return COMPETENCIAS_LITERATURA.find(c => c.id === id);
}