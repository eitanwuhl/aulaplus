/**
 * Robust resolver for matching grupoId to mockGroups
 * 
 * Handles multiple ID formats:
 * - Direct ID match: "1" → group with id="1"
 * - Name match: "9no 1" → group with name="9no 1"
 * - Normalized match: "9NO  1" → group with name="9no 1"
 */

import { mockGroups, type Group } from '@/data/mockData';

interface ResolveResult {
  group: Group | undefined;
  matchType: 'direct-id' | 'name-exact' | 'name-normalized' | 'not-found';
  searchedValue: string;
  normalizedValue: string;
}

/**
 * Normalize a string for fuzzy matching:
 * - Trim whitespace
 * - Lowercase
 * - Collapse multiple spaces to single space
 */
function normalize(value: any): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Resolve a grupoId to a mockGroup using multiple strategies
 * 
 * @param grupoIdRaw - Raw grupo ID (can be numeric ID like "1" or name like "9no 1")
 * @param verbose - If true, logs detailed resolution steps
 * @returns ResolveResult with matched group and metadata
 */
export function resolveMockGroup(grupoIdRaw: any, verbose: boolean = false): ResolveResult {
  const searchedValue = String(grupoIdRaw ?? '').trim();
  const normalizedValue = normalize(grupoIdRaw);
  
  if (!searchedValue) {
    if (verbose) {
      console.log('[resolveMockGroup] Empty grupoId provided');
    }
    return {
      group: undefined,
      matchType: 'not-found',
      searchedValue,
      normalizedValue
    };
  }
  
  // Strategy 1: Direct ID match
  const directMatch = mockGroups.find(g => g.id === searchedValue);
  if (directMatch) {
    if (verbose) {
      console.log('[resolveMockGroup] ✅ Direct ID match:', {
        searchedValue,
        matchedGroupId: directMatch.id,
        matchedGroupName: directMatch.name
      });
    }
    return {
      group: directMatch,
      matchType: 'direct-id',
      searchedValue,
      normalizedValue
    };
  }
  
  // Strategy 2: Exact name match
  const exactNameMatch = mockGroups.find(g => g.name === searchedValue);
  if (exactNameMatch) {
    if (verbose) {
      console.log('[resolveMockGroup] ✅ Exact name match:', {
        searchedValue,
        matchedGroupId: exactNameMatch.id,
        matchedGroupName: exactNameMatch.name
      });
    }
    return {
      group: exactNameMatch,
      matchType: 'name-exact',
      searchedValue,
      normalizedValue
    };
  }
  
  // Strategy 3: Normalized name match
  const normalizedMatch = mockGroups.find(g => normalize(g.name) === normalizedValue);
  if (normalizedMatch) {
    if (verbose) {
      console.log('[resolveMockGroup] ✅ Normalized name match:', {
        searchedValue,
        normalizedValue,
        matchedGroupId: normalizedMatch.id,
        matchedGroupName: normalizedMatch.name
      });
    }
    return {
      group: normalizedMatch,
      matchType: 'name-normalized',
      searchedValue,
      normalizedValue
    };
  }
  
  // No match found
  if (verbose) {
    console.log('[resolveMockGroup] ❌ No match found:', {
      searchedValue,
      normalizedValue,
      availableIds: mockGroups.slice(0, 10).map(g => g.id),
      availableNames: mockGroups.slice(0, 10).map(g => g.name)
    });
  }
  
  return {
    group: undefined,
    matchType: 'not-found',
    searchedValue,
    normalizedValue
  };
}

/**
 * Quick helper to get a mockGroup by grupoId
 * Returns undefined if not found
 */
export function getMockGroup(grupoIdRaw: any): Group | undefined {
  return resolveMockGroup(grupoIdRaw, false).group;
}

