/**
 * CollapsibleSection Component
 * 
 * A reusable collapsible section with localStorage persistence.
 * Used throughout the evaluation UI for consistent UX.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  /** Unique ID for localStorage persistence */
  id: string;
  /** Section title */
  title: React.ReactNode;
  /** Optional icon to show before title */
  icon?: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
  /** Default expanded state (used on first load before localStorage) */
  defaultExpanded?: boolean;
  /** Card className */
  className?: string;
  /** Header className */
  headerClassName?: string;
  /** Content className */
  contentClassName?: string;
  /** Whether to persist state to localStorage */
  persistState?: boolean;
  /** Badge or extra info to show in header (visible when collapsed) */
  badge?: React.ReactNode;
  /** Disable collapse functionality */
  disabled?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
}

const STORAGE_PREFIX = 'aulaplus:collapsible:';

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  icon,
  children,
  defaultExpanded = true,
  className,
  headerClassName,
  contentClassName,
  persistState = true,
  badge,
  disabled = false,
  onExpandedChange,
}) => {
  // Initialize state from localStorage or default
  const [isExpanded, setIsExpanded] = useState(() => {
    if (!persistState) return defaultExpanded;
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {
      // localStorage not available
    }
    return defaultExpanded;
  });

  // Persist to localStorage
  useEffect(() => {
    if (!persistState) return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${id}`, String(isExpanded));
    } catch {
      // localStorage not available
    }
  }, [id, isExpanded, persistState]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    const newState = !isExpanded;
    setIsExpanded(newState);
    onExpandedChange?.(newState);
  }, [disabled, isExpanded, onExpandedChange]);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={cn('overflow-hidden', className)}>
        <CollapsibleTrigger asChild disabled={disabled}>
          <CardHeader 
            className={cn(
              'cursor-pointer hover:bg-muted/50 transition-colors flex flex-row items-center justify-between',
              disabled && 'cursor-default hover:bg-transparent',
              headerClassName
            )}
            onClick={handleToggle}
          >
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle className="text-base">{title}</CardTitle>
              {badge}
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle();
                }}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className={cn('pt-0', contentClassName)}>
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default CollapsibleSection;
