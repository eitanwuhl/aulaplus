import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { normalizeStudentId } from '@/lib/contemplaciones/utils';
import type { StudentReminders } from '@/services/evaluations';

interface TeacherRemindersPanelProps {
  reminders: StudentReminders[];
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

export const TeacherRemindersPanel: React.FC<TeacherRemindersPanelProps> = ({
  reminders,
  students
}) => {
  const meaningfulReminders = reminders.filter(item =>
    item.admin.length > 0 || item.correction.length > 0 || item.allowances.length > 0
  );

  if (meaningfulReminders.length === 0) {
    return (
      <Card className="border-0 shadow">
        <CardHeader>
          <CardTitle className="text-lg">Recordatorios para el docente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay recordatorios específicos para este grupo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow">
      <CardHeader>
        <CardTitle className="text-lg">Recordatorios para el docente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {meaningfulReminders.map(reminder => (
          <div key={String(reminder.studentId)} className="rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary">
                {getStudentName(reminder.studentId, students)}
              </Badge>
            </div>
            <div className="space-y-3 text-sm">
              {reminder.admin.length > 0 && (
                <div>
                  <div className="font-medium text-foreground">Administración</div>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {reminder.admin.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {reminder.correction.length > 0 && (
                <div>
                  <div className="font-medium text-foreground">Corrección</div>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {reminder.correction.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {reminder.allowances.length > 0 && (
                <div>
                  <div className="font-medium text-foreground">Permisos / apoyos</div>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {reminder.allowances.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TeacherRemindersPanel;
