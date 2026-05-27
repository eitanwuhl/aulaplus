import type { CatalogItemType, CurriculumFramework } from '@/types/institution';

export type CatalogCsvRow = {
  tipo: CatalogItemType;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  nivel: string | null;
  materia: string | null;
  parent_codigo: string | null;
  orden: number;
};

const VALID_TYPES: CatalogItemType[] = [
  'competencia_general',
  'espacio_curricular',
  'materia',
  'tramo',
  'contenido',
  'progresion',
  'learning_objective',
  'strand',
  'criterio',
  'descriptor',
  'key_concept',
  'global_context',
  'other',
];

const HEADER_ALIASES: Record<string, keyof CatalogCsvRow> = {
  tipo: 'tipo',
  type: 'tipo',
  codigo: 'codigo',
  code: 'codigo',
  nombre: 'nombre',
  name: 'nombre',
  descripcion: 'descripcion',
  description: 'descripcion',
  nivel: 'nivel',
  level: 'nivel',
  materia: 'materia',
  subject: 'materia',
  parent_codigo: 'parent_codigo',
  parent_code: 'parent_codigo',
  parent: 'parent_codigo',
  orden: 'orden',
  order: 'orden',
};

export function isInternationalFramework(fw: CurriculumFramework): boolean {
  return fw.startsWith('cambridge_') || fw.startsWith('ib_');
}

export function parseCatalogCsv(text: string): { rows: CatalogCsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ['El archivo debe tener encabezado y al menos una fila de datos.'] };
  }

  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, '_')
  );

  const colIndex: Partial<Record<keyof CatalogCsvRow, number>> = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key) colIndex[key] = i;
  });

  if (colIndex.tipo === undefined || colIndex.nombre === undefined) {
    return {
      rows: [],
      errors: ['Faltan columnas obligatorias: tipo, nombre (o type, name).'],
    };
  }

  const rows: CatalogCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delimiter);
    const get = (key: keyof CatalogCsvRow) => {
      const idx = colIndex[key];
      return idx !== undefined ? (cells[idx] ?? '').trim() : '';
    };

    const tipoRaw = get('tipo').toLowerCase();
    const tipo = VALID_TYPES.includes(tipoRaw as CatalogItemType)
      ? (tipoRaw as CatalogItemType)
      : 'other';

    if (tipoRaw && !VALID_TYPES.includes(tipoRaw as CatalogItemType)) {
      errors.push(`Fila ${i + 1}: tipo "${tipoRaw}" no reconocido, se guardó como other.`);
    }

    const nombre = get('nombre');
    if (!nombre) {
      errors.push(`Fila ${i + 1}: nombre vacío, omitida.`);
      continue;
    }

    const ordenRaw = get('orden');
    const orden = ordenRaw ? parseInt(ordenRaw, 10) : i;

    rows.push({
      tipo,
      codigo: get('codigo') || null,
      nombre,
      descripcion: get('descripcion') || null,
      nivel: get('nivel') || null,
      materia: get('materia') || null,
      parent_codigo: get('parent_codigo') || null,
      orden: Number.isFinite(orden) ? orden : i,
    });
  }

  return { rows, errors };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Semantic version compare for catalog version strings (e.g. 2026.1, 1.2.0). */
export function compareCatalogVersions(a: string, b: string): number {
  const pa = a.split(/[.\-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.split(/[.\-]/).map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}
