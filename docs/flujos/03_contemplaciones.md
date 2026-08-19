# Flujo 03 — Contemplaciones (adecuaciones para estudiantes)

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Fundamental · **Depende de:** perfil del estudiante (gestión de estudiantes/grupos), y es transversal a los flujos de planificación de clases (04/05) y de evaluaciones (06/07).

---

## 1. Propósito

Las **contemplaciones** son las adecuaciones o ajustes razonables que un docente debe aplicar a sus clases y evaluaciones para que estudiantes con necesidades específicas (dificultades de aprendizaje, condiciones de acceso, estilos particulares) puedan participar y ser evaluados de forma justa.

En el sistema educativo uruguayo (ANEP), adecuar la enseñanza y la evaluación a estas necesidades es una **obligación pedagógica e institucional**, no una cortesía opcional. El docente debe poder demostrar que las adecuaciones acordadas para cada estudiante efectivamente se aplicaron en el material y en la práctica de aula.

Este flujo resuelve tres problemas concretos del docente:

1. **Recordar** qué adecuaciones corresponden a cada estudiante, sin depender de su memoria clase a clase.
2. **Materializar** esas adecuaciones de forma consistente en cada clase y evaluación (recordatorios, cambios de formato, secciones de diferenciación), sin re-tipear todo cada vez.
3. **Garantizar** que la adecuación se aplique aunque el material se genere con ayuda de IA — es decir, que su cumplimiento no quede librado al azar de una generación automática.

Por su carácter transversal, las contemplaciones son un dato central: se definen una vez por estudiante y se consumen en toda la planificación y evaluación.

---

## 2. Actores y roles

| Actor | Rol en este flujo |
|-------|-------------------|
| **Docente** | Asigna/edita las contemplaciones de cada estudiante (elige del catálogo o crea propias), revisa las sugerencias por defecto, y es el destinatario final de los recordatorios que el sistema genera. |
| **Estudiante** | Sujeto de las contemplaciones. No opera el sistema; su perfil (con o sin necesidad de adecuación) determina las sugerencias por defecto. |
| **Sistema (capa determinista)** | Mantiene el catálogo canónico, resuelve sugerencias por defecto, persiste las selecciones por estudiante, y **materializa** las contemplaciones activas en recordatorios y reglas de diseño mediante reglas fijas (sin IA). |
| **IA (generación de clases/evaluaciones)** | Recibe las contemplaciones activas como contexto y debe respetarlas al redactar material. **No es** la responsable última de que se cumplan: la capa determinista garantiza el cumplimiento (ver sección 10). |

---

## 3. Glosario del dominio

- **Contemplación / adecuación:** ajuste concreto aplicado a una clase o evaluación para un estudiante (ej. "lectura oral de consignas", "tiempo adicional y pausas").
- **Catálogo canónico:** conjunto estable y numerado de contemplaciones posibles, con identificadores permanentes. Es la única fuente de verdad de qué adecuaciones existen.
- **Categoría de aplicabilidad:** indica si una contemplación aplica a **clase**, a **evaluaciones**, o a **ambas**.
- **Materialización:** la forma concreta en que una contemplación se traduce en la práctica (ver tipos en sección 9). No toda contemplación se materializa igual.
- **Recordatorio al docente:** nota dirigida al docente que aparece asociada al estudiante; **no** se imprime en el material del estudiante.
- **Regla de diseño / norma de formato:** especificación que sí cambia el diseño del material entregado al estudiante (tipografía, espaciado, estructura de consignas, etc.).
- **Sección de diferenciación / adaptaciones:** bloque del plan de clase que lista, con nombres de estudiantes, las adaptaciones a tener en cuenta durante esa clase.
- **Sugerencia por defecto (default):** preselección de contemplaciones que el sistema propone automáticamente según el perfil del estudiante, como punto de partida editable.
- **Contemplación personalizada (custom):** adecuación creada libremente por el docente, con un **título visible** y una **regla** interna que describe el efecto a aplicar.
- **Cumplimiento determinista (enforcement):** garantía, por reglas fijas, de que cada contemplación activa se materializa en el lugar correcto, independientemente de la IA.
- **Perfil con/sin necesidad de adecuación:** clasificación del estudiante que determina si recibe un set amplio de sugerencias (con adecuación de acceso y/o contenido) o un set acotado (preferencias de estilo de aprendizaje).

---

## 4. Precondiciones y dependencias

Antes de usar este flujo debe existir:

1. **Estudiantes** dados de alta, cada uno con un **identificador estable** propio (no el nombre). El identificador es la clave para asociar contemplaciones y sugerencias por defecto.
2. **Perfil del estudiante** con al menos la información de si requiere adecuación (de acceso y/o de contenido) o no. Esto habilita las sugerencias por defecto adecuadas.
3. El **catálogo canónico** de contemplaciones disponible en el sistema (dato semilla del backend).

Dependencias hacia otros flujos:

- **Planificación de clases (04/05):** consume las contemplaciones de categoría *clase* / *ambas* para construir la sección de diferenciación.
- **Evaluaciones (06/07):** consume las contemplaciones de categoría *evaluaciones* / *ambas* para generar recordatorios por estudiante y reglas de diseño del material de evaluación.

---

## 5. Flujo principal (happy path)

1. El docente abre el **perfil de un estudiante**.
2. El sistema muestra dos secciones **independientes**: **Contemplaciones para la clase** y **Contemplaciones para evaluaciones**.
3. En cada sección, el sistema muestra las contemplaciones del catálogo **aplicables a esa categoría** (las de categoría *ambas* aparecen en las dos secciones).
4. Si el estudiante nunca fue configurado en esa categoría, el sistema **preselecciona** las contemplaciones sugeridas por defecto según su perfil, marcándolas visualmente como **"Sugerido"**. Las sugerencias son un punto de partida, no una imposición.
5. El docente **ajusta** la selección: activa o desactiva contemplaciones del catálogo con un simple gesto (checkbox). Cada cambio se **persiste de inmediato**, sin botón explícito de "guardar".
6. Opcionalmente, el docente **crea una contemplación personalizada**: le pone un **título visible** y una **regla** (descripción del efecto a aplicar). Puede editarla o eliminarla luego.
7. En cuanto el docente toca manualmente la selección de una categoría, esa categoría queda marcada como **"editada por el usuario"**, y el sistema **deja de sobrescribirla** con futuras sugerencias por defecto (ver R7).
8. Cuando el docente planifica una clase o genera una evaluación, el sistema **lee las contemplaciones activas** de los estudiantes involucrados y las **materializa automáticamente** (recordatorios, reglas de diseño, sección de diferenciación) según las reglas de la sección 9.

---

## 6. Flujos alternativos y casos borde

- **Estudiante sin sugerencias por defecto definidas:** el sistema no preselecciona nada; el docente arma la lista desde cero. No es un error.
- **Estudiante sin ninguna contemplación:** válido; en la planificación y la evaluación simplemente no se genera material adecuado para ese estudiante.
- **Contemplación aplicable a "ambas" pero seleccionada en una sola sección:** válido y frecuente. La selección de *clase* y la de *evaluaciones* son independientes; una misma contemplación puede estar activa en una y no en la otra.
- **Docente que reactiva sugerencias:** una vez marcada como "editada por el usuario", la categoría no vuelve a autopoblarse. Volver a las sugerencias es una acción explícita (ver ⚠️ en R7).
- **Duplicados conceptuales en el catálogo:** dos entradas históricas que significan lo mismo deben tratarse como **una sola** (ver R3). Si llegan ambos identificadores, se consolidan.
- **Contemplación de "lectura oral de consignas" en una clase sin consignas escritas:** solo debe materializarse cuando la clase efectivamente tiene consignas escritas puntuales; si no se puede determinar, se usa una redacción condicional ("…si hay consignas escritas puntuales") en lugar de omitirla (ver R11).
- **Contemplación personalizada sin clasificación clara:** el sistema debe decidir determinísticamente si su regla se comporta como recordatorio o como regla de diseño (ver R12), sin depender de IA.
- **La generación con IA falla o ignora una contemplación:** el sistema igualmente inyecta la materialización determinista (recordatorios / reglas de diseño / diferenciación). El cumplimiento no depende del éxito de la IA (ver sección 10).

---

## 7. Reglas de negocio

- **R1 — Catálogo estable y numerado.** Existe un catálogo canónico de contemplaciones, cada una con un **identificador permanente** y una **etiqueta canónica**. Los identificadores **no cambian en el tiempo**, porque las selecciones guardadas por estudiante los referencian. (En el sistema viejo el catálogo tiene ~26 entradas históricas; el número exacto no es parte del contrato, sí lo es la estabilidad de los identificadores.)
- **R2 — Categoría de aplicabilidad.** Cada contemplación declara si aplica a *clase*, a *evaluaciones* o a *ambas*. La UI y la materialización filtran por esta categoría.
- **R3 — Deduplicación canónica.** Cuando dos entradas históricas representan la misma adecuación, se unifican en una sola opción para el docente, conservando la regla de negocio explícita de ambas. Cualquier referencia a los identificadores antiguos debe **normalizarse** al identificador unificado. *(Ejemplo real: "corrección centrada en contenido, no forma" unifica dos entradas históricas.)*
- **R4 — Selecciones por estudiante y por categoría.** Las contemplaciones activas se guardan **por estudiante** y **por categoría** (*clase* / *evaluaciones*), de forma independiente entre categorías.
- **R5 — Asociación por identificador estable del estudiante.** La asociación estudiante ↔ contemplaciones usa el identificador del estudiante, no su nombre. El nombre solo puede usarse como coincidencia de respaldo heredada. ⚠️ Supuesto: en la reimplementación esto debe ser una relación por clave foránea, sin fallback por nombre.
- **R6 — Sugerencias por defecto según perfil.** El sistema define un set de contemplaciones sugeridas por perfil:
  - Estudiantes **con** necesidad de adecuación (acceso y/o contenido) → set **amplio**, derivado de su situación.
  - Estudiantes **sin** necesidad de adecuación → set **acotado**, basado en preferencias de estilo de aprendizaje.
  Las sugerencias son un **punto de partida editable**, nunca una imposición.
- **R7 — No sobrescribir lo que el docente editó.** Las sugerencias por defecto solo se aplican mientras el docente **no** haya editado manualmente esa categoría para ese estudiante. Al primer cambio manual, la categoría queda "protegida" y no se vuelve a autopoblar. ⚠️ Deuda técnica: en el sistema viejo esto se controla con una marca por estudiante+categoría en almacenamiento local; en la reimplementación debe ser un estado persistido de forma confiable en el backend.
- **R8 — Versionado de las sugerencias por defecto.** El conjunto de sugerencias por defecto tiene una **versión**. Si la versión cambia, el sistema puede re-proponer sugerencias solo en categorías **no editadas** por el docente, preservando siempre las decisiones manuales (R7). Debe registrarse qué versión se sembró y una huella de lo sembrado, para detectar si el docente lo modificó.
- **R9 — Persistencia inmediata.** Cada cambio (activar/desactivar del catálogo, crear/editar/eliminar personalizada) se persiste al instante; no hay guardado diferido.
- **R10 — Separación estricta recordatorio vs. material del estudiante.** Los **recordatorios al docente NUNCA** se imprimen en el material que recibe el estudiante (cuadernillo de evaluación, ficha de clase). Solo las **reglas de diseño / normas de formato** modifican el material del estudiante.
- **R11 — Caso "lectura oral de consignas".** En clase, esta contemplación solo se materializa si hay consignas escritas puntuales. Si no puede determinarse automáticamente, se materializa con redacción **condicional** en lugar de omitirse.
- **R12 — Clasificación determinista de personalizadas.** Una contemplación personalizada se materializa según su **regla**: si la regla es de tipo recordatorio, va como recordatorio al docente; si es de tipo diseño/formato, modifica el material. Esta clasificación se resuelve por reglas fijas, no por IA. ⚠️ Supuesto: la reimplementación debería reemplazar la heurística por palabras clave del sistema viejo por un **tipo explícito** elegido por el docente al crear la personalizada.
- **R13 — El cumplimiento no depende de la IA.** Toda contemplación activa debe materializarse mediante la capa determinista; la IA colabora, pero su fallo o desvío no puede impedir el cumplimiento (ver sección 10).

---

## 8. Estados y ciclo de vida

**Contemplación del catálogo, por estudiante+categoría:**

```
(no configurada) → [entra al perfil] → sugerida por defecto (si aplica perfil)
       │                                        │
       │                                        ├─ docente activa/desactiva → seleccionada / no seleccionada
       │                                        │        │
       └────────────────────────────────────────────────┴─ primer cambio manual → categoría "editada por el usuario" (protegida de re-siembra)
```

**Contemplación personalizada:**

```
creada (con título + regla) → seleccionada/deseleccionada → [editada] → [eliminada]
```

**Marca de la categoría respecto de las sugerencias:**

```
no sembrada → sembrada (versión N, coincide con lo sugerido)
   → editada por el usuario (protegida: no se re-siembra aunque cambie la versión)
```

Transiciones válidas clave:
- De *sembrada* a *editada por el usuario*: por cualquier cambio manual del docente (irreversible salvo acción explícita de reset).
- De *sembrada versión N* a *sembrada versión N+1*: solo si la categoría **no** está *editada por el usuario*.

---

## 9. Información que maneja el flujo

**Del catálogo (semilla del sistema, no editable por el docente):**
- Identificador estable y etiqueta canónica de cada contemplación.
- Categoría de aplicabilidad (*clase* / *evaluaciones* / *ambas*).
- Una o más **materializaciones**, cada una con: su **tipo**, una **descripción/plantilla**, y el **contexto** en que aplica (evaluación, clase o ambos).
- Reglas específicas y notas de deduplicación cuando corresponde.

**Tipos de materialización (organización del catálogo):**

| Tipo de materialización | Qué produce | ¿Toca el material del estudiante? |
|--------------------------|-------------|-----------------------------------|
| **Diseño de material** | Cambia la maquetación del cuadernillo/ficha (ej. consignas en pasos, texto fragmentado con preguntas, mapa de la prueba, plantillas de respuesta). | Sí |
| **Norma de formato** | Estándar de formato aplicado al material (ej. tipografía legible, espaciado no saturado, enunciados simples). | Sí |
| **Recordatorio al docente** | Nota operativa para el docente asociada al estudiante (ej. leer consignas en voz alta, dar más tiempo, no penalizar ortografía). | No |
| **Sección de diferenciación** | Línea en el bloque de adaptaciones del plan de clase, **con nombres** de los estudiantes afectados. | No (es del plan del docente) |
| **Regla de corrección** | Regla para la corrección/rúbrica (ej. corregir por contenido, no por forma). | No (guía al docente) |
| **Recomendación de perfil** | Sugerencia de contexto (ej. ubicación estratégica en el aula). | No |

**Categorías/tipos de adecuación que cubre el catálogo (con ejemplos representativos):**
- **Cambios de diseño/formato del material:** palabras clave en negrita e íconos de apoyo; letra ampliada y alto contraste; tipografía y tamaño mínimo; diagramación legible "no saturada"; enunciados simples y concretos.
- **Estructura de las consignas y del texto:** segmentación de consignas en pasos numerados; fragmentación de textos con preguntas tras cada fragmento; respuestas estructuradas en lugar de redacción extensa; plantillas/modelos de respuesta; checklist de autocontrol; apoyaturas de memotecnia.
- **Ajustes de tiempo:** tiempo adicional y pausas; señalización explícita de tiempos por sección; inicio anticipado o extensión operativa del tiempo.
- **Recordatorios operativos para el docente:** lectura oral de consignas; hoja auxiliar/borrador permitido; calculadora/material concreto cuando corresponda; monitoreo y andamiaje; priorización de tareas.
- **Corrección y evidencia:** corrección centrada en contenido, no forma (no penalizar ortografía cuando no es el objetivo); respuesta oral como apoyo (no como evidencia); soporte digital para producción escrita.
- **Contexto y motivación:** ubicación estratégica en el aula; anticipación y estructura previa (agenda/objetivos); refuerzo positivo y reconocimiento.

> ⚠️ La lista de ejemplos es ilustrativa. El contrato es: el catálogo está **organizado por categoría de aplicabilidad + tipos de materialización**, con identificadores estables. No hace falta transcribir las ~26 entradas para reimplementar.

**Por estudiante (dato del docente, persistido):**
- Identificador del estudiante.
- Contemplaciones del catálogo activas, por categoría (*clase* / *evaluaciones*).
- Contemplaciones personalizadas, por categoría, cada una con: identificador propio, **título visible**, **regla** interna, y estado seleccionado.
- Metadatos de siembra: versión sembrada, momento de siembra, huella de la selección sembrada, y marca de "editada por el usuario".

**Derivado/calculado (no se guarda como dato del docente, se produce al planificar/evaluar):**
- **Recordatorios por estudiante** para una evaluación (lista de notas dirigidas al docente, asociadas al estudiante).
- **Reglas de diseño de la versión** de evaluación (conjunto de especificaciones que modelan el material).
- **Bloque de diferenciación** del plan de clase (líneas con nombres agrupados por adecuación común).

---

## 10. Interacción con IA

Las contemplaciones tocan la IA de dos flujos (planificación 04/05 y evaluaciones 06/07), pero el patrón es el mismo y es el punto **más importante** de este documento.

- **Objetivo:** que el material generado (plan de clase, cuadernillo de evaluación) ya venga adecuado a los estudiantes con contemplaciones activas, sin trabajo manual adicional del docente.

- **Contexto que recibe la IA:** las contemplaciones **activas** de los estudiantes involucrados, traducidas a instrucciones de negocio (ej. "usar enunciados simples", "consignas en pasos numerados", "fragmentar textos largos con preguntas por bloque"). La IA recibe esto como parte de su prompt y **debe respetarlo** al redactar.

- **Resultado esperado:** contenido que ya incorpora las adecuaciones de diseño/estructura donde correspondan.

- **Reglas que la IA debe respetar:**
  - Aplicar las contemplaciones de diseño/formato/estructura en el material.
  - **No** imprimir en el material del estudiante los recordatorios dirigidos al docente (R10).
  - Ceñirse a las contemplaciones activas de cada estudiante; no inventar adecuaciones no seleccionadas.

- **Capa de cumplimiento determinista (lo esencial):** por encima de la IA existe un **motor determinista** que, a partir de las contemplaciones activas, **garantiza** la materialización mediante reglas fijas y plantillas — sin invocar IA:
  - Genera los **recordatorios al docente** y los coloca **solo** en el lugar correcto (asociados al estudiante, fuera del material del estudiante).
  - Genera/asegura las **reglas de diseño** del material de evaluación.
  - Construye el **bloque de diferenciación** del plan de clase, agrupando estudiantes por adecuación común e insertando sus nombres.
  - Resuelve casos especiales (ej. "lectura oral" condicional, R11) y clasifica las personalizadas (R12) de forma determinista.

  **Por qué es necesario:** la aplicación de una contemplación es una obligación pedagógica; no puede quedar librada al azar de una generación de IA que podría omitirla, ubicarla mal (ej. filtrar un recordatorio del docente al cuadernillo del estudiante) o reinterpretarla. La IA **mejora la redacción**, pero **el motor determinista es la garantía de cumplimiento**.

- **Comportamiento ante fallos:** si la IA falla, se demora o ignora una contemplación, el motor determinista igualmente produce recordatorios, reglas de diseño y diferenciación. El cumplimiento de las contemplaciones **no** depende del éxito de la IA. ⚠️ A definir: si tras un fallo de IA la parte de *redacción adecuada del contenido* debe reintentarse o degradar a un material base + materializaciones deterministas.

---

## 11. Criterios de aceptación

- [ ] El sistema debe exponer un **catálogo canónico** de contemplaciones con identificadores estables y etiqueta canónica, marcado con su **categoría** (*clase* / *evaluaciones* / *ambas*).
- [ ] El sistema debe mostrar en el perfil del estudiante **dos secciones independientes** (clase y evaluaciones), filtrando el catálogo por categoría y mostrando las de categoría *ambas* en las dos.
- [ ] El sistema debe **preseleccionar** contemplaciones sugeridas por defecto según el perfil del estudiante, marcándolas como "Sugerido", solo si la categoría no fue editada por el docente.
- [ ] El sistema debe permitir **activar/desactivar** contemplaciones del catálogo y **persistir** cada cambio de inmediato, asociado al identificador estable del estudiante.
- [ ] El sistema debe permitir **crear, editar y eliminar** contemplaciones personalizadas con título visible y regla interna, por categoría.
- [ ] El sistema debe **dejar de sobrescribir** una categoría con sugerencias por defecto en cuanto el docente la edita manualmente, y debe **preservar** esas ediciones ante cambios de versión de los defaults.
- [ ] El sistema debe **normalizar/consolidar** los identificadores de contemplaciones duplicadas históricas en una sola opción.
- [ ] El sistema debe **materializar de forma determinista** las contemplaciones activas: recordatorios al docente, reglas de diseño del material y bloque de diferenciación con nombres.
- [ ] El sistema debe garantizar que **ningún recordatorio dirigido al docente** aparezca en el material entregado al estudiante.
- [ ] El sistema debe garantizar el cumplimiento de las contemplaciones **aunque la generación con IA falle o las ignore**.
- [ ] El sistema debe materializar la contemplación de "lectura oral de consignas" en clase solo cuando hay consignas escritas puntuales, o con redacción condicional si no puede determinarlo.

---

## 12. Enlaces con otros flujos

- **Perfil / gestión de estudiantes:** origen del identificador estable y del perfil (con/sin adecuación) que alimenta las sugerencias por defecto.
- **Flujo 04/05 — Planificación de clases:** consume contemplaciones de *clase* / *ambas* para construir el bloque de diferenciación/adaptaciones y para adecuar el contenido generado por IA.
- **Flujo 06/07 — Evaluaciones:** consume contemplaciones de *evaluaciones* / *ambas* para generar recordatorios por estudiante y aplicar reglas de diseño al material de evaluación.

---

## Notas de deuda técnica (⚠️)

- ⚠️ **Persistencia local es deuda técnica.** En el sistema viejo, las selecciones por estudiante, las personalizadas y los metadatos de siembra viven en el **almacenamiento local del navegador**. Esto no es confiable (se pierde al cambiar de dispositivo/navegador, no se comparte entre docentes, no respalda). **Intención para la reimplementación:** persistir las contemplaciones por estudiante de forma **confiable, en el backend, asociadas al identificador del estudiante**, con las mismas garantías de independencia por categoría, versionado de defaults y marca de "editado por el usuario".
- ⚠️ **Asociación por nombre como fallback** existe por compatibilidad heredada; debe eliminarse a favor de relación por clave.
- ⚠️ **Clasificación de personalizadas por heurística de palabras clave** (recordatorio vs. diseño) es frágil; reemplazar por un **tipo explícito** elegido por el docente.
- ⚠️ **Versión de defaults muy alta / "force seeding"** en el sistema viejo es un parche para forzar migraciones; la reimplementación debería tener un mecanismo de versionado limpio que respete siempre las ediciones del docente.
