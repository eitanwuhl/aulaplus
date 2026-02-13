# Checklist de Pruebas: Planning AI Report

## Objetivo
Verificar que el reporte de IA para planificación muestre correctamente el narrative por sesión y los detalles estructurados.

## Pre-requisitos
1. Tener una planificación con al menos 2 sesiones generadas
2. Las sesiones deben tener `ai_design_report` en la base de datos
3. Al menos una sesión debe tener materiales subidos o contenidos ANEP

---

## Prueba 1: Verificar Narrative Visible en UI

### Pasos:
1. Abrir una planificación en `PlanificacionWorkspace`
2. Seleccionar una sesión que tenga `ai_design_report`
3. Ir a la pestaña "Clase" del editor de sesión

### Resultado Esperado:
- ✅ El componente `PlanningAIDesignReport` aparece después de la sección "Solicitar cambios a la IA"
- ✅ El narrative es visible inmediatamente (NO está dentro de un accordion cerrado)
- ✅ El narrative es un texto continuo, amigable, de 300-500 palabras
- ✅ El narrative menciona explícitamente:
  - Qué partes de las fuentes se enseñan en esta sesión
  - Por qué esas partes fueron seleccionadas
  - Cómo se desarrollan las competencias
  - Cómo se satisfacen los requerimientos del docente

### Si falla:
- Verificar que `sesion.ai_design_report.narrative` existe en la base de datos
- Verificar que el componente `PlanningAIDesignReport` está siendo renderizado
- Revisar la consola del navegador para errores

---

## Prueba 2: Verificar Details Accordion

### Pasos:
1. En la misma sesión, buscar el botón "Ver detalles" en el reporte de IA
2. Hacer clic para expandir el accordion

### Resultado Esperado:
- ✅ El accordion se expande mostrando:
  - `contentCoverage` (si existe): lista de contenidos cubiertos con fuente, por qué, cómo
  - `competencyDevelopment` (si existe): lista de competencias y cómo se desarrollan
  - `teacherRequirementsApplied` (si existe): lista de requerimientos y cómo se satisfacen
  - `decisions.structure` (legacy)
  - `decisions.timeAllocation` (legacy)
  - `inputsUsed` (legacy)
  - `assumptions` (legacy)

### Si falla:
- Verificar que `sesion.ai_design_report` tiene los campos estructurados
- Revisar la consola del navegador para errores de renderizado

---

## Prueba 3: Verificar Continuidad Multi-Sesión

### Pasos:
1. Seleccionar la primera sesión de una unidad
2. Leer el narrative y verificar menciones de continuidad
3. Seleccionar la segunda sesión de la misma unidad
4. Leer el narrative y verificar menciones de continuidad con la sesión anterior

### Resultado Esperado:
- ✅ Sesión 1: Menciona que es la primera clase y que las siguientes construirán sobre estos conceptos
- ✅ Sesión 2: Menciona explícitamente continuidad con la sesión anterior (ej: "Esta clase continúa desde la sesión anterior...")
- ✅ Si hay materiales subidos: Sesión 1 menciona qué parte del material se cubre (ej: "primera parte", "páginas 1-15")
- ✅ Si hay materiales subidos: Sesión 2 menciona qué parte del material se cubre (ej: "segunda parte", "páginas 16-30")
- ✅ No hay saltos aleatorios o repeticiones innecesarias de contenido entre sesiones

### Si falla:
- Verificar que `unitContext` está siendo pasado correctamente a la función de generación
- Verificar que el prompt incluye instrucciones sobre continuidad
- Revisar los logs de la función `generate-plan-completo`

---

## Prueba 4: Verificar Network Response

### Pasos:
1. Abrir DevTools → Network
2. Seleccionar una sesión en el editor
3. Buscar la request que carga los datos de la sesión (probablemente a `sesiones_clase`)

### Resultado Esperado:
- ✅ La respuesta JSON incluye `ai_design_report.narrative` como string no vacío
- ✅ La respuesta JSON incluye `ai_design_report.contentCoverage` como array (puede estar vacío)
- ✅ La respuesta JSON incluye `ai_design_report.competencyDevelopment` como array (puede estar vacío)
- ✅ La respuesta JSON incluye `ai_design_report.teacherRequirementsApplied` como array (puede estar vacío)

### Si falla:
- Verificar que la función `generate-plan-completo` está guardando correctamente `ai_design_report` en la base de datos
- Verificar que la query de Supabase está incluyendo `ai_design_report` en el SELECT

---

## Prueba 5: Verificar Narrative Siempre Visible

### Pasos:
1. Seleccionar una sesión que tenga `ai_design_report.narrative`
2. Verificar que el narrative es visible sin necesidad de expandir ningún accordion
3. Verificar que el narrative NO está oculto aunque existan campos `decisions` o `inputsUsed`

### Resultado Esperado:
- ✅ El narrative aparece en `CardContent` directamente, no dentro de `CollapsibleContent`
- ✅ El narrative es visible incluso si `decisions` o `inputsUsed` existen
- ✅ Solo los detalles estructurados están en el accordion "Ver detalles"

### Si falla:
- Verificar la implementación de `PlanningAIDesignReport.tsx`
- Asegurarse de que `hasNarrative` está siendo evaluado correctamente

---

## Prueba 6: Verificar Contenido del Narrative

### Pasos:
1. Leer el narrative completo de una sesión
2. Verificar que menciona explícitamente:

### Resultado Esperado:
- ✅ **QUÉ partes** de las fuentes se enseñan:
  - Si hay materiales: menciona qué sección/tema específico
  - Si hay ANEP: menciona qué contenidos específicos
  - Si hay sessionBrief: menciona el enfoque específico
- ✅ **POR QUÉ** esas partes fueron seleccionadas:
  - Lógica de secuencia (primera/intermedia/última)
  - Continuidad con clases anteriores/posteriores
- ✅ **CÓMO** se desarrollan las competencias:
  - Qué actividades específicas desarrollan cada competencia
  - Cómo las actividades permiten ejercitar habilidades
- ✅ **CÓMO** se satisfacen los requerimientos:
  - Si hay instrucciones del docente, explica cómo se aplicaron
  - Si hay sessionBrief, explica cómo el plan está estructurado alrededor de ese tema

### Si falla:
- Verificar que el prompt de OpenAI incluye estas instrucciones
- Verificar que el prompt del narrative fallback también las incluye
- Revisar los logs de la función para ver qué narrative se está generando

---

## Prueba 7: Verificar Reporte a Nivel de Planificación

### Pasos:
1. En `PlanificacionWorkspace`, buscar el panel "Reporte de IA" (Row 3)
2. Verificar que muestra el `planificacion.ai_design_report`

### Resultado Esperado:
- ✅ Si existe `planificacion.ai_design_report.narrative`, se muestra visible
- ✅ Si existen detalles estructurados, están en el accordion "Ver detalles"
- ✅ El componente funciona igual que el reporte por sesión

### Si falla:
- Verificar que `planificacion.ai_design_report` existe en la base de datos
- Verificar que el componente `PlanningAIDesignReport` está siendo usado correctamente

---

## Notas de Debugging

### Si el narrative no aparece:
1. Verificar en Supabase Dashboard → `sesiones_clase` → columna `ai_design_report` → campo `narrative`
2. Verificar en la consola del navegador si hay errores de TypeScript/React
3. Verificar que `PlanningAIDesignReport` está importado correctamente en `EditorSesionNuevo`

### Si el narrative no tiene el contenido esperado:
1. Verificar que el prompt de OpenAI incluye las instrucciones actualizadas
2. Verificar que `buildNarrativeLocal` (fallback) también incluye estas instrucciones
3. Revisar los logs de `generate-plan-completo` para ver qué narrative se está generando

### Si la continuidad multi-sesión no funciona:
1. Verificar que `unitContext` se está pasando correctamente a cada sesión
2. Verificar que `buildContentCoverage` está usando `unitContext` para determinar continuidad
3. Verificar que el prompt menciona explícitamente la continuidad cuando `unitContext` está presente
