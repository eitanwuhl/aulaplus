import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, BookOpen, Layers, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  useCompleteOnboarding,
  useInstitutionSnapshot,
  useSaveInstitutionSettings,
  useSetSchoolFrameworks,
} from '@/hooks/useInstitution';
import {
  canManageInstitution,
  CURRICULUM_FRAMEWORKS,
  IDIOMAS_OPTIONS,
  NIVELES_OFRECIDOS_OPTIONS,
} from '@/lib/institution/curriculumFrameworks';
import type { CurriculumFramework, InstitutionSettings } from '@/types/institution';

const STEPS = [
  { id: 1, title: 'Datos institucionales', icon: Building2 },
  { id: 2, title: 'Marcos curriculares', icon: Layers },
  { id: 3, title: 'Confirmación', icon: BookOpen },
] as const;

export default function InstitutionOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const enabled = Boolean(schoolId);

  if (!canManageInstitution(user?.profileRole)) {
    return <Navigate to="/institucion/configuracion" replace />;
  }

  const { data: snapshot } = useInstitutionSnapshot(schoolId, enabled);
  const saveSettings = useSaveInstitutionSettings(schoolId);
  const setFrameworks = useSetSchoolFrameworks(schoolId);
  const completeOnboarding = useCompleteOnboarding(schoolId);

  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<InstitutionSettings>({
    niveles_ofrecidos: ['cb'],
    idiomas_instruccion: ['Español'],
    idioma_principal: 'Español',
    ciclo_lectivo_inicio: '2026-03-01',
    ciclo_lectivo_fin: '2026-12-15',
    periodos_evaluacion: ['trimestres'],
  });
  const [selectedFrameworks, setSelectedFrameworks] = useState<CurriculumFramework[]>(['anep_ebi']);

  const toggleNivel = (id: string) => {
    setSettings((prev) => {
      const list = prev.niveles_ofrecidos ?? [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...prev, niveles_ofrecidos: next };
    });
  };

  const toggleFramework = (fw: CurriculumFramework) => {
    setSelectedFrameworks((prev) => {
      if (fw === 'anep_ebi') return prev.includes('anep_ebi') ? prev : [...prev, 'anep_ebi'];
      if (prev.includes(fw)) return prev.filter((x) => x !== fw);
      return [...prev, fw];
    });
  };

  const handleFinish = async () => {
    const settingsRes = await saveSettings.mutateAsync(settings);
    if (settingsRes.error) {
      toast({ variant: 'destructive', title: 'Error', description: settingsRes.error });
      return;
    }
    const fwRes = await setFrameworks.mutateAsync(selectedFrameworks);
    if (fwRes.error) {
      toast({ variant: 'destructive', title: 'Error', description: fwRes.error });
      return;
    }
    const doneRes = await completeOnboarding.mutateAsync();
    if (doneRes.error) {
      toast({ variant: 'destructive', title: 'Error', description: doneRes.error });
      return;
    }
    toast({ title: 'Configuración guardada', description: 'El liceo está listo para operar en Aula+.' });
    navigate('/institucion/configuracion');
  };

  const busy = saveSettings.isPending || setFrameworks.isPending || completeOnboarding.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración institucional</h1>
        <p className="text-foreground-subtle mt-1">
          Onboarding de {snapshot?.schoolName ?? user?.schoolName ?? 'tu liceo'} — Módulo 1
        </p>
      </div>

      <div className="flex gap-2">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`flex-1 rounded-lg border px-3 py-2 text-center text-sm ${
              step === s.id ? 'border-primary bg-primary/10 font-medium' : 'border-border'
            }`}
          >
            {s.title}
          </div>
        ))}
      </div>

      <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 1 — Datos institucionales</CardTitle>
              <CardDescription>Niveles, idiomas y ciclo lectivo (modelo uruguayo).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block">Niveles ofrecidos</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {NIVELES_OFRECIDOS_OPTIONS.map((n) => (
                    <label key={n.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
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
                  <Label htmlFor="ciclo-inicio">Inicio ciclo lectivo</Label>
                  <Input
                    id="ciclo-inicio"
                    type="date"
                    value={settings.ciclo_lectivo_inicio ?? ''}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, ciclo_lectivo_inicio: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="ciclo-fin">Fin ciclo lectivo</Label>
                  <Input
                    id="ciclo-fin"
                    type="date"
                    value={settings.ciclo_lectivo_fin ?? ''}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, ciclo_lectivo_fin: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Idioma principal</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 2 — Marcos curriculares</CardTitle>
              <CardDescription>
                ANEP MCN/EBI es obligatorio. Activá los programas internacionales que ofrece el liceo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {CURRICULUM_FRAMEWORKS.map((fw) => {
                const checked = selectedFrameworks.includes(fw.id);
                const locked = fw.id === 'anep_ebi';
                return (
                  <label key={fw.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <Checkbox
                      checked={checked}
                      disabled={locked}
                      onCheckedChange={() => toggleFramework(fw.id)}
                    />
                    <div>
                      <p className="font-medium">{fw.label}</p>
                      <p className="text-xs text-foreground-subtle">{fw.nivelesHint}</p>
                    </div>
                  </label>
                );
              })}
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 3 — Confirmación</CardTitle>
              <CardDescription>
                En el siguiente paso podrás asignar marcos por curso y revisar catálogos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                <strong>Niveles:</strong>{' '}
                {settings.niveles_ofrecidos?.join(', ') || '—'}
              </p>
              <p>
                <strong>Marcos activos:</strong>{' '}
                {selectedFrameworks
                  .map((id) => CURRICULUM_FRAMEWORKS.find((f) => f.id === id)?.shortLabel ?? id)
                  .join(', ')}
              </p>
              <p className="text-foreground-subtle">
                Los catálogos ANEP pre-cargados se vinculan automáticamente. Cambridge e IB requieren
                carga asistida (contacto Aula+).
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)}>
            Siguiente
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => void handleFinish()} disabled={busy}>
            <Check className="mr-1 h-4 w-4" />
            Finalizar configuración
          </Button>
        )}
      </div>
    </div>
  );
}
