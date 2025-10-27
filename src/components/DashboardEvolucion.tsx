import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp, Target, Award, AlertCircle, CheckCircle, Clock } from 'lucide-react';

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

  // Data for progress by subject
  const progresoMaterias = [
    { materia: 'Matemática', actual: 8.5, objetivo: 8.0, progreso: 106 },
    { materia: 'Lengua', actual: 7.0, objetivo: 8.0, progreso: 88 },
    { materia: 'Historia', actual: 9.0, objetivo: 8.5, progreso: 106 },
    { materia: 'Ciencias', actual: 8.0, objetivo: 8.0, progreso: 100 }
  ];

  // Data for contemplation effectiveness
  const efectividadContemplaciones = [
    { name: 'Muy efectiva', value: 40, color: '#10b981' },
    { name: 'Efectiva', value: 35, color: '#3b82f6' },
    { name: 'Parcialmente efectiva', value: 20, color: '#f59e0b' },
    { name: 'Poco efectiva', value: 5, color: '#ef4444' }
  ];

  // Mock goals data
  const objetivos = [
    {
      id: 1,
      descripcion: 'Mejorar comprensión lectora',
      estado: 'en_progreso',
      progreso: 65,
      fechaLimite: '2024-12-15'
    },
    {
      id: 2,
      descripcion: 'Reducir ansiedad evaluativa',
      estado: 'completado',
      progreso: 100,
      fechaLimite: '2024-11-30'
    },
    {
      id: 3,
      descripcion: 'Fortalecer autonomía en tareas',
      estado: 'completado',
      progreso: 100,
      fechaLimite: '2024-10-15'
    },
    {
      id: 4,
      descripcion: 'Desarrollar habilidades sociales',
      estado: 'completado',
      progreso: 100,
      fechaLimite: '2024-09-30'
    },
    {
      id: 5,
      descripcion: 'Mejorar organización personal',
      estado: 'en_progreso',
      progreso: 45,
      fechaLimite: '2024-12-30'
    }
  ];

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'completado': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'en_progreso': return <Clock className="w-4 h-4 text-blue-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'completado': return 'bg-green-50 border-green-200';
      case 'en_progreso': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getProgressColor = (progreso: number) => {
    if (progreso >= 100) return 'bg-green-600';
    if (progreso >= 75) return 'bg-blue-600';
    if (progreso >= 50) return 'bg-yellow-600';
    return 'bg-red-600';
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