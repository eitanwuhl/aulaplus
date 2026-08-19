import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { TrendingUp, Target, Award } from 'lucide-react';

interface DashboardEvolucionProps {
  student: {
    id: number;
    name: string;
    perfil: string;
    contemplaciones: string[];
  };
}

const DashboardEvolucion = ({ student }: DashboardEvolucionProps) => {
  // Mock dashboard metrics
  const metricas = {
    promedioGeneral: 7.8,
    promedioAnterior: 7.2,
    mejorMateria: { nombre: 'Historia', nota: 9.0 },
    materiaRiesgo: { nombre: 'Lengua', nota: 6.8 },
    contemplacionesActivas: student.contemplaciones.length,
    objetivosCumplidos: 3,
    objetivosTotales: 5,
    progresoAnual: 78
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Promedio General</p>
                  <p className="text-2xl font-bold text-blue-800">{metricas.promedioGeneral}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <div className="mt-2">
                <Badge variant="secondary" className="text-xs bg-blue-200 text-blue-800">
                  +{(metricas.promedioGeneral - metricas.promedioAnterior).toFixed(1)} vs año anterior
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Mejor Materia</p>
                  <p className="text-lg font-bold text-green-800">{metricas.mejorMateria.nombre}</p>
                </div>
                <Award className="w-8 h-8 text-green-600" />
              </div>
              <div className="mt-2">
                <Badge variant="secondary" className="text-xs bg-green-200 text-green-800">
                  {metricas.mejorMateria.nota.toFixed(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700">Área de Foco</p>
                  <p className="text-lg font-bold text-yellow-800">{metricas.materiaRiesgo.nombre}</p>
                </div>
                <Target className="w-8 h-8 text-yellow-600" />
              </div>
              <div className="mt-2">
                <Badge variant="secondary" className="text-xs bg-yellow-200 text-yellow-800">
                  {metricas.materiaRiesgo.nota.toFixed(1)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardEvolucion;