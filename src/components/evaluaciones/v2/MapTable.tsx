/**
 * V2 Evaluation Renderer - Map Table Component
 * 
 * Displays "Mapa de la evaluación" showing sections, points, and time breakdown.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Map, Clock, Award } from 'lucide-react';
import { NormalizedEvaluation, NormalizedSection } from '@/services/evaluations/v2Types';

interface MapTableProps {
  evaluation: NormalizedEvaluation;
}

export const MapTable: React.FC<MapTableProps> = ({ evaluation }) => {
  const { sections, totalPoints, totalDuration } = evaluation;

  // Calculate percentage per section
  const getPointsPercent = (sectionPoints: number): string => {
    if (totalPoints === 0) return '0%';
    return `${Math.round((sectionPoints / totalPoints) * 100)}%`;
  };

  // Estimate time per section (proportional to points if no duration specified)
  const estimateSectionTime = (section: NormalizedSection): number => {
    if (section.duration) return section.duration;
    if (totalPoints === 0) return 0;
    return Math.round((section.totalPoints / totalPoints) * totalDuration);
  };

  return (
    <Card className="border shadow-sm pdf-no-break">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Map className="h-5 w-5 text-primary" />
          Mapa de la Evaluación
        </CardTitle>
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
                  <span className="font-medium">{section.totalPoints}</span>
                  <span className="text-muted-foreground text-xs ml-1">
                    ({getPointsPercent(section.totalPoints)})
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  ~{estimateSectionTime(section)} min
                </TableCell>
              </TableRow>
            ))}
            
            {/* Totals row */}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell>TOTAL</TableCell>
              <TableCell className="text-center">{totalPoints}</TableCell>
              <TableCell className="text-center">{totalDuration} min</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default MapTable;
