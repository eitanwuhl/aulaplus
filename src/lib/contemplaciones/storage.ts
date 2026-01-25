/**
 * Persistencia de contemplaciones en localStorage
 * 
 * Este módulo maneja:
 * - Selecciones de contemplaciones por estudiante y categoría (clase/evaluaciones)
 * - Contemplaciones personalizadas (custom) por estudiante y categoría
 * 
 * Keys de localStorage:
 * - contemplacionesClase:${studentId} -> string[] (IDs de contemplaciones seleccionadas)
 * - contemplacionesEval:${studentId} -> string[] (IDs de contemplaciones seleccionadas)
 * - contemplacionesCustomClase:${studentId} -> CustomContemplacion[]
 * - contemplacionesCustomEval:${studentId} -> CustomContemplacion[]
 * 
 * Compatibilidad:
 * - No modifica keys existentes: adecuacionAcceso:${studentId}, adecuacionContenido:${studentId}
 * - No modifica key legacy: contemplaciones:${studentId} (si existe)
 */

import type { ContemplacionCategory } from './catalog';
import { normalizeContemplacionId } from './catalog';

export type ContemplacionCategoryStorage = 'clase' | 'evaluaciones';

export interface CustomContemplacion {
  id: string; // ID único generado (ej: 'custom-1234567890')
  title: string; // Título visible para el docente
  rule: string; // Regla oculta (no visible en UI, solo para lógica)
  selected: boolean; // Si está seleccionada actualmente
}

/**
 * Metadata for seeding tracking (versioning and user-modification detection)
 */
export interface SeedingMetadata {
  version: number; // Defaults version used for seeding
  source: 'defaults' | 'legacy'; // Source of the seeded data
  seededAt: string; // ISO timestamp of seeding
  selectionHash: string; // Deterministic hash of sorted selected IDs
  selectionCount: number; // Number of selected items (quick check)
}

/**
 * Obtener la key de localStorage para selecciones de contemplaciones
 */
function getSelectedKey(studentId: string | number, category: ContemplacionCategoryStorage): string {
  if (category === 'clase') {
    return `contemplacionesClase:${studentId}`;
  }
  return `contemplacionesEval:${studentId}`;
}

/**
 * Obtener la key de localStorage para contemplaciones custom
 */
function getCustomKey(studentId: string | number, category: ContemplacionCategoryStorage): string {
  if (category === 'clase') {
    return `contemplacionesCustomClase:${studentId}`;
  }
  return `contemplacionesCustomEval:${studentId}`;
}

/**
 * Leer selecciones de contemplaciones para un estudiante y categoría
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @returns Array de IDs de contemplaciones seleccionadas (normalizados)
 */
export function readSelected(
  studentId: string | number,
  category: ContemplacionCategoryStorage
): string[] {
  const key = getSelectedKey(studentId, category);
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return [];
    }
    
    const ids: string[] = JSON.parse(stored);
    if (!Array.isArray(ids)) {
      return [];
    }
    
    // Normalizar IDs (especialmente #9 y #22 -> contemplacion-9-22)
    return ids.map(id => normalizeContemplacionId(String(id)));
  } catch (error) {
    console.warn(`Error reading selected contemplaciones for ${key}:`, error);
    return [];
  }
}

/**
 * Escribir selecciones de contemplaciones para un estudiante y categoría
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @param ids Array de IDs de contemplaciones seleccionadas (se normalizan automáticamente)
 */
export function writeSelected(
  studentId: string | number,
  category: ContemplacionCategoryStorage,
  ids: string[]
): void {
  const key = getSelectedKey(studentId, category);
  
  try {
    // Normalizar IDs y eliminar duplicados
    const normalized = ids
      .map(id => normalizeContemplacionId(String(id)))
      .filter((id, index, array) => array.indexOf(id) === index); // Deduplicar
    
    localStorage.setItem(key, JSON.stringify(normalized));
  } catch (error) {
    console.error(`Error writing selected contemplaciones for ${key}:`, error);
    throw error;
  }
}

/**
 * Leer contemplaciones custom para un estudiante y categoría
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @returns Array de contemplaciones custom
 */
export function readCustom(
  studentId: string | number,
  category: ContemplacionCategoryStorage
): CustomContemplacion[] {
  const key = getCustomKey(studentId, category);
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return [];
    }
    
    const items: CustomContemplacion[] = JSON.parse(stored);
    if (!Array.isArray(items)) {
      return [];
    }
    
    // Validar estructura básica
    return items.filter(item => 
      item && 
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.rule === 'string' &&
      typeof item.selected === 'boolean'
    );
  } catch (error) {
    console.warn(`Error reading custom contemplaciones for ${key}:`, error);
    return [];
  }
}

/**
 * Escribir contemplaciones custom para un estudiante y categoría
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @param items Array de contemplaciones custom
 */
export function writeCustom(
  studentId: string | number,
  category: ContemplacionCategoryStorage,
  items: CustomContemplacion[]
): void {
  const key = getCustomKey(studentId, category);
  
  try {
    // Validar estructura antes de guardar
    const validItems = items.filter(item => 
      item && 
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.rule === 'string' &&
      typeof item.selected === 'boolean'
    );
    
    localStorage.setItem(key, JSON.stringify(validItems));
  } catch (error) {
    console.error(`Error writing custom contemplaciones for ${key}:`, error);
    throw error;
  }
}

/**
 * Helper: Toggle selección de una contemplación
 * 
 * IMPORTANT: This function marks the category as user-touched,
 * preventing automatic upgrades/reseeds.
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @param contemplacionId ID de la contemplación a togglear
 * @returns Nuevo array de IDs seleccionados
 */
export function toggleSelected(
  studentId: string | number,
  category: ContemplacionCategoryStorage,
  contemplacionId: string
): string[] {
  const current = readSelected(studentId, category);
  const normalizedId = normalizeContemplacionId(contemplacionId);
  
  const index = current.indexOf(normalizedId);
  let newSelection: string[];
  
  if (index === -1) {
    // Agregar
    newSelection = [...current, normalizedId];
  } else {
    // Remover
    newSelection = current.filter(id => id !== normalizedId);
  }
  
  writeSelected(studentId, category, newSelection);
  
  // Mark as user-touched to prevent automatic upgrades
  markUserTouched(studentId, category);
  
  return newSelection;
}

/**
 * Helper: Verificar si una contemplación está seleccionada
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @param contemplacionId ID de la contemplación a verificar
 * @returns true si está seleccionada
 */
export function isSelected(
  studentId: string | number,
  category: ContemplacionCategoryStorage,
  contemplacionId: string
): boolean {
  const selected = readSelected(studentId, category);
  const normalizedId = normalizeContemplacionId(contemplacionId);
  return selected.includes(normalizedId);
}

/**
 * Helper: Agregar contemplación custom
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @param title Título de la contemplación custom
 * @param rule Regla oculta
 * @param selected Si debe estar seleccionada inicialmente
 * @returns ID generado para la contemplación custom
 */
export function addCustom(
  studentId: string | number,
  category: ContemplacionCategoryStorage,
  title: string,
  rule: string,
  selected: boolean = false
): string {
  const current = readCustom(studentId, category);
  
  // Generar ID único (timestamp + random)
  const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const newItem: CustomContemplacion = {
    id,
    title: title.trim(),
    rule: rule.trim(),
    selected
  };
  
  const updated = [...current, newItem];
  writeCustom(studentId, category, updated);
  
  return id;
}

/**
 * Helper: Actualizar contemplación custom
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @param customId ID de la contemplación custom a actualizar
 * @param updates Campos a actualizar (parcial)
 */
export function updateCustom(
  studentId: string | number,
  category: ContemplacionCategoryStorage,
  customId: string,
  updates: Partial<Pick<CustomContemplacion, 'title' | 'rule' | 'selected'>>
): void {
  const current = readCustom(studentId, category);
  
  const updated = current.map(item => {
    if (item.id === customId) {
      return {
        ...item,
        ...updates,
        title: updates.title !== undefined ? updates.title.trim() : item.title,
        rule: updates.rule !== undefined ? updates.rule.trim() : item.rule
      };
    }
    return item;
  });
  
  writeCustom(studentId, category, updated);
}

/**
 * Helper: Eliminar contemplación custom
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @param customId ID de la contemplación custom a eliminar
 */
export function removeCustom(
  studentId: string | number,
  category: ContemplacionCategoryStorage,
  customId: string
): void {
  const current = readCustom(studentId, category);
  const updated = current.filter(item => item.id !== customId);
  writeCustom(studentId, category, updated);
}

/**
 * Helper: Toggle selección de contemplación custom
 * 
 * IMPORTANT: This function marks the category as user-touched,
 * preventing automatic upgrades/reseeds.
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @param customId ID de la contemplación custom a togglear
 */
export function toggleCustomSelected(
  studentId: string | number,
  category: ContemplacionCategoryStorage,
  customId: string
): void {
  const current = readCustom(studentId, category);
  const item = current.find(c => c.id === customId);
  
  if (item) {
    updateCustom(studentId, category, customId, { selected: !item.selected });
    
    // Mark as user-touched to prevent automatic upgrades
    markUserTouched(studentId, category);
  }
}

/**
 * Helper: Obtener todas las contemplaciones seleccionadas (catálogo + custom)
 * para un estudiante y categoría
 * 
 * @param studentId ID del estudiante
 * @param category Categoría ('clase' o 'evaluaciones')
 * @returns Objeto con IDs del catálogo y contemplaciones custom seleccionadas
 */
export function getAllSelected(
  studentId: string | number,
  category: ContemplacionCategoryStorage
): {
  catalogIds: string[];
  customItems: CustomContemplacion[];
} {
  const catalogIds = readSelected(studentId, category);
  const customItems = readCustom(studentId, category).filter(item => item.selected);
  
  return {
    catalogIds,
    customItems
  };
}

/**
 * Seeding Metadata Functions
 * 
 * These functions handle metadata tracking for seeding operations,
 * enabling version control and user-modification detection.
 */

/**
 * Get the localStorage key for seeding metadata
 */
function getSeedMetaKey(studentId: string | number, category: ContemplacionCategoryStorage): string {
  if (category === 'clase') {
    return `contemplaciones_seed_meta_clase_${studentId}`;
  }
  return `contemplaciones_seed_meta_evaluaciones_${studentId}`;
}

/**
 * Compute a deterministic hash of selected IDs
 * 
 * @param selectedIds - Array of selected contemplacion IDs
 * @returns Hash string (simple but deterministic)
 */
export function computeSelectionHash(selectedIds: string[]): string {
  // Sort for determinism, then join with separator
  const sorted = [...selectedIds].sort();
  const combined = sorted.join('|');
  
  // Simple hash (good enough for change detection)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return hash.toString(36); // Base36 for shorter string
}

/**
 * Read seeding metadata for a student + category
 * 
 * @param studentId - Student ID
 * @param category - Category (clase | evaluaciones)
 * @returns SeedingMetadata object, or null if not found
 */
export function readSeedMeta(
  studentId: string | number,
  category: ContemplacionCategoryStorage
): SeedingMetadata | null {
  try {
    const key = getSeedMetaKey(studentId, category);
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored) as SeedingMetadata;
    
    // Validate structure
    if (
      typeof parsed.version === 'number' &&
      (parsed.source === 'defaults' || parsed.source === 'legacy') &&
      typeof parsed.seededAt === 'string' &&
      typeof parsed.selectionHash === 'string' &&
      typeof parsed.selectionCount === 'number'
    ) {
      return parsed;
    }
    
    return null;
  } catch (error) {
    console.warn(`[SEED-META] Error reading metadata for student ${studentId} (${category}):`, error);
    return null;
  }
}

/**
 * Write seeding metadata for a student + category
 * 
 * @param studentId - Student ID
 * @param category - Category (clase | evaluaciones)
 * @param metadata - Metadata object to write
 */
export function writeSeedMeta(
  studentId: string | number,
  category: ContemplacionCategoryStorage,
  metadata: SeedingMetadata
): void {
  try {
    const key = getSeedMetaKey(studentId, category);
    localStorage.setItem(key, JSON.stringify(metadata));
  } catch (error) {
    console.error(`[SEED-META] Error writing metadata for student ${studentId} (${category}):`, error);
  }
}

/**
 * Delete seeding metadata for a student + category
 * 
 * @param studentId - Student ID
 * @param category - Category (clase | evaluaciones)
 */
export function deleteSeedMeta(
  studentId: string | number,
  category: ContemplacionCategoryStorage
): void {
  try {
    const key = getSeedMetaKey(studentId, category);
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[SEED-META] Error deleting metadata for student ${studentId} (${category}):`, error);
  }
}

/**
 * Check if current selection matches the seeded hash (i.e., user has NOT modified)
 * 
 * @param studentId - Student ID
 * @param category - Category (clase | evaluaciones)
 * @returns true if selection has NOT been modified since last seed
 */
export function selectionMatchesSeed(
  studentId: string | number,
  category: ContemplacionCategoryStorage
): boolean {
  const meta = readSeedMeta(studentId, category);
  if (!meta) return false;
  
  const currentSelection = readSelected(studentId, category);
  const currentHash = computeSelectionHash(currentSelection);
  
  return currentHash === meta.selectionHash && currentSelection.length === meta.selectionCount;
}

/**
 * User-Touched Flag Functions
 * 
 * Tracks whether a user has manually edited contemplaciones for a student+category.
 * When set to true, prevents automatic upgrades/reseeds to respect user choices.
 */

/**
 * Get the localStorage key for user-touched flag
 */
function getUserTouchedKey(studentId: string | number, category: ContemplacionCategoryStorage): string {
  if (category === 'clase') {
    return `contemplaciones_user_touched_clase_${studentId}`;
  }
  return `contemplaciones_user_touched_evaluaciones_${studentId}`;
}

/**
 * Check if user has manually touched contemplaciones for a student + category
 * 
 * @param studentId - Student ID
 * @param category - Category (clase | evaluaciones)
 * @returns true if user has made manual edits
 */
export function isUserTouched(
  studentId: string | number,
  category: ContemplacionCategoryStorage
): boolean {
  try {
    const key = getUserTouchedKey(studentId, category);
    const value = localStorage.getItem(key);
    return value === 'true';
  } catch (error) {
    console.warn(`[USER-TOUCHED] Error reading flag for student ${studentId} (${category}):`, error);
    return false;
  }
}

/**
 * Mark contemplaciones as user-touched for a student + category
 * 
 * This is called when user manually toggles a checkbox.
 * Once set, automatic upgrades/reseeds will be blocked.
 * 
 * @param studentId - Student ID
 * @param category - Category (clase | evaluaciones)
 */
export function markUserTouched(
  studentId: string | number,
  category: ContemplacionCategoryStorage
): void {
  try {
    const key = getUserTouchedKey(studentId, category);
    localStorage.setItem(key, 'true');
  } catch (error) {
    console.error(`[USER-TOUCHED] Error writing flag for student ${studentId} (${category}):`, error);
  }
}

/**
 * Clear user-touched flag for a student + category
 * 
 * Typically only used for testing/debugging.
 * 
 * @param studentId - Student ID
 * @param category - Category (clase | evaluaciones)
 */
export function clearUserTouched(
  studentId: string | number,
  category: ContemplacionCategoryStorage
): void {
  try {
    const key = getUserTouchedKey(studentId, category);
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[USER-TOUCHED] Error clearing flag for student ${studentId} (${category}):`, error);
  }
}


