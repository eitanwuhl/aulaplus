import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Eye, User, GraduationCap } from 'lucide-react';

interface SmartRubricProps {
  evaluationContent: string;
  criteriosLogro?: string[];
  version?: number;
}

export const SmartRubric: React.FC<SmartRubricProps> = ({
  evaluationContent,
  criteriosLogro = [],
  version = 1
}) => {
  const [viewMode, setViewMode] = useState<'student' | 'teacher'>('teacher');
  
  // Generar criterios de rúbrica basados en el contenido de la evaluación
  const generateRubricCriteria = () => {
    const criteria = [];
    
    // Criterios base según análisis del contenido
    if (evaluationContent.toLowerCase().includes('fuente') || evaluationContent.toLowerCase().includes('imagen')) {
      criteria.push({
        id: 'analisis-fuentes',
        nombre: 'Análisis de fuentes',
        excelente: 'Analiza fuentes de manera crítica, identifica perspectivas y establece conexiones históricas',
        bueno: 'Identifica información relevante en las fuentes y establece algunas conexiones',
        necesita: 'Describe básicamente el contenido de las fuentes sin análisis profundo',
        insuficiente: 'No logra extraer información relevante de las fuentes'
      });
    }
    
    if (evaluationContent.toLowerCase().includes('causa') || evaluationContent.toLowerCase().includes('consecuencia')) {
      criteria.push({
        id: 'pensamiento-causal',
        nombre: 'Pensamiento histórico causal',
        excelente: 'Identifica y explica múltiples causas y consecuencias con relaciones complejas',
        bueno: 'Reconoce causas y consecuencias principales con explicaciones claras',
        necesita: 'Identifica algunas causas o consecuencias básicas',
        insuficiente: 'No establece relaciones causales o son incorrectas'
      });
    }
    
    if (evaluationContent.toLowerCase().includes('uruguay') && evaluationContent.toLowerCase().includes('mundo')) {
      criteria.push({
        id: 'contextualizacion',
        nombre: 'Contextualización Uruguay-mundo',
        excelente: 'Establece conexiones claras entre procesos uruguayos y contexto internacional',
        bueno: 'Reconoce algunas relaciones entre Uruguay y el contexto regional/mundial',
        necesita: 'Menciona contexto internacional pero con conexiones limitadas',
        insuficiente: 'No vincula procesos uruguayos con contexto más amplio'
      });
    }
    
    if (evaluationContent.toLowerCase().includes('argumento') || evaluationContent.toLowerCase().includes('justific')) {
      criteria.push({
        id: 'argumentacion',
        nombre: 'Argumentación histórica',
        excelente: 'Construye argumentos sólidos con evidencia histórica y razonamiento lógico',
        bueno: 'Presenta argumentos claros con alguna evidencia de apoyo',
        necesita: 'Expresa ideas con argumentos básicos o poco desarrollados',
        insuficiente: 'No argumenta o presenta ideas sin sustento'
      });
    }
    
    // Criterio siempre presente: comunicación
    criteria.push({
      id: 'comunicacion',
      nombre: 'Comunicación escrita',
      excelente: 'Utiliza vocabulario específico, redacción clara y organización coherente',
      bueno: 'Se expresa con claridad usando términos apropiados',
      necesita: 'Se comunica de manera comprensible pero con limitaciones en vocabulario específico',
      insuficiente: 'Dificultades significativas en la comunicación escrita'
    });
    
    return criteria.slice(0, 4); // Máximo 4 criterios para no sobrecargar
  };
  
  const criteria = generateRubricCriteria();
  
  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'excelente':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'bueno':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'necesita':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'insuficiente':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  const getLevelPoints = (level: string) => {
    switch (level.toLowerCase()) {
      case 'excelente': return '25 pts';
      case 'bueno': return '20 pts';
      case 'necesita': return '15 pts';
      case 'insuficiente': return '10 pts';
      default: return '';
    }
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Rúbrica de Evaluación
          </CardTitle>
          
          {/* Selector de modo */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            <Button
              variant={viewMode === 'student' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('student')}
              className="h-8 px-3 text-xs"
            >
              <User className="h-3 w-3 mr-1" />
              Ver. Alumno
            </Button>
            <Button
              variant={viewMode === 'teacher' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('teacher')}
              className="h-8 px-3 text-xs"
            >
              <GraduationCap className="h-3 w-3 mr-1" />
              Ver. Docente
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-sm border-r border-border">
                  Criterio
                </th>
                <th className="text-center p-4 font-medium text-sm border-r border-border min-w-[140px]">
                  Excelente
                  {viewMode === 'teacher' && <div className="text-xs text-muted-foreground">25 pts</div>}
                </th>
                <th className="text-center p-4 font-medium text-sm border-r border-border min-w-[140px]">
                  Bueno
                  {viewMode === 'teacher' && <div className="text-xs text-muted-foreground">20 pts</div>}
                </th>
                <th className="text-center p-4 font-medium text-sm border-r border-border min-w-[140px]">
                  Necesita mejorar
                  {viewMode === 'teacher' && <div className="text-xs text-muted-foreground">15 pts</div>}
                </th>
                <th className="text-center p-4 font-medium text-sm min-w-[140px]">
                  Insuficiente
                  {viewMode === 'teacher' && <div className="text-xs text-muted-foreground">10 pts</div>}
                </th>
              </tr>
            </thead>
            
            <tbody>
              {criteria.map((criterion, index) => (
                <tr key={criterion.id} className={index % 2 === 0 ? 'bg-muted/20' : 'bg-card'}>
                  <td className="p-4 border-r border-border font-medium text-sm">
                    {criterion.nombre}
                  </td>
                  <td className={`p-3 text-xs border-r border-border ${getLevelColor('excelente')}`}>
                    {viewMode === 'student' 
                      ? "Trabajo excepcional que demuestra comprensión profunda"
                      : criterion.excelente
                    }
                  </td>
                  <td className={`p-3 text-xs border-r border-border ${getLevelColor('bueno')}`}>
                    {viewMode === 'student'
                      ? "Trabajo sólido que cumple con las expectativas"
                      : criterion.bueno
                    }
                  </td>
                  <td className={`p-3 text-xs border-r border-border ${getLevelColor('necesita')}`}>
                    {viewMode === 'student'
                      ? "Trabajo que puede mejorar con más práctica"
                      : criterion.necesita
                    }
                  </td>
                  <td className={`p-3 text-xs ${getLevelColor('insuficiente')}`}>
                    {viewMode === 'student'
                      ? "Trabajo que necesita apoyo adicional"
                      : criterion.insuficiente
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Información adicional */}
        <div className="p-4 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {viewMode === 'student' ? 'Versión para estudiantes' : 'Versión para docentes'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {viewMode === 'student' 
              ? 'Esta rúbrica simplificada te ayuda a entender qué se espera en cada nivel de desempeño.'
              : `Rúbrica generada automáticamente basada en los criterios de logro y contenido de la evaluación versión ${version}. Puntaje total: 100 puntos.`
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
};