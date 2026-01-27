# Persistencia de Contemplaciones en localStorage

**Ubicación del código:** `src/lib/contemplaciones/storage.ts`

**Fecha de creación:** 2026-01-23

---

## Resumen

Este módulo maneja la persistencia de selecciones de contemplaciones y contemplaciones personalizadas (custom) por estudiante y categoría (clase/evaluaciones) usando localStorage.

---

## Keys de localStorage

### Selecciones de Contemplaciones del Catálogo

**Formato:** `contemplaciones{Category}:${studentId}`

- **`contemplacionesClase:${studentId}`**
  - Tipo: `string[]`
  - Contenido: Array de IDs de contemplaciones del catálogo seleccionadas para clase
  - Ejemplo: `["contemplacion-1", "contemplacion-2", "contemplacion-9-22"]`

- **`contemplacionesEval:${studentId}`**
  - Tipo: `string[]`
  - Contenido: Array de IDs de contemplaciones del catálogo seleccionadas para evaluaciones
  - Ejemplo: `["contemplacion-3", "contemplacion-5", "contemplacion-9-22"]`

### Contemplaciones Personalizadas (Custom)

**Formato:** `contemplacionesCustom{Category}:${studentId}`

- **`contemplacionesCustomClase:${studentId}`**
  - Tipo: `CustomContemplacion[]`
  - Contenido: Array de contemplaciones personalizadas para clase
  - Estructura: Ver [CustomContemplacion](#customcontemplacion)

- **`contemplacionesCustomEval:${studentId}`**
  - Tipo: `CustomContemplacion[]`
  - Contenido: Array de contemplaciones personalizadas para evaluaciones
  - Estructura: Ver [CustomContemplacion](#customcontemplacion)

---

## Estructura de Datos

### CustomContemplacion

```typescript
interface CustomContemplacion {
  id: string;        // ID único generado (ej: 'custom-1234567890-abc123')
  title: string;     // Título visible para el docente
  rule: string;      // Regla oculta (no visible en UI, solo para lógica)
  selected: boolean; // Si está seleccionada actualmente
}
```

**Ejemplo:**
```json
{
  "id": "custom-1706025600000-xyz789",
  "title": "Permitir uso de calculadora gráfica",
  "rule": "Permitir calculadora gráfica en ejercicios de funciones",
  "selected": true
}
```

---

## Funciones Principales

### Lectura

#### `readSelected(studentId, category): string[]`
Lee las contemplaciones del catálogo seleccionadas para un estudiante y categoría.

**Parámetros:**
- `studentId`: `string | number` - ID del estudiante
- `category`: `'clase' | 'evaluaciones'` - Categoría

**Retorna:** Array de IDs de contemplaciones (normalizados)

**Ejemplo:**
```typescript
const selected = readSelected('123', 'clase');
// → ['contemplacion-1', 'contemplacion-2']
```

#### `readCustom(studentId, category): CustomContemplacion[]`
Lee las contemplaciones personalizadas para un estudiante y categoría.

**Parámetros:**
- `studentId`: `string | number` - ID del estudiante
- `category`: `'clase' | 'evaluaciones'` - Categoría

**Retorna:** Array de contemplaciones custom

**Ejemplo:**
```typescript
const custom = readCustom('123', 'evaluaciones');
// → [{ id: 'custom-123', title: '...', rule: '...', selected: true }]
```

### Escritura

#### `writeSelected(studentId, category, ids): void`
Guarda las contemplaciones del catálogo seleccionadas para un estudiante y categoría.

**Parámetros:**
- `studentId`: `string | number` - ID del estudiante
- `category`: `'clase' | 'evaluaciones'` - Categoría
- `ids`: `string[]` - Array de IDs de contemplaciones (se normalizan automáticamente)

**Ejemplo:**
```typescript
writeSelected('123', 'clase', ['contemplacion-1', 'contemplacion-2']);
```

#### `writeCustom(studentId, category, items): void`
Guarda las contemplaciones personalizadas para un estudiante y categoría.

**Parámetros:**
- `studentId`: `string | number` - ID del estudiante
- `category`: `'clase' | 'evaluaciones'` - Categoría
- `items`: `CustomContemplacion[]` - Array de contemplaciones custom

**Ejemplo:**
```typescript
writeCustom('123', 'evaluaciones', [
  { id: 'custom-1', title: 'Permitir calculadora', rule: '...', selected: true }
]);
```

---

## Funciones Helper

### Toggle de Selecciones

#### `toggleSelected(studentId, category, contemplacionId): string[]`
Alterna la selección de una contemplación del catálogo.

**Retorna:** Nuevo array de IDs seleccionados

**Ejemplo:**
```typescript
const newSelection = toggleSelected('123', 'clase', 'contemplacion-1');
// Si estaba seleccionada, la deselecciona; si no, la selecciona
```

#### `isSelected(studentId, category, contemplacionId): boolean`
Verifica si una contemplación del catálogo está seleccionada.

**Ejemplo:**
```typescript
const selected = isSelected('123', 'clase', 'contemplacion-1');
// → true o false
```

### Gestión de Contemplaciones Custom

#### `addCustom(studentId, category, title, rule, selected?): string`
Agrega una nueva contemplación personalizada.

**Parámetros:**
- `title`: Título visible
- `rule`: Regla oculta
- `selected`: Si debe estar seleccionada inicialmente (default: `false`)

**Retorna:** ID generado para la contemplación custom

**Ejemplo:**
```typescript
const id = addCustom('123', 'clase', 'Permitir calculadora', 'Permitir calculadora en ejercicios', true);
// → 'custom-1706025600000-abc123'
```

#### `updateCustom(studentId, category, customId, updates): void`
Actualiza una contemplación personalizada existente.

**Parámetros:**
- `customId`: ID de la contemplación custom a actualizar
- `updates`: Objeto parcial con campos a actualizar (`title`, `rule`, `selected`)

**Ejemplo:**
```typescript
updateCustom('123', 'clase', 'custom-1', { title: 'Nuevo título', selected: false });
```

#### `removeCustom(studentId, category, customId): void`
Elimina una contemplación personalizada.

**Ejemplo:**
```typescript
removeCustom('123', 'clase', 'custom-1');
```

#### `toggleCustomSelected(studentId, category, customId): void`
Alterna la selección de una contemplación personalizada.

**Ejemplo:**
```typescript
toggleCustomSelected('123', 'clase', 'custom-1');
```

### Utilidades

#### `getAllSelected(studentId, category): { catalogIds: string[], customItems: CustomContemplacion[] }`
Obtiene todas las contemplaciones seleccionadas (catálogo + custom) para un estudiante y categoría.

**Retorna:** Objeto con:
- `catalogIds`: IDs del catálogo seleccionados
- `customItems`: Contemplaciones custom seleccionadas

**Ejemplo:**
```typescript
const all = getAllSelected('123', 'clase');
// → { catalogIds: ['contemplacion-1'], customItems: [{ id: 'custom-1', ... }] }
```

---

## Normalización y Deduplicación

### Normalización de IDs

Todas las funciones que manejan IDs de contemplaciones del catálogo aplican normalización automática:

- `contemplacion-9` → `contemplacion-9-22`
- `contemplacion-22` → `contemplacion-9-22`

Esto asegura que las contemplaciones #9 y #22 siempre se traten como una sola (`contemplacion-9-22`).

**Ejemplo:**
```typescript
// Aunque se pase 'contemplacion-9' o 'contemplacion-22', se normaliza a 'contemplacion-9-22'
writeSelected('123', 'clase', ['contemplacion-9', 'contemplacion-22']);
// Se guarda como: ['contemplacion-9-22']
```

### Deduplicación Automática

Las funciones de escritura eliminan duplicados automáticamente:

```typescript
writeSelected('123', 'clase', ['contemplacion-1', 'contemplacion-1', 'contemplacion-2']);
// Se guarda como: ['contemplacion-1', 'contemplacion-2']
```

---

## Compatibilidad con Keys Existentes

### Keys que NO se Modifican

Este módulo **no modifica** las siguientes keys existentes:

- **`adecuacionAcceso:${student.id}`** → `boolean`
  - Usada para flag de adecuación de acceso
  - Definida en `StudentProfile.tsx` y otros componentes

- **`adecuacionContenido:${student.id}`** → `boolean`
  - Usada para flag de adecuación de contenido
  - Definida en `StudentProfile.tsx` y otros componentes

- **`contemplaciones:${student.id}`** → `string[]` (legacy)
  - Key legacy que puede existir en algunos casos
  - Este módulo no la lee ni escribe
  - Puede coexistir sin conflictos

### Separación por Categoría

Las nuevas keys están separadas por categoría (`clase` vs `evaluaciones`), lo que permite:

- Selecciones independientes para clase y evaluaciones
- Contemplaciones custom diferentes por contexto
- Mayor flexibilidad en la gestión de contemplaciones

---

## Migración Futura a Base de Datos

### Nota de Migración

**Estado actual:** localStorage (cliente)

**Migración futura:** Base de datos (Supabase)

### Consideraciones para Migración

1. **Estructura de Tablas Propuesta:**
   ```sql
   -- Selecciones de contemplaciones del catálogo
   CREATE TABLE contemplaciones_seleccionadas (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     student_id uuid REFERENCES students(id),
     category text CHECK (category IN ('clase', 'evaluaciones')),
     contemplacion_id text NOT NULL, -- ID del catálogo
     created_at timestamptz DEFAULT now(),
     UNIQUE(student_id, category, contemplacion_id)
   );

   -- Contemplaciones personalizadas
   CREATE TABLE contemplaciones_custom (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     student_id uuid REFERENCES students(id),
     category text CHECK (category IN ('clase', 'evaluaciones')),
     title text NOT NULL,
     rule text NOT NULL, -- Regla oculta
     selected boolean DEFAULT false,
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now()
   );
   ```

2. **Estrategia de Migración:**
   - Leer datos de localStorage al iniciar sesión
   - Sincronizar con base de datos en background
   - Mantener localStorage como cache local
   - Migrar gradualmente sin pérdida de datos

3. **Compatibilidad:**
   - El módulo `storage.ts` puede adaptarse para leer/escribir en DB
   - Mantener la misma interfaz de funciones
   - Agregar funciones de sincronización

---

## Manejo de Errores

### Lectura

- Si hay error al leer localStorage, retorna array vacío `[]`
- Si el formato es inválido, retorna array vacío `[]`
- Logs de advertencia en consola (no lanza excepciones)

### Escritura

- Si hay error al escribir, lanza excepción
- Valida estructura antes de guardar
- Filtra items inválidos automáticamente

---

## Ejemplos de Uso

### Caso 1: Seleccionar contemplaciones para clase

```typescript
import { writeSelected, readSelected } from '@/lib/contemplaciones/storage';

// Seleccionar contemplaciones para un estudiante en clase
writeSelected('student-123', 'clase', [
  'contemplacion-1',
  'contemplacion-2',
  'contemplacion-9-22'
]);

// Leer selecciones
const selected = readSelected('student-123', 'clase');
// → ['contemplacion-1', 'contemplacion-2', 'contemplacion-9-22']
```

### Caso 2: Agregar contemplación custom

```typescript
import { addCustom, readCustom } from '@/lib/contemplaciones/storage';

// Agregar contemplación personalizada
const customId = addCustom(
  'student-123',
  'evaluaciones',
  'Permitir uso de calculadora gráfica',
  'Permitir calculadora gráfica en ejercicios de funciones y gráficos',
  true // seleccionada inicialmente
);

// Leer contemplaciones custom
const custom = readCustom('student-123', 'evaluaciones');
// → [{ id: customId, title: '...', rule: '...', selected: true }]
```

### Caso 3: Toggle de selección

```typescript
import { toggleSelected, isSelected } from '@/lib/contemplaciones/storage';

// Verificar si está seleccionada
if (isSelected('student-123', 'clase', 'contemplacion-1')) {
  // Ya está seleccionada
}

// Toggle (si está seleccionada, la deselecciona; si no, la selecciona)
const newSelection = toggleSelected('student-123', 'clase', 'contemplacion-1');
```

### Caso 4: Obtener todas las selecciones

```typescript
import { getAllSelected } from '@/lib/contemplaciones/storage';

const all = getAllSelected('student-123', 'clase');
// → {
//     catalogIds: ['contemplacion-1', 'contemplacion-2'],
//     customItems: [
//       { id: 'custom-1', title: 'Permitir calculadora', rule: '...', selected: true }
//     ]
//   }
```

---

## Notas de Implementación

1. **IDs de Estudiantes:**
   - Acepta `string | number` para flexibilidad
   - Se convierten a string en las keys de localStorage

2. **Validación:**
   - Valida estructura de datos antes de guardar
   - Filtra items inválidos automáticamente
   - Normaliza IDs del catálogo automáticamente

3. **Performance:**
   - Operaciones síncronas (localStorage es síncrono)
   - No hay overhead de red
   - Ideal para datos locales del usuario

4. **Privacidad:**
   - Datos almacenados localmente en el navegador
   - No se envían a servidor (hasta migración futura)
   - Cada usuario tiene sus propios datos

---

**Última actualización:** 2026-01-23



