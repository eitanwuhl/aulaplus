import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ArrowLeft, Edit2, Save, X, Plus, FileText, BookOpen, TrendingUp, Activity, AlertTriangle, Calendar, User, Trash2 } from 'lucide-react';
import { ProgressiveDisclosure } from "@/components/ui/progressive-disclosure";
import TeacherInsights from "@/components/TeacherInsights";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import EvolucionAcademica from './EvolucionAcademica';
import DashboardEvolucion from './DashboardEvolucion';
import ReporteEjecutivo from './ReporteEjecutivo';
import GeneradorTextosBoletin from './GeneradorTextosBoletin';

import NotificacionesAlumno from './NotificacionesAlumno';
import SectionOrderManager from './SectionOrderManager';
import { 
  getAllContemplaciones, 
  getContemplacionesForContext,
  normalizeContemplacionId,
  type Contemplacion 
} from '@/lib/contemplaciones/catalog';
import {
  readSelected,
  writeSelected,
  readCustom,
  writeCustom,
  toggleSelected,
  isSelected,
  addCustom,
  updateCustom,
  removeCustom,
  toggleCustomSelected,
  type CustomContemplacion,
  type ContemplacionCategoryStorage
} from '@/lib/contemplaciones/storage';
import { seedDefaultsForStudent } from '@/lib/contemplaciones/seeding';





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
      requiereAdecuacionAcceso?: boolean;
      requiereAdecuacionContenido?: boolean;
    };
  };
  onBack: () => void;
}

const StudentProfile = ({ student, onBack }: StudentProfileProps) => {
  const [isEditingComentarios, setIsEditingComentarios] = useState(false);
  const [editedComentarios, setEditedComentarios] = useState('');
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

  // State for contemplaciones - split by category
  const [selectedClase, setSelectedClase] = useState<string[]>(() => 
    readSelected(student.id, 'clase')
  );
  const [selectedEval, setSelectedEval] = useState<string[]>(() => 
    readSelected(student.id, 'evaluaciones')
  );
  const [customClase, setCustomClase] = useState<CustomContemplacion[]>(() => 
    readCustom(student.id, 'clase')
  );
  const [customEval, setCustomEval] = useState<CustomContemplacion[]>(() => 
    readCustom(student.id, 'evaluaciones')
  );

  // State for custom contemplation edit dialog
  const [editingCustom, setEditingCustom] = useState<{
    category: ContemplacionCategoryStorage;
    item: CustomContemplacion | null;
  } | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customRule, setCustomRule] = useState('');

  // Get suggested contemplaciones IDs from student.contemplaciones (legacy format)
  // These are the IDs that should show "Sugerido" badge
  const suggestedIds = new Set(student.contemplaciones || []);

  // Helper function to normalize labels for matching (trim, lowercase, remove diacritics, collapse whitespace)
  const normalizeLabel = (label: string): string => {
    return label
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/\s+/g, ' '); // Collapse whitespace
  };

  // Helper function to map legacy contemplaciones to catalog IDs
  const mapLegacyToCatalogIds = (legacyItems: string[], category: ContemplacionCategoryStorage): string[] => {
    const allContemplaciones = getAllContemplaciones();
    const catalogIds: string[] = [];

    for (const legacyItem of legacyItems) {
      const trimmed = legacyItem.trim();
      if (!trimmed) continue;

      // Try direct ID match (normalized)
      const normalizedId = normalizeContemplacionId(trimmed);
      const byId = allContemplaciones.find(c => c.id === normalizedId);
      if (byId) {
        // Check if this contemplation applies to the category
        if (byId.category === category || byId.category === 'ambas') {
          catalogIds.push(normalizedId);
        }
        continue;
      }

      // Try label match (normalized)
      const normalizedLegacy = normalizeLabel(trimmed);
      const byLabel = allContemplaciones.find(c => {
        const normalizedCatalogLabel = normalizeLabel(c.label);
        return normalizedCatalogLabel === normalizedLegacy;
      });

      if (byLabel) {
        // Check if this contemplation applies to the category
        if (byLabel.category === category || byLabel.category === 'ambas') {
          catalogIds.push(byLabel.id);
        }
      }
    }

    // Deduplicate
    return Array.from(new Set(catalogIds));
  };

  // Auto-seed deterministic suggested contemplaciones on initial load (only if no existing selection)
  // This uses the new defaults system based on student profile (with/without adecuaciones)
  useEffect(() => {
    const isDev = import.meta.env.DEV;
    
    // Seed defaults for this student (idempotent - only seeds if no existing selection)
    const seedingResults = seedDefaultsForStudent(student.id, student.name, isDev);
    
    // Update state if seeding happened
    const claseResult = seedingResults.find(r => r.category === 'clase');
    const evalResult = seedingResults.find(r => r.category === 'evaluaciones');
    
    if (claseResult?.seeded) {
      setSelectedClase(readSelected(student.id, 'clase'));
    }
    
    if (evalResult?.seeded) {
      setSelectedEval(readSelected(student.id, 'evaluaciones'));
    }
    
    // Backward compatibility: If no modern defaults exist, fall back to legacy student.contemplaciones
    if (!claseResult?.seeded && !evalResult?.seeded) {
      // Check clase
      const existingClase = readSelected(student.id, 'clase');
      if (existingClase.length === 0 && student.contemplaciones && student.contemplaciones.length > 0) {
        const suggestedClase = mapLegacyToCatalogIds(student.contemplaciones, 'clase');
        if (suggestedClase.length > 0) {
          writeSelected(student.id, 'clase', suggestedClase);
          setSelectedClase(suggestedClase);
        }
      }

      // Check evaluaciones
      const existingEval = readSelected(student.id, 'evaluaciones');
      if (existingEval.length === 0 && student.contemplaciones && student.contemplaciones.length > 0) {
        const suggestedEval = mapLegacyToCatalogIds(student.contemplaciones, 'evaluaciones');
        if (suggestedEval.length > 0) {
          writeSelected(student.id, 'evaluaciones', suggestedEval);
          setSelectedEval(suggestedEval);
        }
      }
    }
  }, [student.id, student.name, student.contemplaciones]); // Only run on mount or if student changes

  // State for adaptation flags (explicit checkboxes, no inference)
  const [requiereAdecuacionAcceso, setRequiereAdecuacionAcceso] = useState<boolean>(() => {
    const key = `adecuacionAcceso:${student.id}`;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : (student.informeTecnico?.requiereAdecuacionAcceso ?? false);
    } catch {
      return student.informeTecnico?.requiereAdecuacionAcceso ?? false;
    }
  });

  const [requiereAdecuacionContenido, setRequiereAdecuacionContenido] = useState<boolean>(() => {
    const key = `adecuacionContenido:${student.id}`;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : (student.informeTecnico?.requiereAdecuacionContenido ?? false);
    } catch {
      return student.informeTecnico?.requiereAdecuacionContenido ?? false;
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
                  // Helper function to render contemplaciones section
                  const renderContemplacionesSection = (
                    category: ContemplacionCategoryStorage,
                    title: string,
                    selected: string[],
                    setSelected: (ids: string[]) => void,
                    custom: CustomContemplacion[],
                    setCustom: (items: CustomContemplacion[]) => void
                  ) => {
                    // Get contemplaciones for this category
                    const contemplaciones = getContemplacionesForContext(
                      category === 'clase' ? 'clase' : 'evaluacion'
                    );
                    
                    const handleToggleCatalog = (contemplacionId: string) => {
                      const newSelection = toggleSelected(student.id, category, contemplacionId);
                      setSelected(newSelection);
                    };

                    const handleAddCustom = () => {
                      setEditingCustom({ category, item: null });
                      setCustomTitle('');
                      setCustomRule('');
                    };

                    const handleEditCustom = (item: CustomContemplacion) => {
                      setEditingCustom({ category, item });
                      setCustomTitle(item.title);
                      setCustomRule(item.rule);
                    };

                    const handleDeleteCustom = (customId: string) => {
                      removeCustom(student.id, category, customId);
                      setCustom(custom.filter(item => item.id !== customId));
                    };

                    const handleToggleCustom = (customId: string) => {
                      toggleCustomSelected(student.id, category, customId);
                      setCustom(custom.map(item => 
                        item.id === customId ? { ...item, selected: !item.selected } : item
                      ));
                    };

                    return (
                      <Card key={category} className="mb-6">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-blue-700">{title}</CardTitle>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={handleAddCustom}
                              className="flex items-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Agregar contemplación
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Catalog contemplaciones */}
                          <div className="space-y-2 mb-6">
                            {contemplaciones.map((contemplacion) => {
                              const isItemSelected = isSelected(student.id, category, contemplacion.id);
                              const isSuggested = suggestedIds.has(contemplacion.id) || 
                                                 suggestedIds.has(contemplacion.label);
                              
                              return (
                                <div
                                  key={contemplacion.id}
                                  className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-all ${
                                    isItemSelected ? 'bg-green-50 border-green-200' : 'bg-white hover:bg-gray-50'
                                  }`}
                                  onClick={() => handleToggleCatalog(contemplacion.id)}
                                >
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                    isItemSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
                                  }`}>
                                    {isItemSelected && (
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex-1 flex items-center gap-2">
                                    <span className={`${isItemSelected ? 'text-gray-800 font-medium' : 'text-gray-600'} select-none`}>
                                      {contemplacion.label}
                                    </span>
                                    {isSuggested && (
                                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                        Sugerido
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Custom contemplaciones */}
                          {custom.length > 0 && (
                            <div className="mt-6 pt-6 border-t">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                Contemplaciones personalizadas
                              </h4>
                              <div className="space-y-2">
                                {custom.map((item) => (
                                  <div
                                    key={item.id}
                                    className={`flex items-start gap-3 p-3 rounded border ${
                                      item.selected ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'
                                    }`}
                                  >
                                    <div
                                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${
                                        item.selected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                                      }`}
                                      onClick={() => handleToggleCustom(item.id)}
                                    >
                                      {item.selected && (
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                    <div className="flex-1 flex items-center justify-between gap-2">
                                      <span className={`${item.selected ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                                        {item.title}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditCustom(item)}
                                          className="h-8 w-8 p-0"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteCustom(item.id)}
                                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  };

                  return (
                    <Card key={section.id} className="bg-white shadow-lg mb-8">
                      <CardHeader>
                        <CardTitle className="text-blue-700">
                          Contemplaciones
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-blue-800 font-medium mb-6">
                          Selecciona las contemplaciones aplicables para este estudiante. Las marcadas con "Sugerido" fueron recomendadas por el equipo psicopedagógico.
                        </p>
                        
                        {renderContemplacionesSection(
                          'clase',
                          'Contemplaciones para la clase',
                          selectedClase,
                          setSelectedClase,
                          customClase,
                          setCustomClase
                        )}
                        
                        {renderContemplacionesSection(
                          'evaluaciones',
                          'Contemplaciones para evaluaciones',
                          selectedEval,
                          setSelectedEval,
                          customEval,
                          setCustomEval
                        )}
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

                  {/* Explicit adaptation flags - user-controlled, no inference */}
                  <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                    <h4 className="font-semibold text-gray-800 mb-3">Declaración de adecuaciones</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Marca explícitamente las adecuaciones requeridas para este estudiante. Estas opciones son controladas manualmente y no se infieren automáticamente.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`adecuacion-acceso-${student.id}`}
                          checked={requiereAdecuacionAcceso}
                          onCheckedChange={(checked) => {
                            const value = checked === true;
                            setRequiereAdecuacionAcceso(value);
                            localStorage.setItem(`adecuacionAcceso:${student.id}`, JSON.stringify(value));
                          }}
                        />
                        <Label
                          htmlFor={`adecuacion-acceso-${student.id}`}
                          className="text-sm font-medium text-gray-800 cursor-pointer"
                        >
                          Requiere adecuación de acceso
                        </Label>
                      </div>
                      <p className="text-xs text-gray-600 ml-6">
                        El estudiante requiere adaptaciones de acceso (tiempo, formato, apoyos), pero NO cambios en el contenido.
                      </p>

                      <div className="flex items-center space-x-2 mt-4">
                        <Checkbox
                          id={`adecuacion-contenido-${student.id}`}
                          checked={requiereAdecuacionContenido}
                          onCheckedChange={(checked) => {
                            const value = checked === true;
                            setRequiereAdecuacionContenido(value);
                            localStorage.setItem(`adecuacionContenido:${student.id}`, JSON.stringify(value));
                          }}
                        />
                        <Label
                          htmlFor={`adecuacion-contenido-${student.id}`}
                          className="text-sm font-medium text-gray-800 cursor-pointer"
                        >
                          Requiere adecuación de contenido
                        </Label>
                      </div>
                      <p className="text-xs text-gray-600 ml-6">
                        El estudiante tiene una adecuación curricular formalmente declarada. Esta será la única condición permitida para generar evaluaciones con adaptación de contenido (Versión 3).
                      </p>
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

      {/* Dialog for editing custom contemplaciones */}
      <Dialog 
        open={editingCustom !== null} 
        onOpenChange={(open) => {
          if (!open) {
            setEditingCustom(null);
            setCustomTitle('');
            setCustomRule('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCustom?.item ? 'Editar contemplación' : 'Nueva contemplación'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="custom-title">Título (visible)</Label>
              <Input
                id="custom-title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Ej: Permitir uso de calculadora gráfica"
              />
            </div>
            <div>
              <Label htmlFor="custom-rule">Regla (oculta, solo para lógica)</Label>
              <Textarea
                id="custom-rule"
                value={customRule}
                onChange={(e) => setCustomRule(e.target.value)}
                placeholder="Ej: Permitir calculadora gráfica en ejercicios de funciones y gráficos"
                className="min-h-20"
              />
              <p className="text-xs text-gray-500 mt-1">
                Esta regla no se muestra en la lista, solo se usa para la lógica del sistema.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingCustom(null);
                  setCustomTitle('');
                  setCustomRule('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!editingCustom) return;
                  
                  const category = editingCustom.category;
                  const currentCustom = category === 'clase' ? customClase : customEval;
                  const setCurrentCustom = category === 'clase' ? setCustomClase : setCustomEval;
                  
                  if (editingCustom.item) {
                    // Update existing
                    updateCustom(student.id, category, editingCustom.item.id, {
                      title: customTitle,
                      rule: customRule
                    });
                    const updated = currentCustom.map(item => 
                      item.id === editingCustom.item!.id 
                        ? { ...item, title: customTitle, rule: customRule }
                        : item
                    );
                    setCurrentCustom(updated);
                  } else {
                    // Add new
                    const id = addCustom(student.id, category, customTitle, customRule, true);
                    const newItem: CustomContemplacion = {
                      id,
                      title: customTitle,
                      rule: customRule,
                      selected: true
                    };
                    setCurrentCustom([...currentCustom, newItem]);
                  }
                  
                  setEditingCustom(null);
                  setCustomTitle('');
                  setCustomRule('');
                }}
                disabled={!customTitle.trim() || !customRule.trim()}
              >
                {editingCustom?.item ? 'Guardar cambios' : 'Agregar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentProfile;
