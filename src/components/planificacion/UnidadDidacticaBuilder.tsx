import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { UnidadDidactica } from '@/types/planificacion';
import { Materia } from '@/data/catalogo';
import { BibliotecaElementos } from './BibliotecaElementos';
import { UnidadCard } from './UnidadCard';
import { ResumenPlanificacion } from './ResumenPlanificacion';

interface UnidadDidacticaBuilderProps {
  materia: Materia;
  unidades: UnidadDidactica[];
  onChange: (unidades: UnidadDidactica[]) => void;
  totalClasesDisponibles?: number;
  errorCompetencias?: string; // Error message for competencies validation
}

export const UnidadDidacticaBuilder: React.FC<UnidadDidacticaBuilderProps> = ({
  materia,
  unidades,
  onChange,
  totalClasesDisponibles = 0,
  errorCompetencias
}) => {
  
  const crearNuevaUnidad = () => {
    const nuevaUnidad: UnidadDidactica = {
      id: `unidad-${Date.now()}`,
      contenido_id: '',
      contenido_texto: '',
      competencias_ids: [],
      clases_estimadas: 1,
      orden: unidades.length + 1
    };
    
    onChange([...unidades, nuevaUnidad]);
  };

  const actualizarUnidad = (index: number, unidadActualizada: UnidadDidactica) => {
    const nuevasUnidades = [...unidades];
    nuevasUnidades[index] = unidadActualizada;
    onChange(nuevasUnidades);
  };

  const eliminarUnidad = (index: number) => {
    const nuevasUnidades = unidades.filter((_, i) => i !== index);
    // Reordenar
    nuevasUnidades.forEach((unidad, i) => {
      unidad.orden = i + 1;
    });
    onChange(nuevasUnidades);
  };

  const onSeleccionarContenido = (contenidoId: string, contenidoTexto: string) => {
    if (unidades.some(u => u.contenido_id === contenidoId)) {
      return; // Ya existe una unidad con este contenido
    }
    
    const nuevaUnidad: UnidadDidactica = {
      id: `unidad-${Date.now()}`,
      contenido_id: contenidoId,
      contenido_texto: contenidoTexto,
      competencias_ids: [],
      clases_estimadas: 2,
      orden: unidades.length + 1
    };
    
    onChange([...unidades, nuevaUnidad]);
  };

  const totalClasesAsignadas = unidades.reduce((total, unidad) => total + unidad.clases_estimadas, 0);

  return (
    <div className="space-y-6">
      {/* Panel Superior: Biblioteca de Elementos */}
      <BibliotecaElementos
        materia={materia}
        contenidosUsados={unidades.map(u => u.contenido_id)}
        onSeleccionarContenido={onSeleccionarContenido}
      />

      {/* Panel Central: Constructor de Unidades */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Unidades Didácticas del Período</CardTitle>
              <CardDescription>
                Construye las unidades combinando contenidos, competencias y tiempo estimado
              </CardDescription>
            </div>
            <Button onClick={crearNuevaUnidad} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Unidad
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {unidades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay unidades didácticas creadas aún.</p>
              <p className="text-sm mt-2">
                Selecciona un contenido de la biblioteca superior o crea una nueva unidad manualmente.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {unidades.map((unidad, index) => {
                // Show error only for units without competencies when global error exists
                const tieneCompetencias = unidad.competencias_ids && unidad.competencias_ids.length > 0;
                const mostrarError = errorCompetencias && !tieneCompetencias;
                
                return (
                  <UnidadCard
                    key={unidad.id}
                    unidad={unidad}
                    materia={materia}
                    onActualizar={(unidadActualizada) => actualizarUnidad(index, unidadActualizada)}
                    onEliminar={() => eliminarUnidad(index)}
                    errorCompetencias={mostrarError ? errorCompetencias : undefined}
                    forceOpenCompetencias={mostrarError}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel Inferior: Resumen y Validación */}
      <ResumenPlanificacion
        unidades={unidades}
        totalClasesDisponibles={totalClasesDisponibles}
        totalClasesAsignadas={totalClasesAsignadas}
        materia={materia}
      />
    </div>
  );
};