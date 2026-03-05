import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, Calendar, Check, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type NotificationType = "info" | "urgent";

type DashboardNotification = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  studentId?: number;
  groupId?: string;
};

const READ_STORAGE_KEY = "aulaplus.notifications.read";

const notifications: DashboardNotification[] = [
  {
    id: 1,
    type: "info",
    title: "Comunicacion de la psicopedagoga",
    message:
      "Se actualizo el informe de Santiago Perez. Ver informe actualizado y sugerencias en el perfil del alumno",
    time: "hace 30 min",
    studentId: 9,
  },
  {
    id: 2,
    type: "urgent",
    title: "Comunicacion del equipo directivo",
    message:
      "Ana Rodriguez sera sometida a cirugia de vegetaciones que incide en su audicion actual. Ubicarla en la primera fila",
    time: "hace 2 horas",
    studentId: 1,
  },
  {
    id: 3,
    type: "info",
    title: "Mensaje del equipo directivo",
    message:
      "Carlos Martinez viajara representando a Uruguay a Brasil entre el 15-22 de diciembre. No marcar inasistencias ni evaluaciones en ese periodo",
    time: "hace 4 horas",
  },
  {
    id: 4,
    type: "info",
    title: "Comunicacion de grupo",
    message: "Se actualizaron datos de seguimiento del grupo 9no 1",
    time: "hace 1 dia",
    groupId: "1",
  },
];

function getReadIds(): number[] {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => Number.isInteger(id));
  } catch {
    return [];
  }
}

function persistReadIds(ids: number[]): void {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore localStorage failures
  }
}

export function NotificationsPanel() {
  const navigate = useNavigate();
  const [readIds, setReadIds] = useState<number[]>(() => getReadIds());

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.includes(n.id)).length,
    [readIds]
  );

  const markAsRead = (id: number) => {
    if (readIds.includes(id)) return;
    const next = [...readIds, id];
    setReadIds(next);
    persistReadIds(next);
  };

  const handleRowClick = (notification: DashboardNotification) => {
    if (notification.studentId) {
      navigate("/teacher-groups", {
        state: { studentId: notification.studentId },
      });
      return;
    }

    if (notification.groupId) {
      navigate("/teacher-groups", { state: { groupId: notification.groupId } });
      return;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Bell className="w-5 h-5 mr-2 text-primary" />
            Notificaciones
          </span>
          {unreadCount > 0 && <Badge variant="secondary">{unreadCount} nuevas</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.map((notification) => {
          const isRead = readIds.includes(notification.id);
          const clickable = Boolean(notification.studentId || notification.groupId);
          const Icon = notification.studentId
            ? User
            : notification.groupId
            ? Calendar
            : notification.type === "urgent"
            ? AlertTriangle
            : Bell;

          return (
            <div
              key={notification.id}
              className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                isRead ? "opacity-65 bg-muted/20" : "hover:bg-card-hover"
              } ${clickable ? "cursor-pointer" : ""}`}
              onClick={clickable ? () => handleRowClick(notification) : undefined}
            >
              <div
                className={`p-2 rounded-full ${
                  notification.type === "urgent"
                    ? "bg-warning-100 text-warning"
                    : "bg-primary-100 text-primary"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <h4 className="text-sm font-medium">{notification.title}</h4>
                  <div className="flex items-center gap-2">
                    {notification.type === "urgent" && (
                      <Badge variant="destructive">Urgente</Badge>
                    )}
                    {isRead && (
                      <Badge variant="secondary" className="whitespace-nowrap">
                        Leida
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="text-sm text-foreground-subtle">{notification.message}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-foreground-subtle">{notification.time}</p>
                  <button
                    type="button"
                    className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      markAsRead(notification.id);
                    }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Marcar como leido
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export { READ_STORAGE_KEY as notificationsReadStorageKey };
