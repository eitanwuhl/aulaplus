/**
 * Robust resolver for matching grupoId to mockGroups
 * 
 * Handles multiple ID formats:
 * - Direct ID match: "1" → group with id="1"
 * - Name match: "9no 1" → group with name="9no 1"
 * - Normalized match: "9NO  1" → group with name="9no 1"
 */

import { mockGroups, type Group } from '@/data/mockData';
import { resolveGroupInList } from '@/lib/groups/resolveGroupInList';

export type ResolveMockGroupResult = ReturnType<typeof resolveGroupInList<Group>>;

/**
 * @deprecated Landing/demo only. Production code should use `resolveLegacyGroup` from teacherGroups.
 */
export function resolveMockGroup(grupoIdRaw: unknown, verbose = false): ResolveMockGroupResult {
  return resolveGroupInList(mockGroups, grupoIdRaw, verbose);
}

/**
 * Quick helper to get a mockGroup by grupoId
 * Returns undefined if not found
 */
export function getMockGroup(grupoIdRaw: any): Group | undefined {
  return resolveMockGroup(grupoIdRaw, false).group;
}

