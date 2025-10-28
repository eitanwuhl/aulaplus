import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Student {
  id: number;
  name: string;
  perfil: string;
  evaluacionesCualitativas?: {
    fecha: string;
    evaluador: string;
    area: string;
    comentario: string;
    tipo: 'docente' | 'psicopedagogico';
  }[];
}

interface UseBulletinGeneratorProps {
  student: Student;
}

export const useBulletinGenerator = ({ student }: UseBulletinGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generateBulletinText = async (period: string, customAspects: string = '') => {
    setIsGenerating(true);
    setError(null);

    try {
      // Mock data for Historia context
      const contemplaciones = [
        'Apoyo visual en evaluaciones con fuentes históricas',
        'Tiempo adicional para análisis de documentos',
        'Consignas segmentadas en debates históricos'
      ];

      const academicHistory = 'Historia: 8.5 → 9.0 puntos (mejora significativa en análisis de fuentes)';

      const { data, error: functionError } = await supabase.functions.invoke('generate-bulletin-text', {
        body: {
          student,
          period,
          contemplaciones,
          academicHistory,
          qualitativeComments: student.evaluacionesCualitativas || [],
          customAspects
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      setGeneratedText(data.generatedText);
    } catch (err) {
      console.error('Error generating bulletin text:', err);
      setError(err instanceof Error ? err.message : 'Error generando el texto del boletín');
      
      // Fallback to mock text if API fails
      const fallbackText = `${student.name} demuestra un progreso notable en Historia durante este período. Muestra avances significativos en el análisis de fuentes históricas y la construcción de líneas de tiempo, especialmente cuando se implementan apoyos visuales que potencian su comprensión de los procesos temporales.

Su participación en debates históricos refleja un pensamiento crítico en desarrollo, y se beneficia del tiempo adicional para procesar información compleja. Lo alentamos a continuar fortaleciendo sus habilidades de redacción histórica mediante el acompañamiento personalizado implementado.`;
      
      setGeneratedText(fallbackText);
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateText = (period: string, customAspects: string = '') => {
    generateBulletinText(period, customAspects);
  };

  return {
    isGenerating,
    generatedText,
    error,
    generateBulletinText,
    regenerateText,
    setGeneratedText
  };
};