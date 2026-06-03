import { Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { CatalogItemForPlanning, ProgramaUnidad } from '@/types/annualProgram';

type Props = {
  unit: ProgramaUnidad;
  index: number;
  catalogItems: CatalogItemForPlanning[];
  readOnly?: boolean;
  onChange: (unit: ProgramaUnidad) => void;
  onDelete: () => void;
  onToggleCatalogItem: (itemId: string) => void;
};

export function ProgramUnitCard({
  unit,
  index,
  catalogItems,
  readOnly,
  onChange,
  onDelete,
  onToggleCatalogItem,
}: Props) {
  const contenidoItems = catalogItems.filter((c) =>
    ['contenido', 'progresion', 'learning_objective'].includes(c.tipo)
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-base">Unidad {index + 1}</CardTitle>
          </div>
          {!readOnly && (
            <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label="Eliminar unidad">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={unit.nombre}
              disabled={readOnly}
              onChange={(e) => onChange({ ...unit, nombre: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Clases estimadas</Label>
            <Input
              type="number"
              min={1}
              value={unit.clases_estimadas}
              disabled={readOnly}
              onChange={(e) =>
                onChange({ ...unit, clases_estimadas: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Descripción</Label>
          <Textarea
            rows={2}
            value={unit.descripcion ?? ''}
            disabled={readOnly}
            onChange={(e) => onChange({ ...unit, descripcion: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Contenidos del catálogo (Módulo 1)</Label>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto border rounded-md p-2">
            {contenidoItems.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin ítems de contenido en el catálogo para esta materia.</p>
            )}
            {contenidoItems.map((item) => {
              const selected = unit.catalog_item_ids.includes(item.id);
              return (
                <Badge
                  key={item.id}
                  variant={selected ? 'default' : 'outline'}
                  className={readOnly ? '' : 'cursor-pointer'}
                  onClick={() => !readOnly && onToggleCatalogItem(item.id)}
                >
                  {item.codigo ? `${item.codigo}: ` : ''}
                  {item.nombre}
                </Badge>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
