import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Save, X } from 'lucide-react';

interface CriterioRubrica {
  codigo: string;
  criterio: string;
  excelente: string;
  satisfactorio: string;
  enDesarrollo: string;
  iniciando: string;
}

interface RubricaIntegradaProps {
  criterios: CriterioRubrica[];
  onUpdate?: (criterios: CriterioRubrica[]) => void;
  editable?: boolean;
}

export const RubricaIntegrada = ({ criterios, onUpdate, editable = true }: RubricaIntegradaProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCriterios, setEditedCriterios] = useState<CriterioRubrica[]>(criterios);

  const handleSave = () => {
    onUpdate?.(editedCriterios);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedCriterios(criterios);
    setIsEditing(false);
  };

  const updateCriterio = (index: number, field: keyof CriterioRubrica, value: string) => {
    const updated = [...editedCriterios];
    updated[index] = { ...updated[index], [field]: value };
    setEditedCriterios(updated);
  };

  if (criterios.length === 0) {
    return (
      <Card className="my-6 border-2 border-orange-200 bg-orange-50/30">
        <CardHeader>
          <CardTitle className="text-orange-700 flex items-center gap-2">
            📋 Rúbrica de Evaluación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 italic">No hay criterios de logro seleccionados para generar la rúbrica.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="my-6 border-2 border-orange-200 bg-orange-50/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-orange-700 flex items-center gap-2">
          📋 Rúbrica de Evaluación
        </CardTitle>
        {editable && (
          <div className="flex gap-2">
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="text-orange-600 border-orange-300"
              >
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  className="text-green-600 border-green-300"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Guardar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="text-red-600 border-red-300"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="docente" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="docente">Para el Docente</TabsTrigger>
            <TabsTrigger value="estudiante">Para el Estudiante</TabsTrigger>
          </TabsList>
          
          <TabsContent value="docente" className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-orange-100">
                  <tr>
                    <th className="border border-gray-300 p-2 text-left font-semibold">Criterio</th>
                    <th className="border border-gray-300 p-2 text-center font-semibold text-green-700">
                      Excelente (4)
                    </th>
                    <th className="border border-gray-300 p-2 text-center font-semibold text-blue-700">
                      Satisfactorio (3)
                    </th>
                    <th className="border border-gray-300 p-2 text-center font-semibold text-yellow-700">
                      En Desarrollo (2)
                    </th>
                    <th className="border border-gray-300 p-2 text-center font-semibold text-red-700">
                      Iniciando (1)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(isEditing ? editedCriterios : criterios).map((criterio, index) => (
                    <tr key={criterio.codigo} className="hover:bg-gray-50">
                      <td className="border border-gray-300 p-2 font-medium text-gray-800">
                        {!isEditing ? (
                          <>
                            <Badge variant="outline" className="mb-1 text-xs">
                              {criterio.codigo}
                            </Badge>
                            <div className="text-sm">{criterio.criterio}</div>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={criterio.codigo}
                              onChange={(e) => updateCriterio(index, 'codigo', e.target.value)}
                              className="w-full p-1 text-xs border rounded"
                              placeholder="Código"
                            />
                            <Textarea
                              value={criterio.criterio}
                              onChange={(e) => updateCriterio(index, 'criterio', e.target.value)}
                              className="w-full text-sm min-h-[60px]"
                              placeholder="Descripción del criterio"
                            />
                          </div>
                        )}
                      </td>
                      <td className="border border-gray-300 p-2 text-sm">
                        {!isEditing ? (
                          <div className="text-green-800">{criterio.excelente}</div>
                        ) : (
                          <Textarea
                            value={criterio.excelente}
                            onChange={(e) => updateCriterio(index, 'excelente', e.target.value)}
                            className="w-full text-sm min-h-[60px]"
                            placeholder="Descripción nivel excelente"
                          />
                        )}
                      </td>
                      <td className="border border-gray-300 p-2 text-sm">
                        {!isEditing ? (
                          <div className="text-blue-800">{criterio.satisfactorio}</div>
                        ) : (
                          <Textarea
                            value={criterio.satisfactorio}
                            onChange={(e) => updateCriterio(index, 'satisfactorio', e.target.value)}
                            className="w-full text-sm min-h-[60px]"
                            placeholder="Descripción nivel satisfactorio"
                          />
                        )}
                      </td>
                      <td className="border border-gray-300 p-2 text-sm">
                        {!isEditing ? (
                          <div className="text-yellow-800">{criterio.enDesarrollo}</div>
                        ) : (
                          <Textarea
                            value={criterio.enDesarrollo}
                            onChange={(e) => updateCriterio(index, 'enDesarrollo', e.target.value)}
                            className="w-full text-sm min-h-[60px]"
                            placeholder="Descripción nivel en desarrollo"
                          />
                        )}
                      </td>
                      <td className="border border-gray-300 p-2 text-sm">
                        {!isEditing ? (
                          <div className="text-red-800">{criterio.iniciando}</div>
                        ) : (
                          <Textarea
                            value={criterio.iniciando}
                            onChange={(e) => updateCriterio(index, 'iniciando', e.target.value)}
                            className="w-full text-sm min-h-[60px]"
                            placeholder="Descripción nivel iniciando"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
          
          <TabsContent value="estudiante" className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">
                ¿Cómo será evaluado tu trabajo?
              </h3>
              <p className="text-sm text-blue-700 mb-4">
                Esta rúbrica te ayuda a entender qué se espera de ti en cada criterio:
              </p>
              
              <div className="space-y-4">
                {criterios.map((criterio, index) => (
                  <div key={criterio.codigo} className="bg-white p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-blue-600">
                        {criterio.codigo}
                      </Badge>
                      <h4 className="font-medium text-gray-800">
                        {criterio.criterio}
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="p-3 bg-green-50 rounded border border-green-200">
                        <div className="font-semibold text-green-700 text-sm mb-1">
                          ✨ Excelente trabajo
                        </div>
                        <div className="text-sm text-green-800">
                          {criterio.excelente}
                        </div>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="font-semibold text-blue-700 text-sm mb-1">
                          👍 Buen trabajo
                        </div>
                        <div className="text-sm text-blue-800">
                          {criterio.satisfactorio}
                        </div>
                      </div>
                      
                      <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                        <div className="font-semibold text-yellow-700 text-sm mb-1">
                          🔄 Puedes mejorar
                        </div>
                        <div className="text-sm text-yellow-800">
                          {criterio.enDesarrollo}
                        </div>
                      </div>
                      
                      <div className="p-3 bg-red-50 rounded border border-red-200">
                        <div className="font-semibold text-red-700 text-sm mb-1">
                          🚀 ¡Sigamos trabajando!
                        </div>
                        <div className="text-sm text-red-800">
                          {criterio.iniciando}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};