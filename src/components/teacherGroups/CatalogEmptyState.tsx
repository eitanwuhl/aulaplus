import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

type CatalogEmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
};

export function CatalogEmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: CatalogEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <Icon className="mb-4 h-10 w-10 text-foreground-subtle" />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-foreground-subtle">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
