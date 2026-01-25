/**
 * Contemplaciones Seeding Logic
 * 
 * Handles deterministic preselection of suggested contemplaciones per student profile.
 * Seeds defaults ONLY when there is no existing localStorage selection,
 * preserving user choices and ensuring idempotency.
 */

import { resolveContemplacionIds } from './resolver';
import { getDefaultsForStudent, type StudentDefaults } from './defaults';
import { readSelected, writeSelected, type ContemplacionCategoryStorage } from './storage';

export interface SeedingResult {
  seeded: boolean;
  category: ContemplacionCategoryStorage;
  resolvedCount: number;
  unresolvedCount: number;
  unresolvedLabels: string[];
}

/**
 * Seed default contemplaciones for a student (single category).
 * 
 * IMPORTANT: This function is idempotent and respects existing user selections.
 * It ONLY seeds when there is NO existing selection in localStorage for that student+category.
 * 
 * @param studentId - The student ID
 * @param studentName - The student name (for matching defaults)
 * @param category - The category to seed ('clase' | 'evaluaciones')
 * @param verbose - Enable detailed logging (DEV only)
 * @returns SeedingResult with details about what was seeded
 */
export function seedDefaultsForCategory(
  studentId: number,
  studentName: string,
  category: ContemplacionCategoryStorage,
  verbose: boolean = false
): SeedingResult {
  const result: SeedingResult = {
    seeded: false,
    category,
    resolvedCount: 0,
    unresolvedCount: 0,
    unresolvedLabels: []
  };

  // 1. Check if there's already a selection for this student+category
  const existing = readSelected(studentId, category);
  if (existing.length > 0) {
    if (verbose) {
      console.log(`[SEED-${category.toUpperCase()}] Student ${studentName} (ID: ${studentId}) already has ${existing.length} selection(s), skipping seed`);
    }
    return result;
  }

  // 2. Get defaults for this student
  const defaults = getDefaultsForStudent(studentName);
  if (!defaults) {
    if (verbose) {
      console.log(`[SEED-${category.toUpperCase()}] No defaults defined for student ${studentName} (ID: ${studentId})`);
    }
    return result;
  }

  // 3. Get labels for this category
  const labels = category === 'clase' ? defaults.clase : defaults.evaluacion;
  if (labels.length === 0) {
    if (verbose) {
      console.log(`[SEED-${category.toUpperCase()}] No labels to seed for student ${studentName} in category ${category}`);
    }
    return result;
  }

  // 4. Resolve labels to IDs
  const categoryType = category === 'clase' ? 'clase' : 'evaluaciones';
  const resolution = resolveContemplacionIds(labels, categoryType);

  result.resolvedCount = resolution.resolved.length;
  result.unresolvedCount = resolution.unresolved.length;
  result.unresolvedLabels = resolution.unresolved;

  // 5. Warn about unresolved labels (DEV only)
  if (verbose && resolution.unresolved.length > 0) {
    console.warn(`[SEED-${category.toUpperCase()}] Warning: ${resolution.unresolved.length} label(s) could not be resolved for ${studentName}:`, resolution.unresolved);
  }

  // 6. Write resolved IDs to localStorage (if any)
  if (resolution.resolved.length > 0) {
    writeSelected(studentId, category, resolution.resolved);
    result.seeded = true;
    
    if (verbose) {
      console.log(`[SEED-${category.toUpperCase()}] Seeded ${resolution.resolved.length} contemplaciones for ${studentName} (ID: ${studentId}):`, resolution.resolved);
    }
  }

  return result;
}

/**
 * Seed default contemplaciones for a student (both categories).
 * 
 * IMPORTANT: This function is idempotent and respects existing user selections.
 * It ONLY seeds categories that have NO existing selection in localStorage.
 * 
 * @param studentId - The student ID
 * @param studentName - The student name (for matching defaults)
 * @param verbose - Enable detailed logging (DEV only)
 * @returns Array of SeedingResult for each category
 */
export function seedDefaultsForStudent(
  studentId: number,
  studentName: string,
  verbose: boolean = false
): SeedingResult[] {
  const results: SeedingResult[] = [];

  // Seed CLASE category
  const claseResult = seedDefaultsForCategory(studentId, studentName, 'clase', verbose);
  results.push(claseResult);

  // Seed EVALUACIÓN category
  const evalResult = seedDefaultsForCategory(studentId, studentName, 'evaluaciones', verbose);
  results.push(evalResult);

  // Summary log (DEV only)
  if (verbose) {
    const totalSeeded = results.filter(r => r.seeded).length;
    const totalResolved = results.reduce((sum, r) => sum + r.resolvedCount, 0);
    const totalUnresolved = results.reduce((sum, r) => sum + r.unresolvedCount, 0);
    
    console.log(`[SEED-SUMMARY] Student ${studentName} (ID: ${studentId}):`, {
      categoriesSeeded: totalSeeded,
      totalResolved,
      totalUnresolved,
      details: results
    });
  }

  return results;
}

/**
 * Check if seeding is needed for a student (i.e., no existing selections).
 * 
 * @param studentId - The student ID
 * @returns true if at least one category has no selection (seeding needed)
 */
export function needsSeeding(studentId: number): boolean {
  const claseSelection = readSelected(studentId, 'clase');
  const evalSelection = readSelected(studentId, 'evaluaciones');
  
  return claseSelection.length === 0 || evalSelection.length === 0;
}

/**
 * Check if seeding is needed for a specific category.
 * 
 * @param studentId - The student ID
 * @param category - The category to check
 * @returns true if the category has no selection (seeding needed)
 */
export function needsSeedingForCategory(
  studentId: number,
  category: ContemplacionCategoryStorage
): boolean {
  const selection = readSelected(studentId, category);
  return selection.length === 0;
}

