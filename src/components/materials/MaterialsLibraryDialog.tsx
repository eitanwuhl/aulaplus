/**
 * Materials Library Dialog
 * 
 * Dialog for browsing and selecting materials from the teacher's library.
 * Includes search, upload button, and material selection.
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Upload, FileText, Image, Video, File, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useMaterialsList } from '@/hooks/useMaterials';
import { UploadMaterialDialog } from './UploadMaterialDialog';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type TeacherMaterial = Database['public']['Tables']['teacher_materials']['Row'];

interface MaterialsLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (materials: TeacherMaterial[]) => void;
  multiSelect?: boolean;
  selectedMaterialIds?: string[];
}

export function MaterialsLibraryDialog({
  open,
  onOpenChange,
  onSelect,
  multiSelect = true,
  selectedMaterialIds = []
}: MaterialsLibraryDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(
    new Set(selectedMaterialIds)
  );

  const { data: materials, isLoading, error, refetch } = useMaterialsList({
    orderBy: 'created_at',
    ascending: false
  });

  // Filter materials by search query
  const filteredMaterials = materials?.filter(material => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      material.title.toLowerCase().includes(query) ||
      (material.metadata as any)?.tags?.some((tag: string) => 
        tag.toLowerCase().includes(query)
      ) ||
      (material.metadata as any)?.notes?.toLowerCase().includes(query)
    );
  }) || [];

  const handleToggleSelect = (materialId: string) => {
    const newSelected = new Set(localSelectedIds);
    if (newSelected.has(materialId)) {
      newSelected.delete(materialId);
    } else {
      if (!multiSelect) {
        newSelected.clear();
      }
      newSelected.add(materialId);
    }
    setLocalSelectedIds(newSelected);
  };

  const handleConfirm = () => {
    const selectedMaterials = materials?.filter(m => localSelectedIds.has(m.id)) || [];
    onSelect(selectedMaterials);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalSelectedIds(new Set(selectedMaterialIds));
    onOpenChange(false);
  };

  const handleUploadSuccess = () => {
    refetch();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Biblioteca de Materiales</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and Upload */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar materiales..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Subir
              </Button>
            </div>

            {/* Materials List */}
            <ScrollArea className="h-[400px] pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Error al cargar materiales
                  </p>
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery 
                      ? 'No se encontraron materiales con ese criterio'
                      : 'No hay materiales en tu biblioteca. Sube tu primer material para empezar.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMaterials.map((material) => (
                    <MaterialCard
                      key={material.id}
                      material={material}
                      selected={localSelectedIds.has(material.id)}
                      onToggle={() => handleToggleSelect(material.id)}
                      multiSelect={multiSelect}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Selection Count */}
            {localSelectedIds.size > 0 && (
              <div className="text-sm text-muted-foreground">
                {localSelectedIds.size} material{localSelectedIds.size > 1 ? 'es' : ''} seleccionado{localSelectedIds.size > 1 ? 's' : ''}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              type="button"
              variant="outline" 
              onClick={handleCancel}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={localSelectedIds.size === 0}
            >
              Seleccionar ({localSelectedIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UploadMaterialDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
}

// Material Card Component
interface MaterialCardProps {
  material: TeacherMaterial;
  selected: boolean;
  onToggle: () => void;
  multiSelect: boolean;
}

function MaterialCard({ material, selected, onToggle, multiSelect }: MaterialCardProps) {
  const metadata = material.metadata as any;
  const tags = metadata?.tags || [];
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExtracting, setIsExtracting] = React.useState(false);
  const isPDF = material.mime_type?.includes('pdf');
  const hasExtractedText = !!material.extracted_text;

  const handleReExtract = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    
    if (!isPDF) {
      toast({
        title: 'No es un PDF',
        description: 'Solo los archivos PDF pueden tener texto extraído',
        variant: 'destructive'
      });
      return;
    }

    setIsExtracting(true);
    try {
      const { extractMaterialText } = await import('@/services/materials');
      const result = await extractMaterialText(material.id);
      
      if (result.success) {
        toast({
          title: 'Texto extraído',
          description: `Se extrajeron ${result.extractedChars} caracteres del PDF`,
        });
        // Invalidate queries to refresh material data
        queryClient.invalidateQueries({ queryKey: materialsKeys.lists() });
        queryClient.invalidateQueries({ queryKey: materialsKeys.detail(material.id) });
      } else {
        toast({
          title: 'Error al extraer texto',
          description: result.error || 'No se pudo extraer texto del PDF',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('[MaterialCard] Re-extract error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error inesperado',
        variant: 'destructive'
      });
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-lg border transition-colors
        ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'}
      `}
    >
      {/* Checkbox/Icon */}
      <div className="flex-shrink-0 pt-0.5" onClick={onToggle}>
        {multiSelect ? (
          <Checkbox checked={selected} />
        ) : (
          <div className={`w-4 h-4 rounded-full border-2 cursor-pointer ${selected ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
        )}
      </div>

      {/* File Icon */}
      <div className="flex-shrink-0">
        {getFileIcon(material.mime_type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0" onClick={onToggle}>
        <div className="font-medium text-sm truncate">
          {material.title}
        </div>
        {metadata?.notes && (
          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {metadata.notes}
          </div>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag: string, index: number) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {/* PDF extraction status */}
        {isPDF && (
          <div className="flex items-center gap-2 mt-2">
            {hasExtractedText ? (
              <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                ✓ Texto extraído
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                  ⚠ Sin texto extraído
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReExtract}
                  disabled={isExtracting}
                  className="h-6 text-xs"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Extrayendo...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Re-extraer
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Re-extract button for PDFs (only if text is already extracted) */}
      {isPDF && hasExtractedText && (
        <div className="flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReExtract}
            disabled={isExtracting}
            className="h-8 w-8 p-0"
            title="Re-extraer texto"
          >
            {isExtracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper: Get icon by MIME type
function getFileIcon(mimeType: string | null) {
  const iconClass = "h-8 w-8 text-muted-foreground";
  
  if (!mimeType) return <File className={iconClass} />;
  
  if (mimeType.startsWith('image/')) {
    return <Image className={iconClass} />;
  }
  if (mimeType.startsWith('video/')) {
    return <Video className={iconClass} />;
  }
  if (mimeType.includes('pdf')) {
    return <FileText className={iconClass} />;
  }
  
  return <File className={iconClass} />;
}


