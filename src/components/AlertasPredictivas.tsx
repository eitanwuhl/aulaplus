import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Clock, Bell, TrendingDown, Users, BookOpen } from 'lucide-react';

interface AlertasPredictivAsProps {
  student: {
    id: number;
    name: string;
    perfil: string;
  };
}

const AlertasPredictivas = ({ student }: AlertasPredictivAsProps) => {
  // Mock predictive alerts based on student data patterns
  const alertasPredictivas = [
    {
      id: 1,
      tipo: 'riesgo',
      nivel: 'alto',
      titulo: 'Riesgo académico detectado en Lengua',
      descripcion: 'He notado un patrón descendente en las calificaciones. ¿Has observado cambios en su motivación o comprensión que puedan estar influyendo?',
      sugerencias: [
        '¿Te parece útil programar una reunión con el equipo psicopedagógico?',
        '¿Has considerado probar estrategias diferentes en comprensión lectora?',
        '¿Crees que sería momento de revisar las contemplaciones actuales?'
      ],
      prioridad: 'alta',
      fechaDeteccion: '2024-11-15',
      accionRecomendada: 'reunion_familia'
    },
    {
      id: 2,
      tipo: 'oportunidad',
      nivel: 'medio',
      titulo: 'Oportunidad de mejora en Matemática',
      descripcion: 'El progreso es muy alentador. ¿Has pensado en desafiarlo con conceptos más avanzados para mantener su motivación?',
      sugerencias: [
        '¿Podrías incorporar actividades de mayor complejidad?',
        '¿Te parece apropiado explorar su participación en olimpiadas?',
        '¿Cómo podríamos seguir fortaleciendo su autoestima académica?'
      ],
      prioridad: 'media',
      fechaDeteccion: '2024-11-10',
      accionRecomendada: 'refuerzo_positivo'
    },
    {
      id: 3,
      tipo: 'seguimiento',
      nivel: 'bajo',
      titulo: 'Revisar efectividad de contemplaciones',
      descripcion: 'Las contemplaciones llevan 6 meses implementadas. ¿Has notado si siguen siendo efectivas o necesitan ajustes?',
      sugerencias: [
        '¿Podrías evaluar qué tan útiles han sido las contemplaciones actuales?',
        '¿Has conversado con el estudiante sobre cómo se siente con los apoyos?',
        '¿Te parece necesario ajustar las estrategias según lo observado?'
      ],
      prioridad: 'baja',
      fechaDeteccion: '2024-11-08',
      accionRecomendada: 'revision_estrategias'
    }
  ];

  const recordatorios = [
    {
      fecha: '2024-11-25',
      accion: 'Reunión de seguimiento con padres',
      descripcion: 'Evaluar progreso en implementación de estrategias de apoyo'
    },
    {
      fecha: '2024-12-02',
      accion: 'Revisión psicopedagógica trimestral',
      descripcion: 'Evaluación integral del progreso académico y socioemocional'
    },
    {
      fecha: '2024-12-10',
      accion: 'Ajuste de contemplaciones',
      descripcion: 'Revisar y actualizar contemplaciones según evolución del estudiante'
    }
  ];

  const getAlertIcon = (tipo: string) => {
    switch (tipo) {
      case 'riesgo': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'oportunidad': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'seguimiento': return <Clock className="w-5 h-5 text-blue-600" />;
      default: return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getAlertColor = (nivel: string) => {
    switch (nivel) {
      case 'alto': return 'bg-red-50 border-red-200';
      case 'medio': return 'bg-yellow-50 border-yellow-200';
      case 'bajo': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getPriorityBadge = (prioridad: string) => {
    const colors = {
      alta: 'bg-red-100 text-red-800',
      media: 'bg-yellow-100 text-yellow-800',
      baja: 'bg-blue-100 text-blue-800'
    };
    return colors[prioridad as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Predictive Alerts */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            Sistema Predictivo de Alertas Académicas
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Sugerencias reflexivas basadas en tus observaciones para guiar el acompañamiento pedagógico
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alertasPredictivas.map((alerta, index) => (
              <motion.div
                key={alerta.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className={`p-4 rounded-lg border ${getAlertColor(alerta.nivel)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getAlertIcon(alerta.tipo)}
                    <h4 className="font-semibold text-gray-800">{alerta.titulo}</h4>
                  </div>
                  <Badge className={`text-xs ${getPriorityBadge(alerta.prioridad)}`}>
                    {alerta.prioridad} prioridad
                  </Badge>
                </div>
                
                <p className="text-sm text-gray-700 mb-3">{alerta.descripcion}</p>
                
                <div className="mb-3">
                  <h5 className="text-sm font-medium text-gray-800 mb-2">Sugerencias de acción:</h5>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {alerta.sugerencias.map((sugerencia, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600">•</span>
                        {sugerencia}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Detectado: {alerta.fechaDeteccion}</span>
                  <Button size="sm" variant="outline" className="text-xs px-2 py-1">
                    Tomar acción
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Follow-up Reminders */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Recordatorios de Seguimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recordatorios.map((recordatorio, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200"
              >
                <Clock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
                      {recordatorio.fecha}
                    </Badge>
                  </div>
                  <h5 className="text-sm font-medium text-gray-800">{recordatorio.accion}</h5>
                  <p className="text-xs text-gray-600">{recordatorio.descripcion}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-xs px-2 py-1">
                  ✓ Marcar
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertasPredictivas;