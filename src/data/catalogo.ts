// Catálogo de contenidos educativos con estructura jerárquica
// Capítulos macro (no seleccionables) → Subtemas (seleccionables)

export type Materia = "Literatura" | "Formación para la ciudadanía" | "Historia";

export interface CapituloMacro {
  id: string;
  materia: Materia;
  titulo: string; // En mayúsculas cuando corresponde según programa
  subtemas: SubtemaItem[];
}

export interface SubtemaItem {
  id: string;
  contenido: string;
  criterios: string[];
}

// Estructura completa con capítulos macro y subtemas
export const CATALOGO_JERARQUICO: CapituloMacro[] = [
  // ==================== HISTORIA ====================
  {
    id: "historia-cap1",
    materia: "Historia",
    titulo: "LA CONSTRUCCIÓN DE UN MODELO DE DESARROLLO EN URUGUAY EN LAS PRIMERAS DÉCADAS DEL SIGLO XX",
    subtemas: [
      {
        id: "hist-1-1",
        contenido: "La sociedad del 900, sus transformaciones y los movimientos migratorios.",
        criterios: ["cl1_1", "cl7", "cl9_1"]
      },
      {
        id: "hist-1-2", 
        contenido: "El Estado, la política y las reformas. El Batllismo.",
        criterios: ["cl1_2", "cl2_1", "cl8", "cl9_2"]
      },
      {
        id: "hist-1-3",
        contenido: "La construcción de la democracia uruguaya y la integración social.",
        criterios: ["cl4_1", "cl7", "cl8", "cl9_1"]
      },
      {
        id: "hist-1-4",
        contenido: "Tradiciones y vanguardias artísticas. Expresiones en el pensamiento y el arte nacional del período.",
        criterios: ["cl3_1", "cl4_2", "cl7"]
      },
      {
        id: "hist-1-5",
        contenido: "Repercusiones de la Primera Guerra Mundial a nivel nacional, regional e internacional.",
        criterios: ["cl1_1", "cl1_2", "cl9_1", "cl9_2"]
      },
      {
        id: "hist-1-6",
        contenido: "El Uruguay del centenario y las culturas urbanas y rurales.",
        criterios: ["cl3_3", "cl4_2", "cl7", "cl9_2"]
      }
    ]
  },
  {
    id: "historia-cap2",
    materia: "Historia",
    titulo: "LA CONSOLIDACIÓN DEL MODELO DE PAÍS EN EL CONTEXTO INTERNACIONAL (1929-1955)",
    subtemas: [
      {
        id: "hist-2-1",
        contenido: "Repercusiones económicas y sociales de la crisis de 1929 a nivel nacional, regional e internacional.",
        criterios: ["cl1_1", "cl1_2", "cl9_1", "cl9_2"]
      },
      {
        id: "hist-2-2",
        contenido: "Crisis de las democracias liberales, avance del totalitarismo e inicio de las dictaduras en la región.",
        criterios: ["cl4_1", "cl4_2", "cl7", "cl8"]
      },
      {
        id: "hist-2-3",
        contenido: "Evolución política del periodo en Uruguay.",
        criterios: ["cl2_1", "cl2_2", "cl8", "cl9_2"]
      },
      {
        id: "hist-2-4",
        contenido: "Desarrollo del modelo ISI: industrialismo y dirigismo estatal y empresa pública y privada. Políticas sociales.",
        criterios: ["cl1_2", "cl7", "cl9_1", "cl9_2"]
      },
      {
        id: "hist-2-5",
        contenido: "Consecuencias de la Segunda Guerra Mundial a nivel nacional, regional e internacional. Los Derechos Humanos.",
        criterios: ["cl1_1", "cl4_1", "cl7", "cl8"]
      },
      {
        id: "hist-2-6",
        contenido: "Expresiones culturales y artísticas del Uruguay en el período.",
        criterios: ["cl3_1", "cl3_3", "cl4_2", "cl7"]
      }
    ]
  },
  {
    id: "historia-cap3",
    materia: "Historia", 
    titulo: "CRISIS Y TRANSFORMACIONES DEL MODELO DE PAÍS Y SUS RELACIONES CON EL CONTEXTO INTERNACIONAL (1955-1985)",
    subtemas: [
      {
        id: "hist-3-1",
        contenido: "Problemas y limitantes del Modelo ISI: evolución económica. La Comisión de Inversiones y Desarrollo Económico (CIDE).",
        criterios: ["cl1_2", "cl3_1", "cl9_1", "cl9_2"]
      },
      {
        id: "hist-3-2",
        contenido: "Posturas y respuestas de diferentes actores sociales y políticos a la crisis.",
        criterios: ["cl2_1", "cl4_1", "cl4_2", "cl9_2"]
      },
      {
        id: "hist-3-3",
        contenido: "Evolución política del periodo en Uruguay.",
        criterios: ["cl2_1", "cl2_2", "cl7", "cl8"]
      },
      {
        id: "hist-3-4",
        contenido: "Uruguay y Latinoamérica en el marco de la Guerra Fría: amenazas a la democracia y debilitamiento de las instituciones republicanas, radicalización política, guerrilla y polarización social. Respuestas a la crisis.",
        criterios: ["cl1_1", "cl1_2", "cl4_1", "cl7", "cl8"]
      },
      {
        id: "hist-3-5",
        contenido: "La dictadura cívico-militar: el avasallamiento de las instituciones, los Derechos Humanos, civiles y políticos. El Plan Nacional de Desarrollo.",
        criterios: ["cl4_1", "cl7", "cl8", "cl9_1"]
      },
      {
        id: "hist-3-6",
        contenido: "Artes y culturas urbanas y rurales en el período.",
        criterios: ["cl3_1", "cl3_3", "cl4_2", "cl7"]
      },
      {
        id: "hist-3-7",
        contenido: "Desarrollo internacional de la ciencia y la tecnología aplicados a la economía y la vida cotidiana.",
        criterios: ["cl5_1", "cl5_2", "cl7", "cl9_1"]
      }
    ]
  },
  {
    id: "historia-cap4",
    materia: "Historia",
    titulo: "LA RESTAURACIÓN DEMOCRÁTICA Y EL URUGUAY A PARTIR DE 1985 (EN EL CONTEXTO INTERNACIONAL)",
    subtemas: [
      {
        id: "hist-4-1",
        contenido: "La transición democrática y su afirmación. El plebiscito de 1980. El período de 1985 a 2010.",
        criterios: ["cl7", "cl8", "cl9_1", "cl9_2"]
      },
      {
        id: "hist-4-2",
        contenido: "Evolución política.",
        criterios: ["cl2_1", "cl2_2", "cl8", "cl9_2"]
      },
      {
        id: "hist-4-3",
        contenido: "Reformas, recesión, crisis y reactivación económica (1990-2010).",
        criterios: ["cl1_2", "cl7", "cl9_1", "cl9_2"]
      },
      {
        id: "hist-4-4",
        contenido: "Artes, ciencias y cambios culturales y sociales.",
        criterios: ["cl3_1", "cl3_3", "cl5_2", "cl7"]
      },
      {
        id: "hist-4-5",
        contenido: "Proceso de integración regional: dificultades y realizaciones (ALADI-Mercosur).",
        criterios: ["cl1_1", "cl1_2", "cl7", "cl9_2"]
      },
      {
        id: "hist-4-6",
        contenido: "Caracterización y efectos del proceso de globalización e inserción del Uruguay a escala regional y mundial.",
        criterios: ["cl1_1", "cl3_2", "cl5_1", "cl7", "cl9_1"]
      }
    ]
  },

  // ==================== LITERATURA ====================
  {
    id: "literatura-cap0",
    materia: "Literatura",
    titulo: "MÓDULO INTRODUCTORIO",
    subtemas: [
      {
        id: "lit-0-1",
        contenido: "Definición de literatura y su ubicación en el terreno de las artes. Su finalidad estética, la función expresiva del lenguaje como valor en sí mismo.",
        criterios: ["cl1-literatura", "cl2-literatura", "cl3-literatura"]
      }
    ]
  },
  {
    id: "literatura-cap1",
    materia: "Literatura",
    titulo: "1) NARRATIVA BREVE. EL CUENTO. SU CARACTERIZACIÓN",
    subtemas: [
      {
        id: "lit-1-1",
        contenido: "Horacio Quiroga",
        criterios: ["cl1-literatura", "cl3-literatura", "cl5-literatura", "cl6-literatura"]
      },
      {
        id: "lit-1-2",
        contenido: "Francisco Espínola o Juan José Morosoli",
        criterios: ["cl1-literatura", "cl2-literatura", "cl6-literatura", "cl7-literatura"]
      },
      {
        id: "lit-1-3",
        contenido: "Felisberto Hernández",
        criterios: ["cl1-literatura", "cl3-literatura", "cl5-literatura", "cl8-literatura"]
      },
      {
        id: "lit-1-4",
        contenido: "Gabriel García Márquez o Julio Cortázar o Juan Rulfo o Ángeles Mastretta",
        criterios: ["cl1-literatura", "cl2-literatura", "cl4-literatura", "cl6-literatura"]
      },
      {
        id: "lit-1-5",
        contenido: "Lecturas complementarias: Eduardo Acevedo Díaz, Mario Arregui, Mario Benedetti, Javier de Viana, Cristina Peri Rossi",
        criterios: ["cl1-literatura", "cl4-literatura", "cl6-literatura"]
      }
    ]
  },
  {
    id: "literatura-cap2",
    materia: "Literatura",
    titulo: "2) LA LÍRICA. SUS CARACTERÍSTICAS",
    subtemas: [
      {
        id: "lit-2-1",
        contenido: "José Martí o Rubén Darío",
        criterios: ["cl1-literatura", "cl2-literatura", "cl3-literatura", "cl8-literatura"]
      },
      {
        id: "lit-2-2",
        contenido: "Julio Herrera y Reissig o María Eugenia Vaz Ferreira o Delmira Agustini",
        criterios: ["cl1-literatura", "cl2-literatura", "cl5-literatura", "cl8-literatura"]
      },
      {
        id: "lit-2-3",
        contenido: "Juana de Ibarbourou o Alfonsina Storni o Sara de Ibáñez",
        criterios: ["cl1-literatura", "cl3-literatura", "cl5-literatura", "cl8-literatura"]
      },
      {
        id: "lit-2-4",
        contenido: "Pablo Neruda o Nicolás Guillén o Elena Garro",
        criterios: ["cl1-literatura", "cl2-literatura", "cl4-literatura", "cl6-literatura"]
      },
      {
        id: "lit-2-5",
        contenido: "Lecturas complementarias: Jorge Arbeleche, Orfila Bardesio, Mario Benedetti, Amanda Berenguer, Jorge Luis Borges, Virginia Brindis de Salas, Ernesto Cardenal, Juan Cunha, Líber Falco, Circe Maia, Gabriela Mistral, Cristina Peri Rossi, Idea Vilariño, Ida Vitale",
        criterios: ["cl1-literatura", "cl4-literatura", "cl6-literatura"]
      }
    ]
  },
  {
    id: "literatura-cap3",
    materia: "Literatura",
    titulo: "3) LÍRICA-NARRATIVA. LITERATURA GAUCHESCA: SUS CARACTERÍSTICAS. LITERATURAS LOCALES",
    subtemas: [
      {
        id: "lit-3-1",
        contenido: "Martín Fierro, José Hernández",
        criterios: ["cl1-literatura", "cl2-literatura", "cl6-literatura", "cl7-literatura"]
      },
      {
        id: "lit-3-2",
        contenido: "Diálogo intertextual con autor local (departamento, ciudad o localidad cercanos) para superar la tensión centro-periferia",
        criterios: ["cl2-literatura", "cl4-literatura", "cl6-literatura", "cl7-literatura"]
      }
    ]
  },
  {
    id: "literatura-cap4", 
    materia: "Literatura",
    titulo: "4) DRÁMATICA. LA OBRA DRAMÁTICA. SUS CARACTERÍSTICAS",
    subtemas: [
      {
        id: "lit-4-1",
        contenido: "Florencio Sánchez",
        criterios: ["cl1-literatura", "cl2-literatura", "cl5-literatura", "cl6-literatura"]
      },
      {
        id: "lit-4-2",
        contenido: "Roberto Arlt o Agustín Cuzzani o Roberto Cossa u Osvaldo Dragún o Griselda Gambaro",
        criterios: ["cl1-literatura", "cl3-literatura", "cl4-literatura", "cl5-literatura"]
      },
      {
        id: "lit-4-3",
        contenido: "Lecturas complementarias: Jorge Curi, Jacobo Langsner, Antonio «Taco» Larreta, Carlos Maggi, Mercedes Rein, Mauricio Rosencof, Milton Schinca",
        criterios: ["cl1-literatura", "cl4-literatura", "cl6-literatura"]
      }
    ]
  },

  // ==================== FORMACIÓN PARA LA CIUDADANÍA ====================
  {
    id: "ciudadania-cap1",
    materia: "Formación para la ciudadanía",
    titulo: "LA CONVIVENCIA EN LA CONSTRUCCIÓN DE CIUDADANÍA",
    subtemas: [
      {
        id: "ciud-1-1",
        contenido: "Socialización: las familias, los grupos de pares y los medios de comunicación.",
        criterios: ["cl1-1-ciudadania", "cl2-1-ciudadania", "cl9-2-ciudadania"]
      },
      {
        id: "ciud-1-2",
        contenido: "La cultura y la interacción social como forma de reconocimiento de la diversidad.",
        criterios: ["cl6-1-ciudadania", "cl6-2-ciudadania", "cl9-1-ciudadania"]
      },
      {
        id: "ciud-1-3",
        contenido: "Las normas de conducta: concepto, características y su finalidad en la sociedad.",
        criterios: ["cl1-1-ciudadania", "cl1-2-ciudadania", "cl8-1-ciudadania"]
      },
      {
        id: "ciud-1-4",
        contenido: "Orden jurídico: concepto, jerarquía de las normas jurídicas y principios.",
        criterios: ["cl1-2-ciudadania", "cl4-1-ciudadania", "cl8-1-ciudadania"]
      },
      {
        id: "ciud-1-5",
        contenido: "Las violencias y su incidencia en las relaciones interpersonales.",
        criterios: ["cl5-1-ciudadania", "cl6-1-ciudadania", "cl9-2-ciudadania"]
      },
      {
        id: "ciud-1-6",
        contenido: "Convivencia, conflictos y mecanismos de resolución. El diálogo como herramienta.",
        criterios: ["cl2-1-ciudadania", "cl5-1-ciudadania", "cl8-2-ciudadania"]
      },
      {
        id: "ciud-1-7",
        contenido: "Las tecnologías, la ciudadanía y la convivencia. Las violencias en el espacio digital.",
        criterios: ["cl3-2-ciudadania", "cl8-2-ciudadania", "cl9-1-ciudadania"]
      }
    ]
  },
  {
    id: "ciudadania-cap2",
    materia: "Formación para la ciudadanía",
    titulo: "DEMOCRACIA Y CIUDADANÍA",
    subtemas: [
      {
        id: "ciud-2-1",
        contenido: "El Estado: concepto, elementos constitutivos y finalidad.",
        criterios: ["cl1-2-ciudadania", "cl7-1-ciudadania", "cl8-1-ciudadania"]
      },
      {
        id: "ciud-2-2",
        contenido: "Gobierno: concepto, tipos (características de gobiernos democráticos y no democráticos).",
        criterios: ["cl7-1-ciudadania", "cl7-2-ciudadania", "cl10-1-ciudadania"]
      },
      {
        id: "ciud-2-3",
        contenido: "Principios que sustentan el sistema democrático, republicano y representativo.",
        criterios: ["cl7-1-ciudadania", "cl7-2-ciudadania", "cl10-1-ciudadania"]
      },
      {
        id: "ciud-2-4",
        contenido: "El rol del Estado democrático como garante de los derechos. Su descentralización y los poderes locales.",
        criterios: ["cl4-1-ciudadania", "cl7-1-ciudadania", "cl10-2-ciudadania"]
      },
      {
        id: "ciud-2-5",
        contenido: "Ciudadanía local, global y digital. La ciudadanía en el mundo globalizado.",
        criterios: ["cl3-1-ciudadania", "cl8-1-ciudadania", "cl9-1-ciudadania"]
      },
      {
        id: "ciud-2-6",
        contenido: "Derechos y deberes del ciudadano. La participación ciudadana. El sufragio como mecanismo de participación. Sistema electoral del Uruguay.",
        criterios: ["cl4-1-ciudadania", "cl7-2-ciudadania", "cl10-2-ciudadania"]
      }
    ]
  },
  {
    id: "ciudadania-cap3",
    materia: "Formación para la ciudadanía",
    titulo: "DERECHOS HUMANOS",
    subtemas: [
      {
        id: "ciud-3-1",
        contenido: "La dignidad humana como fundamento de los derechos humanos.",
        criterios: ["cl4-1-ciudadania", "cl6-1-ciudadania", "cl6-2-ciudadania"]
      },
      {
        id: "ciud-3-2",
        contenido: "La evolución en generaciones.",
        criterios: ["cl4-1-ciudadania", "cl6-1-ciudadania", "cl8-1-ciudadania"]
      },
      {
        id: "ciud-3-3",
        contenido: "El adolescente como sujeto de derecho (breve). La participación adolescente como derecho humano.",
        criterios: ["cl4-1-ciudadania", "cl6-2-ciudadania", "cl10-2-ciudadania"]
      },
      {
        id: "ciud-3-4",
        contenido: "Los derechos humanos en la era digital: conocer y ejercer los derechos en los entornos digitales.",
        criterios: ["cl3-2-ciudadania", "cl6-1-ciudadania", "cl9-1-ciudadania"]
      },
      {
        id: "ciud-3-5",
        contenido: "Ciudadanía local, regional, global y digital.",
        criterios: ["cl3-1-ciudadania", "cl8-1-ciudadania", "cl9-1-ciudadania"]
      },
      {
        id: "ciud-3-6",
        contenido: "Los jóvenes y el mundo del trabajo.",
        criterios: ["cl6-2-ciudadania", "cl9-2-ciudadania", "cl10-4-ciudadania"]
      },
      {
        id: "ciud-3-7",
        contenido: "Mecanismos de protección y exigibilidad.",
        criterios: ["cl4-1-ciudadania", "cl6-2-ciudadania", "cl8-1-ciudadania"]
      }
    ]
  }
];

// Funciones auxiliares para compatibilidad con código existente
export function criteriosParaContenidos(contenidoIds: string[]): string[] {
  const criterios: string[] = [];
  
  for (const capitulo of CATALOGO_JERARQUICO) {
    for (const subtema of capitulo.subtemas) {
      if (contenidoIds.includes(subtema.id)) {
        criterios.push(...subtema.criterios);
      }
    }
  }
  
  return [...new Set(criterios)].sort();
}

export function contenidosPorMateria(materia: Materia): CapituloMacro[] {
  return CATALOGO_JERARQUICO.filter(cap => cap.materia === materia);
}

export function getSubtemaPorId(id: string): SubtemaItem | undefined {
  for (const capitulo of CATALOGO_JERARQUICO) {
    const subtema = capitulo.subtemas.find(s => s.id === id);
    if (subtema) return subtema;
  }
  return undefined;
}

export function getCapituloPorSubtema(subtemaId: string): CapituloMacro | undefined {
  return CATALOGO_JERARQUICO.find(cap => 
    cap.subtemas.some(s => s.id === subtemaId)
  );
}

// Mantener compatibilidad con estructura antigua
export interface ContenidoItem {
  id: string;
  materia: Materia;
  ejeOBloque?: string;
  contenido: string;
  criterios: string[];
}

export const CATALOGO: ContenidoItem[] = CATALOGO_JERARQUICO.flatMap(cap => 
  cap.subtemas.map(sub => ({
    id: sub.id,
    materia: cap.materia,
    ejeOBloque: cap.titulo,
    contenido: sub.contenido,
    criterios: sub.criterios
  }))
);