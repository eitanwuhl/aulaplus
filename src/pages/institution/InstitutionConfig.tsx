import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Layers, Users, BookOpen, CheckCircle2, GraduationCap } from 'lucide-react';
import { CatalogManagementPanel } from '@/components/institution/CatalogManagementPanel';
import { StudentFrameworksPanel } from '@/components/institution/StudentFrameworksPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  useCatalogSummary,
  useInstitutionGroupFrameworks,
  useInstitutionSnapshot,
  useSaveInstitutionSettings,
  useSetSchoolFrameworks,
  useUpdateGroupFramework,
} from '@/hooks/useInstitution';
import {
  canManageInstitution,
  CURRICULUM_FRAMEWORKS,
  frameworkLabel,
  IDIOMAS_OPTIONS,
  NIVELES_OFRECIDOS_OPTIONS,
} from '@/lib/institution/curriculumFrameworks';
import type { CurriculumFramework, InstitutionSettings } from '@/types/institution';

export default function InstitutionConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const schoolId = user?.schoolId;
  const canEdit = canManageInstitution(user?.profileRole);
  const enabled = Boolean(schoolId);

  const { data: snapshot } = useInstitutionSnapshot(schoolId, enabled);
  const { data: groups = [] } = useInstitutionGroupFrameworks(schoolId, enabled);
  const { data: catalogs = [] } = useCatalogSummary(enabled);

  const saveSettings = useSaveInstitutionSettings(schoolId);
  const setFrameworks = useSetSchoolFrameworks(schoolId);
  const updateGroupFw = useUpdateGroupFramework(schoolId);

  const [settings, setSettings] = useState<InstitutionSettings>({});
  const [activeFw, setActiveFw] = useState<CurriculumFramework[]>(['anep_ebi']);

  useEffect(() => {
    if (snapshot?.settings) {
      setSettings(snapshot.settings);
    }
    if (snapshot?.activeFrameworks) {
      setActiveFw(
        snapshot.activeFrameworks.filter((f) => f.activo).map((f) => f.framework)
      );
    }
  }, [snapshot]);

  const toggleNivel = (id: string) => {
    setSettings((prev) => {
      const list = prev.niveles_ofrecidos ?? [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...prev, niveles_ofrecidos: next };
    });
  };

  const toggleFramework = (fw: CurriculumFramework) => {
    if (fw === 'anep_ebi') return;
    setActiveFw((prev) =>
      prev.includes(fw) ? prev.filter((x) => x !== fw) : [...prev, fw]
    );
  };

  const handleSaveGeneral = async () => {
    const res = await saveSettings.mutateAsync(settings);
    if (res.error) {
      toast({ variant: 'destructive', title: 'Error', description: res.error });
      return;
    }
    toast({ title: 'Guardado', description: 'Datos institucionales actualizados.' });
  };

  const handleSaveFrameworks = async () => {
    const res = await setFrameworks.mutateAsync(activeFw);
    if (res.error) {
      toast({ variant: 'destructive', title: 'Error', description: res.error });
      return;
    }
    toast({ title: 'Guardado', description: 'Marcos curriculares actualizados.' });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Configuración institucional</h1>
          <p className="text-foreground-subtle mt-1">
            {snapshot?.schoolName ?? user?.schoolName} — Módulo 1
          </p>
        </div>
        {snapshot?.onboardingCompleted ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Onboarding completado
          </Badge>
        ) : (
          canEdit && (
            <Button asChild variant="outline" size="sm">
              <Link to="/institucion/onboarding">Completar onboarding</Link>
            </Button>
          )
        )}
      </div>

      {!canEdit && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="pt-6 text-sm">
            Tenés acceso de solo lectura. Los cambios los realiza Dirección o Administración.
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="gap-1">
            <Building2 className="h-4 w-4 hidden sm:inline" />
            General
          </TabsTrigger>
          <TabsTrigger value="marcos" className="gap-1">
            <Layers className="h-4 w-4 hidden sm:inline" />
            Marcos
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-1">
            <Users className="h-4 w-4 hidden sm:inline" />
            Grupos
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-1">
            <BookOpen className="h-4 w-4 hidden sm:inline" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="alumnos" className="gap-1">
            <GraduationCap className="h-4 w-4 hidden sm:inline" />
            Alumnos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Datos institucionales</CardTitle>
              <CardDescription>Niveles, idiomas y ciclo lectivo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block">Niveles ofrecidos</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {NIVELES_OFRECIDOS_OPTIONS.map((n) => (
                    <label key={n.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        disabled={!canEdit}
                        checked={settings.niveles_ofrecidos?.includes(n.id)}
                        onCheckedChange={() => toggleNivel(n.id)}
                      />
                      {n.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cfg-inicio">Inicio ciclo</Label>
                  <Input
                    id="cfg-inicio"
                    type="date"
                    disabled={!canEdit}
                    value={settings.ciclo_lectivo_inicio ?? ''}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, ciclo_lectivo_inicio: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="cfg-fin">Fin ciclo</Label>
                  <Input
                    id="cfg-fin"
                    type="date"
                    disabled={!canEdit}
                    value={settings.ciclo_lectivo_fin ?? ''}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, ciclo_lectivo_fin: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Idioma principal</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                  disabled={!canEdit}
                  value={settings.idioma_principal ?? 'Español'}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, idioma_principal: e.target.value }))
                  }
                >
                  {IDIOMAS_OPTIONS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              {canEdit && (
                <Button onClick={() => void handleSaveGeneral()} disabled={saveSettings.isPending}>
                  Guardar cambios
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marcos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Marcos curriculares activos</CardTitle>
              <CardDescription>ANEP EBI es obligatorio como marco base uruguayo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {CURRICULUM_FRAMEWORKS.map((fw) => {
                const checked = activeFw.includes(fw.id);
                const locked = fw.id === 'anep_ebi';
                return (
                  <label key={fw.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <Checkbox
                      checked={checked}
                      disabled={!canEdit || locked}
                      onCheckedChange={() => toggleFramework(fw.id)}
                    />
                    <div>
                      <p className="font-medium">{fw.label}</p>
                      <p className="text-xs text-foreground-subtle">{fw.nivelesHint}</p>
                    </div>
                  </label>
                );
              })}
              {canEdit && (
                <Button
                  onClick={() => void handleSaveFrameworks()}
                  disabled={setFrameworks.isPending}
                >
                  Guardar marcos
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grupos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Marco por curso</CardTitle>
              <CardDescription>
                Asigná marco principal y secundario (ej. ANEP + Cambridge) por grupo del catálogo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <p className="text-sm text-foreground-subtle">No hay grupos en el catálogo escolar.</p>
              ) : (
                <div className="space-y-4">
                  {groups.map((g) => (
                    <div
                      key={g.groupId}
                      className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3 sm:items-end"
                    >
                      <div>
                        <p className="font-medium">{g.groupName}</p>
                        <p className="text-xs text-foreground-subtle">
                          {g.year} {g.section}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs">Marco principal</Label>
                        <Select
                          disabled={!canEdit}
                          value={g.primary_framework ?? 'anep_ebi'}
                          onValueChange={(v) => {
                            void updateGroupFw.mutateAsync({
                              groupId: g.groupId,
                              primary: v as CurriculumFramework,
                              secondary: g.secondary_framework,
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {activeFw.map((fw) => (
                              <SelectItem key={fw} value={fw}>
                                {frameworkLabel(fw)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Marco secundario (opcional)</Label>
                        <Select
                          disabled={!canEdit}
                          value={g.secondary_framework ?? '_none'}
                          onValueChange={(v) => {
                            void updateGroupFw.mutateAsync({
                              groupId: g.groupId,
                              primary: g.primary_framework ?? 'anep_ebi',
                              secondary:
                                v === '_none' ? null : (v as CurriculumFramework),
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Ninguno" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Ninguno</SelectItem>
                            {activeFw
                              .filter((fw) => fw !== g.primary_framework)
                              .map((fw) => (
                                <SelectItem key={fw} value={fw}>
                                  {frameworkLabel(fw)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalogo" className="mt-4 space-y-4">
          {schoolId && (
            <CatalogManagementPanel
              schoolId={schoolId}
              canEdit={canEdit}
              activeFrameworks={activeFw}
            />
          )}
          {catalogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Catálogos globales activos</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {catalogs.map((c) => (
                    <li
                      key={`${c.framework}-${c.nombre}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>
                        <strong>{frameworkLabel(c.framework)}</strong> — {c.nombre}
                      </span>
                      <Badge variant="outline">{c.itemCount} ítems</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alumnos" className="mt-4">
          {schoolId && (
            <StudentFrameworksPanel
              schoolId={schoolId}
              canEdit={canEdit}
              activeFrameworks={activeFw}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
