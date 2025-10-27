import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SesionClase } from '@/types/planificacion';

interface CalendarioSesionesProps {
  mesActual: Date;
  sesiones: SesionClase[];
  sesionSeleccionada?: SesionClase | null;
  onSesionSelect: (sesion: SesionClase) => void;
  onCambiarMes: (direccion: 'anterior' | 'siguiente') => void;
  onMarcarExcepcion: (sesionId: string, motivo: string) => void;
}

export const CalendarioSesiones: React.FC<CalendarioSesionesProps> = ({
  mesActual,
  sesiones,
  sesionSeleccionada,
  onSesionSelect,
  onCambiarMes,
  onMarcarExcepcion
}) => {
  // Obtener días del mes
  const inicioMes = startOfMonth(mesActual);
  const finMes = endOfMonth(mesActual);
  const diasMes = eachDayOfInterval({ start: inicioMes, end: finMes });

  // Filtrar sesiones del mes actual
  const sesionesMes = sesiones.filter(sesion => {
    const fechaSesion = new Date(sesion.fecha);
    return fechaSesion >= inicioMes && fechaSesion <= finMes;
  });

  // Obtener sesión por fecha
  const getSesionPorFecha = (fecha: Date) => {
    return sesionesMes.find(sesion => 
      isSameDay(new Date(sesion.fecha), fecha)
    );
  };

  // Renderizar día del calendario
  const renderDia = (dia: Date) => {
    const sesion = getSesionPorFecha(dia);
    const esHoy = isToday(dia);
    const esSesionSeleccionada = sesion && sesionSeleccionada?.id === sesion.id;

    return (
      <div
        key={dia.toISOString()}
        className={cn(
          "min-h-24 p-2 border border-border cursor-pointer transition-colors",
          esHoy && "bg-primary/5 border-primary/20",
          esSesionSeleccionada && "ring-2 ring-primary",
          !sesion && "hover:bg-muted/50",
          sesion && "hover:bg-accent/50"
        )}
        onClick={() => sesion && onSesionSelect(sesion)}
      >
        {/* Número del día */}
        <div className={cn(
          "text-sm font-medium mb-1",
          esHoy && "text-primary font-bold"
        )}>
          {format(dia, 'd')}
        </div>

        {/* Sesión si existe */}
        {sesion && (
          <div className="space-y-1">
            <div className={cn(
              "text-xs p-1 rounded text-center font-medium",
              sesion.estado === 'backlog' && "bg-gray-100 text-gray-800",
              sesion.estado === 'planificada' && "bg-blue-100 text-blue-800",
              sesion.estado === 'dictada' && "bg-green-100 text-green-800",
              sesion.estado === 'pausada' && "bg-yellow-100 text-yellow-800",
              sesion.estado === 'omitida' && "bg-red-100 text-red-800"
            )}>
              {sesion.duracion_minutos}min
            </div>

            {/* Indicadores */}
            <div className="flex flex-wrap gap-1">
              {sesion.competencias_anep.length === 0 && (
                <div title="Sin competencias">
                  <AlertTriangle className="h-3 w-3 text-orange-500" />
                </div>
              )}
              {sesion.estado === 'dictada' && (
                <div title="Dictada">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                </div>
              )}
              {sesion.es_feriado && (
                <Badge variant="destructive" className="text-xs py-0">Feriado</Badge>
              )}
            </div>

            {/* Chips de Competencias */}
            {sesion.competencias_anep.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {sesion.competencias_anep.slice(0, 2).map((comp, index) => (
                  <Badge key={index} variant="outline" className="text-xs px-1 py-0 h-4 text-[10px]">
                    {comp.length > 8 ? `${comp.substring(0, 6)}...` : comp}
                  </Badge>
                ))}
                {sesion.competencias_anep.length > 2 && (
                  <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-[10px]">
                    +{sesion.competencias_anep.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {format(mesActual, 'MMMM yyyy', { locale: es })}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCambiarMes('anterior')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCambiarMes('siguiente')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Estadísticas del mes */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{sesionesMes.length} sesiones</span>
          <span>{sesionesMes.filter(s => s.estado === 'backlog').length} backlog</span>
          <span>{sesionesMes.filter(s => s.estado === 'planificada').length} planificadas</span>
          <span>{sesionesMes.filter(s => s.estado === 'dictada').length} dictadas</span>
          {sesionesMes.filter(s => s.es_feriado).length > 0 && (
            <span className="text-orange-600">
              {sesionesMes.filter(s => s.es_feriado).length} feriados
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Encabezados de días */}
        <div className="grid grid-cols-7 border-b">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(dia => (
            <div key={dia} className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
              {dia}
            </div>
          ))}
        </div>

        {/* Días del calendario */}
        <div className="grid grid-cols-7">
          {diasMes.map(renderDia)}
        </div>
      </CardContent>
    </Card>
  );
};