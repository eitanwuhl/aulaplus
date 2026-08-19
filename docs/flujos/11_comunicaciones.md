# Flujo 11 — Comunicaciones

> **Documentación funcional de AulaPlus** · Prompt de reimplementación (React + Laravel + PostgreSQL).
> Describe QUÉ hace el sistema y POR QUÉ. No prescribe implementación.
> **Importancia:** Baja · **Depende de:** flujo 01 (autenticación y roles)

## 1. Propósito

Dar al docente un canal simple y trazable para enviar mensajes escritos, con adjuntos, hacia dos referentes institucionales del centro educativo:

- **Dirección** (equipo directivo).
- **Equipo psicopedagógico**.

El objetivo de negocio es que consultas, avisos o pedidos de apoyo (por ejemplo, dificultades de un estudiante, solicitud de contemplaciones, coordinación de adecuaciones) queden registrados y no se pierdan en canales informales. La sección también conserva un **historial** de lo enviado, para que el docente tenga memoria de sus comunicaciones.

> ⚠️ **Alcance real acotado.** En el estado actual la comunicación es **unidireccional del docente hacia Dirección o Equipo psicopedagógico**. NO existe envío hacia estudiantes ni hacia familias, ni recepción de respuestas dentro de la app (no hay bandeja de entrada ni hilos de conversación). La intención de negocio a futuro puede ampliar destinatarios y habilitar respuestas, pero eso no está implementado.

## 2. Actores y roles

| Actor | Rol en este flujo |
|---|---|
| **Docente** | Único emisor. Redacta asunto y mensaje, adjunta archivos y envía. Consulta su historial. |
| **Dirección / Equipo psicopedagógico** | Destinatarios lógicos del mensaje. Reciben la comunicación fuera de la app (no consumen la app en este flujo). |
| **Sistema** | Persiste el mensaje, gestiona los adjuntos y devuelve el historial ordenado. |
| **IA** | No participa en la redacción de comunicaciones (ver sección 10). |

## 3. Glosario del dominio

| Término | Significado |
|---|---|
| **Comunicación** | Mensaje escrito enviado por el docente a un referente institucional, con asunto, cuerpo y adjuntos opcionales. |
| **Destinatario / rol destino** | A quién va dirigida la comunicación: Dirección o Equipo psicopedagógico. |
| **Adjunto** | Archivo que acompaña el mensaje (por ejemplo, un informe, una foto, un documento de apoyo). |
| **Estado de la comunicación** | Indicador del ciclo de vida del mensaje (ver sección 8). |
| **Historial** | Listado de comunicaciones previas, filtrado por destinatario. |

## 4. Precondiciones y dependencias

1. El docente debe estar autenticado en su rol (flujo 01).
2. Las comunicaciones enviadas quedan asociadas al docente autor.
3. No requiere haber creado planificaciones, grupos ni evaluaciones: es una utilidad transversal, accesible en todo momento.

## 5. Flujo principal (happy path)

1. El docente abre la sección de Comunicaciones (desde el menú o mediante el **botón flotante de acceso rápido**, ver sección 6).
2. Elige el destinatario: **Dirección** o **Equipo psicopedagógico**. Al cambiar de destinatario, el sistema muestra su información de contacto de referencia y filtra el historial correspondiente.
3. Completa el **asunto** (obligatorio).
4. Escribe el **mensaje** (obligatorio).
5. Opcionalmente selecciona uno o varios **archivos adjuntos**; el sistema muestra cuántos quedaron seleccionados.
6. Presiona "Enviar".
7. El sistema valida que asunto y mensaje no estén vacíos, sube los adjuntos, registra la comunicación asociada al docente y al destinatario elegido, y confirma con un aviso de éxito.
8. El formulario se limpia y la nueva comunicación aparece al tope del **historial** del destinatario seleccionado.

## 6. Flujos alternativos y casos borde

- **Acceso rápido (botón flotante):** en pantallas del docente existe un botón flotante persistente que lleva directamente a la sección de Comunicaciones. Es solo un atajo de navegación; no precarga destinatario ni contenido.
- **Validación de campos vacíos:** si falta el asunto o el mensaje, el sistema no envía y muestra un aviso indicando que ambos son obligatorios. Los adjuntos son opcionales.
- **Error al enviar:** si falla la subida de adjuntos o el registro, el sistema muestra un aviso de error y no limpia el formulario, para que el docente pueda reintentar sin reescribir.
- **Historial vacío:** si no hay comunicaciones previas con el destinatario seleccionado, se muestra un estado vacío explícito ("no hay comunicaciones previas con …").
- **Consulta de adjuntos:** desde cada comunicación del historial, el docente puede abrir/descargar los archivos adjuntos asociados.

> ⚠️ **Información de contacto demostrativa.** Los datos de contacto que se muestran para cada destinatario (nombre del referente, teléfono, correo) están fijos en el código y NO corresponden a datos reales del centro. La intención de negocio es que esa información provenga de la configuración institucional del centro donde trabaja el docente.

## 7. Reglas de negocio

- **R1.** Toda comunicación debe tener un destinatario, que solo puede ser Dirección o Equipo psicopedagógico.
- **R2.** El asunto y el mensaje son obligatorios; no se permite enviar con alguno vacío.
- **R3.** Los adjuntos son opcionales y pueden ser múltiples.
- **R4.** Cada comunicación queda asociada al docente que la envió y al destinatario elegido.
- **R5.** El historial que ve el docente se filtra por el destinatario actualmente seleccionado.
- **R6.** El historial se ordena de la comunicación más reciente a la más antigua.
- **R7.** Cada comunicación registra su fecha y hora de creación y un estado.
- **R8.** Al enviar con éxito, el formulario se reinicia y el historial se actualiza sin recargar la pantalla.
- **R9.** Ante error de envío, no se debe perder el contenido escrito por el docente.

## 8. Estados y ciclo de vida

Cada comunicación lleva un **estado** que refleja su tratamiento por el destinatario. El estado se muestra en el historial.

```
enviada  →  (leída / en proceso)  →  respondida / resuelta / archivada
```

> ⚠️ **Supuesto:** hoy el estado se registra y se muestra, pero no existe en la app un mecanismo para que Dirección o el Equipo psicopedagógico avancen ese estado (no hay bandeja del destinatario). La intención de negocio es que el destinatario pueda marcar la comunicación como leída/en proceso/resuelta y, eventualmente, responder.

## 9. Información que maneja el flujo

**Se captura del docente:**
- Destinatario (Dirección o Equipo psicopedagógico).
- Asunto.
- Cuerpo del mensaje.
- Archivos adjuntos (cero o varios).

**Se deriva/registra automáticamente:**
- Autor (docente autenticado).
- Fecha y hora de envío.
- Estado inicial de la comunicación.
- Referencias a los adjuntos subidos, para poder descargarlos luego.

**Se muestra:**
- Información de contacto de referencia del destinatario seleccionado ⚠️ (demostrativa).
- Historial filtrado por destinatario, con asunto, mensaje, estado, fecha y botones para abrir adjuntos.

## 10. Interacción con IA

> ⚠️ **No hay IA para redactar comunicaciones.** El envío de comunicaciones no usa IA en ningún punto: el docente escribe manualmente asunto y mensaje. No existe generación asistida de borradores, sugerencia de tono ni resúmenes.

**Aclaración importante sobre una función parecida pero distinta:** en la app existe un módulo demostrativo de **"sugerencias colaborativas de IA"** que NO pertenece a este flujo de comunicaciones. Ese módulo aparece asociado al **perfil de un estudiante** (no al canal con Dirección/Psicopedagogía) y su objetivo es acompañar la reflexión pedagógica del docente, no redactar mensajes.

Documentado por completitud, ese módulo:
- **Objetivo declarado:** a partir de observaciones del docente sobre un estudiante, ofrecer preguntas reflexivas, sugerencias prácticas y "conexiones pedagógicas" para explorar cómo potenciar su aprendizaje.
- **Contexto que dice recibir:** observaciones del docente sobre concentración, preferencias sociales y preferencias de aprendizaje del estudiante.
- **Resultado que muestra:** tarjetas clasificadas como "pregunta reflexiva", "sugerencia práctica" o "conexión pedagógica", cada una con un texto y una nota de contexto; el docente puede responder "sí, me parece útil" / "no aplicable" / "necesito más información".

> ⚠️ **Totalmente demostrativo (mock).** Las sugerencias están escritas fijas en el código; NO se generan a partir de datos reales del estudiante ni de un modelo de IA. Las respuestas del docente se guardan solo en memoria de la pantalla y se pierden al salir; no alimentan ningún perfil ni se envían a ningún lado. **Intención de negocio:** que estas sugerencias se generen realmente con IA tomando el perfil de aprendizaje del estudiante (flujo 12) y las observaciones registradas, y que las respuestas del docente retroalimenten ese perfil.
- **Comportamiento ante fallos:** no aplica hoy (no hay llamada real a IA).

## 11. Criterios de aceptación

- [ ] El sistema debe permitir al docente elegir entre Dirección y Equipo psicopedagógico como destinatario.
- [ ] El sistema debe impedir el envío si el asunto o el mensaje están vacíos, informándolo.
- [ ] El sistema debe permitir adjuntar cero o varios archivos y luego descargarlos desde el historial.
- [ ] El sistema debe asociar cada comunicación al docente autor, al destinatario, a una fecha/hora y a un estado.
- [ ] El sistema debe mostrar el historial filtrado por destinatario y ordenado de más reciente a más antiguo.
- [ ] El sistema debe confirmar el envío exitoso, limpiar el formulario y refrescar el historial sin recargar.
- [ ] El sistema debe conservar lo escrito si el envío falla.
- [ ] El sistema debe ofrecer un acceso rápido (botón flotante) a la sección desde las pantallas del docente.
- [ ] El sistema debe mostrar información de contacto del destinatario proveniente de la configuración institucional (no fija en código).

## 12. Enlaces con otros flujos

- **Flujo 01 (autenticación y roles):** determina que el emisor es un docente autenticado y de él dependen la autoría y el acceso a la sección.
- **Flujo 12 (portal del estudiante):** comparte el objetivo de negocio de conectar al docente con el equipo psicopedagógico; la intención futura de "sugerencias colaborativas de IA" se apoyaría en el perfil de aprendizaje del estudiante definido allí.
