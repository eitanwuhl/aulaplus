import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Upload, FileText, MessageCircle, ThumbsUp, ThumbsDown, RefreshCw, Lightbulb } from 'lucide-react';
import { DocumentEditor } from "@/components/ui/document-editor";
import { getTemplatesByType } from "@/components/ui/document-templates";
import { EnhancedPDFGenerator } from "@/components/ui/enhanced-pdf-generator";
import { toast } from 'sonner';

interface GeneratedEvaluation {
  id: string;
  version: number;
  title: string;
  content: string;
  richContent: string; // New field for rich HTML content
  adaptations: string[];
  feedback?: {
    liked: string[];
    disliked: string[];
    suggestions: string[];
  };
}

interface EnhancedEvaluationGeneratorProps {
  subject: string;
  selectedContent: string[];
  groupName: string;
}

const EnhancedEvaluationGenerator = ({ subject, selectedContent, groupName }: EnhancedEvaluationGeneratorProps) => {
  const [basePrototype, setBasePrototype] = useState('');
  const [evaluationRequirements, setEvaluationRequirements] = useState('');
  const [generatedEvaluations, setGeneratedEvaluations] = useState<GeneratedEvaluation[]>([]);
  const [currentFeedback, setCurrentFeedback] = useState<Record<string, { liked: string; disliked: string; suggestions: string }>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('setup');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<GeneratedEvaluation | null>(null);
  const [isEditingEvaluation, setIsEditingEvaluation] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', content: string}>>([
    { role: 'ai', content: `¡Hola! Estoy aquí para ayudarte a crear la evaluación perfecta para ${subject}. ¿Podrías contarme qué estilo de evaluación prefieres?` }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        
        // Use AI to analyze and enhance the uploaded prototype
        try {
          const { supabase } = await import('@/lib/supabase');
          
          const { data, error } = await supabase.functions.invoke('modify-evaluation', {
            body: {
              originalEvaluation: text,
              modification: "Analiza este prototipo de evaluación y sugiere mejoras pedagógicas manteniendo su estructura original.",
              groupContext: {
                subject: subject,
                content: selectedContent,
                groupName: groupName
              },
              type: 'modification',
              adaptationLevel: 'standard'
            }
          });

          if (error) throw error;
          
          // Validate AI response content
          if (!data.content || data.content.trim().length === 0) {
            console.warn('AI returned empty content for file analysis');
            setBasePrototype(text);
            return;
          }
          
          setBasePrototype(data.content);
        } catch (error) {
          console.error('Error analyzing uploaded file:', error);
          setBasePrototype(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleGenerateEvaluations = async () => {
    setIsGenerating(true);
    
    try {
      // Generate AI content first
      const { supabase } = await import('@/lib/supabase');
      
      const context = `
        Materia: ${subject}
        Contenidos: ${selectedContent.join(', ')}
        Grupo: ${groupName}
        Prototipo del docente: ${basePrototype}
        Requerimientos específicos: ${evaluationRequirements}
      `;

      const evaluationPrompts = [
        {
          id: '1',
          title: 'Versión Estándar',
          adaptationLevel: 'standard',
          prompt: `Genera una evaluación ESTÁNDAR para ${subject} sobre "${selectedContent.join(' y ')}". 
                  ${basePrototype ? `Basándote en este prototipo: ${basePrototype}` : ''}
                  ${evaluationRequirements ? `Considerando estos requerimientos: ${evaluationRequirements}` : ''}
                  Formato profesional con preguntas variadas y criterios claros.`
        },
        {
          id: '2', 
          title: 'Versión con Apoyos Moderados',
          adaptationLevel: 'moderate',
          prompt: `Genera una evaluación con ADAPTACIONES MODERADAS para ${subject} sobre "${selectedContent.join(' y ')}".
                  Incluye: tiempo extendido, apoyo visual, instrucciones paso a paso, lectura de enunciados.
                  ${basePrototype ? `Basándote en este prototipo: ${basePrototype}` : ''}
                  ${evaluationRequirements ? `Considerando: ${evaluationRequirements}` : ''}`
        },
        {
          id: '3',
          title: 'Versión Altamente Adaptada', 
          adaptationLevel: 'high',
          prompt: `Genera una evaluación ALTAMENTE ADAPTADA para ${subject} sobre "${selectedContent.join(' y ')}".
                  Modalidad principalmente oral, materiales concretos, tiempo flexible, apoyo docente continuo.
                  ${basePrototype ? `Basándote en este prototipo: ${basePrototype}` : ''}
                  ${evaluationRequirements ? `Considerando: ${evaluationRequirements}` : ''}`
        }
      ];

      const evaluations: GeneratedEvaluation[] = [];

      for (const evalPrompt of evaluationPrompts) {
        const { data, error } = await supabase.functions.invoke('modify-evaluation', {
          body: {
            type: 'modification',
            originalEvaluation: '',
            modification: evalPrompt.prompt,
            groupContext: {
              subject: subject,
              content: selectedContent,
              groupName: groupName,
              adaptationLevel: evalPrompt.adaptationLevel
            }
          }
        });

        if (error) throw error;

        // Convert AI content to rich HTML format using templates
        const templates = getTemplatesByType('evaluation');
        const baseTemplate = templates.find(t => t.id === 'eval-standard')?.content || '';
        const richContent = convertToRichHTML(data.content || generateFallbackContent(evalPrompt), evalPrompt.adaptationLevel);

        evaluations.push({
          id: evalPrompt.id,
          version: 1,
          title: evalPrompt.title,
          content: data.content || generateFallbackContent(evalPrompt),
          richContent: richContent,
          adaptations: getAdaptationsForLevel(evalPrompt.adaptationLevel as any)
        });
      }

      setGeneratedEvaluations(evaluations);
      setActiveTab('results');
      toast.success('Evaluaciones generadas exitosamente');
      
    } catch (error) {
      console.error('Error generating evaluations:', error);
      toast.error('Error al generar evaluaciones');
      
      // Fallback to simple content generation
      const evaluations: GeneratedEvaluation[] = [
        {
          id: '1',
          version: 1,
          title: 'Versión Estándar',
          content: generateEvaluationContent(basePrototype || `Evaluación para ${subject}`, evaluationRequirements, 'standard'),
          richContent: generateRichEvaluationContent('standard', subject, selectedContent),
          adaptations: ['Formato estándar', 'Tiempo regular', 'Instrucciones claras']
        },
        {
          id: '2',
          version: 2,
          title: 'Versión con Apoyos Moderados', 
          content: generateEvaluationContent(basePrototype || `Evaluación para ${subject}`, evaluationRequirements, 'moderate'),
          richContent: generateRichEvaluationContent('moderate', subject, selectedContent),
          adaptations: ['Tiempo extendido 50%', 'Apoyo visual', 'Estructura guiada', 'Lectura de enunciados']
        },
        {
          id: '3',
          version: 3,
          title: 'Versión Altamente Adaptada',
          content: generateEvaluationContent(basePrototype || `Evaluación para ${subject}`, evaluationRequirements, 'high'),
          richContent: generateRichEvaluationContent('high', subject, selectedContent),
          adaptations: ['Evaluación oral', 'Materiales concretos', 'Tiempo flexible', 'Acompañamiento 1:1']
        }
      ];

      setGeneratedEvaluations(evaluations);
      setActiveTab('results');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateEvaluationContent = (baseContent: string, requirements: string, adaptationLevel: 'standard' | 'moderate' | 'high') => {
    const hasPrototype = baseContent.length > 50;
    
    if (hasPrototype) {
      return `${baseContent}

${adaptationLevel === 'standard' ? 
  `\n**VERSIÓN ESTÁNDAR BASADA EN TU PROTOTIPO**
   - Se mantiene la estructura original
   - Instrucciones claras y directas
   - Tiempo estándar de evaluación` :
  adaptationLevel === 'moderate' ?
  `\n**VERSIÓN CON ADAPTACIONES MODERADAS**
   - Se incluyen apoyos visuales donde sea necesario
   - Instrucciones más detalladas y paso a paso
   - Tiempo extendido (50% adicional)
   - Posibilidad de lectura de enunciados` :
  `\n**VERSIÓN ALTAMENTE ADAPTADA**
   - Evaluación principalmente oral
   - Uso de materiales concretos
   - Apoyo docente continuo
   - Tiempo completamente flexible`}

${requirements ? `\n**REQUERIMIENTOS IMPLEMENTADOS:**\n${requirements}` : ''}`;
    } else {
      return `**EVALUACIÓN GENERADA AUTOMÁTICAMENTE PARA ${subject.toUpperCase()}**
**Contenidos:** ${selectedContent.join(', ')}

${adaptationLevel === 'standard' ? 
  `**FORMATO ESTÁNDAR**

1. **Pregunta conceptual** (20 puntos)
   - Explica los conceptos principales de ${selectedContent[0]}
   - Utiliza ejemplos concretos en tu respuesta
   - Extensión esperada: 150-200 palabras

2. **Ejercicio aplicativo** (30 puntos)
   - Resuelve el siguiente problema aplicando ${selectedContent[0]}
   - Justifica cada paso de tu resolución
   - Muestra claramente el proceso de pensamiento

3. **Análisis crítico** (25 puntos)
   - Evalúa la siguiente situación...
   - Propone alternativas o mejoras
   - Fundamenta tu posición con argumentos sólidos

4. **Integración de conocimientos** (25 puntos)
   - Relaciona los contenidos estudiados con situaciones reales
   - Demuestra comprensión de las conexiones entre conceptos` :
  
  adaptationLevel === 'moderate' ?
  `**FORMATO CON APOYOS MODERADOS**

1. **Pregunta guiada** (25 puntos)
   a) Primero, define ${selectedContent[0]} con tus palabras
   b) Luego, da un ejemplo que conozcas
   c) Finalmente, explica por qué es importante

2. **Ejercicio paso a paso** (35 puntos)
   - Sigue estas instrucciones numeradas:
   - Paso 1: [Instrucción específica]
   - Paso 2: [Instrucción específica]
   - Paso 3: [Instrucción específica]
   - Puedes consultar tus apuntes en cualquier momento

3. **Actividad visual** (25 puntos)
   - Observa el diagrama/imagen proporcionado
   - Identifica los elementos principales
   - Completa las etiquetas faltantes
   - Explica qué representa cada parte

4. **Reflexión personal** (15 puntos)
   - ¿Qué te resultó más fácil de entender?
   - ¿Dónde aplicarías estos conceptos?

**CONTEMPLACIONES INCLUIDAS:**
- Tiempo extendido: 50% adicional
- Lectura de enunciados disponible
- Material de apoyo permitido` :

  `**FORMATO ALTAMENTE ADAPTADO**

**MODALIDAD: EVALUACIÓN ORAL CON APOYO VISUAL**

1. **Reconocimiento visual** (30 puntos)
   - Te mostraré imágenes sobre ${selectedContent[0]}
   - Señala o nombra lo que reconoces
   - No te preocupes si no recuerdas todos los nombres

2. **Actividad práctica** (40 puntos)
   - Vamos a hacer juntos un ejercicio con materiales
   - Te guío paso a paso
   - Puedes preguntar todo lo que necesites

3. **Conversación sobre el tema** (20 puntos)
   - Te voy a hacer algunas preguntas sencillas
   - Responde como puedas, con tus palabras
   - Podemos usar dibujos si te ayuda

4. **Demostración personal** (10 puntos)
   - Muestra algo que hayas aprendido
   - Puede ser con gestos, dibujos o materiales

**CONTEMPLACIONES ESPECÍFICAS:**
- Evaluación completamente oral
- Materiales concretos disponibles
- Sin límite de tiempo
- Acompañamiento docente permanente
- Posibilidad de descansos`}

${requirements ? `\n**TUS REQUERIMIENTOS INCLUIDOS:**\n${requirements}` : ''}`;
    }
  };

  const handleFeedback = (evaluationId: string) => {
    const feedback = currentFeedback[evaluationId];
    if (!feedback) return;

    setGeneratedEvaluations(prev => 
      prev.map(evaluation => 
        evaluation.id === evaluationId 
          ? {
              ...evaluation,
              feedback: {
                liked: feedback.liked.split(',').map(s => s.trim()).filter(Boolean),
                disliked: feedback.disliked.split(',').map(s => s.trim()).filter(Boolean),
                suggestions: feedback.suggestions.split(',').map(s => s.trim()).filter(Boolean)
              }
            }
          : evaluation
      )
    );

    // Limpiar feedback temporal
    setCurrentFeedback(prev => ({
      ...prev,
      [evaluationId]: { liked: '', disliked: '', suggestions: '' }
    }));
  };

  const handleRegenerate = async (evaluationId: string) => {
    const evaluation = generatedEvaluations.find(e => e.id === evaluationId);
    if (!evaluation?.feedback) return;

    setIsGenerating(true);
    setTimeout(async () => {
      const feedback = evaluation.feedback!;
      let newContent = evaluation.content;
      
      // Procesar sugerencias específicas del docente
      if (feedback.suggestions.length > 0) {
        newContent = await applyFeedbackToEvaluation(evaluation.content, feedback, evaluation.title);
      }
      
      setGeneratedEvaluations(prev => 
        prev.map(evaluation => 
          evaluation.id === evaluationId
            ? {
                ...evaluation,
                version: evaluation.version + 1,
                content: newContent,
                feedback: undefined // Limpiar feedback para permitir nuevo feedback
              }
            : evaluation
        )
      );
      setIsGenerating(false);
    }, 1500);
  };

  const applyFeedbackToEvaluation = async (originalContent: string, feedback: any, title: string) => {
    try {
      const { supabase } = await import('@/lib/supabase');
      
      const suggestionsText = feedback.suggestions.join('. ');
      const modificationRequest = `Modifica esta evaluación según el siguiente feedback:
      
Me gustó: ${feedback.liked.join(', ')}
No me gustó: ${feedback.disliked.join(', ')}
Sugerencias: ${suggestionsText}

Por favor, aplica estos cambios manteniendo la estructura general de la evaluación.`;

      const { data, error } = await supabase.functions.invoke('modify-evaluation', {
        body: {
          type: 'modification',
          originalEvaluation: originalContent,
          modification: modificationRequest,
          groupContext: {
            subject: subject,
            content: selectedContent,
            groupName: groupName
          }
        }
      });

      if (error) throw error;
      
      // Validate AI response content
      if (data?.success && data?.content && data.content.trim().length > 0) {
        console.log('AI response valid, updating content');
        return data.content;
      } else {
        console.warn('AI returned invalid content:', {
          success: data?.success,
          hasContent: !!data?.content, 
          contentLength: data?.content?.length || 0,
          warning: data?.warning
        });
        
        // If AI warns about content, return original with note
        if (data?.warning) {
          return originalContent + '\n\n**NOTA:** ' + data.warning;
        }
        
        return originalContent + '\n\n**NOTA: La IA no pudo procesar las modificaciones solicitadas.**';
      }
    } catch (error) {
      console.error('Error applying feedback:', error);
      // Fallback a la lógica anterior
      let modifiedContent = originalContent;
      const suggestions = feedback.suggestions.join(' ').toLowerCase();
      
      let modifications = '\n\n**MODIFICACIONES BASADAS EN TU FEEDBACK:**\n';
      
      if (suggestions.includes('más visual') || suggestions.includes('imagen')) {
        modifications += '• Se añadieron más apoyos visuales y diagramas\n';
        modifiedContent += '\n\n**APOYO VISUAL AÑADIDO:**\n- Se incluirán diagramas explicativos\n- Imágenes de referencia para cada concepto\n- Esquemas paso a paso';
      }
      
      if (suggestions.includes('más tiempo') || suggestions.includes('extender')) {
        modifications += '• Se extendió el tiempo de evaluación\n';
        modifiedContent = modifiedContent.replace(/Tiempo: \d+/, 'Tiempo: 120');
      }
      
      return modifiedContent + modifications;
    }
  };

  const handleSendMessage = () => {
    if (!currentMessage.trim()) return;
    
    setChatMessages(prev => [...prev, { role: 'user', content: currentMessage }]);
    
    // Generar respuesta con IA real
    setTimeout(async () => {
      const aiResponse = await generateAIResponse(currentMessage, subject);
      setChatMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
    }, 1000);
    
    setCurrentMessage('');
  };

  const generateAIResponse = async (userMessage: string, subject: string) => {
    try {
      const { supabase } = await import('@/lib/supabase');
      
      const { data, error } = await supabase.functions.invoke('modify-evaluation', {
        body: {
          type: 'chat',
          modification: userMessage,
          groupContext: {
            subject: subject,
            content: selectedContent,
            groupName: groupName
          }
        }
      });

      if (error) throw error;
      
      // Validate AI response content
      if (!data.content || data.content.trim().length === 0) {
        console.warn('AI returned empty content for chat response');
        return 'Lo siento, hubo un error procesando tu mensaje. La IA no generó contenido válido.';
      }
      
      return data.content;
    } catch (error) {
      console.error('Error generating AI response:', error);
    return `Disculpa, hubo un problema conectando con la IA. Mientras tanto, puedo sugerirte que para ${subject} consideres usar apoyos visuales y tiempo extendido según las necesidades de tu grupo.`;
    }
  };

  // Helper functions for rich content generation
  const convertToRichHTML = (content: string, adaptationLevel: string): string => {
    const templates = getTemplatesByType('evaluation');
    const templateContent = adaptationLevel === 'standard' 
      ? templates.find(t => t.id === 'eval-standard')?.content 
      : templates.find(t => t.id === 'eval-adapted')?.content;
    
    if (templateContent) {
      return templateContent.replace('[TEMA]', selectedContent.join(', '))
                          .replace('[MATERIA]', subject)
                          .replace(/\[.*?\]/g, content.substring(0, 200) + '...');
    }
    
    return `<div style="padding: 20px; font-family: Arial, sans-serif;">${content.replace(/\n/g, '<br>')}</div>`;
  };

  const generateFallbackContent = (evalPrompt: any): string => {
    return `Evaluación ${evalPrompt.title} para ${subject} - ${selectedContent.join(', ')}`;
  };

  const getAdaptationsForLevel = (level: 'standard' | 'moderate' | 'high'): string[] => {
    switch (level) {
      case 'standard':
        return ['Formato estándar', 'Tiempo regular', 'Instrucciones claras'];
      case 'moderate':
        return ['Tiempo extendido 50%', 'Apoyo visual', 'Estructura guiada', 'Lectura de enunciados'];
      case 'high':
        return ['Evaluación oral', 'Materiales concretos', 'Tiempo flexible', 'Acompañamiento 1:1'];
      default:
        return [];
    }
  };

  const generateRichEvaluationContent = (level: 'standard' | 'moderate' | 'high', subject: string, content: string[]): string => {
    const templates = getTemplatesByType('evaluation');
    const template = level === 'standard' 
      ? templates.find(t => t.id === 'eval-standard')
      : templates.find(t => t.id === 'eval-adapted');
    
    if (template) {
      return template.content
        .replace(/\[MATERIA\]/g, subject)
        .replace(/\[TEMA\]/g, content.join(', '));
    }
    
    return `<div style="padding: 20px;"><h1>Evaluación de ${subject}</h1><p>Contenidos: ${content.join(', ')}</p></div>`;
  };

  const handleEditEvaluation = (evaluation: GeneratedEvaluation) => {
    setSelectedEvaluation(evaluation);
    setIsEditingEvaluation(true);
  };

  const handleSaveEvaluation = (updatedContent: string) => {
    if (!selectedEvaluation) return;
    
    setGeneratedEvaluations(prev => 
                      prev.map(evaluation => 
                        evaluation.id === selectedEvaluation.id 
                          ? { ...evaluation, richContent: updatedContent, version: evaluation.version + 1 }
                          : evaluation
      )
    );
    
    setIsEditingEvaluation(false);
    setSelectedEvaluation(null);
    toast.success('Evaluación actualizada');
  };

  const handleExportEvaluation = async (evaluation: GeneratedEvaluation) => {
    try {
      await EnhancedPDFGenerator.generateFromContent({
        content: evaluation.richContent,
        fileName: `evaluacion_${evaluation.title.replace(/\s+/g, '_')}_${subject}`,
        title: `${evaluation.title} - ${subject}`,
        metadata: {
          author: 'Sistema Educativo',
          subject: `Evaluación de ${subject}`,
          keywords: `evaluación, ${subject}, ${selectedContent.join(', ')}`
        }
      });
    } catch (error) {
      console.error('Error exporting evaluation:', error);
      toast.error('Error al exportar evaluación');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Generador Colaborativo de Evaluaciones - {groupName}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Crea evaluaciones personalizadas a partir de tu propio prototipo y recibe versiones adaptadas
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="setup">Configuración</TabsTrigger>
              <TabsTrigger value="results">Evaluaciones Generadas</TabsTrigger>
              <TabsTrigger value="chat">Chat IA</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    📎 Tu Prototipo Base (Opcional)
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Pega aquí una evaluación que ya tengas como modelo o describe cómo te gusta evaluar
                  </p>
                  <Textarea
                    value={basePrototype}
                    onChange={(e) => setBasePrototype(e.target.value)}
                    placeholder="Ejemplo: Siempre incluyo una pregunta teórica, un ejercicio práctico y un análisis de caso. Me gusta que las consignas sean claras y que haya opciones para diferentes niveles..."
                    className="min-h-32"
                  />
                  <div className="mt-2 flex gap-2 items-center">
                    <input
                      type="file"
                      accept=".txt,.doc,.docx,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="prototype-upload"
                    />
                    <label htmlFor="prototype-upload">
                      <Button variant="outline" size="sm" className="text-xs cursor-pointer" asChild>
                        <span>
                          <Upload className="w-3 h-3 mr-1" />
                          Subir archivo
                        </span>
                      </Button>
                    </label>
                    {uploadedFile && (
                      <span className="text-xs text-muted-foreground">
                        ✓ {uploadedFile.name}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    📋 Requerimientos Específicos
                  </label>
                  <Textarea
                    value={evaluationRequirements}
                    onChange={(e) => setEvaluationRequirements(e.target.value)}
                    placeholder="Ejemplo: Que incluya ejercicios de aplicación práctica, que sea visual, que permita consultar apuntes, que tenga diferentes niveles de dificultad..."
                    className="min-h-20"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={handleGenerateEvaluations} 
                    disabled={isGenerating || selectedContent.length === 0}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generando evaluaciones...
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-4 h-4 mr-2" />
                        Generar Evaluaciones Adaptadas
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Se generarán 3 versiones: estándar, con apoyos moderados y altamente adaptada
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {generatedEvaluations.length > 0 ? (
                <div className="space-y-4">
                  {generatedEvaluations.map((evaluation, index) => (
                    <motion.div
                      key={evaluation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Card className="border-2 border-primary/20">
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between text-lg">
                            <span>{evaluation.title}</span>
                            <Badge variant="outline">v{evaluation.version}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="bg-muted/30 p-3 rounded-lg">
                            <pre className="text-sm whitespace-pre-wrap text-foreground">
                              {evaluation.content}
                            </pre>
                          </div>
                          
                          <div>
                            <h5 className="text-sm font-medium mb-2">Adaptaciones incluidas:</h5>
                            <div className="flex flex-wrap gap-1">
                              {evaluation.adaptations.map((adaptation, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {adaptation}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* Feedback Section */}
                          {!evaluation.feedback ? (
                            <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                              <h5 className="text-sm font-medium text-foreground">
                                ¿Qué te parece esta evaluación?
                              </h5>
                              <div className="space-y-2">
                                <Textarea
                                  placeholder="¿Qué aspectos te gustaron?"
                                  value={currentFeedback[evaluation.id]?.liked || ''}
                                  onChange={(e) => setCurrentFeedback(prev => ({
                                    ...prev,
                                    [evaluation.id]: {
                                      ...prev[evaluation.id],
                                      liked: e.target.value
                                    }
                                  }))}
                                  className="min-h-16 text-sm"
                                />
                                <Textarea
                                  placeholder="¿Qué cambiarías o no te convenció?"
                                  value={currentFeedback[evaluation.id]?.disliked || ''}
                                  onChange={(e) => setCurrentFeedback(prev => ({
                                    ...prev,
                                    [evaluation.id]: {
                                      ...prev[evaluation.id],
                                      disliked: e.target.value
                                    }
                                  }))}
                                  className="min-h-16 text-sm"
                                />
                                <Textarea
                                  placeholder="Sugerencias específicas para mejorar..."
                                  value={currentFeedback[evaluation.id]?.suggestions || ''}
                                  onChange={(e) => setCurrentFeedback(prev => ({
                                    ...prev,
                                    [evaluation.id]: {
                                      ...prev[evaluation.id],
                                      suggestions: e.target.value
                                    }
                                  }))}
                                  className="min-h-16 text-sm"
                                />
                                <Button 
                                  onClick={() => handleFeedback(evaluation.id)}
                                  size="sm"
                                  disabled={!currentFeedback[evaluation.id]?.liked && !currentFeedback[evaluation.id]?.disliked}
                                >
                                  Enviar Feedback
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2 p-3 bg-green-50 rounded-lg">
                              <h5 className="text-sm font-medium text-foreground flex items-center gap-1">
                                <ThumbsUp className="w-3 h-3" />
                                 Feedback recibido
                              </h5>
                              <Button 
                                onClick={() => handleRegenerate(evaluation.id)}
                                size="sm"
                                variant="outline"
                                disabled={isGenerating}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Aplicar feedback
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>Configura tu evaluación en la pestaña anterior para ver las versiones generadas</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="chat" className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <span className="font-medium">Chat con la IA Pedagógica</span>
                </div>
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {chatMessages.map((message, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg ${
                        message.role === 'ai' 
                          ? 'bg-blue-100 border-l-4 border-blue-400' 
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {message.role === 'ai' && (
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            IA
                          </div>
                        )}
                        <p className="text-sm flex-1">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Textarea 
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    placeholder="Pregúntale a la IA sobre estrategias de evaluación, adaptaciones específicas, o pide sugerencias..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!currentMessage.trim()}
                    size="sm"
                  >
                    Enviar mensaje
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedEvaluationGenerator;