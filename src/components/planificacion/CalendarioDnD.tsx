import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Lock, Play, Pause, X } from 'lucide-react';
import { SesionClase } from '@/types/planificacion';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface CalendarioDnDProps {
  mesActual: Date;
  sesiones: SesionClase[];
  onCambiarMes: (direccion: 1 | -1) => void;
  onAgendarSesion: (sesionId: string, fecha: string) => Promise<void>;
  onMoverSesion: (sesionId: string, nuevaFecha: string) => Promise<void>;
  onMarcarDictada: (sesionId: string) => Promise<void>;
  onPausarSesion: (sesionId: string) => Promise<void>;
  onOmitirSesion: (sesionId: string, motivo: string) => Promise<void>;
  onToggleLock: (sesionId: string) => Promise<void>;
  onSesionSelect: (sesion: SesionClase) => void;
}

export const CalendarioDnD: React.FC<CalendarioDnDProps> = ({
  mesActual,
  sesiones,
  onCambiarMes,
  onAgendarSesion,
  onMoverSesion,
  onMarcarDictada,
  onPausarSesion,
  onOmitirSesion,
  onToggleLock,
  onSesionSelect
}) => {
  const { toast } = useToast();
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const inicio = startOfMonth(mesActual);
  const fin = endOfMonth(mesActual);
  const diasDelMes = eachDayOfInterval({ start: inicio, end: fin });

  // Agrupar sesiones por fecha
  const sesionesPorFecha = sesiones
    .filter(s => s.fecha && s.estado !== 'backlog')
    .reduce((acc, sesion) => {
      const fecha = sesion.fecha!;
      if (!acc[fecha]) acc[fecha] = [];
      acc[fecha].push(sesion);
      return acc;
    }, {} as Record<string, SesionClase[]>);

  const handleDragOver = (e: React.DragEvent, fecha: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(fecha);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = async (e: React.DragEvent, fecha: string) => {
    e.preventDefault();
    setDragOverDate(null);

    const sesionId = e.dataTransfer.getData('sesionId');
    if (!sesionId) return;

    const sesion = sesiones.find(s => s.id === sesionId);
    if (!sesion) return;

    try {
      if (sesion.estado === 'backlog') {
        await onAgendarSesion(sesionId, fecha);
        toast({
          title: "Sesión agendada",
          description: `Sesión movida al ${format(new Date(fecha), 'PPP', { locale: es })}`
        });
      } else if (sesion.fecha) {
        await onMoverSesion(sesionId, fecha);
        toast({
          title: "Sesión movida",
          description: `Sesión reagendada al ${format(new Date(fecha), 'PPP', { locale: es })}`
        });
      }
    } catch (error) {
      console.error('Error al mover sesión:', error);
      toast({
        title: "Error",
        description: "No se pudo mover la sesión",
        variant: "destructive"
      });
    }
  };

  const getEstadoBadge = (estado: SesionClase['estado']) => {
    switch (estado) {
      case 'dictada':
        return <Badge className="bg-green-600 hover:bg-green-700">Dictada</Badge>;
      case 'pausada':
        return <Badge variant="secondary">Pausada</Badge>;
      case 'omitida':
        return <Badge variant="destructive">Omitida</Badge>;
      case 'planificada':
        return <Badge variant="outline">Planificada</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendario
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCambiarMes(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {format(mesActual, 'MMMM yyyy', { locale: es })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCambiarMes(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {/* Encabezados de días */}
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => (
            <div key={dia} className="text-center text-xs font-medium text-muted-foreground p-2">
              {dia}
            </div>
          ))}

          {/* Espacios vacíos al inicio */}
          {Array.from({ length: (getDay(inicio) + 6) % 7 }).map((_, i) => (
            <div key={`empty-${i}`} className="p-1" />
          ))}

          {/* Días del mes */}
          {diasDelMes.map((dia) => {
            const fechaISO = format(dia, 'yyyy-MM-dd');
            const sesionesDia = sesionesPorFecha[fechaISO] || [];
            const isDragOver = dragOverDate === fechaISO;

            return (
              <div
                key={fechaISO}
                onDragOver={(e) => handleDragOver(e, fechaISO)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, fechaISO)}
                className={cn(
                  "min-h-[100px] p-2 border rounded-lg transition-colors",
                  isDragOver && "bg-primary/10 border-primary",
                  sesionesDia.length > 0 && "bg-accent/50"
                )}
              >
                <div className="text-xs font-medium mb-1">{format(dia, 'd')}</div>
                <div className="space-y-1">
                  {sesionesDia.map((sesion) => (
                    <div
                      key={sesion.id}
                      draggable={!sesion.bloqueo_reserva}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('sesionId', sesion.id);
                      }}
                      onClick={() => {
                        console.log('=== CLIC EN SESIÓN DEL CALENDARIO ===');
                        console.log('Sesión seleccionada:', sesion);
                        console.log('ID de sesión:', sesion.id);
                        console.log('Fecha de sesión:', sesion.fecha);
                        console.log('Estado de sesión:', sesion.estado);
                        console.log('Plan desarrollo:', sesion.plan_desarrollo);
                        console.log('HTML completo:', sesion.plan_desarrollo?.html_completo);
                        console.log('Argumento competencias:', sesion.argumento_competencias);
                        console.log('Recursos:', sesion.recursos);
                        console.log('=====================================');
                        onSesionSelect(sesion);
                      }}
                      className={cn(
                        "text-xs p-1 rounded cursor-pointer hover:bg-accent",
                        sesion.estado === 'dictada' && "bg-green-100 line-through",
                        sesion.estado === 'pausada' && "bg-yellow-100 opacity-60",
                        sesion.estado === 'omitida' && "bg-red-100 line-through",
                        sesion.bloqueo_reserva && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {sesion.bloqueo_reserva && <Lock className="h-3 w-3" />}
                        <span className="truncate">{sesion.titulo || `S${sesion.orden}`}</span>
                      </div>
                      {getEstadoBadge(sesion.estado)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
