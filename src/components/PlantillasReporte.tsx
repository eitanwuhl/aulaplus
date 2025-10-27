import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { FileText, Save, Star, Copy, Trash2, Edit3, Plus } from 'lucide-react';
import { toast } from "sonner";

interface PlantillaReporte {
  id: string;
  nombre: string;
  descripcion: string;
  secciones: {
    datosBasicos: boolean;
    rendimientoAcademico: boolean;
    contemplaciones: boolean;
    evolucion: boolean;
    recomendaciones: boolean;
    informeTecnico: boolean;
    alertas: boolean;
    comentarios: boolean;
  };
  comentariosDefault: string;
  fechaCreacion: Date;
  esDefault: boolean;
  esFavorita: boolean;
}

interface PlantillasReporteProps {
  onSelectPlantilla: (plantilla: PlantillaReporte) => void;
  seccionesActuales?: any;
  comentariosActuales?: string;
}

const PlantillasReporte = ({ onSelectPlantilla, seccionesActuales, comentariosActuales }: PlantillasReporteProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaReporte[]>([]);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [plantillaEditando, setPlantillaEditando] = useState<PlantillaReporte | null>(null);
  const [nuevaPlantilla, setNuevaPlantilla] = useState({
    nombre: '',
    descripcion: '',
    comentariosDefault: ''
  });

  // Load templates from localStorage on mount
  useEffect(() => {
    const plantillasGuardadas = localStorage.getItem('plantillasReporte');
    if (plantillasGuardadas) {
      setPlantillas(JSON.parse(plantillasGuardadas));
    } else {
      // Default templates
      const plantillasDefault: PlantillaReporte[] = [
        {
          id: 'completo',
          nombre: 'Reporte Completo',
          descripcion: 'Incluye todas las secciones para reunión detallada',
          secciones: {
            datosBasicos: true,
            rendimientoAcademico: true,
            contemplaciones: true,
            evolucion: true,
            recomendaciones: true,
            informeTecnico: true,
            alertas: true,
            comentarios: true
          },
          comentariosDefault: '',
          fechaCreacion: new Date(),
          esDefault: true,
          esFavorita: false
        },
        {
          id: 'basico',
          nombre: 'Reporte Básico',
          descripcion: 'Solo información esencial para reuniones rápidas',
          secciones: {
            datosBasicos: true,
            rendimientoAcademico: true,
            contemplaciones: true,
            evolucion: false,
            recomendaciones: true,
            informeTecnico: false,
            alertas: true,
            comentarios: false
          },
          comentariosDefault: '',
          fechaCreacion: new Date(),
          esDefault: true,
          esFavorita: true
        },
        {
          id: 'seguimiento',
          nombre: 'Reporte de Seguimiento',
          descripcion: 'Enfocado en evolución y próximos pasos',
          secciones: {
            datosBasicos: true,
            rendimientoAcademico: true,
            contemplaciones: false,
            evolucion: true,
            recomendaciones: true,
            informeTecnico: false,
            alertas: true,
            comentarios: true
          },
          comentariosDefault: 'Seguimiento de objetivos establecidos en la reunión anterior.',
          fechaCreacion: new Date(),
          esDefault: true,
          esFavorita: false
        }
      ];
      setPlantillas(plantillasDefault);
      localStorage.setItem('plantillasReporte', JSON.stringify(plantillasDefault));
    }
  }, []);

  const guardarPlantillas = (nuevasPlantillas: PlantillaReporte[]) => {
    setPlantillas(nuevasPlantillas);
    localStorage.setItem('plantillasReporte', JSON.stringify(nuevasPlantillas));
  };

  const crearNuevaPlantilla = () => {
    if (!nuevaPlantilla.nombre.trim()) {
      toast.error('El nombre de la plantilla es requerido');
      return;
    }

    const plantilla: PlantillaReporte = {
      id: Date.now().toString(),
      nombre: nuevaPlantilla.nombre,
      descripcion: nuevaPlantilla.descripcion,
      secciones: seccionesActuales || {
        datosBasicos: true,
        rendimientoAcademico: true,
        contemplaciones: true,
        evolucion: true,
        recomendaciones: true,
        informeTecnico: true,
        alertas: true,
        comentarios: true
      },
      comentariosDefault: nuevaPlantilla.comentariosDefault,
      fechaCreacion: new Date(),
      esDefault: false,
      esFavorita: false
    };

    guardarPlantillas([...plantillas, plantilla]);
    setNuevaPlantilla({ nombre: '', descripcion: '', comentariosDefault: '' });
    setModoEdicion(false);
    toast.success('Plantilla creada exitosamente');
  };

  const toggleFavorita = (id: string) => {
    const nuevasPlantillas = plantillas.map(p => 
      p.id === id ? { ...p, esFavorita: !p.esFavorita } : p
    );
    guardarPlantillas(nuevasPlantillas);
  };

  const duplicarPlantilla = (plantilla: PlantillaReporte) => {
    const nueva: PlantillaReporte = {
      ...plantilla,
      id: Date.now().toString(),
      nombre: `Copia de ${plantilla.nombre}`,
      fechaCreacion: new Date(),
      esDefault: false,
      esFavorita: false
    };
    guardarPlantillas([...plantillas, nueva]);
    toast.success('Plantilla duplicada exitosamente');
  };

  const eliminarPlantilla = (id: string) => {
    if (plantillas.find(p => p.id === id)?.esDefault) {
      toast.error('No se pueden eliminar plantillas predeterminadas');
      return;
    }
    
    const nuevasPlantillas = plantillas.filter(p => p.id !== id);
    guardarPlantillas(nuevasPlantillas);
    toast.success('Plantilla eliminada exitosamente');
  };

  const aplicarPlantilla = (plantilla: PlantillaReporte) => {
    onSelectPlantilla(plantilla);
    setDialogOpen(false);
    toast.success(`Plantilla "${plantilla.nombre}" aplicada`);
  };

  const plantillasOrdenadas = [...plantillas].sort((a, b) => {
    if (a.esFavorita && !b.esFavorita) return -1;
    if (!a.esFavorita && b.esFavorita) return 1;
    if (a.esDefault && !b.esDefault) return -1;
    if (!a.esDefault && b.esDefault) return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Plantillas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Gestión de Plantillas de Reporte
            </span>
            <Button
              onClick={() => setModoEdicion(!modoEdicion)}
              variant={modoEdicion ? "default" : "outline"}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {modoEdicion ? 'Cancelar' : 'Nueva Plantilla'}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {modoEdicion && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg p-4 bg-muted/20"
          >
            <h3 className="font-bold text-lg mb-4">Crear Nueva Plantilla</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nombre de la Plantilla</label>
                <Input
                  value={nuevaPlantilla.nombre}
                  onChange={(e) => setNuevaPlantilla(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Reporte Trimestral"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Input
                  value={nuevaPlantilla.descripcion}
                  onChange={(e) => setNuevaPlantilla(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Describe cuándo usar esta plantilla"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Comentarios por Defecto</label>
                <Textarea
                  value={nuevaPlantilla.comentariosDefault}
                  onChange={(e) => setNuevaPlantilla(prev => ({ ...prev, comentariosDefault: e.target.value }))}
                  placeholder="Comentarios que aparecerán automáticamente al usar esta plantilla"
                  className="min-h-20"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={crearNuevaPlantilla} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Guardar Plantilla
                </Button>
                <Button variant="outline" onClick={() => setModoEdicion(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plantillasOrdenadas.map((plantilla) => (
            <motion.div
              key={plantilla.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={`relative cursor-pointer transition-all ${
                plantilla.esFavorita ? 'ring-2 ring-yellow-400' : ''
              }`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {plantilla.esFavorita && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                      {plantilla.nombre}
                    </div>
                    <div className="flex gap-1">
                      {plantilla.esDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{plantilla.descripcion}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Secciones incluidas:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(plantilla.secciones)
                          .filter(([_, included]) => included)
                          .map(([seccion, _]) => (
                          <Badge key={seccion} variant="outline" className="text-xs">
                            {seccion.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => aplicarPlantilla(plantilla)}
                        size="sm"
                        className="flex-1"
                      >
                        Usar Plantilla
                      </Button>
                      <Button
                        onClick={() => toggleFavorita(plantilla.id)}
                        variant="outline"
                        size="sm"
                      >
                        <Star className={`w-4 h-4 ${plantilla.esFavorita ? 'text-yellow-500 fill-current' : ''}`} />
                      </Button>
                      <Button
                        onClick={() => duplicarPlantilla(plantilla)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {!plantilla.esDefault && (
                        <Button
                          onClick={() => eliminarPlantilla(plantilla.id)}
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {plantillas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay plantillas guardadas</p>
            <p className="text-sm">Crea tu primera plantilla para accesos rápidos</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PlantillasReporte;