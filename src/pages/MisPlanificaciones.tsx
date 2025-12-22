import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Search, BarChart3, Calendar, FileText, Download, Folder, Plus, AlertTriangle, TrendingUp, Share2, Clock, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Planificacion, SesionClase } from '@/types/planificacion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { generateRegistroCompetencialPDF } from '@/lib/registroCompetencialPDF';
import { uploadFileToStorage, createCommunicationMessage } from '@/lib/storage';
import { COMPETENCIAS_HISTORIA } from '@/data/competencias';
import { COMPETENCIAS_CIUDADANIA } from '@/data/competenciasCiudadania';
import { COMPETENCIAS_LITERATURA } from '@/data/competenciasLiteratura';
import { normalizeSubjectName } from '@/lib/subjectNormalizer';

interface CompetenciaCount {
  id: string;           // ID de la competencia
  competencia: string;   // ID de la competencia (alias)
  nombre: string;        // Nombre completo
  codigo: string;        // Código (CE1, CE2, etc.) o '—' para desconocidas
  count: number;
  porcentaje: number;
  label: string;         // Formatted label for chart: "CE# — Title" or "Unknown (id)"
}

interface CompetenciaPendiente {
  id: string;
  codigo: string;       // Código (CE1, CE2, etc.)
  nombre: string;
  descripcion: string;
}

const MisPlanificaciones: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [planificaciones, setPlanificaciones] = useState<Planificacion[]>([]);
  const [sesiones, setSesiones] = useState<SesionClase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroMateria, setFiltroMateria] = useState<string>('');
  const [filtroGrupo, setFiltroGrupo] = useState<string>('');
  const [filtroCarpeta, setFiltroCarpeta] = useState<string>('');
  const [fechaRange, setFechaRange] = useState<DateRange | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [carpetaModal, setCarpetaModal] = useState<{ open: boolean; planificacion: Planificacion | null }>({
    open: false,
    planificacion: null
  });
  const [nuevaCarpeta, setNuevaCarpeta] = useState('');
  const [compartirModal, setCompartirModal] = useState<{ 
    open: boolean; 
    planificacion: Planificacion | null;
    loading: boolean;
    direccion: boolean;
    psicopedagogico: boolean;
  }>({
    open: false,
    planificacion: null,
    loading: false,
    direccion: false,
    psicopedagogico: false
  });

  // State for multi-selection and delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Color palette for competencies (deterministic, stable)
  const COMPETENCY_COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#f97316', // orange
    '#ec4899', // pink
    '#14b8a6', // teal
    '#6366f1', // indigo
    '#84cc16', // lime
    '#eab308', // yellow
  ];

  // Deterministic color mapping: hash competency ID to palette index
  const getCompetencyColor = (competencyId: string): string => {
    // Simple hash function for deterministic color assignment
    let hash = 0;
    for (let i = 0; i < competencyId.length; i++) {
      hash = ((hash << 5) - hash) + competencyId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    const index = Math.abs(hash) % COMPETENCY_COLORS.length;
    return COMPETENCY_COLORS[index];
  };

  // Helper function to get competencies by subject
  const getCompetenciasByMateria = (materia: string) => {
    const normalized = normalizeSubjectName(materia);
    switch (normalized) {
      case 'Historia':
        return COMPETENCIAS_HISTORIA;
      case 'Literatura':
        return COMPETENCIAS_LITERATURA;
      case 'Formación para la ciudadanía':
        return COMPETENCIAS_CIUDADANIA;
      default:
        return [];
    }
  };

  // Cargar planificaciones y sesiones
  useEffect(() => {
    const cargarDatos = async () => {
      setIsLoading(true);
      try {
        // Cargar planificaciones (solo guardadas explícitamente y no eliminadas)
        const { data: planData, error: planError } = await supabase
          .from('planificaciones')
          .select('*')
          .eq('is_saved', true)
          .is('deleted_at', null)
          .order('saved_at', { ascending: false });

        if (planError) {
          // GUARDRAIL: Si la columna is_saved no existe (PGRST204), mostrar error claro
          if (planError.code === 'PGRST204' || planError.message.includes('is_saved')) {
            console.error('❌ MIGRACIÓN FALTANTE: La columna is_saved no existe en planificaciones');
            toast({
              title: "Error de Base de Datos",
              description: "Falta aplicar migración de planificaciones. Contacta al administrador o ejecuta: supabase db push",
              variant: "destructive"
            });
            setIsLoading(false);
            return;
          }
          throw planError;
        }

        // Cargar sesiones
        const { data: sesionData, error: sesionError } = await supabase
          .from('sesiones_clase')
          .select('*')
          .order('fecha', { ascending: false });

        if (sesionError) throw sesionError;

        setPlanificaciones((planData || []) as unknown as Planificacion[]);
        setSesiones((sesionData || []) as unknown as SesionClase[]);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    cargarDatos();
  }, []);

  // Memoized: Get competencies catalog for selected subject
  const competenciasCatalog = useMemo(() => {
    if (!filtroMateria || filtroMateria === 'all') {
      return [];
    }
    return getCompetenciasByMateria(filtroMateria);
  }, [filtroMateria]);

  // Memoized: Build competenciasById map for quick lookup
  const competenciasById = useMemo(() => {
    const map = new Map<string, any>();
    competenciasCatalog.forEach(comp => {
      map.set(comp.id, comp);
    });
    return map;
  }, [competenciasCatalog]);

  // Memoized: Filter sessions (dictada, date range, subject)
  const sesionesFiltradas = useMemo(() => {
    return sesiones.filter(sesion => {
      // Only dictada sessions
      if (sesion.estado !== 'dictada') return false;
      
      // Date range filter
      if (fechaRange?.from || fechaRange?.to) {
        if (!sesion.fecha) return false;
        const fechaSesion = new Date(sesion.fecha);
        if (fechaRange.from && fechaSesion < fechaRange.from) return false;
        if (fechaRange.to) {
          // Include sessions on the end date (set to end of day)
          const endDate = new Date(fechaRange.to);
          endDate.setHours(23, 59, 59, 999);
          if (fechaSesion > endDate) return false;
        }
      }
      
      // Subject filter (MUST have a subject selected)
      if (!filtroMateria || filtroMateria === 'all') return false;
      
      const planPadre = planificaciones.find(p => p.id === sesion.planificacion_id);
      if (!planPadre) return false;
      if (planPadre.materia !== filtroMateria) return false;
      
      return true;
    });
  }, [sesiones, planificaciones, filtroMateria, fechaRange]);

  // Memoized: Calculate competency counts
  const competenciasCount = useMemo<CompetenciaCount[]>(() => {
    // Only calculate if a subject is selected
    if (!filtroMateria || filtroMateria === 'all') {
      return [];
    }

    const competenciasCountMap = new Map<string, number>();
    let totalCompetencias = 0;

    sesionesFiltradas.forEach(sesion => {
      if (sesion.competencias_anep && sesion.competencias_anep.length > 0) {
        sesion.competencias_anep.forEach(compId => {
          competenciasCountMap.set(compId, (competenciasCountMap.get(compId) || 0) + 1);
          totalCompetencias++;
        });
      }
    });

    return Array.from(competenciasCountMap.entries())
      .map(([competenciaId, count]) => {
        const competenciaCompleta = competenciasById.get(competenciaId);
        const isUnknown = !competenciasById.has(competenciaId);
        
        return {
          id: competenciaId,
          competencia: competenciaId,
          nombre: isUnknown ? `Unknown (${competenciaId})` : (competenciaCompleta?.nombre || competenciaId),
          codigo: isUnknown ? '—' : (competenciaCompleta?.codigo || competenciaId),
          count,
          porcentaje: totalCompetencias > 0 ? Math.round((count / totalCompetencias) * 100) : 0,
          label: isUnknown 
            ? `Unknown (${competenciaId})`
            : `${competenciaCompleta?.codigo || competenciaId} — ${competenciaCompleta?.nombre || competenciaId}`
        };
      })
      .sort((a, b) => {
        // Sort by count DESC, then by code ASC
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return (a.codigo || '').localeCompare(b.codigo || '');
      });
  }, [sesionesFiltradas, competenciasById, filtroMateria]);

  // Memoized: Calculate pending competencies
  const competenciasPendientes = useMemo<CompetenciaPendiente[]>(() => {
    // Only calculate if a subject is selected
    if (!filtroMateria || filtroMateria === 'all') {
      return [];
    }

    if (competenciasCatalog.length === 0) {
      return [];
    }

    // Get unique set of used competency IDs
    const competenciasUsadasIds = new Set<string>();
    sesionesFiltradas.forEach(sesion => {
      if (sesion.competencias_anep && sesion.competencias_anep.length > 0) {
        sesion.competencias_anep.forEach(compId => {
          competenciasUsadasIds.add(compId);
        });
      }
    });

    // Pending = all competencies in catalog whose id is NOT in USED set
    // Unknown IDs are ignored (only catalog competencies count)
    return competenciasCatalog
      .filter(comp => !competenciasUsadasIds.has(comp.id))
      .map(comp => ({
        id: comp.id,
        codigo: comp.codigo,
        nombre: comp.nombre,
        descripcion: comp.descripcion
      }))
      .sort((a, b) => {
        // Sort by numeric order from codigo (CE1, CE2, CE10 should be 1,2,10)
        const extractNumber = (code: string) => {
          const match = code.match(/\d+/);
          return match ? parseInt(match[0], 10) : 999;
        };
        const numA = extractNumber(a.codigo);
        const numB = extractNumber(b.codigo);
        if (numA !== numB) return numA - numB;
        return a.codigo.localeCompare(b.codigo);
      });
  }, [sesionesFiltradas, competenciasCatalog, filtroMateria]);

  // Filtros
  const planificacionesFiltradas = planificaciones.filter(plan => {
    const matchSearch = plan.materia.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       plan.grupo_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchMateria = !filtroMateria || filtroMateria === 'all' || plan.materia === filtroMateria;
    const matchGrupo = !filtroGrupo || filtroGrupo === 'all' || plan.grupo_id === filtroGrupo;
    const matchCarpeta = !filtroCarpeta || filtroCarpeta === 'all' || plan.carpeta === filtroCarpeta;
    
    // Filtro por fecha (aplicar a sesiones de la planificación)
    if (fechaRange?.from || fechaRange?.to) {
      const sesionesPlan = sesiones.filter(s => s.planificacion_id === plan.id);
      if (sesionesPlan.length === 0) return false;
      
      const hayEnRango = sesionesPlan.some(sesion => {
        const fechaSesion = new Date(sesion.fecha);
        if (fechaRange.from && fechaSesion < fechaRange.from) return false;
        if (fechaRange.to && fechaSesion > fechaRange.to) return false;
        return true;
      });
      
      if (!hayEnRango) return false;
    }
    
    return matchSearch && matchMateria && matchGrupo && matchCarpeta;
  });

  // Obtener valores únicos para filtros
  const materiasUnicas = [...new Set(planificaciones.map(p => p.materia))];
  const gruposUnicos = [...new Set(planificaciones.map(p => p.grupo_id))];
  const carpetasUnicas = [...new Set(planificaciones.map(p => p.carpeta).filter(Boolean))];

  // Handlers for multi-selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === planificacionesFiltradas.length && planificacionesFiltradas.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(planificacionesFiltradas.map(p => p.id)));
    }
  };

  // Handler for soft delete
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      
      // Soft delete: update deleted_at timestamp
      const { error } = await supabase
        .from('planificaciones')
        .update({ deleted_at: new Date().toISOString() } as any)
        .in('id', idsArray);

      if (error) {
        // GUARDRAIL: Si la columna deleted_at no existe (PGRST204), mostrar error claro
        if (error.code === 'PGRST204' || error.message.includes('deleted_at')) {
          console.error('❌ MIGRACIÓN FALTANTE: La columna deleted_at no existe en planificaciones');
          toast({
            title: "Error de Base de Datos",
            description: "Falta aplicar migración. Contacta al administrador o ejecuta: supabase db push",
            variant: "destructive"
          });
          setIsDeleting(false);
          setDeleteConfirmOpen(false);
          return;
        }
        throw error;
      }

      // Remove from local state with animation (filter out deleted ones)
      setPlanificaciones(prev => prev.filter(plan => !selectedIds.has(plan.id)));
      
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);

      toast({
        title: "Planificaciones eliminadas",
        description: `Se eliminaron ${idsArray.length} planificación${idsArray.length > 1 ? 'es' : ''}`,
      });

    } catch (error) {
      console.error('Error deleting planificaciones:', error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar las planificaciones",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Asignar carpeta
  const handleAsignarCarpeta = async () => {
    if (!carpetaModal.planificacion || !nuevaCarpeta.trim()) return;
    
    try {
      const { error } = await supabase
        .from('planificaciones')
        .update({ carpeta: nuevaCarpeta.trim() })
        .eq('id', carpetaModal.planificacion.id);
        
      if (error) throw error;
      
      // Actualizar estado local
      setPlanificaciones(prev => prev.map(plan => 
        plan.id === carpetaModal.planificacion!.id 
          ? { ...plan, carpeta: nuevaCarpeta.trim() }
          : plan
      ));
      
      setCarpetaModal({ open: false, planificacion: null });
      setNuevaCarpeta('');
      
      toast({
        title: "Carpeta asignada",
        description: `La planificación se ha asignado a la carpeta "${nuevaCarpeta.trim()}"`
      });
    } catch (error) {
      console.error('Error asignando carpeta:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar la carpeta",
        variant: "destructive"
      });
    }
  };

  // Manejar compartir planificación
  const handleCompartirPlanificacion = async (compartirConEquipo: boolean, compartirConDireccion: boolean) => {
    if (!compartirModal.planificacion) return;
    
    try {
      const { error } = await supabase
        .from('planificaciones')
        .update({ 
          compartido_equipo: compartirConEquipo,
          compartido_direccion: compartirConDireccion
        } as any)
        .eq('id', compartirModal.planificacion.id);
        
      if (error) throw error;
      
      // Actualizar estado local
      setPlanificaciones(prev => prev.map(plan => 
        plan.id === compartirModal.planificacion!.id 
          ? { 
              ...plan, 
              compartido_equipo: compartirConEquipo,
              compartido_direccion: compartirConDireccion
            } as any
          : plan
      ));
      
      setCompartirModal({ 
        open: false, 
        planificacion: null, 
        loading: false, 
        direccion: false, 
        psicopedagogico: false 
      });
      
      const mensaje = [];
      if (compartirConEquipo) mensaje.push('equipo psicopedagógico');
      if (compartirConDireccion) mensaje.push('dirección');
      
      toast({
        title: "Planificación compartida",
        description: `Se ha compartido con: ${mensaje.join(' y ')}`
      });
    } catch (error) {
      console.error('Error compartiendo planificación:', error);
      toast({
        title: "Error",
        description: "No se pudo compartir la planificación",
        variant: "destructive"
      });
    }
  };
  // Memoized: Pedagogical analysis (optional, can be removed if not needed)
  const analisis = useMemo(() => {
    if (competenciasCount.length === 0) return null;
    
    const promedio = competenciasCount.reduce((sum, comp) => sum + comp.count, 0) / competenciasCount.length;
    const sobretrabajadas = competenciasCount.filter(comp => comp.count > promedio * 1.5);
    const descuidadas = competenciasCount.filter(comp => comp.count < promedio * 0.5);
    
    return { sobretrabajadas, descuidadas, promedio };
  }, [competenciasCount]);

  // Exportar datos
  const handleExportarExcel = () => {
    // Implementar exportación
    console.log('Exportando datos...');
  };

  const handleExportarPDFCompetencial = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const docente = profile?.display_name || 'Docente';
      const competenciasTrabajadas = competenciasCount.map(comp => ({
        competencia: comp.competencia,
        porcentaje: comp.porcentaje,
        contenidos: [] // Los contenidos se extraerían de las sesiones si fuera necesario
      }));

      const pdfData = {
        docente,
        grupo: filtroGrupo || 'Todos los grupos',
        materia: filtroMateria || 'Todas las materias',
        fechaInicio: fechaRange?.from?.toLocaleDateString('es-UY') || 'Desde el inicio',
        fechaFin: fechaRange?.to?.toLocaleDateString('es-UY') || 'Hasta hoy',
        competenciasTrabajadas,
        competenciasPendientes,
        resumenGrupo: undefined // Se puede agregar más adelante
      };

      const pdfBlob = await generateRegistroCompetencialPDF(pdfData);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registro-competencial-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF generado",
        description: "El registro competencial se ha descargado correctamente"
      });
    } catch (error) {
      console.error('Error generando PDF:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive"
      });
    }
  };

  // Función para compartir planificación con PDF adjunto
  const handleCompartirConPDF = async (planificacion: Planificacion) => {
    setCompartirModal(prev => ({ ...prev, loading: true }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const docente = profile?.display_name || 'Docente';
      
      // Generar PDF específico para esta planificación
      const pdfData = {
        docente,
        grupo: planificacion.grupo_id,
        materia: planificacion.materia,
        fechaInicio: planificacion.fecha_inicio,
        fechaFin: planificacion.fecha_fin,
        competenciasTrabajadas: competenciasCount.map(comp => ({
          competencia: comp.competencia,
          porcentaje: comp.porcentaje,
          contenidos: []
        })),
        competenciasPendientes,
        resumenGrupo: undefined
      };

      const pdfBlob = await generateRegistroCompetencialPDF(pdfData);
      
      // Subir PDF a Storage
      const fileName = `planificacion-${planificacion.id}-${Date.now()}.pdf`;
      const filePath = `${user.id}/${fileName}`;
      const pdfUrl = await uploadFileToStorage('comunicaciones', filePath, pdfBlob);

      // Crear mensajes según selección
      const { direccion, psicopedagogico } = compartirModal;
      const promises = [];

      if (direccion) {
        promises.push(createCommunicationMessage(
          'direccion',
          `Planificación compartida: ${planificacion.materia} - ${planificacion.grupo_id}`,
          `Adjunto la planificación del período ${planificacion.fecha_inicio} al ${planificacion.fecha_fin} para su revisión.`,
          [pdfUrl],
          planificacion.id
        ));
      }

      if (psicopedagogico) {
        promises.push(createCommunicationMessage(
          'psicopedagogico',
          `Planificación compartida: ${planificacion.materia} - ${planificacion.grupo_id}`,
          `Adjunto la planificación del período ${planificacion.fecha_inicio} al ${planificacion.fecha_fin} para su conocimiento y seguimiento.`,
          [pdfUrl],
          planificacion.id
        ));
      }

      await Promise.all(promises);

      setCompartirModal({ 
        open: false, 
        planificacion: null, 
        loading: false, 
        direccion: false, 
        psicopedagogico: false 
      });

      toast({
        title: "Planificación compartida",
        description: "La planificación se ha enviado correctamente con el PDF adjunto"
      });

      // Redirigir a comunicaciones
      navigate('/comunicaciones');

    } catch (error) {
      console.error('Error compartiendo planificación:', error);
      toast({
        title: "Error",
        description: "No se pudo compartir la planificación",
        variant: "destructive"
      });
    } finally {
      setCompartirModal(prev => ({ ...prev, loading: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando planificaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/planificacion')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mis Planificaciones</h1>
            <p className="text-muted-foreground">
              Gestiona tus planificaciones guardadas y visualiza el balance de competencias
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={handleExportarExcel} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={handleExportarPDFCompetencial} variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            PDF competencial
          </Button>
        </div>
      </div>

      {/* Filtros Avanzados */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar planificaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filtroMateria} onValueChange={setFiltroMateria}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las materias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las materias</SelectItem>
                {materiasUnicas.map(materia => (
                  <SelectItem key={materia} value={materia}>{materia}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los grupos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los grupos</SelectItem>
                {gruposUnicos.map(grupo => (
                  <SelectItem key={grupo} value={grupo}>{grupo}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroCarpeta} onValueChange={setFiltroCarpeta}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las carpetas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las carpetas</SelectItem>
                {carpetasUnicas.map(carpeta => (
                  <SelectItem key={carpeta} value={carpeta}>{carpeta}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DateRangePicker
              value={fechaRange}
              onChange={setFechaRange}
              placeholder="Rango de fechas"
            />
            
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {planificacionesFiltradas.length} planificaciones
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance y Competencias Pendientes */}
      {(!filtroMateria || filtroMateria === 'all') ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Selecciona una materia</h3>
              <p className="text-muted-foreground">
                Selecciona una materia para ver el balance de competencias y las competencias pendientes.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Balance de Competencias - Horizontal Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Balance de Competencias
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Uso de competencias en sesiones dictadas ({filtroMateria})
                {fechaRange?.from && fechaRange?.to && (
                  <span className="block mt-1">
                    {fechaRange.from.toLocaleDateString('es-ES')} - {fechaRange.to.toLocaleDateString('es-ES')}
                  </span>
                )}
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Calculando balance...</p>
                  </div>
                </div>
              ) : competenciasCount.length > 0 ? (
                <div>
                  <ResponsiveContainer width="100%" height={Math.max(300, competenciasCount.length * 50)}>
                    <BarChart
                      data={competenciasCount}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={110}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => {
                          // Truncate long labels, show full on hover via tooltip
                          return value.length > 30 ? value.substring(0, 27) + '...' : value;
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                                <p className="font-semibold">{data.label}</p>
                                <p className="text-sm text-muted-foreground">
                                  Usada {data.count} vez{data.count !== 1 ? 'es' : ''}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {data.porcentaje}% del total
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {competenciasCount.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getCompetencyColor(entry.competencia)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      No hay uso de competencias registrado en este período
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Competencias Pendientes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Competencias Pendientes
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Competencias no trabajadas en el período seleccionado
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Calculando pendientes...</p>
                  </div>
                </div>
              ) : competenciasCatalog.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      No hay competencias definidas para esta materia.
                    </p>
                  </div>
                </div>
              ) : competenciasPendientes.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {competenciasPendientes.map((comp) => (
                    <div
                      key={comp.id}
                      className="border rounded-lg p-4 bg-yellow-50/50 hover:bg-yellow-50 transition-colors"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <Badge variant="outline" className="text-xs font-mono shrink-0">
                          {comp.codigo}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm leading-tight">{comp.nombre}</div>
                        </div>
                      </div>
                      {comp.descripcion && (
                        <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {comp.descripcion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-green-600 opacity-50" />
                    <p className="font-medium text-foreground mb-1">
                      ¡Excelente!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Todas las competencias fueron trabajadas en este período
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de Planificaciones */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Planificaciones Guardadas
            </CardTitle>
            
            {/* Toolbar: Select all + Delete button */}
            {planificacionesFiltradas.length > 0 && (
              <div className="flex items-center gap-3">
                {/* Select all checkbox */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedIds.size === planificacionesFiltradas.length && planificacionesFiltradas.length > 0}
                    onCheckedChange={handleToggleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-sm cursor-pointer">
                    Seleccionar todas
                  </Label>
                </div>

                {/* Delete button (only enabled when items are selected) */}
                <Button
                  variant={selectedIds.size > 0 ? "destructive" : "outline"}
                  size="sm"
                  disabled={selectedIds.size === 0}
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {selectedIds.size > 0 ? `Eliminar (${selectedIds.size})` : 'Eliminar'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {planificacionesFiltradas.length > 0 ? (
            <div className="space-y-4">
              {planificacionesFiltradas.map((plan) => (
                <Card 
                  key={plan.id} 
                  className="hover:shadow-md transition-all duration-300"
                  style={{
                    opacity: selectedIds.has(plan.id) ? 0.7 : 1
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Checkbox for selection */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(plan.id)}
                          onCheckedChange={() => handleToggleSelect(plan.id)}
                        />
                      </div>

                      {/* Plan info (clickable to navigate) */}
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => navigate(`/planificacion/${plan.id}`)}
                      >
                        <div className="space-y-1">
                          <h3 className="font-semibold text-foreground">
                            {/* Show custom nombre if exists, else fallback to materia - grupo_id */}
                            {plan.nombre || `${plan.materia} - ${plan.grupo_id}`}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>
                              {new Date(plan.fecha_inicio).toLocaleDateString('es-ES')} - {' '}
                              {new Date(plan.fecha_fin).toLocaleDateString('es-ES')}
                            </span>
                            <span>{plan.horas_semanales} horas semanales</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Badges and actions (with stopPropagation) */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Badge variant="outline">
                          {sesiones.filter(s => s.planificacion_id === plan.id).length} sesiones
                        </Badge>
                        {plan.carpeta && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            <Folder className="h-3 w-3 mr-1" />
                            {plan.carpeta}
                          </Badge>
                        )}
                         <Dialog open={carpetaModal.open && carpetaModal.planificacion?.id === plan.id} 
                                onOpenChange={(open) => setCarpetaModal({ 
                                  open, 
                                  planificacion: open ? plan : null 
                                })}>
                           <DialogTrigger asChild>
                             <Button variant="ghost" size="sm" className="h-6 px-2">
                               <Plus className="h-3 w-3 mr-1" />
                               Carpeta
                             </Button>
                           </DialogTrigger>
                           <DialogContent>
                             <DialogHeader>
                               <DialogTitle>Asignar a carpeta</DialogTitle>
                             </DialogHeader>
                             <div className="space-y-4">
                               <div>
                                 <Label>Nombre de la carpeta</Label>
                                 <Input
                                   value={nuevaCarpeta}
                                   onChange={(e) => setNuevaCarpeta(e.target.value)}
                                   placeholder="Ej: Primer Cuatrimestre 2024"
                                 />
                               </div>
                               <div className="flex gap-2">
                                 <Button onClick={handleAsignarCarpeta} disabled={!nuevaCarpeta.trim()}>
                                   Asignar
                                 </Button>
                                 <Button variant="outline" onClick={() => {
                                   setCarpetaModal({ open: false, planificacion: null });
                                   setNuevaCarpeta('');
                                 }}>
                                   Cancelar
                                 </Button>
                               </div>
                             </div>
                           </DialogContent>
                         </Dialog>
                         
                         <Button 
                           variant="ghost" 
                           size="sm" 
                           className="h-6 px-2"
                           onClick={() => setCompartirModal({ 
                             open: true, 
                             planificacion: plan, 
                             loading: false, 
                             direccion: false, 
                             psicopedagogico: false 
                           })}
                         >
                           <Share2 className="h-3 w-3 mr-1" />
                           Compartir
                         </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No se encontraron planificaciones</h3>
              <p className="text-muted-foreground">
                {searchTerm || filtroMateria || filtroGrupo 
                  ? 'Intenta ajustar los filtros de búsqueda' 
                  : 'Aún no tienes planificaciones guardadas'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={compartirModal.open} onOpenChange={() => setCompartirModal({ 
        open: false, 
        planificacion: null, 
        loading: false, 
        direccion: false, 
        psicopedagogico: false 
      })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir planificación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecciona los destinatarios para compartir la planificación "{compartirModal.planificacion?.materia} - {compartirModal.planificacion?.grupo_id}":
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="direccion"
                  checked={compartirModal.direccion}
                  onCheckedChange={(checked) => 
                    setCompartirModal(prev => ({ ...prev, direccion: !!checked }))
                  }
                />
                <Label htmlFor="direccion" className="text-sm font-medium">
                  Compartir con Dirección
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="psicopedagogico"
                  checked={compartirModal.psicopedagogico}
                  onCheckedChange={(checked) => 
                    setCompartirModal(prev => ({ ...prev, psicopedagogico: !!checked }))
                  }
                />
                <Label htmlFor="psicopedagogico" className="text-sm font-medium">
                  Compartir con Equipo Psicopedagógico
                </Label>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded">
              <strong>Nota:</strong> Se generará un PDF con el registro competencial y se enviará automáticamente a los destinatarios seleccionados a través del sistema de comunicaciones.
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline"
                onClick={() => setCompartirModal({ 
                  open: false, 
                  planificacion: null, 
                  loading: false, 
                  direccion: false, 
                  psicopedagogico: false 
                })}
                disabled={compartirModal.loading}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => compartirModal.planificacion && handleCompartirConPDF(compartirModal.planificacion)}
                disabled={compartirModal.loading || (!compartirModal.direccion && !compartirModal.psicopedagogico)}
              >
                {compartirModal.loading ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar planificaciones?</DialogTitle>
            <DialogDescription>
              Estás a punto de eliminar {selectedIds.size} planificación{selectedIds.size > 1 ? 'es' : ''}. 
              Esta acción se puede revertir desde la base de datos si es necesario.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Las planificaciones seleccionadas ya no aparecerán en tu lista.
            </p>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MisPlanificaciones;