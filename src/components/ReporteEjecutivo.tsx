import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { FileText, Download, Printer, Eye, User, BookOpen, TrendingUp, Target, AlertTriangle } from 'lucide-react';
import { PDFGenerator } from './PDFGenerator';
import PlantillasReporte from './PlantillasReporte';
import { toast } from "sonner";

interface ReporteEjecutivoProps {
  student: {
    id: number;
    name: string;
    perfil: string;
    avatar: string;
    contemplaciones: string[];
    anotaciones?: string;
    historialAcademico?: any[];
    informeTecnico?: any;
  };
}

const ReporteEjecutivo = ({ student }: ReporteEjecutivoProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [secciones, setSecciones] = useState({
    datosBasicos: true,
    rendimientoAcademico: true,
    contemplaciones: true,
    evolucion: true,
    recomendaciones: true,
    informeTecnico: !!student.informeTecnico,
    alertas: true,
    comentarios: true
  });
  const [comentariosEspecificos, setComentariosEspecificos] = useState('');
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [guardandoBorrador, setGuardandoBorrador] = useState(false);

  const handlePlantillaSeleccionada = (plantilla: any) => {
    setSecciones(plantilla.secciones);
    setComentariosEspecificos(plantilla.comentariosDefault);
    toast.success(`Plantilla "${plantilla.nombre}" cargada`);
  };

  const guardarBorrador = () => {
    setGuardandoBorrador(true);
    const borrador = {
      studentId: student.id,
      secciones,
      comentariosEspecificos,
      fechaGuardado: new Date().toISOString()
    };
    
    localStorage.setItem(`borrador_reporte_${student.id}`, JSON.stringify(borrador));
    
    setTimeout(() => {
      setGuardandoBorrador(false);
      toast.success('Borrador guardado exitosamente');
    }, 1000);
  };

  const cargarBorrador = () => {
    const borrador = localStorage.getItem(`borrador_reporte_${student.id}`);
    if (borrador) {
      const data = JSON.parse(borrador);
      setSecciones(data.secciones);
      setComentariosEspecificos(data.comentariosEspecificos);
      toast.success('Borrador cargado');
    }
  };

  const generarPDF = async () => {
    try {
      await PDFGenerator.generateFromElement(
        'report-preview-content', 
        `reporte_${student.name.replace(/\s+/g, '_')}`
      );
      toast.success('PDF generado exitosamente');
    } catch (error) {
      toast.error('Error al generar PDF');
    }
  };

  // Mock data for the report
  const datosReporte = {
    fechaGeneracion: new Date().toLocaleDateString('es-ES'),
    docente: 'Prof. María González',
    curso: '5º Año A',
    periodo: 'Tercer Trimestre 2024',
    promedioGeneral: 7.8,
    promedioAnterior: 7.2,
    tendencia: 'positiva',
    materias: [
      { nombre: 'Matemática', actual: 8.5, anterior: 7.5, tendencia: 'up' },
      { nombre: 'Lengua', actual: 7.0, anterior: 6.5, tendencia: 'up' },
      { nombre: 'Historia', actual: 9.0, anterior: 8.5, tendencia: 'up' },
      { nombre: 'Ciencias', actual: 8.0, anterior: 7.5, tendencia: 'up' }
    ],
    recomendacionesPrincipales: [
      'Continuar con estrategias de apoyo visual que han demostrado efectividad',
      'Reforzar confianza en evaluaciones escritas de Lengua',
      'Mantener comunicación constante con la familia sobre el progreso',
      'Programar seguimiento trimestral con equipo psicopedagógico'
    ],
    alertas: [
      'Necesita apoyo adicional en comprensión lectora',
      'Monitorear ansiedad evaluativa'
    ]
  };

  const handleSeccionChange = (seccion: string, checked: boolean) => {
    setSecciones(prev => ({ ...prev, [seccion]: checked }));
  };

  const ReportPreview = () => (
    <div id="report-preview-content" className="max-w-4xl mx-auto bg-white p-8 text-sm">
      {/* Header */}
      <div className="border-b-2 border-blue-600 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-blue-800">REPORTE EJECUTIVO ESTUDIANTIL</h1>
            <p className="text-gray-600">Reunión con Padres/Tutores</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Fecha: {datosReporte.fechaGeneracion}</p>
            <p>Docente: {datosReporte.docente}</p>
            <p>Curso: {datosReporte.curso}</p>
          </div>
        </div>
      </div>

      {/* Student Basic Data */}
      {secciones.datosBasicos && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <User className="w-5 h-5" />
            DATOS DEL ESTUDIANTE
          </h2>
          <div className="bg-blue-50 p-4 rounded">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Nombre:</strong> {student.name}</p>
                <p><strong>Perfil de Aprendizaje:</strong> {student.perfil}</p>
                <p><strong>Período:</strong> {datosReporte.periodo}</p>
              </div>
              <div>
                <p><strong>Contemplaciones Activas:</strong> {student.contemplaciones.length}</p>
                <p><strong>Modalidad:</strong> Común con apoyos específicos</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Academic Performance */}
      {secciones.rendimientoAcademico && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            RENDIMIENTO ACADÉMICO ACTUAL
          </h2>
          <div className="bg-green-50 p-4 rounded">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-2xl font-bold text-green-600">{datosReporte.promedioGeneral}</p>
                <p className="text-sm text-gray-600">Promedio General</p>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-600">
                  +{(datosReporte.promedioGeneral - datosReporte.promedioAnterior).toFixed(1)}
                </p>
                <p className="text-sm text-gray-600">Mejora vs período anterior</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {datosReporte.materias.map(materia => (
                <div key={materia.nombre} className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span>{materia.nombre}</span>
                  <div className="text-right">
                    <span className="font-bold">{materia.actual}</span>
                    <span className="text-xs text-green-600 ml-1">
                      (+{(materia.actual - materia.anterior).toFixed(1)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Evolution */}
      {secciones.evolucion && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            EVOLUCIÓN Y PROGRESO
          </h2>
          <div className="bg-blue-50 p-4 rounded">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold text-green-600 mb-2">Fortalezas Identificadas:</h4>
                <ul className="text-sm space-y-1">
                  <li>• Excelente respuesta a apoyos visuales</li>
                  <li>• Mejora consistente en todas las materias</li>
                  <li>• Mayor confianza en evaluaciones</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-yellow-600 mb-2">Áreas de Trabajo:</h4>
                <ul className="text-sm space-y-1">
                  <li>• Comprensión lectora de textos complejos</li>
                  <li>• Autonomía en resolución de problemas</li>
                  <li>• Expresión escrita estructurada</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contemplations */}
      {secciones.contemplaciones && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Target className="w-5 h-5" />
            CONTEMPLACIONES IMPLEMENTADAS
          </h2>
          <div className="bg-purple-50 p-4 rounded">
            <div className="grid grid-cols-1 gap-2">
              {student.contemplaciones.slice(0, 5).map((contemplacion, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                  <span className="text-sm">{contemplacion}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-3">
              <strong>Efectividad:</strong> Las contemplaciones implementadas han mostrado un impacto positivo 
              significativo en el rendimiento académico del estudiante.
            </p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {secciones.recomendaciones && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Target className="w-5 h-5" />
            RECOMENDACIONES PARA EL HOGAR
          </h2>
          <div className="bg-yellow-50 p-4 rounded">
            <ul className="space-y-2">
              {datosReporte.recomendacionesPrincipales.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Technical Report Summary */}
      {secciones.informeTecnico && student.informeTecnico && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            SÍNTESIS PSICOPEDAGÓGICA
          </h2>
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-sm mb-2"><strong>Síntesis:</strong> {student.informeTecnico.sintesis}</p>
            <p className="text-sm mb-2"><strong>Estilo de Aprendizaje:</strong> {student.informeTecnico.estiloAprendizaje}</p>
            <p className="text-sm"><strong>Modalidad de Cursado:</strong> {student.informeTecnico.modalidadCursado}</p>
          </div>
        </div>
      )}

      {/* Specific Comments */}
      {comentariosEspecificos && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">COMENTARIOS ESPECÍFICOS PARA ESTA REUNIÓN</h2>
          <div className="bg-orange-50 p-4 rounded border-l-4 border-orange-400">
            <p className="text-sm">{comentariosEspecificos}</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {datosReporte.alertas.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            PUNTOS DE ATENCIÓN
          </h2>
          <div className="bg-red-50 p-4 rounded border-l-4 border-red-400">
            <ul className="space-y-1">
              {datosReporte.alertas.map((alerta, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">•</span>
                  <span className="text-sm">{alerta}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t-2 border-gray-300 pt-4 mt-8">
        <div className="grid grid-cols-2 gap-8 text-xs text-gray-500">
          <div>
            <p><strong>Próxima reunión:</strong> _____________</p>
            <p><strong>Firma docente:</strong> _____________</p>
          </div>
          <div>
            <p><strong>Notas de la reunión:</strong></p>
            <div className="border border-gray-300 h-16 mt-1"></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3">
          <FileText className="w-4 h-4 mr-2" />
          📋 Generar Reporte para Reunión
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Generar Reporte Ejecutivo - {student.name}
          </DialogTitle>
        </DialogHeader>

        {!mostrarPreview ? (
          <div className="space-y-6">
            {/* Templates and Actions Bar */}
            <div className="flex gap-4 justify-between items-center">
              <PlantillasReporte 
                onSelectPlantilla={handlePlantillaSeleccionada}
                seccionesActuales={secciones}
                comentariosActuales={comentariosEspecificos}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={cargarBorrador}
                  className="flex items-center gap-2"
                >
                  📝 Cargar Borrador
                </Button>
                <Button
                  variant="outline"
                  onClick={guardarBorrador}
                  disabled={guardandoBorrador}
                  className="flex items-center gap-2"
                >
                  {guardandoBorrador ? '⏳ Guardando...' : '💾 Guardar Borrador'}
                </Button>
              </div>
            </div>
            {/* Section Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Secciones a Incluir</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(secciones).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={value}
                        onCheckedChange={(checked) => handleSeccionChange(key, checked as boolean)}
                      />
                      <label htmlFor={key} className="text-sm capitalize">
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Specific Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Comentarios Específicos para esta Reunión</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={comentariosEspecificos}
                  onChange={(e) => setComentariosEspecificos(e.target.value)}
                  placeholder="Agregue comentarios específicos que desea destacar en esta reunión con los padres..."
                  className="min-h-24"
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end">
              <Button
                variant="outline"
                onClick={() => setMostrarPreview(true)}
                className="flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Vista Previa
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4 justify-between items-center">
              <Button
                variant="outline"
                onClick={() => setMostrarPreview(false)}
              >
                ← Volver a Configuración
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                  onClick={generarPDF}
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </Button>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-[70vh] overflow-y-auto">
              <ReportPreview />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReporteEjecutivo;