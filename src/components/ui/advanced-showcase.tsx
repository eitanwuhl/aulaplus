import React, { useState } from "react"
import { motion } from "framer-motion"
import { 
  GraduationCap, 
  Users, 
  TrendingUp, 
  Award, 
  BookOpen, 
  Target,
  Sparkles,
  Star,
  Clock,
  BarChart3
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card"
import { Button } from "./button"
import { Progress } from "./progress"
import { Badge } from "./badge"
import { EnhancedCard } from "./enhanced-card"

// Advanced Metric Card with Phase 3 Design
interface MetricCardProps {
  title: string
  value: string
  change: string
  trend: "up" | "down" | "neutral"
  icon: React.ReactNode
  gradient?: "primary" | "secondary" | "accent"
  delay?: number
}

const MetricCard = ({ 
  title, 
  value, 
  change, 
  trend, 
  icon, 
  gradient = "primary",
  delay = 0 
}: MetricCardProps) => {
  const gradientClasses = {
    primary: "bg-gradient-primary",
    secondary: "bg-gradient-secondary", 
    accent: "bg-gradient-accent"
  }

  const trendColors = {
    up: "text-success",
    down: "text-error",
    neutral: "text-muted-foreground"
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="group"
    >
      <Card className="hover-lift border-0 shadow-elegant hover:shadow-glow-primary backdrop-blur-sm bg-card/80">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className="space-y-1">
                <h3 className="text-3xl font-bold gradient-text group-hover:animate-glow-pulse">
                  {value}
                </h3>
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-medium ${trendColors[trend]}`}>
                    {change}
                  </span>
                  <span className="text-xs text-muted-foreground">vs mes anterior</span>
                </div>
              </div>
            </div>
            
            <div className={`p-3 rounded-xl ${gradientClasses[gradient]} group-hover:animate-bounce-in`}>
              <div className="text-white">
                {icon}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Advanced Progress Ring Component
interface ProgressRingProps {
  progress: number
  size?: "sm" | "md" | "lg"
  color?: "primary" | "secondary" | "accent"
  children?: React.ReactNode
}

const ProgressRing = ({ 
  progress, 
  size = "md", 
  color = "primary", 
  children 
}: ProgressRingProps) => {
  const sizes = {
    sm: { width: 60, stroke: 3 },
    md: { width: 80, stroke: 4 },
    lg: { width: 120, stroke: 6 }
  }
  
  const colors = {
    primary: "stroke-primary",
    secondary: "stroke-secondary",
    accent: "stroke-accent"
  }

  const { width, stroke } = sizes[size]
  const radius = (width - stroke * 2) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = `${circumference} ${circumference}`
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="progress-ring" style={{ width, height: width }}>
      <svg
        className="transform -rotate-90"
        width={width}
        height={width}
      >
        <circle
          className="text-muted stroke-current opacity-25"
          strokeWidth={stroke}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={width / 2}
          cy={width / 2}
        />
        <motion.circle
          className={`${colors[color]} drop-shadow-glow-primary`}
          strokeWidth={stroke}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={width / 2}
          cy={width / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}

// Advanced Activity Feed Component
const ActivityFeed = () => {
  const activities = [
    {
      id: 1,
      type: "achievement",
      title: "Nueva certificación completada",
      description: "María González completó el módulo de Matemáticas Avanzadas",
      time: "Hace 5 minutos",
      icon: <Award className="w-4 h-4" />,
      color: "accent"
    },
    {
      id: 2,
      type: "progress",
      title: "Progreso del grupo 8°A",
      description: "El grupo alcanzó 85% de completitud en el proyecto",
      time: "Hace 15 minutos",
      icon: <TrendingUp className="w-4 h-4" />,
      color: "secondary"
    },
    {
      id: 3,
      type: "new_student",
      title: "Nuevo estudiante registrado",
      description: "Carlos Pérez se unió al grupo 7°B",
      time: "Hace 1 hora",
      icon: <Users className="w-4 h-4" />,
      color: "primary"
    }
  ]

  return (
    <Card className="hover-lift">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Actividad Reciente
        </CardTitle>
        <CardDescription>
          Últimas actividades en el aula
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 scrollbar-thin max-h-64 overflow-y-auto">
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className={`p-2 rounded-lg bg-${activity.color}/10 text-${activity.color}`}>
              {activity.icon}
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-medium">{activity.title}</h4>
              <p className="text-xs text-muted-foreground">{activity.description}</p>
              <time className="text-xs text-muted-foreground">{activity.time}</time>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  )
}

// Advanced Performance Chart Component
const PerformanceChart = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("week")
  
  const periods = [
    { value: "day", label: "Día" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mes" },
    { value: "year", label: "Año" }
  ]

  const data = [
    { subject: "Matemáticas", progress: 85, students: 28 },
    { subject: "Ciencias", progress: 92, students: 25 },
    { subject: "Lengua", progress: 78, students: 30 },
    { subject: "Historia", progress: 88, students: 27 },
    { subject: "Inglés", progress: 95, students: 22 }
  ]

  return (
    <Card className="hover-lift glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 gradient-text">
              <BarChart3 className="w-5 h-5" />
              Rendimiento por Materia
            </CardTitle>
            <CardDescription>
              Progreso promedio de los estudiantes
            </CardDescription>
          </div>
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {periods.map((period) => (
              <Button
                key={period.value}
                variant={selectedPeriod === period.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedPeriod(period.value)}
                className="h-8 px-3"
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((subject, index) => (
          <motion.div
            key={subject.subject}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h4 className="font-medium">{subject.subject}</h4>
                <Badge variant="secondary" className="text-xs">
                  {subject.students} estudiantes
                </Badge>
              </div>
              <span className="text-sm font-bold text-primary">
                {subject.progress}%
              </span>
            </div>
            <Progress 
              value={subject.progress} 
              className="h-2 bg-muted-dark"
            />
          </motion.div>
        ))}
      </CardContent>
    </Card>
  )
}

// Main Advanced Showcase Component
export const AdvancedShowcase = () => {
  return (
    <div className="space-y-8 p-6">
      {/* Header with gradient text */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="responsive-heading font-bold gradient-text">
          Panel de Control Avanzado
        </h1>
        <p className="responsive-text text-muted-foreground max-w-2xl mx-auto">
          Sistema educativo con diseño avanzado, animaciones fluidas y componentes interactivos
        </p>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Estudiantes"
          value="1,247"
          change="+12%"
          trend="up"
          icon={<Users className="w-6 h-6" />}
          gradient="primary"
          delay={0}
        />
        <MetricCard
          title="Cursos Activos"
          value="34"
          change="+5%"
          trend="up"
          icon={<BookOpen className="w-6 h-6" />}
          gradient="secondary"
          delay={0.1}
        />
        <MetricCard
          title="Promedio General"
          value="87.5%"
          change="+2.3%"
          trend="up"
          icon={<Target className="w-6 h-6" />}
          gradient="accent"
          delay={0.2}
        />
        <MetricCard
          title="Certificaciones"
          value="156"
          change="+18%"
          trend="up"
          icon={<Award className="w-6 h-6" />}
          gradient="primary"
          delay={0.3}
        />
      </div>

      {/* Advanced Components Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Rings Section */}
        <EnhancedCard variant="elevated" className="space-y-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Progreso Global
            </CardTitle>
            <CardDescription>
              Rendimiento por áreas académicas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center space-y-2">
                <ProgressRing progress={87} color="primary" size="md">
                  <span className="text-sm font-bold">87%</span>
                </ProgressRing>
                <p className="text-xs text-muted-foreground">Matemáticas</p>
              </div>
              <div className="text-center space-y-2">
                <ProgressRing progress={92} color="secondary" size="md">
                  <span className="text-sm font-bold">92%</span>
                </ProgressRing>
                <p className="text-xs text-muted-foreground">Ciencias</p>
              </div>
              <div className="text-center space-y-2">
                <ProgressRing progress={78} color="accent" size="md">
                  <span className="text-sm font-bold">78%</span>
                </ProgressRing>
                <p className="text-xs text-muted-foreground">Lengua</p>
              </div>
              <div className="text-center space-y-2">
                <ProgressRing progress={95} color="primary" size="md">
                  <span className="text-sm font-bold">95%</span>
                </ProgressRing>
                <p className="text-xs text-muted-foreground">Historia</p>
              </div>
            </div>
          </CardContent>
        </EnhancedCard>

        {/* Activity Feed */}
        <ActivityFeed />

        {/* Performance Chart */}
        <PerformanceChart />
      </div>

      {/* Floating Action Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Button 
          size="lg" 
          className="rounded-full h-14 w-14 bg-gradient-primary shadow-glow-primary hover:shadow-glow-primary"
        >
          <GraduationCap className="w-6 h-6" />
        </Button>
      </motion.div>
    </div>
  )
}

export default AdvancedShowcase