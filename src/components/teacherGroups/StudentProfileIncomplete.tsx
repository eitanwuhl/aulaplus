import { User } from 'lucide-react';
import { TeacherGroupsBackButton } from '@/components/teacherGroups/TeacherGroupsBackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SchoolStudent } from '@/types/schoolCatalog';
import { CatalogEmptyState } from '@/components/teacherGroups/CatalogEmptyState';

type StudentProfileIncompleteProps = {
  student: SchoolStudent;
  onBack: () => void;
  backLabel?: string;
  fromPanel?: boolean;
};

/**
 * Shown when the student exists in the catalog but profile_data was not seeded yet.
 */
export function StudentProfileIncomplete({
  student,
  onBack,
  backLabel = 'Volver al grupo',
  fromPanel = false,
}: StudentProfileIncompleteProps) {
  return (
    <div className="space-y-6">
      <TeacherGroupsBackButton onClick={onBack} label={backLabel} fromPanel={fromPanel} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="text-3xl">{student.avatar}</span>
            <span>{student.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {student.perfil ? (
            <Badge variant="secondary">{student.perfil}</Badge>
          ) : (
            <p className="text-sm text-foreground-subtle">Sin perfil de aprendizaje cargado.</p>
          )}
        </CardContent>
      </Card>

      <CatalogEmptyState
        title="Perfil completo no disponible"
        description="Este alumno está en el catálogo escolar, pero aún no tiene datos extendidos (historial, informe técnico, contemplaciones). Si administrás el entorno, ejecutá npm run seed:student-profiles."
        icon={User}
      />
    </div>
  );
}
