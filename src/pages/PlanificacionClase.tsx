import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PlanificacionClase() {
  const navigate = useNavigate();

  return (
    <div className="container space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Planificación de Clases</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona tus planificaciones pedagógicas con asistencia de IA
        </p>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">

        <Card className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate('/programa-anual')}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <BookOpen className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Programa anual</CardTitle>
                <CardDescription>
                  Planificador macro por grupo y materia
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Definí unidades y cobertura curricular con el catálogo institucional antes del wizard de sesiones.
            </p>
          </CardContent>
        </Card>
        
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}