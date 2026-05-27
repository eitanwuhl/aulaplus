# Módulo 1 — Configuración institucional

Configuración del liceo (tenant), marcos curriculares, catálogos, asignación por curso y por alumno. Base para generación IA alineada al contexto institucional.

## Funcionalidades

| Área | Descripción |
|------|-------------|
| Onboarding | 3 pasos: datos institucionales, marcos (10), confirmación |
| Marcos | Activación de los 10 marcos; ANEP EBI obligatorio |
| Grupos | Marco principal y secundario por `school_groups` |
| Catálogo | Versionamiento (borrador → activa → deprecada), clonación, activación por marco |
| Carga masiva | CSV Cambridge/IB en catálogos propios del liceo (borrador) |
| Alumnos | Multimarco por estudiante (`student_frameworks` JSON) |
| IA | `institutionContext` + `studentFrameworks` en prompts |

## CSV (carga masiva)

Columnas: `tipo`, `codigo`, `nombre`, `descripcion`, `nivel`, `materia`, `parent_codigo`, `orden`.

- Separador: coma o punto y coma
- `parent_codigo` referencia `codigo` de filas anteriores (jerarquía)
- Solo importa en catálogos **borrador** del liceo

Plantilla descargable desde `/institucion/configuracion` → pestaña Catálogo.

## Versionamiento

1. **Nueva versión** → crea fila en `curriculum_catalogs` (`school_id` = liceo, `estado` = borrador)
2. Opcional: clonar ítems de versión anterior o global
3. **Importar CSV** en borrador
4. **Activar** → depreca la activa anterior del mismo marco y enlaza `school_curriculum_frameworks.catalog_id`

## Base de datos

| Migración | Contenido |
|-----------|-----------|
| `20260601120000_module1_institutional_config.sql` | Esquema M1 |
| `20260602120000_module1_catalog_admin_rls.sql` | RLS escritura catálogos + `student_frameworks` |

## Rutas

| Ruta | Rol |
|------|-----|
| `/institucion/onboarding` | `direccion`, `admin` |
| `/institucion/configuracion` | `direccion`, `psicopedagogico`, `admin` |

## Deploy

```bash
npx supabase db push
npm run seed:demo
npm run supabase:gen-types
npx supabase functions deploy ensure-demo-users --project-ref bbzikjvrehfooaumkmui
```

## Demo

| Código | Rol |
|--------|-----|
| DIR001 | Dirección — `direccion.demo@example.com` |
| DOC001–005 | Docentes |

Contraseña: `DemoPassword2026!`

**DIR001 no ingresa:** ejecutá `npm run seed:auth-users` (requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env`) y después `npm run seed:login`. Alternativa: login con email `direccion.demo@example.com`.

## Código

- `src/services/institution/catalog.service.ts` — versiones e importación
- `src/services/institution/studentFrameworks.service.ts` — multimarco alumno
- `src/lib/institution/parseCatalogCsv.ts` — parser CSV
- `src/components/institution/CatalogManagementPanel.tsx`
- `src/components/institution/StudentFrameworksPanel.tsx`
