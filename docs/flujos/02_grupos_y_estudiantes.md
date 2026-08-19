# Flujo 02 — Grupos y estudiantes

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Fundamental · **Depende de:** flujos 01 (identidad/roles del docente), 12 (portal del estudiante / diagnóstico)

## 1. Propósito

El docente organiza a sus estudiantes en **grupos** (equivalentes a una clase escolar, ej. "9no 1") y, dentro de cada grupo, mantiene una **ficha pedagógica** por estudiante. Esta información es el insumo central para todo el resto del producto: a partir de los grupos y sus estudiantes se deriva un **perfil del grupo** y se arma el **contexto** que la IA usa para personalizar planificaciones y evaluaciones.

El problema real que resuelve: un docente uruguayo de secundaria (ANEP) atiende varios grupos, cada uno con estudiantes que tienen estilos de aprendizaje distintos y, en algunos casos, necesidades educativas específicas (informes psicopedagógicos, adecuaciones). Recordar y aplicar manualmente esas particularidades en cada clase y evaluación es inviable. AulaPlus centraliza esa información y la vuelve accionable.

> ⚠️ Deuda técnica del proyecto viejo: los estudiantes y sus fichas están **hardcodeados como datos de demostración**, no persistidos. Las contemplaciones y las banderas de adecuación viven en el almacenamiento local del navegador. Solo las "sugerencias del docente" a nivel de grupo se guardan realmente en base de datos. La reimplementación debe **persistir** grupos, estudiantes y toda su ficha, asociados al docente propietario. En este documento se describe la **intención de negocio** (datos persistidos), marcando con ⚠️ lo que hoy es provisorio.

## 2. Actores y roles

| Actor | Rol en este flujo |
|-------|-------------------|
| **Docente** | Propietario de sus grupos. Crea/gestiona grupos, consulta y edita la ficha pedagógica de cada estudiante, marca contemplaciones y adecuaciones, y escribe sugerencias a nivel de grupo. |
| **Estudiante** | Sujeto de la ficha. No opera este flujo; su **diagnóstico** (flujo 12) alimenta su perfil de aprendizaje. El docente lo consulta pero no lo edita en el rol de estudiante. |
| **Equipo psicopedagógico** | Origen (fuera de la app o cargado como dato) de los informes técnicos y de las contemplaciones "sugeridas". El docente los ve como referencia y decide cuáles aplicar. |
| **Sistema/IA** | Deriva el perfil del grupo a partir de los estudiantes y ensambla el contexto de grupo que consumen los flujos de generación (04, 05, 06). |

## 3. Glosario del dominio

- **Grupo:** conjunto de estudiantes que cursan juntos, identificado por **año/grado** (ej. "9º Año") y **sección** (ej. "1"), con un nombre corto legible (ej. "9no 1"). Pertenece a un único docente.
- **Estudiante:** persona dentro de un grupo, con una ficha pedagógica asociada.
- **Perfil de aprendizaje:** estilo predominante del estudiante, expresado como combinación de canales (ej. "Visual-Kinestésico", "Auditivo-Lector/escritor"). Los cuatro canales base son **Visual, Auditivo, Kinestésico y Lector/escritor**.
- **Perfil del grupo:** vista agregada y derivada del conjunto de estudiantes (tamaño, distribución de estilos, estilo dominante, diversidad). No se ingresa a mano; se calcula.
- **Contemplación (adecuación de acceso):** ajuste concreto que facilita el acceso del estudiante a la clase o a la evaluación sin alterar el contenido evaluado (ej. "Lectura oral de consignas", "Tiempo adicional y pausas", "Palabras clave en negrita"). Existe un **catálogo canónico** de contemplaciones y cada una aplica a un **contexto**: clase, evaluaciones, o ambas.
- **Contemplación personalizada:** contemplación libre creada por el docente para un estudiante, con un título visible y una regla interna que orienta la lógica de generación.
- **Adecuación de acceso:** el estudiante necesita apoyos de acceso (tiempo, formato, lectura), pero **no** cambia el contenido curricular.
- **Adecuación de contenido:** el estudiante tiene una **adecuación curricular formalmente declarada** que sí modifica los contenidos/objetivos. Es una condición fuerte y explícita (habilita generación de evaluaciones con contenido adaptado; ver flujo 06).
- **Informe técnico psicopedagógico:** documento estructurado sobre un estudiante (síntesis de situación, estilo de aprendizaje, objetivos priorizados, modalidad de cursado, ajustes programáticos por materia y las banderas de adecuación).
- **Sugerencias del docente (a nivel de grupo):** notas escritas por el docente para orientar el trabajo con ese grupo, en tres apartados: **aula**, **evaluaciones** y **otras**.
- **Diagnóstico del estudiante:** cuestionario que completa el propio estudiante (flujo 12) y que alimenta su perfil de aprendizaje.
- **Contexto de grupo:** paquete de información de negocio (perfil del grupo + estudiantes con sus ajustes + sugerencias del docente) que se entrega a la IA como insumo.

## 4. Precondiciones y dependencias

- El docente debe estar autenticado (flujo 01); cada grupo pertenece a un docente y solo su propietario puede verlo/editarlo.
- Para que el perfil de aprendizaje de un estudiante esté completo, idealmente el estudiante completó su diagnóstico (flujo 12). Si no, el docente puede trabajar igual con la información disponible.
- Este flujo es **precondición** de:
  - Flujo 04 — Planificación con IA (usa el contexto de grupo).
  - Flujos 05 / 06 — Evaluaciones con IA (usan contexto de grupo, contemplaciones de evaluación y banderas de adecuación).

## 5. Flujo principal (happy path)

1. El docente ingresa a **"Mis grupos"** y ve la lista de todos sus grupos.
2. Cada grupo se muestra como una tarjeta con: nombre, año y sección, cantidad de estudiantes, y algunas métricas resumidas (promedio de calificación, cuántos tienen calificación suficiente/insuficiente, cuántos requieren ajustes).
3. El docente puede **buscar/filtrar** grupos por nombre, año o sección.
4. El docente abre un grupo y ve su **perfil de grupo**: lista de estudiantes, distribución de estilos de aprendizaje, recomendaciones pedagógicas derivadas del perfil dominante, y las tres áreas de **sugerencias del docente** (aula / evaluaciones / otras).
5. El docente puede **editar cada apartado de sugerencias**; el sistema parte de un texto sugerido por defecto (según el perfil dominante del grupo) que el docente puede sobrescribir. Al guardar, queda persistido para ese grupo.
6. El docente abre la **ficha de un estudiante** y consulta/edita:
   - Datos básicos y perfil de aprendizaje.
   - **Contemplaciones** aplicables, separadas en dos listas: **para la clase** y **para evaluaciones**. Las que provienen de recomendación psicopedagógica aparecen marcadas como "Sugerido". El docente marca/desmarca y puede **agregar contemplaciones personalizadas**.
   - Resultados de evaluaciones, historial académico, observaciones cualitativas (docentes y psicopedagógicas) y evolución.
   - **Informe técnico** (si existe), incluyendo la **declaración explícita de adecuaciones** (acceso y/o contenido) mediante casillas que el docente controla manualmente.
7. Cuando el docente lanza una generación con IA (planificación o evaluación) para ese grupo, el sistema **ensambla el contexto de grupo** con todo lo anterior y se lo entrega a la IA (ver sección 10).

## 6. Flujos alternativos y casos borde

- **Grupo sin estudiantes cargados:** el grupo existe (nombre/año/sección) pero aún no tiene estudiantes. El perfil de grupo queda vacío/mínimo; la generación con IA debe funcionar igual, usando solo las sugerencias del docente si las hay.
  > ⚠️ En el proyecto viejo, dos de los tres grupos de demostración tienen la lista de estudiantes vacía aunque declaran una cantidad; la reimplementación debe evitar esa inconsistencia (la cantidad debe reflejar los estudiantes reales).
- **Estudiante sin informe técnico:** es válido. La sección de informe simplemente no se muestra y no hay adecuaciones declaradas.
- **Estudiante sin diagnóstico completado:** su perfil puede estar incompleto; el sistema no debe bloquear el resto del flujo.
- **Búsqueda sin resultados:** se muestra un estado vacío ("no se encontraron grupos").
- **Sugerencias del docente vacías:** si el docente no escribió nada, se ofrece un texto por defecto según el perfil dominante; si tampoco hay perfil dominante, el apartado puede quedar vacío.
- **Estudiante marcado con adecuación de contenido:** habilita capacidades especiales aguas abajo (evaluación con contenido adaptado, flujo 06). Debe tratarse como una condición fuerte y explícita, nunca inferida automáticamente.
- **Fallo al cargar las sugerencias del docente:** la generación con IA no debe bloquearse; se continúa sin ellas.

## 7. Reglas de negocio

- **R1.** Un docente tiene **cero o varios grupos**; cada grupo pertenece a **un solo** docente. Un docente solo puede ver y editar sus propios grupos.
- **R2.** Un grupo se identifica por **año/grado + sección** y tiene un **nombre** legible. La combinación debe permitir distinguir grupos entre sí dentro de un mismo docente.
- **R3.** Un grupo contiene **cero o varios estudiantes**. La "cantidad de estudiantes" mostrada debe coincidir con los estudiantes efectivamente asociados.
- **R4.** Cada estudiante pertenece a un grupo y guarda una ficha pedagógica con: perfil de aprendizaje, ajustes/necesidades, contemplaciones (clase y evaluaciones), informe técnico opcional, historial académico, observaciones cualitativas, anotaciones y seguimiento.
- **R5.** Las **contemplaciones** se gestionan en **dos categorías independientes**: "para la clase" y "para evaluaciones". Una misma contemplación del catálogo puede aplicar a una categoría o a ambas.
- **R6.** Las contemplaciones "Sugerido" provienen de recomendación psicopedagógica y son solo una **sugerencia**: el docente decide explícitamente cuáles quedan activas para el estudiante.
- **R7.** El docente puede crear **contemplaciones personalizadas** (título visible + regla interna) por estudiante y categoría.
- **R8.** Las **adecuaciones** (acceso y contenido) se declaran de forma **explícita y manual** por el docente. **Nunca se infieren automáticamente** del perfil ni de las contemplaciones.
- **R9.** "Adecuación de acceso" y "adecuación de contenido" son independientes: un estudiante puede requerir una, ambas o ninguna. La de **contenido** es la única condición que habilita evaluaciones con contenido adaptado (ver flujo 06).
- **R10.** El **perfil del grupo** es siempre **derivado** de los estudiantes; no se edita a mano.
- **R11.** Las **sugerencias del docente** por grupo tienen tres apartados (aula, evaluaciones, otras). Cada apartado, si está vacío, puede mostrar un texto por defecto según el perfil dominante; el texto que el docente guarde **sobrescribe** ese default.
- **R12.** El **diagnóstico del estudiante** (flujo 12) es la fuente que alimenta su **perfil de aprendizaje**. El docente consulta ese perfil pero no completa el diagnóstico por el estudiante.
- **R13.** La ficha completa de estudiantes debe estar **persistida y asociada** al grupo y al docente.
  > ⚠️ Hoy no se cumple: estudiantes en datos de demostración, contemplaciones y banderas de adecuación en almacenamiento local del navegador, y solo las sugerencias del docente en base de datos. Es deuda técnica a resolver.
- **R14.** El acceso a grupos, estudiantes y sus fichas debe estar restringido al docente propietario (aislamiento por usuario).

## 8. Estados y ciclo de vida

Las entidades de este flujo son mayormente de **datos maestros** (sin una máquina de estados compleja). Los estados relevantes son:

- **Sugerencias del docente (por apartado):**
  `Sin personalizar (muestra default según perfil dominante)` → `Personalizada (texto guardado por el docente)` → puede volver a vaciarse (vuelve a mostrar el default).
- **Contemplación de un estudiante (por categoría):**
  `No aplicada` ⇄ `Aplicada`. Las del catálogo pueden además venir con marca `Sugerido` (informativa, no implica aplicada).
- **Adecuación (acceso / contenido):**
  `No declarada` ⇄ `Declarada`. Transición siempre por acción explícita del docente.

## 9. Información que maneja el flujo

**Del grupo:**
- Nombre legible, año/grado, sección.
- Docente propietario.
- Cantidad de estudiantes (debe reflejar los reales).
- Sugerencias del docente: apartados **aula**, **evaluaciones**, **otras** (texto libre, con posible default por perfil dominante).

**Del estudiante (ficha pedagógica):**
- Datos básicos (nombre, avatar/identificador visual).
- **Perfil de aprendizaje** (combinación de canales; alimentado por el diagnóstico del flujo 12).
- **Ajustes/necesidades** (resumen textual de apoyos).
- **Contemplaciones** aplicadas, en dos listas: clase y evaluaciones; más contemplaciones personalizadas.
- **Informe técnico** (opcional): síntesis de situación actual, estilo de aprendizaje, objetivos priorizados, modalidad de cursado, ajustes programáticos por materia, y las **banderas de adecuación** (acceso / contenido).
- **Historial académico** (calificaciones por año y materia).
- **Observaciones cualitativas** (comentarios de docentes y de psicopedagogía, con fecha, área y evaluador).
- **Anotaciones y seguimiento** del docente; alertas.

**Derivado (perfil del grupo):**
- **Tamaño** del grupo.
- **Distribución** de estudiantes por estilo de aprendizaje (conteo y porcentaje por canal Visual/Auditivo/Kinestésico/Lector-escritor).
- **Estilo dominante** (canal más frecuente).
- **Índice de diversidad** (cuántos canales distintos están presentes).
- **Recomendaciones pedagógicas** generadas a partir del dominante y de la diversidad.
- Métricas de tablero: promedio de calificación, cantidad con calificación suficiente/insuficiente, cantidad con ajustes necesarios.
  > ⚠️ En el proyecto viejo el "promedio de calificación" y algunas métricas se derivan de un campo de progreso convertido a escala; la reimplementación debería usar calificaciones reales cuando existan.

## 10. Interacción con IA

Este flujo **no genera** contenido con IA por sí mismo, pero **produce el contexto de grupo** que consumen los flujos de generación (04 planificación, 05/06 evaluaciones). Se documenta aquí porque es la pieza que este flujo entrega.

- **Objetivo:** proveer a la IA una descripción fiel y accionable del grupo y de las necesidades de sus estudiantes, para que planifique y evalúe de forma personalizada y respetuosa de las adecuaciones.
- **Contexto que recibe (información de negocio):**
  - Identificación del grupo: nombre y año/grado.
  - **Perfil del grupo:** tamaño, estilo dominante y distribución de estilos.
  - **Estudiantes con necesidades:** por cada uno, su perfil de aprendizaje, sus ajustes y sus contemplaciones **de la categoría pertinente** (clase para planificación, evaluaciones para evaluación), más la marca de si tiene **adecuación de contenido declarada**.
  - **Sugerencias del docente** para ese grupo (aula/evaluaciones/otras).
  - **Pistas de cobertura** derivadas de las contemplaciones (p. ej. quiénes requieren lectura oral, tiempo extra/pausas, formato de respuesta alternativo), para orientar adaptaciones concretas.
  - Indicador global de si **algún** estudiante requiere adaptación de contenido.
- **Privacidad:** los estudiantes se entregan **anonimizados** ("Estudiante A", "Estudiante B", …) para el prompt; no se envían nombres reales.
  > ⚠️ Supuesto: la anonimización debe mantenerse en la reimplementación como criterio de privacidad de datos sensibles de menores.
- **Resultado esperado:** el contexto no produce salida visible por sí mismo; habilita a los flujos 04/05/06 a generar contenido alineado al grupo. La regla de negocio es que ese contenido **respete** las contemplaciones activas y las adecuaciones declaradas.
- **Reglas que la IA debe respetar:**
  - Aplicar las contemplaciones de la categoría correcta (clase vs. evaluación).
  - No generar contenido adaptado (nivel de contenido) para estudiantes que **no** tienen adecuación de contenido declarada.
  - Considerar el perfil dominante y la diversidad del grupo al proponer estrategias.
  - Tener en cuenta las sugerencias del docente.
- **Comportamiento ante fallos:** si no se pueden cargar las sugerencias del docente u otros datos opcionales, la generación **continúa** con el contexto disponible (degradación elegante), sin bloquear al docente.

## 11. Criterios de aceptación

- [ ] El sistema debe permitir a un docente tener varios grupos y ver solo los propios.
- [ ] El sistema debe identificar cada grupo por año/grado + sección con un nombre legible.
- [ ] El sistema debe listar los grupos con su cantidad real de estudiantes y permitir buscarlos por nombre, año o sección.
- [ ] El sistema debe mostrar, por grupo, un perfil derivado (tamaño, distribución de estilos, estilo dominante, diversidad) sin requerir carga manual.
- [ ] El sistema debe permitir editar y persistir las sugerencias del docente en tres apartados (aula, evaluaciones, otras), con default por perfil dominante cuando estén vacías.
- [ ] El sistema debe mostrar por estudiante su perfil de aprendizaje, ajustes, contemplaciones (clase y evaluaciones), informe técnico opcional, historial y observaciones.
- [ ] El sistema debe permitir marcar/desmarcar contemplaciones del catálogo por categoría y crear contemplaciones personalizadas.
- [ ] El sistema debe distinguir las contemplaciones "Sugerido" de las efectivamente aplicadas.
- [ ] El sistema debe permitir declarar explícitamente adecuación de acceso y/o de contenido, sin inferirlas automáticamente.
- [ ] El sistema debe persistir estudiantes y sus fichas asociados al grupo y al docente propietario.
- [ ] El sistema debe ensamblar un contexto de grupo (perfil + estudiantes con ajustes/contemplaciones + sugerencias del docente) y entregarlo anonimizado a la generación con IA.
- [ ] El sistema no debe bloquear la generación con IA si faltan datos opcionales.

## 12. Enlaces con otros flujos

- **Flujo 01 (Identidad y roles):** define al docente autenticado propietario de los grupos.
- **Flujo 12 (Portal del estudiante / diagnóstico):** el diagnóstico que completa el estudiante alimenta su perfil de aprendizaje, que aquí se consume. Este flujo **no** documenta la experiencia del estudiante llenando el diagnóstico.
- **Flujo 04 (Planificación con IA):** consume el contexto de grupo (perfil dominante, diversidad, contemplaciones de clase, sugerencias de aula).
- **Flujos 05 / 06 (Evaluaciones con IA):** consumen el contexto de grupo con contemplaciones de evaluación y la bandera de adecuación de contenido (que habilita evaluaciones con contenido adaptado).
