import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function EvaluacionesChoice() {
  const navigate = useNavigate();

  return (
    <div className="container space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Evaluaciones Grupales</h1>
        <p className="text-muted-foreground mt-2">
          Genera y gestiona evaluaciones adaptadas con asistencia de IA
        </p>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        
        {/* Generar Evaluación */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" 
              onClick={() => navigate('/evaluaciones/nuevo')}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Generar Evaluación</CardTitle>
                <CardDescription>
                  Crea evaluaciones personalizadas por grupo
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Generador inteligente que crea evaluaciones adaptadas a los perfiles 
              de aprendizaje de tu grupo con múltiples versiones.
            </p>
          </CardContent>
        </Card>

        {/* Mis Evaluaciones */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/mis-evaluaciones')}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <FolderOpen className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-lg">Mis Evaluaciones</CardTitle>
                <CardDescription>
                  Ver y gestionar evaluaciones guardadas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Accede a tus evaluaciones guardadas, analiza el balance de competencias 
              y gestiona tu repositorio de evaluaciones.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
























