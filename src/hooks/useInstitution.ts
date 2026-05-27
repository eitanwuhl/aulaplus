import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  activateCatalogVersion,
  completeInstitutionOnboarding,
  createCatalogDraft,
  fetchActiveCatalogSummary,
  fetchGroupFrameworkAssignments,
  fetchInstitutionSnapshot,
  fetchSchoolCatalogVersions,
  fetchStudentFrameworkAssignments,
  importCatalogItemsFromCsv,
  saveInstitutionSettings,
  setSchoolFrameworks,
  updateGroupFramework,
  updateStudentFrameworks,
} from '@/services/institution';
import type { CatalogCsvRow } from '@/lib/institution/parseCatalogCsv';
import type { CurriculumFramework, InstitutionSettings } from '@/types/institution';

export const institutionKeys = {
  snapshot: (schoolId: string) => ['institution', schoolId] as const,
  groups: (schoolId: string) => ['institution-groups', schoolId] as const,
  catalogs: ['institution-catalogs'] as const,
  catalogVersions: (schoolId: string) => ['institution-catalog-versions', schoolId] as const,
  students: (schoolId: string) => ['institution-student-frameworks', schoolId] as const,
};

export function useInstitutionSnapshot(schoolId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: institutionKeys.snapshot(schoolId ?? ''),
    enabled: enabled && Boolean(schoolId),
    queryFn: async () => {
      const result = await fetchInstitutionSnapshot(schoolId!);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
  });
}

export function useInstitutionGroupFrameworks(schoolId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: institutionKeys.groups(schoolId ?? ''),
    enabled: enabled && Boolean(schoolId),
    queryFn: async () => {
      const result = await fetchGroupFrameworkAssignments(schoolId!);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function useCatalogSummary(enabled: boolean) {
  return useQuery({
    queryKey: institutionKeys.catalogs,
    enabled,
    queryFn: async () => {
      const result = await fetchActiveCatalogSummary();
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function useSaveInstitutionSettings(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: InstitutionSettings) => {
      if (!schoolId) throw new Error('Sin liceo');
      return saveInstitutionSettings(schoolId, settings);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: institutionKeys.snapshot(schoolId ?? '') });
    },
  });
}

export function useSetSchoolFrameworks(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (frameworks: CurriculumFramework[]) => {
      if (!schoolId) throw new Error('Sin liceo');
      return setSchoolFrameworks(schoolId, frameworks);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: institutionKeys.snapshot(schoolId ?? '') });
    },
  });
}

export function useCompleteOnboarding(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!schoolId) throw new Error('Sin liceo');
      return completeInstitutionOnboarding(schoolId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: institutionKeys.snapshot(schoolId ?? '') });
    },
  });
}

export function useUpdateGroupFramework(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      groupId: string;
      primary: CurriculumFramework | null;
      secondary: CurriculumFramework | null;
    }) => {
      if (!schoolId) throw new Error('Sin liceo');
      return updateGroupFramework(schoolId, input.groupId, input.primary, input.secondary);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: institutionKeys.groups(schoolId ?? '') });
    },
  });
}

export function useCatalogVersions(schoolId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: institutionKeys.catalogVersions(schoolId ?? ''),
    enabled: enabled && Boolean(schoolId),
    queryFn: async () => {
      const result = await fetchSchoolCatalogVersions(schoolId!);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function useCreateCatalogDraft(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      framework: CurriculumFramework;
      nombre: string;
      version: string;
      cloneFromCatalogId?: string;
    }) => {
      if (!schoolId) throw new Error('Sin liceo');
      return createCatalogDraft({ schoolId, ...input });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: institutionKeys.catalogVersions(schoolId ?? '') });
      void qc.invalidateQueries({ queryKey: institutionKeys.catalogs });
    },
  });
}

export function useActivateCatalog(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (catalogId: string) => {
      if (!schoolId) throw new Error('Sin liceo');
      return activateCatalogVersion(schoolId, catalogId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: institutionKeys.catalogVersions(schoolId ?? '') });
      void qc.invalidateQueries({ queryKey: institutionKeys.snapshot(schoolId ?? '') });
      void qc.invalidateQueries({ queryKey: institutionKeys.catalogs });
    },
  });
}

export function useImportCatalogCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ catalogId, rows }: { catalogId: string; rows: CatalogCsvRow[] }) =>
      importCatalogItemsFromCsv(catalogId, rows),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: institutionKeys.catalogs });
      void qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === 'institution-catalog-versions',
      });
    },
  });
}

export function useStudentFrameworkAssignments(schoolId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: institutionKeys.students(schoolId ?? ''),
    enabled: enabled && Boolean(schoolId),
    queryFn: async () => {
      const result = await fetchStudentFrameworkAssignments(schoolId!);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function useUpdateStudentFrameworks(schoolId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { studentId: number; frameworks: CurriculumFramework[] }) => {
      if (!schoolId) throw new Error('Sin liceo');
      return updateStudentFrameworks(schoolId, input.studentId, input.frameworks);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: institutionKeys.students(schoolId ?? '') });
    },
  });
}
