# Fix: Error PGRST204 - Columna `is_saved` faltante

## Problema
```
Error DB (PGRST204): Could not find the 'is_saved' column of 'planificaciones' in the schema cache
```

**Causa**: Migración SQL no aplicada en entorno actual + bug en WHERE clause de la migración.

## Solución

### 1. Migración SQL Corregida
- **Bug encontrado**: `UPDATE ... WHERE is_saved = false` fallaba porque columna no existía aún
- **Fix**: Cambiado a `WHERE saved_at IS NULL` (columna que sí existe en ese punto)
- **Archivo**: `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql`

### 2. Guardrails en Frontend
Agregado manejo de error PGRST204 en 3 componentes con toasts claros:
- `MisPlanificaciones.tsx` (2 ubicaciones: query + delete)
- `PlanificacionWorkspace.tsx` (save handler)
- `PlanificacionWizard.tsx` (create handler)

**Resultado**: En lugar de crash, usuario ve mensaje: "Falta aplicar migración. Ejecuta: supabase db push"

### 3. Documentación
- ✅ `MIGRATION_GUIDE_is_saved.md`: Guía completa de aplicación (CLI + manual + local)
- ✅ `CHANGELOG_PGRST204_FIX.md`: Detalle técnico de todos los cambios

## Archivos Modificados
- `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql` (corregido)
- `src/pages/MisPlanificaciones.tsx` (+30 líneas guardrails)
- `src/pages/PlanificacionWorkspace.tsx` (+15 líneas guardrails)
- `src/pages/PlanificacionWizard.tsx` (+4 líneas guardrails)
- `MIGRATION_GUIDE_is_saved.md` (nuevo, 300 líneas)
- `CHANGELOG_PGRST204_FIX.md` (nuevo, 200 líneas)

## Verificación
```bash
npm run build  # ✅ Pasa (0 errores)
```

## Acción Requerida
**Usuario debe aplicar migración**:
```bash
npx supabase db push
```

Ver `MIGRATION_GUIDE_is_saved.md` para instrucciones detalladas.


