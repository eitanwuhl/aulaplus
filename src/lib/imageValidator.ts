import { supabase } from '@/lib/supabase';

export interface ImageValidationResult {
  isValid: boolean;
  contentType?: string;
  hasCORS?: boolean;
  error?: string;
}

export interface ProcessedImage {
  title: string;
  original_url: string;
  direct_download_url: string;
  width?: number;
  height?: number;
  license: string;
  attribution: string;
  source: string;
}

/**
 * Validates an image URL by checking:
 * - HTTP status (200)
 * - Content-Type (image/jpeg, image/png, image/webp)
 * - CORS headers
 */
export async function validateImageUrl(url: string): Promise<ImageValidationResult> {
  try {
    // First try with a regular fetch to check basic accessibility
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'cors' // Try CORS mode first
    });

    if (!response.ok) {
      return {
        isValid: false,
        error: `HTTP status ${response.status}`
      };
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (!/image\/(jpeg|jpg|png|webp)/i.test(contentType)) {
      return {
        isValid: false,
        contentType,
        error: `Invalid content type: ${contentType}`
      };
    }

    // Check CORS headers
    const accessControlAllowOrigin = response.headers.get('Access-Control-Allow-Origin');
    const hasCORS = accessControlAllowOrigin === '*' || 
                   accessControlAllowOrigin?.includes(window.location.origin) ||
                   accessControlAllowOrigin?.includes('.lovableproject.com');

    return {
      isValid: true,
      contentType,
      hasCORS
    };

  } catch (error) {
    // If CORS mode fails, try no-cors to at least check if the resource exists
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors'
      });
      
      // In no-cors mode, we can't check headers but we can see if it loads
      return {
        isValid: false,
        hasCORS: false,
        error: 'CORS not available'
      };
    } catch (noCorsError) {
      return {
        isValid: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Downloads an image and reuploads it to Supabase Storage
 */
export async function rehostImageToSupabase(url: string, title: string): Promise<string> {
  try {
    // Download the image
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const blob = await response.blob();
    const contentType = blob.type;
    
    // Determine file extension
    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileName = `${timestamp}-${randomId}.${extension}`;
    const filePath = `images/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('evaluaciones-assets')
      .upload(filePath, blob, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('evaluaciones-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error rehosting image:', error);
    throw error;
  }
}

/**
 * Ensures an image URL is usable by validating it and rehosting if necessary
 */
export async function ensureUsableImage(url: string, title: string = 'Imagen'): Promise<ProcessedImage> {
  try {
    const validation = await validateImageUrl(url);
    
    let finalUrl = url;
    let source = 'Original';
    
    // If validation fails or CORS is not available, rehost the image
    if (!validation.isValid || !validation.hasCORS) {
      console.log(`Rehosting image due to: ${validation.error || 'No CORS'}`);
      finalUrl = await rehostImageToSupabase(url, title);
      source = 'SupabaseStorage';
    } else {
      // Determine source based on URL
      if (url.includes('unsplash.com')) source = 'Unsplash';
      else if (url.includes('pexels.com')) source = 'Pexels';
      else if (url.includes('wikimedia.org')) source = 'Wikimedia';
      else if (url.includes('gov.')) source = 'Governmental';
      else source = 'Web';
    }

    // Try to get image dimensions
    let width: number | undefined;
    let height: number | undefined;
    
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = finalUrl;
      });
      width = img.naturalWidth;
      height = img.naturalHeight;
    } catch (error) {
      console.warn('Could not get image dimensions:', error);
    }

    return {
      title,
      original_url: url,
      direct_download_url: finalUrl,
      width,
      height,
      license: source === 'Wikimedia' ? 'CC BY-SA 4.0' : 
               source === 'Governmental' ? 'Public Domain' : 
               'Desconocida',
      attribution: source === 'SupabaseStorage' ? 'Rehosteada automáticamente' : 'Ver fuente original',
      source
    };
  } catch (error) {
    console.error('Error processing image:', error);
    
    // Return fallback object even if processing fails
    return {
      title,
      original_url: url,
      direct_download_url: url,
      license: 'Desconocida',
      attribution: 'Error al procesar imagen',
      source: 'Error'
    };
  }
}

/**
 * Processes multiple image URLs and ensures they are all usable
 */
export async function processImageUrls(urls: string[], titles?: string[]): Promise<ProcessedImage[]> {
  const processPromises = urls.map((url, index) => {
    const title = titles?.[index] || `Imagen ${index + 1}`;
    return ensureUsableImage(url, title);
  });

  return Promise.all(processPromises);
}