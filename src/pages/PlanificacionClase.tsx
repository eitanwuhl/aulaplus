import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FileText, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PlanificacionClase() {
  const navigate = useNavigate();

  return (
    <div className="containerspace-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Planificación de Clases</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus planificaciones pedagógicas con asistencia de IA
          </p>
        </div>
        
        <Button onClick={() => navigate('/planificacion/nuevo')} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Nueva Planificación
        </Button>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        
        {/* Asistente de Planificación */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" 
              onClick={() => navigate('/planificacion/nuevo')}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Asistente de Planificación</CardTitle>
                <CardDescription>
                  Crea una planificación completa paso a paso
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Wizard inteligente que te guía desde la configuración del horario hasta 
              la generación de sesiones adaptadas a tu grupo.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                Wizard 4 pasos
              </span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                IA contextual
              </span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                ANEP oficial
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Mis Planificaciones */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/mis-planificaciones')}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Calendar className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-lg">Mis Planificaciones</CardTitle>
                <CardDescription>
                  Ver y editar planificaciones existentes
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Accede a tus planificaciones guardadas, edita sesiones 
              y exporta a Excel.
            </p>
            <Button variant="outline" className="mt-3">
              <Calendar className="h-4 w-4 mr-2" />
              Ver planificaciones
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}