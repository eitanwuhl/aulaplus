# AulaPlus — Documentación funcional de flujos

> **Qué es esto:** la especificación funcional completa de AulaPlus, escrita para **reimplementar el producto desde cero** con arquitectura profesional (**Frontend React · Backend Laravel · Base de datos PostgreSQL**).
>
> Cada documento describe **QUÉ debe hacer el sistema y POR QUÉ** (lógica de negocio), **no cómo estaba implementado** el proyecto anterior. Están pensados para usarse como **prompts** en sesiones de IA (Claude Code) del proyecto nuevo.

---

## Qué es AulaPlus

Plataforma para **docentes uruguayos (ANEP)** que asiste, con ayuda de IA, en las tres tareas centrales del trabajo docente y las conecta bajo un mismo eje pedagógico (las **competencias ANEP**):

1. **Planificar** clases y unidades didácticas (con calendario de sesiones).
2. **Evaluar** a los estudiantes (con rúbricas y versiones personalizadas).
3. **Reportar / comunicar** el desempeño (boletines, reportes, comunicaciones).

Todo atravesado por un principio no negociable: las **contemplaciones** (adecuaciones para estudiantes con necesidades específicas) deben aplicarse de forma **garantizada**, tanto en clases como en evaluaciones.

---

## Cómo usar estos documentos como prompts

- **Un flujo = un prompt.** Para implementar una funcionalidad en el proyecto nuevo, abrí una sesión de IA y pegá (o referenciá) el documento del flujo correspondiente. Cada archivo es **autocontenido**: se puede implementar leyendo solo ese archivo más sus dependencias enlazadas.
- **Respetá el orden de importancia.** La numeración va de lo más fundamental a lo más secundario. No implementes el flujo 06 (Evaluaciones) sin tener antes 01, 02 y 03.
- **Las reglas de negocio están numeradas** (R1, R2, …) y los **criterios de aceptación** son un checklist verificable: usalos como definición de "terminado".
- **Los `⚠️` son decisiones o deuda técnica.** Marcan supuestos, cosas "a definir" o comportamiento que en el proyecto viejo era demostrativo/mock. En el proyecto nuevo son puntos donde **vos tenés que decidir** (o implementar de verdad lo que antes era simulado).
- **Agnóstico al stack a propósito.** No hay tablas, endpoints ni nombres de componentes: la IA del proyecto nuevo diseña la implementación en React/Laravel/PostgreSQL según sus propias buenas prácticas.
- **Convenciones de autoría:** ver [`_PLANTILLA.md`](./_PLANTILLA.md) si querés agregar o editar un flujo manteniendo el mismo formato.

---

## Índice de flujos (ordenados por importancia)

### 🟥 Fundamentales — el núcleo. Sin esto no hay producto.

| # | Flujo | De qué trata |
|---|-------|--------------|
| 01 | [Autenticación, roles y navegación](./01_autenticacion_roles_navegacion.md) | Docente vs. estudiante, inicio de sesión, aislamiento de datos por docente, estructura de navegación. |
| 02 | [Grupos y estudiantes](./02_grupos_y_estudiantes.md) | Grupos (año + sección), fichas de estudiantes, perfil del grupo, contexto que alimenta a la IA. |
| 03 | [Contemplaciones (adecuaciones)](./03_contemplaciones.md) | Catálogo canónico de adecuaciones y su **enforcement determinista** en clases y evaluaciones. Eje transversal. |
| 04 | [Planificación de clases](./04_planificacion_de_clases.md) | Asistente por pasos, unidades didácticas, calendario de sesiones, estados de sesión, guardado explícito. |
| 06 | [Evaluaciones](./06_evaluaciones.md) | Crear evaluaciones por grupo, fuentes, rúbricas, versiones personalizadas, recordatorios al docente. |

### 🟧 Altas — el diferencial del producto (la IA) y su marco de referencia.

| # | Flujo | De qué trata |
|---|-------|--------------|
| 05 | [Generación de planes de clase con IA](./05_generacion_ia_planes.md) | Contrato conceptual de la IA que genera el desarrollo de cada sesión respetando duración, competencias y contemplaciones. |
| 07 | [Generación de evaluaciones con IA](./07_generacion_ia_evaluaciones.md) | "Design plan" determinista + IA que genera ítems, rúbricas y versiones adaptadas por contemplación. |
| 08 | [Marco de competencias ANEP](./08_competencias_anep.md) | Datos de referencia: competencias, contenidos y criterios de logro; el eje que conecta planificación, evaluación y reportes. |

### 🟨 Medias — valor agregado, dependen del núcleo.

| # | Flujo | De qué trata |
|---|-------|--------------|
| 09 | [Boletines, reportes y analítica pedagógica](./09_boletines_y_reportes.md) | Texto de boletín con IA, reportes ejecutivo/grupal, analítica y registro competencial (PDF). |
| 10 | [Biblioteca de materiales](./10_biblioteca_de_materiales.md) | Subir materiales, extracción de texto y uso como fuente para la generación con IA. |

### 🟩 Bajas — secundarias / a futuro.

| # | Flujo | De qué trata |
|---|-------|--------------|
| 11 | [Comunicaciones](./11_comunicaciones.md) | Mensajes del docente hacia Dirección / equipo psicopedagógico, con historial. |
| 12 | [Portal del estudiante](./12_portal_estudiante.md) | Diagnóstico de estilos de aprendizaje (VARK), resultados, notificaciones. |

---

## Mapa de dependencias

Leer de arriba hacia abajo: cada flujo asume implementados los que están por encima de sus flechas.

```
01 Autenticación / roles
        │
        ▼
02 Grupos y estudiantes ──────────────┐
        │                             │
        ▼                             │
03 Contemplaciones  ◄── eje transversal (lo consumen 04, 05, 06, 07, 09)
        │                             │
   ┌────┴───────────────┐            │
   ▼                    ▼            ▼
04 Planificación    06 Evaluaciones   08 Competencias ANEP (referencia de 04, 06, 09)
   │                    │
   ▼                    ▼
05 IA de planes     07 IA de evaluaciones
   │                    │
   └─────────┬──────────┘
             ▼
   10 Biblioteca de materiales  (fuente para 05 y 07)
             │
             ▼
   09 Boletines / reportes  (consume resultados de 02, 06, 08)

11 Comunicaciones · 12 Portal del estudiante  (satélites; 12 alimenta el perfil de 02)
```

**Orden de implementación recomendado:** 01 → 02 → 08 → 03 → 04 → 05 → 06 → 07 → 10 → 09 → 11 → 12.
(08 se adelanta porque 04 y 06 seleccionan competencias; 10 conviene antes de 09 pero después de 04/06 porque los materiales se adjuntan a planificaciones y evaluaciones.)

---

## Glosario global del dominio

Términos que se repiten en varios flujos. Cada flujo tiene además su propio glosario local.

| Término | Significado |
|---------|-------------|
| **ANEP** | Administración Nacional de Educación Pública (Uruguay). Define el marco curricular. |
| **Competencia** | Capacidad que el estudiante debe desarrollar, definida por ANEP. Es el eje que conecta planificación, evaluación y reportes (ver flujo 08). |
| **Criterio de logro** | Evidencia observable de que una competencia se alcanzó. Deriva de la competencia. |
| **Contenido** | Tema/subtema del programa que se trabaja. Se organiza jerárquicamente por asignatura. |
| **Grupo** | Conjunto de estudiantes identificado por año/grado + sección (ej. "9no 1"). Pertenece a un docente. |
| **Perfil del grupo** | Caracterización **derivada** (no editada a mano) de un grupo: tamaño, distribución de estilos de aprendizaje, perfil dominante, diversidad. Sirve de contexto para la IA. |
| **Contemplación / adecuación** | Ajuste razonable para un estudiante con necesidades específicas. Puede aplicar a la clase, a las evaluaciones o a ambas. Su cumplimiento debe **garantizarse** (ver flujo 03). |
| **Enforcement determinista** | Garantía, por reglas fijas (sin depender de la IA), de que cada contemplación se materializa (recordatorios, cambios de diseño, secciones de diferenciación). |
| **Unidad didáctica** | Secuencia de contenidos agrupados que se dictan en varias clases dentro de una planificación. |
| **Sesión / clase** | Una clase individual dentro de una planificación, con fecha, duración y estado. |
| **Session brief / foco temático** | Indicación puntual del docente sobre qué debe abordar una sesión específica; tiene prioridad para la IA. |
| **Rúbrica** | Instrumento de evaluación que define criterios y niveles de logro con puntajes. |
| **Versión personalizada** | Variante de una evaluación adaptada a las necesidades/contemplaciones de un estudiante, manteniendo equivalencia de exigencia. |
| **Fuente (de evaluación)** | Origen del contenido de una evaluación: contenidos ANEP, sesiones planificadas y/o materiales del docente. |
| **Design plan** | Plan de diseño **determinista** que se calcula antes de invocar a la IA de evaluaciones (qué versiones pedir, reglas, recordatorios). |
| **Material** | Recurso del docente (documento, imagen, etc.) que puede adjuntarse a planificaciones/evaluaciones y del que se extrae texto para la IA. |
| **Guardado explícito** | Un ítem existe como **borrador** hasta que el docente lo guarda con nombre; recién ahí aparece en sus listas. |
| **Borrado suave** | Eliminar marca el ítem como eliminado de forma **reversible**, sin borrarlo físicamente. |
| **VARK** | Modelo de estilos de aprendizaje (Visual, Auditivo, Lector-escritor, Kinestésico) usado en el diagnóstico del estudiante (flujo 12). |

---

## Principios de negocio transversales (aplican a todos los flujos)

1. **Aislamiento por docente.** Cada docente ve y gestiona únicamente sus propios grupos, planificaciones, evaluaciones y materiales.
2. **Las competencias ANEP son el hilo conductor.** Lo que se planifica, se evalúa; lo que se evalúa, se reporta — todo referido a las mismas competencias.
3. **Las contemplaciones no son opcionales.** Su aplicación debe garantizarse por reglas deterministas, nunca quedar librada al azar de la IA.
4. **La IA asiste, el docente decide.** Todo lo generado por IA es editable y regenerable; el docente siempre tiene la última palabra.
5. **Guardado explícito + borrado suave.** Nada se publica hasta que el docente lo guarda; nada se pierde de forma irreversible al eliminar.
6. **Degradación elegante.** Si falta contexto o la IA falla, el sistema ofrece un resultado base útil en vez de romperse.

> **Nota sobre el proyecto viejo:** buena parte de la **analítica** (flujo 09), el **login** (flujos 01/12) y varios datos de estudiantes eran **demostrativos/mock**. En esta documentación esos puntos están marcados con `⚠️` y descritos por su **intención de negocio**, para implementarse de verdad con datos reales en el proyecto nuevo.
