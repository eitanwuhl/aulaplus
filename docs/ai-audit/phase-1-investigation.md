# AULA+ AI Audit — Phase 1: Full Investigation

**Date:** 2026-02-13  
**Scope:** Investigation only. No refactors, no behavior changes, no new features.  
**Goal:** Complete map of every AI-related flow: entry points, orchestration, prompts, models, data contracts, persistence, and frontend surfaces.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [AI Feature Inventory](#2-ai-feature-inventory)
3. [End-to-End Flow Diagrams](#3-end-to-end-flow-diagrams)
4. [Prompts Appendix](#4-prompts-appendix)
5. [AI Config & Secrets Map](#5-ai-config--secrets-map)
6. [Observations & Risks](#6-observations--risks)
7. [Open Questions](#7-open-questions)
8. [Questions for the Developer](#8-questions-for-the-developer)

---

## 1. Executive Summary

- **Lesson plan generation (single/multi-session):** UI triggers `generate-plan-completo` (Supabase Edge Function). One OpenAI call per session (`gpt-4o-mini`). Output: `plan_html`, `ai_design_report` (narrative + structured). Persisted to `sesiones_clase` and optionally `planificaciones`. Narrative fallback can trigger a second OpenAI call for narrative-only.
- **Evaluation generation (V1):** `modify-evaluation` Edge Function. OpenAI `gpt-4.1-2025-04-14`, HTML/delimited output. Multiple code paths (universal, chat, legacy). Persisted to `evaluaciones.evaluacion_generada` and `evaluaciones.ai_design_report`.
- **Evaluation generation (V2):** `modify-evaluation-v2` Edge Function. Structured JSON (`EvaluationSpecV2`). Primary model `gpt-4.1-2025-04-14`; fast fallback `gpt-4o-mini`. Retry + emergency template (no OpenAI). Response includes `aiReport.narrative`. Frontend can use V2 JSON for `EvaluationRendererV2` or convert to V1-compatible HTML bundle.
- **Bulletin text generation:** `generate-bulletin-text` Edge Function. Single OpenAI call (`gpt-4.1-2025-04-14`, 400 max_tokens). Inline system + user prompts (History 9º, ANEP). No persistence in DB; UI consumes `generatedText` directly.
- **Material text extraction:** `extract-material-text` Edge Function. **Does not use AI.** Uses `unpdf` (PDF.js for Deno) to extract text from PDFs. Result stored in `teacher_materials.extracted_text`. Used as context for planning and (where wired) evaluation flows.
- **No other LLM providers** were found; all AI paths use OpenAI via Edge Functions. API key: `OPENAI_API_KEY` (Supabase Secrets).

---

## 2. AI Feature Inventory

| Feature name | Trigger location (UI) | Orchestrator | Provider / model | Prompt source location | Input data contract | Output data contract | Persistence | Known failure modes / logs |
|-------------|------------------------|--------------|------------------|-------------------------|---------------------|----------------------|-------------|----------------------------|
| **Lesson plan generation** | `PlanificacionWizard.tsx`, `PlanificacionWorkspace.tsx`, `EditorSesionNuevo.tsx`, `EditorSesionTabs.tsx` | `generate-plan-completo` Edge Function | OpenAI `gpt-4o-mini`; narrative fallback same or second call | `supabase/functions/generate-plan-completo/index.ts` ~line 926–1147 (single user prompt + system "Eres un asistente pedagógico experto.") | `modo`, `sesionId`, `orden`, `duracionMin`, `materia`, `nivel`, `contenidos[]`, `competencias[]`, `criterios[]`, `unitContext`, `sessionBrief`, `materialsContext`, `perfilGrupo`, `estudiantes`, `instruccionesDocente`, `planActual` (optional) | `plan_html`, `argumento_competencias`, `recursos[]`, `titulo`, `ai_design_report` (narrative, report_narrative, report_technical, contentCoverage, competencyDevelopment, etc.), `report_narrative`, `report_technical`, `plan_json` | `sesiones_clase.plan_desarrollo`, `sesiones_clase.ai_design_report`, `sesiones_clase.argumento_competencias`, `sesiones_clase.recursos`; optionally `planificaciones.ai_design_report` | JSON parse failure → fallback object with local buildContentCoverage/buildCompetencyDevelopment. Missing/short narrative → second OpenAI call or local `buildTeacherReportNarrative`. Logs: `[GEN_PLAN]`, `[AI_REPORT_SESSION]`, `[NARRATIVE]`. BOOT_ERROR if redeclared identifiers (e.g. hasNarrative). |
| **Evaluation generation V1** | `EvaluacionesGrupo.tsx`, `requestService.ts`, `EnhancedEvaluationGenerator.tsx`, `EditorSesionTabs.tsx`, `useAIPlanification.ts`, `useFullSessionGeneration.ts` | `modify-evaluation` Edge Function | OpenAI `gpt-4.1-2025-04-14` (universal/legacy); `gpt-5-mini-2025-08-07` (chat path) | `modify-evaluation/index.ts` ~2144 (system), ~2204 (user); ~3017–3411 (legacy/chat paths) | `modification`, `groupContext`, `generation_mode`, `type`, `adaptationLevel`; legacy paths use different payloads | HTML bundles (baseHtml, versionBHtml, versionCHtml), optional aiReport | `evaluaciones.evaluacion_generada` (JSONB), `evaluaciones.ai_design_report` | Multiple code paths; response shape varies by path. Logs: `[OPENAI_PROMPT]`. |
| **Evaluation generation V2** | `EvaluacionesGrupo.tsx`, `requestService.ts`, `EvaluationAdjustmentsPanel.tsx` | `modify-evaluation-v2` Edge Function | OpenAI `gpt-4.1-2025-04-14` (first attempt); `gpt-4o-mini` (fast fallback); emergency template (no OpenAI) | `modify-evaluation-v2/index.ts`: `buildV2SystemPrompt()` ~1128, `buildV2UserPrompt()` ~1316; adjustment section for `mode=adjust` | `mode`, `modification`, `groupContext`, `evaluation_design_plan`, optional `currentEvaluationSpec`, `adjustmentDetails` | `success`, `evaluationSpec` (EvaluationSpecV2), `aiReport` (narrative, etc.), `warnings`, `debug` (attempts, timings) | Same as V1 when saved: `evaluaciones.evaluacion_generada` (includes spec + HTML conversion), `evaluacion_generada.ai_report`, `evaluaciones.ai_design_report` | Timeout → retry with gpt-4o-mini, Version A only. Both fail → emergency template. Parse/validation errors → retry. Logs: timer marks, `[PAYLOAD]`, attempt outcomes. |
| **Bulletin text generation** | `GeneradorTextosBoletin.tsx` via `useBulletinGenerator.ts` | `generate-bulletin-text` Edge Function | OpenAI `gpt-4.1-2025-04-14`; max_tokens 400, temperature 0.7 | Inline in `generate-bulletin-text/index.ts`: systemPrompt ~21–84, userPrompt ~86–104 | `student`, `period`, `contemplaciones`, `academicHistory`, `qualitativeComments`, `customAspects` | `{ generatedText }` | None (ephemeral; UI displays or copies) | No retry. Logs: console.log Successfully generated / OpenAI API error. |
| **Material text extraction** | Triggered from materials library / upload flows (e.g. extract button or post-upload) | `extract-material-text` Edge Function | **No AI.** Uses `unpdf` (esm.sh/unpdf@1.2.2) | N/A | `materialId` (body or query) | `extracted_text`, `pages_used`, `truncated` | `teacher_materials.extracted_text` (TEXT) | PDF download/storage errors; unpdf extraction errors. Logs: `[extract-material-text]`. |

---

## 3. End-to-End Flow Diagrams

### 3.1 Generate lesson plan (single or multi-session)

1. **UI:** User completes wizard or clicks “Generar” in workspace/editor.  
   - **Call sites:** `PlanificacionWizard.tsx` (batch), `PlanificacionWorkspace.tsx` (single session), `EditorSesionNuevo.tsx`, `EditorSesionTabs.tsx`.
2. **Request:** `POST` to Edge Function `generate-plan-completo` with body: `modo`, `sesionId`, `orden`, `duracionMin`, `materia`, `nivel`, `contenidos`, `competencias`, `criterios`, `unitContext`, `sessionBrief`, `materialsContext`, `perfilGrupo`, `estudiantes`, `instruccionesDocente`, optional `planActual`, `__dry_run`.
3. **Edge Function:** Validates `duracionMin`; handles OPTIONS/200; builds coverage plan and single concatenated user prompt; system message fixed: "Eres un asistente pedagógico experto."
4. **OpenAI:** One `POST https://api.openai.com/v1/chat/completions` with `gpt-4o-mini`, temperature 0.7, no explicit max_tokens. Retry with backoff (3 attempts, 2s base).
5. **Parse:** `JSON.parse(content)`; on failure, build fallback object and local contentCoverage/competencyDevelopment/teacherRequirementsApplied; ensure narrative (if missing/short, optional second OpenAI call or `buildTeacherReportNarrative`).
6. **Response:** Returns `plan_html`, `argumento_competencias`, `recursos`, `titulo`, `ai_design_report`, `report_narrative`, `report_technical`, `plan_json`.
7. **DB write:** Frontend updates `sesiones_clase` with `plan_desarrollo.html_completo`, `argumento_competencias`, `recursos`, `ai_design_report`; optionally `planificaciones.ai_design_report`.
8. **UI read:** `PlanificacionWorkspace` / `EditorSesionNuevo` show plan HTML; single “Reporte de IA” panel bound to selected session shows `report_narrative` (or narrative from `ai_design_report`), with “Ver detalle técnico” for `report_technical`.

### 3.2 Generate evaluation (V2 path)

1. **UI:** User clicks generate in group evaluations screen; `requestService` uses beta toggle to call V2 first.
2. **Request:** `POST` to `modify-evaluation-v2` with `modification`, `groupContext`, `evaluation_design_plan`. Optional `mode=adjust` with `currentEvaluationSpec` and `adjustmentDetails`.
3. **Edge Function:** Handles `__ping` / `__debugNarrative`; parses body; computes requested versions (A/B/C); builds system prompt via `buildV2SystemPrompt`, user prompt via `buildV2UserPrompt`; in adjust mode appends `buildAdjustmentSection`.
4. **OpenAI:** `generateEvaluationV2` runs up to 3 attempts: first full (55s timeout, gpt-4.1-2025-04-14, 6000 max_completion_tokens, response_format json_object); on timeout/parse/validation error, retry with gpt-4o-mini, 24s timeout, 1800 tokens, reduced prompts (Version A only); if both fail, emergency template (no OpenAI).
5. **Parse/validate:** JSON parse; schema validation; if invalid, retry or emergency.
6. **Response:** `success`, `evaluationSpec`, `aiReport` (includes narrative), `warnings`, `debug`. Frontend may convert to V1-style bundle for legacy UI or use `v2RawResponse` for `EvaluationRendererV2`.
7. **DB write:** EvaluacionesGrupo (or caller) persists `evaluacion_generada` (with spec and/or HTML), `evaluacion_generada.ai_report`, `ai_design_report`.
8. **UI read:** Evaluation detail/detalle loads `evaluacion_generada?.ai_report || ai_design_report`; shows narrative; renders evaluation via HTML or V2 JSON renderer.

### 3.3 Generate bulletin text

1. **UI:** `GeneradorTextosBoletin.tsx` uses `useBulletinGenerator({ student })`; user triggers generate.
2. **Request:** `POST` to `generate-bulletin-text` with `student`, `period`, `contemplaciones`, `academicHistory`, `qualitativeComments`, `customAspects`.
3. **Edge Function:** Builds system prompt (History 9º ANEP, structure, tone) and user prompt (interpolates student and period data).
4. **OpenAI:** Single call, `gpt-4.1-2025-04-14`, max_tokens 400, temperature 0.7.
5. **Response:** `{ generatedText }`. No DB; UI displays/copies.

### 3.4 Extract material text (no AI)

1. **UI:** Materials library or upload flow invokes extraction (e.g. after upload or “Re-extraer”).
2. **Request:** `POST` to `extract-material-text` with `materialId`; auth via Authorization header.
3. **Edge Function:** Validates user; fetches PDF from storage; uses `unpdf` `extractText(pdfBytes, { mergePages: true })`; truncates to MAX_CHARS (10000) and MAX_PAGES (5).
4. **DB write:** Updates `teacher_materials.extracted_text` for `materialId`.
5. **UI read:** Planning/wizard and workspace load materials with `extracted_text` and send as `materialsContext` to `generate-plan-completo`.

---

## 4. Prompts Appendix

### 4.1 generate-plan-completo

- **System message (fixed):**  
  `Eres un asistente pedagógico experto.`
- **User message (template):**  
  Single large template starting at line ~926. Variables interpolated: `modo`, `orden`, `duracionMin`, `materia`, `nivel`, `contenidos` (joined), `competencias` (joined), `criterios` (joined), `sessionBriefSection`, `secuenciaContext`, `coverageSection`, `groupProfileSection`, `instruccionesDocenteSection`, `materialsSection`, `planActual`. Template includes:
  - Context block (materia, nivel, contenidos, competencias, criterios).
  - Optional sessionBrief section (ENFOQUE ESPECÍFICO DE ESTA SESIÓN).
  - Optional unitContext section (secuencia didáctica, first/intermediate/last class instructions).
  - Optional coverageSection (sessionCoverage from buildCoveragePlan).
  - Optional groupProfileSection (perfilGrupo, estudiantes with contemplaciones).
  - Optional instruccionesDocenteSection.
  - Optional materialsSection (with materials-only rules and division rules if unitContext).
  - Required HTML structure (Inicio/Desarrollo/Cierre, Diferenciación/Adaptaciones).
  - Required “REPORTE NARRATIVO DE DISEÑO” and exact JSON schema for `plan_html`, `argumento_competencias`, `recursos`, `titulo`, `ai_design_report` (narrative, inputsUsed, decisions, assumptions, contentCoverage, competencyDevelopment, teacherRequirementsApplied, standardsCoverage, competenciesOperationalization).
- **Narrative fallback (second call, if narrative missing/short):**  
  Separate user prompt with `coverageContext`, session metadata, and instructions to output only narrative text (no JSON). Same system as main call. Model `gpt-4o-mini`, max_completion_tokens 500, temperature 0.7.

### 4.2 modify-evaluation-v2

- **System message:**  
  From `buildV2SystemPrompt(responseOptionsInclude, responseOptionCount, requestedVersions)`. Contains: JSON-only rules; no diagnostic inference; evidence written; CE/CL from input; version A/B/C rules; equivalentResponseOptions rules; full JSON schema for EvaluationSpecV2 including `aiReport.narrative`; item types; narrative rules and “Cobertura de Contenidos” requirements. Variable parts: Version B/C instructions when requested, response option count.
- **User message:**  
  From `buildV2UserPrompt(groupContext, modification, instrumentDesignRules, requestedVersions)`. Interpolates: `groupContext.subject`, `groupName`, `content` (contenidos), `competencies`, `criteriosLogro`, `students.length`, version requests, instrumentDesignRules, modification. In adjust mode, appended with `buildAdjustmentSection(currentEvaluationSpec, adjustmentDetails, modification)`.
- **Fast fallback (retry):**  
  Reduced system prompt (Version A only, no narrative/versionedContent/equivalent options); reduced user prompt (essential parts only or truncated). Model `gpt-4o-mini`, max_completion_tokens 1800, temperature 0.4.

### 4.3 modify-evaluation (V1)

- **Universal path (~2144):**  
  System: “Eres un especialista en evaluación educativa. Tu tarea es generar una evaluación escrita universal, lista para entregar.” + instructions. User: “CONTEXTO DEL GRUPO:” + group + modification + instructions. Model `gpt-4.1-2025-04-14`, max_completion_tokens 6000.
- **Legacy/Chat paths (~3017–3411):**  
  Multiple branches (chat, planning, History 9º) with different system/user prompts; one uses `gpt-5-mini-2025-08-07`, others `gpt-4.1-2025-04-14`, max_completion_tokens 4000.

### 4.4 generate-bulletin-text

- **System:**  
  Long fixed prompt: History 9º ANEP focus, key concepts, competencias, structure for evaluations and planifications, mandatory guidelines (strengths, constructive language, third person, 90–140 words, no greeting/signature), format and History-specific mentions.
- **User:**  
  Interpolates `student.name`, `student.perfil`, `period`, `contemplaciones`, `academicHistory`, `qualitativeComments`, `customAspects`; ends with instruction to generate bulletin text for History 9º, max 140 words.

---

## 5. AI Config & Secrets Map

| Secret / config | Where expected | Where read | Notes |
|-----------------|----------------|------------|--------|
| `OPENAI_API_KEY` | Supabase project (Edge Functions) | `Deno.env.get('OPENAI_API_KEY')` in: `generate-plan-completo` (via getOpenAIApiKey()), `modify-evaluation`, `modify-evaluation-v2`, `generate-bulletin-text` | Set via Supabase Dashboard → Project Settings → Edge Functions → Secrets, or CLI: `supabase secrets set OPENAI_API_KEY=sk-...` |
| `SUPABASE_URL` | Supabase runtime | `extract-material-text`, `ensure-demo-users`, `modify-evaluation` (for service client) | Injected by Supabase for Edge Functions |
| `SUPABASE_ANON_KEY` | Supabase runtime | `extract-material-text` (user client) | Injected by Supabase |
| `SERVICE_ROLE_KEY` | Supabase runtime | `extract-material-text`, `modify-evaluation`, `ensure-demo-users` | Injected by Supabase; elevated privileges |

No prompt versioning or A/B toggles were found in repo (only evaluation V1 vs V2 endpoint and beta toggle in frontend).

---

## 6. Observations & Risks

- **Inconsistent response shapes:**  
  V1 returns HTML bundles and optional aiReport; V2 returns structured JSON plus converted bundle. Frontend normalizes V2 to V1-style for some code paths. Multiple places expect `evaluacion_generada.ai_report` or `ai_design_report`; priority and fallback differ by screen.

- **UI expects one shape, backend another:**  
  Planning report: backend now returns `report_narrative` and `report_technical`; frontend still normalizes from `ai_design_report.narrative` / `report_narrative`. Evaluation: some components expect HTML in `evaluacion_generada`; V2 stores spec and may store converted HTML; `equivalentResponseOptions` sometimes array vs object, normalized in `v2Normalizer.ts`.

- **Version A/B/C and equivalent options:**  
  V2 fast fallback drops B/C and equivalent options; UI may show “Version A only” or warnings. Emergency template produces minimal valid spec (no narrative).

- **Logging gaps:**  
  Planning: `[GEN_PLAN]` and narrative logs present; no centralized request ID across planning + evaluation. V2 has timer/requestId and attempt logs; V1 has `[OPENAI_PROMPT]` length logs. Bulletin and extract-material-text have minimal structured logs.

- **Coupling / large components:**  
  `EvaluacionesGrupo.tsx` and `modify-evaluation/index.ts` are large and branchy; multiple entry points for evaluations (requestService, direct invoke from EvaluacionesGrupo, EditorSesionTabs, EnhancedEvaluationGenerator, useAIPlanification, useFullSessionGeneration). Planning entry points: PlanificacionWizard, PlanificacionWorkspace, EditorSesionNuevo, EditorSesionTabs.

- **Narrative and report persistence:**  
  Planning: `ai_design_report` (and narrative) stored per session and optionally aggregated on planificación. Evaluation: both `evaluacion_generada.ai_report` and top-level `ai_design_report` written; frontend reads `evaluacion_generada?.ai_report || ai_design_report`. Risk of one path overwriting or not persisting the other.

- **Material extraction not AI:**  
  Often listed in “AI” docs; it is not. Clarifying in this audit to avoid confusion.

---

## 7. Open Questions

- Whether any prompt text or templates are stored in the database (e.g. per-tenant or A/B). No such tables or columns were found in migrations or types.
- Exact canonical schema for “evaluation” output: V1 is HTML-centric; V2 is EvaluationSpecV2 JSON. Intended canonical for storage and for future PDF/print is not documented in one place.
- Whether V2 request payload is ever extended with `materialsContext` or content summaries from materials for evaluation generation; currently only `groupContext.content` and `modification` were seen.
- Where equivalent-response-options UI is rendered and whether it matches backend shape in all cases (array vs object).
- Intended behavior when both V1 and V2 are called (e.g. fallback path): which response is persisted and how UI decides which to show.

---

## 8. Questions for the Developer

1. **Provider and environments:**  
   Should the source of truth for “AI” remain OpenAI only, or are other providers (e.g. Azure OpenAI, local models) planned? Are there separate envs (local / staging / production) with different AI behavior or keys?

2. **Prompt versioning:**  
   Is there (or should there be) a prompt versioning strategy (e.g. versions in DB, A/B tests, or tagged prompts in code)?

3. **Canonical evaluation schema:**  
   What is the intended canonical schema for “evaluation” and “rubric” outputs: V1 HTML bundle, V2 JSON spec, or a single normalized format? Should PDF/print always be driven from V2 spec?

4. **Prompts in database:**  
   Is any prompt text stored in the database (e.g. per group, subject, or tenant)? If not, is that intentional for the foreseeable future?

5. **Problematic screens/flows:**  
   Which screens or user flows are known to be problematic (e.g. report not showing, wrong version shown, timeouts, or “answer options in a separate box”) so the next phase can prioritize them?

6. **V2 vs V1 and fallback:**  
   When V2 is used and then fallback to V1 occurs, what is the intended UX and persistence (e.g. always persist V1 result, or show error and allow retry)? Should the beta toggle remain the only way to choose V2?

7. **Bulletin and extract:**  
   Should bulletin text ever be persisted (e.g. per student/period)? For extract-material-text, is the 10k char / 5 page limit intentional and documented for users?

---

*End of Phase 1 Investigation. No code was modified.*
