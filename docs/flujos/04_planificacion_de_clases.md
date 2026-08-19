# Flujo 04 — Planificación de clases

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Fundamental · **Depende de:** flujos 01 (autenticación/navegación), 02 (grupos y perfiles de estudiantes), 03 (contemplaciones), 08 (competencias ANEP)

## 1. Propósito

Permitir que un docente arme, de punta a punta, la planificación de un **período de trabajo de un curso** (una materia con un grupo): qué contenidos y competencias va a trabajar, en cuántas clases, con qué horario, y con el contenido concreto de cada clase generado con ayuda de IA (ver flujo 05).

El problema real que resuelve: planificar clase por clase para todo un trimestre/unidad es lento, repetitivo y difícil de mantener alineado con el programa ANEP y con la diversidad del grupo. AulaPlus convierte esa tarea en un **asistente por pasos** que produce un **calendario de sesiones** ya poblado, que el docente luego ajusta, reordena, dicta y da por cumplido, manteniendo la trazabilidad de qué competencias se trabajaron.

## 2. Actores y roles

| Actor | Rol en este flujo |
|---|---|
| **Docente** | Configura el período (grupo, materia, fechas u horario), define las **unidades didácticas**, ajusta la distribución de trabajo, opcionalmente indica un **foco temático** por clase, revisa y edita cada sesión, la agenda en el calendario, la marca como dictada/omitida/pausada, y decide cuándo **guardar** la planificación. |
| **Sistema** | Genera el esquema de fechas o el backlog de sesiones a partir de la configuración, mantiene el estado de cada sesión, persiste borradores automáticamente y guarda de forma explícita cuando el docente lo pide. |
| **IA** | Genera el contenido pedagógico de cada sesión (desarrollo estructurado, recursos, alineación con competencias). Se documenta en detalle en el **flujo 05**. |

## 3. Glosario del dominio

- **Planificación (de período):** el contenedor principal. Representa la planificación de una materia para un grupo durante un período (con o sin fechas fijas). Agrupa las unidades didácticas, la configuración de horario y todas las sesiones.
- **Unidad didáctica:** un bloque de contenido del programa que el docente decide trabajar, con las competencias que le asocia y una **cantidad estimada de clases** que le va a dedicar. Es la pieza pedagógica desde la cual se derivan las sesiones.
- **Sesión (de clase):** una clase individual. Tiene fecha (o no, si está en backlog), duración, contenidos/competencias/criterios, el plan de desarrollo generado, recursos, evaluación y un estado dentro de su ciclo de vida.
- **Backlog de sesiones:** conjunto de sesiones creadas pero todavía **no agendadas** en el calendario. Actúan como una "bandeja" desde la cual el docente arrastra clases hacia fechas concretas.
- **Calendario de sesiones:** la vista temporal donde las sesiones agendadas aparecen ubicadas en sus fechas.
- **Session brief (foco temático de la sesión):** un texto corto, opcional, que el docente le indica a una clase puntual para orientar su contenido (ej.: "El surgimiento del Batllismo"). Tiene prioridad sobre el contenido genérico de la unidad (ver flujo 05).
- **Distribución de modalidades:** reparto porcentual del trabajo entre modalidades de aula (individual, en parejas, en grupos, con toda la clase). Debe sumar 100%.
- **Guardado explícito:** acción deliberada del docente de "guardar" la planificación con un nombre, que la hace aparecer en **Mis Planificaciones**. Es distinto del guardado automático de borrador.
- **Borrado suave (recuperable):** eliminar una planificación de la lista sin destruir sus datos, de modo que pueda recuperarse.

## 4. Precondiciones y dependencias

- Debe haber un **docente autenticado** (flujo 01), que será el propietario de la planificación (aislamiento por docente).
- Debe existir el **grupo** sobre el que se planifica (flujo 02), idealmente con su perfil y los perfiles/contemplaciones de sus estudiantes (flujo 03), porque enriquecen la generación con IA.
- Debe existir el **catálogo de contenidos y competencias ANEP** de la materia (flujo 08) para poder armar las unidades didácticas.
- Opcionalmente, pueden existir **materiales del docente** adjuntables a la planificación, que sirven como fuente de contenido (ver flujo 05).

## 5. Flujo principal (happy path)

El corazón del flujo es un **asistente por pasos** (wizard). Al terminar, se navega automáticamente a un **espacio de trabajo** (workspace) con el calendario y el editor de sesiones.

### 5.1 Paso 1 — Contexto del período

1. El docente elige el **grupo** y la **materia**.
2. El docente elige el **tipo de planificación**:
   - **Con período específico:** define **fecha de inicio** y **fecha de fin**. El sistema derivará las fechas de clase desde el horario (paso 2).
   - **Sin período (flexible):** define directamente una **cantidad de sesiones** y una **duración por sesión** (en minutos). Estas sesiones nacen en el **backlog**, sin fecha, para agendarse después.

### 5.2 Paso 2 — Horario (solo en modo "con período")

3. El docente indica las **horas semanales** de la materia y una **configuración de horario**: para cada día de clase (lunes a viernes), la hora de inicio, la hora de fin y la duración en minutos.
4. En modo "sin período" este paso se **omite** (la duración ya se definió en el paso 1).

### 5.3 Paso 3 — Enfoque pedagógico (unidades didácticas)

5. El docente arma las **unidades didácticas**: para cada una selecciona un contenido del programa, le asocia una o más **competencias**, y estima **cuántas clases** le dedicará.
6. Opcionalmente el docente agrega:
   - **Requerimientos/instrucciones** generales para la IA (aplican a toda la planificación o a algunas clases).
   - La **distribución de modalidades** (individual/parejas/grupos/toda la clase), que debe sumar 100%.
   - **Estrategias de diferenciación** generales.
   - Un **foco temático (session brief)** por clase, cuando quiere que una clase específica trate un tema puntual.
   - **Materiales propios** adjuntos a la planificación (PDFs, etc.).

### 5.4 Paso 4 — Resumen y creación

7. El docente revisa un **resumen** de toda la planificación.
8. Al confirmar, el sistema:
   a. **Crea la planificación** como **borrador** (aún no guardada explícitamente).
   b. **Crea las sesiones**:
      - Modo "con período": genera una sesión por cada fecha de clase que caiga entre inicio y fin según el horario; nacen **agendadas** (estado *planificada*).
      - Modo "sin período": genera la cantidad indicada de sesiones **sin fecha**, en estado *backlog*.
   c. **Asigna cada sesión a una unidad didáctica** de forma determinística (ver R4) y persiste los focos temáticos indicados.
   d. **Dispara la generación de contenido con IA** para todas las sesiones (flujo 05), mostrando una pantalla de progreso.
9. Al terminar la generación, el docente llega al **espacio de trabajo**.

### 5.5 Espacio de trabajo (workspace)

10. El docente ve tres zonas: el **backlog** (sesiones sin agendar), el **calendario** (sesiones agendadas) y el **editor** de la sesión seleccionada.
11. Desde el backlog puede **arrastrar** una sesión a una fecha del calendario para **agendarla**.
12. Sobre una sesión agendada puede: **moverla** de fecha, **marcarla como dictada**, **pausarla** (vuelve a quedar sin fecha), **omitirla** (con motivo, ej. feriado), o **bloquearla** para que no se reprograme.
13. En el **editor** revisa y ajusta el contenido de la sesión (plan de desarrollo, recursos, evaluación) y puede pedir a la IA que **regenere** o modifique el contenido (flujo 05).
14. Cuando está conforme, el docente **guarda explícitamente** la planificación dándole un **nombre**; recién ahí aparece en **Mis Planificaciones**.

### 5.6 Mis Planificaciones

15. El docente ve la lista de sus planificaciones **guardadas** (no borradas). Puede buscarlas y filtrarlas (por materia, grupo, carpeta, rango de fechas), abrirlas, organizarlas en **carpetas**, **compartirlas** (con dirección o equipo psicopedagógico) y **eliminarlas** (borrado suave).
16. La lista también ofrece un **balance de competencias**: para la materia seleccionada, cuánto se trabajó cada competencia y cuáles quedan **pendientes** (ver flujo 08).

## 6. Flujos alternativos y casos borde

- **Requisito mínimo para poder generar (regla A/B/C):** en el paso de enfoque, el sistema exige que exista **al menos una** de estas tres fuentes de contenido: (A) contenido ANEP en las unidades, (B) materiales adjuntos a la planificación, o (C) texto de foco suficientemente informativo (un session brief de ≥15 caracteres o requerimientos de ≥20 caracteres). Sin ninguna, no se permite avanzar.
- **Más sesiones que clases estimadas:** si el calendario/backlog tiene más sesiones que la suma de clases estimadas de las unidades, las sesiones sobrantes se asignan a la **última unidad** como **clases adicionales** (marcadas como "extra"), pensadas para repaso, integración o evaluación (ver flujo 05, R de secuencia).
- **Menos sesiones que clases estimadas:** se usan las primeras N asignaciones; las clases estimadas sobrantes no llegan a materializarse.
- **Sin unidades didácticas:** las sesiones se crean con un contenido genérico ("contenido general") y el foco recae en los briefs/materiales.
- **Generación con IA falla en una sesión:** el sistema reintenta; si aun así falla, continúa con las demás sesiones y deja la fallida sin contenido, informando el error y ofreciendo **reintentar** (ver flujo 05).
- **Sesiones sin plan al reabrir el workspace:** el sistema detecta sesiones sin contenido y **relanza automáticamente** su generación.
- **Salir sin guardar:** si la planificación no fue guardada explícitamente, cualquier intento de salir (navegar, refrescar, cerrar) muestra una **advertencia de "salir sin guardar"**.
- **Planificación flexible sin fechas:** una planificación "sin período" puede vivir indefinidamente como backlog; sus sesiones solo tienen fecha cuando el docente las agenda.
- **Estados vacíos:** "Mis Planificaciones" muestra un estado vacío invitando a crear la primera; el balance de competencias pide seleccionar una materia antes de calcularse.

## 7. Reglas de negocio

- **R1.** Una planificación pertenece a un único docente y a una combinación **materia + grupo**. Puede ser **con período** (fechas fijas) o **sin período** (flexible).
- **R2.** En modo "con período", la fecha de inicio no puede ser anterior a hoy y la fecha de fin debe ser posterior a la de inicio. En modo "sin período", la cantidad de sesiones y la duración por sesión deben ser mayores a 0.
- **R3.** El **calendario de sesiones** en modo "con período" se deriva recorriendo los días entre inicio y fin y quedándose con los que tienen clase según la configuración de horario; la duración de cada sesión sale de la configuración de su día (por defecto 60 min si falta).
- **R4.** Cada sesión se asigna a una unidad didáctica de forma **determinística y ordenada**: las unidades se "expanden" según su cantidad de clases estimadas (una unidad con 3 clases ocupa 3 sesiones consecutivas), y las sesiones se llenan en ese orden. La asignación registra, para cada sesión, **qué número de clase es dentro de su unidad** y el **total de clases de esa unidad** (insumo clave para la IA; ver flujo 05).
- **R5.** La **distribución de modalidades** debe sumar exactamente 100%.
- **R6.** Para habilitar la generación con IA debe cumplirse la **regla A/B/C** (ver sección 6).
- **R7.** Las competencias son **opcionales**: el sistema puede sugerirlas a partir del contenido ANEP, pero no las exige para generar.
- **R8.** Una planificación recién creada es un **borrador** (no guardada). Solo aparece en "Mis Planificaciones" tras un **guardado explícito** con nombre.
- **R9.** El **borrado** de una planificación es **suave/recuperable**: se marca como eliminada y deja de listarse, pero sus datos se conservan.
- **R10.** Solo se listan en "Mis Planificaciones" las planificaciones **guardadas** y **no eliminadas**, ordenadas por fecha de guardado (más recientes primero).
- **R11.** Los cambios en una sesión desde el editor se **persisten automáticamente** (borrador vivo); el guardado explícito refiere a la planificación como conjunto, no a cada edición.
- **R12.** El **balance de competencias** cuenta las competencias asignadas a las sesiones **no omitidas** con al menos una competencia; las omitidas no cuentan (ver flujo 08).

## 8. Estados y ciclo de vida

### 8.1 Ciclo de vida de una **sesión**

Estados posibles: **backlog**, **planificada**, **dictada**, **omitida**, **pausada**.

```
                 (agendar: arrastrar a fecha)
   backlog ───────────────────────────────► planificada
      ▲                                          │  │  │
      │                                          │  │  └──(marcar dictada)──► dictada
      │  (pausar: quitar fecha)                  │  │
      └──────────────────────────────────────── │  └─────(omitir: feriado/excepción, con motivo)──► omitida
             pausada ◄───────────────────────────┘
```

- **backlog:** sesión creada sin fecha (modo flexible, o pausada). Vive en la bandeja para agendarse.
- **planificada:** sesión con fecha asignada en el calendario. Estado por defecto de las sesiones creadas en modo "con período".
- **dictada:** el docente marcó la clase como efectivamente dada.
- **omitida:** la clase no se dará/no se dio (feriado, paro, imprevisto); se registra un **motivo** y si fue **feriado**. Las sesiones omitidas se excluyen de métricas.
- **pausada:** la sesión se saca del calendario (pierde su fecha) para reprogramarse más tarde; funcionalmente vuelve a comportarse como pendiente de agendar.

Atributos transversales al estado:
- **Bloqueo/reserva:** una sesión puede **bloquearse** para que no se reprograme automáticamente (marca de "no tocar").
- **Orden:** todas las sesiones tienen un orden secuencial que determina su posición en la secuencia didáctica y en el backlog.

> ⚠️ Supuesto: no se observó una transición explícita desde *dictada* u *omitida* de vuelta a otro estado (no hay "des-dictar"); se asume que son estados finales salvo edición manual. Documentar como decisión a confirmar.

### 8.2 Ciclo de vida de una **planificación**

```
Borrador (no guardada) ──(guardar explícito con nombre)──► Guardada
Guardada ──(editar/generar)──► Guardada (se actualiza)
Guardada ──(borrado suave)──► Eliminada (recuperable, no listada)
```

- **Borrador:** existe y es editable, pero no figura en "Mis Planificaciones".
- **Guardada:** tiene nombre y fecha de guardado; aparece en la lista.
- **Eliminada:** marcada como borrada; oculta de la lista pero recuperable.

## 9. Información que maneja el flujo

**De la planificación (período):**
- Grupo y materia; nivel del curso.
- Tipo (con/sin período) y, según el tipo: fechas de inicio/fin **o** cantidad de sesiones + duración por sesión.
- Horas semanales y configuración de horario (día, hora inicio, hora fin, duración).
- Unidades didácticas (ver abajo), y de ellas se derivan: competencias seleccionadas, contenidos del programa y el mapeo competencia↔contenido.
- Requerimientos/instrucciones del docente, distribución de modalidades, estrategias de diferenciación.
- Nombre para mostrar (opcional; por defecto "materia – grupo"), carpeta de organización, indicadores de compartido (dirección / equipo psicopedagógico).
- Marcas de estado: si está guardada, cuándo se guardó, si está eliminada.
- **Evidencia de diseño de la IA:** una explicación de las decisiones que tomó la IA al generar (qué insumos usó, qué estructura y supuestos aplicó). Ver flujo 05.

**De cada unidad didáctica:**
- Contenido del programa (identificador y texto), competencias asociadas, cantidad de clases estimadas, orden.
- Opcionalmente, un **plan de materiales por unidad** (qué material se usa, en cuántas clases y con qué guía por clase).

**De cada sesión:**
- Fecha (o ninguna), duración en minutos, orden y estado.
- Contenidos, competencias y criterios de logro ANEP asignados.
- **Plan de desarrollo** (el contenido pedagógico estructurado, generado por IA — flujo 05).
- Recursos, evaluación asociada, diferenciación, observaciones, título.
- **Foco temático (session brief)** opcional.
- Motivo de excepción / si es feriado (para omitidas), motivo de cambio, y marca de bloqueo.

**Datos derivados/calculados:**
- El esquema de fechas de clase (a partir de horario + rango de fechas).
- La asignación sesión→unidad y la posición de cada clase dentro de su unidad.
- El balance de competencias trabajadas vs. pendientes por materia/grupo/período (flujo 08).

## 10. Interacción con IA

Este flujo **usa IA de forma central** para producir el contenido de cada sesión, pero el detalle del contrato conceptual (insumos, resultado, reglas, fallos, ajuste de duración) se documenta por completo en el **flujo 05 — Generación de planes de clase con IA**.

Resumen para este flujo:
- **Cuándo se invoca:** automáticamente al crear la planificación (una vez por sesión), al reabrir el workspace si hay sesiones sin contenido, y a pedido del docente cuando **regenera** o **modifica** una sesión desde el editor.
- **Qué recibe (a alto nivel):** materia, nivel, duración de la clase, contenidos/competencias/criterios, contexto del grupo y sus estudiantes (flujo 03), instrucciones del docente, contexto de la unidad (qué clase de la unidad es), foco temático (session brief) y, si se regenera, el plan actual.
- **Qué produce:** el desarrollo estructurado de la clase, su título, recursos, la justificación de competencias y una evidencia de las decisiones de diseño.

## 11. Criterios de aceptación

- [ ] El sistema debe ofrecer un asistente por pasos para configurar contexto (grupo, materia, tipo, fechas/cantidad), horario, enfoque (unidades, modalidades, diferenciación, focos) y resumen.
- [ ] El sistema debe permitir el modo "con período" (fechas + horario) y el modo "sin período" (cantidad + duración), omitiendo el horario en este último.
- [ ] El sistema debe validar fechas (inicio ≥ hoy, fin > inicio) y cantidades (sesiones y duración > 0) según el modo.
- [ ] El sistema debe permitir armar unidades didácticas con contenido, competencias y cantidad de clases estimadas.
- [ ] El sistema debe exigir que la distribución de modalidades sume 100%.
- [ ] El sistema debe habilitar la generación solo si se cumple la regla A/B/C (contenido ANEP, materiales o foco suficiente).
- [ ] El sistema debe generar el calendario de sesiones a partir del horario y el rango de fechas, o el backlog a partir de la cantidad indicada.
- [ ] El sistema debe asignar cada sesión a una unidad de forma determinística, registrando su posición dentro de la unidad.
- [ ] El sistema debe soportar los estados de sesión backlog, planificada, dictada, omitida y pausada, con las transiciones descritas.
- [ ] El sistema debe permitir agendar (arrastrar al calendario), mover, marcar dictada, pausar, omitir (con motivo) y bloquear sesiones.
- [ ] El sistema debe permitir asignar un foco temático (session brief) a una sesión.
- [ ] El sistema debe persistir automáticamente las ediciones de sesión y ofrecer un guardado explícito de la planificación con nombre.
- [ ] El sistema debe advertir antes de salir de una planificación no guardada.
- [ ] El sistema debe listar en "Mis Planificaciones" solo las planificaciones guardadas y no eliminadas, con búsqueda, filtros, carpetas, compartir y borrado suave recuperable.
- [ ] El sistema debe mostrar el balance de competencias trabajadas y pendientes por materia.

## 12. Enlaces con otros flujos

- **Flujo 01 (autenticación/navegación):** provee al docente autenticado y el acceso a la sección de planificación; toda planificación pertenece al docente propietario.
- **Flujo 02 (grupos y estudiantes):** la planificación se hace sobre un grupo; su perfil alimenta la generación con IA.
- **Flujo 03 (contemplaciones):** las contemplaciones/ajustes de los estudiantes se inyectan en la generación para producir la diferenciación (flujo 05).
- **Flujo 05 (generación con IA):** produce el contenido de cada sesión; es la contraparte de este flujo.
- **Flujo 08 (competencias ANEP):** provee el catálogo de contenidos y competencias y da sentido al balance de competencias trabajadas/pendientes.
