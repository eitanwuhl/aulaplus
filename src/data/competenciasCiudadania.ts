// Competencias específicas y criterios de logro - Formación para la ciudadanía 9º grado ANEP
// Usar exactamente los textos y orden provistos en la especificación

export interface CompetenciaEspecificaCiudadania {
  id: string; // slug único
  codigo: string; // CE1, CE2, etc.
  nombre: string;
  descripcion: string; // Descripción completa de la competencia
  criteriosLogro: CriterioLogroCiudadania[]; // Criterios asociados
}

export interface CriterioLogroCiudadania {
  id: string; // slug único
  codigo: string; // CL1.1, CL1.2, etc.
  descripcion: string;
}

export const COMPETENCIAS_CIUDADANIA: CompetenciaEspecificaCiudadania[] = [
  {
    id: "ce1-ciudadania",
    codigo: "CE1",
    nombre: "Integración de conceptos sociales, jurídicos y políticos",
    descripcion: "Integra conceptos sociales, jurídicos y políticos que le permiten expresar sus ideas, para generar cambios en la interacción en su vida cotidiana.",
    criteriosLogro: [
      {
        id: "cl1-1-ciudadania",
        codigo: "CL1.1",
        descripcion: "Reconoce e incorpora las normas que regulan la convivencia en la sociedad y en el centro educativo y actúa de acuerdo con ellas de forma empática."
      },
      {
        id: "cl1-2-ciudadania",
        codigo: "CL1.2",
        descripcion: "Identifica al Estado como forma de organización jurídico-política y sus órganos como parte de la vida en sociedad."
      }
    ]
  },
  {
    id: "ce2-ciudadania",
    codigo: "CE2",
    nombre: "Cuestionamiento y problematización de situaciones cotidianas",
    descripcion: "Cuestiona y problematiza sobre situaciones de su vida cotidiana para desarrollar su capacidad de análisis y argumentación respetando distintos puntos de vista.",
    criteriosLogro: [
      {
        id: "cl2-1-ciudadania",
        codigo: "CL2.1",
        descripcion: "Analiza de forma crítica los mensajes y estereotipos provenientes de los medios de comunicación, atiende, admite y valora los puntos de vista de otros y es capaz de replantearse los suyos argumentando su postura."
      }
    ]
  },
  {
    id: "ce3-ciudadania",
    codigo: "CE3",
    nombre: "Identificación y reflexión sobre problemas sociales",
    descripcion: "Identifica y reflexiona sobre problemas sociales y aplica modelos científicos para su explicación. Incorpora y aplica las tecnologías en el abordaje de diferentes desafíos.",
    criteriosLogro: [
      {
        id: "cl3-1-ciudadania",
        codigo: "CL3.1",
        descripcion: "Toma decisiones respecto a la información seleccionada con base en criterios que define en los grupos de los que forma parte."
      },
      {
        id: "cl3-2-ciudadania",
        codigo: "CL3.2",
        descripcion: "Reflexiona sobre las TICs en la vida cotidiana y su accionar en internet, deliberando sobre la convivencia en los espacios virtuales."
      }
    ]
  },
  {
    id: "ce5-ciudadania",
    codigo: "CE5",
    nombre: "Resolución colaborativa de conflictos",
    descripcion: "Promueve la resolución de conflictos a partir del trabajo colaborativo para lograr acuerdos basados en la empatía y la solidaridad.",
    criteriosLogro: [
      {
        id: "cl5-1-ciudadania",
        codigo: "CL5.1",
        descripcion: "Promueve una cultura de paz, a través de la resolución de conflictos, oponiéndose a la violencia y apelando al diálogo, la empatía y la solidaridad en la búsqueda del acuerdo con el otro."
      }
    ]
  },
  {
    id: "ce7-ciudadania",
    codigo: "CE7",
    nombre: "Interpretación y resignificación de información",
    descripcion: "Interpreta, cuestiona y resignifica la información para tomar decisiones de forma asertiva considerando su entorno y distintas fuentes, lo que le permitirá pensarse como un actor/agente relevante en la construcción de su ciudadanía.",
    criteriosLogro: [
      {
        id: "cl7-1-ciudadania",
        codigo: "CL7.1",
        descripcion: "Reconoce los órganos del gobierno y la importancia del ejercicio de su ciudadanía para la vida en democracia."
      },
      {
        id: "cl7-2-ciudadania",
        codigo: "CL7.2",
        descripcion: "Indaga y reflexiona sobre el proceso democrático en Uruguay apropiándose de los mecanismos democráticos previstos en nuestra Constitución."
      }
    ]
  },
  {
    id: "ce4-ciudadania",
    codigo: "CE4",
    nombre: "Ejercicio de derechos y responsabilidades",
    descripcion: "Reconoce, reflexiona y se involucra en el ejercicio de sus derechos y responsabilidades con la finalidad de desarrollar acciones en la promoción y concientización de los derechos humanos.",
    criteriosLogro: [
      {
        id: "cl4-1-ciudadania",
        codigo: "CL4.1",
        descripcion: "Reconoce, reflexiona y se involucra desarrollando acciones para fomentar los derechos y responsabilidades como ciudadano, construyendo argumentos en un marco de derechos humanos."
      }
    ]
  },
  {
    id: "ce10-ciudadania",
    codigo: "CE10",
    nombre: "Participación en proyectos de indagación",
    descripcion: "Cuestiona, reflexiona y participa en proyectos de indagación personales y colaborativos, problematizando cuestiones de su entorno para comprender la complejidad de la realidad social.",
    criteriosLogro: [
      {
        id: "cl10-1-ciudadania",
        codigo: "CL10.1",
        descripcion: "Cuestiona, reflexiona y valora en los ámbitos de construcción colectiva sobre las garantías de las que goza por el hecho de vivir bajo un régimen democrático."
      },
      {
        id: "cl10-2-ciudadania",
        codigo: "CL10.2",
        descripcion: "Reconoce al centro educativo como un espacio de participación y se involucra activamente en los proyectos de aula y de centro, vinculados con la comunidad escolar y local."
      },
      {
        id: "cl10-3-ciudadania",
        codigo: "CL10.3",
        descripcion: "Propone, planifica y desarrolla proyectos que mejoren su vida y beneficien a su comunidad influyendo en el entorno que lo rodea."
      },
      {
        id: "cl10-4-ciudadania",
        codigo: "CL10.4",
        descripcion: "Se compromete con la construcción de su proyecto de vida sobre criterios éticos y solidarios."
      }
    ]
  },
  {
    id: "ce6-ciudadania",
    codigo: "CE6",
    nombre: "Interculturalidad y diversidad",
    descripcion: "Conoce, se posiciona y respeta la interculturalidad y la diversidad de creencias, valores, ideas y prácticas sociales, para ejercer una ciudadanía activa.",
    criteriosLogro: [
      {
        id: "cl6-1-ciudadania",
        codigo: "CL6.1",
        descripcion: "Comprende los derechos humanos como una construcción colectiva y dinámica, reflexiona sobre el concepto de dignidad humana y aporta a cambios sostenibles para su cumplimiento."
      },
      {
        id: "cl6-2-ciudadania",
        codigo: "CL6.2",
        descripcion: "Reconoce ser sujeto de derecho y comprende los mecanismos legales de protección a la niñez y la adolescencia."
      }
    ]
  },
  {
    id: "ce9-ciudadania",
    codigo: "CE9",
    nombre: "Ciudadanía empática y comprometida",
    descripcion: "Reflexiona y actúa como ciudadano empático, comprometido, que forma parte de la sociedad atendiendo a sus necesidades, derechos y obligaciones, así como a los de otras personas y colectividades.",
    criteriosLogro: [
      {
        id: "cl9-1-ciudadania",
        codigo: "CL9.1",
        descripcion: "Reflexiona y cuestiona su participación como ciudadano en el ámbito digital a través de la interacción con otros."
      },
      {
        id: "cl9-2-ciudadania",
        codigo: "CL9.2",
        descripcion: "Reflexiona sobre la incorporación del adolescente al mundo del trabajo y reconoce e integra derechos y responsabilidades."
      }
    ]
  },
  {
    id: "ce8-ciudadania",
    codigo: "CE8",
    nombre: "Participación en situaciones complejas de la realidad",
    descripcion: "Problematiza y participa colaborativamente en situaciones complejas de la realidad, a través de diferentes formatos y dispositivos tecnológicos que le permiten interactuar con el entorno.",
    criteriosLogro: [
      {
        id: "cl8-1-ciudadania",
        codigo: "CL8.1",
        descripcion: "Reconoce y analiza aspectos de la realidad, incorporando y aplicando conceptos jurídicos, sociales y políticos en diversos ámbitos de participación."
      },
      {
        id: "cl8-2-ciudadania",
        codigo: "CL8.2",
        descripcion: "Problematiza y reflexiona en el abordaje de situaciones reales, a través de la interacción con sus pares, mediado por diferentes formatos y dispositivos tecnológicos."
      }
    ]
  }
];

// Funciones auxiliares
export function getCompetenciasEspecificasCiudadania(): CompetenciaEspecificaCiudadania[] {
  return COMPETENCIAS_CIUDADANIA;
}

export function getCriteriosLogroPorCompetenciasCiudadania(competenciasIds: string[]): CriterioLogroCiudadania[] {
  const criterios: CriterioLogroCiudadania[] = [];
  
  for (const id of competenciasIds) {
    const competencia = COMPETENCIAS_CIUDADANIA.find(c => c.id === id);
    if (competencia) {
      criterios.push(...competencia.criteriosLogro);
    }
  }
  
  return criterios;
}

export function getCompetenciaCiudadaniaById(id: string): CompetenciaEspecificaCiudadania | undefined {
  return COMPETENCIAS_CIUDADANIA.find(c => c.id === id);
}