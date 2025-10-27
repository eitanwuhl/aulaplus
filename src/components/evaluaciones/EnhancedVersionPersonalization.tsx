import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, User, Clock, BookOpen, Brain, Eye } from 'lucide-react';
import { mockStudents } from '@/data/mockData';

interface Student {
  id: number;
  name: string;
  contemplaciones: string[];
  informeTecnico?: {
    modalidadCursado: string;
    diagnostico?: string;
    fortalezas?: string[];
    necesidades?: string[];
  };
  perfilAcademico?: {
    estiloAprendizaje: string;
    ritmoTrabajo: string;
    fortalezas: string[];
  };
}

interface EnhancedVersionPersonalizationProps {
  version: number;
  students?: Student[];
  evaluationContent?: string;
}

export const EnhancedVersionPersonalization: React.FC<EnhancedVersionPersonalizationProps> = ({
  version,
  students = [],
  evaluationContent = ''
}) => {
  
  // ✅ Función inteligente para asignar estudiantes REALES del grupo
  const getAssignedStudents = () => {
    // Usar mockStudents reales en lugar de estudiantes de ejemplo
    const realStudents = students && students.length > 0 ? students : mockStudents;
    const assignedStudents = [];
    
    switch (version) {
      case 1: {
        // Versión estándar - estudiantes con pocas contemplaciones
        const candidates = realStudents.filter(s => {
          const contemplacionesCount = s.contemplaciones?.length || 0;
          const tieneAdecuacionesSignificativas = s.informeTecnico?.modalidadCursado?.toLowerCase().includes('significativas');
          return contemplacionesCount <= 2 && !tieneAdecuacionesSignificativas;
        });
        
        for (const student of candidates.slice(0, Math.max(1, Math.floor(realStudents.length * 0.4)))) {
          assignedStudents.push({
            name: student.name,
            justification: generateIntelligentJustification(student, version, evaluationContent),
            adaptaciones: getAdaptacionesVersion1(student),
            perfil: getPerfilResumen(student)
          });
        }
        break;
      }
      
      case 2: {
        // Versión con apoyos moderados - perfil mixto
        const candidates = realStudents.filter(s => {
          const contemplacionesCount = s.contemplaciones?.length || 0;
          const tieneApoyos = s.informeTecnico?.modalidadCursado?.toLowerCase().includes('apoyo');
          return (contemplacionesCount >= 2 && contemplacionesCount <= 4) || tieneApoyos;
        });
        
        for (const student of candidates.slice(0, Math.max(1, Math.floor(realStudents.length * 0.4)))) {
          assignedStudents.push({
            name: student.name,
            justification: generateIntelligentJustification(student, version, evaluationContent),
            adaptaciones: getAdaptacionesVersion2(student),
            perfil: getPerfilResumen(student)
          });
        }
        break;
      }
      
      case 3: {
        // Versión altamente adaptada - necesidades específicas
        const candidates = realStudents.filter(s => {
          const contemplacionesCount = s.contemplaciones?.length || 0;
          const tieneAdecuacionesSignificativas = s.informeTecnico?.modalidadCursado?.toLowerCase().includes('significativas');
        const tieneDiscapacidad = s.informeTecnico?.modalidadCursado?.toLowerCase().includes('adecuaciones') ||
                                 s.contemplaciones?.some(c => c.toLowerCase().includes('discapacidad'));
          return contemplacionesCount >= 4 || tieneAdecuacionesSignificativas || tieneDiscapacidad;
        });
        
        for (const student of candidates.slice(0, Math.max(1, Math.floor(realStudents.length * 0.2)))) {
          assignedStudents.push({
            name: student.name,
            justification: generateIntelligentJustification(student, version, evaluationContent),
            adaptaciones: getAdaptacionesVersion3(student),
            perfil: getPerfilResumen(student)
          });
        }
        break;
      }
    }
    
    // Si no hay candidatos adecuados, tomar algunos estudiantes representativos
    if (assignedStudents.length === 0) {
      const fallbackStudent = realStudents[version - 1] || realStudents[0];
      if (fallbackStudent) {
        assignedStudents.push({
          name: fallbackStudent.name,
          justification: generateIntelligentJustification(fallbackStudent, version, evaluationContent),
          adaptaciones: version === 1 ? getAdaptacionesVersion1(fallbackStudent) : 
                        version === 2 ? getAdaptacionesVersion2(fallbackStudent) : 
                        getAdaptacionesVersion3(fallbackStudent),
          perfil: getPerfilResumen(fallbackStudent)
        });
      }
    }
    
    return assignedStudents;
  };

  // ✅ Justificación inteligente basada en el perfil REAL del estudiante + contenido específico
  const generateIntelligentJustification = (student: any, version: number, evaluationContent: string) => {
    const adaptations = student.contemplaciones || [];
    const techReport = student.informeTecnico;
    const profile = student.perfilAcademico;
    
    // 🟣 Analizar el contenido específico de la evaluación para justificaciones relevantes
    const hasSourceAnalysis = evaluationContent.toLowerCase().includes('fuente') || evaluationContent.toLowerCase().includes('documento');
    const hasWrittenResponse = evaluationContent.toLowerCase().includes('explica') || evaluationContent.toLowerCase().includes('desarrolla');
    const hasTimeLimit = evaluationContent.includes('90 minutos') || evaluationContent.includes('tiempo');
    const requiresReading = evaluationContent.toLowerCase().includes('lee') || evaluationContent.toLowerCase().includes('texto');
    
    let justification = `${student.name}: `;
    
    if (version === 1) {
      // Versión estándar - enfocar en fortalezas que aplican a ESTA evaluación
      const relevantStrengths = [];
      if (hasSourceAnalysis && (profile?.fortalezas?.includes('análisis') || String(profile?.estiloAprendizaje).includes('analítico'))) {
        relevantStrengths.push('capacidad de análisis de fuentes históricas');
      }
      if (hasWrittenResponse && (profile?.fortalezas?.includes('redacción') || profile?.fortalezas?.includes('expresión'))) {
        relevantStrengths.push('habilidades de expresión escrita');
      }
      if (requiresReading && profile?.fortalezas?.includes('comprensión lectora')) {
        relevantStrengths.push('buena comprensión lectora');
      }
      
      if (relevantStrengths.length > 0) {
        justification += `Puede trabajar con la versión estándar gracias a su ${relevantStrengths.join(' y ')}.`;
      } else {
        justification += `Trabaja de manera autónoma y puede enfrentar el formato completo de la evaluación.`;
      }
      
    } else if (version === 2) {
      // Versión con apoyo moderado - identificar qué aspectos de ESTA evaluación necesitan apoyo
      const relevantNeeds = [];
      if (hasTimeLimit && adaptations.some(a => a.includes('tiempo'))) {
        relevantNeeds.push('necesita tiempo adicional para completar las tareas');
      }
      if (hasSourceAnalysis && adaptations.some(a => a.includes('lectura') || a.includes('comprensión'))) {
        relevantNeeds.push('requiere apoyo para el análisis de documentos');
      }
      if (hasWrittenResponse && adaptations.some(a => a.includes('escritura') || a.includes('redacción'))) {
        relevantNeeds.push('necesita apoyo en la estructuración de respuestas escritas');
      }
      
      if (relevantNeeds.length > 0) {
        justification += `Versión con apoyo moderado porque ${relevantNeeds.join(' y ')}.`;
      } else {
        justification += `Requiere apoyo moderado para optimizar su desempeño en esta evaluación.`;
      }
      
    } else {
      // Versión altamente adaptada - enfocar en adaptaciones específicas para ESTA evaluación
      const majorAdaptations = [];
      if (techReport?.diagnostico && (techReport.diagnostico.includes('discapacidad') || techReport.diagnostico.includes('trastorno'))) {
        majorAdaptations.push('diagnóstico que requiere adaptaciones curriculares');
      }
      if (hasSourceAnalysis && adaptations.some(a => a.includes('apoyo lector'))) {
        majorAdaptations.push('necesita apoyo lector para el análisis de fuentes');
      }
      if (hasWrittenResponse && adaptations.some(a => a.includes('comunicación alternativa'))) {
        majorAdaptations.push('utiliza formas alternativas de comunicación');
      }
      
      if (majorAdaptations.length > 0) {
        justification += `Versión altamente adaptada debido a ${majorAdaptations.join(' y ')}.`;
      } else {
        justification += `Requiere adaptaciones significativas para acceder al contenido de esta evaluación.`;
      }
    }
    
    return justification;
  };

  const getAdaptacionesVersion1 = (student: Student) => {
    return ['Formato estándar', 'Instrucciones originales', 'Tiempo regular'];
  };

  const getAdaptacionesVersion2 = (student: Student) => {
    const adaptaciones = ['Instrucciones simplificadas'];
    if (student.contemplaciones.includes('Tiempo adicional')) adaptaciones.push('Tiempo extendido (+30 min)');
    if (student.contemplaciones.includes('Apoyo visual')) adaptaciones.push('Recursos visuales adicionales');
    adaptaciones.push('Ejemplos guía incluidos');
    return adaptaciones;
  };

  const getAdaptacionesVersion3 = (student: Student) => {
    const adaptaciones = ['Contenidos esenciales priorizados', 'Vocabulario simplificado'];
    if (student.informeTecnico?.modalidadCursado?.includes('significativas')) {
      adaptaciones.push('Adecuaciones curriculares significativas');
    }
    adaptaciones.push('Apoyos visuales extensivos', 'Tiempo flexible', 'Opciones de respuesta múltiple');
    return adaptaciones;
  };

  const getPerfilResumen = (student: any) => {
    const perfil = [];
    
    // Usar datos reales del mockStudents
    if (student.perfil) {
      perfil.push(student.perfil);
    }
    
    if (student.informeTecnico?.estiloAprendizaje) {
      perfil.push(student.informeTecnico.estiloAprendizaje.split(':')[0]);
    }
    
    if (student.promedio) {
      const nivel = student.promedio >= 8.5 ? 'Alto rendimiento' : 
                   student.promedio >= 7.5 ? 'Buen rendimiento' : 'Apoyo requerido';
      perfil.push(nivel);
    }
    
    if (student.informeTecnico?.modalidadCursado && !student.informeTecnico.modalidadCursado.includes('Común')) {
      perfil.push('Necesidades específicas');
    }
    
    return perfil.length > 0 ? perfil.slice(0, 3) : ['Perfil estándar'];
  };

  const getExampleStudents = () => {
    switch (version) {
      case 1:
        return [
          {
            name: "Ana Martínez",
            justification: "Perfil académico estándar con buen manejo de contenidos históricos. Su estilo de aprendizaje visual se alinea con las fuentes incluidas en la evaluación.",
            adaptaciones: ['Formato estándar', 'Instrucciones originales', 'Tiempo regular (90 min)'],
            perfil: ['Visual', 'Ritmo estándar', 'Análisis de fuentes']
          },
          {
            name: "Diego Silva",
            justification: "Estudiante con desempeño consistente que se beneficia del formato tradicional. Sus fortalezas en argumentación histórica se potencian en esta versión.",
            adaptaciones: ['Formato estándar', 'Instrucciones originales', 'Tiempo regular (90 min)'],
            perfil: ['Analítico', 'Ritmo estándar', 'Argumentación']
          }
        ];
      case 2:
        return [
          {
            name: "Sofía López",
            justification: "Requiere tiempo extendido y apoyo visual según su perfil de necesidades. Sus fortalezas en comprensión lectora se potencian con instrucciones simplificadas.",
            adaptaciones: ['Instrucciones simplificadas', 'Tiempo extendido (+30 min)', 'Recursos visuales adicionales', 'Ejemplos guía'],
            perfil: ['Kinestésico', 'Ritmo pausado', 'Comprensión lectora']
          },
          {
            name: "Mateo Fernández",
            justification: "Necesita apoyos pedagógicos moderados con organizadores gráficos. Su estilo de aprendizaje auditivo se beneficia de consignas claras y estructuradas.",
            adaptaciones: ['Instrucciones simplificadas', 'Organizadores gráficos', 'Apoyo visual', 'Tiempo extendido'],
            perfil: ['Auditivo', 'Ritmo variable', 'Organización']
          }
        ];
      case 3:
        return [
          {
            name: "Valentina Castro",
            justification: "Requiere adecuaciones curriculares significativas con contenidos esenciales priorizados. Sus necesidades de apoyo extensivo se atienden con vocabulario simplificado y apoyos visuales.",
            adaptaciones: ['Contenidos esenciales', 'Vocabulario simplificado', 'Adecuaciones significativas', 'Apoyos visuales extensivos'],
            perfil: ['Multisensorial', 'Ritmo lento', 'Apoyo constante']
          },
          {
            name: "Joaquín Méndez",
            justification: "Necesita máximo apoyo pedagógico con opciones de respuesta flexibles. Su perfil requiere tiempo ilimitado y adaptaciones curriculares para garantizar accesibilidad.",
            adaptaciones: ['Contenidos esenciales', 'Tiempo flexible', 'Opciones múltiples', 'Apoyo individualizado'],
            perfil: ['Concreto', 'Ritmo muy pausado', 'Necesidades específicas']
          }
        ];
      default:
        return [];
    }
  };

  const assignedStudents = getAssignedStudents();
  
  const getVersionColor = (v: number) => {
    switch (v) {
      case 1: return "bg-emerald-50 border-emerald-300 text-emerald-900";
      case 2: return "bg-blue-50 border-blue-300 text-blue-900";
      case 3: return "bg-amber-50 border-amber-300 text-amber-900";
      default: return "bg-muted border-border text-foreground";
    }
  };

  const getVersionTitle = (v: number) => {
    switch (v) {
      case 1: return "Versión Estándar";
      case 2: return "Versión con Apoyos Moderados";
      case 3: return "Versión Altamente Adaptada";
      default: return `Versión ${v}`;
    }
  };

  const getVersionDescription = (v: number) => {
    switch (v) {
      case 1: return "Formato tradicional para estudiantes sin adaptaciones específicas";
      case 2: return "Incluye apoyos pedagógicos moderados y tiempo extendido";
      case 3: return "Máximo nivel de adaptaciones curriculares y apoyos extensivos";
      default: return "";
    }
  };

  const getVersionIcon = (v: number) => {
    switch (v) {
      case 1: return <BookOpen className="h-5 w-5" />;
      case 2: return <Clock className="h-5 w-5" />;
      case 3: return <Brain className="h-5 w-5" />;
      default: return <Eye className="h-5 w-5" />;
    }
  };

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Users className="h-6 w-6 text-primary" />
          ¿A quién contempla esta versión?
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className={`p-6 rounded-xl border-2 ${getVersionColor(version)}`}>
          <div className="flex items-center gap-3 mb-4">
            {getVersionIcon(version)}
            <div>
              <Badge variant="outline" className="font-semibold text-base px-3 py-1">
                {getVersionTitle(version)}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {getVersionDescription(version)}
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            {assignedStudents.map((student, index) => (
              <div key={index} className="bg-card rounded-lg border-2 border-border p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <h4 className="font-semibold text-lg text-foreground">
                        {student.name}
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                        {student.justification}
                      </p>
                    </div>
                    
                    {/* Perfil del estudiante */}
                    <div className="flex flex-wrap gap-2">
                      {student.perfil.map((item, pIndex) => (
                        <Badge key={pIndex} variant="secondary" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                    
                    {/* Adaptaciones específicas */}
                    <div>
                      <h5 className="font-medium text-sm text-foreground mb-2">
                        Adaptaciones aplicadas:
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {student.adaptaciones.map((adaptacion, aIndex) => (
                          <div key={aIndex} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></div>
                            <span>{adaptacion}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {assignedStudents.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">
                No hay estudiantes asignados a esta versión
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Los estudiantes se asignan automáticamente según su perfil y necesidades
              </p>
            </div>
          )}
        </div>
        
        {/* Información adicional sobre la versión */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Información de la versión</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Esta versión se generó considerando las contemplaciones, informes técnicos y perfiles académicos 
            de los estudiantes asignados. Las adaptaciones se basan en las necesidades específicas identificadas 
            en sus expedientes pedagógicos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};