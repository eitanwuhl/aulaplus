import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTeacherGroups } from '@/hooks/useTeacherGroups';
import { createProgram, resolveGroupFramework } from '@/services/annualProgram';
import { frameworkLabel } from '@/lib/institution/curriculumFrameworks';

const MATERIAS = [
  'Historia',
  'Literatura',
  'Educación para la Ciudadanía',
  'Matemática',
  'Lengua Española',
];

export default function AnnualProgramNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, session } = useAuth();
  const userId = session?.user?.id;
  const schoolId = user?.schoolId;
  const { data: groups = [], isLoading: loadingGroups } = useTeacherGroups({
    userId,
    enabled: Boolean(userId),
  });
  const [grupoId, setGrupoId] = useState('');
  const [materia, setMateria] = useState('');
  const [nombre, setNombre] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!schoolId || !userId || !grupoId || !materia) {
      toast({
        title: 'Datos incompletos',
        description: 'Seleccioná grupo y materia.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const { framework } = await resolveGroupFramework(schoolId, grupoId);
    const result = await createProgram({
      schoolId,
      grupoId,
      materia,
      userId,
      marcoPlanificacion: framework,
      nombre: nombre.trim() || undefined,
    });
    setSubmitting(false);

    if (result.error || !result.data) {
      toast({
        title: 'No se pudo crear',
        description: result.error ?? 'Error desconocido',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Programa creado',
      description: `${frameworkLabel(framework)} · ${materia}`,
    });
    navigate(`/programa-anual/${result.data.id}`);
  };

  return (
    <div className="container max-w-xl space-y-6 py-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/programa-anual')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo programa anual</CardTitle>
          <CardDescription>
            Un programa por grupo, materia y año lectivo. El marco se toma del grupo (Módulo 1).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Grupo</Label>
            <Select value={grupoId} onValueChange={setGrupoId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingGroups ? 'Cargando…' : 'Seleccionar grupo'} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Materia</Label>
            <Select value={materia} onValueChange={setMateria}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar materia" />
              </SelectTrigger>
              <SelectContent>
                {MATERIAS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nombre (opcional)</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Historia 9°CB 2026"
            />
          </div>

          <Button
            className="w-full"
            disabled={submitting}
            onClick={() => void handleCreate()}
          >
            Crear y editar unidades
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
