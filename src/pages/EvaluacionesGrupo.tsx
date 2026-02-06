import { useEffect, useMemo, useState } from "react";
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
import { Upload, FileText, MessageCircle, ThumbsUp, ThumbsDown, RefreshCw, Lightbulb, ChevronDown, ChevronUp, Save, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { EvaluationSourceSelector, EvaluationMaterialsSection, TimeBudgetingSection, AIDesignReport, EvaluationAssignmentsPanel, TeacherRemindersPanel, BetaToggle } from "@/components/evaluaciones";
import { EvaluationRendererV2, V2InfoPanels } from "@/components/evaluaciones/v2/index";
import { EvaluationAdjustmentsPanel } from "@/components/evaluaciones/v2/EvaluationAdjustmentsPanel";
import type { V2Response } from "@/services/evaluations/v2Types";
import type { AIDesignReportData } from "@/components/evaluaciones";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { EvaluationDesignPlan, StudentReminders, MissingTemplateError } from "@/services/evaluations";
import { requestEvaluation, getBetaToggleState } from "@/services/evaluations/requestService";

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
  versionLabel?: string;
  versionKind?: string;
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

interface EvaluationBundle {
  baseHtml?: string;
  versionBHtml?: string | null;
  versionCHtml?: string | null;
  versions?: { A: string; B?: string | null; C?: string | null };
  responseOptionsIncluded?: boolean;
  responseOptionCount?: number;
  finalAssignmentCounts?: { A: number; B: number; C: number }; // STEP 2: Store from backend
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
  const [evaluationBundle, setEvaluationBundle] = useState<EvaluationBundle | null>(null);
  const [evaluationDesignPlan, setEvaluationDesignPlan] = useState<EvaluationDesignPlan | null>(null);
  const [studentAssignments, setStudentAssignments] = useState<Record<string, 'A' | 'B' | 'C'>>({});
  const [teacherReminders, setTeacherReminders] = useState<StudentReminders[]>([]);
  const [missingTemplateErrors, setMissingTemplateErrors] = useState<MissingTemplateError[]>([]);
  const [assignmentWarnings, setAssignmentWarnings] = useState<string[]>([]);
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
  
  // PHASE 4: V2 Beta - JSON-based evaluation rendering
  const [useBetaV2, setUseBetaV2] = useState<boolean>(getBetaToggleState());
  const [v2RawResponse, setV2RawResponse] = useState<V2Response | null>(null);
  const [v2SelectedVersion, setV2SelectedVersion] = useState<'A' | 'B' | 'C'>('A');
  // V2 Adjustments - track previous response for single-step undo
  const [previousV2Response, setPreviousV2Response] = useState<V2Response | null>(null);
  
  // Configuration panel collapse state (auto-collapse after generation)
  const [isConfigCollapsed, setIsConfigCollapsed] = useState<boolean>(false);
  
  // DEBUG: Pipeline debug panel (gated by feature flag)
  const [pipelineDebug, setPipelineDebug] = useState<{
    lastRequest?: {
      generationMode: string;
      hasEvaluationDesignPlan: boolean;
      hasGenerationContext: boolean;
      triggers: { versionB: boolean; versionC: boolean };
      responseOptionsInclude: boolean;
      assignmentsCount: number;
    };
    lastResponse?: {
      hasAiReport: boolean;
      hasEvaluationBundle: boolean;
      versionsGenerated: string[];
      warningsCount: number;
      endpoint: string;
      error?: string;
    };
  }>({});
  const showDebugPanel = import.meta.env.VITE_DEBUG_EVAL_PIPELINE === 'true';
  
  // ENFORCE: Track if modify-evaluation was called
  const [generationError, setGenerationError] = useState<{
    message: string;
    details?: string;
    show: boolean;
  } | null>(null);

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
          evaluaciones: displayEvaluations,
          base_prototype: basePrototype,
          // PHASE 6: Time budgeting + AI Design Report
          targetDurationMinutes,
          estimatedDurationMinutes,
          timeBreakdown,
          aiDesignReport: aiDesignReport ? JSON.parse(aiDesignReport) : null,
          ai_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,
          evaluation_bundle: evaluationBundle,
          evaluation_design_plan: evaluationDesignPlan,
          student_assignments: studentAssignments,
          teacher_reminders_by_student: teacherReminders
        },
        // PHASE C: Persist AI design report in DB column
        ai_design_report: aiDesignReport ? JSON.parse(aiDesignReport) : null,
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

      const { data: insertedData, error } = await supabase
        .from('evaluaciones')
        .insert(evaluacionData)
        .select()
        .single();
      
      // R2: Verificar que ai_report se persistió correctamente
      if (insertedData) {
        const hasAiReportInGenerated = !!insertedData.evaluacion_generada?.ai_report;
        const hasAiDesignReport = !!insertedData.ai_design_report;
        
        console.info('[SAVE EVALUATION] Persistence verification', {
          hasAiReportInGenerated,
          hasAiDesignReport,
          evaluationId: insertedData.id
        });
        
        if (!hasAiReportInGenerated && !hasAiDesignReport) {
          console.error('[SAVE EVALUATION] CRITICAL: AI report not persisted!');
          toast({
            title: "Error al guardar",
            description: "El reporte de IA no se guardó correctamente. Por favor, intentá nuevamente.",
            variant: "destructive"
          });
          setIsSaving(false);
          return;
        }
      }
      
      const data = insertedData;

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
    console.info('[EVAL_PIPELINE] handleGenerateEvaluations called');
    
    // PHASE A: Allow generation if ANY of: ANEP content, sessions, OR materials
    // ENFORCE: Show visible errors instead of silent returns
    if (!selectedGroup || (!materia && !esInterdisciplinaria)) {
      console.info('[EVAL_PIPELINE] Early return: missing group or materia');
      toast({
        title: "Error de validación",
        description: "Seleccioná un grupo y una materia antes de generar evaluaciones.",
        variant: "destructive"
      });
      return;
    }
    if (esInterdisciplinaria && materiasSeleccionadas.length === 0) {
      console.info('[EVAL_PIPELINE] Early return: interdisciplinaria without materias');
      toast({
        title: "Error de validación",
        description: "Seleccioná al menos una materia para la evaluación interdisciplinaria.",
        variant: "destructive"
      });
      return;
    }
    if (!hasAnepContent && !hasSessions && !hasMaterials) {
      console.info('[EVAL_PIPELINE] Early return: no content, sessions, or materials');
      toast({
        title: "Error de validación",
        description: "Seleccioná al menos uno: contenidos ANEP, sesiones de clase, o materiales docentes.",
        variant: "destructive"
      });
      return;
    }
    
    console.info('[EVAL_PIPELINE] Starting generation', {
      hasAnepContent,
      hasSessions,
      hasMaterials,
      groupId: selectedGroup.id
    });
    
    setIsGenerating(true);
    
    // Inicializar chat si es la primera vez
    if (chatMessages.length === 0) {
      setChatMessages([
        { role: 'ai', content: `¡Hola! He generado evaluaciones para ${materia} con los contenidos seleccionados. ¿Te gustaría hacer algún ajuste específico?` }
      ]);
    }
    
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
      const { seedDefaultsForStudent } = await import('@/lib/contemplaciones/seeding');
      
      // PROACTIVE SEEDING: Ensure evaluation contemplaciones exist for ALL students
      // in the selected group BEFORE loading the group context.
      // This fixes the issue where reminders were empty because teachers
      // hadn't opened each student's profile to trigger seeding.
      // NOTE: seedDefaultsForStudent respects the user_touched flag,
      // so manual teacher selections are NOT overwritten.
      if (selectedGroup?.students) {
        const isDev = import.meta.env.DEV;
        if (isDev) {
          console.log('[EVAL_PIPELINE] Proactive seeding: ensuring contemplaciones exist for all students');
        }
        for (const student of selectedGroup.students) {
          seedDefaultsForStudent(student.id, student.name, false); // Suppress verbose logs
        }
        if (isDev) {
          console.log(`[EVAL_PIPELINE] Proactive seeding complete for ${selectedGroup.students.length} students`);
        }
      }
      
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

      const { buildEvaluationDesignPlan } = await import('@/services/evaluations');
      const { getEvaluationDesignRuleTemplate } = await import('@/lib/contemplaciones/enforcement');
      const plan = buildEvaluationDesignPlan({
        groupContext: groupContextData,
        teacherRequirementsText: requerimientos
      });

      const instrumentDesignRules = plan.instrumentDesignContemplacionIds
        .map(id => getEvaluationDesignRuleTemplate(id))
        .filter((rule): rule is string => Boolean(rule));

      // UNIFIED PIPELINE: Siempre usar el plan completo (sin overrides)
      const effectivePlan = plan;

      // Construir modification con contexto de sesiones/materiales si existe
      // STRICT LIMITS: máximo 5 sesiones, 5 materiales, 500 chars de extractedText por material
      let modificationText = requerimientos || 'Genera una evaluación escrita universal basada en los contenidos seleccionados.';
      
      if (generationContext) {
        const { serializeGenerationContext } = await import('@/services/evaluations');
        const serialized = serializeGenerationContext(generationContext);
        
        // Construir texto legible del contexto con límites estrictos
        const contextSections: string[] = [];
        
        // Límite: máximo 5 sesiones
        const sessionsToInclude = (serialized.sessions || []).slice(0, 5);
        if (sessionsToInclude.length > 0) {
          contextSections.push('SESIONES DE CLASE A EVALUAR:');
          sessionsToInclude.forEach((s: any, idx: number) => {
            contextSections.push(`\nSesión ${s.order}: ${s.title || `Sesión ${s.order}`}`);
            if (s.anepContent?.length) contextSections.push(`- Contenidos ANEP: ${s.anepContent.join(', ')}`);
            if (s.competencies?.length) contextSections.push(`- Competencias: ${s.competencies.join(', ')}`);
            if (s.objectives) contextSections.push(`- Objetivos: ${s.objectives}`);
            if (s.activitiesSummary) contextSections.push(`- Resumen de actividades: ${s.activitiesSummary}`);
            if (s.resources?.length) contextSections.push(`- Recursos: ${s.resources.join(', ')}`);
            if (s.attachedMaterials?.length) {
              contextSections.push(`- Materiales adjuntos: ${s.attachedMaterials.map((m: any) => m.title).join(', ')}`);
            }
            if (idx < sessionsToInclude.length - 1) contextSections.push('\n---');
          });
          if ((serialized.sessions || []).length > 5) {
            contextSections.push(`\n(Nota: Se incluyeron las primeras 5 de ${serialized.sessions.length} sesiones seleccionadas)`);
          }
        }
        
        // Límite: máximo 5 materiales, 500 caracteres de extractedText por material
        const materialsToInclude = (serialized.materials || []).slice(0, 5);
        if (materialsToInclude.length > 0) {
          contextSections.push('\n\nMATERIALES DOCENTES ADJUNTOS:');
          materialsToInclude.forEach((m: any, idx: number) => {
            contextSections.push(`\n${idx + 1}. ${m.title} (${m.mimeType})`);
            if (m.focusText) contextSections.push(`   Enfoque: ${m.focusText}`);
            if (m.extractedText) {
              // Límite estricto: máximo 500 caracteres de extractedText
              const textSnippet = m.extractedText.substring(0, 500);
              contextSections.push(`   Contenido extraído del PDF:\n   ${textSnippet}${m.extractedText.length > 500 ? '...' : ''}`);
            }
            if (idx < materialsToInclude.length - 1) contextSections.push('\n---');
          });
          if ((serialized.materials || []).length > 5) {
            contextSections.push(`\n(Nota: Se incluyeron los primeros 5 de ${serialized.materials.length} materiales seleccionados)`);
          }
        }
        
        if (serialized.evaluationFocus) {
          contextSections.push(`\n\nENFOQUE DE EVALUACIÓN (ESPECIFICADO POR EL DOCENTE):\n${serialized.evaluationFocus}`);
        }
        
        if (serialized.timeBudget) {
          contextSections.push(`\n\nPRESUPUESTO DE TIEMPO:\n- Duración objetivo: ${serialized.timeBudget.targetMinutes} minutos\n- Tolerancia: ${Math.round((serialized.timeBudget.flexibilityThreshold || 0.10) * 100)}%`);
        }
        
        if (contextSections.length > 0) {
          modificationText = `${modificationText}\n\n${contextSections.join('\n')}`;
        }
      }

      // UNIFIED PIPELINE: Siempre usar generation_mode: 'universal'
      const requestBody: any = {
        originalEvaluation: basePrototype || generatePrototipo(selectedSubtemas, requerimientos, 1),
        modification: modificationText,
        groupContext,
        type: 'modification',
        generation_mode: 'universal',
        evaluation_design_plan: {
          instrumentDesignRules,
          responseOptions: effectivePlan.responseOptions,
          triggers: effectivePlan.triggers,
          assignmentByStudentId: effectivePlan.assignmentByStudentId,
          perStudentReminders: effectivePlan.perStudentReminders,
          varkDistribution: effectivePlan.varkDistribution,
          highStructureNeed: effectivePlan.highStructureNeed,
          designComplexityCount: effectivePlan.designComplexityCount,
          bucketedContemplacionIds: effectivePlan.bucketedContemplacionIds
        }
      };

      // R1: Log request payload with full details
      const assignmentsByVersion = {
        A: Object.values(effectivePlan.assignmentByStudentId).filter(v => v === 'A').length,
        B: Object.values(effectivePlan.assignmentByStudentId).filter(v => v === 'B').length,
        C: Object.values(effectivePlan.assignmentByStudentId).filter(v => v === 'C').length
      };
      
      console.info('[EVAL_PIPELINE] payload', {
        generation_mode: requestBody.generation_mode,
        triggers: effectivePlan.triggers,
        responseOptions: {
          include: effectivePlan.responseOptions.include,
          optionCount: effectivePlan.responseOptions.optionCount
        },
        assignmentsByVersion
      });
      
      // DEBUG: Log request payload summary
      const requestSummary = {
        generationMode: requestBody.generation_mode,
        hasEvaluationDesignPlan: !!requestBody.evaluation_design_plan,
        hasGenerationContext: !!requestBody.generation_context,
        triggers: effectivePlan.triggers,
        responseOptionsInclude: effectivePlan.responseOptions.include,
        assignmentsCount: Object.keys(effectivePlan.assignmentByStudentId).length
      };
      console.info('[EVAL_PIPELINE] Request payload summary:', requestSummary);
      
      if (showDebugPanel) {
        setPipelineDebug(prev => ({
          ...prev,
          lastRequest: requestSummary
        }));
      }

      // ENFORCE: Clear any previous errors
      setGenerationError(null);
      
      // Clear previous v2 response
      setV2RawResponse(null);
      
      // =======================================================================
      // V2 MODE: Call modify-evaluation-v2 if beta toggle is enabled
      // =======================================================================
      let data: any = null;
      let error: any = null;
      let usedV2Endpoint = false;
      
      if (useBetaV2) {
        console.info('[EVAL_PIPELINE] V2 Beta enabled, invoking modify-evaluation-v2 edge function');
        
        const v2RequestBody = {
          modification: modificationText,
          groupContext,
          evaluation_design_plan: {
            instrumentDesignRules,
            responseOptions: effectivePlan.responseOptions,
            triggers: effectivePlan.triggers,
            assignmentByStudentId: effectivePlan.assignmentByStudentId,
            perStudentReminders: effectivePlan.perStudentReminders,
            varkDistribution: effectivePlan.varkDistribution,
            highStructureNeed: effectivePlan.highStructureNeed,
            designComplexityCount: effectivePlan.designComplexityCount,
            bucketedContemplacionIds: effectivePlan.bucketedContemplacionIds
          }
        };
        
        const v2Result = await supabase.functions.invoke('modify-evaluation-v2', {
          body: v2RequestBody
        });
        
        if (v2Result.error) {
          console.warn('[EVAL_PIPELINE] V2 endpoint error, falling back to V1:', v2Result.error.message);
          // Fallback to V1 below
        } else if (!v2Result.data) {
          console.warn('[EVAL_PIPELINE] V2 returned no data, falling back to V1');
          // Fallback to V1 below
        } else if (!v2Result.data.success) {
          // DETAILED DEBUG: Log full failure info from V2
          console.warn('[EVAL_PIPELINE] ══════════════════════════════════════════════════════════');
          console.warn('[EVAL_PIPELINE] V2 returned success=false, falling back to V1');
          console.warn('[EVAL_PIPELINE] ══════════════════════════════════════════════════════════');
          console.warn('[EVAL_PIPELINE] warnings:', JSON.stringify(v2Result.data.warnings, null, 2));
          console.warn('[EVAL_PIPELINE] debug:', JSON.stringify(v2Result.data.debug, null, 2));
          console.warn('[EVAL_PIPELINE] requestedVersions:', v2Result.data.requestedVersions);
          console.warn('[EVAL_PIPELINE] hasEvaluationSpec:', !!v2Result.data.evaluationSpec);
          // Fallback to V1 below
        } else {
          // V2 succeeded! Store raw response for V2 renderer
          console.info('[EVAL_PIPELINE] V2 response received successfully');
          const v2Response = v2Result.data as V2Response;
          
          // DEBUG: Log full V2 response structure
          console.log('[EVAL_PIPELINE] V2 Response structure:', {
            success: v2Response.success,
            hasEvaluationSpec: !!v2Response.evaluationSpec,
            evaluationSpecVersion: v2Response.evaluationSpec?.version,
            sectionsCount: v2Response.evaluationSpec?.sections?.length,
            firstSectionTitle: v2Response.evaluationSpec?.sections?.[0]?.title,
            firstSectionItemsCount: v2Response.evaluationSpec?.sections?.[0]?.items?.length,
            requestedVersions: v2Response.requestedVersions,
            hasAiReport: !!v2Response.aiReport,
            teacherRemindersCount: v2Response.teacherRemindersByStudent?.length,
            warningsCount: v2Response.warnings?.length
          });
          
          setV2RawResponse(v2Response);
          usedV2Endpoint = true;
          
          // Auto-collapse configuration panel after successful V2 generation
          setIsConfigCollapsed(true);
          
          // Convert V2 to V1-compatible format for state management
          // (evaluationBundle, studentAssignments, etc. are still used by other parts)
          data = {
            evaluationBundle: {
              versions: { A: '', B: null, C: null }, // V2 renders directly from JSON
              baseHtml: '',
              versionBHtml: null,
              versionCHtml: null,
              responseOptionsIncluded: v2Response.aiReport?.responseOptions?.included ?? false,
              responseOptionCount: v2Response.aiReport?.responseOptions?.count ?? 2
            },
            aiReport: v2Response.aiReport,
            studentAssignments: {}, // V2 manages this internally
            teacherRemindersByStudent: v2Response.teacherRemindersByStudent,
            warnings: v2Response.warnings?.map(w => w.message) || [],
            _v2Mode: true // Flag to skip v1 validation
          };
        }
      }
      
      // =======================================================================
      // V1 MODE: Call modify-evaluation (default or fallback)
      // =======================================================================
      if (!usedV2Endpoint) {
        console.info('[EVAL_PIPELINE] Invoking modify-evaluation edge function (V1)');
        const v1Result = await supabase.functions.invoke('modify-evaluation', {
          body: requestBody
        });
        data = v1Result.data;
        error = v1Result.error;
      }

      if (error) {
        console.error('[EVAL_PIPELINE] Edge function error:', error);
        // ENFORCE: Set visible error state before throwing
        const errorMessage = error.message || 'Error desconocido al llamar al servidor';
        const errorStatus = (error as any).status || '';
        setGenerationError({
          message: 'No se pudo generar la evaluación',
          details: `${errorMessage}${errorStatus ? ` (Código: ${errorStatus})` : ''}`,
          show: true
        });
        throw error;
      }
      
      // ENFORCE: Verify that edge function was actually called and returned data
      if (!data) {
        console.error('[EVAL_PIPELINE] Edge function returned no data');
        setGenerationError({
          message: 'Error en la respuesta del servidor',
          details: 'El servidor no retornó datos. Por favor, intentá nuevamente.',
          show: true
        });
        throw new Error('Edge function returned no data');
      }

      // R4: Response integrity log
      console.info('[EVAL_PIPELINE] Edge function response received', {
        hasAiReport: !!data?.aiReport,
        hasEvaluationBundle: !!data?.evaluationBundle,
        hasVersions: {
          A: !!data?.evaluationBundle?.versions?.A,
          B: !!data?.evaluationBundle?.versions?.B,
          C: !!data?.evaluationBundle?.versions?.C
        },
        studentAssignmentsCount: Object.keys(data?.studentAssignments || {}).length
      });
      
      // R4: Detailed integrity log
      console.info('[EVAL_PIPELINE] Response integrity check', {
        responseKeys: Object.keys(data || {}),
        hasAiReport: !!data?.aiReport,
        aiReportKeys: data?.aiReport ? Object.keys(data.aiReport) : [],
        evaluationBundleKeys: data?.evaluationBundle ? Object.keys(data.evaluationBundle) : [],
        versionsKeys: data?.evaluationBundle?.versions ? Object.keys(data.evaluationBundle.versions) : [],
        versionALength: data?.evaluationBundle?.versions?.A?.length || 0,
        versionBLength: data?.evaluationBundle?.versions?.B?.length || 0,
        versionCLength: data?.evaluationBundle?.versions?.C?.length || 0,
        studentAssignmentsKeys: data?.studentAssignments ? Object.keys(data.studentAssignments) : []
      });

      // DEBUG: Log response summary
      const versionsGenerated: string[] = [];
      if (data?.evaluationBundle?.versions?.A) versionsGenerated.push('A');
      if (data?.evaluationBundle?.versions?.B) versionsGenerated.push('B');
      if (data?.evaluationBundle?.versions?.C) versionsGenerated.push('C');
      
      const responseSummary = {
        hasAiReport: !!data?.aiReport,
        hasEvaluationBundle: !!data?.evaluationBundle,
        versionsGenerated,
        warningsCount: Array.isArray(data?.warnings) ? data.warnings.length : 0,
        endpoint: 'modify-evaluation'
      };
      
      if (showDebugPanel) {
        setPipelineDebug(prev => ({
          ...prev,
          lastResponse: responseSummary
        }));
      }

      // R0: Normalizar studentAssignments del edge response
      // FIX: In V2 mode, edge function returns empty {}, so we must check for actual keys
      // Priority: 1) Edge response if has assignments, 2) effectivePlan.assignmentByStudentId
      const edgeAssignments = data?.studentAssignments as Record<string, 'A' | 'B' | 'C'> | undefined;
      const hasEdgeAssignments = edgeAssignments && Object.keys(edgeAssignments).length > 0;
      const rawAssignments = hasEdgeAssignments 
        ? edgeAssignments 
        : (effectivePlan.assignmentByStudentId || {});
      
      // DEBUG: Log assignment source decision
      console.info('[EVAL_PIPELINE] Assignment source:', {
        hasEdgeAssignments,
        edgeAssignmentsCount: Object.keys(edgeAssignments || {}).length,
        effectivePlanAssignmentsCount: Object.keys(effectivePlan.assignmentByStudentId || {}).length,
        usingSource: hasEdgeAssignments ? 'edge' : 'effectivePlan',
        rawAssignmentsCount: Object.keys(rawAssignments).length,
        rawAssignmentsSample: Object.entries(rawAssignments).slice(0, 3)
      });
      
      const normalizeAssignments = (
        assignments: Record<string, 'A' | 'B' | 'C'>,
        bundle: EvaluationBundle | null,
        isV2: boolean
      ) => {
        // In V2 mode, versions are determined by effectivePlan.triggers, not HTML content
        const available = isV2 
          ? {
              A: true,
              B: effectivePlan.triggers.versionB,
              C: effectivePlan.triggers.versionC
            }
          : {
              A: true,
              B: Boolean(bundle?.versionBHtml || bundle?.versions?.B),
              C: Boolean(bundle?.versionCHtml || bundle?.versions?.C)
            };
        
        // R0: Normalizar todas las keys a strings
        const normalized: Record<string, 'A' | 'B' | 'C'> = {};
        Object.entries(assignments).forEach(([key, value]) => {
          normalized[String(key)] = value;
        });
        const warnings: string[] = [];
        Object.entries(normalized).forEach(([studentId, version]) => {
          if (!available[version]) {
            normalized[studentId] = 'A';
            warnings.push(`Se reasignó ${studentId} a Versión A porque ${version} no fue generada.`);
          }
        });
        return { normalized, warnings };
      };

      setEvaluationDesignPlan(effectivePlan);

      // R3: Build generatedEvaluations from evaluationBundle.versions (A, B, C)
      // R5: Remove silent fallback - if critical fields missing, show error
      // V2 MODE: Skip version A check - V2 uses JSON rendering, not HTML
      const isV2Mode = data?._v2Mode === true;
      const hasVersionA = isV2Mode || Boolean(
        data?.evaluationBundle?.versions?.A || 
        data?.evaluationBundle?.baseHtml
      );
      
      if (!hasVersionA) {
        console.error('[EVAL_PIPELINE] Response missing Version A (critical field)');
        setGenerationError({
          message: 'Error en la respuesta del servidor',
          details: 'La respuesta no contiene la versión A de la evaluación. Por favor, intentá nuevamente.',
          show: true
        });
        toast({
          title: "Error crítico",
          description: "La respuesta del servidor no contiene la versión A de la evaluación.",
          variant: "destructive"
        });
        setIsGenerating(false);
        return;
      }

      // Backend guarantees HTML strings that start with "<"
      // No parsing, no transformation, no validation needed
      
      // STEP 3: Frontend DUMB - accept versions.* as strings from backend (no parsing)
      const versionA = data.evaluationBundle?.versions?.A || data.evaluationBundle?.baseHtml || '';
      const versionB = data.evaluationBundle?.versions?.B ?? data.evaluationBundle?.versionBHtml ?? null;
      const versionC = data.evaluationBundle?.versions?.C ?? data.evaluationBundle?.versionCHtml ?? null;
      
      // STEP 3: Type validation - if not string, log CRITICAL error
      if (versionA && typeof versionA !== 'string') {
        console.error('[EVAL_PIPELINE] CRITICAL: versionA from backend is not string!', typeof versionA, versionA);
      }
      if (versionB && typeof versionB !== 'string') {
        console.error('[EVAL_PIPELINE] CRITICAL: versionB from backend is not string!', typeof versionB, versionB);
      }
      if (versionC && typeof versionC !== 'string') {
        console.error('[EVAL_PIPELINE] CRITICAL: versionC from backend is not string!', typeof versionC, versionC);
      }
      
      const evaluationBundleToSet: EvaluationBundle = {
        baseHtml: typeof versionA === 'string' ? versionA : '',
        versionBHtml: typeof versionB === 'string' ? versionB : null,
        versionCHtml: typeof versionC === 'string' ? versionC : null,
        versions: {
          A: typeof versionA === 'string' ? versionA : '',
          B: typeof versionB === 'string' ? versionB : null,
          C: typeof versionC === 'string' ? versionC : null
        },
        responseOptionsIncluded: data.evaluationBundle?.responseOptionsIncluded ?? false,
        responseOptionCount: data.evaluationBundle?.responseOptionCount ?? 2,
        finalAssignmentCounts: data.finalAssignmentCounts // STEP 2: Store finalAssignmentCounts from backend
      };
      
      setEvaluationBundle(evaluationBundleToSet);
      setGeneratedEvaluations([]); // R3: Use displayEvaluations computed from evaluationBundle
      
      const normalizedResult = normalizeAssignments(rawAssignments, evaluationBundleToSet, isV2Mode);
      setStudentAssignments(normalizedResult.normalized);
      
      // DEBUG: Log final assignment result
      console.info('[EVAL_PIPELINE] Final assignments:', {
        isV2Mode,
        assignmentsCount: Object.keys(normalizedResult.normalized).length,
        byVersion: {
          A: Object.values(normalizedResult.normalized).filter(v => v === 'A').length,
          B: Object.values(normalizedResult.normalized).filter(v => v === 'B').length,
          C: Object.values(normalizedResult.normalized).filter(v => v === 'C').length
        },
        warningsCount: normalizedResult.warnings.length
      });
      
      const edgeWarnings = Array.isArray(data?.warnings) ? data.warnings : [];
      setAssignmentWarnings([...edgeWarnings, ...normalizedResult.warnings]);

      // STEP 4: Teacher reminders must come from backend teacherRemindersByStudent ONLY
      // If not available, show empty state (NOT fallback to perStudentReminders which is for students)
      const reminders = Array.isArray(data?.teacherRemindersByStudent) && data.teacherRemindersByStudent.length > 0
        ? data.teacherRemindersByStudent
        : [];
      setTeacherReminders(reminders);
      
      // STEP 4b: Check for missing template errors from design plan validation
      const validationResult = effectivePlan._reminderValidation;
      if (validationResult?.missingTemplates && validationResult.missingTemplates.length > 0) {
        console.error('[EVAL_PIPELINE] Missing reminder templates detected:', validationResult.missingTemplates);
        setMissingTemplateErrors(validationResult.missingTemplates);
      } else {
        setMissingTemplateErrors([]);
      }
      
      if (!Array.isArray(data?.teacherRemindersByStudent) || data.teacherRemindersByStudent.length === 0) {
        console.warn('[EVAL_PIPELINE] No teacher reminders available from backend, showing empty state');
      }

      if (data?.estimatedTotalMinutes) {
        setEstimatedDurationMinutes(data.estimatedTotalMinutes);
      } else {
        setEstimatedDurationMinutes(null);
      }

      if (data?.timeBreakdown) {
        setTimeBreakdown({
          sections: data.timeBreakdown,
          heuristicAssumptions: 'Estimación generada por IA basada en el tipo y cantidad de items'
        });
      } else {
        setTimeBreakdown(null);
      }

      // PATCH 6: Leer data.aiReport primero, luego legacy aiDesignReport
      if (data?.aiReport) {
        console.info('[EVAL_PIPELINE] Using aiReport from response');
        setAiDesignReport(JSON.stringify(data.aiReport));
      } else if (data?.aiDesignReport) {
        console.warn('[EVAL_PIPELINE] Falling back to aiDesignReport (legacy)');
        setAiDesignReport(JSON.stringify(data.aiDesignReport));
      } else {
        console.warn('[EVAL_PIPELINE] No aiReport or aiDesignReport in response');
        setAiDesignReport(null);
      }
      
      console.info('[EVAL_PIPELINE] Generation completed successfully');
      
      // R2: Verify that edge function returned aiReport and evaluationBundle.versions
      // V2 MODE: Skip evaluationBundle check - V2 uses JSON rendering
      if (!isV2Mode && !data?.evaluationBundle) {
        console.error('[EVAL_PIPELINE] Response missing evaluationBundle');
        setGenerationError({
          message: 'Error en la respuesta del servidor',
          details: 'La respuesta no contiene evaluationBundle. El servidor puede no haber procesado la solicitud correctamente.',
          show: true
        });
        toast({
          title: "Error en la respuesta",
          description: "La respuesta del servidor no contiene evaluationBundle. Por favor, intentá nuevamente.",
          variant: "destructive"
        });
        setIsGenerating(false);
        return;
      }
      
      // R2: Verify aiReport is present (should always be non-null from universal path)
      // V2 MODE: aiReport is guaranteed by v2Response, so skip strict check
      if (!isV2Mode && !data?.aiReport) {
        console.error('[EVAL_PIPELINE] Response missing aiReport (critical field)');
        setGenerationError({
          message: 'Error en la respuesta del servidor',
          details: 'La respuesta no contiene aiReport. La evaluación no se puede guardar correctamente.',
          show: true
        });
        toast({
          title: "Error crítico",
          description: "La respuesta del servidor no contiene aiReport. Por favor, intentá nuevamente.",
          variant: "destructive"
        });
        setIsGenerating(false);
        return;
      }
      
      // ENFORCE: Clear error state on success
      setGenerationError(null);
      
      // Auto-collapse configuration panel after successful generation (V1)
      setIsConfigCollapsed(true);
      
      setActiveTab('results');
    } catch (error: any) {
      console.error('[EVAL_PIPELINE] Error generating evaluations:', error);
      
      // ENFORCE: Show visible error instead of silent fallback
      let errorMessage = "No se pudo generar la evaluación. Por favor, intentá nuevamente.";
      let errorDetails = "";
      
      if (error?.message) {
        if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          errorMessage = "Error de conexión";
          errorDetails = "No se pudo conectar con el servidor. Verificá tu conexión a internet e intentá nuevamente.";
        } else if (error.message.includes('auth') || error.message.includes('401') || error.message.includes('403')) {
          errorMessage = "Error de autenticación";
          errorDetails = "Tu sesión expiró o no tenés permisos. Por favor, iniciá sesión nuevamente.";
        } else if (error.message.includes('timeout') || error.message.includes('504')) {
          errorMessage = "Tiempo de espera agotado";
          errorDetails = "El servidor tardó demasiado en responder. Intentá nuevamente.";
        } else {
          errorDetails = error.message;
        }
      }
      
      if (error?.status) {
        errorDetails = `${errorDetails} (Código: ${error.status})`;
      }
      
      toast({
        title: errorMessage,
        description: errorDetails || "Ocurrió un error inesperado al generar la evaluación.",
        variant: "destructive",
        duration: 10000
      });
      
      // ENFORCE: Do NOT use silent fallback - clear state instead
      setGeneratedEvaluations([]);
      setEvaluationBundle(null);
      setEvaluationDesignPlan(null);
      setStudentAssignments({});
      setTeacherReminders([]);
      setMissingTemplateErrors([]);
      setAssignmentWarnings([]);
      setAiDesignReport(null);
      setV2RawResponse(null); // Clear V2 response on error
      
      // ENFORCE: Set visible error state (already set above, but ensure it's visible)
      if (!generationError) {
        setGenerationError({
          message: errorMessage,
          details: errorDetails,
          show: true
        });
      }
      
      // Update debug panel if enabled
      if (showDebugPanel) {
        setPipelineDebug(prev => ({
          ...prev,
          lastResponse: {
            hasAiReport: false,
            hasEvaluationBundle: false,
            versionsGenerated: [],
            warningsCount: 0,
            endpoint: 'modify-evaluation',
            error: errorMessage + (errorDetails ? `: ${errorDetails}` : '')
          }
        }));
      }
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

  // R0: Helper para normalizar IDs de estudiantes en todos lados
  const sid = (s: any): string => String(s?.studentId ?? s?.id ?? s?.student_id ?? '');

  /**
   * Simple HTML guard for evaluation versions.
   * Frontend should trust evaluationBundle.versions.* (backend guarantee).
   */
  const isHtmlString = (value: any): value is string =>
    typeof value === 'string' && value.trim().startsWith('<');

  const displayEvaluations = useMemo(() => {
    if (!evaluationBundle?.baseHtml && !evaluationBundle?.versions?.A) {
      return generatedEvaluations;
    }

    // R0: Normalizar assignmentByStudentId keys
    const rawAssignments = Object.keys(studentAssignments).length > 0
      ? studentAssignments
      : (evaluationDesignPlan?.assignmentByStudentId || {});
    
    // Normalizar todas las keys a strings consistentes
    const assignmentByStudentId: Record<string, 'A' | 'B' | 'C'> = {};
    Object.entries(rawAssignments).forEach(([key, value]) => {
      assignmentByStudentId[String(key)] = value;
    });

    const students = selectedGroup?.students || [];
    
    // R0: Usar sid() helper para normalizar IDs en todas las comparaciones
    const getAssigned = (kind: 'A' | 'B' | 'C') => {
      const assigned = students.filter(student => {
        const normalizedId = sid(student);
        return assignmentByStudentId[normalizedId] === kind;
      });
      return {
        ids: assigned.map(student => sid(student)),
        names: assigned.map(student => student.name || `Estudiante ${sid(student)}`)
      };
    };

    // STEP 2: Use finalAssignmentCounts from backend (after B may have been dropped)
    // If not available, calculate from assignments (legacy/fallback)
    const backendFinalCounts = evaluationBundle?.finalAssignmentCounts;
    const assignmentCounts = backendFinalCounts ?? {
      A: Object.values(assignmentByStudentId).filter(v => v === 'A').length,
      B: Object.values(assignmentByStudentId).filter(v => v === 'B').length,
      C: Object.values(assignmentByStudentId).filter(v => v === 'C').length
    };
    
    // STEP 3: Log assignment counts for debugging
    console.log('[UI_ASSIGNMENT_COUNTS]', {
      backendFinalCounts,
      calculated: {
        A: Object.values(assignmentByStudentId).filter(v => v === 'A').length,
        B: Object.values(assignmentByStudentId).filter(v => v === 'B').length,
        C: Object.values(assignmentByStudentId).filter(v => v === 'C').length
      },
      final: assignmentCounts
    });

    // STEP 4: Frontend - remove any parsing, only accept string HTML
    const versions = evaluationBundle?.versions ?? null;
    const legacyA = !versions
      ? (evaluationBundle?.baseHtml || evaluationBundle?.base_html || evaluationBundle?.content || evaluationBundle?.html || null)
      : null;
    
    // STEP 4: Cards must use ONLY versions.<key> (no multi-layer extraction)
    let rawA = versions ? (versions.A ?? null) : legacyA;
    let rawB = versions ? (versions.B ?? null) : null;
    let rawC = versions ? (versions.C ?? null) : null;

    // STEP 4: If typeof rawA/B/C !== 'string' → error block (and log)
    if (rawA && typeof rawA !== 'string') {
      console.error('[EVAL_UI] CRITICAL: rawA is not a string, it is:', typeof rawA, rawA);
      rawA = null; // Will trigger error block below
    }
    if (rawB && typeof rawB !== 'string') {
      console.error('[EVAL_UI] CRITICAL: rawB is not a string, it is:', typeof rawB, rawB);
      rawB = null;
    }
    if (rawC && typeof rawC !== 'string') {
      console.error('[EVAL_UI] CRITICAL: rawC is not a string, it is:', typeof rawC, rawC);
      rawC = null;
    }
    
    // Backend guarantees HTML strings that start with "<"
    // No wrapper detection, no JSON parsing, no transformation
    // If it starts with "{", show error HTML (defensive - backend should never send this)
    // If it starts with "<", it's HTML final and use it as-is
    const getSafeHtml = (value: unknown, key: string): string | null => {
      if (!value || typeof value !== 'string') return null;
      const trimmed = value.trim();
      // Defensive: if starts with "{", show error HTML (NO JSON.parse attempt)
      if (trimmed.startsWith('{')) {
        console.error(`[EVAL_UI] Backend returned JSON wrapper in Version ${key} - showing error HTML`);
        return `<div class="evaluation"><p><strong>Error:</strong> El backend devolvió un wrapper JSON inválido en versión ${key}.</p></div>`;
      }
      // If starts with "<", it's HTML final
      if (trimmed.startsWith('<')) {
        return trimmed;
      }
      return null;
    };

    const htmlA = getSafeHtml(rawA, 'A');
    const htmlB = getSafeHtml(rawB, 'B');
    const htmlC = getSafeHtml(rawC, 'C');
    
    // STEP 4: Console logs for debugging (informative only, no defensive checks)
    console.log('[UI_VERSIONS_RAW]', {
      A: { 
        type: typeof rawA, 
        isString: typeof rawA === 'string',
        startsWithHtml: typeof rawA === 'string' && rawA.trim().startsWith('<'),
        start: typeof rawA === 'string' ? rawA.slice(0, 40) : '(not string)', 
        len: typeof rawA === 'string' ? rawA.length : 0
      },
      B: { 
        type: typeof rawB, 
        isString: typeof rawB === 'string',
        startsWithHtml: typeof rawB === 'string' && rawB.trim().startsWith('<'),
        start: typeof rawB === 'string' ? rawB.slice(0, 40) : '(not string)', 
        len: typeof rawB === 'string' ? rawB.length : 0
      },
      C: { 
        type: typeof rawC, 
        isString: typeof rawC === 'string',
        startsWithHtml: typeof rawC === 'string' && rawC.trim().startsWith('<'),
        start: typeof rawC === 'string' ? rawC.slice(0, 40) : '(not string)', 
        len: typeof rawC === 'string' ? rawC.length : 0
      },
      assignmentCounts
    });
    
    // PHASE 2B: Build cards with hard assertions (no mutation, no reuse)
    const evaluations: GeneratedEvaluation[] = [];
    
    // STEP 3: B card must be hidden if finalAssignmentCounts.B === 0 (even if triggers.versionB was initially true)
    // Backend may have dropped B if no students were assigned to it after reassignment
    const shouldShowB = assignmentCounts.B > 0;

    // PHASE 2: Card A - always shown
    const baseAssigned = getAssigned('A');
    const contentA = htmlA || '<div class="p-4 bg-red-50 border-2 border-red-400 rounded"><strong>Error:</strong> Version A missing. No se pudo extraer el contenido de la versión A.</div>';
    
    if (!htmlA) {
      console.error('[EVAL_UI] Version A missing after extraction', {
        rawA: String(rawA || '').slice(0, 50),
        hasEvaluationBundle: !!evaluationBundle
      });
    }
    
    evaluations.push({
      id: 'A',
      title: 'Versión A (Universal)',
      content: contentA,
      version: 1,
      versionKind: 'A',
      versionLabel: 'Versión A (Universal)',
      adaptations: [],
      assignedStudents: baseAssigned.names,
      assignedStudentIds: baseAssigned.ids
    });

    // PHASE 2: Card B - only if assigned or forced
    if (shouldShowB) {
      const assigned = getAssigned('B');
      const contentB = htmlB || '<div class="p-4 bg-red-50 border-2 border-red-400 rounded"><strong>Error:</strong> Version B required but missing. No se pudo extraer el contenido de la versión B.</div>';
      
      evaluations.push({
        id: 'B',
        title: 'Versión B (Equivalente)',
        content: contentB,
        version: 2,
        versionKind: 'B',
        versionLabel: 'Versión B (Equivalente)',
        adaptations: [],
        assignedStudents: assigned.names,
        assignedStudentIds: assigned.ids
      });
    }

    // PHASE 2: Card C - only if C is assigned
    if (assignmentCounts.C > 0) {
      const assigned = getAssigned('C');
      const contentC = htmlC || '<div class="p-4 bg-red-50 border-2 border-red-400 rounded"><strong>Error:</strong> Version C required but missing. No se pudo extraer el contenido de la versión C.</div>';
      
      if (!htmlC) {
        console.error('[EVAL_UI] Version C required but missing after extraction', {
          rawC: String(rawC || '').slice(0, 50),
          hasEvaluationBundle: !!evaluationBundle
        });
      }
      
      evaluations.push({
        id: 'C',
        title: 'Versión C (Adecuación de contenido)',
        content: contentC,
        version: 3,
        versionKind: 'C',
        versionLabel: 'Versión C (Adecuación de contenido)',
        adaptations: [],
        assignedStudents: assigned.names,
        assignedStudentIds: assigned.ids
      });
    }

    // PHASE 1: Log card content for debugging (after build)
    console.log('[UI_CARDS_BUILT]', evaluations.map(e => ({
      id: e.id,
      contentStart: e.content.slice(0, 40),
      contentLen: e.content.length
    })));

    return evaluations;
  }, [evaluationBundle, evaluationDesignPlan, generatedEvaluations, selectedGroup, studentAssignments]);

  // PHASE 1A: UI Version Integrity Panel (dev/flag only)
  const debugRawAssignments = Object.keys(studentAssignments).length > 0
    ? studentAssignments
    : (evaluationDesignPlan?.assignmentByStudentId || {});
  const debugAssignmentCounts = {
    A: Object.values(debugRawAssignments).filter(v => v === 'A').length,
    B: Object.values(debugRawAssignments).filter(v => v === 'B').length,
    C: Object.values(debugRawAssignments).filter(v => v === 'C').length
  };
  const debugVersions = evaluationBundle?.versions ?? null;
  const debugLegacyA = !debugVersions
    ? (evaluationBundle?.baseHtml || evaluationBundle?.base_html || evaluationBundle?.content || evaluationBundle?.html || null)
    : null;
  const debugA = debugVersions ? debugVersions.A ?? null : debugLegacyA;
  const debugB = debugVersions ? debugVersions.B ?? null : null;
  const debugC = debugVersions ? debugVersions.C ?? null : null;
  
  // PHASE 1: Compute diff-style checks (card content vs source versions)
  const cardA = displayEvaluations.find(e => e.id === 'A');
  const cardB = displayEvaluations.find(e => e.id === 'B');
  const cardC = displayEvaluations.find(e => e.id === 'C');
  
  const diffCheckA = cardA && debugA ? (cardA.content === debugA) : null;
  const diffCheckB = cardB && debugB ? (cardB.content === debugB) : null;
  const diffCheckC = cardC && debugC ? (cardC.content === debugC) : null;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50 p-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">Volver</Button>
          <h1 className="text-3xl font-bold text-gray-800">Generar evaluaciones para el grupo</h1>
        </motion.div>

        {/* ENFORCE: Error banner for generation failures */}
        {generationError?.show && (
          <Card className="mb-6 border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {generationError.message}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-700 dark:text-red-300">
                {generationError.details || 'Ocurrió un error inesperado al generar la evaluación.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setGenerationError(null)}
              >
                Cerrar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Configuration Panel - Collapsible after generation */}
        <Collapsible open={!isConfigCollapsed} onOpenChange={(open) => setIsConfigCollapsed(!open)}>
          <Card className="mb-8 border-2 border-green-200 bg-white/80">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-green-700">Configuración</CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {isConfigCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
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

            {/* FIX: Help text for materials-only generation */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                💡 Podés generar usando solo materiales docentes (sin ANEP). También podés combinar: ANEP + materiales, o sesiones + materiales.
              </p>
            </div>
            
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
              
              {/* PHASE 4: Beta V2 Toggle */}
              <div className="flex items-center justify-between py-3 px-4 bg-muted/50 rounded-lg">
                <BetaToggle 
                  onChange={(enabled) => setUseBetaV2(enabled)}
                  showHelperText={true}
                />
              </div>
              
              <Button 
                onClick={handleGenerateEvaluations} 
                disabled={
                  isGenerating || requestInProgress || !selectedGroupId || 
                  (!esInterdisciplinaria && !materia) || 
                  (esInterdisciplinaria && materiasSeleccionadas.length === 0) || 
                  // FIX: Allow generation if ANY of: ANEP content, sessions, OR materials
                  (!hasAnepContent && !hasSessions && !hasMaterials)
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
                Se generará una evaluación universal; versiones B/C solo si se cumplen condiciones deterministas
              </p>
              
              {/* DEBUG: Pipeline debug panel (only visible when VITE_DEBUG_EVAL_PIPELINE=true) */}
              {showDebugPanel && (pipelineDebug.lastRequest || pipelineDebug.lastResponse) && (
                <Card className="mt-4 border-2 border-blue-300 bg-blue-50 dark:bg-blue-950/20">
                  <CardHeader>
                    <CardTitle className="text-sm text-blue-800 dark:text-blue-200">
                      🔍 Debug: Pipeline de Generación
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    {pipelineDebug.lastRequest && (
                      <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Último Request:</h4>
                        <ul className="list-disc pl-5 space-y-1 text-blue-800 dark:text-blue-200">
                          <li>Endpoint: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">modify-evaluation</code></li>
                          <li>Generation Mode: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{pipelineDebug.lastRequest.generationMode}</code></li>
                          <li>Has evaluation_design_plan: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{pipelineDebug.lastRequest.hasEvaluationDesignPlan ? '✅ Sí' : '❌ No'}</code></li>
                          <li>Has generation_context: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{pipelineDebug.lastRequest.hasGenerationContext ? '❌ Sí (ERROR)' : '✅ No'}</code></li>
                          <li>Triggers: versionB={pipelineDebug.lastRequest.triggers.versionB ? '✅' : '❌'}, versionC={pipelineDebug.lastRequest.triggers.versionC ? '✅' : '❌'}</li>
                          <li>Response Options Include: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{pipelineDebug.lastRequest.responseOptionsInclude ? '✅ Sí' : '❌ No'}</code></li>
                          <li>Assignments Count: {pipelineDebug.lastRequest.assignmentsCount}</li>
                        </ul>
                      </div>
                    )}
                    {pipelineDebug.lastResponse && (
                      <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Último Response:</h4>
                        <ul className="list-disc pl-5 space-y-1 text-blue-800 dark:text-blue-200">
                          <li>Endpoint: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{pipelineDebug.lastResponse.endpoint}</code></li>
                          <li>Has aiReport: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{pipelineDebug.lastResponse.hasAiReport ? '✅ Sí' : '❌ No'}</code></li>
                          <li>Has evaluationBundle: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{pipelineDebug.lastResponse.hasEvaluationBundle ? '✅ Sí' : '❌ No'}</code></li>
                          <li>Versions Generated: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{pipelineDebug.lastResponse.versionsGenerated.length > 0 ? pipelineDebug.lastResponse.versionsGenerated.join(', ') : 'Ninguna'}</code></li>
                          <li>Warnings Count: {pipelineDebug.lastResponse.warningsCount}</li>
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
        </Card>
        </Collapsible>

        {/* Show results section if we have V1 evaluations OR V2 response */}
        {(displayEvaluations.length > 0 || (useBetaV2 && v2RawResponse)) && (
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

                {/* PHASE 1A: Version Integrity Panel (only visible when VITE_DEBUG_EVAL_PIPELINE=true) */}
                {showDebugPanel && (
                  <Card className="mb-6 border-2 border-purple-300 bg-purple-50 dark:bg-purple-950/20">
                    <CardHeader>
                      <CardTitle className="text-sm text-purple-800 dark:text-purple-200">
                        [UI_VERSION_DEBUG] - Forensic Panel
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs font-mono space-y-3">
                      <div className="font-bold text-purple-900">RAW API BUNDLE FIELDS:</div>
                      <div className={typeof debugA !== 'string' && debugA !== null ? 'text-red-600 font-bold' : ''}>
                        A: type={typeof debugA} {typeof debugA === 'object' && debugA !== null ? `keys=[${Object.keys(debugA).join(',')}]` : ''} start="{String(debugA ?? '').slice(0, 40)}" len={String(debugA ?? '').length}
                      </div>
                      <div className={typeof debugB !== 'string' && debugB !== null ? 'text-red-600 font-bold' : ''}>
                        B: type={typeof debugB} {typeof debugB === 'object' && debugB !== null ? `keys=[${Object.keys(debugB).join(',')}]` : ''} start="{String(debugB ?? '').slice(0, 40)}" len={String(debugB ?? '').length}
                      </div>
                      <div className={typeof debugC !== 'string' && debugC !== null ? 'text-red-600 font-bold' : ''}>
                        C: type={typeof debugC} {typeof debugC === 'object' && debugC !== null ? `keys=[${Object.keys(debugC).join(',')}]` : ''} start="{String(debugC ?? '').slice(0, 40)}" len={String(debugC ?? '').length}
                      </div>
                      <div>assignmentCounts: A={debugAssignmentCounts.A}, B={debugAssignmentCounts.B}, C={debugAssignmentCounts.C}</div>
                      <div>renderSource: A={debugVersions ? 'versions.A' : 'legacy'}, B={debugVersions ? 'versions.B' : 'null'}, C={debugVersions ? 'versions.C' : 'null'}</div>
                      
                      {(typeof debugA === 'object' && debugA !== null) || (typeof debugB === 'object' && debugB !== null) || (typeof debugC === 'object' && debugC !== null) && (
                        <div className="mt-2 p-2 bg-red-100 border-2 border-red-500 rounded text-red-800 font-bold text-xs">
                          ⚠️ BACKEND BUG: versions.* contains OBJECTS instead of strings!
                        </div>
                      )}
                      
                      <div className="font-bold text-purple-900 mt-4 pt-4 border-t border-purple-200">CARD CONTENT (FINAL):</div>
                      {cardA && (
                        <div>cardA.content: start="{cardA.content.slice(0, 40)}" len={cardA.content.length}</div>
                      )}
                      {cardB && (
                        <div>cardB.content: start="{cardB.content.slice(0, 40)}" len={cardB.content.length}</div>
                      )}
                      {cardC && (
                        <div>cardC.content: start="{cardC.content.slice(0, 40)}" len={cardC.content.length}</div>
                      )}
                      
                      <div className="font-bold text-purple-900 mt-4 pt-4 border-t border-purple-200">DIFF-STYLE CHECK:</div>
                      <div className={diffCheckA === false ? 'text-red-600 font-bold' : ''}>
                        cardA.content === versions.A: {diffCheckA === null ? 'N/A' : (diffCheckA ? '✅ TRUE' : '❌ FALSE')}
                      </div>
                      {cardB && (
                        <div className={diffCheckB === false ? 'text-red-600 font-bold' : ''}>
                          cardB.content === versions.B: {diffCheckB === null ? 'N/A' : (diffCheckB ? '✅ TRUE' : '❌ FALSE')}
                        </div>
                      )}
                      {cardC && (
                        <div className={diffCheckC === false ? 'text-red-600 font-bold' : ''}>
                          cardC.content === versions.C: {diffCheckC === null ? 'N/A' : (diffCheckC ? '✅ TRUE' : '❌ FALSE')}
                        </div>
                      )}
                      
                      {(diffCheckA === false || diffCheckB === false || diffCheckC === false) && (
                        <div className="mt-4 p-3 bg-red-100 border-2 border-red-500 rounded text-red-800 font-bold">
                          🚨 BIG RED FLAG: CARD CONTENT DOES NOT MATCH VERSIONS SOURCE
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ============================================================ */}
                {/* V2 MODE: Use V2InfoPanels + EvaluationRendererV2             */}
                {/* ============================================================ */}
                {useBetaV2 && v2RawResponse ? (
                  <>
                    {/* V2 Info Panels - consumes V2Response data directly */}
                    <V2InfoPanels 
                      v2Response={v2RawResponse}
                      students={selectedGroup?.students || []}
                      studentAssignments={studentAssignments}
                    />
                    
                    {/* V2 Evaluation Content Renderer */}
                    <EvaluationRendererV2
                      v2Response={v2RawResponse}
                      selectedVersion={v2SelectedVersion}
                      onVersionChange={setV2SelectedVersion}
                      isLoading={isGenerating}
                      showDebug={showDebugPanel}
                      onRenderError={(reason) => {
                        console.warn('[EVAL_PIPELINE] V2 render error, using V1 fallback:', reason);
                        setV2RawResponse(null);
                        toast({
                          title: "Usando formato estándar",
                          description: "El formato beta no está disponible, mostrando versión estándar.",
                          duration: 3000
                        });
                      }}
                    />
                    
                    {/* V2 Adjustments Panel - request refinements to generated content */}
                    <EvaluationAdjustmentsPanel
                      v2Response={v2RawResponse}
                      onAdjustmentApplied={(newResponse, previousResponse) => {
                        setPreviousV2Response(previousResponse);
                        setV2RawResponse(newResponse);
                      }}
                      previousResponse={previousV2Response}
                      onUndo={() => {
                        if (previousV2Response) {
                          setV2RawResponse(previousV2Response);
                          setPreviousV2Response(null);
                        }
                      }}
                      groupContext={{
                        subject: materia || (esInterdisciplinaria ? materiasSeleccionadas.join(', ') : undefined),
                        groupName: selectedGroup?.name,
                        content: selectedSubtemas,
                        competencies: selectedCompetenciasIds,
                        criteriosLogro: selectedCriteriosLogro,
                        students: selectedGroup?.students?.map(s => ({ studentId: s.id, displayName: s.name })),
                      }}
                      evaluationDesignPlan={evaluationDesignPlan as unknown as Record<string, unknown> | undefined}
                      isLoading={isGenerating}
                    />
                  </>
                ) : (
                  /* ============================================================ */
                  /* V1 MODE: Use v1 panels + EvaluacionVisualRenderer            */
                  /* ============================================================ */
                  <>
                    {/* V1: Assignment Warnings */}
                    {assignmentWarnings.length > 0 && (
                      <Card className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                        <CardHeader>
                          <CardTitle className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Ajustes automáticos de versiones
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc pl-5 text-sm text-amber-700 dark:text-amber-300">
                            {assignmentWarnings.map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* V1: Student Assignments Panel */}
                    {Object.keys(studentAssignments).length > 0 && (
                      <EvaluationAssignmentsPanel
                        assignments={studentAssignments}
                        students={selectedGroup?.students || []}
                      />
                    )}
                    
                    {/* V1: Teacher Reminders Panel */}
                    {(teacherReminders.length > 0 || missingTemplateErrors.length > 0) && (
                      <TeacherRemindersPanel 
                        reminders={teacherReminders} 
                        students={selectedGroup?.students || []}
                        missingTemplateErrors={missingTemplateErrors}
                      />
                    )}
                    
                    {/* V1: Evaluation Content Renderer (HTML-based) */}
                    {displayEvaluations.map((evaluation) => (
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
                    
                    {/* V1: AI Design Report */}
                    {aiDesignReport ? (
                      <AIDesignReport 
                        reportData={JSON.parse(aiDesignReport) as AIDesignReportData} 
                        className="mt-6"
                      />
                    ) : (
                      <Card className="mt-6 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                        <CardHeader>
                          <CardTitle className="text-sm text-amber-800 dark:text-amber-200">
                            Reporte de IA
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            El reporte de IA no está disponible para esta evaluación (legacy o generación previa).
                          </p>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* V1: Criterios de Logro */}
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
                  </>
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