import { useRef, useState } from 'react';
import { Upload, Plus, Check, Copy, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useActivateCatalog,
  useCatalogVersions,
  useCreateCatalogDraft,
  useImportCatalogCsv,
} from '@/hooks/useInstitution';
import {
  CURRICULUM_FRAMEWORKS,
  frameworkLabel,
} from '@/lib/institution/curriculumFrameworks';
import {
  isInternationalFramework,
  parseCatalogCsv,
} from '@/lib/institution/parseCatalogCsv';
import type { CurriculumFramework } from '@/types/institution';

const CSV_TEMPLATE = `tipo,codigo,nombre,descripcion,nivel,materia,parent_codigo,orden
learning_objective,LO-1,Understand key concepts,Unit 1,Stage 7,Science,,1
strand,ST-1,Working scientifically,,Stage 7,Science,LO-1,2`;

type Props = {
  schoolId: string;
  canEdit: boolean;
  activeFrameworks: CurriculumFramework[];
};

const STATUS_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  activa: 'Activa',
  deprecada: 'Deprecada',
};

export function CatalogManagementPanel({ schoolId, canEdit, activeFrameworks }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: catalogs = [], refetch } = useCatalogVersions(schoolId, true);

  const createDraft = useCreateCatalogDraft(schoolId);
  const activate = useActivateCatalog(schoolId);
  const importCsv = useImportCatalogCsv();

  const [newFw, setNewFw] = useState<CurriculumFramework>('cambridge_lower');
  const [newName, setNewName] = useState('');
  const [newVersion, setNewVersion] = useState('1.0');
  const [cloneFrom, setCloneFrom] = useState<string>('_none');
  const [uploadCatalogId, setUploadCatalogId] = useState<string>('');

  const internationalActive = activeFrameworks.filter(isInternationalFramework);
  const schoolCatalogs = catalogs.filter((c) => c.school_id === schoolId);
  const draftCatalogs = schoolCatalogs.filter((c) => c.estado === 'borrador');

  const handleCreateVersion = async () => {
    if (!newName.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido' });
      return;
    }
    const res = await createDraft.mutateAsync({
      framework: newFw,
      nombre: newName.trim(),
      version: newVersion.trim() || '1.0',
      cloneFromCatalogId: cloneFrom === '_none' ? undefined : cloneFrom,
    });
    if (res.error) {
      toast({ variant: 'destructive', title: 'Error', description: res.error });
      return;
    }
    toast({ title: 'Versión creada', description: 'Estado: borrador. Podés importar el CSV.' });
    setUploadCatalogId(res.data!.catalogId);
    void refetch();
  };

  const handleFile = async (file: File) => {
    const catalogId = uploadCatalogId || draftCatalogs[0]?.id;
    if (!catalogId) {
      toast({
        variant: 'destructive',
        title: 'Sin catálogo borrador',
        description: 'Creá una versión en borrador antes de importar.',
      });
      return;
    }
    const text = await file.text();
    const { rows, errors } = parseCatalogCsv(text);
    if (rows.length === 0) {
      toast({
        variant: 'destructive',
        title: 'CSV vacío o inválido',
        description: errors.join(' ') || 'Revisá el formato.',
      });
      return;
    }
    const res = await importCsv.mutateAsync({ catalogId, rows });
    if (res.error) {
      toast({ variant: 'destructive', title: 'Importación fallida', description: res.error });
      return;
    }
    toast({
      title: 'Importación completa',
      description: `${res.imported} ítems cargados.${errors.length ? ` Avisos: ${errors.length}` : ''}`,
    });
    void refetch();
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_catalogo_cambridge_ib.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Versionamiento de catálogos</CardTitle>
          <CardDescription>
            Creá versiones propias del liceo, activá una por marco y deprecá las anteriores
            automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {catalogs.length === 0 ? (
            <p className="text-sm text-foreground-subtle">Sin catálogos. Ejecutá seed:module1.</p>
          ) : (
            <ul className="space-y-2">
              {catalogs.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <strong>{frameworkLabel(c.framework)}</strong> — {c.nombre}{' '}
                    <span className="text-foreground-subtle">v{c.version}</span>
                    {c.school_id ? (
                      <Badge variant="secondary" className="ml-2">
                        Liceo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2">
                        Global Aula+
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        c.estado === 'activa'
                          ? 'default'
                          : c.estado === 'borrador'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {STATUS_LABEL[c.estado] ?? c.estado}
                    </Badge>
                    <span className="text-xs text-foreground-subtle">{c.itemCount ?? 0} ítems</span>
                    {canEdit && c.school_id === schoolId && c.estado === 'borrador' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={activate.isPending}
                        onClick={() => {
                          void activate.mutateAsync(c.id).then((r) => {
                            if (r.error) {
                              toast({ variant: 'destructive', description: r.error });
                            } else {
                              toast({ title: 'Catálogo activado' });
                              void refetch();
                            }
                          });
                        }}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Activar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Nueva versión (borrador)
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nueva versión de catálogo</DialogTitle>
                  <DialogDescription>
                    Cambridge / IB u otro marco internacional activo en el liceo.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Marco</Label>
                    <Select
                      value={newFw}
                      onValueChange={(v) => setNewFw(v as CurriculumFramework)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(internationalActive.length
                          ? internationalActive
                          : CURRICULUM_FRAMEWORKS.filter((f) => isInternationalFramework(f.id)).map(
                              (f) => f.id
                            )
                        ).map((fw) => (
                          <SelectItem key={fw} value={fw}>
                            {frameworkLabel(fw)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nombre</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Cambridge Lower Secondary 2026"
                    />
                  </div>
                  <div>
                    <Label>Versión</Label>
                    <Input
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      placeholder="2026.1"
                    />
                  </div>
                  <div>
                    <Label>Clonar ítems desde</Label>
                    <Select value={cloneFrom} onValueChange={setCloneFrom}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Vacío</SelectItem>
                        {catalogs
                          .filter((c) => c.framework === newFw && (c.itemCount ?? 0) > 0)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nombre} v{c.version} ({c.itemCount} ítems)
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => void handleCreateVersion()}
                    disabled={createDraft.isPending}
                  >
                    <Copy className="mr-1 h-4 w-4" />
                    Crear borrador
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Carga masiva (CSV)</CardTitle>
            <CardDescription>
              Importá objetivos Cambridge / IB. Columnas: tipo, codigo, nombre, descripcion, nivel,
              materia, parent_codigo, orden.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <FileDown className="mr-1 h-4 w-4" />
                Plantilla CSV
              </Button>
              {draftCatalogs.length > 0 && (
                <Select value={uploadCatalogId || draftCatalogs[0]?.id} onValueChange={setUploadCatalogId}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Catálogo borrador" />
                  </SelectTrigger>
                  <SelectContent>
                    {draftCatalogs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {frameworkLabel(c.framework)} v{c.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = '';
                }}
              />
              <Button
                size="sm"
                disabled={importCsv.isPending || draftCatalogs.length === 0}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-1 h-4 w-4" />
                Subir CSV
              </Button>
            </div>
            {internationalActive.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Activá al menos un marco Cambridge o IB en la pestaña Marcos antes de cargar
                catálogos propios.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
