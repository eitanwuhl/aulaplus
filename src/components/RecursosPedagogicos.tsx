import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { 
  BookOpen, Heart, Download, Search, Filter, 
  Eye, Headphones, Hand, PenTool, Lightbulb,
  FileText, Video, Music, Gamepad2, Users
} from "lucide-react";

interface RecursosPedagogicosProps {
  perfilDominante: string;
  diversidadGrupo: number; // 1-4 (cantidad de estilos diferentes)
  estudiantes: number;
}

const RecursosPedagogicos = ({ perfilDominante, diversidadGrupo, estudiantes }: RecursosPedagogicosProps) => {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [filtroActual, setFiltroActual] = useState("todos");

  // Banco de recursos contextualizados por perfil
  const recursosPorPerfil = {
    Visual: [
      {
        id: "v1",
        titulo: "Mapas Mentales Interactivos",
        tipo: "Herramienta Digital",
        descripcion: "Plantillas personalizables para crear mapas mentales colaborativos",
        materias: ["Matemática", "Historia", "Biología"],
        duracion: "30-45 min",
        icon: <Eye className="w-4 h-4" />,
        recursos: ["Plantilla descargable", "Tutorial en video", "Ejemplos"]
      },
      {
        id: "v2", 
        titulo: "Infografías Educativas",
        tipo: "Material Visual",
        descripcion: "Colección de infografías para explicar conceptos complejos",
        materias: ["Biología", "Historia"],
        duracion: "20-30 min",
        icon: <FileText className="w-4 h-4" />,
        recursos: ["15 infografías", "Guía de uso", "Editor online"]
      },
      {
        id: "v3",
        titulo: "Diagramas de Flujo",
        tipo: "Organizador Gráfico",
        descripcion: "Plantillas para procesos y secuencias lógicas",
        materias: ["Matemática", "Historia"],
        duracion: "25-40 min",
        icon: <Lightbulb className="w-4 h-4" />,
        recursos: ["10 plantillas", "Guía paso a paso"]
      }
    ],
    Auditivo: [
      {
        id: "a1",
        titulo: "Debates Estructurados",
        tipo: "Actividad Oral",
        descripcion: "Formatos de debate con roles definidos y temas curriculares",
        materias: ["Historia", "Biología"],
        duracion: "45-60 min",
        icon: <Headphones className="w-4 h-4" />,
        recursos: ["Guía de roles", "Temas por materia", "Rúbrica de evaluación"]
      },
      {
        id: "a2",
        titulo: "Podcasts Educativos",
        tipo: "Audio",
        descripcion: "Biblioteca de podcasts cortos por tema curricular",
        materias: ["Historia", "Biología", "Matemática"],
        duracion: "15-20 min",
        icon: <Music className="w-4 h-4" />,
        recursos: ["50+ episodios", "Transcripciones", "Actividades de seguimiento"]
      },
      {
        id: "a3",
        titulo: "Presentaciones Orales Guiadas",
        tipo: "Actividad Oral",
        descripcion: "Estructura y rúbricas para presentaciones efectivas",
        materias: ["Historia", "Biología", "Matemática"],
        duracion: "30-45 min",
        icon: <Users className="w-4 h-4" />,
        recursos: ["Plantilla de estructura", "Tips de oratoria", "Rúbrica"]
      }
    ],
    Kinestésico: [
      {
        id: "k1",
        titulo: "Laboratorio Virtual",
        tipo: "Simulación",
        descripcion: "Experimentos virtuales interactivos para conceptos abstractos",
        materias: ["Biología", "Matemática"],
        duracion: "40-50 min",
        icon: <Hand className="w-4 h-4" />,
        recursos: ["20 simulaciones", "Guías de laboratorio", "Videos demostrativos"]
      },
      {
        id: "k2",
        titulo: "Juegos de Rol Históricos",
        tipo: "Dramatización",
        descripcion: "Actividades inmersivas para vivir eventos históricos",
        materias: ["Historia"],
        duracion: "60-90 min",
        icon: <Gamepad2 className="w-4 h-4" />,
        recursos: ["15 escenarios", "Vestuario sugerido", "Guiones"]
      },
      {
        id: "k3",
        titulo: "Manipulativos Matemáticos",
        tipo: "Material Concreto",
        descripcion: "Recursos físicos y digitales para conceptos matemáticos",
        materias: ["Matemática"],
        duracion: "35-45 min",
        icon: <Hand className="w-4 h-4" />,
        recursos: ["Plantillas imprimibles", "Instrucciones", "Variaciones"]
      }
    ],
    "Lector/escritor": [
      {
        id: "l1",
        titulo: "Diarios de Aprendizaje",
        tipo: "Escritura Reflexiva",
        descripcion: "Plantillas para reflexión y síntesis de aprendizajes",
        materias: ["Historia", "Biología", "Matemática"],
        duracion: "20-30 min",
        icon: <PenTool className="w-4 h-4" />,
        recursos: ["5 formatos", "Preguntas guía", "Ejemplos"]
      },
      {
        id: "l2",
        titulo: "Análisis de Textos Primarios",
        tipo: "Comprensión Lectora",
        descripcion: "Documentos históricos y científicos con guías de análisis",
        materias: ["Historia", "Biología"],
        duracion: "40-50 min",
        icon: <FileText className="w-4 h-4" />,
        recursos: ["30 documentos", "Guías de análisis", "Contexto histórico"]
      },
      {
        id: "l3",
        titulo: "Ensayos Argumentativos",
        tipo: "Escritura Académica",
        descripcion: "Estructura y ejemplos para ensayos por materia",
        materias: ["Historia", "Biología"],
        duracion: "60-90 min",
        icon: <PenTool className="w-4 h-4" />,
        recursos: ["Plantillas", "Ejemplos modelo", "Rúbricas"]
      }
    ]
  };

  // Recursos multimodales para grupos diversos
  const recursosMultimodales = [
    {
      id: "m1",
      titulo: "Estaciones de Aprendizaje",
      tipo: "Actividad Rotativa",
      descripcion: "4 estaciones que abordan el mismo contenido con diferentes modalidades",
      materias: ["Matemática", "Historia", "Biología"],
      duracion: "80-100 min",
      modalidades: ["Visual", "Auditivo", "Kinestésico", "Lector/escritor"],
      recursos: ["Guía completa", "Material por estación", "Cronograma"]
    },
    {
      id: "m2",
      titulo: "Proyectos Colaborativos",
      tipo: "Trabajo Grupal",
      descripcion: "Proyectos con roles específicos según perfil de aprendizaje",
      materias: ["Historia", "Biología"],
      duracion: "2-3 clases",
      modalidades: ["Todos los perfiles"],
      recursos: ["Asignación de roles", "Rúbrica grupal", "Plantillas"]
    }
  ];

  const toggleFavorito = (id: string) => {
    setFavoritos(prev => 
      prev.includes(id) 
        ? prev.filter(fav => fav !== id)
        : [...prev, id]
    );
  };

  const getRecursosRecomendados = () => {
    if (diversidadGrupo >= 3) {
      return recursosMultimodales;
    }
    return recursosPorPerfil[perfilDominante as keyof typeof recursosPorPerfil] || [];
  };

  const getStyleIcon = (style: string) => {
    switch (style) {
      case "Visual": return <Eye className="w-4 h-4 text-blue-500" />;
      case "Kinestésico": return <Hand className="w-4 h-4 text-green-500" />;
      case "Auditivo": return <Headphones className="w-4 h-4 text-purple-500" />;
      case "Lector/escritor": return <PenTool className="w-4 h-4 text-orange-500" />;
      default: return <BookOpen className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <Card className="border-2 border-purple-200">
      <CardHeader>
        <CardTitle className="text-2xl text-purple-700 flex items-center gap-2">
          📚 Recursos Pedagógicos Contextualizados
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            {getStyleIcon(perfilDominante)}
            <span>Perfil dominante: {perfilDominante}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{diversidadGrupo} estilos diferentes</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-400 mb-6">
          <p className="text-sm text-purple-700">
            Recursos sugeridos por el equipo psicopedagógico según las necesidades específicas de este grupo.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Recursos simulados como subidos por equipo psicopedagógico */}
            {[
              {
                id: "ps1",
                titulo: "Kit de Apoyo Visual - Matemática",
                tipo: "Material Psicopedagógico",
                descripcion: "Recursos visuales específicos para estudiantes con predominancia visual en contenidos matemáticos",
                subidoPor: "Lic. María Rodríguez (Psicopedagoga)",
                fecha: "Hace 2 días",
                materias: ["Matemática"],
                recursos: ["Guías visuales", "Esquemas", "Ejercicios adaptados"]
              },
              {
                id: "ps2",
                titulo: "Estrategias de Concentración",
                tipo: "Técnicas Pedagógicas",
                descripcion: "Métodos para mejorar la atención sostenida en estudiantes con perfil kinestésico",
                subidoPor: "Prof. Ana González (Equipo Psicopedagógico)",
                fecha: "Hace 4 días",
                materias: ["Todas las materias"],
                recursos: ["Manual de técnicas", "Videos explicativos", "Cronograma"]
              },
              {
                id: "ps3",
                titulo: "Adaptaciones para Evaluaciones",
                tipo: "Material de Evaluación",
                descripcion: "Formatos de evaluación adaptados según perfil de aprendizaje del grupo",
                subidoPor: "Lic. Carlos Vega (Coordinador Psicopedagógico)",
                fecha: "Hace 1 semana",
                materias: ["Historia", "Biología", "Matemática"],
                recursos: ["Plantillas", "Rúbricas adaptadas", "Ejemplos"]
              },
              {
                id: "ps4",
                titulo: "Recursos Auditivos Complementarios",
                tipo: "Material Multimodal",
                descripcion: "Podcasts y grabaciones para complementar el aprendizaje de estudiantes auditivos",
                subidoPor: "Prof. Laura Méndez (Equipo Psicopedagógico)",
                fecha: "Hace 1 semana",
                materias: ["Historia", "Biología"],
                recursos: ["15 audios temáticos", "Transcripciones", "Guías de uso"]
              }
            ].map((recurso, index) => (
              <motion.div
                key={recurso.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="hover:shadow-md transition-all duration-200 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-purple-600" />
                        <h5 className="font-semibold text-gray-800">{recurso.titulo}</h5>
                      </div>
                    </div>
                    
                    <Badge variant="secondary" className="mb-2 bg-purple-100 text-purple-800">
                      {recurso.tipo}
                    </Badge>
                    
                    <p className="text-sm text-gray-600 mb-3">{recurso.descripcion}</p>
                    
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {recurso.materias.map(materia => (
                          <Badge key={materia} variant="outline" className="text-xs">
                            {materia}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="text-xs text-purple-600 mb-2">
                        📤 Subido por: {recurso.subidoPor}
                      </div>
                      
                      <div className="text-xs text-gray-500 mb-3">
                        🕒 {recurso.fecha}
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          {recurso.recursos.length} recursos incluidos
                        </span>
                        <Button size="sm" variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                          <Download className="w-3 h-3 mr-1" />
                          Descargar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecursosPedagogicos;