/**
 * UnitMaterialsSection
 * 
 * UI component for attaching materials per unit with:
 * - Multi-select materials from library
 * - Class count slider (how many classes for this material/unit)
 * - Per-class guidance textareas (one per class)
 * 
 * Used in UnidadCard for PHASE A
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { FileText, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { MaterialsLibraryDialog } from '@/components/materials';
import { useMaterialsList } from '@/hooks/useMaterials';

export interface UnitMaterialPlan {
  materialId: string;
  materialTitle: string;
  classCount: number; // How many classes for this material
  perClassGuidance: string[]; // One textarea per class (index = class number - 1)
}

interface UnitMaterialsSectionProps {
  unitId: string;
  materials: UnitMaterialPlan[];
  onChange: (materials: UnitMaterialPlan[]) => void;
  disabled?: boolean;
}

export function UnitMaterialsSection({
  unitId,
  materials,
  onChange,
  disabled = false
}: UnitMaterialsSectionProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Load materials for display
  const { data: allMaterials = [] } = useMaterialsList({
    orderBy: 'created_at',
    ascending: false,
  });

  const handleSelectMaterials = (selectedIds: string[]) => {
    // Add new materials (avoid duplicates)
    const existingIds = new Set(materials.map(m => m.materialId));
    const newMaterials: UnitMaterialPlan[] = selectedIds
      .filter(id => !existingIds.has(id))
      .map(materialId => {
        const material = allMaterials.find(m => m.id === materialId);
        return {
          materialId,
          materialTitle: material?.title || 'Material sin título',
          classCount: 1,
          perClassGuidance: [''] // Start with one empty guidance
        };
      });
    
    onChange([...materials, ...newMaterials]);
  };

  const handleRemoveMaterial = (materialId: string) => {
    onChange(materials.filter(m => m.materialId !== materialId));
  };

  const handleClassCountChange = (materialId: string, classCount: number[]) => {
    const newCount = classCount[0];
    onChange(materials.map(m => {
      if (m.materialId === materialId) {
        // Adjust perClassGuidance array to match new count
        const currentGuidance = m.perClassGuidance || [];
        const newGuidance = Array.from({ length: newCount }, (_, i) => 
          currentGuidance[i] || ''
        );
        return {
          ...m,
          classCount: newCount,
          perClassGuidance: newGuidance
        };
      }
      return m;
    }));
  };

  const handleGuidanceChange = (materialId: string, classIndex: number, text: string) => {
    onChange(materials.map(m => {
      if (m.materialId === materialId) {
        const newGuidance = [...(m.perClassGuidance || [])];
        newGuidance[classIndex] = text;
        return {
          ...m,
          perClassGuidance: newGuidance
        };
      }
      return m;
    }));
  };

  return (
    <Card className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Material Docente (opcional)</CardTitle>
            {materials.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {materials.length} material{materials.length > 1 ? 'es' : ''}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            disabled={disabled}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription className="text-xs">
          Adjunta materiales específicos para esta unidad con guía por clase
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Add materials button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLibraryOpen(true)}
            disabled={disabled}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adjuntar materiales
          </Button>

          {/* Materials list */}
          {materials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay materiales adjuntos. Haz clic en "Adjuntar materiales" para agregar.
            </p>
          ) : (
            <div className="space-y-4">
              {materials.map((material) => {
                const materialData = allMaterials.find(m => m.id === material.materialId);
                return (
                  <Card key={material.materialId} className="bg-white dark:bg-gray-900">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm truncate" title={material.materialTitle}>
                              {material.materialTitle}
                            </CardTitle>
                            {materialData?.extracted_text && (
                              <Badge variant="outline" className="text-xs mt-1 bg-blue-50">
                                Texto extraído
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMaterial(material.materialId)}
                          disabled={disabled}
                          className="h-6 w-6 text-destructive hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Class count slider */}
                      <div>
                        <Label className="text-xs">
                          ¿Cuántas clases para este material? {material.classCount}
                        </Label>
                        <div className="mt-2 px-2">
                          <Slider
                            value={[material.classCount]}
                            onValueChange={(val) => handleClassCountChange(material.materialId, val)}
                            min={1}
                            max={10}
                            step={1}
                            disabled={disabled}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>1 clase</span>
                            <span>10 clases</span>
                          </div>
                        </div>
                      </div>

                      {/* Per-class guidance */}
                      <div className="space-y-2">
                        <Label className="text-xs">Guía por clase (opcional)</Label>
                        {Array.from({ length: material.classCount }).map((_, classIndex) => (
                          <div key={classIndex} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              Clase {classIndex + 1}:
                            </Label>
                            <Textarea
                              value={material.perClassGuidance[classIndex] || ''}
                              onChange={(e) => handleGuidanceChange(material.materialId, classIndex, e.target.value)}
                              placeholder={`Guía específica para la clase ${classIndex + 1} (opcional)`}
                              disabled={disabled}
                              className="min-h-[60px] text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Materials library dialog */}
          <MaterialsLibraryDialog
            open={isLibraryOpen}
            onOpenChange={setIsLibraryOpen}
            onSelect={handleSelectMaterials}
            multiSelect={true}
            selectedMaterialIds={materials.map(m => m.materialId)}
          />
        </CardContent>
      )}
    </Card>
  );
}

