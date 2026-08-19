/**
 * V2 Evaluation Adjustments Panel
 * 
 * Allows teachers to request corrections/improvements and re-generate
 * the evaluation via the modify-evaluation-v2 Edge Function.
 * 
 * Features:
 * - Textarea for adjustment description
 * - Target version selector (A/B/C/All)
 * - Scope selector (entire/section/item)
 * - Apply adjustments button with loading state
 * - Undo last change (client-side single-step)
 * 
 * Note: This panel does NOT change content scope (contentIds/competencyIds/criteriosLogro).
 * It only improves wording, structure, scaffolding, clarity, formatting, rubric phrasing,
 * instructions, and pedagogical adaptation style.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  Undo2,
  Wand2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { V2Response } from '@/services/evaluations/v2Types';
import { invokeEdgeFunctionAuthed } from '@/lib/edgeFunctionAuth';
import { applyModifyCarryForward, decideRequestedVersionsForModify } from '@/services/evaluations/requestedVersionsPolicy';

// ============================================================================
// TYPES
// ============================================================================

type TargetVersion = 'A' | 'B' | 'C' | 'all';
type AdjustmentScope = 'entire' | 'section' | 'item';

interface AdjustmentRequest {
  text: string;
  targetVersions: TargetVersion;
  scope: AdjustmentScope;
  sectionId?: string;
  itemId?: string;
  timestamp: string;
}

interface EvaluationAdjustmentsPanelProps {
  /** Current V2 response (evaluationSpec + metadata) */
  v2Response: V2Response;
  /** Callback when adjustment is applied successfully */
  onAdjustmentApplied: (newResponse: V2Response, previousResponse: V2Response) => void;
  /** Previous response for undo (optional - managed externally) */
  previousResponse?: V2Response | null;
  /** Callback for undo action */
  onUndo?: () => void;
  /** Group context needed for regeneration */
  groupContext?: {
    subject?: string;
    groupName?: string;
    content?: string[];
    competencies?: string[];
    criteriosLogro?: string[];
    students?: Array<{ studentId: string | number; displayName?: string }>;
  };
  /** Evaluation design plan from original generation */
  evaluationDesignPlan?: Record<string, unknown>;
  /** Loading state (externally controlled) */
  isLoading?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const EvaluationAdjustmentsPanel: React.FC<EvaluationAdjustmentsPanelProps> = ({
  v2Response,
  onAdjustmentApplied,
  previousResponse,
  onUndo,
  groupContext,
  evaluationDesignPlan,
  isLoading: externalLoading = false,
}) => {
  const { toast } = useToast();
  
  // Panel collapse state (persisted)
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('v2panel:adjustments');
      return stored === 'true';
    } catch {
      return false;
    }
  });
  
  // Form state
  const [adjustmentText, setAdjustmentText] = useState('');
  const [targetVersions, setTargetVersions] = useState<TargetVersion>('all');
  const [scope, setScope] = useState<AdjustmentScope>('entire');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  
  // Loading state
  const [isApplying, setIsApplying] = useState(false);
  
  // Extract sections and items for selectors
  const sections = useMemo(() => {
    return v2Response.evaluationSpec?.sections || [];
  }, [v2Response.evaluationSpec]);
  
  const allItems = useMemo(() => {
    const items: Array<{ 
      itemId: string; 
      sectionId: string;
      sectionTitle: string; 
      prompt: string; 
      type: string;
    }> = [];
    
    sections.forEach(section => {
      section.items?.forEach(item => {
        items.push({
          itemId: item.id,
          sectionId: section.id,
          sectionTitle: section.title,
          prompt: item.prompt.slice(0, 50) + (item.prompt.length > 50 ? '...' : ''),
          type: item.type,
        });
      });
    });
    
    return items;
  }, [sections]);
  
  // Available versions based on v2Response
  const availableVersions = useMemo(() => {
    const versions: string[] = ['A'];
    if (v2Response.requestedVersions?.B) versions.push('B');
    if (v2Response.requestedVersions?.C) versions.push('C');
    return versions;
  }, [v2Response.requestedVersions]);
  
  // Toggle panel and persist
  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    try {
      localStorage.setItem('v2panel:adjustments', String(newState));
    } catch {
      // Ignore storage errors
    }
  };
  
  // Reset scope-specific selections when scope changes
  const handleScopeChange = (newScope: AdjustmentScope) => {
    setScope(newScope);
    if (newScope === 'entire') {
      setSelectedSectionId('');
      setSelectedItemId('');
    } else if (newScope === 'section') {
      setSelectedItemId('');
    }
  };
  
  // Apply adjustments
  const handleApplyAdjustments = async () => {
    // Validation
    if (!adjustmentText.trim()) {
      toast({
        title: 'Error',
        description: 'Ingresá una descripción de los ajustes solicitados.',
        variant: 'destructive',
      });
      return;
    }
    
    if (scope === 'section' && !selectedSectionId) {
      toast({
        title: 'Error',
        description: 'Seleccioná una sección para aplicar los ajustes.',
        variant: 'destructive',
      });
      return;
    }
    
    if (scope === 'item' && !selectedItemId) {
      toast({
        title: 'Error',
        description: 'Seleccioná un ítem para aplicar los ajustes.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsApplying(true);
    
    try {
      // Build the adjustment instruction
      const adjustmentInstruction = buildAdjustmentInstruction({
        text: adjustmentText,
        targetVersions,
        scope,
        sectionId: selectedSectionId || undefined,
        itemId: selectedItemId || undefined,
      });
      
      // Build request body (reuse existing patterns)
      const requestedVersions = decideRequestedVersionsForModify({
        currentRequestedVersions: v2Response.requestedVersions,
        currentEvaluationSpec: v2Response.evaluationSpec || undefined,
        evaluationDesignPlan,
        groupContextStudents: groupContext?.students || []
      });
      const requestBody = {
        mode: 'adjust', // Signal adjustment mode
        modification: adjustmentInstruction,
        groupContext: groupContext || {
          subject: v2Response.evaluationSpec?.meta?.subject,
          groupName: v2Response.evaluationSpec?.meta?.groupName,
          content: v2Response.evaluationSpec?.meta?.contentIds,
          competencies: v2Response.evaluationSpec?.meta?.competencyIds,
          criteriosLogro: v2Response.evaluationSpec?.meta?.criteriosLogro,
        },
        requestedVersions,
        evaluation_design_plan: evaluationDesignPlan || {
          triggers: {
            versionB: requestedVersions.B,
            versionC: requestedVersions.C,
          },
        },
        // Pass current spec for reference (LLM can preserve structure)
        currentEvaluationSpec: v2Response.evaluationSpec,
        adjustmentDetails: {
          targetVersions,
          scope,
          sectionId: selectedSectionId || undefined,
          itemId: selectedItemId || undefined,
        },
      };
      
      console.log('[ADJUSTMENTS] Calling modify-evaluation-v2 with adjustment request');
      
      const { data, error } = await invokeEdgeFunctionAuthed('modify-evaluation-v2', {
        body: requestBody,
      });
      
      if (error) {
        throw new Error(`API error: ${error.message}`);
      }
      
      if (!data || !data.success) {
        const errorData = data as { warnings?: Array<{ severity?: string; message?: string }> };
        const errorMsg = errorData?.warnings?.find((w) => w.severity === 'error')?.message;
        throw new Error(errorMsg || 'La generación falló');
      }
      
      // Success - call callback with new and previous responses
      const mergedResult = applyModifyCarryForward({
        previousResponse: v2Response,
        nextResponse: data as V2Response,
        requestedVersions,
        explicitRemoval: { B: false, C: false },
        requestId: (data as V2Response)?.requestId
      });
      onAdjustmentApplied(mergedResult.response, v2Response);
      
      // Clear form
      setAdjustmentText('');
      
      toast({
        title: 'Ajustes aplicados',
        description: 'La evaluación fue actualizada exitosamente.',
      });
      
    } catch (error) {
      console.error('[ADJUSTMENTS] Error:', error);
      toast({
        title: 'Error al aplicar ajustes',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setIsApplying(false);
    }
  };
  
  // Handle undo
  const handleUndo = () => {
    if (onUndo) {
      onUndo();
      toast({
        title: 'Cambio revertido',
        description: 'Se restauró la versión anterior de la evaluación.',
      });
    }
  };
  
  const isLoading = externalLoading || isApplying;
  const canUndo = Boolean(previousResponse && onUndo);
  
  return (
    <Card className="border-2 border-purple-300">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleToggle}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-purple-600" />
                Solicitar ajustes
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-100 text-purple-700">
                  Re-generar (v2)
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Info notice */}
            <div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-md text-sm">
              <AlertCircle className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
              <p className="text-purple-800 dark:text-purple-200">
                Podés mejorar la redacción, estructura, claridad, instrucciones y adaptaciones pedagógicas.
                <strong> No se puede cambiar el contenido curricular seleccionado.</strong>
              </p>
            </div>
            
            {/* Adjustment description */}
            <div className="space-y-2">
              <Label htmlFor="adjustment-text">Describí los ajustes que querés</Label>
              <Textarea
                id="adjustment-text"
                placeholder="Ej: Simplificá las instrucciones de la parte 2, agregá más opciones de respuesta al ítem 3, usá vocabulario más accesible en la versión B..."
                value={adjustmentText}
                onChange={(e) => setAdjustmentText(e.target.value)}
                rows={4}
                disabled={isLoading}
              />
            </div>
            
            {/* Target versions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Aplicar a versiones</Label>
                <Select 
                  value={targetVersions} 
                  onValueChange={(v) => setTargetVersions(v as TargetVersion)}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las versiones</SelectItem>
                    {availableVersions.map(v => (
                      <SelectItem key={v} value={v}>Solo versión {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Scope */}
              <div className="space-y-2">
                <Label>Alcance</Label>
                <Select 
                  value={scope} 
                  onValueChange={(v) => handleScopeChange(v as AdjustmentScope)}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entire">Toda la evaluación</SelectItem>
                    <SelectItem value="section">Sección específica</SelectItem>
                    <SelectItem value="item">Ítem específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Section selector (if scope = section) */}
            {scope === 'section' && sections.length > 0 && (
              <div className="space-y-2">
                <Label>Seleccionar sección</Label>
                <Select 
                  value={selectedSectionId} 
                  onValueChange={setSelectedSectionId}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí una sección..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section, idx) => (
                      <SelectItem key={section.id} value={section.id}>
                        Parte {idx + 1}: {section.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Item selector (if scope = item) */}
            {scope === 'item' && allItems.length > 0 && (
              <div className="space-y-2">
                <Label>Seleccionar ítem</Label>
                <Select 
                  value={selectedItemId} 
                  onValueChange={setSelectedItemId}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí un ítem..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allItems.map((item) => (
                      <SelectItem key={item.itemId} value={item.itemId}>
                        <span className="text-muted-foreground">{item.sectionTitle} •</span>{' '}
                        {item.prompt}
                        <Badge variant="outline" className="ml-2 text-xs">{item.type}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={handleUndo}
                disabled={!canUndo || isLoading}
                className="gap-2"
              >
                <Undo2 className="h-4 w-4" />
                Deshacer último cambio
              </Button>
              
              <Button
                onClick={handleApplyAdjustments}
                disabled={isLoading || !adjustmentText.trim()}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Aplicar ajustes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build adjustment instruction for the LLM prompt.
 * This instruction preserves content scope and focuses on presentation.
 */
function buildAdjustmentInstruction(request: Omit<AdjustmentRequest, 'timestamp'>): string {
  const parts: string[] = [];
  
  // Header
  parts.push('=== INSTRUCCIONES DE AJUSTE ===');
  parts.push('');
  
  // Scope
  if (request.scope === 'section' && request.sectionId) {
    parts.push(`ALCANCE: Aplicar cambios SOLO a la sección con id="${request.sectionId}"`);
  } else if (request.scope === 'item' && request.itemId) {
    parts.push(`ALCANCE: Aplicar cambios SOLO al ítem con id="${request.itemId}"`);
  } else {
    parts.push('ALCANCE: Aplicar cambios a toda la evaluación');
  }
  parts.push('');
  
  // Target versions
  if (request.targetVersions === 'all') {
    parts.push('VERSIONES: Aplicar a todas las versiones (A, B, C si existen)');
  } else {
    parts.push(`VERSIONES: Aplicar SOLO a versión ${request.targetVersions}`);
  }
  parts.push('');
  
  // Instructions
  parts.push('AJUSTES SOLICITADOS POR EL DOCENTE:');
  parts.push(request.text);
  parts.push('');
  
  // Constraints
  parts.push('=== RESTRICCIONES ===');
  parts.push('1. NO cambiar los contenidos curriculares (contentIds, competencyIds, criteriosLogro)');
  parts.push('2. NO agregar contenido fuera del tema');
  parts.push('3. PRESERVAR los IDs de secciones e ítems cuando sea posible');
  parts.push('4. MANTENER la estructura general (número de secciones, tipos de ítems)');
  parts.push('5. Se permite mejorar: redacción, claridad, instrucciones, scaffolding, formato, adaptaciones B/C');
  
  return parts.join('\n');
}

export default EvaluationAdjustmentsPanel;
