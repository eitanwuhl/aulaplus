# Flujo 06 — Evaluaciones

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Fundamental · **Depende de:** flujos 03 (Contemplaciones), 04/05 (Planificación y sesiones), grupos y estudiantes.

## 1. Propósito

Permitir que un docente cree, con asistencia de IA, una **evaluación escrita** para un grupo concreto, alineada con el currículo oficial (competencias, criterios de logro y contenidos ANEP) y con lo efectivamente trabajado en clase. La evaluación no es un documento único: se genera como un **instrumento base universal** más, cuando corresponde, **versiones personalizadas** para estudiantes con necesidades declaradas, respetando sus contemplaciones. El sistema también produce la **rúbrica** de corrección, **recordatorios** operativos para el docente y un **reporte** que explica el diseño.

Resuelve tres problemas reales del docente:
1. Redactar una evaluación válida y alineada al currículo lleva mucho tiempo.
2. Atender la diversidad del aula (adecuaciones, accesibilidad) exige preparar más de una versión coherente entre sí.
3. Corregir con criterios homogéneos requiere una rúbrica anclada a los criterios oficiales.

## 2. Actores y roles

| Actor | Rol en este flujo |
|---|---|
| **Docente** | Define la evaluación (nombre, materia, nivel), selecciona qué evaluar (competencias, criterios, contenidos), elige las fuentes, fija el tiempo objetivo, dispara la generación, revisa/ajusta, guarda, consulta y elimina. |
| **Sistema / IA** | Deriva el plan de diseño, genera ítems, rúbricas y versiones adaptadas, calcula asignación de estudiantes a versiones, produce recordatorios y el reporte. (Ver flujo 07.) |
| **Estudiante** | No interactúa directamente. Es el destinatario final: cada estudiante queda asignado a la versión (A/B/C) adecuada a su perfil y contemplaciones. |

## 3. Glosario del dominio

- **Evaluación:** instrumento escrito para medir aprendizajes de un grupo en una materia y nivel.
- **Competencia (ANEP):** capacidad amplia del currículo oficial que la evaluación busca evidenciar.
- **Criterio de logro:** descriptor concreto y observable asociado a una competencia; ancla la rúbrica.
- **Contenido / subtema (ANEP):** tema curricular específico a evaluar.
- **Fuente de la evaluación:** origen de los contenidos evaluados. Existen tres tipos combinables: contenidos ANEP, sesiones planificadas y materiales del docente (ver §5.2).
- **Sesión (resumen estructurado):** extracción determinista de una sesión de clase planificada (contenidos, competencias, objetivos, resumen de actividades, recursos, materiales adjuntos) usada como insumo de generación.
- **Rúbrica:** matriz de corrección con criterios y niveles de logro con descriptores y puntajes.
- **Nivel de logro:** grado de desempeño dentro de un criterio (p. ej. Excelente / Bueno / Necesita mejorar / Insuficiente).
- **Versión de la evaluación:** variante del instrumento (A universal, B adaptación de contenido declarada, C accesibilidad equivalente). Ver §5.6 y flujo 03.
- **Contemplación:** ajuste declarado para un estudiante (accesibilidad, diseño del instrumento, administración o corrección). Definido en el flujo 03.
- **Recordatorio al docente:** nota operativa por estudiante sobre cómo administrar o corregir según sus contemplaciones.
- **Presupuesto de tiempo:** duración objetivo de la evaluación fijada por el docente.
- **Plan de diseño:** cálculo previo y determinista que decide versiones, asignación de estudiantes, opciones de respuesta y reglas de diseño (detallado en flujo 07).
- **Borrador vs. guardado:** una evaluación recién generada existe en pantalla; solo pasa al repositorio del docente cuando este la **guarda explícitamente**.

## 4. Precondiciones y dependencias

1. El docente está autenticado y tiene al menos un **grupo** con estudiantes.
2. Cada estudiante puede tener **contemplaciones** cargadas (flujo 03); el sistema siembra valores por defecto antes de generar para no depender de que el docente haya abierto cada perfil.
3. Para usar sesiones como fuente debe existir al menos una **planificación guardada** con sesiones (flujos 04/05).
4. Para usar materiales como fuente, estos deben estar en la biblioteca del docente y, si son PDF, tener **texto extraído** disponible.
5. Existe el **catálogo oficial** de competencias, criterios de logro y contenidos por materia.

## 5. Flujo principal (happy path)

### 5.1 Punto de entrada
El docente entra a Evaluaciones y elige entre **generar una nueva** o **ver mis evaluaciones** (repositorio). Al generar, se abre el asistente de creación.

### 5.2 Definir la evaluación
1. Selecciona el **grupo**.
2. Selecciona la **materia**. La evaluación puede ser **interdisciplinaria** (varias materias a la vez).
3. Ingresa un **nombre**.
4. El **nivel** se deriva del año del grupo (no se pide aparte).

### 5.3 Elegir qué evaluar (currículo)
1. Selecciona una o más **competencias** de la(s) materia(s).
2. Dentro de cada competencia, selecciona sus **criterios de logro**.
3. Selecciona los **contenidos/subtemas** a evaluar.
> Regla mínima: debe haber al menos una competencia seleccionada para poder guardar (§7 R7).

### 5.4 Elegir las fuentes
El docente elige de dónde salen los contenidos. Los tres tipos de fuente son **combinables** y al menos uno es obligatorio:
- **Contenidos ANEP:** selección directa desde el catálogo oficial.
- **Sesiones planificadas:** elige una planificación guardada y marca qué sesiones evaluar; puede escribir un **texto de enfoque** ("¿qué querés evaluar de estas sesiones?").
- **Materiales del docente:** documentos de su biblioteca (p. ej. PDF con texto extraído); puede indicar si se incluyen también los materiales adjuntos a las sesiones.

> ⚠️ Regla: no se puede generar una evaluación basada **solo** en materiales si los PDF elegidos no tienen texto extraído; el sistema lo impide con un mensaje claro (§6).

### 5.5 Fijar el presupuesto de tiempo
El docente define la **duración objetivo** en minutos (valor por defecto 80; valores comunes 40 / 80 / 120, equivalentes a 1/2/3 módulos). Tras generar, el sistema muestra la **duración estimada** y su desglose por tipo de ítem, e indica si "se ajusta" o "excede" respecto del objetivo (tolerancia ~10%).

### 5.6 Generar
El docente dispara la generación. El sistema:
1. Siembra contemplaciones por defecto para todos los estudiantes del grupo (sin pisar selecciones manuales del docente).
2. Construye el **plan de diseño** (flujo 07): qué versiones pedir, asignación de estudiantes, opciones de respuesta, reglas de diseño y recordatorios.
3. Arma el contexto (currículo + fuentes + estudiantes anonimizados + tiempo objetivo) y solicita a la IA la evaluación (flujo 07).
4. Recibe el instrumento, lo normaliza y lo muestra: versiones, rúbrica, asignación de estudiantes, recordatorios y reporte de diseño.

### 5.7 Revisar y ajustar
El docente revisa el resultado y puede pedir **modificaciones** en lenguaje natural (chat), que re-disparan la generación conservando el contexto (flujo 07). Puede editar puntajes con redistribución automática (§5.8) y consultar la rúbrica.

### 5.8 Rúbrica y puntajes
- El sistema deriva una **rúbrica global (macro)** a partir de los criterios de logro seleccionados y **rúbricas específicas por pregunta** ancladas a los criterios pertinentes (ver §9).
- Los **niveles de logro** por defecto son cuatro: Excelente, Bueno, Necesita mejorar, Insuficiente, cada uno con descriptor y puntaje.
- Los **ítems abiertos** llevan además una rúbrica propia con al menos cuatro niveles y descriptores específicos del contenido (no genéricos).
- **Redistribución de puntos:** al cambiar el puntaje total o el de una sección, el sistema reparte proporcionalmente entre ítems, garantizando **mínimo 1 punto por ítem** y usando redondeo determinista para que la suma sea exacta; si el total pedido es menor que el mínimo posible, se usa el mínimo y se avisa.

### 5.9 Recordatorios al docente
El sistema muestra, **por estudiante**, recordatorios operativos agrupados en:
- **Administración:** qué preparar/ofrecer al aplicar (p. ej. lectura de consignas, tiempo adicional).
- **Corrección:** qué tener en cuenta al corregir.
Las contemplaciones de **diseño del instrumento** no aparecen como recordatorios: ya se reflejan en cómo se construyó el cuadernillo y se explican en el reporte de diseño.

### 5.10 Guardar
El docente **guarda explícitamente**. El sistema valida (grupo, materia, ≥1 competencia, nombre, contenido generado, reporte de IA presente) y persiste la evaluación como **guardada** con su fecha. La evaluación queda disponible en "Mis evaluaciones".

### 5.11 Consultar y gestionar
En "Mis evaluaciones" el docente ve la lista de evaluaciones guardadas, filtra, abre el **detalle** (versiones, asignaciones, recordatorios, reporte) y puede **eliminar** (borrado suave, reversible).

## 6. Flujos alternativos y casos borde

- **Sin fuente seleccionada:** si no hay ni contenidos ANEP, ni sesiones, ni materiales, no se genera; mensaje de validación.
- **Interdisciplinaria sin materias:** si se marca interdisciplinaria pero no se eligen materias, no se genera.
- **Materiales sin texto extraído (solo materiales):** se bloquea la generación con instrucción de esperar/re-extraer.
- **Planificación sin sesiones:** el selector avisa que esa planificación aún no tiene sesiones.
- **Fallo de la IA:** ver flujo 07 (reintentos, degradación, fallback). Si no llega contenido válido, no se puede guardar.
- **Versión asignada pero no generada:** si un estudiante quedó asignado a B o C pero esa versión no se generó, el sistema lo **reasigna a la versión A** y muestra una advertencia de "ajustes automáticos de versiones".
- **Contemplación sin plantilla de recordatorio:** el panel de recordatorios entra en estado de error explícito, listando las contemplaciones sin plantilla (falla visible, no silenciosa).
- **Guardado sin reporte de IA:** si el reporte de diseño no se persistió, el guardado se aborta con error (el reporte es parte obligatoria del registro).
- **Evaluación sin contenido generado:** el detalle muestra un estado vacío explicativo.
- **Evaluación previa/legacy sin reporte:** el detalle la muestra igual, indicando que el reporte de IA no está disponible.

## 7. Reglas de negocio

- **R1.** Una evaluación pertenece a un docente, un grupo, una materia (o varias si es interdisciplinaria) y un nivel derivado del grupo.
- **R2.** Debe existir al menos una fuente (contenidos ANEP, sesiones o materiales) para generar.
- **R3.** No se genera una evaluación basada solo en materiales cuyos PDF carezcan de texto extraído.
- **R4.** La evaluación siempre incluye la **Versión A (universal)**; las versiones B y C se generan solo cuando el plan de diseño lo justifica (flujo 03 y 07).
- **R5.** Cada estudiante del grupo queda **asignado a exactamente una versión**. Si su versión asignada no existe en el resultado, se reasigna a A y se registra la advertencia.
- **R6.** Los niveles de logro por defecto son cuatro (Excelente, Bueno, Necesita mejorar, Insuficiente); los ítems abiertos requieren rúbrica propia con ≥4 niveles y descriptores específicos del contenido.
- **R7.** Para guardar se exige: grupo, materia, ≥1 competencia, nombre no vacío, contenido generado y reporte de IA presente.
- **R8.** Guardar es **explícito**: hasta entonces la evaluación no figura en el repositorio.
- **R9.** La eliminación es **borrado suave** (marca de eliminación con fecha), reversible; nunca borrado físico desde la interfaz.
- **R10.** "Mis evaluaciones" lista únicamente las **guardadas y no eliminadas**, ordenadas por fecha de guardado descendente.
- **R11.** La redistribución de puntos garantiza mínimo 1 punto por ítem y suma total exacta; si el total pedido es inferior al mínimo posible se usa el mínimo y se advierte.
- **R12.** Los recordatorios visibles al docente se limitan a las categorías **administración** y **corrección**; las contemplaciones de diseño del instrumento no se listan como recordatorios.
- **R13.** El presupuesto de tiempo se considera cumplido si la duración estimada cae dentro de la tolerancia respecto del objetivo (~10%); si excede, se informa.
- **R14.** Los datos de estudiantes se pasan a la IA de forma **anonimizada** (sin nombres reales); los nombres se resuelven solo en la interfaz.

## 8. Estados y ciclo de vida

Entidad **Evaluación**:

```
(no existe) → Generada-en-pantalla → Guardada → Eliminada (borrado suave)
                     │                    │              │
                     │                    └── editable / regenerable (chat, puntajes)
                     └── descartable sin persistir       └── restaurable (reversión de la marca)
```

- **Generada-en-pantalla:** existe el resultado (versiones, rúbrica, reporte) pero no está persistido.
- **Guardada:** persistida, con fecha de guardado; visible en el repositorio.
- **Eliminada:** marcada como eliminada; oculta de listas y detalle, reversible.

Entidad **Versión** (dentro de una evaluación): A (siempre presente) · B (opcional) · C (opcional). Ver flujo 03 para su semántica.

## 9. Información que maneja el flujo

**Identidad de la evaluación:** nombre, materia(s), indicador de interdisciplinaria, grupo, nivel, fecha.

**Selección curricular:** competencias, criterios de logro, contenidos/subtemas.

**Fuentes:** referencia a la planificación y sesiones elegidas, texto de enfoque, materiales elegidos, indicador de incluir materiales de sesión. De cada sesión se deriva un **resumen estructurado** (contenidos, competencias, objetivos, resumen de actividades, recursos, materiales adjuntos). De cada material se deriva un digesto (título, tipo, texto de enfoque, fragmento de texto extraído acotado).

**Presupuesto de tiempo:** duración objetivo; tras generar, duración estimada y desglose por tipo de ítem con supuestos heurísticos.

**Instrumento generado:** para cada versión, sus **secciones** e **ítems**. Cada ítem tiene tipo (opción múltiple, verdadero/falso, verdadero/falso con justificación, respuesta corta, párrafo, ensayo, análisis de fuente, completar tabla, relacionar, ordenar), consigna, puntaje, y campos propios del tipo (opciones, fuente/pasaje, subpreguntas, columnas, rúbrica de ítem, opciones de respuesta equivalentes).

**Rúbrica (dos niveles):**
- **Global/macro:** un criterio por cada criterio de logro seleccionado, con peso (repartido) y cuatro descriptores de nivel derivados del criterio oficial.
- **Específica por pregunta:** para cada parte/pregunta, criterios anclados a los criterios de logro pertinentes, con descriptores contextualizados al contenido de esa pregunta.
- Existe además exportación de una versión de rúbrica **para estudiantes**.
- Validaciones de coherencia: tiempo total vs. configurado, cobertura de criterios, ausencia de estudiantes duplicados en asignaciones.

**Versiones y asignación:** mapa estudiante → versión (A/B/C) y, por versión, la lista de estudiantes asignados y las adaptaciones aplicadas.

**Recordatorios:** por estudiante, listas de recordatorios de administración y de corrección.

**Reporte de diseño (IA):** narrativa global y por versión, cobertura de contenidos, contemplaciones aplicadas y justificación de las opciones de respuesta. (Detallado en flujo 07.)

**Marcas de gestión:** guardada (sí/no) con fecha, eliminada (sí/no) con fecha.

## 10. Interacción con IA

Este flujo **usa IA de forma central** para generar el instrumento, las rúbricas de ítem, las versiones adaptadas y el reporte de diseño. La lógica completa (objetivo, contexto, resultado, reglas y fallos) está documentada en el **flujo 07**. Aquí basta con retener:
- La IA recibe el currículo seleccionado, las fuentes, el contexto anonimizado del grupo/estudiantes, las contemplaciones y el presupuesto de tiempo.
- Produce las versiones solicitadas por el plan de diseño (A siempre; B/C según necesidad), respetando las contemplaciones de cada estudiante (flujo 03).
- El resultado se **normaliza** para presentación consistente y para asignar cada estudiante a su versión.

## 11. Criterios de aceptación

- [ ] El sistema debe permitir crear una evaluación indicando nombre, materia (o varias) y derivar el nivel del grupo.
- [ ] El sistema debe permitir seleccionar competencias, sus criterios de logro y contenidos.
- [ ] El sistema debe permitir combinar fuentes (ANEP, sesiones, materiales) y exigir al menos una.
- [ ] El sistema debe impedir la generación solo-materiales cuando los PDF no tienen texto extraído.
- [ ] El sistema debe permitir fijar una duración objetivo y mostrar la estimada con indicación de ajuste/exceso.
- [ ] El sistema debe generar siempre la Versión A y las versiones B/C solo cuando el diseño lo justifique.
- [ ] El sistema debe asignar cada estudiante a una versión y reasignar a A (con aviso) si su versión no fue generada.
- [ ] El sistema debe producir una rúbrica global anclada a los criterios seleccionados y rúbricas específicas por pregunta.
- [ ] El sistema debe redistribuir puntos manteniendo mínimo 1 por ítem y suma total exacta.
- [ ] El sistema debe mostrar recordatorios por estudiante en categorías de administración y corrección.
- [ ] El sistema debe requerir guardado explícito y validar los campos obligatorios antes de persistir.
- [ ] El sistema debe listar solo evaluaciones guardadas y no eliminadas, y permitir borrado suave reversible.
- [ ] El detalle debe mostrar versiones con estudiantes asignados, recordatorios y reporte de diseño.

## 12. Enlaces con otros flujos

- **Flujo 03 (Contemplaciones):** define las contemplaciones que determinan versiones, recordatorios y reglas de diseño.
- **Flujos 04/05 (Planificación y sesiones):** aportan las sesiones usadas como fuente.
- **Flujo 07 (Generación y modificación con IA):** detalla el motor que produce y modifica el instrumento y sus versiones.
- **Repositorio de materiales del docente:** provee los materiales usados como fuente.
