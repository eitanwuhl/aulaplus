/**
 * Contemplaciones Seeding Logic
 * 
 * Handles deterministic preselection of suggested contemplaciones per student profile.
 * Includes version control and upgrade mechanism to safely update defaults without
 * overwriting user modifications.
 */

import { resolveContemplacionIds } from './resolver';
import { getDefaultsForStudent, type StudentDefaults } from './defaults';
import { 
  readSelected, 
  writeSelected, 
  readSeedMeta,
  writeSeedMeta,
  computeSelectionHash,
  selectionMatchesSeed,
  isUserTouched,
  type ContemplacionCategoryStorage,
  type SeedingMetadata
} from './storage';

/**
 * Current defaults version
 * 
 * Increment this when defaults mappings change for existing students.
 * This triggers a safe upgrade mechanism that respects user modifications.
 * 
 * Version history:
 * - v1: Initial defaults implementation (Prompt 7 Part C)
 * - v2: Updated mappings based on informe técnico for 4 students with adecuaciones
 */
export const CURRENT_DEFAULTS_VERSION = 2;

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
 * IMPORTANT: This function includes version control and safe upgrade mechanism.
 * 
 * Decision tree:
 * 1. If NO selection exists → seed defaults + write metadata
 * 2. If selection exists:
 *    a. Load metadata
 *    b. If metadata.version < CURRENT_VERSION:
 *       - Check if user modified (compare hashes)
 *       - If NOT modified → UPGRADE to new defaults
 *       - If modified → SKIP upgrade (respect user)
 *    c. If no metadata:
 *       - Try detect legacy auto-seed → upgrade if detected
 *       - Otherwise → treat as user-owned, skip
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
  const CAT_UPPER = category.toUpperCase();
  const result: SeedingResult = {
    seeded: false,
    category,
    resolvedCount: 0,
    unresolvedCount: 0,
    unresolvedLabels: []
  };

  // Get defaults for this student
  const defaults = getDefaultsForStudent(studentName, studentId);
  if (!defaults) {
    if (verbose) {
      console.log(`[SEED] [${CAT_UPPER}] No defaults defined for student ${studentName} (ID: ${studentId})`);
    }
    return result;
  }

  // Get labels for this category
  const labels = category === 'clase' ? defaults.clase : defaults.evaluacion;
  if (labels.length === 0) {
    if (verbose) {
      console.log(`[SEED] [${CAT_UPPER}] No labels to seed for student ${studentName} in category ${category}`);
    }
    return result;
  }

  // Resolve labels to IDs
  const categoryType = category === 'clase' ? 'clase' : 'evaluaciones';
  const resolution = resolveContemplacionIds(labels, categoryType);

  result.resolvedCount = resolution.resolved.length;
  result.unresolvedCount = resolution.unresolved.length;
  result.unresolvedLabels = resolution.unresolved;

  // Warn about unresolved labels (DEV only)
  if (verbose && resolution.unresolved.length > 0) {
    console.warn(`[SEED] [${CAT_UPPER}] Warning: ${resolution.unresolved.length} label(s) could not be resolved for ${studentName}:`, resolution.unresolved);
  }

  if (resolution.resolved.length === 0) {
    if (verbose) {
      console.log(`[SEED] [${CAT_UPPER}] No resolved IDs to seed for ${studentName}`);
    }
    return result;
  }

  // Check if there's already a selection
  const existingSelection = readSelected(studentId, category);
  const hasExistingSelection = existingSelection.length > 0;

  // CASE 1: No existing selection → seed fresh
  if (!hasExistingSelection) {
    writeSelected(studentId, category, resolution.resolved);
    
    // Write metadata
    const metadata: SeedingMetadata = {
      version: CURRENT_DEFAULTS_VERSION,
      source: 'defaults',
      seededAt: new Date().toISOString(),
      selectionHash: computeSelectionHash(resolution.resolved),
      selectionCount: resolution.resolved.length
    };
    writeSeedMeta(studentId, category, metadata);
    
    result.seeded = true;
    
    if (verbose) {
      console.log(`[SEED] [${CAT_UPPER}] missing-key -> seeded ${resolution.resolved.length} contemplaciones for ${studentName} (ID: ${studentId})`);
    }
    
    return result;
  }

  // CASE 2: Existing selection → check for upgrade opportunity
  
  // First check: has user manually touched this category?
  const userHasTouched = isUserTouched(studentId, category);
  
  if (userHasTouched) {
    // User has made manual edits → NEVER upgrade
    if (verbose) {
      console.log(`[SEED] [${CAT_UPPER}] user-touched-flag -> skipped-upgrade for ${studentName} (ID: ${studentId})`);
    }
    return result;
  }
  
  // User has NOT touched → proceed with metadata-based upgrade logic
  const existingMeta = readSeedMeta(studentId, category);

  if (existingMeta) {
    // Has metadata → check version
    if (existingMeta.version < CURRENT_DEFAULTS_VERSION) {
      // Older version → check if user modified (hash comparison as additional safety)
      const currentHash = computeSelectionHash(existingSelection);
      const userModified = currentHash !== existingMeta.selectionHash || existingSelection.length !== existingMeta.selectionCount;

      if (!userModified) {
        // User did NOT modify → safe to upgrade
        writeSelected(studentId, category, resolution.resolved);
        
        // Update metadata
        const newMetadata: SeedingMetadata = {
          version: CURRENT_DEFAULTS_VERSION,
          source: 'defaults',
          seededAt: new Date().toISOString(),
          selectionHash: computeSelectionHash(resolution.resolved),
          selectionCount: resolution.resolved.length
        };
        writeSeedMeta(studentId, category, newMetadata);
        
        result.seeded = true;
        
        if (verbose) {
          console.log(`[SEED] [${CAT_UPPER}] upgrade-from-v${existingMeta.version} -> upgraded ${resolution.resolved.length} contemplaciones for ${studentName} (ID: ${studentId})`);
        }
      } else {
        // User modified (detected by hash) → DO NOT upgrade
        if (verbose) {
          console.log(`[SEED] [${CAT_UPPER}] user-modified-by-hash -> skipped-upgrade for ${studentName} (ID: ${studentId})`);
        }
      }
    } else {
      // Already at current version or newer → skip
      if (verbose) {
        console.log(`[SEED] [${CAT_UPPER}] Already at version ${existingMeta.version} for ${studentName} (ID: ${studentId}), skipping`);
      }
    }
  } else {
    // No metadata → try detect legacy auto-seed
    // For now, treat as user-owned and skip (conservative approach)
    // Future: Could try to detect if selection matches legacy student.contemplaciones
    if (verbose) {
      console.log(`[SEED] [${CAT_UPPER}] no-metadata -> treating as user-owned, skipping for ${studentName} (ID: ${studentId})`);
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

