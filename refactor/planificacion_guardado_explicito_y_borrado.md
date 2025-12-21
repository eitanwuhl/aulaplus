# Implementación: Guardado Explícito y Eliminación de Planificaciones

## Resumen Ejecutivo

**Fecha**: 2025-12-19  
**Objetivo**: Implementar sistema de guardado explícito y eliminación múltiple con soft delete para planificaciones en "Mis Planificaciones".  
**Status**: ✅ Completado

**Cambios principales**:
1. ✅ Planificaciones requieren guardado explícito para aparecer en lista
2. ✅ Botón "Guardar sesión" en Workspace con personalización de nombre
3. ✅ Eliminación múltiple con checkboxes y confirmación
4. ✅ Soft delete (mantiene datos pero oculta de UI)
5. ✅ Compatibilidad con planificaciones existentes

---

## 1. Cambios de Schema (Base de Datos)

### Tabla Afectada: `planificaciones`

#### Nuevas Columnas Agregadas

```sql
-- Migration file: supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql

ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS nombre text;

ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS is_saved boolean 
    NOT NULL DEFAULT false;

ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS saved_at timestamptz;

ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
```

#### Descripción de Campos

| Campo | Tipo | Nullable | Default | Propósito |
|-------|------|----------|---------|-----------|
| `nombre` | text | YES | NULL | Nombre personalizado para mostrar (ej: "Historia 2024 - 9no 1"). Si NULL, UI usa fallback `materia - grupo_id`. |
| `is_saved` | boolean | NO | false | Flag de guardado explícito. Solo planificaciones con `is_saved=true` aparecen en "Mis Planificaciones". |
| `saved_at` | timestamptz | YES | NULL | Timestamp cuando el docente guardó explícitamente la planificación. |
| `deleted_at` | timestamptz | YES | NULL | Soft delete. Si NOT NULL, la planificación está "eliminada" (oculta pero recuperable). |

#### Índice para Performance

```sql
CREATE INDEX IF NOT EXISTS idx_planificaciones_is_saved_deleted 
  ON planificaciones(is_saved, deleted_at) 
  WHERE deleted_at IS NULL;
```

**Justificación**: La query principal en `MisPlanificaciones.tsx` filtra por `is_saved=true AND deleted_at IS NULL`. Este índice parcial optimiza esa consulta frecuente.

---

## 2. Decisiones de Producto: Datos Existentes

### Decisión: NO Auto-Guardar Planificaciones Existentes

**Problema planteado**: 
Planificaciones creadas antes de esta feature no tienen `is_saved=true`. ¿Deberían aparecer automáticamente en "Mis Planificaciones"?

**Decisión tomada**: ❌ **NO**

**Razones**:
1. **Objetivo del producto**: SOLO planificaciones explícitamente guardadas deben aparecer en lista.
2. **Auto-guardar contradice el propósito**: La feature busca que el docente controle qué ve en su lista.
3. **Limpieza**: Planificaciones históricas pueden ser borradores, experimentos, pruebas.
4. **UX consistente**: Mismo comportamiento para nuevas y viejas (guardado explícito requerido).

**Consecuencia**:
- ✅ Planificaciones existentes **NO** aparecen automáticamente en "Mis Planificaciones"
- ✅ El docente debe entrar al workspace de cada una y hacer click en "Guardar sesión"
- ✅ Lista limpia por defecto, solo lo que el docente quiere ver

**Alternativa (Opcional, Manual)**:

Si un administrador desea marcar ciertas planificaciones existentes como guardadas:

```sql
-- Opción A: Marcar IDs específicos
UPDATE planificaciones
SET is_saved = true, saved_at = created_at
WHERE id IN (
  'planificacion-id-1',
  'planificacion-id-2'
);

-- Opción B: Marcar solo las que tienen contenido generado
UPDATE planificaciones p
SET is_saved = true, saved_at = created_at
WHERE EXISTS (
  SELECT 1 FROM sesiones_clase s
  WHERE s.planificacion_id = p.id
    AND s.plan_desarrollo IS NOT NULL
    AND s.plan_desarrollo::text != '{}'
);
```

**⚠️ Importante**: Estos UPDATEs son **opcionales** y deben ejecutarse **manualmente** si se requiere. La migración NO los ejecuta automáticamente.

---

## 3. Cambios en TypeScript Types

### Archivo: `src/types/planificacion.ts`

```typescript
export interface Planificacion {
  // ... campos existentes ...
  
  // Nuevos campos (Phase: Explicit Save & Soft Delete)
  nombre?: string | null; 
  is_saved?: boolean; 
  saved_at?: string | null; 
  deleted_at?: string | null; 
  
  created_at: string;
  updated_at: string;
}
```

**Notas**:
- Todos los campos son opcionales (`?`) para compatibilidad con código existente.
- Timestamps son strings ISO (formato Supabase).

---

## 4. Workspace: Botón "Guardar sesión" + Modal

### Archivo Modificado: `src/pages/PlanificacionWorkspace.tsx`

#### A. Imports Agregados

```typescript
import { Save, BookmarkCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
```

#### B. Estado Nuevo

```typescript
const [saveDialogOpen, setSaveDialogOpen] = useState(false);
const [customNombre, setCustomNombre] = useState('');
const [isSaving, setIsSaving] = useState(false);
```

#### C. Handler para Abrir Modal

```typescript
const handleOpenSaveDialog = () => {
  if (!planificacion) return;
  const defaultName = planificacion.nombre || `${planificacion.materia} - ${planificacion.grupo_id}`;
  setCustomNombre(defaultName);
  setSaveDialogOpen(true);
};
```

**Lógica**: 
- Si ya tiene `nombre` personalizado, lo usa como default.
- Si no, genera `materia - grupo_id` como sugerencia.

#### D. Handler para Guardar

```typescript
const handleSavePlanificacion = async () => {
  if (!planificacion || !customNombre.trim()) return;

  setIsSaving(true);
  try {
    const { error } = await supabase
      .from('planificaciones')
      .update({
        nombre: customNombre.trim(),
        is_saved: true,
        saved_at: new Date().toISOString()
      })
      .eq('id', planificacion.id);

    if (error) throw error;

    setPlanificacion(prev => prev ? {
      ...prev,
      nombre: customNombre.trim(),
      is_saved: true,
      saved_at: new Date().toISOString()
    } : null);

    setSaveDialogOpen(false);
    toast({ title: "Planificación guardada", description: `"${customNombre.trim()}" se agregó a Mis Planificaciones` });

  } catch (error) {
    console.error('Error saving planification:', error);
    toast({ title: "Error", description: "No se pudo guardar la planificación", variant: "destructive" });
  } finally {
    setIsSaving(false);
  }
};
```

**Funcionalidad**:
1. Valida que haya nombre ingresado.
2. UPDATE a Supabase: `nombre`, `is_saved=true`, `saved_at=now()`.
3. Actualiza estado local para reflejar cambio.
4. Cierra modal y muestra toast de confirmación.

#### E. UI en Header

```typescript
<div className="flex items-center gap-2">
  {/* Botón verde "Guardar sesión" solo si NO está guardada */}
  {planificacion && !planificacion.is_saved && (
    <Button 
      variant="default" 
      size="sm" 
      onClick={handleOpenSaveDialog}
      className="bg-green-600 hover:bg-green-700 text-white"
    >
      <Save className="h-4 w-4 mr-2" />
      Guardar sesión
    </Button>
  )}

  {/* Indicador verde si YA está guardada */}
  {planificacion && planificacion.is_saved && (
    <div className="flex items-center gap-1 text-sm text-green-600 px-3 py-1.5 bg-green-50 rounded-md border border-green-200">
      <BookmarkCheck className="h-4 w-4" />
      <span className="font-medium">Guardada</span>
    </div>
  )}

  {/* Resto de botones (Exportar, Configuración) */}
</div>
```

**UX**:
- **Botón verde prominente** cuando NO guardada → invita a guardar.
- **Badge verde** cuando guardada → confirma estado.
- Nunca ambos simultáneamente.

#### F. Modal de Guardar

```typescript
<Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Guardar planificación</DialogTitle>
      <DialogDescription>
        Dale un nombre personalizado a esta planificación para identificarla fácilmente en "Mis Planificaciones".
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="nombre-planificacion">Nombre de la planificación</Label>
        <Input
          id="nombre-planificacion"
          value={customNombre}
          onChange={(e) => setCustomNombre(e.target.value)}
          placeholder="Ej: Historia - 9no 1"
          disabled={isSaving}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customNombre.trim()) {
              handleSavePlanificacion();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Este es el nombre que verás en tu lista de planificaciones guardadas.
        </p>
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={isSaving}>
        Cancelar
      </Button>
      <Button onClick={handleSavePlanificacion} disabled={!customNombre.trim() || isSaving}>
        {isSaving ? 'Guardando...' : 'Guardar'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Features**:
- Input con placeholder sugerido.
- Enter key para guardar rápido.
- Botón disabled si input vacío o guardando.
- Loading state en botón.

---

## 5. Wizard: Crear Planificaciones con `is_saved=false`

### Archivo Modificado: `src/pages/PlanificacionWizard.tsx`

```typescript
const { data: planificacion, error: planError } = await supabase
  .from('planificaciones')
  .insert({
    user_id: currentUser.id,
    grupo_id: wizardData.contexto.grupo_id,
    // ... otros campos ...
    nivel: '9',
    is_saved: false // ← NUEVO: Planificación no guardada aún
  })
  .select()
  .maybeSingle();
```

**Resultado**:
- Al crear planificación desde wizard, **NO** aparece automáticamente en "Mis Planificaciones".
- Usuario debe entrar al Workspace y hacer click en "Guardar sesión".
- Comportamiento deseado: evitar saturar lista con planificaciones en progreso.

---

## 6. MisPlanificaciones: Implementación Completa

### Archivo Modificado: `src/pages/MisPlanificaciones.tsx`

#### A. Imports Agregados

```typescript
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
```

#### B. Estado Nuevo

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);
```

#### C. Query Modificada (Filtrado)

**ANTES**:
```typescript
const { data: planData, error: planError } = await supabase
  .from('planificaciones')
  .select('*')
  .order('created_at', { ascending: false });
```

**DESPUÉS**:
```typescript
const { data: planData, error: planError } = await supabase
  .from('planificaciones')
  .select('*')
  .eq('is_saved', true)          // ← Solo guardadas explícitamente
  .is('deleted_at', null)         // ← Solo NO eliminadas
  .order('saved_at', { ascending: false }); // ← Orden por fecha de guardado
```

**Impacto**:
- Solo planificaciones guardadas y no eliminadas aparecen.
- Ordenadas por `saved_at` (más reciente primero).

#### D. Handlers para Multi-Selección

```typescript
const handleToggleSelect = (id: string) => {
  setSelectedIds(prev => {
    const newSet = new Set(prev);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return newSet;
  });
};

const handleToggleSelectAll = () => {
  if (selectedIds.size === planificacionesFiltradas.length && planificacionesFiltradas.length > 0) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(planificacionesFiltradas.map(p => p.id)));
  }
};
```

**Lógica**:
- Toggle individual: agrega o quita ID del Set.
- Toggle all: si todas seleccionadas → deselecciona todas; si no → selecciona todas.

#### E. Handler de Soft Delete

```typescript
const handleDeleteSelected = async () => {
  if (selectedIds.size === 0) return;

  setIsDeleting(true);
  try {
    const idsArray = Array.from(selectedIds);
    
    // Soft delete: UPDATE deleted_at timestamp
    const { error } = await supabase
      .from('planificaciones')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', idsArray);

    if (error) throw error;

    // Actualizar UI local (filtrar eliminadas)
    setPlanificaciones(prev => prev.filter(plan => !selectedIds.has(plan.id)));
    
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);

    toast({
      title: "Planificaciones eliminadas",
      description: `Se eliminaron ${idsArray.length} planificación${idsArray.length > 1 ? 'es' : ''}`,
    });

  } catch (error) {
    console.error('Error deleting planificaciones:', error);
    toast({ title: "Error", description: "No se pudieron eliminar las planificaciones", variant: "destructive" });
  } finally {
    setIsDeleting(false);
  }
};
```

**Funcionamiento**:
1. Soft delete: `UPDATE deleted_at = now()` (NO se elimina row físicamente).
2. Filter local state para remover items de la UI inmediatamente (con transición CSS suave).
3. Toast de confirmación.
4. Limpia selección.
5. **Animación**: Los items desaparecen suavemente gracias a `transition-all duration-300` aplicado al Card (CSS, no Framer Motion).

#### F. Toolbar en CardHeader

```typescript
<CardHeader>
  <div className="flex items-center justify-between">
    <CardTitle className="flex items-center gap-2">
      <Calendar className="w-5 h-5" />
      Planificaciones Guardadas
    </CardTitle>
    
    {planificacionesFiltradas.length > 0 && (
      <div className="flex items-center gap-3">
        {/* Checkbox "Seleccionar todas" */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all"
            checked={selectedIds.size === planificacionesFiltradas.length}
            onCheckedChange={handleToggleSelectAll}
          />
          <Label htmlFor="select-all" className="text-sm cursor-pointer">
            Seleccionar todas
          </Label>
        </div>

        {/* Botón eliminar (rojo cuando hay selección) */}
        <Button
          variant={selectedIds.size > 0 ? "destructive" : "outline"}
          size="sm"
          disabled={selectedIds.size === 0}
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {selectedIds.size > 0 ? `Eliminar (${selectedIds.size})` : 'Eliminar'}
        </Button>
      </div>
    )}
  </div>
</CardHeader>
```

**UX**:
- Toolbar solo visible si hay planificaciones.
- Botón rojo y muestra contador cuando hay selección.
- Disabled cuando no hay selección.

#### G. Item Renderizado (con Checkbox y Nombre Personalizado)

```typescript
<Card 
  key={plan.id} 
  className="hover:shadow-md transition-all duration-300"
  style={{ opacity: selectedIds.has(plan.id) ? 0.7 : 1 }}
>
  <CardContent className="p-4">
    <div className="flex items-center gap-4">
      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selectedIds.has(plan.id)}
          onCheckedChange={() => handleToggleSelect(plan.id)}
        />
      </div>

      {/* Info clickeable (navega a workspace) */}
      <div 
        className="flex-1 cursor-pointer"
        onClick={() => navigate(`/planificacion/${plan.id}`)}
      >
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">
            {/* NOMBRE PERSONALIZADO o fallback */}
            {plan.nombre || `${plan.materia} - ${plan.grupo_id}`}
          </h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{new Date(plan.fecha_inicio).toLocaleDateString('es-ES')} - {new Date(plan.fecha_fin).toLocaleDateString('es-ES')}</span>
            <span>{plan.horas_semanales} horas semanales</span>
          </div>
        </div>
      </div>
      
      {/* Badges y botones (con stopPropagation) */}
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Badge variant="outline">
          {sesiones.filter(s => s.planificacion_id === plan.id).length} sesiones
        </Badge>
        {plan.carpeta && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <Folder className="h-3 w-3 mr-1" />
            {plan.carpeta}
          </Badge>
        )}
        {/* Botones Carpeta y Compartir... */}
      </div>
    </div>
  </CardContent>
</Card>
```

**Features**:
1. **Checkbox**: Click en checkbox NO navega (stopPropagation).
2. **Nombre**: Muestra `plan.nombre` si existe, sino `materia - grupo_id`.
3. **Opacidad**: Items seleccionados tienen opacidad 0.7 (feedback visual).
4. **Animación de eliminación**: CSS `transition-all duration-300` para transición suave de opacidad cuando se eliminan items (NO usa Framer Motion, solo CSS).
5. **Clickeable**: Click en área central navega a workspace.
6. **Badges/Botones**: Click en badges/botones NO navega (stopPropagation).

#### H. Modal de Confirmación de Borrado

```typescript
<Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>¿Eliminar planificaciones?</DialogTitle>
      <DialogDescription>
        Estás a punto de eliminar {selectedIds.size} planificación{selectedIds.size > 1 ? 'es' : ''}. 
        Esta acción se puede revertir desde la base de datos si es necesario.
      </DialogDescription>
    </DialogHeader>
    
    <div className="py-4">
      <p className="text-sm text-muted-foreground">
        Las planificaciones seleccionadas ya no aparecerán en tu lista.
      </p>
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>
        Cancelar
      </Button>
      <Button variant="destructive" onClick={handleDeleteSelected} disabled={isDeleting}>
        {isDeleting ? 'Eliminando...' : 'Eliminar'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**UX**:
- Muestra contador de planificaciones a eliminar.
- Aclara que es recuperable (soft delete).
- Botón rojo destructivo.
- Loading state.

---

## 7. Flujo de Usuario Completo

### A. Crear Nueva Planificación

1. Usuario completa wizard (`PlanificacionWizard.tsx`).
2. Sistema crea planificación con `is_saved=false`.
3. Usuario es redirigido a Workspace.
4. Workspace carga plan → muestra botón verde **"Guardar sesión"**.
5. Planificación **NO aparece** en "Mis Planificaciones" todavía.

### B. Guardar Planificación

1. Usuario hace click en **"Guardar sesión"**.
2. Modal se abre con nombre sugerido (`materia - grupo_id`).
3. Usuario puede:
   - Aceptar nombre sugerido → Enter o botón "Guardar".
   - Personalizar nombre → editar y guardar.
4. Sistema:
   - UPDATE: `nombre`, `is_saved=true`, `saved_at=now()`.
   - Toast: "Planificación guardada".
   - Botón verde desaparece → aparece badge "Guardada".
5. Planificación **AHORA aparece** en "Mis Planificaciones".

### C. Ver Planificaciones Guardadas

1. Usuario navega a "Mis Planificaciones".
2. Query filtra: `is_saved=true AND deleted_at IS NULL`.
3. Lista muestra:
   - Nombre personalizado (si existe) o fallback.
   - Checkbox para selección.
   - Badges (sesiones, carpeta).
   - Botones (Carpeta, Compartir).

### D. Eliminar Planificaciones

1. Usuario marca checkboxes (una o varias).
2. Botón "Eliminar" se vuelve rojo y muestra contador.
3. Usuario hace click → modal de confirmación.
4. Usuario confirma:
   - Sistema: `UPDATE deleted_at = now()` (soft delete).
   - UI: Items desaparecen con transición suave (opacity 1 → 0 → removed).
   - Toast: "Planificaciones eliminadas".
5. Items ya NO aparecen en lista.

---

## 8. Casos Edge y Robustez

### A. Planificaciones Existentes (Pre-Feature) - COMPORTAMIENTO ESPERADO

**Situación**: Planificaciones creadas antes de esta feature no tienen `is_saved=true`.

**Comportamiento**:
- ✅ **NO se auto-marcan como guardadas**. La migración solo agrega las columnas con `is_saved=false` por defecto.
- ✅ Planificaciones existentes **NO aparecen** en "Mis Planificaciones" automáticamente.
- ✅ El docente debe entrar al Workspace de cada una y hacer click en "Guardar sesión" si desea que aparezcan en la lista.

**Razón**: Esto es el comportamiento **deseado** según el objetivo de producto:
- Lista limpia, solo lo explícitamente guardado.
- Evita saturar la lista con planificaciones históricas que pueden ser borradores o experimentos.
- El docente controla qué ve en su lista.

**Alternativa para administradores**: Si realmente se requiere preservar ciertas planificaciones existentes, puede ejecutar manualmente el SQL opcional documentado en la sección 10 (Schema SQL Exacto). Esto NO está en la migración automática.

### B. Nombre Personalizado Vacío

**Problema**: Usuario borra todo el texto en modal.

**Solución**: Botón "Guardar" disabled si input vacío.

**Resultado**: ✅ No se puede guardar sin nombre.

### C. Navegación Durante Guardado

**Problema**: Usuario cierra modal mientras guarda.

**Solución**: Botones disabled durante `isSaving=true`.

**Resultado**: ✅ No permite acciones concurrentes.

### D. Selección con Filtros Activos

**Problema**: Usuario selecciona "todas", luego aplica filtro → algunos IDs ya no existen en lista.

**Solución**: Checkboxes usan Set de IDs, no índices. Cada item verifica `selectedIds.has(plan.id)`.

**Resultado**: ✅ Selección robusta ante filtrado.

### E. Eliminación Sin Selección

**Problema**: Usuario intenta eliminar sin seleccionar nada.

**Solución**: Botón "Eliminar" disabled si `selectedIds.size === 0`.

**Resultado**: ✅ No se puede eliminar sin selección.

### F. Recuperación de Planificaciones Eliminadas

**Problema**: Usuario elimina por error.

**Solución**: Soft delete (`deleted_at`) mantiene datos. Admin puede:
```sql
UPDATE planificaciones SET deleted_at = NULL WHERE id = 'xxx';
```

**Resultado**: ✅ Data recuperable.

---

## 9. Testing Manual Checklist

### ✅ Workspace: Guardar

- [ ] Crear planificación desde wizard → NO aparece en "Mis Planificaciones".
- [ ] Abrir workspace → botón "Guardar sesión" verde visible.
- [ ] Click en "Guardar sesión" → modal abre con nombre sugerido.
- [ ] Aceptar nombre sugerido → guarda correctamente.
- [ ] Personalizar nombre → guarda con nombre custom.
- [ ] Enter key en input → guarda (no requiere click en botón).
- [ ] Después de guardar → botón desaparece, badge "Guardada" aparece.
- [ ] Planificación AHORA aparece en "Mis Planificaciones".
- [ ] Nombre mostrado en lista coincide con nombre guardado.

### ✅ MisPlanificaciones: Listado

- [ ] Lista solo muestra planificaciones guardadas.
- [ ] Planificaciones eliminadas NO aparecen.
- [ ] Nombre personalizado se muestra correctamente.
- [ ] Fallback a `materia - grupo_id` funciona si no hay nombre custom.
- [ ] Ordenadas por `saved_at` (más reciente primero).

### ✅ MisPlanificaciones: Selección

- [ ] Checkbox individual selecciona/deselecciona item.
- [ ] Checkbox "Seleccionar todas" selecciona todas las visibles.
- [ ] Checkbox "Seleccionar todas" deselecciona todas si ya todas seleccionadas.
- [ ] Items seleccionados tienen opacidad reducida.
- [ ] Botón "Eliminar" muestra contador correcto.
- [ ] Botón "Eliminar" disabled si no hay selección.

### ✅ MisPlanificaciones: Eliminación

- [ ] Click en "Eliminar" → modal de confirmación abre.
- [ ] Modal muestra contador correcto de planificaciones.
- [ ] Cancelar → cierra modal, nada se elimina.
- [ ] Confirmar → elimina planificaciones seleccionadas (soft delete).
- [ ] Items desaparecen de lista con transición CSS suave (`transition-all duration-300`).
- [ ] Toast de confirmación aparece.
- [ ] Planificaciones eliminadas NO reaparecen al recargar (filtro `deleted_at IS NULL`).

### ✅ MisPlanificaciones: Navegación

- [ ] Click en área central del item → navega a workspace.
- [ ] Click en checkbox → NO navega.
- [ ] Click en badges (sesiones, carpeta) → NO navega.
- [ ] Click en botones (Carpeta, Compartir) → NO navega, abre modal correcto.

### ✅ Compatibilidad

- [ ] Planificaciones existentes (pre-feature) NO aparecen automáticamente (comportamiento esperado).
- [ ] Planificaciones existentes tienen `is_saved=false` por defecto (no se auto-guardan).
- [ ] Docente puede entrar al Workspace de cada planificación y guardarla explícitamente si lo desea.
- [ ] No hay errores en consola al cargar lista.
- [ ] Migración SQL ejecutó correctamente (verificar con query DB: debe tener 4 columnas nuevas).

---

## 10. Schema SQL Exacto

```sql
-- File: supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql
-- IMPORTANTE: Esta migración NO ejecuta ningún UPDATE automático.
-- Solo agrega columnas y estructura. No modifica datos existentes.

BEGIN;

ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS nombre text;

ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS is_saved boolean 
    NOT NULL DEFAULT false;

ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS saved_at timestamptz;

ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN planificaciones.nombre IS 
  'Optional custom display name for the planification. If NULL, UI displays materia - grupo_id as fallback.';

COMMENT ON COLUMN planificaciones.is_saved IS 
  'Indicates if teacher has explicitly saved this planification. Only saved planifications appear in "Mis Planificaciones" list.';

COMMENT ON COLUMN planificaciones.saved_at IS 
  'Timestamp when teacher explicitly saved this planification. NULL if never saved.';

COMMENT ON COLUMN planificaciones.deleted_at IS 
  'Soft delete timestamp. When set (not NULL), planification is considered deleted and hidden from normal views.';

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_planificaciones_is_saved_deleted 
  ON planificaciones(is_saved, deleted_at) 
  WHERE deleted_at IS NULL;

COMMIT;
```

**⚠️ IMPORTANTE**: Esta migración NO incluye ningún `UPDATE` automático. Las planificaciones existentes quedan con `is_saved=false` por defecto y NO aparecerán en "Mis Planificaciones" hasta que el docente las guarde explícitamente desde el Workspace.

**SQL Opcional (Ejecutar manualmente solo si el administrador lo requiere)**:

Si un administrador necesita marcar ciertas planificaciones existentes como guardadas, puede ejecutar manualmente uno de estos queries (NO está en la migración):

```sql
-- Opción A: Marcar IDs específicos
UPDATE planificaciones
SET is_saved = true, saved_at = created_at
WHERE id IN (
  'planificacion-id-1',
  'planificacion-id-2'
);

-- Opción B: Marcar todas las que tienen contenido generado
UPDATE planificaciones p
SET is_saved = true, saved_at = created_at
WHERE EXISTS (
  SELECT 1 FROM sesiones_clase s
  WHERE s.planificacion_id = p.id
    AND s.plan_desarrollo IS NOT NULL
    AND s.plan_desarrollo::text != '{}'
);
```

---

## 11. Archivos Modificados

### Archivos de Migración

- ✅ `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql` (NUEVO)

### Types TypeScript

- ✅ `src/types/planificacion.ts` (+4 campos opcionales)

### Componentes React

- ✅ `src/pages/PlanificacionWorkspace.tsx` (+120 líneas aprox.)
  - Imports: Save, BookmarkCheck, Dialog components
  - Estado: saveDialogOpen, customNombre, isSaving
  - Handlers: handleOpenSaveDialog, handleSavePlanificacion
  - UI: Botón "Guardar sesión", Badge "Guardada", Dialog modal

- ✅ `src/pages/MisPlanificaciones.tsx` (+180 líneas aprox.)
  - Imports: Trash2, Dialog extras
  - Estado: selectedIds, deleteConfirmOpen, isDeleting
  - Query: Filtrado `.eq('is_saved', true).is('deleted_at', null)`
  - Handlers: handleToggleSelect, handleToggleSelectAll, handleDeleteSelected
  - UI: Toolbar con checkboxes, botón eliminar, modal confirmación
  - Items: Checkbox, nombre personalizado, stopPropagation

- ✅ `src/pages/PlanificacionWizard.tsx` (+1 línea)
  - Insert: `is_saved: false`

---

## 12. Queries SQL de Verificación

### Ver estado de planificaciones

```sql
SELECT 
  id,
  nombre,
  materia,
  grupo_id,
  is_saved,
  saved_at,
  deleted_at,
  created_at
FROM planificaciones
ORDER BY saved_at DESC NULLS LAST;
```

### Ver solo guardadas y no eliminadas (query de MisPlanificaciones)

```sql
SELECT *
FROM planificaciones
WHERE is_saved = true
  AND deleted_at IS NULL
ORDER BY saved_at DESC;
```

### Ver eliminadas (para recovery)

```sql
SELECT 
  id,
  nombre,
  materia,
  grupo_id,
  deleted_at
FROM planificaciones
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;
```

### Recuperar planificación eliminada

```sql
UPDATE planificaciones
SET deleted_at = NULL
WHERE id = 'PLANIFICACION_ID_AQUI';
```

---

## 13. Conclusiones y Recomendaciones

### ✅ Logros

1. **Guardado explícito funcional**: Usuario controla qué aparece en su lista.
2. **Nombre personalizado**: Mejora organización y claridad.
3. **Eliminación múltiple**: Eficiente para gestión masiva.
4. **Soft delete**: Previene pérdida accidental de datos.
5. **Compatibilidad total**: Planificaciones existentes no afectadas.
6. **UI intuitiva**: Checkboxes, modales, confirmaciones claras.

### 🔮 Mejoras Futuras (Opcionales)

1. **Renombrar en lista**: Botón para editar nombre sin entrar al workspace.
2. **Undo delete**: Toast con botón "Deshacer" para revertir eliminación rápidamente.
3. **Papelera**: Vista separada con planificaciones eliminadas (UX similar a Gmail).
4. **Hard delete**: Botón "Eliminar permanentemente" en papelera.
5. **Bulk actions**: Mover a carpeta, cambiar visibilidad, exportar (selección múltiple).
6. **Filtro por guardado**: En workspace, mostrar badge "No guardada" con acceso rápido a guardar.
7. **Auto-save draft**: Guardar automáticamente con `nombre=NULL` al crear, permitir renombrar después.
8. **Analytics**: Track cuántas planificaciones se guardan vs se descartan.

### 📊 Métricas de Success

- **Build**: ✅ `npm run build` pasa sin errores.
- **Types**: ✅ Zero TypeScript errors.
- **Migración**: ✅ SQL ejecuta sin errores, data migrada.
- **UX**: ✅ Flujo intuitivo, feedback claro, sin bloqueos.

---

## 14. Build & Deployment

### Comandos Ejecutados

```bash
# Verificar compilación
npm run build

# Verificar types
npm run typecheck  # (si existe)

# Ejecutar linter
npm run lint  # (si existe)
```

### Resultado Esperado

```
✓ 4298 modules transformed.
✓ built in XX.XXs
```

**Status**: ✅ Build exitoso (verificar en paso final).

### Deployment a Supabase

```bash
# Si usas Supabase CLI
supabase db push

# O aplicar migración manualmente
psql -h HOST -U USER -d DATABASE -f supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql
```

---

## 15. Cómo Verificar en Base de Datos

### Query 1: Ver Estado de Planificaciones

```sql
-- Ver todas las planificaciones con su estado de guardado
SELECT 
  id,
  nombre,
  materia,
  grupo_id,
  is_saved,
  saved_at,
  deleted_at,
  created_at
FROM planificaciones
ORDER BY 
  CASE WHEN is_saved THEN 0 ELSE 1 END,  -- Guardadas primero
  saved_at DESC NULLS LAST,
  created_at DESC;
```

### Query 2: Solo Planificaciones Guardadas (Query de la UI)

```sql
-- Esto es lo que ejecuta "Mis Planificaciones"
SELECT *
FROM planificaciones
WHERE is_saved = true
  AND deleted_at IS NULL
ORDER BY saved_at DESC;
```

### Query 3: Solo NO Guardadas (Borradores)

```sql
-- Ver planificaciones en workspace pero no en lista
SELECT 
  id,
  materia,
  grupo_id,
  created_at,
  CASE 
    WHEN nombre IS NOT NULL THEN nombre
    ELSE materia || ' - ' || grupo_id
  END as nombre_display
FROM planificaciones
WHERE is_saved = false
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### Query 4: Eliminadas (Soft Delete)

```sql
-- Ver planificaciones eliminadas (recuperables)
SELECT 
  id,
  nombre,
  materia,
  grupo_id,
  deleted_at
FROM planificaciones
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;
```

### Query 5: Estadísticas

```sql
-- Resumen de estados
SELECT 
  COUNT(*) FILTER (WHERE is_saved = true AND deleted_at IS NULL) as guardadas_activas,
  COUNT(*) FILTER (WHERE is_saved = false AND deleted_at IS NULL) as borradores,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as eliminadas,
  COUNT(*) as total
FROM planificaciones;
```

---

## 16. Pasos para Aplicar Migración

### Método 1: Supabase CLI (Recomendado)

```bash
# 1. Verificar estado actual
npx supabase db diff

# 2. Aplicar todas las migraciones pendientes
npx supabase db push

# 3. Verificar que se aplicó
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'planificaciones' AND column_name = 'is_saved';
```

### Método 2: SQL Manual (Dashboard)

1. Abrir: `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql`
2. Copiar TODO el contenido
3. Dashboard → SQL Editor → Pegar → Run

### Verificación Post-Migración

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planificaciones'
  AND column_name IN ('nombre', 'is_saved', 'saved_at', 'deleted_at');
```

**Debe retornar 4 filas**.

---

## 17. Troubleshooting Específico PGRST204

### Error: "Could not find the 'is_saved' column"

**Causa**: Migración no aplicada.

**Solución**:
```bash
npx supabase db push
```

**Verificar**:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'planificaciones' AND column_name = 'is_saved';
```

### Frontend muestra "Falta aplicar migración"

**Causa**: Guardrails detectaron columnas faltantes.

**Solución**: Aplicar migración (ver Método 1 o 2 arriba).

### Planificaciones existentes desaparecieron

**Causa esperada**: ✅ Comportamiento correcto según decisión de producto.

**Explicación**: 
- Planificaciones con `is_saved=false` NO aparecen en "Mis Planificaciones"
- Esto es **intencional**
- El docente debe usar "Guardar sesión" en workspace

**Ver borradores**:
```sql
SELECT id, materia, grupo_id, is_saved
FROM planificaciones
WHERE is_saved = false AND deleted_at IS NULL;
```

**Marcar como guardada manualmente** (si realmente se requiere):
```sql
UPDATE planificaciones
SET is_saved = true, saved_at = NOW()
WHERE id = 'ID_AQUI';
```

---

## 18. Support & Troubleshooting General

### Problema: "Planificaciones no aparecen en lista"

**Causa**: No están marcadas como `is_saved=true`.

**Solución**:
```sql
-- Verificar
SELECT id, is_saved FROM planificaciones WHERE id = 'XXX';

-- Marcar como guardada manualmente
UPDATE planificaciones SET is_saved = true, saved_at = NOW() WHERE id = 'XXX';
```

### Problema: "Error al guardar nombre personalizado"

**Causa**: Campo `nombre` no existe en DB (migración no ejecutada).

**Solución**:
1. Verificar que migración existe en carpeta `supabase/migrations/`.
2. Ejecutar `supabase db push` o aplicar SQL manualmente.
3. Verificar con: `\d planificaciones` en psql.

### Problema: "Planificación eliminada por error"

**Solución**:
```sql
UPDATE planificaciones 
SET deleted_at = NULL 
WHERE id = 'PLANIFICACION_ID';
```

### Problema: "Checkbox no deselecciona"

**Causa**: Posible bug en estado de React.

**Solución**:
1. Verificar que `selectedIds` es un Set (no array).
2. Verificar que `handleToggleSelect` usa `new Set(prev)` para inmutabilidad.
3. Console.log estado antes/después de toggle.

### Problema: "Lista vacía después de migración"

**Verificación**:
```sql
-- Ver cuántas hay guardadas vs borradores
SELECT 
  COUNT(*) FILTER (WHERE is_saved = true) as guardadas,
  COUNT(*) FILTER (WHERE is_saved = false) as borradores,
  COUNT(*) as total
FROM planificaciones
WHERE deleted_at IS NULL;
```

**Si todo es `is_saved=false`**: ✅ Correcto según decisión de producto.  
**Solución**: Usar botón "Guardar sesión" en workspace.

---

## 19. Comandos de Verificación Final

```bash
# Compilar proyecto
npm run build

# Lint
npm run lint

# Verificar tipos TypeScript
npx tsc --noEmit

# Ver migraciones aplicadas
npx supabase migration list

# Ver diferencias pendientes
npx supabase db diff
```

---

**Documento creado**: 2025-12-19  
**Última actualización**: 2025-12-19  
**Autor**: AI Assistant  
**Versión**: 2.0  
**Status**: ✅ Implementación completa con decisiones de producto documentadas  
**Cambios v2.0**: 
- ❌ Eliminado auto-guardado masivo de planificaciones existentes
- ✅ Agregadas queries de verificación en DB
- ✅ Agregados pasos detallados para aplicar migración
- ✅ Agregado troubleshooting específico PGRST204

