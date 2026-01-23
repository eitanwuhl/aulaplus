import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckSquare, Users, AlertTriangle } from 'lucide-react';
import { COMPETENCIAS_HISTORIA } from '@/data/competencias';
import { COMPETENCIAS_LITERATURA } from '@/data/competenciasLiteratura';
import { COMPETENCIAS_CIUDADANIA } from '@/data/competenciasCiudadania';
import { mockStudents } from '@/data/mockData';
import { enforceForEvaluation, type Student as EnforcementStudent } from '@/lib/contemplaciones/enforcement';

interface RubricItem {
  codigo: string;
  descripcion: string;
  excelente: string;
  bueno: string;
  necesitaMejorar: string;
  insuficiente: string;
}

interface StudentAssignment {
  nombre: string;
  justificacion: string;
}

interface SimplifiedSmartRubricProps {
  evaluationContent: string;
  criteriosLogro?: string[];
  version?: string;
  students?: any[];
  assignedStudents?: string[];  // Student names assigned to this version (source of truth)
  duracionMinutos?: number;
}

export const SimplifiedSmartRubric: React.FC<SimplifiedSmartRubricProps> = ({
  evaluationContent,
  criteriosLogro = [],
  version = "1",
  students = [],
  assignedStudents = [],
  duracionMinutos = 90
}) => {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // SOLO RÚBRICA GLOBAL - Derivación desde criterios ANEP seleccionados
  const generateGlobalRubric = (): RubricItem[] => {
    if (!criteriosLogro || criteriosLogro.length === 0) {
      return [];
    }

    // Combinar todos los criterios de las tres materias
    const allCriterios = [
      ...COMPETENCIAS_HISTORIA.flatMap(comp => comp.criteriosLogro.map(cl => ({ ...cl, materia: 'Historia' }))),
      ...COMPETENCIAS_LITERATURA.flatMap(comp => comp.criteriosLogro.map(cl => ({ ...cl, materia: 'Literatura' }))),
      ...COMPETENCIAS_CIUDADANIA.flatMap(comp => comp.criteriosLogro.map(cl => ({ ...cl, materia: 'Ciudadanía' })))
    ];

    const criteriosSeleccionados = allCriterios.filter(c => criteriosLogro.includes(c.id));
    
    if (criteriosSeleccionados.length === 0) {
      return [];
    }

    return criteriosSeleccionados.map(criterio => {
      // DERIVACIÓN CONTEXTUAL: Desde criterio ANEP hacia niveles específicos
      const rubricaDerivada = derivarNivelesDesdeCriterioANEP(criterio.descripcion, criterio.codigo);
      
      return {
        codigo: criterio.codigo,
        descripcion: criterio.descripcion, // Este ES el criterio ANEP textual
        ...rubricaDerivada
      };
    });
  };

  // FUNCIÓN CLAVE: Derivar niveles desde criterio ANEP real
  const derivarNivelesDesdeCriterioANEP = (criterioANEP: string, codigo: string) => {
    // Análisis inteligente del criterio para generar niveles contextualizados
    const isContrasteMapeo = criterioANEP.toLowerCase().includes('contrasta') || criterioANEP.toLowerCase().includes('fuente');
    const isArgumentacion = criterioANEP.toLowerCase().includes('argumenta') || criterioANEP.toLowerCase().includes('oralidad');
    const isIndagacion = criterioANEP.toLowerCase().includes('pregunta') || criterioANEP.toLowerCase().includes('indaga');
    
    if (isContrasteMapeo) {
      return {
        excelente: criterioANEP, // CRITERIO ANEP TEXTUAL
        bueno: `Contrasta dos fuentes; identifica similitudes/diferencias y algunas relaciones causales; contextualiza de forma general.`,
        necesitaMejorar: `Describe fuentes sin verdadero contraste; omite contexto o confunde temporalidades; vocabulario parcial.`,
        insuficiente: `No contrasta; copia fragmentos o saca conclusiones no históricas.`
      };
    }
    
    if (isArgumentacion) {
      return {
        excelente: criterioANEP, // CRITERIO ANEP TEXTUAL
        bueno: `Tesis presente; dos argumentos con evidencias parciales; algunos conectores; terminología adecuada.`,
        necesitaMejorar: `Tesis poco definida; un argumento débil; escasos conectores; terminología pobre.`,
        insuficiente: `Sin tesis ni argumentos; incoherencias; vocabulario no específico.`
      };
    }
    
    if (isIndagacion) {
      return {
        excelente: criterioANEP, // CRITERIO ANEP TEXTUAL
        bueno: `Formula 2 preguntas pertinentes pero mayormente descriptivas.`,
        necesitaMejorar: `1-2 preguntas básicas sin conexión con procesos históricos.`,
        insuficiente: `Preguntas irrelevantes o inexistentes.`
      };
    }
    
    // Derivación genérica pero contextualizada
    return {
      excelente: criterioANEP, // SIEMPRE el criterio ANEP textual
      bueno: `Logro adecuado con evidencia parcial y aplicación correcta del criterio.`,
      necesitaMejorar: `Logro fragmentario sin establecer relaciones claras; requiere apoyo docente.`,
      insuficiente: `No evidencia el logro del criterio; necesita intervención pedagógica intensiva.`
    };
  };

  // Normalize student name for comparison (handles accents, whitespace, casing)
  const normalizeStudentName = (name: string): string => {
    if (!name) return '';
    return name
      .trim()
      .replace(/\s+/g, ' ')  // Collapse multiple whitespace to single space
      .toLowerCase()
      .normalize('NFD')       // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics/accents
  };

  // ESTUDIANTES CONTEMPLADOS - Integrado en la rúbrica global
  // Uses assignedStudents as source of truth when available
  const generateStudentAssignments = (): StudentAssignment[] => {
    // If assignedStudents is provided, use it to filter students by name (with normalization)
    if (assignedStudents && assignedStudents.length > 0 && students && students.length > 0) {
      // Normalize assigned student names for comparison
      const assignedStudentNamesNormalized = new Set(
        assignedStudents.map(name => normalizeStudentName(name))
      );
      
      // Filter students by matching normalized names
      const filteredStudents = students.filter(student => {
        const studentName = student.name || `Estudiante ${student.id}`;
        const normalizedStudentName = normalizeStudentName(studentName);
        return assignedStudentNamesNormalized.has(normalizedStudentName);
      });
      
      // If assignedStudents was provided but no matches found, return empty (don't fallback)
      if (filteredStudents.length === 0) {
        return []; // Empty list - assignedStudents exists but no matches found
      }
      
      // Return matched students
      return filteredStudents.map(student => ({
        nombre: student.name || `Estudiante ${student.id}`,
        justificacion: generateContextualJustification(student, evaluationContent)
      }));
    }

    // Fallback: Only use legacy logic when assignedStudents is NOT provided (undefined/empty)
    if (!students || students.length === 0) {
      // Usar estudiantes mock si no se proporcionan
      const selectedStudents = mockStudents.slice(0, Math.min(4, mockStudents.length));
      return selectedStudents.map(student => ({
        nombre: student.name,
        justificacion: generateContextualJustification(student, evaluationContent)
      }));
    }

    // Distribución equilibrada evitando repeticiones (fallback only when assignedStudents not provided)
    const selectedStudents = students.slice(0, Math.min(4, students.length));
    return selectedStudents.map(student => ({
      nombre: student.name || `Estudiante ${student.id}`,
      justificacion: generateContextualJustification(student, evaluationContent)
    }));
  };

  // JUSTIFICACIONES CONTEXTUALES: Perfil del estudiante + concordancia con ESTA evaluación
  const generateContextualJustification = (student: any, evaluationContent: string): string => {
    const perfil = student.perfil || "Perfil mixto";
    const contemplaciones = student.contemplaciones || [];
    const alertas = student.alertas || [];
    
    // Análisis del tipo de evaluación
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

  const globalRubric = generateGlobalRubric();
  const studentAssignments = generateStudentAssignments();

  // Obtener recordatorios determinísticos usando el motor de enforcement
  const perStudentReminders = useMemo(() => {
    // Convertir estudiantes al formato esperado por el enforcement engine
    const enforcementStudents: EnforcementStudent[] = (students || []).map(s => ({
      id: s.id,
      name: s.name || `Estudiante ${s.id}`
    }));

    // Si no hay estudiantes, retornar Map vacío
    if (enforcementStudents.length === 0) {
      return new Map<string | number, string[]>();
    }

    // Obtener recordatorios usando el motor de enforcement
    const enforcementOutput = enforceForEvaluation(enforcementStudents);
    return enforcementOutput.perStudentReminders;
  }, [students]);

  const toggleExpanded = (codigo: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [codigo]: !prev[codigo]
    }));
  };

  if (globalRubric.length === 0) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Sin criterios ANEP seleccionados</h3>
          <p className="text-muted-foreground">
            Para generar la rúbrica, selecciona al menos un criterio de logro ANEP.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* RÚBRICA GLOBAL ÚNICA */}
      <div className="space-y-4">
        {globalRubric.map((rubric) => (
          <Card key={rubric.codigo} className="border shadow-sm">
            <CardHeader 
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleExpanded(rubric.codigo)}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Badge variant="secondary">{rubric.codigo}</Badge>
                    <span className="text-sm">{rubric.descripcion}</span>
                  </CardTitle>
                </div>
                <Button variant="ghost" size="sm">
                  {expandedItems[rubric.codigo] ? 'Ocultar niveles' : 'Ver niveles'}
                </Button>
              </div>
            </CardHeader>
            
            {expandedItems[rubric.codigo] && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 border-l-4 border-l-green-500 bg-green-50/50 rounded">
                    <h4 className="font-semibold text-green-800 mb-2">Excelente</h4>
                    <p className="text-sm text-green-700">{rubric.excelente}</p>
                  </div>
                  
                  <div className="p-4 border-l-4 border-l-blue-500 bg-blue-50/50 rounded">
                    <h4 className="font-semibold text-blue-800 mb-2">Bueno</h4>
                    <p className="text-sm text-blue-700">{rubric.bueno}</p>
                  </div>
                  
                  <div className="p-4 border-l-4 border-l-amber-500 bg-amber-50/50 rounded">
                    <h4 className="font-semibold text-amber-800 mb-2">Necesita mejorar</h4>
                    <p className="text-sm text-amber-700">{rubric.necesitaMejorar}</p>
                  </div>
                  
                  <div className="p-4 border-l-4 border-l-red-500 bg-red-50/50 rounded">
                    <h4 className="font-semibold text-red-800 mb-2">Insuficiente</h4>
                    <p className="text-sm text-red-700">{rubric.insuficiente}</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* ¿A QUIÉN CONTEMPLA ESTA VERSIÓN? - INTEGRADO EN RÚBRICA */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            ¿A quién contempla esta versión?
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Estudiantes considerados en esta versión de la evaluación
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {studentAssignments.length === 0 && assignedStudents && assignedStudents.length > 0 ? (
              <div className="p-4 border border-amber-200 bg-amber-50/50 rounded-lg text-center">
                <p className="text-sm text-amber-800">
                  No se encontraron estudiantes que coincidan con los nombres asignados a esta versión.
                </p>
                <p className="text-xs text-amber-700 mt-2">
                  Verifica que los nombres en el grupo coincidan con los estudiantes asignados.
                </p>
              </div>
            ) : (
              studentAssignments.map((assignment, index) => {
                // Encontrar el estudiante para obtener su ID y recordatorios
                const student = students?.find(s => {
                  const studentName = s.name || `Estudiante ${s.id}`;
                  return normalizeStudentName(studentName) === normalizeStudentName(assignment.nombre);
                });

                // Obtener recordatorios para este estudiante
                const reminders = student ? (perStudentReminders.get(student.id) || []) : [];

                return (
                  <div key={index} className="p-4 border border-border rounded-lg">
                    <h4 className="font-semibold text-foreground mb-2">{assignment.nombre}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{assignment.justificacion}</p>
                    
                    {/* Recordatorios determinísticos del motor de enforcement */}
                    {reminders.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Recordatorios para esta evaluación:
                        </div>
                        <ul className="space-y-1.5">
                          {reminders.map((reminder, reminderIndex) => (
                            <li key={reminderIndex} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{reminder}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimplifiedSmartRubric;