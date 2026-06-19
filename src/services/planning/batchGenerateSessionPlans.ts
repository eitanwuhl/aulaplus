import { supabase } from '@/integrations/supabase/client';
import { normalizeArrayField } from '@/lib/normalizeSupabaseArrays';
import { buildSanitizedLessonPlanHtml } from '@/lib/planParser';
import {
  expandUnitsToSessionPlan,
  mapSessionsToUnits,
} from '@/lib/planificacion/unitSessionPlan';
import { loadGroupContext } from '@/services/groupContext/provider';
import { invokeGeneratePlanCompleto } from '@/services/planning/generatePlanCompleto';
import { sanitizePlanningAiDesignReport } from '@/services/planning/teacherSafeAiReport';
import type { UnidadDidactica, WizardData } from '@/types/planificacion';

export type BatchGenerateResult =
  | { success: true }
  | { success: false; failedSessions?: { id: string; observaciones?: string | null }[]; error?: string }
  | false
  | undefined;

export async function batchGenerateSessionPlans(
  planificacionId: string, 
  materia: string, 
  nivel: string,
  sessionBriefs?: (string | undefined)[],  // PHASE 3.1: Optional per-session focus overrides
  grupoId?: string,  // PHASE 3 (Profile Usage): Optional grupo_id to fetch profile
  wizardData?: WizardData  // GOAL A: Pasar wizardData para obtener duracion_por_sesion
) {
  try {
    console.log('Iniciando generación automática de planes...');
    
    // PHASE 4: Load group context from school catalog (shared helper)
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
    const sessionAssignments = mapSessionsToUnits(sesiones.length, expandedPlan, {
      fallbackContenido: 'Contenido general',
    });
    
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
      
      // Prioridad de competencias por sesión:
      // 1) competencias ya guardadas en la sesión (fuente más específica)
      // 2) competencias de la unidad asignada
      // 3) competencias globales de la planificación
      const competenciasSesionPersistidas = normalizeArrayField((sesion as any).competencias_anep);
      const competenciasSesion = competenciasSesionPersistidas.length > 0
        ? competenciasSesionPersistidas
        : assignment.competencias_ids.length > 0
        ? assignment.competencias_ids
        : competencias;
      
      // Usar contenido de la unidad asignada
      // FIX: Filter empty strings to send [] not [""] when no ANEP content
      const contenidosSesion = assignment.contenido_texto?.trim() 
        ? [assignment.contenido_texto.trim()] 
        : [];

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
        competencias: competenciasSesion.length,
        competenciasFuente: competenciasSesionPersistidas.length > 0 ? 'sesion' : (assignment.competencias_ids.length > 0 ? 'unidad' : 'planificacion')
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
          let materialsContext = formatMaterialsForAI(allMaterials);
          
          // FIX: Check if materials-only planning (no ANEP content) and BLOCK if extracted_text is missing
          const hasAnepContent = contenidosSesion.length > 0;
          const hasMaterials = allMaterials.length > 0;
          const pdfMaterials = allMaterials.filter(m => m.mime_type?.includes('pdf'));
          const materialsWithoutText = pdfMaterials.filter(m => !m.extracted_text);
          
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
          
          // FIX: BLOCK materials-only planning if PDFs lack extracted_text
          if (!hasAnepContent && hasMaterials && materialsWithoutText.length > 0) {
            const missingTitles = materialsWithoutText.map(m => m.title).join(', ');
            const missingIds = materialsWithoutText.map(m => m.material_id).filter(Boolean) as string[];
            
            console.warn(`[MATERIALS] ⚠️ Sesión ${sesion.orden}: Planificación solo con materiales pero ${materialsWithoutText.length} PDF(s) sin texto extraído: ${missingTitles}`);
            
            // Try to trigger extraction and poll for results
            // Use direct import path to avoid barrel export issues
            const mod = await import('@/services/materials/materials');
            const { extractMaterialText } = mod;
            const { pollExtractedText } = await import('@/utils/pollExtractedText');
            
            if (typeof extractMaterialText !== 'function') {
              throw new Error('extractMaterialText is not a function. Cannot trigger extraction.');
            }
            
            // Trigger extraction for all missing materials
            const extractionPromises = missingIds.map(id => extractMaterialText(id));
            await Promise.allSettled(extractionPromises);
            
            // Poll for extracted_text with progress updates
            let allExtracted = true;
            for (const material of materialsWithoutText) {
              if (!material.material_id) continue;
              
              const pollResult = await pollExtractedText({
                materialId: material.material_id,
                maxWaitSeconds: 10,
                pollIntervalMs: 1000,
                onProgress: (attempt, maxAttempts) => {
                  if (import.meta.env.DEV) {
                    console.log(`[MATERIALS] Polling extracted_text for "${material.title}" (${attempt}/${maxAttempts})...`);
                  }
                }
              });
              
              if (!pollResult.success) {
                allExtracted = false;
                console.error(`[MATERIALS] ❌ Failed to extract text for "${material.title}": ${pollResult.error}`);
              } else {
                console.log(`[MATERIALS] ✅ Extracted text available for "${material.title}": ${pollResult.extractedChars} chars`);
                // Reload material to get updated extracted_text
                const { loadAttachedMaterialsForSession } = await import('@/utils/loadAttachedMaterials');
                const updatedMaterials = await loadAttachedMaterialsForSession(planificacionId, sesion.id);
                const updatedMaterial = updatedMaterials.find(m => m.material_id === material.material_id);
                if (updatedMaterial?.extracted_text) {
                  // Update in allMaterials array
                  const index = allMaterials.findIndex(m => m.material_id === material.material_id);
                  if (index >= 0) {
                    allMaterials[index] = updatedMaterial;
                  }
                }
              }
            }
            
            // If still missing after polling, throw error to block generation
            if (!allExtracted) {
              const stillMissing = allMaterials.filter(m => 
                m.mime_type?.includes('pdf') && !m.extracted_text
              );
              const stillMissingTitles = stillMissing.map(m => m.title).join(', ');
              throw new Error(
                `No se puede generar planificación solo con materiales: los siguientes PDFs no tienen texto extraído: ${stillMissingTitles}. ` +
                `Por favor, espera a que se complete la extracción o usa el botón "Re-extraer" en la biblioteca de materiales.`
              );
            }
            
            // Re-format materials context with updated extracted_text
            materialsContext = formatMaterialsForAI(allMaterials);
          }
          
          // TASK 1: Validar y obtener duracionMin - MANDATORY with defensive fallback
          // Prioridad: 1) sesion.duracion_minutos, 2) wizardData.contexto.duracion_por_sesion, 3) default 60
          let duracionMin: number;
          if (sesion.duracion_minutos && sesion.duracion_minutos > 0) {
            duracionMin = Number(sesion.duracion_minutos);
          } else {
            // Intentar obtener del wizard state (para sesiones recién creadas)
            const duracionFromWizard = wizardData?.contexto?.duracion_por_sesion;
            if (duracionFromWizard && duracionFromWizard > 0) {
              duracionMin = Number(duracionFromWizard);
              console.warn(`[GEN_PLAN] Sesión ${sesion.orden} no tiene duracion_minutos, usando valor del wizard: ${duracionMin}`);
            } else {
              // TASK 1: Defensive fallback - default to 60 instead of aborting
              duracionMin = 60;
              console.warn(`[GEN_PLAN] Sesión ${sesion.orden} no tiene duración válida. Usando fallback: ${duracionMin} min. Sesión: ${sesion.duracion_minutos}, Wizard: ${duracionFromWizard}`);
            }
          }
          
          // TASK 1: Ensure duracionMin is always a valid number
          if (!duracionMin || isNaN(duracionMin) || duracionMin <= 0) {
            duracionMin = 60; // Final fallback
            console.error(`[GEN_PLAN] duracionMin inválido, forzando fallback a 60`);
          }
          
          const payload = {
            modo: 'generar_plan_html',
            sesionId: sesion.id,
            orden: sesion.orden,
            duracionMin: duracionMin, // TASK 1: Always explicitly included
            materia: materia || 'Sin especificar',
            nivel: nivel || 'Sin especificar',
            contenidos: contenidosSesion, // PHASE 1: Usar contenido de unidad asignada (empty array if no content)
            competencias: competenciasSesion, // PHASE 1: Usar competencias de unidad asignada
            criterios: criterios,
            instruccionesDocente: planificacion.requerimientos_docente || undefined, // PHASE 2: Incluir requerimientos del docente
            // PHASE 2: Incluir unitContext para generación progresiva
            unitContext: unitContext,
            // Multi-session: total slots so backend coverage plan matches all sessions (fixes session 3+ generic content)
            totalSlots: sesiones.length,
            // PHASE 3: Include sessionBrief if provided (non-empty, trimmed)
            ...(sessionBrief?.trim() && { sessionBrief: sessionBrief.trim() }),
            // PHASE 3 (Profile Usage): Include group profile and student adjustments if available
            ...(groupContext.perfilGrupo && { perfilGrupo: groupContext.perfilGrupo }),
            ...(groupContext.estudiantes && { estudiantes: groupContext.estudiantes }),
            // PHASE 4: Include attached materials context (always include if materials exist)
            ...(allMaterials.length > 0 && { materialsContext })
          };

          console.log(`[GEN_PLAN] Generando plan para sesión ${sesion.orden} (intento ${intentos + 1}/${maxIntentos})`);
          console.log(`[GEN_PLAN] session_id=${sesion.id}, orden=${sesion.orden}, duracionMin=${duracionMin}`);
          // TASK 1: Log full payload for verification (temporary)
          console.log('[GEN_PLAN] Full payload:', JSON.stringify({ ...payload, materialsContext: payload.materialsContext ? '[PRESENT]' : '[MISSING]' }, null, 2));

          const startTime = Date.now();
          const { data, error: invokeError } = await invokeGeneratePlanCompleto(payload);
          const elapsedTime = Date.now() - startTime;
          console.log(`[GEN_PLAN] Respuesta recibida para sesión ${sesion.orden} en ${elapsedTime}ms`);

          console.log(`Respuesta para sesión ${sesion.orden}:`, { data, error: invokeError });

          if (invokeError) {
            console.error(`[GEN_PLAN] Error generando plan para sesión ${sesion.orden}:`, invokeError);
            const errMsg = invokeError.message || '';
            if (errMsg.includes('duracionMin') || errMsg.includes('INVALID_INPUT')) {
              throw new Error(`Error de validación: ${errMsg}. No se reintentará.`);
            }
            throw new Error(`Error en sesión ${sesion.orden}: ${errMsg || 'Error desconocido'}`);
          }

          if (!data) {
            console.error(`[GEN_PLAN] Sin datos para sesión ${sesion.orden}`);
            throw new Error(`Sin datos para sesión ${sesion.orden}`);
          }
          
          // TASK 3: Check for error in response data (non-200 but no exception)
          if (data.error && data.error_code) {
            console.error(`[GEN_PLAN] Error en respuesta para sesión ${sesion.orden}:`, data.error, data.error_code);
            if (data.error_code === 'INVALID_INPUT' || data.error_field === 'duracionMin') {
              throw new Error(`Error de validación: ${data.error}. No se reintentará.`);
            }
            throw new Error(`Error en sesión ${sesion.orden}: ${data.error}`);
          }

          if (!data.plan_html || !data.plan_html.includes('<section id="plan">')) {
            console.error(`Respuesta inválida para sesión ${sesion.orden}:`, data);
            throw new Error(`Respuesta inválida para sesión ${sesion.orden}`);
          }

          // CONTEMPLACIONES: Use centralized helper to inject deterministic reminders in REPLACE mode
          const fallbackRecursos = normalizeArrayField(data.recursos);
          const finalHtml = await buildSanitizedLessonPlanHtml(
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
          
          // FIX: Persist ai_design_report to session if available
          const safeAiReport = sanitizePlanningAiDesignReport(data.ai_design_report);
          if (safeAiReport) {
            updatePayload.ai_design_report = safeAiReport;
            if (import.meta.env.DEV) {
              console.log(`[FIX] Sesión ${sesion.orden}: ai_design_report incluido en updatePayload`);
            }
          }
          
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
          if (safeAiReport) {
            accumulatedAiDesignReports.push({
              sessionOrder: sesion.orden,
              report: safeAiReport
            });
            if (import.meta.env.DEV) {
              console.log(`[FIX] Sesión ${sesion.orden}: ai_design_report acumulado`);
            }
          }
          
          if (!updateError) {
            console.log(`[SESSION_BRIEF] Sesión ${sesion.orden}: DB actualizada exitosamente con titulo`);
            if (import.meta.env.DEV && updatePayload.ai_design_report) {
              console.log(`[FIX] Sesión ${sesion.orden}: ai_design_report persistido correctamente`);
            }
          } else {
            console.error(`[SESSION_BRIEF] Sesión ${sesion.orden}: Error actualizando DB:`, updateError);
            if (import.meta.env.DEV) {
              console.error(`[FIX] Sesión ${sesion.orden}: updatePayload keys:`, Object.keys(updatePayload));
              console.error(`[FIX] Sesión ${sesion.orden}: ai_design_report en payload:`, !!updatePayload.ai_design_report);
            }
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
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[GEN_PLAN] Error procesando sesión ${sesion.orden} (intento ${intentos}/${maxIntentos}):`, errorMessage);
          console.error(`[GEN_PLAN] session_id=${sesion.id}, error_type=${error instanceof Error ? error.constructor.name : 'unknown'}`);
          
          // TASK 3: Check if it's a validation error (400) - don't retry, stop immediately
          const isValidationError = errorMessage?.includes('Error de validación') || 
                                    errorMessage?.includes('duracionMin') || 
                                    errorMessage?.includes('INVALID_INPUT') ||
                                    errorMessage?.includes('No se reintentará');
          
          if (isValidationError) {
            console.error(`[GEN_PLAN] Error de validación detectado - NO se reintentará. Sesión ${sesion.orden}`);
            // Mark session as failed immediately
            try {
              await supabase
                .from('sesiones_clase')
                .update({ 
                  observaciones: `ERROR VALIDACIÓN: ${errorMessage.substring(0, 200)}`
                })
                .eq('id', sesion.id);
            } catch (updateError) {
              console.error(`[GEN_PLAN] No se pudo actualizar observaciones:`, updateError);
            }
            // Break immediately - don't retry validation errors
            break;
          }
          
          // FASE 1E: Persistir error en sesión para diagnóstico
          try {
            await supabase
              .from('sesiones_clase')
              .update({ 
                observaciones: `Error generación (intento ${intentos}/${maxIntentos}): ${errorMessage.substring(0, 200)}`
              })
              .eq('id', sesion.id);
          } catch (updateError) {
            console.error(`[GEN_PLAN] No se pudo actualizar observaciones de sesión ${sesion.orden}:`, updateError);
          }
          
          // Manejo específico para error 429 (Too Many Requests)
          if (errorMessage?.includes('429') || errorMessage?.includes('Too Many Requests')) {
            console.warn(`[GEN_PLAN] Rate limit detectado para sesión ${sesion.orden}. Esperando más tiempo...`);
          }
          
          if (intentos >= maxIntentos) {
            console.error(`[GEN_PLAN] Falló definitivamente la sesión ${sesion.orden} después de ${maxIntentos} intentos`);
            // FASE 1E: Marcar sesión como fallida para que UI pueda mostrar error específico
            try {
              await supabase
                .from('sesiones_clase')
                .update({ 
                  observaciones: `ERROR: No se pudo generar plan después de ${maxIntentos} intentos. Último error: ${errorMessage.substring(0, 200)}`
                })
                .eq('id', sesion.id);
            } catch (updateError) {
              console.error(`[GEN_PLAN] No se pudo marcar sesión ${sesion.orden} como fallida:`, updateError);
            }
            // Continuar con la siguiente sesión en lugar de fallar todo
            break;
          } else {
            // Esperar más tiempo antes del siguiente intento (especialmente para 429 o timeout)
            const isTimeout = errorMessage?.includes('Timeout');
            const isRateLimit = errorMessage?.includes('429') || errorMessage?.includes('Too Many Requests');
            const delayTime = isRateLimit ? 10000 : (isTimeout ? 5000 : 3000); // 10s para 429, 5s para timeout, 3s para otros
            console.log(`[GEN_PLAN] Esperando ${delayTime/1000} segundos antes del siguiente intento...`);
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
            narrative: `Reporte consolidado de ${accumulatedAiDesignReports.length} sesiones generado en modo docente.`,
            report_narrative: `Reporte consolidado de ${accumulatedAiDesignReports.length} sesiones generado en modo docente.`,
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
      console.error(`[GEN_PLAN] ${sesionesSinPlan.length} sesiones sin plan generado:`, sesionesSinPlan.map(s => ({ id: s.id, observaciones: s.observaciones })));
      // FASE 1E: Retornar información detallada sobre sesiones fallidas
      return { success: false, failedSessions: sesionesSinPlan.map(s => ({ id: s.id, observaciones: s.observaciones })) };
    }

    console.log('[GEN_PLAN] Todas las sesiones tienen planes generados correctamente');
    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[GEN_PLAN] Error en generación automática de planes:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
