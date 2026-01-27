# Checklist de Verificación: Motor de Enforcement Determinístico

**Fecha de creación:** 2026-01-23  
**Rama:** `Nuevos-perfiles-y-reglas-para-contemplaciones`  
**Objetivo:** Verificar que el motor de enforcement coloca recordatorios y reglas de diseño en los lugares correctos, sin duplicaciones ni errores de ubicación.

---

## A) Nombres Canónicos en la UI

### 1. Sección de Tarjetas de Estudiante en Evaluaciones

**Nombre exacto en la UI:** `¿A quién contempla esta versión?`

**Ubicación:**
- Aparece dentro de la sección "Rúbrica de Evaluación"
- Es una tarjeta (Card) con icono de usuarios (Users)
- Cada estudiante tiene su propia tarjeta pequeña dentro de esta sección
- Actualmente muestra: nombre del estudiante + justificación

**Componente:** `SimplifiedSmartRubric.tsx` (línea 298)

**Dónde encontrarlo:**
1. Ir a una evaluación generada
2. Buscar la sección "Rúbrica de Evaluación"
3. Dentro de esa sección, buscar la tarjeta con título "¿A quién contempla esta versión?"

---

### 2. Sección de Diferenciación en Planes de Clase

**Nombre exacto en la UI:** `Diferenciación/Adaptaciones`

**Ubicación:**
- Aparece al final del plan de clase, después de la sección "Cierre"
- Es un encabezado H2 con el texto "Diferenciación/Adaptaciones"
- Contiene texto estructurado con nombres de estudiantes

**Componente:** `EditorSesionNuevo.tsx` (línea 796)

**Dónde encontrarlo:**
1. Ir a un plan de clase editado o generado
2. Desplazarse hasta el final del plan
3. Buscar el encabezado "Diferenciación/Adaptaciones" (después de "Cierre")

---

### 3. Artefacto de Evaluación para Estudiantes (Cuadernillo)

**Nombre exacto en la UI:** No tiene un título específico, pero es la sección que muestra el contenido puro de la evaluación

**Ubicación:**
- Es la segunda tarjeta grande en la vista de evaluación
- Muestra el título de la evaluación con un badge de "Versión X"
- Contiene SOLO el contenido de la evaluación (consignas, preguntas, ejercicios)
- NO contiene recordatorios, metadatos, ni información para docentes

**Componente:** `CleanEvaluationDisplay.tsx`

**Dónde encontrarlo:**
1. Ir a una evaluación generada
2. Buscar la segunda tarjeta grande (después de la tarjeta de información)
3. Esta tarjeta muestra el contenido puro de la evaluación, listo para imprimir o mostrar a estudiantes

**Características visuales:**
- Tiene un icono de libro (BookOpen)
- Muestra el título de la evaluación
- Tiene un badge con "Versión 1", "Versión 2", o "Versión 3"
- El contenido es HTML renderizado (consignas, preguntas, etc.)

---

## B) Checklist de Verificación Paso a Paso

### Requisito 1: Recordatorios de Evaluación SOLO en Tarjetas de Estudiante

**Objetivo:** Verificar que los recordatorios por estudiante aparecen SOLO dentro de las tarjetas de "¿A quién contempla esta versión?" y NUNCA en el contenido de la evaluación que ven los estudiantes.

---

#### Test 1.1: Recordatorios Aparecen en Tarjetas de Estudiante

**Pasos:**

1. **Preparar datos de prueba:**
   - Ir a "Perfiles de Estudiantes" (o la sección donde se editan estudiantes)
   - Seleccionar un estudiante de prueba (ej: "Juan Pérez")
   - En la sección "Contemplaciones para evaluaciones", seleccionar:
     - ✅ "Lectura oral de consignas" (contemplación #1)
     - ✅ "Tiempo adicional y pausas" (contemplación #3)
     - ✅ "Corrección centrada en contenido (no forma)" (contemplación #9-22)
   - Guardar los cambios

2. **Generar evaluación:**
   - Ir a "Evaluaciones" → "Crear Evaluación" o seleccionar una evaluación existente
   - Asignar el estudiante "Juan Pérez" a una versión de la evaluación
   - Generar o visualizar la evaluación

3. **Verificar ubicación correcta:**
   - Buscar la sección "Rúbrica de Evaluación"
   - Dentro de esa sección, buscar la tarjeta "¿A quién contempla esta versión?"
   - Buscar la tarjeta pequeña con el nombre "Juan Pérez"
   - **VERIFICAR:** Dentro de la tarjeta de "Juan Pérez" deberían aparecer recordatorios como:
     - "Recordar leer consignas en voz alta"
     - "Recuerda brindar más tiempo y pausas en caso de ser necesario para este alumno"
     - "No penalizar ortografía/sintaxis cuando no es objetivo"

**✅ Resultado esperado:** Los recordatorios aparecen DENTRO de la tarjeta del estudiante en "¿A quién contempla esta versión?"

---

#### Test 1.2: Recordatorios NO Aparecen en el Contenido de la Evaluación

**Pasos:**

1. **Usar la misma evaluación del Test 1.1**

2. **Verificar el contenido de la evaluación:**
   - Buscar la segunda tarjeta grande (la que muestra el contenido puro de la evaluación)
   - Esta tarjeta tiene un icono de libro y muestra el título de la evaluación
   - Revisar TODO el contenido visible en esa tarjeta:
     - Consignas
     - Preguntas
     - Ejercicios
     - Cualquier texto visible

3. **Buscar texto prohibido:**
   - Buscar las frases: "Recordar leer consignas"
   - Buscar: "Recuerda brindar más tiempo"
   - Buscar: "No penalizar ortografía"
   - Buscar: "Recordatorio"
   - Buscar cualquier mención a contemplaciones o adaptaciones

**✅ Resultado esperado:** El contenido de la evaluación (cuadernillo) NO contiene NINGÚN recordatorio, NINGUNA mención a contemplaciones, NINGUNA instrucción para docentes.

**❌ Si encuentras recordatorios aquí:** Es un ERROR. Los recordatorios NO deben aparecer en el contenido que ven los estudiantes.

---

#### Test 1.3: Múltiples Estudiantes con Diferentes Contemplaciones

**Pasos:**

1. **Preparar dos estudiantes:**
   - **Estudiante A (María González):**
     - Seleccionar: "Lectura oral de consignas" (#1)
     - Seleccionar: "Hoja auxiliar / borrador permitido" (#6)
   - **Estudiante B (Pedro Martínez):**
     - Seleccionar: "Corrección centrada en contenido" (#9-22)
     - Seleccionar: "Inicio anticipado / extensión operativa del tiempo" (#21)

2. **Generar evaluación:**
   - Asignar ambos estudiantes a la misma versión de la evaluación
   - Generar o visualizar la evaluación

3. **Verificar separación:**
   - Ir a "¿A quién contempla esta versión?"
   - Verificar que hay DOS tarjetas de estudiante:
     - Tarjeta de "María González" con SUS recordatorios específicos
     - Tarjeta de "Pedro Martínez" con SUS recordatorios específicos
   - **VERIFICAR:** Los recordatorios de María NO aparecen en la tarjeta de Pedro, y viceversa

**✅ Resultado esperado:** Cada estudiante tiene su propia tarjeta con sus propios recordatorios, sin mezclar.

---

### Requisito 2: Recordatorios de Plan de Clase SOLO en Diferenciación/Adaptaciones

**Objetivo:** Verificar que los recordatorios de plan de clase aparecen SOLO en la sección "Diferenciación/Adaptaciones" con nombres de estudiantes, y NO se duplican en otras partes del plan.

---

#### Test 2.1: Recordatorios Aparecen en Diferenciación/Adaptaciones

**Pasos:**

1. **Preparar datos de prueba:**
   - Ir a "Perfiles de Estudiantes"
   - Seleccionar un estudiante (ej: "Ana López")
   - En la sección "Contemplaciones para la clase", seleccionar:
     - ✅ "Lectura oral de consignas" (#1)
     - ✅ "Monitoreo docente y andamiaje" (#10)
     - ✅ "Reducción de copia mecánica" (#15)
   - Guardar los cambios

2. **Generar o editar plan de clase:**
   - Ir a "Planificación" → Crear o editar un plan de clase
   - Asignar el estudiante "Ana López" al grupo de la clase
   - Generar o guardar el plan

3. **Verificar ubicación correcta:**
   - Abrir el plan de clase completo
   - Desplazarse hasta el final del plan (después de "Cierre")
   - Buscar el encabezado "Diferenciación/Adaptaciones"
   - **VERIFICAR:** Dentro de esa sección deberían aparecer líneas como:
     - "Recordar leer consignas escritas en voz alta para Ana López (si hay consignas escritas puntuales)"
     - "Recuerda monitorear la comprensión de Ana López"
     - "Recordar llevar material impreso para Ana López"

**✅ Resultado esperado:** Los recordatorios aparecen DENTRO de la sección "Diferenciación/Adaptaciones" con el nombre del estudiante.

---

#### Test 2.2: Recordatorios NO Aparecen en Otras Secciones del Plan

**Pasos:**

1. **Usar el mismo plan del Test 2.1**

2. **Verificar otras secciones:**
   - Revisar la sección "Inicio" del plan
   - Revisar la sección "Desarrollo" del plan
   - Revisar la sección "Cierre" del plan
   - Buscar en TODO el contenido visible del plan (excepto "Diferenciación/Adaptaciones")

3. **Buscar texto prohibido:**
   - Buscar: "Recordar leer consignas"
   - Buscar: "Recuerda monitorear"
   - Buscar: "Recordar llevar material"
   - Buscar el nombre del estudiante seguido de contemplaciones

**✅ Resultado esperado:** Los recordatorios NO aparecen en "Inicio", "Desarrollo", ni "Cierre". SOLO aparecen en "Diferenciación/Adaptaciones".

**❌ Si encuentras recordatorios en otras secciones:** Es un ERROR. Los recordatorios NO deben duplicarse.

---

#### Test 2.3: Múltiples Estudiantes Agrupados Correctamente

**Pasos:**

1. **Preparar tres estudiantes:**
   - **Estudiante A (Carlos Ruiz):**
     - Seleccionar: "Monitoreo docente y andamiaje" (#10)
   - **Estudiante B (Laura Sánchez):**
     - Seleccionar: "Monitoreo docente y andamiaje" (#10) (misma contemplación)
   - **Estudiante C (Diego Torres):**
     - Seleccionar: "Reducción de copia mecánica" (#15)

2. **Generar plan de clase:**
   - Asignar los tres estudiantes al grupo de la clase
   - Generar o guardar el plan

3. **Verificar agrupación:**
   - Ir a "Diferenciación/Adaptaciones"
   - **VERIFICAR:** Debería aparecer una línea que agrupa a Carlos y Laura:
     - "Recuerda monitorear la comprensión de Carlos y Laura"
   - **VERIFICAR:** Debería aparecer una línea separada para Diego:
     - "Recordar llevar material impreso para Diego"

**✅ Resultado esperado:** Los estudiantes con la misma contemplación aparecen agrupados en una sola línea. Los estudiantes con contemplaciones diferentes aparecen en líneas separadas.

---

### Requisito 3: Reglas de Diseño Afectan SOLO el Formato del Contenido

**Objetivo:** Verificar que las reglas de diseño (tipografía, negritas, segmentación) se aplican al contenido de la evaluación, pero NO aparecen como recordatorios en las tarjetas de estudiante.

---

#### Test 3.1: Reglas de Diseño Aplicadas al Contenido

**Pasos:**

1. **Preparar datos de prueba:**
   - Seleccionar un estudiante
   - En "Contemplaciones para evaluaciones", seleccionar:
     - ✅ "Palabras clave en negrita e íconos de apoyo" (#2)
     - ✅ "Tipografía recomendada y tamaño mínimo" (#17)
     - ✅ "Enunciados simples y lenguaje concreto" (#18)

2. **Generar evaluación:**
   - Asignar el estudiante a una versión
   - Generar la evaluación

3. **Verificar formato del contenido:**
   - Ir a la tarjeta que muestra el contenido puro de la evaluación (la segunda tarjeta grande)
   - Revisar el contenido visible:
     - **VERIFICAR:** Las palabras clave deberían estar en **negrita**
     - **VERIFICAR:** La tipografía debería ser legible (Arial 13-14, interlineado 1.5)
     - **VERIFICAR:** Los enunciados deberían ser simples y concretos (sin frases encadenadas)

**✅ Resultado esperado:** El contenido de la evaluación muestra el formato aplicado (negritas, tipografía, enunciados simples).

---

#### Test 3.2: Reglas de Diseño NO Aparecen como Recordatorios

**Pasos:**

1. **Usar la misma evaluación del Test 3.1**

2. **Verificar tarjetas de estudiante:**
   - Ir a "¿A quién contempla esta versión?"
   - Buscar la tarjeta del estudiante
   - Revisar TODO el contenido de la tarjeta

3. **Buscar texto prohibido:**
   - Buscar: "Palabras clave en negrita"
   - Buscar: "Tipografía: Arial 13-14"
   - Buscar: "Enunciados simples"
   - Buscar cualquier mención a reglas de diseño o formato

**✅ Resultado esperado:** Las tarjetas de estudiante NO contienen NINGUNA mención a reglas de diseño, formato, tipografía, o negritas.

**❌ Si encuentras reglas de diseño en las tarjetas:** Es un ERROR. Las reglas de diseño NO deben aparecer como recordatorios.

---

#### Test 3.3: Separación Clara: Recordatorios vs Diseño

**Pasos:**

1. **Preparar estudiante con ambos tipos:**
   - Seleccionar un estudiante
   - En "Contemplaciones para evaluaciones", seleccionar:
     - ✅ "Lectura oral de consignas" (#1) → **Recordatorio**
     - ✅ "Palabras clave en negrita" (#2) → **Regla de diseño**
     - ✅ "Tiempo adicional y pausas" (#3) → **Recordatorio**
     - ✅ "Tipografía recomendada" (#17) → **Regla de diseño**

2. **Generar evaluación y verificar:**
   - **En tarjetas de estudiante ("¿A quién contempla...?"):**
     - ✅ Debe aparecer: "Recordar leer consignas en voz alta"
     - ✅ Debe aparecer: "Recuerda brindar más tiempo y pausas..."
     - ❌ NO debe aparecer: "Palabras clave en negrita"
     - ❌ NO debe aparecer: "Tipografía: Arial 13-14"
   
   - **En contenido de evaluación (cuadernillo):**
     - ✅ Debe aplicarse: Palabras clave en negrita
     - ✅ Debe aplicarse: Tipografía legible
     - ❌ NO debe aparecer: "Recordar leer consignas"
     - ❌ NO debe aparecer: "Recuerda brindar más tiempo"

**✅ Resultado esperado:** Separación clara: recordatorios en tarjetas, diseño en contenido.

---

## C) Resumen de Verificación

### Checklist Rápido

**Requisito 1: Recordatorios de Evaluación**
- [ ] Los recordatorios aparecen en "¿A quién contempla esta versión?"
- [ ] Los recordatorios NO aparecen en el contenido de la evaluación
- [ ] Cada estudiante tiene sus propios recordatorios separados

**Requisito 2: Recordatorios de Plan de Clase**
- [ ] Los recordatorios aparecen en "Diferenciación/Adaptaciones"
- [ ] Los recordatorios NO aparecen en "Inicio", "Desarrollo", ni "Cierre"
- [ ] Los recordatorios incluyen nombres de estudiantes
- [ ] Los estudiantes con la misma contemplación aparecen agrupados

**Requisito 3: Reglas de Diseño**
- [ ] Las reglas de diseño se aplican al formato del contenido
- [ ] Las reglas de diseño NO aparecen como recordatorios en tarjetas
- [ ] Hay separación clara entre recordatorios y diseño

---

## D) Datos de Prueba Recomendados

### Estudiante de Prueba 1: "Juan Pérez"
**Contemplaciones para evaluaciones:**
- Lectura oral de consignas (#1)
- Tiempo adicional y pausas (#3)
- Corrección centrada en contenido (#9-22)

**Contemplaciones para la clase:**
- Lectura oral de consignas (#1)
- Monitoreo docente y andamiaje (#10)
- Reducción de copia mecánica (#15)

### Estudiante de Prueba 2: "María González"
**Contemplaciones para evaluaciones:**
- Palabras clave en negrita (#2)
- Tipografía recomendada (#17)
- Enunciados simples (#18)

**Contemplaciones para la clase:**
- Palabras clave en negrita (#2)
- Letra ampliada y alto contraste (#4)

### Estudiante de Prueba 3: "Pedro Martínez"
**Contemplaciones para evaluaciones:**
- Hoja auxiliar / borrador permitido (#6)
- Inicio anticipado / extensión operativa (#21)

**Contemplaciones para la clase:**
- Ubicación estratégica en aula (#11)
- Anticipación y estructura previa (#12)

---

## E) Errores Comunes a Detectar

### ❌ Error 1: Recordatorios en el Cuadernillo
**Síntoma:** Aparecen frases como "Recordar leer consignas" dentro del contenido de la evaluación.

**Dónde buscar:** En la segunda tarjeta grande (contenido puro de la evaluación).

**Solución esperada:** Los recordatorios deben estar SOLO en las tarjetas de "¿A quién contempla esta versión?".

---

### ❌ Error 2: Reglas de Diseño como Recordatorios
**Síntoma:** Aparecen frases como "Palabras clave en negrita" en las tarjetas de estudiante.

**Dónde buscar:** En las tarjetas de "¿A quién contempla esta versión?".

**Solución esperada:** Las reglas de diseño deben aplicarse al formato del contenido, NO aparecer como texto en las tarjetas.

---

### ❌ Error 3: Recordatorios Duplicados en Plan de Clase
**Síntoma:** Los recordatorios aparecen tanto en "Diferenciación/Adaptaciones" como en "Inicio" o "Desarrollo".

**Dónde buscar:** En todas las secciones del plan de clase.

**Solución esperada:** Los recordatorios deben aparecer SOLO en "Diferenciación/Adaptaciones".

---

### ❌ Error 4: Recordatorios sin Nombres de Estudiantes
**Síntoma:** En "Diferenciación/Adaptaciones" aparecen recordatorios genéricos sin mencionar nombres.

**Dónde buscar:** En la sección "Diferenciación/Adaptaciones" del plan de clase.

**Solución esperada:** Todos los recordatorios deben incluir nombres de estudiantes (ej: "para Juan y María").

---

## F) Notas de Implementación

**Estado actual:** El motor de enforcement (`src/lib/contemplaciones/enforcement.ts`) está implementado y genera los outputs correctos, pero **aún no está integrado** en los componentes de UI.

**Próximos pasos:**
1. Integrar `enforceForEvaluation()` en `SimplifiedSmartRubric.tsx` para mostrar recordatorios en las tarjetas de estudiante.
2. Integrar `enforceForLessonPlan()` en `EditorSesionNuevo.tsx` para incluir diferenciación en los planes.
3. Integrar `versionDesignRules` en la generación del cuadernillo para aplicar formato.

**Este checklist es válido una vez que la integración esté completa.**

---

**Última actualización:** 2026-01-23



