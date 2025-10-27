import React, { useState, useEffect } from 'react';
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react';

interface ImageRendererProps {
  src: string;
  alt: string;
  title?: string;
  className?: string;
}

/**
 * Component for rendering images with CORS support and fallback handling
 * Used specifically for PDF generation and display in evaluations
 */
export const ImageRenderer: React.FC<ImageRendererProps> = ({ 
  src, 
  alt, 
  title, 
  className = '' 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    // Reset states when src changes
    setLoading(true);
    setError(null);
    setImageLoaded(false);

    // Create a test image to check if it loads with CORS
    const testImg = new Image();
    testImg.crossOrigin = 'anonymous';
    
    testImg.onload = () => {
      setImageLoaded(true);
      setLoading(false);
    };
    
    testImg.onerror = () => {
      setError('No se pudo cargar la imagen con CORS');
      setLoading(false);
    };
    
    testImg.src = src;
  }, [src]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 border border-border rounded-lg bg-muted/30">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Validando imagen...</span>
      </div>
    );
  }

  if (error || !imageLoaded) {
    return (
      <div className="p-4 border border-border rounded-lg bg-muted/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <strong className="text-sm font-medium">Imagen:</strong>
              <a 
                href={src} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm break-all flex items-center gap-1"
              >
                Ver imagen
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {alt && (
              <p className="text-sm text-muted-foreground">{alt}</p>
            )}
            {title && title !== alt && (
              <p className="text-xs text-muted-foreground mt-1">{title}</p>
            )}
            <p className="text-xs text-amber-600 mt-2">
              La imagen no se puede mostrar directamente debido a restricciones CORS. 
              Usa el enlace para verla en una nueva pestaña.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <img 
        src={src}
        alt={alt}
        title={title}
        crossOrigin="anonymous"
        className={`max-w-full h-auto rounded-lg shadow-sm ${className}`}
        style={{ 
          maxHeight: '400px',
          objectFit: 'contain'
        }}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{alt}</span>
        <a 
          href={src} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline flex items-center gap-1"
        >
          Ver original
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
};