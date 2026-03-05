# Reapply navigation fix after cherry-pick conflict

## Files changed

- `src/hooks/usePlanificacionWizard.ts`
- `src/pages/PlanificacionWizard.tsx`
- `src/pages/PlanificacionWorkspace.tsx`

## Restored behaviors

### Wizard restore when returning from workspace

- The wizard now restores full draft state from localStorage using one draft key.
- Return mode is detected with `location.state` (`fromWorkspace` + `returnToWizardStep`).
- When return mode is active, wizard state is rehydrated and opened on Summary step with previously entered data.

### Step-aware header Back inside wizard

- If current step is greater than first step, header Back goes to previous wizard step and keeps inputs.
- If current step is first step, header Back exits to `/planificacion`.

### Save draft before navigating to workspace

- Right before navigating from wizard to `/planificacion/:id`, the current wizard state is persisted to localStorage.
- Navigation to workspace now includes return state so workspace Back can return to wizard in Summary mode.

### Workspace Back to wizard return mode

- Workspace back target is computed from `location.state?.from` with fallback `/planificacion`.
- If back target is `/planificacion/nuevo`, navigation includes return-mode state so wizard restores and opens Summary.
- Unsaved-session confirmation behavior remains unchanged; only final destination now uses computed back target.

## Manual testing checklist

- [ ] From `PlanificacionWizard`, complete data and generate to enter workspace.
- [ ] In `PlanificacionWorkspace`, click Back and verify it returns to `/planificacion/nuevo`.
- [ ] Verify wizard is restored with previous data and opens in Summary step.
- [ ] In wizard step 2/3, click header Back and verify it goes one step back (does not exit).
- [ ] In wizard first step, click header Back and verify it exits to `/planificacion`.
- [ ] In workspace with unsaved session, click Back and verify exit confirmation appears.
- [ ] Confirm exit in dialog and verify navigation uses computed back target (wizard return mode or `/planificacion` depending on origin).
