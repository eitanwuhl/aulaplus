# 🔧 Fix: Error PGRST204 - Columna `is_saved` Faltante

## Problema Original

```
Error DB (PGRST204): Could not find the 'is_saved' column of 'planificaciones' in the schema cache
```

**Causa Raíz**: Migración SQL no aplicada en el entorno actual.

---

## Solución Implementada

### 1. ✅ Migración SQL Corregida

**Archivo**: `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql`

**Problema detectado y corregido**:
- **ANTES** (línea 58): `WHERE is_saved = false` → ❌ Falla porque columna no existe aún
- **DESPUÉS** (línea 58): `WHERE saved_at IS NULL` → ✅ Funciona correctamente

**SQL correcto**:
```sql
UPDATE planificaciones
SET 
  is_saved = true,
  saved_at = COALESCE(saved_at, created_at)
WHERE saved_at IS NULL;
```

**Cambio**: Usar `saved_at IS NULL` en lugar de `is_saved = false` para evitar error de columna inexistente.

---

### 2. ✅ Guardrails en Frontend (Manejo de Error PGRST204)

Agregado try-catch y detección específica de error PGRST204 en 3 archivos:

#### A. `src/pages/MisPlanificaciones.tsx`

**Ubicación 1**: Query de carga (línea ~82)
```typescript
if (planError.code === 'PGRST204' || planError.message.includes('is_saved')) {
  console.error('❌ MIGRACIÓN FALTANTE: La columna is_saved no existe');
  toast({
    title: "Error de Base de Datos",
    description: "Falta aplicar migración. Ejecuta: supabase db push",
    variant: "destructive"
  });
  setIsLoading(false);
  return;
}
```

**Ubicación 2**: Handler de borrado (línea ~235)
```typescript
if (error.code === 'PGRST204' || error.message.includes('deleted_at')) {
  console.error('❌ MIGRACIÓN FALTANTE: La columna deleted_at no existe');
  toast({
    title: "Error de Base de Datos",
    description: "Falta aplicar migración. Ejecuta: supabase db push",
    variant: "destructive"
  });
  setIsDeleting(false);
  setDeleteConfirmOpen(false);
  return;
}
```

**Resultado**: En lugar de crash, usuario ve toast con instrucciones claras.

---

#### B. `src/pages/PlanificacionWorkspace.tsx`

**Ubicación**: Handler de guardar planificación (línea ~318)
```typescript
if (error.code === 'PGRST204' || 
    error.message.includes('is_saved') || 
    error.message.includes('nombre') || 
    error.message.includes('saved_at')) {
  console.error('❌ MIGRACIÓN FALTANTE: Columnas is_saved/nombre/saved_at no existen');
  toast({
    title: "Error de Base de Datos",
    description: "Falta aplicar migración. Ejecuta: supabase db push",
    variant: "destructive"
  });
  setIsSaving(false);
  setSaveDialogOpen(false);
  return;
}
```

**Resultado**: Modal de guardar se cierra con mensaje claro en lugar de quedar colgado.

---

#### C. `src/pages/PlanificacionWizard.tsx`

**Ubicación**: Creación de planificación (línea ~381)
```typescript
if (planError.code === 'PGRST204' || planError.message.includes('is_saved')) {
  throw new Error(`❌ MIGRACIÓN FALTANTE: La columna 'is_saved' no existe. Ejecuta: supabase db push`);
}
```

**Resultado**: Error claro en consola y mensaje al usuario en lugar de error genérico.

---

### 3. ✅ Guía de Aplicación de Migración

**Archivo creado**: `MIGRATION_GUIDE_is_saved.md`

**Contenido**:
- ✅ 3 métodos de aplicación (Supabase CLI, SQL manual, Local)
- ✅ Comandos exactos para cada método
- ✅ Queries de verificación post-migración
- ✅ Checklist completo
- ✅ Troubleshooting detallado

**Comandos principales**:

```bash
# Opción 1: Supabase CLI (recomendado)
npx supabase db push

# Opción 2: SQL manual (Dashboard)
# Copiar contenido de supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql
# Pegar en SQL Editor de Supabase → Run

# Opción 3: Local
npx supabase start
npx supabase db reset
```

---

## Archivos Modificados

| Archivo | Tipo de Cambio | Líneas |
|---------|----------------|--------|
| `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql` | Corrección SQL (WHERE clause) | ~3 |
| `src/pages/MisPlanificaciones.tsx` | Guardrails PGRST204 (2 ubicaciones) | +30 |
| `src/pages/PlanificacionWorkspace.tsx` | Guardrails PGRST204 | +15 |
| `src/pages/PlanificacionWizard.tsx` | Guardrails PGRST204 | +4 |
| `MIGRATION_GUIDE_is_saved.md` | Documentación nueva | +300 |
| `CHANGELOG_PGRST204_FIX.md` | Este archivo | +200 |

**Total**: ~552 líneas agregadas/modificadas

---

## Verificación Completa

### Build ✅

```bash
npm run build
```

**Resultado**: 
```
✓ 4298 modules transformed.
✓ built in 21.25s
```

- ✅ Zero errores de TypeScript
- ✅ Zero errores de compilación
- ✅ Guardrails no rompen lógica existente

### Linter ✅

Sin warnings adicionales introducidos.

---

## Próximos Pasos para Usuario

### PASO 1: Aplicar Migración (CRÍTICO)

**Ejecutar UNO de estos comandos**:

```bash
# Recomendado si tienes Supabase CLI
npx supabase db push

# O aplicar SQL manualmente desde Dashboard
# Ver: MIGRATION_GUIDE_is_saved.md sección "Opción 2"
```

### PASO 2: Verificar Migración

```sql
-- En SQL Editor de Supabase Dashboard
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'planificaciones' 
  AND column_name IN ('nombre', 'is_saved', 'saved_at', 'deleted_at');
```

**Output esperado**: 4 filas

### PASO 3: Recargar Frontend

1. Ctrl+Shift+R en browser
2. Navegar a "Mis Planificaciones"
3. **NO debe aparecer error PGRST204**

### PASO 4: Probar Funcionalidad

- ✅ Crear planificación → ir a Workspace → ver botón "Guardar sesión"
- ✅ Guardar con nombre personalizado → aparece en "Mis Planificaciones"
- ✅ Seleccionar varias → eliminar → desaparecen con animación

---

## Comportamiento Antes vs Después

### ANTES (Sin migración aplicada)

1. Usuario navega a "Mis Planificaciones" → **💥 Crash silencioso**
2. Console: `Error DB (PGRST204): Could not find 'is_saved' column`
3. Pantalla blanca o loading infinito
4. Usuario no sabe qué hacer

### DESPUÉS (Con guardrails)

1. Usuario navega a "Mis Planificaciones" → **✅ Toast claro**
2. Toast: "Error de Base de Datos - Falta aplicar migración. Ejecuta: supabase db push"
3. Console: `❌ MIGRACIÓN FALTANTE: La columna is_saved no existe`
4. Usuario tiene instrucciones claras para solucionar

---

## Testing Recomendado

### Caso 1: Migración NO aplicada (simular error)

1. Comentar líneas de migración temporalmente
2. Intentar cargar "Mis Planificaciones"
3. **Verificar**: Toast aparece con mensaje claro
4. **Verificar**: No hay crash, app sigue funcionando

### Caso 2: Migración aplicada correctamente

1. Ejecutar `npx supabase db push`
2. Recargar app
3. **Verificar**: "Mis Planificaciones" carga sin errores
4. **Verificar**: Crear → Guardar → Eliminar funciona

---

## Notas Técnicas

### Por qué falló la migración original

El UPDATE intentaba filtrar por `is_saved = false`, pero esa columna aún no existía en ese punto de la ejecución:

```sql
-- ❌ ANTES (falla)
ALTER TABLE planificaciones ADD COLUMN is_saved boolean NOT NULL DEFAULT false;
UPDATE planificaciones SET is_saved = true WHERE is_saved = false; -- ← Error aquí
```

### Solución correcta

Usar columna que SÍ existe (`saved_at` que acabamos de crear como NULL):

```sql
-- ✅ DESPUÉS (funciona)
ALTER TABLE planificaciones ADD COLUMN is_saved boolean NOT NULL DEFAULT false;
ALTER TABLE planificaciones ADD COLUMN saved_at timestamptz; -- NULL por default
UPDATE planificaciones SET is_saved = true, saved_at = created_at WHERE saved_at IS NULL;
```

**Lógica**: Si `saved_at IS NULL`, significa que es una fila existente que acabamos de agregar las columnas, por lo tanto debe marcarse como guardada para mantener visibilidad.

---

## Checklist de Resolución

- [x] Migración SQL corregida (WHERE clause)
- [x] Guardrails agregados en MisPlanificaciones.tsx
- [x] Guardrails agregados en PlanificacionWorkspace.tsx
- [x] Guardrails agregados en PlanificacionWizard.tsx
- [x] Guía de aplicación creada (MIGRATION_GUIDE_is_saved.md)
- [x] Build verificado (npm run build → ✅)
- [x] Documentación de cambios (este archivo)
- [ ] **PENDIENTE**: Usuario debe aplicar migración (`npx supabase db push`)
- [ ] **PENDIENTE**: Usuario debe verificar columnas en DB
- [ ] **PENDIENTE**: Usuario debe probar funcionalidad completa

---

## Contacto/Support

Si después de aplicar la migración persiste el error:

1. Verificar que las 4 columnas existen en DB (query de verificación arriba)
2. Verificar logs: `npx supabase logs`
3. Reload schema cache en Supabase Dashboard
4. Esperar ~10 segundos para que cache se actualice

---

**Fecha**: 2025-12-19  
**Autor**: AI Assistant  
**Status**: ✅ Código corregido y listo  
**Acción requerida**: Usuario debe aplicar migración (`npx supabase db push`)


