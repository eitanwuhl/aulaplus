import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, GripVertical } from 'lucide-react';
import { SesionClase } from '@/types/planificacion';
import { cn } from '@/lib/utils';

interface BacklogSesionesProps {
  sesiones: SesionClase[];
  onSesionSelect: (sesion: SesionClase) => void;
  sesionSeleccionada: SesionClase | null;
}

export const BacklogSesiones: React.FC<BacklogSesionesProps> = ({
  sesiones,
  onSesionSelect,
  sesionSeleccionada
}) => {
  const sesionesBacklog = sesiones.filter(s => s.estado === 'backlog').sort((a, b) => a.orden - b.orden);

  const handleDragStart = (e: React.DragEvent, sesion: SesionClase) => {
    e.dataTransfer.setData('sesionId', sesion.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Backlog</span>
          <Badge variant="secondary">{sesionesBacklog.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {sesionesBacklog.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No hay sesiones pendientes de agendar
            </div>
          ) : (
            sesionesBacklog.map((sesion) => (
              <div
                key={sesion.id}
                draggable
                onDragStart={(e) => handleDragStart(e, sesion)}
                onClick={() => onSesionSelect(sesion)}
                className={cn(
                  "p-3 border rounded-lg cursor-move hover:bg-accent transition-colors",
                  sesionSeleccionada?.id === sesion.id && "bg-accent border-primary"
                )}
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-sm truncate">
                        {sesion.titulo || `Sesión ${sesion.orden}`}
                      </h4>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="h-3 w-3" />
                        {sesion.duracion_minutos}min
                      </div>
                    </div>
                    {sesion.contenidos_anep && sesion.contenidos_anep.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {sesion.contenidos_anep[0]}
                      </p>
                    )}
                    {sesion.competencias_anep && sesion.competencias_anep.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {sesion.competencias_anep.length} comp.
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
