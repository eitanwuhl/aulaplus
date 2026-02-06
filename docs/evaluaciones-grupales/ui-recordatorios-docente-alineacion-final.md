# UI Recordatorios - Alineación Final de Columnas

> Pulido final de alineación en los headers de estudiantes del panel "Recordatorios para el docente".

## Problema

Los intentos anteriores usaban layouts que permitían que el contenido empujara las columnas:
- `auto` widths causaban desalineación entre filas
- `1fr` flexible sin anchos fijos permitía que nombres largos movieran el pill y chips

## Solución: Grid Estricto con Anchos Fijos

### Desktop Layout (≥ md)

```
┌──────────────────────┬────────────────┬─────────────────────┬──────┐
│ Nombre               │ Count Pill     │ Category Chips      │ ▼    │
│ minmax(80px, 1fr)    │ 110px          │ 180px               │ 24px │
│ truncate + min-w-0   │ fixed          │ fixed               │ fixed│
└──────────────────────┴────────────────┴─────────────────────┴──────┘
```

**Grid template:**
```css
grid-cols-[minmax(80px,1fr)_110px_180px_24px]
```

**Características clave:**
- Col 1 (Nombre): `minmax(80px, 1fr)` + `truncate` + `min-w-0` → toma espacio disponible pero TRUNCA, nunca empuja
- Col 2 (Pill): `110px` fijo → suficiente para "10 recordatorios"
- Col 3 (Chips): `180px` fijo → suficiente para ambos chips, pueden wrap internamente
- Col 4 (Chevron): `24px` fijo → siempre a la derecha

### Mobile Layout (< md)

Layout de 2 filas apiladas:

```
┌────────────────────────────────────────┬──────┐
│ Nombre (truncate)                      │  ▼   │  ← Fila 1
├────────────────────────────────────────┴──────┤
│ [Count Pill] [Admin] [Corrección]             │  ← Fila 2 (flex wrap)
└───────────────────────────────────────────────┘
```

## Cambios Adicionales

- **Chips más compactos**: `text-[11px]` y `px-1` (antes `text-xs` y `px-1.5`)
- **Mobile usa "Admin"**: En móvil se usa "Admin" en lugar de "Administración" para ahorrar espacio
- **Layouts separados**: Dos contenedores distintos (`md:hidden` y `hidden md:grid`) para evitar conflictos de responsive

## Archivo Modificado

- [src/components/evaluaciones/TeacherRemindersPanel.tsx](../../src/components/evaluaciones/TeacherRemindersPanel.tsx)

## Cómo Verificar

1. **Abrir Evaluaciones Grupales** con varios estudiantes con recordatorios
2. **Desktop (≥ 768px)**:
   - Verificar que los count pills estén perfectamente alineados verticalmente
   - Verificar que los chips de categoría empiecen en la misma posición X
   - Verificar que nombres largos se truncan con "..." sin mover otras columnas
3. **Mobile (< 768px)**:
   - Verificar layout de 2 filas (nombre+chevron arriba, pill+chips abajo)
   - Verificar que todo cabe sin overflow horizontal

---

*Fecha: 2026-02-06*  
*Reemplaza: ui-recordatorios-docente-alineacion-columnas.md*
