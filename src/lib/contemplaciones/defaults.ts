/**
 * Default Suggested Contemplaciones Per Student Profile
 * 
 * Defines deterministic preselection of contemplaciones for each student
 * based on their profile (with/without adecuaciones).
 * 
 * These defaults are seeded ONLY when there is no existing localStorage selection
 * for that student+category, preserving user choices.
 * 
 * VERSION 3: All 10 students with exact catalog label strings
 */

export interface StudentDefaults {
  studentId: number; // REQUIRED: Student ID for stable matching (no name fallback)
  studentName: string; // Student name for reference only
  clase: string[]; // Labels to resolve to IDs (EXACT catalog strings)
  evaluacion: string[]; // Labels to resolve to IDs (EXACT catalog strings)
}

/**
 * Students WITH adecuaciones (requiereAdecuacionContenido or requiereAdecuacionAcceso)
 * 
 * These students get extensive defaults derived from their technical reports.
 * All labels are EXACT matches from the catalog.
 */
export const STUDENTS_WITH_ADECUACIONES: StudentDefaults[] = [
  {
    studentId: 1,
    studentName: 'Ana García',
    clase: [
      'Refuerzo positivo / comentarios de reconocimiento (motivación externa)',
      'Respuesta oral alternativa (cuando corresponda)',
      'Monitoreo docente y andamiaje (verificación de comprensión)',
      'Ubicación estratégica en aula (cerca del docente y/o pizarrón)',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
      'Letra ampliada y alto contraste',
      'Reducción de copia mecánica (materiales fotocopiados o consignas ya impresas)'
    ],
    evaluacion: [
      'Tiempo adicional y pausas',
      'Ubicación estratégica en aula (cerca del docente y/o pizarrón)',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
      'Letra ampliada y alto contraste',
      'Monitoreo docente y andamiaje (verificación de comprensión)',
      'Fragmentación de textos + preguntas inmediatamente después de cada fragmento',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)'
    ]
  },
  {
    studentId: 2,
    studentName: 'Carlos López',
    clase: [
      'Refuerzo positivo / comentarios de reconocimiento (motivación externa)',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Ubicación estratégica en aula (cerca del docente y/o pizarrón)',
      'Monitoreo docente y andamiaje (verificación de comprensión)',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
      'Soporte digital para producción escrita (teclado / dictado a texto si el centro lo permite)'
    ],
    evaluacion: [
      'Tiempo adicional y pausas',
      'Señalización explícita de tiempos (avisar límites, tiempos por sección)',
      'Inicio anticipado / extensión operativa del tiempo (comenzar antes o terminar después)',
      'Ubicación estratégica en aula (cerca del docente y/o pizarrón)',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Segmentación de consignas en pasos numerados',
      'Fragmentación de textos + preguntas inmediatamente después de cada fragmento',
      'Priorización de tareas (orden recomendado, qué hacer primero)',
      'Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación)',
      'Corrección centrada en contenido (no forma)',
      'Modelos y plantillas de respuesta (ejemplos ilustrativos, organizadores)',
      'Guía de revisión / checklist del estudiante (autocontrol)',
      'Soporte digital para producción escrita (teclado / dictado a texto si el centro lo permite)'
    ]
  },
  {
    studentId: 3,
    studentName: 'María Rodríguez',
    clase: [
      'Refuerzo positivo / comentarios de reconocimiento (motivación externa)',
      'Reducción de copia mecánica (materiales fotocopiados o consignas ya impresas)',
      'Ubicación estratégica en aula (cerca del docente y/o pizarrón)',
      'Respuesta oral alternativa (cuando corresponda)',
      'Monitoreo docente y andamiaje (verificación de comprensión)',
      'Palabras clave en negrita e íconos de apoyo',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
      'Letra ampliada y alto contraste',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)'
    ],
    evaluacion: [
      'Tiempo adicional y pausas',
      'Inicio anticipado / extensión operativa del tiempo (comenzar antes o terminar después)',
      'Fragmentación de textos + preguntas inmediatamente después de cada fragmento',
      'Corrección centrada en contenido (no forma)',
      'Palabras clave en negrita e íconos de apoyo',
      'Tipografía recomendada y tamaño mínimo (Arial 13–14; interlineado 1.5 o doble)',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)',
      'Letra ampliada y alto contraste',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
      'Señalización explícita de tiempos (avisar límites, tiempos por sección)',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Monitoreo docente y andamiaje (verificación de comprensión)'
    ]
  },
  {
    studentId: 4,
    studentName: 'Diego Martínez',
    clase: [
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)',
      'Monitoreo docente y andamiaje (verificación de comprensión)',
      'Refuerzo positivo / comentarios de reconocimiento (motivación externa)'
    ],
    evaluacion: [
      'Lectura oral de consignas',
      'Segmentación de consignas en pasos numerados',
      'Enunciados simples y lenguaje concreto (sin frases encadenadas)',
      'Tiempo adicional y pausas',
      'Priorización de tareas (orden recomendado, qué hacer primero)',
      'Respuestas estructuradas en lugar de redacción extensa (bloques, casilleros, V/F con justificación)',
      'Corrección centrada en contenido (no forma)',
      'Modelos y plantillas de respuesta (ejemplos ilustrativos, organizadores)',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)'
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
    studentId: 5,
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
    studentId: 6,
    studentName: 'Joaquín Torres', // Auditivo – Kinestésico
    clase: [
      'Palabras clave en negrita e íconos de apoyo',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)'
    ],
    evaluacion: [
      'Lectura oral de consignas',
      'Segmentación de consignas en pasos numerados',
      'Priorización de tareas (orden recomendado, qué hacer primero)', // secondary kinesthetic/operational
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)'
    ]
  },
  {
    studentId: 7,
    studentName: 'Valentina Castro', // Visual – Auditivo
    clase: [
      'Palabras clave en negrita e íconos de apoyo',
      'Letra ampliada y alto contraste',
      'Diagramación legible y "no saturada" (espaciado, márgenes, interlineado)'
    ],
    evaluacion: [
      'Palabras clave en negrita e íconos de apoyo',
      'Letra ampliada y alto contraste',
      'Lectura oral de consignas', // secondary auditory
      'Segmentación de consignas en pasos numerados'
    ]
  },
  {
    studentId: 8,
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
    studentId: 9,
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
    studentId: 10,
    studentName: 'Luciano Vega', // Auditivo – Visual
    clase: [
      'Palabras clave en negrita e íconos de apoyo',
      'Letra ampliada y alto contraste'
    ],
    evaluacion: [
      'Lectura oral de consignas',
      'Palabras clave en negrita e íconos de apoyo',
      'Letra ampliada y alto contraste',
      'Anticipación y estructura previa (agenda, objetivos, punteos/esquemas)' // secondary visual
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
 * Normalize a name for matching: lowercase, trim, remove diacritics
 */
function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics (á→a, é→e, ñ→n)
}

/**
 * Get default contemplaciones for a specific student by ID.
 * 
 * IMPORTANT: studentId is REQUIRED for reliable matching.
 * Name matching is provided only as fallback for backward compatibility.
 * 
 * @param studentId - The student ID (REQUIRED)
 * @param studentName - Optional: student name for fallback matching
 * @returns StudentDefaults object if found, or null
 */
export function getDefaultsForStudent(studentId: number, studentName?: string): StudentDefaults | null {
  // Priority 1: Try match by studentId (REQUIRED, most stable)
  for (const defaults of ALL_STUDENT_DEFAULTS) {
    if (defaults.studentId === studentId) {
      return defaults;
    }
  }
  
  // Priority 2: Fallback to name matching (only if name provided)
  if (studentName) {
    const normalized = normalizeName(studentName);
    
    for (const defaults of ALL_STUDENT_DEFAULTS) {
      if (normalizeName(defaults.studentName) === normalized) {
        return defaults;
      }
    }
  }
  
  return null;
}

/**
 * Check if a student has predefined defaults.
 * 
 * @param studentId - The student ID (REQUIRED)
 * @param studentName - Optional: student name for fallback matching
 * @returns true if defaults exist for this student
 */
export function hasDefaults(studentId: number, studentName?: string): boolean {
  return getDefaultsForStudent(studentId, studentName) !== null;
}
