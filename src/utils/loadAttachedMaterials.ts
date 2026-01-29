/**
 * Helper to load attached materials for a session (combines plan-level + session-level)
 * 
 * Plan-level materials apply to all sessions (inheritance)
 * Session-level materials are specific to that session only
 * 
 * Returns combined list with material titles and focus_text for AI generation context
 */

import { listAttachmentsByTarget } from '@/services/materials';

export interface AttachedMaterialForAI {
  material_id: string;
  title: string;
  focus_text?: string;
  extracted_text?: string; // FIX: Include extracted PDF text
  mime_type?: string;
  source: 'plan' | 'session';
}

export async function loadAttachedMaterialsForSession(
  planificacionId: string | undefined,
  sesionId: string | undefined
): Promise<AttachedMaterialForAI[]> {
  const materials: AttachedMaterialForAI[] = [];
  
  // Load plan-level materials (if planificacionId provided)
  if (planificacionId) {
    const planResult = await listAttachmentsByTarget('planificacion', planificacionId);
    
    if (!planResult.error && planResult.data) {
      for (const attachment of planResult.data) {
        // listAttachmentsByTarget returns joined data with teacher_materials
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const material = (attachment as any).material || (attachment as any).teacher_materials;
        
        if (material && !material.deleted_at) {
          materials.push({
            material_id: attachment.material_id,
            title: material.title || 'Material sin título',
            focus_text: attachment.focus_text || undefined,
            extracted_text: material.extracted_text || undefined, // FIX: Include extracted text
            mime_type: material.mime_type || undefined,
            source: 'plan'
          });
        }
      }
    }
  }
  
  // Load session-level materials (if sesionId provided)
  if (sesionId) {
    const sessionResult = await listAttachmentsByTarget('sesion', sesionId);
    
    if (!sessionResult.error && sessionResult.data) {
      for (const attachment of sessionResult.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const material = (attachment as any).material || (attachment as any).teacher_materials;
        
        if (material && !material.deleted_at) {
          materials.push({
            material_id: attachment.material_id,
            title: material.title || 'Material sin título',
            focus_text: attachment.focus_text || undefined,
            extracted_text: material.extracted_text || undefined, // FIX: Include extracted text
            mime_type: material.mime_type || undefined,
            source: 'session'
          });
        }
      }
    }
  }
  
  return materials;
}

/**
 * Format attached materials for AI prompt
 * Returns a string that can be included in the AI context
 * FIX: Includes extracted_text (truncated to 2000 chars) for materials-only generation
 */
export function formatMaterialsForAI(materials: AttachedMaterialForAI[]): string {
  if (materials.length === 0) {
    return '';
  }
  
  const lines: string[] = [];
  
  lines.push(`\n## Materiales Docentes Adjuntos (${materials.length})`);
  lines.push('El docente ha adjuntado los siguientes materiales como referencia:');
  
  materials.forEach((material, index) => {
    const sourceLabel = material.source === 'plan' ? '[Nivel Planificación]' : '[Nivel Sesión]';
    lines.push(`${index + 1}. ${material.title} ${sourceLabel}`);
    
    if (material.focus_text) {
      lines.push(`   Foco del docente: ${material.focus_text}`);
    }
    
    // FIX: Include extracted text (truncated to 2000 chars) for materials-only generation
    if (material.extracted_text) {
      const truncatedText = material.extracted_text.substring(0, 2000);
      const isTruncated = material.extracted_text.length > 2000;
      lines.push(`   Contenido extraído del PDF: ${truncatedText}${isTruncated ? '...' : ''}`);
    } else if (material.mime_type?.includes('pdf')) {
      lines.push(`   Nota: Este material es un PDF pero aún no se ha extraído el texto.`);
    }
  });
  
  lines.push('');
  lines.push('IMPORTANTE: Si NO hay contenido ANEP especificado, estos materiales son la FUENTE PRINCIPAL del contenido.');
  lines.push('Debes usar conceptos, vocabulario, eventos y nombres específicos del material. NO uses plantillas genéricas.');
  
  return lines.join('\n');
}

