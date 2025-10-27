import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card"

interface EnhancedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  animation?: boolean
  delay?: number
  variant?: "default" | "gradient" | "elevated" | "bordered"
}

const EnhancedCard = React.forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ className, hover = true, animation = true, delay = 0, variant = "default", children, ...props }, ref) => {
    const variantClasses = {
      default: "",
      gradient: "bg-gradient-to-br from-card/50 to-card border-gradient",
      elevated: "shadow-elegant hover:shadow-glow transition-shadow duration-300",
      bordered: "border-2 border-border/50 hover:border-primary/30"
    }

    const cardContent = (
      <Card
        ref={ref}
        className={cn(
          "transition-all duration-300",
          hover && "hover:shadow-md hover:scale-[1.02] hover:-translate-y-1",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {children}
      </Card>
    )

    if (animation) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay }}
          whileHover={hover ? { scale: 1.02, y: -4 } : undefined}
        >
          {cardContent}
        </motion.div>
      )
    }

    return cardContent
  }
)

EnhancedCard.displayName = "EnhancedCard"

// Enhanced student card with better visual design
interface StudentCardProps {
  student: {
    id: number
    name: string
    perfil: string
    avatar: string
    progreso?: number
  }
  onClick: () => void
  delay?: number
}

const StudentCard = ({ student, onClick, delay = 0 }: StudentCardProps) => (
  <EnhancedCard 
    variant="elevated" 
    delay={delay}
    className="cursor-pointer group"
    onClick={onClick}
  >
    <CardContent className="p-6">
      <div className="flex items-center gap-4">
        <div className="text-3xl group-hover:scale-110 transition-transform duration-200">
          {student.avatar}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
            {student.name}
          </h3>
          <p className="text-sm text-muted-foreground mb-2">{student.perfil}</p>
          {student.progreso !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progreso</span>
                <span className="font-medium">{student.progreso}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div 
                  className="bg-gradient-primary h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${student.progreso}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </CardContent>
  </EnhancedCard>
)

// Enhanced group card
interface GroupCardProps {
  group: {
    id: number
    name: string
    studentCount: number
    year: string
    section: string
  }
  onClick: () => void
  delay?: number
}

const GroupCard = ({ group, onClick, delay = 0 }: GroupCardProps) => (
  <EnhancedCard
    variant="gradient"
    delay={delay}
    className="cursor-pointer group"
    onClick={onClick}
  >
    <CardHeader className="text-center">
      <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">
        👥
      </div>
      <CardTitle className="text-xl text-primary group-hover:text-primary-glow transition-colors">
        {group.name}
      </CardTitle>
      <CardDescription className="font-medium">
        {group.year} - {group.section}
      </CardDescription>
    </CardHeader>
    <CardContent className="text-center">
      <div className="flex justify-center items-center gap-2 text-muted-foreground mb-4">
        <span className="font-semibold">{group.studentCount} estudiantes</span>
      </div>
      <div className="bg-primary/10 rounded-full px-4 py-2 group-hover:bg-primary/20 transition-colors">
        <span className="text-sm font-medium text-primary">Ver perfil del grupo</span>
      </div>
    </CardContent>
  </EnhancedCard>
)

export { EnhancedCard, StudentCard, GroupCard }