import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Bell, User, AlertTriangle, Loader2 } from 'lucide-react';
import { useStudentNotifications } from '@/hooks/useStudentNotifications';
import type { DashboardNotification } from '@/services/notifications';

interface NotificacionesAlumnoProps {
  student: {
    id: number;
    name: string;
  };
}

function notificationIcon(notification: DashboardNotification) {
  return notification.type === 'urgent' ? AlertTriangle : User;
}

function getNotificationStyles(type: DashboardNotification['type']) {
  if (type === 'urgent') {
    return {
      containerClass: 'border-l-4 border-red-400 bg-red-50',
      iconBg: 'bg-red-100 text-red-600',
      badge: 'destructive' as const,
    };
  }
  return {
    containerClass: 'border-l-4 border-blue-400 bg-blue-50',
    iconBg: 'bg-blue-100 text-blue-600',
    badge: 'default' as const,
  };
}

const NotificacionesAlumno = ({ student }: NotificacionesAlumnoProps) => {
  const { notifications, isLoading, isError, error, markAsRead, markAllAsRead, isMarking } =
    useStudentNotifications(student.id);

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notificaciones del Alumno
        </CardTitle>
        <p className="text-sm text-gray-600">
          Comunicaciones del dashboard vinculadas a {student.name}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive py-4">
            {error ?? 'No se pudieron cargar las notificaciones.'}
          </p>
        )}

        {!isLoading && !isError && notifications.length === 0 && (
          <motion.div className="text-center py-6 text-gray-500">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No hay notificaciones pendientes para este alumno</p>
            <p className="text-xs mt-2 text-muted-foreground">
              Las notificaciones con enlace al alumno aparecen aquí.
            </p>
          </motion.div>
        )}

        {!isLoading && !isError && notifications.length > 0 && (
          <motion.div className="space-y-3">
            {notifications.map((notification, index) => {
              const styles = getNotificationStyles(notification.type);
              const Icon = notificationIcon(notification);

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className={`p-3 rounded-lg ${styles.containerClass} transition-all hover:shadow-sm`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-full ${styles.iconBg} flex-shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1 gap-2">
                        <h4 className="text-sm font-medium text-gray-800">{notification.title}</h4>
                        <Badge variant={styles.badge} className="text-xs shrink-0">
                          {notification.type === 'urgent' ? 'Urgente' : 'Info'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 h-7 px-2 text-xs"
                        disabled={isMarking}
                        onClick={() => markAsRead(notification.id)}
                      >
                        Marcar como leída
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {!isLoading && !isError && notifications.length > 0 && (
          <motion.div className="mt-4 pt-3 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              disabled={isMarking}
              className="w-full text-xs"
            >
              Marcar todas como leídas
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificacionesAlumno;
