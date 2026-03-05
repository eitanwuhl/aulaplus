# Pulido: Notificaciones y búsqueda global (dashboard)

## Cambios realizados

### 1. Copia del panel de notificaciones

- **Título:** El panel muestra siempre el título **"Notificaciones"** (se eliminó "Notificaciones Importantes").
- **Conteo de no leídas:** Si hay notificaciones sin leer, se muestra un badge junto al título con el texto **"X nuevas"** (por ejemplo, "3 nuevas"). El título sigue siendo solo "Notificaciones".

### 2. Navegación desde notificaciones y búsqueda global

- **Grupos:** Tanto al hacer clic en una notificación de grupo como al elegir un grupo en la búsqueda global, se usa la misma convención: **`/evaluaciones/nuevo?grupo=<groupId>`**.
- **Estudiantes:** Se mantiene la navegación a **`/teacher-groups`** con `state: { studentId }` (sin cambios).

## Checklist de prueba manual

1. **Título y badge**
   - Abrir el dashboard y comprobar que el panel de notificaciones tiene el título "Notificaciones".
   - Comprobar que, si hay notificaciones no leídas, aparece un badge tipo "X nuevas" junto al título.
   - Marcar todas como leídas y comprobar que el badge desaparece; el título sigue siendo "Notificaciones".

2. **Navegación desde notificaciones**
   - Clic en una notificación asociada a un estudiante: debe ir a `/teacher-groups` y abrir el perfil de ese estudiante.
   - Clic en una notificación asociada a un grupo: debe ir a `/evaluaciones/nuevo?grupo=<id>` (p. ej. `?grupo=1`).

3. **Navegación desde búsqueda global**
   - Buscar un estudiante y seleccionarlo: debe ir a `/teacher-groups` con el estudiante seleccionado.
   - Buscar un grupo y seleccionarlo: debe ir a `/evaluaciones/nuevo?grupo=<id>`.

4. **Consistencia**
   - Confirmar que grupo desde notificaciones y grupo desde búsqueda llevan a la misma URL de creación de evaluación con el mismo `grupo`.
