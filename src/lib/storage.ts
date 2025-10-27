import { supabase } from '@/lib/supabase';

export const uploadFileToStorage = async (
  bucket: string,
  filePath: string,
  file: File | Blob,
  contentType?: string
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType: contentType || 'application/pdf',
      upsert: true
    });

  if (error) {
    throw new Error(`Error uploading file: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return publicUrl;
};

export const createCommunicationMessage = async (
  toRole: 'direccion' | 'psicopedagogico',
  subject: string,
  message: string,
  attachmentUrls: string[] = [],
  relatedPlanificacionId?: string
) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { data, error } = await supabase
    .from('comunicaciones')
    .insert({
      user_id: user.id,
      to_role: toRole,
      subject,
      message,
      attachment_urls: attachmentUrls,
      related_planificacion_id: relatedPlanificacionId
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating communication: ${error.message}`);
  }

  return data;
};