# UI de Contemplaciones en Perfil de Estudiante

**Ubicación del código:** `src/components/StudentProfile.tsx`

**Fecha de creación:** 2026-01-23

---

## Resumen

La UI de contemplaciones en el perfil del estudiante está dividida en dos secciones independientes:
- **Contemplaciones para la clase**
- **Contemplaciones para evaluaciones**

Cada sección permite:
- Seleccionar contemplaciones del catálogo oficial (1-26)
- Agregar contemplaciones personalizadas (custom) con título visible y regla oculta
- Ver badge "Sugerido" para contemplaciones preseleccionadas

---

## Estructura de la UI

### Sección Principal

La sección "Contemplaciones" contiene dos subsecciones:

1. **Contemplaciones para la clase**
   - Muestra contemplaciones del catálogo aplicables a clase
   - Incluye contemplaciones de categoría `'clase'` y `'ambas'`
   - Permite agregar contemplaciones custom específicas para clase

2. **Contemplaciones para evaluaciones**
   - Muestra contemplaciones del catálogo aplicables a evaluaciones
   - Incluye contemplaciones de categoría `'evaluaciones'` y `'ambas'`
   - Permite agregar contemplaciones custom específicas para evaluaciones

### Contemplaciones del Catálogo

Cada contemplación del catálogo se muestra como:
- **Checkbox** clickeable para seleccionar/deseleccionar
- **Label** con el nombre canónico de la contemplación
- **Badge "Sugerido"** (si aplica) - NO es parte del label, es un elemento visual separado

**Características:**
- Las contemplaciones se filtran automáticamente por categoría
- Las contemplaciones de categoría `'ambas'` aparecen en ambas secciones
- La selección se persiste automáticamente en localStorage usando `storage.ts`
- Los IDs se normalizan automáticamente (#9 y #22 → `contemplacion-9-22`)

### Contemplaciones Personalizadas (Custom)

Cada sección permite agregar contemplaciones personalizadas:

**Características:**
- **Título visible**: Se muestra en la lista de contemplaciones
- **Regla oculta**: NO se muestra en la lista, solo en el modal de edición
- **Selección**: Puede estar seleccionada o no (checkbox)
- **Edición**: Botón de editar para modificar título y regla
- **Eliminación**: Botón de eliminar para quitar la contemplación custom

**Modal de Edición:**
- Se abre al hacer clic en "Agregar contemplación" o en el botón de editar
- Campos:
  - **Título (visible)**: Input de texto
  - **Regla (oculta)**: Textarea con descripción de que no se muestra en la lista
- Botones: Cancelar, Guardar cambios / Agregar

---

## Badge "Sugerido"

### Comportamiento

El badge "Sugerido" se muestra para contemplaciones que:
- Están en `student.contemplaciones` (array legacy)
- Pueden estar preseleccionadas al cargar el perfil

### Reglas Importantes

1. **NO es parte del nombre**: El badge es un elemento visual separado, NO se incluye en el `label` de la contemplación
2. **Puede deseleccionarse**: El docente puede deseleccionar una contemplación sugerida
3. **Visual**: Badge azul claro con texto "Sugerido"
4. **Posición**: Aparece junto al label, no dentro del texto

### Implementación

```tsx
{isSuggested && (
  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
    Sugerido
  </Badge>
)}
```

---

## Persistencia

### Selecciones del Catálogo

- **Storage**: `storage.ts` - `readSelected()` / `writeSelected()`
- **Keys**: 
  - `contemplacionesClase:${studentId}`
  - `contemplacionesEval:${studentId}`
- **Formato**: `string[]` (array de IDs de contemplaciones)

### Contemplaciones Custom

- **Storage**: `storage.ts` - `readCustom()` / `writeCustom()`
- **Keys**:
  - `contemplacionesCustomClase:${studentId}`
  - `contemplacionesCustomEval:${studentId}`
- **Formato**: `CustomContemplacion[]`

### Sincronización

- Las selecciones se guardan automáticamente al hacer toggle
- Las contemplaciones custom se guardan al agregar/editar/eliminar
- No hay botón de "Guardar" explícito - todo se persiste en tiempo real

---

## Flujo de Usuario

### Seleccionar Contemplación del Catálogo

1. Usuario hace clic en el checkbox o en el área de la contemplación
2. El estado local se actualiza inmediatamente
3. Se llama a `toggleSelected()` de `storage.ts`
4. La selección se guarda en localStorage
5. La UI se actualiza para mostrar el estado seleccionado

### Agregar Contemplación Custom

1. Usuario hace clic en "Agregar contemplación" en la sección correspondiente
2. Se abre el modal de edición
3. Usuario ingresa:
   - Título (visible)
   - Regla (oculta)
4. Usuario hace clic en "Agregar"
5. Se llama a `addCustom()` de `storage.ts`
6. La contemplación se agrega a la lista y se marca como seleccionada
7. El modal se cierra

### Editar Contemplación Custom

1. Usuario hace clic en el botón de editar (ícono de lápiz)
2. Se abre el modal de edición con los valores actuales
3. Usuario modifica título y/o regla
4. Usuario hace clic en "Guardar cambios"
5. Se llama a `updateCustom()` de `storage.ts`
6. La contemplación se actualiza en la lista
7. El modal se cierra

### Eliminar Contemplación Custom

1. Usuario hace clic en el botón de eliminar (ícono de basura)
2. Se llama a `removeCustom()` de `storage.ts`
3. La contemplación se elimina de la lista inmediatamente

### Toggle Selección de Custom

1. Usuario hace clic en el checkbox de una contemplación custom
2. Se llama a `toggleCustomSelected()` de `storage.ts`
3. El estado `selected` se actualiza
4. La UI refleja el cambio visualmente

---

## Separación de Categorías

### Independencia

Las dos secciones (clase y evaluaciones) son **completamente independientes**:

- Selecciones separadas
- Contemplaciones custom separadas
- No hay sincronización entre secciones
- Un docente puede tener diferentes contemplaciones para clase vs evaluaciones

### Contemplaciones "Ambas"

Las contemplaciones de categoría `'ambas'` aparecen en **ambas secciones**:

- Pueden estar seleccionadas solo en clase
- Pueden estar seleccionadas solo en evaluaciones
- Pueden estar seleccionadas en ambas
- La selección es independiente en cada sección

---

## Regla Oculta en Contemplaciones Custom

### Propósito

La "regla oculta" en contemplaciones custom:
- **NO se muestra** en la lista de contemplaciones
- **Solo se muestra** en el modal de edición
- Se usa para **lógica del sistema** (futuras integraciones)
- Permite al docente especificar detalles técnicos sin saturar la UI

### Ejemplo

**Título visible**: "Permitir uso de calculadora gráfica"

**Regla oculta**: "Permitir calculadora gráfica en ejercicios de funciones y gráficos. No permitir en evaluaciones de álgebra básica."

El usuario solo ve el título en la lista, pero la regla completa está disponible para la lógica del sistema.

---

## Compatibilidad con Datos Legacy

### student.contemplaciones

El array `student.contemplaciones` (formato legacy) se usa para:
- Determinar qué contemplaciones mostrar el badge "Sugerido"
- Puede contener IDs o labels (se verifica ambos)

### Migración

- Los datos legacy NO se migran automáticamente
- El docente debe seleccionar manualmente las contemplaciones en las nuevas secciones
- Esto permite una transición limpia y evita datos inconsistentes

---

## Notas de Implementación

### No Inferir Ajustes

**IMPORTANTE**: Esta implementación NO infiere "ajustes necesarios" desde las contemplaciones seleccionadas.

- Las contemplaciones son solo selecciones del docente
- No afectan automáticamente flags como `adecuacionAcceso` o `adecuacionContenido`
- Esos flags se controlan explícitamente en otra sección del perfil

### Estado Local vs Storage

- El estado local (`useState`) se sincroniza con `storage.ts`
- `storage.ts` maneja la persistencia en localStorage
- Los cambios se reflejan inmediatamente en la UI

### Normalización de IDs

- Todos los IDs se normalizan automáticamente usando `normalizeContemplacionId()`
- Esto asegura que #9 y #22 siempre se traten como `contemplacion-9-22`
- La deduplicación es automática

---

## Próximos Pasos

Esta implementación es solo la UI del perfil. Las siguientes integraciones vendrán después:

1. **Integración con evaluaciones**: Usar contemplaciones seleccionadas al generar evaluaciones
2. **Integración con planificación**: Usar contemplaciones de clase al generar planes
3. **Materialización**: Aplicar las contemplaciones según su tipo de materialización
4. **Migración a base de datos**: Mover de localStorage a Supabase

---

**Última actualización:** 2026-01-23



