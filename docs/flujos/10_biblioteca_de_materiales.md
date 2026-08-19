# Flujo 10 — Biblioteca de materiales

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Media · **Depende de:** 01 (autenticación y aislamiento por usuario), 05 (planificación), 07 (evaluación)

## 1. Propósito

La biblioteca de materiales es el espacio personal donde cada docente **reúne sus propios recursos** (documentos, textos, imágenes, presentaciones, audio, video) para **reutilizarlos** a lo largo de la app.

Resuelve dos problemas concretos del docente:

1. **Centralizar recursos dispersos.** En lugar de tener sus materiales sueltos en su computadora o en distintos servicios, los guarda una sola vez en un lugar propio y los vuelve a usar cuando quiere.
2. **Usar el contenido de esos recursos como fuente de la generación con IA.** Cuando el docente adjunta un material a una planificación, unidad, sesión o evaluación, el **contenido textual** de ese material se convierte en insumo para que la IA genere planes o evaluaciones **basados en los propios materiales del docente**, y no solo en contenidos genéricos o del programa oficial (ANEP).

En síntesis: la biblioteca es "el material propio del docente, listo para reutilizar y para alimentar a la IA".

## 2. Actores y roles

| Actor | Qué hace en este flujo |
|-------|------------------------|
| **Docente** | Sube materiales, les asigna título/etiquetas/notas, los busca, los abre, los archiva, y los adjunta a planificaciones/unidades/sesiones/evaluaciones. |
| **Sistema** | Almacena el archivo de forma privada, guarda los datos del material, y provee acceso temporal seguro al archivo para verlo. Mantiene el aislamiento: cada docente solo ve lo suyo. |
| **Sistema / IA (extracción de texto)** | Al subir un documento con texto (ej. PDF), extrae automáticamente su contenido textual para que quede disponible como fuente. Ver sección 10. |
| **Sistema / IA (generación)** | Al generar un plan o una evaluación, consume el texto de los materiales adjuntos como parte del contexto. Ver flujos 05 y 07. |

## 3. Glosario del dominio

| Término | Significado |
|---------|-------------|
| **Material** | Un recurso del docente guardado en su biblioteca: el archivo en sí más sus datos descriptivos (título, etiquetas, notas). |
| **Biblioteca** | El conjunto de materiales activos (no archivados) que pertenecen a un docente. |
| **Extracción de texto** | Proceso automático que lee el contenido textual de un documento (hoy, PDF) y lo guarda asociado al material, para que la IA pueda usarlo. |
| **Adjuntar (adjunto)** | Vincular un material de la biblioteca a un destino concreto (planificación, unidad, sesión o evaluación) para que sirva de fuente en ese contexto. |
| **Destino del adjunto** | La entidad a la que se vincula el material: planificación, sesión o evaluación (y, en el armado de la planificación, también por unidad). |
| **Nota de uso (foco)** | Texto opcional que el docente asocia a un adjunto para indicar cómo pensar usar ese material en ese destino (ej. "revisar páginas 3-5 para la actividad de inicio"). |
| **Modo materiales-only** | Situación en que la IA genera un plan/evaluación usando **exclusivamente** los materiales del docente, porque no se especificó contenido del programa oficial (ANEP). |
| **Archivado** | Baja lógica (borrado suave): el material deja de aparecer en la biblioteca sin eliminarse definitivamente. |

## 4. Precondiciones y dependencias

- El docente debe estar **autenticado** (flujo 01). Toda operación sobre materiales requiere sesión activa.
- Para **adjuntar** un material a un destino, ese destino debe existir previamente:
  - Adjuntar a nivel de **sesión** requiere que la sesión ya esté guardada (si no, se muestra un aviso pidiendo guardar primero).
  - Adjuntar a **planificación / unidad** ocurre dentro del armado de la planificación (flujo 05).
  - Adjuntar a **evaluación** ocurre dentro del armado de la evaluación (flujo 07).
- Para que un material aporte contenido a la IA, conviene que tenga **texto extraído** (aplica a documentos con texto; ver sección 10). Un material sin texto extraído igual puede adjuntarse, pero aporta poco o nada como fuente textual.

## 5. Flujo principal (happy path)

### 5.1 Subir un material a la biblioteca

1. El docente abre su biblioteca de materiales.
2. Elige "Subir material" y selecciona un archivo de su dispositivo.
3. El sistema propone un **título** por defecto a partir del nombre del archivo; el docente puede editarlo.
4. Opcionalmente agrega **etiquetas** (palabras clave separadas por comas) y **notas** descriptivas.
5. Confirma la subida. El sistema:
   1. Guarda el archivo de forma **privada** asociado al docente.
   2. Registra el material con su título, tipo de archivo y datos descriptivos.
   3. Si el archivo es un documento con texto (PDF), **dispara automáticamente la extracción de texto** (ver sección 10) y avisa que está "procesando".
6. El material aparece en la biblioteca. Si se extrajo texto correctamente, se muestra un indicador de "texto extraído".

### 5.2 Consultar y buscar materiales

1. La biblioteca lista los materiales del docente, del más reciente al más antiguo.
2. Cada material muestra: título, tipo de archivo (PDF, imagen, video, documento, etc.), fecha relativa de creación, indicador de "texto extraído" (si corresponde), y sus etiquetas/notas.
3. El docente puede **buscar** por título, tipo, etiquetas o notas.
4. Al hacer clic en un material, el sistema genera un **acceso temporal seguro** al archivo y lo abre para verlo.

### 5.3 Adjuntar un material a un destino

1. Desde el armado de una planificación, unidad, sesión o evaluación, el docente abre el selector de biblioteca.
2. Selecciona uno o varios materiales.
3. Opcionalmente agrega una **nota de uso** (cómo piensa usar ese material en ese destino).
4. Confirma. El sistema crea el vínculo (adjunto) entre cada material y el destino.
5. A partir de ese momento, el **texto extraído** de esos materiales queda disponible como **fuente para la generación con IA** de ese destino (flujos 05 y 07).

### 5.4 Archivar un material

1. El docente elige "archivar" en un material.
2. El sistema pide confirmación, aclarando que el material dejará de aparecer en la biblioteca y que la acción se puede revertir contactando al administrador.
3. Al confirmar, el material se archiva (baja lógica) y desaparece de la biblioteca. Los adjuntos que lo referenciaban dejan de tener sentido en sus destinos.

## 6. Flujos alternativos y casos borde

- **Biblioteca vacía:** se muestra un estado vacío que invita a subir el primer material.
- **Búsqueda sin resultados:** se informa que ningún material coincide con el criterio.
- **Archivo no es documento con texto (imagen, video, audio):** se sube y guarda normalmente, pero **no se extrae texto**. Sirve como recurso de referencia del docente, aunque no aporta contenido textual a la IA.
- **Extracción de texto falla:** el material **igual se crea y guarda**; se informa que no se pudo extraer el texto y se ofrece **reintentar** la extracción manualmente ("re-extraer"). El sistema además reintenta automáticamente una vez antes de darse por vencido.
- **Documento sin texto seleccionable (PDF escaneado como imagen):** la extracción puede devolver texto vacío. En ese caso **no se guarda texto** (el material queda marcado como "sin texto extraído") para que la app no lo trate como fuente válida.
- **Abrir un material sin archivo disponible:** si falta la referencia al archivo, se informa el error y no se abre.
- **Adjuntar cuando el destino no existe todavía:** la acción se bloquea con un aviso (ej. "guardá la sesión primero").
- **Quitar un adjunto:** elimina el vínculo material↔destino (baja lógica del adjunto), **sin borrar el material** de la biblioteca. El material sigue disponible para otros usos.
- **Sesión sin ANEP ni foco pero con materiales:** la generación puede funcionar en **modo materiales-only** (ver flujos 05 y 07 y sección 10).

## 7. Reglas de negocio

- **R1.** Cada docente ve y gestiona **únicamente sus propios materiales**. Un docente nunca puede ver, abrir, adjuntar, modificar ni archivar materiales de otro. El aislamiento por usuario es una invariante del sistema, no una preferencia de UI.
- **R2.** Todo material debe tener un **título** y un **archivo** asociado. El título se propone a partir del nombre del archivo, pero es editable.
- **R3.** Los archivos se guardan de forma **privada**. El acceso para visualizarlos se otorga mediante un **enlace temporal** (de vida corta), no mediante una URL pública permanente.
- **R4.** La **extracción de texto** se aplica automáticamente a documentos con texto (hoy, PDF) en el momento de la subida. Otros tipos de archivo se guardan sin texto extraído.
- **R5.** Si la extracción produce texto vacío, **no se almacena** texto para ese material (queda marcado como "sin texto extraído"), de modo que el sistema no lo considere fuente válida para la IA.
- **R6.** Un material **puede adjuntarse a múltiples destinos** (varias planificaciones, sesiones o evaluaciones) sin duplicar el archivo.
- **R7.** Los adjuntos a nivel **planificación** se consideran aplicables a **todas las sesiones** de esa planificación (herencia), salvo que se definan materiales específicos a nivel de unidad o sesión.
- **R8.** Los adjuntos a nivel **sesión** son **específicos de esa sesión** y no se propagan a otras sesiones.
- **R9.** Una **evaluación** puede tomar materiales de dos formas: (a) adjuntos **directos** desde la biblioteca, y (b) **heredando** los materiales de las sesiones seleccionadas para esa evaluación, si el docente lo habilita.
- **R10.** Archivar un material es una **baja lógica reversible** por administración; no es un borrado definitivo desde la interfaz del docente.
- **R11.** Quitar un adjunto **no** borra el material; solo elimina el vínculo con ese destino.
- **R12.** El propósito central de adjuntar es que el **contenido textual** del material alimente la generación con IA del destino (planes/evaluaciones). Un material sin texto útil aporta poco como fuente.

> ⚠️ Supuesto: El campo de "prioridad/orden" de un adjunto existe en el modelo pero la interfaz actual siempre lo deja en su valor por defecto; se documenta como capacidad latente de **ordenar/priorizar materiales** dentro de un destino, sin uso efectivo hoy.

## 8. Estados y ciclo de vida

### Material

```
(subida) → ACTIVO ──(archivar)──► ARCHIVADO
                                     │
                             (reversión por admin)
                                     ▼
                                   ACTIVO
```

- **Activo:** aparece en la biblioteca y puede usarse/adjuntarse.
- **Archivado:** oculto de la biblioteca; conservado para posible reversión administrativa. No aparece en búsquedas ni selectores.

### Texto extraído (subestado de un material tipo documento)

```
SIN EXTRAER ──(extracción ok, texto no vacío)──► CON TEXTO EXTRAÍDO
     │
     └──(extracción vacía o falla)──► SIN TEXTO EXTRAÍDO  ──(re-extraer)──► (reintenta)
```

### Adjunto (vínculo material↔destino)

```
(adjuntar) → ACTIVO ──(quitar)──► ELIMINADO (baja lógica; el material persiste)
```

## 9. Información que maneja el flujo

**Del material (biblioteca):**
- **Título** — nombre legible del recurso (editable; propuesto desde el nombre del archivo).
- **Archivo** — el recurso subido, guardado de forma privada.
- **Tipo de archivo** — para mostrar y clasificar (PDF, imagen, video, documento, presentación, audio, otro).
- **Etiquetas** — palabras clave para organizar y buscar.
- **Notas** — descripción libre del material.
- **Texto extraído** — contenido textual derivado automáticamente del documento (cuando aplica); es lo que consume la IA.
- **Fecha de creación** — para ordenar y mostrar antigüedad.
- **Estado** — activo / archivado.
- **Propietario** — el docente dueño (base del aislamiento; no se muestra, se infiere de la sesión).

**Del adjunto (vínculo con un destino):**
- **Material vinculado** — cuál recurso de la biblioteca.
- **Destino** — a qué se adjunta (planificación, unidad, sesión o evaluación) y cuál específicamente.
- **Nota de uso (foco)** — indicación opcional de cómo usar ese material en ese destino.
- **Orden/prioridad** — capacidad latente para priorizar materiales dentro de un destino (⚠️ ver supuesto en R12/sección 7).

**Derivado / calculado:**
- Indicador de "texto extraído" (sí/no) mostrado en la biblioteca y en los selectores.
- Conteo de materiales heredados de las sesiones seleccionadas al armar una evaluación.

> ⚠️ A definir: El modelo contempla datos descriptivos adicionales como **materia** y **nivel** del material, pero la interfaz actual solo captura título, etiquetas y notas. Definir si en la reimplementación se capturan materia/nivel de forma estructurada (útil para filtrar la biblioteca por asignatura).

## 10. Interacción con IA

Este flujo tiene **dos** interacciones con IA/automatización relevantes.

### 10.A Extracción de texto al subir (automatización de lectura)

- **Objetivo:** convertir el contenido de un documento del docente en **texto reutilizable**, para que luego pueda servir de fuente a la generación de planes y evaluaciones. Sin este paso, el material sería solo un archivo opaco para la IA.
- **Contexto que recibe:** el archivo del material recién subido (hoy, documentos PDF) y la identidad de su dueño (para verificar propiedad antes de procesarlo).
- **Resultado esperado:** el **texto** del documento, limpio y normalizado, guardado junto al material y marcado como "texto extraído". Si el documento no contiene texto seleccionable, el resultado es vacío y **no** se guarda texto.
- **Reglas que debe respetar:**
  - **Solo procesar materiales del propio docente** (verificación de propiedad estricta).
  - Solo aplica a documentos con texto (PDF); otros formatos no se procesan.
  - Limpiar caracteres de control y normalizar espacios; **acotar** el volumen de texto guardado a un tope razonable para no almacenar documentos enteros gigantes.
  - Nunca guardar texto vacío como si fuera válido (para no engañar a la lógica que decide si hay fuente suficiente).
- **Comportamiento ante fallos:** el material **se conserva** aunque la extracción falle. El sistema **reintenta una vez** automáticamente; si aún falla, informa al docente y ofrece **"re-extraer"** manualmente desde la biblioteca. El docente ve un mensaje claro ("material creado, no se pudo extraer texto, podés reintentar").

> ⚠️ Supuesto: Hoy la extracción se limita a PDF. La reimplementación podría extender la extracción a otros formatos con texto (documentos de ofimática, presentaciones). Documentar como extensión deseable, no como requisito actual.

> ⚠️ A definir: Los límites exactos de páginas/caracteres a extraer. En el sistema viejo conviven señales contradictorias (constantes de límite bajo declaradas pero no usadas, y un recorte efectivo mayor). Se recomienda definir **un** límite explícito y justificado (equilibrio entre riqueza de contexto y costo/tamaño del prompt).

### 10.B El texto del material como fuente de la generación (enlaza flujos 05 y 07)

- **Objetivo:** que los planes y evaluaciones generados se basen en los **recursos propios del docente**, no solo en contenidos genéricos u oficiales.
- **Contexto que recibe la generación:** el **texto extraído** de los materiales adjuntos al destino (más las notas de uso, si las hay), combinado con el resto del contexto pedagógico del plan/evaluación (competencias, contemplaciones, duración, etc., según flujos 05 y 07).
- **Resultado esperado:** un plan o evaluación cuyo contenido **refleja específicamente** lo que dicen los materiales del docente (conceptos, vocabulario, eventos y detalles reales), no plantillas genéricas.
- **Reglas que debe respetar:**
  - Cuando hay materiales adjuntos, su contenido debe **usarse efectivamente** como fuente.
  - En **modo materiales-only** (cuando no hay contenido del programa oficial especificado), los materiales del docente son la **única** fuente de contenido: el resultado debe basarse **exclusivamente** en ese texto, usando términos y detalles concretos del material y evitando relleno genérico.
- **Comportamiento ante fallos:** si un material adjunto no tiene texto extraído, aporta poco o nada; la generación continúa con las demás fuentes disponibles. La lógica de suficiencia de fuentes (¿hay ANEP, materiales o foco suficiente?) se define en el flujo 05.

## 11. Criterios de aceptación

- [ ] El sistema debe permitir al docente **subir** un archivo y guardarlo como material con título, etiquetas y notas.
- [ ] El sistema debe **proponer un título** a partir del nombre del archivo, editable por el docente.
- [ ] El sistema debe **listar** los materiales del docente ordenados por fecha (más recientes primero) y permitir **buscar** por título, tipo, etiquetas y notas.
- [ ] El sistema debe mostrar el **tipo de archivo** y un indicador de **"texto extraído"** cuando corresponda.
- [ ] El sistema debe **extraer automáticamente** el texto de los documentos PDF al subirlos y guardarlo asociado al material.
- [ ] El sistema **no** debe guardar texto cuando la extracción resulta vacía, y debe marcar el material como "sin texto extraído".
- [ ] Ante fallo de extracción, el sistema debe **conservar el material**, reintentar automáticamente y ofrecer **re-extraer** manualmente.
- [ ] El sistema debe permitir **abrir/ver** un material mediante un acceso temporal seguro, sin exponer una URL pública permanente.
- [ ] El sistema debe permitir **adjuntar** uno o varios materiales a una planificación, unidad, sesión o evaluación, con una **nota de uso** opcional.
- [ ] El sistema debe permitir **quitar** un adjunto sin borrar el material de la biblioteca.
- [ ] El sistema debe permitir a una evaluación **incluir** materiales heredados de las sesiones seleccionadas, además de adjuntos directos.
- [ ] El sistema debe **archivar** (baja lógica) un material y ocultarlo de la biblioteca, con posibilidad de reversión administrativa.
- [ ] El sistema debe garantizar que **cada docente solo accede a sus propios materiales** en toda operación (listar, ver, adjuntar, extraer, archivar).
- [ ] El sistema debe pasar el **texto de los materiales adjuntos** como fuente a la generación con IA de planes y evaluaciones, incluyendo el **modo materiales-only**.

## 12. Enlaces con otros flujos

| Flujo | Relación |
|-------|----------|
| **01 — Autenticación, roles y navegación** | Provee la sesión y el aislamiento por usuario que garantiza que cada docente vea solo sus materiales. |
| **05 — Planificación** | Consume el texto de los materiales adjuntos (a nivel planificación/unidad/sesión) como fuente para generar el plan; define la lógica de suficiencia de fuentes y el modo materiales-only. |
| **07 — Evaluación** | Consume materiales adjuntos directamente y/o heredados de las sesiones para generar la evaluación a partir de los recursos del docente. |
