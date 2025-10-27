import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { GripVertical, Settings, Save, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface SectionOrderManagerProps {
  sections: Array<{
    id: string;
    title: string;
    icon: string;
    visible: boolean;
  }>;
  onSave: (newOrder: Array<{id: string; title: string; icon: string; visible: boolean}>) => void;
}

const SectionOrderManager = ({ sections, onSave }: SectionOrderManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localSections, setLocalSections] = useState(sections);

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...localSections];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < newSections.length) {
      [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
      setLocalSections(newSections);
    }
  };

  const toggleVisibility = (index: number) => {
    const newSections = [...localSections];
    newSections[index].visible = !newSections[index].visible;
    setLocalSections(newSections);
  };

  const handleSave = () => {
    onSave(localSections);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setLocalSections(sections);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mb-4">
          <Settings className="w-4 h-4 mr-2" />
          Ordenar secciones
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Organizar Secciones del Perfil</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {localSections.map((section, index) => (
            <motion.div
              key={section.id}
              layout
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                section.visible ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-75'
              }`}
            >
              <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
              
              <div className="flex-1 flex items-center gap-2">
                <span className="text-lg">{section.icon}</span>
                <span className="text-sm font-medium text-gray-800">{section.title}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="h-6 w-6 p-0"
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === localSections.length - 1}
                  className="h-6 w-6 p-0"
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant={section.visible ? "default" : "outline"}
                  onClick={() => toggleVisibility(index)}
                  className="h-6 px-2 text-xs"
                >
                  {section.visible ? 'Visible' : 'Oculto'}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
        
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSave} className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            Guardar orden
          </Button>
          <Button variant="outline" onClick={handleCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SectionOrderManager;