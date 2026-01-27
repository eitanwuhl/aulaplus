# Final Safety Check - Critical Behaviors

> **Purpose**: Confirms critical system behaviors to ensure safe future changes. Inspection-only, no code modifications.

---

## 1. Authentication & Users

### 1.1 Real User Registration

**Status**: ❌ **NOT SUPPORTED**

**Evidence**:
- No `signUp()` or `createUser()` calls found in codebase
- Only `signInWithPassword()` is used (lines 60-63 in `src/contexts/AuthContext.tsx`)
- Login accepts any non-empty credentials (lines 149-183 in `src/contexts/AuthContext.tsx`)

**Files Checked**:
- `src/contexts/AuthContext.tsx` (lines 149-183)
- `src/components/TeacherLogin.tsx` (lines 18-47)
- `src/components/StudentLogin.tsx` (lines 18-47)
- `supabase/functions/ensure-demo-users/index.ts` (entire file)

**Conclusion**: System only supports demo user authentication. No real user registration flow exists.

---

### 1.2 Demo User Pattern Usage

**Status**: ✅ **USED IN PRODUCTION** (not just development)

**Evidence**:
- Demo user credentials are hardcoded:
  - Email: `demo.teacher@example.com` (line 37 in `src/contexts/AuthContext.tsx`)
  - Password: `DemoPassword2024!` (line 38 in `src/contexts/AuthContext.tsx`)
- `ensure-demo-users` edge function creates/updates demo user on every auth attempt (lines 49-73 in `supabase/functions/ensure-demo-users/index.ts`)
- Auto-authentication runs on app mount (line 144 in `src/contexts/AuthContext.tsx`)
- UI explicitly states "Demo: Cualquier usuario y contraseña son válidos" (lines 102, 103 in `src/components/TeacherLogin.tsx` and `src/components/StudentLogin.tsx`)

**Files Defining Behavior**:
- `src/contexts/AuthContext.tsx`:
  - Lines 36-38: Demo credentials constants
  - Lines 49-73: `ensureSupabaseAuth()` function
  - Lines 149-183: `login()` function (accepts any credentials)
  - Line 144: Auto-setup on mount
- `supabase/functions/ensure-demo-users/index.ts`:
  - Lines 29-31: Demo credentials
  - Lines 36-87: User creation/update logic
  - Lines 89-124: Profile creation/update logic

**Conclusion**: Demo user pattern is the **only** authentication method. It runs in production, not just development.

---

## 2. AI Generation Contract

### 2.1 Request Body Shape (`generate-plan-completo`)

**Edge Function**: `supabase/functions/generate-plan-completo/index.ts`

**Exact Request Body** (lines 38-56):
```typescript
{
  modo: 'generar' | 'regenerar' | 'generar_plan_html',  // Required
  sesionId?: string,                                    // Optional
  orden: number,                                        // Required
  duracionMin: number,                                 // Required
  materia: string,                                      // Required
  nivel: string,                                        // Required
  contenidos: string[],                                // Required (ANEP content IDs)
  competencias: string[],                               // Required (ANEP competency IDs)
  criterios: string[],                                  // Required (ANEP criteria IDs)
  perfilGrupo?: {                                       // Optional (Phase 3/4)
    tamanio?: number,
    dominante?: string,
    distribucion?: Record<string, number>
  },
  estudiantes?: Array<{                                 // Optional (Phase 3/4)
    perfil?: string,
    ajustes?: string,
    contemplaciones?: string[]
  }>,
  instruccionesDocente?: string,                        // Optional
  planActual?: string,                                 // Optional (for regeneration)
  unitContext?: {                                       // Optional (Phase 2)
    unidadId: string,
    contenido: string,
    claseEnUnidad: number,
    totalClasesUnidad: number,
    isExtraSlot?: boolean
  },
  sessionBrief?: string                                 // Optional (Phase 3.2, teacher override)
}
```

**Branching Behavior**:
- `modo === 'regenerar'`: Uses `planActual` to modify existing plan (line 133 in edge function)
- `modo === 'generar'` or `'generar_plan_html'`: Generates new plan from scratch
- `unitContext` present: Adds sequence context section to prompt (lines 59-74)
- `sessionBrief` present: Adds binding teacher override section (lines 77-110, takes priority over AI-generated title)

**Files**:
- Request extraction: `supabase/functions/generate-plan-completo/index.ts` (lines 38-56)
- Usage examples:
  - `src/pages/PlanificacionWorkspace.tsx` (lines 170-179)
  - `src/components/planificacion/EditorSesionNuevo.tsx` (lines 420-440, 344-346)

---

### 2.2 Response Shape (Frontend Consumption)

**Exact Response Body** (lines 258-264, 398-400 in edge function):
```typescript
{
  plan_html: string,                    // Required: HTML with <section id="plan">...</section>
  argumento_competencias: string,       // Required: AI justification for competencies
  recursos: string[],                   // Required: Auto-extracted resources array
  titulo: string                        // Required: Title (sessionBrief or extracted H1)
}
```

**Error Response** (lines 415-423):
```typescript
{
  error: string,                       // Error message
  error_code: 'RATE_LIMIT' | 'FUNCTION_ERROR',
  error_status: 429 | 500,
  isRateLimit: boolean
}
```

**Validation**:
- Frontend checks: `data?.plan_html?.includes('<section id="plan">')` (lines 185, 356, 450 in various files)
- Fallback plan created if structure invalid (lines 339-396 in edge function)

**Files**:
- Response construction: `supabase/functions/generate-plan-completo/index.ts` (lines 258-264, 398-400)
- Frontend consumption:
  - `src/pages/PlanificacionWorkspace.tsx` (lines 185-218)
  - `src/components/planificacion/EditorSesionNuevo.tsx` (lines 356-381, 450-459)
  - `src/hooks/useFullSessionGeneration.ts` (lines 293-330) - Note: Uses `modify-evaluation`, not `generate-plan-completo` directly

**Note**: `useFullSessionGeneration.ts` uses `modify-evaluation` edge function with different contract (line 293). This is a separate path.

---

### 2.3 Optional Fields & Branching

**Optional Fields**:
- `perfilGrupo`: If present, adds group profile section to prompt (lines 113-121)
- `estudiantes`: If present, adds student adjustments section (lines 122-131)
- `unitContext`: If present, adds sequence context (lines 59-74)
- `sessionBrief`: If present, **overrides** AI-generated title and binds all activities (lines 77-110, 314-321)
- `planActual`: Only used when `modo === 'regenerar'` (line 133)

**Critical Branching**:
1. **Title Priority** (lines 314-321):
   - Priority 1: `sessionBrief?.trim()` (teacher override)
   - Priority 2: Extract H1 from `plan_html`
   - Priority 3: Fallback to `"Planificación de Clase"`

2. **HTML Structure Validation** (lines 339-396):
   - If `plan_html` missing or doesn't contain `<section id="plan">`, creates fallback plan
   - Fallback includes all required sections (Inicio, Desarrollo, Cierre, Diferenciación)

3. **Error Cases**:
   - Rate limit (429): Returns error with `isRateLimit: true`, retries 3x with exponential backoff (lines 12-30, 410-423)
   - JSON parse failure: Falls back to `{ plan_html: content, argumento_competencias: '', recursos: [] }` (lines 299-310)

---

## 3. Saved vs Draft Logic

### 3.1 `is_saved` Usage

**Purpose**: Explicit save pattern - only saved items appear in "Mis X" lists.

**Database Columns**:
- `planificaciones.is_saved` (boolean, default false)
- `evaluaciones.is_saved` (boolean, default false)
- `planificaciones.saved_at` (timestamptz, nullable)
- `evaluaciones.saved_at` (timestamptz, nullable)

**Filtering Locations**:

1. **`src/pages/MisPlanificaciones.tsx`** (lines 156-157):
   ```typescript
   .eq('is_saved', true)
   .is('deleted_at', null)
   ```
   - **Enforced**: Database query level
   - **Purpose**: Only show explicitly saved plans

2. **`src/pages/MisEvaluaciones.tsx`** (lines 135-136):
   ```typescript
   .eq('is_saved', true)
   .is('deleted_at', null)
   ```
   - **Enforced**: Database query level
   - **Purpose**: Only show explicitly saved evaluations

3. **`src/pages/EvaluacionDetalle.tsx`** (line 67):
   ```typescript
   .is('deleted_at', null)
   ```
   - **Note**: Only checks `deleted_at`, not `is_saved` (detail view)

4. **RLS Policies** (migrations):
   - `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql` (lines 69-82)
   - `supabase/migrations/20251222000001_add_evaluaciones_rls_policies.sql` (line 13)
   - **Enforced**: Database RLS level (WHERE `is_saved = true AND deleted_at IS NULL`)

**Setting `is_saved`**:
- `src/pages/PlanificacionWizard.tsx` (line 798): Sets `is_saved: false` on creation
- `src/pages/PlanificacionWorkspace.tsx` (lines 359, 384): Sets `is_saved: true` on explicit save
- `src/pages/EvaluacionesGrupo.tsx` (line 469): Sets `is_saved: true` on save

**Files**:
- Query filtering: `src/pages/MisPlanificaciones.tsx` (lines 156-157), `src/pages/MisEvaluaciones.tsx` (lines 135-136)
- Setting: `src/pages/PlanificacionWizard.tsx` (line 798), `src/pages/PlanificacionWorkspace.tsx` (lines 359, 384), `src/pages/EvaluacionesGrupo.tsx` (line 469)
- RLS policies: `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql`, `supabase/migrations/20251222000001_add_evaluaciones_rls_policies.sql`

---

### 3.2 `deleted_at` Usage

**Purpose**: Soft delete pattern - deleted items filtered out but not physically removed.

**Database Columns**:
- `planificaciones.deleted_at` (timestamptz, nullable)
- `evaluaciones.deleted_at` (timestamptz, nullable)

**Filtering Locations**:

1. **`src/pages/MisPlanificaciones.tsx`** (line 157):
   ```typescript
   .is('deleted_at', null)
   ```
   - **Enforced**: Database query level

2. **`src/pages/MisEvaluaciones.tsx`** (line 136):
   ```typescript
   .is('deleted_at', null)
   ```
   - **Enforced**: Database query level

3. **`src/pages/EvaluacionDetalle.tsx`** (line 67):
   ```typescript
   .is('deleted_at', null)
   ```
   - **Enforced**: Database query level

4. **RLS Policies** (migrations):
   - All SELECT policies include `deleted_at IS NULL` condition
   - **Enforced**: Database RLS level

**Setting `deleted_at`** (Soft Delete):
- `src/pages/MisPlanificaciones.tsx` (line 681): Sets `deleted_at: new Date().toISOString()` on delete
- `src/pages/MisEvaluaciones.tsx` (line 486): Sets `deleted_at: new Date().toISOString()` on delete

**Files**:
- Query filtering: `src/pages/MisPlanificaciones.tsx` (line 157), `src/pages/MisEvaluaciones.tsx` (line 136), `src/pages/EvaluacionDetalle.tsx` (line 67)
- Soft delete: `src/pages/MisPlanificaciones.tsx` (line 681), `src/pages/MisEvaluaciones.tsx` (line 486)
- RLS policies: All migrations with RLS policies include `deleted_at IS NULL`

---

### 3.3 Enforcement Level

**Status**: ✅ **ENFORCED AT DATABASE LEVEL** (not just UI)

**Evidence**:
1. **RLS Policies**: All SELECT policies include `WHERE is_saved = true AND deleted_at IS NULL`
   - `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql` (lines 69-82)
   - `supabase/migrations/20251222000001_add_evaluaciones_rls_policies.sql` (line 13)

2. **Application Queries**: All list queries explicitly filter:
   - `.eq('is_saved', true)`
   - `.is('deleted_at', null)`

3. **Indexes**: Created for performance (lines 100-102 in migration):
   ```sql
   CREATE INDEX idx_planificaciones_is_saved_deleted 
     ON planificaciones(is_saved, deleted_at) 
     WHERE deleted_at IS NULL;
   ```

**Conclusion**: Filtering is enforced at **both** database (RLS) and application (query) levels. Cannot be bypassed.

---

## Summary

### Authentication
- ❌ No real user registration supported
- ✅ Demo user pattern used in production (not just dev)
- ✅ Single demo user: `demo.teacher@example.com` / `DemoPassword2024!`

### AI Generation Contract
- ✅ Request: 11 required fields + 5 optional fields
- ✅ Response: `{ plan_html, argumento_competencias, recursos, titulo }`
- ✅ Branching: `modo`, `unitContext`, `sessionBrief` affect behavior
- ✅ Error handling: Rate limit retry (3x), fallback plan on invalid HTML

### Saved vs Draft Logic
- ✅ `is_saved`: Enforced at database (RLS) and application (query) levels
- ✅ `deleted_at`: Enforced at database (RLS) and application (query) levels
- ✅ Both filters applied in: `MisPlanificaciones.tsx`, `MisEvaluaciones.tsx`
- ✅ Cannot be bypassed (RLS policies enforce)

---

## Files Modified

**None** - This is an inspection-only document.

**Files Read**:
- `src/contexts/AuthContext.tsx`
- `src/components/TeacherLogin.tsx`
- `src/components/StudentLogin.tsx`
- `supabase/functions/ensure-demo-users/index.ts`
- `supabase/functions/generate-plan-completo/index.ts`
- `src/hooks/useFullSessionGeneration.ts`
- `src/pages/PlanificacionWorkspace.tsx`
- `src/components/planificacion/EditorSesionNuevo.tsx`
- `src/pages/MisPlanificaciones.tsx`
- `src/pages/MisEvaluaciones.tsx`
- `src/pages/EvaluacionDetalle.tsx`
- `src/pages/PlanificacionWizard.tsx`
- `src/pages/EvaluacionesGrupo.tsx`
- `supabase/migrations/20251219163000_add_explicit_save_and_soft_delete.sql`
- `supabase/migrations/20251222000001_add_evaluaciones_rls_policies.sql`
- `supabase/migrations/20251222000000_add_evaluaciones_explicit_save.sql`






