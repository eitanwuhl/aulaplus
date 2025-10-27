import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, User } from 'lucide-react';

interface Student {
  id: number;
  name: string;
  contemplaciones: string[];
  informeTecnico?: {
    modalidadCursado: string;
  };
}

interface VersionPersonalizationProps {
  version: number;
  students?: Student[];
}

export const VersionPersonalization: React.FC<VersionPersonalizationProps> = ({
  version,
  students = []
}) => {
  
  // Función para obtener estudiantes asignados según la versión
  const getAssignedStudents = () => {
    if (!students || students.length === 0) {
      // Datos de ejemplo si no hay estudiantes reales
      const exampleStudents = [
        { name: "María González", justification: "Requiere apoyo visual y tiempo extendido" },
        { name: "Carlos Rodríguez", justification: "Necesita instrucciones simplificadas" }
      ];
      return exampleStudents;
    }

    switch (version) {
      case 1: {
        // Versión estándar - estudiantes sin adaptaciones significativas
        const assigned = students
          .filter(s => s.contemplaciones.length <= 1)
          .slice(0, Math.max(1, Math.floor(students.length * 0.4)))
          .map(s => ({
            name: s.name,
            justification: s.contemplaciones.length === 0 
              ? "Evaluación estándar sin adaptaciones especiales"
              : "Adaptaciones menores según perfil académico"
          }));
        return assigned.length > 0 ? assigned : [
          { name: "Ana Martínez", justification: "Evaluación estándar sin adaptaciones especiales" },
          { name: "Diego Silva", justification: "Perfil académico estándar" }
        ];
      }
      
      case 2: {
        // Versión con apoyos moderados
        const assigned = students
          .filter(s => s.contemplaciones.length === 2 || s.contemplaciones.length === 3)
          .slice(0, Math.max(1, Math.floor(students.length * 0.4)))
          .map(s => ({
            name: s.name,
            justification: s.contemplaciones.includes("Tiempo adicional") 
              ? "Requiere tiempo extendido y apoyo visual"
              : "Necesita apoyos pedagógicos moderados según sus contemplaciones"
          }));
        return assigned.length > 0 ? assigned : [
          { name: "Sofía López", justification: "Requiere tiempo extendido y apoyo visual" },
          { name: "Mateo Fernández", justification: "Necesita instrucciones claras y organizadores gráficos" }
        ];
      }
      
      case 3: {
        // Versión altamente adaptada
        const assigned = students
          .filter(s => 
            s.contemplaciones.length >= 4 || 
            (s.informeTecnico?.modalidadCursado?.toLowerCase().includes('adecuaciones') ?? false)
          )
          .slice(0, Math.max(1, Math.floor(students.length * 0.3)))
          .map(s => ({
            name: s.name,
            justification: s.informeTecnico?.modalidadCursado?.toLowerCase().includes('significativas')
              ? "Requiere adecuaciones curriculares significativas"
              : "Necesita máximo nivel de adaptaciones pedagógicas según informe técnico"
          }));
        return assigned.length > 0 ? assigned : [
          { name: "Valentina Castro", justification: "Requiere adecuaciones curriculares significativas" },
          { name: "Joaquín Méndez", justification: "Necesita máximo apoyo pedagógico y contenidos esenciales" }
        ];
      }
      
      default:
        return [{ name: "Estudiante ejemplo", justification: "Versión no especificada" }];
    }
  };

  const assignedStudents = getAssignedStudents();
  
  const getVersionColor = (v: number) => {
    switch (v) {
      case 1: return "bg-green-50 border-green-200 text-green-800";
      case 2: return "bg-blue-50 border-blue-200 text-blue-800";
      case 3: return "bg-orange-50 border-orange-200 text-orange-800";
      default: return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  const getVersionTitle = (v: number) => {
    switch (v) {
      case 1: return "Versión Estándar";
      case 2: return "Versión con Apoyos Moderados";
      case 3: return "Versión Altamente Adaptada";
      default: return `Versión ${v}`;
    }
  };

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          ¿A quién contempla esta versión?
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className={`p-4 rounded-lg border-2 ${getVersionColor(version)}`}>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="font-medium">
              {getVersionTitle(version)}
            </Badge>
          </div>
          
          <div className="space-y-3">
            {assignedStudents.map((student, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border">
                <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground">
                    {student.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {student.justification}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {assignedStudents.length === 0 && (
            <div className="text-sm text-muted-foreground italic text-center py-2">
              No hay estudiantes asignados a esta versión
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};