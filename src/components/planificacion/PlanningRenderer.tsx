import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlanningRendererProps {
  content: string;
  title: string;
  duration?: number;
  icon?: React.ReactNode;
  className?: string;
}

export const PlanningRenderer: React.FC<PlanningRendererProps> = ({
  content,
  title,
  duration,
  icon,
  className = ""
}) => {
  
  // Función para convertir contenido de texto a HTML formateado
  const renderFormattedContent = (text: string) => {
    if (!text) return '';
    
    let formattedContent = text;
    
    // Convertir **texto** a <strong>texto</strong>
    formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convertir *texto* a <em>texto</em>
    formattedContent = formattedContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convertir listas con guiones a HTML
    formattedContent = formattedContent.replace(/^- (.+)$/gm, '<li>$1</li>');
    formattedContent = formattedContent.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Convertir listas numeradas
    formattedContent = formattedContent.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    formattedContent = formattedContent.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
    
    // Convertir saltos de línea dobles en párrafos
    const paragraphs = formattedContent.split('\n\n');
    formattedContent = paragraphs
      .filter(p => p.trim().length > 0)
      .map(p => {
        // Si ya es una lista o tiene tags HTML, no envolver en <p>
        if (p.includes('<ul>') || p.includes('<ol>') || p.includes('<li>') || p.includes('<strong>')) {
          return p;
        }
        return `<p>${p.trim()}</p>`;
      })
      .join('\n');
    
    // Limpiar listas mal formadas
    formattedContent = formattedContent.replace(/<ul>\s*<li>/g, '<ul><li>');
    formattedContent = formattedContent.replace(/<\/li>\s*<\/ul>/g, '</li></ul>');
    formattedContent = formattedContent.replace(/<ol>\s*<li>/g, '<ol><li>');
    formattedContent = formattedContent.replace(/<\/li>\s*<\/ol>/g, '</li></ol>');
    
    // Agregar espaciado entre elementos
    formattedContent = formattedContent.replace(/<\/p>\s*<p>/g, '</p><p class="mt-3">');
    formattedContent = formattedContent.replace(/<\/ul>\s*<p>/g, '</ul><p class="mt-3">');
    formattedContent = formattedContent.replace(/<\/ol>\s*<p>/g, '</ol><p class="mt-3">');
    formattedContent = formattedContent.replace(/<\/p>\s*<ul>/g, '</p><ul class="mt-3">');
    formattedContent = formattedContent.replace(/<\/p>\s*<ol>/g, '</p><ol class="mt-3">');
    
    return formattedContent;
  };

  const htmlContent = renderFormattedContent(content);

  return (
    <Card className={`hover:shadow-lg transition-all duration-200 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-3">
            {icon && <div className="flex items-center justify-center">{icon}</div>}
            <span>{title}</span>
          </CardTitle>
          {duration && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono font-medium">{duration}</span>
              <span>minutos</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div 
          className="prose prose-sm max-w-none planning-content"
          dangerouslySetInnerHTML={{ 
            __html: htmlContent 
          }}
          style={{
            // CSS personalizado para el contenido renderizado
            lineHeight: '1.6',
          }}
        />
        
        <style dangerouslySetInnerHTML={{
          __html: `
          .planning-content {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          
          .planning-content p {
            margin-bottom: 0.75rem;
            line-height: 1.6;
            color: hsl(var(--foreground));
          }
          
          .planning-content strong {
            font-weight: 600;
            color: hsl(var(--primary));
          }
          
          .planning-content em {
            font-style: italic;
            color: hsl(var(--muted-foreground));
          }
          
          .planning-content ul,
          .planning-content ol {
            margin: 1rem 0;
            padding-left: 1.5rem;
          }
          
          .planning-content li {
            margin-bottom: 0.5rem;
            line-height: 1.5;
            color: hsl(var(--foreground));
          }
          
          .planning-content ul li {
            list-style-type: disc;
          }
          
          .planning-content ol li {
            list-style-type: decimal;
          }
          
          .planning-content ul li::marker {
            color: hsl(var(--primary));
          }
          
          .planning-content ol li::marker {
            color: hsl(var(--primary));
            font-weight: 600;
          }
          
          .planning-content p:last-child {
            margin-bottom: 0;
          }
          
          /* Para impresión */
          @media print {
            .planning-content {
              font-size: 11pt;
              line-height: 1.4;
            }
            
            .planning-content p {
              margin-bottom: 6pt;
            }
            
            .planning-content ul,
            .planning-content ol {
              margin: 8pt 0;
            }
            
            .planning-content li {
              margin-bottom: 3pt;
            }
          }
          `
        }} />
      </CardContent>
    </Card>
  );
};