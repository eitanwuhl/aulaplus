import React from 'react';

interface HTMLRendererProps {
  content: string;
  className?: string;
}

export const HTMLRenderer: React.FC<HTMLRendererProps> = ({ content, className = '' }) => {
  // Advanced block-based parser for structured content
  const parseContent = (text: string): string => {
    // 1. Normalize and clean content
    let normalized = text.trim();
    
    // Remove code block artifacts
    normalized = normalized.replace(/^```html\s*/i, '');
    normalized = normalized.replace(/\s*```\s*$/i, '');
    normalized = normalized.replace(/^```[a-z]*\s*/gm, '');
    
    // CLIENT-SIDE CLEANUP: Eliminar múltiples <br> excesivos
    normalized = normalized.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');
    normalized = normalized.replace(/\s*<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/gi, '<br><br>');
    
    // Normalize line breaks (handle different line ending styles)
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Process HTML tables and images first (preserve complete HTML structures)
    normalized = processTablesAndImages(normalized);
    
    // 2. Split into blocks by double line breaks
    const blocks = normalized.split(/\n\s*\n/).filter(block => block.trim());
    
    const processedBlocks = blocks.map(block => {
      const trimmedBlock = block.trim();
      
      // Skip processing blocks that are already HTML tables or images
      if (trimmedBlock.startsWith('<table') || trimmedBlock.startsWith('<img') || 
          trimmedBlock.startsWith('<div') && trimmedBlock.includes('Imagen histórica')) {
        return trimmedBlock;
      }
      
      // 3. Check for section titles (Inicio, Desarrollo, Cierre) with optional time
      const titleMatch = trimmedBlock.match(/^\*\*(Inicio|Desarrollo|Cierre)\*\*(?:\s*\(([^)]+)\))?/);
      if (titleMatch) {
        const title = titleMatch[1];
        const time = titleMatch[2];
        const restOfContent = trimmedBlock.replace(titleMatch[0], '').trim();
        
        let html = `<h4 class="font-semibold text-primary mb-2">${title}`;
        if (time) {
          html += ` <span class="text-sm font-normal text-muted-foreground">(${time})</span>`;
        }
        html += '</h4>';
        
        if (restOfContent) {
          html += '\n' + processBlock(restOfContent);
        }
        
        return html;
      }
      
      // 4. Process regular content blocks
      return processBlock(trimmedBlock);
    });
    
    return processedBlocks.join('\n\n');
  };

  // Process HTML tables and images while preserving their structure
  const processTablesAndImages = (text: string): string => {
    let processed = text;
    
    // Handle image placeholders and convert them to simple text links
    processed = processed.replace(
      /\[Imagen histórica:\s*([^\]]+)\]/gi,
      '<div class="image-link-placeholder"><strong>Imagen histórica:</strong> $1</div>'
    );
    
    processed = processed.replace(
      /📸\s*\[Buscar imagen:\s*([^\]]+)\]/gi,
      '<div class="image-link-placeholder"><strong>Buscar imagen:</strong> $1</div>'
    );
    
    // Convert ALL img tags to simple text links - NO images displayed, CORS-ready format
    processed = processed.replace(
      /<img[^>]+src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi,
      '<p><strong>Imagen:</strong> <a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline break-all" data-crossorigin="anonymous">$1</a> — $2</p>'
    );
    
    // Handle img tags without alt attribute  
    processed = processed.replace(
      /<img[^>]+src=["']([^"']*)["'][^>]*\/?>/gi,
      '<p><strong>Imagen:</strong> <a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline break-all" data-crossorigin="anonymous">$1</a></p>'
    );
    
    // Handle single-quoted img tags
    processed = processed.replace(
      /<img[^>]+src='([^']*)'[^>]*alt='([^']*)'[^>]*\/?>/gi,
      '<p><strong>Imagen:</strong> <a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline break-all" data-crossorigin="anonymous">$1</a> — $2</p>'
    );
    
    processed = processed.replace(
      /\[Mapa:\s*([^\]]+)\]/gi,
      '<div class="image-link-placeholder"><strong>Mapa recomendado:</strong> $1</div>'
    );
    
    processed = processed.replace(
      /\[Documento fuente:\s*([^\]]+)\]/gi,
      '<div class="image-link-placeholder"><strong>Documento fuente:</strong> $1</div>'
    );
    
    // Add proper styling to existing tables with better padding and spacing
    processed = processed.replace(
      /<table(?![^>]*style=)/gi,
      '<table style="border-collapse: collapse; width: 100%; margin: 20px 0; font-size: 16px;"'
    );
    
    // Add styling to table cells with more padding
    processed = processed.replace(
      /<td(?![^>]*style=)/gi,
      '<td style="padding: 12px; border: 1px solid #333; vertical-align: top; min-height: 50px;"'
    );
    
    processed = processed.replace(
      /<th(?![^>]*style=)/gi,
      '<th style="padding: 12px; border: 1px solid #333; background-color: #f5f5f5; font-weight: bold;"'
    );
    
    return processed;
  };

  // Process individual content blocks (lists, paragraphs)
  const processBlock = (block: string): string => {
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) return '';
    
    // Check if this is a list block
    const isBulletList = lines.every(line => /^[-−•*]\s+/.test(line));
    const isNumberedList = lines.every(line => /^\d+\.\s+/.test(line));
    
    if (isBulletList) {
      const listItems = lines.map(line => {
        const content = line.replace(/^[-−•*]\s+/, '');
        return `<li>${applyInlineFormatting(content)}</li>`;
      });
      return `<ul class="list-disc list-inside space-y-2 ml-6" style="margin: 16px 0;">${listItems.join('')}</ul>`;
    }
    
    if (isNumberedList) {
      const listItems = lines.map(line => {
        const content = line.replace(/^\d+\.\s+/, '');
        return `<li>${applyInlineFormatting(content)}</li>`;
      });
      return `<ol class="list-decimal list-inside space-y-2 ml-6" style="margin: 16px 0;">${listItems.join('')}</ol>`;
    }
    
    // Check for mixed content (some lines are list items, some aren't)
    const processedLines: string[] = [];
    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
    
    for (const line of lines) {
      const isBullet = /^[-−•*]\s+/.test(line);
      const isNumbered = /^\d+\.\s+/.test(line);
      
      if (isBullet || isNumbered) {
        const listType = isBullet ? 'ul' : 'ol';
        const content = line.replace(/^(?:[-−•*]|\d+\.)\s+/, '');
        
        if (!currentList || currentList.type !== listType) {
          // Close previous list if different type
          if (currentList) {
            const listClass = currentList.type === 'ul' ? 'list-disc' : 'list-decimal';
            processedLines.push(`<${currentList.type} class="${listClass} list-inside space-y-2 ml-6" style="margin: 16px 0;">${currentList.items.map(item => `<li>${item}</li>`).join('')}</${currentList.type}>`);
          }
          currentList = { type: listType, items: [] };
        }
        
        currentList.items.push(applyInlineFormatting(content));
      } else {
        // Close current list and add paragraph
        if (currentList) {
          const listClass = currentList.type === 'ul' ? 'list-disc' : 'list-decimal';
          processedLines.push(`<${currentList.type} class="${listClass} list-inside space-y-2 ml-6" style="margin: 16px 0;">${currentList.items.map(item => `<li>${item}</li>`).join('')}</${currentList.type}>`);
          currentList = null;
        }
        
        processedLines.push(`<p class="mb-4" style="margin: 12px 0; line-height: 1.7;">${applyInlineFormatting(line)}</p>`);
      }
    }
    
    // Close any remaining list
    if (currentList) {
      const listClass = currentList.type === 'ul' ? 'list-disc' : 'list-decimal';
      processedLines.push(`<${currentList.type} class="${listClass} list-inside space-y-2 ml-6" style="margin: 16px 0;">${currentList.items.map(item => `<li>${item}</li>`).join('')}</${currentList.type}>`);
    }
    
    return processedLines.join('\n');
  };

  // Apply inline formatting (bold, italic)
  const applyInlineFormatting = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  };

  const htmlContent = parseContent(content);

  return (
    <>
      <style>
        {`
        .image-link-placeholder {
          margin: 16px 0;
          padding: 12px;
          background-color: #f8fafc;
          border-left: 3px solid #64748b;
          border-radius: 4px;
          font-size: 15px;
          color: #475569;
        }
        `}
      </style>
      <div 
        className={`prose max-w-none ${className}`}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        style={{
          fontSize: '16px',
          lineHeight: '1.7',
          fontFamily: 'inherit',
          padding: '20px 0'
        }}
      />
    </>
  );
};

export default HTMLRenderer;