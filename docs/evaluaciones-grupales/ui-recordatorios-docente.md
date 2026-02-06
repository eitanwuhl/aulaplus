# UI Recordatorios para el Docente

> Documentación de la mejora de UX para el panel "Recordatorios para el docente" en evaluaciones grupales.

## Resumen del Cambio

El panel de recordatorios fue rediseñado para ser más compacto, visualmente atractivo y escaneable cuando hay muchos estudiantes.

### Antes
- Cada estudiante ocupaba un bloque expandido con todos sus recordatorios visibles
- Con muchos estudiantes, el panel se volvía largo y difícil de escanear
- No había forma de colapsar/expandir contenido

### Después
- Diseño de acordeón colapsable por estudiante
- Cabecera compacta con nombre, conteo de recordatorios y chips de categorías
- Controles "Expandir / Colapsar" para todos los estudiantes
- Comportamiento inteligente por defecto según cantidad de estudiantes

## Características

### 1. Cabecera por Estudiante
Cada estudiante muestra:
- **Nombre del estudiante**
- **Badge de conteo**: "X recordatorios"
- **Chips de categoría**: Indicadores visuales de "Admin" (azul) y "Corrección" (ámbar)
- **Icono chevron**: Indica estado expandido/colapsado

### 2. Controles Globales
En el header del panel:
- **Expandir**: Abre todos los bloques de estudiantes
- **Colapsar**: Cierra todos los bloques

### 3. Contenido Expandido
Al expandir un estudiante se muestran:
- Sección "Administración" con icono azul (si hay recordatorios admin)
- Sección "Corrección" con icono ámbar (si hay recordatorios de corrección)
- Listas de bullets con cada recordatorio

## Comportamiento por Defecto

El panel usa una constante `COLLAPSE_THRESHOLD = 6` para determinar el estado inicial:

| Condición | Comportamiento |
|-----------|----------------|
| ≤ 6 estudiantes | Primer estudiante expandido, resto colapsados |
| > 6 estudiantes | Todos colapsados |
| 0 estudiantes | Mensaje "No hay recordatorios específicos" |

## Accesibilidad

- ✅ **Keyboard accessible**: Los triggers de collapsible son botones focusables
- ✅ **Semántica correcta**: Usa `Collapsible` de Radix UI que maneja ARIA automáticamente
- ✅ **Contraste adecuado**: Chips usan colores con suficiente contraste (azul/ámbar)
- ✅ **Estados visuales**: Hover y disabled states en botones

## Componentes Usados

| Componente | Fuente | Uso |
|------------|--------|-----|
| `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` | `@/components/ui/collapsible` | Acordeón por estudiante |
| `Badge` | `@/components/ui/badge` | Conteos y chips de categoría |
| `Button` | `@/components/ui/button` | Trigger y controles expand/collapse |
| `Card`, `CardHeader`, `CardContent`, `CardTitle` | `@/components/ui/card` | Contenedor principal |
| Iconos | `lucide-react` | `ChevronDown`, `ChevronUp`, `ClipboardList`, `CheckCircle2`, `ChevronsUpDown` |

## Cómo Verificar

1. **Navegar a Evaluaciones Grupales** y generar una evaluación con estudiantes que tengan contemplaciones
2. **Verificar cabeceras**: Cada estudiante debe mostrar nombre + badge de conteo + chips de categoría
3. **Probar expand/collapse individual**: Click en un estudiante debe alternar su contenido
4. **Probar controles globales**: "Expandir" debe abrir todos, "Colapsar" debe cerrar todos
5. **Verificar comportamiento por defecto**:
   - Con ≤6 estudiantes con recordatorios: el primero debe estar expandido
   - Con >6 estudiantes: todos deben estar colapsados
6. **Verificar categorías**: Solo deben aparecer "Admin" y "Corrección", nunca "Permisos/apoyos"

## Archivo Modificado

- [src/components/evaluaciones/TeacherRemindersPanel.tsx](../../src/components/evaluaciones/TeacherRemindersPanel.tsx)

## Nota Técnica

Este componente solo muestra recordatorios de los buckets `ADMIN_REMINDER` y `CORRECTION_REMINDER`. 
Las contemplaciones de `INSTRUMENT_DESIGN` (allowances) NO se muestran aquí porque afectan el diseño del cuadernillo, no son recordatorios para el docente. 

Ver [recordatorios-vs-diseno-cuadernillo.md](./recordatorios-vs-diseno-cuadernillo.md) para más detalles.

---

*Fecha: 2026-02-06*
