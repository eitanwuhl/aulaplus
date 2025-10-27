import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface EvolucionAcademicaProps {
  student: {
    id: number;
    name: string;
    historialAcademico?: any[];
    evolucionDetallada?: {
      año: string;
      trimestre: string;
      materias: { nombre: string; calificacion: number }[];
    }[];
  };
}

const EvolucionAcademica = ({ student }: EvolucionAcademicaProps) => {
  // Mock data for detailed evolution with more granular tracking
  const evolucionDetallada = [
    {
      año: "2023",
      trimestre: "T1",
      materias: [
        { nombre: "Matemática", calificacion: 6.5 },
        { nombre: "Lengua", calificacion: 6.0 },
        { nombre: "Historia", calificacion: 7.5 },
        { nombre: "Ciencias", calificacion: 7.0 },
      ]
    },
    {
      año: "2023",
      trimestre: "T2",
      materias: [
        { nombre: "Matemática", calificacion: 7.0 },
        { nombre: "Lengua", calificacion: 6.5 },
        { nombre: "Historia", calificacion: 8.0 },
        { nombre: "Ciencias", calificacion: 7.5 },
      ]
    },
    {
      año: "2023",
      trimestre: "T3",
      materias: [
        { nombre: "Matemática", calificacion: 7.5 },
        { nombre: "Lengua", calificacion: 6.5 },
        { nombre: "Historia", calificacion: 8.5 },
        { nombre: "Ciencias", calificacion: 7.5 },
      ]
    },
    {
      año: "2024",
      trimestre: "T1",
      materias: [
        { nombre: "Matemática", calificacion: 8.0 },
        { nombre: "Lengua", calificacion: 6.8 },
        { nombre: "Historia", calificacion: 8.8 },
        { nombre: "Ciencias", calificacion: 8.0 },
      ]
    },
    {
      año: "2024",
      trimestre: "T2",
      materias: [
        { nombre: "Matemática", calificacion: 8.2 },
        { nombre: "Lengua", calificacion: 7.0 },
        { nombre: "Historia", calificacion: 9.0 },
        { nombre: "Ciencias", calificacion: 8.2 },
      ]
    },
    {
      año: "2024",
      trimestre: "T3",
      materias: [
        { nombre: "Matemática", calificacion: 8.5 },
        { nombre: "Lengua", calificacion: 7.0 },
        { nombre: "Historia", calificacion: 9.0 },
        { nombre: "Ciencias", calificacion: 8.0 },
      ]
    }
  ];

  // Transform data for line chart
  const chartData = evolucionDetallada.map(periodo => ({
    periodo: `${periodo.año} ${periodo.trimestre}`,
    Matemática: periodo.materias.find(m => m.nombre === "Matemática")?.calificacion || 0,
    Lengua: periodo.materias.find(m => m.nombre === "Lengua")?.calificacion || 0,
    Historia: periodo.materias.find(m => m.nombre === "Historia")?.calificacion || 0,
    Ciencias: periodo.materias.find(m => m.nombre === "Ciencias")?.calificacion || 0,
  }));


  return (
    <div className="space-y-6">
      {/* Evolution Charts */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            📈 Evolución Académica por Materia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="periodo" 
                  className="text-sm"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[0, 10]} 
                  className="text-sm"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="Matemática" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                <Line type="monotone" dataKey="Lengua" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                <Line type="monotone" dataKey="Historia" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
                <Line type="monotone" dataKey="Ciencias" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default EvolucionAcademica;