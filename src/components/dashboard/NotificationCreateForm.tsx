import type { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { renderFieldError } from '@/lib/formFieldError';
import type { CreateNotificationFormData } from '@/schemas/createNotificationFormSchema';
import type {
  GroupLinkOption,
  NotificationLinkTarget,
  NotificationType,
  StudentLinkOption,
} from '@/services/notifications';

type NotificationCreateFormProps = {
  form: UseFormReturn<CreateNotificationFormData>;
  onSubmit: (data: CreateNotificationFormData) => void;
  studentLinkOptions: StudentLinkOption[];
  groupLinkOptions: GroupLinkOption[];
  linkOptionsLoadFailed: boolean;
  isSubmitting: boolean;
};

export function NotificationCreateForm({
  form,
  onSubmit,
  studentLinkOptions,
  groupLinkOptions,
  linkOptionsLoadFailed,
  isSubmitting,
}: NotificationCreateFormProps) {
  const linkTarget = form.watch('linkTarget');

  return (
    <details className="rounded-lg border bg-muted/30 p-3 text-sm">
      <summary className="cursor-pointer font-medium">Crear aviso (prueba)</summary>
      <form onSubmit={form.handleSubmit(onSubmit)} className="pt-4 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="dash-notif-title">Título</Label>
          <Input
            id="dash-notif-title"
            placeholder="Ej. Aviso de prueba"
            aria-invalid={!!form.formState.errors.title}
            {...form.register('title')}
          />
          {form.formState.errors.title && (
            <span className="text-xs text-destructive">
              {renderFieldError(form.formState.errors.title)}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="dash-notif-msg">Mensaje</Label>
          <Textarea
            id="dash-notif-msg"
            rows={3}
            placeholder="Texto del aviso"
            aria-invalid={!!form.formState.errors.message}
            {...form.register('message')}
          />
          {form.formState.errors.message && (
            <span className="text-xs text-destructive">
              {renderFieldError(form.formState.errors.message)}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select
            value={form.watch('notificationType')}
            onValueChange={(v) => form.setValue('notificationType', v as NotificationType)}
          >
            <SelectTrigger aria-invalid={!!form.formState.errors.notificationType}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Al hacer clic en el aviso</Label>
          <Select
            value={linkTarget}
            onValueChange={(v) => {
              const target = v as NotificationLinkTarget;
              form.setValue('linkTarget', target);
              if (target !== 'student') form.setValue('studentId', undefined);
              if (target !== 'group') form.setValue('groupId', '');
            }}
          >
            <SelectTrigger aria-invalid={!!form.formState.errors.linkTarget}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Solo mostrar mensaje (sin ir a alumno/grupo)</SelectItem>
              <SelectItem value="student">Abrir perfil de un alumno</SelectItem>
              <SelectItem value="group">Abrir un grupo</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-foreground-subtle">
            Podés elegir <strong>como máximo uno</strong>: alumno <em>o</em> grupo, o ninguno. Solo
            aparecen alumnos y cursos de <strong>tu liceo</strong>
            {linkTarget === 'student' || linkTarget === 'group'
              ? ' (docentes: solo los cursos que tenés asignados en Mis grupos)'
              : ''}
            .
          </p>
        </div>

        {linkOptionsLoadFailed && (
          <p className="text-xs text-destructive">
            No se pudieron cargar alumnos/grupos. Revisá que la migración del catálogo esté aplicada.
          </p>
        )}

        {linkTarget === 'student' && (
          <div className="space-y-1">
            <Label>Alumno</Label>
            <Select
              value={form.watch('studentId')?.toString() ?? ''}
              onValueChange={(v) => form.setValue('studentId', Number.parseInt(v, 10))}
            >
              <SelectTrigger aria-invalid={!!form.formState.errors.studentId}>
                <SelectValue placeholder="Elegí un alumno" />
              </SelectTrigger>
              <SelectContent>
                {studentLinkOptions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name} (ID {s.id}) — {s.groupName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.studentId && (
              <span className="text-xs text-destructive">
                {renderFieldError(form.formState.errors.studentId)}
              </span>
            )}
          </div>
        )}

        {linkTarget === 'group' && (
          <div className="space-y-1">
            <Label>Grupo</Label>
            <Select value={form.watch('groupId')} onValueChange={(v) => form.setValue('groupId', v)}>
              <SelectTrigger aria-invalid={!!form.formState.errors.groupId}>
                <SelectValue placeholder="Elegí un grupo" />
              </SelectTrigger>
              <SelectContent>
                {groupLinkOptions.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} (ID {g.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.groupId && (
              <span className="text-xs text-destructive">
                {renderFieldError(form.formState.errors.groupId)}
              </span>
            )}
          </div>
        )}

        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Publicar aviso'}
        </Button>
      </form>
    </details>
  );
}
