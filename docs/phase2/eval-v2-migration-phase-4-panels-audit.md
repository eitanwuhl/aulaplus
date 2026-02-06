# Phase 4: Panels Audit - V1 vs V2 Migration

> **Date**: 2026-02-06  
> **Branch**: eval-v2-migration  
> **Reference Branch**: fixing/general-errors

## 1. Panels Found in `fixing/general-errors`

This section documents all UI sections/panels rendered after generating an evaluation in the `fixing/general-errors` branch.

### Panel Inventory

| # | Panel Name | Component | File Path | Data Source | Props |
|---|------------|-----------|-----------|-------------|-------|
| 1 | Debug Panel | Inline Card | EvaluacionesGrupo.tsx | `pipelineDebug`, `evaluationBundle` | `showDebugPanel`, debug vars |
| 2 | Assignment Warnings | Inline Card | EvaluacionesGrupo.tsx | `assignmentWarnings` state | `assignmentWarnings: string[]` |
| 3 | Per-Student Assignments | `EvaluationAssignmentsPanel` | `src/components/evaluaciones/EvaluationAssignmentsPanel.tsx` | `studentAssignments`, `selectedGroup?.students` | `assignments: Record<string, 'A'\|'B'\|'C'>`, `students: Array` |
| 4 | Teacher Reminders | `TeacherRemindersPanel` | `src/components/evaluaciones/TeacherRemindersPanel.tsx` | `teacherReminders`, `missingTemplateErrors` | `reminders: StudentReminders[]`, `students: Array`, `missingTemplateErrors?` |
| 5 | Evaluation Content | `EvaluacionVisualRenderer` | `src/components/evaluaciones/EvaluacionVisualRenderer.tsx` | `displayEvaluations` computed | `evaluation`, `subject`, `selectedContent`, `duration`, `requirements`, `students`, `criteriosLogro`, `onFeedback`, `onRegenerate` |
| 6 | AI Design Report | `AIDesignReport` | `src/components/evaluaciones/AIDesignReport.tsx` | `aiDesignReport` state | `reportData: AIDesignReportData`, `className?` |
| 7 | Criterios de Logro | Inline Card | EvaluacionesGrupo.tsx | `selectedCriteriosLogro`, `selectedCompetenciasIds` | via `criteriosLogroBox()` helper |

### Data Flow Diagram

```
Edge Function Response (modify-evaluation)
    │
    ├── evaluationBundle → {baseHtml, versionBHtml, versionCHtml, versions: {A,B,C}}
    │                      → displayEvaluations (computed from evaluationBundle)
    │                      → EvaluacionVisualRenderer
    │
    ├── studentAssignments → Record<string, 'A'|'B'|'C'>
    │                       → EvaluationAssignmentsPanel
    │
    ├── teacherRemindersByStudent → StudentReminders[]
    │                              → TeacherRemindersPanel
    │
    ├── aiReport → AIDesignReportData
    │             → AIDesignReport
    │
    ├── warnings → string[]
    │             → assignmentWarnings (merged with client-side warnings)
    │
    └── finalAssignmentCounts → {A: number, B: number, C: number}
                               → Debug panel
```

### Data Shapes

#### `studentAssignments`
```typescript
Record<string, 'A' | 'B' | 'C'>
// Example: { "1": "A", "2": "B", "5": "C" }
```

#### `StudentReminders` (teacherReminders)
```typescript
interface StudentReminders {
  studentId: string | number;
  admin: string[];      // Administrative reminders
  correction: string[]; // Correction-time reminders
}
```

#### `AIDesignReportData`
```typescript
interface AIDesignReportData {
  rationale?: string;
  coverageMapping?: { sessionId: string; sessionTitle: string; sectionsIncluded: string[] }[];
  materialsUsage?: { materialId: string; materialTitle: string; usageDescription: string }[];
  adaptationNotes?: string;
  versions?: { generated?: string[]; reason?: string; count?: number };
  contemplaciones?: { instrument_design?: string[]; admin_reminders?: string[]; correction_reminders?: string[] };
  response_options?: { included?: boolean; optionCount?: number; rationale?: string; location?: string };
  vark?: { summary?: string };
  assignments?: { rationale?: string; counts?: { A?: number; B?: number; C?: number }; by_version?: { A?: string[]; B?: string[]; C?: string[] }; total_students?: number };
  warnings?: string[];
}
```

#### `EvaluationBundle`
```typescript
interface EvaluationBundle {
  baseHtml?: string;
  versionBHtml?: string | null;
  versionCHtml?: string | null;
  versions?: { A: string; B?: string | null; C?: string | null };
  responseOptionsIncluded?: boolean;
  responseOptionCount?: number;
  finalAssignmentCounts?: { A: number; B: number; C: number };
}
```

## 2. Current State in `eval-v2-migration`

### Panels Present ✅
All panels from `fixing/general-errors` are present in `eval-v2-migration`:

1. ✅ Debug Panel (line ~2503)
2. ✅ Assignment Warnings (line ~2569)
3. ✅ EvaluationAssignmentsPanel (line ~2586)
4. ✅ TeacherRemindersPanel (line ~2591)
5. ✅ EvaluacionVisualRenderer (line ~2597)
6. ✅ AIDesignReport (line ~2628)
7. ✅ Criterios de Logro (line ~2649)

### V2 Components Available but NOT Integrated
The following v2 components exist but are not yet wired into the main page:

| Component | File | Purpose |
|-----------|------|---------|
| `BetaToggle` | `src/components/evaluaciones/BetaToggle.tsx` | Toggle switch for v2 opt-in |
| `CollapsibleSection` | `src/components/evaluaciones/CollapsibleSection.tsx` | Collapsible wrapper with localStorage |
| `EvaluationContentWrapper` | `src/components/evaluaciones/EvaluationContentWrapper.tsx` | v1/v2 unified content renderer |
| `EvaluationRendererV2` | `src/components/evaluaciones/v2/EvaluationRendererV2.tsx` | JSON-based v2 renderer |

### V2 Services Available
| Service | File | Purpose |
|---------|------|---------|
| `requestService.ts` | `src/services/evaluations/requestService.ts` | Contains `requestEvaluation()` with v2 support |
| `v2Types.ts` | `src/services/evaluations/v2Types.ts` | TypeScript types for v2 response |
| `v2Normalizer.ts` | `src/services/evaluations/v2Normalizer.ts` | Normalizes v2 JSON to ViewModel |

## 3. Changes Applied to `eval-v2-migration`

### Files Modified

#### `src/components/evaluaciones/index.ts`
- Added exports: `BetaToggle`, `CollapsibleSection`, `EvaluationContentWrapper`

#### `src/pages/EvaluacionesGrupo.tsx`
1. **Updated imports** (line 27-31):
   - Added `BetaToggle` to component imports
   - Added `EvaluationRendererV2` from v2 folder
   - Added `V2Response` type
   - Added `requestEvaluation, getBetaToggleState` from requestService

2. **Added state variables** (after line 442):
   ```tsx
   const [useBetaV2, setUseBetaV2] = useState<boolean>(getBetaToggleState());
   const [v2RawResponse, setV2RawResponse] = useState<V2Response | null>(null);
   ```

3. **Added BetaToggle UI** (before generate button, ~line 2406):
   ```tsx
   <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
     <BetaToggle 
       onChange={(enabled) => setUseBetaV2(enabled)}
       showHelperText={true}
     />
   </div>
   ```

4. **Added conditional v1/v2 renderer** (~line 2612):
   - When `useBetaV2 && v2RawResponse`: render `EvaluationRendererV2`
   - Otherwise: render `displayEvaluations.map(EvaluacionVisualRenderer)`
   - Added error fallback via `onRenderError` callback

### Build Status
✅ Build passes successfully after all changes

## 4. Remaining TODOs

### High Priority
- [ ] Wire `v2RawResponse` from `requestEvaluation()` response when v2 endpoint returns JSON
- [ ] Add v2-specific endpoint call or modify existing endpoint to return structured JSON

### Medium Priority
- [ ] Wrap panels in `CollapsibleSection` for better UX
- [ ] Add PDF export via `EvaluationContentWrapper`
- [ ] Add version selector (A/B/C tabs) for content area

### Low Priority
- [ ] Add "view as student" feature
- [ ] Improve v2 renderer styling

## 6. Risks and Considerations

### Data Compatibility
- V2 responses have different structure (`evaluationBundle.structured_json` vs `evaluationBundle.versions`)
- Need mapping/adapter in `requestService.ts` to normalize

### Fallback Behavior
- If v2 generation fails, must fall back to v1 gracefully
- `onV2RenderError` callback should clear v2 state

### Testing Checklist
- [ ] v1 mode works exactly as before (no regression)
- [ ] v2 toggle appears and persists state
- [ ] v2 mode shows structured JSON content
- [ ] v2 fallback to v1 works on error
- [ ] All panels (teacher reminders, assignments, AI report, etc.) visible in both modes
