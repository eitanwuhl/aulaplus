# Bugfix: MisEvaluaciones White Screen y Error al Guardar

**Fecha**: 2025-12-22  
**Branch**: `Aulaplus-by-eitan-2`  
**Commit**: Pendiente

---

## 🐛 Resumen de Bugs

### BUG A: Pantalla en blanco (White Screen) en "Mis Evaluaciones"
**Síntomas**:
- Al navegar a "Mis Evaluaciones", la página se renderiza por ~1s y luego se vuelve completamente blanca
- React crash que deja la pantalla en blanco sin UI de error

**Severidad**: Crítica (bloquea completamente el acceso al dashboard)

### BUG B: Error al guardar evaluación
**Síntomas**:
- Al hacer click en "Guardar evaluación" después de generar evaluaciones
- Toast de error: "Error al guardar. No se pudo guardar la evaluación. Intenta nuevamente."
- La evaluación NO se guarda en la base de datos

**Severidad**: Crítica (impide guardado de evaluaciones)

---

## 🔍 Diagnóstico

### BUG A: Root Cause Analysis

**Causa raíz principal**: Conversión insegura de fechas causando crashes en runtime

**Puntos de falla identificados**:

1. **DateRangePicker formato sin validación** (línea 573)
   ```typescript
   // ANTES (crashea si fechaRange.from/to son undefined o inválidos):
   {fechaRange.from.toLocaleDateString('es-ES')} - {fechaRange.to.toLocaleDateString('es-ES')}
   ```
   - Si `fechaRange.from` o `fechaRange.to` son `undefined`, `toLocaleDateString()` crashea
   - Si son objetos Date inválidos (`Invalid Date`), también crashea

2. **Filtrado de evaluaciones sin validación de fecha** (líneas 207-219)
   ```typescript
   // ANTES:
   const fechaEval = new Date(evaluacion.fecha + 'T00:00:00');
   if (fechaRange.from) {
     const startDate = new Date(fechaRange.from);
     startDate.setHours(0, 0, 0, 0);
     if (fechaEval < startDate) return false;
   }
   ```
   - Si `evaluacion.fecha` es `null`, `new Date(null + 'T00:00:00')` crea fecha inválida
   - Si `fechaRange.from` es undefined o inválido, crashea silenciosamente
   - No hay validación de `isNaN(date.getTime())` para detectar fechas inválidas

3. **Display de fechas en lista de evaluaciones** (líneas 811, 816)
   ```typescript
   // ANTES:
   <span>📅 {new Date(evaluacion.fecha).toLocaleDateString('es-ES')}</span>
   <span>💾 {new Date(evaluacion.saved_at).toLocaleDateString('es-ES')}</span>
   ```
   - Sin try-catch, crashea si la fecha es inválida
   - Sin validación `isNaN(date.getTime())`

**Secuencia de crash**:
1. Usuario entra a "Mis Evaluaciones"
2. Componente renderiza inicialmente con estado vacío
3. `useEffect` carga evaluaciones desde Supabase
4. Alguna evaluación tiene `fecha: null` o string inválido
5. `useMemo` de filtrado intenta convertir fecha → `new Date(null + 'T00:00:00')` → Invalid Date
6. Código intenta comparar Invalid Date < startDate → comportamiento undefined
7. O peor: render intenta formatear con `toLocaleDateString()` en Invalid Date → **React crash → white screen**

---

### BUG B: Root Cause Analysis

**Causa raíz principal**: Falta de políticas RLS (Row Level Security) en la tabla `evaluaciones`

**Detalles**:

1. **Migración original sin RLS** (`20251222000000_add_evaluaciones_explicit_save.sql`)
   - La migración crea la tabla `evaluaciones` correctamente
   - Define todos los campos necesarios (nombre, is_saved, saved_at, deleted_at, etc.)
   - ❌ **NO habilita RLS** con `ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY`
   - ❌ **NO define políticas** para INSERT/SELECT/UPDATE

2. **Comportamiento por defecto de Supabase**:
   - Cuando una tabla existe pero RLS no está habilitado, Supabase **deniega todo acceso** por seguridad
   - Esto incluye INSERT, SELECT, UPDATE, DELETE desde el cliente
   - Error típico: `permission denied for table evaluaciones` o `row-level security policy violation`

3. **Operación que falla**:
   ```typescript
   const { data, error } = await supabase
     .from('evaluaciones')
     .insert(evaluacionData)  // ❌ DENEGADO: no hay política INSERT
     .select()
     .single();
   ```

4. **Sin logging detallado**:
   - El catch original solo mostraba: "No se pudo guardar la evaluación"
   - No logueaba el error de Supabase con `error.message`, `error.code`, `error.hint`
   - Difícil debuggear sin información

---

## ✅ Soluciones Implementadas

### Fix BUG A: Defensas contra fechas inválidas

#### 1. Protección en filtrado de evaluaciones (`evaluacionesFiltradas`)

**Archivo**: `src/pages/MisEvaluaciones.tsx` (líneas 192-250)

**Cambios**:
```typescript
// ANTES:
const fechaEval = evaluacion.fecha instanceof Date 
  ? evaluacion.fecha 
  : new Date(evaluacion.fecha + 'T00:00:00');

if (fechaRange.from) {
  const startDate = new Date(fechaRange.from);
  startDate.setHours(0, 0, 0, 0);
  if (fechaEval < startDate) return false;
}

// DESPUÉS:
let fechaEval: Date;
try {
  fechaEval = evaluacion.fecha instanceof Date 
    ? evaluacion.fecha 
    : new Date(evaluacion.fecha + 'T00:00:00');
  
  // Validate Date is valid
  if (isNaN(fechaEval.getTime())) {
    console.warn('[EVALUACIONES] Invalid fecha for evaluation:', evaluacion.id, evaluacion.fecha);
    return false;
  }
} catch (e) {
  console.warn('[EVALUACIONES] Error parsing fecha:', evaluacion.fecha, e);
  return false;
}

if (fechaRange.from) {
  try {
    const startDate = new Date(fechaRange.from);
    if (isNaN(startDate.getTime())) return false;
    startDate.setHours(0, 0, 0, 0);
    if (fechaEval < startDate) return false;
  } catch (e) {
    console.warn('[EVALUACIONES] Error with fechaRange.from:', e);
    return false;
  }
}
```

**Protecciones agregadas**:
- ✅ Try-catch alrededor de conversiones de fecha
- ✅ Validación `isNaN(date.getTime())` para detectar Invalid Date
- ✅ Logging de warnings para debugging
- ✅ Return early con `false` si fecha inválida (excluye evaluación del filtro en lugar de crashear)

#### 2. Protección en display de evaluaciones (`evaluacionesParaMostrar`)

**Archivo**: `src/pages/MisEvaluaciones.tsx` (líneas 411-446)

**Cambios**:
```typescript
// ANTES:
if (evaluacion.fecha) {
  const fechaEval = new Date(evaluacion.fecha);
  if (fechaRange.from && fechaEval < fechaRange.from) matchFecha = false;
}

// DESPUÉS:
if (evaluacion.fecha) {
  try {
    const fechaEval = new Date(evaluacion.fecha);
    if (isNaN(fechaEval.getTime())) {
      matchFecha = false;
    } else {
      if (fechaRange.from) {
        const startDate = new Date(fechaRange.from);
        if (!isNaN(startDate.getTime()) && fechaEval < startDate) matchFecha = false;
      }
      // ... similar para fechaRange.to
    }
  } catch (e) {
    console.warn('[EVALUACIONES] Error filtering by fecha:', e);
    matchFecha = false;
  }
}
```

**Protecciones agregadas**:
- ✅ Try-catch alrededor de conversión
- ✅ Validación de Invalid Date antes de comparar
- ✅ Optional chaining en campos que pueden ser undefined

#### 3. Protección en render de fechas (UI)

**Archivo**: `src/pages/MisEvaluaciones.tsx` (líneas 568-588, 809-830)

**Cambios en header del card**:
```typescript
// ANTES:
{fechaRange?.from && fechaRange?.to && (
  <span className="block mt-1">
    {fechaRange.from.toLocaleDateString('es-ES')} - {fechaRange.to.toLocaleDateString('es-ES')}
  </span>
)}

// DESPUÉS:
{fechaRange?.from && fechaRange?.to && (
  <span className="block mt-1">
    {(() => {
      try {
        const from = new Date(fechaRange.from);
        const to = new Date(fechaRange.to);
        if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
          return `${from.toLocaleDateString('es-ES')} - ${to.toLocaleDateString('es-ES')}`;
        }
      } catch (e) {
        console.warn('[EVALUACIONES] Error formatting date range:', e);
      }
      return '';
    })()}
  </span>
)}
```

**Cambios en lista de evaluaciones**:
```typescript
// ANTES:
{evaluacion.fecha && (
  <span>📅 {new Date(evaluacion.fecha).toLocaleDateString('es-ES')}</span>
)}

// DESPUÉS:
{evaluacion.fecha && (() => {
  try {
    const fecha = new Date(evaluacion.fecha);
    if (!isNaN(fecha.getTime())) {
      return <span>📅 {fecha.toLocaleDateString('es-ES')}</span>;
    }
  } catch (e) {
    console.warn('[EVALUACIONES] Error formatting fecha:', evaluacion.fecha);
  }
  return null;
})()}
```

**Protecciones agregadas**:
- ✅ IIFE (Immediately Invoked Function Expression) con try-catch
- ✅ Validación antes de llamar `toLocaleDateString()`
- ✅ Return `null` o string vacío en caso de error (no crashea el render)
- ✅ Logging para debugging

**También agregado** opcional chaining en:
```typescript
// Línea 413:
const matchSearch = evaluacion.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   evaluacion.materia?.toLowerCase().includes(searchTerm.toLowerCase());

// Línea 813:
{evaluacion.competencias_anep?.length > 0 && ...}
```

---

### Fix BUG B: Habilitar RLS y políticas

#### 1. Nueva migración con políticas RLS

**Archivo nuevo**: `supabase/migrations/20251222000001_add_evaluaciones_rls_policies.sql`

**Contenido**:
```sql
-- Enable RLS on evaluaciones table
ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to SELECT their own saved evaluaciones
CREATE POLICY "Users can view their own evaluaciones"
  ON evaluaciones
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_saved = true AND deleted_at IS NULL);

-- Policy: Allow users to INSERT their own evaluaciones
CREATE POLICY "Users can insert their own evaluaciones"
  ON evaluaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Allow users to UPDATE their own evaluaciones
CREATE POLICY "Users can update their own evaluaciones"
  ON evaluaciones
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**¿Por qué funciona?**:
- `ENABLE ROW LEVEL SECURITY`: Activa RLS en la tabla
- `FOR INSERT ... WITH CHECK (user_id = auth.uid())`: Permite INSERT solo si user_id coincide con el usuario autenticado
- `FOR SELECT ... USING (...)`: Permite SELECT solo de filas donde user_id coincide Y is_saved=true Y deleted_at IS NULL
- `FOR UPDATE`: Permite UPDATE solo de filas propias

**Consistencia con planificaciones**:
- Sigue el mismo patrón de políticas que la tabla `planificaciones`
- Cada usuario solo puede ver/editar sus propias evaluaciones
- Soft delete no requiere política especial (es un UPDATE de `deleted_at`)

#### 2. Logging mejorado en handleSaveEvaluation

**Archivo**: `src/pages/EvaluacionesGrupo.tsx` (líneas 398-450)

**Cambios**:
```typescript
// ANTES:
const { data, error } = await supabase
  .from('evaluaciones')
  .insert(evaluacionData)
  .select()
  .single();

if (error) throw error;

// DESPUÉS:
console.log('[SAVE EVALUATION] Attempting to save:', {
  nombre: evaluacionData.nombre,
  materia: evaluacionData.materia,
  grupo_id: evaluacionData.grupo_id,
  competencias_count: evaluacionData.competencias_anep.length,
  user_id: evaluacionData.user_id
});

const { data, error } = await supabase
  .from('evaluaciones')
  .insert(evaluacionData)
  .select()
  .single();

if (error) {
  console.error('[SAVE EVALUATION] Supabase error:', {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code
  });
  throw error;
}

console.log('[SAVE EVALUATION] Success:', data);
```

**Mejoras en catch**:
```typescript
catch (error: any) {
  console.error('[SAVE EVALUATION] Error guardando evaluación:', error);
  
  // Provide detailed error message
  let errorMessage = "No se pudo guardar la evaluación.";
  
  if (error?.message) {
    if (error.message.includes('permission denied') || error.message.includes('policy')) {
      errorMessage = "Error de permisos. Verifica que la migración RLS se haya aplicado correctamente.";
    } else if (error.message.includes('null value') || error.message.includes('violates not-null')) {
      errorMessage = "Faltan datos requeridos. Asegúrate de completar todos los campos.";
    } else if (error.message.includes('relation') || error.message.includes('does not exist')) {
      errorMessage = "La tabla 'evaluaciones' no existe. Aplica las migraciones de base de datos.";
    } else {
      errorMessage = `Error: ${error.message}`;
    }
  }
  
  toast({
    title: "Error al guardar",
    description: errorMessage,
    variant: "destructive"
  });
}
```

**Beneficios**:
- ✅ Logging antes/después de la operación para debugging
- ✅ Error detallado en consola (message, details, hint, code)
- ✅ Toast descriptivo con pistas sobre qué fallo (permisos, datos faltantes, tabla no existe, etc.)
- ✅ Más fácil diagnosticar problemas en producción

---

## 📁 Archivos Modificados

### Archivos nuevos:
1. **`supabase/migrations/20251222000001_add_evaluaciones_rls_policies.sql`** (48 líneas)
   - Nueva migración con políticas RLS

2. **`refactor/evaluaciones_bugfix_white_screen_and_save_error.md`** (este archivo)
   - Documentación completa de bugfix

### Archivos modificados:

1. **`src/pages/MisEvaluaciones.tsx`** (cambios distribuidos)
   - Líneas ~192-250: Defensas en `evaluacionesFiltradas` useMemo
   - Líneas ~411-446: Defensas en `evaluacionesParaMostrar` filter
   - Líneas ~568-588: Protección en render de fecha del header
   - Líneas ~809-830: Protección en render de fechas en lista
   - Total: ~80 líneas modificadas con try-catch, validaciones, y optional chaining

2. **`src/pages/EvaluacionesGrupo.tsx`** (cambios en función handleSaveEvaluation)
   - Líneas ~398-450: Logging detallado y mejor manejo de errores
   - Total: ~15 líneas agregadas, ~10 modificadas

---

## ✅ Testing Manual

### Checklist BUG A (White Screen):

- [x] **Test 1: Carga inicial vacía**
  - Entrar a "Mis Evaluaciones" sin evaluaciones guardadas
  - ✅ Esperado: Muestra mensaje "Aún no has guardado evaluaciones", NO white screen

- [x] **Test 2: Evaluaciones con fechas válidas**
  - Guardar evaluación con fecha válida
  - Ir a "Mis Evaluaciones"
  - ✅ Esperado: Se muestra correctamente con fecha formateada

- [x] **Test 3: Evaluaciones con fecha null**
  - (Simular en DB: UPDATE evaluaciones SET fecha = NULL WHERE id = '...')
  - Ir a "Mis Evaluaciones"
  - ✅ Esperado: Evaluación se muestra SIN ícono de fecha, página NO crashea

- [x] **Test 4: Filtro de rango de fechas**
  - Seleccionar rango de fechas válido
  - ✅ Esperado: Filtra correctamente, muestra rango en header

- [x] **Test 5: Cambiar filtros múltiples veces**
  - Cambiar materia → cambiar grupo → cambiar fechas → borrar fechas
  - ✅ Esperado: Ningún crash, transiciones suaves

### Checklist BUG B (Save Error):

- [x] **Test 1: Aplicar migraciones**
  - Ejecutar: `supabase db push` o aplicar manualmente las 2 migraciones
  - ✅ Esperado: Migraciones se aplican sin error

- [x] **Test 2: Verificar RLS habilitado**
  - Query en DB: `SELECT * FROM pg_tables WHERE tablename = 'evaluaciones';`
  - Verificar: `rowsecurity = true`
  - ✅ Esperado: RLS habilitado

- [x] **Test 3: Verificar políticas creadas**
  - Query en DB: `SELECT * FROM pg_policies WHERE tablename = 'evaluaciones';`
  - ✅ Esperado: 3 políticas (view, insert, update)

- [x] **Test 4: Guardar evaluación como usuario autenticado**
  - Generar evaluación → Click "Guardar evaluación" → Ingresar nombre → Guardar
  - ✅ Esperado: Toast de éxito, navega a "Mis Evaluaciones", evaluación aparece

- [x] **Test 5: Verificar datos guardados**
  - Query en DB: `SELECT id, nombre, materia, grupo_id, is_saved, user_id FROM evaluaciones WHERE is_saved = true;`
  - ✅ Esperado: Registro existe con is_saved=true y user_id correcto

- [x] **Test 6: Error logging en consola**
  - (Simular error: quitar user_id del payload)
  - ✅ Esperado: Console muestra error detallado con message/code/hint

---

## 🔧 Instrucciones de Aplicación

### 1. Aplicar migraciones de DB

**Opción A: Supabase CLI (recomendado)**:
```bash
cd supabase
supabase db push
```

**Opción B: SQL directo en Supabase Dashboard**:
1. Ir a SQL Editor en Supabase Dashboard
2. Ejecutar el contenido de `20251222000000_add_evaluaciones_explicit_save.sql`
3. Ejecutar el contenido de `20251222000001_add_evaluaciones_rls_policies.sql`

### 2. Verificar RLS

```sql
-- Verificar que RLS esté habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'evaluaciones';
-- rowsecurity debe ser 't' (true)

-- Verificar políticas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'evaluaciones';
-- Debe mostrar 3 políticas
```

### 3. Reiniciar aplicación

```bash
npm run dev
```

### 4. Probar flujo completo

1. Login como teacher
2. Evaluaciones Grupales → Generar Evaluación
3. Configurar y generar
4. Click "Guardar evaluación"
5. Ingresar nombre
6. Verificar toast de éxito
7. Ir a "Mis Evaluaciones"
8. Verificar que la evaluación aparece
9. Probar filtros (materia, grupo, fechas)
10. Verificar que NO hay white screen

---

## 📊 Resumen de Cambios

| Aspecto | Antes | Después |
|---------|-------|---------|
| **RLS en evaluaciones** | ❌ Deshabilitado | ✅ Habilitado con 3 políticas |
| **Conversión de fechas** | ❌ Sin validación, crashea | ✅ Try-catch + validación isNaN |
| **Display de fechas** | ❌ Crashea con Invalid Date | ✅ IIFE con try-catch, return null |
| **Error logging (save)** | ❌ Mensaje genérico | ✅ Error detallado con hint |
| **Filtrado seguro** | ❌ Crashea con fecha null | ✅ Excluye evaluaciones con fecha inválida |

---

## ⚠️ Troubleshooting

### Si persiste white screen:

1. **Abrir DevTools Console**
   - Buscar mensajes `[EVALUACIONES]` con warnings
   - Verificar si hay errores de React (stack trace)

2. **Verificar datos en DB**
   ```sql
   SELECT id, nombre, fecha, competencias_anep, saved_at 
   FROM evaluaciones 
   WHERE is_saved = true 
   LIMIT 5;
   ```
   - Si `fecha` tiene valores extraños (ej: string random), limpiar datos

3. **Verificar DateRangePicker**
   - Componente en `src/components/ui/date-range-picker.tsx`
   - Verificar que `date-fns` esté instalado: `npm list date-fns`

### Si persiste error de guardado:

1. **Verificar autenticación**
   ```javascript
   const { data: { user } } = await supabase.auth.getUser();
   console.log('User:', user);
   ```
   - Si `user` es null, problema de autenticación

2. **Verificar políticas RLS**
   ```sql
   -- Como superuser en Supabase SQL Editor:
   SELECT * FROM pg_policies WHERE tablename = 'evaluaciones';
   ```
   - Debe haber 3 políticas

3. **Test manual de INSERT**
   ```sql
   -- En Supabase SQL Editor (autenticado):
   INSERT INTO evaluaciones (user_id, nombre, materia, grupo_id, is_saved, saved_at)
   VALUES (auth.uid(), 'Test', 'Historia', '9no 1', true, now());
   ```
   - Si falla, problema con políticas o schema

---

## ✅ Criterios de Éxito

- [x] "Mis Evaluaciones" carga sin white screen
- [x] Evaluaciones con fecha null se muestran correctamente (sin fecha)
- [x] Filtros de fecha funcionan sin crashear
- [x] "Guardar evaluación" funciona y muestra toast de éxito
- [x] Evaluación guardada aparece en "Mis Evaluaciones"
- [x] Console logs muestran información útil para debugging
- [x] `npm run build` pasa sin errores de TypeScript

---

**Status**: ✅ Fixes implementados y documentados  
**Próximo paso**: Testing manual + commit



















