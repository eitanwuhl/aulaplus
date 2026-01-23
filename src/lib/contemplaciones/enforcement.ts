/**
 * Motor de enforcement determinístico para contemplaciones
 * 
 * Este módulo genera outputs determinísticos basados en contemplaciones seleccionadas,
 * sin depender del LLM para colocar recordatorios correctamente.
 * 
 * Reglas NO negociables:
 * - Recordatorios de evaluación VAN SOLO en tarjetas de estudiante "¿A quién contempla...?"
 * - Recordatorios NO aparecen en el HTML del cuadernillo
 * - Recordatorios de plan de clase VAN SOLO en "Diferenciación/Adaptaciones" con nombres
 * - Algunas contemplaciones se implementan como reglas de diseño en cuadernillo/materiales
 */

import {
  getAllContemplaciones,
  getContemplacionById,
  type Contemplacion
} from './catalog';
import {
  readSelected,
  readCustom,
  type CustomContemplacion,
  type ContemplacionCategoryStorage
} from './storage';

export interface Student {
  id: string | number;
  name: string;
}

export interface EvaluationEnforcementOutput {
  versionDesignRules: Set<string>; // Reglas de diseño para cuadernillo/materiales
  perStudentReminders: Map<string | number, string[]>; // studentId -> reminders para tarjeta
}

export interface LessonPlanEnforcementOutput {
  diferenciacionBlock: string[]; // Líneas de texto para "Diferenciación/Adaptaciones"
}

/**
 * Template de recordatorios para contemplaciones del catálogo (evaluaciones)
 * Mapeo exacto del spec 1-26
 */
const EVALUATION_REMINDER_TEMPLATES: Record<string, string> = {
  'contemplacion-1': 'Recordar leer consignas en voz alta',
  'contemplacion-3': 'Recuerda brindar más tiempo y pausas en caso de ser necesario para este alumno',
  'contemplacion-6': 'Permitir hoja auxiliar / borrador',
  'contemplacion-7': 'Recordatorio: calculadora / material concreto cuando corresponda',
  'contemplacion-8': 'Docente puede escuchar y ayudar a escribir; NO en cuadernillo',
  'contemplacion-9-22': 'No penalizar ortografía/sintaxis cuando no es objetivo',
  'contemplacion-10': 'Verificar comprensión durante la prueba sin dar respuestas',
  'contemplacion-11': 'Recordatorio: ubicación estratégica en aula si aplica',
  'contemplacion-20': 'Recordatorio: señalización explícita de tiempos para este estudiante',
  'contemplacion-21': 'Permitir inicio anticipado o extensión operativa del tiempo',
  'contemplacion-23': 'No pedir justificaciones extensas',
  'contemplacion-24': 'Brindarle sugerencia de orden de respuesta',
  'contemplacion-25': 'Apoyos motivacionales breves, sin interferir con evidencia',
  'contemplacion-26': 'Recordatorio: soporte digital para producción escrita (teclado/dictado a texto) si el centro lo permite'
};

/**
 * Reglas de diseño para contemplaciones del catálogo (evaluaciones)
 * Estas se aplican al cuadernillo/materiales, NO son recordatorios
 */
const EVALUATION_DESIGN_RULES: Record<string, string> = {
  'contemplacion-2': 'Palabras clave en negrita e íconos de apoyo',
  'contemplacion-4': 'Tipografía legible (letra ampliada y alto contraste)',
  'contemplacion-5': 'Consignas en 2 capas (producto + pasos numerados)',
  'contemplacion-12': 'Incluir "mapa de la prueba" (secciones, puntaje, tiempo)',
  'contemplacion-13': 'Plantillas de respuesta (tabla/matriz/guía) sin dar respuesta',
  'contemplacion-14': 'Checklist final del estudiante (cité evidencia, respondí todo, etc.)',
  'contemplacion-15': 'Cuadernillo siempre impreso/entregado',
  'contemplacion-16': 'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
  'contemplacion-17': 'Tipografía: Arial 13–14; interlineado 1.5 o doble',
  'contemplacion-18': 'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
  'contemplacion-19': 'Texto por bloques + preguntas inmediatamente después de cada fragmento',
  'contemplacion-20': 'Cronograma sugerido por secciones',
  'contemplacion-23': 'Plantillas/casilleros; si hay V/F exigir justificación para no bajar exigencia'
};

/**
 * Templates para "Diferenciación/Adaptaciones" en planes de clase
 * Incluyen placeholder para nombres de estudiantes
 */
const CLASE_DIFERENCIACION_TEMPLATES: Record<string, (names: string[]) => string> = {
  'contemplacion-1': (names) => `Recordar leer consignas escritas en voz alta para ${formatNames(names)} (si hay consignas escritas puntuales)`,
  'contemplacion-2': (names) => `Recordar al docente poner palabras clave en negrita e iconografías para ${formatNames(names)} si aplica`,
  'contemplacion-4': (names) => `Cuando se utilice material, recuerda letra particularmente legible para ${formatNames(names)}`,
  'contemplacion-7': (names) => `Recordatorio: calculadora / material concreto cuando corresponda para ${formatNames(names)}`,
  'contemplacion-8': (names) => `Participación oral guiada para ${formatNames(names)}`,
  'contemplacion-10': (names) => `Recuerda monitorear la comprensión de ${formatNames(names)}`,
  'contemplacion-11': (names) => `Recomendación: ubicación estratégica en aula (cerca del docente y/o pizarrón) para ${formatNames(names)}`,
  'contemplacion-12': (names) => `Recomendar entregar agenda/objetivos antes de la clase para ${formatNames(names)}`,
  'contemplacion-15': (names) => `Recordar llevar material impreso para ${formatNames(names)}`,
  'contemplacion-24': (names) => `Consignas con orden y foco para ${formatNames(names)} si aplica`,
  'contemplacion-25': (names) => `Refuerzo positivo y comentarios de reconocimiento para ${formatNames(names)} si corresponde`,
  'contemplacion-26': (names) => `Recordatorio: soporte digital para producción escrita (teclado/dictado a texto) para ${formatNames(names)} si el centro lo permite`
};

/**
 * Helper: Formatear lista de nombres para uso en texto
 */
function formatNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, y ${names[names.length - 1]}`;
}

/**
 * Helper: Detectar si hay "consignas escritas puntuales" en el contenido
 * Implementación conservadora: si no se puede detectar, retorna false
 */
function hasConsignasEscritasPuntuales(content?: string): boolean {
  if (!content) return false;
  
  const normalized = content.toLowerCase();
  const indicators = [
    'consigna',
    'consignas',
    'instrucción',
    'instrucciones',
    'tarea escrita',
    'ejercicio escrito'
  ];
  
  return indicators.some(indicator => normalized.includes(indicator));
}

/**
 * Agrupar estudiantes por contemplación seleccionada
 */
function groupStudentsByContemplacion(
  students: Student[],
  selectedIds: Map<string | number, string[]>,
  contemplacionId: string
): Student[] {
  const result: Student[] = [];
  for (const student of students) {
    const studentSelected = selectedIds.get(student.id) || [];
    if (studentSelected.includes(contemplacionId)) {
      result.push(student);
    }
  }
  return result;
}

/**
 * Generar enforcement para evaluaciones
 * 
 * @param students Lista de estudiantes con IDs y nombres
 * @returns Output con design rules y reminders por estudiante
 */
export function enforceForEvaluation(students: Student[]): EvaluationEnforcementOutput {
  const versionDesignRules = new Set<string>();
  const perStudentReminders = new Map<string | number, string[]>();

  // Obtener todas las contemplaciones del catálogo
  const allContemplaciones = getAllContemplaciones();

  // Leer selecciones y custom items para cada estudiante
  const selectedIdsByStudent = new Map<string | number, string[]>();
  const customItemsByStudent = new Map<string | number, CustomContemplacion[]>();

  for (const student of students) {
    const selected = readSelected(student.id, 'evaluaciones');
    selectedIdsByStudent.set(student.id, selected);
    
    const custom = readCustom(student.id, 'evaluaciones').filter(item => item.selected);
    customItemsByStudent.set(student.id, custom);
  }

  // Procesar contemplaciones del catálogo
  for (const contemplacion of allContemplaciones) {
    // Solo contemplaciones aplicables a evaluaciones
    if (contemplacion.category !== 'evaluaciones' && contemplacion.category !== 'ambas') {
      continue;
    }

    // Encontrar estudiantes que tienen esta contemplación seleccionada
    const studentsWithThis = groupStudentsByContemplacion(
      students,
      selectedIdsByStudent,
      contemplacion.id
    );

    if (studentsWithThis.length === 0) {
      continue;
    }

    // Procesar materializaciones
    for (const materializacion of contemplacion.materializaciones) {
      if (materializacion.contexto !== 'evaluacion' && materializacion.contexto !== 'ambos') {
        continue;
      }

      if (materializacion.tipo === 'diseño_cuadernillo' || materializacion.tipo === 'norma_formato') {
        // Agregar a design rules
        const designRule = EVALUATION_DESIGN_RULES[contemplacion.id] || materializacion.descripcion;
        versionDesignRules.add(designRule);
      } else if (materializacion.tipo === 'recordatorio_docente') {
        // Agregar reminder a cada estudiante que tiene esta contemplación
        const reminder = EVALUATION_REMINDER_TEMPLATES[contemplacion.id] || materializacion.descripcion;
        
        for (const student of studentsWithThis) {
          const existing = perStudentReminders.get(student.id) || [];
          if (!existing.includes(reminder)) {
            perStudentReminders.set(student.id, [...existing, reminder]);
          }
        }
      } else if (materializacion.tipo === 'regla_correccion') {
        // Para #9-22, agregar reminder explícito
        if (contemplacion.id === 'contemplacion-9-22') {
          const reminder = EVALUATION_REMINDER_TEMPLATES['contemplacion-9-22'];
          for (const student of studentsWithThis) {
            const existing = perStudentReminders.get(student.id) || [];
            if (!existing.includes(reminder)) {
              perStudentReminders.set(student.id, [...existing, reminder]);
            }
          }
        }
      }
    }
  }

  // Procesar contemplaciones custom
  for (const student of students) {
    const customItems = customItemsByStudent.get(student.id) || [];
    
    for (const customItem of customItems) {
      // La regla oculta se aplica exactamente como el docente la escribió
      // Si la regla menciona "recordatorio" o es para evaluación, va a reminders
      // Si menciona "diseño" o "formato", va a design rules
      const ruleLower = customItem.rule.toLowerCase();
      
      if (ruleLower.includes('recordatorio') || 
          ruleLower.includes('recordar') ||
          ruleLower.includes('reminder') ||
          (!ruleLower.includes('diseño') && !ruleLower.includes('formato'))) {
        // Va a reminders del estudiante
        const existing = perStudentReminders.get(student.id) || [];
        if (!existing.includes(customItem.rule)) {
          perStudentReminders.set(student.id, [...existing, customItem.rule]);
        }
      } else {
        // Va a design rules
        versionDesignRules.add(customItem.rule);
      }
    }
  }

  return {
    versionDesignRules,
    perStudentReminders
  };
}

/**
 * Generar enforcement para planes de clase
 * 
 * @param students Lista de estudiantes con IDs y nombres
 * @param lessonContent Contenido opcional de la clase (para detectar consignas escritas)
 * @returns Output con bloque de diferenciación/adaptaciones
 */
export function enforceForLessonPlan(
  students: Student[],
  lessonContent?: string
): LessonPlanEnforcementOutput {
  const diferenciacionLines: string[] = [];

  // Obtener todas las contemplaciones del catálogo
  const allContemplaciones = getAllContemplaciones();

  // Leer selecciones y custom items para cada estudiante
  const selectedIdsByStudent = new Map<string | number, string[]>();
  const customItemsByStudent = new Map<string | number, CustomContemplacion[]>();

  for (const student of students) {
    const selected = readSelected(student.id, 'clase');
    selectedIdsByStudent.set(student.id, selected);
    
    const custom = readCustom(student.id, 'clase').filter(item => item.selected);
    customItemsByStudent.set(student.id, custom);
  }

  // Agrupar contemplaciones por tipo para agrupar estudiantes
  const contemplacionGroups = new Map<string, Student[]>();

  for (const contemplacion of allContemplaciones) {
    // Solo contemplaciones aplicables a clase
    if (contemplacion.category !== 'clase' && contemplacion.category !== 'ambas') {
      continue;
    }

    // Caso especial: #1 Lectura oral de consignas
    if (contemplacion.id === 'contemplacion-1') {
      // Solo incluir si hay consignas escritas puntuales
      // Si no se puede detectar, usar wording conservador
      const hasConsignas = hasConsignasEscritasPuntuales(lessonContent);
      const studentsWithThis = groupStudentsByContemplacion(
        students,
        selectedIdsByStudent,
        contemplacion.id
      );

      if (studentsWithThis.length > 0) {
        if (hasConsignas) {
          const names = studentsWithThis.map(s => s.name);
          const template = CLASE_DIFERENCIACION_TEMPLATES['contemplacion-1'];
          diferenciacionLines.push(template(names));
        } else {
          // Wording conservador: incluir pero con condición
          const names = studentsWithThis.map(s => s.name);
          diferenciacionLines.push(
            `Recordar leer consignas escritas en voz alta para ${formatNames(names)} (si hay consignas escritas puntuales)`
          );
        }
      }
      continue;
    }

    // Para otras contemplaciones, agrupar estudiantes
    const studentsWithThis = groupStudentsByContemplacion(
      students,
      selectedIdsByStudent,
      contemplacion.id
    );

    if (studentsWithThis.length > 0) {
      contemplacionGroups.set(contemplacion.id, studentsWithThis);
    }
  }

  // Generar líneas de diferenciación agrupadas por contemplación
  for (const [contemplacionId, studentsWithThis] of contemplacionGroups) {
    const contemplacion = getContemplacionById(contemplacionId);
    if (!contemplacion) continue;

    // Buscar materialización de tipo diferenciacion_adaptaciones para clase
    const materializacion = contemplacion.materializaciones.find(
      m => m.tipo === 'diferenciacion_adaptaciones' && 
           (m.contexto === 'clase' || m.contexto === 'ambos')
    );

    if (materializacion) {
      const template = CLASE_DIFERENCIACION_TEMPLATES[contemplacionId];
      if (template) {
        const names = studentsWithThis.map(s => s.name);
        diferenciacionLines.push(template(names));
      } else {
        // Fallback: usar descripción con nombres
        const names = studentsWithThis.map(s => s.name);
        const placeholder = materializacion.descripcion.replace('(nombres...)', formatNames(names));
        diferenciacionLines.push(placeholder);
      }
    }
  }

  // Procesar contemplaciones custom
  const customGroups = new Map<string, Student[]>();
  
  for (const student of students) {
    const customItems = customItemsByStudent.get(student.id) || [];
    
    for (const customItem of customItems) {
      // Agrupar estudiantes por regla custom (misma regla = mismo grupo)
      const existing = customGroups.get(customItem.rule) || [];
      if (!existing.find(s => s.id === student.id)) {
        customGroups.set(customItem.rule, [...existing, student]);
      }
    }
  }

  // Agregar custom items a diferenciación
  for (const [rule, studentsWithThis] of customGroups) {
    const names = studentsWithThis.map(s => s.name);
    // Aplicar regla exacta como el docente la escribió, pero agregar nombres
    diferenciacionLines.push(`${rule} (para ${formatNames(names)})`);
  }

  return {
    diferenciacionBlock: diferenciacionLines
  };
}

/**
 * Helper: Obtener reminders para un estudiante específico en evaluación
 * 
 * @param studentId ID del estudiante
 * @returns Array de reminders para mostrar en la tarjeta del estudiante
 */
export function getStudentRemindersForEvaluation(studentId: string | number): string[] {
  const students: Student[] = [{ id: studentId, name: '' }]; // Name no necesario para reminders
  const output = enforceForEvaluation(students);
  return output.perStudentReminders.get(studentId) || [];
}

/**
 * Helper: Obtener design rules para una evaluación
 * 
 * @param students Lista de estudiantes
 * @returns Set de reglas de diseño
 */
export function getDesignRulesForEvaluation(students: Student[]): Set<string> {
  const output = enforceForEvaluation(students);
  return output.versionDesignRules;
}

