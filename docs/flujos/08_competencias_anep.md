# Flujo 08 — Marco de competencias ANEP (datos de referencia)

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Alta · **Depende de:** Flujo 01 (autenticación/navegación)

## 1. Propósito

El sistema educativo uruguayo (ANEP) define, para cada asignatura y grado, un conjunto de **competencias** que el estudiante debe desarrollar y de **criterios de logro** que permiten evaluar ese desarrollo. Estas competencias son el **eje pedagógico transversal** de AulaPlus: son el idioma común que conecta lo que el docente **planifica**, lo que después **evalúa** y lo que finalmente **reporta**.

Este flujo describe el marco de competencias ANEP como un **catálogo de datos de referencia** (no editable por el docente): qué información contiene, cómo está organizado y cómo se usa como insumo compartido por los demás flujos. Su valor es garantizar que planificación, evaluación y reportes hablen siempre de las mismas competencias oficiales, con la misma redacción y la misma codificación, sin que el docente tenga que transcribirlas a mano.

## 2. Actores y roles

| Actor | Rol en este flujo |
|---|---|
| **Docente** | Consulta y **selecciona** competencias (y contenidos oficiales) al planificar o evaluar. No las crea ni las edita: elige de un catálogo predefinido. |
| **Sistema** | Provee el catálogo oficial por asignatura, lo presenta para su selección, deriva los criterios de logro asociados y hace disponibles las competencias seleccionadas al resto de los flujos. |
| **IA (asistente pedagógico)** | Cuando genera planificaciones o evaluaciones, se **ciñe** a las competencias seleccionadas por el docente y las usa como marco obligatorio. Ver Flujos de planificación y evaluación. |

## 3. Glosario del dominio

- **Asignatura / Materia:** área curricular. En el alcance actual: **Historia**, **Literatura** y **Formación para la Ciudadanía** (nivel 9.º grado, marco ANEP).
- **Competencia específica:** capacidad amplia que el estudiante debe desarrollar en una asignatura (p. ej. "interpretar críticamente fuentes históricas"). Tiene un **código** (p. ej. CE1), un **nombre** y una **descripción** completa.
- **Criterio de logro:** enunciado concreto y observable que permite evaluar si una competencia se está alcanzando. Tiene un **código** (p. ej. CL1.1) y una descripción. Cada competencia tiene uno o más criterios de logro asociados.
- **Contenido oficial (del programa ANEP):** tema curricular concreto a trabajar. Los contenidos se agrupan en **capítulos/ejes** (unidades temáticas mayores) que a su vez contienen **subtemas** seleccionables.
- **Mapeo competencia–contenido:** vínculo que indica qué competencias se trabajarán en cada contenido seleccionado. Permite trazabilidad pedagógica.
- **Catálogo de referencia:** conjunto de datos oficiales predefinidos, común a todos los docentes, que el sistema ofrece pero el docente no modifica.

## 4. Precondiciones y dependencias

- Requiere un docente autenticado (Flujo 01).
- Requiere que esté definida la **asignatura** de trabajo, porque el catálogo de competencias y de contenidos es **específico por asignatura**. Esa asignatura normalmente proviene del contexto de la planificación o evaluación en curso.
- El catálogo debe existir cargado en el sistema como dato de referencia antes de que el docente pueda seleccionar.

> ⚠️ A definir: el proyecto viejo trae el catálogo únicamente para **9.º grado** y para **tres asignaturas**. Queda por decidir cómo se amplía a otros grados y asignaturas, y quién mantiene/actualiza el catálogo cuando ANEP cambia los programas (¿carga administrativa central? ¿versión por año lectivo?).

## 5. Flujo principal (happy path)

El uso típico ocurre **dentro** de la planificación o de la evaluación:

1. El sistema conoce la **asignatura** del trabajo en curso.
2. El sistema muestra las **competencias específicas** de esa asignatura, cada una con su código, nombre y descripción.
3. El docente **selecciona** las competencias que quiere desarrollar (una o varias).
4. El sistema muestra los **contenidos oficiales** de esa asignatura, organizados por capítulo/eje; el docente **selecciona** los subtemas que trabajará en el período.
5. Cuando hay competencias y contenidos seleccionados, el sistema ofrece **asociar** cada contenido con las competencias que se trabajarán en él (mapeo competencia–contenido).
6. A partir de las competencias seleccionadas (y/o de los contenidos elegidos), el sistema **deriva automáticamente los criterios de logro** correspondientes, sin intervención manual del docente.
7. Las competencias, contenidos, mapeo y criterios de logro quedan disponibles como **contexto pedagógico** para:
   - la generación asistida por IA de la planificación o evaluación,
   - la trazabilidad (qué competencias cubre cada actividad/instrumento),
   - los reportes posteriores.

## 6. Flujos alternativos y casos borde

- **Asignatura sin catálogo cargado:** si la asignatura no tiene competencias/contenidos de referencia, no hay nada para seleccionar. El sistema debe indicarlo con claridad y no romper el flujo. > ⚠️ A definir: comportamiento esperado (bloquear, permitir texto libre, etc.).
- **Docente selecciona competencias pero ningún contenido (o viceversa):** el paso de mapeo solo aparece cuando existen ambos. Con solo competencias, igual se pueden derivar sus criterios de logro.
- **Selección repetida entre varias unidades:** cuando el mismo criterio/competencia se elige en más de un contenido o unidad, el sistema debe **consolidar sin duplicar** (una competencia trabajada en tres contenidos se cuenta/lista una sola vez), preservando el orden en que aparecieron por primera vez.
- **Deselección de un contenido:** al quitar un contenido, se deben limpiar sus asociaciones de mapeo para no dejar vínculos huérfanos.
- **Un contenido con varios criterios de logro asociados:** es lo normal; un mismo subtema puede vincularse a varios criterios de distintas competencias.

## 7. Reglas de negocio

- **R1.** El catálogo de competencias, criterios de logro y contenidos es **dato de referencia oficial**: el docente lo consulta y selecciona, pero no lo crea, edita ni elimina.
- **R2.** Todo el catálogo está **segmentado por asignatura**: al operar sobre una asignatura, solo se muestran sus competencias y contenidos.
- **R3.** Cada competencia específica tiene: un **código** único dentro de su asignatura, un **nombre** y una **descripción** completa.
- **R4.** Cada competencia tiene **uno o más criterios de logro**; cada criterio tiene su código y descripción y pertenece a exactamente una competencia.
- **R5.** Los contenidos oficiales se organizan jerárquicamente: **capítulos/ejes** (agrupadores, no seleccionables por sí mismos) que contienen **subtemas** (las unidades seleccionables).
- **R6.** Cada contenido puede estar asociado a un conjunto de criterios de logro; al seleccionar contenidos, el sistema puede **derivar** los criterios de logro implicados.
- **R7.** El sistema debe permitir **mapear** cada contenido seleccionado con las competencias específicas a trabajar en él (relación muchos-a-muchos entre contenidos y competencias).
- **R8.** La consolidación de competencias/criterios entre varias selecciones debe ser **sin duplicados** y con **orden estable** (primera aparición gana).
- **R9.** Las competencias seleccionadas por el docente son **vinculantes** para la generación con IA: la IA debe ceñirse a ellas y no introducir competencias no elegidas.
- **R10.** Los textos y la codificación de competencias, criterios y contenidos deben respetar **exactamente** la redacción oficial de ANEP (son citas normativas, no parafraseables).

## 8. Estados y ciclo de vida

El catálogo en sí es **estático** (datos de referencia; sin ciclo de vida por parte del docente). Lo que sí tiene estados es la **selección** que hace el docente dentro de un trabajo:

```
Sin selección ──(elige competencias)──► Competencias seleccionadas
Competencias seleccionadas ──(elige contenidos)──► Competencias + contenidos seleccionados
Competencias + contenidos ──(asocia)──► Mapeo competencia–contenido definido
(cualquier estado) ──(deselección)──► se recalculan criterios derivados y se limpian mapeos huérfanos
```

> ⚠️ A definir: versionado del catálogo. Si ANEP actualiza un programa, hay que decidir si las selecciones históricas conservan la redacción vigente al momento de crearlas o adoptan la nueva.

## 9. Información que maneja el flujo

**Por cada competencia específica:**
- Código (identificador legible, p. ej. "CE1").
- Nombre (título breve de la competencia).
- Descripción (enunciado completo, redacción oficial).
- Asignatura a la que pertenece.
- Criterios de logro asociados.

**Por cada criterio de logro:**
- Código (p. ej. "CL1.1").
- Descripción (redacción oficial).
- Competencia a la que pertenece.

**Por cada contenido oficial:**
- Ubicación jerárquica: capítulo/eje al que pertenece.
- Texto del subtema (redacción oficial).
- Criterios de logro que ese contenido permite trabajar.

**Selección del docente (por trabajo de planificación/evaluación):**
- Conjunto de competencias elegidas.
- Conjunto de contenidos elegidos.
- Mapeo contenido → competencias.
- Criterios de logro derivados (calculados, no capturados manualmente).

> ⚠️ Supuesto: en el proyecto viejo cada asignatura tiene su propia lista de competencias y su propio esquema de códigos de criterios (Historia usa CE1..CE9 con criterios como CL1.1; Ciudadanía y Literatura tienen sus propias listas). El modelo nuevo debería unificar esto en una estructura común "asignatura → competencia → criterio de logro" y "asignatura → capítulo → subtema → criterios", sin perder la redacción oficial de cada una.

## 10. Interacción con IA

- **Objetivo:** el marco de competencias no genera contenido por sí mismo, pero es el **insumo pedagógico central** que la IA recibe cuando produce planificaciones y evaluaciones. Garantiza que lo generado esté alineado con el currículo oficial.
- **Contexto que recibe la IA:** la asignatura, las competencias seleccionadas (con su redacción y códigos), los contenidos elegidos, el mapeo contenido–competencia y los criterios de logro derivados.
- **Resultado esperado:** actividades, secuencias y/o instrumentos de evaluación que **desarrollan y evalúan precisamente esas competencias**, referenciando los criterios de logro correspondientes para dar trazabilidad.
- **Reglas que la IA debe respetar:**
  - Ceñirse **solo** a las competencias y contenidos seleccionados; no introducir competencias ajenas.
  - Usar la redacción y codificación oficiales sin alterarlas.
  - Respetar el mapeo competencia–contenido definido por el docente.
- **Comportamiento ante fallos:** si la generación falla, la **selección de competencias/contenidos del docente debe conservarse** para poder reintentar sin rehacer el trabajo. (El detalle de reintentos y degradación corresponde a los flujos de planificación y evaluación.)

## 11. Criterios de aceptación

- [ ] El sistema debe ofrecer, por asignatura, el catálogo oficial de competencias específicas con código, nombre y descripción.
- [ ] El sistema debe ofrecer, por asignatura, los contenidos oficiales organizados por capítulo/eje con sus subtemas seleccionables.
- [ ] El sistema debe permitir al docente seleccionar una o varias competencias y uno o varios contenidos.
- [ ] El sistema debe permitir asociar cada contenido seleccionado con las competencias a trabajar en él.
- [ ] El sistema debe derivar automáticamente los criterios de logro a partir de las competencias/contenidos seleccionados, sin captura manual.
- [ ] El sistema debe consolidar competencias y criterios sin duplicados y con orden estable cuando se repiten entre selecciones.
- [ ] El sistema debe limpiar los mapeos asociados cuando se deselecciona un contenido.
- [ ] El sistema debe impedir que el docente edite el catálogo de referencia (solo selección).
- [ ] El sistema debe preservar la redacción y codificación oficiales de competencias, criterios y contenidos.
- [ ] El sistema debe hacer disponibles las competencias, contenidos, mapeo y criterios seleccionados como contexto para la IA y para los reportes.

## 12. Enlaces con otros flujos

- **Flujo 01 (Autenticación y navegación):** provee el docente autenticado y el contexto de asignatura desde el que se usa este catálogo.
- **Flujo de planificación:** consume la selección de competencias/contenidos como marco de la clase/unidad; la IA planifica ceñida a ellas.
- **Flujo de evaluaciones:** usa las competencias y criterios de logro para orientar y trazar los instrumentos de evaluación.
- **Flujo de reportes:** usa las competencias seleccionadas como eje para reportar avance y cobertura curricular, cerrando el círculo planificación → evaluación → reporte.
