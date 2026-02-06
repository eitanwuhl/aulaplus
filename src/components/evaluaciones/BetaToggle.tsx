/**
 * Beta Toggle Component for Evaluation v2
 * 
 * A small toggle switch that allows users to opt into the v2 evaluation
 * generation system. Persists state to localStorage.
 */

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Beaker, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getBetaToggleState, setBetaToggleState } from '@/services/evaluations/requestService';

interface BetaToggleProps {
  onChange?: (enabled: boolean) => void;
  className?: string;
  showHelperText?: boolean;
}

export function BetaToggle({ onChange, className, showHelperText = true }: BetaToggleProps) {
  const [enabled, setEnabled] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    const stored = getBetaToggleState();
    setEnabled(stored);
  }, []);

  const handleChange = (checked: boolean) => {
    setEnabled(checked);
    setBetaToggleState(checked);
    onChange?.(checked);
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <Switch
          id="beta-toggle"
          checked={enabled}
          onCheckedChange={handleChange}
          className="data-[state=checked]:bg-purple-600"
        />
        <Label 
          htmlFor="beta-toggle" 
          className="flex items-center gap-1.5 cursor-pointer text-sm font-medium"
        >
          <Beaker className="w-4 h-4 text-purple-600" />
          Beta (v2)
          {enabled && (
            <Badge variant="secondary" className="ml-1 text-xs bg-purple-100 text-purple-700">
              ON
            </Badge>
          )}
        </Label>
      </div>
      {showHelperText && (
        <p className="text-xs text-muted-foreground flex items-start gap-1 ml-9">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            Usa el nuevo formato estructurado. Si no está disponible, volvemos al formato estándar automáticamente.
          </span>
        </p>
      )}
    </div>
  );
}

export default BetaToggle;
