// Utilidad para limpiar contenido de evaluación y eliminar artefactos

export interface CleanEvaluationContent {
  pureContent: string; // Contenido pedagógico completo (con mini-rúbricas por ítem)
  extractedRubrics: string[]; // Solo rúbricas globales separadas
  visualResources: string[]; // Recursos visuales independientes
  organizers: string[]; // Organizadores gráficos independientes
}

export const ContentCleaner = {
  // Limpiar artefactos técnicos básicos
  cleanHTMLArtifacts: (content: string): string => {
    return content
      .replace(/```[\s\S]*?```/g, '') // Remover bloques de código
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Normalizar saltos de línea múltiples
      .trim();
  },

  // Extraer solo la evaluación lista para alumno
  extractPureEvaluation: (content: string): CleanEvaluationContent => {
    let cleanContent = ContentCleaner.cleanHTMLArtifacts(content);
    
    // SOLO remover contenido meta-pedagógico que NO debe estar en la evaluación final
    const forbiddenSections = [
      // Bloques explícitamente prohibidos según especificación
      /### Expectativas de respuesta[\s\S]*?(?=###|$)/gi,
      /## Expectativas de respuesta[\s\S]*?(?=##|$)/gi,
      /\*\*Expectativas de respuesta:\*\*[\s\S]*?(?=\n\n|$)/gi,
      /### Ítems incluidos[\s\S]*?(?=###|$)/gi,
      /## Ítems incluidos[\s\S]*?(?=##|$)/gi,
      /\*\*Ítems incluidos:\*\*[\s\S]*?(?=\n\n|$)/gi,
      // Razonamientos internos de IA (prohibidos)
      /Esta evaluación fue diseñada[\s\S]*?(?=\n\n|$)/gi,
      /La evaluación contempla[\s\S]*?(?=\n\n|$)/gi,
      /Se ha considerado[\s\S]*?(?=\n\n|$)/gi,
      /El diseño de esta evaluación[\s\S]*?(?=\n\n|$)/gi,
      // Mini-rúbricas dentro del cuerpo (prohibidas)
      /### Mini-rúbrica[\s\S]*?(?=###|$)/gi,
      /\*\*Criterios de evaluación:\*\*[\s\S]*?(?=\*\*|$)/gi
    ];
    
    // Aplicar limpieza SOLO de contenido prohibido
    forbiddenSections.forEach(pattern => {
      cleanContent = cleanContent.replace(pattern, '');
    });
    
    // Extraer recursos visuales mantenidos
    const { images, organizers } = ContentCleaner.extractPlaceholders(cleanContent);
    
    return {
      pureContent: cleanContent.trim(),
      extractedRubrics: [], // No extraer rúbricas del cuerpo
      visualResources: images,
      organizers: organizers
    };
  },

  // Detectar placeholders de imágenes y organizadores
  extractPlaceholders: (content: string) => {
    const imagePlaceholders = content.match(/\[(.*?imagen.*?)\]/gi) || [];
    const organizerPlaceholders = content.match(/\[(.*?organizador.*?)\]/gi) || [];
    
    return {
      images: imagePlaceholders,
      organizers: organizerPlaceholders
    };
  }
};