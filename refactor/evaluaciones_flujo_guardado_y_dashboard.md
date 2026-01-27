# Evaluaciones: Flujo de Guardado Explícito y Dashboard

**Fecha**: 2025-12-22  
**Branch**: `Aulaplus-by-eitan-2`  
**Objetivo**: Implementar feature parity entre "Planificar clase" y "Generar evaluaciones", incluyendo guardado explícito y dashboard "Mis evaluaciones"

---

## 📋 Resumen del Producto

### Comportamiento Actual
- Sidebar → "Evaluaciones Grupales" → lleva directamente a configuración/generación
- Las evaluaciones no se guardan explícitamente
- No existe dashboard para ver evaluaciones guardadas

### Comportamiento Nuevo
- Sidebar → "Evaluaciones Grupales" → pantalla de elección con 2 opciones:
  1. **"Generar evaluación"** → va a configuración/generación (flujo existente)
  2. **"Mis evaluaciones"** → va a nuevo dashboard

- **Guardado explícito**: botón "Guardar evaluación" en el workspace
- **Dashboard "Mis evaluaciones"**: similar a "Mis planificaciones" con:
  - Filtros (materia, grupo, rango de fechas)
  - Balance de competencias (gráfico horizontal)
  - Competencias pendientes
  - Lista de evaluaciones guardadas

---

## 🗺️ Rutas

### Rutas Nuevas
- `/teacher-dashboard/evaluaciones` → Pantalla de elección
- `/teacher-dashboard/mis-evaluaciones` → Dashboard

### Rutas Existentes (modificadas)
- `/evaluaciones` → ahora debe ser `/teacher-dashboard/evaluaciones/generar` (config/workspace)

### Navegación del Sidebar
- Antes: `Evaluaciones Grupales` → `/evaluaciones`
- Ahora: `Evaluaciones Grupales` → `/teacher-dashboard/evaluaciones`

---

## 💾 Cambios en Base de Datos

### Tabla: `evaluaciones` (extender o crear)

#### Campos Nuevos/Requeridos
```sql
CREATE TABLE IF NOT EXISTS evaluaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  
  -- Identificación
  nombre text NOT NULL,  -- Nombre visible personalizado
  materia text NOT NULL,
  grupo_id text NOT NULL,
  
  -- Metadata temporal
  fecha date,  -- Para filtrado por rango
  
  -- Competencias
  competencias_anep text[] DEFAULT '{}',  -- IDs de competencias usadas
  
  -- Guardado explícito
  is_saved boolean DEFAULT false,
  saved_at timestamptz,
  deleted_at timestamptz,  -- Soft delete
  
  -- Payload de evaluación (campos existentes)
  -- ... otros campos según el modelo actual ...
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para queries comunes
CREATE INDEX idx_evaluaciones_user_saved 
  ON evaluaciones(user_id, is_saved, deleted_at)
  WHERE is_saved = true AND deleted_at IS NULL;

CREATE INDEX idx_evaluaciones_filters
  ON evaluaciones(materia, grupo_id, fecha)
  WHERE is_saved = true AND deleted_at IS NULL;
```

### Migración
- Archivo: `supabase/migrations/YYYYMMDDHHMMSS_add_evaluaciones_explicit_save.sql`
- NO auto-guardar evaluaciones existentes
- Solo agregar estructura

---

## 📁 Archivos Creados/Modificados

### Archivos Nuevos

#### Componentes/Páginas
- [x] **`src/pages/EvaluacionesChoice.tsx`** (97 líneas) - Pantalla de elección con 2 opciones
- [x] **`src/pages/MisEvaluaciones.tsx`** (464 líneas) - Dashboard completo con balance y lista

#### Migraciones
- [x] **`supabase/migrations/20251222000000_add_evaluaciones_explicit_save.sql`** (116 líneas)

### Archivos Modificados

#### Rutas y Navegación
- [x] **`src/App.tsx`** - Agregadas rutas:
  - `/evaluaciones` → `EvaluacionesChoice`
  - `/evaluaciones/nuevo` → `EvaluacionesGrupo`
  - `/mis-evaluaciones` → `MisEvaluaciones`
  - Imports actualizados

- [x] **`src/components/Breadcrumbs.tsx`** - Agregados breadcrumbs:
  - `/evaluaciones` → "Evaluaciones Grupales"
  - `/evaluaciones/nuevo` → "Generar Evaluación" (parent: `/evaluaciones`)
  - `/mis-evaluaciones` → "Mis Evaluaciones" (parent: `/evaluaciones`)

#### Workspace de Evaluación
- [x] **`src/pages/EvaluacionesGrupo.tsx`** - Cambios:
  - Agregado import de `Dialog`, `Input`, `useToast`, `supabase`, `normalizeArrayField`, `Save` icon
  - Agregado estado: `saveDialogOpen`, `nombreEvaluacion`, `isSaving`, `toast`
  - Agregada función: `handleSaveEvaluation()` (líneas ~340-401)
  - Agregado botón "Guardar evaluación" en header de resultados (líneas ~1330-1345)
  - Agregado modal de guardar con input de nombre (líneas ~1491-1533)

#### Utilidades
- Reutilizada: `normalizeArrayField()` para `competencias_anep`
- Reutilizada: `normalizeSubjectName()` para comparación de materias
- Reutilizados: catálogos de competencias existentes

---

## 🎨 Diseño UI

### Pantalla de Elección (EvaluacionesChoice)
Copiar estructura de pantalla de elección de planificaciones:
- Header con título "Evaluaciones Grupales"
- 2 cards grandes con iconos
- Card 1: "Generar evaluación" (ícono de documento/lápiz)
- Card 2: "Mis evaluaciones" (ícono de carpeta/lista)
- Mismo spacing, colores, tipografía

### Dashboard "Mis Evaluaciones"
Estructura similar a "Mis planificaciones":

#### Sección 1: Header + Filtros
- Título "Mis Evaluaciones"
- Botón "Volver"
- Filtros: materia (select), grupo (select), rango fechas (date picker), búsqueda

#### Sección 2: Cards de Competencias (2 columnas)
- **Balance de Competencias** (izquierda)
  - Gráfico horizontal Recharts
  - Labels dentro de las barras con contraste
  - Tooltip con detalle completo
  - Colores determinísticos por competencia
  
- **Competencias Pendientes** (derecha)
  - Lista vertical con scroll
  - Badge con código + título + descripción truncada
  - Estado vacío: "¡Excelente! Todas las competencias fueron trabajadas..."

#### Sección 3: Lista de Evaluaciones Guardadas
- Tabla/Cards con:
  - Checkbox para multi-select
  - Nombre personalizado
  - Materia + Grupo
  - Fecha
  - Acciones (ver, eliminar)
- Multi-select: botón "Eliminar seleccionadas" (soft delete)
- Modal de confirmación antes de eliminar

### Mensajes de Estado
- Sin materia seleccionada: "Selecciona una materia para ver el balance de competencias y las competencias pendientes."
- Sin evaluaciones guardadas: "Aún no has guardado evaluaciones"
- Loading: spinner + "Cargando evaluaciones..."

---

## 🔧 Lógica de Competencias

### Source of Truth
- Campo: `evaluaciones.competencias_anep` (text[] en DB)
- Normalización: usar `normalizeArrayField()` al cargar desde Supabase
- Catálogos: mismos que planificaciones (`COMPETENCIAS_HISTORIA`, `COMPETENCIAS_LITERATURA`, `COMPETENCIAS_CIUDADANIA`)

### Cálculo de Balance
Filtrar evaluaciones por:
1. `is_saved = true`
2. `deleted_at IS NULL`
3. `materia` = filtro seleccionado (usar `normalizeSubjectName`)
4. `grupo_id` = filtro seleccionado (si no es "all")
5. `fecha` dentro del rango (si está especificado)
6. `competencias_anep.length > 0`

Contar ocurrencias de cada competencia ID en el conjunto filtrado.

### Cálculo de Pendientes
Pendientes = (catálogo de la materia) - (IDs usados en evaluaciones filtradas)

---

## 🧪 Testing Manual

### Checklist de Pruebas

#### 1. Navegación Básica
- [ ] Sidebar "Evaluaciones Grupales" → va a pantalla de elección
- [ ] Pantalla de elección tiene 2 cards visibles
- [ ] Click "Generar evaluación" → va a configuración/workspace
- [ ] Click "Mis evaluaciones" → va a dashboard
- [ ] Breadcrumbs correctos en todas las rutas

#### 2. Guardado de Evaluación
- [ ] Generar una evaluación
- [ ] Aparece botón "Guardar evaluación" en workspace
- [ ] Click → modal para ingresar nombre
- [ ] Nombre prefillado con default sensato
- [ ] Confirmar → toast de éxito
- [ ] Evaluación NO aparece aún en "Mis evaluaciones"
- [ ] Hacer query directo en Supabase: `is_saved = true`, `saved_at` seteado

#### 3. Dashboard "Mis Evaluaciones"
- [ ] Dashboard se carga sin errores
- [ ] Mostrar mensaje si no hay evaluaciones guardadas
- [ ] Guardar 2-3 evaluaciones de distintas materias/grupos
- [ ] Filtrar por materia → solo muestra evaluaciones de esa materia
- [ ] Filtrar por grupo → solo muestra evaluaciones de ese grupo
- [ ] Filtrar por rango de fechas → solo muestra evaluaciones en ese rango
- [ ] Búsqueda por nombre funciona

#### 4. Balance de Competencias
- [ ] Si no hay materia seleccionada → mensaje info
- [ ] Seleccionar materia con evaluaciones que tienen competencias
- [ ] Gráfico muestra barras horizontales
- [ ] Labels dentro de las barras con texto legible (contraste correcto)
- [ ] Colores distintos por competencia, pero consistentes
- [ ] Tooltip muestra info completa
- [ ] Gráfico alineado al borde izquierdo (sin padding excesivo)

#### 5. Competencias Pendientes
- [ ] Muestra competencias no usadas en el scope actual
- [ ] Lista ordenada por código numérico
- [ ] Cada item muestra código, título, descripción truncada
- [ ] Si todas están usadas → mensaje positivo
- [ ] Scroll funciona si hay muchas

#### 6. Multi-select y Delete
- [ ] Checkbox en cada evaluación funciona
- [ ] "Seleccionar todas" funciona
- [ ] Botón "Eliminar seleccionadas" solo aparece si hay selección
- [ ] Click → modal de confirmación
- [ ] Confirmar → evaluaciones desaparecen (soft delete)
- [ ] Query directo: `deleted_at` seteado, `is_saved` sigue en true

#### 7. Edge Cases
- [ ] Crear evaluación sin competencias → no aparece en balance
- [ ] Crear evaluación sin fecha → manejo graceful
- [ ] Dos evaluaciones con mismo nombre → ambas se muestran
- [ ] Eliminar todas las evaluaciones de una materia → mensaje vacío correcto

---

## 🐛 Troubleshooting

### Problema: "Balance de Competencias" vacío aunque hay evaluaciones guardadas

**Causa probable**: 
- `competencias_anep` no normalizado al cargar
- Filtro de materia/grupo no coincide
- Campo `competencias_anep` vacío o null en DB

**Verificación**:
1. Abrir consola del navegador
2. Buscar logs con prefijo `[EVALUACIONES DIAGNOSTIC]`
3. Verificar:
   - Cantidad de evaluaciones cargadas
   - Cantidad después de cada filtro
   - Si `competencias_anep` es array válido

**Solución**:
- Normalizar al cargar: `normalizeArrayField(evaluacion.competencias_anep)`
- Verificar que materia use `normalizeSubjectName()` en ambos lados
- Asegurar que las evaluaciones guardadas tengan competencias asignadas

### Problema: Evaluaciones no aparecen después de guardar

**Causa probable**:
- `is_saved` no se seteó a true
- `saved_at` no se seteó
- Query en "Mis evaluaciones" no está filtrando correctamente

**Verificación**:
1. Query directo en Supabase: `SELECT * FROM evaluaciones WHERE id = '<id>'`
2. Verificar campos `is_saved`, `saved_at`, `deleted_at`

**Solución**:
- Asegurar que el UPDATE setea ambos campos:
  ```typescript
  .update({ 
    nombre: nombrePersonalizado,
    is_saved: true, 
    saved_at: new Date().toISOString() 
  })
  ```

### Problema: Error de tipo TypeScript en `competencias_anep`

**Causa probable**:
- Tipo esperado es `string[]` pero viene otro formato

**Solución**:
- Usar cast temporal: `as unknown as Evaluacion[]`
- O definir tipo explícito con campo opcional: `competencias_anep?: string[] | null`
- Normalizar siempre antes de usar

---

## 📊 Resumen de Cambios

### Rutas Agregadas
- `/teacher-dashboard/evaluaciones` (choice screen)
- `/teacher-dashboard/mis-evaluaciones` (dashboard)

### Rutas Modificadas
- `/evaluaciones` → `/teacher-dashboard/evaluaciones/generar`

### DB: Tabla `evaluaciones`
Campos agregados:
- `nombre` (text NOT NULL)
- `is_saved` (boolean DEFAULT false)
- `saved_at` (timestamptz)
- `deleted_at` (timestamptz)
- `competencias_anep` (text[] DEFAULT '{}')
- Posiblemente: `materia`, `grupo_id`, `fecha` si no existen

### Componentes Creados
1. `EvaluacionesChoice.tsx` - pantalla de elección
2. `MisEvaluaciones.tsx` - dashboard completo

### Componentes Modificados
1. `App.tsx` - rutas
2. `AppSidebar.tsx` - URL del ítem
3. `EvaluacionesGrupo.tsx` - botón guardar
4. `Breadcrumbs.tsx` - breadcrumbs nuevos

### Utilidades Reutilizadas
- `normalizeArrayField()` - para `competencias_anep`
- `normalizeSubjectName()` - para comparación de materias
- Catálogos de competencias existentes
- Componentes UI: Card, Button, Select, DateRangePicker, etc.

---

## ✅ Criterios de Aceptación

- [ ] Sidebar "Evaluaciones Grupales" va a pantalla de elección
- [ ] Pantalla de elección tiene 2 opciones funcionales
- [ ] Botón "Guardar evaluación" funciona en workspace
- [ ] Evaluaciones solo aparecen en "Mis evaluaciones" después de guardar
- [ ] Dashboard tiene filtros funcionales (materia, grupo, fechas)
- [ ] Balance de competencias muestra gráfico correcto
- [ ] Competencias pendientes calcula correctamente
- [ ] Multi-select y soft delete funciona
- [ ] No hay errores de TypeScript en build
- [ ] Diseño UI consistente con "Mis planificaciones"

---

---

## 💻 Detalles de Implementación

### 1. Migración de Base de Datos

**Archivo**: `supabase/migrations/20251222000000_add_evaluaciones_explicit_save.sql`

**Cambios**:
- Crea/extiende tabla `evaluaciones` con campos:
  - `nombre` (text) - Nombre personalizado visible
  - `competencias_anep` (text[]) - IDs de competencias usadas
  - `is_saved` (boolean) - Flag de guardado explícito
  - `saved_at` (timestamptz) - Timestamp de guardado
  - `deleted_at` (timestamptz) - Soft delete
  - `fecha` (date) - Para filtrado por rango
- Agrega índices para queries comunes:
  - `idx_evaluaciones_user_saved` - Para listar evaluaciones guardadas
  - `idx_evaluaciones_filters` - Para filtros (materia, grupo, fecha)
  - `idx_evaluaciones_competencias` - GIN index para competencias
- Trigger para `updated_at` automático

### 2. Pantalla de Elección (EvaluacionesChoice.tsx)

**Estructura**:
```tsx
- Header: "Evaluaciones Grupales" + botón "Nueva Evaluación"
- Grid 2 columnas:
  - Card 1: "Generar Evaluación" → /evaluaciones/nuevo
  - Card 2: "Mis Evaluaciones" → /mis-evaluaciones
```

**Iconografía**:
- Generar: `Plus` icon, color primary
- Mis Evaluaciones: `FolderOpen` icon, color secondary

### 3. Dashboard MisEvaluaciones.tsx

**Estructura**:
```tsx
- Header: "Mis Evaluaciones" + botón volver
- Filtros: búsqueda, materia, grupo, rango fechas
- Cards de competencias (condicional si materia seleccionada):
  - Balance de Competencias (gráfico horizontal)
  - Competencias Pendientes (lista)
- Card: Evaluaciones Guardadas (lista con multi-select)
- Modal: Confirmación de eliminación
```

**Lógica de Filtrado**:
1. Evalua evaluaciones guardadas (`is_saved=true`, `deleted_at IS NULL`)
2. Normaliza `competencias_anep` al cargar
3. Filtra por: competencias no vacías, rango fechas, materia (normalizada), grupo
4. Calcula balance y pendientes sobre el conjunto filtrado

**Balance de Competencias**:
- Gráfico horizontal Recharts
- Labels dentro de las barras con contraste automático
- Colores determinísticos por competencia ID
- YAxis oculto (sin padding izquierdo)
- Tooltip con info completa (label, count, porcentaje)
- Truncamiento inteligente de labels según ancho

**Competencias Pendientes**:
- Lista vertical con scroll
- Badge + título + descripción truncada
- Ordenada por código numérico

**Lista de Evaluaciones**:
- Checkbox multi-select
- Info: nombre, materia, grupo, fecha, competencias count
- Botón "Eliminar seleccionadas" (soft delete)
- Modal de confirmación antes de eliminar

### 4. Guardado en Workspace (EvaluacionesGrupo.tsx)

**Cambios**:
- Agregado botón "Guardar evaluación" en header de resultados
- Modal para ingresar nombre personalizado
- Prefill con default: "Evaluación {materia} - {grupo}"
- Función `handleSaveEvaluation()`:
  - Valida nombre no vacío
  - Obtiene user_id de auth
  - Crea registro en `evaluaciones` con:
    - `nombre`, `materia`, `grupo_id`, `nivel`, `fecha`
    - `competencias_anep` normalizado
    - `contenidos`, `criterios_logro`, `requerimientos`
    - `evaluacion_generada` (JSON con todas las versiones)
    - `is_saved=true`, `saved_at=now`
  - Toast de éxito
  - Navega a "/mis-evaluaciones" después de 1.5s

### 5. Rutas (App.tsx)

**Imports agregados**:
```tsx
import EvaluacionesChoice from "./pages/EvaluacionesChoice";
import MisEvaluaciones from "./pages/MisEvaluaciones";
```

**Rutas agregadas**:
```tsx
<Route path="/evaluaciones" element={...} /> // ahora va a Choice
<Route path="/evaluaciones/nuevo" element={...} /> // generación
<Route path="/mis-evaluaciones" element={...} /> // dashboard
```

### 6. Breadcrumbs (Breadcrumbs.tsx)

**Config agregada**:
```tsx
"/evaluaciones": { label: "Evaluaciones Grupales", parent: "/" },
"/evaluaciones/nuevo": { label: "Generar Evaluación", parent: "/evaluaciones" },
"/mis-evaluaciones": { label: "Mis Evaluaciones", parent: "/evaluaciones" },
```

---

## 🔍 Cómo Funciona el Balance de Competencias

### Source of Truth
- **Campo**: `evaluaciones.competencias_anep` (text[] en DB)
- **Normalización**: Al cargar desde Supabase se aplica `normalizeArrayField()`
- **Catálogos**: Reutiliza catálogos existentes:
  - `COMPETENCIAS_HISTORIA`
  - `COMPETENCIAS_LITERATURA`
  - `COMPETENCIAS_CIUDADANIA`

### Algoritmo de Balance

1. **Filtrar evaluaciones**:
   ```typescript
   - is_saved = true AND deleted_at IS NULL
   - competencias_anep.length > 0
   - materia = filtroMateria (normalizado)
   - grupo_id = filtroGrupo (si no es "all")
   - fecha dentro de rango (si está especificado)
   ```

2. **Contar competencias**:
   ```typescript
   evaluacionesFiltradas.forEach(evaluacion => {
     evaluacion.competencias_anep.forEach(compId => {
       countMap.set(compId, (countMap.get(compId) || 0) + 1);
     });
   });
   ```

3. **Mapear a datos completos**:
   ```typescript
   - Buscar en catálogo por ID
   - Si no existe: mostrar como "Unknown (id)"
   - Calcular porcentaje: (count / total) * 100
   - Ordenar: count DESC, luego codigo ASC
   ```

### Algoritmo de Pendientes

```typescript
usadas = Set de IDs en evaluacionesFiltradas
pendientes = catálogo.filter(comp => !usadas.has(comp.id))
            .sort((a,b) => numeric(a.codigo) - numeric(b.codigo))
```

---

**Status**: ✅ Implementación completada  
**Branch**: `Aulaplus-by-eitan-2`  
**Build**: Pasa sin errores de TypeScript  
**Próximo paso**: Testing manual y commit























