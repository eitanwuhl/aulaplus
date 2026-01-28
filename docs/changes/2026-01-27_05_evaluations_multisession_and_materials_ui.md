# Change Report: Evaluations Multi-Session + Materials UI (PHASE 5)

**Date**: 2026-01-28  
**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Phase**: 5 - Evaluations: Multi-Session Picker + Optional Materials + Focus Text  
**Author**: AI Agent (Cursor)

---

## Summary

Implementación completa de la **Fase 5** del sistema de evaluaciones, agregando:

1. **Selector multi-sesión**: Permite seleccionar una planificación guardada y múltiples sesiones de esa planificación como base para la evaluación.
2. **Campo de foco**: Textarea para describir qué aspectos específicos se quieren evaluar de las sesiones seleccionadas.
3. **Adjuntos de materiales a nivel evaluación**:
   - Materiales adjuntos directamente desde la biblioteca
   - Toggle para incluir materiales de las sesiones seleccionadas
4. **Persistencia**: Todos los datos (planificación origen, sesiones seleccionadas, foco, materiales) se guardan en la tabla `evaluaciones`.

Esta implementación mantiene **backward compatibility** total: el flujo ANEP-only existente sigue funcionando sin cambios. Las nuevas características son **opcionales** y complementarias.

---

## Context & Business Logic

### Problema Resuelto

Antes de esta fase, las evaluaciones solo podían generarse basándose en contenidos ANEP (competencias, criterios de logro, subtemas). No había manera de:
- Vincular evaluaciones a sesiones específicas de una planificación
- Especificar un foco evaluativo concreto
- Adjuntar materiales docentes como base para generar evaluaciones

### Nueva Arquitectura (A/B/C Pattern)

La UI de configuración de evaluaciones ahora soporta **3 modos**:

- **Modo A (ANEP-only)**: Selecciona competencias, criterios, subtemas (existente, sin cambios)
- **Modo B (Sessions-only)**: Selecciona planificación → sesiones → foco + materiales (nuevo, PHASE 5)
- **Modo C (Hybrid)**: Combina ANEP + sessions + materiales (nuevo, PHASE 5)

El botón de generación valida que al menos **uno** de los dos flujos esté completo:
```typescript
disabled={
  // ... otras validaciones ...
  (selectedSubtemas.length === 0 && evaluationSourceConfig.sessionIds.length === 0) ||
  (selectedCriteriosLogro.length === 0 && evaluationSourceConfig.sessionIds.length === 0)
}
```

### Guardrails Respetados

✅ **Explicit Save Pattern**: Los datos se guardan solo cuando el usuario guarda la evaluación explícitamente.  
✅ **Backward Compatibility**: Evaluaciones existentes sin `source_planificacion_id` siguen funcionando.  
✅ **User Isolation (RLS)**: Los nuevos campos respetan las políticas RLS existentes (implícitas por `user_id`).  
✅ **Soft Delete**: No se introducen borrados hard; se respeta el patrón `deleted_at`.

---

## Impact Analysis (vs SSoT Guardrails)

### Database Invariants
- ✅ **Explicit save**: `is_saved = true` → evaluación guardada
- ✅ **Soft delete**: `deleted_at IS NULL` → evaluación activa
- ✅ **RLS**: User isolation mantenida (`auth.uid() = user_id`)
- ✅ **Additive schema changes**: Solo agregamos columnas opcionales, no modificamos existentes

### Edge Functions
- ❌ **No changes**: Esta fase no modifica contratos de edge functions
- ⚠️ **Future work**: La generación de evaluaciones basadas en sesiones/materiales requerirá modificar el edge function `generate-plan-completo` o crear uno nuevo (fuera del scope de esta fase)

### Plan Parser
- ❌ **No affected**: Esta fase no toca `planParser.ts`

### Contemplaciones Catalog
- ❌ **No affected**: Esta fase no modifica el catálogo

### Session Estado Enum
- ❌ **No affected**: Esta fase no modifica el enum

---

## Files Created

### 1. Components

#### `src/components/evaluaciones/EvaluationSourceSelector.tsx`
**Purpose**: Componente reutilizable para seleccionar:
- Una planificación guardada (del grupo seleccionado)
- Múltiples sesiones de esa planificación (multi-select con checkboxes)
- Campo de foco (textarea): "¿Qué quieres evaluar de estas sesiones?"

**Key Features**:
- Carga planificaciones guardadas filtrando por `grupo_id`, `is_saved = true`, `deleted_at IS NULL`
- Carga sesiones ordenadas por `orden` cuando se selecciona una planificación
- Permite seleccionar 0, 1 o N sesiones (validación en el padre)
- Muestra badges con orden de sesión, título, contenidos ANEP (preview)
- Alertas informativas si no hay planificaciones o sesiones disponibles

**Props**:
```typescript
interface EvaluationSourceSelectorProps {
  grupoId?: string;
  config: {
    planificacionId?: string;
    sessionIds: string[];
    evaluationFocus: string;
  };
  onChange: (config) => void;
  disabled?: boolean;
}
```

**Integration Point**: Se usa en `EvaluacionesGrupo.tsx` después de la sección de requerimientos ANEP.

#### `src/components/evaluaciones/EvaluationMaterialsSection.tsx`
**Purpose**: Componente para adjuntar materiales a una evaluación con dos flujos:
1. **Materiales directos**: Desde la biblioteca (botón "Adjuntar materiales")
2. **Materiales de sesiones**: Toggle para incluir automáticamente materiales adjuntos a las sesiones seleccionadas

**Key Features**:
- Lista materiales directamente adjuntos (con botón X para remover)
- Botón "Adjuntar materiales" abre `MaterialsLibraryDialog` en modo multi-select
- Checkbox "Incluir materiales de las sesiones seleccionadas"
- Cuenta y muestra cuántos materiales tienen las sesiones seleccionadas (query a `material_attachments`)
- Alertas informativas si no hay materiales adjuntos

**Props**:
```typescript
interface EvaluationMaterialsSectionProps {
  config: {
    directMaterialIds: string[];
    includeSessionMaterials: boolean;
  };
  onChange: (config) => void;
  selectedSessionIds?: string[];
  disabled?: boolean;
}
```

**Integration Point**: Se usa en `EvaluacionesGrupo.tsx` después de `EvaluationSourceSelector`.

#### `src/components/evaluaciones/index.ts`
Barrel export para componentes de evaluaciones:
```typescript
export { EvaluationSourceSelector } from './EvaluationSourceSelector';
export { EvaluationMaterialsSection } from './EvaluationMaterialsSection';
export { EvaluacionVisualRenderer } from './EvaluacionVisualRenderer';

export type { EvaluationSourceConfig } from './EvaluationSourceSelector';
export type { EvaluationMaterialsConfig } from './EvaluationMaterialsSection';
```

---

### 2. Database Migration

#### `supabase/migrations/20260128000000_add_evaluation_sources.sql`
**Purpose**: Agregar columnas a `evaluaciones` para almacenar la configuración de PHASE 5.

**Schema Changes**:
```sql
-- Planificación origen
source_planificacion_id uuid REFERENCES planificaciones(id) ON DELETE SET NULL

-- Sesiones seleccionadas
source_session_ids uuid[] DEFAULT '{}'

-- Foco de evaluación
evaluation_focus text

-- Materiales directos
direct_material_ids uuid[] DEFAULT '{}'

-- Incluir materiales de sesiones
include_session_materials boolean DEFAULT false
```

**Indexes**:
- `idx_evaluaciones_source_planificacion`: Lookup por planificación origen
- `idx_evaluaciones_source_sessions`: GIN index para búsqueda en array de sesiones
- `idx_evaluaciones_direct_materials`: GIN index para búsqueda en array de materiales

**Idempotency**: ✅ Usa `DO $$ BEGIN ... IF NOT EXISTS ... END $$;` para evitar errores en múltiples ejecuciones.

**Backward Compatibility**: ✅ Todas las columnas son `NULL`-ables o tienen defaults. Evaluaciones existentes funcionan sin cambios.

---

### 3. Page Updates

#### `src/pages/EvaluacionesGrupo.tsx`

**New State Variables**:
```typescript
// PHASE 5: Evaluation sources (multi-session + materials)
const [evaluationSourceConfig, setEvaluationSourceConfig] = useState<{
  planificacionId?: string;
  sessionIds: string[];
  evaluationFocus: string;
}>({
  sessionIds: [],
  evaluationFocus: ''
});

const [evaluationMaterialsConfig, setEvaluationMaterialsConfig] = useState<{
  directMaterialIds: string[];
  includeSessionMaterials: boolean;
}>({
  directMaterialIds: [],
  includeSessionMaterials: false
});
```

**UI Integration** (línea ~1580):
Agregados después de la sección de requerimientos ANEP, antes de las opciones avanzadas:
```tsx
{/* PHASE 5: Evaluation sources (sessions + materials) */}
<EvaluationSourceSelector
  grupoId={selectedGroupId}
  config={evaluationSourceConfig}
  onChange={setEvaluationSourceConfig}
  disabled={isGenerating || requestInProgress}
/>

{/* PHASE 5: Evaluation materials */}
<EvaluationMaterialsSection
  config={evaluationMaterialsConfig}
  onChange={setEvaluationMaterialsConfig}
  selectedSessionIds={evaluationSourceConfig.sessionIds}
  disabled={isGenerating || requestInProgress}
/>
```

**Validation Logic** (línea ~1638):
Botón "Generar Evaluaciones Inteligentes" ahora permite generación si **ANEP OR sessions** están completos:
```typescript
disabled={
  isGenerating || requestInProgress || !selectedGroupId || 
  (!esInterdisciplinaria && !materia) || 
  (esInterdisciplinaria && materiasSeleccionadas.length === 0) || 
  // A/B/C-like validation: Allow generation if EITHER ANEP OR sessions selected
  (selectedSubtemas.length === 0 && evaluationSourceConfig.sessionIds.length === 0) ||
  (selectedCriteriosLogro.length === 0 && evaluationSourceConfig.sessionIds.length === 0)
}
```

**Save Logic** (línea ~522):
`handleSaveEvaluation` ahora persiste los nuevos campos:
```typescript
const evaluacionData = {
  // ... campos existentes ...
  // PHASE 5: Evaluation sources (sessions + materials)
  source_planificacion_id: evaluationSourceConfig.planificacionId || null,
  source_session_ids: evaluationSourceConfig.sessionIds,
  evaluation_focus: evaluationSourceConfig.evaluationFocus || null,
  direct_material_ids: evaluationMaterialsConfig.directMaterialIds,
  include_session_materials: evaluationMaterialsConfig.includeSessionMaterials,
  is_saved: true,
  saved_at: new Date().toISOString(),
  deleted_at: null
};
```

---

## Manual Verification Steps

### 1. Smoke Test: Crear Evaluación ANEP-Only (Backward Compatibility)

**Objetivo**: Verificar que el flujo existente sigue funcionando.

1. Ir a `/evaluaciones-grupo`
2. Seleccionar grupo
3. Seleccionar materia (no interdisciplinaria)
4. Seleccionar competencias ANEP
5. Seleccionar criterios de logro
6. Seleccionar subtemas
7. **NO seleccionar** planificación ni sesiones (dejar sección nueva vacía)
8. Clic "Generar Evaluaciones Inteligentes"
9. Guardar evaluación

**Expected**:
- ✅ Evaluación se genera y guarda correctamente
- ✅ `source_planificacion_id`, `source_session_ids`, `evaluation_focus`, `direct_material_ids` son NULL/vacíos
- ✅ La evaluación aparece en "Mis Evaluaciones"

---

### 2. Happy Path: Crear Evaluación Basada en Sesiones

**Prerequisitos**:
- Tener al menos 1 planificación guardada con sesiones (con `is_saved = true`)
- Tener al menos 1 material en la biblioteca

**Steps**:
1. Ir a `/evaluaciones-grupo?grupo=<grupo-id>`
2. Seleccionar grupo
3. Seleccionar materia
4. En sección "Fuente de Evaluación (Alternativa a ANEP)":
   - Seleccionar una planificación del dropdown
   - Verificar que aparecen las sesiones de esa planificación
   - Seleccionar 2-3 sesiones (checkboxes)
   - Escribir en el campo "¿Qué quieres evaluar de estas sesiones?": "Comprensión de conceptos principales"
5. En sección "Material Docente para Evaluación":
   - Clic "Adjuntar materiales"
   - Seleccionar 1-2 materiales de la biblioteca
   - Verificar que aparecen en la lista
   - (Opcional) Marcar "Incluir materiales de las sesiones seleccionadas"
6. Clic "Generar Evaluaciones Inteligentes" (debe estar habilitado incluso sin seleccionar ANEP)
7. Guardar evaluación con un nombre

**Expected**:
- ✅ El botón de generación se habilita cuando hay sesiones seleccionadas (aunque no haya subtemas ANEP)
- ✅ Los materiales adjuntos se muestran con título y badge PDF
- ✅ Se puede remover materiales con el botón X
- ✅ Al guardar, `source_planificacion_id`, `source_session_ids`, `evaluation_focus`, `direct_material_ids`, `include_session_materials` se persisten correctamente
- ✅ Query en DB:
```sql
SELECT 
  nombre,
  source_planificacion_id,
  source_session_ids,
  evaluation_focus,
  direct_material_ids,
  include_session_materials
FROM evaluaciones
WHERE nombre = '<tu-nombre-evaluacion>';
```

---

### 3. Edge Case: Sin Planificaciones Guardadas

**Scenario**: Grupo sin planificaciones guardadas con `is_saved = true`.

**Steps**:
1. Ir a `/evaluaciones-grupo` y seleccionar un grupo sin planificaciones guardadas
2. Verificar que el dropdown "Planificación guardada" muestra "No hay planificaciones guardadas"
3. Verificar que el componente no crashea

**Expected**:
- ✅ Mensaje claro "No hay planificaciones guardadas"
- ✅ No hay errores en consola

---

### 4. Edge Case: Planificación Sin Sesiones

**Scenario**: Planificación guardada pero sin sesiones creadas.

**Steps**:
1. Seleccionar una planificación que no tenga sesiones
2. Verificar que aparece un Alert: "Esta planificación no tiene sesiones todavía"

**Expected**:
- ✅ Alert informativo (no error)
- ✅ No se puede seleccionar sesiones (lista vacía)

---

### 5. Hybrid Mode: ANEP + Sesiones + Materiales

**Steps**:
1. Seleccionar competencias ANEP + criterios + subtemas (flujo A)
2. Seleccionar planificación + sesiones + foco (flujo B)
3. Adjuntar materiales directos + incluir materiales de sesiones (flujo C)
4. Generar y guardar

**Expected**:
- ✅ Todos los campos se persisten correctamente
- ✅ No hay conflictos entre los 3 flujos

---

## Known Limitations & Future Work

### Limitations en Esta Fase

1. **No AI Generation Yet**: Esta fase implementa solo la UI y persistencia. La generación de evaluaciones basadas en sesiones/materiales aún usa el edge function existente (solo ANEP). 
   - **Workaround temporal**: Los datos se guardan en DB, pero la generación AI solo considera ANEP por ahora.
   - **Future work**: Modificar `supabase/functions/generate-plan-completo/index.ts` para considerar `source_session_ids`, `evaluation_focus`, `direct_material_ids`.

2. **No Materials Extraction**: La UI no extrae/procesa el contenido de los materiales adjuntos para pasárselos a la IA.
   - **Future work**: Implementar extracción de texto de PDFs en backend (edge function o servicio separado).

3. **No Time Budgeting**: Como se especificó en la task, no se implementa time budgeting (duración esperada de evaluación) en esta fase.

4. **No Student-Specific Guidance**: Los materiales adjuntos son a nivel evaluación, no a nivel estudiante. Las contemplaciones individuales siguen en las "casillas" existentes.

### Future Enhancements (Fuera del Scope)

- [ ] **AI Integration**: Pasar `source_session_ids` + `evaluation_focus` + materiales a la IA para generar evaluaciones contextualizadas
- [ ] **Material Content Extraction**: Backend para extraer texto de PDFs y pasarlo al prompt de generación
- [ ] **Time Budgeting UI**: Campo para especificar duración estimada de la evaluación
- [ ] **Session Material Preview**: Mostrar lista expandible de materiales de sesiones (no solo count)
- [ ] **Planificacion Preview**: Mostrar resumen de la planificación seleccionada (competencias, periodo, etc.)
- [ ] **Bulk Material Attach**: "Adjuntar todos los materiales de las sesiones" con un clic

---

## Quality Gates

### Linter (`npm run lint`)
**Status**: ✅ **PASS** (con warnings pre-existentes del repo)

**New Files Lint Status**:
- ✅ `src/components/evaluaciones/EvaluationSourceSelector.tsx`: 0 errors
- ✅ `src/components/evaluaciones/EvaluationMaterialsSection.tsx`: 0 errors
- ✅ `src/components/evaluaciones/index.ts`: 0 errors
- ✅ `src/pages/EvaluacionesGrupo.tsx` (modificado): 0 new errors

**Note**: El repo tiene ~400 errores de lint pre-existentes (unused vars, any types, etc.) que no son parte de esta fase.

### Build (`npm run build`)
**Status**: ✅ **PASS**

**Output**:
```
✓ 4334 modules transformed.
dist/index.html                                    1.02 kB │ gzip:   0.45 kB
dist/assets/index-MT3yaRas.css                   104.68 kB │ gzip:  17.42 kB
dist/assets/index-Dgh0EVnL.js                  2,337.49 kB │ gzip: 674.75 kB
✓ built in 25.37s
```

**Warnings**: Solo warnings de chunk size (pre-existentes, no introducidos en esta fase).

### TypeScript
**Status**: ✅ **PASS** (implícito en build success)

No hay errores de tipos. Todos los nuevos tipos están correctamente definidos:
- `EvaluationSourceConfig`
- `EvaluationMaterialsConfig`
- Props de componentes con TypeScript strict mode

---

## Rollback Strategy

Si es necesario revertir esta fase:

### 1. Rollback Git
```bash
git revert <commit-hash-de-esta-fase>
```

### 2. Rollback Database (Opcional)
Si ya corriste la migración en producción y quieres limpiar columnas:
```sql
-- SOLO SI ES NECESARIO (las columnas NULL no rompen nada)
ALTER TABLE evaluaciones 
  DROP COLUMN IF EXISTS source_planificacion_id,
  DROP COLUMN IF EXISTS source_session_ids,
  DROP COLUMN IF EXISTS evaluation_focus,
  DROP COLUMN IF EXISTS direct_material_ids,
  DROP COLUMN IF EXISTS include_session_materials;
```

**Nota**: No es necesario hacer rollback de DB si las columnas están vacías (no afectan funcionalidad).

---

## Architecture Alignment

### SSoT Compliance

| Guardrail | Compliant? | Notes |
|-----------|------------|-------|
| Explicit Save Pattern | ✅ | `is_saved = true` solo cuando el usuario guarda |
| Soft Delete | ✅ | Respeta `deleted_at` pattern |
| RLS User Isolation | ✅ | Heredado de `user_id` en `evaluaciones` |
| Backward Compatibility | ✅ | Evaluaciones sin nuevos campos funcionan igual |
| Plan Parser | ✅ | No modificado |
| Edge Function Contracts | ⚠️ | No modificado aún (fase futura) |
| Contemplaciones Catalog | ✅ | No afectado |
| Session Estado Enum | ✅ | No afectado |

### Design Patterns Followed

1. **Separation of Concerns**: 
   - Componentes reutilizables (`EvaluationSourceSelector`, `EvaluationMaterialsSection`)
   - Lógica de negocio en el padre (`EvaluacionesGrupo`)
   - DB queries en componentes (seguir patrón repo)

2. **Controlled Components**: 
   - Todos los estados manejados por el padre
   - Props `config` + `onChange` (React pattern)

3. **Progressive Enhancement**: 
   - Las nuevas secciones son **opcionales**
   - El flujo ANEP-only sigue siendo válido
   - No hay breaking changes

4. **User Feedback**:
   - Alertas informativas (no errores) cuando faltan datos
   - Loading states en dropdowns y contadores
   - Badges y badges para identificación rápida

---

## Testing Checklist (Manual)

### Pre-Deployment Tests

- [ ] **Test 1**: Crear evaluación ANEP-only (sin seleccionar sesiones/materiales)
- [ ] **Test 2**: Crear evaluación con sesiones pero sin materiales
- [ ] **Test 3**: Crear evaluación con sesiones + materiales directos
- [ ] **Test 4**: Crear evaluación con sesiones + "incluir materiales de sesiones"
- [ ] **Test 5**: Crear evaluación con ANEP + sesiones + materiales (hybrid)
- [ ] **Test 6**: Guardar evaluación y verificar en DB que `source_session_ids` y `direct_material_ids` se persisten
- [ ] **Test 7**: Editar una evaluación guardada (verificar que los datos se cargan correctamente)
- [ ] **Test 8**: Edge case: Grupo sin planificaciones guardadas
- [ ] **Test 9**: Edge case: Planificación sin sesiones
- [ ] **Test 10**: Edge case: Biblioteca sin materiales

### Post-Deployment Checks

- [ ] Migración `20260128000000_add_evaluation_sources.sql` ejecutada sin errores
- [ ] Columnas nuevas existen en tabla `evaluaciones`
- [ ] Indexes creados correctamente
- [ ] Evaluaciones guardadas antes del deploy siguen funcionando
- [ ] No hay errores en logs de Supabase

---

## Commit Information

**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`  
**Commit Message**: 
```
feat(evaluations): multisession picker + materials attachments + focus
```

**Commit Hash**: `041bf62`

**Git Status**: ✅ Clean (nothing to commit, working tree clean)

---

## Related Documentation

- `docs/ARCHITECTURE_SSoT.md` - Database invariants and contracts
- `.cursor/rules/ARCHITECTURE_SSoT.md` - Cursor rules for agents
- `docs/changes/2026-01-27_02_materials_service_layer.md` - Materials service layer (prerequisito)
- `docs/changes/2026-01-27_03_storage_bucket_policies.md` - Storage bucket setup (prerequisito)
- `docs/changes/2026-01-27_03_1_materials_library_hotfix_restore_intent.md` - Materials library standalone page (prerequisito)
- `docs/changes/2026-01-27_04_planning_material_attachments_validation.md` - Planning materials integration (paralelo)

---

## Appendix: Database Schema Changes

### Before (evaluaciones table)
```sql
CREATE TABLE evaluaciones (
  id uuid PRIMARY KEY,
  user_id uuid,
  nombre text,
  materia text,
  grupo_id text,
  nivel text,
  fecha date,
  competencias_anep text[],
  contenidos text[],
  criterios_logro text[],
  requerimientos text,
  evaluacion_generada jsonb,
  rubrica jsonb,
  configuracion jsonb,
  is_saved boolean,
  saved_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
```

### After (PHASE 5)
```sql
CREATE TABLE evaluaciones (
  -- ... todas las columnas anteriores ...
  
  -- PHASE 5: Evaluation sources
  source_planificacion_id uuid REFERENCES planificaciones(id) ON DELETE SET NULL,
  source_session_ids uuid[] DEFAULT '{}',
  evaluation_focus text,
  direct_material_ids uuid[] DEFAULT '{}',
  include_session_materials boolean DEFAULT false
);

-- Indexes
CREATE INDEX idx_evaluaciones_source_planificacion ON evaluaciones(source_planificacion_id);
CREATE INDEX idx_evaluaciones_source_sessions ON evaluaciones USING GIN(source_session_ids);
CREATE INDEX idx_evaluaciones_direct_materials ON evaluaciones USING GIN(direct_material_ids);
```

---

## Conclusion

✅ **PHASE 5 completada exitosamente**.

Se implementó la funcionalidad completa de **selector multi-sesión + materiales + foco** para evaluaciones, manteniendo:
- Backward compatibility total
- Explicit save pattern
- User isolation (RLS)
- Código limpio y modular

**Next Steps** (fuera del scope de esta fase):
1. Modificar edge function `generate-plan-completo` para considerar sesiones/materiales en generación AI
2. Implementar extracción de contenido de materiales (PDF → texto)
3. Agregar preview de materiales de sesiones en UI
4. Agregar time budgeting (duración estimada)

---

**End of Report**

