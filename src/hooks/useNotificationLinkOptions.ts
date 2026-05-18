import { useQuery } from '@tanstack/react-query';
import { fetchGroupLinkOptions, fetchStudentLinkOptions } from '@/services/schoolCatalog/schoolCatalog.service';

export const notificationLinkOptionsKey = ['notification-link-options'] as const;

export function useNotificationLinkOptions(enabled: boolean) {
  return useQuery({
    queryKey: notificationLinkOptionsKey,
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [groupsRes, studentsRes] = await Promise.all([
        fetchGroupLinkOptions(),
        fetchStudentLinkOptions(),
      ]);

      if (groupsRes.error) throw new Error(groupsRes.error);
      if (studentsRes.error) throw new Error(studentsRes.error);

      return {
        groups: groupsRes.data ?? [],
        students: studentsRes.data ?? [],
      };
    },
  });
}
