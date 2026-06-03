# Módulo 2 — Programa anual (planificador macro)

Organiza el año lectivo por **grupo + materia** antes del wizard de sesiones (Módulo 3).

## Flujo

1. Docente crea programa en `/programa-anual/nuevo` (grupo, materia, marco del grupo).
2. Agrega **unidades** y asigna ítems del catálogo M1 (`contenido`, `progresion`, etc.).
3. Revisa **cobertura curricular** (% contenidos asignados).
4. Envía a revisión → dirección/admin **aprueba** → **en uso**.
5. Desde el programa o el wizard (`/planificacion/nuevo`), **importa unidades** al paso 2 del wizard.
6. La planificación guarda `programa_id` cuando se creó desde un programa.

## Base de datos

| Tabla | Rol |
|-------|-----|
| `grupo_programas` | Programa anual (estado, marco, año) |
| `programa_unidades` | Unidades con `catalog_item_ids[]` |
| `planificaciones.programa_id` | Vínculo opcional al macro |

Migración: `20260605120000_module2_annual_program.sql`

## Deploy

```bash
npx supabase db push
npm run seed:module2   # contenidos demo en catálogo ANEP
npm run supabase:gen-types
```

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/programa-anual` | Lista de programas del docente |
| `/programa-anual/nuevo` | Alta |
| `/programa-anual/:id` | Editor + workflow de estados |
| `/planificacion/nuevo?grupo=&materia=&programa=` | Deep link con import automático |

## Código

- `src/services/annualProgram/annualProgram.service.ts`
- `src/lib/annualProgram/coverage.ts`
- `src/pages/annualProgram/*`
- `src/components/annualProgram/*`
