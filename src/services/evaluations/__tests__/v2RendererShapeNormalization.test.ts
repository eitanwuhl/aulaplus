/**
 * Manual verification tests for renderer-shape normalization in v2Normalizer.
 *
 * Run in browser console:
 * import('@/services/evaluations/__tests__/v2RendererShapeNormalization.test').then(m => m.runAllTests())
 */

import { normalizeV2Response } from '../v2Normalizer';
import type { V2Response } from '../v2Types';

type TestResult = { name: string; passed: boolean; error?: string };

function buildBaseResponse(items: unknown[]): V2Response {
  return {
    success: true,
    evaluationSpec: {
      version: '2.0',
      generatedAt: new Date().toISOString(),
      meta: { subject: 'Historia', evaluationType: 'sumativa' },
      sections: [{ id: 's1', title: 'Sección 1', items: items as any }],
      versionVariants: { A: { label: 'A', isBase: true } }
    } as any,
    requestedVersions: { A: true, B: false, C: false },
    instrumentDesignRulesApplied: [],
    teacherRemindersByStudent: [],
    aiReport: null,
    warnings: []
  };
}

function testOrderingLegacySequence(): TestResult {
  const name = 'Ordering legacy sequence -> itemsToOrder normalized';
  try {
    const response = buildBaseResponse([
      { id: 'o1', type: 'ordering', prompt: 'Ordena', points: 2, sequence: ['A', 'B', 'C'] }
    ]);
    const out = normalizeV2Response(response);
    const item = out.evaluation?.sections?.[0]?.items?.[0];
    if (!item?.itemsToOrder || item.itemsToOrder.length < 3) {
      return { name, passed: false, error: 'itemsToOrder not normalized from sequence' };
    }
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

function testMatchingLegacyColumns(): TestResult {
  const name = 'Matching leftItems/rightItems normalized';
  try {
    const response = buildBaseResponse([
      {
        id: 'm1',
        type: 'matching',
        prompt: 'Relaciona',
        points: 2,
        leftItems: [{ id: 'l1', text: 'Concepto 1' }, { id: 'l2', text: 'Concepto 2' }],
        rightItems: [{ id: 'r1', text: 'Impacto 1' }, { id: 'r2', text: 'Impacto 2' }]
      }
    ]);
    const out = normalizeV2Response(response);
    const item = out.evaluation?.sections?.[0]?.items?.[0];
    if (!item?.leftColumn || item.leftColumn.length < 2) {
      return { name, passed: false, error: 'leftColumn not normalized' };
    }
    if (!item?.rightColumn || item.rightColumn.length < 2) {
      return { name, passed: false, error: 'rightColumn not normalized' };
    }
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

function testTableLegacyTableData(): TestResult {
  const name = 'Table legacy tableData normalized';
  try {
    const response = buildBaseResponse([
      {
        id: 't1',
        type: 'table_completion',
        prompt: 'Completa la tabla',
        points: 3,
        tableData: {
          headers: ['Concepto', 'Evidencia'],
          rows: [['Reforma', ''], ['Actor', '']]
        }
      }
    ]);
    const out = normalizeV2Response(response);
    const item = out.evaluation?.sections?.[0]?.items?.[0];
    if (!item?.table || item.table.columns.length < 2 || item.table.rows.length < 1) {
      return { name, passed: false, error: 'table not normalized from tableData' };
    }
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

export function runAllTests() {
  const tests = [testOrderingLegacySequence, testMatchingLegacyColumns, testTableLegacyTableData];
  const results = tests.map((t) => t());
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log('=== v2RendererShapeNormalization tests ===');
  results.forEach((r) => console.log(`${r.passed ? '✅' : '❌'} ${r.name}${r.error ? `: ${r.error}` : ''}`));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  return { total: results.length, passed, failed, results };
}

