/**
 * Attach Materials Panel
 * 
 * Panel for managing material attachments to a target (session/plan/evaluation).
 * Shows current attachments and allows adding, editing focus_text, and removing.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, Plus, Edit2, Trash2, Loader2, AlertCircle } from 'lucide-react';
import {
  useAttachmentsByTarget,
  useAddAttachment,
  useUpdateAttachment,
  useRemoveAttachment
} from '@/hooks/useMaterialAttachments';
import { MaterialsLibraryDialog } from './MaterialsLibraryDialog';
import type { TargetType } from '@/services/materials';
import type { Database } from '@/integrations/supabase/types';

type TeacherMaterial = Database['public']['Tables']['teacher_materials']['Row'];
type MaterialAttachment = Database['public']['Tables']['material_attachments']['Row'];

interface AttachMaterialsPanelProps {
  targetType: TargetType;
  targetId: string | undefined;
  disabled?: boolean;
  disabledMessage?: string;
}

export function AttachMaterialsPanel({
  targetType,
  targetId,
  disabled = false,
  disabledMessage
}: AttachMaterialsPanelProps) {
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [focusTextDialogOpen, setFocusTextDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<TeacherMaterial[]>([]);
  const [currentFocusText, setCurrentFocusText] = useState('');
  const [editingAttachment, setEditingAttachment] = useState<MaterialAttachment | null>(null);
  const [deletingAttachment, setDeletingAttachment] = useState<MaterialAttachment | null>(null);

  const { data: attachments, isLoading } = useAttachmentsByTarget(
    targetType,
    targetId,
    { enabled: !!targetId && !disabled }
  );

  const addMutation = useAddAttachment();
  const updateMutation = useUpdateAttachment();
  const removeMutation = useRemoveAttachment();

  const handleSelectMaterials = (materials: TeacherMaterial[]) => {
    setSelectedMaterials(materials);
    setCurrentFocusText('');
    setFocusTextDialogOpen(true);
  };

  const handleConfirmAttach = async () => {
    if (!targetId) return;

    // Attach all selected materials with the same focus_text
    for (const material of selectedMaterials) {
      await addMutation.mutateAsync({
        material_id: material.id,
        target_type: targetType,
        target_id: targetId,
        focus_text: currentFocusText || null,
        priority: 0
      });
    }

    setFocusTextDialogOpen(false);
    setSelectedMaterials([]);
    setCurrentFocusText('');
  };

  const handleEditFocusText = (attachment: MaterialAttachment) => {
    setEditingAttachment(attachment);
    setCurrentFocusText(attachment.focus_text || '');
    setEditDialogOpen(true);
  };

  const handleConfirmEdit = async () => {
    if (!editingAttachment) return;

    await updateMutation.mutateAsync({
      id: editingAttachment.id,
      updates: {
        focus_text: currentFocusText || null
      }
    });

    setEditDialogOpen(false);
    setEditingAttachment(null);
    setCurrentFocusText('');
  };

  const handleDeleteAttachment = (attachment: MaterialAttachment) => {
    setDeletingAttachment(attachment);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAttachment) return;

    await removeMutation.mutateAsync({
      id: deletingAttachment.id,
      targetType,
      targetId: targetId!,
      materialId: deletingAttachment.material_id
    });

    setDeleteDialogOpen(false);
    setDeletingAttachment(null);
  };

  if (disabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Material Docente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{disabledMessage || 'No disponible en este momento'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Material Docente
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Adjunta materiales de apoyo para esta {targetType === 'sesion' ? 'sesión' : targetType === 'planificacion' ? 'planificación' : 'evaluación'}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLibraryDialogOpen(true)}
              disabled={!targetId}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adjuntar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : attachments && attachments.length > 0 ? (
            <div className="space-y-3">
              {attachments.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  onEdit={() => handleEditFocusText(attachment)}
                  onDelete={() => handleDeleteAttachment(attachment)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No hay materiales adjuntos. Haz clic en "Adjuntar" para agregar.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Library Dialog */}
      <MaterialsLibraryDialog
        open={libraryDialogOpen}
        onOpenChange={setLibraryDialogOpen}
        onSelect={handleSelectMaterials}
        multiSelect={true}
      />

      {/* Focus Text Dialog (for new attachments) */}
      <Dialog open={focusTextDialogOpen} onOpenChange={setFocusTextDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contexto del Material</DialogTitle>
            <DialogDescription>
              Agrega notas sobre cómo usarás {selectedMaterials.length > 1 ? 'estos materiales' : 'este material'} en esta {targetType === 'sesion' ? 'sesión' : targetType === 'planificacion' ? 'planificación' : 'evaluación'} (opcional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Materiales seleccionados:</Label>
              <div className="space-y-1">
                {selectedMaterials.map((material) => (
                  <div key={material.id} className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{material.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="focus-text">Notas de uso (opcional)</Label>
              <Textarea
                id="focus-text"
                value={currentFocusText}
                onChange={(e) => setCurrentFocusText(e.target.value)}
                placeholder="Ej: Para la actividad de inicio, revisar páginas 3-5"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFocusTextDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmAttach} disabled={addMutation.isPending}>
              {addMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adjuntando...
                </>
              ) : (
                'Adjuntar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Focus Text Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Notas de Uso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingAttachment && (
              <div className="text-sm text-muted-foreground">
                Material: {(editingAttachment as any).material?.title || 'Material'}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-focus-text">Notas de uso</Label>
              <Textarea
                id="edit-focus-text"
                value={currentFocusText}
                onChange={(e) => setCurrentFocusText(e.target.value)}
                placeholder="Ej: Para la actividad de inicio, revisar páginas 3-5"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar adjunto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará el adjunto de esta {targetType === 'sesion' ? 'sesión' : targetType === 'planificacion' ? 'planificación' : 'evaluación'}. El material seguirá en tu biblioteca.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={removeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Attachment Card Component
interface AttachmentCardProps {
  attachment: MaterialAttachment & { material?: any };
  onEdit: () => void;
  onDelete: () => void;
}

function AttachmentCard({ attachment, onEdit, onDelete }: AttachmentCardProps) {
  const material = attachment.material;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">
          {material?.title || 'Material'}
        </div>
        {attachment.focus_text && (
          <div className="text-xs text-muted-foreground mt-1">
            {attachment.focus_text}
          </div>
        )}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          className="h-7 w-7 p-0"
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

