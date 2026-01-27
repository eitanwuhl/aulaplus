# Análisis e Implementación: Balance y Competencias Pendientes

**Fecha**: 2025-12-19  
**Objetivo**: Hacer funcionales las tarjetas "Balance de Competencias" y "Competencias Pendientes" en la página "Mis Planificaciones"

---

## 📋 Hallazgos del Análisis

### 1. Archivos Involucrados

**Componente Principal**:
- `src/pages/MisPlanificaciones.tsx` - Página que contiene las dos tarjetas

**Fuentes de Datos de Competencias**:
- `src/data/competencias.ts` - Competencias para Historia (`COMPETENCIAS_HISTORIA`)
- `src/data/competenciasLiteratura.ts` - Competencias para Literatura (`COMPETENCIAS_LITERATURA`)
- `src/data/competenciasCiudadania.ts` - Competencias para Ciudadanía (`COMPETENCIAS_CIUDADANIA`)

**Utilidades**:
- `src/lib/subjectNormalizer.ts` - Normalización de nombres de materias

**Tipos**:
- `src/types/planificacion.ts` - Tipos `SesionClase` y `Planificacion`

---

### 2. Estructura de Base de Datos

#### Tabla: `sesiones_clase`

**Campos relevantes**:
- `id` (uuid, PK)
- `planificacion_id` (uuid, FK → planificaciones.id)
- `fecha` (date) - Fecha de la sesión
- `competencias_anep` (text[]) - **Array de IDs de competencias usadas en esta sesión**
- `estado` (text) - Estado de la sesión: 'backlog' | 'planificada' | 'dictada' | 'omitida' | 'pausada'

**Nota importante**: Solo las sesiones con `estado === 'dictada'` deben contarse para el balance.

#### Tabla: `planificaciones`

**Campos relevantes**:
- `id` (uuid, PK)
- `materia` (text) - Nombre de la materia (ej: "Historia", "Literatura", "Formación para la ciudadanía")
- `grupo_id` (text) - ID del grupo
- `fecha_inicio` (date)
- `fecha_fin` (date)
- `competencias_seleccionadas` (text[]) - Competencias objetivo de la planificación (no se usa directamente para el cálculo)

---

### 3. Estructura de Datos de Competencias

Cada archivo de competencias exporta un array de objetos con esta estructura:

```typescript
interface CompetenciaEspecifica {
  id: string;           // ID único (ej: "ce1", "ce2-literatura", "ce1-ciudadania")
  codigo: string;      // Código visible (ej: "CE1", "CE2")
  nombre: string;      // Nombre de la competencia
  descripcion: string; // Descripción completa
  criteriosLogro: CriterioLogro[];
}
```

**Mapeo Materia → Archivo de Competencias**:
- `"Historia"` → `COMPETENCIAS_HISTORIA` (9 competencias)
- `"Literatura"` → `COMPETENCIAS_LITERATURA` (5 competencias)
- `"Formación para la ciudadanía"` → `COMPETENCIAS_CIUDADANIA` (9 competencias)

**Normalización de Materias**:
- Se usa `normalizeSubjectName()` de `src/lib/subjectNormalizer.ts` para normalizar nombres
- Ejemplo: "Educación para la Ciudadanía" → "Formación para la ciudadanía"

---

### 4. Lógica de Cálculo Actual (ANTES de la corrección)

#### Balance de Competencias

**Ubicación**: `calcularCompetenciasCount()` (línea ~125)

**Problemas identificados**:
1. ✅ Filtra correctamente por `estado === 'dictada'`
2. ✅ Filtra correctamente por rango de fechas
3. ✅ Filtra correctamente por materia (a través de planificación padre)
4. ❌ **PROBLEMA**: Cuenta las competencias directamente desde `sesion.competencias_anep` pero no muestra el nombre completo de la competencia, solo el ID
5. ❌ **PROBLEMA**: No obtiene la lista completa de competencias disponibles para la materia

**Código actual**:
```typescript
sesionesFiltradas.forEach(sesion => {
  if (sesion.competencias_anep && sesion.competencias_anep.length > 0) {
    sesion.competencias_anep.forEach(comp => {
      competenciasMap.set(comp, (competenciasMap.get(comp) || 0) + 1);
      totalCompetencias++;
    });
  }
});
```

#### Competencias Pendientes

**Estado actual**: ❌ **NO IMPLEMENTADO**

- El estado `competenciasPendientes` existe pero nunca se calcula
- Siempre está vacío (`[]`)
- La UI muestra "¡Excelente! Todas las competencias objetivo han sido trabajadas" cuando no hay planificaciones filtradas

---

### 5. Lógica de Cálculo Requerida (DESPUÉS de la corrección)

#### Balance de Competencias

**Algoritmo**:
1. Obtener todas las competencias disponibles para la materia seleccionada (usando `normalizeSubjectName()`)
2. Filtrar sesiones:
   - `estado === 'dictada'`
   - `fecha` dentro del rango seleccionado
   - `planificacion.materia` coincide con el filtro (si está seleccionado)
3. Contar ocurrencias de cada ID de competencia en `sesiones_clase.competencias_anep`
4. Mapear IDs a objetos completos de competencia (con nombre, código, descripción)
5. Calcular porcentaje: `(count / totalCompetencias) * 100`
6. Ordenar por count descendente

**Estructura de salida**:
```typescript
interface CompetenciaCount {
  competencia: string;      // ID de la competencia (ej: "ce1")
  nombre: string;           // Nombre completo de la competencia
  codigo: string;          // Código (ej: "CE1")
  count: number;            // Número de veces usada
  porcentaje: number;        // Porcentaje del total
}
```

#### Competencias Pendientes

**Algoritmo**:
1. Obtener todas las competencias disponibles para la materia seleccionada
2. Obtener todas las competencias usadas (IDs únicos) de sesiones dictadas en el rango de fechas
3. Encontrar competencias que NO están en la lista de usadas
4. Mapear a objetos completos con nombre y descripción

**Estructura de salida**:
```typescript
interface CompetenciaPendiente {
  id: string;              // ID de la competencia
  codigo: string;          // Código (ej: "CE1")
  nombre: string;           // Nombre de la competencia
  descripcion: string;      // Descripción completa
}
```

---

### 6. Filtros Aplicados

Ambos cálculos deben respetar:

1. **Filtro de Materia** (`filtroMateria`):
   - Si está seleccionado (no es 'all'), solo contar sesiones de planificaciones con esa materia
   - Normalizar el nombre de la materia antes de comparar

2. **Filtro de Rango de Fechas** (`fechaRange`):
   - Si `fechaRange.from` está definido, solo sesiones con `fecha >= fechaRange.from`
   - Si `fechaRange.to` está definido, solo sesiones con `fecha <= fechaRange.to`

3. **Estado de Sesión**:
   - Solo sesiones con `estado === 'dictada'` (ya implementado correctamente)

**Nota**: Los filtros de grupo y carpeta NO afectan el cálculo de competencias (solo filtran la lista de planificaciones mostradas).

---

### 7. Suposiciones y Decisiones

#### Suposiciones

1. **Fuente de verdad para competencias usadas**: 
   - ✅ Usamos `sesiones_clase.competencias_anep` (array de IDs)
   - ❌ NO usamos `planificaciones.competencias_seleccionadas` (son competencias objetivo, no necesariamente usadas)

2. **Solo sesiones dictadas cuentan**:
   - ✅ Sesiones con `estado === 'dictada'` son las únicas que representan trabajo real realizado
   - ❌ Sesiones 'planificada', 'backlog', 'pausada', 'omitida' NO cuentan

3. **Materia de la sesión**:
   - ✅ Se obtiene a través de `planificacion.materia` (relación `sesion.planificacion_id → planificacion.id`)

#### Decisiones de Implementación

1. **Normalización de materias**:
   - Usar `normalizeSubjectName()` antes de obtener competencias
   - Esto maneja variantes como "Educación para la Ciudadanía" → "Formación para la ciudadanía"

2. **Manejo de materias desconocidas**:
   - Si la materia no tiene competencias definidas, retornar arrays vacíos
   - Mostrar mensaje apropiado en la UI

3. **Manejo de sesiones sin competencias**:
   - Sesiones con `competencias_anep` vacío o null se ignoran
   - No afectan el cálculo

4. **Manejo de IDs de competencias inválidos**:
   - Si un ID en `competencias_anep` no existe en el catálogo de la materia, se cuenta pero no se muestra nombre completo
   - Se muestra el ID como fallback

---

### 8. Cambios Implementados

#### Archivo: `src/pages/MisPlanificaciones.tsx`

**Cambios realizados**:

1. **Función helper para obtener competencias por materia**:
   ```typescript
   const getCompetenciasByMateria = (materia: string) => {
     const normalized = normalizeSubjectName(materia);
     switch (normalized) {
       case 'Historia':
         return COMPETENCIAS_HISTORIA;
       case 'Literatura':
         return COMPETENCIAS_LITERATURA;
       case 'Formación para la ciudadanía':
         return COMPETENCIAS_CIUDADANIA;
       default:
         return [];
     }
   };
   ```

2. **Función `calcularCompetenciasCount` mejorada**:
   - Obtiene competencias completas de la materia
   - Mapea IDs a objetos completos con nombre y código
   - Calcula porcentajes correctamente
   - Muestra nombre completo en lugar de solo ID

3. **Nueva función `calcularCompetenciasPendientes`**:
   - Obtiene todas las competencias de la materia
   - Obtiene IDs únicos de competencias usadas
   - Encuentra diferencias
   - Retorna objetos completos con información

4. **Integración con filtros**:
   - Ambas funciones se llaman cuando cambian los filtros
   - Respetan materia y rango de fechas

---

### 9. Casos Especiales Considerados

1. **Sin materia seleccionada**:
   - Si `filtroMateria === 'all'` o está vacío, no se puede calcular competencias pendientes (no sabemos qué competencias incluir)
   - El balance muestra todas las competencias de todas las materias (puede ser confuso, pero es el comportamiento actual)

2. **Sin rango de fechas**:
   - Si no hay rango seleccionado, se consideran todas las sesiones dictadas
   - Esto puede incluir sesiones de períodos anteriores

3. **Materia sin competencias definidas**:
   - Retorna arrays vacíos
   - UI muestra mensaje apropiado

4. **Sesiones sin competencias**:
   - Se ignoran en el cálculo
   - No afectan el total

---

### 10. Verificación

**Pruebas recomendadas**:

1. ✅ Seleccionar materia "Historia" → Ver 9 competencias en el catálogo
2. ✅ Seleccionar rango de fechas → Solo contar sesiones en ese rango
3. ✅ Marcar sesiones como "dictada" → Aparecen en el balance
4. ✅ Competencias no usadas → Aparecen en "Pendientes"
5. ✅ Cambiar filtros → Los cálculos se actualizan correctamente

**Comandos de verificación**:
```bash
npm run build  # Verificar que no hay errores TypeScript
```

---

## 📝 Resumen

**Problema identificado**:
- Balance mostraba solo IDs, no nombres completos
- Competencias pendientes no se calculaban

**Solución implementada**:
- Obtener competencias completas por materia
- Mapear IDs a objetos completos con nombre y código
- Calcular competencias pendientes como diferencia entre todas y usadas
- Respetar filtros de materia y fecha en ambos cálculos

**Fuente de verdad**:
- Competencias usadas: `sesiones_clase.competencias_anep` (solo sesiones dictadas)
- Competencias disponibles: Archivos de datos según materia normalizada

**Tablas de BD utilizadas**:
- `sesiones_clase` (campo `competencias_anep`, `fecha`, `estado`, `planificacion_id`)
- `planificaciones` (campo `materia`, para filtrar por materia)

---

**Status**: ✅ Implementado y documentado

---

## 🎨 Implementación de UI

### Tarjeta 1: Balance de Competencias

**Tipo**: Gráfico de barras horizontal (Recharts)

**Características**:
- Gráfico horizontal con barras de colores determinísticos
- Cada barra representa una competencia usada al menos una vez
- Etiqueta muestra: "CE# — Título" (código + nombre)
- Valor del conteo al final de cada barra
- Ordenamiento: por conteo DESC, luego por código ASC
- Colores estables y determinísticos basados en hash del ID de competencia

**Paleta de Colores**:
- 12 colores predefinidos en array `COMPETENCY_COLORS`
- Función `getCompetencyColor()` usa hash determinístico del ID de competencia
- Mapeo: `hash(competencyId) % palette.length` → color estable

**Estados**:
- **Loading**: Spinner con mensaje "Calculando balance..."
- **Sin datos**: Mensaje "No hay uso de competencias registrado en este período"
- **Sin materia seleccionada**: Mensaje informativo "Selecciona una materia para ver el balance..."

**Manejo de IDs desconocidos**:
- Si un ID en `competencias_anep` no existe en el catálogo:
  - Se muestra como "Competencia desconocida (id)" en el gráfico
  - Se agrupa con etiqueta "Desconocida (id)"
  - **NO afecta** el cálculo de competencias pendientes

**Tooltip**:
- Muestra etiqueta completa, conteo y porcentaje al hacer hover

### Tarjeta 2: Competencias Pendientes

**Tipo**: Lista vertical con scroll

**Características**:
- Lista limpia de competencias no usadas
- Cada item muestra:
  - Badge con código (ej: "CE3")
  - Nombre completo de la competencia
  - Descripción (truncada a 2 líneas con `line-clamp-2`)
- Ordenamiento: por código ASC (extrae número del código para orden numérico)
- Fondo amarillo claro con hover effect

**Estados**:
- **Loading**: Spinner con mensaje "Calculando pendientes..."
- **Sin pendientes**: Mensaje "¡Excelente! Todas las competencias fueron trabajadas en este período"
- **Sin materia seleccionada**: No se muestra (solo aparece cuando hay materia seleccionada)

**Filtros aplicados**:
- Solo se calcula cuando `filtroMateria !== 'all'` y no está vacío
- Respeta rango de fechas seleccionado
- Solo cuenta sesiones con `estado === 'dictada'`

### Requisito de Producto: Scoping a Una Materia

**Comportamiento**:
- Si `filtroMateria === 'all'` o está vacío:
  - Ambas tarjetas se ocultan
  - Se muestra una tarjeta única con mensaje: "Selecciona una materia para ver el balance de competencias y las competencias pendientes."
- Si hay materia seleccionada:
  - Ambas tarjetas se muestran con datos filtrados por esa materia y rango de fechas

---

## 🧪 Testing Manual (Paso a Paso)

### Prueba 1: Seleccionar Materia y Ver Balance

1. Ir a "Mis Planificaciones"
2. Seleccionar materia "Historia" en el filtro
3. **Resultado esperado**:
   - Aparecen dos tarjetas: "Balance de Competencias" y "Competencias Pendientes"
   - El balance muestra un gráfico horizontal con barras de colores
   - Cada barra tiene etiqueta "CE# — Título"
   - Los colores son estables (mismo color para misma competencia)

### Prueba 2: Filtrar por Rango de Fechas

1. Seleccionar materia "Historia"
2. Seleccionar rango de fechas (ej: último mes)
3. **Resultado esperado**:
   - El balance solo muestra competencias usadas en ese rango
   - Las pendientes solo muestran competencias no usadas en ese rango
   - El header muestra el rango de fechas seleccionado

### Prueba 3: Sin Materia Seleccionada

1. Asegurarse de que el filtro de materia esté en "Todas las materias"
2. **Resultado esperado**:
   - Las dos tarjetas desaparecen
   - Aparece una tarjeta con mensaje: "Selecciona una materia para ver el balance..."

### Prueba 4: Competencias Pendientes

1. Seleccionar materia "Historia"
2. Verificar que hay sesiones dictadas con competencias
3. **Resultado esperado**:
   - Si todas las competencias fueron usadas: mensaje "¡Excelente! Todas las competencias fueron trabajadas"
   - Si hay pendientes: lista con código, nombre y descripción
   - Las pendientes están ordenadas por código (CE1, CE2, CE3...)

### Prueba 5: Colores Estables

1. Seleccionar materia "Historia"
2. Notar los colores de las barras
3. Cambiar a otra materia y volver a "Historia"
4. **Resultado esperado**:
   - Los colores de las mismas competencias son idénticos
   - No cambian entre renders

### Prueba 6: IDs Desconocidos

1. (Requiere datos de prueba) Tener una sesión con `competencias_anep` que contenga un ID no existente en el catálogo
2. Seleccionar la materia correspondiente
3. **Resultado esperado**:
   - El balance muestra "Competencia desconocida (id)" en el gráfico
   - Las pendientes NO incluyen este ID (solo competencias del catálogo)

---

## 📁 Archivos Modificados

1. **`src/pages/MisPlanificaciones.tsx`**:
   - Agregada paleta de colores `COMPETENCY_COLORS`
   - Agregada función `getCompetencyColor()` para mapeo determinístico
   - Reemplazada UI de "Balance de Competencias" con gráfico horizontal
   - Mejorada UI de "Competencias Pendientes" con lista ordenada
   - Agregado estado cuando no hay materia seleccionada
   - Agregado campo `label` a `CompetenciaCount` para el gráfico
   - Mejorado ordenamiento de pendientes por código numérico
   - Agregado manejo de IDs desconocidos

2. **`refactor/competencias_balance_y_pendientes.md`** (este archivo):
   - Agregada sección de implementación de UI
   - Agregada sección de testing manual
   - Documentado mapeo de colores
   - Documentado comportamiento de scoping a una materia

---

## 🎨 Mapeo de Colores

**Algoritmo**:
```typescript
function getCompetencyColor(competencyId: string): string {
  // Hash determinístico del ID
  let hash = 0;
  for (let i = 0; i < competencyId.length; i++) {
    hash = ((hash << 5) - hash) + competencyId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % COMPETENCY_COLORS.length;
  return COMPETENCY_COLORS[index];
}
```

**Paleta** (12 colores):
- `#3b82f6` (blue)
- `#10b981` (green)
- `#f59e0b` (amber)
- `#ef4444` (red)
- `#8b5cf6` (purple)
- `#06b6d4` (cyan)
- `#f97316` (orange)
- `#ec4899` (pink)
- `#14b8a6` (teal)
- `#6366f1` (indigo)
- `#84cc16` (lime)
- `#eab308` (yellow)

**Garantías**:
- Mismo ID → mismo color (determinístico)
- Colores no cambian entre renders
- Distribución uniforme gracias al hash

---

**Status UI**: ✅ Implementado y documentado

---

## 🔧 Fix: Normalización de Datos (competencias_anep)

**Fecha**: 2025-12-19  
**Problema**: El gráfico "Balance de Competencias" mostraba "No usage recorded" aunque había sesiones con `competencias_anep` para la materia seleccionada.

### Causa Raíz

El campo `competencias_anep` no se normalizaba al cargar desde Supabase. Supabase puede devolver este campo en diferentes formatos:
- Como array `string[]` (esperado)
- Como `null` o `undefined`
- Como string (si hay problemas de serialización)
- Como objeto (si hay problemas de parsing)

Cuando el código intentaba iterar sobre `competencias_anep` usando `.forEach()`, fallaba silenciosamente si el campo no era un array válido, resultando en un balance vacío.

### Solución Implementada

**Ubicación**: `src/pages/MisPlanificaciones.tsx`, después de cargar sesiones (línea ~157)

**Cambio**:
```typescript
import { normalizeArrayField } from '@/lib/normalizeSupabaseArrays';

// Después de cargar sesiones desde Supabase
const sesionesNormalizadas = (sesionData || []).map((sesion) => ({
  ...sesion,
  competencias_anep: normalizeArrayField(sesion.competencias_anep),
}));

setSesiones(sesionesNormalizadas as unknown as SesionClase[]);
```

**Comportamiento**:
- `competencias_anep` siempre termina siendo un `string[]` válido
- Si viene como `null` o `undefined` → se convierte en `[]`
- Si viene como string → se convierte en array
- Si viene como objeto → se normaliza según la lógica de `normalizeArrayField()`

### Por Qué Funciona

1. **Normalización al cargar**: Garantiza que todos los datos estén en el formato correcto antes de cualquier procesamiento
2. **Sin cambios en lógica de negocio**: El fix es puramente de normalización de datos; no modifica filtros, cálculos ni reglas de negocio
3. **Consistencia**: Usa la misma función de normalización (`normalizeArrayField`) que se usa en otras partes de la aplicación (ej: `PlanificacionWizard.tsx`, `useFullSessionGeneration.ts`)

### Impacto

- ✅ El balance muestra datos correctamente cuando hay sesiones con competencias
- ✅ No afecta "Competencias Pendientes" (ya funcionaba correctamente)
- ✅ Mejora la robustez del código al manejar formatos inconsistentes de Supabase
- ✅ Consistente con el resto de la aplicación

### Verificación

Después del fix:
- Seleccionar una materia (ej: "Historia")
- Verificar que "Balance de Competencias" muestra barras horizontales cuando hay sesiones con `estado === 'dictada'` y `competencias_anep` no vacío
- Verificar que "Competencias Pendientes" sigue funcionando correctamente
- `npm run build` pasa sin errores de TypeScript

---

**Status Fix**: ✅ Implementado y verificado
























