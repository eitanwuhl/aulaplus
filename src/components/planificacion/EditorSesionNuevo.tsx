import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Clock, FileText, FileDown, Bot, Sparkles, Lightbulb, Loader2, Wand2, AlertTriangle } from 'lucide-react';
import { SesionClase } from '@/types/planificacion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PDFGenerator } from '@/components/PDFGenerator';
import { parsePlan, buildPlanHtml, buildPlanHtmlWithReminders, ParsedPlan } from '@/lib/planParser';
import { normalizeArrayField } from '@/lib/normalizeSupabaseArrays';
import { loadGroupContext, getGrupoIdFromPlanificacion } from '@/utils/groupContext';
import { mockGroups } from '@/data/mockData';
import type { Student as EnforcementStudent } from '@/lib/contemplaciones/enforcement';
import { resolveMockGroup } from '@/utils/resolveMockGroup';

interface EditorSesionNuevoProps {
  sesion: SesionClase | null;
  onActualizar: (updates: Partial<SesionClase>) => Promise<void>;
  competenciasDelPeriodo: string[];
  planificacionId?: string;
  materia?: string;
  nivel?: string;
}

// Helper: Check if HTML has actual content
const hasHtml = (html?: string): boolean => {
  if (!html) return false;
  const stripped = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return stripped.length > 0;
};

// Helper: Remove any stray section headings and resource blocks
const sanitizeHeadings = (html: string): string => {
  if (!html) return '';
  
  // Remove h1-h6 tags that contain section names (already shown by component)
  let cleaned = html.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (match, inner) => {
    const text = inner.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s*\(\d+\s*min\)\s*/gi, '');
    
    // Remove if it's a section heading (inicio/desarrollo/cierre/diferenciacion)
    if (/^(inicio|apertura|desarrollo|cierre|diferenciaci[oó]n|adaptaciones?)$/.test(normalized)) {
      return '';
    }
    
    // Keep other headings but demote to strong paragraph
    return text ? `<p><strong>${inner}</strong></p>` : '';
  });
  
  // PHASE 4: Remove any residual resource blocks that might appear in content
  // IMPORTANT: These patterns target explicit resource BLOCKS only (e.g., "<p><strong>Recursos:</strong> ...</p>").
  // They do NOT remove inline narrative mentions like "utilizaremos recursos digitales" in plain text.
  // Remove paragraphs that start with "Recursos:" or "Materiales:"
  cleaned = cleaned.replace(/<p[^>]*>\s*<strong>\s*(?:recursos?|material(?:es)?)\s*(?:necesarios?)?\s*:?\s*<\/strong>[\s\S]*?<\/p>/gi, '');
  
  // Remove resource lists (ul/ol following resource headers)
  cleaned = cleaned.replace(/<p[^>]*>\s*(?:recursos?|material(?:es)?)\s*:?\s*<\/p>\s*<[uo]l[^>]*>[\s\S]*?<\/[uo]l>/gi, '');
  
  return cleaned.trim();
};

// Helper: Strip leading duplicate section heading if present
const stripLeadingDuplicateSectionHeading = (html: string, section: 'inicio' | 'desarrollo' | 'cierre'): string => {
  if (!html) return '';
  
  const sectionLabel = section.toLowerCase();
  let out = html;
  
  // Try to match and remove leading <h1-6>...</h>
  const headingMatch = out.match(/^\s*<(h[1-6])[^>]*>([\s\S]*?)<\/\1>\s*/i);
  if (headingMatch) {
    const innerText = headingMatch[2].replace(/<[^>]*>/g, '').trim();
    const normalized = innerText.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*\(\d+\s*min\)\s*/gi, '');
    
    if (normalized === sectionLabel) {
      out = out.slice(headingMatch[0].length);
    }
  }
  
  // Try to match and remove leading <p><strong>...</strong></p>
  if (out === html) {
    const strongMatch = out.match(/^\s*<p[^>]*>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>\s*/i);
    if (strongMatch) {
      const innerText = strongMatch[1].replace(/<[^>]*>/g, '').trim();
      const normalized = innerText.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s*\(\d+\s*min\)\s*/gi, '');
      
      if (normalized === sectionLabel) {
        out = out.slice(strongMatch[0].length);
      }
    }
  }
  
  return out.trim();
};

/**
 * Robust extraction of "Diferenciación/Adaptaciones" content from HTML sections.
 * This is a defensive layer to ensure diferenciacion is removed from inicio/desarrollo/cierre
 * even if the parser missed it. Extracts both heading-based and inline patterns.
 */
function extractDiferenciacionFromHtml(html: string): { cleanedHtml: string; extracted: string } {
  if (!html) return { cleanedHtml: '', extracted: '' };
  
  let cleaned = html;
  const extracted: string[] = [];
  const toRemove: string[] = [];
  
  // Pattern 1: H2 heading with "Diferenciación/Adaptaciones" followed by content until next H1/H2 or end
  const h2Pattern = /<h2[^>]*>[\s\S]*?(?:diferenciaci[oó]n(?:es)?(?:\s*(?:\/|y)\s*adaptaciones?)?|adaptaciones?)[\s\S]*?<\/h2>([\s\S]*?)(?=<h[12][^>]*>|$)/gi;
  let match;
  const htmlCopy1 = html;
  while ((match = h2Pattern.exec(htmlCopy1)) !== null) {
    const fullMatch = match[0];
    const content = match[1].trim();
    if (content) {
      extracted.push(content);
      toRemove.push(fullMatch);
    }
  }
  
  // Pattern 2: Paragraph with strong label "Diferenciación/Adaptaciones:" followed by list/paragraphs
  // Matches: <p><strong>Diferenciación/Adaptaciones:</strong></p> followed by content (ul, p, etc.)
  const strongLabelPattern = /<p[^>]*>\s*<strong>\s*(?:diferenciaci[oó]n(?:es)?(?:\s*(?:\/|y)\s*adaptaciones?)?|adaptaciones?)\s*:?\s*<\/strong>\s*<\/p>\s*([\s\S]*?)(?=<h[1-6][^>]*>|<p[^>]*>\s*<strong>\s*(?!diferenciaci[oó]n|adaptaciones)|$)/gi;
  const htmlCopy2 = html;
  while ((match = strongLabelPattern.exec(htmlCopy2)) !== null) {
    const fullMatch = match[0];
    const content = match[1].trim();
    if (content) {
      extracted.push(content);
      toRemove.push(fullMatch);
    }
  }
  
  // Pattern 3: Any remaining inline mentions in single paragraph (defensive)
  // Matches: <p>...<strong>Diferenciación/Adaptaciones:</strong>...</p>
  // This should catch things that weren't caught by patterns 1 and 2
  const inlinePattern = /<p[^>]*>[\s\S]*?<strong>\s*(?:diferenciaci[oó]n(?:es)?(?:\s*(?:\/|y)\s*adaptaciones?)?|adaptaciones?)\s*:?\s*<\/strong>[\s\S]*?<\/p>/gi;
  const htmlCopy3 = html;
  while ((match = inlinePattern.exec(htmlCopy3)) !== null) {
    const fullMatch = match[0];
    // Extract content after the label
    const content = fullMatch.replace(/<p[^>]*>[\s\S]*?<strong>\s*(?:diferenciaci[oó]n(?:es)?(?:\s*(?:\/|y)\s*adaptaciones?)?|adaptaciones?)\s*:?\s*<\/strong>\s*/gi, '').replace(/<\/p>$/, '').trim();
    if (content && content.length > 0) {
      extracted.push(`<p>${content}</p>`);
      toRemove.push(fullMatch);
    }
  }
  
  // Remove all matched blocks (in reverse order to preserve indices)
  toRemove.sort((a, b) => html.indexOf(b) - html.indexOf(a));
  toRemove.forEach(block => {
    cleaned = cleaned.replace(block, '');
  });
  
  // Clean up extra whitespace
  cleaned = cleaned
    .replace(/(\s*<br\s*\/?>\s*){2,}/gi, '<br />')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  const mergedExtracted = extracted.filter(e => e && e.length > 0).join('\n\n');
  
  if (mergedExtracted && import.meta.env.DEV) {
    console.log('[EditorSesionNuevo] Extracted diferenciacion content from section:', mergedExtracted.substring(0, 100) + '...');
  }
  
  return { cleanedHtml: cleaned, extracted: mergedExtracted };
}

export function EditorSesionNuevo({ 
  sesion, 
  onActualizar, 
  competenciasDelPeriodo,
  planificacionId,
  materia,
  nivel
}: EditorSesionNuevoProps) {
  // PHASE 3.2.1 FIX: Defensive guard - prevent crash if sesion is missing
  if (!sesion) {
    return (
      <Card className="h-full flex items-center justify-center p-12">
        <div className="text-center max-w-md space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-muted p-6">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">No hay sesión seleccionada</h3>
            <p className="text-sm text-muted-foreground">
              Selecciona una sesión del calendario o del backlog para ver su contenido.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('clase');
  const [isAILoading, setIsAILoading] = useState(false);
  const [argumentoCompetencias, setArgumentoCompetencias] = useState('');
  const [planHtml, setPlanHtml] = useState('');
  const [recursos, setRecursos] = useState<string[]>([]);
  const [recursosAdicionales, setRecursosAdicionales] = useState<string[]>([]); // PHASE 4: Manual resources
  const [evaluacionDocente, setEvaluacionDocente] = useState('');
  const [isModificando, setIsModificando] = useState(false);
  const [instruccionesModificacion, setInstruccionesModificacion] = useState('');

  // PHASE 3: Parse plan for structured rendering
  // NOTE: This parsing is for DISPLAY purposes only in the UI and PDF.
  // Generation and modification flows already use parsePlan/buildPlanHtml when SAVING to DB (Phase 2).
  // This memoized value splits the HTML into sections (Inicio/Desarrollo/Cierre) and extracts resources.
  const planParsed = useMemo<ParsedPlan>(() => {
    if (!planHtml || planHtml.trim().length === 0) {
      return {
        inicio: '',
        desarrollo: '',
        cierre: '',
        recursos: recursos || [],
        diferenciacion: undefined,
        durations: undefined
      };
    }

    try {
      const parsed = parsePlan(planHtml, recursos);
      
      // Defensive normalization: Extract any remaining "Diferenciación/Adaptaciones" 
      // from inicio/desarrollo/cierre sections to ensure it only appears at the bottom
      const inicioClean = extractDiferenciacionFromHtml(parsed.inicio || '');
      const desarrolloClean = extractDiferenciacionFromHtml(parsed.desarrollo || '');
      const cierreClean = extractDiferenciacionFromHtml(parsed.cierre || '');
      
      // Merge all extracted diferenciacion content
      const allExtracted = [
        inicioClean.extracted,
        desarrolloClean.extracted,
        cierreClean.extracted,
        parsed.diferenciacion || ''
      ].filter(e => e && e.trim().length > 0).join('\n\n');
      
      return {
        inicio: inicioClean.cleanedHtml,
        desarrollo: desarrolloClean.cleanedHtml,
        cierre: cierreClean.cleanedHtml,
        recursos: parsed.recursos || recursos || [],
        diferenciacion: allExtracted || undefined,
        durations: parsed.durations
      };
    } catch (error) {
      console.error('Error parsing plan for rendering:', error);
      // Fallback to empty structure if parsing fails
      return {
        inicio: '',
        desarrollo: '',
        cierre: '',
        recursos: recursos || [],
        diferenciacion: undefined,
        durations: undefined
      };
    }
  }, [planHtml, recursos]);

  // Cargar datos de la sesión
  useEffect(() => {
    console.log('=== EDITOR SESIÓN NUEVO - DATOS RECIBIDOS ===');
    console.log('Sesión recibida:', sesion);
    if (sesion) {
      console.log('ID de sesión:', sesion.id);
      console.log('Fecha de sesión:', sesion.fecha);
      console.log('Estado de sesión:', sesion.estado);
      console.log('Plan desarrollo:', sesion.plan_desarrollo);
      console.log('HTML completo:', sesion.plan_desarrollo?.html_completo);
      console.log('Argumento competencias:', sesion.argumento_competencias);
      console.log('Recursos:', sesion.recursos);
      console.log('Evaluación docente:', sesion.evaluacion_docente);
      console.log('============================================');
      
      setPlanHtml(sesion.plan_desarrollo?.html_completo || '');
      setArgumentoCompetencias(sesion.argumento_competencias || '');
      setRecursos(sesion.recursos || []);
      setEvaluacionDocente(sesion.evaluacion_docente || '');
    } else {
      console.log('No hay sesión seleccionada');
    }
  }, [sesion]);

  // PHASE 4: Separate auto-detected resources from manual resources
  // This effect maintains the distinction between:
  // - Auto-detected: Resources extracted from plan HTML by the parser (shown in Card 1, read-only).
  // - Manual: Additional resources added by the teacher (shown in Card 2, editable).
  // When plans are regenerated, manual resources are preserved (merged with new auto-detected).
  useEffect(() => {
    if (!sesion) {
      setRecursosAdicionales([]);
      return;
    }

    // Auto-detected resources from parsed plan
    const autoResources = (planParsed.recursos ?? []).map(r => r.trim().toLowerCase());
    
    // All resources currently in DB (canonical source: auto + manual merged)
    const allFromDb = (recursos ?? []).map(r => r.trim());
    
    // Manual resources = items in DB that are NOT auto-detected
    const manual = allFromDb.filter(r => {
      const normalized = r.trim().toLowerCase();
      return normalized.length > 0 && !autoResources.includes(normalized);
    });
    
    setRecursosAdicionales(manual);
  }, [sesion?.id, planParsed.recursos, recursos]);

  // Handler para solicitar modificaciones a la IA
  const handleSolicitarModificacion = async () => {
    if (!sesion || !instruccionesModificacion.trim()) return;

    setIsModificando(true);
    try {
      const payload = {
        modo: 'regenerar',
        sesionId: sesion.id,
        orden: sesion.orden,
        duracionMin: sesion.duracion_minutos,
        materia: materia || 'Sin especificar',
        nivel: nivel || 'Sin especificar',
        contenidos: sesion.contenidos_anep || [],
        competencias: sesion.competencias_anep || [],
        criterios: sesion.criterios_logro_anep || [],
        instruccionesDocente: instruccionesModificacion,
        planActual: planHtml
      };

      console.log('Solicitando modificación con payload:', payload);

      const { data, error } = await supabase.functions.invoke('generate-plan-completo', {
        body: payload
      });

      if (error) {
        throw { 
          message: error.message, 
          code: error.code || 'FUNCTION_ERROR',
          details: error
        };
      }

      if (!data?.plan_html?.includes('<section id="plan">')) {
        throw new Error('Respuesta sin estructura HTML válida');
      }

      // PHASE 2: Parse and sanitize AI-modified HTML before saving
      const fallbackRecursos = Array.isArray(data.recursos)
        ? data.recursos
        : normalizeArrayField(data.recursos);
      const parsedPlan = parsePlan(data.plan_html, fallbackRecursos);
      const sanitizedHtml = buildPlanHtml(parsedPlan);
      
      // PHASE 4: Preserve manual resources when regenerating plan
      const autoResources = normalizeArrayField(parsedPlan.recursos);
      const mergedResources = mergeAutoAndManualResources(autoResources, recursosAdicionales);

      // Actualizar estados locales
      setPlanHtml(sanitizedHtml);
      setArgumentoCompetencias(data.argumento_competencias || '');
      setRecursos(mergedResources);

      // Persistir en DB
      await onActualizar({
        plan_desarrollo: { html_completo: sanitizedHtml },
        argumento_competencias: data.argumento_competencias,
        recursos: mergedResources
      });

      toast({
        title: "Plan modificado",
        description: "Los cambios han sido aplicados exitosamente"
      });

      setInstruccionesModificacion('');
    } catch (error: any) {
      console.error('Error solicitando modificación:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo modificar el plan",
        variant: "destructive"
      });
    } finally {
      setIsModificando(false);
    }
  };

  // Handler para generación inicial (fallback, normalmente auto-generation en workspace lo maneja)
  const handleGenerarPlanInicial = async () => {
    if (!sesion) return;

    setIsAILoading(true);
    try {
      // PHASE 4: Load group context from Supabase + mockGroups
      const grupoId = await getGrupoIdFromPlanificacion(planificacionId);
      const groupContext = await loadGroupContext(grupoId);
      
      if (groupContext.perfilGrupo) {
        console.log('[PHASE4-EditorSesion] Using group profile:', {
          tamanio: groupContext.perfilGrupo.tamanio,
          dominante: groupContext.perfilGrupo.dominante,
          estudiantesConAjustes: groupContext.estudiantes?.length || 0,
          teacherSugerenciasPresent: !!groupContext.teacherSugerencias
        });
      }
      
      const payload = {
        modo: 'generar_plan_html',
        sesionId: sesion.id,
        orden: sesion.orden,
        duracionMin: sesion.duracion_minutos,
        materia: materia || 'Sin especificar',
        nivel: nivel || 'Sin especificar',
        contenidos: sesion.contenidos_anep || [],
        competencias: sesion.competencias_anep || [],
        criterios: sesion.criterios_logro_anep || [],
        instruccionesDocente: undefined,
        // PHASE 4: Include group profile and student adjustments if available
        ...(groupContext.perfilGrupo && { perfilGrupo: groupContext.perfilGrupo }),
        ...(groupContext.estudiantes && { estudiantes: groupContext.estudiantes })
      };

      console.log('Generando plan inicial con payload:', payload);

      const { data, error } = await supabase.functions.invoke('generate-plan-completo', {
        body: payload
      });

      if (error) {
        throw { 
          message: error.message, 
          code: error.code || 'FUNCTION_ERROR',
          details: error
        };
      }

      if (!data?.plan_html?.includes('<section id="plan">')) {
        throw new Error('Respuesta sin estructura HTML válida');
      }

      // PHASE 2: Parse and sanitize AI-generated HTML before saving
      const fallbackRecursos = Array.isArray(data.recursos)
        ? data.recursos
        : normalizeArrayField(data.recursos);
      const parsedPlan = parsePlan(data.plan_html, fallbackRecursos);
      
      // CONTEMPLACIONES: Inject deterministic reminders into Diferenciación/Adaptaciones
      let sanitizedHtml: string;
      try {
        if (grupoId) {
          const resolveResult = resolveMockGroup(grupoId, false);
          const mockGroup = resolveResult.group;
          
          if (mockGroup && mockGroup.students && mockGroup.students.length > 0) {
            // Map students to enforcement format
            const students: EnforcementStudent[] = mockGroup.students.map(s => ({
              id: s.id,
              name: s.name
            }));
            
            console.log('[EditorSesion] Resolved group for reminders:', {
              grupoIdRaw: grupoId,
              matchType: resolveResult.matchType,
              resolvedGroupId: mockGroup.id,
              studentsCount: students.length
            });
            
            // Build with reminders
            const fullPlanContent = data.plan_html; // Use full content for consignas detection
            sanitizedHtml = buildPlanHtmlWithReminders(parsedPlan, students, fullPlanContent);
          } else {
            sanitizedHtml = buildPlanHtml(parsedPlan);
          }
        } else {
          sanitizedHtml = buildPlanHtml(parsedPlan);
        }
      } catch (reminderError) {
        console.warn('[EditorSesion] Failed to inject reminders:', reminderError);
        sanitizedHtml = buildPlanHtml(parsedPlan);
      }
      
      // PHASE 4: Preserve manual resources when regenerating plan
      const autoResources = normalizeArrayField(parsedPlan.recursos);
      const mergedResources = mergeAutoAndManualResources(autoResources, recursosAdicionales);

      // Actualizar estados locales
      setPlanHtml(sanitizedHtml);
      setArgumentoCompetencias(data.argumento_competencias || '');
      setRecursos(mergedResources);

      // Persistir en DB
      await onActualizar({
        plan_desarrollo: { html_completo: sanitizedHtml },
        argumento_competencias: data.argumento_competencias,
        recursos: mergedResources
      });

      toast({
        title: "Plan generado",
        description: "Contenido creado exitosamente"
      });
    } catch (error: any) {
      console.error('Error generando plan:', error);
      
      let userMessage = 'No se pudo generar el plan';
      if (error.code === 'FUNCTION_INVOCATION_FAILED') {
        userMessage = 'La función de IA no está disponible';
      } else if (error.status === 429) {
        userMessage = 'Demasiadas solicitudes, espera un momento';
      } else if (error.status === 500) {
        userMessage = 'Error interno del servidor';
      } else if (error.message) {
        userMessage = error.message;
      }

      toast({
        title: `Error ${error.code || 'desconocido'}`,
        description: userMessage,
        variant: "destructive"
      });
    } finally {
      setIsAILoading(false);
    }
  };


  const handleExportarPDF = async () => {
    if (!planHtml.trim()) {
      toast({
        title: "Error",
        description: "No hay planificación para exportar",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Generando PDF",
      description: "Creando documento...",
    });

    try {
      const fileName = `clase_${sesion?.fecha || 'sin-fecha'}`;
      await PDFGenerator.generateFromElement('sesion-pdf-content', fileName);
      toast({
        title: "PDF generado",
        description: "La planificación se descargó correctamente",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    }
  };

  // PHASE 4: Merge auto-detected and manual resources
  // Combines auto-detected (from parser) and manual (teacher-added) resources into a single
  // canonical list for saving to DB. Normalizes (trim, remove empty), de-duplicates (case-insensitive),
  // and sorts alphabetically. This is the source of truth for session.recursos in the database.
  const mergeAutoAndManualResources = (auto: string[], manual: string[]): string[] => {
    const allResources = [...auto, ...manual];
    
    // Normalize: trim, remove empty
    const normalized = allResources
      .map(r => r.trim())
      .filter(r => r.length > 0);
    
    // De-duplicate case-insensitively (keeps first occurrence)
    const uniqueMap = new Map<string, string>();
    normalized.forEach(resource => {
      const key = resource.toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, resource);
      }
    });
    
    return Array.from(uniqueMap.values()).sort();
  };

  const handleGuardarRecursos = async () => {
    // PHASE 4: Merge auto-detected resources with manual additions
    const autoResources = planParsed.recursos ?? [];
    const merged = mergeAutoAndManualResources(autoResources, recursosAdicionales);
    
    await onActualizar({ recursos: merged });
    setRecursos(merged); // Update local state to reflect saved data
    toast({ title: "Recursos guardados" });
  };

  const handleGuardarEvaluacion = async () => {
    await onActualizar({ evaluacion_docente: evaluacionDocente });
    toast({ title: "Evaluación guardada" });
  };

  if (!sesion) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Selecciona una sesión para editarla</p>
      </Card>
    );
  }

  // Estado vacío - plan sin generar (solo para casos excepcionales)
  if (!planHtml) {
    return (
      <Card className="h-full flex items-center justify-center p-12">
        <div className="text-center max-w-md space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-6">
              <Bot className="h-16 w-16 text-primary" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Generando plan...</h3>
            <p className="text-muted-foreground">
              La IA está creando el contenido de la clase automáticamente
            </p>
          </div>

          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          
          <div className="text-sm text-muted-foreground">
            Esto puede tomar unos momentos...
          </div>
        </div>
      </Card>
    );
  }

  // PHASE 3.2.1 FIX: Display priority for session detail card
  // Priority: 1) macro content (contenidos_anep[0]), 2) session_brief || titulo, 3) fallback
  const macro = sesion.contenidos_anep?.[0];
  const brief = sesion.session_brief || sesion.titulo;
  const mainTitle = macro || brief || `Sesión ${sesion.orden}`;
  const subtitle = macro && brief ? brief : null; // Show brief as subtitle only if macro exists

  return (
    <div className="space-y-6">
      
      {/* Cabecera: Título = Contenido + Metadatos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{mainTitle}</CardTitle>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-2 font-normal">
              {subtitle}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Fecha:</span>
              <p className="font-semibold">
                {sesion.fecha 
                  ? new Date(sesion.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
                  : 'Fecha: a confirmar'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Duración:</span>
              <p className="font-semibold flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {sesion.duracion_minutos} min
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Materia:</span>
              <p className="font-semibold">{materia || 'Sin especificar'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Nivel:</span>
              <p className="font-semibold">{nivel || 'Sin especificar'}</p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-muted-foreground text-sm">Competencias:</span>
            <div className="flex gap-2 mt-2 flex-wrap">
              {sesion.competencias_anep && sesion.competencias_anep.length > 0 ? (
                sesion.competencias_anep.map((comp, i) => (
                  <Badge key={i} variant="secondary">{comp}</Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground italic">
                  No hay competencias específicas para esta sesión
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta de Competencias */}
      <Card className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            ¿Cómo se desarrollan estas competencias?
          </CardTitle>
        </CardHeader>
        <CardContent>
          {argumentoCompetencias ? (
            <div 
              className="text-sm prose max-w-none"
              dangerouslySetInnerHTML={{ __html: argumentoCompetencias }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              (Análisis de competencias en proceso...)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pestañas: Clase / Recursos / Evaluación */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clase">Clase</TabsTrigger>
            <TabsTrigger value="recursos">Recursos</TabsTrigger>
            <TabsTrigger value="evaluacion">Evaluación</TabsTrigger>
          </TabsList>

          <TabsContent value="clase" className="space-y-4">
            {/* PHASE 3: Structured section rendering */}
            <Card>
              <CardContent className="p-6">
                {/* Check if we have any section content from parser */}
                {(hasHtml(planParsed.inicio) || hasHtml(planParsed.desarrollo) || hasHtml(planParsed.cierre)) ? (
                  <div className="space-y-8">
                    {/* Inicio Section */}
                    {hasHtml(planParsed.inicio) && (() => {
                      const inicioHtml = stripLeadingDuplicateSectionHeading(
                        sanitizeHeadings(planParsed.inicio),
                        'inicio'
                      );
                      
                      return (
                        <div>
                          <h2 className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3 text-primary">
                            Inicio{planParsed.durations?.inicio ? ` ${planParsed.durations.inicio}` : ''}
                          </h2>
                          <div
                            className="prose prose-sm max-w-none space-y-4 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: inicioHtml }}
                          />
                        </div>
                      );
                    })()}

                    {/* Separator between Inicio and Desarrollo */}
                    {hasHtml(planParsed.inicio) && hasHtml(planParsed.desarrollo) && (
                      <div role="separator" className="border-t border-border my-6" />
                    )}

                    {/* Desarrollo Section */}
                    {hasHtml(planParsed.desarrollo) && (() => {
                      const desarrolloHtml = stripLeadingDuplicateSectionHeading(
                        sanitizeHeadings(planParsed.desarrollo),
                        'desarrollo'
                      );
                      
                      return (
                        <div>
                          <h2 className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3 text-primary">
                            Desarrollo{planParsed.durations?.desarrollo ? ` ${planParsed.durations.desarrollo}` : ''}
                          </h2>
                          <div
                            className="prose prose-sm max-w-none space-y-4 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: desarrolloHtml }}
                          />
                        </div>
                      );
                    })()}

                    {/* Separator between Desarrollo and Cierre */}
                    {hasHtml(planParsed.desarrollo) && hasHtml(planParsed.cierre) && (
                      <div role="separator" className="border-t border-border my-6" />
                    )}

                    {/* Cierre Section */}
                    {hasHtml(planParsed.cierre) && (() => {
                      const cierreHtml = stripLeadingDuplicateSectionHeading(
                        sanitizeHeadings(planParsed.cierre),
                        'cierre'
                      );
                      
                      return (
                        <div>
                          <h2 className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3 text-primary">
                            Cierre{planParsed.durations?.cierre ? ` ${planParsed.durations.cierre}` : ''}
                          </h2>
                          <div
                            className="prose prose-sm max-w-none space-y-4 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: cierreHtml }}
                          />
                        </div>
                      );
                    })()}

                    {/* Separator before Diferenciación */}
                    {(hasHtml(planParsed.inicio) || hasHtml(planParsed.desarrollo) || hasHtml(planParsed.cierre)) &&
                      hasHtml(planParsed.diferenciacion) && (
                        <div role="separator" className="border-t border-border my-6" />
                      )}

                    {/* Diferenciación/Adaptaciones Section */}
                    {hasHtml(planParsed.diferenciacion) && (
                      <div>
                        <h2 className="scroll-m-20 text-xl font-semibold tracking-tight mt-6 mb-3 text-primary">
                          Diferenciación/Adaptaciones
                        </h2>
                        <div
                          className="prose prose-sm max-w-none space-y-4 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeHeadings(planParsed.diferenciacion) }}
                        />
                      </div>
                    )}
                  </div>
                ) : planHtml ? (
                  // Fallback: if parser returned empty sections but planHtml exists, render raw HTML
                  <div 
                    className="prose prose-sm max-w-none space-y-4 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: planHtml }}
                  />
                ) : (
                  // No plan at all
                  <p className="text-muted-foreground italic text-center py-8">
                    No hay contenido de clase disponible
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Sección para solicitar modificaciones */}
            <Card className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-purple-600" />
                  Solicitar cambios a la IA
                </CardTitle>
                <CardDescription>
                  Describe qué cambios quieres que haga la IA en este plan de clase
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Ej: Hacer más dinámico, agregar más ejemplos, ajustar para alumnos con dificultades de atención, cambiar la actividad de inicio..."
                  value={instruccionesModificacion}
                  onChange={(e) => setInstruccionesModificacion(e.target.value)}
                  className="min-h-[100px]"
                />
                <Button 
                  onClick={handleSolicitarModificacion}
                  disabled={isModificando || !instruccionesModificacion.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isModificando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aplicando cambios...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Aplicar cambios
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>


            {/* Sección oculta para PDF */}
            <div id="sesion-pdf-content" className="hidden print:block space-y-6 p-8">
              {/* 1. Cabecera */}
              <div className="border-b pb-4">
                <h1 className="text-2xl font-bold mb-3">{mainTitle}</h1>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Fecha:</strong> {sesion.fecha 
                    ? new Date(sesion.fecha).toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    : 'Fecha: a confirmar'}</p>
                  <p><strong>Duración:</strong> {sesion.duracion_minutos} minutos</p>
                  <p><strong>Materia:</strong> {materia || 'Sin especificar'}</p>
                  <p><strong>Nivel:</strong> {nivel || 'Sin especificar'}</p>
                </div>
                {sesion.competencias_anep && sesion.competencias_anep.length > 0 && (
                  <div className="mt-3">
                    <strong>Competencias:</strong>
                    <p className="text-sm mt-1">{sesion.competencias_anep.join(', ')}</p>
                  </div>
                )}
              </div>

              {/* 2. Tarjeta de Competencias */}
              {argumentoCompetencias && (
                <div className="border-l-4 border-blue-500 pl-4 bg-blue-50 p-4">
                  <h2 className="text-lg font-semibold mb-2">
                    ¿Cómo se desarrollan estas competencias?
                  </h2>
                  <div dangerouslySetInnerHTML={{ __html: argumentoCompetencias }} />
                </div>
              )}

              {/* 3. Plan (Inicio/Desarrollo/Cierre) - PHASE 3: Structured sections */}
              <div className="space-y-4">
                {hasHtml(planParsed.inicio) && (
                  <div>
                    <h2 className="text-xl font-semibold mb-2">
                      Inicio{planParsed.durations?.inicio ? ` ${planParsed.durations.inicio}` : ''}
                    </h2>
                    <div dangerouslySetInnerHTML={{ __html: stripLeadingDuplicateSectionHeading(sanitizeHeadings(planParsed.inicio), 'inicio') }} />
                  </div>
                )}
                
                {hasHtml(planParsed.desarrollo) && (
                  <div>
                    <h2 className="text-xl font-semibold mb-2">
                      Desarrollo{planParsed.durations?.desarrollo ? ` ${planParsed.durations.desarrollo}` : ''}
                    </h2>
                    <div dangerouslySetInnerHTML={{ __html: stripLeadingDuplicateSectionHeading(sanitizeHeadings(planParsed.desarrollo), 'desarrollo') }} />
                  </div>
                )}
                
                {hasHtml(planParsed.cierre) && (
                  <div>
                    <h2 className="text-xl font-semibold mb-2">
                      Cierre{planParsed.durations?.cierre ? ` ${planParsed.durations.cierre}` : ''}
                    </h2>
                    <div dangerouslySetInnerHTML={{ __html: stripLeadingDuplicateSectionHeading(sanitizeHeadings(planParsed.cierre), 'cierre') }} />
                  </div>
                )}
                
                {hasHtml(planParsed.diferenciacion) && (
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Diferenciación/Adaptaciones</h2>
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHeadings(planParsed.diferenciacion) }} />
                  </div>
                )}
              </div>

              {/* 4. Recursos */}
              {recursos.length > 0 && (
                <div className="border-t pt-4">
                  <h2 className="text-xl font-semibold mb-2">Recursos</h2>
                  <ul className="list-disc pl-6">
                    {recursos.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              {/* 5. Evaluación */}
              {evaluacionDocente && (
                <div className="border-t pt-4">
                  <h2 className="text-xl font-semibold mb-2">Evaluación del Docente</h2>
                  <p className="whitespace-pre-wrap">{evaluacionDocente}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Recursos - PHASE 4: Split auto-detected vs manual */}
          <TabsContent value="recursos" className="space-y-4">
            {/* Card 1: Auto-detected resources from plan (read-only)
                These are extracted automatically from the plan HTML by the parser.
                They update when the plan is regenerated, but are never directly editable. */}
            <Card>
              <CardHeader>
                <CardTitle>Recursos detectados en el plan</CardTitle>
                <CardDescription>
                  Estos recursos se detectan automáticamente a partir del plan de clase generado por la IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                {planParsed.recursos && planParsed.recursos.length > 0 ? (
                  <ul className="list-disc pl-6 space-y-1">
                    {planParsed.recursos.map((recurso, index) => (
                      <li key={index} className="text-sm">{recurso}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No se detectaron recursos en el plan. Puedes agregar recursos manualmente abajo.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Card 2: Additional manual resources (editable)
                These are extra resources added by the teacher that are NOT auto-detected.
                They are preserved across plan regenerations (merged with new auto-detected resources).
                When saved, they are combined with Card 1 resources into the canonical DB list. */}
            <Card className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle className="text-lg">Recursos adicionales (opcionales)</CardTitle>
                <CardDescription>
                  Agrega recursos extra que no fueron detectados automáticamente. Estos NO aparecerán en la pestaña Clase.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={recursosAdicionales.join('\n')}
                  onChange={(e) => setRecursosAdicionales(e.target.value.split('\n').filter(Boolean))}
                  className="min-h-[150px]"
                  placeholder="Un recurso por línea (ej: Pizarra, Marcadores, Proyector)..."
                />
                <Button onClick={handleGuardarRecursos}>Guardar Recursos Adicionales</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Evaluación */}
          <TabsContent value="evaluacion" className="space-y-4">
            <Label>Evaluación del docente</Label>
            <Textarea
              value={evaluacionDocente}
              onChange={(e) => setEvaluacionDocente(e.target.value)}
              className="min-h-[200px]"
              placeholder="Criterios para verificar objetivos de la clase..."
            />
            <Button onClick={handleGuardarEvaluacion}>Guardar Evaluación</Button>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}