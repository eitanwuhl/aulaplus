import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Search, BarChart3, Clock, Trash2, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { COMPETENCIAS_HISTORIA } from '@/data/competencias';
import { COMPETENCIAS_CIUDADANIA } from '@/data/competenciasCiudadania';
import { COMPETENCIAS_LITERATURA } from '@/data/competenciasLiteratura';
import { normalizeSubjectName } from '@/lib/subjectNormalizer';
import { normalizeArrayField } from '@/lib/normalizeSupabaseArrays';

interface CompetenciaCount {
  id: string;
  competencia: string;
  nombre: string;
  codigo: string;
  count: number;
  porcentaje: number;
  label: string;
}

interface CompetenciaPendiente {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
}

interface Evaluacion {
  id: string;
  user_id: string;
  nombre: string;
  materia: string;
  grupo_id: string;
  nivel?: string;
  fecha: string | null;
  competencias_anep: string[];
  contenidos?: string[];
  criterios_logro?: string[];
  is_saved: boolean;
  saved_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const MisEvaluaciones: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroMateria, setFiltroMateria] = useState<string>('');
  const [filtroGrupo, setFiltroGrupo] = useState<string>('');
  const [fechaRange, setFechaRange] = useState<DateRange | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Color palette for competencies
  const COMPETENCY_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
    '#f97316', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#eab308',
  ];

  // Deterministic color mapping
  const getCompetencyColor = (competencyId: string): string => {
    let hash = 0;
    for (let i = 0; i < competencyId.length; i++) {
      hash = ((hash << 5) - hash) + competencyId.charCodeAt(i);
      hash = hash & hash;
    }
    const index = Math.abs(hash) % COMPETENCY_COLORS.length;
    return COMPETENCY_COLORS[index];
  };

  // Calculate relative luminance
  const getLuminance = (hex: string): number => {
    const rgb = hex.replace('#', '');
    const r = parseInt(rgb.substring(0, 2), 16) / 255;
    const g = parseInt(rgb.substring(2, 4), 16) / 255;
    const b = parseInt(rgb.substring(4, 6), 16) / 255;
    
    const [rLinear, gLinear, bLinear] = [r, g, b].map(val => {
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  };

  // Get contrasting text color
  const getContrastingTextColor = (hex: string): '#fff' | '#111' => {
    const luminance = getLuminance(hex);
    return luminance > 0.5 ? '#111' : '#fff';
  };

  // Helper: get competencies by subject
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

  // Load evaluaciones
  useEffect(() => {
    const cargarDatos = async () => {
      setIsLoading(true);
      try {
        const { data: evalData, error: evalError } = await supabase
          .from('evaluaciones')
          .select('*')
          .eq('is_saved', true)
          .is('deleted_at', null)
          .order('saved_at', { ascending: false });

        if (evalError) {
          if (evalError.code === 'PGRST204' || evalError.message.includes('is_saved')) {
            console.error('❌ MIGRACIÓN FALTANTE: La columna is_saved no existe en evaluaciones');
            toast({
              title: "Error de Base de Datos",
              description: "Falta aplicar migración de evaluaciones. Contacta al administrador.",
              variant: "destructive"
            });
            setIsLoading(false);
            return;
          }
          throw evalError;
        }

        // Normalize competencias_anep
        const evaluacionesNormalizadas = (evalData || []).map((evaluacion) => ({
          ...evaluacion,
          competencias_anep: normalizeArrayField(evaluacion.competencias_anep),
        }));

        console.log('[EVALUACIONES] Loaded:', evaluacionesNormalizadas.length);
        setEvaluaciones(evaluacionesNormalizadas as unknown as Evaluacion[]);
      } catch (error) {
        console.error('Error cargando evaluaciones:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las evaluaciones",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    cargarDatos();
  }, [toast]);

  // Memoized: Get competencies catalog for selected subject
  const competenciasCatalog = useMemo(() => {
    if (!filtroMateria || filtroMateria === 'all') {
      return [];
    }
    return getCompetenciasByMateria(filtroMateria);
  }, [filtroMateria]);

  // Memoized: Build competenciasById map
  const competenciasById = useMemo(() => {
    const map = new Map<string, any>();
    competenciasCatalog.forEach(comp => {
      map.set(comp.id, comp);
    });
    return map;
  }, [competenciasCatalog]);

  // Memoized: Filter evaluaciones (with competencias_anep, date range, subject, group)
  const evaluacionesFiltradas = useMemo(() => {
    console.log('[EVALUACIONES] Filtering evaluaciones:', {
      totalEvaluaciones: evaluaciones.length,
      filtroMateria,
      filtroGrupo,
      fechaRange: fechaRange ? { from: fechaRange.from, to: fechaRange.to } : null
    });

    const filtered = evaluaciones.filter(evaluacion => {
      // Must have at least one competency assigned
      if (!evaluacion.competencias_anep || evaluacion.competencias_anep.length === 0) {
        return false;
      }

      // Date range filter - defensive checks
      if (fechaRange?.from || fechaRange?.to) {
        if (!evaluacion.fecha) return false;
        
        // Safely parse fecha
        let fechaEval: Date;
        try {
          fechaEval = evaluacion.fecha instanceof Date 
            ? evaluacion.fecha 
            : new Date(evaluacion.fecha + 'T00:00:00');
          
          // Validate Date is valid
          if (isNaN(fechaEval.getTime())) {
            console.warn('[EVALUACIONES] Invalid fecha for evaluation:', evaluacion.id, evaluacion.fecha);
            return false;
          }
        } catch (e) {
          console.warn('[EVALUACIONES] Error parsing fecha:', evaluacion.fecha, e);
          return false;
        }
        
        if (fechaRange.from) {
          try {
            const startDate = new Date(fechaRange.from);
            if (isNaN(startDate.getTime())) return false;
            startDate.setHours(0, 0, 0, 0);
            if (fechaEval < startDate) return false;
          } catch (e) {
            console.warn('[EVALUACIONES] Error with fechaRange.from:', e);
            return false;
          }
        }
        if (fechaRange.to) {
          try {
            const endDate = new Date(fechaRange.to);
            if (isNaN(endDate.getTime())) return false;
            endDate.setHours(23, 59, 59, 999);
            if (fechaEval > endDate) return false;
          } catch (e) {
            console.warn('[EVALUACIONES] Error with fechaRange.to:', e);
            return false;
          }
        }
      }

      // Subject filter (MUST have a subject selected)
      if (!filtroMateria || filtroMateria === 'all') return false;
      
      const materiaNormalizada = normalizeSubjectName(evaluacion.materia);
      const filtroMateriaNormalizado = normalizeSubjectName(filtroMateria);
      if (materiaNormalizada !== filtroMateriaNormalizado) return false;

      // Group filter (if a group is selected)
      if (filtroGrupo && filtroGrupo !== 'all') {
        if (evaluacion.grupo_id !== filtroGrupo) return false;
      }
      
      return true;
    });

    console.log('[EVALUACIONES] Filtered:', filtered.length);
    return filtered;
  }, [evaluaciones, filtroMateria, filtroGrupo, fechaRange]);

  // Memoized: Calculate competency counts
  const competenciasCount = useMemo<CompetenciaCount[]>(() => {
    if (!filtroMateria || filtroMateria === 'all') {
      return [];
    }

    const competenciasCountMap = new Map<string, number>();
    let totalCompetencias = 0;

    evaluacionesFiltradas.forEach(evaluacion => {
      evaluacion.competencias_anep.forEach(compId => {
        competenciasCountMap.set(compId, (competenciasCountMap.get(compId) || 0) + 1);
        totalCompetencias++;
      });
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
        if (b.count !== a.count) return b.count - a.count;
        return (a.codigo || '').localeCompare(b.codigo || '');
      });
  }, [evaluacionesFiltradas, competenciasById, filtroMateria]);

  // Memoized: Calculate pending competencies
  const competenciasPendientes = useMemo<CompetenciaPendiente[]>(() => {
    if (!filtroMateria || filtroMateria === 'all') {
      return [];
    }

    if (competenciasCatalog.length === 0) {
      return [];
    }

    const competenciasUsadasIds = new Set<string>();
    evaluacionesFiltradas.forEach(evaluacion => {
      if (evaluacion.competencias_anep && evaluacion.competencias_anep.length > 0) {
        evaluacion.competencias_anep.forEach(compId => {
          competenciasUsadasIds.add(compId);
        });
      }
    });

    return competenciasCatalog
      .filter(comp => !competenciasUsadasIds.has(comp.id))
      .map(comp => ({
        id: comp.id,
        codigo: comp.codigo,
        nombre: comp.nombre,
        descripcion: comp.descripcion
      }))
      .sort((a, b) => {
        const extractNumber = (code: string) => {
          const match = code.match(/\d+/);
          return match ? parseInt(match[0], 10) : 999;
        };
        const numA = extractNumber(a.codigo);
        const numB = extractNumber(b.codigo);
        if (numA !== numB) return numA - numB;
        return a.codigo.localeCompare(b.codigo);
      });
  }, [evaluacionesFiltradas, competenciasCatalog, filtroMateria]);

  // Helper: Determine why there are no filtered evaluaciones
  const getEmptyBalanceReason = useMemo(() => {
    if (!filtroMateria || filtroMateria === 'all') {
      return null;
    }

    if (evaluacionesFiltradas.length === 0) {
      const evaluacionesConCompetencias = evaluaciones.filter(e => 
        e.competencias_anep && e.competencias_anep.length > 0
      );
      
      const evaluacionesConMateria = evaluacionesConCompetencias.filter(e => {
        const materiaNormalizada = normalizeSubjectName(e.materia);
        const filtroMateriaNormalizado = normalizeSubjectName(filtroMateria);
        return materiaNormalizada === filtroMateriaNormalizado;
      });
      
      const evaluacionesConGrupo = filtroGrupo && filtroGrupo !== 'all'
        ? evaluacionesConMateria.filter(e => e.grupo_id === filtroGrupo)
        : evaluacionesConMateria;
      
      const evaluacionesConFecha = fechaRange?.from || fechaRange?.to
        ? evaluacionesConGrupo.filter(e => {
            if (!e.fecha) return false;
            const fechaEval = e.fecha instanceof Date 
              ? e.fecha 
              : new Date(e.fecha + 'T00:00:00');
            if (fechaRange.from) {
              const startDate = new Date(fechaRange.from);
              startDate.setHours(0, 0, 0, 0);
              if (fechaEval < startDate) return false;
            }
            if (fechaRange.to) {
              const endDate = new Date(fechaRange.to);
              endDate.setHours(23, 59, 59, 999);
              if (fechaEval > endDate) return false;
            }
            return true;
          })
        : evaluacionesConGrupo;

      if (evaluacionesConCompetencias.length === 0) {
        return 'No hay evaluaciones con competencias registradas en el sistema.';
      }
      
      if (evaluacionesConMateria.length === 0) {
        return `No hay evaluaciones con competencias registradas para la materia "${filtroMateria}".`;
      }
      
      if (filtroGrupo && filtroGrupo !== 'all' && evaluacionesConGrupo.length === 0) {
        return `No hay evaluaciones con competencias registradas para el grupo "${filtroGrupo}" en la materia "${filtroMateria}".`;
      }
      
      if ((fechaRange?.from || fechaRange?.to) && evaluacionesConFecha.length === 0) {
        return `No hay evaluaciones con competencias registradas en el rango de fechas seleccionado para ${filtroGrupo && filtroGrupo !== 'all' ? `el grupo "${filtroGrupo}" en ` : ''}la materia "${filtroMateria}".`;
      }
      
      return 'Hay evaluaciones, pero aún no tienen competencias asignadas.';
    }

    return null;
  }, [evaluaciones, filtroMateria, filtroGrupo, fechaRange, evaluacionesFiltradas]);

  // Filtered evaluaciones for display list
  const evaluacionesParaMostrar = evaluaciones.filter(evaluacion => {
    const matchSearch = evaluacion.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       evaluacion.materia?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchMateria = !filtroMateria || filtroMateria === 'all' || evaluacion.materia === filtroMateria;
    const matchGrupo = !filtroGrupo || filtroGrupo === 'all' || evaluacion.grupo_id === filtroGrupo;
    
    let matchFecha = true;
    if (fechaRange?.from || fechaRange?.to) {
      if (evaluacion.fecha) {
        try {
          const fechaEval = new Date(evaluacion.fecha);
          if (isNaN(fechaEval.getTime())) {
            matchFecha = false;
          } else {
            if (fechaRange.from) {
              const startDate = new Date(fechaRange.from);
              if (!isNaN(startDate.getTime()) && fechaEval < startDate) matchFecha = false;
            }
            if (fechaRange.to) {
              const endDate = new Date(fechaRange.to);
              if (!isNaN(endDate.getTime())) {
                endDate.setHours(23, 59, 59, 999);
                if (fechaEval > endDate) matchFecha = false;
              }
            }
          }
        } catch (e) {
          console.warn('[EVALUACIONES] Error filtering by fecha:', e);
          matchFecha = false;
        }
      } else {
        matchFecha = false;
      }
    }
    
    return matchSearch && matchMateria && matchGrupo && matchFecha;
  });

  // Get unique subjects and groups
  const materiasUnicas = [...new Set(evaluaciones.map(e => e.materia))];
  const gruposUnicos = [...new Set(evaluaciones.map(e => e.grupo_id))];

  // Handle delete
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      
      const { error } = await supabase
        .from('evaluaciones')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', idsArray);

      if (error) throw error;

      toast({
        title: "Evaluaciones eliminadas",
        description: `${selectedIds.size} evaluación(es) eliminada(s) correctamente`,
      });

      // Reload
      setEvaluaciones(prev => prev.filter(e => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
    } catch (error) {
      console.error('Error eliminando evaluaciones:', error);
      toast({
        title: "Error",
        description: "No se pudieron eliminar las evaluaciones",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/evaluaciones')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Mis Evaluaciones</h1>
            <p className="text-muted-foreground">
              Gestiona tus evaluaciones guardadas y visualiza el balance de competencias
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar evaluaciones..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        
        <Select value={filtroMateria} onValueChange={setFiltroMateria}>
          <SelectTrigger className="w-[200px]">
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
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos los grupos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los grupos</SelectItem>
            {gruposUnicos.map(grupo => (
              <SelectItem key={grupo} value={grupo}>{grupo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangePicker
          value={fechaRange}
          onChange={setFechaRange}
        />
      </div>

      {/* Competency Cards */}
      {(!filtroMateria || filtroMateria === 'all') ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              Selecciona una materia para ver el balance de competencias y las competencias pendientes.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Balance de Competencias */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Balance de Competencias
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Uso de competencias en evaluaciones guardadas
                {filtroMateria && filtroMateria !== 'all' && ` (${filtroMateria}${filtroGrupo && filtroGrupo !== 'all' ? ` - ${filtroGrupo}` : ''})`}
                {fechaRange?.from && fechaRange?.to && (
                  <span className="block mt-1">
                    {(() => {
                      try {
                        const from = new Date(fechaRange.from);
                        const to = new Date(fechaRange.to);
                        if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
                          return `${from.toLocaleDateString('es-ES')} - ${to.toLocaleDateString('es-ES')}`;
                        }
                      } catch (e) {
                        console.warn('[EVALUACIONES] Error formatting date range:', e);
                      }
                      return '';
                    })()}
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
                  <ResponsiveContainer width="100%" height={Math.max(200, competenciasCount.length * 50)}>
                    <BarChart
                      data={competenciasCount}
                      layout="vertical"
                      margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" hide />
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
                      <Bar 
                        dataKey="count" 
                        radius={[0, 4, 4, 0]}
                        label={({ x, y, width, height, payload }) => {
                          if (!payload || width < 20) return null;
                          
                          const barColor = getCompetencyColor(payload.competencia);
                          const textColor = getContrastingTextColor(barColor);
                          const label = payload.label || '';
                          
                          const availableWidth = width - 24;
                          const maxChars = Math.floor(availableWidth / 7);
                          
                          const displayLabel = label.length > maxChars 
                            ? label.substring(0, maxChars - 3) + '...'
                            : label;
                          
                          const showCount = width > 150;
                          const countText = showCount ? ` (${payload.count})` : '';
                          const fullText = displayLabel + countText;
                          
                          return (
                            <text
                              x={x + 12}
                              y={y + height / 2}
                              fill={textColor}
                              fontSize={12}
                              fontWeight={500}
                              dominantBaseline="middle"
                            >
                              {fullText}
                            </text>
                          );
                        }}
                      >
                        {competenciasCount.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getCompetencyColor(entry.competencia)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-2">
                      {getEmptyBalanceReason || 'No hay uso de competencias registrado en este período'}
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
                <Clock className="w-5 w-5" />
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
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No hay competencias definidas para esta materia.
                  </p>
                </div>
              ) : competenciasPendientes.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {competenciasPendientes.map(comp => (
                    <div key={comp.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0">
                          {comp.codigo}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{comp.nombre}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {comp.descripcion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="text-center">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      ¡Excelente! Todas las competencias fueron trabajadas en este período
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Evaluaciones guardadas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Evaluaciones Guardadas
            </CardTitle>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar seleccionadas ({selectedIds.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Cargando evaluaciones...</p>
            </div>
          ) : evaluacionesParaMostrar.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">
                {evaluaciones.length === 0 ? 'Aún no has guardado evaluaciones' : 'No se encontraron evaluaciones'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {evaluaciones.length === 0
                  ? 'Genera una evaluación y guárdala para verla aquí'
                  : 'Intenta ajustar los filtros para ver más resultados'}
              </p>
              <Button onClick={() => navigate('/evaluaciones/nuevo')}>
                <Plus className="h-4 w-4 mr-2" />
                Generar evaluación
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {evaluacionesParaMostrar.map((evaluacion) => (
                <div
                  key={evaluacion.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(evaluacion.id)}
                    onCheckedChange={(checked) => {
                      const newSet = new Set(selectedIds);
                      if (checked) {
                        newSet.add(evaluacion.id);
                      } else {
                        newSet.delete(evaluacion.id);
                      }
                      setSelectedIds(newSet);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold truncate">
                        {evaluacion.nombre || `Evaluación ${evaluacion.id.substring(0, 8)}`}
                      </h4>
                      <Badge variant="secondary">{evaluacion.materia}</Badge>
                      <Badge variant="outline">{evaluacion.grupo_id}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {evaluacion.fecha && (() => {
                        try {
                          const fecha = new Date(evaluacion.fecha);
                          if (!isNaN(fecha.getTime())) {
                            return <span>📅 {fecha.toLocaleDateString('es-ES')}</span>;
                          }
                        } catch (e) {
                          console.warn('[EVALUACIONES] Error formatting fecha:', evaluacion.fecha);
                        }
                        return null;
                      })()}
                      {evaluacion.competencias_anep?.length > 0 && (
                        <span>📊 {evaluacion.competencias_anep.length} competencias</span>
                      )}
                      {evaluacion.saved_at && (() => {
                        try {
                          const savedAt = new Date(evaluacion.saved_at);
                          if (!isNaN(savedAt.getTime())) {
                            return <span>💾 {savedAt.toLocaleDateString('es-ES')}</span>;
                          }
                        } catch (e) {
                          console.warn('[EVALUACIONES] Error formatting saved_at:', evaluacion.saved_at);
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // TODO: Navigate to evaluation detail/edit page
                      toast({
                        title: "Funcionalidad pendiente",
                        description: "La vista de detalle de evaluación estará disponible pronto"
                      });
                    }}
                  >
                    Ver detalles
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar evaluaciones?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar {selectedIds.size} evaluación(es)? 
            Esta acción se puede revertir desde la base de datos si es necesario.
          </p>
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

export default MisEvaluaciones;
