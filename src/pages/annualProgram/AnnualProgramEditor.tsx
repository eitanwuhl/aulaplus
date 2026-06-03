import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Send, CheckCircle2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  useAnnualProgram,
  useDeleteProgramUnit,
  usePlanningCatalog,
  useUpdateProgramEstado,
  useUpsertProgramUnit,
} from '@/hooks/useAnnualProgram';
import { ProgramCoverageBar } from '@/components/annualProgram/ProgramCoverageBar';
import { ProgramUnitCard } from '@/components/annualProgram/ProgramUnitCard';
import { computeProgramCoverage } from '@/lib/annualProgram/coverage';
import { frameworkLabel, canManageInstitution } from '@/lib/institution/curriculumFrameworks';
import type { ProgramaEstado, ProgramaUnidad } from '@/types/annualProgram';

const ESTADO_LABEL: Record<ProgramaEstado, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  en_uso: 'En uso',
};

export default function AnnualProgramEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, session } = useAuth();
  const userId = session?.user?.id;
  const schoolId = user?.schoolId;
  const canApprove = canManageInstitution(user?.profileRole);

  const { data: program, isLoading, isError } = useAnnualProgram(id, Boolean(id));
  const { data: catalogItems = [] } = usePlanningCatalog(
    schoolId,
    program?.marco_planificacion,
    program?.materia,
    Boolean(program)
  );

  const updateEstado = useUpdateProgramEstado(id ?? '', {
    ownerUserId: program?.user_id,
    schoolId,
  });
  const upsertUnit = useUpsertProgramUnit(id ?? '', userId);
  const deleteUnit = useDeleteProgramUnit(id ?? '', userId);

  const [draftUnits, setDraftUnits] = useState<Record<string, ProgramaUnidad>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const unidades = program?.unidades ?? [];
  const isOwner = program?.user_id === userId;
  const readOnly = !isOwner || program?.estado !== 'borrador';

  const coverage = useMemo(
    () => computeProgramCoverage(catalogItems, unidades, program?.materia),
    [catalogItems, unidades, program?.materia]
  );

  const getUnitView = useCallback(
    (u: ProgramaUnidad) => draftUnits[u.id] ?? u,
    [draftUnits]
  );

  const persistUnit = async (unit: ProgramaUnidad) => {
    if (!id) return;
    setSavingId(unit.id);
    await upsertUnit.mutateAsync({
      programaId: id,
      unit: {
        id: unit.id.startsWith('temp-') ? undefined : unit.id,
        nombre: unit.nombre,
        descripcion: unit.descripcion,
        orden: unit.orden,
        clases_estimadas: unit.clases_estimadas,
        catalog_item_ids: unit.catalog_item_ids,
        competencias_ids: unit.competencias_ids,
        estado: unit.estado,
      },
    });
    setSavingId(null);
    setDraftUnits((prev) => {
      const next = { ...prev };
      delete next[unit.id];
      return next;
    });
    toast({ title: 'Unidad guardada' });
  };

  const addUnit = async () => {
    if (!id || readOnly) return;
    const orden = unidades.length + 1;
    const temp: ProgramaUnidad = {
      id: `temp-${Date.now()}`,
      programa_id: id,
      nombre: `Unidad ${orden}`,
      descripcion: null,
      orden,
      fecha_inicio: null,
      fecha_fin: null,
      duracion_semanas: null,
      clases_estimadas: 2,
      estado: 'planificada',
      catalog_item_ids: [],
      competencias_ids: [],
      metadata: {},
      created_at: '',
      updated_at: '',
    };
    await persistUnit(temp);
  };

  const toggleCatalog = (unit: ProgramaUnidad, itemId: string) => {
    const ids = unit.catalog_item_ids.includes(itemId)
      ? unit.catalog_item_ids.filter((x) => x !== itemId)
      : [...unit.catalog_item_ids, itemId];
    setDraftUnits((prev) => ({
      ...prev,
      [unit.id]: { ...getUnitView(unit), catalog_item_ids: ids },
    }));
  };

  const changeEstado = async (estado: ProgramaEstado) => {
    try {
      await updateEstado.mutateAsync(estado);
      toast({ title: 'Estado actualizado', description: ESTADO_LABEL[estado] });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo actualizar',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="container py-8 text-muted-foreground">Cargando programa…</div>;
  }

  if (isError || !program) {
    return (
      <div className="container py-8 space-y-4">
        <p className="text-destructive">No se pudo cargar el programa.</p>
        <Button variant="outline" onClick={() => navigate('/programa-anual')}>
          Volver
        </Button>
      </div>
    );
  }

  const canUseInWizard = program.estado === 'aprobado' || program.estado === 'en_uso';

  return (
    <div className="container max-w-4xl space-y-6 py-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/programa-anual')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Programas anuales
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{program.nombre ?? program.materia}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Grupo {program.grupo_id} · {program.materia} · {frameworkLabel(program.marco_planificacion)} ·{' '}
            {program.anio_lectivo}
          </p>
          <Badge className="mt-2">{ESTADO_LABEL[program.estado]}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {program.estado === 'borrador' && isOwner && (
            <Button size="sm" variant="outline" onClick={() => void changeEstado('en_revision')}>
              <Send className="h-4 w-4 mr-1" />
              Enviar a revisión
            </Button>
          )}
          {canApprove && program.estado === 'en_revision' && (
            <Button size="sm" onClick={() => void changeEstado('aprobado')}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Aprobar
            </Button>
          )}
          {(program.estado === 'aprobado' || (canApprove && program.estado === 'en_revision')) && (
            <Button size="sm" variant="secondary" onClick={() => void changeEstado('en_uso')}>
              <Play className="h-4 w-4 mr-1" />
              Marcar en uso
            </Button>
          )}
          {canUseInWizard && (
            <Button size="sm" asChild>
              <Link
                to={`/planificacion/nuevo?grupo=${encodeURIComponent(program.grupo_id)}&materia=${encodeURIComponent(program.materia)}&programa=${program.id}`}
              >
                Planificar sesiones
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cobertura curricular</CardTitle>
          <CardDescription>Contenidos del catálogo institucional asignados a unidades.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProgramCoverageBar coverage={coverage} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Unidades del año ({unidades.length})</h2>
        {!readOnly && (
          <Button size="sm" onClick={() => void addUnit()} disabled={upsertUnit.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar unidad
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {unidades.map((u, index) => {
          const view = getUnitView(u);
          const dirty = Boolean(draftUnits[u.id]);
          return (
            <div key={u.id} className="space-y-2">
              <ProgramUnitCard
                unit={view}
                index={index}
                catalogItems={catalogItems}
                readOnly={readOnly}
                onChange={(next) => setDraftUnits((prev) => ({ ...prev, [u.id]: next }))}
                onDelete={() => {
                  if (!confirm('¿Eliminar esta unidad?')) return;
                  void deleteUnit.mutateAsync(u.id);
                }}
                onToggleCatalogItem={(itemId) => toggleCatalog(view, itemId)}
              />
              {dirty && !readOnly && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={savingId === u.id}
                    onClick={() => void persistUnit(view)}
                  >
                    Guardar cambios
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {unidades.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Agregá unidades y asignales contenidos del catálogo M1.
        </p>
      )}
    </div>
  );
}
