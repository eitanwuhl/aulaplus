/**
 * Teacher Materials Service
 * 
 * CRUD operations for teacher_materials table
 * 
 * IMPORTANT: All operations respect RLS policies (user isolation).
 * Soft delete pattern: set deleted_at instead of hard delete.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type TeacherMaterial = Database['public']['Tables']['teacher_materials']['Row'];
type TeacherMaterialInsert = Database['public']['Tables']['teacher_materials']['Insert'];
type TeacherMaterialUpdate = Database['public']['Tables']['teacher_materials']['Update'];

/**
 * Create a new material in the library
 * 
 * @param material - Material data to insert
 * @returns Created material or error
 */
export async function createMaterial(
  material: Omit<TeacherMaterialInsert, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data?: TeacherMaterial; error?: string }> {
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { error: 'Usuario no autenticado' };
    }

    // Insert material (user_id auto-populated by RLS)
    const { data, error } = await supabase
      .from('teacher_materials')
      .insert([{
        ...material,
        user_id: user.id
      }])
      .select()
      .single();

    if (error) {
      console.error('[createMaterial] Insert error:', error);
      return { error: error.message || 'Error al crear material' };
    }

    return { data };

  } catch (error) {
    console.error('[createMaterial] Unexpected error:', error);
    return { error: 'Error inesperado al crear material' };
  }
}

/**
 * List all materials for the authenticated user (non-deleted)
 * 
 * @param options - Optional filters and sorting
 * @returns List of materials or error
 */
export async function listMaterials(options: {
  orderBy?: 'created_at' | 'title';
  ascending?: boolean;
  limit?: number;
} = {}): Promise<{ data?: TeacherMaterial[]; error?: string }> {
  try {
    const { orderBy = 'created_at', ascending = false, limit } = options;

    // Query materials (RLS automatically filters by user_id and deleted_at IS NULL)
    let query = supabase
      .from('teacher_materials')
      .select('*')
      .order(orderBy, { ascending });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[listMaterials] Query error:', error);
      return { error: error.message || 'Error al listar materiales' };
    }

    return { data: data || [] };

  } catch (error) {
    console.error('[listMaterials] Unexpected error:', error);
    return { error: 'Error inesperado al listar materiales' };
  }
}

/**
 * Get a single material by ID
 * 
 * @param id - Material ID
 * @returns Material or error
 */
export async function getMaterial(id: string): Promise<{ data?: TeacherMaterial; error?: string }> {
  try {
    if (!id) {
      return { error: 'ID de material inválido' };
    }

    const { data, error } = await supabase
      .from('teacher_materials')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[getMaterial] Query error:', error);
      return { error: error.message || 'Error al obtener material' };
    }

    if (!data) {
      return { error: 'Material no encontrado' };
    }

    return { data };

  } catch (error) {
    console.error('[getMaterial] Unexpected error:', error);
    return { error: 'Error inesperado al obtener material' };
  }
}

/**
 * Update a material
 * 
 * @param id - Material ID
 * @param updates - Fields to update
 * @returns Updated material or error
 */
export async function updateMaterial(
  id: string,
  updates: Omit<TeacherMaterialUpdate, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<{ data?: TeacherMaterial; error?: string }> {
  try {
    if (!id) {
      return { error: 'ID de material inválido' };
    }

    const { data, error } = await supabase
      .from('teacher_materials')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateMaterial] Update error:', error);
      return { error: error.message || 'Error al actualizar material' };
    }

    return { data };

  } catch (error) {
    console.error('[updateMaterial] Unexpected error:', error);
    return { error: 'Error inesperado al actualizar material' };
  }
}

/**
 * Archive a material (soft delete)
 * 
 * Uses RPC function to bypass RLS edge-cases while maintaining security.
 * 
 * @param id - Material ID
 * @returns Success status or error
 */
export async function archiveMaterial(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!id) {
      return { success: false, error: 'ID de material inválido' };
    }

    // Get authenticated user for debug logging (optional)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[archiveMaterial] Auth error:', authError);
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log('[archiveMaterial] Attempting archive via RPC:', {
        materialId: id,
        currentUserId: user.id
      });
    }

    // Use RPC function to archive (bypasses RLS but enforces ownership internally)
    const { data, error } = await supabase.rpc('archive_teacher_material', {
      material_id: id
    });

    if (error) {
      console.error('[archiveMaterial] RPC error:', error);
      console.error('[archiveMaterial] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      // Map common error codes to user-friendly messages
      let errorMessage = error.message || 'Error al archivar material';
      
      if (error.code === '42501') {
        errorMessage = 'No tienes permiso para archivar este material';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Material no encontrado';
      } else if (error.message?.includes('already archived')) {
        errorMessage = 'El material ya está archivado';
      }

      return { success: false, error: errorMessage };
    }

    // RPC returns success
    if (data?.success) {
      if (import.meta.env.DEV) {
        console.log('[archiveMaterial] Archive successful:', data);
      }
      return { success: true };
    }

    return { success: false, error: 'Error desconocido al archivar material' };

  } catch (error) {
    console.error('[archiveMaterial] Unexpected error:', error);
    return { success: false, error: 'Error inesperado al archivar material' };
  }
}

/**
 * Permanently delete a material (hard delete)
 * 
 * WARNING: This is irreversible. Use archiveMaterial() for soft delete instead.
 * 
 * @param id - Material ID
 * @returns Success status or error
 */
export async function deleteMaterial(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!id) {
      return { success: false, error: 'ID de material inválido' };
    }

    const { error } = await supabase
      .from('teacher_materials')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[deleteMaterial] Delete error:', error);
      return { success: false, error: error.message || 'Error al eliminar material' };
    }

    return { success: true };

  } catch (error) {
    console.error('[deleteMaterial] Unexpected error:', error);
    return { success: false, error: 'Error inesperado al eliminar material' };
  }
}


