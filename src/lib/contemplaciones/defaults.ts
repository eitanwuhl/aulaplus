/**
 * Default Suggested Contemplaciones Per Student Profile
 * 
 * Defines deterministic preselection of contemplaciones for each student
 * based on their profile (with/without adecuaciones).
 * 
 * These defaults are seeded ONLY when there is no existing localStorage selection
 * for that student+category, preserving user choices.
 */

export interface StudentDefaults {
  studentId?: number; // Optional: Student ID for stable matching
  studentName: string; // Student name for fallback matching
  clase: string[]; // Labels to resolve to IDs
  evaluacion: string[]; // Labels to resolve to IDs
}

/**
 * Students WITH adecuaciones (requiereAdecuacionContenido or requiereAdecuacionAcceso)
 * 
 * These students get extensive defaults derived from their technical reports.
 * All labels are EXACT matches from the catalog.
 */
export const STUDENTS_WITH_ADECUACIONES: StudentDefaults[] = [
  {
    studentId: 2, // Stable ID for Carlos López
    studentName: 'Carlos López',
    clase: [
      'Refuerzo positivo / comentarios de reconocimiento (motivación externa)',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Ubicación estratégica en aula (cerca del docente y/o pizarrón)',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
      'Soporte digital para producción escrita (teclado / dictado a texto si el centro lo permite)'
    ],
    evaluacion: [
      'Tiempo adicional y pausas',
      'Señalización explícita de tiempos (avisar límites, tiempos por sección)',
      'Inicio anticipado / extensión operativa del tiempo (comenzar antes o terminar después)',
      'Ubicación estratégica en aula (cerca del docente y/o pizarrón)',
      'Modelos y plantillas de respuesta (ejemplos ilustrativos, organizadores)',
      'Guía de revisión / checklist del estudiante (autocontrol)',
      'Soporte digital para producción escrita (teclado / dictado a texto si el centro lo permite)',
      'Priorización de tareas (orden recomendado, qué hacer primero)',
      'Segmentación de consignas en pasos numerados',
      'Corrección centrada en contenido (no forma)',
      'Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación)',
      'Fragmentación de textos + preguntas inmediatamente después de cada fragmento',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)'
    ]
  },
  {
    studentId: 1, // Stable ID for Ana García
    studentName: 'Ana García',
    clase: [
      'Refuerzo positivo / comentarios de reconocimiento (motivación externa)',
      'Respuesta oral alternativa (cuando corresponda)',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Reducción de copia mecánica (materiales fotocopiados o consignas ya impresas)',
      'Monitoreo docente y andamiaje (verificación de comprensión)',
      'Ubicación estratégica en aula (cerca del docente y/o pizarrón)'
    ],
    evaluacion: [
      'Tiempo adicional y pausas',
      'Inicio anticipado / extensión operativa del tiempo (comenzar antes o terminar después)',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
      'Letra ampliada y alto contraste',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Reducción de copia mecánica (materiales fotocopiados o consignas ya impresas)',
      'Monitoreo docente y andamiaje (verificación de comprensión)',
      'Fragmentación de textos + preguntas inmediatamente después de cada fragmento',
      'Ubicación estratégica en aula (cerca del docente y/o pizarrón)'
    ]
  },
  {
    studentId: 3, // Stable ID for María Rodríguez
    studentName: 'María Rodríguez',
    clase: [
      'Refuerzo positivo / comentarios de reconocimiento (motivación externa)',
      'Reducción de copia mecánica (materiales fotocopiados o consignas ya impresas)',
      'Ubicación estratégica en aula (cerca del docente y/o pizarrón)',
      'Palabras clave en negrita e íconos de apoyo',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
      'Letra ampliada y alto contraste',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Monitoreo docente y andamiaje (verificación de comprensión)',
      'Respuesta oral alternativa (cuando corresponda)'
    ],
    evaluacion: [
      'Tiempo adicional y pausas',
      'Inicio anticipado / extensión operativa del tiempo (comenzar antes o terminar después)',
      'Señalización explícita de tiempos (avisar límites, tiempos por sección)',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Corrección centrada en contenido (no forma)',
      'Palabras clave en negrita e íconos de apoyo',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Letra ampliada y alto contraste',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
      'Fragmentación de textos + preguntas inmediatamente después de cada fragmento'
    ]
  },
  {
    studentId: 4, // Stable ID for Diego Martínez
    studentName: 'Diego Martínez',
    clase: [
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
      'Monitoreo docente y andamiaje (verificación de comprensión)',
      'Palabras clave en negrita e íconos de apoyo',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)'
    ],
    evaluacion: [
      'Lectura oral de consignas',
      'Segmentación de consignas en pasos numerados',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
      'Tiempo adicional y pausas',
      'Inicio anticipado / extensión operativa del tiempo (comenzar antes o terminar después)',
      'Corrección centrada en contenido (no forma)',
      'Modelos y plantillas de respuesta (ejemplos ilustrativos, organizadores)',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Priorización de tareas (orden recomendado, qué hacer primero)',
      'Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación)'
    ]
  }
];

/**
 * Students WITHOUT adecuaciones (standard profiles with learning style preferences)
 * 
 * These students get a RESTRICTED set of contemplaciones (design inputs for AI generation).
 * IMPORTANT: ONLY use the allowed contemplaciones from the restricted set below.
 * 
 * Allowed CLASE (only 4):
 * - Palabras clave en negrita e íconos de apoyo
 * - Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)
 * - Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)
 * - Letra ampliada y alto contraste
 * 
 * Allowed EVALUACIÓN (only 9):
 * - Lectura oral de consignas
 * - Palabras clave en negrita e íconos de apoyo
 * - Letra ampliada y alto contraste
 * - Segmentación de consignas en pasos numerados
 * - Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)
 * - Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)
 * - Fragmentación de textos + preguntas inmediatamente después de cada fragmento
 * - Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación)
 * - Priorización de tareas (orden recomendado, qué hacer primero)
 */
export const STUDENTS_WITHOUT_ADECUACIONES: StudentDefaults[] = [
  {
    studentName: 'Sofía Fernández', // Lector/escritor – Auditivo
    clase: [
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)'
    ],
    evaluacion: [
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
      'Fragmentación de textos + preguntas inmediatamente después de cada fragmento',
      'Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación)',
      'Lectura oral de consignas' // secondary auditory
    ]
  },
  {
    studentName: 'Joaquín Torres', // Auditivo – Kinestésico
    clase: [
      'Palabras clave en negrita e íconos de apoyo',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)'
    ],
    evaluacion: [
      'Lectura oral de consignas',
      'Segmentación de consignas en pasos numerados',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Priorización de tareas (orden recomendado, qué hacer primero)' // secondary kinesthetic/operational
    ]
  },
  {
    studentName: 'Valentina Castro', // Visual – Auditivo
    clase: [
      'Palabras clave en negrita e íconos de apoyo',
      'Letra ampliada y alto contraste',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)'
    ],
    evaluacion: [
      'Palabras clave en negrita e íconos de apoyo',
      'Letra ampliada y alto contraste',
      'Segmentación de consignas en pasos numerados',
      'Lectura oral de consignas' // secondary auditory
    ]
  },
  {
    studentName: 'Mateo Silva', // Kinestésico – Lector/escritor
    clase: [
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)'
    ],
    evaluacion: [
      'Segmentación de consignas en pasos numerados',
      'Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación)',
      'Priorización de tareas (orden recomendado, qué hacer primero)',
      'Fragmentación de textos + preguntas inmediatamente después de cada fragmento' // secondary lector/escritor
    ]
  },
  {
    studentName: 'Isabella Morales', // Visual – Lector/escritor
    clase: [
      'Palabras clave en negrita e íconos de apoyo',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)'
    ],
    evaluacion: [
      'Palabras clave en negrita e íconos de apoyo',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
      'Fragmentación de textos + preguntas inmediatamente después de cada fragmento',
      'Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación)'
    ]
  },
  {
    studentName: 'Luciano Vega', // Auditivo – Visual
    clase: [
      'Palabras clave en negrita e íconos de apoyo',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)'
    ],
    evaluacion: [
      'Lectura oral de consignas',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Segmentación de consignas en pasos numerados',
      'Palabras clave en negrita e íconos de apoyo' // secondary visual
    ]
  }
];

/**
 * All student defaults combined (for lookup)
 */
export const ALL_STUDENT_DEFAULTS: StudentDefaults[] = [
  ...STUDENTS_WITH_ADECUACIONES,
  ...STUDENTS_WITHOUT_ADECUACIONES
];

/**
 * Get default contemplaciones for a specific student by ID or name.
 * 
 * Matching priority:
 * 1. By studentId (if provided and defined in defaults) - most stable
 * 2. By studentName (normalized lowercase) - fallback
 * 
 * @param studentName - The exact student name to match
 * @param studentId - Optional student ID for stable matching
 * @returns StudentDefaults object if found, or null
 */
export function getDefaultsForStudent(studentName: string, studentId?: number): StudentDefaults | null {
  // Priority 1: Try match by studentId (most stable)
  if (studentId !== undefined) {
    for (const defaults of ALL_STUDENT_DEFAULTS) {
      if (defaults.studentId === studentId) {
        return defaults;
      }
    }
  }
  
  // Priority 2: Try match by name (fallback)
  const normalized = studentName.trim().toLowerCase();
  
  for (const defaults of ALL_STUDENT_DEFAULTS) {
    if (defaults.studentName.trim().toLowerCase() === normalized) {
      return defaults;
    }
  }
  
  return null;
}

/**
 * Check if a student has predefined defaults.
 * 
 * @param studentName - The student name to check
 * @param studentId - Optional student ID for stable matching
 * @returns true if defaults exist for this student
 */
export function hasDefaults(studentName: string, studentId?: number): boolean {
  return getDefaultsForStudent(studentName, studentId) !== null;
}

