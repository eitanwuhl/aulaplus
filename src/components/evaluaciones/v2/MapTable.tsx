/**
 * V2 Evaluation Renderer - Map Table Component
 *
 * Displays "Mapa de la evaluación" with sections, points, and time.
 * When editable (teacher), section and total points can be edited; changes redistribute and update the spec.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Map, Clock, Award } from 'lucide-react';
import { NormalizedEvaluation, NormalizedSection } from '@/services/evaluations/v2Types';
import type { EvaluationSpecV2 } from '@/services/evaluations/v2Types';
import { applySectionPointsEdit, redistributeTotalPoints } from '@/services/evaluations/pointsRedistribution';

interface MapTableProps {
  evaluation: NormalizedEvaluation;
  /** Required when editable: current spec to apply point edits to */
  evaluationSpec?: EvaluationSpecV2 | null;
  /** Teacher can edit points; show inputs and call onPointsChange on commit */
  editable?: boolean;
  /** Called with updated spec after section or total points edit */
  onPointsChange?: (updatedSpec: EvaluationSpecV2) => void;
  /** Optional: show warning toast (e.g. minimum points) */
  onWarning?: (message: string) => void;
}

export const MapTable: React.FC<MapTableProps> = ({
  evaluation,
  evaluationSpec,
  editable,
  onPointsChange,
  onWarning
}) => {
  const { sections, totalPoints, totalDuration } = evaluation;

  const getPointsPercent = (sectionPoints: number): string => {
    if (totalPoints === 0) return '0%';
    return `${Math.round((sectionPoints / totalPoints) * 100)}%`;
  };

  const estimateSectionTime = (section: NormalizedSection): number => {
    if (section.duration) return section.duration;
    if (totalPoints === 0) return 0;
    return Math.round((section.totalPoints / totalPoints) * totalDuration);
  };

  const handleSectionPointsBlur = (sectionId: string, currentPoints: number) => (e: React.FocusEvent<HTMLInputElement>) => {
    if (!editable || !evaluationSpec || !onPointsChange) return;
    const raw = e.target.value.trim();
    const next = raw === '' ? currentPoints : parseInt(raw, 10);
    if (isNaN(next) || next === currentPoints) return;
    const { spec, warning } = applySectionPointsEdit(evaluationSpec, sectionId, Math.max(0, next));
    if (warning) onWarning?.(warning);
    onPointsChange(spec);
  };

  const handleTotalPointsBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!editable || !evaluationSpec || !onPointsChange) return;
    const raw = e.target.value.trim();
    const next = raw === '' ? totalPoints : parseInt(raw, 10);
    if (isNaN(next) || next === totalPoints) return;
    const { spec, warning } = redistributeTotalPoints(evaluationSpec, Math.max(0, next));
    if (warning) onWarning?.(warning);
    onPointsChange(spec);
  };

  return (
    <Card className="border shadow-sm pdf-no-break">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Map className="h-5 w-5 text-primary" />
          Mapa de la Evaluación
        </CardTitle>
        {editable && (
          <p className="text-xs text-muted-foreground mt-1">
            Al cambiar los puntos, se redistribuyen automáticamente entre las preguntas de cada sección.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[55%]">Sección</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Award className="h-3.5 w-3.5" />
                  <span>Puntos</span>
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Tiempo</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.map((section) => (
              <TableRow key={section.id}>
                <TableCell className="font-medium">
                  <span className="text-muted-foreground mr-2">{section.number}.</span>
                  {section.title}
                </TableCell>
                <TableCell className="text-center">
                  {editable && evaluationSpec && onPointsChange ? (
                    <div className="flex items-center justify-center gap-1">
                      <Input
                        key={`section-${section.id}-${section.totalPoints}`}
                        type="number"
                        min={Math.max(1, section.items?.length ?? 1)}
                        className="w-16 h-8 text-center text-sm font-medium"
                        defaultValue={section.totalPoints}
                        onBlur={handleSectionPointsBlur(section.id, section.totalPoints)}
                      />
                      <span className="text-muted-foreground text-xs">
                        ({getPointsPercent(section.totalPoints)})
                      </span>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{section.totalPoints}</span>
                      <span className="text-muted-foreground text-xs ml-1">
                        ({getPointsPercent(section.totalPoints)})
                      </span>
                    </>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  ~{estimateSectionTime(section)} min
                </TableCell>
              </TableRow>
            ))}

            <TableRow className="bg-muted/50 font-semibold">
              <TableCell>TOTAL</TableCell>
              <TableCell className="text-center">
                {editable && evaluationSpec && onPointsChange ? (
                  <Input
                    key={`total-${totalPoints}`}
                    type="number"
                    min={sections.reduce((s, sec) => s + (sec.items?.length ?? 0), 0)}
                    className="w-16 h-8 text-center text-sm font-semibold mx-auto"
                    defaultValue={totalPoints}
                    onBlur={handleTotalPointsBlur}
                  />
                ) : (
                  totalPoints
                )}
              </TableCell>
              <TableCell className="text-center">{totalDuration} min</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default MapTable;
