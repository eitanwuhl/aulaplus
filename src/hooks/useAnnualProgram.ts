import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProgram,
  deleteProgramUnit,
  fetchCatalogItemsForProgram,
  fetchProgramById,
  fetchSchoolPrograms,
  fetchTeacherPrograms,
  findProgramForGroupSubject,
  updateProgramEstado,
  upsertProgramUnit,
} from '@/services/annualProgram';
import type { CurriculumFramework } from '@/types/institution';
import type { ProgramaEstado } from '@/types/annualProgram';

export const annualProgramKeys = {
  list: (userId: string) => ['annual-programs', userId] as const,
  school: (schoolId: string) => ['annual-programs-school', schoolId] as const,
  detail: (id: string) => ['annual-program', id] as const,
  lookup: (userId: string, grupoId: string, materia: string) =>
    ['annual-program-lookup', userId, grupoId, materia] as const,
  catalog: (schoolId: string, framework: string, materia: string) =>
    ['annual-program-catalog', schoolId, framework, materia] as const,
};

export function useTeacherAnnualPrograms(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: annualProgramKeys.list(userId ?? ''),
    enabled: enabled && Boolean(userId),
    queryFn: async () => {
      const result = await fetchTeacherPrograms(userId!);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function useSchoolAnnualPrograms(schoolId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: annualProgramKeys.school(schoolId ?? ''),
    enabled: enabled && Boolean(schoolId),
    queryFn: async () => {
      const result = await fetchSchoolPrograms(schoolId!);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function useAnnualProgram(programaId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: annualProgramKeys.detail(programaId ?? ''),
    enabled: enabled && Boolean(programaId),
    queryFn: async () => {
      const result = await fetchProgramById(programaId!);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
  });
}

export function useAnnualProgramLookup(
  userId: string | undefined,
  grupoId: string | undefined,
  materia: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: annualProgramKeys.lookup(userId ?? '', grupoId ?? '', materia ?? ''),
    enabled: enabled && Boolean(userId && grupoId && materia),
    queryFn: async () => {
      const result = await findProgramForGroupSubject({
        userId: userId!,
        grupoId: grupoId!,
        materia: materia!,
      });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
  });
}

export function usePlanningCatalog(
  schoolId: string | undefined,
  framework: CurriculumFramework | undefined,
  materia: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: annualProgramKeys.catalog(schoolId ?? '', framework ?? '', materia ?? ''),
    enabled: enabled && Boolean(schoolId && framework),
    queryFn: async () => {
      const result = await fetchCatalogItemsForProgram({
        schoolId: schoolId!,
        framework: framework!,
        materia,
      });
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
  });
}

export function useCreateAnnualProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Parameters<typeof createProgram>[0]) => {
      const result = await createProgram(input);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: (data) => {
      if (data.user_id) {
        void qc.invalidateQueries({ queryKey: annualProgramKeys.list(data.user_id) });
      }
      if (data.school_id) {
        void qc.invalidateQueries({ queryKey: annualProgramKeys.school(data.school_id) });
      }
    },
  });
}

export function useUpdateProgramEstado(
  programaId: string,
  options?: { ownerUserId?: string; schoolId?: string }
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (estado: ProgramaEstado) => {
      const result = await updateProgramEstado(programaId, estado);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: annualProgramKeys.detail(programaId) });
      if (options?.ownerUserId) {
        void qc.invalidateQueries({ queryKey: annualProgramKeys.list(options.ownerUserId) });
      }
      if (options?.schoolId) {
        void qc.invalidateQueries({ queryKey: annualProgramKeys.school(options.schoolId) });
      }
    },
  });
}

export function useUpsertProgramUnit(programaId: string, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Parameters<typeof upsertProgramUnit>[0]) => {
      const result = await upsertProgramUnit(input);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: annualProgramKeys.detail(programaId) });
      if (userId) void qc.invalidateQueries({ queryKey: annualProgramKeys.list(userId) });
    },
  });
}

export function useDeleteProgramUnit(programaId: string, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (unitId: string) => {
      const result = await deleteProgramUnit(unitId, programaId);
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: annualProgramKeys.detail(programaId) });
      if (userId) void qc.invalidateQueries({ queryKey: annualProgramKeys.list(userId) });
    },
  });
}
