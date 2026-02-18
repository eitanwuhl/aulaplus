# Phase 3 Block 3h — Canonical Regulation V3 Implementation Report

**Branch:** `mejorar-evaluaciones`  
**Primary file changed:** `supabase/functions/modify-evaluation-v2/index.ts`

---

## 1) Files changed

- `supabase/functions/modify-evaluation-v2/index.ts`
- `docs/evaluations-upgrades/phase-3-block-3h-regulation-v3-implementation-report.md` (this report)

No frontend, persistence, PDF, or rubric files were changed.

---

## 2) Deterministic rules implemented

### 2.1 Canonical regulation layers and contemplation catalog

- Added deterministic table `CONTEMPLATION_REGISTRY` (`contemplacionId -> { category, label, canonicalKey }`) with required IDs:
  - **DESIGN:** `2,4,5,12,13,14,16,17,18,19,23,27`
  - **ADMIN:** `1,3,6,7,8,10,11,15,20,21,24,25,26`
  - **CORRECTION:** `9,22`
- Added **ID 27** as DESIGN:
  - label: `Mnemonic starter cues (anchors/guide words)`
  - represented as scaffolding only (no answer leak in deterministic appendix text).
- Trigger normalization is deterministic (lowercase/trim/whitespace collapse + variant mapping).

### 2.2 Versioning minimization rules (A/B/C)

- **A** always true.
- **B** now uses deterministic decision function:
  - `evaluateDesignPackageNeedForB(...)` returns:
    - `shouldCreateB`
    - `explanation`
    - `triggersUsed`
  - Decision is based on DESIGN package distribution and barrier signals (not ADMIN/CORRECTION-only).
- **C** now requires explicit declaration:
  - `resolveDeclaredContentAdaptationByStudent(...)`
  - only explicit `declaredContentAdaptationByStudent` + `hasDeclaredContentAdaptation` are considered
  - removed implicit `requiresContentAdaptation` as trigger for creating C.

### 2.3 WHO/WHY/WHERE deterministic evidence builders

- Implemented/updated:
  - `resolveAssignedStudentsByVersion(...)`
  - `extractTriggersForStudents(...)` with strict source priority:
    1) `designPlan.contemplacionesByStudent`
    2) `groupContext.students[].contemplaciones`
    3) `teacherRemindersByStudent.admin/correction`
    4) fallback `[{ key: "(sin datos)", count: n }]`
  - `buildVersionRationalePack(...)`
  - `buildSpecEvidenceSummary(...)`:
    - `sections[{id,title,itemCount}]`
    - `items[{id,sectionId,type,points,hasB,hasC,hasOptionsB,hasEquivalentResponseOptions}]`
    - `changedItemsB`, `changedItemsC`
  - `ensureNarrativeHasEvidence(...)`
  - `applyNarrativeEvidenceByVersion(...)`
  - `hasNarrativeEvidenceMarkers(...)`

### 2.4 Required handler ordering

In success path:

1. `ensureByVersionNarratives(baseAiReport, ...)`  
2. `applyNarrativeEvidenceByVersion(baseAiReport, ...)`  
3. `normalizeAiReportForFrontend(...)`  
4. safety `ensureByVersionNarratives(normalizedAiReport, ...)`  
5. safety `applyNarrativeEvidenceByVersion(normalizedAiReport, ...)`

### 2.5 Debug and evidence checks

- `debug.build` updated to:
  - `v3-regulation-evidence-DEPLOY-FINGERPRINT-2026-02-16-01`
- Added/kept:
  - `debug.aiReportByVersionKeys`
  - `debug.aiReportByVersionLens`
  - `debug.aiReportByVersionHasEvidence`
  - `debug.versionBDecision`
  - `debug.declaredContentAdaptationCount`
- Added runtime evidence log emission before response:
  - `console.log('[AI_REPORT_EVIDENCE_CHECK]', { ... })`

`aiReportByVersionHasEvidence` is true iff narrative contains:
- marker `"Who uses this version"` **or** `"Quiénes usan esta versión"` (normalized)
- and `/item-[a-z0-9_-]+/`
- and at least one known contemplation label from catalog.

---

## 3) Deployment and runtime evidence

### 3.1 Deploy

Command executed:

- `supabase functions deploy modify-evaluation-v2`

Result: function deployed successfully to project `srlrbuphsogwgymqywhe`.

### 3.2 Real network invocation (post-deploy)

A real POST was executed against:

- `https://srlrbuphsogwgymqywhe.supabase.co/functions/v1/modify-evaluation-v2`

with an A+B+C payload (including explicit `declaredContentAdaptationByStudent`).

#### Response excerpt (redacted / relevant)

```json
{
  "success": true,
  "requestedVersions": { "A": true, "B": true, "C": true },
  "aiReport": {
    "byVersion": {
      "A": { "narrative": "...Quiénes usan esta versión: ... Dónde se refleja en la evaluación (evidencia en ítems): ... item-... ..." },
      "B": { "narrative": "...Mnemonic starter cues (anchors/guide words)... Segmentación de consignas en pasos claros... item-..." },
      "C": { "narrative": "...adaptación de contenido declarada... no equivalente/comparable... item-..." }
    }
  },
  "debug": {
    "build": "v3-regulation-evidence-DEPLOY-FINGERPRINT-2026-02-16-01",
    "aiReportByVersionKeys": ["A", "B", "C"],
    "aiReportByVersionLens": { "A": 1798, "B": 1672, "C": 1629 },
    "aiReportByVersionHasEvidence": { "A": true, "B": true, "C": true },
    "versionBDecision": {
      "shouldCreateB": true,
      "explanation": "Se crea versión B: paquete de diseño detectado (estudiantes con diseño=2/3; claves=5).",
      "triggersUsed": [
        "Mnemonic starter cues (anchors/guide words) (1)",
        "Segmentación de consignas en pasos claros (1)",
        "Opciones equivalentes de respuesta escrita (1)"
      ]
    },
    "declaredContentAdaptationCount": 1
  }
}
```

---

## 4) Acceptance tests

### A) Network evidence

- PASS: `root.aiReport.byVersion` includes `A`, `B`, `C` when effective.
- PASS: per-version narratives include WHO/WHY/WHERE markers with `item-*`.
- PASS: `evaluationSpec` is returned without embedded `aiReport` (root remains canonical).

### B) Human-friendly labels

- PASS: narrative includes labels like:
  - `Mnemonic starter cues (anchors/guide words)`
  - `Segmentación de consignas en pasos claros`
  - `Plantillas de respuesta`
- PASS: no `contemplacion-12` style numeric IDs in narrative output.

### C) UI sanity note

- Backend contract now returns version-distinct, evidence-based narratives.
- Manual UI check (A→B→C switch in app) remains required on frontend session to confirm rendered switching behavior end-to-end.

---

## 5) Notes

- The report includes real post-deploy function invocation evidence from the response JSON.
- Server log emission (`[AI_REPORT_EVIDENCE_CHECK]`) is implemented in code; dashboard log capture should be verified in Supabase Functions logs for full operational traceability.
