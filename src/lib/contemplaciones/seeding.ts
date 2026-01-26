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
  migrateLegacyKeys,
  type ContemplacionCategoryStorage,
  type SeedingMetadata
} from './storage';

/**
 * Current defaults version
 * 
 * HIGH VERSION NUMBER to force deterministic upgrade.
 * 
 * Version history:
 * - v1: Initial defaults implementation
 * - v2: Updated mappings for 4 students
 * - v3: Unified all 10 students
 * - v999: FORCE DETERMINISTIC - canonical keys, aggressive upgrade
 */
export const CURRENT_DEFAULTS_VERSION = 999;

export interface SeedingResult {
  seeded: boolean;
  category: ContemplacionCategoryStorage;
  resolvedCount: number;
  unresolvedCount: number;
  unresolvedLabels: string[];
}

/**
 * DETERMINISTIC FORCE SEED/UPGRADE
 * 
 * This function enforces exact defaults for each student.
 * 
 * Algorithm:
 * 1. Migrate any legacy keys to canonical format
 * 2. Get defaults for this studentId (ID-based, NO name fallback)
 * 3. Resolve labels to IDs (MUST resolve 100%, assert unresolved=0)
 * 4. Check user_touched flag
 * 5. If user_touched=true → SKIP (respect manual edits)
 * 6. If user_touched=false → FORCE WRITE defaults (overwrite any existing)
 * 7. Write seed metadata with v999
 * 8. Return result with detailed info
 * 
 * @param studentId - The student ID (REQUIRED, must match defaults.ts)
 * @param studentName - The student name (for logging only)
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
  const canonicalKey = category === 'clase' 
    ? `contemplaciones_clase_${studentId}` 
    : `contemplaciones_evaluaciones_${studentId}`;
    
  const result: SeedingResult = {
    seeded: false,
    category,
    resolvedCount: 0,
    unresolvedCount: 0,
    unresolvedLabels: []
  };

  if (verbose) {
    console.log(`[SEED] [${CAT_UPPER}] ========== START SEEDING ==========`);
    console.log(`[SEED] [${CAT_UPPER}] Student: ${studentName} (ID: ${studentId})`);
    console.log(`[SEED] [${CAT_UPPER}] Canonical key: ${canonicalKey}`);
  }

  // STEP 1: Get defaults for this studentId (ID-based, NO name fallback)
  const defaults = getDefaultsForStudent(studentId);
  if (!defaults) {
    if (verbose) {
      console.warn(`[SEED] [${CAT_UPPER}] ❌ NO DEFAULTS defined for student ID: ${studentId}`);
    }
    return result;
  }

  // STEP 2: Get labels for this category
  const labels = category === 'clase' ? defaults.clase : defaults.evaluacion;
  if (labels.length === 0) {
    if (verbose) {
      console.log(`[SEED] [${CAT_UPPER}] No labels to seed for this category`);
    }
    return result;
  }

  if (verbose) {
    console.log(`[SEED] [${CAT_UPPER}] Defaults found: ${labels.length} labels`);
  }

  // STEP 3: Resolve labels to IDs (MUST be 100% success)
  const categoryType = category === 'clase' ? 'clase' : 'evaluaciones';
  const resolution = resolveContemplacionIds(labels, categoryType);

  result.resolvedCount = resolution.resolved.length;
  result.unresolvedCount = resolution.unresolved.length;
  result.unresolvedLabels = resolution.unresolved;

  // CRITICAL: Assert unresolved = 0 in DEV
  if (resolution.unresolved.length > 0) {
    const errorMsg = `[SEED] [${CAT_UPPER}] ❌ CRITICAL: ${resolution.unresolved.length} label(s) UNRESOLVED for ${studentName}`;
    console.error(errorMsg, resolution.unresolved);
    
    if (import.meta.env.DEV) {
      throw new Error(`${errorMsg}: ${resolution.unresolved.join(', ')}`);
    }
  }

  if (resolution.resolved.length === 0) {
    if (verbose) {
      console.warn(`[SEED] [${CAT_UPPER}] ❌ No resolved IDs (all labels failed)`);
    }
    return result;
  }

  if (verbose) {
    console.log(`[SEED] [${CAT_UPPER}] ✅ Resolved ${resolution.resolved.length} IDs`);
  }

  // STEP 4: Check user_touched flag
  const userHasTouched = isUserTouched(studentId, category);
  
  if (userHasTouched) {
    if (verbose) {
      console.log(`[SEED] [${CAT_UPPER}] 🔒 USER TOUCHED → SKIP (respecting manual edits)`);
      console.log(`[SEED] [${CAT_UPPER}] ========== END SEEDING ==========`);
    }
    return result;
  }

  if (verbose) {
    console.log(`[SEED] [${CAT_UPPER}] ✅ NOT user-touched → will FORCE WRITE defaults`);
  }

  // STEP 5: Read existing selection (for logging only)
  const existingSelection = readSelected(studentId, category);
  const existingMeta = readSeedMeta(studentId, category);
  
  if (verbose) {
    console.log(`[SEED] [${CAT_UPPER}] Current state in storage:`);
    console.log(`[SEED] [${CAT_UPPER}]   - Existing count: ${existingSelection.length}`);
    console.log(`[SEED] [${CAT_UPPER}]   - Existing meta version: ${existingMeta?.version || 'none'}`);
    console.log(`[SEED] [${CAT_UPPER}]   - Target count: ${resolution.resolved.length}`);
    console.log(`[SEED] [${CAT_UPPER}]   - Target version: ${CURRENT_DEFAULTS_VERSION}`);
  }

  // STEP 6: FORCE WRITE defaults (overwrite any existing)
  writeSelected(studentId, category, resolution.resolved);
  
  // STEP 7: Write metadata
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
    console.log(`[SEED] [${CAT_UPPER}] ✅ FORCE WROTE ${resolution.resolved.length} IDs to ${canonicalKey}`);
    console.log(`[SEED] [${CAT_UPPER}] ✅ Wrote metadata with v${CURRENT_DEFAULTS_VERSION}`);
    console.log(`[SEED] [${CAT_UPPER}] IDs written:`, resolution.resolved);
    console.log(`[SEED] [${CAT_UPPER}] ========== END SEEDING ==========`);
  }
  
  return result;
}

/**
 * Seed default contemplaciones for a student (both categories).
 * 
 * DETERMINISTIC FORCE SEEDING:
 * 1. Migrates any legacy keys to canonical format
 * 2. Seeds/overwrites CLASE category (unless user_touched)
 * 3. Seeds/overwrites EVALUACIONES category (unless user_touched)
 * 4. Returns detailed results
 * 
 * @param studentId - The student ID (REQUIRED)
 * @param studentName - The student name (for logging only)
 * @param verbose - Enable detailed logging (DEV only)
 * @returns Array of SeedingResult for each category
 */
export function seedDefaultsForStudent(
  studentId: number,
  studentName: string,
  verbose: boolean = false
): SeedingResult[] {
  if (verbose) {
    console.log(`\n========== SEEDING STUDENT ${studentName} (ID: ${studentId}) ==========`);
  }

  // STEP 0: Migrate any legacy keys to canonical format (one-time, idempotent)
  migrateLegacyKeys(studentId);

  const results: SeedingResult[] = [];

  // STEP 1: Seed CLASE category
  const claseResult = seedDefaultsForCategory(studentId, studentName, 'clase', verbose);
  results.push(claseResult);

  // STEP 2: Seed EVALUACIÓN category
  const evalResult = seedDefaultsForCategory(studentId, studentName, 'evaluaciones', verbose);
  results.push(evalResult);

  // Summary log (DEV only)
  if (verbose) {
    const totalSeeded = results.filter(r => r.seeded).length;
    const totalResolved = results.reduce((sum, r) => sum + r.resolvedCount, 0);
    const totalUnresolved = results.reduce((sum, r) => sum + r.unresolvedCount, 0);
    
    console.log(`\n[SEED-SUMMARY] Student ${studentName} (ID: ${studentId}):`);
    console.log(`  Categories seeded: ${totalSeeded}/2`);
    console.log(`  Total resolved: ${totalResolved}`);
    console.log(`  Total unresolved: ${totalUnresolved}`);
    
    if (totalUnresolved > 0) {
      console.error(`  ❌ UNRESOLVED LABELS DETECTED - THIS SHOULD NOT HAPPEN`);
    }
    
    console.log(`========== END SEEDING STUDENT ${studentName} ==========\n`);
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

