import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Eye, Edit3 } from 'lucide-react';
import { HTMLRenderer } from '@/components/evaluaciones/HTMLRenderer';

interface PlanningTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export const PlanningTextArea: React.FC<PlanningTextAreaProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  minHeight = 'min-h-24'
}) => {
  const [isPreview, setIsPreview] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={!isPreview ? "default" : "outline"}
            size="sm"
            onClick={() => setIsPreview(false)}
            className="text-xs"
          >
            <Edit3 className="h-3 w-3 mr-1" />
            Editar
          </Button>
          <Button
            type="button"
            variant={isPreview ? "default" : "outline"}
            size="sm"
            onClick={() => setIsPreview(true)}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            Vista previa
          </Button>
        </div>
      </div>

      {!isPreview ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${minHeight} ${className}`}
        />
      ) : (
        <div className={`${minHeight} border border-input rounded-md p-3 bg-background ${className}`}>
          {value ? (
            <HTMLRenderer content={value} />
          ) : (
            <p className="text-muted-foreground italic">
              {placeholder || 'Contenido vacío'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PlanningTextArea;