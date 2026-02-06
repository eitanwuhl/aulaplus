# UI Recordatorios para el Docente - v2

> Pulido visual adicional para el panel "Recordatorios para el docente" en evaluaciones grupales.

## Cambios Realizados

### 1. Etiqueta "Admin" → "Administración"
- El chip de categoría ahora muestra **"Administración"** en lugar de "Admin"
- Consistente con el nombre completo del bucket `ADMIN_REMINDER`
- Más claro para el usuario final

### 2. Layout Responsivo en Grid
- **Antes**: Lista vertical única de estudiantes
- **Después**: Grid responsivo:
  - **Móvil (< md)**: 1 columna
  - **Desktop (≥ md)**: 2 columnas

```css
grid grid-cols-1 md:grid-cols-2 gap-2
```

### 3. Mejoras de Alineación y Truncado
- **Nombre del estudiante**: 
  - `truncate` con `max-w-[140px]` para evitar overflow
  - `title` attribute para mostrar nombre completo en hover
- **Badge de conteo**: `flex-shrink-0` para mantener tamaño consistente
- **Chips de categoría**: `flex-shrink-0` para no comprimirse
- **Contenedor de items**: `min-w-0 flex-1` para permitir truncado correcto

## Archivos Modificados

- [src/components/evaluaciones/TeacherRemindersPanel.tsx](../../src/components/evaluaciones/TeacherRemindersPanel.tsx)

## Cómo Verificar

1. **Navegar a Evaluaciones Grupales** con múltiples estudiantes que tengan recordatorios
2. **Verificar etiqueta**: El chip azul debe decir "Administración" (no "Admin")
3. **Verificar grid en desktop**:
   - Redimensionar ventana a ≥768px de ancho
   - Los estudiantes deben mostrarse en 2 columnas
4. **Verificar móvil**:
   - Redimensionar ventana a <768px
   - Los estudiantes deben mostrarse en 1 columna
5. **Verificar truncado**:
   - Estudiantes con nombres largos deben truncarse con "..."
   - Hover sobre el nombre debe mostrar el nombre completo

## Comportamiento Preservado

- ✅ Acordeón colapsable por estudiante
- ✅ Controles "Expandir / Colapsar" todos
- ✅ Solo muestra recordatorios admin y corrección (no allowances)
- ✅ Comportamiento de expand por defecto según cantidad de estudiantes

---

*Fecha: 2026-02-06*  
*Relacionado: ui-recordatorios-docente.md*
