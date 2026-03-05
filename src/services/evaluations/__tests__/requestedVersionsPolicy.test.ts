/**
 * Manual unit tests for requestedVersions + carry-forward guardrail.
 *
 * Run in browser console:
 * import('@/services/evaluations/__tests__/requestedVersionsPolicy.test').then(m => m.runAllTests())
 */

import { applyModifyCarryForward, decideRequestedVersionsForModify } from '../requestedVersionsPolicy';
import type { V2Response } from '../v2Types';

type TestResult = { name: string; passed: boolean; error?: string };

function makeResponse(params?: {
  hasB?: boolean;
  requestedB?: boolean;
  promptBOnItem?: boolean;
  requestId?: string;
}): V2Response {
  const hasB = params?.hasB ?? false;
  const requestedB = params?.requestedB ?? false;
  const promptBOnItem = params?.promptBOnItem ?? false;
  const item: {
    id: string;
    type: string;
    prompt: string;
    points: number;
    versionedContent?: { promptB?: string };
  } = {
    id: 'i1',
    type: 'short_answer',
    prompt: 'Pregunta',
    points: 1
  };
  if (promptBOnItem) {
    item.versionedContent = { promptB: 'Pregunta adaptada B' };
  }
  return {
    success: true,
    requestId: params?.requestId || 'req-test',
    evaluationSpec: {
      version: '2.0',
      generatedAt: new Date().toISOString(),
      meta: { subject: 'Historia', evaluationType: 'sumativa' },
      sections: [{ id: 's1', title: 'Sección 1', items: [item] }],
      versionVariants: {
        A: { label: 'A', isBase: true },
        ...(hasB ? { B: { label: 'B', isBase: false, reason: 'adapt', modifications: [] } } : {})
      }
    } as unknown as V2Response['evaluationSpec'],
    requestedVersions: { A: true, B: requestedB, C: false },
    instrumentDesignRulesApplied: [],
    teacherRemindersByStudent: [],
    aiReport: null,
    warnings: []
  };
}

function testDecisionKeepsBWhenCurrentSpecHasB(): TestResult {
  const name = 'Decision: mantiene B cuando ya existia en spec actual';
  try {
    const decision = decideRequestedVersionsForModify({
      currentEvaluationSpec: makeResponse({ hasB: true }).evaluationSpec
    });
    if (!decision.B) return { name, passed: false, error: 'B deberia ser true si ya existia en spec' };
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

function testDecisionEnablesBWhenAssignmentsNeedB(): TestResult {
  const name = 'Decision: activa B cuando assignmentByStudentId contiene B';
  try {
    const decision = decideRequestedVersionsForModify({
      evaluationDesignPlan: {
        assignmentByStudentId: { '1': 'A', '2': 'B' }
      }
    });
    if (!decision.B) return { name, passed: false, error: 'B deberia ser true por asignaciones en B' };
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

function testDecisionLeavesBFalseWithoutSignals(): TestResult {
  const name = 'Decision: B false sin senales de adaptacion ni versiones previas';
  try {
    const decision = decideRequestedVersionsForModify({});
    if (decision.B) return { name, passed: false, error: 'B deberia ser false por defecto' };
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

function testCarryForwardRestoresBWhenResponseDropsIt(): TestResult {
  const name = 'Carry-forward: restaura B cuando respuesta de modify la pierde';
  try {
    const previous = makeResponse({ hasB: true, requestedB: true, promptBOnItem: true, requestId: 'req-cf-1' });
    const next = makeResponse({ hasB: false, requestedB: false, promptBOnItem: false, requestId: 'req-cf-1' });
    const merged = applyModifyCarryForward({
      previousResponse: previous,
      nextResponse: next,
      requestedVersions: { A: true, B: true, C: false },
      explicitRemoval: { B: false }
    });
    if (!merged.carriedForwardB) return { name, passed: false, error: 'Se esperaba carriedForwardB=true' };
    if (!merged.response.requestedVersions.B) return { name, passed: false, error: 'requestedVersions.B deberia quedar true' };
    const item = merged.response.evaluationSpec?.sections?.[0]?.items?.[0] as { versionedContent?: { promptB?: string } } | undefined;
    if (!item?.versionedContent?.promptB) return { name, passed: false, error: 'promptB deberia recuperarse del estado previo' };
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

function testCarryForwardRespectsExplicitRemoval(): TestResult {
  const name = 'Carry-forward: respeta remocion explicita de B';
  try {
    const previous = makeResponse({ hasB: true, requestedB: true, promptBOnItem: true });
    const next = makeResponse({ hasB: false, requestedB: false, promptBOnItem: false });
    const merged = applyModifyCarryForward({
      previousResponse: previous,
      nextResponse: next,
      requestedVersions: { A: true, B: false, C: false },
      explicitRemoval: { B: true }
    });
    if (merged.carriedForwardB) return { name, passed: false, error: 'No deberia hacer carry-forward cuando hay remocion explicita' };
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

export function runAllTests() {
  const tests = [
    testDecisionKeepsBWhenCurrentSpecHasB,
    testDecisionEnablesBWhenAssignmentsNeedB,
    testDecisionLeavesBFalseWithoutSignals,
    testCarryForwardRestoresBWhenResponseDropsIt,
    testCarryForwardRespectsExplicitRemoval
  ];
  const results = tests.map((t) => t());
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log('=== requestedVersionsPolicy tests ===');
  results.forEach((r) => console.log(`${r.passed ? '✅' : '❌'} ${r.name}${r.error ? `: ${r.error}` : ''}`));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  return { total: results.length, passed, failed, results };
}

