import type { V2Response } from './v2Types';

type RequestedVersions = { A: boolean; B: boolean; C: boolean };

interface DesignPlanLike {
  triggers?: { versionB?: boolean; versionC?: boolean };
  assignmentByStudentId?: Record<string, 'A' | 'B' | 'C'>;
  studentAssignments?: Record<string, 'A' | 'B' | 'C'>;
}

interface VersionSpecLike {
  versionVariants?: Record<string, unknown>;
  sections?: Array<{
    items?: Array<{
      id?: string;
      versionedContent?: {
        promptB?: string;
        promptC?: string;
        optionsB?: unknown[];
        guidingQuestionsB?: unknown[];
        sourceB?: unknown;
        subItemsB?: unknown[];
      };
    }>;
  }>;
}

interface StudentLike {
  hasDeclaredContentAdaptation?: boolean;
  requiereAdecuacionContenido?: boolean;
  requiresContentAdaptation?: boolean;
  informeTecnico?: { requiereAdecuacionContenido?: boolean };
}

export function decideRequestedVersionsForModify(params: {
  explicitRequestedVersions?: Partial<RequestedVersions> | null;
  currentRequestedVersions?: Partial<RequestedVersions> | null;
  currentEvaluationSpec?: VersionSpecLike | null;
  evaluationDesignPlan?: unknown;
  groupContextStudents?: unknown;
}): RequestedVersions {
  const explicit = params.explicitRequestedVersions || {};
  const currentRequested = params.currentRequestedVersions || {};
  const designPlan = (params.evaluationDesignPlan && typeof params.evaluationDesignPlan === 'object'
    ? params.evaluationDesignPlan
    : {}) as DesignPlanLike;
  const spec = params.currentEvaluationSpec || null;
  const students = Array.isArray(params.groupContextStudents) ? (params.groupContextStudents as StudentLike[]) : [];

  const assignmentByStudentId = {
    ...(designPlan.assignmentByStudentId || {}),
    ...(designPlan.studentAssignments || {})
  };

  const hasAssignedB = Object.values(assignmentByStudentId).some(v => v === 'B');
  const hasAssignedC = Object.values(assignmentByStudentId).some(v => v === 'C');
  const hasDeclaredContentAdaptation = students.some((student) =>
    student?.hasDeclaredContentAdaptation === true ||
    student?.requiereAdecuacionContenido === true ||
    student?.requiresContentAdaptation === true ||
    student?.informeTecnico?.requiereAdecuacionContenido === true
  );

  const hasBInCurrentSpec = hasVersionVariant(spec, 'B') || hasVersionedPrompt(spec, 'B');
  const hasCInCurrentSpec = hasVersionVariant(spec, 'C') || hasVersionedPrompt(spec, 'C');

  const wantBFromState =
    Boolean(explicit.B) ||
    Boolean(currentRequested.B) ||
    hasBInCurrentSpec ||
    Boolean(designPlan.triggers?.versionB) ||
    hasAssignedB ||
    hasDeclaredContentAdaptation;

  const wantCFromState =
    Boolean(explicit.C) ||
    Boolean(currentRequested.C) ||
    hasCInCurrentSpec ||
    Boolean(designPlan.triggers?.versionC) ||
    hasAssignedC;

  return {
    A: true,
    B: wantBFromState,
    C: wantCFromState
  };
}

export function applyModifyCarryForward(params: {
  previousResponse: V2Response;
  nextResponse: V2Response;
  requestedVersions: RequestedVersions;
  explicitRemoval?: Partial<{ B: boolean; C: boolean }>;
  requestId?: string;
  logger?: Pick<Console, 'warn'>;
}): { response: V2Response; carriedForwardB: boolean } {
  const previous = params.previousResponse;
  const next = params.nextResponse;
  const logger = params.logger || console;
  const explicitRemoval = params.explicitRemoval || {};

  const hadBBefore = Boolean(previous.requestedVersions?.B) || hasVersionVariant(previous.evaluationSpec, 'B') || hasVersionedPrompt(previous.evaluationSpec, 'B');
  const shouldKeepB = params.requestedVersions.B && explicitRemoval.B !== true;

  const hasBAfter = Boolean(next.requestedVersions?.B) && (hasVersionVariant(next.evaluationSpec, 'B') || hasVersionedPrompt(next.evaluationSpec, 'B'));

  if (!hadBBefore || !shouldKeepB || hasBAfter) {
    return { response: next, carriedForwardB: false };
  }

  const merged: V2Response = JSON.parse(JSON.stringify(next));
  merged.requestedVersions = { ...(merged.requestedVersions || { A: true, B: false, C: false }), A: true, B: true };

  if (!merged.evaluationSpec && previous.evaluationSpec) {
    merged.evaluationSpec = JSON.parse(JSON.stringify(previous.evaluationSpec));
  }

  if (merged.evaluationSpec && previous.evaluationSpec) {
    const mergedVariants = (merged.evaluationSpec.versionVariants || {}) as Record<string, unknown>;
    const prevVariants = (previous.evaluationSpec.versionVariants || {}) as Record<string, unknown>;
    if (!mergedVariants.B && prevVariants.B) {
      mergedVariants.B = JSON.parse(JSON.stringify(prevVariants.B));
      merged.evaluationSpec.versionVariants = mergedVariants as typeof merged.evaluationSpec.versionVariants;
    }

    const previousItemById = buildItemIndexById(previous.evaluationSpec);
    for (const section of merged.evaluationSpec.sections || []) {
      for (const item of section.items || []) {
        const prevItem = previousItemById.get(item.id);
        if (!prevItem?.versionedContent?.promptB) continue;
        if (!item.versionedContent || !item.versionedContent.promptB) {
          item.versionedContent = {
            ...(item.versionedContent || {}),
            ...prevItem.versionedContent,
            promptB: prevItem.versionedContent.promptB
          };
        }
      }
    }
  }

  const requestId = params.requestId || next.requestId || previous.requestId || 'unknown-request';
  logger.warn(`[EVAL_MODIFY] Carry-forward de Version B aplicado por respuesta parcial. requestId=${requestId}`);
  return { response: merged, carriedForwardB: true };
}

function hasVersionVariant(spec: VersionSpecLike | null | undefined, key: 'B' | 'C'): boolean {
  if (!spec?.versionVariants || typeof spec.versionVariants !== 'object') return false;
  return Boolean((spec.versionVariants as Record<string, unknown>)[key]);
}

function hasVersionedPrompt(spec: VersionSpecLike | null | undefined, key: 'B' | 'C'): boolean {
  const promptKey = key === 'B' ? 'promptB' : 'promptC';
  for (const section of spec?.sections || []) {
    for (const item of section.items || []) {
      if (item?.versionedContent && typeof item.versionedContent[promptKey] === 'string' && item.versionedContent[promptKey]?.trim()) {
        return true;
      }
    }
  }
  return false;
}

function buildItemIndexById(spec: VersionSpecLike): Map<string, NonNullable<VersionSpecLike['sections']>[number]['items'][number]> {
  const index = new Map<string, NonNullable<VersionSpecLike['sections']>[number]['items'][number]>();
  for (const section of spec.sections || []) {
    for (const item of section.items || []) {
      if (item?.id) index.set(item.id, item);
    }
  }
  return index;
}
