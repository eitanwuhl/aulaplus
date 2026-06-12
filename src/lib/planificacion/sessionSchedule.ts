import { parseLocalDate } from '@/lib/dates/localDate';
import type { ConfiguracionHorario } from '@/types/planificacion';

const DIAS_SEMANA: Record<ConfiguracionHorario['dia'], number> = {
  lunes: 1,
  martes: 2,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
};

/** Session dates between fecha_inicio and fecha_fin on configured weekdays. */
export function generateSessionDatesFromSchedule(input: {
  fecha_inicio: string;
  fecha_fin: string;
  configuracion: ConfiguracionHorario[];
}): Date[] {
  const fechas: Date[] = [];
  const inicio = parseLocalDate(input.fecha_inicio);
  const fin = parseLocalDate(input.fecha_fin);
  const fechaActual = new Date(inicio);

  while (fechaActual <= fin) {
    const diaActual = fechaActual.getDay();
    const hayClase = input.configuracion.some(
      (config) => DIAS_SEMANA[config.dia] === diaActual
    );
    if (hayClase) {
      fechas.push(new Date(fechaActual));
    }
    fechaActual.setDate(fechaActual.getDate() + 1);
  }

  return fechas;
}
