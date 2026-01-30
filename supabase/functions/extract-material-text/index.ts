import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;
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

    console.log('[extract-material-text] ✅ Auth OK:', { userId: user.id, email: user.email });

    // Parse request body with robust error handling
    // CRITICAL: Request bodies are single-read streams - read ONCE only
    let materialId: string | null = null;
    try {
      // Log request metadata BEFORE reading body
      console.log('[extract-material-text] Request method:', req.method);
      console.log('[extract-material-text] Content-Type:', req.headers.get('content-type'));
      console.log('[extract-material-text] URL:', req.url);
      
      // Read raw text ONCE - this consumes the stream
      const raw = await req.text();
      console.log('[extract-material-text] Raw body (first 200 chars):', raw.slice(0, 200));
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

    console.log('[extract-material-text] ✅ Material fetched:', {
      materialId,
      title: material.title,
      storage_path: material.storage_path,
      mime_type: material.mime_type
    });

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

    // Log material info (always log for debugging)
    console.log('[extract-material-text] Material found:', { 
      userId: user.id,
      materialId, 
      title: material.title,
      hasStoragePath: !!material.storage_path,
      storagePath: material.storage_path,
      mimeType: material.mime_type
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

    console.log('[extract-material-text] Downloading PDF from storage:', {
      materialId,
      storage_path: material.storage_path,
      bucket: 'teacher-materials'
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
    
    console.log('[extract-material-text] ✅ Blob downloaded:', {
      materialId,
      blobSize: fileBlob.size,
      blobType: fileBlob.type
    });

    // Convert blob to Uint8Array for PDF parsing
    const pdfBytes = new Uint8Array(await fileBlob.arrayBuffer());
    console.log('[extract-material-text] ✅ PDF bytes:', {
      materialId,
      pdfBytesLength: pdfBytes.length
    });

    // Extract text using pdfjs-dist (Deno-compatible build)
    let extractedText = '';
    try {
      // CRITICAL: Polyfill DOMMatrix before loading pdfjs (required for Deno Edge)
      const ensureDomMatrix = async () => {
        if (!(globalThis as any).DOMMatrix) {
          console.log('[extract-material-text] Polyfilling DOMMatrix...');
          const dm = await import('npm:dommatrix');
          (globalThis as any).DOMMatrix = (dm as any).DOMMatrix ?? (dm as any).default?.DOMMatrix;
          (globalThis as any).DOMMatrixReadOnly =
            (dm as any).DOMMatrixReadOnly ?? (dm as any).default?.DOMMatrixReadOnly ?? (globalThis as any).DOMMatrix;
        }
      };
      
      await ensureDomMatrix();
      console.log('[extract-material-text] ✅ DOMMatrix present:', !!(globalThis as any).DOMMatrix);
      
      // Dynamically import pdfjs AFTER polyfills
      console.log('[extract-material-text] Importing pdfjs...');
      const pdfjsImport: any = await import('npm:pdfjs-dist/legacy/build/pdf.mjs');
      
      // Resolve pdfjs object (Deno npm modules may export under default)
      const pdfjs: any = pdfjsImport?.getDocument ? pdfjsImport : pdfjsImport?.default;
      
      // Hard guard: verify getDocument exists
      if (!pdfjs?.getDocument) {
        throw new Error(`pdfjs getDocument not found (import mismatch). Keys: ${Object.keys(pdfjsImport).join(', ')}`);
      }
      
      console.log('[extract-material-text] ✅ pdfjs imported:', {
        hasGetDocument: typeof pdfjs.getDocument === 'function',
        getDocumentType: typeof pdfjs.getDocument
      });
      
      // Load PDF document with worker disabled (required for Edge Functions)
      console.log('[extract-material-text] Loading PDF document...');
      const loadingTask = pdfjs.getDocument({
        data: pdfBytes,
        disableWorker: true,
      });
      
      const pdfDocument = await loadingTask.promise;
      
      console.log('[extract-material-text] ✅ PDF loaded:', {
        materialId,
        numPages: pdfDocument.numPages
      });
      
      const numPages = Math.min(pdfDocument.numPages, MAX_PAGES);
      const extractedPages: string[] = [];

      // Extract text from first N pages
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .filter((str: string) => str.length > 0)
          .join(' ')
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .trim();
        
        if (pageText.length > 0) {
          extractedPages.push(pageText);
        }
      }

      extractedText = extractedPages.join('\n\n').trim();

      // Truncate to max chars if needed
      if (extractedText.length > MAX_CHARS) {
        extractedText = extractedText.substring(0, MAX_CHARS) + '...';
      }

      // Clean up: remove binary junk, normalize
      extractedText = extractedText
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')  // Remove control chars
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .trim();

    } catch (parseError: any) {
      console.error('[extract-material-text] PDF parsing error:', {
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

    // Update material with extracted text
    console.log('[extract-material-text] Updating material with extracted text:', {
      materialId,
      extractedChars: extractedText.length
    });
    
    const { error: updateError } = await supabase
      .from('teacher_materials')
      .update({ extracted_text: extractedText })
      .eq('id', materialId)
      .eq('user_id', user.id);  // Extra safety

    if (updateError) {
      console.error('[extract-material-text] Update error:', {
        materialId,
        error: updateError,
        errorMessage: updateError.message,
        errorCode: updateError.code
      });
      return new Response(
        JSON.stringify({ error: 'Failed to save extracted text', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[extract-material-text] Successfully updated material:', {
      materialId,
      extractedChars: extractedText.length,
      pagesProcessed: Math.min(MAX_PAGES, extractedText.split('\n\n').length)
    });

    // Return success
    return new Response(
      JSON.stringify({
        ok: true,
        extractedChars: extractedText.length,
        pagesProcessed: Math.min(MAX_PAGES, extractedText.split('\n\n').length)
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

