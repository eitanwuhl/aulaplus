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
  
  // TASK 1: Extract from JSON wrapper if present BEFORE cleaning
  const extractFromWrapper = (text: string): string => {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.includes('"versions"') || trimmed.includes("'versions'")) {
      try {
        let parsed: any;
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          // Try normalizing single quotes
          const normalized = trimmed.replace(/'/g, '"').replace(/(\w+):/g, '"$1":');
          try {
            parsed = JSON.parse(normalized);
          } catch (e2) {
            return text; // Cannot parse, return original
          }
        }
        // Extract A (default for this component)
        const extracted = parsed.versions?.A || parsed.A || parsed.evaluationBundle?.versions?.A;
        if (extracted && typeof extracted === 'string') {
          // Recurse if still a wrapper
          if (extracted.trim().startsWith('{') || extracted.includes('"versions"')) {
            return extractFromWrapper(extracted);
          }
          return extracted;
        }
      } catch (e) {
        // Fall through to original
      }
    }
    return text;
  };
  
  // Extract from wrapper first
  const extractedContent = extractFromWrapper(evaluation.content);
  
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