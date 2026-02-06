/**
 * V2 Evaluation Renderer - Response Options Component
 * 
 * Displays equivalent response options for items that have them.
 * Allows students to choose their preferred format.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, PenTool } from 'lucide-react';
import { NormalizedItem } from '@/services/evaluations/v2Types';

interface ResponseOptionsProps {
  options: NonNullable<NormalizedItem['responseOptions']>;
}

export const ResponseOptions: React.FC<ResponseOptionsProps> = ({ options }) => {
  if (!options.enabled || options.options.length === 0) {
    return null;
  }

  return (
    <Card className="mt-3 border-dashed border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-2 mb-3">
          <PenTool className="h-4 w-4 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-medium text-primary">
              Opciones de respuesta equivalentes
            </p>
            <p className="text-xs text-muted-foreground">
              Elegí el formato que mejor se adapte a tu forma de aprender
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          {options.options.map((opt, index) => (
            <div 
              key={opt.id || index}
              className="flex items-start gap-3 p-2 rounded-md bg-background border"
            >
              <Badge variant="outline" className="shrink-0 mt-0.5">
                Opción {String.fromCharCode(65 + index)}
              </Badge>
              <div className="text-sm">
                {opt.format && (
                  <span className="font-medium">{opt.format}</span>
                )}
                {opt.format && opt.description && ': '}
                {opt.description && (
                  <span className="text-muted-foreground">{opt.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {options.metacognitionText && (
          <div className="mt-3 flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {options.metacognitionText}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResponseOptions;
