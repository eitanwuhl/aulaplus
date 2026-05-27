/**
 * Module 1 — catalog versioning & bulk import (Cambridge / IB).
 */

import { supabase } from '@/integrations/supabase/client';
import type { CatalogCsvRow } from '@/lib/institution/parseCatalogCsv';
import type { CatalogItemType, CatalogStatus, CurriculumFramework } from '@/types/institution';

export type CurriculumCatalogRow = {
  id: string;
  framework: CurriculumFramework;
  nombre: string;
  version: string;
  vigente_desde: string;
  vigente_hasta: string | null;
  estado: CatalogStatus;
  school_id: string | null;
  metadata: Record<string, unknown>;
  itemCount?: number;
};

const BATCH_SIZE = 80;
type CatalogItemCountRow = { catalog_id: string };

export async function fetchSchoolCatalogVersions(
  schoolId: string
): Promise<{ data?: CurriculumCatalogRow[]; error?: string }> {
  const { data: globalCats, error: gErr } = await supabase
    .from('curriculum_catalogs')
    .select('id, framework, nombre, version, vigente_desde, vigente_hasta, estado, school_id, metadata')
    .is('school_id', null)
    .order('framework')
    .order('version', { ascending: false });

  if (gErr) return { error: gErr.message };

  const { data: schoolCats, error: sErr } = await supabase
    .from('curriculum_catalogs')
    .select('id, framework, nombre, version, vigente_desde, vigente_hasta, estado, school_id, metadata')
    .eq('school_id', schoolId)
    .order('framework')
    .order('version', { ascending: false });

  if (sErr) return { error: sErr.message };

  const all = [...(schoolCats ?? []), ...(globalCats ?? [])] as CurriculumCatalogRow[];

  const catalogIds = all.map((cat) => cat.id);
  const countsByCatalog = new Map<string, number>();
  if (catalogIds.length > 0) {
    const { data: itemRows, error: countsErr } = await supabase
      .from('curriculum_catalog_items')
      .select('catalog_id')
      .in('catalog_id', catalogIds);
    if (countsErr) return { error: countsErr.message };
    for (const row of (itemRows ?? []) as CatalogItemCountRow[]) {
      countsByCatalog.set(row.catalog_id, (countsByCatalog.get(row.catalog_id) ?? 0) + 1);
    }
  }

  const withCounts: CurriculumCatalogRow[] = all.map((cat) => ({
    ...cat,
    itemCount: countsByCatalog.get(cat.id) ?? 0,
  }));

  return { data: withCounts };
}

export async function createCatalogDraft(input: {
  schoolId: string;
  framework: CurriculumFramework;
  nombre: string;
  version: string;
  cloneFromCatalogId?: string;
}): Promise<{ data?: { catalogId: string }; error?: string }> {
  const { data: inserted, error } = await supabase
    .from('curriculum_catalogs')
    .insert({
      framework: input.framework,
      nombre: input.nombre,
      version: input.version,
      estado: 'borrador',
      school_id: input.schoolId,
      metadata: { source: 'school_upload', created_by: 'institution_ui' },
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  const catalogId = inserted.id as string;

  if (input.cloneFromCatalogId) {
    const cloneRes = await cloneCatalogItems(input.cloneFromCatalogId, catalogId);
    if (cloneRes.error) return { error: cloneRes.error };
  }

  return { data: { catalogId } };
}

async function cloneCatalogItems(
  sourceCatalogId: string,
  targetCatalogId: string
): Promise<{ error?: string }> {
  const { data: items, error } = await supabase
    .from('curriculum_catalog_items')
    .select('id, tipo, codigo, nombre, descripcion, nivel, materia, parent_id, orden, metadata')
    .eq('catalog_id', sourceCatalogId)
    .order('orden');

  if (error) return { error: error.message };
  if (!items?.length) return {};

  const idMap = new Map<string, string>();
  const pending = [...items].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  let insertedInLastPass = -1;

  while (pending.length > 0 && insertedInLastPass !== 0) {
    insertedInLastPass = 0;
    const remaining: typeof pending = [];

    for (const item of pending) {
      const oldId = item.id as string;
      const parentOld = item.parent_id as string | null;
      if (parentOld && !idMap.has(parentOld)) {
        remaining.push(item);
        continue;
      }

      const parentNew = parentOld ? idMap.get(parentOld) ?? null : null;
      const { data: row, error: insErr } = await supabase
        .from('curriculum_catalog_items')
        .insert({
          catalog_id: targetCatalogId,
          tipo: item.tipo,
          codigo: item.codigo,
          nombre: item.nombre,
          descripcion: item.descripcion,
          nivel: item.nivel,
          materia: item.materia,
          parent_id: parentNew,
          orden: item.orden,
          metadata: item.metadata ?? {},
        })
        .select('id')
        .single();

      if (insErr) return { error: insErr.message };
      if (oldId && row?.id) idMap.set(oldId, row.id as string);
      insertedInLastPass++;
    }

    pending.length = 0;
    pending.push(...remaining);
  }

  if (pending.length > 0) {
    return {
      error:
        'No se pudo clonar la jerarquía completa del catálogo (padres faltantes o referencia circular).',
    };
  }

  return {};
}

export async function activateCatalogVersion(
  schoolId: string,
  catalogId: string
): Promise<{ error?: string }> {
  const { data: catalog, error: catErr } = await supabase
    .from('curriculum_catalogs')
    .select('id, framework, school_id, estado')
    .eq('id', catalogId)
    .maybeSingle();

  if (catErr || !catalog) {
    return { error: catErr?.message ?? 'Catálogo no encontrado.' };
  }

  if (catalog.school_id !== schoolId) {
    return { error: 'Solo podés activar catálogos propios del liceo.' };
  }

  const framework = catalog.framework as CurriculumFramework;

  const { error: deprecateErr } = await supabase
    .from('curriculum_catalogs')
    .update({
      estado: 'deprecada',
      vigente_hasta: new Date().toISOString().slice(0, 10),
    })
    .eq('school_id', schoolId)
    .eq('framework', framework)
    .eq('estado', 'activa');

  if (deprecateErr) return { error: deprecateErr.message };

  const { error: activateErr } = await supabase
    .from('curriculum_catalogs')
    .update({
      estado: 'activa',
      vigente_desde: new Date().toISOString().slice(0, 10),
      vigente_hasta: null,
    })
    .eq('id', catalogId);

  if (activateErr) return { error: activateErr.message };

  const { error: linkErr } = await supabase
    .from('school_curriculum_frameworks')
    .update({ catalog_id: catalogId })
    .eq('school_id', schoolId)
    .eq('framework', framework);

  if (linkErr) return { error: linkErr.message };

  return {};
}

export async function importCatalogItemsFromCsv(
  catalogId: string,
  rows: CatalogCsvRow[]
): Promise<{ imported: number; error?: string }> {
  const { data: catalog, error: catErr } = await supabase
    .from('curriculum_catalogs')
    .select('id, estado, school_id')
    .eq('id', catalogId)
    .maybeSingle();

  if (catErr || !catalog) {
    return { imported: 0, error: catErr?.message ?? 'Catálogo no encontrado.' };
  }

  if (catalog.estado !== 'borrador') {
    return {
      imported: 0,
      error: 'Solo se puede importar en catálogos en estado borrador. Creá una nueva versión.',
    };
  }

  const codeToId = new Map<string, string>();
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    for (const row of chunk) {
      const parentId = row.parent_codigo ? codeToId.get(row.parent_codigo) ?? null : null;

      const { data: inserted, error } = await supabase
        .from('curriculum_catalog_items')
        .insert({
          catalog_id: catalogId,
          tipo: row.tipo as CatalogItemType,
          codigo: row.codigo,
          nombre: row.nombre,
          descripcion: row.descripcion,
          nivel: row.nivel,
          materia: row.materia,
          parent_id: parentId,
          orden: row.orden,
          metadata: {},
        })
        .select('id')
        .single();

      if (error) {
        return { imported, error: `${error.message} (fila: ${row.nombre})` };
      }

      if (row.codigo && inserted?.id) {
        codeToId.set(row.codigo, inserted.id as string);
      }
      imported++;
    }
  }

  return { imported };
}
