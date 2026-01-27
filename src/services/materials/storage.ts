/**
 * Materials Storage Service
 * 
 * Handles file uploads to Supabase Storage bucket 'teacher-materials'
 * 
 * IMPORTANT: All uploads must be associated with the authenticated user.
 * RLS policies enforce user isolation.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Upload result from storage
 */
export interface UploadResult {
  success: boolean;
  storagePath?: string;
  publicUrl?: string;
  error?: string;
}

/**
 * Upload a file to Supabase Storage
 * 
 * @param file - File to upload (from input[type="file"])
 * @param options - Optional upload configuration
 * @returns Upload result with storage path and public URL
 */
export async function uploadMaterialFile(
  file: File,
  options: {
    folder?: string; // Optional subfolder (e.g., 'pdfs', 'images')
    upsert?: boolean; // Overwrite if file exists (default: false)
  } = {}
): Promise<UploadResult> {
  try {
    // Validate file
    if (!file || !(file instanceof File)) {
      return {
        success: false,
        error: 'Archivo inválido'
      };
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado'
      };
    }

    // Generate unique file path: {userId}/{folder?}/{timestamp}-{filename}
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = options.folder ? `${options.folder}/` : '';
    const filePath = `${user.id}/${folder}${timestamp}-${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('teacher-materials')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: options.upsert ?? false
      });

    if (error) {
      console.error('[uploadMaterialFile] Upload error:', error);
      return {
        success: false,
        error: error.message || 'Error al subir archivo'
      };
    }

    // Get public URL (if bucket is public) or signed URL
    const { data: urlData } = supabase.storage
      .from('teacher-materials')
      .getPublicUrl(data.path);

    return {
      success: true,
      storagePath: data.path,
      publicUrl: urlData.publicUrl
    };

  } catch (error) {
    console.error('[uploadMaterialFile] Unexpected error:', error);
    return {
      success: false,
      error: 'Error inesperado al subir archivo'
    };
  }
}

/**
 * Delete a file from Supabase Storage
 * 
 * @param storagePath - Storage path of the file to delete
 * @returns Success status
 */
export async function deleteMaterialFile(storagePath: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!storagePath) {
      return {
        success: false,
        error: 'Ruta de almacenamiento inválida'
      };
    }

    const { error } = await supabase.storage
      .from('teacher-materials')
      .remove([storagePath]);

    if (error) {
      console.error('[deleteMaterialFile] Delete error:', error);
      return {
        success: false,
        error: error.message || 'Error al eliminar archivo'
      };
    }

    return { success: true };

  } catch (error) {
    console.error('[deleteMaterialFile] Unexpected error:', error);
    return {
      success: false,
      error: 'Error inesperado al eliminar archivo'
    };
  }
}

/**
 * Get a signed URL for a private file (valid for 1 hour)
 * 
 * @param storagePath - Storage path of the file
 * @returns Signed URL or error
 */
export async function getSignedUrl(storagePath: string): Promise<{
  success: boolean;
  signedUrl?: string;
  error?: string;
}> {
  try {
    if (!storagePath) {
      return {
        success: false,
        error: 'Ruta de almacenamiento inválida'
      };
    }

    const { data, error } = await supabase.storage
      .from('teacher-materials')
      .createSignedUrl(storagePath, 3600); // 1 hour

    if (error) {
      console.error('[getSignedUrl] Error creating signed URL:', error);
      return {
        success: false,
        error: error.message || 'Error al obtener URL firmada'
      };
    }

    return {
      success: true,
      signedUrl: data.signedUrl
    };

  } catch (error) {
    console.error('[getSignedUrl] Unexpected error:', error);
    return {
      success: false,
      error: 'Error inesperado al obtener URL firmada'
    };
  }
}

