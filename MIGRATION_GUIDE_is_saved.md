# 🚨 GUÍA: Aplicar Migración is_saved (PGRST204)

## Error Actual

```
Error DB (PGRST204): Could not find the 'is_saved' column of 'planificaciones' in the schema cache
```

**Causa**: La migración SQL que agrega las columnas `nombre`, `is_saved`, `saved_at`, `deleted_at` a la tabla `planificaciones` **NO ha sido aplicada** en el entorno actual.

---

## Solución Rápida

### Opción 1: Supabase CLI (Recomendado)

```bash
# 1. Asegurar que Supabase CLI está instalado
npx supabase --version

# 2. Verificar conexión al proyecto
npx supabase status

# 3. Aplicar migraciones pendientes
npx supabase db push

# 4. Verificar que se aplicó
npx supabase db diff
```

### Opción 2: Aplicar SQL Directamente (Manual)

Si no tienes Supabase CLI configurado:

1. **Abrir Supabase Dashboard**:
   - Ir a: https://app.supabase.com/project/YOUR_PROJECT_ID/editor
   
2. **Ejecutar SQL Editor**:
   - Click en "SQL Editor" en sidebar
   - Crear "New Query"
   
3. **Copiar y Ejecutar**:
   - Abrir archivo: `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql`
   - Copiar TODO el contenido
   - Pegar en SQL Editor
   - Click "Run" (o Ctrl+Enter)

4. **Verificar Éxito**:
   ```sql
   -- Verificar que columnas existen
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'planificaciones'
     AND column_name IN ('nombre', 'is_saved', 'saved_at', 'deleted_at');
   ```
   
   **Output esperado**: 4 filas (una por cada columna)

### Opción 3: Supabase Local (Si usas Docker)

```bash
# 1. Iniciar Supabase local
npx supabase start

# 2. Aplicar migraciones
npx supabase db reset

# 3. Verificar schema
npx supabase db dump --schema public > schema_check.sql
```

---

## Archivo de Migración

**Ubicación**: `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql`

**Contenido** (resumen):

```sql
BEGIN;

-- Agregar columnas
ALTER TABLE planificaciones ADD COLUMN IF NOT EXISTS nombre text;
ALTER TABLE planificaciones ADD COLUMN IF NOT EXISTS is_saved boolean NOT NULL DEFAULT false;
ALTER TABLE planificaciones ADD COLUMN IF NOT EXISTS saved_at timestamptz;
ALTER TABLE planificaciones ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Migrar datos existentes (marcar como guardados)
UPDATE planificaciones
SET is_saved = true, saved_at = COALESCE(saved_at, created_at)
WHERE saved_at IS NULL;

-- Crear índice para performance
CREATE INDEX IF NOT EXISTS idx_planificaciones_is_saved_deleted 
  ON planificaciones(is_saved, deleted_at) 
  WHERE deleted_at IS NULL;

COMMIT;
```

---

## Verificación Post-Migración

### 1. Verificar Columnas en DB

```sql
\d planificaciones
-- O en SQL Editor:
SELECT * FROM information_schema.columns 
WHERE table_name = 'planificaciones';
```

**Columnas esperadas**:
- `nombre` (text, nullable)
- `is_saved` (boolean, not null, default false)
- `saved_at` (timestamptz, nullable)
- `deleted_at` (timestamptz, nullable)

### 2. Verificar Datos Migrados

```sql
SELECT id, materia, grupo_id, is_saved, saved_at, deleted_at
FROM planificaciones
LIMIT 5;
```

**Resultado esperado**: 
- Planificaciones existentes deben tener `is_saved = true`
- `saved_at` debe tener fecha (no NULL)

### 3. Probar Frontend

1. Recargar aplicación (Ctrl+Shift+R)
2. Navegar a "Mis Planificaciones"
3. **NO debe aparecer error PGRST204**
4. Crear nueva planificación → ir a Workspace → ver botón "Guardar sesión"

---

## Guardrails Implementados

El código ahora detecta PGRST204 y muestra mensajes claros:

### En MisPlanificaciones.tsx
```typescript
if (planError.code === 'PGRST204' || planError.message.includes('is_saved')) {
  toast({
    title: "Error de Base de Datos",
    description: "Falta aplicar migración. Ejecuta: supabase db push",
    variant: "destructive"
  });
  return;
}
```

### En PlanificacionWorkspace.tsx
```typescript
if (error.code === 'PGRST204' || error.message.includes('is_saved')) {
  toast({
    title: "Error de Base de Datos",
    description: "Falta aplicar migración de planificaciones. Ejecuta: supabase db push",
    variant: "destructive"
  });
  return;
}
```

### En PlanificacionWizard.tsx
```typescript
if (planError.code === 'PGRST204' || planError.message.includes('is_saved')) {
  throw new Error(`❌ MIGRACIÓN FALTANTE: Ejecuta: supabase db push`);
}
```

**Resultado**: En lugar de crash silencioso, usuario ve toast con instrucciones claras.

---

## Comandos Útiles

### Ver migraciones aplicadas
```bash
npx supabase migration list
```

### Crear nueva migración (si necesario)
```bash
npx supabase migration new nombre_descriptivo
```

### Resetear DB local (⚠️ PELIGRO: borra todo)
```bash
npx supabase db reset
```

### Ver logs de Supabase
```bash
npx supabase logs
```

---

## Troubleshooting

### "supabase: command not found"

```bash
# Instalar Supabase CLI globalmente
npm install -g supabase

# O usar npx (no requiere instalación global)
npx supabase --version
```

### "Project not linked"

```bash
# Linkear proyecto (necesitas PROJECT_ID)
npx supabase link --project-ref YOUR_PROJECT_ID

# O crear supabase/.env con:
# SUPABASE_PROJECT_ID=tu-project-id
```

### "Migration already applied"

Si la migración ya se aplicó pero sigue el error:

1. **Verificar cache de Supabase**:
   ```bash
   # Recargar schema cache en Supabase
   # Dashboard → Settings → Database → Reload Schema Cache
   ```

2. **Verificar que columna realmente existe**:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'planificaciones' AND column_name = 'is_saved';
   ```

3. **Si no existe, re-ejecutar migración manualmente**

### "Column already exists"

Si ves: `ERROR: column "is_saved" of relation "planificaciones" already exists`

**Solución**: La migración ya se aplicó correctamente. El error PGRST204 es un problema de cache:

```sql
-- En SQL Editor de Supabase Dashboard
NOTIFY pgrst, 'reload schema';
```

O simplemente esperar ~10 segundos para que cache se actualice.

---

## Checklist Completo

- [ ] Migración SQL existe en `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql`
- [ ] Ejecutar `npx supabase db push` (o aplicar SQL manualmente)
- [ ] Verificar columnas con query de información_schema
- [ ] Verificar datos migrados (is_saved=true en existentes)
- [ ] Recargar aplicación frontend
- [ ] Probar "Mis Planificaciones" → NO error PGRST204
- [ ] Probar "Guardar sesión" en Workspace → funciona
- [ ] Probar eliminar planificación → funciona

---

## Contacto/Support

Si después de aplicar la migración el error persiste:

1. Verificar logs de Supabase: `npx supabase logs`
2. Verificar network tab en DevTools (ver request/response exacto)
3. Compartir error completo en canal de support

---

**Última actualización**: 2025-12-19  
**Migración**: `20251219163000_add_explicit_save_and_soft_delete.sql`  
**Status**: ✅ Migración corregida y lista para aplicar























