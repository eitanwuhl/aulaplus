import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash2, ChevronDown, ChevronUp, Clock, Target, BookOpen } from 'lucide-react';
import { UnidadDidactica } from '@/types/planificacion';
import { Materia, contenidosPorMateria, getSubtemaPorId } from '@/data/catalogo';
import { 
  COMPETENCIAS_HISTORIA, 
  getCompetenciasEspecificas 
} from '@/data/competencias';
import { COMPETENCIAS_LITERATURA } from '@/data/competenciasLiteratura';
import { COMPETENCIAS_CIUDADANIA } from '@/data/competenciasCiudadania';

interface UnidadCardProps {
  unidad: UnidadDidactica;
  materia: Materia;
  onActualizar: (unidad: UnidadDidactica) => void;
  onEliminar: () => void;
}

export const UnidadCard: React.FC<UnidadCardProps> = ({
  unidad,
  materia,
  onActualizar,
  onEliminar
}) => {
  const [expandida, setExpandida] = useState(false);

  const competencias = React.useMemo(() => {
    switch (materia) {
      case 'Historia':
        return COMPETENCIAS_HISTORIA;
      case 'Literatura':
        return COMPETENCIAS_LITERATURA;
      case 'Formación para la ciudadanía':
        return COMPETENCIAS_CIUDADANIA;
      default:
        return [];
    }
  }, [materia]);

  const contenidosDisponibles = React.useMemo(() => {
    const capitulos = contenidosPorMateria(materia);
    return capitulos.flatMap(cap => 
      cap.subtemas.map(sub => ({
        id: sub.id,
        texto: sub.contenido,
        capitulo: cap.titulo
      }))
    );
  }, [materia]);

  const contenidoSeleccionado = contenidosDisponibles.find(c => c.id === unidad.contenido_id);

  const actualizarContenido = (contenidoId: string) => {
    const contenido = contenidosDisponibles.find(c => c.id === contenidoId);
    if (contenido) {
      onActualizar({
        ...unidad,
        contenido_id: contenidoId,
        contenido_texto: contenido.texto
      });
    }
  };

  const toggleCompetencia = (competenciaId: string) => {
    const nuevasCompetencias = unidad.competencias_ids.includes(competenciaId)
      ? unidad.competencias_ids.filter(id => id !== competenciaId)
      : [...unidad.competencias_ids, competenciaId];
    
    onActualizar({
      ...unidad,
      competencias_ids: nuevasCompetencias
    });
  };

  const actualizarClases = (clases: number[]) => {
    onActualizar({
      ...unidad,
      clases_estimadas: clases[0]
    });
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Unidad {unidad.orden}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandida(!expandida)}
            >
              {expandida ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="text-sm">{expandida ? 'selecciona las competencias' : 'ver competencias'}</span>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onEliminar}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-3">
          {/* Selección de Contenido */}
          <div>
            <Label className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4" />
              Contenido ANEP
            </Label>
            <Select value={unidad.contenido_id} onValueChange={actualizarContenido}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar contenido del programa">
                  {contenidoSeleccionado ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate">
                            {contenidoSeleccionado.texto}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-sm">
                            <p className="font-medium">{contenidoSeleccionado.capitulo}</p>
                            <p className="text-sm">{contenidoSeleccionado.texto}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    'Seleccionar contenido'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {contenidosDisponibles.map((contenido) => (
                  <SelectItem key={contenido.id} value={contenido.id}>
                    <div>
                      <div className="text-xs text-muted-foreground">{contenido.capitulo}</div>
                      <div className="text-sm">{contenido.texto}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duración Estimada */}
          <div>
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Clases Estimadas: {unidad.clases_estimadas}
            </Label>
            <div className="mt-2 px-2">
              <Slider
                value={[unidad.clases_estimadas]}
                onValueChange={actualizarClases}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1 clase</span>
                <span>10 clases</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {expandida && (
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 text-sm font-medium mb-3">
                <Target className="h-4 w-4" />
                Competencias a Desarrollar ({unidad.competencias_ids.length} seleccionadas)
              </Label>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {competencias.map((competencia) => (
                  <div key={competencia.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={`comp-${unidad.id}-${competencia.id}`}
                      checked={unidad.competencias_ids.includes(competencia.id)}
                      onCheckedChange={() => toggleCompetencia(competencia.id)}
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor={`comp-${unidad.id}-${competencia.id}`}
                        className="text-sm cursor-pointer"
                      >
                        <Badge variant="outline" className="mr-2 text-xs">
                          {competencia.codigo}
                        </Badge>
                        {competencia.nombre}
                      </Label>
                      <div className="mt-1 space-x-1">
                        {competencia.criteriosLogro.map((criterio) => (
                          <Badge key={criterio.id} variant="secondary" className="text-xs">
                            {criterio.codigo}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};