# Checklist de Verificación: Guardado Explícito y Eliminación de Planificaciones

**Fecha**: 2025-12-19  
**Objetivo**: Verificar que la implementación esté completa, consistente y libre de contradicciones

---

## 📋 Pre-requisitos

### 1. Migración Aplicada ✅

```bash
# Verificar que la migración se haya aplicado
npx supabase db push

# Verificar columnas creadas
```

**Query de verificación**:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planificaciones'
  AND column_name IN ('nombre', 'is_saved', 'saved_at', 'deleted_at');
```

**Resultado esperado**: 4 filas (una por columna)

---

## ✅ Verificación de Código

### 1. PlanificacionWizard.tsx - Creación de Planificaciones

**Ubicación**: `src/pages/PlanificacionWizard.tsx` (línea ~375)

**Verificar que**:
- ✅ Inserta `is_saved: false` al crear planificación
- ✅ NO marca automáticamente como guardada
- ✅ Guardrail para PGRST204 presente

**Código esperado**:
```typescript
.insert({
  // ... otros campos ...
  is_saved: false // Planification not explicitly saved yet
})
```

**Resultado**: ✅ Correcto - Las nuevas planificaciones NO aparecen en "Mis Planificaciones" hasta que se guarden explícitamente.

---

### 2. PlanificacionWorkspace.tsx - Guardado Explícito

**Ubicación**: `src/pages/PlanificacionWorkspace.tsx` (línea ~308-364)

**Verificar que**:
- ✅ Botón "Guardar sesión" solo visible cuando `is_saved === false`
- ✅ Modal para personalizar nombre se abre al hacer click
- ✅ Update solo ejecuta cuando usuario confirma guardado
- ✅ Update incluye: `nombre`, `is_saved: true`, `saved_at: now()`
- ✅ Guardrail para PGRST204 presente

**Código esperado**:
```typescript
// Botón visible solo si NO guardada
{planificacion && !planificacion.is_saved && (
  <Button onClick={handleOpenSaveDialog}>
    Guardar sesión
  </Button>
)}

// Update al guardar
.update({
  nombre: customNombre.trim(),
  is_saved: true,
  saved_at: new Date().toISOString()
})
```

**Resultado**: ✅ Correcto - Solo se guarda cuando el usuario hace click explícitamente.

---

### 3. MisPlanificaciones.tsx - Filtrado y Visualización

**Ubicación**: `src/pages/MisPlanificaciones.tsx` (línea ~79-84, ~844)

**Verificar que**:
- ✅ Query filtra por `is_saved = true` AND `deleted_at IS NULL`
- ✅ Ordena por `saved_at DESC` (más reciente primero)
- ✅ Display usa: `plan.nombre || \`${plan.materia} - ${plan.grupo_id}\``
- ✅ Guardrail para PGRST204 presente

**Código esperado**:
```typescript
// Query de carga
.from('planificaciones')
.select('*')
.eq('is_saved', true)          // Solo guardadas explícitamente
.is('deleted_at', null)        // Solo NO eliminadas
.order('saved_at', { ascending: false }); // Orden por fecha de guardado

// Display de nombre
{plan.nombre || `${plan.materia} - ${plan.grupo_id}`}
```

**Resultado**: ✅ Correcto - Solo muestra planificaciones guardadas y no eliminadas.

---

### 4. MisPlanificaciones.tsx - Eliminación Múltiple

**Ubicación**: `src/pages/MisPlanificaciones.tsx` (línea ~232-282)

**Verificar que**:
- ✅ Soft delete: `UPDATE deleted_at = now()` (NO hard delete)
- ✅ Eliminación múltiple con checkboxes funciona
- ✅ Modal de confirmación muestra contador correcto
- ✅ Animación CSS suave al eliminar (`transition-all duration-300`)
- ✅ Guardrail para PGRST204 presente

**Código esperado**:
```typescript
// Soft delete
.update({ deleted_at: new Date().toISOString() })
.in('id', idsArray);

// Animación CSS (NO Framer Motion)
<Card className="hover:shadow-md transition-all duration-300" />
```

**Resultado**: ✅ Correcto - Soft delete funciona, animación CSS suave.

---

## 🧪 Testing Manual Completo

### Escenario 1: Crear Nueva Planificación

**Pasos**:
1. Ir a Wizard de Planificaciones
2. Completar todos los pasos
3. Finalizar creación

**Resultado esperado**:
- ✅ Planificación creada con `is_saved=false`
- ✅ Redirige a Workspace
- ✅ **NO aparece** en "Mis Planificaciones"
- ✅ Botón verde "Guardar sesión" visible en Workspace

**Query de verificación**:
```sql
SELECT id, materia, grupo_id, is_saved, saved_at, deleted_at
FROM planificaciones
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado esperado**: `is_saved = false`, `saved_at = NULL`

---

### Escenario 2: Guardar Planificación desde Workspace

**Pasos**:
1. Estar en Workspace de una planificación NO guardada
2. Hacer click en "Guardar sesión"
3. Modal se abre con nombre sugerido (`materia - grupo_id`)
4. Aceptar nombre sugerido o personalizarlo
5. Hacer click en "Guardar"

**Resultado esperado**:
- ✅ Modal se cierra
- ✅ Botón "Guardar sesión" desaparece
- ✅ Badge verde "Guardada" aparece
- ✅ Toast de confirmación: "Planificación guardada"
- ✅ **AHORA aparece** en "Mis Planificaciones"

**Query de verificación**:
```sql
SELECT id, nombre, is_saved, saved_at
FROM planificaciones
WHERE id = 'ID_DE_PLANIFICACION';
```

**Resultado esperado**: `is_saved = true`, `saved_at = timestamp reciente`, `nombre = nombre ingresado`

---

### Escenario 3: Ver Planificaciones Guardadas

**Pasos**:
1. Ir a "Mis Planificaciones"
2. Verificar lista

**Resultado esperado**:
- ✅ Solo muestra planificaciones con `is_saved=true` y `deleted_at IS NULL`
- ✅ Ordenadas por `saved_at` (más reciente primero)
- ✅ Nombre personalizado se muestra si existe
- ✅ Fallback a `materia - grupo_id` si no hay nombre personalizado
- ✅ NO muestra planificaciones eliminadas
- ✅ NO muestra planificaciones NO guardadas

**Query de verificación**:
```sql
-- Esto es lo que ejecuta la UI
SELECT *
FROM planificaciones
WHERE is_saved = true
  AND deleted_at IS NULL
ORDER BY saved_at DESC;
```

**Comparar**: Debe coincidir exactamente con lo que muestra la UI.

---

### Escenario 4: Eliminar Planificaciones (Individual y Múltiple)

**Pasos**:
1. Ir a "Mis Planificaciones"
2. Seleccionar checkbox de una planificación
3. Hacer click en "Eliminar"
4. Modal de confirmación se abre
5. Confirmar eliminación

**Resultado esperado**:
- ✅ Modal muestra contador correcto
- ✅ Al confirmar, items desaparecen con transición CSS suave
- ✅ Toast: "Planificaciones eliminadas"
- ✅ Items NO reaparecen al recargar página
- ✅ Soft delete: datos permanecen en DB pero con `deleted_at` set

**Query de verificación**:
```sql
-- Ver eliminadas
SELECT id, nombre, deleted_at
FROM planificaciones
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;
```

**Resultado esperado**: Planificaciones eliminadas tienen `deleted_at` con timestamp.

---

### Escenario 5: Planificaciones Existentes (Pre-Feature)

**Contexto**: Planificaciones creadas antes de aplicar la migración.

**Comportamiento esperado**:
- ✅ **NO aparecen automáticamente** en "Mis Planificaciones"
- ✅ Tienen `is_saved=false` por defecto
- ✅ Docente puede entrar al Workspace y guardarlas explícitamente
- ✅ Lista limpia, solo lo explícitamente guardado

**Query de verificación**:
```sql
-- Ver estado de planificaciones existentes
SELECT 
  COUNT(*) FILTER (WHERE is_saved = true) as guardadas,
  COUNT(*) FILTER (WHERE is_saved = false AND deleted_at IS NULL) as borradores,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as eliminadas,
  COUNT(*) as total
FROM planificaciones;
```

**Resultado esperado**: Planificaciones existentes están en "borradores" hasta que se guarden explícitamente.

---

## 🔍 Verificaciones de Base de Datos

### Query 1: Estado General de Planificaciones

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
ORDER BY 
  CASE WHEN is_saved THEN 0 ELSE 1 END,  -- Guardadas primero
  saved_at DESC NULLS LAST,
  created_at DESC;
```

**Uso**: Verificar estado completo de todas las planificaciones.

---

### Query 2: Solo Planificaciones Guardadas (Query de UI)

```sql
-- Exactamente lo que ejecuta MisPlanificaciones.tsx
SELECT *
FROM planificaciones
WHERE is_saved = true
  AND deleted_at IS NULL
ORDER BY saved_at DESC;
```

**Uso**: Comparar con lo que muestra la UI. Debe coincidir exactamente.

---

### Query 3: Borradores (No Guardadas)

```sql
-- Planificaciones en workspace pero no en lista
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

**Uso**: Ver planificaciones que no aparecen en "Mis Planificaciones" (comportamiento esperado).

---

### Query 4: Planificaciones Eliminadas (Soft Delete)

```sql
-- Ver eliminadas (recuperables)
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

**Uso**: Verificar soft delete y posibilidad de recuperación.

---

### Query 5: Estadísticas de Estados

```sql
-- Resumen de estados
SELECT 
  COUNT(*) FILTER (WHERE is_saved = true AND deleted_at IS NULL) as guardadas_activas,
  COUNT(*) FILTER (WHERE is_saved = false AND deleted_at IS NULL) as borradores,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as eliminadas,
  COUNT(*) as total
FROM planificaciones;
```

**Uso**: Resumen rápido del estado general.

---

## 🚨 Troubleshooting

### Problema: "Lista vacía después de migración"

**Causa esperada**: ✅ Comportamiento correcto según decisión de producto.

**Explicación**: 
- Planificaciones existentes tienen `is_saved=false` por defecto
- NO aparecen en "Mis Planificaciones" hasta que se guarden explícitamente
- Esto es **intencional** para mantener lista limpia

**Solución**:
1. Ir al Workspace de cada planificación existente que desees preservar
2. Hacer click en "Guardar sesión"
3. Personalizar nombre si lo deseas
4. Confirmar

**Verificar**:
```sql
-- Ver cuántas hay guardadas vs borradores
SELECT 
  COUNT(*) FILTER (WHERE is_saved = true) as guardadas,
  COUNT(*) FILTER (WHERE is_saved = false AND deleted_at IS NULL) as borradores
FROM planificaciones;
```

---

### Problema: "Error PGRST204: Could not find 'is_saved' column"

**Causa**: Migración no aplicada o schema cache no recargado.

**Solución**:
```bash
# Aplicar migración
npx supabase db push

# O recargar schema cache manualmente
# En Supabase Dashboard → SQL Editor:
NOTIFY pgrst, 'reload schema';
```

**Verificar**:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'planificaciones' AND column_name = 'is_saved';
```

**Debe retornar**: 1 fila con `column_name = 'is_saved'`

---

### Problema: "Planificación eliminada por error"

**Solución**: Recuperar con soft delete:

```sql
UPDATE planificaciones 
SET deleted_at = NULL 
WHERE id = 'PLANIFICACION_ID';
```

**Verificar**:
```sql
SELECT id, nombre, deleted_at
FROM planificaciones
WHERE id = 'PLANIFICACION_ID';
```

**Debe mostrar**: `deleted_at = NULL`

---

## ✅ Checklist Final de Consistencia

### Documentación
- [x] `refactor/planificacion_guardado_explicito_y_borrado.md` NO contiene UPDATE automático en sección "Exact SQL Schema"
- [x] Documentación especifica que animación es CSS (`transition-all duration-300`), NO Framer Motion
- [x] Documentación explica claramente que planificaciones existentes NO se auto-guardan
- [x] SQL opcional para administradores está claramente marcado como "OPCIONAL" y "MANUAL"

### Código
- [x] `PlanificacionWizard.tsx` inserta con `is_saved: false`
- [x] `PlanificacionWorkspace.tsx` solo actualiza cuando usuario hace click explícito
- [x] `MisPlanificaciones.tsx` filtra correctamente por `is_saved=true AND deleted_at IS NULL`
- [x] Display de nombre usa fallback: `plan.nombre || materia - grupo_id`
- [x] Eliminación usa soft delete (`deleted_at`), no hard delete
- [x] Animación es CSS (`transition-all duration-300`), no Framer Motion
- [x] Guardrails PGRST204 presentes en todos los puntos críticos

### Migración
- [x] Migración NO contiene UPDATE automático
- [x] Migración solo agrega columnas e índice
- [x] SQL opcional documentado como comentarios, no ejecutado automáticamente

### Comportamiento
- [x] Nuevas planificaciones NO aparecen en lista hasta guardar explícitamente
- [x] Planificaciones existentes NO aparecen en lista hasta guardar explícitamente
- [x] Guardado explícito funciona con modal de nombre personalizado
- [x] Eliminación múltiple funciona con confirmación
- [x] Soft delete permite recuperación

---

## 📝 Notas Finales

### Comportamiento Esperado de Planificaciones Históricas

**IMPORTANTE**: Las planificaciones creadas antes de aplicar esta feature:

1. ✅ **NO aparecen automáticamente** en "Mis Planificaciones"
2. ✅ Tienen `is_saved=false` por defecto (columna nueva con default)
3. ✅ Permanecen accesibles desde el Workspace (si el usuario conoce el ID o las encuentra por otro medio)
4. ✅ El docente debe entrar al Workspace de cada una y hacer click en "Guardar sesión" si desea que aparezcan en la lista
5. ✅ Esto es el **comportamiento deseado**: lista limpia, solo lo explícitamente guardado

**Razón del diseño**:
- Evita saturar la lista con planificaciones históricas
- Permite al docente controlar qué ve en su lista
- Planificaciones históricas pueden ser borradores, experimentos, etc.
- Mismo comportamiento para nuevas y viejas planificaciones (guardado explícito requerido)

**Si se requiere preservar algunas planificaciones existentes**:
- Ejecutar manualmente el SQL opcional documentado en la migración
- O guardarlas explícitamente desde el Workspace una por una

---

**Status**: ✅ Verificación completa  
**Última actualización**: 2025-12-19  
**Versión**: 2.0 (Corrección de inconsistencias documentales)




























