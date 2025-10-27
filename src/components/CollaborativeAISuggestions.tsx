import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { MessageCircle, ThumbsUp, ThumbsDown, HelpCircle, Lightbulb, BookOpen, Users } from 'lucide-react';

interface AISuggestion {
  id: string;
  type: 'question' | 'suggestion' | 'insight';
  title: string;
  content: string;
  context: string;
  responses?: { yes: number; no: number; more_info: number };
}

interface CollaborativeAISuggestionsProps {
  studentName: string;
  studentId: number;
}

const CollaborativeAISuggestions = ({ studentName, studentId }: CollaborativeAISuggestionsProps) => {
  const [suggestions] = useState<AISuggestion[]>([
    {
      id: '1',
      type: 'question',
      title: '¿Has notado patrones similares en otras materias?',
      content: 'He observado que mencionaste dificultades de concentración en Lengua. ¿Has notado si esto también ocurre en Matemática o Ciencias, especialmente en actividades que requieren lectura de enunciados?',
      context: 'Basado en tu observación sobre concentración en lectura',
      responses: { yes: 0, no: 0, more_info: 0 }
    },
    {
      id: '2',
      type: 'suggestion',
      title: 'Estrategia de agrupamiento dinámico',
      content: 'Considerando que el estudiante responde mejor en grupos pequeños, ¿te parece útil implementar una rotación de grupos donde pueda trabajar con diferentes compañeros según la actividad?',
      context: 'Basado en tu observación sobre preferencias sociales',
      responses: { yes: 0, no: 0, more_info: 0 }
    },
    {
      id: '3',
      type: 'insight',
      title: 'Conexión entre aprendizaje visual y social',
      content: '¿Has considerado combinar su preferencia por explicaciones visuales con el trabajo en grupos pequeños? Esto podría potenciar su aprendizaje significativamente.',
      context: 'Combinando observaciones académicas y sociales',
      responses: { yes: 0, no: 0, more_info: 0 }
    },
    {
      id: '4',
      type: 'question',
      title: '¿Podríamos explorar factores externos?',
      content: 'Las dificultades de concentración pueden tener múltiples causas. ¿Has observado si hay momentos del día, situaciones específicas, o cambios recientes en su entorno que puedan estar influyendo?',
      context: 'Análisis integral de factores',
      responses: { yes: 0, no: 0, more_info: 0 }
    }
  ]);

  const [responses, setResponses] = useState<Record<string, string>>({});

  const handleResponse = (suggestionId: string, responseType: 'yes' | 'no' | 'more_info') => {
    setResponses(prev => ({ ...prev, [suggestionId]: responseType }));
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'question': return <HelpCircle className="w-5 h-5 text-blue-600" />;
      case 'suggestion': return <Lightbulb className="w-5 h-5 text-yellow-600" />;
      case 'insight': return <BookOpen className="w-5 h-5 text-purple-600" />;
      default: return <MessageCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'question': return 'bg-blue-50 border-blue-200';
      case 'suggestion': return 'bg-yellow-50 border-yellow-200';
      case 'insight': return 'bg-purple-50 border-purple-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'question': return 'Pregunta reflexiva';
      case 'suggestion': return 'Sugerencia práctica';
      case 'insight': return 'Conexión pedagógica';
      default: return 'Sugerencia';
    }
  };

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary" />
          Sugerencias Colaborativas de IA - {studentName}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          La IA analiza tus observaciones y te ofrece preguntas reflexivas y sugerencias para explorar
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`p-4 rounded-lg border ${getSuggestionColor(suggestion.type)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getSuggestionIcon(suggestion.type)}
                  <Badge variant="outline" className="text-xs">
                    {getTypeLabel(suggestion.type)}
                  </Badge>
                </div>
              </div>
              
              <h4 className="font-semibold text-foreground mb-2">{suggestion.title}</h4>
              <p className="text-sm text-muted-foreground mb-2">{suggestion.content}</p>
              
              <div className="text-xs text-muted-foreground mb-3 italic">
                {suggestion.context}
              </div>
              
              {responses[suggestion.id] ? (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    ✓ Respondido: {responses[suggestion.id] === 'yes' ? 'Sí, me parece útil' : 
                                  responses[suggestion.id] === 'no' ? 'No aplicable' : 'Necesito más información'}
                  </Badge>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleResponse(suggestion.id, 'yes')}
                    className="text-xs"
                  >
                    <ThumbsUp className="w-3 h-3 mr-1" />
                    Sí, me parece útil
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleResponse(suggestion.id, 'no')}
                    className="text-xs"
                  >
                    <ThumbsDown className="w-3 h-3 mr-1" />
                    No aplicable
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleResponse(suggestion.id, 'more_info')}
                    className="text-xs"
                  >
                    <HelpCircle className="w-3 h-3 mr-1" />
                    Necesito más información
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
        
        <div className="mt-6 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">¿Tienes más observaciones que compartir?</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Cuanto más compartas sobre {studentName}, más precisas serán las sugerencias de la IA para ayudarte a potenciar su aprendizaje.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CollaborativeAISuggestions;