# Mis Grupos (datos en Postgres)

## Modelo de datos

| Capa | Tabla / origen |
|------|----------------|
| Grupos del docente | `public.grupos` (`user_id` = auth, `id` = `school_groups.id`) |
| Alumnos (catálogo) | `public.school_students` (`display_name`, `perfil`, `school_group_id`) |
| Perfil extendido | `school_students.profile_data` (jsonb), poblado por seed |

## Sin mocks en runtime

El flujo **Mis Grupos** no usa `mockGroups` / `mockStudents` en memoria. Los tipos de dominio están en `src/types/schoolCatalog.ts` (`TeacherGroup`, `SchoolStudent`).

Cada alumno expone `hasSeededProfile`:

- **`true`**: hay filas en `profile_data` → perfil completo (`StudentProfile`).
- **`false`**: solo catálogo → pantalla `StudentProfileIncomplete` + empty state.

Las tarjetas de grupo muestran **«Sin datos»** en el promedio si ningún alumno tiene `progreso` seedeado.

## Seeds (remoto)

```bash
npx supabase db push
npm run seed:demo
```

`seed:demo` = login + catálogo + **perfiles** (`seed:student-profiles`) + asignación docente↔grupo.

## Front

- Servicio: `src/services/teacherGroups/`
- Hook: `useTeacherGroups`
- Página: `src/pages/TeacherGroups.tsx`
- Empty states: `src/components/teacherGroups/CatalogEmptyState.tsx`
- Notificaciones → `teacherGroupsNavState()` con `returnTo: '/teacher-dashboard'`

## Otras pantallas

Evaluaciones, planificación y búsqueda global pueden seguir usando `mockData` hasta migrarlas al mismo catálogo.
