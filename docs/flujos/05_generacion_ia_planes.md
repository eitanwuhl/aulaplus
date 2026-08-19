# Flujo 05 — Generación de planes de clase con IA

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Alta · **Depende de:** flujos 04 (planificación de clases), 02 (grupos), 03 (contemplaciones), 08 (competencias ANEP)

## 1. Propósito

Automatizar la parte más costosa de planificar: **escribir el desarrollo pedagógico concreto de cada clase**. Dado el contexto de una sesión (materia, contenido, duración, grupo, etc.), la IA produce una clase estructurada —inicio, desarrollo, cierre— con actividades detalladas, recursos, alineación con las competencias/contenidos/criterios ANEP y adaptaciones para la diversidad del grupo.

El fin pedagógico no es "rellenar" sino entregar al docente un **borrador de calidad, específico y accionable**, que respete el tiempo real de la clase, la secuencia didáctica de la unidad y las necesidades de sus estudiantes, para que el docente lo revise y ajuste en vez de escribirlo de cero.

## 2. Actores y roles

| Actor | Rol en este flujo |
|---|---|
| **Docente** | Provee el contexto (unidades, foco temático, instrucciones, materiales) y dispara la generación (al crear la planificación) o la **regeneración/modificación** de una sesión puntual. Revisa y edita el resultado. |
| **Sistema** | Reúne y anonimiza el contexto del grupo, arma el pedido a la IA, valida y sanea el resultado, inyecta las adaptaciones deterministas por contemplaciones y persiste el plan. Gestiona reintentos y degradación. |
| **IA (modelo generativo)** | Produce el plan estructurado de la clase respetando las reglas pedagógicas y de formato que se le imponen. |

## 3. Glosario del dominio

- **Plan de desarrollo:** el contenido pedagógico de una clase, estructurado en **Inicio**, **Desarrollo** y **Cierre**, más una sección de **Diferenciación/Adaptaciones**.
- **Generar vs. regenerar:** *generar* crea el plan de una sesión que aún no lo tiene (típicamente en lote, al crear la planificación). *Regenerar/modificar* rehace el plan de una sesión existente a partir de una instrucción del docente y del plan actual.
- **Contexto de secuencia (unidad):** la información de que "esta clase es la Nª de M" dentro de su unidad, que orienta a la IA a introducir, profundizar o cerrar según corresponda.
- **Session brief (foco temático):** tema puntual que el docente fija para una clase; tiene **prioridad absoluta** sobre el contenido genérico de la unidad.
- **Contemplaciones:** ajustes/apoyos específicos de estudiantes (flujo 03) que la IA debe atender en la diferenciación.
- **Modo "solo materiales":** generación en la que no hay contenido ANEP y la **única** fuente de contenido son los materiales del docente (su texto extraído).
- **Evidencia de diseño (reporte de IA):** resumen de qué insumos usó la IA y qué decisiones/supuestos tomó, que se guarda junto al plan para trazabilidad.
- **Justificación de competencias:** explicación de cómo las actividades propuestas desarrollan las competencias seleccionadas.

## 4. Precondiciones y dependencias

- Debe existir la **sesión** dentro de una planificación (flujo 04), con su duración, orden y asignación a una unidad.
- Debe cumplirse la **regla A/B/C** (flujo 04): hay contenido ANEP, o materiales adjuntos con texto disponible, o un foco/instrucciones suficientemente informativos.
- Para enriquecer el resultado, deben poder consultarse el **perfil del grupo** y los **perfiles/contemplaciones** de sus estudiantes (flujos 02 y 03).
- En "modo solo materiales", los materiales (p. ej. PDFs) deben tener su **texto ya extraído**; si falta, el sistema intenta extraerlo y **bloquea** la generación hasta lograrlo.

## 5. Flujo principal (happy path)

### 5.1 Generación en lote (al crear la planificación)

1. Tras crear la planificación, el sistema recorre las sesiones **en orden** y, para cada una, arma el contexto y pide el plan a la IA.
2. Entre sesiones introduce **pausas deliberadas** para no saturar el servicio de IA (evitar límites de tasa).
3. Por cada sesión: valida el resultado, **sanea** el formato, **inyecta las adaptaciones deterministas** por contemplaciones y **persiste** el plan, el título, los recursos, la justificación de competencias y la evidencia de diseño.
4. Muestra una pantalla de **progreso** ("generando contenido de las sesiones"). Al terminar, lleva al docente al espacio de trabajo.

### 5.2 Regeneración / modificación de una sesión

5. Desde el editor de una sesión, el docente escribe una **instrucción** (ej.: "hacela más dinámica", "agregá una actividad grupal sobre X").
6. El sistema pide a la IA rehacer el plan, pasándole el **plan actual** como base y la instrucción del docente.
7. Se aplica el mismo saneo, inyección de adaptaciones y persistencia. Los **recursos añadidos manualmente** por el docente se **preservan** (se combinan con los nuevos autodetectados).

## 6. Flujos alternativos y casos borde

- **Reintentos por sesión:** si una sesión falla, se reintenta hasta 3 veces con esperas crecientes (mayores si es un error de límite de tasa). Si agota los intentos, se **omite esa sesión** y se continúa con las demás.
- **Reintentos del lado del servicio de IA:** ante errores de límite de tasa, el pedido a la IA se reintenta con **retroceso exponencial** (varios intentos con esperas que se duplican).
- **Tiempo máximo por pedido:** cada generación tiene un **límite de tiempo**; si se excede, cuenta como fallo y entra en la lógica de reintento.
- **Resultado con formato inválido:** si la IA no devuelve la estructura esperada, el sistema usa un **plan de respaldo** genérico pero válido (con Inicio/Desarrollo/Cierre y una diferenciación básica) para no dejar la sesión vacía.
- **Modo solo materiales sin texto extraído:** se dispara la extracción y se espera; si no se logra, se **bloquea** la generación con un mensaje claro pidiendo reintentar o re-extraer.
- **Sin perfil de grupo ni contemplaciones:** la IA **no** debe inventar personalización; produce un plan estándar con, a lo sumo, una adaptación general de diseño universal.
- **Fallo total de la generación en lote:** la planificación igual queda creada; el docente puede **reintentar** la generación más tarde desde el espacio de trabajo.

## 7. Reglas de negocio

- **R1.** La generación se dispara por sesión: automáticamente en lote al crear la planificación, bajo demanda al regenerar/modificar, y automáticamente al reabrir una planificación con sesiones sin contenido.
- **R2.** El plan generado debe **respetar la duración** de la clase: los tiempos de Inicio/Desarrollo/Cierre deben repartir los minutos reales de esa sesión (ver sección 10, "ajuste de duración").
- **R3.** El plan debe **ceñirse a las competencias, contenidos y criterios** seleccionados para la sesión, y explicar en la **justificación de competencias** cómo las actividades las desarrollan.
- **R4.** El plan debe **respetar la posición de la clase en su unidad** (primera → introducción; intermedia → profundización sin repetir; última → integración/aplicación; extra → repaso/proyecto/evaluación) y evitar repetir explicaciones ya dadas; el título debe ser distinto al de otras clases de la misma unidad.
- **R5.** Si hay **foco temático (session brief)**, tiene **prioridad absoluta**: toda la clase se construye alrededor de ese tema, el título es exactamente el brief, y las actividades y preguntas deben referirse a conceptos específicos de ese foco (no genéricos).
- **R6.** El plan debe **respetar las contemplaciones activas** de los estudiantes: cuando existen, la sección de Diferenciación/Adaptaciones debe incluir adaptaciones **concretas y accionables** (momento, necesidad, propósito y cómo aplicarla).
- **R7.** El plan debe incluir **decisiones pedagógicas explícitas derivadas del perfil del grupo** dentro del desarrollo (no frases vagas del tipo "considerar estilos de aprendizaje").
- **R8.** La IA **no debe inventar diagnósticos ni etiquetas**: usa lenguaje de diseño universal (apoyos, andamiaje, múltiples medios de representación/expresión/participación). Si no hay perfil ni ajustes, no agrega personalización artificial.
- **R9.** Las **instrucciones del docente** deben respetarse explícitamente; si el docente ya definió una secuencia o tema, la IA no debe inventar otra.
- **R10.** En **modo solo materiales**, el contenido debe basarse **exclusivamente** en el texto de los materiales (conceptos, nombres, vocabulario específicos), sin plantillas genéricas.
- **R11.** El resultado debe **sanearse** antes de guardarse: separar los recursos del texto narrativo, normalizar la estructura, y **reemplazar** cualquier diferenciación genérica por las **adaptaciones deterministas** derivadas de las contemplaciones reales del grupo (con nombres de estudiantes cuando corresponde).
- **R12.** Ante fallo irrecuperable de una sesión, no se bloquea el resto: se continúa y se ofrece reintentar; nunca se deja una sesión con contenido a medias sin al menos un plan de respaldo válido.

## 8. Estados y ciclo de vida

La generación en sí no define estados persistentes de negocio; su resultado alimenta el **plan de desarrollo** de la sesión (cuyo ciclo de vida se documenta en el flujo 04). Estados operativos del proceso:

```
Pendiente ──(pedido a IA)──► Generando ──(ok + saneo)──► Plan listo (persistido)
Generando ──(error)──► Reintentando ──(agota intentos)──► Fallida (se omite / plan de respaldo)
```

- **Pendiente:** sesión sin plan.
- **Generando:** pedido en curso (con límite de tiempo).
- **Plan listo:** resultado validado, saneado y guardado.
- **Fallida:** tras agotar reintentos; se usa plan de respaldo o se deja para reintentar.

## 9. Información que maneja el flujo

**Entra (insumo) — ver detalle conceptual en sección 10.**
**Sale (resultado):**
- Plan de desarrollo estructurado (Inicio, Desarrollo, Cierre, Diferenciación/Adaptaciones).
- Título de la clase.
- Lista de recursos normalizada y sin duplicados.
- Justificación de cómo las actividades desarrollan las competencias.
- Evidencia de diseño de la IA (qué insumos usó, qué decisiones y supuestos tomó).

## 10. Interacción con IA

### 10.1 Objetivo

Producir, para una sesión, un **plan de clase completo y específico** alineado con el programa ANEP y con la realidad del grupo, listo para que el docente lo revise: desarrollo estructurado por momentos, recursos concretos, adaptaciones para la diversidad y justificación pedagógica de las competencias trabajadas.

### 10.2 Contexto que recibe (insumo, conceptual)

| Insumo | Descripción |
|---|---|
| **Materia y nivel** | Asignatura y nivel del curso. |
| **Duración de la clase** | Minutos reales de esa sesión (define el reparto de tiempos). |
| **Contenidos ANEP** | Contenido(s) macro de la unidad asignada a la sesión. |
| **Competencias** | Competencias seleccionadas para la sesión. |
| **Criterios de logro** | Criterios asociados. |
| **Contexto de la unidad (secuencia)** | Nombre del contenido de la unidad, y **qué número de clase es** dentro de un total (y si es una clase "extra" fuera de la secuencia original). |
| **Foco temático (session brief)** | Tema puntual opcional para esa clase (prioridad máxima). |
| **Perfil del grupo** | Tamaño, estilo de aprendizaje dominante y distribución de estilos. |
| **Estudiantes y contemplaciones** | Lista **anonimizada** de estudiantes con ajustes y sus contemplaciones específicas (flujo 03). |
| **Instrucciones del docente** | Requerimientos generales o puntuales para la clase/planificación. |
| **Materiales del docente** | Texto de los materiales adjuntos (a nivel planificación, sesión o unidad), como fuente de contenido. |
| **Plan actual** | Solo al **regenerar**: el plan vigente que se quiere modificar. |
| **Modo** | Si es una generación nueva o una regeneración/modificación. |

> ⚠️ Supuesto: en el proyecto viejo conviven al menos dos caminos técnicos de generación (uno más antiguo orientado a un solo momento de la clase y otro que produce el plan completo estructurado). Para la reimplementación se documenta **un único contrato conceptual**: el que produce el plan completo (Inicio/Desarrollo/Cierre + Diferenciación). Los estudiantes y su contexto se pasan siempre **anonimizados**.

### 10.3 Resultado esperado (forma y contenido)

La IA devuelve una estructura con:
- **Plan de desarrollo** con secciones claras: **Inicio** (apertura motivadora), **Desarrollo** (actividad principal y secundaria, con pasos y recursos) y **Cierre** (síntesis/reflexión), y **al final** una sección de **Diferenciación/Adaptaciones** (nunca mezclada dentro de los momentos anteriores).
- **Título** específico de la clase (o exactamente el session brief, si lo hay).
- **Recursos** concretos.
- **Justificación de competencias**.
- **Evidencia de diseño** (insumos usados, decisiones y supuestos).

El sistema luego **sanea** ese resultado: extrae y normaliza los recursos, unifica la estructura, y **sustituye** la diferenciación genérica por las adaptaciones deterministas derivadas de las contemplaciones reales (personalizadas con nombres cuando corresponde). El resultado saneado es lo que se guarda y se muestra.

### 10.4 Reglas que la IA debe respetar

1. **Duración:** repartir los minutos reales de la clase entre Inicio/Desarrollo/Cierre (ver 10.5).
2. **Competencias/contenidos/criterios:** ceñirse a lo seleccionado y justificarlo; no derivar hacia otros temas.
3. **Secuencia de la unidad:** actuar según la posición de la clase (introducir / profundizar / integrar / repasar) y no repetir lo ya visto; título único dentro de la unidad.
4. **Foco temático:** si existe, construir toda la clase alrededor de él, con preguntas y actividades específicas y el título igual al brief.
5. **Contemplaciones:** cuando hay estudiantes con ajustes, incluir adaptaciones concretas y accionables (momento, necesidad, propósito, cómo aplicarla).
6. **Perfil del grupo:** incorporar decisiones pedagógicas observables derivadas del perfil dentro del desarrollo.
7. **Sin invenciones:** no inventar diagnósticos ni etiquetas; lenguaje de diseño universal; si no hay datos, no personalizar artificialmente.
8. **Instrucciones del docente:** respetarlas explícitamente y no contradecir una secuencia ya definida.
9. **Solo materiales:** si no hay contenido ANEP, basarse exclusivamente en el texto de los materiales, con términos específicos de ellos.

### 10.5 Ajuste de duración

El contenido generado debe **encajar en los minutos reales de la clase**. La duración de la sesión sale de la configuración de horario (o de la duración por sesión en modo flexible) y se usa como objetivo: el Inicio y el Cierre toman porciones acotadas y el Desarrollo absorbe el tiempo restante (con un mínimo razonable). La IA recibe esa duración y estructura los momentos en consecuencia; el sistema normaliza los tiempos de cada momento al persistir.

> ⚠️ Supuesto: en el proyecto viejo existe además una heurística de estimación/ajuste de duración por ítem, pero está orientada a **evaluaciones** (objetivo ~90 minutos), no a los planes de clase. Para los planes de clase, el "ajuste" es el reparto de tiempos entre Inicio/Desarrollo/Cierre según la duración real de la sesión. Conviene unificar el criterio en la reimplementación.

### 10.6 Comportamiento ante fallos

- **Reintentos por sesión:** hasta 3 intentos con esperas crecientes; si el error es de límite de tasa, las esperas son mayores.
- **Reintentos del servicio de IA:** retroceso exponencial ante límites de tasa.
- **Límite de tiempo por pedido:** si se excede, cuenta como fallo.
- **Degradación:** si el formato es inválido, se usa un **plan de respaldo** válido; si una sesión falla del todo, se **omite** y se sigue con las demás.
- **Qué ve el usuario:** una pantalla de progreso durante la generación en lote y, ante fallo, un mensaje claro con opción de **reintentar** (sin perder la planificación ya creada).

## 11. Criterios de aceptación

- [ ] El sistema debe generar, por sesión, un plan estructurado en Inicio, Desarrollo, Cierre y una sección final de Diferenciación/Adaptaciones.
- [ ] El sistema debe pasar a la IA: materia, nivel, duración, contenidos/competencias/criterios, contexto de la unidad, perfil del grupo, estudiantes anonimizados con contemplaciones, instrucciones del docente, foco temático y (al regenerar) el plan actual.
- [ ] El plan generado debe repartir los tiempos según la duración real de la clase.
- [ ] El plan debe ceñirse a las competencias/contenidos/criterios seleccionados e incluir una justificación de competencias.
- [ ] El plan debe respetar la posición de la clase en su unidad y no repetir contenido; el título debe ser único dentro de la unidad.
- [ ] Si hay foco temático, la clase entera debe orientarse a ese tema y el título debe ser exactamente el foco.
- [ ] El sistema debe reemplazar la diferenciación genérica por adaptaciones concretas derivadas de las contemplaciones reales del grupo.
- [ ] La IA no debe inventar diagnósticos; sin perfil ni ajustes, no debe agregar personalización artificial.
- [ ] El sistema debe distinguir "generar" (nuevo) de "regenerar/modificar" (a partir del plan actual y una instrucción), preservando los recursos añadidos manualmente.
- [ ] El sistema debe reintentar ante fallos, aplicar un plan de respaldo válido si el formato es inválido, y continuar con las demás sesiones si una falla.
- [ ] En modo solo materiales, el sistema debe exigir texto extraído y basar el contenido exclusivamente en los materiales.
- [ ] El sistema debe guardar, junto al plan, la evidencia de diseño de la IA (insumos, decisiones, supuestos).

## 12. Enlaces con otros flujos

- **Flujo 04 (planificación de clases):** define la sesión, su duración, su asignación a una unidad y su ciclo de vida; este flujo produce su contenido.
- **Flujo 02 (grupos):** aporta el perfil del grupo usado como insumo.
- **Flujo 03 (contemplaciones):** aporta los ajustes de estudiantes que determinan la diferenciación; el sistema los inyecta de forma determinista.
- **Flujo 08 (competencias ANEP):** define las competencias/contenidos/criterios que el plan debe respetar y justificar.
