
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { ArrowLeft, Users, BarChart3, BookOpen, Eye, Headphones, Hand, PenTool, Edit2, Save, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StudentCard } from "@/components/ui/enhanced-card";
import { ProgressiveDisclosure, StudentSectionDisclosure } from "@/components/ui/progressive-disclosure";
import { LoadingState, StudentCardSkeleton } from "@/components/ui/loading-states";
import RecursosPedagogicos from "./RecursosPedagogicos";
import AnalisisGrupalAvanzado from "./AnalisisGrupalAvanzado";
import ReporteGrupal from "./ReporteGrupal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { TeacherSugerencias } from "@/data/mockData";
import { CatalogEmptyState } from "@/components/teacherGroups/CatalogEmptyState";
import {
  dominantLearningStyle,
  getLearningStyleDistribution,
  LEARNING_STYLE_LABELS,
} from "@/lib/teacherGroups/learningStyleStats";

const UNCLASSIFIED_STYLE_LABEL = "Sin perfil clasificado";

interface Student {
  id: number;
  name: string;
  perfil: string;
  ajustes: string;
  progreso: number;
  avatar: string;
}

interface Group {
  id: string;  // Changed to string for consistency with mockData.Group
  name: string;
  studentCount: number;
  year: string;
  section: string;
  students: Student[];
  teacher_sugerencias?: TeacherSugerencias;
}

interface GroupProfileProps {
  group: Group;
  onBack: () => void;
  onStudentClick: (student: Student) => void;
}

const GroupProfile = ({ group, onBack, onStudentClick }: GroupProfileProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();
  const teacherUserId = session?.user?.id;
  const [isLoading, setIsLoading] = useState(false);
  const [teacherSugerencias, setTeacherSugerencias] = useState<TeacherSugerencias | null>(
    group.teacher_sugerencias || null
  );
  const [editingSection, setEditingSection] = useState<'aula' | 'evaluaciones' | 'otras' | null>(null);
  const [editValues, setEditValues] = useState<TeacherSugerencias>({
    aula: '',
    evaluaciones: '',
    otras: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const { counts: learningStyles, unclassified: unclassifiedLearningStyles, totalStudents } =
    getLearningStyleDistribution(group.students);

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

  const perfilDominante = dominantLearningStyle(learningStyles);
  const classifiedStudents = totalStudents - unclassifiedLearningStyles;

  // Calcular diversidad del grupo
  const diversidadGrupo = Object.values(learningStyles).filter(count => count > 0).length;

  // Función para obtener sugerencias por defecto según perfil dominante
  const getDefaultSugerenciasAula = (): string => {
    switch (perfilDominante) {
      case "Visual":
        return "• Si vas a trabajar una temática que implique procesos complejos de abstracción, utiliza un disparador videográfico.\n• Para temáticas con varios subtemas, realizar evaluaciones intermedias para corroborar comprensión.\n• Ir desarrollando un mapa conceptual grupal para visualizar la complejidad del tema.\n• Sumar instancias de debate una vez introducidos los temas para beneficiar a perfiles auditivos.\n• Considerar propuestas con desplazamiento físico orientado, para favorecer a perfiles kinestésicos.";
      case "Auditivo":
        return "• Incorporar explicaciones verbales detalladas y debates estructurados.\n• Utilizar música o sonidos ambientales para crear contexto de aprendizaje.\n• Alternar momentos de discusión grupal con síntesis individual.\n• Incluir apoyo visual para estudiantes con perfil visual minoritario.\n• Permitir movimiento controlado para estudiantes kinestésicos.";
      case "Kinestésico":
        return "• Incorporar actividades que requieran manipulación de materiales concretos.\n• Permitir desplazamiento y cambios de posición durante las clases.\n• Utilizar experimentos y demostraciones prácticas.\n• Complementar con apoyos visuales para estudiantes con ese perfil.\n• Incluir momentos de verbalización para perfil auditivo.";
      case "Lector/escritor":
        return "• Proporcionar textos de apoyo y material escrito detallado.\n• Implementar actividades de análisis y síntesis de documentos.\n• Fomentar la toma de notas y reflexión escrita.\n• Complementar con recursos visuales como esquemas y mapas conceptuales.\n• Incluir instancias de presentación oral para perfil auditivo.";
      default:
        return "";
    }
  };

  const getDefaultSugerenciasEvaluaciones = (): string => {
    switch (perfilDominante) {
      case "Visual":
        return "• Presentar consignas con recuadros, palabras clave en negrita y subrayados.\n• Agregar imágenes que apoyen la comprensión de la consigna.\n• Utilizar una consigna a la vez, evitando concatenaciones.";
      case "Auditivo":
        return "• Permitir lectura oral de las consignas por parte del docente.\n• Incluir la opción de evaluación oral como alternativa.\n• Presentar instrucciones claras y secuenciales verbalmente.";
      case "Kinestésico":
        return "• Permitir pausas y cambios de posición durante la evaluación.\n• Incluir ejercicios que requieran manipulación cuando sea posible.\n• Dividir la evaluación en segmentos más cortos.";
      case "Lector/escritor":
        return "• Proporcionar consignas escritas detalladas y precisas.\n• Permitir tiempo adicional para lectura y análisis.\n• Incluir ejercicios de desarrollo y análisis textual.";
      default:
        return "";
    }
  };

  // Obtener texto a mostrar (override del docente o default)
  const getDisplayText = (section: 'aula' | 'evaluaciones' | 'otras'): string => {
    if (teacherSugerencias?.[section]) {
      return teacherSugerencias[section] || '';
    }
    if (section === 'aula') return getDefaultSugerenciasAula();
    if (section === 'evaluaciones') return getDefaultSugerenciasEvaluaciones();
    return '';
  };

  // Cargar sugerencias del docente desde Supabase
  useEffect(() => {
    if (!teacherUserId) return;

    const loadTeacherSugerencias = async () => {
      try {
        const { data, error } = await supabase
          .from('grupos')
          .select('teacher_sugerencias')
          .eq('id', group.id)
          .eq('user_id', teacherUserId)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading teacher_sugerencias:', error);
          return;
        }

        if (data?.teacher_sugerencias) {
          setTeacherSugerencias(data.teacher_sugerencias as TeacherSugerencias);
        }
      } catch (error) {
        console.error('Error loading teacher_sugerencias:', error);
      }
    };

    void loadTeacherSugerencias();
  }, [group.id, teacherUserId]);

  // Guardar sugerencias del docente en Supabase
  const saveTeacherSugerencias = async (section: 'aula' | 'evaluaciones' | 'otras', value: string) => {
    setIsSaving(true);
    try {
      if (!teacherUserId) {
        toast({
          title: "Error",
          description: "No estás autenticado. Por favor, inicia sesión.",
          variant: "destructive"
        });
        setIsSaving(false);
        return;
      }

      const trimmedValue = value.trim();
      const updatedSugerencias: TeacherSugerencias = {
        ...teacherSugerencias,
        [section]: trimmedValue || undefined
      };

      // Eliminar campos vacíos
      if (!updatedSugerencias.aula) delete updatedSugerencias.aula;
      if (!updatedSugerencias.evaluaciones) delete updatedSugerencias.evaluaciones;
      if (!updatedSugerencias.otras) delete updatedSugerencias.otras;

      // Verificar si el grupo existe
      const { data: existingGroup } = await supabase
        .from('grupos')
        .select('id')
        .eq('id', group.id)
        .eq('user_id', teacherUserId)
        .single();

      if (existingGroup) {
        // Actualizar grupo existente
        const { error } = await supabase
          .from('grupos')
          .update({ teacher_sugerencias: updatedSugerencias })
          .eq('id', group.id)
          .eq('user_id', teacherUserId);

        if (error) throw error;
      } else {
        // Crear nuevo grupo
        const { error } = await supabase
          .from('grupos')
          .insert({
            id: group.id,
            name: group.name,
            year: group.year,
            section: group.section,
            user_id: teacherUserId,
            teacher_sugerencias: updatedSugerencias
          });

        if (error) throw error;
      }

      setTeacherSugerencias(updatedSugerencias);
      setEditingSection(null);
      toast({
        title: "Guardado",
        description: "Las sugerencias se guardaron correctamente.",
      });
    } catch (error: any) {
      console.error('Error saving teacher_sugerencias:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron guardar las sugerencias. Intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Iniciar edición
  const startEditing = (section: 'aula' | 'evaluaciones' | 'otras') => {
    setEditValues({
      aula: teacherSugerencias?.aula || getDefaultSugerenciasAula(),
      evaluaciones: teacherSugerencias?.evaluaciones || getDefaultSugerenciasEvaluaciones(),
      otras: teacherSugerencias?.otras || ''
    });
    setEditingSection(section);
  };

  // Cancelar edición
  const cancelEditing = () => {
    setEditingSection(null);
  };

  // Guardar cambios
  const handleSave = (section: 'aula' | 'evaluaciones' | 'otras') => {
    saveTeacherSugerencias(section, editValues[section] || '');
  };

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
            ) : group.students.length === 0 ? (
              <CatalogEmptyState
                title="Sin alumnos en este grupo"
                description="No hay estudiantes asignados a este curso en el catálogo escolar. Verificá npm run seed:school-catalog o la asignación en la base de datos."
              />
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
              <p className="text-sm text-muted-foreground">
                Un estilo principal por alumno (segmento antes del guion en perfiles compuestos).
                {totalStudents === 0
                  ? " No hay estudiantes en el listado."
                  : unclassifiedLearningStyles === 0
                    ? ` Los ${totalStudents} estudiantes del listado coinciden con esta distribución.`
                    : ` ${classifiedStudents} de ${totalStudents} con estilo clasificado; ${unclassifiedLearningStyles} sin perfil reconocible en el catálogo.`}
              </p>
              {/* Estadísticas en barras */}
              <div className="space-y-4">
                {LEARNING_STYLE_LABELS.map((style) => {
                  const count = learningStyles[style];
                  return (
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
                  );
                })}
                {unclassifiedLearningStyles > 0 && (
                  <div key={UNCLASSIFIED_STYLE_LABEL} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {getStyleIcon(UNCLASSIFIED_STYLE_LABEL)}
                        <span className="font-medium text-gray-700">{UNCLASSIFIED_STYLE_LABEL}</span>
                      </div>
                      <span className="text-lg font-semibold text-gray-800">
                        {unclassifiedLearningStyles} estudiante{unclassifiedLearningStyles !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: totalStudents > 0 ? `${(unclassifiedLearningStyles / totalStudents) * 100}%` : '0%' }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className={`h-4 rounded-full ${getStyleColor(UNCLASSIFIED_STYLE_LABEL)}`}
                      />
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {totalStudents > 0 ? Math.round((unclassifiedLearningStyles / totalStudents) * 100) : 0}%
                    </div>
                  </div>
                )}
              </div>

              {/* Resumen visual */}
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-800">Resumen del grupo</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  {LEARNING_STYLE_LABELS.map((style) => {
                    const count = learningStyles[style];
                    return (
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
                    );
                  })}
                  {unclassifiedLearningStyles > 0 && (
                    <motion.div
                      key={UNCLASSIFIED_STYLE_LABEL}
                      className="bg-white p-3 rounded-lg shadow-sm"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.8, duration: 0.3 }}
                    >
                      <div className="flex justify-center mb-1">
                        {getStyleIcon(UNCLASSIFIED_STYLE_LABEL)}
                      </div>
                      <div className="text-2xl font-bold text-gray-800">{unclassifiedLearningStyles}</div>
                      <div className="text-xs text-gray-600">{UNCLASSIFIED_STYLE_LABEL}</div>
                    </motion.div>
                  )}
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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-blue-800">Sugerencias para el aula</h4>
                  {editingSection !== 'aula' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing('aula')}
                      className="h-8 px-2"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
                {editingSection === 'aula' ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editValues.aula}
                      onChange={(e) => setEditValues({ ...editValues, aula: e.target.value })}
                      className="min-h-[150px] text-sm"
                      placeholder="Escribe tus sugerencias para el aula..."
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEditing}
                        disabled={isSaving}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave('aula')}
                        disabled={isSaving}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {isSaving ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getDisplayText('aula') ? (
                      <div className="text-sm text-gray-700 whitespace-pre-line">
                        {getDisplayText('aula').split('\n').map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No hay sugerencias personalizadas. Haz clic en "Editar" para agregar sugerencias.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Sugerencias para las evaluaciones */}
              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-green-800">Sugerencias para las evaluaciones</h4>
                  {editingSection !== 'evaluaciones' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing('evaluaciones')}
                      className="h-8 px-2"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
                {editingSection === 'evaluaciones' ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editValues.evaluaciones}
                      onChange={(e) => setEditValues({ ...editValues, evaluaciones: e.target.value })}
                      className="min-h-[150px] text-sm"
                      placeholder="Escribe tus sugerencias para las evaluaciones..."
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEditing}
                        disabled={isSaving}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave('evaluaciones')}
                        disabled={isSaving}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {isSaving ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getDisplayText('evaluaciones') ? (
                      <div className="text-sm text-gray-700 whitespace-pre-line">
                        {getDisplayText('evaluaciones').split('\n').map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No hay sugerencias personalizadas. Haz clic en "Editar" para agregar sugerencias.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Otras sugerencias importantes */}
              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-400">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-purple-800">Otras sugerencias importantes</h4>
                  {editingSection !== 'otras' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing('otras')}
                      className="h-8 px-2"
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
                {editingSection === 'otras' ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editValues.otras}
                      onChange={(e) => setEditValues({ ...editValues, otras: e.target.value })}
                      className="min-h-[150px] text-sm"
                      placeholder="Escribe otras sugerencias importantes para este grupo..."
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEditing}
                        disabled={isSaving}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave('otras')}
                        disabled={isSaving}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {isSaving ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getDisplayText('otras') ? (
                      <div className="text-sm text-gray-700 whitespace-pre-line">
                        {getDisplayText('otras').split('\n').map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No hay sugerencias personalizadas. Haz clic en "Editar" para agregar sugerencias.</p>
                    )}
                  </div>
                )}
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
