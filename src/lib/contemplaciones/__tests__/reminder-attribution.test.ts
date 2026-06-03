/**
 * Deterministic verification test for per-student reminder attribution
 * 
 * This test verifies that reminders are attributed correctly to each student
 * based on their own contemplaciones, with NO cross-contamination.
 * 
 * To run manually:
 * 1. Open browser console
 * 2. Set: window.__CONTEMPLACIONES_DEBUG__ = true
 * 3. Run: testReminderAttribution()
 */

import { describe, expect, it } from 'vitest';
import { enforceForEvaluation } from '../enforcement';
import { writeSelected } from '../storage';
import { normalizeStudentId } from '../utils';

// Mock localStorage for testing
const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get store() {
      return store;
    }
  };
};

/**
 * Test: Verify per-student reminder attribution with NO cross-contamination
 * 
 * Setup:
 * - Student A (ID: 1): contemplacionesEval:1 -> ['contemplacion-1'] (Lectura oral)
 * - Student B (ID: 2): contemplacionesEval:2 -> ['contemplacion-3'] (Tiempo adicional)
 * - Student C (ID: 3): contemplacionesEval:3 -> ['contemplacion-9-22'] (Corrección centrada)
 * 
 * Expected:
 * - Map['1'] contains ONLY reminder for #1: "Recordar leer consignas en voz alta"
 * - Map['2'] contains ONLY reminder for #3: "Recuerda brindar más tiempo..."
 * - Map['3'] contains ONLY reminder for #9-22: "No penalizar ortografía..."
 * - NO cross-contamination (no student has another student's reminders)
 */
export function testReminderAttribution(): { pass: boolean; message: string; details: any } {
  console.log('[TEST] Starting per-student reminder attribution test...');
  
  // Setup mock localStorage
  const mockStorage = createMockLocalStorage();
  const originalLocalStorage = globalThis.localStorage;
  (globalThis as any).localStorage = mockStorage;

  try {
    // Clear storage
    mockStorage.clear();

    // Setup: Write different contemplaciones for each student (canonical keys via writeSelected)
    writeSelected(1, 'evaluaciones', ['contemplacion-1']);
    writeSelected(2, 'evaluaciones', ['contemplacion-3']);
    writeSelected(3, 'evaluaciones', ['contemplacion-9-22']);

    console.log('[TEST] Setup complete:', mockStorage.store);

    // Execute enforcement
    const students = [
      { id: 1, name: 'Student A' },
      { id: 2, name: 'Student B' },
      { id: 3, name: 'Student C' }
    ];

    const output = enforceForEvaluation(students);
    const reminders = output.perStudentReminders;

    console.log('[TEST] Enforcement output:', {
      totalStudents: students.length,
      mapKeys: Array.from(reminders.keys()),
      reminders: Object.fromEntries(reminders)
    });

    // Normalize IDs
    const id1 = normalizeStudentId(1);
    const id2 = normalizeStudentId(2);
    const id3 = normalizeStudentId(3);

    // Get reminders for each student
    const reminders1 = reminders.get(id1) || [];
    const reminders2 = reminders.get(id2) || [];
    const reminders3 = reminders.get(id3) || [];

    // Expected reminders
    const expected1 = 'Recordar leer consignas en voz alta';
    const expected2 = 'Recuerda brindar más tiempo y pausas en caso de ser necesario para este alumno';
    const expected3 = 'No penalizar ortografía/sintaxis cuando no es objetivo';

    // Verification
    const checks = {
      student1HasReminder: reminders1.includes(expected1),
      student1OnlyOneReminder: reminders1.length === 1,
      student2HasReminder: reminders2.includes(expected2),
      student2OnlyOneReminder: reminders2.length === 1,
      student3HasReminder: reminders3.includes(expected3),
      student3OnlyOneReminder: reminders3.length === 1,
      noCrossContamination1: !reminders1.includes(expected2) && !reminders1.includes(expected3),
      noCrossContamination2: !reminders2.includes(expected1) && !reminders2.includes(expected3),
      noCrossContamination3: !reminders3.includes(expected1) && !reminders3.includes(expected2)
    };

    const allPass = Object.values(checks).every(v => v === true);

    const details = {
      checks,
      reminders: {
        student1: reminders1,
        student2: reminders2,
        student3: reminders3
      },
      expected: {
        student1: [expected1],
        student2: [expected2],
        student3: [expected3]
      }
    };

    console.log('[TEST] Verification results:', details);

    if (allPass) {
      console.log('[TEST] ✅ PASS - No cross-contamination detected');
      return {
        pass: true,
        message: 'All students have only their own reminders, no cross-contamination',
        details
      };
    } else {
      console.error('[TEST] ❌ FAIL - Cross-contamination detected or incorrect reminders');
      return {
        pass: false,
        message: 'Some checks failed',
        details
      };
    }
  } catch (error) {
    console.error('[TEST] ❌ ERROR during test:', error);
    return {
      pass: false,
      message: `Test error: ${error}`,
      details: { error }
    };
  } finally {
    // Restore original localStorage
    (globalThis as any).localStorage = originalLocalStorage;
  }
}

describe('reminder attribution harness', () => {
  it('passes deterministic per-student attribution', () => {
    const result = testReminderAttribution();
    expect(result.pass, result.message).toBe(true);
  });
});








