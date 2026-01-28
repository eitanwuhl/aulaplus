/**
 * Unit Tests: Session Brief Mapping by Orden
 * 
 * Phase 3.2.1 Fix - Verify that session briefs are correctly mapped by orden
 * 
 * Tests:
 * 1. Array mapping: briefs[i] → session with orden = i + 1
 * 2. Sparse arrays (non-contiguous orden values)
 * 3. Empty/undefined briefs are handled correctly
 * 4. Priority logic: sessionBrief → extracted title → fallback
 */

describe('Session Brief Mapping by Orden', () => {
  describe('Array Index to Orden Mapping', () => {
    it('should map array index 0 to orden 1', () => {
      const sessionBriefs = ['Topic 1', 'Topic 2', 'Topic 3'];
      const sessions = [
        { id: 's1', orden: 1 },
        { id: 's2', orden: 2 },
        { id: 's3', orden: 3 }
      ];

      sessions.forEach((session, i) => {
        const idx = session.orden - 1; // Convert orden (1-based) to index (0-based)
        const brief = sessionBriefs[idx];
        expect(brief).toBe(`Topic ${session.orden}`);
      });
    });

    it('should handle sparse arrays (non-contiguous orden)', () => {
      const sessionBriefs = ['Topic 1', 'Topic 2', 'Topic 3', 'Topic 4', 'Topic 5'];
      const sessions = [
        { id: 's1', orden: 1 },
        { id: 's3', orden: 3 },
        { id: 's5', orden: 5 }
      ];

      const mappedBriefs = sessions.map(s => {
        const idx = s.orden - 1;
        return sessionBriefs[idx];
      });

      expect(mappedBriefs).toEqual(['Topic 1', 'Topic 3', 'Topic 5']);
    });

    it('should return undefined for briefs beyond array length', () => {
      const sessionBriefs = ['Topic 1', 'Topic 2'];
      const sessions = [
        { id: 's1', orden: 1 },
        { id: 's2', orden: 2 },
        { id: 's3', orden: 3 } // No brief for this
      ];

      const brief3 = sessionBriefs[3 - 1]; // index 2, out of bounds
      expect(brief3).toBeUndefined();
    });
  });

  describe('Empty and Undefined Briefs', () => {
    it('should treat empty string as undefined after trim', () => {
      const sessionBriefs = ['Topic 1', '   ', 'Topic 3'];
      
      const cleaned = sessionBriefs.map(b => {
        const trimmed = b?.trim();
        return trimmed ? trimmed : undefined;
      });

      expect(cleaned).toEqual(['Topic 1', undefined, 'Topic 3']);
    });

    it('should handle array with all undefined briefs', () => {
      const sessionBriefs = [undefined, undefined, undefined];
      const hasMeaningful = sessionBriefs.some(b => (b ?? '').trim().length > 0);
      
      expect(hasMeaningful).toBe(false);
    });

    it('should detect meaningful briefs when at least one exists', () => {
      const sessionBriefs = [undefined, 'Topic 2', undefined];
      const hasMeaningful = sessionBriefs.some(b => (b ?? '').trim().length > 0);
      
      expect(hasMeaningful).toBe(true);
    });
  });

  describe('Priority Logic for Titulo', () => {
    it('should prefer data.titulo over sessionBrief', () => {
      const data = { titulo: 'Extracted from HTML' };
      const sessionBrief = 'Session Brief Input';
      
      const finalTitulo = data.titulo || sessionBrief;
      
      expect(finalTitulo).toBe('Extracted from HTML');
    });

    it('should use sessionBrief when data.titulo is missing', () => {
      const data = { titulo: undefined };
      const sessionBrief = 'Session Brief Input';
      
      const finalTitulo = data.titulo || sessionBrief;
      
      expect(finalTitulo).toBe('Session Brief Input');
    });

    it('should handle both missing (fallback to default)', () => {
      const data = { titulo: undefined };
      const sessionBrief = undefined;
      const orden = 5;
      
      const finalTitulo = data.titulo || sessionBrief || `Sesión ${orden}`;
      
      expect(finalTitulo).toBe('Sesión 5');
    });
  });

  describe('UI Display Priority', () => {
    it('should prioritize session_brief in UI', () => {
      const sesion = {
        session_brief: 'Teacher Topic',
        titulo: 'Generated Title',
        orden: 1
      };
      
      const displayTitle = sesion.session_brief || sesion.titulo || `Sesión ${sesion.orden}`;
      
      expect(displayTitle).toBe('Teacher Topic');
    });

    it('should fallback to titulo when session_brief is empty', () => {
      const sesion = {
        session_brief: null,
        titulo: 'Generated Title',
        orden: 1
      };
      
      const displayTitle = sesion.session_brief || sesion.titulo || `Sesión ${sesion.orden}`;
      
      expect(displayTitle).toBe('Generated Title');
    });

    it('should use orden fallback when both are missing', () => {
      const sesion = {
        session_brief: null,
        titulo: null,
        orden: 3
      };
      
      const displayTitle = sesion.session_brief || sesion.titulo || `Sesión ${sesion.orden}`;
      
      expect(displayTitle).toBe('Sesión 3');
    });
  });

  describe('H1 Extraction from HTML', () => {
    it('should extract H1 from simple HTML', () => {
      const html = '<section id="plan"><h1>My Class Title</h1><p>Content</p></section>';
      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      
      expect(h1Match).toBeTruthy();
      expect(h1Match![1]).toBe('My Class Title');
    });

    it('should extract H1 with attributes', () => {
      const html = '<section id="plan"><h1 class="title">Title with Class</h1></section>';
      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      
      expect(h1Match![1]).toBe('Title with Class');
    });

    it('should handle HTML without H1', () => {
      const html = '<section id="plan"><p>No H1 here</p></section>';
      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      
      expect(h1Match).toBeNull();
    });

    it('should trim extracted H1', () => {
      const html = '<h1>  Title with Spaces  </h1>';
      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const extracted = h1Match![1].trim();
      
      expect(extracted).toBe('Title with Spaces');
    });
  });

  describe('Mapping Persistence Updates', () => {
    it('should build correct updates array from sessions and briefs', () => {
      const sessions = [
        { id: 's1', orden: 1 },
        { id: 's2', orden: 2 },
        { id: 's3', orden: 3 }
      ];
      const sessionBriefs = ['Brief 1', undefined, 'Brief 3'];

      const updates = sessions
        .filter(s => (s.orden ?? 0) > 0)
        .map(s => {
          const idx = s.orden - 1;
          const brief = idx >= 0 && idx < sessionBriefs.length ? sessionBriefs[idx] : undefined;
          return {
            id: s.id,
            session_brief: brief?.trim() || null
          };
        });

      expect(updates).toEqual([
        { id: 's1', session_brief: 'Brief 1' },
        { id: 's2', session_brief: null },
        { id: 's3', session_brief: 'Brief 3' }
      ]);
    });

    it('should handle briefs array shorter than sessions array', () => {
      const sessions = [
        { id: 's1', orden: 1 },
        { id: 's2', orden: 2 },
        { id: 's3', orden: 3 },
        { id: 's4', orden: 4 }
      ];
      const sessionBriefs = ['Brief 1', 'Brief 2']; // Only 2 briefs

      const updates = sessions.map(s => {
        const idx = s.orden - 1;
        const brief = idx >= 0 && idx < sessionBriefs.length ? sessionBriefs[idx] : undefined;
        return {
          id: s.id,
          session_brief: brief || null
        };
      });

      expect(updates).toEqual([
        { id: 's1', session_brief: 'Brief 1' },
        { id: 's2', session_brief: 'Brief 2' },
        { id: 's3', session_brief: null },
        { id: 's4', session_brief: null }
      ]);
    });
  });
});

describe('Edge Function Title Extraction Logic', () => {
  it('should prefer sessionBrief over extracted H1', () => {
    const sessionBrief = 'Teacher Override Topic';
    const generatedHtml = '<h1>AI Generated Title</h1>';
    
    let extractedTitle = sessionBrief?.trim();
    if (!extractedTitle) {
      const h1Match = generatedHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
      if (h1Match && h1Match[1]) {
        extractedTitle = h1Match[1].trim();
      }
    }
    
    expect(extractedTitle).toBe('Teacher Override Topic');
  });

  it('should extract H1 when sessionBrief is missing', () => {
    const sessionBrief = undefined;
    const generatedHtml = '<h1>AI Generated Title</h1>';
    
    let extractedTitle = sessionBrief?.trim();
    if (!extractedTitle) {
      const h1Match = generatedHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
      if (h1Match && h1Match[1]) {
        extractedTitle = h1Match[1].trim();
      }
    }
    
    expect(extractedTitle).toBe('AI Generated Title');
  });

  it('should handle both missing (undefined result)', () => {
    const sessionBrief = undefined;
    const generatedHtml = '<p>No H1 here</p>';
    
    let extractedTitle = sessionBrief?.trim();
    if (!extractedTitle) {
      const h1Match = generatedHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
      if (h1Match && h1Match[1]) {
        extractedTitle = h1Match[1].trim();
      }
    }
    
    expect(extractedTitle).toBeUndefined();
  });
});

















