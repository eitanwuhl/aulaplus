// Utilidad para validar duración de evaluaciones y estimación de tiempo

export interface DurationEstimate {
  totalMinutes: number;
  breakdown: {
    reading: number;
    analysis: number;
    writing: number;
    review: number;
  };
  isWithinLimit: boolean;
  suggestions: string[];
}

export const DurationValidator = {
  // Estimar tiempo requerido para una evaluación
  estimateEvaluationDuration: (content: string): DurationEstimate => {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    let readingTime = 0;
    let analysisTime = 0;
    let writingTime = 0;
    
    const suggestions: string[] = [];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const wordCount = line.split(' ').length;
      
      // Tiempo de lectura (250 palabras por minuto promedio para estudiantes)
      readingTime += Math.ceil(wordCount / 250);
      
      // Análisis de fuentes
      if (lowerLine.includes('fuente') || lowerLine.includes('imagen') || lowerLine.includes('documento')) {
        analysisTime += 8; // 8 minutos por fuente/imagen
      }
      
      // Preguntas de múltiple opción
      if (lowerLine.match(/^[a-d]\)/)) {
        writingTime += 1; // 1 minuto por opción múltiple
      }
      
      // Preguntas de verdadero/falso
      if (lowerLine.includes('verdadero') || lowerLine.includes('falso')) {
        writingTime += 2; // 2 minutos por V/F con justificación
      }
      
      // Preguntas de desarrollo breve
      if (lowerLine.includes('explica') || lowerLine.includes('describe') || 
          lowerLine.includes('menciona') || lowerLine.includes('indica')) {
        writingTime += 5; // 5 minutos por respuesta breve
      }
      
      // Preguntas de desarrollo extenso
      if (lowerLine.includes('analiza') || lowerLine.includes('compara') || 
          lowerLine.includes('argumento') || lowerLine.includes('ensayo')) {
        writingTime += 12; // 12 minutos por desarrollo extenso
      }
      
      // Líneas de tiempo y organizadores
      if (lowerLine.includes('línea de tiempo') || lowerLine.includes('organizador')) {
        writingTime += 8; // 8 minutos para completar organizadores
      }
    }
    
    // Tiempo de revisión (10% del tiempo total)
    const reviewTime = Math.ceil((readingTime + analysisTime + writingTime) * 0.1);
    const totalMinutes = readingTime + analysisTime + writingTime + reviewTime;
    
    // Verificar si está dentro del límite de 90 minutos
    const isWithinLimit = totalMinutes <= 90;
    
    // Generar sugerencias si excede el límite
    if (!isWithinLimit) {
      const excess = totalMinutes - 90;
      suggestions.push(`La evaluación excede el límite por ${excess} minutos.`);
      
      if (writingTime > 45) {
        suggestions.push('Reducir cantidad de preguntas de desarrollo extenso.');
      }
      
      if (analysisTime > 30) {
        suggestions.push('Considerar usar menos fuentes o imágenes para análisis.');
      }
      
      suggestions.push('Simplificar algunas consignas o eliminar ítems menos esenciales.');
    }
    
    return {
      totalMinutes,
      breakdown: {
        reading: readingTime,
        analysis: analysisTime,
        writing: writingTime,
        review: reviewTime
      },
      isWithinLimit,
      suggestions
    };
  },

  // Validar contenido específico para 90 minutos
  validateFor90Minutes: (content: string): { valid: boolean; message: string; estimate: DurationEstimate } => {
    const estimate = DurationValidator.estimateEvaluationDuration(content);
    
    if (estimate.isWithinLimit) {
      return {
        valid: true,
        message: `Duración estimada: ${estimate.totalMinutes} minutos (dentro del límite)`,
        estimate
      };
    } else {
      return {
        valid: false,
        message: `Duración estimada: ${estimate.totalMinutes} minutos (excede ${estimate.totalMinutes - 90} min el límite)`,
        estimate
      };
    }
  },

  // Generar recomendaciones para ajustar duración
  generateDurationRecommendations: (content: string): string[] => {
    const estimate = DurationValidator.estimateEvaluationDuration(content);
    const recommendations: string[] = [];
    
    if (estimate.isWithinLimit) {
      recommendations.push('✅ La duración está dentro del límite de 90 minutos.');
      
      if (estimate.totalMinutes < 60) {
        recommendations.push('💡 Podrías agregar más actividades de análisis o síntesis.');
      }
    } else {
      recommendations.push(...estimate.suggestions);
      recommendations.push('🎯 Prioriza los contenidos más relevantes para los objetivos de aprendizaje.');
      recommendations.push('⏱️ Considera dividir la evaluación en dos partes si es necesario.');
    }
    
    return recommendations;
  },

  // Formatear estimación para mostrar al usuario
  formatDurationBreakdown: (estimate: DurationEstimate): string => {
    return `**Distribución del tiempo estimado:**
- Lectura y comprensión: ${estimate.breakdown.reading} min
- Análisis de fuentes: ${estimate.breakdown.analysis} min  
- Redacción de respuestas: ${estimate.breakdown.writing} min
- Revisión final: ${estimate.breakdown.review} min

**Total: ${estimate.totalMinutes} minutos**
${estimate.isWithinLimit ? '✅ Dentro del límite' : '⚠️ Excede el límite de 90 minutos'}`;
  }
};