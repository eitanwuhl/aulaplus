
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DiagnosticResults from "@/components/DiagnosticResults";

interface DiagnosticQuestion {
  id: number;
  question: string;
  options: {
    value: string;
    text: string;
    style: 'visual' | 'auditivo' | 'lector' | 'kinestesico';
  }[];
}

const diagnosticQuestions: DiagnosticQuestion[] = [
  {
    id: 1,
    question: "Cuando quiero aprender algo nuevo, prefiero:",
    options: [
      { value: "a", text: "Ver diagramas, esquemas o gráficos.", style: "visual" },
      { value: "b", text: "Escuchar una explicación o una charla.", style: "auditivo" },
      { value: "c", text: "Leer textos o apuntes.", style: "lector" },
      { value: "d", text: "Probarlo yo mismo/a y practicar.", style: "kinestesico" }
    ]
  },
  {
    id: 2,
    question: "Cuando doy indicaciones a otra persona, normalmente:",
    options: [
      { value: "a", text: "Le muestro cómo se hace con imágenes o gestos.", style: "visual" },
      { value: "b", text: "Le explico verbalmente lo que tiene que hacer.", style: "auditivo" },
      { value: "c", text: "Le escribo las instrucciones.", style: "lector" },
      { value: "d", text: "Le digo que lo intente mientras lo voy guiando.", style: "kinestesico" }
    ]
  },
  {
    id: 3,
    question: "Para recordar mejor algo, suelo:",
    options: [
      { value: "a", text: "Imaginarlo en mi cabeza como una imagen.", style: "visual" },
      { value: "b", text: "Repetirlo en voz alta o escucharlo de nuevo.", style: "auditivo" },
      { value: "c", text: "Escribirlo varias veces.", style: "lector" },
      { value: "d", text: "Hacer una actividad práctica relacionada.", style: "kinestesico" }
    ]
  },
  {
    id: 4,
    question: "En clase, lo que más me ayuda a entender es:",
    options: [
      { value: "a", text: "Que usen imágenes, videos o mapas.", style: "visual" },
      { value: "b", text: "Que el/la docente explique oralmente.", style: "auditivo" },
      { value: "c", text: "Leer lo que está escrito en la pizarra o el libro.", style: "lector" },
      { value: "d", text: "Hacer actividades o moverme.", style: "kinestesico" }
    ]
  },
  {
    id: 5,
    question: "Cuando tengo que elegir un regalo para alguien, prefiero:",
    options: [
      { value: "a", text: "Ver cosas en una tienda o catálogo con imágenes.", style: "visual" },
      { value: "b", text: "Escuchar lo que esa persona me dijo que le gusta.", style: "auditivo" },
      { value: "c", text: "Leer una lista de posibles opciones.", style: "lector" },
      { value: "d", text: "Hacerle algo con mis propias manos.", style: "kinestesico" }
    ]
  },
  {
    id: 6,
    question: "En una prueba, me va mejor cuando:",
    options: [
      { value: "a", text: "Hay dibujos o esquemas para interpretar.", style: "visual" },
      { value: "b", text: "Puedo responder oralmente.", style: "auditivo" },
      { value: "c", text: "Hay preguntas para leer y escribir.", style: "lector" },
      { value: "d", text: "Puedo hacer algo práctico.", style: "kinestesico" }
    ]
  },
  {
    id: 7,
    question: "Cuando no entiendo algo, prefiero que:",
    options: [
      { value: "a", text: "Me lo muestren con ejemplos visuales.", style: "visual" },
      { value: "b", text: "Me lo expliquen hablando.", style: "auditivo" },
      { value: "c", text: "Me lo den por escrito.", style: "lector" },
      { value: "d", text: "Me dejen probarlo hasta que lo entienda.", style: "kinestesico" }
    ]
  },
  {
    id: 8,
    question: "Cuando estudio, prefiero:",
    options: [
      { value: "a", text: "Usar colores, destacadores y organizadores visuales.", style: "visual" },
      { value: "b", text: "Escuchar música o leer en voz alta.", style: "auditivo" },
      { value: "c", text: "Tomar apuntes y hacer resúmenes escritos.", style: "lector" },
      { value: "d", text: "Caminar mientras repaso o usar objetos para ayudarme.", style: "kinestesico" }
    ]
  },
  {
    id: 9,
    question: "En mi tiempo libre, prefiero:",
    options: [
      { value: "a", text: "Ver videos, películas o mirar imágenes.", style: "visual" },
      { value: "b", text: "Escuchar música, podcasts o conversar.", style: "auditivo" },
      { value: "c", text: "Leer libros, revistas o navegar en internet.", style: "lector" },
      { value: "d", text: "Hacer deportes, manualidades o actividades físicas.", style: "kinestesico" }
    ]
  },
  {
    id: 10,
    question: "Cuando conozco un lugar nuevo, me oriento mejor:",
    options: [
      { value: "a", text: "Viendo un mapa o señales visuales.", style: "visual" },
      { value: "b", text: "Preguntando direcciones a otras personas.", style: "auditivo" },
      { value: "c", text: "Leyendo las indicaciones escritas.", style: "lector" },
      { value: "d", text: "Caminando y explorando hasta ubicarme.", style: "kinestesico" }
    ]
  }
];

const StudentDiagnostic = () => {
  const [currentStep, setCurrentStep] = useState<'questions' | 'results'>('questions');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [studentData, setStudentData] = useState<any>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNextQuestion = () => {
    if (currentQuestion < diagnosticQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      calculateResults();
    }
  };

  const calculateResults = () => {
    const styleCount = {
      visual: 0,
      auditivo: 0,
      lector: 0,
      kinestesico: 0
    };

    // Contar respuestas por estilo
    diagnosticQuestions.forEach(question => {
      const answer = answers[question.id];
      if (answer) {
        const selectedOption = question.options.find(opt => opt.value === answer);
        if (selectedOption) {
          styleCount[selectedOption.style]++;
        }
      }
    });

    // Determinar estilos predominantes (más del 25% de las respuestas)
    const totalAnswers = Object.keys(answers).length;
    const threshold = Math.ceil(totalAnswers * 0.25);
    
    const predominantStyles = Object.entries(styleCount)
      .filter(([_, count]) => count >= threshold)
      .sort(([, a], [, b]) => b - a)
      .map(([style]) => style);

    // Si no hay estilos predominantes claros, tomar los dos más altos
    if (predominantStyles.length === 0) {
      const sortedStyles = Object.entries(styleCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([style]) => style);
      predominantStyles.push(...sortedStyles);
    }

    const styleNames = {
      visual: 'Visual',
      auditivo: 'Auditivo', 
      lector: 'Lector/Escritor',
      kinestesico: 'Kinestésico'
    };

    const profileData = {
      code: user?.username || 'EST001',
      learningStyle: predominantStyles.map(style => styleNames[style as keyof typeof styleNames]).join('-'),
      styleBreakdown: styleCount,
      answers: answers
    };

    setStudentData(profileData);
    setCurrentStep('results');
  };

  const handleBackToHome = () => {
    logout(); // Clear student session
    navigate('/'); // Go back to role selection
  };

  const handleViewDetailedResults = () => {
    // For now, just go back to home as well
    handleBackToHome();
  };

  const isAnswered = answers[diagnosticQuestions[currentQuestion]?.id];
  const progress = ((currentQuestion + 1) / diagnosticQuestions.length) * 100;


  if (currentStep === 'questions') {
    const question = diagnosticQuestions[currentQuestion];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header con botón de regreso */}
          <div className="flex justify-between items-center mb-6">
            <Button 
              variant="ghost" 
              onClick={handleBackToHome}
              className="text-primary hover:text-primary-600"
            >
              <Home className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>
          </div>

          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6"
          >
            <div className="bg-card rounded-lg p-4 mb-6 shadow-sm border border-card-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-foreground-subtle">
                  Pregunta {currentQuestion + 1} de {diagnosticQuestions.length}
                </span>
                <span className="text-sm text-primary font-medium">
                  {Math.round(progress)}% completo
                </span>
              </div>
              <div className="w-full bg-secondary-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl text-foreground">
                  {question.question}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={answers[question.id] || ''}
                  onValueChange={(value) => handleAnswerChange(question.id, value)}
                  className="space-y-4"
                >
                  {question.options.map((option) => (
                    <div key={option.value} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-secondary-50 transition-colors">
                      <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} className="mt-1" />
                      <Label 
                        htmlFor={`${question.id}-${option.value}`}
                        className="text-foreground cursor-pointer flex-1 leading-relaxed"
                      >
                        <span className="font-medium text-primary mr-2">{option.value})</span>
                        {option.text}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <div className="flex justify-between mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestion === 0}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Anterior
                  </Button>
                  <Button
                    onClick={handleNextQuestion}
                    disabled={!isAnswered}
                    variant="secondary"
                  >
                    {currentQuestion === diagnosticQuestions.length - 1 ? 'Finalizar' : 'Siguiente'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  if (currentStep === 'results' && studentData) {
    return (
      <DiagnosticResults 
        studentData={studentData} 
        onContinue={handleViewDetailedResults}
      />
    );
  }

  return null;
};

export default StudentDiagnostic;
