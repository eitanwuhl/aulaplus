# Block A: State & Trust UX Implementation

## Resumen

Implementación de estados explícitos de UI (loading, empty, error) en las páginas `MisEvaluaciones` y `MisPlanificaciones` para mejorar la experiencia del usuario y generar confianza mediante feedback claro del estado de la aplicación.

## Archivos Modificados

1. `src/pages/MisEvaluaciones.tsx`
2. `src/pages/MisPlanificaciones.tsx`

## Cambios Realizados

### MisEvaluaciones.tsx

#### Cambio 1: Agregado estado de error faltante
**Ubicación**: Línea ~70

**Antes:**
```typescript
const [isLoading, setIsLoading] = useState(true);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

**Después:**
```typescript
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<Error | null>(null);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

**Razón**: El código ya usaba `setError()` y verificaba `if (error)`, pero la variable de estado no estaba declarada, lo que causaría un error en runtime.

#### Estado de la Máquina de Estados
La página ya tenía implementados los tres estados correctamente, pero faltaba la declaración del estado de error. La máquina de estados es:

1. **Loading** → Si `isLoading === true`, muestra spinner con mensaje "Cargando evaluaciones..."
2. **Error** → Si `error !== null`, muestra mensaje de error con botón "Reintentar"
3. **Empty/Data** → Si no está cargando ni hay error, muestra contenido (vacío si `evaluaciones.length === 0`, o lista de datos)

### MisPlanificaciones.tsx

#### Cambio 1: Extracción de función `cargarDatos` fuera de useEffect
**Ubicación**: Línea ~147

**Antes:**
```typescript
useEffect(() => {
  const cargarDatos = async () => {
    // ... código ...
  };
  cargarDatos();
}, [toast]);
```

**Después:**
```typescript
const cargarDatos = async () => {
  // ... código ...
};

useEffect(() => {
  cargarDatos();
}, [toast]);
```

**Razón**: Permite reutilizar `cargarDatos` en el botón "Reintentar" del estado de error.

#### Cambio 2: Agregado `setError(null)` al inicio de cargarDatos
**Ubicación**: Línea ~150

**Antes:**
```typescript
const cargarDatos = async () => {
  setIsLoading(true);
  try {
```

**Después:**
```typescript
const cargarDatos = async () => {
  setIsLoading(true);
  setError(null);
  try {
```

**Razón**: Limpia el estado de error anterior al iniciar una nueva carga.

#### Cambio 3: Agregado `setError` en catch block
**Ubicación**: Línea ~213

**Antes:**
```typescript
} catch (error) {
  console.error('Error cargando datos:', error);
  toast({
    title: "Error",
    description: "No se pudieron cargar las planificaciones. Por favor, recargá la página.",
    variant: "destructive"
  });
} finally {
```

**Después:**
```typescript
} catch (error) {
  console.error('Error cargando datos:', error);
  const errorObj = error instanceof Error ? error : new Error('Error desconocido al cargar planificaciones');
  setError(errorObj);
  toast({
    title: "Error",
    description: "No se pudieron cargar las planificaciones. Por favor, intentá nuevamente.",
    variant: "destructive"
  });
} finally {
```

**Razón**: Guarda el error en el estado para que la UI pueda mostrar el estado de error explícito.

#### Cambio 4: Agregado `setError` en caso PGRST204
**Ubicación**: Línea ~164

**Antes:**
```typescript
if (planError.code === 'PGRST204' || planError.message.includes('is_saved')) {
  console.error('❌ MIGRACIÓN FALTANTE: La columna is_saved no existe en planificaciones');
  toast({
    title: "Error de Base de Datos",
    description: "Falta aplicar migración de planificaciones. Contacta al administrador o ejecuta: supabase db push",
    variant: "destructive"
  });
  setIsLoading(false);
  return;
}
```

**Después:**
```typescript
if (planError.code === 'PGRST204' || planError.message.includes('is_saved')) {
  console.error('❌ MIGRACIÓN FALTANTE: La columna is_saved no existe en planificaciones');
  const errorObj = new Error('Falta aplicar migración de planificaciones. Contacta al administrador o ejecuta: supabase db push');
  setError(errorObj);
  toast({
    title: "Error de Base de Datos",
    description: "Falta aplicar migración de planificaciones. Contacta al administrador o ejecuta: supabase db push",
    variant: "destructive"
  });
  setIsLoading(false);
  return;
}
```

**Razón**: También guarda errores de migración en el estado de error para mostrar la UI de error.

#### Cambio 5: Agregado estado de error UI
**Ubicación**: Línea ~1008 (después del estado de loading)

**Antes:**
```typescript
if (isLoading) {
  return (
    // ... loading UI ...
  );
}

return (
  <ErrorBoundary>
    // ... contenido principal ...
```

**Después:**
```typescript
if (isLoading) {
  return (
    // ... loading UI ...
  );
}

// Render error state
if (error) {
  return (
    <ErrorBoundary>
      <div className="container space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {/* ... header ... */}
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Error al cargar planificaciones</h3>
            <p className="text-muted-foreground mb-6">
              No se pudieron cargar las planificaciones. Por favor, intentá nuevamente.
            </p>
            <Button onClick={cargarDatos}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// Render empty state (when no data at all, not just filtered out)
const hasNoData = planificaciones.length === 0;

return (
  <ErrorBoundary>
    // ... contenido principal ...
```

**Razón**: Agrega la UI explícita de error que falta, con mensaje en español y botón "Reintentar" que ejecuta `cargarDatos()`.

#### Cambio 6: Definición de variable `hasNoData`
**Ubicación**: Línea ~1049

**Antes:**
```typescript
{/* Empty State - No data at all */}
{hasNoData ? (
```

La variable `hasNoData` no estaba definida.

**Después:**
```typescript
// Render empty state (when no data at all, not just filtered out)
const hasNoData = planificaciones.length === 0;

return (
  <ErrorBoundary>
    {/* Empty State - No data at all */}
    {hasNoData ? (
```

**Razón**: Define la variable que se usa para determinar si mostrar el estado vacío.

## Comportamiento Antes vs Después

### Antes

#### MisEvaluaciones
- ✅ Tenía loading state
- ✅ Tenía empty state
- ❌ Estado de error referenciado pero no declarado (bug latente)
- ✅ Estado de error UI existía pero podría fallar en runtime

#### MisPlanificaciones
- ✅ Tenía loading state
- ✅ Tenía empty state (pero variable `hasNoData` no definida - bug)
- ❌ No guardaba errores en estado
- ❌ No tenía UI de error explícita
- ❌ Botón "Reintentar" no disponible

### Después

#### MisEvaluaciones
- ✅ Loading state explícito
- ✅ Error state explícito con botón "Reintentar"
- ✅ Empty state explícito con CTA a `/evaluaciones/nuevo`
- ✅ Máquina de estados correcta: loading → error OR loading → success(empty|data)

#### MisPlanificaciones
- ✅ Loading state explícito
- ✅ Error state explícito con botón "Reintentar"
- ✅ Empty state explícito con CTA a `/planificacion/nuevo`
- ✅ Máquina de estados correcta: loading → error OR loading → success(empty|data)
- ✅ Variable `hasNoData` definida correctamente

## Máquina de Estados

Ambas páginas ahora implementan la misma máquina de estados:

```
Inicio → isLoading = true
    ↓
[Loading UI] (spinner + mensaje en español)
    ↓
┌───────────┴───────────┐
│                       │
↓ (éxito)               ↓ (error)
setIsLoading(false)     setError(errorObj)
setEvaluaciones/        setIsLoading(false)
setPlanificaciones
    │                       │
    ↓                       ↓
[Success]              [Error UI]
    │                   (mensaje + botón "Reintentar")
    │                           │
    │                           │ (click Reintentar)
    │                           ↓
    │                   cargarDatos() (reinicia)
    │
    ├─── hasNoData === true → [Empty UI] (CTA button)
    │
    └─── hasNoData === false → [Data UI] (lista con filtros/charts)
```

**Garantías**:
- No se muestra empty state mientras `isLoading === true` (sin flicker)
- No se muestra contenido de datos mientras hay un error
- El estado de error persiste hasta que el usuario hace click en "Reintentar" o recarga la página

## Rutas de Navegación (CTAs)

- **MisEvaluaciones Empty State**: CTA navega a `/evaluaciones/nuevo`
- **MisPlanificaciones Empty State**: CTA navega a `/planificacion/nuevo`

Ambas rutas fueron verificadas y existen en `src/App.tsx`.

## Checklist de Pruebas Manuales

### MisEvaluaciones

#### Test 1: Estado de Carga
1. Navegar a `/evaluaciones/mis-evaluaciones`
2. **Resultado esperado**: Ver spinner con mensaje "Cargando evaluaciones..." y header completo
3. **Estado esperado**: No debe mostrar lista vacía ni errores durante la carga

#### Test 2: Estado Vacío (sin datos)
1. Asegurarse de no tener evaluaciones guardadas (`is_saved = true` y `deleted_at IS NULL`)
2. Navegar a `/evaluaciones/mis-evaluaciones`
3. **Resultado esperado**: 
   - Ver mensaje "Aún no has guardado evaluaciones"
   - Ver botón "Generar evaluación" que navega a `/evaluaciones/nuevo`
   - No debe mostrar filtros ni gráficos

#### Test 3: Estado de Error (simulado)
1. Desconectar internet o modificar temporalmente la query de Supabase para forzar error
2. Navegar a `/evaluaciones/mis-evaluaciones`
3. **Resultado esperado**:
   - Ver ícono de alerta (AlertTriangle)
   - Ver mensaje "Error al cargar evaluaciones"
   - Ver mensaje "No se pudieron cargar las evaluaciones. Por favor, intentá nuevamente."
   - Ver botón "Reintentar" que reintenta la carga
   - Ver toast de error (comportamiento existente mantenido)

#### Test 4: Estado con Datos
1. Asegurarse de tener al menos una evaluación guardada
2. Navegar a `/evaluaciones/mis-evaluaciones`
3. **Resultado esperado**:
   - Ver lista de evaluaciones
   - Ver filtros funcionando
   - Ver gráficos de balance de competencias (si hay materia seleccionada)

#### Test 5: Transición Loading → Success
1. Usar DevTools para ralentizar red (Throttling)
2. Navegar a `/evaluaciones/mis-evaluaciones`
3. **Resultado esperado**:
   - Ver loading state primero
   - NO ver empty state durante loading (sin flicker)
   - Transición suave a success/empty/data

### MisPlanificaciones

#### Test 1: Estado de Carga
1. Navegar a `/planificacion/mis-planificaciones`
2. **Resultado esperado**: Ver spinner con mensaje "Cargando planificaciones..." y header completo
3. **Estado esperado**: No debe mostrar lista vacía ni errores durante la carga

#### Test 2: Estado Vacío (sin datos)
1. Asegurarse de no tener planificaciones guardadas (`is_saved = true` y `deleted_at IS NULL`)
2. Navegar a `/planificacion/mis-planificaciones`
3. **Resultado esperado**:
   - Ver mensaje "Aún no has guardado planificaciones"
   - Ver botón "Crear planificación" que navega a `/planificacion/nuevo`
   - No debe mostrar filtros ni gráficos

#### Test 3: Estado de Error (simulado)
1. Desconectar internet o modificar temporalmente la query de Supabase para forzar error
2. Navegar a `/planificacion/mis-planificaciones`
3. **Resultado esperado**:
   - Ver ícono de alerta (AlertTriangle)
   - Ver mensaje "Error al cargar planificaciones"
   - Ver mensaje "No se pudieron cargar las planificaciones. Por favor, intentá nuevamente."
   - Ver botón "Reintentar" que reintenta la carga
   - Ver toast de error (comportamiento existente mantenido)

#### Test 4: Estado con Datos
1. Asegurarse de tener al menos una planificación guardada
2. Navegar a `/planificacion/mis-planificaciones`
3. **Resultado esperado**:
   - Ver lista de planificaciones
   - Ver filtros funcionando
   - Ver gráficos de balance de competencias (si hay materia seleccionada)

#### Test 5: Transición Loading → Success
1. Usar DevTools para ralentizar red (Throttling)
2. Navegar a `/planificacion/mis-planificaciones`
3. **Resultado esperado**:
   - Ver loading state primero
   - NO ver empty state durante loading (sin flicker)
   - Transición suave a success/empty/data

#### Test 6: Botón Reintentar en Error
1. Forzar error (desconectar red)
2. Navegar a `/planificacion/mis-planificaciones`
3. Click en botón "Reintentar"
4. **Resultado esperado**:
   - Ver loading state brevemente
   - Si el error persiste, volver a error state
   - Si la conexión se restablece, cargar datos exitosamente

## Notas Técnicas

- **Toasts mantenidos**: Los toasts de error existentes se mantienen, pero ahora la UI de error también se muestra. Esto proporciona feedback inmediato (toast) y persistente (UI de error).
- **No se cambió lógica de negocio**: Solo se agregaron estados UI explícitos. Los filtros, gráficos, y lógica de datos permanecen intactos.
- **Sin cambios en esquema de base de datos**: Solo cambios en el frontend.
- **Reutilización de componentes UI**: Se usan componentes existentes (`Button`, `AlertTriangle`, `RefreshCw`, etc.) sin crear nuevos componentes.
- **Idioma**: Todos los mensajes están en español como se requiere.

## Observaciones

- El código de `MisEvaluaciones` ya tenía la estructura correcta pero faltaba la declaración del estado `error`. Esto era un bug latente que se corregió.
- `MisPlanificaciones` tenía una estructura similar pero le faltaba completamente la UI de error y el manejo adecuado del estado de error.
- Ambos archivos ahora tienen una estructura consistente y predecible para los estados UI.






















