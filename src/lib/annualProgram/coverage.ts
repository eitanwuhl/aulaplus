import type { CatalogItemForPlanning, ProgramCoverageSummary, ProgramaUnidad } from '@/types/annualProgram';

/** Contenidos del catálogo que cuentan para cobertura del programa anual. */
export function filterCoverageCatalogItems(
  items: CatalogItemForPlanning[],
  materia?: string
): CatalogItemForPlanning[] {
  const coverageTypes = new Set(['contenido', 'progresion', 'learning_objective']);
  return items.filter((item) => {
    if (!coverageTypes.has(item.tipo)) return false;
    if (!materia?.trim()) return true;
    const m = item.materia?.toLowerCase() ?? '';
    const target = materia.toLowerCase();
    return m.includes(target) || target.includes(m) || item.nombre.toLowerCase().includes(target);
  });
}

export function computeProgramCoverage(
  catalogItems: CatalogItemForPlanning[],
  unidades: ProgramaUnidad[],
  materia?: string
): ProgramCoverageSummary {
  const pool = filterCoverageCatalogItems(catalogItems, materia);
  const totalIds = new Set(pool.map((i) => i.id));
  const assigned = new Set<string>();

  for (const unidad of unidades) {
    for (const id of unidad.catalog_item_ids ?? []) {
      if (totalIds.has(id)) assigned.add(id);
    }
  }

  const totalCatalogItems = totalIds.size;
  const assignedCatalogItems = assigned.size;
  const percent =
    totalCatalogItems === 0 ? 0 : Math.round((assignedCatalogItems / totalCatalogItems) * 100);

  const uncoveredItemIds = [...totalIds].filter((id) => !assigned.has(id));

  return {
    totalCatalogItems,
    assignedCatalogItems,
    percent,
    uncoveredItemIds,
  };
}
