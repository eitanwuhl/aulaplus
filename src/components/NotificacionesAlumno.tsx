import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Bell, User, AlertTriangle, Calendar, MessageSquare, X } from 'lucide-react';

interface NotificacionesAlumnoProps {
  student: {
    id: number;
    name: string;
  };
}

const NotificacionesAlumno = ({ student }: NotificacionesAlumnoProps) => {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "info",
      title: "Comunicación de la psicopedagoga",
      message: `Se actualizó el informe de ${student.name}. Ver informe actualizado y sugerencias en el perfil del alumno`,
      time: "hace 30 min",
      icon: User,
      priority: "normal"
    },
    {
      id: 2,
      type: "urgent",
      title: "Comunicación del equipo directivo",
      message: `${student.name} será sometido a cirugía de vegetaciones que incide en su audición actual. Ubicarlo en la primera fila`,
      time: "hace 2 horas",
      icon: AlertTriangle,
      priority: "high"
    },
    {
      id: 3,
      type: "info",
      title: "Mensaje del equipo directivo",
      message: `${student.name} viajará representando a Uruguay a Brasil entre el 15-22 de diciembre. No marcar inasistencias ni evaluaciones en ese período`,
      time: "hace 4 horas",
      icon: Calendar,
      priority: "normal"
    },
    {
      id: 4,
      type: "info",
      title: "Comunicación de la psicopedagoga",
      message: `Se actualizaron las contemplaciones sugeridas para ${student.name}. Revisar ajustes en su perfil`,
      time: "hace 1 día",
      icon: User,
      priority: "normal"
    },
  ]);

  const handleMarkAsRead = (notificationId: number) => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
  };

  const getNotificationStyles = (type: string, priority: string) => {
    if (type === 'urgent' || priority === 'high') {
      return {
        containerClass: 'border-l-4 border-red-400 bg-red-50',
        iconBg: 'bg-red-100 text-red-600',
        badge: 'destructive'
      };
    }
    if (type === 'success') {
      return {
        containerClass: 'border-l-4 border-green-400 bg-green-50',
        iconBg: 'bg-green-100 text-green-600',
        badge: 'secondary'
      };
    }
    return {
      containerClass: 'border-l-4 border-blue-400 bg-blue-50',
      iconBg: 'bg-blue-100 text-blue-600',
      badge: 'default'
    };
  };

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notificaciones del Alumno
        </CardTitle>
        <p className="text-sm text-gray-600">
          Comunicaciones importantes relacionadas con {student.name}
        </p>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No hay notificaciones pendientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification, index) => {
              const styles = getNotificationStyles(notification.type, notification.priority);
              
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className={`p-3 rounded-lg ${styles.containerClass} transition-all hover:shadow-sm`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-full ${styles.iconBg} flex-shrink-0`}>
                      <notification.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-sm font-medium text-gray-800">{notification.title}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant={styles.badge as any} className="text-xs">
                            {notification.type === 'urgent' ? 'Urgente' : 
                             notification.type === 'success' ? 'Procesado' : 'Info'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="h-6 w-6 p-0 hover:bg-gray-200 rounded-full"
                            title="Marcar como leído"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        
        {notifications.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNotifications([])}
              className="w-full text-xs"
            >
              Marcar todas como leídas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificacionesAlumno;