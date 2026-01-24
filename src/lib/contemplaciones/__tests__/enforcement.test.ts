/**
 * Test harness for enforceForEvaluation
 * 
 * This is a minimal deterministic verification to ensure per-student
 * reminders are correctly attributed without cross-contamination.
 * 
 * To run: Execute this file in a Node.js environment or test runner
 * that supports localStorage simulation.
 */

import { enforceForEvaluation } from '../enforcement';
import { writeSelected } from '../storage';
import { normalizeStudentId } from '../utils';

// Mock localStorage for testing
const localStorageMock = (() => {
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
    }
  };
})();

// Set up localStorage mock
(global as any).localStorage = localStorageMock;

/**
 * Test: Verify per-student reminder attribution
 * 
 * Setup:
 * - student 101: ['contemplacion-1']
 * - student 202: ['contemplacion-3']
 * - student 303: ['contemplacion-9-22']
 * 
 * Expected:
 * - Map['101'] contains ONLY reminder for #1
 * - Map['202'] contains ONLY reminder for #3
 * - Map['303'] contains ONLY reminder for #9-22
 * - No cross-contamination
 */
export function testPerStudentReminderAttribution(): boolean {
  // Clear localStorage
  localStorageMock.clear();

  // Setup: Write contemplaciones for each student
  writeSelected(101, 'evaluaciones', ['contemplacion-1']);
  writeSelected(202, 'evaluaciones', ['contemplacion-3']);
  writeSelected(303, 'evaluaciones', ['contemplacion-9-22']);

  // Execute enforcement
  const students = [
    { id: 101, name: 'Student 101' },
    { id: 202, name: 'Student 202' },
    { id: 303, name: 'Student 303' }
  ];

  const output = enforceForEvaluation(students);
  const reminders = output.perStudentReminders;

  // Verify results
  const id101 = normalizeStudentId(101);
  const id202 = normalizeStudentId(202);
  const id303 = normalizeStudentId(303);

  const reminders101 = reminders.get(id101) || [];
  const reminders202 = reminders.get(id202) || [];
  const reminders303 = reminders.get(id303) || [];

  // Expected reminders
  const expected101 = ['Recordar leer consignas en voz alta'];
  const expected202 = ['Recuerda brindar más tiempo y pausas en caso de ser necesario para este alumno'];
  const expected303 = ['No penalizar ortografía/sintaxis cuando no es objetivo'];

  // Verify student 101
  const pass101 = reminders101.length === 1 && 
                   reminders101[0] === expected101[0] &&
                   reminders202.length === 0 &&
                   reminders303.length === 0;

  // Verify student 202
  const pass202 = reminders202.length === 1 && 
                   reminders202[0] === expected202[0] &&
                   reminders101.length === 1 &&
                   reminders303.length === 0;

  // Verify student 303
  const pass303 = reminders303.length === 1 && 
                   reminders303[0] === expected303[0] &&
                   reminders101.length === 1 &&
                   reminders202.length === 1;

  // Final check: all students have correct reminders, no cross-contamination
  const allPass = reminders101.length === 1 &&
                  reminders101[0] === expected101[0] &&
                  reminders202.length === 1 &&
                  reminders202[0] === expected202[0] &&
                  reminders303.length === 1 &&
                  reminders303[0] === expected303[0];

  console.log('Test Results:');
  console.log(`  Student 101 (${id101}):`, reminders101);
  console.log(`  Student 202 (${id202}):`, reminders202);
  console.log(`  Student 303 (${id303}):`, reminders303);
  console.log(`  All pass:`, allPass);

  return allPass;
}

// Export for use in test runner or manual execution
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  // Node.js environment
  const result = testPerStudentReminderAttribution();
  process.exit(result ? 0 : 1);
}


