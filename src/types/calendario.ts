export interface CalendarioEvento {
  id: string;
  fecha: string;
  titulo: string;
  alcance: 'institucional' | 'grupo' | 'personal';
  created_at: string;
}
