import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

interface EnhancedPDFGeneratorProps {
  elementId?: string;
  fileName: string;
  content?: string;
  isRichContent?: boolean;
  onComplete?: () => void;
  title?: string;
  metadata?: {
    author?: string;
    subject?: string;
    keywords?: string;
  };
}

export class EnhancedPDFGenerator {
  
  // Generate PDF from rich HTML content
  static async generateFromContent(props: EnhancedPDFGeneratorProps): Promise<void> {
    const { content, fileName, title, metadata, onComplete, isRichContent = true } = props;
    
    try {
      if (!content) {
        throw new Error('No content provided for PDF generation');
      }

      // Create a temporary container for the content
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = content;
      tempContainer.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: 800px;
        background: white;
        padding: 30px;
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
      `;
      
      document.body.appendChild(tempContainer);

      // Wait for any images to load
      const images = tempContainer.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => new Promise((resolve) => {
        if (img.complete) {
          resolve(true);
        } else {
          img.onload = () => resolve(true);
          img.onerror = () => resolve(true);
        }
      })));

      // Generate canvas from content
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        height: tempContainer.scrollHeight,
        width: tempContainer.scrollWidth,
        scrollX: 0,
        scrollY: 0,
      });

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Add metadata
      if (metadata) {
        if (metadata.author) pdf.setProperties({ creator: metadata.author });
        if (metadata.subject) pdf.setProperties({ subject: metadata.subject });
        if (metadata.keywords) pdf.setProperties({ keywords: metadata.keywords });
      }
      
      if (title) pdf.setProperties({ title });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Clean up
      document.body.removeChild(tempContainer);

      // Save PDF
      pdf.save(`${fileName}.pdf`);
      
      toast.success('PDF generado exitosamente');
      onComplete?.();
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF');
      throw error;
    }
  }

  // Generate PDF from DOM element (fallback method)
  static async generateFromElement(elementId: string, fileName: string, onComplete?: () => void): Promise<void> {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`Element with ID "${elementId}" not found`);
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${fileName}.pdf`);
      
      toast.success('PDF generado exitosamente');
      onComplete?.();
      
    } catch (error) {
      console.error('Error generating PDF from element:', error);
      toast.error('Error al generar el PDF');
      throw error;
    }
  }

  // Generate multiple PDFs in batch
  static async generateBatch(documents: Array<{
    content: string;
    fileName: string;
    title?: string;
  }>, onProgress?: (progress: number) => void): Promise<void> {
    try {
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        await this.generateFromContent({
          content: doc.content,
          fileName: doc.fileName,
          title: doc.title,
          isRichContent: true
        });
        
        onProgress?.((i + 1) / documents.length * 100);
        
        // Small delay to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      toast.success(`${documents.length} documentos generados exitosamente`);
    } catch (error) {
      console.error('Error in batch PDF generation:', error);
      toast.error('Error al generar los PDFs');
      throw error;
    }
  }

  // Preview content before PDF generation
  static previewContent(content: string): void {
    const previewWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head>
            <title>Vista Previa del Documento</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                margin: 20px; 
                background: #f5f5f5; 
              }
              .preview-container { 
                background: white; 
                padding: 30px; 
                max-width: 800px; 
                margin: 0 auto; 
                box-shadow: 0 0 10px rgba(0,0,0,0.1); 
              }
            </style>
          </head>
          <body>
            <div class="preview-container">
              ${content}
            </div>
          </body>
        </html>
      `);
      previewWindow.document.close();
    }
  }
}

// Utility functions for content processing
export const ContentUtils = {
  // Clean HTML content for PDF generation
  cleanContentForPDF: (content: string): string => {
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/style\s*=\s*["'][^"']*["']/gi, (match) => {
        // Keep only safe styles
        const safeStyles = ['color', 'background', 'font-size', 'font-weight', 'text-align', 'margin', 'padding', 'border'];
        const styleContent = match.match(/["']([^"]*)["']/)?.[1] || '';
        const filteredStyles = styleContent.split(';')
          .filter(style => safeStyles.some(safe => style.trim().startsWith(safe)))
          .join(';');
        return filteredStyles ? `style="${filteredStyles}"` : '';
      });
  },

  // Extract text content for search/indexing
  extractTextContent: (htmlContent: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    return tempDiv.textContent || tempDiv.innerText || '';
  },

  // Validate content structure
  validateContent: (content: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!content || content.trim().length === 0) {
      errors.push('El contenido está vacío');
    }
    
    if (content.length > 50000) {
      errors.push('El contenido es demasiado largo para generar PDF');
    }
    
    // Check for potentially problematic elements
    if (content.includes('<script')) {
      errors.push('El contenido contiene scripts que serán removidos');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
};
