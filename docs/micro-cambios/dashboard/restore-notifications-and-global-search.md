# Restore dashboard notifications and global search

## Files created

- `src/components/dashboard/NotificationsPanel.tsx`
- `src/components/dashboard/GlobalSearch.tsx`
- `docs/micro-cambios/dashboard/restore-notifications-and-global-search.md`

## Files modified

- `src/components/TeacherDashboard.tsx`
- `src/components/AppLayout.tsx`
- `src/pages/TeacherGroups.tsx`

## LocalStorage keys used

- `aulaplus.notifications.read`
  - Purpose: persist notification read/unread state across refreshes.
  - Format: JSON array of read notification IDs (numbers).

## Routes used for navigation

### Student navigation

- Source: notifications panel row click (when notification has `studentId`) and global search student selection.
- Destination route: `/teacher-groups`
- State payload: `{ studentId: number }`
- Runtime behavior in `TeacherGroups`: auto-opens selected student profile (inside existing TeacherGroups profile flow).

### Group navigation

- Source: notifications panel row click (when notification has `groupId`) and global search group selection.
- Destinations:
  - Notifications group item: `/teacher-groups` with state `{ groupId: string }`.
  - Global search group item: `/evaluaciones/nuevo?grupo=<groupId>` (existing query convention).

## Restored behavior summary

1. **Dashboard notifications panel**
   - Shows a list of notifications (mocked in component).
   - Each item has action `Marcar como leido`.
   - Read items are visually distinguished from unread items.
   - Read state persists in localStorage (`aulaplus.notifications.read`).
   - Clicking student/group notifications navigates to existing app flows.
   - Clicking `Marcar como leido` does not trigger row navigation (`stopPropagation`).

2. **Global search in top bar**
   - Replaces passive input with active search component.
   - Searches students and groups from existing `mockData`.
   - Dropdown grouped by `Estudiantes` and `Grupos`.
   - Selection navigates to existing routes.
   - Dropdown closes on outside click and on selection.
   - Search is case-insensitive and diacritic-insensitive.

## Manual testing checklist (with results)

- [x] Dashboard shows notifications panel with mark-as-read action.
- [x] Click `Marcar como leido` updates unread counter and does not change route unexpectedly.
- [x] Refresh keeps read state persisted (`Notificaciones Importantes 3 nuevas` remained after reload).
- [x] Global search finds students by name (example: `ana`).
- [x] Selecting student from search navigates to `/teacher-groups` and opens student profile via state.
- [x] Global search finds groups by name (example: `9no`).
- [x] Selecting group from search navigates to `/evaluaciones/nuevo?grupo=1`.
- [x] Dropdown closes on selection.
- [x] Build passes (`npm run build`) with no new errors.

## Notes

- No backend/DB/Edge changes were made.
- No new dependencies were added.
- Dashboard layout structure/grid was not refactored; only functionality/components were added and integrated.
- Evaluation generation logic and planning navigation logic were not modified in this task.
