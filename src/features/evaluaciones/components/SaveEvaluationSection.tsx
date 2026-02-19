/**
 * Save evaluation UI: button to open dialog + dialog (name input, cancel/save).
 * No Supabase insert; parent provides onSaveRequest and owns save logic.
 */

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RefreshCw } from "lucide-react";

export interface SaveEvaluationSectionProps {
  saveDialogOpen: boolean;
  onSaveDialogOpenChange: (open: boolean) => void;
  nombreEvaluacion: string;
  onNombreEvaluacionChange: (value: string) => void;
  isSaving: boolean;
  onSaveRequest: () => void;
  onOpenSaveDialog: () => void;
}

export function SaveEvaluationSection({
  saveDialogOpen,
  onSaveDialogOpenChange,
  nombreEvaluacion,
  onNombreEvaluacionChange,
  isSaving,
  onSaveRequest,
  onOpenSaveDialog
}: SaveEvaluationSectionProps) {
  return (
    <>
      <Button
        onClick={onOpenSaveDialog}
        variant="default"
        className="gap-2"
      >
        <Save className="w-4 h-4" />
        Guardar evaluación
      </Button>

      <Dialog open={saveDialogOpen} onOpenChange={onSaveDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar Evaluación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nombre">Nombre de la evaluación</Label>
              <Input
                id="nombre"
                value={nombreEvaluacion}
                onChange={(e) => onNombreEvaluacionChange(e.target.value)}
                placeholder="Ej: Evaluación Historia - 9no 1"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este nombre aparecerá en "Mis Evaluaciones"
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => onSaveDialogOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={onSaveRequest}
              disabled={isSaving || !nombreEvaluacion.trim()}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
