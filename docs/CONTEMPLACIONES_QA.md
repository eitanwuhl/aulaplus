# Contemplaciones V2 - Manual QA Checklist

**Fecha:** 2026-01-24  
**Branch:** `Nuevos-perfiles-y-reglas-para-contemplaciones`  
**Tipo:** QA Documentation  
**Commit:** `docs: add QA checklist for contemplaciones v2`

---

## Propósito

Este documento proporciona un checklist manual completo para validar todas las features del sistema de Contemplaciones V2, asegurando que:
- UI refleja correctamente la separación de contempl CLASE vs. EVALUACIÓN
- Persistencia funciona correctamente en localStorage
- Reminders determinísticos aparecen en lugares correctos (y NO en lugares prohibidos)
- Versionado de evaluaciones se basa solo en flags explícitos
- Contemplaciones custom funcionan correctamente

---

## Pre-requisitos

Antes de comenzar el QA, asegúrate de tener:

- [ ] Branch: `Nuevos-perfiles-y-reglas-para-contemplaciones` checked out
- [ ] `npm run dev` ejecutándose (puerto 5173 o el configurado)
- [ ] Navegador abierto en `http://localhost:5173`
- [ ] Console del navegador abierta (F12) para ver logs
- [ ] localStorage limpio (opcional, pero recomendado para fresh start)

**Limpiar localStorage (opcional):**
```javascript
// En console del navegador:
localStorage.clear();
location.reload();
```

---

## PARTE 1: Split de Contemplaciones UI

### Objetivo
Verificar que la UI muestra correctamente las dos categorías de contemplaciones separadas.

---

### Test 1.1: Visualización de Categorías

**Pasos:**
1. Navegar a "Grupos" en el menú lateral
2. Seleccionar un grupo (ej: "9no 1")
3. Click en un estudiante (ej: "Mateo López")
4. Verificar la sección "Contemplaciones"

**Resultado esperado:**
- ✅ Dos secciones claramente separadas:
  - **"Contemplaciones para CLASE"** (encabezado visible)
  - **"Contemplaciones para EVALUACIÓN"** (encabezado visible)
- ✅ Cada sección tiene su propia lista de checkboxes
- ✅ Las contemplaciones se muestran bajo la categoría correcta

**Screenshot sugerido:** `qa-screenshots/01-split-ui.png`

---

### Test 1.2: Selección Independiente

**Pasos:**
1. En "Contemplaciones para CLASE": Marcar 2 contemplaciones (ej: #1, #2)
2. En "Contemplaciones para EVALUACIÓN": Marcar 1 contemplación diferente (ej: #10)
3. Cerrar el modal/perfil
4. Reabrir el perfil del mismo estudiante

**Resultado esperado:**
- ✅ Las 2 contemplaciones de CLASE siguen marcadas
- ✅ La 1 contemplación de EVALUACIÓN sigue marcada
- ✅ NO hay cross-contamination (contemplaciones de una categoría no aparecen en la otra)

**Logs esperados en console:**
```
[StudentProfile] Loading contemplaciones for student: Mateo López
[StudentProfile] CLASE: ['contemplacion-1', 'contemplacion-2']
[StudentProfile] EVALUACIÓN: ['contemplacion-10']
```

---

### Test 1.3: Badge "Sugeridas"

**Pasos:**
1. Verificar que contemplaciones con `sugerida: true` en mockData muestran badge
2. Buscar contemplaciones marcadas como sugeridas en el código (ej: #1-#6 para CLASE)

**Resultado esperado:**
- ✅ Contemplaciones sugeridas muestran badge azul/celeste "Sugerida"
- ✅ Badge aparece al lado del checkbox
- ✅ Badge es visible pero no obstrusivo

**Verificar en código:**
```typescript
// src/data/mockData.ts
{
  id: 'contemplacion-1',
  text: 'Lectura oral de consignas...',
  categoria: 'CLASE',
  sugerida: true  // ← Debe mostrar badge
}
```

---

## PARTE 2: Persistencia en localStorage

### Objetivo
Verificar que las selecciones se persisten correctamente y por separado.

---

### Test 2.1: Persistencia de CLASE

**Pasos:**
1. Seleccionar contemplaciones SOLO en categoría CLASE
2. Cerrar modal/perfil
3. **Refrescar la página completa (F5)**
4. Reabrir perfil del estudiante

**Resultado esperado:**
- ✅ Contemplaciones de CLASE siguen marcadas después de refresh
- ✅ Contemplaciones de EVALUACIÓN siguen sin marcar

**Verificar en localStorage:**
```javascript
// En console del navegador:
const studentId = 'mateo-lopez-id'; // Reemplazar con ID real
const claseKey = `contemplaciones_clase_${studentId}`;
console.log(localStorage.getItem(claseKey));
// Debe mostrar: '["contemplacion-1","contemplacion-2"]'
```

---

### Test 2.2: Persistencia de EVALUACIÓN

**Pasos:**
1. Seleccionar contemplaciones SOLO en categoría EVALUACIÓN
2. Cerrar modal/perfil
3. **Refrescar la página completa (F5)**
4. Reabrir perfil del estudiante

**Resultado esperado:**
- ✅ Contemplaciones de EVALUACIÓN siguen marcadas después de refresh
- ✅ Contemplaciones de CLASE siguen sin marcar

**Verificar en localStorage:**
```javascript
const studentId = 'mateo-lopez-id';
const evalKey = `contemplaciones_evaluacion_${studentId}`;
console.log(localStorage.getItem(evalKey));
// Debe mostrar: '["contemplacion-10","contemplacion-11"]'
```

---

### Test 2.3: Independencia de Keys

**Pasos:**
1. Marcar contemplaciones en AMBAS categorías para un estudiante
2. Inspeccionar localStorage

**Resultado esperado:**
- ✅ Dos keys separadas en localStorage:
  - `contemplaciones_clase_${studentId}`
  - `contemplaciones_evaluacion_${studentId}`
- ✅ Cada key contiene SOLO las contemplaciones de su categoría

**Verificar:**
```javascript
// Listar todas las keys de contemplaciones:
Object.keys(localStorage).filter(k => k.includes('contemplaciones'));
// Debe mostrar ambas keys por separado
```

---

## PARTE 3: Contemplaciones Custom

### Objetivo
Verificar que las contemplaciones personalizadas funcionan end-to-end.

---

### Test 3.1: Crear Contemplación Custom (CLASE)

**Pasos:**
1. En perfil de estudiante, scroll a sección "Contemplaciones para CLASE"
2. Click en botón "Agregar contemplación personalizada"
3. Escribir título custom: "Necesita breaks cada 20 minutos"
4. Click "Agregar"

**Resultado esperado:**
- ✅ Nueva contemplación aparece en la lista de CLASE
- ✅ Checkbox está automáticamente marcado
- ✅ Badge "Custom" o similar visible (si aplica)

**Verificar en localStorage:**
```javascript
const customKey = `contemplaciones_custom_clase_${studentId}`;
console.log(localStorage.getItem(customKey));
// Debe incluir: { "id": "custom-...", "text": "Necesita breaks cada 20 minutos", ... }
```

---

### Test 3.2: Editar Contemplación Custom

**Pasos:**
1. Click en icono de edición (lápiz) al lado de la contemplación custom
2. Modificar texto: "Necesita breaks cada 30 minutos"
3. Guardar

**Resultado esperado:**
- ✅ Texto se actualiza en la UI inmediatamente
- ✅ Contemplación sigue marcada
- ✅ localStorage se actualiza con nuevo texto

**Verificar:**
```javascript
const customKey = `contemplaciones_custom_clase_${studentId}`;
const customs = JSON.parse(localStorage.getItem(customKey) || '[]');
console.log(customs[0].text); // Debe mostrar texto actualizado
```

---

### Test 3.3: Eliminar Contemplación Custom

**Pasos:**
1. Click en icono de eliminar (X o papelera) al lado de la contemplación custom
2. Confirmar eliminación (si hay diálogo de confirmación)

**Resultado esperado:**
- ✅ Contemplación desaparece de la UI inmediatamente
- ✅ localStorage se actualiza (contemplación removida)

**Verificar:**
```javascript
const customKey = `contemplaciones_custom_clase_${studentId}`;
const customs = JSON.parse(localStorage.getItem(customKey) || '[]');
console.log(customs.length); // Debe ser 0 si era la única
```

---

### Test 3.4: Custom en Categoría EVALUACIÓN

**Pasos:**
1. Repetir Tests 3.1, 3.2, 3.3 pero en la sección "Contemplaciones para EVALUACIÓN"
2. Crear custom: "Tiempo extendido de 50%"
3. Editar y eliminar

**Resultado esperado:**
- ✅ Mismo comportamiento que CLASE
- ✅ localStorage usa key diferente: `contemplaciones_custom_evaluacion_${studentId}`

---

### Test 3.5: Persistencia de Regla Hidden

**Objetivo:** Verificar que las contemplaciones custom generan reglas hidden correctamente.

**Pasos:**
1. Crear contemplación custom en CLASE: "Preferencia por trabajo individual"
2. Navegar a sección de planificación de clase (si aplica)
3. Generar plan para grupo que incluye este estudiante

**Resultado esperado:**
- ✅ En "Diferenciación/Adaptaciones", debe aparecer: "{Nombre del estudiante}: Preferencia por trabajo individual"
- ✅ La regla se comporta como cualquier otra contemplación

**Nota:** Este test verifica integración end-to-end de custom contemplaciones en el sistema de enforcement.

---

## PARTE 4: Reminders en Evaluaciones

### Objetivo
Verificar que reminders aparecen SOLO en student cards, NUNCA en cuadernillo.

---

### Test 4.1: Reminders en Student Cards

**Pasos:**
1. Navegar a "Evaluaciones" → Seleccionar grupo
2. Agregar 2-3 estudiantes con contemplaciones de EVALUACIÓN marcadas
3. Click "Generar Cuadernillo"
4. Abrir el PDF generado

**Resultado esperado en Student Cards:**
- ✅ Cada student card tiene sección "¿A quién contempla esta prueba?"
- ✅ Bajo esta sección, aparecen los reminders específicos del estudiante:
  - "✓ {Nombre}: {Texto de contemplación}"
- ✅ Solo contemplaciones de categoría EVALUACIÓN aparecen aquí

**Screenshot sugerido:** `qa-screenshots/04-student-card-reminders.png`

---

### Test 4.2: Ausencia de Reminders en Cuadernillo

**Pasos:**
1. Con el mismo PDF del Test 4.1
2. Scroll a través de todas las páginas del cuadernillo (las preguntas/ejercicios)

**Resultado esperado:**
- ✅ **NO** debe aparecer ningún reminder en el cuadernillo principal
- ✅ **NO** debe aparecer texto como "Contemplación:", "Recordatorio:", etc. en las páginas de ejercicios
- ✅ El cuadernillo solo contiene: título, instrucciones, preguntas, espacios de respuesta

**Ubicaciones a verificar:**
- [ ] Portada del cuadernillo
- [ ] Instrucciones generales
- [ ] Cada pregunta/ejercicio
- [ ] Headers/footers de páginas

**Screenshot sugerido:** `qa-screenshots/04-cuadernillo-clean.png`

---

### Test 4.3: Versionado Correcto (Flags-Driven)

**Pasos:**
1. En perfil de un estudiante, marcar:
   - ☑️ "Requiere adecuación de CONTENIDO"
2. En perfil de otro estudiante:
   - ☑️ "Requiere adecuación de ACCESO" (sin contenido)
3. Generar evaluación

**Resultado esperado:**
- ✅ Se generan 3 archivos:
  - `evaluacion_v1.pdf` (estudiantes estándar)
  - `evaluacion_v2.pdf` (estudiante con adecuación de acceso)
  - `evaluacion_v3.pdf` (estudiante con adecuación de contenido)
- ✅ Cada PDF contiene SOLO los estudiantes de esa versión

**Verificar en logs de console:**
```
[EvaluacionesGrupo] Version data: {
  v1: [{ nombre: "...", ... }],
  v2: [{ nombre: "...", ... }],
  v3: [{ nombre: "...", ... }],
  hasContentAdaptation: true
}
```

---

### Test 4.4: Sin V3 Cuando No Hay Content Adaptation

**Pasos:**
1. Asegurarse de que NINGÚN estudiante tiene "Requiere adecuación de CONTENIDO" marcado
2. Generar evaluación

**Resultado esperado:**
- ✅ Se generan SOLO 2 archivos:
  - `evaluacion_v1.pdf`
  - `evaluacion_v2.pdf` (si aplica)
- ✅ **NO** se genera `evaluacion_v3.pdf`

**Verificar en logs:**
```
[EvaluacionesGrupo] hasContentAdaptation: false
[EvaluacionesGrupo] Skipping V3 generation (no students require content adaptation)
```

---

## PARTE 5: Reminders en Planificación de Clase

### Objetivo
Verificar que reminders aparecen SOLO en "Diferenciación/Adaptaciones", con nombres de estudiantes.

---

### Test 5.1: Generación Inicial de Plan

**Pasos:**
1. Navegar a "Planificaciones"
2. Crear nueva planificación para grupo "9no 1"
3. Asegurarse de que estudiantes tienen contemplaciones CLASE marcadas
4. Generar el plan de una sesión

**Resultado esperado:**
- ✅ En la sección "Diferenciación/Adaptaciones", aparecen reminders como:
  - "• Mateo López: Lectura oral de consignas (si hay consignas escritas puntuales)"
  - "• Ana García, Juan Pérez: Explicaciones con soporte visual explícito"
- ✅ SOLO contemplaciones de categoría CLASE aparecen
- ✅ Cada reminder incluye nombre(s) de estudiante(s)

**Logs esperados:**
```
[INITIAL-GEN-CONTEMPLACIONES] Building plan: {
  studentsCount: 15,
  enforcementBlockLength: 3,
  replaceModeUsed: true
}
[DIFF-STRIP] ✅ Verification passed: No generic text in final HTML
```

---

### Test 5.2: Regeneración/"Aplicar Cambios"

**Pasos:**
1. En el mismo plan del Test 5.1
2. Click en "Solicitar cambios a la IA"
3. Escribir: "Agrega una actividad de debate"
4. Click en "Aplicar cambios"

**Resultado esperado:**
- ✅ Después de regenerar, la sección "Diferenciación/Adaptaciones" TODAVÍA contiene los mismos reminders con nombres
- ✅ **NO** aparecen bullets genéricos como:
  - "Adaptación para perfil visual: ..."
  - "Considerar estudiantes con perfil auditivo..."
- ✅ Los reminders se mantienen intactos incluso después de modificaciones

**Logs esperados:**
```
[REGENERATE-CONTEMPLACIONES] Building plan: {
  studentsCount: 15,
  enforcementBlockLength: 3,
  replaceModeUsed: true
}
[DIFF-STRIP] Stripping summary: { remindersCount: 3, didStrip: true }
[DIFF-STRIP] ✅ Verification passed: No generic text in final HTML
```

---

### Test 5.3: Ausencia en Otras Secciones

**Pasos:**
1. Con el mismo plan generado
2. Revisar secciones "Inicio", "Desarrollo", "Cierre"

**Resultado esperado:**
- ✅ **NO** debe aparecer ningún reminder de contemplaciones en estas secciones
- ✅ Las actividades pueden estar adaptadas internamente (razonamiento de IA), pero sin menciones explícitas de estudiantes o contemplaciones

**Ubicaciones a verificar:**
- [ ] Sección "Inicio"
- [ ] Sección "Desarrollo"
- [ ] Sección "Cierre"
- [ ] Sección "Recursos" (si aplica)

---

### Test 5.4: Plan Sin Contemplaciones (Backward Compatible)

**Pasos:**
1. Crear/seleccionar un grupo temporal sin estudiantes o donde ningún estudiante tenga contemplaciones CLASE marcadas
2. Generar plan para ese grupo

**Resultado esperado:**
- ✅ La sección "Diferenciación/Adaptaciones" muestra contenido genérico de IA (si lo generó)
- ✅ **NO** se ejecuta stripping de bloques (no hay reminders)
- ✅ El plan se genera sin errores

**Logs esperados:**
```
[INITIAL-GEN-CONTEMPLACIONES] No reminders generated (no contemplaciones selected?)
[INITIAL-GEN-CONTEMPLACIONES] keeping AI diferenciacion
```

---

## PARTE 6: Prohibiciones Explícitas

### Objetivo
Verificar que ciertas features NO están presentes (por diseño).

---

### Test 6.1: No Evaluaciones Orales/Audio

**Pasos:**
1. Generar evaluación para cualquier grupo
2. Revisar todas las versiones (V1, V2, V3)
3. Buscar indicios de soporte oral/audio

**Resultado esperado:**
- ❌ **NO** debe haber:
  - Instrucciones de "leer en voz alta"
  - Menciones de "grabación de audio"
  - Archivos de audio adjuntos
  - Instrucciones para evaluación oral

**Razón:** Evaluaciones orales/audio están fuera del scope de Contemplaciones V2.

---

### Test 6.2: No Inferencia de Versionado

**Objetivo:** Confirmar que versión NO se infiere de cantidad de contemplaciones.

**Pasos:**
1. Crear estudiante con 10 contemplaciones EVALUACIÓN marcadas
2. Asegurarse de que flags explícitos son:
   - `requiereAdecuacionContenido: false`
   - `requiereAdecuacionAcceso: false`
3. Generar evaluación

**Resultado esperado:**
- ✅ Estudiante se asigna a **V1** (estándar)
- ✅ **NO** se asigna a V3 por tener muchas contemplaciones

**Verificar en docs:**
- Referencia: `docs/EVAL_VERSIONING_GUARDRAILS.md` - Ejemplo 4

---

### Test 6.3: No Reminders en Recursos

**Pasos:**
1. Generar plan de clase con reminders
2. Revisar sección "Recursos" del plan

**Resultado esperado:**
- ✅ Sección "Recursos" contiene SOLO materiales/recursos
- ❌ **NO** debe haber reminders de contemplaciones en esta sección

---

## PARTE 7: Integración End-to-End

### Objetivo
Verificar flujo completo de un estudiante con contemplaciones en ambas categorías.

---

### Test 7.1: Flujo Completo - Estudiante con Ambas Categorías

**Setup:**
1. Seleccionar estudiante: "Mateo López"
2. Marcar contemplaciones:
   - CLASE: #1 (Lectura oral), #2 (Soporte visual)
   - EVALUACIÓN: #10 (Tiempo extendido), #11 (Formato simplificado)
3. Marcar flags:
   - ☑️ Requiere adecuación de CONTENIDO

**Pasos:**
1. Generar plan de clase que incluye a Mateo
2. Generar evaluación que incluye a Mateo

**Resultado esperado en Plan de Clase:**
- ✅ "Diferenciación/Adaptaciones" menciona:
  - "Mateo López: Lectura oral de consignas..."
  - "Mateo López: Explicaciones con soporte visual..."
- ✅ Solo contemplaciones CLASE aparecen

**Resultado esperado en Evaluación:**
- ✅ Mateo aparece en `evaluacion_v3.pdf`
- ✅ Su student card menciona:
  - "✓ Mateo López: Tiempo extendido"
  - "✓ Mateo López: Formato simplificado"
- ✅ Solo contemplaciones EVALUACIÓN aparecen

**Verificación clave:**
- ✅ NO hay cross-contamination: contemplaciones CLASE no aparecen en evaluación
- ✅ NO hay cross-contamination: contemplaciones EVALUACIÓN no aparecen en plan

---

## PARTE 8: Regresión / Backward Compatibility

### Objetivo
Asegurarse de que features antiguas siguen funcionando.

---

### Test 8.1: Estudiantes Legacy (Sin Contemplaciones V2)

**Pasos:**
1. Seleccionar estudiante que NO tiene contemplaciones marcadas en V2
2. Generar plan y evaluación

**Resultado esperado:**
- ✅ Plan se genera correctamente (sin reminders)
- ✅ Evaluación se genera correctamente (V1 por defecto)
- ✅ No hay errores en console

---

### Test 8.2: Grupos Sin informeTecnico

**Pasos:**
1. Verificar que grupos legacy sin `informeTecnico` siguen funcionando
2. Generar evaluación

**Resultado esperado:**
- ✅ Estudiantes sin `informeTecnico` se asignan a V1 (estándar)
- ✅ No hay crashes ni errores

---

## RESUMEN DE COBERTURA

### Features Cubiertas

| Feature | Tests | Status |
|---------|-------|--------|
| **Split UI CLASE vs EVALUACIÓN** | 1.1, 1.2, 1.3 | ✅ |
| **Persistencia localStorage** | 2.1, 2.2, 2.3 | ✅ |
| **Contemplaciones Custom** | 3.1, 3.2, 3.3, 3.4, 3.5 | ✅ |
| **Reminders en Evaluaciones** | 4.1, 4.2, 4.3, 4.4 | ✅ |
| **Reminders en Planificación** | 5.1, 5.2, 5.3, 5.4 | ✅ |
| **Prohibiciones** | 6.1, 6.2, 6.3 | ✅ |
| **End-to-End** | 7.1 | ✅ |
| **Backward Compatibility** | 8.1, 8.2 | ✅ |

---

## Criterios de Aceptación Global

Para considerar el QA **PASSED**, todos los siguientes deben cumplirse:

- [ ] Todos los tests con ✅ pasan
- [ ] Todos los tests con ❌ confirman ausencia de features
- [ ] No hay errores en console del navegador
- [ ] No hay warnings críticos en logs
- [ ] localStorage contiene keys correctas después de cada acción
- [ ] PDFs generados tienen contenido correcto
- [ ] Screenshots documentan el comportamiento visual

---

## Reportar Issues

Si encuentras un problema durante QA, documenta:

1. **Test ID:** (ej: Test 4.2)
2. **Resultado esperado:** (copiar del checklist)
3. **Resultado actual:** (describir qué pasó)
4. **Steps to reproduce:** (pasos exactos)
5. **Screenshots:** (adjuntar si aplica)
6. **Console logs:** (copiar errores/warnings)
7. **Browser:** (Chrome, Firefox, etc. + versión)

**Ejemplo de issue:**
```
Test ID: 5.2 - Regeneración/"Aplicar Cambios"
Resultado esperado: Reminders se mantienen después de regenerar
Resultado actual: Reminders desaparecen al regenerar
Steps: [pasos exactos]
Console: [REGENERATE-CONTEMPLACIONES] WARNING: ...
Browser: Chrome 120
```

---

**Última actualización:** 2026-01-24  
**Autor:** AI Assistant  
**Revisor:** Eitan Wuhl  
**Status:** ✅ READY FOR QA

