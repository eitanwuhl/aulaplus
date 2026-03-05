/**
 * Evaluation generation pipeline hook.
 * Owns: generation request, loading/error/warnings, V1/V2 response storage,
 * fallback V2→V1, safe HTML guard, assignment normalization, save guards.
 * Does NOT perform Supabase save; the page owns handleSaveEvaluation.
 */

import { useCallback, useMemo, useState } from 'react';
import { invokeEdgeFunctionAuthed } from '@/lib/edgeFunctionAuth';
import { Group } from '@/data/mockData';
import type { EvaluationDesignPlan, StudentReminders, MissingTemplateError } from '@/services/evaluations';
import type { V2Response } from '@/services/evaluations/v2Types';
import { decideRequestedVersionsForModify } from '@/services/evaluations/requestedVersionsPolicy';
import type { GeneratedEvaluation, EvaluationBundle, GenerationErrorState, PipelineDebugState } from '../types';

export type PipelineStatus = 'idle' | 'generating' | 'success' | 'error';

export interface UseEvaluationPipelineOptions {
  groupId: string;
  group: Group | undefined;
  materia: string;
  esInterdisciplinaria: boolean;
  materiasSeleccionadas: string[];
  selectedSubtemas: string[];
  selectedCompetenciasIds: string[];
  selectedCriteriosLogro: string[];
  requerimientos: string;
  evaluationSourceConfig: {
    planificacionId?: string;
    sessionIds: string[];
    evaluationFocus: string;
  };
  evaluationMaterialsConfig: {
    directMaterialIds: string[];
    includeSessionMaterials: boolean;
  };
  targetDurationMinutes: number;
  /** Resolved prototype string to send as originalEvaluation (basePrototype || generatePrototipo(...)) */
  originalEvaluation: string;
  useBetaV2: boolean;
  onToast: (params: { title: string; description?: string; variant?: 'default' | 'destructive'; duration?: number }) => void;
  debugPanelEnabled?: boolean;
  onSuccess?: {
    setActiveTab?: (tab: string) => void;
    setIsConfigCollapsed?: (v: boolean) => void;
    setAiDesignReport?: (v: string | null) => void;
    setEstimatedDurationMinutes?: (v: number | null) => void;
    setTimeBreakdown?: (v: unknown) => void;
  };
}

export interface UseEvaluationPipelineResult {
  status: PipelineStatus;
  isGenerating: boolean;
  generationError: GenerationErrorState | null;
  runGeneration: () => Promise<void>;
  displayEvaluations: GeneratedEvaluation[];
  evaluationBundle: EvaluationBundle | null;
  evaluationDesignPlan: EvaluationDesignPlan | null;
  studentAssignments: Record<string, 'A' | 'B' | 'C'>;
  teacherReminders: StudentReminders[];
  assignmentWarnings: string[];
  missingTemplateErrors: MissingTemplateError[];
  v2RawResponse: V2Response | null;
  v2SelectedVersion: 'A' | 'B' | 'C';
  setV2RawResponse: (r: V2Response | null) => void;
  setV2SelectedVersion: (v: 'A' | 'B' | 'C') => void;
  previousV2Response: V2Response | null;
  setPreviousV2Response: (r: V2Response | null) => void;
  hasV2Spec: boolean;
  hasV1: boolean;
  canSave: boolean;
  getEvaluationsToSave: () => GeneratedEvaluation[];
  /** Exposed for feedback/regenerate flows that update a single evaluation by id */
  generatedEvaluations: GeneratedEvaluation[];
  setGeneratedEvaluations: React.Dispatch<React.SetStateAction<GeneratedEvaluation[]>>;
  pipelineDebug: PipelineDebugState;
  setPipelineDebug: React.Dispatch<React.SetStateAction<PipelineDebugState>>;
}

const sid = (s: { studentId?: string | number; id?: string | number; student_id?: string | number } | null | undefined): string =>
  String(s?.studentId ?? s?.id ?? s?.student_id ?? '');

const ENABLE_V2_TO_V1_FALLBACK = import.meta.env.VITE_EVAL_V2_TO_V1_FALLBACK === 'true';

function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `eval-${crypto.randomUUID()}`;
  }
  return `eval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useEvaluationPipeline(options: UseEvaluationPipelineOptions): UseEvaluationPipelineResult {
  const {
    group,
    materia,
    esInterdisciplinaria,
    materiasSeleccionadas,
    selectedSubtemas,
    selectedCompetenciasIds,
    selectedCriteriosLogro,
    requerimientos,
    evaluationSourceConfig,
    evaluationMaterialsConfig,
    targetDurationMinutes,
    originalEvaluation,
    useBetaV2,
    onToast,
    debugPanelEnabled = false,
    onSuccess
  } = options;

  const [evaluationBundle, setEvaluationBundle] = useState<EvaluationBundle | null>(null);
  const [evaluationDesignPlan, setEvaluationDesignPlan] = useState<EvaluationDesignPlan | null>(null);
  const [generatedEvaluations, setGeneratedEvaluations] = useState<GeneratedEvaluation[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<Record<string, 'A' | 'B' | 'C'>>({});
  const [teacherReminders, setTeacherReminders] = useState<StudentReminders[]>([]);
  const [missingTemplateErrors, setMissingTemplateErrors] = useState<MissingTemplateError[]>([]);
  const [assignmentWarnings, setAssignmentWarnings] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [v2RawResponse, setV2RawResponse] = useState<V2Response | null>(null);
  const [v2SelectedVersion, setV2SelectedVersion] = useState<'A' | 'B' | 'C'>('A');
  const [previousV2Response, setPreviousV2Response] = useState<V2Response | null>(null);
  const [pipelineDebug, setPipelineDebug] = useState<PipelineDebugState>({});
  const [generationError, setGenerationError] = useState<GenerationErrorState | null>(null);

  const hasAnepContent = selectedSubtemas.length > 0;
  const hasSessions = evaluationSourceConfig.sessionIds.length > 0;
  const hasMaterials = evaluationMaterialsConfig.directMaterialIds.length > 0;

  const displayEvaluations = useMemo(() => {
    if (!evaluationBundle?.baseHtml && !evaluationBundle?.versions?.A) {
      return generatedEvaluations;
    }

    const rawAssignments = Object.keys(studentAssignments).length > 0
      ? studentAssignments
      : (evaluationDesignPlan?.assignmentByStudentId || {});

    const assignmentByStudentId: Record<string, 'A' | 'B' | 'C'> = {};
    Object.entries(rawAssignments).forEach(([key, value]) => {
      assignmentByStudentId[String(key)] = value;
    });

    const students = group?.students || [];

    const getAssigned = (kind: 'A' | 'B' | 'C') => {
      const assigned = students.filter(student => {
        const normalizedId = sid(student);
        return assignmentByStudentId[normalizedId] === kind;
      });
      return {
        ids: assigned.map(student => sid(student)),
        names: assigned.map(student => student.name || `Estudiante ${sid(student)}`)
      };
    };

    const backendFinalCounts = evaluationBundle?.finalAssignmentCounts;
    const assignmentCounts = backendFinalCounts ?? {
      A: Object.values(assignmentByStudentId).filter(v => v === 'A').length,
      B: Object.values(assignmentByStudentId).filter(v => v === 'B').length,
      C: Object.values(assignmentByStudentId).filter(v => v === 'C').length
    };

    const versions = evaluationBundle?.versions ?? null;
    const legacyA = !versions
      ? (evaluationBundle?.baseHtml ?? evaluationBundle?.base_html ?? evaluationBundle?.content ?? evaluationBundle?.html ?? null)
      : null;

    let rawA = versions ? (versions.A ?? null) : legacyA;
    let rawB = versions ? (versions.B ?? null) : null;
    let rawC = versions ? (versions.C ?? null) : null;

    if (rawA && typeof rawA !== 'string') {
      rawA = null;
    }
    if (rawB && typeof rawB !== 'string') {
      rawB = null;
    }
    if (rawC && typeof rawC !== 'string') {
      rawC = null;
    }

    const getSafeHtml = (value: unknown, key: string): string | null => {
      if (!value || typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (trimmed.startsWith('{')) {
        return `<div class="evaluation"><p><strong>Error:</strong> El backend devolvió un wrapper JSON inválido en versión ${key}.</p></div>`;
      }
      if (trimmed.startsWith('<')) {
        return trimmed;
      }
      return null;
    };

    const htmlA = getSafeHtml(rawA, 'A');
    const htmlB = getSafeHtml(rawB, 'B');
    const htmlC = getSafeHtml(rawC, 'C');

    const evaluations: GeneratedEvaluation[] = [];
    const shouldShowB = assignmentCounts.B > 0;

    const baseAssigned = getAssigned('A');
    const contentA = htmlA || '<div class="p-4 bg-red-50 border-2 border-red-400 rounded"><strong>Error:</strong> Version A missing. No se pudo extraer el contenido de la versión A.</div>';

    evaluations.push({
      id: 'A',
      title: 'Versión A (Universal)',
      content: contentA,
      version: 1,
      versionKind: 'A',
      versionLabel: 'Versión A (Universal)',
      adaptations: [],
      assignedStudents: baseAssigned.names,
      assignedStudentIds: baseAssigned.ids
    });

    if (shouldShowB) {
      const assigned = getAssigned('B');
      const contentB = htmlB || '<div class="p-4 bg-red-50 border-2 border-red-400 rounded"><strong>Error:</strong> Version B required but missing. No se pudo extraer el contenido de la versión B.</div>';
      evaluations.push({
        id: 'B',
        title: 'Versión B (Equivalente)',
        content: contentB,
        version: 2,
        versionKind: 'B',
        versionLabel: 'Versión B (Equivalente)',
        adaptations: [],
        assignedStudents: assigned.names,
        assignedStudentIds: assigned.ids
      });
    }

    if (assignmentCounts.C > 0) {
      const assigned = getAssigned('C');
      const contentC = htmlC || '<div class="p-4 bg-red-50 border-2 border-red-400 rounded"><strong>Error:</strong> Version C required but missing. No se pudo extraer el contenido de la versión C.</div>';
      evaluations.push({
        id: 'C',
        title: 'Versión C (Adecuación de contenido)',
        content: contentC,
        version: 3,
        versionKind: 'C',
        versionLabel: 'Versión C (Adecuación de contenido)',
        adaptations: [],
        assignedStudents: assigned.names,
        assignedStudentIds: assigned.ids
      });
    }

    return evaluations;
  }, [evaluationBundle, evaluationDesignPlan, generatedEvaluations, group, studentAssignments]);

  const sections = v2RawResponse?.evaluationSpec?.sections;
  const hasV2Spec = useBetaV2 && !!v2RawResponse?.evaluationSpec && (sections?.some((s: { items?: unknown[] }) => (s.items?.length ?? 0) > 0) ?? false);
  const hasV1 = (displayEvaluations?.length ?? 0) > 0;
  const canSave = hasV2Spec || hasV1;

  const getEvaluationsToSave = useCallback((): GeneratedEvaluation[] => {
    if (hasV2Spec && v2RawResponse?.evaluationSpec) {
      const spec = v2RawResponse.evaluationSpec as { meta?: { subject?: string }; sections?: unknown[] };
      const title = spec.meta?.subject ? `Evaluación — ${spec.meta.subject}` : 'Evaluación (V2)';
      const sectionCount = spec.sections?.length ?? 0;
      return [{
        id: 'A',
        title: 'Versión A (Universal)',
        content: `<h1>${title}</h1><p>Esta evaluación se almacena como especificación V2 (${sectionCount} sección(es)).</p>`,
        version: 1,
        versionKind: 'A',
        versionLabel: 'Versión A (Universal)',
        adaptations: [],
        assignedStudents: [],
        assignedStudentIds: []
      }];
    }
    return displayEvaluations;
  }, [hasV2Spec, v2RawResponse?.evaluationSpec, displayEvaluations]);

  const runGeneration = useCallback(async () => {
    if (!group || (!materia && !esInterdisciplinaria)) {
      onToast({
        title: 'Error de validación',
        description: 'Seleccioná un grupo y una materia antes de generar evaluaciones.',
        variant: 'destructive'
      });
      return;
    }
    if (esInterdisciplinaria && materiasSeleccionadas.length === 0) {
      onToast({
        title: 'Error de validación',
        description: 'Seleccioná al menos una materia para la evaluación interdisciplinaria.',
        variant: 'destructive'
      });
      return;
    }
    if (!hasAnepContent && !hasSessions && !hasMaterials) {
      onToast({
        title: 'Error de validación',
        description: 'Seleccioná al menos uno: contenidos ANEP, sesiones de clase, o materiales docentes.',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    const requestId = createClientRequestId();

    let generationContext: unknown = null;
    if (hasSessions || evaluationMaterialsConfig.directMaterialIds.length > 0) {
      try {
        const { buildEvaluationGenerationContext } = await import('@/services/evaluations');
        generationContext = await buildEvaluationGenerationContext({
          sourcePlanificacionId: evaluationSourceConfig.planificacionId,
          sourceSessionIds: evaluationSourceConfig.sessionIds,
          evaluationFocus: evaluationSourceConfig.evaluationFocus,
          directMaterialIds: evaluationMaterialsConfig.directMaterialIds,
          includeSessionMaterials: evaluationMaterialsConfig.includeSessionMaterials,
          selectedSubtemas,
          selectedCompetenciasIds,
          selectedCriteriosLogro,
          requerimientos,
          targetDurationMinutes
        });
      } catch (err) {
        console.error('[PHASE 6] Error building generation context:', err);
      }
    }

    try {
      const { getGroupContextForAI } = await import('@/services/groupContext/provider');
      const { seedDefaultsForStudent } = await import('@/lib/contemplaciones/seeding');

      if (group?.students) {
        for (const student of group.students) {
          seedDefaultsForStudent(student.id, student.name, false);
        }
      }

      const groupContextData = await getGroupContextForAI(group!.id, { purpose: 'evaluation' });
      const groupContext = {
        subject: esInterdisciplinaria ? materiasSeleccionadas.join(', ') : materia,
        subjects: esInterdisciplinaria ? materiasSeleccionadas : [materia],
        content: selectedSubtemas,
        competencies: selectedCompetenciasIds,
        criteriosLogro: selectedCriteriosLogro,
        isInterdisciplinary: esInterdisciplinaria,
        groupName: groupContextData.groupName,
        students: groupContextData.anonymizedStudentsForPrompt,
        ...(groupContextData.dominantLearningStyle && { dominantProfile: groupContextData.dominantLearningStyle })
      };

      const { buildEvaluationDesignPlan } = await import('@/services/evaluations');
      const { getEvaluationDesignRuleTemplate } = await import('@/lib/contemplaciones/enforcement');
      const plan = buildEvaluationDesignPlan({
        groupContext: groupContextData,
        teacherRequirementsText: requerimientos
      });
      const instrumentDesignRules = plan.instrumentDesignContemplacionIds
        .map(id => getEvaluationDesignRuleTemplate(id))
        .filter((rule): rule is string => Boolean(rule));
      const effectivePlan = plan;

      let modificationText = requerimientos || 'Genera una evaluación escrita universal basada en los contenidos seleccionados.';
      let materialsForDesignPlan: Array<{ title?: string; focusText?: string; extractedText?: string }> = [];
      if (generationContext) {
        const { serializeGenerationContext } = await import('@/services/evaluations');
        const serialized = serializeGenerationContext(generationContext);
        materialsForDesignPlan = (serialized.materials || []).slice(0, 5).map((m: { title?: string; focusText?: string; extractedText?: string }) => ({
          title: m.title,
          focusText: m.focusText,
          extractedText: (m.extractedText || '').substring(0, 4000)
        }));
        const contextSections: string[] = [];
        const sessionsToInclude = (serialized.sessions || []).slice(0, 5);
        if (sessionsToInclude.length > 0) {
          contextSections.push('SESIONES DE CLASE A EVALUAR:');
          sessionsToInclude.forEach((s: { order?: number; title?: string; anepContent?: string[]; competencies?: string[]; objectives?: string; activitiesSummary?: string; resources?: string[]; attachedMaterials?: { title: string }[] }, idx: number) => {
            contextSections.push(`\nSesión ${s.order}: ${s.title || `Sesión ${s.order}`}`);
            if (s.anepContent?.length) contextSections.push(`- Contenidos ANEP: ${s.anepContent.join(', ')}`);
            if (s.competencies?.length) contextSections.push(`- Competencias: ${s.competencies.join(', ')}`);
            if (s.objectives) contextSections.push(`- Objetivos: ${s.objectives}`);
            if (s.activitiesSummary) contextSections.push(`- Resumen de actividades: ${s.activitiesSummary}`);
            if (s.resources?.length) contextSections.push(`- Recursos: ${s.resources.join(', ')}`);
            if (s.attachedMaterials?.length) {
              contextSections.push(`- Materiales adjuntos: ${s.attachedMaterials.map((m: { title: string }) => m.title).join(', ')}`);
            }
            if (idx < sessionsToInclude.length - 1) contextSections.push('\n---');
          });
          if ((serialized.sessions || []).length > 5) {
            contextSections.push(`\n(Nota: Se incluyeron las primeras 5 de ${(serialized.sessions as unknown[]).length} sesiones seleccionadas)`);
          }
        }
        const materialsToInclude = (serialized.materials || []).slice(0, 5);
        if (materialsToInclude.length > 0) {
          contextSections.push('\n\nMATERIALES DOCENTES ADJUNTOS:');
          materialsToInclude.forEach((m: { title?: string; mimeType?: string; focusText?: string; extractedText?: string }, idx: number) => {
            contextSections.push(`\n${idx + 1}. ${m.title} (${m.mimeType})`);
            if (m.focusText) contextSections.push(`   Enfoque: ${m.focusText}`);
            if (m.extractedText) {
              const textSnippet = m.extractedText.substring(0, 500);
              contextSections.push(`   Contenido extraído del PDF:\n   ${textSnippet}${m.extractedText.length > 500 ? '...' : ''}`);
            }
            if (idx < materialsToInclude.length - 1) contextSections.push('\n---');
          });
          if ((serialized.materials as unknown[] || []).length > 5) {
            contextSections.push(`\n(Nota: Se incluyeron los primeros 5 de ${(serialized.materials as unknown[]).length} materiales seleccionados)`);
          }
        }
        if (serialized.evaluationFocus) {
          contextSections.push(`\n\nENFOQUE DE EVALUACIÓN (ESPECIFICADO POR EL DOCENTE):\n${serialized.evaluationFocus}`);
        }
        if (serialized.timeBudget) {
          contextSections.push(`\n\nPRESUPUESTO DE TIEMPO:\n- Duración objetivo: ${(serialized.timeBudget as { targetMinutes?: number }).targetMinutes} minutos\n- Tolerancia: ${Math.round(((serialized.timeBudget as { flexibilityThreshold?: number }).flexibilityThreshold || 0.10) * 100)}%`);
        }
        if (contextSections.length > 0) {
          modificationText = `${modificationText}\n\n${contextSections.join('\n')}`;
        }
      }

      const requestBody = {
        requestId,
        originalEvaluation: originalEvaluation,
        modification: modificationText,
        groupContext,
        type: 'modification',
        generation_mode: 'universal',
        evaluation_design_plan: {
          instrumentDesignRules,
          responseOptions: effectivePlan.responseOptions,
          triggers: effectivePlan.triggers,
          assignmentByStudentId: effectivePlan.assignmentByStudentId,
          perStudentReminders: effectivePlan.perStudentReminders,
          varkDistribution: effectivePlan.varkDistribution,
          highStructureNeed: effectivePlan.highStructureNeed,
          designComplexityCount: effectivePlan.designComplexityCount,
          bucketedContemplacionIds: effectivePlan.bucketedContemplacionIds
        }
      };

      if (debugPanelEnabled) {
        setPipelineDebug(prev => ({
          ...prev,
          lastRequest: {
            generationMode: requestBody.generation_mode,
            hasEvaluationDesignPlan: !!requestBody.evaluation_design_plan,
            hasGenerationContext: !!generationContext,
            triggers: effectivePlan.triggers,
            responseOptionsInclude: effectivePlan.responseOptions.include,
            assignmentsCount: Object.keys(effectivePlan.assignmentByStudentId).length
          }
        }));
      }

      setGenerationError(null);
      setV2RawResponse(null);

      let data: unknown = null;
      let error: { message?: string; status?: number } | null = null;
      let usedV2Endpoint = false;

      if (useBetaV2) {
        const requestedVersions = decideRequestedVersionsForModify({
          evaluationDesignPlan: {
            triggers: effectivePlan.triggers,
            assignmentByStudentId: effectivePlan.assignmentByStudentId
          },
          groupContextStudents: groupContextData.anonymizedStudentsForPrompt
        });
        const v2RequestBody = {
          requestId,
          modification: modificationText,
          groupContext,
          requestedVersions,
          evaluation_design_plan: {
            instrumentDesignRules,
            responseOptions: effectivePlan.responseOptions,
            triggers: effectivePlan.triggers,
            assignmentByStudentId: effectivePlan.assignmentByStudentId,
            perStudentReminders: effectivePlan.perStudentReminders,
            varkDistribution: effectivePlan.varkDistribution,
            highStructureNeed: effectivePlan.highStructureNeed,
            designComplexityCount: effectivePlan.designComplexityCount,
            bucketedContemplacionIds: effectivePlan.bucketedContemplacionIds,
            targetDurationMinutes,
            ...(materialsForDesignPlan.length > 0 && { materials: materialsForDesignPlan })
          }
        };
        const v2Result = await invokeEdgeFunctionAuthed('modify-evaluation-v2', { body: v2RequestBody });

        if (v2Result.error) {
          const details = `No se pudo generar con el motor V2. Ajustá la duración objetivo, agregá más material fuente o simplificá la solicitud. requestId=${requestId}.`;
          if (!ENABLE_V2_TO_V1_FALLBACK) {
            setGenerationError({
              message: 'La generación V2 no pudo completarse',
              details,
              code: 'V2_EDGE_CALL_FAILED',
              requestId,
              show: true
            });
            throw new Error(v2Result.error.message || 'V2 edge call failed');
          }
          console.warn('[EVAL_PIPELINE] V2 endpoint error, falling back to V1 (flag enabled):', v2Result.error.message);
        } else if (!v2Result.data) {
          const details = `La respuesta V2 llegó vacía. Ajustá duración/materiales y reintentá. requestId=${requestId}.`;
          if (!ENABLE_V2_TO_V1_FALLBACK) {
            setGenerationError({
              message: 'La generación V2 devolvió una respuesta inválida',
              details,
              code: 'V2_EMPTY_RESPONSE',
              requestId,
              show: true
            });
            throw new Error('V2 returned no data');
          }
          console.warn('[EVAL_PIPELINE] V2 returned no data, falling back to V1 (flag enabled)');
        } else if (!(v2Result.data as { success?: boolean }).success) {
          const v2Data = v2Result.data as {
            requestId?: string;
            error?: { code?: string; message?: string };
            outcome?: { code?: string; message?: string; actionableGuidance?: string[] };
          };
          const serverRequestId = v2Data.requestId || requestId;
          const failureCode = v2Data.error?.code || v2Data.outcome?.code || 'V2_GENERATION_FAILED';
          const guidance = (v2Data.outcome?.actionableGuidance || []).join(' ');
          const details = `${v2Data.error?.message || v2Data.outcome?.message || 'No se pudo cumplir la solicitud con grounding suficiente.'} ${guidance}`.trim() + ` requestId=${serverRequestId}.`;
          if (!ENABLE_V2_TO_V1_FALLBACK) {
            setGenerationError({
              message: 'La generación V2 no pudo completarse',
              details,
              code: failureCode,
              requestId: serverRequestId,
              show: true
            });
            throw new Error(details);
          }
          console.warn('[EVAL_PIPELINE] V2 returned success=false, falling back to V1 (flag enabled)');
        } else {
          const v2Response = v2Result.data as V2Response;
          setV2RawResponse(v2Response);
          usedV2Endpoint = true;
          onSuccess?.setIsConfigCollapsed?.(true);
          data = {
            evaluationBundle: {
              versions: { A: '', B: null, C: null },
              baseHtml: '',
              versionBHtml: null,
              versionCHtml: null,
              responseOptionsIncluded: v2Response.aiReport?.responseOptions?.included ?? false,
              responseOptionCount: v2Response.aiReport?.responseOptions?.count ?? 2
            },
            aiReport: v2Response.aiReport,
            studentAssignments: {},
            teacherRemindersByStudent: v2Response.teacherRemindersByStudent,
            warnings: v2Response.warnings?.map(w => w.message) || [],
            _v2Mode: true
          };
        }
      }

      if (!usedV2Endpoint) {
        if (useBetaV2 && !ENABLE_V2_TO_V1_FALLBACK) {
          throw new Error(`V2 failure without fallback. requestId=${requestId}`);
        }
        const v1Result = await invokeEdgeFunctionAuthed('modify-evaluation', { body: requestBody });
        data = v1Result.data;
        error = v1Result.error;
      }

      if (error) {
        const errorMessage = error.message || 'Error desconocido al llamar al servidor';
        const errorStatus = error.status || '';
        setGenerationError({
          message: 'No se pudo generar la evaluación',
          details: `${errorMessage}${errorStatus ? ` (Código: ${errorStatus})` : ''}`,
          show: true
        });
        throw error;
      }

      if (!data) {
        setGenerationError({
          message: 'Error en la respuesta del servidor',
          details: 'El servidor no retornó datos. Por favor, intentá nuevamente.',
          show: true
        });
        throw new Error('Edge function returned no data');
      }

      const dataObj = data as Record<string, unknown>;
      const edgeAssignments = dataObj?.studentAssignments as Record<string, 'A' | 'B' | 'C'> | undefined;
      const hasEdgeAssignments = edgeAssignments && Object.keys(edgeAssignments).length > 0;
      const rawAssignments = hasEdgeAssignments ? edgeAssignments : (effectivePlan.assignmentByStudentId || {});

      const normalizeAssignments = (
        assignments: Record<string, 'A' | 'B' | 'C'>,
        bundle: EvaluationBundle | null,
        isV2: boolean
      ) => {
        const available = isV2
          ? { A: true, B: effectivePlan.triggers.versionB, C: effectivePlan.triggers.versionC }
          : {
              A: true,
              B: Boolean(bundle?.versionBHtml || bundle?.versions?.B),
              C: Boolean(bundle?.versionCHtml || bundle?.versions?.C)
            };
        const normalized: Record<string, 'A' | 'B' | 'C'> = {};
        Object.entries(assignments).forEach(([key, value]) => {
          normalized[String(key)] = value;
        });
        const warnings: string[] = [];
        Object.entries(normalized).forEach(([studentId, version]) => {
          if (!available[version]) {
            normalized[studentId] = 'A';
            warnings.push(`Se reasignó ${studentId} a Versión A porque ${version} no fue generada.`);
          }
        });
        return { normalized, warnings };
      };

      setEvaluationDesignPlan(effectivePlan);

      const isV2Mode = (dataObj?._v2Mode === true) as boolean;
      const hasVersionA = isV2Mode || Boolean(
        (dataObj?.evaluationBundle as { versions?: { A?: string }; baseHtml?: string } | undefined)?.versions?.A ||
        (dataObj?.evaluationBundle as { baseHtml?: string } | undefined)?.baseHtml
      );

      if (!hasVersionA) {
        setGenerationError({
          message: 'Error en la respuesta del servidor',
          details: 'La respuesta no contiene la versión A de la evaluación. Por favor, intentá nuevamente.',
          show: true
        });
        onToast({
          title: 'Error crítico',
          description: 'La respuesta del servidor no contiene la versión A de la evaluación.',
          variant: 'destructive'
        });
        setIsGenerating(false);
        return;
      }

      const evalBundle = dataObj.evaluationBundle as {
        versions?: { A?: string; B?: string | null; C?: string | null };
        baseHtml?: string;
        versionBHtml?: string | null;
        versionCHtml?: string | null;
        responseOptionsIncluded?: boolean;
        responseOptionCount?: number;
        finalAssignmentCounts?: { A: number; B: number; C: number };
      } | undefined;
      const versionA = evalBundle?.versions?.A || evalBundle?.baseHtml || '';
      const versionB = evalBundle?.versions?.B ?? evalBundle?.versionBHtml ?? null;
      const versionC = evalBundle?.versions?.C ?? evalBundle?.versionCHtml ?? null;

      const evaluationBundleToSet: EvaluationBundle = {
        baseHtml: typeof versionA === 'string' ? versionA : '',
        versionBHtml: typeof versionB === 'string' ? versionB : null,
        versionCHtml: typeof versionC === 'string' ? versionC : null,
        versions: {
          A: typeof versionA === 'string' ? versionA : '',
          B: typeof versionB === 'string' ? versionB : null,
          C: typeof versionC === 'string' ? versionC : null
        },
        responseOptionsIncluded: evalBundle?.responseOptionsIncluded ?? false,
        responseOptionCount: evalBundle?.responseOptionCount ?? 2,
        finalAssignmentCounts: (dataObj as { finalAssignmentCounts?: { A: number; B: number; C: number } }).finalAssignmentCounts
      };

      setEvaluationBundle(evaluationBundleToSet);
      setGeneratedEvaluations([]);

      const normalizedResult = normalizeAssignments(rawAssignments, evaluationBundleToSet, isV2Mode);
      setStudentAssignments(normalizedResult.normalized);

      const edgeWarnings = Array.isArray(dataObj?.warnings) ? (dataObj.warnings as string[]) : [];
      setAssignmentWarnings([...edgeWarnings, ...normalizedResult.warnings]);

      const reminders = Array.isArray(dataObj?.teacherRemindersByStudent) && (dataObj.teacherRemindersByStudent as unknown[]).length > 0
        ? (dataObj.teacherRemindersByStudent as StudentReminders[])
        : [];
      setTeacherReminders(reminders);

      const validationResult = effectivePlan._reminderValidation;
      if (validationResult?.missingTemplates && validationResult.missingTemplates.length > 0) {
        setMissingTemplateErrors(validationResult.missingTemplates);
      } else {
        setMissingTemplateErrors([]);
      }

      const derivedEstimatedMinutes =
        (dataObj?.estimatedTotalMinutes as number | undefined) ??
        (dataObj?.evaluationSpec as { meta?: { duration?: { minutes?: number } } } | undefined)?.meta?.duration?.minutes ??
        null;
      const derivedTimeBreakdown =
        dataObj?.timeBreakdown ??
        (dataObj?.evaluationSpec as { meta?: { duration?: { breakdown?: unknown } } } | undefined)?.meta?.duration?.breakdown ??
        null;

      onSuccess?.setEstimatedDurationMinutes?.(derivedEstimatedMinutes);
      onSuccess?.setTimeBreakdown?.(derivedTimeBreakdown);

      if (dataObj?.aiReport) {
        onSuccess?.setAiDesignReport?.(JSON.stringify(dataObj.aiReport));
      } else if (dataObj?.aiDesignReport) {
        onSuccess?.setAiDesignReport?.(JSON.stringify(dataObj.aiDesignReport));
      } else {
        onSuccess?.setAiDesignReport?.(null);
      }

      if (!isV2Mode && !dataObj?.evaluationBundle) {
        setGenerationError({
          message: 'Error en la respuesta del servidor',
          details: 'La respuesta no contiene evaluationBundle. El servidor puede no haber procesado la solicitud correctamente.',
          show: true
        });
        onToast({
          title: 'Error en la respuesta',
          description: 'La respuesta del servidor no contiene evaluationBundle. Por favor, intentá nuevamente.',
          variant: 'destructive'
        });
        setIsGenerating(false);
        return;
      }

      if (!isV2Mode && !dataObj?.aiReport) {
        setGenerationError({
          message: 'Error en la respuesta del servidor',
          details: 'La respuesta no contiene aiReport. La evaluación no se puede guardar correctamente.',
          show: true
        });
        onToast({
          title: 'Error crítico',
          description: 'La respuesta del servidor no contiene aiReport. Por favor, intentá nuevamente.',
          variant: 'destructive'
        });
        setIsGenerating(false);
        return;
      }

      setGenerationError(null);
      onSuccess?.setIsConfigCollapsed?.(true);
      onSuccess?.setActiveTab?.('results');
    } catch (err: unknown) {
      const error = err as { message?: string; status?: number };
      let errorMessage = 'No se pudo generar la evaluación. Por favor, intentá nuevamente.';
      let errorDetails = '';

      if (error?.message) {
        if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          errorMessage = 'Error de conexión';
          errorDetails = 'No se pudo conectar con el servidor. Verificá tu conexión a internet e intentá nuevamente.';
        } else if (error.message.includes('auth') || error.message.includes('401') || error.message.includes('403')) {
          errorMessage = 'Error de autenticación';
          errorDetails = 'Tu sesión expiró o no tenés permisos. Por favor, iniciá sesión nuevamente.';
        } else if (error.message.includes('timeout') || error.message.includes('504')) {
          errorMessage = 'Tiempo de espera agotado';
          errorDetails = 'El servidor tardó demasiado en responder. Intentá nuevamente.';
        } else {
          errorDetails = error.message;
        }
      }
      if (error?.status) {
        errorDetails = `${errorDetails} (Código: ${error.status})`;
      }

      onToast({
        title: errorMessage,
        description: errorDetails || 'Ocurrió un error inesperado al generar la evaluación.',
        variant: 'destructive',
        duration: 10000
      });

      setGeneratedEvaluations([]);
      setEvaluationBundle(null);
      setEvaluationDesignPlan(null);
      setStudentAssignments({});
      setTeacherReminders([]);
      setMissingTemplateErrors([]);
      setAssignmentWarnings([]);
      setV2RawResponse(null);
      onSuccess?.setAiDesignReport?.(null);

      setGenerationError({
        message: errorMessage,
        details: errorDetails,
        show: true
      });

      if (debugPanelEnabled) {
        setPipelineDebug(prev => ({
          ...prev,
          lastResponse: {
            hasAiReport: false,
            hasEvaluationBundle: false,
            versionsGenerated: [],
            warningsCount: 0,
            endpoint: 'modify-evaluation',
            error: errorMessage + (errorDetails ? `: ${errorDetails}` : '')
          }
        }));
      }
    } finally {
      setIsGenerating(false);
    }
  }, [
    group,
    materia,
    esInterdisciplinaria,
    materiasSeleccionadas,
    selectedSubtemas,
    selectedCompetenciasIds,
    selectedCriteriosLogro,
    requerimientos,
    evaluationSourceConfig,
    evaluationMaterialsConfig,
    targetDurationMinutes,
    originalEvaluation,
    useBetaV2,
    onToast,
    debugPanelEnabled,
    onSuccess,
    hasAnepContent,
    hasSessions,
    hasMaterials
  ]);

  const status: PipelineStatus = isGenerating ? 'generating' : generationError?.show ? 'error' : (evaluationBundle || v2RawResponse) ? 'success' : 'idle';

  return {
    status,
    isGenerating,
    generationError,
    runGeneration,
    displayEvaluations,
    evaluationBundle,
    evaluationDesignPlan,
    studentAssignments,
    teacherReminders,
    assignmentWarnings,
    missingTemplateErrors,
    v2RawResponse,
    v2SelectedVersion,
    setV2RawResponse,
    setV2SelectedVersion,
    previousV2Response,
    setPreviousV2Response,
    hasV2Spec,
    hasV1,
    canSave,
    getEvaluationsToSave,
    pipelineDebug,
    setPipelineDebug,
    generatedEvaluations,
    setGeneratedEvaluations
  };
}
