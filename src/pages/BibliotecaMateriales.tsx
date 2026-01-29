/**
 * Biblioteca de Materiales
 * 
 * Standalone page for managing teacher materials library.
 * Teachers can upload, list, and archive their materials.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Upload, FileText, Search, Trash2, Loader2, FolderOpen, AlertTriangle, ExternalLink } from 'lucide-react';
import { useMaterialsList, useArchiveMaterial } from '@/hooks/useMaterials';
import { UploadMaterialDialog } from '@/components/materials';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getSignedUrl } from '@/services/materials';
import { toast } from '@/hooks/use-toast';

const BibliotecaMateriales: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
  const [openingMaterial, setOpeningMaterial] = useState<string | null>(null);

  // Query materials
  const { data: materials = [], isLoading, error } = useMaterialsList({
    orderBy: 'created_at',
    ascending: false,
  });

  // Archive mutation
  const archiveMutation = useArchiveMaterial();

  // Filter materials by search query
  const filteredMaterials = materials.filter((material) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      material.title.toLowerCase().includes(query) ||
      material.mime_type?.toLowerCase().includes(query)
    );
  });

  const handleArchiveMaterial = async () => {
    if (!materialToDelete) return;
    
    await archiveMutation.mutateAsync(materialToDelete);
    setMaterialToDelete(null);
  };

  const handleOpenMaterial = async (material: any) => {
    if (!material.storage_path) {
      toast({
        title: 'Error',
        description: 'No se puede abrir el material: ruta de almacenamiento faltante',
        variant: 'destructive',
      });
      return;
    }

    setOpeningMaterial(material.id);

    try {
      // Get signed URL for the file (valid for 1 hour)
      const result = await getSignedUrl(material.storage_path);

      if (!result.success || !result.signedUrl) {
        throw new Error(result.error || 'No se pudo obtener URL del archivo');
      }

      // Open in new tab
      window.open(result.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('[handleOpenMaterial] Error:', error);
      toast({
        title: 'Error al abrir material',
        description: error instanceof Error ? error.message : 'Ocurrió un error desconocido',
        variant: 'destructive',
      });
    } finally {
      setOpeningMaterial(null);
    }
  };

  const getMimeTypeLabel = (mimeType: string | null) => {
    if (!mimeType) return 'Archivo';
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('image')) return 'Imagen';
    if (mimeType.includes('video')) return 'Video';
    if (mimeType.includes('document') || mimeType.includes('word')) return 'Documento';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Hoja de cálculo';
    return 'Archivo';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Cargando biblioteca...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Error al cargar materiales</h3>
            <p className="text-muted-foreground mb-6">
              {error instanceof Error ? error.message : 'Ocurrió un error desconocido'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FolderOpen className="h-8 w-8" />
            Biblioteca de Materiales
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus materiales docentes. Sube PDFs, imágenes y otros recursos para usar en tus planificaciones y evaluaciones.
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)} size="lg">
          <Upload className="h-4 w-4 mr-2" />
          Subir Material
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título o tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Materials List */}
      {filteredMaterials.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              {searchQuery ? (
                <>
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No se encontraron materiales que coincidan con "{searchQuery}"</p>
                </>
              ) : (
                <>
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">No tienes materiales aún</p>
                  <p className="text-sm">Haz clic en "Subir Material" para comenzar</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMaterials.map((material) => (
            <Card 
              key={material.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleOpenMaterial(material)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {openingMaterial === material.id ? (
                      <Loader2 className="h-5 w-5 text-primary shrink-0 animate-spin" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                    )}
                    <CardTitle className="text-base truncate" title={material.title}>
                      {material.title}
                    </CardTitle>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMaterialToDelete(material.id);
                    }}
                    className="shrink-0 h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                    title="Archivar material"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {getMimeTypeLabel(material.mime_type)}
                  </Badge>
                  {material.extracted_text && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                      Texto extraído
                    </Badge>
                  )}
                  <span className="text-xs">
                    {formatDistanceToNow(new Date(material.created_at), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {material.metadata && typeof material.metadata === 'object' && (
                  <div className="space-y-1">
                    {/* Tags */}
                    {(material.metadata as any).tags && (
                      <div className="flex flex-wrap gap-1">
                        {((material.metadata as any).tags as string).split(',').map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag.trim()}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {/* Notes */}
                    {(material.metadata as any).notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {(material.metadata as any).notes}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <UploadMaterialDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={() => {
          setUploadDialogOpen(false);
        }}
      />

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!materialToDelete} onOpenChange={(open) => !open && setMaterialToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar material?</AlertDialogTitle>
            <AlertDialogDescription>
              El material será archivado y no aparecerá en la biblioteca.
              Esta acción se puede revertir contactando al administrador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveMaterial}
              disabled={archiveMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archiveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Archivando...
                </>
              ) : (
                'Archivar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BibliotecaMateriales;


