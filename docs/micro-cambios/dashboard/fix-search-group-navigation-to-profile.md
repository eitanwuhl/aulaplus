# Navegación de grupo desde búsqueda global: ir al perfil del grupo

## Objetivo

Corregir la UX de la búsqueda global: al seleccionar un grupo, el usuario debe ir a la **vista de perfil del grupo** (TeacherGroups), no a la pantalla de configuración de evaluación.

## Archivos modificados

- **`src/components/dashboard/GlobalSearch.tsx`**  
  La selección de grupo navega a `/teacher-groups` con `state: { groupId }`. Se deja de usar `/evaluaciones/nuevo?grupo=...`.

- **`src/components/dashboard/NotificationsPanel.tsx`**  
  El clic en una notificación asociada a un grupo navega a `/teacher-groups` con `state: { groupId }`, alineado con la búsqueda global.

- **`src/pages/TeacherGroups.tsx`**  
  - Se mantiene el manejo de `location.state.groupId`: si existe y el grupo está en `mockGroups`, se abre la vista de perfil del grupo.  
  - Si llega `groupId` en el state pero no existe ese grupo en los datos, se muestra un mensaje amigable (“Grupo no encontrado”) y se permanece en la lista de grupos.  
  - Se añade estado `invalidDeepLinkGroupId` y un `Alert` desplegable con botón “Cerrar” para ese caso.

## Rutas finales

| Origen                    | Destino estudiante | Destino grupo      |
|---------------------------|--------------------|--------------------|
| Búsqueda global           | `/teacher-groups` con `state: { studentId }` | `/teacher-groups` con `state: { groupId }` |
| Panel de notificaciones   | `/teacher-groups` con `state: { studentId }` | `/teacher-groups` con `state: { groupId }`  |

No se usa `/evaluaciones/nuevo` para la selección de grupo desde búsqueda ni desde notificaciones.

## Cómo TeacherGroups usa el deep-link por grupo

- **Entrada:** Al navegar a `/teacher-groups`, TeacherGroups lee `location.state` (React Router).
- **Si existe `state.groupId`:** Busca el grupo en `mockGroups` por `g.id === state.groupId`.
  - **Encontrado:** Asigna `selectedGroup`, pone `viewingGroupProfile = true` y renderiza `GroupProfile` (misma vista que al hacer clic en un grupo en la lista).
  - **No encontrado:** Pone `invalidDeepLinkGroupId = state.groupId`, muestra el Alert “Grupo no encontrado” y deja la lista de grupos visible; el usuario puede cerrar el mensaje.
- **Si existe `state.studentId`:** Sigue el flujo ya existente (buscar estudiante, abrir grupo + perfil del estudiante). No se modificó.

La lógica de deep-link está en un `useEffect` que depende de `location.state`.

## Checklist de prueba manual

1. **Búsqueda global – grupo**  
   Buscar un grupo por nombre, seleccionarlo. Comprobar que se abre la vista de perfil del grupo en `/teacher-groups` (misma vista que al elegir el grupo en la lista).

2. **Búsqueda global – estudiante**  
   Buscar un estudiante y seleccionarlo. Comprobar que se abre el perfil del estudiante en `/teacher-groups` (sin cambios).

3. **Notificaciones – grupo**  
   Clic en una notificación que tenga `groupId`. Comprobar que se navega a `/teacher-groups` y se abre el perfil de ese grupo.

4. **Notificaciones – estudiante**  
   Clic en una notificación que tenga `studentId`. Comprobar que se abre el perfil del estudiante (sin cambios).

5. **groupId inválido**  
   Navegar a `/teacher-groups` con `state: { groupId: "id-inexistente" }` (por ejemplo desde consola o enlace temporal). Comprobar que se muestra el mensaje “Grupo no encontrado” y la lista de grupos, y que “Cerrar” oculta el mensaje.

6. **Consistencia**  
   Confirmar que tanto búsqueda global como notificaciones llevan al mismo flujo de perfil de grupo en TeacherGroups.
