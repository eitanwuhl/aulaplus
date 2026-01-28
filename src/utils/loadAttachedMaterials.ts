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
        const material = (attachment as any).teacher_materials;
        
        if (material && !material.deleted_at) {
          materials.push({
            material_id: attachment.material_id,
            title: material.title || 'Material sin título',
            focus_text: attachment.focus_text || undefined,
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
        const material = (attachment as any).teacher_materials;
        
        if (material && !material.deleted_at) {
          materials.push({
            material_id: attachment.material_id,
            title: material.title || 'Material sin título',
            focus_text: attachment.focus_text || undefined,
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
      lines.push(`   Foco: ${material.focus_text}`);
    }
  });
  
  lines.push('');
  lines.push('Considera estos materiales al generar el plan de clase.');
  
  return lines.join('\n');
}

