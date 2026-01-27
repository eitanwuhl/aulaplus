/**
 * React Query hooks for Material Attachments
 * 
 * Provides query and mutation hooks for material attachments:
 * - List attachments by target (plan/session/evaluation)
 * - List attachments by material
 * - Add attachment
 * - Update attachment (focus_text, priority)
 * - Remove attachment (soft delete)
 * 
 * UI components should use these hooks instead of calling services directly.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from './use-toast';
import {
  addAttachment,
  listAttachmentsByTarget,
  listAttachmentsByMaterial,
  getAttachment,
  updateAttachment,
  removeAttachment,
  type TargetType
} from '@/services/materials';
import type { Database } from '@/integrations/supabase/types';

type MaterialAttachment = Database['public']['Tables']['material_attachments']['Row'];
type MaterialAttachmentInsert = Database['public']['Tables']['material_attachments']['Insert'];
type MaterialAttachmentUpdate = Database['public']['Tables']['material_attachments']['Update'];

// ============================================================================
// Query Keys
// ============================================================================

export const attachmentsKeys = {
  all: ['attachments'] as const,
  byTarget: (targetType: TargetType, targetId: string) => 
    [...attachmentsKeys.all, 'target', targetType, targetId] as const,
  byMaterial: (materialId: string) => 
    [...attachmentsKeys.all, 'material', materialId] as const,
  detail: (id: string) => 
    [...attachmentsKeys.all, 'detail', id] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * List attachments for a specific target (plan/session/evaluation)
 * 
 * @param targetType - Type of target ('planificacion', 'sesion', 'evaluacion')
 * @param targetId - Target ID
 * @returns Query result with attachments list (includes joined material data)
 */
export function useAttachmentsByTarget(
  targetType: TargetType | undefined,
  targetId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: attachmentsKeys.byTarget(targetType || 'planificacion', targetId || ''),
    queryFn: async () => {
      if (!targetType || !targetId) {
        throw new Error('Target type and ID are required');
      }

      const result = await listAttachmentsByTarget(targetType, targetId);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data || [];
    },
    enabled: enabled && !!targetType && !!targetId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * List all attachments for a specific material
 * 
 * @param materialId - Material ID
 * @returns Query result with attachments list
 */
export function useAttachmentsByMaterial(
  materialId: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: attachmentsKeys.byMaterial(materialId || ''),
    queryFn: async () => {
      if (!materialId) {
        throw new Error('Material ID is required');
      }

      const result = await listAttachmentsByMaterial(materialId);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data || [];
    },
    enabled: enabled && !!materialId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get a single attachment by ID
 * 
 * @param id - Attachment ID
 * @returns Query result with attachment detail
 */
export function useAttachment(id: string | undefined, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: attachmentsKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) {
        throw new Error('Attachment ID is required');
      }

      const result = await getAttachment(id);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    enabled: enabled && !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Add a new attachment (link material to target)
 */
export function useAddAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      attachment: Omit<MaterialAttachmentInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>
    ) => {
      const result = await addAttachment(attachment);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data!;
    },
    onSuccess: (data) => {
      // Invalidate affected queries
      queryClient.invalidateQueries({ 
        queryKey: attachmentsKeys.byTarget(data.target_type as TargetType, data.target_id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: attachmentsKeys.byMaterial(data.material_id) 
      });
      
      toast({
        title: 'Material adjuntado',
        description: 'Material adjuntado exitosamente',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al adjuntar material',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update an attachment (e.g., change focus_text or priority)
 */
export function useUpdateAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates
    }: {
      id: string;
      updates: Omit<MaterialAttachmentUpdate, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
    }) => {
      const result = await updateAttachment(id, updates);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result.data!;
    },
    onSuccess: (data) => {
      // Invalidate affected queries
      queryClient.invalidateQueries({ 
        queryKey: attachmentsKeys.byTarget(data.target_type as TargetType, data.target_id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: attachmentsKeys.byMaterial(data.material_id) 
      });
      queryClient.invalidateQueries({ 
        queryKey: attachmentsKeys.detail(data.id) 
      });
      
      toast({
        title: 'Adjunto actualizado',
        description: 'Adjunto actualizado exitosamente',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar adjunto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Remove an attachment (soft delete)
 */
export function useRemoveAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      targetType,
      targetId,
      materialId
    }: {
      id: string;
      targetType: TargetType;
      targetId: string;
      materialId: string;
    }) => {
      const result = await removeAttachment(id);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return { id, targetType, targetId, materialId };
    },
    onSuccess: ({ targetType, targetId, materialId }) => {
      // Invalidate affected queries
      queryClient.invalidateQueries({ 
        queryKey: attachmentsKeys.byTarget(targetType, targetId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: attachmentsKeys.byMaterial(materialId) 
      });
      
      toast({
        title: 'Adjunto eliminado',
        description: 'Adjunto eliminado exitosamente',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar adjunto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Batch add multiple attachments at once
 * 
 * Useful for attaching multiple materials to a target in one operation.
 */
export function useBatchAddAttachments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      attachments: Array<Omit<MaterialAttachmentInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
    ) => {
      const results = await Promise.all(
        attachments.map(attachment => addAttachment(attachment))
      );

      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`${errors.length} adjunto(s) fallaron: ${errors[0].error}`);
      }

      return results.map(r => r.data!);
    },
    onSuccess: (data) => {
      // Invalidate all affected queries
      const targets = new Set(data.map(d => `${d.target_type}:${d.target_id}`));
      const materials = new Set(data.map(d => d.material_id));

      targets.forEach(target => {
        const [targetType, targetId] = target.split(':');
        queryClient.invalidateQueries({ 
          queryKey: attachmentsKeys.byTarget(targetType as TargetType, targetId) 
        });
      });

      materials.forEach(materialId => {
        queryClient.invalidateQueries({ 
          queryKey: attachmentsKeys.byMaterial(materialId) 
        });
      });
      
      toast({
        title: 'Materiales adjuntados',
        description: `${data.length} material(es) adjuntado(s) exitosamente`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al adjuntar materiales',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

