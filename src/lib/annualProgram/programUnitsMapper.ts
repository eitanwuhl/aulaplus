import type { CatalogItemForPlanning, ProgramaUnidad } from '@/types/annualProgram';
import type { UnidadDidactica } from '@/types/planificacion';

/** Map programa unidades → wizard unidades_didacticas */
export function programUnitsToWizardUnits(
  unidades: ProgramaUnidad[],
  catalogById: Map<string, CatalogItemForPlanning>
): UnidadDidactica[] {
  return [...unidades]
    .sort((a, b) => a.orden - b.orden)
    .map((u, index) => {
      const firstCatalogId = u.catalog_item_ids?.[0];
      const catalogItem = firstCatalogId ? catalogById.get(firstCatalogId) : undefined;
      const extraLabels = (u.catalog_item_ids ?? [])
        .slice(1)
        .map((id) => catalogById.get(id)?.nombre)
        .filter(Boolean);

      const contenidoTexto =
        u.descripcion?.trim() ||
        [u.nombre, catalogItem?.nombre, ...extraLabels].filter(Boolean).join(' · ');

      return {
        id: u.id,
        contenido_id: firstCatalogId ?? u.id,
        contenido_texto: contenidoTexto,
        competencias_ids: u.competencias_ids ?? [],
        clases_estimadas: u.clases_estimadas,
        orden: index + 1,
      };
    });
}
