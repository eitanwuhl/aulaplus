# Flujo 07 — Generación y modificación de evaluaciones con IA

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Alta · **Depende de:** flujos 03 (Contemplaciones) y 06 (Evaluaciones).

## 1. Propósito

Definir el motor de IA que **genera** una evaluación escrita completa y sus **versiones adaptadas**, y que la **modifica** ante pedidos del docente, manteniendo alineación curricular, coherencia de puntajes, respeto al tiempo disponible y cumplimiento de las contemplaciones de cada estudiante. El objetivo pedagógico es que el docente obtenga, en un paso, un instrumento válido y accesible bajo el enfoque de Diseño Universal para el Aprendizaje (DUA), sin bajar la exigencia cognitiva.

Un principio rector separa dos actividades:
- **Cálculo determinista previo (plan de diseño):** decisiones que no deben depender del azar del modelo (qué versiones pedir, a quién asignar cada una, qué reglas de diseño y recordatorios aplican, si se incluyen opciones de respuesta y cuántas).
- **Generación creativa (IA):** redacción de consignas, ítems, rúbricas, adaptaciones y narrativa, ceñida a lo que el plan y el contexto establecen.

## 2. Actores y roles

| Actor | Rol |
|---|---|
| **Docente** | Aporta currículo, fuentes, tiempo objetivo y requerimientos en lenguaje natural; pide modificaciones. |
| **Sistema (cálculo determinista)** | Construye el plan de diseño, arma el contexto, decide versiones solicitadas, normaliza y valida el resultado, redistribuye puntos. |
| **IA (modelo generativo)** | Produce la especificación de la evaluación (ítems, rúbricas, versiones adaptadas) y el reporte de diseño, respetando reglas duras. |

## 3. Glosario del dominio

- **Plan de diseño:** resultado del cálculo determinista previo a la generación. Contiene versiones a pedir, asignación estudiante→versión, opciones de respuesta, reglas de diseño del instrumento, recordatorios por estudiante y métricas del grupo.
- **Versión solicitada:** indicación de qué versiones (A/B/C) debe producir la IA en esta corrida.
- **Regla de diseño del instrumento:** instrucción de construcción derivada de una contemplación de "diseño" (p. ej. segmentar consignas, ofrecer plantillas de respuesta).
- **Opciones de respuesta equivalentes:** posibilidad de que un ítem abierto se responda en más de un formato equivalente en evidencia y dificultad (texto, esquema, lista).
- **Bucket de contemplación:** categoría funcional de una contemplación: diseño del instrumento, recordatorio de administración, recordatorio de corrección, o excepción de adaptación de contenido.
- **Perfil VARK:** estilo de aprendizaje predominante (visual, auditivo, lecto-escritor, kinestésico) usado como señal para decidir opciones de respuesta.
- **Normalización:** transformación del resultado crudo de la IA a un modelo estable y consistente para presentación y asignación.
- **Reporte de diseño:** narrativa (global y por versión) que explica qué se evaluó, por qué y cómo, y qué adaptaciones se aplicaron.

## 4. Precondiciones y dependencias

1. El flujo 06 reunió: currículo (competencias, criterios, contenidos), fuentes, tiempo objetivo y requerimientos del docente.
2. Los estudiantes tienen contemplaciones (flujo 03), ya sembradas por defecto.
3. Existe un catálogo de contemplaciones con: su bucket, su plantilla de regla de diseño y/o su plantilla de recordatorio.

## 5. Flujo principal (happy path)

1. **Construcción del plan de diseño** (determinista) a partir del contexto del grupo y los requerimientos del docente. Ver §10.
2. **Armado del contexto** para la IA: currículo + fuentes serializadas + estudiantes anonimizados + versiones solicitadas + reglas de diseño + tiempo objetivo con su tabla heurística.
3. **Solicitud a la IA** de la especificación completa (secciones, ítems, rúbricas de ítem, versiones adaptadas, opciones de respuesta y reporte).
4. **Recepción y validación** de la respuesta (estructura mínima presente y coherente).
5. **Normalización** a modelo estable (secciones/ítems numerados, etiquetas de tipo, opciones con letra, rúbrica normalizada, marca de contenido adaptado).
6. **Ensamblado del resultado**: versiones, asignación estudiante→versión, recordatorios y reporte.
7. **Modificación iterativa** (opcional): el docente pide cambios en lenguaje natural; el sistema recalcula versiones solicitadas y re-genera, preservando lo que deba conservarse (§10, política de versiones y carry-forward).

## 6. Flujos alternativos y casos borde

- **Respuesta inválida o incompleta:** se trata como fallo (ver §10, comportamiento ante fallos).
- **Versión B pedida pero incompleta:** si algún ítem quedó sin su consigna adaptada, la Versión B **no se ofrece** (solo A), salvo que un mecanismo de reparación complete lo faltante.
- **Modificación que "pierde" una versión existente:** si B existía y debía conservarse pero la nueva respuesta no la trae, se **arrastra** (carry-forward) la B previa hacia el nuevo resultado.
- **Exceso de duración:** si la evaluación estimada excede el objetivo más allá de la tolerancia, puede aplicarse una pasada de refinamiento para reducir contenido manteniendo cobertura y contemplaciones.
- **Fuentes ausentes:** si no hay materiales/sesiones/currículo explícito, el reporte debe declararlo en lugar de inventar.

## 7. Reglas de negocio

- **R1.** El plan de diseño se calcula **antes** de invocar a la IA y de forma determinista.
- **R2.** La Versión A (universal) se solicita **siempre**.
- **R3.** La Versión B (adaptación de contenido) se solicita solo cuando hay estudiantes con **adaptación de contenido declarada**.
- **R4.** La Versión C (accesibilidad equivalente) se reserva para casos excepcionales y no se auto-genera por defecto.
- **R5.** Solo los estudiantes con adaptación de contenido declarada se asignan a B; las necesidades de estructuración/formato se atienden **dentro de A** (no fuerzan una versión aparte).
- **R6.** La IA debe usar **únicamente** las competencias y criterios provistos; no inventa nuevos.
- **R7.** Toda evidencia debe ser **escrita o seleccionable**; no se admiten tareas solo orales.
- **R8.** La IA no debe **inferir diagnósticos** desde texto libre; usa solo los datos estructurados del plan/contexto.
- **R9.** La duración estimada debe caer en la banda objetivo (aprox. 95–105% del tiempo pedido), guiada por una tabla heurística de minutos por tipo de ítem.
- **R10.** Los ítems abiertos deben incluir rúbrica con **≥4 niveles** y descriptores específicos del contenido y de la acción pedida (prohibidos los descriptores genéricos reutilizables).
- **R11.** Los puntajes deben ser coherentes; la redistribución posterior mantiene mínimo 1 punto por ítem y suma exacta (ver flujo 06).
- **R12.** Cuando corresponde incluir opciones de respuesta equivalentes, todos los ítems abiertos deben ofrecer al menos el número de opciones decidido por el plan.
- **R13.** Las versiones adaptadas deben **preservar la exigencia cognitiva**: B ajusta contenido/objetivos declarados manteniendo accesibilidad; C cambia solo formato/andamiaje conservando objetivos, criterios y rúbrica de A.
- **R14.** El reporte por versión es obligatorio para cada versión efectivamente generada.
- **R15.** El resultado se normaliza y valida antes de presentarse o guardarse.

## 8. Estados y ciclo de vida

Ciclo de una **corrida de generación**:

```
Contexto listo → Plan de diseño calculado → Solicitud a IA
      → [éxito] Validación → Normalización → Resultado ensamblado
      → [fallo transitorio] Reintento (con escalado de modelo)
      → [fallo persistente] Degradación → (fallback / plantilla de emergencia) o error visible
```

Estados de una **versión** dentro del resultado: solicitada → generada → (validada / descartada por incompleta / arrastrada desde corrida previa).

## 9. Información que maneja el flujo

**Entrada (contexto para la IA):** materia(s); nombre y tamaño del grupo; contenidos a evaluar; competencias; criterios de logro; versiones solicitadas; reglas de diseño del instrumento; requerimientos del docente en lenguaje natural; fuentes serializadas (resúmenes de sesiones, digestos de materiales con fragmentos acotados); duración objetivo con banda aceptable y tabla heurística; estudiantes **anonimizados** con sus contemplaciones.

**Salida (especificación):** secciones e ítems tipados con consigna, puntaje y campos propios; rúbricas de ítem; contenido versionado (consigna adaptada B, consigna equivalente C, opciones/subítems adaptados); variantes de versión con su etiqueta y razón; opciones de respuesta equivalentes; reporte de diseño (narrativa global y por versión, cobertura de contenidos, contemplaciones aplicadas).

**Derivados deterministas:** asignación estudiante→versión; recordatorios por estudiante (administración, corrección) y "allowances" de diseño; distribución VARK; porcentaje de estudiantes con alta necesidad de estructuración; disparadores y conteo de opciones de respuesta.

## 10. Interacción con IA

### 10.1 Objetivo
Producir un instrumento de evaluación válido, alineado al currículo y accesible, junto con sus versiones adaptadas y una explicación pedagógica para el docente, sin reducir la demanda cognitiva.

### 10.2 El "plan de diseño" (cálculo determinista previo)
Antes de invocar al modelo, el sistema calcula, a partir del grupo y sus contemplaciones:

- **Buckets de contemplación:** clasifica las contemplaciones seleccionadas de cada estudiante en: diseño del instrumento, recordatorio de administración, recordatorio de corrección, excepción de adaptación de contenido.
- **Versiones a solicitar:**
  - A: siempre.
  - B: solo si hay estudiantes con **adaptación de contenido declarada**.
  - C: reservada a casos excepcionales (no automática).
- **Asignación estudiante→versión:** por defecto todos a A; a B solo los de adaptación de contenido declarada.
- **Opciones de respuesta equivalentes:** se incluyen si se cumple alguno de estos disparadores: necesidades de estructuración/plantillas, predominio de perfiles visual+kinestésico, mayoría de perfiles no lecto-escritores, o **pedido explícito del docente**. El número de opciones (2 o 3) sube a 3 si el diseño es muy complejo o si el docente pidió 3.
- **Reglas de diseño del instrumento:** se traducen las contemplaciones de "diseño" a instrucciones concretas de construcción.
- **Recordatorios por estudiante:** se construyen desde las plantillas de administración y corrección; si una contemplación con bucket asignado **no tiene plantilla**, se registra el faltante de forma explícita (falla visible).
- **Métricas del grupo:** distribución VARK, porcentaje con alta necesidad de estructuración, conteo de complejidad de diseño.

> ⚠️ Supuesto: los umbrales concretos del proyecto viejo (p. ej. "≥2 contemplaciones de estructuración en ≥30% del grupo", "complejidad ≥6") son parametrizables. En la reimplementación conviene exponerlos como configuración pedagógica, no como constantes ocultas.

### 10.3 Contexto que recibe la IA
Materia(s); grupo y cantidad de estudiantes; contenidos, competencias y criterios seleccionados; versiones solicitadas; reglas de diseño; requerimientos del docente; fuentes (resúmenes de sesiones y fragmentos de materiales, con límites de tamaño); duración objetivo con banda y tabla heurística de minutos por tipo de ítem. Los estudiantes se pasan **anonimizados**.

### 10.4 Resultado esperado
Una especificación estructurada (no texto libre) con secciones e ítems tipados, rúbricas de ítem, contenido versionado para B/C, opciones de respuesta equivalentes cuando corresponda, y un reporte de diseño con narrativa global y por versión. El sistema lo **valida** (estructura mínima: éxito declarado, secciones no vacías, ítems presentes, variantes de versión, versiones solicitadas, lista de advertencias) y lo **normaliza** a un modelo estable para render y asignación.

### 10.5 Reglas que la IA debe respetar
1. Devolver **solo** la especificación estructurada, sin texto adicional.
2. Usar **solo** las competencias y criterios provistos; no inventar.
3. **No inferir** necesidades/diagnósticos desde texto narrativo; usar solo datos estructurados.
4. Evidencia siempre **escrita o seleccionable**.
5. Generar **siempre** la Versión A.
6. Si se pide B: generar la **consigna adaptada de cada ítem**; si falta en alguno, B no se ofrece. B puede ajustar contenido/objetivos declarados, pero conserva evidencia escrita y accesibilidad.
7. Si se pide C: adaptación **equivalente** (mismos objetivos, criterios, rúbrica y demanda que A; cambia solo formato/andamiaje).
8. Incluir **opciones de respuesta equivalentes** en ítems abiertos cuando el plan lo indica (mínimo de opciones definido por el plan).
9. Rúbrica de ítem con **≥4 niveles** y descriptores específicos del contenido y de la acción; nada genérico ni reutilizable.
10. Respetar la **duración objetivo** (banda ~95–105%), planificando cantidad y tipo de ítems según la tabla heurística.
11. **Agrupar por pasaje**: cuando hay un texto base, generar un conjunto de ítems sobre él (varios de opción múltiple y/o subpreguntas de análisis), no un único ítem; y no referir a "el fragmento anterior" si no hay fuente adjunta al ítem/sección.
12. Cubrir los **contenidos y competencias** seleccionados y declararlo en el reporte; si faltan fuentes, decirlo en vez de inventar.
13. Entregar el **reporte por versión** para toda versión generada.

### 10.6 Política de versiones solicitadas (en generación y modificación)
En cada corrida —especialmente al **modificar** una evaluación existente— el sistema decide qué versiones pedir combinando: pedido explícito del docente, versiones ya presentes en el estado actual, disparadores del plan de diseño, asignaciones existentes y presencia de estudiantes con adaptación de contenido declarada. Reglas clave:
- A siempre verdadera.
- B verdadera si cualquiera de esas señales indica que B es necesaria o ya existía.
- C verdadera solo si estaba pedida/presente o el plan la dispara.
- **Carry-forward de B:** si B existía y debía conservarse pero la nueva respuesta llegó sin ella (respuesta parcial), se fusiona la B previa (su variante y las consignas adaptadas por ítem) en el nuevo resultado, para no perder trabajo válido.

### 10.7 Normalización y coherencia del resultado
- Numeración estable de secciones e ítems; etiquetas de tipo en español; opciones con letra; rúbrica normalizada; marca de ítem "adaptado" cuando usa contenido B/C.
- Validación estructural previa a mostrar/guardar; si falla, se considera fallo de generación.
- **Redistribución de puntos** determinista (mínimo 1 por ítem, suma exacta) al editar totales o secciones (ver flujo 06).

### 10.8 Comportamiento ante fallos
- **Reintentos:** varios intentos con **escalado/alternancia de modelo** y tiempo acotado por intento y por corrida; los errores transitorios se reintentan, los no transitorios no.
- **Degradación:** modos sucesivos desde generación completa hacia respuestas más simples y, en último caso, una **plantilla de emergencia**.
- **Reparaciones opcionales:** mecanismos para completar consignas adaptadas faltantes (B), ajustar duración o completar narrativas; cuando están desactivados, se usan **fallbacks deterministas** (narrativas por defecto por versión).
- **Qué ve el docente:** si nada válido se obtiene, un error claro; si hubo degradación o ajustes (p. ej. reasignación de versiones, refinamiento de duración), advertencias informativas.

> ⚠️ **Dualidad v1/v2 en el proyecto viejo:** coexisten **dos implementaciones** del motor de generación/modificación —una previa basada en documento renderizado y otra estructurada basada en especificación JSON—, con un conmutador "beta" y **fallback automático** de la nueva a la anterior si la nueva falla. En la reimplementación **no se debe reproducir esta dualidad**: adoptar una **única** generación estructurada (especificación tipada + normalización + validación), que es la intención unificada aquí documentada. La lógica de fallback/beta se descarta; se conserva solo la robustez (reintentos y degradación) sobre un único motor.

## 11. Criterios de aceptación

- [ ] El sistema debe calcular el plan de diseño de forma determinista antes de invocar a la IA.
- [ ] El sistema debe solicitar siempre la Versión A y solicitar B/C solo cuando el plan lo justifique.
- [ ] La IA debe usar solo las competencias/criterios provistos y no inventar nuevos.
- [ ] La IA debe cubrir los contenidos y competencias seleccionados y declararlo en el reporte.
- [ ] La IA debe respetar la duración objetivo dentro de la banda aceptable.
- [ ] Las versiones adaptadas deben cumplir las contemplaciones de cada estudiante sin bajar la exigencia cognitiva.
- [ ] Los ítems abiertos deben traer rúbrica con ≥4 niveles y descriptores específicos, no genéricos.
- [ ] El sistema debe incluir opciones de respuesta equivalentes cuando el plan las dispara, con el mínimo de opciones definido.
- [ ] Al modificar, el sistema debe decidir correctamente qué versiones conservar/pedir y arrastrar la Versión B si una respuesta parcial la perdió.
- [ ] El resultado debe validarse y normalizarse antes de mostrarse o guardarse.
- [ ] Ante fallos, el sistema debe reintentar, degradar y comunicar claramente el estado al docente.

## 12. Enlaces con otros flujos

- **Flujo 06 (Evaluaciones):** consume este motor para crear/editar el instrumento; provee currículo, fuentes y tiempo.
- **Flujo 03 (Contemplaciones):** define las contemplaciones que alimentan buckets, versiones, reglas de diseño y recordatorios.
- **Flujos 04/05 (Planificación y sesiones):** aportan los resúmenes de sesión usados como contexto.
