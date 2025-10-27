import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Target, Brain } from 'lucide-react';

interface VersionExplanationProps {
  version: number;
  className?: string;
}

export const VersionExplanation: React.FC<VersionExplanationProps> = ({
  version,
  className = ''
}) => {
  const getVersionInfo = (v: number) => {
    switch (v) {
      case 1:
        return {
          title: '¿A quién contempla esta versión?',
          icon: <Users className="h-4 w-4" />,
          profile: 'Estudiantes con perfil estándar',
          characteristics: [
            'Comprensión lectora adecuada para el nivel',
            'Capacidad de análisis y síntesis desarrollada',
            'Autonomía en el trabajo individual',
            'Familiaridad con formatos de evaluación tradicionales'
          ],
          adaptations: [
            'Instrucciones claras y directas',
            'Tiempo estándar para la realización',
            'Variedad de tipos de ítems',
            'Criterios de evaluación explícitos'
          ]
        };
      case 2:
        return {
          title: '¿A quién contempla esta versión?',
          icon: <Target className="h-4 w-4" />,
          profile: 'Estudiantes que requieren apoyos moderados',
          characteristics: [
            'Necesitan mayor estructura en las consignas',
            'Se benefician de apoyos visuales',
            'Requieren ejemplos y modelos claros',
            'Mejor rendimiento con tiempo adicional'
          ],
          adaptations: [
            'Consignas simplificadas y estructuradas',
            'Apoyos visuales (esquemas, organizadores)',
            'Ejemplos concretos en cada ítem',
            'Tiempo extendido (25% adicional)',
            'Espacios para respuestas más amplios'
          ]
        };
      case 3:
        return {
          title: '¿A quién contempla esta versión?',
          icon: <Brain className="h-4 w-4" />,
          profile: 'Estudiantes con necesidades de apoyo significativo',
          characteristics: [
            'Dificultades de comprensión lectora',
            'Necesidades educativas especiales',
            'Requieren mediación constante',
            'Se benefician de formatos alternativos'
          ],
          adaptations: [
            'Lenguaje simplificado y concreto',
            'Apoyos visuales extensivos',
            'Opciones de respuesta oral o gráfica',
            'Acompañamiento docente durante la evaluación',
            'Fragmentación de la tarea en pasos pequeños',
            'Criterios de logro adaptados'
          ]
        };
      default:
        return null;
    }
  };

  const versionInfo = getVersionInfo(version);

  if (!versionInfo) return null;

  return (
    <Card className={`border-l-4 border-l-purple-500 bg-purple-50/30 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-purple-700">
          {versionInfo.icon}
          {versionInfo.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-purple-800 mb-2">Perfil de estudiantes:</h4>
          <p className="text-sm text-purple-700 mb-2">{versionInfo.profile}</p>
          <ul className="space-y-1">
            {versionInfo.characteristics.map((char, index) => (
              <li key={index} className="text-xs text-purple-600 flex items-start gap-2">
                <span className="text-purple-500 mt-1">•</span>
                <span>{char}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold text-purple-800 mb-2">Adaptaciones aplicadas:</h4>
          <ul className="space-y-1">
            {versionInfo.adaptations.map((adaptation, index) => (
              <li key={index} className="text-xs text-purple-600 flex items-start gap-2">
                <span className="text-purple-500 mt-1">✓</span>
                <span>{adaptation}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default VersionExplanation;