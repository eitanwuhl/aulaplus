import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { Users, Settings, FileText, ArrowDown, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GroupCard } from "@/components/ui/enhanced-card";
import { EnhancedField, EnhancedTextarea, FormProgress } from "@/components/ui/enhanced-form";
import { LoadingState } from "@/components/ui/loading-states";

interface Group {
  id: number;
  name: string;
  studentCount: number;
  year: string;
  section: string;
}

interface CRMDemoSectionProps {
  mockGroups: Group[];
  onGroupClick: (group: any) => void;
}

const CRMDemoSection = ({ mockGroups, onGroupClick }: CRMDemoSectionProps) => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [evaluationsGenerated, setEvaluationsGenerated] = useState(false);
  const [formData, setFormData] = useState({
    grupoSeleccionado: "",
    materia: "",
    temas: "",
    prototipo: ""
  });

  const handleGenerateClick = () => {
    setShowForm(true);
    // Scroll to form after a short delay
    setTimeout(() => {
      const element = document.getElementById('evaluation-form');
      element?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  };

  const handleFormSubmit = () => {
    setEvaluationsGenerated(true);
    // Scroll to evaluations after a short delay
    setTimeout(() => {
      const element = document.getElementById('generated-evaluations');
      element?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  };

  const isFormValid = formData.grupoSeleccionado && formData.materia && formData.temas;

  const evaluationVersions = [
    {
      version: 1,
      students: ["Ana García", "Carlos Rodríguez"],
      contemplations: [
        "Consignas más breves",
        "Tiempo adicional",
        "Instrucciones verbales claras"
      ],
      exampleQuestion: '"Completá la siguiente oración con la palabra correcta: El río _______ por la montaña." (con 3 opciones para elegir)'
    },
    {
      version: 2,
      students: ["Sofía López"],
      contemplations: [
        "Uso de imágenes de apoyo",
        "Consignas más breves",
        "Ambiente silencioso recomendado"
      ],
      exampleQuestion: '"Observá las imágenes y respondé: ¿Cuál de estos objetos tiene forma rectangular?" (con opciones visuales)'
    }
  ];

  return (
    <section id="demo-crm" className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            Visión simple y amigable de los grupos y perfiles de los alumnos
          </h2>
        </motion.div>

        {/* Groups Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {mockGroups.map((group, index) => (
            <GroupCard 
              key={group.id}
              group={group}
              onClick={() => onGroupClick(group)}
              delay={index * 0.1}
            />
          ))}
        </div>
        
        {/* Botones de herramientas */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 mb-12"
        >
          <Card className="border-2 border-purple-200 bg-white/80">
            <CardHeader>
              <CardTitle className="text-2xl text-purple-700 flex items-center gap-2">
                🚀 Herramientas disponibles para todos los grupos
              </CardTitle>
              <CardDescription>
                Accede a las funcionalidades principales de Aula+ para mejorar la planificación y evaluación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <Button 
                  onClick={() => navigate('/evaluaciones')}
                  className="h-20 text-left justify-start bg-blue-600 hover:bg-blue-700 text-white flex-col items-start p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5" />
                    <span className="text-lg font-semibold">Generar evaluaciones para el grupo</span>
                  </div>
                  <span className="text-sm opacity-90">Crear evaluaciones adaptadas a los perfiles de cada grupo</span>
                </Button>
                
                <Button 
                  onClick={() => navigate('/planificacion')}
                  className="h-20 text-left justify-start bg-green-600 hover:bg-green-700 text-white flex-col items-start p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-5 h-5" />
                    <span className="text-lg font-semibold">Asistente de planificación de clase</span>
                  </div>
                  <span className="text-sm opacity-90">Sugerencias pedagógicas para el desarrollo de clases</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>


        {/* Evaluation Form */}
        {showForm && (
          <motion.div
            id="evaluation-form"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <Card className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl text-green-700 flex items-center justify-center gap-2">
                  📝 Configuración de la evaluación
                </CardTitle>
                <p className="text-gray-600 mt-2">
                  Completa la información para generar evaluaciones adaptadas a tu grupo
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-1 gap-6">
                  {/* Group Selection Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="grupo" className="text-base font-semibold text-gray-700">
                      👥 Seleccionar grupo *
                    </Label>
                    <Select
                      value={formData.grupoSeleccionado}
                      onValueChange={(value) => setFormData({...formData, grupoSeleccionado: value})}
                    >
                      <SelectTrigger className="text-base bg-white border-2 hover:border-primary/30 transition-colors">
                        <SelectValue placeholder="Selecciona el grupo para generar la evaluación..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg z-50">
                        {mockGroups.map((group) => (
                          <SelectItem key={group.id} value={group.name} className="cursor-pointer hover:bg-gray-100">
                            {group.name} - {group.year} {group.section} ({group.studentCount} estudiantes)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.grupoSeleccionado && (
                      <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400 mt-2">
                        <p className="text-blue-800 text-sm">
                          ✓ Grupo seleccionado: <strong>{formData.grupoSeleccionado}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <EnhancedField
                    label="📚 Materia"
                    placeholder="Ej: Lengua, Matemática, Ciencias Sociales..."
                    value={formData.materia}
                    onChange={(e) => setFormData({...formData, materia: e.target.value})}
                    disabled={!formData.grupoSeleccionado}
                    required
                    hint="Especifica la materia que deseas evaluar"
                  />
                  
                  <EnhancedTextarea
                    label="🎯 Temas a evaluar"
                    placeholder="Describe los temas o contenidos que quieres evaluar..."
                    value={formData.temas}
                    onChange={(e) => setFormData({...formData, temas: e.target.value})}
                    disabled={!formData.grupoSeleccionado}
                    required
                    maxLength={500}
                    showCount
                    hint="Detalla los contenidos específicos a evaluar"
                  />
                  
                  <EnhancedTextarea
                    label="📋 Prototipo de evaluación (opcional)"
                    placeholder="Si tienes un modelo o estructura específica de evaluación, descríbela aquí..."
                    value={formData.prototipo}
                    onChange={(e) => setFormData({...formData, prototipo: e.target.value})}
                    disabled={!formData.grupoSeleccionado}
                    maxLength={300}
                    showCount
                    hint="Proporciona un ejemplo o estructura que desees seguir"
                  />
                </div>
                
                <div className="text-center pt-4">
                  <Button
                    onClick={handleFormSubmit}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    disabled={!isFormValid}
                  >
                    ✨ Generar evaluaciones adaptadas
                  </Button>
                  {!isFormValid && (
                    <p className="text-sm text-gray-500 mt-2">
                      * Completa los campos obligatorios para continuar
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Generated Evaluations */}
        {evaluationsGenerated && (
          <motion.div
            id="generated-evaluations"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mt-16 space-y-8"
          >
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-gray-800 mb-4">
                ✨ Evaluaciones generadas automáticamente
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                Aula+ propone diferentes versiones para contemplar la diversidad del grupo {formData.grupoSeleccionado}
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400 max-w-4xl mx-auto">
                <p className="text-gray-700 text-sm leading-relaxed">
                  💡 <strong>Enfoque adaptativo:</strong> Cada versión está diseñada específicamente para diferentes perfiles de aprendizaje, 
                  aplicando las contemplaciones necesarias para que todos los estudiantes puedan demostrar sus conocimientos de la mejor manera posible.
                </p>
              </div>
            </div>

            {evaluationVersions.map((evaluation, index) => (
              <motion.div
                key={evaluation.version}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
              >
                <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-yellow-50">
                  <CardHeader>
                    <CardTitle className="text-2xl text-blue-700 flex items-center gap-2">
                      🧾 Versión de evaluación {evaluation.version}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Students contemplated */}
                    <div className="bg-white p-4 rounded-lg border-l-4 border-blue-400">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        <h4 className="font-semibold text-gray-800">👥 Contempla a:</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {evaluation.students.map((student, idx) => (
                          <Badge key={idx} className="bg-blue-100 text-blue-800">
                            {student}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Applied contemplations */}
                    <div className="bg-white p-4 rounded-lg border-l-4 border-yellow-400">
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="w-5 h-5 text-yellow-600" />
                        <h4 className="font-semibold text-gray-800">⚙️ Contemplaciones aplicadas:</h4>
                      </div>
                      <ul className="space-y-1">
                        {evaluation.contemplations.map((contemplation, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-gray-700">
                            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                            {contemplation}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Example question */}
                    <div className="bg-white p-4 rounded-lg border-l-4 border-green-400">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-5 h-5 text-green-600" />
                        <h4 className="font-semibold text-gray-800">📌 Ejemplo de consigna:</h4>
                      </div>
                      <div className="bg-green-50 p-3 rounded italic text-gray-700">
                        {evaluation.exampleQuestion}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {/* Arrow pointing to next section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="text-center mt-12"
            >
              <ArrowDown className="mx-auto text-blue-400 animate-bounce" size={32} />
              <p className="text-gray-600 mt-2">Continúa para ver cómo se cargan los resultados</p>
            </motion.div>
          </motion.div>
        )}

        {/* New section: Results Loading */}
        {evaluationsGenerated && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="mt-20"
          >
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl text-purple-700 flex items-center justify-center gap-2">
                  📥 Carga de resultados en el perfil del alumno
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                <p className="text-lg text-gray-700 leading-relaxed">
                  Luego de realizada la evaluación, el/la docente podrá ingresar al perfil de cada alumno para:
                </p>
                
                <div className="grid md:grid-cols-2 gap-6 mt-8">
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-400">
                    <div className="text-2xl mb-3">📊</div>
                    <h4 className="font-semibold text-gray-800 mb-2">Registrar la nota cuantitativa obtenida</h4>
                    <p className="text-gray-600 text-sm">
                      Calificación numérica de la evaluación realizada
                    </p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-pink-400">
                    <div className="text-2xl mb-3">📝</div>
                    <h4 className="font-semibold text-gray-800 mb-2">Escribir una observación cualitativa</h4>
                    <p className="text-gray-600 text-sm">
                      Que permita entender mejor cómo se desenvolvió el alumno en esa instancia, especialmente en función de sus necesidades o contemplaciones
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400 mt-6">
                  <p className="text-blue-800 text-sm leading-relaxed">
                    📌 <strong>Esta información quedará guardada en la sección "Resultados de evaluaciones" del perfil del alumno, junto a la versión de evaluación que resolvió.</strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default CRMDemoSection;
