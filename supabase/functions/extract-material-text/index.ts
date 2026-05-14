import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY is required');
}
// Service role client for storage and DB operations that need elevated privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Limits for extraction
const MAX_PAGES = 5;
const MAX_CHARS = 10000;  // ~10k characters

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // CRITICAL: Top-level try/catch to return detailed error info
  try {
    // Get authenticated user from Authorization header
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      console.error('[extract-material-text] Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client using ANON_KEY (not service role) so Authorization header is respected
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user - this validates the JWT token
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('[extract-material-text] Auth error:', { 
        error: authError?.message, 
        hasUser: !!user,
        authHeaderPresent: !!authHeader 
      });
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-material-text] ✅ Auth OK:', {
      userId: user.id,
      email: user.email
    });

    // Parse request body with robust error handling
    // CRITICAL: Request bodies are single-read streams - read ONCE only
    let materialId: string | null = null;
    try {
      // Read raw text ONCE - this consumes the stream
      const raw = await req.text();
      const rawBodyPreview = raw.slice(0, 100);
      console.log('[extract-material-text] Raw body (first 100 chars):', rawBodyPreview);
      console.log('[extract-material-text] Raw body length:', raw.length);
      
      // Remove BOM and trim
      const cleaned = raw.replace(/^\uFEFF/, '').trim();
      
      // Try to parse JSON
      let body: any = {};
      if (cleaned) {
        try {
          body = JSON.parse(cleaned);
          console.log('[extract-material-text] Parsed body:', JSON.stringify(body));
        } catch (parseError) {
          console.error('[extract-material-text] JSON parse error:', {
            error: parseError.message,
            received: cleaned.slice(0, 200)
          });
          return new Response(
            JSON.stringify({ 
              error: 'Invalid JSON body', 
              details: parseError.message,
              received: cleaned.slice(0, 200)
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.warn('[extract-material-text] Empty or whitespace-only body');
      }
      
      // Try multiple possible field names
      materialId = body.materialId || body.material_id || body.id || null;
      console.log('[extract-material-text] Extracted materialId from body:', materialId);
      
      // Fallback: check query parameter if body doesn't have materialId
      if (!materialId) {
        try {
          const url = new URL(req.url);
          materialId = url.searchParams.get('materialId') || url.searchParams.get('material_id');
          console.log('[extract-material-text] Extracted materialId from query:', materialId);
        } catch (urlError) {
          console.error('[extract-material-text] URL parse error:', urlError);
        }
      }
      
      if (!materialId) {
        console.error('[extract-material-text] materialId missing:', {
          bodyKeys: Object.keys(body),
          bodyValue: JSON.stringify(body),
          url: req.url
        });
        return new Response(
          JSON.stringify({ 
            error: 'materialId is required in body or query parameter',
            receivedBody: body,
            bodyKeys: Object.keys(body)
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (bodyError) {
      console.error('[extract-material-text] Body reading error:', bodyError);
      return new Response(
        JSON.stringify({ error: 'Failed to read request body', details: bodyError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch material using service role client (bypasses RLS for ownership check)
    // We'll verify ownership manually before proceeding
    const { data: material, error: fetchError } = await supabase
      .from('teacher_materials')
      .select('id, user_id, storage_path, mime_type, title')
      .eq('id', materialId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !material) {
      console.error('[extract-material-text] Material not found:', { materialId, fetchError });
      return new Response(
        JSON.stringify({ error: 'Material not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership - RLS isolation: only material owner can extract
    if (material.user_id !== user.id) {
      console.error('[extract-material-text] Ownership mismatch:', { 
        materialUserId: material.user_id, 
        currentUserId: user.id,
        materialId 
      });
      return new Response(
        JSON.stringify({ error: 'Not authorized to extract text from this material' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log material info after ownership verified
    console.log('[extract-material-text] Material fetched (ownership ok):', {
      materialId,
      title: material.title,
      mime_type: material.mime_type,
      storage_path: material.storage_path
    });

    // Verify it's a PDF - check mime_type OR file extension in storage_path
    const isPDF = material.mime_type?.toLowerCase().includes('pdf') || 
                  material.storage_path?.toLowerCase().endsWith('.pdf');
    
    if (!isPDF) {
      console.error('[extract-material-text] Not a PDF:', {
        materialId,
        mime_type: material.mime_type,
        storage_path: material.storage_path
      });
      return new Response(
        JSON.stringify({ error: 'Only PDF files can have text extracted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download PDF from storage using service role client (elevated privileges)
    if (!material.storage_path) {
      console.error('[extract-material-text] Missing storage_path:', { materialId, material });
      return new Response(
        JSON.stringify({ error: 'Material has no storage path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-material-text] Before download:', {
      bucket: 'teacher-materials',
      storage_path: material.storage_path
    });
    
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('teacher-materials')
      .download(material.storage_path);

    if (downloadError || !fileBlob) {
      console.error('[extract-material-text] Download error:', {
        materialId,
        storage_path: material.storage_path,
        error: downloadError,
        errorMessage: downloadError?.message
      });
      return new Response(
        JSON.stringify({ error: 'Failed to download PDF file', details: downloadError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[extract-material-text] After download: file size bytes:', fileBlob.size);

    // Convert blob to Uint8Array for PDF parsing
    const pdfBytes = new Uint8Array(await fileBlob.arrayBuffer());
    console.log('[extract-material-text] ✅ PDF bytes:', {
      materialId,
      pdfBytesLength: pdfBytes.length
    });

    // Extract text using unpdf (serverless PDF.js bundle for Deno Edge)
    let extractedText = '';
    let pagesProcessed = 0;
    try {
      console.log('[extract-material-text] Extraction start:', {
        materialId,
        library: 'unpdf',
        dataBytes: pdfBytes.length
      });
      
      // Import unpdf from esm.sh with Deno target
      const { extractText } = await import('https://esm.sh/unpdf@1.2.2?target=deno');
      
      console.log('[extract-material-text] unpdf imported, extracting text...', { materialId });
      
      // Extract text using unpdf (mergePages: true combines all pages)
      const result = await extractText(pdfBytes, { mergePages: true });
      
      // Handle result - text can be string or array
      const rawText = typeof result.text === 'string' 
        ? result.text 
        : (result.text || []).join('\n\n');
      
      extractedText = rawText.trim();
      pagesProcessed = result.totalPages || 0;
      
      console.log('[extract-material-text] Extraction done:', {
        materialId,
        totalPages: pagesProcessed,
        extractedChars: extractedText.length,
        preview: extractedText.slice(0, 120).replace(/\s+/g, ' ')
      });

      // Clean up: remove binary junk, normalize
      if (extractedText.length > 0) {
        extractedText = extractedText
          .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')  // Remove control chars
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .trim();
      }
      
      // Enforce sane limits (20k chars max, but keep non-empty)
      if (extractedText.length > 20000) {
        extractedText = extractedText.substring(0, 20000) + '...';
      }

    } catch (parseError: any) {
      // Reset on error
      extractedText = '';
      pagesProcessed = 0;
      console.error('[extract-material-text] PDF parsing error:', {
        materialId,
        error: parseError?.message ?? String(parseError),
        stack: parseError?.stack,
        name: parseError?.name
      });
      return new Response(
        JSON.stringify({
          error: 'Failed to extract text from PDF',
          details: parseError?.message ?? String(parseError),
          stack: parseError?.stack ?? null
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle extracted text
    const extractedChars = extractedText.length;
    
    // If extractedText is EMPTY: return ok=true with extractedChars=0
    // DO NOT write empty string into DB (keep NULL) so the UI blocking logic still works
    if (extractedChars === 0) {
      console.log('[extract-material-text] extractedChars: 0 (empty text, not updating DB)', { materialId });
      return new Response(
        JSON.stringify({
          ok: true,
          extractedChars: 0,
          pagesProcessed
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update material with extracted text (only if not empty)
    console.log('[extract-material-text] DB update:', {
      materialId,
      userId: user.id,
      extractedChars,
      pagesProcessed
    });
    
    const { data: updatedRow, error: updateError } = await supabase
      .from('teacher_materials')
      .update({ extracted_text: extractedText })
      .eq('id', materialId)
      .eq('user_id', user.id)  // Extra safety
      .select('id')
      .single();

    if (updateError) {
      console.error('[extract-material-text] DB update error:', {
        materialId,
        error: updateError,
        errorMessage: updateError.message,
        errorCode: updateError.code
      });
      return new Response(
        JSON.stringify({
          error: 'Failed to save extracted text',
          details: updateError.message,
          stack: null
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[extract-material-text] DB update success:', {
      materialId,
      updatedRowId: updatedRow?.id,
      extractedChars
    });

    // Return success
    return new Response(
      JSON.stringify({
        ok: true,
        extractedChars,
        pagesProcessed
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[extract-material-text] ❌ Unexpected error:', {
      error: err?.message ?? String(err),
      stack: err?.stack,
      name: err?.name
    });
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: err?.message ?? String(err),
        stack: err?.stack ?? null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

