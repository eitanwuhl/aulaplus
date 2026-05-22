# Migración desde `mockData.ts`

## Estado (producción docente)

| Área | Fuente de datos |
|------|-----------------|
| Mis grupos, perfiles | `useTeacherGroups` → `school_students` + `grupos` |
| Búsqueda global | `useTeacherGroups` |
| Contexto IA (planes/evaluaciones) | `getGroupContextForAI` → catálogo del docente |
| Planes (recordatorios) | `buildSanitizedLessonPlanHtml` → catálogo |
| Evaluaciones por grupo | Selector + pipeline → catálogo |
| Detalle evaluación (recordatorios) | `fetchLegacyStudentsForGroup` |

## Pendiente (mock aún)

| Área | Archivo |
|------|---------|
| Landing demo (`/`) | `Index.tsx`, `CRMDemoSection` |
| Rúbricas (fallback sin lista) | `EnhancedSmartRubric`, `SimplifiedSmartRubric`, `EnhancedVersionPersonalization` |
| Tipos + defaults de seed | `mockData.ts`, `schoolCatalog.ts`, `seed-student-profiles.mjs` |
| DEV console | `main.tsx` → `window.__mockGroups` |

## API interna

- `getTeacherGroupsCached()` — cache 60s para código fuera de React
- `resolveTeacherGroup(grupoId)` / `resolveLegacyGroup(grupoId)`
- `fetchLegacyStudentsForGroup(grupoId)` — alumnos en forma `Student` legacy
- `resolveMockGroup` — **solo** landing; usar `resolveGroupInList(mockGroups, …)`

## Próximo paso

1. Extraer tipos de `mockData.ts` → `src/types/studentProfile.ts`
2. Pasar `students` del grupo seleccionado a componentes de rúbrica
3. Opcional: landing demo con datos del liceo del visitante o estático reducido
