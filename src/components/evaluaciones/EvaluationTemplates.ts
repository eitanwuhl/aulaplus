export interface EvaluationTemplate {
  id: string;
  name: string;
  adaptationLevel: 'standard' | 'moderate' | 'high';
  description: string;
  structure: {
    includesHeader: boolean;
    includesCriteria: boolean;
    includesInstructions: boolean;
    includesVisualSupports: boolean;
    includesAdaptations: boolean;
  };
}

export const evaluationTemplates: EvaluationTemplate[] = [
  {
    id: 'standard',
    name: 'Evaluación Estándar',
    adaptationLevel: 'standard',
    description: 'Formato tradicional sin adaptaciones específicas',
    structure: {
      includesHeader: true,
      includesCriteria: true,
      includesInstructions: true,
      includesVisualSupports: false,
      includesAdaptations: false,
    },
  },
  {
    id: 'moderate-support',
    name: 'Evaluación con Apoyos Moderados',
    adaptationLevel: 'moderate',
    description: 'Incluye apoyos visuales y instrucciones simplificadas',
    structure: {
      includesHeader: true,
      includesCriteria: true,
      includesInstructions: true,
      includesVisualSupports: true,
      includesAdaptations: true,
    },
  },
  {
    id: 'high-adaptation',
    name: 'Evaluación Altamente Adaptada',
    adaptationLevel: 'high',
    description: 'Máximo nivel de adaptaciones y apoyos',
    structure: {
      includesHeader: true,
      includesCriteria: true,
      includesInstructions: true,
      includesVisualSupports: true,
      includesAdaptations: true,
    },
  },
];

export const getTemplateByAdaptationLevel = (level: string): EvaluationTemplate => {
  switch (level) {
    case 'moderate':
      return evaluationTemplates[1];
    case 'high':
      return evaluationTemplates[2];
    default:
      return evaluationTemplates[0];
  }
};

export const formatEvaluationTitle = (version: number, adaptationLevel?: string): string => {
  const baseTitle = `Versión ${version}`;
  
  switch (adaptationLevel) {
    case 'moderate':
      return `${baseTitle} - Evaluación con apoyos moderados`;
    case 'high':
      return `${baseTitle} - Evaluación altamente adaptada`;
    default:
      return `${baseTitle} - Evaluación estándar`;
  }
};