# Flujo 12 — Portal del estudiante (diagnóstico y notificaciones)

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Baja · **Depende de:** flujo 01 (autenticación y roles), flujo 02 (perfil de aprendizaje del estudiante)

## 1. Propósito

Ofrecer al **estudiante** una experiencia propia y liviana, separada de la del docente, cuyo eje es un **diagnóstico de estilo de aprendizaje** que el propio estudiante completa. El objetivo de negocio es doble:

1. Que el estudiante se autoconozca (qué modalidades le resultan más cómodas para aprender).
2. Que ese resultado alimente el **perfil de aprendizaje** del estudiante que el docente usa para personalizar planificaciones, evaluaciones, contemplaciones y para entender la diversidad de su grupo (flujo 02).

De forma complementaria, el portal contempla mostrar al estudiante (o al docente sobre ese estudiante) **notificaciones institucionales** y **recursos pedagógicos** contextualizados a su perfil.

> ⚠️ **Estado general mayormente demostrativo.** Hoy el diagnóstico calcula el perfil pero NO lo persiste ni lo envía al perfil del estudiante; las notificaciones y los recursos son contenidos fijos de ejemplo. La lógica del cálculo del perfil sí es real. El detalle está marcado en cada sección.

## 2. Actores y roles

| Actor | Rol en este flujo |
|---|---|
| **Estudiante** | Ingresa con su acceso, responde el cuestionario de diagnóstico y ve su resultado. |
| **Docente** | Consumidor final del perfil resultante: lo usa para adaptar su enseñanza (fuera de este flujo, ver flujo 02). |
| **Sistema** | Presenta el cuestionario, calcula el estilo predominante y arma el perfil de aprendizaje. |
| **Equipo psicopedagógico / Dirección** | Emisores lógicos de las notificaciones y recursos que se muestran sobre el estudiante. |

## 3. Glosario del dominio

| Término | Significado |
|---|---|
| **Diagnóstico de aprendizaje** | Cuestionario breve que el estudiante responde para identificar cómo aprende mejor. |
| **Estilo de aprendizaje** | Modalidad preferida de aprendizaje. Se manejan cuatro: **Visual**, **Auditivo**, **Lector/Escritor** y **Kinestésico**. |
| **Estilo predominante** | Estilo (o combinación de estilos) que más veces surge en las respuestas del estudiante. |
| **Perfil de aprendizaje** | Síntesis del estudiante: estilo predominante + distribución porcentual entre los cuatro estilos. Es el insumo que usa el docente (flujo 02). |
| **Diversidad del grupo** | Cantidad de estilos distintos presentes en un grupo; condiciona qué recursos se recomiendan. |
| **Contemplación / adecuación** | Ajuste pedagógico para un estudiante (mencionado en las notificaciones; su definición completa vive en otros flujos). |

## 4. Precondiciones y dependencias

1. El estudiante debe poder ingresar con su acceso de estudiante (flujo 01). El ingreso ocurre por un rol distinto al del docente y lo lleva directamente al diagnóstico.

   > ⚠️ **Acceso demostrativo.** Hoy el ingreso del estudiante acepta cualquier código y contraseña (siempre tiene éxito, sin validación). **Intención:** que cada estudiante tenga credenciales reales (por ejemplo, un código de estudiante provisto por el centro) y quede vinculado a su grupo y a su docente.

2. Para que el resultado sea útil, el estudiante debe pertenecer a un grupo gestionado por un docente, de modo que su perfil alimente el contexto del grupo (flujo 02).

## 5. Flujo principal (happy path)

1. El estudiante elige el rol "Alumno" e ingresa con su código y contraseña.
2. El sistema lo lleva directamente al **diagnóstico**.
3. Se presenta un cuestionario de **10 preguntas de opción única**, una por pantalla, con indicador de progreso ("pregunta X de 10", % completo).
4. Cada pregunta ofrece cuatro respuestas, cada una alineada a uno de los cuatro estilos (Visual, Auditivo, Lector/Escritor, Kinestésico).
5. El estudiante puede avanzar y retroceder entre preguntas; no puede avanzar sin haber respondido la pregunta actual.
6. Al responder la última pregunta y finalizar, el sistema **calcula el perfil**:
   - Cuenta cuántas respuestas cayeron en cada estilo.
   - Determina el/los estilo(s) predominante(s) (ver reglas R3–R4).
   - Arma la distribución porcentual entre los cuatro estilos.
7. Se muestra la **pantalla de resultados** con: el estilo predominante (o combinación), una descripción de qué significa, y una barra de porcentaje por cada uno de los cuatro estilos.
8. El estudiante puede volver al inicio (lo que cierra su sesión).

## 6. Flujos alternativos y casos borde

- **Sin estilo claramente predominante:** si ningún estilo supera el umbral, el sistema toma los dos estilos con más respuestas y presenta el perfil como combinación (ej. "Visual-Kinestésico").
- **Empates:** varios estilos pueden quedar como predominantes y se listan ordenados de mayor a menor cantidad de respuestas.
- **Navegación hacia atrás:** el estudiante puede corregir respuestas previas antes de finalizar; el cálculo usa las respuestas finales.
- **Salir a mitad del diagnóstico:** volver al inicio cierra la sesión; el progreso no se conserva.

> ⚠️ **"Ver resultados detallados" no muestra un detalle adicional.** En la pantalla de resultados hay un botón que promete un detalle ampliado, pero hoy solo devuelve al inicio. **Intención:** que exista una vista ampliada (por ejemplo, recomendaciones personalizadas por estilo).

> ⚠️ **El resultado no se guarda.** Al finalizar, el perfil calculado se muestra pero no se persiste ni se envía al perfil del estudiante ni al contexto del grupo del docente. **Intención de negocio central:** que este resultado se almacene y pase a ser el perfil de aprendizaje real del estudiante, disponible para el docente (flujo 02).

## 7. Reglas de negocio

- **R1.** El diagnóstico consta de 10 preguntas, cada una con exactamente 4 opciones, una por cada estilo de aprendizaje.
- **R2.** No se puede avanzar de una pregunta sin haberla respondido.
- **R3.** El estilo se considera **predominante** si acumula al menos el 25% de las respuestas contestadas (umbral redondeado hacia arriba sobre el total respondido).
- **R4.** Si ningún estilo alcanza el umbral, el perfil se compone con los **dos** estilos de mayor conteo.
- **R5.** Los estilos predominantes se ordenan de mayor a menor cantidad de respuestas y se expresan como una combinación (ej. "Visual-Auditivo").
- **R6.** La distribución porcentual se calcula sobre el total de respuestas contestadas y debe sumar coherentemente el 100% (con redondeo por estilo).
- **R7.** El perfil resultante incluye siempre: identificación del estudiante, estilo(s) predominante(s) y desglose por los cuatro estilos.
- **R8.** El diagnóstico es autoadministrado por el estudiante; no requiere intervención del docente para completarse.

## 8. Estados y ciclo de vida

**Del diagnóstico (por sesión del estudiante):**

```
en curso (respondiendo)  →  completado (resultado calculado)
```

**Del perfil de aprendizaje (intención de negocio, ver flujo 02):**

```
sin diagnóstico  →  diagnosticado (perfil vigente)  →  rediagnosticado (perfil actualizado)
```

> ⚠️ **Supuesto:** hoy solo existe la transición "en curso → completado" en memoria de la pantalla. La persistencia del perfil y la posibilidad de rehacer el diagnóstico para actualizarlo son intención de negocio, no implementación actual.

## 9. Información que maneja el flujo

**Se captura del estudiante:**
- Una respuesta por cada una de las 10 preguntas (cada respuesta mapea a un estilo).

**Se deriva/calcula:**
- Conteo de respuestas por estilo.
- Estilo(s) predominante(s).
- Distribución porcentual entre los cuatro estilos.
- Etiqueta de perfil (estilo o combinación) con su descripción asociada.

**Se muestra al estudiante:**
- Progreso durante el cuestionario.
- Perfil resultante: estilo predominante, descripción de qué implica y barras de porcentaje por estilo.
- Un mensaje explicando que el perfil servirá para personalizar evaluaciones y contenidos.

**Notificaciones sobre el estudiante** ⚠️ (demostrativas, ver sección 10-bis):
- Título, tipo/prioridad (informativa o urgente), mensaje, antigüedad y estado leído/no leído.

**Recursos pedagógicos** ⚠️ (demostrativos):
- Título, tipo, descripción, materias asociadas, duración estimada, cantidad de recursos incluidos y, en algunos casos, quién los subió.

## 10. Interacción con IA

> **No aplica.** El diagnóstico y el cálculo del perfil son deterministas (conteo y umbral), sin IA. Las notificaciones y recursos que se muestran tampoco se generan con IA (son contenidos fijos de ejemplo).

### 10-bis. Notificaciones y recursos que se le muestran (detalle y estado)

**Notificaciones sobre el estudiante** ⚠️ **(mock).**
- **Qué representan:** avisos institucionales asociados a un estudiante, provenientes del Equipo psicopedagógico o de Dirección. Ejemplos que trae el ejemplo: actualización del informe psicopedagógico, indicación de ubicación en el aula por una condición de salud, aviso de viaje que suspende inasistencias y evaluaciones en un período, actualización de contemplaciones sugeridas.
- **Comportamiento real:** el estudiante/docente puede marcar cada notificación como leída (la quita del listado) o marcar todas como leídas. Hay tipos con distinta prioridad visual (urgente vs. informativa).
- **Estado:** el contenido está fijo en el código y no proviene de datos reales. **Intención de negocio:** que estas notificaciones se generen a partir de comunicaciones reales del Equipo psicopedagógico/Dirección (relacionado con el flujo 11) y de cambios reales en el perfil y las contemplaciones del estudiante.

**Recursos pedagógicos contextualizados** ⚠️ **(mock).**
- **Qué representan:** un banco de recursos y estrategias sugeridas según el **perfil dominante** del estudiante y la **diversidad del grupo**; incluye recursos por cada estilo (Visual, Auditivo, Kinestésico, Lector/Escritor), recursos **multimodales** cuando el grupo tiene alta diversidad de estilos, y materiales presentados como "subidos por el equipo psicopedagógico".
- **Lógica de selección declarada:** si el grupo presenta 3 o más estilos distintos, se priorizan recursos multimodales; en caso contrario, se muestran los recursos del perfil dominante.
- **Estado:** todos los recursos, sus autores y fechas están fijos en el código; los botones de descarga no descargan nada real. **Intención de negocio:** que sea un repositorio real, alimentado por el equipo psicopedagógico y filtrado automáticamente por el perfil del estudiante y la composición del grupo.

## 11. Criterios de aceptación

- [ ] El sistema debe presentar 10 preguntas de opción única, con 4 opciones mapeadas a los cuatro estilos, una pregunta por vez y con indicador de progreso.
- [ ] El sistema debe impedir avanzar sin responder la pregunta actual y permitir volver a preguntas anteriores.
- [ ] El sistema debe calcular el/los estilo(s) predominante(s) según el umbral del 25% y, si nadie lo alcanza, tomar los dos de mayor conteo.
- [ ] El sistema debe mostrar el perfil con estilo predominante, descripción y desglose porcentual por los cuatro estilos.
- [ ] El sistema debe **persistir** el perfil resultante y asociarlo al estudiante, dejándolo disponible para el docente (flujo 02).
- [ ] El sistema debe permitir rehacer el diagnóstico para actualizar el perfil.
- [ ] El sistema debe autenticar al estudiante con credenciales reales asociadas a su grupo (no aceptar cualquier valor).
- [ ] El sistema debe mostrar notificaciones reales relativas al estudiante, con estado leído/no leído y prioridad.
- [ ] El sistema debe recomendar recursos filtrados por el perfil del estudiante y la diversidad del grupo, provenientes de un repositorio real.

## 12. Enlaces con otros flujos

- **Flujo 01 (autenticación y roles):** define el acceso del estudiante como rol separado del docente y lo dirige al diagnóstico.
- **Flujo 02 (perfil de aprendizaje del estudiante):** consumidor directo del resultado; el perfil calculado aquí debe alimentar el perfil real que el docente usa para adaptar su enseñanza y entender la diversidad del grupo.
- **Flujo 11 (comunicaciones):** las notificaciones sobre el estudiante representan la contraparte de las comunicaciones institucionales; a futuro deberían derivar de esos mensajes y de cambios en contemplaciones.
