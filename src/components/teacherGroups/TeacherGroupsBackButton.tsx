import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TeacherGroupsBackButtonProps = {
  onClick: () => void;
  label: string;
  /** From dashboard notification deep-link: compact on small screens */
  fromPanel?: boolean;
  className?: string;
  variant?: 'outline' | 'ghost';
};

export function TeacherGroupsBackButton({
  onClick,
  label,
  fromPanel = false,
  className,
  variant = 'outline',
}: TeacherGroupsBackButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn('mb-4 flex items-center gap-2', className)}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {fromPanel ? (
        <>
          <span className="sm:hidden">Volver</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </Button>
  );
}
