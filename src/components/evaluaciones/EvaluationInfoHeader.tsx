import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';

interface EvaluationInfoHeaderProps {
  subject?: string;
  duration?: string;
  adaptations?: string[];
  selectedContent?: { nombre: string }[];
  modality?: string;
  evaluationType?: string;
}

export const EvaluationInfoHeader: React.FC<EvaluationInfoHeaderProps> = ({
  subject,
  duration = "90 minutos",
  adaptations = [],
  selectedContent = [],
  modality = "Escrito formal",
  evaluationType = "Parcial cuatrimestral"
}) => {
  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="bg-muted/30 p-4 rounded-lg">
          <h3 className="flex items-center gap-2 font-semibold text-sm text-muted-foreground mb-3">
            <Target className="h-4 w-4" />
            Información General
          </h3>
          
          {/* Tabla de información simplificada */}
          <div className="bg-card rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Materia</th>
                  <th className="text-left p-3 text-sm font-medium">Tiempo</th>
                  <th className="text-left p-3 text-sm font-medium">Modalidad</th>
                  <th className="text-left p-3 text-sm font-medium">Instancia</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 text-sm">{subject || 'Historia'}</td>
                  <td className="p-3 text-sm">{duration.replace('minutos', 'min')}</td>
                  <td className="p-3 text-sm">{modality}</td>
                  <td className="p-3 text-sm">{evaluationType}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* Contenidos seleccionados - TEXTO CORREGIDO */}
          {selectedContent.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <span className="font-medium text-sm">Contenidos seleccionados:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedContent.map((content, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {content.nombre}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};