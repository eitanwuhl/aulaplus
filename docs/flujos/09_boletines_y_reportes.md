# Flujo 09 — Boletines, reportes y analítica pedagógica

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Media · **Depende de:** Gestión de estudiantes y grupos, Evaluaciones y calificaciones, Contemplaciones/adaptaciones, Perfiles de aprendizaje.

> ⚠️ **Nota general de estado (leer antes que nada):** Gran parte de la analítica de este flujo está hoy alimentada por **datos de demostración fijos** (mock), no por datos reales del docente. A lo largo del documento se marca con "⚠️ Demo" cada pieza que hoy no consume datos reales. La **intención de negocio** descrita es lo que debe implementarse de verdad: calcular todo a partir de las evaluaciones, calificaciones, contemplaciones y observaciones reales de cada estudiante y grupo.

---

## 1. Propósito

Este flujo agrupa las funcionalidades de **comunicación y síntesis** del desempeño estudiantil: textos de boletín, reportes para reuniones y tableros de analítica pedagógica. Resuelve tres problemas concretos del docente:

1. **Redactar textos de boletín** de calidad, con lenguaje pedagógico apropiado y respetuoso, sin partir de una hoja en blanco (apoyo de IA).
2. **Preparar reportes** listos para imprimir/enviar para reuniones con familias o para seguimiento institucional, tanto por estudiante como por grupo.
3. **Entender la evolución** del desempeño (individual y grupal), detectar estudiantes en riesgo o con oportunidades, y recibir recomendaciones de acompañamiento.

El foco es **ahorro de tiempo** en tareas administrativas de comunicación y **apoyo a la decisión pedagógica** basado en datos.

---

## 2. Actores y roles

| Actor | Rol en este flujo |
|---|---|
| **Docente** | Consumidor principal. Genera textos de boletín, configura y exporta reportes, revisa la analítica, agrega observaciones cualitativas y edita todo antes de usarlo. |
| **Sistema** | Calcula métricas y tendencias a partir de calificaciones/evaluaciones; agrega y distribuye estudiantes por rendimiento y perfil; arma los documentos exportables. |
| **IA** | Redacta el texto descriptivo de boletín a partir del contexto del estudiante y lineamientos pedagógicos. (Y potencialmente las explicaciones/recomendaciones de la analítica — ver ⚠️.) |
| **Familia / Tutores** | Destinatario final de reportes ejecutivos y textos de boletín (no interactúa con el sistema). |
| **Equipo psicopedagógico** | Destinatario/co-lector de síntesis técnicas y alertas (no interactúa aquí; su informe puede incluirse en el reporte). |

---

## 3. Glosario del dominio

- **Texto de boletín:** párrafo(s) descriptivo(s) del desempeño de un estudiante en una materia y período, redactado en tono institucional para la familia. No es una nota numérica; es una valoración cualitativa del proceso de aprendizaje.
- **Contemplación (o adaptación):** ajuste pedagógico activo para un estudiante (ej. tiempo adicional, apoyo visual, consignas segmentadas). Ver flujo de contemplaciones.
- **Perfil de aprendizaje:** estilo dominante del estudiante (visual, auditivo, kinestésico, lector/escritor). Usado para agrupar y sugerir estrategias.
- **Reporte ejecutivo:** documento por estudiante, orientado a reunión con familia, con secciones configurables.
- **Reporte grupal:** síntesis agregada del grupo (promedios, distribución, alertas, perfiles).
- **Plantilla de reporte:** preconfiguración de qué secciones incluir y con qué comentarios por defecto, reutilizable.
- **Registro competencial:** documento formal que lista las competencias trabajadas (con % de cobertura) y las pendientes en un período, para trazabilidad curricular ANEP.
- **Alerta predictiva / estudiante en riesgo:** señal de que un estudiante muestra un patrón preocupante (ej. tendencia descendente) que amerita intervención.
- **Tendencia académica:** dirección del desempeño en el tiempo (ascendente, descendente, estable, fluctuante).
- **Observación de seguimiento (insight docente):** anotación cualitativa del docente sobre un estudiante, categorizada (académica, comportamental, social, familiar, emocional), que sirve de insumo para la IA y los reportes.

---

## 4. Precondiciones y dependencias

Para que este flujo entregue valor **con datos reales** (no demo), deben existir:

1. **Estudiantes y grupos** cargados, con su perfil de aprendizaje.
2. **Evaluaciones y calificaciones** históricas por estudiante, materia y período (fuente de promedios, evolución y tendencias).
3. **Contemplaciones/adaptaciones** activas por estudiante (se citan en boletines y reportes).
4. **Observaciones cualitativas** del docente y/o del equipo psicopedagógico (insumo del boletín por IA y de las alertas).
5. **Período/trimestre** de referencia seleccionable.

> ⚠️ A definir: el numeral exacto de los flujos dependientes (estudiantes, evaluaciones, contemplaciones). Enlazar cuando estén numerados.

---

## 5. Flujo principal (happy path)

### 5.A Generar texto de boletín con IA
1. El docente abre el generador de texto de boletín para un estudiante en una materia.
2. Selecciona el **período** (trimestre actual, semestre actual, año completo).
3. Opcionalmente escribe **aspectos específicos** a enfatizar (ej. "destacar su mejora en debates", "mencionar uso de vocabulario técnico").
4. Solicita la generación. El sistema reúne el contexto del estudiante (nombre, perfil, contemplaciones activas, evolución de calificaciones, observaciones cualitativas recientes) y pide a la IA un texto que respete los lineamientos pedagógicos.
5. El sistema muestra el texto generado, con contador de palabras.
6. El docente puede **editar** el texto manualmente, **regenerar** una nueva versión o **copiar** al portapapeles para pegarlo en el boletín oficial.

### 5.B Generar reporte ejecutivo (por estudiante)
1. El docente abre el generador de reporte para un estudiante.
2. Opcionalmente aplica una **plantilla** (completo, básico, seguimiento, o una propia) que preselecciona secciones y comentarios.
3. Marca/desmarca las **secciones** a incluir: datos básicos, rendimiento académico, contemplaciones, evolución, recomendaciones, síntesis psicopedagógica, alertas/puntos de atención, comentarios.
4. Escribe **comentarios específicos** para esa reunión.
5. Puede **guardar borrador** y **retomarlo** más tarde.
6. Abre la **vista previa** del documento final.
7. **Imprime** o **descarga en PDF**.

### 5.C Generar reporte grupal
1. El docente abre el reporte grupal de un grupo/curso en un período.
2. El sistema calcula y muestra, en pestañas:
   - **Resumen:** cantidad de estudiantes, promedio grupal, cuántos con contemplaciones, cuántos con alertas, y distribución de rendimiento.
   - **Rendimiento:** ranking de estudiantes por promedio, con su tendencia, contemplaciones y alertas.
   - **Perfiles:** distribución de perfiles de aprendizaje del grupo (proporciones).
   - **Alertas:** estudiantes que requieren atención, con el detalle de cada alerta.
3. Puede **exportar el reporte grupal** en PDF, o **exportar reportes individuales en lote** (uno por estudiante) con barra de progreso.

### 5.D Consultar analítica pedagógica
1. El docente abre los tableros de evolución/tendencias/alertas para un estudiante o grupo.
2. Revisa la evolución por materia a lo largo del tiempo, el explicador de tendencias, las alertas predictivas y las metodologías/estrategias sugeridas.
3. Agrega **observaciones de seguimiento** categorizadas para enriquecer el análisis y futuras generaciones de IA.

### 5.E Exportar registro competencial
1. El docente solicita el registro competencial de un grupo/materia en un período.
2. El sistema arma un PDF formal con las competencias trabajadas (y su % de cobertura y contenidos) y las pendientes, más datos del docente/grupo/período.

---

## 6. Flujos alternativos y casos borde

- **Fallo de la IA al generar el boletín:** el sistema debe informar el error y **degradar** entregando igualmente un texto de respaldo (borrador editable), nunca dejar al docente sin salida. Ver sección 10.
- **Sin datos suficientes:** si el estudiante no tiene evolución/calificaciones/observaciones, el contexto que recibe la IA queda con marcadores de "no disponible" y el texto será más genérico. El docente debe poder generar igual y editar.
- **Grupo vacío o de un solo estudiante:** los promedios y distribuciones deben calcularse sin dividir por cero ni romper la vista.
- **Grupo sin alertas:** la pestaña de alertas muestra un estado vacío positivo ("no hay alertas activas").
- **Borrador de reporte inexistente al intentar cargar:** el sistema no debe romper; simplemente no hay nada que cargar.
- **Plantillas por defecto:** no se pueden eliminar (solo duplicar/usar/marcar favorita). Las plantillas propias sí se pueden eliminar.
- **Exportación en lote larga:** debe mostrar progreso y no bloquear al usuario; conviene procesar de a uno con pausas para no saturar el navegador/cliente.
- **Edición manual posterior a la IA:** todo texto generado es un punto de partida; el docente es responsable final y siempre puede editarlo antes de usarlo.

---

## 7. Reglas de negocio

- **R1.** El texto de boletín generado por IA es **siempre editable** por el docente antes de usarse; el sistema nunca lo publica automáticamente.
- **R2.** El texto de boletín debe redactarse **desde las fortalezas** del estudiante y describir las dificultades de forma **constructiva**.
- **R3.** El texto debe centrarse en el **proceso de aprendizaje del estudiante**, no en la acción docente, y redactarse en **tercera persona singular**.
- **R4.** El texto de boletín debe respetar un **límite de extensión** acotado (breve, ~2 párrafos) y un **tono institucional, claro y positivo**, sin saludo ni firma (listo para pegar).
- **R5.** El texto debe **incorporar el contexto real** del estudiante: perfil, contemplaciones activas, evolución de calificaciones y observaciones cualitativas recientes; y respetar los **aspectos específicos** que pida el docente.
- **R6.** El texto debe **alinearse al programa/enfoque de la materia según ANEP** (competencias y ejes de la asignatura correspondiente). ⚠️ Hoy el enfoque está **cableado a Historia de 9º grado**; la reimplementación debe **parametrizar la materia y el nivel** para que el lineamiento aplique a cualquier asignatura.
- **R7.** El reporte ejecutivo tiene **secciones configurables**; solo se incluyen las marcadas por el docente o por la plantilla aplicada.
- **R8.** Las **plantillas por defecto** no pueden eliminarse; las creadas por el docente sí. Toda plantilla puede duplicarse, marcarse favorita y aplicarse.
- **R9.** Los **borradores de reporte** deben poder guardarse y recuperarse por estudiante.
- **R10.** El **promedio grupal** y las **distribuciones** (rendimiento, perfiles) se derivan de las calificaciones/perfiles reales de los estudiantes del grupo.
- **R11.** La **clasificación de rendimiento** por bandas debe ser explícita y consistente: Excelente (9–10), Muy Bueno (8–8,9), Bueno (7–7,9), Regular (6–6,9), Necesita Apoyo (<6). ⚠️ Verificar/parametrizar estas bandas contra la escala oficial ANEP en la reimplementación.
- **R12.** Un estudiante se considera **con alerta** si tiene una o más alertas activas asociadas; el reporte grupal cuenta y lista a estos estudiantes.
- **R13.** Las **alertas y tendencias** deben calcularse a partir del historial real de desempeño (patrones descendentes, fluctuantes, etc.), no de valores fijos. ⚠️ Hoy son demo.
- **R14.** Las **observaciones de seguimiento** del docente se categorizan (académica, comportamental, social, familiar, emocional) y sirven como insumo para la IA y para los reportes.
- **R15.** El **registro competencial** debe reflejar las competencias efectivamente trabajadas en el período (con % de cobertura y contenidos) y las pendientes, e identificar docente, grupo, materia y período.
- **R16.** Los documentos exportables (reportes, registro competencial) son de **uso pedagógico/seguimiento** y deben quedar claramente fechados y atribuidos.

---

## 8. Estados y ciclo de vida

**Texto de boletín:**
```
(vacío) → generando → generado → [editado manualmente] → copiado/usado
                         └→ regenerado (nueva versión, reemplaza al anterior)
   error de IA ─────────→ texto de respaldo (editable)
```

**Reporte ejecutivo:**
```
configuración (secciones + comentarios) ⇄ borrador guardado
        ↓
   vista previa → impreso / exportado a PDF
```

**Plantilla de reporte:**
```
por defecto (no eliminable)  ─ duplicar → propia (eliminable)
cualquier plantilla ⇄ favorita (marcar/desmarcar)
```

---

## 9. Información que maneja el flujo

**Insumos (deben venir de datos reales):**
- Identidad y perfil del estudiante (nombre, perfil de aprendizaje).
- Grupo/curso, docente, materia y período.
- Calificaciones/evaluaciones por materia y período (historial para evolución y promedios).
- Contemplaciones/adaptaciones activas del estudiante.
- Observaciones cualitativas (del docente y/o equipo psicopedagógico), con fecha, área/categoría y autor.
- Síntesis/informe técnico psicopedagógico (opcional, si existe).

**Datos que el sistema deriva/calcula:**
- Promedio general del estudiante y su variación vs. período anterior.
- Mejor materia y materia de foco/riesgo.
- Promedio grupal, distribución por bandas de rendimiento, distribución de perfiles.
- Ranking de estudiantes por promedio y su tendencia.
- Conteo de estudiantes con contemplaciones y con alertas.
- Tendencia por materia (dirección, magnitud de cambio, período analizado).
- Cobertura competencial (% trabajado, competencias pendientes).

**Datos que el sistema produce/muestra:**
- Texto de boletín (IA).
- Reporte ejecutivo (PDF/impresión) y reporte grupal (PDF).
- Reportes individuales en lote.
- Registro competencial (PDF).
- Observaciones de seguimiento guardadas.

> ⚠️ Demo hoy: promedios, evoluciones por trimestre, "mejor materia"/"área de foco", tendencias, alertas, recordatorios, factores influyentes, predicciones a 3 meses, comparativas (promedio de grupo/nacional, "casos similares"), fortalezas/áreas de trabajo del reporte, docente/curso/período del encabezado del reporte ejecutivo. Todo esto son valores fijos de demostración; en la reimplementación deben computarse desde datos reales o eliminarse si no hay fuente.

---

## 10. Interacción con IA

Este flujo usa IA de forma central para el **texto de boletín**. (La analítica muestra textos "explicativos" y "recomendaciones" que **hoy son demo**; ver ⚠️ al final.)

### Texto de boletín (IA)

- **Objetivo:** producir un **texto descriptivo del desempeño** de un estudiante en una materia y período, redactado en tono institucional para incluir en el boletín dirigido a la familia. Ahorra tiempo de redacción y eleva la calidad/consistencia pedagógica del lenguaje.

- **Contexto que recibe (insumo conceptual):**
  - Nombre del estudiante y su **perfil de aprendizaje**.
  - **Materia** y **período** de referencia.
  - **Contemplaciones/adaptaciones** efectivamente aplicadas.
  - **Evolución académica reciente** en la materia (resumen del historial de calificaciones/progreso).
  - **Comentarios/observaciones cualitativas** recientes sobre el desempeño (se limita a los más recientes).
  - **Aspectos específicos** que el docente pida enfatizar (texto libre, opcional).
  - **Lineamiento pedagógico de la materia según ANEP** (competencias y enfoque de la asignatura y nivel). ⚠️ Actualmente fijado a Historia 9º; parametrizar por materia/nivel.

- **Resultado esperado:** un texto breve (≈2 párrafos, extensión acotada), en tercera persona singular, tono institucional-positivo, sin saludo ni firma, **listo para pegar** en el boletín. Se muestra editable y con contador de palabras.

- **Reglas que la IA debe respetar:**
  1. Redactar **desde las fortalezas**; describir dificultades de forma **constructiva**.
  2. Centrarse en el **proceso del estudiante**, no en la acción docente.
  3. Basarse en **observaciones concretas** del contexto provisto; no inventar hechos.
  4. **Respetar las contemplaciones** activas y mencionarlas cuando corresponda como apoyos aplicados.
  5. Ceñirse a las **competencias y el enfoque de la materia** según el programa ANEP correspondiente.
  6. Respetar el **límite de extensión** y el **formato** (sin saludo/firma).
  7. Incorporar los **aspectos específicos** solicitados por el docente.

- **Comportamiento ante fallos:** si la generación falla, el sistema debe **informar el error** y, para no bloquear al docente, entregar un **texto de respaldo editable** como borrador. El docente puede **regenerar** cuando quiera. Toda salida es editable manualmente antes de usarse.

> ⚠️ **Analítica "con IA" que hoy es demo:** las explicaciones detalladas de tendencias, factores influyentes, predicciones a 3 meses, sugerencias reflexivas de las alertas predictivas y las metodologías/estrategias sugeridas se presentan como si fueran análisis inteligente, pero **hoy son textos fijos de demostración**. La intención de negocio: la reimplementación debería, a partir del historial real, (a) detectar la tendencia real por materia, (b) explicar el patrón y proponer acciones (candidato natural a generación con IA usando datos reales + observaciones del docente), y (c) marcar estudiantes en riesgo. No deben mostrarse como reales hasta estar respaldadas por datos.

---

## 11. Criterios de aceptación

- [ ] El sistema debe generar un texto de boletín editable a partir del contexto real del estudiante (perfil, contemplaciones, evolución, observaciones) y del período y aspectos elegidos por el docente.
- [ ] El texto debe respetar tono institucional, foco en fortalezas, tercera persona y extensión acotada, sin saludo ni firma.
- [ ] El lineamiento pedagógico debe seleccionarse según la **materia y nivel** del estudiante (no fijo a una materia).
- [ ] Ante fallo de IA, el sistema debe mostrar el error y entregar un texto de respaldo editable, permitiendo regenerar.
- [ ] El docente debe poder copiar, editar y regenerar el texto.
- [ ] El reporte ejecutivo debe permitir seleccionar secciones, aplicar plantillas, escribir comentarios, guardar/cargar borrador, previsualizar, imprimir y exportar a PDF.
- [ ] Las plantillas por defecto no deben poder eliminarse; las propias sí; todas deben poder duplicarse y marcarse favoritas.
- [ ] El reporte grupal debe calcular promedio grupal, distribución de rendimiento por bandas, distribución de perfiles, ranking y conteos de contemplaciones/alertas **a partir de datos reales**.
- [ ] El reporte grupal debe permitir exportar el consolidado y los reportes individuales en lote con indicador de progreso.
- [ ] La analítica (evolución, tendencias, alertas) debe derivarse de calificaciones/evaluaciones reales; ninguna métrica de demostración debe presentarse como real.
- [ ] El docente debe poder registrar observaciones de seguimiento categorizadas y que estas alimenten la generación de IA y los reportes.
- [ ] El registro competencial debe exportarse en PDF con docente, grupo, materia, período, competencias trabajadas (% y contenidos) y competencias pendientes, fechado y atribuido.
- [ ] Todos los cálculos deben manejar casos borde (grupo vacío, un solo estudiante, sin historial) sin errores.

---

## 12. Enlaces con otros flujos

- **Autenticación, roles y navegación:** define el docente autenticado que consume y firma los reportes.
- **Gestión de estudiantes y grupos:** provee estudiantes, grupos y perfiles de aprendizaje que se agregan y reportan aquí.
- **Evaluaciones y calificaciones:** fuente real de promedios, evolución, tendencias, distribución y bandas de rendimiento.
- **Contemplaciones/adaptaciones:** se citan en boletines y reportes; su efectividad es materia de alertas de seguimiento.
- **Planificación / competencias curriculares:** origen de las competencias trabajadas y pendientes del registro competencial.
- **Informe/síntesis psicopedagógica:** puede incluirse como sección del reporte ejecutivo.
