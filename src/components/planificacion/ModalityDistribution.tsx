import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { DistribucionModalidades } from '@/types/planificacion';

interface ModalityDistributionProps {
  distribucion: DistribucionModalidades;
  onChange: (distribucion: DistribucionModalidades) => void;
}

export const ModalityDistribution: React.FC<ModalityDistributionProps> = ({
  distribucion,
  onChange
}) => {
  const modalidades = [
    { key: 'individual' as keyof DistribucionModalidades, label: 'Trabajo Individual', description: 'Estudiantes trabajando de forma autónoma' },
    { key: 'pareja' as keyof DistribucionModalidades, label: 'Trabajo en Parejas', description: 'Actividades colaborativas de a dos' },
    { key: 'grupos' as keyof DistribucionModalidades, label: 'Trabajo en Grupos', description: 'Equipos de 3-5 estudiantes' },
    { key: 'toda_clase' as keyof DistribucionModalidades, label: 'Toda la Clase', description: 'Actividades con todo el grupo' }
  ];

  const total = Object.values(distribucion).reduce((sum, val) => sum + val, 0);

  const handleChange = (modalidad: keyof DistribucionModalidades, valor: number) => {
    const diferencia = valor - distribucion[modalidad];
    const restantes = modalidades.filter(m => m.key !== modalidad);
    
    // Distribuir la diferencia proporcionalmente entre las otras modalidades
    const nuevaDistribucion = { ...distribucion, [modalidad]: valor };
    const totalRestante = 100 - valor;
    const sumaRestantes = total - distribucion[modalidad];
    
    if (sumaRestantes > 0) {
      restantes.forEach(modalidadRestante => {
        const proporcion = distribucion[modalidadRestante.key] / sumaRestantes;
        nuevaDistribucion[modalidadRestante.key] = Math.round(totalRestante * proporcion);
      });
    } else {
      // Si todas las demás están en 0, distribuir equitativamente
      const valorRestante = Math.floor(totalRestante / restantes.length);
      const sobrante = totalRestante % restantes.length;
      
      restantes.forEach((modalidadRestante, index) => {
        nuevaDistribucion[modalidadRestante.key] = valorRestante + (index < sobrante ? 1 : 0);
      });
    }

    // Ajustar para que la suma sea exactamente 100
    const nuevasuma = Object.values(nuevaDistribucion).reduce((sum, val) => sum + val, 0);
    if (nuevasuma !== 100) {
      const ajuste = 100 - nuevasuma;
      const modalidadParaAjustar = restantes[0]?.key || modalidad;
      nuevaDistribucion[modalidadParaAjustar] += ajuste;
    }

    onChange(nuevaDistribucion);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución de Modalidades</CardTitle>
        <p className="text-sm text-muted-foreground">
          Define qué porcentaje aproximado de las clases utilizará cada modalidad (debe sumar 100%)
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {modalidades.map(modalidad => (
          <div key={modalidad.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor={modalidad.key} className="font-medium">
                  {modalidad.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {modalidad.description}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-semibold">
                  {distribucion[modalidad.key]}%
                </span>
              </div>
            </div>
            <Slider
              id={modalidad.key}
              min={0}
              max={100}
              step={5}
              value={[distribucion[modalidad.key]]}
              onValueChange={(values) => handleChange(modalidad.key, values[0])}
              className="w-full"
            />
          </div>
        ))}
        
        <div className="flex justify-between items-center pt-4 border-t">
          <span className="font-medium">Total:</span>
          <span className={`text-lg font-bold ${total === 100 ? 'text-green-600' : 'text-red-600'}`}>
            {total}%
          </span>
        </div>
        
        {total !== 100 && (
          <p className="text-sm text-red-600">
            La suma debe ser exactamente 100%
          </p>
        )}
      </CardContent>
    </Card>
  );
};