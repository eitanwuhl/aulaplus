export type GroupListEntry = { id: string; name: string };

export type ResolveGroupMatchType = 'direct-id' | 'name-exact' | 'name-normalized' | 'not-found';

export interface ResolveGroupResult<T extends GroupListEntry> {
  group: T | undefined;
  matchType: ResolveGroupMatchType;
  searchedValue: string;
  normalizedValue: string;
}

export function normalizeGroupSearchValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Match grupoId against a teacher's group list (id, exact name, normalized name).
 */
export function resolveGroupInList<T extends GroupListEntry>(
  groups: T[],
  grupoIdRaw: unknown,
  verbose = false
): ResolveGroupResult<T> {
  const searchedValue = String(grupoIdRaw ?? '').trim();
  const normalizedValue = normalizeGroupSearchValue(grupoIdRaw);

  if (!searchedValue) {
    if (verbose) {
      console.log('[resolveGroupInList] Empty grupoId provided');
    }
    return { group: undefined, matchType: 'not-found', searchedValue, normalizedValue };
  }

  const directMatch = groups.find((g) => g.id === searchedValue);
  if (directMatch) {
    if (verbose) {
      console.log('[resolveGroupInList] Direct ID match:', searchedValue, '→', directMatch.id);
    }
    return { group: directMatch, matchType: 'direct-id', searchedValue, normalizedValue };
  }

  const exactNameMatch = groups.find((g) => g.name === searchedValue);
  if (exactNameMatch) {
    if (verbose) {
      console.log('[resolveGroupInList] Exact name match:', searchedValue, '→', exactNameMatch.id);
    }
    return { group: exactNameMatch, matchType: 'name-exact', searchedValue, normalizedValue };
  }

  const normalizedMatch = groups.find((g) => normalizeGroupSearchValue(g.name) === normalizedValue);
  if (normalizedMatch) {
    if (verbose) {
      console.log('[resolveGroupInList] Normalized name match:', searchedValue, '→', normalizedMatch.id);
    }
    return {
      group: normalizedMatch,
      matchType: 'name-normalized',
      searchedValue,
      normalizedValue,
    };
  }

  if (verbose) {
    console.log('[resolveGroupInList] No match:', {
      searchedValue,
      availableIds: groups.slice(0, 10).map((g) => g.id),
    });
  }

  return { group: undefined, matchType: 'not-found', searchedValue, normalizedValue };
}
