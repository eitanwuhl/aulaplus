import type { GroupContextForAI, StudentForAI } from '@/types/groupContextForAI';
import {
  getContemplacionById,
  normalizeContemplacionId,
  type Contemplacion
} from '@/lib/contemplaciones/catalog';
import {
  mapSelectedContemplacionesToBuckets,
  type ContemplacionBucket
} from '@/lib/contemplaciones/mapping';
import {
  getEvaluationDesignRuleTemplate,
  getEvaluationReminderTemplate
} from '@/lib/contemplaciones/enforcement';

type EvaluationVersionKind = 'A' | 'B' | 'C';

export interface EvaluationVersionPlan {
  kind: EvaluationVersionKind;
  label: string;
  assignedStudentIds: Array<string | number>;
  reason: string;
}

export interface ResponseOptionsPlan {
  include: boolean;
  optionCount: 1 | 2 | 3;
  triggerReasons: string[];
}

export interface StudentReminders {
  studentId: string | number;
  admin: string[];
  correction: string[];
  allowances: string[];
}

export interface EvaluationDesignPlan {
  versionPlans: EvaluationVersionPlan[];
  assignmentByStudentId: Record<string, EvaluationVersionKind>;
  responseOptions: ResponseOptionsPlan;
  designComplexityCount: number;
  instrumentDesignContemplacionIds: string[];
  bucketedContemplacionIds: Record<ContemplacionBucket, string[]>;
  highStructureNeed: {
    totalStudents: number;
    qualifyingStudents: number;
    percent: number;
    qualifyingStudentIds: string[];
  };
  triggers: {
    versionB: boolean;
    versionC: boolean;
  };
  contentAdaptationStudentIds: string[];
  varkDistribution: {
    visual: number;
    auditory: number;
    readWrite: number;
    kinesthetic: number;
    total: number;
  };
  perStudentReminders: StudentReminders[];
  /** Internal validation result - contains missing template errors if any */
  _reminderValidation?: BuildRemindersResult;
}

export interface EvaluationDesignPlanInput {
  groupContext: GroupContextForAI;
  teacherRequirementsText?: string;
}

/**
 * Error thrown when a contemplacion has a bucket assignment but no template defined
 */
export interface MissingTemplateError {
  contemplacionId: string;
  bucket: ContemplacionBucket;
  studentId: string | number;
  expectedTemplateLocation: string;
}

/**
 * Result of building per-student reminders with validation
 */
export interface BuildRemindersResult {
  reminders: StudentReminders[];
  missingTemplates: MissingTemplateError[];
}

const STRUCTURE_NEED_CONTEMPLACIONES = new Set([
  'contemplacion-13', // Modelos y plantillas de respuesta
  'contemplacion-23', // Respuestas estructuradas
  'contemplacion-5',  // Segmentación de consignas
  'contemplacion-19'  // Fragmentación de textos
]);

function normalizeProfile(profile?: string): string {
  return (profile || '').toLowerCase();
}

function countVarkDistribution(students: StudentForAI[]): {
  visual: number;
  auditory: number;
  readWrite: number;
  kinesthetic: number;
  total: number;
} {
  let visual = 0;
  let auditory = 0;
  let readWrite = 0;
  let kinesthetic = 0;

  for (const student of students) {
    const profile = normalizeProfile(student.learningProfile);
    if (profile.includes('visual')) visual += 1;
    if (profile.includes('auditivo')) auditory += 1;
    if (profile.includes('lector') || profile.includes('escritor')) readWrite += 1;
    if (profile.includes('kinest')) kinesthetic += 1;
  }

  return {
    visual,
    auditory,
    readWrite,
    kinesthetic,
    total: students.length
  };
}

function detectTeacherRequestedOptions(text?: string): { requested: boolean; requestedOptionCount?: 2 | 3 } {
  if (!text) return { requested: false };

  const normalized = text.toLowerCase();
  const hasRequest =
    normalized.includes('opcion de respuesta') ||
    normalized.includes('opciones de respuesta') ||
    normalized.includes('opción de formato') ||
    normalized.includes('opciones equivalentes') ||
    normalized.includes('elige una opción') ||
    normalized.includes('elija una opción');

  if (!hasRequest) return { requested: false };

  if (normalized.includes('3 opciones') || normalized.includes('tres opciones')) {
    return { requested: true, requestedOptionCount: 3 };
  }

  if (normalized.includes('2 opciones') || normalized.includes('dos opciones')) {
    return { requested: true, requestedOptionCount: 2 };
  }

  return { requested: true };
}

function getEvaluationBucketsForStudent(contemplaciones: string[]): Map<ContemplacionBucket, string[]> {
  return mapSelectedContemplacionesToBuckets(contemplaciones);
}

function buildReminderText(
  contemplacion: Contemplacion,
  bucket: ContemplacionBucket
): string | null {
  if (bucket === 'INSTRUMENT_DESIGN') {
    return getEvaluationDesignRuleTemplate(contemplacion.id) || null;
  }

  if (bucket === 'ADMIN_REMINDER') {
    return getEvaluationReminderTemplate(contemplacion.id) || null;
  }

  if (bucket === 'CORRECTION_REMINDER') {
    return getEvaluationReminderTemplate(contemplacion.id) || null;
  }

  return null;
}

/**
 * Build per-student reminders from contemplaciones with fail-fast validation.
 * 
 * This function is exported for testing purposes.
 * 
 * @param students Array of students with contemplacionesEvaluaciones
 * @returns Object containing reminders array and any missing template errors
 */
export function buildPerStudentReminders(students: StudentForAI[]): BuildRemindersResult {
  // DIAGNOSTIC: Log input students (DEV only)
  if (import.meta.env.DEV) {
    console.log('[DIAG:buildPerStudentReminders] Input students:', 
      students.map(s => ({
        studentId: s.studentId,
        contemplacionesEvaluaciones: s.contemplacionesEvaluaciones,
        contemplacionesCount: s.contemplacionesEvaluaciones?.length || 0
      }))
    );
  }
  
  const missingTemplates: MissingTemplateError[] = [];
  
  const reminders = students.map(student => {
    const buckets = getEvaluationBucketsForStudent(student.contemplacionesEvaluaciones);
    
    // DIAGNOSTIC: Log buckets per student (DEV only)
    if (import.meta.env.DEV) {
      console.log(`[DIAG:buildPerStudentReminders] Student ${student.studentId}:`, {
        inputContemplaciones: student.contemplacionesEvaluaciones,
        buckets: Object.fromEntries(buckets),
        hasBuckets: buckets.size > 0
      });
    }
    const admin = new Set<string>();
    const correction = new Set<string>();
    const allowances = new Set<string>();

    for (const [bucket, ids] of buckets.entries()) {
      for (const rawId of ids) {
        const normalizedId = normalizeContemplacionId(rawId);
        const contemplacion = getContemplacionById(normalizedId);
        if (!contemplacion) {
          // Contemplacion not found in catalog - this is a data integrity issue
          console.error(`[buildPerStudentReminders] Contemplacion not found in catalog: ${normalizedId}`);
          continue;
        }

        const reminder = buildReminderText(contemplacion, bucket);
        
        // FAIL-FAST: If a contemplacion is bucketed but has no template, record the error
        if (!reminder) {
          const expectedLocation = bucket === 'INSTRUMENT_DESIGN'
            ? 'EVALUATION_DESIGN_RULES in src/lib/contemplaciones/enforcement.ts'
            : 'EVALUATION_REMINDER_TEMPLATES in src/lib/contemplaciones/enforcement.ts';
          
          missingTemplates.push({
            contemplacionId: normalizedId,
            bucket,
            studentId: student.studentId,
            expectedTemplateLocation: expectedLocation
          });
          continue;
        }

        if (bucket === 'ADMIN_REMINDER') admin.add(reminder);
        if (bucket === 'CORRECTION_REMINDER') correction.add(reminder);
        if (bucket === 'INSTRUMENT_DESIGN') allowances.add(reminder);
      }
    }

    return {
      studentId: student.studentId,
      admin: Array.from(admin),
      correction: Array.from(correction),
      allowances: Array.from(allowances)
    };
  });

  return { reminders, missingTemplates };
}

export function buildEvaluationDesignPlan(input: EvaluationDesignPlanInput): EvaluationDesignPlan {
  const students = input.groupContext.students || [];
  const totalStudents = students.length;

  const allSelectedIds = students
    .flatMap(student => student.contemplacionesEvaluaciones)
    .map(normalizeContemplacionId);

  const uniqueSelectedIds = Array.from(new Set(allSelectedIds));
  const bucketed = mapSelectedContemplacionesToBuckets(uniqueSelectedIds);
  const instrumentDesignIds = bucketed.get('INSTRUMENT_DESIGN') || [];

  const designComplexityCount = instrumentDesignIds.length;

  const qualifyingStudents = students.filter(student => {
    const normalizedIds = student.contemplacionesEvaluaciones.map(normalizeContemplacionId);
    const count = normalizedIds.filter(id => STRUCTURE_NEED_CONTEMPLACIONES.has(id)).length;
    return count >= 2;
  });

  const qualifyingStudentIds = qualifyingStudents.map(student => String(student.studentId));
  const qualifyingPercent = totalStudents > 0 ? (qualifyingStudents.length / totalStudents) * 100 : 0;
  const highStructureTrigger = totalStudents > 0 && qualifyingPercent >= 30;
  const complexityTrigger = designComplexityCount >= 6;
  const versionBTriggered = highStructureTrigger && complexityTrigger;

  // C1: Consolidate content adaptation detection - accept multiple field names
  const contentAdaptationStudentIds = students
    .filter(student => {
      // Check multiple possible field names
      return (
        student.hasDeclaredContentAdaptation === true ||
        student.requiereAdecuacionContenido === true ||
        student.requiresContentAdaptation === true ||
        (student.informeTecnico?.requiereAdecuacionContenido === true)
      );
    })
    .map(student => String(student.studentId));
  const versionCTriggered = contentAdaptationStudentIds.length > 0;

  const assignmentByStudentId: Record<string, EvaluationVersionKind> = {};
  for (const student of students) {
    assignmentByStudentId[String(student.studentId)] = 'A';
  }

  if (versionBTriggered) {
    for (const student of qualifyingStudents) {
      assignmentByStudentId[String(student.studentId)] = 'B';
    }
  }

  if (versionCTriggered) {
    for (const studentId of contentAdaptationStudentIds) {
      assignmentByStudentId[studentId] = 'C';
    }
  }

  const versionPlans: EvaluationVersionPlan[] = [
    {
      kind: 'A',
      label: 'Versión A (Universal)',
      assignedStudentIds: students
        .filter(student => assignmentByStudentId[String(student.studentId)] === 'A')
        .map(student => student.studentId),
      reason: 'Base universal siempre generada'
    }
  ];

  if (versionBTriggered) {
    versionPlans.push({
      kind: 'B',
      label: 'Versión B (Equivalente)',
      assignedStudentIds: students
        .filter(student => assignmentByStudentId[String(student.studentId)] === 'B')
        .map(student => student.studentId),
      reason: 'Alta necesidad de estructuración + complejidad de diseño'
    });
  }

  if (versionCTriggered) {
    versionPlans.push({
      kind: 'C',
      label: 'Versión C (Adecuación de contenido)',
      assignedStudentIds: students
        .filter(student => assignmentByStudentId[String(student.studentId)] === 'C')
        .map(student => student.studentId),
      reason: 'Adecuación de contenido declarada explícitamente'
    });
  }

  const vark = countVarkDistribution(students);
  const vkRatio = vark.total > 0 ? (vark.visual + vark.kinesthetic) / vark.total : 0;
  const nonRRatio = vark.total > 0 ? (vark.total - vark.readWrite) / vark.total : 0;

  const teacherRequest = detectTeacherRequestedOptions(input.teacherRequirementsText);
  const hasStructuringNeeds = students.some(student =>
    student.contemplacionesEvaluaciones
      .map(normalizeContemplacionId)
      .some(id => STRUCTURE_NEED_CONTEMPLACIONES.has(id))
  );

  const responseTriggers: string[] = [];
  if (hasStructuringNeeds) responseTriggers.push('Necesidades de estructuración/plantillas');
  if (vkRatio >= 0.5) responseTriggers.push('Predominio V+K');
  if (nonRRatio >= 0.5) responseTriggers.push('Mayoría no-R');
  if (teacherRequest.requested) responseTriggers.push('Pedido explícito docente');

  const includeOptions = responseTriggers.length > 0;
  let optionCount: 1 | 2 | 3 = includeOptions ? 2 : 1;

  if (includeOptions && (designComplexityCount >= 6 || teacherRequest.requestedOptionCount === 3)) {
    optionCount = 3;
  }

  // Build reminders once and extract both results
  const reminderResult = buildPerStudentReminders(students);
  
  // Log warning if missing templates detected (fail-fast in UI layer)
  if (reminderResult.missingTemplates.length > 0) {
    console.warn('[buildEvaluationDesignPlan] Missing reminder templates detected:', 
      reminderResult.missingTemplates.map(mt => `${mt.contemplacionId} (${mt.bucket})`).join(', ')
    );
  }

  return {
    versionPlans,
    assignmentByStudentId,
    responseOptions: {
      include: includeOptions,
      optionCount,
      triggerReasons: responseTriggers
    },
    designComplexityCount,
    instrumentDesignContemplacionIds: instrumentDesignIds,
    bucketedContemplacionIds: {
      INSTRUMENT_DESIGN: instrumentDesignIds,
      ADMIN_REMINDER: bucketed.get('ADMIN_REMINDER') || [],
      CORRECTION_REMINDER: bucketed.get('CORRECTION_REMINDER') || [],
      CONTENT_ADAPTATION_EXCEPTION: bucketed.get('CONTENT_ADAPTATION_EXCEPTION') || []
    },
    highStructureNeed: {
      totalStudents,
      qualifyingStudents: qualifyingStudents.length,
      percent: qualifyingPercent,
      qualifyingStudentIds
    },
    triggers: {
      versionB: versionBTriggered,
      versionC: versionCTriggered
    },
    contentAdaptationStudentIds,
    varkDistribution: vark,
    perStudentReminders: reminderResult.reminders,
    _reminderValidation: reminderResult
  };
}

