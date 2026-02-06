import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { ArrowLeft, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const StudentLogin = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Always succeeds - no validation
      const success = await login('student', credentials);
      
      if (success) {
        toast({
          title: "¡Bienvenido!",
          description: "Has ingresado exitosamente. Comenzando diagnóstico...",
        });
        navigate('/student-diagnostic');
      }
    } catch (error) {
      // Even on error, try to navigate (login always succeeds)
      console.error('Login error:', error);
      toast({
        title: "¡Bienvenido!",
        description: "Has ingresado exitosamente. Comenzando diagnóstico...",
      });
      navigate('/student-diagnostic');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-card border border-card-border rounded-2xl p-8 shadow-lg"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-secondary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Acceso Estudiante</h1>
            <p className="text-foreground-subtle">Ingresa tu código y contraseña</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="studentCode">Código de Estudiante</Label>
              <Input
                id="studentCode"
                type="text"
                placeholder="Ej: EST2024001"
                value={credentials.username}
                onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                className="h-12"
              />
            </div>

            <Button 
              type="submit" 
              variant="secondary"
              className="w-full h-12"
              disabled={isLoading}
            >
              {isLoading ? "Ingresando..." : "Ingresar y Comenzar Diagnóstico"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-foreground-subtle mb-4">
              Demo: Cualquier código y contraseña son válidos
            </p>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-secondary hover:text-secondary-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a selección de rol
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StudentLogin;