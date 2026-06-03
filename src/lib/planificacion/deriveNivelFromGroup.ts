/** Derives planificaciones.nivel from school group year label (e.g. "9º Año" → "9"). */
export function deriveNivelFromGroupYear(yearLabel?: string | null): string {
  if (!yearLabel?.trim()) return 'CB';

  const match = yearLabel.match(/(\d+)/);
  if (match) return match[1];

  const lower = yearLabel.toLowerCase();
  if (lower.includes('inicial')) return 'inicial';
  if (lower.includes('primaria')) return 'primaria';
  if (lower.includes('bachillerato') || lower.includes('ems')) return 'EMS';

  return 'CB';
}
