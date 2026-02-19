/**
 * TimeBudgetingSection
 * 
 * Component for setting target evaluation duration and displaying estimated vs actual time
 * PHASE 6: Time Budgeting + AI Design Report
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TimeBudgetingSectionProps {
  targetMinutes: number;
  onTargetChange: (minutes: number) => void;
  estimatedMinutes: number | null;
  timeBreakdown: {
    sections: Array<{
      itemType: string;
      estimatedMinutes: number;
      description: string;
    }>;
    heuristicAssumptions: string;
  } | null;
  disabled?: boolean;
}

export function TimeBudgetingSection({
  targetMinutes,
  onTargetChange,
  estimatedMinutes,
  timeBreakdown,
  disabled = false
}: TimeBudgetingSectionProps) {
  
  const handleMinutesChange = (value: string) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 300) {  // Max 5 hours (300 min)
      onTargetChange(parsed);
    }
  };
  
  // Calculate time fit status
  const timeFitStatus = estimatedMinutes && targetMinutes
    ? estimatedMinutes <= targetMinutes * 1.10  // 10% tolerance
      ? 'fit'
      : 'exceed'
    : null;
  
  const exceededPercentage = estimatedMinutes && targetMinutes && timeFitStatus === 'exceed'
    ? Math.round(((estimatedMinutes - targetMinutes) / targetMinutes) * 100)
    : null;
  
  return (
    <Card className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Duración de la evaluación
        </CardTitle>
        <CardDescription>
          Define la duración objetivo de la evaluación. La IA ajustará el contenido para que se ajuste al tiempo disponible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Target duration input */}
        <div className="space-y-2">
          <Label htmlFor="target-duration">Duración objetivo (minutos)</Label>
          <div className="flex items-center gap-4">
            <Input
              id="target-duration"
              type="number"
              min="10"
              max="300"
              step="5"
              value={targetMinutes}
              onChange={(e) => handleMinutesChange(e.target.value)}
              disabled={disabled}
              className="w-32 bg-white"
            />
            <span className="text-sm text-muted-foreground">
              {targetMinutes} minutos ≈ {Math.floor(targetMinutes / 60)}h {targetMinutes % 60}min
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Valores comunes: 40 min (1 módulo), 80 min (2 módulos), 120 min (3 módulos)
          </p>
        </div>
        
        {/* Estimated vs Target comparison */}
        {estimatedMinutes !== null && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Comparación de tiempos:</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    <strong>Objetivo:</strong> {targetMinutes} min
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-sm">
                    <strong>Estimado:</strong> {estimatedMinutes} min
                  </span>
                </div>
              </div>
              
              {timeFitStatus === 'fit' ? (
                <Badge variant="outline" className="bg-green-50 border-green-500 text-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Se ajusta
                </Badge>
              ) : timeFitStatus === 'exceed' ? (
                <Badge variant="outline" className="bg-red-50 border-red-500 text-red-700">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Excede +{exceededPercentage}%
                </Badge>
              ) : null}
            </div>
            
            {/* Alert if time budget exceeded */}
            {timeFitStatus === 'exceed' && (
              <Alert className="mt-3 border-amber-500 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-900">
                  <strong>Ajuste automático aplicado:</strong> La evaluación inicialmente excedía el tiempo objetivo 
                  en más del 10%. Se realizó una segunda pasada de refinamiento para reducir contenido manteniendo 
                  cobertura y contemplaciones.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        
        {/* Time breakdown (if available) */}
        {timeBreakdown && timeBreakdown.sections && timeBreakdown.sections.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium mb-2">Desglose de tiempo estimado:</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {timeBreakdown.sections.map((section, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-white">
                  <span className="truncate flex-1">
                    {section.description || section.itemType}
                  </span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    ~{section.estimatedMinutes} min
                  </Badge>
                </div>
              ))}
            </div>
            
            {/* Heuristic assumptions */}
            {timeBreakdown.heuristicAssumptions && (
              <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-muted-foreground">
                <strong>Supuestos heurísticos:</strong> {timeBreakdown.heuristicAssumptions}
              </div>
            )}
          </div>
        )}
        
      </CardContent>
    </Card>
  );
}

