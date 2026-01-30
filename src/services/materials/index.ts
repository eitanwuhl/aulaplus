/**
 * Materials Service Layer
 * 
 * Unified export for all materials-related services:
 * - Storage operations (upload, delete, signed URLs)
 * - Teacher materials CRUD
 * - Material attachments CRUD
 * 
 * This is the single entry point for materials functionality.
 */

// Storage operations
export {
  uploadMaterialFile,
  deleteMaterialFile,
  getSignedUrl,
  type UploadResult
} from './storage';

// Teacher materials CRUD
export {
  createMaterial,
  listMaterials,
  getMaterial,
  updateMaterial,
  archiveMaterial,
  deleteMaterial,
  extractMaterialText
} from './materials';

// Material attachments CRUD
export {
  addAttachment,
  listAttachmentsByTarget,
  listAttachmentsByMaterial,
  getAttachment,
  updateAttachment,
  removeAttachment,
  deleteAttachment,
  type TargetType
} from './attachments';


