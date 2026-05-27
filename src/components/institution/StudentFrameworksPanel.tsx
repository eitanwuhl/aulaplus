import { useMemo, useState } from 'react';
import { GraduationCap, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useStudentFrameworkAssignments, useUpdateStudentFrameworks } from '@/hooks/useInstitution';
import { frameworkLabel } from '@/lib/institution/curriculumFrameworks';
import type { CurriculumFramework } from '@/types/institution';

type Props = {
  schoolId: string;
  canEdit: boolean;
  activeFrameworks: CurriculumFramework[];
};

export function StudentFrameworksPanel({ schoolId, canEdit, activeFrameworks }: Props) {
  const { toast } = useToast();
  const [filter, setFilter] = useState('');
  const { data: students = [] } = useStudentFrameworkAssignments(schoolId, true);
  const updateFw = useUpdateStudentFrameworks(schoolId);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.groupName.toLowerCase().includes(q)
    );
  }, [students, filter]);

  const toggleStudentFramework = async (
    studentId: number,
    current: CurriculumFramework[],
    fw: CurriculumFramework
  ) => {
    const next = current.includes(fw)
      ? current.filter((x) => x !== fw)
      : [...current, fw];
    const res = await updateFw.mutateAsync({ studentId, frameworks: next });
    if (res.error) {
      toast({ variant: 'destructive', title: 'Error', description: res.error });
    }
  };

  if (activeFrameworks.length < 2) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-foreground-subtle">
          Activá al menos dos marcos curriculares en la pestaña Marcos para asignar multimarco por
          alumno (doble titulación).
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Multimarco por alumno
        </CardTitle>
        <CardDescription>
          Nivel 3 del modelo: marcos adicionales por estudiante (ej. ANEP + IB MYP). Si no se
          asignan, se usa el marco del curso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar alumno o curso..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="space-y-3 max-h-[480px] overflow-y-auto">
          {filtered.map((s) => (
            <div key={s.studentId} className="rounded-lg border p-3">
              <div className="mb-2">
                <p className="font-medium text-sm">{s.displayName}</p>
                <p className="text-xs text-foreground-subtle">{s.groupName}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {activeFrameworks.map((fw) => (
                  <label key={fw} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      disabled={!canEdit || updateFw.isPending}
                      checked={s.frameworks.includes(fw)}
                      onCheckedChange={() =>
                        void toggleStudentFramework(s.studentId, s.frameworks, fw)
                      }
                    />
                    {frameworkLabel(fw)}
                  </label>
                ))}
              </div>
              {s.frameworks.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Hereda marco del curso</p>
              )}
            </div>
          ))}
        </div>

        {!canEdit && (
          <p className="text-xs text-foreground-subtle">Solo lectura — edición: Dirección / Admin.</p>
        )}
      </CardContent>
    </Card>
  );
}
