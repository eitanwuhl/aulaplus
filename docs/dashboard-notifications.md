# Notificaciones del dashboard (persistencia)

Este documento describe el cambio de las notificaciones del panel docente **de datos en memoria + `localStorage`** a **Postgres (Supabase)** con lecturas persistidas por usuario.

---

## 1. Objetivo y alcance

- **Antes:** `NotificationsPanel` usaba un array fijo en código y el estado “leída” solo en `localStorage`.
- **Ahora:** Las alertas viven en **`dashboard_notifications`**; el estado leído por docente en **`dashboard_notification_reads`**. El panel las carga con el cliente Supabase y marca lecturas con `upsert` en la base.

**Fuera de alcance de este diseño:** no reemplaza la tabla **`comunicaciones`**, que es el buzón docente → dirección / psicopedagogía (`/comunicaciones`). Las notificaciones del dashboard son **avisos dirigidos al docente** (equipo directivo, psicopedagogía, grupo, etc.), con otro modelo de datos.

---

## 2. Modelo de datos (dos tablas)

### 2.1 `public.dashboard_notifications`

Representa **un aviso** (una sola fila compartida por quienes puedan verla).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` | PK. En el demo se usan UUIDs fijos para inserts idempotentes. |
| `notification_type` | `text` | `info` o `urgent` (CHECK en BD). |
| `title` | `text` | Título en el panel. |
| `message` | `text` | Cuerpo del mensaje. |
| `created_at` | `timestamptz` | Momento de creación; el front muestra tiempo relativo con `date-fns`. |
| `student_id` | `integer` | Opcional. FK a `school_students.id` (catálogo en BD). Navegación en `/teacher-groups`. |
| `group_id` | `text` | Opcional. FK a `school_groups.id`. Navegación por grupo en `/teacher-groups`. |
| `recipient_user_id` | `uuid` | Opcional, FK a `auth.users`. **`NULL`** = aviso **para todos los docentes** (según RLS). Si no es `NULL`, solo ese usuario ve la fila. |

**Restricción:** no puede haber **al mismo tiempo** `student_id` y `group_id` no nulos (`CHECK (student_id IS NULL OR group_id IS NULL)`).

### 2.2 `public.dashboard_notification_reads`

Estado **“marcada como leída”** por usuario (muchas filas, una por par notificación + docente).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `notification_id` | `uuid` | FK a `dashboard_notifications.id`. |
| `user_id` | `uuid` | FK a `auth.users.id` (docente autenticado). |
| `read_at` | `timestamptz` | Momento en que se marcó leída (default `now()`). |

**No hay más columnas** en esta tabla: solo esas tres. La **PK compuesta** `(notification_id, user_id)` no es una cuarta columna; solo indica que no puede haber dos filas con el mismo par aviso + docente.

**“¿Leyó o no?”** no está como `boolean` aparte: **si existe la fila, el docente marcó leído**; si no existe fila para ese par, sigue sin leer. `read_at` aporta *cuándo* lo marcó (auditoría); si no lo necesitás, en un rediseño podría omitirse y seguiría valiendo la misma regla “fila presente = leído”.

Motivo de dos tablas: el **texto del aviso** no se duplica por cada docente; solo se agregan filas en `reads` cuando alguien marca leído (o se podría preinsertar en el futuro si se desea otro producto).

---

## 3. Seguridad (RLS)

- **`dashboard_notifications`**
  - **SELECT (multi-tenant):** `school_id` de la notificación debe coincidir con `profiles.school_id` del usuario (`current_user_school_id()`). Sin coincidencia de liceo, **nadie** ve la fila.
    - **Dirección / psicopedagogía** del liceo: ven **todos** los avisos de su `school_id`.
    - **Docentes** del mismo liceo:
      - **Broadcast:** `recipient_user_id` NULL, sin `student_id` ni `group_id` → todos los docentes del liceo.
      - **Por grupo:** solo docentes con ese curso en **`public.grupos`**.
      - **Por alumno:** solo docentes del curso del alumno en **`grupos`**.
    - **Personal:** `recipient_user_id = auth.uid()` (mismo liceo).
  - Migración: `20260522000000_notifications_liceo_recipients_only.sql`.
  - Migración: `20260516120000_dashboard_notifications_group_scoped_visibility.sql`.
  - **INSERT:** solo perfiles con `profiles.role` en **`teacher`**, **`direccion`** o **`psicopedagogico`** (`20260517140000_…`). Staff puede apuntar a cualquier alumno/grupo del catálogo (FK). Docentes: broadcast libre; con `group_id`/`student_id` solo si tienen ese curso en **`public.grupos`** (asignación por `(user_id, id)` — varios docentes pueden compartir el mismo `id` de curso).
  - **Formulario “Crear aviso”:** el desplegable de alumnos/grupos usa el catálogo del liceo (`school_id` vía RLS). **Docentes** solo ven cursos y alumnos de sus filas en **`public.grupos`**. **Dirección / psicopedagogía** ven todo el catálogo de su liceo.
  - **SELECT staff:** `direccion` / `psicopedagogico` ven **todos** los avisos. **SELECT docente:** reglas por asignación en `grupos` (migración `20260516120000` + `20260517140000`).
  - **UPDATE / DELETE** para rol `authenticated`: **no** (políticas con `USING (false)`).

Los datos iniciales del demo siguen entrando por **migración/seeds** (superusuario, sin pasar por esta política de INSERT).

- **`dashboard_notification_reads`**
  - **SELECT / INSERT / UPDATE / DELETE:** solo filas donde `user_id = auth.uid()` (cada docente solo ve y toca sus propias lecturas).

**Grants:** `authenticated` tiene `SELECT` en notificaciones y CRUD en lecturas (acotado por RLS).

---

## 4. Dónde se generan las notificaciones

| Origen | Qué crea | Cómo |
|--------|-----------|------|
| **Migración** `20260514000000_dashboard_notifications.sql` (final) | Filas demo fijas | `INSERT … ON CONFLICT DO NOTHING` al aplicar migraciones (`db push`). |
| **Seed** `supabase/seeds/dashboard_notifications_demo.sql` | Mismas filas demo | `db reset` local después de migraciones. |
| **Panel docente** | Avisos **broadcast** (`recipient_user_id` NULL) | Formulario colapsable “Crear aviso (prueba)” en `NotificationsPanel` → `supabase.from('dashboard_notifications').insert(...)`. Requiere migración `20260514120000_dashboard_notifications_teacher_insert_broadcast.sql` aplicada. |
| **Futuro** | Cualquier regla de negocio (dirigidas, masivas, etc.) | Edge Function o backend con **service role**, o SQL en el dashboard de Supabase. |

---

## 5. Migración y seeder

| Artefacto | Rol |
|-----------|-----|
| `supabase/migrations/20260514000000_dashboard_notifications.sql` | Crea tablas, índices, políticas, grants y al final **INSERT demo** con `ON CONFLICT (id) DO NOTHING`. Se aplica con **`npx supabase db push`** (y en cualquier entorno que ejecute migraciones). |
| `supabase/migrations/20260514120000_dashboard_notifications_teacher_insert_broadcast.sql` | Primera versión de INSERT broadcast (reemplazada por la siguiente). |
| `supabase/migrations/20260514130000_dashboard_notifications_fix_insert_rls.sql` | INSERT broadcast sin depender de `profiles` (corrige error `42501`). |
| `supabase/seeds/dashboard_notifications_demo.sql` | Mismo contenido de demo, **idempotente**, para **`supabase db reset`** / seeds definidos en `supabase/config.toml`. Si la migración ya insertó las filas, el seed no duplica gracias al conflicto por `id`. |
| `supabase/config.toml` → `[db.seed] sql_paths` | Incluye login, catálogo escolar y notificaciones demo. |
| `supabase/migrations/20260515140000_school_catalog_and_notification_fks.sql` | Tablas `school_groups` / `school_students`, seed idempotente y **FK** en `dashboard_notifications` (validación de IDs en backend). |
| `supabase/seeds/school_catalog_demo.sql` | Mismo catálogo para `db reset`; remoto: `npm run seed:school-catalog`. |

---

## 6. Front: `NotificationsPanel.tsx`

### 6.1 Tipos

- **`DashboardNotification` (app):** objeto cómodo para la UI (`type`, `time` ya formateado, `studentId` / `groupId` en camelCase, `id` como **`string`** porque en BD es **UUID**).
- **`DbNotificationRow`:** forma cercana a la fila SQL (`notification_type`, `created_at`, `student_id`, etc.).

### 6.2 `mapRowToNotification`

Función pura que **adapta** una fila de `dashboard_notifications` al shape que usa el componente (incluye mapeo `notification_type` → `type` y generación de `time` con `formatDistanceToNow` + locale `es`).

### 6.3 Flujo de datos

1. **Recarga:** al volver a `/teacher-dashboard` o cuando cambia la sesión del docente, se vuelve a cargar la lista. Se usa **`supabase.auth.getSession()`** primero (lee la sesión del cliente) y, como respaldo, la sesión expuesta por **`useAuth()`**, para evitar listas vacías si `getUser()` aún no devolvía usuario en ese tick.
2. En paralelo: `from('dashboard_notifications').select('*').order('created_at', { ascending: false }).limit(50)` y `from('dashboard_notification_reads').select('notification_id').eq('user_id', uid)`.
3. Contador “nuevas”: notificaciones cuyo `id` no está en el set de `notification_id` leídos.
4. **Marcar como leída:** `upsert` en `dashboard_notification_reads` con `onConflict: 'notification_id,user_id'`, y actualización optimista del set en memoria.
5. **Crear aviso (prueba):** formulario `<details>` que hace `insert` en `dashboard_notifications` con `recipient_user_id` NULL (broadcast).

**Navegación:** click en aviso con `studentId` o `groupId` navega a `/teacher-groups` con `teacherGroupsNavState()` (`returnTo: '/teacher-dashboard'`) para que «atrás» vuelva al dashboard sin recorrer el stack intermedio. Ver `docs/teacher-groups.md`.

---

## 7. Tipos TypeScript del repo (`src/integrations/supabase/types.ts`)

Las entradas bajo `Database['public']['Tables'][...]` describen las tablas para `createClient<Database>()` (filas `Row`, `Insert`, `Update`, `Relationships`). Conviven con el resto del esquema; no sustituyen la documentación de negocio, solo alinean el tipado con Postgres.

---

## 8. Cómo agregar notificaciones en el futuro

1. **Solo datos / demo:** nuevos `INSERT` en una migración nueva o en un seed (siempre idempotente, p. ej. UUID fijo + `ON CONFLICT DO NOTHING`).
2. **Desde la app (docente):** avisos **broadcast** (`recipient_user_id` NULL) con el formulario del panel o con el mismo `insert` desde código; requiere la política de la migración `20260514120000_…`.
3. **Desde producto con privilegios:** insertar con **service role** (Edge Function o backend) para filas dirigidas (`recipient_user_id` no null), masivas, o reglas que no deban depender del cliente.
4. **Por docente (dirigidas):** setear `recipient_user_id` al UUID del usuario; el INSERT desde el navegador **no** lo permite la política actual (solo broadcast).

---

## 9. `public.grupos` (asignación docente ↔ curso)

- PK compuesta **`(user_id, id)`** donde `id` = `school_groups.id` (ej. `"1"` = 9no 1).
- Varios docentes pueden tener el mismo `id` con distinto `user_id`.
- Seed demo: `npm run seed:demo` (login + catálogo + asignación `grupos` para DOC001–DOC003).

## 10. Checklist rápido al desplegar

1. `npx supabase db push` (incluye `20260517140000_grupos_composite_pk_and_notification_roles.sql`).
2. `npm run seed:school-catalog` y `npm run seed:teacher-grupos` en remoto si hace falta.
3. Perfiles publicadores: `profiles.role` ∈ `teacher` | `direccion` | `psicopedagogico`.
4. Probar: broadcast, aviso por grupo (dos docentes con el mismo curso), marcar leída, staff si existe perfil.

---

## 11. Referencias de archivos

| Archivo |
|---------|
| `supabase/migrations/20260514000000_dashboard_notifications.sql` |
| `supabase/migrations/20260514120000_dashboard_notifications_teacher_insert_broadcast.sql` |
| `supabase/migrations/20260514130000_dashboard_notifications_fix_insert_rls.sql` |
| `supabase/migrations/20260517140000_grupos_composite_pk_and_notification_roles.sql` |
| `supabase/seeds/teacher_grupos_demo.sql` |
| `supabase/seeds/dashboard_notifications_demo.sql` |
| `scripts/lib/run-sql-seed.mjs` |
| `supabase/config.toml` (`[db.seed]` → `sql_paths`) |
| `src/components/dashboard/NotificationsPanel.tsx` |
| `src/integrations/supabase/types.ts` (`dashboard_notifications`, `dashboard_notification_reads`) |
