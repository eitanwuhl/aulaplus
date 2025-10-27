import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Clock, Target, BookOpen } from 'lucide-react';
import { UnidadDidactica } from '@/types/planificacion';
import { Materia } from '@/data/catalogo';
import { 
  COMPETENCIAS_HISTORIA, 
  getCompetenciasEspecificas 
} from '@/data/competencias';
import { COMPETENCIAS_LITERATURA } from '@/data/competenciasLiteratura';
import { COMPETENCIAS_CIUDADANIA } from '@/data/competenciasCiudadania';

interface ResumenPlanificacionProps {
  unidades: UnidadDidactica[];
  totalClasesDisponibles: number;
  totalClasesAsignadas: number;
  materia: Materia;
}

export const ResumenPlanificacion: React.FC<ResumenPlanificacionProps> = ({
  unidades,
  totalClasesDisponibles,
  totalClasesAsignadas,
  materia
}) => {

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

  // Análisis de competencias
  const competenciasUsadas = new Set(
    unidades.flatMap(u => u.competencias_ids)
  );

  const competenciasNoUsadas = competencias.filter(
    c => !competenciasUsadas.has(c.id)
  );

  // Validaciones
  const unidadesSinContenido = unidades.filter(u => !u.contenido_id);
  const unidadesSinCompetencias = unidades.filter(u => u.competencias_ids.length === 0);

  const porcentajeClasesUsadas = totalClasesDisponibles > 0 
    ? (totalClasesAsignadas / totalClasesDisponibles) * 100 
    : 0;

  const tieneErrores = unidadesSinContenido.length > 0 || unidadesSinCompetencias.length > 0;
  const excedeTiempo = totalClasesAsignadas > totalClasesDisponibles;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {tieneErrores || excedeTiempo ? (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          Resumen de la Planificación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Distribución de Tiempo */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Distribución de Tiempo
            </span>
            <Badge variant={excedeTiempo ? 'destructive' : 'secondary'}>
              {totalClasesAsignadas} / {totalClasesDisponibles} clases
            </Badge>
          </div>
          <Progress value={Math.min(porcentajeClasesUsadas, 100)} className="mb-2" />
          <p className="text-xs text-muted-foreground">
            {porcentajeClasesUsadas.toFixed(1)}% del período planificado
            {excedeTiempo && (
              <span className="text-destructive ml-2">
                (Se excede en {totalClasesAsignadas - totalClasesDisponibles} clases)
              </span>
            )}
          </p>
        </div>

        {/* Unidades Creadas */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <BookOpen className="h-4 w-4" />
            Unidades Didácticas ({unidades.length})
          </div>
          {unidades.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay unidades creadas aún</p>
          ) : (
            <div className="space-y-2">
              {unidades.map((unidad) => (
                <div key={unidad.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                  <span className="flex-1 truncate">
                    {unidad.contenido_texto || 'Contenido no seleccionado'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {unidad.competencias_ids.length} comp.
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {unidad.clases_estimadas} clases
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Competencias */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <Target className="h-4 w-4" />
            Competencias ({competenciasUsadas.size} de {competencias.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from(competenciasUsadas).map((competenciaId) => {
              const competencia = competencias.find(c => c.id === competenciaId);
              return competencia ? (
                <Badge key={competenciaId} variant="default" className="text-xs">
                  {competencia.codigo}
                </Badge>
              ) : null;
            })}
          </div>
          
          {competenciasNoUsadas.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                {competenciasNoUsadas.length} competencias sin asignar
              </summary>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {competenciasNoUsadas.map((competencia) => (
                  <Badge key={competencia.id} variant="outline" className="text-xs">
                    {competencia.codigo}
                  </Badge>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Alertas y Validaciones */}
        {(tieneErrores || excedeTiempo) && (
          <div className="space-y-2">
            {excedeTiempo && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  La planificación excede el tiempo disponible en {totalClasesAsignadas - totalClasesDisponibles} clases.
                  Considera reducir la duración de algunas unidades.
                </AlertDescription>
              </Alert>
            )}

            {unidadesSinContenido.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {unidadesSinContenido.length} unidad(es) sin contenido seleccionado.
                </AlertDescription>
              </Alert>
            )}

            {unidadesSinCompetencias.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {unidadesSinCompetencias.length} unidad(es) sin competencias asignadas.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {!tieneErrores && !excedeTiempo && unidades.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              La planificación está completa y balanceada. Listo para crear las sesiones.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};