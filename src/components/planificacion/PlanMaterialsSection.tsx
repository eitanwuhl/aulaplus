/**
 * PlanMaterialsSection
 * 
 * UI component for attaching materials at plan-level (applies to all sessions)
 * Used in the planning wizard step 2 (Enfoque)
 * 
 * Plan-level attachments will be inherited by all sessions unless overridden at session-level.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, X } from 'lucide-react';
import { MaterialsLibraryDialog } from '@/components/materials';
import { useMaterialsList } from '@/hooks/useMaterials';

interface PlanMaterialsSectionProps {
  attachedMaterialIds?: string[];
  onMaterialsChange: (materialIds: string[]) => void;
  disabled?: boolean;
}

export function PlanMaterialsSection({
  attachedMaterialIds = [],
  onMaterialsChange,
  disabled = false
}: PlanMaterialsSectionProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  
  // Fetch materials list to show titles
  const { data: allMaterials = [], isLoading } = useMaterialsList();
  
  // Get attached materials details
  const attachedMaterials = allMaterials.filter(m => 
    attachedMaterialIds.includes(m.id)
  );
  
  const handleSelectMaterials = (selectedMaterials: any[]) => {
    // Extract IDs from materials objects
    const selectedIds = selectedMaterials.map(m => m.id);
    // Add new materials (merge with existing)
    const newIds = [...new Set([...attachedMaterialIds, ...selectedIds])];
    onMaterialsChange(newIds);
  };
  
  const handleRemoveMaterial = (materialId: string) => {
    const newIds = attachedMaterialIds.filter(id => id !== materialId);
    onMaterialsChange(newIds);
  };
  
  return (
    <Card className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Adjunta tu material como fuente
        </CardTitle>
        <CardDescription>
          Adjunta el material que tú quieras para tomar como fuente para tus clases.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attached materials list */}
        {attachedMaterials.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Materiales adjuntos ({attachedMaterials.length}):</p>
            <div className="space-y-1">
              {attachedMaterials.map(material => (
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
            {attachedMaterials.length > 0 ? 'Agregar más materiales' : 'Adjuntar materiales'}
          </Button>
        )}
        
        {/* Materials library dialog */}
        <MaterialsLibraryDialog
          open={isLibraryOpen}
          onOpenChange={setIsLibraryOpen}
          onSelect={handleSelectMaterials}
          multiSelect={true}
          selectedMaterialIds={attachedMaterialIds}
        />
      </CardContent>
    </Card>
  );
}

