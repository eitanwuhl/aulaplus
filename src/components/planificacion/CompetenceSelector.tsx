import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { COMPETENCIAS_HISTORIA, getCompetenciasEspecificas } from '@/data/competencias';
import { COMPETENCIAS_LITERATURA, getCompetenciasEspecificasLiteratura } from '@/data/competenciasLiteratura';
import { CATALOGO_JERARQUICO, contenidosPorMateria, type Materia } from '@/data/catalogo';

interface CompetenceSelectorProps {
  materia: string;
  competenciasSeleccionadas: string[];
  contenidosPrograma: string;
  mapeoCompetenciasContenidos: Record<string, string[]>;
  onCompetenciasChange: (competencias: string[]) => void;
  onContenidosChange: (contenidos: string) => void;
  onMapeoChange: (mapeo: Record<string, string[]>) => void;
}

export const CompetenceSelector: React.FC<CompetenceSelectorProps> = ({
  materia,
  competenciasSeleccionadas,
  contenidosPrograma,
  mapeoCompetenciasContenidos,
  onCompetenciasChange,
  onContenidosChange,
  onMapeoChange
}) => {
  const [openChapters, setOpenChapters] = React.useState<string[]>([]);
  
  const competencias = materia === 'Historia' 
    ? getCompetenciasEspecificas()
    : materia === 'Literatura' 
    ? getCompetenciasEspecificasLiteratura()
    : [];

  // Obtener contenidos del catálogo ANEP según la materia
  const materiaCatalogo = materia === 'Educación para la Ciudadanía' 
    ? 'Formación para la ciudadanía' as Materia
    : materia as Materia;
  
  const contenidosCatalogo = contenidosPorMateria(materiaCatalogo);
  
  // Convertir contenidos seleccionados de string a array de IDs
  const contenidosSeleccionados = contenidosPrograma.split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const toggleCompetencia = (competenciaId: string) => {
    const nuevasCompetencias = competenciasSeleccionadas.includes(competenciaId)
      ? competenciasSeleccionadas.filter(id => id !== competenciaId)
      : [...competenciasSeleccionadas, competenciaId];
    
    onCompetenciasChange(nuevasCompetencias);
  };

  const toggleContenido = (contenidoId: string, contenidoTexto: string) => {
    let nuevosContenidos: string[] = [];
    
    if (contenidosSeleccionados.includes(contenidoId)) {
      // Remover contenido
      nuevosContenidos = contenidosSeleccionados.filter(id => id !== contenidoId);
    } else {
      // Agregar contenido
      nuevosContenidos = [...contenidosSeleccionados, contenidoId];
    }
    
    onContenidosChange(nuevosContenidos.join('\n'));
    
    // Actualizar mapeo removiendo referencias al contenido eliminado
    const nuevoMapeo = { ...mapeoCompetenciasContenidos };
    if (!nuevosContenidos.includes(contenidoId)) {
      delete nuevoMapeo[contenidoId];
      onMapeoChange(nuevoMapeo);
    }
  };

  const toggleCompetenciaEnContenido = (contenidoId: string, competenciaId: string) => {
    const competenciasDelContenido = mapeoCompetenciasContenidos[contenidoId] || [];
    const nuevoMapeo = { ...mapeoCompetenciasContenidos };
    
    if (competenciasDelContenido.includes(competenciaId)) {
      nuevoMapeo[contenidoId] = competenciasDelContenido.filter(id => id !== competenciaId);
    } else {
      nuevoMapeo[contenidoId] = [...competenciasDelContenido, competenciaId];
    }
    
    onMapeoChange(nuevoMapeo);
  };

  const toggleChapter = (chapterId: string) => {
    setOpenChapters(prev => 
      prev.includes(chapterId) 
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId]
    );
  };

  const getCompetenciaNombre = (id: string) => {
    const competencia = competencias.find(c => c.id === id);
    return competencia ? `${competencia.codigo}: ${competencia.nombre}` : id;
  };

  const getContenidoTextoById = (contenidoId: string) => {
    for (const capitulo of contenidosCatalogo) {
      const subtema = capitulo.subtemas.find(s => s.id === contenidoId);
      if (subtema) return subtema.contenido;
    }
    return contenidoId;
  };

  return (
    <div className="space-y-6">
      {/* Selección de Competencias */}
      <Card>
        <CardHeader>
          <CardTitle>Competencias a Desarrollar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {competencias.map((competencia) => (
              <div key={competencia.id} className="flex items-start space-x-3">
                <Checkbox
                  id={competencia.id}
                  checked={competenciasSeleccionadas.includes(competencia.id)}
                  onCheckedChange={() => toggleCompetencia(competencia.id)}
                />
                <div className="flex-1">
                  <Label htmlFor={competencia.id} className="font-medium">
                    {competencia.codigo}: {competencia.nombre}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {competencia.descripcion}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contenidos del Programa ANEP */}
      <Card>
        <CardHeader>
          <CardTitle>Contenidos del Programa ANEP</CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecciona los contenidos oficiales que trabajarás en este período
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contenidosCatalogo.map((capitulo) => (
              <Collapsible 
                key={capitulo.id}
                open={openChapters.includes(capitulo.id)}
                onOpenChange={() => toggleChapter(capitulo.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto text-left">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{capitulo.titulo}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {capitulo.subtemas.filter(sub => contenidosSeleccionados.includes(sub.id)).length} de {capitulo.subtemas.length} seleccionados
                      </p>
                    </div>
                    {openChapters.includes(capitulo.id) ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="space-y-2 pl-4 border-l-2 border-muted">
                    {capitulo.subtemas.map((subtema) => (
                      <div key={subtema.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={subtema.id}
                          checked={contenidosSeleccionados.includes(subtema.id)}
                          onCheckedChange={() => toggleContenido(subtema.id, subtema.contenido)}
                        />
                        <Label 
                          htmlFor={subtema.id} 
                          className="text-sm leading-relaxed flex-1"
                        >
                          {subtema.contenido}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mapeo Competencias-Contenidos */}
      {contenidosSeleccionados.length > 0 && competenciasSeleccionadas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Asignación de Competencias por Contenido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contenidosSeleccionados.map((contenidoId) => {
                const contenidoTexto = getContenidoTextoById(contenidoId);
                return (
                  <div key={contenidoId} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3 text-sm">{contenidoTexto}</h4>
                    <div className="space-y-2">
                      {competenciasSeleccionadas.map(competenciaId => (
                        <div key={competenciaId} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${contenidoId}-${competenciaId}`}
                            checked={mapeoCompetenciasContenidos[contenidoId]?.includes(competenciaId) || false}
                            onCheckedChange={() => toggleCompetenciaEnContenido(contenidoId, competenciaId)}
                          />
                          <Label 
                            htmlFor={`${contenidoId}-${competenciaId}`} 
                            className="text-sm"
                          >
                            {getCompetenciaNombre(competenciaId)}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {mapeoCompetenciasContenidos[contenidoId]?.length > 0 && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-1">
                          {mapeoCompetenciasContenidos[contenidoId].map(compId => {
                            const comp = competencias.find(c => c.id === compId);
                            return (
                              <Badge key={compId} variant="secondary" className="text-xs">
                                {comp?.codigo}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};