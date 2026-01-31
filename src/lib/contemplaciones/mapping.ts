import {
  getContemplacionById,
  normalizeContemplacionId,
  type Contemplacion,
  type MaterializacionTipo
} from './catalog';

export type ContemplacionBucket =
  | 'INSTRUMENT_DESIGN'
  | 'ADMIN_REMINDER'
  | 'CORRECTION_REMINDER'
  | 'CONTENT_ADAPTATION_EXCEPTION';

const MATERIALIZACION_BUCKET_MAP: Partial<Record<MaterializacionTipo, ContemplacionBucket>> = {
  diseño_cuadernillo: 'INSTRUMENT_DESIGN',
  norma_formato: 'INSTRUMENT_DESIGN',
  recordatorio_docente: 'ADMIN_REMINDER',
  regla_correccion: 'CORRECTION_REMINDER'
};

function collectBucketsForContemplacion(contemplacion: Contemplacion): ContemplacionBucket[] {
  const buckets = new Set<ContemplacionBucket>();

  for (const materializacion of contemplacion.materializaciones) {
    if (materializacion.contexto !== 'evaluacion' && materializacion.contexto !== 'ambos') {
      continue;
    }

    const bucket = MATERIALIZACION_BUCKET_MAP[materializacion.tipo];
    if (bucket) {
      buckets.add(bucket);
    }
  }

  return Array.from(buckets);
}

export function mapSelectedContemplacionesToBuckets(ids: string[]): Map<ContemplacionBucket, string[]> {
  const result = new Map<ContemplacionBucket, string[]>();

  for (const rawId of ids) {
    const normalizedId = normalizeContemplacionId(rawId);
    const contemplacion = getContemplacionById(normalizedId);
    if (!contemplacion) continue;

    const buckets = collectBucketsForContemplacion(contemplacion);
    for (const bucket of buckets) {
      const existing = result.get(bucket) || [];
      if (!existing.includes(normalizedId)) {
        result.set(bucket, [...existing, normalizedId]);
      }
    }
  }

  return result;
}

