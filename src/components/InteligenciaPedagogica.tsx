import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  Brain, Target, Users, Lightbulb, BookOpen, Puzzle,
  Gamepad2, FlaskConical, Globe, TreePine
} from "lucide-react";

interface InteligenciaPedagogicaProps {
  materia: string;
  perfilDominante: string;
  contenidosSeleccionados: string[];
  contextoSociocultural: string;
  recursosDisponibles: string[];
  nivelEducativo: string;
}

interface MetodologiaInnovadora {
  nombre: string;
  descripcion: string;
  implementacion: string[];
  adaptacionesPorPerfil: Record<string, string[]>;
  recursosNecesarios: string[];
  evaluacionEfectividad: string;
  contextualización: string;
}

const InteligenciaPedagogica = ({
  materia,
  perfilDominante,
  contenidosSeleccionados,
  contextoSociocultural,
  recursosDisponibles,
  nivelEducativo
}: InteligenciaPedagogicaProps) => {

  const metodologiasInnovadoras = useMemo((): MetodologiaInnovadora[] => {
    const metodologiasBase = {
      "Matemática": [
        {
          nombre: "Aprendizaje Basado en Problemas Reales (ABP-R)",
          descripcion: "Abordar contenidos matemáticos a través de problemáticas auténticas de la comunidad local",
          implementacion: [
            "Identificar problemática real del entorno comunitario relacionada con el contenido",
            "Formar equipos de investigación multidisciplinarios",
            "Aplicar herramientas matemáticas para analizar y proponer soluciones",
            "Presentar hallazgos a actores comunitarios reales"
          ],
          adaptacionesPorPerfil: {
            Visual: ["Mapas conceptuales de problemas", "Infografías de datos", "Modelado gráfico de soluciones"],
            Auditivo: ["Entrevistas a referentes", "Podcasts explicativos", "Debates sobre soluciones"],
            Kinestésico: ["Trabajo de campo", "Construcción de prototipos", "Simulaciones físicas"],
            "Lector/escritor": ["Informes de investigación", "Análisis documental", "Propuestas escritas"]
          },
          recursosNecesarios: ["Contactos comunitarios", "Herramientas de medición", "Plataforma digital colaborativa"],
          evaluacionEfectividad: "Presentación de soluciones viables a la comunidad con feedback real",
          contextualización: "Adaptable a contexto urbano/rural según problemáticas locales específicas"
        },
        {
          nombre: "Design Thinking Matemático",
          descripcion: "Aplicar metodología de diseño para crear herramientas matemáticas innovadoras",
          implementacion: [
            "Empatizar: Identificar usuarios que necesitan herramientas matemáticas",
            "Definir: Delimitar el desafío matemático específico",
            "Idear: Generar múltiples soluciones creativas",
            "Prototipar: Construir versiones beta de herramientas matemáticas",
            "Testear: Evaluar efectividad con usuarios reales"
          ],
          adaptacionesPorPerfil: {
            Visual: ["Storyboards de soluciones", "Prototipos visuales", "Diagramas de flujo"],
            Auditivo: ["Sesiones de lluvia de ideas oral", "Entrevistas de usuario", "Pitch de soluciones"],
            Kinestésico: ["Construcción hands-on", "Testeo físico", "Iteración manipulativa"],
            "Lector/escritor": ["Documentación de proceso", "Manuales de usuario", "Reflexiones escritas"]
          },
          recursosNecesarios: ["Materiales de prototipado", "Acceso a usuarios piloto", "Herramientas digitales"],
          evaluacionEfectividad: "Impacto medible en usuarios finales y refinamiento iterativo",
          contextualización: "Enfoque en necesidades específicas del contexto socioeconómico"
        }
      ],
      "Historia": [
        {
          nombre: "Historia Vivencial Inmersiva",
          descripcion: "Experimentar eventos históricos desde múltiples perspectivas con tecnología y dramatización",
          implementacion: [
            "Seleccionar evento histórico con múltiples actores sociales",
            "Asignar roles de diferentes clases sociales, géneros y etnias",
            "Investigar fuentes primarias desde cada perspectiva",
            "Dramatizar eventos con toma de decisiones en tiempo real",
            "Reflexionar sobre impacto diferencial según posición social"
          ],
          adaptacionesPorPerfil: {
            Visual: ["Recreación de ambientes", "Vestuario y props", "Líneas de tiempo visuales"],
            Auditivo: ["Diálogos de época", "Música contextual", "Relatos orales"],
            Kinestésico: ["Dramatización activa", "Construcción de escenarios", "Actividades de rol"],
            "Lector/escritor": ["Cartas de época", "Diarios personales", "Documentos oficiales"]
          },
          recursosNecesarios: ["Fuentes históricas diversas", "Materiales de caracterización", "Espacios amplios"],
          evaluacionEfectividad: "Análisis crítico de múltiples perspectivas y empatía histórica desarrollada",
          contextualización: "Conexión con historia local y memoria comunitaria"
        }
      ],
      "Biología": [
        {
          nombre: "Investigación Científica Colaborativa",
          descripcion: "Proyectos de investigación real en colaboración con instituciones científicas locales",
          implementacion: [
            "Partnering con universidades o centros de investigación",
            "Definir pregunta científica relevante para la región",
            "Aplicar método científico riguroso",
            "Recolectar datos reales con protocolos profesionales",
            "Contribuir a conocimiento científico genuino"
          ],
          adaptacionesPorPerfil: {
            Visual: ["Microscopía y fotografía científica", "Gráficos de resultados", "Presentaciones visuales"],
            Auditivo: ["Entrevistas a científicos", "Explicaciones orales", "Discusión de hallazgos"],
            Kinestésico: ["Trabajo de laboratorio", "Recolección de muestras", "Experimentos hands-on"],
            "Lector/escritor": ["Papers científicos", "Protocolos escritos", "Informes de investigación"]
          },
          recursosNecesarios: ["Equipamiento científico", "Mentores profesionales", "Laboratorio funcional"],
          evaluacionEfectividad: "Contribución real al conocimiento científico y publicación de resultados",
          contextualización: "Enfoque en biodiversidad y problemáticas ambientales locales"
        }
      ]
    };

    return metodologiasBase[materia as keyof typeof metodologiasBase] || [];
  }, [materia]);

  const estrategiasdiferenciacion = useMemo(() => {
    return {
      "Múltiples Vías de Acceso": {
        descripcion: "Ofrecer diferentes caminos para acceder al mismo contenido según fortalezas individuales",
        implementacion: [
          "Auditoría de estilos de aprendizaje individuales",
          "Diseño de 4 rutas paralelas para cada concepto clave",
          "Puntos de convergencia para síntesis grupal",
          "Evaluación flexible según vía elegida"
        ]
      },
      "Scaffolding Inteligente": {
        descripcion: "Apoyo gradual y personalizado que se retira progresivamente según el avance individual",
        implementacion: [
          "Diagnóstico inicial de zona de desarrollo próximo",
          "Sistemas de apoyo graduales y removibles",
          "Monitoreo continuo del progreso individual",
          "Transición autónoma cuando sea apropiado"
        ]
      },
      "Agrupamiento Dinámico": {
        descripcion: "Formación flexible de grupos según objetivos específicos y complementariedad",
        implementacion: [
          "Grupos homogéneos para desarrollo de fortalezas",
          "Grupos heterogéneos para enriquecimiento mutuo",
          "Rotación según fase del aprendizaje",
          "Liderazgo compartido basado en expertise"
        ]
      }
    };
  }, []);

  const contextualizacionSociocultural = useMemo(() => {
    return {
      urbano: {
        adaptaciones: ["Conexión con problemáticas citadinas", "Uso de tecnología disponible", "Vinculación con instituciones urbanas"],
        recursos: ["Museos", "Bibliotecas", "Centros tecnológicos", "Empresas locales"],
        desafios: ["Diversidad cultural", "Desigualdad socioeconómica", "Ritmo acelerado"]
      },
      rural: {
        adaptaciones: ["Valoración del conocimiento ancestral", "Integración con actividades productivas", "Conexión con la naturaleza"],
        recursos: ["Saberes comunitarios", "Recursos naturales", "Tradiciones orales", "Actividades agropecuarias"],
        desafios: ["Limitaciones tecnológicas", "Distancias geográficas", "Migración juvenil"]
      },
      mixto: {
        adaptaciones: ["Puentes entre lo urbano y rural", "Intercambio de perspectivas", "Valoración de ambos contextos"],
        recursos: ["Diversidad de experiencias", "Redes amplias", "Múltiples referencias"],
        desafios: ["Integración de diferencias", "Equidad de oportunidades", "Comunicación intercultural"]
      }
    };
  }, []);

  const getMetodologiaIcon = (metodologia: string) => {
    if (metodologia.includes("ABP") || metodologia.includes("Problemas")) return <Target className="w-5 h-5 text-blue-500" />;
    if (metodologia.includes("Design")) return <Lightbulb className="w-5 h-5 text-yellow-500" />;
    if (metodologia.includes("Inmersiva")) return <Users className="w-5 h-5 text-purple-500" />;
    if (metodologia.includes("Investigación")) return <FlaskConical className="w-5 h-5 text-green-500" />;
    return <Brain className="w-5 h-5 text-indigo-500" />;
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-2xl text-blue-800 flex items-center gap-2">
            <Brain className="w-6 h-6" />
            Sistema de Inteligencia Pedagógica Avanzada
          </CardTitle>
          <p className="text-sm text-blue-600">
            Metodologías innovadoras contextualizadas para maximizar el aprendizaje significativo
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{materia}</Badge>
              <Badge variant="secondary">{perfilDominante} dominante</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4" />
              <span>Contexto: {contextoSociocultural}</span>
            </div>
          </div>

          {/* Metodologías Innovadoras */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Puzzle className="w-5 h-5" />
              Metodologías Pedagógicas Innovadoras
            </h3>
            
            {metodologiasInnovadoras.map((metodologia, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="border border-indigo-200 hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg text-indigo-700 flex items-center gap-2">
                      {getMetodologiaIcon(metodologia.nombre)}
                      {metodologia.nombre}
                    </CardTitle>
                    <p className="text-sm text-gray-600">{metodologia.descripcion}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Implementación */}
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">🎯 Implementación:</h5>
                      <ol className="space-y-1 text-sm text-gray-700">
                        {metodologia.implementacion.map((paso, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-indigo-500 font-bold">{idx + 1}.</span>
                            <span>{paso}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Adaptaciones por perfil */}
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">⚙️ Adaptaciones por Estilo:</h5>
                      <div className="grid md:grid-cols-2 gap-3">
                        {Object.entries(metodologia.adaptacionesPorPerfil).map(([perfil, adaptaciones]) => (
                          <div key={perfil} className="bg-gray-50 p-3 rounded-lg">
                            <div className="font-medium text-sm text-gray-800 mb-1">{perfil}:</div>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {adaptaciones.map((adaptacion, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <span className="text-indigo-400">•</span>
                                  <span>{adaptacion}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recursos y evaluación */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h6 className="font-semibold text-gray-800 text-sm mb-1">📋 Recursos:</h6>
                        <div className="flex flex-wrap gap-1">
                          {metodologia.recursosNecesarios.map((recurso, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{recurso}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h6 className="font-semibold text-gray-800 text-sm mb-1">📊 Evaluación:</h6>
                        <p className="text-xs text-gray-600">{metodologia.evaluacionEfectividad}</p>
                      </div>
                    </div>

                    {/* Contextualización */}
                    <div className="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                      <h6 className="font-semibold text-yellow-800 text-sm mb-1">🌍 Contextualización:</h6>
                      <p className="text-xs text-yellow-700">{metodologia.contextualización}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Estrategias de Diferenciación */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TreePine className="w-5 h-5" />
              Estrategias de Diferenciación Avanzada
            </h3>
            
            <div className="grid gap-4">
              {Object.entries(estrategiasdiferenciacion).map(([nombre, estrategia]) => (
                <Card key={nombre} className="border border-green-200">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-green-800 mb-2">{nombre}</h4>
                    <p className="text-sm text-gray-700 mb-3">{estrategia.descripcion}</p>
                    <div className="space-y-1">
                      {estrategia.implementacion.map((paso, idx) => (
                        <div key={idx} className="flex gap-2 text-xs text-gray-600">
                          <span className="text-green-500">▸</span>
                          <span>{paso}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InteligenciaPedagogica;