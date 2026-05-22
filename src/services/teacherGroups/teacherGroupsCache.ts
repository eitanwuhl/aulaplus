import { supabase } from '@/integrations/supabase/client';
import type { TeacherGroup } from '@/types/schoolCatalog';
import { fetchTeacherGroups } from './teacherGroups.service';

let cache: { userId: string; groups: TeacherGroup[]; fetchedAt: number } | null = null;

const TTL_MS = 60_000;

export function invalidateTeacherGroupsCache(): void {
  cache = null;
}

/** Sync module cache after React Query fetch (avoids duplicate round-trip in provider). */
export function primeTeacherGroupsCache(userId: string, groups: TeacherGroup[]): void {
  cache = { userId, groups, fetchedAt: Date.now() };
}

/** Cached catalog groups for the signed-in teacher (used outside React hooks). */
export async function getTeacherGroupsCached(): Promise<TeacherGroup[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const now = Date.now();
  if (cache && cache.userId === user.id && now - cache.fetchedAt < TTL_MS) {
    return cache.groups;
  }

  const result = await fetchTeacherGroups(user.id);
  const groups = result.data ?? [];
  cache = { userId: user.id, groups, fetchedAt: now };
  return groups;
}
