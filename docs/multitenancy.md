# Multi-tenancy (liceos)

## Modelo v1

Cada **liceo** es un tenant en `public.schools`.

| Tabla | Aislamiento |
|-------|-------------|
| `schools` | Raíz del tenant |
| `school_groups`, `school_students` | `school_id` + RLS (`current_user_school_id()`) |
| `profiles` | `school_id` del docente (un liceo por usuario en v1) |
| `school_students` | **Un alumno = un `school_id`** (id numérico único; no puede cambiar de liceo) |
| `student_accounts` | Login portal opcionalmente enlazado a `catalog_student_id` → un solo liceo |
| `dashboard_notifications` | `school_id` obligatorio en visibilidad; solo el mismo liceo recibe broadcast / grupo / alumno |
| `grupos` | Asignación docente ↔ curso; el catálogo visible ya está filtrado por RLS |
| `planificaciones`, `evaluaciones`, `teacher_materials` | Por `user_id` (el docente ya pertenece a un liceo) |

La función SQL `current_user_school_id()` lee `profiles.school_id` del usuario autenticado.

## Tipos TypeScript

Tras cambiar el esquema en Supabase:

```bash
npm run supabase:gen-types
```

## Demo

| Código login | Nombre en la app | Cursos en Mis grupos |
|--------------|----------------|----------------------|
| DOC001 | María López | 9no 1, 9no 2 |
| DOC002 | Carlos Rodríguez | 8vo 1, 8vo 2 |
| DOC003 | Laura Fernández | 9no 1, 9no 3 |
| DOC004 | Patricia Morales | 10mo 1, 10mo 2 |
| DOC005 | Miguel Torres | 10mo 2, 10mo 3 |
| DIR001 | Ana Martínez (Dirección) | Configuración institucional (Módulo 1) |

Cada docente solo ve datos de **su** liceo (catálogo, grupos, notificaciones). Dirección y psicopedagogía acceden a `/institucion/configuracion` (ver `docs/module-1.md`).

## Producción

- El front **no** invoca `ensure-demo-users` en builds de producción (`import.meta.env.PROD`).
- Los docentes deben tener `profiles.school_id` asignado (seeds o administración); sin liceo el login se rechaza.
- En Supabase hospedado, `ensure-demo-users` responde **403** salvo que configures `DEMO_BOOTSTRAP_SECRET` y envíes el header `x-demo-bootstrap-secret` (solo para bootstrap manual). En local (`127.0.0.1`) sigue abierto para desarrollo.

## Aplicar en Supabase remoto

```bash
npx supabase db push
npm run seed:demo
# Opcional si necesitás la edge en hosted con secreto:
npx supabase functions deploy ensure-demo-users --project-ref <ref>
# supabase secrets set DEMO_BOOTSTRAP_SECRET=<valor-largo-aleatorio>
```

`npm run seed:demo` carga **ambos liceos**:

| Paso | Contenido |
|------|-----------|
| `seed:login` | DOC001–005, DIR001 |
| `seed:module1` | Catálogo ANEP + marcos activos por liceo |
| `seed:school-catalog` | Demo + norte + **St. Patrick's** (6 alumnos, 3 cursos) |
| `seed:student-profiles` | `profile_data` ids 1–10, 201–204, **301–306** |
| `seed:teacher-grupos` | Asignación docente↔curso por tenant |
| `seed:notifications` | Avisos demo + avisos liceo-norte |

Si `db push` falló antes por FK de notificaciones, volvé a ejecutar `db push` con la migración corregida (ya no intenta borrar el PK sin soltar `dashboard_notifications_group_id_fkey`).

Migración adicional: `20260521200000_notifications_tenant_isolation.sql` — las notificaciones **siempre** exigen `school_id = liceo del docente` (no se mezclan avisos globales entre liceos).

## Nuevo liceo (checklist)

1. `INSERT INTO schools (id, name, slug) VALUES (...);`
2. Seed de `school_groups` / `school_students` con ese `school_id`.
3. Crear usuarios Auth + `profiles.school_id`.
4. `INSERT INTO grupos` uniendo docente y grupos del mismo `school_id`.
5. (Futuro) panel admin para alta de liceos sin SQL.

## Pendiente (no en v1)

- Subdominio por liceo (`liceo1.aulaplus.app`)
- Docente en varios liceos (tabla `teacher_school_memberships`)
- `school_id` en planificaciones para reporting cross-user
- Migrar búsqueda global y `groupContext` 100 % fuera de `mockData`
