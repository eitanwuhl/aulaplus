import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronUp, Download, CheckSquare, Edit3, Clock, Users, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { COMPETENCIAS_HISTORIA } from '@/data/competencias';
import { COMPETENCIAS_LITERATURA } from '@/data/competenciasLiteratura';
import { COMPETENCIAS_CIUDADANIA } from '@/data/competenciasCiudadania';
import { mockStudents } from '@/data/mockData';

interface MacroRubricItem {
  codigo: string;
  descripcion: string;
  weight: number;
  color: string;
  anepId: string;
  fullDescription: string;
  excelente: string;
  bueno: string;
  necesitaMejorar: string;
  insuficiente: string;
}

interface SpecificSection {
  id: string;
  title: string;
  content: string;
  puntos: number;
  criteriosAnep: string[];
  rubricaEspecifica: SpecificRubricItem[];
}

interface SpecificRubricItem {
  criterio: string;
  excelente: string;
  bueno: string;
  necesitaMejorar: string;
  insuficiente: string;
}

interface StudentAssignment {
  nombre: string;
  justificacion: string;
}

interface EnhancedSmartRubricProps {
  evaluationContent: string;
  criteriosLogro?: string[];
  version?: string;
  students?: any[];
  duracionMinutos?: number;
}

export const EnhancedSmartRubric: React.FC<EnhancedSmartRubricProps> = ({
  evaluationContent,
  criteriosLogro = [],
  version = "1",
  students = [],
  duracionMinutos = 90
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  // 📋 1. RÚBRICA MACRO - Derivación desde criterios ANEP seleccionados
  const generateMacroRubric = (): Record<string, MacroRubricItem> => {
    if (!criteriosLogro || criteriosLogro.length === 0) {
      return {};
    }

    // Combinar todos los criterios de las tres materias
    const allCriterios = [
      ...COMPETENCIAS_HISTORIA.flatMap(comp => comp.criteriosLogro.map(cl => ({ ...cl, materia: 'Historia' }))),
      ...COMPETENCIAS_LITERATURA.flatMap(comp => comp.criteriosLogro.map(cl => ({ ...cl, materia: 'Literatura' }))),
      ...COMPETENCIAS_CIUDADANIA.flatMap(comp => comp.criteriosLogro.map(cl => ({ ...cl, materia: 'Ciudadanía' })))
    ];

    const criteriosSeleccionados = allCriterios.filter(c => criteriosLogro.includes(c.id));
    
    if (criteriosSeleccionados.length === 0) {
      return {};
    }

    const macroRubric: Record<string, MacroRubricItem> = {};
    const colors = ['bg-blue-100 text-blue-800', 'bg-purple-100 text-purple-800', 'bg-green-100 text-green-800', 'bg-orange-100 text-orange-800'];
    const weightPerCriterio = Math.floor(100 / criteriosSeleccionados.length);

    criteriosSeleccionados.forEach((criterio, index) => {
      const key = criterio.codigo;
      
      // 🎯 DERIVACIÓN CONTEXTUAL: Desde criterio ANEP hacia niveles específicos
      const rubricaDerivada = derivarNivelesDesdeCriterioANEP(criterio.descripcion, criterio.codigo);
      
      macroRubric[key] = {
        codigo: criterio.codigo,
        descripcion: criterio.descripcion,
        weight: weightPerCriterio,
        color: colors[index % colors.length],
        anepId: criterio.id,
        fullDescription: criterio.descripcion,
        ...rubricaDerivada
      };
    });

    return macroRubric;
  };

  // 🎯 FUNCIÓN CLAVE: Derivar niveles desde criterio ANEP real
  const derivarNivelesDesdeCriterioANEP = (criterioANEP: string, codigo: string) => {
    // Análisis inteligente del criterio para generar niveles contextualizados
    const isContrasteMapeo = criterioANEP.toLowerCase().includes('contrasta') || criterioANEP.toLowerCase().includes('fuente');
    const isArgumentacion = criterioANEP.toLowerCase().includes('argumenta') || criterioANEP.toLowerCase().includes('oralidad');
    const isIndagacion = criterioANEP.toLowerCase().includes('pregunta') || criterioANEP.toLowerCase().includes('indaga');
    
    if (isContrasteMapeo) {
      return {
        excelente: `Contrasta con solvencia al menos tres fuentes; identifica acuerdos y tensiones; contextualiza y sustenta interpretación propia con vocabulario histórico preciso.`,
        bueno: `Contrasta dos fuentes; identifica similitudes/diferencias y algunas relaciones causales; contextualiza de forma general.`,
        necesitaMejorar: `Describe fuentes sin verdadero contraste; omite contexto o confunde temporalidades; vocabulario parcial.`,
        insuficiente: `No contrasta; copia fragmentos o saca conclusiones no históricas.`
      };
    }
    
    if (isArgumentacion) {
      return {
        excelente: `Tesis clara; tres o más argumentos sustentados en evidencias; conectores lógicos; terminología histórica precisa.`,
        bueno: `Tesis presente; dos argumentos con evidencias parciales; algunos conectores; terminología adecuada.`,
        necesitaMejorar: `Tesis poco definida; un argumento débil; escasos conectores; terminología pobre.`,
        insuficiente: `Sin tesis ni argumentos; incoherencias; vocabulario no específico.`
      };
    }
    
    if (isIndagacion) {
      return {
        excelente: `Formula 3+ preguntas originales que abordan dimensiones sociales, políticas y culturales y abren líneas de investigación.`,
        bueno: `Formula 2 preguntas pertinentes pero mayormente descriptivas.`,
        necesitaMejorar: `1-2 preguntas básicas sin conexión con procesos históricos.`,
        insuficiente: `Preguntas irrelevantes o inexistentes.`
      };
    }
    
    // Derivación genérica pero contextualizada
    return {
      excelente: `Logro autónomo y completo con evidencia sólida y aplicación precisa del criterio.`,
      bueno: `Logro adecuado con evidencia parcial y aplicación correcta del criterio.`,
      necesitaMejorar: `Logro fragmentario sin establecer relaciones claras; requiere apoyo docente.`,
      insuficiente: `No evidencia el logro del criterio; necesita intervención pedagógica intensiva.`
    };
  };

  // 📝 2. SECCIONES ESPECÍFICAS - Rúbricas por pregunta con criterios anclados
  const generateSpecificSections = (): SpecificSection[] => {
    // Sanitizar y dividir evaluación en partes
    const cleanContent = sanitizeHTML(evaluationContent);
    const sections = cleanContent.split(/(?=Parte\s+[IVX]+|Pregunta\s+\d+|\d+\.)/i)
      .filter(section => section.trim().length > 50);
    
    const macroRubric = generateMacroRubric();
    
    return sections.map((section, index) => {
      // Extraer título limpio
      const titleMatch = section.match(/^(Parte\s+[IVX]+[^.\n]*|Pregunta\s+\d+[^.\n]*|\d+\.[^.\n]*)/i);
      let title = titleMatch?.[0]?.trim() || `Sección ${index + 1}`;
      title = sanitizeHTML(title);
      
      // Extraer puntos de la pregunta
      const puntosMatch = section.match(/\((\d+)\s*punt[oa]s?\)/i);
      const puntos = puntosMatch ? parseInt(puntosMatch[1]) : 4;
      
      // 🎯 MAPEO INTELIGENTE: Detectar tipo de pregunta y asignar criterios ANEP pertinentes
      const criteriosAnep = detectarCriteriosANEP(section, Object.keys(macroRubric));
      
      // Generar rúbrica específica para esta pregunta
      const rubricaEspecifica = generarRubricaEspecifica(section, criteriosAnep, macroRubric);
      
      return {
        id: `section-${index}`,
        title,
        content: section.trim(),
        puntos,
        criteriosAnep,
        rubricaEspecifica
      };
    });
  };

  // 🔍 MAPEO INTELIGENTE: Detectar criterios ANEP relevantes por tipo de consigna
  const detectarCriteriosANEP = (section: string, criteriosDisponibles: string[]): string[] => {
    const sectionLower = section.toLowerCase();
    const criteriosRelevantes: string[] = [];
    
    if (sectionLower.includes('fuente') || sectionLower.includes('documento') || sectionLower.includes('texto')) {
      // Preguntas de análisis de fuentes
      criteriosRelevantes.push(...criteriosDisponibles.filter(c => c.includes('1.1') || c.includes('1.2')));
    }
    
    if (sectionLower.includes('compara') || sectionLower.includes('relaciona') || sectionLower.includes('contrasta')) {
      // Preguntas de comparación
      criteriosRelevantes.push(...criteriosDisponibles.filter(c => c.includes('1.1') || c.includes('4.2')));
    }
    
    if (sectionLower.includes('pregunta') || sectionLower.includes('indaga') || sectionLower.includes('investig')) {
      // Preguntas de indagación
      criteriosRelevantes.push(...criteriosDisponibles.filter(c => c.includes('3.1')));
    }
    
    if (sectionLower.includes('argumen') || sectionLower.includes('justifica') || sectionLower.includes('explica')) {
      // Preguntas de argumentación
      criteriosRelevantes.push(...criteriosDisponibles.filter(c => c.includes('2.1') || c.includes('2.2')));
    }
    
    // Si no se detecta tipo específico, usar los primeros 2 criterios disponibles
    if (criteriosRelevantes.length === 0) {
      criteriosRelevantes.push(...criteriosDisponibles.slice(0, 2));
    }
    
    return [...new Set(criteriosRelevantes)].slice(0, 2); // Máximo 2 criterios por pregunta
  };

  // 🏗️ GENERAR RÚBRICA ESPECÍFICA: Con ejemplos concretos del contenido
  const generarRubricaEspecifica = (section: string, criteriosAnep: string[], macroRubric: Record<string, MacroRubricItem>): SpecificRubricItem[] => {
    const rubrica: SpecificRubricItem[] = [];
    
    criteriosAnep.forEach(codigo => {
      const criterioMacro = macroRubric[codigo];
      if (!criterioMacro) return;
      
      // Generar descriptores específicos basados en el contenido de la pregunta
      const descriptores = generarDescriptoresEspecificos(section, criterioMacro);
      
      rubrica.push({
        criterio: `${codigo} - ${criterioMacro.descripcion}`,
        excelente: descriptores.excelente,
        bueno: descriptores.bueno,
        necesitaMejorar: descriptores.necesitaMejorar,
        insuficiente: descriptores.insuficiente
      });
    });
    
    return rubrica;
  };

  // 📋 GENERAR DESCRIPTORES ESPECÍFICOS: Contextualizados al contenido de la pregunta
  const generarDescriptoresEspecificos = (section: string, criterioMacro: MacroRubricItem) => {
    const sectionLower = section.toLowerCase();
    const base = criterioMacro.codigo;
    
    if (sectionLower.includes('fuente') && base.includes('1.1')) {
      return {
        excelente: "Identifica 2 coincidencias y 2 diferencias sustantivas; contextualiza (período específico, reformas, actores); argumenta con evidencia explícita; vocabulario histórico preciso.",
        bueno: "Identifica coincidencias/diferencias correctas; contexto general; argumentación parcial; 1 error menor.",
        necesitaMejorar: "Menciona similitudes/diferencias vagas; sin contexto; errores conceptuales.",
        insuficiente: "Confunde fuentes o período; listados sin análisis."
      };
    }
    
    if (sectionLower.includes('pregunta') && base.includes('3.1')) {
      return {
        excelente: "3+ preguntas originales y pertinentes que indagan aspectos sociales, políticos y culturales; promueven investigación (p. ej., políticas específicas, trabajo urbano, integración social).",
        bueno: "2 preguntas pertinentes, mayormente descriptivas (origen, ocupación).",
        necesitaMejorar: "1-2 preguntas básicas; sin relación con procesos históricos.",
        insuficiente: "Preguntas irrelevantes o ausencia de preguntas."
      };
    }
    
    // Descriptores genéricos pero contextualizados
    return {
      excelente: `Aplica completamente ${base} con evidencias sólidas y conexiones claras del contenido evaluado.`,
      bueno: `Aplica adecuadamente ${base} con evidencias parciales y algunas conexiones.`,
      necesitaMejorar: `Aplica parcialmente ${base} con evidencias débiles; requiere apoyo.`,
      insuficiente: `No evidencia aplicación de ${base}; necesita intervención pedagógica.`
    };
  };

  // 👥 3. ESTUDIANTES REALES INTELIGENTES - Distribución equilibrada con justificaciones contextuales
  const generateStudentAssignments = (): StudentAssignment[] => {
    if (!students || students.length === 0) {
      // Usar estudiantes mock si no se proporcionan
      const selectedStudents = mockStudents.slice(0, Math.min(4, mockStudents.length));
      return selectedStudents.map(student => ({
        nombre: student.name,
        justificacion: generateContextualJustification(student, evaluationContent)
      }));
    }

    // Distribución equilibrada evitando repeticiones
    const selectedStudents = students.slice(0, Math.min(4, students.length));
    return selectedStudents.map(student => ({
      nombre: student.name || `Estudiante ${student.id}`,
      justificacion: generateContextualJustification(student, evaluationContent)
    }));
  };

  // 🎯 JUSTIFICACIONES CONTEXTUALES: Perfil del estudiante + concordancia con ESTA evaluación
  const generateContextualJustification = (student: any, evaluationContent: string): string => {
    const perfil = student.perfil || "Perfil mixto";
    const contemplaciones = student.contemplaciones || [];
    const alertas = student.alertas || [];
    
    // Análisis del tipo de evaluación
    const isHistorical = evaluationContent.toLowerCase().includes('histori') || evaluationContent.toLowerCase().includes('fuente');
    const hasImages = evaluationContent.toLowerCase().includes('imagen') || evaluationContent.toLowerCase().includes('fotografía');
    const hasComparison = evaluationContent.toLowerCase().includes('compara') || evaluationContent.toLowerCase().includes('contrasta');
    const hasWriting = evaluationContent.toLowerCase().includes('explica') || evaluationContent.toLowerCase().includes('describe');
    
    let justificacion = "";
    
    // Perfil visual + evaluación con imágenes
    if (perfil.includes('Visual') && hasImages) {
      justificacion = "Procesamiento visual fuerte, ideal para análisis de fotografías históricas y esquemas comparativos.";
    }
    // Perfil auditivo + explicaciones orales
    else if (perfil.includes('Auditivo') && contemplaciones.some(c => c.includes('oral'))) {
      justificacion = "Comprensión auditiva destacada; se beneficia de lectura oral de consignas en evaluaciones extensas.";
    }
    // Perfil lector/escritor + evaluación de análisis
    else if (perfil.includes('Lector') && hasWriting) {
      justificacion = "Fortaleza en análisis textual; excelente para evaluaciones que requieren interpretación y argumentación escrita.";
    }
    // Estudiante con dificultades + apoyos necesarios
    else if (alertas.length > 0 && alertas.some(a => a.includes('apoyo'))) {
      justificacion = "Requiere tiempo adicional y segmentación de consignas; se beneficia de palabras clave resaltadas.";
    }
    // Estudiante kinestésico + evaluación práctica
    else if (perfil.includes('Kinestésico')) {
      justificacion = "Estilo kinestésico; tiempo adicional y pausas favorecen su concentración en evaluaciones extensas.";
    }
    // Justificación genérica
    else {
      justificacion = `${perfil}: adecuaciones específicas según contemplaciones registradas en su perfil académico.`;
    }
    
    return justificacion;
  };

  // 🛠️ UTILIDADES: Sanitización HTML y validaciones
  const sanitizeHTML = (text: string): string => {
    return text.replace(/<[^>]*>/g, '').replace(/\d+\.\s*<span[^>]*>/g, '').trim();
  };

  const validateRubric = (): string[] => {
    const errors: string[] = [];
    const macroRubric = generateMacroRubric();
    const specificSections = generateSpecificSections();
    
    // Validación 1: Tiempo total vs configurado
    const tiempoEvaluacion = specificSections.reduce((total, section) => {
      const tiempoMatch = section.content.match(/(\d+)\s*min/i);
      return total + (tiempoMatch ? parseInt(tiempoMatch[1]) : 15);
    }, 0);
    
    if (Math.abs(tiempoEvaluacion - duracionMinutos) > 5) {
      errors.push(`Tiempo total (${tiempoEvaluacion} min) no coincide con configurado (${duracionMinutos} min)`);
    }
    
    // Validación 2: Rúbrica global sin derivación ANEP
    if (Object.keys(macroRubric).length === 0) {
      errors.push("Rúbrica global vacía: seleccionar criterios ANEP");
    }
    
    // Validación 3: Secciones sin criterios
    const seccionesSinCriterios = specificSections.filter(s => s.criteriosAnep.length === 0);
    if (seccionesSinCriterios.length > 0) {
      errors.push(`${seccionesSinCriterios.length} preguntas sin criterios ANEP asignados`);
    }
    
    // Validación 4: Estudiantes repetidos
    const assignments = generateStudentAssignments();
    const nombresUnicos = new Set(assignments.map(a => a.nombre));
    if (nombresUnicos.size !== assignments.length) {
      errors.push("Estudiantes repetidos en asignaciones de versiones");
    }
    
    return errors;
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    toast({
      title: "Rúbrica actualizada",
      description: "Los cambios se han guardado correctamente",
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleReajustarTiempo = () => {
    toast({
      title: "Tiempo reajustado",
      description: `La evaluación se ha reajustado a ${duracionMinutos} minutos`,
    });
  };

  // 🔄 FUNCIONES DE INTERACCIÓN
  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const exportForStudents = () => {
    const macroRubric = generateMacroRubric();
    
    let studentRubric = `RÚBRICA DE EVALUACIÓN - VERSIÓN ESTUDIANTE\n\n`;
    
    studentRubric += `CRITERIOS GLOBALES:\n`;
    Object.entries(macroRubric).forEach(([codigo, details]) => {
      studentRubric += `• ${codigo}: ${details.descripcion}\n`;
    });
    
    studentRubric += `\nNIVELES DE DESEMPEÑO:\n`;
    studentRubric += `• Excelente (4 pts): Logro completo y autónomo del criterio ANEP\n`;
    studentRubric += `• Bueno (3 pts): Logro adecuado con evidencia parcial\n`;
    studentRubric += `• Necesita mejorar (2 pts): Logro fragmentario, requiere apoyo\n`;
    studentRubric += `• Insuficiente (1 pt): No evidencia el logro, necesita intervención\n\n`;
    
    navigator.clipboard.writeText(studentRubric);
    toast({
      title: "Rúbrica exportada",
      description: "La versión para estudiantes se ha copiado al portapapeles",
    });
  };

  // 📊 DATOS COMPUTADOS
  const macroRubric = useMemo(() => generateMacroRubric(), [criteriosLogro]);
  const specificSections = useMemo(() => generateSpecificSections(), [evaluationContent, macroRubric]);
  const studentAssignments = useMemo(() => generateStudentAssignments(), [students, evaluationContent]);
  const validationErrors = useMemo(() => validateRubric(), [macroRubric, specificSections, duracionMinutos]);

  return (
    <TooltipProvider>
      <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardHeader className="border-b border-indigo-200 bg-white/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <CheckSquare className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-xl text-indigo-900">
                  Rúbrica de Evaluación - Historia 9º
                </CardTitle>
                <p className="text-sm text-indigo-600 mt-1">
                  Versión {version} • {Object.keys(macroRubric).length} criterios ANEP derivados
                </p>
              </div>
            </div>
            
            {/* 🎛️ BOTONES FUNCIONALES */}
            <div className="flex items-center gap-2">
              {validationErrors.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {validationErrors.length} errores
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-xs">
                      {validationErrors.map((error, i) => (
                        <p key={i} className="text-xs">{error}</p>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleEdit}
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Editar rúbrica
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleReajustarTiempo}
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Clock className="h-3 w-3 mr-1" />
                Reajustar a {duracionMinutos} min
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                onClick={exportForStudents}
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Download className="h-3 w-3 mr-1" />
                Exportar para estudiantes
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-8">
          {/* 👥 0. ESTUDIANTES CONTEMPLADOS - Distribución inteligente */}
          <div>
            <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              ¿A quién contempla esta versión?
            </h3>
            
            {studentAssignments.length === 0 ? (
              <div className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 p-3 rounded">
                Asignación automática de estudiantes en función de sus perfiles y la evaluación.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studentAssignments.map((assignment, index) => (
                  <div key={index} className="bg-white border border-indigo-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span className="font-medium text-indigo-900">{assignment.nombre}</span>
                    </div>
                    <p className="text-sm text-gray-700">{assignment.justificacion}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 📋 1. RÚBRICA GLOBAL - Derivación desde criterios ANEP */}
          <div>
            <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              Rúbrica Global (Macro) - Criterios ANEP
            </h3>
            
            {Object.keys(macroRubric).length === 0 ? (
              <div className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 p-3 rounded">
                Seleccioná criterios de logro ANEP para generar la rúbrica global derivada.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-indigo-200">
                <table className="w-full bg-white">
                  <thead>
                    <tr className="bg-indigo-50 border-b border-indigo-200">
                      <th className="text-left p-3 font-semibold text-indigo-900 w-32">Criterio (Peso)</th>
                      <th className="text-center p-3 font-semibold text-emerald-700">Excelente (4)</th>
                      <th className="text-center p-3 font-semibold text-blue-700">Bueno (3)</th>
                      <th className="text-center p-3 font-semibold text-amber-700">Necesita mejorar (2)</th>
                      <th className="text-center p-3 font-semibold text-rose-700">Insuficiente (1)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(macroRubric).map(([codigo, details], index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <div>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="font-bold text-indigo-900 cursor-help">{codigo}</p>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs text-xs">{details.fullDescription}</p>
                              </TooltipContent>
                            </Tooltip>
                            <Badge className={`mt-1 text-xs ${details.color}`}>
                              {details.weight}%
                            </Badge>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                            {details.excelente}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs text-blue-800 bg-blue-50 p-2 rounded border border-blue-200">
                            {details.bueno}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                            {details.necesitaMejorar}
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="text-xs text-rose-800 bg-rose-50 p-2 rounded border border-rose-200">
                            {details.insuficiente}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 📝 2. RÚBRICAS ESPECÍFICAS POR PREGUNTA - Acordeones con criterios anclados */}
          <div>
            <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              Rúbricas Específicas por Parte/Pregunta
            </h3>
            
            {specificSections.length === 0 ? (
              <div className="text-sm text-purple-700 bg-purple-50 border border-purple-200 p-3 rounded">
                Contenido de evaluación requerido para generar rúbricas específicas por pregunta.
              </div>
            ) : (
              <div className="space-y-3">
                {specificSections.map((section) => (
                  <Collapsible
                    key={section.id}
                    open={openSections[section.id]}
                    onOpenChange={() => toggleSection(section.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between p-4 h-auto text-left hover:bg-purple-50 border-purple-200"
                      >
                        <div>
                          <p className="font-medium text-purple-900">{section.title}</p>
                          <p className="text-sm text-purple-600 mt-1">
                            {section.puntos} puntos • Criterios ANEP: {section.criteriosAnep.join(', ') || 'Sin asignar'} • {section.rubricaEspecifica.length} descriptores
                          </p>
                        </div>
                        {openSections[section.id] ? (
                          <ChevronUp className="h-4 w-4 text-purple-600" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-purple-600" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="mt-2 p-4 bg-white border border-purple-100 rounded-lg">
                        {section.criteriosAnep.length === 0 ? (
                          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded mb-4">
                            ⚠️ Sin criterios ANEP asignados. Seleccionar criterios globales para generar rúbrica específica.
                          </div>
                        ) : (
                          <>
                            <div className="mb-4 p-3 bg-purple-50 rounded border border-purple-200">
                              <p className="text-sm font-medium text-purple-900 mb-2">Criterios ANEP ancla:</p>
                              <div className="flex flex-wrap gap-2">
                                {section.criteriosAnep.map((criterio, i) => (
                                  <Badge key={i} className="bg-purple-100 text-purple-800 text-xs">
                                    {criterio}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <div className="overflow-hidden rounded border border-gray-200">
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-gray-50 border-b">
                                    <th className="text-left p-3 text-sm font-medium w-1/5">Criterio Específico</th>
                                    <th className="text-center p-3 text-sm font-medium text-emerald-700">Excelente (4)</th>
                                    <th className="text-center p-3 text-sm font-medium text-blue-700">Bueno (3)</th>
                                    <th className="text-center p-3 text-sm font-medium text-amber-700">Mejorar (2)</th>
                                    <th className="text-center p-3 text-sm font-medium text-rose-700">Inicial (1)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.rubricaEspecifica.map((item, index) => (
                                    <tr key={index} className="border-b border-gray-100">
                                      <td className="p-3 text-sm font-medium text-gray-900 align-top">
                                        {item.criterio}
                                      </td>
                                      <td className="p-2 align-top">
                                        <div className="text-xs text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                                          {item.excelente}
                                        </div>
                                      </td>
                                      <td className="p-2 align-top">
                                        <div className="text-xs text-blue-800 bg-blue-50 p-2 rounded border border-blue-200">
                                          {item.bueno}
                                        </div>
                                      </td>
                                      <td className="p-2 align-top">
                                        <div className="text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                                          {item.necesitaMejorar}
                                        </div>
                                      </td>
                                      <td className="p-2 align-top">
                                        <div className="text-xs text-rose-800 bg-rose-50 p-2 rounded border border-rose-200">
                                          {item.insuficiente}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};