/**
 * FormField - Componente wrapper para campos de formulario con soporte de errores inline
 * 
 * Características:
 * - Muestra errores inline debajo del campo
 * - Aplica estilos de error (borde rojo, texto rojo)
 * - Soporte completo de accesibilidad (ARIA attributes)
 * - Compatible con todos los componentes de shadcn/ui
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  /** ID único del campo (usado para label htmlFor y aria attributes) */
  id: string;
  
  /** Texto del label */
  label: string;
  
  /** Si true, muestra asterisco rojo después del label */
  required?: boolean;
  
  /** Mensaje de error a mostrar (si undefined, no hay error) */
  error?: string;
  
  /** Elemento de input/select/textarea a renderizar */
  children: React.ReactNode;
  
  /** Texto de ayuda opcional (se oculta cuando hay error) */
  description?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required,
  error,
  children,
  description
}) => {
  const errorId = error ? `${id}-error` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="space-y-2">
      {/* Label con indicador de requerido */}
      <Label 
        htmlFor={id} 
        className={cn(error && 'text-destructive')}
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      {/* Descripción de ayuda (solo si no hay error) */}
      {description && !error && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {/* Input/Select/etc con props de accesibilidad inyectados */}
      <div>
        {React.isValidElement(children) && React.cloneElement(children as React.ReactElement<any>, {
          id,
          'aria-invalid': error ? 'true' : 'false',
          'aria-describedby': error ? errorId : descriptionId,
          className: cn(
            (children as React.ReactElement).props.className,
            error && 'border-destructive focus:ring-destructive focus-visible:ring-destructive'
          )
        })}
      </div>

      {/* Mensaje de error inline */}
      {error && (
        <p
          id={errorId}
          className="text-sm text-destructive font-medium"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};
