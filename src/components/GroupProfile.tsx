
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowLeft, Users, BarChart3, BookOpen, Eye, Headphones, Hand, PenTool } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StudentCard } from "@/components/ui/enhanced-card";
import { ProgressiveDisclosure, StudentSectionDisclosure } from "@/components/ui/progressive-disclosure";
import { LoadingState, StudentCardSkeleton } from "@/components/ui/loading-states";
import RecursosPedagogicos from "./RecursosPedagogicos";
import AnalisisGrupalAvanzado from "./AnalisisGrupalAvanzado";
import ReporteGrupal from "./ReporteGrupal";

interface Student {
  id: number;
  name: string;
  perfil: string;
  ajustes: string;
  progreso: number;
  avatar: string;
}

interface Group {
  id: number;
  name: string;
  studentCount: number;
  year: string;
  section: string;
  students: Student[];
}

interface GroupProfileProps {
  group: Group;
  onBack: () => void;
  onStudentClick: (student: Student) => void;
}

const GroupProfile = ({ group, onBack, onStudentClick }: GroupProfileProps) => {
  console.log("[DEBUG] GroupProfile component starting to render");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  // Calcular estadísticas de estilos de aprendizaje
  const getLearningstyleStats = () => {
    const styles = {
      "Visual": 0,
      "Kinestésico": 0,
      "Auditivo": 0,
      "Lector/escritor": 0
    };

    group.students.forEach(student => {
      const profile = student.perfil.toLowerCase();
      if (profile.includes("visual")) styles["Visual"]++;
      if (profile.includes("kinestésico") || profile.includes("kinesthetic")) styles["Kinestésico"]++;
      if (profile.includes("auditivo")) styles["Auditivo"]++;
      if (profile.includes("lecto") || profile.includes("escritor")) styles["Lector/escritor"]++;
    });

    return styles;
  };

  const learningStyles = getLearningstyleStats();
  const totalStudents = group.students.length;

  // Generar recomendaciones pedagógicas basadas en los estilos predominantes
  const getPedagogicalRecommendations = () => {
    const recommendations = [];
    const maxStyle = Object.entries(learningStyles).reduce((a, b) => learningStyles[a[0]] > learningStyles[b[0]] ? a : b);
    const diversityIndex = Object.values(learningStyles).filter(count => count > 0).length;

    if (maxStyle[1] > totalStudents * 0.4) {
      // Estilo predominante
      switch (maxStyle[0]) {
        case "Visual":
          recommendations.push("Predomina el perfil visual. Se recomienda incorporar recursos gráficos como imágenes, mapas mentales y esquemas.");
          recommendations.push("Utilizar presentaciones con apoyo visual, infografías y organizadores gráficos.");
          break;
        case "Kinestésico":
          recommendations.push("Predomina el perfil kinestésico. Incorporar actividades prácticas, experimentos y manipulación de materiales.");
          recommendations.push("Permitir movimiento en el aula y actividades que involucren el cuerpo.");
          break;
        case "Auditivo":
          recommendations.push("Predomina el perfil auditivo. Priorizar explicaciones verbales, debates y actividades de escucha.");
          recommendations.push("Utilizar música, podcasts y presentaciones orales como recursos didácticos.");
          break;
        case "Lector/escritor":
          recommendations.push("Predomina el perfil lecto-escritor. Enfatizar la lectura de textos, escritura y análisis de documentos.");
          recommendations.push("Proporcionar material escrito detallado y actividades de redacción.");
          break;
      }
    }

    if (diversityIndex >= 3) {
      recommendations.push("Grupo con perfiles diversos. Utilizar recursos multimodales (audio, texto, imagen) facilitará el acceso para todos.");
      recommendations.push("Planificar actividades que combinen diferentes modalidades de aprendizaje.");
    }

    if (recommendations.length === 0) {
      recommendations.push("Grupo balanceado. Se recomienda alternar entre diferentes estrategias pedagógicas.");
    }

    return recommendations;
  };

  const recommendations = getPedagogicalRecommendations();

  // Determinar perfil dominante para los nuevos componentes
  const perfilDominante = Object.entries(learningStyles).reduce((a, b) => 
    learningStyles[a[0]] > learningStyles[b[0]] ? a : b
  )[0];

  // Calcular diversidad del grupo
  const diversidadGrupo = Object.values(learningStyles).filter(count => count > 0).length;

  const getStyleIcon = (style: string) => {
    switch (style) {
      case "Visual": return <Eye className="w-5 h-5 text-blue-500" />;
      case "Kinestésico": return <Hand className="w-5 h-5 text-green-500" />;
      case "Auditivo": return <Headphones className="w-5 h-5 text-purple-500" />;
      case "Lector/escritor": return <PenTool className="w-5 h-5 text-orange-500" />;
      default: return <BookOpen className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStyleColor = (style: string) => {
    switch (style) {
      case "Visual": return "bg-blue-500";
      case "Kinestésico": return "bg-green-500";
      case "Auditivo": return "bg-purple-500";
      case "Lector/escritor": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <Button 
            onClick={onBack}
            variant="outline" 
            className="mb-4 hover:bg-blue-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a grupos
          </Button>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              👥 Perfil del Grupo {group.name}
            </h1>
            <p className="text-xl text-gray-600">
              {group.year} - {group.section} • {totalStudents} estudiantes
            </p>
          </div>
        </motion.div>

        {/* 1. Lista de alumnos */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <ProgressiveDisclosure
            title="Lista de alumnos"
            preview={`${totalStudents} estudiantes en el grupo`}
            defaultOpen={true}
            variant="outlined"
          >
            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <StudentCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.students.map((student, index) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    onClick={() => onStudentClick(student)}
                    delay={index * 0.05}
                  />
                ))}
              </div>
            )}
          </ProgressiveDisclosure>
        </motion.div>

        {/* 2. Resumen del perfil de acceso grupal */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <StudentSectionDisclosure
            title="Perfil grupal por estilo de aprendizaje"
            icon={<BarChart3 className="w-5 h-5" />}
            summary="Distribución de estilos de aprendizaje y recomendaciones"
            defaultOpen={true}
            priority="high"
          >
            <div className="space-y-6">
              {/* Estadísticas en barras */}
              <div className="space-y-4">
                {Object.entries(learningStyles).map(([style, count]) => (
                  <div key={style} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {getStyleIcon(style)}
                        <span className="font-medium text-gray-700">{style}</span>
                      </div>
                      <span className="text-lg font-semibold text-gray-800">
                        {count} estudiante{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: totalStudents > 0 ? `${(count / totalStudents) * 100}%` : '0%' }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className={`h-4 rounded-full ${getStyleColor(style)}`}
                      />
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0}%
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumen visual */}
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-800">Resumen del grupo</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  {Object.entries(learningStyles).map(([style, count]) => (
                    <motion.div 
                      key={style} 
                      className="bg-white p-3 rounded-lg shadow-sm"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.8, duration: 0.3 }}
                    >
                      <div className="flex justify-center mb-1">
                        {getStyleIcon(style)}
                      </div>
                      <div className="text-2xl font-bold text-gray-800">{count}</div>
                      <div className="text-xs text-gray-600">{style}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </StudentSectionDisclosure>
        </motion.div>

        {/* 3. Sugerencias para favorecer el aprendizaje */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8"
        >
          <StudentSectionDisclosure
            title="Sugerencias para favorecer el aprendizaje de este grupo"
            icon={<BookOpen className="w-5 h-5" />}
            summary={`Perfil predominante: ${perfilDominante} - Sugerencias contextualizadas`}
            defaultOpen={true}
            priority="medium"
          >
            <div className="space-y-6">
              {/* Sugerencias para el aula */}
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <h4 className="font-semibold text-blue-800 mb-3">Sugerencias para el aula</h4>
                <div className="space-y-2">
                  {perfilDominante === "Visual" && (
                    <>
                      <p className="text-sm text-gray-700">• Si vas a trabajar una temática que implique procesos complejos de abstracción, utiliza un disparador videográfico.</p>
                      <p className="text-sm text-gray-700">• Para temáticas con varios subtemas, realizar evaluaciones intermedias para corroborar comprensión.</p>
                      <p className="text-sm text-gray-700">• Ir desarrollando un mapa conceptual grupal para visualizar la complejidad del tema.</p>
                      <p className="text-sm text-gray-700">• Sumar instancias de debate una vez introducidos los temas para beneficiar a perfiles auditivos.</p>
                      <p className="text-sm text-gray-700">• Considerar propuestas con desplazamiento físico orientado, para favorecer a perfiles kinestésicos.</p>
                    </>
                  )}
                  {perfilDominante === "Auditivo" && (
                    <>
                      <p className="text-sm text-gray-700">• Incorporar explicaciones verbales detalladas y debates estructurados.</p>
                      <p className="text-sm text-gray-700">• Utilizar música o sonidos ambientales para crear contexto de aprendizaje.</p>
                      <p className="text-sm text-gray-700">• Alternar momentos de discusión grupal con síntesis individual.</p>
                      <p className="text-sm text-gray-700">• Incluir apoyo visual para estudiantes con perfil visual minoritario.</p>
                      <p className="text-sm text-gray-700">• Permitir movimiento controlado para estudiantes kinestésicos.</p>
                    </>
                  )}
                  {perfilDominante === "Kinestésico" && (
                    <>
                      <p className="text-sm text-gray-700">• Incorporar actividades que requieran manipulación de materiales concretos.</p>
                      <p className="text-sm text-gray-700">• Permitir desplazamiento y cambios de posición durante las clases.</p>
                      <p className="text-sm text-gray-700">• Utilizar experimentos y demostraciones prácticas.</p>
                      <p className="text-sm text-gray-700">• Complementar con apoyos visuales para estudiantes con ese perfil.</p>
                      <p className="text-sm text-gray-700">• Incluir momentos de verbalización para perfil auditivo.</p>
                    </>
                  )}
                  {perfilDominante === "Lector/escritor" && (
                    <>
                      <p className="text-sm text-gray-700">• Proporcionar textos de apoyo y material escrito detallado.</p>
                      <p className="text-sm text-gray-700">• Implementar actividades de análisis y síntesis de documentos.</p>
                      <p className="text-sm text-gray-700">• Fomentar la toma de notas y reflexión escrita.</p>
                      <p className="text-sm text-gray-700">• Complementar con recursos visuales como esquemas y mapas conceptuales.</p>
                      <p className="text-sm text-gray-700">• Incluir instancias de presentación oral para perfil auditivo.</p>
                    </>
                  )}
                </div>
              </div>

              {/* Sugerencias para las evaluaciones */}
              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                <h4 className="font-semibold text-green-800 mb-3">Sugerencias para las evaluaciones</h4>
                <div className="space-y-2">
                  {perfilDominante === "Visual" && (
                    <>
                      <p className="text-sm text-gray-700">• Presentar consignas con recuadros, palabras clave en negrita y subrayados.</p>
                      <p className="text-sm text-gray-700">• Agregar imágenes que apoyen la comprensión de la consigna.</p>
                      <p className="text-sm text-gray-700">• Utilizar una consigna a la vez, evitando concatenaciones.</p>
                    </>
                  )}
                  {perfilDominante === "Auditivo" && (
                    <>
                      <p className="text-sm text-gray-700">• Permitir lectura oral de las consignas por parte del docente.</p>
                      <p className="text-sm text-gray-700">• Incluir la opción de evaluación oral como alternativa.</p>
                      <p className="text-sm text-gray-700">• Presentar instrucciones claras y secuenciales verbalmente.</p>
                    </>
                  )}
                  {perfilDominante === "Kinestésico" && (
                    <>
                      <p className="text-sm text-gray-700">• Permitir pausas y cambios de posición durante la evaluación.</p>
                      <p className="text-sm text-gray-700">• Incluir ejercicios que requieran manipulación cuando sea posible.</p>
                      <p className="text-sm text-gray-700">• Dividir la evaluación en segmentos más cortos.</p>
                    </>
                  )}
                  {perfilDominante === "Lector/escritor" && (
                    <>
                      <p className="text-sm text-gray-700">• Proporcionar consignas escritas detalladas y precisas.</p>
                      <p className="text-sm text-gray-700">• Permitir tiempo adicional para lectura y análisis.</p>
                      <p className="text-sm text-gray-700">• Incluir ejercicios de desarrollo y análisis textual.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </StudentSectionDisclosure>
        </motion.div>

        {/* 4-7. Advanced Components with Progressive Disclosure */}
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <ProgressiveDisclosure
              title="Recursos Pedagógicos Contextualizados"
              preview="Recursos adaptados al perfil dominante del grupo"
              variant="outlined"
            >
              <RecursosPedagogicos 
                perfilDominante={perfilDominante}
                diversidadGrupo={diversidadGrupo}
                estudiantes={totalStudents}
              />
            </ProgressiveDisclosure>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <ProgressiveDisclosure
              title="Análisis Grupal Avanzado"
              preview="Métricas detalladas y análisis predictivo del grupo"
              variant="outlined"
            >
              <AnalisisGrupalAvanzado
                students={group.students}
                groupName={group.name}
              />
            </ProgressiveDisclosure>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <div className="flex justify-center">
              <ReporteGrupal
                students={group.students.map(s => ({
                  ...s,
                  promedio: 8.0,
                  tendencia: 'up' as const,
                  contemplaciones: ['Apoyo visual', 'Tiempo adicional'],
                  alertas: s.id % 3 === 0 ? ['Requiere seguimiento'] : undefined
                }))}
                groupName={group.name}
                period="Tercer Trimestre 2024"
              />
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default GroupProfile;
