# Phase 3 Block 3i — Semantic Swap B/C + Teacher-Friendly AI Report

**Branch:** `mejorar-evaluaciones`  
**Scope:** Backend only (`supabase/functions/modify-evaluation-v2/index.ts`)

---

## 1) Resumen del swap semántico (B <-> C)

Se aplicó el swap canónico solicitado:

- **A** = universal base (siempre).
- **B** = **content adaptation declared** (NO comparable con A/C).
- **C** = **equivalent accessibility adaptation** (mismos objetivos/criterios/rúbrica y misma demanda cognitiva que A).

Cambios críticos implementados:

- `requestedVersions`:
  - `B` depende de `declaredContentAdaptationCount > 0`
  - `C` depende de `versionCDecision.shouldCreateC` (paquete de diseño equivalente)
- Asignación de estudiantes:
  - `declaredContentAdaptationByStudent` ahora enruta a **B**
  - `C` queda para accesibilidad equivalente
- `versionVariants` labels/reasons (prompt + salida):
  - `Version B (Content Adaptation - Declared)`
  - `Version C (Equivalent Accessibility Adaptation)`

---

## 2) Secciones de código cambiadas (funciones/zonas)

Archivo: `supabase/functions/modify-evaluation-v2/index.ts`

- **Constantes y contrato debug**
  - `DEBUG_BUILD` actualizado a `v3-swap-bc-teacher-report-DEPLOY-FP-2026-02-17-01`
  - `V2Response.debug` extendido con:
    - `versionCDecision`
    - `declaredContentAdaptationCount`
    - `semanticMap`
- **Regulación V3 / decisiones de versión**
  - `resolveDeclaredContentAdaptationByStudent(...)`
  - `resolveAssignedStudentsByVersion(...)` (ruta declarada -> B)
  - `evaluateDesignPackageNeedForC(...)` (antes lógica B-equivalente)
- **Narrativa docente por versión**
  - `buildVersionRationalePack(...)`
  - `buildSpecEvidenceSummary(...)`
  - `selectEvidenceReferences(...)` (ejemplos concretos con lenguaje docente)
  - `buildDeterministicEvidenceAppendix(...)`
  - `ensureNarrativeHasEvidence(...)`
  - `applyNarrativeEvidenceByVersion(...)`
  - `hasNarrativeEvidenceMarkers(...)`
- **Orden del success path**
  1) `ensureByVersionNarratives(baseAiReport, ...)`
  2) `applyNarrativeEvidenceByVersion(baseAiReport, ...)`
  3) `normalizeAiReportForFrontend(...)`
  4) `ensureByVersionNarratives(normalizedAiReport, ...)`
  5) `applyNarrativeEvidenceByVersion(normalizedAiReport, ...)`
- **Prompts y metadata de versiones**
  - `buildV2SystemPrompt(...)`
  - `buildV2UserPrompt(...)`
  - `generateMissingByVersionNarrativesCall(...)`
  - etiquetas/razones B/C en `versionVariants`.

---

## 3) Deploy ejecutado (salida terminal)

### 3.1 Link

Comando:

- `supabase link --project-ref srlrbuphsogwgymqywhe`

Salida:

```text
Finished supabase link.
```

### 3.2 Deploy function

Comando:

- `supabase functions deploy modify-evaluation-v2`

Salida:

```text
WARNING: Docker is not running
Uploading asset (modify-evaluation-v2): supabase/functions/modify-evaluation-v2/index.ts
Deployed Functions on project srlrbuphsogwgymqywhe: modify-evaluation-v2
```

---

## 4) Evidencia runtime real post-deploy (excerpt)

Se ejecutó una invocación real con escenario:
- 1 estudiante con adaptación declarada de contenido (debe ir a **B**)
- 1 estudiante con paquete de accesibilidad equivalente (debe ir a **C**)

Excerpt relevante (redactado):

```json
{
  "requestedVersions": { "A": true, "B": true, "C": true },
  "evaluationSpec": {
    "versionVariants": {
      "A": { "label": "Versión A (Universal)", "isBase": true },
      "B": { "label": "Version B (Content Adaptation - Declared)" },
      "C": { "label": "Version C (Equivalent Accessibility Adaptation)" }
    }
  },
  "aiReport": {
    "byVersion": {
      "A": { "narrative": "...Quiénes usan esta versión: Ana Pérez... Por qué existe esta versión (causas): ... Cómo se refleja en la evaluación (ejemplos concretos): ... Equivalencia y exigencia: ..." },
      "B": { "narrative": "...Quiénes usan esta versión: María Silva... no es comparable con A/C... Evidencia interna (para trazabilidad): ..." },
      "C": { "narrative": "...Quiénes usan esta versión: Juan López... mismos objetivos, misma demanda cognitiva y misma rúbrica... Evidencia interna (para trazabilidad): ..." }
    }
  },
  "debug": {
    "build": "v3-swap-bc-teacher-report-DEPLOY-FP-2026-02-17-01",
    "aiReportByVersionKeys": ["A", "B", "C"],
    "aiReportByVersionLens": { "A": 1896, "B": 2377, "C": 2132 },
    "aiReportByVersionHasEvidence": { "A": true, "B": true, "C": true },
    "versionCDecision": {
      "shouldCreateC": true,
      "explanation": "Se crea versión C: paquete de diseño equivalente detectado..."
    },
    "declaredContentAdaptationCount": 1,
    "semanticMap": {
      "A": "universal",
      "B": "content_adaptation_declared",
      "C": "equivalent_accessibility"
    }
  }
}
```

Notas de verificación en el excerpt:
- `debug.build` coincide con fingerprint nuevo.
- `requestedVersions` refleja semántica nueva.
- Narrativas tienen headings exigidos y nombres de estudiantes.
- Se usan etiquetas humanas (no IDs numéricos de contemplación).
- `evaluationSpec` se mantiene sin `aiReport` embebido (contrato root canonical).

---

## 5) Checklist de aceptación (estado)

- [x] Swap semántico B/C aplicado en lógica de decisión, prompts y narrativa.
- [x] B solo por adaptación de contenido declarada.
- [x] C solo por decisión determinística de accesibilidad equivalente.
- [x] Narrativas A/B/C con WHO/WHY/WHERE + equivalencia/no-comparabilidad según corresponda.
- [x] Debug requerido presente (`build`, `keys`, `lens`, `hasEvidence`, `versionCDecision`, `declaredContentAdaptationCount`, `semanticMap`).
- [x] Deploy ejecutado y evidencia runtime post-deploy incluida.
