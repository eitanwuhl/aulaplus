# Phase 1 — Quick wins (UI/UX)

**Rama:** Micro-cambios  
**Alcance:** Cambios solo de UI: eliminación de elementos no funcionales, ajuste de textos y corrección de encoding. Sin cambios en backend, BD, Edge Functions ni prompts. Sin nuevas dependencias.

---

## Files changed

- `src/components/AppLayout.tsx` — Barra superior: eliminados iconos de campana y usuario.
- `src/pages/EvaluacionesChoice.tsx` — Landing Evaluaciones Grupales: eliminados chips, botón "Ver evaluaciones" y botón "Nueva Evaluación"; header simplificado.
- `src/pages/PlanificacionClase.tsx` — Landing Planificación de Clases: eliminados chips, botón "Ver planificaciones" y botón "Nueva Planificación"; corregido `containerspace-y-6` → `container space-y-6`; imports no usados eliminados.
- `src/components/evaluaciones/EvaluationSourceSelector.tsx` — Texto descriptivo de la sección "Selecciona tu clase como fuente" actualizado.
- `src/components/evaluaciones/EvaluationMaterialsSection.tsx` — Texto descriptivo de "Material Docente para Evaluación" actualizado.
- `src/components/evaluaciones/TimeBudgetingSection.tsx` — Título "Presupuesto de Tiempo" renombrado a "Duración de la evaluación"; eliminada la caja de nota/helper sobre tiempo estimado y desglose.
- `src/pages/PlanificacionWorkspace.tsx` — Eliminado botón "Configuración"; corregido "Guardar sesi?n" → "Guardar sesión"; subtítulo "Planificación flexible (sin fechas fijas)" eliminado (solo se muestra subtítulo cuando hay fechas); eliminado import de `Settings`.

---

## What was removed/renamed (by screen)

**Top bar (global header)**  
- Removed: icono de campana (notificaciones).  
- Removed: icono de usuario/perfil.  
- Kept: nombre de usuario, búsqueda, botón cerrar sesión. Layout y espaciado se mantienen.

**Evaluaciones Grupales (landing)**  
- Removed: chips "IA adaptativa", "Multi-versión", "ANEP oficial" en la card "Generar Evaluación".  
- Removed: botón interno "Ver evaluaciones" en la card "Mis Evaluaciones".  
- Removed: botón superior derecho "Nueva Evaluación".  
- Header: solo título y descripción (sin botón a la derecha).

**Planificación de Clases (landing)**  
- Removed: chips "Wizard 4 pasos", "IA contextual", "ANEP oficial" en la card "Asistente de Planificación".  
- Removed: botón interno "Ver planificaciones" en la card "Mis Planificaciones".  
- Removed: botón superior derecho "Nueva Planificación".  
- Fixed: clase CSS `containerspace-y-6` → `container space-y-6`.

**Evaluation config (flujo de creación de evaluación)**  
- Renamed/updated: sección "Selecciona tu clase como fuente" — texto descriptivo reemplazado por: "Selecciona tus clases para utilizar como fuente de evaluación".  
- Renamed/updated: sección "Material Docente para Evaluación" — texto descriptivo reemplazado por: "Adjunta cualquiera de tus materiales para usarlos como fuente de evaluación".  
- Renamed: título de sección "Presupuesto de Tiempo" → "Duración de la evaluación".  
- Removed: caja de nota/helper "Después de generar la evaluación, aquí verás el tiempo estimado y su desglose por sección.".

**Planning workspace (cabecera del workspace)**  
- Removed: botón "Configuración" del header.  
- Fixed: "Guardar sesi?n" → "Guardar sesión" (encoding).  
- Removed: subtítulo "Planificación flexible (sin fechas fijas)" — el subtítulo solo se muestra cuando existen `fecha_inicio` y `fecha_fin` (rango de fechas).

---

## UI behavior considerations

- **Navegación:** En ambas landings las cards siguen siendo clicables (`onClick` a `/evaluaciones/nuevo`, `/mis-evaluaciones`, `/planificacion/nuevo`, `/mis-planificaciones`). Eliminar los botones internos "Ver evaluaciones" y "Ver planificaciones" no afecta el acceso; la card entera mantiene la navegación.  
- **Acceso a nueva evaluación/planificación:** Sigue siendo posible desde el sidebar (Evaluaciones Grupales / Planificación) y haciendo clic en la card correspondiente; solo se quitaron los botones destacados del header y del interior de la card.  
- **Workspace de planificación:** Sin botón "Configuración" el header queda con Volver, Exportar Excel y (cuando aplica) Guardar sesión o estado "Guardada".  
- **Duración de la evaluación:** La sección conserva el input de duración objetivo y el bloque de comparación/desglose cuando hay datos; solo se cambió el título y se eliminó el mensaje informativo previo a la generación.

---

## Manual testing checklist

- [ ] **Evaluaciones Grupales landing:** Abrir `/evaluaciones`; verificar que no aparecen los chips en "Generar Evaluación", que no hay botón "Ver evaluaciones" en "Mis Evaluaciones" y que no hay botón "Nueva Evaluación" arriba a la derecha. Verificar que al hacer clic en cada card se navega correctamente.
- [ ] **Planificación de Clases landing:** Abrir `/planificacion`; verificar que no aparecen los chips en "Asistente de Planificación", que no hay botón "Ver planificaciones" en "Mis Planificaciones" y que no hay botón "Nueva Planificación" arriba a la derecha. Verificar navegación al hacer clic en las cards.
- [ ] **Evaluación – configuración:** En el flujo de creación de evaluación, verificar los nuevos textos en "Selecciona tu clase como fuente" y "Material Docente para Evaluación"; verificar que el título de la sección es "Duración de la evaluación" y que ya no aparece la caja con "Después de generar la evaluación, aquí verás el tiempo estimado...".
- [ ] **Planning workspace:** Abrir un workspace de planificación; verificar que no hay botón "Configuración", que el botón de guardar muestra "Guardar sesión" (con ó) y que no aparece el subtítulo "Planificación flexible (sin fechas fijas)" (si no hay fechas). Si la planificación tiene fechas, verificar que sí se muestra el rango en el subtítulo.
- [ ] **Top bar:** En cualquier vista con layout de profesor, verificar que en la barra superior no aparecen el icono de campana ni el de usuario; que siguen visibles búsqueda, nombre de usuario y cerrar sesión, y que el espaciado se ve correcto.
