
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface DiagnosticResultsProps {
  studentData: {
    code: string;
    learningStyle: string;
    styleBreakdown: {
      visual: number;
      auditivo: number;
      lector: number;
      kinestesico: number;
    };
  };
  onContinue: () => void;
}

const DiagnosticResults = ({ studentData, onContinue }: DiagnosticResultsProps) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleBackToHome = () => {
    logout(); // Clear student session
    navigate('/'); // Go back to role selection
  };
  const getStyleDescription = (style: string) => {
    const descriptions = {
      'Visual': 'Aprendes mejor a través de imágenes, diagramas, colores y organizadores visuales.',
      'Auditivo': 'Prefieres escuchar explicaciones, discusiones y repetir información en voz alta.',
      'Lector/Escritor': 'Te facilita el aprendizaje leyendo textos y tomando apuntes escritos.',
      'Kinestésico': 'Aprendes mejor a través de la experiencia práctica y el movimiento.'
    };
    
    return style.split('-').map(s => descriptions[s as keyof typeof descriptions]).join(' ');
  };

  const getStyleIcon = (style: string) => {
    if (style.includes('Visual')) return '👁️';
    if (style.includes('Auditivo')) return '👂';
    if (style.includes('Lector')) return '📚';
    if (style.includes('Kinestésico')) return '🤲';
    return '🎯';
  };

  const totalResponses = Object.values(studentData.styleBreakdown).reduce((sum, count) => sum + count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
      >
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <CardTitle className="text-3xl font-bold text-gray-800 mb-2">
              ¡Diagnóstico Completado!
            </CardTitle>
            <p className="text-gray-600">
              Hemos identificado tu estilo de aprendizaje
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <div className="text-4xl mb-2">{getStyleIcon(studentData.learningStyle)}</div>
              <h3 className="text-2xl font-bold text-blue-800 mb-2">
                {studentData.learningStyle}
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {getStyleDescription(studentData.learningStyle)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Object.entries(studentData.styleBreakdown).map(([style, count]) => {
                const styleNames = {
                  visual: 'Visual',
                  auditivo: 'Auditivo',
                  lector: 'Lector/Escritor',
                  kinestesico: 'Kinestésico'
                };
                
                const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
                
                return (
                  <div key={style} className="bg-white p-4 rounded-lg border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {styleNames[style as keyof typeof styleNames]}
                      </span>
                      <span className="text-sm text-gray-500">
                        {percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-yellow-800 mb-2">
                ¿Qué significa esto?
              </h4>
              <p className="text-yellow-700 text-sm">
                Tu perfil de aprendizaje nos ayudará a personalizar las evaluaciones y contenidos 
                para que se adapten mejor a tu forma de aprender. Las próximas actividades 
                tendrán en cuenta estas preferencias.
              </p>
            </div>

            <div className="flex gap-4">
              <Button onClick={handleBackToHome} variant="outline" className="flex-1">
                <Home className="w-4 h-4 mr-2" />
                Volver al inicio
              </Button>
              <Button onClick={onContinue} className="flex-1" size="lg">
                Ver resultados detallados
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DiagnosticResults;
