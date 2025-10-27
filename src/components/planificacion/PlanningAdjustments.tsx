import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlanningTextArea } from './PlanningTextArea';
import { Edit, RefreshCw } from 'lucide-react';

interface PlanningAdjustmentsProps {
  onRequestAdjustment: (request: string) => void;
  isGenerating?: boolean;
}

export const PlanningAdjustments: React.FC<PlanningAdjustmentsProps> = ({
  onRequestAdjustment,
  isGenerating = false
}) => {
  const [adjustmentRequest, setAdjustmentRequest] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleRequest = () => {
    if (adjustmentRequest.trim()) {
      onRequestAdjustment(adjustmentRequest);
      setAdjustmentRequest('');
      setIsEditing(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
          <Edit className="h-4 w-4" />
          Solicitar ajustes a esta planificación
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isEditing ? (
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isGenerating}
          >
            <Edit className="w-4 h-4 mr-2" />
            Escribir solicitud de ajustes
          </Button>
        ) : (
          <div className="space-y-3">
            <PlanningTextArea
              value={adjustmentRequest}
              onChange={setAdjustmentRequest}
              placeholder="Describe qué cambios necesitas en esta planificación (ej: 'Incluir más actividades grupales', 'Agregar recursos digitales', 'Simplificar las instrucciones')..."
              minHeight="min-h-[100px]"
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleRequest}
                disabled={!adjustmentRequest.trim() || isGenerating}
                size="sm"
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Aplicar cambios
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  setIsEditing(false);
                  setAdjustmentRequest('');
                }}
                variant="outline"
                size="sm"
                disabled={isGenerating}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlanningAdjustments;