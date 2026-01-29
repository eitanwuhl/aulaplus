/**
 * Session Digests Builder for Evaluation Generation
 * 
 * Purpose: Extract structured, deterministic information from sessions
 * for AI evaluation generation, avoiding raw HTML parsing.
 * 
 * PHASE 6: Time Budgeting + AI Design Report
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type SesionClase = Database['public']['Tables']['sesiones_clase']['Row'];
type TeacherMaterial = Database['public']['Tables']['teacher_materials']['Row'];

export interface SessionDigest {
  sessionId: string;
  orden: number;
  titulo: string | null;
  
  // Structured content fields
  contenidosAnep: string[];
  competenciasEspecificas: string[];
  objetivos: string | null;
  
  // Key planning sections (without HTML)
  actividadesResumen: string | null;  // Brief summary of activities
  recursosLista: string[];             // List of resources mentioned
  
  // Attached materials
  attachedMaterials: {
    materialId: string;
    title: string;
    focusText: string | null;
  }[];
}

export interface MaterialDigest {
  materialId: string;
  title: string;
  mimeType: string;
  metadata: Record<string, any>;
  focusText: string | null;  // Focus text from attachment (if evaluation-level)
  extractedText: string | null;  // Extracted PDF text (truncated for context)
}

export interface EvaluationGenerationContext {
  // Sources
  sessionDigests: SessionDigest[];
  directMaterials: MaterialDigest[];
  includeSessionMaterials: boolean;
  
  // Teacher guidance
  evaluationFocus: string | null;
  additionalRequirements: string | null;
  
  // ANEP context (backward compat)
  anepContenidos: string[];
  anepCompetencias: string[];
  anepCriteriosLogro: string[];
  
  // Time budgeting
  targetDurationMinutes: number | null;
}

/**
 * Build a structured digest from a sesion_clase record
 * Extracts deterministic fields, avoiding fragile HTML parsing
 */
async function buildSessionDigest(session: SesionClase): Promise<SessionDigest> {
  // Extract activities summary from plan_completo HTML (safe extraction)
  const actividadesResumen = extractActivitiesSummary(session.plan_completo);
  
  // Extract resources list from recursos_adicionales
  const recursosLista = extractResourcesList(session.recursos_adicionales);
  
  // Load attached materials
  const { data: attachments } = await supabase
    .from('material_attachments')
    .select('material_id, focus_text, teacher_materials(id, title)')
    .eq('target_type', 'sesion')
    .eq('target_id', session.id)
    .is('deleted_at', null);
  
  const attachedMaterials = (attachments || []).map(att => ({
    materialId: att.material_id,
    title: (att.teacher_materials as any)?.title || 'Material sin título',
    focusText: att.focus_text
  }));
  
  return {
    sessionId: session.id,
    orden: session.orden || 0,
    titulo: session.titulo,
    contenidosAnep: session.contenidos_anep || [],
    competenciasEspecificas: session.competencias_especificas || [],
    objetivos: session.objetivos,
    actividadesResumen,
    recursosLista,
    attachedMaterials
  };
}

/**
 * Extract a brief summary of activities from plan_completo HTML
 * Uses safe text extraction (no regex on complex HTML)
 */
function extractActivitiesSummary(planCompleto: string | null): string | null {
  if (!planCompleto) return null;
  
  // Simple text extraction: remove HTML tags, limit to first 300 chars
  const text = planCompleto
    .replace(/<[^>]*>/g, ' ')  // Remove tags
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
  
  if (text.length === 0) return null;
  
  // Return first ~300 chars as summary
  const summary = text.substring(0, 300);
  return summary.length < text.length ? summary + '...' : summary;
}

/**
 * Extract resources list from recursos_adicionales text
 */
function extractResourcesList(recursos: string | null): string[] {
  if (!recursos || recursos.trim().length === 0) return [];
  
  // Split by newlines, bullets, or commas
  const items = recursos
    .split(/[\n,•\-]/g)
    .map(item => item.trim())
    .filter(item => item.length > 0 && item.length < 200);  // Sanity check
  
  return items.slice(0, 10);  // Max 10 items
}

/**
 * Build material digest including focus text and extracted text
 */
async function buildMaterialDigest(
  materialId: string, 
  focusText: string | null
): Promise<MaterialDigest | null> {
  const { data: material } = await supabase
    .from('teacher_materials')
    .select('*')
    .eq('id', materialId)
    .is('deleted_at', null)
    .single();
  
  if (!material) return null;

  // Get extracted text (if available) and truncate for context
  let extractedText: string | null = null;
  if (material.extracted_text) {
    // Truncate to ~2000 chars for generation context (to keep prompt size bounded)
    const maxContextChars = 2000;
    if (material.extracted_text.length > maxContextChars) {
      extractedText = material.extracted_text.substring(0, maxContextChars) + '...';
    } else {
      extractedText = material.extracted_text;
    }
  }
  
  return {
    materialId: material.id,
    title: material.title,
    mimeType: material.mime_type || 'application/octet-stream',
    metadata: material.metadata || {},
    focusText,
    extractedText
  };
}

/**
 * Build complete generation context from evaluation config
 * This is what gets sent to the AI edge function
 */
export async function buildEvaluationGenerationContext(config: {
  // Session-based sources
  sourcePlanificacionId?: string;
  sourceSessionIds: string[];
  evaluationFocus?: string;
  
  // Material sources
  directMaterialIds: string[];
  includeSessionMaterials: boolean;
  
  // ANEP sources (backward compat)
  selectedSubtemas: string[];
  selectedCompetenciasIds: string[];
  selectedCriteriosLogro: string[];
  
  // Additional guidance
  requerimientos?: string;
  
  // Time budgeting
  targetDurationMinutes?: number;
}): Promise<EvaluationGenerationContext> {
  
  // 1. Build session digests
  const sessionDigests: SessionDigest[] = [];
  if (config.sourceSessionIds.length > 0) {
    const { data: sessions } = await supabase
      .from('sesiones_clase')
      .select('*')
      .in('id', config.sourceSessionIds)
      .order('orden', { ascending: true });
    
    if (sessions) {
      for (const session of sessions) {
        const digest = await buildSessionDigest(session);
        sessionDigests.push(digest);
      }
    }
  }
  
  // 2. Build direct material digests
  const directMaterials: MaterialDigest[] = [];
  for (const materialId of config.directMaterialIds) {
    const digest = await buildMaterialDigest(materialId, null);
    if (digest) directMaterials.push(digest);
  }
  
  return {
    sessionDigests,
    directMaterials,
    includeSessionMaterials: config.includeSessionMaterials,
    evaluationFocus: config.evaluationFocus || null,
    additionalRequirements: config.requerimientos || null,
    anepContenidos: config.selectedSubtemas,
    anepCompetencias: config.selectedCompetenciasIds,
    anepCriteriosLogro: config.selectedCriteriosLogro,
    targetDurationMinutes: config.targetDurationMinutes || null
  };
}

/**
 * Serialize evaluation context for edge function
 * Converts to a flat, JSON-friendly structure
 */
export function serializeGenerationContext(context: EvaluationGenerationContext): Record<string, any> {
  return {
    // Session-based sources
    sessions: context.sessionDigests.map(s => ({
      id: s.sessionId,
      order: s.orden,
      title: s.titulo || `Sesión ${s.orden}`,
      anepContent: s.contenidosAnep,
      competencies: s.competenciasEspecificas,
      objectives: s.objetivos,
      activitiesSummary: s.actividadesResumen,
      resources: s.recursosLista,
      attachedMaterials: s.attachedMaterials
    })),
    
    // Materials
    materials: context.directMaterials.map(m => ({
      id: m.materialId,
      title: m.title,
      mimeType: m.mimeType,
      focusText: m.focusText,
      extractedText: m.extractedText  // Include extracted PDF text (already truncated)
    })),
    includeSessionMaterials: context.includeSessionMaterials,
    
    // Teacher guidance
    evaluationFocus: context.evaluationFocus,
    additionalRequirements: context.additionalRequirements,
    
    // ANEP (backward compat)
    anep: {
      contenidos: context.anepContenidos,
      competencias: context.anepCompetencias,
      criteriosLogro: context.anepCriteriosLogro
    },
    
    // Time budgeting
    timeBudget: context.targetDurationMinutes ? {
      targetMinutes: context.targetDurationMinutes,
      flexibilityThreshold: 0.10  // 10% tolerance
    } : null
  };
}

