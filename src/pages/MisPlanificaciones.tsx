import React, { useState, useEffect } from 'react';
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { generateRegistroCompetencialPDF } from '@/lib/registroCompetencialPDF';
import { uploadFileToStorage, createCommunicationMessage } from '@/lib/storage';
import { COMPETENCIAS_HISTORIA } from '@/data/competencias';
import { COMPETENCIAS_CIUDADANIA } from '@/data/competenciasCiudadania';
import { COMPETENCIAS_LITERATURA } from '@/data/competenciasLiteratura';

interface CompetenciaCount {
  competencia: string;
  count: number;
  porcentaje: number;
}

interface CompetenciaPendiente {
  id: string;
  nombre: string;
  descripcion: string;
}

const MisPlanificaciones: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [planificaciones, setPlanificaciones] = useState<Planificacion[]>([]);
  const [sesiones, setSesiones] = useState<SesionClase[]>([]);
  const [competenciasCount, setCompetenciasCount] = useState<CompetenciaCount[]>([]);
  const [competenciasPendientes, setCompetenciasPendientes] = useState<CompetenciaPendiente[]>([]);
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

        // Calcular contador de competencias y pendientes
        calcularCompetenciasCount((sesionData || []) as unknown as SesionClase[]);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    cargarDatos();
  }, []);

  // Calcular contador de competencias con filtros aplicados
  const calcularCompetenciasCount = (sesionesList: SesionClase[]) => {
    // Aplicar filtros a las sesiones
    const sesionesFiltradas = sesionesList.filter(sesion => {
      // Solo sesiones dictadas
      if (sesion.estado !== 'dictada') return false;
      
      // Filtro de fecha
      if (fechaRange?.from || fechaRange?.to) {
        const fechaSesion = new Date(sesion.fecha);
        if (fechaRange.from && fechaSesion < fechaRange.from) return false;
        if (fechaRange.to && fechaSesion > fechaRange.to) return false;
      }
      
      // Filtros de planificación padre
      const planPadre = planificaciones.find(p => p.id === sesion.planificacion_id);
      if (!planPadre) return false;
      
      if (filtroMateria && filtroMateria !== 'all' && planPadre.materia !== filtroMateria) return false;
      if (filtroGrupo && filtroGrupo !== 'all' && planPadre.grupo_id !== filtroGrupo) return false;
      if (filtroCarpeta && filtroCarpeta !== 'all' && planPadre.carpeta !== filtroCarpeta) return false;
      
      return true;
    });

    const competenciasMap = new Map<string, number>();
    let totalCompetencias = 0;

    sesionesFiltradas.forEach(sesion => {
      if (sesion.competencias_anep && sesion.competencias_anep.length > 0) {
        sesion.competencias_anep.forEach(comp => {
          competenciasMap.set(comp, (competenciasMap.get(comp) || 0) + 1);
          totalCompetencias++;
        });
      }
    });

    const competenciasArray: CompetenciaCount[] = Array.from(competenciasMap.entries())
      .map(([competencia, count]) => ({
        competencia,
        count,
        porcentaje: totalCompetencias > 0 ? Math.round((count / totalCompetencias) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    setCompetenciasCount(competenciasArray);
  };

  // Recalcular cuando cambien los filtros
  useEffect(() => {
    if (sesiones.length > 0) {
      calcularCompetenciasCount(sesiones);
    }
  }, [sesiones, planificaciones, filtroMateria, filtroGrupo, filtroCarpeta, fechaRange]);

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
        .update({ deleted_at: new Date().toISOString() })
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
  const getAnalisisPedagogico = () => {
    if (competenciasCount.length === 0) return null;
    
    const promedio = competenciasCount.reduce((sum, comp) => sum + comp.count, 0) / competenciasCount.length;
    const sobretrabajadas = competenciasCount.filter(comp => comp.count > promedio * 1.5);
    const descuidadas = competenciasCount.filter(comp => comp.count < promedio * 0.5);
    
    return { sobretrabajadas, descuidadas, promedio };
  };

  const analisis = getAnalisisPedagogico();

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

      {/* Contador de Competencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Tabla de Competencias */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Balance de Competencias
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Cuántas veces se trabajó cada competencia a lo largo del año
            </p>
          </CardHeader>
          <CardContent>
            {/* Análisis Pedagógico */}
            {analisis && (analisis.sobretrabajadas.length > 0 || analisis.descuidadas.length > 0) && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-amber-800 text-sm">Análisis Pedagógico</span>
                </div>
                <div className="text-xs text-amber-700 space-y-1">
                  {analisis.sobretrabajadas.length > 0 && (
                    <p>• Sobretrabajadas: {analisis.sobretrabajadas.map(c => c.competencia).join(', ')}</p>
                  )}
                  {analisis.descuidadas.length > 0 && (
                    <p>• Necesitan más atención: {analisis.descuidadas.map(c => c.competencia).join(', ')}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {competenciasCount.length > 0 ? (
                competenciasCount.map((comp, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{comp.competencia}</div>
                      <div className="text-xs text-muted-foreground">{comp.porcentaje}% del total</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {comp.count} veces
                      </Badge>
                      {analisis && comp.count > analisis.promedio * 1.5 && (
                        <TrendingUp className="h-3 w-3 text-orange-500" />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay competencias registradas en el rango seleccionado</p>
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Competencias Pendientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Competencias Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {competenciasPendientes.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                {planificacionesFiltradas.length === 0 
                  ? "No hay planificaciones en el período seleccionado"
                  : "¡Excelente! Todas las competencias objetivo han sido trabajadas"
                }
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground mb-4">
                Competencias definidas como objetivo pero aún no trabajadas en sesiones validadas:
              </div>
              {competenciasPendientes.map((comp, index) => (
                <div key={comp.id} className="border rounded-lg p-3 bg-yellow-50">
                  <div className="font-medium text-sm">{comp.nombre}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {comp.descripcion}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

        {/* Gráfico de Competencias */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución Visual</CardTitle>
            <p className="text-sm text-muted-foreground">
              Visualización del balance de competencias trabajadas
            </p>
          </CardHeader>
          <CardContent>
            {competenciasCount.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={competenciasCount.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="competencia" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Sin datos para mostrar</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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