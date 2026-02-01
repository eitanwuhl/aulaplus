/**
 * AIDesignEvidencePanel
 * 
 * Reusable component to display AI design evidence/rationale for both:
 * - Generated lesson plans (planificaciones)
 * - Generated evaluations (evaluaciones)
 * 
 * Shows a collapsible panel with:
 * - Inputs used (ANEP content, competencies, materials, sessions, etc.)
 * - Decisions (structure, time budgeting, adaptation level, etc.)
 * - Assumptions
 * - Changes from previous (for modify operations)
 * 
 * PHASE C: Safe design report (NOT raw chain-of-thought)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Brain, FileText, Target, Clock, Users, BookOpen, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AIDesignEvidence {
  inputsUsed?: {
    anepContent?: boolean;
    competencies?: string[];
    materials?: string[];
    sessions?: string[];
    planificationSource?: string;
    unitMaterials?: number;
  };
  decisions?: {
    structure?: string;
    timeBudgeting?: string;
    adaptationLevel?: string;
    coverage?: string;
  };
  assumptions?: string[];
  changesFromPrevious?: string;
}

interface AIDesignEvidencePanelProps {
  evidence: AIDesignEvidence | null | undefined;
  title?: string;
  description?: string;
  className?: string;
  defaultExpanded?: boolean;
}

export function AIDesignEvidencePanel({
  evidence,
  title = 'Reporte de IA',
  description = 'Información sobre cómo la IA generó este contenido',
  className,
  defaultExpanded = false
}: AIDesignEvidencePanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!evidence) {
    return null;
  }

  const { inputsUsed, decisions, assumptions, changesFromPrevious } = evidence;

  return (
    <Card className={cn('border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950/20', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base">{title}</CardTitle>
            <Badge variant="outline" className="text-xs bg-purple-100 dark:bg-purple-900/30">
              Solo docente
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-8 w-8 p-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Inputs Used */}
          {inputsUsed && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Entradas utilizadas
              </h4>
              <div className="space-y-1.5 text-sm">
                {inputsUsed.anepContent && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">ANEP</Badge>
                    <span>Contenido del programa ANEP</span>
                  </div>
                )}
                {inputsUsed.competencies && inputsUsed.competencies.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span>{inputsUsed.competencies.length} competencia(s) seleccionada(s)</span>
                  </div>
                )}
                {inputsUsed.materials && inputsUsed.materials.length > 0 && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span>{inputsUsed.materials.length} material(es) docente(s)</span>
                  </div>
                )}
                {inputsUsed.sessions && inputsUsed.sessions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3 w-3 text-muted-foreground" />
                    <span>{inputsUsed.sessions.length} sesión(es) de clase</span>
                  </div>
                )}
                {inputsUsed.planificationSource && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3 w-3 text-muted-foreground" />
                    <span>Planificación: {inputsUsed.planificationSource}</span>
                  </div>
                )}
                {inputsUsed.unitMaterials !== undefined && inputsUsed.unitMaterials > 0 && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span>{inputsUsed.unitMaterials} material(es) por unidad</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Decisions */}
          {decisions && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Decisiones de diseño
              </h4>
              <div className="space-y-1.5 text-sm">
                {decisions.structure && (
                  <div>
                    <span className="font-medium">Estructura: </span>
                    <span className="text-muted-foreground">{decisions.structure}</span>
                  </div>
                )}
                {decisions.timeBudgeting && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">Presupuesto de tiempo: </span>
                    <span className="text-muted-foreground">{decisions.timeBudgeting}</span>
                  </div>
                )}
                {decisions.adaptationLevel && (
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">Nivel de adaptación: </span>
                    <span className="text-muted-foreground">{decisions.adaptationLevel}</span>
                  </div>
                )}
                {decisions.coverage && (
                  <div>
                    <span className="font-medium">Cobertura: </span>
                    <span className="text-muted-foreground">{decisions.coverage}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assumptions */}
          {assumptions && assumptions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Supuestos</h4>
              <ul className="space-y-1 text-sm list-disc list-inside text-muted-foreground">
                {assumptions.map((assumption, idx) => (
                  <li key={idx}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Changes from Previous */}
          {changesFromPrevious && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Cambios desde la versión anterior</h4>
              <p className="text-sm text-muted-foreground">{changesFromPrevious}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

