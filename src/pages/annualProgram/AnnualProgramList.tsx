import { useMemo } from 'react';
import {
  partitionProgramsForReviewer,
  sortProgramsByYearDesc,
} from '@/lib/annualProgram/annualProgramWorkflow';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolAnnualPrograms, useTeacherAnnualPrograms } from '@/hooks/useAnnualProgram';
import { frameworkLabel, canManageInstitution } from '@/lib/institution/curriculumFrameworks';
import { DEFAULT_ANIO_LECTIVO } from '@/lib/annualProgram/constants';
import type { GrupoPrograma, ProgramaEstado } from '@/types/annualProgram';

const ESTADO_LABEL: Record<ProgramaEstado, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  en_uso: 'En uso',
};

const ESTADO_VARIANT: Record<ProgramaEstado, 'secondary' | 'outline' | 'default'> = {
  borrador: 'secondary',
  en_revision: 'outline',
  aprobado: 'default',
  en_uso: 'default',
};

function ProgramCard({ program }: { program: GrupoPrograma }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">
              {program.nombre ?? `${program.materia} ${program.anio_lectivo}`}
            </CardTitle>
            <CardDescription>
              Grupo {program.grupo_id} · {program.materia} · {frameworkLabel(program.marco_planificacion)}
            </CardDescription>
          </div>
          <Badge variant={ESTADO_VARIANT[program.estado]}>{ESTADO_LABEL[program.estado]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/programa-anual/${program.id}`}>
            {program.estado === 'en_revision' ? 'Revisar' : 'Abrir'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AnnualProgramList() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const userId = session?.user?.id;
  const schoolId = user?.schoolId;
  const isReviewer = canManageInstitution(user?.profileRole);

  const teacherQuery = useTeacherAnnualPrograms(userId, !isReviewer);
  const schoolQuery = useSchoolAnnualPrograms(schoolId, isReviewer);

  const programs = isReviewer ? schoolQuery.data ?? [] : teacherQuery.data ?? [];
  const isLoading = isReviewer ? schoolQuery.isLoading : teacherQuery.isLoading;

  const sorted = useMemo(() => sortProgramsByYearDesc(programs), [programs]);

  const { pendingReview, otherPrograms } = useMemo(
    () => (isReviewer ? partitionProgramsForReviewer(sorted) : { pendingReview: [], otherPrograms: sorted }),
    [isReviewer, sorted]
  );

  return (
    <div className="container max-w-5xl space-y-6 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            Programa anual
          </h1>
          <p className="text-muted-foreground mt-1">
            {isReviewer
              ? 'Revisá y aprobá los programas que los docentes envían a institución.'
              : 'Organizá el año por grupo y materia antes del wizard de sesiones.'}
          </p>
        </div>
        {!isReviewer && (
          <Button onClick={() => navigate('/programa-anual/nuevo')}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo programa
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Cargando programas…</p>}

      {!isLoading && isReviewer && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pendientes de aprobación</h2>
          {pendingReview.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nada pendiente</CardTitle>
                <CardDescription>
                  Cuando un docente envíe un programa a revisión, aparecerá aquí.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingReview.map((p) => (
                <ProgramCard key={p.id} program={p} />
              ))}
            </div>
          )}
        </section>
      )}

      {!isLoading && sorted.length === 0 && !isReviewer && (
        <Card>
          <CardHeader>
            <CardTitle>Sin programas todavía</CardTitle>
            <CardDescription>
              Creá tu primer programa anual vinculado al catálogo institucional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/programa-anual/nuevo')}>Crear programa anual</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && (isReviewer ? otherPrograms.length > 0 : sorted.length > 0) && (
        <section className="space-y-3">
          {isReviewer && <h2 className="text-lg font-semibold">Todos los programas del liceo</h2>}
          <div className="grid gap-4">
            {(isReviewer ? otherPrograms : sorted).map((p) => (
              <ProgramCard key={p.id} program={p} />
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">Año lectivo: {DEFAULT_ANIO_LECTIVO}</p>
    </div>
  );
}
