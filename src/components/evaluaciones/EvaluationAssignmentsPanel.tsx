import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { normalizeStudentId } from '@/lib/contemplaciones/utils';

type VersionKind = 'A' | 'B' | 'C';

interface EvaluationAssignmentsPanelProps {
  assignments: Record<string, VersionKind>;
  students: Array<{ id: string | number; name?: string }>;
}

function getStudentName(
  studentId: string | number,
  students: Array<{ id: string | number; name?: string }>
): string {
  const targetId = normalizeStudentId(studentId);
  const match = students.find(student => normalizeStudentId(student.id) === targetId);
  return match?.name || `Estudiante ${studentId}`;
}

function getVersionLabel(version: VersionKind): string {
  if (version === 'A') return 'Versión A (Universal)';
  if (version === 'B') return 'Versión B (Equivalente)';
  return 'Versión C (Adecuación de contenido)';
}

export const EvaluationAssignmentsPanel: React.FC<EvaluationAssignmentsPanelProps> = ({
  assignments,
  students
}) => {
  const assignmentEntries = Object.entries(assignments);

  if (assignmentEntries.length === 0) {
    return (
      <Card className="border-0 shadow">
        <CardHeader>
          <CardTitle className="text-lg">Asignaciones por estudiante</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay asignaciones registradas para esta evaluación.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow">
      <CardHeader>
        <CardTitle className="text-lg">Asignaciones por estudiante</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {assignmentEntries.map(([studentId, version]) => (
            <div
              key={studentId}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span className="font-medium text-foreground">
                {getStudentName(studentId, students)}
              </span>
              <Badge variant="outline">{getVersionLabel(version)}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default EvaluationAssignmentsPanel;
