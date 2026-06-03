import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useAnnualProgramLookup } from '@/hooks/useAnnualProgram';
import { canImportProgramToWizard } from '@/lib/annualProgram/annualProgramWorkflow';
import {
  fetchCatalogItemsForProgram,
  programUnitsToWizardUnits,
} from '@/services/annualProgram';
import type { WizardData } from '@/types/planificacion';

type Props = {
  wizardData: WizardData;
  onImport: (units: WizardData['enfoque'], programaId: string) => void;
};

export function AnnualProgramImportBanner({ wizardData, onImport }: Props) {
  const { session, user } = useAuth();
  const userId = session?.user?.id;
  const grupoId = wizardData.contexto?.grupo_id;
  const materia = wizardData.contexto?.materia;

  const { data: program, isLoading } = useAnnualProgramLookup(
    userId,
    grupoId,
    materia,
    Boolean(userId && grupoId && materia)
  );

  const canImport =
    program &&
    canImportProgramToWizard(program.estado, program.unidades?.length ?? 0);

  const handleImport = async () => {
    if (!program || !user?.schoolId) return;
    const catalogRes = await fetchCatalogItemsForProgram({
      schoolId: user.schoolId,
      framework: program.marco_planificacion,
      materia: program.materia,
    });
    const catalogById = new Map((catalogRes.data ?? []).map((c) => [c.id, c]));
    const units = programUnitsToWizardUnits(program.unidades ?? [], catalogById);
    onImport(
      {
        ...wizardData.enfoque,
        unidades_didacticas: units,
        distribucion_modalidades: wizardData.enfoque?.distribucion_modalidades ?? {
          individual: 25,
          pareja: 25,
          grupos: 25,
          toda_clase: 25,
        },
        requerimientos_docente: wizardData.enfoque?.requerimientos_docente ?? '',
        estrategias_diferenciacion: wizardData.enfoque?.estrategias_diferenciacion ?? '',
      },
      program.id
    );
  };

  const hint = useMemo(() => {
    if (isLoading) return 'Buscando programa anual…';
    if (!program) return 'No hay programa anual para este grupo y materia.';
    if (program.estado === 'borrador') return 'El programa está en borrador. Aprobá o marcá en uso antes de importar.';
    if (program.estado === 'en_revision') return 'El programa está en revisión institucional.';
    if ((program.unidades?.length ?? 0) === 0) return 'El programa no tiene unidades.';
    return `${program.unidades?.length} unidades listas para el wizard de sesiones.`;
  }, [isLoading, program]);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Programa anual
        </CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {canImport && (
          <Button type="button" size="sm" onClick={() => void handleImport()}>
            <Download className="h-4 w-4 mr-1" />
            Importar unidades al wizard
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" asChild>
          <Link to="/programa-anual">Gestionar programas</Link>
        </Button>
        {program && (
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link to={`/programa-anual/${program.id}`}>Abrir programa</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
