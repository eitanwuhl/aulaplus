import { Loader2 } from 'lucide-react';

export function AuthRouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-foreground-subtle">
      <Loader2 className="h-5 w-5 animate-spin" />
      Cargando sesión…
    </div>
  );
}
