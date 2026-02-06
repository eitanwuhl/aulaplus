/**
 * V2 Evaluation Renderer - Header Component
 * 
 * Displays evaluation header with title, metadata, and version info.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, FileText, Calendar } from 'lucide-react';
import { NormalizedEvaluation } from '@/services/evaluations/v2Types';

interface EvalHeaderProps {
  evaluation: NormalizedEvaluation;
  showVersionBadge?: boolean;
}

export const EvalHeader: React.FC<EvalHeaderProps> = ({ 
  evaluation, 
  showVersionBadge = true 
}) => {
  const formatDate = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleDateString('es-UY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Fecha no disponible';
    }
  };

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 pdf-no-break">
      <CardContent className="p-6">
        {/* Title row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {evaluation.subject}
            </h1>
            {evaluation.groupName && (
              <p className="text-muted-foreground mt-1">
                {evaluation.groupName}
                {evaluation.gradeLevel && ` • ${evaluation.gradeLevel}`}
              </p>
            )}
          </div>
          {showVersionBadge && (
            <Badge 
              variant="secondary" 
              className="text-sm px-3 py-1"
            >
              {evaluation.versionLabel}
            </Badge>
          )}
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Duración:</span>{' '}
              <span className="font-medium">{evaluation.totalDuration} min</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Puntos:</span>{' '}
              <span className="font-medium">{evaluation.totalPoints}</span>
            </div>
          </div>

          {evaluation.totalStudents && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">Estudiantes:</span>{' '}
                <span className="font-medium">{evaluation.totalStudents}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Generada:</span>{' '}
              <span className="font-medium">{formatDate(evaluation.generatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Available versions */}
        {evaluation.availableVersions.length > 1 && (
          <div className="mt-4 pt-4 border-t">
            <span className="text-sm text-muted-foreground mr-2">Versiones disponibles:</span>
            <div className="inline-flex gap-2">
              {evaluation.availableVersions.map((v) => (
                <Badge
                  key={v.key}
                  variant={v.key === evaluation.currentVersion ? 'default' : 'outline'}
                  className="text-xs"
                >
                  {v.key}
                  {v.isBase && ' (base)'}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EvalHeader;
