import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Network } from "lucide-react";
import {
  LEARNING_STYLE_LABELS,
  primaryStyleFromPerfil,
  type LearningStyleLabel,
} from "@/lib/teacherGroups/learningStyleStats";

const UNCLASSIFIED_LABEL = "Sin perfil clasificado";

interface Student {
  id: number;
  name: string;
  perfil: string;
  ajustes: string;
  progreso: number;
  avatar: string;
}

interface AnalisisGrupalAvanzadoProps {
  students: Student[];
  groupName: string;
}

const AnalisisGrupalAvanzado = ({ students, groupName }: AnalisisGrupalAvanzadoProps) => {
  const gruposPorPerfil = useMemo(() => {
    const grupos: Record<string, Student[]> = {};

    for (const student of students) {
      const style = primaryStyleFromPerfil(student.perfil);
      const categoria = style ?? UNCLASSIFIED_LABEL;
      if (!grupos[categoria]) grupos[categoria] = [];
      grupos[categoria].push(student);
    }

    const ordered: Record<string, Student[]> = {};
    for (const label of LEARNING_STYLE_LABELS) {
      if (grupos[label]?.length) ordered[label] = grupos[label];
    }
    if (grupos[UNCLASSIFIED_LABEL]?.length) {
      ordered[UNCLASSIFIED_LABEL] = grupos[UNCLASSIFIED_LABEL];
    }
    return ordered;
  }, [students]);

  const coloresPerfil: Record<LearningStyleLabel | typeof UNCLASSIFIED_LABEL, string> = {
    Visual: "bg-blue-100 border-blue-300 text-blue-800",
    Auditivo: "bg-green-100 border-green-300 text-green-800",
    "Kinestésico": "bg-orange-100 border-orange-300 text-orange-800",
    "Lector/escritor": "bg-purple-100 border-purple-300 text-purple-800",
    [UNCLASSIFIED_LABEL]: "bg-gray-100 border-gray-300 text-gray-800",
  };

  return (
    <Card className="border-2 border-emerald-200">
      <CardHeader>
        <CardTitle className="text-2xl text-emerald-700 flex items-center gap-2">
          <Network className="w-6 h-6" />
          Análisis de compatibilidad entre perfiles de estudiantes
        </CardTitle>
        <p className="text-sm text-gray-600">
          Distribución de estudiantes por perfil de aprendizaje en {groupName}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="bg-emerald-50 p-4 rounded-lg border-l-4 border-emerald-400">
            <p className="text-sm text-emerald-700">
              Los estudiantes con perfiles similares tienden a colaborar mejor juntos, mientras que perfiles complementarios pueden enriquecerse mutuamente.
            </p>
          </div>

          {/* Visualización de grupos por perfil */}
          <div className="grid gap-6">
            <div className="relative">
              {/* Contenedor principal de visualización */}
              <div className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-xl border-2 border-gray-200 min-h-96">
                <div className="flex flex-wrap justify-center gap-8 items-center">
                  {Object.entries(gruposPorPerfil).map(([perfil, estudiantesDelPerfil], index) => (
                    <motion.div
                      key={perfil}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: index * 0.2 }}
                      className={`relative ${coloresPerfil[perfil as LearningStyleLabel] ?? coloresPerfil[UNCLASSIFIED_LABEL]} rounded-2xl border-2 p-6 shadow-lg`}
                    >
                      {/* Título del perfil */}
                      <div className="text-center mb-4">
                        <h3 className="font-bold text-lg mb-1">{perfil}</h3>
                        <div className="text-sm opacity-75">
                          {estudiantesDelPerfil.length} estudiante{estudiantesDelPerfil.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      
                      {/* Estudiantes del grupo */}
                      <div className="flex flex-col gap-2 min-w-48">
                        {estudiantesDelPerfil.map((estudiante) => (
                          <motion.div
                            key={estudiante.id}
                            whileHover={{ scale: 1.05 }}
                            className="bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-white/50 shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">{estudiante.avatar}</div>
                              <div>
                                <div className="font-medium text-sm">{estudiante.name}</div>
                                <div className="text-xs opacity-75">{estudiante.perfil}</div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Líneas de conexión suaves entre grupos (opcional) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                  <defs>
                    <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 0.3 }} />
                      <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 0.3 }} />
                    </linearGradient>
                  </defs>
                  {/* Se pueden agregar líneas SVG aquí para conectar grupos complementarios */}
                </svg>
              </div>

              {/* Leyenda */}
              <div className="mt-6 bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-3">Interpretación:</h4>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></div>
                    <span className="text-gray-700">
                      <strong>Grupos homogéneos:</strong> Estudiantes del mismo perfil colaboran eficientemente
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 flex-shrink-0"></div>
                    <span className="text-gray-700">
                      <strong>Grupos heterogéneos:</strong> Diferentes perfiles se complementan y enriquecen el aprendizaje
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalisisGrupalAvanzado;