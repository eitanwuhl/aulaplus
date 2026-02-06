import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList, CheckCircle2, ChevronsUpDown } from 'lucide-react';
import { normalizeStudentId } from '@/lib/contemplaciones/utils';
import type { StudentReminders, MissingTemplateError } from '@/services/evaluations';

/** Threshold: if more than this many students, collapse all by default */
const COLLAPSE_THRESHOLD = 6;

interface TeacherRemindersPanelProps {
  reminders: StudentReminders[];
  students: Array<{ id: string | number; name?: string }>;
  /** Missing template errors - if present, show error state instead of empty state */
  missingTemplateErrors?: MissingTemplateError[];
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
  students,
  missingTemplateErrors = []
}) => {
  // NOTE: We only filter by admin + correction reminders.
  // Allowances (INSTRUMENT_DESIGN bucket) affect cuadernillo design but are NOT teacher reminders.
  // Allowances are explained in the AI Design Report instead.
  const meaningfulReminders = reminders.filter(item =>
    item.admin.length > 0 || item.correction.length > 0
  );

  // FAIL-FAST: If there are missing templates, show error state instead of empty state
  if (missingTemplateErrors.length > 0) {
    // Log the error for debugging
    console.error('[TeacherRemindersPanel] Missing reminder templates:', missingTemplateErrors);
    
    // Deduplicate by contemplacionId for cleaner display
    const uniqueMissing = Array.from(
      new Map(missingTemplateErrors.map(e => [e.contemplacionId, e])).values()
    );
    
    return (
      <Card className="border-0 shadow border-l-4 border-l-red-500">
        <CardHeader>
          <CardTitle className="text-lg text-red-700 dark:text-red-400 flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Recordatorios para el docente
            <AlertTriangle className="h-4 w-4 ml-1" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No se pueden generar recordatorios</AlertTitle>
            <AlertDescription>
              Algunas contemplaciones seleccionadas no tienen templates de recordatorio definidos.
              Esto requiere atención del desarrollador.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <p className="text-sm font-medium">Contemplaciones sin template:</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {uniqueMissing.map(err => (
                <li key={err.contemplacionId}>
                  <code className="text-red-600 dark:text-red-400">{err.contemplacionId}</code>
                  {' '}(bucket: <code>{err.bucket}</code>)
                  <br />
                  <span className="text-xs">Agregar en: <code>{err.expectedTemplateLocation}</code></span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (meaningfulReminders.length === 0) {
    return (
      <Card className="border-0 shadow">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Recordatorios para el docente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay recordatorios específicos para este grupo.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Determine default expanded state based on student count
  const defaultExpanded = useMemo(() => {
    if (meaningfulReminders.length <= COLLAPSE_THRESHOLD) {
      // Few students: expand the first one
      return meaningfulReminders.length > 0 ? [String(meaningfulReminders[0].studentId)] : [];
    }
    // Many students: collapse all
    return [];
  }, [meaningfulReminders]);

  const [expandedStudents, setExpandedStudents] = useState<string[]>(defaultExpanded);

  const allStudentIds = useMemo(
    () => meaningfulReminders.map(r => String(r.studentId)),
    [meaningfulReminders]
  );

  const allExpanded = expandedStudents.length === allStudentIds.length;
  const noneExpanded = expandedStudents.length === 0;

  const toggleStudent = (studentId: string) => {
    setExpandedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const expandAll = () => setExpandedStudents(allStudentIds);
  const collapseAll = () => setExpandedStudents([]);

  return (
    <Card className="border-0 shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Recordatorios para el docente
            <Badge variant="outline" className="ml-2 font-normal">
              {meaningfulReminders.length} estudiante{meaningfulReminders.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={expandAll}
              disabled={allExpanded}
              className="text-xs h-7 px-2"
              title="Expandir todos"
            >
              <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
              Expandir
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={collapseAll}
              disabled={noneExpanded}
              className="text-xs h-7 px-2"
              title="Colapsar todos"
            >
              <ChevronUp className="h-3.5 w-3.5 mr-1" />
              Colapsar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {meaningfulReminders.map(reminder => {
          const studentId = String(reminder.studentId);
          const isOpen = expandedStudents.includes(studentId);
          const totalCount = reminder.admin.length + reminder.correction.length;
          const hasAdmin = reminder.admin.length > 0;
          const hasCorrection = reminder.correction.length > 0;

          return (
            <Collapsible
              key={studentId}
              open={isOpen}
              onOpenChange={() => toggleStudent(studentId)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full p-2 md:p-3 h-auto text-left hover:bg-muted/50 rounded-lg border"
                >
                  {/* 
                    STRICT 4-COLUMN GRID LAYOUT (Desktop)
                    Col 1: Name (flexible, truncates)
                    Col 2: Count pill (fixed 110px)
                    Col 3: Category chips (fixed 180px)
                    Col 4: Chevron (fixed 24px)
                    
                    Mobile: 2-row stacked layout
                    Row 1: Name + Chevron
                    Row 2: Count pill + Chips
                  */}
                  
                  {/* MOBILE LAYOUT (< md) */}
                  <div className="w-full flex flex-col gap-1.5 md:hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span 
                        className="font-medium text-sm truncate min-w-0 flex-1" 
                        title={getStudentName(reminder.studentId, students)}
                      >
                        {getStudentName(reminder.studentId, students)}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs font-normal whitespace-nowrap">
                        {totalCount} recordatorio{totalCount !== 1 ? 's' : ''}
                      </Badge>
                      {hasAdmin && (
                        <Badge variant="outline" className="text-[11px] py-0 px-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200">
                          Admin
                        </Badge>
                      )}
                      {hasCorrection && (
                        <Badge variant="outline" className="text-[11px] py-0 px-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200">
                          Corrección
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* DESKTOP LAYOUT (≥ md) - Strict 4-column grid */}
                  <div className="hidden md:grid w-full grid-cols-[minmax(80px,1fr)_110px_180px_24px] gap-x-2 items-center">
                    {/* Col 1: Student name - flexible but truncates */}
                    <span 
                      className="font-medium text-sm truncate min-w-0" 
                      title={getStudentName(reminder.studentId, students)}
                    >
                      {getStudentName(reminder.studentId, students)}
                    </span>
                    
                    {/* Col 2: Count pill - fixed 110px column */}
                    <Badge variant="secondary" className="text-xs font-normal whitespace-nowrap w-fit">
                      {totalCount} recordatorio{totalCount !== 1 ? 's' : ''}
                    </Badge>
                    
                    {/* Col 3: Category chips - fixed 180px column */}
                    <div className="flex gap-1 flex-wrap">
                      {hasAdmin && (
                        <Badge variant="outline" className="text-[11px] py-0 px-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200">
                          Administración
                        </Badge>
                      )}
                      {hasCorrection && (
                        <Badge variant="outline" className="text-[11px] py-0 px-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200">
                          Corrección
                        </Badge>
                      )}
                      {!hasAdmin && !hasCorrection && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    
                    {/* Col 4: Chevron - fixed 24px column, right-aligned */}
                    <div className="flex justify-end">
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="px-3 pb-3">
                <div className="mt-2 space-y-3 text-sm border-l-2 border-muted pl-4 ml-2">
                  {hasAdmin && (
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                        Administración
                      </div>
                      <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                        {reminder.admin.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {hasCorrection && (
                    <div>
                      <div className="font-medium text-foreground flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />
                        Corrección
                      </div>
                      <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                        {reminder.correction.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeacherRemindersPanel;
