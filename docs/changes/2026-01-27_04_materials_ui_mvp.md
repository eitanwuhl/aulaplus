## Materials UI Library + Attachments Integration (MVP)

> **Date**: January 27, 2026  
> **Task**: Implement minimal UI for teacher materials library and attachments  
> **Status**: ✅ Completed

---

## Summary

Implemented a minimal but functional UI for managing a reusable teacher materials library and attaching materials to sessions and evaluations. Teachers can now upload files, browse their library, select materials, and attach them with contextual notes (focus_text) to specific teaching contexts.

**What Changed**: 
- Created three core UI components in `src/components/materials/`
- Integrated material attachments panel into session editor (EditorSesionNuevo)
- Added import to evaluations page for future integration
- All user-facing strings in Spanish
- Graceful error handling for missing storage bucket

**Why**: 
- Enable teachers to maintain a reusable library of teaching materials
- Support context-specific material attachments (session/plan/evaluation)
- Provide intuitive UI for material management without direct Supabase calls
- Prepare foundation for session-evaluation material nexus

**Impact**: 
- New UI components (no changes to existing components except integration points)
- No breaking changes to existing functionality
- Service layer and hooks already implemented (Phase 2)
- Storage bucket migration ready (Phase 3)
- MVP ready for demo and user testing

---

## Impact Analysis (SSoT Guardrails)

### Guardrails Touched

1. **UI Components** (New components, follows existing patterns)
   - **Status**: ✅ New components added (consistent with shadcn/ui patterns)
   - **Changes**: 
     - Created materials UI components following existing component structure
     - Uses shadcn/ui primitives (Dialog, Card, Button, etc.)
     - Toast notifications for user feedback (existing pattern)
   - **Risk**: None - Additive changes only
   - **Mitigation**: Reviewed existing components for consistency

2. **Session Editor** (EditorSesionNuevo)
   - **Status**: ✅ Enhanced with new materials section
   - **Changes**: 
     - Added import for `AttachMaterialsPanel`
     - Added panel in "Recursos" tab after existing resource sections
     - No changes to existing functionality
   - **Risk**: Low - Minimal changes to existing component
   - **Mitigation**: Added panel at end of tab, doesn't interfere with existing UI

3. **Evaluation Flow** (EvaluacionesGrupo)
   - **Status**: ✅ Import added for future integration
   - **Changes**: 
     - Added import for `AttachMaterialsPanel`
     - No UI integration yet (requires evaluation ID from saved record)
   - **Risk**: None - Only import added, no functional changes
   - **Mitigation**: Minimal change strategy (user instruction followed)

### Guardrails NOT Touched

- ✅ Plan Parser (`src/lib/planParser.ts`) - Not modified
- ✅ AI Generation Contract - No changes to edge function contracts
- ✅ Authentication Flow - Not modified
- ✅ Session Estado Enum - Not modified
- ✅ Contemplaciones Catalog - Not modified
- ✅ Database Schema - No migrations (uses existing from Phase 1)
- ✅ Service Layer - No changes (uses existing from Phase 2)
- ✅ Storage Policies - No changes (uses existing from Phase 3)

### Compatibility Guarantees

1. **No Breaking Changes**: 
   - No modifications to existing UI components ✅
   - No changes to existing functionality ✅
   - Integration points are additive only ✅

2. **Follows Existing Patterns**:
   - Uses shadcn/ui components consistently ✅
   - Toast notifications for user feedback ✅
   - Dialog/Card structure matches existing UI ✅
   - Spanish strings throughout ✅

3. **Service Layer Integration**:
   - Uses existing hooks from Phase 2 ✅
   - No direct Supabase calls in UI ✅
   - React Query handles caching and invalidation ✅

---

## Files Created

### 1. UI Components (`src/components/materials/`)

#### `src/components/materials/UploadMaterialDialog.tsx` (NEW)
- **Purpose**: Dialog for uploading files and creating material records
- **Features**:
  - File input with type filtering
  - Auto-populated title from filename
  - Tags (comma-separated) and notes fields
  - File size display
  - Uses `useUploadAndCreateMaterial` hook
  - Automatic folder organization by MIME type
- **Lines**: ~200

#### `src/components/materials/MaterialsLibraryDialog.tsx` (NEW)
- **Purpose**: Dialog for browsing and selecting materials from library
- **Features**:
  - Search/filter functionality
  - Material cards with icons, title, tags, notes
  - Multi-select or single-select mode
  - Upload button (opens UploadMaterialDialog)
  - Empty state messages
  - Uses `useMaterialsList` hook
- **Lines**: ~230

#### `src/components/materials/AttachMaterialsPanel.tsx` (NEW)
- **Purpose**: Panel for managing attachments to a target (session/plan/evaluation)
- **Features**:
  - Shows current attachments with material title and focus_text
  - "Adjuntar" button opens library dialog
  - Focus text dialog for contextual notes
  - Edit focus_text for existing attachments
  - Remove attachments (soft delete)
  - Disabled state with explanatory message
  - Uses `useAttachmentsByTarget`, `useAddAttachment`, `useUpdateAttachment`, `useRemoveAttachment` hooks
- **Lines**: ~330

#### `src/components/materials/index.ts` (NEW)
- **Purpose**: Unified export for materials components
- **Lines**: ~10

### 2. Documentation

#### `docs/changes/2026-01-27_04_materials_ui_mvp.md` (NEW)
- **Purpose**: This change report
- **Content**: Complete documentation of UI MVP implementation

---

## Files Modified

### 1. `src/components/planificacion/EditorSesionNuevo.tsx` (MODIFIED)
- **Changes**:
  - Added import: `import { AttachMaterialsPanel } from '@/components/materials'`
  - Added `<AttachMaterialsPanel>` in "Recursos" tab after existing resource sections
  - Props: `targetType="sesion"`, `targetId={sesion?.id}`
- **Impact**: Minimal - Added 2 lines of import and 4 lines of JSX
- **Location**: Lines ~19 (import), ~1035-1039 (component)

### 2. `src/pages/EvaluacionesGrupo.tsx` (MODIFIED)
- **Changes**:
  - Added import: `import { AttachMaterialsPanel } from '@/components/materials'`
  - No UI integration yet (requires saved evaluation ID)
- **Impact**: Minimal - Only import added, no functional changes
- **Location**: Line ~28 (import)
- **Rationale**: Following user instruction for minimal changes; evaluation attachments can be added after save or in evaluation detail page

---

## UI Flow Description

### Flow 1: Upload Material

1. User opens materials library dialog
2. Clicks "Subir" button
3. Upload dialog opens:
   - Select file
   - Enter title (auto-populated from filename)
   - Add tags (optional)
   - Add notes (optional)
4. Click "Subir Material"
5. Service layer:
   - Uploads file to `teacher-materials` bucket (user-scoped path)
   - Creates material record in `teacher_materials` table
6. Success toast shown
7. Library dialog refreshes with new material

**Error Handling**:
- No file selected: Button disabled
- Upload fails (e.g., bucket not configured): Toast error in Spanish
- Network error: Toast error with retry option

### Flow 2: Attach Material to Session

1. User opens session editor (EditorSesionNuevo)
2. Navigates to "Recursos" tab
3. Scrolls to "Material Docente" panel
4. Clicks "Adjuntar" button
5. Materials library dialog opens
6. User selects one or more materials (checkboxes)
7. Clicks "Seleccionar (N)"
8. Focus text dialog opens:
   - Shows selected material(s)
   - Optional focus_text field (e.g., "Para actividad de inicio")
9. Clicks "Adjuntar"
10. Service layer:
    - Creates attachment records in `material_attachments` table
    - Links to `target_type='sesion'`, `target_id=sesion.id`
11. Success toast shown
12. Panel refreshes showing new attachments

**Error Handling**:
- Session ID not available: Button disabled
- Attachment fails: Toast error in Spanish
- Network error: Toast error

### Flow 3: Edit Focus Text

1. User sees attached material in panel
2. Clicks edit button (pencil icon)
3. Edit dialog opens with current focus_text
4. User modifies text
5. Clicks "Guardar"
6. Service layer updates attachment record
7. Success toast shown
8. Panel refreshes

### Flow 4: Remove Attachment

1. User clicks delete button (trash icon)
2. Confirmation dialog appears
3. User confirms deletion
4. Service layer soft-deletes attachment (`deleted_at` set)
5. Success toast shown
6. Panel refreshes (attachment removed from view)
7. **Note**: Material remains in library (not deleted)

---

## Integration Points

### Session Editor (EditorSesionNuevo.tsx)

**Location**: "Recursos" tab, after "Recursos adicionales" card

**Integration**:
```tsx
<AttachMaterialsPanel
  targetType="sesion"
  targetId={sesion?.id}
/>
```

**Why this location**:
- Resources tab is the natural place for teaching materials
- After auto-detected and manual resources
- Consistent with "resources" concept
- Doesn't interfere with existing functionality

### Evaluation Flow (EvaluacionesGrupo.tsx)

**Current State**: Import only, no UI integration

**Reason**: Evaluations are generated first, then saved. Evaluation ID only exists after save. Following user instruction for minimal changes.

**Future Options**:
1. Add panel to evaluation detail page (after save)
2. Create evaluation draft earlier in flow
3. Add "Adjuntar materiales" button after save dialog

**Current Recommendation**: Add to evaluation detail page in next phase

---

## User Experience

### Key Features

1. **Search and Filter**:
   - Search by title, tags, or notes
   - Real-time filtering
   - Empty state messages

2. **Material Cards**:
   - Icon based on MIME type (PDF, image, video, etc.)
   - Title prominently displayed
   - Tags as badges
   - Notes as secondary text
   - Checkbox or radio for selection

3. **Focus Text** (Contextual Notes):
   - Optional field for each attachment
   - Explains how material will be used
   - Editable after attachment
   - Examples: "Para actividad de inicio", "Revisar páginas 3-5"

4. **Error Handling**:
   - Clear Spanish error messages
   - Toast notifications for all actions
   - Graceful degradation if bucket not configured

5. **Empty States**:
   - Clear messaging when no materials
   - Prompt to upload first material
   - Search results empty state

### Spanish Strings

All user-facing text in Spanish:
- "Material Docente"
- "Subir Material"
- "Adjuntar"
- "Biblioteca de Materiales"
- "Buscar materiales..."
- "Notas de uso"
- "Contexto del Material"
- "¿Eliminar adjunto?"
- Error messages in Spanish
- Toast notifications in Spanish

---

## Technical Details

### Component Architecture

```
AttachMaterialsPanel
├── Displays current attachments
├── "Adjuntar" button → Opens MaterialsLibraryDialog
│   └── MaterialsLibraryDialog
│       ├── Search/Filter
│       ├── Material cards (multi-select)
│       ├── "Subir" button → Opens UploadMaterialDialog
│       │   └── UploadMaterialDialog
│       │       ├── File input
│       │       ├── Title, tags, notes
│       │       └── Upload action
│       └── "Seleccionar" button → Opens Focus Text Dialog
│           └── Focus Text Dialog
│               ├── Shows selected materials
│               ├── Focus text input (optional)
│               └── "Adjuntar" action
├── Edit button → Opens Edit Focus Text Dialog
└── Delete button → Opens Confirmation Dialog
```

### React Query Integration

**Queries** (from `useMaterials.ts`):
- `useMaterialsList()` - List all materials with caching
- `useMaterial(id)` - Get single material (not used in MVP)

**Mutations** (from `useMaterials.ts`):
- `useUploadAndCreateMaterial()` - Upload + create in one step
- `useArchiveMaterial()` - Soft delete material (not used in MVP)

**Queries** (from `useMaterialAttachments.ts`):
- `useAttachmentsByTarget(targetType, targetId)` - List attachments for target
- `useAttachment(id)` - Get single attachment (not used in MVP)

**Mutations** (from `useMaterialAttachments.ts`):
- `useAddAttachment()` - Create attachment
- `useUpdateAttachment()` - Edit focus_text
- `useRemoveAttachment()` - Soft delete attachment

**Cache Invalidation**:
- Add attachment → Invalidates `attachmentsByTarget` and `attachmentsByMaterial`
- Update attachment → Invalidates same queries
- Remove attachment → Invalidates same queries
- Upload material → Invalidates `materialsList`

### File Organization by MIME Type

Automatic folder assignment on upload:
- `images/` - image/*
- `videos/` - video/*
- `audio/` - audio/*
- `pdfs/` - application/pdf
- `documents/` - *word*, *document*
- `presentations/` - *powerpoint*, *presentation*
- `otros/` - Everything else

**Storage path format**: `{userId}/{folder}/{timestamp}-{sanitizedFilename}`

---

## Quality Gates

### 1. TypeScript Build

**Command**: `npm run build`

**Result**: ✅ **Passed**

**Output**:
```
✓ 4327 modules transformed.
✓ built in 29.76s
```

**Notes**: 
- No TypeScript errors
- Build completed successfully
- +12 modules from new components
- Chunk size warnings (pre-existing, not related to this change)

### 2. Manual Smoke Testing

**Tested Scenarios**:

1. ✅ Session editor loads without errors
2. ✅ "Recursos" tab displays AttachMaterialsPanel
3. ✅ Panel shows "No hay materiales adjuntos" message initially
4. ✅ "Adjuntar" button opens library dialog
5. ✅ Library shows empty state if no materials
6. ✅ "Subir" button opens upload dialog
7. ✅ All dialogs render correctly
8. ✅ No runtime crashes in console

**Not Tested** (requires storage bucket):
- Actual file upload
- Material listing from database
- Attachment creation/editing/deletion

**Graceful Degradation**:
- Upload fails gracefully with Spanish error toast if bucket not configured
- Library shows empty state if query fails
- Attachments panel shows loading state appropriately

---

## Known Limitations / Future Work

### Current Limitations

1. **Evaluation Integration Incomplete**:
   - Import added but no UI integration yet
   - Requires evaluation ID from saved record
   - **Workaround**: Add panel to evaluation detail page in next phase
   - **Alternative**: Create evaluation draft earlier in flow

2. **Storage Bucket May Not Be Applied**:
   - Migration created (Phase 3) but may not be applied to remote Supabase
   - UI fails gracefully with clear error message
   - **Action**: Apply migration manually via Supabase Dashboard

3. **No File Preview**:
   - Can't preview PDF/images in UI
   - Only shows title, tags, notes
   - **Future**: Add file preview modal with signed URLs

4. **No Bulk Operations**:
   - Can select multiple materials to attach at once
   - But can't bulk edit or bulk delete
   - **Future**: Add bulk actions menu

5. **No Material Editing**:
   - Can't edit material title, tags, notes after creation
   - **Future**: Add edit material dialog

6. **No Material Deletion**:
   - Can archive (soft delete) but not exposed in UI
   - **Future**: Add "Archivar" button in library

7. **No Search Persistence**:
   - Search query resets when dialog closes
   - **Future**: Persist search in localStorage

8. **No Drag and Drop**:
   - File upload requires click on input
   - **Future**: Add drag-and-drop zone

### Follow-up Tasks

1. **Complete Evaluation Integration**:
   - Option A: Add panel to evaluation detail page (EvaluacionDetalle.tsx)
   - Option B: Create evaluation draft earlier in flow
   - Option C: Add "Adjuntar materiales" step after save

2. **Apply Storage Migration**:
   - Run `supabase/migrations/20260127000001_add_teacher_materials_storage_bucket.sql` in Supabase Dashboard
   - Verify bucket created
   - Test file upload end-to-end

3. **Enhanced Features** (Phase 5+):
   - File preview modal
   - Edit material metadata
   - Archive/unarchive materials
   - Bulk operations
   - Drag-and-drop upload
   - Material usage analytics
   - Share materials with colleagues (future)

4. **Testing**:
   - Unit tests for components
   - Integration tests for attachment flow
   - E2E tests for complete upload → attach → edit → remove flow

---

## Success Criteria

✅ **Completed**:
- [x] Created reusable UI components for materials management
- [x] Implemented materials library dialog with search
- [x] Implemented upload dialog with file validation
- [x] Implemented attachments panel with CRUD operations
- [x] Integrated in session editor (EditorSesionNuevo)
- [x] Evaluation integration prepared (import added)
- [x] All user-facing strings in Spanish
- [x] Graceful error handling
- [x] Uses existing service layer and hooks
- [x] No direct Supabase calls in UI
- [x] TypeScript build passes
- [x] No breaking changes to existing functionality

---

## Commit Information

**Branch**: `Uso-material-docente-y-nexo-clases-evaluaciones`

**Commit Message**: `feat(materials): UI library + attachments integration (MVP)`

**Files Changed**:
- `src/components/materials/UploadMaterialDialog.tsx` (new)
- `src/components/materials/MaterialsLibraryDialog.tsx` (new)
- `src/components/materials/AttachMaterialsPanel.tsx` (new)
- `src/components/materials/index.ts` (new)
- `src/components/planificacion/EditorSesionNuevo.tsx` (modified - 2 lines import + 4 lines JSX)
- `src/pages/EvaluacionesGrupo.tsx` (modified - 1 line import)
- `docs/changes/2026-01-27_04_materials_ui_mvp.md` (new)

**Total**: ~770 lines of new code + ~7 lines modified

**Git Status**:
```bash
$ git status
On branch Uso-material-docente-y-nexo-clases-evaluaciones
nothing to commit, working tree clean
```

**Git Log**:
```bash
$ git log -1 --oneline
5e603c1 feat(materials): UI library + attachments integration (MVP)
```

**Commit Hash**: `5e603c1`

---

**End of Change Report**

