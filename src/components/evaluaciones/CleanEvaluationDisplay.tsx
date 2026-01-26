import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';
import { ContentCleaner } from '@/lib/contentCleaner';
import { HTMLRenderer } from './HTMLRenderer';

interface CleanEvaluationDisplayProps {
  evaluation: {
    id: string;
    title: string;
    content: string;
    version: number;
  };
}

export const CleanEvaluationDisplay: React.FC<CleanEvaluationDisplayProps> = ({
  evaluation
}) => {
  // GUARDRAIL: This component displays ONLY the student-facing evaluation content.
  // It MUST NEVER import or use enforceForEvaluation() or inject reminders.
  // Reminders belong ONLY in SimplifiedSmartRubric student cards, never in evaluation content.
  
  // Limpiar contenido para mostrar solo la evaluación pura
  const { pureContent } = ContentCleaner.extractPureEvaluation(evaluation.content);
  
  const getVersionBadgeColor = (version: number) => {
    switch (version) {
      case 1: return 'default';
      case 2: return 'secondary';
      case 3: return 'outline';
      default: return 'default';
    }
  };


  return (
    <Card className="border border-border shadow-sm print:shadow-none print:border-gray-300">
      <CardHeader className="border-b bg-muted/30 print:bg-gray-50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-xl print:text-lg">
            <BookOpen className="h-5 w-5 text-primary print:h-4 print:w-4" />
            {evaluation.title}
          </CardTitle>
          <Badge variant={getVersionBadgeColor(evaluation.version)} className="text-xs print:text-xs">
            Versión {evaluation.version}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 print:p-4">
        {/* EVALUACIÓN PRINCIPAL - Solo contenido puro */}
        <div className="bg-card border rounded-lg p-6 shadow-sm print:shadow-none print:border-gray-300 print:p-4">
          <HTMLRenderer content={pureContent} className="max-w-none" />
        </div>
      </CardContent>
    </Card>
  );
};