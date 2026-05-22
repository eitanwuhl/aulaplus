import { useQuery } from '@tanstack/react-query';
import { fetchTeacherGroups, primeTeacherGroupsCache } from '@/services/teacherGroups';
import { teacherGroupKeys } from '@/hooks/teacherGroups/teacherGroupKeys';

export function useTeacherGroups(options: {
  userId: string | undefined;
  enabled?: boolean;
}) {
  const { userId, enabled = true } = options;

  return useQuery({
    queryKey: teacherGroupKeys.list(userId),
    queryFn: async () => {
      if (!userId) {
        throw new Error('Usuario no autenticado');
      }
      const result = await fetchTeacherGroups(userId);
      if (result.error) {
        throw new Error(result.error);
      }
      const groups = result.data ?? [];
      primeTeacherGroupsCache(userId, groups);
      return groups;
    },
    enabled: enabled && Boolean(userId),
    staleTime: 60 * 1000,
  });
}
