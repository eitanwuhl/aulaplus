# Sugerencias Editables en Perfil de Grupo

## Resumen

Se implementó la funcionalidad para que los docentes puedan editar y personalizar las sugerencias mostradas en el perfil de grupo. Las sugerencias se almacenan en Supabase y persisten entre sesiones.

## Cambios Realizados

### 1. Base de Datos

**Migración**: `supabase/migrations/20251226174831_add_grupos_table_teacher_sugerencias.sql`

- Se creó la tabla `grupos` con los siguientes campos:
  - `id` (TEXT, PK): Identificador del grupo (ej: "9no 1")
  - `name` (TEXT): Nombre del grupo
  - `year` (TEXT): Año del grupo
  - `section` (TEXT): Sección del grupo
  - `user_id` (UUID, FK): Usuario propietario del grupo
  - `teacher_sugerencias` (JSONB): Objeto con las sugerencias personalizadas:
    ```typescript
    {
      aula?: string;
      evaluaciones?: string;
      otras?: string;
    }
    ```
  - `created_at`, `updated_at` (TIMESTAMPTZ): Timestamps automáticos

- **RLS (Row Level Security)**: Los usuarios solo pueden ver/editar sus propios grupos
- **Índice**: Creado en `user_id` para búsquedas rápidas
- **Trigger**: Actualiza automáticamente `updated_at` en cada actualización

### 2. Tipos TypeScript

**Archivo**: `src/data/mockData.ts`

- Se agregó la interfaz `TeacherSugerencias`:
  ```typescript
  export interface TeacherSugerencias {
    aula?: string;
    evaluaciones?: string;
    otras?: string;
  }
  ```

- Se actualizó la interfaz `Group` para incluir:
  ```typescript
  teacher_sugerencias?: TeacherSugerencias;
  ```

### 3. Componente GroupProfile

**Archivo**: `src/components/GroupProfile.tsx`

#### Funcionalidades Agregadas:

1. **Estado de Edición**:
   - `teacherSugerencias`: Almacena las sugerencias del docente cargadas desde Supabase
   - `editingSection`: Indica qué sección está siendo editada ('aula', 'evaluaciones', 'otras')
   - `editValues`: Valores temporales durante la edición
   - `isSaving`: Flag para prevenir doble envío

2. **Funciones Helper**:
   - `getDefaultSugerenciasAula()`: Retorna sugerencias por defecto según perfil dominante (aula)
   - `getDefaultSugerenciasEvaluaciones()`: Retorna sugerencias por defecto según perfil dominante (evaluaciones)
   - `getDisplayText()`: Retorna el texto a mostrar (override del docente o default)

3. **Persistencia**:
   - `useEffect`: Carga `teacher_sugerencias` desde Supabase al montar el componente
   - `saveTeacherSugerencias()`: Guarda las sugerencias en Supabase (crea o actualiza el registro)
   - Manejo de errores con toasts informativos

4. **UI Editable**:
   - Cada sección tiene un botón "Editar" que cambia a modo edición
   - En modo edición: muestra `Textarea` con botones "Cancelar" y "Guardar"
   - En modo lectura: muestra el texto (personalizado o default)
   - Si no hay sugerencias personalizadas, muestra mensaje indicativo

5. **Nueva Sección**:
   - Se agregó "Otras sugerencias importantes" (fondo púrpura) donde el docente puede escribir cualquier sugerencia adicional

### 4. Comportamiento de Fallback

- Si el docente no ha personalizado las sugerencias, se muestran las sugerencias generadas automáticamente según el perfil dominante del grupo
- Si el docente personaliza y luego borra el contenido, se vuelve a mostrar el default
- Si el docente guarda contenido vacío, se elimina la personalización (vuelve al default)

## Flujo de Usuario

1. **Ver Sugerencias**:
   - El docente abre el perfil de un grupo
   - Ve las sugerencias (personalizadas o por defecto)
   - Cada sección tiene un botón "Editar"

2. **Editar Sugerencias**:
   - El docente hace clic en "Editar" en cualquier sección
   - Aparece un `Textarea` con el contenido actual (o default si no hay personalización)
   - El docente modifica el texto
   - Hace clic en "Guardar" o "Cancelar"

3. **Guardar Cambios**:
   - Al guardar, se actualiza Supabase
   - Se muestra un toast de éxito o error
   - La UI vuelve a modo lectura mostrando el nuevo contenido

4. **Persistencia**:
   - Al recargar la página, las sugerencias personalizadas se cargan automáticamente
   - Cada docente tiene sus propias sugerencias por grupo

## Estructura de Datos

### Tabla `grupos`:

```sql
CREATE TABLE grupos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year TEXT,
  section TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  teacher_sugerencias JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Ejemplo de `teacher_sugerencias`:

```json
{
  "aula": "• Utilizar más recursos visuales\n• Incorporar debates semanales",
  "evaluaciones": "• Permitir tiempo adicional\n• Evaluaciones orales opcionales",
  "otras": "Este grupo requiere atención especial en matemáticas."
}
```

## Seguridad

- **RLS Policies**: Solo el usuario propietario puede ver/editar sus grupos
- **Validación**: Se verifica autenticación antes de guardar
- **Sanitización**: Los valores se trimean antes de guardar

## Testing Manual

### Prueba 1: Editar Sugerencias para el Aula
1. Abrir perfil de un grupo
2. Hacer clic en "Editar" en "Sugerencias para el aula"
3. Modificar el texto
4. Hacer clic en "Guardar"
5. **Esperado**: Toast de éxito, texto actualizado, modo lectura

### Prueba 2: Agregar Otras Sugerencias
1. Hacer clic en "Editar" en "Otras sugerencias importantes"
2. Escribir texto personalizado
3. Guardar
4. **Esperado**: Nueva sección muestra el texto personalizado

### Prueba 3: Persistencia
1. Editar cualquier sugerencia y guardar
2. Recargar la página
3. **Esperado**: Las sugerencias personalizadas se mantienen

### Prueba 4: Cancelar Edición
1. Hacer clic en "Editar"
2. Modificar texto
3. Hacer clic en "Cancelar"
4. **Esperado**: Vuelve a modo lectura sin cambios

### Prueba 5: Fallback a Default
1. Editar una sugerencia y borrar todo el contenido
2. Guardar
3. **Esperado**: Se muestra el texto por defecto según perfil dominante

## Archivos Modificados

1. `supabase/migrations/20251226174831_add_grupos_table_teacher_sugerencias.sql` (nuevo)
2. `src/data/mockData.ts` (actualizado)
3. `src/components/GroupProfile.tsx` (actualizado)
4. `docs/ux_group_profile_sugerencias_editable.md` (nuevo)

## Notas Técnicas

- La tabla `grupos` se crea si no existe (usando `IF NOT EXISTS`)
- Si el grupo no existe en Supabase, se crea automáticamente al guardar
- Los campos vacíos se eliminan del objeto JSONB antes de guardar
- El componente maneja errores de red y muestra mensajes apropiados
- Se previene doble envío durante el guardado (`isSaving`)

## Compatibilidad Hacia Atrás

- Si un grupo no tiene `teacher_sugerencias` en Supabase, se muestran las sugerencias por defecto
- Los grupos existentes en `mockData.ts` siguen funcionando sin cambios
- La migración es no destructiva (no afecta datos existentes)













