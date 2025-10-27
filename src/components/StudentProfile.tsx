import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Save, X, Plus, FileText, BookOpen, TrendingUp, Activity, AlertTriangle, Calendar, User } from 'lucide-react';
import { ProgressiveDisclosure } from "@/components/ui/progressive-disclosure";
import TeacherInsights from "@/components/TeacherInsights";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import EvolucionAcademica from './EvolucionAcademica';
import DashboardEvolucion from './DashboardEvolucion';
import ReporteEjecutivo from './ReporteEjecutivo';
import GeneradorTextosBoletin from './GeneradorTextosBoletin';

import NotificacionesAlumno from './NotificacionesAlumno';
import SectionOrderManager from './SectionOrderManager';





interface StudentProfileProps {
  student: {
    id: number;
    name: string;
    perfil: string;
    avatar: string;
    contemplaciones: string[];
    anotaciones: string;
    seguimiento: string[];
    historialAcademico: {
      año: string;
      materias: { nombre: string; calificacion: string }[];
    }[];
    evaluacionesCualitativas: {
      fecha: string;
      evaluador: string;
      area: string;
      comentario: string;
      tipo: 'docente' | 'psicopedagogico';
    }[];
    informeTecnico?: {
      sintesis: string;
      estiloAprendizaje: string;
      objetivosPriorizados: string[];
      modalidadCursado: string;
      ajustesProgramaticos: {
        materia: string;
        ajustes: string[];
      }[];
    };
  };
  onBack: () => void;
}

const StudentProfile = ({ student, onBack }: StudentProfileProps) => {
  const [isEditingComentarios, setIsEditingComentarios] = useState(false);
  const [editedComentarios, setEditedComentarios] = useState('');
  const [contemplacionesSeleccionadas, setContemplacionesSeleccionadas] = useState<string[]>(
    (() => {
      const key = `contemplaciones:${student.id}`;
      try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : student.contemplaciones;
      } catch {
        return student.contemplaciones;
      }
    })()
  );
  const [contemplacionesNotes, setContemplacionesNotes] = useState('');
  const [isContemplacionesSubmitted, setIsContemplacionesSubmitted] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(student.anotaciones);
  const [editingQualitative, setEditingQualitative] = useState({
    comprension: false,
    resolucion: false,
    expresion: false
  });
  const [qualitativeComments, setQualitativeComments] = useState({
    comprension: "Demuestra buena comprensión de textos narrativos, pero necesita apoyo con textos expositivos.",
    resolucion: "Aplica estrategias básicas correctamente. Requiere más práctica con problemas de múltiples pasos.",
    expresion: "Excelente organización de ideas. Continuar trabajando la ortografía y puntuación."
  });

  // State for contemplaciones
  const [selectedContemplaciones, setSelectedContemplaciones] = useState<string[]>(() => {
    const key = `contemplaciones:${student.id}`;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : student.contemplaciones;
    } catch {
      return student.contemplaciones;
    }
  });

  // State for section ordering
  const [sectionOrder, setSectionOrder] = useState([
    { id: 'evaluations', title: 'Resultados de evaluaciones', icon: '📊', visible: true },
    { id: 'contemplaciones', title: 'Contemplaciones sugeridas', icon: '🎯', visible: true },
    { id: 'informe', title: 'Informe Técnico Psicopedagógico', icon: '📄', visible: true },
    { id: 'historial', title: 'Historial Académico', icon: '📚', visible: true },
    { id: 'cualitativas', title: 'Observaciones pasadas', icon: '📝', visible: true },
    { id: 'boletin', title: 'Ayuda para Generación de Boletín', icon: '📝', visible: true },
    { id: 'evolucion', title: 'Evolución académica por materia', icon: '📈', visible: true },
    
  ]);

  // Mock evaluation results data
  const evaluationResults = [
    {
      fecha: "Noviembre 2024",
      materia: "Historia",
      trimestre: "Tercer Trimestre",
      nota: 8,
      versionEvaluacion: 1,
      observacion: "Demostró un excelente manejo de los contenidos utilizando las imágenes de apoyo. Se sintió cómodo con las consignas más breves y pudo concentrarse mejor con el tiempo adicional otorgado."
    },
    {
      fecha: "Octubre 2024",
      materia: "Matemática",
      trimestre: "Tercer Trimestre", 
      nota: 7,
      versionEvaluacion: 2,
      observacion: "Se sintió cómodo expresando sus conocimientos mediante modalidad de opción múltiple, lo cual no había podido desarrollar de la manera deseada cuando se le había pedido desarrollar en otras instancias."
    },
    {
      fecha: "Septiembre 2024",
      materia: "Lengua",
      trimestre: "Segundo Trimestre",
      nota: 6,
      versionEvaluacion: 1,
      observacion: "Mostró mejoras con el uso de apoyos visuales. Aún requiere más tiempo para organizar sus ideas por escrito, pero las consignas más breves le permitieron expresarse mejor."
    }
  ];

  const contemplacionesDisponibles = [
    "Evitar consignas extensas en evaluaciones escritas",
    "Permitir evaluaciones orales en lugar de escritas", 
    "Otorgar tiempo adicional en pruebas",
    "Reducir la cantidad de ejercicios por consigna",
    "Permitir el uso de procesador de texto",
    "Evitar evaluaciones sorpresa o no anunciadas",
    "Permitir el uso de imágenes como apoyo en consignas",
    "Sentar al alumno cerca del docente o del pizarrón",
    "Evitar lecturas extensas en voz alta frente al grupo",
    "Brindar consignas escritas además de orales",
    "Proporcionar ejemplos concretos antes de las actividades",
    "Permitir descansos durante evaluaciones largas",
    "Usar lenguaje claro y directo en las instrucciones",
    "Evitar distractores visuales en el material de trabajo"
  ];

  const handleSaveNotes = () => {
    setEditingNotes(false);
    console.log("Guardando anotaciones:", notes);
  };

  const handleEditQualitative = (field: string) => {
    setEditingQualitative(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSectionOrderChange = (newOrder: typeof sectionOrder) => {
    setSectionOrder(newOrder);
    localStorage.setItem(`sectionOrder:${student.id}`, JSON.stringify(newOrder));
  };

  // Extended qualitative evaluations with more examples
  const evaluacionesCualitativasExtended = [
    ...student.evaluacionesCualitativas,
    {
      fecha: "15 Oct 2024",
      evaluador: "Prof. Ana García (Matemática)",
      area: "Matemática - Resolución de problemas",
      comentario: "Ha mejorado notablemente en la comprensión de problemas algebraicos desde que implementamos las contemplaciones visuales. Utiliza el material concreto de manera efectiva y su nivel de ansiedad durante las evaluaciones ha disminuido considerablemente.",
      tipo: 'docente' as const
    },
    {
      fecha: "8 Oct 2024",
      evaluador: "Lic. María Rodriguez (Psicopedagoga)",
      area: "Evaluación integral",
      comentario: "Se observa un progreso significativo en su autoestima académica. Las estrategias de apoyo implementadas han permitido que exprese mejor sus conocimientos. Recomiendo continuar con el enfoque multimodal y considerar la ampliación de tiempo en evaluaciones escritas.",
      tipo: 'psicopedagogico' as const
    },
    {
      fecha: "25 Sep 2024",
      evaluador: "Prof. Carlos Mendez (Historia)",
      area: "Historia - Comprensión temporal",
      comentario: "Excelente respuesta a las líneas de tiempo visuales y mapas conceptuales. Su capacidad para establecer relaciones causa-efecto ha mejorado sustancialmente. Sugiero continuar con recursos gráficos para consolidar aprendizajes complejos.",
      tipo: 'docente' as const
    },
    {
      fecha: "12 Sep 2024",
      evaluador: "Prof. Laura Vega (Lengua)",
      area: "Lengua - Expresión escrita",
      comentario: "Muestra progreso en la organización de ideas cuando utiliza esquemas previos. La implementación de borradores estructurados ha mejorado significativamente la coherencia de sus textos. Requiere continuar trabajando la revisión ortográfica con apoyo tecnológico.",
      tipo: 'docente' as const
    },
    {
      fecha: "3 Sep 2024",
      evaluador: "Prof. Roberto Silva (Ciencias)",
      area: "Ciencias Naturales - Experimentación",
      comentario: "Demuestra gran interés y habilidad en actividades prácticas de laboratorio. Su comprensión mejora notablemente cuando puede manipular materiales y observar fenómenos directamente. Recomiendo priorizar aprendizaje experimental sobre contenido teórico extenso.",
      tipo: 'docente' as const
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Button
            onClick={onBack}
            variant="ghost"
            className="mb-4 hover:bg-white/50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al grupo
          </Button>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{student.avatar}</div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Datos básicos</h1>
                <div className="text-gray-700"><span className="font-semibold">Nombre:</span> {student.name}</div>
                <Badge variant="secondary" className="text-sm mt-1">{student.perfil}</Badge>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-2"
          >
            {/* Section Order Manager */}
            <SectionOrderManager 
              sections={sectionOrder}
              onSave={handleSectionOrderChange}
            />
            {/* Render sections in user-defined order */}
            {sectionOrder.filter(section => section.visible).map((section) => {
              switch (section.id) {
                case 'evaluations':
                  return (
                    <ProgressiveDisclosure 
                      key={section.id}
                      title={`${section.icon} ${section.title}`}
                      preview="Últimas evaluaciones con observaciones detalladas"
                      className="mb-8"
                    >
              <div className="space-y-6">
                {evaluationResults.map((result, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border-l-4 border-green-400"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">
                          {result.materia} – {result.trimestre}
                        </h4>
                      </div>
                      <Badge className="bg-green-100 text-green-800 text-sm font-medium">
                        {result.fecha}
                      </Badge>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-white p-3 rounded shadow-sm">
                        <div className="text-sm text-gray-600">Nota</div>
                        <div className="text-2xl font-bold text-green-600">{result.nota}</div>
                      </div>
                      <div className="bg-white p-3 rounded shadow-sm">
                        <div className="text-sm text-gray-600">Versión de evaluación</div>
                        <div className="text-xl font-bold text-blue-600">{result.versionEvaluacion}</div>
                      </div>
                      <div className="bg-white p-3 rounded shadow-sm">
                        <div className="text-sm text-gray-600">Fecha</div>
                        <div className="text-sm font-medium text-gray-800">{result.fecha}</div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded border-l-4 border-blue-400">
                      <h5 className="font-semibold text-gray-800 mb-2">
                        Observación:
                      </h5>
                      <p className="text-gray-700 text-sm leading-relaxed italic">
                        "{result.observacion}"
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
                    </ProgressiveDisclosure>
                  );
                
                case 'contemplaciones':
                  return (
                    <Card key={section.id} className="bg-white shadow-lg mb-8">
              <CardHeader>
                <CardTitle className="text-blue-700">
                  Contemplaciones sugeridas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-800 font-medium mb-4">
                  Las contemplaciones marcadas están pre-sugeridas para este estudiante
                </p>
                <div className="grid md:grid-cols-2 gap-3 mb-6">
                  {[
                    "Lectura oral de consignas",
                    "Letra ampliada y alto contraste",
                    "Palabras clave en negrita e íconos de apoyo",
                    "Segmentación de consignas en pasos numerados",
                    "Tiempo adicional y pausas",
                    "Hoja auxiliar / borrador permitido",
                    "Calculadora / material concreto cuando corresponda",
                    "Respuesta oral alternativa (cuando corresponda)",
                    "Corrección centrada en contenido (no forma)",
                    "Monitoreo docente y andamiaje (verificación de comprensión)",
                  ].map((item, idx) => {
                    const active = selectedContemplaciones.includes(item);
                    const wasSuggested = student.contemplaciones.includes(item);
                    
                    const handleToggle = () => {
                      const newSelected = active 
                        ? selectedContemplaciones.filter(c => c !== item)
                        : [...selectedContemplaciones, item];
                      
                      setSelectedContemplaciones(newSelected);
                      localStorage.setItem(`contemplaciones:${student.id}`, JSON.stringify(newSelected));
                    };
                    
                    return (
                      <div key={idx} className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-all ${active ? 'bg-green-50 border-green-200' : 'bg-white hover:bg-gray-50'}`} onClick={handleToggle}>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${active ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                          {active && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className={`${active ? 'text-gray-800 font-medium' : 'text-gray-600'} select-none`}>
                          {item}
                          {wasSuggested && <span className="text-xs text-green-600 ml-2">(Sugerido por equipo psicopedagógico)</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Mis contemplaciones */}
                <Card className="border-2 border-purple-200 bg-purple-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-purple-700">
                      Mis contemplaciones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-purple-600 mb-3">
                      Escribe aquí las razones por las que quitaste o agregaste contemplaciones recomendadas:
                    </p>
                    <Textarea
                      value={contemplacionesNotes}
                      onChange={(e) => setContemplacionesNotes(e.target.value)}
                      placeholder="Ejemplo: Quité 'tiempo adicional' porque el alumno demostró que puede completar en tiempo normal. Agregué apoyo visual porque responde mejor a esquemas..."
                      className="w-full min-h-24 mb-4"
                    />
                    <Button 
                      onClick={() => {
                        setIsContemplacionesSubmitted(true);
                        alert('Información enviada al equipo psicopedagógico');
                      }}
                      disabled={isContemplacionesSubmitted || !contemplacionesNotes.trim()}
                      className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isContemplacionesSubmitted ? 'Enviado' : 'Enviar al equipo psicopedagógico'}
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
                    </Card>
                  );
                
                case 'informe':
                  return student.informeTecnico ? (
                    <ProgressiveDisclosure 
                      key={section.id}
                      title={`${section.icon} ${section.title}`}
                      preview="Síntesis, estilo de aprendizaje y ajustes programáticos"
                      className="mb-8"
                    >
                <div className="space-y-6">
                  <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-400">
                    <h4 className="font-semibold text-gray-800 mb-2">Síntesis de situación actual</h4>
                    <p className="text-gray-700 text-sm">{student.informeTecnico.sintesis}</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                    <h4 className="font-semibold text-gray-800 mb-2">Estilo de aprendizaje</h4>
                    <p className="text-gray-700 text-sm">{student.informeTecnico.estiloAprendizaje}</p>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                    <h4 className="font-semibold text-gray-800 mb-2">Modalidad de cursado</h4>
                    <p className="text-gray-700 text-sm">{student.informeTecnico.modalidadCursado}</p>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400">
                    <h4 className="font-semibold text-gray-800 mb-3">Ajustes programáticos por materia</h4>
                    <div className="space-y-3">
                      {student.informeTecnico.ajustesProgramaticos.map((ajuste, index) => (
                        <div key={index} className="bg-white p-3 rounded border">
                          <h5 className="font-medium text-gray-800 mb-2">{ajuste.materia}</h5>
                          <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                            {ajuste.ajustes.map((item, itemIndex) => (
                              <li key={itemIndex}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                    </ProgressiveDisclosure>
                  ) : null;
                
                case 'historial':
                  return (
                    <ProgressiveDisclosure 
                      key={section.id}
                      title={`${section.icon} ${section.title}`}
                      preview="Calificaciones por año y materia"
                      className="mb-8"
                    >
              <div className="space-y-6">
                {student.historialAcademico.map((año, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="bg-gradient-to-r from-blue-50 to-yellow-50 p-4 rounded-lg border-l-4 border-blue-400"
                  >
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">{año.año}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {año.materias.map((materia, materiaIndex) => (
                        <div key={materiaIndex} className="bg-white p-3 rounded shadow-sm">
                          <div className="text-sm font-medium text-gray-700">{materia.nombre}</div>
                          <div className="text-lg font-bold text-blue-600">{materia.calificacion}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
                    </ProgressiveDisclosure>
                  );
                
                case 'cualitativas':
                  return (
                    <ProgressiveDisclosure 
                      key={section.id}
                      title={`📝 Observaciones pasadas`}
                      preview="Historial de evaluaciones y comentarios de docentes y psicopedagogos"
                      className="mb-8"
                    >
                      <div className="space-y-4">
                        {evaluacionesCualitativasExtended.map((evaluacion, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className={`p-4 rounded-lg border-l-4 ${
                      evaluacion.tipo === 'psicopedagogico' 
                        ? 'bg-purple-50 border-purple-400' 
                        : 'bg-green-50 border-green-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">{evaluacion.fecha}</span>
                      <span className="text-sm text-gray-500">–</span>
                      <span className="text-sm font-medium text-gray-800">{evaluacion.area}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        Evaluador: {evaluacion.evaluador}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${
                          evaluacion.tipo === 'psicopedagogico' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {evaluacion.tipo === 'psicopedagogico' ? 'Psicopedagógico' : 'Docente'}
                      </Badge>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed italic">
                      "{evaluacion.comentario}"
                    </p>
                  </motion.div>
                        ))}
                      </div>
                    </ProgressiveDisclosure>
                  );
                
                case 'boletin':
                  return (
                    <ProgressiveDisclosure 
                      key={section.id}
                      title={`${section.icon} ${section.title}`}
                      preview="Genera textos automáticos basados en evolución y comentarios"
                      className="mb-8"
                    >
                      <GeneradorTextosBoletin student={student} />
                    </ProgressiveDisclosure>
                  );

                case 'evolucion':
                  return (
                    <ProgressiveDisclosure 
                      key={section.id}
                      title={`${section.icon} ${section.title}`}
                      preview="Sistema de seguimiento longitudinal y análisis de evolución"
                      className="mb-8"
                    >
                      <EvolucionAcademica student={student} />
                    </ProgressiveDisclosure>
                  );
                
                default:
                  return null;
              }
            })}
          </motion.div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Notificaciones del Alumno */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <NotificacionesAlumno student={student} />
            </motion.div>
          </div>
        </div>

        {/* Teacher Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <TeacherInsights studentId={student.id} studentName={student.name} />
        </motion.div>

        {/* Dashboard de Evolución */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8"
        >
          <DashboardEvolucion student={student} />
        </motion.div>

        {/* Botones de Acción */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 flex gap-4 justify-center"
        >
          <ReporteEjecutivo student={student} />
          <Button variant="outline" className="px-6 py-3">
            Ver historial completo
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default StudentProfile;
