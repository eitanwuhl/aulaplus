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
  const queryClient = useQueryClient(); // ✅ FIX: Move hook call to top level

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
        uploadResult,
        file // Include file for PDF detection by name
      };
    },
    onSuccess: async ({ material, file }) => {
      // Invalidate materials list
      queryClient.invalidateQueries({ queryKey: materialsKeys.lists() });
      
      // Robust PDF detection: check mime_type, storage_path, or file name
      const isPdf = 
        (material.mime_type && material.mime_type.toLowerCase().includes('pdf')) ||
        (material.storage_path && material.storage_path.toLowerCase().endsWith('.pdf')) ||
        (file && file.name.toLowerCase().endsWith('.pdf'));
      
      if (isPdf) {
        // Show processing toast
        toast({
          title: 'Procesando PDF...',
          description: 'Extrayendo texto del documento',
        });

        // DEV: Log before invoking extraction
        if (import.meta.env.DEV) {
          console.log('[materials-upload] invoking extract-material-text', {
            id: material.id,
            title: material.title,
            mime_type: material.mime_type,
            storage_path: material.storage_path
          });
        }

        try {
          const { extractMaterialText } = await import('@/services/materials');
          
          // Always invoke extraction (await to ensure request is made)
          let extractResult = await extractMaterialText(material.id);
          
          // DEV: Log extraction result
          if (import.meta.env.DEV) {
            console.log('[materials-upload] extraction result', {
              id: material.id,
              success: extractResult.success,
              extractedChars: extractResult.extractedChars,
              pagesProcessed: extractResult.pagesProcessed,
              error: extractResult.error
            });
          }
          
          // Retry extraction once if it fails
          if (!extractResult.success) {
            console.log('[materials-upload] First extraction attempt failed, retrying once...', {
              id: material.id,
              error: extractResult.error
            });
            // Wait 1 second before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            extractResult = await extractMaterialText(material.id);
            
            // DEV: Log retry result
            if (import.meta.env.DEV) {
              console.log('[materials-upload] extraction retry result', {
                id: material.id,
                success: extractResult.success,
                extractedChars: extractResult.extractedChars,
                error: extractResult.error
              });
            }
          }

          if (extractResult.success) {
            // Invalidate again to refresh with extracted_text
            queryClient.invalidateQueries({ queryKey: materialsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: materialsKeys.detail(material.id) });
            
            toast({
              title: 'Material creado',
              description: `Material "${material.title}" creado exitosamente. Texto extraído: ${extractResult.extractedChars} caracteres.`,
            });
          } else {
            // Extraction failed after retry, but material was created
            console.error('[materials-upload] Extraction failed after retry:', {
              id: material.id,
              error: extractResult.error
            });
            toast({
              title: 'Material creado',
              description: `Material "${material.title}" creado exitosamente. No se pudo extraer texto del PDF: ${extractResult.error || 'Error desconocido'}.`,
              variant: 'default',
            });
          }
        } catch (extractError) {
          // DEV: Log extraction error
          console.error('[materials-upload] extraction error', {
            id: material.id,
            error: extractError instanceof Error ? extractError.message : 'Error desconocido',
            stack: extractError instanceof Error ? extractError.stack : undefined
          });
          
          // Material was created, just extraction failed
          const errorMessage = extractError instanceof Error ? extractError.message : 'Error desconocido';
          toast({
            title: 'Material creado',
            description: `Material "${material.title}" creado exitosamente. Error al extraer texto: ${errorMessage}.`,
            variant: 'default',
          });
        }
      } else {
        // Not a PDF, just show success
        if (import.meta.env.DEV) {
          console.log('[materials-upload] Not a PDF, skipping extraction', {
            id: material.id,
            mime_type: material.mime_type,
            storage_path: material.storage_path
          });
        }
        toast({
          title: 'Material creado',
          description: `Material "${material.title}" creado exitosamente`,
        });
      }
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


