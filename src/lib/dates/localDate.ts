/** Parse YYYY-MM-DD as local midnight (avoids UTC offset shifts). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD in local time. */
export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today at local midnight. */
export function todayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function compareIsoDates(a: string, b: string): number {
  return parseLocalDate(a).getTime() - parseLocalDate(b).getTime();
}
