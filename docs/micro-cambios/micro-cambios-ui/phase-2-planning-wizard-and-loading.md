# Phase 2 — Planning wizard and loading screen (UI only)

**Rama:** Micro-cambios  
**Alcance:** Mejoras solo de UI en el flujo de planificación: pantalla de carga de generación simplificada y limpieza de bloques informativos/copy en el wizard de configuración. Sin cambios en backend, BD, Edge Functions ni prompts. Sin nuevas dependencias. Comportamiento y validaciones intactos.

---

## Files changed

- `src/pages/PlanificacionWizard.tsx` — Pantalla de carga: icono robot sustituido por spinner; mensaje único y aviso de no cerrar/navegar; cabecera del wizard actualizada; eliminada la card informativa "Planificación Automática con IA".
- `src/components/planificacion/WizardSteps.tsx` — Eliminada la card "Enfoque Pedagógico" (solo título y descripción, sin inputs) del paso 2.
- `src/components/planificacion/PlanMaterialsSection.tsx` — Título y descripción de la sección actualizados; eliminado el callout "Validación A/B/C"; eliminados imports no usados (Alert, AlertDescription, AlertCircle).

---

## What was removed or renamed

**Pantalla de carga (generación automática de planes)**  
- Removed: icono de robot (`Bot`).  
- Replaced with: indicador de carga neutro (spinner `Loader2` animado).  
- Removed: mensaje secundario largo ("La IA está creando el contenido de todas las sesiones...").  
- Removed: texto inferior duplicado "Por favor, no cierres esta ventana..." en estado de carga (se mantiene solo un aviso en caja destacada).  
- Replaced: mensaje principal por "Aguarda un instante mientras generamos las clases. Espero no demorar mucho".  
- Kept: aviso claro en caja azul: "No cierres esta ventana ni navegues a otra página mientras la generación está en curso."  
- Kept: lógica de error (mensaje de error, botón Reintentar, texto de consola); estado y bloqueo de navegación sin cambios.

**Cabecera del wizard**  
- Replaced: "Asistente de Planificación Inteligente" → "Asistente para planificación de clases".  
- Removed: subtítulo "Crea una planificación completa con IA paso a paso".  
- Kept: botón Volver y navegación entre pasos.

**Card informativa al pie del wizard**  
- Removed: card completa "🤖 Planificación Automática con IA" con descripción sobre generación automática de planes por sesión (sin inputs ni lógica asociada).

**Paso 2 del wizard (Enfoque)**  
- Removed: card "Enfoque Pedagógico" con título y descripción "Define competencias, contenidos y preferencias metodológicas...". No contenía campos; el resto del paso (PlanMaterialsSection, UnidadDidacticaBuilder, ModalityDistribution, tema por clase, etc.) se mantiene igual.

**Sección de material docente (nivel planificación)**  
- Renamed: título "Material Docente (Nivel Planificación)" → "Adjunta tu material como fuente".  
- Replaced: descripción por "Adjunta el material que tú quieras para tomar como fuente para tus clases".  
- Removed: callout/alert "Validación A/B/C: Para generar planes automáticamente necesitas al menos uno de: (A) contenido ANEP, (B) materiales adjuntos, o (C) texto de foco suficiente...".

---

## Logic preserved (only UI removed or changed)

- **Validación A/B/C:** La validación de requisitos de generación (`generation_requirements`) sigue en el wizard: el mensaje de error inline (caja ámbar con ⚠️) cuando no se cumple A/B/C se mantiene; solo se eliminó el bloque informativo que explicaba la regla en la sección de materiales.  
- **Enfoque pedagógico:** La card era solo informativa (título + descripción). Todos los inputs del paso 2 (unidades didácticas, distribución de modalidades, materiales, tema por clase, etc.) siguen en su lugar y con la misma lógica.  
- **Planificación automática con IA:** La card eliminada era solo explicativa. La generación automática al finalizar el wizard, el toast "Generando planes automáticamente" y la pantalla de carga siguen funcionando igual; el usuario no puede avanzar ni cerrar mientras `isGeneratingPlans` está activo.  
- **Material docente:** El componente `PlanMaterialsSection` conserva la acción "Adjuntar materiales", la lista de materiales adjuntos, el diálogo de biblioteca y el estado `attachedPlanMaterialIds`; solo se cambiaron título, descripción y se quitó el callout de Validación A/B/C.

---

## Manual testing checklist

- [ ] **Cabecera del wizard:** Iniciar un nuevo flujo de planificación (`/planificacion/nuevo` o desde landing). Verificar que el encabezado muestra "Asistente para planificación de clases" y que no aparece el subtítulo "Crea una planificación completa con IA paso a paso". Verificar que "Volver" y los pasos funcionan.
- [ ] **Paso 2 – Enfoque:** En el paso de enfoque, verificar que no se muestra la card "Enfoque Pedagógico". Verificar que siguen visibles la sección de materiales ("Adjunta tu material como fuente"), unidades didácticas, distribución de modalidades y tema por clase.
- [ ] **Material docente:** En la sección de materiales del wizard, verificar título "Adjunta tu material como fuente" y descripción "Adjunta el material que tú quieras para tomar como fuente para tus clases". Verificar que no aparece el callout "Validación A/B/C". Verificar que "Adjuntar materiales" / "Agregar más materiales" abre la biblioteca y que los materiales adjuntos se listan y se pueden quitar.
- [ ] **Sin cards de "Planificación automática con IA":** Recorrer todos los pasos del wizard y la vista de resumen; verificar que en ningún paso aparece la card o callout "Planificación Automática con IA" o "Planificación automática con IA".
- [ ] **Pantalla de carga:** Completar el wizard y disparar la generación automática. Verificar que aparece la pantalla de carga con spinner (no icono de robot), el mensaje "Aguarda un instante mientras generamos las clases. Espero no demorar mucho" y el aviso de no cerrar/navegar. Verificar que no se puede volver atrás ni navegar mientras carga. Verificar que al terminar la generación se navega al workspace como antes.
- [ ] **Error de generación:** Si se simula o ocurre un error en la generación, verificar que se muestra el título "Error en la generación", el mensaje correspondiente y el botón "Reintentar generación"; que el spinner de reintento y la lógica de reintento se comportan igual que antes.
