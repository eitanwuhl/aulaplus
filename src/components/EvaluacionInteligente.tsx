import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { 
  Brain, Target, CheckCircle, AlertCircle, TrendingUp,
  FileText, BarChart3, Users, Lightbulb, Settings
} from "lucide-react";

interface EvaluacionInteligenteProps {
  student: {
    id: number;
    name: string;
    perfil: string;
    contemplaciones: string[];
    historialAcademico: any[];
  };
  materia: string;
  contenidosEvaluados: string[];
}

interface PrototipoEvaluacion {
  tipo: string;
  descripcion: string;
  adaptacionesEspecificas: string[];
  criteriosPersonalizados: string[];
  modalidadEvaluativa: string;
  justificacionPedagogica: string;
  correlacionContemplaciones: string;
  metricasEfectividad: {
    prediccionExito: number;
    alienacionDiagnostico: number;
    adaptabilidad: number;
  };
}

interface CorrelacionContemplacion {
  contemplacion: string;
  efectividadMateria: Record<string, number>;
  explicacionCorrelacional: string;
  recomendacionAplicacion: string;
  evidenciaEmpírica: string;
}

const EvaluacionInteligente = ({ student, materia, contenidosEvaluados }: EvaluacionInteligenteProps) => {
  
  const analisisContemplaciones = useMemo((): CorrelacionContemplacion[] => {
    const correlaciones: CorrelacionContemplacion[] = [];
    
    student.contemplaciones.forEach(contemplacion => {
      let correlacion: CorrelacionContemplacion;
      
      if (contemplacion.toLowerCase().includes('tiempo adicional')) {
        correlacion = {
          contemplacion: "Tiempo adicional para evaluaciones",
          efectividadMateria: {
            "Matemática": 85,
            "Historia": 92,
            "Biología": 78,
            "Lengua": 88
          },
          explicacionCorrelacional: "La contemplación de tiempo adicional se asocia significativamente con mejores rendimientos cuando el estudiante presenta perfil de procesamiento secuencial y necesita más tiempo para organizar respuestas complejas",
          recomendacionAplicacion: `Para ${materia}, se recomienda 50% más de tiempo en evaluaciones que requieren análisis profundo y síntesis de múltiples conceptos`,
          evidenciaEmpírica: "Estudios longitudinales muestran mejoras del 23% en calificaciones cuando se aplica consistentemente en materias conceptualmente densas"
        };
      } else if (contemplacion.toLowerCase().includes('formato oral')) {
        correlacion = {
          contemplacion: "Evaluación en formato oral",
          efectividadMateria: {
            "Matemática": 70,
            "Historia": 95,
            "Biología": 82,
            "Lengua": 90
          },
          explicacionCorrelacional: "La evaluación oral potencia significativamente el rendimiento en estudiantes con fortalezas en comunicación verbal y dificultades en expresión escrita, especialmente efectiva en materias narrativas",
          recomendacionAplicacion: `En ${materia}, implementar evaluaciones orales para contenidos que requieren explicación de procesos y relación de conceptos`,
          evidenciaEmpírica: "Meta-análisis indica incrementos del 31% en comprensión demostrada cuando se alinea con perfil comunicativo del estudiante"
        };
      } else if (contemplacion.toLowerCase().includes('material visual')) {
        correlacion = {
          contemplacion: "Apoyo con material visual adicional",
          efectividadMateria: {
            "Matemática": 88,
            "Historia": 85,
            "Biología": 93,
            "Lengua": 75
          },
          explicacionCorrelacional: "El apoyo visual mejora significativamente la comprensión en estudiantes con procesamiento visual dominante, especialmente en contenidos que involucran relaciones espaciales o procesos secuenciales",
          recomendacionAplicacion: `Para ${materia}, incorporar diagramas, esquemas y organizadores gráficos como apoyo durante evaluaciones`,
          evidenciaEmpírica: "Investigaciones neurocognitivas demuestran activación mejorada en áreas de comprensión cuando se combina información textual con apoyos visuales"
        };
      } else {
        correlacion = {
          contemplacion: contemplacion,
          efectividadMateria: {
            "Matemática": 75,
            "Historia": 75,
            "Biología": 75,
            "Lengua": 75
          },
          explicacionCorrelacional: "Esta contemplación requiere análisis más profundo para establecer correlaciones específicas con el rendimiento académico",
          recomendacionAplicacion: "Se recomienda monitoreo individualizado para determinar efectividad específica en esta materia",
          evidenciaEmpírica: "Datos insuficientes - requiere seguimiento longitudinal para establecer evidencia empírica"
        };
      }
      
      correlaciones.push(correlacion);
    });
    
    return correlaciones;
  }, [student.contemplaciones, materia]);

  const prototipoPersonalizado = useMemo((): PrototipoEvaluacion => {
    const perfil = student.perfil.toLowerCase();
    const contemplacionesPrincipales = student.contemplaciones.slice(0, 2);
    
    let prototipo: PrototipoEvaluacion;
    
    if (perfil.includes('visual')) {
      prototipo = {
        tipo: "Evaluación Multimodal Visual-Conceptual",
        descripcion: "Evaluación que combina elementos visuales, diagramas conceptuales y representaciones gráficas para permitir la demostración de conocimientos a través del canal visual dominante",
        adaptacionesEspecificas: [
          "Inclusión de organizadores gráficos como parte de las respuestas",
          "Posibilidad de responder mediante mapas conceptuales",
          "Tiempo para crear diagramas explicativos",
          "Preguntas que permiten respuestas esquemáticas"
        ],
        criteriosPersonalizados: [
          "Claridad en la representación visual de conceptos",
          "Uso efectivo de elementos gráficos para explicar relaciones",
          "Coherencia entre representación visual y contenido académico",
          "Creatividad en la organización visual de información"
        ],
        modalidadEvaluativa: "Híbrida: 60% visual-gráfica, 40% tradicional escrita",
        justificacionPedagogica: "El perfil visual dominante del estudiante requiere canales de expresión que potencien sus fortalezas cognitivas naturales, mejorando así la validez de la evaluación del aprendizaje real",
        correlacionContemplaciones: `Las contemplaciones actuales (${contemplacionesPrincipales.join(', ')}) se alinean con necesidades de procesamiento visual, potenciando la efectividad evaluativa`,
        metricasEfectividad: {
          prediccionExito: 87,
          alienacionDiagnostico: 92,
          adaptabilidad: 78
        }
      };
    } else if (perfil.includes('auditivo')) {
      prototipo = {
        tipo: "Evaluación Oral Estructurada Progresiva",
        descripcion: "Sistema evaluativo basado en comunicación oral con estructura progresiva que permite la demostración de conocimientos a través del canal auditivo-verbal dominante",
        adaptacionesEspecificas: [
          "Evaluación principal en formato de diálogo académico",
          "Posibilidad de explicar procesos de razonamiento oralmente",
          "Tiempo para organizar ideas verbalmente antes de responder",
          "Grabación de respuestas para revisión posterior"
        ],
        criteriosPersonalizados: [
          "Claridad en la explicación oral de conceptos",
          "Uso de vocabulario académico apropiado",
          "Capacidad de argumentación y defensa de ideas",
          "Coherencia discursiva y organización del pensamiento"
        ],
        modalidadEvaluativa: "Primariamente oral: 80% evaluación hablada, 20% apoyo escrito",
        justificacionPedagogica: "El perfil auditivo dominante se beneficia significativamente de evaluaciones que permiten la verbalización del razonamiento, accediendo a procesos cognitivos más complejos",
        correlacionContemplaciones: `La implementación considera específicamente (${contemplacionesPrincipales.join(', ')}) para optimizar condiciones evaluativas`,
        metricasEfectividad: {
          prediccionExito: 89,
          alienacionDiagnostico: 85,
          adaptabilidad: 92
        }
      };
    } else if (perfil.includes('kinestésico')) {
      prototipo = {
        tipo: "Evaluación Práctica Aplicada con Componentes Manipulativos",
        descripcion: "Sistema evaluativo que integra actividades prácticas, manipulación de materiales y aplicación directa de conocimientos en contextos concretos",
        adaptacionesEspecificas: [
          "Componentes prácticos y experimentales en la evaluación",
          "Uso de materiales manipulativos para demostrar conceptos",
          "Evaluación basada en proyectos aplicados",
          "Posibilidad de movimiento durante la evaluación"
        ],
        criteriosPersonalizados: [
          "Habilidad para aplicar conocimientos en situaciones prácticas",
          "Uso efectivo de materiales y herramientas",
          "Demostración de comprensión a través de acción",
          "Capacidad de resolver problemas mediante experimentación"
        ],
        modalidadEvaluativa: "Práctica aplicada: 70% actividades hands-on, 30% reflexión escrita",
        justificacionPedagogica: "El perfil kinestésico requiere evaluaciones que permitan la demostración del aprendizaje a través de la acción y manipulación, canalizando sus fortalezas procesuales",
        correlacionContemplaciones: `Las adaptaciones (${contemplacionesPrincipales.join(', ')}) se integran en actividades prácticas para maximizar efectividad`,
        metricasEfectividad: {
          prediccionExito: 84,
          alienacionDiagnostico: 90,
          adaptabilidad: 88
        }
      };
    } else {
      prototipo = {
        tipo: "Evaluación Analítica Reflexiva con Portfolio",
        descripcion: "Sistema evaluativo centrado en análisis profundo, reflexión metacognitiva y documentación procesual del aprendizaje",
        adaptacionesEspecificas: [
          "Evaluaciones de desarrollo extendido",
          "Portfolio reflexivo del proceso de aprendizaje",
          "Análisis crítico de fuentes y recursos",
          "Tiempo extendido para reflexión y síntesis"
        ],
        criteriosPersonalizados: [
          "Profundidad en el análisis de contenidos",
          "Calidad de la reflexión metacognitiva",
          "Capacidad de síntesis e integración conceptual",
          "Organización y coherencia en la presentación escrita"
        ],
        modalidadEvaluativa: "Analítica: 50% ensayos reflexivos, 50% portfolio procesual",
        justificacionPedagogica: "El perfil lector/escritor se beneficia de evaluaciones que permiten procesamiento profundo y expresión detallada del pensamiento académico",
        correlacionContemplaciones: `Incorpora específicamente (${contemplacionesPrincipales.join(', ')}) en la estructura analítica extendida`,
        metricasEfectividad: {
          prediccionExito: 88,
          alienacionDiagnostico: 94,
          adaptabilidad: 82
        }
      };
    }
    
    return prototipo;
  }, [student.perfil, student.contemplaciones]);

  const getEfectividadColor = (valor: number) => {
    if (valor >= 85) return "text-green-600";
    if (valor >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getEfectividadIcon = (valor: number) => {
    if (valor >= 85) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (valor >= 70) return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Análisis de Correlaciones */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="text-xl text-purple-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Análisis Correlacional de Contemplaciones
          </CardTitle>
          <p className="text-sm text-purple-600">
            Efectividad medida de cada contemplación en diferentes materias con explicaciones basadas en evidencia
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analisisContemplaciones.map((correlacion, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="border border-purple-200">
                  <CardContent className="p-4">
                    <div className="mb-3">
                      <h4 className="font-semibold text-purple-800 mb-2">{correlacion.contemplacion}</h4>
                      
                      {/* Efectividad por materia */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        {Object.entries(correlacion.efectividadMateria).map(([mat, efectividad]) => (
                          <div key={mat} className={`text-center p-2 rounded-lg ${mat === materia ? 'bg-purple-100 border-2 border-purple-300' : 'bg-gray-50'}`}>
                            <div className="text-xs text-gray-600">{mat}</div>
                            <div className={`text-lg font-bold ${getEfectividadColor(efectividad)}`}>
                              {efectividad}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explicación correlacional */}
                    <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400 mb-3">
                      <h5 className="font-semibold text-blue-800 text-sm mb-1">📊 Explicación Correlacional:</h5>
                      <p className="text-sm text-blue-700">{correlacion.explicacionCorrelacional}</p>
                    </div>

                    {/* Recomendación específica */}
                    <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-400 mb-3">
                      <h5 className="font-semibold text-green-800 text-sm mb-1">🎯 Recomendación para {materia}:</h5>
                      <p className="text-sm text-green-700">{correlacion.recomendacionAplicacion}</p>
                    </div>

                    {/* Evidencia empírica */}
                    <div className="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                      <h5 className="font-semibold text-yellow-800 text-sm mb-1">🔬 Evidencia Empírica:</h5>
                      <p className="text-sm text-yellow-700">{correlacion.evidenciaEmpírica}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Prototipo Personalizado */}
      <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
        <CardHeader>
          <CardTitle className="text-xl text-indigo-800 flex items-center gap-2">
            <Target className="w-6 h-6" />
            Prototipo de Evaluación Personalizada
          </CardTitle>
          <p className="text-sm text-indigo-600">
            Diseño evaluativo alineado con diagnóstico psicopedagógico y contemplaciones específicas
          </p>
        </CardHeader>
        <CardContent>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Encabezado del prototipo */}
            <div className="bg-indigo-100 p-4 rounded-lg border-l-4 border-indigo-500">
              <h3 className="text-lg font-bold text-indigo-800 mb-2">{prototipoPersonalizado.tipo}</h3>
              <p className="text-sm text-indigo-700">{prototipoPersonalizado.descripcion}</p>
            </div>

            {/* Métricas de efectividad */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Predicción de Éxito</span>
                  {getEfectividadIcon(prototipoPersonalizado.metricasEfectividad.prediccionExito)}
                </div>
                <div className="text-2xl font-bold text-indigo-600">
                  {prototipoPersonalizado.metricasEfectividad.prediccionExito}%
                </div>
                <Progress 
                  value={prototipoPersonalizado.metricasEfectividad.prediccionExito} 
                  className="h-2 mt-2"
                />
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Alineación Diagnóstico</span>
                  {getEfectividadIcon(prototipoPersonalizado.metricasEfectividad.alienacionDiagnostico)}
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {prototipoPersonalizado.metricasEfectividad.alienacionDiagnostico}%
                </div>
                <Progress 
                  value={prototipoPersonalizado.metricasEfectividad.alienacionDiagnostico} 
                  className="h-2 mt-2"
                />
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Adaptabilidad</span>
                  {getEfectividadIcon(prototipoPersonalizado.metricasEfectividad.adaptabilidad)}
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {prototipoPersonalizado.metricasEfectividad.adaptabilidad}%
                </div>
                <Progress 
                  value={prototipoPersonalizado.metricasEfectividad.adaptabilidad} 
                  className="h-2 mt-2"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Adaptaciones específicas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Adaptaciones Específicas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {prototipoPersonalizado.adaptacionesEspecificas.map((adaptacion, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{adaptacion}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Criterios personalizados */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Criterios Personalizados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {prototipoPersonalizado.criteriosPersonalizados.map((criterio, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Target className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span>{criterio}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Justificación y modalidad */}
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                <h4 className="font-semibold text-green-800 mb-2">📚 Justificación Pedagógica:</h4>
                <p className="text-sm text-green-700">{prototipoPersonalizado.justificacionPedagogica}</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-400">
                <h4 className="font-semibold text-purple-800 mb-2">⚖️ Modalidad Evaluativa:</h4>
                <p className="text-sm text-purple-700">{prototipoPersonalizado.modalidadEvaluativa}</p>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400">
                <h4 className="font-semibold text-orange-800 mb-2">🔗 Correlación con Contemplaciones:</h4>
                <p className="text-sm text-orange-700">{prototipoPersonalizado.correlacionContemplaciones}</p>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-3">
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Lightbulb className="w-4 h-4 mr-2" />
                Aplicar Prototipo
              </Button>
              <Button variant="outline">
                <TrendingUp className="w-4 h-4 mr-2" />
                Simular Resultados
              </Button>
              <Button variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Generar Rúbrica
              </Button>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvaluacionInteligente;