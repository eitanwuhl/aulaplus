# Diagnóstico: Balance de Competencias No Muestra Datos

**Fecha**: 2025-12-19  
**Problema**: El gráfico "Balance de Competencias" muestra "No usage recorded" aunque hay sesiones con `competencias_anep` para la materia seleccionada.

---

## 🔍 Análisis del Código

### 1. Ubicación del Cálculo

**Archivo**: `src/pages/MisPlanificaciones.tsx`

**Función de cálculo**: `competenciasCount` (useMemo, líneas 216-258)

**Flujo de datos**:
1. `sesiones` se carga desde Supabase (línea 149-152)
2. `sesionesFiltradas` filtra sesiones (línea 186-213)
3. `competenciasCount` itera sobre `sesionesFiltradas` y cuenta `competencias_anep` (línea 225-232)

---

### 2. Carga de Sesiones desde Supabase

**Ubicación**: Líneas 149-152

```typescript
const { data: sesionData, error: sesionError } = await supabase
  .from('sesiones_clase')
  .select('*')
  .order('fecha', { ascending: false });
```

**Campos incluidos**: `select('*')` incluye todos los campos:
- ✅ `id`
- ✅ `planificacion_id`
- ✅ `fecha`
- ✅ `estado`
- ✅ `competencias_anep` (text[] en DB)

**Problema potencial**: El campo `competencias_anep` puede venir de Supabase en diferentes formatos:
- Como array `string[]` (esperado)
- Como `null` o `undefined`
- Como string (si hay algún problema de serialización)
- Como objeto (si hay algún problema de parsing)

**NO se normaliza al cargar**: El código asume que `competencias_anep` ya es un array, pero no se aplica `normalizeArrayField()` al cargar desde Supabase.

---

### 3. Comparación de Filtros: Balance vs Pendientes

Ambos cálculos usan **exactamente el mismo filtro** (`sesionesFiltradas`):

**Filtros aplicados** (líneas 186-213):
1. ✅ `estado === 'dictada'` (línea 189)
2. ✅ Rango de fechas: `fechaRange.from` y `fechaRange.to` (líneas 192-202)
3. ✅ Materia: `planPadre.materia === filtroMateria` (líneas 205-209)

**Diferencia clave**: 
- **Pendientes**: Usa `sesionesFiltradas` para obtener IDs usados (línea 273)
- **Balance**: Usa `sesionesFiltradas` para contar ocurrencias (línea 225)

Si las pendientes funcionan, significa que `sesionesFiltradas` tiene datos. Por lo tanto, el problema NO está en el filtro.

---

### 4. Análisis del Cálculo de Balance

**Código relevante** (líneas 225-232):

```typescript
sesionesFiltradas.forEach(sesion => {
  if (sesion.competencias_anep && sesion.competencias_anep.length > 0) {
    sesion.competencias_anep.forEach(compId => {
      competenciasCountMap.set(compId, (competenciasCountMap.get(compId) || 0) + 1);
      totalCompetencias++;
    });
  }
});
```

**Problemas potenciales**:

#### A) Campo `competencias_anep` no es array

Si `competencias_anep` viene como:
- `null` → `sesion.competencias_anep` es falsy → se salta
- `undefined` → `sesion.competencias_anep` es falsy → se salta
- `string` → `sesion.competencias_anep.length` puede ser `undefined` o el length del string (no funciona como array)
- `object` (no array) → `sesion.competencias_anep.length` puede ser `undefined`

**Verificación**: El check `sesion.competencias_anep && sesion.competencias_anep.length > 0` falla si:
- `competencias_anep` es `null` o `undefined` → ✅ Se maneja correctamente
- `competencias_anep` es string → `length` existe pero `forEach` falla (TypeError)
- `competencias_anep` es objeto no-array → `length` puede ser `undefined`

#### B) Normalización faltante

El código **NO normaliza** `competencias_anep` al cargar desde Supabase. Solo se normaliza cuando se actualiza (en otros archivos como `PlanificacionWizard.tsx`).

**Evidencia**: No hay llamada a `normalizeArrayField()` en el `useEffect` que carga sesiones (líneas 121-166).

---

### 5. Logs de Diagnóstico Agregados

Se agregaron logs temporales en:

1. **Carga de sesiones** (línea ~157):
   - Total de sesiones cargadas
   - Muestra de primera sesión con todos sus campos

2. **Filtrado de sesiones** (líneas ~186-213):
   - Contadores después de cada filtro (estado, fecha, materia)
   - Muestra de sesión filtrada
   - Debug info cuando no hay sesiones filtradas

3. **Cálculo de balance** (líneas ~216-258):
   - Número de sesiones filtradas
   - Sesiones con/sin competencias
   - Mapa de conteo de competencias
   - Resultado final

---

## 🎯 Causa Raíz Más Probable

### **HIPÓTESIS PRINCIPAL**: Campo `competencias_anep` no está normalizado al cargar

**Evidencia**:
1. Las pendientes funcionan → `sesionesFiltradas` tiene datos
2. El balance no muestra datos → `competencias_anep` puede no ser un array válido
3. No hay normalización al cargar → Supabase puede devolver el campo en formato inconsistente

**Escenarios posibles**:
- `competencias_anep` viene como `null` → se salta correctamente
- `competencias_anep` viene como string → `length` existe pero `forEach` falla silenciosamente o no itera
- `competencias_anep` viene como objeto → `length` es `undefined` → se salta

**Verificación necesaria**: Los logs mostrarán el tipo real de `competencias_anep` en las sesiones cargadas.

---

## 📍 Ubicaciones de Código Relevantes

### Archivo: `src/pages/MisPlanificaciones.tsx`

1. **Carga de sesiones** (líneas 149-157):
   ```typescript
   const { data: sesionData, error: sesionError } = await supabase
     .from('sesiones_clase')
     .select('*')
     .order('fecha', { ascending: false });
   ```
   **Problema**: No normaliza `competencias_anep` después de cargar.

2. **Filtrado de sesiones** (líneas 186-213):
   ```typescript
   const sesionesFiltradas = useMemo(() => {
     return sesiones.filter(sesion => {
       if (sesion.estado !== 'dictada') return false;
       // ... filtros de fecha y materia
     });
   }, [sesiones, planificaciones, filtroMateria, fechaRange]);
   ```
   **Estado**: ✅ Correcto (mismo filtro que pendientes)

3. **Cálculo de balance** (líneas 225-232):
   ```typescript
   sesionesFiltradas.forEach(sesion => {
     if (sesion.competencias_anep && sesion.competencias_anep.length > 0) {
       sesion.competencias_anep.forEach(compId => {
         // ...
       });
     }
   });
   ```
   **Problema**: Asume que `competencias_anep` es array, pero puede no serlo.

---

## 🔧 Solución Mínima Requerida

### Opción 1: Normalizar al cargar (RECOMENDADO)

**Ubicación**: Después de cargar sesiones (línea ~157)

**Cambio**:
```typescript
import { normalizeArrayField } from '@/lib/normalizeSupabaseArrays';

// Después de setSesiones
const sesionesNormalizadas = (sesionData || []).map(sesion => ({
  ...sesion,
  competencias_anep: normalizeArrayField(sesion.competencias_anep)
}));
setSesiones(sesionesNormalizadas as unknown as SesionClase[]);
```

**Comportamiento que cambiará**:
- `competencias_anep` siempre será un array válido (`string[]`)
- Si viene como string, se convertirá a array
- Si viene como null/undefined, será `[]`
- El cálculo de balance funcionará correctamente

### Opción 2: Normalizar en el cálculo (ALTERNATIVA)

**Ubicación**: En el cálculo de balance (línea ~225)

**Cambio**:
```typescript
sesionesFiltradas.forEach(sesion => {
  const competencias = normalizeArrayField(sesion.competencias_anep);
  if (competencias.length > 0) {
    competencias.forEach(compId => {
      // ...
    });
  }
});
```

**Comportamiento que cambiará**:
- Mismo resultado que Opción 1
- Menos eficiente (normaliza en cada render)
- No afecta otros usos de `sesiones` en el componente

---

## 🧪 Pasos para Verificar

1. **Abrir consola del navegador** al cargar "Mis Planificaciones"
2. **Seleccionar una materia** (ej: "Historia")
3. **Revisar logs** con prefijo `🔍 [DIAGNOSTIC]`:
   - `Total sessions fetched`: ¿Cuántas sesiones se cargaron?
   - `Sample session`: ¿Qué tipo tiene `competencias_anep`?
   - `Filter results`: ¿Cuántas sesiones pasaron cada filtro?
   - `Balance counting`: ¿Cuántas sesiones tienen competencias?
   - `Balance final result`: ¿Cuántos items hay en el resultado?

4. **Verificar tipo de `competencias_anep`**:
   - Si es `string` → **Causa confirmada**: necesita normalización
   - Si es `null` → Las sesiones no tienen competencias asignadas
   - Si es `array` pero vacío → Las sesiones tienen array vacío
   - Si es `array` con datos → El problema está en otro lugar

---

## 📊 Resumen Ejecutivo

**Causa raíz más probable**: 
El campo `competencias_anep` no se normaliza al cargar desde Supabase, lo que puede resultar en que no sea un array válido cuando se intenta iterar.

**Ubicación del problema**:
- `src/pages/MisPlanificaciones.tsx`, línea ~157 (después de cargar sesiones)
- `src/pages/MisPlanificaciones.tsx`, línea ~225 (en el cálculo de balance)

**Solución mínima**:
Normalizar `competencias_anep` al cargar usando `normalizeArrayField()` de `@/lib/normalizeSupabaseArrays`.

**Impacto**:
- ✅ Balance mostrará datos correctamente
- ✅ No afecta pendientes (ya funcionan)
- ✅ Mejora robustez del código
- ✅ Consistente con el resto de la aplicación

---

**Status**: 🔍 Diagnóstico completado con logs agregados  
**Próximo paso**: Ejecutar la app, revisar logs en consola, confirmar causa raíz, aplicar fix


















