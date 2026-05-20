import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { EvolucionPeriodo } from '@/types/schoolCatalog';

interface EvolucionAcademicaProps {
  student: {
    evolucionDetallada: EvolucionPeriodo[];
  };
}

const SUBJECT_COLORS: Record<string, string> = {
  Matemática: '#3b82f6',
  Lengua: '#10b981',
  Historia: '#f59e0b',
  Ciencias: '#8b5cf6',
};

const EvolucionAcademica = ({ student }: EvolucionAcademicaProps) => {
  const evolucionDetallada = student.evolucionDetallada;

  const subjectNames = useMemo(() => {
    const names = new Set<string>();
    for (const periodo of evolucionDetallada) {
      for (const m of periodo.materias) {
        names.add(m.nombre);
      }
    }
    return Array.from(names);
  }, [evolucionDetallada]);

  const chartData = useMemo(
    () =>
      evolucionDetallada.map((periodo) => {
        const row: Record<string, string | number> = {
          periodo: `${periodo.año} ${periodo.trimestre}`,
        };
        for (const materia of periodo.materias) {
          row[materia.nombre] = materia.calificacion;
        }
        return row;
      }),
    [evolucionDetallada]
  );

  if (evolucionDetallada.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No hay datos de evolución académica registrados para este alumno.
      </p>
    );
  }

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          Evolución académica por materia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="periodo" className="text-sm" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 10]} className="text-sm" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend />
              {subjectNames.map((nombre) => (
                <Line
                  key={nombre}
                  type="monotone"
                  dataKey={nombre}
                  stroke={SUBJECT_COLORS[nombre] ?? '#64748b'}
                  strokeWidth={2}
                  dot={{ fill: SUBJECT_COLORS[nombre] ?? '#64748b' }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default EvolucionAcademica;
