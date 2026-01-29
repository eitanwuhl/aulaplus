import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client
    const authSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { materialId } = await req.json();
    if (!materialId) {
      return new Response(
        JSON.stringify({ error: 'materialId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch material and verify ownership
    const { data: material, error: fetchError } = await supabase
      .from('teacher_materials')
      .select('id, user_id, storage_path, mime_type, title')
      .eq('id', materialId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !material) {
      return new Response(
        JSON.stringify({ error: 'Material not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (material.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to extract text from this material' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify it's a PDF
    if (!material.mime_type || !material.mime_type.includes('pdf')) {
      return new Response(
        JSON.stringify({ error: 'Only PDF files can have text extracted' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('teacher-materials')
      .download(material.storage_path);

    if (downloadError || !fileData) {
      console.error('[extract-material-text] Download error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download PDF file' }),
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

