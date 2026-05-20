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

## Perfil del alumno (`profile_data`)

Campos leídos desde jsonb (sin mocks en runtime):

| Campo | UI |
|-------|-----|
| `historialAcademico` | Historial académico |
| `evaluacionesCualitativas` | Observaciones pasadas |
| `resultadosEvaluaciones` | Resultados de evaluaciones |
| `evolucionDetallada` | Evolución académica por materia (gráfico) |
| `dashboardEvolucion` | Dashboard de métricas al pie del perfil |
| `informeTecnico` | Informe psicopedagógico |
| `contemplaciones` | Sugerencias en catálogo de contemplaciones |
| `anotaciones`, `seguimiento`, etc. | Sidebar / evolución |

Demo: `src/data/mockData.ts` → `npm run seed:student-profiles` (incluido en `seed:demo`). Si faltan campos opcionales, el seed aplica defaults (`DEFAULT_*` o `buildDefaultDashboardEvolucion` según `promedio`/`progreso` del alumno).

**Contemplaciones:** el catálogo completo vive en `src/lib/contemplaciones/catalog` (config de producto). Las sugerencias por alumno vienen de `profile_data.contemplaciones` (seed). La selección del docente se guarda en `localStorage`.

## Notificaciones del alumno

`NotificacionesAlumno` filtra `dashboard_notifications` del docente (`useNotifications`) por `student_id` y estado no leído (`useStudentNotifications`).

## Front

- Servicio: `src/services/teacherGroups/`
- Hook: `useTeacherGroups`
- Página: `src/pages/TeacherGroups.tsx`
- View models: `toStudentProfileViewModel` / `toGroupProfileViewModel`
- Empty states: `src/components/teacherGroups/CatalogEmptyState.tsx`
- Navegación con retorno → `teacherGroupsNavState()` con `returnTo: '/teacher-dashboard'`

## Otras pantallas

Evaluaciones, planificación y búsqueda global pueden seguir usando `mockData` hasta migrarlas al mismo catálogo.
