import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { 
  TrendingUp, TrendingDown, Activity, AlertTriangle,
  Target, BookOpen, Users, Clock, BarChart3
} from "lucide-react";

interface TendenciaAcademica {
  materia: string;
  tendencia: "ascendente" | "descendente" | "estable" | "fluctuante";
  porcentajeCambio: number;
  periodoAnalisis: string;
  factoresInfluyentes: string[];
  explicacionDetallada: string;
  prediccionProximos3Meses: string;
  recomendacionesAccion: string[];
  nivelConfianza: number;
  datosComparativos: {
    promedioGrupo: number;
    promedioNacional: number;
    estudiantesEnSituacionSimilar: number;
  };
}

interface ExplicadorTendenciasProps {
  studentId: number;
  studentName: string;
}

const ExplicadorTendencias = ({ studentId, studentName }: ExplicadorTendenciasProps) => {
  // Mock data basado en análisis de patrones reales
  const tendenciasAcademicas: TendenciaAcademica[] = [
    {
      materia: "Matemática",
      tendencia: "ascendente",
      porcentajeCambio: 23,
      periodoAnalisis: "Últimos 6 meses",
      factoresInfluyentes: [
        "Implementación de contemplaciones de tiempo adicional",
        "Mejora en estrategias de resolución de problemas",
        "Aumento de confianza tras éxitos iniciales",
        "Apoyo familiar más estructurado en casa"
      ],
      explicacionDetallada: "La tendencia ascendente en Matemática se debe principalmente al ajuste en las estrategias evaluativas que permitieron al estudiante demostrar su verdadero nivel de comprensión. El tiempo adicional redujo la ansiedad evaluativa, mientras que el uso de material visual mejoró su acceso a los conceptos abstractos. Los datos muestran una mejora consistente especialmente en geometría y resolución de problemas contextualizados.",
      prediccionProximos3Meses: "Se proyecta una continuación de la tendencia positiva con una mejora adicional del 15-18%, alcanzando potencialmente el promedio del grupo para fin de trimestre.",
      recomendacionesAccion: [
        "Mantener contemplaciones actuales que han demostrado efectividad",
        "Introducir progresivamente mayor complejidad en problemas",
        "Reforzar autoestima académica celebrando progresos",
        "Considerar tutorías de apoyo para consolidar avances"
      ],
      nivelConfianza: 87,
      datosComparativos: {
        promedioGrupo: 7.2,
        promedioNacional: 6.8,
        estudiantesEnSituacionSimilar: 34
      }
    },
    {
      materia: "Historia",
      tendencia: "fluctuante",
      porcentajeCambio: -8,
      periodoAnalisis: "Últimos 4 meses",
      factoresInfluyentes: [
        "Inconsistencia en la aplicación de contemplaciones",
        "Variabilidad en los estilos docentes entre unidades",
        "Contenidos más abstractos en período reciente",
        "Reducción en el uso de recursos visuales"
      ],
      explicacionDetallada: "La tendencia fluctuante refleja la alta sensibilidad del estudiante a los cambios metodológicos. Los mejores resultados se correlacionan directamente con el uso de líneas de tiempo visuales y mapas conceptuales, mientras que las caídas coinciden con evaluaciones puramente textuales. La inconsistencia sugiere que el estudiante requiere adaptaciones más sistemáticas y no ocasionales.",
      prediccionProximos3Meses: "Con implementación consistente de adaptaciones visuales, se proyecta estabilización en nivel medio-alto. Sin ajustes, probable continuación de fluctuaciones.",
      recomendacionesAccion: [
        "Estandarizar uso de apoyos visuales en todas las evaluaciones",
        "Coordinación entre docentes para consistencia metodológica",
        "Crear banco de recursos visuales para contenidos históricos",
        "Implementar evaluaciones formativas más frecuentes"
      ],
      nivelConfianza: 74,
      datosComparativos: {
        promedioGrupo: 8.1,
        promedioNacional: 7.5,
        estudiantesEnSituacionSimilar: 28
      }
    },
    {
      materia: "Lengua",
      tendencia: "descendente",
      porcentajeCambio: -16,
      periodoAnalisis: "Últimos 5 meses",
      factoresInfluyentes: [
        "Aumento de complejidad en análisis literarios",
        "Menor efectividad de contemplaciones en nuevos contenidos",
        "Dificultades emergentes en comprensión inferencial",
        "Impacto de cambios en vida familiar del estudiante"
      ],
      explicacionDetallada: "La tendencia descendente indica que las estrategias actuales de apoyo no están siendo suficientes para los contenidos más complejos de Lengua. El estudiante muestra particular dificultad con textos que requieren interpretación inferencial y análisis crítico. Los datos sugieren que necesita adaptaciones más especializadas para acceder a estos contenidos de alto nivel cognitivo.",
      prediccionProximos3Meses: "Sin intervención especializada, se proyecta una continuación del descenso. Con ajustes específicos en estrategias de comprensión, posible estabilización.",
      recomendacionesAccion: [
        "Evaluación psicopedagógica específica para comprensión lectora",
        "Implementar estrategias de andamiaje para textos complejos",
        "Considerar apoyo especializado en análisis literario",
        "Revisar factores contextuales que puedan estar impactando"
      ],
      nivelConfianza: 92,
      datosComparativos: {
        promedioGrupo: 7.8,
        promedioNacional: 7.3,
        estudiantesEnSituacionSimilar: 45
      }
    }
  ];

  const getTendenciaIcon = (tendencia: string) => {
    switch (tendencia) {
      case "ascendente": return <TrendingUp className="w-5 h-5 text-green-500" />;
      case "descendente": return <TrendingDown className="w-5 h-5 text-red-500" />;
      case "fluctuante": return <Activity className="w-5 h-5 text-yellow-500" />;
      case "estable": return <BarChart3 className="w-5 h-5 text-blue-500" />;
      default: return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTendenciaColor = (tendencia: string) => {
    switch (tendencia) {
      case "ascendente": return "border-green-200 bg-green-50";
      case "descendente": return "border-red-200 bg-red-50";
      case "fluctuante": return "border-yellow-200 bg-yellow-50";
      case "estable": return "border-blue-200 bg-blue-50";
      default: return "border-gray-200 bg-gray-50";
    }
  };

  const getConfianzaColor = (nivel: number) => {
    if (nivel >= 80) return "text-green-600";
    if (nivel >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="border-2 border-emerald-200">
      <CardHeader>
        <CardTitle className="text-xl text-emerald-700 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Análisis Detallado de Tendencias Académicas
        </CardTitle>
        <p className="text-sm text-gray-600">
          Explicación comprehensiva de patrones de rendimiento académico para {studentName}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {tendenciasAcademicas.map((tendencia, index) => (
            <motion.div
              key={tendencia.materia}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className={`border-2 ${getTendenciaColor(tendencia.tendencia)}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getTendenciaIcon(tendencia.tendencia)}
                        {tendencia.materia}
                      </CardTitle>
                      <div className="flex items-center gap-4 mt-2">
                        <Badge 
                          variant="outline" 
                          className={`
                            ${tendencia.tendencia === 'ascendente' ? 'border-green-500 text-green-700' : ''}
                            ${tendencia.tendencia === 'descendente' ? 'border-red-500 text-red-700' : ''}
                            ${tendencia.tendencia === 'fluctuante' ? 'border-yellow-500 text-yellow-700' : ''}
                          `}
                        >
                          {tendencia.tendencia} {Math.abs(tendencia.porcentajeCambio)}%
                        </Badge>
                        <span className="text-sm text-gray-600">{tendencia.periodoAnalisis}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${getConfianzaColor(tendencia.nivelConfianza)}`}>
                        Confianza: {tendencia.nivelConfianza}%
                      </div>
                      <Progress value={tendencia.nivelConfianza} className="h-2 w-20 mt-1" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Explicación detallada */}
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Análisis de la Tendencia
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{tendencia.explicacionDetallada}</p>
                  </div>

                  {/* Factores influyentes */}
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Factores Influyentes Identificados
                    </h4>
                    <ul className="space-y-1">
                      {tendencia.factoresInfluyentes.map((factor, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-blue-500 mt-1">•</span>
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Predicción y datos comparativos */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h5 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Proyección (3 meses)
                      </h5>
                      <p className="text-sm text-blue-700">{tendencia.prediccionProximos3Meses}</p>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h5 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Contexto Comparativo
                      </h5>
                      <div className="space-y-1 text-sm text-purple-700">
                        <div>Promedio grupo: {tendencia.datosComparativos.promedioGrupo}</div>
                        <div>Promedio nacional: {tendencia.datosComparativos.promedioNacional}</div>
                        <div>Casos similares: {tendencia.datosComparativos.estudiantesEnSituacionSimilar} estudiantes</div>
                      </div>
                    </div>
                  </div>

                  {/* Recomendaciones de acción */}
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Recomendaciones de Acción Prioritaria
                    </h4>
                    <ol className="space-y-2">
                      {tendencia.recomendacionesAccion.map((recomendacion, idx) => (
                        <li key={idx} className="flex gap-2 text-sm text-green-700">
                          <span className="font-semibold text-green-600">{idx + 1}.</span>
                          <span>{recomendacion}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExplicadorTendencias;