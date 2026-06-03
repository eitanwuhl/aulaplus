import { Progress } from '@/components/ui/progress';
import type { ProgramCoverageSummary } from '@/types/annualProgram';

export function ProgramCoverageBar({
  coverage,
  label = 'Cobertura de contenidos',
}: {
  coverage: ProgramCoverageSummary;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {coverage.assignedCatalogItems}/{coverage.totalCatalogItems} ({coverage.percent}%)
        </span>
      </div>
      <Progress value={coverage.percent} className="h-2" />
      {coverage.uncoveredItemIds.length > 0 && coverage.totalCatalogItems > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Faltan {coverage.uncoveredItemIds.length} contenido(s) del catálogo por asignar a una unidad.
        </p>
      )}
    </div>
  );
}
