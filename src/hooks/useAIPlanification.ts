import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AIPlanificationProps {
  subject: string;
  content: string[];
  groupName: string;
  students: any[];
  dominantProfile: string;
  objective?: string;
}

export const useAIPlanification = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const generateSuggestions = useCallback(async (props: AIPlanificationProps) => {
    setIsGenerating(true);
    
    try {
      const adaptations = props.students
        .filter(s => s.contemplaciones && s.contemplaciones.length > 0)
        .map(s => `${s.name}: ${s.contemplaciones.join(', ')}`)
        .join('\n');

      const context = `
PLANIFICACIÓN DE CLASE - CONTEXTO:
- Materia: ${props.subject}
- Contenidos: ${props.content.join(', ')}
- Grupo: ${props.groupName}
- Estudiantes: ${props.students.length}
- Perfil dominante: ${props.dominantProfile}
- Objetivo: ${props.objective || 'No especificado'}

ESTUDIANTES CON ADAPTACIONES:
${adaptations || 'Ninguno con adaptaciones específicas'}
      `;

      const { data, error } = await supabase.functions.invoke('modify-evaluation', {
        body: {
          type: 'planning',
          modification: `Genera un plan de clase detallado de 80 minutos para ${props.subject} sobre "${props.content.join(' y ')}".
          
Incluye:
1. APERTURA (15 min) - actividad motivadora específica
2. DESARROLLO (45 min) - estrategias principales adaptadas al perfil ${props.dominantProfile}
3. CIERRE (20 min) - síntesis y evaluación
4. ADAPTACIONES específicas para estudiantes con contemplaciones
5. RECURSOS Y MATERIALES necesarios
6. ACTIVIDADES ALTERNATIVAS para diferentes estilos de aprendizaje

Haz el plan práctico, específico y aplicable.`,
          groupContext: {
            subject: props.subject,
            content: props.content,
            groupName: props.groupName,
            students: props.students,
            dominantProfile: props.dominantProfile,
            objective: props.objective,
            additionalContext: context
          }
        }
      });

      if (error) throw error;
      
      const suggestionsList = data.content
        ?.split('\n')
        .filter((line: string) => line.trim().length > 0)
        .map((line: string) => line.replace(/^[-•*]\s*/, '').trim())
        || [];
        
      setSuggestions(suggestionsList);
      return suggestionsList;
      
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      const fallbackSuggestions = [
        'Error al conectar con IA. Intente nuevamente.',
        `Para ${props.subject}, considere estas actividades básicas:`,
        '• Actividad inicial conectada con experiencias previas',
        '• Explicación conceptual con ejemplos concretos',
        '• Práctica guiada y trabajo colaborativo',
        '• Síntesis final y conexiones interdisciplinarias'
      ];
      setSuggestions(fallbackSuggestions);
      return fallbackSuggestions;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const modifySuggestions = useCallback(async (modification: string, currentSuggestions: string[]) => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('modify-evaluation', {
        body: {
          type: 'planning',
          originalEvaluation: currentSuggestions.join('\n'),
          modification: `Modifica estas sugerencias de planificación: ${modification}`,
          groupContext: {}
        }
      });

      if (error) throw error;
      
      const modifiedSuggestions = data.content
        ?.split('\n')
        .filter((line: string) => line.trim().length > 0)
        || currentSuggestions;
        
      setSuggestions(modifiedSuggestions);
      return modifiedSuggestions;
      
    } catch (error) {
      console.error('Error modifying suggestions:', error);
      return currentSuggestions;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    suggestions,
    isGenerating,
    generateSuggestions,
    modifySuggestions,
    setSuggestions
  };
};