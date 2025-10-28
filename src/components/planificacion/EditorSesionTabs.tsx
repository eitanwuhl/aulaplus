import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { HTMLRenderer } from '@/components/evaluaciones/HTMLRenderer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, RefreshCw, FileText, Save, AlertTriangle, Wand2, FileDown, Bot, Sparkles } from 'lucide-react';
import { SesionClase, PlanDesarrollo } from '@/types/planificacion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateSessionPlan, generateBlockPlan } from '@/lib/sessionPlanGenerator';
import { getCompetenciaById } from '@/data/competencias';
import { getCompetenciaCiudadaniaById } from '@/data/competenciasCiudadania';
import { getCompetenciaLiteraturaById } from '@/data/competenciasLiteratura';
import { PDFGenerator } from '@/components/PDFGenerator';

interface EditorSesionTabsProps {
  sesion: SesionClase | null;
  onActualizar: (updates: Partial<SesionClase>) => void;
  competenciasDelPeriodo?: string[];
  planificacionId?: string;
}

export const EditorSesionTabs: React.FC<EditorSesionTabsProps> = ({
  sesion,
  onActualizar,
  competenciasDelPeriodo = [],
  planificacionId
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('plan');
  const [localPlan, setLocalPlan] = useState<PlanDesarrollo>({});
  const [fullHtmlPlan, setFullHtmlPlan] = useState<string>('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [instruccionesIA, setInstruccionesIA] = useState('');
  const [isModificando, setIsModificando] = useState(false);
  const [instruccionesModificacion, setInstruccionesModificacion] = useState('');

  const findCompetenciaById = (id: string) => {
    return (
      getCompetenciaById(id) || getCompetenciaCiudadaniaById(id) || getCompetenciaLiteraturaById(id)
    );
  };
  
  // Sync local state with sesion and load existing HTML if available
  useEffect(() => {
    if (sesion?.plan_desarrollo) {
      setLocalPlan(sesion.plan_desarrollo);
      
      // If there's existing HTML, use it instead of generating from sections
      if (sesion.plan_desarrollo.html_completo) {
        setFullHtmlPlan(sesion.plan_desarrollo.html_completo);
      }
    }
  }, [sesion]);

  // Detecta si un string ya contiene HTML
  const isProbablyHtml = (content: string) => /<[^>]+>/.test(content);

  const escapeHtml = (unsafe: string) =>
    unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  // Desencaja HTML de code fences (```html ... ``` o ``` ... ```)
  const unwrapHtmlCodeFence = (content: string): string => {
    // Buscar code fences con o sin especificador de lenguaje
    const codeBlockPattern = /```(?:html)?\s*([\s\S]*?)\s*```/g;
    const match = codeBlockPattern.exec(content);
    
    if (match && match[1]) {
      const extractedHtml = match[1].trim();
      // Si el contenido extraído parece HTML válido, usarlo
      if (isProbablyHtml(extractedHtml)) {
        console.log('Unwrapped HTML from code fence:', extractedHtml.substring(0, 100));
        return extractedHtml;
      }
    }
    
    return content;
  };

  // Conversión inteligente: mixto HTML + Markdown → HTML puro
  const normalizeToHtml = (input?: string): string => {
    if (!input) return '';
    
    // Si contiene HTML pero también tiene indicadores de Markdown, limpiar mixto
    const hasHtml = isProbablyHtml(input);
    const hasMarkdown = /(\*\*|#{1,6}\s|^[-*•]\s|\d+\.\s)/m.test(input);
    
    if (hasHtml && hasMarkdown) {
      // Contenido mixto: convertir Markdown inline sin escapar HTML existente
      let text = input;
      text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
      text = text.replace(/^#{1,6}\s+(.+)$/gm, '<p><strong>$1</strong></p>');
      // Quitar marcadores markdown sueltos en medio de línea (###, ####, ---)
      text = text.replace(/#{1,6}\s*/g, '');
      text = text.replace(/-{3,}\s*/g, '');
      return text;
    }
    
    if (hasHtml) {
      // Ya es HTML, devolver tal cual
      return input;
    }

    // Solo texto/Markdown: conversión completa
    let text = input.replace(/\r\n/g, '\n');
    text = text.replace(/```([\s\S]*?)```/g, (_m, code) => `<pre>${escapeHtml(String(code).trim())}</pre>`);

    // Escapar HTML para evitar inyección, luego aplicar formato básico
    text = escapeHtml(text);

    // Negritas y cursivas básicas
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Eliminar marcadores Markdown residuales (###, ####, ---) en cualquier posición
    text = text.replace(/#{1,6}\s*/g, '');
    text = text.replace(/-{3,}\s*/g, '');

    const lines = text.split('\n');
    const out: string[] = [];
    let listOpen = false;

    const flushList = () => {
      if (listOpen) {
        out.push('</ul>');
        listOpen = false;
      }
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        flushList();
        continue;
      }

      // Viñetas tipo -, * o •
      if (/^(-|\*|•)\s+/.test(line) || /^\d+\.\s+/.test(line)) {
        if (!listOpen) {
          out.push('<ul>');
          listOpen = true;
        }
        const item = line
          .replace(/^(-|\*|•)\s+/, '')
          .replace(/^\d+\.\s+/, '');
        out.push(`<li>${item}</li>`);
        continue;
      }

      // Encabezados markdown → párrafo destacado
      if (/^#{1,6}\s+/.test(line)) {
        flushList();
        const txt = line.replace(/^#{1,6}\s+/, '');
        out.push(`<p><strong>${txt}</strong></p>`);
        continue;
      }

      // Párrafo común
      flushList();
      out.push(`<p>${line}</p>`);
    }

    flushList();
    return out.join('');
  };

  // Normaliza una sección
  const sanitizeSectionContent = (content?: string) => normalizeToHtml(content);

  // Generate full HTML plan when localPlan changes (only if no existing HTML)
  useEffect(() => {
    // Skip generation if we already have AI-generated HTML
    if (sesion?.plan_desarrollo?.html_completo) {
      return;
    }

    const generateFullHtml = () => {
      if (!localPlan.inicio && !localPlan.desarrollo && !localPlan.cierre) {
        setFullHtmlPlan('');
        return;
      }

      const parts: string[] = [];
      
      // Agregar título principal
      parts.push('<h1>Planificación de Clase</h1>');

      if (localPlan.inicio?.descripcion) {
        const content = sanitizeSectionContent(localPlan.inicio.descripcion);
        const dur = localPlan.inicio.duracion || 0;
        
        // Estructurar contenido con <h3>, <strong>, <ul>
        const structuredContent = content
          .replace(/<p><strong>([^<]+):<\/strong>/g, '<h3>$1</h3><p><strong>Actividad:</strong>')
          .replace(/<p><strong>(Recursos|Diferenciación|Adaptaciones)([^<]*)<\/strong>/g, '<p><strong>$1$2</strong>')
          .replace(/(<ul><li>[^<]*<\/li><\/ul>)/g, '$1');
        
        parts.push(`<h2>Inicio (${dur} min)</h2>${structuredContent}`);
      }

      if (localPlan.desarrollo?.descripcion) {
        const content = sanitizeSectionContent(localPlan.desarrollo.descripcion);
        const dur = localPlan.desarrollo.duracion || 0;
        
        // Estructurar contenido con <h3>, <strong>, <ul>
        const structuredContent = content
          .replace(/<p><strong>([^<]+):<\/strong>/g, '<h3>$1</h3><p><strong>Actividad:</strong>')
          .replace(/(<p><strong>Parte [AB])/g, '<h3>$1</h3><p>')
          .replace(/<p><strong>(Recursos|Diferenciación|Adaptaciones)([^<]*)<\/strong>/g, '<p><strong>$1$2</strong>')
          .replace(/(<ul><li>[^<]*<\/li><\/ul>)/g, '$1');
        
        parts.push(`<h2>Desarrollo (${dur} min)</h2>${structuredContent}`);
      }

      if (localPlan.cierre?.descripcion) {
        const content = sanitizeSectionContent(localPlan.cierre.descripcion);
        const dur = localPlan.cierre.duracion || 0;
        
        // Estructurar contenido con <h3>, <strong>, <ul>
        const structuredContent = content
          .replace(/<p><strong>([^<]+):<\/strong>/g, '<h3>$1</h3><p><strong>Actividad:</strong>')
          .replace(/<p><strong>(Recursos|Diferenciación|Adaptaciones)([^<]*)<\/strong>/g, '<p><strong>$1$2</strong>')
          .replace(/(<ul><li>[^<]*<\/li><\/ul>)/g, '$1');
        
        parts.push(`<h2>Cierre (${dur} min)</h2>${structuredContent}`);
      }

      const fullHtml = `<section id="plan">${parts.join('')}</section>`;
      setFullHtmlPlan(fullHtml);
    };

    generateFullHtml();
  }, [localPlan, sesion?.plan_desarrollo?.html_completo]);

  // Build prompt for AI (structured HTML format with detailed example)
  const buildPrompt = (htmlActual: string, metadata: any, instrucciones: string) => `
Sos un asistente pedagógico experto en planificación de clases.
Debés devolver únicamente HTML válido y autocontenido con estructura rica y profesional.
⚠️ NUNCA uses Markdown (no ###, no **negritas**, no ---, no listas con guiones).
La salida debe ser directamente renderizable en React con dangerouslySetInnerHTML.

ESTRUCTURA EXACTA REQUERIDA:
<section id="plan">
  <h1>Planificación de Clase</h1>

  <h2>Inicio (15 min)</h2>
  <h3>Actividad de apertura motivadora</h3>
  <p><strong>Actividad:</strong> "Escalera del tiempo: ¿Cómo habría sido tu vida en el 900?"</p>
  <ul>
    <li>Presenta imágenes representativas del 900.</li>
    <li>Formula la pregunta guía: <em>"Si hubieras nacido en el 900…"</em></li>
    <li>Los estudiantes escriben en 5 líneas su respuesta.</li>
  </ul>
  <p><strong>Recursos:</strong> proyector, láminas impresas.</p>
  <p><strong>Diferenciación/Adaptaciones:</strong></p>
  <ul>
    <li>Visual: Imágenes claras y coloridas.</li>
    <li>Auditivo: Lectura en voz alta de testimonios.</li>
  </ul>

  <h2>Desarrollo (100 min)</h2>
  <h3>Parte A – Mapa Mental Colaborativo</h3>
  <ul>
    <li>Construcción grupal en el pizarrón con aportes de todos.</li>
    <li>Comparación "Antes del 900 / A partir del 900".</li>
  </ul>
  <p><strong>Recursos:</strong> pizarrón, marcadores de colores.</p>

  <h3>Parte B – Historias que llegaron en barco</h3>
  <ul>
    <li>Lectura de testimonio de inmigrante del 900.</li>
    <li>Puesta en común de causas y consecuencias de la migración.</li>
  </ul>

  <h2>Cierre (5 min)</h2>
  <h3>Actividad: Palabra clave</h3>
  <ul>
    <li>Cada estudiante aporta una palabra que resuma lo aprendido.</li>
    <li>El docente vincula esas palabras con el vocabulario de la unidad.</li>
  </ul>
</section>

CONTEXTO DE LA CLASE:
- Fecha: ${metadata.fecha || 'Sin especificar'}
- Duración: ${metadata.duracion || 60} minutos
- Competencias: ${(metadata.competencias || []).join(', ')}
- Criterios: ${(metadata.criterios || []).join(', ')}
- Contenidos: ${(metadata.contenidos || []).join(', ')}

INSTRUCCIONES DEL DOCENTE:
${instrucciones || 'Sin instrucciones adicionales'}

PLANIFICACIÓN ACTUAL:
${htmlActual}

REQUISITOS OBLIGATORIOS:
- USAR EXACTAMENTE: <h1> para título principal, <h2> para etapas, <h3> para subactividades
- INCLUIR SIEMPRE: <strong>Actividad:</strong>, <strong>Recursos:</strong>, <strong>Diferenciación/Adaptaciones:</strong>
- USAR: <ul><li> para listas, <p> para párrafos, <em> para citas/preguntas
- DEVOLVER SOLO HTML VÁLIDO, sin explicaciones ni comentarios
`;
  

  // Handler para solicitar modificaciones a la IA
  const handleSolicitarModificacion = async () => {
    if (!sesion?.id || !instruccionesModificacion.trim()) {
      toast({
        title: "Error",
        description: "No se puede generar sin ID de sesión o instrucciones",
        variant: "destructive"
      });
      return;
    }

    setIsModificando(true);
    toast({
      title: "Aplicando cambios",
      description: "La IA está modificando el plan..."
    });

    try {
      const payload = {
        modo: 'regenerar',
        sesionId: sesion.id,
        orden: sesion.orden,
        duracionMin: sesion.duracion_minutos,
        materia: 'Historia', // Por defecto, se puede mejorar
        nivel: '9º Año', // Por defecto, se puede mejorar
        contenidos: sesion.contenidos_anep || [],
        competencias: sesion.competencias_anep || [],
        criterios: sesion.criterios_logro_anep || [],
        instruccionesDocente: instruccionesModificacion,
        planActual: fullHtmlPlan
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

      // Actualizar estado local
      setFullHtmlPlan(data.plan_html);

      // Persistir en DB
      await onActualizar({
        plan_desarrollo: { html_completo: data.plan_html },
        argumento_competencias: data.argumento_competencias,
        recursos: Array.isArray(data.recursos) ? data.recursos : []
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

  // Handle initial plan generation
  const handleGenerarPlanInicial = async () => {
    if (!sesion?.id) {
      toast({
        title: "Error",
        description: "No se puede generar sin ID de sesión",
        variant: "destructive"
      });
      return;
    }

    setIsAILoading(true);
    toast({
      title: "Generando plan",
      description: "Creando contenido de la clase..."
    });

    try {
      const payload = {
        modo: 'generar_plan_html',
        sesionId: sesion.id,
        orden: sesion.orden,
        duracionMin: sesion.duracion_minutos,
        materia: 'Historia', // Por defecto, se puede mejorar
        nivel: '9º Año', // Por defecto, se puede mejorar
        contenidos: sesion.contenidos_anep || [],
        competencias: sesion.competencias_anep || [],
        criterios: sesion.criterios_logro_anep || [],
        instruccionesDocente: instruccionesIA || undefined
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

      // Actualizar estado local
      setFullHtmlPlan(data.plan_html);

      // Persistir en DB
      await onActualizar({
        plan_desarrollo: { html_completo: data.plan_html },
        argumento_competencias: data.argumento_competencias,
        recursos: Array.isArray(data.recursos) ? data.recursos : []
      });

      toast({
        title: "Plan generado",
        description: "Contenido creado exitosamente"
      });

      setInstruccionesIA('');
    } catch (error: any) {
      console.error('Error generando plan:', error);
      toast({
        title: "Error",
        description: error.message || "Error al generar el plan",
        variant: "destructive"
      });
    } finally {
      setIsAILoading(false);
    }
  };

  // Handle AI modification request with database persistence
  const handlePedirCambiosIA = async () => {
    if (!fullHtmlPlan.trim()) {
      toast({
        title: "Error",
        description: "No hay planificación para modificar",
        variant: "destructive"
      });
      return;
    }

    if (!sesion?.id) {
      toast({
        title: "Error",
        description: "No se puede guardar sin ID de sesión",
        variant: "destructive"
      });
      return;
    }

    setIsAILoading(true);
    toast({
      title: "Consultando IA",
      description: "Procesando sugerencias de mejora..."
    });

    try {
      const metadata = {
        fecha: sesion?.fecha || null,
        duracion: sesion?.duracion_minutos || 60,
        competencias: sesion?.competencias_anep || [],
        criterios: sesion?.criterios_logro_anep || [],
        contenidos: sesion?.contenidos_anep || []
      };

      const prompt = buildPrompt(fullHtmlPlan, metadata, instruccionesIA);

      // NOTA: esperamos que el Edge Function soporte type: 'html_plan' y
      // devuelva { content: "<section>...</section>" }
      const { data, error } = await supabase.functions.invoke('modify-evaluation', {
        body: {
          type: 'html_plan',
          prompt
        }
      });

      if (error) throw error;

      let aiContent = (data?.content || data?.generatedContent || '').toString().trim();

      if (!aiContent) {
        throw new Error('La IA no devolvió contenido');
      }

      console.log('Raw AI content:', aiContent.substring(0, 200));

      // Paso 1: Desencajar de code fences si está rodeado
      aiContent = unwrapHtmlCodeFence(aiContent);

      // Paso 2: Normalizar contenido mixto o pure Markdown
      if (!isProbablyHtml(aiContent) || /(^|\s)(#{1,6}|\*\*|`{3}|-\s|\d+\.)/.test(aiContent)) {
        console.log('Normalizing mixed/markdown content to HTML');
        aiContent = normalizeToHtml(aiContent);
      }

      // Garantizamos que sea un bloque autocontenido y con id="plan"
      if (!/^\s*<section[^>]*>/.test(aiContent)) {
        aiContent = `<section id="plan">${aiContent}</section>`;
      } else {
        // Asegurar id="plan" para consistencia
        aiContent = aiContent.replace(/<section(?![^>]*\bid=)/, '<section id="plan"');
      }

      // Update local state
      setFullHtmlPlan(aiContent);

      // Update local plan state with AI-generated HTML
      const updatedPlanDesarrollo = {
        ...sesion.plan_desarrollo,
        html_completo: aiContent
      };
      
      setLocalPlan(updatedPlanDesarrollo);

      // Use parent's onActualizar to persist and synchronize state
      onActualizar({ 
        plan_desarrollo: updatedPlanDesarrollo 
      });

      toast({
        title: "Planificación actualizada con éxito",
        description: "Contenido mejorado y guardado correctamente"
      });
    } catch (error) {
      console.error('Error with AI modification:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar la mejora con IA",
        variant: "destructive"
      });
    } finally {
      setIsAILoading(false);
    }
  };

  // Handle PDF export: export exactly what is shown in #planificacion-preview (A4 pagination handled by generator)
  const handleExportarPDF = async () => {
    if (!fullHtmlPlan.trim()) {
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
      const fileName = `planificacion_${new Date(sesion?.fecha || Date.now())
        .toLocaleDateString('es-ES')
        .replace(/\//g, '-')}`;
      await PDFGenerator.generateFromElement('planificacion-preview', fileName);
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

  // Auto-save con debounce
  const handleUpdate = (updates: Partial<SesionClase>) => {
    onActualizar(updates);
  };

  if (!sesion) {
    return (
      <Card className="flex items-center justify-center p-12">
        <div className="text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Selecciona una fecha en el calendario para planificar la sesión</p>
        </div>
      </Card>
    );
  }

  // Limitar competencias mostradas (máximo 2)
  const competenciasDeLaClase = sesion.competencias_anep?.slice(0, 2) || [];

  return (
    <div className="space-y-6">
      
      {/* Header de la Sesión */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                {new Date(sesion.fecha).toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  day: 'numeric',
                  month: 'long'
                })}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Duración:</span>
                  <span className="font-semibold">{sesion.duracion_minutos} minutos</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Contenidos:</span>
                  <span className="font-semibold">{sesion.contenidos_anep?.length || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Competencias:</span>
                  <Badge variant={competenciasDeLaClase.length > 2 ? "destructive" : "outline"}>
                    {competenciasDeLaClase.length}/2 máx
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Vista previa HTML unificada */}
      <Card>
        <CardHeader>
          <CardTitle>Planificación de Clase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vista HTML unificada */}
          <div className="space-y-4">
            {fullHtmlPlan ? (
              <>
                <div
                  id="planificacion-preview"
                  className="w-full max-w-none p-6 bg-card rounded-lg border
                    prose-headings:font-bold prose-headings:font-black
                    prose-h1:text-2xl prose-h1:font-black prose-h1:mt-8 prose-h1:mb-4
                    prose-h2:text-xl prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-4 prose-h2:text-primary
                    prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-3
                    prose-p:mb-4 prose-p:leading-relaxed
                    prose-ul:mb-4 prose-ul:ml-4
                    prose-li:mb-2
                    prose-strong:font-bold prose-strong:text-primary"
                  dangerouslySetInnerHTML={{ __html: fullHtmlPlan }}
                />
                
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
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
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
              </>
            ) : (
              <div className="w-full p-8 text-center border rounded-lg border-dashed">
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="rounded-full bg-primary/10 p-4">
                      <Bot className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Generando plan...</h3>
                    <p className="text-muted-foreground text-sm">
                      La IA está creando el contenido de la clase automáticamente
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Esto puede tomar unos momentos...
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Instrucciones para IA */}
          <div className="space-y-2">
            <Label htmlFor="instrucciones-ia">Instrucciones para la IA (opcional)</Label>
            <Textarea
              id="instrucciones-ia"
              value={instruccionesIA}
              onChange={(e) => setInstruccionesIA(e.target.value)}
              className="min-h-[80px]"
              placeholder="Ej: Hacer más dinámico, agregar más ejemplos, ajustar para alumnos con dificultades de atención..."
            />
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2 pt-4 border-t">
            <Button 
              onClick={handlePedirCambiosIA}
              disabled={isAILoading || !fullHtmlPlan.trim()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Bot className={`h-4 w-4 mr-2 ${isAILoading ? 'animate-spin' : ''}`} />
              {isAILoading ? 'Consultando IA...' : 'Pedir cambios con IA'}
            </Button>
            
            <Button 
              onClick={handleExportarPDF}
              disabled={!fullHtmlPlan.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};