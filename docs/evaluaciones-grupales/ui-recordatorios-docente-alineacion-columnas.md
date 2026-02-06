# UI Recordatorios - Alineación de Columnas

> Mejora de alineación visual en los headers de estudiantes del panel "Recordatorios para el docente".

## Problema

Los elementos dentro de cada fila de estudiante no estaban alineados consistentemente entre filas:
- Nombres de estudiantes empezaban en posiciones distintas
- El badge de conteo se desplazaba según la longitud del nombre
- Los chips de categoría no tenían posición fija

## Solución: Layout de 4 Columnas con CSS Grid

### Desktop (≥ md breakpoint)

```
┌────────────────┬──────────────────┬────────────────────────┬────────┐
│ Nombre         │ Badge conteo     │ Chips categoría        │ Chevron│
│ (140px max)    │ (auto)           │ (flexible)             │ (auto) │
└────────────────┴──────────────────┴────────────────────────┴────────┘
```

Grid template:
```css
grid-cols-[minmax(100px,140px)_auto_1fr_auto]
```

### Mobile (< md breakpoint)

```
┌─────────────────────────────────────┬────────────┐
│ Nombre                              │ Badge      │  ← Fila 1
├─────────────────────────────────────┴────────────┤
│ Chips categoría                                  │  ← Fila 2
└──────────────────────────────────────────────────┘
                                        [Chevron →]   (posición absoluta)
```

Grid template móvil:
```css
grid-cols-[1fr_auto]
```

## Características

| Columna | Ancho | Comportamiento |
|---------|-------|----------------|
| **Nombre** | `minmax(100px, 140px)` | Trunca con ellipsis, tooltip en hover |
| **Badge conteo** | `auto` | Se ajusta al contenido, alineado a la izquierda |
| **Chips categoría** | `1fr` | Flexible, chips se mantienen juntos |
| **Chevron** | `auto` | Fijo a la derecha |

## Responsividad

- **Desktop**: 4 columnas horizontales, alineación vertical perfecta entre filas
- **Mobile**: 2 filas apiladas, chevron posicionado absolutamente

## Archivo Modificado

- [src/components/evaluaciones/TeacherRemindersPanel.tsx](../../src/components/evaluaciones/TeacherRemindersPanel.tsx)

## Cómo Verificar

1. **Abrir Evaluaciones Grupales** con varios estudiantes que tengan recordatorios
2. **Desktop**: Verificar que nombres, badges y chips estén alineados verticalmente entre filas
3. **Mobile** (< 768px): Verificar que el layout se apila correctamente
4. **Nombres largos**: Verificar truncado con "..." sin afectar otras columnas
5. **Accesibilidad**: Verificar que el header sigue siendo clickeable y focuseable

---

*Fecha: 2026-02-06*  
*Relacionado: ui-recordatorios-docente-v2.md*
