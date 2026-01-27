import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FolderOpen, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function EvaluacionesChoice() {
  const navigate = useNavigate();

  return (
    <div className="container space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Evaluaciones Grupales</h1>
          <p className="text-muted-foreground mt-2">
            Genera y gestiona evaluaciones adaptadas con asistencia de IA
          </p>
        </div>
        
        <Button onClick={() => navigate('/evaluaciones/nuevo')} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Nueva Evaluación
        </Button>
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
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                IA adaptativa
              </span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                Multi-versión
              </span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                ANEP oficial
              </span>
            </div>
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
            <Button variant="outline" className="mt-3">
              <FolderOpen className="h-4 w-4 mr-2" />
              Ver evaluaciones
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



















