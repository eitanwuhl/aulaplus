# Planificación: reporte IA teacher-friendly

Fecha: 2026-03-04  
Ámbito: `src/components/planificacion/PlanningAIDesignReport.tsx`, `supabase/functions/generate-plan-completo/index.ts`

## Objetivo

Mejorar legibilidad y utilidad pedagógica del reporte IA para docentes, eliminando exposición de datos técnicos crudos y evitando supuestos no sustentados.

## Cambios en UI

### 1) Se oculta “Detalle técnico (raw)” por defecto

- `report_technical` ya no se muestra en modo docente normal.
- Queda disponible solo bajo flag de debug:
  - `window.__PLAN_REPORT_DEBUG__ = true`
- El acordeón se mantiene para “detalles pedagógicos”, no para dump técnico.

### 2) Narrativa sin artefactos HTML (`<p>`, `<br>`, etc.)

- Se normaliza narrativa a texto legible:
  - convierte separadores HTML en saltos de línea
  - elimina etiquetas visibles
  - colapsa saltos excesivos
- Resultado: no aparecen tags crudos en pantalla.

### 3) Integración de detalle importante en narrativa principal

Cuando hay campos estructurados, se integran al texto docente con subsecciones claras:

- Propósito y foco
- Secuencia didáctica
- Competencias
- Evidencia esperada
- Adaptaciones
- Materiales y fuentes

Esto evita dependencia de un JSON técnico para entender decisiones clave.

## Remoción de supuestos de “conocimientos previos”

En generación backend se reemplazó el supuesto fuerte:

- Antes: “Estudiantes tienen conocimientos previos básicos...”
- Ahora: “Activar conocimientos previos si corresponde al grupo y al momento de la secuencia.”

Además, en UI:

- Se filtran supuestos que afirman “conocimientos previos” de forma categórica.

## Validación manual sugerida

1. Generar una clase con reporte IA y abrir `PlanningAIDesignReport`.
2. Confirmar:
   - no aparece “Detalle técnico (raw)” en modo normal
   - narrativa no muestra `<p>` ni HTML crudo
   - aparecen bloques pedagógicos (propósito, secuencia, competencias, evidencia, adaptaciones, materiales) cuando hay datos
3. Confirmar que no se muestran supuestos categóricos sobre conocimientos previos.
4. (Opcional debug) En consola:
   - `window.__PLAN_REPORT_DEBUG__ = true`
   - refrescar y verificar que el bloque raw aparece solo en ese modo.

## Performance / límites

- Sin nuevas llamadas LLM.
- Cambios de render y normalización de texto en frontend.
- Ajustes deterministas de contenido en backend.

