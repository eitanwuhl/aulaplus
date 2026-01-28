/**
 * React Query hooks for Teacher Materials
 * 
 * Provides query and mutation hooks for materials management:
 * - List materials
 * - Get single material
 * - Create material
 * - Update material
 * - Archive material (soft delete)
 * - Upload material file
 * 
 * UI components should use these hooks instead of calling services directly.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from './use-toast';
import {
  listMaterials,
  getMaterial,
  createMaterial,
  updateMaterial,
  archiveMaterial,
  uploadMaterialFile,
  type UploadResult
} from '@/services/materials';
import type { Database } from '@/integrations/supabase/types';

type TeacherMaterial = Database['public']['Tables']['teacher_materials']['Row'];
type TeacherMaterialInsert = Database['public']['Tables']['teacher_materials']['Insert'];
type TeacherMaterialUpdate = Database['public']['Tables']['teacher_materials']['Update'];

// ============================================================================
// Query Keys
// ============================================================================

export const materialsKeys = {
  all: ['materials'] as const,
  lists: () => [...materialsKeys.all, 'list'] as const,
  list: (filters?: { orderBy?: string; ascending?: boolean; limit?: number }) => 
    [...materialsKeys.lists(), filters] as const,
  details: () => [...materialsKeys.all, 'detail'] as const,
  detail: (id: string) => [...materialsKeys.details(), id] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * List all materials for the authenticated user
 * 
 * @param options - Optional filters and sorting
 * @returns Query result with materials list
 */
export function useMaterialsList(options: {
  orderBy?: 'created_at' | 'title';
  ascending?: boolean;
  limit?: number;
  enabled?: boolean;
} = {}) {
  const { orderBy = 'created_at', ascending = false, limit, enabled = true } = options;

  return useQuery({
    queryKey: materialsKeys.list({ orderBy, ascending, limit }),
    queryFn: async () => {
      const result = await listMaterials({ orderBy, ascending, limit });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a single material by ID
 * 
 * @param id - Material ID
 * @returns Query result with material detail
 */
export function useMaterial(id: string | undefined, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: materialsKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) {
        throw new Error('Material ID is required');
      }

      const result = await getMaterial(id);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new material
 */
export function useCreateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      material: Omit<TeacherMaterialInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>
    ) => {
      const result = await createMaterial(material);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data!;
    },
    onSuccess: (data) => {
      // Invalidate and refetch materials list
      queryClient.invalidateQueries({ queryKey: materialsKeys.lists() });
      
      toast({
        title: 'Material creado',
        description: `Material "${data.title}" creado exitosamente`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear material',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update an existing material
 */
export function useUpdateMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates
    }: {
      id: string;
      updates: Omit<TeacherMaterialUpdate, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
    }) => {
      const result = await updateMaterial(id, updates);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data!;
    },
    onSuccess: (data) => {
      // Invalidate affected queries
      queryClient.invalidateQueries({ queryKey: materialsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: materialsKeys.detail(data.id) });
      
      toast({
        title: 'Material actualizado',
        description: `Material "${data.title}" actualizado exitosamente`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar material',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Archive a material (soft delete)
 */
export function useArchiveMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await archiveMaterial(id);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return id;
    },
    onSuccess: (id) => {
      // Invalidate affected queries
      queryClient.invalidateQueries({ queryKey: materialsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: materialsKeys.detail(id) });
      
      toast({
        title: 'Material archivado',
        description: 'Material archivado exitosamente',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al archivar material',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Upload a material file to storage
 */
export function useUploadMaterial() {
  return useMutation({
    mutationFn: async ({
      file,
      options
    }: {
      file: File;
      options?: { folder?: string; upsert?: boolean };
    }): Promise<UploadResult> => {
      const result = await uploadMaterialFile(file, options);
      
      if (!result.success) {
        throw new Error(result.error || 'Error al subir archivo');
      }
      
      return result;
    },
    onSuccess: () => {
      toast({
        title: 'Archivo subido',
        description: 'Archivo subido exitosamente',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al subir archivo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Composite hook: Upload file and create material in one operation
 * 
 * This is a convenience hook that combines file upload + material creation.
 * Useful for "Upload & Save" workflows in the UI.
 */
export function useUploadAndCreateMaterial() {
  const uploadMutation = useUploadMaterial();
  const createMutation = useCreateMaterial();

  return useMutation({
    mutationFn: async ({
      file,
      title,
      metadata,
      folder
    }: {
      file: File;
      title?: string;
      metadata?: Record<string, any>;
      folder?: string;
    }) => {
      // Step 1: Upload file
      const uploadResult = await uploadMaterialFile(file, { folder });
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Error al subir archivo');
      }

      // Step 2: Create material record
      const createResult = await createMaterial({
        title: title || file.name,
        storage_path: uploadResult.storagePath!,
        mime_type: file.type || undefined,
        metadata: metadata || {}
      });

      if (createResult.error) {
        throw new Error(createResult.error);
      }

      return {
        material: createResult.data!,
        uploadResult
      };
    },
    onSuccess: ({ material }) => {
      // Invalidate materials list
      const queryClient = useQueryClient();
      queryClient.invalidateQueries({ queryKey: materialsKeys.lists() });
      
      toast({
        title: 'Material creado',
        description: `Material "${material.title}" creado exitosamente`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear material',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}


