/**
 * Manual verification tests for buildPerStudentReminders with fail-fast behavior
 * 
 * Since this project has no test runner infrastructure, these tests are designed
 * to be run manually in the browser console.
 * 
 * To run:
 * 1. Open browser console on the app
 * 2. Import and run: import('@/services/evaluations/__tests__/buildPerStudentReminders.test').then(m => m.runAllTests())
 */

import { buildPerStudentReminders, type BuildRemindersResult } from '../designPlan';
import type { StudentForAI } from '@/types/groupContextForAI';

// Helper to create a mock student with all required fields
function createMockStudent(
  id: string | number,
  contemplaciones: string[]
): StudentForAI {
  return {
    studentId: id,
    displayName: `Student ${id}`,
    contemplacionesClase: [],
    contemplacionesEvaluaciones: contemplaciones,
    learningProfile: 'Visual',
    requiresContentAdaptation: false,
    hasDeclaredContentAdaptation: false,
    declaredContentAdaptationSource: null
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

/**
 * Test: Admin reminders for contemplacion-1 (lectura oral)
 */
function testAdminRemindersContemplacion1(): TestResult {
  const name = 'Admin reminders for contemplacion-1';
  try {
    const students = [createMockStudent('1', ['contemplacion-1'])];
    const result = buildPerStudentReminders(students);

    if (result.missingTemplates.length !== 0) {
      return { name, passed: false, error: `Expected 0 missing templates, got ${result.missingTemplates.length}` };
    }
    if (result.reminders.length !== 1) {
      return { name, passed: false, error: `Expected 1 reminder, got ${result.reminders.length}` };
    }
    if (!result.reminders[0].admin.includes('Recordar leer consignas en voz alta')) {
      return { name, passed: false, error: `Expected admin to contain "Recordar leer consignas en voz alta"` };
    }
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

/**
 * Test: Admin reminders for contemplacion-3 (tiempo adicional)
 */
function testAdminRemindersContemplacion3(): TestResult {
  const name = 'Admin reminders for contemplacion-3';
  try {
    const students = [createMockStudent('2', ['contemplacion-3'])];
    const result = buildPerStudentReminders(students);

    if (result.missingTemplates.length !== 0) {
      return { name, passed: false, error: `Expected 0 missing templates` };
    }
    const expected = 'Recuerda brindar más tiempo y pausas en caso de ser necesario para este alumno';
    if (!result.reminders[0].admin.some(r => r.includes('tiempo'))) {
      return { name, passed: false, error: `Expected admin to contain time-related reminder` };
    }
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

/**
 * Test: Correction reminders for contemplacion-9-22
 */
function testCorrectionRemindersContemplacion922(): TestResult {
  const name = 'Correction reminders for contemplacion-9-22';
  try {
    const students = [createMockStudent('3', ['contemplacion-9-22'])];
    const result = buildPerStudentReminders(students);

    if (result.missingTemplates.length !== 0) {
      return { name, passed: false, error: `Expected 0 missing templates` };
    }
    if (!result.reminders[0].correction.some(r => r.includes('ortografía'))) {
      return { name, passed: false, error: `Expected correction to contain spelling-related reminder` };
    }
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

/**
 * Test: Allowances (design rules) for contemplacion-5
 */
function testAllowancesContemplacion5(): TestResult {
  const name = 'Allowances for contemplacion-5';
  try {
    const students = [createMockStudent('4', ['contemplacion-5'])];
    const result = buildPerStudentReminders(students);

    if (result.missingTemplates.length !== 0) {
      return { name, passed: false, error: `Expected 0 missing templates` };
    }
    if (!result.reminders[0].allowances.some(r => r.includes('Consignas en 2 capas'))) {
      return { name, passed: false, error: `Expected allowances to contain segmentation rule` };
    }
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

/**
 * Test: Multiple contemplaciones for same student
 */
function testMultipleContemplacionesSameStudent(): TestResult {
  const name = 'Multiple contemplaciones same student';
  try {
    const students = [
      createMockStudent('5', ['contemplacion-1', 'contemplacion-3', 'contemplacion-9-22'])
    ];
    const result = buildPerStudentReminders(students);

    if (result.missingTemplates.length !== 0) {
      return { name, passed: false, error: `Expected 0 missing templates` };
    }
    if (result.reminders[0].admin.length < 2) {
      return { name, passed: false, error: `Expected at least 2 admin reminders` };
    }
    if (result.reminders[0].correction.length < 1) {
      return { name, passed: false, error: `Expected at least 1 correction reminder` };
    }
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

/**
 * Test: Multiple students - no cross-contamination
 */
function testMultipleStudentsNoCrossContamination(): TestResult {
  const name = 'Multiple students no cross-contamination';
  try {
    const students = [
      createMockStudent('1', ['contemplacion-1']),
      createMockStudent('2', ['contemplacion-3']),
      createMockStudent('3', ['contemplacion-9-22'])
    ];
    const result = buildPerStudentReminders(students);

    if (result.missingTemplates.length !== 0) {
      return { name, passed: false, error: `Expected 0 missing templates` };
    }
    if (result.reminders.length !== 3) {
      return { name, passed: false, error: `Expected 3 reminders` };
    }
    if (result.reminders[0].studentId !== '1') {
      return { name, passed: false, error: `First student should have ID '1'` };
    }
    if (result.reminders[1].studentId !== '2') {
      return { name, passed: false, error: `Second student should have ID '2'` };
    }
    if (result.reminders[2].studentId !== '3') {
      return { name, passed: false, error: `Third student should have ID '3'` };
    }
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

/**
 * Test: Empty contemplaciones returns empty arrays
 */
function testEmptyContemplaciones(): TestResult {
  const name = 'Empty contemplaciones';
  try {
    const students = [createMockStudent('1', [])];
    const result = buildPerStudentReminders(students);

    if (result.missingTemplates.length !== 0) {
      return { name, passed: false, error: `Expected 0 missing templates` };
    }
    if (result.reminders[0].admin.length !== 0) {
      return { name, passed: false, error: `Expected empty admin array` };
    }
    if (result.reminders[0].correction.length !== 0) {
      return { name, passed: false, error: `Expected empty correction array` };
    }
    if (result.reminders[0].allowances.length !== 0) {
      return { name, passed: false, error: `Expected empty allowances array` };
    }
    return { name, passed: true };
  } catch (e) {
    return { name, passed: false, error: String(e) };
  }
}

/**
 * Run all tests and print results
 */
export function runAllTests(): { total: number; passed: number; failed: number; results: TestResult[] } {
  console.log('=== Running buildPerStudentReminders tests ===');
  
  const tests = [
    testAdminRemindersContemplacion1,
    testAdminRemindersContemplacion3,
    testCorrectionRemindersContemplacion922,
    testAllowancesContemplacion5,
    testMultipleContemplacionesSameStudent,
    testMultipleStudentsNoCrossContamination,
    testEmptyContemplaciones
  ];
  
  const results = tests.map(test => test());
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log('\nResults:');
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${r.name}${r.error ? `: ${r.error}` : ''}`);
  });
  
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  
  return { total: results.length, passed, failed, results };
}

import { describe, expect, it } from 'vitest';

describe('buildPerStudentReminders', () => {
  it('passes all reminder builder tests', () => {
    const { failed, results } = runAllTests();
    const errors = results.filter((r) => !r.passed).map((r) => `${r.name}: ${r.error ?? ''}`);
    expect(failed, errors.join('\n')).toBe(0);
  });
});

/** Manual verification function showing detailed output */
export function manualVerification() {
  console.log('=== Manual Verification of buildPerStudentReminders ===');
  
  const students = [
    createMockStudent('1', ['contemplacion-1']),
    createMockStudent('2', ['contemplacion-3', 'contemplacion-5']),
    createMockStudent('3', ['contemplacion-9-22'])
  ];
  
  const result = buildPerStudentReminders(students);
  
  console.log('Result:', JSON.stringify(result, null, 2));
  console.log('Missing templates:', result.missingTemplates.length);
  
  result.reminders.forEach(r => {
    console.log(`Student ${r.studentId}:`, {
      admin: r.admin,
      correction: r.correction,
      allowances: r.allowances
    });
  });
  
  return result;
}

