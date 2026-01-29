import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Upload, FileText, MessageCircle, ThumbsUp, ThumbsDown, RefreshCw, Lightbulb, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizeArrayField } from "@/lib/normalizeSupabaseArrays";
import { Group, mockGroups } from "@/data/mockData";
import { CATALOGO_JERARQUICO, criteriosParaContenidos, contenidosPorMateria, getSubtemaPorId, getCapituloPorSubtema, type Materia, type CapituloMacro, type SubtemaItem } from "@/data/catalogo";
import { getCompetenciasEspecificas, getCriteriosLogroPorCompetencias, type CompetenciaEspecifica } from "@/data/competencias";
import { getCompetenciasEspecificasLiteratura, getCriteriosLogroPorCompetenciasLiteratura } from "@/data/competenciasLiteratura";
import { getCompetenciasEspecificasCiudadania, getCriteriosLogroPorCompetenciasCiudadania } from "@/data/competenciasCiudadania";
import { RubricaIntegrada } from "@/components/RubricaIntegrada";
import { EvaluacionVisualRenderer } from "@/components/evaluaciones/EvaluacionVisualRenderer";
import { EvaluationSourceSelector, EvaluationMaterialsSection, TimeBudgetingSection, AIDesignReport } from "@/components/evaluaciones";
import type { AIDesignReportData } from "@/components/evaluaciones";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface ResultadoEvaluacion {
  grupo: string;
  materia: Materia | "";
  materias: Materia[]; // Para evaluaciones interdisciplinarias
  esInterdisciplinaria: boolean;
  competenciasEspecificas: string[]; // ids de competencias específicas
  criteriosLogro: string[]; // ids de criterios de logro seleccionados
  contenidos: string[]; // ids
  requerimientos: string;
}

interface GeneratedEvaluation {
  id: string;
  version: number;
  title: string;
  content: string;
  adaptations: string[];
  assignedStudents: string[];  // Legacy: Student names (for backward compatibility)
  assignedStudentIds?: (string | number)[];  // NEW: Student IDs assigned to this version
  rubrica?: any[];
  feedback?: {
    liked: string[];
    disliked: string[];
    suggestions: string[];
  };
}

function getPersistedContemplaciones(studentId: number): string[] {
  try {
    const key = `contemplaciones:${studentId}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

// Helper function to check if student requires content adaptation (explicit flag only)
function studentRequiresContentAdaptation(student: any): boolean {
  // Check localStorage first (user-controlled values)
  try {
    const contenidoKey = `adecuacionContenido:${student.id}`;
    const contenidoFromStorage = localStorage.getItem(contenidoKey);
    
    if (contenidoFromStorage !== null) {
      const contenidoValue = JSON.parse(contenidoFromStorage);
      if (contenidoValue === true) return true;
    }
  } catch (error) {
    // If localStorage read fails, fall through to fallback
  }
  
  // Fallback: check student.informeTecnico (if present in mock data)
  if (student.informeTecnico?.requiereAdecuacionContenido === true) {
    return true;
  }
  
  // Default: no content adaptation required
  return false;
}

// Helper function to check if student requires access accommodations (explicit flag only)
function studentRequiresAccessAccommodations(student: any): boolean {
  // Check localStorage first (user-controlled values)
  try {
    const accesoKey = `adecuacionAcceso:${student.id}`;
    const accesoFromStorage = localStorage.getItem(accesoKey);
    
    if (accesoFromStorage !== null) {
      const accesoValue = JSON.parse(accesoFromStorage);
      if (accesoValue === true) return true;
    }
  } catch (error) {
    // If localStorage read fails, fall through to fallback
  }
  
  // Fallback: check student.informeTecnico (if present in mock data)
  if (student.informeTecnico?.requiereAdecuacionAcceso === true) {
    return true;
  }
  
  // Default: no access accommodations required
  return false;
}

function criteriosLogroBox(competenciasIds: string[], materiasSeleccionadas: Materia[] = []) {
  if (competenciasIds.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        Selecciona competencias específicas para ver los criterios de logro correspondientes
      </div>
    );
  }

  let criterios: any[] = [];
  
  // Obtener criterios de diferentes materias según los IDs
  const historiaIds = competenciasIds.filter(id => !id.includes('-literatura') && !id.includes('-ciudadania'));
  const literaturaIds = competenciasIds.filter(id => id.includes('-literatura'));
  const ciudadaniaIds = competenciasIds.filter(id => id.includes('-ciudadania'));
  
  if (historiaIds.length > 0) {
    criterios.push(...getCriteriosLogroPorCompetencias(historiaIds));
  }
  if (literaturaIds.length > 0) {
    criterios.push(...getCriteriosLogroPorCompetenciasLiteratura(literaturaIds));
  }
  if (ciudadaniaIds.length > 0) {
    criterios.push(...getCriteriosLogroPorCompetenciasCiudadania(ciudadaniaIds));
  }
  
  return (
    <div className="text-sm text-gray-700 space-y-2">
      <ul className="list-disc list-inside space-y-1">
        {criterios.map((c) => (
          <li key={c.id}>
            <span className="font-medium text-blue-700">{c.codigo}:</span> {c.descripcion}
          </li>
        ))}
      </ul>
    </div>
  );
}

function generatePrototipo(contenidoIds: string[], requerimientos: string, version: number): string {
  const subtemas = contenidoIds.map(id => getSubtemaPorId(id)).filter(Boolean) as SubtemaItem[];
  const temasPrincipales = subtemas.map(s => s.contenido).join(", ");
  
  if (subtemas.length === 0) return "Prototipo de evaluación no disponible";
  
  const capitulo = getCapituloPorSubtema(subtemas[0].id);
  const materia = capitulo?.materia || "Historia";
  const criterios = subtemas.flatMap(s => s.criterios);
  
  // Generar prototipos extensos y creativos por materia y versión
  const prototipos = {
    "Historia": [
      // VERSIÓN 1: Análisis profundo con apoyo visual (para estudiantes con más adaptaciones)
      `**EVALUACIÓN INTEGRAL: ${temasPrincipales}**
**Tiempo sugerido: 90 minutos | Modalidad: Con apoyos visuales y tiempo extendido**

**PARTE I: CONTEXTUALIZACIÓN HISTÓRICA (25 puntos)**
1. **Análisis de fuente iconográfica**: Observa la imagen proporcionada de la época de ${subtemas[0]?.contenido}. 
   a) Describe tres elementos visuales que te llamen la atención
   b) ¿Qué aspectos de la sociedad de esa época se reflejan en la imagen?
   c) Relaciona lo observado con los procesos históricos estudiados

2. **Línea temporal interactiva**: Construye una línea de tiempo visual donde ubiques:
   - 5 eventos clave de ${subtemas[0]?.contenido}
   - 3 consecuencias directas de estos eventos
   - 2 conexiones con procesos simultáneos en el mundo

**PARTE II: ANÁLISIS CAUSAL Y COMPARATIVO (35 puntos)**
3. **Mapa conceptual de causas**: Elabora un diagrama que muestre:
   - Causas estructurales (económicas, sociales, políticas)
   - Causas coyunturales (eventos desencadenantes)
   - Interrelaciones entre diferentes factores

4. **Estudio de caso comparativo**: 
   "Un historiador afirma que ${subtemas[0]?.contenido} comparte similitudes con procesos actuales de transformación social"
   a) ¿Estás de acuerdo? Justifica con 3 argumentos
   b) Identifica 2 diferencias fundamentales entre esa época y la actual
   c) ¿Qué lecciones podemos extraer para el presente?

**CRITERIOS DE EVALUACIÓN ESPECÍFICOS:**
${criterios.slice(0,3).join(" • ")}

${requerimientos ? `\n**ADAPTACIONES DOCENTES:** ${requerimientos}` : ""}

**RECURSOS PERMITIDOS:** Apoyos visuales, tiempo adicional, diccionario histórico`,

      // VERSIÓN 2: Enfoque analítico equilibrado 
      `**EVALUACIÓN COMPRENSIVA: ${temasPrincipales}**
**Tiempo sugerido: 80 minutos | Modalidad: Estándar con algunas adaptaciones**

**SECCIÓN A: COMPRENSIÓN Y ANÁLISIS (40 puntos)**
1. **Desarrollo explicativo**: En un texto de 150-200 palabras, explica:
   - ¿Cuáles fueron las principales transformaciones durante ${subtemas[0]?.contenido}?
   - ¿Qué grupos sociales se vieron más afectados y de qué manera?
   - ¿Cómo se relaciona este proceso con el contexto internacional de la época?

2. **Análisis de fuentes**: Lee los siguientes fragmentos de documentos históricos de la época:
   [Se proporcionarían 2-3 fuentes primarias breves]
   a) Identifica la perspectiva o posición de cada autor
   b) ¿Qué información aporta cada fuente sobre ${subtemas[0]?.contenido}?
   c) ¿Detectas alguna contradicción entre las fuentes? Explica

**CRITERIOS DE LOGRO:**
${criterios.slice(1,4).join(" • ")}

${requerimientos ? `\n**CONDICIONES ESPECÍFICAS:** ${requerimientos}` : ""}`,

      // VERSIÓN 3: Evaluación adaptada
      `**EVALUACIÓN ADAPTADA: ${temasPrincipales}**
**Tiempo: 90 minutos | Modalidad: Contenidos esenciales con apoyos pedagógicos**

**SECCIÓN A: COMPRENSIÓN BÁSICA (40 puntos)**
1. **Identificación de conceptos centrales**: A partir de las imágenes y textos simplificados sobre ${subtemas[0]?.contenido}:
   a) Señala 3 aspectos más importantes de este período histórico
   b) ¿En qué año(s) ocurrió? (se proporciona línea de tiempo visual)
   c) ¿Qué cambios principales se produjeron en la vida de las personas?

2. **Relacionar con la actualidad**: 
   a) ¿Qué similitudes encontrás entre ${subtemas[0]?.contenido} y alguna situación actual que conozcas?
   b) ¿Qué cosas de esa época ya no existen hoy?

**CRITERIOS DE EVALUACIÓN ADAPTADOS:**
• Comprensión de conceptos esenciales
• Uso adecuado del material de apoyo
• Expresión clara de ideas principales

${requerimientos ? `\n**APOYOS ESPECÍFICOS:** ${requerimientos}` : ""}

**RECURSOS:** Material visual abundante, líneas de tiempo, mapas, apoyo docente constante`
    ],
    
    "Matemática": [
      `**EVALUACIÓN PRÁCTICA: ${temasPrincipales}**
**Tiempo: 90 minutos | Modalidad: Con material concreto y apoyo visual**

**BLOQUE I: EXPLORACIÓN CONCEPTUAL (30 puntos)**
1. **Modelización con material concreto**: Utilizando el material manipulativo disponible:
   a) Representa físicamente el concepto de ${subtemas[0]?.contenido}
   b) Explica paso a paso cómo tu modelo demuestra las propiedades estudiadas

2. **Construcción gráfica**: En papel cuadriculado:
   a) Construye 3 ejemplos visuales diferentes de ${subtemas[0]?.contenido}
   b) Marca y explica los elementos clave en cada representación

**CRITERIOS DE EVALUACIÓN:**
${criterios.slice(0,3).join(" • ")}

${requerimientos ? `\n**ADAPTACIONES:** ${requerimientos}` : ""}`,

      `**EVALUACIÓN ESTÁNDAR: ${temasPrincipales}**
**Tiempo: 80 minutos | Modalidad: Resolución sistemática con justificación**

**PARTE A: CONCEPTOS FUNDAMENTALES (35 puntos)**
1. **Definiciones y propiedades**:
   a) Define ${subtemas[0]?.contenido} con tus propias palabras
   b) Enumera 4 propiedades fundamentales y explica cada una con un ejemplo

2. **Procedimientos estándar**: Resuelve los siguientes ejercicios mostrando todos los pasos:
   [Se incluirían 3-4 ejercicios progresivos específicos del contenido]

**CRITERIOS DE LOGRO:**
${criterios.slice(1,4).join(" • ")}

${requerimientos ? `\n**REQUERIMIENTOS:** ${requerimientos}` : ""}`,

      `**EVALUACIÓN FUNCIONAL: ${temasPrincipales}**
**Tiempo: 90 minutos | Modalidad: Matemática práctica y contextualizada**

**BLOQUE I: MATEMÁTICA EN LA VIDA DIARIA (40 puntos)**
1. **Situaciones cotidianas**: Resuelve estos problemas de la vida real usando ${subtemas[0]?.contenido}:
   
   **Problema A - En el supermercado**: 
   - Tienes $500 para comprar. Los productos cuestan: leche $85, pan $65, yogur $120
   - ¿Cuánto gastas en total si compras 1 de cada uno?

2. **Usando la calculadora**: Para estos ejercicios puedes usar calculadora:
   a) Calcula: 245 + 189 = 
   b) Calcula: 350 - 127 = 

**CRITERIOS DE EVALUACIÓN ADAPTADOS:**
• Comprensión de conceptos matemáticos esenciales
• Aplicación correcta en situaciones cotidianas
• Uso adecuado de herramientas de apoyo

${requerimientos ? `\n**APOYOS MATEMÁTICOS:** ${requerimientos}` : ""}`
    ],
    
    "Biología": [
      `**EVALUACIÓN EXPERIMENTAL: ${temasPrincipales}**
**Tiempo: 90 minutos | Modalidad: Laboratorio virtual y observación directa**

**MÓDULO I: OBSERVACIÓN CIENTÍFICA (30 puntos)**
1. **Análisis microscópico**: Utilizando las imágenes microscópicas proporcionadas de ${subtemas[0]?.contenido}:
   a) Describe detalladamente 5 estructuras que puedas identificar
   b) Rotula un diagrama señalando las partes principales

2. **Construcción de modelos**: Crea un modelo tridimensional (puede ser dibujado) que represente:
   - Los componentes principales involucrados en ${subtemas[0]?.contenido}
   - Las interacciones entre estos componentes

**CRITERIOS DE EVALUACIÓN:**
${criterios.slice(0,3).join(" • ")}

${requerimientos ? `\n**ADAPTACIONES BIOLÓGICAS:** ${requerimientos}` : ""}`,

      `**EVALUACIÓN INTEGRAL: ${temasPrincipales}**
**Tiempo: 80 minutos | Modalidad: Análisis científico con aplicación**

**SECCIÓN A: COMPRENSIÓN CONCEPTUAL (35 puntos)**
1. **Explicación de procesos**: Desarrolla en 200-250 palabras:
   - ¿Cómo funciona ${subtemas[0]?.contenido} a nivel celular/molecular?
   - ¿Qué factores pueden alterar este proceso?

2. **Análisis de casos**: Estudia las siguientes situaciones experimentales:
   [Se presentarían 2-3 casos con datos reales]

**CRITERIOS DE LOGRO:**
${criterios.slice(1,4).join(" • ")}

${requerimientos ? `\n**REQUERIMIENTOS BIOLÓGICOS:** ${requerimientos}` : ""}`,

      `**EVALUACIÓN PRÁCTICA: ${temasPrincipales}**
**Tiempo: 90 minutos | Modalidad: Biología aplicada y contextualizada**

**MÓDULO I: BIOLOGÍA EN LA VIDA COTIDIANA (40 puntos)**
1. **Observación directa**: Usando las muestras/imágenes de ${subtemas[0]?.contenido}:
   a) ¿Qué partes reconoces?
   b) ¿Para qué sirve cada parte que identificaste?

2. **Conexión con tu experiencia**: 
   a) ¿Dónde has visto ${subtemas[0]?.contenido} en tu vida diaria?
   b) ¿Por qué es importante para los seres vivos?

**CRITERIOS DE EVALUACIÓN ADAPTADOS:**
• Identificación correcta de elementos básicos
• Comprensión de funciones esenciales
• Relación con experiencias cotidianas

${requerimientos ? `\n**APOYOS BIOLÓGICOS:** ${requerimientos}` : ""}`
    ]
  };
  
  const prototiposMateria = prototipos[materia as keyof typeof prototipos] || prototipos["Historia"];
  return prototiposMateria[version - 1] || prototiposMateria[0];
}

const EvaluacionesGrupo = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedGroupId, setSelectedGroupId] = useState<string>(searchParams.get("grupo") || "");
  const [esInterdisciplinaria, setEsInterdisciplinaria] = useState(false);
  const [materia, setMateria] = useState<Materia | "">("");
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState<Materia[]>([]);
  const [selectedCompetenciasIds, setSelectedCompetenciasIds] = useState<string[]>([]);
  const [selectedCriteriosLogro, setSelectedCriteriosLogro] = useState<string[]>([]);
  const [selectedSubtemas, setSelectedSubtemas] = useState<string[]>([]);
  const [expandedCapitulos, setExpandedCapitulos] = useState<string[]>([]);
  const [requerimientos, setRequerimientos] = useState("");
  
  // Estados del generador unificado
  const [basePrototype, setBasePrototype] = useState('');
  const [generatedEvaluations, setGeneratedEvaluations] = useState<GeneratedEvaluation[]>([]);
  const [currentFeedback, setCurrentFeedback] = useState<Record<string, { liked: string; disliked: string; suggestions: string }>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('setup');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', content: string}>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState<Record<string, boolean>>({});
  const [requestInProgress, setRequestInProgress] = useState(false);
  
  // Save evaluation state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [nombreEvaluacion, setNombreEvaluacion] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // PHASE 5: Evaluation sources (multi-session + materials)
  const [evaluationSourceConfig, setEvaluationSourceConfig] = useState<{
    planificacionId?: string;
    sessionIds: string[];
    evaluationFocus: string;
  }>({
    sessionIds: [],
    evaluationFocus: ''
  });
  
  const [evaluationMaterialsConfig, setEvaluationMaterialsConfig] = useState<{
    directMaterialIds: string[];
    includeSessionMaterials: boolean;
  }>({
    directMaterialIds: [],
    includeSessionMaterials: false
  });

  // PHASE A: Compute generation conditions (used in multiple places)
  const hasAnepContent = selectedSubtemas.length > 0;
  const hasSessions = evaluationSourceConfig.sessionIds.length > 0;
  const hasMaterials = evaluationMaterialsConfig.directMaterialIds.length > 0;
  
  // PHASE 6: Time budgeting
  const [targetDurationMinutes, setTargetDurationMinutes] = useState<number>(80);  // Default: 80 minutes
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState<number | null>(null);
  const [timeBreakdown, setTimeBreakdown] = useState<any>(null);
  const [aiDesignReport, setAiDesignReport] = useState<string | null>(null);

  const selectedGroup: Group | undefined = useMemo(
    () => mockGroups.find(g => g.id === selectedGroupId),
    [selectedGroupId]
  );

  // Handle save evaluation
  const handleSaveEvaluation = async () => {
    // Pre-save validation (client-side)
    if (!selectedGroupId) {
      toast({
        title: "Error",
        description: "Seleccioná un grupo",
        variant: "destructive"
      });
      return;
    }

    if (!esInterdisciplinaria && !materia) {
      toast({
        title: "Error",
        description: "Seleccioná una materia",
        variant: "destructive"
      });
      return;
    }

    if (esInterdisciplinaria && materiasSeleccionadas.length === 0) {
      toast({
        title: "Error",
        description: "Seleccioná una materia",
        variant: "destructive"
      });
      return;
    }

    if (selectedCompetenciasIds.length === 0) {
      toast({
        title: "Error",
        description: "Seleccioná al menos una competencia",
        variant: "destructive"
      });
      return;
    }

    if (!nombreEvaluacion.trim()) {
      toast({
        title: "Error",
        description: "Ingresá un nombre",
        variant: "destructive"
      });
      return;
    }

    if (generatedEvaluations.length === 0) {
      toast({
        title: "Error",
        description: "No hay evaluaciones generadas para guardar",
        variant: "destructive"
      });
      return;
    }

    // Prevent double-submit
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const materiaFinal = esInterdisciplinaria 
        ? materiasSeleccionadas.join(', ')
        : materia || '';
      
      // Extract competency IDs from selected competencias
      const competenciasIds = normalizeArrayField(selectedCompetenciasIds);
      
      // Derive nivel from selectedGroup.year (type-safe and robust)
      // year format: "9º Año" or "8º Año" -> extract number and convert to "9no" or "8vo"
      const getNivelFromGroup = (group: Group | undefined): string => {
        // Defensive: handle undefined/null group
        if (!group?.year) {
          if (import.meta.env.DEV) {
            console.warn('[EVALUACIONES] getNivelFromGroup: group or year is missing, defaulting to 8vo');
          }
          return '8vo'; // Default fallback
        }
        
        // Extract year number from "9º Año" or "8º Año" using regex
        const yearMatch = group.year.match(/(\d+)/);
        if (yearMatch && yearMatch[1]) {
          const yearNum = parseInt(yearMatch[1], 10);
          // Validate parsed number
          if (!isNaN(yearNum) && isFinite(yearNum)) {
            return yearNum === 9 ? '9no' : '8vo';
          }
        }
        
        // Fallback: check if year string contains "9" or "8" (case-insensitive)
        const yearLower = group.year.toLowerCase();
        if (yearLower.includes('9')) return '9no';
        if (yearLower.includes('8')) return '8vo';
        
        // Final fallback: default to 8vo
        if (import.meta.env.DEV) {
          console.warn('[EVALUACIONES] getNivelFromGroup: could not determine nivel from year:', group.year, 'defaulting to 8vo');
        }
        return '8vo';
      };
      
      const evaluacionData = {
        user_id: user.id,
        nombre: nombreEvaluacion.trim(),
        materia: materiaFinal,
        grupo_id: selectedGroupId,
        nivel: getNivelFromGroup(selectedGroup),
        fecha: new Date().toISOString().split('T')[0],
        competencias_anep: competenciasIds,
        contenidos: normalizeArrayField(selectedSubtemas),
        criterios_logro: normalizeArrayField(selectedCriteriosLogro),
        requerimientos,
        evaluacion_generada: {
          evaluaciones: generatedEvaluations,
          base_prototype: basePrototype,
          // PHASE 6: Time budgeting + AI Design Report
          targetDurationMinutes,
          estimatedDurationMinutes,
          timeBreakdown,
          aiDesignReport: aiDesignReport ? JSON.parse(aiDesignReport) : null
        },
        // PHASE 5: Evaluation sources (sessions + materials)
        source_planificacion_id: evaluationSourceConfig.planificacionId || null,
        source_session_ids: evaluationSourceConfig.sessionIds,
        evaluation_focus: evaluationSourceConfig.evaluationFocus || null,
        direct_material_ids: evaluationMaterialsConfig.directMaterialIds,
        include_session_materials: evaluationMaterialsConfig.includeSessionMaterials,
        is_saved: true,
        saved_at: new Date().toISOString(),
        deleted_at: null
      };

      console.log('[SAVE EVALUATION] Attempting to save:', {
        nombre: evaluacionData.nombre,
        materia: evaluacionData.materia,
        grupo_id: evaluacionData.grupo_id,
        competencias_count: evaluacionData.competencias_anep.length,
        user_id: evaluacionData.user_id
      });

      const { data, error } = await supabase
        .from('evaluaciones')
        .insert(evaluacionData)
        .select()
        .single();

      if (error) {
        console.error('[SAVE EVALUATION] Supabase error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('[SAVE EVALUATION] Success:', data);

      toast({
        title: "Evaluación guardada",
        description: `"${nombreEvaluacion}" ha sido guardada correctamente`,
      });

      setSaveDialogOpen(false);
      setNombreEvaluacion('');
      
      // Optional: navigate to Mis Evaluaciones
      setTimeout(() => {
        navigate('/mis-evaluaciones');
      }, 1500);

    } catch (error: any) {
      // Detailed error logging in DEV
      if (import.meta.env.DEV) {
        console.error('[SAVE EVALUATION] Error guardando evaluación:', {
          error,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        });
      }
      
      // User-friendly error message (avoid technical codes)
      let errorMessage = "No se pudo guardar la evaluación. Por favor, intentá nuevamente.";
      
      if (error?.message) {
        if (error.message.includes('permission denied') || error.message.includes('policy')) {
          errorMessage = "No tenés permisos para guardar. Contactá al administrador.";
        } else if (error.message.includes('null value') || error.message.includes('violates not-null')) {
          errorMessage = "Faltan datos requeridos. Revisá que todos los campos estén completos.";
        } else if (error.message.includes('relation') || error.message.includes('does not exist')) {
          errorMessage = "Error de configuración. Contactá al administrador.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Error de conexión. Revisá tu conexión a internet e intentá nuevamente.";
        }
      }
      
      toast({
        title: "Error al guardar",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Simple debounce for API calls
  const makeAPICall = async (apiCall: () => Promise<any>, evaluationId: string) => {
    // Prevent multiple simultaneous calls
    if (requestInProgress) {
      console.log('Request already in progress, skipping...');
      return;
    }

    setRequestInProgress(true);
    setIsRegenerating(prev => ({ ...prev, [evaluationId]: true }));

    try {
      // Add minimum delay between calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await apiCall();
      
      // Add delay after successful call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return result;
    } finally {
      setRequestInProgress(false);
      setIsRegenerating(prev => ({ ...prev, [evaluationId]: false }));
    }
  };

  useEffect(() => {
    setSelectedCompetenciasIds([]);
    setSelectedCriteriosLogro([]);
    setSelectedSubtemas([]);
    setExpandedCapitulos([]);
  }, [materia, materiasSeleccionadas, esInterdisciplinaria]);

  // Obtener capítulos para la materia seleccionada
  const capitulosMateria = useMemo(() => {
    if (esInterdisciplinaria && materiasSeleccionadas.length > 0) {
      // Para evaluaciones interdisciplinarias, incluir todas las materias seleccionadas
      return CATALOGO_JERARQUICO.filter(cap => materiasSeleccionadas.includes(cap.materia));
    }
    return materia ? contenidosPorMateria(materia as Materia) : [];
  }, [materia, materiasSeleccionadas, esInterdisciplinaria]);

  // Función para obtener datos de versión (using unified provider as source of truth)
  const getVersionData = useCallback(async () => {
    if (!selectedGroup) return null;

    // Use unified provider instead of direct mock access
    const { getGroupContextForAI } = await import('@/services/groupContext/provider');
    const groupContext = await getGroupContextForAI(selectedGroup.id, { purpose: 'evaluation' });
    
    // Classify students using explicit flags from provider (deterministic, no inference)
    // V3 (Content-adapted): Only students with hasDeclaredContentAdaptation === true
    const conAdecuacionContenido = groupContext.students.filter(s => 
      s.hasDeclaredContentAdaptation
    );
    
    // V2 (Moderate support): Students with acceso accommodations but NOT content adaptation
    // Note: acceso accommodations are determined by contemplaciones, not explicit flags
    // For now, we use contemplaciones that indicate acceso needs (not content changes)
    const conAdecuacionAcceso = groupContext.students.filter(s => 
      !s.hasDeclaredContentAdaptation && 
      (s.contemplacionesEvaluaciones.length > 0 || s.ajustes)
    );
    
    // V1 (Standard): All remaining students
    const sinAdecuacionesExplicitas = groupContext.students.filter(s => 
      !s.hasDeclaredContentAdaptation && 
      s.contemplacionesEvaluaciones.length === 0 && 
      !s.ajustes
    );

    // Helper to create student details (for UI display - uses display names from provider)
    const detalles = (students: typeof groupContext.students) =>
      students.map(s => ({
        nombre: s.displayName,
        contemplaciones: s.contemplacionesEvaluaciones,
        id: s.studentId
      }));

    return {
      v1: detalles(sinAdecuacionesExplicitas),
      v2: detalles(conAdecuacionAcceso),
      v3: detalles(conAdecuacionContenido),
      hasContentAdaptation: groupContext.hasContentAdaptation  // From provider (deterministic)
    };
  }, [selectedGroup]);

  // Funciones del generador unificado
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        
        // Use AI to analyze and enhance the prototype
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          
          // Load unified group context for AI generation
          const { getGroupContextForAI } = await import('@/services/groupContext/provider');
          const groupContextData = await getGroupContextForAI(selectedGroup?.id || '', { purpose: 'evaluation' });
          
          const { data, error } = await supabase.functions.invoke('modify-evaluation', {
            body: {
              originalEvaluation: text,
              modification: "Analiza este prototipo de evaluación y adáptalo para diferentes niveles de adaptación curricular manteniendo su estructura original.",
              groupContext: {
                subject: materia,
                content: selectedSubtemas,
                groupName: groupContextData.groupName,
                // Use anonymized students from unified provider
                students: groupContextData.anonymizedStudentsForPrompt,
                ...(groupContextData.dominantLearningStyle && {
                  dominantProfile: groupContextData.dominantLearningStyle
                })
              },
              type: 'modification',
              adaptationLevel: 'standard'
            }
          });

          if (error) throw error;
          
          // Validate that AI returned meaningful content
          if (!data.content || data.content.trim().length === 0) {
            console.warn('AI returned empty content for prototype analysis');
            setBasePrototype(text.substring(0, 1000));
            return;
          }
          
          setBasePrototype(data.content);
        } catch (error) {
          console.error('Error analyzing prototype:', error);
          setBasePrototype(text.substring(0, 1000));
        }
      };
      reader.readAsText(file);
    }
  };

  // Función para expandir/colapsar capítulos
  const toggleCapitulo = (capituloId: string) => {
    setExpandedCapitulos(prev =>
      prev.includes(capituloId)
        ? prev.filter(id => id !== capituloId)
        : [...prev, capituloId]
    );
  };

  // Función para seleccionar/deseleccionar subtemas
  const toggleSubtema = (subtemaId: string) => {
    setSelectedSubtemas(prev => 
      prev.includes(subtemaId)
        ? prev.filter(id => id !== subtemaId)
        : [...prev, subtemaId]
    );
  };

  const handleGenerateEvaluations = async () => {
    // PHASE A: Allow generation if ANY of: ANEP content, sessions, OR materials
    if (!selectedGroup || (!materia && !esInterdisciplinaria)) return;
    if (esInterdisciplinaria && materiasSeleccionadas.length === 0) return;
    if (!hasAnepContent && !hasSessions && !hasMaterials) return;
    
    setIsGenerating(true);
    
    // Inicializar chat si es la primera vez
    if (chatMessages.length === 0) {
      setChatMessages([
        { role: 'ai', content: `¡Hola! He generado evaluaciones para ${materia} con los contenidos seleccionados. ¿Te gustaría hacer algún ajuste específico?` }
      ]);
    }
    
    // Obtener la clasificación de estudiantes (using unified provider)
    const versionStudentData = await getVersionData();
    
    // PHASE 6: Build session digests if sessions are selected
    let generationContext = null;
    if (hasSessions || evaluationMaterialsConfig.directMaterialIds.length > 0) {
      try {
        const { buildEvaluationGenerationContext, serializeGenerationContext } = await import('@/services/evaluations');
        
        generationContext = await buildEvaluationGenerationContext({
          sourcePlanificacionId: evaluationSourceConfig.planificacionId,
          sourceSessionIds: evaluationSourceConfig.sessionIds,
          evaluationFocus: evaluationSourceConfig.evaluationFocus,
          directMaterialIds: evaluationMaterialsConfig.directMaterialIds,
          includeSessionMaterials: evaluationMaterialsConfig.includeSessionMaterials,
          selectedSubtemas,
          selectedCompetenciasIds,
          selectedCriteriosLogro,
          requerimientos,
          targetDurationMinutes
        });
        
        console.log('[PHASE 6] Generation context built:', serializeGenerationContext(generationContext));
      } catch (error) {
        console.error('[PHASE 6] Error building generation context:', error);
      }
    }
    
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { getGroupContextForAI } = await import('@/services/groupContext/provider');
      
      // Load unified group context for AI generation
      const groupContextData = await getGroupContextForAI(selectedGroup.id, { purpose: 'evaluation' });
      
      // Build evaluation-specific group context (combines group data with evaluation-specific fields)
      const groupContext = {
        subject: esInterdisciplinaria ? materiasSeleccionadas.join(', ') : materia,
        subjects: esInterdisciplinaria ? materiasSeleccionadas : [materia],
        content: selectedSubtemas,
        competencies: selectedCompetenciasIds,
        criteriosLogro: selectedCriteriosLogro,
        isInterdisciplinary: esInterdisciplinaria,
        groupName: groupContextData.groupName,
        // Use anonymized students from unified provider
        students: groupContextData.anonymizedStudentsForPrompt,
        // Include dominant profile if available
        ...(groupContextData.dominantLearningStyle && {
          dominantProfile: groupContextData.dominantLearningStyle
        })
      };

      // Generate evaluations using explicit flags as source of truth
      // V3 (highly adapted) is ONLY generated if there are students with content adaptation
      const hasContentAdaptation = versionStudentData?.hasContentAdaptation ?? false;
      
      const evaluationConfigs = [
        {
          id: '1',
          title: 'Versión Estándar',
          adaptationLevel: 'standard' as const,
          adaptations: ['Formato estándar', 'Tiempo regular (80 min)', 'Instrucciones claras'],
          assignedStudents: versionStudentData?.v1.map(s => s.nombre) || [],
          assignedStudentIds: versionStudentData?.v1.map(s => s.id) || []
        },
        {
          id: '2', 
          title: 'Versión con Apoyos Moderados',
          adaptationLevel: 'moderate' as const,
          adaptations: ['Tiempo extendido 50%', 'Apoyo visual', 'Estructura guiada', 'Lectura de enunciados'],
          assignedStudents: versionStudentData?.v2.map(s => s.nombre) || [],
          assignedStudentIds: versionStudentData?.v2.map(s => s.id) || []
        },
        // V3 only generated if there are students with content adaptation
        ...(hasContentAdaptation ? [{
          id: '3',
          title: 'Versión Altamente Adaptada', 
          adaptationLevel: 'high' as const,
          adaptations: ['Evaluación oral', 'Materiales concretos', 'Tiempo flexible', 'Acompañamiento 1:1'],
          assignedStudents: versionStudentData?.v3.map(s => s.nombre) || [],
          assignedStudentIds: versionStudentData?.v3.map(s => s.id) || []
        }] : [])
      ];

      const evaluationPromises = evaluationConfigs.map(async (evalConfig) => {
        // PHASE 6b: Build request with generation_context if available
        const requestBody: any = {
          originalEvaluation: basePrototype || generatePrototipo(selectedSubtemas, requerimientos, parseInt(evalConfig.id)),
          modification: requerimientos || `Genera una evaluación adaptada para nivel ${evalConfig.adaptationLevel}`,
          groupContext,
          type: 'modification',
          adaptationLevel: evalConfig.adaptationLevel
        };
        
        // Add generation_context if session digests were built
        if (generationContext) {
          const { serializeGenerationContext } = await import('@/services/evaluations');
          requestBody.generation_context = serializeGenerationContext(generationContext);
        }
        
        const { data, error } = await supabase.functions.invoke('modify-evaluation', {
          body: requestBody
        });

        if (error) throw error;

        // Return raw response data (will be processed after Promise.all)
        return { data, error };
      });

      const evaluationsData = await Promise.all(evaluationPromises);
      
      // Map to evaluation format
      const evaluations = evaluationsData.map((item, idx) => {
        const evalConfig = evaluationConfigs[idx];
        const data = item.data;
        
        // Validate AI response content
        if (!data?.content || data.content.trim().length === 0) {
          console.warn(`AI returned empty content for evaluation ${evalConfig.id}`);
          const fallbackContent = basePrototype || generatePrototipo(selectedSubtemas, requerimientos, parseInt(evalConfig.id));
          return {
            id: evalConfig.id,
            version: 1,
            title: evalConfig.title,
            content: fallbackContent,
            adaptations: evalConfig.adaptations,
            assignedStudents: evalConfig.assignedStudents,
            assignedStudentIds: evalConfig.assignedStudentIds
          };
        }

        return {
          id: evalConfig.id,
          version: 1,
          title: evalConfig.title,
          content: data.content,
          adaptations: evalConfig.adaptations,
          assignedStudents: evalConfig.assignedStudents,
          assignedStudentIds: evalConfig.assignedStudentIds
        };
      });
      
      setGeneratedEvaluations(evaluations);
      
      // PHASE 6b: Aggregate time budgeting data across all evaluation variants
      // Process all backend responses to compute aggregated values
      const backendResponses = evaluationsData
        .map((item, idx) => ({
          data: item.data,
          config: evaluationConfigs[idx]
        }))
        .filter(item => item.data); // Only include responses with data
      
      if (backendResponses.length > 0) {
        // Find max estimatedTotalMinutes across all variants
        const maxEstimatedMinutes = Math.max(
          ...backendResponses
            .map(r => r.data.estimatedTotalMinutes)
            .filter((val): val is number => typeof val === 'number')
        );
        
        if (maxEstimatedMinutes > 0) {
          setEstimatedDurationMinutes(maxEstimatedMinutes);
          console.log('[PHASE 6b] Aggregated estimated time (max across variants):', maxEstimatedMinutes);
        }
        
        // Find variant with max estimatedTotalMinutes for timeBreakdown
        const maxVariant = backendResponses.reduce((max, current) => {
          const maxVal = max.data.estimatedTotalMinutes || 0;
          const currentVal = current.data.estimatedTotalMinutes || 0;
          return currentVal > maxVal ? current : max;
        });
        
        if (maxVariant.data.timeBreakdown) {
          setTimeBreakdown({
            sections: maxVariant.data.timeBreakdown,
            heuristicAssumptions: 'Estimación generada por IA basada en el tipo y cantidad de items'
          });
          console.log('[PHASE 6b] Time breakdown from max variant:', maxVariant.config.title);
        }
        
        // Compute wasTimeRefined: OR across all variants
        const anyRefined = backendResponses.some(r => r.data.wasTimeRefined === true);
        if (anyRefined) {
          console.log('[PHASE 6b] ⚠️ Time budget was refined by backend in at least one variant');
        }
        
        // Extract AI Design Report: prefer "moderate" variant, else max variant
        const moderateVariant = backendResponses.find(r => r.config.adaptationLevel === 'moderate');
        const reportVariant = moderateVariant || maxVariant;
        
        if (reportVariant.data.aiDesignReport) {
          setAiDesignReport(JSON.stringify(reportVariant.data.aiDesignReport));
          console.log('[PHASE 6b] AI Design Report from variant:', reportVariant.config.title);
        }
      } else {
        // Fallback: if backend doesn't provide these fields (backward compat or error)
        console.warn('[PHASE 6b] Backend responses missing time budgeting fields, showing fallback message');
        setEstimatedDurationMinutes(null);
        setTimeBreakdown(null);
        setAiDesignReport(null);
      }
      
      setActiveTab('results');
    } catch (error) {
      console.error('Error generating evaluations:', error);
      // Fallback to local generation if AI fails (using provider data)
      const hasContentAdaptation = versionStudentData?.hasContentAdaptation ?? false;
      
      const evaluations: GeneratedEvaluation[] = [
        {
          id: '1',
          version: 1,
          title: 'Versión Estándar',
          content: basePrototype || generatePrototipo(selectedSubtemas, requerimientos, 1),
          adaptations: ['Formato estándar', 'Tiempo regular (80 min)', 'Instrucciones claras'],
          assignedStudents: versionStudentData?.v1.map(s => s.nombre) || [],
          assignedStudentIds: versionStudentData?.v1.map(s => s.id) || []
        },
        {
          id: '2',
          version: 2,
          title: 'Versión con Apoyos Moderados', 
          content: basePrototype || generatePrototipo(selectedSubtemas, requerimientos, 2),
          adaptations: ['Tiempo extendido 50%', 'Apoyo visual', 'Estructura guiada', 'Lectura de enunciados'],
          assignedStudents: versionStudentData?.v2.map(s => s.nombre) || [],
          assignedStudentIds: versionStudentData?.v2.map(s => s.id) || []
        },
        // V3 only generated if there are students with content adaptation
        ...(hasContentAdaptation ? [{
          id: '3',
          version: 3,
          title: 'Versión Altamente Adaptada',
          content: basePrototype || generatePrototipo(selectedSubtemas, requerimientos, 3),
          adaptations: ['Evaluación oral', 'Materiales concretos', 'Tiempo flexible', 'Acompañamiento 1:1'],
          assignedStudents: versionStudentData?.v3.map(s => s.nombre) || [],
          assignedStudentIds: versionStudentData?.v3.map(s => s.id) || []
        }] : [])
      ];
      setGeneratedEvaluations(evaluations);
      setActiveTab('results');
    } finally {
      setIsGenerating(false);
    }
  };

  // Funciones para feedback y chat usando IA real
  const handleFeedback = async (evaluationId: string) => {
    const feedback = currentFeedback[evaluationId];
    if (!feedback?.suggestions?.trim()) return;

    // Prevent multiple simultaneous calls
    if (requestInProgress || isRegenerating[evaluationId]) {
      console.log('Request already in progress for evaluation:', evaluationId);
      return;
    }

    const evaluation = generatedEvaluations.find(e => e.id === evaluationId);
    if (!evaluation) return;

    await makeAPICall(async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const { getGroupContextForAI } = await import('@/services/groupContext/provider');
      
      // Load unified group context for AI generation
      const groupContextData = await getGroupContextForAI(selectedGroup?.id || '', { purpose: 'evaluation' });
      
      const { data, error } = await supabase.functions.invoke('modify-evaluation', {
        body: {
          originalEvaluation: evaluation.content,
          modification: feedback.suggestions,
          groupContext: {
            subject: materia,
            content: selectedSubtemas,
            groupName: groupContextData.groupName,
            students: groupContextData.anonymizedStudentsForPrompt,
            ...(groupContextData.dominantLearningStyle && {
              dominantProfile: groupContextData.dominantLearningStyle
            })
          },
          type: 'modification',
          adaptationLevel: evaluation.id === '1' ? 'standard' : evaluation.id === '2' ? 'moderate' : 'high'
        }
      });

      if (error) {
        throw new Error(error.message || 'Error al procesar la solicitud');
      }

      if (data?.success && data?.content && data.content.trim().length > 0) {
        setGeneratedEvaluations(prev => 
          prev.map(evalItem => 
            evalItem.id === evaluationId 
              ? {
                  ...evalItem,
                  version: evalItem.version + 1,
                  content: data.content,
                  feedback: undefined
                }
              : evalItem
          )
        );

        setCurrentFeedback(prev => ({
          ...prev,
          [evaluationId]: { liked: '', disliked: '', suggestions: '' }
        }));

        const { showToast } = await import('@/components/ui/toast-system');
        showToast.success('Evaluación modificada exitosamente');
      } else {
        throw new Error('No se recibió contenido válido de la IA'); 
      }
    }, evaluationId).catch(async (error: any) => {
      console.error('Error modifying evaluation:', error);
      
      // No fallback - show clear error instead
      const { showToast } = await import('@/components/ui/toast-system');
      showToast.error('No se pudo procesar la modificación. Por favor, intenta nuevamente.');
      
      throw error; // Re-throw to prevent further processing
    });
  };

  const handleRegenerate = async (evaluationId: string) => {
    const evaluation = generatedEvaluations.find(e => e.id === evaluationId);
    if (!evaluation?.feedback) return;

    // Prevent multiple simultaneous calls
    if (requestInProgress || isRegenerating[evaluationId]) {
      console.log('Regeneration already in progress for evaluation:', evaluationId);
      return;
    }

    await makeAPICall(async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const feedbackText = [
        ...evaluation.feedback.liked.map(item => `Me gusta: ${item}`),
        ...evaluation.feedback.disliked.map(item => `No me gusta: ${item}`),
        ...evaluation.feedback.suggestions.map(item => `Sugerencia: ${item}`)
      ].join('. ');

      // Load unified group context for AI generation
      const { getGroupContextForAI } = await import('@/services/groupContext/provider');
      const groupContextData = await getGroupContextForAI(selectedGroup?.id || '', { purpose: 'evaluation' });
      
      const { data, error } = await supabase.functions.invoke('modify-evaluation', {
        body: {
          originalEvaluation: evaluation.content,
          modification: `Aplica estos cambios: ${feedbackText}`,
          groupContext: {
            subject: materia,
            content: selectedSubtemas,
            groupName: groupContextData.groupName,
            students: groupContextData.anonymizedStudentsForPrompt,
            ...(groupContextData.dominantLearningStyle && {
              dominantProfile: groupContextData.dominantLearningStyle
            })
          },
          type: 'modification',
          adaptationLevel: evaluation.id === '1' ? 'standard' : evaluation.id === '2' ? 'moderate' : 'high'
        }
      });

      if (error) {
        throw new Error(error.message || 'Error al procesar la solicitud');
      }

      if (data?.success && data?.content && data.content.trim().length > 0) {
        setGeneratedEvaluations(prev => 
          prev.map(evalItem => 
            evalItem.id === evaluationId
              ? {
                  ...evalItem,
                  version: evalItem.version + 1,
                  content: data.content,
                  feedback: undefined
                }
              : evalItem
          )
        );

        const { showToast } = await import('@/components/ui/toast-system');
        if (data.warning) {
          showToast.warning(data.warning);
        } else {
          showToast.success('Evaluación regenerada exitosamente');
        }
      } else {
        console.error('Invalid AI response:', {
          success: data?.success,
          hasContent: !!data?.content,
          contentLength: data?.content?.length || 0,
          fullResponse: data
        });
        throw new Error('No se recibió contenido válido de la IA');
      }
    }, evaluationId).catch(async (error: any) => {
      console.error('Error regenerating evaluation:', error);
      
      // Fallback: apply feedback as comments
      const feedbackText = [
        evaluation.feedback.liked?.length > 0 ? `✓ Me gusta: ${evaluation.feedback.liked.join(', ')}` : '',
        evaluation.feedback.disliked?.length > 0 ? `✗ No me gusta: ${evaluation.feedback.disliked.join(', ')}` : '',
        evaluation.feedback.suggestions?.length > 0 ? `💡 Sugerencias: ${evaluation.feedback.suggestions.join(', ')}` : ''
      ].filter(Boolean).join('\n');
      
      const fallbackContent = evaluation.content + '\n\n--- FEEDBACK APLICADO ---\n' + feedbackText;
      setGeneratedEvaluations(prev => 
        prev.map(e => 
          e.id === evaluationId 
            ? { ...e, content: fallbackContent, feedback: undefined }
            : e
        )
      );
      
      const { showToast } = await import('@/components/ui/toast-system');
      showToast.error('Error de conexión. Se aplicó el feedback como comentarios.');
    });
  };

  const handleSendMessage = () => {
    if (!currentMessage.trim()) return;
    
    setChatMessages(prev => [...prev, { role: 'user', content: currentMessage }]);
    
    setTimeout(async () => {
      const aiResponse = await generateAIResponse(currentMessage, materia as string);
      setChatMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
    }, 1000);
    
    setCurrentMessage('');
  };

  const generateAIResponse = async (userMessage: string, subject: string) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { getGroupContextForAI } = await import('@/services/groupContext/provider');
      
      // Load unified group context for AI generation
      const groupContextData = await getGroupContextForAI(selectedGroup?.id || '', { purpose: 'evaluation' });
      
      const { data, error } = await supabase.functions.invoke('modify-evaluation', {
        body: {
          type: 'chat',
          modification: userMessage,
          groupContext: {
            subject: subject,
            content: selectedSubtemas,
            groupName: groupContextData.groupName,
            students: groupContextData.anonymizedStudentsForPrompt,
            ...(groupContextData.dominantLearningStyle && {
              dominantProfile: groupContextData.dominantLearningStyle
            })
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

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50 p-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">Volver</Button>
          <h1 className="text-3xl font-bold text-gray-800">Generar evaluaciones para el grupo</h1>
        </motion.div>

        <Card className="mb-8 border-2 border-green-200 bg-white/80">
          <CardHeader>
            <CardTitle className="text-green-700">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Grupo *</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccioná el grupo" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {mockGroups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de evaluación *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer ${
                    !esInterdisciplinaria ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="tipoEvaluacion"
                      checked={!esInterdisciplinaria}
                      onChange={() => setEsInterdisciplinaria(false)}
                      className="mr-2"
                    />
                    <div>
                      <span className="font-medium">Evaluación por materia</span>
                      <p className="text-sm text-gray-600">Una sola asignatura</p>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 rounded-lg border cursor-pointer ${
                    esInterdisciplinaria ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="tipoEvaluacion"
                      checked={esInterdisciplinaria}
                      onChange={() => setEsInterdisciplinaria(true)}
                      className="mr-2"
                    />
                    <div>
                      <span className="font-medium">Evaluación interdisciplinaria</span>
                      <p className="text-sm text-gray-600">Múltiples asignaturas</p>
                    </div>
                  </label>
                </div>
              </div>

              {!esInterdisciplinaria ? (
                <div className="space-y-2">
                  <Label>Materia *</Label>
                  <Select value={materia} onValueChange={(v) => setMateria(v as Materia)}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Seleccioná la materia" /></SelectTrigger>
                    <SelectContent className="bg-white">
                      {(["Historia", "Literatura", "Formación para la ciudadanía"] as Materia[]).map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Materias a integrar *</Label>
                  <p className="text-sm text-muted-foreground">
                    Selecciona las materias que quieres integrar en la evaluación interdisciplinaria
                  </p>
                  <div className="grid grid-cols-1 gap-3 bg-purple-50/50 p-3 rounded">
                    {(["Historia", "Literatura", "Formación para la ciudadanía"] as Materia[]).map(m => (
                      <label key={m} className="flex items-center gap-2 p-2 rounded hover:bg-white border border-purple-200/50">
                        <Checkbox
                          checked={materiasSeleccionadas.includes(m)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setMateriasSeleccionadas(prev => [...prev, m]);
                            } else {
                              setMateriasSeleccionadas(prev => prev.filter(mat => mat !== m));
                            }
                          }}
                        />
                        <span className="font-medium text-purple-800">{m}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {((materia && !esInterdisciplinaria) || (esInterdisciplinaria && materiasSeleccionadas.length > 0)) && (
              <>
                <div className="space-y-2">
                  <Label>Competencias Específicas a Evaluar</Label>
                  <p className="text-sm text-muted-foreground">
                    Selecciona las competencias específicas que deseas que los estudiantes desarrollen o demuestren en esta evaluación
                  </p>
                  
                  {/* Historia */}
                  {((materia === "Historia" && !esInterdisciplinaria) || (esInterdisciplinaria && materiasSeleccionadas.includes("Historia"))) && (
                    <div className="mb-4">
                      <h4 className="text-md font-semibold text-blue-700 mb-2">Historia</h4>
                      <div className="grid md:grid-cols-1 gap-3 bg-blue-50/50 p-3 rounded">
                        {getCompetenciasEspecificas().map(comp => (
                          <label key={comp.id} className="flex items-start gap-2 p-2 rounded hover:bg-white border border-blue-200/50">
                            <Checkbox
                              checked={selectedCompetenciasIds.includes(comp.id)}
                              onCheckedChange={(val) => {
                                setSelectedCompetenciasIds(prev => val ? [...prev, comp.id] : prev.filter(id => id !== comp.id));
                              }}
                            />
                            <div className="w-full">
                              <div className="text-sm font-medium text-blue-800">
                                {comp.codigo}: {comp.nombre}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {comp.descripcion}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Literatura */}
                  {((materia === "Literatura" && !esInterdisciplinaria) || (esInterdisciplinaria && materiasSeleccionadas.includes("Literatura"))) && (
                    <div className="mb-4">
                      <h4 className="text-md font-semibold text-green-700 mb-2">Literatura</h4>
                      <div className="grid md:grid-cols-1 gap-3 bg-green-50/50 p-3 rounded">
                        {getCompetenciasEspecificasLiteratura().map(comp => (
                          <label key={comp.id} className="flex items-start gap-2 p-2 rounded hover:bg-white border border-green-200/50">
                            <Checkbox
                              checked={selectedCompetenciasIds.includes(comp.id)}
                              onCheckedChange={(val) => {
                                setSelectedCompetenciasIds(prev => val ? [...prev, comp.id] : prev.filter(id => id !== comp.id));
                              }}
                            />
                            <div className="w-full">
                              <div className="text-sm font-medium text-green-800">
                                {comp.codigo}: {comp.nombre}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {comp.descripcion}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}


                   {/* Formación para la ciudadanía */}
                  {((materia === "Formación para la ciudadanía" && !esInterdisciplinaria) || (esInterdisciplinaria && materiasSeleccionadas.includes("Formación para la ciudadanía"))) && (
                    <div className="mb-4">
                      <h4 className="text-md font-semibold text-purple-700 mb-2">Formación para la ciudadanía</h4>
                      <div className="grid md:grid-cols-1 gap-3 bg-purple-50/50 p-3 rounded">
                        {getCompetenciasEspecificasCiudadania().map(comp => (
                          <label key={comp.id} className="flex items-start gap-2 p-2 rounded hover:bg-white border border-purple-200/50">
                            <Checkbox
                              checked={selectedCompetenciasIds.includes(comp.id)}
                              onCheckedChange={(val) => {
                                setSelectedCompetenciasIds(prev => val ? [...prev, comp.id] : prev.filter(id => id !== comp.id));
                              }}
                            />
                            <div className="w-full">
                              <div className="text-sm font-medium text-purple-800">
                                {comp.codigo}: {comp.nombre}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {comp.descripcion}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Selección de Criterios de Logro */}
                {selectedCompetenciasIds.length > 0 && (
                  <div className="space-y-2">
                    <Label>Criterios de Logro a Evaluar *</Label>
                    <p className="text-sm text-muted-foreground">
                      Selecciona los criterios específicos que quieres evaluar en esta actividad
                    </p>
                    
                    {/* Obtener criterios por materia */}
                    {(() => {
                      let todosCriterios: any[] = [];
                      
                      const historiaIds = selectedCompetenciasIds.filter(id => !id.includes('-literatura') && !id.includes('-ciudadania'));
                      const literaturaIds = selectedCompetenciasIds.filter(id => id.includes('-literatura'));
                      const ciudadaniaIds = selectedCompetenciasIds.filter(id => id.includes('-ciudadania'));
                      
                      if (historiaIds.length > 0) {
                        const criteriosHistoria = getCriteriosLogroPorCompetencias(historiaIds);
                        todosCriterios.push(...criteriosHistoria.map(c => ({...c, materia: 'Historia'})));
                      }
                      if (literaturaIds.length > 0) {
                        const criteriosLiteratura = getCriteriosLogroPorCompetenciasLiteratura(literaturaIds);
                        todosCriterios.push(...criteriosLiteratura.map(c => ({...c, materia: 'Literatura'})));
                      }
                      if (ciudadaniaIds.length > 0) {
                        const criteriosCiudadania = getCriteriosLogroPorCompetenciasCiudadania(ciudadaniaIds);
                        todosCriterios.push(...criteriosCiudadania.map(c => ({...c, materia: 'Formación para la ciudadanía'})));
                      }
                      
                              // Agrupar por materia para mostrar organizado
                              const criteriosPorMateria = todosCriterios.reduce((acc: Record<string, any[]>, criterio) => {
                                if (!acc[criterio.materia]) acc[criterio.materia] = [];
                                acc[criterio.materia].push(criterio);
                                return acc;
                              }, {} as Record<string, any[]>);
                              
                              return (
                                <div className="space-y-4">
                                  {Object.entries(criteriosPorMateria).map(([nombreMateria, criterios]) => {
                                    const colorClass = nombreMateria === "Historia" ? "blue" : 
                                                     nombreMateria === "Literatura" ? "green" : "purple";
                                    
                                    return (
                                      <div key={nombreMateria} className="space-y-2">
                                        <h5 className={`text-sm font-semibold text-${colorClass}-700`}>{nombreMateria}</h5>
                                        <div className={`grid md:grid-cols-1 gap-2 bg-${colorClass}-50/50 p-3 rounded`}>
                                          {(criterios as any[]).map((c: any) => (
                                    <label key={c.id} className={`flex items-start gap-2 p-2 rounded hover:bg-white border border-${colorClass}-200/50`}>
                                      <Checkbox
                                        checked={selectedCriteriosLogro.includes(c.id)}
                                        onCheckedChange={(val) => {
                                          setSelectedCriteriosLogro(prev => val ? [...prev, c.id] : prev.filter(id => id !== c.id));
                                        }}
                                      />
                                      <div className="w-full">
                                        <div className={`text-xs font-medium text-${colorClass}-800`}>
                                          {c.codigo}: {c.descripcion}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
                
                 <div className="space-y-2">
                   <Label>Contenidos del programa (multi-selección)</Label>
                   {esInterdisciplinaria && materiasSeleccionadas.length > 1 ? (
                     // Mostrar contenidos agrupados por materia para evaluaciones interdisciplinarias
                     <div className="space-y-4">
                       {materiasSeleccionadas.map(materiaActual => {
                         const capitulosMateria = contenidosPorMateria(materiaActual);
                         const colorClass = materiaActual === "Historia" ? "blue" : 
                                          materiaActual === "Literatura" ? "green" : "purple";
                         
                         return (
                           <div key={materiaActual} className="space-y-2">
                             <h4 className={`text-md font-semibold text-${colorClass}-700`}>{materiaActual}</h4>
                             <div className={`grid md:grid-cols-2 gap-3 bg-${colorClass}-50/50 p-3 rounded`}>
                                {capitulosMateria.map(capitulo => (
                                  <div key={capitulo.id} className="border border-border/50 rounded-lg">
                                    {/* Capítulo Macro - Solo título, no seleccionable */}
                                    <div
                                      onClick={() => toggleCapitulo(capitulo.id)}
                                      className="flex items-center justify-between p-3 bg-muted/30 rounded-t-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                    >
                                      <h5 className="font-medium text-sm text-foreground/90 leading-tight">
                                        {capitulo.titulo}
                                      </h5>
                                      {expandedCapitulos.includes(capitulo.id) ? (
                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    
                                    {/* Subtemas - Seleccionables */}
                                    <Collapsible open={expandedCapitulos.includes(capitulo.id)}>
                                      <CollapsibleContent className="p-3 pt-0">
                                        <div className="space-y-2 mt-2">
                                          {capitulo.subtemas.map((subtema) => (
                                            <div
                                              key={subtema.id}
                                              onClick={() => toggleSubtema(subtema.id)}
                                              className={cn(
                                                "flex items-start space-x-2 p-2 rounded border cursor-pointer transition-colors",
                                                selectedSubtemas.includes(subtema.id)
                                                  ? "border-primary bg-primary/10"
                                                  : "border-muted hover:border-primary/50"
                                              )}
                                            >
                                              <Checkbox 
                                                checked={selectedSubtemas.includes(subtema.id)}
                                                onChange={() => toggleSubtema(subtema.id)}
                                                className="mt-0.5 flex-shrink-0"
                                              />
                                              <span className="text-sm leading-relaxed">{subtema.contenido}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  </div>
                                ))}
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   ) : (
                      // Vista normal para evaluaciones de una sola materia
                      <div className="space-y-4">
                        {capitulosMateria.map((capitulo) => (
                          <div key={capitulo.id} className="border border-border/50 rounded-lg">
                            {/* Capítulo Macro - Solo título, no seleccionable */}
                            <div
                              onClick={() => toggleCapitulo(capitulo.id)}
                              className="flex items-center justify-between p-3 bg-muted/30 rounded-t-lg cursor-pointer hover:bg-muted/50 transition-colors"
                            >
                              <h4 className="font-medium text-sm text-foreground/90 leading-tight">
                                {capitulo.titulo}
                              </h4>
                              {expandedCapitulos.includes(capitulo.id) ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            
                            {/* Subtemas - Seleccionables */}
                            <Collapsible open={expandedCapitulos.includes(capitulo.id)}>
                              <CollapsibleContent className="p-3 pt-0">
                                <div className="space-y-2 mt-2">
                                  {capitulo.subtemas.map((subtema) => (
                                    <div
                                      key={subtema.id}
                                      onClick={() => toggleSubtema(subtema.id)}
                                      className={cn(
                                        "flex items-start space-x-2 p-2 rounded border cursor-pointer transition-colors",
                                        selectedSubtemas.includes(subtema.id)
                                          ? "border-primary bg-primary/10"
                                          : "border-muted hover:border-primary/50"
                                      )}
                                    >
                                      <Checkbox 
                                        checked={selectedSubtemas.includes(subtema.id)}
                                        onChange={() => toggleSubtema(subtema.id)}
                                        className="mt-0.5 flex-shrink-0"
                                      />
                                      <span className="text-sm leading-relaxed">{subtema.contenido}</span>
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        ))}
                      </div>
                   )}
                 </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Requerimientos del docente para la evaluación</Label>
              <Textarea 
                value={requerimientos} 
                onChange={(e) => {
                  setRequerimientos(e.target.value);
                  // Auto-regenerar evaluaciones cuando cambien los requerimientos (si ya hay evaluaciones generadas)
                  if (generatedEvaluations.length > 0 && e.target.value.trim() !== requerimientos.trim()) {
                    const timeoutId = setTimeout(() => {
                      handleGenerateEvaluations();
                    }, 2000); // Debounce de 2 segundos
                    return () => clearTimeout(timeoutId);
                  }
                }} 
                placeholder="Escribe indicaciones o condiciones que quieres que estén sí o sí en la evaluación para guiar a la IA en su elaboración..."
                className="min-h-[100px]"
              />
              {generatedEvaluations.length > 0 && (
                <p className="text-xs text-blue-600">
                  💡 Los cambios en requerimientos actualizarán automáticamente las evaluaciones
                </p>
              )}
            </div>

            {/* PHASE 5: Evaluation sources (sessions + materials) */}
            <EvaluationSourceSelector
              grupoId={selectedGroupId}
              config={evaluationSourceConfig}
              onChange={setEvaluationSourceConfig}
              disabled={isGenerating || requestInProgress}
            />
            
            {/* PHASE 5: Evaluation materials */}
            <EvaluationMaterialsSection
              config={evaluationMaterialsConfig}
              onChange={setEvaluationMaterialsConfig}
              selectedSessionIds={evaluationSourceConfig.sessionIds}
              disabled={isGenerating || requestInProgress}
            />

            {/* PHASE A: Help text for materials-only generation */}
            {!hasAnepContent && evaluationMaterialsConfig.directMaterialIds.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 Podés generar evaluaciones usando solo materiales docentes. No es necesario seleccionar contenido ANEP.
                </p>
              </div>
            )}
            
            {/* PHASE 6: Time budgeting */}
            <TimeBudgetingSection
              targetMinutes={targetDurationMinutes}
              onTargetChange={setTargetDurationMinutes}
              estimatedMinutes={estimatedDurationMinutes}
              timeBreakdown={timeBreakdown}
              disabled={isGenerating || requestInProgress}
            />

            <div className="space-y-4">
              {!showAdvancedFeatures && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowAdvancedFeatures(true)}
                  className="w-full text-sm"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  ¿Tienes un prototipo de evaluación? Haz clic para opciones avanzadas
                </Button>
              )}
              
              {showAdvancedFeatures && (
                <div className="space-y-4 p-4 border-2 border-dashed border-primary/20 rounded-lg">
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
                      placeholder="Ejemplo: Siempre incluyo una pregunta teórica, un ejercicio práctico y un análisis de caso..."
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
                </div>
              )}
              
              <Button 
                onClick={handleGenerateEvaluations} 
                disabled={
                  isGenerating || requestInProgress || !selectedGroupId || 
                  (!esInterdisciplinaria && !materia) || 
                  (esInterdisciplinaria && materiasSeleccionadas.length === 0) || 
                  // A/B/C-like validation: Allow generation if EITHER ANEP OR sessions selected
                  (selectedSubtemas.length === 0 && evaluationSourceConfig.sessionIds.length === 0) ||
                  (selectedCriteriosLogro.length === 0 && evaluationSourceConfig.sessionIds.length === 0)
                }
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generando evaluaciones creativas...
                  </>
                ) : requestInProgress ? (
                  <>
                    <div className="animate-pulse rounded-full h-4 w-4 bg-orange-500 mr-2"></div>
                    Procesando solicitud...
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Generar Evaluaciones Inteligentes
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Se generarán versiones automáticamente adaptadas según las adecuaciones declaradas de tus estudiantes
              </p>
            </div>
          </CardContent>
        </Card>

        {generatedEvaluations.length > 0 && (
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="results">Evaluaciones Generadas</TabsTrigger>
              </TabsList>

              <TabsContent value="results" className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    Evaluaciones generadas para {selectedGroup?.name}
                  </h2>
                  <Button
                    onClick={() => {
                      // Prefill with a sensible default name
                      const defaultName = `Evaluación ${esInterdisciplinaria ? materiasSeleccionadas.join(' + ') : materia} - ${selectedGroup?.name}`;
                      setNombreEvaluacion(defaultName);
                      setSaveDialogOpen(true);
                    }}
                    variant="default"
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Guardar evaluación
                  </Button>
                </div>
                
                {generatedEvaluations.map((evaluation) => (
                  <EvaluacionVisualRenderer
                    key={evaluation.id}
                    evaluation={evaluation}
                    subject={esInterdisciplinaria 
                      ? materiasSeleccionadas.map(m => m).join(', ') 
                      : materia || ''
                    }
                    selectedContent={selectedSubtemas.map(id => {
                      const subtema = getSubtemaPorId(id);
                      return { nombre: subtema?.contenido || id };
                    })}
                    duration="90 minutos"
                    requirements={requerimientos}
                    students={selectedGroup?.students}
                    criteriosLogro={selectedCriteriosLogro}
                    onFeedback={(evaluationId, feedback) => {
                      setCurrentFeedback(prev => ({
                        ...prev,
                        [evaluationId]: { 
                          liked: '',
                          disliked: '',
                          suggestions: feedback
                        }
                      }));
                      handleFeedback(evaluationId);
                    }}
                    onRegenerate={(evaluationId) => handleRegenerate(evaluationId)}
                  />
                ))}
                
                {/* PHASE 6: AI Design Report */}
                {aiDesignReport && (
                  <AIDesignReport 
                    reportData={JSON.parse(aiDesignReport)} 
                    className="mt-6"
                  />
                )}
                
                {selectedCriteriosLogro.length > 0 && (
                  <Card className="border-2 border-green-300">
                    <CardHeader>
                      <CardTitle className="text-green-700">Criterios de logro seleccionados para evaluar</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {criteriosLogroBox(selectedCompetenciasIds, esInterdisciplinaria ? materiasSeleccionadas : [materia as Materia])}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Save Evaluation Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Guardar Evaluación</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nombre">Nombre de la evaluación</Label>
                <Input
                  id="nombre"
                  value={nombreEvaluacion}
                  onChange={(e) => setNombreEvaluacion(e.target.value)}
                  placeholder="Ej: Evaluación Historia - 9no 1"
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Este nombre aparecerá en "Mis Evaluaciones"
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEvaluation}
                disabled={isSaving || !nombreEvaluacion.trim()}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default EvaluacionesGrupo;