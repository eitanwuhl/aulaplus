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

    // Log user info in DEV mode
    if (Deno.env.get('ENVIRONMENT') === 'development' || !Deno.env.get('ENVIRONMENT')) {
      console.log('[extract-material-text] Authenticated user:', { userId: user.id, email: user.email });
    }

    // Parse request body with robust error handling
    let materialId: string | null = null;
    try {
      // Read raw text once
      const raw = await req.text();
      console.log('[extract-material-text] Raw body received:', raw.slice(0, 200));
      
      // Remove BOM and trim
      const cleaned = raw.replace(/^\uFEFF/, '').trim();
      
      // Try to parse JSON
      let body: any = {};
      if (cleaned) {
        try {
          body = JSON.parse(cleaned);
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
      }
      
      materialId = body.materialId || null;
      
      // Fallback: check query parameter if body doesn't have materialId
      if (!materialId) {
        try {
          const url = new URL(req.url);
          materialId = url.searchParams.get('materialId');
        } catch (urlError) {
          console.error('[extract-material-text] URL parse error:', urlError);
        }
      }
      
      if (!materialId) {
        return new Response(
          JSON.stringify({ error: 'materialId is required in body or query parameter' }),
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

    // Log material info in DEV mode
    if (Deno.env.get('ENVIRONMENT') === 'development' || !Deno.env.get('ENVIRONMENT')) {
      console.log('[extract-material-text] Material found:', { 
        materialId, 
        title: material.title,
        hasStoragePath: !!material.storage_path,
        mimeType: material.mime_type
      });
    }

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

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('teacher-materials')
      .download(material.storage_path);

    if (downloadError || !fileData) {
      console.error('[extract-material-text] Download error:', {
        materialId,
        storage_path: material.storage_path,
        error: downloadError
      });
      return new Response(
        JSON.stringify({ error: 'Failed to download PDF file', details: downloadError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert blob to array buffer for PDF parsing
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Extract text using pdfjs-dist (works in Deno via esm.sh)
    let extractedText = '';
    try {
      // Use pdfjs-dist for PDF parsing (works in Deno)
      const pdfjsLib = await import('https://esm.sh/pdfjs-dist@3.11.174/build/pdf.mjs');
      
      // Set worker source (required for pdfjs)
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.mjs';
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ 
        data: uint8Array,
        useSystemFonts: true
      });
      const pdfDocument = await loadingTask.promise;
      
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

    } catch (parseError) {
      console.error('[extract-material-text] PDF parsing error:', parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to extract text from PDF', details: parseError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update material with extracted text
    const { error: updateError } = await supabase
      .from('teacher_materials')
      .update({ extracted_text: extractedText })
      .eq('id', materialId)
      .eq('user_id', user.id);  // Extra safety

    if (updateError) {
      console.error('[extract-material-text] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save extracted text' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return success
    return new Response(
      JSON.stringify({
        ok: true,
        extractedChars: extractedText.length,
        pagesProcessed: Math.min(MAX_PAGES, extractedText.split('\n\n').length)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-material-text] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

