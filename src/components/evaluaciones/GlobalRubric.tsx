import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';

interface RubricCriterion {
  name: string;
  excellent: string;
  good: string;
  needsImprovement: string;
}

interface GlobalRubricProps {
  className?: string;
}

export const GlobalRubric: React.FC<GlobalRubricProps> = ({ className = '' }) => {
  const criteria: RubricCriterion[] = [
    {
      name: 'Uso crítico de fuentes',
      excellent: 'Analiza críticamente las fuentes, identifica sesgos y contextualiza la información',
      good: 'Utiliza las fuentes adecuadamente y extrae información relevante',
      needsImprovement: 'Presenta dificultades para interpretar o utilizar las fuentes históricas'
    },
    {
      name: 'Argumentación histórica',
      excellent: 'Desarrolla argumentos sólidos con evidencia histórica y establece relaciones causales',
      good: 'Presenta argumentos coherentes con alguna evidencia histórica',
      needsImprovement: 'Los argumentos son débiles o carecen de sustento histórico'
    },
    {
      name: 'Precisión histórica',
      excellent: 'Maneja con precisión conceptos, fechas y procesos históricos',
      good: 'Demuestra conocimiento histórico adecuado con algunos errores menores',
      needsImprovement: 'Presenta errores conceptuales o cronológicos significativos'
    },
    {
      name: 'Conexión Uruguay-mundo',
      excellent: 'Establece conexiones complejas entre procesos locales, regionales y mundiales',
      good: 'Relaciona adecuadamente Uruguay con su contexto regional y mundial',
      needsImprovement: 'Dificultades para establecer conexiones contextuales'
    },
    {
      name: 'Claridad de expresión',
      excellent: 'Se expresa con claridad, coherencia y utiliza vocabulario histórico apropiado',
      good: 'Comunicación clara con vocabulario adecuado',
      needsImprovement: 'Dificultades de expresión que afectan la comprensión'
    }
  ];

  const getScoreColor = (level: string) => {
    switch (level) {
      case 'excellent':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'good':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'needsImprovement':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return '';
    }
  };

  return (
    <Card className={`border-l-4 border-l-amber-500 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
          <Award className="h-5 w-5" />
          Rúbrica Global para Corrección
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {criteria.map((criterion, index) => (
            <div key={index} className="border border-muted-foreground/20 rounded-lg p-4">
              <h4 className="font-semibold text-base mb-3 text-foreground">
                {criterion.name}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Badge className={getScoreColor('excellent')}>
                    Excelente (90-100 pts)
                  </Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {criterion.excellent}
                  </p>
                </div>
                <div className="space-y-2">
                  <Badge className={getScoreColor('good')}>
                    Bueno (70-89 pts)
                  </Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {criterion.good}
                  </p>
                </div>
                <div className="space-y-2">
                  <Badge className={getScoreColor('needsImprovement')}>
                    Necesita mejorar (0-69 pts)
                  </Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {criterion.needsImprovement}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Instrucciones de uso:</strong> Esta rúbrica permite una corrección rápida y consistente. 
            Cada criterio se evalúa independientemente y la calificación final se obtiene promediando los puntajes obtenidos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default GlobalRubric;