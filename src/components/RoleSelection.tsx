import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { GraduationCap, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RoleSelection = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center px-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-6xl md:text-8xl font-bold text-primary mb-4">
            Aula<span className="text-secondary">+</span>
          </h1>
          <p className="text-xl md:text-2xl text-foreground-subtle mb-12">
            Mejorando la experiencia de educar y aprender
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto"
        >
          {/* Teacher Card */}
          <div className="bg-card border border-card-border rounded-2xl p-8 hover:shadow-lg transition-all duration-300 hover:scale-105">
            <div className="mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-3">Soy Docente</h2>
              <p className="text-foreground-subtle mb-6">
                Accede al panel completo de herramientas pedagógicas y análisis avanzado
              </p>
            </div>
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => navigate('/teacher-login')}
            >
              Ingresar como Docente
            </Button>
          </div>

          {/* Student Card */}
          <div className="bg-card border border-card-border rounded-2xl p-8 hover:shadow-lg transition-all duration-300 hover:scale-105">
            <div className="mb-6">
              <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-secondary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-3">Soy Alumno</h2>
              <p className="text-foreground-subtle mb-6">
                Completa tu perfil de aprendizaje y obtén recomendaciones personalizadas
              </p>
            </div>
            <Button 
              variant="secondary"
              size="lg" 
              className="w-full"
              onClick={() => navigate('/student-login')}
            >
              Ingresar como Alumno
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-12"
        >
          <p className="text-sm text-foreground-subtle">
            Esta es una demostración de Aula+. Ingresa cualquier usuario y contraseña para acceder.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RoleSelection;