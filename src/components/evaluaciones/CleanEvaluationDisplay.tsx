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
    versionLabel?: string;
    versionKind?: string;
  };
}

export const CleanEvaluationDisplay: React.FC<CleanEvaluationDisplayProps> = ({
  evaluation
}) => {
  // GUARDRAIL: This component displays ONLY the student-facing evaluation content.
  // It MUST NEVER import or use enforceForEvaluation() or inject reminders.
  // Reminders belong ONLY in SimplifiedSmartRubric student cards, never in evaluation content.
  
  // STEP 3: CleanEvaluationDisplay should receive already-extracted HTML only
  // If content is a wrapper, show error instead of extracting (extraction should happen upstream)
  const trimmed = evaluation.content.trim();
  const firstLt = trimmed.indexOf('<');
  const versionsIdx = trimmed.indexOf('"versions"');
  const wrapperDetected = trimmed.startsWith('{') || (versionsIdx >= 0 && (firstLt === -1 || versionsIdx < firstLt));
  if (wrapperDetected) {
    // Content is a wrapper - this should not happen if extraction is done correctly upstream
    console.warn('[CleanEvaluationDisplay] Received wrapper content, expected extracted HTML', {
      contentPreview: trimmed.slice(0, 50)
    });
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <strong>Error:</strong> Contenido no válido (wrapper JSON detectado).
        <div className="mt-2 text-xs font-mono whitespace-pre-wrap">
          {trimmed.slice(0, 120)}
        </div>
      </div>
    );
  }
  
  // Use content directly (should already be extracted HTML)
  const extractedContent = evaluation.content;
  
  // Limpiar contenido para mostrar solo la evaluación pura
  const { pureContent } = ContentCleaner.extractPureEvaluation(extractedContent);
  
  const getVersionBadgeColor = (version: number) => {
    switch (version) {
      case 1: return 'default';
      case 2: return 'secondary';
      case 3: return 'outline';
      default: return 'default';
    }
  };

  const getVersionLabel = () => {
    if (evaluation.versionLabel) return evaluation.versionLabel;
    if (evaluation.versionKind) return `Versión ${evaluation.versionKind}`;
    return `Versión ${evaluation.version}`;
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
            {getVersionLabel()}
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