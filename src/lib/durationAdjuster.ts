// Algoritmo de ajuste automático de duración para evaluaciones
// Implementa heurística específica del usuario

interface ItemEstimate {
  type: 'multiple' | 'vf' | 'short' | 'brief' | 'essay' | 'analysis' | 'organizer';
  timeMinutes: number;
  content: string;
  points?: number;
}

interface DurationBreakdown {
  items: ItemEstimate[];
  totalMinutes: number;
  overhead: number;
  finalTotal: number;
  isOnTarget: boolean;
}

export const DurationAdjuster = {
  // Heurística base según especificación del usuario
  getBaseTimeForType: (type: ItemEstimate['type']): [number, number] => {
    switch (type) {
      case 'multiple': return [1.5, 2]; // min-max minutos
      case 'vf': return [3, 4]; // V/F con justificación
      case 'short': return [5, 7]; // Respuesta corta
      case 'brief': return [10, 12]; // Desarrollo breve
      case 'essay': return [12, 15]; // Ensayo/producción extendida
      case 'analysis': return [8, 10]; // Análisis de fuente/imagen
      case 'organizer': return [6, 10]; // Organizador gráfico
      default: return [5, 7];
    }
  },

  // Analizar contenido de evaluación y categorizar ítems
  analyzeEvaluationContent: (content: string): ItemEstimate[] => {
    const items: ItemEstimate[] = [];
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      let type: ItemEstimate['type'] = 'short';
      
      // Detectar tipo de ítem por contenido
      if (lowerLine.match(/^[a-d]\)/) || lowerLine.includes('opción múltiple') || lowerLine.includes('selecciona')) {
        type = 'multiple';
      } else if (lowerLine.includes('verdadero') || lowerLine.includes('falso') || lowerLine.includes('v/f')) {
        type = 'vf';
      } else if (lowerLine.includes('analiza') || lowerLine.includes('interpreta') || 
                lowerLine.includes('imagen') || lowerLine.includes('documento') || 
                lowerLine.includes('fuente')) {
        type = 'analysis';
      } else if (lowerLine.includes('explica ampliamente') || lowerLine.includes('desarrolla') || 
                lowerLine.includes('ensayo') || lowerLine.includes('redacta un texto')) {
        type = 'essay';
      } else if (lowerLine.includes('explica') || lowerLine.includes('describe') || 
                lowerLine.includes('menciona') || lowerLine.includes('compara') ||
                lowerLine.includes('identifica')) {
        type = 'brief';
      } else if (lowerLine.includes('línea de tiempo') || lowerLine.includes('organizador') ||
                lowerLine.includes('esquema') || lowerLine.includes('mapa')) {
        type = 'organizer';
      }
      
      // Extraer puntaje si existe
      const pointsMatch = line.match(/\((\d+)\s*puntos?\)/i);
      const points = pointsMatch ? parseInt(pointsMatch[1]) : undefined;
      
      const [minTime, maxTime] = DurationAdjuster.getBaseTimeForType(type);
      const timeMinutes = (minTime + maxTime) / 2; // Promedio
      
      items.push({
        type,
        timeMinutes,
        content: line.trim(),
        points
      });
    }
    
    return items;
  },

  // Calcular duración total con overhead
  calculateTotalDuration: (items: ItemEstimate[]): DurationBreakdown => {
    const totalMinutes = items.reduce((sum, item) => sum + item.timeMinutes, 0);
    const overhead = Math.ceil(totalMinutes * 0.05); // +5% overhead
    const finalTotal = totalMinutes + overhead;
    
    return {
      items,
      totalMinutes,
      overhead,
      finalTotal,
      isOnTarget: Math.abs(finalTotal - 90) <= 2 // Margen de 2 minutos
    };
  },

  // Ajustar automáticamente hasta calzar con tiempo objetivo
  adjustToTargetTime: (content: string, targetMinutes: number = 90): string => {
    let items = DurationAdjuster.analyzeEvaluationContent(content);
    let breakdown = DurationAdjuster.calculateTotalDuration(items);
    
    // Intentos de ajuste automático
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!breakdown.isOnTarget && attempts < maxAttempts) {
      attempts++;
      
      if (breakdown.finalTotal > targetMinutes + 2) {
        // Reducir tiempo - Prioridad de recorte según especificación
        items = DurationAdjuster.reduceTime(items, breakdown.finalTotal - targetMinutes);
      } else if (breakdown.finalTotal < targetMinutes - 2) {
        // Agregar tiempo
        items = DurationAdjuster.increaseTime(items, targetMinutes - breakdown.finalTotal);
      }
      
      breakdown = DurationAdjuster.calculateTotalDuration(items);
    }
    
    return DurationAdjuster.reconstructContent(items);
  },

  // Estrategias de reducción según especificación del usuario
  reduceTime: (items: ItemEstimate[], excessMinutes: number): ItemEstimate[] => {
    const itemsCopy = [...items];
    let remainingReduction = excessMinutes;
    
    // 1. Reducir ítems redundantes en la misma competencia
    const duplicateTypes = DurationAdjuster.findDuplicateTypes(itemsCopy);
    for (const type of duplicateTypes) {
      if (remainingReduction <= 0) break;
      const typeItems = itemsCopy.filter(item => item.type === type);
      if (typeItems.length > 2) {
        // Remover un ítem del tipo más común
        const indexToRemove = itemsCopy.findIndex(item => item.type === type);
        if (indexToRemove !== -1) {
          remainingReduction -= itemsCopy[indexToRemove].timeMinutes;
          itemsCopy.splice(indexToRemove, 1);
        }
      }
    }
    
    // 2. Acortar extensión de respuestas largas
    for (let i = 0; i < itemsCopy.length && remainingReduction > 0; i++) {
      const item = itemsCopy[i];
      if (item.type === 'essay') {
        item.type = 'brief';
        const [minTime, maxTime] = DurationAdjuster.getBaseTimeForType('brief');
        const oldTime = item.timeMinutes;
        item.timeMinutes = (minTime + maxTime) / 2;
        remainingReduction -= (oldTime - item.timeMinutes);
      }
    }
    
    // 3. Sustituir V/F+justificación por múltiple opción
    for (let i = 0; i < itemsCopy.length && remainingReduction > 0; i++) {
      const item = itemsCopy[i];
      if (item.type === 'vf') {
        item.type = 'multiple';
        const [minTime, maxTime] = DurationAdjuster.getBaseTimeForType('multiple');
        const oldTime = item.timeMinutes;
        item.timeMinutes = (minTime + maxTime) / 2;
        remainingReduction -= (oldTime - item.timeMinutes);
      }
    }
    
    return itemsCopy;
  },

  // Estrategias para incrementar tiempo
  increaseTime: (items: ItemEstimate[], neededMinutes: number): ItemEstimate[] => {
    const itemsCopy = [...items];
    let remainingIncrease = neededMinutes;
    
    // 1. Ampliar una consigna existente
    const briefItems = itemsCopy.filter(item => item.type === 'brief');
    if (briefItems.length > 0 && remainingIncrease > 0) {
      const itemToExpand = briefItems[0];
      const oldTime = itemToExpand.timeMinutes;
      itemToExpand.type = 'essay';
      const [minTime, maxTime] = DurationAdjuster.getBaseTimeForType('essay');
      itemToExpand.timeMinutes = (minTime + maxTime) / 2;
      remainingIncrease -= (itemToExpand.timeMinutes - oldTime);
    }
    
    // 2. Añadir 1-2 ítems cortos
    while (remainingIncrease > 3 && itemsCopy.length < 12) {
      const [minTime, maxTime] = DurationAdjuster.getBaseTimeForType('multiple');
      itemsCopy.push({
        type: 'multiple',
        timeMinutes: (minTime + maxTime) / 2,
        content: `[Ítem adicional generado - ${itemsCopy.length + 1}]`,
        points: 2
      });
      remainingIncrease -= (minTime + maxTime) / 2;
    }
    
    return itemsCopy;
  },

  // Utilitarios
  findDuplicateTypes: (items: ItemEstimate[]): ItemEstimate['type'][] => {
    const typeCounts: Record<string, number> = {};
    items.forEach(item => {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    });
    
    return Object.keys(typeCounts)
      .filter(type => typeCounts[type] > 2) as ItemEstimate['type'][];
  },

  reconstructContent: (items: ItemEstimate[]): string => {
    // Reconstruir el contenido manteniendo la estructura original
    return items.map(item => item.content).join('\n');
  },

  // Validación final - debe devolver exactamente el tiempo objetivo
  validateDuration: (content: string, targetMinutes: number = 90): boolean => {
    const items = DurationAdjuster.analyzeEvaluationContent(content);
    const breakdown = DurationAdjuster.calculateTotalDuration(items);
    return Math.abs(breakdown.finalTotal - targetMinutes) <= 2;
  }
};