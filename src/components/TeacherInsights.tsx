import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { PlusCircle, User, Calendar, BookOpen, Heart, Home, Users } from 'lucide-react';

interface TeacherInsight {
  id: string;
  date: string;
  category: 'academico' | 'comportamental' | 'social' | 'familiar' | 'emocional';
  observation: string;
}

interface TeacherInsightsProps {
  studentId: number;
  studentName: string;
}

const TeacherInsights = ({ studentId, studentName }: TeacherInsightsProps) => {
  const [insights, setInsights] = useState<TeacherInsight[]>([
    {
      id: '1',
      date: '2024-01-15',
      category: 'academico',
      observation: 'Muestra dificultades para concentrarse en actividades de lectura prolongada, pero responde muy bien a explicaciones visuales.'
    },
    {
      id: '2', 
      date: '2024-01-10',
      category: 'social',
      observation: 'Prefiere trabajar en grupos pequeños. Se muestra más participativo cuando está con compañeros específicos.'
    }
  ]);
  
  const [newObservation, setNewObservation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TeacherInsight['category']>('academico');
  const [isAddingNew, setIsAddingNew] = useState(false);

  const categories = {
    academico: { icon: BookOpen, label: 'Académico', color: 'bg-blue-100 text-blue-800' },
    comportamental: { icon: User, label: 'Comportamental', color: 'bg-green-100 text-green-800' },
    social: { icon: Users, label: 'Social', color: 'bg-purple-100 text-purple-800' },
    familiar: { icon: Home, label: 'Familiar', color: 'bg-orange-100 text-orange-800' },
    emocional: { icon: Heart, label: 'Emocional', color: 'bg-red-100 text-red-800' }
  };

  const handleAddObservation = () => {
    if (newObservation.trim()) {
      const newInsight: TeacherInsight = {
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        category: selectedCategory,
        observation: newObservation
      };
      setInsights([newInsight, ...insights]);
      setNewObservation('');
      setIsAddingNew(false);
    }
  };

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-6 h-6 text-primary" />
          Observaciones para seguimiento del alumno
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Comparte tus observaciones sobre el estudiante para que la IA pueda ofrecer sugerencias más precisas
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Add New Observation */}
          {isAddingNew ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-muted/50 rounded-lg border-2 border-dashed border-primary/30"
            >
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Categoría de observación
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(categories).map(([key, cat]) => (
                      <Badge
                        key={key}
                        variant={selectedCategory === key ? 'default' : 'outline'}
                        className={`cursor-pointer ${selectedCategory === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        onClick={() => setSelectedCategory(key as TeacherInsight['category'])}
                      >
                        <cat.icon className="w-3 h-3 mr-1" />
                        {cat.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Tu observación
                  </label>
                  <Textarea
                    value={newObservation}
                    onChange={(e) => setNewObservation(e.target.value)}
                    placeholder="Describe lo que has observado sobre el estudiante..."
                    className="min-h-20"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleAddObservation} disabled={!newObservation.trim()}>
                    Guardar Observación
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsAddingNew(false);
                    setNewObservation('');
                  }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <Button 
              onClick={() => setIsAddingNew(true)} 
              variant="outline" 
              className="w-full border-dashed border-2 border-primary/30 hover:border-primary/50"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Agregar Nueva Observación
            </Button>
          )}

          {/* Existing Observations */}
          <div className="space-y-3">
            {insights.map((insight, index) => {
              const category = categories[insight.category];
              const CategoryIcon = category.icon;
              
              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="p-3 bg-card border border-border rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={category.color}>
                        <CategoryIcon className="w-3 h-3 mr-1" />
                        {category.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {insight.date}
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{insight.observation}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeacherInsights;
