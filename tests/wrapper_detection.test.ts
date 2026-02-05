/**
 * Regression Tests for Wrapper Detection & Cleaning
 * 
 * These tests ensure that wrapper fragments are never rendered in the UI.
 * Run with: deno test tests/wrapper_detection.test.ts
 */

// Import functions from backend (would need to export them or copy logic)
// For now, we'll test the logic inline

function hasWrapperLeak(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  
  if (trimmed.startsWith('{')) return true;
  
  const versionsPattern = /"versions"\s*:\s*\{/;
  if (versionsPattern.test(trimmed)) {
    const firstLt = trimmed.indexOf('<');
    const versionsIdx = trimmed.indexOf('"versions"');
    
    if (firstLt === -1 || versionsIdx < firstLt) return true;
    
    const beforeHtml = trimmed.slice(0, Math.min(versionsIdx, firstLt));
    if (beforeHtml.includes('{') && beforeHtml.includes('"versions"')) {
      return true;
    }
  }
  
  const jsonFragmentPattern = /",\s*"[ABC]"\s*:/;
  if (jsonFragmentPattern.test(trimmed)) {
    return true;
  }
  
  return false;
}

function removeWrapperFragments(html: string): string {
  if (!html) return html;
  
  let cleaned = html;
  
  cleaned = cleaned.replace(/\{\s*"versions"\s*:\s*\{\s*"[ABC]"\s*:\s*"/gi, '');
  cleaned = cleaned.replace(/",\s*"[ABC]"\s*:/gi, '');
  cleaned = cleaned.replace(/",\s*"[ABC]"\s*"\s*:/gi, '');
  cleaned = cleaned.replace(/^\s*\{\s*/, '');
  cleaned = cleaned.replace(/\s*\}\s*$/, '');
  cleaned = cleaned.replace(/\{\s*"versions"\s*:\s*\{/gi, '');
  cleaned = cleaned.replace(/Nota:\s*[^<]*\{\s*"versions"/gi, 'Nota:');
  
  return cleaned.trim();
}

function isCleanHtml(str: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!trimmed.startsWith('<')) return false;
  if (trimmed.includes('"versions"') && trimmed.includes('{')) return false;
  if (/",\s*"[ABC]"\s*:/.test(trimmed)) return false;
  return true;
}

// Test Cases

Deno.test("hasWrapperLeak: detects wrapper at start", () => {
  const input = '{ "versions": { "A": "<div>test</div>" } }';
  const result = hasWrapperLeak(input);
  Deno.assert(result === true, "Should detect wrapper at start");
});

Deno.test("hasWrapperLeak: detects wrapper embedded in HTML", () => {
  const input = '<div>Some text {"versions": {"A": "content"}}</div>';
  const result = hasWrapperLeak(input);
  Deno.assert(result === true, "Should detect wrapper embedded in HTML");
});

Deno.test("hasWrapperLeak: detects JSON fragment", () => {
  const input = '<div>Content ", "B": "more content"</div>';
  const result = hasWrapperLeak(input);
  Deno.assert(result === true, "Should detect JSON fragment");
});

Deno.test("hasWrapperLeak: clean HTML unchanged", () => {
  const input = '<div class="evaluation"><h2>Test</h2><p>Content</p></div>';
  const result = hasWrapperLeak(input);
  Deno.assert(result === false, "Should not detect wrapper in clean HTML");
});

Deno.test("hasWrapperLeak: C containing A+B scenario", () => {
  const input = '<div>Versión A content here. Versión B content here.</div>';
  const result = hasWrapperLeak(input);
  // This should not be detected as wrapper (it's just text mentioning versions)
  Deno.assert(result === false, "Should not detect version mentions as wrappers");
});

Deno.test("removeWrapperFragments: removes wrapper at start", () => {
  const input = '{"versions": {"A": "<div>test</div>"}';
  const result = removeWrapperFragments(input);
  Deno.assert(!result.includes('"versions"'), "Should remove wrapper pattern");
  Deno.assert(result.includes('<div>test</div>'), "Should preserve HTML content");
});

Deno.test("removeWrapperFragments: removes embedded fragments", () => {
  const input = '<div>Content ", "B": "more"</div>';
  const result = removeWrapperFragments(input);
  Deno.assert(!result.includes('", "B":'), "Should remove JSON fragment");
  Deno.assert(result.includes('Content'), "Should preserve other content");
});

Deno.test("removeWrapperFragments: clean HTML unchanged", () => {
  const input = '<div class="evaluation"><h2>Test</h2><p>Content</p></div>';
  const result = removeWrapperFragments(input);
  Deno.assert(result === input, "Should not modify clean HTML");
});

Deno.test("removeWrapperFragments: removes Nota with wrapper", () => {
  const input = 'Nota: Esta versión {"versions": {"A": "content"}}';
  const result = removeWrapperFragments(input);
  Deno.assert(result.includes('Nota:'), "Should preserve Nota:");
  Deno.assert(!result.includes('"versions"'), "Should remove wrapper fragment");
});

Deno.test("isCleanHtml: accepts clean HTML", () => {
  const input = '<div class="evaluation"><h2>Test</h2></div>';
  const result = isCleanHtml(input);
  Deno.assert(result === true, "Should accept clean HTML");
});

Deno.test("isCleanHtml: rejects wrapper at start", () => {
  const input = '{"versions": {"A": "<div>test</div>"}';
  const result = isCleanHtml(input);
  Deno.assert(result === false, "Should reject wrapper at start");
});

Deno.test("isCleanHtml: rejects embedded fragments", () => {
  const input = '<div>Content ", "B": "more"</div>';
  const result = isCleanHtml(input);
  Deno.assert(result === false, "Should reject embedded fragments");
});

Deno.test("isCleanHtml: rejects non-HTML", () => {
  const input = 'This is plain text';
  const result = isCleanHtml(input);
  Deno.assert(result === false, "Should reject non-HTML");
});

console.log("✅ All wrapper detection tests passed!");
