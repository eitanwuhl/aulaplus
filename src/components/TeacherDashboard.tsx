import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  Bell, 
  Users, 
  User,
  TrendingUp, 
  BookOpen, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Calendar,
  MessageSquare
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const motivationalQuotes = [
  "Un maestro afecta la eternidad; no puede decir dónde termina su influencia. - Henry Adams",
  "La educación es el arma más poderosa que puedes usar para cambiar el mundo. - Nelson Mandela",
  "Enseñar es aprender dos veces. - Joseph Joubert",
  "El buen maestro hace que el mal estudiante se convierta en bueno y el buen estudiante en superior. - Marva Collins",
  "La mejor enseñanza es la que utiliza la menor cantidad de palabras necesarias para la tarea. - Maria Montessori",
  "Un profesor trabaja para la eternidad: nadie puede predecir dónde acabará su influencia. - Henry Brooks Adams",
  "La educación no es preparación para la vida; la educación es la vida misma. - John Dewey",
  "El arte de enseñar es el arte de ayudar a descubrir. - Mark Van Doren",
  "La enseñanza que deja huella no es la que se hace de cabeza a cabeza, sino de corazón a corazón. - Howard G. Hendricks",
  "Un maestro inspira esperanza, enciende la imaginación y cultiva el amor por el aprendizaje. - Brad Henry",
  "La educación es el pasaporte hacia el futuro, el mañana pertenece a aquellos que se preparan para él hoy. - Malcolm X",
  "La guerra contra la ignorancia comienza en el aula. - Victor Hugo",
  "Educaar la mente sin educar el corazón no es educar en absoluto. - Aristóteles",
  "El maestro que intenta enseñar sin inspirar en el alumno el deseo de aprender está tratando de forjar un hierro frío. - Horace Mann",
  "La educación es el movimiento de la oscuridad a la luz. - Allan Bloom"
];

const notifications = [
  {
    id: 1,
    type: "info",
    title: "Comunicación de la psicopedagoga",
    message: "Se actualizó el informe de Santiago Pérez. Ver informe actualizado y sugerencias en el perfil del alumno",
    time: "hace 30 min",
    icon: User,
    link: "/teacher-groups"
  },
  {
    id: 2,
    type: "urgent",
    title: "Comunicación del equipo directivo",
    message: "Ana Rodríguez será sometida a cirugía de vegetaciones que incide en su audición actual. Ubicarla en la primera fila",
    time: "hace 2 horas",
    icon: AlertTriangle
  },
  {
    id: 3,
    type: "info",
    title: "Mensaje del equipo directivo",
    message: "Carlos Martínez viajará representando a Uruguay a Brasil entre el 15-22 de diciembre. No marcar inasistencias ni evaluaciones en ese período",
    time: "hace 4 horas",
    icon: Calendar
  },
  {
    id: 4,
    type: "info",
    title: "Comunicación de la psicopedagoga",
    message: "Se actualizaron las contemplaciones sugeridas para Lucía Torres. Revisar ajustes en su perfil",
    time: "hace 1 día",
    icon: User,
    link: "/teacher-groups"
  }
];

const quickStats = [
  {
    title: "Estudiantes Activos",
    value: "24",
    change: "+2",
    icon: Users,
    color: "text-primary"
  },
  {
    title: "Evaluaciones Pendientes",
    value: "7",
    change: "-3",
    icon: Clock,
    color: "text-warning"
  },
  {
    title: "Promedio General",
    value: "8.2",
    change: "+0.3",
    icon: TrendingUp,
    color: "text-secondary"
  },
  {
    title: "Clases Planificadas",
    value: "12",
    change: "+4",
    icon: Calendar,
    color: "text-info"
  }
];

const TeacherDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentQuote, setCurrentQuote] = useState("");

  useEffect(() => {
    // Rotate quote every 10 seconds
    const quoteInterval = setInterval(() => {
      const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
      setCurrentQuote(randomQuote);
    }, 10000);

    // Set initial quote
    setCurrentQuote(motivationalQuotes[0]);

    return () => clearInterval(quoteInterval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl p-6 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              ¡Hola, {user?.name}!
            </h1>
            <p className="text-primary-100 text-lg">
              Bienvenido de vuelta. Tienes nuevas actualizaciones esperándote.
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => navigate('/teacher-groups')}
            >
              <Users className="w-4 h-4 mr-2" />
              Ver Grupos
            </Button>
          </div>
        </div>
      </motion.div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notifications */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2 text-primary" />
                Notificaciones Importantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-card-hover transition-colors cursor-pointer"
                  onClick={() => notification.link && navigate(notification.link)}
                >
                  <div className={`p-2 rounded-full ${
                    notification.type === 'urgent' ? 'bg-warning-100 text-warning' :
                    notification.type === 'success' ? 'bg-secondary-100 text-secondary' :
                    'bg-primary-100 text-primary'
                  }`}>
                    <notification.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium">{notification.title}</h4>
                      <Badge variant={
                        notification.type === 'urgent' ? 'destructive' :
                        notification.type === 'success' ? 'secondary' : 'default'
                      }>
                        {notification.type === 'urgent' ? 'Urgente' : 'Info'}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground-subtle">{notification.message}</p>
                    <p className="text-xs text-foreground-subtle mt-1">{notification.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Motivational Quote & Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-6"
        >
          {/* Motivational Quote */}
          <Card className="bg-gradient-to-br from-accent-50 to-secondary-50">
            <CardHeader>
              <CardTitle className="text-lg text-center">💡 Inspiración del Día</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.blockquote
                key={currentQuote}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-sm italic text-center text-foreground-subtle leading-relaxed"
              >
                "{currentQuote}"
              </motion.blockquote>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/planificacion')}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Planificar Clase
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/evaluaciones')}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Generar Evaluaciones
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/comunicaciones')}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Comunicaciones
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default TeacherDashboard;