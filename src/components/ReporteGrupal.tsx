import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Users, FileText, Download, BarChart3, TrendingUp, AlertTriangle, Target, User } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { PDFGenerator } from './PDFGenerator';

interface Student {
  id: number;
  name: string;
  perfil: string;
  promedio: number;
  tendencia: 'up' | 'down' | 'stable';
  contemplaciones: string[];
  alertas?: string[];
}

interface ReporteGrupalProps {
  students: Student[];
  groupName: string;
  period: string;
}

const ReporteGrupal = ({ students, groupName, period }: ReporteGrupalProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');
  const [exportingBulk, setExportingBulk] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Calculate group statistics
  const promedioGrupal = students.reduce((acc, student) => acc + student.promedio, 0) / students.length;
  const estudiantesConAlertas = students.filter(s => s.alertas && s.alertas.length > 0).length;
  const estudiantesConContemplaciones = students.filter(s => s.contemplaciones.length > 0).length;

  // Performance distribution
  const performanceDistribution = [
    { name: 'Excelente (9-10)', count: students.filter(s => s.promedio >= 9).length, color: '#22c55e' },
    { name: 'Muy Bueno (8-8.9)', count: students.filter(s => s.promedio >= 8 && s.promedio < 9).length, color: '#84cc16' },
    { name: 'Bueno (7-7.9)', count: students.filter(s => s.promedio >= 7 && s.promedio < 8).length, color: '#f59e0b' },
    { name: 'Regular (6-6.9)', count: students.filter(s => s.promedio >= 6 && s.promedio < 7).length, color: '#f97316' },
    { name: 'Necesita Apoyo (<6)', count: students.filter(s => s.promedio < 6).length, color: '#ef4444' }
  ];

  // Learning profiles distribution
  const perfilesCount = students.reduce((acc, student) => {
    acc[student.perfil] = (acc[student.perfil] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const perfilesData = Object.entries(perfilesCount).map(([perfil, count]) => ({
    name: perfil,
    value: count,
    percentage: (count / students.length * 100).toFixed(1)
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  // Students by performance for detailed view
  const studentsByPerformance = students.sort((a, b) => b.promedio - a.promedio);

  const handleBulkExport = async () => {
    setExportingBulk(true);
    setExportProgress(0);
    
    await PDFGenerator.generateBulkReports(students, (progress) => {
      setExportProgress(progress);
    });
    
    setExportingBulk(false);
    setExportProgress(0);
  };

  const generateGroupReport = () => {
    const element = document.getElementById('group-report-content');
    if (element) {
      PDFGenerator.generateFromElement('group-report-content', `reporte_grupal_${groupName.replace(/\s+/g, '_')}`);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          📊 Reporte Grupal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-6 h-6" />
              Reporte Grupal - {groupName}
            </span>
            <div className="flex gap-2">
              <Button
                onClick={handleBulkExport}
                variant="outline"
                disabled={exportingBulk}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {exportingBulk ? `Exportando... ${exportProgress.toFixed(0)}%` : 'Exportar Individual'}
              </Button>
              <Button
                onClick={generateGroupReport}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Exportar Grupal
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {exportingBulk && (
          <div className="mb-4">
            <Progress value={exportProgress} className="w-full" />
            <p className="text-sm text-center mt-2">Generando reportes individuales...</p>
          </div>
        )}

        <div id="group-report-content" className="bg-white">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
              <TabsTrigger value="perfiles">Perfiles</TabsTrigger>
              <TabsTrigger value="alertas">Alertas</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-2xl font-bold">{students.length}</p>
                        <p className="text-sm text-muted-foreground">Estudiantes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-2xl font-bold">{promedioGrupal.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">Promedio Grupal</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="text-2xl font-bold">{estudiantesConContemplaciones}</p>
                        <p className="text-sm text-muted-foreground">Con Contemplaciones</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <div>
                        <p className="text-2xl font-bold">{estudiantesConAlertas}</p>
                        <p className="text-sm text-muted-foreground">Con Alertas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Distribución de Rendimiento</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performanceDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                      <YAxis />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rendimiento" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ranking de Estudiantes por Rendimiento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {studentsByPerformance.map((student, index) => (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            index < 3 ? 'bg-yellow-500' : 'bg-gray-500'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-muted-foreground">{student.perfil}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">{student.promedio}</p>
                            <div className="flex items-center gap-1">
                              <TrendingUp className={`w-4 h-4 ${
                                student.tendencia === 'up' ? 'text-green-500' : 
                                student.tendencia === 'down' ? 'text-red-500' : 'text-gray-500'
                              }`} />
                              <span className="text-xs capitalize">{student.tendencia}</span>
                            </div>
                          </div>
                          
                          {student.contemplaciones.length > 0 && (
                            <Badge variant="secondary">
                              {student.contemplaciones.length} contemplaciones
                            </Badge>
                          )}
                          
                          {student.alertas && student.alertas.length > 0 && (
                            <Badge variant="destructive">
                              {student.alertas.length} alertas
                            </Badge>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="perfiles" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Distribución de Perfiles de Aprendizaje</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={perfilesData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                        >
                          {perfilesData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Detalles por Perfil</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {perfilesData.map((perfil, index) => (
                        <div key={perfil.name} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{perfil.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold">{perfil.value}</span>
                            <span className="text-sm text-muted-foreground ml-2">({perfil.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="alertas" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    Estudiantes que Requieren Atención
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {estudiantesConAlertas > 0 ? (
                    <div className="space-y-4">
                      {students
                        .filter(s => s.alertas && s.alertas.length > 0)
                        .map((student) => (
                        <div key={student.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span className="font-medium">{student.name}</span>
                              <Badge variant="outline">{student.perfil}</Badge>
                            </div>
                            <span className="text-lg font-bold text-primary">{student.promedio}</span>
                          </div>
                          <div className="space-y-1">
                            {student.alertas?.map((alerta, index) => (
                              <div key={index} className="flex items-start gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                                <span>{alerta}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No hay alertas activas en el grupo</p>
                      <p className="text-sm">¡Excelente trabajo!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReporteGrupal;