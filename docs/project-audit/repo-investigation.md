# AulaPlus — Repository Investigation (Research Phase)

**Date:** 2026  
**Scope:** Full codebase audit for architecture, flows, data models, AI integration, runtime errors, and improvement backlog.  
**Constraint:** No code changes in this phase; inspection and documentation only.

---

## Executive Summary

AulaPlus is a React (Vite + TypeScript) web app for Uruguayan teachers: **lesson planning**, **assessments** (with Version A/B/C and DUA-style accommodations), and **student profiles** with psychopedagogy “contemplaciones” that feed into generation and reporting. The stack uses **Supabase** (Postgres, Auth, Storage, Edge Functions) and **OpenAI** inside Edge Functions for plan and evaluation generation.

**Findings:**

- **Frontend:** React 18, Vite 7, React Router 6, TanStack Query, Radix/shadcn-style UI, Tailwind. State is mostly component/local + React Query; no global store.
- **Backend:** Supabase (DB, Auth, Storage, Edge Functions). AI: OpenAI called from `generate-plan-completo`, `modify-evaluation`, `modify-evaluation-v2`, `generate-bulletin-text`, `extract-material-text`.
- **Critical pain points:** Very large files (`EvaluacionesGrupo.tsx` ~3050 lines, `modify-evaluation-v2/index.ts` ~4370 lines), mixed UI/business/data in pages, brittle HTML/JSON parsing (plan parser, evaluation Version A “wrapper” issues), demo-only auth with known 401/session recovery fixes, and students/contemplaciones still on mock + localStorage (hybrid model).
- **Runtime issues:** 401 when session/refresh token invalid (mitigated by `invokeEdgeFunctionAuthed` + AuthContext recovery); “Version A shows JSON wrapper” when backend returns non-HTML; save guard blocking V2 saves (fixed in phase-3-save-v2-spec-fix).

This document maps architecture, main flows, data model, AI integration, errors, and a prioritized backlog with a 4-phase next-steps plan.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser (React 18 + Vite 7)                                             │
│  ├── React Router 6 (App.tsx: /, /teacher-dashboard, /evaluaciones/*,    │
│  │     /planificacion/*, /biblioteca-materiales, /mis-*, etc.)           │
│  ├── Auth: AuthContext (demo signIn + session listener, profiles upsert) │
│  ├── UI: Radix primitives, shadcn-style components, Tailwind             │
│  ├── Data: TanStack Query (materials, etc.); rest via useState + Supabase │
│  └── Edge calls: lib/edgeFunctionAuth.ts → invokeEdgeFunctionAuthed()     │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                    VITE_SUPABASE_URL │ VITE_SUPABASE_ANON_KEY
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Supabase                                                                 │
│  ├── Auth (demo: ensure-demo-users, signInWithPassword)                   │
│  ├── Postgres (planificaciones, sesiones_clase, evaluaciones,            │
│  │     profiles, grupos, teacher_materials, etc.)                        │
│  ├── Storage (teacher materials bucket)                                  │
│  └── Edge Functions (Deno)                                               │
│        ├── generate-plan-completo  (OpenAI → plan HTML)                  │
│        ├── modify-evaluation      (OpenAI → V1 HTML A/B/C)               │
│        ├── modify-evaluation-v2   (OpenAI → V2 JSON spec + narrative)    │
│        ├── generate-bulletin-text (OpenAI)                              │
│        ├── extract-material-text  (OpenAI)                               │
│        └── ensure-demo-users      (seed demo teacher/student)            │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Routing:** Centralized in `src/App.tsx`. Protected routes use `ProtectedTeacherRoute` / `ProtectedStudentRoute` (wrap with `AppLayout` for teachers). Entry: `/` → RoleSelection → teacher-login or student-login.
- **State management:** No Redux/Zustand. Auth in `AuthContext`; server state via `@tanstack/react-query` (e.g. materials); evaluation/plan state in page-level `useState` (e.g. `v2RawResponse`, `evaluationBundle`, `generatedEvaluations`).
- **Styling:** Tailwind CSS; components under `src/components/ui/` (Radix-based: button, card, dialog, etc.).

---

## Flow Maps

### 1. Teacher authentication / session bootstrapping

| Step | Where |
|------|--------|
| Entry | `/` → RoleSelection → `/teacher-login` (TeacherLogin.tsx) |
| Login | TeacherLogin calls `login('teacher', { username, password })` → AuthContext |
| AuthContext | `AuthProvider`: `signInWithPassword` with demo credentials (`DEMO_TEACHER_EMAIL` / `DEMO_TEACHER_PASSWORD`). On mount can call `ensureSupabaseAuth()` (invokes `ensure-demo-users` then signIn). |
| Session recovery | `onAuthStateChange`: on `SIGNED_OUT`, runs `ensureSupabaseAuth()` to re-establish demo session so next Edge call has valid JWT. |
| Profile | After session, upserts `profiles` (user_id, display_name, role). Conflict/409 treated as success. |
| Guard | `ProtectedTeacherRoute`: redirects to `/` if not authenticated or role !== 'teacher'. |

**Key files:** `src/contexts/AuthContext.tsx`, `src/App.tsx`, `src/components/TeacherLogin.tsx`, `supabase/functions/ensure-demo-users/index.ts`.

**Errors:** 401 on Edge calls if session invalid and recovery fails. Refresh token “not found” after DB reset or key rotation → signOut + re-login (see `docs/evaluations-upgrades/fix-v2-401-auth.md`).

---

### 2. Materials library (upload, list, view)

| Step | Where |
|------|--------|
| Entry | Route `/biblioteca-materiales` → `BibliotecaMateriales.tsx` |
| List | `useMaterialsList` (from `hooks/useMaterials.ts`) → Supabase `teacher_materials` (RLS, user_id). Order/filter in hook. |
| Upload | `UploadMaterialDialog` → insert into `teacher_materials` + Storage upload; then `extract-material-text` Edge Function invoked (OpenAI) to fill `extracted_text`. |
| View/Open | `getSignedUrl(storage_path)` (services/materials) → signed URL; open in new tab or viewer. |
| Archive | `useArchiveMaterial` → soft delete (or RPC) on `teacher_materials`. |

**Key files:** `src/pages/BibliotecaMateriales.tsx`, `src/hooks/useMaterials.ts`, `src/components/materials/UploadMaterialDialog.tsx`, `src/services/materials/materials.ts`, `supabase/functions/extract-material-text/index.ts`, migrations `20260127000000_add_teacher_materials_schema.sql`, `20260128000004_fix_teacher_materials_*`.

**Errors:** Missing `storage_path` → toast. RLS/ownership issues documented in migrations (fix_teacher_materials_*).

---

### 3. Lesson planning generation (input → AI → persistence → display)

| Step | Where |
|------|--------|
| Entry | `/planificacion/nuevo` → PlanificacionWizard.tsx (or session edit in EditorSesionNuevo / EditorSesionTabs) |
| Input | Wizard: nivel, materia, fechas, metas, contenidos, competencias, etc. Units/sessions built in wizard or workspace. |
| AI call | `supabase.functions.invoke('generate-plan-completo', { body: { ... } })` — **no** `invokeEdgeFunctionAuthed` in PlanificacionWizard (line ~615) or PlanificacionWorkspace (line ~352) or EditorSesionNuevo (lines ~364, ~499). Session must be valid from AuthContext. |
| Contract | Edge returns `{ plan_html, argumento_competencias, recursos, titulo }`. HTML must contain `<section id="plan">` with H1/H2. |
| Parsing | `src/lib/planParser.ts`: parses HTML into inicio/desarrollo/cierre, recursos, diferenciacion. **Critical:** additive-only changes; must parse all existing saved plans. |
| Persistence | Planificaciones → `planificaciones` table; sessions → `sesiones_clase` (planificacion_id FK). Explicit save pattern: `is_saved`, `saved_at`. |
| Display | PlanificacionWorkspace, MisPlanificaciones; PlanningRenderer renders parsed sections. |

**Key files:** `src/pages/PlanificacionWizard.tsx`, `src/pages/PlanificacionWorkspace.tsx`, `src/components/planificacion/EditorSesionNuevo.tsx`, `src/components/planificacion/EditorSesionTabs.tsx`, `src/hooks/useFullSessionGeneration.ts`, `src/lib/planParser.ts`, `supabase/functions/generate-plan-completo/index.ts`, migrations `20250923163758_*` (planificaciones, sesiones_clase).

**Errors:** Missing Version A / plan_html → generation error. HTML parsing brittle (regex-based); AGENTS.md lists “Brittle HTML parsing” as known gap. Plan parser changes must stay backward compatible.

---

### 4. Assessment generation (Version A / B / C, accommodations, DUA)

| Step | Where |
|------|--------|
| Entry | `/evaluaciones/nuevo` → EvaluacionesGrupo.tsx |
| Input | Group, subject, competencias, contenidos, criterios logro, duration, design plan (instrument rules, response options, triggers for B/C, assignmentByStudentId, perStudentReminders). |
| Group/students | `getGroupContextForAI` from `src/services/groupContext/provider.ts`: students from **mockData** (resolveMockGroup), contemplaciones from **localStorage** (readSelected). No Supabase students table yet. |
| V2 path | If beta V2: `invokeEdgeFunctionAuthed('modify-evaluation-v2', { body: { modification, groupContext, evaluation_design_plan } })`. design_plan includes targetDurationMinutes, responseOptions, triggers, etc. |
| V1 path | Else: `invokeEdgeFunctionAuthed('modify-evaluation', ...)` (or fallback after V2 failure). |
| Edge V2 | `modify-evaluation-v2/index.ts`: builds prompts, calls OpenAI, validates/normalizes spec, ensures equivalentResponseOptions for open-ended items, duration estimate + auto-extend, returns JSON spec + aiReport + warnings. |
| Response | V2: `evaluationSpec` (sections/items), `aiReport`, `teacherRemindersByStudent`, `warnings`. V1: `evaluationBundle.versions.A/B/C` (HTML strings), assignments, etc. |
| Display | V2: normalizeV2Response → NormalizedEvaluation → EvaluationRendererV2 (MapTable, EvalSection, EvalItem). V1: displayEvaluations (cards from evaluationBundle.versions). |
| Save | evaluacion_generada.evaluation_spec (V2), evaluacion_generada.evaluaciones (minimal for V2 or full cards for V1). Save guard: hasV2Spec \|\| hasV1 (see phase-3-save-v2-spec-fix). |

**Key files:** `src/pages/EvaluacionesGrupo.tsx` (~3050 lines), `src/services/groupContext/provider.ts`, `src/services/evaluations/designPlan.ts`, `src/services/evaluations/requestService.ts`, `src/lib/edgeFunctionAuth.ts`, `src/components/evaluaciones/v2/EvaluationRendererV2.tsx`, `src/services/evaluations/v2Normalizer.ts`, `supabase/functions/modify-evaluation-v2/index.ts` (~4370 lines), `supabase/functions/modify-evaluation/index.ts`.

**Errors:** 401 (session invalid) → handled by invokeEdgeFunctionAuthed + AuthContext recovery. “Version A shows JSON wrapper” when backend returns JSON instead of HTML → defensive check in displayEvaluations (getSafeHtml: if starts with `{` show error HTML). Timeout → V2 fast fallback (fewer attempts / smaller model). Missing equivalentResponseOptions → edge fallback (RESPONSE_OPTIONS_FALLBACK_APPLIED).

---

### 5. Student profiles / contemplaciones in generation and reporting

| Step | Where |
|------|--------|
| Catalog | `src/lib/contemplaciones/catalog.ts`: CONTEMPLACIONES_CATALOG (ids 1–26, stable). Categories: clase, evaluaciones, ambas. Materializaciones: diseño_cuadernillo, recordatorio_docente, etc. |
| Storage | `src/lib/contemplaciones/storage.ts`: readSelected(studentId, category) → localStorage. Seeding: `src/lib/contemplaciones/seeding.ts`, seedDefaultsForStudent. |
| Group context | `getGroupContextForAI` / `loadGroupContext`: uses MockStudentDataSource → mockData students + readSelected for contemplaciones. Used by modify-evaluation and modify-evaluation-v2 payload. |
| Design plan | evaluation_design_plan includes perStudentReminders (admin/correction arrays), assignmentByStudentId (A/B/C), instrumentDesignRules. Contemplaciones feed into “recordatorios docente” and version triggers (B/C). |
| Reporting | Teacher reminders panel shows per-student admin/correction reminders; AI report (narrative) references contemplaciones applied. |

**Key files:** `src/lib/contemplaciones/catalog.ts`, `src/lib/contemplaciones/storage.ts`, `src/lib/contemplaciones/seeding.ts`, `src/services/groupContext/provider.ts`, `src/data/mockData.ts` (students per group), `src/services/evaluations/designPlan.ts`.

**Errors:** If students or contemplaciones missing, group context may be empty or defaults; generation still runs with fallbacks. No DB table for students yet (hybrid model).

---

## Data Model / DB Tables (best-effort from repo)

| Table | Purpose |
|-------|---------|
| auth.users | Supabase Auth (demo teacher/student). |
| profiles | user_id, display_name, role. RLS: auth.uid() = user_id. |
| planificaciones | user_id, nivel, materia, fechas, metas, config, etc. RLS by user_id. |
| sesiones_clase | planificacion_id (FK CASCADE), fecha, duracion_minutos, plan_desarrollo (JSONB), estado, etc. RLS via planificaciones. |
| evaluaciones | user_id, nombre, materia, grupo_id, is_saved, saved_at, deleted_at, evaluacion_generada (JSONB), ai_design_report, etc. RLS by user_id. |
| grupos | teacher_sugerencias (JSONB); used for group-level hints. |
| teacher_materials | user_id, title, storage_path, mime_type, extracted_text, etc. RLS and soft delete. |
| calendar / comunicaciones | Present in types; used by app. |

**Invariants (from AGENTS.md / .cursor/rules):** `is_saved = true` → in “Mis X” lists; `deleted_at IS NULL` → active; RLS enforces `auth.uid() = user_id` where applicable.

---

## AI Integration Overview

- **Provider:** OpenAI. API key in Edge Functions only: `Deno.env.get('OPENAI_API_KEY')` (e.g. in `generate-plan-completo/index.ts`, `modify-evaluation-v2/index.ts`). Not exposed to frontend.
- **Where prompts live:**
  - **Plans:** `supabase/functions/generate-plan-completo/index.ts` (system/user prompt building, coverage plan, section generation).
  - **Evaluations V1:** `supabase/functions/modify-evaluation/index.ts`.
  - **Evaluations V2:** `supabase/functions/modify-evaluation-v2/index.ts` (buildV2SystemPrompt, buildV2UserPrompt, regulation/version logic, narrative, duration auto-extend).
  - **Bulletin:** `supabase/functions/generate-bulletin-text/index.ts`.
  - **Material text:** `supabase/functions/extract-material-text/index.ts`.
- **Response handling:**
  - **Plans:** Expect JSON `{ plan_html, argumento_competencias, recursos, titulo }`; plan_html parsed by planParser (regex/section extraction).
  - **V1 eval:** HTML strings in evaluationBundle.versions.A/B/C; frontend getSafeHtml rejects content starting with `{` (JSON wrapper).
  - **V2 eval:** JSON spec; validateAndNormalizeSpec, ensureEquivalentResponseOptionsForOpenEnded, estimateDurationFromSpec, runDurationAutoExtend; narrative in aiReport.

---

## Errors & Root Causes (prioritized)

1. **401 on Edge Function calls**  
   **Cause:** Invalid or expired session (e.g. refresh token not found after DB reset). **Mitigation:** `invokeEdgeFunctionAuthed` + `ensureValidSession()` + AuthContext on SIGNED_OUT re-runs demo login. **Docs:** `docs/evaluations-upgrades/fix-v2-401-auth.md`. **Remaining risk:** Wrong anon key (e.g. publishable vs legacy JWT), env mismatch between local and deploy.

2. **“Version A shows HTML wrapper / JSON wrapper”**  
   **Cause:** Backend sometimes returns JSON or wrapped content instead of raw HTML for versions A/B/C. **Mitigation:** Frontend in EvaluacionesGrupo displayEvaluations useMemo: getSafeHtml checks `trimmed.startsWith('{')` and shows error HTML. **Where:** `src/pages/EvaluacionesGrupo.tsx` (e.g. around line 1969). **Root:** Contract not strictly enforced on edge or model returns non-HTML.

3. **Save blocked: “No hay evaluaciones generadas para guardar” (V2)**  
   **Cause:** Save guard used only `generatedEvaluations.length === 0`; in V2 mode displayEvaluations is empty. **Fix:** Guard changed to `(!hasV2Spec && !hasV1)` and minimal evaluaciones payload for V2. **Docs:** `docs/evaluations-upgrades/phase-3-save-v2-spec-fix.md`.

4. **Plan parser backward compatibility**  
   **Cause:** planParser is regex-based; any change can break existing saved plan HTML. **Mitigation:** Changes must be additive only; test with existing DB HTML.

5. **Deployment / env mismatch**  
   **Risk:** Production branch vs deploy branch, or missing/incorrect env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, OPENAI_API_KEY in Supabase). Client warns in DEV if anon key format unexpected (publishable vs legacy JWT). **Open:** No single “deployment checklist” doc found in repo.

---

## Code Smells / Architecture Issues (blocking rapid iteration)

1. **Overgrown components**
   - `src/pages/EvaluacionesGrupo.tsx` (~3050 lines): pipeline, V1/V2 branching, design plan, save, display, assignments, reminders, debug panel, all in one file.
   - `supabase/functions/modify-evaluation-v2/index.ts` (~4370 lines): prompts, validation, normalization, duration, narrative, version logic, reminders, in one file.
   - **Impact:** Hard to test, risky edits, long review cycles.

2. **Duplicated logic**
   - Multiple call sites invoke `modify-evaluation` or `modify-evaluation-v2` with different wrappers (EvaluacionesGrupo, EvaluationAdjustmentsPanel, requestService, useFullSessionGeneration, useAIPlanification, EditorSesionTabs, EnhancedEvaluationGenerator). Some use `invokeEdgeFunctionAuthed`, some use `supabase.functions.invoke` directly (planificación flows).
   - displayEvaluations / generatedEvaluations logic and Version A/B/C card building duplicated between EvaluacionesGrupo and EvaluacionDetalle.

3. **Mixed concerns**
   - EvaluacionesGrupo: UI, pipeline orchestration, design plan building, assignment normalization, save payload construction, error handling, and debug state in one component.
   - Edge modify-evaluation-v2: prompt building, HTTP, parsing, validation, business rules (duration, response options), and narrative building in one module.

4. **Weak typing / unsafe parsing**
   - Many `as unknown as T` or `Record<string, unknown>` in evaluation spec handling. DTOs from edge are not fully typed end-to-end.
   - Plan parser: regex-based; assumes specific HTML structure. No schema validation for AI JSON responses (only validateAndNormalizeSpec for V2).

5. **Inconsistent error handling**
   - Some flows show toast on error; others set local error state; others fallback silently (e.g. V2 → V1). No unified error boundary or user-facing error codes for “generation failed” vs “auth failed” vs “validation failed”.
   - Edge functions return different shapes (e.g. V1 vs V2 response); frontend branches on presence of evaluationSpec / evaluationBundle.

6. **Inconsistent API usage**
   - Planificación: `supabase.functions.invoke('generate-plan-completo', ...)` without invokeEdgeFunctionAuthed (relies on AuthContext keeping session valid).
   - Evaluaciones: `invokeEdgeFunctionAuthed('modify-evaluation-v2', ...)`. If planificación session expires mid-flow, generate-plan-completo could 401.

---

## Backlog of Improvements (prioritized for “many small UX/design realism changes”)

### Quick wins (low risk)

- **Centralize Edge invoke:** Use `invokeEdgeFunctionAuthed` for all Edge calls (including generate-plan-completo) so session is validated/refreshed before each call.
- **Extract evaluation pipeline state:** Move pipeline state (steps, result, error) from EvaluacionesGrupo into a custom hook (e.g. useEvaluationPipeline) so the page focuses on layout and actions.
- **Stable DTO types:** Add a small `evaluationV2Contract.ts` (or similar) that mirrors edge response shape and use it in requestService and normalizer; reduce `as unknown` casts.
- **Teacher-facing copy:** Audit toast titles and messages (e.g. “No hay evaluaciones generadas para guardar” → already fixed for V2); keep prompts in docs for future “teacher-friendly” wording without rewriting prompts yet.

### Medium risk

- **Split EvaluacionesGrupo:** Extract “Design plan form”, “Pipeline result / cards”, “Save block” into separate components or hooks; keep page as thin orchestrator.
- **Split modify-evaluation-v2:** Extract prompt builders, validateAndNormalizeSpec, duration helpers, narrative builder into separate files under the same function (e.g. v2Prompts.ts, v2Validation.ts, v2Duration.ts) for testability and readability.
- **Unified error surface:** Define a small set of error codes (AUTH_REQUIRED, GENERATION_FAILED, VALIDATION_FAILED, TIMEOUT) and map Edge/frontend errors to them; show consistent messages and recovery actions.

### Higher risk

- **Plan parser:** Any change is high risk. Prefer additive parsing (new optional sections) and run regression tests with real saved plan HTML from DB.
- **Students/contemplaciones in DB:** Moving from mockData + localStorage to Supabase would touch groupContext provider, design plan building, and possibly edge payloads; do as a dedicated migration with feature flag.

### Enabling speed (componentization / patterns)

- **Report text / narrative:** Keep narrative generation in edge; frontend only displays. For “teacher-friendly” improvements: (1) document current narrative structure in SSoT, (2) add optional “summary” field or template in edge that frontend can render in a consistent card, (3) avoid embedding HTML in narrative.
- **Reusable “generation result” UI:** One component that accepts `{ status, result?, error?, warnings? }` and renders loading/success/error/warnings consistently for both plan and evaluation flows.
- **Design plan as structured form:** Encapsulate “design plan” (duration, response options, triggers, assignments, reminders) in a single form component with typed state and validation, so EvaluacionesGrupo only passes it into the pipeline.

---

## Next Steps Plan (4 phases)

### Phase 1 — Investigation (this document)

- **Done:** Architecture overview, flow maps, data model sketch, AI integration, errors, backlog.
- **Artifact:** `/docs/project-audit/repo-investigation.md` (this file).

### Phase 2 — Planning

- **Actions:** (1) Choose first backlog items (e.g. centralize Edge invoke, extract pipeline hook). (2) Define acceptance criteria per item (e.g. “All Edge calls go through invokeEdgeFunctionAuthed”). (3) Document contract for evaluation V2 request/response in one place (SSoT or contract file). (4) Add “Deployment checklist” (env vars, branch, build) if missing.
- **Artifacts:** Short planning doc or tickets with acceptance criteria; optional contract snippet in SSoT.

### Phase 3 — Implementation

- **Likely touched:**  
  - Edge invoke: `PlanificacionWizard.tsx`, `PlanificacionWorkspace.tsx`, `EditorSesionNuevo.tsx`, `EditorSesionTabs.tsx`, `useFullSessionGeneration.ts`, `useBulletinGenerator.ts`, `useAIPlanification.ts`, `EnhancedEvaluationGenerator.tsx` (replace direct `supabase.functions.invoke` with `invokeEdgeFunctionAuthed` where JWT required).  
  - Pipeline hook: New `src/hooks/useEvaluationPipeline.ts` (or similar); `EvaluacionesGrupo.tsx` consumes it and renders UI.  
  - Contract/types: New `src/services/evaluations/v2Contract.ts` (or extend v2Types) and use in requestService + normalizer.  
- **Not touched in this phase:** planParser (unless additive only), DB schema, new dependencies.

### Phase 4 — Testing

- **Manual checklist:**  
  - Auth: Login as teacher → open evaluaciones → generate V2 → save → reopen detail (V2 render).  
  - Auth: Clear storage → reload → trigger Edge call → confirm recovery or clear error.  
  - Plan: Create plan → generate session → save → reopen; confirm parsed sections and resources.  
  - Materials: Upload → list → open; archive.  
  - V1 evaluation: Generate V1 → save → reopen (cards).  
- **Automated suggestions:** (1) Unit tests for planParser with fixture HTML (additive cases). (2) Unit tests for v2Normalizer with minimal spec JSON. (3) Contract tests for Edge request body shape (e.g. groupContext, evaluation_design_plan) if desired.

---

## Open Questions

1. **Env in production:** Is `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set in the deployment environment (e.g. Vercel/Lovable), and is `OPENAI_API_KEY` set in Supabase Edge Function secrets for the same project?
2. **Deploy branch:** Is production built from `main` or another branch? Any branch-specific env or build flags?
3. **Students in DB:** Is there a target date or decision to move students (and optionally contemplaciones) from mockData/localStorage to Supabase? This affects scope of “group context” refactors.

---

*Document path: `/docs/project-audit/repo-investigation.md`. Reference this path for follow-up work.*
