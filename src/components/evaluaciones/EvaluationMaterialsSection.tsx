/**
 * EvaluationMaterialsSection
 * 
 * Component for attaching materials to evaluations with two sources:
 * 1. Direct attachments from library (evaluation-level)
 * 2. Optional inclusion of materials from selected sessions (inherited)
 * 
 * Used in EvaluacionesGrupo for material-based evaluation creation
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Plus, X, AlertCircle } from 'lucide-react';
import { MaterialsLibraryDialog } from '@/components/materials';
import { useMaterialsList } from '@/hooks/useMaterials';
import { supabase } from '@/integrations/supabase/client';

export interface EvaluationMaterialsConfig {
  directMaterialIds: string[];
  includeSessionMaterials: boolean;
}

interface EvaluationMaterialsSectionProps {
  config: EvaluationMaterialsConfig;
  onChange: (config: EvaluationMaterialsConfig) => void;
  selectedSessionIds?: string[];
  disabled?: boolean;
}

export function EvaluationMaterialsSection({
  config,
  onChange,
  selectedSessionIds = [],
  disabled = false
}: EvaluationMaterialsSectionProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [sessionMaterialsCount, setSessionMaterialsCount] = useState(0);
  const [isLoadingSessionMaterials, setIsLoadingSessionMaterials] = useState(false);
  
  // Fetch all materials list to show titles
  const { data: allMaterials = [], isLoading } = useMaterialsList();
  
  // Get direct attached materials details
  const directMaterials = allMaterials.filter(m => 
    config.directMaterialIds.includes(m.id)
  );

  // Load session materials count
  useEffect(() => {
    if (selectedSessionIds.length === 0) {
      setSessionMaterialsCount(0);
      return;
    }

    const loadSessionMaterialsCount = async () => {
      setIsLoadingSessionMaterials(true);
      try {
        // Query material_attachments for selected sessions
        const { data, error } = await supabase
          .from('material_attachments')
          .select('material_id', { count: 'exact' })
          .eq('target_type', 'sesion')
          .in('target_id', selectedSessionIds)
          .is('deleted_at', null);

        if (error) {
          console.error('[EvaluationMaterialsSection] Error loading session materials:', error);
          return;
        }

        // Count unique materials
        const uniqueMaterialIds = new Set(data?.map(a => a.material_id) || []);
        setSessionMaterialsCount(uniqueMaterialIds.size);
      } finally {
        setIsLoadingSessionMaterials(false);
      }
    };

    loadSessionMaterialsCount();
  }, [selectedSessionIds]);
  
  const handleSelectMaterials = (selectedMaterials: any[]) => {
    // Extract IDs from materials objects
    const selectedIds = selectedMaterials.map(m => m.id);
    // Add new materials (merge with existing)
    const newIds = [...new Set([...config.directMaterialIds, ...selectedIds])];
    onChange({
      ...config,
      directMaterialIds: newIds
    });
  };
  
  const handleRemoveMaterial = (materialId: string) => {
    const newIds = config.directMaterialIds.filter(id => id !== materialId);
    onChange({
      ...config,
      directMaterialIds: newIds
    });
  };

  const handleToggleSessionMaterials = (checked: boolean) => {
    onChange({
      ...config,
      includeSessionMaterials: checked
    });
  };
  
  return (
    <Card className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Material Docente para Evaluación
        </CardTitle>
        <CardDescription>
          Adjunta cualquiera de tus materiales para usarlos como fuente de evaluación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Direct materials list */}
        {directMaterials.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Materiales adjuntos directamente ({directMaterials.length}):</p>
            <div className="space-y-1">
              {directMaterials.map(material => (
                <div 
                  key={material.id}
                  className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-gray-800 rounded border"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    <span className="text-sm truncate">{material.title}</span>
                    {material.mime_type === 'application/pdf' && (
                      <Badge variant="outline" className="text-xs">PDF</Badge>
                    )}
                  </div>
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMaterial(material.id)}
                      className="h-6 w-6 p-0"
                      title="Quitar material"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Add materials button */}
        {!disabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLibraryOpen(true)}
            disabled={isLoading}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {directMaterials.length > 0 ? 'Agregar más materiales' : 'Adjuntar materiales'}
          </Button>
        )}

        {/* Session materials toggle */}
        {selectedSessionIds.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-white">
              <Checkbox
                id="include-session-materials"
                checked={config.includeSessionMaterials}
                onCheckedChange={handleToggleSessionMaterials}
                disabled={disabled}
              />
              <div className="flex-1 space-y-1">
                <label 
                  htmlFor="include-session-materials" 
                  className="text-sm font-medium cursor-pointer"
                >
                  Incluir materiales de las sesiones seleccionadas
                </label>
                <p className="text-xs text-muted-foreground">
                  {isLoadingSessionMaterials ? (
                    'Contando materiales...'
                  ) : sessionMaterialsCount > 0 ? (
                    `${sessionMaterialsCount} material(es) adjunto(s) a las sesiones seleccionadas serán incluidos en la evaluación`
                  ) : (
                    'Las sesiones seleccionadas no tienen materiales adjuntos'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info alert */}
        {directMaterials.length === 0 && !config.includeSessionMaterials && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Tip:</strong> Adjuntar materiales docentes permite generar evaluaciones 
              basadas en tus propios recursos, complementando o reemplazando el contenido ANEP.
            </AlertDescription>
          </Alert>
        )}

        {/* Materials library dialog */}
        <MaterialsLibraryDialog
          open={isLibraryOpen}
          onOpenChange={setIsLibraryOpen}
          onSelect={handleSelectMaterials}
          multiSelect={true}
          selectedMaterialIds={config.directMaterialIds}
        />
      </CardContent>
    </Card>
  );
}

