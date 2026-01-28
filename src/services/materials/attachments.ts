/**
 * Material Attachments Service
 * 
 * CRUD operations for material_attachments table
 * 
 * Links materials to planificaciones, sesiones_clase, or evaluaciones.
 * Supports focus_text for context-specific notes.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type MaterialAttachment = Database['public']['Tables']['material_attachments']['Row'];
type MaterialAttachmentInsert = Database['public']['Tables']['material_attachments']['Insert'];
type MaterialAttachmentUpdate = Database['public']['Tables']['material_attachments']['Update'];

// Target type for polymorphic relationships
export type TargetType = 'planificacion' | 'sesion' | 'evaluacion';

/**
 * Add an attachment (link material to target)
 * 
 * @param attachment - Attachment data
 * @returns Created attachment or error
 */
export async function addAttachment(
  attachment: Omit<MaterialAttachmentInsert, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data?: MaterialAttachment; error?: string }> {
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { error: 'Usuario no autenticado' };
    }

    // Validate target_type
    const validTargetTypes: TargetType[] = ['planificacion', 'sesion', 'evaluacion'];
    if (!validTargetTypes.includes(attachment.target_type as TargetType)) {
      return { error: 'Tipo de destino inválido' };
    }

    // Insert attachment
    const { data, error } = await supabase
      .from('material_attachments')
      .insert([{
        ...attachment,
        user_id: user.id
      }])
      .select()
      .single();

    if (error) {
      console.error('[addAttachment] Insert error:', error);
      return { error: error.message || 'Error al agregar adjunto' };
    }

    return { data };

  } catch (error) {
    console.error('[addAttachment] Unexpected error:', error);
    return { error: 'Error inesperado al agregar adjunto' };
  }
}

/**
 * List attachments for a specific target (plan/session/evaluation)
 * 
 * @param targetType - Type of target
 * @param targetId - Target ID
 * @returns List of attachments with material details or error
 */
export async function listAttachmentsByTarget(
  targetType: TargetType,
  targetId: string
): Promise<{ data?: (MaterialAttachment & { material?: any })[]; error?: string }> {
  try {
    if (!targetType || !targetId) {
      return { error: 'Tipo o ID de destino inválido' };
    }

    // Query attachments with joined material data
    const { data, error } = await supabase
      .from('material_attachments')
      .select(`
        *,
        material:teacher_materials(*)
      `)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[listAttachmentsByTarget] Query error:', error);
      return { error: error.message || 'Error al listar adjuntos' };
    }

    return { data: data || [] };

  } catch (error) {
    console.error('[listAttachmentsByTarget] Unexpected error:', error);
    return { error: 'Error inesperado al listar adjuntos' };
  }
}

/**
 * List all attachments for a specific material
 * 
 * @param materialId - Material ID
 * @returns List of attachments or error
 */
export async function listAttachmentsByMaterial(
  materialId: string
): Promise<{ data?: MaterialAttachment[]; error?: string }> {
  try {
    if (!materialId) {
      return { error: 'ID de material inválido' };
    }

    const { data, error } = await supabase
      .from('material_attachments')
      .select('*')
      .eq('material_id', materialId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[listAttachmentsByMaterial] Query error:', error);
      return { error: error.message || 'Error al listar adjuntos' };
    }

    return { data: data || [] };

  } catch (error) {
    console.error('[listAttachmentsByMaterial] Unexpected error:', error);
    return { error: 'Error inesperado al listar adjuntos' };
  }
}

/**
 * Get a single attachment by ID
 * 
 * @param id - Attachment ID
 * @returns Attachment or error
 */
export async function getAttachment(id: string): Promise<{ data?: MaterialAttachment; error?: string }> {
  try {
    if (!id) {
      return { error: 'ID de adjunto inválido' };
    }

    const { data, error } = await supabase
      .from('material_attachments')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[getAttachment] Query error:', error);
      return { error: error.message || 'Error al obtener adjunto' };
    }

    if (!data) {
      return { error: 'Adjunto no encontrado' };
    }

    return { data };

  } catch (error) {
    console.error('[getAttachment] Unexpected error:', error);
    return { error: 'Error inesperado al obtener adjunto' };
  }
}

/**
 * Update an attachment (e.g., change focus_text or priority)
 * 
 * @param id - Attachment ID
 * @param updates - Fields to update
 * @returns Updated attachment or error
 */
export async function updateAttachment(
  id: string,
  updates: Omit<MaterialAttachmentUpdate, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<{ data?: MaterialAttachment; error?: string }> {
  try {
    if (!id) {
      return { error: 'ID de adjunto inválido' };
    }

    const { data, error } = await supabase
      .from('material_attachments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateAttachment] Update error:', error);
      return { error: error.message || 'Error al actualizar adjunto' };
    }

    return { data };

  } catch (error) {
    console.error('[updateAttachment] Unexpected error:', error);
    return { error: 'Error inesperado al actualizar adjunto' };
  }
}

/**
 * Remove an attachment (soft delete)
 * 
 * @param id - Attachment ID
 * @returns Success status or error
 */
export async function removeAttachment(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!id) {
      return { success: false, error: 'ID de adjunto inválido' };
    }

    const { error } = await supabase
      .from('material_attachments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[removeAttachment] Update error:', error);
      return { success: false, error: error.message || 'Error al eliminar adjunto' };
    }

    return { success: true };

  } catch (error) {
    console.error('[removeAttachment] Unexpected error:', error);
    return { success: false, error: 'Error inesperado al eliminar adjunto' };
  }
}

/**
 * Permanently delete an attachment (hard delete)
 * 
 * WARNING: This is irreversible. Use removeAttachment() for soft delete instead.
 * 
 * @param id - Attachment ID
 * @returns Success status or error
 */
export async function deleteAttachment(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!id) {
      return { success: false, error: 'ID de adjunto inválido' };
    }

    const { error } = await supabase
      .from('material_attachments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[deleteAttachment] Delete error:', error);
      return { success: false, error: 'Error al eliminar adjunto' };
    }

    return { success: true };

  } catch (error) {
    console.error('[deleteAttachment] Unexpected error:', error);
    return { success: false, error: 'Error inesperado al eliminar adjunto' };
  }
}


