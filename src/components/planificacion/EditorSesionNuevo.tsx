import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Clock, FileText, FileDown, Bot, Sparkles, Lightbulb, Loader2, Wand2 } from 'lucide-react';
import { SesionClase } from '@/types/planificacion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PDFGenerator } from '@/components/PDFGenerator';

interface EditorSesionNuevoProps {
  sesion: SesionClase | null;
  onActualizar: (updates: Partial<SesionClase>) => Promise<void>;
  competenciasDelPeriodo: string[];
  planificacionId?: string;
  materia?: string;
  nivel?: string;
}

export function EditorSesionNuevo({ 
  sesion, 
  onActualizar, 
  competenciasDelPeriodo,
  planificacionId,
  materia,
  nivel
}: EditorSesionNuevoProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('clase');
  const [isAILoading, setIsAILoading] = useState(false);
  const [argumentoCompetencias, setArgumentoCompetencias] = useState('');
  const [planHtml, setPlanHtml] = useState('');
  const [recursos, setRecursos] = useState<string[]>([]);
  const [evaluacionDocente, setEvaluacionDocente] = useState('');
  const [isModificando, setIsModificando] = useState(false);
  const [instruccionesModificacion, setInstruccionesModificacion] = useState('');

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

      // Actualizar estados locales
      setPlanHtml(data.plan_html);
      setArgumentoCompetencias(data.argumento_competencias || '');
      setRecursos(Array.isArray(data.recursos) ? data.recursos : []);

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

  // Handler para generación inicial
  const handleGenerarPlanInicial = async () => {
    if (!sesion) return;

    setIsAILoading(true);
    try {
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

      // Actualizar estados locales
      setPlanHtml(data.plan_html);
      setArgumentoCompetencias(data.argumento_competencias || '');
      setRecursos(Array.isArray(data.recursos) ? data.recursos : []);

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

  const handleGuardarRecursos = async () => {
    await onActualizar({ recursos });
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

  const contenidoPrincipal = sesion.contenidos_anep?.[0] || 'Sin contenido definido';

  return (
    <div className="space-y-6">
      
      {/* Cabecera: Título = Contenido + Metadatos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{contenidoPrincipal}</CardTitle>
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
            <div 
              className="w-full prose max-w-none p-6 bg-card rounded-lg border 
                prose-headings:font-bold prose-headings:font-black
                prose-h1:text-2xl prose-h1:font-black prose-h1:mt-8 prose-h1:mb-4
                prose-h2:text-xl prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-4 prose-h2:text-primary
                prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-3
                prose-p:mb-4 prose-p:leading-relaxed
                prose-ul:mb-4 prose-ul:ml-4
                prose-li:mb-2
                prose-strong:font-bold prose-strong:text-primary"
              dangerouslySetInnerHTML={{ __html: planHtml }}
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
                <h1 className="text-2xl font-bold mb-3">{contenidoPrincipal}</h1>
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

              {/* 3. Plan (Inicio/Desarrollo/Cierre) */}
              <div dangerouslySetInnerHTML={{ __html: planHtml }} />

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

          {/* Tab: Recursos */}
          <TabsContent value="recursos" className="space-y-4">
            <Label>Recursos necesarios</Label>
            <Textarea
              value={recursos.join('\n')}
              onChange={(e) => setRecursos(e.target.value.split('\n').filter(Boolean))}
              className="min-h-[200px]"
              placeholder="Un recurso por línea..."
            />
            <Button onClick={handleGuardarRecursos}>Guardar Recursos</Button>
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