
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Edit2 } from "lucide-react";
import { motion } from "framer-motion";

const ResultsFeedbackSection = () => {
  const [editingResults, setEditingResults] = useState({
    comprension: false,
    resolucion: false,
    expresion: false
  });
  const [resultComments, setResultComments] = useState({
    comprension: "Demuestra buena comprensión de textos narrativos, pero necesita apoyo con textos expositivos.",
    resolucion: "Aplica estrategias básicas correctamente. Requiere más práctica con problemas de múltiples pasos.",
    expresion: "Excelente organización de ideas. Continuar trabajando la ortografía y puntuación."
  });

  const handleEditResult = (field: string) => {
    setEditingResults(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            Retroalimentación cualitativa
          </h2>
          <p className="text-xl text-gray-600">
            Comentarios pedagógicos editables para cada área evaluada
          </p>
        </motion.div>

        <div className="grid md:grid-cols-1 gap-8 max-w-4xl mx-auto">
          {/* Comprensión lectora */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    📖 Comprensión lectora
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditResult('comprension')}
                  >
                    {editingResults.comprension ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  </Button>
                </div>
                {editingResults.comprension ? (
                  <Textarea
                    value={resultComments.comprension}
                    onChange={(e) => setResultComments(prev => ({ ...prev, comprension: e.target.value }))}
                    onBlur={() => handleEditResult('comprension')}
                    className="w-full min-h-20"
                    autoFocus
                  />
                ) : (
                  <div className="p-4 bg-white rounded-lg">
                    <p className="text-gray-700 italic">"{resultComments.comprension}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Resolución de problemas */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 shadow-lg">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    🧮 Resolución de problemas
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditResult('resolucion')}
                  >
                    {editingResults.resolucion ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  </Button>
                </div>
                {editingResults.resolucion ? (
                  <Textarea
                    value={resultComments.resolucion}
                    onChange={(e) => setResultComments(prev => ({ ...prev, resolucion: e.target.value }))}
                    onBlur={() => handleEditResult('resolucion')}
                    className="w-full min-h-20"
                    autoFocus
                  />
                ) : (
                  <div className="p-4 bg-white rounded-lg">
                    <p className="text-gray-700 italic">"{resultComments.resolucion}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Expresión escrita */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <Card className="bg-gradient-to-br from-green-50 to-green-100 shadow-lg">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    ✍️ Expresión escrita
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditResult('expresion')}
                  >
                    {editingResults.expresion ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  </Button>
                </div>
                {editingResults.expresion ? (
                  <Textarea
                    value={resultComments.expresion}
                    onChange={(e) => setResultComments(prev => ({ ...prev, expresion: e.target.value }))}
                    onBlur={() => handleEditResult('expresion')}
                    className="w-full min-h-20"
                    autoFocus
                  />
                ) : (
                  <div className="p-4 bg-white rounded-lg">
                    <p className="text-gray-700 italic">"{resultComments.expresion}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ResultsFeedbackSection;
