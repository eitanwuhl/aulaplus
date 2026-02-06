/**
 * V2 Evaluation Renderer - Section Component
 * 
 * Renders a complete evaluation section with header, instructions, and items.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Award, Info } from 'lucide-react';
import { NormalizedSection } from '@/services/evaluations/v2Types';
import EvalItem from './EvalItem';

interface EvalSectionProps {
  section: NormalizedSection;
  showTotals?: boolean;
}

export const EvalSection: React.FC<EvalSectionProps> = ({ 
  section, 
  showTotals = true 
}) => {
  return (
    <Card className="border shadow-sm overflow-hidden pdf-no-break">
      {/* Section header - marked to avoid page break */}
      <CardHeader className="bg-muted/30 pb-3 eval-section-header">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-primary font-bold">
              Parte {section.number}:
            </span>
            <span>{section.title}</span>
          </CardTitle>
          
          {showTotals && (
            <div className="flex items-center gap-3">
              {section.duration && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>~{section.duration} min</span>
                </div>
              )}
              <Badge variant="secondary" className="flex items-center gap-1">
                <Award className="h-3 w-3" />
                <span>{section.totalPoints} puntos</span>
              </Badge>
            </div>
          )}
        </div>

        {/* Instructions */}
        {section.instructions && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {section.instructions}
            </p>
          </div>
        )}
      </CardHeader>

      {/* Items */}
      <CardContent className="p-6">
        <div className="divide-y divide-border">
          {section.items.map((item) => (
            <EvalItem key={item.id} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default EvalSection;
