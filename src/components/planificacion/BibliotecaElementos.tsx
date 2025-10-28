import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Plus, BookOpen, Target } from 'lucide-react';
import { Materia, contenidosPorMateria } from '@/data/catalogo';
import { normalizeSubjectName } from '@/lib/subjectNormalizer';
import { 
  COMPETENCIAS_HISTORIA, 
  getCompetenciasEspecificas 
} from '@/data/competencias';
import { COMPETENCIAS_LITERATURA } from '@/data/competenciasLiteratura';
import { COMPETENCIAS_CIUDADANIA } from '@/data/competenciasCiudadania';

interface BibliotecaElementosProps {
  materia: Materia;
  contenidosUsados: string[];
  onSeleccionarContenido: (contenidoId: string, contenidoTexto: string) => void;
}

export const BibliotecaElementos: React.FC<BibliotecaElementosProps> = ({
  materia,
  contenidosUsados,
  onSeleccionarContenido
}) => {
  const [capitulosAbiertos, setCapitulosAbiertos] = useState<string[]>([]);

  const toggleCapitulo = (capituloId: string) => {
    setCapitulosAbiertos(prev =>
      prev.includes(capituloId)
        ? prev.filter(id => id !== capituloId)
        : [...prev, capituloId]
    );
  };

  // Normalizar materia para llamadas a catálogo y competencias
  const materiaNormalizada = normalizeSubjectName(materia);

  const capitulos = contenidosPorMateria(materiaNormalizada);
  
  const competencias = React.useMemo(() => {
    switch (materiaNormalizada) {
      case 'Historia':
        return COMPETENCIAS_HISTORIA;
      case 'Literatura':
        return COMPETENCIAS_LITERATURA;
      case 'Formación para la ciudadanía':
        return COMPETENCIAS_CIUDADANIA;
      default:
        return [];
    }
  }, [materiaNormalizada]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Contenidos ANEP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Contenidos del Programa ANEP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
          {capitulos.map((capitulo) => (
            <Collapsible
              key={capitulo.id}
              open={capitulosAbiertos.includes(capitulo.id)}
              onOpenChange={() => toggleCapitulo(capitulo.id)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost" 
                  className="w-full justify-between p-2 h-auto text-left"
                >
                  <span className="font-medium text-sm break-words">
                    {capitulo.titulo}
                  </span>
                  {capitulosAbiertos.includes(capitulo.id) ? 
                    <ChevronUp className="h-4 w-4 flex-shrink-0" /> : 
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  }
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-2 mt-2 ml-2">
                {capitulo.subtemas.map((subtema) => (
                  <TooltipProvider key={subtema.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-between p-2 border rounded text-sm hover:bg-muted/50">
                          <span className="flex-1 truncate pr-2">
                            {subtema.contenido}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSeleccionarContenido(subtema.id, subtema.contenido)}
                            disabled={contenidosUsados.includes(subtema.id)}
                            className="h-6 px-2 text-xs"
                          >
                            {contenidosUsados.includes(subtema.id) ? (
                              'Usado'
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Usar
                              </>
                            )}
                          </Button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{subtema.contenido}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {/* Competencias Específicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Competencias Específicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
          {competencias.map((competencia) => (
            <TooltipProvider key={competencia.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-3 border rounded-lg hover:bg-muted/30">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-xs">
                        {competencia.codigo}
                      </Badge>
                      <span className="text-sm flex-1 line-clamp-2">
                        {competencia.nombre}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {competencia.criteriosLogro.map((criterio) => (
                        <Badge key={criterio.id} variant="secondary" className="text-xs mr-1">
                          {criterio.codigo}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="max-w-sm">
                    <p className="font-medium">{competencia.codigo}: {competencia.nombre}</p>
                    <p className="text-sm mt-1">{competencia.descripcion}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};