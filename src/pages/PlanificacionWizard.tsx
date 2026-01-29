import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { usePlanificacionWizard } from '@/hooks/usePlanificacionWizard';
import { useFullSessionGeneration } from '@/hooks/useFullSessionGeneration';
import type { UnidadDidactica, UnitAssignmentMetadata } from '@/types/planificacion';
import { WizardSteps } from '@/components/planificacion/WizardSteps';
import { supabase } from '@/integrations/supabase/client';
import {
  extractCompetenciesFromUnits,
  extractContenidosFromUnits,
  buildCompetenciasContenidosMap,
} from '@/lib/competencyExtractor';
import { normalizeArrayField } from '@/lib/normalizeSupabaseArrays';
import { loadGroupContext } from '@/utils/groupContext';
import { parsePlan, buildPlanHtml, buildPlanHtmlWithReminders, buildSanitizedLessonPlanHtml } from '@/lib/planParser';
import { mockGroups } from '@/data/mockData';
import type { Student as EnforcementStudent } from '@/lib/contemplaciones/enforcement';
import { enforceForLessonPlan } from '@/lib/contemplaciones/enforcement';
import { resolveMockGroup } from '@/utils/resolveMockGroup';

// PHASE 1: Helper para expandir unidades según clases_estimadas (reutilizable)
function expandUnitsToSessionPlan(
  unidades: UnidadDidactica[]
): UnitAssignmentMetadata[] {
  const expanded: UnitAssignmentMetadata[] = [];
  
  for (let i = 0; i < unidades.length; i++) {
    const unidad = unidades[i];
    // Validar clases_estimadas: si es <= 0 o NaN, usar 1 como default
    const totalClases = (unidad.clases_estimadas && unidad.clases_estimadas > 0 && !isNaN(unidad.clases_estimadas))
      ? unidad.clases_estimadas
      : 1;
    
    for (let claseNum = 1; claseNum <= totalClases; claseNum++) {
      expanded.push({
        unidadIndex: i,
        unidadId: unidad.id,
        contenido_texto: unidad.contenido_texto,
        competencias_ids: unidad.competencias_ids || [],
        claseEnUnidad: claseNum,
        totalClasesUnidad: totalClases,
        isExtraSlot: false
      });
    }
  }
  
  return expanded;
}

// PHASE 1: Helper para mapear sesiones a unidades expandidas (reutilizable)
function mapSessionsToUnits(
  totalSlots: number,
  expandedPlan: UnitAssignmentMetadata[]
): UnitAssignmentMetadata[] {
  if (expandedPlan.length === 0) {
    // Fallback: crear sesiones con contenido genérico
    return Array.from({ length: totalSlots }, () => ({
      unidadIndex: -1,
      unidadId: '',
      contenido_texto: 'Contenido general',
      competencias_ids: [],
      claseEnUnidad: 1,
      totalClasesUnidad: 1,
      isExtraSlot: false
    }));
  }
  
  if (totalSlots <= expandedPlan.length) {
    // Caso normal o truncado: usar las primeras totalSlots
    return expandedPlan.slice(0, totalSlots);
  }
  
  // Caso: más sesiones que clases estimadas
  // Repetir última unidad para sesiones adicionales
  const remaining = totalSlots - expandedPlan.length;
  const lastUnit = expandedPlan[expandedPlan.length - 1];
  
  const additionalSessions: UnitAssignmentMetadata[] = [];
  for (let i = 1; i <= remaining; i++) {
    additionalSessions.push({
      ...lastUnit,
      claseEnUnidad: lastUnit.totalClasesUnidad + i,
      isExtraSlot: true
    });
  }
  
  return [...expandedPlan, ...additionalSessions];
}

// PHASE 3.2: Helper to load session briefs from database
async function loadSessionBriefs(
  planificacionId: string
): Promise<(string | undefined)[] | undefined> {
  try {
    // Fetch sessions ordered by orden
    const { data: sesiones, error: sesionesError } = await supabase
      .from('sesiones_clase')
      .select('session_brief, orden')
      .eq('planificacion_id', planificacionId)
      .order('orden', { ascending: true });

    if (sesionesError) {
      console.error('[loadSessionBriefs] Error fetching sessions:', sesionesError);
      return undefined;
    }

    if (!sesiones || sesiones.length === 0) {
      return undefined;
    }

    // P1 FIX: Build array aligned to orden (handle sparse/non-contiguous ordens)
    // Determine max orden
    const maxOrden = Math.max(...sesiones.map(s => s.orden ?? 0).filter(o => o > 0));
    if (!maxOrden || maxOrden <= 0) {
      return undefined;
    }

    // Build array sized maxOrden, fill with undefined
    const briefs = Array<string | undefined>(maxOrden).fill(undefined);
    
    // Assign briefs[orden-1] = session_brief ?? undefined
    sesiones.forEach(s => {
      if ((s.orden ?? 0) > 0) {
        briefs[(s.orden as number) - 1] = s.session_brief ?? undefined;
      }
    });

    console.log(`[loadSessionBriefs] Loaded ${briefs.length} session briefs from DB (max orden: ${maxOrden})`);
    return briefs;
  } catch (error) {
    console.error('[loadSessionBriefs] Error loading session briefs:', error);
    return undefined;
  }
}

// PHASE 3.2: Helper to check if array has meaningful briefs (at least one non-empty after trimming)
function hasMeaningfulBriefs(arr?: (string | undefined)[]): boolean {
  return Array.isArray(arr) && arr.some(v => (v ?? '').trim().length > 0);
}

// PHASE 3.2: Resolver to get sessionBriefs from wizard state or DB (source-of-truth)
async function resolveSessionBriefs(
  planificacionId: string,
  wizardSessionBriefs: (string | undefined)[] | undefined
): Promise<(string | undefined)[] | undefined> {
  // P3 FIX: Treat "meaningful wizard state" as having at least one non-empty entry
  // If wizard has meaningful briefs, prefer it (latest unsaved edits)
  if (hasMeaningfulBriefs(wizardSessionBriefs)) {
    return wizardSessionBriefs;
  }

  // Otherwise, load from DB
  const dbBriefs = await loadSessionBriefs(planificacionId);
  
  // If DB has meaningful briefs, use them
  if (hasMeaningfulBriefs(dbBriefs)) {
    return dbBriefs;
  }

  // If both are empty/undefined, return undefined (backward compatibility)
  return undefined;
}

// PHASE 3.2: Helper to persist session briefs to database
type PersistResult = { ok: boolean; attempted: number; failures: number };

async function persistSessionBriefs(
  planificacionId: string,
  sessionBriefs: (string | undefined)[] | undefined
): Promise<PersistResult> {
  // If no sessionBriefs provided, return early
  if (!sessionBriefs || sessionBriefs.length === 0) {
    return { ok: true, attempted: 0, failures: 0 };
  }

  try {
    // Fetch sessions for this planning ordered by orden
    const { data: sesiones, error: sesionesError } = await supabase
      .from('sesiones_clase')
      .select('id, orden')
      .eq('planificacion_id', planificacionId)
      .order('orden', { ascending: true });

    if (sesionesError) {
      console.error('[persistSessionBriefs] Error fetching sessions:', sesionesError);
      return { ok: false, attempted: 0, failures: 0 };
    }

    if (!sesiones || sesiones.length === 0) {
      console.warn('[persistSessionBriefs] No sessions found for planning:', planificacionId);
      return { ok: true, attempted: 0, failures: 0 };
    }

    // P1 FIX: Map briefs by orden (NOT array index)
    // sessionBriefs[i] corresponds to session with orden = i + 1
    const updates = sesiones
      .filter(s => (s.orden ?? 0) > 0) // Only update sessions with valid orden > 0
      .map((s) => {
        const idx = (s.orden as number) - 1; // Convert orden (1-based) to array index (0-based)
        const brief = idx >= 0 && idx < sessionBriefs.length ? sessionBriefs[idx] : undefined;
        return {
          id: s.id,
          session_brief: brief?.trim() || null
        };
      });

    if (updates.length === 0) {
      return { ok: true, attempted: 0, failures: 0 };
    }

    // Apply updates using Promise.allSettled to avoid blocking on individual failures
    const results = await Promise.allSettled(
      updates.map(update =>
        supabase
          .from('sesiones_clase')
          .update({ session_brief: update.session_brief })
          .eq('id', update.id)
      )
    );

    // Count failures
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    const failureCount = failures.length;
    const ok = failureCount === 0;

    if (failures.length > 0) {
      console.error('[persistSessionBriefs] Some updates failed:', failures);
      failures.forEach((failure) => {
        const failureIndex = results.findIndex(r => r === failure);
        if (failureIndex >= 0 && failureIndex < updates.length) {
          const failedUpdate = updates[failureIndex];
          console.error(`[persistSessionBriefs] Failed update for session ${failedUpdate.id}:`, failure.reason);
        }
      });
    } else {
      console.log(`[persistSessionBriefs] Successfully persisted ${updates.length} session briefs`);
    }

    return { ok, attempted: updates.length, failures: failureCount };
  } catch (error) {
    // Log error and return failure result (non-blocking per requirement)
    console.error('[persistSessionBriefs] Error persisting session briefs:', error);
    return { ok: false, attempted: 0, failures: 0 };
  }
}

// PHASE 4: Use shared helper for group context (removed local implementation)
// See src/utils/groupContext.ts for centralized logic

// Función para generar automáticamente los planes de todas las sesiones
const generarPlanesAutomaticamente = async (
  planificacionId: string, 
  materia: string, 
  nivel: string,
  sessionBriefs?: (string | undefined)[],  // PHASE 3.1: Optional per-session focus overrides
  grupoId?: string  // PHASE 3 (Profile Usage): Optional grupo_id to fetch profile
) => {
  try {
    console.log('Iniciando generación automática de planes...');
    
    // PHASE 4: Load group context from Supabase + mockGroups (shared helper)
    const groupContext = await loadGroupContext(grupoId);
    
    if (groupContext.perfilGrupo) {
      console.log('[PHASE4-Profile] Using group profile:', {
        tamanio: groupContext.perfilGrupo.tamanio,
        dominante: groupContext.perfilGrupo.dominante,
        distribucion: groupContext.perfilGrupo.distribucion,
        estudiantesConAjustes: groupContext.estudiantes?.length || 0,
        teacherSugerenciasPresent: !!groupContext.teacherSugerencias
      });
    } else {
      console.log('[PHASE4-Profile] No group profile available (backward compatibility mode)');
    }
    
    // Obtener la planificación completa con sus datos
    const { data: planificacion, error: planificacionError } = await supabase
      .from('planificaciones')
      .select('*')
      .eq('id', planificacionId)
      .single();

    if (planificacionError) {
      console.error('Error obteniendo planificación:', planificacionError);
      return;
    }

    // Obtener todas las sesiones de la planificación
    const { data: sesiones, error: sesionesError } = await supabase
      .from('sesiones_clase')
      .select('*')
      .eq('planificacion_id', planificacionId)
      .order('orden');

    if (sesionesError) {
      console.error('Error obteniendo sesiones:', sesionesError);
      return;
    }

    if (!sesiones || sesiones.length === 0) {
      console.log('No hay sesiones para generar planes');
      return;
    }

    console.log(`Generando planes para ${sesiones.length} sesiones...`);

    // PHASE 1: Obtener unidades didácticas y aplicar mapeo determinístico
    const unidadesDidacticas: UnidadDidactica[] = (planificacion.unidades_didacticas as any) || [];
    const expandedPlan = expandUnitsToSessionPlan(unidadesDidacticas);
    const sessionAssignments = mapSessionsToUnits(sesiones.length, expandedPlan);
    
    // PHASE 3.1: Use sessionBriefs passed as parameter (from wizardData.enfoque.sessionBriefs)
    // If not provided, use empty array (backward compatibility)
    const sessionBriefsArray = sessionBriefs || [];
    
    // DEV-only: Log resumen de asignaciones
    if (import.meta.env.DEV) {
      const summary = {
        totalUnidades: unidadesDidacticas.length,
        totalClasesEstimadas: unidadesDidacticas.reduce((sum, u) => sum + (u.clases_estimadas || 1), 0),
        totalExpanded: expandedPlan.length,
        totalSesiones: sesiones.length,
        primerosAsignamientos: sessionAssignments.slice(0, 5).map(a => ({
          unidad: a.contenido_texto.substring(0, 30),
          claseEnUnidad: a.claseEnUnidad,
          totalClases: a.totalClasesUnidad,
          isExtra: a.isExtraSlot
        }))
      };
      console.log('[PHASE1-generarPlanesAutomaticamente] Mapeo unidades→sesiones:', summary);
    }

    // Extraer todas las competencias de las unidades didácticas
    const competenciasAll: string[] = Array.from(new Set(
      unidadesDidacticas.flatMap((u) => (u.competencias_ids || []))
    ));
    
    // Usar competencias de planificación como fallback si no hay en unidades
    const competencias = competenciasAll.length > 0 
      ? competenciasAll 
      : (planificacion.competencias_seleccionadas || []);
    const criterios = planificacion.mapeo_competencias_contenidos || [];

    console.log('Datos de la planificación:', {
      totalUnidades: unidadesDidacticas.length,
      competencias,
      criterios,
      materia,
      nivel
    });
    
    // Delay inicial para resetear rate limit
    console.log('Esperando 2 segundos antes de iniciar la generación...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // FIX: Accumulate ai_design_report from all sessions
    const accumulatedAiDesignReports: any[] = [];
    
    // Generar plan para cada sesión con reintentos
    for (let i = 0; i < sesiones.length; i++) {
      const sesion = sesiones[i];
      
      // PHASE 1: Usar asignación determinística
      const assignment = sessionAssignments[i];
      
      // Usar competencias de la unidad asignada, o todas si no hay específicas
      const competenciasSesion = assignment.competencias_ids.length > 0
        ? assignment.competencias_ids
        : competencias;
      
      // Usar contenido de la unidad asignada
      const contenidosSesion = [assignment.contenido_texto];

      // PHASE 2: Construir unitContext para generación progresiva
      const unitContext = {
        unidadId: assignment.unidadId,
        contenido: assignment.contenido_texto,
        claseEnUnidad: assignment.claseEnUnidad,
        totalClasesUnidad: assignment.totalClasesUnidad,
        ...(assignment.isExtraSlot && { isExtraSlot: true })
      };

      console.log(`Sesión ${sesion.orden}:`, {
        contenido: assignment.contenido_texto.substring(0, 40),
        claseEnUnidad: assignment.claseEnUnidad,
        totalClasesUnidad: assignment.totalClasesUnidad,
        competencias: competenciasSesion.length
      });
      
      // Delay inicial entre sesiones para evitar rate limiting
      if (i > 0) {
        console.log(`Esperando 3 segundos antes de procesar sesión ${sesion.orden}...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      let intentos = 0;
      const maxIntentos = 3;
      
      while (intentos < maxIntentos) {
        try {
          // PHASE 3.1: Extract sessionBrief from UI state
          const sessionBrief = sessionBriefsArray[i]?.trim();
          
          // PHASE 3.2.1: Log sessionBrief extraction for verification
          if (sessionBrief) {
            console.log(`[SESSION_BRIEF] Sesión ${sesion.orden}: sessionBrief extraído de wizard state: "${sessionBrief}"`);
          } else {
            console.log(`[SESSION_BRIEF] Sesión ${sesion.orden}: NO hay sessionBrief en wizard state (índice ${i})`);
          }
          
          // FIX: Load attached materials (plan-level + session-level) with extracted_text
          const { loadAttachedMaterialsForSession, formatMaterialsForAI } = await import('@/utils/loadAttachedMaterials');
          const attachedMaterials = await loadAttachedMaterialsForSession(planificacionId, sesion.id);
          
          // FIX: Also load unit-level materials for this session's unit
          const unitMaterials: typeof attachedMaterials = [];
          if (assignment.unidadId && unidadesDidacticas) {
            const unidad = unidadesDidacticas.find(u => u.id === assignment.unidadId);
            if (unidad?.unit_material_plan && unidad.unit_material_plan.length > 0) {
              // Check if this session (claseEnUnidad) should include materials from this unit
              for (const unitMaterial of unidad.unit_material_plan) {
                // Include if this session falls within the classCount range for this material
                if (assignment.claseEnUnidad <= unitMaterial.classCount) {
                  // Fetch full material data including extracted_text
                  const { data: materialData } = await supabase
                    .from('teacher_materials')
                    .select('id, title, extracted_text, mime_type')
                    .eq('id', unitMaterial.materialId)
                    .maybeSingle();
                  
                  if (materialData && !materialData.deleted_at) {
                    // Get per-class guidance for this specific class
                    const guidance = unitMaterial.perClassGuidance[assignment.claseEnUnidad - 1] || '';
                    
                    unitMaterials.push({
                      material_id: unitMaterial.materialId,
                      title: unitMaterial.materialTitle,
                      focus_text: guidance || undefined,
                      extracted_text: materialData.extracted_text || undefined,
                      mime_type: materialData.mime_type || undefined,
                      source: 'session' // Unit materials are session-specific
                    });
                  }
                }
              }
            }
          }
          
          // Combine all materials (plan + session + unit)
          const allMaterials = [...attachedMaterials, ...unitMaterials];
          const materialsContext = formatMaterialsForAI(allMaterials);
          
          if (allMaterials.length > 0) {
            console.log(`[MATERIALS] Sesión ${sesion.orden}: ${allMaterials.length} material(es) (${attachedMaterials.length} adjuntos + ${unitMaterials.length} de unidad)`);
            if (import.meta.env.DEV) {
              console.log(`[MATERIALS] Detalle:`, allMaterials.map(m => ({
                title: m.title,
                hasExtractedText: !!m.extracted_text,
                extractedTextLength: m.extracted_text?.length || 0
              })));
            }
          }
          
          const payload = {
            modo: 'generar_plan_html',
            sesionId: sesion.id,
            orden: sesion.orden,
            duracionMin: sesion.duracion_minutos,
            materia: materia || 'Sin especificar',
            nivel: nivel || 'Sin especificar',
            contenidos: contenidosSesion, // PHASE 1: Usar contenido de unidad asignada
            competencias: competenciasSesion, // PHASE 1: Usar competencias de unidad asignada
            criterios: criterios,
            instruccionesDocente: planificacion.requerimientos_docente || undefined, // PHASE 2: Incluir requerimientos del docente
            // PHASE 2: Incluir unitContext para generación progresiva
            unitContext: unitContext,
            // PHASE 3: Include sessionBrief if provided (non-empty, trimmed)
            ...(sessionBrief?.trim() && { sessionBrief: sessionBrief.trim() }),
            // PHASE 3 (Profile Usage): Include group profile and student adjustments if available
            ...(groupContext.perfilGrupo && { perfilGrupo: groupContext.perfilGrupo }),
            ...(groupContext.estudiantes && { estudiantes: groupContext.estudiantes }),
            // PHASE 4: Include attached materials context
            ...(materialsContext && { materialsContext })
          };

          console.log(`Generando plan para sesión ${sesion.orden} (intento ${intentos + 1}/${maxIntentos}) con payload:`, payload);

          // Agregar timeout de 30 segundos
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout después de 30 segundos')), 30000)
          );

          const functionPromise = supabase.functions.invoke('generate-plan-completo', {
            body: payload
          });

          const { data, error } = await Promise.race([functionPromise, timeoutPromise]) as any;

          console.log(`Respuesta para sesión ${sesion.orden}:`, { data, error });

          if (error) {
            console.error(`Error generando plan para sesión ${sesion.orden}:`, error);
            throw new Error(`Error en sesión ${sesion.orden}: ${error.message}`);
          }

          if (!data) {
            console.error(`Sin datos para sesión ${sesion.orden}`);
            throw new Error(`Sin datos para sesión ${sesion.orden}`);
          }

          if (!data.plan_html || !data.plan_html.includes('<section id="plan">')) {
            console.error(`Respuesta inválida para sesión ${sesion.orden}:`, data);
            throw new Error(`Respuesta inválida para sesión ${sesion.orden}`);
          }

          // CONTEMPLACIONES: Use centralized helper to inject deterministic reminders in REPLACE mode
          const fallbackRecursos = normalizeArrayField(data.recursos);
          const finalHtml = buildSanitizedLessonPlanHtml(
            data.plan_html,
            fallbackRecursos,
            grupoId,
            `[WIZARD-CONTEMPLACIONES-S${sesion.orden}]`
          );

          // Actualizar la sesión con el plan generado
          console.log(`Guardando para sesión ${sesion.orden}:`, {
            contenido: contenidosSesion[0]?.substring(0, 40),
            competencias: competenciasSesion.length,
            titulo: data.titulo || sessionBrief || '(sin título)'
          });
          
          // Build update payload
          const updatePayload: any = {
            plan_desarrollo: { html_completo: finalHtml },
            argumento_competencias: data.argumento_competencias,
            recursos: normalizeArrayField(data.recursos),
            contenidos_anep: normalizeArrayField(contenidosSesion), // PHASE 1: Contenido de unidad asignada
            competencias_anep: normalizeArrayField(competenciasSesion),
            criterios_logro_anep: normalizeArrayField(criterios)
          };
          
          // PHASE 3.2.1 FIX: Update titulo if available (from Edge Function response or sessionBrief)
          // Priority: 1) data.titulo (extracted from generated HTML), 2) sessionBrief (teacher input)
          if (data.titulo) {
            updatePayload.titulo = data.titulo;
            console.log(`[SESSION_BRIEF] Sesión ${sesion.orden}: titulo actualizado desde Edge Function: "${data.titulo}"`);
          } else if (sessionBrief) {
            updatePayload.titulo = sessionBrief;
            console.log(`[SESSION_BRIEF] Sesión ${sesion.orden}: titulo actualizado desde sessionBrief: "${sessionBrief}"`);
          } else {
            console.log(`[SESSION_BRIEF] Sesión ${sesion.orden}: NO se actualiza titulo (ni data.titulo ni sessionBrief disponibles)`);
          }
          
          // PHASE 3.2.1: Log DB update payload
          console.log(`[SESSION_BRIEF] Sesión ${sesion.orden}: Actualizando DB con titulo=${updatePayload.titulo || '(null)'}`);
          
          const { error: updateError } = await supabase
            .from('sesiones_clase')
            .update(updatePayload)
            .eq('id', sesion.id);
          
          // FIX: Accumulate ai_design_report from this session
          if (data.ai_design_report) {
            accumulatedAiDesignReports.push({
              sessionOrder: sesion.orden,
              report: data.ai_design_report
            });
            if (import.meta.env.DEV) {
              console.log(`[FIX] Sesión ${sesion.orden}: ai_design_report acumulado`);
            }
          }
          
          if (!updateError) {
            console.log(`[SESSION_BRIEF] Sesión ${sesion.orden}: DB actualizada exitosamente con titulo`);
          } else {
            console.error(`[SESSION_BRIEF] Sesión ${sesion.orden}: Error actualizando DB:`, updateError);
          }

          if (updateError) {
            console.error(`Error actualizando sesión ${sesion.orden}:`, updateError);
            throw new Error(`Error actualizando sesión ${sesion.orden}: ${updateError.message}`);
          } else {
            console.log(`Plan generado exitosamente para sesión ${sesion.orden}`);
            break; // Salir del bucle de reintentos si fue exitoso
          }

        } catch (error) {
          intentos++;
          console.error(`Error procesando sesión ${sesion.orden} (intento ${intentos}/${maxIntentos}):`, error);
          
          // Manejo específico para error 429 (Too Many Requests)
          if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
            console.warn(`Rate limit detectado para sesión ${sesion.orden}. Esperando más tiempo...`);
          }
          
          if (intentos >= maxIntentos) {
            console.error(`Falló definitivamente la sesión ${sesion.orden} después de ${maxIntentos} intentos`);
            // Continuar con la siguiente sesión en lugar de fallar todo
            break;
          } else {
            // Esperar más tiempo antes del siguiente intento (especialmente para 429)
            const delayTime = error.message?.includes('429') ? 5000 : 3000; // 5s para 429, 3s para otros
            console.log(`Esperando ${delayTime/1000} segundos antes del siguiente intento...`);
            await new Promise(resolve => setTimeout(resolve, delayTime));
          }
        }
      }
    }

    console.log('Generación automática de planes completada');
    
    // FIX: Persist aggregated ai_design_report to planificacion
    if (accumulatedAiDesignReports.length > 0) {
      // Aggregate reports: use the most comprehensive one (or combine)
      const aggregatedReport = accumulatedAiDesignReports.length === 1
        ? accumulatedAiDesignReports[0].report
        : {
            inputsUsed: {
              anepContent: accumulatedAiDesignReports.some(r => r.report?.inputsUsed?.anepContent),
              materials: accumulatedAiDesignReports.some(r => r.report?.inputsUsed?.materials),
              sessionBrief: accumulatedAiDesignReports.some(r => r.report?.inputsUsed?.sessionBrief),
              unitContext: accumulatedAiDesignReports.some(r => r.report?.inputsUsed?.unitContext),
              sessionsCount: accumulatedAiDesignReports.length
            },
            decisions: {
              structure: 'Estructura estándar aplicada a múltiples sesiones',
              timeAllocation: `Distribución de tiempo para ${accumulatedAiDesignReports.length} sesiones`
            },
            assumptions: [
              'Estudiantes tienen conocimientos previos básicos',
              'Recursos básicos disponibles',
              `Planificación generada para ${accumulatedAiDesignReports.length} sesiones`
            ],
            sessionsGenerated: accumulatedAiDesignReports.length
          };
      
      const { error: reportUpdateError } = await supabase
        .from('planificaciones')
        .update({ ai_design_report: aggregatedReport })
        .eq('id', planificacionId);
      
      if (reportUpdateError) {
        console.error('[FIX] Error persistiendo ai_design_report:', reportUpdateError);
      } else {
        if (import.meta.env.DEV) {
          console.log('[FIX] ai_design_report persistido en planificación:', planificacionId);
        }
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn('[FIX] No se acumuló ningún ai_design_report de las sesiones generadas');
      }
    }
    
    // Verificar que todas las sesiones tengan planes generados
    const { data: sesionesVerificacion, error: verificacionError } = await supabase
      .from('sesiones_clase')
      .select('id, plan_desarrollo')
      .eq('planificacion_id', planificacionId);

    if (verificacionError) {
      console.error('Error verificando planes generados:', verificacionError);
      return false;
    }

    const sesionesSinPlan = sesionesVerificacion?.filter(s => !s.plan_desarrollo?.html_completo) || [];
    
    if (sesionesSinPlan.length > 0) {
      console.error(`${sesionesSinPlan.length} sesiones sin plan generado:`, sesionesSinPlan);
      return false;
    }

    console.log('Todas las sesiones tienen planes generados correctamente');
    return true;

  } catch (error) {
    console.error('Error en generación automática de planes:', error);
    return false;
  }
};

export default function PlanificacionWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isGeneratingPlans, setIsGeneratingPlans] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const {
    wizardData,
    isLoading,
    error,
    updatePaso,
    updateContexto,
    updateHorario,
    updateEnfoque,
    updateTipoPlanificacion,
    validarPaso,
    generarSesionesEsquema,
    reiniciarWizard,
    isDataComplete,
    setIsLoading,
    setError
  } = usePlanificacionWizard();

  const { generateAllSessions, isGenerating } = useFullSessionGeneration();

  const handleNext = () => {
    const validacion = validarPaso(wizardData.paso);
    if (validacion.valid) {
      // Si estamos en el paso 0 y el tipo es "sin_periodo", saltar al paso 2
      if (wizardData.paso === 0 && wizardData.tipo_planificacion === 'sin_periodo') {
        updatePaso(2);
      } else {
        updatePaso((wizardData.paso + 1) as any);
      }
    }
  };

  const handlePrev = () => {
    if (wizardData.paso > 0) {
      // Si estamos en el paso 2 y el tipo es "sin_periodo", volver al paso 0
      if (wizardData.paso === 2 && wizardData.tipo_planificacion === 'sin_periodo') {
        updatePaso(0);
      } else {
        updatePaso((wizardData.paso - 1) as any);
      }
    }
  };

  const handleRetryGeneration = async () => {
    if (!wizardData.planificacionId) return;
    
    setIsGeneratingPlans(true);
    setGenerationError(null);
    
    // Esperar un poco antes de reintentar para evitar rate limiting
    console.log('Esperando 5 segundos antes de reintentar...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      // PHASE 3.2: Resolve sessionBriefs from wizard state or DB (source-of-truth)
      const resolvedBriefs = await resolveSessionBriefs(
        wizardData.planificacionId,
        wizardData.enfoque?.sessionBriefs
      );

      const planesGenerados = await generarPlanesAutomaticamente(
        wizardData.planificacionId, 
        wizardData.materia || 'Sin especificar', 
        wizardData.nivel || 'Sin especificar',
        resolvedBriefs,  // PHASE 3.2: Use resolved briefs (wizard state or DB)
        wizardData.contexto?.grupo_id  // PHASE 3 (Profile Usage): Pass grupo_id
      );
      
      if (planesGenerados) {
        toast({
          title: "¡Planificación completa!",
          description: "Todos los planes de clase han sido generados y guardados.",
        });
        navigate(`/planificacion/${wizardData.planificacionId}`);
      } else {
        throw new Error('No se pudieron generar todos los planes');
      }
    } catch (error) {
      console.error('Error en reintento de generación:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setGenerationError(errorMessage);
      toast({
        title: "Error en reintento",
        description: "El problema persiste. Revisa la consola para más detalles.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPlans(false);
    }
  };

  const handleFinish = async () => {
    // DEV: Log validation state at start
    if (import.meta.env.DEV) {
      console.log('[PlanificacionWizard] handleFinish called', {
        tipo_planificacion: wizardData.tipo_planificacion,
        hasContexto: !!wizardData.contexto,
        hasHorario: !!wizardData.horario,
        hasEnfoque: !!wizardData.enfoque
      });
    }

    // Conditional validation based on tipo_planificacion
    // Always require contexto and enfoque
    if (!wizardData.contexto || !wizardData.enfoque) {
      toast({
        title: "Error",
        description: "Faltan datos requeridos para crear la planificación",
        variant: "destructive"
      });
      return;
    }

    // Require horario ONLY for periodo_especifico
    if (wizardData.tipo_planificacion !== 'sin_periodo' && !wizardData.horario) {
      toast({
        title: "Error",
        description: "Faltan datos requeridos para crear la planificación (horario no configurado)",
        variant: "destructive"
      });
      return;
    }

    // For sin_periodo, validate cantidad_sesiones and duracion_por_sesion
    if (wizardData.tipo_planificacion === 'sin_periodo') {
      if (!wizardData.contexto.cantidad_sesiones || wizardData.contexto.cantidad_sesiones <= 0) {
        toast({
          title: "Error",
          description: "Debes especificar una cantidad de sesiones mayor a 0",
          variant: "destructive"
        });
        return;
      }
      if (!wizardData.contexto.duracion_por_sesion || wizardData.contexto.duracion_por_sesion <= 0) {
        toast({
          title: "Error",
          description: "Debes especificar una duración por sesión mayor a 0 minutos",
          variant: "destructive"
        });
        return;
      }
    }

    // Prevent double-clicks and concurrent creation attempts
    if (isCreating || isLoading || isGeneratingPlans) {
      console.warn('[PlanificacionWizard] Creation already in progress, ignoring duplicate request');
      return;
    }

    setIsCreating(true);
    setIsLoading(true);
    setError(null);
    setGenerationError(null);

    try {
      // Ensure we have a valid session
      let currentUser;
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('[PlanificacionWizard] No valid session, ensuring demo auth...');
        const { error: ensureError } = await supabase.functions.invoke('ensure-demo-users');
        if (ensureError) {
          console.error('[PlanificacionWizard] Error ensuring demo users:', ensureError);
          // Non-blocking: continue anyway
        }
        
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: 'demo.teacher@example.com',
          password: 'DemoPassword2024!'
        });
        
        if (signInError) {
          const errorMsg = `No se pudo autenticar: ${signInError.message}`;
          if (import.meta.env.DEV) {
            console.error('[PlanificacionWizard] Sign-in error:', signInError);
          }
          throw new Error(errorMsg);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: { user: retryUser }, error: retryError } = await supabase.auth.getUser();
        if (retryError || !retryUser) {
          const errorMsg = retryError 
            ? `No se pudo establecer la sesión: ${retryError.message}`
            : 'No se pudo establecer la sesión de usuario.';
          if (import.meta.env.DEV) {
            console.error('[PlanificacionWizard] Retry get user error:', retryError);
          }
          throw new Error(errorMsg);
        }
        currentUser = retryUser;
      } else {
        currentUser = user;
      }

      console.log('Creating planification with user:', currentUser.id);

      // Extract competencies, contenidos, and mapping from wizard data
      const unidadesDidacticas = wizardData.enfoque?.unidades_didacticas ?? [];
      const competenciasSeleccionadas = extractCompetenciesFromUnits(unidadesDidacticas);
      const contenidosPrograma = extractContenidosFromUnits(unidadesDidacticas);
      const mapeoCompetenciasContenidos = buildCompetenciasContenidosMap(unidadesDidacticas);

      console.log('[Planificacion Creation] Extracted competencies:', competenciasSeleccionadas.length);
      console.log('[Planificacion Creation] Extracted contenidos:', contenidosPrograma.length);

      // Crear la planificación
      const { data: planificacion, error: planError } = await supabase
        .from('planificaciones')
        .insert({
          user_id: currentUser.id,
          grupo_id: wizardData.contexto.grupo_id,
          materia: wizardData.contexto.materia,
          fecha_inicio: wizardData.contexto.fecha_inicio || null,
          fecha_fin: wizardData.contexto.fecha_fin || null,
          // horario fields: only for periodo_especifico
          horas_semanales: wizardData.horario?.horas_semanales || null,
          configuracion_horario: wizardData.horario?.configuracion || null,
          unidades_didacticas: wizardData.enfoque.unidades_didacticas,
          competencias_seleccionadas: competenciasSeleccionadas,
          contenidos_programa: contenidosPrograma,
          mapeo_competencias_contenidos: mapeoCompetenciasContenidos,
          requerimientos_docente: wizardData.enfoque.requerimientos_docente,
          distribucion_modalidades: wizardData.enfoque.distribucion_modalidades,
          estrategias_diferenciacion: wizardData.enfoque.estrategias_diferenciacion,
          objetivos_unidad: wizardData.enfoque.objetivos_unidad,
          cantidad_sesiones: wizardData.contexto.cantidad_sesiones,
          cadencia_deseada: wizardData.contexto.cadencia_deseada,
          bloques_preferidos: wizardData.contexto.bloques_preferidos,
          ventana_sugerida: wizardData.contexto.ventana_sugerida,
          nivel: '9', // Required field with default
          is_saved: false // Planification not explicitly saved yet (won't appear in "Mis Planificaciones" until saved)
        })
        .select()
        .maybeSingle();

      if (planError) {
        if (import.meta.env.DEV) {
          console.error('[PlanificacionWizard] Plan creation error:', planError);
        }
        // GUARDRAIL: Si la columna is_saved no existe (PGRST204), mensaje más claro
        if (planError.code === 'PGRST204' || planError.message.includes('is_saved')) {
          throw new Error(`❌ MIGRACIÓN FALTANTE: La columna 'is_saved' no existe en tabla planificaciones. Ejecuta: supabase db push`);
        }
        throw new Error(`Error al crear la planificación: ${planError.message || planError.code || 'Error desconocido'}`);
      }
      if (!planificacion) {
        throw new Error('No se pudo crear la planificación. La respuesta de la base de datos está vacía.');
      }

      console.log('Planificación creada:', planificacion.id);
      
      // Guardar el ID de la planificación para posibles reintentos
      wizardData.planificacionId = planificacion.id;

      // Persist plan-level material attachments (if any)
      const attachedPlanMaterialIds = wizardData.enfoque?.attachedPlanMaterialIds || [];
      if (attachedPlanMaterialIds.length > 0) {
        const { addAttachment } = await import('@/services/materials');
        
        console.log(`[Materials] Attaching ${attachedPlanMaterialIds.length} materials to plan ${planificacion.id}`);
        
        const attachmentPromises = attachedPlanMaterialIds.map((materialId, index) =>
          addAttachment({
            target_type: 'planificacion',
            target_id: planificacion.id,
            material_id: materialId,
            priority: index + 1
          })
        );
        
        const attachmentResults = await Promise.allSettled(attachmentPromises);
        const failedAttachments = attachmentResults.filter(r => r.status === 'rejected');
        
        if (failedAttachments.length > 0) {
          console.error('[Materials] Some attachments failed:', failedAttachments);
          toast({
            title: 'Advertencia',
            description: `${failedAttachments.length} material(es) no se pudieron adjuntar. La planificación se creó correctamente.`,
            variant: 'default'
          });
        } else {
          console.log(`[Materials] Successfully attached ${attachedPlanMaterialIds.length} materials`);
        }
      }

      // Determinar tipo de planificación y crear sesiones
      if (wizardData.tipo_planificacion === 'sin_periodo') {
        // Modo backlog: crear sesiones sin fecha específica
        const cantidadSesiones = wizardData.contexto.cantidad_sesiones!;
        const duracionPorSesion = wizardData.contexto.duracion_por_sesion!;

        console.log('Creando sesiones en backlog:', cantidadSesiones, 'duración:', duracionPorSesion);

        const sesionesBacklog = Array.from({ length: cantidadSesiones }, (_, i) => ({
          planificacion_id: planificacion.id,
          fecha: null,
          orden: i + 1,
          estado: 'backlog' as const,
          duracion_minutos: duracionPorSesion,
          competencias_anep: [],
          contenidos_anep: [],
          criterios_logro_anep: [],
          plan_desarrollo: {},
          evaluacion: { tipo: 'observacion' as const },
          recursos: [],
          es_feriado: false,
          bloqueo_reserva: false
        }));

        const { error: sesionesError } = await supabase
          .from('sesiones_clase')
          .insert(sesionesBacklog);

        if (sesionesError) {
          if (import.meta.env.DEV) {
            console.error('[PlanificacionWizard] Sessions creation error:', sesionesError);
          }
          throw new Error(`Error al crear las sesiones: ${sesionesError.message || sesionesError.code || 'Error desconocido'}`);
        }

        console.log('Sesiones creadas exitosamente en backlog');

        toast({
          title: "¡Planificación flexible creada!",
          description: `Se crearon ${cantidadSesiones} sesiones en backlog listas para agendar`,
        });

      } else {
        // Modo con fechas específicas: crear sesiones directamente en el calendario
        const fechasSesiones = generarSesionesEsquema();
        console.log('Creando sesiones en calendario:', fechasSesiones.length, 'fechas');

        const sesionesCalendario = fechasSesiones.map((fecha, index) => {
          // Calcular duración basada en la configuración del día
          const diaSemana = fecha.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
          const configDia = wizardData.horario?.configuracion.find(
            config => config.dia === diaSemana
          );
          const duracion = configDia?.duracionMinutos || 60;

          return {
            planificacion_id: planificacion.id,
            fecha: fecha.toISOString().split('T')[0],
            orden: index + 1,
            estado: 'planificada' as const,
            duracion_minutos: duracion,
            competencias_anep: [],
            contenidos_anep: [],
            criterios_logro_anep: [],
            plan_desarrollo: {},
            evaluacion: { tipo: 'observacion' as const },
            recursos: [],
            es_feriado: false,
            bloqueo_reserva: false
          };
        });

        const { error: sesionesError } = await supabase
          .from('sesiones_clase')
          .insert(sesionesCalendario);

        if (sesionesError) {
          if (import.meta.env.DEV) {
            console.error('[PlanificacionWizard] Sessions creation error:', sesionesError);
          }
          throw new Error(`Error al crear las sesiones: ${sesionesError.message || sesionesError.code || 'Error desconocido'}`);
        }

        console.log('Sesiones creadas exitosamente en calendario');

        toast({
          title: "¡Planificación con fechas creada!",
          description: `Se crearon ${fechasSesiones.length} sesiones automáticamente en el calendario`,
        });
      }

      // PHASE 3.2: Persist session briefs to database before generation
      // This ensures briefs survive refresh/navigation and are available for retry
      const sessionBriefsToPersist = wizardData.enfoque?.sessionBriefs;
      
      // PHASE 3.2.1: Log session briefs before persistence
      if (sessionBriefsToPersist && sessionBriefsToPersist.length > 0) {
        const meaningfulBriefs = sessionBriefsToPersist.filter(b => b?.trim());
        console.log(`[SESSION_BRIEF] Persistiendo ${meaningfulBriefs.length} session briefs a DB antes de generación`);
        meaningfulBriefs.forEach((brief, idx) => {
          console.log(`[SESSION_BRIEF]   Sesión ${idx + 1}: "${brief}"`);
        });
      } else {
        console.log(`[SESSION_BRIEF] NO hay session briefs para persistir (wizard state vacío)`);
      }
      
      const persistResult = await persistSessionBriefs(planificacion.id, sessionBriefsToPersist);
      
      // PHASE 3.2.1: Log persistence result
      console.log(`[SESSION_BRIEF] Resultado de persistencia: ok=${persistResult.ok}, attempted=${persistResult.attempted}, failures=${persistResult.failures}`);
      
      // P2 FIX: Show warning toast if persistence had failures (non-blocking)
      if (!persistResult.ok || persistResult.failures > 0) {
        toast({
          title: "Advertencia",
          description: "No se pudieron guardar algunos temas de las clases. La generación continuará con los valores actuales.",
          variant: "default"
        });
      }

      // Generar automáticamente los planes de todas las sesiones ANTES de navegar
      setIsGeneratingPlans(true);
      setGenerationError(null);
      toast({
        title: "Generando planes automáticamente",
        description: "La IA está creando el contenido de todas las sesiones. Esto puede tomar unos momentos...",
      });
      
      // Esperar a que se complete la generación antes de navegar
      try {
        const planesGenerados = await generarPlanesAutomaticamente(
          planificacion.id, 
          planificacion.materia, 
          planificacion.nivel,
          wizardData.enfoque?.sessionBriefs,  // PHASE 3.1: Pass sessionBriefs from wizard state
          wizardData.contexto?.grupo_id  // PHASE 3 (Profile Usage): Pass grupo_id
        );
        
        if (planesGenerados) {
          toast({
            title: "¡Planificación completa!",
            description: "Todos los planes de clase han sido generados y guardados.",
          });
          
          // Navigate to workspace after successful creation
          const planificacionId = planificacion.id;
          console.log(`[PlanificacionWizard] Navigating to workspace: /planificacion/${planificacionId}`);
          navigate(`/planificacion/${planificacionId}`);
          return; // Exit early on success
        } else {
          throw new Error('No se pudieron generar todos los planes. Algunas sesiones pueden no tener contenido generado.');
        }
      } catch (generationError) {
        const errorMessage = generationError instanceof Error ? generationError.message : 'Error desconocido al generar planes';
        if (import.meta.env.DEV) {
          console.error('[PlanificacionWizard] Error en generación automática:', generationError);
        }
        setGenerationError(errorMessage);
        
        // Show error toast but still navigate if plan was created
        toast({
          title: "Advertencia",
          description: "La planificación se creó pero hubo problemas al generar algunos planes. Puedes generarlos más tarde desde el workspace.",
          variant: "default"
        });
        
        // Navigate anyway if plan was created (partial success)
        if (planificacion?.id) {
          console.log(`[PlanificacionWizard] Navigating to workspace despite generation errors: /planificacion/${planificacion.id}`);
          navigate(`/planificacion/${planificacion.id}`);
          return;
        }
        
        // Only block navigation if plan creation itself failed
        setIsGeneratingPlans(false);
        return;
      } finally {
        setIsGeneratingPlans(false);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo crear la planificación. Inténtalo nuevamente.';
      
      if (import.meta.env.DEV) {
        console.error('[PlanificacionWizard] Error creando planificación:', error);
      }
      
      toast({
        title: "Error al crear planificación",
        description: errorMessage,
        variant: "destructive",
        duration: 5000 // Show longer for errors
      });
      setError(`Error creando la planificación: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setIsCreating(false);
    }
  };

  const validation = validarPaso(wizardData.paso);

  // Mostrar pantalla de carga cuando se están generando los planes
  if (isGeneratingPlans || generationError) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <Card className="text-center p-12">
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-6">
                  <Bot className="h-16 w-16 text-primary animate-pulse" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">
                  {generationError ? 'Error en la generación' : 'Generando planes automáticamente. Tu clase estaraá lista pronto!'}
                </h2>
                <p className="text-muted-foreground">
                  {generationError 
                    ? (generationError.includes('429') || generationError.includes('Too Many Requests')
                        ? 'Demasiadas solicitudes a la IA. El sistema está esperando antes de reintentar...'
                        : 'Hubo un problema al generar los planes. Por favor, reintentar.')
                    : 'La IA está creando el contenido de todas las sesiones. Esto puede tomar varios minutos porque queremos asegurar la mejor calidad posible.'
                  }
                </p>
                {!generationError && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                    <strong>Nota:</strong> El proceso es lento intencionalmente para evitar errores de velocidad. 
                    Por favor, no cierres esta ventana.
                  </div>
                )}
              </div>

              {generationError ? (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-mono">
                      {generationError}
                    </p>
                  </div>
                  <Button 
                    onClick={handleRetryGeneration}
                    disabled={isGeneratingPlans}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isGeneratingPlans ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Reintentando...
                      </>
                    ) : (
                      'Reintentar generación'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              
              <div className="text-sm text-muted-foreground">
                {generationError 
                  ? 'Revisa la consola del navegador (F12) para ver los detalles del error.'
                  : 'Por favor, no cierres esta ventana mientras se generan los planes.'
                }
              </div>
            </div>
          </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/planificacion')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        
        <div>
          <h1 className="text-2xl font-bold">Asistente de Planificación Inteligente</h1>
          <p className="text-muted-foreground">
            Crea una planificación completa con IA paso a paso
          </p>
        </div>
      </div>

      {/* Wizard Content */}
      <WizardSteps
        wizardData={wizardData}
        onUpdateContexto={updateContexto}
        onUpdateHorario={updateHorario}
        onUpdateEnfoque={updateEnfoque}
        onUpdateTipoPlanificacion={updateTipoPlanificacion}
        onNext={handleNext}
        onPrev={handlePrev}
        onFinish={handleFinish}
        isLoading={isLoading || isGenerating || isCreating}
        validation={validation}
      />

      {/* Info Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">🤖 Planificación Automática con IA</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Este asistente genera automáticamente planes completos para cada clase usando IA. 
            Cada sesión incluirá actividades estructuradas (inicio, desarrollo, cierre), 
            diferenciación integrada, recursos específicos y evaluación alineada con competencias ANEP.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}